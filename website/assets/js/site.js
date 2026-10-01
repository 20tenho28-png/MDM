/* MDM Assistência Técnica — comportamento do site.
   Sem dependências. A lógica de pedidos, triagem e medição vem do site anterior (index-carmim.html),
   mantida tal como estava; o resto é novo (gaveta, topo compacto, barra móvel, carrossel, filtros, revelação). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var qsa = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══ Medição: PostHog na UE, sem cookies (persistence memory), respeita a recusa ═══ */
  var _trackQueue = [];
  var ORIGEM = '';   /* só na página das carrinhas: "Carrinha 01 · traseira" (ver abaixo) */
  function track(event, props) {
    if (window.MDM_SEM_MEDICAO) return;
    props = props || {};
    if (ORIGEM && !props.origem) props.origem = ORIGEM;
    try {
      if (window.posthog && window.posthog.capture) window.posthog.capture(event, props);
      else _trackQueue.push([event, props]);
    } catch (e) {}
  }
  window.mdmTrack = track;
  (function () {
    if (window.MDM_SEM_MEDICAO || location.protocol === 'file:') return;
    var el = document.createElement('script');
    el.src = 'https://eu-assets.i.posthog.com/static/array.js';
    el.async = true;
    el.onload = function () {
      /* o visitante pode ter recusado enquanto o script descarregava (privacidade.html) */
      if (window.MDM_SEM_MEDICAO) { _trackQueue.length = 0; return; }
      try {
        window.posthog.init('phc_veB6kR2as8m8HuRMEVuTUWubWQxLkPW5D8Uf6wsJcy8A', {
          api_host: 'https://eu.i.posthog.com', persistence: 'memory', person_profiles: 'identified_only',
          autocapture: false, enable_heatmaps: true, capture_dead_clicks: true
        });
        while (_trackQueue.length) { var t = _trackQueue.shift(); window.posthog.capture(t[0], t[1]); }
      } catch (e) {}
    };
    document.head.appendChild(el);
  })();

  /* ═══ Origem: código QR das carrinhas (carrinha.html?v=01&p=t, gerado por marketing/gerar_qr.py) ═══
     Junta a carrinha e o lado ao WhatsApp, ao formulário e à medição, para saber que carrinha traz contactos.
     Vale só nesta página e nesta visita: nada fica guardado no equipamento. */
  (function () {
    var alvo = document.querySelector('[data-origem-qr]');
    if (!alvo) return;
    var LADOS = { t: 'traseira', e: 'lateral esquerda', d: 'lateral direita', m: 'íman', c: 'cartão de vizinho' };
    var v = '', p = '';
    try { var q = new URLSearchParams(location.search); v = (q.get('v') || '').replace(/\D/g, '').slice(0, 3); p = LADOS[q.get('p')] || ''; } catch (e) {}
    if (v.length === 1) v = '0' + v;
    var txt = 'Carrinha' + (v ? ' ' + v : '') + (p ? ' · ' + p : '');
    if (v || p) { var t = alvo.querySelector('[data-origem-texto]'); if (t) t.textContent = txt; alvo.hidden = false; }
    track('qr_carrinha', { carrinha: v || 'sem número', lado: p || 'desconhecido', origem: txt });
    ORIGEM = txt;
    /* a etiqueta da origem vai no fim da mensagem de WhatsApp pré-preenchida */
    qsa('a[href^="https://wa.me/"]').forEach(function (a) { a.href += encodeURIComponent(' [' + txt + ']'); });
    /* ligações para secções que também existem nesta página ficam nesta página (e a origem não se perde) */
    qsa('a[href*="index.html#"]').forEach(function (a) {
      var id = a.getAttribute('href').split('#')[1];
      if (id && document.getElementById(id)) a.setAttribute('href', '#' + id);
    });
  })();

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
    if (nav) qsa('[data-nav-item="' + nav + '"]').forEach(function (a) { a.setAttribute('aria-current', 'page'); });
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
    }, { threshold: [0.05, 0.6] });
    alvos.forEach(function (a) { io.observe(a); });
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
        qsa('source', pic).forEach(function (s) { s.setAttribute('sizes', '100vw'); });
        var img = pic.querySelector('img');
        if (img) {
          img.removeAttribute('fetchpriority');
          img.setAttribute('sizes', '100vw');
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
      /* o "voltar" do telemóvel fecha o visor; a posição da página não salta para uma secção (#) ao voltar */
      try { history.scrollRestoration = 'manual'; history.pushState({ visor: 1 }, ''); comHistorico = true; } catch (e) { comHistorico = false; }
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
      requestAnimationFrame(function () { try { history.scrollRestoration = 'auto'; } catch (e) {} });
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

  /* ═══ Pedido de orçamento ═══ */
  var form = $('quoteForm');
  if (!form) return;

  var LEAD_ENDPOINT = '';   /* receptor de pedidos (Supabase ou Base44). Vazio: o botão abre o email do visitante */
  var WA_BASE = 'https://wa.me/351910307579?text=';
  var TRIAGEM = {
    'Ar condicionado: montagem / instalação':   { p: 'P1', seg: 'Montagem AC' },
    'Manutenção preventiva: contrato anual':    { p: 'P2', seg: 'Manutenção preventiva' },
    'Eletricidade: quadros e alimentações AVAC': { p: 'P3', seg: 'Eletricista certificado' },
    'Ar condicionado: avaria / reparação':      { p: 'P4', seg: 'Avaria AC' },
    'Eletricidade: avaria / reparação':         { p: 'P4', seg: 'Avaria elétrica' },
    'Ventilação: instalação / revisão':         { p: 'P4', seg: 'Ventilação' }
  };
  function triagem(s) { return TRIAGEM[s] || { p: 'P5', seg: s ? 'Outro' : 'Por classificar' }; }
  function etiqueta(s) { var t = triagem(s); return '[' + t.p + ' · ' + t.seg + ']'; }
  function quoteData() {
    return { empresa: $('qNome').value.trim(), email: $('qEmail').value.trim(), tel: $('qTel').value.trim(),
             servico: $('qServico').value, msg: $('qMsg').value.trim() };
  }
  function quoteBody(d) {
    var l = ['Pedido de orçamento MDM', '', 'Nome/Empresa: ' + (d.empresa || '-'), 'Email: ' + (d.email || '-'),
             'Telefone: ' + (d.tel || '-'), 'Serviço: ' + (d.servico || '-'), 'Triagem: ' + etiqueta(d.servico)];
    if (ORIGEM) l.push('Origem: ' + ORIGEM);
    return l.concat(['', d.msg || '']).join('\n');
  }
  function quoteAlert(msg, ok, comWhats) {
    var a = $('quoteAlert');
    a.textContent = msg; a.classList.toggle('ok', !!ok);
    if (comWhats) {
      var l = document.createElement('a');
      l.href = WA_BASE + encodeURIComponent('Olá MDM. Acabei de enviar um pedido de orçamento pelo site.' + (ORIGEM ? ' [' + ORIGEM + ']' : ''));
      l.target = '_blank'; l.rel = 'noopener'; l.textContent = 'Falar agora por WhatsApp';
      a.appendChild(document.createTextNode(' ')); a.appendChild(l);
    }
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
  function sendLead(payload) {
    if (!LEAD_ENDPOINT) return Promise.resolve(false);
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 8000);
    return fetch(LEAD_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, signal: ctl.signal,
      body: JSON.stringify(Object.assign({}, payload, {
        prioridade: triagem(payload.servico).p, segmento: triagem(payload.servico).seg,
        pagina: location.href, referrer: document.referrer || '', utm: location.search.slice(1), carrinha: ORIGEM, ts: new Date().toISOString()
      }))
    }).then(function (r) { return r.ok; }).catch(function () { return false; }).then(function (ok) { clearTimeout(timer); return ok; });
  }
  function quoteMailto(d) {
    location.href = 'mailto:mdmassist@mdmassist.com?subject=' + encodeURIComponent(etiqueta(d.servico) + ' Pedido de orçamento, ' + (d.servico || 'serviços MDM'))
      + '&body=' + encodeURIComponent(quoteBody(d));
    quoteAlert('Abrimos o seu programa de email com o pedido preparado, falta só carregar em enviar. Se nada aconteceu, escreva para mdmassist@mdmassist.com ou ligue 218 935 050.', true);
  }
  if (LEAD_ENDPOINT) $('sendEmailLbl').textContent = 'Enviar pedido';
  function bloqueado() {
    if (!$('qGotcha').value) return false;
    quoteAlert('Não foi possível validar o pedido. Escreva-nos para mdmassist@mdmassist.com ou ligue 218 935 050.');
    return true;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('sendEmail'), lbl = $('sendEmailLbl');
    if (btn.getAttribute('aria-busy') === 'true' || bloqueado()) return;
    var d = quoteData(); if (!quoteValidate(d)) return;
    track('quote_form_submit', { via: LEAD_ENDPOINT ? 'endpoint' : 'mailto', servico: d.servico, prioridade: triagem(d.servico).p, segmento: triagem(d.servico).seg });
    if (!LEAD_ENDPOINT) { quoteMailto(d); return; }
    btn.setAttribute('aria-busy', 'true'); lbl.textContent = 'A enviar…'; quoteAlert('');
    sendLead(Object.assign({}, d, { origem: 'formulario' })).then(function (ok) {
      btn.removeAttribute('aria-busy');
      if (ok) {
        lbl.textContent = 'Pedido enviado';
        quoteAlert('Pedido recebido, obrigado. Vamos analisar o seu pedido e responder pelo email ou telefone que indicou. Guardámos o seu contacto apenas para esta resposta. Se for urgente:', true, true);
        form.reset(); track('quote_form_ok', { servico: d.servico, segmento: triagem(d.servico).seg });
        setTimeout(function () { lbl.textContent = 'Enviar pedido'; }, 6000);
        return;
      }
      track('quote_form_erro', { servico: d.servico });
      if (!btn.dataset.falhou) {
        btn.dataset.falhou = '1'; lbl.textContent = 'Tentar novamente';
        quoteAlert('Não conseguimos enviar o pedido (falha de rede ou serviço indisponível). Toque em "Tentar novamente". Se continuar, abrimos o seu email com o pedido preparado.');
        return;
      }
      quoteMailto(d);   /* 2.ª falha: o pedido não se perde, segue pelo email */
    });
  });
  /* segunda via: o mesmo pedido validado, entregue por WhatsApp.
     Abre dentro do clique: depois de uma espera o browser bloqueia a janela. */
  $('sendWhats').addEventListener('click', function () {
    if (bloqueado()) return;
    var d = quoteData(); if (!quoteValidate(d)) return;
    track('quote_form_submit', { via: 'whatsapp', servico: d.servico, prioridade: triagem(d.servico).p, segmento: triagem(d.servico).seg });
    window.open(WA_BASE + encodeURIComponent(quoteBody(d)), '_blank', 'noopener');
    if (LEAD_ENDPOINT) sendLead(Object.assign({}, d, { origem: 'formulario-whatsapp' }));
    quoteAlert('Abrimos o WhatsApp com o pedido preenchido, falta só carregar em enviar.', true);
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
  (function () {
    var sel = $('qServico');
    function escolhe(v) {
      if (!v) return;
      for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === v || sel.options[i].text === v) { sel.selectedIndex = i; return true; }
    }
    escolhe(form.getAttribute('data-preselect'));
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-preselect]');
      if (!a) return;
      if (escolhe(a.getAttribute('data-preselect'))) track('form_preselect', { servico: a.getAttribute('data-preselect') });
    });
  })();
})();
