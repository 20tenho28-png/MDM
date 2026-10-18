"""Linha de base do funil: volumes, tempos por etapa, velocidade de resposta, gargalo e motivos de perda."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, timedelta

from .datas import Calendario, dias_entre, fim_do_dia, segunda
from .estatistica import media, mediana, quantil, wilson
from .modelo import Pedido

CANAIS = {"email": "Email", "whatsapp": "WhatsApp", "chamada": "Telefone", "site": "Site",
          "desconhecido": "Sem registo do contacto"}


def incluidos(pedidos: list[Pedido]) -> list[Pedido]:
    return [p for p in pedidos if p.incluir]


def janela(pedidos: list[Pedido]):
    """Início e fim do período, medidos pelos contactos dos clientes (um documento mal datado não o estica)."""
    ps = incluidos(pedidos)
    contactos = [p.t_contacto for p in ps if p.t_contacto]
    datas = contactos or [p.t_inicio for p in ps]
    return (min(datas), max(datas)) if datas else (None, None)


def _taxa(k: int, n: int):
    return (k / n if n else None), wilson(k, n)


def funil(pedidos: list[Pedido]) -> list[dict]:
    ps_todos = incluidos(pedidos)
    grupos = defaultdict(list)
    for p in ps_todos:
        grupos[p.canal].append(p)
    linhas = []
    for canal in [c for c in CANAIS if c in grupos] + ["total"]:
        ps = ps_todos if canal == "total" else grupos[canal]
        com_contacto = [p for p in ps if p.t_contacto]
        maduros = [p for p in ps if p.maduro]
        ganhos = [p for p in maduros if p.ganho]
        orc_maduros = [p for p in maduros if p.orc]
        orc_ganhos = [p for p in orc_maduros if p.ganho]
        taxa, ic = _taxa(len(ganhos), len(maduros))
        taxa_orc, ic_orc = _taxa(len(orc_ganhos), len(orc_maduros))
        linhas.append({
            "canal": "Total" if canal == "total" else CANAIS[canal],
            "pedidos": len(ps),
            "com_contacto": len(com_contacto),
            "respondidos": sum(1 for p in com_contacto if p.t_resposta),
            "com_orcamento": sum(1 for p in ps if p.orc),
            "decididos": len(maduros),
            "ganhos": len(ganhos),
            "taxa_ganho": taxa, "ic_ganho": ic,
            "orc_decididos": len(orc_maduros),
            "taxa_ganho_orc": taxa_orc, "ic_ganho_orc": ic_orc,
            "valor_ganho": sum(p.valor or 0 for p in ps if p.ganho),
        })
    return linhas


def tempos(pedidos: list[Pedido], cal: Calendario) -> list[dict]:
    ps = incluidos(pedidos)
    etapas = [
        ("Contacto até à 1.ª resposta", "horas úteis",
         [p.h_resposta for p in ps if p.h_resposta is not None]),
        ("1.ª resposta até ao orçamento enviado", "dias úteis",
         [cal.dias_uteis(p.t_resposta, p.t_envio) for p in ps if p.t_resposta and p.t_envio and p.t_envio >= p.t_resposta]),
        ("Orçamento enviado até à decisão do cliente", "dias",
         [dias_entre(p.t_envio, p.t_decisao) for p in ps if p.t_envio and p.t_decisao and p.t_decisao >= p.t_envio]),
        ("Aceite até à fatura (execução)", "dias",
         [dias_entre(p.t_aceite, p.t_fatura) for p in ps if p.t_aceite and p.t_fatura and p.t_fatura >= p.t_aceite]),
        ("Contacto até à fatura (todos os trabalhos faturados)", "dias",
         [dias_entre(p.t_contacto, p.t_fatura) for p in ps if p.t_contacto and p.t_fatura and p.t_fatura >= p.t_contacto]),
    ]
    return [{"etapa": nome, "unidade": unidade, "n": len(v), "mediana": mediana(v), "p80": quantil(v, 0.8)}
            for nome, unidade, v in etapas]


def faixas(horas_dia: float) -> list[tuple]:
    return [(None, 1, "até 1 hora útil"), (1, 4, "1 a 4 horas úteis"), (4, horas_dia, "4 horas a 1 dia útil"),
            (horas_dia, 3 * horas_dia, "1 a 3 dias úteis"), (3 * horas_dia, None, "mais de 3 dias úteis")]


def velocidade(pedidos: list[Pedido], cal: Calendario) -> list[dict]:
    """Taxa de ganho conforme o tempo até à primeira resposta (só pedidos maduros)."""
    base = [p for p in incluidos(pedidos) if p.maduro and p.t_contacto]
    linhas = []
    for lo, hi, rotulo in faixas(cal.horas_dia):
        g = [p for p in base if p.h_resposta is not None
             and (lo is None or p.h_resposta > lo) and (hi is None or p.h_resposta <= hi)]
        k = sum(p.ganho for p in g)
        taxa, ic = _taxa(k, len(g))
        linhas.append({"faixa": rotulo, "n": len(g), "ganhos": k, "taxa": taxa, "ic": ic})
    g = [p for p in base if p.h_resposta is None]
    k = sum(p.ganho for p in g)
    taxa, ic = _taxa(k, len(g))
    linhas.append({"faixa": "sem resposta", "n": len(g), "ganhos": k, "taxa": taxa, "ic": ic})
    return linhas


def esperas(pedidos: list[Pedido], cal: Calendario, hoje: date) -> dict:
    """Quantos pedidos esperaram mais de um dia útil pela 1.ª resposta, contando os que nunca a tiveram."""
    agora = fim_do_dia(hoje)
    base = [p for p in incluidos(pedidos) if p.t_contacto and cal.horas_uteis(p.t_contacto, agora) > cal.horas_dia]
    lentos = [p for p in base if p.h_resposta is None or p.h_resposta > cal.horas_dia]
    sem = [p for p in base if p.t_resposta is None]
    return {"n": len(base), "mais_de_um_dia": len(lentos) / len(base) if base else None,
            "sem_resposta": len(sem) / len(base) if base else None}


ETAPAS = (("À espera da 1.ª resposta", "MDM"), ("Respondido, sem orçamento", "MDM"),
          ("Orçamento à espera do cliente", "cliente"), ("Aceite, à espera de execução", "MDM"))


def gargalo(pedidos: list[Pedido], cfg: dict, hoje: date) -> dict:
    """Lei de Little por etapa: média de pedidos parados em cada etapa, entradas por semana e tempo médio."""
    ps = incluidos(pedidos)
    inicio, _ = janela(pedidos)
    if not ps or inicio is None:
        return {"etapas": [], "inicio": None, "dias": 0, "maior_fila": None, "silenciosos": 0}
    agora = fim_do_dia(hoje)
    dias = max(1.0, dias_entre(inicio, agora))
    sem_orc = timedelta(days=cfg["pedidos"]["dias_sem_orcamento"])
    decisao = timedelta(days=cfg["pedidos"]["dias_decisao"])
    fatura = timedelta(days=cfg["pedidos"]["dias_fatura"])
    itens = {nome: [] for nome, _ in ETAPAS}
    silenciosos = 0
    for p in ps:
        if p.t_contacto:
            fim = p.t_resposta or min(p.t_contacto + sem_orc, agora)
            itens[ETAPAS[0][0]].append((p.t_contacto, fim, p.t_resposta is not None))
        if p.t_resposta:
            seguinte = min([t for t in (p.t_envio, p.t_fatura) if t and t >= p.t_resposta], default=None)
            ultimo = max([e.ts for e in p.eventos if e.ts >= p.t_resposta and e.fonte != "orc"], default=p.t_resposta)
            if seguinte:
                fim = seguinte
            elif agora - ultimo <= sem_orc:
                fim = agora                      # conversa ainda ativa: pode vir a ter orçamento
            else:
                # Respondido e nunca orçamentado: termina no último contacto (um mínimo), não no fim do prazo.
                fim = ultimo
            itens[ETAPAS[1][0]].append((p.t_resposta, fim, seguinte is not None))
        if p.t_envio:
            dec = p.t_decisao if p.t_decisao and p.t_decisao >= p.t_envio else None
            if dec:
                fim = dec
            elif agora - p.t_envio <= decisao:
                fim = agora                      # ainda dentro do prazo: está mesmo à espera
            else:
                # Orçamento que ficou sem resposta: termina no último contacto, não no fim do prazo.
                silenciosos += 1
                fim = max([e.ts for e in p.eventos if e.ts >= p.t_envio and e.fonte != "orc"], default=p.t_envio)
            itens[ETAPAS[2][0]].append((p.t_envio, fim, bool(p.t_aceite or (p.t_fatura and p.t_fatura >= p.t_envio))))
        if p.t_aceite:
            feito = p.t_fatura if p.t_fatura and p.t_fatura >= p.t_aceite else None
            itens[ETAPAS[3][0]].append((p.t_aceite, feito or min(p.t_aceite + fatura, agora), feito is not None))
    linhas = []
    for nome, lado in ETAPAS:
        lista = itens[nome]
        tempo = sum(max(0.0, dias_entre(max(a, inicio), min(b, agora))) for a, b, _ in lista)
        em_curso = [x for x in lista if x[1] >= agora and not x[2]]
        terminados = [x for x in lista if not (x[1] >= agora and not x[2])]
        duracoes = [dias_entre(a, b) for a, b, _ in lista if b >= a]
        linhas.append({
            "etapa": nome, "lado": lado,
            "entradas": len(lista),
            "entradas_semana": len(lista) / dias * 7,
            "tempo_medio": media(duracoes),
            "tempo_mediano": mediana(duracoes),
            "em_fila_media": tempo / dias,
            "em_fila_agora": len(em_curso),
            "terminados": len(terminados),
            "sairam_sem_avancar": (sum(1 for x in terminados if not x[2]) / len(terminados)) if terminados else None,
        })
    da_mdm = [l for l in linhas if l["lado"] == "MDM"]
    maior = max(da_mdm, key=lambda l: l["em_fila_media"])
    return {"etapas": linhas, "inicio": inicio, "dias": dias, "silenciosos": silenciosos,
            "maior_fila": maior["etapa"] if maior["em_fila_media"] > 0 else None}


_MOTIVO_POR_RESULTADO = {"em_aberto": "orçamento ainda sem resposta", "novo": "ainda sem orçamento"}


def motivos(pedidos: list[Pedido]) -> list[dict]:
    contagem = Counter(p.motivo or _MOTIVO_POR_RESULTADO.get(p.resultado, "sem motivo registado")
                       for p in incluidos(pedidos) if p.maduro and not p.ganho)
    total = sum(contagem.values())
    return [{"motivo": m, "n": n, "pct": n / total} for m, n in contagem.most_common()]


def semanal(pedidos: list[Pedido], cfg: dict, cal: Calendario, hoje: date) -> list[dict]:
    ps = incluidos(pedidos)
    inicio, _ = janela(pedidos)
    if not ps or inicio is None:
        return []
    agora = fim_do_dia(hoje)
    objetivo = cfg["semanal"]["objetivo_resposta_horas"]
    limite = float(cfg["prioridade"]["limite_horas"])
    semanas = {}
    s, ultima = segunda(inicio), segunda(hoje)
    while s <= ultima:
        semanas[s] = {"pedidos": 0, "respostas": [], "com_contacto": 0, "no_objetivo": 0, "orcamentos": 0,
                      "ganhos": 0, "valor_ganho": 0.0}
        s += timedelta(days=7)

    def semana(t):
        return semanas.get(segunda(t)) if t else None

    for p in ps:
        if (w := semana(p.t_contacto or p.t_inicio)) is not None:
            w["pedidos"] += 1
        if (w := semana(p.t_contacto)) is not None:
            w["com_contacto"] += 1
            if p.h_resposta is not None:
                w["respostas"].append(p.h_resposta)
                w["no_objetivo"] += p.h_resposta <= objetivo
            else:
                # Sem resposta: conta o tempo já passado (até ao limite), para não desaparecer da mediana.
                w["respostas"].append(min(cal.horas_uteis(p.t_contacto, agora), limite))
        if (w := semana(p.t_envio)) is not None:
            w["orcamentos"] += 1
        if (w := semana(p.t_ganho)) is not None:
            w["ganhos"] += 1
            w["valor_ganho"] += p.valor or 0
    return [{
        "semana": s,
        "pedidos": w["pedidos"],
        "mediana_resposta": mediana(w["respostas"]),
        "pct_objetivo": (w["no_objetivo"] / w["com_contacto"]) if w["com_contacto"] else None,
        "orcamentos": w["orcamentos"],
        "ganhos": w["ganhos"],
        "valor_ganho": w["valor_ganho"],
        "parcial": s + timedelta(days=6) > hoje,
    } for s, w in sorted(semanas.items())]
