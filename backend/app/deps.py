from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Papel, Usuario
from .security import ler_token

bearer = HTTPBearer(auto_error=False)


def usuario_atual(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    usuario_id = ler_token(cred.credentials) if cred else None
    usuario = db.get(Usuario, usuario_id) if usuario_id else None
    if not usuario or not usuario.ativo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado")
    return usuario


def somente_admin(usuario: Usuario = Depends(usuario_atual)) -> Usuario:
    if usuario.papel != Papel.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Acesso restrito ao administrador")
    return usuario
