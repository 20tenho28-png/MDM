"""Leitura da lista de documentos emitidos (CSV ou Excel exportado do programa de faturação)."""

from __future__ import annotations

import re
from collections import Counter
from datetime import time
from pathlib import Path

from ..datas import ler_data
from ..modelo import Evento
from ..texto import chave_nome, email_norm, norm, numero, refs_orc, telefone_norm
from .tabelas import coluna, ler_tabela

_NIF_GENERICOS = {"999999990", "999999999", "000000000"}
_RE_TIPO = re.compile(r"^\s*([A-Za-z]{1,4})(?=[\s\-/.]|\d)")
# Nomes por extenso que alguns programas exportam na coluna do tipo.
_NOMES_TIPO = {"fatura-recibo": "FR", "fatura recibo": "FR", "fatura simplificada": "FS", "fatura pro-forma": "PF",
               "fatura proforma": "PF", "pro-forma": "PF", "proforma": "PF", "nota de credito": "NC",
               "nota de debito": "ND", "guia de transporte": "GT", "guia de remessa": "GR", "orcamento": "OR",
               "recibo": "RG", "fatura": "FT"}


def tipo_documento(linha: dict, c: dict) -> str:
    tipo = str(coluna(linha, c.get("coluna_tipo", ""))).strip()
    if tipo:
        t = norm(tipo)
        for nome in sorted(_NOMES_TIPO, key=len, reverse=True):
            if t.startswith(nome):
                return _NOMES_TIPO[nome]
        return re.split(r"[\s\-/.]", tipo.upper())[0]
    m = _RE_TIPO.match(str(coluna(linha, c["coluna_numero"])))
    return m.group(1).upper() if m else ""


def ler_faturas(caminho: Path, cfg: dict, estat: Counter) -> list[Evento]:
    c = cfg["faturas"]
    tipos_fatura = {t.upper() for t in c.get("tipos_fatura", ["FT", "FR", "FS"])}
    tipos_credito = {t.upper() for t in c.get("tipos_credito", ["NC"])}
    eventos = []
    for i, linha in enumerate(ler_tabela(caminho)):
        estat["linhas"] += 1
        tipo = tipo_documento(linha, c)
        if tipo and tipo not in tipos_fatura and tipo not in tipos_credito:
            estat[f"documentos {tipo} ignorados"] += 1
            continue
        if not tipo:
            estat["tipo de documento desconhecido (contado como fatura)"] += 1
        ts = ler_data(coluna(linha, c["coluna_data"]), hora_padrao=time(18))
        valor = numero(coluna(linha, c["coluna_valor"]))
        if ts is None or valor is None:
            estat["sem data ou valor"] += 1
            continue
        credito = tipo in tipos_credito or valor < 0
        if valor == 0:
            estat["valor zero"] += 1
            continue
        valor = -abs(valor) if credito else abs(valor)
        if c.get("valor_com_iva"):
            valor = valor / (1 + float(c.get("taxa_iva", 0.23)))
        cliente = str(coluna(linha, c["coluna_cliente"]))
        nif = re.sub(r"\D", "", str(coluna(linha, c["coluna_nif"])))
        num = str(coluna(linha, c["coluna_numero"]))
        descricao = str(coluna(linha, c["coluna_descricao"]))
        chaves = set()
        if len(nif) == 9 and nif not in _NIF_GENERICOS:
            chaves.add(f"nif:{nif}")
        k = chave_nome(cliente)
        if k:
            chaves.add(f"nome:{k}")
        tel = telefone_norm(coluna(linha, c["coluna_telefone"]))
        if tel:
            chaves.add(f"tel:{tel}")
        em = email_norm(coluna(linha, c["coluna_email"]))
        if em:
            chaves.add(f"email:{em}")
        refs = refs_orc(" ".join(str(v) for v in linha.values() if v))
        if not chaves and not refs:
            estat["sem identificação do cliente"] += 1
            continue
        eventos.append(Evento(ts, "fatura", None, "credito" if credito else "fatura", f"fatura:{num or i}:{ts.date()}",
                              nome=cliente, chaves=chaves, texto=descricao, refs_orc=refs, valor=valor, numero=num,
                              extra={"tipo_documento": tipo}))
        estat["notas de crédito" if credito else "faturas"] += 1
    return eventos
