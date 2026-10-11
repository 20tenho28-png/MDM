/* Testa a skill «ORÇAMENTO MDM» (.claude/skills/mdm-orcamento): o script dá a mesma proposta que a função da equipa
   (netlify/functions/proposta.mts) com os mesmos dados; lê o pedido tal como chega do site (o email do Apps Script e a
   linha da folha «Pedidos») e volta a dar o tamanho, a gama e o preço que o cliente viu; avisa quando os números mudaram
   depois do pedido; com a tabela vazia faz a proposta sem preço (visita); a linha de comandos, o HTML para PDF, as
   regras do dono e o pacote para o claude.ai (empacota_skill.py), que tem de correr fora do repositório. No fim (9), as
   correções da revisão: a entrada padrão só com --pedido -, pedidos que não se reconhecem, .eml e Latin-1, --divisao,
   a mensagem inteira do cliente (só para a equipa), os campos lidos só fora da mensagem, as regras das notas, a tabela
   vazia (aparelho, depósito, respostas para a visita), erros sem rasto do Node, travessões e o .gitignore.
   Sem browser e sem rede. Nunca escreve em data/precos.json. Uso, a partir de website/ (precisa de npm install):
     node tests/orcamento-skill.mjs */
import { build } from 'esbuild';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configPotencia, configPreco, preco, GAMAS } from '../netlify/lib/calculo.mjs';
import { criaRegras, limpa as limpaTexto } from '../netlify/lib/proposta-modelo.mjs';
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
const { proibido, proibidoTexto } = criaRegras(regrasMarcas);
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
  /* a linha como o Google a copia: uma célula com mudanças de linha, tabulações ou aspas vai entre aspas */
  const tsv = (l) => l.map((v) => (v && typeof v === 'object' ? v.data ?? v.formula ?? '' : String(v ?? '')))
    .map((v) => (/[\n\t"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join('\t');
  return { ok: r.ok, email: sc.enviados[0]?.body || '', html: sc.enviados[0]?.htmlBody || '', linha: tsv(sc.linhas[sc.linhas.length - 1]),
    cabecalho: tsv(sc.linhas[0]) };
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
      && lido.cliente.contacto === '912 345 678' && lido.pedido === '' && lido.mensagem === 'Quero montar ar condicionado em casa.') voltas++;
    else ok(false, `pedido ${i} (${onde}): a skill não leu o que o site mandou`, { divOk, respOk, mudou, precoOk, servico: lido.servico,
      cliente: lido.cliente, pedido: lido.pedido, mensagem: lido.mensagem, visto: lido.visto, esperado: r.resumo, deu: res.proposta?.resumo });
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
const c2 = corre(['--pedido', '-', '--teste', '--json'], fs.readFileSync(emailFich, 'utf8'));
let j = null; try { j = JSON.parse(c2.out); } catch {}
ok(c2.codigo === 0 && j && j.proposta.resumo === r1.resumo && j.entrada.divisoes.length === 2, 'CLI pela entrada padrão (--pedido -) com --json', c2.err || c2.out.slice(0, 300));
const c3 = corre(['--divisao', 'Sala;30;sol;ultimo', '--divisao', 'Quarto;14', '--resposta', 'pre=nao', '--nome', 'Maria', '--contacto', 'maria@exemplo.pt', '--local', 'Almada', '--nota', 'Fachada virada a sul.', '--teste', '--json'], '');
let j3 = null; try { j3 = JSON.parse(c3.out); } catch {}
const r3 = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 30, sol: true, ultimoAndar: true }, { tipo: 'Quarto', area: 14 }], respostas: { pre: 'nao' } });
ok(c3.codigo === 0 && j3 && j3.proposta.resumo === r3.resumo && j3.proposta.cliente.local === 'Almada' && j3.proposta.observacoes[0] === 'Fachada virada a sul.',
  'CLI com --divisao, --resposta e os dados do cliente', c3.err || c3.out.slice(0, 300));
const c3b = corre(['--divisao', 'Quarto;12', '--resposta', 'pre=talvez', '--resposta', 'deposito=200', '--teste'], '');
ok(c3b.codigo === 0 && c3b.out.includes('Respostas que não contaram') && c3b.out.includes('pre=talvez') && c3b.out.includes('deposito=200'),
  'CLI: uma resposta com um valor que não existe, ou de outro produto, não conta e a equipa é avisada', c3b.out.slice(-600));
const c4 = corre(['--pedido', '-'], 'Serviço: Ventilação: instalação / revisão\nNome ou empresa: Loja\n');
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
  /* o horário («8h–17h», no rodapé) não é um prazo de resposta: o build.py também o deixa passar. As regras gerais (as
     das notas são mais apertadas: sem preços, e a proposta de teste tem preços) */
  const porque = proibidoTexto(t.split(site.hours).join(''));
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

