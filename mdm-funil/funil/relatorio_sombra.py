"""Saídas do modo sombra: saida/sombra.html (para validar com o chefe), CSV para Excel e os prazos para a configuração."""

from __future__ import annotations

from pathlib import Path

from .caracteristicas import NOMES_TIPO
from .relatorio import _CSS, _tabela, esc, num, pct
from .saidas import _escrever, _n
from .sombra import CLASSES, POR_CHAVE, SIMULAVEIS, Estado, Sombra

_UNIDADE = {"horas úteis": "h úteis", "dias úteis": "dias úteis", "dias": "dias"}


def _v(est: Estado, v, casas: int = 1) -> str:
    return "–" if v is None else f"{num(v, casas)} {_UNIDADE[est.unidade]}"


def _fracao(a: int, b: int) -> str:
    return "–" if not b else f"{pct(a / b)} <span class=\"sub\">({a} de {b})</span>"


def _resumo(s: Sombra) -> list[str]:
    r, frases = s.replay, []
    cap = s.capacidade
    if cap:
        frases.append(f"{num(cap['pedidos_semana'], 1)} pedidos por semana desde {cap['inicio']:%d/%m/%Y}; "
                      f"{num(cap['orcamentos_semana'], 1)} orçamentos e {num(cap['execucoes_semana'], 1)} trabalhos "
                      "faturados por semana.")
    if r["perdidos"]:
        frases.append(f"Dos {r['perdidos']} pedidos perdidos (maduros), {r['perdidos_vermelhos']} teriam ficado vermelhos "
                      f"a tempo de agir ({pct(r['perdidos_vermelhos'] / r['perdidos'])}).")
    if r["perda_se_vermelho"] is not None and r["perda_se_verde"] is not None:
        vezes = f" ({num(r['razao'], 1)} vezes mais)" if r["razao"] else ""
        frases.append(f"Um pedido que ficou vermelho perdeu-se em {pct(r['perda_se_vermelho'])} dos casos; um que nunca "
                      f"ficou, em {pct(r['perda_se_verde'])}{vezes}.")
    if r["cobrados"]:
        frases.append(f"{r['cobrados']} pedidos tiveram clientes a cobrar resposta; em {r['cobrados_com_aviso']} o "
                      "vermelho apareceu antes da primeira cobrança.")
    else:
        frases.append("Não se encontraram mensagens de clientes a cobrar resposta.")
    if r["seguimentos_devidos"]:
        frases.append(f"Em {r['seguimentos_devidos']} esperas do cliente chegou a data de seguimento sem resposta; a MDM "
                      f"voltou a contactar em {r['seguimentos_feitos']}.")
    m = s.manha
    if m.get("regra") and m["regra"]["vermelhos"] is not None:
        frases.append(f"Às 9h, em média, {num(m['regra']['vermelhos'], 1)} vermelhos em "
                      f"{num(m['regra']['abertos'], 1)} pedidos com a bola na MDM, dos quais "
                      f"{num(m['regra']['nunca_fecharam'], 1)} são pedidos que ninguém fechou. Sem a regra dos 30 dias "
                      f"seriam {num(m['painel']['vermelhos'], 0)} em {num(m['painel']['abertos'], 0)}.")
    q = s.quota
    if q:
        acima = q["p1"] > q["quota_p1"] or q["p1p2"] > q["quota_p1p2"]
        frases.append(f"As regras de entrada põem {pct(q['p1'])} dos pedidos em P1 e {pct(q['p1p2'])} em P1 ou P2 "
                      f"(quota: {pct(q['quota_p1'])} e {pct(q['quota_p1p2'])})."
                      + (" Passam a quota: há uma regra larga demais." if acima else ""))
    if s.envios_por_confirmar:
        frases.append(f"{s.envios_por_confirmar} orçamentos não têm prova de envio (nenhuma mensagem com o número ORC): "
                      "o relógio de Orçamento por fazer parou na data do ORC, que pode ser antes do envio real.")
    for l in s.little:
        est = POR_CHAVE[l["estado"]]
        if l["fila_maxima"] is not None and l["fila_vivos"] > l["fila_maxima"]:
            frases.append(f"{est.nome}: a fila média ({num(l['fila_vivos'], 1)}) já é maior do que o prazo permite "
                          f"({num(l['fila_maxima'], 1)}). O prazo só se cumpre depois de a baixar.")
        if l["entradas_semana"] and l["saidas_semana"] < 0.9 * l["entradas_semana"]:
            frases.append(f"{est.nome}: entram {num(l['entradas_semana'], 1)} por semana e saem "
                          f"{num(l['saidas_semana'], 1)}. A diferença são pedidos que ninguém fecha.")
    return frases


