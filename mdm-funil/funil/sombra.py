"""Modo sombra: aplica as regras de estados e prazos ao histórico, antes de as usar no dia a dia.

Os estados vêm dos pedidos reconstruídos pelo funil. Sem calendário de visitas, folhas de obra nem emails de compras,
a visita fica dentro de "orçamento por fazer" (antes do orçamento) ou de "em execução" (depois do sim), e a espera de
peças dentro de "em execução". Quando esses dados existirem, os estados separam-se.

Responde a três perguntas, por esta ordem:
1. Quanto tempo fica hoje cada pedido em cada estado (percentis por P e por tipo de trabalho)?
2. Com os prazos, quantos pedidos teriam ficado vermelhos? O vermelho teria avisado a tempo dos pedidos que se perderam
   e dos clientes que cobraram?
3. Os prazos são possíveis com a equipa que existe? (lei de Little, e a mesma capacidade com a ordem por P)
"""

from __future__ import annotations

import heapq
import math
import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import TYPE_CHECKING

from .datas import LX, Calendario, dias_entre, fim_do_dia, local
from .estatistica import quantil
from .modelo import Pedido
from .texto import contem, preparado

if TYPE_CHECKING:
    from .motor import Resultado

CLASSES = ("P1", "P2", "P3")
_ORDEM = {"P1": 0, "P2": 1, "P3": 2}
_PONTUACAO = re.compile(r"[^\w\s]")


@dataclass(frozen=True)
class Estado:
    chave: str      # nome na secção [prazos] da configuração
    nome: str
    bola: str       # MDM, cliente ou fornecedor
    unidade: str    # horas úteis, dias úteis ou dias


# Os estados que os dados de hoje já permitem medir.
ESTADOS = (
    Estado("novo", "Novo", "MDM", "horas úteis"),
    Estado("orcamento_por_fazer", "Orçamento por fazer", "MDM", "dias úteis"),
    Estado("espera_cliente", "À espera do cliente", "cliente", "dias"),
    Estado("em_execucao", "Em execução", "MDM", "dias úteis"),
)
# Os que precisam de dados que o funil ainda não lê.
POR_MEDIR = (
    (Estado("visita_por_marcar", "Visita por marcar", "MDM", "dias úteis"), "calendário de visitas"),
    (Estado("visita_marcada", "Visita marcada", "MDM", "dias úteis"), "calendário de visitas e folhas de obra"),
    (Estado("espera_fornecedor", "À espera de peça/fornecedor", "fornecedor", "dias úteis"),
     "emails de compras a fornecedores"),
)
POR_CHAVE = {e.chave: e for e in ESTADOS}
# Estados em que a MDM despacha uma fila: a simulação troca a ordem e mantém os momentos em que a MDM despachou.
SIMULAVEIS = ("novo", "orcamento_por_fazer")


# ---------------------------------------------------------------- estados de cada pedido


def _ultimo(p: Pedido, so_cliente: bool = False) -> datetime | None:
    ts = [e.ts for e in p.eventos if e.fonte != "orc" and (not so_cliente or e.direcao == "entrada")]
    return max(ts) if ts else None