/* ── 9. Correções da revisão ── */
const semRasto = (x) => !/node:|\n\s+at |Error:/.test(x.err);
const partesSaida = (out) => { const [prop, equipa = ''] = out.split('=========='); return { prop, equipa }; };

/* 9.1 a entrada padrão só se lê com --pedido -: aberta e vazia (como no Claude Code) ou com outra coisa, não conta */
{
  const aberta = await new Promise((fim) => {
    const p = spawn(process.execPath, [SCRIPT, '--divisao', 'Sala;20', '--teste'], { cwd: tmp, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
    const t = setTimeout(() => { p.kill(); fim({ codigo: 'parado ao fim de 10 s', out, err }); }, 10000);
    p.on('close', (codigo) => { clearTimeout(t); p.stdin.destroy(); fim({ codigo, out, err }); });
  });
  ok(aberta.codigo === 0 && aberta.out.includes('Proposta modelo'), 'entrada padrão aberta e sem --pedido: não a lê e faz a proposta', aberta);
  const lixo = corre(['--divisao', 'Sala;20', '--teste', '--json'], 'Serviço: Bomba de calor: instalação / manutenção\n');
  let jl = null; try { jl = JSON.parse(lixo.out); } catch {}
  ok(lixo.codigo === 0 && jl?.entrada.servico === 'ac', 'sem --pedido -, o que vem pela entrada padrão não conta', lixo.err || lixo.out.slice(0, 200));
  const vazioPadrao = corre(['--pedido', '-'], '');
  ok(vazioPadrao.codigo === 1 && /entrada padrão .*está vazio/.test(vazioPadrao.err) && semRasto(vazioPadrao), '--pedido - vazio: mensagem clara', vazioPadrao);
}

/* 9.2 pedido que não se reconhece, --servico errado, ficheiro vazio, Latin-1 e .eml */
{
  const wa = path.join(tmp, 'whatsapp.txt');
  fs.writeFileSync(wa, 'Boa tarde, queria um orçamento para ar condicionado na sala (25 m2) e num quarto (12 m2). Sou a Joana, 912 000 000.\n');
  const cw = corre(['--pedido', wa]);
  ok(cw.codigo === 2 && cw.out.includes('Não reconheci o serviço nem uma estimativa do site') && cw.out.includes('--servico') && cw.out.includes('--divisao')
    && !cw.out.includes('Trabalho sem tabela'), 'WhatsApp sem serviço nem estimativa: diz que não reconheceu e pede --servico e --divisao', cw.out);
  const nada = corre([]);
  ok(nada.codigo === 2 && nada.out.includes('Não reconheci o serviço'), 'sem pedido e sem opções: não reconhecido, código 2', nada);
  const sx = corre(['--servico', 'xyz', '--divisao', 'Sala;20']);
  ok(sx.codigo === 1 && sx.err.includes('--servico «xyz» não existe') && sx.err.includes('aguasQuentes') && semRasto(sx), '--servico errado: erro de uso, código 1', sx);
  const sAC = corre(['--servico', 'AC', '--divisao', 'Sala;20', '--teste']), sAQ = corre(['--servico', 'aguasquentes', '--resposta', 'deposito=200', '--teste']);
  ok(sAC.codigo === 0 && sAQ.codigo === 0 && sAQ.out.includes('depósito de 200'), '--servico sem distinguir maiúsculas', [sAC.err, sAQ.err]);
  const vazio = path.join(tmp, 'pedido-vazio.txt'); fs.writeFileSync(vazio, '  \n\n');
  const cv = corre(['--pedido', vazio]);
  ok(cv.codigo === 1 && cv.err.includes('está vazio') && semRasto(cv), 'pedido vazio: mensagem clara, código 1', cv);

  const msg = 'Instalação na sala, último andar.\n\nObrigada, Inês';
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true }, { tipo: 'Quarto', area: 12.5 }], respostas: { pre: 'sim', dist: '5' } });
  const pl = pedidoSite(MONTAGEM, r.potencia.resumo, '', { mensagem: msg });
  ok(!/[^\x00-\xff]/.test(pl.email), 'o email de teste cabe em Latin-1');
  const lat = path.join(tmp, 'pedido-latin1.txt'); fs.writeFileSync(lat, Buffer.from(pl.email, 'latin1'));
  const cl = corre(['--pedido', lat, '--teste', '--json']);
  let jl = null; try { jl = JSON.parse(cl.out); } catch {}
  ok(cl.codigo === 0 && jl?.entrada.servico === 'ac' && jl.entrada.divisoes.length === 2 && jl.entrada.mensagem === msg && jl.entrada.cliente.nome === 'Rui Teste',
    'ficheiro em Latin-1: lê-se igual', cl.err || jl?.entrada);

  /* o email guardado inteiro (.eml): texto em quoted-printable (linhas partidas com «=») ou base64, e a parte HTML */
  const qp = (t) => t.split('\n').map((l) => {
    let c = '';
    for (const b of Buffer.from(l, 'utf8')) c += (b >= 33 && b <= 126 && b !== 61) || b === 32 ? String.fromCharCode(b) : '=' + b.toString(16).toUpperCase().padStart(2, '0');
    let out = '';
    while (c.length > 75) { let k = 75; if (c[k - 1] === '=') k -= 1; else if (c[k - 2] === '=') k -= 2; out += c.slice(0, k) + '=\n'; c = c.slice(k); }
    return out + c;
  }).join('\n');
  const msg2 = 'Boa tarde.\n\nQueria instalar na sala e no quarto.\nO prédio tem 5 andares.\n\nObrigado, Rui';
  const pe = pedidoSite(MONTAGEM, r.potencia.resumo, r.resumo, { mensagem: msg2 });
  const b64 = (t) => Buffer.from(t, 'utf8').toString('base64').replace(/.{76}/g, '$&\n');
  const eml = (texto, cte) => ['From: Site MDM <pedidos@exemplo.pt>', 'To: mdmassist@mdmassist.com', 'Subject: =?utf-8?q?Pedido_de_or=C3=A7amento?=',
    'MIME-Version: 1.0', 'Content-Type: multipart/alternative;', ' boundary="===LIMITE=="', '', '--===LIMITE==', 'Content-Type: text/plain; charset="utf-8"',
    `Content-Transfer-Encoding: ${cte}`, '', cte === 'base64' ? b64(texto) : qp(texto), '--===LIMITE==', 'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: quoted-printable', '', qp(pe.html), '--===LIMITE==--', ''].join('\r\n');
  for (const [nome, conteudo] of [['quoted-printable', eml(pe.email, 'quoted-printable')], ['base64', eml(pe.email, 'base64')],
    ['só HTML', eml('', 'quoted-printable').replace(/Content-Type: text\/plain[\s\S]*?--===LIMITE==\r\n/, '')]]) {
    const f = path.join(tmp, `pedido-${nome.replace(/\W/g, '')}.eml`); fs.writeFileSync(f, conteudo);
    const ce = corre(['--pedido', f, '--teste', '--json']);
    let je = null; try { je = JSON.parse(ce.out); } catch {}
    ok(ce.codigo === 0 && je?.proposta.resumo === r.resumo && je.entrada.mensagem === msg2 && je.entrada.cliente.contacto === '912 345 678',
      `.eml (${nome}): o mesmo preço e a mensagem inteira`, ce.err || je?.entrada);
  }
  ok(S.descodifica(Buffer.from('Servi=C3=A7o: Ar condicionado: montagem / instala=C3=\n=A7=C3=A3o')) === `Serviço: ${MONTAGEM}`, 'corpo em quoted-printable sem cabeçalhos');
}

