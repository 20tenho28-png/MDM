#!/usr/bin/env python3
"""Gera o site estático da MDM a partir de src/ e data/ para public/.

Só biblioteca padrão. Uso:
    python3 website/build.py            # gera public/
    python3 website/build.py --check    # gera e valida ligações, recursos, placeholders e decisões do dono
    python3 website/build.py --faltam   # lista os dados que só a MDM pode dar (data/dados-mdm.json, factos das obras)

Sintaxe dos modelos (src/):
    <!--meta {...json...} -->            no topo de cada página: title, description, file, nav, jsonld, css
                                          (jsonld: faq, breadcrumb, servico; este lê "servico": {nome, tipo, ofertas};
                                          a empresa, HVACBusiness, vai sempre em todas as páginas)
    {{ caminho.ponto }}                   valor de site.*, page.*, obra.*, root (prefixo relativo à raiz), serv_n.* (obras por serviço)
                                          (obra.*: os campos de obras.json e os calculados por campos_obra(): serv, servLabel,
                                          servicoUrl, orcamentoHref, waHref, ctaTitulo, relTitulo, relLigacao, relHref, fotoSizes)
    {{> nome }}                           inclui src/partials/nome.html com o mesmo contexto
    {{foto NN sizes="..." class="..." loading="eager" alt="..."}}   <picture> avif + webp + jpg da obra NN
                                          (FOTO_LADOS; tamanhos feitos por gerar_fotos.py)
    {{wa chave}}                          ligação de WhatsApp com a mensagem pré-preenchida site.wa.chave
    {{li obra.detalhes}}                  um <li> por texto de uma lista
    {{each parcial NN,NN,...}} / {{each parcial all}} / {{each parcial cat=vent}} / {{each parcial ctx:related}}   repete um parcial por obra
                                          (… eagerN no fim: as N primeiras imagens sem lazy, ex.: eager1)
    {{#se caminho}}…{{/se}}               só aparece se o valor existir e não estiver vazio (dados.*, obra.factos.*);
                                          blocos dentro de blocos: {{#se dados.a}}{{#se dados.b}}…{{/se}}{{/se}} = «a e b»;
                                          para «a ou b» há chaves calculadas em DADOS_OU (ex.: {{#se dados.precosAC}})
    {{#sem caminho}}…{{/sem}}             só aparece se o valor estiver vazio
    {{#cada caminho}}…{{/cada}}           repete o bloco por cada elemento da lista, com o elemento em {{ item }}

Pré-visualização: "preview": true em data/site.json pede aos motores de busca para não indexar
(meta robots noindex em todas as páginas, cabeçalho X-Robots-Tag em public/_headers, robots.txt Disallow).
No lançamento passa a false: ver README.md, "Lançamento".

Dados por preencher: data/dados-mdm.json. Um valor vazio esconde a frase, a linha ou a secção que o usa;
nunca se mostra um [PLACEHOLDER] e --check falha se algum chegar a public/.

Preço provável do formulário: data/precos.json (começa vazio; copiado à mão da folha da MDM), posto em data-precos no
bloco do formulário, como data-btu. --check valida a estrutura e os pares [mínimo, máximo]; --faltam diz se está vazio.
"""
import hashlib
import html
import json
import re
import shutil
import sys
from pathlib import Path
from urllib.parse import quote, unquote

ROOT = Path(__file__).resolve().parent
import os
SRC, DATA, ASSETS = ROOT / "src", ROOT / "data", ROOT / "assets"
# assistente de propostas da equipa (uso interno, fora do site): copiado tal como está para public/equipa/
EQUIPA = ROOT / "equipa"
# MDM_OUT permite gerar para outra pasta (por exemplo, várias verificações em paralelo)
OUT = Path(os.environ["MDM_OUT"]).resolve() if os.environ.get("MDM_OUT") else ROOT / "public"

SITE = json.loads((DATA / "site.json").read_text(encoding="utf-8"))
# marcas da faixa das certificações (site.json «marcas»): os campos que faltam ficam vazios, para o modelo poder
# perguntar {{#se item.logo}} / {{#se item.simbolo}}. Quando chegar o ficheiro de uma marca, basta juntar logo, w e h.
MARCA_CAMPOS = {"logo": "", "w": "", "h": "", "simbolo": "", "escala": 1}
SITE["marcas"] = [dict(MARCA_CAMPOS, **m) for m in SITE.get("marcas", [])]
OBRAS_DATA = json.loads((DATA / "obras.json").read_text(encoding="utf-8"))
OBRAS = OBRAS_DATA["obras"]
OBRA_BY_N = {o["n"]: o for o in OBRAS}
# serviço de cada obra (filtros de obras.html, ligação da ficha, obras relacionadas), a partir da «especialidade»;
# o que não é um dos cinco serviços (Climatização, Águas quentes) fica em «outros», sem página de serviço
SERV = {"Ar condicionado": "ar-condicionado", "Ar condicionado e ventilação": "ar-condicionado", "Ventilação": "ventilacao",
        "Manutenção": "manutencao", "Eletricidade": "eletricidade", "Bombas de calor": "bombas-de-calor"}
SERV_LABEL = {"ar-condicionado": "Ar condicionado", "ventilacao": "Ventilação", "manutencao": "Manutenção e avarias",
              "eletricidade": "Eletricidade", "bombas-de-calor": "Bombas de calor"}
# trabalhos de avaria: a faixa da página da obra convida a enviar a fotografia da avaria, não a pedir uma obra igual
TRABALHO_AVARIA = {"Reparação", "Diagnóstico"}
# sizes da fotografia grande da página da obra: cabe em 78% da altura do ecrã, nunca mais larga do que o ecrã
FOTO_OBRA_SIZES = {"landscape": "(min-width: 1280px) min(1280px, calc(78vh * 4 / 3)), min(100vw, calc(78vh * 4 / 3))",
                   "portrait": "min(100vw, calc(78vh * 3 / 4))"}


