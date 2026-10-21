/* Melperfaz: comportamento do site. Sem dependências. O site funciona sem este ficheiro (o formulário envia pelo Netlify
   para obrigado.html, o comparador fica a meio, o menu dos ecrãs estreitos fica no rodapé). */
(function () {
  'use strict';
  var d = document;
  var qs = function (s, r) { return (r || d).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TEL = '961 245 288';

  /* ═══ Menu atual ═══ */
  var nav = d.body.getAttribute('data-nav');
  if (nav) {
    qsa('[data-nav-item="' + nav + '"]').forEach(function (a) { a.setAttribute('aria-current', 'page'); });
  }

  /* ═══ Menu nos ecrãs estreitos ═══ */
  (function () {
    var btn = qs('[data-menu]'), painel = qs('#menu-movel');
    if (!btn || !painel) return;
    var aberto = false;
    function abre() {
      aberto = true;
      painel.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Fechar menu');
      var primeiro = qs('a', painel);
      if (primeiro) primeiro.focus();
    }
    function fecha(foco) {
      if (!aberto) return;
      aberto = false;
      painel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', 'Abrir menu');
      if (foco) btn.focus();
    }
    btn.addEventListener('click', function () { if (aberto) fecha(true); else abre(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && aberto) fecha(true); });
    d.addEventListener('click', function (e) {
      if (aberto && !painel.contains(e.target) && !btn.contains(e.target)) fecha(false);
    });
    qsa('a', painel).forEach(function (a) { a.addEventListener('click', function () { fecha(false); }); });
    /* ao alargar a janela o menu normal volta: o painel fecha-se */
    var mm = window.matchMedia ? matchMedia('(min-width: 901px)') : null;
    if (mm && mm.addEventListener) mm.addEventListener('change', function (e) { if (e.matches) fecha(false); });
  })();

  /* ═══ Entrada ao fazer scroll (.reveal → .in), em cascata de 70 ms ═══ */
  (function () {
    var els = qsa('.reveal');
    if (!els.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      var i = 0;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        setTimeout(function () { el.classList.add('in'); }, 70 * i++);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    els.forEach(function (e) { io.observe(e); });
    /* o que já está à vista ao carregar entra logo (sem esperar pelo primeiro scroll) */
    setTimeout(function () { els.forEach(function (e) { var r = e.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) e.classList.add('in'); }); }, 900);
  })();

  /* ═══ Comparador antes/depois ═══ */
  qsa('[data-ba]').forEach(function (slider) {
    var before = qs('[data-ba-before]', slider), handle = qs('[data-ba-handle]', slider), range = qs('[data-ba-range]', slider);
    if (!before || !handle || !range) return;
    function largura() { slider.style.setProperty('--ba-w', slider.clientWidth + 'px'); }
    function move(v) { before.style.width = v + '%'; handle.style.left = v + '%'; }
    largura(); move(range.value);
    range.addEventListener('input', function () { move(range.value); });
    window.addEventListener('resize', largura);
    if ('ResizeObserver' in window) new ResizeObserver(largura).observe(slider);
  });

  /* ═══ Tipo de obra pré-escolhido: ?tipo=… no endereço ou data-preselect numa ligação da própria página ═══ */
  var tipoSel = qs('#qTipo');
  function escolheTipo(v) {
    if (!tipoSel || !v) return false;
    var ok = qsa('option', tipoSel).some(function (o) { return o.value === v; });
    if (ok) tipoSel.value = v;
    return ok;
  }
  (function () {
    var m = /[?&]tipo=([^&#]*)/.exec(location.search);
    if (m) {
      try { escolheTipo(decodeURIComponent(m[1].replace(/\+/g, ' '))); } catch (e) { /* endereço estranho: ignora-se */ }
    }
    qsa('[data-preselect]').forEach(function (a) {
      a.addEventListener('click', function () { escolheTipo(a.getAttribute('data-preselect')); });
    });
  })();

  /* ═══ Formulário de pedido (Netlify Forms, sem sair da página) ═══ */
  (function () {
    var form = qs('#quoteForm');
    if (!form) return;
    var ok = qs('[data-form-ok]'), alerta = qs('#formAlerta'), voz = qs('[data-form-voz]'), btn = qs('#sendBtn');
    var campos = { nome: qs('#qNome'), telefone: qs('#qTel'), email: qs('#qEmail') };
    var erros = { nome: qs('#eNome'), telefone: qs('#eTel'), email: qs('#eEmail') };
    var aEnviar = false;
    form.noValidate = true;   /* a validação do browser só serve sem JavaScript; aqui fala-se português */

    function diz(t) { if (voz) { voz.textContent = ''; setTimeout(function () { voz.textContent = t; }, 50); } }
    function erro(nome, msg) {
      var el = campos[nome], p = erros[nome];
      if (!el) return;
      if (msg) { el.setAttribute('aria-invalid', 'true'); if (p) p.textContent = msg; }
      else { el.removeAttribute('aria-invalid'); if (p) p.textContent = ''; }
    }
    function valida() {
      var falhas = [];
      var nome = campos.nome.value.trim(), tel = campos.telefone.value.trim(), email = campos.email ? campos.email.value.trim() : '';
      erro('nome', nome ? '' : 'Escreva o seu nome.'); if (!nome) falhas.push('nome');
      var digitos = tel.replace(/\D/g, '');
      var telOk = digitos.length >= 9 && digitos.length <= 15;
      erro('telefone', tel ? (telOk ? '' : 'Escreva um telefone com pelo menos 9 algarismos.') : 'Escreva o seu telefone.');
      if (!telOk) falhas.push('telefone');
      var emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      erro('email', emailOk ? '' : 'Este email não parece certo. Confira ou deixe em branco.');
      if (!emailOk) falhas.push('email');
      return falhas;
    }
    function mostraAlerta(html) {
      if (!alerta) return;
      alerta.innerHTML = html;
      alerta.hidden = false;
    }
    function escondeAlerta() { if (alerta) { alerta.hidden = true; alerta.innerHTML = ''; } }
    ['nome', 'telefone', 'email'].forEach(function (n) {
      if (campos[n]) campos[n].addEventListener('input', function () { if (campos[n].getAttribute('aria-invalid')) { erro(n, ''); } });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (aEnviar) return;
      escondeAlerta();
      var falhas = valida();
      if (falhas.length) {
        campos[falhas[0]].focus();
        diz('Falta corrigir ' + falhas.length + (falhas.length === 1 ? ' campo.' : ' campos.'));
        return;
      }
      /* a armadilha para robôs: um humano não a vê nem a preenche; se vier cheia, o pedido não segue */
      var isco = qs('[name="bot-field"]', form);
      if (isco && isco.value) { mostraAlerta('Ups, algo correu mal. Ligue ' + TEL + '.'); return; }
      aEnviar = true;
      btn.disabled = true;
      var rotulo = btn.textContent;
      btn.textContent = 'A enviar…';
      diz('A enviar o pedido.');
      var dados = new URLSearchParams();
      new FormData(form).forEach(function (v, k) { dados.append(k, v); });
      var ctl = ('AbortController' in window) ? new AbortController() : null;
      var tempo = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : null;
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: dados.toString(), signal: ctl ? ctl.signal : undefined })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          form.hidden = true;
          if (ok) { ok.hidden = false; ok.focus(); }
          diz('Pedido enviado. Obrigado.');
        })
        .catch(function () {
          mostraAlerta('Ups, algo correu mal e o pedido não seguiu. Tente outra vez ou ligue <a href="tel:+351961245288">' + TEL + '</a>. O que escreveu fica aqui.');
          diz('O pedido não seguiu. Tente outra vez ou ligue ' + TEL + '.');
        })
        .then(function () {
          if (tempo) clearTimeout(tempo);
          aEnviar = false;
          btn.disabled = false;
          btn.textContent = rotulo;
        });
    });

    var novo = qs('[data-form-novo]');
    if (novo) novo.addEventListener('click', function () {
      form.reset();
      ['nome', 'telefone', 'email'].forEach(function (n) { erro(n, ''); });
      escondeAlerta();
      if (ok) ok.hidden = true;
      form.hidden = false;
      campos.nome.focus();
    });
  })();
})();
