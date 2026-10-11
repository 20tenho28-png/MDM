#!/usr/bin/env node
/* ORÇAMENTO MDM: a proposta modelo para o cliente, a partir de um pedido do site ou dos dados que a equipa dá.
   As contas e o texto são os do site e do assistente da equipa (website/netlify/lib/calculo.mjs e proposta-modelo.mjs),
   com os mesmos dados (website/data/site.json «btu», precos.json, regras-marcas.json): o mesmo pedido dá o mesmo
   tamanho, a mesma gama e o mesmo preço em todo o lado. Nada se inventa: sem preço na tabela, a proposta diz que o
   preço se dá depois da visita.

   Uso (a partir de qualquer pasta):
     node orcamento.mjs --pedido pedido.txt        o email do pedido, ou a linha da folha «Pedidos», como texto
     node orcamento.mjs --dados dados.json         { servico, divisoes, respostas, cliente, pedido, observacoes }
     node orcamento.mjs < pedido.txt               o mesmo, pela entrada padrão (texto ou JSON)
   Opções:
     --html proposta.html   escreve também a proposta para imprimir em PDF (abrir no browser, Imprimir, Guardar PDF)
     --json                 escreve o resultado em JSON, em vez de texto
     --servico ac|aguasQuentes, --nome, --contacto, --local, --pedido-texto «…», --nota «…» (pode repetir),
     --resposta chave=valor (pode repetir; chaves: pre, dist, furo, fora, luz, antigas, deposito),
     --divisao «Sala;25;sol;ultimo» (pode repetir; substitui as divisões lidas do pedido)
     --teste                usa a tabela de TESTE (números falsos; a proposta sai marcada)
     --precos ficheiro      outra tabela de preços (também MDM_PRECOS_FICHEIRO)
   Saída: 0 com proposta; 2 sem proposta (falta um dado, ou o trabalho não tem tabela); 1 erro de uso. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
/* no pacote para o claude.ai (empacota_skill.py) as bibliotecas vêm em scripts/lib e os dados em dados/; no repositório,
   usam-se os ficheiros do site, sem cópias */
const PACOTE = fs.existsSync(path.join(AQUI, 'lib', 'calculo.mjs'));
const W = path.resolve(AQUI, '../../../../website');
const LIB = PACOTE ? path.join(AQUI, 'lib') : path.join(W, 'netlify/lib');
const DADOS = PACOTE ? path.resolve(AQUI, '../dados') : path.join(W, 'data');
const CSS = PACOTE ? path.join(DADOS, 'proposta.css') : path.join(W, 'equipa/proposta.css');
const FONTES = PACOTE ? path.join(DADOS, 'fonts') : path.join(W, 'assets/fonts');
const LOGO = PACOTE ? path.join(DADOS, 'logo-mdm.svg') : path.join(W, 'assets/img/logo-mdm.svg');

const { configPotencia, configPreco, potencia, GAMAS } = await import(pathToFileURL(path.join(LIB, 'calculo.mjs')).href);
const { criaRegras, divisoesDe, montaProposta } = await import(pathToFileURL(path.join(LIB, 'proposta-modelo.mjs')).href);

const lerJSON = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const semNotas = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

/* os espaços inseparáveis e finos do site viram espaços normais: o texto lê-se igual, venha do email, da folha ou do JSON */
export const normal = (t) => String(t ?? '').replace(/[    ]/g, ' ');

export function carregaDados({ teste = false, precos = process.env.MDM_PRECOS_FICHEIRO || '' } = {}) {
  const site = lerJSON(path.join(DADOS, 'site.json'));
  const regras = lerJSON(path.join(DADOS, 'regras-marcas.json'));
  const fTeste = path.join(DADOS, 'precos-teste.json');
  const ficheiro = teste ? fTeste : precos ? path.resolve(precos) : path.join(DADOS, 'precos.json');
  const tabela = lerJSON(ficheiro);
  /* a tabela de teste nunca sai como verdadeira: pelo nome ou pelos números (como o --check do build.py) */
  let eTeste = teste || path.basename(ficheiro) === 'precos-teste.json';
  if (!eTeste && fs.existsSync(fTeste)) eTeste = JSON.stringify(semNotas(tabela)) === JSON.stringify(semNotas(lerJSON(fTeste)));
  const C = configPotencia(site.btu);
  return { site, regras, C, T: configPreco(tabela, C), teste: eTeste, ficheiro, ...criaRegras(regras) };
}

