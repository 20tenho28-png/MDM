"""Características de um pedido lidas no texto do primeiro contacto (antes da resposta da MDM)."""

from __future__ import annotations

import re

from .texto import contem, preparado

TIPOS = ("avaria", "obra", "manutencao", "instalacao")
NOMES_TIPO = {"avaria": "Avaria", "obra": "Obra", "manutencao": "Manutenção", "instalacao": "Instalação",
              "desconhecido": "Tipo desconhecido"}

_PALAVRAS_NUMERO = {"um": 1, "uma": 1, "dois": 2, "duas": 2, "tres": 3, "quatro": 4, "cinco": 5, "seis": 6,
                    "sete": 7, "oito": 8, "nove": 9, "dez": 10, "onze": 11, "doze": 12}
_RE_UNIDADES = re.compile(
    r"\b(\d{1,3}|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)\s+(?:[a-z]+\s+){0,2}?"
    r"(maquinas?|splits?|aparelhos?|unidades?|equipamentos?|interiores|murais|divisoes|quartos|salas|"
    r"ares? condicionados?|fracoes|escritorios)\b")


def extrair(texto: str, dominio: str, canal: str, cfg: dict) -> dict:
    p = cfg["palavras"]
    t = preparado(texto)
    tipo = next((nome for nome in TIPOS if contem(t, p[nome])), "desconhecido")
    pessoais = {d.lower() for d in cfg["email"]["dominios_pessoais"]}
    empresa = bool(dominio and dominio.lower() not in pessoais) or contem(t, p["empresa"])
    data_marcada = contem(t, p["prazo"]) or bool(re.search(r"\bate (?:ao |o )?dia \d", t))
    unidades = 0
    for m in _RE_UNIDADES.finditer(t):
        n = m.group(1)
        v = int(n) if n.isdigit() else _PALAVRAS_NUMERO.get(n, 0)
        if 0 < v <= 200:
            unidades = max(unidades, v)
    return {
        "tipo": tipo,
        "empresa": empresa,
        "urgente": contem(t, p["urgente"]),
        "data_marcada": data_marcada,
        "unidades": unidades,
        "canal": canal,
        "com_texto": bool(texto.strip()),
    }


def classificar_decisao(texto: str, cfg: dict) -> tuple[str, str] | None:
    """('aceite', ''), ('recusa', motivo), ('ambiguo', motivo) ou None, a partir de uma mensagem do cliente."""
    from .texto import contem_sem_negacao
    p = cfg["palavras"]
    t = preparado(re.sub(r"[^\w\s]", " ", texto or ""))
    concorrencia = contem(t, p["recusa_concorrencia"])
    sem_concorrencia = t
    for frase in p["recusa_concorrencia"]:
        if frase:
            sem_concorrencia = sem_concorrencia.replace(frase, " ")
    # «Já adjudicámos a outra empresa» não é uma aceitação por ter «adjudic».
    aceite = contem_sem_negacao(sem_concorrencia, p["aceite"])
    if concorrencia:
        return ("ambiguo", "foi com outra empresa") if aceite else ("recusa", "foi com outra empresa")
    preco = contem(t, p["recusa_preco"])
    prazo = contem(t, p["recusa_prazo"])
    desiste = contem(t, p["recusa_desistencia"])
    if aceite and (preco or prazo or desiste):
        return ("ambiguo", "preço" if preco else "prazo" if prazo else "desistiu ou adiou")
    if aceite:
        return ("aceite", "")
    # O motivo concreto (preço, prazo) vale mais do que um «não aceito» genérico.
    if preco:
        return ("recusa", "preço")
    if prazo:
        return ("recusa", "prazo")
    if desiste:
        return ("recusa", "desistiu ou adiou")
    return None
