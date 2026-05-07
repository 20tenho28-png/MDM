"""IMAP poller wired to APScheduler.

The fetch loop is decoupled from `imap_tools` via the `IMAPClient` Protocol —
tests inject a fake client that yields recorded `FetchedMessage` objects, and
production wires in `ImapToolsClient`. Per-message exceptions are logged and
do NOT advance `last_uid` past the failure, so a transient parse error does
not silently drop mail.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from mdm.config import Settings, get_settings
from mdm.imap.client import IMAPClient, ImapToolsClient
from mdm.tickets.service import get_or_init_sync_state, ingest_message

log = logging.getLogger(__name__)


async def _poll_folder(
    session: AsyncSession,
    client: IMAPClient,
    folder: str,
    since_uid: int,
) -> int:
    """Run one poll pass over a folder; return the new highest UID seen."""
    highest = since_uid
    # imap_tools uses sync IO — run the iterator in a thread so we don't block.
    fetched_list = await asyncio.to_thread(
        lambda: list(client.poll(folder, since_uid))
    )
    for fetched in fetched_list:
        try:
            await ingest_message(session, fetched)
        except Exception:  # noqa: BLE001
            log.exception("Failed to ingest %s/%s", fetched.folder, fetched.uid)
            # Stop advancing UID at the first failure so we retry next pass.
            break
        if fetched.uid > highest:
            highest = fetched.uid
    return highest


async def run_one_pass(
    sessionmaker: async_sessionmaker[AsyncSession],
    client: IMAPClient,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    async with sessionmaker() as session:
        async with session.begin():
            state = await get_or_init_sync_state(session)
            new_inbox = await _poll_folder(
                session, client, settings.imap_inbox_folder, state.last_uid_inbox
            )
            new_sent = await _poll_folder(
                session, client, settings.imap_sent_folder, state.last_uid_sent
            )
            state.last_uid_inbox = new_inbox
            state.last_uid_sent = new_sent
            state.last_polled_at = datetime.now(timezone.utc)


def start_scheduler(
    sessionmaker: async_sessionmaker[AsyncSession],
    client: IMAPClient | None = None,
    settings: Settings | None = None,
) -> AsyncIOScheduler:
    settings = settings or get_settings()
    client = client or ImapToolsClient(settings)
    scheduler = AsyncIOScheduler()

    async def _job() -> None:
        try:
            await run_one_pass(sessionmaker, client, settings)
        except Exception:  # noqa: BLE001
            log.exception("Poll pass failed")

    scheduler.add_job(
        _job,
        "interval",
        seconds=settings.poll_interval_seconds,
        next_run_time=datetime.now(timezone.utc),
        id="imap_poll",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    return scheduler
