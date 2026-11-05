"""Casos encontrados na revisão independente. Cada teste reproduz um erro que já foi corrigido."""

import sys
import zipfile
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).parent))

from mini import MDM, caixa, email, orcamento, projeto, t, whatsapp  # noqa: E402

from funil.analise import janela  # noqa: E402
from funil.config import carregar  # noqa: E402
from funil.datas import LX, Calendario, ler_data, pascoa  # noqa: E402
from funil.fontes.tabelas import ler_tabela  # noqa: E402
from funil.motor import executar  # noqa: E402
from funil.prioridade import _tamanhos_teste, minimo_teste  # noqa: E402

ANA = '"Ana Silva" <ana.silva@gmail.com>'
JOAO = '"João Costa" <joao.costa@sapo.pt>'
RITA = '"Rita Gomes" <rita.gomes@hotmail.com>'


def _por_nome(r):
    return {p.nome: p for p in r.pedidos}


# ---------------------------------------------------------------- ligação de clientes


def test_email_ao_tecnico_com_varios_orc_nao_junta_clientes(tmp_path):
    p = projeto(tmp_path)
    tecnico = '"Carlos Técnico" <carlos.tecnico@gmail.com>'
    msgs = []
    for cliente, nome, orc, (a, m, d) in [(ANA, "Ana Silva", "ORC0010_2026", (2026, 3, 2)),
                                          (JOAO, "João Costa", "ORC0011_2026", (2026, 3, 20)),
                                          (RITA, "Rita Gomes", "ORC0012_2026", (2026, 4, 8))]:
        msgs += [email(cliente, MDM, t(a, m, d, 10), "Orçamento", "Queria orçamento para instalar ar condicionado."),
                 email(MDM, cliente, t(a, m, d, 15), "Re: Orçamento", "Podemos passar amanhã para medir."),
                 email(MDM, tecnico, t(a, m, d + 1, 8), f"Medição {orc}", f"Carlos, amanhã medes o {orc}."),
                 email(MDM, cliente, t(a, m, d + 2, 12), f"Orçamento {orc}", f"Segue o orçamento {orc}.")]
        orcamento(p, orc, nome, data=datetime(a, m, d + 2))
    caixa(p, msgs)
    r = executar(p)
    pedidos = [x for x in r.pedidos if x.incluir]
    assert len(pedidos) == 3 and len({x.cliente for x in pedidos}) == 3
    assert sorted(x.orc for x in pedidos) == ["ORC0010_2026", "ORC0011_2026", "ORC0012_2026"]
    assert all(x.h_resposta == 5.0 for x in pedidos)


def test_arquiteto_em_copia_nao_junta_clientes_e_a_resposta_conta(tmp_path):
    p = projeto(tmp_path)
    arq = '"Arq. Rui Lopes" <rui@arq-lopes.pt>'
    caixa(p, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 3 splits na moradia."),
        email(MDM, f"{ANA}, {arq}", t(2026, 3, 2, 14), "Re: Orçamento", "Bom dia, podemos visitar a obra quinta."),
        email(JOAO, MDM, t(2026, 3, 20, 10), "Avaria", "O ar condicionado deixou de funcionar."),
        email(MDM, f"{JOAO}, {arq}", t(2026, 3, 20, 11), "Re: Avaria", "Bom dia, passamos amanhã."),
    ])
    r = executar(p)
    por_nome = _por_nome(r)
    assert set(por_nome) == {"Ana Silva", "João Costa"}
    assert por_nome["Ana Silva"].cliente != por_nome["João Costa"].cliente
    # O cliente é o único destinatário que escreveu à MDM.
    assert por_nome["Ana Silva"].h_resposta == 4.0 and por_nome["João Costa"].h_resposta == 1.0


