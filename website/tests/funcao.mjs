/* Testa a função do assistente de propostas (netlify/functions/proposta.mts) sem rede e sem chave: um servidor falso
   faz de API do Claude e responde com chamadas às ferramentas escritas à mão. Confirma o pedido que a função faz à API
   (modelo, ferramentas, fallbacks), a senha, as contas das ferramentas e a proposta. Uso, a partir de website/:
     npm install && node tests/funcao.mjs */
import { build } from 'esbuild';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-funcao-'));
const saida = path.join(tmp, 'proposta.mjs');
await build({ entryPoints: [path.join(W, 'netlify/functions/proposta.mts')], bundle: true, platform: 'node', format: 'esm',
  outfile: saida, external: ['@anthropic-ai/sdk'], logLevel: 'error' });
fs.symlinkSync(path.join(W, 'node_modules'), path.join(tmp, 'node_modules'));
const { atende, redige } = await import(saida);

let falhas = 0, oks = 0;
const ok = (c, msg, extra) => { if (c) oks++; else { falhas++; console.log('FALHA ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 600) : '')); } };

/* a API falsa: guarda cada pedido e responde com a próxima resposta da fila */
const pedidos = [], fila = [];
const srv = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    pedidos.push({ headers: req.headers, body: JSON.parse(b) });
    const r = fila.shift() || { content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' };
    if (r.__status) {
      res.writeHead(r.__status, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ type: 'error', error: { type: r.__tipo || 'not_found_error', message: r.__msg || 'x' } }));
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'msg_' + pedidos.length, type: 'message', role: 'assistant', model: 'claude-opus-5-5',
      stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 }, ...r }));
  });
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const cliente = new Anthropic({ apiKey: 'teste', baseURL: `http://127.0.0.1:${srv.address().port}`, maxRetries: 0 });

const env = (extra = {}) => ({ get: (k) => ({ MDM_EQUIPA_SENHA: 'segredo', MDM_PRECOS: 'teste', ...extra })[k] });
async function chama(mensagens, { senha = 'segredo', e = env() } = {}) {
  const req = new Request('http://x/api/proposta', { method: 'POST', headers: { 'x-mdm-senha': senha, 'content-type': 'application/json' },
    body: JSON.stringify({ mensagens }) });
  const r = await atende(req, e, cliente);
  return { status: r.status, corpo: await r.json() };
}
const VAZIAS = { pre: '', dist: '', furo: '', fora: '', luz: '', antigas: '', deposito: '' };
const usa = (name, input) => ({ content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'tool_use', id: 'tu_' + name, name, input }], stop_reason: 'tool_use' });

// senha e configuração
ok((await chama([{ role: 'user', content: 'olá' }], { senha: 'errada' })).status === 401, 'senha errada dá 401');
ok((await chama([{ role: 'user', content: 'olá' }], { e: { get: () => undefined } })).status === 503, 'sem configuração dá 503');
ok((await chama([{ role: 'assistant', content: 'x' }])).status === 400, 'histórico que não começa no utilizador dá 400');
ok(pedidos.length === 0, 'nenhum pedido à API antes de passar a senha e a validação');

// 1. preço de um split: o modelo pede calcular_preco, a função faz a conta
const h = [{ role: 'user', content: 'Sala de 25 m², último andar, muito sol. Quanto custa?' }];
fila.push(usa('calcular_preco', { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true, ultimo_andar: true }], respostas: VAZIAS }));
let r = await chama(h);
const p0 = pedidos[0];
ok(r.status === 200 && r.corpo.continuar === true, 'tool_use pede para continuar', r.corpo);
ok(p0.body.model === 'claude-opus-5-5' && p0.body.fallbacks === 'default' && /server-side-fallback-2026-07-01/.test(p0.headers['anthropic-beta'] || ''),
  'pedido com o modelo, fallbacks "default" e o beta certo', { model: p0.body.model, f: p0.body.fallbacks, b: p0.headers['anthropic-beta'] });
ok(p0.body.output_config?.effort === 'medium' && !p0.body.thinking, 'esforço medium, sem thinking desligado');
ok(p0.body.tools.length === 3 && p0.body.tools.every((t) => t.strict === true && t.input_schema.additionalProperties === false), 'três ferramentas estritas');
ok(/TESTE/.test(p0.body.system[0].text) && /desde 1991/.test(p0.body.system[0].text) && !/—/.test(p0.body.system[0].text), 'sistema com aviso de teste, «desde 1991», sem travessões');
const res = JSON.parse(r.corpo.novas[1].content[0].content);
ok(r.corpo.novas[0].content[0].type === 'thinking', 'a resposta do modelo volta inteira (com o bloco de pensamento)');
ok(res.modo === 'preco' && res.valores_de_teste === true && res.blocos[0].titulo === 'Split para 1 divisão, 18 000 BTU/h', 'preço calculado para 18 000 BTU/h', res);
ok(res.blocos[0].gamas[0].texto === 'entre 1 500 € e 1 900 €' && res.blocos[0].gamas[1].texto === 'entre 1 900 € e 2 400 €', 'intervalos da tabela de teste', res.blocos);
ok(res.perguntas_por_responder.length === 6, 'devolve as 6 perguntas por responder', res.perguntas_por_responder);

