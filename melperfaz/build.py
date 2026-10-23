#!/usr/bin/env python3
"""Gera o site estático da Melperfaz a partir de src/ e data/ para public/.

Só biblioteca padrão (Python 3.11+). Uso, a partir de melperfaz/:
    python3 build.py             # gera public/
    python3 build.py --check     # gera e valida ligações, recursos, sintaxe, textos e o formulário; sai com 1 se falhar
    python3 build.py --faltam    # lista os dados que só a Melperfaz pode dar (não falha)
    MELPERFAZ_OUT=/tmp/x python3 build.py --check   # gera noutra pasta (só apaga uma pasta que o build.py gerou)

A arquitetura é a do site da MDM (website/build.py), reduzida ao que este site usa.

Sintaxe dos modelos (src/):
    <!--meta {...json...} -->           no topo de cada página: file, title, description, nav, robots, css, jsonld, breadcrumb,
                                         header («reduzido»: só o logótipo e o telefone), barra («sem-orcamento» ou «nao»),
                                         reencaminha (true na página inicial: os endereços antigos #contacto e ?tipo= vão
                                         para orcamento.html)
    {{ caminho.ponto }}                  valor de site.*, page.*, dados.*, obra.*, root (prefixo relativo à raiz), year, anos
    {{& caminho }}                       o mesmo, sem escapar o HTML
    {{> nome }}                          inclui src/partials/nome.html com o mesmo contexto
    {{> nome chave="valor" …}}           o mesmo, com parâmetros em {{ p.chave }}: o parcial declara-os no topo com
                                         <!--parametros {"chave": "por omissão", "outra": null} --> (null: obrigatório);
                                         um parâmetro que o parcial não declara é erro
    {{foto NN sizes="..." class="..." loading="eager" alt="..." foco="50% 40%"}}   <picture> avif + webp + jpg da fotografia NN
                                         (data/fotos.json; tamanhos feitos por gerar_fotos.py)
    {{wa chave}}                         ligação de WhatsApp com a mensagem site.wa.chave já escrita
    {{li obra.detalhes}}                 um <li> por texto de uma lista
    {{li obra.detalhes visto}}           o mesmo, com o ícone «visto» numa caixa (<span class="tick">) antes do texto
    {{icone nome}}                       o ícone nome de src/partials/icones.svg, em linha e escondido do leitor de ecrã
                                         (<svg class="icone i-nome" aria-hidden="true">); um nome que não existe é erro
    {{each parcial all}} / {{each parcial destaque}} / {{each parcial 01,02}} / {{each parcial cat=fachadas}} /
    {{each parcial ctx:related}}         repete um parcial por obra (… eagerN no fim: as N primeiras imagens sem lazy);
                                         «destaque» são as obras com "destaque": true em data/obras.json
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
# o vocabulário do site (site.json «servicos»): os serviços da página inicial, as opções do formulário (mais «Outro»), as
# etiquetas e os grupos das obras, o rodapé e o ?tipo= das ligações de orçamento usam todos o mesmo id e o mesmo nome
SERVICOS = SITE["servicos"]
SERVICO_BY_ID = {s["id"]: s for s in SERVICOS}
# as categorias das obras são os serviços com «cat»: o «cat» de cada obra diz a que serviço pertence
CATEGORIAS = {s["cat"]: s["nome"] for s in SERVICOS if s["cat"]}
SERVICO_BY_CAT = {s["cat"]: s for s in SERVICOS if s["cat"]}
# as opções do «Tipo de obra» do formulário: os nomes dos serviços e «Outro»
TIPOS_DE_OBRA = [s["nome"] for s in SERVICOS] + ["Outro"]


def lados(n):
    """Os lados maiores dos tamanhos que existem para a fotografia n: os de FOTO_LADOS abaixo do original e o original."""
    maior = max(FOTOS[n]["w"], FOTOS[n]["h"])
    return [l for l in FOTO_LADOS if l < maior] + [maior]


def campos_obra(o):
    """Campos calculados de cada obra (modelo obra.html e cartões). As fichas vivem em obras/: root «../»."""
    f = FOTOS[o["foto"]]
    o["orient"] = "landscape" if f["w"] >= f["h"] else "portrait"
    o["alt"] = f["alt"]
    s = SERVICO_BY_CAT[o["cat"]]
    o["servico"] = s
    o["catNome"] = s["nome"]
    o["tipoDeObra"] = s["nome"]
    # o pedido com o tipo já escolhido e a obra de onde veio (campo escondido «pagina»): orcamento.html
    o["orcamentoHref"] = f"../orcamento.html?tipo={s['id']}&de=obras/{o['slug']}"
    # a âncora do grupo da obra em obras.html (relativa à raiz: {{ root }}{{ obra.catAnchor }})
    o["catAnchor"] = f"obras.html#{o['cat']}"
    o.setdefault("destaque", False)
    o.setdefault("fotosExtra", [])
    # a ficha (Local, Data, Duração, Resultado) só aparece quando a Melperfaz deu pelo menos um destes factos
    o["temFactos"] = any(tem(o["factos"].get(k, "")) for k in FACTOS_FICHA)
    msg = SITE["wa"]["obra"].replace("{code}", o["code"]).replace("{title}", o["title"])
    o["waHref"] = SITE["whatsappBase"] + quote(msg)
    # «Outras obras de fachadas» só quando há outras da mesma categoria que cheguem; senão, «Outras obras»
    mesma = sum(1 for x in OBRAS if x is not o and x["cat"] == o["cat"])
    o["relTitulo"] = f"Outras obras de {o['catNome'].lower()}" if mesma >= 2 else "Outras obras"
    # a fotografia da ficha: na sua proporção (fotoR, largura/altura), à largura do contentor (1176 px por dentro da .wrap,
    # menos 32 px de margens até 640 px, menos 64 acima) e no máximo 78% da altura do ecrã; o sizes diz o mesmo
    r = f"calc(78vh * {f['w']} / {f['h']})"
    o["fotoR"] = f"{f['w'] / f['h']:.4f}"
    o["fotoSizes"] = f"(min-width: 641px) min(1176px, calc(100vw - 64px), {r}), min(calc(100vw - 32px), {r})"
    # o cartão (obra-foto.html): duas colunas de 579 px a partir de 981 px (a .wrap de 1176 px menos 18 de intervalo),
    # uma coluna até lá. Abaixo de 640 px a moldura é 4:3 (paisagem) ou 4:5 (retrato): uma fotografia mais larga do que a
    # moldura é cortada nos lados e precisa de mais píxeis do que a largura do cartão (foto-05, 1080 × 620: × 1,31)
    moldura = 4 / 3 if o["orient"] == "landscape" else 4 / 5
    fator = max(1.0, (f["w"] / f["h"]) / moldura)
    movel = "calc(100vw - 32px)" if fator < 1.02 else f"calc((100vw - 32px) * {fator:.2f})"
    o["cartaoSizes"] = f"(min-width: 981px) min(calc(50vw - 41px), 579px), (min-width: 641px) calc(100vw - 64px), {movel}"
    # sem comparador, a chave existe vazia: os modelos perguntam {{#se obra.antesDepois}} (uma chave em falta é erro)
    ad = o.setdefault("antesDepois", "")
    if ad:
        for k in ("antes", "depois"):
            if ad.get(k) not in FOTOS:
                raise SystemExit(f"obras.json {o['code']}: antesDepois.{k} tem de ser uma fotografia de data/fotos.json")
        o["antesAlt"], o["depoisAlt"] = FOTOS[ad["antes"]]["alt"], FOTOS[ad["depois"]]["alt"]
        o["antesSrc"], o["depoisSrc"] = f"foto-{ad['antes']}.jpg", f"foto-{ad['depois']}.jpg"


def tem(v):
    return bool(v.strip()) if isinstance(v, str) else bool(v)


# os factos de cada obra que a ficha mostra; «problema» e «trabalho» entram no texto da obra («Na obra»)
FACTOS_FICHA = ("localExato", "data", "duracao", "resultado")
FACTOS_OBRA = {"problema": "O problema que havia (uma ou duas frases)", "trabalho": "O que a Melperfaz fez (uma ou duas frases)",
               "data": "Data da obra", "localExato": "Local (bairro ou concelho, sem o nome do cliente)",
               "duracao": "Duração", "resultado": "Resultado da obra numa frase"}

for _s in SERVICOS:
    if not (_s.get("id") and _s.get("nome") and _s.get("texto")) or "cat" not in _s:
        raise SystemExit(f"site.json «servicos»: cada serviço tem id, nome, cat (vazio se não tiver obras) e texto → {_s}")
    if _s["cat"] and _s["cat"] != _s["id"]:
        raise SystemExit(f"site.json «servicos» {_s['id']}: «cat» é o próprio id ou vazio → «{_s['cat']}»")
    # a frase da lista de serviços da página inicial: uma das frases do «texto», tal qual (nada de texto novo)
    if not _s.get("frase") or _s["frase"] not in _s["texto"] or not _s["frase"].endswith("."):
        raise SystemExit(f"site.json «servicos» {_s['id']}: «frase» é uma frase inteira do «texto», copiada tal qual → «{_s.get('frase', '')}»")
if len(SERVICO_BY_ID) != len(SERVICOS):
    raise SystemExit("site.json «servicos»: id repetido")
for _o in OBRAS:
    if _o["foto"] not in FOTOS:
        raise SystemExit(f"obras.json {_o['code']}: «foto» {_o['foto']} não existe em data/fotos.json")
    if _o["cat"] not in CATEGORIAS:
        raise SystemExit(f"obras.json {_o['code']}: «cat» «{_o['cat']}» não é o «cat» de nenhum serviço de site.json")
    campos_obra(_o)
CAT_N = {**{c: sum(1 for o in OBRAS if o["cat"] == c) for c in CATEGORIAS}, "todas": len(OBRAS)}


def servicos_ctx(root):
    """Os serviços para os modelos: n (01…), obrasN e «N obras», a primeira fotografia das suas obras, a âncora e o pedido.
    Os que têm obras são os grupos de obras.html: «sup» alterna ink e bone (a começar em ink, depois do PageHead paper) e
    «eager» é «1» só no primeiro grupo (a primeira fotografia da página carrega já)."""
    out, grupo = [], 0
    for i, s in enumerate(SERVICOS):
        obras = [o for o in OBRAS if s["cat"] and o["cat"] == s["cat"]]
        out.append({**s, "n": f"{i + 1:02d}", "obrasN": len(obras), "primeiraFoto": obras[0]["foto"] if obras else "",
                    "obrasTexto": f"{len(obras)} {'obra' if len(obras) == 1 else 'obras'}",
                    "catAnchor": f"obras.html#{s['cat']}" if obras else "",
                    "sup": ("s-ink", "s-bone")[grupo % 2] if obras else "", "eager": "1" if obras and grupo == 0 else "0",
                    "orcamentoHref": f"{root}orcamento.html?tipo={s['id']}"})
        grupo += bool(obras)
    return out


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
        return ", ".join(f"{base}-{lado}.{ext} {round(w * lado / maior)}w" for lado in lados(n))
    return (f'<picture class="{cls}"{previa}>'
            f'<source type="image/avif" srcset="{srcset("avif")}" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{srcset("webp")}" sizes="{sizes}">'
            f'<img src="{base}.jpg" alt="{html.escape(alt, quote=True)}" width="{w}" height="{h}"{estilo} '
            f'loading="{loading}" decoding="async"{extra}></picture>')


# Os ícones (src/partials/icones.svg, Fase 5b): cada <symbol id="nome" viewBox="…"> desenha-se uma vez lá; {{icone nome}}
# copia-o para a página em linha (não com <use>), para o CSS chegar às partes: as barras do menu viram X, os vistos e o
# círculo de obrigado.html desenham-se. Traço de 1,75 em currentColor, sem preenchimento (o WhatsApp traz o seu fill).
ICONE_RE = re.compile(r'<symbol\s+id="([\w-]+)"\s+viewBox="([^"]+)"\s*>(.*?)</symbol>', re.S)


def carrega_icones():
    texto = re.sub(r"<!--.*?-->", "", (SRC / "partials" / "icones.svg").read_text(encoding="utf-8"), flags=re.S)
    return {nome: (vb, corpo.strip()) for nome, vb, corpo in ICONE_RE.findall(texto)}


ICONES = carrega_icones()


def icone(ctx, nome):
    if nome not in ICONES:
        raise KeyError(f"{{{{icone {nome}}}}}: não existe em src/partials/icones.svg ({ctx.get('_file', '?')})")
    vb, corpo = ICONES[nome]
    return (f'<svg class="icone i-{nome}" viewBox="{vb}" fill="none" stroke="currentColor" stroke-width="1.75" '
            f'aria-hidden="true" focusable="false">{corpo}</svg>')


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
    elif sel == "destaque":
        items = [o for o in OBRAS if o["destaque"]]
    elif sel.startswith("cat="):
        items = [o for o in OBRAS if o["cat"] == sel[4:]]
    elif sel.startswith("ctx:"):
        items = lookup(ctx, sel[4:])
    else:
        items = [OBRA_BY_N[x.strip().zfill(2)] for x in sel.split(",")]
    tpl = (SRC / "partials" / f"{name}.html").read_text(encoding="utf-8")
    sizes = ctx["page"].get("cartaoSizes")   # uma página pode dar o seu; senão, o de cada obra (campos_obra)
    out = []
    for i, o in enumerate(items):
        c = dict(ctx, obra=o, index=i, pos=i + 1, total=len(items), cartaoSizes=sizes or o["cartaoSizes"],
                 loading="eager" if i < eager else "lazy", prioridade="alta" if i == 0 and eager else "normal")
        out.append(render(tpl, c))
    return "".join(out)


ABRE_RE = re.compile(r"\{\{#(se|sem|cada)\s+([\w.]+)\s*\}\}")


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


PARAM_RE = re.compile(r"\A\s*<!--parametros\s+(\{.*?\})\s*-->\s*", re.S)


def parcial(nome, args, ctx, depth):
    """{{> nome chave="valor"}}: inclui src/partials/nome.html. Os parâmetros ficam em {{ p.chave }}, com os valores por
    omissão do <!--parametros {...} --> do parcial. Os valores chegam já escritos em HTML (um {{ obra.title }} lá dentro
    foi escapado): desfaz-se o escape aqui e {{ p.chave }} escapa uma vez só."""
    texto = (SRC / "partials" / f"{nome}.html").read_text(encoding="utf-8")
    dados = dict(ATTR_RE.findall(args))
    if ATTR_RE.sub("", args).strip():
        raise SyntaxError(f"{{{{> {nome} {args}}}}}: os parâmetros escrevem-se chave=\"valor\" ({ctx.get('_file', '?')})")
    m = PARAM_RE.match(texto)
    if not m:
        if dados:
            raise KeyError(f"{{{{> {nome}}}}} não declara parâmetros (<!--parametros {{...}} -->) ({ctx.get('_file', '?')})")
        return render(texto, ctx, depth + 1)
    p = json.loads(m.group(1))
    fora = sorted(set(dados) - set(p))
    if fora:
        raise KeyError(f"{{{{> {nome}}}}}: parâmetros que o parcial não declara → {fora} ({ctx.get('_file', '?')})")
    p.update({k: html.unescape(v) for k, v in dados.items()})
    falta = sorted(k for k, v in p.items() if v is None)
    if falta:
        raise KeyError(f"{{{{> {nome}}}}}: faltam os parâmetros obrigatórios {falta} ({ctx.get('_file', '?')})")
    return render(texto[m.end():], dict(ctx, p=p), depth + 1)


def render(text, ctx, depth=0):
    if depth > 12:
        raise RuntimeError("inclusão recursiva demasiado profunda")
    text = blocos(text, ctx, depth)

    def sub(m):
        expr = m.group(1)
        if expr.startswith(">"):
            nome, _, args = expr[1:].strip().partition(" ")
            return parcial(nome, args, ctx, depth)
        if expr.startswith("foto "):
            return foto(ctx, expr[5:])
        if expr.startswith("wa "):
            return html.escape(wa(ctx, expr[3:].strip()), quote=True)
        if expr.startswith("each "):
            return each(ctx, expr[5:])
        if expr.startswith("icone "):
            return icone(ctx, expr[6:].strip())
        if expr.startswith("li "):
            caminho, _, nome = expr[3:].strip().partition(" ")
            antes = f'<span class="tick" aria-hidden="true">{icone(ctx, nome.strip())}</span>' if nome.strip() else ""
            return "".join(f"<li>{antes}{html.escape(str(x))}</li>" for x in lookup(ctx, caminho))
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


# a barra de ações dos ecrãs estreitos (barra-acoes.html): "" em todas as páginas, «sem-orcamento» em orcamento.html (a
# terceira célula passa a «Enviar fotografias») e «nao» em obrigado.html
BARRAS = {"": (True, True), "sem-orcamento": (True, False), "nao": (False, False)}
HEADERS = ("", "reduzido")


def page_ctx(meta, file):
    meta = {"nav": "", "robots": "index,follow", "og": "", "wa": "geral", "tipo": "", "italico": "", "header": "", "barra": "",
            "atualizada": "", "reencaminha": "", **meta}
    if meta["barra"] not in BARRAS:
        raise SystemExit(f"{file}: «barra» é {' ou '.join(repr(b) for b in BARRAS)} → {meta['barra']!r}")
    if meta["header"] not in HEADERS:
        raise SystemExit(f"{file}: «header» é \"\" ou «reduzido» → {meta['header']!r}")
    if PREVIEW and not NOINDEX_RE.search(meta["robots"]):
        meta["robots"] = "noindex"   # pré-visualização: nenhuma página entra no Google antes do lançamento
    depth = file.count("/")
    # a 404 é servida em qualquer profundidade (/obras/xyz.html): precisa de caminhos absolutos
    root = "/" if file == "404.html" else "../" * depth
    # as migalhas do PageHead (page-head.html): as de meta «breadcrumb»; a última é a página atual, sem ligação
    trilho = meta.get("breadcrumb") or []
    migalhas = [{"nome": n, "href": "" if i == len(trilho) - 1 else root + (f or "index.html")} for i, (n, f) in enumerate(trilho)]
    mostra_barra, barra_orcamento = BARRAS[meta["barra"]]
    return {"site": SITE, "page": meta, "root": root, "_file": file, "dados": DADOS, "categorias": CATEGORIAS,
            "cat_n": CAT_N, "year": str(ANO), "anos": str(SITE["anos"]), "tipos": TIPOS_DE_OBRA,
            "servicos": servicos_ctx(root), "provas": SITE["provas"],
            # o menu (site.json «menu»), igual no cabeçalho e no painel; «atual» dá aria-current sem JavaScript
            "menu": [{**m, "href": root + m["href"], "atual": "1" if m["id"] == meta["nav"] else ""} for m in SITE["menu"]],
            "migalhas": migalhas,
            # em orcamento.html o botão do cabeçalho dá lugar a «Orçamento gratuito» (aria-current)
            "emOrcamento": "1" if meta["nav"] == "orcamento" else "",
            "barra": {"mostra": "1" if mostra_barra else "", "orcamento": "1" if barra_orcamento else ""},
            # «Pedir Orçamento» do cabeçalho e da barra: com ?tipo= e ?de= quando a página os conhece (fichas de obra)
            "pedidoHref": root + "orcamento.html",
            # cartaoH: o nível do título dos cartões de obra (obra-foto.html): h3 debaixo do h2 da secção (na página
            # inicial, nas outras obras de cada ficha e em cada grupo de obras.html)
            "cartaoH": str(meta.get("cartaoH", 3))}


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
    for o in OBRAS:
        file = f"obras/{o['slug']}.html"
        desc = f"{o['title']}, {o['catNome'].lower()}: {o['resumo']}"
        if len(desc) > 160:   # a descrição corta-se na última frase inteira que cabe; sem nenhuma, na última palavra
            corte = desc[:160]
            fim = corte.rfind(". ")
            desc = corte[:fim + 1] if fim >= 60 else re.sub(r"\s+\S*$", "", corte[:159]).rstrip(".,;:") + "…"
        meta = {"file": file, "nav": "obras", "css": ["pag-obras.css"],
                "title": f"{o['title']} · Obras Melperfaz",
                "description": desc,
                # a imagem de partilha ao alto fica cortada nas pré-visualizações: só as deitadas; as outras levam a da empresa
                "og": o["foto"] if o["orient"] == "landscape" else "", "jsonld": ["breadcrumb"],
                "breadcrumb": [["Início", ""], ["Obras", "obras.html"], [o["title"], file]]}
        files.append(build_page(meta, tpl, {"obra": o, "related": relacionadas(o), "pedidoHref": o["orcamentoHref"]}))
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
    # só os blocos de emoji e os símbolos diversos (☎ ☀ …); a seta, o menu, o visto e as setas do comparador são ícones
    (re.compile("[\U0001F300-\U0001FAFF\u2600-\u26FF]"), "emoji ou símbolo: o site não usa"),
    # os glifos que os ícones substituíram (Fase 5b): → ≡ ✓ ‹ (o › das migalhas fica, é o separador do texto)
    (re.compile("[\u2192\u2261\u2713\u2714\u2039]"), "glifo que passou a ícone: usar {{icone seta|menu|visto|seta-esq}}"),
]
REF_RE = re.compile(r'(?:href|src|action)="([^"#?]+)|srcset="([^"]+)"|url\(([^)]+)\)')
# Netlify Forms: o formulário de orçamento tem de chegar ao HTML gerado com o nome, os atributos do Netlify, a armadilha
# para robôs e os mesmos campos em todas as páginas onde aparece (o Netlify regista um só «orcamento»)
FORM_RE = re.compile(r'<form\b[^>]*\bid="quoteForm"[^>]*>.*?</form>', re.S)
FORM_EXIGE = [' name="orcamento"', ' method="POST"', ' data-netlify="true"', ' netlify-honeypot="bot-field"',
              ' action="/obrigado.html"']
FORM_CAMPOS = {"form-name", "subject", "pagina", "nome", "telefone", "localidade", "email", "tipo_de_obra", "mensagem",
               "bot-field"}
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


# a página do pedido: o único sítio com o formulário, e o destino de todos os «Pedir Orçamento»
PAGINA_PEDIDO = "orcamento.html"
LIGACAO_RE = re.compile(r"<a\b([^>]*)>(.*?)</a>", re.S)
PEDIR_RE = re.compile(r"^pedir or[cç]amento\b", re.I)


def check_pedir(f, text):
    """Cada «Pedir Orçamento» (botão, ligação, barra) leva a orcamento.html, com ou sem ?tipo= e ?de=."""
    out = []
    for attrs, dentro in LIGACAO_RE.findall(text):
        rotulo = html.unescape(re.sub(r"<[^>]+>", " ", dentro)).split()
        nome = re.search(r'\baria-label="([^"]*)"', attrs)
        rotulos = [" ".join(rotulo)] + ([html.unescape(nome.group(1))] if nome else [])
        if not any(PEDIR_RE.match(r) for r in rotulos):
            continue
        href = re.search(r'\bhref="([^"]*)"', attrs)
        alvo = href.group(1) if href else ""
        if not re.fullmatch(r"(?:/|(?:\.\./)*)%s(?:\?[^#]*)?" % re.escape(PAGINA_PEDIDO), alvo):
            out.append(f"{f}: «{rotulos[0]}» tem de levar a {PAGINA_PEDIDO} → href=\"{alvo}\"")
    return out


# um rótulo por ação: os nomes antigos dos botões e a âncora do formulário que saiu da página inicial não voltam.
# «Orçamento gratuito» pode ser texto (o eyebrow e o cabeçalho de orcamento.html), mas não o nome de uma ligação.
ROTULOS_FORA = [(re.compile(r"pedir or[cç]amento gratuito", re.I), "«Pedir Orçamento Gratuito»: o botão é «Pedir Orçamento»"),
                (re.compile(r"chamar no whatsapp", re.I), "«Chamar no WhatsApp»: é «Falar por WhatsApp»")]
LIGACAO_FORA = re.compile(r"or[cç]amento gratuito", re.I)


def check_rotulos(f, text):
    """Sem os rótulos antigos (em todo o texto visível, e «Orçamento Gratuito» como nome de ligação) e sem ligações para
    #contacto: o formulário vive em orcamento.html e a página inicial reencaminha os endereços antigos."""
    out = []
    visivel = html.unescape(TAG_TEXTO_RE.sub(" ", re.sub(r"<!--.*?-->|<script.*?</script>", "", text, flags=re.S)))
    visivel = re.sub(r"\s+", " ", visivel)
    for rx, porque in ROTULOS_FORA:
        if rx.search(visivel):
            out.append(f"{f}: rótulo retirado {porque}")
    for attrs, dentro in LIGACAO_RE.findall(text):
        nome = re.search(r'\baria-label="([^"]*)"', attrs)
        rotulo = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", dentro) + " " + (nome.group(1) if nome else "")).split())
        if LIGACAO_FORA.search(rotulo):
            out.append(f"{f}: «{rotulo}» como nome de ligação (o botão é «Pedir Orçamento»; «gratuito» é texto de apoio)")
        href = re.search(r'\bhref="([^"]*)"', attrs)
        if href and href.group(1).endswith("#contacto"):
            out.append(f"{f}: ligação para #contacto → href=\"{href.group(1)}\" (o pedido é em {PAGINA_PEDIDO})")
    return out


