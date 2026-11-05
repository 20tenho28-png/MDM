"""Modo sombra: relógio em horas e dias úteis, cobranças, simulação da ordem por P, lei de Little, prazos e o comando."""

from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from comparar_verdade import emparelhar, ler_verdade  # noqa: E402

from funil import sombra as sb  # noqa: E402
from funil.__main__ import principal  # noqa: E402
from funil.config import carregar  # noqa: E402
from funil.datas import LX, Calendario, fim_do_dia  # noqa: E402
from funil.exemplo import gerar  # noqa: E402
from funil.modelo import Evento, Pedido  # noqa: E402
from funil.motor import executar  # noqa: E402
from funil.relatorio_sombra import escrever_sombra  # noqa: E402

CAL = Calendario(feriados_extra=["06-13"])
EST = sb.POR_CHAVE


def t(*a) -> datetime:
    return datetime(*a, tzinfo=LX)


def ev(ts, direcao, texto="", tipo="mensagem", fonte="email") -> Evento:
    return Evento(ts=ts, fonte=fonte, direcao=direcao, tipo=tipo, uid=f"{fonte}{ts.isoformat()}{direcao}", texto=texto)


def pedido(pid="A", prioridade="P2", eventos=(), **datas) -> Pedido:
    p = Pedido(id=pid, cliente=1, origem=None, eventos=list(eventos))
    p.prioridade_atual = prioridade
    for k, v in datas.items():
        setattr(p, k, v)
    p.t_inicio = p.t_inicio or p.t_contacto
    return p


def test_prazo_vence_em_horas_e_dias_uteis_sem_feriados():
    # 10 de junho de 2026 é feriado (quarta-feira): o relógio salta-o.
    a = t(2026, 6, 9, 17, 0)
    assert sb.vence(CAL, EST["novo"], a, 2) == t(2026, 6, 11, 10, 0)
    assert sb.vence(CAL, EST["orcamento_por_fazer"], a, 1) == t(2026, 6, 11, 17, 0)
    assert sb.vence(CAL, EST["espera_cliente"], a, 3) == a + timedelta(days=3)
    # Fora de horas começa a contar às 9h do dia útil seguinte.
    assert sb.vence(CAL, EST["novo"], t(2026, 6, 12, 20, 0), 1) == t(2026, 6, 15, 10, 0)
    for est, prazo in ((EST["novo"], 7.5), (EST["orcamento_por_fazer"], 2.5)):
        assert sb.duracao(CAL, est, a, sb.vence(CAL, est, a, prazo)) == pytest.approx(prazo)


def test_estado_parado_acaba_conforme_o_modo():
    contacto, resposta = t(2026, 3, 2, 10, 0), t(2026, 3, 2, 15, 0)
    p = pedido(eventos=[ev(contacto, "entrada", "Pedido de orçamento"), ev(resposta, "saida", "Vamos ver")],
               t_contacto=contacto, t_resposta=resposta)
    agora = fim_do_dia(t(2026, 10, 16, 12, 0).date())
    vivos = dict((e, (a, b, f)) for e, a, b, f in sb.periodos(p, agora, modo="vivos"))
    assert vivos["novo"] == (contacto, resposta, True)
    assert vivos["orcamento_por_fazer"][1:] == (resposta, False)       # morreu no último contacto
    painel = dict((e, (a, b, f)) for e, a, b, f in sb.periodos(p, agora, modo="painel"))
    assert painel["orcamento_por_fazer"][1] == agora                   # no painel fica aberto até hoje
    regra = dict((e, (a, b, f)) for e, a, b, f in sb.periodos(p, agora, modo="regra"))
    assert regra["orcamento_por_fazer"][1] == resposta + timedelta(days=30)