def periodos(p: Pedido, agora: datetime, modo: str = "vivos", dias_parado: int = 30, dias_cliente: int = 120,
             dias_sem_contacto: int = 30) -> list[tuple[str, datetime, datetime, bool]]:
    """(estado, início, fim, terminou) de cada estado por onde o pedido passou.

    Um estado que nunca terminou acaba, conforme o modo:
    - "vivos": no último contacto, se o pedido está parado há mais de dias_parado (dias_cliente na espera do
      cliente); senão continua até agora. Mede a fila de pedidos vivos.
    - "painel": continua até agora, como num painel em que ninguém fecha os pedidos parados.
    - "regra": sai da lista dias_sem_contacto dias depois do último contacto (a regra dos 30 dias).
    """
    ultimo = _ultimo(p) or p.t_inicio or p.t_contacto
    inicio_de = {"novo": p.t_contacto, "orcamento_por_fazer": p.t_resposta, "espera_cliente": p.t_envio,
                 "em_execucao": p.t_aceite}

    def fim_aberto(chave: str) -> datetime:
        inicio = inicio_de[chave]
        if modo == "painel" or ultimo is None:
            return agora
        if modo == "regra":
            return max(inicio, min(agora, local(ultimo) + timedelta(days=dias_sem_contacto)))
        limite = timedelta(days=dias_cliente if chave == "espera_cliente" else dias_parado)
        return agora if agora - ultimo <= limite else max(ultimo, inicio)

    out = []
    if p.t_contacto:
        fim = p.t_resposta
        out.append(("novo", p.t_contacto, fim or fim_aberto("novo"), fim is not None))
    if p.t_resposta and not (p.t_envio and p.t_envio < p.t_resposta):
        fim = p.t_envio
        # Sem orçamento, o estado só existe se o pedido não fechou de outra forma (fatura direta ou recusa).
        fecho = None if fim else (p.t_fatura or p.t_recusa)
        if fim or not fecho:
            out.append(("orcamento_por_fazer", p.t_resposta, fim or fim_aberto("orcamento_por_fazer"), fim is not None))
    if p.t_envio:
        dec = p.t_decisao if p.t_decisao and p.t_decisao >= p.t_envio else None
        out.append(("espera_cliente", p.t_envio, dec or fim_aberto("espera_cliente"), dec is not None))
    if p.t_aceite:
        fim = p.t_fatura if p.t_fatura and p.t_fatura >= p.t_aceite else None
        out.append(("em_execucao", p.t_aceite, fim or fim_aberto("em_execucao"), fim is not None))
    return out


def duracao(cal: Calendario, est: Estado, a: datetime, b: datetime) -> float:
    if est.unidade == "horas úteis":
        return cal.horas_uteis(a, b)
    if est.unidade == "dias úteis":
        return cal.dias_uteis(a, b)
    return dias_entre(a, b)


def vence(cal: Calendario, est: Estado, a: datetime, prazo: float) -> datetime:
    """Momento em que o prazo acaba, contado a partir de a na unidade do estado (horas e dias úteis sem feriados)."""
    if est.unidade == "horas úteis":
        return cal.somar_horas_uteis(a, prazo)
    if est.unidade == "dias úteis":
        return cal.somar_horas_uteis(a, prazo * cal.horas_dia)
    return local(a) + timedelta(days=prazo)


def bola_com_mdm(p: Pedido, ts: datetime) -> bool:
    """A MDM tinha a bola neste momento? (sem resposta, sem orçamento, ou trabalho aceite por concluir)"""
    if p.t_contacto is None or ts <= p.t_contacto:
        return False
    fechado = any(t and t <= ts for t in (p.t_fatura, p.t_recusa))
    if p.t_resposta is None or ts < p.t_resposta:
        return not fechado
    if p.t_envio is None or ts < p.t_envio:
        return not fechado
    return bool(p.t_aceite and ts >= p.t_aceite and (p.t_fatura is None or ts < p.t_fatura))


def cobrancas(p: Pedido, palavras, cal: Calendario, horas_minimas: float = 4.0) -> list[datetime]:
    """Momentos em que o cliente cobrou uma resposta enquanto a bola estava com a MDM.

    Conta como cobrança uma mensagem com palavras de cobrança ("então, já viram?") ou um segundo contacto do cliente
    (mensagem ou chamada) pelo menos horas_minimas horas úteis depois do anterior, sem nada da MDM pelo meio."""
    out, pendente = [], None
    for e in sorted((e for e in p.eventos if e.fonte != "orc"), key=lambda e: e.ts):
        if e.direcao == "saida":
            pendente = None
            continue
        if e.direcao != "entrada":
            continue
        if bola_com_mdm(p, e.ts):
            por_texto = bool(palavras) and contem(preparado(_PONTUACAO.sub(" ", e.texto or "")), palavras)
            repetido = pendente is not None and cal.horas_uteis(pendente, e.ts) >= horas_minimas
            if por_texto or repetido:
                out.append(e.ts)
        if e.tipo == "chamada_atendida":
            pendente = None          # falaram com o cliente
        elif pendente is None:
            pendente = e.ts
    return out


# ---------------------------------------------------------------- tempos atuais, paciência do cliente e simulação


