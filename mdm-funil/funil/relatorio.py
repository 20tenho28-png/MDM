"""Relatório HTML com a linha de base do funil, o gargalo e as prioridades (pensado para mostrar ao chefe)."""

from __future__ import annotations

import html
import math
from datetime import date
from pathlib import Path

from .analise import incluidos, janela
from .motor import Resultado
from .prioridade import minimo_teste

# ---------------------------------------------------------------- formatação


def esc(s) -> str:
    return html.escape(str(s), quote=True)


def num(v, casas: int = 0) -> str:
    if v is None:
        return "–"
    s = f"{v:,.{casas}f}"
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def pct(v, casas: int = 0) -> str:
    return "–" if v is None else f"{num(v * 100, casas)}%"


def eur(v) -> str:
    return "–" if v is None else f"{num(v)} €"


def ic(t) -> str:
    return "" if not t else f"{num(t[0] * 100)} a {num(t[1] * 100)}%"


def dt(d) -> str:
    return "–" if d is None else d.strftime("%d/%m/%Y")


def _tabela(cabecalho: list[str], linhas: list[list], numericas: set[int] = frozenset(), classe: str = "") -> str:
    th = "".join(f'<th class="{"n" if i in numericas else ""}">{esc(c)}</th>' for i, c in enumerate(cabecalho))
    corpo = "".join("<tr>" + "".join(f'<td class="{"n" if i in numericas else ""}">{c}</td>' for i, c in enumerate(l))
                    + "</tr>" for l in linhas)
    return f'<div class="tw"><table class="{classe}"><thead><tr>{th}</tr></thead><tbody>{corpo}</tbody></table></div>'


# ---------------------------------------------------------------- gráficos SVG


def _ticks(vmin: float, vmax: float, inteiros: bool = False, alvo: int = 5) -> tuple[list[float], float]:
    """Marcas "redondas" para um eixo (1, 2, 2,5 ou 5 vezes uma potência de 10)."""
    if vmax <= vmin:
        vmax = vmin + 1
    bruto = (vmax - vmin) / alvo
    potencia = 10 ** math.floor(math.log10(bruto))
    passo = potencia * 10
    for m in ((1, 2, 5, 10) if inteiros else (1, 2, 2.5, 5, 10)):
        if m * potencia >= bruto:
            passo = m * potencia
            break
    if inteiros:
        passo = max(1.0, round(passo))
    inicio = math.floor(vmin / passo + 1e-9) * passo
    fim = math.ceil(vmax / passo - 1e-9) * passo
    marcas, t = [], inicio
    while t <= fim + passo * 1e-6:
        marcas.append(round(t, 10))
        t += passo
    return marcas, passo


def _barras_taxa(linhas: list[dict]) -> str:
    """Barras horizontais de taxa de ganho com intervalo de confiança."""
    dados = [l for l in linhas if l["n"] > 0]
    if not dados:
        return '<p class="vazio">Ainda não há pedidos maduros com o contacto inicial registado.</p>'
    topo = max(max((l["ic"][1] if l["ic"] else l["taxa"] or 0) for l in dados), 0.1)
    escala = math.ceil(topo * 10) / 10
    larg, esq, dir_ = 880, 210, 760
    alt = 34 * len(dados) + 36
    x = lambda v: esq + (dir_ - esq) * (v / escala)
    partes = [f'<svg class="graf" viewBox="0 0 {larg} {alt}" width="100%" role="img" '
              f'aria-label="Taxa de ganho por tempo de primeira resposta">']
    passo = 0.1 if escala <= 0.5 else 0.2
    t = 0.0
    while t <= escala + 1e-9:
        partes.append(f'<line x1="{x(t):.1f}" x2="{x(t):.1f}" y1="8" y2="{alt - 24}" class="grelha"/>'
                      f'<text x="{x(t):.1f}" y="{alt - 8}" class="eixo" text-anchor="middle">{num(t * 100)}%</text>')
        t += passo
    for i, l in enumerate(dados):
        y = 14 + i * 34
        partes.append(f'<text x="{esq - 10}" y="{y + 11}" class="rot" text-anchor="end">{esc(l["faixa"])}</text>')
        if l["taxa"] is not None:
            partes.append(f'<rect x="{esq}" y="{y}" width="{max(1.0, x(l["taxa"]) - esq):.1f}" height="15" rx="2" class="barra"/>')
        if l["ic"]:
            lo, hi = x(l["ic"][0]), x(l["ic"][1])
            partes.append(f'<line x1="{lo:.1f}" x2="{hi:.1f}" y1="{y + 7.5}" y2="{y + 7.5}" class="ic"/>'
                          f'<line x1="{lo:.1f}" x2="{lo:.1f}" y1="{y + 2}" y2="{y + 13}" class="ic"/>'
                          f'<line x1="{hi:.1f}" x2="{hi:.1f}" y1="{y + 2}" y2="{y + 13}" class="ic"/>')
            fim = hi
        else:
            fim = x(l["taxa"] or 0)
        partes.append(f'<text x="{min(fim + 8, larg - 60):.1f}" y="{y + 11}" class="val">{pct(l["taxa"])} · n={l["n"]}</text>')
    partes.append("</svg>")
    return '<div class="gw">' + "".join(partes) + "</div>"


