from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

# Force a fresh in-memory DB before mdm/stock modules read settings.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("STOCK_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("IMAP_USER", "")
os.environ.setdefault("IMAP_PASSWORD", "")

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from mdm.db import Base, reset_engine_for_tests
import mdm.db as mdm_db

from stock.db import Base as StockBase
import stock.db as stock_db


FIXTURE_DIR = Path(__file__).parent / "fixtures"


@pytest_asyncio.fixture
async def sessionmaker() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    sm = async_sessionmaker(engine, expire_on_commit=False)

    # Wire mdm.db globals to the same engine so the routes and services see it.
    mdm_db._engine = engine
    mdm_db._sessionmaker = sm

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield sm
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def session(sessionmaker) -> AsyncIterator[AsyncSession]:
    async with sessionmaker() as s:
        yield s


@pytest_asyncio.fixture
async def stock_sessionmaker() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", future=True)
    sm = async_sessionmaker(engine, expire_on_commit=False)

    # Wire stock.db globals so routes and services see the same engine.
    stock_db._engine = engine
    stock_db._sessionmaker = sm

    async with engine.begin() as conn:
        await conn.run_sync(StockBase.metadata.create_all)
    try:
        yield sm
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def stock_session(stock_sessionmaker) -> AsyncIterator[AsyncSession]:
    async with stock_sessionmaker() as s:
        yield s


def fixture_path(name: str) -> Path:
    return FIXTURE_DIR / name


def load_fixture(name: str) -> bytes:
    return fixture_path(name).read_bytes()