// 2. a página continua: o modelo responde em texto
h.push(...r.corpo.novas);
fila.push({ content: [{ type: 'text', text: 'Para essa sala...' }], stop_reason: 'end_turn' });
r = await chama(h);
ok(r.corpo.continuar === false && r.corpo.novas.length === 1, 'fim de turno não continua');
ok(JSON.stringify(pedidos[1].body.messages) === JSON.stringify(h), 'o histórico vai à API tal como a página o guardou (só acrescentado)');
h.push(...r.corpo.novas);

// 3. extras e proposta
h.push({ role: 'user', content: 'Tem pré-instalação, parede de betão, 2.º andar fachada. Prepara a proposta para a D. Ana, Moscavide.' });
fila.push(usa('preparar_proposta', { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true, ultimo_andar: true }],
  respostas: { ...VAZIAS, pre: 'sim', furo: 'sim', fora: 'alta', dist: '0', luz: 'nao', antigas: '1' },
  cliente: { nome: 'Ana Silva', contacto: '', local: 'Moscavide' }, pedido: 'Ar condicionado na sala — com muito sol',
  observacoes: ['A máquina de fora fica na fachada do 2.º andar.', 'Respondemos em 24 horas.', 'Experiência de 35 anos.'] }));
r = await chama(h);
const prop = r.corpo.propostas[0];
ok(prop && prop.teste === true && /^MDM-P-\d{6}-\d{4}-[0-9A-F]{4}$/.test(prop.ref), 'proposta com referência única e marca de teste', prop && prop.ref);
// 18 000 eco [1500,1900] − pré [150,100] + furo [40,60] + andaime/plataforma [250,500] + antiga [50,80] = [1690, 2440]
ok(prop.blocos[0].gamas[0].texto === 'entre 1 690 € e 2 440 €', 'extras aplicados como no formulário', prop.blocos[0].gamas[0]);
ok(prop.observacoes.length === 1 && prop.observacoes[0].startsWith('A máquina'), 'notas com prazo ou «N anos» ficam de fora', prop.observacoes);
ok(prop.pedido === 'Ar condicionado na sala, com muito sol', 'travessão trocado por vírgula', prop.pedido);
ok(/VALORES DE TESTE/.test(prop.texto) && /O preço final fica fechado depois da visita, que é gratuita\./.test(prop.texto) && /desde 1991/.test(prop.texto),
  'texto da proposta com aviso, condição e «desde 1991»', prop.texto);
const pm = JSON.parse(r.corpo.novas[1].content[0].content);
ok(pm.notas_recusadas.length === 2, 'o modelo é avisado das notas recusadas', pm);

// 4. casos sem preço e ferramenta desconhecida
fila.push(usa('calcular_preco', { servico: 'ac', divisoes: Array.from({ length: 5 }, () => ({ tipo: 'Quarto', area: 10, sol: false, ultimo_andar: false })), respostas: VAZIAS }));
r = await chama([{ role: 'user', content: '5 quartos' }]);
ok(JSON.parse(r.corpo.novas[1].content[0].content).modo === 'visita', '5 divisões: preço depois da visita');
fila.push(usa('calcular_preco', { servico: 'ac', divisoes: [], respostas: VAZIAS }));
r = await chama([{ role: 'user', content: 'x' }]);
ok(r.corpo.novas[1].content[0].is_error === true, 'sem divisões: erro para o modelo corrigir');
fila.push(usa('apagar_tudo', {}));
r = await chama([{ role: 'user', content: 'x' }]);
ok(r.corpo.novas[1].content[0].is_error === true, 'ferramenta desconhecida não faz nada');

