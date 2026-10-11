/* A proposta modelo, sem página e sem IA: as regras do dono para o texto, as condições e a montagem da proposta a partir
   das contas de calculo.mjs. Partilhada pela função do assistente da equipa (netlify/functions/proposta.mts) e pela skill
   «ORÇAMENTO MDM» (.claude/skills/mdm-orcamento/scripts/orcamento.mjs): as duas dão a mesma proposta, com os mesmos números
   e o mesmo texto. Os dados (data/site.json, data/regras-marcas.json) entram como argumentos, para a skill poder correr
   fora do repositório com uma cópia deles. */
import { randomBytes } from 'node:crypto';
import { preco } from './calculo.mjs';

export const CONDICOES = [
  'Preço com IVA.',
  'O preço final fica fechado depois da visita, que é gratuita.',
  'Proposta modelo, feita a partir do que nos contou. Não é vinculativa.',
];

export const SERVICOS = {
  ac: 'Montagem de ar condicionado',
  aguasQuentes: 'Bomba de calor para águas quentes',
};

/* as marcas que o dono não quer (data/regras-marcas.json, «proibidas», a mesma lista do build.py): sem distinguir
   maiúsculas e só como palavra inteira, por isso um nome de duas palavras não apanha «Mitsubishi Electric» e um nome
   curto não apanha uma palavra maior que comece por ele. Entre as palavras de um nome pode haver espaços, qualquer traço
   (hífen, U+2010 a U+2015, sinal menos, os traços pequenos e largos) ou nada: com hífen ou tudo junto, o nome fica de
   fora na mesma. É a mesma junção do build.py */
const JUNTA_MARCA = '[\\s\\-\\u2010-\\u2015\\u2212\\ufe58\\ufe63\\uff0d]*';
/* prazos de resposta: a mesma regra do build.py (PRAZO): espaços, um traço qualquer ou nada entre o número e a unidade
   («24-horas», «24‑h»), e intervalos com traço, «a» ou «e» («2–4 horas», «2 e 4 horas») */
const TRACOS = '\\-\u2010-\u2015\u2212\u2043\u2e3a\u2e3b\ufe58\ufe63\uff0d';
const JUNTA_UNIDADE = `[\\s${TRACOS}]*`;
export const PRAZO_RE = new RegExp(
  `\\b\\d+${JUNTA_UNIDADE}(?:h|horas)\\s+úteis|\\b(?:24|48)${JUNTA_UNIDADE}(?:h|horas)\\b`
  + `|\\b\\d+(?:${JUNTA_UNIDADE}(?:h|horas))?(?:\\s*(?:a|[${TRACOS}])\\s*|\\s+e\\s+)\\d+${JUNTA_UNIDADE}(?:h|horas)\\b`
  + `|\\bmesmo\\s+dia\\b|\\b\\d+${JUNTA_UNIDADE}minutos\\b`, 'i');

/* o que o dono não quer em nada escrito pela MDM (as mesmas regras do build.py, PROIBIDO). Devolve a lista e
   proibido(...textos): o motivo da primeira regra que um dos textos quebra, ou null */
