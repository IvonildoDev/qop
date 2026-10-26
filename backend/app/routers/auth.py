from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import usuario_atual
from ..models import Usuario
from ..security import criar_token, verificar_senha

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    login: str
    senha: str


@router.post("/login")
def login(dados: LoginIn, db: Session = Depends(get_db)):
    usuario = db.scalar(select(Usuario).where(Usuario.login == dados.login))
    if not usuario or not usuario.ativo or not verificar_senha(dados.senha, usuario.senha_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login ou senha inválidos")
    return {
        "token": criar_token(usuario.id),
        "usuario": {"id": usuario.id, "nome": usuario.nome, "papel": usuario.papel},
    }


@router.get("/eu")
def eu(usuario: Usuario = Depends(usuario_atual)):
    return {"id": usuario.id, "nome": usuario.nome, "papel": usuario.papel}
