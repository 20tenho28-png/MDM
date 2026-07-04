/**
 * Modelo puro do "Quadro Elétrico" (sem DOM) — traduz o quadro montado
 * (módulos na calha DIN + ligações puxadas entre terminais) para o solver
 * genérico em circuit.js, com comportamento de proteção realista:
 *
 *   - disjuntores (MCB) e DCP: disparo MAGNÉTICO instantâneo (~7×In,
 *     curva C) e disparo TÉRMICO temporizado acima de 1,13×In
 *     (via updateThermal, chamado periodicamente pela UI)
 *   - diferencial (RCD): mede fisicamente a corrente residual
 *     |I_fase + I_neutro| e dispara acima de 30 mA — apanha fugas à
 *     terra, o botão de teste (T) e neutros trocados entre grupos
 *   - interruptor geral: aparelho de CORTE, não dispara (como na
 *     vida real — um interruptor não é um disjuntor)
 *   - entrada da instalação: contador + DCP (potência contratada)
 *     entre a rede e os terminais de alimentação do quadro
 *   - cabos com secção (mm²): ampacidade Iz e regra "o disjuntor
 *     protege o cabo" na verificação da instalação
 *
 * Terminais (strings):
 *   'SUP_L' / 'SUP_N'      saída do DCP para o quadro (L = fase, N = neutro)
 *   '<dev>:Lin' ':Lout'    entrada/saída de fase de um módulo
 *   '<dev>:Nin' ':Nout'    entrada/saída de neutro (módulos bipolares)
 *   'NBAR' / 'NBAR2'       barras de neutro (uma por grupo diferencial)
 *   '<load>:L' '<load>:N'  terminais de um circuito de consumo
 * Internos: 'GRID_L/N' (rede), 'MET_L/N' (após contador), 'EARTH' (terra TT).
 */
import { solveCircuit } from "./circuit.js";

export const V_SUPPLY = 230;

// Diferencial
export const RCD_TRIP_A = 0.03; // 30 mA
export const EARTH_R = 20; // Ω — elétrodo de terra (regime TT)
export const FAULT_LEAK_R = 4700; // Ω — fuga à terra típica (~49 mA)
export const TEST_LEAK_R = 6800; // Ω — resistor do botão de teste (~34 mA)

// Curvas de disparo (curva C)
export const MAGNETIC_MULT = 7; // disparo magnético instantâneo ≈ 5–10×In
export const THERMAL_PICKUP = 1.13; // abaixo disto o térmico não atua
export const THERMAL_TAU = 6; // s — constante térmica (tempo acelerado p/ formação)

// Secções de cabo (mm²): ampacidade Iz e maior disjuntor admissível
export const SECTIONS = [1.5, 2.5, 4, 6, 10];
export const SECTION_AMPACITY = { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57 };
export const SECTION_MAX_BREAKER = { 1.5: 16, 2.5: 20, 4: 25, 6: 32, 10: 40 };
export const DEFAULT_SECTION = 2.5;

// Potência contratada (escalões PT) — calibre do DCP
export const DCP_STEPS = [
  { kva: 3.45, amps: 15 },
  { kva: 4.6, amps: 20 },
  { kva: 5.75, amps: 25 },
  { kva: 6.9, amps: 30 },
  { kva: 10.35, amps: 45 },
];

export const DEVICE_TYPES = {
  main: { poles: 2, ratings: [40, 63], name: "Interruptor geral", protects: false },
  rcd: { poles: 2, ratings: [25, 40, 63], name: "Diferencial 30 mA", protects: false },
  mcb: { poles: 1, ratings: [6, 10, 16, 20, 25], name: "Disjuntor", protects: true },
};

export function deviceName(d) {
  if (d === "DCP" || d?.id === "DCP") return "DCP (potência contratada)";
  if (d.type === "mcb") return `Disjuntor C${d.rating}`;
  if (d.type === "rcd") return `Diferencial ${d.rating} A / 30 mA`;
  return `Interruptor geral ${d.rating} A`;
}

export function polesOf(type) {
  return DEVICE_TYPES[type].poles;
}

export function sectionOf(w) {
  return w.section || DEFAULT_SECTION;
}