def test_cobrancas_por_palavras_e_por_contacto_repetido():
    cfg = carregar()
    eventos = [
        ev(t(2026, 3, 2, 10, 0), "entrada", "Bom dia, preciso de orçamento para 2 splits"),
        ev(t(2026, 3, 3, 11, 0), "entrada", "Então, já viram?"),                       # cobra por palavras
        ev(t(2026, 3, 3, 15, 0), "saida", "Podemos ir ver na quinta"),
        ev(t(2026, 3, 4, 10, 0), "entrada", "Obrigado"),                               # não é cobrança
        ev(t(2026, 3, 5, 16, 0), "entrada", tipo="chamada_perdida", fonte="chamada"),   # segundo contacto sem resposta
        ev(t(2026, 3, 6, 10, 0), "saida", "Segue o orçamento ORC0010_2026"),
        ev(t(2026, 3, 9, 10, 0), "entrada", "Então, já viram?"),                       # a bola é do cliente: não conta
    ]
    p = pedido(eventos=eventos, t_contacto=t(2026, 3, 2, 10, 0), t_resposta=t(2026, 3, 3, 15, 0),
               t_envio=t(2026, 3, 6, 10, 0))
    assert sb.cobrancas(p, cfg["palavras"]["cobranca"], CAL) == [t(2026, 3, 3, 11, 0), t(2026, 3, 5, 16, 0)]


def test_ordem_por_p_passa_o_p1_a_frente_com_os_mesmos_momentos(tmp_path):
    seg = (2026, 3, 2)
    mk = lambda pid, prioridade, chegada, resposta=None, tipo="mensagem": pedido(  # noqa: E731
        pid, prioridade, [ev(chegada, "entrada", tipo=tipo)] + ([ev(resposta, "saida")] if resposta else []),
        t_contacto=chegada, t_resposta=resposta, incluir=True)
    ps = [mk("A", "P3", t(*seg, 9, 0), t(*seg, 10, 0)), mk("B", "P1", t(*seg, 9, 30), t(*seg, 12, 0)),
          mk("C", "P2", t(*seg, 9, 45), t(*seg, 11, 0)),
          mk("D", "P1", t(*seg, 9, 50), t(*seg, 9, 50), tipo="chamada_atendida"),   # atendida na hora: fica igual
          mk("E", "P1", t(*seg, 9, 55))]                                            # nunca respondido: fica igual
    sim = sb.simular_ordem(ps, CAL, t(2026, 3, 20, 12, 0).date(), "novo")
    assert sim["B"][:2] == (t(*seg, 9, 30), t(*seg, 10, 0))
    assert sim["C"][:2] == (t(*seg, 9, 45), t(*seg, 11, 0))
    assert sim["A"][:2] == (t(*seg, 9, 0), t(*seg, 12, 0))
    assert sim["D"][:2] == (t(*seg, 9, 50), t(*seg, 9, 50))
    assert sim["E"][1] is None


def test_lei_de_little_numa_fila_constante():
    """Um pedido por dia útil entra em orçamento e sai 2 dias úteis depois: fila média 2, 5 por semana."""
    cfg = carregar()
    ps, d, i = [], t(2025, 9, 1, 9, 0), 0
    while d <= t(2026, 10, 16, 9, 0):
        if CAL.e_util(d.date()):
            envio = sb.vence(CAL, EST["orcamento_por_fazer"], d, 2)
            ps.append(pedido(f"p{i}", "P2", [ev(d, "entrada"), ev(d, "saida"), ev(envio, "saida", "ORC")],
                             t_contacto=d, t_resposta=d, t_envio=envio))
            i += 1
        d += timedelta(days=1)
    prazos = {(e.chave, c): None for e in sb.ESTADOS for c in sb.CLASSES}
    prazos[("orcamento_por_fazer", "P2")] = 3.0
    linha = next(l for l in sb.little(ps, CAL, t(2026, 10, 16, 12, 0).date(), prazos) if l["estado"] == "orcamento_por_fazer")
    assert linha["entradas_semana"] == pytest.approx(5, rel=0.03)
    assert linha["fila_vivos"] == pytest.approx(2, rel=0.03)
    assert linha["espera_media"] == pytest.approx(2, rel=0.03)
    assert linha["fila_maxima"] == pytest.approx(3, rel=0.03)


