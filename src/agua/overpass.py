"""Overpass query building and (network-free) response parsing.

``parse_overpass`` is pure and unit-testable without any network access, which
matters because this environment blocks the Overpass host by policy.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from agua.models import Potavel, TipoPonto

# Fetches fountains and springs across all of Portugal (mainland + islands),
# using the country area so we don't rely on a bounding box.
OVERPASS_QUERY = """
[out:json][timeout:180];
area["ISO3166-1"="PT"][admin_level=2]->.pt;
(
  node(area.pt)["amenity"="fountain"];
  way(area.pt)["amenity"="fountain"];
  node(area.pt)["natural"="spring"];
  way(area.pt)["natural"="spring"];
);
out center tags;
""".strip()


@dataclass
class PontoParsed:
    osm_type: str
    osm_id: int
    tipo: TipoPonto
    nome: str | None
    potavel: Potavel
    lat: float
    lon: float
    concelho: str | None
    tags: dict = field(default_factory=dict)


def build_query() -> str:
    return OVERPASS_QUERY


def _derivar_tipo(tags: dict) -> TipoPonto | None:
    if tags.get("amenity") == "fountain":
        return TipoPonto.fonte
    if tags.get("natural") == "spring":
        return TipoPonto.nascente
    return None


def _derivar_potavel(tags: dict) -> Potavel:
    valor = (tags.get("drinking_water") or "").strip().lower()
    if valor in ("yes", "treated"):
        return Potavel.sim
    if valor in ("no",):
        return Potavel.nao
    return Potavel.desconhecido


def _coords(elem: dict) -> tuple[float, float] | None:
    if "lat" in elem and "lon" in elem:
        return float(elem["lat"]), float(elem["lon"])
    centro = elem.get("center")
    if centro and "lat" in centro and "lon" in centro:
        return float(centro["lat"]), float(centro["lon"])
    return None


def parse_overpass(payload: dict) -> list[PontoParsed]:
    """Turn an Overpass JSON payload into parsed points, skipping bad rows."""
    pontos: list[PontoParsed] = []
    for elem in payload.get("elements", []):
        tags = elem.get("tags") or {}
        tipo = _derivar_tipo(tags)
        if tipo is None:
            continue
        coords = _coords(elem)
        if coords is None:
            continue
        lat, lon = coords
        pontos.append(
            PontoParsed(
                osm_type=str(elem.get("type", "node")),
                osm_id=int(elem["id"]),
                tipo=tipo,
                nome=tags.get("name"),
                potavel=_derivar_potavel(tags),
                lat=lat,
                lon=lon,
                concelho=tags.get("addr:city") or tags.get("addr:municipality"),
                tags=tags,
            )
        )
    return pontos
