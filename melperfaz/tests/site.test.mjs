/* O site gerado, sem browser: gera numa pasta temporária (MELPERFAZ_OUT) com --check e confere as páginas, a cabeça de
   cada uma, o formulário Netlify, o mapa do site, as fichas de obra, as fotografias e as regras de texto. No fim, que o
   --check falha quando se parte uma ligação ou se escreve um travessão, e que o build.py se recusa a apagar a pasta
   errada. Uso, a partir de melperfaz/:  node --test tests/ */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'melperfaz-site-'));
const PUB = path.join(tmp, 'public');
const SITE = JSON.parse(fs.readFileSync(path.join(W, 'data/site.json'), 'utf8'));
const OBRAS = JSON.parse(fs.readFileSync(path.join(W, 'data/obras.json'), 'utf8')).obras;
// o vocabulário: o serviço de cada obra é o de site.json «servicos» com o mesmo «cat»
const SERVICOS = SITE.servicos;
const servicoDe = o => SERVICOS.find(s => s.cat && s.cat === o.cat);
const TIPOS = [...SERVICOS.map(s => s.nome), 'Outro'];
const FOTOS = Object.entries(JSON.parse(fs.readFileSync(path.join(W, 'data/fotos.json'), 'utf8'))).filter(([k]) => !k.startsWith('_'));
const le = f => fs.readFileSync(path.join(PUB, f), 'utf8');
// o HTML sem os comentários (os parciais explicam-se em comentários que falam dos nomes antigos e dos rótulos)
const leV = f => le(f).replace(/<!--[\s\S]*?-->/g, '');
// o texto como o HTML gerado o escreve (html.escape do build.py), pronto para entrar numa RegExp
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const paginas = () => {
  const out = [];
  const anda = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory() && e.name !== 'assets') anda(p); else if (e.name.endsWith('.html')) out.push(path.relative(PUB, p)); } };
  anda(PUB);
  return out.sort();
};
let saida = '';

before(() => {
  saida = execFileSync('python3', ['build.py', '--check'], { cwd: W, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: PUB } });
});
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

test('o --check passa e gera todas as páginas', () => {
  assert.match(saida, /Sem ligações ou recursos partidos/);
  const esperadas = ['404.html', 'index.html', 'obras.html', 'obrigado.html', 'orcamento.html', 'privacidade.html', ...OBRAS.map(o => `obras/${o.slug}.html`)].sort();
  assert.deepEqual(paginas(), esperadas);
  assert.ok(fs.existsSync(path.join(PUB, '.gerado-por-build')));
});

