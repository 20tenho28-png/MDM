#!/usr/bin/env python3
"""Gera o site estático da MDM a partir de src/ e data/ para public/.

Só biblioteca padrão. Uso:
    python3 website/build.py            # gera public/
    python3 website/build.py --check    # gera e valida ligações, recursos e placeholders

Sintaxe dos modelos (src/):
    <!--meta {...json...} -->            no topo de cada página: title, description, file, nav, jsonld, css
    {{ caminho.ponto }}                   valor de site.*, page.*, obra.*, root (prefixo relativo à raiz)
    {{> nome }}                           inclui src/partials/nome.html com o mesmo contexto
    {{foto NN sizes="..." class="..." loading="eager" alt="..."}}   <picture> webp + jpg da obra NN
    {{wa chave}}                          ligação de WhatsApp com a mensagem pré-preenchida site.wa.chave
    {{li obra.detalhes}}                  um <li> por texto de uma lista
    {{each parcial NN,NN,...}} / {{each parcial all}} / {{each parcial cat=vent}} / {{each parcial ctx:related}}   repete um parcial por obra
"""
import html
import json
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
import os
SRC, DATA, ASSETS = ROOT / "src", ROOT / "data", ROOT / "assets"
# MDM_OUT permite gerar para outra pasta (por exemplo, várias verificações em paralelo)
OUT = Path(os.environ["MDM_OUT"]).resolve() if os.environ.get("MDM_OUT") else ROOT / "public"

SITE = json.loads((DATA / "site.json").read_text(encoding="utf-8"))
OBRAS_DATA = json.loads((DATA / "obras.json").read_text(encoding="utf-8"))
OBRAS = OBRAS_DATA["obras"]
OBRA_BY_N = {o["n"]: o for o in OBRAS}

META_RE = re.compile(r"\A\s*<!--meta\s+(\{.*?\})\s*-->\s*", re.S)
# etiqueta mais interior primeiro: {{foto {{ obra.n }} ...}} resolve {{ obra.n }} e depois {{foto 25 ...}}
TAG_RE = re.compile(r"\{\{\s*((?:(?!\{\{).)+?)\s*\}\}", re.S)
ATTR_RE = re.compile(r'(\w[\w-]*)="([^"]*)"')


def lookup(ctx, path):
    cur = ctx
    for part in path.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        elif isinstance(cur, list) and part.isdigit() and int(part) < len(cur):
            cur = cur[int(part)]
        else:
            raise KeyError(path)
    return cur


def foto(ctx, args):
    parts = args.split(None, 1)
    n = parts[0].zfill(2)
    attrs = dict(ATTR_RE.findall(parts[1])) if len(parts) > 1 else {}
    o = OBRA_BY_N[n]
    root = ctx["root"]
    base = f"{root}assets/img/obras/foto-{n}"
    w, h = (1600, 1200) if o["orient"] == "landscape" else (1200, 1600)
    alt = attrs.get("alt", o["alt"])
    sizes = attrs.get("sizes", "100vw")
    loading = attrs.get("loading", "lazy")
    cls = ("foto " + attrs.get("class", "")).strip()
    extra = ' fetchpriority="high"' if loading == "eager" else ""
    return (
        f'<picture class="{cls}">'
        + f'<source type="image/webp" srcset="{base}-800.webp {w // 2}w, {base}-1600.webp {w}w" sizes="{sizes}">'
        + f'<img src="{base}-1600.jpg" alt="{html.escape(alt, quote=True)}" width="{w}" height="{h}" '
        + f'loading="{loading}" decoding="async"{extra}></picture>'
    )


def wa(ctx, key):
    return SITE["whatsappBase"] + quote(SITE["wa"][key])