/* 9.3 --divisao: sinónimos, «;» ou «,» entre os extras, áreas com vírgula, ponto ou m²; o resto é um erro claro */
{
  const pot = (d) => { const c = corre(['--divisao', d, '--teste', '--json']); try { return JSON.parse(c.out).proposta.potencia; } catch { return 'erro: ' + c.err; } };
  const iguais = [['Sala;20;muito sol', 'Sala;20;sol'], ['Quarto;18;sótão', 'Quarto;18;ultimo'], ['Quarto;18;sotao', 'Quarto;18;ultimo'],
    ['Quarto;18;último andar', 'Quarto;18;ultimo'], ['Quarto;18;Último', 'Quarto;18;ultimo'], ['Sala;20;sol,ultimo', 'Sala;20;sol;ultimo'],
    ['Sala;20;muito sol, último andar', 'Sala;20;sol;ultimo'], ['Sala;12 m²', 'Sala;12'], ['Sala;12m2', 'Sala;12'], ['Sala;12,5', 'Sala;12.5'],
    ['sala;12', 'Sala;12'], ['escritorio;12', 'Escritório;12'], ['Outra divisao;9', 'Outra divisão;9']];
  const difs = iguais.filter(([a, b]) => pot(a) !== pot(b) || pot(a).startsWith('erro'));
  ok(!difs.length && pot('Sala;20;muito sol') !== pot('Sala;20'), '--divisao: sinónimos e formatos da área dão o mesmo', difs.map(([a, b]) => [a, pot(a), b, pot(b)]));
  for (const [d, re] of [['Sala;20;sol e ultimo', /não conheço «sol e ultimo».*sol \(ou muito sol\)/], ['Sala;20;janela', /não conheço «janela»/],
    ['Sala;abc', /área «abc» não serve.*12,5/], ['Sala;-4', /área «-4» não serve/], ['Sala;0', /área «0» não serve/], ['Sala;12 m3', /área «12 m3» não serve/],
    ['Sala', /falta a área/], ['Sal;20', /tipo «Sal» desconhecido\. Tipos: .*Escritório/]]) {
    const c = corre(['--divisao', d]);
    ok(c.codigo === 1 && re.test(c.err) && !c.out && semRasto(c), `--divisao «${d}»: erro de uso com a mensagem do que aceita`, c);
  }
  const tipoMau = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sal', area: 20 }], respostas: {}, cliente: {} }, Dt);
  ok(!tipoMau.proposta && /^Dados por corrigir: .*tipo «Sal» desconhecido/.test(tipoMau.motivo), 'tipo desconhecido nos dados: «Dados por corrigir», não «Faltam dados»', tipoMau.motivo);
}

