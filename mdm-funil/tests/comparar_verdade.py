"""Compara os pedidos reconstruídos com a verdade do mundo de exemplo (usado pelos testes e para diagnóstico)."""

from __future__ import annotations

import csv
from datetime import datetime
from pathlib import Path


def ler_verdade(caminho: Path) -> list[dict]:
    with open(caminho, encoding="utf-8") as f:
        linhas = list(csv.DictReader(f))
    for l in linhas:
        for k in ("t_contacto", "t_resposta", "t_envio", "t_aceite", "t_recusa", "t_fatura"):
            l[k] = datetime.fromisoformat(l[k]) if l[k] else None
        l["ganho"] = l["ganho"] == "1"
        l["h_resposta"] = float(l["h_resposta"]) if l["h_resposta"] else None
        l["valor"] = float(l["valor"]) if l["valor"] else None
    return linhas


def emparelhar(verdade: list[dict], pedidos) -> tuple[list[tuple[dict, object]], list[dict]]:
    """Emparelha cada pedido verdadeiro com o pedido reconstruído com o mesmo contacto inicial (minuto e canal)."""
    por_chave = {}
    for p in pedidos:
        if p.t_contacto:
            por_chave.setdefault((p.t_contacto.replace(second=0).isoformat(), p.canal), []).append(p)
    pares, sem_par = [], []
    for v in verdade:
        chave = (v["t_contacto"].replace(second=0).isoformat(), v["canal"])
        candidatos = por_chave.get(chave, [])
        if len(candidatos) == 1:
            pares.append((v, candidatos[0]))
        else:
            sem_par.append(v)
    return pares, sem_par
