/* Encaminhamento dos pedidos do formulário do site (README.md, «Encaminhamento dos pedidos»): instalação e manutenção
   vão para o formulário Netlify «orcamento-comercial» (o email do comercial) e só por email; avarias, «outro» e sem
   serviço ficam em «orcamento», com o WhatsApp. Também os caminhos que contornavam isto (estimativa junta sozinha no
   WhatsApp, obras de avaria, serviço reposto ao voltar atrás), a página inicial aberta em «/», uma divisão acima de
   200 m², a estimativa tirada com «Retirar» (não volta sozinha ao enviar) e o telefone com +351. Gera o site numa pasta temporária (MDM_OUT) e serve-o num servidor local que guarda cada envio, como o Netlify
   Forms o receberia, e que pode falhar de propósito. No fim, as estatísticas: depois de «Recusar», nada chega ao PostHog,
   nem o reenvio de um envio que tinha falhado, e «Aceitar» outra vez não envia o clique em «Recusar» como clique sem
   efeito, e um pedido com as estatísticas aceites não leva ao PostHog o email, o telefone nem o texto do painel (só com o
   posthog-js instalado; sem ele, esse caso é saltado). Por último (caso Q), os pedidos pelo Google: o
   site gerado outra vez com MDM_PEDIDOS_URL (no lugar de «pedidosUrl» de data/site.json) a apontar para um servidor
   local que faz de Apps Script, e cada pedido que o site enviou passa depois pelo Apps Script verdadeiro (google/pedidos.gs,
   com as imitações da Google de tests/apps-script.mjs); os outros casos correm sem ele, com o Netlify.
   Precisa do Playwright, fora das dependências. Uso, a partir de website/:
     NODE_PATH=/caminho/para/node_modules node tests/encaminhamento.mjs */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-encaminhamento-'));
const PUB = path.join(tmp, 'public');
execFileSync('python3', ['build.py'], { cwd: W, stdio: 'ignore', env: { ...process.env, MDM_OUT: PUB } });