def test_email_para_varias_pessoas_que_escreveram_conta_para_cada_uma(tmp_path):
    p = projeto(tmp_path)
    caixa(p, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits."),
        email(JOAO, MDM, t(2026, 3, 2, 11), "Orçamento", "Queria orçamento para instalar 1 split."),
        email(MDM, f"{ANA}, {JOAO}", t(2026, 3, 2, 14), "Visitas", "Passamos nas duas moradias amanhã."),
    ])
    r = executar(p)
    por_nome = _por_nome(r)
    # A resposta foi para os dois: conta para cada um, sem os juntar num só cliente.
    assert por_nome["Ana Silva"].h_resposta == 4.0 and por_nome["João Costa"].h_resposta == 3.0
    assert por_nome["Ana Silva"].cliente != por_nome["João Costa"].cliente


@pytest.mark.parametrize("tecnico", ["+351 913 000 999", "Carlos Técnico"])
def test_conversa_com_o_tecnico_nao_junta_clientes(tmp_path, tecnico):
    p = projeto(tmp_path)
    caixa(p, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits."),
        email(MDM, ANA, t(2026, 3, 4, 10), "Orçamento ORC0010_2026", "Segue o orçamento ORC0010_2026."),
        email(JOAO, MDM, t(2026, 3, 9, 10), "Orçamento", "Queria orçamento para instalar 1 split."),
        email(MDM, JOAO, t(2026, 3, 11, 10), "Orçamento ORC0011_2026", "Segue o orçamento ORC0011_2026."),
    ])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 4))
    orcamento(p, "ORC0011_2026", "João Costa", data=datetime(2026, 3, 11))
    whatsapp(p, tecnico, [f"03/03/26, 08:00 - MDM Climatização: Carlos, amanhã medes a casa do ORC0010_2026",
                          f"03/03/26, 08:05 - {tecnico}: Ok, combinado",
                          f"10/03/26, 08:00 - MDM Climatização: Hoje vais ao ORC0011_2026",
                          f"10/03/26, 08:10 - {tecnico}: Ok, vou lá às 10h ver o ar condicionado"])
    r = executar(p)
    por_nome = {x.nome: x for x in r.pedidos if x.incluir}
    assert set(por_nome) == {"Ana Silva", "João Costa"}
    assert por_nome["Ana Silva"].cliente != por_nome["João Costa"].cliente
    assert por_nome["Ana Silva"].t_resposta == t(2026, 3, 4, 10)   # a mensagem ao técnico não é resposta à Ana
    assert not any(e.fonte == "whatsapp" and e.cliente is not None for e in r.eventos)


def test_nunca_partilhados_e_conversas_ignorar(tmp_path):
    extra = '[pedidos]\nnunca_partilhados = ["912 000 001"]\n[whatsapp]\nconversas_ignorar = ["Fornecedor Frio"]\n'
    p = projeto(tmp_path, extra=extra)
    # A mesma cliente tem orçamentos em nome dela e da loja: sem a exceção, o número seria tratado como partilhado.
    whatsapp(p, "+351 912 000 001", [
        "02/03/26, 10:00 - +351 912 000 001: Bom dia, queria orçamento para a minha casa e para a loja",
        "04/03/26, 10:00 - MDM Climatização: Segue o orçamento ORC0010_2026",
        "04/03/26, 10:01 - MDM Climatização: E o da loja, ORC0011_2026"])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 4), contacto="912 000 001")
    orcamento(p, "ORC0011_2026", "Pastelaria Doce Lar", data=datetime(2026, 3, 4), contacto="912 000 001")
    whatsapp(p, "Fornecedor Frio", ["05/03/26, 09:00 - Fornecedor Frio: Bom dia, o orçamento do gás está pronto"])
    r = executar(p)
    assert not r.partilhados
    assert len(r.pedidos) == 1 and r.pedidos[0].n_orc == 2
    assert r.cobertura["fontes"]["whatsapp"]["detalhe"]["conversas ignoradas (config.toml)"] == 1


