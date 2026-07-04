from __future__ import annotations

import pytest
from sqlalchemy import func, select

from agua.importer import upsert_pontos
from agua.models import PontoAgua, Potavel
from agua.overpass import parse_overpass

PAYLOAD = {
    "elements": [
        {"type": "node", "id": 1, "lat": 38.71, "lon": -9.14,
         "tags": {"amenity": "fountain", "name": "A", "drinking_water": "no"}},
        {"type": "node", "id": 2, "lat": 40.20, "lon": -8.41,
         "tags": {"natural": "spring", "name": "B", "drinking_water": "yes"}},
    ]
}


@pytest.mark.asyncio
async def test_upsert_is_idempotent_and_updates(agua_session):
    pontos = parse_overpass(PAYLOAD)

    async with agua_session.begin():
        stats1 = await upsert_pontos(agua_session, pontos)
    assert (stats1.novos, stats1.atualizados) == (2, 0)

    # Second import of the same data: no duplicates, all updated.
    async with agua_session.begin():
        stats2 = await upsert_pontos(agua_session, pontos)
    assert (stats2.novos, stats2.atualizados) == (0, 2)

    total = (
        await agua_session.execute(select(func.count()).select_from(PontoAgua))
    ).scalar_one()
    assert total == 2


@pytest.mark.asyncio
async def test_upsert_reflects_changed_fields(agua_session):
    async with agua_session.begin():
        await upsert_pontos(agua_session, parse_overpass(PAYLOAD))

    # Same osm id, but potability changed no -> yes.
    changed = {
        "elements": [
            {"type": "node", "id": 1, "lat": 38.71, "lon": -9.14,
             "tags": {"amenity": "fountain", "name": "A", "drinking_water": "yes"}},
        ]
    }
    async with agua_session.begin():
        await upsert_pontos(agua_session, parse_overpass(changed))

    ponto = (
        await agua_session.execute(
            select(PontoAgua).where(PontoAgua.osm_id == 1)
        )
    ).scalar_one()
    assert ponto.potavel == Potavel.sim
