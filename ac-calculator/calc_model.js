/**
 * Modelo de dimensionamento de ar condicionado (bomba de calor ar-ar).
 *
 * Sem DOM: corre no browser (app.js) e em Node (test/calc.test.mjs).
 * Método simplificado por componentes, em watts, convertido para BTU/h
 * (1 W = 3,412 BTU/h). As constantes estão todas aqui em cima para serem
 * fáceis de rever por um técnico.
 */

export const W_TO_BTU = 3.412;

// ---------------------------------------------------------------- opções
export const ORIENTATIONS = [
  { key: "N", label: "Norte" },
  { key: "NE", label: "Nordeste" },
  { key: "E", label: "Este (nascente)" },
  { key: "SE", label: "Sudeste" },
  { key: "S", label: "Sul" },
  { key: "SO", label: "Sudoeste" },
  { key: "O", label: "Oeste (poente)" },
  { key: "NO", label: "Noroeste" },
];

export const SHADING_OPTIONS = [
  { key: "none", label: "Sem sombreamento", factor: 1.0 },
  { key: "curtains", label: "Cortinas interiores", factor: 0.7 },
  { key: "blinds_in", label: "Estores interiores", factor: 0.55 },
  { key: "blinds_out", label: "Estores ou toldos exteriores", factor: 0.3 },
];

// "Não sei" usa os fatores do edifício antigo: na dúvida, dimensiona-se por cima.
// cool/heat: paredes e telhado; glass: vidro simples (antigo) deixa entrar mais sol
// do que vidro duplo (1990-2006) ou vidro duplo de controlo solar (recente).
// roof: cobertura (laje antiga sem isolamento perde muito mais); uGlass: W/m²K do
// vidro no inverno (simples 5,8; duplo 2,9; duplo recente 1,8).
export const BUILDING_OPTIONS = [
  { key: "unknown", label: "Não sei (assumimos pouco isolamento)", cool: 1.15, heat: 1.25, glass: 1.1, roof: 1.5, uGlass: 5.8 },
  { key: "old", label: "Antes de 1990 (pouco isolamento)", cool: 1.15, heat: 1.25, glass: 1.1, roof: 1.5, uGlass: 5.8 },
  { key: "mid", label: "Entre 1990 e 2006", cool: 1.0, heat: 1.0, glass: 1.0, roof: 1.0, uGlass: 2.9 },
  { key: "new", label: "Depois de 2006 (bem isolado)", cool: 0.85, heat: 0.75, glass: 0.85, roof: 0.7, uGlass: 1.8 },
];

export const EQUIPMENT_OPTIONS = [
  { key: "none", label: "Nada em especial", W: 0 },
  { key: "office", label: "Escritório (computadores, televisão grande)", W: 300 },
  { key: "kitchen", label: "Cozinha (fogão, forno, frigorífico)", W: 800 },
];

export const ROOM_PRESETS = [
  { name: "Sala", people: 3, equipment: "none" },
  { name: "Quarto", people: 2, equipment: "none" },
  { name: "Escritório", people: 2, equipment: "office" },
  { name: "Cozinha", people: 2, equipment: "kitchen" },
  { name: "Sala e cozinha", people: 4, equipment: "kitchen" },
];

// Zonas climáticas de verão do REH (Despacho 15793-F/2013): V1 ameno, V3 quente.
export const ZONES = {
  V1: { label: "Verão ameno", factor: 0.9, hint: "Ilhas e zonas de altitude: verões mais frescos." },
  V2: { label: "Verão moderado", factor: 1.0, hint: "Lisboa e grande parte do litoral centro." },
  V3: { label: "Verão quente", factor: 1.12, hint: "Península de Setúbal, interior, Alentejo e Algarve: mais calor, mais potência." },
};

// Zonas de inverno do REH. factor multiplica as necessidades de aquecimento;
// derate é a fração da potência nominal de calor que a bomba de calor ainda dá
// num dia frio dessa zona (a capacidade cai com a temperatura exterior).
export const WINTER_ZONES = {
  I1: { label: "Inverno ameno", factor: 1.0, derate: 0.9 },
  I2: { label: "Inverno moderado", factor: 1.2, derate: 0.8 },
  I3: { label: "Inverno frio", factor: 1.4, derate: 0.7 },
};