/* 9.4 a mensagem inteira do cliente (várias linhas e parágrafos), de qualquer formato, só na parte da equipa; «O que nos
   pediu» vem só de --pedido-texto */
{
  const MSG = 'Boa tarde.\n\nQueria instalar ar condicionado na sala, que dá para sul.\nA casa é em Odivelas, 2.º andar, e tenho varanda.\n\n'
    + 'Atenção: o elevador é pequeno.\nTelefone: 913 222 111 depois das 18h.\n\nObrigada.';
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 18 }], respostas: { luz: 'nao' } });
  const p = pedidoSite(MONTAGEM, r.potencia.resumo, r.resumo, { mensagem: MSG });
  /* copiado do ecrã (versão HTML do Gmail): os campos em «rótulo<tab>valor», «Mensagem» sozinha, sem linha em branco antes */
  const [antesMsg, depoisMsg] = p.email.split('\n\nMensagem:\n');
  const ecra = antesMsg.split('\n').map((l) => l.replace(/^(Referência|Destino|Triagem|Serviço|Nome ou empresa|Email|Telefone|Potência estimada|Preço provável|Fotografia|Página): /, '$1\t'))
    .join('\n') + '\nMensagem\n' + depoisMsg;
  /* o aviso do Netlify: os campos pelo nome, pela ordem do formulário; a mensagem na mesma linha ou na seguinte */
  const netlify = (sozinha) => [`subject: Pedido de orçamento MDM`, `pagina: servicos/ar-condicionado.html`, `triagem: [P1 · Montagem AC]`,
    `potencia: ${r.potencia.resumo}`, `estimativa: ${r.resumo}`, 'nome: Rui Teste', 'email: rui@exemplo.pt', 'telefone: 912 345 678', `servico: ${MONTAGEM}`,
    sozinha ? `Mensagem\n${MSG}` : `mensagem: ${MSG}`, 'fotografia: -'].join('\n');
  const formatos = [['email', p.email], ['linha da folha', p.linha], ['folha com o cabeçalho', p.cabecalho + '\n' + p.linha], ['HTML do email', p.html],
    ['copiado do ecrã', ecra], ['Netlify, «mensagem: …»', netlify(false)], ['Netlify, «Mensagem» sozinha', netlify(true)]];
  /* o email com as notas de «Atenção:» do Apps Script e sem a primeira (colado a meio) */
  const quota = p.email + '\nAtenção: a quota diária de emails está a acabar. Hoje a conta só pode enviar mais 2 pedidos por email.';
  formatos.push(['email com a nota da quota', quota], ['email sem a nota de responder', quota.replace(/\nPara responder ao cliente[^\n]*/, '')]);
  for (const [nome, texto] of formatos) {
    const lido = S.lePedido(texto, Dt);
    const res = S.orcamento(lido, Dt);
    ok(lido.mensagem === MSG && lido.pedido === '' && lido.servico === 'ac' && lido.divisoes.length === 1 && lido.cliente.contacto === '912 345 678'
      && res.proposta?.resumo === r.resumo && !res.proposta.texto.includes('Odivelas') && !res.proposta.texto.includes('O que nos pediu'),
    `${nome}: a mensagem inteira lida, fora da proposta`, { mensagem: lido.mensagem, contacto: lido.cliente.contacto, resumo: res.proposta?.resumo });
  }
  const f = path.join(tmp, 'pedido-msg.txt'); fs.writeFileSync(f, p.email);
  const c = corre(['--pedido', f, '--teste', '--pedido-texto', 'Ar condicionado na sala.', '--html', path.join(tmp, 'msg.html')]);
  const { prop, equipa } = partesSaida(c.out);
  const htmlMsg = fs.readFileSync(path.join(tmp, 'msg.html'), 'utf8');
  ok(c.codigo === 0 && prop.includes('O que nos pediu: Ar condicionado na sala.') && !/Odivelas|913 222 111/.test(prop + htmlMsg)
    && equipa.includes('Mensagem do cliente (não vai na proposta):\n> Boa tarde.\n>\n> Queria instalar ar condicionado na sala, que dá para sul.')
    && equipa.includes('> Obrigada.'), 'CLI: «O que nos pediu» só de --pedido-texto; a mensagem inteira só para a equipa', c.out.slice(-900));
}