def _xmr_svg(semanas: list[date], valores: list, lim: dict | None, rotulo: str, casas: int = 1) -> str:
    pontos = [(i, v) for i, v in enumerate(valores) if v is not None]
    if not lim or len(pontos) < 3:
        return '<p class="vazio">Ainda não há semanas suficientes para este gráfico.</p>'
    larg, alt, me, md, mt, mb = 880, 260, 46, 14, 14, 34
    vmax = max(max(v for _, v in pontos), lim["sup"])
    vmin = min(min(v for _, v in pontos), max(0.0, lim["inf"]))
    marcas, passo = _ticks(max(0.0, vmin), vmax, inteiros=(casas == 0))
    y0, y1 = marcas[0], marcas[-1]
    n = len(valores)
    x = lambda i: me + (larg - me - md) * (i / max(1, n - 1))
    y = lambda v: mt + (alt - mt - mb) * (1 - (v - y0) / (y1 - y0))
    partes = [f'<svg class="graf" viewBox="0 0 {larg} {alt}" width="100%" role="img" aria-label="{esc(rotulo)}">']
    for v in marcas:
        partes.append(f'<line x1="{me}" x2="{larg - md}" y1="{y(v):.1f}" y2="{y(v):.1f}" class="grelha"/>'
                      f'<text x="{me - 6}" y="{y(v) + 4:.1f}" class="eixo" text-anchor="end">{num(v, 0 if passo >= 1 else 1)}</text>')
    salto = max(1, math.ceil(n / 8))
    for i in range(0, n, salto):
        ancora = "end" if x(i) > larg - md - 24 else "middle"   # a última data não fica cortada
        partes.append(f'<text x="{x(i):.1f}" y="{alt - 12}" class="eixo" text-anchor="{ancora}">{semanas[i]:%d/%m}</text>')
    if lim["n_base"] < lim["n"]:
        corte = pontos[lim["n_base"]][0]
        partes.append(f'<line x1="{x(corte) - 4:.1f}" x2="{x(corte) - 4:.1f}" y1="{mt}" y2="{alt - mb}" class="mudanca"/>'
                      f'<text x="{x(corte):.1f}" y="{mt + 10}" class="eixo">mudança</text>')
    partes.append(f'<line x1="{me}" x2="{larg - md}" y1="{y(lim["centro"]):.1f}" y2="{y(lim["centro"]):.1f}" class="centro"/>')
    for chave in ("sup", "inf"):
        v = lim[chave]
        if y0 <= v <= y1:
            partes.append(f'<line x1="{me}" x2="{larg - md}" y1="{y(v):.1f}" y2="{y(v):.1f}" class="limite"/>')
    caminho = " ".join(f"{'M' if k == 0 else 'L'}{x(i):.1f},{y(v):.1f}" for k, (i, v) in enumerate(pontos))
    partes.append(f'<path d="{caminho}" class="serie"/>')
    for i, v in pontos:
        sinal = i in lim["sinais"]
        titulo = f"{semanas[i]:%d/%m/%Y}: {num(v, casas)}" + (" · " + ", ".join(lim["sinais"][i]) if sinal else "")
        partes.append(f'<circle cx="{x(i):.1f}" cy="{y(v):.1f}" r="{4.5 if sinal else 2.8}" class="{"sinal" if sinal else "ponto"}">'
                      f'<title>{esc(titulo)}</title></circle>')
    partes.append("</svg>")
    return '<div class="gw">' + "".join(partes) + "</div>"


# ---------------------------------------------------------------- texto


_MOTIVOS = {"preço": "Cliente recusou: preço", "prazo": "Cliente recusou: prazo",
            "foi com outra empresa": "Cliente foi com outra empresa", "desistiu ou adiou": "Cliente desistiu ou adiou",
            "sem resposta depois do orçamento": "Silêncio depois do orçamento",
            "a MDM nunca respondeu": "A MDM nunca respondeu", "sem orçamento enviado": "Respondido, mas sem orçamento"}


