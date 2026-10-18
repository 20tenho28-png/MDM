"""Construção dos pedidos: agrupa os eventos de cada cliente em pedidos e mede cada etapa."""

from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import date, timedelta

from .caracteristicas import TIPOS, classificar_decisao, extrair
from .datas import Calendario, fim_do_dia
from .modelo import Evento, Pedido
from .texto import contem, norm, preparado

# Eventos do cliente que podem abrir um pedido.
INICIO = {"mensagem", "chamada_atendida", "chamada_perdida", "formulario"}
_ORDEM_FONTE = {"site": 0, "email": 1, "whatsapp": 1, "chamada": 1, "orc": 2, "agenda": 2, "fatura": 3}
# Documentos e registos internos: não são contactos com o cliente (não contam como última mensagem nem mantêm o
# pedido vivo).
NAO_CONTACTO = ("orc", "fatura", "agenda")


class _Estado:
    __slots__ = ("pedido", "ultimo", "orcs", "t_orc", "tem_fatura", "fechado")

    def __init__(self, pedido: Pedido, ts):
        self.pedido = pedido
        self.ultimo = ts
        self.orcs: set[str] = set()
        self.t_orc = None
        self.tem_fatura = False
        self.fechado = None   # momento da fatura ou da recusa


def _novo_id(e: Evento) -> str:
    return f"P{e.ts:%Y%m%d}-{hashlib.sha1(e.uid.encode()).hexdigest()[:6]}"


def construir(eventos: list[Evento], cfg: dict, cal: Calendario, hoje: date) -> tuple[list[Pedido], dict]:
    pc = cfg["pedidos"]
    pausa = timedelta(days=pc["dias_novo_pedido"])
    janela_decisao = timedelta(days=pc["dias_decisao"])
    janela_fatura = timedelta(days=pc["dias_fatura"])
    depois_de_fechado = timedelta(days=pc.get("dias_fechado", 7))

    # O ORC entra na sequência no momento em que foi enviado (se houver mensagem com o número), não no fim do dia.
    primeiro_envio: dict[str, object] = {}
    for e in eventos:
        if e.direcao == "saida":
            for r in e.refs_orc:
                if r not in primeiro_envio or e.ts < primeiro_envio[r]:
                    primeiro_envio[r] = e.ts

    def chave_ordem(e: Evento):
        ts = e.ts
        if e.fonte == "orc" and e.numero in primeiro_envio and primeiro_envio[e.numero] < ts:
            ts = primeiro_envio[e.numero] - timedelta(seconds=1)
        return (ts, _ORDEM_FONTE.get(e.fonte, 9), e.uid)

    por_cliente: dict[int, list[Evento]] = defaultdict(list)
    for e in eventos:
        por_cliente[e.cliente].append(e)

    pedidos: list[Pedido] = []
    contagem = defaultdict(int)
    for cliente in sorted(por_cliente):
        estados: list[_Estado] = []

        def novo(e: Evento, origem: Evento | None) -> _Estado:
            p = Pedido(id=_novo_id(e), cliente=cliente, origem=origem)
            p.t_inicio = e.ts
            s = _Estado(p, e.ts)
            estados.append(s)
            pedidos.append(p)
            return s

        for e in sorted(por_cliente[cliente], key=chave_ordem):
            atual = estados[-1] if estados else None
            alvo = None
            if e.refs_orc:
                alvo = next((s for s in reversed(estados) if s.orcs & e.refs_orc), None)
            if alvo is None:
                if e.fonte == "fatura":
                    alvo = next((s for s in reversed(estados)
                                 if s.pedido.t_inicio - timedelta(days=1) <= e.ts <= (s.t_orc or s.pedido.t_inicio) + janela_fatura),
                                None)
                    if alvo is None:
                        alvo = novo(e, None)
                elif e.fonte == "orc":
                    alvo = atual if atual and e.ts - atual.ultimo <= pausa else novo(e, None)
                elif e.fonte == "agenda":
                    # Uma visita do ERP entra no pedido do orçamento que refere ou no pedido em curso do cliente.
                    if atual and e.ts - atual.ultimo <= pausa:
                        alvo = atual
                    else:
                        contagem["visitas da agenda sem pedido aberto"] += 1
                        continue
                elif e.direcao == "entrada" and e.tipo in INICIO:
                    continua = atual is not None and (
                        e.ts - atual.ultimo <= pausa
                        or (atual.orcs and not atual.tem_fatura and e.ts - atual.t_orc <= janela_decisao))
                    if continua and atual.fechado and e.ts - atual.fechado > depois_de_fechado:
                        # Trabalho faturado ou recusado: uma mensagem nova é um pedido novo, a não ser que continue
                        # a negociação (é uma decisão sobre o orçamento ou fala do número dele).
                        d = classificar_decisao(e.texto, cfg) if atual.orcs and e.texto and not atual.tem_fatura else None
                        continua = bool(d and d[0] in ("aceite", "ambiguo")) or bool(e.refs_orc & atual.orcs)
                    alvo = atual if continua else novo(e, e)
                elif e.direcao == "saida" and atual and e.ts - atual.ultimo <= pausa:
                    alvo = atual
                else:
                    contagem["contactos da MDM sem pedido aberto"] += 1
                    continue
            alvo.pedido.eventos.append(e)
            if e.fonte != "agenda":
                alvo.ultimo = max(alvo.ultimo, e.ts)
            if e.fonte == "orc":
                alvo.orcs.add(e.numero)
                alvo.t_orc = alvo.t_orc or e.ts
                if not alvo.tem_fatura:
                    alvo.fechado = None      # orçamento novo ou revisto: a negociação continua
            elif e.fonte == "fatura" and (e.valor or 0) > 0:
                alvo.tem_fatura = True
                alvo.fechado = e.ts
            elif e.direcao == "entrada" and alvo.orcs and e.texto:
                d = classificar_decisao(e.texto, cfg)
                # Só uma recusa final fecha o pedido; uma queixa do preço ou do prazo ainda se negocia.
                if d and d[0] == "recusa" and d[1] in ("foi com outra empresa", "desistiu ou adiou"):
                    alvo.fechado = e.ts
                elif d and d[0] == "aceite" and not alvo.tem_fatura:
                    alvo.fechado = None

    for p in pedidos:
        calcular(p, cfg, cal, hoje)
    pedidos.sort(key=lambda p: (p.t_inicio, p.id))
    return pedidos, dict(contagem)


