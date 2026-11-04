// Registo da MDM sem rede: guarda a própria app (página, scripts, logótipos, letras) neste aparelho.
// Os dados não passam por aqui: a página guarda a última leitura e as alterações por enviar (ver «Sem rede» no index.html).
// A página e os scripts vêm primeiro da rede (a versão nova chega logo, e uma página nova nunca corre com os scripts
// velhos), mas sem esperar mais de 4 s: com a rede fraca, a cópia guardada. O resto (logótipos, letras) sai da cópia
// logo, e a rede atualiza-a por trás.
var VERSAO = 'registo-mdm-3';
// supabase.min.js é a biblioteca da base de dados (@supabase/supabase-js 2.49.1, licença MIT, dist/umd do npm), guardada
// aqui em vez de vir de um CDN: sem rede a página entra na mesma.
// orcamento-motor.js é o motor de orçamentos (só código: os preços vêm da config, com a pessoa que entrou).
var BASE = ['./', 'index.html', 'supabase.min.js', 'orcamento-motor.js', 'logo-folha.jpg', 'logo-ri.jpg', 'logo-orc.jpg', 'icone-180.png'];
// Do site, fora de /registo/: o logótipo e as letras da folha «MDM» do orçamento (o PDF tem de sair igual sem rede).
// Se algum faltar, a app instala-se na mesma.
var SITE = ['../assets/img/logo-mdm.svg', '../assets/fonts/archivo-latin-600-normal.woff2', '../assets/fonts/archivo-latin-700-normal.woff2',
  '../assets/fonts/archivo-latin-800-normal.woff2', '../assets/fonts/newsreader-latin-400-normal.woff2', '../assets/fonts/newsreader-latin-500-normal.woff2'];
var ESPERA = 4000;
// Quando a página saiu da cópia (rede fraca): os scripts que ela pede logo a seguir vêm também da cópia, para correrem
// com a página da mesma versão (uma página velha com o motor novo também podia falhar).
var paginaDaCopia = 0;

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSAO).then(function (c) {
    return c.addAll(BASE).then(function () { return Promise.all(SITE.map(function (u) { return c.add(u).catch(function () {}); })); });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('registo-mdm-') === 0 && k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function guarda(req, res) {
  if (res && (res.ok || res.type === 'opaque')) { var copia = res.clone(); caches.open(VERSAO).then(function (c) { c.put(req, copia); }); }
  return res;
}

// A rede primeiro, com prazo: passados ESPERA ms sem resposta, a cópia guardada (se houver; senão espera pela rede).
// A resposta da rede que chegar depois fica guardada para a vez seguinte; a da página só com os scripts da mesma altura
// (senão a cópia ficava com a página nova e o motor velho).
var SCRIPTS = ['supabase.min.js', 'orcamento-motor.js'];
function redePrimeiro(ev, req, copia, pagina) {
  var feito = false, daCopia = false, fim = null;
  try { ev.waitUntil(new Promise(function (r) { fim = r; })); } catch (e) {}
  var acaba = function () { if (fim) fim(); };
  ev.respondWith(new Promise(function (ok, mal) {
    var usa = function (r, c) { if (!feito && r) { feito = true; daCopia = c; if (pagina) paginaDaCopia = c ? Date.now() : 0; ok(r); } };
    var t = setTimeout(function () { copia().then(function (r) { usa(r, true); }); }, ESPERA);
    fetch(req).then(function (res) {
      clearTimeout(t);
      if (!(pagina && daCopia)) { guarda(req, res); usa(res, false); acaba(); return; }
      Promise.all(SCRIPTS.map(function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error('script'); return r; }); }))
        .then(function (rs) { guarda(req, res); rs.forEach(function (r, i) { guarda(new Request(SCRIPTS[i]), r); }); }, function () {})
        .then(acaba);
    }, function (e) {
      clearTimeout(t);
      copia().then(function (r) { if (r) usa(r, true); else if (!feito) { feito = true; mal(e); } acaba(); });
    });
  }));
}

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // A base de dados (Supabase) nunca: os dados guardam-se na página, com a pessoa que entrou.
  if (/supabase\.co$/.test(url.hostname)) return;
  var mesmo = url.origin === self.location.origin;
  if (mesmo && (req.mode === 'navigate' || /\/registo\/(index\.html)?$/.test(url.pathname))) {
    redePrimeiro(ev, req, function () { return caches.match(req, {ignoreSearch: true}).then(function (r) { return r || caches.match('index.html'); }); }, true);
    return;
  }
  // Os scripts da app também da rede primeiro: a página nova com o motor velho podia estragar o «Calcular preço». Se a
  // página acabou de sair da cópia, os scripts também (a mesma versão, sem os trocar por trás: mudam com a página).
  if (mesmo && url.pathname.indexOf('/registo/') === 0 && /\.js$/.test(url.pathname)) {
    if (Date.now() - paginaDaCopia < 15000) {
      ev.respondWith(caches.match(req, {ignoreSearch: true}).then(function (r) { return r || fetch(req).then(function (res) { return guarda(req, res); }); }));
      return;
    }
    redePrimeiro(ev, req, function () { return caches.match(req, {ignoreSearch: true}); });
    return;
  }
  var cdn = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  var site = mesmo && /^\/assets\/(img\/logo-mdm\.svg|fonts\/[a-z0-9-]+\.woff2)$/.test(url.pathname);
  if (!(mesmo && url.pathname.indexOf('/registo/') === 0) && !cdn && !site) return;
  // O resto (logótipos, letras): a cópia logo, e a rede atualiza-a por trás.
  ev.respondWith(caches.match(req).then(function (r) {
    var rede = fetch(req).then(function (res) { return guarda(req, res); }).catch(function () { return r; });
    return r || rede;
  }));
});
