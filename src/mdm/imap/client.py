"""IMAP client wrapper.

Exposes a small `poll()` interface returning raw RFC822 bytes plus the UID
they were fetched with. Production uses `imap-tools`; tests inject a fake
client that yields the same shape so the rest of the system never depends on
imap-tools directly.

A `subscribe()` stub is reserved for a future IMAP IDLE implementation.
"""
from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol

from mdm.config import Settings


@dataclass
class FetchedMessage:
    folder: str
    uid: int
    raw: bytes


class IMAPClient(Protocol):
    def poll(self, folder: str, since_uid: int) -> Iterator[FetchedMessage]: ...


class ImapToolsClient:
    """Thin wrapper around `imap_tools.MailBox` that yields `FetchedMessage`."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def poll(self, folder: str, since_uid: int) -> Iterator[FetchedMessage]:
        from imap_tools import AND, MailBox

        host = self.settings.imap_host
        port = self.settings.imap_port
        user = self.settings.imap_user
        password = self.settings.imap_password

        with MailBox(host, port=port).login(user, password, initial_folder=folder) as mb:
            criteria = AND(uid=f"{since_uid + 1}:*") if since_uid > 0 else "ALL"
            for mail in mb.fetch(criteria, mark_seen=False, bulk=True):
                try:
                    uid = int(mail.uid) if mail.uid else 0
                except (TypeError, ValueError):
                    continue
                if uid <= since_uid:
                    continue
                raw = mail.obj.as_bytes()
                yield FetchedMessage(folder=folder, uid=uid, raw=raw)

    def subscribe(self, folder: str) -> Iterator[FetchedMessage]:  # pragma: no cover
        """Reserved for a future IDLE implementation."""
        raise NotImplementedError("IDLE support not yet implemented")