def check_formulario(f, text):
    """O formulário de orçamento existe só em orcamento.html e é o formulário Netlify «orcamento»."""
    m = FORM_RE.search(text)
    if not m:
        return [f"{f}: falta o formulário de orçamento (#quoteForm)"] if f == PAGINA_PEDIDO else []
    if f != PAGINA_PEDIDO:
        return [f"{f}: o formulário de orçamento só existe em {PAGINA_PEDIDO}"]
    form = m.group(0)
    abre = form[:form.index(">") + 1]
    out = [f"{f}: formulário sem{x}" for x in FORM_EXIGE if x not in abre]
    campos = set(re.findall(r'<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"', form))
    if campos != FORM_CAMPOS:
        out.append(f"{f}: campos do formulário diferentes do esperado → a mais {sorted(campos - FORM_CAMPOS)}, "
                   f"em falta {sorted(FORM_CAMPOS - campos)}")
    if not re.search(r'<input type="hidden" name="form-name" value="orcamento">', form):
        out.append(f"{f}: falta o campo escondido form-name=orcamento")
    opcoes = [html.unescape(x) for x in re.findall(r"<option value=\"([^\"]*)\"", form)]
    if [o for o in opcoes if o] != TIPOS_DE_OBRA:
        out.append(f"{f}: as opções de «Tipo de Obra» não são os nomes de site.json «servicos» e «Outro» → {opcoes}")
    for nome in ("nome", "telefone", "localidade", "email", "mensagem"):
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
    if tem(v) and not re.match(r"https://(?:maps\.app\.goo\.gl/|(?:www\.|maps\.)?google\.[a-z.]+/(?:maps|$)|g\.page/|goo\.gl/maps/)", v.strip()):
        out.append(f"dados-melperfaz.json «googleMaps»: tem de ser uma ligação do Google Maps → «{v}»")
    for k in ("alvara", "seguro", "zona", "horario", "morada"):
        if "\u2014" in DADOS.get(k, ""):
            out.append(f"dados-melperfaz.json «{k}»: sem travessões (—)")
    return out