let falhas = 0; const ok = (c, m, x) => { if (!c) { falhas++; console.log('FALHA ' + m, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } else console.log('ok ' + m); };

/* multipart → { campo: valor } (de um ficheiro, só o nome) */
function campos(corpo, tipo) {
  const m = /boundary=([^;]+)/.exec(tipo), out = {};
  if (!m) return out;
  for (const p of corpo.toString('latin1').split('--' + m[1])) {
    const c = /name="([^"]+)"(?:; filename="([^"]*)")?\r\n(?:Content-Type: [^\r]+\r\n)?\r\n([\s\S]*)\r\n$/.exec(p);
    if (c) out[c[1]] = c[2] !== undefined ? `[ficheiro ${c[2]}]` : Buffer.from(c[3], 'latin1').toString('utf8');
  }
  return out;
}
/* o servidor: os ficheiros gerados (raiz) e, como o Netlify Forms, os POST para "/" (guardados em lista) */
const envios = []; let falhar = false;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const estatico = (raiz, lista) => http.createServer((req, res) => {
  if (req.method === 'POST') {
    const partes = []; req.on('data', (c) => partes.push(c));
    req.on('end', () => { lista.push(campos(Buffer.concat(partes), req.headers['content-type'] || '')); res.writeHead(falhar ? 500 : 200); res.end(); });
    return;
  }
  let f = path.join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const ouve = (s) => new Promise((r) => s.listen(0, '127.0.0.1', r));
const servidor = estatico(PUB, envios);
await ouve(servidor);
const B = `http://127.0.0.1:${servidor.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function nova(url = '/', base = B) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/posthog/, (r) => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('mdm-estatisticas', 'nao'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { falhas++; console.log('erro JS', e.message); });
  await page.goto(base + url);
  return page;
}
const whatsEscondido = (page) => page.$eval('#sendWhats', (b) => b.hidden);
async function envia(page, servico, tel = '912 345 678') {
  if (servico !== null) await page.selectOption('#qServico', servico);
  await page.fill('#qNome', 'Cliente de teste'); await page.fill('#qTel', tel);
  const antes = envios.length;
  await page.click('#sendEmail');
  await page.waitForFunction(() => !document.querySelector('[data-form-feito]').hidden || /enviar/i.test(document.getElementById('quoteAlert').textContent));
  return envios.length > antes ? envios.at(-1) : null;
}

/* serviço (value) → formulário Netlify e triagem. Um serviço novo no formulário obriga a pô-lo aqui. */
const CASOS = [
  ['', 'orcamento', '[P5 · Por classificar]'],
  ['Ar condicionado: avaria / reparação', 'orcamento', '[P4 · Avaria AC]'],
  ['Bomba de calor: avaria / reparação', 'orcamento', '[P4 · Avaria bomba de calor]'],
  ['Eletricidade: avaria / reparação', 'orcamento', '[P4 · Avaria elétrica]'],
  ['Ventilação: avaria / reparação', 'orcamento', '[P4 · Avaria ventilação]'],
  ['Ar condicionado: montagem / instalação', 'orcamento-comercial', '[P1 · Montagem AC]'],
  ['Bomba de calor: instalação / manutenção', 'orcamento-comercial', '[P1 · Bomba de calor]'],
  ['Ventilação: instalação / revisão', 'orcamento-comercial', '[P4 · Ventilação]'],
  ['Eletricidade: quadros e alimentações AVAC', 'orcamento-comercial', '[P3 · Eletricista certificado]'],
  ['Manutenção preventiva: contrato anual', 'orcamento-comercial', '[P2 · Manutenção preventiva]'],
  ['Outro / vários serviços', 'orcamento', '[P5 · Outro]'],
];

// A. as opções do formulário são as da tabela
let page = await nova('/');
const opcoes = await page.$$eval('#qServico option', (os) => os.map((o) => o.value));
ok(opcoes.length === CASOS.length && opcoes.every((v) => CASOS.some((c) => c[0] === v)), 'A: as opções do serviço são as 11 da tabela do teste', opcoes);
ok(!(await whatsEscondido(page)), 'A: página inicial sem serviço: «Enviar por WhatsApp» à vista');
await page.selectOption('#qServico', 'Ar condicionado: montagem / instalação');
ok(await whatsEscondido(page), 'A: instalação de ar condicionado: o botão do WhatsApp sai');
await page.selectOption('#qServico', 'Ar condicionado: avaria / reparação');
ok(!(await whatsEscondido(page)), 'A: avaria: o botão do WhatsApp volta');
await page.context().close();

// B. um envio por serviço: o formulário, o assunto, o botão e o painel
for (const [servico, nome, etiqueta] of CASOS) {
  page = await nova('/');
  const comercial = nome === 'orcamento-comercial';
  if (servico) await page.selectOption('#qServico', servico);
  const escondido = await whatsEscondido(page);
  const e = await envia(page, null);
  const rot = servico || '(sem serviço)';
  ok(e && e['form-name'] === nome, `B: ${rot} → ${nome}`, e && e['form-name']);
  ok(e && e.triagem === etiqueta && e.subject === `${etiqueta} Pedido de orçamento, ${servico || 'serviços MDM'}`, `B: ${rot}: triagem e assunto`, e && [e.triagem, e.subject]);
  ok(escondido === comercial, `B: ${rot}: botão do WhatsApp ${comercial ? 'escondido' : 'à vista'}`);
  ok(await page.$eval('[data-feito-wa]', (a) => a.hidden) === comercial, `B: ${rot}: painel ${comercial ? 'sem' : 'com'} «Juntar fotografias por WhatsApp»`);
  await page.context().close();
}

// C. páginas de serviço: o serviço já vem escolhido e o botão já começa escondido
for (const p of ['ar-condicionado', 'bombas-de-calor', 'eletricidade', 'manutencao', 'ventilacao']) {
  page = await nova(`/servicos/${p}.html`);
  ok(await whatsEscondido(page), `C: ${p}: sem «Enviar por WhatsApp» (pedido do comercial)`);
  await page.context().close();
}

// D. «Enviar outro pedido» na página inicial: o serviço volta a vazio e o botão volta
page = await nova('/');
await envia(page, 'Ar condicionado: montagem / instalação');
await page.click('[data-feito-novo]');
ok(await page.inputValue('#qServico') === '' && !(await whatsEscondido(page)), 'D: «Enviar outro pedido»: sem serviço e com o botão do WhatsApp');
await page.context().close();

// E. o envio falha: nos pedidos do comercial só o telefone; numa avaria, telefone e WhatsApp
falhar = true;
for (const [servico, comercial] of [['Manutenção preventiva: contrato anual', true], ['Bomba de calor: avaria / reparação', false]]) {
  page = await nova('/');
  await envia(page, servico);
  const aviso = await page.$eval('#quoteAlert', (a) => ({ texto: a.textContent, wa: !!a.querySelector('a[href*="wa.me"]'), tel: !!a.querySelector('a[href^="tel:"]') }));
  ok(aviso.tel && aviso.wa === !comercial && /tente de novo/.test(aviso.texto), `E: falha (${comercial ? 'comercial' : 'avaria'}): ${comercial ? 'só o telefone' : 'telefone e WhatsApp'}`, aviso);
  await page.context().close();
}
falhar = false;

// F. formularios.html: o formulário do comercial tem os campos do formulário visível
const nomes = (html) => new Set([...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]));
const visivel = /<form\b[^>]*id="quoteForm"[\s\S]*?<\/form>/.exec(fs.readFileSync(path.join(PUB, 'index.html'), 'utf8'))[0];
const esqueleto = fs.readFileSync(path.join(PUB, 'formularios.html'), 'utf8');
const [a, b] = [nomes(visivel), nomes(esqueleto)];
ok(/<form name="orcamento-comercial"[^>]*data-netlify="true"/.test(esqueleto) && a.size === b.size && [...a].every((n) => b.has(n)), 'F: formularios.html com os mesmos campos', [[...a], [...b]]);
ok(!fs.readFileSync(path.join(PUB, 'sitemap.xml'), 'utf8').includes('formularios'), 'F: formularios.html fora do mapa do site');

// G. nenhuma mensagem de WhatsApp das páginas pede orçamento (menos a do painel, depois de um pedido já enviado)
const pedemOrcamento = [];
for (const f of fs.readdirSync(PUB, { recursive: true }).filter((f) => f.endsWith('.html') && !f.startsWith('equipa'))) {
  for (const m of fs.readFileSync(path.join(PUB, f), 'utf8').matchAll(/href="https:\/\/wa\.me\/\d+\?text=([^"]*)"/g)) {
    const t = decodeURIComponent(m[1].replace(/&amp;/g, '&'));
    if (/orçamento|proposta/i.test(t) && !/^Olá MDM\. Acabei de enviar um pedido/.test(t)) pedemOrcamento.push(`${f}: ${t}`);
  }
}
ok(pedemOrcamento.length === 0, 'G: o WhatsApp das páginas e das obras não pede orçamento', pedemOrcamento.slice(0, 5));

// H. página inicial aberta em «/»: «Pedir orçamento» do cabeçalho fica na página, sem a recarregar (o que se escreveu fica)
page = await nova('/');
await page.fill('#qNome', 'Escrito antes');
await page.evaluate(() => { window.__mesmaPagina = true; window.scrollTo(0, 0); });
const porReescrever = await page.$$eval('a[href*="index.html#"]', (as) => as.map((a) => a.getAttribute('href')).filter((h) => document.getElementById(h.split('#')[1])));
await page.click('.topo-cta');
await page.waitForTimeout(600);
const h = await page.evaluate(() => ({ mesma: window.__mesmaPagina === true, nome: document.getElementById('qNome').value, caminho: location.pathname, hash: location.hash }));
ok(!porReescrever.length && h.mesma && h.nome === 'Escrito antes' && h.caminho === '/' && h.hash === '#orcamento', 'H: em «/», «Pedir orçamento» não recarrega a página', { porReescrever, h });
await page.context().close();

// I. sem serviço e com a potência calculada (não junta), «Enviar por WhatsApp» não abre o WhatsApp: a estimativa escolhe
//    a instalação de ar condicionado, que segue só por email
page = await nova('/');
await page.evaluate(() => { window.__wa = null; window.open = (u) => { window.__wa = u; return null; }; });
await page.click('#potencia summary');
await page.locator('[data-pot-divs] [data-pot-linha]').first().locator('[data-pot="area"]').fill('20');
await page.fill('#qNome', 'Cliente de teste');
await page.click('#sendWhats');
const wi = await page.evaluate(() => ({ wa: window.__wa, servico: document.getElementById('qServico').value, escondido: document.getElementById('sendWhats').hidden,
  aviso: document.getElementById('quoteAlert').textContent, foco: document.activeElement && document.activeElement.id }));
ok(!wi.wa && wi.servico === 'Ar condicionado: montagem / instalação' && wi.escondido && /segue por email/.test(wi.aviso) && wi.foco === 'sendEmail',
  'I: potência junta sozinha no WhatsApp: não abre o WhatsApp e manda para «Enviar pedido»', wi);
await page.context().close();

// J. obras de avaria: «Pedir orçamento» abre o formulário com a avaria do serviço (?servico=…) ou, sem ela, o da página
//    inicial sem serviço; nunca uma página com um serviço do comercial já escolhido
const AVARIAS = CASOS.filter((c) => c[1] === 'orcamento' && / avaria /.test(c[0])).map((c) => c[0]);
const obrasAvaria = fs.readdirSync(path.join(PUB, 'obras')).filter((f) => f.endsWith('.html')).map((f) => {
  const t = fs.readFileSync(path.join(PUB, 'obras', f), 'utf8');
  const m = /id="obraCtaT">Tem uma avaria parecida\?<[\s\S]*?data-lead="orcamento" href="([^"]*)"/.exec(t);
  return m && { f, href: m[1].replace(/&amp;/g, '&') };
}).filter(Boolean);
const malAvaria = obrasAvaria.filter((o) => {
  const sv = new URL(o.href, 'http://x/obras/').searchParams.get('servico');
  return sv ? !AVARIAS.includes(sv) : o.href !== '../index.html#orcamento';
});
ok(obrasAvaria.length > 0 && !malAvaria.length, `J: ${obrasAvaria.length} obras de avaria levam a avaria ou o formulário sem serviço`, malAvaria);
const comServico = obrasAvaria.find((o) => o.href.includes('?servico='));
if (comServico) {
  page = await nova('/obras/' + comServico.f);
  await page.click('section[aria-labelledby="obraCtaT"] a[data-lead="orcamento"]');
  await page.waitForURL(/\?servico=/);
  const sv = await page.inputValue('#qServico');
  ok(AVARIAS.includes(sv) && !(await whatsEscondido(page)), `J: ${comServico.f} → formulário com «${sv}» e com WhatsApp`);
  const ej = await envia(page, null);
  ok(ej && ej['form-name'] === 'orcamento', 'J: a avaria da obra vai para o formulário geral', ej && ej['form-name']);
  await page.context().close();
}

// K. o browser repõe o serviço depois do script, sem evento change (voltar atrás sem a cópia em memória): ao aparecer a
//    página o botão acerta-se; e ao recarregar, o botão bate com o serviço que ficou
page = await nova('/');
await page.evaluate(() => {
  document.getElementById('qServico').value = 'Manutenção preventiva: contrato anual';
  window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
});
ok(await whatsEscondido(page), 'K: serviço do comercial reposto sem change: o botão do WhatsApp sai quando a página aparece');
await page.selectOption('#qServico', 'Ar condicionado: montagem / instalação');
await page.reload();
const kr = { valor: await page.inputValue('#qServico'), escondido: await whatsEscondido(page) };
ok(kr.escondido === CASOS.some((c) => c[0] === kr.valor && c[1] === 'orcamento-comercial'), 'K: depois de recarregar, o botão bate com o serviço', kr);
await page.context().close();

// L. uma divisão com mais de 200 m² conta, a dimensionar na visita: não desaparece do pedido nem fica como erro
page = await nova('/servicos/ar-condicionado.html');
if (!(await page.$eval('#potencia', (d) => d.open))) await page.click('#potencia summary');
let linha = page.locator('[data-pot-divs] [data-pot-linha]').nth(0);
await linha.locator('[data-pot="tipo"]').selectOption('Sala'); await linha.locator('[data-pot="area"]').fill('250');
await page.click('[data-pot-adiciona]');
linha = page.locator('[data-pot-divs] [data-pot-linha]').nth(1);
await linha.locator('[data-pot="tipo"]').selectOption('Quarto'); await linha.locator('[data-pot="area"]').fill('12');
await page.click('[data-pot-juntar]');
const pl = await page.evaluate(() => ({ campo: document.querySelector('[data-potencia-campo]').value,
  invalida: document.querySelector('[data-pot-divs] [data-pot="area"]').getAttribute('aria-invalid') }));
ok(/Sala 250 m²: mais de [\d ]+ BTU\/h, a dimensionar na visita/.test(pl.campo) && /Quarto 12 m²/.test(pl.campo) && /Total mais de/.test(pl.campo) && pl.invalida !== 'true',
  'L: 250 m² entra no pedido, a dimensionar na visita', pl);
await page.context().close();

// M. aberta em #potencia com outro serviço já escolhido antes do script (o Firefox e o Safari repõem-no ao recarregar ou
//    ao voltar atrás): a estimativa abre-se sem rebentar, e o resto do formulário continua a funcionar
const ctxM = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctxM.route(/posthog/, (r) => r.abort());
await ctxM.route(/ar-condicionado\.html/, async (r) => {
  const res = await r.fetch();
  const html = (await res.text()).replace(/(<option value="Ar condicionado: avaria \/ reparação")/, '$1 selected');
  await r.fulfill({ response: res, body: html });
});
page = await ctxM.newPage();
const errosM = []; page.on('pageerror', (e) => errosM.push(e.message));
await page.goto(B + '/servicos/ar-condicionado.html#potencia');
const mm = { erros: errosM, aberta: await page.$eval('#potencia', (d) => d.open), servico: await page.inputValue('#qServico'), whats: await whatsEscondido(page) };
ok(!mm.erros.length && mm.aberta && mm.servico === 'Ar condicionado: montagem / instalação' && mm.whats, 'M: #potencia com outro serviço reposto: abre sem erro', mm);
await ctxM.close();

// N. «Retirar» fica: juntar, retirar e voltar a «sem serviço»; ao enviar (WhatsApp ou email), a estimativa não volta sozinha
//    nem escolhe a instalação de ar condicionado. Volta só num pedido novo, depois de o formulário se limpar
page = await nova('/');
await page.evaluate(() => { window.__wa = null; window.open = (u) => { window.__wa = u; return null; }; });
await page.click('#potencia summary');
await page.locator('[data-pot-divs] [data-pot-linha]').first().locator('[data-pot="area"]').fill('20');
await page.click('[data-pot-juntar]');
await page.click('[data-pot-retirar]');
await page.selectOption('#qServico', '');
await page.fill('#qNome', 'Cliente de teste');
await page.click('#sendWhats');
const nw = await page.evaluate(() => ({ wa: window.__wa ? decodeURIComponent(window.__wa) : null, servico: document.getElementById('qServico').value }));
ok(nw.wa && !/BTU/.test(nw.wa) && nw.servico === '', 'N: depois de «Retirar», o WhatsApp abre sem a estimativa e sem mudar o serviço', nw);
const en = await envia(page, null);
ok(en && en['form-name'] === 'orcamento' && en.servico === '' && en.potencia === '' && en.triagem === '[P5 · Por classificar]',
  'N: depois de «Retirar», o envio não junta a estimativa', en && [en['form-name'], en.servico, en.potencia, en.triagem]);
await page.click('[data-feito-novo]');
await page.locator('[data-pot-divs] [data-pot-linha]').first().locator('[data-pot="area"]').fill('20');
const en2 = await envia(page, null);
ok(en2 && en2['form-name'] === 'orcamento-comercial' && /Total 9 000 BTU\/h/.test(en2.potencia), 'N: num pedido novo, a estimativa volta a juntar-se sozinha', en2 && [en2['form-name'], en2.potencia]);
await page.context().close();

// O. telefone: escrito com +351 ou 00351, contam os 9 algarismos depois do indicativo; os outros números ficam com a regra
//    simples (pelo menos 9 algarismos). A mensagem de erro é a mesma
for (const [tel, valido] of [['+351 123456', false], ['00351 1234', false], ['+351 912 345 678', true], ['00351912345678', true], ['+44 20 7946 0958', true]]) {
  page = await nova('/');
  const eo = await envia(page, 'Ar condicionado: avaria / reparação', tel);
  const erro = await page.$eval('#eTel', (e) => e.textContent);
  if (valido) ok(eo && eo.telefone === tel && !erro, `O: «${tel}» segue`, { eo: eo && eo.telefone, erro });
  else ok(!eo && erro === 'Verifique o telefone: precisa de pelo menos 9 algarismos.', `O: «${tel}» não segue e pede para verificar o telefone`, { eo: eo && eo.telefone, erro });
  await page.context().close();
}

// P. estatísticas (README.md, «Estatísticas e consentimento»): com «sim» guardado, o primeiro envio ao PostHog falha
//    (503) e o visitante recusa na política logo a seguir. O PostHog guarda esse envio para o repetir uns segundos depois,
//    por um caminho que não passa pela recusa; nada pode chegar a um endereço do PostHog depois de «Recusar», o browser
//    fica só com 'mdm-estatisticas' e «Aceitar» outra vez na mesma página volta a enviar. Usa o posthog-js instalado
//    (npm install posthog-js, ao lado do Playwright), servido no lugar do CDN; sem ele, este caso é saltado
let phDist = null;
try { phDist = path.dirname(require.resolve('posthog-js/dist/array.js')); } catch (e) {}
if (!phDist) console.log('saltado P: sem o posthog-js em node_modules (npm install posthog-js, ao lado do Playwright)');
else {
  /* o PostHog não envia nada se o browser disser que é automático (navigator.webdriver ou «HeadlessChrome») */
  const browserP = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--disable-blink-features=AutomationControlled'] });
  const ctxP = await browserP.newContext({ viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' });
  const pedidosP = [], brutosP = []; let falhou = false;
  const eventosP = (q) => {
    const b = q.postDataBuffer(); if (!b) return '';
    let s; try { s = zlib.gunzipSync(b).toString(); } catch (e) { s = b.toString(); }
    if (/^data=/.test(s)) { try { s = Buffer.from(decodeURIComponent(s.slice(5)), 'base64').toString(); } catch (e) {} }
    brutosP.push({ t: Date.now(), s });
    let j; try { j = JSON.parse(s); } catch (e) { return [...s.matchAll(/"event":"([^"]+)"/g)].map((m) => m[1]).join(','); }
    const evs = Array.isArray(j) ? j : j && Array.isArray(j.batch) ? j.batch : [j];
    /* o clique sem efeito com o texto do elemento; no mapa de cliques, cada ponto (tipo@x,y, na página) */
    return evs.map((e) => {
      const p = (e && e.properties) || {};
      if (e.event === '$dead_click') return `$dead_click(${p.$el_text || ''})`;
      if (e.event === '$$heatmap') return '$$heatmap ' + Object.values(p.$heatmap_data || {}).flat().map((h) => `${h.type}@${Math.round(h.x)},${Math.round(h.y)}`).join(' ');
      return e.event;
    }).join(',');
  };
  await ctxP.route(/posthog\.com/, (r) => {
    const q = r.request(), u = new URL(q.url());
    pedidosP.push({ t: Date.now(), txt: `${q.method()} ${u.host}${u.pathname}${u.search} [${eventosP(q)}]` });
    const js = /^\/static\/(?:[\d.]+\/)?([\w.-]+\.js)$/.exec(u.pathname);
    if (js && fs.existsSync(path.join(phDist, js[1]))) return r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(phDist, js[1])) });
    if (/^\/e\/?$/.test(u.pathname) && !falhou) { falhou = true; return r.fulfill({ status: 503, body: '' }); }
    return r.fulfill({ contentType: 'application/json', body: '{"status":1}' });
  });
  page = await ctxP.newPage();
  page.on('pageerror', (e) => { falhas++; console.log('erro JS', e.message); });
  await page.goto(B + '/privacidade.html');
  await page.evaluate(() => localStorage.setItem('mdm-estatisticas', 'sim'));
  await page.reload();
  await page.waitForFunction(() => window.posthog && window.posthog.__loaded, null, { timeout: 10000 }).catch(() => {});
  for (let i = 0; i < 50 && !falhou; i++) await page.waitForTimeout(100);
  await page.waitForTimeout(600);
  const antesP = pedidosP.map((p) => p.txt);
  ok(falhou, 'P: com «sim», o PostHog carrega e o primeiro envio falha (503)', antesP);
  /* cliques num parágrafo sem ligações: o mapa de cliques guarda-os para os enviar de 5 em 5 s */
  const clica = async () => { for (let i = 0; i < 3; i++) await page.click('.priv-nota', { position: { x: 20 + i * 60, y: 6 } }); };
  await clica();
  const tRecusa = Date.now();
  await page.click('[data-est="nao"]');
  await page.evaluate(() => window.mdmTrack('depois_de_recusar'));
  await clica();
  await page.waitForTimeout(9000);
  const depoisP = pedidosP.filter((p) => p.t >= tRecusa).map((p) => p.txt);
  ok(falhou && !depoisP.length, 'P: depois de «Recusar», nenhum pedido ao PostHog em 9 s (nem o reenvio do que falhou)', { antesP, depoisP });
  const guardadoP = await page.evaluate(() => ({ local: Object.keys(localStorage), sessao: Object.keys(sessionStorage), cookies: document.cookie }));
  ok(guardadoP.local.join() === 'mdm-estatisticas' && !guardadoP.sessao.length && !guardadoP.cookies,
    'P: no browser fica só a escolha (sem cookies nem outras entradas)', guardadoP);
  const tAceita = Date.now();
  await page.click('[data-est="sim"]');
  await page.evaluate(() => window.mdmTrack('aceite_outra_vez'));
  for (let i = 0; i < 50 && !pedidosP.some((p) => p.t >= tAceita && /aceite_outra_vez/.test(p.txt)); i++) await page.waitForTimeout(100);
  ok(pedidosP.some((p) => p.t >= tAceita && /aceite_outra_vez/.test(p.txt)), 'P: «Aceitar» outra vez na mesma página volta a enviar',
    pedidosP.filter((p) => p.t >= tAceita).map((p) => p.txt));
  /* o PostHog regista o clique em «Recusar» antes de o botão reagir. Não o pode contar como clique sem efeito
     ($dead_click, ou deadclick no mapa de cliques) e enviá-lo depois de «Aceitar»: nem o da recusa de cima nem o de
     «Recusar» e «Aceitar» 200 ms depois. Os cliques no parágrafo depois de aceitar mostram que o mapa de cliques voltou
     (esses podem seguir como cliques sem efeito: o parágrafo não reage) */
  const tVaivem = Date.now();
  await page.click('[data-est="nao"]'); await page.waitForTimeout(200); await page.click('[data-est="sim"]');
  await clica();
  const mapaDepois = () => pedidosP.some((p) => p.t >= tVaivem && /\$\$heatmap .*\bclick@/.test(p.txt));
  for (let i = 0; i < 80 && !(mapaDepois() && Date.now() - tVaivem > 4500); i++) await page.waitForTimeout(100);
  const caixa = await page.$eval('[data-est="nao"]', (b) => { const r = b.getBoundingClientRect(); return { x0: r.left + scrollX - 30, x1: r.right + scrollX + 30, y0: r.top + scrollY - 30, y1: r.bottom + scrollY + 30 }; });
  const noRecusar = (t) => /\$dead_click\(Recusar\)/.test(t) ||
    [...t.matchAll(/deadclick@(-?\d+),(-?\d+)/g)].some(([, x, y]) => +x >= caixa.x0 && +x <= caixa.x1 && +y >= caixa.y0 && +y <= caixa.y1);
  const depoisAceitar = pedidosP.filter((p) => p.t >= tAceita).map((p) => p.txt);
  ok(mapaDepois() && !depoisAceitar.some(noRecusar),
    'P: depois de «Aceitar» outra vez, o mapa de cliques volta e o clique em «Recusar» não segue como clique sem efeito', { caixa, depoisAceitar });
  /* com as estatísticas aceites, um pedido completo: nada do que o cliente escreve nem o texto da página (o painel
     «Pedido enviado» tem o email e o telefone, a estimativa tem as divisões) chega ao PostHog, nem em cliques sem efeito
     no texto (README.md, «Estatísticas e consentimento»: mask_all_text e ph-no-capture na caixa do formulário) */
  const tDados = Date.now();
  await page.goto(B + '/index.html#orcamento');
  await page.waitForFunction(() => window.posthog && window.posthog.__loaded, null, { timeout: 10000 }).catch(() => {});
  await page.selectOption('#qServico', 'Ar condicionado: montagem / instalação');
  await page.evaluate(() => { document.getElementById('potencia').open = true; });
  const divP = page.locator('[data-pot-divs] [data-pot-linha]').first();
  await divP.locator('[data-pot="tipo"]').selectOption('Sala'); await divP.locator('[data-pot="area"]').fill('25');
  await page.click('[data-pot-juntar]');
  await page.fill('#qNome', 'Ana Conceição'); await page.fill('#qEmail', 'ana.conceicao@exemplo.pt'); await page.fill('#qTel', '912 345 678');
  await page.click('[data-pot-junta-txt]');
  await page.click('#sendEmail');
  await page.waitForSelector('[data-form-feito]:not([hidden])', { timeout: 15000 });
  const txtP = await page.locator('[data-feito-txt]').boundingBox();
  for (let i = 0; i < 3; i++) await page.mouse.click(txtP.x + 30 + i * 40, txtP.y + txtP.height / 2);
  await page.waitForTimeout(6500);
  await page.goto(B + '/privacidade.html');
  await page.waitForTimeout(1500);
  const dadosP = brutosP.filter((b) => b.t >= tDados).map((b) => b.s).join('\n');
  const fugas = ['ana.conceicao', 'Conceição', '912 345 678', '912345678', 'Sala 25', 'Vamos responder'].filter((x) => dadosP.includes(x));
  const textos = [...dadosP.matchAll(/"\$el_text":"([^"]+)"/g)].map((m) => m[1]);
  ok(dadosP.includes('quote_form_ok') && !fugas.length && !textos.length,
    'P: com as estatísticas aceites, um pedido não leva ao PostHog o que o cliente escreveu nem o texto da página', { fugas, textos });
  await browserP.close();
}

// Q. pedidos pelo Google (data/site.json «pedidosUrl», README.md «Encaminhamento dos pedidos»): o site gerado outra vez,
//    com MDM_PEDIDOS_URL a apontar para um servidor local que faz de Apps Script. Como o Google, este responde ao POST com
//    um 302 para outra origem (lá, script.googleusercontent.com), que dá o JSON. Cada pedido é um só POST text/plain com o
//    JSON combinado com o Apps Script (sem pedido prévio de CORS) e nenhum POST ao Netlify; o painel aparece só com
//    {ok: true}; com {ok: false} ou sem rede, o aviso de falha e o que se escreveu fica. O site dos casos de cima, sem
//    «pedidosUrl», não leva data-pedidos e envia para o Netlify, como sempre. A política de privacidade acompanha
//    «pedidosUrl» (com a data de «pedidosDesde», aqui MDM_PEDIDOS_DESDE), e a mensagem não passa o maxlength (o Apps
//    Script recusa campos com mais de 20 000 caracteres)
ok(!/data-pedidos=/.test(fs.readFileSync(path.join(PUB, 'index.html'), 'utf8')), 'Q: sem «pedidosUrl», o formulário não leva data-pedidos (casos A a P: Netlify)');
const pedidosQ = [], enviosQ = []; let respostaQ = 'ok', previosQ = 0;
const conteudoQ = http.createServer((req, res) => {
  const corpo = respostaQ === 'ok' ? { ok: true, ref: '20261010-teste' } : { ok: false, erro: 'Pedido recusado no teste.' };
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(corpo));
});
await ouve(conteudoQ);
const appsScript = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') { previosQ++; res.writeHead(204); return res.end(); }
  const partes = []; req.on('data', (c) => partes.push(c));
  req.on('end', () => {
    pedidosQ.push({ metodo: req.method, caminho: req.url, tipo: req.headers['content-type'] || '', corpo: Buffer.concat(partes).toString('utf8') });
    if (respostaQ === 'rede') { req.socket.destroy(); return; }
    res.writeHead(302, { location: `http://127.0.0.1:${conteudoQ.address().port}/macros/echo?user_content_key=teste`, 'access-control-allow-origin': '*' });
    res.end();
  });
});
await ouve(appsScript);
const PUBQ = path.join(tmp, 'public-google');
execFileSync('python3', ['build.py'], { cwd: W, stdio: 'ignore',
  env: { ...process.env, MDM_OUT: PUBQ, MDM_PEDIDOS_URL: `http://127.0.0.1:${appsScript.address().port}/macros/s/teste/exec`, MDM_PEDIDOS_DESDE: '2026-11-03' } });
