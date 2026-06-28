"""Purchase-guide lifecycle: upload -> parse -> review -> confirm."""
from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from stock.config import get_settings
from stock.models import Categoria, EstadoGuia, GuiaCompra
from stock.parsers import parse_guia
from stock.services import artigos as artigos_svc
from stock.services import stock as stock_svc


def _guardar_ficheiro(filename: str, content: bytes) -> str | None:
    """Persist the original guide file under upload_dir; return its path."""
    settings = get_settings()
    destino = Path(settings.upload_dir)
    try:
        destino.mkdir(parents=True, exist_ok=True)
        nome_unico = f"{uuid.uuid4().hex}_{Path(filename).name}"
        caminho = destino / nome_unico
        caminho.write_bytes(content)
        return str(caminho)
    except OSError:
        # Storing the original is best-effort; parsing still proceeds.
        return None


async def criar_guia_pendente(
    session: AsyncSession,
    *,
    filename: str,
    content: bytes,
    categoria: Categoria,
    fornecedor: str | None = None,
) -> GuiaCompra:
    """Parse a guide and store it as pending. Does NOT touch stock."""
    ficheiro_path = _guardar_ficheiro(filename, content)
    resultado = parse_guia(filename, content)

    linhas_raw = [
        {
            "referencia": linha.referencia,
            "descricao": linha.descricao,
            "quantidade": linha.quantidade,
            "unidade": linha.unidade,
        }
        for linha in resultado.linhas
    ]

    estado = EstadoGuia.pendente if linhas_raw else EstadoGuia.erro
    erro_msg = None
    if not linhas_raw:
        erro_msg = " ".join(resultado.avisos) or "Nenhuma linha reconhecida."

    guia = GuiaCompra(
        ficheiro_nome=filename,
        ficheiro_path=ficheiro_path,
        fornecedor=fornecedor or resultado.fornecedor,
        categoria=categoria,
        num_itens=len(linhas_raw),
        estado=estado,
        linhas_raw=linhas_raw,
        erro_msg=erro_msg,
    )
    session.add(guia)
    await session.flush()
    return guia


async def get_guia(session: AsyncSession, guia_id: str) -> GuiaCompra | None:
    return await session.get(GuiaCompra, guia_id)


async def listar_guias(session: AsyncSession) -> list[GuiaCompra]:
    result = await session.execute(
        select(GuiaCompra).order_by(GuiaCompra.created_at.desc())
    )
    return list(result.scalars().all())


async def confirmar_guia(session: AsyncSession, guia_id: str) -> GuiaCompra | None:
    """Apply a pending guide's lines as stock entries. Atomic and idempotent."""
    guia = await session.get(GuiaCompra, guia_id)
    if guia is None:
        return None
    if guia.estado == EstadoGuia.confirmada:
        return guia  # idempotent: already applied

    for linha in guia.linhas_raw or []:
        artigo, _ = await artigos_svc.get_or_create_por_referencia(
            session,
            referencia=str(linha["referencia"]),
            descricao=str(linha.get("descricao", "")),
            categoria=guia.categoria,
            unidade=str(linha.get("unidade", "un")),
        )
        await stock_svc.registar_entrada(
            session,
            artigo=artigo,
            quantidade=int(linha["quantidade"]),
            origem="guia",
            guia_id=guia.id,
        )

    guia.estado = EstadoGuia.confirmada
    await session.flush()
    return guia
