"""Tests for the electric circuit simulator page and its JS solver."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from mdm.main import create_app


REPO_ROOT = Path(__file__).parent.parent


@pytest.mark.asyncio
async def test_simulator_page_renders(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.get("/simulator")
    assert resp.status_code == 200
    body = resp.text
    assert "Electric Simulator" in body
    assert 'id="sim-canvas"' in body
    assert "/static/simulator.js" in body


@pytest.mark.asyncio
async def test_simulator_static_assets_served(sessionmaker):
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for asset in ("/static/circuit.js", "/static/simulator.js"):
            resp = await ac.get(asset)
            assert resp.status_code == 200, asset
            assert "javascript" in resp.headers["content-type"]
    # The solver module must stay DOM-free so it runs under Node in tests.
    assert "document." not in (REPO_ROOT / "src/mdm/web/static/circuit.js").read_text()


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_circuit_solver_physics():
    proc = subprocess.run(
        ["node", str(REPO_ROOT / "tests/js/test_circuit.mjs")],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