def calcular(p: Pedido, cfg: dict, cal: Calendario, hoje: date) -> None:
    pc = cfg["pedidos"]
    agora = fim_do_dia(hoje)
    evs = sorted(p.eventos, key=lambda e: e.ts)
    p.eventos = evs
    entradas = [e for e in evs if e.direcao == "entrada"]
    saidas = [e for e in evs if e.direcao == "saida"]
    respostas = [e for e in saidas if not e.extra.get("automatica")]
    orcs = [e for e in evs if e.fonte == "orc"]
    faturas = [e for e in evs if e.fonte == "fatura"]
    o = p.origem
    p.t_inicio = o.ts if o else evs[0].ts
    p.nome = next((e.nome for e in evs if e.nome and e.fonte != "chamada"), "") or next((e.nome for e in evs if e.nome), "")
    if o:
        p.t_contacto = o.ts
        p.canal = o.fonte

    if orcs:
        p.orc = orcs[0].numero
        p.n_orc = len({e.numero for e in orcs})
        p.t_orc = orcs[0].ts
        # O valor é o do orçamento mais recente (um orçamento revisto substitui o anterior).
        p.valor_orc = next((e.valor for e in reversed(orcs) if e.valor), None)
        envios = [e.ts for e in saidas if p.orc in e.refs_orc]
        # Sem mensagem enviada com o número ORC, usa a data do ORC, mas fica marcado como envio por confirmar:
        # um orçamento feito não é um orçamento enviado.
        p.t_envio = min(envios) if envios else p.t_orc
        p.envio_confirmado = bool(envios)

    if p.t_contacto:
        candidatos = [e.ts for e in respostas if e.ts >= p.t_contacto]
        candidatos += [e.ts for e in entradas if e.tipo == "chamada_atendida" and e.ts >= p.t_contacto]
        if p.t_envio and p.t_envio >= p.t_contacto:
            candidatos.append(p.t_envio)
        if candidatos:
            p.t_resposta = min(candidatos)
            p.h_resposta = round(cal.horas_uteis(p.t_contacto, p.t_resposta), 2)
    p.nunca_respondido = p.t_contacto is not None and p.t_resposta is None and not orcs and not faturas

    # Decisão do cliente: conta a última mensagem explícita depois do orçamento (o cliente pode mudar de ideias).
    if p.t_envio:
        ultima = None
        for e in entradas:
            if e.ts <= p.t_envio or not e.texto:
                continue
            d = classificar_decisao(e.texto, cfg)
            if d is None:
                continue
            if d[0] == "ambiguo":
                p.decisao_ambigua = True
                p.decisao_texto = e.texto[:300]
            else:
                ultima = (d, e)
        if ultima:
            (tipo, motivo), e = ultima
            p.decisao_texto = e.texto[:300]
            p.decisao_ambigua = False
            if tipo == "aceite":
                p.t_aceite = e.ts
            else:
                p.t_recusa = e.ts
                p.motivo = motivo

    positivas = [f for f in faturas if (f.valor or 0) > 0]
    total_faturado = sum(f.valor or 0 for f in faturas)
    anulada = bool(positivas) and total_faturado <= 0
    if positivas and not anulada:
        p.t_fatura = positivas[0].ts
        p.valor_fatura = total_faturado

    if p.t_fatura:
        p.resultado = "ganho"
    elif anulada:
        p.resultado, p.motivo = "perdido", "fatura anulada por nota de crédito"
    elif p.t_aceite:
        p.resultado = "aceite_por_faturar"
    elif p.t_recusa:
        p.resultado = "perdido"
    elif p.t_envio:
        # Conta a partir do último contacto: um cliente que ainda está a falar do orçamento não o deixou cair.
        ultimo = max([e.ts for e in evs if e.fonte not in NAO_CONTACTO and e.ts >= p.t_envio], default=p.t_envio)
        if agora - ultimo > timedelta(days=pc["dias_decisao"]):
            p.resultado, p.motivo = "perdido", "sem resposta depois do orçamento"
        else:
            p.resultado = "em_aberto"
    elif agora - max([e.ts for e in evs if e.fonte not in NAO_CONTACTO], default=p.t_inicio) \
            > timedelta(days=pc["dias_sem_orcamento"]):
        p.resultado = "sem_orcamento"
        p.motivo = "a MDM nunca respondeu" if p.nunca_respondido else "sem orçamento enviado"
    else:
        p.resultado = "novo"
    p.ganho = p.resultado in ("ganho", "aceite_por_faturar")
    # Maduro pela idade, não pelo resultado: os ganhos veem-se logo e as perdas só meses depois.
    p.maduro = agora - p.t_inicio >= timedelta(days=pc.get("dias_maturidade", 120))

    # Características: só o que se sabia no primeiro contacto (antes da resposta), para não usar o resultado.
    if p.t_contacto:
        corte = p.t_contacto + timedelta(days=1)
        if p.t_resposta and p.t_resposta > p.t_contacto:
            corte = min(corte, p.t_resposta)
        inicial = [e for e in entradas if p.t_contacto <= e.ts <= corte and e.texto]
        if not inicial:
            # Chamada atendida: o que o cliente escreveu no próprio dia, antes de haver orçamento.
            limite = p.t_contacto + timedelta(days=1)
            if p.t_envio:
                limite = min(limite, p.t_envio)
            inicial = [e for e in entradas if p.t_contacto <= e.ts < limite and e.texto][:2]
        texto = "\n".join(e.texto for e in inicial)
        dominio = next((e.extra.get("dominio") for e in entradas if e.extra.get("dominio")), "")
    else:
        texto, dominio = "", ""
    p.caracteristicas = extrair(texto, dominio, p.canal, cfg)
    p.texto_inicial = texto[:800]

    tem_palavra = any(contem(preparado(e.texto), cfg["palavras"]["pedido"]) for e in entradas if e.texto)
    texto_longo = any(len(norm(e.texto)) >= 40 for e in entradas if e.texto)
    if o is None:
        p.confianca = "orçamento sem contacto" if orcs else "fatura sem pedido"
        p.incluir = bool(orcs)
    elif p.canal == "site" or orcs or positivas or tem_palavra:
        p.confianca, p.incluir = "alta", True
    elif p.canal == "chamada" or (texto_longo and respostas):
        p.confianca, p.incluir = "media", True
    else:
        p.confianca, p.incluir = "baixa", False


