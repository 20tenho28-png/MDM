"""Leitura da configuração: valores por defeito + config.toml do projeto."""

from __future__ import annotations

import tomllib
from datetime import date
from pathlib import Path

from .texto import norm

_PADRAO = Path(__file__).with_name("padrao.toml")


def _fundir(base: dict, extra: dict) -> dict:
    for chave, valor in extra.items():
        if isinstance(valor, dict) and isinstance(base.get(chave), dict):
            _fundir(base[chave], valor)
        else:
            base[chave] = valor
    return base


def _norm_palavra(p: str) -> str:
    # Mantém um espaço no início ou no fim quando a palavra o tem (ex.: " ac " só bate na palavra inteira).
    inicio = " " if p.startswith(" ") else ""
    fim = " " if p.endswith(" ") else ""
    return inicio + norm(p) + fim


def carregar(caminho: Path | str | None = None) -> dict:
    with open(_PADRAO, "rb") as f:
        cfg = tomllib.load(f)
    if caminho is not None and Path(caminho).exists():
        with open(caminho, "rb") as f:
            _fundir(cfg, tomllib.load(f))
    cfg["palavras"] = {k: [_norm_palavra(p) for p in lista] for k, lista in cfg["palavras"].items()}
    return cfg


def data_referencia(cfg: dict) -> date:
    valor = str(cfg["geral"].get("data_referencia") or "").strip()
    return date.fromisoformat(valor) if valor else date.today()
