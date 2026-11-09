/* Motor de orçamentos da MDM (motor.js, fluxo.js e documento.js do pacote «mdm-orcamentos-offline»), juntos num ficheiro
   para o registo. O código é o do pacote, só com «a ?? b» escrito à moda antiga (o Safari do iOS 12 não o conhece)
   e sem o nome do cliente que vinha num comentário (este ficheiro publica-se com o site).
   Sem dados: a empresa, as margens, as tarifas e o catálogo vêm de config «orcamento_motor» (só a equipa os lê) e o
   registo põe-nos em window.MDM antes de calcular. Funciona sem rede (o service worker guarda este ficheiro). */

/* MDM Orçamentos: MOTOR DE PREÇO (funções puras, sem rede, sem dependências).
   Reproduz as folhas "Custos - MARCA" do Excel ORC0034: custo unitário arredondado a cêntimos,
   linha = qtd × custo, venda = custo × margem, totais sem arredondamento intermédio. */
(function (g) {
  const MDM = (g.MDM = g.MDM || {});
  const nn = (a, b) => (a === null || a === undefined ? b : a);
  const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  const C = () => MDM.CONFIG;

  function fatorDesconto(marca, gama) {
    const f = C().fatorDesconto;
    if (marca === 'MIDEA') return gama === 'mono' ? f.MIDEA_MONO : f.MIDEA_MULTI;
    return f[marca];
  }

  function itemCatalogo(ref) {
    const it = MDM.CATALOGO.find((x) => x.ref === ref || x.modelo === ref);
    if (!it) throw new Error('Modelo sem preço no catálogo: ' + ref + ' (pedir preço ao fornecedor)');
    return it;
  }

  /* Linha de equipamento: {ref, qtd} do catálogo, ou {desc, qtd, tabela} / {desc, qtd, custo} manual. */
  function linhaEquip(l, marca, gama) {
    const it = l.ref ? itemCatalogo(l.ref) : l;
    const fator = it.custo != null ? 1 : fatorDesconto(marca, gama);
    const custoUnit = r2(it.custo != null ? it.custo : it.tabela * fator);
    return { bloco: 'equipamento', desc: l.desc || it.modelo + (it.ref && it.ref !== it.modelo ? ' ' + it.ref : ''),
      qtd: l.qtd || 1, custoUnit, tabela: nn(it.tabela, null), item: it };
  }

  /* Valida combinação multisplit. Devolve lista de avisos (vazia = ok). */
  function validarMulti(extRef, intBtus, marca) {
    const avisos = [];
    const lista = MDM.COMBINACOES[extRef];
    const alvo = [...intBtus].sort((a, b) => a - b).join('+');
    if (!lista) avisos.push(`Sem tabela de combinações para ${extRef} (${marca}): confirmar ${alvo} BTU com o fornecedor.`);
    else if (!lista.some((c) => [...c].sort((a, b) => a - b).join('+') === alvo))
      avisos.push(`Combinação ${alvo} BTU não validada para ${extRef}: confirmar com o fornecedor.`);
    const ext = MDM.CATALOGO.find((x) => x.ref === extRef);
    if (ext && ext.saidas && intBtus.length > ext.saidas) avisos.push(`${extRef} só tem ${ext.saidas} saídas.`);
    if (marca === 'MIDEA' && ext && intBtus.filter((b) => b >= 18000).length > (ext.saidaMeia || 0))
      avisos.push(`${extRef}: interiores de 18000 BTU a mais para as saídas de 1/2"; prever redutor.`);
    return avisos;
  }

  /* ORÇAMENTO DE INSTALAÇÃO / SUBSTITUIÇÃO (uma opção = uma marca)
     p = {
       marca: 'FRANCE_AIR'|'MIDEA'|'MITSUBISHI'|'DAIKIN', gama: 'mono'|'multi',
       equipamento: [{ref, qtd}] ou linhas manuais,
       interiores: [{btu?, metros, liq?, gas?}]   // metros obrigatórios salvo reaproveitaTubagem
       exteriores: 1, dias?: n (por defeito = nº interiores), reaproveitaTubagem?: bool,
       tabelaMO?: 'ORC0034'|'T2026', horasOverride?: {cm, lf, desloc},
       extraMO?: [{desc, qtd, custo}], extraMaterial?: [{desc, qtd, custo}],
       margemTotal?: 0.23  (todas as linhas desta marca a ×1,23),
       valorAlvoSemIva?: 1684.40 (margem única = alvo / custo)
     } */
  function calcInstalacao(p) {
    const cfg = C();
    const avisos = [];
    const nInt = p.interiores.length;
    const nExt = nn(p.exteriores, 1);
    const dias = nn(p.dias, nInt);
    const mo = cfg.tabelasMaoObra[p.tabelaMO || 'ORC0034'];
    const linhas = [];

    p.equipamento.forEach((l) => linhas.push(linhaEquip(l, p.marca, p.gama)));

    const h = p.horasOverride || { cm: cfg.horasPorMaquina.cm * dias, lf: cfg.horasPorMaquina.lf * dias, desloc: cfg.horasPorMaquina.desloc * dias };
    linhas.push({ bloco: 'maoObra', desc: 'Horas/CM', qtd: h.cm, custoUnit: mo.cm });
    linhas.push({ bloco: 'maoObra', desc: 'Horas/LF', qtd: h.lf, custoUnit: mo.lf });
    linhas.push({ bloco: 'maoObra', desc: 'Deslocação', qtd: h.desloc, custoUnit: mo.desloc });
    if (p.reaproveitaTubagem)
      linhas.push({ bloco: 'maoObra', desc: 'Sopragem a azoto das linhas (verificação de entupimentos) - Horas/CM', qtd: cfg.sopragemAzotoHorasCM * nInt, custoUnit: mo.cm });
    (p.extraMO || []).forEach((l) => linhas.push({ bloco: 'maoObra', desc: l.desc, qtd: l.qtd, custoUnit: l.custo }));

    linhas.push({ bloco: 'material', desc: cfg.material.amortecedor.desc, qtd: nExt, custoUnit: cfg.material.amortecedor.custo });
    if (!p.reaproveitaTubagem) {
      const porDiam = {};
      p.interiores.forEach((u, i) => {
        if (!(u.metros > 0)) throw new Error(`Falta o comprimento de tubagem do interior ${i + 1} (nunca assumir).`);
        [u.liq || '1/4', u.gas || (u.btu >= 18000 ? '1/2' : '3/8')].forEach((d) => (porDiam[d] = (porDiam[d] || 0) + u.metros));
      });
      Object.entries(porDiam).forEach(([d, m]) => linhas.push({ bloco: 'material', desc: 'Tubo Cobre Isolado ' + d, qtd: m, custoUnit: cfg.material.cobre[d] }));
    }
    linhas.push({ bloco: 'material', desc: cfg.material.kit.desc, qtd: nInt, custoUnit: cfg.material.kit.custo });
    (p.extraMaterial || []).forEach((l) => linhas.push({ bloco: 'material', desc: l.desc, qtd: l.qtd, custoUnit: l.custo }));

    if (p.gama === 'multi') {
      const ext = p.equipamento.map((l) => l.ref && itemCatalogo(l.ref)).find((it) => it && it.tipo === 'ext');
      const btus = p.interiores.map((u) => u.btu).filter(Boolean);
      if (ext && btus.length === nInt) avisos.push(...validarMulti(ext.ref, btus, p.marca));
    }

    const ativas = linhas.filter((l) => l.qtd > 0);
    linhas.length = 0; linhas.push(...ativas);
    let custo = 0;
    linhas.forEach((l) => { l.custo = l.qtd * l.custoUnit; custo += l.custo; });

    let margemFn;
    if (p.valorAlvoSemIva != null) { const m = p.valorAlvoSemIva / custo; margemFn = () => m; }
    else if (p.margemTotal != null) margemFn = () => 1 + p.margemTotal;
    else margemFn = (l) => (l.bloco === 'equipamento' ? cfg.margemEquip[p.marca] : l.bloco === 'maoObra' ? cfg.margemMaoObra : cfg.margemMaterial);

    let venda = 0;
    linhas.forEach((l) => { l.margem = margemFn(l); l.venda = l.custo * l.margem; venda += l.venda; });

    return resumo({ tipo: 'instalacao', marca: p.marca, gama: p.gama, dias, linhas, custo, venda, avisos });
  }

  /* MANUTENÇÃO / INTERVENÇÃO (preço por hora, já de venda)
     p = { zona: 'Lisboa', soTecnico?: bool, primeiraHora?: n (sobrepõe zona), horas: n (total, inclui a 1.ª),
           materiais?: [{desc, qtd, custo}], alvoComIva?: n (ajusta a 1.ª hora + deslocação) } */
  function calcManutencao(p) {
    const m = C().manutencao;
    const extraH = Math.max(0, (p.horas || 1) - 1);
    const z = m.zonas[p.zona] || {};
    let primeira = nn(p.primeiraHora, p.soTecnico ? z.tecnico : z.equipa);
    if (primeira == null) throw new Error('Zona sem valor de 1.ª hora + deslocação: ' + p.zona + ' (definir em CONFIG.manutencao.zonas)');
    const mats = (p.materiais || []).map((l) => ({ bloco: 'material', desc: l.desc, qtd: l.qtd, custoUnit: l.custo, margem: m.margemMaterial }));
    const resto = extraH * m.horaTecnico + (p.soTecnico ? 0 : extraH * m.horaAjudante) + mats.reduce((s, l) => s + l.qtd * l.custoUnit * l.margem, 0);
    if (p.alvoComIva != null) primeira = r2(p.alvoComIva / (1 + C().iva) - resto);
    const linhas = [
      { bloco: 'maoObra', desc: p.soTecnico ? '1ª Hora / Técnico + Deslocação' : '1ª Hora / Equipa Técnica + Deslocação', qtd: 1, custoUnit: primeira, margem: 1 },
      { bloco: 'maoObra', desc: 'Hora Técnico (após a 1ª hora)', qtd: extraH, custoUnit: m.horaTecnico, margem: 1 },
    ];
    if (!p.soTecnico) linhas.push({ bloco: 'maoObra', desc: 'Hora Ajudante (após a 1ª hora)', qtd: extraH, custoUnit: m.horaAjudante, margem: 1 });
    linhas.push(...mats);
    let custo = 0, venda = 0;
    linhas.forEach((l) => { l.custo = l.qtd * l.custoUnit; l.venda = l.custo * l.margem; custo += l.custo; venda += l.venda; });
    return resumo({ tipo: 'manutencao', linhas, custo, venda, avisos: [] });
  }

  function resumo(o) {
    const iva = C().iva;
    return Object.assign(o, {
      semIva: r2(o.venda), iva: r2(o.venda * iva), comIva: r2(o.venda * (1 + iva)),
      lucro: r2(o.venda - o.custo), margemPct: o.custo ? r2(((o.venda - o.custo) / o.custo) * 100) : 0,
    });
  }

  /* Formatação PT: 1.234,56 € */
  function eur(x) {
    return r2(x).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
  }

  MDM.motor = { r2, eur, fatorDesconto, itemCatalogo, validarMulti, calcInstalacao, calcManutencao };
})(typeof window !== 'undefined' ? window : globalThis);

