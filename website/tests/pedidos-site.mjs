/* Testa a função submission-created (netlify/functions/submission-created.mts) sem rede: um fetch falso faz de Supabase.
   Confirma que só os dois formulários de pedido entram, os campos que vão para pedido_do_site e que a falta da chave
   ou um erro do Supabase não rebentam. Uso, a partir de website/:  npm install && node tests/pedidos-site.mjs */
import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdm-site-'));
const saida = path.join(tmp, 'sub.mjs');
await build({ entryPoints: [path.join(W, 'netlify/functions/submission-created.mts')], bundle: true, platform: 'node', format: 'esm', outfile: saida, logLevel: 'error' });
const { regista, camposDe, tipoDe, handler } = await import(saida);

let falhas = 0, oks = 0;
const ok = (c, msg, extra) => { if (c) oks++; else { falhas++; console.log('FALHA ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra).slice(0, 400) : '')); } };

const mensagem = ['Referência: 261125-2050-AB12', 'Pedido: Avaria', 'Solução: Ar condicionado', 'Espaço: Casa / apartamento', 'Localidade: Lisboa, Olivais', 'Língua do site: português', '', 'Detalhes:', 'Pinga água'].join('\n');
const envio = { payload: { form_name: 'orcamento', data: { 'form-name': 'orcamento', nome: 'Ana Silva', telefone: '912345678', email: 'ana@exemplo.pt', servico: 'Avaria: Ar condicionado', triagem: '[P4 · Avaria AC]', mensagem } } };

// campos
const c = camposDe('orcamento', envio.payload.data, 'K');
ok(c.p_referencia === '261125-2050-AB12', 'referência', c.p_referencia);
ok(c.p_localidade === 'Lisboa, Olivais', 'localidade', c.p_localidade);
ok(c.p_tipo === 'reparacao', 'avaria vira reparacao', c.p_tipo);
ok(c.p_cliente === 'Ana Silva' && c.p_telefone === '912345678' && c.p_email === 'ana@exemplo.pt', 'contactos', c);
ok(c.p_descricao.includes('Pinga água') && c.p_descricao.includes('Triagem do site'), 'descrição', c.p_descricao);
ok(tipoDe('Instalação: Ar condicionado', '') === 'instalacao' && tipoDe('Manutenção: Ventilação', '') === 'manutencao' && tipoDe('Aconselhamento: Outro', '') === null, 'tipos');

// chamada ao Supabase
let chamadas = [];
const falso = (status, corpo) => async (url, init) => { chamadas.push({ url, init }); return new Response(corpo, { status }); };
let r = await regista(JSON.stringify(envio), 'K', falso(200, '"PED0001_2026"'));
ok(r.ok && r.id === 'PED0001_2026', 'regista devolve o número', r);
ok(chamadas[0].url.endsWith('/rest/v1/rpc/pedido_do_site'), 'chama pedido_do_site', chamadas[0].url);
ok(JSON.parse(chamadas[0].init.body).p_chave === 'K', 'manda a chave');

chamadas = [];
r = await regista(JSON.stringify({ payload: { form_name: 'newsletter', data: {} } }), 'K', falso(200, '"x"'));
ok(r.ok && chamadas.length === 0, 'ignora outros formulários', r);
r = await regista(JSON.stringify(envio), undefined, falso(200, '"x"'));
ok(!r.ok && chamadas.length === 0, 'sem chave não chama', r);
r = await regista(JSON.stringify(envio), 'K', falso(403, 'sem permissão'));
ok(!r.ok && /403/.test(r.motivo), 'erro do Supabase volta como motivo', r);
r = await regista('não é json', 'K', falso(200, '"x"'));
ok(!r.ok, 'corpo inválido');

// o handler responde sempre 200 (o cliente nunca vê erro por causa do registo)
const h = await handler({ body: 'não é json' });
ok(h.statusCode === 200, 'handler responde 200 com erro');

console.log(`pedidos-site: ${oks} ok, ${falhas} falhas`);
process.exit(falhas ? 1 : 0);