_NOME_CANAL = {"email": "email", "whatsapp": "WhatsApp", "chamada": "chamada", "site": "site"}


def _chave_principal(p: Pedido) -> str:
    chaves = sorted(p.origem.chaves) if p.origem else []
    for prefixo in ("tel:", "email:", "wa:", "nome:"):
        k = next((k for k in chaves if k.startswith(prefixo)), None)
        if k:
            return k
    return p.id


def sugerir_ligacoes(pedidos: list[Pedido], dias: int = 30, maximo: int = 3) -> list[dict]:
    """Orçamentos sem contacto registado e pedidos sem orçamento pouco antes, que podem ser o mesmo cliente.

    Acontece quando o cliente liga e o orçamento segue por email: nada liga o telefone ao email. A pessoa confirma
    e escreve as duas chaves em revisao/ligacoes.csv.
    """
    sem_orc = [p for p in pedidos if p.incluir and p.t_contacto and not p.orc]
    linhas = []
    for o in pedidos:
        if o.confianca != "orçamento sem contacto" or not o.t_orc:
            continue
        # Primeiro as chamadas (é o caso mais comum), das mais próximas para as mais afastadas.
        perto = sorted((p for p in sem_orc if timedelta(0) <= o.t_orc - p.t_contacto <= timedelta(days=dias)),
                       key=lambda p: (p.canal != "chamada", o.t_orc - p.t_contacto))[:maximo]
        if perto:
            linhas.append({
                "situacao": "orçamento sem contacto: pode ser de um destes pedidos sem orçamento (se for, escreve as "
                            "duas chaves em revisao/ligacoes.csv)",
                "nome": f"orc:{o.orc} ({o.nome})",
                "detalhe": "; ".join(f"{_chave_principal(p)} ({_NOME_CANAL.get(p.canal, p.canal)} a "
                                     f"{p.t_contacto:%d/%m/%Y})" for p in perto)})
    return linhas


