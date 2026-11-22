"""ERP: clientes, técnicos, equipamentos, visitas (agenda) e relatórios de intervenção

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-18
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
    op.create_table(
        "erp_clientes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("telefone", sa.String(40), nullable=False, server_default=""),
        sa.Column("email", sa.String(320), nullable=False, server_default=""),
        sa.Column("nif", sa.String(20), nullable=False, server_default=""),
        sa.Column("morada", sa.String(500), nullable=False, server_default=""),
        sa.Column("codigo_postal", sa.String(20), nullable=False, server_default=""),
        sa.Column("localidade", sa.String(120), nullable=False, server_default=""),
        sa.Column("notas", sa.Text, nullable=False, server_default=""),
        sa.Column("criado_em", sa.DateTime, nullable=False),
    )
    op.create_table(
        "erp_tecnicos",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("nome", sa.String(120), nullable=False),
        sa.Column("telefone", sa.String(40), nullable=False, server_default=""),
        sa.Column("ativo", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "erp_equipamentos",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("cliente_id", sa.Integer, sa.ForeignKey("erp_clientes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(80), nullable=False, server_default=""),
        sa.Column("marca", sa.String(80), nullable=False, server_default=""),
        sa.Column("modelo", sa.String(120), nullable=False, server_default=""),
        sa.Column("numero_serie", sa.String(120), nullable=False, server_default=""),
        sa.Column("localizacao", sa.String(120), nullable=False, server_default=""),
        sa.Column("gas", sa.String(20), nullable=False, server_default=""),
        sa.Column("carga_kg", sa.Float, nullable=True),
        sa.Column("instalado_em", sa.Date, nullable=True),
        sa.Column("notas", sa.Text, nullable=False, server_default=""),
    )
    op.create_index("ix_erp_equipamentos_cliente_id", "erp_equipamentos", ["cliente_id"])
    op.create_table(
        "erp_visitas",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("cliente_id", sa.Integer, sa.ForeignKey("erp_clientes.id"), nullable=False),
        sa.Column("tecnico_id", sa.Integer, sa.ForeignKey("erp_tecnicos.id"), nullable=True),
        sa.Column("referencia", sa.String(80), nullable=False, server_default=""),
        sa.Column("tipo_trabalho", sa.String(20), nullable=False, server_default="avaria"),
        sa.Column("prioridade", sa.String(2), nullable=False, server_default=""),
        sa.Column("descricao", sa.Text, nullable=False, server_default=""),
        sa.Column("morada", sa.String(500), nullable=False, server_default=""),
        sa.Column("estado", sa.String(20), nullable=False, server_default="por_marcar"),
        sa.Column("inicio", sa.DateTime, nullable=True),
        sa.Column("fim", sa.DateTime, nullable=True),
        sa.Column("criada_em", sa.DateTime, nullable=False),
        sa.Column("marcada_em", sa.DateTime, nullable=True),
        sa.Column("feita_em", sa.DateTime, nullable=True),
        sa.Column("cancelada_em", sa.DateTime, nullable=True),
        sa.Column("motivo_cancelamento", sa.String(500), nullable=False, server_default=""),
        sa.Column("anterior_id", sa.Integer, sa.ForeignKey("erp_visitas.id"), nullable=True),
    )
    op.create_index("ix_erp_visitas_cliente_id", "erp_visitas", ["cliente_id"])
    op.create_index("ix_erp_visitas_tecnico_id", "erp_visitas", ["tecnico_id"])
    op.create_index("ix_erp_visitas_estado_inicio", "erp_visitas", ["estado", "inicio"])
    op.create_table(
        "erp_intervencoes",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("numero", sa.String(30), nullable=False),
        sa.Column("visita_id", sa.Integer, sa.ForeignKey("erp_visitas.id"), nullable=True),
        sa.Column("cliente_id", sa.Integer, sa.ForeignKey("erp_clientes.id"), nullable=True),
        sa.Column("estado", sa.String(20), nullable=False),
        sa.Column("retifica", sa.String(30), nullable=False, server_default=""),
        sa.Column("retificado_por", sa.String(30), nullable=False, server_default=""),
        sa.Column("data", sa.Date, nullable=False),
        sa.Column("hora_inicio", sa.String(5), nullable=False, server_default=""),
        sa.Column("hora_fim", sa.String(5), nullable=False, server_default=""),
        sa.Column("tecnico", sa.String(255), nullable=False, server_default=""),
        sa.Column("cliente_nome", sa.String(255), nullable=False, server_default=""),
        sa.Column("morada", sa.String(500), nullable=False, server_default=""),
        sa.Column("tipo_intervencao", sa.String(80), nullable=False, server_default=""),
        sa.Column("orcamento_numero", sa.String(80), nullable=False, server_default=""),
        sa.Column("ref_interna", sa.String(80), nullable=False, server_default=""),
        sa.Column("descricao", sa.Text, nullable=False, server_default=""),
        sa.Column("obra_concluida", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("pendentes", sa.Text, nullable=False, server_default=""),
        sa.Column("proxima_visita", sa.Date, nullable=True),
        sa.Column("houve_gas", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("refrigerante", sa.String(40), nullable=False, server_default=""),
        sa.Column("gas_adicionado_kg", sa.Float, nullable=True),
        sa.Column("gas_recuperado_kg", sa.Float, nullable=True),
        sa.Column("aguarda_peca", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("peca_recebida_em", sa.Date, nullable=True),
        sa.Column("hash", sa.String(64), nullable=False, server_default=""),
        sa.Column("criado_na_app", sa.String(25), nullable=False, server_default=""),
        sa.Column("dados", sa.JSON, nullable=False),
        sa.Column("importado_em", sa.DateTime, nullable=False),
        sa.Column("atualizado_em", sa.DateTime, nullable=False),
    )
    op.create_index("ix_erp_intervencoes_numero", "erp_intervencoes", ["numero"], unique=True)
    op.create_index("ix_erp_intervencoes_visita_id", "erp_intervencoes", ["visita_id"])
    op.create_index("ix_erp_intervencoes_cliente_id", "erp_intervencoes", ["cliente_id"])
    op.create_index("ix_erp_intervencoes_data", "erp_intervencoes", ["data"])


def downgrade() -> None:
    op.drop_table("erp_intervencoes")
    op.drop_table("erp_visitas")
    op.drop_table("erp_equipamentos")
    op.drop_table("erp_tecnicos")
    op.drop_table("erp_clientes")
