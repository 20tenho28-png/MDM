/**
 * Testes do modelo da calculadora de ar condicionado. Correr com:
 *   node ac-calculator/test/calc.test.mjs
 */
import assert from "node:assert/strict";
import {
  BUILDING_OPTIONS,
  EQUIPMENT_OPTIONS,
  K,
  LIMITS,
  MAX_WALL_UNIT_W,
  METHOD_PT,
  MULTI_OUTDOOR,
  ORIENTATIONS,
  SHADING_OPTIONS,
  UNIT_CLASSES,
  WINTER_ZONES,
  W_TO_BTU,
  ZONES,
  defaultRoom,
  parsePostal,
  pickOutdoor,
  pickUnit,
  postalInfo,
  roomLoad,
  sizeProject,
  summaryText,
  validateRoom,
} from "../calc_model.js";

const room = (over = {}) => Object.assign(defaultRoom(0), { area: 18, height: 260, windows: 2, people: 2 }, over);
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log("  ✓", name);
}

console.log("Modelo: validação");
test("divisão por preencher não é válida", () => {
  const r = defaultRoom(0);
  const v = validateRoom(r);
  assert.equal(v.ok, false);
  assert.ok(v.errors.area && v.errors.windows);
  assert.equal(v.errors.height, undefined, "altura tem default válido");
});
test("limites de área, altura, janelas e pessoas", () => {
  assert.equal(validateRoom(room({ area: 3 })).ok, false);
  assert.equal(validateRoom(room({ area: LIMITS.area.min })).ok, true);
  assert.equal(validateRoom(room({ height: 200 })).ok, false);
  assert.equal(validateRoom(room({ windows: -1 })).ok, false);
  assert.equal(validateRoom(room({ windows: 0 })).ok, true);
  assert.equal(validateRoom(room({ people: 2.5 })).ok, false);
  assert.equal(validateRoom(room({ people: 0 })).ok, true);
  assert.equal(validateRoom(room({ people: null })).ok, true, "pessoas é opcional");
  assert.equal(validateRoom(room({ area: NaN })).ok, false);
});
test("opções inválidas são rejeitadas", () => {
  assert.equal(validateRoom(room({ shading: "x" })).ok, false);
  assert.equal(validateRoom(room({ orientation: "x" })).ok, false);
});
test("ids das divisões são únicos", () => {
  const ids = new Set(Array.from({ length: 50 }, (_, i) => defaultRoom(i % 5).id));
  assert.equal(ids.size, 50);
});

