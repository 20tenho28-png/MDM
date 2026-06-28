"""CSV purchase-guide parser (stdlib only)."""
from __future__ import annotations

import csv
import io

from stock.parsers.base import (
    ResultadoParse,
    construir_linha,
    mapear_cabecalho,
)


def _decode(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def _detetar_delimitador(texto: str) -> str:
    amostra = "\n".join(texto.splitlines()[:5])
    try:
        return csv.Sniffer().sniff(amostra, delimiters=",;\t").delimiter
    except csv.Error:
        # PT exports commonly use ';'.
        return ";" if amostra.count(";") >= amostra.count(",") else ","


def parse(content: bytes) -> ResultadoParse:
    resultado = ResultadoParse()
    texto = _decode(content)
    if not texto.strip():
        resultado.avisos.append("Ficheiro CSV vazio.")
        return resultado

    delimitador = _detetar_delimitador(texto)
    linhas = list(csv.reader(io.StringIO(texto), delimiter=delimitador))

    mapa = None
    for fila in linhas:
        if not any(str(c).strip() for c in fila):
            continue
        if mapa is None:
            mapa = mapear_cabecalho(fila)
            if mapa is None:
                continue  # keep scanning until a header row is found
            continue
        linha, aviso = construir_linha(fila, mapa)
        if linha is not None:
            resultado.linhas.append(linha)
        elif aviso:
            resultado.avisos.append(aviso)

    if mapa is None:
        resultado.avisos.append(
            "Não foi encontrado cabeçalho com colunas 'referência' e 'quantidade'."
        )
    return resultado
