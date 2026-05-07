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
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from mdm.db import Base


class TicketStatus(str, enum.Enum):
    open = "open"
    won = "won"
    lost = "lost"


class Direction(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


def _uuid() -> str:
    return str(uuid.uuid4())


class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    customer_email: Mapped[str] = mapped_column(String(320), index=True)
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subject_normalized: Mapped[str] = mapped_column(String(998), default="")

    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status"),
        default=TicketStatus.open,
        nullable=False,
    )

    last_inbound_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_outbound_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    messages: Mapped[list[Message]] = relationship(
        back_populates="ticket",
        order_by="Message.received_at",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_tickets_status_last_inbound", "status", "last_inbound_at"),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    ticket_id: Mapped[str] = mapped_column(
        ForeignKey("tickets.id", ondelete="CASCADE"), index=True
    )

    imap_folder: Mapped[str] = mapped_column(String(255))
    imap_uid: Mapped[int] = mapped_column(Integer)

    message_id: Mapped[str] = mapped_column(String(998), unique=True, index=True)
    in_reply_to: Mapped[str | None] = mapped_column(String(998), nullable=True, index=True)
    references: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    direction: Mapped[Direction] = mapped_column(
        Enum(Direction, name="direction"), nullable=False
    )

    from_addr: Mapped[str] = mapped_column(String(320))
    to_addrs: Mapped[list[str]] = mapped_column(JSON, default=list)
    subject: Mapped[str] = mapped_column(String(998), default="")
    body_text: Mapped[str] = mapped_column(String, default="")

    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    ticket: Mapped[Ticket] = relationship(back_populates="messages")

    __table_args__ = (
        UniqueConstraint("imap_folder", "imap_uid", name="uq_messages_folder_uid"),
    )


class SyncState(Base):
    __tablename__ = "sync_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    last_uid_inbox: Mapped[int] = mapped_column(Integer, default=0)
    last_uid_sent: Mapped[int] = mapped_column(Integer, default=0)
    last_polled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
