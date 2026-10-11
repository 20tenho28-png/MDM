#!/usr/bin/env node
/* ORÇAMENTO MDM: a proposta modelo para o cliente, a partir de um pedido do site ou dos dados que a equipa dá.
   As contas e o texto são os do site e do assistente da equipa (website/netlify/lib/calculo.mjs e proposta-modelo.mjs),
   com os mesmos dados (website/data/site.json «btu», precos.json, regras-marcas.json): o mesmo pedido dá o mesmo
   tamanho, a mesma gama e o mesmo preço em todo o lado. Nada se inventa: sem preço na tabela, a proposta diz que o
   preço se dá depois da visita.

   Uso (a partir de qualquer pasta):
     node orcamento.mjs --pedido pedido.txt     o pedido tal como veio: o email do site (em texto, o .eml descarregado
                                                ou copiado do ecrã), a linha da folha «Pedidos» ou a mensagem do cliente
     node orcamento.mjs --pedido -              o mesmo, pela entrada padrão (só assim se lê a entrada padrão)
     node orcamento.mjs --dados dados.json      { servico, divisoes, respostas, cliente, pedido, observacoes }
     node orcamento.mjs --divisao "Sala;25" …   sem pedido: só o que vem nas opções
   Opções:
     --html proposta.html   escreve também a proposta para imprimir em PDF (abrir no browser, Imprimir, Guardar PDF)
     --json                 escreve o resultado em JSON, em vez de texto
     --servico ac|aguasQuentes   o serviço (manda sobre o que vem no pedido)
     --pedido-texto «…»     o que o cliente pediu, numa frase curta: é o único texto do pedido que vai para a proposta
                            (a mensagem do cliente aparece só na parte «PARA A EQUIPA»)
     --nome, --contacto, --local, --nota «…» (pode repetir)
     --resposta chave=valor (pode repetir; chaves: pre, dist, furo, fora, luz, antigas, deposito)
     --divisao «tipo;área;extras» (pode repetir; substitui as divisões lidas do pedido). Área: 12, 12,5, 12.5, 12 m²
                            ou 12m2. Extras: sol (ou muito sol) e ultimo (ou último andar, sótão), separados por «;» ou «,»
     --teste                usa a tabela de TESTE (números falsos; a proposta sai marcada)
     --precos ficheiro      outra tabela de preços (também MDM_PRECOS_FICHEIRO)
   Saída: 0 com proposta; 2 sem proposta (falta um dado, o serviço não se reconheceu, ou o trabalho não tem tabela);
   1 erro de uso ou de ficheiro (se o HTML não se puder escrever, o texto da proposta sai na mesma). */
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

/* um erro de uso ou de ficheiro: a linha de comandos mostra só a mensagem, sem o rasto do Node, e sai com 1 */
export class ErroUso extends Error {}
const motivoFicheiro = (e) => ({ ENOENT: 'o ficheiro ou a pasta não existe', EACCES: 'sem permissão', EPERM: 'sem permissão',
  EISDIR: 'é uma pasta, não um ficheiro', ENOTDIR: 'uma parte do caminho não é uma pasta', EROFS: 'a pasta é só de leitura',
  ENOSPC: 'o disco está cheio' })[e.code] || e.message;
function lerJSON(f, que) {
  let t;
  try { t = fs.readFileSync(f, 'utf8'); } catch (e) { throw new ErroUso(`não consegui ler ${que} «${f}» (${motivoFicheiro(e)}).`); }
  try { return JSON.parse(t); } catch (e) { throw new ErroUso(`${que} «${f}» não é JSON válido (${e.message}).`); }
}
const semNotas = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

/* os espaços inseparáveis e finos do site viram espaços normais: o texto lê-se igual, venha do email, da folha ou do JSON */
export const normal = (t) => String(t ?? '').replace(/[    ]/g, ' ');