def capacidade(pedidos: list[Pedido], cal: Calendario, hoje: date) -> dict:
    ps = [p for p in pedidos if p.incluir and p.t_contacto]
    if not ps:
        return {}
    inicio = min(p.t_contacto for p in ps)
    semanas = max(1.0, dias_entre(inicio, fim_do_dia(hoje)) / 7)
    return {"inicio": inicio.date(), "semanas": semanas, "pedidos_semana": len(ps) / semanas,
            "orcamentos_semana": sum(1 for p in ps if p.t_envio) / semanas,
            "execucoes_semana": sum(1 for p in ps if p.t_fatura) / semanas}


def duracoes(pedidos: list[Pedido], cal: Calendario, hoje: date) -> dict:
    """Percentis do tempo atual em cada estado (só estados que terminaram), por P e por tipo de trabalho."""
    agora = fim_do_dia(hoje)
    valores = defaultdict(list)
    for p in pedidos:
        if not p.incluir:
            continue
        tipo = p.caracteristicas.get("tipo") or "outro"
        for chave, a, b, terminou in periodos(p, agora):
            if terminou:
                d = duracao(cal, POR_CHAVE[chave], a, b)
                for grupo in ("todos", p.prioridade_atual or "P3", f"tipo:{tipo}"):
                    valores[(chave, grupo)].append(d)
    return {k: _resumo(v) for k, v in valores.items()}


def _resumo(v: list[float]) -> dict:
    return {"n": len(v), "p50": quantil(v, 0.5), "p80": quantil(v, 0.8), "p90": quantil(v, 0.9),
            "media": sum(v) / len(v) if v else None, "valores": sorted(v)}


def kaplan_meier(obs: list[tuple[float, bool]]) -> list[tuple[float, float]]:
    """Curva de quem ainda não cobrou: [(tempo, fração)] a cada cobrança. obs = (tempo, cobrou).

    Quem foi atendido antes de cobrar conta até ao momento em que foi atendido (não se sabe quando teria cobrado):
    assim a paciência não fica subestimada só porque os clientes pacientes foram atendidos antes de cobrar."""
    obs = sorted(obs)
    em_risco, s, curva, i = len(obs), 1.0, [], 0
    while i < len(obs):
        t = obs[i][0]
        j = i
        while j < len(obs) and obs[j][0] == t:
            j += 1
        eventos = sum(1 for _, cobrou in obs[i:j] if cobrou)
        if eventos:
            s *= 1 - eventos / em_risco
            curva.append((t, s))
        em_risco -= j - i
        i = j
    return curva


def _tempo_ate(curva: list[tuple[float, float]], fracao: float) -> float | None:
    """Primeiro tempo em que pelo menos esta fração dos clientes já cobrou."""
    for t, s in curva:
        if s <= 1 - fracao + 1e-12:
            return t
    return None


def paciencia(pedidos: list[Pedido], cal: Calendario, hoje: date, cfg: dict) -> dict:
    """Em cada estado da MDM, ao fim de quanto tempo os clientes cobram (curva de Kaplan-Meier)."""
    agora, palavras = fim_do_dia(hoje), cfg["palavras"].get("cobranca", [])
    fracao = cfg["prazos"]["fracao_paciencia"]
    obs = defaultdict(list)
    for p in pedidos:
        if not p.incluir or not p.t_contacto:
            continue
        cs = cobrancas(p, palavras, cal)
        for chave, a, b, _ in periodos(p, agora, modo="regra", dias_sem_contacto=cfg["prazos"]["dias_sem_contacto"]):
            est = POR_CHAVE[chave]
            if est.bola != "MDM":
                continue
            dentro = [t for t in cs if a < t <= b]
            obs[chave].append((duracao(cal, est, a, dentro[0]), True) if dentro else (duracao(cal, est, a, b), False))
    out = {}
    for chave, v in obs.items():
        curva = kaplan_meier(v)
        out[chave] = {"entradas": len(v), "cobraram": sum(1 for _, c in v if c),
                      "limite": _tempo_ate(curva, fracao), "mediana": _tempo_ate(curva, 0.5)}
    return out