def _resumo(r: Resultado) -> list[str]:
    ps = incluidos(r.pedidos)
    if not ps:
        return ["Não há pedidos. Confirma que os ficheiros estão nas pastas certas dentro de dados/."]
    total = r.funil[-1]
    inicio, fim = janela(r.pedidos)
    semanas = max(1.0, (fim - inicio).days / 7)
    canais = sorted((l for l in r.funil[:-1]), key=lambda l: -l["pedidos"])
    partes_canal = ", ".join(f"{l['canal'].lower()} {pct(l['pedidos'] / total['pedidos'])}" for l in canais[:4])
    frases = [f"<b>{len(ps)} pedidos</b> entre {dt(inicio)} e {dt(fim)}, cerca de {num(len(ps) / semanas, 1)} por semana "
              f"({partes_canal})."]
    e = r.esperas
    if r.tempos[0]["n"] and e["n"]:
        frases.append(f"Primeira resposta: mediana de <b>{num(r.tempos[0]['mediana'], 1)} horas úteis</b> nos pedidos "
                      f"respondidos; {pct(e['mais_de_um_dia'])} dos pedidos esperaram mais de um dia útil, contando os "
                      f"{pct(e['sem_resposta'])} que nunca tiveram resposta.")
    dias_mat = r.cfg["pedidos"]["dias_maturidade"]
    if total["decididos"]:
        frases.append(f"{pct(total['com_orcamento'] / total['pedidos'])} dos pedidos receberam orçamento. Dos pedidos com "
                      f"mais de {dias_mat} dias, <b>{pct(total['taxa_ganho'])} foram ganhos</b> (intervalo "
                      f"{ic(total['ic_ganho'])}, n={total['decididos']}); dos que tiveram orçamento, "
                      f"{pct(total['taxa_ganho_orc'])}.")
    g = r.gargalo
    if g.get("maior_fila"):
        m = next(l for l in g["etapas"] if l["etapa"] == g["maior_fila"])
        frases.append(f"Do lado da MDM, a maior fila está em <b>«{esc(m['etapa'])}»</b>: em média "
                      f"{num(m['em_fila_media'], 1)} pedidos parados, cerca de {num(m['tempo_medio'], 0)} dias cada.")
    if g.get("silenciosos"):
        frases.append(f"{g['silenciosos']} orçamentos nunca tiveram resposta do cliente: é aí que o seguimento "
                      "(follow-up) pode recuperar trabalho.")
    vel = [l for l in r.velocidade if l["faixa"] != "sem resposta" and l["n"] >= 10]
    if len(vel) >= 2:
        a, b = vel[0], vel[-1]
        frases.append(f"Pedidos respondidos em {a['faixa']} ganharam <b>{pct(a['taxa'])}</b> ({ic(a['ic'])}, n={a['n']}); "
                      f"com {b['faixa']}, <b>{pct(b['taxa'])}</b> ({ic(b['ic'])}, n={b['n']}).")
    if r.efeito:
        e = r.efeito
        lo, hi = e["pp_ic"]
        frases.append(f"Pelo modelo, cada dia útil a mais até à primeira resposta tira em média "
                      f"<b>{num(e['pp_por_dia'] * 100, 1)} pontos percentuais</b> à probabilidade de ganhar "
                      f"(95%: {num(lo * 100, 1)} a {num(hi * 100, 1)})" +
                      ("." if hi < 0 or lo > 0 else "; com estes dados ainda não se distingue do acaso."))
    if r.segmentos:
        s = r.segmentos[0]
        if s["custo_atraso"] > 0:
            frases.append(f"Onde a demora custa mais: <b>{esc(s['rotulo'])}</b>. Responder em "
                          f"{num(r.cfg['prioridade']['horas_lenta'])} horas úteis em vez de "
                          f"{num(r.cfg['prioridade']['horas_rapida'])} custa em média {eur(s['custo_atraso'])} de valor "
                          f"esperado por pedido (95%: {eur(s['custo_ic'][0])} a {eur(s['custo_ic'][1])}).")
    if r.teste:
        cap, quota = {}, {}
        for nome, classes in r.teste["regras"].items():
            cap[nome] = sum(c["pct_valor"] or 0 for c in classes if c["classe"] in ("P1", "P2"))
            quota[nome] = sum(c["pct_pedidos"] or 0 for c in classes if c["classe"] in ("P1", "P2"))
        frases.append(f"No teste com os {r.teste['n_teste']} pedidos maduros mais recentes, a regra sugerida pôs "
                      f"<b>{pct(cap['Regra sugerida'])} do valor ganho em P1 e P2</b>, com {pct(quota['Regra sugerida'])} "
                      f"dos pedidos; a regra atual, {pct(cap['Regra atual'])} com {pct(quota['Regra atual'])}.")
    return frases


# ---------------------------------------------------------------- secções


def _contactos(chaves) -> list[str]:
    """Chaves internas (tel:, email:, wa:) em texto legível, sem repetir a conversa de um número já listado."""
    from .fontes.whatsapp import nome_da_conversa
    from .texto import telefone_norm
    tels = {k[4:] for k in chaves if k.startswith("tel:")}
    saida = []
    for k in sorted(chaves):
        tipo, _, valor = k.partition(":")
        if tipo == "wa":
            nome = nome_da_conversa(Path(valor))
            if telefone_norm(nome) in tels:
                continue
            saida.append(f"conversa de WhatsApp «{nome}»")
        else:
            saida.append(valor)
    return saida