// 5. tabela real (vazia hoje): nada tem preço
fila.push(usa('calcular_preco', { servico: 'ac', divisoes: [{ tipo: 'Quarto', area: 12, sol: false, ultimo_andar: false }], respostas: VAZIAS }));
r = await chama([{ role: 'user', content: 'x' }], { e: env({ MDM_PRECOS: '' }) });
const real = JSON.parse(r.corpo.novas[1].content[0].content);
ok(real.modo === 'sem_tabela' && !real.valores_de_teste && r.corpo.teste === false, 'tabela real vazia: sem preço', real);
ok(/^Quarto 12 m²: 7 000 BTU\/h · Total 7 000 BTU\/h/.test(real.potencia || '') && !/€/.test(JSON.stringify(real)), 'tabela real vazia: a potência vai na mesma, sem preço', real);
ok(!/TESTE/.test(pedidos.at(-1).body.system[0].text) && /ainda vazia/.test(pedidos.at(-1).body.system[0].text), 'sistema sem aviso de teste e com a tabela vazia');

// 6. recusa do modelo
fila.push({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } });
r = await chama([{ role: 'user', content: 'x' }]);
ok(r.corpo.novas.length === 0 && r.corpo.retirar === 1 && r.corpo.textoRetirado === 'x' && /voltou para a caixa/.test(r.corpo.erro), 'recusa não entra no histórico e a mensagem volta à caixa', r.corpo);

// 7. formulário: tabela e calcular, sem IA (funcionam mesmo sem chave da API)
async function acao(corpo, { e = env(), cli = cliente } = {}) {
  const req = new Request('http://x/api/proposta', { method: 'POST', headers: { 'x-mdm-senha': 'segredo', 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  const r = await atende(req, e, cli);
  return { status: r.status, corpo: await r.json() };
}
const semChave = env({}); // sem ANTHROPIC_API_KEY e sem cliente
const nPedidos = pedidos.length;
let t = await acao({ acao: 'tabela' }, { e: semChave, cli: null });
ok(t.status === 200 && t.corpo.teste === true && t.corpo.perguntas.length === 7 && t.corpo.tipos.includes('Sala'), 'tabela para o formulário, sem chave', t.corpo);
const sala = { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 25, sol: true, ultimo_andar: true }], respostas: { ...VAZIAS, pre: 'nao' },
  cliente: { nome: 'Rui', contacto: '', local: 'Olivais' }, pedido: 'Ar condicionado na sala', observacoes: [] };
t = await acao({ acao: 'calcular', dados: sala }, { e: semChave, cli: null });
ok(t.corpo.modo === 'preco' && t.corpo.proposta?.blocos[0].gamas[0].texto === 'entre 1 500 € e 1 900 €' && t.corpo.complexo.length === 0, 'calcular dá a proposta sem IA', t.corpo);
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: Array.from({ length: 5 }, () => ({ tipo: 'Quarto', area: 10, sol: false, ultimo_andar: false })) } }, { e: semChave, cli: null });
ok(t.corpo.modo === 'visita' && t.corpo.complexo.some((m) => /5 divisões/.test(m)), '5 divisões: complexo, preço depois da visita', t.corpo.complexo);
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: [{ tipo: 'Sala', area: 90, sol: true, ultimo_andar: true }] } }, { e: semChave, cli: null });
ok(t.corpo.complexo.some((m) => /maior aparelho/.test(m)), 'divisão acima do maior aparelho: complexo', t.corpo.complexo);
t = await acao({ acao: 'calcular', dados: { ...sala, servico: 'outro' } }, { e: semChave, cli: null });
ok(t.corpo.modo === 'outro' && !t.corpo.proposta && /sem tabela/.test(t.corpo.complexo[0]), 'outro trabalho: sem proposta, vai para o assistente ou visita', t.corpo);
t = await acao({ acao: 'ler', texto: 'olá' }, { e: semChave, cli: null });
ok(t.status === 503 && /formulário funciona/.test(t.corpo.erro), 'ler sem chave: avisa e o formulário continua', t.corpo);
ok(pedidos.length === nPedidos, 'tabela e calcular não chamam a API');

// 8. ler: o Haiku devolve os campos em JSON; telefone e email não saem
const lido = { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 30, sol: true, ultimo_andar: false }, { tipo: 'Quarto', area: 0, sol: false, ultimo_andar: false }],
  respostas: { ...VAZIAS, pre: 'sim' }, local: 'Moscavide', pedido: 'Ar condicionado na sala e num quarto — já tem tubos', notas: ['Prédio com elevador.'],
  duvidas: [], complexo: false, motivo_complexo: '' };
fila.push({ content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: JSON.stringify(lido) }], stop_reason: 'end_turn' });
t = await acao({ acao: 'ler', texto: 'Boa tarde, sou a Marta (912 345 678, marta@mail.pt). T2 em Moscavide, sala de 30 m2 com muito sol e um quarto, já tenho os tubos na parede.' });
const pl = pedidos.at(-1);
ok(pl.body.model === 'claude-haiku-5-5' && pl.body.output_config?.format?.type === 'json_schema' && pl.body.output_config.effort === 'low' && !pl.body.fallbacks && !pl.body.tools,
  'ler usa o Haiku com saída estruturada, esforço baixo e sem fallbacks', { m: pl.body.model, oc: pl.body.output_config && Object.keys(pl.body.output_config) });
