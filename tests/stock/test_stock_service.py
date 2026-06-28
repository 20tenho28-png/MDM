from __future__ import annotations

import pytest
from sqlalchemy import select

from stock.models import Categoria, MovimentoStock, TipoMovimento
from stock.services import artigos as artigos_svc
from stock.services import stock as stock_svc


@pytest.mark.asyncio
async def test_entrada_increments_and_records_movement(stock_session):
    async with stock_session.begin():
        artigo = await artigos_svc.criar_artigo(
            stock_session,
            referencia="CAB-2.5",
            descricao="Cabo",
            categoria=Categoria.material_eletrico,
            unidade="m",
        )
        await stock_svc.registar_entrada(
            stock_session, artigo=artigo, quantidade=100, origem="guia"
        )
    assert artigo.stock_atual == 100

    movimento = (
        await stock_session.execute(
            select(MovimentoStock).where(MovimentoStock.artigo_id == artigo.id)
        )
    ).scalar_one()
    assert movimento.tipo == TipoMovimento.entrada
    assert movimento.quantidade == 100


@pytest.mark.asyncio
async def test_saida_decrements(stock_session):
    async with stock_session.begin():
        artigo = await artigos_svc.criar_artigo(
            stock_session,
            referencia="DISJ-16",
            descricao="Disjuntor",
            categoria=Categoria.material_eletrico,
            unidade="un",
            stock_atual=20,
        )
        resultado = await stock_svc.registar_saida(
            stock_session, artigo=artigo, quantidade=5
        )
    assert artigo.stock_atual == 15
    assert resultado.aviso is None
    assert resultado.movimento.tipo == TipoMovimento.saida


@pytest.mark.asyncio
async def test_saida_below_zero_allowed_with_warning(stock_session):
    async with stock_session.begin():
        artigo = await artigos_svc.criar_artigo(
            stock_session,
            referencia="X-1",
            descricao="",
            categoria=Categoria.tubo_cobre,
            unidade="m",
            stock_atual=3,
        )
        resultado = await stock_svc.registar_saida(
            stock_session, artigo=artigo, quantidade=10
        )
    assert artigo.stock_atual == -7
    assert resultado.aviso is not None
    assert "insuficiente" in resultado.aviso.lower()


@pytest.mark.asyncio
async def test_get_or_create_por_referencia(stock_session):
    async with stock_session.begin():
        a1, criado1 = await artigos_svc.get_or_create_por_referencia(
            stock_session,
            referencia="REF-1",
            descricao="d",
            categoria=Categoria.material_eletrico,
            unidade="un",
        )
        a2, criado2 = await artigos_svc.get_or_create_por_referencia(
            stock_session,
            referencia="REF-1",
            descricao="outra",
            categoria=Categoria.tubo_cobre,
            unidade="m",
        )
    assert criado1 is True
    assert criado2 is False
    assert a1.id == a2.id


@pytest.mark.asyncio
async def test_low_stock_and_kpis(stock_session):
    async with stock_session.begin():
        await artigos_svc.criar_artigo(
            stock_session, referencia="A", descricao="", categoria=Categoria.material_eletrico,
            unidade="un", stock_atual=2, stock_minimo=5,
        )
        await artigos_svc.criar_artigo(
            stock_session, referencia="B", descricao="", categoria=Categoria.material_eletrico,
            unidade="un", stock_atual=50, stock_minimo=5,
        )
    baixos = await stock_svc.artigos_stock_baixo(stock_session)
    assert [a.referencia for a in baixos] == ["A"]

    indicadores = await stock_svc.kpis(stock_session)
    assert indicadores.total_artigos == 2
    assert indicadores.abaixo_minimo == 1
    assert indicadores.total_unidades == 52