// Unidades interiores murais correntes. Capacidades nominais típicas (EN 14511).
export const UNIT_CLASSES = [
  { btu: 9000, coolKW: 2.5, heatKW: 3.2 },
  { btu: 12000, coolKW: 3.5, heatKW: 4.0 },
  { btu: 18000, coolKW: 5.0, heatKW: 5.8 },
  { btu: 24000, coolKW: 7.0, heatKW: 8.0 },
];

// Unidades exteriores multi-split: N×1 com capacidade nominal de frio/calor.
// maxIndoorKW = soma máxima de capacidades interiores ligáveis segundo as tabelas
// dos fabricantes (cerca de 140 a 155 % da capacidade nominal da exterior).
export const MULTI_OUTDOOR = [
  { rooms: 2, label: "2×1", coolKW: 4.0, heatKW: 4.6, maxIndoorKW: 6.0 },
  { rooms: 2, label: "2×1", coolKW: 5.0, heatKW: 5.6, maxIndoorKW: 7.0 },
  { rooms: 3, label: "3×1", coolKW: 5.2, heatKW: 6.8, maxIndoorKW: 8.0 },
  { rooms: 3, label: "3×1", coolKW: 6.8, heatKW: 8.6, maxIndoorKW: 10.5 },
  { rooms: 4, label: "4×1", coolKW: 6.8, heatKW: 8.6, maxIndoorKW: 10.5 },
  { rooms: 4, label: "4×1", coolKW: 8.0, heatKW: 9.0, maxIndoorKW: 12.0 },
  { rooms: 5, label: "5×1", coolKW: 9.0, heatKW: 10.4, maxIndoorKW: 14.0 },
];

export const LIMITS = {
  rooms: { min: 1, max: 5 },
  area: { min: 4, max: 120 },
  height: { min: 220, max: 450 },
  windows: { min: 0, max: 60 },
  people: { min: 0, max: 12 },
};

export const MAX_WALL_UNIT_W = 7000; // capacidade da maior unidade mural (24 000 BTU)
export const SPLIT_TOLERANCE = 1.05; // só dividimos em várias unidades acima de 5 % sobre a maior mural

// ------------------------------------------------------------- constantes
export const K = {
  envelopeWPerM3: 35, // paredes, teto, pavimento e renovação de ar, por m³ (edifício 1990-2006): ~90 W/m² a 2,6 m
  solarWPerM2: { N: 60, NE: 120, E: 240, SE: 260, S: 220, SO: 310, O: 320, NO: 160 }, // ganho pelo vidro duplo, verão, ~38,7° N, já amortecido pela inércia
  personW: 100, // calor sensível + latente por pessoa sentada
  baseEquipmentW: 100, // iluminação, televisão, carregadores (sempre)
  roofWPerM2: 35, // ganho pela cobertura em último andar, laje 1990-2006 (× fator roof do edifício)
  minHeightCm: 240, // tetos baixos não reduzem a carga (fail-safe)
  marginFactor: 1.05, // margem de dimensionamento (a envolvente já é conservadora)
  maxWPerM2: 250, // acima disto os dados merecem confirmação (vidro ou pessoas a mais)
  roundW: 10, // arredondamento da carga (precisão a mais engana)
  atLimitRatio: 0.95, // acima disto a divisão está no limite da classe
  heatingWPerM3: 25, // paredes, teto e renovação de ar num dia frio de inverno, por m³ (zona I1, edifício 1990-2006)
  heatingDeltaT: 15, // ΔT de inverno (20 °C dentro, ~5 °C fora) para a perda pelo vidro
  simultaneity: { 2: 0.85, 3: 0.8, 4: 0.75, 5: 0.7 }, // multi-split: as divisões raramente pedem o máximo todas ao mesmo tempo
  smallRoomRatio: 0.45, // abaixo disto a unidade mais pequena fica muito folgada
  bigOpenPlanM2: 50, // acima disto sugerimos distribuir o ar por 2 unidades
};

