#!/usr/bin/env python3
"""Gera o site estático da Melperfaz a partir de src/ e data/ para public/.

Só biblioteca padrão (Python 3.11+). Uso, a partir de melperfaz/:
    python3 build.py             # gera public/
    python3 build.py --check     # gera e valida ligações, recursos, sintaxe, textos e o formulário; sai com 1 se falhar
    python3 build.py --faltam    # lista os dados que só a Melperfaz pode dar (não falha)
    MELPERFAZ_OUT=/tmp/x python3 build.py --check   # gera noutra pasta (só apaga uma pasta que o build.py gerou)

A arquitetura é a do site da MDM (website/build.py), reduzida ao que este site usa.

Sintaxe dos modelos (src/):
    <!--meta {...json...} -->           no topo de cada página: file, title, description, nav, robots, css, jsonld, breadcrumb
    {{ caminho.ponto }}                  valor de site.*, page.*, dados.*, obra.*, root (prefixo relativo à raiz), year, anos
    {{& caminho }}                       o mesmo, sem escapar o HTML
    {{> nome }}                          inclui src/partials/nome.html com o mesmo contexto
    {{foto NN sizes="..." class="..." loading="eager" alt="..." foco="50% 40%"}}   <picture> avif + webp + jpg da fotografia NN
                                         (data/fotos.json; tamanhos feitos por gerar_fotos.py)
    {{wa chave}}                         ligação de WhatsApp com a mensagem site.wa.chave já escrita
    {{li obra.detalhes}}                 um <li> por texto de uma lista
    {{each parcial all}} / {{each parcial 01,02}} / {{each parcial cat=fachadas}} / {{each parcial ctx:related}}
                                         repete um parcial por obra (… eagerN no fim: as N primeiras imagens sem lazy)
    {{#se caminho}}…{{/se}}              só aparece se o valor existir e não estiver vazio
    {{#sem caminho}}…{{/sem}}            só aparece se o valor estiver vazio
    {{#cada caminho}}…{{/cada}}          repete o bloco por cada elemento da lista, com o elemento em {{ item }}

Pré-visualização: "preview": true em data/site.json pede aos motores de busca para não indexar (meta robots noindex em
todas as páginas, X-Robots-Tag em public/_headers, robots.txt Disallow). No lançamento passa a false.

Dados por preencher: data/dados-melperfaz.json. Um valor vazio esconde a frase, a linha ou a ligação que o usa; nunca se
mostra um [PLACEHOLDER] e --check falha se algum chegar a public/.
"""
import hashlib
import html
import json
import os
import re
import shutil
import sys
from datetime import date
from pathlib import Path
from urllib.parse import quote, unquote

try:
    import tomllib   # Python 3.11+: só --check o usa, para ler o netlify.toml
except ModuleNotFoundError:   # pragma: no cover
    tomllib = None

ROOT = Path(__file__).resolve().parent
SRC, DATA, ASSETS = ROOT / "src", ROOT / "data", ROOT / "assets"
OUT = Path(os.environ["MELPERFAZ_OUT"]).resolve() if os.environ.get("MELPERFAZ_OUT") else ROOT / "public"
# ficheiro que build() deixa em cada pasta que gera: ao gerar de novo, só se apaga uma pasta com ele (limpa_saida)
MARCA_SAIDA = ".gerado-por-build"
ANO = date.today().year

SITE = json.loads((DATA / "site.json").read_text(encoding="utf-8"))
# a idade da empresa calcula-se do ano de fundação: «25 anos» em 2026. O Netlify gera o site em cada publicação; se o
# site ficar um ano sem publicar, publicar de novo em janeiro atualiza o número.
SITE["anos"] = ANO - int(SITE["founded"])
FOTOS = {k: v for k, v in json.loads((DATA / "fotos.json").read_text(encoding="utf-8")).items() if not k.startswith("_")}
OBRAS_DATA = json.loads((DATA / "obras.json").read_text(encoding="utf-8"))
OBRAS = OBRAS_DATA["obras"]
CATEGORIAS = OBRAS_DATA["categorias"]
OBRA_BY_N = {o["n"]: o for o in OBRAS}
DADOS_DOC = json.loads((DATA / "dados-melperfaz.json").read_text(encoding="utf-8"))
DADOS = {k: v["valor"] for k, v in DADOS_DOC.items() if not k.startswith("_")}
DADOS_USO = {}   # chave de dados-melperfaz.json → páginas onde entra (para --faltam)
# lado maior de cada tamanho das fotografias: foto-NN-400.avif … e o mesmo em WebP, só os menores do que o original,
# mais o tamanho do próprio original (gerar_fotos.py faz os ficheiros; lados() diz quais)
FOTO_LADOS = (400, 600, 800, 1000, 1200, 1600)
# ecrã de telemóvel de 3x: pede-se a imagem de 2x (à vista é igual e pesa metade); vai antes do sizes de cada fotografia
FOTO_3X = "(max-width: 599px) and (min-resolution: 2.5dppx)"
LQIP = json.loads((DATA / "lqip.json").read_text(encoding="utf-8")) if (DATA / "lqip.json").exists() else {}
# os tipos de obra do formulário (site.json «tiposDeObra»): os cartões de serviço e as obras pré-escolhem um deles
TIPOS_DE_OBRA = SITE["tiposDeObra"]
# o tipo de obra que cada categoria de obras pré-escolhe no formulário (ligação «Pedir Orçamento» da ficha)
CAT_TIPO = {"reabilitacao": "Reabilitação de Edifício", "fachadas": "Fachadas / Impermeabilização", "acabamentos": "Acabamentos"}


