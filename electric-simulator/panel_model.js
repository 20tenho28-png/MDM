/**
 * Modelo puro do "Quadro Elétrico" (sem DOM) — traduz o quadro montado
 * (módulos na calha DIN + ligações puxadas entre terminais) para o solver
 * genérico em circuit.js, e aplica o comportamento de proteção:
 *
 *   - disjuntor / interruptor geral dispara acima da corrente nominal
 *   - o diferencial (RCD) dispara quando um circuito com fuga à terra
 *     está alimentado através dele
 *   - curto-circuito faz disparar as proteções a montante
 *
 * Terminais são identificados por strings:
 *   'SUP_L' / 'SUP_N'      alimentação 230 V (L = fase, N = neutro)
 *   '<dev>:Lin' ':Lout'    entrada/saída de fase de um módulo
 *   '<dev>:Nin' ':Nout'    entrada/saída de neutro (módulos bipolares)
 *   'NBAR'                 barra de neutro (um só nó com vários parafusos)
 *   '<load>:L' '<load>:N'  terminais de um circuito de consumo
 */
import { solveCircuit } from "./circuit.js";

export const V_SUPPLY = 230;

export const DEVICE_TYPES = {
  main: { poles: 2, ratings: [40, 63], name: "Interruptor geral" },
  rcd: { poles: 2, ratings: [25, 40, 63], name: "Diferencial 30 mA" },
  mcb: { poles: 1, ratings: [6, 10, 16, 20, 25], name: "Disjuntor" },
};

export function deviceName(d) {
  if (d.type === "mcb") return `Disjuntor C${d.rating}`;
  if (d.type === "rcd") return `Diferencial ${d.rating} A / 30 mA`;
  return `Interruptor geral ${d.rating} A`;
}

export function polesOf(type) {
  return DEVICE_TYPES[type].poles;
}

/** Elementos para o solver. Com forceConduct, tudo conduz (para verificação). */
export function buildElements(model, { forceConduct = false } = {}) {
  const coord = new Map();
  let nextX = 0;
  const at = (t) => {
    if (!coord.has(t)) coord.set(t, nextX++);
    return coord.get(t);
  };
  const els = [];
  let id = 1;
  els.push({ id: id++, type: "battery", x1: at("SUP_N"), y1: 0, x2: at("SUP_L"), y2: 0, value: V_SUPPLY });
  for (const d of model.devices) {
    const closed = forceConduct || (d.on && !d.tripped);
    els.push({
      id: id++, type: "switch", closed, value: 0, devId: d.id, pole: "L",
      x1: at(d.id + ":Lin"), y1: 0, x2: at(d.id + ":Lout"), y2: 0,
    });
    if (polesOf(d.type) === 2) {
      els.push({
        id: id++, type: "switch", closed, value: 0, devId: d.id, pole: "N",
        x1: at(d.id + ":Nin"), y1: 0, x2: at(d.id + ":Nout"), y2: 0,
      });
    }
  }
  for (const l of model.loads) {
    if (!l.on && !forceConduct) continue;
    els.push({
      id: id++, type: "resistor", value: (V_SUPPLY * V_SUPPLY) / l.watts, loadId: l.id,
      x1: at(l.id + ":L"), y1: 0, x2: at(l.id + ":N"), y2: 0,
    });
  }
  for (const w of model.wires) {
    els.push({ id: id++, type: "wire", value: 0, wireId: w.id, x1: at(w.a), y1: 0, x2: at(w.b), y2: 0 });
  }
  return els;
}

/** Caminho no grafo terminal-a-terminal; devolve os módulos atravessados. */
export function pathBetween(model, start, target, { forceConduct = true } = {}) {
  const adj = new Map();
  const link = (a, b, dev) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ to: b, dev });
    adj.get(b).push({ to: a, dev });
  };
  for (const w of model.wires) link(w.a, w.b, null);
  for (const d of model.devices) {
    if (!forceConduct && (!d.on || d.tripped)) continue;
    link(d.id + ":Lin", d.id + ":Lout", d.id);
    if (polesOf(d.type) === 2) link(d.id + ":Nin", d.id + ":Nout", d.id);
  }
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === target) {
      const devices = [];
      for (let t = target; prev.get(t); t = prev.get(t).from) {
        if (prev.get(t).dev) devices.push(prev.get(t).dev);
      }
      return { reached: true, devices };
    }
    for (const { to, dev } of adj.get(cur) || []) {
      if (!prev.has(to)) {
        prev.set(to, { from: cur, dev });
        queue.push(to);
      }
    }
  }
  return { reached: false, devices: [] };
}

