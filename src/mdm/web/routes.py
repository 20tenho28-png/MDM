"""Web routes for the TV wall display.

`GET /`         renders the full kiosk page.
`GET /board`    returns just the auto-refreshable inner partial (HTMX swap).
`POST /tickets/{id}/close?as=won|lost` closes a ticket (admin action).

The electric simulator is mounted separately at `/simulator` (see main.py).
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from mdm.config import Settings, get_settings
from mdm.db import get_sessionmaker
from mdm.models import TicketStatus
from mdm.tickets.service import (
    age_color,
    close_ticket,
    hours_awaiting,
    list_awaiting_customer,
    list_awaiting_us,
    list_recently_closed,
)


TEMPLATE_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.filters["age_color"] = age_color


router = APIRouter()


async def _session() -> AsyncSession:  # pragma: no cover - thin wrapper
    sm = get_sessionmaker()
    async with sm() as session:
        yield session


def _board_context(awaiting_us, awaiting_customer, closed, settings: Settings) -> dict:
    now = datetime.now(timezone.utc)
    awaiting_us_view = [
        {
            "id": t.id,
            "customer_email": t.customer_email,
            "customer_name": t.customer_name,
            "subject": t.subject_normalized or "(no subject)",
            "hours": hours_awaiting(t, now=now) or 0.0,
        }
        for t in awaiting_us
    ]
    awaiting_customer_view = [
        {
            "id": t.id,
            "customer_email": t.customer_email,
            "customer_name": t.customer_name,
            "subject": t.subject_normalized or "(no subject)",
        }
        for t in awaiting_customer
    ]
    closed_view = [
        {
            "id": t.id,
            "customer_email": t.customer_email,
            "subject": t.subject_normalized or "(no subject)",
            "status": t.status.value,
            "closed_at": t.closed_at,
        }
        for t in closed
    ]
    return {
        "awaiting_us": awaiting_us_view,
        "awaiting_customer": awaiting_customer_view,
        "closed": closed_view,
        "wall_refresh_seconds": settings.wall_refresh_seconds,
        "now": now,
    }


@router.get("/", response_class=HTMLResponse)
async def wall(
    request: Request,
    session: AsyncSession = Depends(_session),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    awaiting_us = await list_awaiting_us(session)
    awaiting_customer = await list_awaiting_customer(session)
    closed = await list_recently_closed(session)
    ctx = _board_context(awaiting_us, awaiting_customer, closed, settings)
    return templates.TemplateResponse(request, "wall.html", ctx)


@router.get("/board", response_class=HTMLResponse)
async def board_partial(
    request: Request,
    session: AsyncSession = Depends(_session),
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    awaiting_us = await list_awaiting_us(session)
    awaiting_customer = await list_awaiting_customer(session)
    closed = await list_recently_closed(session)
    ctx = _board_context(awaiting_us, awaiting_customer, closed, settings)
    return templates.TemplateResponse(request, "partials/board.html", ctx)


@router.post("/tickets/{ticket_id}/close")
async def close_route(
    ticket_id: str,
    as_: str = Query("won", alias="as"),
    session: AsyncSession = Depends(_session),
) -> RedirectResponse:
    try:
        target = TicketStatus(as_)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="as must be 'won' or 'lost'") from exc
    if target not in (TicketStatus.won, TicketStatus.lost):
        raise HTTPException(status_code=400, detail="as must be 'won' or 'lost'")

    async with session.begin():
        ticket = await close_ticket(session, ticket_id, target)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return RedirectResponse(url="/", status_code=303)
