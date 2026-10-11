/* Testa o Google Apps Script dos pedidos do site (google/pedidos.gs) sem a Google: carrega o ficheiro com node:vm e dá-lhe
   imitações de ContentService, MailApp, SpreadsheetApp, PropertiesService, LockService, CacheService, Utilities e
   Session. As imitações só têm os métodos que existem no Apps Script: um nome errado no script falha aqui.
   Confirma o encaminhamento (comercial, geral e o geral que cai no comercial), o «responder a» (e o email que segue
   sem ele se a Google o recusar), a armadilha para robôs, as recusas, a fotografia em anexo (reconhecida pelos bytes,
   com o nome e o tipo do formato verdadeiro; o que não é fotografia não segue), a folha «Pedidos» (títulos e linhas,
   tudo guardado como texto), o travão (e o pedido que passa se a cache falhar), o aviso da quota, o HTML do email sem
   injeções, a referência no assunto e os registos sem dados do cliente. Uso, a partir de website/:
     node tests/apps-script.mjs
   Outros testes podem usar as imitações: import { carregaScript, fotoAmostra } from './apps-script.mjs'
   (fotoAmostra dá os bytes de uma fotografia que o script aceita em anexo). */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GS = path.join(W, 'google', 'pedidos.gs');
export const LEIA_ME = path.join(W, 'google', 'LEIA-ME.md');

/* Um objeto que falha quando o script lhe pede um método que a imitação não tem (e que talvez não exista). */
function estrito(nome, obj) {
  return new Proxy(obj, {
    get(o, k) {
      if (typeof k === 'string' && !(k in o)) throw new Error(`imitação: ${nome}.${k} não existe`);
      return o[k];
    }
  });
}

/* Utilities.formatDate só com as letras que o script usa (como o SimpleDateFormat do Java). */
function formatDate(data, fuso, formato) {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) throw new Error('imitação: formatDate sem data');
  if (/[A-Za-z]/.test(formato.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, ''))) throw new Error('imitação: formato não suportado: ' + formato);
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: fuso, year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(data).map((x) => [x.type, x.value]));
  const v = { yyyy: p.year, yy: p.year.slice(-2), MM: p.month, dd: p.day, HH: p.hour, mm: p.minute, ss: p.second };
  return formato.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, (t) => v[t]);
}

/* Bytes como o Apps Script os dá: números de -128 a 127. */
const comSinal = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const semSinal = (arr) => Buffer.from(Array.from(arr, (b) => b & 255));

function novoBlob(dados, tipo, nome) {
  const bytes = typeof dados === 'string' ? Buffer.from(dados, 'utf8') : semSinal(dados);
  let t = tipo || null, n = nome || null;
  return estrito('Blob', {
    getBytes: () => comSinal(bytes), getContentType: () => t, getName: () => n,
    setContentType(x) { t = x; return this; }, setName(x) { n = x; return this; }, _bytes: bytes
  });
}

/* O que a folha guarda quando recebe um texto: appendRow e setValue leem-no como se fosse escrito à mão. Um apóstrofo à
   frente guarda o resto como texto (o apóstrofo não fica na célula); sem ele, = + - @ fazem uma fórmula, só algarismos
   (com espaços ou uma vírgula) fazem um número, e o que parece uma data passa a data. Aqui as fórmulas e as datas ficam
   como { formula } e { data } e os números como números, para os testes verem o que a folha faria. */
export function comoFolha(v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith("'")) return v.slice(1);
  if (/^[=+\-@]/.test(v)) return { formula: v };
  if (/^\d[\d\s]*([.,]\d+)?$/.test(v)) return Number(v.replace(/\s/g, '').replace(',', '.'));
  if (/^\d{1,4}[/.-]\d{1,2}([/.-]\d{1,4})?(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(v)) return { data: v };
  if (/^(true|false|verdadeiro|falso)$/i.test(v)) return /^(true|verdadeiro)$/i.test(v);
  return v;
}

/* Uma folha (separador) com as linhas em memória. */
function novaFolha(nome, ambiente) {
  const dados = [];
  const negrito = [];
  let congeladas = 0;
  const primitivo = (v) => ['string', 'number', 'boolean'].includes(typeof v) || v instanceof Date;
  const folha = {
    getName: () => nome,
    getLastRow: () => dados.length,
    getFrozenRows: () => congeladas,
    setFrozenRows(n) { congeladas = n; return folha; },
    appendRow(valores) {
      if (ambiente.falhas.folha) throw new Error(ambiente.falhas.folha);
      if (!Array.isArray(valores) || !valores.every(primitivo)) throw new Error('imitação: appendRow com valores que não são texto, número ou data');
      if (dados.length && !ambiente.cadeado.fechado) ambiente.semCadeado++;
      dados.push(valores.map(comoFolha));
      return folha;
    },
    getRange(linha, coluna, nLinhas = 1, nColunas = 1) {
      if (linha < 1 || coluna < 1) throw new Error('imitação: getRange fora da folha');
      return estrito('Range', {
        setFontWeight(w) { negrito.push({ linha, coluna, nLinhas, nColunas, w }); return this; },
        setValue(v) {
          for (let r = linha; r < linha + nLinhas; r++) for (let c = coluna; c < coluna + nColunas; c++) {
            while (dados.length < r) dados.push([]);
            dados[r - 1][c - 1] = comoFolha(v);
          }
          return this;
        },
        getValue: () => (dados[linha - 1] || [])[coluna - 1] ?? ''
      });
    },
    _dados: dados, _negrito: negrito
  };
  return estrito('Sheet', folha);
}

function novoLivro(id, ambiente) {
  const folhas = {};
  return estrito('Spreadsheet', {
    getId: () => id,
    getSheetByName: (n) => folhas[n] || null,
    insertSheet(n) {
      if (folhas[n]) throw new Error('imitação: já existe uma folha com o nome ' + n);
      return (folhas[n] = novaFolha(n, ambiente));
    },
    _folhas: folhas
  });
}

const OPCOES_EMAIL = ['to', 'cc', 'bcc', 'subject', 'body', 'htmlBody', 'name', 'replyTo', 'attachments', 'inlineImages', 'noReply'];

/* Os primeiros bytes de cada formato de fotografia (o que o script procura em formatoFoto_). */
const CABECAS = {
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01],
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52],
  gif: [...Buffer.from('GIF89a'), 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00],
  webp: [...Buffer.from('RIFF'), 0x24, 0x00, 0x00, 0x00, ...Buffer.from('WEBPVP8 ')],
  heic: [0x00, 0x00, 0x00, 0x18, ...Buffer.from('ftypheic'), 0x00, 0x00, 0x00, 0x00, ...Buffer.from('mif1heic')],
  heif: [0x00, 0x00, 0x00, 0x18, ...Buffer.from('ftypmif1'), 0x00, 0x00, 0x00, 0x00, ...Buffer.from('mif1miaf')],
  avif: [0x00, 0x00, 0x00, 0x1c, ...Buffer.from('ftypavif'), 0x00, 0x00, 0x00, 0x00, ...Buffer.from('avifmif1miaf')],
  bmp: [...Buffer.from('BM'), 0x36, 0x00, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x00, 0x36, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00],
  tiff: [...Buffer.from('II*'), 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
};

/* Uma «fotografia» com os primeiros bytes do formato e o resto ao acaso, com `tamanho` bytes ao todo (para os testes
   que precisam de uma imagem que o script aceite em anexo: jpeg, png, gif, webp, heic, heif, avif, bmp ou tiff). */
