#!/usr/bin/env python3
"""Exporta para mbox os emails recebidos numa conta IMAP (mdmassist@mdmassist.com), para o reconstruir.py.

O Google Takeout só serve para contas Gmail. Esta conta é IMAP: este script liga-se ao servidor, abre as pastas só para
leitura e copia as mensagens do período para um ficheiro .mbox. Não apaga, não move e não marca nada como lido
(lê com BODY.PEEK). A palavra-passe pede-se no ecrã (ou vem da variável MDM_IMAP_SENHA) e não fica guardada em lado nenhum.

Uso:
  python3 exportar-imap.py --servidor <servidor IMAP> --listar                 # mostra as pastas da conta
  python3 exportar-imap.py --servidor <servidor IMAP> --desde 2026-07-01 --ate 2026-09-30
  python3 exportar-imap.py --servidor <servidor IMAP> --pastas "INBOX,INBOX.Pedidos" --saida entrada/imap-comercial.mbox

O servidor, a porta e o utilizador estão nas definições da conta no Outlook ou no telemóvel (Conta → Servidor de
entrada, IMAP). Só biblioteca padrão.
"""
import argparse, datetime as dt, getpass, imaplib, mailbox, os, re, ssl, sys

MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def data_imap(d):
    """2026-07-01 → 01-Jul-2026 (o IMAP só aceita os meses em inglês, seja qual for a língua do computador)."""
    d = dt.date.fromisoformat(d)
    return f"{d.day:02d}-{MESES[d.month - 1]}-{d.year}"

def ligar(servidor, porta, utilizador, senha):
    imap = imaplib.IMAP4_SSL(servidor, porta, ssl_context=ssl.create_default_context())
    imap.login(utilizador, senha)
    return imap

def listar(imap):
    tipo, linhas = imap.list()
    if tipo != "OK": raise RuntimeError("o servidor não devolveu a lista de pastas")
    nomes = []
    for l in linhas or []:
        s = l.decode("utf-8", "replace") if isinstance(l, bytes) else str(l)
        m = re.search(r'"([^"]*)"\s*$', s) or re.search(r"(\S+)\s*$", s)
        if m: nomes.append(m.group(1))
    return nomes

def exportar(imap, pastas, desde, ate, destino):
    """Copia as mensagens de cada pasta com data de chegada entre desde e ate (inclusive). Devolve {pasta: n}."""
    os.makedirs(os.path.dirname(os.path.abspath(destino)), exist_ok=True)
    mb = mailbox.mbox(destino)
    contas = {}
    antes = (dt.date.fromisoformat(ate) + dt.timedelta(days=1)).isoformat()   # BEFORE exclui o próprio dia
    try:
        mb.lock()
        for pasta in pastas:
            nome = pasta if re.fullmatch(r"[\w.\-/]+", pasta) else '"' + pasta.replace('"', '\\"') + '"'
            tipo, _ = imap.select(nome, readonly=True)
            if tipo != "OK":
                print(f"aviso: não abri a pasta {pasta}", file=sys.stderr); contas[pasta] = 0; continue
            tipo, dados = imap.search(None, "SINCE", data_imap(desde), "BEFORE", data_imap(antes))
            ids = dados[0].split() if tipo == "OK" and dados and dados[0] else []
            n = 0
            for i in range(0, len(ids), 50):
                lote = b",".join(ids[i:i + 50]).decode()
                tipo, partes = imap.fetch(lote, "(BODY.PEEK[])")
                if tipo != "OK": continue
                for p in partes:
                    if isinstance(p, tuple) and len(p) >= 2 and isinstance(p[1], (bytes, bytearray)):
                        mb.add(mailbox.mboxMessage(bytes(p[1]))); n += 1
            contas[pasta] = n
            imap.close()
        mb.flush()
    finally:
        mb.unlock(); mb.close()
    return contas

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--servidor", required=True, help="servidor IMAP de entrada da conta")
    ap.add_argument("--porta", type=int, default=993)
    ap.add_argument("--utilizador", default="mdmassist@mdmassist.com")
    ap.add_argument("--pastas", default="INBOX", help="pastas separadas por vírgula (por omissão só a caixa de entrada)")
    ap.add_argument("--desde", default="2026-07-01"); ap.add_argument("--ate", default="2026-09-30")
    ap.add_argument("--saida", default=os.path.join("entrada", "imap-comercial.mbox"))
    ap.add_argument("--listar", action="store_true", help="só mostra as pastas da conta")
    a = ap.parse_args(argv)
    senha = os.environ.get("MDM_IMAP_SENHA") or getpass.getpass(f"Palavra-passe de {a.utilizador}: ")
    imap = ligar(a.servidor, a.porta, a.utilizador, senha)
    try:
        if a.listar:
            for p in listar(imap): print(p)
            return
        if os.path.exists(a.saida):
            sys.exit(f"{a.saida} já existe: apaga-o ou escolhe outro --saida (assim não se duplicam mensagens).")
        contas = exportar(imap, [p.strip() for p in a.pastas.split(",") if p.strip()], a.desde, a.ate, a.saida)
        for p, n in contas.items(): print(f"{p}: {n} mensagens")
        print(f"Total {sum(contas.values())} → {a.saida}")
    finally:
        try: imap.logout()
        except Exception: pass

if __name__ == "__main__":
    main()
