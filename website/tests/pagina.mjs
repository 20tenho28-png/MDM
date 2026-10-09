/* Testes da página interna (equipa/proposta.html) no browser, contra a função real (empacotada com esbuild) e uma API do
   Claude falsa: o caminho do formulário, a leitura com IA, a conversa e as falhas corrigidas na revisão (senha com
   acentos, escrever durante o carregamento, PDF só com a proposta, proposta desatualizada, «Nova proposta» a meio,
   notas repetidas, recusas e respostas cortadas, perguntas de outro serviço, telemóvel a 320 px).
   Gera o site numa pasta temporária (MDM_OUT) e serve-o numa porta livre. Precisa do Playwright, fora das dependências.
   Uso, a partir de website/:
     npm install && NODE_PATH=/caminho/para/node_modules node tests/pagina.mjs */
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import Anthropic from '@anthropic-ai/sdk';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-pagina-'));
execFileSync('python3', ['build.py'], { cwd: W, stdio: 'ignore', env: { ...process.env, MDM_OUT: path.join(tmp, 'public') } });
await build({ entryPoints: [path.join(W, 'netlify/functions/proposta.mts')], bundle: true, platform: 'node', format: 'esm',
  outfile: path.join(tmp, 'fn/proposta.mjs'), external: ['@anthropic-ai/sdk'], logLevel: 'error' });
fs.symlinkSync(path.join(W, 'node_modules'), path.join(tmp, 'fn/node_modules'));
const { atende } = await import(path.join(tmp, 'fn/proposta.mjs'));
const PORTA = await new Promise((r) => { const s = net.createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const servidor = spawn('python3', ['-m', 'http.server', String(PORTA), '-d', path.join(tmp, 'public'), '--bind', '127.0.0.1'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let falhas = 0; const ok = (c, m, x) => { if (!c) { falhas++; console.log('FALHA ' + m, x === undefined ? '' : JSON.stringify(x).slice(0, 500)); } else console.log('ok ' + m); };
const fila = [], pedidos = [];
const api = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
  pedidos.push(JSON.parse(b));
  const r = fila.shift() || { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' };
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'm', type: 'message', role: 'assistant', model: 'x', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }, ...r })); }); });
await new Promise(r => api.listen(0, '127.0.0.1', r));
const cliente = new Anthropic({ apiKey: 'x', baseURL: `http://127.0.0.1:${api.address().port}`, maxRetries: 0 });
const SENHA = 'grelha€“prumo”';
const env = { get: k => ({ MDM_EQUIPA_SENHA: SENHA, MDM_PRECOS: 'teste' })[k] };
const V = { pre: '', dist: '', furo: '', fora: '', luz: '', antigas: '', deposito: '' };
const atraso = {};   // acao -> ms
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function nova(w = 1440) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { falhas++; console.log('erro JS', e.message); });
  page.on('dialog', d => d.accept());
  await page.route('**/api/proposta', async route => {
    const rq = route.request(), corpo = JSON.parse(rq.postData() || '{}');
    const ms = atraso[corpo.acao || 'conversa']; if (ms) await new Promise(r => setTimeout(r, ms));
    const r = await atende(new Request('http://x/api/proposta', { method: 'POST', headers: rq.headers(), body: rq.postData() }), env, cliente);
    await route.fulfill({ status: r.status, contentType: 'application/json', body: await r.text() }).catch(() => {});
  });
  await page.goto(`http://127.0.0.1:${PORTA}/equipa/proposta.html`);
  return page;
}
const entra = async (page) => { await page.fill('#senha', SENHA); await page.click('[data-entrar-form] button'); };
const pronto = (page) => page.waitForSelector('.eq-div [data-d="tipo"] option', { state: 'attached', timeout: 15000 });
const docTem = (page, re) => page.waitForFunction((s) => new RegExp(s).test(document.querySelector('.doc')?.textContent || ''), re.source, { timeout: 15000 });