const enviado = pl.body.messages[0].content;
ok(!/912 345 678|marta@mail\.pt/.test(enviado) && /\[telefone\]/.test(enviado) && /\[email\]/.test(enviado), 'telefone e email cortados antes de enviar', enviado);
ok(t.corpo.campos.divisoes.length === 2 && t.corpo.campos.respostas.pre === 'sim' && t.corpo.campos.pedido === 'Ar condicionado na sala e num quarto, já tem tubos', 'campos lidos e limpos', t.corpo.campos);
ok(/área de uma divisão/.test(t.corpo.campos.duvidas[0]) && t.corpo.complexo.length === 0, 'área em falta vira dúvida', t.corpo.campos.duvidas);
fila.push({ content: [{ type: 'text', text: JSON.stringify({ ...lido, servico: 'outro', divisoes: [], complexo: true, motivo_complexo: 'Escritório com condutas no teto falso.' }) }], stop_reason: 'end_turn' });
t = await acao({ acao: 'ler', texto: 'escritório com condutas' });
ok(t.corpo.complexo.includes('Escritório com condutas no teto falso.') && t.corpo.complexo.length === 2, 'caso marcado como complexo, com o motivo', t.corpo.complexo);
fila.push({ content: [{ type: 'text', text: '{"servico": "ac", "divi' }], stop_reason: 'end_turn' });
t = await acao({ acao: 'ler', texto: 'x' });
ok(/à mão/.test(t.corpo.erro), 'leitura estragada: manda preencher à mão', t.corpo);
fila.push({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } });
t = await acao({ acao: 'ler', texto: 'x' });
ok(/à mão/.test(t.corpo.erro), 'recusa na leitura: manda preencher à mão', t.corpo);