export function carregaDados({ teste = false, precos = process.env.MDM_PRECOS_FICHEIRO || '' } = {}) {
  const site = lerJSON(path.join(DADOS, 'site.json'), 'os dados do site');
  const regras = lerJSON(path.join(DADOS, 'regras-marcas.json'), 'as regras das marcas');
  const fTeste = path.join(DADOS, 'precos-teste.json');
  const ficheiro = teste ? fTeste : precos ? path.resolve(precos) : path.join(DADOS, 'precos.json');
  const tabela = lerJSON(ficheiro, 'a tabela de preços');
  /* a tabela de teste nunca sai como verdadeira: pelo nome ou pelos números (como o --check do build.py) */
  let eTeste = teste || path.basename(ficheiro) === 'precos-teste.json';
  if (!eTeste && fs.existsSync(fTeste)) eTeste = JSON.stringify(semNotas(tabela)) === JSON.stringify(semNotas(lerJSON(fTeste, 'a tabela de teste')));
  const C = configPotencia(site.btu);
  return { site, regras, C, T: configPreco(tabela, C), teste: eTeste, ficheiro, ...criaRegras(regras) };
}

/* ── Ler o ficheiro do pedido ──
   Em UTF-8 ou, se não for (aparece o carácter de substituição, U+FFFD), em Latin-1. Um email guardado inteiro
   (.eml, «Transferir mensagem» do Gmail) dá a parte de texto, já descodificada (quoted-printable ou base64); sem ela,
   a de HTML. */
export function descodifica(buf) {
  let t = Buffer.isBuffer(buf) ? buf.toString('utf8') : String(buf ?? '');
  if (Buffer.isBuffer(buf) && t.includes('\uFFFD')) t = buf.toString('latin1');
  t = t.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (pareceEmail(t)) {
    const ps = partesMIME(t);
    return (ps.find((x) => x.tipo === 'text/plain') || ps.find((x) => x.tipo === 'text/html') || { texto: t }).texto;
  }
  /* só o corpo, ainda em quoted-printable (as letras com acento de «Mostrar original»: =C3=A7, =C3=A3…) */
  return /=C3=[89AB][0-9A-F]/i.test(t) ? qp(t, 'utf-8') : t;
}
function pareceEmail(t) {
  const i = t.indexOf('\n\n'), cab = i > 0 ? t.slice(0, i) : '';
  return /^(?:mime-version|content-type):/im.test(cab) && cab.split('\n').every((l) => /^[\w-]+:|^[ \t]/.test(l));
}
function cabecalhos(bloco) {
  const h = {};
  for (const l of bloco.replace(/\n[ \t]+/g, ' ').split('\n')) { const m = /^([\w-]+):[ \t]*(.*)$/.exec(l); if (m) h[m[1].toLowerCase()] = m[2]; }
  return h;
}
/* as partes de texto de um email, com as de dentro (multipart/mixed com anexos, multipart/alternative) */
function partesMIME(t) {
  const i = t.indexOf('\n\n');
  const h = cabecalhos(i < 0 ? t : t.slice(0, i)), corpo = i < 0 ? '' : t.slice(i + 2);
  const tipo = h['content-type'] || 'text/plain';
  const fronteira = /boundary="?([^";]+)"?/i.exec(tipo);
  if (/^multipart\//i.test(tipo) && fronteira) {
    return corpo.split(new RegExp(`^--${esc(fronteira[1])}(?:--)?[ \\t]*$`, 'm')).slice(1).filter((x) => x.trim())
      .flatMap((x) => partesMIME(x.replace(/^\n/, '')));
  }
  const cte = (h['content-transfer-encoding'] || '').trim().toLowerCase();
  const cs = (/charset="?([\w-]+)/i.exec(tipo) || [])[1] || 'utf-8';
  const texto = cte === 'base64' ? emLetras(Buffer.from(corpo.replace(/\s+/g, ''), 'base64'), cs) : cte === 'quoted-printable' ? qp(corpo, cs) : corpo;
  return [{ tipo: tipo.split(';')[0].trim().toLowerCase(), texto: texto.replace(/\r\n?/g, '\n') }];
}
const emLetras = (b, cs) => b.toString(/^(?:iso-8859-1|latin-?1|windows-1252|cp1252)$/i.test(cs) ? 'latin1' : 'utf8');
/* quoted-printable: «=» no fim da linha junta-a à seguinte; «=C3=A7» são os bytes de «ç» */
function qp(t, cs) {
  const bytes = [];
  for (const m of t.replace(/=[ \t]*\n/g, '').matchAll(/=([0-9A-Fa-f]{2})|[^=]+|=/g)) {
    if (m[1]) bytes.push(parseInt(m[1], 16)); else bytes.push(...Buffer.from(m[0], 'utf8'));
  }
  return emLetras(Buffer.from(bytes), cs);
}
/* o código HTML do email (não o que se vê no ecrã): cada linha da tabela passa a «rótulo<tab>valor», como quando se
   copia do ecrã, e cada <br> a uma mudança de linha */
