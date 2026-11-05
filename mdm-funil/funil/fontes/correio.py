"""Leitura de caixas de correio .mbox (Google Takeout, Thunderbird)."""

from __future__ import annotations

import html as _html
import mailbox
import re
from collections import Counter
from email.header import decode_header, make_header
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path

from ..datas import local
from ..modelo import Evento
from ..texto import (chave_nome, extrair_emails, extrair_telefones, nomes_parecidos, norm, refs_orc, sem_citacao,
                     telefone_norm)

_RE_MID = re.compile(r"<[^<>\s]+>")
_AUTOMATICO = re.compile(r"(no-?reply|nao-?responder|naoresponder|mailer-daemon|postmaster|notifica|newsletter|"
                         r"news@|marketing@|bounce|donotreply|do-not-reply)", re.I)


def _dec(valor) -> str:
    if valor is None:
        return ""
    try:
        return str(make_header(decode_header(str(valor))))
    except Exception:
        return str(valor)


def _enderecos(*valores) -> list[tuple[str, str]]:
    saida = []
    for nome, endereco in getaddresses([_dec(v) for v in valores if v]):
        endereco = (endereco or "").strip().lower()
        if "@" in endereco:
            saida.append((nome.strip().strip('"').strip(), endereco))
    return saida


def _html_para_texto(h: str) -> str:
    h = re.sub(r"(?is)<(script|style).*?</\1>", " ", h)
    h = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</tr>|</li>|</h\d>", "\n", h)
    h = re.sub(r"<[^>]+>", " ", h)
    return _html.unescape(h)


def _corpo_e_anexos(msg) -> tuple[str, list[str]]:
    planos, htmls, anexos = [], [], []
    partes = msg.walk() if msg.is_multipart() else [msg]
    for parte in partes:
        if parte.is_multipart():
            continue
        nome = parte.get_filename()
        disposicao = (parte.get("Content-Disposition") or "").lower()
        if nome or "attachment" in disposicao:
            if nome:
                anexos.append(_dec(nome))
            continue
        tipo = parte.get_content_type()
        if tipo not in ("text/plain", "text/html"):
            continue
        dados = parte.get_payload(decode=True) or b""
        try:
            texto = dados.decode(parte.get_content_charset() or "utf-8", errors="replace")
        except LookupError:
            texto = dados.decode("latin-1", errors="replace")
        (planos if tipo == "text/plain" else htmls).append(texto)
    corpo = "\n".join(planos) if planos else _html_para_texto("\n".join(htmls))
    return corpo, anexos


def _automatico(msg, remetente: str) -> bool:
    if msg.get("List-Unsubscribe") or msg.get("List-Id"):
        return True
    if norm(msg.get("Precedence", "")) in ("bulk", "list", "junk"):
        return True
    if norm(msg.get("Auto-Submitted", "no")) not in ("no", ""):
        return True
    return bool(_AUTOMATICO.search(remetente))


def _destinatario(e: Evento, nome: str, endereco: str) -> None:
    e.nome = nome
    e.chaves = {f"email:{endereco}"}
    k = chave_nome(nome)
    if k:
        e.chaves.add(f"nome:{k}")


def resolver_destinatarios(eventos: list[Evento], outros: list[Evento], estat: Counter) -> list[Evento]:
    """Emails da MDM para várias pessoas (cliente + arquiteto, por exemplo) e respostas de terceiros num fio.

    O email conta para um cliente escolhido por critérios sucessivos (cada um só desempata os anteriores): quem
    escreveu à MDM ou aparece num documento; quem tem o nome do cliente do orçamento em anexo; quem também recebeu
    emails da MDM sozinho. Os outros destinatários que tinham escrito recebem uma cópia (a resposta também foi para
    eles), sem a ligação pelo orçamento em anexo, para não juntar clientes diferentes.
    """
    def emails(evs) -> set[str]:
        return {k[6:] for e in evs for k in e.chaves if k.startswith("email:")}

    todos = list(eventos) + list(outros)
    conhecidos = emails(e for e in todos if e.direcao == "entrada" or e.fonte in ("orc", "fatura", "site"))
    sozinhos = emails(e for e in eventos if e.direcao == "saida" and "destinatarios" not in e.extra)
    nomes_orc = {e.numero: [k[5:] for k in e.chaves if k.startswith("nome:")] for e in outros if e.fonte == "orc"}

    def nome_do_orcamento(nome: str, nomes: list[str]) -> bool:
        k = chave_nome(nome)
        return bool(k) and any(nomes_parecidos(k, x) for x in nomes)

    saida = []
    for e in eventos:
        varios = e.extra.pop("destinatarios", None)
        if varios is None:
            saida.append(e)
            continue
        nomes = [x for r in sorted(e.extra.get("refs_ligacao", ())) for x in nomes_orc.get(r, [])]
        candidatos, escolhido = list(varios), None
        for criterio in (lambda n, a: a in conhecidos, lambda n, a: nome_do_orcamento(n, nomes),
                         lambda n, a: a in sozinhos):
            filtrados = [(n, a) for n, a in candidatos if criterio(n, a)]
            if len(filtrados) == 1:
                escolhido = filtrados[0]
                break
            if filtrados:
                candidatos = filtrados
        if escolhido:
            _destinatario(e, *escolhido)
            estat["enviados pela MDM"] += 1
            saida.append(e)
        escritores = [(n, a) for n, a in varios if a in conhecidos and (n, a) != escolhido]
        for n, a in escritores:
            copia = Evento(e.ts, e.fonte, e.direcao, e.tipo, f"{e.uid}#{a}", texto=e.texto, refs_orc=set(e.refs_orc),
                           extra={**e.extra, "refs_ligacao": set(), "copia": True})
            _destinatario(copia, n, a)
            saida.append(copia)
        if not escolhido:
            estat["enviados a várias pessoas: contam para quem tinha escrito" if escritores
                  else "enviados a várias pessoas sem cliente claro (não usados)"] += 1
    return _respostas_no_fio(saida, estat)


