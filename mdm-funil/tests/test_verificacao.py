"""Casos da segunda verificação independente. Cada teste reproduz um erro que já foi corrigido."""

import math
import random
import sys
import zipfile
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from mini import MDM, caixa, email, orcamento, projeto, t, whatsapp  # noqa: E402

from funil.caracteristicas import classificar_decisao  # noqa: E402
from funil.config import carregar  # noqa: E402
from funil.estatistica import xmr  # noqa: E402
from funil.motor import executar  # noqa: E402
from funil.texto import nomes_parecidos  # noqa: E402

ANA = '"Ana Silva" <ana.silva@gmail.com>'
ARQ = '"Arq. Rui Lopes" <rui@arq-lopes.pt>'
CFG = carregar()


def _por_nome(r):
    return {p.nome: p for p in r.pedidos}


# ---------------------------------------------------------------- grupos de WhatsApp


@pytest.mark.parametrize("tecnico", ["+351 913 000 999", "Carlos Técnico"])
def test_dois_grupos_com_o_mesmo_tecnico_sao_clientes_diferentes(tmp_path, tecnico):
    p = projeto(tmp_path)
    (p / "config.toml").write_text((p / "config.toml").read_text(encoding="utf-8").replace(
        'telefones = ["+351219990000"]', 'telefones = ["+351219990000", "+351913000999"]'), encoding="utf-8")
    whatsapp(p, "Obra Moradia Cascais", [
        "04/03/26, 15:00 - Ana Silva: Bom dia, queria orçamento do ar condicionado para a moradia",
        "04/03/26, 16:00 - MDM Climatização: Boa tarde Ana, o Carlos passa amanhã para medir",
        f"05/03/26, 09:00 - {tecnico}: Bom dia, estou a chegar",
        "10/03/26, 10:00 - MDM Climatização: Segue o orçamento ORC0010_2026"])
    whatsapp(p, "Obra Loja Sintra", [
        "06/04/26, 10:00 - João Costa: Bom dia, preciso de orçamento para climatizar a loja",
        "06/04/26, 11:00 - MDM Climatização: Bom dia João, o Carlos passa lá quinta",
        f"09/04/26, 09:00 - {tecnico}: Bom dia, estou à porta da loja",
        "14/04/26, 10:00 - MDM Climatização: Segue o orçamento ORC0011_2026",
        "15/04/26, 10:00 - João Costa: Aceito, podem marcar"])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 10))
    orcamento(p, "ORC0011_2026", "João Costa", data=datetime(2026, 4, 14))
    r = executar(p)
    ps = sorted(r.pedidos, key=lambda x: x.t_inicio)
    assert [x.orc for x in ps] == ["ORC0010_2026", "ORC0011_2026"] and ps[0].cliente != ps[1].cliente
    assert ps[0].t_aceite is None and ps[1].t_aceite == t(2026, 4, 15, 10)


def test_grupo_do_iphone_comeca_na_mensagem_do_cliente(tmp_path):
    p = projeto(tmp_path)
    with zipfile.ZipFile(p / "dados" / "whatsapp" / "WhatsApp Chat - Obra Moradia Cascais.zip", "w") as z:
        z.writestr("_chat.txt", "\n".join([
            "[02/03/26, 09:00:00] Obra Moradia Cascais: ‎As mensagens e as chamadas são encriptadas ponto a ponto.",
            "[02/03/26, 09:00:00] Obra Moradia Cascais: ‎Rui Lopes criou o grupo “Obra Moradia Cascais”",
            "[02/03/26, 09:00:01] Obra Moradia Cascais: ‎Rui Lopes adicionou-o",
            "[04/03/26, 15:00:00] Ana Silva: Bom dia, queria o orçamento do ar condicionado para a moradia",
            "[04/03/26, 16:00:00] MDM Climatização: Boa tarde, passamos amanhã na obra",
            "[20/03/26, 10:00:00] Obra Moradia Cascais: ‎Rui Lopes mudou o nome do grupo para “Obra Cascais”"]) + "\n")
    r = executar(p)
    assert len(r.pedidos) == 1
    assert r.pedidos[0].t_contacto == t(2026, 3, 4, 15) and r.pedidos[0].h_resposta == 1.0


