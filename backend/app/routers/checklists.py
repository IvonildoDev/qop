import json
import uuid
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..db import get_db
from ..deps import usuario_atual
from ..models import (Checklist, ChecklistTipo, Foto, Papel, Pergunta,
                      Resposta, RespostaItem, Usuario)
from ..security import ler_token

router = APIRouter(prefix="/api", tags=["checklists"])

MAX_FOTO_BYTES = 15 * 1024 * 1024
LADO_MAX_PX = 1600


class RespostaIn(BaseModel):
    numero: str
    resposta: Resposta
    comentario: str | None = None


class FotoIn(BaseModel):
    ref: str                      # nome do arquivo enviado no multipart
    numero: str | None = None     # pergunta N/C que originou a foto
    latitude: float | None = None
    longitude: float | None = None
    precisao_m: float | None = None
    tirada_em: datetime | None = None


class ChecklistIn(BaseModel):
    client_uuid: uuid.UUID
    tipo: str
    criado_em: datetime
    latitude: float | None = None
    longitude: float | None = None
    precisao_m: float | None = None
    observacoes: str | None = None
    respostas: list[RespostaIn]
    fotos: list[FotoIn] = []


def salvar_foto(arquivo: UploadFile) -> str:
    dados = arquivo.file.read(MAX_FOTO_BYTES + 1)
    if len(dados) > MAX_FOTO_BYTES:
        raise HTTPException(413, f"Foto '{arquivo.filename}' maior que 15 MB")
    try:
        img = ImageOps.exif_transpose(Image.open(BytesIO(dados))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(422, f"Arquivo '{arquivo.filename}' não é uma imagem válida")
    img.thumbnail((LADO_MAX_PX, LADO_MAX_PX))
    nome = f"{uuid.uuid4().hex}.jpg"
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    img.save(settings.upload_path / nome, "JPEG", quality=80, optimize=True)
    return nome


def serializar_checklist(c: Checklist) -> dict:
    return {
        "id": c.id,
        "tipo": c.tipo.nome,
        "tipo_codigo": c.tipo.codigo,
        "operador": c.operador.nome,
        "criado_em": c.criado_no_celular_em,
        "recebido_em": c.recebido_em,
        "latitude": c.latitude,
        "longitude": c.longitude,
        "precisao_m": c.precisao_m,
        "observacoes": c.observacoes,
        "total_nc": sum(1 for r in c.respostas if r.resposta == Resposta.NC),
        "respostas": [
            {"id": r.id, "numero": r.pergunta.numero, "texto": r.pergunta.texto,
             "resposta": r.resposta, "comentario": r.comentario,
             "fotos": [f.id for f in r.fotos]}
            for r in sorted(c.respostas, key=lambda r: r.pergunta.ordem)
        ],
        "fotos": [
            {"id": f.id, "resposta_id": f.resposta_id, "latitude": f.latitude,
             "longitude": f.longitude, "tirada_em": f.tirada_em}
            for f in c.fotos
        ],
    }


CARREGAR = (
    selectinload(Checklist.tipo), selectinload(Checklist.operador),
    selectinload(Checklist.respostas).selectinload(RespostaItem.pergunta),
    selectinload(Checklist.respostas).selectinload(RespostaItem.fotos),
    selectinload(Checklist.fotos),
)


@router.get("/tipos")
def listar_tipos(db: Session = Depends(get_db), _: Usuario = Depends(usuario_atual)):
    tipos = db.scalars(select(ChecklistTipo).options(selectinload(ChecklistTipo.perguntas))).all()
    return [
        {"codigo": t.codigo, "nome": t.nome,
         "perguntas": [{"numero": p.numero, "texto": p.texto} for p in t.perguntas if p.ativa]}
        for t in tipos
    ]


@router.post("/checklists", status_code=201)
def enviar_checklist(
    payload: str = Form(...),
    arquivos: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    try:
        dados = ChecklistIn.model_validate(json.loads(payload))
    except (json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(422, f"Dados inválidos: {e}")

    # Reenvio vindo da fila offline: devolve o que já foi gravado
    existente = db.scalar(select(Checklist.id).where(Checklist.client_uuid == dados.client_uuid))
    if existente:
        return {"id": existente, "duplicado": True}

    tipo = db.scalar(select(ChecklistTipo).where(ChecklistTipo.codigo == dados.tipo)
                     .options(selectinload(ChecklistTipo.perguntas)))
    if not tipo:
        raise HTTPException(422, "Tipo de checklist inexistente")
    perguntas = {p.numero: p for p in tipo.perguntas if p.ativa}

    respondidas = {r.numero for r in dados.respostas}
    if len(respondidas) != len(dados.respostas) or not respondidas <= perguntas.keys():
        raise HTTPException(422, "Respostas repetidas ou de perguntas que não existem")
    if respondidas != perguntas.keys():
        raise HTTPException(422, "Há perguntas sem resposta")

    por_ref = {a.filename: a for a in arquivos}
    com_foto = set()
    for f in dados.fotos:
        if f.ref not in por_ref:
            raise HTTPException(422, f"Arquivo '{f.ref}' não foi enviado")
        if f.numero is not None:
            if f.numero not in perguntas:
                raise HTTPException(422, f"Foto ligada à pergunta inexistente {f.numero}")
            com_foto.add(f.numero)
    sem_foto = sorted(r.numero for r in dados.respostas
                      if r.resposta == Resposta.NC and r.numero not in com_foto)
    if sem_foto:
        raise HTTPException(422, f"Item não conforme exige foto: {', '.join(sem_foto)}")

    checklist = Checklist(
        client_uuid=dados.client_uuid, tipo_id=tipo.id, operador_id=usuario.id,
        criado_no_celular_em=dados.criado_em, latitude=dados.latitude,
        longitude=dados.longitude, precisao_m=dados.precisao_m,
        observacoes=(dados.observacoes or "").strip() or None)
    itens = {}
    for r in dados.respostas:
        item = RespostaItem(pergunta_id=perguntas[r.numero].id, resposta=r.resposta,
                            comentario=(r.comentario or "").strip() or None)
        itens[r.numero] = item
        checklist.respostas.append(item)

    salvos = []
    try:
        for f in dados.fotos:
            nome = salvar_foto(por_ref[f.ref])
            salvos.append(nome)
            checklist.fotos.append(Foto(
                caminho=nome, resposta=itens.get(f.numero) if f.numero else None,
                latitude=f.latitude, longitude=f.longitude,
                precisao_m=f.precisao_m, tirada_em=f.tirada_em))
        db.add(checklist)
        db.commit()
    except Exception:
        db.rollback()
        for nome in salvos:
            (settings.upload_path / nome).unlink(missing_ok=True)
        raise
    return {"id": checklist.id, "duplicado": False}


@router.get("/checklists/meus")
def meus_checklists(
    limite: int = Query(30, le=100),
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    q = (select(Checklist).where(Checklist.operador_id == usuario.id)
         .order_by(Checklist.criado_no_celular_em.desc()).limit(limite).options(*CARREGAR))
    return [serializar_checklist(c) for c in db.scalars(q)]


@router.get("/checklists/{checklist_id}")
def detalhe_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    usuario: Usuario = Depends(usuario_atual),
):
    c = db.scalar(select(Checklist).where(Checklist.id == checklist_id).options(*CARREGAR))
    if not c or (usuario.papel != Papel.admin and c.operador_id != usuario.id):
        raise HTTPException(404, "Checklist não encontrado")
    return serializar_checklist(c)


@router.get("/fotos/{foto_id}")
def baixar_foto(
    foto_id: int,
    token: str = Query(...),   # <img src> não consegue enviar cabeçalho Authorization
    db: Session = Depends(get_db),
):
    usuario = db.get(Usuario, ler_token(token) or 0)
    foto = db.get(Foto, foto_id)
    if not usuario or not usuario.ativo or not foto:
        raise HTTPException(404, "Foto não encontrada")
    if usuario.papel != Papel.admin and foto.checklist.operador_id != usuario.id:
        raise HTTPException(404, "Foto não encontrada")
    caminho = settings.upload_path / foto.caminho
    if not caminho.is_file():
        raise HTTPException(404, "Arquivo da foto não encontrado")
    return FileResponse(caminho, headers={"Cache-Control": "private, max-age=86400"})