def _cliente_unico(e: Evento) -> str | None:
    enderecos = [k[6:] for k in e.chaves if k.startswith("email:")]
    return enderecos[0] if len(enderecos) == 1 and not e.extra.get("copia") else None


def _respostas_no_fio(eventos: list[Evento], estat: Counter) -> list[Evento]:
    """Quem responde num fio de um cliente (o arquiteto em cópia que responde a todos) fala do pedido desse cliente.

    A mensagem passa para o cliente do fio, sem juntar o endereço de quem a escreveu a esse cliente (o mesmo
    arquiteto trabalha com outros clientes). O fio vem do In-Reply-To/References ou do fio do Gmail.
    """
    por_mid = {e.extra["mid"]: e for e in eventos if e.fonte == "email" and e.extra.get("mid") and not e.extra.get("copia")}
    por_fio: dict[str, list[Evento]] = {}
    for e in sorted(eventos, key=lambda e: e.ts):
        if e.fonte == "email" and e.extra.get("fio") and not e.extra.get("copia"):
            por_fio.setdefault(e.extra["fio"], []).append(e)

    def dono_do_fio(fio: str, antes) -> tuple[Evento | None, set[str]]:
        anteriores = [x for x in por_fio.get(fio, []) if x.ts < antes]
        participantes = set().union(*(x.extra.get("participantes", set()) for x in anteriores)) if anteriores else set()
        primeira = next((x for x in anteriores if x.direcao == "entrada"), None) or \
            next((x for x in anteriores if _cliente_unico(x)), None)
        return primeira, participantes

    for e in sorted(eventos, key=lambda e: e.ts):
        if e.fonte != "email" or e.direcao != "entrada":
            continue
        remetente = e.extra.get("remetente")
        alvo = None
        for ref in e.extra.get("em_resposta", ()):
            original = por_mid.get(ref)
            if original is not None and remetente in original.extra.get("participantes", set()):
                alvo = original
                break
        if alvo is None and e.extra.get("fio"):
            primeira, participantes = dono_do_fio(e.extra["fio"], e.ts)
            if primeira is not None and remetente in participantes:
                alvo = primeira
        cliente = _cliente_unico(alvo) if alvo is not None else None
        if cliente and remetente and cliente != remetente:
            e.extra["participante"] = remetente
            e.chaves = {f"email:{cliente}"}
            e.nome = alvo.nome or e.nome
            estat["respostas de terceiros num fio de um cliente"] += 1
    return eventos


