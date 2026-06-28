from __future__ import annotations

import pytest

from stock.models import Categoria, EstadoGuia
from stock.services import artigos as artigos_svc
from stock.services import guias as guias_svc

CSV = (
    "referencia;descricao;quantidade;unidade\n"
    "CAB-2.5;Cabo 2.5mm2;100;m\n"
    "DISJ-16;Disjuntor 16A;25;un\n"
).encode("utf-8")


@pytest.mark.asyncio
async def test_criar_guia_pendente_does_not_touch_stock(stock_session):
    async with stock_session.begin():
        guia = await guias_svc.criar_guia_pendente(
            stock_session,
            filename="guia.csv",
            content=CSV,
            categoria=Categoria.material_eletrico,
            fornecedor="Fornecedor X",
        )
    assert guia.estado == EstadoGuia.pendente
    assert guia.num_itens == 2
    # No articles created yet.
    assert await artigos_svc.listar_artigos(stock_session) == []


@pytest.mark.asyncio
async def test_confirmar_guia_applies_entries_and_creates_articles(stock_session):
    async with stock_session.begin():
        guia = await guias_svc.criar_guia_pendente(
            stock_session,
            filename="guia.csv",
            content=CSV,
            categoria=Categoria.tubo_cobre,
        )
    guia_id = guia.id

    async with stock_session.begin():
        confirmada = await guias_svc.confirmar_guia(stock_session, guia_id)
    assert confirmada.estado == EstadoGuia.confirmada

    artigos = await artigos_svc.listar_artigos(stock_session)
    por_ref = {a.referencia: a for a in artigos}
    assert por_ref["CAB-2.5"].stock_atual == 100
    assert por_ref["DISJ-16"].stock_atual == 25
    # New articles inherit the guide's category.
    assert por_ref["CAB-2.5"].categoria == Categoria.tubo_cobre


@pytest.mark.asyncio
async def test_confirmar_guia_is_idempotent(stock_session):
    async with stock_session.begin():
        guia = await guias_svc.criar_guia_pendente(
            stock_session, filename="guia.csv", content=CSV,
            categoria=Categoria.material_eletrico,
        )
    guia_id = guia.id

    async with stock_session.begin():
        await guias_svc.confirmar_guia(stock_session, guia_id)
    async with stock_session.begin():
        await guias_svc.confirmar_guia(stock_session, guia_id)  # second time

    artigo = await artigos_svc.get_por_referencia(stock_session, "CAB-2.5")
    assert artigo.stock_atual == 100  # not doubled
