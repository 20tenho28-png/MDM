"""Leitura de conversas exportadas do WhatsApp (Android e iPhone, .txt ou .zip)."""

from __future__ import annotations

import re
import zipfile
from collections import Counter
from datetime import datetime
from pathlib import Path

from ..datas import LX
from ..modelo import Evento
from ..texto import chave_nome, norm, refs_orc, telefone_norm

_INVISIVEIS = {ord(c): None for c in "‎‏‪‫‬‭‮﻿"}
_DATA = (r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?"
         r"(?:\s*([apAP])\.?\s?[mM]\.?)?")
_RE_IPHONE = re.compile(r"^\[" + _DATA + r"\]\s*(.*)$")
_RE_ANDROID = re.compile(r"^" + _DATA + r"\s+[-–]\s+(.*)$")
_RE_NOME_FICHEIRO = re.compile(r"^(?:conversa do whatsapp com|conversa de whatsapp com|whatsapp chat with|"
                               r"whatsapp chat com|whatsapp chat -|chat de whatsapp con)\s*(.+)$", re.I)
_RE_TELEFONE_SO = re.compile(r"^[\d\s+().\-]{9,22}$")
_CHAMADA_PERDIDA = ("chamada de voz perdida", "chamada de video perdida", "missed voice call", "missed video call")
# Mensagens do próprio WhatsApp (no iPhone aparecem com o nome do contacto como autor).
_SISTEMA = ("as mensagens e as chamadas sao encriptadas", "as mensagens e chamadas sao encriptadas",
            "messages and calls are end-to-end encrypted", "o seu codigo de seguranca", "your security code with",
            "codigo de seguranca com", "mudou o numero de telefone", "changed their phone number",
            "changed to a new number", "esta empresa usa", "this business uses", "conta comercial",
            "business account", "as mensagens temporarias", "disappearing messages", "bloqueou este contacto",
            "you blocked this contact", "desbloqueou este contacto", "you unblocked this contact",
            "criou o grupo", "created group", "e um contacto", "is a contact")


def nome_da_conversa(caminho: Path) -> str:
    base = caminho.stem.strip()
    if base.lower() in ("_chat", "chat"):
        base = caminho.parent.name
    m = _RE_NOME_FICHEIRO.match(base)
    return (m.group(1) if m else base).strip()


def _instante(grupos, ordem: str) -> datetime:
    a, b, ano, hora, minuto, segundo, ampm = grupos
    dia, mes = (int(a), int(b)) if ordem == "dmy" else (int(b), int(a))
    ano = int(ano)
    if ano < 100:
        ano += 2000
    hora = int(hora)
    if ampm:
        hora = hora % 12 + (12 if ampm.lower() == "p" else 0)
    return datetime(ano, mes, dia, hora, int(minuto), int(segundo or 0), tzinfo=LX)


def mensagens(texto: str, ordem: str = "dmy") -> list[list]:
    """Lista de [instante, autor ou None, texto]. Linhas sem data continuam a mensagem anterior."""
    saida: list[list] = []
    for linha in texto.splitlines():
        l = linha.translate(_INVISIVEIS).replace(" ", " ").replace(" ", " ")
        m = _RE_IPHONE.match(l) or _RE_ANDROID.match(l)
        if m:
            grupos = m.groups()
            try:
                instante = _instante(grupos[:7], ordem)
            except ValueError:
                m = None
            else:
                resto = grupos[7]
                i = resto.find(": ")
                autor, corpo = (resto[:i].strip(), resto[i + 2:]) if 0 < i <= 80 else (None, resto)
                if autor is not None and any(s in norm(corpo) for s in _SISTEMA):
                    autor = None
                saida.append([instante, autor, corpo])
                continue
        if saida:
            saida[-1][2] += "\n" + l
    return saida


def _telefone_se_numero(s: str) -> str | None:
    return telefone_norm(s) if _RE_TELEFONE_SO.match(s or "") else None


def _e_mdm(autor: str, nomes_mdm: list[set[str]]) -> bool:
    tokens = set(norm(autor).split())
    return any(n and n <= tokens for n in nomes_mdm)


def _numeros(*listas) -> set[str]:
    return {t for lista in listas for t in (telefone_norm(x) for x in lista) if t}


def _ignorada(nome_chat: str, tel_chat: str | None, cfg: dict) -> bool:
    """Conversas com a própria MDM, técnicos, fornecedores ou família (config: [whatsapp] conversas_ignorar)."""
    lista = [str(x) for x in cfg["whatsapp"].get("conversas_ignorar", [])]
    numeros = _numeros(lista, cfg["empresa"]["telefones"], cfg["chamadas"].get("ignorar", []))
    nomes = {norm(x) for x in lista if norm(x)}
    return (tel_chat is not None and tel_chat in numeros) or norm(nome_chat) in nomes