def test_arquiteto_num_grupo_e_na_sua_conversa_nao_junta_clientes(tmp_path):
    p = projeto(tmp_path)
    whatsapp(p, "Obra Moradia Cascais", [
        "04/03/26, 15:00 - Ana Silva: Bom dia, queria orçamento do ar condicionado para a moradia",
        "04/03/26, 15:10 - +351 914 000 111: Boa tarde, sou o arquiteto. Envio as plantas.",
        "04/03/26, 16:00 - MDM Climatização: Boa tarde, passamos amanhã na obra",
        "10/03/26, 10:00 - MDM Climatização: Segue o orçamento ORC0010_2026"])
    whatsapp(p, "+351 914 000 111", [
        "15/05/26, 09:00 - +351 914 000 111: Bom dia, tenho outra obra, da D. Rita Gomes, precisa de orçamento de AC",
        "15/05/26, 12:00 - MDM Climatização: Bom dia arquiteto, enviamos esta semana",
        "20/05/26, 10:00 - MDM Climatização: Segue o orçamento ORC0020_2026"])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 10))
    orcamento(p, "ORC0020_2026", "Rita Gomes", data=datetime(2026, 5, 20))
    r = executar(p)
    assert sorted(x.orc for x in r.pedidos) == ["ORC0010_2026", "ORC0020_2026"]
    assert len({x.cliente for x in r.pedidos}) == 2


# ---------------------------------------------------------------- contactos partilhados


def test_telefone_do_arquiteto_no_campo_contacto_de_dois_orc(tmp_path):
    p = projeto(tmp_path)
    rita = '"Rita Gomes" <rita.gomes@hotmail.com>'
    caixa(p, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento moradia", "Queria orçamento para climatizar a moradia."),
        email(MDM, ANA, t(2026, 3, 9, 10), "Orçamento", "Segue o orçamento.", anexo="ORC0010_2026 Ana Silva.pdf"),
        email(rita, MDM, t(2026, 6, 1, 10), "Orçamento casa", "Queria orçamento para 3 splits."),
        email(MDM, rita, t(2026, 6, 8, 10), "Orçamento", "Segue o orçamento.", anexo="ORC0020_2026 Rita Gomes.pdf"),
        email(rita, MDM, t(2026, 6, 10, 10), "Re: Orçamento", "Aceito, podem marcar."),
    ])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 9), contacto="914 000 111 (Arq. Rui Lopes)")
    orcamento(p, "ORC0020_2026", "Rita Gomes", data=datetime(2026, 6, 8), contacto="914 000 111 (Arq. Rui Lopes)")
    r = executar(p)
    assert "tel:+351914000111" in r.partilhados
    por_nome = _por_nome(r)
    assert por_nome["Ana Silva"].cliente != por_nome["Rita Gomes"].cliente
    assert por_nome["Rita Gomes"].t_aceite and not por_nome["Ana Silva"].t_aceite


@pytest.mark.parametrize("a,b,parecidos", [
    ("ana silva", "ana maria silva", True),
    ("ana silva", "joao silva", False),
    ("jose manuel ferreira", "jose manuel costa", False),
    ("maria joao santos", "maria joao pereira", False),
    ("pastelaria doce lar", "doce lar unipessoal", True),
])
def test_nomes_parecidos(a, b, parecidos):
    assert nomes_parecidos(a, b) is parecidos


# ---------------------------------------------------------------- emails para várias pessoas


def _resposta_da_ana(tmp_path, mensagens, orcs=()):
    p = projeto(tmp_path)
    caixa(p, mensagens)
    for numero, nome, data in orcs:
        orcamento(p, numero, nome, data=data)
    r = executar(p)
    return _por_nome(r)["Ana Silva"], r


def test_cliente_com_dois_emails(tmp_path):
    ana2 = '"Ana Silva" <ana.silva@empresa-lopes.pt>'
    x, _ = _resposta_da_ana(tmp_path, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits em casa."),
        email(ana2, MDM, t(2026, 3, 2, 11), "Re: Orçamento", "Envio também deste email."),
        email(MDM, f"{ANA}, {ana2}", t(2026, 3, 2, 15), "Re: Orçamento", "Bom dia Ana, podemos visitar quinta?")])
    assert x.h_resposta == 5.0


