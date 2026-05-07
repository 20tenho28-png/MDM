"""Ingest pipeline: turn a fetched IMAP message into ticket+message rows.

Idempotent on `(folder, uid)` and on `message_id` — replaying the same
mailbox over a clean DB always produces the same state.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Sequence

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from mdm.config import get_settings
from mdm.imap.client import FetchedMessage
from mdm.imap.parser import ParsedMessage, normalize_subject, parse_rfc822
from mdm.models import Direction, Message, SyncState, Ticket, TicketStatus
from mdm.tickets.threading import find_ticket_id


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite strips tzinfo; coerce naive datetimes back to UTC for comparisons."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def get_or_init_sync_state(session: AsyncSession) -> SyncState:
    state = await session.get(SyncState, 1)
    if state is None:
        state = SyncState(id=1, last_uid_inbox=0, last_uid_sent=0)
        session.add(state)
        await session.flush()
    return state


def _direction_for_folder(folder: str) -> Direction:
    settings = get_settings()
    if folder.lower() == settings.imap_sent_folder.lower():
        return Direction.outbound
    return Direction.inbound


def _customer_for(direction: Direction, parsed: ParsedMessage) -> tuple[str, str | None]:
    if direction is Direction.inbound:
        return parsed.from_addr, parsed.from_name
    if parsed.to_addrs:
        return parsed.to_addrs[0], None
    return parsed.from_addr, parsed.from_name


async def ingest_message(
    session: AsyncSession, fetched: FetchedMessage
) -> Message | None:
    """Idempotently store a fetched message; create or update its ticket.

    Returns the persisted Message, or None if it was already ingested.
    """
    existing = await session.execute(
        select(Message).where(
            Message.imap_folder == fetched.folder, Message.imap_uid == fetched.uid
        )
    )
    if existing.scalar_one_or_none() is not None:
        return None

    parsed = parse_rfc822(fetched.raw)
    if not parsed.message_id:
        # Synthesize a deterministic id so we can still store + dedupe.
        parsed.message_id = f"synth-{fetched.folder}-{fetched.uid}@mdm.local"

    by_msgid = await session.execute(
        select(Message).where(Message.message_id == parsed.message_id)
    )
    if by_msgid.scalar_one_or_none() is not None:
        return None

    direction = _direction_for_folder(fetched.folder)
    ticket_id = await find_ticket_id(session, parsed)

    if ticket_id is None:
        customer_email, customer_name = _customer_for(direction, parsed)
        ticket = Ticket(
            customer_email=customer_email,
            customer_name=customer_name,
            subject_normalized=normalize_subject(parsed.subject),
            status=TicketStatus.open,
        )
        session.add(ticket)
        await session.flush()
        ticket_id = ticket.id
    else:
        ticket = await session.get(Ticket, ticket_id)
        assert ticket is not None

    if direction is Direction.inbound:
        prev = _aware(ticket.last_inbound_at)
        if prev is None or parsed.received_at > prev:
            ticket.last_inbound_at = parsed.received_at
    else:
        prev = _aware(ticket.last_outbound_at)
        if prev is None or parsed.received_at > prev:
            ticket.last_outbound_at = parsed.received_at

    message = Message(
        ticket_id=ticket_id,
        imap_folder=fetched.folder,
        imap_uid=fetched.uid,
        message_id=parsed.message_id,
        in_reply_to=parsed.in_reply_to,
        references=parsed.references or None,
        direction=direction,
        from_addr=parsed.from_addr,
        to_addrs=parsed.to_addrs,
        subject=parsed.subject,
        body_text=parsed.body_text,
        received_at=parsed.received_at,
    )
    session.add(message)
    await session.flush()
    return message


async def close_ticket(
    session: AsyncSession, ticket_id: str, as_status: TicketStatus
) -> Ticket | None:
    if as_status not in (TicketStatus.won, TicketStatus.lost):
        raise ValueError("Tickets can only be closed as won or lost")
    ticket = await session.get(Ticket, ticket_id)
    if ticket is None:
        return None
    ticket.status = as_status
    ticket.closed_at = datetime.now(timezone.utc)
    await session.flush()
    return ticket


def is_awaiting_us(ticket: Ticket) -> bool:
    last_in = _aware(ticket.last_inbound_at)
    last_out = _aware(ticket.last_outbound_at)
    if last_in is None:
        return False
    if last_out is None:
        return True
    return last_in > last_out


def hours_awaiting(ticket: Ticket, *, now: datetime | None = None) -> float | None:
    last_in = _aware(ticket.last_inbound_at)
    if not is_awaiting_us(ticket) or last_in is None:
        return None
    now = now or datetime.now(timezone.utc)
    delta = now - last_in
    return delta.total_seconds() / 3600.0


def age_color(hours: float | None) -> str:
    """Map elapsed hours to a color band.

    Thresholds come from settings so they can be tuned via .env without code
    changes. Returns 'green' / 'yellow' / 'orange' / 'red' / 'none'.
    """
    if hours is None:
        return "none"
    settings = get_settings()
    if hours >= settings.age_red_hours:
        return "red"
    if hours >= settings.age_orange_hours:
        return "orange"
    if hours >= settings.age_yellow_hours:
        return "yellow"
    return "green"


async def list_awaiting_us(session: AsyncSession) -> Sequence[Ticket]:
    stmt = (
        select(Ticket)
        .where(Ticket.status == TicketStatus.open)
        .where(Ticket.last_inbound_at.is_not(None))
        .order_by(Ticket.last_inbound_at.asc())
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [t for t in rows if is_awaiting_us(t)]


async def list_awaiting_customer(session: AsyncSession) -> Sequence[Ticket]:
    stmt = (
        select(Ticket)
        .where(Ticket.status == TicketStatus.open)
        .order_by(desc(Ticket.last_outbound_at))
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()
    return [t for t in rows if not is_awaiting_us(t)]


async def list_recently_closed(
    session: AsyncSession, *, days: int | None = None
) -> Sequence[Ticket]:
    settings = get_settings()
    window = timedelta(days=days if days is not None else settings.closed_strip_days)
    cutoff = datetime.now(timezone.utc) - window
    stmt = (
        select(Ticket)
        .where(Ticket.status.in_([TicketStatus.won, TicketStatus.lost]))
        .where(Ticket.closed_at.is_not(None))
        .where(Ticket.closed_at >= cutoff)
        .order_by(desc(Ticket.closed_at))
    )
    result = await session.execute(stmt)
    return list(result.scalars().all())
