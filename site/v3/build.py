#!/usr/bin/env python3
"""Constrói o site v3 (stdlib apenas): python3 build.py  ->  dist/
src/mdm-site-v3.0.html  -> dist/index.html
src/<serviço>.html      -> dist/<serviço>/index.html
Todas as páginas levam o CSS (v3.css minificado) inline: sem pedido que bloqueie a primeira pintura.
"""
from datetime import date
import json, re, shutil, html, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).parent))
from services import SERVICES, NAMES
from pathlib import Path
B = Path(__file__).parent; S = B / 'src'; P = S / 'partials'; D = B / 'dist'
MAN = json.loads((B / 'img' / 'manifest.json').read_text())
SITE = 'https://www.mdmassist.com.pt/'
GBP = 'https://maps.app.goo.gl/1NTJtEvzcYW6Cra18'
# seta das ligações "→": a Geist não tem o glifo U+2192, por isso vai como ícone SVG (traço, currentColor)
ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M14 6l6 6-6 6"/></svg>'
# sizes das fotografias do hero: no telemóvel e no tablet a foto ocupa a largura da .wrap (margens de 20px e, a partir de 641px, 40px).
# O preload tem de usar exatamente a mesma string que o <picture>, senão o browser não reaproveita o ficheiro pré-carregado.
MOB_SIZES = '(min-width: 641px) calc(100vw - 80px), calc(100vw - 40px)'
HERO_SIZES = '(min-width: 1024px) 520px, ' + MOB_SIZES  # hero com foto ao lado do texto (páginas de serviço)
ANOS = date.today().year - 1991
WJ = '\u2060'  # word joiner de "ar-água" (services.py): só no texto visível, nunca em JSON-LD nem llms.txt

FAQ = {
 'home': [
  ('Fazem orçamento sem compromisso?', 'Sim. O orçamento é gratuito e sem compromisso, e os seus dados servem só para responder ao pedido.'),
  ('Que marcas instalam?', 'Trabalhamos com MIDEA, Mitsubishi Electric, Daikin e France Air, entre outras. Escolhemos o equipamento pela divisão e pelo uso, não pela marca.'),
  ('A bomba de calor precisa de obras elétricas?', 'Muitas vezes precisa de um circuito próprio no quadro. Como temos eletricista certificado na equipa, tratamos disso na mesma obra.'),
  ('Fazem contratos de manutenção para casas e lojas?', 'Sim. Fazemos contratos anuais de manutenção preventiva para casas, lojas, condomínios e empresas, com visitas programadas.'),
  ('Que zonas servem?', 'Lisboa e a Grande Lisboa. A sede fica no Parque das Nações, na Alameda dos Oceanos 108A.'),
  ('Como peço assistência para uma avaria?', 'Ligue 218 935 050 (2ª a 6ª, 8h às 17h) ou envie uma fotografia da avaria por WhatsApp para o 910 307 579. Com a fotografia, o técnico percebe logo o que levar.'),
 ],
 'ac': [
  ('Precisam de visitar o local antes do orçamento?', 'Na maioria dos casos, sim. Vemos onde ficam as unidades, o percurso da tubagem e o quadro elétrico. Fotografias da divisão e da fachada ajudam a preparar a visita.'),
  ('O que é um multi-split?', 'É um sistema com várias unidades interiores, cada uma com o seu comando, ligadas a uma só unidade exterior. Faz sentido quando quer climatizar várias divisões sem encher a fachada de equipamentos.'),
  ('A instalação inclui a parte elétrica?', 'Quando é preciso um circuito novo ou uma proteção no quadro, o nosso eletricista certificado trata disso na mesma obra.'),
  ('Que marcas de ar condicionado instalam?', 'MIDEA, Mitsubishi Electric, Daikin e France Air, entre outras.'),
  ('Fazem a manutenção depois da instalação?', 'Sim. A mesma equipa faz a limpeza de filtros e a revisão do equipamento, pontualmente ou com contrato anual.'),
 ],
}

def faq_html(k):
    return '\n'.join(f'      <details><summary>{html.escape(q)}</summary><div><p>{html.escape(a)}</p></div></details>' for q, a in FAQ[k])
