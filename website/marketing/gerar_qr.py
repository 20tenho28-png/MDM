"""Códigos QR das carrinhas MDM, em vetor e à medida final, prontos para a gráfica.

Cada código abre carrinha.html com a carrinha e a posição na ligação (?v=01&p=t): o site
junta essa origem ao WhatsApp, ao formulário e à medição, e assim cada contacto diz de que
carrinha e de que lado veio.

    pip install segno
    python3 website/marketing/gerar_qr.py                 # carrinha 01
    python3 website/marketing/gerar_qr.py --carrinhas 3   # carrinhas 01, 02 e 03

O domínio vem de data/site.json (baseUrl). ANTES DE IMPRIMIR: trocar baseUrl pelo domínio
final, gerar de novo e ler cada código com dois telemóveis diferentes. Um código impresso
com o domínio errado não se corrige depois.
"""
import argparse
import json
from pathlib import Path

import segno

AQUI = Path(__file__).resolve().parent
SITE = json.loads((AQUI.parent / "data" / "site.json").read_text(encoding="utf-8"))
SAIDA = AQUI / "qr"

TINTA, BRANCO = "#11161D", "#FFFFFF"

# posição na carrinha: letra na ligação, nome no ficheiro, lado máximo impresso em mm (com a margem branca).
# Regra prática: lê-se até cerca de 10 vezes o lado do código.
POSICOES = [
    ("t", "traseira", 500),          # lida da rua, a 3–5 m: o código grande
    ("e", "lateral-esquerda", 350),  # lida do passeio, de perto
    ("d", "lateral-direita", 350),
    ("m", "iman", 240),              # painel magnético "Hoje estamos a trabalhar aqui"
    ("c", "cartao-vizinho", 30),     # cartão deixado nas caixas do correio do prédio
]
MARGEM = 4  # módulos brancos à volta, o mínimo da norma


def ligacao(n, p):
    return f"{SITE['baseUrl'].rstrip('/')}/carrinha.html?v={n:02d}&p={p}"


def gera(carrinhas):
    SAIDA.mkdir(exist_ok=True)
    feitos = []
    for n in range(1, carrinhas + 1):
        for p, nome, max_mm in POSICOES:
            url = ligacao(n, p)
            # Q: aguenta 25% do código sujo ou riscado, o que numa carrinha acontece
            qr = segno.make(url, error="q", micro=False, boost_error=False)
            modulos = qr.symbol_size(scale=1, border=0)[0]
            modulo_mm = int(max_mm * 10 / (modulos + 2 * MARGEM)) / 10   # módulo redondo, a 0,1 mm
            total = round(modulo_mm * (modulos + 2 * MARGEM), 1)
            f = SAIDA / f"mdm-carrinha-{n:02d}-{nome}.svg"
            qr.save(f, kind="svg", scale=modulo_mm, unit="mm", border=MARGEM, dark=TINTA, light=BRANCO,
                    title=url, desc=f"MDM · carrinha {n:02d} · {nome} · {total} mm com a margem branca",
                    xmldecl=False, svgclass=None, lineclass=None)
            feitos.append((f.name, url, qr.version, modulos, modulo_mm, round(modulo_mm * modulos, 1), total))
    return feitos


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--carrinhas", type=int, default=1, help="quantas carrinhas (numeradas a partir de 01)")
    args = ap.parse_args()
    feitos = gera(args.carrinhas)
    print(f"{len(feitos)} códigos em {SAIDA}  (domínio: {SITE['baseUrl']})\n")
    for nome, url, ver, mod, mm, codigo, total in feitos:
        print(f"  {nome:40s} v{ver} · {mod}×{mod} módulos de {mm} mm · código {codigo} mm · {total} mm com margem")
        print(f"  {'':40s} {url}")
    if "manus.space" in SITE["baseUrl"]:
        print("\nATENÇÃO: baseUrl ainda é o domínio provisório. Não mandar imprimir estes códigos.")