test('o mapa do site e o robots.txt', () => {
  const mapa = le('sitemap.xml');
  const urls = [...mapa.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const fora = ['404.html', 'obrigado.html'];
  const esperadas = paginas().filter(p => !fora.includes(p)).map(p => `${SITE.baseUrl}/${p === 'index.html' ? '' : p}`);
  assert.deepEqual(urls.sort(), esperadas.sort());
  const robots = le('robots.txt');
  if (SITE.preview) assert.match(robots, /Disallow: \//);
  else { assert.match(robots, new RegExp(`Sitemap: ${SITE.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/sitemap.xml`)); assert.doesNotMatch(robots, /Disallow: \//); }
});

test('cada página: lang, um h1, título, descrição, canonical, og, JSON-LD, versões, sem travessões', () => {
  for (const f of paginas()) {
    const t = le(f);
    assert.match(t, /<html lang="pt-PT">/, f);
    assert.equal((t.match(/<h1\b/g) || []).length, 1, `${f}: um h1`);
    const titulo = /<title>([^<]+)<\/title>/.exec(t);
    assert.ok(titulo && titulo[1].trim(), `${f}: título`);
    const desc = /<meta name="description" content="([^"]*)"/.exec(t);
    assert.ok(desc && desc[1].length > 20 && desc[1].length <= 160, `${f}: descrição entre 20 e 160`);
    const canon = /<link rel="canonical" href="([^"]+)"/.exec(t)[1];
    assert.equal(canon, `${SITE.baseUrl}/${f === 'index.html' ? '' : f}`, `${f}: canonical`);
    const og = /<meta property="og:image" content="([^"]+)"/.exec(t)[1];
    assert.ok(fs.existsSync(path.join(PUB, og.slice(SITE.baseUrl.length + 1))), `${f}: og:image existe`);
    const lds = [...t.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
    assert.ok(lds.some(l => l['@type'] === 'GeneralContractor' && l.telephone === SITE.phoneE164), `${f}: JSON-LD da empresa`);
    for (const m of t.matchAll(/assets\/(css|js)\/([^"?]+)\?v=([0-9a-f]{8})"/g)) {
      assert.ok(fs.existsSync(path.join(PUB, 'assets', m[1], m[2])), `${f}: ${m[2]} existe`);
    }
    assert.ok(/assets\/css\/site\.css\?v=/.test(t) && /assets\/js\/site\.js\?v=/.test(t), `${f}: CSS e JS com versão`);
    const visivel = t.replace(/<!--.*?-->/gs, '').replace(/<script.*?<\/script>/gs, '');
    assert.ok(!visivel.includes('\u2014'), `${f}: sem travessões`);
    assert.ok(!visivel.includes('{{'), `${f}: sem sintaxe de modelo`);
    assert.match(t, /<a class="skip" href="#conteudo">/, `${f}: ligação para saltar`);
    assert.match(t, /<footer class="rodape s-ink">[\s\S]*href="https:\/\/wa\.me\/351961245288\?text=/, `${f}: WhatsApp no rodapé`);
    assert.doesNotMatch(t, /class="wa-float"/, `${f}: sem a bolha de WhatsApp (sai do site)`);
    assert.match(t, /<main id="conteudo" tabindex="-1">/, f);
    assert.match(t, /<link rel="prefetch" href="(?:\/|(?:\.\.\/)*)orcamento\.html">/, `${f}: prefetch de orcamento.html`);
    // cada «Pedir Orçamento» (texto ou aria-label) leva a orcamento.html; já não há #contacto como destino
    for (const m of t.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)) {
      const rotulo = (m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + ' ' + ((/aria-label="([^"]*)"/.exec(m[1]) || [])[1] || ''));
      if (!/pedir or[cç]amento/i.test(rotulo)) continue;
      const href = (/href="([^"]*)"/.exec(m[1]) || [])[1];
      assert.match(href, /^(?:\/|(?:\.\.\/)*)orcamento\.html(?:\?[^#]*)?$/, `${f}: «${rotulo.trim()}» → ${href}`);
    }
    assert.doesNotMatch(t, /href="[^"]*#contacto"/, `${f}: nenhuma ligação para #contacto`);
    // o cabeçalho: o telefone sempre; a barra de ações em todas as páginas menos obrigado.html
    assert.match(t, /<header class="topo[^"]*"[\s\S]*?<a class="topo-tel" href="tel:\+351961245288">/, `${f}: telefone no cabeçalho`);
    const barra = /<nav class="barra" aria-label="Contactos rápidos">([\s\S]*?)<\/nav>/.exec(t);
    if (f === 'obrigado.html') assert.ok(!barra && !/class="grain com-barra"/.test(t), `${f}: sem barra de ações`);
    else {
      assert.ok(barra, `${f}: barra de ações`);
      assert.match(t, /<body class="grain com-barra"/, `${f}: o body reserva o espaço da barra`);
      const cels = [...barra[1].matchAll(/<a class="barra-cel[^"]*" href="([^"]+)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/a>/g)].map(m => m[2]);
      assert.deepEqual(cels, f === 'orcamento.html' ? ['Ligar', 'WhatsApp', 'Enviar fotografias'] : ['Ligar', 'WhatsApp', 'Orçamento'], `${f}: células da barra`);
    }
    assert.match(t, /<img src="[^"]*logo-melperfaz-branco\.png"[^>]*loading="eager">/, `${f}: logótipo do rodapé sem carregamento diferido`);
  }
});

test('o cabeçalho, o menu e o rodapé: uma só lista, página atual sem JavaScript, variante reduzida', () => {
  const nav = { 'index.html': 'inicio', 'obras.html': 'obras' };
  for (const f of ['index.html', 'obras.html', `obras/${OBRAS[0].slug}.html`, 'orcamento.html', 'privacidade.html']) {
    const t = le(f);
    const topo = [.../<ul class="navlinks">([\s\S]*?)<\/ul>/.exec(t)[1].matchAll(/<a data-nav-item="([^"]+)" href="[^"]+"( aria-current="page")?>([^<]+)<\/a>/g)];
    assert.deepEqual(topo.map(m => m[3]), SITE.menu.map(m => m.nome), `${f}: o menu é site.json «menu»`);
    const atual = f.startsWith('obras/') ? 'obras' : nav[f];
    assert.deepEqual(topo.filter(m => m[2]).map(m => m[1]), atual ? [atual] : [], `${f}: aria-current na página atual`);
    const painel = /<div class="menu-movel s-ink" id="menu-movel" hidden>([\s\S]*?)<\/div>/.exec(t)[1];
    const itens = [...painel.matchAll(/<a href="[^"]+"[^>]*>([^<]+)<\/a>/g)].map(m => m[1]);
    assert.deepEqual(itens, [...SITE.menu.map(m => m.nome), 'Pedir Orçamento', `Ligar ${SITE.phone}`, 'Falar por WhatsApp'], `${f}: o painel tem a mesma lista e os três canais`);
    assert.match(t, /<div class="menu-fundo" data-menu-fundo hidden><\/div>/, `${f}: fundo escurecido do menu`);
    assert.match(t, /<a class="topo-wa" href="https:\/\/wa\.me\/[^"]+" target="_blank" rel="noopener" aria-label="Falar por WhatsApp">/, `${f}: WhatsApp no cabeçalho`);
    if (f === 'orcamento.html') {
      assert.doesNotMatch(t, /class="btn topo-btn"/, 'orcamento.html: sem o botão no cabeçalho');
      assert.match(t, /<span class="topo-atual" aria-current="page">Orçamento gratuito<\/span>/);
    } else assert.match(t, /<a href="[^"]*orcamento\.html[^"]*" class="btn topo-btn">Pedir Orçamento<\/a>/, `${f}: «Pedir Orçamento» no cabeçalho`);
    const rodape = /<footer class="rodape s-ink">([\s\S]*?)<\/footer>/.exec(t)[1];
    const site = [.../<p class="foot-h" id="footSite">Site<\/p>([\s\S]*?)<\/nav>/.exec(rodape)[1].matchAll(/>([^<]+)<\/a>/g)].map(m => m[1]);
    assert.deepEqual(site, [...SITE.menu.map(m => m.nome), 'Pedir Orçamento', 'Política de privacidade'], `${f}: rodapé «Site»`);
    assert.match(rodape, /Livro de Reclamações/);
    assert.doesNotMatch(rodape, /Anos \(|Empresa Licenciada|#servicos/, `${f}: saem os anos, «Empresa Licenciada» solto e os serviços repetidos`);
  }
  // obrigado.html: cabeçalho reduzido (logótipo e telefone), sem menu, sem barra, sem «Pedir Orçamento» em lado nenhum
  const obg = leV('obrigado.html');
  assert.match(obg, /<header class="topo topo-reduzido" data-topo>/);
  assert.doesNotMatch(obg, /navlinks|data-menu|menu-movel|class="barra"/);
  assert.doesNotMatch(obg, /Pedir Or[cç]amento/i, 'obrigado.html não volta a pedir orçamento');
});

test('os parciais novos: PageHead, CtaBand e ProofLine', () => {
  for (const f of ['obras.html', `obras/${OBRAS[0].slug}.html`, 'orcamento.html', 'privacidade.html', 'obrigado.html', '404.html']) {
    const t = leV(f);
    assert.match(t, /<section class="sec s-paper page-head[^"]*" aria-labelledby="pagT">[\s\S]*?<h1 id="pagT">/, `${f}: PageHead`);
    assert.doesNotMatch(t, /pag-cab|obra-cab/, `${f}: sem os cabeçalhos antigos`);
  }
  assert.match(le('obras.html'), /<nav class="migalhas" aria-label="Migalhas"><a href="index\.html">Início<\/a><span aria-hidden="true">›<\/span><span aria-current="page">Obras<\/span><\/nav>/);
  assert.match(le('privacidade.html'), /Última atualização: <time datetime="\d{4}-\d\d-\d\d">/);
  assert.doesNotMatch(le('obrigado.html'), /class="migalhas"/, 'sem migalhas onde não há breadcrumb');
  assert.match(le('orcamento.html'), /<section class="sec s-paper page-head page-head-compacto"/);
  // a CtaBand: o mesmo layout em todas as páginas que a têm; a ProofLine com as provas de site.json
  for (const f of ['index.html', 'obras.html', `obras/${OBRAS[0].slug}.html`]) {
    const cta = /<section class="sec cta s-clay"[^>]*>([\s\S]*?)<\/section>/.exec(le(f));
    assert.ok(cta, `${f}: CtaBand`);
    assert.match(cta[1], /<a href="tel:\+351961245288" class="cta-phone">/, `${f}: telefone na faixa`);
    const provas = [.../<ul class="prova">(.*?)<\/ul>/.exec(cta[1])[1].matchAll(/<li>([^<]+)<\/li>/g)].map(m => m[1]);
    assert.deepEqual(provas, SITE.provas, `${f}: ProofLine`);
  }
  assert.match(le('index.html'), /<section class="sec cta s-clay" id="contacto" aria-labelledby="ctaT">[\s\S]*?<h2 id="ctaT">Peça o orçamento\. A visita é gratuita\.<\/h2>/);
  for (const f of paginas()) assert.ok(!/class="cta-inner"|class="cta-form"|class="cta-faixa/.test(leV(f)), `${f}: sem as faixas antigas`);
});

test('a página inicial: secções pela ordem do sistema de desenho, cartões, passos, obras e comparador', () => {
  const t = le('index.html');
  const ordem = ['id="top"', 'id="servicos"', 'id="processo"', 'id="obras"', 'id="porque-nos"', 'id="contacto"'];
  let pos = 0;
  for (const marca of ordem) { const i = t.indexOf(marca); assert.ok(i > pos, `ordem: ${marca}`); pos = i; }
  assert.equal((t.match(/<a class="svc reveal"/g) || []).length, 6, 'seis serviços');
  assert.equal((t.match(/<li class="step reveal"/g) || []).length, 4, 'quatro passos');
  const grelha = /<div class="photo-grid">(.*?)<\/div>\s*<div class="ba-wrap/s.exec(t);
  assert.ok(grelha, 'grelha das obras antes do comparador');
  assert.equal((grelha[1].match(/<figure class="pg reveal" data-cat="/g) || []).length, OBRAS.length);
  assert.match(t, /<input type="range" min="0" max="100" value="50" class="ba-range" data-ba-range aria-label="Comparar demolição e acabamento">/);
  assert.match(t, /<em>de raiz\.<\/em>/);
  const anos = new Date().getFullYear() - Number(SITE.founded);
  assert.match(t, new RegExp(`${anos} anos de ofício`));
  // hero «split»: um só cartão «25 anos, desde 2001», sem rotação; saem o marquee, o stat card e o «100%»
  assert.match(t, /<section class="hero s-paper" id="top"[^>]*>\s*<div class="wrap hero-grid">/);
  assert.match(t, new RegExp(`<p class="tag-card"><span class="n">${anos}</span><span class="l">anos, desde ${SITE.founded}</span></p>`));
  for (const fora of ['class="strip"', 'stat-card', 'hero-cheio', 'hero-tag2', 'hero-foto-leg', '100%</span>']) assert.ok(!t.includes(fora), `sem ${fora}`);
  // as superfícies, pela ordem da página: paper, bone, paper, ink, bone, clay e o rodapé ink
  const sups = [...t.matchAll(/<(?:section|footer) class="[^"]*\b(s-(?:paper|bone|ink|clay))\b/g)].map(m => m[1]);
  assert.deepEqual(sups, ['s-paper', 's-bone', 's-paper', 's-ink', 's-bone', 's-clay', 's-ink']);
  const pre = [...t.matchAll(/<a class="svc reveal" href="orcamento\.html\?tipo=([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(pre, SERVICOS.map(s => s.id), 'um cartão por serviço, que leva a orcamento.html com o id de site.json «servicos»');
  assert.doesNotMatch(t, /id="quoteForm"|data-preselect/, 'a página inicial já não tem formulário');
  const nomes = [...t.matchAll(/<a class="svc reveal"[^>]*><span class="num">\d\d<\/span><h3>([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(nomes, SERVICOS.map(s => esc(s.nome).replace(/\\/g, '')), 'os nomes dos cartões são os dos serviços');
});

test('o formulário Netlify: só em orcamento.html, atributos, campos pela ordem, opções, isco e agradecimento', () => {
  for (const f of paginas()) if (f !== 'orcamento.html') assert.doesNotMatch(le(f), /id="quoteForm"/, `${f}: sem formulário`);
  const t = le('orcamento.html');
  const form = /<form\b[^>]*\bid="quoteForm"[^>]*>.*?<\/form>/s.exec(t)[0];
  const abre = form.slice(0, form.indexOf('>') + 1);
  for (const a of [' name="orcamento"', ' method="POST"', ' data-netlify="true"', ' netlify-honeypot="bot-field"', ' action="/obrigado.html"']) assert.ok(abre.includes(a), a);
  const nomes = [...form.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(nomes, ['bot-field', 'email', 'form-name', 'localidade', 'mensagem', 'nome', 'pagina', 'subject', 'telefone', 'tipo_de_obra']);
  assert.match(form, /<input type="hidden" name="form-name" value="orcamento">/);
  assert.match(form, /<input type="hidden" name="pagina" value="orcamento.html">/);
  const ordem = [...form.matchAll(/<(?:input|select|textarea) id="(q\w+)"/g)].map(m => m[1]);
  assert.deepEqual(ordem, ['qTipo', 'qNome', 'qTel', 'qLocal', 'qEmail', 'qMsg', 'qGotcha'], 'Tipo › Nome › Telefone › Localidade › Email › Mensagem');
  assert.match(form, /<label for="qNome">Nome <span class="obrig" aria-hidden="true">\*<\/span><\/label>/);
  assert.match(form, /<label for="qEmail">Email <span class="opcional">\(opcional\)<\/span><\/label>/);
  assert.match(form, /aria-describedby="hTel eTel"/);
  assert.match(form, /placeholder="Descreva a obra: o que quer fazer, onde e para quando\."/);
  assert.match(form, /<button class="btn" type="submit" id="sendBtn">Enviar pedido de orçamento<\/button>/);
  assert.match(t, /<p class="pedido-para" data-pedido-para hidden><\/p>/);
  assert.match(form, /<div class="form-alerta" id="formAlerta" tabindex="-1" hidden><\/div>/);
  assert.match(t, /<meta name="description" content="[^"]+">/);
  assert.ok(le('sitemap.xml').includes(`${SITE.baseUrl}/orcamento.html`), 'orcamento.html no mapa do site');
  assert.doesNotMatch(t, /class="sec cta s-clay"/, 'orcamento.html sem faixa clay: é ela a ação');
  const opcoes = [...form.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
  assert.deepEqual(opcoes, TIPOS, 'as opções são os nomes dos serviços e «Outro»');
  const ids = [...form.matchAll(/<option value="[^"]+" data-tipo="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, [...SERVICOS.map(s => s.id), 'outro'], 'cada opção leva o id do serviço (?tipo=)');
  assert.doesNotMatch(form, /name="localidade"[^>]*\brequired\b/);
  assert.match(form, /<label for="qLocal">Localidade <span class="opcional">\(opcional\)<\/span><\/label>/);
  assert.match(form, /name="nome"[^>]*\brequired\b/);
  assert.match(form, /name="telefone"[^>]*\brequired\b/);
  assert.doesNotMatch(form, /name="email"[^>]*\brequired\b/);
  assert.match(form, /<input id="qGotcha" name="bot-field" type="text" tabindex="-1" autocomplete="off">/);
  assert.match(t, /<div class="form-ok" data-form-ok hidden tabindex="-1">/);
  assert.match(t, /Pedido enviado!/);
  const obg = le('obrigado.html');
  assert.match(obg, /<meta name="robots" content="noindex">/);
  assert.match(obg, /prazo de um dia útil/);
});

test('as fichas de obra: migalhas, serviço, orçamento pré-escolhido, WhatsApp com o código, anterior e seguinte', () => {
  OBRAS.forEach((o, i) => {
    const f = `obras/${o.slug}.html`;
    const t = le(f);
    assert.match(t, new RegExp(`<h1 id="pagT">${esc(o.title)}</h1>`), f);
    const s = servicoDe(o);
    assert.ok(s, `${f}: o «cat» ${o.cat} é o de um serviço`);
    assert.match(t, new RegExp(`<span class="eyebrow"><a href="\\.\\./obras\\.html#${s.cat}">${esc(s.nome)}</a></span>`), `${f}: eyebrow com o serviço, sem código`);
    assert.match(t, new RegExp(`<dt>Serviço</dt><dd><a href="\\.\\./obras\\.html#${s.cat}">${esc(s.nome)}</a>`), `${f}: o serviço liga ao grupo em obras.html`);
    const lds = [...t.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
    const bc = lds.find(l => l['@type'] === 'BreadcrumbList');
    assert.ok(bc && bc.itemListElement.length === 3 && bc.itemListElement[2].item === `${SITE.baseUrl}/${f}`, `${f}: migalhas`);
    const orc = /<section class="sec cta s-clay"[\s\S]*?class="acoes acoes-pilha">\s*<a class="btn" href="([^"]+)">Pedir Orçamento<\/a>/.exec(t)[1];
    assert.equal(orc, `../orcamento.html?tipo=${s.id}&amp;de=obras/${o.slug}`, `${f}: o pedido leva o tipo (id do serviço) e a obra de origem`);
    const wa = /href="(https:\/\/wa\.me\/351961245288\?text=[^"]+)"[^>]*>Enviar fotografias por WhatsApp/.exec(t)[1];
    assert.ok(decodeURIComponent(wa).includes(o.code), `${f}: mensagem de WhatsApp com o código`);
    assert.match(t, new RegExp(`<p class="cta-ref">Referência da obra: ${o.code}</p>`), `${f}: referência da obra`);
    assert.match(t, /<nav class="barra"[\s\S]*?<a class="barra-cel barra-orc" href="\.\.\/orcamento\.html\?tipo=/, `${f}: a barra pede com o tipo`);
    assert.match(t, /<section class="sec s-bone obra-rel"/, `${f}: outras obras em bone`);
    assert.doesNotMatch(t, /Ver Todas as Obras/, `${f}: sem «Ver Todas as Obras»`);
    // sem anterior/seguinte (as migalhas e «Outras obras» já levam às outras obras)
    assert.doesNotMatch(t, /rel="(?:prev|next)"|class="obra-nav"/, `${f}: sem navegação anterior/seguinte`);
    assert.equal((t.match(/<figure class="pg reveal"/g) || []).length, 2, `${f}: duas outras obras`);
    for (const d of o.detalhes) assert.ok(t.includes(`<li>${d.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</li>`), `${f}: detalhe «${d}»`);
    assert.ok(!t.includes('<dt>Data</dt>') || o.factos.data, `${f}: a data só com facto`);
    if (o.antesDepois) assert.match(t, /data-ba-range/, `${f}: comparador`); else assert.match(t, /class="obra-foto"/, `${f}: fotografia grande`);
  });
  const obras = le('obras.html');
  for (const o of OBRAS) assert.ok(obras.includes(`href="obras/${o.slug}.html"`), `obras.html liga a ${o.slug}`);
  assert.doesNotMatch(obras, /class="chip"|data-filtro|class="filtros"/, 'obras.html sem chips de filtro (voltam com 8 ou mais obras)');
  assert.doesNotMatch(obras, /mosaico/, 'obras.html sem mosaico');
  assert.equal((obras.match(/<figure class="pg reveal" data-cat="/g) || []).length, OBRAS.length, 'obras.html mostra todas as obras');
});

test('os dados: vocabulário dos serviços, obras em destaque, factos e o --faltam', () => {
  assert.ok(!('tiposDeObra' in SITE), 'tiposDeObra deu lugar a servicos');
  assert.deepEqual(SERVICOS.map(s => s.id), ['reabilitacao', 'comercial', 'apartamentos', 'estrutura', 'fachadas', 'acabamentos']);
  for (const s of SERVICOS) {
    assert.ok(s.nome && s.texto, `${s.id}: nome e texto`);
    assert.ok(s.cat === '' || s.cat === s.id, `${s.id}: cat é o id ou vazio`);
  }
  assert.ok(Array.isArray(SITE.provas) && SITE.provas.length === 3, 'três provas');
  assert.deepEqual(SITE.menu.map(m => m.nome), ['Início', 'Obras']);
  assert.match(SITE.wa.erro, /\{nome\}/);
  assert.match(SITE.wa.erro, /\{tipo\}/);
  for (const o of OBRAS) {
    assert.ok(!('catLabel' in o), `${o.code}: sem catLabel`);
    assert.ok(servicoDe(o), `${o.code}: cat de um serviço`);
    assert.deepEqual(Object.keys(o.factos).sort(), ['data', 'duracao', 'localExato', 'problema', 'resultado', 'trabalho'], `${o.code}: factos`);
    assert.ok(Array.isArray(o.fotosExtra), `${o.code}: fotosExtra`);
  }
  assert.deepEqual(OBRAS.filter(o => o.destaque).map(o => o.code), ['M01', 'M04', 'M05']);
  const r = spawnSync('python3', ['build.py', '--faltam'], { cwd: W, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(tmp, 'faltam') } });
  assert.equal(r.status, 0);
  const doc = JSON.parse(fs.readFileSync(path.join(W, 'data/dados-melperfaz.json'), 'utf8'));
  for (const k of ['zona', 'horario', 'alvara', 'seguro', 'nif', 'morada', 'email', 'googleMaps']) {
    if (!doc[k].valor) assert.ok(r.stdout.includes(`chave «${k}»`), `--faltam lista ${k}`);
  }
  const FACTOS = { problema: 'O problema que havia', trabalho: 'O que a Melperfaz fez', data: 'Data da obra', localExato: 'Local (bairro',
    duracao: 'Duração:', resultado: 'Resultado da obra' };
  for (const [k, nome] of Object.entries(FACTOS)) {
    if (OBRAS.some(o => !o.factos[k])) assert.ok(r.stdout.includes(nome), `--faltam lista «${nome}»`);
  }
});

test('a 404 só usa caminhos absolutos', () => {
  const t = le('404.html');
  for (const m of t.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const r = m[1];
    if (/^(https?:|mailto:|tel:|data:)/.test(r)) continue;
    assert.ok(r.startsWith('/'), `404: ${r}`);
  }
  assert.match(t, /<meta name="robots" content="noindex">/);
});

test('as fotografias: original, tamanhos, prévias e texto alternativo', () => {
  const lqip = JSON.parse(fs.readFileSync(path.join(W, 'data/lqip.json'), 'utf8'));
  for (const [n, f] of FOTOS) {
    const pasta = path.join(PUB, 'assets/img/fotos');
    assert.ok(fs.existsSync(path.join(pasta, `foto-${n}.jpg`)), `foto-${n}.jpg`);
    const maior = Math.max(f.w, f.h);
    const lados = [400, 600, 800, 1000, 1200, 1600].filter(l => l < maior).concat([maior]);
    for (const l of lados) for (const ext of ['avif', 'webp']) {
      const p = path.join(pasta, `foto-${n}-${l}.${ext}`);
      assert.ok(fs.existsSync(p) && fs.statSync(p).size > 0, `foto-${n}-${l}.${ext}`);
    }
    assert.match(lqip[n] || '', /^data:image\/webp;base64,/, `prévia ${n}`);
    assert.ok(f.alt.length > 20, `alt ${n}`);
  }
  const t = le('index.html');
  const pic = /<picture class="foto hero-photo"[^>]*>(.*?)<\/picture>/s.exec(t)[1];
  assert.match(pic, /<source type="image\/avif" srcset="assets\/img\/fotos\/foto-01-400\.avif 400w, [^"]*foto-01-1080\.avif 1080w"/);
  assert.match(pic, /sizes="[^"]*\(max-width: 980px\) calc\(100vw - 32px\), 520px"/, 'hero: sizes da moldura (sem ampliação)');
  assert.match(pic, new RegExp(`<img src="assets/img/fotos/foto-01\\.jpg" alt="${esc(Object.fromEntries(FOTOS)['01'].alt)}" width="1080" height="810" style="object-position: 50% 60%" loading="eager" decoding="async" fetchpriority="high">`));
});

function copiaFontes() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'melperfaz-copia-'));
  for (const x of ['build.py', 'netlify.toml', 'src', 'data']) fs.cpSync(path.join(W, x), path.join(d, x), { recursive: true });
  fs.mkdirSync(path.join(d, 'assets'));
  for (const x of ['css', 'js', 'fonts']) fs.cpSync(path.join(W, 'assets', x), path.join(d, 'assets', x), { recursive: true });
  // as fotografias são grandes: ligações simbólicas chegam (copytree segue-as)
  fs.mkdirSync(path.join(d, 'assets/img'));
  for (const x of fs.readdirSync(path.join(W, 'assets/img'))) fs.symlinkSync(path.join(W, 'assets/img', x), path.join(d, 'assets/img', x));
  return d;
}

test('o --check falha com uma ligação partida e com um travessão', () => {
  const d = copiaFontes();
  try {
    const p = path.join(d, 'src/pages/404.html');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('href="{{ root }}obras.html"', 'href="{{ root }}obras-antigas.html"'));
    let r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, 'ligação partida: sai com 1');
    assert.match(r.stdout, /404\.html: referência partida → \/obras-antigas\.html/);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('obras-antigas.html', 'obras.html').replace('Esta página não existe.', 'Esta página \u2014 não existe.'));
    r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, 'travessão: sai com 1');
    assert.match(r.stdout, /404\.html: travessão/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('o --check falha com um «Pedir Orçamento» fora de orcamento.html e com o formulário noutra página', () => {
  const d = copiaFontes();
  try {
    const p = path.join(d, 'src/pages/404.html');
    const original = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, original.replace('href="{{ root }}orcamento.html">Pedir Orçamento', 'href="{{ root }}index.html#servicos">Pedir Orçamento'));
    let r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, '«Pedir Orçamento» para outro sítio: sai com 1');
    assert.match(r.stdout, /404\.html: «Pedir Orçamento[^»]*» tem de levar a orcamento\.html → href="\/index\.html#servicos"/);
    fs.writeFileSync(p, original + '\n{{> orcamento-form }}\n');
    r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, 'formulário fora de orcamento.html: sai com 1');
    assert.match(r.stdout, /404\.html: o formulário de orçamento só existe em orcamento\.html/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('os parâmetros dos parciais: os declarados, os obrigatórios e nenhum a mais', () => {
  const d = copiaFontes();
  try {
    const p = path.join(d, 'src/pages/obras.html');
    const original = fs.readFileSync(p, 'utf8');
    const corre = () => spawnSync('python3', ['build.py'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    fs.writeFileSync(p, original.replace('{{> cta titulo=', '{{> cta cor="azul" titulo='));
    let r = corre();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /parâmetros que o parcial não declara → \['cor'\]/);
    fs.writeFileSync(p, original.replace(/\{\{> cta titulo="[^"]*" /, '{{> cta '));
    r = corre();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /faltam os parâmetros obrigatórios \['titulo'\]/);
    fs.writeFileSync(p, original + '\n{{> prova x="1"}}\n');
    r = corre();
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /prova\}\} não declara parâmetros/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('as folhas de estilo: superfícies, um só .btn-ghost, estilos de texto e nada retirado', () => {
  const css = le('assets/css/site.css');
  for (const s of ['s-paper', 's-bone', 's-ink', 's-clay']) assert.match(css, new RegExp(`\\.${s}\\b[^{]*\\{[^}]*--focus-c:`), `superfície ${s} com foco`);
  // na faixa clay o texto, o traço do eyebrow e o foco são ink; o botão é ink com texto paper
  const clay = /\.s-clay \{([^}]*)\}/.exec(css)[1];
  for (const v of ['--fg: var(--ink)', '--eyebrow-rule: var(--ink)', '--focus-c: var(--focus)', '--btn-bg: var(--ink)']) assert.ok(clay.includes(v), `s-clay: ${v}`);
  // o botão primário é ink sobre clay por omissão (5,65:1)
  assert.match(css, /--btn-bg: var\(--clay\); --btn-fg: var\(--ink\);/);
  assert.match(css, /\.btn-ghost \{[^}]*box-shadow: inset 0 0 0 var\(--border-control\) currentColor/);
  assert.match(css, /:focus-visible \{ outline: 3px solid var\(--focus-c\); outline-offset: 3px; \}/);
  assert.match(css, /input, select, textarea \{ font-size: var\(--fs-body\); \}/);
  assert.match(css, /--fs-category: \.8125rem;/, 'etiquetas com 13 px');
  const todas = ['site.css', 'pag-obras.css', 'pag-paginas.css', 'pag-orcamento.css'].map(f => le(`assets/css/${f}`)).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const tamanhos = new Set([...todas.matchAll(/font-size:\s*([^;}]+)/g)].map(m => m[1].trim()));
  assert.ok([...tamanhos].every(v => /^var\(--fs-[a-z-]+\)$/.test(v)), `só tamanhos --fs-*: ${[...tamanhos]}`);
  assert.ok(new Set([...todas.matchAll(/var\((--fs-[a-z-]+)\)/g)].map(m => m[1])).size <= 11, 'no máximo 10 estilos e o das etiquetas');
  for (const fora of ['.strip', '.stat-card', '.hero-tag2', '.hero-cheio', '.wa-float', '.chip', '.filtros', '.obra-nav', '.cta-faixa',
    '.btn-ghost-ink', '.btn-ghost-paper', '.pag-simples', '.mosaico', 'infinite', '@keyframes scroll', 'waPulse', '.pag-cab', '.obra-cab',
    '.cta-inner', '.cta-form', '.foot-morada', '--slider-width']) {
    assert.ok(!todas.includes(fora), `retirado: ${fora}`);
  }
  // uma só definição do PageHead, das migalhas e de .prosa h2 (em site.css)
  for (const sel of ['.page-head', '.migalhas', '.prosa h2']) {
    assert.equal((todas.match(new RegExp(`^${sel.replace('.', '\\.')} \\{`, 'gm')) || []).length, 1, `uma só regra ${sel} (fora das quebras)`);
  }
  // a barra de ações: só abaixo de 980 px, e o body reserva a sua altura (mais a margem segura do ecrã)
  assert.match(css, /\.barra \{ display: none; \}/);
  assert.match(css, /body\.com-barra \{ padding-bottom: calc\(var\(--barra-height\) \+ env\(safe-area-inset-bottom\)\); \}/);
  assert.match(css, /html\.menu-aberto \{ overflow: hidden; \}/);
  assert.deepEqual([...new Set([...todas.matchAll(/@media \((?:max|min)-width: (\d+)px\)/g)].map(m => m[1]))].sort(), ['640', '980']);
});

test('o lint do --check: falha com px solto, tamanho de letra fora dos estilos, @media, texto claro no clay e infinite', () => {
  const d = copiaFontes();
  try {
    const p = path.join(d, 'assets/css/pag-paginas.css');
    fs.appendFileSync(p, '\n.x { margin: 10px 0; gap: 14px; }\n.y { font-size: .9rem; }\n@media (max-width: 760px) { .z { color: red; } }\n'
      + '.s-clay .w { color: var(--paper); }\n.btn.v { color: var(--white); }\n@keyframes q { to { opacity: 0; } }\n.q { animation: q 1s infinite; }\n'
      + '.so-ok { margin: -1px; padding: env(safe-area-inset-bottom); }\n.s-clay .btn-ok { background: var(--ink); color: var(--paper); }\n');
    const r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, 'sai com 1');
    assert.match(r.stdout, /pag-paginas\.css: «\.x \{ margin: 10px 0 \}»: espaço em px solto \(10px\)/);
    assert.match(r.stdout, /pag-paginas\.css: «\.x \{ gap: 14px \}»/);
    assert.match(r.stdout, /pag-paginas\.css: «\.y \{ font-size: \.9rem \}»: só os estilos de texto/);
    assert.match(r.stdout, /pag-paginas\.css: @media \(max-width: 760px\) \(só 980 e 640 px\)/);
    assert.match(r.stdout, /«\.s-clay \.w \{ color: var\(--paper\) \}»: texto claro sobre clay/);
    assert.match(r.stdout, /«\.btn\.v \{ color: var\(--white\) \}»: texto claro sobre clay/);
    assert.match(r.stdout, /pag-paginas\.css: animação «infinite»/);
    assert.doesNotMatch(r.stdout, /so-ok|btn-ok/, 'as exceções: hairline, env() e texto paper sobre fundo ink');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('o build.py recusa apagar a pasta errada', () => {
  for (const alvo of [W, path.join(W, 'data'), os.homedir()]) {
    const r = spawnSync('python3', ['build.py'], { cwd: W, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: alvo } });
    assert.notEqual(r.status, 0, alvo);
    assert.match(r.stderr, /não apago/);
  }
  assert.ok(fs.existsSync(path.join(W, 'data/site.json')), 'data/ continua lá');
});
