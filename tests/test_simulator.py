"""Tests for the electric circuit simulator app (electric-simulator/)."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from mdm.main import create_app


REPO_ROOT = Path(__file__).parent.parent
SIM_DIR = REPO_ROOT / "electric-simulator"


@pytest.mark.asyncio
async def test_simulator_page_served(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/simulator", follow_redirects=True)
    assert resp.status_code == 200
    body = resp.text
    assert "Electric Simulator" in body
    assert 'id="sim-canvas"' in body
    assert "./simulator.js" in body


@pytest.mark.asyncio
async def test_simulator_assets_served(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for asset in (
            "/simulator/circuit.js",
            "/simulator/simulator.js",
            "/simulator/panel_model.js",
            "/simulator/panel.js",
        ):
            resp = await ac.get(asset)
            assert resp.status_code == 200, asset
            assert "javascript" in resp.headers["content-type"]
    # The solver/model modules must stay DOM-free so they run under Node.
    for pure in ("circuit.js", "panel_model.js"):
        assert "document." not in (SIM_DIR / pure).read_text(), pure


@pytest.mark.asyncio
async def test_panel_page_served(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/simulator/panel.html")
    assert resp.status_code == 200
    body = resp.text
    assert "Quadro Elétrico" in body
    assert 'id="qd-canvas"' in body
    assert "./panel.js" in body


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
@pytest.mark.parametrize("suite", ["circuit.test.mjs", "panel.test.mjs"])
def test_node_suites(suite):
    proc = subprocess.run(
        ["node", str(SIM_DIR / "test" / suite)],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