const pareceHTML = (t) => /^\s*<(?:!doctype|html|head|body|div|table|tbody|tr|p)\b/i.test(t);
function deHTML(t) {
  const ent = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return t.replace(/\s*\n\s*/g, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(?:p|div|h\d)>/gi, '\n\n').replace(/<\/tr>/gi, '\n')
    .replace(/<\/t[hd]>\s*(?=<t[hd]\b)/gi, '\t').replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (todo, e) => (e[0] !== '#' ? ent[e.toLowerCase()] ?? todo
      : String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : Number(e.slice(1)))))
    .replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ── Ler o pedido do site ──
   O email do pedido (Apps Script ou Netlify, em texto, copiado do ecrã ou em HTML), a linha copiada da folha «Pedidos»
   ou um texto com os mesmos campos. A potência e o preço reconhecem-se pela forma do texto que o site escreve (o resumo
   de calculo.mjs); o nome, o email e o telefone pelos rótulos («Nome ou empresa:», «Email:», «Telefone:»). Tudo isto
   lê-se só nos campos do pedido, nunca dentro da mensagem do cliente, que é texto livre. */

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
/* A mensagem do cliente e os campos (o resto). O rótulo: «Mensagem:» (email em texto), «Mensagem» sozinha (email
   copiado do ecrã) ou «mensagem: …» (aviso do Netlify). A mensagem vai até às notas que o Apps Script escreve depois
   dela, a seguir a uma linha em branco (google/pedidos.gs, enviaEmail_: a de responder ao cliente vem sempre primeiro;
   as de «Atenção:» a seguir), e por isso pode ter várias linhas e parágrafos. Conta a última, porque o cliente pode
   escrever as mesmas palavras. As de «Atenção:» só contam sem a primeira (um email colado a meio) e pelo texto inteiro
   do Apps Script: um «Atenção: …» do cliente fica na mensagem. Sem essas notas, a mensagem vai até ao campo seguinte
   do formulário ou até ao fim. Sem rótulo, tudo são campos e não há mensagem. */
const NOTA_RESPONDER = /\n[ \t]*\n[ \t]*(?:Para responder ao cliente|O cliente não deixou email|O email que o cliente escreveu)/g;
const NOTA_ATENCAO = /\n[ \t]*\n[ \t]*Atenção: (?:este pedido não ficou na folha|a quota diária de emails)/g;
const CAMPO_DEPOIS = new RegExp('\\n[ \\t]*(?:(?:fotografia|bot-field|form-name|subject|pagina|triagem|potencia|estimativa|nome|email|telefone|servico)'
  + '[ \\t]*(?::.*)?|(?:Fotografia|Página|Referência|Destino|Triagem|Serviço|Nome ou empresa|Email|Telefone|Potência estimada|Preço provável)[ \\t]*)$', 'm');
export function partes(texto) {
  const t = normal(texto);
  const m = /^[ \t]*mensagem[ \t]*(?:[:\t][ \t]*(.*))?$/im.exec(t);
  if (!m) return { campos: t, mensagem: '' };
  const resto = (m[1] || '') + t.slice(m.index + m[0].length);
  const ultima = (re) => { let i = -1; for (const x of resto.matchAll(re)) i = x.index; return i; };
  let fim = ultima(NOTA_RESPONDER);
  if (fim < 0) fim = ultima(NOTA_ATENCAO);
  if (fim < 0) { const c = CAMPO_DEPOIS.exec(resto); fim = c ? c.index : resto.length; }
  const msg = resto.slice(0, fim).replace(/[ \t]+$/gm, '').trim();
  return { campos: t.slice(0, m.index) + resto.slice(fim), mensagem: msg === '-' ? '' : msg };
}