export const METHOD_PT =
  "Para cada divisão somamos o calor que entra pelas paredes, teto e ar exterior (proporcional ao volume e à idade do edifício), " +
  "o calor do sol que entra pelas janelas (depende da área de vidro, da orientação e do sombreamento), o calor das pessoas e dos equipamentos " +
  "e, em último andar, o calor do telhado. Ajustamos o que vem de fora à zona climática de verão do seu código postal e acrescentamos 5 % de margem. " +
  "Convertemos o resultado de watts para BTU/h (1 kW são 3 412 BTU/h) e escolhemos a unidade comercial mais pequena que cobre essa carga: " +
  "9 000, 12 000, 18 000 ou 24 000 BTU/h; acima disso dividimos a carga por duas ou mais unidades. Se pediu aquecimento, estimamos as perdas de calor num dia frio da sua zona de inverno (paredes, ar e vidro) e confirmamos que a potência de calor da unidade, já reduzida pelo frio, chega. A zona climática é a da sua região ao nível de referência, sem correção de altitude.";

// ------------------------------------------------------------ utilidades
let roomCounter = 0;
export function defaultRoom(index = 0) {
  roomCounter += 1;
  return {
    id: `r${index + 1}-${roomCounter}-${Math.random().toString(36).slice(2, 6)}`,
    name: "",
    area: null,
    height: 260,
    windows: null,
    shading: "none",
    orientation: "S",
    people: 2,
    topFloor: false,
    equipment: "none",
  };
}

const byKey = (list, key) => list.find((o) => o.key === key);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export function validateRoom(room) {
  const errors = {};
  const a = room.area;
  const h = room.height;
  const w = room.windows;
  const p = room.people;
  if (!isNum(a) || a < LIMITS.area.min || a > LIMITS.area.max) errors.area = `Indique a área entre ${LIMITS.area.min} e ${LIMITS.area.max} m²`;
  if (!isNum(h) || h < LIMITS.height.min || h > LIMITS.height.max) errors.height = `Indique a altura entre ${LIMITS.height.min} e ${LIMITS.height.max} cm`;
  if (!isNum(w) || w < LIMITS.windows.min || w > LIMITS.windows.max) errors.windows = `Indique a área das janelas entre ${LIMITS.windows.min} e ${LIMITS.windows.max} m²`;
  if (p != null && (!isNum(p) || p < LIMITS.people.min || p > LIMITS.people.max || p % 1 !== 0)) errors.people = `Indique entre ${LIMITS.people.min} e ${LIMITS.people.max} pessoas`;
  if (!byKey(SHADING_OPTIONS, room.shading)) errors.shading = "Sombreamento inválido";
  if (!byKey(ORIENTATIONS, room.orientation)) errors.orientation = "Orientação inválida";
  if (room.equipment != null && !byKey(EQUIPMENT_OPTIONS, room.equipment)) errors.equipment = "Equipamento inválido";
  return { ok: Object.keys(errors).length === 0, errors };
}

export function pickUnit(loadW) {
  const kw = loadW / 1000;
  return UNIT_CLASSES.find((u) => u.coolKW >= kw) || null;
}

const roundTo = (n, step) => Math.round(n / step) * step;

// Texto simples: milhares com espaço ("9 000"), decimais com vírgula.
export const fmt = (n, d = 0) => {
  const [int, dec] = Number(n).toFixed(d).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec && /[1-9]/.test(dec) ? `${grouped},${dec}` : grouped;
};

/**
 * Carga térmica de uma divisão e unidade recomendada.
 * ctx: { zone: 'V1'|'V2'|'V3', winter: 'I1'|'I2'|'I3', building: 'old'|'mid'|'new', heating: boolean }
 */
