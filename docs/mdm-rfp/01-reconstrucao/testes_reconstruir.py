#!/usr/bin/env python3
"""Testes do reconstruir.py, só com a biblioteca padrão: python3 testes_reconstruir.py
Cada teste corresponde a um erro encontrado na revisão de 23/10/2026 (ver REVISAO-2026-10-23.md, no dossier, fora do repositório)."""
import datetime as dt, mailbox, os, sys, tempfile, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reconstruir as r

def gravar(caminho, texto):
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(texto)

def ler(caminho):
    with open(caminho, encoding="utf-8") as f:
        return f.read()

def toque(cliente, data, etapa, fonte="email", **k):
    return dict(cliente=cliente, data=data, etapa=etapa, fonte=fonte, detalhe="", **k)

class Numeros(unittest.TestCase):
    def test_valor_do_registo_nao_multiplica_por_dez(self):
        self.assertEqual(r._num("1180.5"), 1180.5)          # export do Supabase
        self.assertEqual(r._num("1.180,50"), 1180.5)        # escrito à mão
        self.assertEqual(r._num("1 180,50 €"), 1180.5)
        self.assertEqual(r._num("1500"), 1500.0)
        self.assertIsNone(r._num(""))

    def test_euros_em_portugues(self):
        self.assertEqual(r.eur(4500), "4 500,00 €")
        self.assertEqual(r.eur(40420.86), "40 420,86 €")
        self.assertEqual(r.eur(-120), "-120,00 €")

class Nomes(unittest.TestCase):
    def test_numeros_diferentes_sao_clientes_diferentes(self):
        self.assertFalse(r.parece_mesmo("Escola Básica n.º 3", "Escola Básica n.º 5"))

    def test_so_palavras_genericas_nao_chegam(self):
        self.assertFalse(r.parece_mesmo("Condomínio Rua das Flores", "Condomínio Rua do Sol"))
        self.assertFalse(r.parece_mesmo("Clínica Dentária Sorriso", "Clínica Dentária Lumiar"))

    def test_o_mesmo_cliente_escrito_de_outra_forma(self):
        self.assertTrue(r.parece_mesmo("Alfa Construções Lda", "Alfa Construções"))
        self.assertTrue(r.parece_mesmo("Pires, João", "João Pires"))
        self.assertTrue(r.parece_mesmo("Hotel Miradouro", "Miradouro Hotel Lda"))

class Pedidos(unittest.TestCase):
    def test_conflito_entre_fontes_fica_registado(self):
        g = {"nomes": {"Alfa"}, "toques": [toque("Alfa", "2026-07-03", "pedido", "registo"), toque("Alfa", "2026-07-09", "pedido", "email")]}
        l = r.percurso(g)
        self.assertEqual(l["pedido"], "2026-07-03")
        self.assertIn("2026-07-03 (registo)", l["conflitos"]); self.assertIn("2026-07-09 (email)", l["conflitos"])

    def test_perdido_e_faturado_e_conflito(self):
        g = {"nomes": {"Beta"}, "toques": [toque("Beta", "2026-07-15", "pedido"), toque("Beta", "2026-09-01", "perdido", "registo"),
                                          toque("Beta", "2026-09-02", "fatura", "saft", valor=1500.0)]}
        self.assertIn("perdido a 2026-09-01 e faturado a 2026-09-02", r.percurso(g)["conflitos"])

    def test_cliente_com_dois_trabalhos_da_dois_pedidos(self):
        g = {"nomes": {"Gama"}, "toques": [toque("Gama", "2026-07-01", "pedido"), toque("Gama", "2026-07-20", "fatura", "saft", valor=100.0),
                                          toque("Gama", "2026-08-10", "pedido"), toque("Gama", "2026-08-12", "visita", "agenda.csv")]}
        self.assertEqual(len(r.dividir(g, 60)), 2)

    def test_pedido_parado_mais_de_60_dias_separa(self):
        g = {"nomes": {"Delta"}, "toques": [toque("Delta", "2026-07-01", "pedido"), toque("Delta", "2026-09-20", "visita", "agenda.csv")]}
        self.assertEqual(len(r.dividir(g, 60)), 2)

    def test_pagamento_tardio_vai_para_a_fatura_em_aberto(self):
        g = {"nomes": {"Eta"}, "toques": [toque("Eta", "2026-07-01", "pedido"), toque("Eta", "2026-07-10", "fatura", "saft", valor=50.0),
                                         toque("Eta", "2026-10-30", "pagamento", "saft")]}
        p = r.dividir(g, 60)
        self.assertEqual(len(p), 1); self.assertEqual(r.percurso(p[0])["pagamento"], "2026-10-30")