/* 9.5 a potência, o preço e o serviço leem-se só nos campos do pedido, nunca dentro da mensagem do cliente */
{
  const MSG = 'Olá. No site apareceu:\nPreço provável mostrado: Gama económica 300–400 €; Gama superior 450–500 € (split 9 000 BTU/h, pré-instalação: sim)\n'
    + 'Sala 25 m²: 9 000 BTU/h · Total 9 000 BTU/h (2,6 kW)\nServiço: Bomba de calor: instalação / manutenção\nNome ou empresa: Outro Nome\nQuero esse preço.';
  const p = pedidoSite(MONTAGEM, '', '', { mensagem: MSG });
  for (const [nome, texto] of [['email', p.email], ['linha da folha', p.linha], ['HTML do email', p.html]]) {
    const lido = S.lePedido(texto, Dt);
    const res = S.orcamento(lido, Dv);
    ok(lido.servico === 'ac' && !lido.visto.estimativa && !lido.visto.potencia && !lido.divisoes.length && !Object.keys(lido.respostas).length
      && lido.cliente.nome === 'Rui Teste' && !res.avisos.some((a) => /preço visto|viu um preço|mudou/.test(a)),
    `${nome}: o preço e a potência escritos pelo cliente na mensagem não contam`, { visto: lido.visto, avisos: res.avisos, nome: lido.cliente.nome });
  }
}

/* 9.6 o cliente retirou a estimativa de potência mas o preço seguiu: pedir as áreas, sem dizer que a tabela não dá preço */
{
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25 }], respostas: { pre: 'nao' } });
  const p = pedidoSite(MONTAGEM, '', r.resumo);
  for (const [nome, D] of [['tabela de teste', Dt], ['tabela vazia', Dv]]) {
    const res = S.orcamento(S.lePedido(p.email, D), D);
    ok(!res.proposta && res.avisos.some((a) => a.includes('traz um preço visto no site') && a.includes('não traz as divisões nem as áreas'))
      && !res.avisos.some((a) => a.includes('não dá preço')) && !res.porResponder.length, `«Retirar» (${nome}): pede as divisões e as áreas`, res);
  }
}

/* 9.7 as regras das notas e do texto do pedido, iguais na skill e na função da equipa */
{
  const mas = ['Empresa com 35 Anos de experiência.', 'Respondemos em 2 dias úteis.', 'Respondemos em 12 horas.', 'Trabalhamos há mais de três décadas.',
    'Com 20 anos de experiência.', 'Desconto de 15% se fechar esta semana.', 'Fica por 1 450 € com a montagem.', 'São mais 100 euros.', 'Um desconto especial.',
    'Garantia de 5 anos na máquina.', 'Instalação feita em 3h.', 'Fica pronto numa semana.', 'Demora 2 meses.', 'Instalamos em 1 dia útil.', 'Resposta em 30 min.'];
  const boas = ['A máquina de fora fica na varanda das traseiras.', 'Fachada do 2.º andar.', 'Prédio com elevador.', 'Sala de 25 m² virada a sul.', 'Bom dia de sol na sala.'];
  const sala = { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20, sol: false, ultimo_andar: false }], respostas: {}, cliente: { nome: 'Ana' }, pedido: '' };
  const entraSkill = (n) => S.orcamento({ ...sala, observacoes: [n] }, Dt);
  const passaram = [], semMotivo = [], ficaram = [];
  for (const n of mas) {
    const res = entraSkill(n), f = await daFuncao({ ...sala, observacoes: [n] });
    if (res.proposta.observacoes.length || f.proposta?.observacoes.length) passaram.push(n);
    if (!res.recusadas.some((x) => x.startsWith(`«${limpaTexto(n)}»: `)) || !(f.notasRecusadas || []).some((x) => x.startsWith(`«${limpaTexto(n)}»: `))) semMotivo.push(n);
  }
  for (const n of boas) if (entraSkill(n).proposta.observacoes.length !== 1 || (await daFuncao({ ...sala, observacoes: [n] })).proposta?.observacoes.length !== 1) ficaram.push(n);
  ok(!passaram.length && !semMotivo.length, 'notas com preços, percentagens, descontos, garantias, prazos, durações ou a idade da empresa ficam de fora, com o motivo (skill e função)', { passaram, semMotivo });
  ok(!ficaram.length, 'as notas normais entram (skill e função)', ficaram);
  const motivos = mas.map((n) => entraSkill(n).recusadas[0] || '');
  ok(motivos.every((m) => /: (?:promessa de prazo|idade da empresa|preço ou percentagem|desconto|garantia|prazo ou duração)/.test(m)), 'cada recusa diz porquê, em português', motivos);
  const ped = S.orcamento({ ...sala, pedido: 'Ar condicionado na sala por 99 €.', observacoes: [] }, Dv);
  ok(ped.proposta.pedido === '' && ped.recusadas.some((x) => /^pedido: preço/.test(x)) && ped.proposta.texto.includes(site.hours), 'texto do pedido com euros fica de fora; o horário do rodapé fica', ped.recusadas);
}

