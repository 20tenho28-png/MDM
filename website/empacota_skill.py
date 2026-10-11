#!/usr/bin/env python3
"""Empacota a skill «ORÇAMENTO MDM» (.claude/skills/mdm-orcamento) num .zip para carregar no claude.ai
(Definições, Capacidades, Skills). O Claude Code, no repositório, usa a pasta diretamente e não precisa disto.

O pacote leva cópias do que o script usa no repositório, para correr sozinho:
  scripts/lib/calculo.mjs e proposta-modelo.mjs  (website/netlify/lib)
  dados/site.json, precos.json, precos-teste.json, regras-marcas.json  (website/data)
  dados/proposta.css, dados/fonts/*.woff2, dados/logo-mdm.svg  (a folha da proposta, como na página da equipa)
Quando a tabela de preços ou os números de «btu» mudarem, volta a empacotar-se e a carregar-se no claude.ai.
tests/orcamento-skill.mjs confirma que as cópias são iguais às do repositório e que o pacote corre fora dele.

Uso, a partir de website/:  python3 empacota_skill.py [caminho/do/mdm-orcamento.zip]
(sem caminho, escreve mdm-orcamento.zip na pasta atual; nunca dentro de public/, que é publicado)."""
import sys
import zipfile
from pathlib import Path

W = Path(__file__).resolve().parent
SKILL = W.parent / ".claude" / "skills" / "mdm-orcamento"
NOME = "mdm-orcamento"


def ficheiros():
    """(caminho dentro do zip, ficheiro no disco), por esta ordem."""
    lista = [("SKILL.md", SKILL / "SKILL.md"), ("scripts/orcamento.mjs", SKILL / "scripts" / "orcamento.mjs")]
    lista += [(f"scripts/lib/{n}", W / "netlify" / "lib" / n) for n in ("calculo.mjs", "proposta-modelo.mjs")]
    lista += [(f"dados/{n}", W / "data" / n) for n in ("site.json", "precos.json", "precos-teste.json", "regras-marcas.json")]
    lista += [("dados/proposta.css", W / "equipa" / "proposta.css"), ("dados/logo-mdm.svg", W / "assets" / "img" / "logo-mdm.svg")]
    css = (W / "equipa" / "proposta.css").read_text(encoding="utf-8")
    for f in sorted((W / "assets" / "fonts").glob("*.woff2")):
        if f.name in css:
            lista.append((f"dados/fonts/{f.name}", f))
    return lista


def main():
    destino = Path(sys.argv[1] if len(sys.argv) > 1 else "mdm-orcamento.zip").resolve()
    publico = (W / "public").resolve()
    if destino == publico or publico in destino.parents:
        raise SystemExit("empacota_skill.py: não escrevo dentro de public/ (é a pasta publicada do site)")
    faltam = [str(f) for _, f in ficheiros() if not f.is_file()]
    if faltam:
        raise SystemExit("empacota_skill.py: faltam ficheiros: " + ", ".join(faltam))
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".zip.tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for nome, f in ficheiros():
            z.write(f, f"{NOME}/{nome}")
    tmp.replace(destino)
    print(f"{destino} ({len(ficheiros())} ficheiros)")


if __name__ == "__main__":
    main()
