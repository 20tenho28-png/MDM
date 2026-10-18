"""Leitura de registos de chamadas: XML do "SMS Backup & Restore" (Android) ou CSV."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime
from pathlib import Path

from ..datas import LX, ler_data
from ..modelo import Evento
from ..texto import chave_nome, duracao_segundos, norm, telefone_norm
from .tabelas import coluna, ler_tabela

# Tipos do Android: 1 recebida, 2 efetuada, 3 perdida, 4 correio de voz, 5 rejeitada, 6 bloqueada.
_TIPOS_ANDROID = {1: "chamada_atendida", 2: "chamada_saida", 3: "chamada_perdida", 4: "chamada_perdida",
                  5: "chamada_perdida"}


def _numeros(cfg: dict, chave: str) -> set[str]:
    return {t for t in (telefone_norm(x) for x in cfg[chave[0]][chave[1]]) if t}


def _evento(ts: datetime, numero: str, tipo: str, nome: str, duracao: int, origem: str) -> Evento:
    chaves = {f"tel:{numero}"}
    k = chave_nome(nome)
    if k:
        chaves.add(f"nome:{k}")
    return Evento(ts, "chamada", "saida" if tipo == "chamada_saida" else "entrada", tipo,
                  f"chamada:{origem}:{numero}:{int(ts.timestamp())}", nome=nome, chaves=chaves,
                  extra={"duracao": duracao})


def ler_xml(caminho: Path, cfg: dict, estat: Counter) -> list[Evento]:
    proprios = _numeros(cfg, ("empresa", "telefones"))
    ignorar = _numeros(cfg, ("chamadas", "ignorar"))
    eventos = []
    for c in ET.parse(caminho).getroot().iter("call"):
        estat["lidas"] += 1
        try:
            tipo_android = int(c.get("type", "0"))
            ts = datetime.fromtimestamp(int(c.get("date")) / 1000, LX)
        except (TypeError, ValueError):
            estat["ilegíveis"] += 1
            continue
        tipo = _TIPOS_ANDROID.get(tipo_android)
        numero = telefone_norm(c.get("number", ""))
        if tipo is None or not numero or numero in proprios or numero in ignorar:
            estat["ignoradas"] += 1
            continue
        nome = c.get("contact_name") or ""
        if norm(nome) in ("(unknown)", "unknown", "null", "desconhecido"):
            nome = ""
        eventos.append(_evento(ts, numero, tipo, nome, duracao_segundos(c.get("duration")), "xml"))
    return eventos


def ler_csv(caminho: Path, cfg: dict, estat: Counter) -> list[Evento]:
    c = cfg["chamadas"]
    proprios = _numeros(cfg, ("empresa", "telefones"))
    ignorar = _numeros(cfg, ("chamadas", "ignorar"))
    entrada = [norm(v) for v in c["valores_entrada"]]
    saida = [norm(v) for v in c["valores_saida"]]
    perdida = [norm(v) for v in c["valores_perdida"]]
    fixa = norm(c.get("direcao_fixa", ""))
    eventos = []
    for linha in ler_tabela(caminho):
        estat["lidas"] += 1
        ts = ler_data(f"{coluna(linha, c['coluna_data'])} {coluna(linha, c['coluna_hora'])}".strip())
        numero = telefone_norm(coluna(linha, c["coluna_numero"]))
        if ts is None or not numero:
            estat["ilegíveis"] += 1
            continue
        if numero in proprios or numero in ignorar:
            estat["ignoradas"] += 1
            continue
        tipo_txt = norm(coluna(linha, c["coluna_tipo"]))
        duracao = duracao_segundos(coluna(linha, c["coluna_duracao"]))
        if fixa == "saida" or (not fixa and any(v in tipo_txt for v in saida)):
            tipo = "chamada_saida"
        elif any(v in tipo_txt for v in perdida):
            tipo = "chamada_perdida"
        elif fixa == "entrada" or any(v in tipo_txt for v in entrada):
            tipo = "chamada_atendida" if duracao > 0 else "chamada_perdida"
        else:
            estat["tipo desconhecido"] += 1
            continue
        eventos.append(_evento(ts, numero, tipo, "", duracao, caminho.stem))
    return eventos
