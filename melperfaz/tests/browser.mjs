/* O site no browser (Playwright): gera numa pasta temporária (MELPERFAZ_OUT) e serve-a num servidor local que guarda cada
   envio do formulário como o Netlify Forms o receberia e pode falhar de propósito. Casos:
   A. o pedido segue com os campos certos e aparece «Pedido enviado!», com o foco lá;
   B. a validação em português: sem nome e telefone não segue; telefone curto; email estranho; corrigido, segue;
   C. o servidor falha: aviso com o telefone, o que se escreveu fica, e a segunda tentativa segue;
   D. sem JavaScript: o envio normal chega a /obrigado.html com os campos;
   E. o tipo de obra pré-escolhido: pelo cartão de serviço e pelo ?tipo= da ficha de obra;
   F. o isco para robôs: preenchido, não segue;
   G. nenhuma página desliza para o lado a 390 e 320 px, e sem erros de JavaScript;
   H. o menu dos ecrãs estreitos: abre, foca, fecha com Escape e devolve o foco;
   I. o comparador antes/depois com o rato e com o teclado;
   J. teclado: a primeira tabulação é «Saltar para o conteúdo»; a entrada ao fazer scroll acaba toda visível;
      todas as imagens carregam; o menu marca a página atual.
   Precisa do Playwright, fora das dependências (localmente, NODE_PATH para onde ele está). Uso, a partir de melperfaz/:
     NODE_PATH=/caminho/para/node_modules node tests/browser.mjs */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './_servidor.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'melperfaz-browser-'));
const PUB = path.join(tmp, 'public');
try {
  execFileSync('python3', ['build.py'], { cwd: W, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, MELPERFAZ_OUT: PUB } });
} catch (e) {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('FALHA: o build.py não gerou o site');
  process.exit(1);
}
const SITE = JSON.parse(fs.readFileSync(path.join(W, 'data/site.json'), 'utf8'));
const OBRAS = JSON.parse(fs.readFileSync(path.join(W, 'data/obras.json'), 'utf8')).obras;