def test_vermelho_a_tempo_e_util():
    cfg = carregar()
    seg = (2026, 3, 2)
    perdido = pedido("L", "P2", [ev(t(*seg, 10, 0), "entrada", "Orçamento para AC?")], t_contacto=t(*seg, 10, 0),
                     maduro=True)
    ganho = pedido("G", "P2", [ev(t(*seg, 10, 0), "entrada", "Orçamento para AC?"), ev(t(*seg, 11, 0), "saida", "Sim"),
                               ev(t(*seg, 15, 0), "saida", "ORC0001_2026"), ev(t(2026, 3, 4, 10, 0), "entrada", "Aceito")],
                   t_contacto=t(*seg, 10, 0), t_resposta=t(*seg, 11, 0), t_envio=t(*seg, 15, 0),
                   t_aceite=t(2026, 3, 4, 10, 0), t_fatura=t(2026, 3, 10, 18, 0), maduro=True, ganho=True)
    prazos = {(e.chave, c): 30.0 for e in sb.ESTADOS for c in sb.CLASSES}
    prazos[("novo", "P2")] = 4.0
    r = sb.replay([perdido, ganho], CAL, t(2026, 10, 16, 12, 0).date(), prazos, cfg)
    assert (r["perdidos"], r["perdidos_vermelhos"], r["ganhos"], r["ganhos_vermelhos"]) == (1, 1, 1, 0)
    assert r["perda_se_vermelho"] == 1.0 and r["perda_se_verde"] == 0.0
    assert r["fora"][("novo", "P2")]["abertos"] == 1


def test_kaplan_meier_conta_quem_foi_atendido_antes_de_cobrar():
    curva = sb.kaplan_meier([(1, True), (2, False), (3, True), (4, True)])
    assert curva == [(1, 0.75), (3, 0.375), (4, 0.0)]
    assert sb._tempo_ate(curva, 0.2) == 1 and sb._tempo_ate(curva, 0.5) == 3


def test_prazos_propostos_seguem_a_ordem_e_a_paciencia():
    cfg = carregar()

    def resumo(vs):
        return sb._resumo([float(v) for v in vs])
    simulados = {("novo", "P1"): resumo(range(1, 11)), ("novo", "P2"): resumo(range(5, 15)),
                 ("novo", "P3"): resumo(range(2, 12))}
    pac = {"novo": {"entradas": 50, "cobraram": 12, "limite": 10.0, "mediana": 14.0}}
    prazos, fonte = sb.propor_prazos({}, simulados, pac, cfg)
    assert prazos[("novo", "P1")] == 8.0                       # p80 de 1..10 = 8,2
    assert prazos[("novo", "P2")] == 10.0 and "cobrarem" in fonte[("novo", "P2")]   # p80 = 12,2, cortado pela paciência
    assert prazos[("novo", "P3")] == 10.0 and "igual ao P de cima" in fonte[("novo", "P3")]
    assert prazos[("orcamento_por_fazer", "P1")] is None
    # O corte da paciência arredonda para baixo: 10,9 horas dá 10,5, nunca 11.
    pac["novo"]["limite"] = 10.9
    prazos, _ = sb.propor_prazos({}, simulados, pac, cfg)
    assert prazos[("novo", "P2")] == 10.5
    # Na espera do cliente o prazo é o primeiro seguimento: a mediana do tempo de decisão.
    tabela = {("espera_cliente", c): resumo(range(1, 11)) for c in sb.CLASSES}
    prazos, fonte = sb.propor_prazos(tabela, {}, None, cfg)
    assert prazos[("espera_cliente", "P1")] == 6.0 and "decisão" in fonte[("espera_cliente", "P1")]


def test_prazos_da_configuracao_mandam():
    cfg = carregar()
    cfg["prazos"]["novo"] = {"P1": 2}
    prazos, origem = sb.prazos_em_uso({("novo", "P1"): 6.0, ("novo", "P2"): 11.0}, cfg)
    assert prazos[("novo", "P1")] == 2.0 and origem[("novo", "P1")] == "configuração"
    assert prazos[("novo", "P2")] == 11.0 and origem[("novo", "P2")] == "proposto"


@pytest.fixture(scope="module")
def mundo(tmp_path_factory):
    pasta = tmp_path_factory.mktemp("sombra")
    gerar(pasta, semente=7)
    r = executar(pasta)
    return pasta, r, sb.executar_sombra(r)


def test_mundo_cobrancas_batem_com_a_verdade(mundo):
    pasta, r, _ = mundo
    pares, _ = emparelhar(ler_verdade(pasta / "verdade.csv"), r.pedidos)
    certas = encontradas = verdadeiras = 0
    for v, p in pares:
        sv = {datetime.fromisoformat(x).replace(second=0) for x in (v.get("cobrancas") or "").split(";") if x}
        sd = {x.replace(second=0) for x in sb.cobrancas(p, r.cfg["palavras"]["cobranca"], r.cal)}
        certas, encontradas, verdadeiras = certas + len(sv & sd), encontradas + len(sd), verdadeiras + len(sv)
    assert verdadeiras >= 20
    assert certas / encontradas >= 0.95 and certas / verdadeiras >= 0.95