// 9. respostas que a API não aceitaria de volta nunca entram no histórico
const pergunta = [{ role: 'user', content: 'Sala 20 m2' }];
fila.push({ content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 'tu_cortado', name: 'calcular_preco', input: {} }], stop_reason: 'max_tokens' });
r = await chama(pergunta);
ok(r.corpo.novas.length === 0 && r.corpo.retirar === 1 && /cortada a meio/.test(r.corpo.erro), 'max_tokens com ferramenta cortada: nada entra, mensagem volta', r.corpo);
fila.push({ content: [], stop_reason: 'end_turn' });
r = await chama(pergunta);
ok(r.corpo.novas.length === 0 && /não respondeu/.test(r.corpo.erro), 'resposta vazia: nada entra', r.corpo);
fila.push({ content: [{ type: 'thinking', thinking: '', signature: 's' }], stop_reason: 'end_turn' });
r = await chama(pergunta);
ok(r.corpo.novas.length === 0, 'só pensamento, sem texto: nada entra', r.corpo);
fila.push({ content: [{ type: 'text', text: 'Resposta comprida…' }], stop_reason: 'max_tokens' });
r = await chama(pergunta);
ok(r.corpo.novas.length === 1 && r.corpo.cortada === true, 'texto cortado sem ferramenta: entra e avisa');
const aMeio = [{ role: 'user', content: 'Prepara a proposta' }, { role: 'assistant', content: [{ type: 'tool_use', id: 'tu1', name: 'calcular_preco', input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu1', content: '{}' }] }];
fila.push({ content: [], stop_reason: 'refusal', stop_details: { type: 'refusal', category: null, explanation: null } });
r = await chama([{ role: 'user', content: 'olá' }, { role: 'assistant', content: [{ type: 'text', text: 'olá' }] }, ...aMeio]);
ok(r.corpo.retirar === 3 && r.corpo.textoRetirado === 'Prepara a proposta', 'recusa a meio das contas: recua o turno inteiro', r.corpo);

// 10. AI Gateway do Netlify: sem chave própria, a conversa vai sem cabeçalho beta nem fallbacks
fila.push({ content: [{ type: 'text', text: 'via gateway' }], stop_reason: 'end_turn' });
r = await chama(pergunta, { e: env({ ANTHROPIC_API_KEY: 'nf-gw', NETLIFY_AI_GATEWAY_KEY: 'nf-gw', ANTHROPIC_BASE_URL: 'http://gw', NETLIFY_AI_GATEWAY_URL: 'http://gw' }) });
const pg = pedidos.at(-1);
ok(r.status === 200 && !pg.body.fallbacks && !pg.body.betas && !/server-side-fallback/.test(pg.headers['anthropic-beta'] || ''), 'gateway: sem fallbacks nem beta', { b: pg.headers['anthropic-beta'], f: pg.body.fallbacks });
fila.push({ content: [{ type: 'text', text: 'direto' }], stop_reason: 'end_turn' });
r = await chama(pergunta, { e: env({ ANTHROPIC_API_KEY: 'sk-da-mdm', NETLIFY_AI_GATEWAY_KEY: 'nf-gw' }) });
ok(pedidos.at(-1).body.fallbacks === 'default', 'chave própria: com fallbacks');
fila.push({ __status: 404, __tipo: 'not_found_error', __msg: 'model: claude-opus-5-5' });
r = await chama(pergunta);
ok(r.status === 502 && /modelo claude-opus-5-5 não está disponível/.test(r.corpo.erro), 'modelo indisponível: mensagem clara', r.corpo);
fila.push({ __status: 401, __tipo: 'authentication_error', __msg: 'bad key' });
r = await acao({ acao: 'ler', texto: 'sala' }, { e: env({ ANTHROPIC_API_KEY: 'nf-gw', NETLIFY_AI_GATEWAY_KEY: 'nf-gw' }) });
ok(r.status === 502 && /AI Gateway do Netlify recusou/.test(r.corpo.erro) && /à mão/.test(r.corpo.erro), 'gateway recusa na leitura: mensagem clara', r.corpo);

// 11. dados pessoais cortados em vários formatos, também na conversa
const pessoais = 'Ligue 91 234 56 78 ou +351 912345678 ou 218.935.050, email marta.silva@mail.com.pt, NIF 123 456 789, contribuinte: 501234567, 1990 426 Lisboa, 2700-123. Sala de 25 m2.';
fila.push({ content: [{ type: 'text', text: JSON.stringify({ servico: 'ac', divisoes: [], respostas: VAZIAS, local: '', pedido: '', notas: [], duvidas: [], complexo: false, motivo_complexo: '' }) }], stop_reason: 'end_turn' });
await acao({ acao: 'ler', texto: pessoais });
const saiu = pedidos.at(-1).body.messages[0].content;
ok(!/\d{3}[\s.]?\d{3}|@|1990|2700/.test(saiu.replace('25 m2', '')) && /Sala de 25 m2/.test(saiu), 'telefones, email, NIF e códigos postais cortados', saiu);
fila.push({ content: [{ type: 'text', text: 'ok' }], stop_reason: 'end_turn' });
await chama([{ role: 'user', content: 'Cliente 912 345 678, sala de 20 m2' }]);
ok(pedidos.at(-1).body.messages[0].content === 'Cliente [telefone], sala de 20 m2', 'conversa também corta o telefone', pedidos.at(-1).body.messages[0].content);

// 12. senha com caracteres fora do ISO-8859-1 (codificada pela página)
const reqS = (s) => new Request('http://x/api/proposta', { method: 'POST', headers: { 'x-mdm-senha': s }, body: '{"acao":"tabela"}' });
ok((await atende(reqS(encodeURIComponent('prumo€“2026”')), env({ MDM_EQUIPA_SENHA: 'prumo€“2026”' }), cliente)).status === 200, 'senha com € e aspas curvas entra');
ok((await atende(reqS('%E0%A4%A'), env(), cliente)).status === 401, 'senha mal codificada: 401, sem rebentar');

// 13. complexidade a partir do pedido (mais de 8 divisões, áreas acima de 200 m², divisões ainda sem área)
const quartos = (n, area = 10) => Array.from({ length: n }, () => ({ tipo: 'Quarto', area, sol: false, ultimo_andar: false }));
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: quartos(9) } });
ok(t.corpo.complexo.some((m) => /São 9 divisões/.test(m)), '9 divisões (o cálculo pára): continua complexo', t.corpo);
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: [{ tipo: 'Sala', area: 250, sol: false, ultimo_andar: false }] } });
ok(t.corpo.complexo.some((m) => /mais de 200 m²/.test(m)), 'área acima de 200 m²: complexo', t.corpo);
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: [{ tipo: 'Sala', area: 250, sol: false, ultimo_andar: false }, ...quartos(1, 12)] } });
ok(t.corpo.modo === 'visita' && t.corpo.complexo.some((m) => /Há uma divisão com mais de 200 m²/.test(m)), 'divisão acima de 200 m² com outra: preço depois da visita, não o da outra sozinha', t.corpo);
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: quartos(2), contagem: { divisoes: 6, acimaDaArea: 1 } } });
ok(t.corpo.complexo.some((m) => /São 6 divisões/.test(m)) && t.corpo.complexo.some((m) => /mais de 200 m²/.test(m)), 'contagem da página entra na complexidade', t.corpo.complexo);
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: quartos(5) } });
ok(!t.corpo.resultado.perguntas_por_responder, 'caso visita: não manda fazer perguntas', t.corpo.resultado);