// A. senha com € e aspas curvas; escrever durante o carregamento da tabela não apaga nada
let page = await nova();
await page.evaluate(() => sessionStorage.setItem('mdm-equipa-conversa', JSON.stringify({ mensagens: [], propostas: [], teste: true, atual: -1, aba: 'form',
  form: { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 33, sol: false, topo: false }], respostas: {}, nome: 'Guardado', contacto: '', local: 'Olivais', pedido: '', notas: '', texto: '', duvidas: [], complexoIA: [] } })));
await page.reload();
atraso.tabela = 1500;
await entra(page);
ok(await page.$eval('[data-form-prop]', f => f.inert) === true && await page.$eval('[data-ler]', b => b.disabled), 'A: formulário parado enquanto a tabela carrega');
await page.keyboard.type('xyz');
await pronto(page); delete atraso.tabela;
ok(await page.inputValue('#cNome') === 'Guardado' && await page.inputValue('.eq-div [data-d="area"]') === '33', 'A: senha com € entra e o formulário guardado não se perde');
await docTem(page, /Split para 1 divisão/);
ok(true, 'A: proposta calculada');

// B. PDF: só a proposta
await page.emulateMedia({ media: 'print' });
const esqVisivel = await page.$eval('.eq-esq', e => getComputedStyle(e).display !== 'none');
const docVisivel = await page.$eval('.doc', e => getComputedStyle(e).display !== 'none');
await page.emulateMedia({ media: 'screen' });
ok(!esqVisivel && docVisivel, 'B: na impressão só aparece a proposta');

// C. proposta desatualizada sai quando o formulário deixa de dar proposta
await page.click('label.eq-op:has(input[value="aguasQuentes"])');
await page.waitForFunction(() => /depósito/.test(document.querySelector('[data-calc-estado]').textContent), null, { timeout: 15000 });
ok(await page.isHidden('[data-prop-zona]'), 'C: depósito por escolher: a proposta antiga sai');
await page.click('label.eq-op:has(input[name="q-deposito"][value="300"])');
await docTem(page, /depósito de 300/);
ok(true, 'C: com o depósito, volta a haver proposta');
await page.click('label.eq-op:has(input[value="ac"])');
await page.fill('.eq-div [data-d="area"]', '');
await page.waitForFunction(() => /pelo menos uma divisão/.test(document.querySelector('[data-calc-estado]').textContent), null, { timeout: 15000 });
ok(await page.isHidden('[data-prop-zona]'), 'C: sem área: sem proposta à vista');
await page.fill('.eq-div [data-d="area"]', '250');
await page.waitForSelector('[data-complexo]:not([hidden])', { timeout: 15000 });
ok(/mais de 200 m²/.test(await page.textContent('[data-complexo]')), 'C: área acima de 200 m² dá caso complexo');
ok(await page.$eval('.eq-div [data-d="area"]', i => i.getAttribute('aria-describedby') && document.getElementById(i.getAttribute('aria-describedby')).textContent.length > 0), 'C: erro da área ligado ao campo');

// D. «Nova proposta» com a leitura a meio: a resposta antiga não volta
await page.fill('.eq-div [data-d="area"]', '20');
fila.push({ content: [{ type: 'text', text: JSON.stringify({ servico: 'ac', divisoes: [{ tipo: 'Quarto', area: 14, sol: false, ultimo_andar: false }], respostas: V, local: 'Antiga', pedido: 'Antigo', notas: [], duvidas: [], complexo: false, motivo_complexo: '' }) }], stop_reason: 'end_turn' });
atraso.ler = 1500;
await page.fill('[data-texto]', 'quarto de 14');
await page.click('[data-ler]');
await page.click('[data-nova]');
await page.waitForTimeout(2200); delete atraso.ler;
ok(await page.inputValue('#cLocal') === '' && await page.inputValue('#cPedido') === '' && !(await page.$eval('[data-ler]', b => b.disabled)), 'D: leitura antiga ignorada depois de «Nova proposta»');

