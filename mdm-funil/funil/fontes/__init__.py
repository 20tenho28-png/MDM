"""Leitura de todas as fontes da pasta dados/."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, time, timedelta
from pathlib import Path

from ..datas import LX
from ..modelo import Evento
from . import agenda, chamadas, correio, faturas, orcamentos, site, whatsapp

PASTAS = {
    "email": "email",
    "whatsapp": "whatsapp",
    "chamadas": "chamadas",
    "orc": "orc",
    "faturas": "faturas",
    "site": "site",
    "agenda": "agenda",
}

DESCRICAO = {
    "email": "Emails (.mbox)",
    "whatsapp": "Conversas de WhatsApp",
    "chamadas": "Registo de chamadas",
    "orc": "Ficheiros de orçamento (ORC)",
    "faturas": "Faturas emitidas",
    "site": "Formulário do site",
    "agenda": "Agenda do ERP (visitas e relatórios)",
}

FALTA = {
    "email": "Sem emails: os pedidos por email não entram na análise.",
    "whatsapp": "Sem conversas de WhatsApp: os pedidos por WhatsApp não entram na análise.",
    "chamadas": "Sem registo de chamadas: os pedidos por telefone só aparecem quando há orçamento ou fatura, "
                "e as chamadas perdidas não são contadas.",
    "orc": "Sem ficheiros ORC: não é possível medir o tempo até ao orçamento nem o seu valor.",
    "faturas": "Sem faturas: os ganhos só são reconhecidos pelas mensagens de aceitação, por isso ficam subestimados.",
    "site": "Sem exportação do formulário do site (ignora se os pedidos do site chegam por email).",
    "agenda": "Sem agenda do ERP: as visitas ficam dentro de «orçamento por fazer» e de «em execução».",
}


def _ficheiros(pasta: Path, padroes: tuple[str, ...]) -> list[Path]:
    if not pasta.exists():
        return []
    encontrados = set()
    for padrao in padroes:
        encontrados.update(p for p in pasta.rglob(padrao) if p.is_file() and not p.name.startswith(("~$", ".")))
    return sorted(encontrados)


def _datar_orcamentos(orcs: list[Evento], outros: list[Evento], estat: Counter) -> list[Evento]:
    """Sem data escrita no ORC, usa a primeira mensagem que menciona o número; sem nenhuma data fiável, exclui-o."""
    primeira: dict[str, object] = {}
    for e in outros:
        for r in e.refs_orc:
            if r not in primeira or e.ts < primeira[r]:
                primeira[r] = e.ts
    saida = []
    for e in orcs:
        fonte = e.extra.get("fonte_data")
        if fonte != "celula" and e.numero in primeira:
            e.ts = datetime.combine(primeira[e.numero].date(), time(18), tzinfo=LX)
            estat["data tirada da primeira mensagem com o número"] += 1
        elif fonte == "propriedades":
            estat["data tirada das propriedades do ficheiro"] += 1
        elif fonte == "nenhuma":
            estat["excluídos sem data válida (corrige a data no ficheiro)"] += 1
            continue
        saida.append(e)
    return saida


def _juntar_orcamentos(eventos: list[Evento]) -> list[Evento]:
    """Vários ficheiros com o mesmo número (revisões): data do primeiro, valor do mais recente."""
    por_numero: dict[str, list[Evento]] = defaultdict(list)
    for e in eventos:
        por_numero[e.numero].append(e)
    saida = []
    for numero_orc, lista in por_numero.items():
        if len(lista) == 1:
            saida.append(lista[0])
            continue
        lista.sort(key=lambda e: e.ts)
        base = lista[0]
        com_valor = [e for e in lista if e.valor]
        base.valor = com_valor[-1].valor if com_valor else None
        for e in lista[1:]:
            base.chaves |= e.chaves
            base.texto += "\n" + e.texto
        base.extra["revisoes"] = len(lista)
        saida.append(base)
    return saida


def _sem_duplicados(eventos: list[Evento]) -> list[Evento]:
    vistos, unicos = set(), []
    for e in sorted(eventos, key=lambda e: (e.ts, e.uid)):
        if e.uid in vistos:
            continue
        vistos.add(e.uid)
        unicos.append(e)
    # O mesmo pedido do site pode chegar pela tabela do Supabase e pelo email de notificação.
    finais, recentes = [], []
    for e in unicos:
        if e.fonte == "site":
            recentes = [r for r in recentes if e.ts - r.ts <= timedelta(minutes=15)]
            identidade = {k for k in e.chaves if not k.startswith("nome:")}
            if any(identidade & {k for k in r.chaves if not k.startswith("nome:")} for r in recentes):
                continue
            recentes.append(e)
        finais.append(e)
    return finais


def ler_tudo(pasta_dados: Path, cfg: dict) -> tuple[list[Evento], dict]:
    pasta_dados = Path(pasta_dados)
    cobertura: dict[str, dict] = {}
    todos: list[Evento] = []
    ilegiveis: list[str] = []

    def seguro(leitor, caminho: Path, est: Counter):
        """Um ficheiro estragado ou num formato desconhecido fica de fora, com aviso, sem parar a análise."""
        try:
            return leitor(caminho, cfg, est)
        except Exception as erro:  # noqa: BLE001
            est["ficheiros ilegíveis"] += 1
            ilegiveis.append(f"{caminho.name} ({type(erro).__name__})")
            return None

    def registar(fonte: str, ficheiros: list[Path], eventos: list[Evento], estat: Counter):
        datas = [e.ts for e in eventos]
        cobertura[fonte] = {
            "descricao": DESCRICAO[fonte],
            "ficheiros": len(ficheiros),
            "eventos": len(eventos),
            "inicio": min(datas) if datas else None,
            "fim": max(datas) if datas else None,
            "detalhe": dict(estat),
        }
        todos.extend(eventos)

    # Os emails registam-se no fim: os enviados a várias pessoas precisam dos contactos das outras fontes.
    est_email, evs_email = Counter(), []
    fich_email = _ficheiros(pasta_dados / PASTAS["email"], ("*.mbox",))
    for f in fich_email:
        evs_email += seguro(correio.ler_mbox, f, est_email) or []
    formulario_email = [e for e in evs_email if e.fonte == "site"]

    est, evs = Counter(), []
    fich = _ficheiros(pasta_dados / PASTAS["whatsapp"], ("*.txt", "*.zip"))
    for f in fich:
        evs += seguro(whatsapp.ler_ficheiro, f, est) or []
    automaticas = whatsapp.marcar_automaticas(evs, cfg)
    if automaticas:
        est["mensagens automáticas da MDM (não contam como resposta)"] += automaticas
    registar("whatsapp", fich, evs, est)

    est, evs = Counter(), []
    fich = _ficheiros(pasta_dados / PASTAS["chamadas"], ("*.xml", "*.csv", "*.xlsx"))
    for f in fich:
        evs += seguro(chamadas.ler_xml if f.suffix.lower() == ".xml" else chamadas.ler_csv, f, est) or []
    registar("chamadas", fich, evs, est)

    est_orc, orcs = Counter(), []
    fich_orc = _ficheiros(pasta_dados / PASTAS["orc"], ("*.xlsx", "*.xlsm", "*.xls"))
    for f in fich_orc:
        e = seguro(orcamentos.ler_orcamento, f, est_orc)
        if e:
            orcs.append(e)

    est, evs = Counter(), []
    fich = _ficheiros(pasta_dados / PASTAS["faturas"], ("*.csv", "*.xlsx", "*.json", "*.txt"))
    for f in fich:
        evs += seguro(faturas.ler_faturas, f, est) or []
    registar("faturas", fich, evs, est)

    est, evs = Counter(), []
    fich = _ficheiros(pasta_dados / PASTAS["site"], ("*.csv", "*.json", "*.xlsx"))
    for f in fich:
        evs += seguro(site.ler_site, f, est) or []
    if formulario_email:
        est["notificações por email"] += len(formulario_email)
    registar("site", fich, evs + formulario_email, est)

    est, evs = Counter(), []
    fich = _ficheiros(pasta_dados / PASTAS["agenda"], ("*.csv", "*.xlsx"))
    for f in fich:
        evs += seguro(agenda.ler_agenda, f, est) or []
    registar("agenda", fich, evs, est)

    evs_email = correio.resolver_destinatarios(evs_email, todos + orcs, est_email)
    registar("email", fich_email, [e for e in evs_email if e.fonte == "email"], est_email)
    orcs = _juntar_orcamentos(_datar_orcamentos(orcs, todos, est_orc))
    registar("orc", fich_orc, orcs, est_orc)
    cobertura = {f: cobertura[f] for f in PASTAS if f in cobertura}

    # A agenda é opcional (só existe com o ERP): sem ela, quem avisa é o modo sombra.
    avisos = [FALTA[f] for f, c in cobertura.items()
              if c["eventos"] == 0 and not (f == "site" and c["ficheiros"]) and f != "agenda"]
    if ilegiveis:
        avisos.append(f"{len(ilegiveis)} ficheiros não foram lidos (estragados ou num formato desconhecido): "
                      + ", ".join(ilegiveis[:10]) + (" e outros." if len(ilegiveis) > 10 else "."))
    sem_mdm = cobertura["whatsapp"]["detalhe"].get("conversas sem a MDM identificada")
    if sem_mdm:
        avisos.append(f"{sem_mdm} conversas de WhatsApp com mais de uma pessoa sem a MDM identificada: confirma os nomes "
                      "em [empresa] nomes_whatsapp, senão as respostas da MDM contam como mensagens do cliente.")
    sem_data = est_orc.get("excluídos sem data válida (corrige a data no ficheiro)")
    if sem_data:
        avisos.append(f"{sem_data} ficheiros ORC ficaram de fora por não terem uma data do ano do número.")
    ch = [e for e in todos if e.fonte == "chamada"]
    if ch and not any(e.direcao == "entrada" for e in ch):
        avisos.append("Só há chamadas efetuadas (por exemplo, da fatura detalhada). As chamadas recebidas e perdidas "
                      "não entram nos pedidos; exporta o registo do telemóvel para as incluir.")
    inicios = {f: c["inicio"] for f, c in cobertura.items() if c["inicio"] and f in ("email", "whatsapp", "chamadas", "site")}
    if len(inicios) > 1:
        primeiro = min(inicios.values())
        for f, ini in inicios.items():
            if (ini - primeiro).days > 60:
                avisos.append(f"{DESCRICAO[f]} só começa a {ini:%d/%m/%Y}; antes disso, os pedidos por este canal "
                              "não aparecem e o peso dos outros canais fica exagerado.")
    return _sem_duplicados(todos), {"fontes": cobertura, "avisos": avisos}
