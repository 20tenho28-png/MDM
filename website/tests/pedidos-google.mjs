/* Os pedidos pelo Google de ponta a ponta (README.md, «Encaminhamento dos pedidos»; google/LEIA-ME.md): o site gerado com
   MDM_PEDIDOS_URL a apontar para um servidor local, o formulário preenchido no browser e o Apps Script VERDADEIRO
   (google/pedidos.gs) a receber cada pedido.
   O servidor serve o site gerado e, nos POST para o endereço do script, corre o doPost de google/pedidos.gs com as
   imitações da Google de tests/apps-script.mjs (MailApp, a folha, a cache do travão…) e devolve o que o ContentService do
   script deu. Como o Google, responde ao POST com um 302 para /macros/echo, que dá o JSON. É um só script para o teste
   todo (os emails, a folha e o travão acumulam), com EMAIL_COMERCIAL=comercial@teste.pt e EMAIL_GERAL=geral@teste.pt.
   Os pedidos, no browser:
     1. instalação de ar condicionado, com uma fotografia JPEG verdadeira (uma das fotografias do site) e a estimativa de
        potência;
     2. avaria de ar condicionado, com um telefone 00351…;
     3. a armadilha para robôs: no formulário (o site trava o envio) e um robô que manda o JSON do site direto ao script;
     4. um pedido com o travão do script disparado (30 pedidos em 10 minutos, google/LEIA-ME.md) e, 10 minutos depois,
        «Tentar novamente» na mesma página.
   Confirma: o email no endereço certo, o assunto = o assunto da triagem + « · » + a referência que o site recebeu,
   «responder a» = o email do cliente, o anexo com os mesmos bytes da fotografia, uma linha na folha por pedido verdadeiro
   com as colunas certas, nada da armadilha, o aviso de falha com o travão, o painel «Pedido enviado» em 1 e 2, e os
   acentos e o «ç» intactos no email e na folha.
   Precisa do Playwright, fora das dependências. Uso, a partir de website/:
     NODE_PATH=/caminho/para/node_modules node tests/pedidos-google.mjs */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregaScript } from './apps-script.mjs';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

let falhas = 0;
const ok = (c, m, x) => {
  if (c) { console.log('ok ' + m); return; }
  falhas++;
  console.log('FALHA ' + m + (x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 900)));
};
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ═══ O Apps Script verdadeiro, com as imitações da Google ═══ */
const EMAILS = { comercial: 'comercial@teste.pt', geral: 'geral@teste.pt' };
const s = carregaScript({ props: { EMAIL_COMERCIAL: EMAILS.comercial, EMAIL_GERAL: EMAILS.geral }, quota: 1500 });
/* as colunas da folha «Pedidos», como google/LEIA-ME.md as descreve */
const COLUNAS = ['Data e hora', 'Ref', 'Destino', 'Triagem', 'Serviço', 'Nome', 'Email', 'Telefone', 'Mensagem',
  'Potência', 'Estimativa', 'Página', 'Fotografia', 'Estado', 'Notas'];
/* a data e hora de Lisboa do relógio do script, como a folha a recebe («2026-10-10 14:32:05») */
const quando = (t) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(t));