const sitioQ = estatico(PUBQ, enviosQ);
await ouve(sitioQ);
const BQ = `http://127.0.0.1:${sitioQ.address().port}`;
/* a política de privacidade acompanha «pedidosUrl»: sem ele, tudo pelo Netlify, que nos envia cada pedido por email; com
   ele, o Apps Script na conta Google da MDM (email para a MDM e folha do Google) e o Netlify só sem JavaScript, sem
   prometer os avisos por email do Netlify (opcionais). Em nenhum dos dois diz que caixa de correio recebe os emails
   («Gmail»). A Google não entra na lista dos subcontratantes (depende do tipo de conta Google: README.md, «Privacidade»),
   mas a política diz que recebe o endereço IP de quem envia. A data no topo é a de «pedidosDesde» quando o texto passa a
   falar do Google. As notas internas ficam no README: o conteúdo da página publicada (<main>) não leva comentários */
const htmlPriv = (raiz) => fs.readFileSync(path.join(raiz, 'privacidade.html'), 'utf8');
const textoPriv = (raiz) => htmlPriv(raiz).replace(/<!--[\s\S]*?-->/g, '');
const corpoPriv = (raiz) => htmlPriv(raiz).split(/<main\b/)[1] || '';
const subcontratantes = (t) => (/\(subcontratantes\)[^<]*<\/p>\s*<ul>([\s\S]*?)<\/ul>/.exec(t) || [])[1] || '';
const privN = textoPriv(PUB), privQ = textoPriv(PUBQ);
ok(!/Apps Script|Google Sheets|conta Google/.test(privN) && /é-nos enviado por email/.test(privN) && /o Netlify envia-nos cada um por email/.test(privN),
  'Q: sem «pedidosUrl», a política diz que os pedidos vão todos para o Netlify, que no-los envia por email');