export function roomLoad(room, ctx = {}) {
  const v = validateRoom(room);
  const zone = ZONES[ctx.zone] ? ctx.zone : "V2";
  const winter = WINTER_ZONES[ctx.winter] ? ctx.winter : "I1";
  const building = byKey(BUILDING_OPTIONS, ctx.building) || byKey(BUILDING_OPTIONS, "unknown");
  const shading = byKey(SHADING_OPTIONS, room.shading) || SHADING_OPTIONS[0];
  const orientation = byKey(ORIENTATIONS, room.orientation) || ORIENTATIONS[4];
  const equipment = byKey(EQUIPMENT_OPTIONS, room.equipment) || EQUIPMENT_OPTIONS[0];
  const labels = { shading: shading.label, orientation: orientation.label, equipment: equipment.label };
  if (!v.ok) {
    return { ok: false, errors: v.errors, room, labels, loadW: 0, loadBTU: 0, unit: null, units: 0, warnings: [], heating: null };
  }
  const people = room.people == null ? 2 : room.people;
  const volume = room.area * (Math.max(room.height, K.minHeightCm) / 100);
  const envelope = volume * K.envelopeWPerM3 * building.cool;
  const solar = room.windows * K.solarWPerM2[orientation.key] * shading.factor * building.glass;
  const internal = people * K.personW + K.baseEquipmentW + equipment.W;
  const roof = room.topFloor ? room.area * K.roofWPerM2 * building.roof : 0;
  const sum = envelope + solar + internal + roof;
  // O clima só pesa no que vem de fora (envolvente, sol, telhado); pessoas e
  // equipamentos aquecem o mesmo em Braga ou em Beja. A margem aplica-se a tudo.
  const climate = ZONES[zone].factor;
  const loadW = roundTo((envelope + solar + roof) * climate * K.marginFactor + internal * K.marginFactor, K.roundW);
  const loadBTU = roundTo(loadW * W_TO_BTU, K.roundW);
  // Acima da maior mural (com 5 % de tolerância, a carga já traz margem),
  // divide-se a carga por n unidades iguais.
  const units = loadW <= MAX_WALL_UNIT_W * SPLIT_TOLERANCE ? 1 : Math.ceil(loadW / MAX_WALL_UNIT_W);
  const unit = units === 1 ? pickUnit(loadW) || UNIT_CLASSES[UNIT_CLASSES.length - 1] : pickUnit(loadW / units);
  const ratio = loadW / units / (unit.coolKW * 1000);

  const warnings = [];
  if (units > 1) {
    warnings.push({ level: "warn", text: `Carga acima de 7 kW: uma só unidade mural, mesmo de 24 000 BTU, já não chega. Sugerimos ${units} unidades de ${fmt(unit.btu)} BTU para distribuir o ar, ou uma solução de cassete ou conduta. O técnico confirma na visita.` });
  } else if (ratio < K.smallRoomRatio) {
    warnings.push({ level: "info", text: `Divisão pequena: a unidade mais pequena do mercado (${fmt(unit.btu)} BTU) é mais do que suficiente e vai trabalhar a baixa rotação. Em divisões muito pequenas pondere servir duas divisões com uma só unidade.` });
  } else if (ratio >= K.atLimitRatio) {
    const next = UNIT_CLASSES[UNIT_CLASSES.indexOf(unit) + 1];
    const headroom = Math.round((1 - ratio) * 100);
    warnings.push({ level: "info", text: `No limite da classe: a carga fica a ${headroom >= 1 ? `${headroom} %` : "menos de 1 %"} da capacidade da unidade. Se a divisão for muito usada nos dias mais quentes, pondere ${next ? `${fmt(next.btu)} BTU` : "dividir a potência por duas unidades"}. O técnico confirma na visita.` });
  }
  if (room.area >= K.bigOpenPlanM2 && units === 1) {
    warnings.push({ level: "warn", text: "Espaço aberto grande: uma só unidade mural pode não distribuir bem o ar. Muitas vezes compensa dividir a potência por duas unidades." });
  }
  if (room.windows > room.area * 0.6) {
    warnings.push({ level: "warn", text: "Muito vidro para a área indicada: confirme a área das janelas. Vãos envidraçados grandes pedem sombreamento exterior." });
  } else if (loadW / room.area > K.maxWPerM2) {
    warnings.push({ level: "warn", text: "Carga muito alta para a área: confirme as janelas, as pessoas e os equipamentos. Se estiver tudo certo, vale a pena sombrear por fora." });
  }

  let heating = null;
  if (ctx.heating) {
    const wz = WINTER_ZONES[winter];
    // Paredes, teto e ar (por volume) + perda pelo vidro (U × área × ΔT), ambos
    // agravados pela zona de inverno; último andar perde mais pelo teto.
    const heatBody = volume * K.heatingWPerM3 * building.heat * (room.topFloor ? 1.15 : 1);
    const heatGlass = room.windows * building.uGlass * K.heatingDeltaT;
    const heatW = roundTo((heatBody + heatGlass) * wz.factor, K.roundW);
    const effective = (u) => u.heatKW * wz.derate; // kW que a unidade dá num dia frio
    const perUnit = heatW / units;
    const heatOk = effective(unit) * 1000 >= perUnit;
    const suggest = heatOk ? null : UNIT_CLASSES.find((u) => effective(u) * 1000 >= perUnit) || null;
    heating = { loadW: heatW, ok: heatOk, suggest, winter, unitHeatKW: effective(unit) * units, suggestHeatKW: suggest ? effective(suggest) * units : 0 };
  }

  return {
    ok: true,
    errors: {},
    room,
    labels,
    zone,
    winter,
    volume,
    parts: { envelope, solar, internal, roof, sum },
    factors: { climate, margin: K.marginFactor, building: building.cool, glass: building.glass },
    loadW,
    loadBTU,
    unit,
    units,
    ratio,
    warnings,
    heating,
  };
}