console.log("Modelo: carga por componentes");
test("a carga é a soma dos componentes, clima só no que vem de fora, margem em tudo", () => {
  const r = room({ area: 20, height: 260, windows: 4, orientation: "S", shading: "none", people: 3 });
  const l = roomLoad(r, { zone: "V3", building: "mid" });
  assert.equal(l.ok, true);
  const volume = 20 * 2.6;
  close(l.parts.envelope, volume * K.envelopeWPerM3, 1e-6, "envolvente");
  close(l.parts.solar, 4 * K.solarWPerM2.S, 1e-6, "solar");
  close(l.parts.internal, 3 * K.personW + K.baseEquipmentW, 1e-6, "internos");
  assert.equal(l.parts.roof, 0);
  const expected = (l.parts.envelope + l.parts.solar) * ZONES.V3.factor * K.marginFactor + l.parts.internal * K.marginFactor;
  close(l.loadW, expected, K.roundW / 2 + 1e-6, "total");
  assert.equal(l.loadW % K.roundW, 0, "arredondado a 10 W");
  close(l.loadBTU, l.loadW * W_TO_BTU, K.roundW / 2 + 1e-6, "BTU");
  assert.equal(l.units, 1);
});
test("pessoas e equipamentos não mudam com o clima", () => {
  const r = room({ area: 20, windows: 0, people: 4, equipment: "kitchen" });
  const v1 = roomLoad(r, { zone: "V1" });
  const v3 = roomLoad(r, { zone: "V3" });
  const outside = (l) => (l.parts.envelope + l.parts.solar + l.parts.roof) * K.marginFactor;
  close(v3.loadW - v1.loadW, outside(v3) * (ZONES.V3.factor - ZONES.V1.factor), K.roundW + 1e-6, "só a parte exterior escala");
});
test("tetos baixos não reduzem a carga (altura mínima efetiva)", () => {
  const low = roomLoad(room({ height: 220 }), { zone: "V2" });
  const ref = roomLoad(room({ height: K.minHeightCm }), { zone: "V2" });
  assert.equal(low.loadW, ref.loadW);
  assert.ok(roomLoad(room({ height: 300 }), { zone: "V2" }).loadW > ref.loadW);
});
test("equipamentos: escritório e cozinha somam watts fixos", () => {
  const base = roomLoad(room({ equipment: "none" }), { zone: "V2" }).parts.internal;
  const office = roomLoad(room({ equipment: "office" }), { zone: "V2" }).parts.internal;
  const kitchen = roomLoad(room({ equipment: "kitchen" }), { zone: "V2" }).parts.internal;
  const w = (k) => EQUIPMENT_OPTIONS.find((o) => o.key === k).W;
  close(office - base, w("office"), 1e-6, "escritório");
  close(kitchen - base, w("kitchen"), 1e-6, "cozinha");
  assert.ok(w("kitchen") > w("office") && w("office") > 0);
  assert.equal(validateRoom(room({ equipment: "x" })).ok, false);
});
test("'não sei' no edifício dimensiona como edifício antigo", () => {
  const unknown = BUILDING_OPTIONS.find((o) => o.key === "unknown");
  const old = BUILDING_OPTIONS.find((o) => o.key === "old");
  assert.equal(unknown.cool, old.cool);
  assert.equal(roomLoad(room(), { building: "unknown" }).loadW, roomLoad(room(), { building: "old" }).loadW);
});
test("sala de 20 m² virada a sul com 4 m² de vidro fica entre 12k e 18k", () => {
  const l = roomLoad(room({ area: 20, windows: 4, orientation: "S", shading: "none", people: 3 }), { zone: "V2", building: "mid" });
  assert.equal(l.units, 1);
  assert.ok([12000, 18000].includes(l.unit.btu), `unidade ${l.unit.btu}`);
  assert.ok(l.loadBTU > 10000 && l.loadBTU < 18000, `carga ${l.loadBTU}`);
});
test("quarto de 12 m² a norte com 1,5 m² de vidro fica em 9k", () => {
  const l = roomLoad(room({ area: 12, windows: 1.5, orientation: "N", shading: "curtains", people: 2 }), { zone: "V2", building: "mid" });
  assert.equal(l.unit.btu, 9000);
});
test("mais sol, mais pessoas, cozinha e último andar aumentam a carga", () => {
  const base = roomLoad(room(), { zone: "V2" }).loadW;
  assert.ok(roomLoad(room({ orientation: "O" }), { zone: "V2" }).loadW > roomLoad(room({ orientation: "N" }), { zone: "V2" }).loadW);
  assert.ok(roomLoad(room({ people: 5 }), { zone: "V2" }).loadW > base);
  assert.ok(roomLoad(room({ equipment: "kitchen" }), { zone: "V2" }).loadW > base);
  assert.ok(roomLoad(room({ topFloor: true }), { zone: "V2" }).loadW > base);
  assert.ok(roomLoad(room({ shading: "blinds_out" }), { zone: "V2" }).loadW < base);
  assert.ok(roomLoad(room(), { zone: "V3" }).loadW > base);
  assert.ok(roomLoad(room(), { zone: "V1" }).loadW < base);
  const mid = roomLoad(room(), { zone: "V2", building: "mid" }).loadW;
  assert.ok(roomLoad(room(), { zone: "V2", building: "old" }).loadW > mid);
  assert.ok(roomLoad(room(), { zone: "V2", building: "new" }).loadW < mid);
  const g = (b) => roomLoad(room({ windows: 6 }), { zone: "V2", building: b }).parts.solar;
  assert.ok(g("old") > g("mid") && g("mid") > g("new"), "vidro antigo deixa entrar mais sol");
});
test("orientações a poente pesam mais do que a norte no verão", () => {
  assert.ok(K.solarWPerM2.O > K.solarWPerM2.S && K.solarWPerM2.S > K.solarWPerM2.N);
  for (const o of ORIENTATIONS) assert.ok(K.solarWPerM2[o.key] > 0, o.key);
  const f = SHADING_OPTIONS.map((s) => s.factor);
  assert.deepEqual(f, [...f].sort((a, b) => b - a), "sombreamento decrescente");
});
test("escolhe a unidade mais pequena que cobre a carga", () => {
  assert.equal(pickUnit(1000).btu, 9000);
  assert.equal(pickUnit(2500).btu, 9000);
  assert.equal(pickUnit(2501).btu, 12000);
  assert.equal(pickUnit(5000).btu, 18000);
  assert.equal(pickUnit(6999).btu, 24000);
  assert.equal(pickUnit(7001), null);
  for (let i = 1; i < UNIT_CLASSES.length; i++) {
    assert.ok(UNIT_CLASSES[i].coolKW > UNIT_CLASSES[i - 1].coolKW);
    assert.ok(UNIT_CLASSES[i].heatKW >= UNIT_CLASSES[i].coolKW, "bomba de calor dá mais calor do que frio");
  }
});
test("divisão minúscula avisa que 9k fica folgado", () => {
  const l = roomLoad(room({ area: 4, windows: 0, people: 0, orientation: "N" }), { zone: "V2" });
  assert.equal(l.unit.btu, 9000);
  assert.ok(l.warnings.some((w) => w.level === "info"), JSON.stringify(l.warnings));
});
test("espaço aberto enorme a poente passa de 24k: divide por várias unidades e avisa", () => {
  const l = roomLoad(room({ area: 60, windows: 15, orientation: "O", shading: "none", people: 6, equipment: "kitchen" }), { zone: "V3", building: "old" });
  assert.ok(l.loadW > MAX_WALL_UNIT_W, `carga ${l.loadW}`);
  assert.equal(l.units, Math.ceil(l.loadW / MAX_WALL_UNIT_W));
  assert.ok(l.units >= 2);
  assert.ok(l.unit && l.unit.coolKW * 1000 >= l.loadW / l.units, "cada unidade cobre a sua parte");
  assert.ok(l.ratio <= 1);
  assert.ok(l.warnings.some((w) => w.level === "warn" && w.text.includes("24 000")));
  const p = sizeProject([l.room], { zone: "V3", building: "old" });
  assert.equal(p.totalUnits, l.units);
  assert.equal(p.totalUnitBTU, l.unit.btu * l.units);
  assert.ok(p.options[0].title.startsWith(`${l.units} aparelhos`));
});
test("no limite da classe avisa e sugere a seguinte", () => {
  // Procura uma área que caia entre 95 % e 100 % de uma classe.
  let hit = null;
  for (let a = 8; a <= 40 && !hit; a += 0.5) {
    const l = roomLoad(room({ area: a, windows: 2, orientation: "S", people: 2 }), { zone: "V2", building: "mid" });
    if (l.ratio >= K.atLimitRatio && l.ratio <= 1) hit = l;
  }
  assert.ok(hit, "nenhuma área no limite");
  assert.ok(hit.warnings.some((w) => w.text.includes("No limite")), JSON.stringify(hit.warnings));
});
test("muito vidro para a área avisa", () => {
  const l = roomLoad(room({ area: 10, windows: 8 }), { zone: "V2" });
  assert.ok(l.warnings.some((w) => w.text.includes("vidro")));
});
test("divisão inválida devolve ok=false sem rebentar", () => {
  const l = roomLoad(room({ area: null }), { zone: "V2" });
  assert.equal(l.ok, false);
  assert.equal(l.unit, null);
  assert.equal(l.units, 0);
  assert.equal(l.loadW, 0);
});
test("zona ou edifício desconhecidos caem no default (V2, não sei)", () => {
  const a = roomLoad(room(), { zone: "V2", building: "unknown" }).loadW;
  const b = roomLoad(room(), { zone: "zz", building: "zz" }).loadW;
  assert.equal(a, b);
});

