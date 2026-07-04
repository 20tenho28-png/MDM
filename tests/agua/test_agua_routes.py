from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from agua.main import create_app
from agua.models import PontoAgua, Potavel, TipoPonto


def _client(app):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _seed(sessionmaker):
    async with sessionmaker() as s:
        async with s.begin():
            s.add_all([
                PontoAgua(osm_type="node", osm_id=1, tipo=TipoPonto.fonte,
                          nome="Fonte A", potavel=Potavel.sim, lat=38.7, lon=-9.1),
                PontoAgua(osm_type="node", osm_id=2, tipo=TipoPonto.nascente,
                          nome="Nascente B", potavel=Potavel.desconhecido, lat=40.2, lon=-8.4),
            ])


@pytest.mark.asyncio
async def test_map_page_renders(agua_sessionmaker):
    app = create_app()
    async with _client(app) as ac:
        resp = await ac.get("/")
    assert resp.status_code == 200
    assert 'id="map"' in resp.text
    assert "leaflet" in resp.text.lower()


@pytest.mark.asyncio
async def test_geojson_and_filters(agua_sessionmaker):
    await _seed(agua_sessionmaker)
    app = create_app()
    async with _client(app) as ac:
        todos = (await ac.get("/api/pontos.geojson")).json()
        assert todos["type"] == "FeatureCollection"
        assert len(todos["features"]) == 2

        fontes = (await ac.get("/api/pontos.geojson?tipo=fonte")).json()
        assert len(fontes["features"]) == 1
        assert fontes["features"][0]["properties"]["nome"] == "Fonte A"

        potaveis = (await ac.get("/api/pontos.geojson?potavel=sim")).json()
        assert len(potaveis["features"]) == 1


@pytest.mark.asyncio
async def test_geojson_invalid_filter_400(agua_sessionmaker):
    app = create_app()
    async with _client(app) as ac:
        resp = await ac.get("/api/pontos.geojson?tipo=lago")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_stats_endpoint(agua_sessionmaker):
    await _seed(agua_sessionmaker)
    app = create_app()
    async with _client(app) as ac:
        s = (await ac.get("/api/stats")).json()
    assert s["total"] == 2
    assert s["por_tipo"]["fonte"] == 1
