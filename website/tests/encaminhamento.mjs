/* Encaminhamento dos pedidos do formulário do site (README.md, «Encaminhamento dos pedidos»): instalação e manutenção
   vão para o formulário Netlify «orcamento-comercial» (o email do comercial) e só por email; avarias, «outro» e sem
   serviço ficam em «orcamento», com o WhatsApp. Gera o site numa pasta temporária (MDM_OUT) e serve-o num servidor local
   que guarda cada envio, como o Netlify Forms o receberia, e que pode falhar de propósito. Precisa do Playwright, fora
   das dependências. Uso, a partir de website/:
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

await browser.close(); servidor.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${falhas ? falhas + ' falhas' : 'tudo certo'}`);
process.exit(falhas ? 1 : 0);