/**
 * Resolve o quadro e aplica disparos até estabilizar.
 * Muta `tripped` nos módulos; devolve solução, correntes e eventos.
 */
export function computeState(model) {
  const events = [];
  let solution = null;
  let elements = [];
  for (let guard = 0; guard < 12; guard++) {
    elements = buildElements(model);
    solution = solveCircuit(elements);
    // Seletividade: num defeito só dispara a proteção mais "esforçada"
    // (maior razão corrente/calibre) — normalmente a mais próxima do defeito.
    let trippedNow = false;
    let worst = null;
    for (const d of model.devices) {
      if (!d.on || d.tripped) continue;
      const sw = elements.find((e) => e.devId === d.id && e.pole === "L");
      const r = sw && solution.results.get(sw.id);
      if (!r) continue;
      const ratio = Math.abs(r.current) / (d.rating * 1.05);
      if (ratio > 1 && (!worst || ratio > worst.ratio)) {
        worst = { device: d, ratio, amps: Math.abs(r.current) };
      }
    }
    if (worst) {
      worst.device.tripped = true;
      trippedNow = true;
      events.push({
        kind: "trip",
        devId: worst.device.id,
        reason: solution.shorted ? "curto" : "sobrecarga",
        amps: worst.amps,
      });
    }
    // Fuga à terra: o diferencial dispara se alimenta um circuito avariado.
    for (const l of model.loads) {
      if (!l.on || !l.fault) continue;
      const p = pathBetween(model, "SUP_L", l.id + ":L", { forceConduct: false });
      if (!p.reached) continue;
      const load = elements.find((e) => e.loadId === l.id);
      const r = load && solution.results.get(load.id);
      if (!r || Math.abs(r.current) < 1e-3) continue;
      const rcdId = p.devices.find((id) => model.devices.find((d) => d.id === id)?.type === "rcd");
      if (rcdId) {
        const d = model.devices.find((x) => x.id === rcdId);
        if (!d.tripped) {
          d.tripped = true;
          trippedNow = true;
          events.push({ kind: "trip", devId: d.id, reason: "fuga", loadId: l.id });
        }
      }
    }
    if (!trippedNow) break;
  }

  const loadAmps = new Map();
  for (const e of elements) {
    if (!e.loadId) continue;
    const r = solution.results.get(e.id);
    loadAmps.set(e.loadId, r ? Math.abs(r.current) : 0);
  }
  const supply = elements.find((e) => e.type === "battery");
  const supplyR = solution.results.get(supply.id);
  return {
    elements,
    solution,
    events,
    loadAmps,
    supplyAmps: supplyR ? Math.abs(supplyR.current) : 0,
  };
}

/**
 * Verificação de instalação (como um formador): cada circuito deve receber
 * fase através de geral -> diferencial -> disjuntor, e ter o neutro ligado
 * de volta à alimentação (pela barra de neutro).
 */
export function checkInstallation(model) {
  return model.loads.map((l) => {
    const issues = [];
    const pL = pathBetween(model, "SUP_L", l.id + ":L");
    if (!pL.reached) {
      issues.push("sem_fase");
    } else {
      const types = pL.devices.map((id) => model.devices.find((d) => d.id === id)?.type);
      if (!types.includes("main")) issues.push("sem_geral");
      if (!types.includes("rcd")) issues.push("sem_diferencial");
      if (!types.includes("mcb")) issues.push("sem_disjuntor");
    }
    const pN = pathBetween(model, "SUP_N", l.id + ":N");
    if (!pN.reached) issues.push("sem_neutro");
    return { loadId: l.id, ok: issues.length === 0, issues };
  });
}

export const ISSUE_TEXT = {
  sem_fase: "não recebe fase — puxa uma ligação castanha até ao terminal L",
  sem_geral: "a fase não passa pelo interruptor geral",
  sem_diferencial: "a fase não passa pelo diferencial — sem proteção de pessoas",
  sem_disjuntor: "a fase não passa por nenhum disjuntor — sem proteção do circuito",
  sem_neutro: "o neutro não volta à alimentação — liga-o à barra de neutro",
};
