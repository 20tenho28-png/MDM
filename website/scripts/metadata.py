from pathlib import Path
from html import escape, unescape
import re
root=Path(__file__).resolve().parent.parent/'public'
origin='https://mdm-climatizacao-a-medida.jocund-bud-7221.chatgpt.site'
urls=[]
def route(rel):return '/'+('' if rel=='index.html' else rel[:-10] if rel.endswith('index.html') else rel.removesuffix('.html'))
for path in sorted(root.rglob('*.html')):
 rel=path.relative_to(root).as_posix();is_en=rel.startswith('en/');private=path.name in {'gestao.html','404.html'}
 page=path.read_text(encoding='utf-8')
 page=re.sub(r'<(?:link rel="canonical"|meta property="og:[^"]+"|meta name="robots"|meta name="twitter:card")[^>]*>','',page)
 # Avoid carrying PT metadata through the English text generator.
 title=unescape(re.search(r'<title>(.*?)</title>',page)[1]);desc=unescape(re.search(r'<meta name="description" content="([^"]*)"',page)[1])
 absolute=origin+route(rel);pt=rel[3:] if is_en else rel
 page=re.sub(r'<link rel="alternate"[^>]+>','',page)
 metadata='<meta name="robots" content="noindex, nofollow">' if private else '<link rel="canonical" href="'+absolute+'"><meta property="og:type" content="website"><meta property="og:url" content="'+absolute+'"><meta property="og:site_name" content="MDM Assistência Técnica"><meta property="og:title" content="'+escape(title,quote=True)+'"><meta property="og:description" content="'+escape(desc,quote=True)+'"><meta property="og:image" content="'+origin+'/assets/img/foto-28-1600.webp"><meta property="og:locale" content="'+('en_GB' if is_en else 'pt_PT')+'"><meta name="twitter:card" content="summary_large_image">'
 metadata+='<link rel="alternate" hreflang="pt-PT" href="'+origin+route(pt)+'"><link rel="alternate" hreflang="en" href="'+origin+route('en/'+pt)+'">'
 page=page.replace('</head>',metadata+'</head>');path.write_text(page,encoding='utf-8')
 if not private:urls.append(absolute)
(root/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+escape(u)+'</loc></url>' for u in urls)+'</urlset>\n',encoding='utf-8')
(root/'robots.txt').write_text('User-agent: *\nDisallow: /api/\nDisallow: /gestao\nDisallow: /en/gestao\nSitemap: '+origin+'/sitemap.xml\n',encoding='utf-8')
print('Public sitemap URLs:',len(urls))
