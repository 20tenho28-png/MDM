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
        quoteAlert('Pedido recebido. Respondemos por email em menos de 24 horas úteis (2ª a 6ª, 8h–17h). Guardámos o seu contacto apenas para esta resposta. Se for urgente:', true, true);
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