class Fontes(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()

    def test_fornecedores_e_mdm_nao_sao_pedidos(self):
        mb = mailbox.mbox(os.path.join(self.d, "gmail.mbox"))
        for de in ("Cliente Um <um@exemplo.pt>", "Vendas <vendas@fornecedor.pt>", "MDM <geral@mdmassist.pt>"):
            m = mailbox.mboxMessage(); m["From"] = de; m["Subject"] = "Olá"; m["Date"] = "Mon, 13 Jul 2026 10:00:00 +0100"; m.set_payload("x"); mb.add(m)
        mb.flush()
        gravar(os.path.join(self.d, "remetentes-excluir.txt"), "fornecedor.pt\n")
        toques, meta = [], {}
        r.ler_emails(self.d, "2026-07-01", "2026-09-30", toques, meta, r.ler_excluir(self.d))
        self.assertEqual([t["cliente"] for t in toques], ["Cliente Um"])
        self.assertEqual(meta["emails_excluidos"], 2)

    def test_whatsapp_do_iphone_usa_a_pasta(self):
        for nome in ("Ana Silva", "Rui Costa"):
            os.makedirs(os.path.join(self.d, "whatsapp", nome))
            gravar(os.path.join(self.d, "whatsapp", nome, "_chat.txt"), f"[12/07/2026, 09:15:22] {nome}: Bom dia\n")
        toques = []
        r.ler_whatsapp(self.d, "2026-07-01", "2026-09-30", toques, ["MDM"])
        self.assertEqual(sorted(t["cliente"] for t in toques), ["Ana Silva", "Rui Costa"])

    def test_whatsapp_sem_pasta_usa_quem_escreve(self):
        os.makedirs(os.path.join(self.d, "whatsapp"))
        gravar(os.path.join(self.d, "whatsapp", "_chat.txt"), "[12/07/2026, 09:15:22] MDM: Bom dia\n[12/07/2026, 09:16:00] Ana Silva: Olá\n")
        toques = []
        r.ler_whatsapp(self.d, "2026-07-01", "2026-09-30", toques, ["MDM"])
        self.assertEqual(toques[0]["cliente"], "Ana Silva")

    def test_orcamento_sem_data_nao_usa_a_data_do_ficheiro(self):
        try: import openpyxl
        except ImportError: self.skipTest("openpyxl em falta")
        os.makedirs(os.path.join(self.d, "orc"))
        wb = openpyxl.Workbook(); wb.active["B20"] = "Valor Total: 1 200,00 € + IVA"; wb.save(os.path.join(self.d, "orc", "ORC0090_2026 - Cliente.xlsx"))
        wb = openpyxl.Workbook(); ws = wb.active; ws["A1"] = "Validade"; ws["B1"] = dt.datetime(2026, 12, 31); ws["A2"] = "Data"; ws["B2"] = dt.datetime(2026, 8, 5)
        wb.save(os.path.join(self.d, "orc", "ORC0091_2026 - Outro.xlsx"))
        toques, sem = [], []
        r.ler_orc(self.d, "2026-07-01", "2026-09-30", toques, sem)
        self.assertEqual([s["num"] for s in sem], ["ORC0090_2026"])
        self.assertEqual([(t["detalhe"], t["data"]) for t in toques], [("ORC0091_2026", "2026-08-05")])

    def test_saft_notas_de_credito_anuladas_e_recibos(self):
        os.makedirs(os.path.join(self.d, "saft"))
        ns = "urn:OECD:StandardAuditFile-Tax:PT_1.04_01"
        inv = lambda no, t, d, v, st="N": (f"<Invoice><InvoiceNo>{no}</InvoiceNo><DocumentStatus><InvoiceStatus>{st}</InvoiceStatus></DocumentStatus><InvoiceDate>{d}</InvoiceDate>"
                                         f"<InvoiceType>{t}</InvoiceType><CustomerID>C1</CustomerID><DocumentTotals><NetTotal>{v}</NetTotal>"
                                         f"<Payment><PaymentMechanism>NU</PaymentMechanism></Payment></DocumentTotals></Invoice>")
        pay = lambda no, d, st="N": f"<Payment><PaymentRefNo>{no}</PaymentRefNo><TransactionDate>{d}</TransactionDate><DocumentStatus><PaymentStatus>{st}</PaymentStatus></DocumentStatus><CustomerID>C1</CustomerID></Payment>"
        xml = (f'<AuditFile xmlns="{ns}"><MasterFiles><Customer><CustomerID>C1</CustomerID><CompanyName>Cliente</CompanyName></Customer></MasterFiles><SourceDocuments><SalesInvoices>'
               + inv("FT 1", "FT", "2026-09-01", "100.00") + inv("FT 2", "FT", "2026-09-02", "50.00", "A") + inv("NC 1", "NC", "2026-09-03", "20.00")
               + "</SalesInvoices><Payments>" + pay("RC 1", "2026-10-15") + pay("RC 2", "2026-10-16", "A") + "</Payments></SourceDocuments></AuditFile>")
        gravar(os.path.join(self.d, "saft", "x.xml"), xml)
        toques = []
        docs = r.ler_saft(self.d, "2026-07-01", "2026-09-30", "2027-01-31", toques)
        self.assertEqual(sorted(d["no"] for d in docs), ["FT 1", "NC 1"])                       # a anulada não conta
        self.assertEqual([t["detalhe"] for t in toques if t["etapa"] == "pagamento"], ["RC 1"])  # sem o recibo anulado nem os <Payment> das faturas
        saida = os.path.join(self.d, "saida")
        r.escrever(saida, [], docs, [], {}, "2026-07-01", "2026-09-30", [])
        rc = ler(os.path.join(saida, "reconciliacao.md"))
        self.assertIn("| 2026-09 | 1 | 100,00 € | 1 | 20,00 € | 80,00 € |", rc)

class Imap(unittest.TestCase):
    """exportar-imap.py contra um servidor IMAP de mentira: não há rede nos testes."""
    def setUp(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("exportar_imap", os.path.join(os.path.dirname(os.path.abspath(__file__)), "exportar-imap.py"))
        self.ex = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.ex)
        self.d = tempfile.mkdtemp()

    def test_datas_imap_em_ingles(self):
        self.assertEqual(self.ex.data_imap("2026-07-01"), "01-Jul-2026")
        self.assertEqual(self.ex.data_imap("2026-10-01"), "01-Oct-2026")

    def test_exporta_so_para_leitura_e_o_reconstruir_le(self):
        msg = lambda de: f"From: {de}\r\nTo: mdmassist@mdmassist.com\r\nSubject: Pedido\r\nDate: Mon, 13 Jul 2026 10:00:00 +0100\r\n\r\nOla\r\n".encode()
        chamadas = []
        class Falso:
            def select(s, pasta, readonly=False): chamadas.append(("select", pasta, readonly)); return "OK", [b"2"]
            def search(s, charset, *crit): chamadas.append(("search",) + crit); return "OK", [b"1 2"]
            def fetch(s, ids, partes): chamadas.append(("fetch", ids, partes)); return "OK", [(b"1 (BODY[] {10}", msg("Cliente Um <um@exemplo.pt>")), b")", (b"2 (BODY[] {10}", msg("MDM <mdmassist@mdmassist.com>")), b")"]
            def close(s): chamadas.append(("close",))
            def store(s, *a): raise AssertionError("não pode marcar nada")
            def expunge(s): raise AssertionError("não pode apagar nada")
        destino = os.path.join(self.d, "imap-comercial.mbox")
        self.assertEqual(self.ex.exportar(Falso(), ["INBOX"], "2026-07-01", "2026-09-30", destino), {"INBOX": 2})
        self.assertIn(("select", "INBOX", True), chamadas)                                   # só leitura
        self.assertIn(("search", "SINCE", "01-Jul-2026", "BEFORE", "01-Oct-2026"), chamadas)  # 30 de setembro incluído
        self.assertIn(("fetch", "1,2", "(BODY.PEEK[])"), chamadas)                           # não marca como lido
        toques, meta = [], {}
        r.ler_emails(self.d, "2026-07-01", "2026-09-30", toques, meta, set())
        self.assertEqual([t["cliente"] for t in toques], ["Cliente Um"])                     # o próprio endereço não é pedido

class Demo(unittest.TestCase):
    def test_demo_corre_sem_travessoes_nem_euros_ingleses(self):
        d = tempfile.mkdtemp(); antes = os.getcwd()
        try:
            os.chdir(d)
            from contextlib import redirect_stdout
            import io
            with redirect_stdout(io.StringIO()): r.main(["--demo"])
            texto = "".join(ler(os.path.join("saida-demo", f)) for f in ("funil.md", "reconciliacao.md", "chamadas.md"))
        finally:
            os.chdir(antes)
        self.assertNotIn("—", texto)
        self.assertNotRegex(texto, r"\d,\d{3}\.\d{2} €")
        self.assertIn("(1 excluídos", texto)                      # o fornecedor da demo ficou de fora
        self.assertIn("| 2026-09 | 2 | 1 820,00 € | 1 | 120,00 € | 1 700,00 € |", texto)  # NC desconta, anulada não conta

if __name__ == "__main__":
    unittest.main(verbosity=2)
