/* O visual novo (site/, publicado por publica.py): o formulário de 4 passos envia pelo Netlify Forms.
   - uma avaria vai para «orcamento» e uma instalação para «orcamento-comercial», com os campos dos formulários
     declarados em formularios.html, a referência no assunto e na mensagem, e o painel «Pedido recebido» com ela;
   - a página em inglês envia o mesmo, com o pedido em português para a equipa;
   - o mesmo pedido enviado outra vez leva a mesma referência; um envio que falhe mostra o aviso e deixa enviar de novo;
   - o isco para robôs segue vazio;
   - nenhuma página principal desliza para o lado a 390 e a 320 px, e não há erros de JavaScript (os 404 de /api/ são
     do servidor antigo e o site trata-os);
   - a página da equipa abre com as letras e o logótipo.
   Publica numa pasta temporária (MDM_OUT) e apaga-a no fim. Precisa do Playwright, fora das dependências. Uso, a
   partir de website/:  NODE_PATH=/caminho/para/node_modules node tests/site-novo.mjs */
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-site-novo-'));
const PUB = path.join(tmp, 'public');
let falhas = 0, oks = 0;
const ok = (c, m, x) => { if (c) oks++; else { falhas++; console.log('FALHA ' + m, x === undefined ? '' : JSON.stringify(x).slice(0, 700)); } };

