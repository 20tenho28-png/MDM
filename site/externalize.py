"""Gera uma build de publicação com imagens EXTERNAS a partir de um index.html
auto-contido: o HTML desce para ~100 KB (primeiro render quase imediato em
qualquer telemóvel) e as imagens carregam em paralelo, com cache própria e
loading="lazy" a funcionar de verdade (só descarrega o que entra no ecrã).

    python3 externalize.py <index.html> <pasta-destino>

A build auto-contida continua a ser a oficial para "arrastar um ficheiro";
esta é a recomendada quando se publica uma PASTA (Netlify, Vercel, FTP).
Só stdlib.
"""
import base64, hashlib, os, re, sys

def main(src, outdir):
    html = open(src, encoding="utf-8").read()
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
    total = sum(os.path.getsize(os.path.join(imgdir, f)) for f in os.listdir(imgdir))
    print("%s -> %s: index %.0f KB + %d imagens (%.0f KB)" % (
        os.path.basename(src), outdir,
        os.path.getsize(os.path.join(outdir, "index.html")) / 1024,
        len(seen), total / 1024))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