/* ── Ler o pedido do site ──
   O email do pedido (Apps Script ou Netlify), a linha copiada da folha «Pedidos» ou um texto com os mesmos campos.
   A potência e o preço reconhecem-se pela forma do texto que o site escreve (o resumo de calculo.mjs), em qualquer formato;
   o nome, o email e o telefone pelos rótulos («Nome ou empresa:», «Email:», «Telefone:»). */

const SERVICO_SITE = [
  ['Ar condicionado: montagem / instalação', 'ac'],
  ['Bomba de calor: instalação / manutenção', 'aguasQuentes'],
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* «Sala 25 m² (muito sol, último andar): 12 000 BTU/h · Quarto 12,5 m²: 7 000 BTU/h · Total 19 000 BTU/h (5,6 kW)» */
export function lePotencia(texto, C) {
  const linhas = normal(texto).split(/\r?\n/);
  const linha = linhas.find((l) => /Total (?:mais de )?\d{1,3}(?: \d{3})* BTU\/h \(\d+(?:,\d)? kW\)/.test(l));
  if (!linha) return null;
  const tipos = C.tipos.slice().sort((a, b) => b.length - a.length).map(esc).join('|');
  const re = new RegExp(`(${tipos}) (\\d+(?:,\\d+)?) m²(?: \\(([^)]*)\\))?: (?:(\\d{1,3}(?: \\d{3})*) BTU\\/h|mais de \\d{1,3}(?: \\d{3})* BTU\\/h, a dimensionar na visita)`, 'g');
  const inicio = linha.search(new RegExp(`(?:${tipos}) \\d`));
  const fim = linha.search(/\(\d+(?:,\d)? kW\)/);
  if (inicio < 0 || fim < inicio) return null;
  const resumo = linha.slice(inicio, linha.indexOf(')', fim) + 1).trim();
  const divisoes = [];
  for (const m of resumo.matchAll(re)) {
    const extra = (m[3] || '').split(',').map((x) => x.trim());
    divisoes.push({ tipo: m[1], area: Number(m[2].replace(',', '.')), sol: extra.includes('muito sol'),
      ultimo_andar: extra.includes('último andar'), tamanhoVisto: m[4] ? Number(m[4].replace(/ /g, '')) : 0 });
  }
  if (!divisoes.length) return null;
  return { divisoes, resumo };
}

/* as respostas às perguntas do preço, pelo que vem entre parênteses em «Preço provável mostrado: …» */
export function leEstimativa(texto, T, servico) {
  const linha = normal(texto).split(/\r?\n/).find((l) => l.includes('Preço provável mostrado:'));
  if (!linha) return null;
  const respostas = {};
  T.perguntas.filter((q) => q.ac === (servico === 'ac')).forEach((q) => {
    q.op.forEach((o) => {
      const rotulo = normal(q.r + ': ' + (o[2] || o[1].charAt(0).toLowerCase() + o[1].slice(1)));
      if (new RegExp(esc(rotulo) + '(?=[,;)]|$)').test(linha)) respostas[q.k] = o[0];
    });
  });
  return { respostas, resumo: linha.slice(linha.indexOf('Preço provável mostrado:')).split('\t')[0].replace(/<.*$/, '').trim() };
}

function campo(texto, rotulos) {
  for (const r of rotulos) {
    const m = normal(texto).match(new RegExp(`^[ \\t]*${r}[ \\t]*(?::|\\t)[ \\t]*(.+)$`, 'im'));
    if (m && m[1].trim() && m[1].trim() !== '-') return m[1].trim();
  }
  return '';
}
function mensagem(texto) {
  const m = normal(texto).match(/^[ \t]*Mensagem[ \t]*:[ \t]*\r?\n([\s\S]*?)(?:\r?\n[ \t]*\r?\n|$)/im)
    || normal(texto).match(/^[ \t]*Mensagem[ \t]*:[ \t]*(.+)$/im);
  const t = m ? m[1].trim() : '';
  return t === '-' ? '' : t;
}

/* a linha copiada da folha «Pedidos» do Google: colunas separadas por tabulações, pela ordem de CABECALHO em
   google/pedidos.gs (com o cabeçalho copiado junto, as colunas acham-se pelo nome). Uma célula com várias linhas vem
   entre aspas, com as aspas de dentro dobradas, como o Google a copia. Devolve o texto com os rótulos do email. */
const COLUNAS_FOLHA = ['Data e hora', 'Ref', 'Destino', 'Triagem', 'Serviço', 'Nome', 'Email', 'Telefone', 'Mensagem',
  'Potência', 'Estimativa', 'Página', 'Fotografia', 'Estado', 'Notas'];
function tsv(texto) {
  const linhas = [];
  let linha = [], cel = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') { cel += '"'; i++; } else if (c === '"') aspas = false; else cel += c;
    } else if (c === '"' && cel === '') aspas = true;
    else if (c === '\t') { linha.push(cel); cel = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && texto[i + 1] === '\n') i++; linha.push(cel); linhas.push(linha); linha = []; cel = ''; }
    else cel += c;
  }
  linha.push(cel); linhas.push(linha);
  return linhas;
}
export function leLinhaFolha(texto) {
  const linhas = tsv(normal(texto)).filter((l) => l.length >= 10);
  const iCab = linhas.findIndex((l) => l.map((c) => c.trim()).includes('Potência'));
  const cab = iCab >= 0 ? linhas[iCab].map((c) => c.trim()) : COLUNAS_FOLHA;
  const cel = linhas.find((_, i) => i !== iCab);
  if (!cel) return null;
  const v = (nome) => { const i = cab.indexOf(nome); return i >= 0 ? String(cel[i] ?? '').trim().replace(/^'/, '') : ''; };
  return [`Serviço: ${v('Serviço')}`, `Nome ou empresa: ${v('Nome')}`, `Email: ${v('Email')}`, `Telefone: ${v('Telefone')}`,
    `Potência estimada: ${v('Potência')}`, `Preço provável: ${v('Estimativa')}`, '', 'Mensagem:', v('Mensagem') || '-', ''].join('\n');
}

export function lePedido(texto, D) {
  const folha = String(texto).includes('\t') ? leLinhaFolha(texto) : null;
  const t = normal(folha || texto);
  let servico = '', servicoTexto = '';
  for (const [rot, k] of SERVICO_SITE) if (t.includes(rot)) { servico = k; servicoTexto = rot; break; }
  if (!servico) {
    const m = t.match(/^[ \t]*(?:Serviço|servico)[ \t]*(?::|\t)[ \t]*(.+)$/im);
    if (m && m[1].trim() !== '-' && !/não escolhido/i.test(m[1])) { servico = 'outro'; servicoTexto = m[1].trim(); }
  }
  const pot = lePotencia(t, D.C);
  /* sem serviço escolhido, uma estimativa de potência junta ao pedido é de ar condicionado (como no site) */
  if (!servico && pot) { servico = 'ac'; servicoTexto = 'Ar condicionado: montagem / instalação'; }
  const est = servico === 'ac' || servico === 'aguasQuentes' ? leEstimativa(t, D.T, servico) : null;
  const telefone = campo(t, ['Telefone', 'telefone']), email = campo(t, ['Email', 'E-mail']);
  return {
    servico, servicoTexto,
    divisoes: pot ? pot.divisoes.map(({ tamanhoVisto, ...d }) => d) : [],
    respostas: est ? est.respostas : {},
    cliente: { nome: campo(t, ['Nome ou empresa', 'Nome']), contacto: telefone || email, local: campo(t, ['Local', 'Localidade', 'Morada']) },
    pedido: mensagem(t),
    observacoes: [],
    visto: { potencia: pot ? pot.resumo : '', estimativa: est ? est.resumo : '', tamanhos: pot ? pot.divisoes.map((d) => d.tamanhoVisto) : [] },
  };
}

/* ── A proposta ── */

export function orcamento(dados, D) {
  const avisos = [];
  const servico = dados.servico;
  if (servico !== 'ac' && servico !== 'aguasQuentes') {
    return { modo: 'outro', proposta: null, avisos, porResponder: [], recusadas: [],
      motivo: `Trabalho sem tabela de preços${dados.servicoTexto ? ` («${dados.servicoTexto}»)` : ''}: o preço dá-se depois da visita, que é gratuita. Marque a visita com o cliente.` };
  }
  const entrada = { ...dados, divisoes: (dados.divisoes || []).map((d) => ({ ...d, ultimo_andar: d.ultimo_andar ?? d.ultimoAndar })) };
  let m = montaProposta(entrada, D.T, { teste: D.teste, site: D.site, proibido: D.proibido });
  /* sem preços na tabela (hoje), a proposta sai na mesma, com a potência e as gamas, e o preço depois da visita */
  if (!m.proposta && m.r.modo === 'sem_tabela' && (servico === 'aguasQuentes' || m.r.potencia)) {
    m = montaProposta(entrada, D.T, { teste: D.teste, site: D.site, proibido: D.proibido, semTabela: GAMAS });
  }
  const r = m.r;
  if (dados.visto?.potencia && r.potencia && normal(r.potencia.resumo) !== normal(dados.visto.potencia)) {
    avisos.push(`A potência mudou desde o pedido: o cliente viu «${dados.visto.potencia}» e a conta de hoje dá «${normal(r.potencia.resumo)}». Os números de «btu» em data/site.json mudaram; a proposta usa os de hoje.`);
  }
  if (dados.visto?.estimativa && r.resumo && normal(r.resumo) !== normal(dados.visto.estimativa)) {
    avisos.push(`O preço mudou desde o pedido: o cliente viu «${dados.visto.estimativa}». A proposta usa a tabela de hoje; confirme antes de enviar.`);
  } else if (dados.visto?.estimativa && !r.resumo) {
    avisos.push(`O cliente viu um preço no site («${dados.visto.estimativa}»), mas a tabela de hoje não dá preço para este caso. Confirme antes de enviar.`);
  }
  if (r.ignoradas?.length) {
    avisos.push(`Respostas que não contaram (a tabela não tem essa pergunta, ou o valor não é uma das opções): ${r.ignoradas.join(', ')}.`);
  }
  if (D.teste) avisos.unshift('Tabela de TESTE, com números falsos: esta proposta não se envia ao cliente.');
  const porResponder = (r.porResponder || []).map((q) => `${q.pergunta} (${q.opcoes.map((o) => normal(o.texto)).join(' / ')})`);
  if (!m.proposta) {
    /* sem tabela, preco() não diz o que falta na potência: pergunta-se a calculo.mjs */
    const e = servico === 'ac' && r.modo === 'sem_tabela' && !r.potencia ? potencia(D.C, divisoesDe(entrada)) : null;
    const falta = e ? e.erro || e.erros.join(' ') : '';
    const motivo = r.modo === 'escolhe' ? 'Falta o tamanho do depósito (200 L ou 300 L).'
      : r.modo === 'erro' ? `Faltam dados: ${r.erro}` : falta ? `Faltam dados: ${falta}` : 'Ainda não há preços para este produto na tabela da MDM.';
    return { modo: r.modo, proposta: null, avisos, porResponder, recusadas: m.recusadas || [], motivo,
      potencia: r.potencia ? normal(r.potencia.resumo) : '' };
  }
  return { modo: m.proposta.modo, proposta: m.proposta, avisos, porResponder: m.proposta.modo === 'preco' ? porResponder : [],
    recusadas: m.recusadas };
}

export function textoEquipa(res) {
  const l = [];
  if (res.proposta) l.push(res.proposta.texto, '');
  l.push('==========', 'PARA A EQUIPA (não enviar ao cliente)');
  if (!res.proposta) {
    l.push(`Sem proposta: ${res.motivo}`);
    if (res.potencia) l.push(`Potência estimada: ${res.potencia}`);
  } else {
    l.push(`Referência: ${res.proposta.ref}`);
    l.push(res.modo === 'preco' ? 'Preço da tabela da MDM, por gama.' : 'Sem preço na proposta: dá-se depois da visita, que é gratuita.');
  }
  if (res.porResponder.length) { l.push('Perguntas que ainda mudam o preço (fazer ao cliente):'); res.porResponder.forEach((p) => l.push(`- ${p}`)); }
  if (res.avisos.length) { l.push('Avisos:'); res.avisos.forEach((a) => l.push(`- ${a}`)); }
  if (res.recusadas.length) { l.push('Ficou de fora da proposta (regras do dono):'); res.recusadas.forEach((a) => l.push(`- ${a}`)); }
  return l.join('\n');
}

/* ── A proposta em HTML, para imprimir em PDF: a mesma folha da página da equipa (equipa/proposta.css, classes doc-) ── */

const h = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* os números não partem a meio: 4 480 €, 12 000 BTU/h (como inseparavel() em equipa/proposta.js) */
const inseparavel = (t) => normal(t).replace(/(\d) (?=\d{3}\b)/g, '$1 ').replace(/ (€|BTU\/h|m²)/g, ' $1');

export function htmlProposta(p, { css = '', logo = '' } = {}) {
  const e = p.empresa;
  const dados = [['Cliente', p.cliente.nome], ['Contacto', p.cliente.contacto], ['Local', p.cliente.local], ['Pedido', p.pedido]]
    .filter(([, v]) => v).map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`).join('');
  const pot = p.divisoes && p.divisoes.length ? `<p class="doc-sec">Potência estimada</p><div class="doc-pot-caixa"><table class="doc-pot"><thead><tr>`
    + ['Divisão', 'Área', 'Condições', 'Potência'].map((t, i) => `<th scope="col"${i === 3 ? ' class="num"' : ''}>${t}</th>`).join('') + '</tr></thead><tbody>'
    + p.divisoes.map((d) => {
      const cond = [d.sol ? 'muito sol' : '', d.topo ? 'último andar' : ''].filter(Boolean).join(', ');
      return `<tr><td>${h(d.tipo)}</td><td>${h(inseparavel(String(d.area).replace('.', ',') + ' m²'))}</td><td>${h(cond)}</td><td class="num">${h(inseparavel(d.texto || ''))}</td></tr>`;
    }).join('') + '</tbody></table></div>' : '';
  const blocos = (p.blocos || []).map((b) => `<section class="doc-bloco"><h4 class="doc-bloco-t">${h(inseparavel(b.titulo))}</h4><ul class="doc-gamas">`
    + b.gamas.map((g) => `<li class="doc-gama"><p class="doc-gama-n">${h(g.gama)}</p><p class="doc-gama-ex">${h(g.exemplo)}</p>`
      + `<p class="doc-gama-v">${h(inseparavel(g.texto.charAt(0).toUpperCase() + g.texto.slice(1)))}</p>`
      + (g.umaPorDivisao ? `<p class="doc-gama-sep">Com uma máquina para cada divisão: ${h(inseparavel(g.umaPorDivisao))}</p>` : '') + '</li>').join('')
    + '</ul></section>').join('');
  const semPreco = (p.gamasSemPreco || []).length ? `<ul class="doc-gamas">` + p.gamasSemPreco.map((g) => `<li class="doc-gama"><p class="doc-gama-n">${h(g.gama)}</p><p class="doc-gama-ex">${h(g.exemplo)}</p></li>`).join('') + '</ul>' : '';
  const par = (rot, txt) => (txt ? `<p class="doc-p"><strong>${h(rot)}</strong> ${h(txt)}</p>` : '');
  const titulo = `Proposta ${p.ref}${p.cliente.nome ? ' ' + p.cliente.nome : ''}`;
  return `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${h(titulo)}</title>
<style>
${css}
body { padding: clamp(0px, 3vw, 32px); }
.doc { max-width: 860px; margin: 0 auto; }
@media print { body { padding: 0; } .doc { max-width: none; padding: 0; } }
</style>
</head>
<body>
<main class="doc">
${p.teste ? '<p class="doc-teste">Valores de teste · não enviar ao cliente</p>' : ''}
<header class="doc-cab"><div class="doc-marca">${logo ? `<span aria-hidden="true" style="display:block;width:44px;height:44px">${logo}</span>` : ''}<div><p class="doc-empresa">${h(e.nome)}</p><p class="doc-desde">Lisboa · desde ${h(e.desde)}</p></div></div>
<p class="doc-ref"><strong>${h(p.ref)}</strong>${h(p.data)}</p></header>
<h1 class="doc-tit">Proposta modelo</h1>
<p class="doc-servico">${h(p.servico)}</p>
${dados ? `<dl class="doc-dados">${dados}</dl>` : ''}
${pot}
<p class="doc-sec">Preço provável, com IVA</p>
${p.modo === 'visita' ? '<p class="doc-visita">Para este caso o preço dá-se depois da visita, que é gratuita.</p>' : ''}
${semPreco}
${blocos}
${par('Inclui:', p.inclui)}
${p.considerado && p.considerado.length > 1 ? par('Considerámos:', p.considerado.slice(1).join(', ') + '.') : ''}
${p.observacoes.length ? `<p class="doc-sec">Notas</p><ul class="doc-notas">${p.observacoes.map((o) => `<li>${h(o)}</li>`).join('')}</ul>` : ''}
<div class="doc-cond">${p.condicoes.map((c) => `<p>${h(c)}</p>`).join('')}</div>
<footer class="doc-pe"><span><strong>${h(e.telefone)}</strong> (${h(e.horario)}) · WhatsApp ${h(e.whatsapp)} · ${h(e.email)}</span><span>${h(e.morada.join(', '))} · ${h(e.nomeLegal)} · NIF ${h(e.nif)}</span></footer>
</main>
</body>
</html>
`;
}

/* a folha de estilo da equipa, com as letras dentro (o HTML abre-se sozinho, sem a pasta do site) */
export function cssProposta() {
  if (!fs.existsSync(CSS)) return '';
  return fs.readFileSync(CSS, 'utf8').replace(/url\((?:\.\.\/assets\/fonts\/)?([\w.-]+\.woff2)\)/g, (todo, nome) => {
    const f = path.join(FONTES, nome);
    return fs.existsSync(f) ? `url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')})` : todo;
  });
}
export function logoProposta() {
  if (!fs.existsSync(LOGO)) return '';
  return fs.readFileSync(LOGO, 'utf8').replace(/<\?xml[^>]*>\s*/, '').replace(/<svg\b/, '<svg width="44" height="44" aria-hidden="true"');
}

