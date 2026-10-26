from datetime import date, datetime
from io import BytesIO
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import case, distinct, func, select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..db import get_db
from ..deps import somente_admin
from ..models import (Checklist, ChecklistTipo, Papel, Pergunta, Resposta,
                      RespostaItem, Usuario)
from ..security import hash_senha

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(somente_admin)])

DIA_LOCAL = func.date(func.timezone("America/Sao_Paulo", Checklist.criado_no_celular_em))


class Filtros:
    def __init__(self, de: date | None = None, ate: date | None = None,
                 operador_id: int | None = None, tipo: str | None = None):
        self.de, self.ate, self.operador_id, self.tipo = de, ate, operador_id, tipo

    def condicoes(self):
        c = []
        if self.de:
            c.append(DIA_LOCAL >= self.de)
        if self.ate:
            c.append(DIA_LOCAL <= self.ate)
        if self.operador_id:
            c.append(Checklist.operador_id == self.operador_id)
        if self.tipo:
            c.append(ChecklistTipo.codigo == self.tipo)
        return c


def _q(*colunas, f: Filtros):
    """SELECT sobre respostas ligado a checklist/tipo/operador/pergunta já com os filtros."""
    return (select(*colunas)
            .select_from(RespostaItem)
            .join(Checklist, Checklist.id == RespostaItem.checklist_id)
            .join(ChecklistTipo, ChecklistTipo.id == Checklist.tipo_id)
            .join(Usuario, Usuario.id == Checklist.operador_id)
            .join(Pergunta, Pergunta.id == RespostaItem.pergunta_id)
            .where(*f.condicoes()))


@router.get("/dashboard")
def dashboard(f: Filtros = Depends(), db: Session = Depends(get_db)):
    nc = func.count(case((RespostaItem.resposta == Resposta.NC, 1)))
    conf = func.count(case((RespostaItem.resposta == Resposta.C, 1)))

    total_cl, operadores = db.execute(
        select(func.count(distinct(Checklist.id)), func.count(distinct(Checklist.operador_id)))
        .select_from(Checklist).join(ChecklistTipo, ChecklistTipo.id == Checklist.tipo_id)
        .where(*f.condicoes())).one()
    total_nc, total_c = db.execute(_q(nc, conf, f=f)).one()
    avaliados = total_nc + total_c

    por_dia = db.execute(
        select(DIA_LOCAL.label("dia"), func.count(distinct(Checklist.id)), nc)
        .select_from(Checklist).join(ChecklistTipo, ChecklistTipo.id == Checklist.tipo_id)
        .join(RespostaItem, RespostaItem.checklist_id == Checklist.id)
        .where(*f.condicoes()).group_by("dia").order_by("dia")).all()
    por_operador = db.execute(
        _q(Usuario.nome, func.count(distinct(Checklist.id)), nc, f=f)
        .group_by(Usuario.nome).order_by(nc.desc())).all()
    por_tipo = db.execute(
        _q(ChecklistTipo.nome, func.count(distinct(Checklist.id)), nc, f=f)
        .group_by(ChecklistTipo.nome)).all()
    top = db.execute(
        _q(ChecklistTipo.nome, Pergunta.numero, Pergunta.texto, nc, f=f)
        .group_by(ChecklistTipo.nome, Pergunta.numero, Pergunta.texto)
        .having(nc > 0).order_by(nc.desc()).limit(10)).all()

    return {
        "kpis": {
            "checklists": total_cl, "operadores_ativos": operadores, "nao_conformes": total_nc,
            "conformidade_pct": round(100 * total_c / avaliados, 1) if avaliados else None,
        },
        "por_dia": [{"dia": d.isoformat(), "checklists": c, "nc": n} for d, c, n in por_dia],
        "por_operador": [{"operador": o, "checklists": c, "nc": n} for o, c, n in por_operador],
        "por_tipo": [{"tipo": t, "checklists": c, "nc": n} for t, c, n in por_tipo],
        "top_perguntas_nc": [{"tipo": t, "numero": nm, "texto": tx, "nc": n} for t, nm, tx, n in top],
    }


@router.get("/anomalias")
def anomalias(
    f: Filtros = Depends(),
    limite: int = Query(50, le=200),
    pagina: int = Query(1, ge=1),
    db: Session = Depends(get_db),
):
    base = _q(RespostaItem, f=f).where(RespostaItem.resposta == Resposta.NC)
    total = db.scalar(select(func.count()).select_from(base.with_only_columns(RespostaItem.id).subquery()))
    itens = db.scalars(
        base.options(selectinload(RespostaItem.fotos), selectinload(RespostaItem.checklist)
                     .selectinload(Checklist.operador),
                     selectinload(RespostaItem.checklist).selectinload(Checklist.tipo),
                     selectinload(RespostaItem.pergunta))
        .order_by(Checklist.criado_no_celular_em.desc())
        .limit(limite).offset((pagina - 1) * limite)).all()

    def linha(r: RespostaItem):
        c = r.checklist
        georef = next((x for x in r.fotos if x.latitude is not None), None)
        lat, lng = (georef.latitude, georef.longitude) if georef else (c.latitude, c.longitude)
        return {
            "resposta_id": r.id, "checklist_id": c.id, "data": c.criado_no_celular_em,
            "tipo": c.tipo.nome, "operador": c.operador.nome, "numero": r.pergunta.numero,
            "pergunta": r.pergunta.texto, "comentario": r.comentario,
            "latitude": lat, "longitude": lng, "fotos": [x.id for x in r.fotos],
        }

    return {"total": total, "pagina": pagina, "itens": [linha(r) for r in itens]}


