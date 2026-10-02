#!/usr/bin/env python3
"""Gera a versão de ficheiro único da variante carmim.

A pasta publica-se tal como está (index.html + img/ + fonts/). Este script
embute as imagens, a fonte e o logótipo como data: URIs, para mostrar a
alguém com um duplo clique e sem internet.

    python3 unico.py saida.html
"""
import base64
import pathlib
import re
import sys

AQUI = pathlib.Path(__file__).resolve().parent
TIPOS = {'.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
         '.svg': 'image/svg+xml', '.woff2': 'font/woff2'}


def data_uri(caminho):
    f = AQUI / caminho
    return 'data:%s;base64,%s' % (TIPOS[f.suffix], base64.b64encode(f.read_bytes()).decode())


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    s = (AQUI / 'index.html').read_text(encoding='utf-8')
    # o preload da fonte deixa de fazer sentido quando ela vai embutida
    s = re.sub(r'<link rel="preload" href="fonts/[^"]+"[^>]*>\n?', '', s)
    usados = sorted(set(re.findall(r'(?:img|fonts)/[A-Za-z0-9._-]+\.(?:webp|jpg|png|svg|woff2)', s)))
    for c in usados:
        s = s.replace(c, data_uri(c))
    falta = re.findall(r'(?:src|href)="(?:img|fonts)/', s)
    if falta:
        sys.exit('ficaram referências por embutir: %d' % len(falta))
    pathlib.Path(sys.argv[1]).write_text(s, encoding='utf-8')
    print('%s: %d KB, %d ficheiros embutidos' % (sys.argv[1], len(s.encode()) // 1024, len(usados)))


if __name__ == '__main__':
    main()