def ler_mbox(caminho: Path, cfg: dict, estat: Counter) -> list[Evento]:
    proprios = {e.lower() for e in cfg["empresa"]["emails"]}
    tel_proprios = {t for t in (telefone_norm(x) for x in cfg["empresa"]["telefones"]) if t}
    dominios_ignorar = {d.lower().lstrip("@") for d in cfg["email"]["dominios_ignorar"]}
    remetentes_ignorar = {r.lower() for r in cfg["email"]["remetentes_ignorar"]}
    formulario_de = {r.lower() for r in cfg["email"]["remetentes_formulario"]}

    def ignorado(endereco: str) -> bool:
        return endereco in remetentes_ignorar or endereco.split("@")[-1] in dominios_ignorar

    eventos: list[Evento] = []
    caixa = mailbox.mbox(str(caminho), create=False)
    try:
        for chave, msg in caixa.iteritems():
            estat["lidos"] += 1
            etiquetas = norm(_dec(msg.get("X-Gmail-Labels", "")))
            if any(x in etiquetas for x in ("spam", "lixo", "trash", "reciclagem")):
                estat["spam ou lixo"] += 1
                continue
            if any(x in etiquetas for x in ("rascunho", "draft")):
                estat["rascunhos"] += 1
                continue
            try:
                ts = local(parsedate_to_datetime(msg["Date"]))
            except (TypeError, ValueError, IndexError):
                estat["sem data"] += 1
                continue
            remetentes = _enderecos(msg.get("From"))
            if not remetentes:
                estat["sem remetente"] += 1
                continue
            de_nome, de_endereco = remetentes[0]
            assunto = _dec(msg.get("Subject", ""))
            mid = (msg.get("Message-ID") or "").strip() or f"{caminho.name}#{chave}"
            fio = (msg.get("X-GM-THRID") or "").strip()
            # A que mensagens responde (a mais recente primeiro) e quem participa (De, Para, Cc).
            respondidas = list(dict.fromkeys(_RE_MID.findall(str(msg.get("In-Reply-To") or "")) +
                                             _RE_MID.findall(str(msg.get("References") or ""))[::-1]))
            participantes = {a for _, a in _enderecos(msg.get("From"), msg.get("To"), msg.get("Cc"))}
            fio_extra = {"mid": mid, "em_resposta": respondidas, "participantes": participantes}
            corpo, anexos = _corpo_e_anexos(msg)
            limpo = sem_citacao(corpo)
            refs = refs_orc(assunto) | refs_orc(" ".join(anexos)) | refs_orc(limpo)

            if de_endereco in proprios:
                destinatarios = list({a: (n, a) for n, a in reversed(_enderecos(msg.get("To")))
                                      if a not in proprios and not ignorado(a)}.values())[::-1]
                if not destinatarios:
                    estat["enviados sem cliente (fornecedores, a própria MDM)"] += 1
                    continue
                automatica = norm(msg.get("Auto-Submitted", "no")) not in ("no", "")
                e = Evento(ts, "email", "saida", "mensagem", f"email:{mid}", texto=limpo, refs_orc=refs,
                           extra={"assunto": assunto, "anexos": anexos, "fio": fio, "automatica": automatica,
                                  # Só o orçamento em anexo liga o destinatário ao cliente do ORC.
                                  "refs_ligacao": refs_orc(" ".join(anexos)), **fio_extra})
                if len(destinatarios) > 1:
                    # Cliente + arquiteto, por exemplo: o cliente decide-se depois, por quem escreveu à MDM.
                    e.extra["destinatarios"] = destinatarios
                else:
                    _destinatario(e, *destinatarios[0])
                    estat["enviados pela MDM"] += 1
                eventos.append(e)
                continue

            formulario = de_endereco in formulario_de
            if not formulario:
                if ignorado(de_endereco):
                    estat["ignorados (fornecedores e outros)"] += 1
                    continue
                if _automatico(msg, de_endereco):
                    estat["automáticos (newsletters, avisos)"] += 1
                    continue
            responder_a = [(n, a) for n, a in _enderecos(msg.get("Reply-To")) if a not in proprios]
            cliente_nome, cliente_email = responder_a[0] if responder_a else (de_nome, de_endereco)
            if formulario and not responder_a:
                outros = sorted(e for e in extrair_emails(limpo) if e not in proprios)
                cliente_nome, cliente_email = "", (outros[0] if outros else "")
            chaves = set()
            if cliente_email:
                chaves.add(f"email:{cliente_email}")
            k = chave_nome(cliente_nome)
            if k:
                chaves.add(f"nome:{k}")
            chaves |= {f"tel:{t}" for t in extrair_telefones(limpo) if t not in tel_proprios}
            if not chaves:
                estat["sem contacto do cliente"] += 1
                continue
            dominio = cliente_email.split("@")[-1] if cliente_email else ""
            eventos.append(Evento(ts, "site" if formulario else "email", "entrada",
                                  "formulario" if formulario else "mensagem", f"email:{mid}", nome=cliente_nome,
                                  chaves=chaves, texto=f"{assunto}\n{limpo}".strip(), refs_orc=refs,
                                  extra={"assunto": assunto, "dominio": dominio, "fio": fio,
                                         "remetente": cliente_email, **fio_extra}))
            estat["recebidos de clientes"] += 1
    finally:
        caixa.close()
    return eventos


def remetentes(caminhos, cfg: dict) -> list[dict]:
    """Conta remetentes por domínio, para decidir o que ignorar."""
    proprios = {e.lower() for e in cfg["empresa"]["emails"]}
    contagem: dict[str, dict] = {}
    for caminho in caminhos:
        caixa = mailbox.mbox(str(caminho), create=False)
        try:
            for _, msg in caixa.iteritems():
                etiquetas = norm(_dec(msg.get("X-Gmail-Labels", "")))
                if any(x in etiquetas for x in ("spam", "lixo", "trash")):
                    continue
                r = _enderecos(msg.get("From"))
                if not r or r[0][1] in proprios:
                    continue
                endereco = r[0][1]
                dominio = endereco.split("@")[-1]
                c = contagem.setdefault(dominio, {"dominio": dominio, "mensagens": 0, "automaticas": 0,
                                                  "remetentes": set(), "assuntos": []})
                c["mensagens"] += 1
                c["automaticas"] += _automatico(msg, endereco)
                c["remetentes"].add(endereco)
                if len(c["assuntos"]) < 3:
                    c["assuntos"].append(_dec(msg.get("Subject", ""))[:70])
        finally:
            caixa.close()
    linhas = sorted(contagem.values(), key=lambda c: -c["mensagens"])
    for c in linhas:
        c["remetentes"] = len(c["remetentes"])
        c["assuntos"] = " | ".join(c["assuntos"])
    return linhas