/* ═══ O servidor: o site gerado e, no endereço do script, o doPost ═══ */
const SCRIPT = '/macros/s/teste/exec';
const chegadas = [];          // cada POST ao script: { tipo, corpo, resposta, mime }
const outrosPost = [];        // POST para outros caminhos (o Netlify Forms, «/»): não pode haver nenhum
const saidas = new Map();     // o que o script respondeu, à espera do GET em /macros/echo
let previos = 0, nSaidas = 0, PUB = '';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { previos++; res.writeHead(204); return res.end(); }
  if (req.method === 'POST') {
    const partes = []; req.on('data', (c) => partes.push(c));
    req.on('end', () => {
      const corpo = Buffer.concat(partes).toString('utf8');
      if (u.pathname !== SCRIPT) { outrosPost.push({ caminho: u.pathname, corpo: corpo.slice(0, 200) }); res.writeHead(200); return res.end(); }
      let saida;
      try { saida = s.responde(corpo); } catch (e) { saida = { texto: 'o doPost rebentou: ' + e.message, tipo: 'text/plain' }; }
      let resposta = null; try { resposta = JSON.parse(saida.texto); } catch { /* fica null */ }
      chegadas.push({ tipo: req.headers['content-type'] || '', corpo, resposta, mime: saida.tipo });
      const chave = 'k' + ++nSaidas; saidas.set(chave, saida);
      res.writeHead(302, { location: '/macros/echo?user_content_key=' + chave });
      res.end();
    });
    return;
  }
  if (u.pathname === '/macros/echo') {
    const saida = saidas.get(u.searchParams.get('user_content_key'));
    if (!saida) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': saida.tipo + '; charset=utf-8' });
    return res.end(saida.texto);
  }
  let f = path.join(PUB, decodeURIComponent(u.pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const B = `http://127.0.0.1:${servidor.address().port}`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-pedidos-google-'));
PUB = path.join(tmp, 'public');
let browser = null;

try {
  /* ═══ O site, gerado com o endereço deste servidor no lugar de «pedidosUrl» ═══ */
  try {
    execFileSync('python3', ['build.py'], { cwd: W, stdio: 'pipe',
      env: { ...process.env, MDM_OUT: PUB, MDM_PEDIDOS_URL: B + SCRIPT, MDM_PEDIDOS_DESDE: '2026-11-03' } });
  } catch (e) {
    throw new Error('build.py falhou: ' + String(e.stdout || '') + String(e.stderr || ''));
  }
  ok(fs.readFileSync(path.join(PUB, 'index.html'), 'utf8').includes(` data-pedidos="${B}${SCRIPT}"`),
    'o formulário gerado leva data-pedidos com o endereço do script de teste');

  browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  async function nova(url = '/') {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route((u) => !u.href.startsWith(B), (r) => r.abort());   // nada sai deste computador (PostHog, letras…)
    await ctx.addInitScript(() => { try { localStorage.setItem('mdm-estatisticas', 'nao'); } catch (e) { /* sem armazenamento */ } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { falhas++; console.log('FALHA erro JS na página: ' + e.message); });
    await page.goto(B + url);
    return page;
  }
  async function preenche(page, p) {
    await page.selectOption('#qServico', p.servico);
    await page.fill('#qNome', p.nome); await page.fill('#qEmail', p.email); await page.fill('#qTel', p.tel);
    await page.fill('#qMsg', p.msg);
    if (p.foto) await page.setInputFiles('#qFoto', p.foto);
  }
  /* carrega em «Enviar pedido» e espera pelo fim: o painel «Pedido enviado» ou um aviso, com o botão já livre */
  async function envia(page) {
    const antes = { chegadas: chegadas.length, emails: s.enviados.length, linhas: s.linhas.length };
    await page.click('#sendEmail');
    await page.waitForFunction(() => !document.getElementById('sendEmail').hasAttribute('aria-busy') &&
      (!document.querySelector('[data-form-feito]').hidden || document.getElementById('quoteAlert').textContent.trim() !== ''),
    null, { timeout: 60000 });
    const ecra = await page.evaluate(() => {
      const feito = document.querySelector('[data-form-feito]'), a = document.getElementById('quoteAlert');
      const wa = feito.querySelector('[data-feito-wa]'), txt = feito.querySelector('[data-feito-txt]');
      return { feito: !feito.hidden, formEscondido: document.getElementById('quoteForm').hidden,
        feitoTxt: txt ? txt.textContent : '', feitoWa: wa ? !wa.hidden : null,
        aviso: a.textContent, avisoTel: !!a.querySelector('a[href^="tel:"]'), avisoWa: !!a.querySelector('a[href*="wa.me"]'),
        nome: document.getElementById('qNome').value, msg: document.getElementById('qMsg').value,
        botao: document.getElementById('sendEmailLbl').textContent };
    });
    return { ecra, chegadas: chegadas.slice(antes.chegadas), emails: s.enviados.slice(antes.emails), linhas: s.linhas.slice(Math.max(antes.linhas, 1)) };
  }
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const MOJIBAKE = /Ã|Â|�/;

  /* uma fotografia JPEG verdadeira: uma das do site (assets/img), ou, se não houver, uma feita pelo browser */
  const pastaImg = path.join(W, 'assets', 'img');
  const jpgs = fs.readdirSync(pastaImg, { recursive: true }).filter((f) => /\.jpe?g$/i.test(f))
    .sort((a, b) => (/obras/.test(b) - /obras/.test(a)) || a.localeCompare(b)).map((f) => path.join(pastaImg, f))
    .filter((f) => { const b = fs.readFileSync(f); return b.length < 8e6 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff && b.at(-2) === 0xff && b.at(-1) === 0xd9; });
  let JPEG, origemJpeg;
  if (jpgs.length) { JPEG = fs.readFileSync(jpgs[0]); origemJpeg = path.relative(W, jpgs[0]); } else {
    const p = await nova('/');
    JPEG = Buffer.from(await p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 800; c.height = 600; const g = c.getContext('2d');
      for (let i = 0; i < 400; i++) { g.fillStyle = `hsl(${(i * 37) % 360},60%,${30 + (i % 40)}%)`; g.fillRect((i * 53) % 800, (i * 29) % 600, 60, 40); }
      return c.toDataURL('image/jpeg', 0.9).split(',')[1];
    }), 'base64');
    origemJpeg = 'feita pelo browser (canvas)';
    await p.context().close();
  }
  ok(JPEG[0] === 0xff && JPEG[1] === 0xd8 && JPEG[2] === 0xff && JPEG.length > 10000, `a fotografia de teste é um JPEG verdadeiro (${origemJpeg}, ${JPEG.length} bytes)`);

  const PEDIDOS = {
    instalacao: { servico: 'Ar condicionado: montagem / instalação', etiqueta: '[P1 · Montagem AC]', destino: 'comercial', formulario: 'orcamento-comercial',
      nome: 'Conceição Araújo, Lda.', email: 'conceicao.araujo@exemplo.pt', tel: '912 345 678',
      msg: 'Instalação na sala e no escritório, 3.º andar.\nAcesso fácil pela açoteia; gostaria de um orçamento.',
      foto: { name: 'instalação sala.jpg', mimeType: 'image/jpeg', buffer: JPEG }, anexo: 'instalação sala.jpg', potencia: true },
    avaria: { servico: 'Ar condicionado: avaria / reparação', etiqueta: '[P4 · Avaria AC]', destino: 'geral', formulario: 'orcamento',
      nome: 'João Gonçalves', email: 'joao.goncalves@exemplo.pt', tel: '00351 913 456 789',
      msg: 'O split da sala pinga água e faz um ruído estranho quando arranca. Não aquece.' }
  };
  const refs = {};

  /* ═══ 1 e 2: instalação com fotografia e avaria ═══ */
  for (const [chave, p] of Object.entries(PEDIDOS)) {
    const rot = `${chave === 'instalacao' ? '1' : '2'} (${p.servico})`;
    const page = await nova('/');
    await preenche(page, p);
    if (p.potencia) {   // a estimativa de potência: uma divisão de 20 m², junta sozinha ao enviar
      if (!(await page.$eval('#potencia', (d) => d.open))) await page.click('#potencia summary');
      await page.locator('[data-pot-divs] [data-pot-linha]').first().locator('[data-pot="area"]').fill('20');
    }
    const t = s.relogio.t;
    const { ecra, chegadas: ch, emails, linhas } = await envia(page);
    await page.context().close();

    ok(ch.length === 1 && ch[0].tipo === 'text/plain;charset=utf-8' && !previos, `${rot}: um só POST text/plain ao script, sem pedido prévio de CORS`,
      { n: ch.length, tipos: ch.map((c) => c.tipo), previos });
    if (!ch.length) continue;
    let enviado = null; try { enviado = JSON.parse(ch[0].corpo); } catch { /* fica null */ }
    const c = (enviado && enviado.campos) || {};
    ok(enviado && enviado.versao === 1 && enviado.destino === p.destino && enviado.formulario === p.formulario,
      `${rot}: o site envia versao 1, destino «${p.destino}», formulario «${p.formulario}»`, enviado && [enviado.versao, enviado.destino, enviado.formulario]);
    const r = ch[0].resposta || {};
    ok(r.ok === true && /^\d{6}-\d{4}-[0-9A-F]{4}$/.test(r.ref || '') && ch[0].mime === 'application/json',
      `${rot}: o script responde { ok: true, ref } em JSON`, { r, mime: ch[0].mime });
    const ref = r.ref || '?';
    refs[chave] = ref;
    const hora = quando(t);
    ok(ref.startsWith(hora.slice(2, 10).replace(/-/g, '') + '-' + hora.slice(11, 16).replace(':', '')),
      `${rot}: a referência começa pela data e hora de Lisboa do pedido (${ref})`, { ref, hora });

    // o ecrã
    ok(ecra.feito && ecra.formEscondido && ecra.feitoTxt.includes(p.email), `${rot}: o painel «Pedido enviado», com o email do cliente`, ecra);
    ok(ecra.feitoWa === (p.destino !== 'comercial'), `${rot}: painel ${p.destino === 'comercial' ? 'sem' : 'com'} «Juntar fotografias por WhatsApp»`, ecra.feitoWa);

    // o email
    const assunto = `${p.etiqueta} Pedido de orçamento, ${p.servico}`;
    const m = emails[0] || {};
    ok(emails.length === 1 && m.to === EMAILS[p.destino], `${rot}: um email, para ${EMAILS[p.destino]}`, emails.map((e) => e.to));
    ok(c.subject === assunto && m.subject === assunto + ' · ' + ref, `${rot}: o assunto é o da triagem + « · » + a referência`, { site: c.subject, email: m.subject, ref });
    ok(m.replyTo === p.email, `${rot}: «responder a» = o email do cliente`, m.replyTo);
    ok(String(m.htmlBody).includes(`<a href="mailto:${p.email}?subject=`) && String(m.body).includes('Para responder ao cliente, escreva para ' + p.email),
      `${rot}: o email mostra o endereço do cliente como ligação e diz no fim para quem escrever`);
    const anexos = m.anexos || [];
    if (p.foto) {
      ok(anexos.length === 1 && Buffer.isBuffer(anexos[0].bytes) && anexos[0].bytes.equals(JPEG) && anexos[0].tipo === 'image/jpeg' && anexos[0].nome === p.anexo,
        `${rot}: a fotografia segue em anexo com os mesmos bytes (${JPEG.length}), image/jpeg, «${p.anexo}»`,
        anexos.map((a) => [a.nome, a.tipo, a.bytes && a.bytes.length]));
      ok(String(m.body).includes(`Fotografia: ${p.anexo} (em anexo)`), `${rot}: o corpo do email diz que a fotografia vai em anexo`);
    } else ok(!anexos.length && !m.attachments, `${rot}: sem fotografia, sem anexo`, anexos.length);
    const corpo = String(m.body), html = String(m.htmlBody);
    ok(corpo.includes('Nome ou empresa: ' + p.nome) && corpo.includes('Telefone: ' + p.tel) && corpo.includes('Mensagem:\n' + p.msg) &&
       html.includes(esc(p.nome)) && html.includes(esc(p.msg).replace(/\n/g, '<br>')) && m.subject.includes('orçamento') &&
       !MOJIBAKE.test(m.subject + corpo + html),
      `${rot}: os acentos e o «ç» chegam intactos ao email (assunto, texto e HTML)`, { subject: m.subject, corpo: corpo.slice(0, 400) });
    if (p.potencia) {
      ok(/BTU\/h/.test(c.potencia || '') && corpo.includes('Potência estimada: ' + c.potencia), `${rot}: a estimativa de potência segue no pedido e no email`, c.potencia);
    }

    // a linha da folha
    const minhas = s.linhas.filter((l) => l[1] === ref);
    const l = linhas[0] || [];
    const esperado = [ref, p.destino, p.etiqueta, p.servico, p.nome, p.email, p.tel, p.msg, c.potencia || '', c.estimativa || '',
      'index.html', p.anexo || '', '', ''];
    ok(linhas.length === 1 && minhas.length === 1, `${rot}: uma linha na folha`, { novas: linhas.length, comEstaRef: minhas.length });
    ok(l[0] && typeof l[0] === 'object' && l[0].data === hora, `${rot}: «Data e hora» guardada como data (${hora})`, l[0]);
    ok(igual(l.slice(1), esperado), `${rot}: as colunas da linha (${COLUNAS.slice(1).join(', ')})`, { linha: l.slice(1), esperado });
    ok(!l.slice(1).some((v) => typeof v !== 'string' || MOJIBAKE.test(v)), `${rot}: na folha, tudo como texto e com os acentos intactos`, l);
  }
  ok(igual(s.linhas[0], COLUNAS), 'a folha «Pedidos» tem os títulos que google/LEIA-ME.md descreve', s.linhas[0]);
  ok(refs.instalacao !== refs.avaria, 'cada pedido tem a sua referência', refs);

  /* ═══ 3: a armadilha para robôs ═══ */
  {
    const antes = { chegadas: chegadas.length, emails: s.enviados.length, linhas: s.linhas.length };
    // 3a. no formulário: o site trava o envio antes de sair do browser
    const page = await nova('/');
    await preenche(page, { servico: 'Ar condicionado: avaria / reparação', nome: 'Robô Spam', email: 'robo@spam.example', tel: '912 000 000', msg: 'Compre já!' });
    await page.$eval('#qGotcha', (i) => { i.value = 'https://spam.example'; });
    const { ecra } = await envia(page);
    ok(chegadas.length === antes.chegadas && !ecra.feito && /Não foi possível validar o pedido/.test(ecra.aviso),
      '3a: armadilha preenchida no formulário: o site não envia nada e não mostra o painel', { chegadas: chegadas.length - antes.chegadas, ecra });
    // 3b. um robô que manda ao script o JSON que o site manda, com a armadilha preenchida
    const modelo = JSON.parse(chegadas.find((c) => /"destino":"geral"/.test(c.corpo)).corpo);
    const robo = { ...modelo, campos: { ...modelo.campos, nome: 'Robô Spam', email: 'robo@spam.example', mensagem: 'Compre já!', 'bot-field': 'https://spam.example' } };
    const r = await page.evaluate(async ([url, corpo]) => {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: corpo });
      return res.json();
    }, [B + SCRIPT, JSON.stringify(robo)]);
    await page.context().close();
    ok(chegadas.length === antes.chegadas + 1 && igual(r, { ok: true, ref: '' }), '3b: o robô que vai direto ao script recebe { ok: true, ref: "" } (como se tivesse corrido bem)', r);
    ok(s.enviados.length === antes.emails && s.linhas.length === antes.linhas &&
       !s.enviados.some((e) => /Robô|robo@spam/.test(e.body + e.subject)) && !s.linhas.some((l) => l.some((v) => /Robô|robo@spam/.test(String(v)))),
      '3: a armadilha não deu email nem linha na folha', { emails: s.enviados.length - antes.emails, linhas: s.linhas.length - antes.linhas });
  }

  /* ═══ 4: o travão (google/LEIA-ME.md: no máximo 30 pedidos em cada 10 minutos, contando o site inteiro) ═══ */
  {
    // uma enxurrada direta ao script até o travão disparar (1 e 2 já contaram nesta janela; a armadilha não conta)
    let aceites = 0, ultima = null;
    for (let i = 0; i < 200; i++) {
      const pedido = { versao: 1, destino: 'geral', formulario: 'orcamento', fotografia: null,
        campos: { subject: '[P5 · Outro] Pedido de orçamento, Outro / vários serviços', nome: 'Enxurrada ' + i, telefone: '912 000 ' + String(i).padStart(3, '0') } };
      const res = await fetch(B + SCRIPT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(pedido) });
      ultima = await res.json();
      if (!ultima.ok) break;
      aceites++;
    }
    ok(ultima && ultima.ok === false && /Muitos pedidos/.test(ultima.erro || ''), `4: o travão dispara (depois de ${aceites} pedidos da enxurrada)`, ultima);
    ok(aceites + 2 === 30, '4: o travão deixa passar 30 pedidos na janela de 10 minutos, como diz google/LEIA-ME.md', { aceites, comOsDoTeste: aceites + 2 });

    const p = { servico: 'Bomba de calor: avaria / reparação', nome: 'Inês Fonseca', email: 'ines.fonseca@exemplo.pt', tel: '913 222 111',
      msg: 'A bomba de calor não liga desde ontem; o visor mostra um código de erro.' };
    const page = await nova('/');
    await preenche(page, p);
    const um = await envia(page);
    const r = (um.chegadas[0] || {}).resposta || {};
    ok(um.chegadas.length === 1 && r.ok === false && /Muitos pedidos/.test(r.erro || ''), '4: o pedido do browser chega ao script e é recusado pelo travão', um.chegadas.map((c) => c.resposta));
    ok(!um.emails.length && !um.linhas.length && !s.linhas.some((l) => l[5] === p.nome), '4: com o travão, nem email nem linha na folha',
      { emails: um.emails.length, linhas: um.linhas.length });
    ok(!um.ecra.feito && !um.ecra.formEscondido && /Não conseguimos enviar o pedido agora/.test(um.ecra.aviso) && /tente de novo/.test(um.ecra.aviso) &&
       um.ecra.avisoTel && um.ecra.avisoWa && um.ecra.nome === p.nome && um.ecra.msg === p.msg && um.ecra.botao === 'Tentar novamente',
      '4: o aviso de falha (telefone e WhatsApp), sem painel, e o que se escreveu fica no formulário', um.ecra);

    // 10 minutos depois, «Tentar novamente» na mesma página: o mesmo pedido passa
    s.relogio.avanca(10 * 60 * 1000);
    const dois = await envia(page);
    await page.context().close();
    const r2 = (dois.chegadas[0] || {}).resposta || {};
    const m = dois.emails[0] || {}, l = dois.linhas[0] || [];
    ok(dois.chegadas.length === 1 && r2.ok === true && dois.ecra.feito, '4: 10 minutos depois, «Tentar novamente» envia e mostra o painel', { r2, ecra: dois.ecra });
    ok(dois.emails.length === 1 && m.to === EMAILS.geral && m.subject === `[P4 · Avaria bomba de calor] Pedido de orçamento, ${p.servico} · ${r2.ref}` && m.replyTo === p.email,
      '4: o pedido repetido chega por email ao geral, com a referência no assunto', { to: m.to, subject: m.subject, replyTo: m.replyTo });
    ok(dois.linhas.length === 1 && l[1] === r2.ref && l[5] === p.nome && l[8] === p.msg && s.linhas.filter((x) => x[5] === p.nome).length === 1,
      '4: e fica uma só linha na folha', { linhas: dois.linhas.length, l });
  }

  /* ═══ No fim ═══ */
  const pedidosVerdadeiros = s.linhas.length - 1;
  ok(s.enviados.length === pedidosVerdadeiros && new Set(s.linhas.slice(1).map((l) => l[1])).size === pedidosVerdadeiros &&
     s.enviados.every((e) => s.linhas.some((l) => e.subject.endsWith(' · ' + l[1]))),
    `uma linha e um email por pedido verdadeiro (${pedidosVerdadeiros}), cada um com a sua referência`, { emails: s.enviados.length, linhas: pedidosVerdadeiros });
  ok(!outrosPost.length, 'nenhum POST ao Netlify Forms (com «pedidosUrl», o site só envia para o script)', outrosPost);
  ok(!previos, 'nenhum pedido prévio de CORS (OPTIONS)', previos);
  const segredos = /Conceição|conceicao|João|joao\.|912 345 678|913 456 789|Inês|ines\.|Robô/;
  ok(!s.registos.some((x) => segredos.test(x.texto)), 'os registos do script não levam dados dos clientes', s.registos.filter((x) => segredos.test(x.texto)));
} catch (e) {
  falhas++;
  console.log('FALHA o teste parou: ' + (e && e.stack ? e.stack : e));
} finally {
  if (browser) await browser.close().catch(() => {});
  servidor.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(falhas ? `${falhas} falhas` : 'tudo certo');
process.exit(falhas ? 1 : 0);