def _cobertura(r: Resultado) -> str:
    linhas = []
    for f, c in r.cobertura["fontes"].items():
        periodo = f"{dt(c['inicio'])} a {dt(c['fim'])}" if c["inicio"] else "–"
        detalhe = ", ".join(f"{esc(k)}: {v}" for k, v in c["detalhe"].items())
        linhas.append([esc(c["descricao"]), num(c["ficheiros"]), num(c["eventos"]), periodo,
                       f'<span class="sub det">{detalhe}</span>'])
    t = _tabela(["Fonte", "Ficheiros", "Registos usados", "Período", "Detalhe"], linhas, {1, 2})
    avisos = list(r.cobertura["avisos"])
    sem_pedido = [p for p in r.pedidos if p.confianca == "fatura sem pedido"]
    if sem_pedido:
        avisos.append(f"{len(sem_pedido)} faturas ({eur(sum(p.valor_fatura or 0 for p in sem_pedido))}) não ficaram ligadas "
                      "a nenhum pedido (cliente sem telefone, email ou número ORC em comum com um contacto). Estão em "
                      "saida/rever_ligacoes.csv e ficam fora do funil.")
    orc_sem = [p for p in r.pedidos if p.confianca == "orçamento sem contacto"]
    if orc_sem:
        sugestoes = sum(1 for l in r.ligacoes if l["situacao"].startswith("orçamento sem contacto"))
        avisos.append(f"{len(orc_sem)} orçamentos não têm contacto inicial registado (pedido por um canal sem registo, "
                      "como o telefone fixo, ou cliente que ligou e recebeu o orçamento por email). Contam no funil a "
                      "partir do orçamento, mas não nos tempos de resposta." +
                      (f" Para {sugestoes} há um pedido sem orçamento pouco antes que pode ser o mesmo: confirma-os em "
                       "saida/rever_ligacoes.csv." if sugestoes else ""))
    por_confirmar = [p for p in incluidos(r.pedidos) if p.t_envio and not p.envio_confirmado]
    if por_confirmar:
        avisos.append(f"{len(por_confirmar)} orçamentos não aparecem em nenhuma mensagem enviada (email ou WhatsApp com o "
                      "número ORC ou o PDF). O funil usou a data do ORC como data de envio, mas não sabe se foram "
                      "enviados: estão como envio por confirmar (coluna envio_confirmado em saida/pedidos.csv).")
    baixa = [p for p in r.pedidos if p.confianca == "baixa" and not p.revisto]
    if baixa:
        avisos.append(f"{len(baixa)} conversas sem sinais de pedido ficaram de fora. Confirma-as em revisao/pedidos.csv "
                      "(coluna incluir).")
    if r.partilhados:
        avisos.append("Contactos ligados a clientes diferentes (técnicos, parceiros, a própria MDM) foram ignorados, com "
                      "as mensagens trocadas com eles: " + ", ".join(esc(x) for x in _contactos(r.partilhados)) +
                      ". Se algum for de um só cliente, escreve-o em [pedidos] nunca_partilhados no config.toml.")
    sem_texto = [p for p in incluidos(r.pedidos) if p.t_contacto and not p.caracteristicas.get("com_texto")]
    if sem_texto:
        avisos.append(f"{len(sem_texto)} pedidos (sobretudo chamadas) não têm texto, por isso o tipo de trabalho é "
                      "desconhecido. Podes preencher o tipo em revisao/pedidos.csv.")
    if r.contagem:
        avisos.append("Ficaram de fora da análise: " + "; ".join(f"{num(n)} {esc(k)}" for k, n in sorted(r.contagem.items()))
                      + (". As mensagens da MDM sem pedido aberto são, por exemplo, contactos com fornecedores."
                         if "contactos da MDM sem pedido aberto" in r.contagem else "."))
    if r.corrigidos:
        avisos.append(f"{r.corrigidos} pedidos foram corrigidos à mão em revisao/pedidos.csv.")
    lista = "".join(f"<li>{a}</li>" for a in avisos)
    return t + (f'<ul class="avisos">{lista}</ul>' if lista else "")


def _funil(r: Resultado) -> str:
    linhas = [[esc(l["canal"]) if l["canal"] != "Total" else "<b>Total</b>", num(l["pedidos"]),
               f"{num(l['respondidos'])} de {num(l['com_contacto'])}" if l["com_contacto"] else "–",
               num(l["com_orcamento"]), num(l["decididos"]), num(l["ganhos"]),
               f"{pct(l['taxa_ganho'])}<span class='sub bl'>{ic(l['ic_ganho'])}</span>",
               f"{pct(l['taxa_ganho_orc'])}<span class='sub bl'>{ic(l['ic_ganho_orc'])}</span>",
               eur(l["valor_ganho"])] for l in r.funil]
    return _tabela(["Canal", "Pedidos", "Respondidos", "Com orçamento", "Maduros", "Ganhos (maduros)", "Taxa de ganho",
                    "Ganho com orçamento", "Valor ganho s/IVA"], linhas, {1, 2, 3, 4, 5, 6, 7, 8})


def _tempos(r: Resultado) -> str:
    linhas = [[esc(t["etapa"]), num(t["n"]), num(t["mediana"], 1), num(t["p80"], 1), esc(t["unidade"])] for t in r.tempos]
    return _tabela(["Etapa", "Pedidos", "Mediana", "80% demoram até", "Unidade"], linhas, {1, 2, 3})