ok(/pequeno programa \(Apps Script\) na conta Google da MDM, que no-lo envia por email/.test(privQ) && /Google Sheets/.test(privQ) && !/sua conta Google/.test(privQ) &&
   !/é-nos enviado por email|envia-nos cada um por email/.test(privQ) && /desligado no seu browser/.test(privQ),
  'Q: com «pedidosUrl», a política fala da conta Google da MDM, do Netlify só sem JavaScript, e não promete o email do Netlify');
ok(!/Gmail/i.test(privN + privQ), 'Q: a política não diz que os pedidos chegam ao Gmail (não se sabe que caixa de correio os recebe)');
const dataPriv = (t) => (/Última atualização: <time datetime="([\d-]+)">([^<]+)<\/time>/.exec(t) || []).slice(1).join(' ');
ok(dataPriv(privN) === '2026-10-11 11 de outubro de 2026' && dataPriv(privQ) === '2026-11-03 3 de novembro de 2026',
  'Q: a data no topo da política: 11 de outubro de 2026 sem «pedidosUrl», a de «pedidosDesde» com ele', [dataPriv(privN), dataPriv(privQ)]);
ok(/passa pela Google, que recebe também o endereço IP/.test(privQ) && /a Google recebe também o endereço IP/.test(privQ) && !/endereço IP[^.]*Google|Google[^.]*endereço IP/.test(privN),
  'Q: com «pedidosUrl», a política diz que a Google recebe o endereço IP de quem envia (sem ele, a Google não aparece)');