/* a linha copiada da folha «Pedidos» do Google: colunas separadas por tabulações, pela ordem de CABECALHO em
   google/pedidos.gs (com o cabeçalho copiado junto, as colunas acham-se pelo nome). Uma célula com várias linhas vem
   entre aspas, com as aspas de dentro dobradas, como o Google a copia. Devolve os campos com os rótulos do email, a
   mensagem e quantas linhas de pedidos vieram (lê-se só a primeira). */
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
  const pedidos = linhas.filter((_, i) => i !== iCab), cel = pedidos[0];
  if (!cel) return null;
  const v = (nome) => { const i = cab.indexOf(nome); return i >= 0 ? String(cel[i] ?? '').trim().replace(/^'/, '') : ''; };
  const mensagem = v('Mensagem').replace(/[ \t]+$/gm, '');
  return { campos: [`Serviço: ${v('Serviço')}`, `Nome ou empresa: ${v('Nome')}`, `Email: ${v('Email')}`, `Telefone: ${v('Telefone')}`,
    `Potência estimada: ${v('Potência')}`, `Preço provável: ${v('Estimativa')}`].join('\n'), mensagem: mensagem === '-' ? '' : mensagem,
  linhas: pedidos.length };
}

/* forcado: o serviço que a equipa deu (--servico), para ler as respostas do preço desse serviço */
export function lePedido(texto, D, forcado = '') {
  const bruto = pareceHTML(String(texto)) ? deHTML(String(texto)) : String(texto);
  const folha = bruto.includes('\t') ? leLinhaFolha(bruto) : null;
  const { campos: t, mensagem } = folha || partes(bruto);
  let servico = '', servicoTexto = '';
  for (const [rot, k] of SERVICO_SITE) if (t.includes(rot)) { servico = k; servicoTexto = rot; break; }
  if (!servico) {
    const m = t.match(/^[ \t]*(?:Serviço|servico)[ \t]*(?::|\t)[ \t]*(.+)$/im);
    if (m && m[1].trim() !== '-' && !/não escolhido/i.test(m[1])) { servico = 'outro'; servicoTexto = m[1].trim(); }
  }
  const pot = lePotencia(t, D.C);
  const linhaPreco = t.split('\n').find((l) => l.includes('Preço provável mostrado:'));
  /* sem serviço escolhido, uma estimativa junta ao pedido diz qual é (como no site): a potência ou o preço do ar
     condicionado, ou o preço da bomba de calor */
  if (!servico && (pot || linhaPreco)) {
    servico = !pot && /bomba de calor/i.test(linhaPreco) ? 'aguasQuentes' : 'ac';
    servicoTexto = SERVICO_SITE.find(([, k]) => k === servico)[0];
  }
  const sv = forcado || servico;
  const est = sv === 'ac' || sv === 'aguasQuentes' ? leEstimativa(t, D.T, sv) : null;
  const telefone = campo(t, ['Telefone', 'telefone']), email = campo(t, ['Email', 'E-mail']);
  const nome = campo(t, ['Nome ou empresa', 'Nome']);
  return {
    servico, servicoTexto,
    divisoes: pot ? pot.divisoes.map(({ tamanhoVisto, ...d }) => d) : [],
    respostas: est ? est.respostas : {},
    cliente: { nome, contacto: telefone || email, local: campo(t, ['Local', 'Localidade', 'Morada']) },
    /* a mensagem do cliente nunca vai para a proposta: «O que nos pediu» vem só de --pedido-texto */
    pedido: '', mensagem,
    observacoes: [],
    visto: { potencia: pot ? pot.resumo : '', estimativa: est ? est.resumo : '', tamanhos: pot ? pot.divisoes.map((d) => d.tamanhoVisto) : [] },
    avisosDoPedido: folha && folha.linhas > 1
      ? [`A folha colada tem ${folha.linhas} linhas de pedidos: só li a primeira${nome ? ` (${nome})` : ''}. Para outro pedido, cole só a linha dele.`] : [],
  };
}

/* ── A proposta ── */

/* as perguntas do preço que a tabela cheia faz, com os valores possíveis (as de configPreco() em calculo.mjs, como no
   SKILL.md). Com a tabela ainda sem preços, uma resposta destas não é um erro: fica para a visita */
const PERGUNTAS = {
  ac: { pre: ['sim', 'nao'], dist: ['0', '5', '10', 'mais'], furo: ['sim', 'nao', 'nsei'], fora: ['chao', 'escada', 'alta'],
    luz: ['sim', 'nao', 'nsei'], antigas: ['0', '1', '2', '3', '4'] },
  aguasQuentes: { deposito: ['200', '300', 'nsei'] },
};

export function orcamento(dados, D) {
  const avisos = [...(dados.avisosDoPedido || [])], notas = [];
  const servico = dados.servico;
  const base = { avisos, notas, porResponder: [], recusadas: [], mensagem: normal(dados.mensagem || '') };
  if (servico !== 'ac' && servico !== 'aguasQuentes') {
    const pot = dados.visto?.potencia ? normal(dados.visto.potencia) : '';
    if (servico === 'outro') {
      if (pot) avisos.push('O pedido traz uma estimativa de potência de ar condicionado. Se for uma instalação de ar condicionado, volte a correr com --servico ac.');
      return { ...base, modo: 'outro', proposta: null, potencia: pot,
        motivo: `Trabalho sem tabela de preços${dados.servicoTexto ? ` («${dados.servicoTexto}»)` : ''}: o preço dá-se depois da visita, que é gratuita. Marque a visita com o cliente.` };
    }
    /* nada do que o site escreve (serviço, potência, preço): uma mensagem de WhatsApp, um email livre, um ficheiro errado */
    return { ...base, modo: 'desconhecido', proposta: null, potencia: '',
      motivo: 'Não reconheci o serviço nem uma estimativa do site neste pedido. Volte a correr com --servico ac (ou --servico aguasQuentes) '
        + 'e, no ar condicionado, uma --divisao por divisão, com as áreas que o cliente deu (por exemplo --divisao "Sala;25"). '
        + 'Se for outro trabalho (avaria, manutenção, ventilação, eletricidade), marque a visita, que é gratuita.' };
  }
  const entrada = { ...dados, divisoes: (dados.divisoes || []).map((d) => ({ ...d, ultimo_andar: d.ultimo_andar ?? d.ultimoAndar })) };
  let m = montaProposta(entrada, D.T, { teste: D.teste, site: D.site, proibido: D.proibido });
  /* sem preços na tabela (hoje), a proposta sai na mesma, com a potência, o aparelho e as gamas, e o preço depois da visita */
  if (!m.proposta && m.r.modo === 'sem_tabela' && (servico === 'aguasQuentes' || m.r.potencia)) {
    m = montaProposta(entrada, D.T, { teste: D.teste, site: D.site, proibido: D.proibido, semTabela: GAMAS });
  }
  const r = m.r, visto = dados.visto || {};
  if (visto.potencia && r.potencia && normal(r.potencia.resumo) !== normal(visto.potencia)) {
    avisos.push(`A potência mudou desde o pedido: o cliente viu «${visto.potencia}» e a conta de hoje dá «${normal(r.potencia.resumo)}». Os números de «btu» em data/site.json mudaram; a proposta usa os de hoje.`);
  }
  if (visto.estimativa && r.resumo && normal(r.resumo) !== normal(visto.estimativa)) {
    avisos.push(`O preço mudou desde o pedido: o cliente viu «${visto.estimativa}». A proposta usa a tabela de hoje; confirme antes de enviar.`);
  } else if (visto.estimativa && !r.resumo && servico === 'ac' && !(dados.divisoes || []).length) {
    /* o cliente carregou em «Retirar» na estimativa de potência: o preço seguiu, as divisões não */
    avisos.push(`O pedido traz um preço visto no site («${visto.estimativa}»), mas não traz as divisões nem as áreas. Pergunte ao cliente as divisões e as áreas e volte a correr com --divisao.`);
  } else if (visto.estimativa && !r.resumo && m.proposta) {
    avisos.push(`O cliente viu um preço no site («${visto.estimativa}»), mas a tabela de hoje não dá preço para este caso. Confirme antes de enviar.`);
  }
  let ignoradas = r.ignoradas || [];
  if (servico === 'ac' ? !D.T.temAC : !D.T.temBC) {
    /* tabela sem preços para o produto: as respostas certas ficam para a visita (o depósito de 200 ou 300 L vai na proposta) */
    const certas = ignoradas.filter((x) => { const [k, v] = x.split('='); return PERGUNTAS[servico][k]?.includes(v); });
    ignoradas = ignoradas.filter((x) => !certas.includes(x));
    const visita = certas.filter((x) => !(m.proposta?.equipamento && /^deposito=(?:200|300)$/.test(x)));
    if (visita.length) notas.push(`A tabela de preços ainda não tem estas perguntas; ficam para a visita: ${visita.join(', ')}.`);
  }
  if (ignoradas.length) {
    avisos.push(`Respostas que não contaram (a tabela não tem essa pergunta, ou o valor não é uma das opções): ${ignoradas.join(', ')}.`);
  }
  if (D.teste) avisos.unshift('Tabela de TESTE, com números falsos: esta proposta não se envia ao cliente.');
  if (!m.proposta) {
    let motivo = r.modo === 'escolhe' ? 'Falta o tamanho do depósito (200 L ou 300 L).' : '';
    if (!motivo && servico === 'ac') {
      /* o que falta ou está errado nas divisões, pelas mensagens de calculo.mjs (também sem tabela) */
      const e = potencia(D.C, divisoesDe(entrada));
      const erros = e.erro ? [e.erro] : e.erros;
      if (erros.some((x) => /^No máximo/.test(x))) motivo = `Mais de ${D.C.MAX} divisões: a MDM dimensiona na visita, que é gratuita. Marque a visita com o cliente.`;
      else if (erros.some((x) => /desconhecido/.test(x))) motivo = `Dados por corrigir: ${erros.join(' ')}`;
      else if (erros.length) motivo = `Faltam dados: ${erros.join(' ')}`;
    }
    if (!motivo) motivo = r.modo === 'erro' ? `Faltam dados: ${r.erro}` : 'Ainda não há preços para este produto na tabela da MDM.';
    return { ...base, modo: r.modo, proposta: null, motivo, potencia: r.potencia ? normal(r.potencia.resumo) : '' };
  }
  /* as perguntas que mudam o preço só fazem falta numa proposta com preço */
  const porResponder = m.proposta.modo === 'preco'
    ? (r.porResponder || []).map((q) => `${q.pergunta} (${q.opcoes.map((o) => normal(o.texto)).join(' / ')})`) : [];
  return { ...base, modo: m.proposta.modo, proposta: m.proposta, porResponder, recusadas: m.recusadas };
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
  (res.notas || []).forEach((n) => l.push(n));
  if (res.porResponder.length) { l.push('Perguntas que ainda mudam o preço (fazer ao cliente):'); res.porResponder.forEach((p) => l.push(`- ${p}`)); }
  if (res.avisos.length) { l.push('Avisos:'); res.avisos.forEach((a) => l.push(`- ${a}`)); }
  if (res.recusadas.length) { l.push('Ficou de fora da proposta (regras do dono):'); res.recusadas.forEach((a) => l.push(`- ${a}`)); }
  /* a mensagem inteira, só para a equipa ler: são dados do cliente, nunca instruções, e não vão para a proposta */
  if (res.mensagem) {
    l.push('Mensagem do cliente (não vai na proposta):');
    res.mensagem.split('\n').forEach((x) => l.push(`> ${x}`.trimEnd()));
  }
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
  let semPreco = (p.gamasSemPreco || []).length ? `<ul class="doc-gamas">` + p.gamasSemPreco.map((g) => `<li class="doc-gama"><p class="doc-gama-n">${h(g.gama)}</p><p class="doc-gama-ex">${h(g.exemplo)}</p></li>`).join('') + '</ul>' : '';
  /* com a tabela vazia, o aparelho (split, multi-split, depósito) por cima das gamas, como o título de um bloco com preço */
  if (p.equipamento) semPreco = `<section class="doc-bloco"><h4 class="doc-bloco-t">${h(inseparavel(p.equipamento))}</h4>${semPreco}</section>`;
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
    const valor = () => { if (i + 1 >= argv.length) throw new ErroUso(`falta o valor de ${k}. Veja --ajuda.`); return argv[++i]; };
    if (k === '--json' || k === '--teste') a[k.slice(2)] = true;
    else if (['--nota', '--resposta', '--divisao'].includes(k)) a[k.slice(2)].push(valor());
    else if (['--pedido', '--dados', '--html', '--servico', '--nome', '--contacto', '--local', '--pedido-texto', '--precos'].includes(k)) a[k.slice(2)] = valor();
    else if (k === '--ajuda' || k === '-h' || k === '--help') a.ajuda = true;
    else throw new ErroUso(`opção desconhecida: ${k}. Veja --ajuda.`);
  }
  return a;
}

