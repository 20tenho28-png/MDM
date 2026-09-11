"""Gera uma build de publicação com imagens EXTERNAS a partir de um index.html
auto-contido: o HTML desce para ~100 KB (primeiro render quase imediato em
qualquer telemóvel) e as imagens carregam em paralelo, com cache própria e
loading="lazy" a funcionar de verdade (só descarrega o que entra no ecrã).

    python3 externalize.py <index.html> <pasta-destino> [--url https://www.exemplo.pt]

--url troca o domínio em TODO o lado de uma vez (canonical, og:url, og:image,
twitter:image, o JSON-LD, o robots.txt e o sitemap.xml) — é o único passo
necessário quando se passa do domínio provisório para o domínio próprio.

A build auto-contida continua a ser a oficial para "arrastar um ficheiro";
esta é a recomendada quando se publica uma PASTA (Netlify, Vercel, FTP).
Só stdlib.
"""
import base64, datetime, hashlib, os, re, shutil, sys

def main(src, outdir, url=None):
    html = open(src, encoding="utf-8").read()
    if url:
        antigo = re.search(r'<link rel="canonical" href="(https?://[^"/]+)', html)
        if not antigo:
            sys.exit("não encontrei o canonical em %s" % src)
        html = html.replace(antigo.group(1).rstrip("/"), url.rstrip("/"))
        print("domínio: %s -> %s" % (antigo.group(1), url.rstrip("/")))
    imgdir = os.path.join(outdir, "img")
    os.makedirs(imgdir, exist_ok=True)
    seen = {}

    def extrai(m):
        mime, b64 = m.group(1), m.group(2)
        raw = base64.b64decode(b64)
        if len(raw) < 8_000:          # favicons e afins ficam inline
            return m.group(0)
        h = hashlib.sha1(raw).hexdigest()[:10]
        ext = {"jpeg": "jpg", "webp": "webp", "png": "png"}[mime]
        nome = seen.get(h)
        if not nome:
            nome = "img/%s.%s" % (h, ext)
            open(os.path.join(outdir, nome), "wb").write(raw)
            seen[h] = nome
        return nome

    html = re.sub(r"data:image/(jpeg|webp|png);base64,([A-Za-z0-9+/=]+)", extrai, html)
    open(os.path.join(outdir, "index.html"), "w", encoding="utf-8").write(html)
    # páginas soltas que acompanham o site (política de privacidade)
    paginas = []
    for extra in ("privacidade.html",):
        origem = os.path.join(os.path.dirname(os.path.abspath(src)), extra)
        if os.path.exists(origem):
            txt = open(origem, encoding="utf-8").read()
            if url:
                txt = re.sub(r"https?://[^\"/]+(?=/privacidade\.html)", url.rstrip("/"), txt)
            open(os.path.join(outdir, extra), "w", encoding="utf-8").write(txt)
            paginas.append(extra)
    # extras de publicação: og.jpg + robots.txt + sitemap.xml (derivados do canonical)
    og = os.path.join(os.path.dirname(os.path.abspath(src)), "og.jpg")
    if os.path.exists(og):
        shutil.copy2(og, os.path.join(outdir, "og.jpg"))
    c = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    if c:
        base = c.group(1).rstrip("/")
        open(os.path.join(outdir, "robots.txt"), "w").write(
            "User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n" % base)
        hoje = datetime.date.today().isoformat()
        urls = ["  <url><loc>%s/</loc><lastmod>%s</lastmod><priority>1.0</priority></url>" % (base, hoje)]
        for extra in paginas:
            urls.append("  <url><loc>%s/%s</loc><lastmod>%s</lastmod><priority>0.3</priority></url>" % (base, extra, hoje))
        open(os.path.join(outdir, "sitemap.xml"), "w").write(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(urls) + "\n</urlset>\n")
        print("+ og.jpg, robots.txt, sitemap.xml%s (%s)" % (
            "".join(", " + x for x in paginas), base))

    total = sum(os.path.getsize(os.path.join(imgdir, f)) for f in os.listdir(imgdir))
    print("%s -> %s: index %.0f KB + %d imagens (%.0f KB)" % (
        os.path.basename(src), outdir,
        os.path.getsize(os.path.join(outdir, "index.html")) / 1024,
        len(seen), total / 1024))

if __name__ == "__main__":
    args = sys.argv[1:]
    destino_url = None
    if "--url" in args:
        i = args.index("--url")
        destino_url = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    main(args[0], args[1], destino_url)
