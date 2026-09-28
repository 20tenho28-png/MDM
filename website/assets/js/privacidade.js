/* Política de privacidade: recusar ou aceitar a medição de audiência (PostHog).
   A recusa grava 'mdm-sem-medicao' = '1' no localStorage; o layout lê-a antes de site.js
   (window.MDM_SEM_MEDICAO) e, com ela, o PostHog nem chega a ser descarregado. */
(function () {
  'use strict';
  var caixa = document.querySelector('[data-medicao]');
  if (!caixa) return;
  var estado = caixa.querySelector('[data-medicao-estado]');
  var botao = caixa.querySelector('[data-medicao-botao]');
  var CHAVE = 'mdm-sem-medicao';

  function le() {
    try { return { ok: true, recusada: localStorage.getItem(CHAVE) === '1' }; }
    catch (e) { return { ok: false, recusada: false }; }
  }

  /* se o PostHog já estiver a correr nesta página, deixa de enviar a partir de agora
     (sem opt_out_capturing, que gravaria outra entrada no localStorage) */
  function paraNestaPagina() {
    try { if (window.posthog && window.posthog.capture) window.posthog.capture = function () {}; } catch (e) {}
  }

  function mostra(s, depoisDeMudar) {
    if (!s.ok) {
      estado.textContent = 'O seu browser não deixa este site guardar a escolha (por exemplo, numa janela privada com o armazenamento bloqueado). Para desligar a medição, bloqueie os pedidos a eu.i.posthog.com ou desligue o JavaScript para este site.';
      botao.hidden = true;
      return;
    }
    if (s.recusada) {
      estado.textContent = depoisDeMudar
        ? 'Medição desligada. Guardámos a sua escolha neste browser e as páginas seguintes já não carregam o PostHog.'
        : 'Estado atual: medição desligada neste browser. O PostHog não é carregado.';
      botao.textContent = 'Aceitar a medição';
      botao.className = 'btn btn-contorno';
    } else {
      estado.textContent = depoisDeMudar
        ? 'Medição ligada. Apagámos a sua recusa; a medição volta a partir da próxima página que abrir.'
        : 'Estado atual: medição ligada neste browser, sem cookies e sem perfis.';
      botao.textContent = 'Recusar a medição';
      botao.className = 'btn btn-tinta';
    }
    botao.hidden = false;
  }

  botao.addEventListener('click', function () {
    var s = le();
    if (!s.ok) { mostra(s); return; }
    try {
      if (s.recusada) localStorage.removeItem(CHAVE);
      else { localStorage.setItem(CHAVE, '1'); window.MDM_SEM_MEDICAO = true; paraNestaPagina(); }
    } catch (e) { mostra({ ok: false }); return; }
    mostra(le(), true);
  });

  mostra(le(), false);
})();
