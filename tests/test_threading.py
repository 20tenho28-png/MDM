import pytest
from sqlalchemy import func, select

from mdm.imap.client import FetchedMessage
from mdm.models import Direction, Message, Ticket
from mdm.tickets.service import ingest_message
from tests.conftest import load_fixture


async def _msg_count(session, ticket_id: str) -> int:
    return (
        await session.execute(
            select(func.count(Message.id)).where(Message.ticket_id == ticket_id)
        )
    ).scalar_one()


@pytest.mark.asyncio
async def test_followup_attaches_to_existing_ticket(session):
    async with session.begin():
        await ingest_message(
            session, FetchedMessage("INBOX", 1, load_fixture("inbound_initial.eml"))
        )
        await ingest_message(
            session, FetchedMessage("Sent", 1, load_fixture("outbound_reply.eml"))
        )
        await ingest_message(
            session, FetchedMessage("INBOX", 2, load_fixture("inbound_followup.eml"))
        )
        await ingest_message(
            session, FetchedMessage("INBOX", 3, load_fixture("inbound_other.eml"))
        )

        tickets = (await session.execute(select(Ticket))).scalars().all()
        assert len(tickets) == 2

        by_email = {t.customer_email: t for t in tickets}
        assert await _msg_count(session, by_email["alice@customer.example"].id) == 3
        assert await _msg_count(session, by_email["bob@other.example"].id) == 1


@pytest.mark.asyncio
async def test_ingest_is_idempotent_on_folder_uid(session):
    async with session.begin():
        await ingest_message(
            session, FetchedMessage("INBOX", 1, load_fixture("inbound_initial.eml"))
        )
        result = await ingest_message(
            session, FetchedMessage("INBOX", 1, load_fixture("inbound_initial.eml"))
        )
        assert result is None
        tickets = (await session.execute(select(Ticket))).scalars().all()
        assert len(tickets) == 1
        assert await _msg_count(session, tickets[0].id) == 1


@pytest.mark.asyncio
async def test_outbound_then_inbound_sets_direction_and_timestamps(session):
    async with session.begin():
        await ingest_message(
            session, FetchedMessage("INBOX", 1, load_fixture("inbound_initial.eml"))
        )
        await ingest_message(
            session, FetchedMessage("Sent", 1, load_fixture("outbound_reply.eml"))
        )

        ticket = (await session.execute(select(Ticket))).scalar_one()
        directions = sorted(
            (
                await session.execute(
                    select(Message.direction).where(Message.ticket_id == ticket.id)
                )
            )
            .scalars()
            .all()
        )
        assert directions == [Direction.inbound, Direction.outbound]
        assert ticket.last_inbound_at is not None
        assert ticket.last_outbound_at is not None
        assert ticket.last_outbound_at > ticket.last_inbound_at