def lados(n):
    """Os lados maiores dos tamanhos que existem para a fotografia n: os de FOTO_LADOS abaixo do original e o original."""
    maior = max(FOTOS[n]["w"], FOTOS[n]["h"])
    return [l for l in FOTO_LADOS if l < maior] + [maior]


def campos_obra(o):
    """Campos calculados de cada obra (modelo obra.html e cartões). As fichas vivem em obras/: root «../»."""
    f = FOTOS[o["foto"]]
    o["orient"] = "landscape" if f["w"] >= f["h"] else "portrait"
    o["alt"] = f["alt"]
    o["catNome"] = CATEGORIAS[o["cat"]]
    tipo = CAT_TIPO.get(o["cat"], "Outro")
    if tipo not in TIPOS_DE_OBRA:
        raise SystemExit(f"build.py: CAT_TIPO «{tipo}» não é um dos «tiposDeObra» de data/site.json")
    o["tipoDeObra"] = tipo
    o["orcamentoHref"] = f"../index.html?tipo={quote(tipo)}#contacto"
    msg = SITE["wa"]["obra"].replace("{code}", o["code"]).replace("{title}", o["title"])
    o["waHref"] = SITE["whatsappBase"] + quote(msg)
    o["relTitulo"] = f"Outras obras de {o['catNome'].lower()}"
    o["relHref"] = f"obras.html#{o['cat']}"
    o["fotoSizes"] = ("(min-width: 1280px) min(1240px, calc(78vh * 4 / 3)), min(100vw, calc(78vh * 4 / 3))"
                      if o["orient"] == "landscape" else "min(100vw, calc(78vh * 3 / 4))")
    # sem comparador, a chave existe vazia: os modelos perguntam {{#se obra.antesDepois}} (uma chave em falta é erro)
    ad = o.setdefault("antesDepois", "")
    if ad:
        for k in ("antes", "depois"):
            if ad.get(k) not in FOTOS:
                raise SystemExit(f"obras.json {o['code']}: antesDepois.{k} tem de ser uma fotografia de data/fotos.json")
        o["antesAlt"], o["depoisAlt"] = FOTOS[ad["antes"]]["alt"], FOTOS[ad["depois"]]["alt"]
        o["antesSrc"], o["depoisSrc"] = f"foto-{ad['antes']}.jpg", f"foto-{ad['depois']}.jpg"


for _o in OBRAS:
    if _o["foto"] not in FOTOS:
        raise SystemExit(f"obras.json {_o['code']}: «foto» {_o['foto']} não existe em data/fotos.json")
    if _o["cat"] not in CATEGORIAS:
        raise SystemExit(f"obras.json {_o['code']}: categoria «{_o['cat']}» não existe em «categorias»")
    campos_obra(_o)
CAT_N = {**{c: sum(1 for o in OBRAS if o["cat"] == c) for c in CATEGORIAS}, "todas": len(OBRAS)}


def relacionadas(o, n=2):
    """n obras: primeiro as da mesma categoria (pela ordem do ficheiro, sem a própria), depois as outras."""
    out = []
    for chave in (lambda x: x["cat"] == o["cat"], lambda x: True):
        out += [x for x in OBRAS if x is not o and x not in out and chave(x)]
    return out[:n]


META_RE = re.compile(r"\A\s*<!--meta\s+(\{.*?\})\s*-->\s*", re.S)
# etiqueta mais interior primeiro: {{foto {{ obra.foto }} ...}} resolve {{ obra.foto }} e depois {{foto 03 ...}}
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


def ultima_entrada(sizes):
    """Última entrada de um sizes (a dos ecrãs estreitos): a vírgula conta só fora de parênteses, como em min(a, b)."""
    nivel, ini = 0, 0
    for i, c in enumerate(sizes):
        nivel += (c == "(") - (c == ")")
        if c == "," and nivel == 0:
            ini = i + 1
    return sizes[ini:].strip()


def foto(ctx, args):
    parts = args.split(None, 1)
    n = parts[0].zfill(2)
    attrs = dict(ATTR_RE.findall(parts[1])) if len(parts) > 1 else {}
    if n not in FOTOS:
        raise KeyError(f"{{{{foto {n}}}}}: não existe em data/fotos.json ({ctx.get('_file', '?')})")
    f = FOTOS[n]
    base = f"{ctx['root']}assets/img/fotos/foto-{n}"
    w, h = f["w"], f["h"]
    maior = max(w, h)
    alt = attrs.get("alt", f["alt"])
    sizes = attrs.get("sizes", "100vw")
    sizes = f"{FOTO_3X} calc({ultima_entrada(sizes)} * 2 / 3), {sizes}"
    loading = attrs.get("loading", "lazy")
    cls = ("foto " + attrs.get("class", "")).strip()
    foco = attrs.get("foco", "")
    estilo = f' style="object-position: {foco}"' if foco else ""
    previa = f' style="--lqip: url({LQIP[n]}){"; --lqip-pos: " + foco if foco else ""}"' if n in LQIP else ""
    extra = ' fetchpriority="high"' if loading == "eager" and attrs.get("prioridade") != "normal" else ""

    def srcset(ext):
        return ", ".join(f"{base}-{lado}.{ext} {w * lado // maior}w" for lado in lados(n))
    return (f'<picture class="{cls}"{previa}>'
            f'<source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{srcset("webp")}" sizes="{sizes}">'
            f'<img src="{base}.jpg" alt="{html.escape(alt, quote=True)}" width="{w}" height="{h}"{estilo} '
            f'loading="{loading}" decoding="async"{extra}></picture>')