console.log("Modelo: exemplos de referência (regressão)");
test("divisões típicas de Lisboa caem na classe esperada", () => {
  const cases = [
    ["Quarto 12 m² a norte, 1,5 m² cortinas", room({ area: 12, windows: 1.5, orientation: "N", shading: "curtains", people: 2 }), "mid", 9000],
    ["Sala 20 m² a sul, 4 m² sem sombra, 3 pessoas", room({ area: 20, windows: 4, orientation: "S", shading: "none", people: 3 }), "mid", 12000],
    ["A mesma sala num prédio antigo", room({ area: 20, windows: 4, orientation: "S", shading: "none", people: 3 }), "old", 18000],
    ["Escritório 9 m² a poente, último andar, 2 PC", room({ area: 9, windows: 2, orientation: "O", shading: "none", people: 2, topFloor: true, equipment: "office" }), "mid", 9000],
    ["Cozinha 10 m² a nascente, estores interiores", room({ area: 10, windows: 1.5, orientation: "E", shading: "blinds_in", people: 2, equipment: "kitchen" }), "mid", 9000],
    ["Sala e cozinha 45 m² a sul, 6 m² cortinas, 4 pessoas", room({ area: 45, windows: 6, orientation: "S", shading: "curtains", people: 4, equipment: "kitchen" }), "mid", 24000],
  ];
  for (const [name, r, building, expected] of cases) {
    const l = roomLoad(r, { zone: "V2", building });
    assert.equal(l.units, 1, name);
    assert.equal(l.unit.btu, expected, `${name}: ${l.loadW} W -> ${l.unit.btu}`);
    const wPerM2 = l.loadW / r.area;
    assert.ok(wPerM2 >= 80 && wPerM2 <= 300, `${name}: ${wPerM2.toFixed(0)} W/m² fora da faixa plausível`);
  }
});