/* MDM Orçamentos: FLUXO (numeração, prioridades, dias úteis, prazos, semáforo). Sem rede. */
(function (g) {
  const MDM = (g.MDM = g.MDM || {});
  const iso = (d) => d.toISOString().slice(0, 10);
  const D = (s) => (s instanceof Date ? new Date(s) : new Date(s + 'T12:00:00'));

  function pascoa(ano) { // algoritmo de Meeus/Jones/Butcher
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), gg = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - gg + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(ano, mes - 1, dia, 12));
  }
  const cache = {};
  function feriados(ano) {
    if (cache[ano]) return cache[ano];
    const s = new Set(MDM.FERIADOS_FIXOS.map((md) => `${ano}-${md}`));
    const p = pascoa(ano), add = (n) => iso(new Date(p.getTime() + n * 864e5));
    [add(-2), add(0), add(60)].forEach((x) => s.add(x)); // Sexta-feira Santa, Páscoa, Corpo de Deus
    return (cache[ano] = s);
  }
  function diaUtil(d) { const w = d.getUTCDay(); return w !== 0 && w !== 6 && !feriados(d.getUTCFullYear()).has(iso(d)); }
  function somarDiasUteis(data, n) { const d = D(data); let k = 0; while (k < n) { d.setUTCDate(d.getUTCDate() + 1); if (diaUtil(d)) k++; } return iso(d); }
  function diasUteisEntre(a, b) { const x = D(a), y = D(b); let n = 0; while (x < y) { x.setUTCDate(x.getUTCDate() + 1); if (diaUtil(x)) n++; } return n; }

  function proximoNumero(registos, ano) {
    const seq = Math.max(0, ...registos.filter((r) => r.ano === ano && r.seq).map((r) => r.seq)) + 1;
    return { seq, num: `ORC${String(seq).padStart(4, '0')}_${ano}`, docNum: `${String(seq).padStart(4, '0')}/${ano}` };
  }
  function nomeFicheiro(num, cliente, descricao, local = 'LX') {
    return `${num} - ${cliente.toUpperCase()} - ${descricao.toUpperCase()}${local ? ' - ' + local : ''}`;
  }

  function prioridadeEntrada(p) {
    if (p.tipo === 'reparacao') return { P: 'P1', porque: 'avaria' };
    if (p.tipo === 'obra') return { P: 'P2', porque: 'obra' };
    if (p.dataImposta) return { P: 'P2', porque: 'data imposta pelo cliente' };
    if ((p.unidades || 0) >= 3) return { P: 'P2', porque: '3 ou mais unidades' };
    return { P: 'P3', porque: 'normal' };
  }

  function dataLimite(p) {
    const pr = MDM.PRAZOS[p.estado]; if (!pr || !p.entrouNoEstado) return null;
    const n = pr[p.prioridade || 'P3'], base = p.entrouNoEstado.slice(0, 10);
    if (pr.unidade === 'calendario') { const d = D(base); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
    if (pr.unidade === 'horas') return somarDiasUteis(base, Math.ceil(n / 9));
    return somarDiasUteis(base, n);
  }
  function semaforo(p, hoje) {
    if (['resolvido', 'perdido'].includes(p.estado)) return 'cinzento';
    if (!p.proximaAcao || !p.dataProximaAcao) return 'vermelho';
    const lim = [dataLimite(p), p.dataProximaAcao].filter(Boolean).sort()[0];
    return lim < hoje ? 'vermelho' : lim === hoje ? 'amarelo' : 'verde';
  }

  const ESTADOS = ['novo', 'visita_por_marcar', 'visita_marcada', 'orcamento_por_fazer', 'espera_cliente', 'espera_fornecedor', 'em_execucao', 'resolvido', 'perdido'];
  const MOTIVOS_PERDA = ['Foi com outra empresa', 'Preço', 'Prazo', 'Desistiu ou adiou', 'Sem resposta', 'Não fazemos este trabalho', 'Outro'];

  function validarEnvio(p) {
    const f = []; if (!p.num) f.push('num'); if (!(p.valor > 0)) f.push('valor'); if (!p.dataEnvio) f.push('dataEnvio'); return f;
  }

  MDM.fluxo = { pascoa, feriados, diaUtil, somarDiasUteis, diasUteisEntre, proximoNumero, nomeFicheiro,
    prioridadeEntrada, dataLimite, semaforo, validarEnvio, ESTADOS, MOTIVOS_PERDA };
})(typeof window !== 'undefined' ? window : globalThis);

