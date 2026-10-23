/* Melperfaz: comportamento do site. Sem dependências. O site funciona sem este ficheiro (o formulário envia pelo Netlify
   para obrigado.html, o comparador fica a meio e mexe-se em toda a fotografia, a página atual já vem marcada no HTML e,
   nos ecrãs estreitos, a barra de ações e o rodapé levam aos mesmos sítios que o menu). Só o «Pedido para:», o ?de= no
   campo «pagina» e o reencaminhamento dos endereços antigos (no topo de index.html) dependem dele. */
(function () {
  'use strict';
  var d = document;
  var qs = function (s, r) { return (r || d).querySelector(s); };
  var qsa = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TEL = '961 245 288';

  /* ═══ Menu nos ecrãs estreitos: o painel por cima de um fundo escurecido, sem a página deslizar por trás ═══ */
  (function () {
    var btn = qs('[data-menu]'), painel = qs('#menu-movel'), fundo = qs('[data-menu-fundo]');
    if (!btn || !painel) return;
    var aberto = false;
    function abre() {
      aberto = true;
      painel.hidden = false;
      if (fundo) fundo.hidden = false;
      d.documentElement.classList.add('menu-aberto');
      btn.setAttribute('aria-expanded', 'true');
      btn.setAttribute('aria-label', 'Fechar menu');
      var primeiro = qs('a', painel);
      if (primeiro) primeiro.focus();
    }
    function fecha(foco) {
      if (!aberto) return;
      aberto = false;
      painel.hidden = true;
      if (fundo) fundo.hidden = true;
      d.documentElement.classList.remove('menu-aberto');
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
    /* o foco saiu do painel pelo teclado (Tab depois da última ligação): fecha-se, para não tapar o elemento focado */
    painel.addEventListener('focusout', function (e) {
      if (aberto && e.relatedTarget && !painel.contains(e.relatedTarget) && e.relatedTarget !== btn) fecha(false);
    });
    /* ao alargar a janela o menu normal volta: o painel fecha-se */
    var mm = window.matchMedia ? matchMedia('(min-width: 981px)') : null;
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

  /* ═══ Comparador antes/depois ═══
     Sem JavaScript, o range invisível cobre a fotografia toda. Com ele, o range deixa de apanhar o rato e o toque
     (.ba-js) e só se arrasta a partir da pega (a 32 px da linha, para cada lado): um toque noutro sítio da fotografia
     não salta a linha e o deslize vertical continua a mexer a página (touch-action: pan-y). O range continua a ser o
     controlo do teclado (setas) e do leitor de ecrã, com o anel de foco desenhado à volta da pega. */
  var BA_PEGA = 32;
  qsa('[data-ba]').forEach(function (slider) {
    var before = qs('[data-ba-before]', slider), handle = qs('[data-ba-handle]', slider), range = qs('[data-ba-range]', slider);
    if (!before || !handle || !range) return;
    function largura() { slider.style.setProperty('--ba-w', slider.clientWidth + 'px'); }
    function move(v) { before.style.width = v + '%'; handle.style.left = v + '%'; }
    largura(); move(range.value);
    range.addEventListener('input', function () { move(range.value); });
    window.addEventListener('resize', largura);
    if ('ResizeObserver' in window) new ResizeObserver(largura).observe(slider);
    if (!window.PointerEvent) return;   /* sem Pointer Events fica o range a cobrir tudo, como sem JavaScript */
    slider.classList.add('ba-js');
    var arrasto = null;
    function valorEm(x) {
      var r = slider.getBoundingClientRect();
      return Math.max(0, Math.min(100, Math.round((x - r.left) / r.width * 100)));
    }
    function poe(v) {
      if (String(v) === range.value) return;
      range.value = v;
      move(v);
      range.dispatchEvent(new Event('input', { bubbles: true }));
    }
    slider.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var r = slider.getBoundingClientRect(), linha = r.left + r.width * range.value / 100;
      if (Math.abs(e.clientX - linha) > BA_PEGA) return;
      arrasto = e.pointerId;
      slider.classList.add('ba-a-arrastar');
      if (slider.setPointerCapture) slider.setPointerCapture(e.pointerId);
      e.preventDefault();   /* sem seleção de texto nem arrasto da imagem */
    });
    slider.addEventListener('pointermove', function (e) { if (e.pointerId === arrasto) poe(valorEm(e.clientX)); });
    function larga(e) {
      if (e.pointerId !== arrasto) return;
      arrasto = null;
      slider.classList.remove('ba-a-arrastar');
    }
    slider.addEventListener('pointerup', larga);
    slider.addEventListener('pointercancel', larga);   /* o browser ficou com o gesto (deslize vertical): larga-se */
  });

  /* ═══ orcamento.html: ?tipo=<id do serviço> escolhe o tipo de obra e mostra «Pedido para: X · alterar»; ?de=<página>
     vai para o campo escondido «pagina» (de onde veio o pedido, por exemplo obras/<slug>). O id é o de data/site.json
     «servicos» (data-tipo de cada opção); o nome da opção também serve ═══ */
  var tipoSel = qs('#qTipo');
  function param(nome) {
    var m = new RegExp('[?&]' + nome + '=([^&#]*)').exec(location.search);
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); } catch (e) { return ''; }   /* endereço estranho: ignora-se */
  }
  function escolheTipo(v) {
    if (!tipoSel || !v) return false;
    var op = qsa('option', tipoSel).filter(function (o) { return o.value && (o.getAttribute('data-tipo') === v || o.value === v); })[0];
    if (op) tipoSel.value = op.value;
    return !!op;
  }
  (function () {
    if (!tipoSel) return;
    var linha = qs('[data-pedido-para]'), nome = qs('[data-pedido-nome]'), alterar = qs('[data-pedido-alterar]');
    if (escolheTipo(param('tipo')) && linha && nome) {
      nome.textContent = tipoSel.value;
      linha.hidden = false;
      /* a linha acompanha a lista: outro tipo muda o nome, «Escolha uma opção» esconde-a */
      tipoSel.addEventListener('change', function () {
        nome.textContent = tipoSel.value;
        linha.hidden = !tipoSel.value;
      });
      if (alterar) alterar.addEventListener('click', function () { tipoSel.focus(); });
    }
    /* só um caminho de página do próprio site (letras, algarismos, -, / e .html), nunca um endereço de fora */
    var de = param('de'), pagina = qs('#quoteForm [name="pagina"]');
    if (pagina && /^[a-z0-9][a-z0-9\-\/]{0,119}(\.html)?$/.test(de) && de.indexOf('//') < 0) pagina.value = de;
  })();

  /* ═══ Formulário de pedido (Netlify Forms): valida em português, envia por fetch e, se correu bem, abre obrigado.html
     (a mesma página do envio sem JavaScript). Se falhar, o que se escreveu fica, e o alerta recebe o foco com o
     telefone e o WhatsApp (site.json «wa.erro», com o nome e o tipo escritos) ═══ */
  (function () {
    var form = qs('#quoteForm');
    if (!form) return;
    /* um browser sem estas APIs faz o envio normal (para /obrigado.html, pelo Netlify) */
    if (!window.fetch || !window.URLSearchParams || !window.FormData || !FormData.prototype.forEach) return;
    var alerta = qs('#formAlerta'), voz = qs('[data-form-voz]'), btn = qs('#sendBtn');
    var campos = { nome: qs('#qNome'), telefone: qs('#qTel'), email: qs('#qEmail') };
    var erros = { nome: qs('#eNome'), telefone: qs('#eTel'), email: qs('#eEmail') };
    var aEnviar = false, rotulo = btn.textContent;
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
      erro('telefone', tel ? (telOk ? '' : (digitos.length < 9 ? 'Escreva um telefone com pelo menos 9 algarismos.' : 'Escreva um telefone com 15 algarismos no máximo.')) : 'Escreva o seu telefone.');
      if (!telOk) falhas.push('telefone');
      var emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      erro('email', emailOk ? '' : 'Este email não parece certo. Confira ou deixe em branco.');
      if (!emailOk) falhas.push('email');
      return falhas;
    }
    /* a ligação de WhatsApp do alerta: «Olá! Sou {nome} e queria um orçamento para {tipo}. …» */
    function waErro() {
      var base = form.getAttribute('data-wa'), msg = form.getAttribute('data-wa-erro');
      if (!base || !msg) return '';
      var tipo = tipoSel && tipoSel.value && tipoSel.value !== 'Outro' ? tipoSel.value : 'uma obra';
      msg = msg.replace('{nome}', campos.nome.value.trim()).replace('{tipo}', tipo);
      return base + encodeURIComponent(msg);
    }
    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function mostraAlerta() {
      if (!alerta) return;
      var wa = waErro();
      alerta.innerHTML = 'O pedido não seguiu. Tente outra vez, ligue <a href="tel:+351961245288">' + TEL + '</a>' +
        (wa ? ' ou <a href="' + esc(wa) + '" target="_blank" rel="noopener" data-wa-erro>envie por WhatsApp</a>.' : '.') +
        ' O que escreveu fica aqui.';
      alerta.hidden = false;
      alerta.focus();   /* o botão ficou desativado com o foco: sem isto o foco caía no body */
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
      if (isco && isco.value) { mostraAlerta(); return; }
      ['nome', 'telefone', 'email'].forEach(function (n) { if (campos[n]) campos[n].value = campos[n].value.trim(); });
      aEnviar = true;
      btn.disabled = true;
      btn.textContent = 'A enviar…';
      diz('A enviar o pedido.');
      var dados = new URLSearchParams();
      new FormData(form).forEach(function (v, k) { dados.append(k, v); });
      var ctl = ('AbortController' in window) ? new AbortController() : null;
      var tempo = ctl ? setTimeout(function () { ctl.abort(); }, 20000) : null;
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: dados.toString(), signal: ctl ? ctl.signal : undefined })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          if (tempo) clearTimeout(tempo);
          location.assign('obrigado.html');   /* o botão fica em «A enviar…» até a página mudar */
        })
        .catch(function () {
          if (tempo) clearTimeout(tempo);
          aEnviar = false;
          btn.disabled = false;
          btn.textContent = rotulo;
          mostraAlerta();
        });
    });
    /* de volta de obrigado.html pelo botão «Voltar» (página guardada pelo browser): o botão volta a enviar */
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted || !aEnviar) return;
      aEnviar = false;
      btn.disabled = false;
      btn.textContent = rotulo;
    });
  })();
})();