console.log("Modelo: aquecimento");
test("sem pedido de aquecimento não calcula", () => {
  assert.equal(roomLoad(room(), { zone: "V2" }).heating, null);
});
test("aquecimento de um quarto normal é coberto pela unidade", () => {
  const l = roomLoad(room({ area: 12, windows: 1.5, orientation: "N" }), { zone: "V2", heating: true, building: "mid" });
  assert.ok(l.heating);
  close(l.heating.loadW, 12 * 2.6 * K.heatingWPerM3, K.roundW / 2 + 1e-6, "carga de calor");
  assert.equal(l.heating.ok, true);
});
test("em Lisboa (I1) uma unidade dimensionada para o frio aquece bem", () => {
  for (const b of ["old", "mid", "new"]) {
    for (const r of [room({ area: 40, windows: 1, orientation: "N", shading: "blinds_out", people: 1 }), room({ area: 12, windows: 1.5, orientation: "N" }), room({ area: 25, windows: 4, orientation: "S", people: 3 })]) {
      const l = roomLoad(r, { zone: "V2", winter: "I1", heating: true, building: b });
      assert.equal(l.heating.ok, true, `${b} ${r.area} m²`);
    }
  }
});
test("inverno frio (I3), edifício antigo a norte: aquecimento fica curto e sugere maior", () => {
  const l = roomLoad(room({ area: 36, windows: 1, orientation: "N", shading: "blinds_out", people: 1 }), { zone: "V2", winter: "I3", heating: true, building: "old" });
  assert.equal(l.unit.btu, 18000, `frio pede ${l.unit.btu}`);
  close(l.heating.loadW, 36 * 2.6 * K.heatingWPerM3 * 1.25 * WINTER_ZONES.I3.factor, K.roundW / 2 + 1e-6, "carga de calor");
  close(l.heating.unitHeatKW, l.unit.heatKW * WINTER_ZONES.I3.derate, 1e-9, "capacidade num dia frio");
  assert.equal(l.heating.ok, false);
  assert.ok(l.heating.suggest && l.heating.suggest.btu > l.unit.btu, JSON.stringify(l.heating));
});
test("capacidade de calor cai com o frio: derate decrescente de I1 para I3", () => {
  assert.ok(WINTER_ZONES.I1.derate > WINTER_ZONES.I2.derate && WINTER_ZONES.I2.derate > WINTER_ZONES.I3.derate);
  assert.ok(WINTER_ZONES.I1.factor < WINTER_ZONES.I2.factor && WINTER_ZONES.I2.factor < WINTER_ZONES.I3.factor);
});