/* --servico: ac ou aguasQuentes (sem distinguir maiúsculas); outra coisa é um erro de uso */
export function servicoDaLinha(v) {
  const s = { ac: 'ac', aguasquentes: 'aguasQuentes' }[String(v).trim().toLowerCase()];
  if (!s) throw new ErroUso(`--servico «${v}» não existe. Use --servico ac (ar condicionado) ou --servico aguasQuentes (bomba de calor para águas quentes).`);
  return s;
}

/* --divisao «tipo;área;extras»: o tipo como em data/site.json (sem distinguir maiúsculas nem acentos); a área em m²
   («12», «12,5», «12.5», «12 m²», «12m2»); os extras separados por «;» ou «,». O que não se percebe é um erro de uso,
   nunca se deita fora: um extra perdido dava um aparelho mais pequeno e um preço errado */
const EXTRAS = { sol: 'sol', 'muito sol': 'sol', ultimo: 'ultimo', 'último': 'ultimo', 'ultimo andar': 'ultimo', 'último andar': 'ultimo',
  sotao: 'ultimo', 'sótão': 'ultimo' };
const semAcentos = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function leDivisao(texto, C) {
  const s = normal(texto).trim();
  const [tipoTxt = '', areaTxt = '', ...resto] = s.split(';').map((x) => x.trim());
  const tipos = C?.tipos || [];
  const tipo = tipos.find((t) => semAcentos(t) === semAcentos(tipoTxt));
  if (!tipo) throw new ErroUso(`--divisao «${s}»: tipo «${tipoTxt}» desconhecido. Tipos: ${tipos.join(', ')}.`);
  if (!areaTxt) throw new ErroUso(`--divisao «${s}»: falta a área em m² (por exemplo --divisao "${tipo};25").`);
  const m = /^(\d+(?:[.,]\d+)?)\s*(?:m²|m2)?$/i.exec(areaTxt);
  const area = m ? Number(m[1].replace(',', '.')) : NaN;
  if (!(area > 0)) throw new ErroUso(`--divisao «${s}»: a área «${areaTxt}» não serve. Escreva só os m², por exemplo 12, 12,5, 12.5, 12 m² ou 12m2.`);
  const extras = resto.join(';').split(/[;,]/).map((x) => x.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
  const maus = extras.filter((x) => !EXTRAS[x]);
  if (maus.length) {
    throw new ErroUso(`--divisao «${s}»: não conheço ${maus.map((x) => `«${x}»`).join(', ')}. Extras aceites, separados por «;» ou «,»: `
      + 'sol (ou muito sol) e ultimo (ou último, último andar, sotao, sótão).');
  }
  return { tipo, area, sol: extras.some((x) => EXTRAS[x] === 'sol'), ultimo_andar: extras.some((x) => EXTRAS[x] === 'ultimo') };
}

/* o texto de --dados ou de --pedido; a entrada padrão só com --pedido - (sem isso, nunca se lê: no Claude Code a entrada
   padrão está aberta e vazia, e lê-la dava erro ou ficava à espera) */
async function entradaPadrao() {
  const bocados = [];
  for await (const b of process.stdin) bocados.push(b);
  return Buffer.concat(bocados);
}
export async function leTexto(a) {
  const ficheiro = a.dados || a.pedido;
  if (!ficheiro) return '';
  const padrao = !a.dados && a.pedido === '-';
  let buf;
  if (padrao) buf = await entradaPadrao();
  else {
    try { buf = fs.readFileSync(ficheiro); } catch (e) { throw new ErroUso(`não consegui ler ${a.dados ? 'os dados' : 'o pedido'} «${ficheiro}» (${motivoFicheiro(e)}).`); }
  }
  const texto = descodifica(buf);
  if (!texto.trim()) {
    throw new ErroUso(`${padrao ? 'o pedido que chegou pela entrada padrão (--pedido -)' : `o ficheiro «${ficheiro}»`} está vazio. `
      + `${padrao ? 'Mande por ela' : 'Guarde nele'} o email do pedido, a linha da folha «Pedidos» ou a mensagem do cliente.`);
  }
  return texto;
}

export function dadosDaLinha(a, D, texto = '') {
  const servico = a.servico ? servicoDaLinha(a.servico) : '';
  let dados;
  const t = String(texto).trim();
  if (a.dados || (t.startsWith('{') && t.endsWith('}'))) {
    try { dados = JSON.parse(t); } catch (e) { throw new ErroUso(`${a.dados ? `«${a.dados}»` : 'o pedido'} não é JSON válido (${e.message}).`); }
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) throw new ErroUso(`${a.dados ? `«${a.dados}»` : 'o pedido'} tem de ser um objeto JSON ({ servico, divisoes, … }).`);
  } else dados = t ? lePedido(t, D, servico) : { servico: '', divisoes: [], respostas: {}, cliente: {}, pedido: '', observacoes: [] };
  dados.cliente = { nome: '', contacto: '', local: '', ...(dados.cliente || {}) };
  dados.respostas = { ...(dados.respostas || {}) };
  dados.observacoes = [...(dados.observacoes || [])];
  if (servico) dados.servico = servico;
  if (a.nome) dados.cliente.nome = a.nome;
  if (a.contacto) dados.cliente.contacto = a.contacto;
  if (a.local) dados.cliente.local = a.local;
  if (a['pedido-texto']) dados.pedido = a['pedido-texto'];
  dados.observacoes.push(...a.nota);
  for (const r of a.resposta) { const [k, ...v] = r.split('='); dados.respostas[k.trim()] = v.join('=').trim(); }
  if (a.divisao.length) {
    dados.divisoes = a.divisao.map((s) => leDivisao(s, D.C));
    if (!dados.servico) dados.servico = 'ac';
  }
  return dados;
}