// 14. contacto com o marcador do corte fica vazio na proposta do assistente
fila.push(usa('preparar_proposta', { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20, sol: false, ultimo_andar: false }], respostas: VAZIAS,
  cliente: { nome: 'Rui', contacto: '[telefone]', local: '' }, pedido: 'Sala', observacoes: [] }));
r = await chama([{ role: 'user', content: 'x' }]);
ok(r.corpo.propostas[0].cliente.contacto === '', 'contacto «[telefone]» não vai para a proposta', r.corpo.propostas[0].cliente);

// 15. corte: formatos portugueses cortados, medidas e BTU intactos
const cortar = ['+351912345678', '00351912345678', '351912345678', '91 234 56 78', '912.345.678', '218 935 050', '21 893 50 50', 'NIF 123 456 789', '123 456 789',
  'contribuinte: 501234567', '1990-426, Lisboa', '1990 426, Lisboa', 'cp 1990 426', 'CP: 1990-426', 'Rua X, 2700-123.', 'a@b.pt',
  // outros agrupamentos e formatos que passavam
  '91 234 5678', '21 893 5050', '+351 21 893 5050', '91 2345678', 'NIF 123-456-789', '2700 123 amadora', 'joão.silva@gmail.com',
  '912 34 56 78', '91-234-56-78', '+351 2189 35050', '00351 91 234 5678', 'tel. 21 8935050', '123-456-789', '1990 426 Lisboa',
  'Rua das Flores 12 2700 123 amadora', 'Morada: 2700 123 amadora',
  // a localidade em minúsculas numa morada: com o andar ou a porta antes, a meio da frase, numa linha só sua, depois de outro dado
  'Rua X 12 2º esq 2700 123 amadora', 'Rua X 12 r/c 2700 123 amadora', 'Rua X 12 1ºdto 2700 123 amadora', 'Av X 3 3ºB 2700 123 amadora',
  'Rua X 12 - 2700 123 amadora', 'moro em 2700 123 amadora', 'nº 5 2700 123 amadora', 'Rua X 12\n2700 123 amadora', 'Marta, 912 345 678, 2700 123 amadora',
  // telefone seguido de uma palavra que só começa como uma unidade («Eurico»), e com +351 antes de € ou de uma unidade
  'Ligue para 91 234 56 78 Eurico', 'Contacto: 21 893 50 50 Eurídice', '00351912345678 Eurico', '+351 21 893 5050 Eurico', '93 123 4567 eurico',
  '91 2345678 Eurico', 'Tel 21 893 5050 Euro Clima', '+351 912 345 678 Eurico Silva', '+351 912 345 678 €', '00351912345678 eur', '+351 289 123 456 BTU',
  // a localidade abreviada, com maiúscula ou numa morada; depois de outro dado entre parênteses ou traços; com um marcador de lista
  'Morada: Rua Y 5, 2690 123 S. João da Talha', 'Rua X 12, 2775 123 S. Domingos de Rana', '2765 123 S. João do Estoril', '2765 123 S.João do Estoril',
  'Rua X 1, 2690 123 s. joão da talha', 'Marta (912 345 678) 2700 123 amadora', 'Marta - 912 345 678 - 2700 123 amadora', 'joao@x.pt / 2700 123 amadora',
  'Dados:\n- 2700 123 amadora', '• 2700 123 amadora', 'Vivo em 2700 123 amadora', 'Urb. X lote 3 2700 123 amadora', 'Tv. do Sol 3, 1200 123 lisboa',
  '2700-123 Eurico Silva'];
const manter = ['Sala de 25 m2 e quarto de 12,5 m2', 'Máquinas de 9000 12000 e 18000 BTU', 'BTU 7000 9000 12000', 'Visita 2026-10-09 14:30', 'Desde 1991, prédio de 1990',
  'entre 1000-500 €', 'orçamento 1000-1500 euros', 'Sala 3x4 metros, 2.º andar, 9 m de tubo', 'Preço 1 050 € a 1 400 €', '24000 BTU/h e 18000 BTU/h',
  // pares de números que um corte mais largo apanharia
  'Máquinas de 24000 9000 e 7000 BTU', 'Visita 2026-10-09 9:30', 'Duas de 9 000 12 000 BTU', 'orçamento 2500-12000 €', 'entre 1000 500 euros',
  '12000 9000 7000', '9 000 12 000 18 000', 'entre 2000 300 com IVA', 'Total mais de 36 000 BTU/h (10,6 kW)', '22 000 BTU',
  // datas com a hora (dia 20 a 29) e contas no meio de uma frase
  'Visita 21-10-2026 9:30', 'Visita 21.10.2026 9h', 'dia 22-10-2026 9:00', '23 10 2026 9h', 'em 2019 500 casas', 'há 2000 123 clientes', 'faturou 1000 200 mil',
  // contas fora de uma morada, também depois de dois pontos, de um parêntese ou no início do texto
  'Ano: 2024 300 instalações', '(2019 500 casas)', 'Sala 25 m², 1000 500 watts', '2026 100 visitas', 'Total: 2024 300 unidades', '2019 500 casas feitas',
  'Contas:\n1000 200 mil',
  // milhares com espaço antes de uma unidade (o telefone sem +351 não se corta antes de €, eur, euros, BTU, kW, kWh, m2, m²)
  'Máquinas de 24 000 9 000 BTU', 'Duas de 24 000 9 000 BTU/h', 'Total 21 000 9 000 kW', 'Total 24 000 9 000 euros',
  // uma abreviatura em minúsculas fora de uma morada não é localidade
  'Foram 2019 500 m. de tubo'];