def campos_obra(o):
    """Campos calculados de cada obra (modelo obra.html e cartões). As páginas das obras vivem em obras/: root «../»."""
    serv = SERV.get(o["especialidade"], "outros")
    label = SERV_LABEL.get(serv, "")
    o["serv"], o["servLabel"] = serv, label
    o["servicoUrl"] = f"servicos/{serv}.html" if label else ""
    o["orcamentoHref"] = f"../{o['servicoUrl']}#orcamento" if label else "../index.html#orcamento"
    avaria = o["trabalho"] in TRABALHO_AVARIA
    o["ctaTitulo"] = "Tem uma avaria parecida?" if avaria else "Quer uma obra assim?"
    msg = (f"Olá MDM. Vi a obra {o['code']} no site ({o['title']}) e tenho uma avaria parecida. Envio já uma fotografia."
           if avaria else f"Olá MDM. Vi a obra {o['code']} no site ({o['title']}) e quero um orçamento parecido.")
    o["waHref"] = SITE["whatsappBase"] + quote(msg)
    o["relTitulo"] = f"Outras obras de {label.lower()}" if label else "Outras obras"
    o["relLigacao"] = f"Todas as obras de {label.lower()}" if label else "Todas as obras"
    o["relHref"] = f"obras.html#{serv}" if label else "obras.html"
    o["fotoSizes"] = FOTO_OBRA_SIZES[o["orient"]]


for _o in OBRAS:
    campos_obra(_o)
# obras por serviço (contagens dos filtros de obras.html; «todas» é o total)
SERV_N = {**{s: sum(1 for o in OBRAS if o["serv"] == s) for s in SERV_LABEL}, "todas": len(OBRAS)}


def relacionadas(o, n=3):
    """Sempre n obras: primeiro as do mesmo serviço (pela ordem do ficheiro, sem a própria), depois o mesmo local, depois as outras."""
    out = []
    for chave in (lambda x: x["serv"] == o["serv"], lambda x: x["cat"] == o["cat"], lambda x: True):
        out += [x for x in OBRAS if x is not o and x not in out and chave(x)]
    return out[:n]
# prévias de 16 px das fotografias (gerar_fotos.py): ficam por trás da fotografia enquanto descarrega; sem o ficheiro, nada
LQIP = json.loads((DATA / "lqip.json").read_text(encoding="utf-8")) if (DATA / "lqip.json").exists() else {}
DADOS_DOC = json.loads((DATA / "dados-mdm.json").read_text(encoding="utf-8"))
DADOS = {k: v["valor"] for k, v in DADOS_DOC.items() if not k.startswith("_")}
# testemunhos: "tipo" é opcional (sem ele, só o nome); texto e nome em falta são erro de --check, não do modelo
for _t in DADOS.get("testemunhos") or []:
    if isinstance(_t, dict):
        for _c in ("texto", "nome", "tipo"):
            _t.setdefault(_c, "")
# números e preços não partem ao fim da linha («1 200», «desde 300 €»): o espaço entre grupos de algarismos e o espaço antes
# de «€» passam a espaço inseparável (U+00A0) no que se mostra; dados-mdm.json fica como a MDM o escreveu
NBSP_RE = re.compile(r"(?<=\d) (?=\d{3}(?!\d)|€)")
for _k, _v in DADOS.items():
    if isinstance(_v, str):
        DADOS[_k] = NBSP_RE.sub("\u00a0", _v)
DADOS_USO = {}   # chave de dados-mdm.json → páginas onde entra (para --faltam)

# Preço provável do formulário (data/precos.json): valores copiados à mão da folha «MDM, tabela de preços para o site».
# Cada preço é null ou [mínimo, máximo] em euros inteiros com IVA; vazio = não aparece. O site.js lê-os em data-precos
# (como data-btu) e só mostra um produto com a sua linha e a sua frase de «inclui» preenchidas. check_precos() valida.
PRECOS_FOLHA = "«MDM, tabela de preços para o site»"
PRECOS_GAMAS = ("eco", "sup")
PRECOS_EXTRAS = ("metrosIncluidos", "metroExtra", "preInstalacaoDesconto", "furoBetao", "alturaEscada", "alturaAndaime",
                 "alturaPlataforma", "ligacaoEletrica", "retirarAntiga")
PRECOS_INCLUI = ("split", "multisplit", "aguasQuentes")
if not (DATA / "precos.json").exists():
    raise SystemExit("build.py: falta data/precos.json (preço provável do formulário; ver README.md, «Preço provável»)")
PRECOS_DOC = json.loads((DATA / "precos.json").read_text(encoding="utf-8"))


def precos_linhas():
    """Linhas de cada tabela de preços: os tamanhos do split são os de btu.tamanhos (site.json), em texto («12000»)."""
    tam = (SITE.get("btu") or {}).get("tamanhos") or []
    return {"split": [str(int(t)) if isinstance(t, (int, float)) and t == int(t) else str(t) for t in tam],
            "multisplit": ["2", "3", "4", "acrescimoGrande"], "aguasQuentes": ["200", "300"]}


# o que vai para a página (sem as chaves «_»); «}}» passa a «} }» (o mesmo JSON), para não parecer sintaxe de modelo
PRECOS_ATTR = re.sub(r"\}(?=\})", "} ", json.dumps(
    {k: v for k, v in PRECOS_DOC.items() if not k.startswith("_")} if isinstance(PRECOS_DOC, dict) else {},
    ensure_ascii=False))
# campos de "factos" de cada obra em obras.json: vazios, a linha não aparece na ficha
FACTOS_OBRA = {"data": "Data da obra", "localExato": "Local exato (bairro ou concelho, sem nome do cliente)",
               "cliente": "Tipo de cliente", "duracao": "Duração",
               "resultado": "Resultado da obra numa frase (ficha da obra e diapositivo da página inicial)"}

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


# lado maior de cada tamanho das fotografias das obras (foto-NN-400.avif … foto-NN-1600.avif, e .webp);
# o JPEG de 1600 é o original e a reserva para browsers antigos. gerar_fotos.py faz os ficheiros.
FOTO_LADOS = (400, 600, 800, 1000, 1200, 1600)
# telemóvel com ecrã de 3x: pede-se a imagem de 2x, como no topo da página inicial (à vista é igual e pesa
# metade). Vai antes do sizes de cada fotografia; o último valor do sizes é sempre o dos ecrãs estreitos.
FOTO_3X = "(max-width: 599px) and (min-resolution: 2.5dppx)"


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
    o = OBRA_BY_N[n]
    root = ctx["root"]
    base = f"{root}assets/img/obras/foto-{n}"
    w, h = (1600, 1200) if o["orient"] == "landscape" else (1200, 1600)
    alt = attrs.get("alt", o["alt"])
    sizes = attrs.get("sizes", "100vw")
    estreito = ultima_entrada(sizes)
    sizes = f"{FOTO_3X} calc({estreito} * 2 / 3), {sizes}"
    loading = attrs.get("loading", "lazy")
    cls = ("foto " + attrs.get("class", "")).strip()
    # "foco" em obras.json: o ponto da fotografia que fica à vista quando o cartão a corta (object-position)
    foco = f' style="object-position: {o["foco"]}"' if o.get("foco") else ""
    previa = f' style="--lqip: url({LQIP[n]}){"; --lqip-pos: " + o["foco"] if o.get("foco") else ""}"' if n in LQIP else ""
    # eager leva fetchpriority="high", salvo prioridade="normal" (imagens no primeiro ecrã que não são a principal)
    extra = ' fetchpriority="high"' if loading == "eager" and attrs.get("prioridade") != "normal" else ""

    def srcset(ext):
        return ", ".join(f"{base}-{lado}.{ext} {w * lado // 1600}w" for lado in FOTO_LADOS)
    return (
        f'<picture class="{cls}"{previa}>'
        + f'<source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
        + f'<source type="image/webp" srcset="{srcset("webp")}" sizes="{sizes}">'
        + f'<img src="{base}-1600.jpg" alt="{html.escape(alt, quote=True)}" width="{w}" height="{h}"{foco} '
        + f'loading="{loading}" decoding="async"{extra}></picture>'
    )