// E. notas da IA não se repetem
for (let i = 0; i < 2; i++) {
  fila.push({ content: [{ type: 'text', text: JSON.stringify({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20, sol: false, ultimo_andar: false }], respostas: V, local: '', pedido: '', notas: ['Prédio com elevador.'], duvidas: [], complexo: false, motivo_complexo: '' }) }], stop_reason: 'end_turn' });
  await page.fill('[data-texto]', 'sala 20');
  await page.click('[data-ler]');
  await page.waitForFunction(() => /preenchido/.test(document.querySelector('[data-ler-estado]').textContent));
  await page.evaluate(() => { document.querySelector('[data-ler-estado]').textContent = ''; });
}
ok((await page.inputValue('#cNotas')).split('\n').length === 1, 'E: a mesma nota não se repete', await page.inputValue('#cNotas'));

// F. recusa e resposta cortada com ferramenta: a mensagem volta à caixa e o histórico fica limpo
await page.click('#abaChat');
fila.push({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } });
await page.fill('[data-msg]', 'mensagem recusada');
await page.click('[data-enviar]');
await page.waitForSelector('.msg-erro');
ok(await page.inputValue('[data-msg]') === 'mensagem recusada' && (await page.$$('.msg-eu')).length === 0, 'F: recusa: mensagem volta à caixa');
fila.push({ content: [{ type: 'tool_use', id: 'tc', name: 'calcular_preco', input: {} }], stop_reason: 'max_tokens' });
await page.click('[data-enviar]');
await page.waitForFunction(() => /cortada a meio/.test(document.querySelector('[data-msgs]').textContent));
ok(await page.inputValue('[data-msg]') === 'mensagem recusada', 'F: ferramenta cortada: mensagem volta à caixa');
fila.push({ content: [{ type: 'text', text: 'Agora sim.' }], stop_reason: 'end_turn' });
await page.click('[data-enviar]');
await page.waitForFunction(() => /Agora sim/.test(document.querySelector('[data-msgs]').textContent));
const hist = pedidos.at(-1).messages;
ok(hist.length === 1 && hist[0].content === 'mensagem recusada', 'F: a API recebe só a mensagem, uma vez', hist);

// G. «Passar para o assistente» só leva as perguntas do serviço escolhido
await page.click('#abaForm');
await page.click('label.eq-op:has(input[name="q-pre"][value="sim"])');
await page.click('label.eq-op:has(input[value="aguasQuentes"])');
await page.click('label.eq-op:has(input[name="q-deposito"][value="200"])');
await page.click('label.eq-op:has(input[value="outro"])');
await page.waitForSelector('[data-complexo]:not([hidden])');
await page.click('[data-passar]');
const passado = await page.inputValue('[data-msg]');
ok(!/pré-instalação/.test(passado) && !/depósito/i.test(passado), 'G: outro trabalho não leva respostas de AC nem de águas quentes', passado);
await page.context().close();

// H. telemóvel 320 px: sem deslize horizontal com email comprido e divisão enorme
page = await nova(320);
await page.evaluate(() => sessionStorage.setItem('mdm-equipa-conversa', JSON.stringify({ mensagens: [], propostas: [], teste: true, atual: -1, aba: 'form',
  form: { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 150, sol: true, topo: true }], respostas: {}, nome: 'Cliente', contacto: 'um.email.muito.comprido.para.testar@exemplo-de-dominio.pt', local: '', pedido: '', notas: '', texto: '', duvidas: [], complexoIA: [] } })));
await page.reload();
await entra(page); await pronto(page);
await docTem(page, /a dimensionar na visita/);
const larg = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(larg[0] <= larg[1], 'H: 320 px sem deslize horizontal', larg);
await page.context().close();

await browser.close(); api.close(); servidor.kill();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${falhas ? falhas + ' falhas' : 'tudo certo'}`);
process.exit(falhas ? 1 : 0);