@pytest.mark.parametrize("nomes,partilhado", [
    (("Ana Silva", "Ana Maria Silva"), False),
    (("Condomínio Rua das Flores 12", "Condomínio Avenida Central 5"), True),
])
def test_nomes_parecidos_nos_orcamentos(tmp_path, nomes, partilhado):
    p = projeto(tmp_path)
    caixa(p, [email('"Gestão Lopes" <geral@gestao-lopes.pt>', MDM, t(2026, 3, 2, 10), "Orçamentos",
                    "Bom dia, pedimos orçamento para o ar condicionado."),
              email(MDM, '"Gestão Lopes" <geral@gestao-lopes.pt>', t(2026, 3, 4, 10), "Orçamento",
                    "Segue o orçamento.", anexo=f"ORC0010_2026 {nomes[0]}.pdf"),
              email(MDM, '"Gestão Lopes" <geral@gestao-lopes.pt>', t(2026, 3, 4, 11), "Orçamento",
                    "Segue o segundo orçamento.", anexo=f"ORC0011_2026 {nomes[1]}.pdf")])
    orcamento(p, "ORC0010_2026", nomes[0], data=datetime(2026, 3, 4))
    orcamento(p, "ORC0011_2026", nomes[1], data=datetime(2026, 3, 4))
    r = executar(p)
    assert ("email:geral@gestao-lopes.pt" in r.partilhados) == partilhado


def test_sugestao_de_ligacao_e_juntar_a_mao(tmp_path):
    p = projeto(tmp_path)
    # O cliente liga (número sem nome) e o orçamento segue por email: nada liga o telefone ao email.
    quando = int(t(2026, 3, 2, 10).timestamp() * 1000)
    (p / "dados" / "chamadas" / "chamadas.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><calls count="1"><call number="+351912000001" duration="120" '
        f'date="{quando}" type="1" presentation="1" contact_name="(Unknown)" /></calls>', encoding="utf-8")
    caixa(p, [email(MDM, ANA, t(2026, 3, 4, 10), "Orçamento", "Segue o orçamento.", anexo="ORC0010_2026 Ana Silva.pdf")])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 4), contacto="ana.silva@gmail.com")
    r = executar(p)
    assert len(r.pedidos) == 2
    sugestoes = [l for l in r.ligacoes if l["situacao"].startswith("orçamento sem contacto")]
    assert len(sugestoes) == 1 and "tel:+351912000001" in sugestoes[0]["detalhe"]
    # Depois de confirmar, a pessoa escreve as duas chaves em revisao/ligacoes.csv e o pedido fica inteiro.
    (p / "revisao").mkdir(exist_ok=True)
    (p / "revisao" / "ligacoes.csv").write_text(
        "chave_a;chave_b;nota\norc:ORC0010_2026;tel:+351912000001;confirmado\n", encoding="utf-8")
    r = executar(p)
    assert len(r.pedidos) == 1
    x = r.pedidos[0]
    assert x.canal == "chamada" and x.orc == "ORC0010_2026" and x.t_envio == t(2026, 3, 4, 10)


# ---------------------------------------------------------------- WhatsApp


def test_dois_chat_txt_em_pastas_diferentes(tmp_path):
    p = projeto(tmp_path)
    for pasta, nome, linhas in [
        ("WhatsApp Chat - Ana Silva", "Ana Silva",
         ["[02/03/26, 10:00:05] Ana Silva: Bom dia, queria orçamento para instalar 2 splits",
          "[02/03/26, 15:00:00] MDM Climatização: Olá Ana, podemos passar amanhã?"]),
        ("WhatsApp Chat - João Costa", "João Costa",
         ["[10/03/26, 09:00:05] João Costa: O ar condicionado deixou de funcionar, podem vir ver?",
          "[12/03/26, 11:00:00] MDM Climatização: Bom dia João, vamos ligar-lhe."]),
    ]:
        d = p / "dados" / "whatsapp" / pasta
        d.mkdir()
        sistema = f"{linhas[0][:21]} {nome}: ‎As mensagens e as chamadas são encriptadas ponto a ponto."
        (d / "_chat.txt").write_text("\n".join([sistema] + linhas) + "\n", encoding="utf-8")
    r = executar(p)
    ps = sorted(r.pedidos, key=lambda x: x.t_contacto)
    assert [x.nome for x in ps] == ["Ana Silva", "João Costa"]
    assert [x.h_resposta for x in ps] == [5.0, 20.0]


