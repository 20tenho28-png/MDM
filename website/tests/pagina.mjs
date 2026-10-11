/* Testes da página interna (equipa/proposta.html) no browser, contra a função real (empacotada com esbuild) e uma API do
   Claude falsa: o caminho do formulário, a leitura com IA, a conversa e as falhas corrigidas na revisão (senha com
   acentos, escrever durante o carregamento, PDF só com a proposta, proposta desatualizada, «Nova proposta» a meio,
   notas repetidas, recusas e respostas cortadas, perguntas de outro serviço, telemóvel a 320 px, a senha fora do
   endereço, a referência que não muda sem razão, sem ligação, «Sair» sem «Senha errada», a tabela que carrega depois de
   uma senha que não valia, a tabela vazia com a potência).
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
const vars = { MDM_EQUIPA_SENHA: SENHA, MDM_PRECOS: 'teste' };   // MDM_PRECOS = '' para a tabela real (vazia)
const env = { get: k => vars[k] };
const V = { pre: '', dist: '', furo: '', fora: '', luz: '', antigas: '', deposito: '' };
const atraso = {};   // acao -> ms
const falhaUma = {};  // acao -> true: a próxima resposta dessa ação é um 500
const corta = {};     // acao -> true: o pedido dessa ação falha sem ligação, até se apagar
let semSenha = 0;     // pedidos que chegaram sem senha
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
async function nova(w = 1440, { semScript = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { falhas++; console.log('erro JS', e.message); });
  page.on('dialog', d => d.accept());
  if (semScript) await page.route('**/equipa/proposta.js', route => route.abort());
  await page.route('**/api/proposta', async route => {
    const rq = route.request(), corpo = JSON.parse(rq.postData() || '{}');
    if (!rq.headers()['x-mdm-senha']) semSenha++;
    if (corta[corpo.acao || 'conversa']) return route.abort('internetdisconnected').catch(() => {});
    const ms = atraso[corpo.acao || 'conversa']; if (ms) await new Promise(r => setTimeout(r, ms));
    if (falhaUma[corpo.acao || 'conversa']) { delete falhaUma[corpo.acao || 'conversa']; return route.fulfill({ status: 500, contentType: 'application/json', body: '{"erro":"falha simulada"}' }).catch(() => {}); }
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
// o que a leitura deixa de fora pelas regras da MDM (uma marca proibida) aparece com o motivo
fila.push({ content: [{ type: 'text', text: JSON.stringify({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20, sol: false, ultimo_andar: false }], respostas: V, local: '', pedido: 'Trocar a Carrier da sala', notas: ['Máquina Carrier antiga.', 'Prédio com elevador.'], duvidas: [], complexo: false, motivo_complexo: '' }) }], stop_reason: 'end_turn' });
await page.fill('[data-texto]', 'trocar a carrier da sala');
await page.click('[data-ler]');
await page.waitForFunction(() => /preenchido/.test(document.querySelector('[data-ler-estado]').textContent));
const estE = await page.textContent('[data-ler-estado]'), notasE = await page.inputValue('#cNotas');
ok(/Não passou para o formulário/.test(estE) && /Carrier antiga\.»: marca fora da lista/.test(estE) && /pedido: marca fora da lista/.test(estE)
  && !/Carrier/.test(notasE + await page.inputValue('#cPedido')), 'E: a leitura diz porquê uma nota e o pedido ficaram de fora', { estE, notasE });
await page.evaluate(() => { document.querySelector('[data-ler-estado]').textContent = ''; });

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

// I. «Nova proposta» enquanto a tabela carrega: a tabela volta a pedir-se e o formulário fica ativo
page = await nova();
atraso.tabela = 1200;
await entra(page);
await page.click('[data-nova]');
await pronto(page); delete atraso.tabela;
await page.waitForFunction(() => !document.querySelector('[data-form-prop]').inert, null, { timeout: 15000 });
ok(!(await page.$eval('[data-ler]', b => b.disabled)), 'I: depois de «Nova proposta» a meio do carregamento, o formulário fica ativo');

