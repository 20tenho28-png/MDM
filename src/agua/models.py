from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    DateTime,
    Enum,
    Float,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from agua.db import Base


class TipoPonto(str, enum.Enum):
    fonte = "fonte"        # amenity=fountain (chafarizes, fontes)
    nascente = "nascente"  # natural=spring


class Potavel(str, enum.Enum):
    sim = "sim"
    nao = "nao"
    desconhecido = "desconhecido"


def _uuid() -> str:
    return str(uuid.uuid4())


class PontoAgua(Base):
    __tablename__ = "pontos_agua"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    # OSM identity (or "seed" for the bundled demo dataset).
    osm_type: Mapped[str] = mapped_column(String(8))
    osm_id: Mapped[int] = mapped_column(BigInteger)

    tipo: Mapped[TipoPonto] = mapped_column(
        Enum(TipoPonto, name="agua_tipo_ponto"), nullable=False
    )
    nome: Mapped[str | None] = mapped_column(String(255), nullable=True)
    potavel: Mapped[Potavel] = mapped_column(
        Enum(Potavel, name="agua_potavel"),
        default=Potavel.desconhecido,
        nullable=False,
    )

    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    concelho: Mapped[str | None] = mapped_column(String(128), nullable=True)

    tags_raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("osm_type", "osm_id", name="uq_pontos_agua_osm"),
        Index("ix_pontos_agua_tipo_potavel", "tipo", "potavel"),
    )