export function fotoAmostra(formato = 'jpeg', tamanho = 5000) {
  const cabeca = Buffer.from(CABECAS[formato] || []);
  if (!cabeca.length) throw new Error('fotoAmostra: formato desconhecido ' + formato);
  return Buffer.concat([cabeca, crypto.randomBytes(Math.max(0, tamanho - cabeca.length))]).subarray(0, Math.max(tamanho, cabeca.length));
}

/* Carrega pedidos.gs com as imitações. Opções:
     props      as propriedades do script (EMAIL_COMERCIAL, EMAIL_GERAL, FOLHA_ID)
     ligado     o script está ligado a uma folha de cálculo (getActiveSpreadsheet); por omissão, sim
     quota      emails que a conta ainda pode enviar hoje (destinatários)
     agora      a hora do relógio (ms); por omissão 10 de outubro de 2026, 14:32:05 em Lisboa
   Devolve doPost, doGet e experimentar do script e, para ver o que aconteceu: enviados (os emails, com os anexos em
   Buffer), linhas (as do separador «Pedidos», com os títulos, como a folha as guardaria: ver comoFolha), registos
   (console), cache, relogio.avanca(ms), falhas ({ email, replyTo, folha, abrir, cadeado, cache, props }: ponha um texto
   ou true para essa parte falhar; replyTo faz o email falhar só quando leva «responder a») e os atalhos
   responde(texto) → { texto, tipo } (o que o site recebe) e envia(pedido) → o JSON da resposta. */
export function carregaScript({ props = { EMAIL_COMERCIAL: 'comercial@exemplo.pt' }, ligado = true, quota = 100,
  agora = Date.UTC(2026, 9, 10, 13, 32, 5) } = {}) {
  const ambiente = { falhas: {}, cadeado: { fechado: false }, semCadeado: 0 };
  const relogio = { t: agora, avanca(ms) { this.t += ms; }, agora() { return this.t; } };
  const enviados = [], registos = [], recebidos = [];
  const propriedades = { ...props };
  const livros = { ativo: ligado ? novoLivro('ativo', ambiente) : null };
  if (propriedades.FOLHA_ID) {
    const id = /\/d\/([A-Za-z0-9_-]+)/.exec(propriedades.FOLHA_ID)?.[1] || propriedades.FOLHA_ID.trim();
    livros[id] = novoLivro(id, ambiente);
  }
  const cache = new Map();
  let restante = quota, uuids = 0;

  const MimeType = { JSON: 'application/json', TEXT: 'text/plain', CSV: 'text/csv', XML: 'text/xml', JAVASCRIPT: 'application/javascript' };
  const ContentService = estrito('ContentService', {
    MimeType,
    createTextOutput(s = '') {
      let tipo = 'text/plain';
      return estrito('TextOutput', {
        getContent: () => s,
        getMimeType: () => tipo,
        setMimeType(t) { if (!Object.values(MimeType).includes(t)) throw new Error('imitação: MimeType inválido'); tipo = t; return this; }
      });
    }
  });

  const MailApp = estrito('MailApp', {
    getRemainingDailyQuota: () => restante,
    sendEmail(msg) {
      if (!msg || typeof msg !== 'object' || arguments.length !== 1) throw new Error('imitação: o script usa sendEmail({ ... })');
      const fora = Object.keys(msg).filter((k) => !OPCOES_EMAIL.includes(k));
      if (fora.length) throw new Error('imitação: sendEmail sem a opção ' + fora.join(', '));
      if (!msg.to || !msg.subject) throw new Error('imitação: sendEmail sem destinatário ou assunto');
      if (ambiente.falhas.email) throw new Error(ambiente.falhas.email);
      if (ambiente.falhas.replyTo && msg.replyTo) throw new Error('Invalid email: ' + msg.replyTo);
      const n = String(msg.to).split(',').length;
      if (restante < n) throw new Error('Service invoked too many times for one day: email.');
      restante -= n;
      enviados.push({ ...msg, anexos: (msg.attachments || []).map((b) => ({ nome: b.getName(), tipo: b.getContentType(), bytes: b._bytes })) });
    }
  });

  const PropertiesService = estrito('PropertiesService', {
    getScriptProperties() {
      if (ambiente.falhas.props) throw new Error('imitação: as propriedades falharam');
      return estrito('Properties', {
        getProperty: (k) => (k in propriedades ? String(propriedades[k]) : null),
        setProperty(k, v) { propriedades[k] = String(v); return this; },
        getProperties: () => ({ ...propriedades })
      });
    }
  });

  const SpreadsheetApp = estrito('SpreadsheetApp', {
    getActiveSpreadsheet() { if (ambiente.falhas.abrir) throw new Error(ambiente.falhas.abrir); return livros.ativo; },
    openById(id) {
      if (ambiente.falhas.abrir) throw new Error(ambiente.falhas.abrir);
      if (!livros[id] || id === 'ativo') throw new Error('Unexpected error while getting the method or property openById on object SpreadsheetApp.');
      return livros[id];
    }
  });

  const cadeado = estrito('Lock', {
    tryLock() { if (ambiente.falhas.cadeado) return false; ambiente.cadeado.fechado = true; return true; },
    waitLock() { if (ambiente.falhas.cadeado) throw new Error('Lock timeout'); ambiente.cadeado.fechado = true; },
    hasLock: () => ambiente.cadeado.fechado,
    releaseLock() { ambiente.cadeado.fechado = false; }
  });
  const LockService = estrito('LockService', { getScriptLock: () => cadeado });

  const cacheScript = estrito('Cache', {
    get(k) { const e = cache.get(k); if (!e || e.expira <= relogio.t) return null; return e.valor; },
    put(k, v, s = 600) {
      if (typeof v !== 'string') throw new Error('imitação: Cache.put só guarda texto');
      if (s > 21600) throw new Error('imitação: a cache guarda no máximo 6 horas');
      cache.set(k, { valor: v, expira: relogio.t + s * 1000 });
    },
    remove(k) { cache.delete(k); }
  });
  const CacheService = estrito('CacheService', {
    getScriptCache() { if (ambiente.falhas.cache) throw new Error('Service error: CacheService'); return cacheScript; }
  });

  const Utilities = estrito('Utilities', {
    base64Decode(s) {
      if (typeof s !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(s) || s.length % 4 === 1) throw new Error('Could not decode string.');
      return comSinal(Buffer.from(s, 'base64'));
    },
    newBlob: novoBlob,
    formatDate,
    /* sempre a mesma sequência, para os testes não dependerem da sorte (duas referências iguais no mesmo minuto) */
    getUuid: () => crypto.createHash('sha256').update('uuid-' + uuids++).digest('hex').slice(0, 32)
      .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
  });
  const Session = estrito('Session', { getScriptTimeZone: () => 'Europe/Lisbon' });

  class Data extends Date {
    constructor(...a) { if (a.length) super(...a); else super(relogio.t); }
    static now() { return relogio.t; }
  }
  const regista = (nivel) => (...a) => registos.push({ nivel, texto: a.map(String).join(' ') });
  const consola = { log: regista('log'), info: regista('info'), warn: regista('warn'), error: regista('error') };

  const contexto = vm.createContext({ ContentService, MailApp, PropertiesService, SpreadsheetApp, LockService, CacheService,
    Utilities, Session, Date: Data, console: consola });
  vm.runInContext(fs.readFileSync(GS, 'utf8'), contexto, { filename: 'pedidos.gs' });

  const pedidos = () => {
    const id = propriedades.FOLHA_ID ? Object.keys(livros).find((k) => k !== 'ativo') : 'ativo';
    const f = livros[id] && livros[id]._folhas.Pedidos;
    return f ? f._dados : [];
  };
  function responde(texto) {
    recebidos.push(texto);
    const r = contexto.doPost({ postData: { contents: texto, type: 'text/plain', length: texto.length, name: 'postData' }, parameter: {}, parameters: {} });
    return { texto: r.getContent(), tipo: r.getMimeType() };
  }
  return {
    doPost: contexto.doPost, doGet: contexto.doGet, experimentar: contexto.experimentar, contexto,
    responde,
    envia: (pedido) => JSON.parse(responde(typeof pedido === 'string' ? pedido : JSON.stringify(pedido)).texto),
    enviados, registos, recebidos, cache, relogio, livros, propriedades,
    falhas: ambiente.falhas,
    get linhas() { return pedidos(); },
    get semCadeado() { return ambiente.semCadeado; },
    get cadeadoFechado() { return ambiente.cadeado.fechado; },
    get quota() { return restante; }
  };
}