def check_obras():
    out = []
    slugs, codes = set(), set()
    for o in OBRAS:
        for campo in ("n", "code", "slug", "cat", "title", "foto", "resumo", "detalhes", "factos", "fotosExtra"):
            if campo not in o:
                out.append(f"obras.json {o.get('code', '?')}: falta «{campo}»")
        if "catLabel" in o:
            out.append(f"obras.json {o['code']}: «catLabel» já não existe: o nome vem do serviço («cat», site.json «servicos»)")
        if not isinstance(o.get("destaque", False), bool):
            out.append(f"obras.json {o['code']}: «destaque» é true ou false")
        extra = o.get("fotosExtra", [])
        if not (isinstance(extra, list) and all(x in FOTOS for x in extra)):
            out.append(f"obras.json {o['code']}: «fotosExtra» é uma lista de fotografias de data/fotos.json → {extra}")
        if o["slug"] in slugs:
            out.append(f"obras.json: slug repetido «{o['slug']}»")
        if o["code"] in codes:
            out.append(f"obras.json: código repetido «{o['code']}»")
        slugs.add(o["slug"]); codes.add(o["code"])
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", o["slug"]):
            out.append(f"obras.json {o['code']}: slug só com letras minúsculas sem acentos, algarismos e hífens → «{o['slug']}»")
        if not (isinstance(o["detalhes"], list) and o["detalhes"] and all(isinstance(x, str) and x.strip() for x in o["detalhes"])):
            out.append(f"obras.json {o['code']}: «detalhes» tem de ser uma lista de frases")
        if set(o["factos"]) != set(FACTOS_OBRA):
            out.append(f"obras.json {o['code']}: «factos» tem de ter {', '.join(FACTOS_OBRA)} (vazios ou não)")
        if not re.fullmatch(r"\d{1,3}% \d{1,3}%", str(o.get("foco", ""))):
            out.append(f"obras.json {o['code']}: «foco» é obrigatório, «X% Y%» (o ponto da fotografia que fica à vista) → «{o.get('foco', '')}»")
    if not any(o["destaque"] for o in OBRAS):
        out.append("obras.json: nenhuma obra com «destaque»: true (a página inicial ficava sem obras)")
    return out


