from datetime import datetime, timedelta, timezone

from mdm.models import Ticket
from mdm.tickets.service import age_color, hours_awaiting, is_awaiting_us


def _ticket(*, last_in: datetime | None, last_out: datetime | None) -> Ticket:
    return Ticket(
        customer_email="x@y.example",
        last_inbound_at=last_in,
        last_outbound_at=last_out,
    )


def test_age_color_thresholds_default():
    # defaults: yellow=24, orange=48, red=72
    assert age_color(0.5) == "green"
    assert age_color(23.99) == "green"
    assert age_color(24) == "yellow"
    assert age_color(47.99) == "yellow"
    assert age_color(48) == "orange"
    assert age_color(71.99) == "orange"
    assert age_color(72) == "red"
    assert age_color(120) == "red"
    assert age_color(None) == "none"


def test_is_awaiting_us_when_last_message_is_inbound():
    now = datetime.now(timezone.utc)
    t = _ticket(last_in=now, last_out=now - timedelta(hours=1))
    assert is_awaiting_us(t)
    t2 = _ticket(last_in=now - timedelta(hours=1), last_out=now)
    assert not is_awaiting_us(t2)
    t3 = _ticket(last_in=None, last_out=now)
    assert not is_awaiting_us(t3)


def test_hours_awaiting_uses_last_inbound():
    now = datetime(2026, 5, 7, 12, 0, tzinfo=timezone.utc)
    t = _ticket(last_in=now - timedelta(hours=30), last_out=now - timedelta(hours=40))
    assert hours_awaiting(t, now=now) == 30.0
    assert age_color(hours_awaiting(t, now=now)) == "yellow"


def test_hours_awaiting_returns_none_when_ball_with_customer():
    now = datetime(2026, 5, 7, 12, 0, tzinfo=timezone.utc)
    t = _ticket(last_in=now - timedelta(hours=10), last_out=now - timedelta(hours=1))
    assert hours_awaiting(t, now=now) is None