export function defaultEntry() {
  return { dcpRating: 30, dcpOn: true, dcpTripped: false, dcpHeat: 0 };
}

export function ensureEntry(model) {
  if (!model.entry) model.entry = defaultEntry();
  if (model.entry.dcpHeat == null) model.entry.dcpHeat = 0;
  return model.entry;
}

/** Elementos para o solver. Com forceConduct, tudo conduz (para verificação). */
export function buildElements(model, { forceConduct = false } = {}) {
  const entry = ensureEntry(model);
  const coord = new Map();
  let nextX = 0;
  const at = (t) => {
    if (!coord.has(t)) coord.set(t, nextX++);
    return coord.get(t);
  };
  const els = [];
  let id = 1;
  const sw = (a, b, closed, devId, pole) =>
    els.push({ id: id++, type: "switch", closed, value: 0, devId, pole, x1: at(a), y1: 0, x2: at(b), y2: 0 });
  const res = (a, b, value, extra = {}) =>
    els.push({ id: id++, type: "resistor", value, x1: at(a), y1: 0, x2: at(b), y2: 0, ...extra });

  // Rede -> contador -> DCP -> terminais do quadro
  els.push({ id: id++, type: "battery", x1: at("GRID_N"), y1: 0, x2: at("GRID_L"), y2: 0, value: V_SUPPLY });
  sw("GRID_L", "MET_L", true, "METER", "L");
  sw("GRID_N", "MET_N", true, "METER", "N");
  const dcpOn = forceConduct || (entry.dcpOn && !entry.dcpTripped);
  sw("MET_L", "SUP_L", dcpOn, "DCP", "L");
  sw("MET_N", "SUP_N", dcpOn, "DCP", "N");

  for (const d of model.devices) {
    const closed = forceConduct || (d.on && !d.tripped);
    sw(d.id + ":Lin", d.id + ":Lout", closed, d.id, "L");
    if (polesOf(d.type) === 2) sw(d.id + ":Nin", d.id + ":Nout", closed, d.id, "N");
  }

  let needsEarth = false;
  for (const l of model.loads) {
    if (l.on || forceConduct) {
      res(l.id + ":L", l.id + ":N", (V_SUPPLY * V_SUPPLY) / l.watts, { loadId: l.id });
    }
    // Fuga à terra: resistência de defeito do aparelho para a terra local.
    if (l.fault && (l.on || forceConduct)) {
      res(l.id + ":L", "EARTH", FAULT_LEAK_R, { faultOf: l.id });
      needsEarth = true;
    }
  }
  // Botão de teste do diferencial: desequilíbrio provocado a jusante.
  for (const d of model.devices) {
    if (d.type === "rcd" && d.testing) {
      res(d.id + ":Lout", "EARTH", TEST_LEAK_R, { testOf: d.id });
      needsEarth = true;
    }
  }
  // Regime TT: a terra local fecha o circuito até ao neutro da fonte.
  if (needsEarth) res("EARTH", "GRID_N", EARTH_R, { earth: true });

  for (const w of model.wires) {
    els.push({ id: id++, type: "wire", value: 0, wireId: w.id, x1: at(w.a), y1: 0, x2: at(w.b), y2: 0 });
  }
  return els;
}

/**
 * Caminho no grafo terminal-a-terminal; devolve módulos e cabos atravessados.
 */
export function pathBetween(model, start, target, { forceConduct = true } = {}) {
  const adj = new Map();
  const link = (a, b, dev, wire) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, dev, wire });
    adj.get(b).push({ to: a, dev, wire });
  };
  for (const w of model.wires) link(w.a, w.b, null, w);
  for (const d of model.devices) {
    if (!forceConduct && (!d.on || d.tripped)) continue;
    link(d.id + ":Lin", d.id + ":Lout", d.id, null);
    if (polesOf(d.type) === 2) link(d.id + ":Nin", d.id + ":Nout", d.id, null);
  }
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === target) {
      const devices = [];
      const wires = [];
      for (let t = target; prev.get(t); t = prev.get(t).from) {
        if (prev.get(t).dev) devices.push(prev.get(t).dev);
        if (prev.get(t).wire) wires.push(prev.get(t).wire);
      }
      return { reached: true, devices, wires };
    }
    for (const { to, dev, wire } of adj.get(cur) || []) {
      if (!prev.has(to)) {
        prev.set(to, { from: cur, dev, wire });
        queue.push(to);
      }
    }
  }
  return { reached: false, devices: [], wires: [] };
}