# ── O sistema visual não volta a derivar: o lint das folhas de estilo (--check) ─────────────────────────────────────
# Fora do bloco :root (onde vivem os tokens) só se aceitam: espaços em tokens --space-*, tamanhos de letra em --fs-*,
# @media a 980 ou 640 px (e as de preferência, como prefers-reduced-motion e hover), nada «infinite», e nunca texto paper
# ou branco num seletor de .s-clay ou .btn sem fundo ink na mesma regra. Exceções, curtas e de propósito: 1px (hairline,
# como o margin:-1px do texto só para leitores de ecrã) e env(safe-area-inset-*), que não é px.
# O movimento (Fase 5b): durações e curvas só pelos tokens --dur-* e --ease-* (com 0s como exceção: «já»), cada
# duração com a sua curva, nenhum --dur-* acima de 500 ms, e só se anima transform, opacity, as cores e o traço dos
# ícones (stroke-dashoffset): nada de width, height, top, left ou «all», que mexem no layout.
CSS_ESPACO = re.compile(r"^(?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$"
                        r"|^(?:gap|row-gap|column-gap|inset|top|right|bottom|left|scroll-padding(?:-[a-z-]+)?)$")
CSS_PX = re.compile(r"(?<![\w.-])-?(\d*\.?\d+)px\b")
CSS_PX_OK = {"1"}   # hairline
CSS_FS_OK = re.compile(r"^(?:var\(--fs-[a-z0-9-]+\)|inherit)$")
CSS_MEDIA_OK = {"(max-width: 980px)", "(min-width: 981px)", "(max-width: 640px)", "(min-width: 641px)"}
CSS_MOV = {"transition", "transition-duration", "transition-delay", "transition-timing-function", "transition-property",
           "animation", "animation-duration", "animation-delay", "animation-timing-function"}
