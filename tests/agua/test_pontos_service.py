from __future__ import annotations

import pytest

from agua.models import PontoAgua, Potavel, TipoPonto
from agua.services import pontos as pontos_svc


async def _seed(session):
    async with session.begin():
        session.add_all([
            PontoAgua(osm_type="node", osm_id=1, tipo=TipoPonto.fonte,
                      nome="Fonte A", potavel=Potavel.sim, lat=38.7, lon=-9.1),
            PontoAgua(osm_type="node", osm_id=2, tipo=TipoPonto.nascente,
                      nome="Nascente B", potavel=Potavel.desconhecido, lat=40.2, lon=-8.4),
        ])


@pytest.mark.asyncio
async def test_filter_by_tipo_and_potavel(agua_session):
    await _seed(agua_session)

    fontes = await pontos_svc.listar_pontos(agua_session, tipo=TipoPonto.fonte)
    assert [p.osm_id for p in fontes] == [1]

    potaveis = await pontos_svc.listar_pontos(agua_session, potavel=Potavel.sim)
    assert [p.osm_id for p in potaveis] == [1]

    todos = await pontos_svc.listar_pontos(agua_session)
    assert len(todos) == 2


@pytest.mark.asyncio
async def test_feature_collection_shape(agua_session):
    await _seed(agua_session)
    todos = await pontos_svc.listar_pontos(agua_session)
    fc = pontos_svc.to_feature_collection(todos)

    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 2
    feat = fc["features"][0]
    assert feat["geometry"]["type"] == "Point"
    # GeoJSON order is [lon, lat].
    assert feat["geometry"]["coordinates"] == [-9.1, 38.7]
    assert feat["properties"]["tipo"] == "fonte"


@pytest.mark.asyncio
async def test_stats(agua_session):
    await _seed(agua_session)
    s = await pontos_svc.stats(agua_session)
    assert s["total"] == 2
    assert s["por_tipo"]["fonte"] == 1
    assert s["por_tipo"]["nascente"] == 1
    assert s["por_potavel"]["sim"] == 1
