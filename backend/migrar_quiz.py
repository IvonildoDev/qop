"""Carrega as perguntas e migra usuários e histórico do quiz.db antigo.

Idempotente: pode ser executado várias vezes sem duplicar registros.
Uso (dentro de backend/):  .venv\\Scripts\\python migrar_quiz.py
"""
import re
import shutil
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal
from app.models import (Checklist, ChecklistTipo, Foto, Papel, Pergunta,
                        Resposta, RespostaItem, Usuario)

RAIZ = Path(__file__).resolve().parent.parent
QUIZ_DB = RAIZ / "quiz.db"
SCRIPT_JS = RAIZ / "static" / "js" / "script.js"
TZ = timezone(timedelta(hours=-3))  # horários antigos eram gravados em hora local
NAMESPACE = uuid.UUID("6f1c2d3e-0000-4000-8000-00000000a0a0")

TIPOS = {
    "pre_operacional": "Checklist Pré-Operacional",
    "caminhao": "Checklist Caminhão",
    "carga": "Checklist Carga",
}
RESPOSTAS = {"C": Resposta.C, "N/C": Resposta.NC, "N/A": Resposta.NA}


def numero(valor) -> str:
    return f"{float(valor):g}"


def perguntas_do_js() -> dict[str, list[tuple[str, str]]]:
    js = SCRIPT_JS.read_text(encoding="utf-8")
    bloco = re.search(r"const questions = \{(.*?)\n    \};", js, re.S).group(1)
    resultado = {}
    for tipo in TIPOS:
        secao = re.search(rf"{tipo}:\s*\[(.*?)\n        \]", bloco, re.S).group(1)
        resultado[tipo] = [
            (numero(n), t.replace('\\"', '"'))
            for n, t in re.findall(r'number:\s*([\d.]+),\s*text:\s*"((?:[^"\\]|\\.)*)"', secao)
        ]
    return resultado


def carregar_perguntas(db) -> dict[tuple[str, str], Pergunta]:
    mapa = {}
    for codigo, itens in perguntas_do_js().items():
        tipo = db.scalar(select(ChecklistTipo).where(ChecklistTipo.codigo == codigo))
        if not tipo:
            tipo = ChecklistTipo(codigo=codigo, nome=TIPOS[codigo])
            db.add(tipo)
            db.flush()
        existentes = {p.numero: p for p in tipo.perguntas}
        for ordem, (num, texto) in enumerate(itens, start=1):
            p = existentes.get(num)
            if not p:
                p = Pergunta(tipo_id=tipo.id, numero=num, texto=texto, ordem=ordem)
                db.add(p)
                db.flush()
            mapa[(codigo, num)] = p
        print(f"{codigo}: {len(itens)} perguntas")
    return mapa


def migrar_usuarios(db, velho) -> dict[str, Usuario]:
    mapa = {}
    for username, senha, is_admin in velho.execute("SELECT username, password, is_admin FROM users"):
        u = db.scalar(select(Usuario).where(Usuario.login == username))
        if not u:
            hash_ = senha.decode() if isinstance(senha, bytes) else senha
            u = Usuario(login=username, nome=username.title(), senha_hash=hash_,
                        papel=Papel.admin if is_admin else Papel.operador)
            db.add(u)
            db.flush()
            print(f"usuário migrado: {username}")
        mapa[username] = u
    return mapa


def migrar_historico(db, velho, usuarios, perguntas):
    grupos = velho.execute(
        "SELECT username, quiz_type, timestamp, MIN(id) FROM responses "
        "GROUP BY username, quiz_type, timestamp").fetchall()
    novos = 0
    for username, tipo_codigo, ts, primeiro_id in grupos:
        client_uuid = uuid.uuid5(NAMESPACE, f"{username}|{tipo_codigo}|{ts}")
        if db.scalar(select(Checklist.id).where(Checklist.client_uuid == client_uuid)):
            continue
        tipo = db.scalar(select(ChecklistTipo).where(ChecklistTipo.codigo == tipo_codigo))
        quando = datetime.fromisoformat(ts).replace(tzinfo=TZ)

        loc = velho.execute(
            "SELECT latitude, longitude, accuracy FROM locations WHERE response_id = ?",
            (primeiro_id,)).fetchone()
        obs = velho.execute(
            "SELECT text FROM observations WHERE username=? AND quiz_type=? AND timestamp=?",
            (username, tipo_codigo, ts)).fetchone()

        cl = Checklist(client_uuid=client_uuid, tipo_id=tipo.id, operador_id=usuarios[username].id,
                       criado_no_celular_em=quando, observacoes=obs[0] if obs else None,
                       latitude=loc[0] if loc else None, longitude=loc[1] if loc else None,
                       precisao_m=loc[2] if loc else None)
        for num, resp in velho.execute(
                "SELECT question_number, answer FROM responses "
                "WHERE username=? AND quiz_type=? AND timestamp=?", (username, tipo_codigo, ts)):
            p = perguntas.get((tipo_codigo, numero(num)))
            if p and resp in RESPOSTAS:
                cl.respostas.append(RespostaItem(pergunta_id=p.id, resposta=RESPOSTAS[resp]))

        destino = settings.upload_path
        destino.mkdir(parents=True, exist_ok=True)
        for (caminho,) in velho.execute(
                "SELECT photo_path FROM response_photos WHERE response_id = ?", (primeiro_id,)):
            origem = RAIZ / caminho.replace("\\", "/")
            if origem.exists():
                shutil.copy2(origem, destino / origem.name)
                cl.fotos.append(Foto(caminho=origem.name))
        db.add(cl)
        novos += 1
    print(f"checklists migrados: {novos} (de {len(grupos)})")


def main():
    velho = sqlite3.connect(QUIZ_DB)
    with SessionLocal() as db:
        perguntas = carregar_perguntas(db)
        usuarios = migrar_usuarios(db, velho)
        migrar_historico(db, velho, usuarios, perguntas)
        db.commit()
    print("ok")


if __name__ == "__main__":
    main()