def wa(ctx, key):
    if key not in SITE["wa"]:
        raise KeyError(f"{{{{wa {key}}}}}: não existe em site.json «wa» ({ctx.get('_file', '?')})")
    return SITE["whatsappBase"] + quote(SITE["wa"][key])


def each(ctx, args):
    name, sel = args.split(None, 1)
    sel = sel.strip()
    m = re.search(r"\s+eager(\d+)$", sel)
    eager = int(m.group(1)) if m else 0
    if m:
        sel = sel[: m.start()].strip()
    if sel == "all":
        items = OBRAS
    elif sel.startswith("cat="):
        items = [o for o in OBRAS if o["cat"] == sel[4:]]
    elif sel.startswith("ctx:"):
        items = lookup(ctx, sel[4:])
    else:
        items = [OBRA_BY_N[x.strip().zfill(2)] for x in sel.split(",")]
    tpl = (SRC / "partials" / f"{name}.html").read_text(encoding="utf-8")
    sizes = ctx["page"].get("cartaoSizes") or "(min-width: 980px) min(calc(50vw - 41px), 611px), calc(100vw - 44px)"
    out = []
    for i, o in enumerate(items):
        c = dict(ctx, obra=o, index=i, pos=i + 1, total=len(items), cartaoSizes=sizes,
                 loading="eager" if i < eager else "lazy", prioridade="alta" if i == 0 and eager else "normal")
        out.append(render(tpl, c))
    return "".join(out)


ABRE_RE = re.compile(r"\{\{#(se|sem|cada)\s+([\w.]+)\s*\}\}")


def tem(v):
    return bool(v.strip()) if isinstance(v, str) else bool(v)


def valor(ctx, caminho):
    """Valor de um bloco {{#se}}/{{#sem}}/{{#cada}}. Um caminho que não existe é erro (gralha), não «vazio»."""
    if caminho.startswith("dados."):
        chave = caminho.split(".")[1]
        if chave not in DADOS:
            raise KeyError(f"{caminho}: não existe em data/dados-melperfaz.json ({ctx.get('_file', '?')})")
        DADOS_USO.setdefault(chave, set()).add(ctx.get("_file", "?"))
    try:
        return lookup(ctx, caminho)
    except KeyError:
        raise KeyError(f"{{{{#… {caminho} }}}} não existe em {ctx.get('_file', '?')}")


def blocos(text, ctx, depth):
    """Resolve os blocos de fora para dentro: o conteúdo de um {{#cada}} vê o seu {{ item }}."""
    out, pos = [], 0
    while m := ABRE_RE.search(text, pos):
        tipo, caminho = m.groups()
        par = re.compile(r"\{\{(?:#%s\s|/%s\}\})" % (tipo, tipo))
        nivel, fim = 1, m.end()
        while nivel:
            t = par.search(text, fim)
            if not t:
                raise SyntaxError(f"{{{{#{tipo} {caminho}}}}} sem {{{{/{tipo}}}}} em {ctx.get('_file', '?')}")
            nivel += 1 if t.group(0)[2] == "#" else -1
            fim = t.end()
        corpo, v = text[m.end():t.start()], valor(ctx, caminho)
        out.append(text[pos:m.start()])
        if tipo == "cada":
            out.extend(render(corpo, dict(ctx, item=x), depth + 1) for x in (v or []))
        elif tem(v) == (tipo == "se"):
            out.append(blocos(corpo, ctx, depth))
        else:   # bloco escondido: os dados lá dentro também contam para --faltam (e uma gralha é erro)
            for chave in re.findall(r"\{\{[^{}]*?\bdados\.(\w+)", corpo):
                valor(ctx, "dados." + chave)
        pos = fim
    out.append(text[pos:])
    return "".join(out)


def render(text, ctx, depth=0):
    if depth > 12:
        raise RuntimeError("inclusão recursiva demasiado profunda")
    text = blocos(text, ctx, depth)

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
        if key.startswith("dados."):
            DADOS_USO.setdefault(key.split(".")[1], set()).add(ctx.get("_file", "?"))
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


PREVIEW = bool(SITE.get("preview"))
# páginas sempre fora do Google, também depois do lançamento; --check confirma
NOINDEX_SEMPRE = {"404.html", "obrigado.html"}
NOINDEX_RE = re.compile(r"\b(?:noindex|none)\b", re.I)
# imagem de partilha: o logótipo branco sobre azul-marinho (do sistema de desenho, assets/Partilha)
OG_IMG = {"src": "og-melperfaz.jpg", "w": 1200, "h": 630, "alt": "Logótipo da Melperfaz, Construção Civil, Lda., a branco sobre azul-marinho"}