def test_endereco_repetido_com_maiusculas(tmp_path):
    x, _ = _resposta_da_ana(tmp_path, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits."),
        email(MDM, '"Ana Silva" <ana.silva@gmail.com>, Ana.Silva@gmail.com', t(2026, 3, 2, 15), "Re: Orçamento",
              "Bom dia, podemos visitar quinta?")])
    assert x.h_resposta == 5.0


def test_criterios_desempatam_por_ordem(tmp_path):
    empreiteiro = '"Construções Matos" <obras@matos-construcoes.pt>'
    x, r = _resposta_da_ana(tmp_path, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Obra", "Queria orçamento para climatizar a moradia nova."),
        email(ARQ, MDM, t(2026, 3, 2, 11), "Obra Ana Silva", "Bom dia, sou o arquiteto da obra da D. Ana."),
        email(MDM, empreiteiro, t(2026, 3, 2, 12), "Obra", "Bom dia, quando podemos passar na obra?"),
        email(MDM, f"{ANA}, {ARQ}, {empreiteiro}", t(2026, 3, 2, 16), "Re: Obra", "Visita marcada para dia 5.")])
    # O empreiteiro nunca escreveu: não pode ser escolhido só por ter recebido um email sozinho.
    assert x.h_resposta == 6.0
    as_16h = [e for e in r.eventos if e.fonte == "email" and e.ts == t(2026, 3, 2, 16)]
    assert as_16h and not any("email:obras@matos-construcoes.pt" in e.chaves for e in as_16h)


def test_nome_do_orcamento_parecido(tmp_path):
    x, _ = _resposta_da_ana(tmp_path, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Obra", "Queria orçamento para a moradia."),
        email(ARQ, MDM, t(2026, 3, 2, 11), "Obra", "Sou o arquiteto da obra, envio as plantas."),
        email(MDM, f"{ANA}, {ARQ}", t(2026, 3, 5, 10), "Orçamento", "Segue o orçamento.",
              anexo="ORC0010_2026 Ana Maria Silva.pdf")],
        orcs=[("ORC0010_2026", "Ana Maria Silva", datetime(2026, 3, 5))])
    assert x.orc == "ORC0010_2026" and x.h_resposta == 27.0


def test_arquiteto_que_responde_a_todos_fica_no_pedido_da_cliente(tmp_path):
    m1 = email(ANA, MDM, t(2026, 3, 2, 10), "Climatização moradia", "Queria orçamento para a moradia.", Cc=ARQ)
    m2 = email(MDM, ANA, t(2026, 3, 2, 12), "Re: Climatização moradia", "Precisamos das plantas.", Cc=ARQ,
               In_Reply_To=m1["Message-ID"])
    m3 = email(ARQ, MDM, t(2026, 3, 3, 9), "Re: Climatização moradia", "Junto envio as plantas da moradia.", Cc=ANA,
               In_Reply_To=m2["Message-ID"], References=f'{m1["Message-ID"]} {m2["Message-ID"]}')
    m4 = email(MDM, f"{ARQ}, {ANA}", t(2026, 3, 3, 11), "Re: Climatização moradia", "Obrigado, recebemos.",
               In_Reply_To=m3["Message-ID"])
    x, r = _resposta_da_ana(tmp_path, [m1, m2, m3, m4])
    assert [p.nome for p in r.pedidos if p.incluir] == ["Ana Silva"]
    assert len(x.eventos) == 4 and x.h_resposta == 2.0


# ---------------------------------------------------------------- decisões


@pytest.mark.parametrize("frase,esperado", [
    ("Sem problema, podem avançar.", "aceite"),
    ("Sem dúvida, pode avançar!", "aceite"),
    ("Orçamento aprovado.", "aceite"),
    ("Orçamento aceite, obrigado.", "aceite"),
    ("Combinado, fico a aguardar a marcação.", "aceite"),
    ("Pedimos a outra empresa mas preferimos o vosso. Podem avançar.", "aceite"),
    ("O orçamento da outra empresa era mais caro, por isso vamos avançar convosco.", "aceite"),
    ("Fica para o próximo ano.", "recusa:desistiu ou adiou"),
    ("Já não é preciso, obrigado.", "recusa:desistiu ou adiou"),
    ("Não, obrigado.", "recusa:desistiu ou adiou"),
    ("Para já não, obrigado.", "recusa:desistiu ou adiou"),
    ("Achei caro.", "recusa:preço"),
    ("Vamos avançar com outra empresa.", "recusa:foi com outra empresa"),
    ("Fechámos com outra empresa, obrigado.", "recusa:foi com outra empresa"),
    ("Vou falar com outra empresa também.", None),
    ("Vou pensar e depois digo alguma coisa.", None),
    ("Não é preciso vir medir, já tenho as medidas.", None),
    ("Quanto tempo demora a instalação?", None),
    ("Sem problema, aguardo.", None),
])
def test_frases_de_decisao(frase, esperado):
    d = classificar_decisao(frase, CFG)
    obtido = None if d is None else (d[0] if d[0] != "recusa" else f"recusa:{d[1]}")
    assert obtido == esperado