def simular_ordem(pedidos: list[Pedido], cal: Calendario, hoje: date, chave: str, dias_sem_contacto: int = 30,
                  minutos_na_hora: int = 15) -> dict:
    """Os mesmos pedidos, despachados nos mesmos momentos, mas pela ordem do P.

    Cada vez que a MDM despachou um pedido deste estado (respondeu, enviou um orçamento), despacha antes o de P mais
    alto que estava à espera (em empate, o que chegou primeiro). Só trocam de lugar os pedidos que a MDM despachou de
    facto: os que nunca foram despachados ficam como estavam (saem pela regra dos 30 dias), e os despachados na hora
    (uma chamada atendida) também. Devolve {id: (início, fim simulado ou None, até quando conta)}."""
    agora = fim_do_dia(hoje)
    chegadas, saidas, out = [], [], {}
    for p in pedidos:
        if not p.incluir or not p.t_contacto:
            continue
        for c, a, b, terminou in periodos(p, agora, modo="painel"):
            if c != chave:
                continue
            a, b = local(a), local(b)
            if terminou and b - a <= timedelta(minutes=minutos_na_hora):
                out[p.id] = (a, b, b)
                continue
            if not terminou:
                ultimo = _ultimo(p)
                out[p.id] = (a, None, min(agora, max(local(ultimo) if ultimo else a, a)
                                          + timedelta(days=dias_sem_contacto)))
                continue
            chegadas.append((a, _ORDEM.get(p.prioridade_atual, 2), p.id))
            saidas.append(b)
    chegadas.sort()
    saidas.sort()
    fila, i = [], 0
    for s in saidas:
        while i < len(chegadas) and chegadas[i][0] <= s:
            a, ordem, pid = chegadas[i]
            heapq.heappush(fila, (ordem, a, pid))
            i += 1
        # Há sempre alguém à espera: cada saída é de um pedido que já tinha chegado.
        ordem, a, pid = heapq.heappop(fila)
        out[pid] = (a, s, s)
    return out


def simulacao(pedidos: list[Pedido], cal: Calendario, hoje: date, cfg: dict) -> dict:
    """{estado: {id: (início, fim, até)}} para os estados em que a MDM despacha uma fila."""
    return {chave: simular_ordem(pedidos, cal, hoje, chave, cfg["prazos"]["dias_sem_contacto"]) for chave in SIMULAVEIS}


def tempos_simulados(sim: dict, pedidos: list[Pedido], cal: Calendario) -> dict:
    """Percentis do tempo que cada P teria tido com a ordem por P (só pedidos despachados)."""
    classe = {p.id: p.prioridade_atual or "P3" for p in pedidos}
    valores = defaultdict(list)
    for chave, detalhe in sim.items():
        est = POR_CHAVE[chave]
        for pid, (a, fim, _) in detalhe.items():
            if fim is not None:
                valores[(chave, classe[pid])].append(duracao(cal, est, a, fim))
    return {k: _resumo(v) for k, v in valores.items()}


# ---------------------------------------------------------------- prazos


def _arredondar(est: Estado, v: float | None) -> float | None:
    """Dias de calendário à unidade; horas e dias úteis ao meio (arredondamento para cima a partir de metade)."""
    if v is None:
        return None
    if est.unidade == "dias":
        return max(1.0, float(math.floor(v + 0.5)))
    return max(0.5, math.floor(v * 2 + 0.5) / 2)


