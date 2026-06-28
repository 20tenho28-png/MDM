from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from stock.db import Base


class Categoria(str, enum.Enum):
    material_eletrico = "material_eletrico"
    tubo_cobre = "tubo_cobre"


class TipoMovimento(str, enum.Enum):
    entrada = "entrada"
    saida = "saida"


class EstadoGuia(str, enum.Enum):
    pendente = "pendente"      # uploaded + parsed, awaiting confirmation
    confirmada = "confirmada"  # entries already applied to stock
    erro = "erro"              # parse failed / rejected


def _uuid() -> str:
    return str(uuid.uuid4())


class Artigo(Base):
    __tablename__ = "artigos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    referencia: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    descricao: Mapped[str] = mapped_column(String(512), default="")
    categoria: Mapped[Categoria] = mapped_column(
        Enum(Categoria, name="stock_categoria"), nullable=False
    )
    unidade: Mapped[str] = mapped_column(String(16), default="un")
    stock_atual: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    stock_minimo: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    localizacao: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    movimentos: Mapped[list[MovimentoStock]] = relationship(
        back_populates="artigo",
        order_by="MovimentoStock.created_at",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_artigos_categoria_stock", "categoria", "stock_atual"),
    )


class GuiaCompra(Base):
    __tablename__ = "guias_compra"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    ficheiro_nome: Mapped[str] = mapped_column(String(255))
    ficheiro_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    fornecedor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    categoria: Mapped[Categoria] = mapped_column(
        Enum(Categoria, name="stock_categoria"), nullable=False
    )
    data_guia: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    num_itens: Mapped[int] = mapped_column(Integer, default=0)
    estado: Mapped[EstadoGuia] = mapped_column(
        Enum(EstadoGuia, name="stock_estado_guia"),
        default=EstadoGuia.pendente,
        nullable=False,
    )
    # Parsed lines kept before confirmation, to drive the review screen.
    linhas_raw: Mapped[list | None] = mapped_column(JSON, nullable=True)
    erro_msg: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MovimentoStock(Base):
    __tablename__ = "movimentos_stock"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    artigo_id: Mapped[str] = mapped_column(
        ForeignKey("artigos.id", ondelete="CASCADE"), index=True
    )
    tipo: Mapped[TipoMovimento] = mapped_column(
        Enum(TipoMovimento, name="stock_tipo_movimento"), nullable=False
    )
    # Always positive; the sign is carried by ``tipo``.
    quantidade: Mapped[int] = mapped_column(Integer, nullable=False)
    origem: Mapped[str] = mapped_column(String(128), default="ajuste")
    guia_id: Mapped[str | None] = mapped_column(
        ForeignKey("guias_compra.id", ondelete="SET NULL"), nullable=True, index=True
    )
    nota: Mapped[str | None] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    artigo: Mapped[Artigo] = relationship(back_populates="movimentos")
    guia: Mapped[GuiaCompra | None] = relationship()