def business_ld():
    """A empresa, igual em todas as páginas (Google: ficha da empresa). Só com o que está confirmado: os dados vazios de
    dados-melperfaz.json (morada, zona, email, mapa) ficam de fora até serem preenchidos."""
    b = SITE["baseUrl"]
    ld = {"@context": "https://schema.org", "@type": "GeneralContractor", "@id": b + "/#melperfaz",
          "name": SITE["legalName"], "legalName": SITE["legalName"], "url": b + "/",
          "logo": b + "/assets/img/logo-melperfaz.png", "image": [b + "/assets/img/" + OG_IMG["src"], b + "/assets/img/fotos/foto-01.jpg"],
          "slogan": SITE["slogan"], "telephone": SITE["phoneE164"], "foundingDate": SITE["founded"],
          "knowsAbout": ["Reabilitação de edifícios", "Espaços comerciais", "Remodelação de apartamentos", "Trabalhos de estrutura",
                         "Fachadas e impermeabilização", "Acabamentos"]}
    if tem(DADOS["email"]):
        ld["email"] = DADOS["email"]
    if tem(DADOS["nif"]):
        ld["vatID"] = "PT" + re.sub(r"\D", "", DADOS["nif"])
    if tem(DADOS["morada"]):
        ld["address"] = {"@type": "PostalAddress", "streetAddress": DADOS["morada"], "addressCountry": "PT"}
    if tem(DADOS["zona"]):
        ld["areaServed"] = DADOS["zona"]
    if tem(DADOS["googleMaps"]):
        ld["hasMap"] = DADOS["googleMaps"]
        ld["sameAs"] = [DADOS["googleMaps"]]
    return ld


def breadcrumb_ld(trail):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": SITE["baseUrl"] + "/" + f}
                                for i, (n, f) in enumerate(trail)]}


def page_ctx(meta, file):
    meta = {"nav": "", "robots": "index,follow", "og": "", "wa": "geral", "tipo": "", **meta}
    if PREVIEW and not NOINDEX_RE.search(meta["robots"]):
        meta["robots"] = "noindex"   # pré-visualização: nenhuma página entra no Google antes do lançamento
    depth = file.count("/")
    # a 404 é servida em qualquer profundidade (/obras/xyz.html): precisa de caminhos absolutos
    root = "/" if file == "404.html" else "../" * depth
    return {"site": SITE, "page": meta, "root": root, "_file": file, "dados": DADOS, "categorias": CATEGORIAS,
            "cat_n": CAT_N, "year": str(ANO), "anos": str(SITE["anos"]), "tipos": TIPOS_DE_OBRA}


def build_page(meta, body_tpl, extra_ctx=None):
    file = meta["file"]
    ctx = page_ctx(meta, file)
    if extra_ctx:
        ctx.update(extra_ctx)
    body = render(body_tpl, ctx)
    lds = [business_ld()]
    for kind in meta.get("jsonld", []):
        if kind == "breadcrumb":
            lds.append(breadcrumb_ld(meta["breadcrumb"]))
        else:
            raise SystemExit(f"{file}: jsonld «{kind}» desconhecido (só breadcrumb)")
    ld_html = "".join('<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False).replace("</", "<\\/")
                      + "</script>\n" for x in lds)
    css = "".join(f'<link rel="stylesheet" href="{ctx["root"]}assets/css/{c}">\n' for c in meta.get("css", []))
    og = meta.get("og") or ""
    if og:   # uma fotografia (data/fotos.json): o jpg original, foto-NN.jpg
        f = FOTOS[og]
        og_img = {"src": f"fotos/foto-{og}.jpg", "w": f["w"], "h": f["h"], "alt": f["alt"]}
    else:
        og_img = OG_IMG
    ctx.update({"og_image": SITE["baseUrl"] + "/assets/img/" + og_img["src"], "og_w": og_img["w"], "og_h": og_img["h"],
                "og_alt": og_img["alt"], "content": body, "jsonld": ld_html, "page_css": css,
                "canonical": SITE["baseUrl"] + "/" + ("" if file == "index.html" else file)})
    layout = (SRC / "templates" / "layout.html").read_text(encoding="utf-8")
    out = versiona(render(layout, ctx))
    dest = OUT / file
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    return file


# Cache: CSS e JS levam ?v=<8 hex do sha1 do ficheiro>; com o nome igual e o conteúdo novo, o browser e o Netlify
# (netlify.toml: um ano, immutable) vão buscar a versão nova. --check ignora o ?… ao resolver a referência.
VERSAO_RE = re.compile(r'((?:href|src)="(?:[^"?]*/)?assets/(?:css|js)/)([^"?]+)"')
_VERSOES = {}


def versao(nome):
    if nome not in _VERSOES:
        _VERSOES[nome] = hashlib.sha1((ASSETS / nome).read_bytes()).hexdigest()[:8]
    return _VERSOES[nome]


def versiona(texto):
    return VERSAO_RE.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={versao(m.group(1).split("assets/", 1)[1] + m.group(2))}"', texto)


def limpa_saida():
    """Apaga a saída anterior, só se for uma pasta que o build.py gerou (com MARCA_SAIDA) ou vazia. MELPERFAZ_OUT aceita
    qualquer caminho, e um engano (MELPERFAZ_OUT=., MELPERFAZ_OUT=~) apagaria o site ou a pasta pessoal: pára antes."""
    p, casa = OUT, Path.home().resolve()
    porque = ""
    if p == Path(p.anchor) or p == casa or p in casa.parents:
        porque = "é a raiz do disco ou a pasta pessoal"
    elif p == ROOT or p in ROOT.parents:
        porque = "é a pasta do site ou uma pasta acima dela"
    elif ".git" in p.parts:
        porque = "fica dentro de uma pasta .git"
    elif any(p == d or d in p.parents for d in (SRC, DATA, ASSETS)):
        porque = "fica dentro das fontes do site (src/, data/ ou assets/)"
    elif p.exists() and not p.is_dir():
        porque = "não é uma pasta"
    elif p.exists() and any((p / x).exists() for x in ("build.py", "data", ".git")):
        porque = "tem build.py, data/ ou .git: parece código, não um site gerado"
    elif p.exists() and any(p.iterdir()) and not (p / MARCA_SAIDA).is_file():
        porque = f"não está vazia e não tem o ficheiro {MARCA_SAIDA}, que o build.py deixa nas pastas que gera"
    if porque:
        raise SystemExit(f"build.py: não apago {p}: {porque}. MELPERFAZ_OUT tem de ser uma pasta nova, vazia ou já gerada "
                         "pelo build.py. Escolha outra pasta, ou apague esta à mão se tiver a certeza.")
    if p.exists() and any(p.iterdir()):
        shutil.rmtree(p)