def propor_prazos(tabela: dict, simulados: dict, pac: dict | None, cfg: dict, percentil: float | None = None
                  ) -> tuple[dict, dict]:
    """Prazo de cada estado por P, a partir dos dados. Devolve (prazos, de onde veio cada um).

    1. O prazo é o percentil (p80) do tempo desse P no estado: 8 em cada 10 pedidos cumpriam-no.
    2. Ao responder e ao orçamentar, o tempo é o que esse P teria tido se a mesma equipa trabalhasse pela ordem do P
       (a simulação, com os mesmos momentos em que a MDM respondeu e enviou orçamentos). Nos outros estados, o tempo
       atual. Na espera do cliente, o prazo é o primeiro seguimento: o percentil_seguimento (p50) do tempo que os
       clientes levam a decidir. Com poucos casos desse P não há proposta: o prazo define-se à mão.
    3. Nos P de limitar_pela_paciencia, o prazo nunca passa do momento em que fracao_paciencia dos clientes já cobrou
       (arredondado para baixo).
    4. O P1 nunca tem mais tempo do que o P2, nem o P2 do que o P3."""
    s = cfg["prazos"]
    minimo = s["minimo_casos"]
    q = s["percentil"] if percentil is None else percentil
    nome_q = f"p{round(q * 100)}"
    limitar = set(s.get("limitar_pela_paciencia") or [])
    prazos, fonte = {}, {}
    for est in ESTADOS:
        anterior = None
        q_est = s.get("percentil_seguimento", 0.5) if est.chave == "espera_cliente" else q
        nome_est = f"p{round(q_est * 100)}"
        for c in CLASSES:
            base = simulados.get((est.chave, c)) if est.chave in SIMULAVEIS else tabela.get((est.chave, c))
            if base and base["n"] >= minimo:
                v = quantil(base["valores"], q_est)
                if est.chave in SIMULAVEIS:
                    f = f"{nome_est} com a ordem por P"
                elif est.chave == "espera_cliente":
                    f = f"{nome_est} do tempo de decisão do cliente"
                else:
                    f = f"{nome_est} do tempo atual"
            else:
                n = base["n"] if base else 0
                v, f = None, f"poucos casos de {c} ({n}): definir à mão"
            limite = (pac or {}).get(est.chave, {})
            if v is not None and c in limitar and limite.get("limite") is not None \
                    and limite.get("cobraram", 0) >= minimo and limite["limite"] < v:
                # Para baixo: o prazo tem de acabar antes de os clientes cobrarem, não depois.
                v = max(0.5, math.floor(limite["limite"] * 2) / 2)
                f = f"antes de {round(s['fracao_paciencia'] * 100)}% dos clientes cobrarem"
            else:
                v = _arredondar(est, v)
            if v is not None and anterior is not None and v < anterior:
                v, f = anterior, f"igual ao P de cima ({f})"
            prazos[(est.chave, c)], fonte[(est.chave, c)] = v, f
            anterior = v if v is not None else anterior
    return prazos, fonte


def prazos_em_uso(propostos: dict, cfg: dict) -> tuple[dict, dict]:
    """Os prazos escritos em [prazos] (já validados) por cima dos propostos. Devolve (prazos, origem)."""
    s = cfg.get("prazos", {})
    prazos, origem = {}, {}
    for est in ESTADOS:
        definidos = s.get(est.chave) or {}
        for c in CLASSES:
            valor = definidos.get(c) if isinstance(definidos, dict) else None
            if valor not in (None, ""):
                prazos[(est.chave, c)], origem[(est.chave, c)] = float(valor), "configuração"
            else:
                prazos[(est.chave, c)], origem[(est.chave, c)] = propostos.get((est.chave, c)), "proposto"
    return prazos, origem


# ---------------------------------------------------------------- o histórico com as regras


def _contagem() -> dict:
    return {"total": 0, "fora": 0, "fechados": 0, "fechados_fora": 0, "abertos": 0}


def _limite_util(p: Pedido, a_tempo: timedelta) -> datetime | None:
    """Até quando um aviso ainda podia mudar o resultado: o sim, a recusa ou, se o cliente deixou de responder,
    a última mensagem dele mais a folga."""
    if p.ganho:
        return p.t_ganho
    if p.t_recusa:
        return p.t_recusa
    ultimo = _ultimo(p, so_cliente=True) or _ultimo(p)
    return local(ultimo) + a_tempo if ultimo else None


