/* O site no browser (Playwright): gera numa pasta temporária (MELPERFAZ_OUT) e serve-a num servidor local que guarda cada
   envio do formulário como o Netlify Forms o receberia e pode falhar de propósito. Casos:
   A. o pedido (orcamento.html, o único formulário) segue com os campos certos e abre obrigado.html (um só sucesso);
   B. a validação em português: sem nome e telefone não segue; telefone curto; email estranho; corrigido, segue;
   C. o servidor falha: o alerta recebe o foco, com o telefone e o WhatsApp (nome e tipo escritos), o que se escreveu
      fica, e a segunda tentativa segue;
   D. sem JavaScript: o envio normal chega a /obrigado.html com os campos;
   E. o tipo de obra pré-escolhido: pela lista de serviços e pelo ?tipo= (e ?de=) da ficha de obra, em orcamento.html, com
      «Pedido para: X · alterar» e o ?de= no campo «pagina»; os endereços antigos da página inicial (#contacto, ?tipo=)
      vão para orcamento.html;
   F. o isco para robôs: preenchido, não segue;
   G. nenhuma página desliza para o lado a 390 e 320 px, sem erros de JavaScript; a barra de ações (menos em obrigado.html)
      não tapa o rodapé nem o botão de envio;
   H. o menu dos ecrãs estreitos: abre sobre um fundo escurecido, a página não desliza, foca, fecha com Escape e devolve o foco;
   I. o comparador antes/depois: com o teclado, e com o rato só a partir da pega (um clique noutro sítio não o mexe);
   J. teclado: a primeira tabulação é «Saltar para o conteúdo»; a entrada ao fazer scroll acaba toda visível;
      todas as imagens carregam; o menu marca a página atual; obras.html mostra todas as obras, sem filtros, agrupadas
      por serviço (o índice leva a cada grupo; H1 › H2 › H3);
   K. movimento reduzido; nenhuma animação sem fim;
   L. o sistema visual: uma margem esquerda (h1 do hero, logótipo e cabeçalhos de secção no mesmo x), contraste de 4,5:1
      nos botões, na barra e no texto da faixa clay, o anel de foco da cor da superfície, campos com 16 px e etiquetas com 13 px;
   M. as fotografias sem ampliação: a 375 px a do hero tem pelo menos tantos píxeis como a moldura, e nenhuma fotografia é
      mostrada maior do que o ficheiro escolhido, salvo quando o próprio original é mais pequeno do que a moldura.
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
  if (d.localidade !== null) await page.fill('#qLocal', d.localidade ?? 'Lisboa');
  if (d.tipo !== null) await page.selectOption('#qTipo', d.tipo ?? 'Apartamentos');
  await page.fill('#qMsg', d.mensagem ?? 'Remodelação de um T2 em Lisboa, com casa de banho nova.');
};

try {
  /* A. o pedido segue */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    await preenche(page);
    await Promise.all([page.waitForURL(/\/obrigado\.html$/, { waitUntil: 'domcontentloaded' }), page.click('#sendBtn')]);
    const p = srv.pedidos.at(-1);
    ok(p && p.caminho === '/' && p.tipo.includes('application/x-www-form-urlencoded'), 'A: POST para / em urlencoded', p);
    ok(p && p.campos['form-name'] === 'orcamento' && p.campos.nome === 'Ana Teste' && p.campos.telefone === '912 345 678'
      && p.campos.email === 'ana@teste.pt' && p.campos.tipo_de_obra === 'Apartamentos' && p.campos.localidade === 'Lisboa' && p.campos.mensagem.startsWith('Remodelação')
      && p.campos.pagina === 'orcamento.html' && p.campos['bot-field'] === '' && p.campos.subject, 'A: os campos do pedido', p && p.campos);
    ok(p && p.caminho === '/', 'A: o pedido foi pelo fetch (POST para /), não pelo envio normal', p && p.caminho);
    ok((await page.textContent('h1')).includes('Obrigado') && await page.isVisible('a.btn:has-text("Enviar fotografias por WhatsApp")'), 'A: abre obrigado.html, com «Enviar fotografias por WhatsApp»');
    ok(await page.locator('text=Pedir Orçamento').count() === 0, 'A: obrigado.html não volta a pedir orçamento');
    // de volta pelo botão «Voltar»: o formulário pode enviar de novo
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    ok(/\/orcamento\.html$/.test(page.url()) && await page.isEnabled('#sendBtn') && (await page.textContent('#sendBtn')).trim() === 'Enviar pedido de orçamento', 'A: ao voltar, o botão volta a «Enviar pedido de orçamento»', page.url());
    ok(page.erros.length === 0, 'A: sem erros de JavaScript', page.erros);
    await ctx.close();
  }

  /* B. validação */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
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
    await Promise.all([page.waitForURL(/\/obrigado\.html$/, { waitUntil: 'domcontentloaded' }), page.click('#sendBtn')]);
    ok(srv.pedidos.length === antes + 1 && srv.pedidos.at(-1).campos.telefone === '+351 912 345 678' && srv.pedidos.at(-1).campos.email === '', 'B: corrigido, segue (telefone com +351, sem email)');
    await ctx.close();
  }

  /* C. o servidor falha */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    await preenche(page, { nome: 'Rui Falha' });
    srv.falhar(true);
    await page.click('#sendBtn');
    await page.waitForSelector('#formAlerta:not([hidden])');
    const alerta = await page.textContent('#formAlerta');
    ok(alerta.startsWith('O pedido não seguiu. Tente outra vez, ligue 961 245 288 ou envie por WhatsApp.'), 'C: a mensagem nova do aviso', alerta);
    ok(await page.evaluate(() => document.activeElement.id === 'formAlerta'), 'C: o foco vai para o aviso');
    ok(await page.getAttribute('#formAlerta a[href^="tel:"]', 'href') === 'tel:+351961245288', 'C: o aviso liga para o telefone');
    const waErro = await page.getAttribute('#formAlerta a[href^="https://wa.me/"]', 'href');
    ok(waErro && decodeURIComponent(waErro.split('?text=')[1]) === SITE.wa.erro.replace('{nome}', 'Rui Falha').replace('{tipo}', 'Apartamentos'), 'C: o WhatsApp do aviso leva o nome e o tipo escritos', waErro);
    ok(await page.getAttribute('#formAlerta a[href^="https://wa.me/"]', 'target') === '_blank', 'C: o WhatsApp abre noutra janela');
    ok(await page.isVisible('#quoteForm') && (await page.inputValue('#qNome')) === 'Rui Falha' && (await page.inputValue('#qMsg')).startsWith('Remodelação'), 'C: o que se escreveu fica');
    ok(await page.isEnabled('#sendBtn') && (await page.textContent('#sendBtn')).trim() === 'Enviar pedido de orçamento', 'C: o botão volta a «Enviar pedido de orçamento»');
    // sem tipo escolhido (ou «Outro»), a mensagem diz «uma obra»
    srv.falhar(true);
    await page.selectOption('#qTipo', 'Outro');
    await page.click('#sendBtn');
    await page.waitForFunction(() => { const a = document.querySelector('#formAlerta a[href^="https://wa.me/"]'); return a && decodeURIComponent(a.href).includes('para uma obra.'); });
    ok(true, 'C: com «Outro», o WhatsApp do aviso diz «uma obra»');
    srv.falhar(false);
    await Promise.all([page.waitForURL(/\/obrigado\.html$/, { waitUntil: 'domcontentloaded' }), page.click('#sendBtn')]);
    ok(srv.pedidos.at(-1).campos.nome === 'Rui Falha', 'C: a segunda tentativa segue e abre obrigado.html');
    await ctx.close();
  }

  /* D. sem JavaScript */
  {
    const { ctx, page } = await pagina({ javaScriptEnabled: false });
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    ok(await page.evaluate(() => Array.from(document.querySelectorAll('.reveal')).every(e => getComputedStyle(e).opacity === '1')), 'D: sem JavaScript nada fica invisível (reveal)');
    ok(await page.getAttribute('.navlinks a[data-nav-item="inicio"]', 'aria-current') === 'page', 'D: a página atual vem marcada sem JavaScript');
    await page.goto(srv.base + '/#contacto', { waitUntil: 'networkidle' });
    ok(/\/(#contacto)?$/.test(page.url()) && await page.isVisible('#contacto .btn'), 'D: sem JavaScript o endereço antigo #contacto fica na faixa, com o botão do pedido', page.url());
    await page.goto(`${srv.base}/obras/${(OBRAS.find(o => o.antesDepois) || OBRAS[0]).slug}.html`, { waitUntil: 'networkidle' });
    ok(await page.isHidden('#menu-movel') && await page.evaluate(() => { const s = document.querySelector('[data-ba-before]'); return s && getComputedStyle(s).width !== '0px'; }), 'D: o comparador fica a meio, sem rebentar');
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    ok(await page.isVisible('#quoteForm'), 'D: o formulário aparece sem JavaScript');
    await preenche(page, { nome: 'Sem JS', tipo: 'Fachadas e Impermeabilização' });
    /* espera-se pelo endereço e pelo DOM, não pelo «load»: num runner lento o load da página seguinte passava os 30 s */
    await Promise.all([page.waitForURL(/\/obrigado\.html$/, { waitUntil: 'domcontentloaded' }), page.click('#sendBtn')]);
    const p = srv.pedidos.at(-1);
    ok(p && p.caminho === '/obrigado.html' && p.campos['form-name'] === 'orcamento' && p.campos.nome === 'Sem JS' && p.campos.tipo_de_obra === 'Fachadas e Impermeabilização', 'D: o POST normal chega a /obrigado.html com os campos', p);
    ok((await page.textContent('h1')).includes('Obrigado'), 'D: a página de agradecimento');
    await ctx.close();
  }

  /* E. tipo de obra pré-escolhido */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await Promise.all([page.waitForURL(/orcamento\.html\?tipo=apartamentos$/, { waitUntil: 'domcontentloaded' }), page.click('.svc a[data-tipo="apartamentos"]')]);
    await page.waitForTimeout(300);
    ok(await page.inputValue('#qTipo') === 'Apartamentos', 'E: «Pedir orçamento» do serviço leva a orcamento.html com o tipo escolhido');
    // os endereços antigos da página inicial: #contacto e ?tipo= vão para orcamento.html (sem ficar no histórico)
    await page.goto(srv.base + '/index.html#contacto', { waitUntil: 'networkidle' });
    ok(/\/orcamento\.html$/.test(page.url()) && await page.isVisible('#quoteForm'), 'E: /index.html#contacto vai para orcamento.html', page.url());
    await page.goto(srv.base + '/?tipo=fachadas#contacto', { waitUntil: 'networkidle' });
    ok(/\/orcamento\.html\?tipo=fachadas$/.test(page.url()) && await page.inputValue('#qTipo') === 'Fachadas e Impermeabilização', 'E: /?tipo=fachadas#contacto vai para orcamento.html?tipo=fachadas', page.url());
    await page.goto(srv.base + '/#obras', { waitUntil: 'networkidle' });
    ok(/\/#obras$/.test(page.url()), 'E: as outras âncoras da página inicial ficam', page.url());
    const obra = OBRAS[0];
    await page.goto(`${srv.base}/obras/${obra.slug}.html`, { waitUntil: 'networkidle' });
    await Promise.all([page.waitForURL(/orcamento\.html\?tipo=/, { waitUntil: 'domcontentloaded' }), page.click('.cta .acoes a.btn:has-text("Pedir Orçamento")')]);
    ok(page.url().endsWith(`/orcamento.html?tipo=reabilitacao&de=obras/${obra.slug}`), 'E: a ficha leva a orcamento.html?tipo=…&de=…', page.url());
    await page.waitForTimeout(300);
    ok(await page.inputValue('#qTipo') === 'Reabilitação de Edifícios', 'E: o tipo vem do endereço (?tipo=reabilitacao)');
    ok(await page.inputValue('#quoteForm [name="pagina"]') === `obras/${obra.slug}`, 'E: o ?de= vai para o campo «pagina»');
    await preenche(page, { tipo: null });
    await Promise.all([page.waitForURL(/\/obrigado\.html$/, { waitUntil: 'domcontentloaded' }), page.click('#sendBtn')]);
    ok(srv.pedidos.at(-1).campos.pagina === `obras/${obra.slug}` && srv.pedidos.at(-1).campos.tipo_de_obra === 'Reabilitação de Edifícios', 'E: o pedido regista a obra de origem e o tipo', srv.pedidos.at(-1).campos);
    await page.goto(srv.base + '/orcamento.html?tipo=fachadas', { waitUntil: 'networkidle' });
    ok(await page.inputValue('#qTipo') === 'Fachadas e Impermeabilização', 'E: ?tipo=fachadas escolhe «Fachadas e Impermeabilização»');
    ok(await page.isVisible('[data-pedido-para]') && (await page.textContent('[data-pedido-para]')).replace(/\s+/g, ' ').trim() === 'Pedido para: Fachadas e Impermeabilização · alterar', 'E: «Pedido para: Fachadas e Impermeabilização · alterar»', await page.textContent('[data-pedido-para]'));
    ok(await page.inputValue('#quoteForm [name="pagina"]') === 'orcamento.html', 'E: sem ?de=, o campo «pagina» fica orcamento.html');
    await page.click('[data-pedido-alterar]');
    ok(await page.evaluate(() => document.activeElement.id === 'qTipo'), 'E: «alterar» dá o foco à lista do tipo de obra');
    await page.selectOption('#qTipo', 'Acabamentos');
    ok((await page.textContent('[data-pedido-nome]')) === 'Acabamentos', 'E: a linha acompanha a lista');
    await page.selectOption('#qTipo', '');
    ok(await page.isHidden('[data-pedido-para]'), 'E: sem tipo, a linha esconde-se');
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    ok(await page.isHidden('[data-pedido-para]'), 'E: sem ?tipo=, sem «Pedido para:»');
    // o ?de= só aceita um caminho do próprio site
    for (const de of ['https://exemplo.com/x', '//exemplo.com', '<b>x</b>', 'obras/../../x"']) {
      await page.goto(srv.base + '/orcamento.html?de=' + encodeURIComponent(de), { waitUntil: 'networkidle' });
      ok(await page.inputValue('#quoteForm [name="pagina"]') === 'orcamento.html', `E: ?de=${de} é ignorado`);
    }
    await page.goto(srv.base + '/orcamento.html?tipo=Inventado', { waitUntil: 'networkidle' });
    ok(await page.inputValue('#qTipo') === '' && await page.isHidden('[data-pedido-para]'), 'E: um tipo que não existe fica em «Escolha uma opção», sem «Pedido para:»');
    ok(page.erros.length === 0, 'E: sem erros', page.erros);
    await ctx.close();
  }

  /* F. isco para robôs */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    await preenche(page);
    await page.evaluate(() => { document.querySelector('[name="bot-field"]').value = 'spam'; });
    const antes = srv.pedidos.length;
    await page.click('#sendBtn');
    await page.waitForTimeout(400);
    ok(srv.pedidos.length === antes && await page.isVisible('#formAlerta') && /\/orcamento\.html$/.test(page.url()), 'F: com o isco preenchido não segue e avisa');
    ok(await page.evaluate(() => { const i = document.querySelector('#qGotcha'); const r = i.getBoundingClientRect(); return i.tabIndex === -1 && (r.right < 0 || r.width <= 1); }), 'F: o isco está fora do ecrã e do Tab');
    await ctx.close();
  }

  /* G. telemóvel: sem deslizar para o lado, sem erros */
  for (const largura of [390, 320]) {
    const { ctx, page } = await pagina({ viewport: { width: largura, height: 800 }, isMobile: true, hasTouch: true });
    const comComparador = OBRAS.find(o => o.antesDepois) || OBRAS[OBRAS.length - 1];
    for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`, `/obras/${comComparador.slug}.html`, '/orcamento.html', '/privacidade.html', '/obrigado.html', '/404.html']) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(250);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      ok(sw <= largura, `G: ${f} a ${largura} px não desliza para o lado`, sw);
      ok(await page.isVisible('.rodape a[href^="https://wa.me/"]'), `G: ${f} a ${largura} px tem o WhatsApp no rodapé`);
      // a barra de ações: fixa em baixo, e no fim da página não tapa a última ligação do rodapé
      const b = await page.evaluate(() => {
        const barra = document.querySelector('.barra');
        if (!barra) return null;
        const r = barra.getBoundingClientRect(), ultimo = Array.from(document.querySelectorAll('.rodape a')).pop().getBoundingClientRect();
        return { topo: Math.round(r.top), fundo: Math.round(r.bottom), alt: innerHeight, cels: Array.from(barra.children).map(c => Math.round(c.getBoundingClientRect().height)), ultimo: Math.round(ultimo.bottom) };
      });
      if (f === '/obrigado.html') ok(b === null, `G: ${f} sem barra de ações`, b);
      else ok(b && b.fundo === b.alt && b.cels.every(h => h >= 56) && b.ultimo <= b.topo, `G: ${f} a ${largura} px barra fixa em baixo, células de 56 px, sem tapar o rodapé`, b);
    }
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    await page.locator('#sendBtn').scrollIntoViewIfNeeded();
    ok(await page.evaluate(() => { const r = document.querySelector('#sendBtn').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.bottom - 2); return el && el.closest('#sendBtn') !== null; }), `G: a ${largura} px a barra não tapa o botão de envio`);
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
    ok(await page.isVisible('[data-menu-fundo]') && await page.evaluate(() => document.documentElement.classList.contains('menu-aberto') && getComputedStyle(document.documentElement).overflow === 'hidden'), 'H: fundo escurecido e a página não desliza');
    const itens = await page.evaluate(() => Array.from(document.querySelectorAll('#menu-movel a')).map(a => Math.round(a.getBoundingClientRect().height)));
    ok(itens.length === 5 && itens.every(h => h >= 48), 'H: cinco itens com 48 px', itens);
    ok(await page.evaluate(() => document.activeElement.closest('#menu-movel') !== null), 'H: o foco entra no menu');
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#menu-movel') && await page.evaluate(() => document.activeElement.hasAttribute('data-menu')), 'H: Escape fecha e devolve o foco ao botão');
    ok(await page.isHidden('[data-menu-fundo]') && await page.evaluate(() => !document.documentElement.classList.contains('menu-aberto')), 'H: fechado, sem fundo e a página volta a deslizar');
    await page.click('[data-menu]');
    await Promise.all([page.waitForURL(/index\.html$/, { waitUntil: 'domcontentloaded' }), page.click('#menu-movel a[href$="index.html"]')]);
    await page.waitForTimeout(300);
    ok(await page.isHidden('#menu-movel') && /index\.html$/.test(page.url()), 'H: uma ligação do menu fecha-o e navega', page.url());
    await ctx.close();
  }

  /* I. o comparador */
  {
    const { ctx, page } = await pagina();
    await page.goto(`${srv.base}/obras/${(OBRAS.find(o => o.antesDepois) || OBRAS[0]).slug}.html`, { waitUntil: 'networkidle' });
    await page.locator('[data-ba]').scrollIntoViewIfNeeded();
    await page.locator('[data-ba-range]').fill('20');
    await page.waitForTimeout(100);
    ok(await page.evaluate(() => document.querySelector('[data-ba-before]').style.width === '20%' && document.querySelector('[data-ba-handle]').style.left === '20%'), 'I: o range move o antes e a linha');
    await page.locator('[data-ba-range]').focus();
    await page.keyboard.press('ArrowRight');
    ok(await page.inputValue('[data-ba-range]') === '21' && await page.evaluate(() => document.querySelector('[data-ba-before]').style.width === '21%'), 'I: as setas do teclado também');
    const l = await page.evaluate(() => { const s = document.querySelector('[data-ba]'); const f = document.querySelector('[data-ba-before] .foto'); return { w: s.clientWidth, fw: f.getBoundingClientRect().width }; });
    ok(Math.abs(l.w - l.fw) < 2, 'I: o antes tem a largura do comparador', l);
    // o rato: um clique longe da pega não mexe a linha; arrastar a partir da pega (até 32 px dela) sim
    await page.locator('[data-ba-range]').fill('50');
    const s = await page.evaluate(() => { const r = document.querySelector('[data-ba]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.click(s.x + s.w * 0.85, s.y + s.h / 2);
    ok(await page.inputValue('[data-ba-range]') === '50', 'I: um clique longe da pega não mexe a linha');
    await page.mouse.move(s.x + s.w * 0.5 + 25, s.y + s.h / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + s.w * 0.3, s.y + s.h / 2, { steps: 6 });
    await page.mouse.up();
    ok(await page.inputValue('[data-ba-range]') === '30' && await page.evaluate(() => document.querySelector('[data-ba-before]').style.width === '30%'), 'I: arrastar a partir da pega move a linha', await page.inputValue('[data-ba-range]'));
    await page.mouse.move(s.x + s.w * 0.8, s.y + s.h / 2);
    ok(await page.inputValue('[data-ba-range]') === '30', 'I: largado, o rato já não a mexe');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('[data-ba]')).touchAction === 'pan-y' && getComputedStyle(document.querySelector('[data-ba-handle]')).touchAction === 'pan-y'), 'I: o deslize vertical continua a mexer a página (pan-y)');
    ok(page.erros.length === 0, 'I: sem erros', page.erros);
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
    const todas = await page.evaluate(() => ({ chips: document.querySelectorAll('[data-filtro], .chip').length, vis: Array.from(document.querySelectorAll('[data-obras] .pg')).filter(e => e.getBoundingClientRect().height > 0).length }));
    ok(todas.chips === 0 && todas.vis === OBRAS.length, 'J: obras.html mostra todas as obras, sem chips de filtro', todas);
    // os grupos por serviço: o índice leva à secção, e um grupo de uma obra fica com meio cartão encostado à esquerda
    await page.click('.indice-grupos a[href="#fachadas"]');
    await page.waitForTimeout(600);
    const g = await page.evaluate(() => { const s = document.querySelector('#fachadas'), c = s.querySelector('.pg'), w = s.querySelector('.wrap'); const r = c.getBoundingClientRect(), rw = w.getBoundingClientRect(), cs = getComputedStyle(w);
      return { topo: Math.round(s.getBoundingClientRect().top), x: Math.round(r.left), x0: Math.round(rw.left + parseFloat(cs.paddingLeft)), metade: r.width < (rw.width - parseFloat(cs.paddingLeft) * 2) * 0.6 }; });
    ok(g.topo >= 0 && g.topo < 120 && g.x === g.x0 && g.metade, 'J: o índice leva a #fachadas, com meio cartão encostado à esquerda', g);
    const titulos = await page.evaluate(() => Array.from(document.querySelectorAll('main h1, main h2, main h3')).map(h => Number(h.tagName[1])));
    ok(titulos[0] === 1 && titulos.every((n, i) => i === 0 || n <= titulos[i - 1] + 1), 'J: obras.html sem saltos nos títulos (H1 › H2 › H3)', titulos);
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
  {
    const { ctx, page } = await pagina();
    for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`, '/privacidade.html', '/404.html']) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      const sem = await page.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.getTiming().iterations === Infinity).length);
      ok(sem === 0, `K: ${f} sem animações infinitas`, sem);
    }
    await ctx.close();
  }

  /* L. o sistema visual */
  {
    // contraste WCAG entre o texto e o primeiro fundo opaco por baixo (o do próprio elemento ou o de um antepassado)
    const contrastes = () => {
      const rgb = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const fundo = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.a > 0.5) return c; } return { r: 255, g: 255, b: 255 }; };
      const razao = el => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(fundo(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      const comTexto = el => Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent.trim());
      const alvos = [...document.querySelectorAll('.btn'), ...Array.from(document.querySelectorAll('.s-clay *')).filter(e => comTexto(e) && !e.closest('.s-paper, .so-leitor'))];
      return alvos.filter(e => e.getClientRects().length).map(e => ({ t: e.textContent.trim().slice(0, 30), c: Math.round(razao(e) * 100) / 100 }));
    };
    for (const largura of [1280, 390]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
      const x = await page.evaluate(() => {
        const l = e => Math.round(e.getBoundingClientRect().left);
        return { logo: l(document.querySelector('.topo .logo')), h1: l(document.querySelector('.hero h1')), secs: Array.from(document.querySelectorAll('.sec-head')).map(l) };
      });
      ok(x.h1 === x.logo && x.secs.every(s => s === x.logo), `L: a ${largura} px o h1 do hero e os cabeçalhos de secção começam no x do logótipo`, x);
      const etiquetas = await page.evaluate(() => Array.from(document.querySelectorAll('.eyebrow, .cat, .btn, .ba-tag, .tag-card .l, .foot-h, .cta-phone-l, .barra-cel, .navlinks a')).filter(e => e.getClientRects().length).map(e => parseFloat(getComputedStyle(e).fontSize)));
      ok(etiquetas.every(v => v >= 13), `L: a ${largura} px etiquetas com 13 px ou mais`, etiquetas);
      await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
      const campos = await page.evaluate(() => Array.from(document.querySelectorAll('input:not([type=hidden]):not([name=bot-field]), select, textarea')).map(e => parseFloat(getComputedStyle(e).fontSize)));
      ok(campos.length === 6 && campos.every(v => v >= 16), `L: a ${largura} px os campos de orcamento.html com 16 px ou mais`, campos);
      const rotulos = await page.evaluate(() => Array.from(document.querySelectorAll('.field label')).map(e => parseFloat(getComputedStyle(e).fontSize)));
      ok(rotulos.every(v => v >= 14), `L: a ${largura} px etiquetas dos campos com 14 px`, rotulos);
      const xo = await page.evaluate(() => { const l = e => Math.round(e.getBoundingClientRect().left); return { logo: l(document.querySelector('.topo .logo')), h1: l(document.querySelector('h1')), migalhas: l(document.querySelector('.migalhas')) }; });
      ok(xo.h1 === xo.logo && xo.migalhas === xo.logo, `L: a ${largura} px o PageHead começa no x do logótipo`, xo);
      await ctx.close();
    }
    const { ctx, page } = await pagina();
    for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`, '/orcamento.html', '/obrigado.html', '/404.html']) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
      await page.waitForTimeout(800);
      const fracos = (await page.evaluate(contrastes)).filter(c => c.c < 4.5);
      ok(fracos.length === 0, `L: ${f} botões e faixa clay com 4,5:1 ou mais`, fracos);
    }
    {
      // a barra de ações (só abaixo de 980 px): Ligar e WhatsApp bone sobre ink, Orçamento ink sobre clay
      const m = await pagina({ viewport: { width: 390, height: 800 } });
      await m.page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
      const cels = await m.page.evaluate(contrastes.toString().replace("[...document.querySelectorAll('.btn'),", "[...document.querySelectorAll('.btn, .barra-cel'),").replace(/^\(\) =>/, '(() =>') + ')()');
      const barra = cels.filter(c => /^(Ligar|WhatsApp|Orçamento)$/.test(c.t));
      ok(barra.length === 3 && barra.every(c => c.c >= 4.5), 'L: a barra de ações com 4,5:1 ou mais', barra);
      await m.ctx.close();
    }
    // o anel de foco: ink sobre paper (hero) e sobre clay (faixa de contacto), amber sobre ink (obras)
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    const anel = async sel => { await page.focus(sel); return page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor; }); };
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    ok(await anel('.hero .acoes .btn') === 'solid 3px rgb(27, 37, 64)', 'L: foco ink no hero (paper)', await anel('.hero .acoes .btn'));
    ok(await anel('#obras .obras-mais .btn') === 'solid 3px rgb(240, 168, 56)', 'L: foco amber nas obras (ink)', await anel('#obras .obras-mais .btn'));
    ok(await anel('#contacto .cta-phone') === 'solid 3px rgb(27, 37, 64)', 'L: foco ink na faixa clay', await anel('#contacto .cta-phone'));
    const btn = await page.evaluate(() => { const b = getComputedStyle(document.querySelector('.hero .btn')), g = document.querySelector('.hero .btn-ghost'); return { bg: b.backgroundColor, cor: b.color, alturas: [document.querySelector('.hero .btn').offsetHeight, g.offsetHeight] }; });
    ok(btn.bg === 'rgb(224, 138, 30)' && btn.cor === 'rgb(27, 37, 64)' && btn.alturas[0] === btn.alturas[1], 'L: «Pedir Orçamento» ink sobre clay e o ghost com a mesma altura', btn);
    await ctx.close();
  }
  /* M. as fotografias sem ampliação (fase 6) */
  {
    // quanto a fotografia está ampliada: a caixa a dividir pelo ficheiro escolhido (com object-fit: cover, o lado que
    // corta menos); «limite» é a ampliação mínima possível, a do maior ficheiro (o original), para as que o original não chega
    const ampliacoes = () => Array.from(document.images).filter(i => i.closest('picture') && i.getBoundingClientRect().width > 0).map(i => {
      const r = i.getBoundingClientRect(), srcs = i.closest('picture').querySelector('source[type="image/avif"]').srcset.split(',').map(s => s.trim().split(' '));
      const nome = i.currentSrc.split('/').pop(), esc = srcs.find(([u]) => u.endsWith(nome)), cw = esc ? parseInt(esc[1]) : i.naturalWidth;
      const ch = cw * i.naturalHeight / i.naturalWidth, maxW = Math.max(...srcs.map(([, w]) => parseInt(w))), maxH = maxW * i.naturalHeight / i.naturalWidth;
      return { f: nome, amp: Math.max(r.width / cw, r.height / ch), limite: Math.max(1, r.width / maxW, r.height / maxH) };
    });
    const OBRA_GRANDE = OBRAS.find(o => !o.antesDepois && o.foto === '04') || OBRAS.find(o => !o.antesDepois);
    for (const largura of [375, 1280]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      for (const f of ['/', '/obras.html', `/obras/${OBRA_GRANDE.slug}.html`, '/orcamento.html']) {
        await page.goto(srv.base + f, { waitUntil: 'networkidle' });
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
        await page.waitForTimeout(400);
        if (f === '/' && largura === 375) {
          const h = await page.evaluate(() => { const i = document.querySelector('.hero-photo img'), r = i.getBoundingClientRect(); return { nat: i.naturalHeight, vista: Math.round(r.height), natW: i.naturalWidth, vistaW: Math.round(r.width) }; });
          ok(h.nat / h.vista >= 1 && h.natW / h.vistaW >= 1, 'M: a 375 px a fotografia do hero não está ampliada', h);
        }
        const amp = await page.evaluate(ampliacoes);
        const maus = amp.filter(a => a.amp > Math.max(1.02, a.limite + 0.02));
        ok(amp.length > 0 && maus.length === 0, `M: ${f} a ${largura} px sem fotografias ampliadas para lá do original`, maus);
      }
      // a ficha: a fotografia na sua proporção, sem corte, no máximo 78% do ecrã de altura
      await page.goto(`${srv.base}/obras/${OBRA_GRANDE.slug}.html`, { waitUntil: 'networkidle' });
      const fo = await page.evaluate(() => { const i = document.querySelector('.obra-foto img'), r = i.getBoundingClientRect(); return { prop: Math.abs(r.width / r.height - i.naturalWidth / i.naturalHeight), h: r.height, max: innerHeight * 0.78 + 1 }; });
      ok(fo.prop < 0.01 && fo.h <= fo.max, `M: a ${largura} px a fotografia da ficha na sua proporção, até 78% da altura`, fo);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  await srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${oks} verificações, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
