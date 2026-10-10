/* Cálculo da potência (BTU/h) e do preço provável, sem página: as mesmas regras do formulário do site
   (assets/js/site.js, «Estimativa de potência» e «Preço provável»), para o assistente de propostas da equipa
   (netlify/functions/proposta.mts). Os números vêm dos mesmos ficheiros: data/site.json («btu») e data/precos.json.
   Se uma regra mudar no site.js, muda aqui também: tests/paridade.mjs compara os dois com a tabela de teste.
   A IA nunca faz contas: pede-as a estas funções e repete o que elas devolvem. */

export const GAMAS = [
  { k: 'eco', nome: 'Gama económica', ex: 'ex.: Midea' },
  { k: 'sup', nome: 'Gama superior', ex: 'ex.: Mitsubishi Electric, Daikin' },
];
const NB = ' ', GRANDE = 12000, MAX_MULTI = 4;

/* números à portuguesa, com espaço inseparável: 1 050 €, 12 000 BTU/h, 3,5 kW, 12,5 m² */
export function milhares(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
export function euros(n) { return milhares(n) + NB + '€'; }
export function btuh(n) { return milhares(n) + NB + 'BTU/h'; }
function decimal(n) { return String(Math.round(n * 100) / 100).replace('.', ','); }
export function faixa(p) { return p[0] === p[1] ? 'cerca de ' + euros(p[0]) : 'entre ' + euros(p[0]) + ' e ' + euros(p[1]); }
function curta(p) { return p[0] === p[1] ? euros(p[0]) : milhares(p[0]) + '–' + euros(p[1]); }
function lista(xs) { return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1]; }
function soma(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k]; }
const espacos = (t) => t.replace(/ /g, ' ');

/* ── Potência ── */

export function configPotencia(cfg) {
  const tipos = cfg && cfg.tipos ? Object.keys(cfg.tipos) : [];
  const tamanhos = cfg && cfg.tamanhos ? cfg.tamanhos.slice().sort((a, b) => a - b) : [];
  if (!tipos.length || !tamanhos.length || !(cfg.porM2 > 0) || !(cfg.btuPorKw > 0)) return null;
  return {
    cfg, tipos, tamanhos, MAIOR: tamanhos[tamanhos.length - 1], MAX: cfg.maxDivisoes || 8,
    FOLGA: cfg.folga >= 0 && cfg.folga < 0.5 ? cfg.folga : 0,
    AREA_MIN: cfg.areaMin || 2, AREA_MAX: cfg.areaMax || 200,
  };
}

/* divisoes: [{ tipo, area (m²), sol, ultimoAndar }]. Devolve cada divisão com a estimativa (est) e o tamanho (tam;
   0 = acima do maior tamanho, a dimensionar na visita), o total e o resumo igual ao que o formulário junta ao pedido. */
export function potencia(C, divisoes) {
  if (!C) return { erro: 'A estimativa de potência não está configurada (btu em data/site.json).' };
  const erros = [], divs = [];
  if (!Array.isArray(divisoes) || !divisoes.length) return { erro: 'Falta pelo menos uma divisão, com o tipo e a área.' };
  if (divisoes.length > C.MAX) erros.push(`No máximo ${C.MAX} divisões; para mais, a MDM dimensiona na visita.`);
  divisoes.slice(0, C.MAX).forEach((d, i) => {
    const tipo = C.tipos.includes(d.tipo) ? d.tipo : null;
    const a = Math.round(Number(d.area) * 100) / 100;
    if (!tipo) { erros.push(`Divisão ${i + 1}: tipo «${d.tipo}» desconhecido (${C.tipos.join(', ')}).`); return; }
    if (!(a > 0)) { erros.push(`Divisão ${i + 1}: falta a área em m².`); return; }
    if (a < C.AREA_MIN) { erros.push(`Divisão ${i + 1}: a área tem de ter pelo menos ${decimal(C.AREA_MIN)} m².`); return; }
    const cfg = C.cfg, sol = !!d.sol, topo = !!d.ultimoAndar;
    const est = Math.round(a * cfg.porM2 * (cfg.tipos[tipo] || 1) * (sol ? cfg.sol || 1 : 1) * (topo ? cfg.ultimoAndar || 1 : 1));
    /* acima de AREA_MAX m² a divisão conta, a dimensionar na visita (tam 0), como acima do maior aparelho; como no site.js */
    const tam = a > C.AREA_MAX ? 0 : C.tamanhos.find((t) => t >= est * (1 - C.FOLGA)) || 0;
    divs.push({ tipo, area: a, sol, topo, est, tam });
  });
  let total = 0, acima = false;
  divs.forEach((d) => { total += d.tam || C.MAIOR; if (!d.tam) acima = true; });
  const kw = (btu) => (btu / C.cfg.btuPorKw).toFixed(1).replace('.', ',');
  const partes = divs.map((d) => {
    const extra = [];
    if (d.sol) extra.push('muito sol');
    if (d.topo) extra.push('último andar');
    return d.tipo + ' ' + decimal(d.area) + NB + 'm²' + (extra.length ? ' (' + extra.join(', ') + ')' : '') + ': ' +
      (d.tam ? btuh(d.tam) : 'mais de ' + btuh(C.MAIOR) + ', a dimensionar na visita');
  });
  if (divs.length) partes.push('Total ' + (acima ? 'mais de ' : '') + btuh(total) + ' (' + kw(total) + NB + 'kW)');
  return {
    divs: divs.map((d) => ({ ...d, kw: d.tam ? kw(d.tam) : null,
      texto: espacos(d.tam ? btuh(d.tam) : 'mais de ' + btuh(C.MAIOR) + ', a dimensionar na visita') })), n: divs.length, total, acima, kwTotal: kw(total),
    resumo: espacos(partes.join(' · ')), erros,
  };
}