def _gargalo(r: Resultado) -> str:
    g = r.gargalo
    if not g["etapas"]:
        return '<p class="vazio">Sem dados.</p>'
    linhas = []
    for e in g["etapas"]:
        destaque = e["etapa"] == g["maior_fila"]
        nome = f"<b>{esc(e['etapa'])}</b>" if destaque else esc(e["etapa"])
        linhas.append([nome, "MDM" if e["lado"] == "MDM" else "cliente", num(e["entradas_semana"], 1),
                       num(e["tempo_medio"], 1), num(e["em_fila_media"], 1), num(e["em_fila_agora"]),
                       pct(e["sairam_sem_avancar"])])
    return (_tabela(["Etapa", "Depende de", "Entram por semana", "Tempo médio (dias)", "Parados em média",
                     "Parados agora", "Saem sem avançar"], linhas, {2, 3, 4, 5, 6}) +
            '<p class="nota">Parados em média = entradas por semana × tempo médio (lei de Little), com o tempo que cada '
            'pedido passou na etapa. Nas etapas que dependem da MDM, a fila maior (a negrito) é onde falta capacidade; '
            f'um pedido nunca respondido conta como parado até {r.cfg["pedidos"]["dias_sem_orcamento"]} dias, e um '
            'pedido respondido que nunca teve orçamento conta até ao último contacto. Na etapa que depende do cliente, a '
            'ação é o seguimento: um orçamento sem resposta conta até ao último contacto e não até ao fim do prazo. '
            f'{g.get("silenciosos", 0)} orçamentos nunca tiveram resposta do cliente. «Saem sem avançar» mostra onde os '
            'pedidos se perdem.</p>')


def _motivos(r: Resultado) -> str:
    if not r.motivos:
        return '<p class="vazio">Ainda não há pedidos perdidos.</p>'
    linhas = [[esc(_MOTIVOS.get(m["motivo"]) or m["motivo"][:1].upper() + m["motivo"][1:]), num(m["n"]), pct(m["pct"])]
              for m in r.motivos]
    return (_tabela(["Motivo", "Pedidos", "Parte das perdas"], linhas, {1, 2}) +
            '<p class="nota">Os motivos «recusou» vêm das mensagens dos clientes depois do orçamento (palavras como '
            '«outra empresa», «caro», «desistir»). Confirma os casos em revisao/pedidos.csv, coluna decisao_detetada.</p>')


def _efeito(r: Resultado) -> str:
    e = r.efeito
    if not e:
        return ""
    lo, hi = e["pp_ic"]
    claro = hi < 0 or lo > 0
    return (f'<p><b>Modelo com os {e["n"]} pedidos maduros</b> (os que nunca tiveram resposta entram com a espera '
            f'máxima de {num(r.cfg["prioridade"]["limite_horas"])} horas úteis): cada dia útil a mais até à primeira resposta '
            f'{"tira" if e["pp_por_dia"] >= 0 else "acrescenta"} em média <b>{num(abs(e["pp_por_dia"]) * 100, 1)} pontos '
            f'percentuais</b> à probabilidade de ganhar (95%: {num(lo * 100, 1)} a {num(hi * 100, 1)}). '
            + ("O intervalo não inclui zero, por isso o efeito é distinguível do acaso nestes dados." if claro else
               "O intervalo inclui zero: com estes dados ainda não se consegue distinguir o efeito do acaso.") + "</p>")


