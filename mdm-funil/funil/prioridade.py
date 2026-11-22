"""Prioridades P1/P2/P3: regras atuais, regras derivadas do custo do atraso e teste em dados retidos."""

from __future__ import annotations

import math
from collections import defaultdict

from .caracteristicas import NOMES_TIPO
from .estatistica import logistica_por_segmento, logit, mediana, quantil, sigmoide, simular_normal, wilson
from .modelo import Pedido

CLASSES = ("P1", "P2", "P3")


def _cumpre(valor, esperado) -> bool:
    if isinstance(esperado, list):
        return valor in esperado
    if isinstance(esperado, str) and len(esperado) > 1 and esperado[0] in "<>":
        operador = esperado[:2] if esperado[1] == "=" else esperado[0]
        try:
            limite, v = float(esperado[len(operador):]), float(valor)
        except (TypeError, ValueError):
            return False
        return {">=": v >= limite, "<=": v <= limite, ">": v > limite, "<": v < limite}[operador]
    return valor == esperado


def aplicar_regras(caracteristicas: dict, cfg: dict) -> str:
    """Tabela de decisão da configuração: a primeira regra que bate decide."""
    pr = cfg["prioridade"]
    for regra in pr["regras"]:
        if all(_cumpre(caracteristicas.get(k), v) for k, v in regra.get("se", {}).items()):
            return regra["prioridade"]
    return pr.get("padrao", "P3")


def chave_segmento(p: Pedido, campos) -> tuple:
    return tuple(p.caracteristicas.get(c) for c in campos)


def rotulo_segmento(chave: tuple, campos) -> str:
    partes = []
    for campo, valor in zip(campos, chave):
        if campo == "tipo":
            partes.append(NOMES_TIPO.get(valor, str(valor)))
        elif campo == "empresa":
            partes.append("Empresa" if valor else "Particular")
        elif campo == "urgente":
            partes.append("Urgente" if valor else "Sem urgência")
        elif campo == "data_marcada":
            partes.append("Com prazo" if valor else "Sem prazo")
        elif campo == "canal":
            partes.append(str(valor).capitalize())
        else:
            partes.append(f"{campo}={valor}")
    return " · ".join(partes)


