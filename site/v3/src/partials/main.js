(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var PAGE = document.body.dataset.page || 'home';
  /* ── estatísticas: PostHog só depois de "Aceitar" ── */
  var queue = [];
  function track(ev, props) { props = Object.assign({ page: PAGE }, props || {}); if (window.posthog && window.posthog.capture) window.posthog.capture(ev, props); else queue.push([ev, props]); }
  function loadPostHog() {
    if (window.posthog) return;
    var el = document.createElement('script'); el.src = 'https://eu-assets.i.posthog.com/static/array.js'; el.async = true;
    el.onload = function () { try { window.posthog.init('phc_veB6kR2as8m8HuRMEVuTUWubWQxLkPW5D8Uf6wsJcy8A', { api_host: 'https://eu.i.posthog.com', person_profiles: 'identified_only', autocapture: false, capture_pageview: true }); while (queue.length) { var t = queue.shift(); window.posthog.capture(t[0], t[1]); } } catch (e) {} };
    document.head.appendChild(el);
  }
  var consent = $('#consent'), choice = null;
  try { choice = localStorage.getItem('mdm-consent'); } catch (e) {}
  if (choice === 'yes') loadPostHog(); else if (!choice && consent) consent.hidden = false;
  if (consent) consent.addEventListener('click', function (e) {
    var b = e.target.closest('[data-consent]'); if (!b) return;
    try { localStorage.setItem('mdm-consent', b.dataset.consent); } catch (err) {}
    consent.hidden = true; if (b.dataset.consent === 'yes') loadPostHog(); else queue.length = 0;
  });
  var reopen = $('#consentReopen'); if (reopen) reopen.addEventListener('click', function (e) { e.preventDefault(); if (consent) { consent.hidden = false; consent.querySelector('button').focus(); } });
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-ch]'); if (!a) return;
    track(a.dataset.ch === 'call' ? 'call_tap' : 'whatsapp_tap', { service: servico ? servico.value : '' });
  });
  /* ── header ── */
  var nav = $('#nav'); addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 8); }, { passive: true });
  var burger = $('#burger'), drawer = $('#mDrawer'), bd = $('.m-backdrop'), mbar = $('#mbar');
  var outside = [$('main'), $('footer')].filter(Boolean);
  function setMenu(open) {
    drawer.hidden = bd.hidden = !open; burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.documentElement.style.overflow = open ? 'hidden' : ''; outside.forEach(function (el) { el.inert = open; });
    if (mbar) mbar.classList.toggle('is-hidden', open || formVisible);
    if (open) drawer.querySelector('a').focus();
  }
  function closeMenu(focus) { if (drawer.hidden) return; setMenu(false); if (focus) burger.focus(); }
  if (burger) {
    burger.addEventListener('click', function () { drawer.hidden ? setMenu(true) : closeMenu(true); });
    bd.addEventListener('click', function () { closeMenu(true); });
    drawer.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { closeMenu(false); }); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(true); });
    matchMedia('(min-width: 1024px)').addEventListener('change', function (e) { if (e.matches) closeMenu(false); });
  }
  /* ── barra móvel escondida quando o formulário está à vista ── */
  var formVisible = false, form = $('#quoteForm');
  if (mbar && form && 'IntersectionObserver' in window) new IntersectionObserver(function (en) { formVisible = en[0].isIntersecting; mbar.classList.toggle('is-hidden', formVisible || (drawer && !drawer.hidden)); }, { threshold: 0.15 }).observe($('#orcamento'));
  /* ── pré-seleção do serviço ── */
  var servico = $('#servico');
  document.addEventListener('click', function (e) { var a = e.target.closest('[data-servico]'); if (a && servico) servico.value = a.dataset.servico; });
  if (servico && document.body.dataset.servico) servico.value = document.body.dataset.servico;
  if (!form) return;
  /* ── formulário ── */
  var started = false; form.addEventListener('focusin', function () { if (!started) { started = true; track('form_start', { service: servico.value }); } });
  var file = $('#fotografia'), fileName = $('#fileName');
  file.addEventListener('change', function () { var f = file.files[0]; if (f && f.size > 8 * 1024 * 1024) { file.value = ''; fileName.textContent = 'A fotografia tem mais de 8 MB. Escolha outra.'; } else fileName.textContent = f ? f.name : 'Escolher fotografia (até 8 MB)'; });
  var checks = [
    ['f-servico', function () { return !!servico.value; }, 'o serviço'],
    ['f-imovel', function () { return !!form.querySelector('[name=imovel]:checked'); }, 'o tipo de imóvel'],
    ['f-urgencia', function () { return !!form.querySelector('[name=urgencia]:checked'); }, 'a urgência'],
    ['f-localidade', function () { return form.localidade.value.trim().length > 1; }, 'a localidade'],
    ['f-contacto', function () { var c = form.contacto.value.trim(); return form.nome.value.trim().length > 1 && (/^\S+@\S+\.\S+$/.test(c) || c.replace(/\D/g, '').length >= 9); }, 'o nome e um contacto']
  ];
  function validate() {
    var missing = [], first = null;
    checks.forEach(function (c) { var box = document.getElementById(c[0]), ok = c[1](); box.classList.toggle('is-invalid', !ok); box.querySelector('.err-msg').hidden = ok;
      box.querySelectorAll('input,select').forEach(function (i) { if (ok) i.removeAttribute('aria-invalid'); else i.setAttribute('aria-invalid', 'true'); });
      if (!ok) { missing.push(c[2]); if (!first) first = box.querySelector('input,select'); } });
    var sum = $('#formSummary');
    if (missing.length) { sum.textContent = (missing.length === 1 ? 'Falta ' : 'Faltam ') + missing.join(', ').replace(/, ([^,]*)$/, ' e $1') + '.'; sum.hidden = false; first.focus(); return false; }
    sum.hidden = true; return true;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault(); if (!validate()) return;
    var btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'A enviar…';
    fetch(form.getAttribute('action'), { method: 'POST', body: new FormData(form) }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      track('form_submit', { service: servico.value, urgencia: (form.querySelector('[name=urgencia]:checked') || {}).value });
      var ok = $('#formOk'); $('#okName').textContent = ', ' + form.nome.value.trim().split(' ')[0];
      $('#okUrgent').hidden = (form.querySelector('[name=urgencia]:checked') || {}).value !== 'Tenho uma avaria';
      form.hidden = true; ok.hidden = false; ok.focus();
    }).catch(function () {
      btn.disabled = false; btn.textContent = 'Enviar pedido'; var sum = $('#formSummary');
      sum.innerHTML = 'Não foi possível enviar agora. Tente de novo ou ligue <a href="tel:+351218935050">218 935 050</a>.'; sum.hidden = false; sum.focus && sum.setAttribute('tabindex', '-1'); sum.focus();
    });
  });
})();