def _segmentos(r: Resultado) -> str:
    pr = r.cfg["prioridade"]
    if not r.segmentos:
        return (f'<p class="vazio">São precisos pelo menos {pr["minimo_modelo"]} pedidos maduros (com mais de '
                f'{r.cfg["pedidos"]["dias_maturidade"]} dias), com ganhos e perdas.</p>')
    quota_p1 = sum(s["pct_pedidos"] for s in r.segmentos if s["prioridade"] == "P1")
    quota_p12 = sum(s["pct_pedidos"] for s in r.segmentos if s["prioridade"] in ("P1", "P2"))
    linhas = []
    for s in r.segmentos:
        aviso = []
        if s["poucos_dados"]:
            aviso.append("poucos dados")
        if s["valor_estimado"]:
            aviso.append(s["origem_valor"])
        if s.get("incerto"):
            aviso.append("incerto: o intervalo chega ao nível de P1")
        obs_r = f"obs. {pct(s['obs_rapida'])}, n={s['n_rapida']}" if s["n_rapida"] else "sem casos"
        obs_l = f"obs. {pct(s['obs_lenta'])}, n={s['n_lenta']}" if s["n_lenta"] else "sem casos"
        nome = esc(s["rotulo"]) + (f"<span class='sub bl aviso'>{esc(', '.join(aviso))}</span>" if aviso else "")
        linhas.append([nome, num(s["n"]), f"{pct(s['taxa'])}<span class='sub bl'>{ic(s['ic'])}</span>",
                       f"{pct(s['p_rapida'])}<span class='sub bl'>{obs_r}</span>",
                       f"{pct(s['p_lenta'])}<span class='sub bl'>{obs_l}</span>",
                       eur(s["valor"]),
                       f"<b>{eur(s['custo_atraso'])}</b><span class='sub bl'>{eur(s['custo_ic'][0])} a {eur(s['custo_ic'][1])}</span>",
                       f'<span class="p p{s["prioridade"][1]}">{s["prioridade"]}</span>'])
    return (_tabela(["Segmento", "Maduros", "Taxa de ganho", f"Ganha em {num(pr['horas_rapida'])} h úteis",
                     f"Ganha em {num(pr['horas_lenta'])} h úteis", "Valor típico", "Custo do atraso",
                     "Prioridade"], linhas, {1, 2, 3, 4, 5, 6}) +
            f'<p class="nota">As probabilidades vêm de uma regressão logística do resultado em função dos dias úteis até à '
            f'primeira resposta, com um nível e uma inclinação por segmento. Cada segmento é puxado para a média de todos, '
            f'por isso um segmento com poucos pedidos fica perto da média em vez de parecer extremo por acaso; as linhas '
            f'«observado» mostram os números brutos. Custo do atraso = (probabilidade com resposta em '
            f'{num(pr["horas_rapida"])} h − probabilidade em {num(pr["horas_lenta"])} h) × valor típico de um trabalho do '
            f'segmento (mediana dos valores dos orçamentos e das faturas), com intervalo de 95%. Os pedidos que nunca tiveram '
            f'resposta entram com a espera máxima ({num(pr["limite_horas"])} horas úteis). Os segmentos com maior custo do '
            f'atraso vão para P1 até cerca de {pct(pr["quota_p1"])} dos pedidos e para P2 até {pct(pr["quota_p1p2"])} '
            f'(um segmento não se divide, por isso as quotas são aproximadas: aqui P1 ficou com {pct(quota_p1)} e P1+P2 '
            f'com {pct(quota_p12)}); ajusta as quotas à capacidade da equipa no config.toml. Um segmento marcado '
            f'«incerto» não está provado como menos urgente: o intervalo é largo e chega ao nível de P1, por isso '
            f'decide-o à mão até haver mais pedidos.</p>')


def _teste(r: Resultado) -> str:
    t = r.teste
    if not t:
        return (f'<p class="vazio">Ainda não há pedidos maduros suficientes para testar as regras (são precisos pelo menos '
                f'{minimo_teste(r.cfg)}, com o contacto inicial registado).</p>')
    linhas = []
    for nome, classes in t["regras"].items():
        for c in classes:
            rap_len = (f"{pct(c['taxa_rapida'])} vs {pct(c['taxa_lenta'])}<span class='sub bl'>n={c['n_rapida']} e {c['n_lenta']}</span>"
                       if c["n_rapida"] or c["n_lenta"] else "–")
            linhas.append([esc(nome) if c["classe"] == "P1" else "", f'<span class="p p{c["classe"][1]}">{c["classe"]}</span>',
                           f"{num(c['n'])}<span class='sub bl'>{pct(c['pct_pedidos'])} dos pedidos</span>",
                           f"{pct(c['taxa'])}<span class='sub bl'>{ic(c['ic'])}</span>",
                           f"{eur(c['valor_ganho'])}<span class='sub bl'>{pct(c['pct_valor'])} do valor</span>", rap_len])
    return (f'<p>As regras sugeridas foram calculadas só com os {t["n_treino"]} pedidos maduros até {dt(t["fim_treino"])} e '
            f'aplicadas aos {t["n_teste"]} seguintes ({dt(t["inicio_teste"])} a {dt(t["fim_teste"])}), que não viram. '
            'Uma boa regra põe em P1 e P2 a maior parte do valor ganho com poucos pedidos, e os pedidos onde a resposta '
            'rápida mais conta. Compara sempre o valor captado com a parte dos pedidos que cada regra pôs em P1 e P2.</p>'
            + _tabela(["Regra", "Classe", "Pedidos", "Taxa de ganho", "Valor ganho", "Rápida vs lenta"], linhas, {2, 3, 4, 5}))