console.log("Modelo: código postal");
test("aceita 1990-426, 1990426 e com espaços", () => {
  for (const s of ["1990-426", "1990426", " 1990 - 426 "]) {
    const p = parsePostal(s);
    assert.equal(p.valid, true, s);
    assert.equal(p.formatted, "1990-426");
  }
});
test("rejeita códigos curtos, longos ou abaixo de 1000", () => {
  for (const s of ["", "199", "1990-42", "1990-4261", "0990-426", "abc"]) assert.equal(parsePostal(s).valid, false, s);
  assert.equal(postalInfo("0990-426").valid, false);
});
test("Lisboa e AML: zona V2 e dentro da área de intervenção", () => {
  for (const cp of ["1990-426", "1000-001", "2610-000", "2750-000", "2780-000", "2700-000", "2660-000", "2600-000", "2640-000", "2800-000", "2840-000", "2830-000", "2900-000", "2950-000", "2970-000", "2890-000", "2870-000"]) {
    const i = postalInfo(cp);
    assert.equal(i.valid, true, cp);
    assert.equal(i.inAML, true, cp);
    assert.equal(i.zone, "V2", cp);
  }
});
test("fora da AML: Torres Vedras, Santarém, Leiria, Évora, Porto", () => {
  for (const cp of ["2560-000", "2000-000", "2400-000", "7000-000", "4000-000"]) assert.equal(postalInfo(cp).inAML, false, cp);
});
test("zonas de verão: litoral norte V1, Lisboa V2, Alentejo e Algarve V3", () => {
  assert.equal(postalInfo("4000-000").zone, "V1");
  assert.equal(postalInfo("4700-000").zone, "V1");
  assert.equal(postalInfo("1000-000").zone, "V2");
  assert.equal(postalInfo("7000-000").zone, "V3");
  assert.equal(postalInfo("7800-000").zone, "V3");
  assert.equal(postalInfo("8000-000").zone, "V3");
  assert.equal(postalInfo("9000-000").zone, "V1");
  assert.equal(postalInfo("9500-000").zone, "V1");
  for (let p = 1000; p <= 9999; p += 1) {
    const i = postalInfo(`${p}-000`);
    assert.equal(i.valid, true, `prefixo ${p} sem cobertura`);
    assert.ok(ZONES[i.zone] && WINTER_ZONES[i.winter], `prefixo ${p} com zona inválida`);
  }
});
test("zonas de inverno: Lisboa I1, Porto I2, Bragança e Guarda I3", () => {
  assert.equal(postalInfo("1000-000").winter, "I1");
  assert.equal(postalInfo("4000-000").winter, "I2");
  assert.equal(postalInfo("5300-000").winter, "I3");
  assert.equal(postalInfo("6300-000").winter, "I3");
});

