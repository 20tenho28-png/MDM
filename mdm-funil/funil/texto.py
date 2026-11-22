"""Normalização de texto, telefones, emails, nomes e referências de orçamento."""

from __future__ import annotations

import re
import unicodedata


def sem_acentos(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def norm(s) -> str:
    """Minúsculas, sem acentos, espaços simples."""
    return re.sub(r"\s+", " ", sem_acentos(str(s or "")).lower()).strip()


def preparado(s) -> str:
    """Texto normalizado com espaço no início e no fim, para procurar palavras-chave."""
    return " " + norm(s) + " "


def contem(texto_preparado: str, palavras) -> bool:
    return any(p and p in texto_preparado for p in palavras)


_NEGACAO = ("nao ", "nunca ", "sem ")
_SEM_NEGACAO = re.compile(r"sem (?:qualquer )?(?:problemas?|duvidas?|stress)")


def contem_sem_negacao(texto_preparado: str, palavras) -> bool:
    """Como contem(), mas ignora ocorrências precedidas de 'não', 'nunca' ou 'sem'."""
    for p in palavras:
        if not p:
            continue
        i = texto_preparado.find(p)
        while i >= 0:
            # «Sem problema, podem avançar» e «sem dúvida» não negam o que vem a seguir.
            antes = _SEM_NEGACAO.sub(" ", texto_preparado[max(0, i - 14):i])
            if not any(n in antes for n in _NEGACAO):
                return True
            i = texto_preparado.find(p, i + 1)
    return False


# ---------------------------------------------------------------- telefones

def telefone_norm(s) -> str | None:
    """Telefone em formato +351XXXXXXXXX (ou +código internacional). None se não parecer um telefone."""
    if s is None:
        return None
    bruto = str(s).strip()
    digitos = re.sub(r"\D", "", bruto)
    internacional = bruto.startswith("+") or digitos.startswith("00")
    if digitos.startswith("00"):
        digitos = digitos[2:]
    if len(digitos) == 12 and digitos.startswith("351"):
        digitos = digitos[3:]
        internacional = False
    if len(digitos) == 9 and (digitos[0] == "2" or digitos[:2] in ("91", "92", "93", "96", "30")):
        return "+351" + digitos
    if internacional and 10 <= len(digitos) <= 15 and not digitos.startswith("351"):
        return "+" + digitos
    return None


# 9 algarismos (começados por 2, 91/92/93/96 ou 30), com espaços, pontos ou hífenes em qualquer agrupamento.
_RE_TELEFONE = re.compile(
    r"(?<![\d+])(?:(?:\+|00)\s?351[\s.\-]?)?(?:2\d|9[1236]|30)(?:[\s.\-]?\d){7}(?!\d)")


def extrair_telefones(texto) -> set[str]:
    encontrados = set()
    for m in _RE_TELEFONE.finditer(str(texto or "")):
        t = telefone_norm(m.group(0))
        if t:
            encontrados.add(t)
    return encontrados


# ---------------------------------------------------------------- emails

_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+")


def email_norm(s) -> str | None:
    if not s:
        return None
    m = _RE_EMAIL.search(str(s))
    return m.group(0).lower().strip(".") if m else None


def extrair_emails(texto) -> set[str]:
    return {m.group(0).lower().strip(".") for m in _RE_EMAIL.finditer(str(texto or ""))}


# ---------------------------------------------------------------- nomes

_TITULOS = {"sr", "sra", "dr", "dra", "eng", "engo", "enga", "engenheiro", "engenheira", "arq", "arqo", "dona",
            "exmo", "exma", "exmos", "prof", "senhor", "senhora", "lda", "limitada", "unipessoal", "sa", "s a"}
_GENERICOS = {"consumidor final", "cliente final", "cliente diverso", "clientes diversos", "diversos",
              "vendas a dinheiro", "venda a dinheiro", "cliente generico", "sem nome", "desconhecido"}


def chave_nome(nome) -> str | None:
    """Chave de comparação de nomes (minúsculas, sem acentos nem títulos). None se o nome for curto ou genérico."""
    t = re.sub(r"[^a-z0-9 ]", " ", norm(nome))
    tokens = [x for x in t.split() if x not in _TITULOS and len(x) > 1]
    if len(tokens) < 2:
        return None
    chave = " ".join(tokens)
    if chave in _GENERICOS:
        return None
    return chave


# Palavras que não distinguem clientes: o que sobra é quase sempre um apelido ou o nome próprio da empresa.
_PALAVRAS_GERAIS = {"condominio", "predio", "edificio", "rua", "avenida", "travessa", "largo", "praca", "lote",
                    "loja", "restaurante", "cafe", "pastelaria", "clinica", "hotel", "escritorio", "armazem",
                    "empresa", "construcoes", "construtora", "imobiliaria", "sociedade", "comercio", "servicos",
                    "moradia", "casa", "apartamento", "das", "dos"}


def palavras_do_nome(chave: str) -> list[str]:
    return [t for t in chave.split() if len(t) >= 3 and t not in _PALAVRAS_GERAIS and not t.isdigit()]


def nomes_parecidos(a: str, b: str) -> bool | None:
    """Se duas chaves de nome são provavelmente do mesmo cliente. None quando não há palavras para comparar.

    «Ana Silva» e «Ana Maria Silva»: sim. «Ana Silva» e «João Silva»: não (um apelido comum não chega).
    «José Manuel Ferreira» e «José Manuel Costa»: não (dois nomes próprios iguais, apelidos diferentes).
    """
    pa, pb = palavras_do_nome(a), palavras_do_nome(b)
    if not pa or not pb:
        return None
    sa, sb = set(pa), set(pb)
    return sa <= sb or sb <= sa or (len(sa & sb) >= 2 and pa[-1] == pb[-1])


def chave_curta(chave: str) -> str | None:
    """Primeiro e último nome de uma chave de nome."""
    partes = chave.split()
    if len(partes) < 2:
        return None
    return f"{partes[0]} {partes[-1]}"


# ---------------------------------------------------------------- orçamentos

_RE_ORC = re.compile(r"\bORC\s?[_\-/.]?\s?0*(\d{1,5})\s?[_\-/. ]?\s?(20\d{2})(?!\d)", re.I)


def refs_orc(texto) -> set[str]:
    """Números de orçamento mencionados num texto, no formato ORC0034_2026."""
    return {f"ORC{int(n):04d}_{ano}" for n, ano in _RE_ORC.findall(str(texto or ""))}


# ---------------------------------------------------------------- citações em emails

_CORTES = ("-----original message", "----- original message", "-------- mensagem original",
           "---------- forwarded message", "---------- mensagem encaminhada", "enviado do meu ",
           "sent from my ", "obter o outlook", "get outlook for")
_CABECALHO_SEGUINTE = ("enviad", "sent:", "data:", "date:", "para:", "to:")


def sem_citacao(texto) -> str:
    """Remove a parte citada de uma resposta de email (linhas com '>', 'Em ... escreveu:', cabeçalhos do Outlook)."""
    linhas = str(texto or "").splitlines()
    saida: list[str] = []
    for i, linha in enumerate(linhas):
        n = norm(linha)
        if n.startswith(">"):
            continue
        if "escreveu:" in n or n.endswith("wrote:") or " wrote:" in n:
            if saida and norm(saida[-1]).startswith(("em ", "on ", "a ", "no dia ")):
                saida.pop()
            break
        if n.startswith(_CORTES) or re.match(r"^-{2,}\s*(original message|mensagem original|forwarded message|mensagem encaminhada)", n):
            break
        if n.startswith(("de:", "from:")) and any(norm(x).startswith(_CABECALHO_SEGUINTE) for x in linhas[i + 1:i + 4]):
            break
        saida.append(linha)
    return "\n".join(saida).strip()


# ---------------------------------------------------------------- números

def numero(valor) -> float | None:
    """Lê números escritos à portuguesa ('2.345,67 €') ou à inglesa ('2345.67')."""
    if valor is None or isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    t = str(valor).replace("€", "").replace("EUR", "").replace(" ", "").replace(" ", "").strip()
    if not t:
        return None
    negativo = t.startswith("-") or (t.startswith("(") and t.endswith(")"))
    t = t.strip("-()+")
    if "," in t and "." in t:
        if t.rfind(",") > t.rfind("."):
            t = t.replace(".", "").replace(",", ".")
        else:
            t = t.replace(",", "")
    elif "," in t:
        t = t.replace(",", ".") if t.count(",") == 1 else t.replace(",", "")
    elif t.count(".") > 1 or ("." in t and len(t.split(".")[1]) == 3):
        t = t.replace(".", "")
    try:
        v = float(t)
    except ValueError:
        return None
    return -v if negativo else v


def duracao_segundos(valor) -> int:
    if valor in (None, ""):
        return 0
    t = str(valor).strip()
    try:
        if ":" in t:
            total = 0
            for parte in t.split(":"):
                total = total * 60 + int(float(parte))
            return total
        return int(float(t.replace(",", ".")))
    except ValueError:
        return 0
