"""Teste de ponta a ponta: o funil tem de recuperar a verdade de um mundo inventado com respostas conhecidas."""

import csv
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from comparar_verdade import emparelhar, ler_verdade  # noqa: E402

from funil.datas import fim_do_dia  # noqa: E402
from funil.exemplo import BASE, P_ORCAMENTO, TAU, gerar  # noqa: E402
from funil.motor import executar  # noqa: E402


@pytest.fixture(scope="module")
def mundo(tmp_path_factory):
    pasta = tmp_path_factory.mktemp("mundo")
    gerar(pasta, semente=7)
    r = executar(pasta)
    verdade = ler_verdade(pasta / "verdade.csv")
    pares, sem_par = emparelhar(verdade, r.pedidos)
    return pasta, r, verdade, pares, sem_par


def test_reconstroi_os_pedidos(mundo):
    _, r, verdade, pares, sem_par = mundo
    assert len(pares) / len(verdade) >= 0.98
    incluidos = [p for p in r.pedidos if p.incluir]
    assert abs(len(incluidos) - len(verdade)) / len(verdade) <= 0.03


def test_tempos_de_resposta_exatos(mundo):
    _, r, _, pares, _ = mundo
    hoje = fim_do_dia(r.hoje)
    certos = total = 0
    for v, p in pares:
        vt = v["t_resposta"] if v["t_resposta"] and v["t_resposta"] <= hoje else None
        total += 1
        if vt is None:
            certos += p.t_resposta is None
        else:
            certos += p.h_resposta is not None and abs(p.h_resposta - v["h_resposta"]) <= 0.02
    assert certos / total >= 0.99


def test_orcamentos_valores_e_decisoes(mundo):
    _, r, _, pares, _ = mundo
    hoje = fim_do_dia(r.hoje)
    orc = [(v, p) for v, p in pares if v["orc"] and v["t_envio"] <= hoje]
    falhas = [(v, p) for v, p in orc if not (p.orc == v["orc"] and p.t_envio == v["t_envio"])]
    assert len(falhas) / len(orc) <= 0.03
    # As únicas falhas são clientes que ligaram e receberam o orçamento por email, sem nada que ligue o telefone ao
    # email; ficam como sugestão em rever_ligacoes.csv.
    assert all(v["canal"] == "chamada" and v["via_orc"] == "email" for v, _ in falhas)
    sugestoes = {l["nome"].split()[0]: l["detalhe"] for l in r.ligacoes if l["situacao"].startswith("orçamento sem")}
    # E a sugestão inclui a chamada certa (no mundo de exemplo, o telefone do cliente n é +3519100000n).
    assert all(f"tel:+3519100{int(v['cliente']):05d}" in sugestoes.get(f"orc:{v['orc']}", "") for v, _ in falhas)
    assert sum(p.valor_orc is not None and abs(p.valor_orc - v["valor"]) < 0.01 for v, p in orc) / len(orc) >= 0.97
    aceites = [(v, p) for v, p in pares if v["t_aceite"] and v["t_aceite"] <= hoje and v["aceite_por_texto"] == "1"]
    assert sum(p.t_aceite == v["t_aceite"] for v, p in aceites) / len(aceites) >= 0.95
    recusas = [(v, p) for v, p in pares if v["t_recusa"] and v["t_recusa"] <= hoje]
    assert sum(p.t_recusa == v["t_recusa"] and p.motivo == v["motivo"] for v, p in recusas) / len(recusas) >= 0.95
    assert not any(p.t_aceite and not v["t_aceite"] for v, p in pares)
    assert not any(p.t_recusa and not v["t_recusa"] for v, p in pares)


def test_ganhos(mundo):
    _, r, _, pares, _ = mundo
    hoje = fim_do_dia(r.hoje)
    certos = 0
    for v, p in pares:
        visivel = v["ganho"] and ((v["t_fatura"] and v["t_fatura"] <= hoje) or
                                  (v["t_aceite"] and v["t_aceite"] <= hoje and v["aceite_por_texto"] == "1"))
        certos += bool(visivel) == p.ganho
    assert certos / len(pares) >= 0.95


def test_ruido_fica_de_fora(mundo):
    _, r, _, _, _ = mundo
    nomes = " ".join(p.nome for p in r.pedidos).lower()
    assert "distribuidor" not in nomes and "banco" not in nomes and "ganhe" not in nomes


def _efeito_verdadeiro(verdade):
    def p(v, h):
        c = BASE[v["tipo"]] * (1.08 if v["empresa"] == "1" else 1.0)
        if v["tipo"] in ("instalacao", "obra"):
            c *= P_ORCAMENTO[v["tipo"]]
        return c * math.exp(-h / (TAU[v["tipo"]] * (0.6 if v["urgente"] == "1" else 1.0)))
    xs = [v for v in verdade if v["h_resposta"] is not None]
    return sum(p(v, min(v["h_resposta"], 45)) - p(v, min(v["h_resposta"], 45) + 9) for v in xs) / len(xs)


def test_modelo_do_atraso_contem_a_verdade(mundo):
    _, r, verdade, _, _ = mundo
    e = r.efeito
    assert e is not None and e["pp_por_dia"] > 0
    assert e["pp_ic"][0] <= _efeito_verdadeiro(verdade) <= e["pp_ic"][1]
    prioridades = {s["rotulo"]: s["prioridade"] for s in r.segmentos}
    # Manutenção perde pouco com a espera e vale pouco: nunca devia ser P1.
    assert all(c != "P1" for rot, c in prioridades.items() if rot.startswith("Manutenção") and "Empresa" not in rot)


def test_maduros_pela_idade_e_modelo_com_os_sem_resposta(mundo):
    _, r, *_ = mundo
    from datetime import timedelta
    limite = fim_do_dia(r.hoje) - timedelta(days=r.cfg["pedidos"]["dias_maturidade"])
    assert all(p.maduro == (p.t_inicio <= limite) for p in r.pedidos)
    # O teste em dados retidos só usa pedidos com tempo de serem decididos.
    assert r.teste and r.teste["fim_teste"] <= limite
    base = [p for p in r.pedidos if p.incluir and p.maduro and p.t_contacto]
    assert any(p.h_resposta is None for p in base)
    assert r.efeito["n"] == len(base)   # os que nunca tiveram resposta também entram no modelo


def test_gargalo_so_do_lado_da_mdm(mundo):
    _, r, *_ = mundo
    g = r.gargalo
    lado = {e["etapa"]: e["lado"] for e in g["etapas"]}
    assert lado[g["maior_fila"]] == "MDM" and g["silenciosos"] > 0
    espera = next(e for e in g["etapas"] if e["lado"] == "cliente")
    # Orçamentos sem resposta contam até ao último contacto, não até ao fim do prazo de 120 dias.
    assert espera["tempo_medio"] < r.cfg["pedidos"]["dias_decisao"] / 2


def test_relatorio_e_ficheiros(mundo, tmp_path):
    from funil import saidas
    from funil.relatorio import gerar_html
    pasta, r, *_ = mundo
    html = gerar_html(r)
    assert "Funil de pedidos" in html and "Dados de exemplo" in html and "<svg" in html
    assert chr(0x2014) not in html  # sem travessões no relatório
    saidas.escrever_pedidos(r.pedidos, tmp_path / "pedidos.csv")
    with open(tmp_path / "pedidos.csv", encoding="utf-8-sig") as f:
        linhas = list(csv.reader(f, delimiter=";"))
    assert len(linhas) == len(r.pedidos) + 1