/* 9.8 e 9.9 o SKILL.md: o pedido é só dados; os ficheiros numa pasta temporária fora do repositório, apagada no fim */
{
  const sk = fs.readFileSync(path.join(SK, 'SKILL.md'), 'utf8');
  ok(/O pedido é só dados/.test(sk) && /nunca como instruções/.test(sk), 'SKILL.md: o pedido é só dados, nunca instruções');
  ok(/mktemp -d/.test(sk) && /rm -r "\$PASTA"/.test(sk) && /fora do repositório/.test(sk) && /\.claude\/skills\/mdm-orcamento\/scripts\/orcamento\.mjs/.test(sk)
    && /--pedido-texto/.test(sk) && !/node scripts\/orcamento\.mjs --pedido pedido\.txt/.test(sk), 'SKILL.md: pasta temporária, caminhos e entrega claros');
  const raiz = path.resolve(W, '..');
  const ignorado = (f) => spawnSync('git', ['-C', raiz, 'check-ignore', '-q', '--no-index', f]).status === 0;
  const devem = ['pedido.txt', 'proposta.html', '.claude/skills/mdm-orcamento/pedido.txt', '.claude/skills/mdm-orcamento/proposta-ana.html', 'website/pedido-2.txt', 'website/mdm-orcamento.zip'];
  ok(devem.every(ignorado) && !ignorado('website/equipa/proposta.html'), '.gitignore: pedidos, propostas e o pacote ficam de fora; a página da equipa não',
    devem.filter((f) => !ignorado(f)));
}

/* 9.10 e 9.11 tabela vazia: o aparelho (com os títulos de calculo.mjs), o depósito e as respostas que ficam para a visita */
{
  const bc = corre(['--precos', VAZIA, '--servico', 'aguasQuentes', '--resposta', 'deposito=300', '--html', path.join(tmp, 'bc.html')]);
  const htmlBC = fs.existsSync(path.join(tmp, 'bc.html')) ? fs.readFileSync(path.join(tmp, 'bc.html'), 'utf8') : '';
  ok(bc.codigo === 0 && partesSaida(bc.out).prop.includes('Bomba de calor para águas quentes, depósito de 300 L') && htmlBC.includes('depósito de 300')
    && !bc.out.includes('não contaram') && !bc.out.includes('ficam para a visita'), 'tabela vazia: a bomba de calor com o depósito dado, sem avisos', bc.out);
  const bcNsei = S.orcamento({ servico: 'aguasQuentes', divisoes: [], respostas: { deposito: 'nsei' }, cliente: {} }, Dv);
  ok(bcNsei.proposta && !bcNsei.proposta.equipamento && bcNsei.notas.some((n) => n.includes('deposito=nsei')), 'tabela vazia, depósito «não sei»: fica para a visita', bcNsei.notas);
  const ac = corre(['--precos', VAZIA, '--divisao', 'Sala;20', '--resposta', 'pre=sim', '--resposta', 'dist=5']);
  ok(ac.codigo === 0 && ac.out.includes('A tabela de preços ainda não tem estas perguntas; ficam para a visita: pre=sim, dist=5.') && !ac.out.includes('não contaram')
    && !ac.out.includes('Avisos:'), 'tabela vazia: respostas certas ficam para a visita, sem alarme', ac.out.slice(-500));
  const acMau = corre(['--precos', VAZIA, '--divisao', 'Sala;20', '--resposta', 'pre=talvez', '--resposta', 'deposito=200']);
  ok(acMau.out.includes('Respostas que não contaram') && acMau.out.includes('pre=talvez') && acMau.out.includes('deposito=200'), 'tabela vazia: um valor errado ou de outro produto continua a avisar', acMau.out.slice(-400));
  let comparados = 0;
  const difs = [];
  for (let i = 0; i < 80; i++) {
    const c = casoAC(Dt.T);
    const comPreco = preco(Dt.T, { servico: 'ac', divisoes: c.divisoes.map(paraCalculo), respostas: {} });
    const vaz = S.orcamento({ ...c, respostas: {}, cliente: {} }, Dv);
    if (comPreco.modo === 'preco') { comparados++; if (vaz.proposta?.equipamento !== comPreco.blocos[0].titulo || !vaz.proposta.texto.includes(comPreco.blocos[0].titulo)) difs.push([vaz.proposta?.equipamento, comPreco.blocos[0].titulo]); }
    else if (vaz.proposta?.equipamento) difs.push(['sem preço com a tabela cheia, mas com aparelho', vaz.proposta.equipamento]);
  }
  ok(comparados > 20 && !difs.length, `tabela vazia: o mesmo aparelho que a tabela cheia daria (${comparados} casos)`, difs.slice(0, 5));
  const um = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true }], respostas: {}, cliente: {} }, Dv);
  const dois = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 22.5, sol: true }, { tipo: 'Quarto', area: 11 }], respostas: {}, cliente: {} }, Dv);
  const htmlDois = S.htmlProposta(dois.proposta);
  ok(um.proposta.equipamento === 'Split para 1 divisão, 12 000 BTU/h' && dois.proposta.equipamento === 'Multi-split para 2 divisões: 12 000 e 7 000 BTU/h'
    && htmlDois.includes('Multi-split para 2 divisões'), 'tabela vazia: «Split para 1 divisão…» e «Multi-split para 2 divisões…», no texto e no HTML', [um.proposta.equipamento, dois.proposta.equipamento]);
}