def test_mundo_prazos_ordenados_e_ordem_por_p_ajuda_o_p1(mundo):
    _, _, s = mundo
    for est in sb.ESTADOS:
        vals = [s.prazos[(est.chave, c)] for c in sb.CLASSES]
        validos = [v for v in vals if v is not None]
        assert validos == sorted(validos), est.chave
    assert s.simulados[("novo", "P1")]["p80"] < s.tabela[("novo", "P1")]["p80"]
    assert s.simulados[("novo", "P3")]["p80"] > s.tabela[("novo", "P3")]["p80"]
    # Prazos mais apertados apanham mais perdidos (e mais ganhos).
    por_nome = {c["nome"].split()[0]: c for c in s.cenarios}
    assert por_nome["p50"]["perdidos_vermelhos"] >= por_nome["p80"]["perdidos_vermelhos"] >= por_nome["p90"]["perdidos_vermelhos"]
    # A regra dos 30 dias tira os pedidos mortos da lista da manhã.
    assert s.manha["regra"]["vermelhos"] < s.manha["painel"]["vermelhos"] / 3


def test_mundo_ficheiros_e_comando(mundo, tmp_path):
    pasta, _, s = mundo
    ficheiros = escrever_sombra(s, tmp_path)
    for f in ficheiros:
        assert f.exists() and f.stat().st_size > 0, f.name
    html = (tmp_path / "sombra.html").read_text(encoding="utf-8")
    assert "\u2014" not in html and "Dados de exemplo inventados" in html
    toml = (tmp_path / "prazos_propostos.toml").read_text(encoding="utf-8")
    assert "[prazos]" in toml and "novo = {" in toml
    assert principal(["sombra", "--pasta", str(pasta)]) == 0
    assert (pasta / "saida" / "sombra.html").exists()


def test_orcamento_sem_mensagem_de_envio_fica_por_confirmar(tmp_path):
    from mini import MDM, caixa, email, orcamento, projeto
    from funil.relatorio import gerar_html
    p = projeto(tmp_path)
    cli = '"Ana Silva" <ana.silva@exemplo.pt>'
    caixa(p, [email(cli, MDM, t(2026, 3, 2, 10, 0), "Pedido de orçamento", "Bom dia, queria orçamento para 2 splits."),
              email(MDM, cli, t(2026, 3, 2, 15, 0), "Re: Pedido de orçamento", "Bom dia, vamos preparar o orçamento.")])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 4), contacto="ana.silva@exemplo.pt")
    r = executar(p)
    ped = next(x for x in r.pedidos if x.orc == "ORC0010_2026")
    assert ped.t_envio is not None and not ped.envio_confirmado
    assert "envio por confirmar" in gerar_html(r)
    assert sb.executar_sombra(r).envios_por_confirmar == 1
    # Com a mensagem que leva o número ORC, o envio fica confirmado e a data é a da mensagem.
    caixa(p, [email(MDM, cli, t(2026, 3, 5, 11, 0), "Orçamento ORC0010_2026", "Segue o orçamento.",
                    anexo="ORC0010_2026 Ana Silva.pdf")], nome="enviados.mbox")
    r = executar(p)
    ped = next(x for x in r.pedidos if x.orc == "ORC0010_2026")
    assert ped.envio_confirmado and ped.t_envio == t(2026, 3, 5, 11, 0)


# ---------------------------------------------------------------- visitas (agenda do ERP)


def visita(criada, marcada=None, feita=None, numero="1", anterior="", resultado="", encomenda=None, chegada=None):
    e = Evento(ts=criada, fonte="agenda", direcao=None, tipo="visita", uid=f"agenda:{numero}", numero=numero)
    e.extra = {"marcada_em": marcada, "feita_em": feita, "anterior": anterior, "resultado": resultado,
               "peca_encomendada_em": encomenda, "peca_recebida_em": chegada}
    return e