/* ═══ Os testes (só quando se corre este ficheiro) ═══ */
function testes() {
  let falhas = 0, oks = 0;
  const ok = (c, msg, extra) => {
    if (c) { oks++; return; }
    falhas++;
    console.log('FALHA ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 600) : ''));
  };

  const CABECALHO = ['Data e hora', 'Ref', 'Destino', 'Triagem', 'Serviço', 'Nome', 'Email', 'Telefone', 'Mensagem',
    'Potência', 'Estimativa', 'Página', 'Fotografia', 'Estado', 'Notas'];
  const REF = /^261010-1432-[0-9A-F]{4}$/;
  const COMERCIAL = 'mdmassist@mdmassist.com';
  const PROPS = { EMAIL_COMERCIAL: COMERCIAL, EMAIL_GERAL: 'geral@exemplo.pt' };
  const TRAVESSAO = new RegExp('[' + String.fromCharCode(0x2014, 0x2015) + ']');
  const AVARIA = 'Ar condicionado: avaria / reparação', MONTAGEM = 'Ar condicionado: montagem / instalação';
  const geral = (campos = {}, extra = {}) => ({
    versao: 1, destino: 'geral', formulario: 'orcamento', fotografia: null,
    campos: { subject: `[P4 · Avaria AC] Pedido de orçamento, ${AVARIA}`, pagina: 'index.html', triagem: '[P4 · Avaria AC]',
      potencia: '', estimativa: '', nome: 'Maria Silva', email: 'maria@exemplo.pt', telefone: '912 345 678',
      servico: AVARIA, mensagem: 'Pinga água na sala.', 'bot-field': '', ...campos },
    ...extra
  });
  const comercial = (campos = {}, extra = {}) => geral({ subject: `[P1 · Montagem AC] Pedido de orçamento, ${MONTAGEM}`,
    triagem: '[P1 · Montagem AC]', servico: MONTAGEM, potencia: 'Sala 25 m²: 12 000 BTU/h · Total 12 000 BTU/h (3,5 kW)',
    estimativa: 'Preço provável mostrado: Gama económica 1 050–1 400 €', ...campos }, { destino: 'comercial', formulario: 'orcamento-comercial', ...extra });
  const recusado = (r, re) => r.ok === false && typeof r.erro === 'string' && (!re || re.test(r.erro));
  const foto = (nome, tipo, bytes) => ({ fotografia: { nome, tipo, base64: Buffer.from(bytes).toString('base64') } });

  // 0. doGet e o formato das respostas
  let s = carregaScript({ props: PROPS });
  const g = s.doGet({ parameter: {} });
  ok(g.getContent() === JSON.stringify({ ok: true, servico: 'pedidos MDM' }) && g.getMimeType() === 'application/json', 'doGet responde { ok, servico } em JSON', g.getContent());

  // 1. geral com EMAIL_GERAL: vai para o geral, com a referência no assunto, «Site MDM» e responder ao cliente
  let r = s.envia(geral());
  let m = s.enviados[0];
  ok(r.ok === true && REF.test(r.ref) && Object.keys(r).join() === 'ok,ref', 'pedido geral: { ok: true, ref } com a data e hora de Lisboa', r);
  ok(s.enviados.length === 1 && m.to === 'geral@exemplo.pt', 'pedido geral vai para EMAIL_GERAL', m && m.to);
  ok(m.subject === `[P4 · Avaria AC] Pedido de orçamento, ${AVARIA} · ${r.ref}`, 'assunto = campo subject + « · ref»', m.subject);
  ok(m.name === 'Site MDM' && m.replyTo === 'maria@exemplo.pt' && !m.attachments, 'remetente «Site MDM», responder ao cliente, sem anexos', m);
  ok(['Referência: ' + r.ref, 'Destino: Geral', 'Triagem: [P4 · Avaria AC]', 'Serviço: ' + AVARIA, 'Nome ou empresa: Maria Silva',
    'Email: maria@exemplo.pt', 'Telefone: 912 345 678', 'Potência estimada: -', 'Preço provável: -', 'Fotografia: -', 'Página: index.html',
    'Mensagem:\nPinga água na sala.', 'Para responder ao cliente, escreva para maria@exemplo.pt.'].every((x) => m.body.includes(x)),
  'corpo em texto com todos os campos em português e, no fim, para quem escrever', m.body);
  ok(/<table/.test(m.htmlBody) && m.htmlBody.includes('<th align="left" valign="top" style="padding-right:16px;color:#555;font-weight:normal">Nome ou empresa</th><td>Maria Silva</td>'),
    'corpo em HTML com a tabela dos campos', m.htmlBody.slice(0, 400));
  ok(m.htmlBody.includes('<td><a href="mailto:maria@exemplo.pt?subject=' + encodeURIComponent('Pedido de orçamento MDM · ' + r.ref) + '">maria@exemplo.pt</a></td>'),
    'no HTML, o email do cliente é uma ligação para lhe escrever, com a referência no assunto', (m.htmlBody.match(/<a [^>]*>[^<]*<\/a>/) || [])[0]);
  ok(!TRAVESSAO.test(m.body + m.htmlBody), 'email sem travessões');

  // 2. comercial: vai para o comercial, com a potência e o preço provável
  r = s.envia(comercial());
  m = s.enviados[1];
  ok(r.ok && m.to === COMERCIAL && m.body.includes('Destino: Comercial (instalação e manutenção)') &&
    m.body.includes('Potência estimada: Sala 25 m²: 12 000 BTU/h') && m.body.includes('Preço provável: Preço provável mostrado: Gama económica 1 050–1 400 €'),
  'pedido comercial vai para EMAIL_COMERCIAL, com a potência e o preço', m && { to: m.to, body: m.body });

  // 3. a folha: criada com os títulos (negrito, congelados) e uma linha por pedido, pela ordem do contrato. A data e hora
  //    fica como data da folha; o resto, como texto (o telefone não passa a número)
  let L = s.linhas;
  const folha = s.livros.ativo._folhas.Pedidos;
  ok(L.length === 3 && JSON.stringify(L[0]) === JSON.stringify(CABECALHO), 'separador «Pedidos» criado com os títulos e duas linhas', L.length && L[0]);
  ok(folha.getFrozenRows() === 1 && folha._negrito.some((n) => n.linha === 1 && n.nColunas === CABECALHO.length && n.w === 'bold'), 'títulos a negrito e congelados');
  ok(JSON.stringify(L[1]) === JSON.stringify([{ data: '2026-10-10 14:32:05' }, s.enviados[0].subject.split(' · ').pop(), 'geral', '[P4 · Avaria AC]', AVARIA,
    'Maria Silva', 'maria@exemplo.pt', '912 345 678', 'Pinga água na sala.', '', '', 'index.html', '', '', '']),
  'linha do pedido geral: data e hora de Lisboa (como data), ref, destino, … (como texto), Estado e Notas vazios', L[1]);
  ok(L[2][1] === r.ref && L[2][2] === 'comercial' && L[2][9].startsWith('Sala 25 m²') && L[2][10].startsWith('Preço provável'), 'linha do pedido comercial', L[2]);
  ok(s.semCadeado === 0 && !s.cadeadoFechado, 'cada linha escrita com o cadeado fechado e o cadeado aberto no fim');
  const refs = new Set(); for (let i = 0; i < 20; i++) refs.add(s.envia(geral()).ref);
  ok(refs.size === 20, 'referências diferentes no mesmo minuto', [...refs]);
  s = carregaScript({ props: PROPS });
  for (const [campos, col, nome] of [
    [{ telefone: '00351912345678' }, 7, 'telefone 00351… (sem perder os zeros)'],
    [{ telefone: '912345678' }, 7, 'telefone só com algarismos'],
    [{ telefone: '+351 912 345 678' }, 7, 'telefone com +'],
    [{ mensagem: '10/10' }, 8, 'mensagem que parece uma data'],
    [{ mensagem: '1,5' }, 8, 'mensagem que parece um número'],
    [{ nome: 'TRUE' }, 5, 'nome que parece verdadeiro/falso'],
    [{ potencia: '=1+1' }, 9, 'texto começado por =']
  ]) {
    r = s.envia(geral(campos));
    const v = s.linhas.at(-1)[col], esperado = Object.values(campos)[0];
    ok(r.ok && v === esperado, 'na folha fica como texto, tal como veio: ' + nome, { v, esperado });
  }

  // 4. separador já existente: não repete os títulos; FOLHA_ID (também o endereço inteiro) usa essa folha e não a ligada
  s = carregaScript({ props: { ...PROPS, FOLHA_ID: 'https://docs.google.com/spreadsheets/d/1AbC_d-9/edit#gid=0' } });
  s.envia(geral()); s.envia(geral());
  ok(s.linhas.length === 3 && s.linhas.filter((l) => l[0] === 'Data e hora').length === 1, 'FOLHA_ID (endereço inteiro): títulos uma vez e duas linhas', s.linhas.length);
  ok(!s.livros.ativo._folhas.Pedidos, 'com FOLHA_ID, a folha ligada fica intacta');

  // 5. EMAIL_GERAL vazio ou só espaços: os gerais vão para o comercial; vários endereços no comercial
  for (const eg of [undefined, '', '   ']) {
    s = carregaScript({ props: { EMAIL_COMERCIAL: COMERCIAL, ...(eg === undefined ? {} : { EMAIL_GERAL: eg }) } });
    r = s.envia(geral());
    ok(r.ok && s.enviados[0].to === COMERCIAL, `EMAIL_GERAL ${JSON.stringify(eg)}: o pedido geral vai para EMAIL_COMERCIAL`, s.enviados[0] && s.enviados[0].to);
  }
  s = carregaScript({ props: { EMAIL_COMERCIAL: ' a@exemplo.pt; b@exemplo.pt , ', EMAIL_GERAL: 'isto não é email' } });
  r = s.envia(geral());
  ok(r.ok && s.enviados[0].to === 'a@exemplo.pt,b@exemplo.pt', 'vários endereços no comercial; EMAIL_GERAL inválido cai no comercial', s.enviados[0] && s.enviados[0].to);

  // 6. sem EMAIL_COMERCIAL: recusa, sem email e sem linha
  for (const p of [{}, { EMAIL_COMERCIAL: '' }, { EMAIL_GERAL: 'geral@exemplo.pt' }]) {
    s = carregaScript({ props: p });
    r = s.envia(geral());
    ok(recusado(r, /EMAIL_COMERCIAL/) && !s.enviados.length && !s.linhas.length, 'sem EMAIL_COMERCIAL: recusa sem email nem linha', { p, r });
  }

  // 7. responder a: só com um email válido; sem ele, o fim do email diz o que fazer e não há ligação
  for (const [email, tel, esperado, nota] of [
    ['maria@', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['', '912 345 678', undefined, 'não deixou email: use o telefone'],
    ['maria@exemplo.pt\nBcc: x@y.pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['a b@exemplo.pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['joão@exemplo.pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['maria@exemplo..pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['.maria@exemplo.pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['maria.@exemplo.pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['maria..silva@exemplo.pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['maria@-exemplo.pt', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['maria@exemplo.p', '912 345 678', undefined, 'não parece válido: use o telefone'],
    ['  Maria.Silva+obra@Exemplo.PT ', '', 'Maria.Silva+obra@Exemplo.PT', 'escreva para Maria.Silva+obra@Exemplo.PT.'],
    ['nao-e-email', '', undefined, 'não parece válido e não há telefone']
  ]) {
    s = carregaScript({ props: PROPS });
    r = s.envia(geral({ email, telefone: tel }));
    m = s.enviados[0];
    ok(r.ok && m && m.replyTo === esperado && m.body.includes(nota) && /<a /.test(m.htmlBody) === !!esperado,
      `responder a com o email ${JSON.stringify(email)}`, m && { replyTo: m.replyTo, r, fim: m.body.slice(-160) });
  }
  // sinais que numa ligação mailto: mudavam o sentido vão codificados
  s = carregaScript({ props: PROPS });
  r = s.envia(geral({ email: 'a?b&c%d@exemplo.pt' }));
  m = s.enviados[0];
  ok(r.ok && m.replyTo === 'a?b&c%d@exemplo.pt' && m.htmlBody.includes('<a href="mailto:a%3Fb%26c%25d@exemplo.pt?subject=') &&
    m.htmlBody.includes('>a?b&amp;c%d@exemplo.pt</a>'), 'ligação mailto: com ? & % codificados', (m.htmlBody.match(/<a [^>]*>[^<]*<\/a>/) || [])[0]);
  r = s.envia(geral({ email: "o'neil@exemplo.pt" }));
  m = s.enviados.at(-1);
  ok(r.ok && m.replyTo === "o'neil@exemplo.pt" && m.htmlBody.includes('<a href="mailto:o&#39;neil@exemplo.pt?subject=') && m.htmlBody.includes('>o&#39;neil@exemplo.pt</a>'),
    'ligação mailto: escapada também para o HTML (apóstrofo)', (m.htmlBody.match(/<a [^>]*>[^<]*<\/a>/) || [])[0]);
  // a Google recusa o «responder a»: o email segue sem ele, com o endereço do cliente no corpo, e o registo não o mostra
  s = carregaScript({ props: PROPS });
  s.falhas.replyTo = true;
  r = s.envia(geral());
  m = s.enviados[0];
  ok(r.ok && s.enviados.length === 1 && !m.replyTo && m.body.includes('escreva para maria@exemplo.pt') && s.linhas.length === 2 && s.linhas[1][14] === '',
    '«responder a» recusado: o email segue sem ele e o pedido fica bem', { r, m: m && { replyTo: m.replyTo } });
  ok(s.registos.some((x) => x.nivel === 'warn' && /responder a/.test(x.texto)) && !s.registos.some((x) => x.texto.includes('maria@exemplo.pt')),
    '«responder a» recusado: fica no registo, sem o email do cliente', s.registos);

  // 8. armadilha para robôs: { ok: true, ref: '' } e nada mais (nem conta para o travão)
  s = carregaScript({ props: PROPS });
  for (let i = 0; i < 40; i++) r = s.envia(geral({ 'bot-field': 'http://spam.example' }));
  ok(JSON.stringify(r) === '{"ok":true,"ref":""}' && !s.enviados.length && !s.linhas.length && s.cache.size === 0,
    'armadilha preenchida: ok sem email, sem linha e sem contar', { r, n: s.enviados.length });
  ok(s.envia(geral()).ok, 'depois de 40 robôs, um pedido verdadeiro passa');

  // 9. recusas: campos que faltam, versão, destino, campos demasiado longos, pedido grande
  const casos = [
    [geral({ nome: '' }), /nome/, 'sem nome'],
    [geral({ nome: '   \n ' }), /nome/, 'nome só com espaços'],
    [geral({ email: '', telefone: '' }), /email ou um telefone/, 'sem email e sem telefone'],
    [geral({ email: '  ', telefone: ' ' }), /email ou um telefone/, 'email e telefone só com espaços'],
    [geral({}, { versao: 2 }), /Versão/, 'versão 2'],
    [geral({}, { versao: '1' }), /Versão/, 'versão em texto'],
    [geral({}, { destino: 'outro' }), /Destino/, 'destino desconhecido'],
    [geral({}, { destino: undefined }), /Destino/, 'sem destino'],
    [geral({}, { campos: undefined }), /campos/, 'sem campos'],
    [geral({}, { campos: [1, 2] }), /campos/, 'campos numa lista'],
    [geral({}, { campos: 'nome=Maria' }), /campos/, 'campos em texto'],
    [geral({ mensagem: 'x'.repeat(20001) }), /mensagem/, 'mensagem com mais de 20 000 caracteres'],
    [geral({ nome: 'x'.repeat(20001) }), /nome/, 'nome com mais de 20 000 caracteres']
  ];
  s = carregaScript({ props: PROPS });
  for (const [p, re, nome] of casos) ok(recusado(s.envia(p), re), 'recusa: ' + nome, s.envia(p));
  ok(recusado(s.envia(geral({ mensagem: 'y'.repeat(12 * 1024 * 1024) })), /grande/), 'recusa: pedido com mais de 12 MB');
  ok(!s.enviados.length && !s.linhas.length && s.cache.size === 0, 'as recusas não enviam, não escrevem e não contam para o travão');
  r = s.envia(geral({ email: '', telefone: 912345678, mensagem: true, potencia: { x: 1 } }));
  ok(r.ok && s.linhas[1][7] === '912345678' && s.linhas[1][8] === 'true' && s.linhas[1][9] === '', 'campos que não são texto: números e sim/não passam a texto, objetos ficam vazios', s.linhas[1]);
  ok(s.envia(geral({ email: '', telefone: '218 935 050' })).ok && s.envia(geral({ telefone: '' })).ok, 'só telefone ou só email: aceite');
  s = carregaScript({ props: PROPS });
  r = s.envia(geral({ subject: undefined, pagina: undefined, triagem: undefined, potencia: undefined, estimativa: undefined, servico: undefined, mensagem: undefined, 'bot-field': undefined }));
  ok(r.ok && s.enviados[0].subject === 'Pedido de orçamento MDM · ' + r.ref && s.enviados[0].body.includes('Serviço: Não escolhido'),
    'só nome e contacto: assunto «Pedido de orçamento MDM · ref» e serviço «Não escolhido»', s.enviados[0] && s.enviados[0].subject);

  // 10. JSON estragado e pedidos vazios: ok: false em JSON, nunca uma exceção
  s = carregaScript({ props: PROPS });
  for (const t of ['{', 'null', '[]', '"texto"', '42', 'true', '{"versao":1,', 'versao=1&nome=Maria', String.fromCharCode(0)]) {
    const x = s.responde(t);
    let j = null; try { j = JSON.parse(x.texto); } catch { /* fica null */ }
    ok(j && recusado(j, /ilegível/) && x.tipo === 'application/json', 'JSON estragado: ' + JSON.stringify(t), x);
  }
  ok(!s.registos.some((x) => x.nivel === 'error'), 'JSON estragado é uma recusa, não um erro inesperado', s.registos.filter((x) => x.nivel === 'error'));
  for (const e of [undefined, null, {}, { postData: {} }, { postData: { contents: '' } }]) {
    let x; try { x = JSON.parse(s.doPost(e).getContent()); } catch (err) { x = String(err); }
    ok(recusado(x, /vazio/), 'doPost sem corpo: ' + JSON.stringify(e), x);
  }
  ok(!s.enviados.length && !s.linhas.length, 'nada enviado nem escrito com pedidos estragados');
  s.falhas.props = true;
  r = s.envia(geral());
  ok(recusado(r, /interno/) && s.registos.some((x) => x.nivel === 'error' && /Erro inesperado/.test(x.texto)), 'um erro inesperado responde ok: false e fica no registo', r);

  // 11. a fotografia: reconhecida pelos primeiros bytes; segue em anexo com os mesmos bytes, o tipo do formato verdadeiro e
  //     um nome com a extensão desse formato; o nome fica na folha e no email
  const jpeg = fotoAmostra('jpeg');
  s = carregaScript({ props: PROPS });
  r = s.envia(geral({}, foto('IMG_0042.jpg', 'image/jpeg', jpeg)));
  m = s.enviados[0];
  ok(r.ok && m.anexos.length === 1 && m.anexos[0].nome === 'IMG_0042.jpg' && m.anexos[0].tipo === 'image/jpeg' && m.anexos[0].bytes.equals(jpeg),
    'fotografia em anexo com os mesmos bytes, o tipo e o nome', m && m.anexos.map((a) => ({ nome: a.nome, tipo: a.tipo, n: a.bytes.length })));
  ok(s.linhas[1][12] === 'IMG_0042.jpg' && m.body.includes('Fotografia: IMG_0042.jpg (em anexo)'), 'o nome da fotografia na folha e no email');
  r = s.envia(geral({}, { fotografia: { nome: 'a.png', tipo: 'image/png', base64: 'data:image/png;base64,' + jpeg.toString('base64').replace(/(.{76})/g, '$1\n') } }));
  m = s.enviados.at(-1);
  ok(r.ok && m.anexos[0].bytes.equals(jpeg) && m.anexos[0].nome === 'a.jpg' && m.anexos[0].tipo === 'image/jpeg',
    'base64 com o prefixo data: e quebras de linha serve; o nome e o tipo seguem os bytes (JPG), não o que o cliente disse (PNG)', m.anexos[0] && { nome: m.anexos[0].nome, tipo: m.anexos[0].tipo });
  for (const [formato, ext, tipo] of [['png', 'png', 'image/png'], ['gif', 'gif', 'image/gif'], ['webp', 'webp', 'image/webp'],
    ['heic', 'heic', 'image/heic'], ['heif', 'heif', 'image/heif'], ['avif', 'avif', 'image/avif'], ['bmp', 'bmp', 'image/bmp'], ['tiff', 'tif', 'image/tiff']]) {
    const b = fotoAmostra(formato, 3000);
    r = s.envia(geral({}, foto('foto.' + formato, tipo, b)));
    m = s.enviados.at(-1);
    ok(r.ok && m.anexos.length === 1 && m.anexos[0].nome === 'foto.' + ext && m.anexos[0].tipo === tipo && m.anexos[0].bytes.equals(b),
      'fotografia ' + formato.toUpperCase() + ' reconhecida e em anexo', m && m.anexos.map((a) => ({ nome: a.nome, tipo: a.tipo })));
  }
  r = s.envia(geral({}, foto('IMG_1234.HEIC', '', fotoAmostra('heic'))));
  m = s.enviados.at(-1);
  ok(r.ok && m.anexos[0].tipo === 'image/heic' && m.anexos[0].nome === 'IMG_1234.heic', 'fotografia HEIC sem tipo (só a extensão no nome): segue como HEIC', m.anexos[0] && { nome: m.anexos[0].nome, tipo: m.anexos[0].tipo });
  r = s.envia(geral({}, foto('IMG_5555.HEIC', '', jpeg)));
  m = s.enviados.at(-1);
  ok(r.ok && m.anexos[0].tipo === 'image/jpeg' && m.anexos[0].nome === 'IMG_5555.jpg', 'um JPG com o nome .HEIC segue como JPG', m.anexos[0] && { nome: m.anexos[0].nome, tipo: m.anexos[0].tipo });
  for (const [nome, tipo, esperado, caso] of [
    ['../../<script>alert(1)</script>.jpg', 'IMAGE/JPEG', null, 'nome com pastas e HTML; tipo em maiúsculas'],
    ['foto' + String.fromCharCode(0x202e) + 'gpj.exe', 'image/jpeg', 'fotogpj.jpg', 'nome com o sinal que inverte o texto'],
    ['documento.pdf.exe', 'image/jpeg', 'documento.pdf.jpg', 'nome .exe'],
    ['fatura.html', 'image/jpeg', 'fatura.jpg', 'nome .html'],
    ['foto.jpg. ', 'image/jpeg', 'foto.jpg', 'nome com pontos e espaços no fim'],
    ['...', 'image/jpeg', 'fotografia.jpg', 'nome só com pontos']
  ]) {
    r = s.envia(geral({}, foto(nome, tipo, jpeg)));
    m = s.enviados.at(-1);
    const n = m && m.anexos[0] && m.anexos[0].nome;
    ok(r.ok && n && (esperado ? n === esperado : !/[/\\<>]/.test(n) && n.endsWith('.jpg')) && m.anexos[0].tipo === 'image/jpeg' &&
      !/<script/i.test(m.htmlBody) && /^[^<>]*$/.test(String(s.linhas.at(-1)[12])),
    'nome do anexo seguro, com a extensão do formato: ' + caso, n);
  }
  r = s.envia(geral({}, { fotografia: { nome: 'vazia.jpg', tipo: 'image/jpeg', base64: '' } }));
  ok(r.ok && !s.enviados.at(-1).attachments && s.linhas.at(-1)[12] === '', 'fotografia vazia: o pedido segue sem anexo');

  // o ficheiro diz-se imagem mas os bytes não são de uma fotografia: o pedido segue, sem anexo, e o email e a folha dizem-no
  const html = Buffer.from('<html><body><script>alert(1)</script><p>Fatura</p></body></html>'.repeat(4));
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10"/></svg>');
  const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), crypto.randomBytes(400)]);
  const exe = Buffer.concat([Buffer.from('MZ'), crypto.randomBytes(400)]);
  const pdf = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj << /Type /Catalog >> endobj\n');
  const mp4 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(4), Buffer.from('isomiso2mp41'), crypto.randomBytes(200)]);
  for (const [nome, tipo, bytes, caso] of [
    ['fatura.html', 'image/png', html, 'HTML com o tipo PNG'],
    ['x.svg', 'image/svg+xml', svg, 'SVG (pode levar código)'],
    ['macro.docm', 'image/jpeg', zip, 'documento do Word com macros, com o tipo JPG'],
    ['IMG.jpg', 'image/x-anything', html, 'HTML com um tipo de imagem inventado'],
    ['documento.pdf.exe', 'image/jpeg', exe, 'programa .exe com o tipo JPG'],
    ['proposta.jpg', 'image/jpeg', pdf, 'PDF com o nome .jpg'],
    ['video.heic', 'image/heic', mp4, 'vídeo MP4 com o tipo HEIC'],
    ['pouco.png', 'image/png', Buffer.from(CABECAS.png.slice(0, 11)), 'PNG cortado nos primeiros bytes']
  ]) {
    s = carregaScript({ props: PROPS });
    r = s.envia(geral({}, foto(nome, tipo, bytes)));
    m = s.enviados[0];
    ok(r.ok && s.enviados.length === 1 && !m.attachments && m.anexos.length === 0 &&
      m.body.includes('Fotografia: ' + nome + ' (não seguiu em anexo: não é uma fotografia') && m.body.includes('peça-a ao cliente') &&
      s.linhas[1][12] === nome + ' (não seguiu: não é uma fotografia)' &&
      s.registos.some((x) => /não é uma fotografia e não segue em anexo/.test(x.texto)),
    'não é uma fotografia (' + caso + '): o pedido segue sem anexo e diz porquê', m && { anexos: m.anexos.length, foto: m.body.match(/Fotografia: .*/), linha: s.linhas[1] && s.linhas[1][12] });
  }

  // o ficheiro nem se diz imagem, ou o base64 está estragado: recusa o pedido inteiro
  s = carregaScript({ props: PROPS });
  for (const [f, re, nome] of [
    [{ nome: 'proposta.pdf', tipo: 'application/pdf', base64: jpeg.toString('base64') }, /imagem/, 'um PDF'],
    [{ nome: 'pagina.html', tipo: 'text/html', base64: jpeg.toString('base64') }, /imagem/, 'um HTML'],
    [{ nome: 'x.exe', tipo: '', base64: jpeg.toString('base64') }, /imagem/, 'sem tipo e sem extensão de imagem'],
    [{ nome: 'x.svg', tipo: '', base64: svg.toString('base64') }, /imagem/, 'SVG sem tipo'],
    [{ nome: 'x.jpg', tipo: 'image/jpeg', base64: '###!!!' }, /ilegível/, 'base64 estragado'],
    [{ nome: 'x.jpg', tipo: 'image/jpeg', base64: 'QUJD=' }, /ilegível/, 'base64 com o tamanho errado'],
    [{ nome: 'x.jpg', tipo: 'image/jpeg' }, /ilegível/, 'sem base64'],
    ['IMG_0042.jpg', /ilegível/, 'fotografia em texto'],
    [{ nome: 'x.jpg', tipo: 'image/jpeg', base64: 42 }, /ilegível/, 'base64 que não é texto']
  ]) ok(recusado(s.envia(geral({}, { fotografia: f })), re), 'recusa a fotografia: ' + nome);
  ok(!s.enviados.length && !s.linhas.length, 'as fotografias recusadas não enviam nem escrevem nada');

  // 12. o tamanho da fotografia: os 8 000 000 do site e 8 MB passam; mais de 8 MB não
  const MB8 = 8 * 1024 * 1024;
  s = carregaScript({ props: PROPS });
  for (const n of [8000000, MB8]) {
    r = s.envia(geral({}, foto('grande.jpg', 'image/jpeg', fotoAmostra('jpeg', n))));
    ok(r.ok && s.enviados.at(-1).anexos.length === 1 && s.enviados.at(-1).anexos[0].bytes.length === n, `fotografia de ${n} bytes passa`, r);
  }
  for (const n of [MB8 + 1, MB8 + 3, 9 * 1024 * 1024]) {
    r = s.envia(geral({}, foto('enorme.jpg', 'image/jpeg', fotoAmostra('jpeg', n))));
    ok(recusado(r, n < 9 * 1024 * 1024 ? /8 MB/ : /grande/), `fotografia de ${n} bytes recusada`, r);
  }
  ok(s.enviados.length === 2 && s.linhas.length === 3, 'as fotografias grandes demais não enviam nem escrevem');

  // 13. o HTML do email: tudo escapado (sem injeções), quebras de linha em <br>; o texto fica como veio
  s = carregaScript({ props: PROPS });
  const mau = { nome: '<img src=x onerror=alert(1)>', mensagem: '<script>alert("x")</script>\nlinha 2 & mais \'aspas\'',
    servico: '"><a href="https://mal.example">clique</a>', pagina: 'javascript:alert(1)', triagem: '<b>P1</b>',
    potencia: '</td></tr></table><iframe src=//mal.example>', estimativa: '<style>*{display:none}</style>',
    subject: 'Assunto\r\nBcc: alvo@exemplo.pt' };
  r = s.envia(geral(mau, foto('<svg onload=alert(1)>.png', 'image/png', jpeg)));
  m = s.enviados[0];
  const tags = (m.htmlBody.match(/<\/?([a-z]+)/gi) || []).map((t) => t.replace(/[</]/g, '').toLowerCase());
  ok(r.ok && tags.every((t) => ['div', 'p', 'table', 'tr', 'th', 'td', 'br', 'strong', 'a'].includes(t)), 'HTML do email só com as etiquetas do modelo', [...new Set(tags)]);
  const ligacoes = m.htmlBody.match(/<a [^>]*>/g) || [];
  ok(ligacoes.length === 1 && ligacoes[0].startsWith('<a href="mailto:maria@exemplo.pt?subject='), 'a única ligação do email é a do cliente (mailto:)', ligacoes);
  ok(m.htmlBody.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;<br>linha 2 &amp; mais &#39;aspas&#39;') &&
    m.htmlBody.includes('&lt;img src=x onerror=alert(1)&gt;') && m.htmlBody.includes('&quot;&gt;&lt;a href=&quot;https://mal.example&quot;&gt;'), 'campos escapados no HTML, com <br> nas quebras de linha', m.htmlBody);
  ok(m.body.includes('Nome ou empresa: <img src=x onerror=alert(1)>') && m.body.includes('<script>alert("x")</script>\nlinha 2'), 'o corpo em texto leva os campos tal como vieram');
  ok(m.subject === 'Assunto Bcc: alvo@exemplo.pt · ' + r.ref && !/[\r\n]/.test(m.subject), 'assunto sem quebras de linha', m.subject);
  ok(m.anexos[0].nome.endsWith('.jpg') && !/[<>]/.test(m.anexos[0].nome), 'o nome do anexo sem < >, com a extensão do formato', m.anexos[0].nome);
  const comFormula = s.envia(geral({ nome: '=HYPERLINK("https://mal.example","clique")', telefone: '+351 912 345 678', mensagem: '@SUM(1)', email: '-x@exemplo.pt' }));
  const lf = s.linhas.at(-1);
  ok(comFormula.ok && lf[5] === '=HYPERLINK("https://mal.example","clique")' && lf[7] === '+351 912 345 678' && lf[8] === '@SUM(1)' && lf[6] === '-x@exemplo.pt',
    'na folha, textos começados por = + - @ ficam como texto, não como fórmula', lf);
  ok(s.enviados.at(-1).body.includes('Telefone: +351 912 345 678'), 'no email o telefone fica sem apóstrofo');

  // 14. a folha falha: o email segue na mesma e avisa; a resposta é ok
  for (const [falha, valor, nome] of [['folha', 'Service Spreadsheets failed', 'appendRow falha'], ['cadeado', true, 'cadeado ocupado'], ['abrir', 'sem acesso', 'abrir a folha falha']]) {
    s = carregaScript({ props: PROPS });
    s.falhas[falha] = valor;
    r = s.envia(geral());
    m = s.enviados[0];
    ok(r.ok && REF.test(r.ref) && m && /Atenção: este pedido não ficou na folha «Pedidos»/.test(m.body) && m.htmlBody.includes('Atenção: este pedido não ficou na folha'),
      'a folha falha (' + nome + '): o email segue com o aviso no fim', { r, body: m && m.body.slice(-200) });
    ok(!s.cadeadoFechado, 'cadeado aberto depois da falha (' + nome + ')');
  }
  s = carregaScript({ props: PROPS, ligado: false });
  r = s.envia(geral());
  ok(r.ok && /não está ligado a nenhuma folha/.test(s.enviados[0].body), 'sem folha ligada e sem FOLHA_ID: o email segue e diz porquê', s.enviados[0] && s.enviados[0].body.slice(-200));

  // 15. o email falha (erro ou quota esgotada): ok: false, a linha fica com o motivo em «Notas», sem endereços de email
  s = carregaScript({ props: PROPS });
  s.falhas.email = 'Invalid email: geral@exemplo.pt';
  r = s.envia(geral());
  ok(recusado(r, /email/) && s.linhas.length === 2 && s.linhas[1][14] === 'O email não seguiu: Invalid email: [email]' && s.linhas[1][13] === '',
    'o email falha: ok: false e a linha guarda o motivo em «Notas», sem o endereço', { r, l: s.linhas[1] });
  ok(s.registos.some((x) => x.nivel === 'error' && /o email não seguiu/.test(x.texto)) && !s.registos.some((x) => /@exemplo\.pt/.test(x.texto)),
    'a falha do email fica no registo, sem endereços de email', s.registos);
  s = carregaScript({ props: { EMAIL_COMERCIAL: 'a@exemplo.pt,b@exemplo.pt' }, quota: 3 });
  ok(s.envia(geral()).ok && s.quota === 1, 'com quota, envia (dois destinatários contam dois)');
  r = s.envia(geral());
  ok(recusado(r) && s.enviados.length === 1 && /quota diária/.test(s.linhas[2][14]), 'quota insuficiente: não envia, recusa e anota a linha', { r, l: s.linhas[2] });

  // 15b. quando a quota do dia está a acabar, cada email avisa no fim (quantos pedidos ainda podem seguir hoje)
  for (const [quota, para, aviso] of [
    [100, COMERCIAL, null],
    [12, COMERCIAL, null],
    [11, COMERCIAL, 'Hoje a conta só pode enviar mais 10 pedidos por email'],
    [5, COMERCIAL, 'Hoje a conta só pode enviar mais 4 pedidos por email'],
    [2, COMERCIAL, 'Hoje a conta só pode enviar mais 1 pedido por email'],
    [1, COMERCIAL, 'a quota diária de emails acabou com este pedido'],
    [5, 'a@exemplo.pt,b@exemplo.pt', 'Hoje a conta só pode enviar mais 1 pedido por email']
  ]) {
    s = carregaScript({ props: { EMAIL_COMERCIAL: para }, quota });
    r = s.envia(geral());
    m = s.enviados[0];
    ok(r.ok && m && (aviso ? m.body.includes(aviso) && m.htmlBody.includes(aviso) : !/quota/.test(m.body)),
      `quota ${quota} para ${para.split(',').length}: ${aviso || 'sem aviso'}`, m && m.body.slice(-300));
  }

  // 16. o travão: 30 pedidos em 10 minutos passam, o 31.º não; na janela seguinte volta a passar
  s = carregaScript({ props: PROPS, agora: Date.UTC(2026, 9, 10, 13, 30, 0) });
  let bons = 0;
  for (let i = 0; i < 30; i++) { if (s.envia(geral()).ok) bons++; s.relogio.avanca(5000); }
  r = s.envia(geral());
  ok(bons === 30 && recusado(r, /Muitos pedidos seguidos/) && s.enviados.length === 30 && s.linhas.length === 31, 'travão: o 31.º pedido em 10 minutos é recusado sem email nem linha', { bons, r });
  s.relogio.avanca(10 * 60 * 1000);
  ok(s.envia(geral()).ok, 'travão: 10 minutos depois volta a passar');
  // a cache falha: o travão deixa passar (é só uma proteção) e avisa no registo
  s = carregaScript({ props: PROPS });
  s.falhas.cache = true;
  bons = 0;
  for (let i = 0; i < 35; i++) if (s.envia(geral()).ok) bons++;
  ok(bons === 35 && s.enviados.length === 35 && s.registos.some((x) => x.nivel === 'warn' && /travão/.test(x.texto)),
    'a cache falha: os pedidos passam e o registo diz que o travão não contou', { bons, registos: s.registos.slice(0, 2) });

  // 16b. o mesmo pedido outra vez (o site manda o mesmo id quando a resposta do primeiro se perdeu e o cliente carrega em
  //      «Tentar novamente»): a mesma referência, um só email e uma só linha. Outro id é outro pedido; um id que não
  //      tem a forma certa não conta; passadas 6 horas (o máximo da cache) volta a ser novo; com a cache a falhar, segue
  s = carregaScript({ props: PROPS });
  const comId = (id) => ({ ...geral(), id });
  const r1 = s.envia(comId('a1b2c3d4-0001')), r2 = s.envia(comId('a1b2c3d4-0001'));
  ok(r1.ok && r2.ok && r1.ref && r1.ref === r2.ref && s.enviados.length === 1 && s.linhas.length === 2,
    'mesmo id: a mesma referência, um só email e uma só linha', { r1, r2, emails: s.enviados.length, linhas: s.linhas.length });
  const r3 = s.envia(comId('a1b2c3d4-0002'));
  ok(r3.ok && r3.ref !== r1.ref && s.enviados.length === 2, 'outro id: outro pedido', r3);
  const r4 = s.envia(comId('mau id!')), r5 = s.envia(comId('mau id!'));
  ok(r4.ok && r5.ok && r4.ref !== r5.ref && s.enviados.length === 4, 'um id sem a forma certa não conta: os dois seguem');
  s.relogio.avanca(6 * 3600 * 1000 + 60000);
  const r6 = s.envia(comId('a1b2c3d4-0001'));
  ok(r6.ok && r6.ref !== r1.ref && s.enviados.length === 5, 'passadas 6 horas, o mesmo id é um pedido novo', r6);
  s = carregaScript({ props: PROPS });
  s.falhas.cache = true;
  const r7 = s.envia(comId('a1b2c3d4-0003')), r8 = s.envia(comId('a1b2c3d4-0003'));
  ok(r7.ok && r8.ok && s.enviados.length === 2, 'a cache falha: o pedido repetido segue (mais vale repetido do que perdido)');

  // 17. experimentar(): um pedido de teste para o comercial, com linha na folha
  s = carregaScript({ props: PROPS });
  s.experimentar();
  m = s.enviados[0];
  ok(m && m.to === COMERCIAL && /^\[Teste\] Pedido de orçamento MDM · 261010-1432-/.test(m.subject) && !m.replyTo && s.linhas.length === 2 &&
    s.registos.some((x) => /"ok":true/.test(x.texto)), 'experimentar(): email de teste ao comercial, linha na folha e a resposta no registo', m && m.subject);

  // 18. resposta crua: o que o site recebe é JSON com o tipo certo
  s = carregaScript({ props: PROPS });
  const cru = s.responde(JSON.stringify(geral()));
  ok(cru.tipo === 'application/json' && /^\{"ok":true,"ref":"261010-1432-[0-9A-F]{4}"\}$/.test(cru.texto), 'resposta crua em JSON', cru);

  // 19. as regras do texto: sem travessões, só as marcas permitidas (nem no script nem no guia), sem dados pessoais nos
  //     registos; o guia com o email do comercial certo e sem endereços no código
  const regras = JSON.parse(fs.readFileSync(path.join(W, 'data/regras-marcas.json'), 'utf8'));
  for (const f of [GS, LEIA_ME]) {
    if (!fs.existsSync(f)) { ok(false, 'falta ' + path.relative(W, f)); continue; }
    const t = fs.readFileSync(f, 'utf8');
    ok(!TRAVESSAO.test(t), path.relative(W, f) + ' sem travessões', (t.match(new RegExp('.{0,30}' + TRAVESSAO.source + '.{0,30}')) || [])[0]);
    const marcas = regras.proibidas.filter((n) => new RegExp('(?<![\\p{L}\\p{N}])' + n.split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\-]*') + '(?![\\p{L}\\p{N}])', 'iu').test(t));
    ok(!marcas.length, path.relative(W, f) + ' sem marcas proibidas', marcas);
    const anos = [...t.matchAll(/\b(19[5-9]\d|20[0-2]\d)\b/g)].map((x) => x[1]).filter((a) => a !== '1991');
    ok(!anos.length, path.relative(W, f) + ': nenhum ano da empresa além de 1991', anos);
    ok(!/@gmail\.com/i.test(t), path.relative(W, f) + ' sem endereços @gmail.com (o comercial é ' + COMERCIAL + ')', (t.match(/\S*@gmail\.com/i) || [])[0]);
    const invisiveis = [...t].map((c) => c.codePointAt(0)).filter((n) => (n < 32 && n !== 10) || (n >= 0x7f && n <= 0x9f) ||
      (n >= 0x200b && n <= 0x200f) || (n >= 0x202a && n <= 0x202e) || (n >= 0x2060 && n <= 0x2064) || n === 0xfeff);
    ok(!invisiveis.length, path.relative(W, f) + ' sem caracteres invisíveis nem de controlo', invisiveis.map((n) => n.toString(16)));
  }
  const guia = fs.readFileSync(LEIA_ME, 'utf8');
  ok(guia.includes('| `EMAIL_COMERCIAL` | `' + COMERCIAL + '`'), 'o guia põe ' + COMERCIAL + ' em EMAIL_COMERCIAL');
  ok(guia.includes('developers.google.com/apps-script/guides/services/quotas'), 'o guia aponta para a página das quotas da Google');
  const codigo = fs.readFileSync(GS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/.test(codigo), 'o script não tem endereços de email no código (vão nas propriedades)',
    codigo.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/));
  s = carregaScript({ props: PROPS });
  const segredo = { nome: 'Nome Secreto', email: 'secreto@exemplo.pt', telefone: '999 888 777', mensagem: 'mensagem secreta' };
  s.envia(geral(segredo));
  s.envia(geral({ ...segredo, nome: '' }));
  s.envia(geral(segredo, foto('segredo-cliente.html', 'image/png', html)));
  s.falhas.replyTo = true;
  s.envia(geral(segredo));
  s.falhas.replyTo = false;
  s.falhas.folha = 'Erro na folha';
  s.envia(geral(segredo));
  s.falhas.folha = false;
  s.falhas.email = 'Invalid email: secreto@exemplo.pt';
  s.envia(geral(segredo));
  ok(s.registos.length > 5 && !s.registos.some((x) => /Secreto|secreto|999 888 777|segredo-cliente/.test(x.texto)), 'os registos do script não levam dados do cliente', s.registos);

  // 20. outro teste pode importar este ficheiro (sem correr estes testes) e pôr o script a responder a um pedido do site
  const uso = `import { carregaScript, fotoAmostra } from ${JSON.stringify(import.meta.url)};
const s = carregaScript({ props: { EMAIL_COMERCIAL: 'c@exemplo.pt' }, agora: Date.now() });
const r = s.responde(JSON.stringify({ versao: 1, destino: 'comercial', formulario: 'orcamento-comercial',
  campos: { nome: 'Ana', telefone: '912 345 678' }, fotografia: { nome: 'f.jpg', tipo: 'image/jpeg', base64: fotoAmostra().toString('base64') } }));
console.log(JSON.stringify({ r, n: s.enviados.length, anexos: s.enviados[0].anexos.length, linhas: s.linhas.length }));`;
  let saida = '';
  try { saida = execFileSync(process.execPath, ['--input-type=module', '-e', uso], { encoding: 'utf8' }).trim(); } catch (err) { saida = String(err); }
  let usado = null; try { usado = JSON.parse(saida); } catch { /* fica null */ }
  ok(usado && usado.r.tipo === 'application/json' && JSON.parse(usado.r.texto).ok === true && usado.n === 1 && usado.anexos === 1 && usado.linhas === 2,
    'importar carregaScript() de outro ficheiro: não corre estes testes e responde a um pedido do site', saida);

  console.log(falhas ? `${oks} ok, ${falhas} falhas` : `${oks} ok, tudo certo`);
  return falhas;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exit(testes() ? 1 : 0);
