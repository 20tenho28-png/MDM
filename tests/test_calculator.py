"""Tests for the AC sizing calculator app (ac-calculator/)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from mdm.main import create_app


REPO_ROOT = Path(__file__).parent.parent
CALC_DIR = REPO_ROOT / "ac-calculator"


@pytest.mark.asyncio
async def test_calculator_page_served(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/calculadora", follow_redirects=True)
    assert resp.status_code == 200
    body = resp.text
    assert "Calculadora de ar condicionado" in body
    assert 'id="app"' in body
    assert "./app.js" in body
    # Client-facing page: European Portuguese, no em dashes (house rule).
    assert "—" not in body


@pytest.mark.asyncio
async def test_calculator_assets_served(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for asset in (
            "/calculadora/app.js",
            "/calculadora/calc_model.js",
            "/calculadora/prices.js",
        ):
            resp = await ac.get(asset)
            assert resp.status_code == 200, asset
            assert "javascript" in resp.headers["content-type"]
    # The model must stay DOM-free so it runs under Node.
    for pure in ("calc_model.js", "prices.js"):
        src = (CALC_DIR / pure).read_text()
        assert "document." not in src, pure
        assert "window." not in src, pure
        assert "—" not in src, pure


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_node_suite():
    proc = subprocess.run(
        ["node", str(CALC_DIR / "test" / "calc.test.mjs")],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
