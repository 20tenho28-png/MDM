// Registo da MDM sem rede: guarda a própria app (página, logótipos, biblioteca da base de dados, letras) neste aparelho.
// Os dados não passam por aqui: a página guarda a última leitura e as alterações por enviar (ver «Sem rede» no index.html).
// A página vem sempre primeiro da rede (para chegar a versão nova logo que haja rede); sem rede, a cópia guardada.
var VERSAO = 'registo-mdm-2';
// supabase.min.js é a biblioteca da base de dados (@supabase/supabase-js 2.49.1, licença MIT, dist/umd do npm), guardada
// aqui em vez de vir de um CDN: sem rede a página entra na mesma.
// orcamento-motor.js é o motor de orçamentos (só código: os preços vêm da config, com a pessoa que entrou).
var BASE = ['./', 'index.html', 'supabase.min.js', 'orcamento-motor.js', 'logo-folha.jpg', 'logo-ri.jpg', 'logo-orc.jpg', 'icone-180.png'];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(BASE); }).then(function () { return self.skipWaiting(); }));
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

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // A base de dados (Supabase) nunca: os dados guardam-se na página, com a pessoa que entrou.
  if (/supabase\.co$/.test(url.hostname)) return;
  var mesmo = url.origin === self.location.origin;
  if (mesmo && (req.mode === 'navigate' || /\/registo\/(index\.html)?$/.test(url.pathname))) {
    // A página: rede primeiro, cópia sem rede.
    ev.respondWith(fetch(req).then(function (res) { return guarda(req, res); })
      .catch(function () { return caches.match(req, {ignoreSearch: true}).then(function (r) { return r || caches.match('index.html'); }); }));
    return;
  }
  var cdn = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
  if (!(mesmo && url.pathname.indexOf('/registo/') === 0) && !cdn) return;
  // O resto (logótipos, scripts, letras): a cópia logo, e a rede atualiza-a por trás.
  ev.respondWith(caches.match(req).then(function (r) {
    var rede = fetch(req).then(function (res) { return guarda(req, res); }).catch(function () { return r; });
    return r || rede;
  }));
});