/* ── Preço provável ── */

function obj(o, k) { const v = o && o[k]; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
function inteiro(x) { return typeof x === 'number' && x >= 0 && Math.floor(x) === x; }
function par(v) { return Array.isArray(v) && v.length === 2 && inteiro(v[0]) && inteiro(v[1]) && v[0] <= v[1] ? v : null; }
/* uma linha da tabela com pelo menos uma gama preenchida: { eco: [mín, máx] ou null, sup: … }; sem nenhuma, null */
function linha(o, k) {
  const l = obj(o, k), r = {};
  let alguma = false;
  GAMAS.forEach((g) => { r[g.k] = par(l[g.k]); if (r[g.k]) alguma = true; });
  return alguma ? r : null;
}

/* Prepara a tabela uma vez: o que existe, que perguntas se podem fazer e as respostas aceites. */
export function configPreco(P, C) {
  P = P && typeof P === 'object' ? P : {};
  const split = obj(P, 'split'), multi = obj(P, 'multisplit'), aq = obj(P, 'aguasQuentes'), ex = obj(P, 'extras'), inc = obj(P, 'inclui');
  const frase = (k) => (typeof inc[k] === 'string' ? inc[k].trim() : '');
  const algumaLinha = (o) => Object.keys(o).some((k) => k !== 'acrescimoGrande' && !!linha(o, k));
  const temAC = !!(C && ((frase('split') && algumaLinha(split)) || (frase('multisplit') && algumaLinha(multi))));
  const temBC = !!(frase('aguasQuentes') && algumaLinha(aq));
  const X = {};
  ['metroExtra', 'preInstalacaoDesconto', 'furoBetao', 'alturaEscada', 'alturaAndaime', 'alturaPlataforma', 'ligacaoEletrica',
    'retirarAntiga'].forEach((k) => { X[k] = par(ex[k]); });
  const METROS = inteiro(ex.metrosIncluidos) ? ex.metrosIncluidos : null;
  /* fachada mais alta: andaime ou plataforma, do menor dos mínimos ao maior dos máximos */
  const ALTA = X.alturaAndaime && X.alturaPlataforma
    ? [Math.min(X.alturaAndaime[0], X.alturaPlataforma[0]), Math.max(X.alturaAndaime[1], X.alturaPlataforma[1])]
    : X.alturaAndaime || X.alturaPlataforma;

  /* as perguntas, como no formulário: [valor, texto da opção, texto no resumo (se for outro)] */
  const SIM_NAO = [['sim', 'Sim'], ['nao', 'Não']], SIM_NAO_NS = SIM_NAO.concat([['nsei', 'Não sei']]);
  const perguntas = [];
  if (temAC) {
    if (X.preInstalacaoDesconto) perguntas.push({ k: 'pre', ac: true, t: 'Já tem pré-instalação (tubos na parede)?', r: 'pré-instalação', op: SIM_NAO });
    if (X.metroExtra && METROS !== null) perguntas.push({ k: 'dist', ac: true, t: 'Distância entre a máquina de dentro e a de fora (em cada divisão, em média)', r: 'distância', op: [
      ['0', 'Até ' + METROS + NB + 'm'], ['5', 'Cerca de ' + (METROS + 5) + NB + 'm'], ['10', 'Cerca de ' + (METROS + 10) + NB + 'm'],
      ['mais', 'Mais do que isso', 'mais de ' + (METROS + 10) + ' m, a confirmar na visita']] });
    if (X.furoBetao) perguntas.push({ k: 'furo', ac: true, t: 'A parede é de betão ou pedra?', r: 'parede de betão ou pedra', op: SIM_NAO_NS });
    if (X.alturaEscada || ALTA) perguntas.push({ k: 'fora', ac: true, t: 'Onde fica a máquina de fora?', r: 'máquina de fora', op: [['chao', 'No chão ou varanda']]
      .concat(X.alturaEscada ? [['escada', 'Fachada, até ao 1.º andar (escada grande)', 'fachada até ao 1.º andar, escada grande']] : [])
      .concat(ALTA ? [['alta', 'Fachada mais alta (andaime ou plataforma elevatória)', 'fachada mais alta, andaime ou plataforma']] : []) });
    if (X.ligacaoEletrica) perguntas.push({ k: 'luz', ac: true, t: 'Precisa de ligação elétrica nova a partir do quadro?', r: 'ligação elétrica nova', op: SIM_NAO_NS });
    if (X.retirarAntiga) perguntas.push({ k: 'antigas', ac: true, t: 'Há máquinas antigas para retirar?', r: 'máquinas antigas a retirar',
      op: [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']] });
  }
  if (temBC) {
    const aq200 = linha(aq, '200'), aq300 = linha(aq, '300');
    perguntas.push({ k: 'deposito', ac: false, t: 'Tamanho do depósito', r: 'depósito', op: (aq200 ? [['200', '200 L']] : [])
      .concat(aq300 ? [['300', '300 L']] : []).concat(aq200 && aq300 ? [['nsei', 'Não sei']] : []) });
  }
  return { C, split, multi, aq, X, ALTA, METROS, frase, temAC, temBC, perguntas };
}

/* opts: { servico: 'ac' | 'aguasQuentes', divisoes (como em potencia(), só para ac), respostas: { pre, dist, furo, fora, luz,
   antigas, deposito } }. Uma resposta a uma pergunta que a tabela não tem, ou com um valor fora das opções, não conta
   (vai em «ignoradas»). Devolve modo 'preco' (com blocos e o resumo igual ao do formulário), 'visita' (o preço dá-se
   depois da visita), 'sem_tabela' (esse produto ainda não tem preços; no ar condicionado, com a potência) ou 'erro'. */
export function preco(T, opts) {
  const servico = opts && opts.servico;
  const r = (opts && opts.respostas) || {};
  const ignoradas = [], valido = {};
  Object.keys(r).forEach((k) => {
    const v = r[k] == null ? '' : String(r[k]);
    if (v === '') return;
    const q = T.perguntas.find((p) => p.k === k && p.ac === (servico === 'ac'));
    if (q && q.op.some((o) => o[0] === v)) valido[k] = v;
    else ignoradas.push(k + '=' + v);
  });
  const resposta = (k) => valido[k] || '';
  const porResponder = T.perguntas.filter((q) => q.ac === (servico === 'ac') && !valido[q.k])
    .map((q) => ({ chave: q.k, pergunta: q.t, opcoes: q.op.map((o) => ({ valor: o[0], texto: espacos(o[1]) })) }));
  function respostas(ac) {
    const out = [];
    T.perguntas.forEach((q) => {
      if (q.ac !== ac) return;
      const v = resposta(q.k);
      q.op.forEach((o) => { if (o[0] === v) out.push(q.r + ': ' + (o[2] || o[1].charAt(0).toLowerCase() + o[1].slice(1))); });
    });
    return out;
  }
  const extra = { ignoradas, porResponder };

  if (servico === 'aguasQuentes') {
    if (!T.temBC) return { modo: 'sem_tabela', ...extra };
    const dep = resposta('deposito');
    const blocos = (dep === 'nsei' ? ['200', '300'] : dep ? [dep] : []).map((t) => (
      { titulo: 'Bomba de calor para águas quentes, depósito de ' + t + NB + 'L', curto: 'depósito de ' + t + ' L', gamas: linha(T.aq, t) }
    )).filter((b) => b.gamas);
    if (!blocos.length) return { modo: 'escolhe', ...extra };
    return fecha({ modo: 'preco', n: 0, inclui: T.frase('aguasQuentes'), confirmar: false, blocos,
      dets: ['bomba de calor para águas quentes'].concat(respostas(false)) }, extra);
  }
  if (servico !== 'ac') return { modo: 'erro', erro: 'servico tem de ser «ac» ou «aguasQuentes».', ...extra };
  const e = potencia(T.C, opts.divisoes);
  /* sem preços, a potência conta-se na mesma (a equipa vê-a e o modelo recebe-a), mas nenhum preço sai daqui */
  if (!T.temAC) return { modo: 'sem_tabela', ...(e.erro || e.erros.length ? {} : { n: e.n, potencia: e }), ...extra };
  if (e.erro) return { modo: 'erro', erro: e.erro, ...extra };
  if (e.erros.length) return { modo: 'erro', erro: e.erros.join(' '), ...extra };
  const n = e.n, visita = { modo: 'visita', n, potencia: e, ...extra };
  if (e.acima || n > MAX_MULTI) return visita;
  const tams = e.divs.map((d) => d.tam);
  let base = {}, sep = null, titulo, det, inclui;
  if (n === 1) {
    base = T.frase('split') && linha(T.split, String(tams[0]));
    if (!base) return visita;
    inclui = T.frase('split');
    titulo = 'Split para 1 divisão, ' + btuh(tams[0]);
    det = 'split ' + btuh(tams[0]);
  } else {
    const m = T.frase('multisplit') && linha(T.multi, String(n));
    if (!m) return visita;
    const grandes = tams.filter((t) => t > GRANDE).length, acr = linha(T.multi, 'acrescimoGrande');
    GAMAS.forEach((g) => {
      let b = m[g.k];
      if (b && grandes) b = acr && acr[g.k] ? soma(b, acr[g.k], grandes) : null;
      base[g.k] = b;
    });
    if (!base.eco && !base.sup) return visita;
    inclui = T.frase('multisplit');
    titulo = 'Multi-split para ' + n + ' divisões: ' + lista(tams.map(milhares)) + NB + 'BTU/h';
    det = 'multi-split ' + n + ' divisões: ' + tams.map(milhares).join(' + ') + ' BTU/h';
    /* com uma máquina para cada divisão: a soma das linhas do split, se estiverem todas */
    sep = {};
    GAMAS.forEach((g) => {
      let t = [0, 0];
      tams.forEach((tam) => { const ls = linha(T.split, String(tam)); t = t && ls && ls[g.k] ? soma(t, ls[g.k], 1) : null; });
      sep[g.k] = t;
    });
  }
  const X = T.X;
  let d = [0, 0], confirmar = false;
  const pre = resposta('pre'), dist = resposta('dist'), furo = resposta('furo'), fora = resposta('fora'), luz = resposta('luz'), antigas = resposta('antigas');
  if (pre === 'sim') d = [d[0] - X.preInstalacaoDesconto[1] * n, d[1] - X.preInstalacaoDesconto[0] * n];
  if (dist) { d = soma(d, X.metroExtra, (dist === 'mais' ? 10 : +dist) * n); confirmar = dist === 'mais'; }
  if (furo === 'sim') d = soma(d, X.furoBetao, n); else if (furo === 'nsei') d[1] += X.furoBetao[1] * n;
  if (fora === 'escada') d = soma(d, X.alturaEscada, 1); else if (fora === 'alta') d = soma(d, T.ALTA, 1);
  if (luz === 'sim') d = soma(d, X.ligacaoEletrica, 1); else if (luz === 'nsei') d[1] += X.ligacaoEletrica[1];
  if (antigas) d = soma(d, X.retirarAntiga, +antigas);
  function aplica(b) {
    const out = {};
    GAMAS.forEach((g) => { out[g.k] = b && b[g.k] ? [Math.max(0, b[g.k][0] + d[0]), Math.max(0, b[g.k][1] + d[1])] : null; });
    return out;
  }
  return fecha({ modo: 'preco', n, inclui, confirmar, potencia: e, dets: [det].concat(respostas(true)),
    blocos: [{ titulo, gamas: aplica(base), sep: sep && aplica(sep) }] }, extra);
}

/* acrescenta o texto pronto (o mesmo resumo que o formulário põe no campo «estimativa») e as linhas por gama */
function fecha(c, extra) {
  const varios = c.blocos.length > 1;
  function gamas(b, k) {
    return GAMAS.filter((g) => b.gamas[g.k] && b[k] && b[k][g.k]).map((g) => g.nome + ' ' + curta(b[k][g.k])).join('; ');
  }
  let resumo = 'Preço provável mostrado: ' + c.blocos.map((b) => (varios ? b.curto + ': ' : '') + gamas(b, 'gamas')).join('; ') +
    ' (' + c.dets.join(', ') + ')';
  const sep = c.blocos[0].sep && gamas(c.blocos[0], 'sep');
  if (sep) resumo += '; com uma máquina para cada divisão: ' + sep;
  const blocos = c.blocos.map((b) => ({
    titulo: espacos(b.titulo),
    gamas: GAMAS.filter((g) => b.gamas[g.k]).map((g) => {
      const v = b.gamas[g.k], s = b.sep && b.sep[g.k];
      return { gama: g.nome, exemplo: g.ex, min: v[0], max: v[1], texto: espacos(faixa(v)) + (c.confirmar ? ', a confirmar na visita' : ''),
        umaPorDivisao: s ? espacos(s[0] === s[1] ? euros(s[0]) : milhares(s[0]) + ' a ' + euros(s[1])) : null };
    }),
  }));
  return { ...c, blocos, resumo: espacos(resumo), ...extra };
}