@router.get("/anomalias/pdf")
def anomalias_pdf(f: Filtros = Depends(), db: Session = Depends(get_db)):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    itens = db.scalars(
        _q(RespostaItem, f=f).where(RespostaItem.resposta == Resposta.NC)
        .options(selectinload(RespostaItem.fotos),
                 selectinload(RespostaItem.checklist).selectinload(Checklist.operador),
                 selectinload(RespostaItem.checklist).selectinload(Checklist.tipo),
                 selectinload(RespostaItem.pergunta))
        .order_by(Checklist.criado_no_celular_em.desc())).all()

    fuso = ZoneInfo("America/Sao_Paulo")
    est = getSampleStyleSheet()
    normal, pequeno = est["BodyText"], est["BodyText"].clone("p", fontSize=8, leading=10)
    p = lambda t, e=normal: Paragraph(escape(str(t or "")).replace(chr(10), "<br/>"), e)
    negrito_est = est["BodyText"].clone("n", fontName="Helvetica-Bold")

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15 * mm, rightMargin=15 * mm,
                            topMargin=15 * mm, bottomMargin=15 * mm, title="Relatório de anomalias")
    historia = [Paragraph("Relatório de anomalias", est["Title"]),
                p(f"{len(itens)} item(ns) não conforme(s) · gerado em "
                  f"{datetime.now(fuso):%d/%m/%Y %H:%M}", pequeno), Spacer(1, 6 * mm)]

    for r in itens:
        c = r.checklist
        data = c.criado_no_celular_em.astimezone(fuso)
        georef = next((x for x in r.fotos if x.latitude is not None), None)
        lat, lng = (georef.latitude, georef.longitude) if georef else (c.latitude, c.longitude)
        local = f"{lat:.5f}, {lng:.5f}" if lat is not None else "sem localização"
        bloco = [[p(f"{r.pergunta.numero}. {r.pergunta.texto}", negrito_est)],
                 [p(f"{c.tipo.nome} · {c.operador.nome} · {data:%d/%m/%Y %H:%M} · {local}", pequeno)]]
        if r.comentario:
            bloco.append([p(f"Comentário: {r.comentario}", pequeno)])
        imagens = []
        for foto in r.fotos[:3]:
            caminho = settings.upload_path / foto.caminho
            if caminho.is_file():
                try:
                    from PIL import Image as PIL
                    with PIL.open(caminho) as im:
                        w, h = im.size
                    largura = 55 * mm
                    imagens.append(Image(str(caminho), width=largura, height=largura * h / w))
                except Exception:
                    pass
        if imagens:
            bloco.append([Table([imagens], hAlign="LEFT")])
        t = Table(bloco, colWidths=[doc.width])
        t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.5, colors.grey),
                               ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f3f5"))]))
        historia += [t, Spacer(1, 4 * mm)]

    if not itens:
        historia.append(p("Nenhuma anomalia no período."))
    doc.build(historia)
    nome = f"anomalias-{date.today().isoformat()}.pdf"
    return Response(buf.getvalue(), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{nome}"'})


# --- Usuários -------------------------------------------------------------

class UsuarioIn(BaseModel):
    login: str
    nome: str
    senha: str
    papel: Papel = Papel.operador


class UsuarioPatch(BaseModel):
    nome: str | None = None
    senha: str | None = None
    papel: Papel | None = None
    ativo: bool | None = None


def _usuario_out(u: Usuario):
    return {"id": u.id, "login": u.login, "nome": u.nome, "papel": u.papel, "ativo": u.ativo}


@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    return [_usuario_out(u) for u in db.scalars(select(Usuario).order_by(Usuario.nome))]


@router.post("/usuarios", status_code=201)
def criar_usuario(dados: UsuarioIn, db: Session = Depends(get_db)):
    if db.scalar(select(Usuario.id).where(Usuario.login == dados.login)):
        raise HTTPException(409, "Login já existe")
    if len(dados.senha) < 6:
        raise HTTPException(422, "Senha precisa ter ao menos 6 caracteres")
    u = Usuario(login=dados.login.strip(), nome=dados.nome.strip(),
                senha_hash=hash_senha(dados.senha), papel=dados.papel)
    db.add(u)
    db.commit()
    return _usuario_out(u)


@router.patch("/usuarios/{usuario_id}")
def editar_usuario(usuario_id: int, dados: UsuarioPatch, db: Session = Depends(get_db),
                   admin: Usuario = Depends(somente_admin)):
    u = db.get(Usuario, usuario_id)
    if not u:
        raise HTTPException(404, "Usuário não encontrado")
    if u.id == admin.id and (dados.ativo is False or (dados.papel and dados.papel != Papel.admin)):
        raise HTTPException(422, "Você não pode desativar nem rebaixar a própria conta")
    if dados.nome:
        u.nome = dados.nome.strip()
    if dados.senha:
        if len(dados.senha) < 6:
            raise HTTPException(422, "Senha precisa ter ao menos 6 caracteres")
        u.senha_hash = hash_senha(dados.senha)
    if dados.papel:
        u.papel = dados.papel
    if dados.ativo is not None:
        u.ativo = dados.ativo
    db.commit()
    return _usuario_out(u)