def _visitas(s: Sombra) -> str:
    if s.por_medir:
        return ('<p class="nota">Sem a agenda do ERP, a visita conta dentro de «Orçamento por fazer» (antes do '
                'orçamento) ou de «Em execução» (depois do sim). Para medir as visitas e a espera de peças, exporta a '
                'agenda do ERP (<code>/erp/exportar/agenda.csv</code>) para <code>dados/agenda/</code>.</p>')
    return ('<p class="nota">Com a agenda do ERP: a visita conta por marcar desde que o cliente espera por ela (o '
            'início de «Orçamento por fazer» ou de «Em execução») até ter dia, marcada até chegar o relatório de '
            'intervenção, e à espera de peça desde a visita que a pediu até a peça chegar. Depois da última visita, '
            '«Orçamento por fazer» é o tempo até o orçamento seguir e «Em execução» o tempo até à fatura.</p>')


def _prazos(s: Sombra) -> str:
    linhas = []
    for est in s.estados:
        celulas = []
        for c in CLASSES:
            v = s.prazos[(est.chave, c)]
            origem = s.origem[(est.chave, c)]
            de_onde = "configuração" if origem == "configuração" else s.fonte[(est.chave, c)]
            celulas.append(f"{_v(est, v)}<span class=\"sub bl\">{esc(de_onde)}</span>")
        linhas.append([esc(est.nome), esc(est.bola)] + celulas)
    for est, falta in s.por_medir:
        linhas.append([esc(est.nome), esc(est.bola), f"<span class=\"vazio\">precisa {esc(falta)}</span>", "", ""])
    return _tabela(["Estado", "Bola com", "P1", "P2", "P3"], linhas)


def _tempos(s: Sombra) -> str:
    linhas = []
    for est in s.estados:
        grupos = ["todos"] + list(CLASSES) + sorted(g for (e, g) in s.tabela if e == est.chave and g.startswith("tipo:"))
        for g in grupos:
            t = s.tabela.get((est.chave, g))
            if not t:
                continue
            nome = "Todos" if g == "todos" else (NOMES_TIPO.get(g[5:], g[5:].capitalize()) if g.startswith("tipo:") else g)
            linhas.append([esc(est.nome) if g == "todos" else "", esc(nome), str(t["n"]),
                           _v(est, t["p50"]), _v(est, t["p80"]), _v(est, t["p90"])])
    return _tabela(["Estado", "Pedidos", "n", "p50", "p80", "p90"], linhas, {2, 3, 4, 5})


def _ordem(s: Sombra) -> str:
    linhas = []
    for chave in SIMULAVEIS:
        est = POR_CHAVE[chave]
        for c in CLASSES:
            hoje, sim = s.tabela.get((chave, c)), s.simulados.get((chave, c))
            if not hoje and not sim:
                continue
            linhas.append([esc(est.nome) if c == "P1" else "", c,
                           _v(est, hoje and hoje["p50"]), _v(est, hoje and hoje["p80"]),
                           _v(est, sim and sim["p50"]), _v(est, sim and sim["p80"])])
    return _tabela(["Estado", "P", "Hoje p50", "Hoje p80", "Ordem por P p50", "Ordem por P p80"], linhas, {2, 3, 4, 5})


def _fora(s: Sombra) -> str:
    linhas = []
    for est in s.estados:
        for c in CLASSES:
            f = s.replay["fora"].get((est.chave, c))
            if not f:
                continue
            g = s.simulado.get((est.chave, c))
            ordem = _fracao(g["fechados_fora"], g["fechados"]) if g else "–"
            linhas.append([esc(est.nome) if c == "P1" else "", c, str(f["total"]),
                           _fracao(f["fechados_fora"], f["fechados"]), ordem, str(f["abertos"])])
    return _tabela(["Estado", "P", "Pedidos", "Fora do prazo (como aconteceu)", "Fora do prazo (ordem por P)",
                    "Nunca fecharam"], linhas, {2, 3, 4, 5})


