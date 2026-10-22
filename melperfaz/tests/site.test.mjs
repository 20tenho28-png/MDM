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
const FOTOS = Object.entries(JSON.parse(fs.readFileSync(path.join(W, 'data/fotos.json'), 'utf8'))).filter(([k]) => !k.startsWith('_'));
const le = f => fs.readFileSync(path.join(PUB, f), 'utf8');
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
  const esperadas = ['404.html', 'index.html', 'obras.html', 'obrigado.html', 'privacidade.html', ...OBRAS.map(o => `obras/${o.slug}.html`)].sort();
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
    assert.match(t, /class="wa-float" href="https:\/\/wa\.me\/351961245288\?text=/, `${f}: botão WhatsApp`);
    assert.match(t, /<main id="conteudo" tabindex="-1">/, f);
  }
});

test('a página inicial: secções pela ordem do sistema de desenho, cartões, passos, obras e comparador', () => {
  const t = le('index.html');
  const ordem = ['id="top"', 'class="strip"', 'id="servicos"', 'id="processo"', 'id="obras"', 'id="porque-nos"', 'id="contacto"'];
  let pos = 0;
  for (const marca of ordem) { const i = t.indexOf(marca); assert.ok(i > pos, `ordem: ${marca}`); pos = i; }
  assert.equal((t.match(/<a class="svc reveal"/g) || []).length, 6, 'seis serviços');
  assert.equal((t.match(/<li class="step reveal"/g) || []).length, 4, 'quatro passos');
  const grelha = /<div class="photo-grid mosaico">(.*?)<\/div>\s*<div class="ba-wrap/s.exec(t);
  assert.ok(grelha, 'mosaico das obras antes do comparador');
  assert.equal((grelha[1].match(/<figure class="pg reveal" data-cat="/g) || []).length, OBRAS.length);
  assert.match(t, /<input type="range" min="0" max="100" value="50" class="ba-range" data-ba-range aria-label="Comparar demolição e acabamento">/);
  assert.match(t, /<em>de raiz\.<\/em>/);
  const anos = new Date().getFullYear() - Number(SITE.founded);
  assert.match(t, new RegExp(`${anos} anos de ofício`));
  assert.match(t, new RegExp(`<span class="big">${anos}</span><span class="lbl">Anos de Atividade</span>`));
  for (const s of t.matchAll(/data-preselect="([^"]+)"/g)) assert.ok(SITE.tiposDeObra.includes(s[1]), `pré-escolha ${s[1]} existe no formulário`);
});

test('o formulário Netlify: atributos, campos, opções, isco e página de agradecimento', () => {
  const t = le('index.html');
  const form = /<form\b[^>]*\bid="quoteForm"[^>]*>.*?<\/form>/s.exec(t)[0];
  const abre = form.slice(0, form.indexOf('>') + 1);
  for (const a of [' name="orcamento"', ' method="POST"', ' data-netlify="true"', ' netlify-honeypot="bot-field"', ' action="/obrigado.html"']) assert.ok(abre.includes(a), a);
  const nomes = [...form.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(nomes, ['bot-field', 'email', 'form-name', 'mensagem', 'nome', 'pagina', 'subject', 'telefone', 'tipo_de_obra']);
  assert.match(form, /<input type="hidden" name="form-name" value="orcamento">/);
  assert.match(form, /<input type="hidden" name="pagina" value="index.html">/);
  const opcoes = [...form.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
  assert.deepEqual(opcoes, SITE.tiposDeObra);
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

test('as fichas de obra: migalhas, ficha, orçamento pré-escolhido, WhatsApp com o código, anterior e seguinte', () => {
  OBRAS.forEach((o, i) => {
    const f = `obras/${o.slug}.html`;
    const t = le(f);
    assert.match(t, new RegExp(`<h1 id="obraT">${esc(o.title)}</h1>`), f);
    assert.match(t, new RegExp(`${esc(o.catLabel)} · ${esc(o.code)}`), f);
    const lds = [...t.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
    const bc = lds.find(l => l['@type'] === 'BreadcrumbList');
    assert.ok(bc && bc.itemListElement.length === 3 && bc.itemListElement[2].item === `${SITE.baseUrl}/${f}`, `${f}: migalhas`);
    const orc = /class="cta-faixa-acoes">\s*<a class="btn" href="([^"]+)">Pedir Orçamento<\/a>/.exec(t)[1];
    const tipo = decodeURIComponent(/\?tipo=([^#]+)#contacto$/.exec(orc)[1]);
    assert.ok(SITE.tiposDeObra.includes(tipo), `${f}: tipo pré-escolhido «${tipo}»`);
    const wa = /href="(https:\/\/wa\.me\/351961245288\?text=[^"]+)"[^>]*>Enviar Fotografias por WhatsApp/.exec(t)[1];
    assert.ok(decodeURIComponent(wa).includes(o.code), `${f}: mensagem de WhatsApp com o código`);
    const prev = OBRAS[(i - 1 + OBRAS.length) % OBRAS.length], next = OBRAS[(i + 1) % OBRAS.length];
    assert.match(t, new RegExp(`href="\\.\\./obras/${prev.slug}\\.html" rel="prev"`), f);
    assert.match(t, new RegExp(`href="\\.\\./obras/${next.slug}\\.html" rel="next"`), f);
    for (const d of o.detalhes) assert.ok(t.includes(`<li>${d.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')}</li>`), `${f}: detalhe «${d}»`);
    assert.ok(!t.includes('<dt>Data</dt>') || o.factos.data, `${f}: a data só com facto`);
    if (o.antesDepois) assert.match(t, /data-ba-range/, `${f}: comparador`); else assert.match(t, /class="obra-foto"/, `${f}: fotografia grande`);
  });
  const obras = le('obras.html');
  for (const o of OBRAS) assert.ok(obras.includes(`href="obras/${o.slug}.html"`), `obras.html liga a ${o.slug}`);
  assert.match(obras, /<button class="chip" type="button" data-filtro="reabilitacao" aria-pressed="false">Reabilitação <span class="chip-n">2<\/span><\/button>/);
  assert.equal((obras.match(/<figure class="pg reveal" data-cat="/g) || []).length, OBRAS.length, 'obras.html mostra todas as obras');
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
  assert.match(pic, /<img src="assets\/img\/fotos\/foto-01\.jpg" alt="" width="1080" height="810" style="object-position: 50% 60%" loading="eager" decoding="async" fetchpriority="high">/);
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

test('o build.py recusa apagar a pasta errada', () => {
  for (const alvo of [W, path.join(W, 'data'), os.homedir()]) {
    const r = spawnSync('python3', ['build.py'], { cwd: W, encoding: 'utf8', env: { ...process.env, MELPERFAZ_OUT: alvo } });
    assert.notEqual(r.status, 0, alvo);
    assert.match(r.stderr, /não apago/);
  }
  assert.ok(fs.existsSync(path.join(W, 'data/site.json')), 'data/ continua lá');
});