// R. role=log: uma recusa não redesenha as mensagens que já lá estavam
await page.click('#abaChat');
fila.push({ content: [{ type: 'text', text: 'Primeira resposta.' }], stop_reason: 'end_turn' });
await page.fill('[data-msg]', 'primeira'); await page.click('[data-enviar]');
await page.waitForFunction(() => /Primeira resposta/.test(document.querySelector('[data-msgs]').textContent));
await page.evaluate(() => { document.querySelector('.msg-ia').__marca = 1; });
fila.push({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } });
await page.fill('[data-msg]', 'segunda'); await page.click('[data-enviar]');
await page.waitForSelector('.msg-erro');
ok(await page.evaluate(() => document.querySelector('.msg-ia').__marca === 1), 'R: recusa não redesenha a conversa (role=log)');

// K. a mensagem devolvida junta-se ao que a equipa já tinha começado a escrever
fila.push({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } });
atraso.conversa = 800;
await page.click('[data-enviar]');
await page.fill('[data-msg]', 'texto novo');
await page.waitForFunction(() => document.querySelectorAll('.msg-erro').length >= 2);
delete atraso.conversa;
ok(/segunda/.test(await page.inputValue('[data-msg]')) && /texto novo/.test(await page.inputValue('[data-msg]')), 'K: mensagem devolvida junta-se ao texto já escrito', await page.inputValue('[data-msg]'));

// J. «Sair» a meio da conversa: a resposta já paga entra, sem mensagem órfã
await page.fill('[data-msg]', 'pergunta antes de sair');
fila.push({ content: [{ type: 'text', text: 'Resposta depois de sair.' }], stop_reason: 'end_turn' });
atraso.conversa = 800;
await page.click('[data-enviar]');
await page.click('[data-sair]');
await page.waitForTimeout(1300); delete atraso.conversa;
await entra(page);
await page.waitForFunction(() => /Resposta depois de sair/.test(document.querySelector('[data-msgs]').textContent), null, { timeout: 15000 });
const doisSeguidos = await page.evaluate(() => { const m = JSON.parse(sessionStorage.getItem('mdm-equipa-conversa')).mensagens; return m.some((x, i) => i && x.role === 'user' && typeof x.content === 'string' && m[i - 1].role === 'user' && typeof m[i - 1].content === 'string'); });
ok(!doisSeguidos, 'J: depois de sair e entrar, a resposta está lá e não há mensagens órfãs');

// P. «Nova proposta» pergunta antes de apagar um rascunho na caixa da conversa
let dialogos = 0; page.on('dialog', () => { dialogos++; });
await page.fill('[data-msg]', 'rascunho por enviar');
await page.click('[data-nova]');
ok(dialogos >= 1, 'P: rascunho na caixa da conversa conta como dados');
await page.context().close();

// L. recarregar a meio de uma resposta: o texto volta à caixa e o histórico fica certo
page = await nova();
await page.evaluate(() => sessionStorage.setItem('mdm-equipa-conversa', JSON.stringify({ mensagens: [{ role: 'user', content: 'olá' }, { role: 'assistant', content: [{ type: 'text', text: 'olá!' }] }, { role: 'user', content: 'mensagem sem resposta' }], propostas: [], teste: true, atual: -1, aba: 'chat',
  form: { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20, sol: false, topo: false }], respostas: {}, nome: '', contacto: '', local: '', pedido: '', notas: '', texto: 'mensagem do cliente guardada', duvidas: [], complexoIA: [] } })));
await page.reload();
atraso.tabela = 1200;
await entra(page);
ok(await page.inputValue('[data-msg]') === 'mensagem sem resposta' && (await page.$$('.msg-eu')).length === 1, 'L: recarregar a meio: mensagem volta à caixa');
await page.click('#abaForm');
ok(await page.inputValue('[data-texto]') === 'mensagem do cliente guardada', 'M: mensagem do cliente visível enquanto a tabela carrega');
await pronto(page); delete atraso.tabela;

// O. área acima de 200 m²: a divisão entra no cálculo, a dimensionar na visita (proposta sem preço firme), com o aviso na
//    divisão e sem «por corrigir»
await page.fill('.eq-div [data-d="area"]', '260');
await page.waitForFunction(() => /dimensiona-se na visita/.test(document.querySelector('.eq-div [data-d="erro"]').textContent)
  && /Proposta atualizada/.test(document.querySelector('[data-calc-estado]').textContent), null, { timeout: 15000 });
const docO = await page.textContent('.doc');
ok(!/por corrigir|Escreva a área/.test(await page.textContent('[data-calc-estado]')) && await page.getAttribute('.eq-div [data-d="area"]', 'aria-invalid') === 'false'
  && /visita/.test(docO) && !/\d\s?€/.test(docO), 'O: área acima de 200 m²: proposta de visita, sem preço e sem erro', docO.slice(0, 300));