def _cenarios(s: Sombra) -> str:
    linhas = []
    for c in s.cenarios:
        m = c["manha"].get("regra") or {}
        linhas.append([esc(c["nome"]), _fracao(c["perdidos_vermelhos"], c["perdidos"]),
                       _fracao(c["ganhos_vermelhos"], c["ganhos"]), pct(c["perda_se_vermelho"]), pct(c["perda_se_verde"]),
                       num(c["razao"], 1) if c["razao"] else "–", _fracao(c["cobrados_com_aviso"], c["cobrados"]),
                       num(m.get("vermelhos"), 1)])
    return _tabela(["Prazos", "Perdidos vermelhos a tempo", "Ganhos que ficaram vermelhos", "Perdidos entre os vermelhos",
                    "Perdidos entre os verdes", "Vezes mais", "Cobranças com vermelho antes", "Vermelhos por manhã"],
                   linhas, {1, 2, 3, 4, 5, 6, 7})


def _paciencia(s: Sombra) -> str:
    linhas = []
    for est in s.estados:
        p = s.paciencia.get(est.chave)
        if not p:
            continue
        linhas.append([esc(est.nome), str(p["entradas"]), str(p["cobraram"]), _v(est, p["limite"]),
                       _v(est, p["mediana"])])
    fr = round(s.config["fracao_paciencia"] * 100)
    return _tabela(["Estado", "Pedidos", "Cobraram", f"{fr}% já cobraram ao fim de", "Metade cobrou ao fim de"],
                   linhas, {1, 2, 3, 4})


def _little(s: Sombra) -> str:
    linhas = []
    for l in s.little:
        est = POR_CHAVE[l["estado"]]
        horas = est.unidade == "horas úteis"
        fator = 9.0 if horas else 1.0
        u = "h úteis" if horas else "dias úteis"

        def t(v):
            return "–" if v is None else f"{num(v * fator, 1)} {u}"
        if l["fila_maxima"] is None:
            leitura = "sem prazo"
        elif l["fila_vivos"] > l["fila_maxima"]:
            leitura = "<span class=\"aviso\">a fila tem de baixar</span>"
        else:
            leitura = "o prazo cabe na capacidade"
        linhas.append([esc(est.nome), num(l["entradas_semana"], 1), num(l["saidas_semana"], 1), num(l["fila_vivos"], 1),
                       num(l["fila_painel"], 1), t(l["espera_media"]), t(l["prazo_medio"]), num(l["fila_maxima"], 1),
                       leitura])
    return _tabela(["Estado", "Entram por semana", "Saem por semana", "Fila média (vivos)", "Fila no painel",
                    "Tempo médio (fila / entradas)", "Prazo médio", "Fila máxima para o prazo", "Leitura"],
                   linhas, {1, 2, 3, 4, 5, 6, 7})


