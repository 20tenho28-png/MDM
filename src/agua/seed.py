"""Load the bundled demo GeoJSON of well-known Portuguese fountains/springs.

Run with:  python -m agua.seed

Useful when the Overpass importer cannot run (e.g. restricted networks). Seed
points use ``osm_type="seed"`` so they never collide with real OSM IDs.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from agua.db import get_sessionmaker
from agua.importer import upsert_pontos
from agua.overpass import PontoParsed
from agua.models import Potavel, TipoPonto

SEED_PATH = Path(__file__).parent / "data" / "seed_pontos.geojson"


def _carregar_features(path: Path = SEED_PATH) -> list[PontoParsed]:
    dados = json.loads(path.read_text(encoding="utf-8"))
    pontos: list[PontoParsed] = []
    for i, feature in enumerate(dados.get("features", [])):
        props = feature.get("properties", {})
        lon, lat = feature["geometry"]["coordinates"]
        pontos.append(
            PontoParsed(
                osm_type="seed",
                osm_id=int(props.get("id", i + 1)),
                tipo=TipoPonto(props.get("tipo", "fonte")),
                nome=props.get("nome"),
                potavel=Potavel(props.get("potavel", "desconhecido")),
                lat=float(lat),
                lon=float(lon),
                concelho=props.get("concelho"),
                tags={"source": "seed"},
            )
        )
    return pontos


async def semear(session: AsyncSession, path: Path = SEED_PATH):
    return await upsert_pontos(session, _carregar_features(path))


async def _main() -> None:
    sm = get_sessionmaker()
    async with sm() as session:
        async with session.begin():
            stats = await semear(session)
    print(f"Seed: {stats.total} pontos ({stats.novos} novos, {stats.atualizados} atualizados).")


if __name__ == "__main__":
    asyncio.run(_main())
