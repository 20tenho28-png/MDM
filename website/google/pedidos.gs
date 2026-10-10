/* Pedidos de orçamento do site da MDM (Google Apps Script, sem bibliotecas).

   O formulário do site envia cada pedido para aqui (POST, texto JSON). Este script:
     1. confirma o pedido (nome, um email ou um telefone, fotografia só imagem e até 8 MB);
     2. escreve uma linha no separador «Pedidos» da folha de cálculo (cria-o com os títulos se faltar);
     3. envia o pedido por email ao comercial (instalação e manutenção) ou ao email geral (avarias, «outro», sem
        serviço), com a fotografia em anexo;
     4. responde ao site { ok: true, ref } ou { ok: false, erro }.

   Porquê a folha antes do email: assim o email pode avisar se a linha não ficou escrita. Uma falha na folha nunca
   trava o email. Se for o email a falhar (quota do dia esgotada, endereço errado), a linha fica na folha com o motivo
   em «Notas» e o site recebe ok: false, para o visitante saber que não seguiu e ligar ou tentar de novo.

   A fotografia: o site só envia imagens, mas qualquer pessoa pode enviar um pedido diretamente para o endereço deste
   script. Por isso o anexo só segue se os primeiros bytes do ficheiro forem de uma fotografia (JPG, PNG, HEIC ou HEIF,
   WEBP, AVIF, GIF, BMP ou TIFF; SVG não, porque pode levar código), e o nome do anexo leva a extensão desse formato, não
   a que veio no nome. Um ficheiro que se diz imagem mas não é: o pedido segue sem anexo e o email diz porquê. Um
   ficheiro que nem se diz imagem: o pedido é recusado.

   A quota: a conta só pode enviar um certo número de emails por dia (ver LEIA-ME.md). O travão (JANELA_MAX pedidos em
   cada JANELA_S segundos) trava enxurradas, mas não guarda a quota: quem enviar pedidos falsos de propósito pode
   gastá-la num dia. Os pedidos seguintes continuam a ficar na folha. Quando já restam poucos (QUOTA_AVISO), cada email
   avisa no fim.

   «Responder a»: quando o cliente deixa um email válido, o email do pedido leva-o em «responder a» e mostra-o como
   ligação. Alguns serviços de email (o Gmail, por exemplo) ignoram o «responder a» quando a conta que envia é a mesma
   que recebe; por isso o email diz sempre para quem escrever. Se a Google recusar o «responder a», o email segue sem
   ele.

   Os registos (Execuções) não levam dados do cliente: os endereços de email nas mensagens de erro passam a «[email]».

   Configuração em Definições do projeto, Propriedades do script (ver LEIA-ME.md):
     EMAIL_COMERCIAL  obrigatório. Pode levar vários endereços separados por vírgulas.
     EMAIL_GERAL      opcional. Vazio: os pedidos gerais também vão para EMAIL_COMERCIAL.
     FOLHA_ID         opcional. Vazio: usa a folha de cálculo a que o script está ligado.

   O formato do pedido (o site tem de o seguir à letra):
     { versao: 1, destino: 'comercial' | 'geral', formulario: 'orcamento-comercial' | 'orcamento',
       campos: { subject, pagina, triagem, potencia, estimativa, nome, email, telefone, servico, mensagem, 'bot-field' },
       fotografia: null | { nome, tipo: 'image/jpeg'…, base64 (sem o prefixo data:) } }
   Testes: website/tests/apps-script.mjs (corre este ficheiro em Node, com imitações dos serviços da Google). */

const FOLHA = 'Pedidos';
const CABECALHO = ['Data e hora', 'Ref', 'Destino', 'Triagem', 'Serviço', 'Nome', 'Email', 'Telefone', 'Mensagem',
  'Potência', 'Estimativa', 'Página', 'Fotografia', 'Estado', 'Notas'];
const FUSO = 'Europe/Lisbon';
const CAMPOS = ['subject', 'pagina', 'triagem', 'potencia', 'estimativa', 'nome', 'email', 'telefone', 'servico',
  'mensagem', 'bot-field'];