def test_visitas_separam_os_estados_do_pedido():
    contacto, resposta = t(2026, 3, 2, 10, 0), t(2026, 3, 2, 15, 0)
    envio, aceite, fatura = t(2026, 3, 16, 12, 0), t(2026, 3, 18, 10, 0), t(2026, 4, 10, 18, 0)
    avaliacao = visita(t(2026, 3, 3, 9, 0), marcada=t(2026, 3, 4, 11, 0), feita=t(2026, 3, 9, 11, 0), numero="1")
    sem_peca = visita(t(2026, 3, 18, 10, 30), marcada=t(2026, 3, 19, 9, 0), feita=t(2026, 3, 23, 12, 0), numero="2",
                      resultado="pendente_peca", encomenda=t(2026, 3, 23, 18, 0), chegada=t(2026, 3, 30, 18, 0))
    montagem = visita(t(2026, 3, 23, 12, 5), marcada=t(2026, 3, 31, 10, 0), feita=t(2026, 4, 10, 13, 0), numero="3",
                      anterior="2")
    p = pedido(eventos=[ev(contacto, "entrada", "Pedido"), ev(resposta, "saida", "Vamos ver"), avaliacao, sem_peca,
                        montagem],
               t_contacto=contacto, t_resposta=resposta, t_envio=envio, t_aceite=aceite, t_fatura=fatura)
    assert sb.periodos(p, t(2026, 10, 16, 23, 0)) == [
        ("novo", contacto, resposta, True),
        # O cliente espera pela visita desde a resposta; a visita fica marcada até ao relatório.
        ("visita_por_marcar", resposta, t(2026, 3, 4, 11, 0), True),
        ("visita_marcada", t(2026, 3, 4, 11, 0), t(2026, 3, 9, 11, 0), True),
        ("orcamento_por_fazer", t(2026, 3, 9, 11, 0), envio, True),
        ("espera_cliente", envio, aceite, True),
        ("visita_por_marcar", aceite, t(2026, 3, 19, 9, 0), True),
        ("visita_marcada", t(2026, 3, 19, 9, 0), t(2026, 3, 23, 12, 0), True),
        # À espera da peça até ela chegar; só então a visita seguinte conta como por marcar.
        ("espera_fornecedor", t(2026, 3, 23, 12, 0), t(2026, 3, 30, 18, 0), True),
        ("visita_por_marcar", t(2026, 3, 30, 18, 0), t(2026, 3, 31, 10, 0), True),
        ("visita_marcada", t(2026, 3, 31, 10, 0), t(2026, 4, 10, 13, 0), True),
        ("em_execucao", t(2026, 4, 10, 13, 0), fatura, True),
    ]


def test_visita_por_fechar_na_agenda_acaba_com_o_orcamento():
    contacto, resposta, envio = t(2026, 3, 2, 10, 0), t(2026, 3, 2, 15, 0), t(2026, 3, 12, 12, 0)
    marcada = visita(t(2026, 3, 2, 15, 30), marcada=t(2026, 3, 3, 9, 0))   # o relatório nunca chegou ao ERP
    p = pedido(eventos=[ev(contacto, "entrada", "Pedido"), ev(resposta, "saida", "Vamos ver"), marcada],
               t_contacto=contacto, t_resposta=resposta, t_envio=envio)
    estados = sb.periodos(p, t(2026, 3, 20, 23, 0))
    assert estados[1:4] == [("visita_por_marcar", resposta, t(2026, 3, 3, 9, 0), True),
                            ("visita_marcada", t(2026, 3, 3, 9, 0), envio, True),
                            ("espera_cliente", envio, t(2026, 3, 20, 23, 0), False)]
    # Sem a agenda, o mesmo pedido fica todo em «orçamento por fazer».
    p.eventos = p.eventos[:2]
    assert sb.periodos(p, t(2026, 3, 20, 23, 0))[1] == ("orcamento_por_fazer", resposta, envio, True)