def test_linhas_de_sistema_do_iphone_nao_sao_mensagens(tmp_path):
    p = projeto(tmp_path)
    with zipfile.ZipFile(p / "dados" / "whatsapp" / "WhatsApp Chat - Rui Matos.zip", "w") as z:
        z.writestr("_chat.txt",
                   "[05/03/26, 16:44:10] Rui Matos: ‎As mensagens e as chamadas são encriptadas ponto a ponto. "
                   "Ninguém fora desta conversa, nem mesmo o WhatsApp, pode lê-las ou ouvi-las.\n"
                   "[05/03/26, 16:44:12] MDM Climatização: Boa tarde, segue o orçamento ORC0040_2026 conforme falámos.\n"
                   "[20/07/26, 08:12:00] Rui Matos: ‎O seu código de segurança com Rui Matos mudou. "
                   "Toque para saber mais.\n")
    orcamento(p, "ORC0040_2026", "Rui Matos", data=datetime(2026, 3, 5), contacto="912 111 222")
    r = executar(p)
    assert len(r.pedidos) == 1
    x = r.pedidos[0]
    # O pedido chegou pelo telefone fixo (sem registo): conta a partir do orçamento, não de uma linha do sistema.
    assert x.t_contacto is None and x.confianca == "orçamento sem contacto"
    assert x.t_envio == t(2026, 3, 5, 16, 44, 12)
    assert not any(e.direcao == "entrada" for e in r.eventos)


def test_mdm_reconhecida_pelo_nome_no_whatsapp(tmp_path):
    p = projeto(tmp_path, nomes=("MDM Climatização", "Bernardo"))
    whatsapp(p, "+351 912 000 001", ["02/03/26, 10:00 - +351 912 000 001: Bom dia, queria orçamento para 2 splits",
                                     "02/03/26, 15:00 - Bernardo Gouveia: Olá, podemos passar amanhã?"])
    # Conversa a dois com um nome que não está na configuração: quem não é o contacto é a MDM.
    whatsapp(p, "Ana Silva", ["10/03/26, 09:00 - Ana Silva: O ar condicionado deixou de funcionar",
                              "10/03/26, 09:30 - Paulo Ferreira: Vamos ligar-lhe já."])
    r = executar(p)
    assert sorted(x.h_resposta for x in r.pedidos) == [0.5, 5.0]
    assert sum(e.direcao == "saida" for e in r.eventos) == 2


def test_mensagens_automaticas_do_whatsapp_business_nao_sao_resposta(tmp_path):
    p = projeto(tmp_path, extra='[whatsapp]\nmensagens_automaticas = ["Estamos ausentes"]\n')
    saudacao = "Olá! Obrigado pelo contacto com a MDM Climatização. Respondemos assim que possível."
    for i, dia in enumerate((2, 3, 4), start=1):
        tel = f"+351 912 000 00{i}"
        whatsapp(p, tel, [f"0{dia}/03/26, 10:00 - {tel}: Bom dia, queria orçamento para instalar ar condicionado",
                          f"0{dia}/03/26, 10:00 - MDM Climatização: {saudacao}",
                          f"0{dia}/03/26, 14:00 - MDM Climatização: Bom dia, podemos passar amanhã para ver?"])
    tel = "+351 912 000 009"
    whatsapp(p, tel, [f"07/03/26, 21:00 - {tel}: Boa noite, queria orçamento para um split",
                      "07/03/26, 21:01 - MDM Climatização: Estamos ausentes. Respondemos no próximo dia útil.",
                      "09/03/26, 11:00 - MDM Climatização: Bom dia, quantos m2 tem a sala?"])
    r = executar(p)
    assert sorted(x.h_resposta for x in r.pedidos) == [2.0, 4.0, 4.0, 4.0]
    assert r.cobertura["fontes"]["whatsapp"]["detalhe"]["mensagens automáticas da MDM (não contam como resposta)"] == 4


# ---------------------------------------------------------------- email