const FOTO_MAX = 8 * 1024 * 1024;        // bytes da fotografia (o site pára nos 8 000 000; aqui há uma pequena folga)
const PEDIDO_MAX = 12 * 1024 * 1024;     // caracteres do pedido inteiro (em base64 a fotografia ocupa mais um terço)
const CAMPO_MAX = 20000;                 // caracteres de cada campo
const JANELA_S = 600;                    // travão contra enxurradas: no máximo JANELA_MAX pedidos
const JANELA_MAX = 30;                   // em cada 10 minutos (contagem aproximada, para todo o site)
const QUOTA_AVISO = 10;                  // com tão poucos pedidos por enviar no dia, o email avisa no fim
const ASSUNTO = 'Pedido de orçamento MDM';
const REMETENTE = 'Site MDM';
/* As extensões de imagem, para quando o browser não diz o tipo (acontece com fotografias HEIC em alguns telemóveis). */
const EXTENSOES = ['jpg', 'jpeg', 'jpe', 'png', 'gif', 'webp', 'heic', 'heif', 'avif', 'bmp', 'tif', 'tiff'];
/* Os formatos que seguem em anexo, reconhecidos pelos primeiros bytes do ficheiro (ver formatoFoto_). */
const FORMATOS = {
  jpeg: { tipo: 'image/jpeg', ext: 'jpg' }, png: { tipo: 'image/png', ext: 'png' }, gif: { tipo: 'image/gif', ext: 'gif' },
  webp: { tipo: 'image/webp', ext: 'webp' }, heic: { tipo: 'image/heic', ext: 'heic' }, heif: { tipo: 'image/heif', ext: 'heif' },
  avif: { tipo: 'image/avif', ext: 'avif' }, bmp: { tipo: 'image/bmp', ext: 'bmp' }, tiff: { tipo: 'image/tiff', ext: 'tif' }
};
const FOTOS = 'JPG, PNG, HEIC, WEBP, AVIF, GIF, BMP ou TIFF';

/* Abrir o endereço do script no browser responde isto: serve para confirmar que está publicado. */
function doGet() {
  return resposta_({ ok: true, servico: 'pedidos MDM' });
}

function doPost(e) {
  try {
    return resposta_(trataPedido_(e && e.postData ? e.postData.contents : ''));
  } catch (err) {
    console.error('Erro inesperado: ' + semEmails_(String(err && err.stack ? err.stack : err)));
    return resposta_({ ok: false, erro: 'Erro interno. O pedido não foi registado.' });
  }
}

/* Para experimentar no editor: escolha «experimentar» ao lado de Executar. Na primeira vez a Google pede as
   autorizações. Depois envia um pedido de teste para EMAIL_COMERCIAL e escreve uma linha na folha (pode apagá-la). */
function experimentar() {
  const pedido = {
    versao: 1, destino: 'comercial', formulario: 'orcamento-comercial', fotografia: null,
    campos: { subject: '[Teste] ' + ASSUNTO, pagina: 'editor do Apps Script', triagem: '[Teste]', potencia: '',
      estimativa: '', nome: 'Teste do Apps Script', email: '', telefone: '218 935 050', servico: '',
      mensagem: 'Pedido de teste, feito no editor do Apps Script. Pode apagar esta linha.', 'bot-field': '' }
  };
  const r = doPost({ postData: { contents: JSON.stringify(pedido), type: 'text/plain' } });
  console.log(r.getContent());
}

