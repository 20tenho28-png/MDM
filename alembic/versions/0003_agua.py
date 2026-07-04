"""water-map schema

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-16
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    tipo_enum = sa.Enum("fonte", "nascente", name="agua_tipo_ponto", create_type=False)
    potavel_enum = sa.Enum(
        "sim", "nao", "desconhecido", name="agua_potavel", create_type=False
    )
    tipo_enum.create(bind, checkfirst=True)
    potavel_enum.create(bind, checkfirst=True)

    op.create_table(
        "pontos_agua",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("osm_type", sa.String(8), nullable=False),
        sa.Column("osm_id", sa.BigInteger, nullable=False),
        sa.Column("tipo", tipo_enum, nullable=False),
        sa.Column("nome", sa.String(255), nullable=True),
        sa.Column(
            "potavel", potavel_enum, nullable=False, server_default="desconhecido"
        ),
        sa.Column("lat", sa.Float, nullable=False),
        sa.Column("lon", sa.Float, nullable=False),
        sa.Column("concelho", sa.String(128), nullable=True),
        sa.Column("tags_raw", sa.JSON, nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("osm_type", "osm_id", name="uq_pontos_agua_osm"),
    )
    op.create_index(
        "ix_pontos_agua_tipo_potavel", "pontos_agua", ["tipo", "potavel"]
    )


def downgrade() -> None:
    op.drop_index("ix_pontos_agua_tipo_potavel", table_name="pontos_agua")
    op.drop_table("pontos_agua")
    sa.Enum(name="agua_potavel").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="agua_tipo_ponto").drop(op.get_bind(), checkfirst=True)