/* ── Linha de comandos ── */

function argumentos(argv) {
  const a = { nota: [], resposta: [], divisao: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const valor = () => { if (i + 1 >= argv.length) throw new Error(`falta o valor de ${k}`); return argv[++i]; };
    if (k === '--json' || k === '--teste') a[k.slice(2)] = true;
    else if (['--nota', '--resposta', '--divisao'].includes(k)) a[k.slice(2)].push(valor());
    else if (['--pedido', '--dados', '--html', '--servico', '--nome', '--contacto', '--local', '--pedido-texto', '--precos'].includes(k)) a[k.slice(2)] = valor();
    else if (k === '--ajuda' || k === '-h' || k === '--help') a.ajuda = true;
    else throw new Error(`opção desconhecida: ${k}`);
  }
  return a;
}

export function dadosDaLinha(a, D) {
  let texto = '';
  if (a.dados) texto = fs.readFileSync(a.dados, 'utf8');
  else if (a.pedido) texto = fs.readFileSync(a.pedido, 'utf8');
  else if (!process.stdin.isTTY) texto = fs.readFileSync(0, 'utf8');
  let dados;
  const t = texto.trim();
  if (a.dados || (t.startsWith('{') && t.endsWith('}'))) dados = JSON.parse(t);
  else dados = t ? lePedido(t, D) : { servico: '', divisoes: [], respostas: {}, cliente: {}, pedido: '', observacoes: [] };
  dados.cliente = { nome: '', contacto: '', local: '', ...(dados.cliente || {}) };
  dados.respostas = { ...(dados.respostas || {}) };
  dados.observacoes = [...(dados.observacoes || [])];
  if (a.servico) dados.servico = a.servico;
  if (a.nome) dados.cliente.nome = a.nome;
  if (a.contacto) dados.cliente.contacto = a.contacto;
  if (a.local) dados.cliente.local = a.local;
  if (a['pedido-texto']) dados.pedido = a['pedido-texto'];
  dados.observacoes.push(...a.nota);
  for (const r of a.resposta) { const [k, ...v] = r.split('='); dados.respostas[k.trim()] = v.join('=').trim(); }
  if (a.divisao.length) {
    dados.divisoes = a.divisao.map((s) => {
      const [tipo, area, ...extra] = s.split(';').map((x) => x.trim());
      const ex = extra.map((x) => x.toLowerCase());
      return { tipo, area: Number(String(area).replace(',', '.')), sol: ex.includes('sol'), ultimo_andar: ex.some((x) => /^[uú]ltimo/.test(x)) };
    });
    if (!dados.servico) dados.servico = 'ac';
  }
  return dados;
}

async function principal() {
  let a;
  try { a = argumentos(process.argv.slice(2)); } catch (e) { console.error(`orcamento.mjs: ${e.message}. Veja --ajuda.`); return 1; }
  if (a.ajuda) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\* ?/, '')); return 0; }
  const D = carregaDados({ teste: !!a.teste, precos: a.precos || process.env.MDM_PRECOS_FICHEIRO || '' });
  let dados;
  try { dados = dadosDaLinha(a, D); } catch (e) { console.error(`orcamento.mjs: não consegui ler os dados (${e.message}).`); return 1; }
  const res = orcamento(dados, D);
  if (a.html && res.proposta) fs.writeFileSync(a.html, htmlProposta(res.proposta, { css: cssProposta(), logo: logoProposta() }));
  if (a.json) console.log(JSON.stringify({ ...res, entrada: dados }, null, 2));
  else console.log(textoEquipa(res));
  if (a.html && !res.proposta) console.error('orcamento.mjs: sem proposta, não escrevi o HTML.');
  return res.proposta ? 0 : 2;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) process.exitCode = await principal();
