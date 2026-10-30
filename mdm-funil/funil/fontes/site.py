"""Leitura dos pedidos do formulário do site (exportação da tabela do Supabase em CSV ou JSON)."""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from ..datas import ler_data
from ..modelo import Evento
from ..texto import chave_nome, email_norm, telefone_norm
from .tabelas import coluna, ler_tabela


def ler_site(caminho: Path, cfg: dict, estat: Counter) -> list[Evento]:
    c = cfg["site"]
    eventos = []
    for i, linha in enumerate(ler_tabela(caminho)):
        estat["linhas"] += 1
        ts = ler_data(coluna(linha, c["coluna_data"]))
        if ts is None:
            estat["sem data"] += 1
            continue
        nome = str(coluna(linha, c["coluna_nome"]))
        chaves = set()
        em = email_norm(coluna(linha, c["coluna_email"]))
        if em:
            chaves.add(f"email:{em}")
        tel = telefone_norm(coluna(linha, c["coluna_telefone"]))
        if tel:
            chaves.add(f"tel:{tel}")
        k = chave_nome(nome)
        if k:
            chaves.add(f"nome:{k}")
        if not chaves:
            estat["sem contacto"] += 1
            continue
        partes = [coluna(linha, c["coluna_tipo"]), coluna(linha, c["coluna_mensagem"]), coluna(linha, c["coluna_localidade"])]
        ident = coluna(linha, c.get("coluna_id", "id")) or i
        eventos.append(Evento(ts, "site", "entrada", "formulario", f"site:{ident}:{ts.isoformat()}", nome=nome,
                              chaves=chaves, texto="\n".join(str(p) for p in partes if p),
                              extra={"dominio": em.split("@")[-1] if em else ""}))
        estat["pedidos"] += 1
    return eventos
