/* Assistente de propostas (uso interno). Três caminhos, do mais barato ao mais caro:
   1. O formulário: as perguntas vêm da tabela de preços e a proposta é calculada pela função sem IA (acao «calcular»),
      a cada mudança. Funciona mesmo sem a chave da API.
   2. «Preencher com IA»: o Claude Haiku lê a mensagem do cliente e preenche o formulário (acao «ler»); a equipa confirma.
      Se a leitura falhar, preenche-se à mão.
   3. O assistente completo (conversa), para o que a tabela não cobre: o formulário avisa e passa-lhe o caso.
   A conversa, o formulário e as propostas ficam neste separador (sessionStorage). A conversa vai inteira à função a cada
   pedido, sempre só acrescentada (a API exige o histórico tal como o deu); com «continuar», o modelo pediu contas às
   ferramentas e volta-se a chamar até ao fim do turno. Texto da IA e dos clientes entra sempre como texto, nunca como HTML. */
(function () {
  'use strict';
  var API = '/api/proposta', CHAVE = 'mdm-equipa-conversa', CHAVE_SENHA = 'mdm-equipa-senha', MAX_VOLTAS = 8;
  function $(s) { return document.querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function guarda(k, v) { try { sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
  function le(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function apaga(k) { try { sessionStorage.removeItem(k); } catch (e) {} }

  var entrar = $('[data-entrar]'), mesa = $('[data-mesa]'), dentro = $('[data-so-dentro]'), testeAviso = $('[data-teste]');
  var msgs = $('[data-msgs]'), vazio = $('[data-vazio]'), estado = $('[data-estado]'), formChat = $('[data-form]'), caixa = $('[data-msg]');
  var enviar = $('[data-enviar]');
  var qual = $('[data-qual]'), doc = $('[data-doc]'), zona = $('[data-prop-zona]'), semProp = $('[data-sem-prop]'), copiado = $('[data-copiado]');
  var fp = $('[data-form-prop]'), divsEl = $('[data-divs]'), modeloDiv = $('[data-div-modelo]'), pergEl = $('[data-perguntas]');
  var calcEstado = $('[data-calc-estado]'), lerEstado = $('[data-ler-estado]'), texto = $('[data-texto]');
  var complexoEl = $('[data-complexo]'), duvidasEl = $('[data-duvidas]');

  var VAZIO_FORM = { servico: 'ac', divisoes: [{ tipo: 'Sala', area: '', sol: false, topo: false }], respostas: {},
    nome: '', contacto: '', local: '', pedido: '', notas: '', texto: '', duvidas: [], complexoIA: [] };
  function novoForm() { return JSON.parse(JSON.stringify(VAZIO_FORM)); }
  var S = { mensagens: [], propostas: [], teste: false, atual: -1, aba: 'form', form: novoForm(), rascunho: '' };
  try {
    var g = JSON.parse(le(CHAVE) || 'null');
    if (g && Array.isArray(g.mensagens)) { S = g; S.form = Object.assign(novoForm(), S.form || {}); if (!Array.isArray(S.propostas)) S.propostas = []; }
  } catch (e) {}
  /* a página foi recarregada a meio de uma resposta: o turno sem fim sai do histórico e o texto volta à caixa (rascunho) */
  (function () {
    var m = S.mensagens, i = m.length - 1;
    if (!m.length || m[i].role === 'assistant') return;
    while (i > 0 && !(m[i].role === 'user' && typeof m[i].content === 'string')) i--;
    var t = typeof m[i].content === 'string' ? m[i].content : '';
    m.splice(i);
    S.rascunho = [t, S.rascunho || ''].filter(Boolean).join('\n\n');
  })();
  var senha = le(CHAVE_SENHA) || '', ocupado = false, T = null;
  /* «Nova proposta» e «Sair» mudam a geração: uma resposta que chegue depois, de um pedido feito antes, é ignorada */
  var GEN = 0;
  function grava() { guarda(CHAVE, S); }

  /* cada «Entrar» e cada «Sair» abrem uma entrada nova: um 401 de uma entrada que já acabou não diz nada da senha atual.
     «Senha errada» só aparece em resposta à senha que a equipa acabou de escrever (até à primeira resposta aceite) */
  var entrada = 0, acabadaDeEscrever = false;
  function sai() { entrada++; senha = ''; apaga(CHAVE_SENHA); }
  function api(corpo) {
    var e = entrada;
    if (!senha) return Promise.reject(new Error('senha'));   /* depois de «Sair», nada sai sem senha */
    return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', 'x-mdm-senha': encodeURIComponent(senha) }, body: JSON.stringify(corpo) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (c) {
        if (r.status === 401) {
          if (e === entrada) {
            var escrita = acabadaDeEscrever;
            sai();
            mostra(false, escrita ? 'Senha errada. Escreva-a outra vez; o trabalho fica guardado.'
              : 'A senha guardada neste separador deixou de ser aceite. Escreva-a outra vez; o trabalho fica guardado.');
          }
          throw new Error('senha');
        }
        if (e === entrada) acabadaDeEscrever = false;
        return { ok: r.ok, status: r.status, c: c };
      }); });
  }

  /* ── entrar e sair ── */
  function mostra(dentroDaMesa, erro) {
    entrar.hidden = dentroDaMesa; mesa.hidden = !dentroDaMesa; dentro.hidden = !dentroDaMesa;
    $('[data-entrar-erro]').textContent = erro || '';
    if (!dentroDaMesa) { $('#senha').focus(); return; }
    desenhaTudo();
    texto.value = S.form.texto || '';
    if (!T) carregaTabela(); else calcula();   /* depois de voltar a entrar, a conta que ficou a meio refaz-se */
    var aba = $('[data-aba][aria-selected="true"]'); if (aba) aba.focus();
  }
  $('[data-entrar-form]').addEventListener('submit', function (e) {
    e.preventDefault();
    entrada++; acabadaDeEscrever = true;
    senha = $('#senha').value;
    guarda(CHAVE_SENHA, senha);
    $('#senha').value = '';
    mostra(true);
  });
  /* «Sair» não muda a geração: o caso continua o mesmo, e uma resposta já paga ainda entra */
  $('[data-sair]').addEventListener('click', function () { sai(); mostra(false); });
  function temDados() {
    var f = S.form;
    return S.mensagens.length || S.propostas.length || caixa.value.trim() || f.texto.trim() || f.nome || f.contacto || f.local || f.pedido || f.notas.trim() ||
      f.divisoes.some(function (d) { return String(d.area).trim(); });
  }
  /* estados que pertencem a pedidos em curso: ao mudar de geração, nada fica preso */
  function limpaEstados() {
    nCalc++; clearTimeout(tCalc);
    ocupa(false); calcEstado.textContent = ''; lerEstado.textContent = ''; copiado.textContent = '';
    lerBtn.disabled = !T; fp.inert = !T;
  }
  $('[data-nova]').addEventListener('click', function () {
    if (temDados() && !confirm('Começar uma proposta nova? O formulário, a conversa e as propostas deste separador desaparecem.')) return;
    GEN++;
    S = { mensagens: [], propostas: [], teste: S.teste, atual: -1, aba: 'form', form: novoForm() };
    caixa.value = '';
    limpaEstados(); grava(); desenhaTudo(); poeForm(); poeComplexo([]);
    if (!T) carregaTabela(); else calcula();   /* a tabela não depende do caso: se ainda não chegou, volta a pedir-se */
  });

  /* ── abas ── */
  var abas = $$('[data-aba]');
  function abre(qualAba, foco) {
    S.aba = qualAba; grava();
    abas.forEach(function (b) {
      var sim = b.getAttribute('data-aba') === qualAba;
      b.setAttribute('aria-selected', sim ? 'true' : 'false'); b.tabIndex = sim ? 0 : -1;
      if (sim && foco) b.focus();
    });
    $$('[data-painel]').forEach(function (p) { p.hidden = p.getAttribute('data-painel') !== qualAba; });
    if (qualAba === 'chat') desenhaConversa(true);
  }
  abas.forEach(function (b, i) {
    b.addEventListener('click', function () { abre(b.getAttribute('data-aba')); });
    b.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); abre(abas[(i + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length].getAttribute('data-aba'), true);
    });
  });

  /* ── formulário ── */
  var recarrega = $('[data-recarrega]'), lerBtn = $('[data-ler]');
  /* o pedido da tabela pertence à entrada que o fez: cada entrada pede a sua, mesmo com o de uma entrada anterior ainda a
     caminho, e a resposta de uma entrada que já acabou (um 401 da senha antiga, por exemplo) não mexe no ecrã. Assim a
     entrada atual acaba sempre com a tabela ou com o erro e «Tentar outra vez» */
  var aCarregar = null, focoDepois = false;
  function carregaTabela() {
    if (aCarregar === entrada) return;   /* esta entrada já tem um pedido a caminho */
    var e = aCarregar = entrada;
    calcEstado.textContent = 'A carregar a tabela…'; recarrega.hidden = true;
    api({ acao: 'tabela' }).then(function (x) {
      if (e !== entrada) return;
      aCarregar = null;
      if (!x.ok) { calcEstado.textContent = x.c.erro || 'Não foi possível carregar a tabela.'; recarrega.hidden = false; return; }
      T = x.c; S.teste = !!T.teste; testeAviso.hidden = !S.teste;
      fp.inert = false; lerBtn.disabled = false; calcEstado.textContent = '';
      poeForm(); calcula();
      if (focoDepois) { focoDepois = false; var c = fp.querySelector('input[name="servico"]:checked'); if (c) c.focus(); }
    }).catch(function (erro) {
      if (e !== entrada) return;
      aCarregar = null;
      if (erro.message === 'senha') return;
      calcEstado.textContent = 'Sem ligação. Verifique a internet.'; recarrega.hidden = false;
    });
  }
  recarrega.addEventListener('click', function () {
    /* o botão esconde-se enquanto tenta: o foco passa para a linha de estado e, quando a tabela chega, para o formulário */
    focoDepois = true; calcEstado.tabIndex = -1; calcEstado.focus();
    carregaTabela();
  });
  function leArea(t) {
    t = String(t == null ? '' : t).trim().replace(/\s*m(²|2)$/i, '').replace(',', '.');
    if (!t) return null;
    return /^(\d+(\.\d*)?|\.\d+)$/.test(t) ? Math.round(parseFloat(t) * 100) / 100 : NaN;
  }
  function linhaDiv(d, i) {
    var li = modeloDiv.content.firstElementChild.cloneNode(true);
    li.querySelector('.eq-div-n').textContent = 'Divisão ' + (i + 1);
    var tipo = li.querySelector('[data-d="tipo"]');
    T.tipos.forEach(function (t) { var o = el('option', '', t); o.value = t; tipo.appendChild(o); });
    tipo.value = T.tipos.indexOf(d.tipo) >= 0 ? d.tipo : T.tipos[0];
    var area = li.querySelector('[data-d="area"]');
    area.value = d.area === '' || d.area == null || d.area === 0 ? '' : String(d.area).replace('.', ',');
    li.querySelector('[data-d="sol"]').checked = !!d.sol;
    li.querySelector('[data-d="topo"]').checked = !!d.topo;
    /* etiquetas ligadas aos campos (ids únicos por linha) */
    $$('.eq-rot', li).forEach(function (l, j) { var c = j === 0 ? tipo : area; c.id = 'd' + i + (j === 0 ? 't' : 'a'); l.htmlFor = c.id; });
    var erro = li.querySelector('[data-d="erro"]'); erro.id = 'd' + i + 'e'; area.setAttribute('aria-describedby', erro.id);
    li.querySelector('[data-d="tira"]').hidden = S.form.divisoes.length < 2;
    li.querySelector('[data-d="tira"]').setAttribute('aria-label', 'Tirar a divisão ' + (i + 1));
    return li;
  }
  function poeForm() {
    if (!T) return;
    var f = S.form;
    texto.value = f.texto || '';
    $$('input[name="servico"]', fp).forEach(function (r) { r.checked = r.value === f.servico; });
    divsEl.textContent = '';
    f.divisoes.forEach(function (d, i) { divsEl.appendChild(linhaDiv(d, i)); });
    $('[data-junta-div]').hidden = f.divisoes.length >= (T.maxDivisoes || 8);
    pergEl.textContent = '';
    var mostradas = 0;
    T.perguntas.forEach(function (q) {
      var visivel = f.servico === 'ac' ? q.ac : f.servico === 'aguasQuentes' ? !q.ac : false;
      if (!visivel) return;
      mostradas++;
      var fs = el('fieldset', 'eq-q'), ops = el('div', 'eq-ops');
      fs.appendChild(el('legend', 'eq-q-t', q.t));
      [naoPerguntei].concat(q.op).forEach(function (o) {
        var lb = el('label', 'eq-op' + (o[0] === '' ? ' eq-op-vazio' : '')), r = el('input');
        r.type = 'radio'; r.name = 'q-' + q.k; r.value = o[0]; r.checked = (f.respostas[q.k] || '') === o[0];
        lb.appendChild(r); lb.appendChild(el('span', '', o[1])); ops.appendChild(lb);
      });
      fs.appendChild(ops); pergEl.appendChild(fs);
    });
    $('[data-sec-divs]').hidden = f.servico !== 'ac';
    $('[data-sec-perg]').hidden = f.servico === 'outro';
    $('[data-sem-perg]').hidden = mostradas > 0;
    $('[data-num-perg]').textContent = f.servico === 'ac' ? '4' : '3';
    $('[data-num-cli]').textContent = f.servico === 'ac' ? '5' : f.servico === 'outro' ? '3' : '4';
    fp.nome.value = f.nome; fp.contacto.value = f.contacto; fp.local.value = f.local; fp.pedido.value = f.pedido; fp.notas.value = f.notas;
    desenhaDuvidas();
  }
  /* o que está no ecrã para S.form */
  function leForm() {
    if (!T) return;   /* antes de a tabela chegar, o formulário no ecrã ainda não é o guardado */
    var f = S.form;
    f.texto = texto.value;
    var s = fp.querySelector('input[name="servico"]:checked'); f.servico = s ? s.value : 'ac';
    f.divisoes = $$('.eq-div', divsEl).map(function (li) {
      return { tipo: li.querySelector('[data-d="tipo"]').value, area: li.querySelector('[data-d="area"]').value,
        sol: li.querySelector('[data-d="sol"]').checked, topo: li.querySelector('[data-d="topo"]').checked };
    });
    $$('.eq-q input:checked', pergEl).forEach(function (r) { f.respostas[r.name.slice(2)] = r.value; });
    ['nome', 'contacto', 'local', 'pedido', 'notas'].forEach(function (k) { f[k] = fp[k].value; });
    grava();
  }
  var naoPerguntei = ['', 'Ainda não perguntei'];
  var tCalc = 0, nCalc = 0;
  function calcula() {
    if (!T) return;
    clearTimeout(tCalc);
    tCalc = setTimeout(calculaJa, 350);
  }
  /* a proposta do formulário só fica à vista enquanto corresponde ao que está no formulário. Se era a escolhida, fica
     nenhuma escolhida (o ecrã mostra a última), para a próxima conta do formulário voltar a aparecer */
  function tiraForm() {
    var i = S.propostas.map(function (x) { return x.origem; }).indexOf('form');
    if (i < 0) return;
    S.propostas.splice(i, 1);
    if (S.atual === i) S.atual = -1;
    else if (S.atual > i) S.atual--;
    grava(); desenhaProposta();
  }
  function calculaJa() {
    if (!T) return;
    var f = S.form, erros = [], ac = f.servico === 'ac';
    var divisoes = [];
    $$('.eq-div', divsEl).forEach(function (li, i) {
      var a = leArea(li.querySelector('[data-d="area"]').value), e = li.querySelector('[data-d="erro"]'), msg = '';
      if (!ac) { e.textContent = ''; li.querySelector('[data-d="area"]').removeAttribute('aria-invalid'); return; }   /* divisões escondidas */
      /* acima do máximo não é erro: a divisão segue para o cálculo, a dimensionar na visita (e é caso complexo). Se ficasse
         de fora, a proposta sairia só com as outras divisões, com um preço mais baixo */
      var grande = a !== null && a > T.areaMax;
      if (a === null) msg = 'Falta a área.';
      else if (isNaN(a)) msg = 'Escreva a área só com números, por exemplo 12 ou 12,5.';
      else if (a < T.areaMin) msg = 'A área tem de ter pelo menos ' + T.areaMin + ' m².';
      else if (grande) msg = 'Mais de ' + T.areaMax + ' m²: dimensiona-se na visita.';
      e.textContent = msg;
      li.querySelector('[data-d="area"]').setAttribute('aria-invalid', msg && a !== null && !grande ? 'true' : 'false');
      if (msg && !grande) { if (a !== null) erros.push(i); return; }
      divisoes.push({ tipo: f.divisoes[i].tipo, area: a, sol: f.divisoes[i].sol, ultimo_andar: f.divisoes[i].topo });
    });
    var respostas = {};
    ['pre', 'dist', 'furo', 'fora', 'luz', 'antigas', 'deposito'].forEach(function (k) { respostas[k] = f.respostas[k] || ''; });
    var dados = { servico: f.servico, divisoes: ac ? divisoes : [], respostas: respostas,
      contagem: { divisoes: ac ? f.divisoes.length : 0 },
      cliente: { nome: f.nome, contacto: f.contacto, local: f.local }, pedido: f.pedido,
      observacoes: f.notas.split('\n').map(function (n) { return n.trim(); }).filter(Boolean).slice(0, 6) };
    var este = ++nCalc, g = GEN;
    calcEstado.textContent = 'A calcular…';
    api({ acao: 'calcular', dados: dados }).then(function (x) {
      if (este !== nCalc || g !== GEN) return;   /* chegou uma resposta mais recente, ou começou outra proposta */
      if (!x.ok) { tiraForm(); calcEstado.textContent = x.c.erro || 'Não foi possível calcular.'; return; }
      var c = x.c, avisos = [];
      if (c.proposta) { c.proposta.origem = 'form'; poeProposta(c.proposta); } else tiraForm();
      if (ac && !divisoes.length) avisos.push('Escreva a área de pelo menos uma divisão.');
      else if (c.modo === 'erro' && c.resultado && c.resultado.erro) avisos.push(c.resultado.erro);
      /* sem preços na tabela, a potência mostra-se na mesma (cada divisão e o total), sem proposta */
      if (c.modo === 'sem_tabela' && c.resultado && c.resultado.potencia)
        avisos.push('Potência estimada: ' + inseparavel(c.resultado.potencia) + '. A tabela da MDM ainda não tem preços para este produto, por isso não há proposta.');
      if (c.modo === 'escolhe') avisos.push('Escolha o tamanho do depósito.');
      if (c.notasRecusadas && c.notasRecusadas.length) avisos.push('Notas que não entram na proposta (regras da MDM): ' + c.notasRecusadas.join('; '));
      if (erros.length) avisos.push('Há divisões com a área por corrigir; não entram na conta.');
      var falta = c.resultado && c.resultado.perguntas_por_responder ? c.resultado.perguntas_por_responder.length : 0;
      calcEstado.textContent = avisos.join(' ') || (c.proposta ? 'Proposta atualizada.' + (falta ? ' Ainda há ' + falta + (falta === 1 ? ' pergunta' : ' perguntas') + ' por fazer ao cliente.' : '') : '');
      poeComplexo(c.complexo || []);
    }).catch(function (e) {
      if (este !== nCalc || g !== GEN) return;
      /* sem ligação, a proposta à vista já não corresponde ao formulário: sai, como num erro da função. Sem senha fica:
         o ecrã de entrar esconde-a e, ao voltar a entrar, a conta refaz-se */
      if (e.message !== 'senha') tiraForm();
      calcEstado.textContent = e.message === 'senha' ? '' : 'Sem ligação. Verifique a internet.';
    });
  }
  fp.addEventListener('input', function () { leForm(); calcula(); });
  fp.addEventListener('change', function (e) {
    leForm();
    if (e.target.name === 'servico') { S.form.complexoIA = []; poeForm(); poeComplexo([]); }
    calcula();
  });
  divsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-d="tira"]'); if (!b) return;
    var i = $$('.eq-div', divsEl).indexOf(b.closest('.eq-div'));
    leForm(); S.form.divisoes.splice(i, 1); grava(); poeForm(); calcula();
    var primeiro = divsEl.querySelector('[data-d="area"]'); if (primeiro) primeiro.focus();
  });
  $('[data-junta-div]').addEventListener('click', function () {
    leForm(); S.form.divisoes.push({ tipo: 'Quarto', area: '', sol: false, topo: false }); grava(); poeForm(); calcula();
    var areas = $$('[data-d="area"]', divsEl); areas[areas.length - 1].focus();
  });
  texto.addEventListener('input', function () { S.form.texto = texto.value; grava(); });

  /* ── avisos: dúvidas da leitura e casos complexos ── */
  function desenhaDuvidas() {
    var l = $('[data-duvidas-lista]'); l.textContent = '';
    (S.form.duvidas || []).forEach(function (d) { l.appendChild(el('li', '', d)); });
    duvidasEl.hidden = !(S.form.duvidas && S.form.duvidas.length);
  }
  var motivosAtuais = [];
  function poeComplexo(doCalculo) {
    var todos = (S.form.complexoIA || []).concat(doCalculo).filter(function (m, i, a) { return a.indexOf(m) === i; });
    motivosAtuais = todos;
    var l = $('[data-complexo-lista]'); l.textContent = '';
    todos.forEach(function (m) { l.appendChild(el('li', '', m)); });
    complexoEl.hidden = !todos.length;
  }

  /* ── preencher com IA (Haiku) ── */
  $('[data-ler]').addEventListener('click', function () {
    var t = texto.value.trim();
    if (!t) { lerEstado.textContent = 'Cole primeiro a mensagem do cliente.'; texto.focus(); return; }
    var b = this, g = GEN;
    leForm();
    /* durante a leitura o formulário fica parado, para a resposta não desfazer o que a equipa escrever entretanto */
    b.disabled = true; fp.inert = true; lerEstado.textContent = 'A ler o pedido…';
    function fim() { if (g === GEN) { b.disabled = false; fp.inert = false; } }
    api({ acao: 'ler', texto: t }).then(function (x) {
      if (g !== GEN) return;
      fim();
      if (!x.ok || x.c.erro) { lerEstado.textContent = (x.c.erro || 'A leitura falhou.') + ' O formulário continua disponível.'; return; }
      var c = x.c.campos, f = S.form;
      f.servico = c.servico;
      if (c.divisoes && c.divisoes.length) f.divisoes = c.divisoes.map(function (d) { return { tipo: d.tipo, area: d.area > 0 ? d.area : '', sol: !!d.sol, topo: !!d.ultimo_andar }; });
      Object.keys(c.respostas || {}).forEach(function (k) { if (c.respostas[k]) f.respostas[k] = c.respostas[k]; });
      if (c.local) f.local = c.local;
      if (c.pedido) f.pedido = c.pedido;
      if (c.notas && c.notas.length) {
        var ja = f.notas.split('\n').map(function (n) { return n.trim(); }).filter(Boolean);
        c.notas.forEach(function (n) { if (ja.indexOf(n) < 0) ja.push(n); });
        f.notas = ja.join('\n');
      }
      f.duvidas = c.duvidas || [];
      f.complexoIA = x.c.complexoIA || [];   /* só o motivo da IA; os calculados vêm de cada conta */
      grava(); poeForm(); calculaJa();
      var fora = x.c.recusadas || [];
      lerEstado.textContent = 'Formulário preenchido. Confirme os campos' + (f.duvidas.length ? ' e veja o que falta perguntar.' : '.')
        + (fora.length ? ' Não passou para o formulário (regras da MDM): ' + fora.join('; ') : '');
    }).catch(function (e) {
      if (g !== GEN) return;
      fim();
      lerEstado.textContent = e.message === 'senha' ? 'Não foi lido: entre outra vez e carregue em «Preencher com IA».' : 'Sem ligação. Preencha o formulário à mão.';
    });
  });

  /* ── passar o caso ao assistente completo ── */
  $('[data-passar]').addEventListener('click', function () {
    leForm();
    var f = S.form, l = ['Caso passado do formulário, para preparar a proposta.'];
    if (f.texto.trim()) l.push('', 'Mensagem do cliente:', f.texto.trim());
    l.push('', 'Serviço: ' + ({ ac: 'montagem de ar condicionado', aguasQuentes: 'bomba de calor para águas quentes', outro: 'outro trabalho' })[f.servico]);
    if (f.servico === 'ac') f.divisoes.forEach(function (d, i) {
      var c = []; if (d.sol) c.push('muito sol'); if (d.topo) c.push('último andar');
      l.push('Divisão ' + (i + 1) + ': ' + d.tipo + ', ' + (d.area ? String(d.area).replace('.', ',') + ' m²' : 'área por saber') + (c.length ? ' (' + c.join(', ') + ')' : ''));
    });
    T.perguntas.forEach(function (q) {
      var visivel = f.servico === 'ac' ? q.ac : f.servico === 'aguasQuentes' ? !q.ac : false;
      var v = f.respostas[q.k]; if (!v || !visivel) return;
      q.op.forEach(function (o) { if (o[0] === v) l.push(q.t + ' ' + o[1]); });
    });
    if (f.local) l.push('Local: ' + f.local);
    if (f.pedido) l.push('Pedido: ' + f.pedido);
    if (f.notas.trim()) l.push('Notas: ' + f.notas.trim().replace(/\n/g, '; '));
    if (motivosAtuais.length) l.push('', 'Porque passou para aqui: ' + motivosAtuais.join(' '));
    abre('chat');
    caixa.value = l.join('\n');
    caixa.focus();
  });

  /* ── assistente completo (conversa) ── */
  var PASSOS = { calcular_potencia: 'Calculou a potência', calcular_preco: 'Calculou o preço com a tabela', preparar_proposta: 'Preparou a proposta' };
  /* a região é role=log: só se juntam as mensagens novas, para o leitor de ecrã ler só o que chegou */
  var nDesenhadas = 0;
  function desenhaConversa(tudo) {
    if (tudo || nDesenhadas > S.mensagens.length || !S.mensagens.length) { msgs.textContent = ''; nDesenhadas = 0; }
    if (!S.mensagens.length) { msgs.appendChild(vazio); return; }
    if (vazio.parentNode) msgs.removeChild(vazio);
    S.mensagens.slice(nDesenhadas).forEach(function (m, k) {
      var i = nDesenhadas + k;
      function poe(n) { n.setAttribute('data-i', i); msgs.appendChild(n); }
      if (m.role === 'user') {
        if (typeof m.content === 'string') poe(el('div', 'msg msg-eu', m.content));
        return;   /* resultados das ferramentas: não se mostram */
      }
      var txt = [];
      (m.content || []).forEach(function (b) {
        if (b.type === 'text' && b.text) txt.push(b.text);
        if (b.type === 'tool_use') poe(el('p', 'msg-passo', '↳ ' + (PASSOS[b.name] || b.name)));
      });
      if (txt.length) poe(el('div', 'msg msg-ia', txt.join('\n\n').trim()));
    });
    nDesenhadas = S.mensagens.length;
    msgs.scrollTop = msgs.scrollHeight;
  }
  /* a mensagem que a equipa acabou de escrever não chegou a ter resposta: sai do histórico e volta à caixa */
  function devolve(textoDevolvido, quantas) {
    S.mensagens.splice(S.mensagens.length - quantas, quantas);
    /* se a equipa já começou a escrever a seguinte, as duas ficam juntas na caixa */
    caixa.value = [textoDevolvido, caixa.value.trim()].filter(Boolean).join('\n\n');
    S.rascunho = caixa.value;
    grava();
    /* tira só os nós dessas mensagens: o resto da conversa não volta a ser lido */
    $$('[data-i]', msgs).forEach(function (n) { if (+n.getAttribute('data-i') >= S.mensagens.length) n.parentNode.removeChild(n); });
    nDesenhadas = S.mensagens.length;
    if (!S.mensagens.length) desenhaConversa(true);
  }
  function erroNaConversa(t) { msgs.appendChild(el('div', 'msg msg-erro', t)); msgs.scrollTop = msgs.scrollHeight; }
  function ocupa(sim, txt) {
    ocupado = sim; enviar.disabled = sim;
    estado.textContent = txt || ''; estado.classList.toggle('a-pensar', sim);
  }
  function pede(volta) {
    var g = GEN, ultima = S.mensagens[S.mensagens.length - 1];
    /* na primeira volta, a última mensagem é o texto da equipa; se o pedido falhar, volta para a caixa */
    function falhou(msg) {
      ocupa(false);
      if (!volta && S.mensagens[S.mensagens.length - 1] === ultima && typeof ultima.content === 'string') {
        devolve(ultima.content, 1);
        msg += ' A mensagem voltou para a caixa.';
      }
      erroNaConversa(msg);
    }
    ocupa(true, volta ? 'A fazer as contas…' : 'A pensar…');
    api({ mensagens: S.mensagens }).then(function (x) {
      if (g !== GEN) return;
      if (!x.ok) { falhou(x.c.erro || 'Algo falhou (' + x.status + '). Tente outra vez.'); return; }
      var c = x.c;
      if (c.retirar) { ocupa(false); devolve(c.textoRetirado || '', Math.min(c.retirar, S.mensagens.length)); erroNaConversa(c.erro); return; }
      if (Array.isArray(c.novas)) S.mensagens = S.mensagens.concat(c.novas);
      (c.propostas || []).forEach(function (p) { p.origem = 'chat'; poeProposta(p); });
      S.teste = !!c.teste;
      grava(); testeAviso.hidden = !S.teste; desenhaConversa();
      if (c.erro) erroNaConversa(c.erro);
      if (c.cortada) erroNaConversa('A resposta ficou cortada. Peça para continuar.');
      if (c.continuar && volta < MAX_VOLTAS) { pede(volta + 1); return; }
      ocupa(false);
      if (c.continuar) erroNaConversa('O assistente parou a meio. Escreva «continua».');
    }).catch(function (e) {
      if (g !== GEN) return;
      falhou(e.message === 'senha' ? 'Não foi enviada: entre outra vez.' : 'Sem ligação ao assistente. Verifique a internet e tente outra vez.');
    });
  }
  function envia(t) {
    t = String(t || '').trim();
    if (!t || ocupado) return;
    S.mensagens.push({ role: 'user', content: t });
    caixa.value = ''; S.rascunho = '';
    grava(); desenhaConversa();
    pede(0);
  }
  formChat.addEventListener('submit', function (e) { e.preventDefault(); envia(caixa.value); });
  caixa.addEventListener('input', function () { S.rascunho = caixa.value; grava(); });
  caixa.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); envia(caixa.value); }
  });

  /* a mesma proposta com outra referência: a função dá uma referência e uma data novas a cada conta (o texto leva-as) */
  function mesma(a, b) {
    function sem(p) { var c = Object.assign({}, p); delete c.ref; delete c.data; delete c.texto; return JSON.stringify(c); }
    return sem(a) === sem(b);
  }
  /* a proposta do formulário é uma só e vai sendo atualizada; as do assistente juntam-se à lista e ficam escolhidas.
     A mesma conta (recarregar, sair e entrar, um campo que não mudou) deixa tudo como estava: a referência, a data e a
     escolha. Uma conta nova do formulário só muda a escolha se ela era a do formulário, ou se não havia nenhuma */
  function poeProposta(p) {
    var i = p.origem === 'form' ? S.propostas.map(function (x) { return x.origem; }).indexOf('form') : -1;
    var nenhuma = !(S.atual >= 0 && S.atual < S.propostas.length);
    if (i >= 0) {
      if (mesma(S.propostas[i], p)) return;
      S.propostas[i] = p;
      if (nenhuma) S.atual = i;
    } else {
      S.propostas.push(p);
      if (p.origem !== 'form' || nenhuma) S.atual = S.propostas.length - 1;
    }
    grava(); desenhaProposta();
  }

  /* ── proposta ── */
  /* no ecrã e no PDF os números não partem a meio: 4 480 €, 12 000 BTU/h */
  function inseparavel(t) { return String(t).replace(/(\d) (?=\d{3}\b)/g, '$1\u00a0').replace(/ (€|BTU\/h|m²)/g, '\u00a0$1'); }
  function linhaDados(dl, rot, val) { if (!val) return; dl.appendChild(el('dt', '', rot)); dl.appendChild(el('dd', '', val)); }
  /* a proposta à vista: a escolhida ou, sem nenhuma escolhida, a última */
  function aVista() { return S.atual >= 0 && S.atual < S.propostas.length ? S.atual : S.propostas.length - 1; }
  function desenhaProposta() {
    var tem = S.propostas.length > 0;
    zona.hidden = !tem; semProp.hidden = tem; qual.hidden = S.propostas.length < 2;
    qual.textContent = '';
    S.propostas.forEach(function (p, i) {
      var o = el('option', '', (i + 1) + '. ' + (p.origem === 'form' ? 'Formulário · ' : 'Assistente · ') + p.ref + (p.cliente && p.cliente.nome ? ' · ' + p.cliente.nome : ''));
      o.value = i; qual.appendChild(o);
    });
    if (!tem) return;
    qual.value = String(aVista());
    var p = S.propostas[aVista()], e = p.empresa || {};
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
        tr.appendChild(el('td', '', inseparavel(String(d.area).replace('.', ',') + ' m²')));
        tr.appendChild(el('td', '', cond.join(', ')));
        tr.appendChild(el('td', 'num', inseparavel(d.texto || '')));
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      var cx = el('div', 'doc-pot-caixa'); cx.appendChild(t); doc.appendChild(cx);   /* num ecrã estreito, só a tabela desliza */
      cx.tabIndex = 0; cx.setAttribute('role', 'region'); cx.setAttribute('aria-label', 'Potência estimada por divisão');
    }
    doc.appendChild(el('p', 'doc-sec', 'Preço provável, com IVA'));
    if (p.modo === 'visita') doc.appendChild(el('p', 'doc-visita', 'Para este caso o preço dá-se depois da visita, que é gratuita.'));
    (p.blocos || []).forEach(function (b) {
      var s = el('section', 'doc-bloco');
      s.appendChild(el('h4', 'doc-bloco-t', inseparavel(b.titulo)));
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
    var p = S.propostas[aVista()]; if (!p) return;
    function feito(ok) { copiado.textContent = ok ? 'Texto copiado.' : 'Não deu para copiar: selecione o texto da proposta.'; setTimeout(function () { copiado.textContent = ''; }, 4000); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(p.texto).then(function () { feito(true); }, function () { feito(false); });
    else feito(false);
  });
  $('[data-pdf]').addEventListener('click', function () {
    var p = S.propostas[aVista()]; if (!p) return;
    var antes = document.title;
    document.title = 'Proposta ' + p.ref + (p.cliente && p.cliente.nome ? ' ' + p.cliente.nome : '');   /* nome do ficheiro PDF */
    window.print();
    document.title = antes;
  });

  function desenhaTudo() {
    testeAviso.hidden = !S.teste; abre(S.aba || 'form'); desenhaConversa(true); desenhaProposta();
    if (!caixa.value && S.rascunho) caixa.value = S.rascunho;
  }
  mostra(!!senha);
})();