def _semanal(r: Resultado) -> str:
    sinais_r = r.xmr_resposta["sinais"] if r.xmr_resposta else {}
    sinais_g = r.xmr_ganhos["sinais"] if r.xmr_ganhos else {}
    partes = ['<h3>Mediana da primeira resposta (horas úteis), por semana</h3>',
              _xmr_svg(r.semanas_xmr, [s["mediana_resposta"] for s in r.semanal if not s["parcial"]], r.xmr_resposta,
                       "Mediana semanal da primeira resposta"),
              '<h3>Pedidos ganhos em cada 4 semanas</h3>',
              _xmr_svg(r.periodos_ganhos, r.ganhos_periodo, r.xmr_ganhos, "Pedidos ganhos em cada 4 semanas", casas=0)]
    lista = []
    for nome, sinais, datas in (("Primeira resposta", sinais_r, r.semanas_xmr),
                                ("Ganhos", sinais_g, r.periodos_ganhos)):
        for i, regras in sorted(sinais.items()):
            periodo = "semana" if datas is r.semanas_xmr else "4 semanas"
            lista.append(f"<li>{nome}, {periodo} a partir de {datas[i]:%d/%m/%Y}: {esc(', '.join(regras))}</li>")
    partes.append('<p class="nota">A linha contínua é a média e as tracejadas são os limites naturais do processo '
                  '(média ± 2,66 × amplitude móvel média). Um ponto fora dos limites, 3 de 4 pontos perto de um limite '
                  'ou 8 pontos seguidos do mesmo lado da média são sinais de que algo mudou mesmo; o resto é variação '
                  'normal. Os ganhos são poucos por semana, por isso o segundo gráfico soma blocos de 4 semanas: com '
                  'contagens tão pequenas, um gráfico semanal mostraria «sinais» que são só acaso. Quando mudarem o '
                  'processo, escreve a data em [semanal] data_mudanca no config.toml: os pontos anteriores passam a ser '
                  'a base dos limites.</p>')
    if lista:
        partes.append(f'<details><summary>{len(lista)} sinais assinalados</summary><ul>{"".join(lista)}</ul></details>')
    return "".join(partes)


def _passos(r: Resultado) -> str:
    return """<ol class="passos">
<li><b>Rever os pedidos.</b> Em <code>revisao/pedidos.csv</code>, corrige as colunas <i>incluir</i>, <i>tipo</i>, <i>empresa</i>,
<i>resultado</i> e <i>motivo</i> onde o cálculo falhou (por exemplo, chamadas sem texto ou decisões ambíguas). Volta a correr a análise.</li>
<li><b>Confirmar ligações.</b> Vê <code>saida/rever_ligacoes.csv</code>. Para juntar dois contactos do mesmo cliente, escreve-os em
<code>revisao/ligacoes.csv</code> (ex.: <code>nif:500000017</code> e <code>tel:+351910000017</code>, ou um orçamento sem contacto e
a chamada sugerida: <code>orc:ORC0034_2026</code> e <code>tel:+351910000017</code>).</li>
<li><b>Testar as regras com pessoas.</b> Corre <code>python -m funil amostra</code>. Tu e o teu chefe classificam P1/P2/P3 nos dois
ficheiros, cada um sem ver o outro, e depois <code>python -m funil concordancia saida/amostra_A.csv saida/amostra_B.csv</code>.
Só adotem as regras quando o kappa for de pelo menos 0,7.</li>
<li><b>Medir a mudança.</b> No dia em que mudarem o processo (por exemplo, responder a tudo em 4 horas úteis), escreve essa data em
<code>data_mudanca</code> e repete a análise todas as semanas. O gráfico semanal mostra se a mudança é real.</li>
</ol>"""


