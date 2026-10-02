#!/usr/bin/env node
// Renderiza og.html (1200x630) para ../img/og-v3.jpg, a imagem Open Graph das páginas v3.
//
//   node site/v3/og/render.cjs                      # escreve site/v3/img/og-v3.jpg
//   node site/v3/og/render.cjs --preview out.png    # também grava uma pré-visualização de 600px
//
// Precisa do Playwright. Procura-o por esta ordem: $PLAYWRIGHT_PATH, require('playwright')
// a partir da pasta atual, /opt/node22/lib/node_modules/playwright. O Chromium pode ser
// indicado em $CHROMIUM_PATH (por omissão /opt/pw-browsers/chromium, se existir).
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_PATH,
    path.join(process.cwd(), 'node_modules', 'playwright'),
    'playwright',
    '/opt/node22/lib/node_modules/playwright',
  ].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch (e) { /* tenta o seguinte */ }
  }
  throw new Error('Playwright não encontrado. Defina PLAYWRIGHT_PATH ou corra a partir de uma pasta com node_modules/playwright.');
}

const W = 1200, H = 630, QUALITY = 85, MAX_BYTES = 200 * 1024;
const here = __dirname;
const src = path.join(here, 'og.html');
const logo = path.join(here, '..', 'src', 'partials', 'logo.svg');
const out = path.join(here, '..', 'img', 'og-v3.jpg');
const pvIdx = process.argv.indexOf('--preview');
const preview = pvIdx > -1 ? path.resolve(process.argv[pvIdx + 1]) : null;

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xC3) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return null;
}

(async () => {
  const { chromium } = loadPlaywright();
  const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(src).href, { waitUntil: 'load' });
    // Logótipo inline a partir do partial do site (fonte única).
    const svg = fs.readFileSync(logo, 'utf8').trim();
    await page.evaluate((s) => { document.getElementById('logo').innerHTML = s; }, svg);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
    });
    const fontsOk = await page.evaluate(() => document.fonts.check('700 60px Geist') && document.fonts.check('600 34px Geist'));
    if (!fontsOk) throw new Error('A fonte Geist não carregou (verifique ../fonts/geist.woff2).');

    const buf = await page.screenshot({ type: 'jpeg', quality: QUALITY, clip: { x: 0, y: 0, width: W, height: H } });
    fs.writeFileSync(out, buf);
    const dim = jpegSize(buf);
    console.log(`${path.relative(process.cwd(), out)}: ${dim.width}x${dim.height}, ${buf.length} bytes`);
    if (dim.width !== W || dim.height !== H) throw new Error(`Dimensões erradas: ${dim.width}x${dim.height}`);
    if (buf.length > MAX_BYTES) throw new Error(`Ficheiro acima de ${MAX_BYTES} bytes`);

    if (preview) {
      // Como aparece numa pré-visualização do WhatsApp/Facebook (~600px de largura).
      const pv = await browser.newPage({ viewport: { width: 600, height: 315 }, deviceScaleFactor: 1 });
      await pv.setContent(`<style>*{margin:0}img{display:block;width:600px;height:315px}</style><img src="data:image/jpeg;base64,${buf.toString('base64')}">`);
      await pv.evaluate(() => document.images[0].decode());
      fs.mkdirSync(path.dirname(preview), { recursive: true });
      await pv.screenshot({ path: preview, type: 'png' });
      console.log(`pré-visualização: ${preview}`);
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
