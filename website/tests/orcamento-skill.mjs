/* Testa a skill «ORÇAMENTO MDM» (.claude/skills/mdm-orcamento): o script dá a mesma proposta que a função da equipa
   (netlify/functions/proposta.mts) com os mesmos dados; lê o pedido tal como chega do site (o email do Apps Script e a
   linha da folha «Pedidos») e volta a dar o tamanho, a gama e o preço que o cliente viu; avisa quando os números mudaram
   depois do pedido; com a tabela vazia faz a proposta sem preço (visita); a linha de comandos, o HTML para PDF, as
   regras do dono e o pacote para o claude.ai (empacota_skill.py), que tem de correr fora do repositório.
   Sem browser e sem rede. Nunca escreve em data/precos.json. Uso, a partir de website/ (precisa de npm install):
     node tests/orcamento-skill.mjs */
import { build } from 'esbuild';
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configPotencia, configPreco, preco, GAMAS } from '../netlify/lib/calculo.mjs';
import { criaRegras } from '../netlify/lib/proposta-modelo.mjs';
import { carregaScript } from './apps-script.mjs';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SK = path.resolve(W, '../.claude/skills/mdm-orcamento');
const SCRIPT = path.join(SK, 'scripts/orcamento.mjs');
const S = await import(pathToFileURL(SCRIPT).href);
const REAL = path.join(W, 'data/precos.json'), TESTE = path.join(W, 'data/precos-teste.json');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const antes = hash(REAL);