def wa(ctx, key):
    return SITE["whatsappBase"] + quote(SITE["wa"][key])


def each(ctx, args):
    name, sel = args.split(None, 1)
    sel = sel.strip()
    # " eagerN": as N primeiras imagens não esperam (ex.: eager1 na grelha de obras.html). No telemóvel só a
    # primeira cabe no primeiro ecrã e o lazy do browser já traz as seguintes, por isso N > 1 só pesa mais;
    # só a primeira, a maior candidata a LCP, leva fetchpriority="high"
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
    elif sel.startswith("registo="):
        items = [o for o in OBRAS if o["registo"] == sel[8:]]
    else:
        items = [OBRA_BY_N[x.strip().zfill(2)] for x in sel.split(",")]
    tpl = (SRC / "partials" / f"{name}.html").read_text(encoding="utf-8")
    # tamanho dos cartões de obra na grelha (sizes da imagem); uma página com outra grelha muda-o no <!--meta-->
    sizes = ctx["page"].get("cartaoSizes") or ("(min-width: 1200px) min(calc(22.25vw - 18px), 302px), "
                                               "(min-width: 900px) calc(29.67vw - 16px), (min-width: 640px) calc(44.5vw - 12px), 89vw")
    out = []
    for i, o in enumerate(items):
        c = dict(ctx, obra=o, index=i, pos=i + 1, total=len(items), cartaoSizes=sizes,
                 loading="eager" if i < eager else "lazy", prioridade="alta" if i == 0 and eager else "normal")
        out.append(render(tpl, c))
    return "".join(out)


ABRE_RE = re.compile(r"\{\{#(se|sem|cada)\s+([\w.]+)\s*\}\}")


def tem(v):
    return bool(v.strip()) if isinstance(v, str) else bool(v)


# Chaves calculadas «a ou b»: uma linha ou um bloco que junta vários dados opcionais aparece se pelo menos um estiver
# preenchido; lá dentro, cada dado continua com o seu {{#se}}. Não se preenchem (não estão em dados-mdm.json) e não entram
# em --faltam: o que entra são os dados de que dependem. «a e b» não precisa de chave: blocos {{#se}} um dentro do outro.
DADOS_OU = {"precosAC": ("precoSplit", "precoMultisplit"),              # «Preço indicativo» no cartão Ar condicionado
            "precosManutencao": ("precoContrato", "precoDiagnostico"),  # «Preço indicativo» no cartão Manutenção
            "garantias": ("garantiaInstalacao", "seguroRC")}           # garantia e seguro nas certificações
for _k, _ks in DADOS_OU.items():
    if _k in DADOS or not all(x in DADOS for x in _ks):
        raise SystemExit(f"build.py, DADOS_OU «{_k}»: o nome já existe em data/dados-mdm.json ou falta lá um de {_ks}")
    DADOS[_k] = any(tem(DADOS[x]) for x in _ks)


def valor(ctx, caminho):
    """Valor de um bloco {{#se}}/{{#sem}}/{{#cada}}. Um caminho que não existe é erro (gralha), não "vazio"."""
    if caminho.startswith("dados."):
        chave = caminho.split(".")[1]
        if chave not in DADOS:
            raise KeyError(f"{caminho}: não existe em data/dados-mdm.json ({ctx.get('_file', '?')})")
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
        else:   # bloco escondido: os dados lá dentro também entram na lista de --faltam (e uma gralha é erro)
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


# os concelhos à volta de Lisboa ainda não foram confirmados pelo dono: fica "Grande Lisboa"
AREA_LD = [{"@type": "City", "name": "Lisboa"}, {"@type": "AdministrativeArea", "name": "Grande Lisboa"}]
PREVIEW = bool(SITE.get("preview"))
# imagem de partilha (og-mdm.jpg): logótipo, frase, telefone e o camião com a matrícula desfocada
OG_IMG = {"src": "og-mdm.jpg", "w": 1200, "h": 630,
          "alt": f"MDM Assistência Técnica. Clima, ar e corrente. Desde {SITE['founded']}. Telefone {SITE['phone']}."}