CSS_TEMPO = re.compile(r"(?<![\w.-])(\d*\.?\d+)(ms|s)\b")
CSS_CURVA = re.compile(r"(?<![\w-])(?:ease(?:-in|-out|-in-out)?|linear|step-start|step-end)(?![\w-])|cubic-bezier\(|steps\(")
CSS_VAR = re.compile(r"var\(--[\w-]+(?:,[^()]*)?\)")
CSS_ANIMA_OK = {"transform", "opacity", "color", "background", "background-color", "border-color", "box-shadow",
                "outline-color", "stroke-dashoffset", "none"}
CSS_COR_CLARA = re.compile(r"var\(--(?:paper|white|bone)\)|#fff\b|#ffffff\b|\bwhite\b", re.I)


def css_regras(texto):
    """As regras de uma folha de estilo: (seletor, [(propriedade, valor)], [@media à volta]), sem comentários."""
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    pilha, regras, inicio = [], [], 0
    for i, c in enumerate(texto):
        if c == "{":
            pilha.append(texto[inicio:i].strip().split(";")[-1].strip())
            inicio = i + 1
        elif c == "}":
            corpo = texto[inicio:i]
            if pilha and not pilha[-1].startswith("@") and ":" in corpo:
                decls = [tuple(x.strip() for x in d.split(":", 1)) for d in corpo.split(";") if ":" in d]
                regras.append((pilha[-1], decls, [p for p in pilha[:-1] if p.startswith("@")]))
            if pilha:
                pilha.pop()
            inicio = i + 1
    return regras