def custo_atraso(pedidos: list[Pedido], cfg: dict) -> tuple[list[dict], dict, dict | None]:
    """Quanto valor esperado se perde, por segmento, quando a primeira resposta é lenta.

    Ajusta uma regressão logística da probabilidade de ganhar em função dos dias úteis até à primeira resposta,
    com um nível e uma inclinação por segmento puxados para valores comuns (os segmentos pequenos ficam perto da
    média em vez de parecerem extremos por acaso). Custo do atraso = (P(ganhar) com resposta rápida -
    P(ganhar) com resposta lenta) x valor típico de um trabalho do segmento. Os intervalos vêm de simulações
    a partir da incerteza dos parâmetros.
    """
    pr = cfg["prioridade"]
    campos = pr["segmentar_por"]
    horas_dia = float(cfg["calendario"]["hora_fim"] - cfg["calendario"]["hora_inicio"])
    limite = float(pr["limite_horas"])
    # Os pedidos que nunca tiveram resposta entram com a espera máxima (são o caso mais lento de todos).
    base = [p for p in pedidos if p.incluir and p.maduro and p.t_contacto]
    if len(base) < pr["minimo_modelo"] or not any(p.ganho for p in base) or all(p.ganho for p in base):
        return [], {}, None

    def horas(p):
        return limite if p.h_resposta is None else min(p.h_resposta, limite)

    def x_de(h):
        return min(h, limite) / horas_dia

    grupos = defaultdict(list)
    for p in base:
        grupos[chave_segmento(p, campos)].append(p)
    chaves = sorted(grupos, key=repr)
    idx = {k: i for i, k in enumerate(chaves)}
    S = len(chaves)
    obs = [(idx[chave_segmento(p, campos)], x_de(horas(p)), int(p.ganho)) for p in base]
    taxa_geral = sum(y for _, _, y in obs) / len(obs)
    theta, cov = logistica_por_segmento(obs, S, logit(taxa_geral), pr["desvio_nivel"], pr["desvio_inclinacao"])
    amostras = simular_normal(theta, cov, int(pr["simulacoes"]))
    xr, xl = x_de(pr["horas_rapida"]), x_de(pr["horas_lenta"])

    def prob(th, s, x):
        return sigmoide(th[s] + (th[S] + th[S + 1 + s]) * x)

    # Valor típico do trabalho: mediana dos valores conhecidos (faturas ou orçamentos, ganhos ou não) do segmento;
    # com menos de 3, a do mesmo tipo de trabalho; depois, a geral.
    def valores_de(ps):
        return [p.valor for p in ps if p.valor]

    por_tipo = defaultdict(list)
    for p in base:
        por_tipo[p.caracteristicas.get("tipo")].append(p)
    valor_geral = mediana(valores_de(base)) or 1.0
    segmentos = []
    for chave in chaves:
        s, ps = idx[chave], grupos[chave]
        n, g = len(ps), sum(p.ganho for p in ps)
        valores = valores_de(ps)
        do_tipo = valores_de(por_tipo[ps[0].caracteristicas.get("tipo")])
        if len(valores) >= 3:
            valor, origem_valor = mediana(valores), ""
        elif len(do_tipo) >= 3:
            valor, origem_valor = mediana(do_tipo), "valor do tipo de trabalho"
        else:
            valor, origem_valor = valor_geral, "valor geral (mediana)"
        p_rapida, p_lenta = prob(theta, s, xr), prob(theta, s, xl)
        difs = [prob(th, s, xr) - prob(th, s, xl) for th in amostras]
        lo, hi = quantil(difs, 0.025), quantil(difs, 0.975)
        diferenca = p_rapida - p_lenta
        ajustada = sum(prob(theta, s, x_de(horas(p))) for p in ps) / n
        rap = [p for p in ps if p.h_resposta is not None and p.h_resposta <= pr["horas_rapida"]]
        len_ = [p for p in ps if horas(p) > pr["horas_lenta"]]
        segmentos.append({
            "chave": chave, "rotulo": rotulo_segmento(chave, campos),
            "n": n, "ganhos": g, "taxa": g / n, "ic": wilson(g, n),
            "p_rapida": p_rapida, "p_lenta": p_lenta, "diferenca": diferenca, "diferenca_ic": (lo, hi),
            "inclinacao": theta[S] + theta[S + 1 + s],
            "n_rapida": len(rap), "obs_rapida": (sum(p.ganho for p in rap) / len(rap)) if rap else None,
            "n_lenta": len(len_), "obs_lenta": (sum(p.ganho for p in len_) / len(len_)) if len_ else None,
            "valor": valor, "valor_estimado": bool(origem_valor), "origem_valor": origem_valor,
            "valor_esperado": ajustada * valor,
            "custo_atraso": max(0.0, diferenca) * valor,
            "custo_ic": (max(0.0, lo) * valor, max(0.0, hi) * valor),
            "poucos_dados": n < pr["minimo_segmento"],
        })

    # Efeito médio de um dia útil a mais de espera, com intervalo por simulação.
    def efeito_medio(th):
        return sum(prob(th, s, x) - prob(th, s, x + 1) for s, x, _ in obs) / len(obs)

    simulados = sorted(efeito_medio(th) for th in amostras)
    erro_b = math.sqrt(max(cov[S][S], 0.0))
    efeito = {
        "n": len(obs), "segmentos": S,
        "pp_por_dia": efeito_medio(theta),
        "pp_ic": (quantil(simulados, 0.025), quantil(simulados, 0.975)),
        "razao_odds_dia": math.exp(theta[S]),
        "razao_ic": (math.exp(theta[S] - 1.96 * erro_b), math.exp(theta[S] + 1.96 * erro_b)),
    }

    segmentos.sort(key=lambda s: (-s["custo_atraso"], -s["valor_esperado"], s["rotulo"]))
    total, acumulado, mapa = sum(s["n"] for s in segmentos), 0, {}
    q1, q12 = pr["quota_p1"], pr["quota_p1p2"]
    for i, s in enumerate(segmentos):
        # Cada segmento vai para a classe onde fica a maior parte dele (o primeiro é sempre P1).
        antes, depois = acumulado / total, (acumulado + s["n"]) / total
        dentro_p1 = max(0.0, min(depois, q1) - antes)
        dentro_p2 = max(0.0, min(depois, q12) - max(antes, q1))
        metade = (depois - antes) / 2
        if i == 0 or dentro_p1 >= metade:
            s["prioridade"] = "P1"
        elif dentro_p2 >= metade:
            s["prioridade"] = "P2"
        else:
            s["prioridade"] = "P3"
        s["pct_pedidos"] = s["n"] / total
        acumulado += s["n"]
        mapa[s["chave"]] = s["prioridade"]
    # Um segmento fora de P1 cujo intervalo chega ao custo do P1 mais baixo não está provado: só faltam dados.
    custos_p1 = [s["custo_atraso"] for s in segmentos if s["prioridade"] == "P1"]
    limiar = min(custos_p1) if custos_p1 else None
    for s in segmentos:
        s["incerto"] = bool(limiar and s["prioridade"] != "P1" and s["custo_ic"][1] >= limiar)
    return segmentos, mapa, efeito