def each(ctx, args):
    name, sel = args.split(None, 1)
    sel = sel.strip()
    eager1 = sel.endswith(" eager1")  # primeira imagem é o LCP (ex.: grelha de obras.html)
    if eager1:
        sel = sel[: -len(" eager1")].strip()
    if sel == "all":
        items = OBRAS
    elif sel.startswith("cat="):
        items = [o for o in OBRAS if o["cat"] == sel[4:]]
    elif sel.startswith("ctx:"):
        items = lookup(ctx, sel[4:])
    elif sel.startswith("registo="):
        items = [o for o in OBRAS if o["registo"] == sel[8:]]
    else:
        items = [OBRA_BY_N[x.strip().zfill(2)] for x in sel.split(",")]
    tpl = (SRC / "partials" / f"{name}.html").read_text(encoding="utf-8")
    out = []
    for i, o in enumerate(items):
        c = dict(ctx, obra=o, index=i, pos=i + 1, total=len(items),
                 loading="eager" if (eager1 and i == 0) else "lazy")
        out.append(render(tpl, c))
    return "".join(out)


def render(text, ctx, depth=0):
    if depth > 12:
        raise RuntimeError("inclusão recursiva demasiado profunda")

    def sub(m):
        expr = m.group(1)
        if expr.startswith(">"):
            name = expr[1:].strip()
            return render((SRC / "partials" / f"{name}.html").read_text(encoding="utf-8"), ctx, depth + 1)
        if expr.startswith("foto "):
            return foto(ctx, expr[5:])
        if expr.startswith("wa "):
            return html.escape(wa(ctx, expr[3:].strip()), quote=True)
        if expr.startswith("each "):
            return each(ctx, expr[5:])
        if expr.startswith("li "):
            return "".join(f"<li>{html.escape(str(x))}</li>" for x in lookup(ctx, expr[3:].strip()))
        raw = expr.startswith("{") or expr.startswith("&")
        key = expr.lstrip("{&").strip()
        try:
            val = lookup(ctx, key)
        except KeyError:
            raise KeyError(f"{{{{ {key} }}}} não existe em {ctx.get('_file', '?')}")
        if isinstance(val, (list, dict)):
            val = json.dumps(val, ensure_ascii=False)
        val = str(val)
        return val if raw else html.escape(val, quote=True)

    for _ in range(4):
        new = TAG_RE.sub(sub, text)
        if new == text:
            break
        text = new
    return text


def business_ld():
    return {
        "@context": "https://schema.org",
        "@type": ["HVACBusiness", "Electrician"],
        "name": SITE["name"],
        "legalName": SITE["legalName"],
        "vatID": SITE["vatID"],
        "url": SITE["baseUrl"],
        "logo": SITE["baseUrl"] + "/assets/img/logo-mdm.svg",
        "image": SITE["baseUrl"] + "/assets/img/og.jpg",
        "telephone": SITE["phoneE164"],
        "email": SITE["email"],
        "foundingDate": SITE["founded"],
        "address": {"@type": "PostalAddress", "streetAddress": "Alameda dos Oceanos 108 A, Edifício Vila do Oriente",
                    "postalCode": "1990-426", "addressLocality": "Lisboa", "addressCountry": "PT"},
        "areaServed": {"@type": "Place", "name": "Grande Lisboa"},
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification",
                                       "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                                       "opens": "08:00", "closes": "17:00"}],
    }


FAQ_RE = re.compile(r'<details class="faq-item"[^>]*>\s*<summary[^>]*>(.*?)</summary>(.*?)</details>', re.S)


def strip_tags(s):
    s = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()
    return re.sub(r"\s+([.,;:!?)])", r"\1", s)


def faq_ld(body):
    qs = [{"@type": "Question", "name": html.unescape(strip_tags(q)),
           "acceptedAnswer": {"@type": "Answer", "text": html.unescape(strip_tags(a))}}
          for q, a in FAQ_RE.findall(body) if not PLACEHOLDER_RE.search(a)]  # respostas por preencher não vão para o Google
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": qs} if qs else None