@pytest.mark.parametrize("canal", ["email", "whatsapp"])
def test_queixa_de_preco_orcamento_revisto_e_aceitacao(tmp_path, canal):
    p = projeto(tmp_path)
    if canal == "email":
        caixa(p, [
            email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits."),
            email(MDM, ANA, t(2026, 3, 2, 12), "Re: Orçamento", "Bom dia, passamos amanhã."),
            email(MDM, ANA, t(2026, 3, 4, 10), "Orçamento", "Segue o orçamento.", anexo="ORC0010_2026 Ana Silva.pdf"),
            email(ANA, MDM, t(2026, 3, 5, 10), "Re: Orçamento", "Está um pouco caro. Conseguem fazer melhor?"),
            email(MDM, ANA, t(2026, 3, 6, 10), "Orçamento revisto", "Segue o revisto.", anexo="ORC0012_2026 Ana Silva.pdf"),
            email(ANA, MDM, t(2026, 3, 16, 10), "Re: Orçamento revisto", "Assim já dá. Podem avançar, quando podem vir?"),
        ])
    else:
        whatsapp(p, "Ana Silva", [
            "02/03/26, 10:00 - Ana Silva: Bom dia, queria orçamento para instalar 2 splits",
            "02/03/26, 12:00 - MDM Climatização: Bom dia, passamos amanhã",
            "04/03/26, 10:00 - MDM Climatização: Segue o orçamento ORC0010_2026",
            "05/03/26, 10:00 - Ana Silva: Está um pouco caro. Conseguem fazer melhor?",
            "06/03/26, 10:00 - MDM Climatização: Segue o orçamento revisto ORC0012_2026",
            "16/03/26, 10:00 - Ana Silva: Assim já dá. Podem avançar, quando podem vir?"])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 4), valor="2.000,00 € + IVA")
    orcamento(p, "ORC0012_2026", "Ana Silva", data=datetime(2026, 3, 6), valor="1.800,00 € + IVA")
    r = executar(p)
    assert len(r.pedidos) == 1
    x = r.pedidos[0]
    assert x.ganho and x.t_aceite == t(2026, 3, 16, 10) and x.t_recusa is None
    assert x.n_orc == 2 and x.valor_orc == 1800.0   # vale o orçamento revisto


# ---------------------------------------------------------------- gargalo e resultados


def test_conversa_ativa_sem_orcamento_continua_aberta(tmp_path):
    p = projeto(tmp_path, hoje="2026-10-16")
    whatsapp(p, "Ana Silva", [
        "07/09/26, 10:00 - Ana Silva: Bom dia, queria orçamento para climatizar a moradia nova (obra)",
        "07/09/26, 11:00 - MDM Climatização: Bom dia Ana, precisamos das plantas",
        "14/10/26, 10:00 - Ana Silva: Enviei as plantas por email. Para quando o orçamento?",
        "15/10/26, 10:00 - MDM Climatização: Estamos a fazer, esta semana segue"])
    r = executar(p)
    assert r.pedidos[0].resultado == "novo"
    etapa = next(e for e in r.gargalo["etapas"] if e["etapa"] == "Respondido, sem orçamento")
    assert etapa["em_fila_agora"] == 1 and etapa["sairam_sem_avancar"] is None