function trataPedido_(texto) {
  if (!texto) return recusa_('Pedido vazio.');
  if (texto.length > PEDIDO_MAX) return recusa_('Pedido demasiado grande.');
  let p;
  try { p = JSON.parse(texto); } catch (err) { return recusa_('Pedido ilegível.'); }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return recusa_('Pedido ilegível.');
  const c = leCampos_(p.campos);
  if (!c) return recusa_('Pedido sem campos.');

  // a armadilha para robôs: responde como se tudo corresse bem e não faz nada
  if (c['bot-field']) return { ok: true, ref: '' };

  if (p.versao !== 1) return recusa_('Versão do pedido desconhecida.');
  if (p.destino !== 'comercial' && p.destino !== 'geral') return recusa_('Destino desconhecido.');
  const longo = CAMPOS.filter(function (k) { return c[k].length > CAMPO_MAX; })[0];
  if (longo) return recusa_('O campo «' + longo + '» é demasiado longo.');
  if (!c.nome) return recusa_('Falta o nome.');
  if (!c.email && !c.telefone) return recusa_('Falta um email ou um telefone.');
  const foto = leFotografia_(p.fotografia);
  if (foto && foto.erro) return recusa_(foto.erro);

  const props = PropertiesService.getScriptProperties();
  const comercial = enderecos_(props.getProperty('EMAIL_COMERCIAL'));
  if (!comercial) return recusa_('Falta configurar EMAIL_COMERCIAL nas propriedades do script.');
  const para = (p.destino === 'geral' && enderecos_(props.getProperty('EMAIL_GERAL'))) || comercial;

  if (!contaPedido_()) return recusa_('Muitos pedidos seguidos. Tente daqui a alguns minutos.');

  const agora = new Date();
  const ref = Utilities.formatDate(agora, FUSO, 'yyMMdd-HHmm') + '-' +
    Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase();
  if (foto && foto.recusada) console.log('Pedido ' + ref + ': o ficheiro junto não é uma fotografia e não segue em anexo');

  // 1. a linha na folha (se falhar, o email segue na mesma e diz porquê)
  let linha = 0, falhaFolha = '';
  try {
    linha = escreveLinha_(Utilities.formatDate(agora, FUSO, 'yyyy-MM-dd HH:mm:ss'), [ref, p.destino, c.triagem,
      c.servico, c.nome, c.email, c.telefone, c.mensagem, c.potencia, c.estimativa, c.pagina,
      !foto ? '' : foto.recusada ? foto.nome + ' (não seguiu: não é uma fotografia)' : foto.nome, '', '']);
  } catch (err) {
    falhaFolha = motivo_(err);
    console.error('Pedido ' + ref + ': a linha não ficou na folha: ' + falhaFolha);
  }

  // 2. o email
  try {
    enviaEmail_(para, ref, p.destino, c, foto, falhaFolha);
  } catch (err) {
    const m = motivo_(err);
    console.error('Pedido ' + ref + ': o email não seguiu: ' + m);
    if (linha) anota_(linha, 'O email não seguiu: ' + m);
    return recusa_('O email do pedido não seguiu.');
  }
  console.log('Pedido ' + ref + ' enviado (' + p.destino + ')' + (falhaFolha ? ', sem linha na folha' : ''));
  return { ok: true, ref: ref };
}

/* Os campos do formulário, sempre como texto e sem espaços nas pontas (os que faltam ficam vazios). */
function leCampos_(campos) {
  if (!campos || typeof campos !== 'object' || Array.isArray(campos)) return null;
  const c = {};
  CAMPOS.forEach(function (k) {
    const v = campos[k];
    c[k] = (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '')
      .replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '').trim();
  });
  return c;
}

/* A fotografia: null (sem fotografia), { erro } (recusa o pedido), { nome, recusada } (o pedido segue sem anexo) ou
   { nome, tipo, bytes } (segue em anexo, com o tipo e a extensão que os bytes mostram). */
function leFotografia_(f) {
  if (f === null || f === undefined) return null;
  if (typeof f !== 'object' || typeof f.base64 !== 'string') return { erro: 'Fotografia ilegível.' };
  const b64 = f.base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!b64) return null;   // ficheiro vazio: o pedido segue sem fotografia
  if (b64.length > Math.ceil(FOTO_MAX / 3) * 4) return { erro: 'A fotografia tem mais de 8 MB.' };
  const nome = nomeFicheiro_(f.nome);
  if (!dizImagem_(f.tipo, nome)) return { erro: 'A fotografia não é uma imagem.' };
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64) || b64.length % 4 === 1) return { erro: 'Fotografia ilegível.' };
  let bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (err) { return { erro: 'Fotografia ilegível.' }; }
  if (bytes.length > FOTO_MAX) return { erro: 'A fotografia tem mais de 8 MB.' };
  if (!bytes.length) return null;
  const formato = formatoFoto_(bytes);
  if (!formato) return { nome: nome, recusada: true };
  // o nome do anexo: o do cliente sem a extensão que trazia, com a do formato que os bytes mostram
  const base = nome.replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/[\s.]+$/, '').slice(0, 90) || 'fotografia';
  return { nome: base + '.' + formato.ext, tipo: formato.tipo, bytes: bytes };
}