_SIM = {"s", "sim", "1", "x", "true", "verdadeiro", "y", "yes"}
_NAO = {"n", "nao", "0", "false", "falso", "no"}


def aplicar_revisao(pedidos: list[Pedido], linhas: list[dict]) -> int:
    """Aplica as correções escritas à mão em revisao/pedidos.csv. Devolve o número de pedidos corrigidos."""
    por_id = {str(l.get("id", "")).strip(): l for l in linhas if l.get("id")}
    corrigidos = 0
    for p in pedidos:
        l = por_id.get(p.id)
        if not l:
            continue
        mudou = False
        incluir = norm(l.get("incluir", ""))
        if incluir in _SIM or incluir in _NAO:
            p.incluir = incluir in _SIM
            mudou = True
        tipo = norm(l.get("tipo", ""))
        if tipo in TIPOS:
            p.caracteristicas["tipo"] = tipo
            mudou = True
        empresa = norm(l.get("empresa", ""))
        if empresa in _SIM or empresa in _NAO:
            p.caracteristicas["empresa"] = empresa in _SIM
            mudou = True
        resultado = norm(l.get("resultado", "")).replace(" ", "_")
        if resultado in ("ganho", "perdido", "sem_orcamento", "em_aberto"):
            p.resultado = resultado
            p.ganho = resultado == "ganho"
            mudou = True
        motivo = str(l.get("motivo", "") or "").strip()
        if motivo:
            p.motivo = motivo
            mudou = True
        if mudou:
            p.revisto = True
            corrigidos += 1
    return corrigidos
