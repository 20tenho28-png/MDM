#!/usr/bin/env node
/**
 * Gera dist/calculadora-ar-condicionado.html: a calculadora inteira num só
 * ficheiro, sem módulos ES e sem servidor. Serve para colar numa versão do
 * site (alojamento estático) ou abrir por file://.
 *
 *   node ac-calculator/tools/build_single.js
 *
 * Sem dependências: só o Node. As únicas referências externas que ficam são
 * as fontes do Google (o site já as usa); sem rede, caem nas fontes do sistema.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

// Módulos -> declarações simples dentro de uma função: tira "export " e os imports.
const stripExports = (src) => src.replace(/^export\s+(?=(const|let|function)\b)/gm, "");
const model = stripExports(read("calc_model.js"));
const prices = stripExports(read("prices.js"));
const app = read("app.js").replace(/^import\s*\{[\s\S]*?\}\s*from\s*"\.\/calc_model\.js";\s*\nimport\s*\{\s*PRICES\s*\}\s*from\s*"\.\/prices\.js";\s*\n/m, (m) => {
  if (!m) throw new Error("bloco de imports do app.js não encontrado");
  return "";
});
if (/^\s*(import|export)\s/m.test(app) || /^\s*(import|export)\s/m.test(model) || /^\s*(import|export)\s/m.test(prices)) {
  throw new Error("ainda há import/export por tratar");
}

const bundle = [
  "(function () {",
  '"use strict";',
  "// ---- calc_model.js ----",
  model,
  "// ---- prices.js ----",
  prices,
  "// ---- app.js ----",
  app,
  "})();",
].join("\n");
if (bundle.includes("</script")) throw new Error("o código contém '</script', não pode ser embebido");

const html = read("index.html").replace('<script type="module" src="./app.js"></script>', () => `<script>\n${bundle}\n</script>`);
if (html === read("index.html")) throw new Error("tag do app.js não encontrada em index.html");

const out = path.join(root, "dist", "calculadora-ar-condicionado.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`escrito ${path.relative(process.cwd(), out)} (${(html.length / 1024).toFixed(0)} kB)`);
