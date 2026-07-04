from __future__ import annotations

import pytest
from sqlalchemy import func, select

from agua.models import PontoAgua
from agua.seed import _carregar_features, semear


def test_seed_geojson_parses():
    pontos = _carregar_features()
    assert len(pontos) >= 15
    assert all(p.osm_type == "seed" for p in pontos)
    assert all(-32 <= p.lon <= -6 for p in pontos)   # Portugal + islands longitudes
    assert all(32 <= p.lat <= 43 for p in pontos)


@pytest.mark.asyncio
async def test_seed_loads_points(agua_session):
    async with agua_session.begin():
        stats = await semear(agua_session)
    assert stats.novos >= 15

    total = (
        await agua_session.execute(select(func.count()).select_from(PontoAgua))
    ).scalar_one()
    assert total == stats.total