// ------------------------------------------------------------ código postal
// Prefixos de 4 dígitos: região aproximada, zonas REH de verão (V) e inverno (I)
// (Despacho 15793-F/2013, por NUTS III, sem correção de altitude) e AML.
// Intervalos mais específicos primeiro: a pesquisa usa o primeiro que encaixa.
const POSTAL_RANGES = [
  { from: 1000, to: 1999, district: "Lisboa", zone: "V2", aml: true, winter: "I1" },
  { from: 2000, to: 2399, district: "Santarém", zone: "V3", aml: false, winter: "I2" },
  { from: 2400, to: 2549, district: "Leiria", zone: "V2", aml: false, winter: "I2" },
  { from: 2550, to: 2599, district: "Lisboa (Oeste)", zone: "V2", aml: false, winter: "I1" },
  { from: 2630, to: 2634, district: "Lisboa (Oeste, Arruda dos Vinhos)", zone: "V2", aml: false, winter: "I1" },
  { from: 2600, to: 2799, district: "Lisboa (Área Metropolitana)", zone: "V2", aml: true, winter: "I1" },
  // Península de Setúbal: NUTS III de verão quente (V3) no REH, inverno ameno.
  { from: 2800, to: 2999, district: "Setúbal (Área Metropolitana)", zone: "V3", aml: true, winter: "I1" },
  { from: 3000, to: 3499, district: "Coimbra", zone: "V2", aml: false, winter: "I2" },
  { from: 3500, to: 3699, district: "Viseu", zone: "V2", aml: false, winter: "I2" },
  { from: 3700, to: 3899, district: "Aveiro", zone: "V2", aml: false, winter: "I1" },
  { from: 4000, to: 4699, district: "Porto", zone: "V2", aml: false, winter: "I1" },
  { from: 4700, to: 4899, district: "Braga", zone: "V2", aml: false, winter: "I2" },
  { from: 4900, to: 4999, district: "Viana do Castelo", zone: "V2", aml: false, winter: "I2" },
  { from: 5000, to: 5299, district: "Vila Real", zone: "V2", aml: false, winter: "I3" },
  { from: 5300, to: 5499, district: "Bragança", zone: "V2", aml: false, winter: "I3" },
  { from: 6000, to: 6299, district: "Castelo Branco", zone: "V3", aml: false, winter: "I2" },
  { from: 6300, to: 6499, district: "Guarda", zone: "V2", aml: false, winter: "I3" },
  { from: 7000, to: 7299, district: "Évora", zone: "V3", aml: false, winter: "I1" },
  { from: 7300, to: 7599, district: "Portalegre", zone: "V3", aml: false, winter: "I2" },
  { from: 7600, to: 7999, district: "Beja", zone: "V3", aml: false, winter: "I1" },
  { from: 8000, to: 8999, district: "Faro", zone: "V3", aml: false, winter: "I1" },
  { from: 9000, to: 9499, district: "Madeira", zone: "V1", aml: false, winter: "I1" },
  { from: 9500, to: 9999, district: "Açores", zone: "V1", aml: false, winter: "I1" },
];

export function parsePostal(str) {
  const digits = String(str ?? "").replace(/\D/g, "");
  if (digits.length !== 7) return { valid: false, digits };
  const prefix = Number(digits.slice(0, 4));
  if (prefix < 1000) return { valid: false, digits };
  return { valid: true, digits, prefix, formatted: `${digits.slice(0, 4)}-${digits.slice(4)}` };
}