export function criaRegras(regrasMarcas) {
  const MARCAS_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${regrasMarcas.proibidas
    .map((m) => m.trim().split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(JUNTA_MARCA)).join('|')})(?![\\p{L}\\p{N}])`, 'iu');
  const PROIBIDO = [
    [PRAZO_RE, 'promessa de prazo de resposta'],
    [/\b[34]\d\s+anos\b/, 'idade da empresa (só «desde 1991»)'],
    [MARCAS_RE, `marca fora da lista (só ${regrasMarcas.permitidas.join(', ')})`],
    [/Domingues|M\.D\.M\.\s*[—–]/, 'nome legal: «M.D.M. - Manuel Domingos Melancia, Lda»'],
    [/Arquitec?tos\s+do\s+Ar/i, 'assinatura da France Air («Os Arquitectos do Ar»): o dono não a quer'],
  ];
  /* vê o texto limpo e o original: limpa() troca os travessões por vírgulas, e as regras do nome legal e dos prazos
     («2–4 horas») olham para eles */
  function proibido(...textos) {
    for (const [re, porque] of PROIBIDO) if (textos.some((t) => re.test(String(t ?? '')))) return porque;
    return null;
  }
  return { PROIBIDO, proibido };
}

export function limpa(t, max = 300) {
  return String(t ?? '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/* os marcadores que a função do assistente põe no lugar dos dados pessoais (redige() em proposta.mts) */
export const MARCA_RE = /\[(?:email|NIF|telefone|número|código postal)\]/;
export function semMarcas(t) {
  return t.replace(new RegExp(MARCA_RE.source, 'g'), '').replace(/\s+([,;.:])/g, '$1').replace(/([,;:])(?=[,;:.])/g, '')
    .replace(/\s{2,}/g, ' ').replace(/^[\s,;:.\/-]+|[\s,;:\/-]+$/g, '').trim();
}

export function agoraLisboa() {
  const d = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return {
    /* o sufixo distingue duas propostas feitas no mesmo minuto */
    ref: `MDM-P-${p.year}${p.month}${p.day}-${p.hour}${p.minute}-${randomBytes(2).toString('hex').toUpperCase()}`,
    data: new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: 'numeric', month: 'long', year: 'numeric' }).format(d),
  };
}

/* entrada das ferramentas (o formato do esquema: ultimo_andar) para o formato de calculo.mjs */
export function divisoesDe(input) {
  return (Array.isArray(input?.divisoes) ? input.divisoes : []).map((d) => (
    { tipo: d.tipo, area: d.area, sol: !!d.sol, ultimoAndar: !!d.ultimo_andar }));
}
export function opcoesDe(input) {
  return { servico: input?.servico, divisoes: divisoesDe(input), respostas: input?.respostas || {} };
}

export function textoProposta(p, site) {
  const l = [];
  if (p.teste) l.push('VALORES DE TESTE, NÃO ENVIAR AO CLIENTE', '');
  l.push(`Proposta modelo ${p.ref} · ${p.data}`, `${site.name}`, '');
  const c = p.cliente;
  if (c.nome) l.push(`Cliente: ${c.nome}`);
  if (c.contacto) l.push(`Contacto: ${c.contacto}`);
  if (c.local) l.push(`Local: ${c.local}`);
  if (c.nome || c.contacto || c.local) l.push('');
  l.push(`${p.servico}`);
  if (p.pedido) l.push(`O que nos pediu: ${p.pedido}`);
  if (p.potencia) l.push(`Potência estimada: ${p.potencia}`);
  l.push('');
  if (p.modo === 'visita') l.push('Para este caso o preço dá-se depois da visita, que é gratuita.');
  if (p.gamasSemPreco?.length) l.push(`Gamas: ${p.gamasSemPreco.map((g) => `${g.gama} (${g.exemplo})`).join(' ou ')}.`);
  for (const b of p.blocos) {
    l.push(b.titulo);
    for (const g of b.gamas) {
      l.push(`- ${g.gama} (${g.exemplo}): ${g.texto}`);
      if (g.umaPorDivisao) l.push(`  Com uma máquina para cada divisão: ${g.umaPorDivisao}`);
    }
  }
  if (p.inclui) l.push(`Inclui: ${p.inclui}`);
  if (p.considerado.length > 1) l.push(`Considerámos: ${p.considerado.slice(1).join(', ')}.`);
  if (p.observacoes.length) { l.push('', 'Notas:'); p.observacoes.forEach((o) => l.push(`- ${o}`)); }
  l.push('', ...p.condicoes, '');
  l.push(`${site.name} · desde ${site.founded} · ${site.phone} (${site.hours}) · WhatsApp ${site.whatsapp} · ${site.email}`);
  l.push(`${site.address1}, ${site.address2}`);
  return l.join('\n');
}

/* A proposta para o cliente, com os preços de calculo.mjs. input: o formato da ferramenta preparar_proposta
   ({ servico, divisoes: [{ tipo, area, sol, ultimo_andar }], respostas, cliente: { nome, contacto, local }, pedido,
   observacoes }). Sem proposta possível (erro, sem tabela, falta o depósito) devolve só { r } (o resultado de preco());
   senão { r, proposta (com o texto), recusadas (as notas e o pedido que quebram as regras do dono, com o motivo) }.
   semTabela (só a skill, com GAMAS de calculo.mjs): com a tabela ainda sem preços para o produto, a proposta sai na
   mesma, com a potência e as gamas possíveis, e o preço depois da visita. O assistente da equipa não o usa. */
export function montaProposta(input, T, { teste = false, site, proibido, semTabela = null }) {
  const servico = input?.servico;
  let r = preco(T, opcoesDe(input));
  let gamasSemPreco = [];
  if (semTabela && r.modo === 'sem_tabela' && (servico === 'aguasQuentes' || r.potencia)) {
    /* só se o caso teria preço com a tabela cheia: acima do maior aparelho ou com mais de 4 divisões, é visita sem gamas */
    if (servico === 'aguasQuentes' || (!r.potencia.acima && r.potencia.n <= 4)) gamasSemPreco = semTabela.map((g) => ({ gama: g.nome, exemplo: g.ex }));
    r = { ...r, modo: 'visita' };
  }
  if (r.modo === 'erro' || r.modo === 'sem_tabela' || r.modo === 'escolhe') return { r };
  const recusadas = [];
  /* uma nota com um dado escondido pelo corte ([telefone], [NIF]…) não vai para o cliente: o modelo só viu o marcador */
  const observacoes = (Array.isArray(input?.observacoes) ? input.observacoes : []).slice(0, 6)
    .map((bruto) => [limpa(bruto, 240), bruto]).filter(([o, bruto]) => {
      const porque = o && (proibido(o, bruto) || (MARCA_RE.test(o) ? 'tem um dado pessoal escondido (não vai para a proposta)' : null));
      if (porque) recusadas.push(`«${o}»: ${porque}`);
      return o && !porque;
    }).map(([o]) => o);
  const pedido = semMarcas(limpa(input?.pedido, 400));
  const porque = proibido(pedido, input?.pedido);
  if (porque) recusadas.push(`pedido: ${porque}`);
  const contacto = semMarcas(limpa(input?.cliente?.contacto, 120));
  const { ref, data } = agoraLisboa();
  const proposta = {
    ref, data, teste, modo: r.modo,
    servico: SERVICOS[servico] || servico,
    cliente: { nome: semMarcas(limpa(input?.cliente?.nome, 120)), contacto: /[\d@]/.test(contacto) ? contacto : '',
      local: semMarcas(limpa(input?.cliente?.local, 160)) },
    pedido: porque ? '' : pedido,
    potencia: r.potencia ? r.potencia.resumo : '',
    divisoes: r.potencia ? r.potencia.divs : [],
    blocos: r.modo === 'preco' ? r.blocos : [],
    inclui: r.modo === 'preco' ? r.inclui : '',
    considerado: r.modo === 'preco' ? r.dets : [],
    resumo: r.modo === 'preco' ? r.resumo : '',
    ...(gamasSemPreco.length ? { gamasSemPreco } : {}),
    observacoes,
    condicoes: CONDICOES,
    empresa: {
      nome: site.name, nomeLegal: site.legalName, nif: site.nif, desde: site.founded, telefone: site.phone, horario: site.hours,
      whatsapp: site.whatsapp, email: site.email, morada: [site.address1, site.address2],
    },
  };
  return { r, recusadas, proposta: { ...proposta, texto: textoProposta(proposta, site) } };
}
