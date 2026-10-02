"""Gera o site/variante-navy/index.html (variante escura, arquivada) a partir das fontes.

    cd site/src && python3 assemble.py

Junta src_head + src_body + src_script e injeta:
  - o logótipo (../mdm-logo.svg) na nav e no rodapé
  - o favicon PNG (../favicon/*.png) no <head>
  - as 14 fotografias de obra (../obras/*.jpg) no carrossel

Sem dependências — só a biblioteca padrão.
"""
import base64, json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
src = lambda f: os.path.join(HERE, f)
site = lambda *a: os.path.join(SITE, *a)
read = lambda path: open(path, encoding='utf-8').read()
b64 = lambda path: base64.b64encode(open(path, 'rb').read()).decode()

def foto_uri(nome):
    """data URI da obra: escolhe o mais pequeno entre .webp e .jpg."""
    j, w = site('obras', nome + '.jpg'), site('obras', nome + '.webp')
    if os.path.exists(w) and os.path.getsize(w) < os.path.getsize(j):
        return 'data:image/webp;base64,' + b64(w)
    return 'data:image/jpeg;base64,' + b64(j)

head   = read(src('src_head.html'))
body   = read(src('src_body.html'))
script = read(src('src_script.html'))
obras  = json.load(open(src('obras.json'), encoding='utf-8'))

# ── 1. favicon + apple-touch-icon (PNG rasterizado do logótipo) ──────────────
favicon = (
    '<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,%s">\n'
    '<link rel="apple-touch-icon" sizes="180x180" href="data:image/png;base64,%s">\n'
) % (b64(site('favicon', 'logo-32.png')), b64(site('favicon', 'logo-180.png')))
assert '<meta name="theme-color"' in head
head = head.replace('<meta name="theme-color"', favicon + '<meta name="theme-color"', 1)

# ── 2. CSS da secção Fornecedores ───────────────────────────────────────────
SUP_CSS = """
  /* ═══ FORNECEDORES — meia página, marquee p/ esquerda ═══ */
  .sup {
    min-height: 50vh;
    display: flex; flex-direction: column; justify-content: center;
    gap: clamp(28px, 4vw, 48px);
    padding-block: clamp(48px, 6vw, 80px);
    border-top: 1px solid var(--line);
    overflow: hidden;
  }
  .sup-head, .sup-foot { max-width: 1240px; margin: 0 auto; width: 100%; padding-inline: var(--pad); }
  .sup-lede { margin-top: 18px; max-width: 48ch; color: var(--on-dark-2); font-size: 15px; }

  .marquee {
    overflow: hidden;
    -webkit-mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent);
            mask-image: linear-gradient(to right, transparent, #000 7%, #000 93%, transparent);
  }
  .marquee-track { display: flex; width: max-content; animation: sup-left var(--dur, 34s) linear infinite; }
  .marquee:hover .marquee-track,
  .marquee:focus-within .marquee-track { animation-play-state: paused; }

  .marquee-row { display: flex; list-style: none; }
  .marquee-row li {
    display: flex; align-items: center; gap: clamp(28px, 4vw, 62px);
    padding-right: clamp(28px, 4vw, 62px);
    white-space: nowrap;
    font-family: var(--display); font-weight: 500;
    font-size: clamp(24px, 3.6vw, 46px); letter-spacing: -0.035em;
    color: var(--on-dark); opacity: 0.72;
    transition: opacity .3s, color .3s;
  }
  /* logótipos PNG: normaliza pela altura ótica, não pela caixa */
  .marquee-row li img {
    height: clamp(26px, 3vw, 40px); width: auto;
    object-fit: contain;
    filter: brightness(0) invert(1);   /* qualquer PNG fica a branco sobre navy */
    opacity: 0.9;
  }
  .marquee-row li::after {
    content: ''; flex: none; width: 7px; height: 7px;
    background: var(--red-mark); transform: rotate(45deg);
  }
  .marquee-row li:hover { opacity: 1; color: var(--red-ink); }

  .sup-foot {
    display: flex; align-items: center; gap: 12px;
    font-family: var(--mono); font-size: 11px;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--on-dark-3);
  }
  .sup-dot { width: 6px; height: 6px; background: var(--red-mark); transform: rotate(45deg); flex: none; }

  @keyframes sup-left {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }   /* = uma lista → costura invisível */
  }
  @media (max-width: 620px) { .sup { min-height: 46vh; } }
  @media (prefers-reduced-motion: reduce) {
    /* sem animação vira uma lista que se desliza à mão: sem fade nas pontas
       (senão a 1ª marca aparece cortada) e alinhada à margem do conteúdo */
    .marquee {
      overflow-x: auto;
      padding-inline: var(--pad);
      -webkit-mask-image: none; mask-image: none;
    }
    .marquee-track { animation: none; }
    .marquee-row[aria-hidden="true"] { display: none; }
  }
</style>"""
assert head.rstrip().endswith('</head>')
head = head.replace('</style>', SUP_CSS, 1)

# ── 3. as fotografias de obra ───────────────────────────────────────────────
figs = []
for i in range(1, len(obras) + 1):
    o = obras['obra%d' % i]
    figs.append(
        '      <figure class="shot">\n'
        '        <img src="%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async">\n'
        '        <figcaption>%s</figcaption>\n'
        '      </figure>' % (foto_uri('obra%d' % i), o['alt'], o['w'], o['h'], o['alt'])
    )
body = body.replace('{{OBRAS}}', '\n'.join(figs).strip())

# fotos avulsas referenciadas como PHOTO(obraN) (ex.: cartões de serviços)
body = re.sub(r'PHOTO\((obra\d+)\)', lambda m: foto_uri(m.group(1)), body)

# ── 4. logótipo (nav + rodapé) ──────────────────────────────────────────────
body = body.replace('{{LOGO_SVG}}', read(site('mdm-logo.svg')).strip())

out = head + '\n' + body + '\n' + script
left = re.findall(r'\{\{[A-Z_]+\}\}', out)
assert not left, 'placeholders por substituir: %s' % set(left)

import os as _os
_os.makedirs(site('variante-navy'), exist_ok=True)
open(site('variante-navy', 'index.html'), 'w', encoding='utf-8').write(out)
print('variante-navy/index.html  %.0f KB  (%d linhas)' % (len(out.encode()) / 1024, out.count('\n') + 1))
