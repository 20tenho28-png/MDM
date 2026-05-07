"""Resolve which ticket a parsed message belongs to.

Strictly RFC: try `In-Reply-To` first, then any `References` entry.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mdm.imap.parser import ParsedMessage
from mdm.models import Message


async def find_ticket_id(session: AsyncSession, parsed: ParsedMessage) -> str | None:
    candidates: list[str] = []
    if parsed.in_reply_to:
        candidates.append(parsed.in_reply_to)
    candidates.extend(parsed.references)

    if not candidates:
        return None

    stmt = select(Message.ticket_id).where(Message.message_id.in_(candidates)).limit(1)
    result = await session.execute(stmt)
    row = result.first()
    return row[0] if row else None