// S. motivo da IA fica; os calculados acompanham o formulário
fila.push({ content: [{ type: 'text', text: JSON.stringify({ servico: 'ac', divisoes: Array.from({ length: 5 }, () => ({ tipo: 'Quarto', area: 10, sol: false, ultimo_andar: false })), respostas: V, local: '', pedido: '', notas: [], duvidas: [], complexo: true, motivo_complexo: 'Fachada protegida.' }) }], stop_reason: 'end_turn' });
await page.fill('[data-texto]', 'cinco quartos, fachada protegida');
await page.click('[data-ler]');
await page.waitForFunction(() => /5 divisões/.test(document.querySelector('[data-complexo]').textContent), null, { timeout: 15000 });
for (let i = 0; i < 3; i++) await page.click('.eq-div >> nth=0 >> [data-d="tira"]');
await page.waitForFunction(() => !/5 divisões/.test(document.querySelector('[data-complexo]').textContent), null, { timeout: 15000 });
ok(/Fachada protegida/.test(await page.textContent('[data-complexo]')), 'S: com 2 divisões, fica só o motivo da IA');
await page.context().close();

// Q. tabela que falha: «Tentar outra vez» com o foco num sítio visível
page = await nova();
falhaUma.tabela = true;
await entra(page);
await page.waitForSelector('[data-recarrega]:not([hidden])', { timeout: 15000 });
/* a ordem do foco regista-se: a tabela chega uns 20 ms depois e leva o foco ao formulário, e lê-lo depois do clique chegava tarde */
await page.evaluate(() => { window.__focos = []; document.addEventListener('focusin', (e) => window.__focos.push(e.target.matches('[data-calc-estado]') ? 'estado' : e.target.name || e.target.tagName), true); });
await page.click('[data-recarrega]');
await pronto(page);
await page.waitForFunction(() => document.activeElement && document.activeElement.matches('input[name="servico"]'), null, { timeout: 15000 });
const focos = await page.evaluate(() => window.__focos);
ok(focos.includes('estado') && focos.indexOf('estado') < focos.indexOf('servico'), 'Q: «Tentar outra vez»: foco na linha de estado e depois no formulário', focos);
await page.context().close();

// N. 320 px com «Escritório», décimas e duas divisões: sem deslize da página
page = await nova(320);
await page.evaluate(() => sessionStorage.setItem('mdm-equipa-conversa', JSON.stringify({ mensagens: [], propostas: [], teste: true, atual: -1, aba: 'form',
  form: { servico: 'ac', divisoes: [{ tipo: 'Escritório', area: 12.75, sol: true, topo: true }, { tipo: 'Outra divisão', area: 33.25, sol: true, topo: false }], respostas: {}, nome: '', contacto: '', local: '', pedido: '', notas: '', texto: '', duvidas: [], complexoIA: [] } })));
await page.reload();
await entra(page); await pronto(page);
await docTem(page, /Multi-split/);
const larg2 = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
ok(larg2[0] <= larg2[1], 'N: 320 px com tabela larga sem deslize da página', larg2);
await page.context().close();

// T. sem o script (lento, bloqueado ou desligado), Enter no campo da senha não a põe no endereço nem no pedido
page = await nova(1440, { semScript: true });
const navs = []; page.on('request', rq => { if (rq.isNavigationRequest()) navs.push({ metodo: rq.method(), url: rq.url(), corpo: rq.postData() || '' }); });
await page.fill('#senha', SENHA);
await Promise.all([page.waitForEvent('framenavigated', { timeout: 15000 }), page.press('#senha', 'Enter')]);
const ida = navs.at(-1) || {};
ok(new URL(page.url()).search === '' && !/senha/i.test(page.url()) && ida.metodo === 'POST' && !/senha|prumo|grelha/i.test(decodeURIComponent(ida.url + ida.corpo)),
  'T: sem o script, a senha não vai no endereço nem no pedido', { url: page.url(), ida });
await page.context().close();

// U. a mesma proposta do formulário guarda a referência, a data e a escolha; uma conta nova só muda a escolha se ela era a do
//    formulário (ou se não havia nenhuma)
const guardado = (page) => page.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('mdm-equipa-conversa'));
  return { atual: s.atual, form: (s.propostas.find(p => p.origem === 'form') || {}).ref || '', data: (s.propostas.find(p => p.origem === 'form') || {}).data || '',
    origens: s.propostas.map(p => p.origem) }; });
