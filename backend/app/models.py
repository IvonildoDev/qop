import enum
import uuid
from datetime import datetime

from sqlalchemy import (Boolean, DateTime, Enum, Float, ForeignKey, Index,
                        Integer, String, Text, UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Papel(str, enum.Enum):
    admin = "admin"
    operador = "operador"


class Resposta(str, enum.Enum):
    C = "C"      # Conforme
    NC = "NC"    # Não conforme
    NA = "NA"    # Não se aplica


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(String(60), unique=True)
    nome: Mapped[str] = mapped_column(String(120))
    senha_hash: Mapped[str] = mapped_column(String(100))
    papel: Mapped[Papel] = mapped_column(Enum(Papel, name="papel"), default=Papel.operador)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChecklistTipo(Base):
    __tablename__ = "checklist_tipos"

    id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(String(40), unique=True)
    nome: Mapped[str] = mapped_column(String(120))

    perguntas: Mapped[list["Pergunta"]] = relationship(
        back_populates="tipo", order_by="Pergunta.ordem")


class Pergunta(Base):
    __tablename__ = "perguntas"
    __table_args__ = (UniqueConstraint("tipo_id", "numero"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tipo_id: Mapped[int] = mapped_column(ForeignKey("checklist_tipos.id"))
    numero: Mapped[str] = mapped_column(String(10))   # "1", "2.1"... como no quiz atual
    texto: Mapped[str] = mapped_column(Text)
    ordem: Mapped[int] = mapped_column(Integer)
    ativa: Mapped[bool] = mapped_column(Boolean, default=True)

    tipo: Mapped[ChecklistTipo] = relationship(back_populates="perguntas")


class Checklist(Base):
    __tablename__ = "checklists"
    __table_args__ = (
        Index("ix_checklists_criado_celular", "criado_no_celular_em"),
        Index("ix_checklists_operador", "operador_id", "criado_no_celular_em"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Gerado no celular: permite reenviar sem duplicar (offline)
    client_uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True)
    tipo_id: Mapped[int] = mapped_column(ForeignKey("checklist_tipos.id"))
    operador_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id"))
    criado_no_celular_em: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    recebido_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    precisao_m: Mapped[float | None] = mapped_column(Float)
    observacoes: Mapped[str | None] = mapped_column(Text)

    tipo: Mapped[ChecklistTipo] = relationship()
    operador: Mapped[Usuario] = relationship()
    respostas: Mapped[list["RespostaItem"]] = relationship(
        back_populates="checklist", cascade="all, delete-orphan")
    fotos: Mapped[list["Foto"]] = relationship(
        back_populates="checklist", cascade="all, delete-orphan")


class RespostaItem(Base):
    __tablename__ = "respostas"
    __table_args__ = (
        UniqueConstraint("checklist_id", "pergunta_id"),
        Index("ix_respostas_pergunta_resposta", "pergunta_id", "resposta"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id", ondelete="CASCADE"))
    pergunta_id: Mapped[int] = mapped_column(ForeignKey("perguntas.id"))
    resposta: Mapped[Resposta] = mapped_column(Enum(Resposta, name="resposta"))
    comentario: Mapped[str | None] = mapped_column(Text)

    checklist: Mapped[Checklist] = relationship(back_populates="respostas")
    pergunta: Mapped[Pergunta] = relationship()
    fotos: Mapped[list["Foto"]] = relationship(back_populates="resposta")


class Foto(Base):
    __tablename__ = "fotos"

    id: Mapped[int] = mapped_column(primary_key=True)
    checklist_id: Mapped[int] = mapped_column(ForeignKey("checklists.id", ondelete="CASCADE"))
    # Foto da anomalia: liga à pergunta N/C que a gerou (NULL = foto geral)
    resposta_id: Mapped[int | None] = mapped_column(ForeignKey("respostas.id", ondelete="SET NULL"))
    caminho: Mapped[str] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    precisao_m: Mapped[float | None] = mapped_column(Float)
    tirada_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    checklist: Mapped[Checklist] = relationship(back_populates="fotos")
    resposta: Mapped[RespostaItem | None] = relationship(back_populates="fotos")
