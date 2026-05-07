"""Verify the poller is idempotent and advances sync_state correctly.

Uses a fake IMAPClient that yields recorded RFC822 fixtures so we never touch
a real mail server.
"""
from __future__ import annotations

from collections.abc import Iterator

import pytest
from sqlalchemy import select

from mdm.config import Settings
from mdm.imap.client import FetchedMessage, IMAPClient
from mdm.models import Message, SyncState, Ticket
from mdm.workers.poller import run_one_pass
from tests.conftest import load_fixture


class FakeClient(IMAPClient):
    def __init__(self, batches: dict[str, list[FetchedMessage]]):
        self.batches = batches

    def poll(self, folder: str, since_uid: int) -> Iterator[FetchedMessage]:
        for fm in self.batches.get(folder, []):
            if fm.uid > since_uid:
                yield fm


@pytest.mark.asyncio
async def test_two_passes_do_not_duplicate(sessionmaker):
    settings = Settings(
        imap_inbox_folder="INBOX",
        imap_sent_folder="Sent",
        imap_user="x",
        imap_password="x",
        poll_interval_seconds=60,
    )
    client = FakeClient(
        {
            "INBOX": [
                FetchedMessage("INBOX", 1, load_fixture("inbound_initial.eml")),
                FetchedMessage("INBOX", 2, load_fixture("inbound_followup.eml")),
                FetchedMessage("INBOX", 3, load_fixture("inbound_other.eml")),
            ],
            "Sent": [
                FetchedMessage("Sent", 1, load_fixture("outbound_reply.eml")),
            ],
        }
    )

    await run_one_pass(sessionmaker, client, settings)
    await run_one_pass(sessionmaker, client, settings)  # second pass should be a no-op

    async with sessionmaker() as s:
        msgs = (await s.execute(select(Message))).scalars().all()
        tickets = (await s.execute(select(Ticket))).scalars().all()
        state = await s.get(SyncState, 1)

    assert len(msgs) == 4
    assert len(tickets) == 2
    assert state.last_uid_inbox == 3
    assert state.last_uid_sent == 1


@pytest.mark.asyncio
async def test_incremental_pickup_after_initial_pass(sessionmaker):
    settings = Settings(
        imap_inbox_folder="INBOX",
        imap_sent_folder="Sent",
        imap_user="x",
        imap_password="x",
    )
    initial = FakeClient(
        {
            "INBOX": [FetchedMessage("INBOX", 1, load_fixture("inbound_initial.eml"))],
            "Sent": [],
        }
    )
    await run_one_pass(sessionmaker, initial, settings)

    follow_up = FakeClient(
        {
            "INBOX": [
                FetchedMessage("INBOX", 1, load_fixture("inbound_initial.eml")),
                FetchedMessage("INBOX", 2, load_fixture("inbound_followup.eml")),
            ],
            "Sent": [FetchedMessage("Sent", 1, load_fixture("outbound_reply.eml"))],
        }
    )
    await run_one_pass(sessionmaker, follow_up, settings)

    async with sessionmaker() as s:
        tickets = (await s.execute(select(Ticket))).scalars().all()
        msgs = (await s.execute(select(Message))).scalars().all()

    assert len(tickets) == 1
    assert len(msgs) == 3
