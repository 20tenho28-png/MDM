"""Read-only queries and GeoJSON assembly for water points."""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from agua.models import PontoAgua, Potavel, TipoPonto


async def listar_pontos(
    session: AsyncSession,
    *,
    tipo: TipoPonto | None = None,
    potavel: Potavel | None = None,
) -> list[PontoAgua]:
    stmt = select(PontoAgua)
    if tipo is not None:
        stmt = stmt.where(PontoAgua.tipo == tipo)
    if potavel is not None:
        stmt = stmt.where(PontoAgua.potavel == potavel)
    result = await session.execute(stmt)
    return list(result.scalars().all())


def to_feature_collection(pontos: list[PontoAgua]) -> dict:
    """Build a GeoJSON FeatureCollection ([lon, lat] per the spec)."""
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [p.lon, p.lat]},
                "properties": {
                    "nome": p.nome or "(sem nome)",
                    "tipo": p.tipo.value,
                    "potavel": p.potavel.value,
                    "concelho": p.concelho,
                },
            }
            for p in pontos
        ],
    }


async def stats(session: AsyncSession) -> dict:
    total = (
        await session.execute(select(func.count()).select_from(PontoAgua))
    ).scalar_one()
    por_tipo = {
        tipo.value: (
            await session.execute(
                select(func.count()).select_from(PontoAgua).where(PontoAgua.tipo == tipo)
            )
        ).scalar_one()
        for tipo in TipoPonto
    }
    por_potavel = {
        pot.value: (
            await session.execute(
                select(func.count()).select_from(PontoAgua).where(PontoAgua.potavel == pot)
            )
        ).scalar_one()
        for pot in Potavel
    }
    return {
        "total": int(total),
        "por_tipo": {k: int(v) for k, v in por_tipo.items()},
        "por_potavel": {k: int(v) for k, v in por_potavel.items()},
    }