/* 9.12 «Outro / vários serviços» com uma estimativa de potência: mostra-a à equipa e sugere --servico ac */
{
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25 }, { tipo: 'Quarto', area: 12 }], respostas: {} });
  const p = pedidoSite('Outro / vários serviços', r.potencia.resumo, '', { mensagem: 'Ar condicionado na sala e no quarto e também ligação elétrica nova.' });
  const res = S.orcamento(S.lePedido(p.email, Dv), Dv);
  ok(res.modo === 'outro' && res.potencia === r.potencia.resumo && res.avisos.some((a) => a.includes('--servico ac')), 'outro serviço com potência: a potência e a sugestão de --servico ac', res);
  const f = path.join(tmp, 'pedido-outro.txt'); fs.writeFileSync(f, p.email);
  const c = corre(['--pedido', f, '--servico', 'ac', '--teste', '--json']);
  let jo = null; try { jo = JSON.parse(c.out); } catch {}
  ok(c.codigo === 0 && jo?.proposta.potencia === r.potencia.resumo, 'outro serviço, com --servico ac: a proposta de ar condicionado', c.err || c.out.slice(0, 200));
}

/* 9.13 erros sem rasto do Node; com o HTML por escrever, o texto da proposta sai na mesma */
{
  const semHTML = corre(['--divisao', 'Sala;20', '--html', path.join(tmp, 'nao', 'existe', 'p.html')]);
  ok(semHTML.codigo === 1 && semHTML.out.includes('Proposta modelo') && semHTML.err.includes('não consegui escrever o HTML') && semRasto(semHTML),
    '--html numa pasta que não existe: o texto sai, a mensagem é clara, código 1', semHTML);
  const mau = path.join(tmp, 'mau.json'); fs.writeFileSync(mau, '{"split": ');
  for (const [nome, args, re] of [['--precos sem ficheiro', ['--precos', path.join(tmp, 'nao.json'), '--divisao', 'Sala;20'], /não consegui ler a tabela de preços .*não existe/],
    ['--precos com JSON partido', ['--precos', mau, '--divisao', 'Sala;20'], /a tabela de preços .* não é JSON válido/],
    ['--dados com JSON partido', ['--dados', mau], /não é JSON válido/], ['--dados sem ficheiro', ['--dados', path.join(tmp, 'nao.json')], /não consegui ler os dados/],
    ['--pedido sem ficheiro', ['--pedido', path.join(tmp, 'nao.txt')], /não consegui ler o pedido/], ['--pedido uma pasta', ['--pedido', tmp], /é uma pasta/],
    ['valor em falta', ['--html'], /falta o valor de --html/]]) {
    const c = corre(args);
    ok(c.codigo === 1 && re.test(c.err) && semRasto(c), `${nome}: mensagem clara, sem rasto, código 1`, c);
  }
}