export function postalInfo(str) {
  const p = parsePostal(str);
  if (!p.valid) return { valid: false, zone: "V2", winter: "I1", inAML: false, district: "" };
  let r = POSTAL_RANGES.find((x) => p.prefix >= x.from && p.prefix <= x.to);
  if (!r) {
    // Prefixo sem intervalo (ex. 3900, 5600): usa o intervalo mais próximo em vez de recusar.
    const dist = (x) => Math.min(Math.abs(p.prefix - x.from), Math.abs(p.prefix - x.to));
    r = POSTAL_RANGES.reduce((best, x) => (dist(x) < dist(best) ? x : best), POSTAL_RANGES[0]);
  }
  return { valid: true, prefix: p.prefix, formatted: p.formatted, zone: r.zone, winter: r.winter, factor: ZONES[r.zone].factor, inAML: r.aml, district: r.district };
}

// ------------------------------------------------------------- projeto
function monoPrice(loads, prices) {
  if (!prices || !prices.mono) return null;
  let total = 0;
  for (const l of loads) {
    const v = l.unit ? prices.mono[l.unit.btu] : null;
    if (v == null) return null;
    total += v * l.units;
  }
  return total;
}
function multiPrice(loads, outdoor, prices) {
  if (!prices || !prices.multi || !outdoor) return null;
  const base = prices.multi.outdoor && prices.multi.outdoor[loads.length];
  if (base == null) return null;
  let total = base;
  for (const l of loads) {
    const v = l.unit ? prices.multi.indoor && prices.multi.indoor[l.unit.btu] : null;
    if (v == null) return null;
    total += v;
  }
  return total;
}

export function pickOutdoor(loads, ctx = {}) {
  const n = loads.length;
  if (n < 2 || loads.some((l) => !l.unit || l.units !== 1)) return null;
  // No inverno todas as divisões pedem calor à mesma hora: sem simultaneidade.
  const winter = WINTER_ZONES[ctx.winter] ? ctx.winter : "I1";
  const heatNeedKW = ctx.heating ? loads.reduce((s, l) => s + (l.heating ? l.heating.loadW : 0), 0) / 1000 : 0;
  const heatsAll = (o) => o.heatKW * WINTER_ZONES[winter].derate >= heatNeedKW;
  const indoorKW = loads.reduce((s, l) => s + l.unit.coolKW, 0);
  const loadKW = loads.reduce((s, l) => s + l.loadW, 0) / 1000;
  // Simultaneidade: nem todas as divisões pedem o máximo ao mesmo tempo (norte e
  // poente têm picos a horas diferentes). A soma das interiores ligadas tem de
  // caber no máximo que o fabricante permite para essa exterior (maxIndoorKW).
  const largestKW = Math.max(...loads.map((l) => l.loadW)) / 1000;
  const needKW = Math.max((K.simultaneity[n] || 0.7) * loadKW, largestKW);
  // Uma exterior com mais portas (ex. 4×1) também serve menos divisões.
  return MULTI_OUTDOOR.find((o) => o.rooms >= n && o.coolKW >= needKW && o.maxIndoorKW >= indoorKW && heatsAll(o)) || null;
}

/**
 * Dimensiona o conjunto: cargas por divisão, totais e opções mono vs multi.
 * ctx: { zone, building, heating, prices }
 */