ok(!/<!--/.test(corpoPriv(PUB) + corpoPriv(PUBQ)) && !/jurista/.test(htmlPriv(PUB) + htmlPriv(PUBQ)),
  'Q: a política publicada não leva comentários internos (as notas para o jurista ficam no README)');
ok(/Netlify/.test(subcontratantes(privN)) && /Netlify/.test(subcontratantes(privQ)) && !/Google/.test(subcontratantes(privN) + subcontratantes(privQ)),
  'Q: a Google não aparece entre os subcontratantes', subcontratantes(privQ));
const NOMES_Q = ['subject', 'pagina', 'triagem', 'potencia', 'estimativa', 'nome', 'email', 'telefone', 'servico', 'mensagem', 'bot-field'];
const MSG_Q = 'Sala com 25 m², 3.º andar.';
async function enviaQ(servico, foto, msg = MSG_Q) {
  page = await nova('/', BQ);
  await page.selectOption('#qServico', servico);
  await page.fill('#qNome', 'Cliente de teste «Q»'); await page.fill('#qEmail', 'cliente@exemplo.pt'); await page.fill('#qTel', '912 345 678');
  await page.fill('#qMsg', msg);
  if (foto) await page.setInputFiles('#qFoto', foto);
  const antes = pedidosQ.length;
  await page.click('#sendEmail');
  await page.waitForFunction(() => !document.querySelector('[data-form-feito]').hidden || /enviar/i.test(document.getElementById('quoteAlert').textContent));
  const novos = pedidosQ.slice(antes);
  let j = null; try { j = JSON.parse(novos[0].corpo); } catch (e) {}
  const ecra = await page.evaluate(() => ({ feito: !document.querySelector('[data-form-feito]').hidden, formEscondido: document.getElementById('quoteForm').hidden,
    painelSemWa: document.querySelector('[data-feito-wa]').hidden, aviso: document.getElementById('quoteAlert').textContent,
    wa: !!document.querySelector('#quoteAlert a[href*="wa.me"]'), tel: !!document.querySelector('#quoteAlert a[href^="tel:"]'),
    nome: document.getElementById('qNome').value }));
  await page.context().close();
  return { novos, j, ecra };
}
/* o Apps Script verdadeiro (google/pedidos.gs, com as imitações da Google de tests/apps-script.mjs) recebe cada corpo que
   o site enviou: tem de o aceitar, mandar o email ao destino certo, com a fotografia em anexo, e escrever a linha. Assim
   os dois lados do formato não se afastam sem um teste falhar. As fotografias têm os primeiros bytes de uma imagem
   verdadeira (fotoAmostra), porque o Apps Script só junta em anexo o que reconhece como fotografia */