/**
 * Resolve o quadro e aplica disparos INSTANTÂNEOS até estabilizar:
 * magnético (curto) nos disjuntores/DCP e residual (30 mA) nos
 * diferenciais. O disparo térmico temporizado vive em updateThermal.
 */
export function computeState(model) {
  ensureEntry(model);
  const events = [];
  let solution = null;
  let elements = [];
  for (let guard = 0; guard < 12; guard++) {
    elements = buildElements(model);
    solution = solveCircuit(elements);
    const ampsOf = (devId, pole) => {
      const e = elements.find((x) => x.devId === devId && x.pole === pole);
      const r = e && solution.results.get(e.id);
      return r ? r.current : 0;
    };

    // candidato mais "esforçado" dispara primeiro (seletividade)
    let worst = null;
    const consider = (ratio, trip) => {
      if (ratio > 1 && (!worst || ratio > worst.ratio)) worst = { ratio, trip };
    };
    for (const d of model.devices) {
      if (!d.on || d.tripped) continue;
      if (d.type === "mcb") {
        const amps = Math.abs(ampsOf(d.id, "L"));
        consider(amps / (d.rating * MAGNETIC_MULT), () => {
          d.tripped = true;
          events.push({ kind: "trip", devId: d.id, reason: "curto", amps });
        });
      } else if (d.type === "rcd") {
        const residual = Math.abs(ampsOf(d.id, "L") + ampsOf(d.id, "N"));
        consider(residual / RCD_TRIP_A, () => {
          d.tripped = true;
          const reason = d.testing
            ? "teste"
            : model.loads.some((l) => l.fault && l.on)
              ? "fuga"
              : "desequilibrio";
          events.push({ kind: "trip", devId: d.id, reason, amps: residual });
        });
      }
      // 'main' é interruptor de corte: nunca dispara.
    }
    if (model.entry.dcpOn && !model.entry.dcpTripped) {
      const amps = Math.abs(ampsOf("DCP", "L"));
      consider(amps / (model.entry.dcpRating * MAGNETIC_MULT), () => {
        model.entry.dcpTripped = true;
        events.push({ kind: "trip", devId: "DCP", reason: "curto", amps });
      });
    }
    if (!worst) break;
    worst.trip();
  }

  const loadAmps = new Map();
  const wireAmps = new Map();
  const hotWires = new Set();
  const sectionById = new Map(model.wires.map((w) => [w.id, sectionOf(w)]));
  for (const e of elements) {
    const r = solution.results.get(e.id);
    if (!r) continue;
    if (e.loadId) loadAmps.set(e.loadId, Math.abs(r.current));
    if (e.wireId != null) {
      wireAmps.set(e.wireId, r.current);
      if (Math.abs(r.current) > (SECTION_AMPACITY[sectionById.get(e.wireId)] || 24)) {
        hotWires.add(e.wireId);
      }
    }
  }
  const supply = elements.find((e) => e.type === "battery");
  const supplyR = solution.results.get(supply.id);
  return {
    elements,
    solution,
    events,
    loadAmps,
    wireAmps,
    hotWires,
    supplyAmps: supplyR ? Math.abs(supplyR.current) : 0,
  };
}

/**
 * Disparo térmico temporizado (curva C, tempo acelerado THERMAL_TAU).
 * Chamar periodicamente com o estado atual; devolve eventos de disparo
 * (o chamador deve recomputar o estado se houver disparos).
 * Acumula "calor" em d.heat / entry.dcpHeat (0..1).
 */
