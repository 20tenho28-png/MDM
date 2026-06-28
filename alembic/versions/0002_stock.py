"""stock management schema

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-16
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # The categoria enum is shared by two tables, so create the PG types once
    # up front and disable per-column auto-creation to avoid "type exists".
    categoria_enum = sa.Enum(
        "material_eletrico", "tubo_cobre", name="stock_categoria", create_type=False
    )
    tipo_mov_enum = sa.Enum(
        "entrada", "saida", name="stock_tipo_movimento", create_type=False
    )
    estado_enum = sa.Enum(
        "pendente", "confirmada", "erro", name="stock_estado_guia", create_type=False
    )
    categoria_enum.create(bind, checkfirst=True)
    tipo_mov_enum.create(bind, checkfirst=True)
    estado_enum.create(bind, checkfirst=True)

    op.create_table(
        "artigos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("referencia", sa.String(64), nullable=False),
        sa.Column("descricao", sa.String(512), nullable=False, server_default=""),
        sa.Column("categoria", categoria_enum, nullable=False),
        sa.Column("unidade", sa.String(16), nullable=False, server_default="un"),
        sa.Column("stock_atual", sa.Integer, nullable=False, server_default="0"),
        sa.Column("stock_minimo", sa.Integer, nullable=False, server_default="0"),
        sa.Column("localizacao", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("referencia", name="uq_artigos_referencia"),
    )
    op.create_index("ix_artigos_referencia", "artigos", ["referencia"])
    op.create_index(
        "ix_artigos_categoria_stock", "artigos", ["categoria", "stock_atual"]
    )

    op.create_table(
        "guias_compra",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("ficheiro_nome", sa.String(255), nullable=False),
        sa.Column("ficheiro_path", sa.String(512), nullable=True),
        sa.Column("fornecedor", sa.String(255), nullable=True),
        sa.Column("categoria", categoria_enum, nullable=False),
        sa.Column("data_guia", sa.DateTime(timezone=True), nullable=True),
        sa.Column("num_itens", sa.Integer, nullable=False, server_default="0"),
        sa.Column("estado", estado_enum, nullable=False, server_default="pendente"),
        sa.Column("linhas_raw", sa.JSON, nullable=True),
        sa.Column("erro_msg", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "movimentos_stock",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "artigo_id",
            sa.String(36),
            sa.ForeignKey("artigos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tipo", tipo_mov_enum, nullable=False),
        sa.Column("quantidade", sa.Integer, nullable=False),
        sa.Column("origem", sa.String(128), nullable=False, server_default="ajuste"),
        sa.Column(
            "guia_id",
            sa.String(36),
            sa.ForeignKey("guias_compra.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("nota", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_movimentos_stock_artigo_id", "movimentos_stock", ["artigo_id"])
    op.create_index("ix_movimentos_stock_guia_id", "movimentos_stock", ["guia_id"])


def downgrade() -> None:
    op.drop_index("ix_movimentos_stock_guia_id", table_name="movimentos_stock")
    op.drop_index("ix_movimentos_stock_artigo_id", table_name="movimentos_stock")
    op.drop_table("movimentos_stock")
    op.drop_table("guias_compra")
    op.drop_index("ix_artigos_categoria_stock", table_name="artigos")
    op.drop_index("ix_artigos_referencia", table_name="artigos")
    op.drop_table("artigos")
    sa.Enum(name="stock_tipo_movimento").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="stock_estado_guia").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="stock_categoria").drop(op.get_bind(), checkfirst=True)
