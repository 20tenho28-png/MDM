/* Motor de orçamentos do registo (registo/orcamento-motor.js: motor.js, fluxo.js e documento.js do pacote
   «mdm-orcamentos-offline»), com uma configuração INVENTADA: empresa, fatores, margens, tarifas e catálogo de teste,
   nunca os preços da MDM (esses estão só na base de dados, config «orcamento_motor»). Sem rede nem dependências.
   Os valores esperados estão contados à mão ao lado de cada caso. Também confirma que o registo (registo/index.html)
   tem as mesmas regras do fluxo.js: feriados, prioridade e numeração.
   Uso, a partir de website/:  node tests/orcamento-motor.mjs   (o build.py --check corre-o quando há node) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const motorJs = fs.readFileSync(path.join(W, 'registo/orcamento-motor.js'), 'utf8');
const html = fs.readFileSync(path.join(W, 'registo/index.html'), 'utf8');
// Os feriados fixos são os do registo (o fluxo.js recebe-os da configuração; os da Páscoa calcula-os).
const FIXOS_REG = JSON.parse(((/  const FIXOS = (\[[^\]]*\])/.exec(html) || [])[1] || '[]').replace(/'/g, '"'));

let ok = 0, ko = 0;
const conta = (nome, certo, extra) => { if (certo) ok++; else { ko++; console.log('FALHA', nome, extra === undefined ? '' : JSON.stringify(extra)); } };
const perto = (nome, atual, esperado) => conta(nome, typeof atual === 'number' && Math.abs(atual - esperado) < 0.006, {obtido: atual, esperado});
const lanca = (nome, f, re) => { try { f(); conta(nome, false, 'não deu erro'); } catch (e) { conta(nome, re.test(String(e && e.message)), String(e && e.message)); } };

// A configuração inventada (o mesmo formato do JSON de Definições › «Orçamento: motor de preços»).
const CFG = () => ({
  EMPRESA: { nome: 'Empresa de Teste, Lda', morada: ['Rua do Teste 1', '1000-000 Lisboa'], nif: '500000000', tel: '210000000',
    email: 'teste@exemplo.pt', iban: 'IBAN DE TESTE', rodape: 'Rodapé de teste', emitidoPor: 'TT',
    assinatura: ['Pessoa de Teste', 'Empresa de Teste, Lda', 'Tel.: 21 000 0000 | Telemóvel: 900 000 000'] },
  CONFIG: {
    iva: 0.23,
    fatorDesconto: { MITSUBISHI: 0.5, DAIKIN: 0.5, MIDEA_MULTI: 0.5, MIDEA_MONO: 0.4, FRANCE_AIR: 0.5 },
    margemEquip: { MITSUBISHI: 1.25, DAIKIN: 1.25, MIDEA: 1.5, FRANCE_AIR: 1.4 },
    margemMaoObra: 1.5, margemMaterial: 1.25,
    tabelasMaoObra: { ORC0034: { cm: 10, lf: 10, desloc: 10 }, T2026: { cm: 20, lf: 15, desloc: 5 } },
    horasPorMaquina: { cm: 4, lf: 4, desloc: 1 },
    sopragemAzotoHorasCM: 2,
    material: { cobre: { '1/4': 1, '3/8': 2, '1/2': 3, '5/8': 4 }, amortecedor: { desc: 'Amortecedor de teste', custo: 5 }, kit: { desc: 'Kit de fixação de teste', custo: 10 } },
    manutencao: { horaTecnico: 30, horaAjudante: 20, zonas: { Centro: { equipa: 60, tecnico: 45 }, Longe: { equipa: 80 } }, margemMaterial: 1.5 },
    textos: { validade: '30 Dias', pagamentoInstalacao: 'Metade na adjudicação, metade no fim (teste).', pagamentoManutencao: 'Pronto pagamento (teste).',
      horario: 'Horário de teste', exclusoes: 'Exclusões da instalação (teste).', exclusoesManutencao: 'Exclusões da manutenção (teste).', notaSubstituicao: 'Nota da substituição (teste).' },
  },
  CATALOGO: [
    { marca: 'MIDEA', gama: 'mono', tipo: 'conj', ref: 'TM-09', modelo: 'Teste Mono 09', btu: 9000, tabela: 1000, kw: [2.5, 2.8], tubo: ['1/4', '3/8'] },
    { marca: 'MIDEA', gama: 'multi', tipo: 'ext', ref: 'TX-3', modelo: 'Teste Exterior 3', btu: 24000, tabela: 2000, kw: [7, 8], saidas: 3, saidaMeia: 1 },
    { marca: 'MIDEA', gama: 'multi', tipo: 'int', ref: 'TI-09', modelo: 'Teste Interior 09', btu: 9000, tabela: 200, tubo: ['1/4', '3/8'] },
    { marca: 'MIDEA', gama: 'multi', tipo: 'int', ref: 'TI-18', modelo: 'Teste Interior 18', btu: 18000, tabela: 300, tubo: ['1/4', '1/2'] },
    { marca: 'FRANCE_AIR', gama: 'any', tipo: 'int', ref: 'FI-24', modelo: 'Teste FA 24', btu: 24000, tabela: 400, tubo: ['3/8', '5/8'] },
    { marca: 'FRANCE_AIR', gama: 'mono', tipo: 'ext', ref: 'FE-24', modelo: 'Teste FA Ext 24', btu: 24000, tabela: 600 },
    { marca: 'MITSUBISHI', gama: 'mono', tipo: 'conj', ref: 'MC-12', modelo: 'Teste Mitsu 12', btu: 12000, custo: 500, kw: [3.5, 4] },
  ],
  COMBINACOES: { 'TX-3': [[9000, 9000, 9000], [9000, 9000, 12000]] },
  FERIADOS_FIXOS: FIXOS_REG,
  PRAZOS: { orcamento_por_fazer: { unidade: 'dias', P1: 1, P2: 2, P3: 3 } },
});
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(motorJs, ctx, { filename: 'orcamento-motor.js' });
const MDM = ctx.MDM;
Object.assign(MDM, CFG());
const { calcInstalacao, calcManutencao, validarMulti, eur } = MDM.motor;
const linha = (r, re) => r.linhas.find((l) => re.test(l.desc));

// 1. Monosplit (conjunto do catálogo), tubagem reaproveitada, tabela ORC0034:
//    equipamento 1000 × 0,4 = 400 (venda × 1,5 = 600); mão de obra 4 h CM + 4 h LF + 1 deslocação a 10 = 90, mais a
//    sopragem 2 h CM = 20 (110, venda × 1,5 = 165); amortecedor 5 + kit 10 = 15 (venda × 1,25 = 18,75).
let r = calcInstalacao({ marca: 'MIDEA', gama: 'mono', equipamento: [{ ref: 'TM-09' }], interiores: [{ btu: 9000 }], reaproveitaTubagem: true });
perto('mono: custo', r.custo, 525); perto('mono: venda sem IVA', r.semIva, 783.75); perto('mono: IVA', r.iva, 180.26); perto('mono: com IVA', r.comIva, 964.01);
conta('mono: sem cobre, com a sopragem a azoto', !r.linhas.some((l) => /Cobre/.test(l.desc)) && linha(r, /Sopragem/).qtd === 2, r.linhas.map((l) => l.desc));
conta('mono: dias = interiores', r.dias === 1);

// 2. Multisplit com os diâmetros do catálogo (liq/gas de cada interior): 1/4 em 20 m, 3/8 em 10 m (os dois 9000),
//    1/2 em 10 m (o 18000). Equipamento 2000 × 0,5 + 2 × 100 + 150 = 1350 (× 1,5 = 2025); 3 dias: 12 + 12 h a 10 e
//    3 deslocações = 270 (× 1,5 = 405); material 5 + 20 + 20 + 30 + 30 = 105 (× 1,25 = 131,25).
const ints = [{ btu: 9000, metros: 5, liq: '1/4', gas: '3/8' }, { btu: 9000, metros: 5, liq: '1/4', gas: '3/8' }, { btu: 18000, metros: 10, liq: '1/4', gas: '1/2' }];
r = calcInstalacao({ marca: 'MIDEA', gama: 'multi', equipamento: [{ ref: 'TX-3' }, { ref: 'TI-09', qtd: 2 }, { ref: 'TI-18' }], interiores: ints });
perto('multi: custo', r.custo, 1725); perto('multi: venda', r.semIva, 2561.25);
conta('multi: cobre por diâmetro', linha(r, /1\/4$/).qtd === 20 && linha(r, /3\/8$/).qtd === 10 && linha(r, /1\/2$/).qtd === 10, r.linhas.map((l) => [l.desc, l.qtd]));
conta('multi: equipamento do multi com o fator multi (2000 × 0,5)', linha(r, /Teste Exterior 3/).custoUnit === 1000);
conta('multi: 9000+9000+18000 fora das combinações dá aviso', r.avisos.length === 1 && /Combinação 9000\+9000\+18000 BTU não validada para TX-3/.test(r.avisos[0]), r.avisos);
conta('validarMulti: saídas a mais e 18000 a mais para as saídas de 1/2', (() => { const a = validarMulti('TX-3', [9000, 9000, 18000, 18000], 'MIDEA'); return a.some((x) => /só tem 3 saídas/.test(x)) && a.some((x) => /redutor/.test(x)); })());
conta('validarMulti: sem tabela de combinações', /Sem tabela de combinações para FI-24/.test(validarMulti('FI-24', [9000, 9000], 'FRANCE_AIR')[0]));

// 3. Tubo do catálogo: o interior de 24000 da France Air tem 3/8 + 5/8; sem liq/gas o motor punha 1/4 + 1/2.
r = calcInstalacao({ marca: 'FRANCE_AIR', gama: 'mono', equipamento: [{ ref: 'FI-24' }, { ref: 'FE-24' }], interiores: [{ btu: 24000, metros: 5, liq: '3/8', gas: '5/8' }] });
conta('tubo do catálogo: 3/8 e 5/8', !!linha(r, /3\/8$/) && !!linha(r, /5\/8$/) && !linha(r, /1\/4$/), r.linhas.map((l) => l.desc));
const sem = calcInstalacao({ marca: 'FRANCE_AIR', gama: 'mono', equipamento: [{ ref: 'FI-24' }, { ref: 'FE-24' }], interiores: [{ btu: 24000, metros: 5 }] });
conta('sem o tubo: 1/4 e 1/2 (o padrão do motor)', !!linha(sem, /1\/4$/) && !!linha(sem, /1\/2$/));
perto('tubo do catálogo sai mais caro (2 + 4 contra 1 + 3 por metro)', (r.custo - sem.custo), 5 * (2 + 4 - 1 - 3));

// 4. Tabela T2026, margem única de 20 %, mão de obra e material a mais: equipamento 400 × 0,5 + 600 × 0,5 = 500;
//    mão de obra 4 × 20 + 4 × 15 + 1 × 5 = 145, mais 2 × 15 = 30; material 5 + 10 + 20 + 10 + 3 × 4 = 57; custo 732.
r = calcInstalacao({ marca: 'FRANCE_AIR', gama: 'mono', tabelaMO: 'T2026', margemTotal: 0.2, equipamento: [{ ref: 'FI-24' }, { ref: 'FE-24' }],
  interiores: [{ btu: 24000, metros: 5, liq: '3/8', gas: '5/8' }], extraMO: [{ desc: 'Trabalho a mais', qtd: 2, custo: 15 }], extraMaterial: [{ desc: 'Calha', qtd: 3, custo: 4 }] });
perto('T2026 + extras: custo', r.custo, 732); perto('T2026 + extras: margem única × 1,2', r.semIva, 878.4);
conta('margem única em todas as linhas', r.linhas.every((l) => Math.abs(l.margem - 1.2) < 1e-9));

// 5. Valor final fixado, sem equipamento nem exterior: 2 dias (8 + 8 h a 10, 2 deslocações = 180), cobre 20 m de 1/4
//    e 20 m de 3/8 (20 + 40), kit 2 × 10; custo 260 e a venda é o alvo.
r = calcInstalacao({ marca: 'MITSUBISHI', gama: 'mono', equipamento: [], exteriores: 0, dias: 2, valorAlvoSemIva: 500, interiores: [{ metros: 10 }, { metros: 10 }] });
perto('valor fixado: custo', r.custo, 260); perto('valor fixado: venda = alvo', r.semIva, 500);
conta('valor fixado: sem amortecedor (0 exteriores)', !linha(r, /Amortecedor/));

// 6. Equipamento escrito à mão (fora do catálogo): preço de tabela × fator da marca e a margem da marca; a custo, sem fator.
r = calcInstalacao({ marca: 'DAIKIN', gama: 'mono', equipamento: [{ desc: 'Daikin de teste', qtd: 1, tabela: 800 }, { desc: 'Peça a custo', qtd: 2, custo: 50 }], interiores: [{ btu: 9000 }], reaproveitaTubagem: true });
conta('à mão: tabela 800 × 0,5 = 400, venda × 1,25', linha(r, /Daikin de teste/).custoUnit === 400 && Math.abs(linha(r, /Daikin de teste/).venda - 500) < 1e-9);
conta('à mão: a custo, sem fator (2 × 50, venda × 1,25)', linha(r, /Peça a custo/).custoUnit === 50 && Math.abs(linha(r, /Peça a custo/).venda - 125) < 1e-9);
conta('conjunto a custo do catálogo: sem fator', calcInstalacao({ marca: 'MITSUBISHI', gama: 'mono', equipamento: [{ ref: 'MC-12' }], interiores: [{ btu: 12000 }], reaproveitaTubagem: true }).linhas[0].custoUnit === 500);

// 7. Regras que nunca se dobram: modelo sem preço e metros em falta dão erro.
lanca('modelo fora do catálogo: erro', () => calcInstalacao({ marca: 'MIDEA', gama: 'mono', equipamento: [{ ref: 'NAO-EXISTE' }], interiores: [{ btu: 9000 }], reaproveitaTubagem: true }), /Modelo sem preço no catálogo: NAO-EXISTE/);
lanca('tubagem nova sem metros: erro', () => calcInstalacao({ marca: 'MIDEA', gama: 'mono', equipamento: [{ ref: 'TM-09' }], interiores: [{ btu: 9000 }] }), /Falta o comprimento de tubagem do interior 1/);

// 8. Manutenção: Centro, equipa, 3 h (1.ª hora 60, mais 2 h de técnico a 30 e de ajudante a 20), material 10 × 1,5 = 15.
let m = calcManutencao({ zona: 'Centro', horas: 3, materiais: [{ desc: 'Filtro', qtd: 1, custo: 10 }] });
perto('manutenção: venda', m.semIva, 175); perto('manutenção: com IVA', m.comIva, 215.25);
// Só técnico, 2 h, total pretendido 123 € com IVA: 100 sem IVA, menos 1 h de técnico (30) = 1.ª hora 70.
m = calcManutencao({ zona: 'Centro', soTecnico: true, horas: 2, alvoComIva: 123 });
perto('manutenção com alvo: 1.ª hora ajustada', m.linhas[0].custoUnit, 70); perto('manutenção com alvo: com IVA', m.comIva, 123);
conta('manutenção só técnico: sem linha do ajudante', !linha(m, /Ajudante/));
lanca('zona sem 1.ª hora de técnico: erro', () => calcManutencao({ zona: 'Longe', soTecnico: true, horas: 1 }), /Zona sem valor de 1\.ª hora/);

// 9. Emails: o de manutenção em inglês com as tarifas da configuração (não as do pacote).
const em = (ingles) => MDM.documento.emailManutencao({ tratamento: 'Cliente de Teste', equipamentos: ['1 split'], primeiraHora: 60, soTecnico: false, morada: 'Rua do Teste 1', ingles });
conta('email PT: tarifas da configuração', /Hora Técnico: 30,00 € \+ IVA/.test(em(false)) && /Hora Ajudante: 20,00 € \+ IVA/.test(em(false)));
conta('email EN: tarifas da configuração', /Technician, per hour: 30\.00 € \+ VAT/.test(em(true)) && /Assistant, per hour: 20\.00 € \+ VAT/.test(em(true)) && /travel: 60\.00 € \+ VAT/.test(em(true)), em(true));
MDM.CONFIG.manutencao.horaTecnico = 31.5;
conta('email EN: muda com a tarifa', /Technician, per hour: 31\.50 € \+ VAT/.test(em(true)));
MDM.CONFIG.manutencao.horaTecnico = 30;
conta('email de envio com a assinatura', /Pessoa de Teste/.test(MDM.documento.emailEnvio({ tratamento: 'Cliente', numero: '0001/2026', descricao: 'teste' })));

// 10. Folha ORC0068: formato PT, as outras opções com o texto dado, o desconto à vista (Total Desc).
const doc = MDM.documento.renderORC({ numero: '0007/2026', data: '2026-10-22', cliente: { nome: 'Cliente de Teste', morada: ['Rua A 1'], nif: '' }, proposta: 'Proposta de teste.',
  principal: { calc: { semIva: 1000, iva: 230, comIva: 1230, bruto: 1100, desc: 100 }, texto: '- Marca: TESTE\n- Modelo: Teste Mono 09' },
  opcoes: [{ calc: { semIva: 1234.56, iva: 283.95, comIva: 1518.51 }, texto: 'Gama de teste · Daikin\nDaikin de teste' }],
  pagamento: 'Pagamento de teste.', prazo: '2 dias' });
conta('ORC0068: data e euros em PT', /22\/10\/2026/.test(doc) && /1\.518,51 €/.test(doc));
conta('ORC0068: a outra opção mostra o texto dado', /OPÇÃO:<br>Gama de teste · Daikin<br>Daikin de teste/.test(doc), (doc.match(/OPÇÃO:[^<]*<br>[^<]*/) || [''])[0]);
conta('ORC0068: Total Ilíquido antes do desconto e Total Desc', /Total Ilíquido<\/td><td class="v">1\.100,00 €/.test(doc) && /Total Desc<\/td><td class="v">100,00 €/.test(doc) && /Total<\/td><td class="v">1\.230,00 €/.test(doc));
conta('ORC0068: sem desconto, Total Desc a zero', /Total Desc<\/td><td class="v">0,00 €/.test(MDM.documento.renderORC({ numero: '1', data: '2026-01-02', cliente: { nome: 'X' }, proposta: 'P', principal: { calc: { semIva: 10, iva: 2.3, comIva: 12.3 }, marcaTexto: 'M', tipoTexto: 'T', modeloTexto: 'X' } })));
conta('ORC0068: empresa e textos da configuração', /Empresa de Teste, Lda/.test(doc) && /Exclusões da instalação \(teste\)/.test(doc) && /Horário de teste/.test(doc) && /2 dias/.test(doc));
conta('eur: milhares com ponto e vírgula decimal', eur(1234567.891) === '1.234.567,89 €' && eur(0) === '0,00 €');

