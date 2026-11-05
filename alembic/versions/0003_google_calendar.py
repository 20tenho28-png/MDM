"""ERP: visitas no Google Calendar de cada técnico

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-18
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
    op.add_column("erp_tecnicos", sa.Column("calendario_id", sa.String(255), nullable=False, server_default=""))
    op.add_column("erp_visitas", sa.Column("google_calendario", sa.String(255), nullable=False, server_default=""))
    op.add_column("erp_visitas", sa.Column("google_erro", sa.String(500), nullable=False, server_default=""))
    op.add_column("erp_visitas", sa.Column("google_sincronizada_em", sa.DateTime, nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("erp_visitas") as batch:
        batch.drop_column("google_sincronizada_em")
        batch.drop_column("google_erro")
        batch.drop_column("google_calendario")
    with op.batch_alter_table("erp_tecnicos") as batch:
        batch.drop_column("calendario_id")