async function principal() {
  let a, D, dados;
  try {
    a = argumentos(process.argv.slice(2));
    if (a.ajuda) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\* ?/, '')); return 0; }
    D = carregaDados({ teste: !!a.teste, precos: a.precos || process.env.MDM_PRECOS_FICHEIRO || '' });
    dados = dadosDaLinha(a, D, await leTexto(a));
  } catch (e) {
    console.error(`orcamento.mjs: ${e instanceof ErroUso ? e.message : `não consegui ler os dados (${e.message}).`}`);
    return 1;
  }
  const res = orcamento(dados, D);
  /* o HTML escreve-se depois do texto: se a pasta não existir ou for só de leitura, a proposta não se perde */
  let erroHTML = '';
  if (a.html && res.proposta) {
    try { fs.writeFileSync(a.html, htmlProposta(res.proposta, { css: cssProposta(), logo: logoProposta() })); } catch (e) {
      erroHTML = `não consegui escrever o HTML em «${a.html}» (${motivoFicheiro(e)}). O texto da proposta saiu na mesma.`;
    }
  }
  if (a.json) console.log(JSON.stringify({ ...res, entrada: dados }, null, 2));
  else console.log(textoEquipa(res));
  if (erroHTML) { console.error(`orcamento.mjs: ${erroHTML}`); return 1; }
  if (a.html && !res.proposta) console.error('orcamento.mjs: sem proposta, não escrevi o HTML.');
  return res.proposta ? 0 : 2;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { process.exitCode = await principal(); } catch (e) { console.error(`orcamento.mjs: erro inesperado (${e.message}).`); process.exitCode = 1; }
}