def partes(valor):
    """As partes de uma lista separada por vírgulas, sem partir dentro de parênteses (calc(), var(--x, 0))."""
    out, nivel, ini = [], 0, 0
    for i, c in enumerate(valor):
        nivel += (c == "(") - (c == ")")
        if c == "," and nivel == 0:
            out.append(valor[ini:i].strip())
            ini = i + 1
    return out + [valor[ini:].strip()]


def check_movimento(nome, sel, prop, val):
    """Uma declaração de transition/animation: tokens de duração e de curva, e só propriedades que não mexem no layout."""
    out, onde = [], f"{nome}: «{sel} {{ {prop}: {val} }}»"
    for parte in partes(val.replace("!important", "")):
        sem_var = CSS_VAR.sub(" ", parte)
        tempos = [m.group(0) for m in CSS_TEMPO.finditer(sem_var) if float(m.group(1)) != 0]
        if tempos:
            out.append(f"{onde}: duração solta ({', '.join(tempos)}): usar --dur-1, --dur-2 ou --dur-3")
        if CSS_CURVA.search(sem_var):
            out.append(f"{onde}: curva solta: usar --ease-out ou --ease-in-out")
        if prop in ("transition", "animation") and "var(--dur-" in parte and "var(--ease-" not in parte:
            out.append(f"{onde}: duração sem curva: juntar var(--ease-out) ou var(--ease-in-out)")
        if prop in ("transition", "transition-property"):
            anima = sem_var.split()[0] if sem_var.split() else ""
            if anima not in CSS_ANIMA_OK:
                out.append(f"{onde}: anima «{anima}»: só transform, opacity, as cores e stroke-dashoffset (nada que mexa no layout)")
    return out