let falhas = 0, oks = 0;
const ok = (c, msg, extra) => { if (c) oks++; else { falhas++; console.log('FALHA ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 700) : '')); } };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-orcamento-'));
const limpa = () => fs.rmSync(tmp, { recursive: true, force: true });
for (const [sinal, rc] of [['SIGINT', 130], ['SIGTERM', 143]]) process.on(sinal, () => { limpa(); process.exit(rc); });

const site = JSON.parse(fs.readFileSync(path.join(W, 'data/site.json'), 'utf8'));
const regrasMarcas = JSON.parse(fs.readFileSync(path.join(W, 'data/regras-marcas.json'), 'utf8'));
const { proibido } = criaRegras(regrasMarcas);
const tipos = Object.keys(site.btu.tipos);
const Dt = S.carregaDados({ teste: true });
/* a tabela vazia (como hoje): feita a partir da de teste, com todos os valores a null, para o teste não depender de
   data/precos.json estar vazia */
const vazia = JSON.parse(fs.readFileSync(TESTE, 'utf8'));
for (const [k, v] of Object.entries(vazia)) {
  if (k.startsWith('_') || !v || typeof v !== 'object') continue;
  for (const l of Object.keys(v)) v[l] = k === 'inclui' ? '' : v[l] && typeof v[l] === 'object' && !Array.isArray(v[l]) ? { eco: null, sup: null } : null;
}
const VAZIA = path.join(tmp, 'precos-vazia.json');
fs.writeFileSync(VAZIA, JSON.stringify(vazia));
const Dv = S.carregaDados({ precos: VAZIA });
ok(Dt.teste === true && Dv.teste === false && !Dv.T.temAC && !Dv.T.temBC && Dt.T.temAC && Dt.T.temBC, 'dados: tabela de teste marcada, tabela vazia sem produtos');
ok(S.carregaDados({ precos: TESTE }).teste === true, 'a tabela de teste por --precos também sai marcada TESTE');
const copiaTeste = path.join(tmp, 'outra.json'); fs.copyFileSync(TESTE, copiaTeste);
ok(S.carregaDados({ precos: copiaTeste }).teste === true, 'uma cópia da tabela de teste com outro nome sai marcada TESTE (pelos números)');

/* casos com semente fixa: os mesmos em todas as corridas */
let semente = 20261011;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const um = (xs) => xs[Math.floor(rnd() * xs.length)];
function casoAC(T) {
  const n = um([1, 1, 2, 2, 3, 4, 4, 5]);
  const divisoes = Array.from({ length: n }, () => ({
    tipo: um(tipos), area: um([2, 8, 10, 12, 12.5, 15, 18, 22, 25, 30, 33.3, 38, 45, 60, 90, 150, 200, 201]), sol: rnd() < 0.3, ultimo_andar: rnd() < 0.25 }));
  const respostas = {};
  T.perguntas.filter((q) => q.ac).forEach((q) => { if (rnd() < 0.7) respostas[q.k] = um(q.op)[0]; });
  return { servico: 'ac', divisoes, respostas };
}
const paraCalculo = (d) => ({ tipo: d.tipo, area: d.area, sol: !!d.sol, ultimoAndar: !!d.ultimo_andar });

/* ── 1. A mesma proposta que a função da equipa ── */
const saida = path.join(tmp, 'proposta.mjs');
await build({ entryPoints: [path.join(W, 'netlify/functions/proposta.mts')], bundle: true, platform: 'node', format: 'esm',
  outfile: saida, external: ['@anthropic-ai/sdk'], logLevel: 'error' });
fs.symlinkSync(path.join(W, 'node_modules'), path.join(tmp, 'node_modules'));
const { atende } = await import(pathToFileURL(saida).href);
const env = { get: (k) => ({ MDM_EQUIPA_SENHA: 'segredo', MDM_PRECOS: 'teste' })[k] };
async function daFuncao(dados) {
  const r = await atende(new Request('http://x/api/proposta', { method: 'POST', headers: { 'x-mdm-senha': 'segredo' },
    body: JSON.stringify({ acao: 'calcular', dados }) }), env);
  return r.json();
}
const semRef = (p) => {
  if (!p) return null;
  const { ref, data, texto, ...resto } = p;
  return { ...resto, texto: texto.split(ref).join('REF').split(data).join('DATA') };
};
const casosIguais = [
  { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true, ultimo_andar: true }], respostas: {} },
  { servico: 'ac', divisoes: [{ tipo: 'Quarto', area: 12, sol: false, ultimo_andar: false }], respostas: { pre: 'sim', dist: 'mais', furo: 'nsei', fora: 'alta', luz: 'nsei', antigas: '2' } },
  { servico: 'aguasQuentes', divisoes: [], respostas: { deposito: 'nsei' } },
  { servico: 'aguasQuentes', divisoes: [], respostas: {} },
];
while (casosIguais.length < 60) casosIguais.push(casoAC(Dt.T));
let iguais = 0;
for (const [i, c] of casosIguais.entries()) {
  const dados = { ...c, cliente: { nome: 'Ana ' + i, contacto: '912 000 00' + (i % 10), local: 'Oeiras' }, pedido: 'Montar ar condicionado.',
    observacoes: i % 3 ? ['A máquina de fora fica na varanda.'] : [] };
  const f = await daFuncao(dados);
  const s = S.orcamento(dados, Dt);
  const a = JSON.stringify(semRef(f.proposta) || null), b = JSON.stringify(semRef(s.proposta) || null);
  if (a === b) iguais++;
  else ok(false, `caso ${i}: a skill e a função da equipa dão propostas diferentes`, { funcao: a.slice(0, 300), skill: b.slice(0, 300) });
}
ok(iguais === casosIguais.length, `a skill dá a mesma proposta que a função da equipa (${iguais}/${casosIguais.length})`);

