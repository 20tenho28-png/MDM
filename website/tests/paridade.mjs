/* Paridade: o cálculo do assistente de propostas (netlify/lib/calculo.mjs) tem de dar exatamente o mesmo resumo que o
   formulário do site (assets/js/site.js) para os mesmos dados. Usa a tabela de teste: põe data/precos-teste.json no lugar
   de data/precos.json, gera o site, compara caso a caso no browser e repõe o ficheiro original no fim (mesmo com erro).
   Precisa do Playwright (fora das dependências do site). Uso, a partir de website/:
     NODE_PATH=/caminho/para/node_modules node tests/paridade.mjs [número de casos aleatórios, 60 por omissão] */
import { createRequire } from 'node:module';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configPotencia, configPreco, potencia, preco } from '../netlify/lib/calculo.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL = path.join(W, 'data/precos.json'), TESTE = path.join(W, 'data/precos-teste.json');
const N = +process.argv[2] || 60, PORTA = 8799;
const AC = 'Ar condicionado: montagem / instalação', BC = 'Bomba de calor: instalação / manutenção';

const site = JSON.parse(fs.readFileSync(path.join(W, 'data/site.json'), 'utf8'));
const tabela = JSON.parse(fs.readFileSync(TESTE, 'utf8'));
const T = configPreco(tabela, configPotencia(site.btu));
const tipos = Object.keys(site.btu.tipos);

/* gerador pseudoaleatório com semente fixa: os mesmos casos em todas as corridas */
let s = 20261008;
const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const um = (xs) => xs[Math.floor(rnd() * xs.length)];
function casoAC() {
  const n = um([1, 1, 2, 2, 3, 4, 5]);
  const divisoes = Array.from({ length: n }, () => ({
    tipo: um(tipos), area: um([8, 10, 12, 12.5, 15, 18, 22, 25, 30, 38, 45, 60, 90]), sol: rnd() < 0.3, ultimoAndar: rnd() < 0.25 }));
  const respostas = {};
  T.perguntas.filter((q) => q.ac).forEach((q) => { if (rnd() < 0.7) respostas[q.k] = um(q.op)[0]; });
  return { servico: 'ac', divisoes, respostas };
}
const casos = [
  { servico: 'ac', divisoes: [{ tipo: 'Quarto', area: 12, sol: false, ultimoAndar: false }], respostas: {} },
  { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true, ultimoAndar: true }], respostas: { pre: 'sim', dist: 'mais', furo: 'nsei', fora: 'alta', luz: 'nsei', antigas: '2' } },
  { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 30, sol: false, ultimoAndar: false }, { tipo: 'Quarto', area: 12, sol: false, ultimoAndar: false },
    { tipo: 'Quarto', area: 14, sol: true, ultimoAndar: false }], respostas: { dist: '5', fora: 'escada' } },
  { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 90, sol: true, ultimoAndar: true }], respostas: {} },
  /* uma divisão acima de areaMax (200 m²) conta, a dimensionar na visita: o preço não sai só das outras */
  { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 250, sol: false, ultimoAndar: false }, { tipo: 'Quarto', area: 12, sol: false, ultimoAndar: false }], respostas: {} },
  { servico: 'aguasQuentes', respostas: { deposito: '200' } },
  { servico: 'aguasQuentes', respostas: { deposito: '300' } },
  { servico: 'aguasQuentes', respostas: { deposito: 'nsei' } },
];
while (casos.length < N + 8) casos.push(casoAC());

const original = fs.readFileSync(REAL);
let servidor = null, falhas = 0;
try {
  fs.copyFileSync(TESTE, REAL);
  execFileSync('python3', ['build.py'], { cwd: W, stdio: 'ignore' });
  servidor = spawn('python3', ['-m', 'http.server', String(PORTA), '-d', 'public', '--bind', '127.0.0.1'], { cwd: W, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('mdm-estatisticas', 'nao'); } catch (e) {} });
  await ctx.route('**/*posthog*/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { falhas++; console.log('erro JS: ' + e.message); });
  for (const [i, c] of casos.entries()) {
    await page.goto(`http://127.0.0.1:${PORTA}/servicos/ar-condicionado.html`, { waitUntil: 'load' });
    await page.selectOption('#qServico', c.servico === 'ac' ? AC : BC);
    if (c.servico === 'ac') {
      if (!(await page.$eval('#potencia', (d) => d.open))) await page.click('#potencia summary');
      for (const [j, d] of c.divisoes.entries()) {
        if ((await page.$$eval('[data-pot-divs] [data-pot-linha]', (x) => x.length)) <= j) await page.click('[data-pot-adiciona]');
        const l = page.locator('[data-pot-divs] [data-pot-linha]').nth(j);
        await l.locator('[data-pot="tipo"]').selectOption(d.tipo);
        await l.locator('[data-pot="area"]').fill(String(d.area).replace('.', ','));
        await l.locator('[data-pot="sol"]').setChecked(d.sol);
        await l.locator('[data-pot="topo"]').setChecked(d.ultimoAndar);
      }
    }
    for (const [k, v] of Object.entries(c.respostas)) {
      const r = page.locator(`input[name="preco-${k}"][value="${v}"]`);
      if (await r.count() && await r.isVisible()) await r.check({ force: true });
    }
    const noSite = await page.$eval('[data-estimativa-campo]', (x) => x.value);
    const visitaSite = await page.$eval('.preco-visita', (x) => !!x.getClientRects().length).catch(() => false);
    const r = preco(T, c);
    /* no site as perguntas extra só aparecem com o preço: num caso «visita» não se respondem; o cálculo ignora-as também */
    const aqui = r.modo === 'preco' ? r.resumo : '';
    const bate = noSite === aqui && (r.modo === 'visita') === visitaSite;
    if (!bate) { falhas++; console.log(`FALHA caso ${i}: ${JSON.stringify(c)}\n  site:   «${noSite}» visita=${visitaSite}\n  cálculo: «${aqui}» modo=${r.modo}`); }
  }
  await browser.close();
  console.log(`${casos.length} casos, ${falhas} falhas`);
} finally {
  if (servidor) servidor.kill();
  fs.writeFileSync(REAL, original);
  execFileSync('python3', ['build.py'], { cwd: W, stdio: 'ignore' });
}
process.exit(falhas ? 1 : 0);