/* MDM Orçamentos: DOCUMENTO (página do cliente A4, formato ORC0068) e EMAILS.
   Gera HTML autónomo; o PDF sai com window.print() (A4, 1 página, totais no fundo). Sem rede. */
(function (g) {
  const MDM = (g.MDM = g.MDM || {});
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const br = (s) => esc(s).replace(/\n/g, '<br>');
  const dataPT = (d) => { const x = d instanceof Date ? d : new Date(d + 'T12:00:00'); return x.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }); };

  /* Bloco "- Marca / - Tipo / - Modelo / - Potência" */
  function blocoEquip(o) {
    const L = [`- Marca: ${o.marcaTexto}`, `- Tipo : ${o.tipoTexto}`, `- Modelo: ${o.modeloTexto}`];
    if (o.potenciaTexto) L.push(`- Potência : ${o.potenciaTexto}`);
    return L.join('\n');
  }

  /* doc = {
       numero: '0082/2026', data: '2026-10-22', cliente: {nome, morada: [linhas], nif},
       proposta: 'Proposta p/ Fornecimento e Montagem ...',
       principal: { calc, marcaTexto, tipoTexto, modeloTexto, potenciaTexto } | { calc, texto },
       opcoes: [ { calc, marcaTexto, tipoTexto, modeloTexto, potenciaTexto } ],
       notas, pagamento, exclusoes, prazo } */
  function renderORC(doc) {
    const E = MDM.EMPRESA, T = MDM.CONFIG.textos, eur = MDM.motor.eur;
    const p = doc.principal, pc = p.calc;
    const descPrincipal = p.texto || blocoEquip(p);
    const ops = (doc.opcoes || []).map((o) => `<tr><td></td><td class="d">OPÇÃO:<br>${br(blocoEquip(o))}<br><br>Valor Total:&nbsp; ${eur(o.calc.semIva)} + IVA = ${eur(o.calc.comIva)}</td><td class="q">1</td><td></td><td></td></tr>`).join('');
    return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>Orçamento ${esc(doc.numero)}</title>
<style>
@page{size:A4;margin:12mm 12mm 10mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font:10pt Verdana,Arial,sans-serif;color:#000}
.pg{display:flex;flex-direction:column;min-height:273mm}
.top{display:grid;grid-template-columns:28mm 1fr 52mm;gap:4mm;align-items:start}
.top img{width:28mm}.emp{font-size:7.5pt;line-height:1.35}.emp b{font-size:9.5pt}
.num{font-size:8.5pt;text-align:right}.num span{margin-left:8mm}
.meta{display:grid;grid-template-columns:1fr 1fr;margin-top:4mm;font-size:8.5pt}
.meta .l b{display:inline-block;width:32mm;font-size:7.5pt}.meta .l div{margin:2mm 0}
.cli b{font-size:10pt}.cli small{font-size:7pt;font-weight:bold}
table.it{width:100%;border-collapse:collapse;margin-top:3mm}
table.it th{font-size:7pt;text-align:left;border-top:1.5pt solid #000;border-bottom:1.5pt solid #000;background:#bbb;padding:1mm}
table.it td{vertical-align:top;padding:1.5mm 1mm}.d{white-space:normal}.q{text-align:center}.v{text-align:right;white-space:nowrap}
.esp{flex:1}
.tot{display:grid;grid-template-columns:1fr 70mm;border-top:1.5pt solid #000;margin-top:2mm;font-size:8.5pt}
.tot table{border-collapse:collapse;width:100%}.tot td{padding:.6mm 1mm}.tot td.k{background:#bbb;font-weight:bold;font-size:7pt;text-align:right}
.tot .T td{border-top:1.5pt solid #000;font-weight:bold}
.cond{display:grid;grid-template-columns:32mm 1fr;gap:2mm 3mm;margin-top:4mm;font-size:8.5pt}.cond b{font-size:7pt}
.foot{display:flex;justify-content:space-between;font-size:7pt;margin-top:4mm}
</style></head><body><div class="pg">
<div class="top"><img src="${MDM.LOGO || ''}" alt="MDM"><div class="emp"><b>${esc(E.nome)}</b><br>${E.morada.map(esc).join('<br>')}<br><b style="font-size:7.5pt">NIF:&nbsp; ${E.nif}<br>Tel.:&nbsp; ${E.tel}</b><br>${esc(E.email)}</div>
<div class="num">Orçamento Nº<span>${esc(doc.numero)}</span></div></div>
<div class="meta"><div class="l"><div><b>Data de Emissão:</b> ${dataPT(doc.data)}</div><div><b>Doc. Emitido por:</b> ${esc(E.emitidoPor)}</div><div>${esc(E.iban)}</div></div>
<div class="cli"><small>Cliente:</small><br><b>${esc(doc.cliente.nome.toUpperCase())}</b><br><br>${(doc.cliente.morada || []).map(esc).join('<br>')}<br><small>NIF:</small> ${esc(doc.cliente.nif || '')}</div></div>
<table class="it"><tr><th>Referência</th><th>Descrição</th><th>Quant.</th><th class="v">V. Unit.</th><th class="v">Subtotal</th></tr>
<tr><td style="width:22mm"></td><td class="d">${br(doc.proposta)}</td><td class="q">1</td><td class="v">${eur(pc.semIva)}</td><td class="v">${eur(pc.semIva)}</td></tr>
<tr><td></td><td class="d">${br(descPrincipal)}</td><td class="q">1</td><td></td><td></td></tr>
${ops}
${doc.notas ? `<tr><td></td><td class="d">${br(doc.notas)}</td><td></td><td></td><td></td></tr>` : ''}
</table>
<div class="esp"></div>
<div class="tot"><div><b style="font-size:7pt">Taxa de IVA</b><br>${Math.round(MDM.CONFIG.iva * 100)}%</div>
<table><tr><td class="k">Total Ilíquido</td><td class="v">${eur(pc.semIva)}</td></tr><tr><td class="k">Total Desc</td><td class="v">${eur(0)}</td></tr>
<tr><td class="k">Total IVA</td><td class="v">${eur(pc.iva)}</td></tr><tr class="T"><td class="k">Total</td><td class="v">${eur(pc.comIva)}</td></tr></table></div>
<div class="cond"><b>Prazo de Validade:</b><span><b style="font-size:8.5pt">${esc(T.validade)}</b></span>
<b>Condições Pagamento:</b><span><b style="font-size:8.5pt;text-decoration:underline">${esc(doc.pagamento || T.pagamentoInstalacao)}</b></span>
<b>Exclusões:</b><span>${esc(doc.exclusoes || T.exclusoes)}</span>
<b>Previsão da Execucão dos trabalhos:</b><span>${esc(doc.prazo || '')}<br>${esc(T.horario)}</span></div>
<div class="foot"><span>${esc(E.rodape)}</span><span>Página nº 1/1</span></div>
</div></body></html>`;
  }

  /* EMAILS (texto simples, pronto a copiar) */
  function emailEnvio({ tratamento, numero, descricao, desculpa, ingles }) {
    const A = MDM.EMPRESA.assinatura.join('\n');
    if (ingles) return `Dear ${tratamento},\n\n${desculpa ? 'Please accept our apologies for the late response.\n\n' : ''}Please find attached our quotation ${numero} for ${descricao}.\n\nWe remain available for any questions.\n\nKind regards,\n\n${A}`;
    return `Exmo(a). ${tratamento},\n\n${desculpa ? 'Pedimos desculpa pela demora na resposta.\n\n' : ''}Segue em anexo a nossa proposta ${numero} para ${descricao}.\n\nFicamos ao dispor para qualquer esclarecimento.\n\nCom os melhores cumprimentos,\n\n${A}`;
  }
  function emailManutencao({ tratamento, equipamentos = [], primeiraHora, soTecnico, morada, desculpa, ingles }) {
    const m = MDM.CONFIG.manutencao, eur = MDM.motor.eur, A = MDM.EMPRESA.assinatura.join('\n');
    const eq = equipamentos.map((e) => '- ' + e).join('\n');
    if (ingles) return `Dear ${tratamento},\n\n${desculpa ? 'Please accept our apologies for the late response.\n\n' : ''}Following our conversation, please find below our conditions for the maintenance of the equipment installed at ${morada}:\n\n${eq}\n\nOur rates:\n- 1st hour / ${soTecnico ? 'Technician' : 'Technical team'} + travel: ${eur(primeiraHora).replace(',', '.')} + VAT\n- Technician, per hour: 36.20 € + VAT\n${soTecnico ? '' : '- Assistant, per hour: 23.40 € + VAT\n'}\nConditions:\n- The 1st hour is charged in full; after the 1st hour, time is charged in half-hour fractions.\n- Parts and materials used are charged separately.\n- Refrigerant gas charges and any repairs found during the maintenance are not included; if a repair cannot be done on the spot, we will send a separate quote.\n- Payment: on completion, by bank transfer or cash.\n\nTo schedule the visit, please send us:\n- Name of the entity (for the invoice):\n- Billing address:\n- Address of the intervention: ${morada}\n- Tax number (NIF):\n- On-site contact (name and phone):\n\nKind regards,\n\n${A.replace('Tel.: 21', 'Tel.: +351 21').replace('Telemóvel: 9', 'Mobile: +351 9')}`;
    return `Exmo(a). ${tratamento},\n\n${desculpa ? 'Pedimos desculpa pela demora na resposta.\n\n' : ''}No seguimento da nossa conversa, vimos apresentar as nossas condições para a intervenção em ${morada}:\n\n${eq}\n\n- 1ª Hora / ${soTecnico ? 'Técnico' : 'Equipa Técnica'} + Deslocação: ${eur(primeiraHora)} + IVA\n- Hora Técnico: ${eur(m.horaTecnico)} + IVA\n${soTecnico ? '' : `- Hora Ajudante: ${eur(m.horaAjudante)} + IVA\n`}\nCondições:\n- A 1ª hora é faturada por inteiro; após a 1ª hora, a faturação é feita em frações de meia hora.\n- Os materiais e peças aplicados serão faturados à parte.\n- Caso a reparação não seja possível no momento da intervenção, será apresentado orçamento para a mesma.\n- Pagamento: Pronto Pagamento, por transferência bancária ou numerário.\n\nPara agendarmos a intervenção, solicitamos:\n- Nome da Entidade:\n- Morada (faturação):\n- Morada da Intervenção: ${morada}\n- NIF:\n- Contacto no local (nome e telefone):\n\nCom os melhores cumprimentos,\n\n${A}`;
  }

  MDM.documento = { renderORC, blocoEquip, emailEnvio, emailManutencao, dataPT };
})(typeof window !== 'undefined' ? window : globalThis);