/* ── 2. Do pedido do site à proposta: o email do Apps Script e a linha da folha ── */
const MONTAGEM = 'Ar condicionado: montagem / instalação', BC = 'Bomba de calor: instalação / manutenção';
function pedidoSite(servico, potenciaTxt, estimativaTxt, extra = {}) {
  const sc = carregaScript({ props: { EMAIL_COMERCIAL: 'mdmassist@mdmassist.com' } });
  const r = sc.envia({ versao: 1, destino: 'comercial', formulario: 'orcamento-comercial', fotografia: null,
    campos: { subject: 'Pedido de orçamento', pagina: 'servicos/ar-condicionado.html', triagem: '[P1 · Montagem AC]', potencia: potenciaTxt,
      estimativa: estimativaTxt, nome: 'Rui Teste', email: 'rui@exemplo.pt', telefone: '912 345 678', servico, mensagem: 'Quero montar ar condicionado em casa.',
      'bot-field': '', ...extra } });
  const linha = sc.linhas[sc.linhas.length - 1].map((v) => (v && typeof v === 'object' ? v.data ?? v.formula ?? '' : String(v ?? ''))).join('\t');
  return { ok: r.ok, email: sc.enviados[0]?.body || '', linha };
}
let voltas = 0, n2 = 0;
for (let i = 0; i < 150; i++) {
  const c = casoAC(Dt.T);
  const r = preco(Dt.T, { servico: 'ac', divisoes: c.divisoes.map(paraCalculo), respostas: c.respostas });
  if (r.modo === 'erro' || !r.potencia) continue;
  n2++;
  const p = pedidoSite(MONTAGEM, r.potencia.resumo, r.resumo || '');
  for (const [onde, texto] of [['email', p.email], ['linha da folha', p.linha]]) {
    const lido = S.lePedido(texto, Dt);
    const esperadas = c.divisoes.slice(0, Dt.C.MAX).map((d) => ({ tipo: d.tipo, area: Math.round(d.area * 100) / 100, sol: !!d.sol, ultimo_andar: !!d.ultimo_andar }));
    const divOk = JSON.stringify(lido.divisoes) === JSON.stringify(esperadas);
    /* as respostas que contam são as que o preço usou (as que aparecem no resumo); sem preço não há resumo */
    const respOk = !r.resumo || Object.entries(lido.respostas).every(([k, v]) => c.respostas[k] === v)
      && Object.keys(c.respostas).filter((k) => r.dets.some((d) => d.startsWith(Dt.T.perguntas.find((q) => q.k === k).r + ':'))).every((k) => lido.respostas[k] === c.respostas[k]);
    const res = S.orcamento(lido, Dt);
    const mudou = res.avisos.filter((a) => /mudou|não dá preço/.test(a));
    const precoOk = (res.proposta?.resumo || '') === (r.resumo || '');
    if (lido.servico === 'ac' && divOk && respOk && !mudou.length && precoOk && lido.cliente.nome === 'Rui Teste'
      && lido.cliente.contacto === '912 345 678' && lido.pedido === 'Quero montar ar condicionado em casa.') voltas++;
    else ok(false, `pedido ${i} (${onde}): a skill não leu o que o site mandou`, { divOk, respOk, mudou, precoOk, servico: lido.servico,
      cliente: lido.cliente, pedido: lido.pedido, visto: lido.visto, esperado: r.resumo, deu: res.proposta?.resumo });
  }
}
ok(n2 > 100 && voltas === n2 * 2, `do email e da folha do pedido sai o mesmo tamanho, gama e preço que o cliente viu (${voltas}/${n2 * 2})`);

for (const dep of ['200', '300', 'nsei']) {
  const r = preco(Dt.T, { servico: 'aguasQuentes', respostas: { deposito: dep } });
  const lido = S.lePedido(pedidoSite(BC, '', r.resumo).email, Dt);
  const res = S.orcamento(lido, Dt);
  ok(lido.servico === 'aguasQuentes' && lido.respostas.deposito === dep && res.proposta?.resumo === r.resumo,
    `bomba de calor, depósito ${dep}: lida do email com o mesmo preço`, { lido: lido.respostas, r: r.resumo, deu: res.proposta?.resumo });
}