const calculou = async (page, accao) => {
  await page.evaluate(() => { document.querySelector('[data-calc-estado]').textContent = ''; });
  await accao();
  await page.waitForFunction(() => /Proposta atualizada|Sem ligação|pelo menos uma divisão/.test(document.querySelector('[data-calc-estado]').textContent), null, { timeout: 15000 });
};
page = await nova();
await page.evaluate(() => sessionStorage.setItem('mdm-equipa-conversa', JSON.stringify({ mensagens: [], propostas: [], teste: true, atual: -1, aba: 'form',
  form: { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: false, topo: false }], respostas: {}, nome: 'Ana', contacto: '', local: '', pedido: '', notas: '', texto: '', duvidas: [], complexoIA: [] } })));
await page.reload();
await calculou(page, async () => { await entra(page); await pronto(page); });
fila.push({ content: [{ type: 'tool_use', id: 'tu', name: 'preparar_proposta', input: { servico: 'ac', divisoes: [{ tipo: 'Quarto', area: 12, sol: false, ultimo_andar: false }], respostas: V,
  cliente: { nome: 'Do assistente', contacto: '', local: '' }, pedido: 'Quarto', observacoes: [] } }], stop_reason: 'tool_use' });
fila.push({ content: [{ type: 'text', text: 'Proposta pronta.' }], stop_reason: 'end_turn' });
await page.click('#abaChat');
await page.fill('[data-msg]', 'proposta do quarto'); await page.click('[data-enviar]');
await page.waitForFunction(() => /Proposta pronta/.test(document.querySelector('[data-msgs]').textContent), null, { timeout: 15000 });
const u0 = await guardado(page);
ok(u0.origens.join() === 'form,chat' && u0.atual === 1 && /Do assistente/.test(await page.textContent('.doc')), 'U: a proposta do assistente fica escolhida', u0);
await page.click('#abaForm');
await calculou(page, () => page.reload());
let u = await guardado(page);
ok(u.form === u0.form && u.data === u0.data && u.atual === 1, 'U: recarregar não muda a referência, a data nem a escolha', { u0, u });
await page.click('[data-sair]');
await calculou(page, () => entra(page));
u = await guardado(page);
ok(u.form === u0.form && u.atual === 1, 'U: sair e entrar não muda a referência nem a escolha', { u0, u });
await calculou(page, async () => { await page.fill('#cNome', 'Ana'); await page.press('#cNome', 'Tab'); });
u = await guardado(page);
ok(u.form === u0.form && u.atual === 1, 'U: um campo que não mudou não muda nada', { u0, u });
await calculou(page, () => page.fill('.eq-div [data-d="area"]', '30'));
u = await guardado(page);
ok(u.form !== u0.form && u.atual === 1 && /Do assistente/.test(await page.textContent('.doc')), 'U: conta nova com a do assistente escolhida: a escolha fica', { u0, u });
await page.selectOption('[data-qual]', '0');
await calculou(page, () => page.fill('.eq-div [data-d="area"]', '35'));
u = await guardado(page);
ok(u.atual === 0 && /35\sm²/.test(await page.textContent('.doc')), 'U: conta nova com a do formulário escolhida: continua à vista', u);
await calculou(page, () => page.fill('.eq-div [data-d="area"]', ''));
await calculou(page, () => page.fill('.eq-div [data-d="area"]', '28'));
u = await guardado(page);
ok(u.origens[u.atual] === 'form' && /28\sm²/.test(await page.textContent('.doc')), 'U: sem área a do formulário sai; com área volta e fica à vista', u);

// V. sem ligação: a proposta do formulário, já desatualizada, sai (como num erro da função)
corta.calcular = true;
await calculou(page, () => page.fill('.eq-div [data-d="area"]', '40'));
delete corta.calcular;
u = await guardado(page);
ok(/Sem ligação/.test(await page.textContent('[data-calc-estado]')) && !u.origens.includes('form') && !/28\sm²|40\sm²/.test(await page.textContent('.doc')),
  'V: sem ligação, a proposta antiga do formulário sai', u);
await calculou(page, () => page.fill('.eq-div [data-d="area"]', '41'));
u = await guardado(page);
ok(u.origens[u.atual] === 'form' && /41\sm²/.test(await page.textContent('.doc')), 'V: com ligação, a proposta volta', u);
await page.context().close();