def classificar(pedidos: list[Pedido], cfg: dict, mapa: dict) -> None:
    campos = cfg["prioridade"]["segmentar_por"]
    for p in pedidos:
        p.prioridade_atual = aplicar_regras(p.caracteristicas, cfg)
        p.prioridade_sugerida = mapa.get(chave_segmento(p, campos), "P3") if mapa else ""


def _avaliar(teste: list[Pedido], classe_de, cfg: dict) -> list[dict]:
    pr = cfg["prioridade"]
    valor_total = sum(p.valor or 0 for p in teste if p.ganho)
    linhas = []
    for c in CLASSES:
        g = [p for p in teste if classe_de(p) == c]
        ganhos = [p for p in g if p.ganho]
        valor = sum(p.valor or 0 for p in ganhos)
        rap = [p for p in g if p.h_resposta is not None and p.h_resposta <= pr["horas_rapida"]]
        len_ = [p for p in g if p.h_resposta is None or p.h_resposta > pr["horas_lenta"]]
        linhas.append({
            "classe": c, "n": len(g), "pct_pedidos": len(g) / len(teste) if teste else None,
            "ganhos": len(ganhos), "taxa": len(ganhos) / len(g) if g else None, "ic": wilson(len(ganhos), len(g)),
            "valor_ganho": valor, "pct_valor": valor / valor_total if valor_total else None,
            "n_rapida": len(rap), "taxa_rapida": (sum(p.ganho for p in rap) / len(rap)) if rap else None,
            "n_lenta": len(len_), "taxa_lenta": (sum(p.ganho for p in len_) / len(len_)) if len_ else None,
        })
    return linhas


def _tamanhos_teste(n: int, cfg: dict) -> tuple[int, int] | None:
    pr = cfg["prioridade"]
    n_teste = int(round(n * pr["fracao_teste"]))
    if n_teste < 15 or n - n_teste < pr["minimo_modelo"]:
        return None
    return n - n_teste, n_teste


def minimo_teste(cfg: dict) -> int:
    """Número mínimo de pedidos maduros para haver teste em dados retidos."""
    return next(n for n in range(1, 100000) if _tamanhos_teste(n, cfg))


def teste_retido(pedidos: list[Pedido], cfg: dict) -> dict | None:
    """Deriva as regras com os pedidos mais antigos e avalia-as nos mais recentes (que as regras não viram)."""
    pr = cfg["prioridade"]
    campos = pr["segmentar_por"]
    decididos = sorted((p for p in pedidos if p.incluir and p.maduro and p.t_contacto), key=lambda p: p.t_contacto)
    tamanhos = _tamanhos_teste(len(decididos), cfg)
    if not tamanhos:
        return None
    n_teste = tamanhos[1]
    treino, teste = decididos[:-n_teste], decididos[-n_teste:]
    _, mapa, _ = custo_atraso(treino, cfg)
    if not mapa:
        return None
    return {
        "n_treino": len(treino), "n_teste": len(teste),
        "inicio_teste": teste[0].t_contacto, "fim_teste": teste[-1].t_contacto,
        "fim_treino": treino[-1].t_contacto,
        "regras": {
            "Regra atual": _avaliar(teste, lambda p: aplicar_regras(p.caracteristicas, cfg), cfg),
            "Regra sugerida": _avaliar(teste, lambda p: mapa.get(chave_segmento(p, campos), "P3"), cfg),
        },
    }
