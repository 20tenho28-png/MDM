/* Política de privacidade: aceitar ou recusar as estatísticas (PostHog) depois da primeira escolha.
   A escolha em si vive em site.js (window.mdmEstatisticas), que a grava no localStorage ('mdm-estatisticas')
   e carrega ou para o PostHog. Este script corre antes de site.js (vem primeiro na página): espera pelo DOMContentLoaded. */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';
  var caixa = document.querySelector('[data-est-controlo]');
  var api = window.mdmEstatisticas;
  if (!caixa || !api) return;
  var estado = caixa.querySelector('[data-est-estado]');
  var acoes = caixa.querySelector('[data-est-acoes]');
  var botoes = [].slice.call(caixa.querySelectorAll('[data-est]'));

  function mostra(depoisDeMudar, guardada) {
    var e = api.escolha();
    botoes.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-est') === e)); });
    var txt;
    if (e === 'sim') txt = depoisDeMudar ? 'Estatísticas aceites. A partir de agora, o site mede as visitas como descrito acima.' : 'Estado atual: estatísticas aceites neste browser, sem cookies e sem perfis.';
    else if (e === 'nao') txt = depoisDeMudar ? 'Estatísticas recusadas. O PostHog já não envia dados nesta página nem é carregado nas seguintes.' : 'Estado atual: estatísticas recusadas neste browser. O PostHog não é carregado.';
    else if (api.naoSeguir) txt = 'Estado atual: o seu browser pede para não ser seguido, por isso as estatísticas estão desligadas. Só ligam se carregar em «Aceitar».';
    else txt = 'Estado atual: ainda não escolheu. Enquanto não escolher, as estatísticas não são carregadas.';
    if (depoisDeMudar && guardada === false) txt += ' O seu browser não deixa guardar a escolha (por exemplo, numa janela privada), por isso vale só para esta página.';
    estado.textContent = txt;
  }

  botoes.forEach(function (b) {
    b.addEventListener('click', function () { mostra(true, api.define(b.getAttribute('data-est'))); });
  });
  acoes.hidden = false;
  mostra(false);
});
