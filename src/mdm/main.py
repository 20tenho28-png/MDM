from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from mdm.config import get_settings
from mdm.db import get_sessionmaker
from mdm.web.routes import router
from mdm.workers.poller import start_scheduler


logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    sm = get_sessionmaker()
    scheduler = None
    if settings.imap_user and settings.imap_password:
        scheduler = start_scheduler(sm, settings=settings)
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    app = FastAPI(title="MDM — Email Tickets", lifespan=lifespan)
    # The electric simulator is a standalone static app at the repo root;
    # serve it under /simulator when running from a source checkout.
    repo_root = Path(__file__).resolve().parents[2]
    simulator_dir = repo_root / "electric-simulator"
    if simulator_dir.is_dir():
        app.mount(
            "/simulator",
            StaticFiles(directory=str(simulator_dir), html=True),
            name="simulator",
        )
    # Client-facing AC sizing calculator (ac-calculator/), same pattern.
    calculator_dir = repo_root / "ac-calculator"
    if calculator_dir.is_dir():
        app.mount(
            "/calculadora",
            StaticFiles(directory=str(calculator_dir), html=True),
            name="calculadora",
        )
    app.include_router(router)
    return app


app = create_app()
