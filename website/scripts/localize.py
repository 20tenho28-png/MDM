from pathlib import Path
from html.parser import HTMLParser
import html,json,re
root=Path(__file__).resolve().parent.parent
base=root/'public'
translations={}
for file in (root/'i18n').glob('*.tsv'):
 for line in file.read_text(encoding='utf-8').splitlines():
  if '\t' in line:
   k,v=line.split('\t',1);translations[k]=v
lower={k.lower():v for k,v in translations.items()}
missing=set()
def t(value,track=True):
 if value in translations:return translations[value]
 stripped=value.strip()
 if stripped in translations:return value.replace(stripped,translations[stripped])
 if stripped.isupper() and stripped.lower() in lower:return value.replace(stripped,lower[stripped.lower()].upper())
 if stripped.endswith(' | MDM'):return t(stripped[:-6],track)+' | MDM'
 if stripped.endswith(' na Grande Lisboa'):return t(stripped[:-17],track)+' in Greater Lisbon'
 if len(stripped)>100:
  for original,translated in translations.items():
   if original.startswith(stripped):return translated[:160]
 if ' · ' in stripped:return ' · '.join(t(s,track) for s in stripped.split(' · '))
 if stripped.startswith('OBRA MDM · '):return 'MDM PROJECT · '+t(stripped[11:],track)
 if track and re.search('[A-Za-zÀ-ÿ]',stripped) and not re.fullmatch(r'[\d\W]+',stripped) and stripped not in {'MDM','Midea','Mitsubishi Electric','Daikin','France Air','WHATSAPP','WhatsApp','Email','Menu','PT','EN','Português','English','Edifício Vila do Oriente','Alameda dos Oceanos 108 A','M.D.M. · Manuel Domingos Melancia, Lda','1990-426 Lisboa · Parque das Nações','M.D.M.','Manuel Domingos Melancia, Lda','Parque das Nações','1990-426 Lisboa'} and '@' not in stripped:missing.add(stripped)
 return value
class English(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=False);self.out=[]
 def handle_decl(self,d):self.out.append('<!'+d+'>')
 def handle_starttag(self,tag,attrs):
  new=[]
  for key,value in attrs:
   if value is not None:
    if key in ['alt','title','placeholder','aria-label'] or (tag=='meta' and key=='content' and any(k=='name' and v=='description' for k,v in attrs)):value=t(value)
    if tag=='html' and key=='lang':value='en'
    if key=='href' and value.startswith('/') and not value.startswith(('/assets/','/api/','/en/','/signin-with-chatgpt','/signout-with-chatgpt')):value='/en'+value
   new.append(key if value is None else key+'="'+html.escape(value,quote=True)+'"')
  self.out.append('<'+tag+(' '+' '.join(new) if new else '')+'>')
 def handle_startendtag(self,tag,attrs):self.handle_starttag(tag,attrs)
 def handle_endtag(self,tag):self.out.append('</'+tag+'>')
 def handle_data(self,data):self.out.append(html.escape(t(data),quote=False))
 def handle_entityref(self,name):self.out.append('&'+name+';')
 def handle_charref(self,name):self.out.append('&#'+name+';')
 def handle_comment(self,data):self.out.append('<!--'+data+'-->')
def language_switch(pt,en,current):
 return '<div class="language-switch" aria-label="'+('Idioma' if current=='pt' else 'Language')+'"><a lang="pt" hreflang="pt-PT" href="'+pt+'"'+(' aria-current="true"' if current=='pt' else '')+'>PT</a><a lang="en" hreflang="en" href="'+en+'"'+(' aria-current="true"' if current=='en' else '')+'>EN</a></div>'
for path in list(base.rglob('*.html')):
 if 'en' in path.relative_to(base).parts:continue
 rel=path.relative_to(base).as_posix();pt='/' if rel=='index.html' else '/'+rel;en='/en/' if rel=='index.html' else '/en/'+rel
 page=path.read_text(encoding='utf-8');page=re.sub(r'<div class="language-switch".*?</div>','',page)
 page=re.sub(r'<link rel="alternate"[^>]+>','',page)
 page=re.sub(r'<option>([^<]+)</option>',lambda m:'<option value="'+html.escape(html.unescape(m[1]),quote=True)+'">'+m[1]+'</option>',page)
 parser=English();parser.feed(page);english=''.join(parser.out)
 for lang,content,dest in [('pt',page,path),('en',english,base/'en'/rel)]:
  content=content.replace('<button class="btn primary" data-quote>',language_switch(pt,en,lang)+'<button class="btn primary" data-quote>',1)
  content=content.replace('</head>','<link rel="alternate" hreflang="pt-PT" href="'+pt+'"><link rel="alternate" hreflang="en" href="'+en+'"></head>')
  dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(content,encoding='utf-8')
(base/'assets/i18n.js').write_text('window.MDM={language:document.documentElement.lang.startsWith("en")?"en":"pt",strings:'+json.dumps(translations,ensure_ascii=False)+',t(s){return this.language==="en"?(this.strings[s]||s):s}};',encoding='utf-8')
(root/'i18n/missing.json').write_text(json.dumps(sorted(missing),ensure_ascii=False,indent=2),encoding='utf-8')
print('Generated English pages. Translation items to review:',len(missing))