/* o resumo com espaços inseparáveis (como no formulário) e dentro de HTML lê-se igual */
{
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Escritório', area: 33.3, sol: true, ultimoAndar: true }, { tipo: 'Outra divisão', area: 9 }], respostas: { pre: 'nao', luz: 'sim' } });
  const nb = (t) => t.replace(/ /g, ' ');
  const html = `<tr><th>Serviço</th><td>${MONTAGEM}</td></tr><tr><th>Potência estimada</th><td>${nb(r.potencia.resumo)}</td></tr><tr><th>Preço provável</th><td>${nb(r.resumo)}</td></tr>`;
  const lido = S.lePedido(html, Dt);
  ok(lido.servico === 'ac' && lido.divisoes.length === 2 && lido.divisoes[0].tipo === 'Escritório' && lido.divisoes[0].area === 33.3
    && lido.divisoes[0].sol && lido.divisoes[0].ultimo_andar && lido.respostas.pre === 'nao' && lido.respostas.luz === 'sim'
    && S.orcamento(lido, Dt).proposta.resumo === r.resumo, 'resumo com espaços inseparáveis e em HTML lê-se igual', lido);
}
/* sem serviço escolhido, uma estimativa junta ao pedido é de ar condicionado (como o site faz) */
{
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20 }], respostas: {} });
  const lido = S.lePedido(pedidoSite('', r.potencia.resumo, r.resumo).email, Dt);
  ok(lido.servico === 'ac' && lido.divisoes.length === 1, 'sem serviço e com potência: ar condicionado', lido.servico);
}

/* ── 3. Avisos quando os números mudaram depois do pedido ── */
{
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true }], respostas: { pre: 'sim' } });
  const outraPot = r.potencia.resumo.replace('12 000 BTU/h', '9 000 BTU/h');
  const lido = S.lePedido(pedidoSite(MONTAGEM, outraPot, r.resumo).email, Dt);
  const res = S.orcamento(lido, Dt);
  ok(outraPot !== r.potencia.resumo && res.avisos.some((a) => a.startsWith('A potência mudou')), 'avisa quando a potência que o cliente viu é outra', res.avisos);
  const outroPreco = r.resumo.replace(/\d \d{3}/, '9 999');
  const res2 = S.orcamento(S.lePedido(pedidoSite(MONTAGEM, r.potencia.resumo, outroPreco).email, Dt), Dt);
  ok(res2.avisos.some((a) => a.startsWith('O preço mudou')) && res2.proposta.resumo === r.resumo, 'avisa quando o preço que o cliente viu é outro e usa o de hoje', res2.avisos);
  const res3 = S.orcamento(S.lePedido(pedidoSite(MONTAGEM, r.potencia.resumo, r.resumo).email, Dv), Dv);
  ok(res3.avisos.some((a) => a.includes('não dá preço')) && res3.proposta.modo === 'visita', 'avisa quando o cliente viu um preço que a tabela de hoje já não dá', res3.avisos);
  ok(res.avisos[0].startsWith('Tabela de TESTE') && !S.orcamento(lido, Dv).avisos.some((a) => a.includes('TESTE')), 'a tabela de teste avisa sempre; a outra não');
}