def test_ausencia_automatica_e_rascunhos_nao_sao_resposta(tmp_path):
    p = projeto(tmp_path)
    caixa(p, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits."),
        email(MDM, ANA, t(2026, 3, 2, 10, 1), "Ausência", "Estou ausente até dia 4.", Auto_Submitted="auto-replied"),
        email(MDM, ANA, t(2026, 3, 2, 11), "Re: Orçamento", "Rascunho por acabar", X_Gmail_Labels="Rascunhos"),
        email(MDM, ANA, t(2026, 3, 4, 10), "Re: Orçamento", "Bom dia, podemos passar quinta?"),
    ])
    r = executar(p)
    assert r.pedidos[0].t_resposta == t(2026, 3, 4, 10)
    assert r.cobertura["fontes"]["email"]["detalhe"]["rascunhos"] == 1


# ---------------------------------------------------------------- pedidos e decisões


def test_pedido_novo_depois_da_fatura(tmp_path):
    p = projeto(tmp_path)
    caixa(p, [
        email(ANA, MDM, t(2026, 1, 5, 10), "Orçamento", "Bom dia, queria orçamento para instalar 2 splits."),
        email(MDM, ANA, t(2026, 1, 6, 10), "Re: Orçamento", "Bom dia, podemos passar quinta."),
        email(MDM, ANA, t(2026, 1, 8, 10), "Orçamento ORC0003_2026", "Segue o orçamento ORC0003_2026."),
        email(ANA, MDM, t(2026, 1, 10, 10), "Re: Orçamento ORC0003_2026", "Aceito o orçamento, podem marcar."),
        email(ANA, MDM, t(2026, 2, 16, 10), "Avaria",
              "Bom dia, o ar condicionado do escritório deixou de funcionar. Podem vir ver?"),
        email(MDM, ANA, t(2026, 2, 16, 12), "Re: Avaria", "Bom dia, passamos aí amanhã."),
    ])
    orcamento(p, "ORC0003_2026", "Ana Silva", data=datetime(2026, 1, 8))
    (p / "dados" / "faturas" / "f.csv").write_text(
        "data;numero;cliente;nif;valor;descricao\n20/01/2026;FT 2026/4;Ana Silva;212345678;1.900,00;Instalação\n",
        encoding="utf-8")
    r = executar(p)
    a, b = sorted(r.pedidos, key=lambda x: x.t_inicio)
    assert a.resultado == "ganho" and a.orc == "ORC0003_2026" and a.t_aceite == t(2026, 1, 10, 10)
    # Cinco semanas depois da fatura, a avaria é um pedido novo (com o seu próprio tempo de resposta).
    assert b.t_contacto == t(2026, 2, 16, 10) and b.h_resposta == 2.0 and not b.orc


def test_maduro_pela_idade_e_nao_pelo_resultado(tmp_path):
    p = projeto(tmp_path, hoje="2026-10-16")
    caixa(p, [
        email(ANA, MDM, t(2026, 5, 4, 10), "Orçamento", "Queria orçamento para instalar 2 splits."),
        email(JOAO, MDM, t(2026, 9, 7, 10), "Orçamento", "Queria orçamento para instalar 1 split."),
        email(MDM, JOAO, t(2026, 9, 8, 10), "Orçamento ORC0050_2026", "Segue o orçamento ORC0050_2026."),
        email(JOAO, MDM, t(2026, 9, 9, 10), "Re: Orçamento", "Aceito, podem marcar."),
    ])
    orcamento(p, "ORC0050_2026", "João Costa", data=datetime(2026, 9, 8))
    r = executar(p)
    por_nome = _por_nome(r)
    assert por_nome["Ana Silva"].maduro and not por_nome["João Costa"].maduro
    # O ganho recente não entra na taxa: só o pedido de maio (perdido) já teve tempo de ser decidido.
    total = r.funil[-1]
    assert total["decididos"] == 1 and total["ganhos"] == 0


# ---------------------------------------------------------------- orçamentos e faturas


