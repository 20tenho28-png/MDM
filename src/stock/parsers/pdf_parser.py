"""PDF purchase-guide parser using pdfplumber.

PDF guides are usually printed tables, so we prefer ``extract_table()`` and
fall back to a regex over plain text when no table is detected.
"""
from __future__ import annotations

import io
import re

from stock.parsers.base import (
    LinhaGuia,
    ResultadoParse,
    construir_linha,
    mapear_cabecalho,
    parse_quantidade,
)

# Fallback: "<ref> <descrição...> <qtd>" on a single line.
_LINHA_RE = re.compile(r"^\s*(\S+)\s+(.+?)\s+([\d.,]+)\s*(\w+)?\s*$")


def parse(content: bytes) -> ResultadoParse:
    resultado = ResultadoParse()
    try:
        import pdfplumber
    except ImportError:  # pragma: no cover - dependency guard
        resultado.avisos.append("pdfplumber não está instalado; não é possível ler PDF.")
        return resultado

    try:
        pdf = pdfplumber.open(io.BytesIO(content))
    except Exception as exc:  # noqa: BLE001
        resultado.avisos.append(f"Não foi possível abrir o PDF: {exc}")
        return resultado

    encontrou_tabela = False
    with pdf:
        for page in pdf.pages:
            for tabela in page.extract_tables() or []:
                if _processar_tabela(tabela, resultado):
                    encontrou_tabela = True

        if not encontrou_tabela:
            for page in pdf.pages:
                texto = page.extract_text() or ""
                _processar_texto(texto, resultado)

    if not resultado.linhas and not resultado.avisos:
        resultado.avisos.append(
            "Não foi possível extrair linhas do PDF. Reveja e introduza manualmente."
        )
    return resultado


def _processar_tabela(tabela: list[list], resultado: ResultadoParse) -> bool:
    mapa = None
    encontrou = False
    for fila in tabela:
        celulas = ["" if c is None else str(c) for c in fila]
        if not any(c.strip() for c in celulas):
            continue
        if mapa is None:
            mapa = mapear_cabecalho(celulas)
            if mapa is None:
                continue
            encontrou = True
            continue
        linha, aviso = construir_linha(celulas, mapa)
        if linha is not None:
            resultado.linhas.append(linha)
        elif aviso:
            resultado.avisos.append(aviso)
    return encontrou


def _processar_texto(texto: str, resultado: ResultadoParse) -> None:
    for raw in texto.splitlines():
        m = _LINHA_RE.match(raw)
        if not m:
            continue
        referencia, descricao, qtd_raw, unidade = m.groups()
        quantidade = parse_quantidade(qtd_raw)
        if quantidade is None:
            continue
        resultado.linhas.append(
            LinhaGuia(
                referencia=referencia,
                descricao=descricao.strip(),
                quantidade=quantidade,
                unidade=(unidade or "un"),
            )
        )