def replay(pedidos: list[Pedido], cal: Calendario, hoje: date, prazos: dict, cfg: dict) -> dict:
    """Aplica os prazos ao histórico, como aconteceu: vermelhos por estado e P, e se o vermelho avisou a tempo.

    Fora do prazo conta à parte os estados que nunca fecharam (ninguém respondeu, orçou ou faturou): no sistema
    novo esses pedidos fecham com motivo; não são atraso, são pedidos esquecidos."""
    s, agora = cfg["prazos"], fim_do_dia(hoje)
    a_tempo = timedelta(days=s["dias_a_tempo"])
    palavras = cfg["palavras"].get("cobranca", [])
    fora = defaultdict(_contagem)
    r = dict(pedidos=0, pedidos_vermelhos=0, perdidos=0, perdidos_vermelhos=0, ganhos=0, ganhos_vermelhos=0,
             cobrados=0, cobrados_com_aviso=0, cobrancas=0, seguimentos_devidos=0, seguimentos_feitos=0)
    for p in pedidos:
        if not p.incluir or not p.t_contacto:
            continue
        c = p.prioridade_atual or "P3"
        primeiro = None                           # primeiro momento vermelho num estado da MDM
        saidas = [e.ts for e in p.eventos if e.fonte != "orc" and e.direcao == "saida"]
        for chave, a, b, terminou in periodos(p, agora, modo="regra", dias_sem_contacto=s["dias_sem_contacto"]):
            est, prazo = POR_CHAVE[chave], prazos.get((chave, c))
            if prazo is None:
                continue
            f = fora[(chave, c)]
            atrasado = duracao(cal, est, a, b) > prazo
            f["total"] += 1
            f["fora"] += atrasado
            f["fechados"] += terminou
            f["fechados_fora"] += terminou and atrasado
            f["abertos"] += not terminou
            if not atrasado:
                continue
            momento = vence(cal, est, a, prazo)
            if est.bola == "MDM":
                primeiro = momento if primeiro is None else min(primeiro, momento)
            else:
                # Na espera do cliente o prazo é a data de seguimento: a MDM seguiu depois dela?
                r["seguimentos_devidos"] += 1
                r["seguimentos_feitos"] += any(momento <= t <= b for t in saidas)
        r["pedidos"] += 1
        r["pedidos_vermelhos"] += primeiro is not None
        if p.maduro:
            limite = _limite_util(p, a_tempo)
            vermelho = primeiro is not None and limite is not None and primeiro <= limite
            grupo = "ganhos" if p.ganho else "perdidos"
            r[grupo] += 1
            r[grupo + "_vermelhos"] += vermelho
        cs = cobrancas(p, palavras, cal)
        if cs:
            r["cobrados"] += 1
            r["cobrancas"] += len(cs)
            r["cobrados_com_aviso"] += primeiro is not None and primeiro <= cs[0]
    vermelhos = r["perdidos_vermelhos"] + r["ganhos_vermelhos"]
    verdes_perdidos = r["perdidos"] - r["perdidos_vermelhos"]
    verdes = verdes_perdidos + r["ganhos"] - r["ganhos_vermelhos"]
    r["perda_se_vermelho"] = r["perdidos_vermelhos"] / vermelhos if vermelhos else None
    r["perda_se_verde"] = verdes_perdidos / verdes if verdes else None
    r["razao"] = (r["perda_se_vermelho"] / r["perda_se_verde"]
                  if r["perda_se_vermelho"] is not None and r["perda_se_verde"] else None)
    r["fora"] = dict(fora)
    return r


def fora_simulado(sim: dict, pedidos: list[Pedido], cal: Calendario, prazos: dict) -> dict:
    """Fora do prazo por estado e P com a ordem por P (mesmos momentos de despacho)."""
    classe = {p.id: p.prioridade_atual or "P3" for p in pedidos}
    fora = defaultdict(_contagem)
    for chave, detalhe in sim.items():
        est = POR_CHAVE[chave]
        for pid, (a, fim, ate) in detalhe.items():
            c = classe[pid]
            prazo = prazos.get((chave, c))
            if prazo is None:
                continue
            f = fora[(chave, c)]
            atrasado = duracao(cal, est, a, ate) > prazo
            f["total"] += 1
            f["fora"] += atrasado
            f["fechados"] += fim is not None
            f["fechados_fora"] += fim is not None and atrasado
            f["abertos"] += fim is None
    return dict(fora)


