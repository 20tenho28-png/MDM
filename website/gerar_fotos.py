#!/usr/bin/env python3
"""Tamanhos das fotografias das obras, em AVIF e WebP, a partir do JPEG de 1600 px.

O original de cada obra é assets/img/obras/foto-NN-1600.jpg, já com a correção de cor e o corte finais
(é também o JPEG de reserva e a imagem de partilha da obra). Este script faz, para cada um, os tamanhos
que o build.py põe no srcset (FOTO_LADOS, medidos pelo lado maior): foto-NN-400.avif … foto-NN-1600.avif
e o mesmo em WebP. Só faz os que faltam; --todas refaz tudo.
Escreve também data/lqip.json: uma prévia de 16 px de cada fotografia (WebP em base64, ~300 bytes), que o
build.py põe por trás da fotografia enquanto ela descarrega.

    pip install "Pillow>=11.3"                      # AVIF vem incluído a partir do Pillow 11.3
    python3 website/gerar_fotos.py                  # todas as obras, só o que falta
    python3 website/gerar_fotos.py 31 32            # só estas obras
    python3 website/gerar_fotos.py --todas          # refaz todos os ficheiros

Uma obra nova: pôr o foto-NN-1600.jpg (1600×1200 ou 1200×1600, sem dados de localização) na pasta,
correr o script e depois python3 website/build.py --check, que falha se faltar algum tamanho.
"""
import base64
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps, features

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import FOTO_LADOS  # noqa: E402  (os mesmos tamanhos que o srcset pede)

PASTA = Path(__file__).resolve().parent / "assets" / "img" / "obras"
LQIP = Path(__file__).resolve().parent / "data" / "lqip.json"
# qualidade escolhida por comparação com os WebP anteriores (SSIM e recortes a 2x): equivalente à vista,
# AVIF cerca de um quarto mais leve que o WebP com a mesma qualidade
FORMATOS = {"avif": dict(quality=60, speed=4), "webp": dict(quality=80, method=6)}


def gera(jpg, todas=False):
    n = jpg.name[len("foto-"):-len("-1600.jpg")]
    src = Image.open(jpg)
    exif = src.getexif()
    # foto de telemóvel com rodar na EXIF (274) ou com localização (GPS, 0x8825): os tamanhos saem já direitos,
    # mas o JPEG de reserva continua com a EXIF e o build.py mede-o pela orientação de obras.json
    if exif.get(274, 1) != 1 or 0x8825 in exif:
        print(f"Aviso: {jpg.name} tem {'rotação' if exif.get(274, 1) != 1 else ''}"
              f"{' e ' if exif.get(274, 1) != 1 and 0x8825 in exif else ''}{'localização' if 0x8825 in exif else ''}"
              " na EXIF; guardar o JPEG de novo, direito e sem EXIF, e correr com --todas", file=sys.stderr)
    im = ImageOps.exif_transpose(src).convert("RGB")
    feitos = []
    for lado in FOTO_LADOS:
        escala = lado / max(im.size)
        r = im if escala == 1 else im.resize((round(im.width * escala), round(im.height * escala)), Image.LANCZOS)
        for ext, opcoes in FORMATOS.items():
            f = PASTA / f"foto-{n}-{lado}.{ext}"
            if f.exists() and not todas:
                continue
            r.save(f, ext.upper(), **opcoes)
            feitos.append(f.name)
    return feitos


def previa(jpg):
    """Prévia de 16 px no lado maior: as cores e as manchas principais, para o cartão não ficar vazio a carregar."""
    im = ImageOps.exif_transpose(Image.open(jpg)).convert("RGB")
    escala = 16 / max(im.size)
    im = im.resize((max(1, round(im.width * escala)), max(1, round(im.height * escala))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=40, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    if not features.check("avif"):
        sys.exit("Este Pillow não escreve AVIF: pip install -U \"Pillow>=11.3\"")
    todas = "--todas" in sys.argv
    nums = [a.zfill(2) for a in sys.argv[1:] if not a.startswith("--")]
    jpgs = sorted(PASTA.glob("foto-*-1600.jpg"))
    if nums:
        jpgs = [j for j in jpgs if j.name[5:-9] in nums]
    total = 0
    for jpg in jpgs:
        feitos = gera(jpg, todas)
        total += len(feitos)
        if feitos:
            print(f"{jpg.name}: {', '.join(feitos)}")
    print(f"{total} ficheiros novos em {PASTA}")
    # as prévias de todas as obras (rápido; sempre todas, para nunca ficar uma desatualizada)
    previas = {j.name[5:-9]: previa(j) for j in sorted(PASTA.glob("foto-*-1600.jpg"))}
    LQIP.write_text(json.dumps(previas, indent=1) + "\n", encoding="utf-8")
    print(f"{len(previas)} prévias em {LQIP}")


if __name__ == "__main__":
    main()