/* O ficheiro diz-se imagem: o tipo que o browser deu é image/… ou, sem tipo, o nome acaba numa extensão de imagem. */
function dizImagem_(tipo, nome) {
  const t = String(tipo || '').trim().toLowerCase();
  if (t) return /^image\/[a-z0-9.+-]+$/.test(t);
  const ext = /\.([a-z0-9]+)$/i.exec(nome);
  return !!ext && EXTENSOES.indexOf(ext[1].toLowerCase()) >= 0;
}

/* O formato da fotografia pelos primeiros bytes (as assinaturas de cada formato), ou null se não for nenhum deles.
   Os bytes do Apps Script vão de -128 a 127: «& 255» passa-os a 0 a 255. */
function formatoFoto_(b) {
  const n = b.length;
  if (n < 12) return null;
  const u = function (i) { return i < n ? b[i] & 255 : -1; };
  const t = function (i, k) {
    let s = '';
    for (let j = i; j < i + k && j < n; j++) s += String.fromCharCode(u(j));
    return s;
  };
  if (u(0) === 0xff && u(1) === 0xd8 && u(2) === 0xff) return FORMATOS.jpeg;
  if (t(0, 8) === '\u0089PNG\r\n\u001a\n') return FORMATOS.png;
  if (t(0, 6) === 'GIF87a' || t(0, 6) === 'GIF89a') return FORMATOS.gif;
  if (t(0, 4) === 'RIFF' && t(8, 4) === 'WEBP') return FORMATOS.webp;
  if (t(0, 4) === 'II*\u0000' || t(0, 4) === 'MM\u0000*') return FORMATOS.tiff;
  if (t(0, 2) === 'BM' && [12, 40, 52, 56, 64, 108, 124].indexOf(u(14)) >= 0 && u(15) === 0 && u(16) === 0 && u(17) === 0) {
    return FORMATOS.bmp;
  }
  if (t(4, 4) === 'ftyp') {   // HEIC, HEIF e AVIF: a «marca» principal e as compatíveis, logo no início
    const fim = Math.min(n, ((u(0) << 24) | (u(1) << 16) | (u(2) << 8) | u(3)) >>> 0, 256);
    const marcas = [t(8, 4)];
    for (let i = 16; i + 4 <= fim; i += 4) marcas.push(t(i, 4));
    const tem = function (lista) { return marcas.some(function (m) { return lista.indexOf(m) >= 0; }); };
    if (tem(['avif', 'avis'])) return FORMATOS.avif;
    if (tem(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs'])) return FORMATOS.heic;
    if (tem(['mif1', 'msf1'])) return FORMATOS.heif;
  }
  return null;
}

/* Um nome de ficheiro sem pastas, sem caracteres estranhos e sem os sinais invisíveis que mudam a direção do texto
   (com eles, um nome que acaba em «.exe» podia parecer acabar em «.jpg»). */
function nomeFicheiro_(n) {
  const limpo = String(n || '')
    .replace(/[\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/g, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+/g, '_').replace(/^[\s._]+/, '').replace(/[\s.]+$/, '').trim();
  return limpo.slice(-100) || 'fotografia';
}

/* Os endereços de uma propriedade («a@x.pt, b@y.pt»), só os que parecem válidos, separados por vírgulas. */
function enderecos_(valor) {
  return String(valor || '').split(/[\s,;]+/).filter(emailValido_).join(',');
}

/* Um endereço de email simples: letras sem acentos, algarismos e os sinais permitidos antes do @, sem pontos seguidos
   nem nas pontas; depois do @, partes separadas por pontos (sem hífen nas pontas) e no fim pelo menos duas letras. */
function emailValido_(s) {
  const a = s.lastIndexOf('@');
  return s.length <= 254 && a > 0 && a <= 64 &&
    /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+)*@([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(s);
}

/* A ligação para escrever ao cliente (com a referência no assunto). O endereço já passou em emailValido_; os sinais
   que numa ligação mailto: teriam outro sentido (? # & = % e outros) vão codificados. */
function mailto_(email, assunto) {
  const a = email.lastIndexOf('@');
  const local = email.slice(0, a).replace(/[^A-Za-z0-9\-._~!$'*+]/g, function (x) {
    return '%' + x.charCodeAt(0).toString(16).toUpperCase();
  });
  return 'mailto:' + local + email.slice(a) + '?subject=' + encodeURIComponent(assunto);
}

/* O travão: conta os pedidos de cada janela de 10 minutos na cache do script. Se a cache falhar, deixa passar: o
   travão é só uma proteção e não pode fazer perder um pedido verdadeiro. */
function contaPedido_() {
  try {
    const cache = CacheService.getScriptCache();
    const chave = 'pedidos-' + Math.floor(Date.now() / (JANELA_S * 1000));
    const n = Number(cache.get(chave)) || 0;
    if (n >= JANELA_MAX) return false;
    cache.put(chave, String(n + 1), JANELA_S + 60);
  } catch (err) {
    console.warn('O travão não conseguiu contar este pedido e deixou-o passar: ' + motivo_(err));
  }
  return true;
}

/* Acrescenta a linha com o cadeado do script (dois pedidos ao mesmo tempo não se pisam). Devolve o número da linha.
   A data e hora vai sem apóstrofo, para a folha a guardar como data; o resto vai como texto (celula_). */
function escreveLinha_(quando, valores) {
  const cadeado = LockService.getScriptLock();
  if (!cadeado.tryLock(15000)) throw new Error('a folha estava ocupada');
  try {
    const folha = abreFolha_();
    folha.appendRow([quando].concat(valores.map(celula_)));
    return folha.getLastRow();
  } finally {
    cadeado.releaseLock();
  }
}

function abreFolha_() {
  const id = String(PropertiesService.getScriptProperties().getProperty('FOLHA_ID') || '').trim();
  const doEndereco = /\/d\/([A-Za-z0-9_-]+)/.exec(id);   // aceita também o endereço inteiro da folha
  const livro = id ? SpreadsheetApp.openById(doEndereco ? doEndereco[1] : id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!livro) throw new Error('o script não está ligado a nenhuma folha de cálculo e FOLHA_ID está vazio');
  const folha = livro.getSheetByName(FOLHA) || livro.insertSheet(FOLHA);
  if (folha.getLastRow() === 0) {
    folha.appendRow(CABECALHO);
    folha.getRange(1, 1, 1, CABECALHO.length).setFontWeight('bold');
    folha.setFrozenRows(1);
  }
  return folha;
}

/* Escreve em «Notas» de uma linha já escrita (quando o email não seguiu). Se também falhar, fica só no registo. */
function anota_(linha, texto) {
  try {
    abreFolha_().getRange(linha, CABECALHO.indexOf('Notas') + 1).setValue(celula_(texto));
  } catch (err) {
    console.error('Não consegui escrever a nota na linha ' + linha + ': ' + motivo_(err));
  }
}

/* O apóstrofo à frente faz a folha guardar o texto tal como veio (o apóstrofo não aparece na célula). Sem ele, a folha
   lia «00351912345678» como número e perdia os zeros, «10/10» como data e um texto começado por = + - @ como fórmula. */
function celula_(v) {
  return typeof v === 'string' && v ? "'" + v : v;
}

function enviaEmail_(para, ref, destino, c, foto, falhaFolha) {
  const precisa = para.split(',').length;
  const quota = MailApp.getRemainingDailyQuota();
  if (quota < precisa) throw new Error('a quota diária de emails da conta acabou');
  const depois = Math.floor((quota - precisa) / precisa);   // pedidos que ainda podem seguir hoje, depois deste

  const responder = emailValido_(c.email) ? c.email : '';
  const linhas = [
    ['Referência', ref],
    ['Destino', destino === 'comercial' ? 'Comercial (instalação e manutenção)' : 'Geral'],
    ['Triagem', c.triagem],
    ['Serviço', c.servico || 'Não escolhido'],
    ['Nome ou empresa', c.nome],
    ['Email', c.email, responder ? '<a href="' + esc_(mailto_(responder, ASSUNTO + ' · ' + ref)) + '">' + esc_(responder) + '</a>' : ''],
    ['Telefone', c.telefone],
    ['Potência estimada', c.potencia],
    ['Preço provável', c.estimativa],
    ['Fotografia', !foto ? '' : foto.recusada
      ? foto.nome + ' (não seguiu em anexo: não é uma fotografia em ' + FOTOS + '; se precisar dela, peça-a ao cliente)'
      : foto.nome + ' (em anexo)'],
    ['Página', c.pagina]
  ];
  const notas = [responder
    ? 'Para responder ao cliente, escreva para ' + responder + '. Se usar «Responder», confirme que o destinatário é este endereço.'
    : !c.email ? 'O cliente não deixou email: use o telefone.'
      : c.telefone ? 'O email que o cliente escreveu não parece válido: use o telefone.'
        : 'O email que o cliente escreveu não parece válido e não há telefone: confirme o endereço antes de responder.'];
  if (falhaFolha) notas.push('Atenção: este pedido não ficou na folha «' + FOLHA + '» (' + falhaFolha + '). Guarde este email.');
  if (depois <= QUOTA_AVISO) {
    notas.push(depois
      ? 'Atenção: a quota diária de emails está a acabar. Hoje a conta só pode enviar mais ' + depois +
        (depois === 1 ? ' pedido' : ' pedidos') + ' por email; depois disso, até a Google repor a quota, os pedidos novos ficam só na folha «' + FOLHA + '».'
      : 'Atenção: a quota diária de emails acabou com este pedido. Até a Google a repor, os pedidos novos ficam só na folha «' + FOLHA + '».');
  }

  const texto = ['Pedido feito no site da MDM.', '']
    .concat(linhas.map(function (l) { return l[0] + ': ' + (l[1] || '-'); }))
    .concat(['', 'Mensagem:', c.mensagem || '-', ''], notas).join('\n');

  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.45">' +
    '<p>Pedido feito no site da MDM.</p><table cellpadding="5" style="border-collapse:collapse">' +
    linhas.map(function (l) {
      return '<tr><th align="left" valign="top" style="padding-right:16px;color:#555;font-weight:normal">' + esc_(l[0]) +
        '</th><td>' + (l[2] || esc_(l[1]) || '-') + '</td></tr>';
    }).join('') + '</table>' +
    '<p style="margin-top:16px"><strong>Mensagem</strong><br>' + (esc_(c.mensagem).replace(/\n/g, '<br>') || '-') + '</p>' +
    '<p style="margin-top:24px;color:#666;font-size:12px">' + notas.map(esc_).join('<br>') + '</p></div>';

  const msg = {
    to: para,
    subject: (c.subject || ASSUNTO).replace(/\s+/g, ' ').slice(0, 200) + ' · ' + ref,
    body: texto,
    htmlBody: html,
    name: REMETENTE
  };
  if (responder) msg.replyTo = responder;
  if (foto && !foto.recusada) msg.attachments = [Utilities.newBlob(foto.bytes, foto.tipo, foto.nome)];
  try {
    MailApp.sendEmail(msg);
  } catch (err) {
    if (!msg.replyTo) throw err;
    // um «responder a» que a Google não aceite não pode travar o pedido: segue sem ele (o email do cliente vai no corpo)
    console.warn('Pedido ' + ref + ': o email não seguiu com «responder a»; vai sem ele: ' + motivo_(err));
    delete msg.replyTo;
    MailApp.sendEmail(msg);
  }
}

function esc_(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* O motivo de uma falha, para o registo e para «Notas»: sem endereços de email (podem ser do cliente). */
function motivo_(err) {
  return semEmails_(String(err && err.message ? err.message : err)).slice(0, 300);
}

function semEmails_(s) {
  return s.replace(/[^\s<>()[\]",;:]+@[^\s<>()[\]",;:]+/g, '[email]');
}

function recusa_(erro) {
  console.warn('Pedido recusado: ' + erro);
  return { ok: false, erro: erro };
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