/* ── 4. Tabela vazia (como hoje): proposta sem preço, com a potência e as gamas ── */
{
  const um1 = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true, ultimo_andar: false }], respostas: {}, cliente: {}, pedido: '', observacoes: [] }, Dv);
  const t = um1.proposta?.texto || '';
  ok(um1.modo === 'visita' && um1.proposta.gamasSemPreco.length === GAMAS.length && t.includes('Para este caso o preço dá-se depois da visita, que é gratuita.')
    && t.includes('Gamas: Gama económica (ex.: Midea) ou Gama superior (ex.: Mitsubishi Electric, Daikin).') && t.includes('Potência estimada: Sala 25 m² (muito sol): 12 000 BTU/h')
    && !/\d €/.test(t), 'tabela vazia: proposta com a potência, as gamas e o preço depois da visita, sem nenhum valor em euros', t);
  const cinco = S.orcamento({ servico: 'ac', divisoes: Array.from({ length: 5 }, () => ({ tipo: 'Quarto', area: 12 })), respostas: {}, cliente: {} }, Dv);
  ok(cinco.modo === 'visita' && !cinco.proposta.gamasSemPreco && !cinco.proposta.texto.includes('Gamas:'), 'tabela vazia, 5 divisões: visita sem gamas');
  const grande = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 250 }], respostas: {}, cliente: {} }, Dv);
  ok(grande.modo === 'visita' && !grande.proposta.texto.includes('Gamas:') && grande.proposta.texto.includes('a dimensionar na visita'), 'tabela vazia, 250 m²: visita sem gamas');
  const aq = S.orcamento({ servico: 'aguasQuentes', divisoes: [], respostas: {}, cliente: {} }, Dv);
  ok(aq.modo === 'visita' && aq.proposta.texto.includes('Bomba de calor para águas quentes') && aq.proposta.texto.includes('Gamas:'), 'tabela vazia, águas quentes: visita com gamas');
  const semArea = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 0 }], respostas: {}, cliente: {} }, Dv);
  ok(!semArea.proposta && /Faltam dados: .*área/.test(semArea.motivo), 'sem área: sem proposta e diz o que falta', semArea.motivo);
  const nada = S.orcamento({ servico: 'ac', divisoes: [], respostas: {}, cliente: {} }, Dv);
  ok(!nada.proposta && /Faltam dados/.test(nada.motivo), 'sem divisões: sem proposta e diz o que falta', nada.motivo);
  const outro = S.orcamento(S.lePedido('Serviço: Ar condicionado: avaria / reparação\nNome ou empresa: Ana\nMensagem:\nPinga água.', Dv), Dv);
  ok(outro.modo === 'outro' && !outro.proposta && /visita/.test(outro.motivo) && outro.motivo.includes('avaria'), 'avaria: sem tabela, marca-se a visita', outro);
  const semDep = S.orcamento({ servico: 'aguasQuentes', divisoes: [], respostas: {}, cliente: {} }, Dt);
  ok(!semDep.proposta && /depósito/.test(semDep.motivo), 'águas quentes sem depósito (com tabela): pede o tamanho do depósito', semDep.motivo);
}

/* ── 5. As regras do dono no pedido e nas notas ── */
{
  const marca = regrasMarcas.proibidas[0];
  const res = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Quarto', area: 12 }], respostas: {}, cliente: { nome: 'Ana' },
    pedido: `Trocar a minha ${marca} antiga`, observacoes: ['Resposta em 24 horas.', 'A máquina fica na varanda — do lado norte.'] }, Dt);
  ok(res.proposta.pedido === '' && res.recusadas.some((x) => x.startsWith('pedido: marca')) && res.recusadas.some((x) => /prazo/.test(x))
    && res.proposta.observacoes.length === 1 && res.proposta.observacoes[0] === 'A máquina fica na varanda, do lado norte.',
  'marca proibida e prazo ficam de fora (com o motivo); o travessão vira vírgula', res);
}

/* ── 6. Linha de comandos ── */
function corre(args, entrada) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { input: entrada, encoding: 'utf8', cwd: tmp });
  return { codigo: r.status, out: r.stdout, err: r.stderr };
}
const r1 = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true }, { tipo: 'Quarto', area: 12.5 }], respostas: { pre: 'sim', dist: '5' } });
const emailFich = path.join(tmp, 'pedido.txt');
fs.writeFileSync(emailFich, pedidoSite(MONTAGEM, r1.potencia.resumo, r1.resumo).email);
const htmlFich = path.join(tmp, 'proposta.html');
const c1 = corre(['--pedido', emailFich, '--teste', '--html', htmlFich]);
const [propTxt, equipaTxt = ''] = c1.out.split('==========');
ok(c1.codigo === 0 && propTxt.includes('VALORES DE TESTE') && propTxt.includes('Cliente: Rui Teste') && !propTxt.includes('PARA A EQUIPA')
  && equipaTxt.includes('PARA A EQUIPA') && equipaTxt.includes('Tabela de TESTE'), 'CLI: texto da proposta e, à parte, a nota para a equipa', c1);