def breadcrumb_ld(trail):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE["baseUrl"] + "/" + f}
                                for i, (n, f) in enumerate(trail)]}


def page_ctx(meta, file):
    meta = {"preselect": "", "nav": "", "robots": "index,follow", "og": "", **meta}
    depth = file.count("/")
    # a 404 é servida em qualquer profundidade (/obras/xyz.html): precisa de caminhos absolutos
    root = "/" if file == "404.html" else "../" * depth
    return {"site": SITE, "page": meta, "root": root, "_file": file,
            "categorias": OBRAS_DATA["categorias"], "year": "2026"}


def build_page(meta, body_tpl, extra_ctx=None):
    file = meta["file"]
    ctx = page_ctx(meta, file)
    if extra_ctx:
        ctx.update(extra_ctx)
    body = render(body_tpl, ctx)
    lds = []
    for kind in meta.get("jsonld", []):
        if kind == "business":
            lds.append(business_ld())
        elif kind == "faq":
            f = faq_ld(body)
            if f:
                lds.append(f)
        elif kind == "breadcrumb":
            lds.append(breadcrumb_ld(meta["breadcrumb"]))
    ld_html = "".join(
        '<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
        for x in lds)
    css = "".join(f'<link rel="stylesheet" href="{ctx["root"]}assets/css/{c}">\n' for c in meta.get("css", []))
    og = meta.get("og") or ""
    ctx.update({"og_image": SITE["baseUrl"] + "/assets/img/" + ("obras/" + og if og else "og.jpg"),
                "content": body, "jsonld": ld_html, "page_css": css,
                "canonical": SITE["baseUrl"] + "/" + ("" if file == "index.html" else file)})
    layout = (SRC / "templates" / "layout.html").read_text(encoding="utf-8")
    out = render(layout, ctx)
    dest = OUT / file
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    return file


def vcard():
    """Cartão de contacto (mdm.vcf) para guardar no telemóvel: botão da página das carrinhas."""
    esc = lambda t: t.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;")
    rua, resto = SITE["address1"], SITE["address2"]           # "1990-426 Lisboa · Parque das Nações"
    cp, cidade = resto.split(" ", 1)[0], resto.split(" ", 1)[1].split(" · ")[0]
    linhas = [
        "BEGIN:VCARD", "VERSION:3.0",
        f"N:{esc(SITE['name'])};;;;", f"FN:{esc(SITE['name'])}", f"ORG:{esc(SITE['name'])}",
        "X-ABShowAs:COMPANY",
        f"TEL;TYPE=WORK,VOICE:{SITE['phoneE164']}",
        f"TEL;TYPE=CELL:+351{SITE['whatsapp'].replace(' ', '')}",
        f"EMAIL;TYPE=WORK:{SITE['email']}",
        f"URL:{SITE['baseUrl']}/",
        f"ADR;TYPE=WORK:;;{esc(rua)};{esc(cidade)};;{cp};Portugal",
        "NOTE:" + esc(f"Ar condicionado, ventilação, eletricidade e manutenção na grande Lisboa desde {SITE['founded']}. "
                      f"{SITE['hours']}. WhatsApp {SITE['whatsapp']}: envie uma fotografia da avaria."),
        "END:VCARD", ""]
    (OUT / "mdm.vcf").write_bytes("\r\n".join(linhas).encode("utf-8"))


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ASSETS, OUT / "assets")
    vcard()
    files, fora_do_mapa = [], set()
    for p in sorted((SRC / "pages").rglob("*.html")):
        text = p.read_text(encoding="utf-8")
        m = META_RE.match(text)
        if not m:
            raise SystemExit(f"{p}: falta o bloco <!--meta {{...}} -->")
        meta = json.loads(m.group(1))
        files.append(build_page(meta, text[m.end():]))
        if "noindex" in meta.get("robots", ""):
            fora_do_mapa.add(meta["file"])   # 404 e página das carrinhas
    obra_tpl_path = SRC / "templates" / "obra.html"
    if obra_tpl_path.exists():
        tpl = obra_tpl_path.read_text(encoding="utf-8")
        for i, o in enumerate(OBRAS):
            prev_o, next_o = OBRAS[i - 1], OBRAS[(i + 1) % len(OBRAS)]
            file = f"obras/{o['slug']}.html"
            meta = {"file": file, "nav": "obras", "css": ["pag-obras.css"],
                    "title": f"{o['title']}: {o['especialidade'].lower()} · Obras MDM Lisboa",
                    "description": f"{o['title']}. {o['especialidade']}, {o['trabalho'].lower()}: {o['equipamento']}. "
                                   f"Obra da MDM na grande Lisboa, fotografada no local pelos técnicos.",
                    "og": f"foto-{o['n']}-1600.jpg",
                    "jsonld": ["breadcrumb"],
                    "breadcrumb": [["Início", ""], ["Obras", "obras.html"], [o["title"], file]]}
            files.append(build_page(meta, tpl, {"obra": o, "prev": prev_o, "next": next_o,
                                                "related": [x for x in OBRAS if x["cat"] == o["cat"] and x is not o][:3]}))
    urls = "".join(f"<url><loc>{SITE['baseUrl']}/{'' if f == 'index.html' else f}</loc></url>\n"
                   for f in files if f not in fora_do_mapa)
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + urls + "</urlset>\n", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE['baseUrl']}/sitemap.xml\n", encoding="utf-8")
    return files


