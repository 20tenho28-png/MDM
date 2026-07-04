from __future__ import annotations

from agua.models import Potavel, TipoPonto
from agua.overpass import parse_overpass

PAYLOAD = {
    "elements": [
        {
            "type": "node", "id": 1, "lat": 38.71, "lon": -9.14,
            "tags": {"amenity": "fountain", "name": "Chafariz", "drinking_water": "no"},
        },
        {
            "type": "node", "id": 2, "lat": 40.20, "lon": -8.41,
            "tags": {"natural": "spring", "name": "Nascente", "drinking_water": "yes"},
        },
        {
            # way with only a center -> use center coords
            "type": "way", "id": 3, "center": {"lat": 41.15, "lon": -8.61},
            "tags": {"amenity": "fountain"},  # no drinking_water -> desconhecido
        },
        {
            # no coordinates -> skipped
            "type": "node", "id": 4, "tags": {"amenity": "fountain"},
        },
        {
            # not a fountain/spring -> skipped
            "type": "node", "id": 5, "lat": 1, "lon": 1, "tags": {"amenity": "bench"},
        },
    ]
}


def test_parse_extracts_type_name_coords_and_potability():
    pontos = parse_overpass(PAYLOAD)
    assert len(pontos) == 3  # ids 1, 2, 3

    por_id = {p.osm_id: p for p in pontos}
    assert por_id[1].tipo == TipoPonto.fonte
    assert por_id[1].nome == "Chafariz"
    assert por_id[1].potavel == Potavel.nao
    assert por_id[1].lat == 38.71

    assert por_id[2].tipo == TipoPonto.nascente
    assert por_id[2].potavel == Potavel.sim

    assert por_id[3].osm_type == "way"
    assert por_id[3].lat == 41.15
    assert por_id[3].potavel == Potavel.desconhecido
    assert por_id[3].nome is None


def test_parse_empty_payload():
    assert parse_overpass({}) == []