def ler_conversa(texto: str, nome_chat: str, origem: str, cfg: dict, estat: Counter | None = None) -> list[Evento]:
    nomes_mdm = [set(norm(n).split()) for n in cfg["empresa"]["nomes_whatsapp"] if norm(n)]
    ordem = cfg["whatsapp"].get("ordem_data", "dmy")
    tel_chat = _telefone_se_numero(nome_chat)
    if _ignorada(nome_chat, tel_chat, cfg):
        if estat is not None:
            estat["conversas ignoradas (config.toml)"] += 1
        return []
    lista_ignorar = [str(x) for x in cfg["whatsapp"].get("conversas_ignorar", [])]
    tel_mdm = _numeros(cfg["empresa"]["telefones"])
    tel_ignorar = _numeros(lista_ignorar, cfg["chamadas"].get("ignorar", []))
    nomes_ignorar = {norm(x) for x in lista_ignorar if norm(x)}
    nome_k = chave_nome(nome_chat)
    chave_chat = f"tel:{tel_chat}" if tel_chat else (f"nome:{nome_k}" if nome_k else None)

    def e_o_cliente(autor: str) -> bool:
        return norm(autor) == norm(nome_chat) or (tel_chat is not None and _telefone_se_numero(autor) == tel_chat)

    def ignorado(autor: str) -> bool:
        tel = _telefone_se_numero(autor)
        return not e_o_cliente(autor) and ((tel is not None and tel in tel_ignorar) or norm(autor) in nomes_ignorar)

    # Num grupo, as mensagens de pessoas a ignorar (fornecedores, família) não contam.
    msgs = [m for m in mensagens(texto, ordem) if m[1] is not None and not ignorado(m[1])]
    autores = {a for _, a, _ in msgs}
    # O contacto da conversa nunca é a MDM (um cliente chamado "Bernardo Silva" não é confundido com "Bernardo").
    # Os números de [empresa] telefones (a MDM e os técnicos) escrevem pela MDM.
    mdm = {a for a in autores if (_e_mdm(a, nomes_mdm) or _telefone_se_numero(a) in tel_mdm) and not e_o_cliente(a)}
    if not mdm:
        # Conversa a dois: quem não é o contacto da conversa é a MDM (ex.: exportado como "Bernardo Gouveia").
        outros = {a for a in autores if not e_o_cliente(a)}
        if len(autores) == 2 and len(outros) == 1:
            mdm = outros
            if estat is not None:
                estat["MDM reconhecida pelo autor (" + next(iter(outros)) + ")"] += 1
        elif outros and estat is not None:
            estat["conversas sem a MDM identificada"] += 1
    # Grupo (de obra, por exemplo): escreve alguém que não é a MDM nem o contacto que dá nome à conversa. O nome
    # é o do grupo, por isso as linhas com esse autor são do sistema (no iPhone), e as pessoas lá dentro não
    # identificam o cliente: um arquiteto ou um técnico está em vários grupos e juntaria clientes diferentes.
    grupo = any(a not in mdm and not e_o_cliente(a) for a in autores)
    if grupo:
        msgs = [m for m in msgs if not e_o_cliente(m[1])]
        if estat is not None:
            estat["grupos"] += 1
    eventos = []
    for i, (instante, autor, corpo) in enumerate(msgs):
        saida = autor in mdm
        n = norm(corpo)
        tipo = "chamada_perdida" if any(p in n for p in _CHAMADA_PERDIDA) else "mensagem"
        chaves = {f"wa:{norm(origem)}"}
        if chave_chat:
            chaves.add(chave_chat)
        eventos.append(Evento(instante, "whatsapp", "saida" if saida else "entrada", tipo, f"wa:{origem}:{i}",
                              nome="" if tel_chat else nome_chat, chaves=chaves, texto=corpo,
                              refs_orc=refs_orc(corpo),
                              extra={"conversa": origem, "chave_chat": chave_chat, "grupo": grupo,
                                     "autor": autor}))
    return eventos


def _decodificar(dados: bytes) -> str:
    if dados.startswith((b"\xff\xfe", b"\xfe\xff")):
        return dados.decode("utf-16", errors="replace")
    return dados.decode("utf-8-sig", errors="replace")


def ler_ficheiro(caminho: Path, cfg: dict, estat: Counter) -> list[Evento]:
    if caminho.suffix.lower() == ".zip":
        with zipfile.ZipFile(caminho) as z:
            nomes = [n for n in z.namelist() if n.lower().endswith(".txt")]
            if not nomes:
                estat["zip sem conversa"] += 1
                return []
            texto = _decodificar(z.read(nomes[0]))
    else:
        texto = _decodificar(caminho.read_bytes())
    # A origem inclui a pasta: no iPhone todas as conversas descompactadas se chamam _chat.txt.
    origem = f"{caminho.parent.name}/{caminho.name}"
    eventos = ler_conversa(texto, nome_da_conversa(caminho), origem, cfg, estat)
    estat["conversas"] += 1
    estat["mensagens"] += len(eventos)
    return eventos


def marcar_automaticas(eventos: list[Evento], cfg: dict) -> int:
    """Marca como automáticas as mensagens da MDM que são saudações ou ausências do WhatsApp Business."""
    w = cfg["whatsapp"]
    configuradas = [norm(t) for t in w.get("mensagens_automaticas", []) if norm(t)]
    por_texto = Counter()
    for e in eventos:
        if e.direcao == "saida" and len(norm(e.texto)) >= 20:
            por_texto[(norm(e.texto), e.extra.get("conversa"))] += 1
    conversas_por_texto = Counter(t for t, _ in por_texto)
    ultima_entrada: dict[str, datetime] = {}
    marcadas = 0
    for e in sorted(eventos, key=lambda e: e.ts):
        conversa = e.extra.get("conversa")
        if e.direcao == "entrada":
            ultima_entrada[conversa] = e.ts
            continue
        t = norm(e.texto)
        repetida = (conversas_por_texto[t] >= w.get("repeticoes_automaticas", 3) and conversa in ultima_entrada
                    and (e.ts - ultima_entrada[conversa]).total_seconds() <= w.get("segundos_automaticas", 90))
        if repetida or any(t.startswith(c) for c in configuradas):
            e.extra["automatica"] = True
            marcadas += 1
    return marcadas
