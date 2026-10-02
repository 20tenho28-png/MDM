/* MDM Assistência Técnica — comportamento do site.
   Sem dependências. A lógica de pedidos, triagem e medição vem do site anterior (index-carmim.html),
   mantida tal como estava; o resto é novo (gaveta, topo compacto, barra móvel, carrossel, filtros, revelação). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══ Estatísticas: PostHog na UE, sem cookies (persistence memory), só depois de «Aceitar» ═══
     A escolha fica no localStorage ('mdm-estatisticas' = 'sim' ou 'nao'). Sem escolha aparece a barra
     (partials/consentimento.html); a política de privacidade tem o controlo para mudar de ideias.
     Com o sinal «não seguir» do browser (Global Privacy Control ou Do Not Track) a barra não aparece e nada se mede,
     a não ser que o visitante aceite na política. No ficheiro único (file:) não há estatísticas nem barra.
     Antes da escolha, os eventos ficam só na memória desta página: seguem se aceitar aqui, perdem-se se não. */
  var CHAVE_EST = 'mdm-estatisticas';
  var SEM_REDE = location.protocol === 'file:';
  var NAO_SEGUIR = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  var escolha = (function () {
    try { var v = localStorage.getItem(CHAVE_EST); return v === 'sim' || v === 'nao' ? v : ''; } catch (e) { return ''; }
  })();
  var _trackQueue = [];
  var phPronto = false, phCapture = null;
  function track(event, props) {
    if (SEM_REDE || escolha === 'nao' || (!escolha && NAO_SEGUIR)) return;
    props = props || {};
    try {
      if (phPronto) window.posthog.capture(event, props);
      else if (_trackQueue.length < 50) _trackQueue.push([event, props]);
    } catch (e) {}
  }
  window.mdmTrack = track;
  function carregaPostHog() {
    if (SEM_REDE || carregaPostHog.feito) return;
    carregaPostHog.feito = true;
    var el = document.createElement('script');
    el.src = 'https://eu-assets.i.posthog.com/static/array.js';
    el.async = true;
    el.onload = function () {
      /* o visitante pode ter recusado enquanto o script descarregava */
      if (escolha !== 'sim') { _trackQueue.length = 0; return; }
      try {
        window.posthog.init('phc_veB6kR2as8m8HuRMEVuTUWubWQxLkPW5D8Uf6wsJcy8A', {
          api_host: 'https://eu.i.posthog.com', persistence: 'memory', person_profiles: 'identified_only',
          autocapture: false, enable_heatmaps: true, capture_dead_clicks: true,
          /* só o que a política de privacidade descreve, mesmo que se ligue mais alguma coisa na conta PostHog */
          disable_session_recording: true, disable_surveys: true, capture_exceptions: false, capture_performance: false
        });
        phCapture = window.posthog.capture; phPronto = true;
        while (_trackQueue.length) { var t = _trackQueue.shift(); window.posthog.capture(t[0], t[1]); }
      } catch (e) {}
    };
    document.head.appendChild(el);
  }
  /* «Recusar» depois de aceitar: o PostHog já carregado deixa de enviar a partir de agora
     (sem opt_out_capturing, que gravaria outra entrada no localStorage) */
  function paraPostHog() {
    _trackQueue.length = 0;
    try { if (phPronto) window.posthog.capture = function () {}; } catch (e) {}
  }
  function defineEscolha(v) {
    if (v !== 'sim' && v !== 'nao') return false;
    escolha = v;
    var guardada = true;
    try { localStorage.setItem(CHAVE_EST, v); } catch (e) { guardada = false; }
    fechaConsent();
    if (v === 'sim') {
      if (phPronto && phCapture) { try { window.posthog.capture = phCapture; } catch (e) {} }
      carregaPostHog();
    } else paraPostHog();
    return guardada;
  }
  /* para a política de privacidade (assets/js/privacidade.js) */
  window.mdmEstatisticas = {
    escolha: function () { return escolha; }, define: defineEscolha, naoSeguir: NAO_SEGUIR, semRede: SEM_REDE
  };
  if (escolha === 'sim') carregaPostHog();

  /* barra das estatísticas: fica por cima da barra fixa do telemóvel e sai do caminho dos botões do topo */
  var consent = document.querySelector('[data-consent]');
  var consentRecolhe = function () {};
  function fechaConsent() {
    if (!consent) return;
    var tinhaFoco = consent.contains(document.activeElement);
    consent.hidden = true;
    document.documentElement.classList.remove('com-consent');
    if (tinhaFoco) { var m = $('conteudo'); if (m) m.focus({ preventScroll: true }); }
  }
  (function () {
    if (!consent) return;
    if (escolha || NAO_SEGUIR || SEM_REDE) { consent.remove(); consent = null; return; }
    var raiz = document.documentElement, acoes = document.querySelector('.hero-acoes');
    var barraMovel = document.querySelector('[data-barra-movel]');
    consent.hidden = false;
    raiz.classList.add('com-consent');
    function mede() {
      if (consent.hidden) return;
      raiz.style.setProperty('--consent-h', consent.offsetHeight + 'px');
      if (barraMovel && barraMovel.offsetHeight) raiz.style.setProperty('--barra-movel-h', barraMovel.offsetHeight + 'px');
      consentRecolhe();
    }
    /* compara com o sítio onde a barra fica (não com o da animação): por cima da barra móvel, se estiver à vista */
    consentRecolhe = function () {
      if (!consent || consent.hidden || !acoes) return;
      /* em ecrãs baixos a barra está no topo da página, sem tapar nada (site.css) */
      if (getComputedStyle(consent).position !== 'fixed') { consent.classList.remove('recolhida'); return; }
      var movel = barraMovel && barraMovel.getClientRects().length && !barraMovel.classList.contains('escondida') ? barraMovel.offsetHeight : 0;
      var fundo = window.innerHeight - movel, topo = fundo - consent.offsetHeight;
      var r = acoes.getBoundingClientRect();
      /* com o foco do teclado lá dentro, fica à vista (os botões do topo não têm o foco nesse momento) */
      var tapa = r.bottom > topo && r.top < fundo && r.height > 0 && !consent.contains(document.activeElement);
      consent.classList.toggle('recolhida', tapa);
    };
    var tick = false;
    function agenda() { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; consentRecolhe(); }); } }
    window.addEventListener('scroll', agenda, { passive: true });
    window.addEventListener('resize', function () { requestAnimationFrame(mede); });
    consent.addEventListener('focusin', function () { consentRecolhe(); });
    consent.addEventListener('focusout', function () { setTimeout(consentRecolhe, 0); });
    consent.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-consent-escolha]');
      if (!b) return;
      var guardada = defineEscolha(b.getAttribute('data-consent-escolha'));
      /* a política de privacidade (privacidade.js) atualiza a sua caixa «A sua escolha neste browser» */
      try { document.dispatchEvent(new CustomEvent('mdm-estatisticas', { detail: { guardada: guardada } })); } catch (er) {}
    });
    mede();
  })();

  /* «Orçamento» numa página com o seu próprio formulário (serviços): fica nesta página, com o serviço já escolhido */
  if (document.getElementById('orcamento')) {
    qsa('a[href$="index.html#orcamento"]').forEach(function (a) { a.setAttribute('href', '#orcamento'); });
  }

  /* cliques nos caminhos de contacto: um evento com o nome do caminho */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-lead]');
    if (a) track('lead_click', { caminho: a.getAttribute('data-lead'), pagina: location.pathname });
  });

  /* ═══ Ano corrente ═══ */
  (function () {
    var y = new Date().getFullYear();
    if (y >= 2026) qsa('[data-ano-atual]').forEach(function (e) { e.textContent = y; });
  })();

  /* ═══ Menu atual ═══ */
  (function () {
    var nav = document.body.getAttribute('data-nav');
    /* "page" só quando o link aponta mesmo para esta página; numa página de serviço ou de obra, o link da secção-mãe leva "true" */
    if (nav) qsa('[data-nav-item="' + nav + '"]').forEach(function (a) { a.setAttribute('aria-current', a.pathname === location.pathname && !a.hash ? 'page' : 'true'); });
    /* Página inicial: o link da secção à vista fica marcado (aria-current="location"); "Obras" acompanha a secção #obras */
    if (!nav && 'IntersectionObserver' in window) {
      var mapa = new Map();
      qsa('.nav-a[data-nav-item], .gaveta-nav a[data-nav-item]').forEach(function (a) {
        var id = a.hash && a.pathname === location.pathname ? a.hash.slice(1) : a.getAttribute('data-nav-item') === 'obras' ? 'obras' : '';
        var sec = id && document.getElementById(id); if (!sec) return;
        (mapa.get(sec) || mapa.set(sec, []).get(sec)).push(a);
      });
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) { mapa.get(e.target).forEach(function (a) {
          if (e.isIntersecting) a.setAttribute('aria-current', 'location');
          else if (a.getAttribute('aria-current') === 'location') a.removeAttribute('aria-current');
        }); });
      }, { rootMargin: '-45% 0px -50% 0px' });
      mapa.forEach(function (_, sec) { io.observe(sec); });
    }
    /* Privacidade: no índice, fica marcado o último título que já passou a linha dos 40% do ecrã */
    var indice = qsa('.priv-indice a[href^="#"]');
    if (indice.length) {
      var alvos = indice.map(function (a) { return document.getElementById(a.hash.slice(1)); }), tick = false;
      var marca = function () {
        tick = false; var linha = window.innerHeight * .4, atual = -1;
        alvos.forEach(function (h, i) { if (h && h.getBoundingClientRect().top < linha) atual = i; });
        indice.forEach(function (a, i) { if (i === atual) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      };
      window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(marca); } }, { passive: true });
      marca();
    }
  })();

  /* ═══ Topo compacto depois de 80 px ═══ */
  (function () {
    var topo = document.querySelector('[data-topo]');
    if (!topo) return;
    var on = false, tick = false;
    function upd() { tick = false; var s = window.scrollY > 80; if (s !== on) { on = s; topo.classList.toggle('compacto', s); document.body.classList.toggle('topo-compacto', s); } }
    window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  })();

  /* ═══ Gaveta (menu) com foco preso ═══ */
  function focaveis(root) {
    return qsa('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }
  function prende(root, e) {
    if (e.key !== 'Tab') return;
    var f = focaveis(root); if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  (function () {
    var gaveta = $('gaveta'), veu = document.querySelector('.veu');
    if (!gaveta || !veu) return;
    var origem = null, t = null;
    function abre(btn) {
      clearTimeout(t);
      origem = btn || document.activeElement;
      gaveta.hidden = false; veu.hidden = false;
      document.body.classList.add('menu-aberto');
      requestAnimationFrame(function () { requestAnimationFrame(function () { gaveta.classList.add('aberta'); veu.classList.add('aberto'); }); });
      qsa('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      setTimeout(function () { var c = gaveta.querySelector('[data-fecha-menu]'); if (c) c.focus(); }, 50);
      track('menu_aberto');
    }
    function fecha(semFoco) {
      gaveta.classList.remove('aberta'); veu.classList.remove('aberto');
      document.body.classList.remove('menu-aberto');
      qsa('[data-menu]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      t = setTimeout(function () { gaveta.hidden = true; veu.hidden = true; }, reduceMotion ? 0 : 300);
      if (!semFoco && origem && origem.focus) origem.focus();
    }
    qsa('[data-menu]').forEach(function (b) { b.addEventListener('click', function () { abre(b); }); });
    qsa('[data-fecha-menu]').forEach(function (b) { b.addEventListener('click', function () { fecha(); }); });
    qsa('a', gaveta).forEach(function (a) { a.addEventListener('click', function () { fecha(true); }); });
    gaveta.addEventListener('keydown', function (e) { if (gaveta.hidden) return; if (e.key === 'Escape') fecha(); prende(gaveta, e); });
  })();

  /* ═══ Barra fixa no telemóvel: sai do caminho no rodapé e no formulário ═══ */
  (function () {
    var barra = document.querySelector('[data-barra-movel]');
    if (!barra || !('IntersectionObserver' in window)) return;
    var alvos = qsa('.rodape, #orcamento, .hero-acoes, [data-esconde-barra]');
    var visiveis = new Set();
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        /* os botões do topo só substituem a barra quando estão quase inteiros à vista */
        var minimo = en.target.classList.contains('hero-acoes') ? 0.6 : 0.05;
        if (en.isIntersecting && en.intersectionRatio >= minimo) visiveis.add(en.target); else visiveis.delete(en.target);
      });
      var esconde = visiveis.size > 0;
      barra.classList.toggle('escondida', esconde);
      barra.inert = esconde;
      document.documentElement.classList.toggle('barra-fora', esconde);
      consentRecolhe();
    }, { threshold: [0.05, 0.6] });
    alvos.forEach(function (a) { io.observe(a); });
  })();

  /* ═══ Foco do teclado nunca por baixo das barras fixas de baixo (estatísticas e barra do telemóvel) ═══
     O browser só desliza até um elemento focado se ele estiver fora do ecrã; por baixo de uma barra fixa conta como visível. */
  (function () {
    var barras = qsa('[data-consent], [data-barra-movel]');
    if (!barras.length) return;
    function ajusta(el) {
      if (document.activeElement !== el) return;
      /* só o foco do teclado (um clique do rato não faz saltar a página) */
      try { if (!el.matches(':focus-visible')) return; } catch (e) {}
      var limite = window.innerHeight;
      barras.forEach(function (b) {
        if (!b.isConnected || !b.getClientRects().length || b.classList.contains('escondida') || b.classList.contains('recolhida') || getComputedStyle(b).position !== 'fixed') return;
        limite = Math.min(limite, b.getBoundingClientRect().top);
      });
      /* desliza o que falta, sem empurrar o topo do elemento para baixo do cabeçalho fixo */
      var topo = document.querySelector('[data-topo]'), cima = topo ? topo.getBoundingClientRect().bottom : 0;
      var r = el.getBoundingClientRect(), falta = Math.min(r.bottom + 12 - limite, r.top - cima - 8);
      if (falta > 0) window.scrollBy({ top: falta, behavior: 'instant' });
    }
    document.addEventListener('focusin', function (e) {
      var el = e.target;
      if (!el.getBoundingClientRect || el.closest('[data-consent], [data-barra-movel], dialog, .gaveta')) return;
      requestAnimationFrame(function () { ajusta(el); });
      /* depois de deslizar, as barras podem mudar de sítio (a do telemóvel entra ou sai): volta a ver */
      setTimeout(function () { ajusta(el); }, 320);
    });
  })();

  /* ═══ Revelação ao percorrer: uma vez, 16 px, 70 ms entre irmãos ═══ */
  (function () {
    var els = qsa('[data-r]');
    if (!els.length) return;
    els.forEach(function (el) {
      var irmaos = qsa(':scope > [data-r]', el.parentElement);
      var i = irmaos.indexOf(el);
      if (i > 0) el.style.setProperty('--r', Math.min(i, 6));
    });
    if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { io.observe(e); });
  })();

  /* ═══ Carrossel de obras: deslize nativo com snap, setas, contador e barra ═══ */
  qsa('[data-carrossel]').forEach(function (root) {
    var trilho = root.querySelector('.carrossel-trilho');
    var slides = qsa('[data-slide]', root);
    var prev = root.querySelector('[data-carrossel-prev]'), next = root.querySelector('[data-carrossel-next]');
    var cont = root.querySelector('[data-carrossel-cont]'), barra = root.querySelector('[data-carrossel-barra]');
    if (!trilho || !slides.length) return;
    var n = slides.length, pad = function (k) { return k < 10 ? '0' + k : String(k); };
    function passo() { return slides.length > 1 ? slides[1].offsetLeft - slides[0].offsetLeft : trilho.clientWidth; }
    function visiveis() { return Math.max(1, Math.round(trilho.clientWidth / passo())); }
    function atual() { return Math.round(trilho.scrollLeft / passo()); }
    function upd() {
      var i = atual(), v = Math.min(visiveis(), n), max = Math.max(0, n - v);
      i = Math.min(i, max);
      var fim = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4;
      if (fim) i = max;
      if (cont) cont.textContent = (v > 1 ? pad(i + 1) + '–' + pad(Math.min(i + v, n)) : pad(i + 1)) + ' / ' + pad(n);
      if (barra) barra.style.width = ((Math.min(i + v, n)) / n * 100).toFixed(2) + '%';
      if (prev) prev.setAttribute('aria-disabled', i <= 0 ? 'true' : 'false');
      if (next) next.setAttribute('aria-disabled', i >= max ? 'true' : 'false');
    }
    function vai(d) {
      trilho.scrollBy({ left: d * passo(), behavior: reduceMotion ? 'auto' : 'smooth' });
      track('carrossel', { direcao: d > 0 ? 'seguinte' : 'anterior' });
    }
    if (prev) prev.addEventListener('click', function () { if (prev.getAttribute('aria-disabled') !== 'true') vai(-1); });
    if (next) next.addEventListener('click', function () { if (next.getAttribute('aria-disabled') !== 'true') vai(1); });
    var tick = false;
    trilho.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; upd(); }); } }, { passive: true });
    window.addEventListener('resize', upd);
    upd();
  });

  /* ═══ Visor: tocar numa fotografia da galeria abre-a em ecrã inteiro ═══
     Grupos [data-visor] com itens [data-visor-item] (a fotografia, o título em data-visor-t e o registo em data-visor-m).
     Desliza-se entre fotografias, setas e teclado também servem; o botão "voltar" do telemóvel fecha.
     No ficheiro único (MDM-index.html) as páginas das obras não existem: um <template data-visor-todas>
     traz as 24 fotografias e as ligações para obras.html e obras/*.html abrem o visor em vez de uma página em falta. */
  (function () {
    var todas = document.querySelector('template[data-visor-todas]');
    if (!document.querySelector('[data-visor]') && !todas) return;
    if (typeof HTMLDialogElement !== 'function') return;   /* sem <dialog>: ficam as ligações normais */
    var X = '<svg class="ico" viewBox="0 0 256 256" aria-hidden="true"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>';
    var ANT = '<svg class="ico" viewBox="0 0 256 256" aria-hidden="true"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/></svg>';
    var SEG = '<svg class="ico" viewBox="0 0 256 256" aria-hidden="true"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/></svg>';
    var d = document.createElement('dialog');
    d.className = 'visor';
    d.setAttribute('aria-label', 'Fotografias das obras');
    /* o trilho é focável (Safari não foca sozinho uma zona que se desliza); as setas do teclado também mudam de fotografia */
    d.innerHTML = '<div class="visor-topo"><span class="visor-conta" aria-live="polite"></span>' +
      '<button class="visor-fechar" type="button" aria-label="Fechar">' + X + '</button></div>' +
      '<div class="visor-trilho" role="group" aria-label="Fotografias: deslize ou use as setas" tabindex="0"></div>' +
      '<button class="visor-seta visor-ant" type="button" aria-label="Fotografia anterior">' + ANT + '</button>' +
      '<button class="visor-seta visor-seg" type="button" aria-label="Fotografia seguinte">' + SEG + '</button>';
    document.body.appendChild(d);
    var trilho = d.querySelector('.visor-trilho'), conta = d.querySelector('.visor-conta');
    var ant = d.querySelector('.visor-ant'), seg = d.querySelector('.visor-seg');
    var n = 0, idx = 0, alvo = -1, comHistorico = false, volta = null;
    function esqueceY() {
      try { if (history.state && 'visorY' in history.state) { var st = Object.assign({}, history.state); delete st.visorY; history.replaceState(st, ''); } } catch (e) {}
    }

    /* de volta de «Ver a obra» com a página recarregada: repõe a posição em que o visor foi aberto */
    (function () {
      var st = history.state, nav = window.performance && performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (!st || typeof st.visorY !== 'number' || !nav || nav.type !== 'back_forward') return;
      var ir = function () { window.scrollTo({ top: st.visorY, left: 0, behavior: 'instant' }); };
      ir(); window.addEventListener('load', ir);
      try { history.scrollRestoration = 'auto'; } catch (e) {}
      esqueceY();
    })();

    function itensDe(raiz) { return qsa('[data-visor-item]', raiz); }
    function legenda(it) {
      var c = document.createElement('figcaption');
      var t = document.createElement('strong'); t.textContent = it.getAttribute('data-visor-t') || ''; c.appendChild(t);
      var m = it.getAttribute('data-visor-m');
      if (m) { var s = document.createElement('span'); s.className = 'registo'; s.textContent = m; c.appendChild(s); }
      /* no site, a ligação para a página da obra; no ficheiro único essas páginas não existem */
      var href = it.getAttribute('href') || '';
      if (!todas && /obras\/[^/]+\.html$/.test(href)) {
        var a = document.createElement('a'); a.href = href; a.textContent = 'Ver a obra'; c.appendChild(a);
        /* substitui a entrada do visor no histórico: ao voltar da obra, um só "voltar" chega a esta página */
        a.addEventListener('click', function (e) {
          if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault(); comHistorico = false; location.replace(a.href);
        });
      }
      return c;
    }
    function atual() { return trilho.clientWidth ? Math.round(trilho.scrollLeft / trilho.clientWidth) : 0; }
    function upd() {
      var i = idx = Math.max(0, Math.min(n - 1, atual()));
      if (alvo >= 0 && Math.abs(trilho.scrollLeft - alvo * trilho.clientWidth) < 2) alvo = -1;
      conta.textContent = n < 2 ? '' : (i + 1) + ' / ' + n;
      /* aria-disabled em vez de disabled: um botão desativado com foco deixaria o teclado fora do visor */
      ant.setAttribute('aria-disabled', i <= 0 ? 'true' : 'false');
      seg.setAttribute('aria-disabled', i >= n - 1 ? 'true' : 'false');
      ant.hidden = seg.hidden = n < 2;
      /* só a fotografia à vista é alcançável com Tab (as outras "Ver a obra" ficam de fora) */
      qsa('.visor-item', trilho).forEach(function (f, k) { f.inert = k !== i; });
    }
    function vai(k) {
      /* várias setas seguidas somam-se, mesmo a meio do deslize anterior */
      var i = Math.max(0, Math.min(n - 1, (alvo >= 0 ? alvo : atual()) + k));
      alvo = i;
      trilho.scrollTo({ left: i * trilho.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    function rotulo(it) {
      var img = it.querySelector('img');
      return 'Ver em grande: ' + ((img && img.alt) || it.getAttribute('data-visor-t') || 'fotografia');
    }
    function abre(lista, i, origem) {
      trilho.textContent = '';
      n = lista.length; alvo = -1;
      /* aberto a partir do menu (que se fecha): ao fechar o visor, o foco volta ao botão do menu */
      volta = origem && origem.closest && origem.closest('#gaveta') ? document.querySelector('.topo [data-menu]') : null;
      lista.forEach(function (it, k) {
        var fig = document.createElement('figure'); fig.className = 'visor-item';
        var pic = it.querySelector('picture');
        pic = pic ? pic.cloneNode(true) : document.createElement('picture');
        var img = pic.querySelector('img');
        /* ecrã inteiro, sem cortar: a fotografia ocupa a largura ou a altura do ecrã, a que chegar primeiro */
        var w = img && +img.getAttribute('width'), h = img && +img.getAttribute('height');
        var tam = w && h ? 'min(100vw, ' + Math.round(100 * w / h) + 'vh)' : '100vw';
        qsa('source', pic).forEach(function (s) { s.setAttribute('sizes', tam); });
        if (img) {
          img.removeAttribute('fetchpriority');
          img.setAttribute('sizes', tam);
          img.loading = Math.abs(k - i) <= 1 ? 'eager' : 'lazy';
        }
        fig.appendChild(pic); fig.appendChild(legenda(it));
        trilho.appendChild(fig);
      });
      document.documentElement.classList.add('visor-aberto');
      d.showModal();
      trilho.scrollLeft = i * trilho.clientWidth;
      upd();
      d.querySelector('.visor-fechar').focus();
      /* o "voltar" do telemóvel fecha o visor. 'manual' antes do pushState: ao voltar, a página não salta para uma secção (#).
         A posição fica guardada nesta entrada para se repor ao voltar de «Ver a obra» (o navegador não a repõe em 'manual') */
      try {
        history.replaceState(Object.assign({}, history.state, { visorY: Math.round(window.scrollY) }), '');
        history.scrollRestoration = 'manual';
        history.pushState({ visor: 1 }, ''); comHistorico = true;
      } catch (e) { comHistorico = false; }
      track('visor_aberto', { fotografias: n, pagina: location.pathname });
    }
    function fecha() { if (d.open) d.close(); }
    d.addEventListener('close', function () {
      document.documentElement.classList.remove('visor-aberto');
      trilho.textContent = '';
      if (volta) { volta.focus(); volta = null; }
      /* fechado no botão ou com Esc: tira a entrada que o visor pôs no histórico */
      if (comHistorico) { comHistorico = false; try { if (history.state && history.state.visor) history.back(); } catch (e) {} }
    });
    window.addEventListener('popstate', function () {
      requestAnimationFrame(function () { try { history.scrollRestoration = 'auto'; } catch (e) {} esqueceY(); });
      if (d.open) { comHistorico = false; fecha(); }
    });
    d.querySelector('.visor-fechar').addEventListener('click', fecha);
    ant.addEventListener('click', function () { if (ant.getAttribute('aria-disabled') !== 'true') vai(-1); });
    seg.addEventListener('click', function () { if (seg.getAttribute('aria-disabled') !== 'true') vai(1); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); vai(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); vai(1); }
    });
    var tick = false;
    trilho.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; upd(); }); } }, { passive: true });
    /* ao rodar o telemóvel, fica na mesma fotografia */
    window.addEventListener('resize', function () { if (d.open) { alvo = -1; trilho.scrollLeft = idx * trilho.clientWidth; upd(); } });

    /* a fotografia do carrossel (ou da obra) passa a ser um botão que abre o visor */
    qsa('[data-visor] [data-visor-item]').forEach(function (it) {
      it.removeAttribute('aria-hidden'); it.removeAttribute('tabindex');
      it.setAttribute('role', 'button');
      it.setAttribute('aria-label', rotulo(it));
      it.addEventListener('keydown', function (e) { if (e.key === ' ') { e.preventDefault(); it.click(); } });
    });

    /* ficheiro único: as 24 fotografias vêm num <template> */
    var listaTodas = todas ? itensDe(todas.content) : [];
    function obraDe(href) { var m = /obras\/([^/#?]+)\.html/.exec(href); return m ? m[1] : ''; }

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var it = e.target.closest && e.target.closest('[data-visor] [data-visor-item]');
      if (it) {
        var lista = itensDe(it.closest('[data-visor]'));
        e.preventDefault(); abre(lista, Math.max(0, lista.indexOf(it)), it);
        return;
      }
      if (!todas) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var href = a.getAttribute('href');
      var obra = obraDe(href);
      if (!obra && !/^obras\.html/.test(href)) return;
      /* obras.html#vent abre só as obras dessa categoria; obras/<obra>.html abre nessa fotografia */
      var cat = obra ? '' : (href.split('#')[1] || '');
      var lista = listaTodas.filter(function (x) { return !cat || x.getAttribute('data-cat') === cat; });
      if (!lista.length) lista = listaTodas;
      var i = 0;
      if (obra) lista.forEach(function (x, k) { if (x.getAttribute('data-slug') === obra) i = k; });
      e.preventDefault(); abre(lista, i, a);
    });
  })();

  /* ═══ Filtros da página de obras (com endereço partilhável: obras.html#vent) ═══ */
  (function () {
    var grelha = document.querySelector('[data-obras-grelha]');
    if (!grelha) return;
    var chips = qsa('[data-filtro]'), cards = qsa('.obra-card', grelha);
    var conta = document.querySelector('[data-obras-conta]');
    function aplica(f, origem) {
      if (!chips.some(function (c) { return c.dataset.filtro === f; })) f = 'todas';
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.filtro === f ? 'true' : 'false'); });
      var i = 0;
      cards.forEach(function (c) {
        var mostra = f === 'todas' || c.dataset.cat === f;
        c.hidden = !mostra;
        if (mostra) c.style.setProperty('--i', i++);
      });
      if (conta) conta.textContent = i === 1 ? '1 obra' : i + ' obras';
      grelha.classList.remove('entra'); void grelha.offsetWidth; grelha.classList.add('entra');
      if (origem === 'clique') {
        try { history.replaceState(null, '', f === 'todas' ? location.pathname : '#' + f); } catch (e) {}
        track('obras_filtro', { filtro: f });
      }
    }
    chips.forEach(function (c) { c.addEventListener('click', function () { aplica(c.dataset.filtro, 'clique'); }); });
    var h = (location.hash || '').slice(1);
    aplica(h || 'todas', 'inicio');
    window.addEventListener('hashchange', function () { aplica((location.hash || '').slice(1) || 'todas', 'hash'); });
  })();

  /* ═══ Perguntas: registo de aberturas ═══ */
  qsa('details.faq-item').forEach(function (d) {
    d.addEventListener('toggle', function () { if (d.open) track('faq_aberta', { pergunta: d.querySelector('summary').textContent.trim() }); });
  });

  /* ═══ Pedido de orçamento ═══
     No site: Netlify Forms (formulário "orcamento" em src/partials/contacto.html). Com JavaScript, valida aqui,
     envia com fetch para "/" sem sair da página e, se falhar, deixa o que foi escrito e oferece telefone e WhatsApp.
     Sem JavaScript, o envio é normal e o Netlify mostra obrigado.html.
     No ficheiro único (MDM-index.html, aberto de file://) não há servidor: o botão abre o email do visitante com o
     pedido preparado e o campo da fotografia não aparece (a fotografia segue por WhatsApp). */
  var form = $('quoteForm');
  if (!form) return;
  form.noValidate = true;   /* a validação do browser só serve sem JavaScript; daqui em diante é a de baixo */

  var SEM_ENVIO = location.protocol === 'file:' || form.hasAttribute('data-sem-envio');
  var FOTO_MAX = 8 * 1000 * 1000;   /* o Netlify aceita até 8 MB por pedido */
  var TEL = '218 935 050', TEL_HREF = 'tel:+351218935050', EMAIL = 'mdmassist@mdmassist.com';
  var WA_BASE = 'https://wa.me/351910307579?text=';
  var TRIAGEM = {
    'Ar condicionado: montagem / instalação':   { p: 'P1', seg: 'Montagem AC' },
    'Bomba de calor: instalação / manutenção':  { p: 'P1', seg: 'Bomba de calor' },
    'Manutenção preventiva: contrato anual':    { p: 'P2', seg: 'Manutenção preventiva' },
    'Eletricidade: quadros e alimentações AVAC': { p: 'P3', seg: 'Eletricista certificado' },
    'Ar condicionado: avaria / reparação':      { p: 'P4', seg: 'Avaria AC' },
    'Eletricidade: avaria / reparação':         { p: 'P4', seg: 'Avaria elétrica' },
    'Ventilação: instalação / revisão':         { p: 'P4', seg: 'Ventilação' }
  };
  function triagem(s) { return TRIAGEM[s] || { p: 'P5', seg: s ? 'Outro' : 'Por classificar' }; }
  function etiqueta(s) { var t = triagem(s); return '[' + t.p + ' · ' + t.seg + ']'; }
  var foto = $('qFoto');
  function quoteData() {
    return { empresa: $('qNome').value.trim(), email: $('qEmail').value.trim(), tel: $('qTel').value.trim(),
             servico: $('qServico').value, msg: $('qMsg').value.trim(), potencia: pot.resumo(),
             foto: !SEM_ENVIO && foto && foto.files && foto.files[0] || null };
  }
  function quoteBody(d) {
    var l = ['Pedido de orçamento MDM', '', 'Nome/Empresa: ' + (d.empresa || '-'), 'Email: ' + (d.email || '-'),
             'Telefone: ' + (d.tel || '-'), 'Serviço: ' + (d.servico || '-'), 'Triagem: ' + etiqueta(d.servico)];
    if (d.potencia) l.push('Potência estimada: ' + d.potencia);
    return l.concat(['', d.msg || '']).join('\n');
  }
  function assunto(d) { return etiqueta(d.servico) + ' Pedido de orçamento, ' + (d.servico || 'serviços MDM'); }
  /* a mensagem e, se houver, ligações no fim: "…, [ligue 218 935 050] ou [envie-o por WhatsApp]." */
  function quoteAlert(msg, ok, ligacoes) {
    var a = $('quoteAlert');
    a.textContent = msg; a.classList.toggle('ok', !!ok);
    if (!ligacoes) return;
    ligacoes.forEach(function (l, i) {
      var el = document.createElement('a');
      el.href = l[0]; el.textContent = l[1];
      if (/^https:/.test(l[0])) { el.target = '_blank'; el.rel = 'noopener'; }
      a.appendChild(document.createTextNode(i ? ' ou ' : ' ')); a.appendChild(el);
    });
    a.appendChild(document.createTextNode('.'));
  }
  function erroCampo(id, msg) {
    var inp = $(id), e = $('e' + id.slice(1));
    if (msg) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
    if (e) e.textContent = msg || '';
  }
  function quoteValidate(d) {
    erroCampo('qNome'); erroCampo('qEmail'); erroCampo('qTel');
    var faltas = [], primeiro = null;
    if (!d.empresa) { erroCampo('qNome', 'Indique o seu nome ou o da empresa.'); faltas.push('indique o seu nome'); primeiro = primeiro || 'qNome'; }
    if (!d.email && !d.tel) {
      erroCampo('qEmail', 'Deixe um email ou um telefone.'); erroCampo('qTel', 'Deixe um telefone ou um email.');
      faltas.push('deixe um email ou um telefone para a resposta'); primeiro = primeiro || 'qEmail';
    } else if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) {
      erroCampo('qEmail', 'O email parece incompleto.'); faltas.push('verifique o email, parece incompleto'); primeiro = primeiro || 'qEmail';
    }
    if (faltas.length) { quoteAlert('Para enviar o pedido, ' + faltas.join(' e ') + '.'); $(primeiro).focus(); return false; }
    quoteAlert(''); return true;
  }
  /* o erro some assim que o campo fica válido, sem esperar por novo envio */
  ['qNome', 'qEmail', 'qTel'].forEach(function (id) {
    $(id).addEventListener('input', function () {
      if ($(id).getAttribute('aria-invalid') !== 'true') return;
      var d = quoteData();
      if (id === 'qNome' && d.empresa) erroCampo('qNome');
      if ((id === 'qEmail' || id === 'qTel') && (d.tel || /^\S+@\S+\.\S+$/.test(d.email))) { erroCampo('qEmail'); erroCampo('qTel'); }
      if (!qsa('#qNome[aria-invalid],#qEmail[aria-invalid],#qTel[aria-invalid]').length && !$('quoteAlert').classList.contains('ok')) quoteAlert('');
    });
  });

  /* fotografia (opcional): uma imagem até 8 MB. Se não servir, sai do pedido e o erro diz porquê */
  function fotoErro(f) {
    if (!f) return '';
    if (f.size > FOTO_MAX) return 'A fotografia tem mais de 8 MB e não segue com o pedido. Escolha uma mais pequena ou envie-a depois por WhatsApp.';
    if (f.type && !/^image\//.test(f.type)) return 'Este ficheiro não é uma fotografia e não segue com o pedido. Escolha uma imagem (JPG, PNG ou HEIC).';
    return '';
  }
  function confereFoto() {
    var msg = fotoErro(foto.files && foto.files[0]);
    erroCampo('qFoto', msg);
    if (msg) foto.value = '';
    return !msg;
  }
  if (foto) {
    if (SEM_ENVIO) { foto.disabled = true; foto.closest('[data-campo-foto]').hidden = true; }
    else foto.addEventListener('change', confereFoto);
  }

  /* ═══ Estimativa de potência por divisão («Não sabe a potência?», dentro do formulário) ═══
     Os números vêm de "btu" em data/site.json: o build.py põe-nos em data-btu (nada se pede à rede; serve no ficheiro único).
     Por divisão: BTU/h = área × porM2 × fator do tipo × sol × último andar, arredondado ao tamanho de "tamanhos" que serve:
     o primeiro que chega à conta com uma folga de "folga" (10%: 12 100 BTU/h fica num aparelho de 12 000, não salta para 18 000).
     Os campos das divisões não têm name e não seguem com o pedido. Só segue o resumo, no campo escondido "potencia",
     depois de «Juntar ao pedido»; a partir daí acompanha cada mudança até «Retirar». Sem JavaScript o bloco fica escondido.
     Na medição vão só números (quantas divisões e o total em BTU/h). */
  var pot = (function () {
    var raiz = form.querySelector('[data-potencia]'), campo = form.querySelector('[data-potencia-campo]');
    var sem = {
      resumo: function () { return campo ? campo.value : ''; },
      numeros: function (p) { return p; }
    };
    var cfg = null;
    try { cfg = JSON.parse(raiz.getAttribute('data-btu')); } catch (e) {}
    var tipos = cfg && cfg.tipos ? Object.keys(cfg.tipos) : [];
    var tamanhos = cfg && cfg.tamanhos ? cfg.tamanhos.slice().sort(function (a, b) { return a - b; }) : [];
    var modelo = raiz && raiz.querySelector('template[data-pot-modelo]');
    if (!campo || !modelo || !tipos.length || !tamanhos.length || !(cfg.porM2 > 0) || !(cfg.btuPorKw > 0)) return sem;
    var MAIOR = tamanhos[tamanhos.length - 1], MAX = cfg.maxDivisoes || 8;
    var FOLGA = cfg.folga >= 0 && cfg.folga < 0.5 ? cfg.folga : 0;
    var AREA_MIN = cfg.areaMin || 2, AREA_MAX = cfg.areaMax || 200;
    var POT_AC = 'Ar condicionado: montagem / instalação';
    var det = raiz.querySelector('details'), resumoEl = raiz.querySelector('[data-pot-resumo]');
    var lista = raiz.querySelector('[data-pot-divs]'), adiciona = raiz.querySelector('[data-pot-adiciona]');
    var maxNota = raiz.querySelector('[data-pot-max]'), totalEl = raiz.querySelector('[data-pot-total]');
    var multi = raiz.querySelector('[data-pot-multi]'), juntar = raiz.querySelector('[data-pot-juntar]');
    var caixa = raiz.querySelector('[data-pot-junta]'), caixaTxt = raiz.querySelector('[data-pot-junta-txt]');
    var notaServico = raiz.querySelector('[data-pot-servico]'), retirar = raiz.querySelector('[data-pot-retirar]');
    var anuncio = raiz.querySelector('[data-pot-anuncio]');
    var linhas = [], seq = 0, junto = false, atual = null;

    /* números à portuguesa: 9 000 BTU/h · 2,6 kW · 12,5 m² (espaço inseparável, para não partir a linha) */
    var NB = '\u00a0';
    function milhares(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
    function decimal(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
    function kw(btu) { return (btu / cfg.btuPorKw).toFixed(1).replace('.', ','); }
    function btuh(n) { return milhares(n) + NB + 'BTU/h'; }

    /* aceita 12, 12,5 e 12.5 (e um «m²» no fim) */
    function leArea(txt) {
      var t = String(txt || '').trim().replace(/\s*m(²|2)$/i, '').replace(',', '.');
      if (!t) return { vazio: true };
      if (!/^(\d+(\.\d*)?|\.\d+)$/.test(t)) return { erro: 'Escreva a área só com números, por exemplo 12 ou 12,5.' };
      var a = Math.round(parseFloat(t) * 100) / 100;
      if (a < AREA_MIN) return { erro: 'A área tem de ter pelo menos ' + decimal(AREA_MIN) + ' m².' };
      if (a > AREA_MAX) return { erro: 'Até ' + decimal(AREA_MAX) + ' m² por divisão. Para um espaço maior, a MDM dimensiona a instalação na visita.' };
      return { area: a };
    }
    function calcula(tipo, area, sol, topo) {
      var est = Math.round(area * cfg.porM2 * (cfg.tipos[tipo] || 1) * (sol ? cfg.sol || 1 : 1) * (topo ? cfg.ultimoAndar || 1 : 1));
      for (var i = 0; i < tamanhos.length; i++) if (tamanhos[i] >= est * (1 - FOLGA)) return { est: est, tam: tamanhos[i] };
      return { est: est, tam: 0 };   /* acima do maior tamanho */
    }

    function estado() {
      var r = { divs: [], n: 0, total: 0, acima: false };
      linhas.forEach(function (l, i) {
        l.leitura = leArea(l.area.value);
        l.calc = null;
        if (l.leitura.area == null) return;
        var d = { i: i, tipo: l.tipo.value, area: l.leitura.area, sol: l.sol.checked, topo: l.topo.checked };
        l.calc = calcula(d.tipo, d.area, d.sol, d.topo);
        d.tam = l.calc.tam;
        r.divs.push(d);
        r.total += d.tam || MAIOR;
        if (!d.tam) r.acima = true;
      });
      r.n = r.divs.length;
      return r;
    }
    /* uma parte por divisão e o total. No pedido seguem numa linha, com espaços normais:
       "Quarto 12 m² (muito sol): 7 000 BTU/h · Sala 25 m²: 12 000 BTU/h · Total 19 000 BTU/h (5,6 kW)" */
    function partesResumo(r) {
      if (!r || !r.n) return [];
      var partes = r.divs.map(function (d) {
        var extra = [];
        if (d.sol) extra.push('muito sol');
        if (d.topo) extra.push('último andar');
        return d.tipo + ' ' + decimal(d.area) + NB + 'm²' + (extra.length ? ' (' + extra.join(', ') + ')' : '') + ': ' +
          (d.tam ? btuh(d.tam) : 'mais de ' + btuh(MAIOR) + ', a dimensionar na visita');
      });
      partes.push('Total ' + (r.acima ? 'mais de ' : '') + btuh(r.total) + ' (' + kw(r.total) + NB + 'kW)');
      return partes;
    }
    function resumo(r) { return partesResumo(r).join(' · ').replace(/\u00a0/g, ' '); }
    function totalTexto(r) {
      return r.n ? 'Total: ' + (r.acima ? 'mais de ' : '') + btuh(r.total) + ', ' + kw(r.total) + ' kW.' : '';
    }

    /* o que muda no ecrã; o leitor de ecrã ouve só o que conta (anuncia), não cada tecla */
    function poeTexto(el, partes) {
      el.textContent = '';
      partes.forEach(function (p) {
        if (typeof p === 'string') { el.appendChild(document.createTextNode(p)); return; }
        var s = document.createElement(p[0]); if (p[2]) s.className = p[2]; s.textContent = p[1]; el.appendChild(s);
      });
    }
    function mostraLinha(l) {
      var c = l.calc;
      if (c && c.tam) poeTexto(l.res, [['strong', btuh(c.tam)], ' · ' + kw(c.tam) + NB + 'kW']);
      else if (c) poeTexto(l.res, [['strong', 'Mais de ' + btuh(MAIOR)],
        ['span', 'Pode precisar de mais do que um aparelho ou de um sistema de condutas. A MDM dimensiona a instalação na visita.', 'pot-res-nota']]);
      /* sem área (ou com uma área errada) a linha fica em branco: o pedido de área já está no total e o erro no campo */
      else poeTexto(l.res, []);
    }
    function mostraTotal(r) {
      totalEl.classList.toggle('vazio', !r.n);
      if (!r.n) poeTexto(totalEl, ['Escreva a área de pelo menos uma divisão.']);
      else poeTexto(totalEl, [(r.acima ? 'Mais de ' : '') + btuh(r.total),
        ['span', (r.acima ? 'mais de ' : '') + kw(r.total) + NB + 'kW · ' + (r.n === 1 ? '1 divisão' : r.n + ' divisões'), 'pot-total-s']]);
      multi.hidden = r.n < 2;
    }
    /* no campo do pedido, o texto seguido; no ecrã, uma linha por divisão */
    function sincroniza() {
      campo.value = junto ? resumo(atual) : '';
      caixa.hidden = !junto;
      juntar.hidden = junto;
      if (!junto) return;
      var partes = partesResumo(atual);
      poeTexto(resumoEl, partes.length ? partes.map(function (p) { return ['span', p, 'pot-junta-l']; })
        : ['falta a área das divisões. Escreva pelo menos uma.']);
    }
    function atualiza() {
      atual = estado();
      linhas.forEach(mostraLinha);
      mostraTotal(atual);
      sincroniza();
      return atual;
    }
    /* «ultimo» evita repetir o que acabou de se ouvir (a estimativa dita ao parar de escrever não se repete ao sair do
       campo). Retirar uma divisão ou a estimativa, «Juntar» sem área e uma área que fica vazia ou errada limpam-no:
       aí o mesmo texto volta a ouvir-se. Se for igual ao que está na região, esvazia-a primeiro, para ser lido outra vez. */
    var ultimo = '', tAnuncio = 0;
    function anuncia(txt, ja) {
      clearTimeout(tAnuncio);
      function vai() {
        if (!txt || txt === ultimo) return;
        ultimo = txt;
        if (anuncio.textContent !== txt) { anuncio.textContent = txt; return; }
        anuncio.textContent = '';
        tAnuncio = setTimeout(function () { anuncio.textContent = txt; }, 60);
      }
      if (ja) vai(); else tAnuncio = setTimeout(vai, 400);
    }
    function anunciaLinha(l, ja) {
      var i = linhas.indexOf(l), c = l.calc;
      /* sem estimativa (área vazia ou errada): cancela a que estava para sair, que já não é verdade */
      if (!c) { clearTimeout(tAnuncio); ultimo = ''; return; }
      anuncia('Divisão ' + (i + 1) + ': ' + (c.tam ? btuh(c.tam) : 'mais de ' + btuh(MAIOR) + ', a dimensionar na visita') + '. ' + totalTexto(atual), ja);
    }

    function poeErro(l, msg) {
      l.erro.textContent = msg || '';
      if (msg) l.area.setAttribute('aria-invalid', 'true'); else l.area.removeAttribute('aria-invalid');
    }
    /* o erro aparece ao sair do campo ou com Enter (não a meio de escrever) */
    function confere(l, forcado, calado) {
      var a = l.leitura || leArea(l.area.value);
      var msg = a.erro || (a.vazio && forcado ? 'Escreva a área desta divisão, por exemplo 12 ou 12,5.' : '');
      poeErro(l, msg);
      if (msg && !calado) anuncia('Divisão ' + (linhas.indexOf(l) + 1) + ': ' + msg, true);
      return !msg;
    }

    function numera() {
      linhas.forEach(function (l, i) {
        qsa('[data-pot-n]', l.el).forEach(function (s) { s.textContent = i + 1; });
        l.retira.hidden = i === 0;
      });
      var cheio = linhas.length >= MAX;
      adiciona.hidden = cheio;
      maxNota.hidden = !cheio;
    }
    function novaLinha() {
      seq++;
      var el = modelo.content.firstElementChild.cloneNode(true);
      var q = function (k) { return el.querySelector('[data-pot="' + k + '"]'); };
      var l = { el: el, tipo: q('tipo'), area: q('area'), sol: q('sol'), topo: q('topo'), erro: q('erro'), res: q('res'), retira: q('retira') };
      tipos.forEach(function (t) { var o = document.createElement('option'); o.value = t; o.textContent = t; l.tipo.appendChild(o); });
      ['tipo', 'area', 'sol', 'topo', 'erro'].forEach(function (k) { l[k].id = 'pot-' + k + '-' + seq; });
      qsa('label[data-pot-para]', el).forEach(function (lb) { lb.htmlFor = l[lb.getAttribute('data-pot-para')].id; });
      l.area.setAttribute('aria-describedby', l.erro.id);
      el.setAttribute('data-pot-linha', seq);
      lista.appendChild(el);
      linhas.push(l);
      return l;
    }
    function linhaDe(el) {
      var f = el.closest && el.closest('[data-pot-linha]');
      for (var i = 0; f && i < linhas.length; i++) if (linhas[i].el === f) return linhas[i];
      return null;
    }

    lista.addEventListener('input', function (e) {
      var l = linhaDe(e.target);
      if (!l || e.target !== l.area) return;
      atualiza();
      /* com o erro à vista, acompanha o que se escreve (some logo que a área fica certa) */
      if (l.area.getAttribute('aria-invalid') === 'true') poeErro(l, l.leitura.erro || '');
      anunciaLinha(l, false);
    });
    /* Ao sair da área com um clique (num botão, noutro campo), o erro só aparece depois de o clique acabar:
       se aparecesse logo, empurrava o que está por baixo e o clique perdia-se. Com Tab aparece logo a seguir. */
    var premido = false;
    document.addEventListener('pointerdown', function () { premido = true; }, true);
    document.addEventListener('pointerup', function () { premido = false; }, true);
    document.addEventListener('pointercancel', function () { premido = false; }, true);
    function depoisDoClique(fn) {
      if (!premido) { setTimeout(fn, 0); return; }
      function vai() {
        document.removeEventListener('pointerup', vai, true);
        document.removeEventListener('pointercancel', vai, true);
        setTimeout(fn, 0);
      }
      document.addEventListener('pointerup', vai, true);
      document.addEventListener('pointercancel', vai, true);
    }
    lista.addEventListener('change', function (e) {
      var l = linhaDe(e.target);
      if (!l) return;
      atualiza();
      if (e.target !== l.area) { anunciaLinha(l, true); return; }
      /* só mostra um erro (o que se escreve já o apaga quando a área fica certa): assim não desfaz o de «Juntar ao pedido» */
      depoisDoClique(function () {
        if (linhas.indexOf(l) < 0) return;
        if (l.leitura.erro) confere(l); else if (l.calc) anunciaLinha(l, true);
      });
    });
    /* Enter numa área ou numa caixa de escolha não envia o pedido; na área, confirma o valor */
    lista.addEventListener('keydown', function (e) {
      var l = linhaDe(e.target);
      if (!l || e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
      e.preventDefault();
      if (e.target !== l.area) return;
      atualiza();
      if (confere(l)) anunciaLinha(l, true);
    });
    lista.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-pot="retira"]');
      var l = b && linhaDe(b), i = l ? linhas.indexOf(l) : -1;
      if (i < 1) return;
      linhas.splice(i, 1);
      l.el.remove();
      numera();
      atualiza();
      /* o foco passa para a divisão que ficou no lugar desta ou, se era a última, para «Adicionar divisão» */
      (linhas[i] ? linhas[i].tipo : adiciona).focus();
      ultimo = '';
      anuncia('Divisão ' + (i + 1) + ' retirada. ' + totalTexto(atual), true);
    });
    adiciona.addEventListener('click', function () {
      if (linhas.length >= MAX) return;
      var l = novaLinha();
      numera();
      atualiza();
      l.tipo.focus();
    });
    juntar.addEventListener('click', function () {
      var r = atualiza();
      if (!r.n) {
        /* o erro de cada divisão fica no seu campo; o foco vai para a primeira e ouve-se uma só mensagem */
        var primeira = null;
        linhas.forEach(function (l) { if (!confere(l, true, true) && !primeira) primeira = l; });
        (primeira || linhas[0]).area.focus();
        ultimo = '';
        anuncia('Escreva a área de pelo menos uma divisão.', false);
        return;
      }
      junto = true;
      /* sem serviço escolhido, a estimativa é de ar condicionado: escolhe a montagem (e a triagem [P1 · Montagem AC]) */
      var sel = $('qServico'), antes = sel.value;
      if (!antes) escolheServico(POT_AC);
      notaServico.hidden = !!antes || sel.value !== POT_AC;
      sincroniza();
      caixaTxt.focus();
      track('potencia_junta', { divisoes: r.n, btu: r.total });
    });
    retirar.addEventListener('click', function () {
      junto = false;
      sincroniza();
      ultimo = '';
      anuncia('Estimativa retirada do pedido.', true);
      (det.open ? juntar : det.querySelector('summary')).focus();
    });
    /* «Escolhemos também o serviço…» só vale enquanto o visitante não muda o serviço (escolheServico não dispara change) */
    $('qServico').addEventListener('change', function () { notaServico.hidden = true; });
    /* depois de um envio, o formulário limpa-se: a estimativa volta a uma divisão vazia */
    form.addEventListener('reset', function () {
      setTimeout(function () {
        linhas.slice(1).forEach(function (l) { l.el.remove(); });
        linhas.length = Math.min(linhas.length, 1);
        linhas.forEach(function (l) { poeErro(l, ''); });
        junto = false; ultimo = '';
        numera();
        atualiza();
      }, 0);
    });

    /* ligações para #potencia (página do ar condicionado): abrem o bloco e levam lá o foco */
    function abre() {
      det.open = true;
      raiz.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      det.querySelector('summary').focus({ preventScroll: true });
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href="#potencia"]');
      if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      abre();
    });

    novaLinha();
    numera();
    atualiza();
    raiz.hidden = false;
    qsa('[data-pot-ligacao]').forEach(function (el) { el.hidden = false; });
    if (location.hash === '#potencia') abre();

    return {
      resumo: function () { return campo.value; },
      /* para a medição: só números, e só com a estimativa junta ao pedido */
      numeros: function (p) {
        if (junto && atual && atual.n) { p.divisoes = atual.n; p.btu = atual.total; }
        return p;
      }
    };
  })();

  /* campos escondidos que o Netlify guarda com o pedido: triagem e o assunto do email de aviso */
  function preparaCampos(d) {
    form.querySelector('[data-triagem]').value = etiqueta(d.servico);
    form.querySelector('[data-assunto]').value = assunto(d);
  }
  function enviaNetlify(d) {
    var ctl = window.AbortController ? new AbortController() : null;
    /* uma fotografia grande demora a subir numa rede móvel fraca */
    var timer = ctl && setTimeout(function () { ctl.abort(); }, d.foto ? 120000 : 20000);
    return fetch('/', { method: 'POST', body: new FormData(form), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { return r.ok; }, function () { return false; })
      .then(function (ok) { clearTimeout(timer); return ok; });
  }
  function quoteMailto(d) {
    location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(assunto(d)) + '&body=' + encodeURIComponent(quoteBody(d));
    quoteAlert('Abrimos o seu programa de email com o pedido preparado, falta só carregar em enviar. Se nada aconteceu, escreva para ' + EMAIL + ' ou ligue ' + TEL + '.', true);
  }
  if (SEM_ENVIO) $('sendEmailLbl').textContent = 'Enviar por email';
  function bloqueado() {
    if (!$('qGotcha').value) return false;
    quoteAlert('Não foi possível validar o pedido. Escreva-nos para ' + EMAIL + ' ou ligue ' + TEL + '.');
    return true;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('sendEmail'), lbl = $('sendEmailLbl');
    if (btn.getAttribute('aria-busy') === 'true' || bloqueado()) return;
    var d = quoteData(); if (!quoteValidate(d)) return;
    if (d.foto && !confereFoto()) { foto.focus(); return; }
    preparaCampos(d);
    track('quote_form_submit', pot.numeros({ via: SEM_ENVIO ? 'mailto' : 'netlify', servico: d.servico, prioridade: triagem(d.servico).p, segmento: triagem(d.servico).seg }));
    if (SEM_ENVIO) { quoteMailto(d); return; }
    btn.setAttribute('aria-busy', 'true'); lbl.textContent = d.foto ? 'A enviar a fotografia…' : 'A enviar…'; quoteAlert('');
    enviaNetlify(d).then(function (ok) {
      btn.removeAttribute('aria-busy');
      if (ok) {
        lbl.textContent = 'Pedido enviado';
        quoteAlert('Pedido recebido, obrigado. Vamos analisar o seu pedido e responder pelo email ou telefone que indicou. Se for urgente,', true,
          [[TEL_HREF, 'ligue ' + TEL],
           [WA_BASE + encodeURIComponent('Olá MDM. Acabei de enviar um pedido de orçamento pelo site.' + (d.potencia ? ' Potência estimada: ' + d.potencia + '.' : '') + ' ' + etiqueta(d.servico)), 'fale connosco por WhatsApp']]);
        form.reset(); erroCampo('qFoto'); escolheServico(form.getAttribute('data-preselect'));
        track('quote_form_ok', { servico: d.servico, segmento: triagem(d.servico).seg });
        setTimeout(function () { if (lbl.textContent === 'Pedido enviado') lbl.textContent = 'Enviar pedido'; }, 6000);
        return;
      }
      /* falhou (rede, tempo ou serviço): nada se apaga; o mesmo pedido pode seguir por telefone ou WhatsApp */
      track('quote_form_erro', { servico: d.servico });
      lbl.textContent = 'Tentar novamente';
      quoteAlert('Não conseguimos enviar o pedido agora. O que escreveu continua no formulário: tente de novo,', false,
        [[TEL_HREF, 'ligue ' + TEL], [WA_BASE + encodeURIComponent(quoteBody(d)), 'envie-o por WhatsApp']]);
    });
  });
  /* segunda via: o mesmo pedido validado, entregue por WhatsApp (a fotografia junta-se lá).
     Abre dentro do clique: depois de uma espera o browser bloqueia a janela. */
  $('sendWhats').addEventListener('click', function () {
    if (bloqueado()) return;
    var d = quoteData(); if (!quoteValidate(d)) return;
    track('quote_form_submit', pot.numeros({ via: 'whatsapp', servico: d.servico, prioridade: triagem(d.servico).p, segmento: triagem(d.servico).seg }));
    window.open(WA_BASE + encodeURIComponent(quoteBody(d)), '_blank', 'noopener');
    quoteAlert('Abrimos o WhatsApp com o pedido preenchido, falta só carregar em enviar.' + (d.foto ? ' Junte lá a fotografia.' : ''), true);
  });
  /* início do preenchimento: um evento por visita */
  (function () {
    var arrancou = false;
    form.addEventListener('focusin', function (e) {
      if (arrancou || !e.target.id) return;
      arrancou = true; track('quote_form_start', { campo: e.target.id });
    });
  })();
  /* serviço pré-escolhido: pela página (data-preselect) ou por uma ligação com data-preselect */
  function escolheServico(v) {
    var sel = $('qServico');
    if (!v) return;
    for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === v || sel.options[i].text === v) { sel.selectedIndex = i; return true; }
  }
  escolheServico(form.getAttribute('data-preselect'));
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-preselect]');
    if (!a) return;
    if (escolheServico(a.getAttribute('data-preselect'))) track('form_preselect', { servico: a.getAttribute('data-preselect') });
  });
})();