// W. «Sair» logo depois de escrever: nenhum pedido sem senha e nenhum «Senha errada»; uma senha errada a sério continua a avisar
page = await nova();
await entra(page); await pronto(page);
const semSenhaAntes = semSenha;
await page.fill('.eq-div [data-d="area"]', '22');
await page.click('[data-sair]');
await page.waitForTimeout(1000);
ok(await page.textContent('[data-entrar-erro]') === '' && semSenha === semSenhaAntes, 'W: «Sair» sem «Senha errada» e sem pedidos sem senha', { erro: await page.textContent('[data-entrar-erro]'), semSenha: semSenha - semSenhaAntes });
await page.fill('#senha', 'errada'); await page.click('[data-entrar-form] button');
await page.waitForFunction(() => /Senha errada/.test(document.querySelector('[data-entrar-erro]').textContent), null, { timeout: 15000 });
ok(true, 'W: uma senha errada continua a dar «Senha errada»');
await page.context().close();

// Y. a tabela ainda a caminho com uma senha que não vale (escrita errada, ou a guardada que deixou de valer), «Sair» e a senha
//    certa: a entrada nova carrega a tabela, o 401 antigo não a deixa presa em «A carregar» nem traz «Senha errada»
const carregou = (page) => page.waitForSelector('.eq-div [data-d="tipo"] option', { state: 'attached', timeout: 8000 }).then(() => true, () => false);
const estadoY = async (page) => ({ erro: await page.textContent('[data-entrar-erro]'), dentro: await page.isVisible('[data-sair]'),
  inerte: await page.$eval('[data-form-prop]', f => f.inert), ler: await page.$eval('[data-ler]', b => b.disabled), estado: await page.textContent('[data-calc-estado]') });
for (const guardada of [false, true]) {
  page = await nova();
  atraso.tabela = 1500;
  if (guardada) { await page.evaluate(() => sessionStorage.setItem('mdm-equipa-senha', 'antiga')); await page.reload(); }
  else { await page.fill('#senha', 'errada'); await page.click('[data-entrar-form] button'); }
  await page.waitForTimeout(300);
  await page.click('[data-sair]');
  await entra(page);
  await page.waitForTimeout(300); delete atraso.tabela;
  const tem = await carregou(page);
  await page.waitForTimeout(1500);   // o 401 da entrada anterior já chegou
  const y = await estadoY(page);
  ok(tem && y.erro === '' && y.dentro && !y.inerte && !y.ler && !/A carregar/.test(y.estado),
    'Y: ' + (guardada ? 'senha guardada que deixou de valer' : 'senha errada') + ', «Sair» e a certa com a tabela a caminho: a tabela carrega', { tem, ...y });
  await page.context().close();
}

// X. tabela real vazia: a potência de cada divisão e o total, os motivos, e nenhum preço
vars.MDM_PRECOS = '';
page = await nova();
await page.evaluate(() => sessionStorage.setItem('mdm-equipa-conversa', JSON.stringify({ mensagens: [], propostas: [], teste: false, atual: -1, aba: 'form',
  form: { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: false, topo: false }, { tipo: 'Sala', area: 90, sol: false, topo: false }], respostas: {}, nome: '', contacto: '', local: '', pedido: '', notas: '', texto: '', duvidas: [], complexoIA: [] } })));
await page.reload();
await entra(page); await pronto(page);
await page.waitForFunction(() => /Potência estimada/.test(document.querySelector('[data-calc-estado]').textContent), null, { timeout: 15000 });
const estX = await page.textContent('[data-calc-estado]'), cxX = await page.textContent('[data-complexo]');
ok(/Sala 25\sm²: 12\s000\sBTU\/h/.test(estX) && /Total mais de 36\s000\sBTU\/h/.test(estX) && /ainda não tem preços/.test(estX) && !/€/.test(estX)
  && /Ainda não há preços/.test(cxX) && /maior aparelho/.test(cxX) && await page.isHidden('[data-prop-zona]'), 'X: tabela vazia: potência, motivos e nenhum preço', { estX, cxX });
vars.MDM_PRECOS = 'teste';
await page.context().close();

await browser.close(); api.close(); servidor.kill();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${falhas ? falhas + ' falhas' : 'tudo certo'}`);
process.exit(falhas ? 1 : 0);
