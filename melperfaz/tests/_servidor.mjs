/* Servidor local para os testes: serve a pasta gerada e guarda cada POST do formulário como o Netlify Forms o receberia
   (os campos descodificados). Pode falhar de propósito (falhar(true) → 500), para testar o aviso de erro.
   Um POST para /obrigado.html (o envio sem JavaScript) devolve a própria página obrigado.html, como o Netlify. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.txt': 'text/plain', '.json': 'application/json' };

export async function serve(pub) {
  const pedidos = [];
  let falha = false;
  const srv = http.createServer((req, res) => {
    const caminho = decodeURIComponent(req.url.split('?')[0]);
    if (req.method === 'POST') {
      let corpo = '';
      req.on('data', c => { corpo += c; });
      req.on('end', () => {
        const campos = Object.fromEntries(new URLSearchParams(corpo));
        pedidos.push({ caminho, campos, tipo: req.headers['content-type'] || '' });
        if (falha) { res.writeHead(500); res.end('erro de teste'); return; }
        if (caminho === '/obrigado.html') {
          res.writeHead(200, { 'Content-Type': TIPOS['.html'] });
          res.end(fs.readFileSync(path.join(pub, 'obrigado.html')));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      });
      return;
    }
    let p = caminho;
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(pub, p);
    if (!f.startsWith(pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
      res.writeHead(404, { 'Content-Type': TIPOS['.html'] });
      res.end(fs.readFileSync(path.join(pub, '404.html')));
      return;
    }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${srv.address().port}`,
    pedidos,
    falhar(v) { falha = v; },
    close: () => new Promise(r => srv.close(r)),
  };
}
