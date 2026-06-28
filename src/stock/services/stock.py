"""Stock movements: entradas, saídas, low-stock alerts and KPIs."""
from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from stock.models import Artigo, MovimentoStock, TipoMovimento


@dataclass
class ResultadoSaida:
    movimento: MovimentoStock
    aviso: str | None = None


async def registar_entrada(
    session: AsyncSession,
    *,
    artigo: Artigo,
    quantidade: int,
    origem: str = "ajuste",
    guia_id: str | None = None,
    nota: str | None = None,
) -> MovimentoStock:
    """Increment an article's stock and record an entry movement."""
    artigo.stock_atual += quantidade
    movimento = MovimentoStock(
        artigo_id=artigo.id,
        tipo=TipoMovimento.entrada,
        quantidade=quantidade,
        origem=origem,
        guia_id=guia_id,
        nota=nota,
    )
    session.add(movimento)
    await session.flush()
    return movimento


async def registar_saida(
    session: AsyncSession,
    *,
    artigo: Artigo,
    quantidade: int,
    origem: str = "saida_manual",
    nota: str | None = None,
) -> ResultadoSaida:
    """Decrement stock. Allowed to go negative, but returns a warning when it does."""
    aviso: str | None = None
    if quantidade > artigo.stock_atual:
        aviso = (
            f"Stock insuficiente para '{artigo.referencia}': "
            f"existem {artigo.stock_atual}, pedidos {quantidade}. "
            f"O stock ficará negativo."
        )
    artigo.stock_atual -= quantidade
    movimento = MovimentoStock(
        artigo_id=artigo.id,
        tipo=TipoMovimento.saida,
        quantidade=quantidade,
        origem=origem,
        nota=nota,
    )
    session.add(movimento)
    await session.flush()
    return ResultadoSaida(movimento=movimento, aviso=aviso)


async def artigos_stock_baixo(session: AsyncSession) -> list[Artigo]:
    result = await session.execute(
        select(Artigo)
        .where(Artigo.stock_atual <= Artigo.stock_minimo)
        .order_by(Artigo.stock_atual)
    )
    return list(result.scalars().all())


def stock_baixo(artigo: Artigo) -> bool:
    return artigo.stock_atual <= artigo.stock_minimo


@dataclass
class KPIs:
    total_artigos: int
    abaixo_minimo: int
    total_unidades: int
    movimentos_recentes: int


async def kpis(session: AsyncSession) -> KPIs:
    total_artigos = (
        await session.execute(select(func.count()).select_from(Artigo))
    ).scalar_one()
    abaixo_minimo = (
        await session.execute(
            select(func.count())
            .select_from(Artigo)
            .where(Artigo.stock_atual <= Artigo.stock_minimo)
        )
    ).scalar_one()
    total_unidades = (
        await session.execute(select(func.coalesce(func.sum(Artigo.stock_atual), 0)))
    ).scalar_one()
    movimentos_recentes = (
        await session.execute(select(func.count()).select_from(MovimentoStock))
    ).scalar_one()
    return KPIs(
        total_artigos=int(total_artigos),
        abaixo_minimo=int(abaixo_minimo),
        total_unidades=int(total_unidades),
        movimentos_recentes=int(movimentos_recentes),
    )
