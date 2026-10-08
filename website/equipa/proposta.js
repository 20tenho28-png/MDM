/* Assistente de propostas (uso interno). A conversa e as propostas ficam neste separador (sessionStorage) e vão
   inteiras à função /api/proposta a cada pedido, sempre só acrescentadas (a API exige o histórico tal como o deu).
   Quando a função responde «continuar», o modelo pediu contas às ferramentas: volta-se a chamar até ao fim do turno.
   Texto da IA e dos clientes entra sempre como texto (textContent), nunca como HTML. */
(function () {
  'use strict';
  var API = '/api/proposta', CHAVE = 'mdm-equipa-conversa', CHAVE_SENHA = 'mdm-equipa-senha', MAX_VOLTAS = 8;
  function $(s) { return document.querySelector(s); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function guarda(k, v) { try { sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
  function le(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function apaga(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  var entrar = $('[data-entrar]'), mesa = $('[data-mesa]'), dentro = $('[data-so-dentro]');
  var msgs = $('[data-msgs]'), vazio = $('[data-vazio]'), estado = $('[data-estado]'), form = $('[data-form]'), caixa = $('[data-msg]');
  var enviar = $('[data-enviar]'), testeAviso = $('[data-teste]');
  var qual = $('[data-qual]'), doc = $('[data-doc]'), zona = $('[data-prop-zona]'), semProp = $('[data-sem-prop]'), copiado = $('[data-copiado]');

  var S = { mensagens: [], propostas: [], teste: false, atual: -1 };
  try { var g = JSON.parse(le(CHAVE) || 'null'); if (g && Array.isArray(g.mensagens)) S = g; } catch (e) {}
  var senha = le(CHAVE_SENHA) || '', ocupado = false;
  function grava() { guarda(CHAVE, S); }

  /* ── entrar e sair ── */
  function mostra(dentroDaMesa, erro) {
    entrar.hidden = dentroDaMesa; mesa.hidden = !dentroDaMesa; dentro.hidden = !dentroDaMesa;
    $('[data-entrar-erro]').textContent = erro || '';
    if (dentroDaMesa) { desenhaTudo(); caixa.focus(); } else { $('#senha').focus(); }
  }
  $('[data-entrar-form]').addEventListener('submit', function (e) {
    e.preventDefault();
    senha = $('#senha').value;
    guarda(CHAVE_SENHA, senha);
    $('#senha').value = '';
    mostra(true);
  });
  $('[data-sair]').addEventListener('click', function () { senha = ''; apaga(CHAVE_SENHA); mostra(false); });
  $('[data-nova]').addEventListener('click', function () {
    if (S.mensagens.length && !confirm('Começar uma conversa nova? A conversa e as propostas deste separador desaparecem.')) return;
    S = { mensagens: [], propostas: [], teste: S.teste, atual: -1 };
    grava(); desenhaTudo(); caixa.focus();
  });

  /* ── conversa ── */
  var PASSOS = { calcular_potencia: 'Calculou a potência', calcular_preco: 'Calculou o preço com a tabela', preparar_proposta: 'Preparou a proposta' };
  function desenhaConversa() {
    msgs.textContent = '';
    if (!S.mensagens.length) { msgs.appendChild(vazio); return; }
    S.mensagens.forEach(function (m) {
      if (m.role === 'user') {
        if (typeof m.content === 'string') msgs.appendChild(el('div', 'msg msg-eu', m.content));
        return;   /* resultados das ferramentas: não se mostram */
      }
      var texto = [];
      (m.content || []).forEach(function (b) {
        if (b.type === 'text' && b.text) texto.push(b.text);
        if (b.type === 'tool_use') msgs.appendChild(el('p', 'msg-passo', '↳ ' + (PASSOS[b.name] || b.name)));
      });
      if (texto.length) msgs.appendChild(el('div', 'msg msg-ia', texto.join('\n\n').trim()));
    });
    msgs.scrollTop = msgs.scrollHeight;
  }
  function erroNaConversa(t) { msgs.appendChild(el('div', 'msg msg-erro', t)); msgs.scrollTop = msgs.scrollHeight; }
  function ocupa(sim, txt) {
    ocupado = sim; enviar.disabled = sim;
    estado.textContent = txt || ''; estado.classList.toggle('a-pensar', sim);
  }

  function pede(volta) {
    ocupa(true, volta ? 'A fazer as contas…' : 'A pensar…');
    fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mdm-senha': senha },
      body: JSON.stringify({ mensagens: S.mensagens }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (c) { return { r: r, c: c }; }); })
      .then(function (x) {
        if (x.r.status === 401) { ocupa(false); senha = ''; apaga(CHAVE_SENHA); mostra(false, 'Senha errada. Escreva-a outra vez; a conversa fica guardada.'); return; }
        if (!x.r.ok) { ocupa(false); erroNaConversa(x.c.erro || 'Algo falhou (' + x.r.status + '). Tente outra vez.'); return; }
        var c = x.c;
        if (Array.isArray(c.novas)) S.mensagens = S.mensagens.concat(c.novas);
        if (Array.isArray(c.propostas) && c.propostas.length) { S.propostas = S.propostas.concat(c.propostas); S.atual = S.propostas.length - 1; }
        S.teste = !!c.teste;
        grava(); desenhaTudo();
        if (c.erro) erroNaConversa(c.erro);
        if (c.cortada) erroNaConversa('A resposta ficou cortada. Peça para continuar.');
        if (c.continuar && volta < MAX_VOLTAS) { pede(volta + 1); return; }
        ocupa(false);
        if (c.continuar) erroNaConversa('O assistente parou a meio. Escreva «continua».');
      })
      .catch(function () { ocupa(false); erroNaConversa('Sem ligação ao assistente. Verifique a internet e tente outra vez.'); });
  }
  function envia(t) {
    t = String(t || '').trim();
    if (!t || ocupado) return;
    S.mensagens.push({ role: 'user', content: t });
    grava(); desenhaConversa();
    caixa.value = '';
    pede(0);
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); envia(caixa.value); });
  caixa.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); envia(caixa.value); }
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-exemplo]'), function (b) {
    b.addEventListener('click', function () { caixa.value = b.textContent; caixa.focus(); });
  });

  /* ── proposta ── */
  /* no ecrã e no PDF os números não partem a meio: 4 480 €, 12 000 BTU/h */
  function inseparavel(t) { return String(t).replace(/(\d) (?=\d{3}\b)/g, '$1\u00a0').replace(/ (€|BTU\/h|m²)/g, '\u00a0$1'); }
  function linhaDados(dl, rot, val) { if (!val) return; dl.appendChild(el('dt', '', rot)); dl.appendChild(el('dd', '', val)); }
  function desenhaProposta() {
    var tem = S.propostas.length > 0;
    zona.hidden = !tem; semProp.hidden = tem; qual.hidden = S.propostas.length < 2;
    qual.textContent = '';
    S.propostas.forEach(function (p, i) { var o = el('option', '', p.ref + (p.cliente && p.cliente.nome ? ' · ' + p.cliente.nome : '')); o.value = i; qual.appendChild(o); });
    if (!tem) return;
    if (S.atual < 0 || S.atual >= S.propostas.length) S.atual = S.propostas.length - 1;
    qual.value = String(S.atual);
    var p = S.propostas[S.atual], e = p.empresa || {};
    doc.textContent = '';
    if (p.teste) doc.appendChild(el('p', 'doc-teste', 'Valores de teste · não enviar ao cliente'));
    var cab = el('header', 'doc-cab'), marca = el('div', 'doc-marca'), img = el('img');
    img.src = '../assets/img/logo-mdm.svg'; img.alt = ''; img.width = 44; img.height = 44;
    var nm = el('div'); nm.appendChild(el('p', 'doc-empresa', e.nome)); nm.appendChild(el('p', 'doc-desde', 'Lisboa · desde ' + e.desde));
    marca.appendChild(img); marca.appendChild(nm);
    var ref = el('p', 'doc-ref'); ref.appendChild(el('strong', '', p.ref)); ref.appendChild(document.createTextNode(p.data));
    cab.appendChild(marca); cab.appendChild(ref); doc.appendChild(cab);
    doc.appendChild(el('h3', 'doc-tit', 'Proposta modelo'));
    doc.appendChild(el('p', 'doc-servico', p.servico));
    var dl = el('dl', 'doc-dados');
    linhaDados(dl, 'Cliente', p.cliente.nome); linhaDados(dl, 'Contacto', p.cliente.contacto); linhaDados(dl, 'Local', p.cliente.local);
    linhaDados(dl, 'Pedido', p.pedido);
    if (dl.childNodes.length) doc.appendChild(dl);
    if (p.divisoes && p.divisoes.length) {
      doc.appendChild(el('p', 'doc-sec', 'Potência estimada'));
      var t = el('table', 'doc-pot'), th = el('tr');
      ['Divisão', 'Área', 'Condições', 'Potência'].forEach(function (h, i) { var c = el('th', i === 3 ? 'num' : '', h); c.scope = 'col'; th.appendChild(c); });
      var thead = el('thead'); thead.appendChild(th); t.appendChild(thead);
      var tb = el('tbody');
      p.divisoes.forEach(function (d) {
        var tr = el('tr'), cond = [];
        if (d.sol) cond.push('muito sol'); if (d.topo) cond.push('último andar');
        tr.appendChild(el('td', '', d.tipo));
        tr.appendChild(el('td', '', String(d.area).replace('.', ',') + ' m²'));
        tr.appendChild(el('td', '', cond.join(', ')));
        tr.appendChild(el('td', 'num', inseparavel(d.texto || '')));
        tb.appendChild(tr);
      });
      t.appendChild(tb); doc.appendChild(t);
    }
    doc.appendChild(el('p', 'doc-sec', 'Preço provável, com IVA'));
    if (p.modo === 'visita') doc.appendChild(el('p', 'doc-visita', 'Para este caso o preço dá-se depois da visita, que é gratuita.'));
    (p.blocos || []).forEach(function (b) {
      var s = el('section', 'doc-bloco');
      s.appendChild(el('h4', 'doc-bloco-t', b.titulo));
      var ul = el('ul', 'doc-gamas');
      b.gamas.forEach(function (g) {
        var li = el('li', 'doc-gama');
        li.appendChild(el('p', 'doc-gama-n', g.gama)); li.appendChild(el('p', 'doc-gama-ex', g.exemplo));
        li.appendChild(el('p', 'doc-gama-v', inseparavel(g.texto.charAt(0).toUpperCase() + g.texto.slice(1))));
        if (g.umaPorDivisao) li.appendChild(el('p', 'doc-gama-sep', 'Com uma máquina para cada divisão: ' + inseparavel(g.umaPorDivisao)));
        ul.appendChild(li);
      });
      s.appendChild(ul); doc.appendChild(s);
    });
    function par(rot, txt) { if (!txt) return; var q = el('p', 'doc-p'); q.appendChild(el('strong', '', rot + ' ')); q.appendChild(document.createTextNode(txt)); doc.appendChild(q); }
    par('Inclui:', p.inclui);
    if (p.considerado && p.considerado.length > 1) par('Considerámos:', p.considerado.slice(1).join(', ') + '.');
    if (p.observacoes && p.observacoes.length) {
      doc.appendChild(el('p', 'doc-sec', 'Notas'));
      var nl = el('ul', 'doc-notas'); p.observacoes.forEach(function (o) { nl.appendChild(el('li', '', o)); }); doc.appendChild(nl);
    }
    var cond = el('div', 'doc-cond'); (p.condicoes || []).forEach(function (c) { cond.appendChild(el('p', '', c)); }); doc.appendChild(cond);
    var pe = el('footer', 'doc-pe'), a = el('span'), b2 = el('span');
    a.appendChild(el('strong', '', e.telefone)); a.appendChild(document.createTextNode(' (' + e.horario + ') · WhatsApp ' + e.whatsapp + ' · ' + e.email));
    b2.textContent = (e.morada || []).join(', ') + ' · ' + e.nomeLegal + ' · NIF ' + e.nif;
    pe.appendChild(a); pe.appendChild(b2); doc.appendChild(pe);
  }
  qual.addEventListener('change', function () { S.atual = +qual.value; grava(); desenhaProposta(); });
  $('[data-copiar]').addEventListener('click', function () {
    var p = S.propostas[S.atual]; if (!p) return;
    function feito(ok) { copiado.textContent = ok ? 'Texto copiado.' : 'Não deu para copiar: selecione o texto da proposta.'; setTimeout(function () { copiado.textContent = ''; }, 4000); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p.texto).then(function () { feito(true); }, function () { feito(false); });
    else feito(false);
  });
  $('[data-pdf]').addEventListener('click', function () {
    var p = S.propostas[S.atual]; if (!p) return;
    var antes = document.title;
    document.title = 'Proposta ' + p.ref + (p.cliente && p.cliente.nome ? ' ' + p.cliente.nome : '');   /* nome do ficheiro PDF */
    window.print();
    document.title = antes;
  });

  function desenhaTudo() { testeAviso.hidden = !S.teste; desenhaConversa(); desenhaProposta(); }
  mostra(!!senha);
})();