def check_css(nome, texto):
    out = []
    sem_comentarios = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    for tok, v in re.findall(r"(--dur-[\w-]+)\s*:\s*([^;}]+)", sem_comentarios):
        m = CSS_TEMPO.fullmatch(v.strip())
        if not m or float(m.group(1)) * (1 if m.group(2) == "ms" else 1000) > 500:
            out.append(f"{nome}: {tok}: {v.strip()} (nenhuma duração passa de 500 ms)")
    if re.search(r"\binfinite\b", sem_comentarios):
        out.append(f"{nome}: animação «infinite» (nenhuma animação sem fim)")
    for m in re.finditer(r"@media\s+([^{]+)\{", sem_comentarios):
        for q in re.findall(r"\((?:max|min)-(?:width|height)\s*:[^)]*\)", m.group(1)):
            if re.sub(r"\s+", " ", q.replace(": ", ":").replace(":", ": ")) not in CSS_MEDIA_OK:
                out.append(f"{nome}: @media {q} (só 980 e 640 px)")
    for sel, decls, _ in css_regras(texto):
        if sel == ":root" or sel.startswith("@font-face") or sel in ("from", "to") or sel.endswith("%"):
            continue
        props = dict(decls)
        for prop, val in decls:
            if prop.startswith("--"):
                continue
            if CSS_ESPACO.match(prop):
                soltos = [m.group(0) for m in CSS_PX.finditer(val) if m.group(1) not in CSS_PX_OK]
                if soltos:
                    out.append(f"{nome}: «{sel} {{ {prop}: {val} }}»: espaço em px solto ({', '.join(soltos)}): usar --space-*")
            elif prop == "font-size" and not CSS_FS_OK.match(val):
                out.append(f"{nome}: «{sel} {{ font-size: {val} }}»: só os estilos de texto (--fs-*)")
            elif prop == "font" and val != "inherit":
                out.append(f"{nome}: «{sel} {{ font: {val} }}»: o atalho font só como inherit (tamanhos em --fs-*)")
            elif prop in CSS_MOV:
                out += check_movimento(nome, sel, prop, val)
        cor = props.get("color", "")
        fundo = props.get("background", props.get("background-color", ""))
        if (re.search(r"\.s-clay\b|\.btn(?![\w-])", sel) and CSS_COR_CLARA.search(cor)
                and not re.search(r"var\(--ink(?:-deep)?\)", fundo)):
            out.append(f"{nome}: «{sel} {{ color: {cor} }}»: texto claro sobre clay (2,5:1); na faixa clay e nos botões o texto é ink")
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
        problems += check_pedir(f, text)
        problems += check_rotulos(f, text)
        for a, b, c in REF_RE.findall(text):
            refs = [a] if a else ([s.strip().split()[0] for s in b.split(",")] if b else [c.strip("'\"")])
            for r in refs:
                if not r or re.match(r"^(https?:|mailto:|tel:|data:|//)", r):
                    continue
                target = (OUT / r.lstrip("/")) if r.startswith("/") else (path.parent / r).resolve()
                if not target.exists():
                    problems.append(f"{f}: referência partida → {r}")
    if PAGINA_PEDIDO not in files:
        problems.append(f"falta a página {PAGINA_PEDIDO} (o formulário de orçamento)")
    problems += check_preview() + check_fotos() + check_dados() + check_obras()
    for css in sorted((OUT / "assets" / "css").glob("*.css")):
        problems += check_css(css.name, css.read_text(encoding="utf-8"))
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
            yield ("Obras (data/obras.json, «factos» de cada obra; cada um só aparece no site quando existe)",
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