def faq_ld(k):
    return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in FAQ[k]]}

ORG = {
 '@type': ['HVACBusiness', 'Electrician'], '@id': SITE + '#mdm',
 'name': 'MDM', 'alternateName': ['MDM Assist', 'MDM AVAC e Assistência Técnica'],
 'legalName': 'M.D.M. - Manuel Domingos Melancia, Lda', 'vatID': 'PT502644761',
 'url': SITE, 'telephone': '+351218935050', 'email': 'mdmassist@mdmassist.com', 'foundingDate': '1991',
 'image': SITE + 'img/hero-split-quarto-1280.jpg', 'logo': SITE + 'apple-touch-icon.png',
 'address': {'@type': 'PostalAddress', 'streetAddress': 'Alameda dos Oceanos 108A, Edifício Vila do Oriente', 'postalCode': '1990-426', 'addressLocality': 'Lisboa', 'addressCountry': 'PT'},
 'areaServed': [{'@type': 'City', 'name': c} for c in ['Lisboa', 'Loures', 'Odivelas', 'Amadora', 'Oeiras', 'Sintra', 'Cascais', 'Almada']],
 'openingHoursSpecification': [{'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], 'opens': '08:00', 'closes': '17:00'}],
 'hasMap': GBP, 'sameAs': [GBP, 'https://www.racius.com/m-d-m-manuel-domingos-melancia-lda/'],
 'knowsAbout': ['Ar condicionado', 'Multi-split', 'Bombas de calor ar-água', 'Instalações elétricas', 'Ventilação', 'Manutenção AVAC'],
}
SCHEMA = {
 'home': {'@context': 'https://schema.org', '@graph': [ORG, faq_ld('home')]},
 'ac': {'@context': 'https://schema.org', '@graph': [
   {'@type': 'Service', 'name': 'Instalação de ar condicionado em Lisboa', 'serviceType': 'Instalação de ar condicionado', 'provider': {'@id': SITE + '#mdm'},
    'areaServed': ORG['areaServed'], 'url': SITE + 'ar-condicionado-lisboa/',
    'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': 'Sistemas', 'itemListElement': [{'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': n}} for n in ['Split mural', 'Multi-split', 'Ar condicionado de conduta']]}},
   {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': SITE}, {'@type': 'ListItem', 'position': 2, 'name': 'Ar condicionado', 'item': SITE + 'ar-condicionado-lisboa/'}]},
   faq_ld('ac'), ORG]},
}

def minify_css(s):
    """Tira comentários e espaços que não contam. Mantém os espaços dentro de calc() e entre seletores (combinador descendente)."""
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    s = re.sub(r'\s+', ' ', s)
    s = re.sub(r'\s*([{};,>])\s*', r'\1', s)
    s = re.sub(r'\s*:\s*', ':', s)  # não há seletores "a :hover" (descendente seguido de pseudo-classe) no CSS do site
    return s.replace(';}', '}').strip()
CSS = minify_css((S / 'v3.css').read_text(encoding='utf-8'))

def pic(spec, root):
    name, alt, sizes, load = spec.split('|')
    if sizes == 'hero': sizes = HERO_SIZES
    ws = MAN[name]['w']; w0, h0 = ws[-1] if load == 'eager' else ws[min(1, len(ws) - 1)]
    ss = lambda ext: ', '.join(f'{root}img/{name}-{w}.{ext} {w}w' for w, h in ws)
    extra = ' fetchpriority="high"' if load == 'eager' else ' loading="lazy"'
    return (f'<picture><source type="image/avif" srcset="{ss("avif")}" sizes="{sizes}"><source type="image/webp" srcset="{ss("webp")}" sizes="{sizes}">'
            f'<img src="{root}img/{name}-{ws[0][0]}.jpg" srcset="{ss("jpg")}" sizes="{sizes}" width="{w0}" height="{h0}" alt="{html.escape(alt)}" decoding="async"{extra}></picture>')
def picad(spec, root):
    """Direção de arte: vertical 4:5 no computador, 4:3 no telemóvel."""
    desk, mob, alt = spec.split('|')
    ss = lambda n, ext: ', '.join(f'{root}img/{n}-{w}.{ext} {w}w' for w, h in MAN[n]['w'])
    w0, h0 = MAN[mob]['w'][-1]
    srcs = ''.join(f'<source media="(min-width: 1024px)" type="image/{t}" srcset="{ss(desk, e)}" sizes="480px">' for t, e in [('avif','avif'),('webp','webp')])
    srcs += ''.join(f'<source type="image/{t}" srcset="{ss(mob, e)}" sizes="{MOB_SIZES}">' for t, e in [('avif','avif'),('webp','webp')])
    return f'<picture>{srcs}<img src="{root}img/{mob}-{MAN[mob]["w"][0][0]}.jpg" srcset="{ss(mob, "jpg")}" sizes="{MOB_SIZES}" width="{w0}" height="{h0}" alt="{html.escape(alt)}" decoding="async" fetchpriority="high"></picture>'
def preloadad(spec, root):
    desk, mob = spec.split('|')
    ss = lambda n: ', '.join(f'{root}img/{n}-{w}.avif {w}w' for w, h in MAN[n]['w'])
    return (f'<link rel="preload" as="image" type="image/avif" media="(min-width: 1024px)" imagesrcset="{ss(desk)}" imagesizes="480px" fetchpriority="high">'
            f'<link rel="preload" as="image" type="image/avif" media="(max-width: 1023px)" imagesrcset="{ss(mob)}" imagesizes="{MOB_SIZES}" fetchpriority="high">')
def preload(name, root):
    ws = MAN[name]['w']
    return f'<link rel="preload" as="image" type="image/avif" imagesrcset="{", ".join(f"{root}img/{name}-{w}.avif {w}w" for w, h in ws)}" imagesizes="{HERO_SIZES}" fetchpriority="high">'

def render(src, root, page, text=None):
    t = text if text is not None else (S / src).read_text(encoding='utf-8')
    for _ in range(3):
        t = re.sub(r'\{\{include:([^}]+)\}\}', lambda m: (P / m.group(1)).read_text(encoding='utf-8').strip(), t)
    t = t.replace('{{css}}', CSS)
    t = re.sub(r'\{\{picad:([^}]+)\}\}', lambda m: picad(m.group(1), root), t)
    t = re.sub(r'\{\{preloadad:([^}]+)\}\}', lambda m: preloadad(m.group(1), root), t)
    t = re.sub(r'\{\{pic:([^}]+)\}\}', lambda m: pic(m.group(1), root), t)
    t = re.sub(r'\{\{preload:([^}]+)\}\}', lambda m: preload(m.group(1), root), t)
    t = re.sub(r'\{\{faq:([\w-]+)\}\}', lambda m: faq_html(m.group(1)), t)
    t = re.sub(r'\{\{schema:([\w-]+)\}\}', lambda m: json.dumps(SCHEMA[m.group(1)], ensure_ascii=False).replace(WJ, ''), t)
    t = t.replace('{{n_fotos}}', str(t.count('<figure class="project">')))  # obras: o número no texto segue a galeria
    t = t.replace('{{anos}}', str(ANOS))  # anos desde 1991, atualiza a cada build
    t = t.replace('{{page}}', page).replace('{{root}}', root)
    t = t.replace('<span aria-hidden="true">→</span>', f'<span class="arr" aria-hidden="true">{ARROW}</span>')
    if 'id="orcamento"' not in t:  # página sem formulário (404, obrigado): "Pedir orçamento" leva ao formulário da home
        t = t.replace('href="#orcamento"', f'href="{root}#orcamento"')
    t = re.sub(r'<style>(.*?)</style>', lambda m: '<style>' + minify_css(m.group(1)) + '</style>', t, flags=re.S)  # também o CSS próprio de uma página
    assert '{{' not in t, re.findall(r'\{\{[^}]+\}\}', t)[:3]
    return t

def service_page(slug, d):
    """Página de serviço a partir de src/_servico.html e de services.py."""
    esc = html.escape
    FAQ[slug] = d['faq']
    SCHEMA[slug] = {'@context': 'https://schema.org', '@graph': [
        {'@type': 'Service', 'name': d['h1'], 'serviceType': d['service_type'], 'provider': {'@id': SITE + '#mdm'}, 'areaServed': ORG['areaServed'], 'url': SITE + slug + '/',
         'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': d['nav'], 'itemListElement': [{'@type': 'Offer', 'itemOffered': {'@type': 'Service', 'name': n}} for n in d['offers']]}},
        {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': SITE}, {'@type': 'ListItem', 'position': 2, 'name': d['nav'], 'item': SITE + slug + '/'}]},
        faq_ld(slug), ORG]}
    h = d['hero']
    if h[0] == 'pic':
        hero = f'{{{{pic:{h[1]}|{h[2]}|hero|eager}}}}\n      <figcaption>{esc(h[3])}</figcaption>'; preload = f'{{{{preload:{h[1]}}}}}'
    else:
        hero = f'{{{{include:{h[1]}}}}}'; preload = ''
    types = '\n'.join(f'      <div class="type"><h3>{esc(a)}</h3><p>{esc(b)}</p></div>' for a, b in d['types'])
    feat = ''
    if d['feature']:
        f = d['feature']; aside = ''
        if f['aside'] and f['aside'][0] == 'svg':
            aside = f'<div>{{{{include:{f["aside"][1]}}}}}</div>'
        elif f['aside']:
            a = f['aside']; aside = f'<figure class="project">{{{{pic:{a[1]}|{a[2]}|(min-width: 1024px) 560px, 100vw|lazy}}}}<figcaption><b>{esc(a[3])}</b></figcaption></figure>'
        body = ''.join(f'<p>{esc(x)}</p>' for x in f['body'])
        feat = f'''<section class="section" id="{f['id']}" aria-labelledby="h-feat">
  <div class="wrap{' ms-grid' if aside else ''}">
    <div class="prose"><h2 id="h-feat">{esc(f['title'])}</h2>{body}</div>
    {aside}
  </div>
</section>'''
    inc = '\n'.join(f'      <li><strong>{esc(a)}.</strong> {esc(b)}</li>' for a, b in d['included'])
    gal = ''
    if d['gallery']:
        cards = ''.join(f'<figure class="project">{{{{pic:{n}|{alt}|(min-width: 1024px) 373px, 50vw|lazy}}}}<figcaption><b>{esc(b)}</b><span>{esc(sm)}</span></figcaption></figure>' for n, alt, b, sm in d['gallery'])
        gal = f'<section class="section" aria-labelledby="h-obras-s"><div class="wrap"><div class="sec-head"><h2 id="h-obras-s">Trabalho real da nossa equipa.</h2></div><div class="gallery">{cards}</div><p class="gal-more"><a class="btn btn--secondary" href="{{{{root}}}}obras/">Ver todas as obras</a></p></div></section>'
    rel = '\n'.join(f'      <a href="{{{{root}}}}{r}/">{esc(NAMES[r])} <span aria-hidden="true">→</span></a>' for r in d['related'])
    t = (S / '_servico.html').read_text(encoding='utf-8')
    for k, v in {'TITLE': esc(d['title']), 'DESC': esc(d['desc']), 'SLUG': slug, 'PRELOAD': preload, 'SCHEMA': slug, 'PAGE': d['page'], 'SERVICO': esc(d['servico']),
                 'NAV': esc(d['nav']), 'EYEBROW': esc(d['eyebrow']), 'H1': esc(d['h1']), 'LEAD': esc(d['lead']), 'HERO': hero, 'TYPES_TITLE': esc(d['types_title']), 'TYPES': types,
                 'FEATURE': feat, 'INCLUDED': inc, 'INCLUDED_TITLE': esc(d.get('included_title', 'Do primeiro contacto à manutenção.')), 'GALLERY': gal, 'FAQ': slug, 'FORM_TITLE': esc(d['form_title']), 'FORM_LEAD': esc(d['form_lead']), 'RELATED': rel}.items():
        t = t.replace('%' + k + '%', v)
    return render(None, '../', d['page'], text=t)

def main():
    if D.exists(): shutil.rmtree(D)
    D.mkdir()
    shutil.copytree(B / 'img', D / 'img', ignore=shutil.ignore_patterns('manifest.json'))
    shutil.copytree(B / 'fonts', D / 'fonts')
    (D / 'index.html').write_text(render('mdm-site-v3.0.html', '', 'home'), encoding='utf-8')
    (D / 'ar-condicionado-lisboa').mkdir()
    (D / 'ar-condicionado-lisboa' / 'index.html').write_text(render('ar-condicionado-lisboa.html', '../', 'ar-condicionado'), encoding='utf-8')
    for slug, d in SERVICES.items():
        (D / slug).mkdir(); (D / slug / 'index.html').write_text(service_page(slug, d), encoding='utf-8')
    SCHEMA['obras'] = {'@context': 'https://schema.org', '@graph': [{'@type': 'CollectionPage', 'name': 'Obras da MDM em Lisboa', 'url': SITE + 'obras/', 'about': {'@id': SITE + '#mdm'}}, {'@type': 'BreadcrumbList', 'itemListElement': [{'@type': 'ListItem', 'position': 1, 'name': 'Início', 'item': SITE}, {'@type': 'ListItem', 'position': 2, 'name': 'Obras', 'item': SITE + 'obras/'}]}, ORG]}
    (D / 'obras').mkdir(); (D / 'obras' / 'index.html').write_text(render('obras.html', '../', 'obras'), encoding='utf-8')
    for sub, src in [('obrigado', 'obrigado.html')]:
        (D / sub).mkdir(); (D / sub / 'index.html').write_text(render(src, '../', sub), encoding='utf-8')
    (D / '404.html').write_text(render('404.html', '/', '404'), encoding='utf-8')
    (D / 'privacidade').mkdir(); (D / 'privacidade' / 'index.html').write_text(render('privacidade.html', '../', 'privacidade'), encoding='utf-8')
    shutil.copy(P / 'logo.svg', D / 'favicon.svg'); shutil.copy(B.parent / 'favicon' / 'logo-180.png', D / 'apple-touch-icon.png')
    (D / 'robots.txt').write_text('# Pré-visualização: não indexar. No lançamento: Allow e Sitemap.\nUser-agent: *\nDisallow: /\n')
    (D / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{SITE}{p}</loc></url>\n' for p in ['', 'ar-condicionado-lisboa/'] + [k + '/' for k in SERVICES] + ['obras/']) + '</urlset>\n')  # privacidade/ fica de fora: é noindex
    SVC_LINKS = ''.join(f"- [{d['h1'].replace(WJ, '')}]({SITE}{k}/)\n" for k, d in SERVICES.items())
    (D / 'llms.txt').write_text(f"""# MDM · AVAC e assistência técnica (Lisboa)

> M.D.M. - Manuel Domingos Melancia, Lda (NIF 502 644 761). Empresa de Lisboa, fundada em 1991, com sede no Parque das Nações. Instala e mantém ar condicionado (split, multi-split, conduta) e bombas de calor ar-água, faz instalações elétricas e ventilação, para casas, apartamentos, lojas e condomínios na Grande Lisboa. A mesma equipa instala, faz a ligação elétrica e a manutenção.

- Telefone: +351 218 935 050 (2ª a 6ª, 8h às 17h)
- WhatsApp: +351 910 307 579
- Email: mdmassist@mdmassist.com
- Morada: Alameda dos Oceanos 108A, Edifício Vila do Oriente, 1990-426 Lisboa
- Perfil Google: {GBP}

## Páginas
- [Início]({SITE})
- [Instalação de ar condicionado em Lisboa]({SITE}ar-condicionado-lisboa/)
{SVC_LINKS}- [Obras (fotografias de trabalho real)]({SITE}obras/)
- [Política de privacidade]({SITE}privacidade/)
""")
    shutil.copy(S / '_redirects', D / '_redirects')  # 301 dos sites antigos (lista a completar após rastreio)
    (D / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n/img/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n')
    print('ok', sorted(str(p.relative_to(D)) for p in D.rglob('*.html')))
main()