ok(cortar.every((x) => !/\d{3}|@/.test(redige(x))), 'corte: todos os formatos de dados pessoais', cortar.map(redige));
ok(manter.every((x) => redige(x) === x), 'corte: medidas, BTU, datas e preços ficam', manter.filter((x) => redige(x) !== x).map(redige));
ok(redige('Ligue para 91 234 56 78 Eurico') === 'Ligue para [telefone] Eurico' && redige('+351 912 345 678 Eurico Silva') === '[telefone] Eurico Silva'
  && redige('Morada: Rua Y 5, 2690 123 S. João da Talha') === 'Morada: Rua Y 5, [código postal] S. João da Talha',
  'corte: telefone antes de «Eurico» e código postal antes de «S. João» saem inteiros', ['Ligue para 91 234 56 78 Eurico', '+351 912 345 678 Eurico Silva'].map(redige));
ok(redige('joão.silva@gmail.com') === '[email]' && redige('Email: joão.silva@gmail.com.') === 'Email: [email].', 'corte: email com acentos sai inteiro', redige('joão.silva@gmail.com'));

// 16. marcadores nunca chegam à proposta (local, pedido, notas, contacto)
fila.push(usa('preparar_proposta', { servico: 'ac', divisoes: [{ tipo: 'Sala', area: 20, sol: false, ultimo_andar: false }], respostas: VAZIAS,
  cliente: { nome: 'Rui', contacto: 'Telefone: [telefone]', local: 'Rua das Flores 12, [código postal] Lisboa' }, pedido: 'Sala, contacto [telefone]',
  observacoes: ['Ligar antes para [telefone].', 'Máquina na varanda.'] }));
