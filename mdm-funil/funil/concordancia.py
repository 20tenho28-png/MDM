"""Amostra cega para duas pessoas classificarem P1/P2/P3 e comparação das classificações (kappa de Cohen)."""

from __future__ import annotations

import csv
import random
from collections import Counter, defaultdict
from pathlib import Path

from .estatistica import intervalo_bootstrap, kappa, kappa_ponderado, leitura_kappa
from .fontes.tabelas import ler_tabela
from .modelo import Pedido
from .prioridade import CLASSES
from .texto import norm

COLUNAS = ["id", "data", "canal", "mensagem", "prioridade", "nota"]


def gerar_amostra(pedidos: list[Pedido], n: int = 40, semente: int = 11, excluir=()) -> list[Pedido]:
    """Pedidos com texto do primeiro contacto, variados por canal e tipo, por ordem aleatória.

    excluir: ids que já foram classificados numa amostra anterior (uma amostra nova usa outros pedidos)."""
    excluir = set(excluir)
    candidatos = [p for p in pedidos if p.incluir and p.t_contacto and p.texto_inicial.strip() and p.id not in excluir]
    grupos = defaultdict(list)
    for p in candidatos:
        grupos[(p.canal, p.caracteristicas.get("tipo"))].append(p)
    rng = random.Random(semente)
    for chave in sorted(grupos):
        rng.shuffle(grupos[chave])
    escolhidos = []
    while len(escolhidos) < n and any(grupos.values()):
        for chave in sorted(grupos):
            if grupos[chave] and len(escolhidos) < n:
                escolhidos.append(grupos[chave].pop())
    rng.shuffle(escolhidos)
    return escolhidos


def escrever_amostra(amostra: list[Pedido], caminho: Path) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(COLUNAS)
        for p in amostra:
            texto = " ".join(p.texto_inicial.split())
            w.writerow([p.id, f"{p.t_contacto:%d/%m/%Y %H:%M}", p.canal, texto, "", ""])


def _classe(valor) -> str | None:
    v = norm(valor).replace(" ", "").upper()
    if v in ("1", "2", "3"):
        v = "P" + v
    return v if v in CLASSES else None


def ler_classificacoes(caminho: Path) -> dict[str, str]:
    return {str(l.get("id", "")).strip(): c for l in ler_tabela(caminho) if (c := _classe(l.get("prioridade")))}


def comparar(a: dict[str, str], b: dict[str, str], pedidos: list[Pedido]) -> dict:
    por_id = {p.id: p for p in pedidos}
    comuns = sorted(set(a) & set(b))
    x = [a[i] for i in comuns]
    y = [b[i] for i in comuns]

    def resumo(u, v):
        k = kappa(u, v)
        return {"kappa": k, "ic": intervalo_bootstrap(u, v), "kappa_ponderado": kappa_ponderado(u, v),
                "leitura": leitura_kappa(k), "acordo": (sum(i == j for i, j in zip(u, v)) / len(u)) if u else None}

    atual = [por_id[i].prioridade_atual for i in comuns if i in por_id]
    sugerida = [por_id[i].prioridade_sugerida for i in comuns if i in por_id]
    com_pedido = [i for i in comuns if i in por_id]
    xa = [a[i] for i in com_pedido]
    yb = [b[i] for i in com_pedido]
    matriz = Counter(zip(x, y))
    desacordos = [{"id": i, "a": a[i], "b": b[i], "mensagem": por_id[i].texto_inicial[:300] if i in por_id else ""}
                  for i in comuns if a[i] != b[i]]
    return {
        "n": len(comuns),
        "pessoas": resumo(x, y),
        "a_vs_regra_atual": resumo(xa, atual) if atual else None,
        "b_vs_regra_atual": resumo(yb, atual) if atual else None,
        "a_vs_regra_sugerida": resumo(xa, sugerida) if any(sugerida) else None,
        "b_vs_regra_sugerida": resumo(yb, sugerida) if any(sugerida) else None,
        "matriz": {f"{i}/{j}": matriz[(i, j)] for i in CLASSES for j in CLASSES},
        "desacordos": desacordos,
    }