def test_grafico_de_ganhos_em_blocos_de_4_semanas():
    # Num processo estável com poucos ganhos, somar 4 semanas evita «sinais» que são só acaso.
    rng = random.Random(5)

    def poisson(lam):
        limite, k, p = math.exp(-lam), 0, 1.0
        while True:
            p *= rng.random()
            if p <= limite:
                return k
            k += 1

    lam = 1.5 * 12 / 52
    semanal = alarmes_semanais = alarmes_blocos = 0
    for _ in range(300):
        serie = [poisson(lam) for _ in range(52)]
        semanal += 1
        x = xmr([float(v) for v in serie])
        alarmes_semanais += bool(x and x["sinais"])
        b = xmr([float(sum(serie[i:i + 4])) for i in range(0, 52, 4)])
        alarmes_blocos += bool(b and b["sinais"])
    assert alarmes_semanais / semanal > 0.6 and alarmes_blocos / semanal < 0.25


def test_relatorio_usa_blocos_de_4_semanas(tmp_path):
    from funil.exemplo import gerar
    gerar(tmp_path, semente=3)
    r = executar(tmp_path)
    assert len(r.ganhos_periodo) == len(r.periodos_ganhos) >= 10
    assert all((b - a).days == 28 for a, b in zip(r.periodos_ganhos, r.periodos_ganhos[1:]))
    assert sum(r.ganhos_periodo) <= sum(s["ganhos"] for s in r.semanal)


# ---------------------------------------------------------------- ficheiros estragados e revisão à mão


def test_ficheiros_estragados_nao_param_a_analise(tmp_path):
    p = projeto(tmp_path)
    d = p / "dados"
    (d / "whatsapp" / "WhatsApp Chat - X.zip").write_bytes(b"PK\x03\x04lixo")
    (d / "chamadas" / "c.xml").write_text("<calls><call ", encoding="utf-8")
    (d / "site" / "s.json").write_text('[{"nome": ', encoding="utf-8")
    (d / "whatsapp" / "Conversa do WhatsApp com Ana Silva.txt").write_text(
        "02/03/26, 10:00 - Ana Silva: Queria orçamento para 2 splits\n"
        "02/03/26, 11:00 - MDM Climatização: Bom dia, passamos amanhã\n", encoding="utf-16")
    r = executar(p)
    aviso = next(a for a in r.cobertura["avisos"] if "não foram lidos" in a)
    assert "X.zip" in aviso and "c.xml" in aviso and "s.json" in aviso
    assert len(r.pedidos) == 1 and r.pedidos[0].h_resposta == 1.0   # o .txt em UTF-16 também se lê


@pytest.mark.parametrize("chave_a,chave_b", [("ORC0010_2026", "912 000 001"), ("orc:ORC0010_2026", "tel:+351 912 000 001")])
def test_ligacoes_escritas_a_mao(tmp_path, chave_a, chave_b):
    p = projeto(tmp_path)
    quando = int(t(2026, 3, 2, 10).timestamp() * 1000)
    (p / "dados" / "chamadas" / "chamadas.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><calls count="1"><call number="+351912000001" duration="120" '
        f'date="{quando}" type="1" contact_name="(Unknown)" /></calls>', encoding="utf-8")
    caixa(p, [email(MDM, ANA, t(2026, 3, 4, 10), "Orçamento", "Segue o orçamento.", anexo="ORC0010_2026 Ana Silva.pdf")])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 4), contacto="ana.silva@gmail.com")
    (p / "revisao").mkdir()
    (p / "revisao" / "ligacoes.csv").write_text(
        f"chave_a;chave_b;nota\n{chave_a};{chave_b};confirmado\nORC9999_2026;abc;engano\n", encoding="utf-8")
    r = executar(p)
    assert len(r.pedidos) == 1 and r.pedidos[0].canal == "chamada"
    aviso = next(a for a in r.cobertura["avisos"] if "ligacoes.csv" in a)
    assert "ORC9999_2026" in aviso and "abc" in aviso


def test_amostra_nova_nao_repete_pedidos(tmp_path):
    import csv

    from funil.__main__ import principal
    from funil.exemplo import gerar
    gerar(tmp_path, semente=7)
    assert principal(["amostra", "--pasta", str(tmp_path)]) == 0
    assert principal(["amostra", "--pasta", str(tmp_path), "--semente", "2"]) == 0

    def ids(nome):
        with open(tmp_path / "saida" / nome, encoding="utf-8-sig") as f:
            return {l["id"] for l in csv.DictReader(f, delimiter=";")}

    primeira, segunda = ids("amostra_A.csv"), ids("amostra_A_2.csv")
    assert len(segunda) == 40 and not (primeira & segunda)