# começa por pelo menos três maiúsculas; pode continuar com explicação em minúsculas até ao "]"
PLACEHOLDER_RE = re.compile(r"\[[A-ZÀ-Ý][A-ZÀ-Ý0-9 ./,ªº·-]{2,}[^\]<]*\]")
REF_RE = re.compile(r'(?:href|src)="([^"#?]+)|srcset="([^"]+)"|url\(([^)]+)\)')


def check(files):
    problems, placeholders = [], {}
    for f in files:
        path = OUT / f
        text = path.read_text(encoding="utf-8")
        sem_scripts = re.sub(r"<script.*?</script>", "", text, flags=re.S)
        if "{{" in sem_scripts or "}}" in sem_scripts:
            problems.append(f"{f}: sobra sintaxe de modelo {{{{ }}}}")
        for m in PLACEHOLDER_RE.findall(re.sub(r"<script.*?</script>", "", text, flags=re.S)):
            placeholders.setdefault(m, set()).add(f)
        for a, b, c in REF_RE.findall(text):
            refs = [a] if a else ([s.strip().split()[0] for s in b.split(",")] if b else [c.strip("'\"")])
            for r in refs:
                if not r or re.match(r"^(https?:|mailto:|tel:|data:|//)", r):
                    continue
                target = (OUT / r.lstrip("/")) if r.startswith("/") else (path.parent / r).resolve()
                if not target.exists():
                    problems.append(f"{f}: referência partida → {r}")
    for css in (OUT / "assets" / "css").glob("*.css"):
        for c in re.findall(r"url\(([^)]+)\)", css.read_text(encoding="utf-8")):
            c = c.strip("'\"")
            if c.startswith("data:"):
                continue
            if not (css.parent / c).resolve().exists():
                problems.append(f"{css.name}: url partido → {c}")
    print(f"{len(files)} páginas geradas em {OUT}")
    if placeholders:
        print("\nPlaceholders por preencher (dados que só a MDM tem):")
        for k in sorted(placeholders):
            print(f"  {k if len(k) < 90 else k[:87] + '…]'}  ({len(placeholders[k])} páginas)")
    if problems:
        print("\nPROBLEMAS:")
        for p in problems:
            print("  " + p)
        return 1
    print("\nSem ligações ou recursos partidos.")
    return 0


if __name__ == "__main__":
    built = build()
    sys.exit(check(built) if "--check" in sys.argv else 0)