const html = fs.existsSync(htmlFich) ? fs.readFileSync(htmlFich, 'utf8') : '';
const gamasTxt = r1.blocos[0].gamas.map((g) => g.texto.charAt(0).toUpperCase() + g.texto.slice(1).replace(/(\d) (?=\d{3}\b)/g, '$1 ').replace(/ €/g, ' €'));
ok(html.startsWith('<!doctype html>') && /<html lang="pt-PT">/.test(html) && html.includes('Valores de teste') && gamasTxt.every((g) => html.includes(g))
  && !/(?:src|href)="(?:https?:)?\/\//.test(html) && !/url\((?!data:)/.test(html) && (html.match(/<h1/g) || []).length === 1,
'CLI --html: a folha com os mesmos preços, sem nada de fora (letras e logótipo dentro)', gamasTxt);
const c2 = corre(['--teste', '--json'], fs.readFileSync(emailFich, 'utf8'));
let j = null; try { j = JSON.parse(c2.out); } catch {}
ok(c2.codigo === 0 && j && j.proposta.resumo === r1.resumo && j.entrada.divisoes.length === 2, 'CLI pela entrada padrão com --json', c2.err || c2.out.slice(0, 300));
const c3 = corre(['--divisao', 'Sala;30;sol;ultimo', '--divisao', 'Quarto;14', '--resposta', 'pre=nao', '--nome', 'Maria', '--contacto', 'maria@exemplo.pt', '--local', 'Almada', '--nota', 'Fachada virada a sul.', '--teste', '--json'], '');
let j3 = null; try { j3 = JSON.parse(c3.out); } catch {}
const r3 = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 30, sol: true, ultimoAndar: true }, { tipo: 'Quarto', area: 14 }], respostas: { pre: 'nao' } });
ok(c3.codigo === 0 && j3 && j3.proposta.resumo === r3.resumo && j3.proposta.cliente.local === 'Almada' && j3.proposta.observacoes[0] === 'Fachada virada a sul.',
  'CLI com --divisao, --resposta e os dados do cliente', c3.err || c3.out.slice(0, 300));
const c3b = corre(['--divisao', 'Quarto;12', '--resposta', 'pre=talvez', '--resposta', 'deposito=200', '--teste'], '');
ok(c3b.codigo === 0 && c3b.out.includes('Respostas que não contaram') && c3b.out.includes('pre=talvez') && c3b.out.includes('deposito=200'),
  'CLI: uma resposta com um valor que não existe, ou de outro produto, não conta e a equipa é avisada', c3b.out.slice(-600));
const c4 = corre([], 'Serviço: Ventilação: instalação / revisão\nNome ou empresa: Loja\n');
ok(c4.codigo === 2 && c4.out.includes('Sem proposta') && c4.out.includes('visita'), 'CLI: trabalho sem tabela sai com o código 2 e diz porquê', c4);
const c5 = corre(['--nada']);
ok(c5.codigo === 1 && /opção desconhecida/.test(c5.err), 'CLI: opção errada sai com o código 1', c5);
const c6 = corre(['--ajuda']);
ok(c6.codigo === 0 && c6.out.includes('--pedido') && c6.out.includes('--html'), 'CLI: --ajuda');
const c7 = corre(['--precos', VAZIA, '--divisao', 'Quarto;12', '--html', path.join(tmp, 'v.html')], '');
ok(c7.codigo === 0 && c7.out.includes('Gamas:') && fs.existsSync(path.join(tmp, 'v.html')) && !c7.out.includes('TESTE'), 'CLI com a tabela vazia: proposta com visita, sem TESTE', c7);

