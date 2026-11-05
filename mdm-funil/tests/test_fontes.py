import mailbox
from collections import Counter
from datetime import datetime
from email.message import EmailMessage
from email.utils import format_datetime

from funil.config import carregar
from funil.datas import LX
from funil.fontes import correio, whatsapp
from funil.fontes.chamadas import ler_csv, ler_xml

CFG = carregar()

ANDROID = """16/10/26, 14:20 - As mensagens e as chamadas são encriptadas ponto a ponto.
16/10/26, 14:23 - Ana Silva: Bom dia, queria orçamento para 2 splits
Moro em Almada.
16/10/26, 15:02 - MDM: Olá Ana, podemos passar amanhã?
17/10/26, 09:15 - Ana Silva: Chamada de voz perdida
"""

IPHONE = """[16/10/26, 14:20:00] ‎As mensagens e as chamadas são encriptadas ponto a ponto.
[16/10/26, 14:23:11] +351 912 345 678: ‎O AC deixou de funcionar
[16/10/26, 2:05:00 PM] MDM Climatização: Vamos ligar-lhe
"""


def test_whatsapp_android():
    evs = whatsapp.ler_conversa(ANDROID, "Ana Silva", "Conversa do WhatsApp com Ana Silva.txt", CFG)
    assert [e.direcao for e in evs] == ["entrada", "saida", "entrada"]
    assert evs[0].texto == "Bom dia, queria orçamento para 2 splits\nMoro em Almada."
    assert evs[0].ts == datetime(2026, 10, 16, 14, 23, tzinfo=LX)
    assert evs[2].tipo == "chamada_perdida"
    assert "nome:ana silva" in evs[0].chaves


def test_whatsapp_iphone_com_numero():
    evs = whatsapp.ler_conversa(IPHONE, "+351 912 345 678", "x.txt", CFG)
    assert len(evs) == 2
    assert "tel:+351912345678" in evs[0].chaves
    assert evs[0].texto == "O AC deixou de funcionar"
    assert evs[1].direcao == "saida" and evs[1].ts.hour == 14


def test_nome_da_conversa(tmp_path):
    from pathlib import Path
    assert whatsapp.nome_da_conversa(Path("Conversa do WhatsApp com João Pires.txt")) == "João Pires"
    assert whatsapp.nome_da_conversa(Path("WhatsApp Chat - Ana Silva/_chat.txt")) == "Ana Silva"


def _mbox(tmp_path, mensagens):
    caminho = tmp_path / "caixa.mbox"
    caixa = mailbox.mbox(str(caminho))
    for m in mensagens:
        caixa.add(m)
    caixa.flush()
    caixa.close()
    return caminho


def _msg(de, para, assunto, corpo, quando, **extra):
    m = EmailMessage()
    m["From"], m["To"], m["Subject"] = de, para, assunto
    m["Date"] = format_datetime(quando)
    m["Message-ID"] = f"<{abs(hash((de, assunto, quando))):x}@t>"
    for k, v in extra.items():
        m[k.replace("_", "-")] = v
    m.set_content(corpo)
    return m


def test_mbox_filtra_e_classifica(tmp_path):
    t = datetime(2026, 10, 14, 10, tzinfo=LX)
    cfg = carregar()
    cfg["email"]["dominios_ignorar"] = ["fornecedor.pt"]
    caminho = _mbox(tmp_path, [
        _msg('"Ana Silva" <ana@gmail.com>', "mdmassistencia@gmail.com", "Orçamento AC",
             "Queria orçamento. Tel 912 345 678\n\nEm 13/10/2026, MDM <mdmassistencia@gmail.com> escreveu:\n> 219990000", t),
        _msg("MDM <mdmassistencia@gmail.com>", '"Ana Silva" <ana@gmail.com>', "Re: Orçamento AC",
             "Segue ORC0007_2026", t.replace(hour=11)),
        _msg("promo@marca.pt", "mdmassistencia@gmail.com", "Promo", "x", t, List_Unsubscribe="<mailto:a@b>"),
        _msg("vendas@fornecedor.pt", "mdmassistencia@gmail.com", "Fatura", "x", t),
        _msg("spam@x.biz", "mdmassistencia@gmail.com", "Ganhe", "x", t, X_Gmail_Labels="Spam"),
        _msg("no-reply@banco.pt", "mdmassistencia@gmail.com", "Extrato", "x", t),
    ])
    est = Counter()
    evs = correio.ler_mbox(caminho, cfg, est)
    assert [(e.direcao, e.fonte) for e in evs] == [("entrada", "email"), ("saida", "email")]
    assert evs[0].chaves == {"email:ana@gmail.com", "nome:ana silva", "tel:+351912345678"}
    assert evs[1].refs_orc == {"ORC0007_2026"}
    assert est["spam ou lixo"] == 1 and est["ignorados (fornecedores e outros)"] == 1
    assert est["automáticos (newsletters, avisos)"] == 2


def test_chamadas_xml_e_csv(tmp_path):
    xml = tmp_path / "c.xml"
    ms = int(datetime(2026, 10, 14, 10, tzinfo=LX).timestamp() * 1000)
    xml.write_text(f"""<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><calls count="3">
<call number="+351912345678" duration="0" date="{ms}" type="3" contact_name="(Unknown)" />
<call number="912345678" duration="60" date="{ms + 3600000}" type="2" contact_name="Ana Silva" />
<call number="+351219990000" duration="60" date="{ms}" type="1" contact_name="MDM" /></calls>""", encoding="utf-8")
    cfg = carregar()
    cfg["empresa"]["telefones"] = ["219990000"]
    est = Counter()
    evs = ler_xml(xml, cfg, est)
    assert [(e.tipo, e.direcao) for e in evs] == [("chamada_perdida", "entrada"), ("chamada_saida", "saida")]
    assert est["ignoradas"] == 1
    csvf = tmp_path / "c.csv"
    csvf.write_text("Data;Hora;Número;Tipo;Duração\n14/10/2026;10:00;912 345 678;Não atendida;0:00\n"
                    "14/10/2026;11:00;912 345 678;Efetuada;1:05\n14/10/2026;12:00;912 345 678;Recebida;2:00\n",
                    encoding="utf-8")
    evs = ler_csv(csvf, cfg, Counter())
    assert [e.tipo for e in evs] == ["chamada_perdida", "chamada_saida", "chamada_atendida"]
    assert evs[1].extra["duracao"] == 65