execFileSync('python3', ['publica.py'], { cwd: W, stdio: 'ignore', env: { ...process.env, MDM_OUT: PUB } });
const envios = [], pedidos404 = [];
let falhar = false;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.xml': 'application/xml' };
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST') {
    const partes = []; req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      envios.push({ caminho: u.pathname, tipo: req.headers['content-type'] || '', campos: Object.fromEntries(new URLSearchParams(Buffer.concat(partes).toString('utf8'))) });
      res.writeHead(falhar ? 500 : 200, { 'content-type': 'text/html' }); res.end('<p>ok</p>');
    });
    return;
  }
  let f = path.join(PUB, decodeURIComponent(u.pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { pedidos404.push(u.pathname); res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${servidor.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

try {
  async function nova(url, largura = 1280) {
    const ctx = await browser.newContext({ viewport: { width: largura, height: 860 }, isMobile: largura < 640, hasTouch: largura < 640 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { falhas++; console.log('erro JS', url, e.message); });
    await page.goto(B + url);
    return page;
  }
  async function preenche(page, { purpose, service, local = 'Lisboa', nome = 'Carlos Melancia', tel = '912 345 678', email = '', detalhes = '' }) {
    await page.evaluate(() => document.querySelector('[data-quote]').click());
    await page.waitForSelector('#quote-dialog[open]');
    await page.check(`input[name="purpose"][value="${purpose}"]`, { force: true });
    await page.click('#quote-next');
    await page.selectOption('select[name="service"]', service);
    await page.fill('input[name="location"]', local);
    if (detalhes) await page.fill('textarea[name="details"]', detalhes);
    await page.click('#quote-next');
    await page.fill('input[name="name"]', nome);
    await page.fill('input[name="phone"]', tel);
    if (email) await page.fill('input[name="email"]', email);
    await page.click('#quote-next');
    await page.check('#request-consent', { force: true });
  }
  async function envia(page) {
    const antes = envios.length;
    await page.click('#send-direct');
    await page.waitForFunction(() => !document.getElementById('delivery-result').hidden || document.getElementById('request-status').textContent.trim() !== '', null, { timeout: 8000 });
    return envios.length > antes ? envios.at(-1) : null;
  }
  const CAMPOS = ['form-name', 'subject', 'pagina', 'triagem', 'potencia', 'estimativa', 'nome', 'email', 'telefone', 'servico', 'mensagem', 'bot-field'];
  const decl = fs.readFileSync(path.join(PUB, 'formularios.html'), 'utf8');

  // 1. avaria → «orcamento»
  let page = await nova('/index.html');
  await preenche(page, { purpose: 'Avaria', service: 'Ar condicionado', detalhes: 'O ar condicionado da sala não arranca.' });
  let e = await envia(page);
  const ref = await page.textContent('#request-reference');
  ok(e && e.caminho === '/' && /x-www-form-urlencoded/.test(e.tipo) && e.campos['form-name'] === 'orcamento', '1: uma avaria vai para «orcamento»', e);
  ok(e && CAMPOS.every((c) => c in e.campos) && Object.keys(e.campos).every((c) => CAMPOS.includes(c)), '1: os campos são os dos formulários Netlify', e && Object.keys(e.campos));
  ok(e && CAMPOS.every((c) => decl.includes(`name="${c}"`) || c === 'form-name'), '1: formularios.html declara todos os campos');
  ok(e && e.campos.triagem === '[P4 · Avaria AC]' && e.campos.subject.startsWith('[P4 · Avaria AC] Pedido ' + ref) && e.campos.nome === 'Carlos Melancia'
    && e.campos.telefone === '912 345 678' && e.campos.servico === 'Avaria: Ar condicionado' && e.campos['bot-field'] === '' && e.campos.pagina === '/index.html',
    '1: assunto com a triagem e a referência, contactos, serviço, isco vazio', e && e.campos);
  ok(e && /^\d{6}-\d{4}-[0-9A-F]{4}$/.test(ref) && e.campos.mensagem.includes('Referência: ' + ref) && e.campos.mensagem.includes('Localidade: Lisboa')
    && e.campos.mensagem.includes('O ar condicionado da sala não arranca.'), '1: a mensagem leva a referência, a localidade e os detalhes', e && e.campos.mensagem);
  ok(!(await page.$eval('#delivery-result', (x) => x.hidden)) && /Pedido recebido/.test(await page.textContent('#send-direct'))
    && /A MDM irá contactá-lo/.test(await page.textContent('#booking-note')), '1: o painel «Pedido recebido» com a referência');
  await page.context().close();

  // 2. instalação → «orcamento-comercial»; o mesmo pedido outra vez leva a mesma referência; uma falha deixa tentar de novo
  page = await nova('/servicos/ar-condicionado.html', 390);
  await preenche(page, { purpose: 'Instalação', service: 'Ar condicionado', email: 'carlos@exemplo.pt' });
  falhar = true;
  e = await envia(page);
  const erro = await page.textContent('#request-status');
  ok(e && /Não foi possível concluir/.test(erro) && !(await page.$eval('#send-direct', (b) => b.disabled)), '2: um envio que falha mostra o aviso e deixa tentar de novo', erro);
  falhar = false;
  const e2 = await envia(page);
  ok(e2 && e2.campos['form-name'] === 'orcamento-comercial' && e2.campos.triagem === '[P1 · Montagem AC]' && e2.campos.email === 'carlos@exemplo.pt',
    '2: uma instalação de ar condicionado vai para «orcamento-comercial»', e2 && e2.campos);
  ok(e && e2 && e.campos.subject === e2.campos.subject, '2: o mesmo pedido outra vez leva a mesma referência', [e && e.campos.subject, e2 && e2.campos.subject]);
  await page.context().close();

  // 3. as outras escolhas
  for (const [purpose, service, form, tag] of [['Manutenção', 'Manutenção e assistência', 'orcamento-comercial', '[P2 · Manutenção preventiva]'],
    ['Aconselhamento', 'Ainda não sei', 'orcamento-comercial', '[P5 · Avaliação técnica]'], ['Instalação', 'Bombas de calor', 'orcamento-comercial', '[P1 · Bomba de calor]'],
    ['Avaria', 'Eletricidade', 'orcamento', '[P4 · Avaria elétrica]']]) {
    page = await nova('/index.html');
    await preenche(page, { purpose, service });
    e = await envia(page);
    ok(e && e.campos['form-name'] === form && e.campos.triagem === tag, `3: ${purpose}, ${service} → ${form} ${tag}`, e && [e.campos['form-name'], e.campos.triagem]);
    await page.context().close();
  }

  // 4. em inglês: o mesmo envio, o pedido em português para a equipa
  page = await nova('/en/index.html');
  await preenche(page, { purpose: 'Avaria', service: 'Bombas de calor', nome: 'John Smith', tel: '+44 7911 123456' });
  e = await envia(page);
  ok(e && e.campos['form-name'] === 'orcamento' && e.campos.servico === 'Avaria: Bombas de calor' && e.campos.mensagem.includes('Língua do site: inglês')
    && /MDM has received your request|Pedido recebido|Request received/i.test(await page.textContent('#delivery-result')), '4: em inglês envia o mesmo, em português para a equipa', e && e.campos);
  await page.context().close();

  // 5. sem deslize lateral a 390 e 320 px
  for (const url of ['/index.html', '/obras.html', '/calculadora.html', '/servicos/ar-condicionado.html', '/privacidade.html', '/en/index.html']) {
    for (const largura of [390, 320]) {
      page = await nova(url, largura);
      await page.waitForTimeout(200);
      const d = await page.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
      ok(d <= 0, `5: ${url} a ${largura} px não desliza para o lado`, d);
      await page.context().close();
    }
  }

  // 6. a página da equipa: letras e logótipo
  pedidos404.length = 0;
  page = await nova('/equipa/proposta.html');
  await page.waitForTimeout(500);
  const letras = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === 'loaded').length; });
  ok(!pedidos404.some((p) => !p.startsWith('/api/')) && letras > 0, '6: a página da equipa abre com as letras e o logótipo', { pedidos404, letras });
  await page.context().close();
} finally {
  await browser.close();
  servidor.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${oks} ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
