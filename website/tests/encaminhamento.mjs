/* Encaminhamento dos pedidos do formulário do site (README.md, «Encaminhamento dos pedidos»): instalação e manutenção
   vão para o formulário Netlify «orcamento-comercial» (o email do comercial) e só por email; avarias, «outro» e sem
   serviço ficam em «orcamento», com o WhatsApp. Também os caminhos que contornavam isto (estimativa junta sozinha no
   WhatsApp, obras de avaria, serviço reposto ao voltar atrás), a página inicial aberta em «/» e uma divisão acima de
   200 m². Gera o site numa pasta temporária (MDM_OUT) e serve-o num servidor local que guarda cada envio, como o Netlify
   Forms o receberia, e que pode falhar de propósito. Precisa do Playwright, fora das dependências. Uso, a partir de website/:
     NODE_PATH=/caminho/para/node_modules node tests/encaminhamento.mjs */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
/* o servidor: os ficheiros gerados e, como o Netlify Forms, os POST para "/" */
const envios = []; let falhar = false;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  if (req.method === 'POST') {
    const partes = []; req.on('data', (c) => partes.push(c));
    req.on('end', () => { envios.push(campos(Buffer.concat(partes), req.headers['content-type'] || '')); res.writeHead(falhar ? 500 : 200); res.end(); });
    return;
  }
  let f = path.join(PUB, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${servidor.address().port}`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function nova(url = '/') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route(/posthog/, (r) => r.abort());
  await ctx.addInitScript(() => { try { localStorage.setItem('mdm-estatisticas', 'nao'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { falhas++; console.log('erro JS', e.message); });
  await page.goto(B + url);
  return page;
}
const whatsEscondido = (page) => page.$eval('#sendWhats', (b) => b.hidden);
async function envia(page, servico) {
  if (servico !== null) await page.selectOption('#qServico', servico);
  await page.fill('#qNome', 'Cliente de teste'); await page.fill('#qTel', '912 345 678');
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

await browser.close(); servidor.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${falhas ? falhas + ' falhas' : 'tudo certo'}`);
process.exit(falhas ? 1 : 0);