def vermelhos_por_manha(pedidos: list[Pedido], cal: Calendario, hoje: date, prazos: dict, cfg: dict,
                        semanas: int = 13, sim: dict | None = None) -> dict:
    """Média, nos dias úteis das últimas semanas, de pedidos vermelhos e de pedidos abertos num estado da MDM às 9h.

    "painel": ninguém fecha os pedidos parados. "regra": com a regra dos 30 dias. "ordem" (se houver simulação):
    com a regra dos 30 dias e a ordem por P ao responder e ao orçamentar."""
    agora = fim_do_dia(hoje)
    dias = [hoje - timedelta(days=i) for i in range(7 * semanas)]
    manhas = [datetime.combine(d, cal.ini, tzinfo=LX) for d in dias if cal.e_util(d)]
    out = {}
    for modo in ("painel", "regra") + (("ordem",) if sim else ()):
        vermelhos, abertos = [], []
        for p in pedidos:
            if not p.incluir or not p.t_contacto:
                continue
            c = p.prioridade_atual or "P3"
            modo_periodos = "regra" if modo == "ordem" else modo
            for chave, a, b, terminou in periodos(p, agora, modo=modo_periodos,
                                                  dias_sem_contacto=cfg["prazos"]["dias_sem_contacto"]):
                est = POR_CHAVE[chave]
                if est.bola != "MDM":
                    continue
                if modo == "ordem" and chave in sim and p.id in sim[chave]:
                    a, fim, ate = sim[chave][p.id]
                    b, terminou = fim or ate, fim is not None
                a, b = local(a), local(b)
                abertos.append((a, b))
                prazo = prazos.get((chave, c))
                if prazo is not None:
                    v = vence(cal, est, a, prazo)
                    if v < b:
                        vermelhos.append((v, b, terminou))
        n = len(manhas)
        out[modo] = {
            "vermelhos": sum(sum(1 for v, b, _ in vermelhos if v < m < b) for m in manhas) / n if n else None,
            "nunca_fecharam": sum(sum(1 for v, b, t in vermelhos if not t and v < m < b) for m in manhas) / n
            if n else None,
            "abertos": sum(sum(1 for a, b in abertos if a <= m < b) for m in manhas) / n if n else None,
        }
    return out


def little(pedidos: list[Pedido], cal: Calendario, hoje: date, prazos: dict, semanas: int = 26) -> list[dict]:
    """Lei de Little (fila média = entradas x tempo médio) em cada estado da MDM, nas últimas semanas.

    Se a fila média for maior do que entradas x prazo, o tempo médio já passa o prazo: o prazo não se cumpre sem
    baixar a fila. Tudo em dias úteis (o estado novo também, para a conta; o relatório mostra-o em horas)."""
    agora = fim_do_dia(hoje)
    inicios = [local(p.t_contacto) for p in pedidos if p.incluir and p.t_contacto]
    if not inicios:
        return []
    ini = max(min(inicios), datetime.combine(hoje - timedelta(weeks=semanas), cal.ini, tzinfo=LX))
    dias = cal.dias_uteis(ini, agora)
    if dias <= 0:
        return []
    out = []
    for est in ESTADOS:
        if est.bola != "MDM":
            continue
        filas, entradas, saidas, por_classe = {}, 0, 0, defaultdict(int)
        for modo in ("vivos", "painel"):
            tempo = 0.0
            for p in pedidos:
                if not p.incluir or not p.t_contacto:
                    continue
                for chave, a, b, terminou in periodos(p, agora, modo=modo):
                    if chave != est.chave:
                        continue
                    a, b = local(a), local(b)
                    lo, hi = max(a, ini), min(b, agora)
                    if hi > lo:
                        tempo += cal.dias_uteis(lo, hi)
                    if modo == "vivos":
                        if ini <= a <= agora:
                            entradas += 1
                            por_classe[p.prioridade_atual or "P3"] += 1
                        if terminou and ini <= b <= agora:
                            saidas += 1
            filas[modo] = tempo / dias
        lam = entradas / dias
        fator = 1 / cal.horas_dia if est.unidade == "horas úteis" else 1.0
        validos = [(por_classe[c], prazos.get((est.chave, c))) for c in CLASSES if prazos.get((est.chave, c)) is not None]
        n = sum(k for k, _ in validos)
        prazo_medio = sum(k * v for k, v in validos) / n * fator if n else None
        out.append({
            "estado": est.chave, "nome": est.nome, "unidade": est.unidade, "semanas": dias / 5,
            "entradas_semana": lam * 5, "saidas_semana": saidas / dias * 5,
            "fila_vivos": filas["vivos"], "fila_painel": filas["painel"],
            "espera_media": filas["vivos"] / lam if lam else None,
            "prazo_medio": prazo_medio,
            "fila_maxima": lam * prazo_medio if prazo_medio is not None else None,
        })
    return out