r = await chama([{ role: 'user', content: 'x' }]);
const pm16 = r.corpo.propostas[0];
ok(pm16.cliente.contacto === '' && pm16.cliente.local === 'Rua das Flores 12, Lisboa' && pm16.pedido === 'Sala, contacto' && pm16.observacoes.join('|') === 'Máquina na varanda.' && !/\[/.test(pm16.texto),
  'marcadores fora da proposta', { c: pm16.cliente, p: pm16.pedido, o: pm16.observacoes });

// 17. a leitura devolve o motivo da IA à parte dos calculados
fila.push({ content: [{ type: 'text', text: JSON.stringify({ servico: 'ac', divisoes: quartos(5), respostas: VAZIAS, local: '', pedido: '', notas: [], duvidas: [], complexo: true, motivo_complexo: 'Prédio antigo com fachada protegida.' }) }], stop_reason: 'end_turn' });
t = await acao({ acao: 'ler', texto: 'cinco quartos' });
ok(t.corpo.complexoIA.length === 1 && t.corpo.complexoIA[0] === 'Prédio antigo com fachada protegida.' && t.corpo.complexo.some((m) => /5 divisões/.test(m)), 'motivo da IA à parte', t.corpo);

// 18. formulário com a tabela real vazia: a potência de cada divisão e o total, os motivos, e nenhum preço nem proposta
t = await acao({ acao: 'calcular', dados: { ...sala, divisoes: [{ tipo: 'Sala', area: 25, sol: false, ultimo_andar: false }, { tipo: 'Sala', area: 90, sol: false, ultimo_andar: false }] } },
  { e: env({ MDM_PRECOS: '' }), cli: null });
ok(t.corpo.modo === 'sem_tabela' && /^Sala 25 m²: 12 000 BTU\/h · Sala 90 m²: mais de 24 000 BTU\/h, a dimensionar na visita · Total mais de 36 000 BTU\/h/.test(t.corpo.resultado.potencia || ''),
  'tabela vazia: potência de cada divisão e o total', t.corpo.resultado);
ok(t.corpo.complexo.some((m) => /Ainda não há preços/.test(m)) && t.corpo.complexo.some((m) => /maior aparelho/.test(m)), 'tabela vazia: sem preços e acima do maior aparelho', t.corpo.complexo);
ok(!t.corpo.proposta && !/€/.test(JSON.stringify(t.corpo)), 'tabela vazia: nenhum preço inventado, nenhuma proposta', t.corpo);

// 19. marcas e assinaturas fora das propostas (data/regras-marcas.json e as regras do build.py), sem distinguir maiúsculas
t = await acao({ acao: 'calcular', dados: { ...sala, pedido: 'Ar condicionado Carrier na sala', observacoes: ['Máquina Carrier antiga.', 'Prefere hisense.',
  'Grelhas France Air, os Arquitectos do Ar.', 'Fatura a M.D.M. — Manuel Domingos Melancia.', 'Mitsubishi Heavy na varanda.', 'Máquina Mitsubishi Electric na sala.'] } });
const rec = t.corpo.notasRecusadas || [];
ok(t.corpo.proposta?.observacoes.join('|') === 'Máquina Mitsubishi Electric na sala.', 'só a nota com uma marca permitida entra', t.corpo.proposta?.observacoes);
ok(['Carrier antiga', 'hisense', 'Arquitectos do Ar', 'M.D.M.', 'Mitsubishi Heavy'].every((m) => rec.some((x) => x.includes(m) && /marca|assinatura|nome legal/.test(x))),
  'Carrier, hisense, «os Arquitectos do Ar», o nome legal com travessão e Mitsubishi Heavy recusados', rec);
ok(t.corpo.proposta?.pedido === '' && rec.some((x) => /^pedido: marca/.test(x)), 'pedido com uma marca proibida fica de fora', { p: t.corpo.proposta?.pedido, rec });
fila.push({ content: [{ type: 'text', text: JSON.stringify({ servico: 'ac', divisoes: [], respostas: VAZIAS, local: '', pedido: 'Trocar a máquina HISENSE da sala',
  notas: ['Máquina Carrier antiga.', 'Grelhas com os Arquitectos do Ar.', 'Prédio com elevador.'], duvidas: [], complexo: false, motivo_complexo: '' }) }], stop_reason: 'end_turn' });
t = await acao({ acao: 'ler', texto: 'sala' });
ok(t.corpo.campos.notas.join('|') === 'Prédio com elevador.' && t.corpo.campos.pedido === '', 'leitura: notas e pedido com marcas ou a assinatura ficam de fora', t.corpo.campos);
const recL = t.corpo.recusadas || [];
ok(recL.length === 3 && /^«Máquina Carrier antiga\.»: marca/.test(recL[0]) && /^«Grelhas com os Arquitectos do Ar\.»: assinatura/.test(recL[1]) && /^pedido: marca/.test(recL[2]),
  'leitura: o que fica de fora vem com o motivo', recL);

// 20. as palavras de uma marca proibida juntas por um traço qualquer, por outro espaço ou por nada também ficam de fora (a
//     mesma junção do build.py); as permitidas e as palavras parecidas entram
const entraNota = async (n) => ((await acao({ acao: 'calcular', dados: { ...sala, observacoes: [n] } })).corpo.proposta?.observacoes || []).length === 1;
const marcasJuntas = ['Saunier-Duval antiga', 'SaunierDuval', 'Soler&Palau', 'Olimpia-Splendid', 'Mitsubishi-Heavy', 'mitsubishiheavy', 'SOLER-&-PALAU',
  'Saunier\u2010Duval', 'Saunier\u2011Duval', 'Saunier\u2012Duval', 'Saunier\u2013Duval', 'Saunier \u2014 Duval', 'Saunier\u2015Duval', 'Saunier\u2212Duval', 'Saunier\ufe58Duval',
  'Saunier\ufe63Duval', 'Saunier\uff0dDuval', 'Saunier\u00a0Duval', 'Saunier\nDuval'];
const entraram = []; for (const n of marcasJuntas) if (await entraNota(n)) entraram.push(n);
ok(!entraram.length, 'marcas com traços, outros espaços ou sem espaço entre as palavras: recusadas', entraram);
const permitidas = ['Máquina Mitsubishi Electric na sala.', 'Mitsubishi-Electric', 'Daikin e Midea', 'France Air', 'Sharpe', 'Algarve', 'Green', 'algés'];
const recusadas = []; for (const n of permitidas) if (!(await entraNota(n))) recusadas.push(n);
ok(!recusadas.length, 'marcas permitidas e palavras parecidas entram', recusadas);

srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${oks} ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
