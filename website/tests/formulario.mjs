/* O formulário de pedido antes do lançamento (as falhas que os testes de clientes simulados encontraram, PROMPT-LANCAMENTO.md):
   - o preço provável que segue no pedido é só o que o cliente viu: depois de «Retirar» a estimativa, o preço sai com ela;
     sem serviço escolhido, o preço que só se calcularia ao enviar não segue;
   - uma divisão com a área errada para o «Juntar ao pedido» e o envio (não fica de fora sem aviso); a área aceita a unidade
     no fim («8 m», «20 metros») e os milhares à portuguesa («2.500» = 2 500 m²);
   - o painel «Pedido enviado» mostra o telefone como o cliente o conhece (00351, +351, número estrangeiro);
   - no telemóvel nada faz a página deslizar para o lado (nome de fotografia ou email comprido, obras.html a 320 px);
   - acessibilidade: «Retirar» com outro serviço escolhido leva o foco ao serviço e o aviso ouve-se; o aviso de falha
     ouve-se pela região que existe sempre; o preço anunciado diz «a confirmar na visita»; o Tab num diapositivo do carrossel
     fora do ecrã leva-o à vista; o foco da fotografia vê-se com as cores forçadas; sem JavaScript, o telefone é obrigatório;
   - pelo Google, o mesmo pedido enviado outra vez («Tentar novamente») leva o mesmo identificador; um pedido mudado, outro.
   Gera o site em pastas temporárias (MDM_OUT) com a tabela de teste (MDM_PRECOS_FICHEIRO=data/precos-teste.json), sem tocar
   em data/precos.json, e apaga-as no fim. Precisa do Playwright, fora das dependências. Uso, a partir de website/:
     NODE_PATH=/caminho/para/node_modules node tests/formulario.mjs */
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-formulario-'));
const servidores = [];
const limpa = () => { servidores.forEach((s) => s.close()); fs.rmSync(tmp, { recursive: true, force: true }); };
for (const [sinal, rc] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(sinal, () => { limpa(); process.exit(rc); });
const TESTE = path.join(W, 'data/precos-teste.json');
const original = fs.readFileSync(path.join(W, 'data/precos.json'));

let falhas = 0, oks = 0;
const ok = (c, m, x) => { if (c) oks++; else { falhas++; console.log('FALHA ' + m, x === undefined ? '' : JSON.stringify(x).slice(0, 600)); } };
const AC = 'Ar condicionado: montagem / instalação', AVARIA = 'Ar condicionado: avaria / reparação';
const nb = (t) => String(t || '').replace(/[  ]/g, ' ');

/* multipart → { campo: valor } */
function campos(corpo, tipo) {
  const m = /boundary=([^;]+)/.exec(tipo), out = {};
  if (!m) return out;
  for (const p of corpo.toString('latin1').split('--' + m[1])) {
    const c = /name="([^"]+)"(?:; filename="([^"]*)")?\r\n(?:Content-Type: [^\r]+\r\n)?\r\n([\s\S]*)\r\n$/.exec(p);
    if (c) out[c[1]] = c[2] !== undefined ? `[ficheiro ${c[2]}]` : Buffer.from(c[3], 'latin1').toString('utf8');
  }
  return out;
}
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const envios = []; let falhar = false;
const estatico = (raiz) => http.createServer((req, res) => {
  if (req.method === 'POST') {
    const partes = []; req.on('data', (c) => partes.push(c));
    req.on('end', () => { envios.push(campos(Buffer.concat(partes), req.headers['content-type'] || '')); res.writeHead(falhar ? 500 : 200); res.end(); });
    return;
  }
  let f = path.join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
const ouve = (s) => new Promise((r) => { servidores.push(s); s.listen(0, '127.0.0.1', r); });

try {
  const PUB = path.join(tmp, 'teste');
  execFileSync('python3', ['build.py'], { cwd: W, stdio: 'ignore', env: { ...process.env, MDM_OUT: PUB, MDM_PRECOS_FICHEIRO: TESTE } });
  const sitio = estatico(PUB); await ouve(sitio);
  const B = `http://127.0.0.1:${sitio.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  async function nova(url, { largura = 1280, js = true, cores = undefined } = {}) {
    const telemovel = largura < 640;
    const ctx = await browser.newContext({ viewport: { width: largura, height: telemovel ? 740 : 900 }, isMobile: telemovel, hasTouch: telemovel,
      javaScriptEnabled: js, forcedColors: cores });
    await ctx.route(/posthog/, (r) => r.abort());
    await ctx.addInitScript(() => { try { localStorage.setItem('mdm-estatisticas', 'nao'); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { falhas++; console.log('erro JS', e.message); });
    await page.goto((url.startsWith('http') ? '' : B) + url);
    return page;
  }
  const abreCalc = (page) => page.evaluate(() => { document.getElementById('potencia').open = true; });
  async function divisao(page, j, tipo, area) {
    if ((await page.$$eval('[data-pot-divs] [data-pot-linha]', (x) => x.length)) <= j) await page.click('[data-pot-adiciona]');
    const l = page.locator('[data-pot-divs] [data-pot-linha]').nth(j);
    await l.locator('[data-pot="tipo"]').selectOption(tipo);
    await l.locator('[data-pot="area"]').fill(area);
    await l.locator('[data-pot="area"]').dispatchEvent('change');
  }
  const campo = (page, sel) => page.$eval(sel, (x) => x.value);
  async function envia(page, { nome = 'Cliente de teste', email = '', tel = '912 345 678' } = {}) {
    await page.fill('#qNome', nome); await page.fill('#qEmail', email); await page.fill('#qTel', tel);
    const antes = envios.length;
    await page.click('#sendEmail');
    await page.waitForFunction(() => !document.querySelector('[data-form-feito]').hidden || document.getElementById('quoteAlert').textContent.trim() !== '', null, { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(150);
    return envios.length > antes ? envios.at(-1) : null;
  }

  // 1. «Retirar» tira também o preço; «Juntar ao pedido» trá-lo de volta
  let page = await nova('/index.html#orcamento', { largura: 375 });
  await page.selectOption('#qServico', AC); await abreCalc(page);
  await divisao(page, 0, 'Sala', '20'); await divisao(page, 1, 'Quarto', '12');
  await page.click('[data-pot-juntar]');
  const comPreco = await campo(page, '[data-estimativa-campo]');
  await page.click('[data-pot-retirar]');
  const depoisRetirar = { pot: await campo(page, '[data-potencia-campo]'), est: await campo(page, '[data-estimativa-campo]'), res: nb(await page.textContent('[data-preco-res]')) };
  ok(/Preço provável mostrado/.test(comPreco) && !depoisRetirar.pot && !depoisRetirar.est && /Tirou a estimativa do pedido/.test(depoisRetirar.res),
    '1: depois de «Retirar», o preço provável sai com a estimativa (nada segue sem as divisões)', { comPreco, depoisRetirar });
  let e = await envia(page);
  ok(e && !e.potencia && !e.estimativa, '1: o pedido enviado depois de «Retirar» não leva potência nem preço', e && [e.potencia, e.estimativa]);
  page = await nova('/index.html#orcamento');
  await page.selectOption('#qServico', AC); await abreCalc(page); await divisao(page, 0, 'Sala', '20');
  await page.click('[data-pot-juntar]'); await page.click('[data-pot-retirar]'); await page.click('[data-pot-juntar]');
  ok(/Preço provável mostrado/.test(await campo(page, '[data-estimativa-campo]')) && !!(await campo(page, '[data-potencia-campo]')),
    '1: «Juntar ao pedido» depois de «Retirar» traz a potência e o preço de volta');
  await page.context().close();

  // 2. só segue o preço que o cliente viu
  page = await nova('/index.html#orcamento', { largura: 375 });
  await abreCalc(page); await divisao(page, 0, 'Sala', '20');
  const visivelAntes = await page.$eval('[data-preco]', (x) => !x.hidden);
  e = await envia(page);
  ok(!visivelAntes && e && e.servico === AC && /Sala 20 m²/.test(nb(e.potencia)) && !e.estimativa,
    '2: sem serviço escolhido, o preço que só se calcularia ao enviar não segue (a potência sim)', e && [visivelAntes, e.servico, e.potencia, e.estimativa]);
  page = await nova('/index.html#orcamento');
  await page.selectOption('#qServico', AC); await abreCalc(page); await divisao(page, 0, 'Sala', '20');
  e = await envia(page);
  ok(e && /Preço provável mostrado/.test(e.estimativa) && /Sala 20 m²/.test(nb(e.potencia)),
    '2: com o preço à vista (serviço escolhido), a estimativa junta-se sozinha e o preço segue', e && [e.potencia, e.estimativa]);
  await page.context().close();

  // 3. uma divisão com a área errada para «Juntar» e o envio, e leva lá o foco
  page = await nova('/index.html#orcamento', { largura: 375 });
  await page.selectOption('#qServico', AC); await abreCalc(page);
  await divisao(page, 0, 'Sala', '20'); await divisao(page, 1, 'Quarto', 'abc');
  await page.click('[data-pot-juntar]');
  let estado = await page.evaluate(() => ({ junta: !document.querySelector('[data-pot-junta]').hidden, foco: document.activeElement && document.activeElement.getAttribute('data-pot'),
    linha: document.activeElement && document.activeElement.closest('[data-pot-linha]') === document.querySelectorAll('[data-pot-divs] [data-pot-linha]')[1],
    invalido: document.querySelectorAll('[data-pot="area"]')[1].getAttribute('aria-invalid') }));
  ok(!estado.junta && estado.foco === 'area' && estado.linha && estado.invalido === 'true', '3: «Juntar ao pedido» com uma área errada não junta e leva o foco a essa área', estado);
  await divisao(page, 1, 'Quarto', '12'); await page.click('[data-pot-juntar]');
  await divisao(page, 1, 'Quarto', '3x4');
  const nEnvios = envios.length;
  await page.fill('#qNome', 'Cliente'); await page.fill('#qTel', '912 345 678'); await page.click('#sendEmail'); await page.waitForTimeout(400);
  estado = await page.evaluate(() => ({ foco: document.activeElement && document.activeElement.getAttribute('data-pot'), feito: !document.querySelector('[data-form-feito]').hidden }));
  ok(envios.length === nEnvios && estado.foco === 'area' && !estado.feito, '3: com a estimativa junta e uma área errada, o envio para na área (não segue sem essa divisão)', estado);
  await page.context().close();

  // 4. a área: a unidade no fim e os milhares à portuguesa
  page = await nova('/index.html#orcamento');
  await page.selectOption('#qServico', AC); await abreCalc(page);
  await divisao(page, 0, 'Quarto', '8 m'); await divisao(page, 1, 'Sala', '20 metros'); await divisao(page, 2, 'Outra divisão', '2.500');
  await divisao(page, 3, 'Escritório', '1 200'); await divisao(page, 4, 'Cozinha', '12,5 m²');
  await page.click('[data-pot-juntar]');
  const pot4 = nb(await campo(page, '[data-potencia-campo]'));
  ok(/Quarto 8 m²: 7 000 BTU\/h/.test(pot4) && /Sala 20 m²/.test(pot4) && /Outra divisão 2500 m²: mais de 24 000 BTU\/h, a dimensionar na visita/.test(pot4)
    && /Escritório 1200 m²: mais de/.test(pot4) && /Cozinha 12,5 m²/.test(pot4), '4: «8 m», «20 metros», «2.500», «1 200» e «12,5 m²» leem-se bem', pot4);
  await page.context().close();

  // 5. o telefone no painel «Pedido enviado»
  for (const [tel, esperado] of [['00351 913 456 789', '913 456 789'], ['00351913456789', '913 456 789'], ['+351 913 456 789', '913 456 789'],
    ['351913456789', '913 456 789'], ['+44 7911 123456', '+44 7911 123456'], ['913 456 789 / 218 935 050', '913 456 789 / 218 935 050']]) {
    page = await nova('/index.html#orcamento');
    await page.selectOption('#qServico', AVARIA);
    await envia(page, { tel });
    const txt = nb(await page.textContent('[data-feito-txt]'));
    ok(txt === `Vamos responder para ${esperado}.`, `5: telefone «${tel}» no painel`, txt);
    await page.context().close();
  }

  // 6. no telemóvel nada faz a página deslizar para o lado
  const foto = fs.readFileSync(path.join(W, 'assets/img/obras', fs.readdirSync(path.join(W, 'assets/img/obras')).find((n) => n.endsWith('-1600.jpg'))));
  const largo = (p) => p.evaluate(() => document.scrollingElement.scrollWidth - innerWidth);
  for (const largura of [320, 375]) {
    for (const js of [true, false]) {
      page = await nova('/index.html#orcamento', { largura, js });
      await page.setInputFiles('#qFoto', { name: 'Screenshot_20261011-154512_WhatsApp Gallery da Maria.jpg', mimeType: 'image/jpeg', buffer: foto });
      ok(await largo(page) === 0, `6: ${largura} px${js ? '' : ' sem JavaScript'}: um nome de fotografia comprido não alarga a página`, await largo(page));
      if (js) {
        await page.setInputFiles('#qFoto', []);
        await page.selectOption('#qServico', 'Manutenção preventiva: contrato anual');
        await envia(page, { email: 'joao.goncalves.engenharia.manutencao@empresa-exemplo.pt' });
        await page.waitForTimeout(500);
        ok(await largo(page) === 0, `6: ${largura} px: um email comprido no painel «Pedido enviado» não alarga a página`, await largo(page));
      }
      await page.context().close();
    }
    page = await nova('/obras.html', { largura });
    await page.waitForTimeout(300);
    ok(await largo(page) === 0, `6: ${largura} px: obras.html não desliza para o lado`, await largo(page));
    await page.context().close();
  }

  // 7. «Retirar» com outro serviço escolhido: o foco vai para o serviço e o aviso ouve-se
  page = await nova('/index.html#orcamento');
  await abreCalc(page); await divisao(page, 0, 'Sala', '20');
  await page.click('[data-pot-juntar]');
  await page.selectOption('#qServico', AVARIA);
  await page.click('[data-pot-retirar]');
  await page.waitForTimeout(200);
  estado = await page.evaluate(() => ({ foco: document.activeElement && document.activeElement.id, voz: document.querySelector('[data-form-voz]').textContent,
    vozVisivelAoLeitor: document.querySelector('[data-form-voz]').getAttribute('aria-live') }));
  ok(estado.foco === 'qServico' && estado.voz === 'Estimativa retirada do pedido.' && estado.vozVisivelAoLeitor === 'polite',
    '7: «Retirar» com o bloco a esconder-se leva o foco ao serviço e o aviso à região do formulário', estado);
  await page.context().close();

  // 8. o aviso de falha também se ouve (a região existe antes de a mensagem aparecer)
  page = await nova('/index.html#orcamento');
  const vozAntes = await page.$eval('[data-form-voz]', (x) => getComputedStyle(x).display !== 'none' && x.getAttribute('role') === 'status');
  falhar = true;
  await page.selectOption('#qServico', AVARIA);
  await envia(page);
  falhar = false;
  await page.waitForTimeout(200);
  estado = await page.evaluate(() => ({ alerta: document.getElementById('quoteAlert').textContent, voz: document.querySelector('[data-form-voz]').textContent }));
  ok(vozAntes && /Não conseguimos enviar o pedido agora/.test(estado.alerta) && estado.voz === estado.alerta, '8: o aviso de falha ouve-se pela região que existe sempre', estado);
  await page.context().close();

  // 9. o preço anunciado ao leitor de ecrã diz «a confirmar na visita», como o ecrã
  page = await nova('/servicos/ar-condicionado.html');
  await page.selectOption('#qServico', AC); await abreCalc(page); await divisao(page, 0, 'Quarto', '15');
  const dist = page.locator('input[name="preco-dist"][value="mais"]');
  if (await dist.count()) {
    await dist.check({ force: true });
    await page.waitForTimeout(800);
    const anuncio = nb(await page.textContent('[data-preco-anuncio]'));
    ok(/a confirmar na visita/.test(anuncio), '9: o preço anunciado diz «a confirmar na visita»', anuncio);
  } else ok(false, '9: a tabela de teste tem a pergunta da distância');
  await page.context().close();

  // 10. o carrossel: o foco num diapositivo fora do ecrã leva-o à vista
  page = await nova('/index.html', { largura: 375 });
  const fora = await page.evaluate(() => {
    const t = document.querySelector('[data-carrossel] .carrossel-trilho'), s = document.querySelectorAll('[data-carrossel] [data-slide]')[1];
    const a = s && s.querySelector('a, button, [tabindex]');
    if (!a) return null;
    const antes = t.scrollLeft; a.focus();
    return { antes };
  });
  await page.waitForTimeout(1200);
  const vis = await page.evaluate(() => {
    const t = document.querySelector('[data-carrossel] .carrossel-trilho').getBoundingClientRect(), r = document.activeElement.getBoundingClientRect();
    return { dentro: r.left >= t.left - 1 && r.right <= t.right + 1, l: Math.round(r.left), r: Math.round(r.right), tl: Math.round(t.left), tr: Math.round(t.right) };
  });
  ok(fora && vis.dentro, '10: 375 px: o foco num diapositivo fora do ecrã do carrossel leva-o à vista', { fora, vis });
  await page.context().close();

  // 11. cores forçadas: o foco da fotografia vê-se
  page = await nova('/index.html#orcamento', { cores: 'active' });
  await page.focus('#qFoto');
  const contorno = await page.$eval('[data-ficheiro]', (x) => { const c = getComputedStyle(x); return { estilo: c.outlineStyle, largura: c.outlineWidth }; });
  ok(contorno.estilo === 'solid' && parseFloat(contorno.largura) >= 2, '11: com as cores forçadas, o campo da fotografia mostra o foco (contorno)', contorno);
  await page.context().close();

  // 12. sem JavaScript, o telefone é obrigatório (sem ele, um pedido chegava sem contacto)
  page = await nova('/index.html#orcamento', { js: false });
  let antesNoJs = envios.length;
  await page.fill('#qNome', 'Condomínio Rua Nova'); await page.fill('#qEmail', 'gestao@exemplo.pt');
  await page.click('#sendEmail'); await page.waitForTimeout(400);
  const semTel = { enviou: envios.length > antesNoJs, valido: await page.$eval('#qTel', (x) => x.validity.valid) };
  await page.fill('#qTel', '912 345 678'); antesNoJs = envios.length;
  await Promise.all([page.waitForLoadState('load'), page.click('#sendEmail')]); await page.waitForTimeout(300);
  ok(!semTel.enviou && !semTel.valido && envios.length > antesNoJs, '12: sem JavaScript, sem telefone não envia; com telefone envia', semTel);
  await page.context().close();
  page = await nova('/index.html#orcamento');
  await page.selectOption('#qServico', AVARIA);
  ok(!!(await envia(page, { email: 'so@email.pt', tel: '' })), '12: com JavaScript, basta o email (o telefone deixa de ser obrigatório)');
  await page.context().close();

  // 13. pelo Google: «Tentar novamente» manda o mesmo identificador; um pedido mudado leva outro
  const corpos = []; let modo = 'rede';
  const conteudo = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end('{"ok":true,"ref":"teste"}'); });
  await ouve(conteudo);
  const apps = http.createServer((req, res) => {
    const partes = []; req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      corpos.push(JSON.parse(Buffer.concat(partes).toString('utf8')));
      if (modo === 'rede') { req.socket.destroy(); return; }
      res.writeHead(302, { location: `http://127.0.0.1:${conteudo.address().port}/macros/echo`, 'access-control-allow-origin': '*' }); res.end();
    });
  });
  await ouve(apps);
  const PUBG = path.join(tmp, 'google');
  execFileSync('python3', ['build.py'], { cwd: W, stdio: 'ignore', env: { ...process.env, MDM_OUT: PUBG, MDM_PRECOS_FICHEIRO: TESTE,
    MDM_PEDIDOS_URL: `http://127.0.0.1:${apps.address().port}/exec`, MDM_PEDIDOS_DESDE: '2026-10-11' } });
  const sitioG = estatico(PUBG); await ouve(sitioG);
  page = await nova(`http://127.0.0.1:${sitioG.address().port}/index.html#orcamento`);
  await page.selectOption('#qServico', AVARIA);
  await envia(page);
  const falhou = /Não conseguimos enviar/.test(await page.textContent('#quoteAlert'));
  await page.click('#sendEmail'); await page.waitForTimeout(800);
  await page.fill('#qMsg', 'Afinal são duas máquinas.'); await page.click('#sendEmail'); await page.waitForTimeout(800);
  modo = 'ok';
  await page.click('#sendEmail');
  await page.waitForSelector('[data-form-feito]:not([hidden])', { timeout: 5000 }).catch(() => {});
  const ids = corpos.map((c) => c.id);
  ok(falhou && ids.length === 4 && ids.every((i) => /^[A-Za-z0-9-]{8,64}$/.test(i)) && ids[0] === ids[1] && ids[1] !== ids[2] && ids[2] === ids[3],
    '13: o mesmo pedido outra vez leva o mesmo identificador; um pedido mudado leva outro', ids);
  await page.context().close();

  await browser.close();
  ok(fs.readFileSync(path.join(W, 'data/precos.json')).equals(original), 'data/precos.json ficou igual');
} finally {
  limpa();
}
console.log(`${oks} ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