def test_datas_dos_orcamentos(tmp_path):
    p = projeto(tmp_path)
    caixa(p, [
        email(ANA, MDM, t(2025, 6, 2, 10), "Orçamento", "Queria orçamento para instalar ar condicionado."),
        email(MDM, ANA, t(2025, 6, 10, 11), "Orçamento ORC0041_2025", "Segue o orçamento ORC0041_2025."),
    ])
    antigo = datetime(2019, 5, 2, 9)
    # Data escrita como texto, num ficheiro feito a partir de um modelo antigo.
    orcamento(p, "ORC0040_2026", "Rui Matos", data="05/03/2026", criado=antigo)
    # Data com o ano errado: vale a data do email que enviou o orçamento.
    orcamento(p, "ORC0041_2025", "Ana Silva", data="05/03/2019", criado=antigo)
    # Sem data válida nem mensagem: fica de fora, com aviso.
    orcamento(p, "ORC0099_2024", "Rita Gomes", criado=antigo)
    r = executar(p)
    orcs = {e.numero: e for e in r.eventos if e.fonte == "orc"}
    assert set(orcs) == {"ORC0040_2026", "ORC0041_2025"}
    assert orcs["ORC0040_2026"].ts.date() == date(2026, 3, 5)
    assert orcs["ORC0041_2025"].ts.date() == date(2025, 6, 10)
    assert any("ORC ficaram de fora" in a for a in r.cobertura["avisos"])
    # O período vem dos contactos dos clientes, não dos documentos.
    assert janela(r.pedidos)[0] == t(2025, 6, 2, 10)


def test_tipos_de_documento_das_faturas(tmp_path):
    p = projeto(tmp_path)
    caixa(p, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits."),
        email(MDM, ANA, t(2026, 3, 3, 10), "Orçamento ORC0010_2026", "Segue o orçamento ORC0010_2026."),
        email(RITA, MDM, t(2026, 3, 9, 10), "Orçamento", "Queria orçamento para instalar 1 split."),
        email(MDM, RITA, t(2026, 3, 10, 10), "Orçamento ORC0011_2026", "Segue o orçamento ORC0011_2026."),
    ])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 3), valor="1.500,00 € + IVA")
    orcamento(p, "ORC0011_2026", "Rita Gomes", data=datetime(2026, 3, 10), valor="800,00 € + IVA")
    (p / "dados" / "faturas" / "docs.csv").write_text(
        "data;numero;cliente;nif;valor;descricao\n"
        "05/03/2026;FT 2026/9;Ana Silva;212345678;1.500,00;Instalação 2 splits ref. ORC0010_2026\n"
        "05/03/2026;RG 2026/9;Ana Silva;212345678;1.500,00;Recibo da FT 2026/9\n"
        "10/03/2026;NC 2026/1;Ana Silva;212345678;300,00;Nota de crédito da FT 2026/9\n"
        "12/03/2026;PF 2026/4;João Costa;223456789;4.200,00;Fatura pró-forma\n"
        "16/03/2026;FT 2026/12;Rita Gomes;234567890;800,00;Instalação 1 split ref. ORC0011_2026\n"
        "20/03/2026;NC 2026/2;Rita Gomes;234567890;800,00;Anulação da FT 2026/12\n",
        encoding="utf-8")
    r = executar(p)
    por_nome = _por_nome(r)
    assert por_nome["Ana Silva"].resultado == "ganho" and por_nome["Ana Silva"].valor_fatura == 1200.0
    assert por_nome["Rita Gomes"].resultado == "perdido"
    assert por_nome["Rita Gomes"].motivo == "fatura anulada por nota de crédito"
    assert "João Costa" not in por_nome   # uma pró-forma não é uma venda
    detalhe = r.cobertura["fontes"]["faturas"]["detalhe"]
    assert detalhe["documentos RG ignorados"] == 1 and detalhe["documentos PF ignorados"] == 1
    assert detalhe["notas de crédito"] == 2


