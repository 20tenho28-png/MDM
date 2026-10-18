"""Leitura da agenda do ERP (/erp/exportar/agenda.csv): uma linha por visita, com o relatório que a fechou.

Cada visita é um evento «agenda» do cliente (ligado pelo telefone, email, NIF ou número ORC), com as datas de cada
passo em `extra`: criada (passou a estar por marcar), marcada, feita (chegou o relatório), cancelada e, quando a obra
ficou à espera de peça, as datas da encomenda e da chegada. O modo sombra usa-as para os estados das visitas.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, time
from pathlib import Path

from ..datas import LX, ler_data
from ..modelo import Evento
from ..texto import chave_nome, email_norm, refs_orc, telefone_norm
from .tabelas import coluna, ler_tabela

_DATAS = ("criada_em", "marcada_em", "inicio", "feita_em", "cancelada_em")
_DIAS_PECA = ("peca_encomendada_em", "peca_recebida_em")


def _momento(valor, hora_padrao: time = time(9)) -> datetime | None:
    """«2026-10-20 11:05:00» (hora de Lisboa, como o ERP exporta) ou só a data."""
    texto = str(valor or "").strip()
    if not texto:
        return None
    try:
        dt = datetime.fromisoformat(texto)
    except ValueError:
        return ler_data(texto, hora_padrao=hora_padrao)
    if len(texto) == 10:
        dt = datetime.combine(dt.date(), hora_padrao)
    return dt.replace(tzinfo=LX) if dt.tzinfo is None else dt.astimezone(LX)


def ler_agenda(caminho: Path, cfg: dict, estat: Counter) -> list[Evento]:
    eventos = []
    for linha in ler_tabela(caminho):
        estat["linhas"] += 1
        datas = {k: _momento(coluna(linha, k)) for k in _DATAS}
        datas.update({k: _momento(coluna(linha, k), time(18)) for k in _DIAS_PECA})
        if datas["criada_em"] is None:
            estat["sem data de criação"] += 1
            continue
        estado = str(coluna(linha, "estado")).strip()
        if estado == "cancelada" or datas["cancelada_em"]:
            estat["canceladas (não contam)"] += 1
            continue
        chaves = set()
        tel = telefone_norm(coluna(linha, "telefone"))
        if tel:
            chaves.add(f"tel:{tel}")
        email = email_norm(coluna(linha, "email"))
        if email:
            chaves.add(f"email:{email}")
        nif = "".join(ch for ch in str(coluna(linha, "nif")) if ch.isdigit())
        if len(nif) == 9:
            chaves.add(f"nif:{nif}")
        nome = str(coluna(linha, "cliente")).strip()
        k = chave_nome(nome)
        if k:
            chaves.add(f"nome:{k}")
        referencia = str(coluna(linha, "referencia")).strip()
        if not chaves and not refs_orc(referencia):
            estat["sem identificação do cliente"] += 1
            continue
        visita = str(coluna(linha, "visita")).strip()
        eventos.append(Evento(
            datas["criada_em"], "agenda", None, "visita", f"agenda:{visita or estat['linhas']}", nome=nome,
            chaves=chaves, texto="", refs_orc=refs_orc(referencia), numero=visita,
            extra={"anterior": str(coluna(linha, "anterior")).strip(), "estado": estado,
                   "tipo_trabalho": str(coluna(linha, "tipo_trabalho")).strip(),
                   "resultado": str(coluna(linha, "resultado")).strip(), **datas}))
        estat["visitas"] += 1
        if datas["feita_em"]:
            estat["visitas feitas"] += 1
        if datas["peca_encomendada_em"]:
            estat["à espera de peça"] += 1
    return eventos
