/* O site no browser (Playwright): gera numa pasta temporária (MELPERFAZ_OUT) e serve-a num servidor local que guarda cada
   envio do formulário como o Netlify Forms o receberia e pode falhar de propósito. Casos:
   A. o pedido (orcamento.html, o único formulário) segue com os campos certos e abre obrigado.html (um só sucesso);
   B. a validação em português: sem nome e telefone não segue; telefone curto; email estranho; corrigido, segue;
   C. o servidor falha: o alerta recebe o foco, com o telefone e o WhatsApp (nome e tipo escritos), o que se escreveu
      fica, e a segunda tentativa segue;
   D. sem JavaScript: o envio normal chega a /obrigado.html com os campos;
   E. o tipo de obra pré-escolhido: pela lista de serviços e pelo ?tipo= (e ?de=) da ficha de obra, em orcamento.html, com
      «Pedido para: X · alterar» e o ?de= no campo «pagina»; os endereços antigos da página inicial (#contacto, ?tipo=)
      vão para orcamento.html, e os tipos de antes do redesenho («Fachadas / Impermeabilização») escolhem o de hoje;
   F. o isco para robôs: preenchido, não segue;
   G. nenhuma página desliza para o lado a 390 e 320 px, sem erros de JavaScript; a barra de ações (menos em obrigado.html)
      não tapa o rodapé nem o botão de envio;
   H. o menu dos ecrãs estreitos: abre sobre um fundo escurecido (com fade), as barras viram X, a página não desliza,
      foca, fecha com Escape (escondido no fim da transição) e devolve o foco;
   I. o comparador antes/depois: com o teclado, e com o rato só a partir da pega (um clique noutro sítio não o mexe);
   J. teclado: a primeira tabulação é «Saltar para o conteúdo»; a entrada ao fazer scroll acaba toda visível;
      todas as imagens carregam; o menu marca a página atual; obras.html mostra todas as obras, sem filtros, agrupadas
      por serviço (o índice leva a cada grupo; H1 › H2 › H3);
   K. movimento reduzido; nenhuma animação sem fim;
   L. o sistema visual: uma margem esquerda (h1 do hero, logótipo e cabeçalhos de secção no mesmo x), contraste de 4,5:1
      nos botões, na barra e no texto da faixa clay, o anel de foco da cor da superfície, campos com 16 px e etiquetas com 13 px;
      a legenda dos cartões sobre a fotografia (também a 390 px, cartões de 280 px); a página inicial em menos de 6.000 px
      a 390 e até 4.400 a 1440, com as miniaturas dos serviços sem acrescentar linhas, «Ver as N obras» ao lado do título
      e Porquê Nós em duas colunas; «Pedido para: X · alterar» em linhas de texto a 320 e 390 px;
   M. as fotografias sem ampliação: a 375 px a do hero tem pelo menos tantos píxeis como a moldura, e nenhuma fotografia é
      mostrada maior do que o ficheiro escolhido, salvo quando o próprio original é mais pequeno do que a moldura;
   N. o movimento (Fase 5b): o cabeçalho compacto depois de 80 px, sem mudar de altura; CLS abaixo de 0,05; a seta
      avança com o rato; os vistos desenham-se ao entrar no ecrã; as fotografias em lazy load entram num fade; o
      WhatsApp pulsa duas vezes e pára; o indicador de carga do envio; o visto de obrigado.html; e, com movimento
      reduzido, nada se desloca nem anima (o menu abre e fecha logo, já com o X).
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
    // os endereços de antes do redesenho: o ?tipo= levava o valor antigo do «Tipo de obra» (quote() do build antigo, com
    // o «/» por codificar), a partir da página inicial (…/index.html?tipo=…#contacto) e das fichas; continua a escolher o
    // serviço de hoje, com «Pedido para:». Os que não mudaram de nome («Trabalhos de Estrutura», «Acabamentos», «Outro»)
    // são o próprio valor da opção
    const ANTIGOS = SITE.servicos.flatMap(s => (s.antigos || []).map(a => [a, s.nome]));
    ok(ANTIGOS.length === 4, 'E: quatro tipos antigos com outro nome hoje', ANTIGOS);
    for (const [antigo, nome] of [...ANTIGOS, ['Trabalhos de Estrutura', 'Trabalhos de Estrutura'], ['Acabamentos', 'Acabamentos'], ['Outro', 'Outro']]) {
      const q = encodeURIComponent(antigo).replace(/%2F/g, '/');
      await page.goto(`${srv.base}/index.html?tipo=${q}#contacto`, { waitUntil: 'networkidle' });
      const linha = (await page.textContent('[data-pedido-para]')).replace(/\s+/g, ' ').trim();
      ok(page.url().endsWith(`/orcamento.html?tipo=${q}`) && await page.inputValue('#qTipo') === nome && await page.isVisible('[data-pedido-para]') && linha === `Pedido para: ${nome} · alterar`,
        `E: o endereço antigo ?tipo=${antigo} escolhe «${nome}»`, { url: page.url(), tipo: await page.inputValue('#qTipo'), linha });
    }
    // e com «+» no lugar dos espaços (como um formulário GET os escreve)
    await page.goto(`${srv.base}/orcamento.html?tipo=Espa%C3%A7o+Comercial`, { waitUntil: 'networkidle' });
    ok(await page.inputValue('#qTipo') === 'Espaços Comerciais', 'E: ?tipo=Espaço+Comercial escolhe «Espaços Comerciais»');
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
    ok(await page.isVisible('[data-menu]') && await page.isHidden('.navlinks'), 'H: o botão do menu aparece e o menu normal não');
    // as três barras do ícone «menu»: direitas com o menu fechado, um X com ele aberto (250 ms)
    const barras = () => page.evaluate(() => Array.from(document.querySelectorAll('[data-menu] .i-menu path')).map(b => { const s = getComputedStyle(b); return { t: s.transform, o: s.opacity }; }));
    const fechado = await barras();
    ok(fechado.length === 3 && fechado.every(b => b.t === 'none' && b.o === '1'), 'H: fechado, três barras', fechado);
    await page.click('[data-menu]');
    ok(await page.isVisible('#menu-movel') && await page.getAttribute('[data-menu]', 'aria-expanded') === 'true', 'H: abre');
    ok(await page.evaluate(() => /0\.25s/.test(getComputedStyle(document.querySelector('#menu-movel')).transitionDuration)), 'H: o painel entra com uma transição de 250 ms');
    await page.waitForTimeout(400);
    const x = await barras();
    // rotate(45deg) dá matrix(0.707…, 0.707…, -0.707…, 0.707…, …); a do meio desaparece
    const rot = t => { const m = /matrix\(([^,]+), ([^,]+)/.exec(t); return m ? Math.round(Math.atan2(parseFloat(m[2]), parseFloat(m[1])) * 180 / Math.PI) : 0; };
    ok(rot(x[0].t) === 45 && x[1].o === '0' && rot(x[2].t) === -45, 'H: aberto, as barras viram X', x);
    ok(await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#menu-movel')); return s.opacity === '1' && s.transform === 'none'; }), 'H: o painel acaba no sítio, opaco');
    ok(await page.isVisible('[data-menu-fundo]') && await page.evaluate(() => document.documentElement.classList.contains('menu-aberto') && getComputedStyle(document.documentElement).overflow === 'hidden'), 'H: fundo escurecido e a página não desliza');
    const itens = await page.evaluate(() => Array.from(document.querySelectorAll('#menu-movel a')).map(a => Math.round(a.getBoundingClientRect().height)));
    ok(itens.length === 5 && itens.every(h => h >= 48), 'H: cinco itens com 48 px', itens);
    ok(await page.evaluate(() => document.activeElement.closest('#menu-movel') !== null), 'H: o foco entra no menu');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => document.activeElement.hasAttribute('data-menu') && !document.documentElement.classList.contains('menu-aberto')), 'H: Escape fecha logo (a página volta a deslizar) e devolve o foco ao botão');
    // o painel e o fundo saem com fade e só no fim ficam hidden (no máximo 500 ms)
    const t0 = Date.now();
    await page.waitForSelector('#menu-movel', { state: 'hidden', timeout: 2000 });
    await page.waitForSelector('[data-menu-fundo]', { state: 'hidden', timeout: 2000 });
    ok(Date.now() - t0 <= 600, 'H: fechado, o painel e o fundo escondem-se no fim da transição', Date.now() - t0);
    ok((await barras()).every(b => b.t === 'none' && b.o === '1'), 'H: fechado, as barras voltam');
    await page.click('[data-menu]');
    await Promise.all([page.waitForURL(/index\.html$/, { waitUntil: 'domcontentloaded' }), page.click('#menu-movel a[href$="index.html"]')]);
    await page.waitForTimeout(500);
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
    for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`, `/obras/${(OBRAS.find(o => o.antesDepois) || OBRAS[0]).slug}.html`, '/orcamento.html', '/obrigado.html', '/privacidade.html', '/404.html']) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      // também as dos estados: o telefone a abanar (hover) e a pega agarrada; nenhuma passa de 500 ms por volta
      if (await page.isVisible('.topo-tel')) await page.hover('.topo-tel');
      const an = await page.evaluate(() => document.getAnimations().filter(a => a.effect).map(a => { const t = a.effect.getTiming(); return { n: a.animationName || '', it: t.iterations, d: t.duration }; }));
      ok(an.every(a => a.it !== Infinity), `K: ${f} sem animações infinitas`, an);
      ok(an.every(a => a.d === 'auto' || a.d <= 500), `K: ${f} nenhuma animação passa de 500 ms por volta`, an);
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
    // o cartão de obra: o anel desenha-se por fora, na cor da superfície à volta (amber no ink, ink no bone e no paper)
    const anelCartao = async (sel) => { await page.focus(sel); return page.evaluate(s => { const c = document.querySelector(s).closest('.pg'), st = getComputedStyle(c); return st.outlineStyle + ' ' + st.outlineWidth + ' ' + st.outlineColor; }, sel); };
    ok(await anelCartao('#obras .pg h3 a') === 'solid 3px rgb(240, 168, 56)', 'L: foco amber no cartão de obra sobre ink', await anelCartao('#obras .pg h3 a'));
    await page.goto(`${srv.base}/obras/${OBRAS[0].slug}.html`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    ok(await anelCartao('.obra-rel .pg h3 a') === 'solid 3px rgb(27, 37, 64)', 'L: foco ink no cartão de obra sobre bone («Obras semelhantes»)', await anelCartao('.obra-rel .pg h3 a'));
    await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    ok(await anelCartao('section.s-bone .pg h3 a') === 'solid 3px rgb(27, 37, 64)', 'L: foco ink no cartão de obra num grupo bone de obras.html', await anelCartao('section.s-bone .pg h3 a'));
    // a legenda do cartão sobre a fotografia (a todas as larguras: aqui a 1280 e, mais abaixo, a 390): o .cat amber e o
    // título bone com 4,5:1 ou mais mesmo no pior caso, a faixa da legenda por cima de uma fotografia toda branca (a cor
    // composta da faixa sobre branco)
    const legendas = () => {
      const rgb = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
      const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const razao = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      return Array.from(document.querySelectorAll('.pg figcaption')).map(f => {
        const fa = rgb(getComputedStyle(f).backgroundColor), sobre = k => fa[k] * fa.a + 255 * (1 - fa.a);
        const fundo = { r: sobre('r'), g: sobre('g'), b: sobre('b') };
        const t = el => Math.round(razao(rgb(getComputedStyle(el).color), fundo) * 100) / 100;
        return { cat: t(f.querySelector('.cat')), titulo: t(f.querySelector('h2, h3')), alfa: fa.a };
      });
    };
    for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`]) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      const l = await page.evaluate(legendas);
      ok(l.length > 0 && l.every(c => c.cat >= 4.5 && c.titulo >= 4.5), `L: ${f} .cat e título dos cartões com 4,5:1 ou mais sobre uma fotografia branca`, l);
    }
    {
      // no telemóvel o cartão é o mesmo: 280 px de altura, a fotografia a toda a caixa e a legenda por cima, na faixa
      // escura, encostada ao fundo (com o mesmo contraste no pior caso)
      const m = await pagina({ viewport: { width: 390, height: 800 } });
      for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`]) {
        await m.page.goto(srv.base + f, { waitUntil: 'networkidle' });
        const l = await m.page.evaluate(legendas);
        ok(l.length > 0 && l.every(c => c.cat >= 4.5 && c.titulo >= 4.5), `L: a 390 px ${f} .cat e título dos cartões com 4,5:1 ou mais sobre uma fotografia branca`, l);
        const cartoes = await m.page.evaluate(() => Array.from(document.querySelectorAll('.pg')).map(c => {
          const r = c.getBoundingClientRect(), fo = c.querySelector('.foto').getBoundingClientRect(), le = c.querySelector('figcaption').getBoundingClientRect();
          return { h: Math.round(r.height), foto: Math.round(fo.height) === Math.round(r.height) && Math.round(fo.top) === Math.round(r.top), leg: Math.round(le.bottom) === Math.round(r.bottom) && le.top > r.top, pos: getComputedStyle(c.querySelector('figcaption')).position };
        }));
        ok(cartoes.length > 0 && cartoes.every(c => c.h === 280 && c.foto && c.leg && c.pos === 'absolute'), `L: a 390 px ${f} os cartões com a legenda sobre a fotografia, 280 px`, cartoes);
      }
      await m.ctx.close();
    }
    // a lista «Na obra» começa na margem esquerda, como o h2 (sem o recuo de uma ul)
    await page.goto(`${srv.base}/obras/${OBRAS[0].slug}.html`, { waitUntil: 'networkidle' });
    const visto = await page.evaluate(() => { const l = e => Math.round(e.getBoundingClientRect().left), ul = document.querySelector('.lista-visto'); return { h2: l(ul.previousElementSibling), ul: l(ul), tick: l(ul.querySelector('.tick')) }; });
    ok(visto.h2 === visto.ul && visto.ul === visto.tick, 'L: «Na obra»: os vistos alinhados com o h2', visto);
    {
      const m = await pagina({ viewport: { width: 390, height: 800 } });
      await m.page.goto(`${srv.base}/obras/${OBRAS[0].slug}.html`, { waitUntil: 'networkidle' });
      const v = await m.page.evaluate(() => { const l = e => Math.round(e.getBoundingClientRect().left), ul = document.querySelector('.lista-visto'); return { h2: l(ul.previousElementSibling), ul: l(ul), tick: l(ul.querySelector('.tick')), logo: l(document.querySelector('.topo .logo')) }; });
      ok(v.h2 === v.ul && v.ul === v.tick && v.tick === v.logo, 'L: a 390 px «Na obra»: os vistos alinhados com o h2 e o logótipo', v);
      await m.ctx.close();
    }
    // o cabeçalho fica paper opaco por cima das secções ink (sem vidro translúcido)
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => scrollTo(0, document.querySelector('#obras').offsetTop + 200));
    await page.waitForTimeout(400);
    const topo = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.topo')); return { bg: s.backgroundColor, filtro: s.backdropFilter || 'none' }; });
    ok(topo.bg === 'rgb(247, 248, 251)' && topo.filtro === 'none', 'L: o cabeçalho é paper opaco por cima das obras (ink)', topo);
    await ctx.close();
  }
  {
    // a altura da página inicial (Fase 7, assertiva 2): menos de 6.000 px a 390 e no máximo 4.400 a 1440 (o plano diz
    // cerca de 4.300), sem tirar nenhum facto, serviço, obra ou ação (era 8.469 e 4.955 antes do redesenho, 6.486 e
    // 4.930 antes do acerto: a legenda sobre a fotografia também no telemóvel, um passo de token a menos nas secções,
    // Porquê Nós em duas colunas, as miniaturas só onde não acrescentam linhas, «Ver as N obras» ao lado do título)
    for (const [largura, cabe] of [[390, h => h < 6000], [1440, h => h <= 4400]]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      ok(cabe(h), `L: a ${largura} px a página inicial cabe no alvo do plano (${largura === 390 ? 'menos de 6.000' : 'até 4.400'} px)`, h);
      await ctx.close();
    }
  }
  {
    // a página inicial compacta: as miniaturas dos serviços só onde não acrescentam linhas (acima de 980 px; a mesma
    // altura de cada linha com e sem elas), «Ver as N obras» à direita do título das obras (por baixo dos cartões até
    // 980 px), Porquê Nós com as garantias em duas colunas e a fotografia na coluna das ações da faixa clay
    for (const largura of [390, 700, 1280, 1440]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
      const alturas = () => page.evaluate(() => Array.from(document.querySelectorAll('.svc')).map(s => Math.round(s.getBoundingClientRect().height)));
      const com = await alturas(), vistas = await page.evaluate(() => Array.from(document.querySelectorAll('.svc-mini')).filter(e => e.getClientRects().length).length);
      const estilo = await page.addStyleTag({ content: '.svc-mini { display: none !important; }' });
      const sem = await alturas();
      await estilo.evaluate(e => e.remove());
      if (largura > 980) ok(vistas === 3 && com.join() === sem.join(), `L: a ${largura} px as miniaturas dos serviços não acrescentam linhas`, { com, sem });
      else ok(vistas === 0, `L: a ${largura} px sem miniaturas nos serviços`, vistas);
      await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
      await page.waitForTimeout(800);
      const g = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const btn = r('#obras .obras-mais .btn'), p = r('#obras .sec-head p'), grelha = r('#obras .photo-grid'), wrap = document.querySelector('#obras .wrap'), dentro = wrap.getBoundingClientRect().right - parseFloat(getComputedStyle(wrap).paddingRight);
        const lis = Array.from(document.querySelectorAll('.trust-list li')).map(li => li.getBoundingClientRect());
        const foto = document.querySelector('.trust-foto'), fr = foto.getBoundingClientRect(), acoes = r('#contacto .cta-acoes');
        return { btnBase: Math.round(btn.bottom - p.bottom), btnDir: Math.round(dentro - btn.right), btnAbaixo: btn.top > grelha.bottom,
          colunas: new Set(lis.map(l => Math.round(l.left))).size, foto: foto.getClientRects().length > 0, fotoX: Math.round(fr.left - acoes.left), fotoW: Math.round(fr.width - acoes.width) };
      });
      if (largura > 980) ok(Math.abs(g.btnBase) <= 1 && Math.abs(g.btnDir) <= 1 && !g.btnAbaixo, `L: a ${largura} px «Ver as N obras» à direita do título, pela base do texto`, g);
      else ok(g.btnAbaixo, `L: a ${largura} px «Ver as N obras» por baixo dos cartões`, g);
      ok(g.colunas === (largura > 640 ? 2 : 1), `L: a ${largura} px as garantias em ${largura > 640 ? 'duas colunas' : 'uma coluna'}`, g);
      if (largura > 980) ok(g.foto && g.fotoX === 0 && g.fotoW === 0, `L: a ${largura} px a fotografia do Porquê Nós na coluna das ações da faixa clay`, g);
      if (largura <= 640) ok(!g.foto, `L: a ${largura} px sem a fotografia do Porquê Nós`, g);
      await ctx.close();
    }
    // «Pedido para: X · alterar» lê-se de seguida a 320 e a 390 px: linhas com a altura do texto (o alvo de 44 px do
    // «alterar» desenha-se por fora), o «·» e «alterar» na mesma linha do fim do nome
    for (const largura of [320, 390]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 800 } });
      await page.goto(srv.base + '/orcamento.html?tipo=fachadas', { waitUntil: 'networkidle' });
      const pp = await page.evaluate(() => {
        const p = document.querySelector('[data-pedido-para]'), lh = parseFloat(getComputedStyle(p).lineHeight), h = p.getBoundingClientRect().height;
        const nome = [...document.querySelector('[data-pedido-nome]').getClientRects()].pop();
        const no = [...p.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('·')), rg = document.createRange(), i = no.textContent.indexOf('·');
        rg.setStart(no, i); rg.setEnd(no, i + 1);
        const ponto = rg.getBoundingClientRect(), b = document.querySelector('[data-pedido-alterar]'), br = b.getBoundingClientRect();
        const centro = br.top + br.height / 2, x = br.left + br.width / 2;
        const meio = r => (r.top + r.bottom) / 2;
        return { linhas: h / lh, mesma: Math.abs(meio(nome) - meio(ponto)) < 2 && Math.abs(meio(ponto) - meio(br)) < 2,
          alvo: document.elementFromPoint(x, centro - 21) === b && document.elementFromPoint(x, centro + 21) === b, larga: p.scrollWidth <= p.clientWidth };
      });
      ok(Math.abs(pp.linhas - Math.round(pp.linhas)) < 0.05 && pp.linhas <= 2 && pp.mesma && pp.alvo && pp.larga, `L: a ${largura} px «Pedido para: X · alterar» em linhas de texto, com «alterar» no fim do nome e 44 px de alvo`, pp);
      await ctx.close();
    }
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

  /* N. o movimento (Fase 5b) */
  {
    // o cabeçalho: compacto e com sombra depois de 80 px de scroll, com a mesma altura (o conteúdo não salta)
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    const topo = () => page.evaluate(() => { const h = document.querySelector('[data-topo]'); return { c: h.classList.contains('topo-compacto'), s: getComputedStyle(h).boxShadow, alt: h.offsetHeight }; });
    const t0 = await topo();
    await page.evaluate(() => window.scrollTo(0, 60)); await page.waitForTimeout(300);
    const t60 = await topo();
    await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(400);
    const t400 = await topo();
    ok(!t0.c && t0.s === 'none' && !t60.c && t400.c && t400.s !== 'none' && t400.alt === t0.alt, 'N: o cabeçalho fica compacto, com sombra, depois de 80 px, sem mudar de altura', [t0, t60, t400]);
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400);
    ok(!(await topo()).c, 'N: de volta ao topo, o cabeçalho volta ao normal');
    // os vistos de «Porquê Nós»: por desenhar antes de entrar no ecrã, desenhados depois, em cascata de 80 ms
    const vistos = () => page.evaluate(() => Array.from(document.querySelectorAll('.trust-list .tick path')).map(p => parseFloat(getComputedStyle(p).strokeDashoffset)));
    const antes = await vistos();
    await page.locator('.trust-list').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const depois = await vistos();
    const atrasos = await page.evaluate(() => Array.from(document.querySelectorAll('.trust-list .tick path')).map(p => getComputedStyle(p).transitionDelay));
    ok(antes.length === 4 && antes.every(v => v >= 1) && depois.every(v => v === 0), 'N: os vistos desenham-se ao entrar no ecrã', { antes, depois });
    ok(atrasos.join() === '0.25s,0.33s,0.41s,0.49s', 'N: em cascata de 80 ms', atrasos);
    // a seta avança com o rato (150 ms)
    await page.hover('#servicos .link-seta');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('#servicos .link-seta .i-seta')).transform) === 'matrix(1, 0, 0, 1, 5, 0)', 'N: a seta avança 5 px com o rato');
    // as fotografias em lazy load: no fim todas visíveis (.carregada), sem nenhuma presa transparente
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } });
    await page.waitForTimeout(800);
    const lazy = await page.evaluate(() => Array.from(document.querySelectorAll('.foto img[loading="lazy"]')).map(i => ({ f: i.currentSrc.split('/').pop(), c: i.classList.contains('carregada'), o: getComputedStyle(i).opacity })));
    ok(lazy.length > 0 && lazy.every(i => i.c && i.o === '1'), 'N: as fotografias em lazy load entram e ficam opacas', lazy.filter(i => !i.c || i.o !== '1'));
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('.foto img[loading="lazy"]')).transitionDuration.startsWith('0.5s')), 'N: com um fade de 500 ms');
    // o WhatsApp do cabeçalho pulsa duas vezes ao carregar e pára
    await page.goto(srv.base + '/obras.html', { waitUntil: 'domcontentloaded' });
    const wa = await page.evaluate(() => document.getAnimations().filter(a => a.animationName === 'acena').map(a => a.effect.getTiming().iterations));
    ok(wa.length >= 1 && wa.every(n => n === 2), 'N: o WhatsApp pulsa duas vezes', wa);
    await page.waitForTimeout(1800);
    ok(await page.evaluate(() => document.getAnimations().filter(a => a.animationName === 'acena' && a.playState === 'running').length) === 0, 'N: e pára');
    // o indicador de carga do envio: um anel que gira um número finito de voltas e sai com a resposta
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    await preenche(page);
    let solta;
    const espera = new Promise(r => { solta = r; });
    await page.route(srv.base + '/', async route => { if (route.request().method() === 'POST') { await espera; await route.fulfill({ status: 500, body: 'erro' }); } else await route.continue(); });
    await page.click('#sendBtn');
    await page.waitForTimeout(200);
    const roda = await page.evaluate(() => { const b = document.querySelector('#sendBtn'), s = getComputedStyle(b, '::before'); return { cl: b.classList.contains('a-enviar'), txt: b.textContent, an: s.animationName, it: s.animationIterationCount, d: s.animationDuration }; });
    ok(roda.cl && roda.txt === 'A enviar…' && roda.an === 'gira' && roda.it === '40' && roda.d === '0.5s', 'N: «A enviar…» com o indicador de carga (40 voltas de 500 ms)', roda);
    solta();
    await page.waitForSelector('#formAlerta:not([hidden])');
    ok(await page.evaluate(() => { const b = document.querySelector('#sendBtn'); return !b.classList.contains('a-enviar') && getComputedStyle(b, '::before').content === 'none'; }), 'N: com a resposta, o indicador sai');
    await page.unroute(srv.base + '/');
    // obrigado.html: o visto desenha-se num círculo, uma vez
    await page.goto(srv.base + '/obrigado.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1300);
    const env = await page.evaluate(() => Array.from(document.querySelectorAll('.pag-icone circle, .pag-icone path')).map(e => parseFloat(getComputedStyle(e).strokeDashoffset)));
    ok(env.length === 2 && env.every(v => v === 0), 'N: obrigado.html desenha o visto no círculo', env);
    // (o 500 do envio é o do teste do indicador: o browser regista-o na consola)
    ok(page.erros.filter(e => !/status of 500/.test(e)).length === 0, 'N: sem erros', page.erros);
    await ctx.close();
  }
  {
    // CLS abaixo de 0,05, ao carregar e ao percorrer a página (com as fotografias a entrar)
    for (const largura of [390, 1280]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 850 } });
      await page.addInitScript(() => { window.__cls = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
      for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`, '/orcamento.html']) {
        await page.goto(srv.base + f, { waitUntil: 'networkidle' });
        await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } });
        await page.waitForTimeout(600);
        const cls = await page.evaluate(() => window.__cls);
        ok(cls < 0.05, `N: ${f} a ${largura} px com CLS abaixo de 0,05`, cls);
      }
      await ctx.close();
    }
  }
  {
    // movimento reduzido: nada anima nem se desloca; as mudanças de estado ficam (o X do menu), sem transição
    const { ctx, page } = await pagina({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    for (const f of ['/', '/obrigado.html', `/obras/${(OBRAS.find(o => o.antesDepois) || OBRAS[0]).slug}.html`]) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      const r = await page.evaluate(() => ({
        anima: document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().duration > 0).map(a => a.animationName),
        transicoes: Array.from(document.querySelectorAll('*')).filter(e => getComputedStyle(e).transitionDuration.split(',').some(v => parseFloat(v) > 0)).map(e => e.className.baseVal ?? e.className).slice(0, 5),
        reveal: Array.from(document.querySelectorAll('.reveal')).every(e => { const s = getComputedStyle(e); return s.opacity === '1' && s.transform === 'none'; }),
        vistos: Array.from(document.querySelectorAll('.tick path, .pag-icone circle, .pag-icone path')).every(p => parseFloat(getComputedStyle(p).strokeDashoffset) === 0),
      }));
      ok(r.anima.length === 0 && r.transicoes.length === 0, `N: ${f} com movimento reduzido sem animações nem transições`, r);
      ok(r.reveal && r.vistos, `N: ${f} com movimento reduzido tudo à vista e no sítio, vistos desenhados`, r);
    }
    await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
    await page.click('[data-menu]');
    const m = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('#menu-movel')), b1 = getComputedStyle(document.querySelector('[data-menu] .b1')); return { o: s.opacity, t: s.transform, x: b1.transform }; });
    ok(m.o === '1' && m.t === 'none' && m.x !== 'none', 'N: com movimento reduzido o menu abre logo, sem deslizar, já com o X', m);
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#menu-movel') && await page.isHidden('[data-menu-fundo]'), 'N: e fecha logo');
    await page.evaluate(() => window.scrollTo(0, 400)); await page.waitForTimeout(300);
    ok(await page.evaluate(() => { const h = document.querySelector('[data-topo]'); return h.classList.contains('topo-compacto') && getComputedStyle(h.querySelector('.logo-img')).transform === 'none'; }), 'N: com movimento reduzido o cabeçalho compacto ganha a sombra, mas o logótipo não encolhe');
    ok(page.erros.length === 0, 'N: sem erros com movimento reduzido', page.erros);
    await ctx.close();
  }
} finally {
  await browser.close();
  await srv.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${oks} verificações, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