_CSS = """
:root{--bg:#F2F5F6;--surface:#FFFFFF;--sunk:#E7ECEE;--ink:#13212B;--ink-2:#4C5D68;--line:#D2DBE0;--accent:#0D6788;
--copper:#9C5224;--good:#1D7448;--warn:#9A6200;--bad:#B03535;--info:#3A5BA0;
--display:"Barlow Semi Condensed","Arial Narrow",system-ui,sans-serif;--body:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
--mono:"IBM Plex Mono",ui-monospace,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#0E161B;--surface:#152028;--sunk:#0B1216;--ink:#E4ECF0;--ink-2:#9AAEB9;
--line:#263540;--accent:#5DB8DD;--copper:#E39A68;--good:#62C994;--warn:#E6B450;--bad:#F08A8A;--info:#93ABEB;color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 var(--body)}
.wrap{max-width:1040px;margin:0 auto;padding:28px max(16px,env(safe-area-inset-left,0px)) 64px}
h1,h2,h3{font-family:var(--display);margin:0;text-wrap:balance}
h1{font-size:38px;font-weight:600;line-height:1.05}
h2{font-size:24px;font-weight:600;margin:40px 0 10px}
h3{font-size:17px;font-weight:600;margin:20px 0 6px;color:var(--ink-2)}
.eyebrow{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-2);font-weight:500}
.meta{color:var(--ink-2);font-size:13.5px;margin-top:6px}
.exemplo{margin:18px 0 0;padding:10px 14px;border:1px solid var(--warn);border-radius:8px;color:var(--warn);font-weight:600;background:color-mix(in srgb,var(--warn) 10%,transparent)}
.resumo{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px 20px 16px 36px;margin:22px 0 0}
.resumo li{margin:6px 0;max-width:78ch}
.tw{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:14px}
.tw table{min-width:640px}
.gw{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px;margin:6px 0}
.gw .graf{min-width:620px;border:0;margin:0;border-radius:0}
th{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-2);font-weight:500;text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:bottom}
td{padding:8px 10px;border-top:1px solid var(--line);vertical-align:top}
tbody tr:first-child td{border-top:0}
.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
th.n{white-space:normal}
.sub{color:var(--ink-2);font-size:12px}
.sub.bl{display:block;margin-top:1px}
.det{display:block;min-width:240px}
.aviso{color:var(--warn)}
.nota{color:var(--ink-2);font-size:13.5px;max-width:80ch}
.vazio{color:var(--ink-2)}
.avisos{margin:12px 0 0;padding-left:20px;color:var(--ink-2);font-size:14px}
.avisos li{margin:4px 0;max-width:85ch}
.p{font-family:var(--mono);font-size:12px;font-weight:500;border-radius:4px;padding:1px 6px;color:var(--surface)}
.p1{background:var(--bad)}.p2{background:var(--warn)}.p3{background:var(--info)}
.graf{display:block;background:var(--surface);border:1px solid var(--line);border-radius:10px;margin:6px 0}
.graf text{font-family:var(--body);font-size:12px}
.graf .eixo{fill:var(--ink-2);font-size:11px}
.graf .rot{fill:var(--ink)}
.graf .val{fill:var(--ink-2);font-family:var(--mono);font-size:11.5px}
.graf .grelha{stroke:var(--line);stroke-width:1}
.graf .barra{fill:var(--accent)}
.graf .ic{stroke:var(--ink);stroke-width:1.3}
.graf .serie{fill:none;stroke:var(--accent);stroke-width:1.8}
.graf .ponto{fill:var(--accent)}
.graf .sinal{fill:var(--bad)}
.graf .centro{stroke:var(--ink-2);stroke-width:1.2}
.graf .limite{stroke:var(--warn);stroke-width:1.2;stroke-dasharray:5 4}
.graf .mudanca{stroke:var(--ink-2);stroke-dasharray:2 3}
code{font-family:var(--mono);font-size:13px;background:var(--sunk);padding:1px 5px;border-radius:4px}
.passos li{margin:8px 0;max-width:82ch}
details{margin-top:8px;color:var(--ink-2);font-size:14px}
footer{margin-top:48px;color:var(--ink-2);font-size:12.5px;border-top:1px solid var(--line);padding-top:14px}
"""


def gerar_html(r: Resultado) -> str:
    ps = incluidos(r.pedidos)
    inicio, fim = janela(r.pedidos)
    exemplo = ('<p class="exemplo">Dados de exemplo inventados por computador. Nenhum número deste relatório é da MDM.</p>'
               if r.cfg["geral"].get("exemplo") else "")
    resumo = "".join(f"<li>{f}</li>" for f in _resumo(r))
    return f"""<!doctype html>
<html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Funil de pedidos MDM</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>{_CSS}</style></head>
<body><div class="wrap">
<div class="eyebrow">MDM · Climatização</div>
<h1>Funil de pedidos</h1>
<div class="meta">Pedidos de {dt(inicio)} a {dt(fim)} · dados até {dt(r.hoje)} · {len(ps)} pedidos analisados</div>
{exemplo}
<ul class="resumo">{resumo}</ul>

<h2>De onde vêm os números</h2>
{_cobertura(r)}

<h2>Funil por canal</h2>
<p class="nota">Maduros = pedidos com o primeiro contacto há mais de {r.cfg['pedidos']['dias_maturidade']} dias, que já
tiveram tempo de ser decididos. As taxas de ganho contam só estes: os ganhos veem-se logo e as perdas só meses depois, por isso
os pedidos recentes dariam uma taxa enganadora. Ganho = fatura emitida ou aceitação escrita pelo cliente. Os intervalos são de
95% (Wilson).</p>
{_funil(r)}

<h2>Quanto tempo demora cada etapa</h2>
<p class="nota">Horas úteis: dias úteis das {r.cfg['calendario']['hora_inicio']}h às {r.cfg['calendario']['hora_fim']}h, sem
feriados. Um email recebido sábado e respondido segunda às 10h conta 1 hora útil.</p>
{_tempos(r)}

<h2>A rapidez da resposta e os ganhos</h2>
{_barras_taxa(r.velocidade)}
{_efeito(r)}
<p class="nota">Isto mostra associação, não prova causa: se a MDM responde mais depressa aos pedidos que já parecem bons, a
diferença fica exagerada. A prova vem do gráfico semanal depois de mudarem o processo.</p>

<h2>Onde os pedidos ficam parados</h2>
{_gargalo(r)}

<h2>Porque se perdem pedidos</h2>
{_motivos(r)}

<h2>Prioridades a partir do custo do atraso</h2>
{_segmentos(r)}

<h2>Teste das regras em pedidos que não viram</h2>
{_teste(r)}

<h2>Evolução semanal</h2>
{_semanal(r)}

<h2>Próximos passos</h2>
{_passos(r)}

<footer>Gerado pelo funil de pedidos MDM a partir dos ficheiros em dados/. Cada número pode ser verificado em
saida/pedidos.csv (uma linha por pedido, com as datas de cada etapa).</footer>
</div></body></html>
"""
