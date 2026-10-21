#!/usr/bin/env python3
"""Tamanhos das fotografias, em AVIF e WebP, a partir do JPEG original.

O original de cada fotografia é assets/img/fotos/foto-NN.jpg (já com o corte final; é também o JPEG de reserva e a
imagem de partilha). Este script faz, para cada um, os tamanhos que o build.py põe no srcset (FOTO_LADOS, medidos pelo
lado maior, só os menores do que o original, mais o tamanho do original): foto-NN-400.avif … e o mesmo em WebP.
Só faz os que faltam (um ficheiro vazio conta como em falta); --todas refaz tudo. Cada ficheiro é escrito primeiro num
temporário na mesma pasta e só no fim fica com o nome final: interromper o script nunca deixa uma imagem a meio.
Escreve também data/lqip.json: uma prévia de 16 px de cada fotografia (WebP em base64, cerca de 300 bytes), que o
build.py põe por trás da fotografia enquanto ela descarrega.

    pip install "Pillow>=11.3"              # AVIF vem incluído a partir do Pillow 11.3
    python3 gerar_fotos.py                  # todas as fotografias, só o que falta
    python3 gerar_fotos.py 03 04            # só estas
    python3 gerar_fotos.py --todas          # refaz todos os ficheiros

Uma fotografia nova: pôr o foto-NN.jpg na pasta (sem dados de localização na EXIF), registá-la em data/fotos.json
(w, h, origem, alt), correr o script e depois python3 build.py --check, que falha se faltar algum tamanho.
"""
import base64
import io
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageOps, features

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import FOTO_LADOS, FOTOS, lados  # noqa: E402  (os mesmos tamanhos que o srcset pede)

PASTA = Path(__file__).resolve().parent / "assets" / "img" / "fotos"
LQIP = Path(__file__).resolve().parent / "data" / "lqip.json"
FORMATOS = {"avif": dict(quality=60, speed=4), "webp": dict(quality=80, method=6)}


def grava(destino, escreve):
    tmp = destino.with_name(f".{destino.name}.tmp")
    try:
        escreve(tmp)
        os.replace(tmp, destino)
    finally:
        tmp.unlink(missing_ok=True)


def gera(n, todas=False):
    jpg = PASTA / f"foto-{n}.jpg"
    src = Image.open(jpg)
    exif = src.getexif()
    if exif.get(274, 1) != 1 or 0x8825 in exif:
        print(f"Aviso: {jpg.name} tem rotação ou localização na EXIF; guardar o JPEG de novo, direito e sem EXIF, e correr "
              "com --todas", file=sys.stderr)
    im = ImageOps.exif_transpose(src).convert("RGB")
    f = FOTOS[n]
    if im.size != (f["w"], f["h"]):
        sys.exit(f"{jpg.name} mede {im.size[0]}×{im.size[1]}, mas data/fotos.json diz {f['w']}×{f['h']}")
    feitos = []
    for lado in lados(n):
        escala = lado / max(im.size)
        r = im if escala == 1 else im.resize((round(im.width * escala), round(im.height * escala)), Image.LANCZOS)
        for ext, opcoes in FORMATOS.items():
            dest = PASTA / f"foto-{n}-{lado}.{ext}"
            if dest.exists() and dest.stat().st_size > 0 and not todas:
                continue
            grava(dest, lambda tmp: r.save(tmp, ext.upper(), **opcoes))
            feitos.append(dest.name)
    return feitos


def previa(n):
    im = ImageOps.exif_transpose(Image.open(PASTA / f"foto-{n}.jpg")).convert("RGB")
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
    total = 0
    for n in sorted(FOTOS):
        if nums and n not in nums:
            continue
        if not (PASTA / f"foto-{n}.jpg").is_file():
            sys.exit(f"falta {PASTA / f'foto-{n}.jpg'} (data/fotos.json diz que existe)")
        feitos = gera(n, todas)
        total += len(feitos)
        if feitos:
            print(f"foto-{n}.jpg: {', '.join(feitos)}")
    print(f"{total} ficheiros novos em {PASTA}")
    previas = {n: previa(n) for n in sorted(FOTOS) if (PASTA / f"foto-{n}.jpg").is_file()}
    grava(LQIP, lambda tmp: tmp.write_text(json.dumps(previas, indent=1) + "\n", encoding="utf-8"))
    print(f"{len(previas)} prévias em {LQIP}")


if __name__ == "__main__":
    main()