let AS = null;
try { AS = await import('./apps-script.mjs'); } catch (e) { ok(false, 'Q: tests/apps-script.mjs carrega (o Apps Script com as imitações da Google)', String(e)); }
const EMAILS_Q = { comercial: 'mdmassist@mdmassist.com', geral: 'geral@exemplo.pt' };
function appsScriptQ(corpo) {
  const s = AS.carregaScript({ props: { EMAIL_COMERCIAL: EMAILS_Q.comercial, EMAIL_GERAL: EMAILS_Q.geral } });
  const r = s.envia(corpo);
  return { r, emails: s.enviados, linhas: s.linhas };
}
const FOTO_Q = AS ? AS.fotoAmostra('jpeg', 300 * 1000) : crypto.randomBytes(300 * 1000);
const HEIC_Q = AS ? AS.fotoAmostra('heic', 5000) : FOTO_Q.subarray(0, 5000);
for (const [servico, destino, formulario, etiqueta, foto, tipo] of [
  ['Ar condicionado: montagem / instalação', 'comercial', 'orcamento-comercial', '[P1 · Montagem AC]', null],
  ['Ar condicionado: avaria / reparação', 'geral', 'orcamento', '[P4 · Avaria AC]', { name: 'avaria.jpg', mimeType: 'image/jpeg', buffer: FOTO_Q }, 'image/jpeg'],
  /* sem tipo no browser (o HEIC, em alguns sistemas): o tipo sai da extensão */
  ['Outro / vários serviços', 'geral', 'orcamento', '[P5 · Outro]', { name: 'IMG_0001.HEIC', mimeType: '', buffer: HEIC_Q }, 'image/heic'],
]) {
  const { novos, j, ecra } = await enviaQ(servico, foto);
  const rot = `Q: ${servico}`;
  ok(novos.length === 1 && novos[0].metodo === 'POST' && novos[0].tipo === 'text/plain;charset=utf-8' && novos[0].caminho === '/macros/s/teste/exec' && !previosQ,
    `${rot}: um só POST text/plain ao Apps Script, sem pedido prévio de CORS`, { novos: novos.map((n) => [n.metodo, n.tipo, n.caminho]), previosQ });
  ok(j && j.versao === 1 && j.destino === destino && j.formulario === formulario, `${rot}: versao 1, destino «${destino}», formulario «${formulario}»`, j && [j.versao, j.destino, j.formulario]);
  const c = (j && j.campos) || {};
  ok(Object.keys(c).sort().join() === [...NOMES_Q].sort().join() && Object.values(c).every((v) => typeof v === 'string'), `${rot}: os campos do formulário Netlify, todos em texto`, Object.keys(c));
  ok(c.triagem === etiqueta && c.subject === `${etiqueta} Pedido de orçamento, ${servico}` && c.servico === servico && c.nome === 'Cliente de teste «Q»' &&
     c.email === 'cliente@exemplo.pt' && c.telefone === '912 345 678' && c.mensagem === MSG_Q && c.pagina === 'index.html' && c['bot-field'] === '',
    `${rot}: assunto, triagem e o que o cliente escreveu`, c);
  if (foto) {
    const f = (j && j.fotografia) || {};
    ok(f.nome === foto.name && f.tipo === tipo && typeof f.base64 === 'string' && !/^data:/.test(f.base64) && Buffer.from(f.base64, 'base64').equals(foto.buffer),
      `${rot}: a fotografia segue em base64 («${tipo}») e é a que se escolheu`, { nome: f.nome, tipo: f.tipo, tamanho: (f.base64 || '').length });
  } else ok(j && j.fotografia === null, `${rot}: sem fotografia, «fotografia» vai null`, j && j.fotografia);
  ok(ecra.feito && ecra.formEscondido && ecra.painelSemWa === (destino === 'comercial'), `${rot}: com {ok: true}, o painel «Pedido enviado»`, ecra);
  if (AS && novos.length) {
    const { r, emails, linhas } = appsScriptQ(novos[0].corpo);
    const m = emails[0] || {}, anexos = m.anexos || [];
    ok(r.ok === true && emails.length === 1 && m.to === EMAILS_Q[destino] && m.subject.startsWith(c.subject) && linhas.length === 2 &&
       (foto ? anexos.length === 1 && anexos[0].bytes.equals(foto.buffer) && anexos[0].tipo === tipo : !anexos.length),
      `${rot}: o Apps Script (google/pedidos.gs) aceita o pedido do site, manda o email a ${EMAILS_Q[destino]}${foto ? ', com a fotografia em anexo,' : ''} e escreve a linha`,
      { r, to: m.to, subject: m.subject, anexos: anexos.map((a) => [a.nome, a.tipo, a.bytes.length]), linhas: linhas.length });
  }
}
for (const modo of ['erro', 'rede']) {
  respostaQ = modo;
  const { novos, ecra } = await enviaQ('Bomba de calor: avaria / reparação', null);
  ok(novos.length === 1 && !ecra.feito && !ecra.formEscondido && /tente de novo/.test(ecra.aviso) && ecra.tel && ecra.wa && ecra.nome === 'Cliente de teste «Q»',
    `Q: ${modo === 'erro' ? 'com {ok: false}' : 'sem rede'}, o aviso de falha (telefone e WhatsApp) e o que se escreveu fica`, { novos: novos.length, ecra });
}
respostaQ = 'ok';
{
  /* colar 30 000 caracteres na mensagem: o maxlength (5 000) corta, e o pedido cabe no limite do Apps Script */
  const longa = 'Pinga água na sala. '.repeat(1500);
  const { novos, j, ecra } = await enviaQ('Ar condicionado: avaria / reparação', null, longa);
  const m = ((j && j.campos) || {}).mensagem || '';
  ok(novos.length === 1 && m.length === 5000 && longa.startsWith(m) && ecra.feito,
    'Q: uma mensagem de 30 000 caracteres segue com os 5 000 do maxlength (abaixo dos 20 000 do Apps Script)', { n: m.length, feito: ecra.feito });
  if (AS && novos.length) {
    const { r } = appsScriptQ(novos[0].corpo);
    ok(r.ok === true, 'Q: o Apps Script aceita essa mensagem cortada pelo maxlength', r);
  }
}
ok(!enviosQ.length, 'Q: com «pedidosUrl», nenhum POST ao Netlify («/»)', enviosQ);
appsScript.close(); conteudoQ.close(); sitioQ.close();

await browser.close(); servidor.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${falhas ? falhas + ' falhas' : 'tudo certo'}`);
process.exit(falhas ? 1 : 0);