console.log("Modelo: projeto mono vs multi");
test("uma divisão: só mono-split", () => {
  const p = sizeProject([room()], { zone: "V2" });
  assert.equal(p.allValid, true);
  assert.equal(p.options.length, 1);
  assert.equal(p.options[0].kind, "mono");
  assert.equal(p.options[0].recommended, true);
  assert.equal(p.options[0].price, null, "sem tabela de preços não há euros");
  assert.equal(p.totalUnitBTU, p.rooms[0].unit.btu);
});
test("duas divisões: mono e multi, mono sugerido", () => {
  const p = sizeProject([room({ area: 12, windows: 1.5, orientation: "N" }), room({ area: 20, windows: 3, orientation: "S", people: 3 })], { zone: "V2", building: "mid" });
  assert.equal(p.options.length, 2);
  assert.equal(p.options.find((o) => o.kind === "mono").recommended, true);
  assert.equal(p.options.find((o) => o.kind === "multi").recommended, false);
  const multi = p.options.find((o) => o.kind === "multi");
  assert.equal(multi.outdoor.rooms, 2);
  assert.ok(multi.outdoor.coolKW >= K.simultaneity[2] * p.totalLoadW / 1000, "exterior cobre a carga com simultaneidade");
  assert.ok(multi.outdoor.coolKW * 1000 >= Math.max(...p.rooms.map((l) => l.loadW)), "exterior cobre a maior divisão");
  assert.ok(multi.outdoor.maxIndoorKW >= p.rooms[0].unit.coolKW + p.rooms[1].unit.coolKW, "soma das interiores cabe na exterior");
});
test("três divisões: multi sugerido", () => {
  const rooms = [room({ area: 12, windows: 1.5, orientation: "N" }), room({ area: 10, windows: 1, orientation: "E" }), room({ area: 22, windows: 2, orientation: "S", people: 2 })];
  const p = sizeProject(rooms, { zone: "V2", building: "mid" });
  const multi = p.options.find((o) => o.kind === "multi");
  assert.ok(multi, "sem opção multi");
  assert.equal(multi.recommended, true);
  assert.equal(multi.outdoor.label, "3×1");
});
test("três divisões maiores: passa para uma exterior 4×1 com 3 ligadas", () => {
  const rooms = [room({ area: 12, windows: 1.5, orientation: "N" }), room({ area: 16, windows: 2, orientation: "E" }), room({ area: 22, windows: 3, orientation: "S", people: 3 })];
  const p = sizeProject(rooms, { zone: "V2", building: "old" });
  assert.deepEqual(p.rooms.map((l) => l.unit.btu), [9000, 12000, 18000]);
  const multi = p.options.find((o) => o.kind === "multi");
  assert.ok(multi, "sem opção multi");
  assert.ok(multi.outdoor.rooms >= 3);
  assert.equal(multi.outdoor.label, "4×1");
  const indoorKW = p.rooms.reduce((s, l) => s + l.unit.coolKW, 0);
  assert.ok(multi.outdoor.maxIndoorKW >= indoorKW);
});
test("unidade exterior respeita a soma máxima de interiores", () => {
  for (const o of MULTI_OUTDOOR) assert.ok(o.maxIndoorKW >= o.coolKW, o.label);
  const big = () => room({ area: 30, windows: 6, orientation: "O", people: 3 });
  const loads = [roomLoad(big(), { zone: "V2", building: "mid" }), roomLoad(big(), { zone: "V2", building: "mid" })];
  assert.equal(loads[0].unit.btu, 24000, `carga ${loads[0].loadW}`);
  assert.equal(loads[0].units, 1);
  assert.equal(pickOutdoor(loads), null, "2 × 7 kW não cabe numa exterior multi corrente");
  const p = sizeProject(loads.map((l) => l.room), { zone: "V2", building: "mid" });
  assert.equal(p.options.length, 1);
  assert.ok(p.warnings.some((w) => w.text.includes("multi-split")));
});
test("divisão com várias unidades: só mono-split é comparado", () => {
  const huge = room({ area: 60, windows: 15, orientation: "O", people: 6, equipment: "kitchen" });
  const p = sizeProject([huge, room()], { zone: "V3", building: "old" });
  assert.ok(p.rooms[0].units >= 2);
  assert.equal(p.options.length, 1);
  assert.ok(p.warnings.some((w) => w.text.includes("mais do que uma unidade")));
  assert.equal(p.totalUnits, p.rooms[0].units + 1);
});
test("cinco divisões pequenas cabem num 5×1", () => {
  const rooms = Array.from({ length: 5 }, () => room({ area: 10, windows: 1, orientation: "N", people: 1 }));
  const p = sizeProject(rooms, { zone: "V2", building: "mid" });
  const multi = p.options.find((o) => o.kind === "multi");
  assert.ok(multi, "sem opção multi");
  assert.equal(multi.outdoor.label, "5×1");
});
test("uma divisão por preencher invalida o projeto mas não rebenta", () => {
  const p = sizeProject([room(), defaultRoom(1)], { zone: "V2" });
  assert.equal(p.allValid, false);
  assert.equal(p.options.length, 0);
});
test("tabela de preços opcional soma por classe", () => {
  const prices = { mono: { 9000: 900, 12000: 1000, 18000: 1400, 24000: 1800 }, multi: { outdoor: { 2: 1500 }, indoor: { 9000: 300, 12000: 400, 18000: 500, 24000: 700 } } };
  const p = sizeProject([room({ area: 12, windows: 1.5, orientation: "N" }), room({ area: 20, windows: 3, orientation: "S", people: 3 })], { zone: "V2", building: "mid", prices });
  const mono = p.options.find((o) => o.kind === "mono");
  const multi = p.options.find((o) => o.kind === "multi");
  const expectMono = p.rooms.reduce((s, l) => s + prices.mono[l.unit.btu], 0);
  assert.equal(mono.price, expectMono);
  assert.equal(multi.price, 1500 + p.rooms.reduce((s, l) => s + prices.multi.indoor[l.unit.btu], 0));
});
test("aviso global de aquecimento curto", () => {
  const p = sizeProject([room({ area: 36, windows: 1, orientation: "N", shading: "blinds_out", people: 1 })], { zone: "V2", winter: "I3", heating: true, building: "old" });
  assert.ok(p.warnings.some((w) => w.text.includes("aquecimento")));
});

console.log("Modelo: textos");
test("resumo para WhatsApp inclui divisões, total e código postal, sem travessões", () => {
  const rooms = [room({ name: "Sala", area: 20, windows: 3, orientation: "S", people: 3 }), room({ area: 12, windows: 1.5, orientation: "N" })];
  const p = sizeProject(rooms, { zone: "V2" });
  const t = summaryText(p, rooms, { zone: "V2", postal: "1990-426", heating: true });
  assert.ok(t.includes("Sala:"));
  assert.ok(t.includes("Divisão 2:"));
  assert.ok(t.includes("Total:"));
  assert.ok(t.includes("1990-426"));
  assert.ok(t.includes("inverno"));
  assert.ok(!t.includes("—"), "sem travessões");
});
test("texto do método em pt-PT sem travessões", () => {
  assert.ok(METHOD_PT.length > 200);
  assert.ok(!METHOD_PT.includes("—"));
  assert.ok(METHOD_PT.includes("3 412"));
});

console.log(`\n${passed} testes passaram.`);
