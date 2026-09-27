#!/usr/bin/env python3
"""Constrói o site v3 (stdlib apenas): python3 build.py  ->  dist/
src/mdm-site-v3.0.html  -> dist/index.html (CSS e JS inline: a home é um ficheiro autónomo)
src/<serviço>.html      -> dist/<serviço>/index.html (partilham dist/assets/v3.css)
"""
import json, re, shutil, html
from pathlib import Path
B = Path(__file__).parent; S = B / 'src'; P = S / 'partials'; D = B / 'dist'
MAN = json.loads((B / 'img' / 'manifest.json').read_text())
SITE = 'https://www.mdmassist.com.pt/'
GBP = 'https://maps.app.goo.gl/1NTJtEvzcYW6Cra18'

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

def pic(spec, root):
    name, alt, sizes, load = spec.split('|')
    ws = MAN[name]['w']; w0, h0 = ws[-1] if load == 'eager' else ws[min(1, len(ws) - 1)]
    ss = lambda ext: ', '.join(f'{root}img/{name}-{w}.{ext} {w}w' for w, h in ws)
    extra = ' fetchpriority="high"' if load == 'eager' else ' loading="lazy"'
    return (f'<picture><source type="image/avif" srcset="{ss("avif")}" sizes="{sizes}"><source type="image/webp" srcset="{ss("webp")}" sizes="{sizes}">'
            f'<img src="{root}img/{name}-{ws[0][0]}.jpg" srcset="{ss("jpg")}" sizes="{sizes}" width="{w0}" height="{h0}" alt="{html.escape(alt)}" decoding="async"{extra}></picture>')
def preload(name, root):
    ws = MAN[name]['w']
    return f'<link rel="preload" as="image" type="image/avif" imagesrcset="{", ".join(f"{root}img/{name}-{w}.avif {w}w" for w, h in ws)}" imagesizes="(min-width: 1024px) 560px, 100vw" fetchpriority="high">'

def render(src, root, page, inline_css):
    t = (S / src).read_text(encoding='utf-8')
    for _ in range(3):
        t = re.sub(r'\{\{include:([^}]+)\}\}', lambda m: (P / m.group(1)).read_text(encoding='utf-8').strip(), t)
    css = (S / 'v3.css').read_text(encoding='utf-8')
    t = t.replace('{{css}}', css if inline_css else '')
    t = re.sub(r'\{\{pic:([^}]+)\}\}', lambda m: pic(m.group(1), root), t)
    t = re.sub(r'\{\{preload:([^}]+)\}\}', lambda m: preload(m.group(1), root), t)
    t = re.sub(r'\{\{faq:(\w+)\}\}', lambda m: faq_html(m.group(1)), t)
    t = re.sub(r'\{\{schema:(\w+)\}\}', lambda m: json.dumps(SCHEMA[m.group(1)], ensure_ascii=False), t)
    t = t.replace('{{page}}', page).replace('{{root}}', root)
    assert '{{' not in t, re.findall(r'\{\{[^}]+\}\}', t)[:3]
    return t

def main():
    if D.exists(): shutil.rmtree(D)
    (D / 'assets').mkdir(parents=True)
    shutil.copytree(B / 'img', D / 'img', ignore=shutil.ignore_patterns('manifest.json'))
    shutil.copytree(B / 'fonts', D / 'fonts')
    (D / 'assets' / 'v3.css').write_text((S / 'v3.css').read_text(encoding='utf-8').replace('{{root}}', '../'), encoding='utf-8')
    (D / 'index.html').write_text(render('mdm-site-v3.0.html', '', 'home', True), encoding='utf-8')
    (D / 'ar-condicionado-lisboa').mkdir()
    (D / 'ar-condicionado-lisboa' / 'index.html').write_text(render('ar-condicionado-lisboa.html', '../', 'ar-condicionado', False), encoding='utf-8')
    for sub, src in [('obrigado', 'obrigado.html')]:
        (D / sub).mkdir(); (D / sub / 'index.html').write_text(render(src, '../', sub, False), encoding='utf-8')
    (D / '404.html').write_text(render('404.html', '/', '404', False).replace('href="/assets', 'href="/assets'), encoding='utf-8')
    (D / 'privacidade').mkdir(); shutil.copy(B.parent / 'privacidade.html', D / 'privacidade' / 'index.html')
    shutil.copy(P / 'logo.svg', D / 'favicon.svg'); shutil.copy(B.parent / 'favicon' / 'logo-180.png', D / 'apple-touch-icon.png')
    (D / 'robots.txt').write_text('# Pré-visualização: não indexar. No lançamento: Allow e Sitemap.\nUser-agent: *\nDisallow: /\n')
    (D / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{SITE}{p}</loc></url>\n' for p in ['', 'ar-condicionado-lisboa/', 'privacidade/']) + '</urlset>\n')
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
- [Política de privacidade]({SITE}privacidade/)
""")
    (D / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n/img/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=31536000, immutable\n')
    print('ok', sorted(str(p.relative_to(D)) for p in D.rglob('*.html')))
main()