def gerar_html_sombra(s: Sombra) -> str:
    exemplo = ('<p class="exemplo">Dados de exemplo inventados por computador. Nenhum número desta página é da MDM.</p>'
               if s.exemplo else "")
    resumo = "".join(f"<li>{f}</li>" for f in _resumo(s))
    q = round(s.config["percentil"] * 100)
    fr = round(s.config["fracao_paciencia"] * 100)
    limitar = ", ".join(s.config.get("limitar_pela_paciencia") or []) or "nenhum P"
    cal = s.calendario
    return f"""<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Modo sombra MDM</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>{_CSS}</style></head>
<body><div class="wrap">
<div class="eyebrow">MDM · Climatização</div>
<h1>Modo sombra: estados e prazos</h1>
<div class="meta">As regras aplicadas ao histórico até {s.hoje:%d/%m/%Y}, antes de as usar no dia a dia</div>
{exemplo}
<ul class="resumo">{resumo}</ul>

<h2>Prazos</h2>
<p class="nota">Cada prazo é o p{q} do tempo desse P no estado: 8 em cada 10 pedidos cumpriam-no. Ao responder e ao
orçamentar conta o tempo que o P teria tido se a mesma equipa trabalhasse pela ordem do P. Em {esc(limitar)}, o prazo
nunca passa do momento em que {fr}% dos clientes já cobraram. O P1 nunca tem mais tempo do que o P2, nem o P2 do que o P3.
Na espera do cliente, o prazo é o primeiro seguimento: quando metade dos clientes já decidiu (p{round(s.config.get('percentil_seguimento', 0.5) * 100)} do tempo de decisão). Com menos de {s.config['minimo_casos']} casos de um P num estado, não há proposta: o prazo define-se à mão. Horas úteis: das {cal['hora_inicio']}h às {cal['hora_fim']}h, em dias
úteis, sem feriados.</p>
{_visitas(s)}
{_prazos(s)}

<h2>O vermelho é útil?</h2>
<p class="nota">O mesmo histórico com prazos mais apertados (p50) ou mais largos (p90). Vermelho a tempo: antes do sim, da
recusa ou, se o cliente deixou de responder, até {s.config['dias_a_tempo']} dias depois da última mensagem dele. Bom é
apanhar a maior parte dos perdidos e das cobranças com poucos ganhos a vermelho. Só contam pedidos maduros.</p>
{_cenarios(s)}

<h2>Fora do prazo, por estado e P</h2>
<p class="nota">Como aconteceu: com a ordem que a equipa seguiu. Ordem por P: os mesmos pedidos, despachados nos mesmos
momentos, mas o de P mais alto primeiro (só ao responder e ao orçamentar). Nunca fecharam: pedidos em que ninguém
respondeu, orçou ou faturou; no sistema novo fecham com motivo, não são atraso.</p>
{_fora(s)}

<h2>Com a ordem por P, quanto esperaria cada um</h2>
{_ordem(s)}

<h2>Ao fim de quanto tempo os clientes cobram</h2>
<p class="nota">Cobrança: mensagem com palavras como "então, já viram?" ou um segundo contacto do cliente sem nada da MDM
pelo meio. Os clientes atendidos antes de cobrar contam até serem atendidos (curva de Kaplan-Meier).</p>
{_paciencia(s)}

<h2>Os prazos cabem na capacidade? (lei de Little)</h2>
<p class="nota">Últimas {num(s.little[0]['semanas'] if s.little else 0)} semanas. Fila média = entradas x tempo médio. Se a
fila média de pedidos vivos já for maior do que entradas x prazo, o prazo não se cumpre sem a baixar. A fila no painel
inclui os pedidos parados que ninguém fechou.</p>
{_little(s)}

<h2>Tempo atual em cada estado</h2>
{_tempos(s)}

<h2>Como ajustar</h2>
<ol class="passos">
<li>Copia <code>saida/prazos_propostos.toml</code> para a secção <code>[prazos]</code> do <code>config.toml</code> e muda os
números que o chefe quiser.</li>
<li>Corre outra vez <code>python -m funil sombra</code>. Os prazos da configuração passam a valer e aparecem na tabela de
comparação como "Em uso".</li>
<li>Para quando o vermelho for raro (no máximo 2 em cada 10 pedidos por estado, sem contar os que nunca fecharam) e útil
(um vermelho perde-se bem mais vezes do que um verde, e aparece antes da maior parte das cobranças).</li>
</ol>

<footer>Gerado pelo funil de pedidos MDM. Os mesmos números estão em saida/sombra_prazos.csv,
saida/sombra_cenarios.csv, saida/sombra_little.csv e saida/sombra_tempos.csv.</footer>
</div></body></html>
"""