def business_ld():
    """A empresa, igual em todas as páginas (Google: ficha da empresa, painel de conhecimento)."""
    b = SITE["baseUrl"]
    cp, cidade = SITE["address2"].split(" ", 1)[0], SITE["address2"].split(" ", 1)[1].split(" · ")[0]
    return {
        "@context": "https://schema.org",
        "@type": ["HVACBusiness", "Electrician"],
        "@id": b + "/#mdm",
        "name": SITE["name"],
        "legalName": SITE["legalName"],
        "vatID": SITE["vatID"],
        "taxID": SITE["nif"].replace(" ", ""),
        "url": b + "/",
        "logo": b + "/assets/img/logo-mdm.svg",
        "image": [b + "/assets/img/" + OG_IMG["src"], b + "/assets/img/hero/mdm-plataforma-1200.jpg"],
        "slogan": f"Clima, ar e corrente. Desde {SITE['founded']}.",
        "telephone": SITE["phoneE164"],
        "email": SITE["email"],
        "foundingDate": SITE["founded"],
        "address": {"@type": "PostalAddress", "streetAddress": SITE["address1"],
                    "postalCode": cp, "addressLocality": cidade, "addressCountry": "PT"},
        "areaServed": AREA_LD,
        "openingHoursSpecification": [{"@type": "OpeningHoursSpecification",
                                       "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                                       "opens": "08:00", "closes": "17:00"}],
        "hasMap": SITE["googleMaps"],
        "sameAs": [SITE["googleMaps"]],
        "knowsAbout": ["Ar condicionado", "Multi-split", "Bombas de calor ar-água", "Manutenção AVAC",
                       "Instalações elétricas", "Ventilação"],
    }


def servico_ld(meta):
    """Service de cada página de serviço: "servico" no <!--meta--> (nome, tipo e ofertas, só o que a página diz)."""
    s = meta["servico"]
    ld = {"@context": "https://schema.org", "@type": "Service", "name": s["nome"], "serviceType": s["tipo"],
          "description": meta["description"], "url": SITE["baseUrl"] + "/" + meta["file"], "areaServed": AREA_LD,
          "provider": {"@type": ["HVACBusiness", "Electrician"], "@id": SITE["baseUrl"] + "/#mdm",
                       "name": SITE["name"], "url": SITE["baseUrl"] + "/", "telephone": SITE["phoneE164"]}}
    if s.get("ofertas"):
        ld["hasOfferCatalog"] = {"@type": "OfferCatalog", "name": s["nome"], "itemListElement": [
            {"@type": "Offer", "itemOffered": {"@type": "Service", "name": n}} for n in s["ofertas"]]}
    return ld


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
    # wa: mensagem de WhatsApp da barra do telemóvel, do rodapé e do contacto (site.wa.*); cada serviço usa a sua
    meta = {"preselect": "", "nav": "", "robots": "index,follow", "og": "", "wa": "geral", **meta}
    if PREVIEW and "noindex" not in meta["robots"]:
        meta["robots"] = "noindex"   # pré-visualização: nenhuma página entra no Google antes do lançamento
    depth = file.count("/")
    # a 404 é servida em qualquer profundidade (/obras/xyz.html): precisa de caminhos absolutos
    root = "/" if file == "404.html" else "../" * depth
    return {"site": SITE, "page": meta, "root": root, "_file": file, "dados": DADOS, "precos": PRECOS_ATTR,
            "categorias": OBRAS_DATA["categorias"], "serv_n": SERV_N, "year": "2026"}


def build_page(meta, body_tpl, extra_ctx=None):
    file = meta["file"]
    ctx = page_ctx(meta, file)
    if extra_ctx:
        ctx.update(extra_ctx)
    body = render(body_tpl, ctx)
    lds = [business_ld()]
    for kind in meta.get("jsonld", []):
        if kind == "faq":
            f = faq_ld(body)
            if f:
                lds.append(f)
        elif kind == "breadcrumb":
            lds.append(breadcrumb_ld(meta["breadcrumb"]))
        elif kind == "servico":
            lds.append(servico_ld(meta))
    ld_html = "".join(
        '<script type="application/ld+json">' + json.dumps(x, ensure_ascii=False).replace("</", "<\\/") + "</script>\n"
        for x in lds)
    css = "".join(f'<link rel="stylesheet" href="{ctx["root"]}assets/css/{c}">\n' for c in meta.get("css", []))
    og = meta.get("og") or ""
    if og:   # fotografia de uma obra: foto-NN-1600.jpg
        o = OBRA_BY_N[re.match(r"foto-(\d+)-", og).group(1)]
        w, h = (1600, 1200) if o["orient"] == "landscape" else (1200, 1600)
        og_img = {"src": "obras/" + og, "w": w, "h": h, "alt": o["alt"]}
    else:
        og_img = OG_IMG
    ctx.update({"og_image": SITE["baseUrl"] + "/assets/img/" + og_img["src"],
                "og_w": og_img["w"], "og_h": og_img["h"], "og_alt": og_img["alt"],
                "content": body, "jsonld": ld_html, "page_css": css,
                "canonical": SITE["baseUrl"] + "/" + ("" if file == "index.html" else file)})
    layout = (SRC / "templates" / "layout.html").read_text(encoding="utf-8")
    out = versiona(render(layout, ctx))
    dest = OUT / file
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out, encoding="utf-8")
    return file


# Cache: CSS e JS levam ?v=<8 hex do sha1 do ficheiro> (site.css do layout, o CSS de cada página e site.js); com o nome
# igual e o conteúdo novo, o browser e o Netlify (netlify.toml: um ano, immutable) vão buscar a versão nova.
# --check ignora o ?… ao resolver a referência (REF_RE para em ? e #).
VERSAO_RE = re.compile(r'((?:href|src)="(?:[^"?]*/)?assets/(?:css|js)/)([^"?]+)"')
_VERSOES = {}


def versao(nome):
    if nome not in _VERSOES:
        _VERSOES[nome] = hashlib.sha1((ASSETS / nome).read_bytes()).hexdigest()[:8]
    return _VERSOES[nome]


def versiona(texto):
    return VERSAO_RE.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={versao(m.group(1).split("assets/", 1)[1] + m.group(2))}"', texto)


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(ASSETS, OUT / "assets")
    if EQUIPA.exists():
        shutil.copytree(EQUIPA, OUT / "equipa")
    files, fora_do_mapa = [], set()
    for p in sorted((SRC / "pages").rglob("*.html")):
        text = p.read_text(encoding="utf-8")
        m = META_RE.match(text)
        if not m:
            raise SystemExit(f"{p}: falta o bloco <!--meta {{...}} -->")
        meta = json.loads(m.group(1))
        files.append(build_page(meta, text[m.end():]))
        if "noindex" in meta.get("robots", ""):
            fora_do_mapa.add(meta["file"])   # 404 e página de agradecimento
    obra_tpl_path = SRC / "templates" / "obra.html"
    if obra_tpl_path.exists():
        tpl = obra_tpl_path.read_text(encoding="utf-8")
        for i, o in enumerate(OBRAS):
            prev_o, next_o = OBRAS[i - 1], OBRAS[(i + 1) % len(OBRAS)]
            file = f"obras/{o['slug']}.html"
            meta = {"file": file, "nav": "obras", "css": ["pag-obras.css"],
                    "title": f"{o['title']}: {o['especialidade'].lower()} · Obras MDM Lisboa",
                    "description": f"{o['title']}: {o['especialidade'].lower()}, {o['trabalho'].lower()}, {o['equipamento']}. "
                                   f"Obra da MDM na grande Lisboa, fotografada no local pelos técnicos.",
                    "og": f"foto-{o['n']}-1600.jpg",
                    "jsonld": ["breadcrumb"],
                    "breadcrumb": [["Início", ""], ["Obras", "obras.html"], [o["title"], file]]}
            files.append(build_page(meta, tpl, {"obra": o, "prev": prev_o, "next": next_o, "related": relacionadas(o)}))
    urls = "".join(f"<url><loc>{SITE['baseUrl']}/{'' if f == 'index.html' else f}</loc></url>\n"
                   for f in files if f not in fora_do_mapa)
    (OUT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + urls + "</urlset>\n", encoding="utf-8")
    if PREVIEW:
        # Netlify lê public/_headers e junta-o aos [[headers]] do netlify.toml (que não aceita condições)
        (OUT / "robots.txt").write_text("# Pré-visualização: não indexar. No lançamento, \"preview\": false em data/site.json.\n"
                                        "User-agent: *\nDisallow: /\n", encoding="utf-8")
        (OUT / "_headers").write_text("# Pré-visualização: gerado por build.py a partir de \"preview\" em data/site.json\n"
                                      "/*\n  X-Robots-Tag: noindex\n", encoding="utf-8")
    else:
        (OUT / "robots.txt").write_text(f"User-agent: *\nDisallow: /equipa/\nAllow: /\nSitemap: {SITE['baseUrl']}/sitemap.xml\n",
                                        encoding="utf-8")
    return files


# o que sobra de um dado por preencher: [MAIÚSCULAS…], [[CHAVE]], "por preencher", "lorem ipsum" (comentários HTML à parte).
# Não contam as etiquetas de triagem ([P1 · Montagem AC], só no campo escondido e no assunto do email, postas por site.js).
PLACEHOLDER_RE = re.compile(r"\[(?!P\d ·)[^\[\]<>\"']*?[A-ZÀ-Ý]{3}[^\[\]<>\"']*\]|\[\[[^\]]*\]\]"
                            r"|(?i:\b(?:por preencher|lorem ipsum)\b)")
# Decisões do dono (AUDIT.md da v3, 27/09/2026): nada disto volta ao site, nem em meta, JSON-LD ou mensagens de WhatsApp.
PRAZO = (re.compile(r"\b\d+\s*(?:h|horas)\s+úteis|\b(?:24|48)\s*(?:h|horas)\b|\b\d+\s*(?:a|–|-)\s*\d+\s*(?:h|horas)\b"
                    r"|mesmo dia|\b\d+\s*minutos\b", re.I),
         "promessa de prazo de resposta (retiradas pelo dono)")
# a assinatura da France Air: o dono pediu para a tirar (o nome e, quando chegar, o logótipo sem ela)
ARQUITECTOS_RE = re.compile(r"Arquitec?tos\s+do\s+Ar", re.I)
PROIBIDO = [
    PRAZO,
    (re.compile(r"\b[34]\d\s+anos\b"), "idade da empresa: só «1991», nunca «N anos»"),
    (re.compile(r"\b(?:LG|Hitachi|Vulcano|Panasonic|Climaveneta)\b"),
     "marca fora da lista do dono (Midea, Mitsubishi Electric, Daikin, France Air)"),
    (re.compile(r"Domingues|M\.D\.M\.\s*[—–]"), "nome legal: «M.D.M. - Manuel Domingos Melancia, Lda»"),
    (ARQUITECTOS_RE,
     "assinatura da France Air («Os Arquitectos do Ar»): o dono não a quer no site, só o nome ou o logótipo"),
]
REF_RE = re.compile(r'(?:href|src|action)="([^"#?]+)|srcset="([^"]+)"|url\(([^)]+)\)')
# Netlify Forms: o formulário de orçamento tem de chegar ao HTML gerado com o nome, os campos escondidos,
# a armadilha para robôs e o campo da fotografia, e ser igual em todas as páginas (o Netlify regista um só "orcamento").
FORM_RE = re.compile(r'<form\b[^>]*\bid="quoteForm"[^>]*>.*?</form>', re.S)
FORM_EXIGE = [' name="orcamento"', ' method="POST"', ' data-netlify="true"', ' netlify-honeypot="bot-field"',
              ' enctype="multipart/form-data"', ' action="/obrigado.html"']
FORM_CAMPOS = {"form-name", "subject", "pagina", "triagem", "potencia", "estimativa", "nome", "email", "telefone", "servico",
               "mensagem", "fotografia", "bot-field"}


# Durações dadas pela MDM (quanto tempo leva o trabalho, de quanto em quanto tempo se faz a visita): são factos,
# não prazos de resposta. A regra dos prazos não as lê no site (as outras regras sim); check_duracoes() vê-as à parte.
DURACOES = {**{f"dados-mdm.json «{k}»": DADOS.get(k, "")
               for k in ("duracaoMontagem", "periodicidadeVisitas", "periodicidadeVentilacao")},
            **{f"obras.json «factos.duracao» da obra {o['n']}": o.get("factos", {}).get("duracao", "") for o in OBRAS}}
# uma duração que fala em responder, chegar ou atender é um prazo de resposta disfarçado
RESPOSTA_RE = re.compile(r"\b(?:respo\w*|cheg\w*|atend\w*|desloc\w*|urgênc\w*)", re.I)


def sem_duracoes(t):
    for v in DURACOES.values():
        if not isinstance(v, str) or not v.strip():
            continue
        for forma in {v, re.sub(r"\s+", " ", v).strip(), json.dumps(v, ensure_ascii=False)[1:-1]}:
            t = t.replace(forma, " ")
    return t


def check_duracoes():
    return [f"{onde}: {PRAZO[1]} → «{v}»" for onde, v in DURACOES.items()
            if isinstance(v, str) and PRAZO[0].search(v) and RESPOSTA_RE.search(v)]


def texto_proibido(nome, text):
    """Placeholders e frases retiradas pelo dono, também dentro de ligações (WhatsApp), meta e JSON-LD."""
    t = unquote(html.unescape(re.sub(r"<!--.*?-->", "", text, flags=re.S)))
    out = [f"{nome}: placeholder visível → {m}" for m in sorted(set(PLACEHOLDER_RE.findall(t)))]
    for rx, porque in PROIBIDO:
        alvo = sem_duracoes(t) if (rx, porque) == PRAZO else t
        out += [f"{nome}: {porque} → «{m}»" for m in sorted(set(rx.findall(alvo)))]
    return out


def check_testemunhos():
    return [f"dados-mdm.json «testemunhos» n.º {i}: falta o texto ou o nome (o tipo é opcional)"
            for i, t in enumerate(DADOS.get("testemunhos") or [], 1)
            if not isinstance(t, dict) or not tem(t.get("texto", "")) or not tem(t.get("nome", ""))]


# Formato dos dados que entram na página inicial como número, nota ou preço: um engano (um número JSON em vez de texto, um
# ponto em vez da vírgula, um preço sem «€», uma frase sem ponto final) aparecia tal e qual no site, sem aviso.
NUM = r"\d{1,3}(?:[ \u00a0\u202f]?\d{3})*"   # 1200, 1 200 (espaço normal, inseparável ou fino)
FORMATOS = {
    "googleNota": (r"(?:[1-4],\d|5,0)", "um algarismo, vírgula e uma casa decimal, de 1,0 a 5,0, sem estrelas"),
    "googleAvaliacoes": (NUM, "só o número, sem pontos"),
    "contratosAtivos": (NUM, "só o número, sem pontos"),
    "unidadesAno": (rf"(?:(?:Cerca|Mais) de )?{NUM}", "só o número, ou «Cerca de …» / «Mais de …», com maiúscula"),
    **{k: (r".*\d.*€.*", "com o número e «€», no formato «desde … €»")
       for k in ("precoSplit", "precoMultisplit", "precoContrato", "precoDiagnostico")},
    **{k: (r".*[.!?]", "uma frase completa, com ponto final") for k in ("garantiaInstalacao", "seguroRC")},
    "concelhos": (r".+", "uma frase ou uma lista separada por vírgulas"),
}


def check_formatos():
    out = []
    for k, (rx, como) in FORMATOS.items():
        v = DADOS_DOC.get(k, {}).get("valor", "")
        if not isinstance(v, str):
            out.append(f"dados-mdm.json «{k}»: tem de ser texto, entre aspas ({como}) → {json.dumps(v, ensure_ascii=False)}")
        elif tem(v) and not re.fullmatch(rx, v.strip(), re.S):
            out.append(f"dados-mdm.json «{k}»: {como} → «{v}»")
    nota, aval = (DADOS_DOC.get(k, {}).get("valor", "") for k in ("googleNota", "googleAvaliacoes"))
    if isinstance(aval, str) and re.fullmatch(NUM, aval.strip()) and int(re.sub(r"\D", "", aval)) < 2:
        out.append(f"dados-mdm.json «googleAvaliacoes»: com uma só avaliação a página diria «1 avaliações»; publicar a partir de 2 → «{aval}»")
    if tem(nota) != tem(aval):
        out.append("dados-mdm.json «googleNota» preenchida sem «googleAvaliacoes» (ou vice-versa): a nota do Google só aparece no site com as duas")
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
    problems += check_preview()
    problems += check_duracoes() + check_testemunhos() + check_formatos() + check_btu() + check_precos() + check_marcas() + check_equipa()
    for css in (OUT / "assets" / "css").glob("*.css"):
        for c in re.findall(r"url\(([^)]+)\)", css.read_text(encoding="utf-8")):
            c = c.strip("'\"")
            if c.startswith("data:"):
                continue
            if not (css.parent / c).resolve().exists():
                problems.append(f"{css.name}: url partido → {c}")
    # o que o visitante lê também vem dos scripts (mensagens do formulário)
    for extra in sorted((OUT / "assets" / "js").glob("*.js")):
        problems += texto_proibido(str(extra.relative_to(OUT)), extra.read_text(encoding="utf-8"))
    print(f"{len(files)} páginas geradas em {OUT}")
    if PREVIEW:
        print("Pré-visualização: noindex em todas as páginas. No lançamento: \"preview\": false em data/site.json (README.md).")
    n = sum(1 for _ in em_falta())
    if n:
        print(f"\n{n} dados por preencher pela MDM, escondidos no site até lá: python3 website/build.py --faltam")
    if problems:
        print("\nPROBLEMAS:")
        for p in problems:
            print("  " + p)
        return 1
    print("\nSem ligações ou recursos partidos.")
    return 0


LD_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def check_cabeca(f, text):
    """JSON-LD válido e com a empresa; robots de acordo com o modo; endereços absolutos que existem em public/."""
    out = []
    tipos = []
    for bloco in LD_RE.findall(text):
        try:
            tipos.append(json.loads(bloco).get("@type"))
        except json.JSONDecodeError as e:
            out.append(f"{f}: JSON-LD inválido ({e})")
    if ["HVACBusiness", "Electrician"] not in tipos:
        out.append(f"{f}: falta o JSON-LD da empresa")
    robots = re.search(r'<meta name="robots" content="([^"]*)"', text)
    if PREVIEW and not (robots and "noindex" in robots.group(1)):
        out.append(f"{f}: pré-visualização sem <meta name=\"robots\" content=\"noindex\">")
    base = SITE["baseUrl"] + "/"
    for prop in ("og:image", "og:url"):
        m = re.search(r'<meta property="%s" content="([^"]*)"' % prop, text)
        if not (m and m.group(1).startswith(base)):
            out.append(f"{f}: {prop} fora de {base}")
        elif prop == "og:image" and not (OUT / m.group(1)[len(base):]).exists():
            out.append(f"{f}: og:image não existe → {m.group(1)}")
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
    if not re.search(r'<input[^>]*name="fotografia"[^>]*type="file"[^>]*accept="image/\*"', form):
        out.append(f"{f}: falta o campo da fotografia (type=file, accept=image/*)")
    if not re.search(r'<input type="hidden" name="potencia" value=""', form):
        out.append(f"{f}: falta o campo escondido potencia (vazio; site.js põe lá a estimativa de potência)")
    if "data-btu=" not in form:
        out.append(f"{f}: falta a estimativa de potência (data-btu) no formulário")
    if not re.search(r'<input type="hidden" name="estimativa" value=""', form):
        out.append(f"{f}: falta o campo escondido estimativa (vazio; site.js põe lá o preço provável mostrado)")
    if "data-precos=" not in form:
        out.append(f"{f}: falta o preço provável (data-precos) no formulário")
    return out


def check_precos(p=None, nome="precos.json"):
    """data/precos.json (e a tabela de teste do assistente, precos-teste.json): a estrutura de sempre, preços null ou
    [mínimo, máximo] inteiros, e os tamanhos de btu.tamanhos."""
    p, out = (PRECOS_DOC if p is None else p), []
    if not isinstance(p, dict):
        return [f"{nome}: tem de ser um objeto JSON, como o modelo do README"]
    esperado = {"split", "multisplit", "extras", "aguasQuentes", "inclui"}
    chaves = {k for k in p if not k.startswith("_")}
    if chaves != esperado:
        out.append(f"{nome}: chaves diferentes do esperado → a mais {sorted(chaves - esperado)}, em falta {sorted(esperado - chaves)}")

    def par(v, onde):
        if v is None:
            return
        if not (isinstance(v, list) and len(v) == 2 and all(isinstance(x, int) and not isinstance(x, bool) and x >= 0 for x in v)):
            out.append(f"{nome} «{onde}»: null ou [mínimo, máximo] em euros inteiros, sem aspas → {json.dumps(v, ensure_ascii=False)}")
        elif v[0] > v[1]:
            out.append(f"{nome} «{onde}»: o mínimo é maior do que o máximo → {json.dumps(v)}")

    for sec, linhas in precos_linhas().items():
        s = p.get(sec)
        if not isinstance(s, dict):
            out.append(f"{nome} «{sec}»: falta, ou não é um objeto com as linhas {linhas}")
            continue
        if set(s) != set(linhas):
            porque = " (as linhas do split são os tamanhos de «btu.tamanhos» em site.json)" if sec == "split" else ""
            out.append(f"{nome} «{sec}»: linhas diferentes do esperado{porque} → a mais {sorted(set(s) - set(linhas))}, "
                       f"em falta {sorted(set(linhas) - set(s))}")
        for k in linhas:
            if k not in s:
                continue
            l = s[k]
            if not (isinstance(l, dict) and set(l) == set(PRECOS_GAMAS)):
                out.append(f'{nome} «{sec}.{k}»: tem de ser {{"eco": …, "sup": …}} → {json.dumps(l, ensure_ascii=False)}')
                continue
            for g in PRECOS_GAMAS:
                par(l[g], f"{sec}.{k}.{g}")
    ex = p.get("extras")
    if not isinstance(ex, dict):
        out.append(f"{nome} «extras»: falta, ou não é um objeto com {list(PRECOS_EXTRAS)}")
    else:
        if set(ex) != set(PRECOS_EXTRAS):
            out.append(f"{nome} «extras»: chaves diferentes do esperado → a mais {sorted(set(ex) - set(PRECOS_EXTRAS))}, "
                       f"em falta {sorted(set(PRECOS_EXTRAS) - set(ex))}")
        m = ex.get("metrosIncluidos")
        if m is not None and not (isinstance(m, int) and not isinstance(m, bool) and m >= 0):
            out.append(f"{nome} «extras.metrosIncluidos»: null ou um número inteiro de metros, sem aspas → {json.dumps(m, ensure_ascii=False)}")
        for k in PRECOS_EXTRAS[1:]:
            if k in ex:
                par(ex[k], f"extras.{k}")
    inc = p.get("inclui")
    if not (isinstance(inc, dict) and set(inc) == set(PRECOS_INCLUI)):
        out.append(f"{nome} «inclui»: tem de ter as frases {list(PRECOS_INCLUI)} (texto; vazio = o produto não aparece)")
    else:
        for k, v in inc.items():
            if not isinstance(v, str):
                out.append(f"{nome} «inclui.{k}»: tem de ser texto, entre aspas → {json.dumps(v, ensure_ascii=False)}")
            elif re.search(r"[{}<>]", v):
                out.append(f"{nome} «inclui.{k}»: sem chavetas nem < > → «{v}»")
    return out


def check_equipa():
    """Assistente de propostas (equipa/, uso interno): a tabela de teste com a estrutura de precos.json, as regras de
    texto do dono nas páginas e nos scripts, as ligações, e o noindex."""
    out = []
    teste = DATA / "precos-teste.json"
    if teste.exists():
        try:
            out += check_precos(json.loads(teste.read_text(encoding="utf-8")), "precos-teste.json")
        except json.JSONDecodeError as e:
            out.append(f"precos-teste.json: JSON inválido → {e}")
    for f in sorted((OUT / "equipa").glob("*")) if (OUT / "equipa").exists() else []:
        nome = str(f.relative_to(OUT))
        text = f.read_text(encoding="utf-8")
        out += texto_proibido(nome, text)
        if f.suffix == ".html":
            if 'name="robots" content="noindex' not in text:
                out.append(f"{nome}: falta <meta name=\"robots\" content=\"noindex, nofollow\"> (página interna)")
            for a, b, c in REF_RE.findall(text):
                r = a or c.strip("'\"")
                if r and not re.match(r"^(https?:|mailto:|tel:|data:|//|/api/)", r):
                    alvo = (OUT / r.lstrip("/")) if r.startswith("/") else (f.parent / r).resolve()
                    if not alvo.exists():
                        out.append(f"{nome}: referência partida → {r}")
        if f.suffix == ".css":
            for c in re.findall(r"url\(([^)]+)\)", text):
                c = c.strip("'\"")
                if not c.startswith("data:") and not (f.parent / c).resolve().exists():
                    out.append(f"{nome}: url partido → {c}")
    return out


def precos_contagem():
    """(preenchidos, total) de data/precos.json, para --faltam: cada gama de cada linha, cada extra e cada frase."""
    p = PRECOS_DOC if isinstance(PRECOS_DOC, dict) else {}
    cheios = total = 0
    for sec, linhas in precos_linhas().items():
        s = p.get(sec) if isinstance(p.get(sec), dict) else {}
        for k in linhas:
            l = s.get(k) if isinstance(s.get(k), dict) else {}
            for g in PRECOS_GAMAS:
                total += 1
                cheios += l.get(g) is not None
    ex = p.get("extras") if isinstance(p.get("extras"), dict) else {}
    inc = p.get("inclui") if isinstance(p.get("inclui"), dict) else {}
    total += len(PRECOS_EXTRAS) + len(PRECOS_INCLUI)
    cheios += sum(ex.get(k) is not None for k in PRECOS_EXTRAS) + sum(tem(inc.get(k) or "") for k in PRECOS_INCLUI)
    return cheios, total


def check_btu():
    """Os números da estimativa de potência (site.json «btu»), que o dono pode mudar: todos positivos e coerentes."""
    b, out = SITE.get("btu"), []
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0
    if not isinstance(b, dict):
        return ["site.json: falta «btu» (estimativa de potência do formulário)"]
    for k in ("porM2", "sol", "ultimoAndar", "btuPorKw", "areaMin", "areaMax"):
        if not num(b.get(k)):
            out.append(f"site.json «btu.{k}»: tem de ser um número maior do que zero")
    m = b.get("maxDivisoes")   # um número de divisões: inteiro (2.5 ou 8.0 apareciam assim na página)
    if not (isinstance(m, int) and not isinstance(m, bool) and m >= 1):
        out.append("site.json «btu.maxDivisoes»: tem de ser um número inteiro, 1 ou mais")
    tipos = b.get("tipos")
    if not (isinstance(tipos, dict) and tipos and all(num(v) for v in tipos.values())):
        out.append("site.json «btu.tipos»: lista de tipos de divisão, cada um com um fator maior do que zero")
    t = b.get("tamanhos")
    if not (isinstance(t, list) and t and all(num(x) for x in t) and t == sorted(set(t))):
        out.append("site.json «btu.tamanhos»: tamanhos de aparelho em BTU/h, do mais pequeno para o maior, sem repetir")
    f = b.get("folga", 0)   # margem para não saltar de tamanho por pouco: 0 a 0,49
    if not (isinstance(f, (int, float)) and not isinstance(f, bool) and 0 <= f < 0.5):
        out.append("site.json «btu.folga»: margem entre 0 e 0,49 (0,1 = 10%)")
    if not out and b["areaMin"] >= b["areaMax"]:
        out.append("site.json «btu»: areaMin tem de ser menor do que areaMax")
    return out


VIEWBOX_RE = re.compile(r'<svg\b[^>]*\bviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"')


def check_marcas():
    """Faixa das marcas (site.json «marcas»): nome, ficheiros que existem, largura e altura do logótipo certas, escala."""
    out, marcas = [], SITE["marcas"]
    if not marcas:
        return ["site.json: falta «marcas» (faixa das certificações)"]
    inteiro = lambda v: isinstance(v, int) and not isinstance(v, bool) and v > 0
    for m in marcas:
        nome = m.get("nome")
        if not (isinstance(nome, str) and nome.strip()):
            out.append("site.json «marcas»: cada marca tem de ter «nome»")
            continue
        e = m["escala"]
        if not (isinstance(e, (int, float)) and not isinstance(e, bool) and 0.5 <= e <= 2):
            out.append(f"site.json «marcas» {nome}: «escala» é um número entre 0,5 e 2 (1 = altura normal)")
        for campo in ("logo", "simbolo"):
            if m[campo] and not (ROOT / m[campo]).is_file():
                out.append(f"site.json «marcas» {nome}: «{campo}» não existe → {m[campo]}")
        if not m["logo"]:
            continue
        if not (inteiro(m["w"]) and inteiro(m["h"])):
            out.append(f"site.json «marcas» {nome}: com «logo», «w» e «h» são a largura e a altura do ficheiro (inteiros)")
            continue
        f = ROOT / m["logo"]
        if f.suffix.lower() == ".png" and f.is_file():
            cab = f.read_bytes()[:24]
            if cab[:8] == b"\x89PNG\r\n\x1a\n" and (int.from_bytes(cab[16:20], "big"), int.from_bytes(cab[20:24], "big")) != (m["w"], m["h"]):
                out.append(f"site.json «marcas» {nome}: «w»/«h» ({m['w']}×{m['h']}) não são o tamanho do PNG "
                           f"({int.from_bytes(cab[16:20], 'big')}×{int.from_bytes(cab[20:24], 'big')})")
        if f.suffix.lower() == ".svg" and f.is_file():
            svg = f.read_text(encoding="utf-8", errors="replace")
            vb = VIEWBOX_RE.search(svg)
            if not vb:
                out.append(f"{m['logo']}: SVG sem viewBox (o logótipo não escala)")
            elif abs(float(vb[1]) / float(vb[2]) - m["w"] / m["h"]) > 0.02 * m["w"] / m["h"]:
                out.append(f"site.json «marcas» {nome}: «w»/«h» ({m['w']}×{m['h']}) não têm a proporção do viewBox "
                           f"({vb[1]}×{vb[2]}): o logótipo ficaria esticado")
            if ARQUITECTOS_RE.search(svg):
                out.append(f"{m['logo']}: traz a assinatura «Os Arquitectos do Ar», que o dono não quer no site")
    return out


def check_preview():
    """O modo de pré-visualização e o lançamento nunca ficam a meio caminho."""
    robots = (OUT / "robots.txt").read_text(encoding="utf-8")
    cab = OUT / "_headers"
    tem_noindex = cab.exists() and "X-Robots-Tag: noindex" in cab.read_text(encoding="utf-8")
    if PREVIEW:
        return [] if ("Disallow: /\n" in robots and tem_noindex) else ["pré-visualização: falta Disallow em robots.txt ou X-Robots-Tag em _headers"]
    out = []
    if "Disallow: /\n" in robots or tem_noindex:
        out.append("lançamento: robots.txt ou _headers ainda pedem para não indexar")
    if not SITE["baseUrl"].startswith("https://") or "manus.space" in SITE["baseUrl"]:
        out.append(f"lançamento: baseUrl não é o domínio final → {SITE['baseUrl']}")
    return out


def em_falta():
    """(grupo, texto) de cada dado em falta: dados-mdm.json e factos das obras."""
    for k, v in DADOS_DOC.items():
        if k.startswith("_") or tem(v["valor"]):
            continue
        pags = sorted(DADOS_USO.get(k, ()))
        onde = ("entra em " + (" e ".join(pags) if len(pags) <= 2 else f"{len(pags)} páginas")) if pags else "não entra em nenhuma página"
        yield v["grupo"], f"{v['pedido']}.\n      chave «{k}» · {onde}"
    for campo, nome in FACTOS_OBRA.items():
        sem = [o["code"] for o in OBRAS if not tem(o.get("factos", {}).get(campo, ""))]
        if sem:
            yield ("Obras (data/obras.json, «factos» de cada obra; a linha só aparece na ficha quando existe)",
                   f"{nome}: falta em {len(sem)} de {len(OBRAS)} obras" + ("" if len(sem) == len(OBRAS) else f" ({', '.join(sem)})"))
    cheios, total = precos_contagem()
    if cheios < total:
        estado = ("Tabela de preços vazia: o formulário não mostra nenhum preço" if not cheios else
                  f"Tabela de preços preenchida em parte ({cheios} de {total} valores): o que falta não aparece")
        yield ("Preço provável no formulário (data/precos.json; ver README.md, «Preço provável»)",
               f"{estado}. Copiar os valores da folha {PRECOS_FOLHA} quando a MDM a preencher.")


def faltam():
    """Lista legível do que só a MDM pode dar. Não falha: enquanto falta, o site esconde o elemento."""
    grupos = {}
    for g, txt in em_falta():
        grupos.setdefault(g, []).append(txt)
    total = sum(len(v) for v in grupos.values())
    print(f"\nDados que só a MDM pode dar: {total} em falta. Preencher em website/data/dados-mdm.json"
          " (as obras em website/data/obras.json).\nNunca escrever um número ou um facto que não esteja confirmado.")
    for g, linhas in grupos.items():
        print(f"\n{g}")
        for l in linhas:
            print(f"  · {l}")
    tarefas = DADOS_DOC.get("_tarefas", [])
    if tarefas:
        print("\nOutras tarefas antes de publicar")
        for t in tarefas:
            print(f"  · {t}")


if __name__ == "__main__":
    built = build()
    rc = check(built) if "--check" in sys.argv else 0
    if "--faltam" in sys.argv:
        faltam()
    sys.exit(rc)
