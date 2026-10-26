/* O site no browser (Playwright): gera numa pasta temporária (MELPERFAZ_OUT) e serve-a num servidor local que guarda cada
   envio do formulário como o Netlify Forms o receberia e pode falhar de propósito. Casos:
   A. o pedido (orcamento.html, o único formulário) segue com os campos certos e abre obrigado.html (um só sucesso);
   B. a validação em português: sem nome e telefone não segue; telefone curto; email estranho; corrigido, segue; o erro
      em --erro com o «!» num círculo (não se confunde com o vermelho dos botões);
   C. o servidor falha: o alerta recebe o foco, com o telefone e o WhatsApp (nome e tipo escritos) e o «!», o que se
      escreveu fica, e a segunda tentativa segue;
   D. sem JavaScript: o envio normal chega a /obrigado.html com os campos;
   E. o tipo de obra pré-escolhido: pela lista de serviços e pelo ?tipo= (e ?de=) da ficha de obra, em orcamento.html, com
      «Pedido para: X · alterar» e o ?de= no campo «pagina»; os endereços antigos da página inicial (#contacto, ?tipo=)
      vão para orcamento.html, e os tipos de antes do redesenho («Fachadas / Impermeabilização») escolhem o de hoje;
   F. o isco para robôs: preenchido, não segue;
   G. nenhuma página desliza para o lado a 390 e 320 px, sem erros de JavaScript; a barra de ações (menos em obrigado.html)
      não tapa o rodapé nem o botão de envio, nem o elemento focado ao tabular (também com 200% e 400% de zoom);
   H. o menu dos ecrãs estreitos: abre sobre um fundo escurecido (com fade), as barras viram X, a página não desliza
      nem salta para o topo (o cabeçalho fica no sítio), foca, fecha com Escape (escondido no fim da transição) e
      devolve o foco; o anel de foco da primeira e da última ligação desenha-se inteiro dentro do painel (390 e 640 px);
   I. o comparador antes/depois: com o teclado (e o aria-valuetext), com um clique ou um toque na fotografia (põe a linha
      nesse sítio) e arrastando a partir da pega; o deslize vertical mexe a página; as etiquetas cortam-se com a sua
      fotografia; o anel de foco com halo;
   J. teclado: a primeira tabulação é «Saltar para o conteúdo»; a entrada ao fazer scroll acaba toda visível;
      todas as imagens carregam; o menu marca a página atual; obras.html mostra todas as obras, sem filtros, agrupadas
      por serviço (o índice leva a cada grupo; H1 › H2 › H3);
   K. movimento reduzido; nenhuma animação sem fim;
   L. o sistema visual (verde e vermelho): uma margem esquerda (h1 do hero, logótipo e cabeçalhos de secção no mesmo x),
      contraste de 4,5:1 nos botões, na barra e no texto do painel clay (branco sobre o vermelho), o anel de foco da cor
      da superfície (ink no claro, amber no ink, branco no clay), o hover dos botões no vermelho sem verde, o painel
      vermelho da CtaBand dentro da .wrap de uma secção clara e a 48 px ou mais de qualquer secção ink (o vermelho nunca
      encosta ao verde), campos com 16 px e etiquetas com 13 px;
      a legenda dos cartões sobre a fotografia (a 390 px só nas obras em destaque, com cartões de 280 px; nas outras por
      baixo, em 4/3 ou 4/5), o cartão inteiro é a ligação e a legenda cresce com o texto; a página inicial (o desenho, sem os
      dados da Melperfaz) em menos de 6.000 px a 390 e até 4.400 a 1440, com as miniaturas dos serviços de 64 px a todas as
      larguras, «Ver as N obras» ao lado do título e Porquê Nós em duas colunas; «Pedido para: X · alterar» em linhas de
      texto a 320 e 390 px;
   M. as fotografias sem ampliação: a 375 px a do hero tem pelo menos tantos píxeis como a moldura, e nenhuma fotografia é
      mostrada maior do que o ficheiro escolhido, salvo quando o próprio original é mais pequeno do que a moldura; num
      telemóvel de 3x, a de 2x;
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
    // o erro lê-se como erro, não como o vermelho da marca: texto --erro (mais escuro do que o clay) com o «!» branco num
    // círculo antes da mensagem (só visual: o texto alternativo é vazio); uma mensagem vazia não tem sinal
    const sinal = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#eNome'), '::before'), raiz = getComputedStyle(document.documentElement);
      return { content: s.content, fundo: s.backgroundColor, cor: s.color, raio: s.borderRadius, texto: getComputedStyle(document.querySelector('#eNome')).color,
        clay: raiz.getPropertyValue('--clay').trim(), vazio: getComputedStyle(document.querySelector('#eEmail'), '::before').content };
    });
    ok(sinal.content === '"!" / ""' && sinal.fundo === 'rgb(163, 22, 26)' && sinal.cor === 'rgb(255, 255, 255)' && sinal.raio === '50%'
      && sinal.texto === 'rgb(163, 22, 26)' && sinal.clay === '#c8102e' && sinal.vazio === 'none', 'B: o erro com o «!» num círculo, em --erro e não no clay dos botões', sinal);
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
    const sinalAviso = await page.evaluate(() => { const a = document.querySelector('#formAlerta'), s = getComputedStyle(a, '::before'); return { content: s.content, fundo: s.backgroundColor, borda: getComputedStyle(a).borderTopColor, fundoAviso: getComputedStyle(a).backgroundColor }; });
    ok(sinalAviso.content === '"!" / ""' && sinalAviso.fundo === 'rgb(163, 22, 26)' && sinalAviso.borda === 'rgb(163, 22, 26)' && sinalAviso.fundoAviso === 'rgb(255, 255, 255)', 'C: o aviso com o «!» e contorno --erro sobre branco (não um fundo vermelho cheio, como um botão)', sinalAviso);
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
    // a barra em terços: as células com a mesma largura, dentro do ecrã, e o ícone e o texto de cada uma dentro dela (o
    // scrollWidth da página não vê a barra, que é fixa). Também com o espaçamento de texto da WCAG 1.4.12
    const celulas = () => page.evaluate(() => Array.from(document.querySelectorAll('.barra-cel')).map(c => {
      const r = c.getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(c); const q = rg.getBoundingClientRect();
      return { t: c.textContent.trim(), l: Math.round(r.left * 10) / 10, r: Math.round(r.right * 10) / 10, w: r.width, h: Math.round(r.height), dentro: q.left >= r.left - 0.5 && q.right <= r.right + 0.5, cabe: c.scrollWidth <= c.clientWidth + 1, ecra: r.right <= innerWidth + 0.5 };
    }));
    for (const f of ['/', '/orcamento.html']) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      const c = await celulas();
      ok(c.length === 3 && c.every(x => x.dentro && x.cabe && x.ecra && x.h === 56) && Math.max(...c.map(x => x.w)) - Math.min(...c.map(x => x.w)) < 1, `G: ${f} a ${largura} px a barra em terços, com tudo dentro de cada célula e do ecrã`, c);
      if (largura === 320) {
        await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
        const e = await celulas();
        ok(e.every(x => x.dentro && x.ecra), `G: ${f} a 320 px com o espaçamento de texto da WCAG 1.4.12, nada sai das células nem do ecrã`, e);
      }
    }
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    await page.locator('#sendBtn').scrollIntoViewIfNeeded();
    ok(await page.evaluate(() => { const r = document.querySelector('#sendBtn').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.bottom - 2); return el && el.closest('#sendBtn') !== null; }), `G: a ${largura} px a barra não tapa o botão de envio`);
    ok(page.erros.length === 0, `G: sem erros a ${largura} px`, page.erros);
    await ctx.close();
  }

  /* G. a barra fixa não tapa o elemento focado (WCAG 2.4.11): a tabular pela página inteira, a 390 × 844, a 640 × 450
     (1280 × 900 com 200% de zoom) e a 320 × 256 (400% de zoom), com movimento reduzido (o scroll é imediato). Cada
     elemento focado fora do cabeçalho e da barra fica à vista: inteiro acima da barra quando cabe no espaço entre o
     cabeçalho e a barra (a caixa de texto da mensagem só em parte: o browser mostra o cursor, não a caixa toda) */
  for (const [w, h] of [[390, 844], [640, 450], [320, 256]]) {
    const { ctx, page } = await pagina({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    for (const f of ['/orcamento.html', '/', '/privacidade.html']) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      const tapados = [];
      let n = 0;
      for (let i = 0; i < 160; i++) {
        await page.keyboard.press('Tab');
        const r = await page.evaluate(() => {
          const a = document.activeElement;
          if (!a || a === document.body) return { fim: true };
          if (a.closest('.barra, .topo') || a.classList.contains('skip')) return { fora: true, fim: a.classList.contains('skip') && scrollY > 0 };
          const barra = document.querySelector('.barra').getBoundingClientRect().top, topo = document.querySelector('.topo').getBoundingClientRect().bottom;
          const q = a.getBoundingClientRect();
          return { el: (a.id || a.textContent.trim()).slice(0, 30), top: Math.round(q.top), bottom: Math.round(q.bottom), barra: Math.round(barra), topo: Math.round(topo), area: a.tagName === 'TEXTAREA' };
        });
        if (r.fim) break;
        if (r.fora) continue;
        n++;
        const cabe = !r.area && r.bottom - r.top <= r.barra - r.topo;
        const visto = cabe ? r.bottom <= r.barra + 1 && r.top >= r.topo - 1 : r.top + 24 <= r.barra && r.bottom > r.topo;
        if (!visto) tapados.push(r);
      }
      ok(n > 3 && tapados.length === 0, `G: ${f} a ${w} × ${h} a barra e o cabeçalho não tapam o elemento focado (${n} elementos)`, tapados);
    }
    await ctx.close();
  }

  /* H. o menu dos ecrãs estreitos */
  {
    const { ctx, page } = await pagina({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
    ok(await page.isVisible('[data-menu]') && await page.isHidden('.navlinks'), 'H: o botão do menu aparece e o menu normal não');
    // aberto a meio da página, o menu não a faz saltar para o topo e o cabeçalho fica no sítio (sticky); ao fechar com
    // Escape a página continua onde estava. Abre-se com click() no próprio botão (um toque do Playwright deslizava até ele)
    {
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.waitForTimeout(200);
      const pos = () => page.evaluate(() => ({ y: Math.round(scrollY), topo: Math.round(document.querySelector('.topo').getBoundingClientRect().top) }));
      const antes = await pos();
      await page.evaluate(() => document.querySelector('[data-menu]').click());
      await page.waitForTimeout(400);
      const aberto = await pos();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      const fechado = await pos();
      ok(antes.y === 1500 && aberto.y === 1500 && aberto.topo === 0 && fechado.y === 1500 && fechado.topo === 0, 'H: o menu aberto a meio da página não a faz saltar e o cabeçalho fica no topo', { antes, aberto, fechado });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(200);
    }
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
    await Promise.all([page.waitForURL(srv.base + '/', { waitUntil: 'domcontentloaded' }), page.click('#menu-movel a[href="./"]')]);
    await page.waitForTimeout(500);
    ok(await page.isHidden('#menu-movel') && page.url() === srv.base + '/', 'H: uma ligação do menu fecha-o e navega (para a página inicial, «./»)', page.url());
    await ctx.close();
  }
  {
    // o anel de foco das ligações do menu desenha-se inteiro dentro do painel: o overflow-y do painel cortava o da primeira
    // e o da última ligação a 640 px e abaixo, quando o padding da .wrap do telemóvel apagava o espaço de cima e de baixo
    // do painel. Aberto pelo teclado, a primeira e a última ligação com o anel (3 px a 3 px de distância) cabem no
    // #menu-movel, a 390 e a 640 px (a quebra inclui os 640)
    for (const largura of [390, 640]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 800 }, isMobile: true, hasTouch: true });
      await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
      await page.focus('[data-menu]');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(400);
      const anel = () => page.evaluate(() => {
        const a = document.activeElement, s = getComputedStyle(a), m = document.querySelector('#menu-movel').getBoundingClientRect(), r = a.getBoundingClientRect();
        const fora = parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset);
        return { el: a.textContent.trim(), estilo: s.outlineStyle, fora, dentro: !!a.closest('#menu-movel'),
          cabe: r.top - fora >= m.top && r.bottom + fora <= m.bottom && r.left - fora >= m.left && r.right + fora <= m.right,
          a: [r.top, r.bottom, r.left, r.right].map(Math.round), m: [m.top, m.bottom, m.left, m.right].map(Math.round) };
      });
      const primeiro = await anel();
      for (let i = 1; i < 5; i++) await page.keyboard.press('Tab');
      const ultimo = await anel();
      ok(primeiro.el === 'Início' && ultimo.el === 'Falar por WhatsApp' && [primeiro, ultimo].every(x => x.dentro && x.estilo === 'solid' && x.fora === 6 && x.cabe),
        `H: a ${largura} px o anel de foco da primeira e da última ligação do menu inteiro dentro do painel`, { primeiro, ultimo });
      const pad = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.menu-movel-in')); return [s.paddingTop, s.paddingBottom, s.paddingLeft]; });
      ok(pad[0] === '12px' && pad[1] === '26px' && pad[2] === '16px', `H: a ${largura} px o painel do menu guarda os 12 px em cima e os 26 em baixo (e os 16 dos lados da .wrap)`, pad);
      await ctx.close();
    }
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
    ok(await page.getAttribute('[data-ba-range]', 'aria-valuetext') === 'Demolição 21%, acabamento 79%', 'I: o leitor de ecrã ouve quanto se vê de cada fotografia (aria-valuetext)', await page.getAttribute('[data-ba-range]', 'aria-valuetext'));
    // o anel de foco sobre a fotografia: ink encostado à pega branca e um halo branco por fora (WCAG 1.4.11)
    const anelBa = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.ba-arrows')); return { c: s.outlineColor, o: s.outlineOffset, w: s.outlineWidth, sombra: s.boxShadow }; });
    ok(anelBa.c === 'rgb(18, 57, 43)' && anelBa.o === '0px' && anelBa.w === '3px' && anelBa.sombra.includes('rgb(255, 255, 255) 0px 0px 0px 6px'), 'I: o anel de foco da pega: ink sobre o branco da pega, com halo branco', anelBa);
    // o rato: um clique na fotografia põe a linha nesse sítio (sem arrastar, WCAG 2.5.7); arrastar a partir da pega (até
    // 32 px dela) também a mexe
    await page.locator('[data-ba-range]').fill('50');
    const s = await page.evaluate(() => { const r = document.querySelector('[data-ba]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    await page.mouse.click(s.x + s.w * 0.85, s.y + s.h / 2);
    ok(await page.inputValue('[data-ba-range]') === '85' && await page.evaluate(() => document.querySelector('[data-ba-before]').style.width === '85%'), 'I: um clique na fotografia põe a linha nesse sítio', await page.inputValue('[data-ba-range]'));
    await page.locator('[data-ba-range]').fill('50');
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
  {
    // no telemóvel: um toque põe a linha; um deslize vertical sobre a fotografia mexe a página e não a linha; as
    // etiquetas cortam-se com a sua fotografia e, a meio, ficam afastadas da linha (a 320 e a 375 px)
    const comparador = `${srv.base}/obras/${(OBRAS.find(o => o.antesDepois) || OBRAS[0]).slug}.html`;
    for (const largura of [320, 375]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 740 }, isMobile: true, hasTouch: true });
      await page.goto(comparador, { waitUntil: 'networkidle' });
      await page.evaluate(() => { const s = document.querySelector('[data-ba]'); scrollTo(0, s.getBoundingClientRect().top + scrollY - 100); });
      await page.waitForTimeout(300);
      const caixa = () => page.evaluate(() => { const r = document.querySelector('[data-ba]').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      let s = await caixa();
      await page.touchscreen.tap(s.x + s.w * 0.2, s.y + s.h / 2);
      await page.waitForTimeout(150);
      ok(await page.inputValue('[data-ba-range]') === '20', `I: a ${largura} px um toque na fotografia põe a linha nesse sítio`, await page.inputValue('[data-ba-range]'));
      const y0 = await page.evaluate(() => scrollY);
      const cdp = await ctx.newCDPSession(page);
      const tx = Math.round(s.x + s.w * 0.7), ty = Math.round(s.y + s.h * 0.6);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty }] });
      for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx, y: ty - i * 20 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(400);
      ok(await page.inputValue('[data-ba-range]') === '20' && await page.evaluate(() => scrollY) > y0 + 50, `I: a ${largura} px um deslize vertical mexe a página, não a linha`, { v: await page.inputValue('[data-ba-range]'), y0, y: await page.evaluate(() => scrollY) });
      const tags = [];
      for (const v of ['20', '50', '85']) {
        await page.locator('[data-ba-range]').fill(v);
        tags.push(await page.evaluate(v => {
          const b = document.querySelector('[data-ba-before]'), tb = document.querySelector('.tag-before'), ta = document.querySelector('.tag-after'), h = document.querySelector('[data-ba-handle]').getBoundingClientRect();
          const linha = h.left + h.width / 2, rb = tb.getBoundingClientRect(), ra = ta.getBoundingClientRect();
          return { v, linha: Math.round(linha), antesVis: Math.round(Math.min(rb.right, b.getBoundingClientRect().right)), depoisVis: Math.round(Math.max(ra.left, linha)), antes: Math.round(rb.right), depois: Math.round(ra.left),
            recorta: b.contains(tb) && getComputedStyle(b).overflow === 'hidden', tapa: Number(getComputedStyle(ta).zIndex) < Number(getComputedStyle(b).zIndex) };
        }, v));
      }
      ok(tags.every(g => g.recorta && g.tapa && g.antesVis <= g.linha + 2 && g.depoisVis >= g.linha - 2), `I: a ${largura} px cada etiqueta só se vê na sua metade (a 20, 50 e 85%)`, tags);
      const meio = tags.find(g => g.v === '50');
      ok(meio.antes <= meio.linha - 6 && meio.depois >= meio.linha + 6, `I: a ${largura} px a meio, as etiquetas ficam afastadas da linha`, meio);
      ok(page.erros.length === 0, `I: a ${largura} px sem erros`, page.erros);
      await ctx.close();
    }
  }

  /* J. teclado, entrada ao fazer scroll, imagens, menu atual */
  {
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    ok(await page.evaluate(() => document.activeElement.className === 'skip'), 'J: a primeira tabulação é «Saltar para o conteúdo»');
    ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor) === 'rgb(18, 57, 43)', 'J: o anel do «Saltar» é ink, sobre o cabeçalho paper (o amber ficava a 2,2:1)');
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
      // o texto do painel vermelho: a superfície mais próxima é o clay (o painel vive numa secção paper ou bone)
      const noVermelho = e => { const s = e.closest('.s-paper, .s-bone, .s-ink, .s-clay'); return s && s.classList.contains('s-clay'); };
      const alvos = [...document.querySelectorAll('.btn'), ...Array.from(document.querySelectorAll('.s-clay *')).filter(e => comTexto(e) && noVermelho(e) && !e.closest('.so-leitor'))];
      return alvos.filter(e => e.getClientRects().length).map(e => ({ t: e.textContent.trim().slice(0, 30), c: Math.round(razao(e) * 100) / 100, painel: !!e.closest('.cta-painel') }));
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
      const medidos = await page.evaluate(contrastes), fracos = medidos.filter(c => c.c < 4.5);
      ok(fracos.length === 0, `L: ${f} botões e painel clay com 4,5:1 ou mais`, fracos);
      // o texto do painel vermelho conta mesmo dentro de uma secção paper (obras.html e as fichas) ou bone (a inicial)
      const doPainel = medidos.filter(c => c.painel && !c.t.startsWith('Pedir Orçamento') && !/WhatsApp$/.test(c.t)).map(c => c.t);
      if (await page.$('.cta-painel')) ok(['Vamos conversar', 'Ligar 961 245 288', SITE.provas[0]].every(t => doPainel.includes(t)) && doPainel.length >= 6, `L: ${f} o texto do painel vermelho medido`, doPainel);
    }
    {
      // a barra de ações (só abaixo de 980 px): Ligar e WhatsApp bone sobre ink, Orçamento branco sobre clay (vermelho)
      const m = await pagina({ viewport: { width: 390, height: 800 } });
      await m.page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
      const cels = await m.page.evaluate(contrastes.toString().replace("[...document.querySelectorAll('.btn'),", "[...document.querySelectorAll('.btn, .barra-cel'),").replace(/^\(\) =>/, '(() =>') + ')()');
      const barra = cels.filter(c => /^(Ligar|WhatsApp|Orçamento)$/.test(c.t));
      ok(barra.length === 3 && barra.every(c => c.c >= 4.5), 'L: a barra de ações com 4,5:1 ou mais', barra);
      await m.ctx.close();
    }
    // o anel de foco: ink sobre paper (hero), amber sobre ink (obras) e branco sobre clay (a faixa de contacto vermelha)
    await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
    const anel = async sel => { await page.focus(sel); return page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.outlineColor; }); };
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    ok(await anel('.hero .acoes .btn') === 'solid 3px rgb(18, 57, 43)', 'L: foco ink no hero (paper)', await anel('.hero .acoes .btn'));
    ok(await anel('#obras .obras-mais .btn') === 'solid 3px rgb(255, 138, 122)', 'L: foco amber nas obras (ink)', await anel('#obras .obras-mais .btn'));
    ok(await anel('#contacto .cta-phone') === 'solid 3px rgb(255, 255, 255)', 'L: foco branco na faixa clay (vermelha)', await anel('#contacto .cta-phone'));
    ok(await anel('#contacto .btn:not(.btn-ghost)') === 'solid 3px rgb(255, 255, 255)', 'L: foco branco no botão da faixa clay', await anel('#contacto .btn:not(.btn-ghost)'));
    // no painel vermelho (numa secção bone, a continuar o Porquê Nós): o botão paper com texto ink, o ghost com texto e
    // contorno brancos, o texto branco (5,9:1)
    const faixa = await page.evaluate(() => {
      const c = s => getComputedStyle(document.querySelector(s)), b = c('#contacto .btn:not(.btn-ghost)'), g = c('#contacto .btn-ghost');
      return { sec: c('#contacto').backgroundColor, fundo: c('#contacto .cta-painel').backgroundColor, h2: c('#contacto h2').color, btn: [b.backgroundColor, b.color], ghost: [g.backgroundColor, g.color, g.boxShadow] };
    });
    ok(faixa.sec === 'rgb(237, 242, 236)' && faixa.fundo === 'rgb(200, 16, 46)' && faixa.h2 === 'rgb(255, 255, 255)' && faixa.btn[0] === 'rgb(247, 249, 245)' && faixa.btn[1] === 'rgb(18, 57, 43)'
      && faixa.ghost[0] === 'rgba(0, 0, 0, 0)' && faixa.ghost[1] === 'rgb(255, 255, 255)' && faixa.ghost[2].startsWith('rgb(255, 255, 255) 0px 0px 0px 1.5px inset'), 'L: o painel vermelho (na secção bone) com texto branco, o botão paper com texto ink e o ghost com contorno branco', faixa);
    // com o rato, o botão do painel fica branco com texto clay-deep (8:1), nunca o bloco ink (verde) sobre o vermelho, e o
    // ghost branco com texto clay
    const hover = async sel => { await page.hover(sel); await page.waitForTimeout(400); return page.evaluate(s => { const b = getComputedStyle(document.querySelector(s)); return [b.backgroundColor, b.color]; }, sel); };
    const hb = await hover('#contacto .btn:not(.btn-ghost)'), hg = await hover('#contacto .btn-ghost');
    await page.mouse.move(0, 0);
    ok(hb[0] === 'rgb(255, 255, 255)' && hb[1] === 'rgb(155, 13, 36)' && hg[0] === 'rgb(255, 255, 255)' && hg[1] === 'rgb(200, 16, 46)', 'L: com o rato, os botões do painel vermelho ficam brancos com texto vermelho (sem verde no vermelho)', { hb, hg });
    const btn = await page.evaluate(() => { const b = getComputedStyle(document.querySelector('.hero .btn')), g = document.querySelector('.hero .btn-ghost'); return { bg: b.backgroundColor, cor: b.color, alturas: [document.querySelector('.hero .btn').offsetHeight, g.offsetHeight] }; });
    ok(btn.bg === 'rgb(200, 16, 46)' && btn.cor === 'rgb(255, 255, 255)' && btn.alturas[0] === btn.alturas[1], 'L: «Pedir Orçamento» branco sobre clay (vermelho) e o ghost com a mesma altura', btn);
    // o cartão de obra: o anel desenha-se por fora, na cor da superfície à volta (amber no ink, ink no bone e no paper)
    const anelCartao = async (sel) => { await page.focus(sel); return page.evaluate(s => { const c = document.querySelector(s).closest('.pg'), st = getComputedStyle(c); return st.outlineStyle + ' ' + st.outlineWidth + ' ' + st.outlineColor; }, sel); };
    ok(await anelCartao('#obras .pg h3 a') === 'solid 3px rgb(255, 138, 122)', 'L: foco amber no cartão de obra sobre ink', await anelCartao('#obras .pg h3 a'));
    await page.goto(`${srv.base}/obras/${OBRAS[0].slug}.html`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    ok(await anelCartao('.obra-rel .pg h3 a') === 'solid 3px rgb(18, 57, 43)', 'L: foco ink no cartão de obra sobre bone («Outras obras»)', await anelCartao('.obra-rel .pg h3 a'));
    await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    ok(await anelCartao('section.s-bone .pg h3 a') === 'solid 3px rgb(18, 57, 43)', 'L: foco ink no cartão de obra num grupo bone de obras.html', await anelCartao('section.s-bone .pg h3 a'));
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
        // obras.html não repete o nome do serviço em cada cartão (o h2 do grupo já o diz): sem .cat, cat é null
        const cat = f.querySelector('.cat');
        return { cat: cat ? t(cat) : null, titulo: t(f.querySelector('h2, h3')), alfa: fa.a };
      });
    };
    for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`]) {
      await page.goto(srv.base + f, { waitUntil: 'networkidle' });
      const l = await page.evaluate(legendas);
      const comCat = f !== '/obras.html';
      ok(l.length > 0 && l.every(c => (comCat ? c.cat >= 4.5 : c.cat === null) && c.titulo >= 4.5), `L: ${f} .cat e título dos cartões com 4,5:1 ou mais sobre uma fotografia branca${comCat ? '' : ' (sem .cat: o h2 do grupo diz o serviço)'}`, l);
      // a ligação do título cobre o cartão inteiro (também a fotografia, em cima); em repouso, com rato, «Ver obra» não
      // ocupa lugar na faixa (a faixa acaba o padding abaixo do título), e a faixa cobre menos de 60% do cartão
      const c = await page.evaluate(() => Array.from(document.querySelectorAll('.pg')).map(c => {
        const r = c.getBoundingClientRect(), a = c.querySelector('figcaption a'), fc = c.querySelector('figcaption').getBoundingClientRect(), h = c.querySelector('h2, h3').getBoundingClientRect();
        scrollTo(0, r.top + scrollY - 200);
        const q = c.getBoundingClientRect(), el = document.elementFromPoint(q.left + q.width / 2, q.top + 12);
        return { topoLiga: !!el && el.closest('a') === a, folga: Math.round(fc.bottom - h.bottom), pad: Math.round(parseFloat(getComputedStyle(c.querySelector('figcaption')).paddingBottom)), banda: Math.round((r.bottom - fc.top) / r.height * 100) };
      }));
      ok(c.length > 0 && c.every(x => x.topoLiga && x.folga === x.pad && x.banda < 60), `L: ${f} a 1280 px o cartão inteiro é a ligação, sem espaço vazio por baixo do título, e a faixa abaixo de 60% do cartão`, c);
    }
    {
      // no telemóvel (até 640 px), nas obras e nas outras obras de cada ficha, a legenda passa para baixo da fotografia,
      // numa moldura 4/3 (deitada) ou 4/5 (ao alto); as obras em destaque da página inicial ficam com o cartão de 280 px e
      // a legenda por cima, encostada ao fundo. O contraste é o mesmo no pior caso
      const m = await pagina({ viewport: { width: 390, height: 800 } });
      for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`]) {
        await m.page.goto(srv.base + f, { waitUntil: 'networkidle' });
        const l = await m.page.evaluate(legendas);
        ok(l.length > 0 && l.every(c => (c.cat === null || c.cat >= 4.5) && c.titulo >= 4.5), `L: a 390 px ${f} .cat e título dos cartões com 4,5:1 ou mais sobre uma fotografia branca`, l);
        const cartoes = await m.page.evaluate(() => Array.from(document.querySelectorAll('.pg')).map(c => {
          const r = c.getBoundingClientRect(), fo = c.querySelector('.foto').getBoundingClientRect(), le = c.querySelector('figcaption').getBoundingClientRect();
          const prop = c.dataset.orient === 'portrait' ? 5 / 4 : 3 / 4;
          return { h: Math.round(r.height), cobre: Math.round(fo.height) === Math.round(r.height) && Math.round(fo.top) === Math.round(r.top) && le.top > r.top,
            baixo: Math.round(fo.top) === Math.round(r.top) && Math.abs(fo.height - fo.width * prop) < 1.5 && le.top >= fo.bottom - 1,
            fundo: Math.round(le.bottom) === Math.round(r.bottom) };
        }));
        const destaques = f === '/';
        ok(cartoes.length > 0 && cartoes.every(c => c.fundo && (destaques ? c.h === 280 && c.cobre : c.baixo)), `L: a 390 px ${f} ${destaques ? 'os cartões com a legenda sobre a fotografia, 280 px' : 'a legenda por baixo da fotografia, em 4/3 ou 4/5'}`, cartoes);
      }
      await m.ctx.close();
    }
    {
      // com o texto maior sem zoom (letra de 32 px: «zoom só do texto»), as linhas da grelha crescem e nenhuma legenda
      // fica cortada no topo do cartão
      for (const largura of [390, 1280]) {
        const m = await pagina({ viewport: { width: largura, height: 900 } });
        const cdp = await m.ctx.newCDPSession(m.page);
        await cdp.send('Page.enable');
        await cdp.send('Page.setFontSizes', { fontSizes: { standard: 32, fixed: 26 } });
        for (const f of ['/', '/obras.html']) {
          await m.page.goto(srv.base + f, { waitUntil: 'networkidle' });
          const cortes = await m.page.evaluate(() => ({ rem: parseFloat(getComputedStyle(document.documentElement).fontSize), c: Array.from(document.querySelectorAll('.pg')).map(c => Math.round(c.querySelector('figcaption').getBoundingClientRect().top - c.getBoundingClientRect().top)) }));
          ok(cortes.rem === 32 && cortes.c.every(v => v >= 0), `L: a ${largura} px ${f} com letra de 32 px nenhuma legenda é cortada`, cortes);
        }
        await m.ctx.close();
      }
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
    ok(topo.bg === 'rgb(247, 249, 245)' && topo.filtro === 'none', 'L: o cabeçalho é paper opaco por cima das obras (ink)', topo);
    await ctx.close();
  }
  {
    // o vermelho nunca encosta ao verde (uma faixa vermelha a toda a largura entre um grupo de obras ink e o rodapé ink lia-se
    // como uma bandeira): entre o painel vermelho da CtaBand e qualquer secção ink, por cima e por baixo, há pelo menos
    // 48 px de claro (a secção paper ou bone à volta), e dos lados o painel fica dentro da .wrap, a 16 px ou mais do bordo
    for (const largura of [390, 1440]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      for (const f of ['/', '/obras.html', `/obras/${OBRAS[0].slug}.html`]) {
        await page.goto(srv.base + f, { waitUntil: 'networkidle' });
        const g = await page.evaluate(() => {
          const verde = getComputedStyle(document.querySelector('.rodape')).backgroundColor, y = e => { const r = e.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY }; };
          const p = document.querySelector('.cta-painel');
          if (!p) return { painel: false };
          const pr = p.getBoundingClientRect(), py = y(p);
          const inks = Array.from(document.querySelectorAll('main > section, main > div, footer')).filter(e => getComputedStyle(e).backgroundColor === verde).map(y);
          const acima = inks.filter(r => r.bottom <= py.top + 1).map(r => py.top - r.bottom), abaixo = inks.filter(r => r.top >= py.bottom - 1).map(r => r.top - py.bottom);
          return { verde, fundo: getComputedStyle(p).backgroundColor, inks: inks.length, sobrepoe: inks.some(r => r.top < py.bottom - 1 && r.bottom > py.top + 1),
            acima: acima.length ? Math.round(Math.min(...acima)) : null, abaixo: abaixo.length ? Math.round(Math.min(...abaixo)) : null,
            esq: Math.round(pr.left), dir: Math.round(document.documentElement.clientWidth - pr.right) };
        });
        ok(g.verde === 'rgb(18, 57, 43)' && g.fundo === 'rgb(200, 16, 46)' && g.inks >= 1 && !g.sobrepoe && (g.acima === null || g.acima >= 48) && g.abaixo !== null && g.abaixo >= 48 && g.esq >= 16 && g.dir >= 16,
          `L: a ${largura} px ${f} o painel vermelho longe do verde (claro em cima, em baixo e dos lados)`, g);
      }
      await ctx.close();
    }
  }
  {
    // a altura da página inicial (Fase 7, assertiva 2): menos de 6.000 px a 390 e no máximo 4.400 a 1440 (o plano diz
    // cerca de 4.300), sem tirar nenhum facto, serviço, obra ou ação (era 8.469 e 4.955 antes do redesenho, 6.486 e
    // 4.930 antes do acerto: a legenda sobre a fotografia também no telemóvel, um passo de token a menos nas secções,
    // Porquê Nós em duas colunas, as miniaturas só onde não acrescentam linhas, «Ver as N obras» ao lado do título).
    // Mede-se o desenho: uma cópia das fontes com data/dados-melperfaz.json em branco. Os dados da Melperfaz, quando
    // chegarem, acrescentam linhas que o desenho não controla (o rodapé com email, morada, horário e mapa, a zona e a sede
    // em «Quem somos», o alvará e o seguro: cerca de 380 px a 390 e 250 a 1440 com todos), e o CI não pode ficar
    // vermelho por a Melperfaz os dar. Com os dados ainda vazios, a cópia é igual ao site.
    const vazio = path.join(tmp, 'sem-dados');
    for (const x of ['build.py', 'src', 'data', 'assets']) fs.cpSync(path.join(W, x), path.join(vazio, x), { recursive: true });
    const pd = path.join(vazio, 'data/dados-melperfaz.json'), dd = JSON.parse(fs.readFileSync(pd, 'utf8'));
    for (const [k, v] of Object.entries(dd)) if (!k.startsWith('_')) v.valor = '';
    fs.writeFileSync(pd, JSON.stringify(dd, null, 2));
    execFileSync('python3', ['build.py'], { cwd: vazio, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, MELPERFAZ_OUT: path.join(vazio, 'public') } });
    const srvVazio = await serve(path.join(vazio, 'public'));
    try {
      for (const [largura, cabe] of [[390, h => h < 6000], [1440, h => h <= 4400]]) {
        const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
        await page.goto(srvVazio.base + '/', { waitUntil: 'networkidle' });
        const h = await page.evaluate(() => document.documentElement.scrollHeight);
        ok(cabe(h), `L: a ${largura} px a página inicial (sem os dados da Melperfaz) cabe no alvo do plano (${largura === 390 ? 'menos de 6.000' : 'até 4.400'} px)`, h);
        await ctx.close();
      }
    } finally { await srvVazio.close(); }
  }
  {
    // a página inicial compacta: as miniaturas dos serviços com 64 × 64 a todas as larguras (o plano; as alturas da página
    // ficam nos alvos, mais acima), «Ver as N obras» à direita do título das obras (por baixo dos cartões até 980 px),
    // Porquê Nós com as garantias em duas colunas e a fotografia na coluna das ações da faixa clay; o número de cada
    // serviço na linha de base do título
    for (const largura of [390, 700, 1280, 1440]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
      const minis = await page.evaluate(() => Array.from(document.querySelectorAll('.svc-mini')).filter(e => e.getClientRects().length).map(e => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }));
      ok(minis.length === 3 && minis.every(m => m === '64x64'), `L: a ${largura} px as três miniaturas dos serviços com 64 × 64`, minis);
      const bases = await page.evaluate(() => Array.from(document.querySelectorAll('.svc')).map(s => {
        const marca = el => { const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'; el.prepend(m); const y = m.getBoundingClientRect().top; m.remove(); return y; };
        return Math.round((marca(s.querySelector('.svc-num')) - marca(s.querySelector('h3'))) * 10) / 10;
      }));
      ok(bases.every(v => Math.abs(v) <= 1), `L: a ${largura} px o número de cada serviço na linha de base do título`, bases);
      await page.evaluate(() => document.querySelectorAll('.reveal').forEach(e => e.classList.add('in')));
      await page.waitForTimeout(800);
      const g = await page.evaluate(() => {
        const r = s => document.querySelector(s).getBoundingClientRect();
        const btn = r('#obras .obras-mais .btn'), p = r('#obras .sec-head p'), grelha = r('#obras .photo-grid'), wrap = document.querySelector('#obras .wrap'), dentro = wrap.getBoundingClientRect().right - parseFloat(getComputedStyle(wrap).paddingRight);
        const lis = Array.from(document.querySelectorAll('.trust-list li')).map(li => li.getBoundingClientRect());
        const foto = document.querySelector('.trust-foto'), fr = foto.getBoundingClientRect(), acoes = r('#contacto .cta-acoes'), painel = r('#contacto .cta-painel');
        const cw = document.querySelector('#contacto .wrap'), cr = cw.getBoundingClientRect(), cs = getComputedStyle(cw), logo = r('.topo .logo');
        return { btnBase: Math.round(btn.bottom - p.bottom), btnDir: Math.round(dentro - btn.right), btnAbaixo: btn.top > grelha.bottom,
          colunas: new Set(lis.map(l => Math.round(l.left))).size, foto: foto.getClientRects().length > 0, fotoDir: Math.round(fr.right - painel.right), fotoW: Math.round(fr.width - acoes.width),
          painelX: Math.round(painel.left - logo.left), painelDir: Math.round(cr.right - parseFloat(cs.paddingRight) - painel.right) };
      });
      if (largura > 980) ok(Math.abs(g.btnBase) <= 1 && Math.abs(g.btnDir) <= 1 && !g.btnAbaixo, `L: a ${largura} px «Ver as N obras» à direita do título, pela base do texto`, g);
      else ok(g.btnAbaixo, `L: a ${largura} px «Ver as N obras» por baixo dos cartões`, g);
      ok(g.colunas === (largura > 640 ? 2 : 1), `L: a ${largura} px as garantias em ${largura > 640 ? 'duas colunas' : 'uma coluna'}`, g);
      // o painel vermelho ocupa a .wrap (a mesma margem esquerda do logótipo, e a direita da .wrap); a fotografia do Porquê
      // Nós acaba no mesmo x do painel e tem a largura da coluna das ações dele
      ok(g.painelX === 0 && g.painelDir === 0, `L: a ${largura} px o painel vermelho com os bordos da .wrap`, g);
      if (largura > 980) ok(g.foto && g.fotoDir === 0 && g.fotoW === 0, `L: a ${largura} px a fotografia do Porquê Nós acaba no bordo do painel vermelho, com a largura da coluna das ações`, g);
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
  {
    // os títulos sem uma palavra sozinha na última linha (text-wrap: balance), a 768, 1024 e 1440 px
    const ultimas = () => Array.from(document.querySelectorAll('main h1, main h2')).filter(h => h.getClientRects().length && !h.closest('.pg')).map(h => {
      const palavras = [], w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) for (const m of n.textContent.matchAll(/\S+/g)) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); palavras.push(Math.round(r.getBoundingClientRect().top)); }
      const ultima = Math.max(...palavras);
      return { t: h.textContent.trim().slice(0, 40), linhas: new Set(palavras).size, ultima: palavras.filter(y => Math.abs(y - ultima) < 4).length };
    });
    for (const largura of [768, 1024, 1440]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      const soltas = [];
      for (const f of ['/', '/obras.html', '/obrigado.html', ...OBRAS.map(o => `/obras/${o.slug}.html`)]) {
        await page.goto(srv.base + f, { waitUntil: 'networkidle' });
        soltas.push(...(await page.evaluate(ultimas)).filter(h => h.linhas > 1 && h.ultima < 2).map(h => ({ f, ...h })));
      }
      ok(soltas.length === 0, `L: a ${largura} px nenhum título com uma palavra sozinha na última linha`, soltas);
      await ctx.close();
    }
  }
  {
    // no telemóvel o cartão «25 anos» sobe para o canto de cima da fotografia e encolhe (em baixo tapava a carrinha);
    // acima de 640 px fica em baixo, à esquerda
    for (const largura of [320, 375, 1280]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 800 } });
      await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
      const c = await page.evaluate(() => { const f = document.querySelector('.hero-moldura .frame').getBoundingClientRect(), c = document.querySelector('.tag-card').getBoundingClientRect();
        return { topo: Math.round(c.top - f.top), fundo: Math.round(f.bottom - c.bottom), esq: Math.round(c.left - f.left), area: Math.round(c.width * c.height / (f.width * f.height) * 100) }; });
      ok(c.esq === 0 && (largura > 640 ? c.fundo === 0 : c.topo === 0 && c.area <= 22), `L: a ${largura} px o cartão «25 anos» ${largura > 640 ? 'em baixo' : 'no canto de cima, pequeno'}`, c);
      await ctx.close();
    }
  }
  {
    // os botões de um grupo com a mesma altura no telemóvel (mesmo quando um rótulo parte), e os rótulos longos numa linha
    // a partir de 360 px: o envio do pedido e, a 1024, o da lateral de orcamento.html
    const grupos = () => Array.from(document.querySelectorAll('main .acoes')).filter(a => a.getClientRects().length && a.querySelectorAll('.btn').length > 1).map(a => Array.from(a.querySelectorAll('.btn')).map(b => Math.round(b.getBoundingClientRect().height)));
    for (const largura of [320, 360, 375]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 800 } });
      for (const f of ['/', '/obrigado.html', `/obras/${OBRAS[0].slug}.html`]) {
        await page.goto(srv.base + f, { waitUntil: 'networkidle' });
        const g = await page.evaluate(grupos);
        ok(g.length > 0 && g.every(x => new Set(x).size === 1), `L: a ${largura} px ${f} os botões de cada grupo com a mesma altura`, g);
      }
      await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
      const envio = await page.evaluate(() => Math.round(document.querySelector('#sendBtn').getBoundingClientRect().height));
      if (largura >= 360) ok(envio === 48, `L: a ${largura} px «Enviar pedido de orçamento» numa linha`, envio);
      await ctx.close();
    }
    const { ctx, page } = await pagina({ viewport: { width: 1024, height: 800 } });
    await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
    ok(await page.evaluate(() => Math.round(document.querySelector('.orc-lateral .btn').getBoundingClientRect().height)) === 48, 'L: a 1024 px «Enviar fotografias por WhatsApp» da lateral numa linha');
    await ctx.close();
  }
  {
    // o PageHead das fichas começa à mesma altura que o das outras páginas (o eyebrow com ligação não engorda: o alvo de
    // 44 px desenha-se por fora); o de orcamento.html é compacto também no telemóvel; o telefone grande com 44 px
    for (const largura of [390, 1440]) {
      const { ctx, page } = await pagina({ viewport: { width: largura, height: 900 } });
      const h1 = async f => { await page.goto(srv.base + f, { waitUntil: 'networkidle' }); return page.evaluate(() => Math.round(document.querySelector('h1').getBoundingClientRect().top + scrollY)); };
      const ref = await h1('/obras.html'), fundo = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.page-head')).paddingBottom));
      const ficha = await h1(`/obras/${OBRAS[0].slug}.html`);
      const alvo = await page.evaluate(() => { const a = document.querySelector('.page-head .eyebrow a'), r = a.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return [-21, 0, 21].every(d => { const e = document.elementFromPoint(x, y + d); return e && (e === a || a.contains(e)); }); });
      ok(ficha === ref && alvo, `L: a ${largura} px o h1 das fichas à altura do de obras.html, com 44 px de alvo no eyebrow`, { ref, ficha, alvo });
      await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
      const compacto = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.page-head')).paddingBottom));
      ok(compacto < fundo, `L: a ${largura} px o PageHead de orcamento.html mais compacto do que o de obras.html`, { compacto, fundo });
      const tel = await page.evaluate(() => Math.round(document.querySelector('.cta-phone').getBoundingClientRect().height));
      await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
      const telCasa = await page.evaluate(() => Math.round(document.querySelector('#contacto .cta-phone').getBoundingClientRect().height));
      ok(tel >= 44 && telCasa >= 44, `L: a ${largura} px o telefone grande com 44 px ou mais`, { tel, telCasa });
      await ctx.close();
    }
  }
  {
    // a página atual no menu: o traço com 3:1 ou mais sobre o paper (clay-deep); em contraste forçado os botões têm borda
    const { ctx, page } = await pagina();
    await page.goto(srv.base + '/obras.html', { waitUntil: 'networkidle' });
    const traco = await page.evaluate(() => getComputedStyle(document.querySelector('.navlinks a[aria-current="page"]'), '::after').backgroundColor);
    ok(traco === 'rgb(155, 13, 36)', 'L: o traço da página atual no menu em clay-deep (8:1 sobre paper)', traco);
    await page.emulateMedia({ forcedColors: 'active' });
    const bordas = await page.evaluate(() => Array.from(document.querySelectorAll('.btn, .topo-wa')).filter(e => e.getClientRects().length).map(e => getComputedStyle(e).borderTopStyle));
    ok(bordas.length > 1 && bordas.every(b => b === 'solid'), 'L: em contraste forçado os botões e o WhatsApp do cabeçalho com borda', bordas);
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
    {
      // num telemóvel de 3x pede-se a imagem de 2x da largura do telemóvel: a do hero é a mesma que num de 2x (a de 800),
      // e a de orcamento.html não é a maior
      const srcs = {};
      for (const dpr of [2, 3]) {
        const { ctx, page } = await pagina({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true });
        await page.goto(srv.base + '/', { waitUntil: 'networkidle' });
        srcs['hero' + dpr] = await page.evaluate(() => document.querySelector('.hero-photo img').currentSrc.split('/').pop());
        await page.goto(srv.base + '/orcamento.html', { waitUntil: 'networkidle' });
        await page.locator('.orc-foto').scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        srcs['orc' + dpr] = await page.evaluate(() => document.querySelector('.orc-foto img').currentSrc.split('/').pop());
        await ctx.close();
      }
      ok(srcs.hero3 === 'foto-01-800.avif' && srcs.hero3 === srcs.hero2 && !/1440|1080/.test(srcs.orc3), 'M: a 390 px e 3x as fotografias de 2x da largura do telemóvel', srcs);
    }
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
