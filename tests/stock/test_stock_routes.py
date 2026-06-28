from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from stock.main import create_app
from stock.models import Categoria
from stock.services import artigos as artigos_svc

CSV = (
    "referencia;descricao;quantidade;unidade\n"
    "CAB-2.5;Cabo 2.5mm2;100;m\n"
    "DISJ-16;Disjuntor 16A;25;un\n"
).encode("utf-8")


def _client(app):
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.mark.asyncio
async def test_dashboard_empty(stock_sessionmaker):
    app = create_app()
    async with _client(app) as ac:
        resp = await ac.get("/")
    assert resp.status_code == 200
    assert "Stock Atual" in resp.text


@pytest.mark.asyncio
async def test_dashboard_highlights_low_stock(stock_sessionmaker):
    async with stock_sessionmaker() as s:
        async with s.begin():
            await artigos_svc.criar_artigo(
                s, referencia="LOW-1", descricao="Baixo",
                categoria=Categoria.material_eletrico, unidade="un",
                stock_atual=1, stock_minimo=10,
            )
    app = create_app()
    async with _client(app) as ac:
        resp = await ac.get("/")
    assert "LOW-1" in resp.text
    assert "card-red" in resp.text


@pytest.mark.asyncio
async def test_stock_partial_has_no_html_chrome(stock_sessionmaker):
    app = create_app()
    async with _client(app) as ac:
        resp = await ac.get("/stock")
    assert resp.status_code == 200
    assert "<html" not in resp.text.lower()
    assert 'id="stock"' in resp.text


@pytest.mark.asyncio
async def test_upload_review_confirm_flow(stock_sessionmaker):
    app = create_app()
    async with _client(app) as ac:
        resp = await ac.post(
            "/guias",
            data={"categoria": "material_eletrico", "fornecedor": "Forn"},
            files={"ficheiro": ("guia.csv", CSV, "text/csv")},
            follow_redirects=False,
        )
        assert resp.status_code == 303
        location = resp.headers["location"]
        assert "/rever" in location

        review = await ac.get(location)
        assert review.status_code == 200
        assert "CAB-2.5" in review.text
        assert "NOVO" in review.text  # both articles are new

        guia_id = location.split("/guias/")[1].split("/rever")[0]
        confirm = await ac.post(f"/guias/{guia_id}/confirmar", follow_redirects=False)
        assert confirm.status_code == 303

    async with stock_sessionmaker() as s:
        artigo = await artigos_svc.get_por_referencia(s, "CAB-2.5")
    assert artigo.stock_atual == 100


@pytest.mark.asyncio
async def test_saida_decrements_and_warns(stock_sessionmaker):
    async with stock_sessionmaker() as s:
        async with s.begin():
            artigo = await artigos_svc.criar_artigo(
                s, referencia="S-1", descricao="",
                categoria=Categoria.tubo_cobre, unidade="m", stock_atual=5,
            )
        artigo_id = artigo.id

    app = create_app()
    async with _client(app) as ac:
        # Normal saída -> redirect.
        ok = await ac.post(
            "/saida",
            data={"artigo_id": artigo_id, "quantidade": 2, "nota": ""},
            follow_redirects=False,
        )
        assert ok.status_code == 303
        # Saída exceeding stock -> re-render with warning (200).
        warn = await ac.post(
            "/saida",
            data={"artigo_id": artigo_id, "quantidade": 100, "nota": ""},
            follow_redirects=False,
        )
        assert warn.status_code == 200
        assert "insuficiente" in warn.text.lower()

    async with stock_sessionmaker() as s:
        artigo = await artigos_svc.get_por_referencia(s, "S-1")
    assert artigo.stock_atual == 5 - 2 - 100


@pytest.mark.asyncio
async def test_artigo_crud(stock_sessionmaker):
    app = create_app()
    async with _client(app) as ac:
        create = await ac.post(
            "/artigos",
            data={
                "referencia": "NEW-1", "descricao": "Novo",
                "categoria": "material_eletrico", "unidade": "un",
                "stock_minimo": 3, "localizacao": "A1",
            },
            follow_redirects=False,
        )
        assert create.status_code == 303
        listagem = await ac.get("/artigos")
        assert "NEW-1" in listagem.text

    async with stock_sessionmaker() as s:
        artigo = await artigos_svc.get_por_referencia(s, "NEW-1")
        assert artigo is not None
        artigo_id = artigo.id

    async with _client(app) as ac:
        elim = await ac.post(f"/artigos/{artigo_id}/eliminar", follow_redirects=False)
        assert elim.status_code == 303

    async with stock_sessionmaker() as s:
        assert await artigos_svc.get_por_referencia(s, "NEW-1") is None
