"""Web routes for the water-map service (PT-PT, read-only).

`GET /`                    página do mapa Leaflet
`GET /api/pontos.geojson`  FeatureCollection GeoJSON (filtros ?tipo= &potavel=)
`GET /api/stats`           contagens agregadas
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from agua.config import Settings, get_settings
from agua.db import get_sessionmaker
from agua.models import Potavel, TipoPonto
from agua.services import pontos as pontos_svc

TEMPLATE_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

router = APIRouter()


async def _session() -> AsyncSession:  # pragma: no cover - thin wrapper
    sm = get_sessionmaker()
    async with sm() as session:
        yield session


def _parse_enum(cls, valor: str | None):
    if valor is None or valor == "":
        return None
    try:
        return cls(valor)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Valor inválido: {valor}") from exc


@router.get("/", response_class=HTMLResponse)
async def mapa(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> HTMLResponse:
    ctx = {
        "map_center_lat": settings.map_center_lat,
        "map_center_lon": settings.map_center_lon,
        "map_zoom": settings.map_zoom,
    }
    return templates.TemplateResponse(request, "mapa.html", ctx)


@router.get("/api/pontos.geojson")
async def pontos_geojson(
    tipo: str | None = Query(None),
    potavel: str | None = Query(None),
    session: AsyncSession = Depends(_session),
) -> JSONResponse:
    tipo_enum = _parse_enum(TipoPonto, tipo)
    potavel_enum = _parse_enum(Potavel, potavel)
    pontos = await pontos_svc.listar_pontos(
        session, tipo=tipo_enum, potavel=potavel_enum
    )
    return JSONResponse(pontos_svc.to_feature_collection(pontos))


@router.get("/api/stats")
async def stats(session: AsyncSession = Depends(_session)) -> JSONResponse:
    return JSONResponse(await pontos_svc.stats(session))