def test_agenda_do_erp_entra_no_pedido_pelo_orc(tmp_path):
    from mini import MDM, caixa, email, orcamento, projeto
    p = projeto(tmp_path)
    cli = '"Ana Silva" <ana.silva@exemplo.pt>'
    caixa(p, [email(cli, MDM, t(2026, 3, 2, 10, 0), "Pedido de orçamento", "Bom dia, queria orçamento para 2 splits."),
              email(MDM, cli, t(2026, 3, 2, 15, 0), "Re: Pedido de orçamento", "Bom dia, vamos preparar o orçamento."),
              email(MDM, cli, t(2026, 3, 9, 15, 0), "Orçamento", "Segue o ORC0010_2026.")])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 9), contacto="ana.silva@exemplo.pt")
    (p / "dados" / "agenda").mkdir(parents=True)
    (p / "dados" / "agenda" / "agenda_2026-10-16.csv").write_text(
        "﻿visita;anterior;cliente;telefone;email;nif;referencia;tipo_trabalho;prioridade;tecnico;estado;criada_em;"
        "marcada_em;inicio;fim;feita_em;cancelada_em;relatorio;resultado;peca_encomendada_em;peca_recebida_em\n"
        "1;;Ana Silva;;ana.silva@exemplo.pt;;;avaliacao;P2;Abdul;feita;2026-03-02 16:00:00;2026-03-03 10:00:00;"
        "2026-03-05 10:00:00;2026-03-05 11:00:00;2026-03-05 11:00:00;;RI-2026-AL-0001;concluida;;\n"
        "2;;Ana Silva;;;;ORC0010_2026;instalacao;P2;Abdul;cancelada;2026-03-10 09:00:00;;;;;2026-03-11 09:00:00;;;;\n",
        encoding="utf-8")
    r = executar(p)
    assert r.cobertura["fontes"]["agenda"]["eventos"] == 1
    assert r.cobertura["fontes"]["agenda"]["detalhe"]["canceladas (não contam)"] == 1
    ped = next(x for x in r.pedidos if x.orc == "ORC0010_2026")
    assert [e.fonte for e in ped.eventos].count("agenda") == 1
    # A visita não é um contacto: não muda a resposta nem o envio.
    assert ped.t_resposta == t(2026, 3, 2, 15, 0) and ped.t_envio == t(2026, 3, 9, 15, 0)
    chaves = [c for c, *_ in sb.periodos(ped, fim_do_dia(r.hoje))]
    assert chaves[:4] == ["novo", "visita_por_marcar", "visita_marcada", "orcamento_por_fazer"]
    s = sb.executar_sombra(r)
    assert [e.chave for e in s.estados] == ["novo", "visita_por_marcar", "visita_marcada", "orcamento_por_fazer",
                                           "espera_cliente", "em_execucao", "espera_fornecedor"]
    assert s.por_medir == ()


def test_sem_agenda_as_visitas_ficam_por_medir(tmp_path):
    from mini import MDM, caixa, email, projeto
    p = projeto(tmp_path)
    cli = '"Ana Silva" <ana.silva@exemplo.pt>'
    caixa(p, [email(cli, MDM, t(2026, 3, 2, 10, 0), "Pedido de orçamento", "Bom dia, queria orçamento para 2 splits.")])
    r = executar(p)
    assert not any("agenda" in a.lower() for a in r.cobertura["avisos"])   # opcional: o relatório principal não avisa
    s = sb.executar_sombra(r)
    assert s.estados == sb.ESTADOS and [e.chave for e, _ in s.por_medir] == [e.chave for e in sb.VISITAS]
    escrever_sombra(s, tmp_path / "saida")
    html = (tmp_path / "saida" / "sombra.html").read_text(encoding="utf-8")
    assert "precisa da agenda do ERP" in html and "/erp/exportar/agenda.csv" in html


def test_mundo_com_agenda_mede_as_visitas_e_a_espera_de_pecas(mundo, tmp_path):
    _, r, s = mundo
    assert s.por_medir == () and "visita_marcada" in [e.chave for e in s.estados]
    for chave in ("visita_por_marcar", "visita_marcada", "espera_fornecedor"):
        assert s.tabela[(chave, "todos")]["n"] >= 8, chave
        assert any(s.propostos[(chave, c)] is not None for c in sb.CLASSES), chave
    # As visitas tiram tempo a «em execução»: depois da última visita só falta faturar (no mesmo dia).
    assert s.tabela[("em_execucao", "todos")]["p80"] <= 1
    # Os estados das visitas não mudam os pedidos nem os tempos de resposta.
    assert all(e.fonte != "agenda" or e.direcao is None for p in r.pedidos for e in p.eventos)
    escrever_sombra(s, tmp_path)
    html = (tmp_path / "sombra.html").read_text(encoding="utf-8")
    assert "Visita marcada" in html and "À espera de peça/fornecedor" in html and "precisa da agenda" not in html
    assert "—" not in html
    toml = (tmp_path / "prazos_propostos.toml").read_text(encoding="utf-8")
    assert "visita_marcada = {" in toml and "Ainda sem dados" not in toml