def test_fatura_em_excel_fica_ao_fim_do_dia(tmp_path):
    p = projeto(tmp_path)
    caixa(p, [
        email(ANA, MDM, t(2026, 3, 2, 10), "Avaria", "O ar condicionado deixou de funcionar, podem vir?"),
        email(MDM, ANA, t(2026, 3, 3, 9), "Orçamento ORC0010_2026", "Segue o orçamento ORC0010_2026."),
        email(ANA, MDM, t(2026, 3, 5, 10), "Re: Orçamento ORC0010_2026", "Aceito, podem vir hoje à tarde."),
    ])
    orcamento(p, "ORC0010_2026", "Ana Silva", data=datetime(2026, 3, 3), valor="180,00 € + IVA")
    wb = Workbook()
    ws = wb.active
    ws.append(["data", "numero", "cliente", "nif", "valor", "descricao"])
    ws.append([datetime(2026, 3, 5), "FT 2026/9", "Ana Silva", "212345678", 180.0, "Reparação ref. ORC0010_2026"])
    wb.save(p / "dados" / "faturas" / "faturas.xlsx")
    r = executar(p)
    x = r.pedidos[0]
    assert x.t_aceite == t(2026, 3, 5, 10) and x.t_fatura == t(2026, 3, 5, 18)
    assert r.tempos[3]["n"] == 1   # aceite até à fatura: medido, e não negativo


def test_csv_com_virgula_no_cabecalho(tmp_path):
    caminho = tmp_path / "faturas.csv"
    caminho.write_text("Data;Número;Cliente;NIF;Valor (s/IVA, €)\n" +
                       "".join(f"{d:02d}/10/2026;FT 2026/{d};Cliente {d};2123456{d:02d};1234,{d:02d}\n"
                               for d in range(1, 15)), encoding="cp1252")
    linhas = ler_tabela(caminho)
    assert len(linhas) == 14 and len(linhas[0]) == 5


# ---------------------------------------------------------------- datas e regras


def test_minimo_do_teste_e_coerente():
    cfg = carregar()
    n = minimo_teste(cfg)
    assert _tamanhos_teste(n - 1, cfg) is None and _tamanhos_teste(n, cfg) is not None


def _pascoa_gauss(y):
    a, b, c = y % 19, y % 4, y % 7
    k = y // 100
    p = (13 + 8 * k) // 25
    q = k // 4
    m = (15 - p + k - q) % 30
    n = (4 + k - q) % 7
    d = (19 * a + m) % 30
    e = (2 * b + 4 * c + 6 * d + n) % 7
    if d == 29 and e == 6:
        return date(y, 4, 19)
    if d == 28 and e == 6 and (11 * m + 11) % 30 < 19:
        return date(y, 4, 18)
    return date(y, 3, 22) + timedelta(days=d + e)


def test_pascoa_igual_a_outro_algoritmo():
    assert all(pascoa(y) == _pascoa_gauss(y) for y in range(1900, 2200))


def test_horas_uteis_com_horas_em_utc():
    cal = Calendario()
    # Sexta 16h em Lisboa até segunda 10h, com a mudança de hora pelo meio e uma das datas em UTC.
    assert cal.horas_uteis(datetime(2026, 10, 23, 16, tzinfo=LX), datetime(2026, 10, 26, 10, tzinfo=timezone.utc)) == 3.0
    assert cal.horas_uteis(datetime(2026, 3, 27, 16, tzinfo=timezone.utc), datetime(2026, 3, 30, 9, tzinfo=timezone.utc)) == 3.0


def test_datas_do_supabase():
    for texto in ("2026-10-16 14:23:11.123456+00", "2026-10-16T14:23:11.123456+00:00"):
        d = ler_data(texto)
        assert d is not None and d.astimezone(timezone.utc).hour == 14 and d.utcoffset() == timedelta(hours=1)


def test_relatorio_de_um_projeto_pequeno(tmp_path):
    """Com poucos dados, as secções vazias também funcionam e o texto não tem travessões."""
    from funil.relatorio import gerar_html
    p = projeto(tmp_path)
    caixa(p, [email(ANA, MDM, t(2026, 3, 2, 10), "Orçamento", "Queria orçamento para instalar 2 splits.")])
    html = gerar_html(executar(p))
    assert chr(0x2014) not in html and Counter(html)["�"] == 0
