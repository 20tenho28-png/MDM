"""End-to-end tests for the TV wall HTTP routes.

We seed the DB with three tickets at known ages and assert the rendered
HTML contains the right color classes and the closed-strip entry.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from mdm.main import create_app
from mdm.models import Direction, Message, Ticket, TicketStatus


def _ticket(*, email: str, hours_old_inbound: float | None, status=TicketStatus.open) -> Ticket:
    now = datetime.now(timezone.utc)
    last_in = (
        now - timedelta(hours=hours_old_inbound) if hours_old_inbound is not None else None
    )
    return Ticket(
        customer_email=email,
        customer_name=None,
        subject_normalized="Pricing question",
        status=status,
        last_inbound_at=last_in,
        last_outbound_at=None,
        closed_at=now if status != TicketStatus.open else None,
    )


@pytest.mark.asyncio
async def test_wall_renders_color_classes(sessionmaker):
    async with sessionmaker() as s:
        async with s.begin():
            s.add_all([
                _ticket(email="green@x.example", hours_old_inbound=1),
                _ticket(email="yellow@x.example", hours_old_inbound=30),
                _ticket(email="orange@x.example", hours_old_inbound=60),
                _ticket(email="red@x.example", hours_old_inbound=80),
            ])

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/")
    assert resp.status_code == 200
    body = resp.text
    assert "card-green" in body
    assert "card-yellow" in body
    assert "card-orange" in body
    assert "card-red" in body
    assert "green@x.example" in body
    assert "red@x.example" in body


@pytest.mark.asyncio
async def test_board_partial_returns_just_the_board(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/board")
    assert resp.status_code == 200
    body = resp.text
    # Partial does not include <html>/<body> chrome.
    assert "<html" not in body.lower()
    assert 'id="board"' in body


@pytest.mark.asyncio
async def test_close_route_marks_won_and_appears_in_strip(sessionmaker):
    async with sessionmaker() as s:
        async with s.begin():
            t = _ticket(email="winning@x.example", hours_old_inbound=2)
            s.add(t)
        ticket_id = t.id

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(f"/tickets/{ticket_id}/close?as=won", follow_redirects=False)
        assert resp.status_code == 303
        wall = await ac.get("/")

    async with sessionmaker() as s:
        ticket = (await s.execute(select(Ticket))).scalar_one()
    assert ticket.status == TicketStatus.won
    assert ticket.closed_at is not None
    assert "winning@x.example" in wall.text
    # Should not be color-coded any more (closed -> goes to footer strip)
    assert "winning@x.example · won" in wall.text


@pytest.mark.asyncio
async def test_close_with_invalid_status_400(sessionmaker):
    async with sessionmaker() as s:
        async with s.begin():
            t = _ticket(email="x@x.example", hours_old_inbound=1)
            s.add(t)
        ticket_id = t.id

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(f"/tickets/{ticket_id}/close?as=open")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_close_unknown_ticket_404(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post("/tickets/does-not-exist/close?as=lost")
    assert resp.status_code == 404