def toml_prazos(s: Sombra) -> str:
    linhas = [f"# Prazos propostos pelo modo sombra com os dados até {s.hoje:%d/%m/%Y}.",
              "# Depois de validar, copia esta secção para o config.toml e corre de novo: python -m funil sombra",
              "# Unidades: novo em horas úteis; espera_cliente em dias de calendário; os outros (também as visitas e a",
              "# espera de peça) em dias úteis.",
              "[prazos]"]
    for est in s.estados:
        vals = [(c, s.propostos.get((est.chave, c))) for c in CLASSES]
        com = [(c, v) for c, v in vals if v is not None]
        sem = [c for c, v in vals if v is None]
        if com:
            nota = f"   # {', '.join(sem)}: poucos casos, escreve à mão" if sem else ""
            linhas.append(f"{est.chave} = {{ " + ", ".join(f"{c} = {v:g}" for c, v in com) + " }" + nota)
        else:
            linhas.append(f"# {est.chave}: poucos casos para propor; escreve os valores à mão")
    if s.por_medir:
        linhas.append("# Ainda sem dados para propor:")
    for est, falta in s.por_medir:
        linhas.append(f"# {est.chave} = {{ P1 = 0, P2 = 0, P3 = 0 }}   (precisa {falta})")
    return "\n".join(linhas) + "\n"


def escrever_sombra(s: Sombra, pasta: Path) -> list[Path]:
    pasta.mkdir(parents=True, exist_ok=True)
    linhas = []
    for est in s.estados:
        for c in CLASSES:
            f = s.replay["fora"].get((est.chave, c)) or {}
            g = s.simulado.get((est.chave, c)) or {}
            linhas.append([est.chave, est.unidade, c, _n(s.prazos[(est.chave, c)], 1), s.origem[(est.chave, c)],
                           s.fonte[(est.chave, c)], f.get("total", ""), f.get("fechados", ""), f.get("fechados_fora", ""),
                           f.get("abertos", ""), g.get("fechados", ""), g.get("fechados_fora", "")])
    _escrever(pasta / "sombra_prazos.csv",
              ["estado", "unidade", "prioridade", "prazo", "origem", "de_onde", "pedidos", "fecharam",
               "fecharam_fora_do_prazo", "nunca_fecharam", "fecharam_ordem_p", "fora_do_prazo_ordem_p"], linhas)
    linhas = []
    for (chave, grupo), t in sorted(s.tabela.items()):
        linhas.append([chave, grupo, t["n"], _n(t["p50"]), _n(t["p80"]), _n(t["p90"]), _n(t["media"]),
                       POR_CHAVE[chave].unidade])
    for (chave, c), t in sorted(s.simulados.items()):
        linhas.append([chave, f"{c} com a ordem por P", t["n"], _n(t["p50"]), _n(t["p80"]), _n(t["p90"]),
                       _n(t["media"]), POR_CHAVE[chave].unidade])
    _escrever(pasta / "sombra_tempos.csv", ["estado", "grupo", "n", "p50", "p80", "p90", "media", "unidade"], linhas)
    _escrever(pasta / "sombra_cenarios.csv",
              ["prazos", "perdidos", "perdidos_vermelhos_a_tempo", "ganhos", "ganhos_vermelhos", "perda_se_vermelho",
               "perda_se_verde", "vezes_mais", "cobrados", "cobrados_com_aviso", "vermelhos_por_manha"],
              [[c["nome"], c["perdidos"], c["perdidos_vermelhos"], c["ganhos"], c["ganhos_vermelhos"],
                _n(c["perda_se_vermelho"], 3), _n(c["perda_se_verde"], 3), _n(c["razao"]), c["cobrados"],
                c["cobrados_com_aviso"], _n((c["manha"].get("regra") or {}).get("vermelhos"), 1)] for c in s.cenarios])
    _escrever(pasta / "sombra_little.csv",
              ["estado", "entradas_semana", "saidas_semana", "fila_vivos", "fila_painel", "tempo_medio_dias_uteis",
               "prazo_medio_dias_uteis", "fila_maxima"],
              [[l["estado"], _n(l["entradas_semana"]), _n(l["saidas_semana"]), _n(l["fila_vivos"]), _n(l["fila_painel"]),
                _n(l["espera_media"]), _n(l["prazo_medio"]), _n(l["fila_maxima"])] for l in s.little])
    (pasta / "prazos_propostos.toml").write_text(toml_prazos(s), encoding="utf-8")
    (pasta / "sombra.html").write_text(gerar_html_sombra(s), encoding="utf-8")
    return [pasta / n for n in ("sombra.html", "prazos_propostos.toml", "sombra_prazos.csv", "sombra_cenarios.csv",
                                "sombra_little.csv", "sombra_tempos.csv")]