export function sizeProject(rooms, ctx = {}) {
  const loads = rooms.map((r) => roomLoad(r, ctx));
  const allValid = loads.length >= 1 && loads.every((l) => l.ok);
  const totalLoadW = loads.reduce((s, l) => s + (l.ok ? l.loadW : 0), 0);
  const totalUnitKW = loads.reduce((s, l) => s + (l.unit ? l.unit.coolKW * l.units : 0), 0);
  const totalUnitBTU = loads.reduce((s, l) => s + (l.unit ? l.unit.btu * l.units : 0), 0);
  const totalUnits = loads.reduce((s, l) => s + (l.ok ? l.units : 0), 0);
  const options = [];
  const warnings = [];
  if (allValid) {
    const n = loads.length;
    const monoP = monoPrice(loads, ctx.prices);
    const outdoor = n >= 2 && totalUnits === n ? pickOutdoor(loads, ctx) : null;
    options.push({
      kind: "mono",
      recommended: n <= 2 || !outdoor,
      title: totalUnits === 1 ? "1 aparelho mono-split" : `${totalUnits} aparelhos mono-split`,
      lines: totalUnits === 1
        ? ["1 unidade interior mural e 1 unidade exterior", "Instalação simples, normalmente num só dia", "Funciona em frio e em calor (bomba de calor)"]
        : [`${totalUnits} unidades interiores e ${totalUnits} unidades exteriores${totalUnits === n ? ", uma por divisão" : ""}`, "Cada unidade é independente: se uma avariar, as outras continuam", "Precisa de espaço na fachada ou varanda para cada unidade exterior"],
      price: monoP,
    });
    if (n >= 2 && totalUnits > n) {
      warnings.push({ level: "info", text: "Uma das divisões precisa de mais do que uma unidade; nesse caso comparamos só a solução mono-split. O técnico avalia um multi-split na visita." });
    } else if (n >= 2) {
      if (outdoor) {
        options.push({
          kind: "multi",
          recommended: n >= 3,
          title: `1 multi-split ${outdoor.label}`,
          lines: [
            `${n} unidades interiores ligadas a 1 unidade exterior de ${fmt(outdoor.coolKW, 1)} kW de frio${ctx.heating ? ` e ${fmt(outdoor.heatKW, 1)} kW de calor` : ""} (no verão as divisões raramente pedem o máximo todas ao mesmo tempo)`,
            "Só uma unidade exterior: menos espaço de fachada e menos ruído lá fora",
            "As divisões devem ficar perto umas das outras (tubagem até cerca de 20 m)",
          ],
          outdoor,
          price: multiPrice(loads, outdoor, ctx.prices),
        });
      } else {
        warnings.push({ level: "info", text: `Com esta potência total${ctx.heating ? " (e o aquecimento de todas as divisões ao mesmo tempo num dia frio)" : ""} não existe uma unidade exterior multi-split corrente que sirva todas as divisões. Sugerimos aparelhos mono-split ou dois multi-splits; o técnico confirma na visita.` });
      }
    }
    if (ctx.heating && loads.some((l) => l.heating && !l.heating.ok)) {
      warnings.push({ level: "warn", text: "Em pelo menos uma divisão a potência de aquecimento fica curta num dia frio. Veja a sugestão em cada divisão ou fale connosco." });
    }
  }
  return {
    rooms: loads,
    allValid,
    totalLoadW,
    totalLoadBTU: totalLoadW * W_TO_BTU,
    totalUnitKW,
    totalUnitBTU,
    totalUnits,
    options,
    warnings,
  };
}

// Texto simples: milhares com espaço ("9 000"), decimais com vírgula.


/** Resumo em texto simples para WhatsApp ou email. */
export function summaryText(project, rooms, ctx = {}) {
  const lines = ["Olá MDM Assist, fiz a calculadora de ar condicionado e gostaria de um orçamento gratuito.", ""];
  project.rooms.forEach((l, i) => {
    const name = rooms[i] && rooms[i].name && rooms[i].name.trim() ? rooms[i].name.trim() : `Divisão ${i + 1}`;
    const unit = l.units > 1 ? `${l.units} × ${fmt(l.unit.btu)} BTU (${fmt(l.unit.coolKW * l.units, 1)} kW)` : `${fmt(l.unit.btu)} BTU (${fmt(l.unit.coolKW, 1)} kW)`;
    lines.push(`- ${name}: ${fmt(l.room.area, 1)} m², ${l.labels.orientation}, ${l.labels.shading.toLowerCase()}, carga ${fmt(l.loadBTU)} BTU/h. Unidade: ${unit}`);
  });
  lines.push("", `Total: ${fmt(project.totalUnitBTU)} BTU/h (${fmt(project.totalUnitKW, 1)} kW de frio)`);
  const best = project.options.find((o) => o.recommended);
  if (best) lines.push(`Opção sugerida: ${best.title}`);
  if (ctx.heating) lines.push("Também quero aquecer no inverno.");
  if (ctx.postal) lines.push(`Código postal: ${ctx.postal}`);
  lines.push("", "Obrigado.");
  return lines.join("\n");
}
