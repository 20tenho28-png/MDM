"""Convert raw RFC822 bytes into a normalized dataclass."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email import message_from_bytes
from email.message import Message as PyEmailMessage
from email.utils import getaddresses, parsedate_to_datetime


_SUBJECT_PREFIX = re.compile(r"^\s*(re|fwd|fw)\s*:\s*", re.IGNORECASE)


def normalize_subject(subject: str) -> str:
    s = subject or ""
    while True:
        new = _SUBJECT_PREFIX.sub("", s, count=1)
        if new == s:
            break
        s = new
    return s.strip()


@dataclass
class ParsedMessage:
    message_id: str
    in_reply_to: str | None
    references: list[str] = field(default_factory=list)
    from_addr: str = ""
    from_name: str | None = None
    to_addrs: list[str] = field(default_factory=list)
    subject: str = ""
    body_text: str = ""
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def _split_refs(raw: str | None) -> list[str]:
    if not raw:
        return []
    return re.findall(r"<[^>]+>", raw)


def _strip_brackets(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if v.startswith("<") and v.endswith(">"):
        return v[1:-1]
    return v


def _decode_body(msg: PyEmailMessage) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain" and not part.get_filename():
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                try:
                    return payload.decode(charset, errors="replace")
                except LookupError:
                    return payload.decode("utf-8", errors="replace")
        return ""
    payload = msg.get_payload(decode=True) or b""
    charset = msg.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except LookupError:
        return payload.decode("utf-8", errors="replace")


def parse_rfc822(raw: bytes) -> ParsedMessage:
    msg = message_from_bytes(raw)

    message_id = _strip_brackets(msg.get("Message-ID")) or ""
    in_reply_to = _strip_brackets(msg.get("In-Reply-To"))

    refs = [_strip_brackets(r) or "" for r in _split_refs(msg.get("References"))]
    refs = [r for r in refs if r]

    from_pairs = getaddresses([msg.get("From", "")])
    from_name = from_pairs[0][0] if from_pairs and from_pairs[0][0] else None
    from_addr = from_pairs[0][1].lower() if from_pairs else ""

    to_pairs = getaddresses(msg.get_all("To", []) + msg.get_all("Cc", []))
    to_addrs = [addr.lower() for _, addr in to_pairs if addr]

    date_hdr = msg.get("Date")
    received: datetime
    if date_hdr:
        try:
            parsed = parsedate_to_datetime(date_hdr)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            received = parsed
        except (TypeError, ValueError):
            received = datetime.now(timezone.utc)
    else:
        received = datetime.now(timezone.utc)

    return ParsedMessage(
        message_id=message_id,
        in_reply_to=in_reply_to,
        references=refs,
        from_addr=from_addr,
        from_name=from_name,
        to_addrs=to_addrs,
        subject=msg.get("Subject", "") or "",
        body_text=_decode_body(msg),
        received_at=received,
    )
