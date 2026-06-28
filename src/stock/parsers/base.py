"""Common parsing contract and dispatch for purchase guides.

A *guia de compras* can arrive as CSV, Excel (.xlsx) or PDF. Each concrete
parser turns the raw bytes into a :class:`ResultadoParse` holding normalised
:class:`LinhaGuia` rows plus a list of human-readable warnings (``avisos``).
Invalid rows are skipped and reported rather than raising, so a messy file
never silently corrupts stock.
"""
from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path


@dataclass
class LinhaGuia:
    referencia: str
    descricao: str
    quantidade: int
    unidade: str


@dataclass
class ResultadoParse:
    linhas: list[LinhaGuia] = field(default_factory=list)
    fornecedor: str | None = None
    data_guia: date | None = None
    avisos: list[str] = field(default_factory=list)


# Column-name aliases (normalised: lowercase, no accents) -> canonical field.
COLUNA_ALIASES: dict[str, str] = {
    "referencia": "referencia",
    "ref": "referencia",
    "artigo": "referencia",
    "codigo": "referencia",
    "cod": "referencia",
    "descricao": "descricao",
    "designacao": "descricao",
    "descritivo": "descricao",
    "quantidade": "quantidade",
    "qtd": "quantidade",
    "qtde": "quantidade",
    "qty": "quantidade",
    "unidade": "unidade",
    "un": "unidade",
    "uni": "unidade",
}


def normalizar(texto: str) -> str:
    """Lowercase and strip accents/whitespace for robust header matching."""
    if texto is None:
        return ""
    sem_acentos = "".join(
        c
        for c in unicodedata.normalize("NFKD", str(texto))
        if not unicodedata.combining(c)
    )
    return sem_acentos.strip().lower()


def mapear_cabecalho(celulas: list[str]) -> dict[str, int] | None:
    """Map a header row to column indices. Returns None if no ref+qtd found."""
    mapa: dict[str, int] = {}
    for idx, celula in enumerate(celulas):
        chave = COLUNA_ALIASES.get(normalizar(celula))
        if chave and chave not in mapa:
            mapa[chave] = idx
    if "referencia" in mapa and "quantidade" in mapa:
        return mapa
    return None


def parse_quantidade(valor) -> int | None:
    """Parse a quantity cell to a positive int, tolerating PT decimals.

    Returns None when the value is not a usable number. Decimals are rounded
    to the nearest integer (stock is tracked in whole units).
    """
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    # Portuguese thousands/decimals: "1.234,50" -> "1234.50"
    texto = texto.replace(" ", "")
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        numero = float(texto)
    except ValueError:
        return None
    return int(round(numero))


def construir_linha(
    valores: list[str], mapa: dict[str, int]
) -> tuple[LinhaGuia | None, str | None]:
    """Build a LinhaGuia from a row; returns (linha, aviso)."""
    def get(campo: str) -> str:
        idx = mapa.get(campo)
        if idx is None or idx >= len(valores):
            return ""
        return str(valores[idx] or "").strip()

    referencia = get("referencia")
    if not referencia:
        return None, None  # blank row, ignore silently

    quantidade = parse_quantidade(get("quantidade"))
    if quantidade is None:
        return None, f"Linha ignorada (quantidade inválida) para '{referencia}'."

    return (
        LinhaGuia(
            referencia=referencia,
            descricao=get("descricao"),
            quantidade=quantidade,
            unidade=get("unidade") or "un",
        ),
        None,
    )


def parse_guia(filename: str, content: bytes) -> ResultadoParse:
    """Dispatch to the right parser based on file extension."""
    from stock.parsers import csv_parser, excel_parser, pdf_parser

    ext = Path(filename).suffix.lower()
    if ext == ".csv":
        return csv_parser.parse(content)
    if ext in (".xlsx", ".xlsm"):
        return excel_parser.parse(content)
    if ext == ".pdf":
        return pdf_parser.parse(content)
    return ResultadoParse(
        avisos=[f"Formato não suportado: '{ext}'. Use CSV, XLSX ou PDF."]
    )