export function updateThermal(model, state, dt) {
  ensureEntry(model);
  const events = [];
  const pickup2 = THERMAL_PICKUP * THERMAL_PICKUP;
  const ampsOf = (devId) => {
    const e = state.elements.find((x) => x.devId === devId && x.pole === "L");
    const r = e && state.solution.results.get(e.id);
    return r ? Math.abs(r.current) : 0;
  };
  const step = (holder, key, amps, rating, trip) => {
    const x = amps / rating;
    let heat = holder[key] || 0;
    if (x > THERMAL_PICKUP) heat += ((x * x - pickup2) * dt) / THERMAL_TAU;
    else heat = Math.max(0, heat - dt / (THERMAL_TAU * 2));
    holder[key] = Math.min(1.2, heat);
    if (holder[key] >= 1) {
      holder[key] = 0;
      trip(amps);
    }
  };
  for (const d of model.devices) {
    if (d.type !== "mcb" || !d.on || d.tripped) continue;
    step(d, "heat", ampsOf(d.id), d.rating, (amps) => {
      d.tripped = true;
      events.push({ kind: "trip", devId: d.id, reason: "sobrecarga", amps });
    });
  }
  if (model.entry.dcpOn && !model.entry.dcpTripped) {
    step(model.entry, "dcpHeat", ampsOf("DCP"), model.entry.dcpRating, (amps) => {
      model.entry.dcpTripped = true;
      events.push({ kind: "trip", devId: "DCP", reason: "potencia", amps });
    });
  }
  return events;
}

/**
 * Verificação de instalação (como um formador certificado):
 *  - fase por geral → diferencial → disjuntor; neutro de volta à fonte
 *  - o disjuntor protege o cabo (calibre ≤ máximo da menor secção)
 *  - neutros no grupo diferencial certo (sem neutros trocados)
 * Devolve por circuito: { loadId, ok, issues[], notes[] }.
 */
export function checkInstallation(model) {
  return model.loads.map((l) => {
    const issues = [];
    const notes = [];
    const pL = pathBetween(model, "SUP_L", l.id + ":L");
    const pN = pathBetween(model, "SUP_N", l.id + ":N");
    if (!pL.reached) {
      issues.push("sem_fase");
    } else {
      const devs = pL.devices.map((id) => model.devices.find((d) => d.id === id)).filter(Boolean);
      if (!devs.some((d) => d.type === "main")) issues.push("sem_geral");
      if (!devs.some((d) => d.type === "rcd")) issues.push("sem_diferencial");
      const mcbs = devs.filter((d) => d.type === "mcb");
      if (!mcbs.length) issues.push("sem_disjuntor");

      // "O disjuntor protege o cabo": menor secção do circuito vs. calibre.
      const wires = [...pL.wires, ...(pN.reached ? pN.wires : [])];
      if (wires.length && mcbs.length) {
        const minSection = Math.min(...wires.map(sectionOf));
        const maxBreaker = SECTION_MAX_BREAKER[minSection] || 16;
        for (const m of mcbs) {
          if (m.rating > maxBreaker) {
            issues.push("cabo_subdimensionado");
            notes.push(
              `cabo de ${String(minSection).replace(".", ",")} mm² protegido por C${m.rating} — usa no máximo C${maxBreaker} ou aumenta a secção`);
            break;
          }
        }
      }
    }
    if (!pN.reached) {
      issues.push("sem_neutro");
    } else if (pL.reached) {
      // Neutros trocados: os diferenciais do caminho de fase e de neutro
      // têm de ser os mesmos, senão o RCD dispara "sem razão aparente".
      const rcdsOf = (p) =>
        p.devices.filter((id) => model.devices.find((d) => d.id === id)?.type === "rcd").sort();
      const a = rcdsOf(pL).join(",");
      const b = rcdsOf(pN).join(",");
      if (a !== b) issues.push("neutro_trocado");
    }
    return { loadId: l.id, ok: issues.length === 0, issues, notes };
  });
}

export const ISSUE_TEXT = {
  sem_fase: "não recebe fase — puxa uma ligação castanha até ao terminal L",
  sem_geral: "a fase não passa pelo interruptor geral",
  sem_diferencial: "a fase não passa pelo diferencial — sem proteção de pessoas",
  sem_disjuntor: "a fase não passa por nenhum disjuntor — sem proteção do circuito",
  sem_neutro: "o neutro não volta à alimentação — liga-o à barra de neutro",
  cabo_subdimensionado: "o disjuntor não protege o cabo",
  neutro_trocado:
    "o neutro volta por outro grupo diferencial (neutros trocados) — o diferencial vai disparar sem razão aparente",
};
