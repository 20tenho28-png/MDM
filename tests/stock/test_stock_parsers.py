from __future__ import annotations

import io

from stock.parsers import parse_guia
from stock.parsers.base import ResultadoParse, parse_quantidade
from stock.parsers.pdf_parser import _processar_texto


def test_parse_quantidade_handles_pt_decimals():
    assert parse_quantidade("10") == 10
    assert parse_quantidade("1.234,00") == 1234
    assert parse_quantidade("2,5") == 2  # rounds to nearest int
    assert parse_quantidade("abc") is None
    assert parse_quantidade("") is None


def test_csv_semicolon_delimiter_and_aliases():
    conteudo = (
        "Referencia;Designacao;Qtd;Unidade\n"
        "CAB-2.5;Cabo H07V-K 2.5mm2;100;m\n"
        "DISJ-16;Disjuntor 16A;25;un\n"
    ).encode("utf-8")
    resultado = parse_guia("guia.csv", conteudo)
    assert len(resultado.linhas) == 2
    assert resultado.linhas[0].referencia == "CAB-2.5"
    assert resultado.linhas[0].descricao == "Cabo H07V-K 2.5mm2"
    assert resultado.linhas[0].quantidade == 100
    assert resultado.linhas[0].unidade == "m"
    assert resultado.linhas[1].referencia == "DISJ-16"


def test_csv_invalid_row_is_reported_not_applied():
    conteudo = (
        "ref,quantidade\n"
        "OK-1,5\n"
        "BAD-1,nao-numero\n"
    ).encode("utf-8")
    resultado = parse_guia("guia.csv", conteudo)
    refs = [linha.referencia for linha in resultado.linhas]
    assert refs == ["OK-1"]
    assert any("BAD-1" in aviso for aviso in resultado.avisos)


def test_csv_without_header_reports_warning():
    conteudo = b"isto;nao;tem;cabecalho\n1;2;3;4\n"
    resultado = parse_guia("guia.csv", conteudo)
    assert resultado.linhas == []
    assert resultado.avisos


def test_xlsx_parsing():
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.append(["Referencia", "Descricao", "Quantidade", "Unidade"])
    ws.append(["TUB-15", "Tubo cobre 15mm", 50, "m"])
    ws.append(["TUB-22", "Tubo cobre 22mm", 30, "m"])
    buffer = io.BytesIO()
    wb.save(buffer)

    resultado = parse_guia("guia.xlsx", buffer.getvalue())
    assert len(resultado.linhas) == 2
    assert resultado.linhas[0].referencia == "TUB-15"
    assert resultado.linhas[0].quantidade == 50


def test_unsupported_extension_warns():
    resultado = parse_guia("guia.txt", b"qualquer coisa")
    assert resultado.linhas == []
    assert any("não suportado" in a for a in resultado.avisos)


def test_pdf_text_fallback_regex():
    resultado = ResultadoParse()
    texto = "CAB-2.5 Cabo H07V-K 2.5mm2 100 m\nDISJ-16 Disjuntor 16A 25 un\n"
    _processar_texto(texto, resultado)
    assert len(resultado.linhas) == 2
    assert resultado.linhas[0].referencia == "CAB-2.5"
    assert resultado.linhas[0].quantidade == 100
