#!/usr/bin/env python3
"""Publica o site: o visual novo (site/, HTML estático em PT e EN, sem build) vai para public/, com a página interna
da equipa (equipa/), o registo de pedidos da equipa (registo/) e as letras de que ela precisa. O Netlify corre isto em cada publicação (netlify.toml).

Enquanto data/site.json tiver "preview": true, o site fica fora dos motores de busca: public/_headers com
X-Robots-Tag: noindex em todos os endereços e robots.txt com Disallow: /. Sem "preview", ficam o robots.txt e o
sitemap.xml do site/.

No fim confere o que publicou e sai com 1 se alguma coisa estiver mal:
- /formularios.html declara os dois formulários do Netlify (orcamento e orcamento-comercial), com os campos que
  assets/assistant.js envia;
- nenhuma página com o formulário (#quote-form) fica sem assets/assistant.js, e nada envia para /api/requests (o
  servidor do alojamento antigo, que no Netlify não existe);
- nenhum endereço do alojamento antigo (chatgpt.site);
- as ligações internas (href e src começados por /) apontam para ficheiros que existem.

Uso, a partir de website/:  python3 publica.py   (MDM_OUT=pasta para publicar noutro sítio)
O site antigo (build.py, src/) continua no repositório: a página da equipa e a skill «ORÇAMENTO MDM» usam os dados
(data/), as contas (netlify/lib/) e as letras (assets/fonts/) dele. README.md, «Visual novo».
"""
import json
import os
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
OUT = Path(os.environ.get("MDM_OUT") or ROOT / "public").resolve()
NAO_PUBLICAR = {"LEIA-ME.md", "PLANO-MELHORIAS.md"}
CAMPOS = ["form-name", "subject", "pagina", "triagem", "potencia", "estimativa", "nome", "email", "telefone", "servico",
          "mensagem", "bot-field"]
FORMULARIOS = ["orcamento", "orcamento-comercial"]
FORA = ("/api/", "/gestao", "/en/gestao")   # do servidor antigo; o site trata o 404


def publica():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SITE, OUT, ignore=lambda pasta, nomes: [n for n in nomes if n in NAO_PUBLICAR])
    shutil.copytree(ROOT / "equipa", OUT / "equipa")
    # registo de pedidos da equipa (registo/, uso interno): só a app; o LEIA-ME e o SQL do Supabase ficam no repositório
    shutil.copytree(ROOT / "registo", OUT / "registo", ignore=lambda pasta, nomes: [n for n in nomes if n in NAO_PUBLICAR or n == "supabase"])
    # a página da equipa usa ../assets/fonts e ../assets/img/logo-mdm.svg: junta as letras que o visual novo não tem
    for f in (ROOT / "assets/fonts").glob("*.woff2"):
        destino = OUT / "assets/fonts" / f.name
        if not destino.exists():
            shutil.copy2(f, destino)
    logo = OUT / "assets/img/logo-mdm.svg"
    if not logo.exists():
        shutil.copy2(ROOT / "assets/img/logo-mdm.svg", logo)
    site = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
    if site.get("preview"):
        (OUT / "_headers").write_text("/*\n  X-Robots-Tag: noindex\n", encoding="utf-8")
        (OUT / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    return site


def confere():
    problemas = []
    form = (OUT / "formularios.html").read_text(encoding="utf-8") if (OUT / "formularios.html").exists() else ""
    for nome in FORMULARIOS:
        m = re.search(rf'<form name="{nome}"[^>]*data-netlify="true"[^>]*>(.*?)</form>', form, re.S)
        if not m:
            problemas.append(f"formularios.html: falta o formulário Netlify «{nome}»")
            continue
        nomes = set(re.findall(r'name="([^"]+)"', m.group(1)))
        falta = [c for c in CAMPOS if c not in nomes]
        if falta:
            problemas.append(f"formularios.html, «{nome}»: faltam os campos {', '.join(falta)}")
    js = (OUT / "assets/assistant.js").read_text(encoding="utf-8")
    if "/api/requests" in js:
        problemas.append("assets/assistant.js ainda envia para /api/requests (no Netlify não existe)")
    for c in CAMPOS[1:]:
        if f"'{c}'" not in js and not re.search(rf"[{{,]\s*{re.escape(c)}\s*[:,}}]", js):
            problemas.append(f"assets/assistant.js não envia o campo «{c}»")
    for f in sorted(OUT.rglob("*")):
        if f.suffix not in {".html", ".js", ".css", ".xml", ".txt"} or not f.is_file():
            continue
        texto = f.read_text(encoding="utf-8")
        rel = f.relative_to(OUT).as_posix()
        if "chatgpt.site" in texto:
            problemas.append(f"{rel}: endereço do alojamento antigo (chatgpt.site)")
        if f.suffix != ".html":
            continue
        if 'id="quote-form"' in texto and "/assets/assistant.js" not in texto:
            problemas.append(f"{rel}: tem o formulário mas não carrega /assets/assistant.js")
        for alvo in re.findall(r'(?:href|src)="(/[^"#?]*)', texto):
            if alvo.startswith(FORA) or alvo.startswith("//"):
                continue
            caminho = OUT / alvo.lstrip("/")
            if caminho.is_dir():
                caminho = caminho / "index.html"
            if not caminho.exists():
                problemas.append(f"{rel}: ligação partida {alvo}")
    return problemas


def main():
    site = publica()
    problemas = confere()
    paginas = len(list(OUT.rglob("*.html")))
    print(f"Publicado em {OUT}: {paginas} páginas HTML" + (" (pré-visualização: fora dos motores de busca)" if site.get("preview") else ""))
    for p in problemas:
        print("PROBLEMA:", p)
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
