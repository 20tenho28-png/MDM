"""Ligação do mesmo cliente entre canais (telefone, email, NIF, número de orçamento e nome)."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from .modelo import Evento
from .texto import chave_curta, chave_nome, nomes_parecidos, norm, refs_orc, telefone_norm

# Chaves que identificam sem ambiguidade (ligam diretamente).
FORTES = ("tel:", "email:", "nif:", "orc:", "wa:")
# Chaves que identificam uma pessoa ou empresa (um grupo com uma delas é "forte").
IDENTIDADE = ("tel:", "email:", "nif:")
# Fontes de mensagens: sem nenhuma chave de contacto, uma mensagem não é de nenhum cliente conhecido.
_MENSAGENS = ("email", "whatsapp", "chamada", "site")


class _Uniao:
    def __init__(self):
        self.pai: dict = {}

    def raiz(self, x):
        self.pai.setdefault(x, x)
        while self.pai[x] != x:
            self.pai[x] = self.pai[self.pai[x]]
            x = self.pai[x]
        return x

    def unir(self, a, b):
        ra, rb = self.raiz(a), self.raiz(b)
        if ra != rb:
            self.pai[rb] = ra
        return ra


@dataclass
class _Grupo:
    forte: bool = False
    nifs: set = field(default_factory=set)
    inicio: datetime | None = None
    fim: datetime | None = None
    nomes: set = field(default_factory=set)
    fontes: set = field(default_factory=set)

    def acrescentar(self, e: Evento):
        self.forte |= any(k.startswith(IDENTIDADE) for k in e.chaves)
        self.nifs |= {k for k in e.chaves if k.startswith("nif:")}
        self.inicio = e.ts if self.inicio is None else min(self.inicio, e.ts)
        self.fim = e.ts if self.fim is None else max(self.fim, e.ts)
        self.nomes |= {k[5:] for k in e.chaves if k.startswith("nome:")}
        self.fontes.add(e.fonte)

    def juntar(self, outro: "_Grupo"):
        self.forte |= outro.forte
        self.nifs |= outro.nifs
        self.inicio = min(t for t in (self.inicio, outro.inicio) if t)
        self.fim = max(t for t in (self.fim, outro.fim) if t)
        self.nomes |= outro.nomes
        self.fontes |= outro.fontes

    def distancia_dias(self, outro: "_Grupo") -> float:
        if self.fim < outro.inicio:
            return (outro.inicio - self.fim).total_seconds() / 86400
        if outro.fim < self.inicio:
            return (self.inicio - outro.fim).total_seconds() / 86400
        return 0.0

    def resumo(self) -> str:
        return f"{', '.join(sorted(self.fontes))} ({self.inicio:%d/%m/%Y} a {self.fim:%d/%m/%Y})"


def refs_ligacao(e: Evento) -> set[str]:
    """Números de orçamento que identificam o cliente deste evento.

    Um email da MDM só liga pelo orçamento em anexo (uma menção ao técnico não diz quem é o cliente); uma mensagem
    que menciona vários orçamentos não liga por nenhum.
    """
    refs = e.extra["refs_ligacao"] if "refs_ligacao" in e.extra else e.refs_orc
    if e.fonte == "orc":
        refs = {e.numero}
    return set(refs) if len(refs) == 1 or e.fonte == "orc" else set()


def _chaves(e: Evento) -> set[str]:
    return set(e.chaves) | {f"orc:{r}" for r in refs_ligacao(e)}


def _clientes_diferentes(a: list[str], b: list[str]) -> bool:
    """Dois ORC são de clientes diferentes se nenhum par de nomes for parecido (e houver nomes para comparar)."""
    resultados = [nomes_parecidos(x, y) for x in a for y in b]
    return bool(resultados) and not any(resultados) and any(r is False for r in resultados)


def contactos_partilhados(eventos: list[Evento], limite: int) -> set[str]:
    """Telefones ou emails que não são de um só cliente (quase sempre da MDM, de um técnico ou de um parceiro).

    São partilhados quando aparecem com muitos nomes diferentes, ou quando se ligam a orçamentos de clientes
    com nomes diferentes.
    """
    nomes = defaultdict(set)
    orcs = defaultdict(set)
    nome_do_orc = {e.numero: [k[5:] for k in e.chaves if k.startswith("nome:")] for e in eventos if e.fonte == "orc"}
    for e in eventos:
        ks = _chaves(e)
        do_evento = {k for k in ks if k.startswith("nome:")}
        # Um ORC liga ao seu próprio número os contactos escritos nele (o arquiteto no campo «Contacto», por exemplo).
        referidos = refs_ligacao(e) if e.fonte != "orc" else {e.numero}
        for k in ks:
            if k.startswith(("tel:", "email:", "wa:")):
                nomes[k] |= do_evento
                orcs[k] |= referidos
    partilhados = {k for k, s in nomes.items() if len(s) >= limite and not k.startswith("wa:")}
    for k, numeros in orcs.items():
        conjuntos = [nome_do_orc[n] for n in sorted(numeros) if nome_do_orc.get(n)]
        # Dois orçamentos com nomes de clientes diferentes: o contacto não é de um só cliente.
        if any(_clientes_diferentes(a, b) for i, a in enumerate(conjuntos) for b in conjuntos[i + 1:]):
            partilhados.add(k)
    return partilhados


def chave_manual(valor) -> str | None:
    """Chave escrita à mão (revisao/ligacoes.csv) na forma interna: '912 000 001' -> 'tel:+351912000001',
    'ORC0010_2026' -> 'orc:ORC0010_2026', 'Ana@x.pt' -> 'email:ana@x.pt'. None se não se perceber."""
    v = str(valor or "").strip()
    if not v:
        return None
    prefixo, separador, resto = v.partition(":")
    prefixo = prefixo.strip().lower()
    if separador and prefixo in ("tel", "email", "nif", "orc", "wa", "nome"):
        resto = resto.strip()
        if prefixo == "tel":
            t = telefone_norm(resto)
            return f"tel:{t}" if t else None
        if prefixo == "nif":
            d = re.sub(r"\D", "", resto)
            return f"nif:{d}" if len(d) == 9 else None
        if prefixo == "orc":
            r = refs_orc(resto)
            return f"orc:{next(iter(r))}" if len(r) == 1 else None
        if prefixo == "email":
            return f"email:{resto.lower()}"
        if prefixo == "nome":
            k = chave_nome(resto)
            return f"nome:{k}" if k else None
        return f"wa:{norm(resto)}"
    if "@" in v:
        return f"email:{v.lower()}"
    r = refs_orc(v)
    if len(r) == 1:
        return f"orc:{next(iter(r))}"
    t = telefone_norm(v)
    return f"tel:{t}" if t else None


def _chave_contacto(valor) -> str | None:
    """'912 345 678', 'ana@x.pt' ou 'tel:+351912345678' para a chave interna."""
    v = str(valor or "").strip()
    if v.startswith(("tel:", "email:", "wa:")):
        return v.lower() if v.startswith("email:") else v
    if "@" in v:
        return f"email:{v.lower()}"
    t = telefone_norm(v)
    return f"tel:{t}" if t else None


def _nunca_partilhados(eventos: list[Evento], lista) -> set[str]:
    """Contactos que o utilizador diz serem de um só cliente: telefones, emails ou nomes de conversas de WhatsApp."""
    from .fontes.whatsapp import nome_da_conversa
    chaves = {k for k in (_chave_contacto(x) for x in lista) if k}
    nomes = {norm(x) for x in lista if _chave_contacto(x) is None and norm(x)}
    # A conversa de um desses contactos também é desse cliente.
    for e in eventos:
        if e.fonte != "whatsapp":
            continue
        nome = norm(nome_da_conversa(Path(e.extra.get("conversa", ""))))
        if e.extra.get("chave_chat") in chaves or nome in nomes:
            chaves |= {k for k in e.chaves if k.startswith("wa:")}
    return chaves


def _conversas_partilhadas(eventos: list[Evento], partilhados: set[str]) -> set[str]:
    """Uma conversa de WhatsApp com um contacto partilhado (técnico, parceiro) é toda com ele, não com um cliente."""
    return {k for e in eventos if e.extra.get("chave_chat") in partilhados for k in e.chaves if k.startswith("wa:")}


def resolver(eventos: list[Evento], cfg: dict, juntar_manual=()) -> tuple[list[dict], set[str], int]:
    """Atribui e.cliente a cada evento (None se a mensagem não é de nenhum cliente).

    Devolve as ligações a rever, os contactos tratados como partilhados e quantas mensagens foram descartadas.
    """
    dias_max = cfg["pedidos"]["dias_fatura"]
    nunca = _nunca_partilhados(eventos, cfg["pedidos"].get("nunca_partilhados", []))
    partilhados = contactos_partilhados(eventos, cfg["pedidos"]["limite_contacto_partilhado"]) - nunca
    partilhados |= _conversas_partilhadas(eventos, partilhados) - nunca
    descartados = 0
    ativos = []
    for e in eventos:
        tinha = any(k.startswith(IDENTIDADE) for k in e.chaves)
        conversa_partilhada = any(k in partilhados for k in e.chaves if k.startswith("wa:"))
        if partilhados:
            e.chaves -= partilhados
        sem_contacto = tinha and not any(k.startswith(IDENTIDADE + ("wa:",)) for k in e.chaves)
        if e.fonte in _MENSAGENS and (conversa_partilhada or sem_contacto):
            # Mensagem para ou de um contacto partilhado (técnico, parceiro, a própria MDM): não é de um cliente.
            e.cliente = None
            descartados += 1
            continue
        ativos.append(e)

    uf = _Uniao()
    for e in ativos:
        no = ("e", e.uid)
        uf.raiz(no)
        for k in _chaves(e):
            if k.startswith(FORTES):
                uf.unir(no, ("k", k))
    for a, b in juntar_manual:
        uf.unir(("k", a), ("k", b))

    grupos: dict = {}
    for e in ativos:
        grupos.setdefault(uf.raiz(("e", e.uid)), _Grupo()).acrescentar(e)

    def unir_grupos(a, b):
        ga, gb = grupos.pop(a), grupos.pop(b)
        r = uf.unir(a, b)
        ga.juntar(gb)
        grupos[r] = ga
        return r

    revisao: list[dict] = []

    def anotar(situacao: str, nome: str, *gs: _Grupo):
        revisao.append({"situacao": situacao, "nome": nome, "detalhe": " | ".join(g.resumo() for g in gs)})

    # 1) Nome completo igual.
    por_nome = defaultdict(set)
    for e in ativos:
        for k in e.chaves:
            if k.startswith("nome:"):
                por_nome[k[5:]].add(("e", e.uid))
    for nome in sorted(por_nome):
        raizes = sorted({uf.raiz(x) for x in por_nome[nome]}, key=repr)
        if len(raizes) < 2:
            continue
        fortes = [r for r in raizes if grupos[r].forte]
        fracos = [r for r in raizes if not grupos[r].forte]
        bloqueado = False
        if len(fortes) > 1:
            alvo = fortes[0]
            for r in fortes[1:]:
                alvo, r = uf.raiz(alvo), uf.raiz(r)
                if alvo == r:
                    continue
                ga, gb = grupos[alvo], grupos[r]
                if ga.nifs and gb.nifs and not (ga.nifs & gb.nifs):
                    anotar("mesmo nome mas NIF diferente: não foram juntados", nome, ga, gb)
                    bloqueado = True
                    continue
                if len(nome.split()) < 3 and ga.distancia_dias(gb) > dias_max:
                    anotar("mesmo nome, contactos diferentes e datas afastadas: não foram juntados", nome, ga, gb)
                    bloqueado = True
                    continue
                anotar("juntados por terem o mesmo nome (confirma)", nome, ga, gb)
                alvo = unir_grupos(alvo, r)
        fortes_agora = {uf.raiz(r) for r in fortes}
        if bloqueado or len(fortes_agora) > 1:
            if fracos:
                anotar("nome usado por vários clientes: documentos sem contacto ficaram por ligar", nome,
                       *(grupos[uf.raiz(r)] for r in fracos))
            continue
        alvo = next(iter(fortes_agora)) if fortes_agora else uf.raiz(fracos[0])
        for r in fracos:
            alvo, r = uf.raiz(alvo), uf.raiz(r)
            if alvo != r:
                alvo = unir_grupos(alvo, r)

    # 2) Primeiro e último nome, só para grupos sem contacto (ex.: ORC ou fatura só com o nome).
    curtas = defaultdict(set)
    for r, g in grupos.items():
        if g.forte:
            for n in g.nomes:
                c = chave_curta(n)
                if c:
                    curtas[c].add(r)
    for r in sorted([r for r, g in grupos.items() if not g.forte], key=repr):
        if r not in grupos:
            continue
        g = grupos[r]
        candidatos = set()
        for n in g.nomes:
            c = chave_curta(n)
            if c:
                candidatos |= {uf.raiz(x) for x in curtas.get(c, ())}
        candidatos = {c for c in candidatos if c != r and c in grupos and grupos[c].distancia_dias(g) <= dias_max}
        if len(candidatos) == 1:
            alvo = candidatos.pop()
            anotar("ligados pelo primeiro e último nome (confirma)", ", ".join(sorted(g.nomes)), grupos[alvo], g)
            unir_grupos(alvo, r)
        elif len(candidatos) > 1:
            anotar("primeiro e último nome iguais em vários clientes: não foi ligado", ", ".join(sorted(g.nomes)), g)

    # 3) Documentos que ficaram sem nenhum contacto do cliente.
    for g in grupos.values():
        if not g.forte and g.fontes <= {"orc", "fatura"}:
            anotar("orçamento ou fatura sem contacto ligado (pedido feito por um canal sem registo?)",
                   ", ".join(sorted(g.nomes)) or "(sem nome)", g)

    primeiro = {}
    for e in ativos:
        r = uf.raiz(("e", e.uid))
        primeiro[r] = min(primeiro.get(r, e.ts), e.ts)
    ordem = sorted(primeiro, key=lambda r: (primeiro[r], repr(r)))
    numero = {r: i + 1 for i, r in enumerate(ordem)}
    for e in ativos:
        e.cliente = numero[uf.raiz(("e", e.uid))]
    return revisao, partilhados, descartados