let falhas = 0, oks = 0;
const ok = (c, msg, extra) => { if (c) oks++; else { falhas++; console.log('FALHA ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 500) : '')); } };
const srv = await serve(PUB);
const browser = await chromium.launch();

async function pagina(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.erros = [];
  page.on('pageerror', e => page.erros.push(e.message));
  page.on('console', m => { if (m.type() === 'error') page.erros.push(m.text()); });
  return { ctx, page };
}
const preenche = async (page, d = {}) => {
  await page.fill('#qNome', d.nome ?? 'Ana Teste');
  await page.fill('#qTel', d.telefone ?? '912 345 678');
  await page.fill('#qEmail', d.email ?? 'ana@teste.pt');
  if (d.tipo !== null) await page.selectOption('#qTipo', d.tipo ?? 'Apartamento');
  await page.fill('#qMsg', d.mensagem ?? 'Remodelação de um T2 em Lisboa, com casa de banho nova.');
};

try {
  /* A. o pedido segue */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await preenche(page);
    await page.click('#sendBtn');
    await page.waitForSelector('[data-form-ok]:not([hidden])');
    const p = srv.pedidos.at(-1);
    ok(p && p.caminho === '/' && p.tipo.includes('application/x-www-form-urlencoded'), 'A: POST para / em urlencoded', p);
    ok(p && p.campos['form-name'] === 'orcamento' && p.campos.nome === 'Ana Teste' && p.campos.telefone === '912 345 678'
      && p.campos.email === 'ana@teste.pt' && p.campos.tipo_de_obra === 'Apartamento' && p.campos.mensagem.startsWith('Remodelação')
      && p.campos.pagina === 'index.html' && p.campos['bot-field'] === '' && p.campos.subject, 'A: os campos do pedido', p && p.campos);
    ok(await page.isHidden('#quoteForm'), 'A: o formulário esconde-se');
    ok(await page.evaluate(() => document.activeElement === document.querySelector('[data-form-ok]')), 'A: o foco vai para «Pedido enviado!»');
    ok((await page.textContent('[data-form-ok]')).includes('961 245 288'), 'A: o painel tem o telefone');
    await page.click('[data-form-novo]');
    ok(await page.isVisible('#quoteForm') && (await page.inputValue('#qNome')) === '', 'A: «Enviar outro pedido» limpa e mostra o formulário');
    ok(await page.evaluate(() => document.activeElement.id === 'qNome'), 'A: o foco volta ao nome');
    ok(page.erros.length === 0, 'A: sem erros de JavaScript', page.erros);
    await ctx.close();
  }

  /* B. validação */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    const antes = srv.pedidos.length;
    await page.click('#sendBtn');
    await page.waitForTimeout(200);
    ok(srv.pedidos.length === antes, 'B: vazio não segue');
    ok((await page.textContent('#eNome')).includes('nome') && (await page.textContent('#eTel')).includes('telefone'), 'B: erros em português no nome e no telefone');
    ok(await page.evaluate(() => document.activeElement.id === 'qNome'), 'B: o foco vai ao primeiro campo com erro');
    ok(await page.getAttribute('#qNome', 'aria-invalid') === 'true', 'B: aria-invalid no nome');
    await preenche(page, { telefone: '1234', email: 'ana@' });
    await page.click('#sendBtn');
    await page.waitForTimeout(200);
    ok(srv.pedidos.length === antes, 'B: telefone curto e email estranho não seguem');
    ok((await page.textContent('#eTel')).includes('9 algarismos') && (await page.textContent('#eEmail')).includes('email'), 'B: as mensagens do telefone e do email');
    ok(await page.getAttribute('#qNome', 'aria-invalid') === null, 'B: o nome corrigido já não tem erro');
    await page.fill('#qTel', '+351 912 345 678');
    await page.fill('#qEmail', '');
    await page.click('#sendBtn');
    await page.waitForSelector('[data-form-ok]:not([hidden])');
    ok(srv.pedidos.length === antes + 1 && srv.pedidos.at(-1).campos.telefone === '+351 912 345 678' && srv.pedidos.at(-1).campos.email === '', 'B: corrigido, segue (telefone com +351, sem email)');
    await ctx.close();
  }

  /* C. o servidor falha */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await preenche(page, { nome: 'Rui Falha' });
    srv.falhar(true);
    await page.click('#sendBtn');
    await page.waitForSelector('#formAlerta:not([hidden])');
    ok((await page.textContent('#formAlerta')).includes('961 245 288'), 'C: o aviso tem o telefone');
    ok(await page.isVisible('#quoteForm') && (await page.inputValue('#qNome')) === 'Rui Falha' && (await page.inputValue('#qMsg')).startsWith('Remodelação'), 'C: o que se escreveu fica');
    ok(await page.isEnabled('#sendBtn') && (await page.textContent('#sendBtn')).trim() === 'Enviar Pedido', 'C: o botão volta a «Enviar Pedido»');
    srv.falhar(false);
    await page.click('#sendBtn');
    await page.waitForSelector('[data-form-ok]:not([hidden])');
    ok(srv.pedidos.at(-1).campos.nome === 'Rui Falha', 'C: a segunda tentativa segue');
    ok(await page.isHidden('#formAlerta'), 'C: o aviso desaparece');
    await ctx.close();
  }

  /* D. sem JavaScript */
  {
    const { ctx, page } = await pagina({ javaScriptEnabled: false });
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    ok(await page.isVisible('#quoteForm'), 'D: o formulário aparece sem JavaScript');
    ok(await page.evaluate(() => Array.from(document.querySelectorAll('.reveal')).every(e => getComputedStyle(e).opacity === '1')), 'D: sem JavaScript nada fica invisível (reveal)');
    ok(await page.isHidden('#menu-movel') && await page.evaluate(() => { const s = document.querySelector('[data-ba-before]'); return s && getComputedStyle(s).width !== '0px'; }), 'D: o comparador fica a meio, sem rebentar');
    await preenche(page, { nome: 'Sem JS', tipo: 'Fachadas / Impermeabilização' });
    await Promise.all([page.waitForNavigation(), page.click('#sendBtn')]);
    const p = srv.pedidos.at(-1);
    ok(p && p.caminho === '/obrigado.html' && p.campos['form-name'] === 'orcamento' && p.campos.nome === 'Sem JS' && p.campos.tipo_de_obra === 'Fachadas / Impermeabilização', 'D: o POST normal chega a /obrigado.html com os campos', p);
    ok((await page.textContent('h1')).includes('Obrigado'), 'D: a página de agradecimento');
    await ctx.close();
  }

  /* E. tipo de obra pré-escolhido */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await page.click('a.svc[data-preselect="Apartamento"]');
    await page.waitForTimeout(300);
    ok(await page.inputValue('#qTipo') === 'Apartamento', 'E: o cartão de serviço escolhe o tipo');
    ok(await page.evaluate(() => location.hash === '#contacto'), 'E: e leva ao formulário');
    const obra = OBRAS[0];
    await page.goto(`${srv.base}/obras/${obra.slug}.html`, { waitUntil: 'networkidle' });
    await Promise.all([page.waitForNavigation(), page.click('.cta-faixa-acoes a.btn:has-text("Pedir Orçamento")')]);
    ok(/\?tipo=.*#contacto$/.test(page.url()), 'E: a ficha leva a index.html?tipo=…#contacto', page.url());
    await page.waitForTimeout(300);
    ok(await page.inputValue('#qTipo') === 'Reabilitação de Edifício', 'E: o tipo vem do endereço');
    await page.goto(srv.base + '/?tipo=Inventado#contacto', { waitUntil: 'networkidle' });
    ok(await page.inputValue('#qTipo') === '', 'E: um tipo que não existe fica em «Escolha uma opção»');
    ok(page.erros.length === 0, 'E: sem erros', page.erros);
    await ctx.close();
  }

  /* F. isco para robôs */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await preenche(page);
    await page.evaluate(() => { document.querySelector('[name="bot-field"]').value = 'spam'; });
    const antes = srv.pedidos.length;
    await page.click('#sendBtn');
    await page.waitForTimeout(400);
    ok(srv.pedidos.length === antes && await page.isVisible('#formAlerta'), 'F: com o isco preenchido não segue e avisa');
    ok(await page.evaluate(() => { const i = document.querySelector('#qGotcha'); const r = i.getBoundingClientRect(); return i.tabIndex === -1 && (r.right < 0 || r.width <= 1); }), 'F: o isco está fora do ecrã e do Tab');
    await ctx.close();
  }

  /* G. telemóvel: sem deslizar para o lado, sem erros */
  for (const largura of [390, 320]) {
    const { ctx, page } = await pagina({ viewport: { width: largura, height: 800 }, isMobile: true, hasTouch: true });
    const comComparador = OBRAS.find(o => o.antesDepois) || OBRAS[OBRAS.length - 1];
    for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`, `/obras/${comComparador.slug}.html`, '/privacidade.html', '/obrigado.html', '/404.html']) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(250);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(sw <= largura, `G: ${f} a ${largura} px não desliza para o lado`, sw);
      ok(await page.isVisible('.wa-float'), `G: ${f} a ${largura} px tem o botão WhatsApp`);
    }
    ok(page.erros.length === 0, `G: sem erros a ${largura} px`, page.erros);
    await ctx.close();
  }

  /* H. o menu dos ecrãs estreitos */
  {
    const { ctx, page } = await pagina({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
    ok(await page.isVisible('[data-menu]') && await page.isHidden('.navlinks'), 'H: o botão ≡ aparece e o menu normal não');
    await page.click('[data-menu]');
    ok(await page.isVisible('#menu-movel') && await page.getAttribute('[data-menu]', 'aria-expanded') === 'true', 'H: abre');
    ok(await page.evaluate(() => document.activeElement.closest('#menu-movel') !== null), 'H: o foco entra no menu');
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#menu-movel') && await page.evaluate(() => document.activeElement.hasAttribute('data-menu')), 'H: Escape fecha e devolve o foco ao botão');
    await page.click('[data-menu]');
    await page.click('#menu-movel a[href$="#servicos"]');
    await page.waitForTimeout(300);
    ok(await page.isHidden('#menu-movel') && /index\.html#servicos$/.test(page.url()), 'H: uma ligação do menu fecha-o e navega', page.url());
    await ctx.close();
  }

  /* I. o comparador */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await page.locator('[data-ba]').scrollIntoViewIfNeeded();
    await page.locator('[data-ba-range]').fill('20');
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => document.querySelector('[data-ba-before]').style.width === '20%' && document.querySelector('[data-ba-handle]').style.left === '20%'), 'I: o range move o antes e a linha');
    await page.locator('[data-ba-range]').focus();
    await page.keyboard.press('ArrowRight');
    ok(await page.inputValue('[data-ba-range]') === '21' && await page.evaluate(() => document.querySelector('[data-ba-before]').style.width === '21%'), 'I: as setas do teclado também');
    const l = await page.evaluate(() => { const s = document.querySelector('[data-ba]'); const f = document.querySelector('[data-ba-before] .foto'); return { w: s.clientWidth, fw: f.getBoundingClientRect().width }; });
    ok(Math.abs(l.w - l.fw) < 2, 'I: o antes tem a largura do comparador', l);
    await ctx.close();
  }

  /* J. teclado, entrada ao fazer scroll, imagens, menu atual */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    ok(await page.evaluate(() => document.activeElement.className === 'skip'), 'J: a primeira tabulação é «Saltar para o conteúdo»');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => document.activeElement.id === 'conteudo' || location.hash === '#conteudo'), 'J: saltar para o conteúdo');
    for (let y = 0; y < 12000; y += 600) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(60); }
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({ total: document.querySelectorAll('.reveal').length, dentro: document.querySelectorAll('.reveal.in').length }));
    ok(r.total > 10 && r.dentro === r.total, 'J: tudo o que entra ao fazer scroll acabou visível', r);
    const imgs = await page.evaluate(() => Array.from(document.images).map(i => ({ src: i.currentSrc.split('/').pop(), ok: i.complete && i.naturalWidth > 0 })));
    ok(imgs.length >= 8 && imgs.every(i => i.ok), 'J: todas as imagens carregam', imgs.filter(i => !i.ok).concat([imgs.length]));
    ok(page.erros.length === 0, 'J: sem erros', page.erros);
    await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
    ok(await page.getAttribute('.navlinks a[data-nav-item="obras"]', 'aria-current') === 'page', 'J: o menu marca «Obras»');
    await ctx.close();
  }

  /* K. movimento reduzido: nada fica invisível à espera do scroll */
  {
    const { ctx, page } = await pagina({ reducedMotion: 'reduce' });
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => Array.from(document.querySelectorAll('.reveal')).every(e => getComputedStyle(e).opacity === '1')), 'K: com movimento reduzido tudo aparece logo');
    await ctx.close();
  }
} finally {
  await browser.close();
  await srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${oks} verificações, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