// 11. Fluxo: Páscoa, feriados, dias úteis, prioridade e numeração, e o registo com as mesmas regras.
const F = MDM.fluxo;
conta('Páscoa 2027 a 28 de março', F.pascoa(2027).toISOString().slice(0, 10) === '2027-03-28');
conta('Sexta-feira Santa e Corpo de Deus de 2027 são feriados', F.feriados(2027).has('2027-03-26') && F.feriados(2027).has('2027-05-27'));
conta('dias úteis saltam o fim de semana e o 5 de outubro', F.somarDiasUteis('2026-10-02', 1) === '2026-10-06');
conta('prioridade: avaria P1, 3 unidades P2, normal P3', F.prioridadeEntrada({ tipo: 'reparacao' }).P === 'P1' && F.prioridadeEntrada({ tipo: 'instalacao', unidades: 3 }).P === 'P2' && F.prioridadeEntrada({ tipo: 'instalacao' }).P === 'P3');
const ANO = new Date().getFullYear();
const prox = F.proximoNumero([{ ano: ANO, seq: 81 }, { ano: ANO, seq: 82 }, { ano: ANO - 1, seq: 300 }], ANO);
conta('fluxo: próximo número', prox.num === `ORC0083_${ANO}` && prox.docNum === `0083/${ANO}`, prox);
{
  const bloco = /(  const FIXOS = [^\n]*\n[\s\S]*?  function feriados\(y\) \{[\s\S]*?\n  \})/.exec(html);
  const sug = /(function sugerirP\(d\) \{[\s\S]*?\n  \})/.exec(html), num = /(function nextNumber\(\) \{[\s\S]*?\n  \})/.exec(html), n68 = /(const orc68Num = [^\n]*;)\n/.exec(html);
  conta('registo: as funções a comparar estão no index.html', !!(bloco && sug && num && n68) && FIXOS_REG.length >= 10);
  if (bloco && sug && num && n68) {
    const reg = vm.runInNewContext(`const pad = n => String(n).padStart(2, '0'); const iso = d => \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}\`;
      const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); }; ${bloco[1]}; feriados`);
    const dif = [];
    for (let y = 2024; y <= 2040; y++) if ([...reg(y)].sort().join() !== [...F.feriados(y)].sort().join()) dif.push(y);
    conta('feriados do registo iguais aos do fluxo.js (2024 a 2040)', !dif.length, dif);
    const sugerirP = vm.runInNewContext(sug[1] + '; sugerirP');
    const casos = [{ tipo: 'reparacao' }, { tipo: 'obra' }, { tipo: 'instalacao', dataImposta: '2026-12-01' }, { tipo: 'instalacao', unidades: 3 }, { tipo: 'instalacao', unidades: 1 }, { tipo: 'manutencao' }];
    conta('prioridade do registo igual à do fluxo.js', casos.every((c) => F.prioridadeEntrada(c).P === sugerirP(c).p));
    const rows = [{ num: `ORC0081_${ANO}` }, { num: `ORC0082_${ANO}` }, { num: `ORC0300_${ANO - 1}` }, { orcamento: { num: `ORC0090_${ANO}` } }];
    const nextNumber = vm.runInNewContext(`const rows = ${JSON.stringify(rows)}; const cfgOrcNum = null; ${num[1]}; nextNumber`);
    conta('numeração do registo igual à do fluxo.js (um rascunho sem PDF não conta)', nextNumber() === prox.num, [nextNumber(), prox.num]);
    const orc68Num = vm.runInNewContext(n68[1].replace(/^const /, 'var ') + '; orc68Num');
    conta('o número da folha ORC0068 é o docNum do fluxo.js', orc68Num({ num: prox.num, rev: 1 }) === prox.docNum && orc68Num({ num: prox.num, rev: 2 }) === `${prox.docNum} (rev. 2)`);
  }
}

console.log(`orcamento-motor: ${ok} OK, ${ko} ${ko === 1 ? 'falha' : 'falhas'}`);
process.exit(ko ? 1 : 0);