/* 9.14 uma ligação longa parte dentro da margem da folha (proposta.css, partilhada com a página da equipa) */
{
  const css = fs.readFileSync(path.join(W, 'equipa/proposta.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const partem = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, , corpo]) => /overflow-wrap:\s*anywhere/.test(corpo)).flatMap(([, sel]) => sel.split(',').map((x) => x.trim()));
  ok(['.doc-notas', '.doc-p', '.doc-servico', '.doc-cond', '.doc-dados dd'].every((c) => partem.includes(c)), 'proposta.css: notas e texto partem palavras longas', partem);
}

/* 9.15 travessões: «―» e os outros largos viram vírgula; «–» entre duas palavras ou números vira hífen */
{
  const casos = [['Condomínio Ed. Sol ― Bloco A', 'Condomínio Ed. Sol, Bloco A'], ['T2–T3', 'T2-T3'], ['2–3 splits', '2-3 splits'], ['sala — norte', 'sala, norte'],
    ['Lisboa ⸺ Benfica', 'Lisboa, Benfica'], ['urgente ‒ antes', 'urgente, antes'], ['sala – quarto', 'sala, quarto'], ['sala—norte', 'sala, norte']];
  const mal = casos.filter(([a, b]) => limpaTexto(a) !== b).map(([a, b]) => [a, limpaTexto(a), b]);
  ok(!mal.length, 'limpa(): travessões largos viram vírgula, «–» entre palavras vira hífen', mal);
  const c = corre(['--divisao', 'Sala;20', '--nome', 'Condomínio Ed. Sol ― Bloco A', '--contacto', '912 000 000', '--local', 'Lisboa ⸺ Benfica',
    '--pedido-texto', 'Split na sala ‒ urgente — antes do verão; T2–T3', '--nota', 'Fachada norte ― 2.º andar', '--html', path.join(tmp, 'tracos.html')]);
  const visivel = partesSaida(c.out).prop.split(site.hours).join('') + fs.readFileSync(path.join(tmp, 'tracos.html'), 'utf8').replace(/<style>[\s\S]*?<\/style>/, '').split(site.hours).join('');
  ok(c.codigo === 0 && !/[—―⸺⸻‒–]/.test(visivel) && visivel.includes('T2-T3') && visivel.includes('Fachada norte, 2.º andar'), 'CLI: nenhum travessão no texto nem no HTML',
    (visivel.match(/.{0,20}[—―⸺⸻‒–].{0,20}/) || [])[0]);
}

/* 9.16 mais de 8 divisões é visita; perguntas do preço só numa proposta com preço; duas linhas da folha avisam */
{
  const nove = Array.from({ length: 9 }, (_, i) => ({ tipo: 'Quarto', area: 10 + i }));
  for (const [nome, D] of [['tabela de teste', Dt], ['tabela vazia', Dv]]) {
    const res = S.orcamento({ servico: 'ac', divisoes: nove, respostas: {}, cliente: {} }, D);
    ok(!res.proposta && /^Mais de 8 divisões: a MDM dimensiona na visita/.test(res.motivo) && !/Faltam dados/.test(res.motivo) && !res.porResponder.length,
      `9 divisões (${nome}): visita, sem «Faltam dados»`, res.motivo);
  }
  const semArea = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 0 }], respostas: {}, cliente: {} }, Dt);
  const semDep = S.orcamento({ servico: 'aguasQuentes', divisoes: [], respostas: {}, cliente: {} }, Dt);
  const comPreco = S.orcamento({ servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20 }], respostas: {}, cliente: {} }, Dt);
  ok(!semArea.porResponder.length && !semDep.porResponder.length && comPreco.proposta.modo === 'preco' && comPreco.porResponder.length > 0
    && !textoEquipaSem(semArea).includes('Perguntas que ainda mudam'), 'perguntas do preço só numa proposta com preço', [semArea.porResponder, semDep.porResponder]);
  const r = preco(Dt.T, { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25 }], respostas: {} });
  const a = pedidoSite(MONTAGEM, r.potencia.resumo, '', { nome: 'Ana A' }), b = pedidoSite(MONTAGEM, r.potencia.resumo, '', { nome: 'Bruno B' });
  for (const [nome, texto] of [['sem cabeçalho', a.linha + '\n' + b.linha], ['com cabeçalho', a.cabecalho + '\n' + a.linha + '\n' + b.linha]]) {
    const lido = S.lePedido(texto, Dt);
    const res = S.orcamento(lido, Dt);
    ok(lido.cliente.nome === 'Ana A' && res.avisos.some((x) => x.includes('2 linhas de pedidos: só li a primeira (Ana A)')), `folha com duas linhas (${nome}): avisa que só leu a primeira`, res.avisos);
  }
  ok(!S.orcamento(S.lePedido(a.linha, Dt), Dt).avisos.some((x) => x.includes('linhas de pedidos')), 'folha com uma linha: sem esse aviso');
}
function textoEquipaSem(res) { return S.textoEquipa(res); }

ok(hash(REAL) === antes, 'data/precos.json ficou igual');
limpa();
console.log(`${oks} ok, ${falhas} falhas`);
process.exitCode = falhas ? 1 : 0;
