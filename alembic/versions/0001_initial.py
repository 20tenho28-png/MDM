"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-07
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tickets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("customer_email", sa.String(320), nullable=False),
        sa.Column("customer_name", sa.String(255), nullable=True),
        sa.Column("subject_normalized", sa.String(998), nullable=False, server_default=""),
        sa.Column(
            "status",
            sa.Enum("open", "won", "lost", name="ticket_status"),
            nullable=False,
            server_default="open",
        ),
        sa.Column("last_inbound_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_outbound_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_tickets_customer_email", "tickets", ["customer_email"])
    op.create_index(
        "ix_tickets_status_last_inbound", "tickets", ["status", "last_inbound_at"]
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "ticket_id",
            sa.String(36),
            sa.ForeignKey("tickets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("imap_folder", sa.String(255), nullable=False),
        sa.Column("imap_uid", sa.Integer, nullable=False),
        sa.Column("message_id", sa.String(998), nullable=False),
        sa.Column("in_reply_to", sa.String(998), nullable=True),
        sa.Column("references", sa.JSON, nullable=True),
        sa.Column(
            "direction",
            sa.Enum("inbound", "outbound", name="direction"),
            nullable=False,
        ),
        sa.Column("from_addr", sa.String(320), nullable=False),
        sa.Column("to_addrs", sa.JSON, nullable=False),
        sa.Column("subject", sa.String(998), nullable=False, server_default=""),
        sa.Column("body_text", sa.String, nullable=False, server_default=""),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("imap_folder", "imap_uid", name="uq_messages_folder_uid"),
        sa.UniqueConstraint("message_id", name="uq_messages_message_id"),
    )
    op.create_index("ix_messages_ticket_id", "messages", ["ticket_id"])
    op.create_index("ix_messages_in_reply_to", "messages", ["in_reply_to"])
    op.create_index("ix_messages_message_id", "messages", ["message_id"])

    op.create_table(
        "sync_state",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("last_uid_inbox", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_uid_sent", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("sync_state")
    op.drop_index("ix_messages_message_id", table_name="messages")
    op.drop_index("ix_messages_in_reply_to", table_name="messages")
    op.drop_index("ix_messages_ticket_id", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_tickets_status_last_inbound", table_name="tickets")
    op.drop_index("ix_tickets_customer_email", table_name="tickets")
    op.drop_table("tickets")
    sa.Enum(name="direction").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="ticket_status").drop(op.get_bind(), checkfirst=True)
