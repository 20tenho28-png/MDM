"""Article CRUD and reference-based matching."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from stock.models import Artigo, Categoria


async def listar_artigos(session: AsyncSession) -> list[Artigo]:
    result = await session.execute(select(Artigo).order_by(Artigo.referencia))
    return list(result.scalars().all())


async def get_artigo(session: AsyncSession, artigo_id: str) -> Artigo | None:
    return await session.get(Artigo, artigo_id)


async def get_por_referencia(
    session: AsyncSession, referencia: str
) -> Artigo | None:
    result = await session.execute(
        select(Artigo).where(Artigo.referencia == referencia)
    )
    return result.scalar_one_or_none()


async def get_or_create_por_referencia(
    session: AsyncSession,
    *,
    referencia: str,
    descricao: str,
    categoria: Categoria,
    unidade: str,
) -> tuple[Artigo, bool]:
    """Return (artigo, criado). Matches on referência; creates if unknown."""
    artigo = await get_por_referencia(session, referencia)
    if artigo is not None:
        return artigo, False
    artigo = Artigo(
        referencia=referencia,
        descricao=descricao,
        categoria=categoria,
        unidade=unidade or "un",
        stock_atual=0,
        stock_minimo=0,
    )
    session.add(artigo)
    await session.flush()
    return artigo, True


async def criar_artigo(
    session: AsyncSession,
    *,
    referencia: str,
    descricao: str,
    categoria: Categoria,
    unidade: str,
    stock_atual: int = 0,
    stock_minimo: int = 0,
    localizacao: str | None = None,
) -> Artigo:
    artigo = Artigo(
        referencia=referencia,
        descricao=descricao,
        categoria=categoria,
        unidade=unidade or "un",
        stock_atual=stock_atual,
        stock_minimo=stock_minimo,
        localizacao=localizacao,
    )
    session.add(artigo)
    await session.flush()
    return artigo


async def editar_artigo(
    session: AsyncSession,
    artigo_id: str,
    *,
    descricao: str | None = None,
    categoria: Categoria | None = None,
    unidade: str | None = None,
    stock_minimo: int | None = None,
    localizacao: str | None = None,
) -> Artigo | None:
    artigo = await session.get(Artigo, artigo_id)
    if artigo is None:
        return None
    if descricao is not None:
        artigo.descricao = descricao
    if categoria is not None:
        artigo.categoria = categoria
    if unidade is not None:
        artigo.unidade = unidade
    if stock_minimo is not None:
        artigo.stock_minimo = stock_minimo
    if localizacao is not None:
        artigo.localizacao = localizacao
    return artigo


async def eliminar_artigo(session: AsyncSession, artigo_id: str) -> bool:
    artigo = await session.get(Artigo, artigo_id)
    if artigo is None:
        return False
    await session.delete(artigo)
    return True