def build():
    limpa_saida()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / MARCA_SAIDA).write_text("Pasta gerada pelo build.py do site da Melperfaz. Ao gerar de novo, o build.py só apaga "
                                   "uma pasta com este ficheiro.\n", encoding="utf-8")
    shutil.copytree(ASSETS, OUT / "assets", ignore=shutil.ignore_patterns(".*"))
    files, fora_do_mapa = [], set()
    for p in sorted((SRC / "pages").rglob("*.html")):
        text = p.read_text(encoding="utf-8")
        m = META_RE.match(text)
        if not m:
            raise SystemExit(f"{p}: falta o bloco <!--meta {{...}} -->")
        meta = json.loads(m.group(1))
        files.append(build_page(meta, text[m.end():]))
        if NOINDEX_RE.search(meta.get("robots", "")):
            fora_do_mapa.add(meta["file"])
    tpl = (SRC / "templates" / "obra.html").read_text(encoding="utf-8")
    for i, o in enumerate(OBRAS):
        prev_o, next_o = OBRAS[i - 1], OBRAS[(i + 1) % len(OBRAS)]
        file = f"obras/{o['slug']}.html"
        meta = {"file": file, "nav": "obras", "css": ["pag-obras.css"],
                "title": f"{o['title']} · Obras Melperfaz",
                "description": f"{o['title']}: {o['catNome'].lower()}. Obra da Melperfaz, fotografada no local pela nossa equipa.",
                "og": o["foto"], "jsonld": ["breadcrumb"],
                "breadcrumb": [["Início", ""], ["Obras", "obras.html"], [o["title"], file]]}
        files.append(build_page(meta, tpl, {"obra": o, "prev": prev_o, "next": next_o, "related": relacionadas(o)}))
    urls = "".join(f"<url><loc>{SITE['baseUrl']}/{'' if f == 'index.html' else f}</loc></url>\n"
                   for f in files if f not in fora_do_mapa)
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n'
                                     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "</urlset>\n",
                                     encoding="utf-8")
    if PREVIEW:
        (OUT / "robots.txt").write_text("# Pré-visualização: não indexar. No lançamento, \"preview\": false em data/site.json.\n"
                                        "User-agent: *\nDisallow: /\n", encoding="utf-8")
        (OUT / "_headers").write_text("# Pré-visualização: gerado por build.py a partir de \"preview\" em data/site.json\n"
                                      "/*\n  X-Robots-Tag: noindex\n", encoding="utf-8")
    else:
        (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {SITE['baseUrl']}/sitemap.xml\n", encoding="utf-8")
    return files


# ── Verificações (--check) ───────────────────────────────────────────────────────────────────────────────────────────
# o que sobra de um dado por preencher: [MAIÚSCULAS…], [[CHAVE]], «por preencher», «lorem ipsum»
PLACEHOLDER_RE = re.compile(r"\[[^\[\]<>\"']*?[A-ZÀ-Ý]{3}[^\[\]<>\"']*\]|\[\[[^\]]*\]\]|(?i:\b(?:por preencher|lorem ipsum)\b)")
# regras de texto da marca (sistema de desenho, «Voz e texto»): sem travessões, sem emoji, telefone em grupos de três
PROIBIDO = [
    (re.compile("\u2014"), "travessão (—): usar vírgulas ou parênteses"),
    (re.compile(r"\b(?:961245288|961\u00a0245\u00a0288|961-245-288)\b"), f"telefone escrito de outra forma: «{SITE['phone']}»"),
    # os glifos do sistema (✓ ✦ → ‹ ›) ficam fora da regra: só os blocos de emoji e os símbolos diversos (☎ ☀ …)
    (re.compile("[\U0001F300-\U0001FAFF\u2600-\u26FF]"), "emoji ou símbolo: o site não usa"),
]
REF_RE = re.compile(r'(?:href|src|action)="([^"#?]+)|srcset="([^"]+)"|url\(([^)]+)\)')
# Netlify Forms: o formulário de orçamento tem de chegar ao HTML gerado com o nome, os atributos do Netlify, a armadilha
# para robôs e os mesmos campos em todas as páginas onde aparece (o Netlify regista um só «orcamento»)
FORM_RE = re.compile(r'<form\b[^>]*\bid="quoteForm"[^>]*>.*?</form>', re.S)
FORM_EXIGE = [' name="orcamento"', ' method="POST"', ' data-netlify="true"', ' netlify-honeypot="bot-field"',
              ' action="/obrigado.html"']
FORM_CAMPOS = {"form-name", "subject", "pagina", "nome", "telefone", "email", "tipo_de_obra", "mensagem", "bot-field"}
TAG_TEXTO_RE = re.compile(r"</?(?:a|abbr|b|br|cite|code|em|i|small|span|strong|sub|sup|time|u|wbr)\b[^<>]*>", re.I)
LD_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def texto_visivel(text):
    """O texto como aparece: sem comentários nem imagens em base64, com as entidades e os \\uXXXX descodificados."""
    t = re.sub(r"data:[^,\s\"']*;base64,[A-Za-z0-9+/=]+", "data:", re.sub(r"<!--.*?-->", "", text, flags=re.S))
    t = re.sub(r"\\(?:u\{?([0-9a-fA-F]{4})\}?|x([0-9a-fA-F]{2}))", lambda m: chr(int(m.group(1) or m.group(2), 16)), t)
    return unquote(html.unescape(t))


def texto_proibido(nome, text):
    t = texto_visivel(text)
    vistas = {t, TAG_TEXTO_RE.sub(" ", t)}
    achados = lambda rx: sorted({m for v in vistas for m in rx.findall(v)})
    out = [f"{nome}: placeholder visível → {m}" for m in achados(PLACEHOLDER_RE)]
    for rx, porque in PROIBIDO:
        out += [f"{nome}: {porque} → «{m}»" for m in achados(rx)]
    return out


def check_cabeca(f, text):
    """JSON-LD válido e com a empresa; robots de acordo com o modo; título, descrição e um só h1; lang; og e canonical."""
    out, tipos = [], []
    for bloco in LD_RE.findall(text):
        try:
            tipos.append(json.loads(bloco).get("@type"))
        except json.JSONDecodeError as e:
            out.append(f"{f}: JSON-LD inválido ({e})")
    if "GeneralContractor" not in tipos:
        out.append(f"{f}: falta o JSON-LD da empresa")
    if not re.search(r'<html lang="pt-PT"', text):
        out.append(f"{f}: falta lang=\"pt-PT\" no <html>")
    robots = re.search(r'<meta name="robots" content="([^"]*)"', text)
    noindex = bool(robots and NOINDEX_RE.search(robots.group(1)))
    if PREVIEW and not noindex:
        out.append(f"{f}: pré-visualização sem <meta name=\"robots\" content=\"noindex\">")
    elif not PREVIEW and noindex != (f in NOINDEX_SEMPRE):
        out.append(f"{f}: lançamento com noindex (fica fora do Google)" if noindex else
                   f"{f}: sem noindex (fica sempre fora do Google, NOINDEX_SEMPRE)")
    titulo = re.search(r"<title>(.*?)</title>", text, re.S)
    if not (titulo and titulo.group(1).strip()):
        out.append(f"{f}: sem <title>")
    elif len(html.unescape(titulo.group(1))) > 70:
        out.append(f"{f}: título com mais de 70 caracteres ({len(html.unescape(titulo.group(1)))})")
    desc = re.search(r'<meta name="description" content="([^"]*)"', text)
    d = html.unescape(desc.group(1)) if desc else ""
    if not d.strip():
        out.append(f"{f}: meta description vazia")
    elif len(d) > 160:
        out.append(f"{f}: meta description com mais de 160 caracteres ({len(d)})")
    h1 = len(re.findall(r"<h1\b", text))
    if h1 != 1:
        out.append(f"{f}: {h1} h1 (tem de ser um)")
    base = SITE["baseUrl"] + "/"
    for prop in ("og:image", "og:url"):
        m = re.search(r'<meta property="%s" content="([^"]*)"' % prop, text)
        if not (m and m.group(1).startswith(base)):
            out.append(f"{f}: {prop} fora de {base}")
        elif prop == "og:image" and not (OUT / m.group(1)[len(base):]).exists():
            out.append(f"{f}: og:image não existe → {m.group(1)}")
    for img in re.findall(r"<img\b[^>]*>", text):
        if not re.search(r'\salt="', img):
            out.append(f"{f}: <img> sem alt → {img[:80]}")
    return out


def check_formulario(f, text):
    """O formulário de orçamento, onde existir, é o mesmo formulário Netlify em todas as páginas."""
    m = FORM_RE.search(text)
    if not m:
        return []
    form = m.group(0)
    abre = form[:form.index(">") + 1]
    out = [f"{f}: formulário sem{x}" for x in FORM_EXIGE if x not in abre]
    campos = set(re.findall(r'<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"', form))
    if campos != FORM_CAMPOS:
        out.append(f"{f}: campos do formulário diferentes do esperado → a mais {sorted(campos - FORM_CAMPOS)}, "
                   f"em falta {sorted(FORM_CAMPOS - campos)}")
    if not re.search(r'<input type="hidden" name="form-name" value="orcamento">', form):
        out.append(f"{f}: falta o campo escondido form-name=orcamento")
    opcoes = re.findall(r"<option value=\"([^\"]*)\"", form)
    if [o for o in opcoes if o] != TIPOS_DE_OBRA:
        out.append(f"{f}: as opções de «Tipo de Obra» não são as de site.json «tiposDeObra» → {opcoes}")
    for nome in ("nome", "telefone", "email", "mensagem"):
        el = re.search(r'<(?:input|textarea)\b[^>]*\bname="%s"[^>]*>' % nome, form)
        if el and not re.search(r'\bmaxlength="\d+"', el.group(0)):
            out.append(f"{f}: o campo «{nome}» não tem maxlength")
    for campo in re.findall(r'<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"', form):
        if not re.search(r'<label\b[^>]*\bfor="%s"' % re.escape(campo), form) and campo != "qGotcha":
            out.append(f"{f}: o campo #{campo} não tem <label for>")
    return out


def check_preview():
    """O modo de pré-visualização e o lançamento nunca ficam a meio caminho: robots.txt, _headers e netlify.toml."""
    out, robots_f, cab = [], OUT / "robots.txt", OUT / "_headers"
    robots = robots_f.read_text(encoding="utf-8") if robots_f.exists() else ""
    disallow = re.search(r"^\s*Disallow:\s*/\s*$", robots, re.I | re.M)
    cab_noindex = cab.exists() and re.search(r"^/\*[ \t]*\n(?:[ \t]+\S.*\n)*?[ \t]+X-Robots-Tag:[^\n]*noindex",
                                             cab.read_text(encoding="utf-8"), re.I | re.M)
    if PREVIEW:
        if not disallow:
            out.append("pré-visualização: robots.txt sem «Disallow: /»")
        if not cab_noindex:
            out.append("pré-visualização: _headers sem «X-Robots-Tag: noindex» em /*")
        return out
    if disallow:
        out.append("lançamento: robots.txt ainda tem «Disallow: /»")
    sitemap = f"{SITE['baseUrl']}/sitemap.xml"
    if not re.search(r"^Sitemap:\s*%s\s*$" % re.escape(sitemap), robots, re.M):
        out.append(f"lançamento: robots.txt sem a linha «Sitemap: {sitemap}»")
    if cab.exists() and any(map(NOINDEX_RE.search, re.findall(r"X-Robots-Tag:(.*)", cab.read_text(encoding="utf-8"), re.I))):
        out.append("lançamento: _headers ainda pede noindex")
    toml = ROOT / "netlify.toml"
    conf = {}
    if toml.exists() and tomllib is None:
        out.append("lançamento: o --check precisa de Python 3.11+ para ler o netlify.toml")
    elif toml.exists():
        try:
            conf = tomllib.loads(toml.read_text(encoding="utf-8"))
        except tomllib.TOMLDecodeError as e:
            out.append(f"lançamento: netlify.toml inválido → {e}")
    else:
        out.append("falta netlify.toml (a publicação no Netlify)")
    for h in conf.get("headers", []):
        robots_h = ", ".join(str(v) for k, v in h.get("values", {}).items() if k.lower() == "x-robots-tag")
        if NOINDEX_RE.search(robots_h):
            out.append(f"lançamento: netlify.toml pede noindex em {h.get('for', '?')}")
    if conf and conf.get("build", {}).get("publish") != "public":
        out.append("netlify.toml: [build] publish tem de ser «public» (a pasta que o build.py gera)")
    if not SITE["baseUrl"].startswith("https://"):
        out.append(f"lançamento: baseUrl tem de começar por https:// → {SITE['baseUrl']}")
    return out


def check_fotos():
    """Cada fotografia de data/fotos.json tem o original e todos os tamanhos (gerar_fotos.py); nada vazio nem a meio."""
    out, pasta = [], ASSETS / "img" / "fotos"
    for n, f in FOTOS.items():
        if not (pasta / f"foto-{n}.jpg").is_file():
            out.append(f"fotos.json «{n}»: falta assets/img/fotos/foto-{n}.jpg (o original)")
            continue
        cab = (pasta / f"foto-{n}.jpg").read_bytes()[:2]
        if cab != b"\xff\xd8":
            out.append(f"assets/img/fotos/foto-{n}.jpg: não é um JPEG")
        for lado in lados(n):
            for ext in ("avif", "webp"):
                p = pasta / f"foto-{n}-{lado}.{ext}"
                if not p.is_file():
                    out.append(f"fotos.json «{n}»: falta {p.name} (python3 gerar_fotos.py)")
                elif p.stat().st_size == 0:
                    out.append(f"{p.name}: imagem vazia (0 bytes): python3 gerar_fotos.py --todas")
        if n not in LQIP:
            out.append(f"fotos.json «{n}»: sem prévia em data/lqip.json (python3 gerar_fotos.py)")
    for p in pasta.glob("*.tmp"):
        out.append(f"{p.name}: sobra de uma gravação interrompida do gerar_fotos.py: apagar")
    usadas = {o["foto"] for o in OBRAS} | {x for o in OBRAS for x in (o.get("antesDepois") or {}).values()}
    for p in sorted(pasta.glob("foto-*")):
        n = re.match(r"foto-(\d+)", p.name).group(1)
        if n not in FOTOS:
            out.append(f"{p.name}: não está em data/fotos.json (apagar ou registar)")
    return out


EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[a-z]{2,}", re.I)


def check_dados():
    """Formato dos dados da Melperfaz: um engano apareceria tal e qual no site."""
    out = []
    for k, v in DADOS_DOC.items():
        if k.startswith("_"):
            continue
        if not (isinstance(v, dict) and all(x in v for x in ("valor", "grupo", "pedido"))):
            out.append(f"dados-melperfaz.json «{k}»: tem de ter «valor», «grupo» e «pedido»")
            continue
        if not isinstance(v["valor"], str):
            out.append(f"dados-melperfaz.json «{k}»: «valor» tem de ser texto, entre aspas")
    v = DADOS.get("email", "")
    if tem(v) and not EMAIL_RE.fullmatch(v.strip()):
        out.append(f"dados-melperfaz.json «email»: não parece um email → «{v}»")
    v = DADOS.get("nif", "")
    if tem(v) and not re.fullmatch(r"\d{3} ?\d{3} ?\d{3}", v.strip()):
        out.append(f"dados-melperfaz.json «nif»: nove algarismos, com ou sem espaços («123 456 789») → «{v}»")
    v = DADOS.get("googleMaps", "")
    if tem(v) and not re.match(r"https://(?:maps\.app\.goo\.gl/|(?:www\.)?google\.[a-z.]+/maps|g\.page/|goo\.gl/maps/)", v.strip()):
        out.append(f"dados-melperfaz.json «googleMaps»: tem de ser uma ligação do Google Maps → «{v}»")
    for k in ("alvara", "seguro", "zona", "horario", "morada"):
        if "\u2014" in DADOS.get(k, ""):
            out.append(f"dados-melperfaz.json «{k}»: sem travessões (—)")
    return out


def check_obras():
    out = []
    slugs, codes = set(), set()
    for o in OBRAS:
        for campo in ("n", "code", "slug", "cat", "catLabel", "title", "foto", "resumo", "detalhes", "factos"):
            if campo not in o:
                out.append(f"obras.json {o.get('code', '?')}: falta «{campo}»")
        if o["slug"] in slugs:
            out.append(f"obras.json: slug repetido «{o['slug']}»")
        if o["code"] in codes:
            out.append(f"obras.json: código repetido «{o['code']}»")
        slugs.add(o["slug"]); codes.add(o["code"])
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", o["slug"]):
            out.append(f"obras.json {o['code']}: slug só com letras minúsculas sem acentos, algarismos e hífens → «{o['slug']}»")
        if not (isinstance(o["detalhes"], list) and o["detalhes"] and all(isinstance(x, str) and x.strip() for x in o["detalhes"])):
            out.append(f"obras.json {o['code']}: «detalhes» tem de ser uma lista de frases")
        if set(o["factos"]) != {"data", "localExato", "duracao", "resultado"}:
            out.append(f"obras.json {o['code']}: «factos» tem de ter data, localExato, duracao e resultado (vazios ou não)")
        if o["foco"] if "foco" in o else False:
            if not re.fullmatch(r"\d{1,3}% \d{1,3}%", o["foco"]):
                out.append(f"obras.json {o['code']}: «foco» é «X% Y%» → «{o['foco']}»")
    return out


def check(files):
    problems = []
    for f in files:
        path = OUT / f
        text = path.read_text(encoding="utf-8")
        sem_scripts = re.sub(r"<script.*?</script>", "", text, flags=re.S)
        if "{{" in sem_scripts or "}}" in sem_scripts:
            problems.append(f"{f}: sobra sintaxe de modelo {{{{ }}}}")
        problems += texto_proibido(f, text)
        problems += check_cabeca(f, text)
        problems += check_formulario(f, text)
        for a, b, c in REF_RE.findall(text):
            refs = [a] if a else ([s.strip().split()[0] for s in b.split(",")] if b else [c.strip("'\"")])
            for r in refs:
                if not r or re.match(r"^(https?:|mailto:|tel:|data:|//)", r):
                    continue
                target = (OUT / r.lstrip("/")) if r.startswith("/") else (path.parent / r).resolve()
                if not target.exists():
                    problems.append(f"{f}: referência partida → {r}")
    problems += check_preview() + check_fotos() + check_dados() + check_obras()
    for css in (OUT / "assets" / "css").glob("*.css"):
        for c in re.findall(r"url\(([^)]+)\)", css.read_text(encoding="utf-8")):
            c = c.strip("'\"")
            if not c.startswith("data:") and not (css.parent / c.split("?")[0]).resolve().exists():
                problems.append(f"{css.name}: url partido → {c}")
    for extra in sorted((OUT / "assets" / "js").glob("*.js")):   # o que o visitante lê também vem dos scripts
        problems += texto_proibido(str(extra.relative_to(OUT)), extra.read_text(encoding="utf-8"))
    print(f"{len(files)} páginas geradas em {OUT}")
    if PREVIEW:
        print("Pré-visualização: noindex em todas as páginas. No lançamento: \"preview\": false em data/site.json.")
    n = sum(1 for _ in em_falta())
    if n:
        print(f"\n{n} dados por preencher pela Melperfaz, escondidos no site até lá: python3 build.py --faltam")
    if problems:
        print("\nPROBLEMAS:")
        for p in problems:
            print("  " + p)
        return 1
    print("\nSem ligações ou recursos partidos.")
    return 0


FACTOS_OBRA = {"data": "Data da obra", "localExato": "Local (bairro ou concelho, sem o nome do cliente)",
               "duracao": "Duração", "resultado": "Resultado da obra numa frase"}


def em_falta():
    for k, v in DADOS_DOC.items():
        if k.startswith("_") or tem(v["valor"]):
            continue
        pags = sorted(DADOS_USO.get(k, ()))
        onde = ("entra em " + (" e ".join(pags) if len(pags) <= 2 else f"{len(pags)} páginas")) if pags else "não entra em nenhuma página"
        yield v["grupo"], f"{v['pedido']}.\n      chave «{k}» · {onde}"
    for campo, nome in FACTOS_OBRA.items():
        sem = [o["code"] for o in OBRAS if not tem(o["factos"].get(campo, ""))]
        if sem:
            yield ("Obras (data/obras.json, «factos» de cada obra; a linha só aparece na ficha quando existe)",
                   f"{nome}: falta em {len(sem)} de {len(OBRAS)} obras" + ("" if len(sem) == len(OBRAS) else f" ({', '.join(sem)})"))


def faltam():
    grupos = {}
    for g, txt in em_falta():
        grupos.setdefault(g, []).append(txt)
    total = sum(len(v) for v in grupos.values())
    print(f"\nDados que só a Melperfaz pode dar: {total} em falta. Preencher em melperfaz/data/dados-melperfaz.json"
          " (as obras em melperfaz/data/obras.json).\nNunca escrever um número ou um facto que não esteja confirmado.")
    for g, linhas in grupos.items():
        print(f"\n{g}")
        for l in linhas:
            print(f"  · {l}")


if __name__ == "__main__":
    built = build()
    rc = check(built) if "--check" in sys.argv else 0
    if "--faltam" in sys.argv:
        faltam()
    sys.exit(rc)