def cenarios(pedidos: list[Pedido], cal: Calendario, hoje: date, opcoes: list[tuple[str, dict]], cfg: dict) -> list[dict]:
    """O mesmo histórico com vários conjuntos de prazos, para escolher (vermelho raro e útil)."""
    out = []
    for nome, prazos in opcoes:
        r = replay(pedidos, cal, hoje, prazos, cfg)
        m = vermelhos_por_manha(pedidos, cal, hoje, prazos, cfg)
        out.append({"nome": nome, "prazos": prazos, "manha": m,
                    **{k: r[k] for k in ("perdidos", "perdidos_vermelhos", "ganhos", "ganhos_vermelhos",
                                         "perda_se_vermelho", "perda_se_verde", "razao", "cobrados",
                                         "cobrados_com_aviso")}})
    return out


# ---------------------------------------------------------------- tudo junto


@dataclass
class Sombra:
    hoje: date
    exemplo: bool
    calendario: dict
    config: dict
    capacidade: dict
    tabela: dict
    simulados: dict
    paciencia: dict
    propostos: dict
    fonte: dict
    prazos: dict
    origem: dict
    replay: dict
    simulado: dict
    manha: dict
    little: list
    cenarios: list
    envios_por_confirmar: int = 0
    quota: dict | None = None


def _quota(pedidos: list[Pedido], cfg: dict) -> dict | None:
    """Fração dos pedidos em P1 e em P1 ou P2 com as regras de entrada, ao lado da quota da configuração."""
    ps = [p for p in pedidos if p.incluir and p.t_contacto]
    if not ps:
        return None
    p1 = sum(1 for p in ps if p.prioridade_atual == "P1")
    p12 = sum(1 for p in ps if p.prioridade_atual in ("P1", "P2"))
    pr = cfg["prioridade"]
    return {"n": len(ps), "p1": p1 / len(ps), "p1p2": p12 / len(ps), "quota_p1": pr["quota_p1"],
            "quota_p1p2": pr["quota_p1p2"]}


def executar_sombra(r: "Resultado") -> Sombra:
    cfg, cal, hoje, pedidos = r.cfg, r.cal, r.hoje, r.pedidos
    tabela = duracoes(pedidos, cal, hoje)
    sim = simulacao(pedidos, cal, hoje, cfg)
    simulados = tempos_simulados(sim, pedidos, cal)
    pac = paciencia(pedidos, cal, hoje, cfg)
    propostos, fonte = propor_prazos(tabela, simulados, pac, cfg)
    prazos, origem = prazos_em_uso(propostos, cfg)
    q = cfg["prazos"]["percentil"]
    opcoes = []
    for x in sorted({0.5, 0.8, 0.9, q}):
        nome = f"p{round(x * 100)}" + (" (proposta)" if x == q else "")
        opcoes.append((nome, propor_prazos(tabela, simulados, pac, cfg, x)[0]))
    opcoes.append((f"p{round(q * 100)} sem o limite da paciência", propor_prazos(tabela, simulados, None, cfg)[0]))
    if any(o == "configuração" for o in origem.values()):
        opcoes.append(("Em uso (configuração)", prazos))
    return Sombra(
        hoje=hoje, exemplo=bool(cfg["geral"].get("exemplo")), calendario=dict(cfg["calendario"]),
        config=dict(cfg["prazos"]), capacidade=capacidade(pedidos, cal, hoje), tabela=tabela, simulados=simulados,
        paciencia=pac, propostos=propostos, fonte=fonte, prazos=prazos, origem=origem,
        replay=replay(pedidos, cal, hoje, prazos, cfg), simulado=fora_simulado(sim, pedidos, cal, prazos),
        manha=vermelhos_por_manha(pedidos, cal, hoje, prazos, cfg, sim=sim), little=little(pedidos, cal, hoje, prazos),
        cenarios=cenarios(pedidos, cal, hoje, opcoes, cfg),
        envios_por_confirmar=sum(1 for p in pedidos if p.incluir and p.t_envio and not p.envio_confirmado),
        quota=_quota(pedidos, cfg),
    )
