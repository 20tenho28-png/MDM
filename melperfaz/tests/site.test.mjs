/* O site gerado, sem browser: gera numa pasta temporária (MELPERFAZ_OUT) com --check e confere as páginas, a cabeça de
   cada uma, o formulário Netlify, o mapa do site, as fichas de obra, as fotografias e as regras de texto. No fim, que o
   --check falha quando se parte uma ligação ou se escreve um travessão, e que o build.py se recusa a apagar a pasta
   errada. Com os dados da Melperfaz preenchidos numa cópia, os ramos que hoje estão escondidos. Uso, a partir de
   melperfaz/:  npm test  (ou node --test tests/site.test.mjs) */
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
// os dados da Melperfaz (data/dados-melperfaz.json): o que se espera das páginas segue-os, vazios ou preenchidos
const DADOS = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(W, 'data/dados-melperfaz.json'), 'utf8')))
  .filter(([k]) => !k.startsWith('_')).map(([k, v]) => [k, String(v.valor).trim()]));
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
    assert.deepEqual(lds.find(l => l['@type'] === 'GeneralContractor').knowsAbout, SERVICOS.map(s => s.nome), `${f}: knowsAbout são os nomes de site.json «servicos»`);
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
    // o prefetch da página do pedido: o endereço dos botões da página (nas fichas, com ?tipo= e ?de=); não em
    // orcamento.html (é ela) nem em obrigado.html (não leva lá)
    const prefetch = [...t.matchAll(/<link rel="prefetch" href="([^"]+)">/g)].map(m => m[1]);
    if (f === 'orcamento.html' || f === 'obrigado.html') assert.deepEqual(prefetch, [], `${f}: sem prefetch`);
    else {
      const botao = /<a href="([^"]+)" class="btn topo-btn">/.exec(t)[1];
      assert.deepEqual(prefetch, [botao], `${f}: prefetch do endereço do «Pedir Orçamento» da página`);
      assert.match(botao, f.startsWith('obras/') ? /^\.\.\/orcamento\.html\?tipo=\w+&amp;de=obras\// : /^\/?orcamento\.html$/, `${f}: ${botao}`);
    }
    // cada «Pedir Orçamento» (texto ou aria-label) leva a orcamento.html; já não há #contacto como destino
    for (const m of t.matchAll(/<a\b([^>]*)>(.*?)<\/a>/gs)) {
      const rotulo = (m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + ' ' + ((/aria-label="([^"]*)"/.exec(m[1]) || [])[1] || ''));
      if (!/pedir or[cç]amento/i.test(rotulo)) continue;
      const href = (/href="([^"]*)"/.exec(m[1]) || [])[1];
      assert.match(href, /^(?:\/|(?:\.\.\/)*)orcamento\.html(?:\?[^#]*)?$/, `${f}: «${rotulo.trim()}» → ${href}`);
    }
    assert.doesNotMatch(t, /href="[^"]*#contacto"/, `${f}: nenhuma ligação para #contacto`);
    // a página inicial é a pasta («./», «../» ou «/»), como no canonical e no mapa do site: nenhuma ligação para …index.html
    assert.doesNotMatch(t, /href="[^"#?]*index\.html"/, `${f}: nenhuma ligação para index.html`);
    const inicio = f === '404.html' ? '/' : f.startsWith('obras/') ? '../' : './';
    assert.match(t, new RegExp(`<a href="${inicio.replace(/[./]/g, '\\$&')}" class="logo">`), `${f}: o logótipo leva a ${inicio}`);
    // o cabeçalho: o telefone sempre; a barra de ações em todas as páginas menos obrigado.html
    assert.match(t, /<header class="topo[^"]*"[\s\S]*?<a class="topo-tel" href="tel:\+351961245288">/, `${f}: telefone no cabeçalho`);
    const barra = /<nav class="barra" aria-label="Contactos rápidos">([\s\S]*?)<\/nav>/.exec(t);
    if (f === 'obrigado.html') assert.ok(!barra && !/class="grain com-barra"/.test(t), `${f}: sem barra de ações`);
    else {
      assert.ok(barra, `${f}: barra de ações`);
      assert.match(t, /<body class="grain com-barra"/, `${f}: o body reserva o espaço da barra`);
      const celulas = [...barra[1].matchAll(/<a class="barra-cel[^"]*" href="([^"]+)"[^>]*>(?:<svg[\s\S]*?<\/svg>)?([^<]+)<\/a>/g)];
      const cels = celulas.map(m => m[2]);
      assert.deepEqual(cels, f === 'orcamento.html' ? ['Ligar', 'WhatsApp', 'Enviar fotografias'] : ['Ligar', 'WhatsApp', 'Orçamento'], `${f}: células da barra`);
      // em orcamento.html as duas células de WhatsApp não fazem o mesmo: «Enviar fotografias» leva a mensagem das
      // fotografias (site.json «wa.fotos»), a do lado a geral
      if (f === 'orcamento.html') {
        const msg = h => decodeURIComponent(h.replace(/&amp;/g, '&').split('?text=')[1]);
        assert.equal(msg(celulas[2][1]), SITE.wa.fotos, `${f}: «Enviar fotografias» com a mensagem das fotografias`);
        assert.notEqual(celulas[1][1], celulas[2][1], `${f}: as duas células de WhatsApp diferentes`);
        assert.equal(msg(/<a class="btn btn-ghost" href="([^"]+)"[^>]*>Enviar fotografias por WhatsApp<\/a>/.exec(t)[1]), SITE.wa.fotos, `${f}: o botão da lateral com a mesma mensagem`);
      }
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
    assert.match(rodape, /<div class="foot-col" role="group" aria-labelledby="footContactos">\s*<p class="foot-h" id="footContactos">Contactos<\/p>/, `${f}: a coluna «Contactos» nomeada pelo título`);
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
  assert.match(le('obras.html'), /<nav class="migalhas" aria-label="Migalhas"><a href="\.\/">Início<\/a><span aria-hidden="true">›<\/span><span aria-current="page">Obras<\/span><\/nav>/);
  assert.match(le('privacidade.html'), /Última atualização: <time datetime="\d{4}-\d\d-\d\d">/);
  assert.doesNotMatch(le('obrigado.html'), /class="migalhas"/, 'sem migalhas onde não há breadcrumb');
  assert.match(le('orcamento.html'), /<section class="sec s-paper page-head page-head-compacto"/);
  // a CtaBand: o mesmo layout em todas as páginas que a têm; a ProofLine com as provas de site.json
  for (const f of ['index.html', 'obras.html', `obras/${OBRAS[0].slug}.html`]) {
    const cta = /<section class="sec cta s-clay"[^>]*>([\s\S]*?)<\/section>/.exec(le(f));
    assert.ok(cta, `${f}: CtaBand`);
    assert.match(cta[1], /<a href="tel:\+351961245288" class="cta-phone">/, `${f}: telefone na faixa`);
    const provas = [.../<ul class="prova">(.*?)<\/ul>/.exec(cta[1])[1].matchAll(/<li>([^<]+)<\/li>/g)].map(m => m[1].replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"'));
    assert.deepEqual(provas, [...SITE.provas, ...(DADOS.alvara ? [`Alvará n.º ${DADOS.alvara}`] : [])], `${f}: ProofLine (com o alvará quando existe)`);
  }
  assert.match(le('index.html'), /<section class="sec cta s-clay" id="contacto" aria-labelledby="ctaT">[\s\S]*?<h2 id="ctaT">Peça o orçamento\. A visita é gratuita\.<\/h2>/);
  for (const f of paginas()) assert.ok(!/class="cta-inner"|class="cta-form"|class="cta-faixa/.test(leV(f)), `${f}: sem as faixas antigas`);
});

test('a página inicial: Hero › Obras em destaque › Serviços › Porquê Nós › faixa clay, sem formulário nem processo', () => {
  const t = le('index.html');
  const ordem = ['id="top"', 'id="obras"', 'id="servicos"', 'id="porque-nos"', 'id="contacto"'];
  let pos = 0;
  for (const marca of ordem) { const i = t.indexOf(marca); assert.ok(i > pos, `ordem: ${marca}`); pos = i; }
  // as superfícies, pela ordem da página: paper, ink, paper, bone, clay e o rodapé ink
  const sups = [...t.matchAll(/<(?:section|footer) class="[^"]*\b(s-(?:paper|bone|ink|clay))\b/g)].map(m => m[1]);
  assert.deepEqual(sups, ['s-paper', 's-ink', 's-paper', 's-bone', 's-clay', 's-ink']);
  // hero «split»: eyebrow, h1, lead, «Pedir Orçamento» e «Ligar», o texto de apoio, a ProofLine e um só cartão
  assert.match(t, /<section class="hero s-paper" id="top"[^>]*>\s*<div class="wrap hero-grid">/);
  assert.match(t, new RegExp(`<span class="eyebrow">Reabilitação e construção${DADOS.zona ? ' · ' + esc(DADOS.zona) : ''}</span>`), 'eyebrow com a zona só quando existe');
  assert.match(t, /<em>de raiz\.<\/em>/);
  assert.match(t, /<p class="lead">Reabilitação de edifícios, espaços comerciais e apartamentos\. Da estrutura ao acabamento, com uma equipa responsável do início ao fim\.<\/p>/);
  assert.match(t, /<div class="acoes">\s*<a href="orcamento\.html" class="btn">Pedir Orçamento<\/a>\s*<a href="tel:\+351961245288" class="btn btn-ghost">Ligar 961 245 288<\/a>\s*<\/div>\s*<p class="hero-apoio">Visita e orçamento gratuitos, sem compromisso\.<\/p>\s*(?:<!--[\s\S]*?-->\s*)?<ul class="prova">/);
  const anos = new Date().getFullYear() - Number(SITE.founded);
  assert.match(t, new RegExp(`<p class="tag-card"><span class="n">${anos}</span><span class="l">anos, desde ${SITE.founded}</span></p>`));
  // cada facto uma vez: «25 anos, desde 2001» só no cartão do hero; «Quem somos» diz desde quando trabalham
  const principal = /<main[\s\S]*?<\/main>/.exec(leV('index.html'))[0];
  assert.doesNotMatch(principal, /anos de ofício|Desde 2001|Licenciada · /, 'sem os «25 anos / 2001» repetidos');
  assert.equal((principal.match(new RegExp(`desde ${SITE.founded}`, 'g')) || []).length, 2, 'o cartão do hero e «Quem somos»');
  assert.match(t, /<figcaption class="hero-leg">Carrinha da Melperfaz numa obra de reabilitação<\/figcaption>/, 'legenda em texto simples, sem ligação');
  for (const fora of ['class="strip"', 'stat-card', 'hero-cheio', 'hero-tag2', 'hero-foto-leg', '100%</span>', 'id="processo"', 'class="step', 'Ver Todas as Obras', 'class="svc-grid"', 'data-ba']) assert.ok(!t.includes(fora), `sem ${fora}`);
  assert.doesNotMatch(t, /id="quoteForm"|data-preselect/, 'a página inicial já não tem formulário');
  // as obras em destaque (data/obras.json «destaque»), com «Antes e depois» na que tem o comparador, e «Ver as N obras»
  const grelha = /<div class="photo-grid destaques">([\s\S]*?)<\/div>\s*<div class="acoes obras-mais">/.exec(t);
  assert.ok(grelha, 'grelha das obras em destaque');
  const destaques = OBRAS.filter(o => o.destaque);
  assert.deepEqual([...grelha[1].matchAll(/<h3><a href="obras\/([^"]+)\.html">/g)].map(m => m[1]), destaques.map(o => o.slug));
  assert.equal((grelha[1].match(/<span class="pg-tag">Antes e depois<\/span>/g) || []).length, destaques.filter(o => o.antesDepois).length);
  assert.match(t, new RegExp(`<a class="btn btn-ghost" href="obras\\.html">Ver as ${OBRAS.length} obras</a>`));
  // ServiceList: uma linha por serviço, sem ser ligação; «Ver obras (N)» só com obras; «Pedir orçamento» com o tipo
  const linhas = [...t.matchAll(/<li class="svc reveal" data-servico="([^"]+)">([\s\S]*?)<\/li>/g)];
  assert.deepEqual(linhas.map(m => m[1]), SERVICOS.map(s => s.id), 'uma linha por serviço de site.json «servicos»');
  for (const [, id, corpo] of linhas) {
    const s = SERVICOS.find(x => x.id === id), n = OBRAS.filter(o => s.cat && o.cat === s.cat).length;
    assert.match(corpo, new RegExp(`<h3>${esc(s.nome)}</h3>`), `${id}: nome`);
    assert.match(corpo, new RegExp(`<a class="link-seta" href="orcamento\\.html\\?tipo=${id}" data-tipo="${id}">Pedir orçamento<span class="so-leitor"> de ${esc(s.nome)}</span>`), `${id}: pedir com o tipo`);
    if (n) {
      assert.match(corpo, new RegExp(`<a class="link-seta" href="obras\\.html#${s.cat}">Ver obras \\(${n}\\)`), `${id}: ver as ${n} obras`);
      assert.match(corpo, /<div class="svc-mini"><picture class="foto"[\s\S]*?alt=""/, `${id}: miniatura decorativa`);
      // a miniatura é a fotografia da primeira obra em destaque do serviço (ou da primeira obra), com o foco dela: nos
      // Acabamentos a M05 (o assentamento do pavimento), não o teto branco da M02
      const obrasS = OBRAS.filter(o => o.cat === s.cat), mini = obrasS.find(o => o.destaque) || obrasS[0];
      assert.match(corpo, new RegExp(`<div class="svc-mini"><picture class="foto" style="--lqip: [^"]*; --lqip-pos: ${mini.foco}"><source type="image/avif" srcset="[^"]*foto-${mini.foto}-400\\.avif[^"]*" sizes="[^"]*64px"[\\s\\S]*?alt="" width="\\d+" height="\\d+" style="object-position: ${mini.foco}"`), `${id}: miniatura da ${mini.code}, com o foco`);
    } else assert.doesNotMatch(corpo, /Ver obras|svc-mini/, `${id}: sem obras, sem promessas vazias`);
  }
  assert.doesNotMatch(t, /<a class="svc|class="arrow"/, 'a linha do serviço não é uma ligação e não tem seta');
  // Porquê Nós: a lista de confiança, «Quem somos» e a fotografia da M03 com «Ver a obra»
  assert.equal((t.match(/<span class="tick" aria-hidden="true"><svg class="icone i-visto" viewBox="0 0 24 24"[^>]*><path pathLength="1" [^>]*\/><\/svg><\/span>/g) || []).length, 4, 'os quatro vistos são o ícone «visto»');
  assert.match(t, new RegExp(`<h3>Quem somos</h3>\\s*<p>A Melperfaz, Construção Civil, Lda\\. trabalha desde 2001 com equipa própria\\.${DADOS.zona ? ` Trabalhamos em ${esc(DADOS.zona)}\\.` : ''}${DADOS.morada ? ` Sede: ${esc(DADOS.morada)}\\.` : ''}</p>`));
  // «Ver a obra» diz qual (para o leitor de ecrã), com o título da M03 de data/obras.json
  const m03 = OBRAS.find(o => o.n === '03');
  assert.match(t, new RegExp(`<a class="link-seta" href="obras/${m03.slug}\\.html">Ver a obra<span class="so-leitor">: ${esc(m03.title)}</span>`));
  // as garantias (partials/garantias.html): os mesmos quatro títulos na página inicial e, condensados, em orcamento.html
  const titulos = h => [.../<ul class="trust-list[^"]*">([\s\S]*?)<\/ul>/.exec(h)[1].matchAll(/<h3>([^<]+)<\/h3>/g)].map(m => m[1]);
  assert.deepEqual(titulos(le('orcamento.html')), titulos(t), 'as garantias de orcamento.html são as da página inicial');
  assert.equal(titulos(t).length, 4);
  assert.match(le('orcamento.html'), /<ul class="trust-list trust-list-curta">/, 'orcamento.html: a TrustList condensada');
  assert.doesNotMatch(le('orcamento.html'), /orc-confianca/);
  // os endereços antigos (#contacto, ?tipo=) vão para orcamento.html: o script vem logo no topo do <head>, antes das
  // letras, do CSS e do prefetch (não espera pelo CSS e o browser não descarrega a página inicial antes de mudar)
  assert.match(t, /<meta name="viewport"[^>]*>\s*<script>\(function\(\)\{var l=location,m=\/\[\?&\]tipo=\(\[\^&#\]\*\)\/\.exec\(l\.search\);if\(m\|\|l\.hash\.slice\(1\)==='contacto'\)l\.replace\('orcamento\.html'\+\(m\?'\?tipo='\+m\[1\]:''\)\);\}\)\(\);<\/script>/);
  assert.ok(t.indexOf("l.replace('orcamento.html'") < t.indexOf('<link rel="preload"'), 'o reencaminhamento antes das letras e do CSS');
  for (const f of paginas()) if (f !== 'index.html') assert.doesNotMatch(le(f), /l\.replace\('orcamento\.html'/, `${f}: sem reencaminhamento`);
});

test('o formulário Netlify: só em orcamento.html, atributos, campos pela ordem, opções, isco, «Pedido para:» e o WhatsApp do erro', () => {
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
  // «Pedido para: X · alterar» já escrito no HTML (site.js põe o nome e mostra-o quando há ?tipo=); o «·» fica agarrado
  // ao nome (&nbsp;), para uma linha nunca começar por ele
  assert.match(t, /<p class="pedido-para" data-pedido-para hidden>Pedido para: <strong data-pedido-nome><\/strong>&nbsp;· <button class="pedido-alterar" type="button" data-pedido-alterar aria-label="Alterar o tipo de obra">alterar<\/button><\/p>/);
  // o WhatsApp do erro: a base e a mensagem site.json «wa.erro» (com {nome} e {tipo}) vão no próprio formulário
  assert.ok(abre.includes(` data-wa="${SITE.whatsappBase}"`), 'data-wa');
  assert.ok(abre.includes(` data-wa-erro="${SITE.wa.erro}"`), 'data-wa-erro');
  assert.match(form, /<div class="form-alerta" id="formAlerta" tabindex="-1" hidden><\/div>/);
  assert.match(t, /<meta name="description" content="[^"]+">/);
  assert.ok(le('sitemap.xml').includes(`${SITE.baseUrl}/orcamento.html`), 'orcamento.html no mapa do site');
  assert.doesNotMatch(t, /class="sec cta s-clay"/, 'orcamento.html sem faixa clay: é ela a ação');
  const opcoes = [...form.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
  assert.deepEqual(opcoes, TIPOS, 'as opções são os nomes dos serviços e «Outro»');
  const ids = [...form.matchAll(/<option value="[^"]+" data-tipo="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, [...SERVICOS.map(s => s.id), 'outro'], 'cada opção leva o id do serviço (?tipo=)');
  // os valores de antes do redesenho (site.json «antigos»: «Fachadas / Impermeabilização»…) seguem na opção do serviço
  // de hoje (data-antigos), para os endereços antigos com ?tipo= continuarem a escolher o tipo
  const antigos = Object.fromEntries([...form.matchAll(/<option value="[^"]+" data-tipo="([^"]+)"(?: data-antigos="([^"]*)")?>/g)].map(m => [m[1], m[2] || '']));
  for (const s of SERVICOS) assert.equal(antigos[s.id], (s.antigos || []).join('|'), `${s.id}: data-antigos`);
  assert.deepEqual(Object.fromEntries(SERVICOS.filter(s => s.antigos).flatMap(s => s.antigos.map(a => [a, s.id]))),
    { 'Reabilitação de Edifício': 'reabilitacao', 'Espaço Comercial': 'comercial', 'Apartamento': 'apartamentos', 'Fachadas / Impermeabilização': 'fachadas' },
    'os tipos antigos que mudaram de nome (os outros, «Trabalhos de Estrutura», «Acabamentos» e «Outro», são o próprio nome)');
  assert.doesNotMatch(form, /name="localidade"[^>]*\brequired\b/);
  assert.match(form, /<label for="qLocal">Localidade <span class="opcional">\(opcional\)<\/span><\/label>/);
  assert.match(form, /name="nome"[^>]*\brequired\b/);
  assert.match(form, /name="telefone"[^>]*\brequired\b/);
  assert.doesNotMatch(form, /name="email"[^>]*\brequired\b/);
  assert.match(form, /<input id="qGotcha" name="bot-field" type="text" tabindex="-1" autocomplete="off">/);
  // um só sucesso: site.js abre obrigado.html, sem painel «Pedido enviado!» nem «Enviar outro pedido» na página
  assert.doesNotMatch(t, /data-form-ok|data-form-novo|Pedido enviado!|Enviar outro pedido/);
  const js = fs.readFileSync(path.join(W, 'assets/js/site.js'), 'utf8');
  assert.match(js, /location\.assign\('obrigado\.html'\)/, 'site.js: o envio que correu bem abre obrigado.html');
  assert.doesNotMatch(js, /data-form-novo|data-form-ok|data-preselect|data-filtro|Ups/, 'site.js sem os handlers retirados nem o «Ups»');
  const obg = le('obrigado.html');
  assert.match(obg, /<meta name="robots" content="noindex">/);
  assert.match(obg, /prazo de um dia útil/);
});

test('as fichas de obra: migalhas, serviço, «Na obra», ficha só com factos, orçamento pré-escolhido, WhatsApp com o código', () => {
  OBRAS.forEach((o, i) => {
    const f = `obras/${o.slug}.html`;
    const t = le(f);
    assert.match(t, new RegExp(`<h1 id="pagT">${esc(o.title)}</h1>`), f);
    const s = servicoDe(o);
    assert.ok(s, `${f}: o «cat» ${o.cat} é o de um serviço`);
    assert.match(t, new RegExp(`<span class="eyebrow"><a href="\\.\\./obras\\.html#${s.cat}">${esc(s.nome)}</a></span>`), `${f}: eyebrow com o serviço, sem código`);
    // o trabalho: «Na obra» com os detalhes; «O problema» e «O que fizemos» só com os factos; a ficha só com Local, Data,
    // Duração ou Resultado (sem «Código» nem «Serviço»: o eyebrow já liga ao serviço)
    assert.match(t, /<div class="prosa">[\s\S]*?<h2>Na obra<\/h2>\s*<ul class="lista-visto reveal">/, `${f}: «Na obra», com os vistos a entrar no ecrã`);
    assert.doesNotMatch(t, /O que se vê na fotografia|<dt>Código<\/dt>|<dt>Serviço<\/dt>/, `${f}: sem a descrição da fotografia nem o código`);
    assert.equal(t.includes('<h2>O problema</h2>'), Boolean(o.factos.problema), `${f}: «O problema» só com o facto`);
    assert.equal(t.includes('<h2>O que fizemos</h2>'), Boolean(o.factos.trabalho), `${f}: «O que fizemos» só com o facto`);
    const temFactos = ['localExato', 'data', 'duracao', 'resultado'].some(k => o.factos[k]);
    assert.equal(/<div class="ficha">/.test(t), temFactos, `${f}: a ficha só com pelo menos um facto`);
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
    // o eyebrow das outras obras só diz «semelhantes» quando as duas são do mesmo serviço (o h2 segue a mesma regra)
    const mesma = OBRAS.filter(x => x !== o && x.cat === o.cat).length;
    assert.match(t, new RegExp(`<span class="eyebrow">${mesma >= 2 ? 'Obras semelhantes' : 'Obras'}</span>\\s*<h2 id="obraRelT">${mesma >= 2 ? `Outras obras de ${esc(s.nome.toLowerCase())}` : 'Outras obras'}</h2>`), `${f}: eyebrow e h2 das outras obras`);
    // a descrição é o resumo da obra (o título já está no <title>), cortado numa frase inteira: sem «título, serviço:»
    const desc = /<meta name="description" content="([^"]*)"/.exec(t)[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    let esperada = '';
    for (const frase of o.resumo.match(/[^.]+\./g).map(x => x.trim())) { const junta = `${esperada} ${frase}`.trim(); if (junta.length > 160) break; esperada = junta; }
    assert.equal(desc, esperada, `${f}: a descrição é o resumo, em frases inteiras`);
    assert.doesNotMatch(t, /Ver Todas as Obras/, `${f}: sem «Ver Todas as Obras»`);
    // sem anterior/seguinte (as migalhas e «Outras obras» já levam às outras obras)
    assert.doesNotMatch(t, /rel="(?:prev|next)"|class="obra-nav"/, `${f}: sem navegação anterior/seguinte`);
    assert.equal((t.match(/<figure class="pg reveal"/g) || []).length, 2, `${f}: duas outras obras`);
    for (const d of o.detalhes) assert.match(t, new RegExp(`<li><span class="tick" aria-hidden="true"><svg class="icone i-visto"[^>]*>.*?</svg></span>${esc(d)}</li>`), `${f}: detalhe «${d}», com o visto`);
    assert.ok(!t.includes('<dt>Data</dt>') || o.factos.data, `${f}: a data só com facto`);
    if (o.antesDepois) {
      assert.match(t, /data-ba-range/, `${f}: comparador`);
      assert.doesNotMatch(t, /class="ba-head"/, `${f}: o comparador sem cabeçalho (o h3 repetia o h1)`);
    } else {
      assert.match(t, /class="obra-foto"/, `${f}: fotografia grande`);
      assert.doesNotMatch(t, /data-ba-range/, `${f}: o comparador só na obra que o tem`);
    }
  });
});

test('obras.html: o índice, uma secção por serviço com obras (ink e bone a alternar), H1 › H2 › H3, sem comparador', () => {
  const obras = le('obras.html');
  for (const o of OBRAS) assert.ok(obras.includes(`href="obras/${o.slug}.html"`), `obras.html liga a ${o.slug}`);
  assert.doesNotMatch(obras, /class="chip"|data-filtro|class="filtros"/, 'obras.html sem chips de filtro (voltam com 8 ou mais obras)');
  assert.doesNotMatch(obras, /mosaico|data-ba/, 'obras.html sem mosaico e sem comparador');
  assert.equal((obras.match(/<figure class="pg(?: reveal)?" data-cat="/g) || []).length, OBRAS.length, 'obras.html mostra todas as obras');
  // cada facto uma vez por página: o h2 de cada grupo já é o nome do serviço, os cartões de obras.html não o repetem
  // (a página inicial e as outras obras de cada ficha, que misturam serviços, mantêm-no)
  assert.doesNotMatch(obras, /class="cat"/, 'obras.html sem o nome do serviço em cada cartão');
  assert.equal((le('index.html').match(/<span class="cat">/g) || []).length, OBRAS.filter(o => o.destaque).length, 'a página inicial com o nome do serviço em cada cartão');
  assert.equal((le(`obras/${OBRAS[0].slug}.html`).match(/<span class="cat">/g) || []).length, 2, 'as outras obras de cada ficha com o nome do serviço');
  const comObras = SERVICOS.filter(s => s.cat && OBRAS.some(o => o.cat === s.cat));
  const indice = [.../<nav class="indice-grupos" aria-label="Obras por serviço">([\s\S]*?)<\/nav>/.exec(obras)[1].matchAll(/<a href="#([^"]+)">([^<]+)<\/a>/g)];
  assert.deepEqual(indice.map(m => [m[1], m[2]]), comObras.map(s => [s.cat, `${s.nome} (${OBRAS.filter(o => o.cat === s.cat).length})`]), 'o índice: os serviços com obras e quantas');
  const grupos = [...obras.matchAll(/<section class="sec (s-\w+) grupo-obras" id="([^"]+)" aria-labelledby="g-\2">([\s\S]*?)<\/section>/g)];
  assert.deepEqual(grupos.map(m => m[2]), comObras.map(s => s.cat), 'uma secção por serviço com obras, com a âncora do serviço');
  assert.deepEqual(grupos.map(m => m[1]), comObras.map((s, i) => ['s-ink', 's-bone'][i % 2]), 'ink e bone a alternar');
  for (const [, , cat, corpo] of grupos) {
    const s = comObras.find(x => x.cat === cat), n = OBRAS.filter(o => o.cat === cat);
    assert.match(corpo, new RegExp(`<h2 class="grupo-t" id="g-${cat}">${esc(s.nome)}</h2>\\s*<p class="grupo-n">${n.length} ${n.length === 1 ? 'obra' : 'obras'}</p>`), `${cat}: h2 e quantas`);
    assert.deepEqual([...corpo.matchAll(/<h3><a href="obras\/([^"]+)\.html">/g)].map(m => m[1]), n.map(o => o.slug), `${cat}: as obras do serviço, em h3`);
  }
  // a primeira fotografia da página carrega já; as outras com carregamento diferido
  assert.equal((obras.match(/<figure class="pg[\s\S]*?loading="eager"/g) || []).length >= 1 && (obras.match(/fetchpriority="high"/g) || []).length, 1, 'só a primeira fotografia é prioritária');
  // o primeiro grupo (o da imagem LCP) não entra ao fazer scroll (.reveal atrasava o LCP meio segundo e escondia-o sem o
  // site.js); os outros grupos sim
  const figs = [...obras.matchAll(/<figure class="(pg(?: reveal)?)" data-cat="([^"]+)"[^>]*>([\s\S]*?)<\/figure>/g)];
  const lcp = figs.find(m => m[3].includes('fetchpriority="high"'));
  assert.ok(lcp && lcp[1] === 'pg', 'a obra com a imagem LCP sem .reveal');
  assert.deepEqual(figs.map(m => m[1] === 'pg'), figs.map(m => m[2] === lcp[2]), 'só o primeiro grupo sem .reveal');
  // a ordem das superfícies: paper (PageHead), grupos, clay e o rodapé ink; ink nunca encosta a ink
  const sups = [...obras.matchAll(/<(?:section|footer) class="[^"]*\b(s-(?:paper|bone|ink|clay))\b/g)].map(m => m[1]);
  assert.deepEqual(sups, ['s-paper', ...grupos.map(m => m[1]), 's-clay', 's-ink']);
  for (let i = 1; i < sups.length; i++) assert.ok(!(sups[i] === 's-ink' && sups[i - 1] === 's-ink'), 'duas secções ink nunca se tocam');
});

test('os dados: vocabulário dos serviços, obras em destaque, factos e o --faltam', () => {
  assert.ok(!('tiposDeObra' in SITE), 'tiposDeObra deu lugar a servicos');
  assert.deepEqual(SERVICOS.map(s => s.id), ['reabilitacao', 'comercial', 'apartamentos', 'estrutura', 'fachadas', 'acabamentos']);
  for (const s of SERVICOS) {
    assert.ok(s.nome && s.texto, `${s.id}: nome e texto`);
    assert.ok(s.frase && s.texto.includes(s.frase) && s.frase.endsWith('.'), `${s.id}: a frase da lista é uma frase do texto, tal qual`);
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
  // «antigos» (os nomes do «Tipo de obra» de antes do redesenho): um que seja o nome de outro serviço pára o build
  const d = copiaFontes();
  try {
    const p = path.join(d, 'data/site.json'), s = JSON.parse(fs.readFileSync(p, 'utf8'));
    s.servicos.find(x => x.id === 'comercial').antigos = ['Apartamentos'];
    fs.writeFileSync(p, JSON.stringify(s, null, 2));
    const rr = spawnSync('python3', ['build.py'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(rr.status, 1, '«antigos» repetido: sai com 1');
    assert.match(rr.stderr, /site\.json «servicos» comercial: «antigos»[^\n]*«Apartamentos»/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
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
  // nos telemóveis de 3x pede-se a imagem de 2x da largura do telemóvel (não da do computador, a última entrada do sizes)
  assert.match(pic, /sizes="\(max-width: 599px\) and \(min-resolution: 2\.5dppx\) calc\(calc\(100vw - 32px\) \* 2 \/ 3\), \(max-width: 980px\)/, 'hero: o tecto de 3x com a largura do telemóvel');
  assert.match(le('orcamento.html'), /sizes="\(max-width: 599px\) and \(min-resolution: 2\.5dppx\) calc\(calc\(100vw - 32px\) \* 2 \/ 3\), \(max-width: 980px\) calc\(100vw - 32px\), 460px"/, 'orcamento.html: o tecto de 3x com a largura do telemóvel');
  assert.match(pic, new RegExp(`<img src="assets/img/fotos/foto-01\\.jpg" alt="${esc(Object.fromEntries(FOTOS)['01'].alt)}" width="1080" height="810" style="object-position: 50% 60%" loading="eager" decoding="async" fetchpriority="high">`));
  // a foto-02 (4:3) na moldura 4:3 de Porquê Nós, sem corte: a coluna de 360 px (um terço da .wrap nos ecrãs mais
  // estreitos) a partir de 981 px, a largura da .wrap até lá (no telemóvel a fotografia sai)
  assert.match(/<picture class="foto"[^>]*><source type="image\/avif" srcset="[^"]*foto-02-[^"]*" sizes="([^"]*)"/.exec(t)[1], /\(min-width: 981px\) min\(360px, calc\(\(100vw - 64px\) \* \.33\)\), calc\(100vw - 64px\)$/, 'Porquê Nós: sizes da moldura (4:3)');
  // os cartões: 579 px (duas colunas a partir de 981), uma coluna até lá. No telemóvel, em obras.html e nas outras obras,
  // a fotografia fica numa moldura 4/3 (deitada) ou 4/5 (ao alto) e uma mais deitada do que a moldura pede a largura ×
  // (a sua proporção / a da moldura) (foto-05, 1080 × 620 em 4/3: × 1,306); nas obras em destaque da página inicial o
  // cartão tem 280 px de altura e as mais deitadas do que ele pedem 280 px × a sua proporção
  const F = Object.fromEntries(FOTOS);
  const obras = le('obras.html'), casa = le('index.html');
  const largas = '(min-width: 981px) min(calc(50vw - 41px), 579px), (min-width: 641px) calc(100vw - 64px)';
  for (const o of OBRAS) {
    const sizesDe = html => (new RegExp(`<figure class="pg(?: reveal)?" data-cat="${o.cat}" data-orient="(\\w+)">\\s*<picture[^>]*><source type="image/avif" srcset="[^"]*foto-${o.foto}-[^"]*" sizes="([^"]*)"`).exec(html) || [])[2];
    const fig = sizesDe(obras);
    assert.ok(fig, `cartão ${o.code}`);
    const r = F[o.foto].w / F[o.foto].h, k = r / (r >= 1 ? 4 / 3 : 4 / 5);
    assert.ok(fig.endsWith(`${largas}, ${k <= 1 ? 'calc(100vw - 32px)' : `calc((100vw - 32px) * ${k.toFixed(3)})`}`), `cartão ${o.code}: sizes → ${fig}`);
    if (o.destaque) {
      const larga = Math.round(280 * r);
      assert.ok(sizesDe(casa).endsWith(`${largas}, ${larga <= 288 ? 'calc(100vw - 32px)' : `max(calc(100vw - 32px), ${larga}px)`}`), `cartão em destaque ${o.code}: sizes`);
    }
    // a ficha: a fotografia na sua proporção (--foto-r), no máximo 78% do ecrã de altura, sem corte
    if (!o.antesDepois) {
      const ficha = le(`obras/${o.slug}.html`);
      assert.match(ficha, new RegExp(`<div class="obra-foto" style="--foto-r: ${(F[o.foto].w / F[o.foto].h).toFixed(4)}">`), `${o.code}: proporção da fotografia`);
      assert.ok(ficha.includes(`(min-width: 641px) min(1176px, calc(100vw - 64px), calc(78vh * ${F[o.foto].w} / ${F[o.foto].h})), min(calc(100vw - 32px), calc(78vh * ${F[o.foto].w} / ${F[o.foto].h}))`), `${o.code}: sizes da fotografia da ficha`);
    }
  }
  assert.ok(OBRAS.some(o => o.foto === '05'), 'a foto-05 é a de uma obra (o caso do corte nos lados)');
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

// uma cópia das fontes com os dados mudados por muda(dir): gera com --check e devolve o resultado e um leitor das páginas
function geraCopia(muda, args = ['--check']) {
  const d = copiaFontes();
  muda(d);
  const r = spawnSync('python3', ['build.py', ...args], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
  return { d, r, le: f => fs.readFileSync(path.join(d, 'public', f), 'utf8') };
}
const mudaJson = (d, f, fn) => { const p = path.join(d, f), j = JSON.parse(fs.readFileSync(p, 'utf8')); fn(j); fs.writeFileSync(p, JSON.stringify(j, null, 2)); };
// dados de exemplo (só para o teste; nunca entram no site): o que a Melperfaz um dia preenche
const EXEMPLO = { email: 'geral@exemplo.pt', nif: '123 456 789', morada: 'Rua do Exemplo, 1, 1000-001 Lisboa', alvara: '12345-PUB',
  seguro: 'Seguradora Exemplo, apólice n.º 1', zona: 'Lisboa e Setúbal', horario: '2ª a 6ª, 8h–18h', googleMaps: 'https://maps.app.goo.gl/exemplo' };
const FACTOS_EX = { problema: 'Paredes com humidade.', trabalho: 'Picámos e rebocámos.', data: 'Março de 2025', localExato: 'Almada', duracao: 'Três semanas', resultado: 'Paredes secas.' };

test('com os dados da Melperfaz preenchidos: os ramos escondidos aparecem, nos sítios certos e com o texto certo', () => {
  const { d, r, le: lc } = geraCopia(d => {
    mudaJson(d, 'data/dados-melperfaz.json', j => { for (const [k, v] of Object.entries(EXEMPLO)) j[k].valor = v; });
    mudaJson(d, 'data/obras.json', j => { for (const o of j.obras) o.factos = { ...FACTOS_EX }; j.obras.find(o => o.code === 'M02').fotosExtra = ['01', '06']; });
  });
  try {
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const casa = lc('index.html');
    assert.match(casa, new RegExp(`<span class="eyebrow">Reabilitação e construção · ${esc(EXEMPLO.zona)}</span>`), 'a zona no eyebrow');
    assert.match(casa, new RegExp(`trabalha desde 2001 com equipa própria\\. Trabalhamos em ${esc(EXEMPLO.zona)}\\. Sede: ${esc(EXEMPLO.morada)}\\.</p>`), '«Quem somos» com a zona e a sede');
    assert.match(casa, new RegExp(`em todas as obras com licença\\. Alvará n\\.º&nbsp;${esc(EXEMPLO.alvara)}\\. Seguro de responsabilidade civil: ${esc(EXEMPLO.seguro)}\\.</p>`), '«Licenciada & segurada» com o alvará e o seguro, cada um com o seu rótulo e ponto final');
    assert.match(casa, new RegExp(`<ul class="prova">.*<li>Alvará n\\.º ${esc(EXEMPLO.alvara)}</li></ul>`), 'o alvará na ProofLine');
    assert.match(casa, new RegExp(`<span class="topo-horario">${esc(EXEMPLO.horario)}</span>`), 'o horário no cabeçalho');
    assert.match(casa, new RegExp(`<span class="cta-phone-l">${esc(EXEMPLO.horario)}</span>`), 'o horário na faixa clay');
    assert.match(casa, new RegExp(`<a class="link-seta" href="${esc(EXEMPLO.googleMaps)}" target="_blank" rel="noopener">Ver o perfil e as avaliações no Google`), 'o perfil do Google em Porquê Nós');
    const rod = /<footer[\s\S]*<\/footer>/.exec(casa)[0];
    for (const x of [`<p>Trabalhamos em ${esc(EXEMPLO.zona)}\\.</p>`, `<a href="mailto:${esc(EXEMPLO.email)}">`, `<span class="foot-txt">${esc(EXEMPLO.morada)}</span>`,
      `<span class="foot-txt">${esc(EXEMPLO.horario)}</span>`, `<a href="${esc(EXEMPLO.googleMaps)}" target="_blank" rel="noopener">Ver no Google Maps</a>`,
      ` · <span class="sem-quebra">NIF ${esc(EXEMPLO.nif)}</span> · Alvará n\\.º&nbsp;${esc(EXEMPLO.alvara)}</span>`]) assert.match(rod, new RegExp(x), `rodapé: ${x}`);
    const ld = [...casa.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1])).find(l => l['@type'] === 'GeneralContractor');
    assert.equal(ld.email, EXEMPLO.email);
    assert.equal(ld.vatID, 'PT' + EXEMPLO.nif.replace(/\D/g, ''));
    assert.deepEqual(ld.address, { '@type': 'PostalAddress', streetAddress: EXEMPLO.morada, addressCountry: 'PT' });
    assert.equal(ld.areaServed, EXEMPLO.zona);
    assert.equal(ld.hasMap, EXEMPLO.googleMaps);
    const orc = lc('orcamento.html');
    assert.match(orc, new RegExp(`<h3>Licenciada &amp; segurada</h3><p>Alvará n\\.º&nbsp;${esc(EXEMPLO.alvara)}</p><p>Seguro de responsabilidade civil: ${esc(EXEMPLO.seguro)}</p>`), 'orcamento.html: o alvará e o seguro na TrustList condensada');
    const priv = lc('privacidade.html');
    for (const dt of ['NIF', 'Morada', 'Email']) assert.match(priv, new RegExp(`<dt>${dt}</dt>`), `privacidade: ${dt} na Ficha`);
    assert.match(priv, new RegExp(`ligue <a href="tel:\\+351961245288">961 245 288</a> \\(${esc(EXEMPLO.horario)}\\), escreva para <a href="mailto:${esc(EXEMPLO.email)}">${esc(EXEMPLO.email)}</a> ou escreva para a morada acima\\.`), 'privacidade: os três canais, o último com «ou»');
    for (const o of OBRAS) {
      const t = lc(`obras/${o.slug}.html`);
      assert.match(t, new RegExp(`<h2>O problema</h2>\\s*<p>${esc(FACTOS_EX.problema)}</p>\\s*<h2>O que fizemos</h2>\\s*<p>${esc(FACTOS_EX.trabalho)}</p>`), `${o.code}: «O problema» e «O que fizemos»`);
      for (const [dt, k] of [['Local', 'localExato'], ['Data', 'data'], ['Duração', 'duracao'], ['Resultado', 'resultado']]) assert.match(t, new RegExp(`<dt>${dt}</dt><dd>${esc(FACTOS_EX[k])}</dd>`), `${o.code}: ${dt} na ficha`);
    }
    // «fotosExtra»: as fotografias aparecem na ficha, por baixo de «Na obra» (antes desapareciam sem aviso)
    const m02 = lc(`obras/${OBRAS.find(o => o.code === 'M02').slug}.html`);
    const extra = /<div class="obra-extra">([\s\S]*?)<\/div>/.exec(m02);
    assert.ok(extra, 'M02: as fotografias de «fotosExtra»');
    assert.deepEqual([...extra[1].matchAll(/<img src="\.\.\/assets\/img\/fotos\/foto-(\d+)\.jpg"[^>]*loading="lazy"/g)].map(m => m[1]), ['01', '06'], 'M02: foto-01 e foto-06, em lazy load');
    assert.doesNotMatch(lc(`obras/${OBRAS[0].slug}.html`), /class="obra-extra"/, 'sem «fotosExtra», sem a grelha');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('com os dados a meio: a frase da privacidade com «ou», ponto final repetido e uma fotografia repetida em «fotosExtra»', () => {
  // só o email (o mais provável de chegar primeiro): «ligue X ou escreva para Y», sem a vírgula solta
  let c = geraCopia(d => mudaJson(d, 'data/dados-melperfaz.json', j => { j.email.valor = EXEMPLO.email; }));
  try {
    assert.equal(c.r.status, 0, c.r.stdout);
    assert.match(c.le('privacidade.html'), new RegExp(`ligue <a href="tel:\\+351961245288">961 245 288</a> ou escreva para <a href="mailto:${esc(EXEMPLO.email)}">${esc(EXEMPLO.email)}</a>\\. A Melperfaz`), 'só o email: «ligue X ou escreva para Y»');
  } finally { fs.rmSync(c.d, { recursive: true, force: true }); }
  // um ponto final no fim da morada ficava «Sede: Rua….» : o --check recusa; e uma fotografia repetida em «fotosExtra»
  c = geraCopia(d => {
    mudaJson(d, 'data/dados-melperfaz.json', j => { j.morada.valor = 'Rua do Exemplo, 1.'; });
    mudaJson(d, 'data/obras.json', j => { const o = j.obras.find(o => o.code === 'M02'); o.fotosExtra = [o.foto]; });
  });
  try {
    assert.equal(c.r.status, 1);
    assert.match(c.r.stdout, /dados-melperfaz\.json «morada»: sem ponto final/);
    assert.match(c.r.stdout, /obras\.json M02: «fotosExtra» não repete a fotografia da obra/);
  } finally { fs.rmSync(c.d, { recursive: true, force: true }); }
});

test('os dados com a forma errada dão uma linha clara (não um erro do Python), e o Netlify publica com o --check', () => {
  for (const [muda, msg] of [
    [d => mudaJson(d, 'data/obras.json', j => { delete j.obras.find(o => o.code === 'M02').resumo; }), /obras\.json M02: falta «resumo»/],
    [d => mudaJson(d, 'data/obras.json', j => { delete j.obras.find(o => o.code === 'M02').factos; }), /obras\.json M02: falta «factos»/],
    [d => mudaJson(d, 'data/dados-melperfaz.json', j => { j.nif.valor = 512345678; }), /dados-melperfaz\.json «nif»: «valor» tem de ser texto, entre aspas → 512345678/],
  ]) {
    const c = geraCopia(muda, []);
    try {
      assert.equal(c.r.status, 1, c.r.stderr);
      assert.match(c.r.stderr, msg);
      assert.doesNotMatch(c.r.stderr, /Traceback|KeyError|TypeError/, 'sem erro do Python');
    } finally { fs.rmSync(c.d, { recursive: true, force: true }); }
  }
  // o netlify.toml publica com o --check e não deixa abrir o site dentro de outro (frame-ancestors)
  const toml = fs.readFileSync(path.join(W, 'netlify.toml'), 'utf8');
  assert.match(toml, /command = "python3 build\.py --check"/);
  assert.match(toml, /Content-Security-Policy = "frame-ancestors 'none'"/);
  assert.doesNotMatch(toml, /for = "\/assets\/img\/[^"]*"\s*\[headers\.values\]\s*Cache-Control = "[^"]*immutable/, 'as imagens (sem versão no endereço) sem cache immutable');
  const c = geraCopia(d => { const p = path.join(d, 'netlify.toml'); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('command = "python3 build.py --check"', 'command = "python3 build.py"').replace(/\s*Content-Security-Policy = [^\n]*/, '')); });
  try {
    assert.equal(c.r.status, 1);
    assert.match(c.r.stdout, /netlify\.toml: \[build\] command tem de correr o --check/);
    assert.match(c.r.stdout, /netlify\.toml: \/\* sem Content-Security-Policy frame-ancestors/);
  } finally { fs.rmSync(c.d, { recursive: true, force: true }); }
});

test('os ícones: icones.svg em linha com {{icone nome}}, sem os glifos → ≡ ✓ ‹, e um nome desconhecido é erro', () => {
  const sprite = fs.readFileSync(path.join(W, 'src/partials/icones.svg'), 'utf8');
  const nomes = new Set([...sprite.matchAll(/<symbol id="([\w-]+)"/g)].map(m => m[1]));
  for (const n of ['seta', 'menu', 'telefone', 'whatsapp', 'visto', 'seta-esq', 'seta-dir', 'enviado']) assert.ok(nomes.has(n), `icones.svg tem «${n}»`);
  for (const f of paginas()) {
    const t = leV(f);
    const visivel = t.replace(/<script[\s\S]*?<\/script>/g, '');
    assert.doesNotMatch(visivel, /[→≡✓‹]/, `${f}: sem os glifos que passaram a ícone`);
    assert.doesNotMatch(t, /<use\b|menu-barras/, `${f}: os ícones vêm em linha, sem <use> nem as barras em <span>`);
    for (const [svg, nome] of t.matchAll(/<svg class="icone i-([\w-]+)"[^>]*>/g)) {
      assert.ok(nomes.has(nome), `${f}: o ícone «${nome}» existe em icones.svg`);
      assert.match(svg, /fill="none" stroke="currentColor" stroke-width="1\.75" aria-hidden="true" focusable="false"/, `${f}: ${nome} com traço de 1,75 e escondido do leitor`);
    }
  }
  const casa = le('index.html');
  assert.match(casa, /<button class="menu-toggle"[^>]*><svg class="icone i-menu" viewBox="0 0 24 24"[^>]*><path class="b1" [^>]*\/><path class="b2" [^>]*\/><path class="b3" [^>]*\/><\/svg><\/button>/, 'o botão do menu com as três barras');
  assert.match(casa, /<a class="topo-tel" href="tel:\+351961245288"><svg class="icone i-telefone"/, 'o telefone do cabeçalho com o ícone');
  assert.match(casa, /<a class="topo-wa"[^>]*><svg class="icone i-whatsapp"/, 'o WhatsApp do cabeçalho');
  assert.match(casa, /<a class="barra-cel" href="tel:[^"]+" aria-label="Ligar 961 245 288"><svg class="icone i-telefone"[\s\S]*?<\/svg>Ligar<\/a>/, 'a barra: Ligar com o telefone');
  assert.equal((casa.match(/<a class="link-seta"[^>]*>[^<]*(?:<span class="so-leitor">[^<]*<\/span>)?<svg class="icone i-seta"/g) || []).length, (casa.match(/<a class="link-seta"/g) || []).length, 'todas as ligações com seta usam o ícone');
  assert.match(casa, /<span class="pg-ver" aria-hidden="true">Ver obra<svg class="icone i-seta"/, 'o cartão: «Ver obra» com a seta');
  const m05 = le(`obras/${(OBRAS.find(o => o.antesDepois) || OBRAS[0]).slug}.html`);
  assert.match(m05, /<span class="ba-arrows"><svg class="icone i-seta-esq"[\s\S]*?<\/svg><svg class="icone i-seta-dir"/, 'o comparador com as duas setas');
  assert.match(le('obrigado.html'), /<span class="pag-icone"><svg class="icone i-enviado" viewBox="0 0 48 48"[^>]*><circle pathLength="1"[^>]*\/><path class="enviado-visto" pathLength="1"/, 'obrigado.html: o visto num círculo');
  for (const f of paginas()) if (f !== 'obrigado.html') assert.doesNotMatch(le(f), /class="pag-icone"/, `${f}: o ícone do PageHead só em obrigado.html`);
  // um ícone que não existe pára o build; um glifo antigo faz o --check falhar
  const d = copiaFontes();
  try {
    const p = path.join(d, 'src/pages/404.html');
    const orig = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, orig.replace('{{icone seta}}', '{{icone martelo}}'));
    let r = spawnSync('python3', ['build.py'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.notEqual(r.status, 0, 'ícone desconhecido: o build pára');
    assert.match(r.stderr, /\{\{icone martelo\}\}: não existe em src\/partials\/icones\.svg/);
    fs.writeFileSync(p, orig.replace('{{icone seta}}', '<span aria-hidden="true"> →</span>'));
    r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, 'glifo antigo: sai com 1');
    assert.match(r.stdout, /404\.html: glifo que passou a ícone/);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('o --check falha com uma ligação partida e com um travessão', () => {
  const d = copiaFontes();
  try {
    const p = path.join(d, 'src/pages/404.html');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('href="{{ root }}obras.html"', 'href="{{ root }}obras-antigas.html"'));
    let r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, 'ligação partida: sai com 1');
    assert.match(r.stdout, /404\.html: referência partida → \/obras-antigas\.html/);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('obras-antigas.html', 'obras.html').replace('titulo="Esta página não existe"', 'titulo="Esta página \u2014 não existe"'));
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

test('o --check falha com os rótulos retirados e com ligações para #contacto', () => {
  const d = copiaFontes();
  try {
    const p = path.join(d, 'src/pages/404.html');
    fs.appendFileSync(p, '\n<p><a href="{{ root }}index.html#contacto">Contacto</a> <a href="{{ root }}orcamento.html">Orçamento Gratuito</a></p>\n'
      + '<p><a href="{{ root }}orcamento.html">Pedir Orçamento Gratuito</a> <a href="{{wa geral}}">Chamar no WhatsApp</a></p>\n'
      + '<p>Visita e orçamento gratuitos, sem compromisso.</p>\n');
    const r = spawnSync('python3', ['build.py', '--check'], { cwd: d, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: path.join(d, 'public') } });
    assert.equal(r.status, 1, 'sai com 1');
    assert.match(r.stdout, /404\.html: ligação para #contacto → href="\/index\.html#contacto"/);
    assert.match(r.stdout, /404\.html: «Orçamento Gratuito» como nome de ligação/);
    assert.match(r.stdout, /404\.html: rótulo retirado «Pedir Orçamento Gratuito»/);
    assert.match(r.stdout, /404\.html: rótulo retirado «Chamar no WhatsApp»/);
    assert.equal((r.stdout.match(/^ {2}404\.html: /gm) || []).length, 5, 'o texto de apoio «orçamento gratuitos» passa');
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

test('as páginas curtas e a privacidade: 404 com três caminhos, obrigado sem pedir de novo, a Ficha do responsável', () => {
  const e = leV('404.html');
  assert.match(e, /<h1 id="pagT">Esta página não existe<\/h1>/);
  assert.deepEqual([...e.matchAll(/<a class="(btn|link-seta)" href="([^"]+)">([^<]+)/g)].map(m => [m[1], m[2], m[3]]),
    [['btn', '/orcamento.html', 'Pedir Orçamento'], ['link-seta', '/obras.html', 'Ver as obras'], ['link-seta', '/', 'Voltar ao início']]);
  const o = leV('obrigado.html');
  assert.match(o, /<a class="btn" href="https:\/\/wa\.me\/[^"]+" target="_blank" rel="noopener">Enviar fotografias por WhatsApp<\/a>\s*<a class="btn btn-ghost" href="tel:\+351961245288">Ligar 961 245 288<\/a>/);
  assert.match(o, /<a class="link-seta" href="obras\.html">Ver as obras/);
  const p = leV('privacidade.html');
  const resp = /<dl aria-label="Responsável pelos dados">([\s\S]*?)<\/dl>/.exec(p);
  assert.ok(resp, 'a Ficha do responsável');
  assert.match(resp[1], /<dt>Responsável<\/dt><dd>Melperfaz, Construção Civil, Lda\.<\/dd>/);
  const doc = JSON.parse(fs.readFileSync(path.join(W, 'data/dados-melperfaz.json'), 'utf8'));
  for (const [k, dt] of [['nif', 'NIF'], ['morada', 'Morada'], ['email', 'Email']]) assert.equal(resp[1].includes(`<dt>${dt}</dt>`), Boolean(doc[k].valor), `${dt} só quando existe`);
  assert.equal((p.match(/<div class="ficha">/g) || []).length, 4, 'as fichas da privacidade são o componente Ficha');
  assert.doesNotMatch(p, /priv-ficha/);
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
    '.cta-inner', '.cta-form', '.foot-morada', '--slider-width', '.priv-ficha', '.svc-grid', '.proc-grid', '.step', '.work-mais', '.ba-head',
    '.svc .arrow', '#porque-nos h2']) {
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
  // o body nunca vira contentor de scroll (com o menu aberto a página saltava para o topo e o cabeçalho deixava o sticky)
  assert.match(css, /body \{[^}]*overflow-x: hidden; overflow-x: clip; \}/);
  assert.match(css, /html\.menu-aberto body \{ overflow-x: visible; \}/);
  // a barra fixa não tapa o foco (scroll-padding-bottom com a altura dela, só abaixo de 980 px, onde ela existe)
  assert.match(css, /@media \(max-width: 980px\) \{[^@]*html \{ scroll-padding-bottom: calc\(var\(--barra-height\) \+ env\(safe-area-inset-bottom\) \+ var\(--space-16\)\); \}/);
  // os títulos equilibrados; o horário sem maiúsculas; o anel do «Saltar» ink (a superfície à volta); a borda dos botões
  // em contraste forçado
  assert.match(css, /h1, h2 \{ text-wrap: balance; \}/);
  assert.match(css, /\.sec-head p, \.lead \{ text-wrap: pretty; \}/);
  assert.doesNotMatch(/\.cta-phone-l \{([^}]*)\}/.exec(css)[1], /text-transform/, 'o horário fica como a Melperfaz o escreve («8h–18h»)');
  assert.doesNotMatch(/\.skip \{([^}]*)\}/.exec(css)[1], /--focus-c/, 'o «Saltar» com o anel ink');
  assert.match(css, /@media \(forced-colors: active\) \{ \.btn, \.topo-wa \{ border: var\(--border-control\) solid ButtonText; \} \}/);
  assert.match(css, /\.navlinks a\[aria-current="page"\]::after \{ transform: none; background: var\(--clay-deep\); \}/, 'a página atual com o traço clay-deep (3,6:1)');
  // o CSS e o JS publicados sem comentários (ficam nas fontes); as páginas também
  for (const f of ['site.css', 'pag-obras.css', 'pag-paginas.css', 'pag-orcamento.css']) assert.ok(!le(`assets/css/${f}`).includes('/*'), `${f} sem comentários`);
  assert.ok(!le('assets/js/site.js').includes('/*') && fs.readFileSync(path.join(W, 'assets/js/site.js'), 'utf8').includes('/*'), 'site.js sem comentários (as fontes com eles)');
  for (const f of paginas()) assert.ok(!le(f).includes('<!--'), `${f} sem comentários`);
  // o movimento (Fase 5b): os tokens, o deslize suave só sem movimento reduzido, e com movimento reduzido tudo acaba já
  for (const v of ['--dur-1: 150ms', '--dur-2: 250ms', '--dur-3: 500ms', '--ease-out: cubic-bezier(.2,.7,.3,1)', '--ease-in-out: cubic-bezier(.65,0,.35,1)', '--cascata: 80ms']) assert.ok(css.includes(v), `token ${v}`);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*html:focus-within \{ scroll-behavior: smooth; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{ animation-duration: 0s !important;[^}]*transition-duration: 0s !important;/);
  assert.match(css, /\.js \.reveal \{ opacity: 0; transform: translateY\(var\(--space-16\)\); transition: opacity var\(--dur-3\)/, 'a entrada: 16 px em 500 ms');
  assert.doesNotMatch(todas, /(?:transition|animation)[\w-]*:[^;{}]*(?:\b[1-9]\d*(?:\.\d+)?|\B\.\d+)m?s\b/, 'sem durações soltas nas folhas de estilo');
  assert.deepEqual([...new Set([...todas.matchAll(/@media \((?:max|min)-width: (\d+)px\)/g)].map(m => m[1]))].sort(), ['640', '980']);
});

test('o lint do --check: falha com px solto, tamanho de letra fora dos estilos, @media, texto claro no clay e infinite', () => {
  const d = copiaFontes();
  try {
    const p = path.join(d, 'assets/css/pag-paginas.css');
    fs.appendFileSync(p, '\n.x { margin: 10px 0; gap: 14px; }\n.y { font-size: .9rem; }\n@media (max-width: 760px) { .z { color: red; } }\n'
      + '.s-clay .w { color: var(--paper); }\n.btn.v { color: var(--white); }\n@keyframes q { to { opacity: 0; } }\n.q { animation: q 1s infinite; }\n'
      + '.so-ok { margin: -1px; padding: env(safe-area-inset-bottom); }\n.s-clay .btn-ok { background: var(--ink); color: var(--paper); }\n'
      + '.t1 { transition: width .3s ease; }\n.t2 { transition: opacity var(--dur-2); }\n.t3 { animation: q 900ms cubic-bezier(.1,.2,.3,.4); }\n'
      + '.t4 { transition: all var(--dur-1) var(--ease-out); }\n:root { --dur-9: 700ms; }\n'
      + '.mov-ok { transition: transform var(--dur-1) var(--ease-out), color var(--dur-2) var(--ease-in-out); transition-delay: calc(var(--i, 0) * var(--cascata)); animation: q 0s var(--espera-js) forwards; }\n');
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
    // o movimento: só tokens de duração e de curva, cada duração com curva, nada acima de 500 ms, nada que mexa no layout
    assert.match(r.stdout, /«\.t1 \{ transition: width \.3s ease \}»: duração solta \(\.3s\)/);
    assert.match(r.stdout, /«\.t1 \{ transition: width \.3s ease \}»: curva solta/);
    assert.match(r.stdout, /«\.t1 \{ transition: width \.3s ease \}»: anima «width»/);
    assert.match(r.stdout, /«\.t2 \{ transition: opacity var\(--dur-2\) \}»: duração sem curva/);
    assert.match(r.stdout, /«\.t3 \{ animation: q 900ms cubic-bezier\(\.1,\.2,\.3,\.4\) \}»: duração solta \(900ms\)/);
    assert.match(r.stdout, /«\.t4 \{ transition: all var\(--dur-1\) var\(--ease-out\) \}»: anima «all»/);
    assert.match(r.stdout, /pag-paginas\.css: --dur-9: 700ms \(nenhuma duração passa de 500 ms\)/);
    assert.doesNotMatch(r.stdout, /mov-ok/, 'os tokens, a cascata e o 0s passam');
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
