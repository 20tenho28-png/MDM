"""Import fountains/springs from Overpass into the database.

Run with:  python -m agua.importer

Requires outbound network access to the Overpass host. This sandbox blocks it
by policy, so run the importer where the network is open; use ``agua.seed`` for
a working demo dataset in restricted environments.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agua.config import get_settings
from agua.db import get_sessionmaker
from agua.models import PontoAgua
from agua.overpass import PontoParsed, build_query, parse_overpass


@dataclass
class ImportStats:
    total: int = 0
    novos: int = 0
    atualizados: int = 0


async def _fetch_overpass(url: str, timeout: int) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, data={"data": build_query()})
        resp.raise_for_status()
        return resp.json()


async def upsert_pontos(
    session: AsyncSession, pontos: list[PontoParsed]
) -> ImportStats:
    """Idempotent upsert keyed on (osm_type, osm_id)."""
    stats = ImportStats(total=len(pontos))
    for p in pontos:
        existente = (
            await session.execute(
                select(PontoAgua).where(
                    PontoAgua.osm_type == p.osm_type,
                    PontoAgua.osm_id == p.osm_id,
                )
            )
        ).scalar_one_or_none()
        if existente is None:
            session.add(
                PontoAgua(
                    osm_type=p.osm_type,
                    osm_id=p.osm_id,
                    tipo=p.tipo,
                    nome=p.nome,
                    potavel=p.potavel,
                    lat=p.lat,
                    lon=p.lon,
                    concelho=p.concelho,
                    tags_raw=p.tags,
                )
            )
            stats.novos += 1
        else:
            existente.tipo = p.tipo
            existente.nome = p.nome
            existente.potavel = p.potavel
            existente.lat = p.lat
            existente.lon = p.lon
            existente.concelho = p.concelho
            existente.tags_raw = p.tags
            stats.atualizados += 1
    await session.flush()
    return stats


async def importar(
    session: AsyncSession, *, overpass_url: str, timeout: int = 300
) -> ImportStats:
    payload = await _fetch_overpass(overpass_url, timeout)
    pontos = parse_overpass(payload)
    return await upsert_pontos(session, pontos)


async def _main() -> None:
    settings = get_settings()
    sm = get_sessionmaker()
    async with sm() as session:
        async with session.begin():
            stats = await importar(
                session,
                overpass_url=settings.overpass_url,
                timeout=settings.overpass_timeout_seconds,
            )
    print(
        f"Importados {stats.total} pontos "
        f"({stats.novos} novos, {stats.atualizados} atualizados)."
    )


if __name__ == "__main__":
    asyncio.run(_main())
