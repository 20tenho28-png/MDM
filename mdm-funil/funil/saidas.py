"""Ficheiros de saída (CSV para Excel) e ficheiros de revisão manual."""

from __future__ import annotations

import csv
from pathlib import Path

from .caracteristicas import NOMES_TIPO
from .fontes.tabelas import ler_tabela
from .modelo import Pedido

COLUNAS_REVISAO_AUTO = ["id", "data", "canal", "nome", "confianca", "resultado_calculado", "decisao_detetada", "resumo"]
COLUNAS_REVISAO_MANUAL = ["incluir", "tipo", "empresa", "resultado", "motivo", "nota"]


def _f(t) -> str:
    return t.strftime("%Y-%m-%d %H:%M") if t else ""


def _n(v, casas=2) -> str:
    return "" if v is None else f"{v:.{casas}f}".replace(".", ",")


def _escrever(caminho: Path, cabecalho: list[str], linhas) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    with open(caminho, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(cabecalho)
        for l in linhas:
            w.writerow(l)


def escrever_pedidos(pedidos: list[Pedido], caminho: Path) -> None:
    cab = ["id", "incluir", "confianca", "revisto", "cliente", "nome", "canal", "contacto", "primeira_resposta",
           "horas_uteis_resposta", "orc", "orcamento_enviado", "envio_confirmado", "valor_orc", "aceite", "recusa", "motivo", "fatura",
           "valor_fatura", "resultado", "maduro", "ganho", "tipo", "empresa", "urgente", "data_marcada", "unidades",
           "prioridade_atual", "prioridade_sugerida", "eventos", "fontes", "texto_inicial"]
    linhas = []
    for p in pedidos:
        c = p.caracteristicas
        linhas.append([
            p.id, "S" if p.incluir else "N", p.confianca, "S" if p.revisto else "", p.cliente, p.nome, p.canal,
            _f(p.t_contacto), _f(p.t_resposta), _n(p.h_resposta), p.orc, _f(p.t_envio),
            ("S" if p.envio_confirmado else "N") if p.t_envio else "", _n(p.valor_orc), _f(p.t_aceite),
            _f(p.t_recusa), p.motivo, _f(p.t_fatura), _n(p.valor_fatura), p.resultado, "S" if p.maduro else "N",
            "S" if p.ganho else "N", c.get("tipo", ""), "S" if c.get("empresa") else "N", "S" if c.get("urgente") else "N",
            "S" if c.get("data_marcada") else "N", c.get("unidades", ""), p.prioridade_atual, p.prioridade_sugerida,
            len(p.eventos), ",".join(sorted({e.fonte for e in p.eventos})), " ".join(p.texto_inicial.split())[:300],
        ])
    _escrever(caminho, cab, linhas)


def atualizar_revisao(pedidos: list[Pedido], caminho: Path) -> int:
    """Cria ou atualiza revisao/pedidos.csv sem apagar o que foi escrito à mão. Devolve quantos pedidos são novos."""
    existentes = {str(l.get("id", "")).strip(): l for l in (ler_tabela(caminho) if caminho.exists() else [])}
    novos = 0
    linhas = []
    vistos = set()
    for p in pedidos:
        antigo = existentes.get(p.id, {})
        if not antigo:
            novos += 1
        vistos.add(p.id)
        decisao = ""
        if p.decisao_ambigua and not (p.t_aceite or p.t_recusa):
            decisao = "ambígua: " + " ".join(p.decisao_texto.split())[:120]
        elif p.t_aceite or p.t_recusa:
            decisao = ("aceite: " if p.t_aceite else f"recusa ({p.motivo}): ") + " ".join(p.decisao_texto.split())[:120]
        auto = [p.id, f"{p.t_inicio:%d/%m/%Y}", p.canal, p.nome, p.confianca, p.resultado, decisao,
                " ".join(p.texto_inicial.split())[:160]]
        linhas.append(auto + [antigo.get(c, "") or "" for c in COLUNAS_REVISAO_MANUAL])
    for i, l in existentes.items():
        if i and i not in vistos and any(l.get(c) for c in COLUNAS_REVISAO_MANUAL):
            linhas.append([i, "", "", "", "", "pedido já não existe", "", ""] +
                          [l.get(c, "") or "" for c in COLUNAS_REVISAO_MANUAL])
    _escrever(caminho, COLUNAS_REVISAO_AUTO + COLUNAS_REVISAO_MANUAL, linhas)
    return novos


def garantir_ligacoes(caminho: Path) -> None:
    if not caminho.exists():
        _escrever(caminho, ["chave_a", "chave_b", "nota"], [])


def escrever_ligacoes(ligacoes: list[dict], partilhados: set, caminho: Path) -> None:
    linhas = [[l["situacao"], l["nome"], l["detalhe"]] for l in ligacoes]
    linhas += [["contacto ligado a clientes diferentes (técnico, parceiro): ignorado", k,
                "se for de um só cliente, escreve-o em [pedidos] nunca_partilhados no config.toml"]
               for k in sorted(partilhados)]
    _escrever(caminho, ["situacao", "nome", "detalhe"], linhas)


def escrever_segmentos(segmentos: list[dict], caminho: Path) -> None:
    cab = ["segmento", "pedidos_maduros", "ganhos", "taxa_ganho", "modelo_ganho_resposta_rapida",
           "modelo_ganho_resposta_lenta", "diferenca", "diferenca_ic_inf", "diferenca_ic_sup", "observado_rapida",
           "n_rapida", "observado_lenta", "n_lenta", "valor_tipico", "origem_valor", "valor_esperado",
           "custo_atraso", "custo_ic_inf", "custo_ic_sup", "prioridade_sugerida", "poucos_dados", "incerto"]
    _escrever(caminho, cab, [[s["rotulo"], s["n"], s["ganhos"], _n(s["taxa"], 3), _n(s["p_rapida"], 3),
                              _n(s["p_lenta"], 3), _n(s["diferenca"], 3), _n(s["diferenca_ic"][0], 3),
                              _n(s["diferenca_ic"][1], 3), _n(s["obs_rapida"], 3), s["n_rapida"],
                              _n(s["obs_lenta"], 3), s["n_lenta"], _n(s["valor"]),
                              s["origem_valor"] or "mediana do segmento", _n(s["valor_esperado"]), _n(s["custo_atraso"]),
                              _n(s["custo_ic"][0]), _n(s["custo_ic"][1]), s["prioridade"],
                              "S" if s["poucos_dados"] else "N", "S" if s.get("incerto") else "N"] for s in segmentos])


def escrever_semanal(semanal: list[dict], caminho: Path) -> None:
    cab = ["semana", "pedidos", "mediana_horas_resposta", "pct_no_objetivo", "orcamentos", "ganhos", "valor_ganho", "parcial"]
    _escrever(caminho, cab, [[f"{s['semana']:%Y-%m-%d}", s["pedidos"], _n(s["mediana_resposta"]),
                              _n(s["pct_objetivo"], 3), s["orcamentos"], s["ganhos"], _n(s["valor_ganho"]),
                              "S" if s["parcial"] else "N"] for s in semanal])


def escrever_teste(teste: dict | None, caminho: Path) -> None:
    if not teste:
        _escrever(caminho, ["aviso"], [["dados insuficientes para o teste"]])
        return
    cab = ["regra", "classe", "pedidos", "pct_pedidos", "ganhos", "taxa_ganho", "valor_ganho", "pct_valor",
           "taxa_rapida", "n_rapida", "taxa_lenta", "n_lenta"]
    linhas = []
    for nome, classes in teste["regras"].items():
        for c in classes:
            linhas.append([nome, c["classe"], c["n"], _n(c["pct_pedidos"], 3), c["ganhos"], _n(c["taxa"], 3),
                           _n(c["valor_ganho"]), _n(c["pct_valor"], 3), _n(c["taxa_rapida"], 3), c["n_rapida"],
                           _n(c["taxa_lenta"], 3), c["n_lenta"]])
    _escrever(caminho, cab, linhas)


def nome_tipo(t: str) -> str:
    return NOMES_TIPO.get(t, t)