/* ── 7. Regras do dono em tudo o que a skill escreve ou diz ── */
const textos = [['SKILL.md', fs.readFileSync(path.join(SK, 'SKILL.md'), 'utf8')], ['saída da CLI', c1.out + c3.out + c4.out + c7.out], ['HTML', html.replace(/<style>[\s\S]*?<\/style>/, '')]];
const prompt = path.join(W, 'PROMPT-LANCAMENTO.md');
if (fs.existsSync(prompt)) textos.push(['PROMPT-LANCAMENTO.md', fs.readFileSync(prompt, 'utf8')]);
for (const [nome, t] of textos) {
  ok(!/[—―]/.test(t), `${nome}: sem travessões`, (t.match(/.{0,30}[—―].{0,30}/) || [])[0]);
  /* o horário («8h–17h», no rodapé) não é um prazo de resposta: o build.py também o deixa passar */
  const porque = proibido(t.split(site.hours).join(''));
  ok(!porque, `${nome}: cumpre as regras do dono`, porque);
}

/* ── 8. O pacote para o claude.ai: cópias iguais e corre fora do repositório ── */
const zip = path.join(tmp, 'pacote', 'mdm-orcamento.zip');
execFileSync('python3', [path.join(W, 'empacota_skill.py'), zip], { cwd: W, stdio: 'pipe' });
const fora = path.join(tmp, 'fora');
execFileSync('python3', ['-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, fora]);
const P = path.join(fora, 'mdm-orcamento');
const copias = [['SKILL.md', path.join(SK, 'SKILL.md')], ['scripts/orcamento.mjs', SCRIPT], ['scripts/lib/calculo.mjs', path.join(W, 'netlify/lib/calculo.mjs')],
  ['scripts/lib/proposta-modelo.mjs', path.join(W, 'netlify/lib/proposta-modelo.mjs')], ['dados/site.json', path.join(W, 'data/site.json')],
  ['dados/precos.json', REAL], ['dados/precos-teste.json', TESTE], ['dados/regras-marcas.json', path.join(W, 'data/regras-marcas.json')],
  ['dados/proposta.css', path.join(W, 'equipa/proposta.css')], ['dados/logo-mdm.svg', path.join(W, 'assets/img/logo-mdm.svg')]];
ok(copias.every(([a, b]) => fs.existsSync(path.join(P, a)) && hash(path.join(P, a)) === hash(b)), 'pacote: as cópias são iguais às do repositório',
  copias.filter(([a, b]) => !fs.existsSync(path.join(P, a)) || hash(path.join(P, a)) !== hash(b)).map(([a]) => a));
const listaZip = execFileSync('python3', ['-c', 'import sys,zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip], { encoding: 'utf8' }).trim().split('\n');
ok(listaZip.every((n) => n.startsWith('mdm-orcamento/')) && listaZip.includes('mdm-orcamento/SKILL.md') && listaZip.filter((n) => n.endsWith('.woff2')).length >= 4,
  'pacote: uma pasta mdm-orcamento com o SKILL.md e as letras', listaZip);
const pf = spawnSync(process.execPath, [path.join(P, 'scripts/orcamento.mjs'), '--pedido', emailFich, '--teste', '--json', '--html', path.join(tmp, 'fora.html')], { encoding: 'utf8', cwd: os.tmpdir() });
let jf = null; try { jf = JSON.parse(pf.stdout); } catch {}
ok(pf.status === 0 && jf && JSON.stringify(semRef(jf.proposta)) === JSON.stringify(semRef(j.proposta)) && fs.readFileSync(path.join(tmp, 'fora.html'), 'utf8').includes('data:font/woff2'),
  'pacote: fora do repositório dá a mesma proposta e o HTML com as letras', pf.stderr || pf.stdout.slice(0, 300));
const recusa = spawnSync('python3', [path.join(W, 'empacota_skill.py'), path.join(W, 'public', 'x.zip')], { encoding: 'utf8', cwd: W });
ok(recusa.status !== 0 && !fs.existsSync(path.join(W, 'public', 'x.zip')), 'pacote: nunca dentro de public/ (publicado)');

ok(hash(REAL) === antes, 'data/precos.json ficou igual');
limpa();
console.log(`${oks} ok, ${falhas} falhas`);
process.exitCode = falhas ? 1 : 0;
