/**
 * Quadro Elétrico — UI de montagem tipo eletricista.
 *
 * Arrasta módulos (geral, diferencial, disjuntores) para a calha DIN,
 * puxa ligações de parafuso a parafuso, liga os manípulos e vê as
 * proteções a dispararem como na vida real. Modelo/física em
 * panel_model.js (testado em Node); solver em circuit.js.
 */
import {
  DEVICE_TYPES,
  checkInstallation,
  computeState,
  deviceName,
  polesOf,
  ISSUE_TEXT,
} from "./panel_model.js";

const STORAGE_KEY = "mdm-quadro-eletrico";
const WELCOME_KEY = "mdm-quadro-eletrico-welcome";

const WORLD_W = 1000;
const WORLD_H = 640;

const COLORS = {
  brown: { hex: "#8a4b1f", label: "Castanho — fase" },
  blue: { hex: "#2563eb", label: "Azul — neutro" },
  pe: { hex: "#15803d", label: "Verde/Amarelo — terra" },
  black: { hex: "#1f2937", label: "Preto" },
};

const RAILS = [{ y: 168 }, { y: 330 }];
const RAIL_X0 = 280;
const RAIL_X1 = 840;
const DEV_H = 92;
const SUP = { L: { x: 300, y: 64 }, N: { x: 336, y: 64 } };
const NBAR = { x: 916, y0: 252, y1: 417, screws: 6 };
// Calhas técnicas (cablagem arrumada, como num quadro real).
const DUCTS = { D0: 99, D1: 250, D2: 409 };
const DUCT_H = 24;
const VDUCT = { x: 856, w: 26, y0: 87, y1: 421 };
const LOAD_Y = 506;
const LOAD_W = 162;
const LOAD_H = 112;

const LOADS_DEF = [
  { id: "luz", icon: "💡", name: "Iluminação", watts: 300 },
  { id: "coz", icon: "🔌", name: "Tomadas cozinha", watts: 2300 },
  { id: "maq", icon: "🌀", name: "Máquina de lavar", watts: 2000 },
  { id: "sala", icon: "📺", name: "Tomadas sala", watts: 800 },
];
const WATT_PRESETS = [100, 300, 800, 1500, 2000, 2300, 3000, 3600];

const canvas = document.getElementById("qd-canvas");
const ctx = canvas.getContext("2d");
const el = (id) => document.getElementById(id);
const statusEl = el("qd-status");
const tooltip = el("qd-tooltip");

let model = null;
let nextId = 1;
let state = null; // resultado de computeState
let wireCurrent = new Map(); // wireId -> corrente (sinal a->b)
let devCurrent = new Map(); // devId -> corrente no polo L
let selected = null; // {kind:'device'|'wire'|'load', id}
let hovered = null; // idem, para tooltip
let action = null;
let history = [];
let histIdx = -1;
const flowPhase = new Map();

// vista: escala fixa para caber
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// ---------------------------------------------------------------- modelo

function freshModel() {
  return {
    devices: [],
    wires: [],
    loads: LOADS_DEF.map((l) => ({ ...l, on: false, fault: false })),
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ model, nextId }));
}

function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!parsed?.model?.loads?.length) return false;
    model = parsed.model;
    nextId = parsed.nextId || 1;
    return true;
  } catch {
    return false;
  }
}

function refresh() {
  state = computeState(model);
  wireCurrent = new Map();
  devCurrent = new Map();
  for (const e of state.elements) {
    const r = state.solution.results.get(e.id);
    if (!r) continue;
    if (e.wireId != null) wireCurrent.set(e.wireId, r.current);
    if (e.devId && e.pole === "L") devCurrent.set(e.devId, Math.abs(r.current));
  }
  save();
  updateStatus();
  renderPanel();
}

function pushHistory() {
  history = history.slice(0, histIdx + 1);
  history.push(JSON.stringify({ model, nextId }));
  if (history.length > 100) history.shift();
  histIdx = history.length - 1;
  updateUndoButtons();
}

function restoreHistory(idx) {
  histIdx = idx;
  const s = JSON.parse(history[idx]);
  model = s.model;
  nextId = s.nextId;
  select(null);
  refresh();
  updateUndoButtons();
}

const undo = () => histIdx > 0 && restoreHistory(histIdx - 1);
const redo = () => histIdx < history.length - 1 && restoreHistory(histIdx + 1);
function updateUndoButtons() {
  el("qd-undo").disabled = histIdx <= 0;
  el("qd-redo").disabled = histIdx >= history.length - 1;
}

function mutate() {
  refresh();
  pushHistory();
}

// ------------------------------------------------------------- terminais

function deviceWidth(d) {
  return polesOf(d.type) === 2 ? 64 : 34;
}

/** Lista de terminais visíveis: {id, x, y, dx, dy, kind, name}. */
function terminals() {
  const list = [];
  list.push({ id: "SUP_L", x: SUP.L.x, y: SUP.L.y, dx: 0, dy: 1, kind: "L", name: "Alimentação — fase (L)" });
  list.push({ id: "SUP_N", x: SUP.N.x, y: SUP.N.y, dx: 0, dy: 1, kind: "N", name: "Alimentação — neutro (N)" });
  for (const d of model.devices) {
    const w = deviceWidth(d);
    const top = RAILS[d.rail].y - DEV_H / 2;
    const lx = d.x + (polesOf(d.type) === 2 ? 16 : w / 2);
    list.push({ id: d.id + ":Lin", x: lx, y: top + 8, dx: 0, dy: -1, kind: "L", name: "Entrada de fase" });
    list.push({ id: d.id + ":Lout", x: lx, y: top + DEV_H - 8, dx: 0, dy: 1, kind: "L", name: "Saída de fase" });
    if (polesOf(d.type) === 2) {
      list.push({ id: d.id + ":Nin", x: d.x + 48, y: top + 8, dx: 0, dy: -1, kind: "N", name: "Entrada de neutro" });
      list.push({ id: d.id + ":Nout", x: d.x + 48, y: top + DEV_H - 8, dx: 0, dy: 1, kind: "N", name: "Saída de neutro" });
    }
  }
  for (let k = 0; k < NBAR.screws; k++) {
    const y = NBAR.y0 + 14 + k * ((NBAR.y1 - NBAR.y0 - 28) / (NBAR.screws - 1));
    list.push({ id: "NBAR", pin: k, x: NBAR.x, y, dx: -1, dy: 0, kind: "N", name: "Barra de neutro (N)" });
  }
  model.loads.forEach((l, i) => {
    const x = loadX(i);
    list.push({ id: l.id + ":L", x: x + 52, y: LOAD_Y, dx: 0, dy: -1, kind: "L", name: l.name + " — fase" });
    list.push({ id: l.id + ":N", x: x + 110, y: LOAD_Y, dx: 0, dy: -1, kind: "N", name: l.name + " — neutro" });
  });
  return list;
}

function loadX(i) {
  return 258 + i * 180;
}

function terminalPos(id, pinHint) {
  const list = terminals().filter((t) => t.id === id);
  if (id === "NBAR" && list.length) return list[Math.min(pinHint ?? 0, list.length - 1)];
  return list[0];
}

function terminalNear(wx, wy) {
  let best = null;
  let dist = 12;
  for (const t of terminals()) {
    const d = Math.hypot(wx - t.x, wy - t.y);
    if (d < dist) {
      dist = d;
      best = t;
    }
  }
  return best;
}

// Cada ligação à barra de neutro usa um parafuso diferente (visual).
function nbarPin(wireId) {
  const ids = model.wires.filter((w) => w.a === "NBAR" || w.b === "NBAR").map((w) => w.id);
  return ids.indexOf(wireId) % NBAR.screws;
}

function wireEnds(w) {
  const pin = nbarPin(w.id);
  const a = terminalPos(w.a, pin);
  const b = terminalPos(w.b, pin);
  return { a, b };
}

/** Calha horizontal por onde um terminal encaminha o seu cabo. */
function ductOf(t) {
  if (t.id === "SUP_L" || t.id === "SUP_N") return DUCTS.D0;
  if (t.id === "NBAR") return null; // liga pela calha vertical
  const dev = model.devices.find((d) => t.id.startsWith(d.id + ":"));
  if (dev) {
    const isTop = t.dy === -1;
    return dev.rail === 0 ? (isTop ? DUCTS.D0 : DUCTS.D1) : isTop ? DUCTS.D1 : DUCTS.D2;
  }
  return DUCTS.D2; // circuitos em baixo
}

/** Rota ortogonal do cabo pelas calhas (com desvio por cabo = feixe). */
function wireRoute(w) {
  const { a, b } = wireEnds(w);
  if (!a || !b) return null;
  const lane = (((w.id * 7) % 5) - 2) * 3.4;
  const lv = (((w.id * 3) % 5) - 2) * 3.6;
  const vx = VDUCT.x + VDUCT.w / 2 + lv;
  const da = ductOf(a);
  const db = ductOf(b);
  const pts = [{ x: a.x, y: a.y }];
  if (da == null && db == null) {
    pts.push({ x: vx, y: a.y }, { x: vx, y: b.y });
  } else if (da == null) {
    pts.push({ x: vx, y: a.y }, { x: vx, y: db + lane }, { x: b.x, y: db + lane });
  } else if (db == null) {
    pts.push({ x: a.x, y: da + lane }, { x: vx, y: da + lane }, { x: vx, y: b.y });
  } else if (da === db) {
    pts.push({ x: a.x, y: da + lane }, { x: b.x, y: da + lane });
  } else {
    pts.push(
      { x: a.x, y: da + lane },
      { x: vx, y: da + lane },
      { x: vx, y: db + lane },
      { x: b.x, y: db + lane });
  }
  pts.push({ x: b.x, y: b.y });
  return pts;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function routePoint(pts, dist) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    if (acc + seg >= dist && seg > 0) {
      const t = (dist - acc) / seg;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    acc += seg;
  }
  return pts[pts.length - 1];
}

function routeLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return len;
}

function wireAt(wx, wy) {
  for (const w of model.wires) {
    const pts = wireRoute(w);
    if (!pts) continue;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(wx, wy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < 8) return w;
    }
  }
  return null;
}

function deviceAt(wx, wy) {
  for (const d of model.devices) {
    const w = deviceWidth(d);
    const top = RAILS[d.rail].y - DEV_H / 2;
    if (wx >= d.x && wx <= d.x + w && wy >= top && wy <= top + DEV_H) return d;
  }
  return null;
}

function loadAt(wx, wy) {
  for (let i = 0; i < model.loads.length; i++) {
    const x = loadX(i);
    if (wx >= x && wx <= x + LOAD_W && wy >= LOAD_Y && wy <= LOAD_Y + LOAD_H) return model.loads[i];
  }
  return null;
}

// ---------------------------------------------------------------- edição

function addDevice(type, rail, x) {
  const d = {
    id: "d" + nextId++,
    type,
    rating: type === "main" ? 63 : type === "rcd" ? 40 : 16,
    on: true,
    tripped: false,
    rail,
    x: snapDeviceX({ type }, rail, x),
  };
  model.devices.push(d);
  mutate();
  return d;
}

function snapDeviceX(dLike, rail, x) {
  const w = polesOf(dLike.type) === 2 ? 64 : 34;
  let nx = Math.round(Math.max(RAIL_X0, Math.min(RAIL_X1 - w, x)) / 4) * 4;
  // evitar sobreposição: empurra para a direita até haver espaço
  const others = model.devices.filter((o) => o.rail === rail && o !== dLike.self);
  for (let guard = 0; guard < 60; guard++) {
    const clash = others.find((o) => nx < o.x + deviceWidth(o) + 4 && o.x < nx + w + 4);
    if (!clash) break;
    nx = clash.x + deviceWidth(clash) + 6;
  }
  return Math.min(nx, RAIL_X1 - w);
}

function addWire(aTerm, bTerm) {
  if (!aTerm || !bTerm) return false;
  if (aTerm.id === bTerm.id && aTerm.id !== "NBAR") return false;
  if (aTerm.id === bTerm.id && aTerm.pin === bTerm.pin) return false;
  const dup = model.wires.some(
    (w) => (w.a === aTerm.id && w.b === bTerm.id) || (w.a === bTerm.id && w.b === aTerm.id));
  if (dup) return false;
  const color = aTerm.kind === "N" || bTerm.id === "NBAR" ? "blue" : aTerm.kind === "L" ? "brown" : "black";
  model.wires.push({ id: nextId++, a: aTerm.id, b: bTerm.id, color });
  mutate();
  return true;
}

function removeSelected() {
  if (!selected) return;
  if (selected.kind === "device") {
    model.devices = model.devices.filter((d) => d.id !== selected.id);
    model.wires = model.wires.filter((w) => !w.a.startsWith(selected.id + ":") && !w.b.startsWith(selected.id + ":"));
  } else if (selected.kind === "wire") {
    model.wires = model.wires.filter((w) => w.id !== selected.id);
  } else {
    return; // circuitos fixos não se removem
  }
  select(null);
  mutate();
}

function loadExample() {
  model = freshModel();
  nextId = 1;
  const g = { id: "g", type: "main", rating: 63, on: true, tripped: false, rail: 0, x: 300 };
  const dif = { id: "dif", type: "rcd", rating: 40, on: true, tripped: false, rail: 0, x: 400 };
  const qs = ["q1", "q2", "q3", "q4"].map((id, i) => ({
    id, type: "mcb", rating: [10, 16, 16, 16][i], on: true, tripped: false, rail: 1, x: 300 + i * 52,
  }));
  model.devices = [g, dif, ...qs];
  let wid = 1;
  const W = (a, b, color) => model.wires.push({ id: wid++, a, b, color });
  W("SUP_L", "g:Lin", "brown");
  W("SUP_N", "g:Nin", "blue");
  W("g:Lout", "dif:Lin", "brown");
  W("g:Nout", "dif:Nin", "blue");
  W("dif:Lout", "q1:Lin", "brown");
  W("q1:Lin", "q2:Lin", "brown");
  W("q2:Lin", "q3:Lin", "brown");
  W("q3:Lin", "q4:Lin", "brown");
  W("dif:Nout", "NBAR", "blue");
  model.loads.forEach((l, i) => {
    W(qs[i].id + ":Lout", l.id + ":L", "brown");
    W(l.id + ":N", "NBAR", "blue");
  });
  model.loads[0].on = true;
  model.loads[1].on = true;
  nextId = wid + 10;
  select(null);
  mutate();
}

// ------------------------------------------------------------- seleção/UI

function select(sel) {
  selected = sel;
  renderPanel();
}

function renderPanel() {
  const panel = el("qd-panel");
  if (!selected) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  const chips = el("qd-chips");
  const colors = el("qd-colors");
  const readout = el("qd-readout");
  chips.innerHTML = "";
  colors.innerHTML = "";
  colors.classList.add("hidden");
  el("qd-delete").classList.remove("hidden");

  if (selected.kind === "device") {
    const d = model.devices.find((x) => x.id === selected.id);
    if (!d) return panel.classList.add("hidden");
    el("qd-panel-title").textContent = deviceName(d);
    for (const r of DEVICE_TYPES[d.type].ratings) {
      const b = document.createElement("button");
      b.className = "chip" + (d.rating === r ? " on" : "");
      b.textContent = d.type === "mcb" ? `C${r}` : `${r} A`;
      b.addEventListener("click", () => {
        d.rating = r;
        mutate();
        renderPanel();
      });
      chips.appendChild(b);
    }
    const amps = devCurrent.get(d.id) || 0;
    readout.innerHTML =
      `Estado <b>${d.tripped ? "disparado 💥" : d.on ? "ligado" : "desligado"}</b><br>` +
      `Corrente <b>${amps.toFixed(1)} A</b> / ${d.rating} A`;
  } else if (selected.kind === "wire") {
    const w = model.wires.find((x) => x.id === selected.id);
    if (!w) return panel.classList.add("hidden");
    el("qd-panel-title").textContent = "Ligação";
    colors.classList.remove("hidden");
    for (const [key, c] of Object.entries(COLORS)) {
      const b = document.createElement("button");
      b.className = "swatch" + (key === "pe" ? " pe" : "") + (w.color === key ? " active" : "");
      b.dataset.color = key;
      if (key !== "pe") b.style.background = c.hex;
      b.title = c.label;
      b.addEventListener("click", () => {
        w.color = key;
        mutate();
        renderPanel();
      });
      colors.appendChild(b);
    }
    const i = Math.abs(wireCurrent.get(w.id) || 0);
    readout.innerHTML = `Corrente <b>${i < 0.05 ? "0" : i.toFixed(1)} A</b>`;
  } else {
    const l = model.loads.find((x) => x.id === selected.id);
    if (!l) return panel.classList.add("hidden");
    el("qd-panel-title").textContent = `${l.icon} ${l.name}`;
    for (const wts of WATT_PRESETS) {
      const b = document.createElement("button");
      b.className = "chip" + (l.watts === wts ? " on" : "");
      b.textContent = wts >= 1000 ? `${wts / 1000} kW` : `${wts} W`;
      b.addEventListener("click", () => {
        l.watts = wts;
        mutate();
        renderPanel();
      });
      chips.appendChild(b);
    }
    const fb = document.createElement("button");
    fb.className = "chip" + (l.fault ? " on" : "");
    fb.textContent = l.fault ? "⚠ Avaria ativa (fuga à terra)" : "⚠ Simular fuga à terra";
    fb.addEventListener("click", () => {
      l.fault = !l.fault;
      mutate();
      renderPanel();
    });
    chips.appendChild(fb);
    const amps = state.loadAmps.get(l.id) || 0;
    readout.innerHTML =
      `Interruptor <b>${l.on ? "ligado" : "desligado"}</b><br>` +
      `Corrente <b>${amps < 0.05 ? "0" : amps.toFixed(1)} A</b> · Potência <b>${l.watts} W</b>`;
    el("qd-delete").classList.add("hidden");
  }
}

el("qd-delete").addEventListener("click", removeSelected);
el("qd-undo").addEventListener("click", undo);
el("qd-redo").addEventListener("click", redo);
el("qd-clear").addEventListener("click", () => {
  model = freshModel();
  select(null);
  mutate();
});
el("qd-example").addEventListener("click", loadExample);
el("qd-helpbtn").addEventListener("click", () => el("qd-help").classList.remove("hidden"));
el("qd-help-close").addEventListener("click", () => {
  el("qd-help").classList.add("hidden");
  localStorage.setItem(WELCOME_KEY, "1");
});
el("qd-check-close").addEventListener("click", () => el("qd-check").classList.add("hidden"));

el("qd-verify").addEventListener("click", () => {
  const results = checkInstallation(model);
  const list = el("qd-check-list");
  list.innerHTML = "";
  for (const r of results) {
    const l = model.loads.find((x) => x.id === r.loadId);
    const li = document.createElement("li");
    li.className = r.ok ? "ok" : "bad";
    li.textContent = r.ok
      ? `✓ ${l.icon} ${l.name}: protegido como manda a regra (geral → diferencial → disjuntor, neutro na barra).`
      : `✗ ${l.icon} ${l.name}: ` + r.issues.map((i) => ISSUE_TEXT[i]).join("; ") + ".";
    list.appendChild(li);
  }
  if (model.devices.length === 0) {
    const li = document.createElement("li");
    li.className = "bad";
    li.textContent = "✗ O quadro está vazio — arrasta os módulos para a calha DIN.";
    list.prepend(li);
  }
  el("qd-check").classList.remove("hidden");
});

// paleta: arrastar módulos para a calha
for (const tile of document.querySelectorAll("[data-part]")) {
  tile.addEventListener("pointerdown", (e) => {
    action = { kind: "drop", type: tile.dataset.part, active: false };
    e.preventDefault();
  });
}

window.addEventListener("pointermove", (e) => {
  if (action?.kind !== "drop") return;
  const rect = canvas.getBoundingClientRect();
  const inside =
    e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  action.active = inside;
  if (inside) {
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    action.wx = w.x;
    action.wy = w.y;
  }
});

window.addEventListener("pointerup", () => {
  if (action?.kind !== "drop") return;
  const { type, active, wx, wy } = action;
  action = null;
  if (!active) return;
  const rail = Math.abs(wy - RAILS[0].y) <= Math.abs(wy - RAILS[1].y) ? 0 : 1;
  const d = addDevice(type, rail, wx - 20);
  select({ kind: "device", id: d.id });
});

// ------------------------------------------------------------ vista/input

function screenToWorld(sx, sy) {
  return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
}

function fitView() {
  scale = Math.min(canvas.clientWidth / WORLD_W, canvas.clientHeight / WORLD_H);
  offsetX = (canvas.clientWidth - WORLD_W * scale) / 2;
  offsetY = (canvas.clientHeight - WORLD_H * scale) / 2;
}

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  fitView();
}
window.addEventListener("resize", resize);

canvas.addEventListener("pointerdown", (e) => {
  tooltip.classList.add("hidden");
  if (e.button !== 0 || action) return;
  const rect = canvas.getBoundingClientRect();
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

  const term = terminalNear(w.x, w.y);
  if (term) {
    action = { kind: "wire", from: term, wx: w.x, wy: w.y };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  const dev = deviceAt(w.x, w.y);
  if (dev) {
    action = { kind: "movedev", dev, startWx: w.x, origX: dev.x, moved: false };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  action = { kind: "click", wx: w.x, wy: w.y };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

  if (action?.kind === "wire") {
    action.wx = w.x;
    action.wy = w.y;
    return;
  }
  if (action?.kind === "movedev") {
    const dx = w.x - action.startWx;
    if (Math.abs(dx) > 3) action.moved = true;
    action.dev.x = snapDeviceX(
      { type: action.dev.type, self: action.dev },
      action.dev.rail,
      action.origX + dx);
    return;
  }
  if (action) return;

  // hover / tooltip
  const term = terminalNear(w.x, w.y);
  const dev = !term && deviceAt(w.x, w.y);
  const wire = !term && !dev && wireAt(w.x, w.y);
  const load = !term && !dev && !wire && loadAt(w.x, w.y);
  hovered = dev ? { kind: "device", id: dev.id } : wire ? { kind: "wire", id: wire.id } : load ? { kind: "load", id: load.id } : null;
  canvas.style.cursor = term ? "crosshair" : dev || load ? "pointer" : wire ? "pointer" : "default";
  let text = null;
  if (term) text = term.name;
  else if (dev) text = `${deviceName(dev)} · ${(devCurrent.get(dev.id) || 0).toFixed(1)} A`;
  else if (wire) {
    const i = Math.abs(wireCurrent.get(wire.id) || 0);
    text = `${COLORS[wire.color]?.label || "Ligação"} · ${i < 0.05 ? "0" : i.toFixed(1)} A`;
  } else if (load) {
    const amps = state.loadAmps.get(load.id) || 0;
    text = `${load.name} · ${load.watts} W · ${amps < 0.05 ? "0" : amps.toFixed(1)} A`;
  }
  if (text) {
    tooltip.textContent = text;
    tooltip.style.left = e.clientX + 14 + "px";
    tooltip.style.top = e.clientY + 14 + "px";
    tooltip.classList.remove("hidden");
  } else {
    tooltip.classList.add("hidden");
  }
});

canvas.addEventListener("pointerup", (e) => {
  if (action?.kind === "drop") return;
  const a = action;
  action = null;
  if (!a) return;
  const rect = canvas.getBoundingClientRect();
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

  if (a.kind === "wire") {
    const target = terminalNear(w.x, w.y);
    const isClick = Math.hypot(w.x - a.from.x, w.y - a.from.y) < 6;
    if (!isClick) addWire(a.from, target);
    return;
  }
  if (a.kind === "movedev") {
    if (a.moved) {
      mutate();
    } else {
      const d = a.dev;
      // clique no manípulo liga/desliga/rearma; noutro sítio seleciona
      const top = RAILS[d.rail].y - DEV_H / 2;
      const inLever = w.y > top + 26 && w.y < top + DEV_H - 26;
      if (inLever) {
        if (d.tripped) {
          d.tripped = false;
          d.on = true;
        } else d.on = !d.on;
        mutate();
        if (selected?.id === d.id) renderPanel();
      } else {
        select({ kind: "device", id: d.id });
      }
    }
    return;
  }
  // clique simples
  const wire = wireAt(w.x, w.y);
  if (wire) return select({ kind: "wire", id: wire.id });
  const load = loadAt(w.x, w.y);
  if (load) {
    const x = loadX(model.loads.indexOf(load));
    if (w.x > x + LOAD_W - 34 && w.y > LOAD_Y + LOAD_H - 34) {
      load.fault = !load.fault;
    } else {
      load.on = !load.on;
    }
    select({ kind: "load", id: load.id });
    mutate();
    return;
  }
  select(null);
});

canvas.addEventListener("pointerleave", () => {
  tooltip.classList.add("hidden");
  hovered = null;
});

window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
  } else if ((e.key === "Delete" || e.key === "Backspace") && selected) removeSelected();
  else if (e.key === "Escape") {
    el("qd-help").classList.add("hidden");
    el("qd-check").classList.add("hidden");
    select(null);
  }
});

// ---------------------------------------------------------------- estado

const TRIP_TEXT = {
  sobrecarga: "sobrecarga — corrente a mais",
  curto: "curto-circuito",
  fuga: "fuga à terra",
};

let lastTripMsg = null;

function updateStatus() {
  const tripped = model.devices.filter((d) => d.tripped);
  if (state.events.length) {
    const ev = state.events[state.events.length - 1];
    const d = model.devices.find((x) => x.id === ev.devId);
    lastTripMsg = `💥 ${deviceName(d)} disparou (${TRIP_TEXT[ev.reason]}). Clica no manípulo para rearmar.`;
  }
  if (tripped.length) {
    setStatus(lastTripMsg || "💥 Há proteções disparadas — clica no manípulo para rearmar.", "error");
    return;
  }
  lastTripMsg = null;
  if (model.devices.length === 0) {
    setStatus("Arrasta os módulos para a calha DIN — primeiro o interruptor geral.", "ok");
    return;
  }
  if (model.wires.length === 0) {
    setStatus("Agora puxa as ligações: arrasta do parafuso L da alimentação até à entrada do geral.", "ok");
    return;
  }
  const ligados = model.loads.filter((l) => (state.loadAmps.get(l.id) || 0) > 0.05);
  if (ligados.length) {
    const watts = ligados.reduce((s, l) => s + l.watts, 0);
    setStatus(
      `✅ ${ligados.length} circuito(s) com energia · consumo total ${state.supplyAmps.toFixed(1)} A (${watts} W).`,
      "ok");
    return;
  }
  const anyOn = model.loads.some((l) => l.on);
  setStatus(
    anyOn
      ? "Ainda não chega energia — verifica as ligações e os manípulos, ou usa ✓ Verificar instalação."
      : "Tudo ligado no quadro? Clica num circuito lá em baixo para o pôr a consumir.",
    "ok");
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status-" + kind;
}

// --------------------------------------------------------------- desenho

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = "#eef2f7";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawEnclosure();
  drawSupply();
  drawNeutralBar();
  for (const [i] of model.loads.entries()) drawLoad(i, now);
  for (const w of model.wires) drawWire(w, dt, now);
  for (const d of model.devices) drawDevice(d, now);
  drawTerminals();

  if (action?.kind === "wire") {
    const from = action.from;
    ctx.strokeStyle = COLORS[from.kind === "N" ? "blue" : "brown"].hex;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([7, 6]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(action.wx, action.wy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  if (action?.kind === "drop" && action.active) {
    const w = polesOf(action.type) === 2 ? 64 : 34;
    const rail = Math.abs(action.wy - RAILS[0].y) <= Math.abs(action.wy - RAILS[1].y) ? 0 : 1;
    ctx.globalAlpha = 0.5;
    drawModuleBody(action.wx - 20, rail, w, action.type, { on: true, tripped: false, rating: action.type === "mcb" ? 16 : action.type === "rcd" ? 40 : 63, type: action.type }, now);
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}

function drawEnclosure() {
  // moldura creme do armário
  ctx.fillStyle = "#e9e3d5";
  ctx.strokeStyle = "#cfc7b4";
  ctx.lineWidth = 2;
  roundRect(240, 14, 740, 462, 10);
  ctx.fill();
  ctx.stroke();
  // réguas perfuradas em cima e em baixo (como na foto)
  for (const py of [22, 456]) {
    ctx.fillStyle = "#efe9dc";
    ctx.fillRect(252, py, 716, 14);
    ctx.fillStyle = "#c6bda8";
    for (let hx = 260; hx < 962; hx += 12) ctx.fillRect(hx, py + 4, 5, 6);
  }
  // placa de montagem interior
  ctx.fillStyle = "#eceef0";
  ctx.strokeStyle = "#c8ccd2";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(254, 40, 712, 412);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a8adb5";
  ctx.font = "700 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("QUADRO ELÉTRICO · 230 V", 954, 58);
  ctx.textAlign = "left";

  // calhas técnicas cinzentas (a cablagem corre por aqui)
  const ducts = Object.values(DUCTS).map((y) => ({ x: 266, y: y - DUCT_H / 2, w: VDUCT.x - 266 + VDUCT.w, h: DUCT_H }));
  ducts.push({ x: VDUCT.x, y: VDUCT.y0, w: VDUCT.w, h: VDUCT.y1 - VDUCT.y0 });
  for (const d of ducts) {
    ctx.fillStyle = "#99a0a8";
    ctx.strokeStyle = "#7e858d";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(d.x, d.y, d.w, d.h);
    ctx.fill();
    ctx.stroke();
    // ranhuras do pente
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (d.w > d.h) {
      for (let sx = d.x + 5; sx < d.x + d.w - 3; sx += 9) {
        ctx.moveTo(sx, d.y + 2);
        ctx.lineTo(sx, d.y + d.h - 2);
      }
    } else {
      for (let sy = d.y + 5; sy < d.y + d.h - 3; sy += 9) {
        ctx.moveTo(d.x + 2, sy);
        ctx.lineTo(d.x + d.w - 2, sy);
      }
    }
    ctx.stroke();
  }

  // calhas DIN metálicas
  for (const rail of RAILS) {
    ctx.fillStyle = "#d4d8dd";
    ctx.strokeStyle = "#a9afb7";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.rect(RAIL_X0 - 14, rail.y - 8, RAIL_X1 - RAIL_X0 + 42, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b9bfc7";
    for (let hx = RAIL_X0 - 8; hx < RAIL_X1 + 22; hx += 14) ctx.fillRect(hx, rail.y - 2, 6, 4);
  }

  // barra de terra decorativa (latão + verde/amarelo), como na foto
  ctx.fillStyle = "#c9a24a";
  ctx.strokeStyle = "#a3812f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(266, 428, 108, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(266, 424, 108, 3);
  ctx.fillStyle = "#facc15";
  for (let sx = 270; sx < 370; sx += 12) ctx.fillRect(sx, 424, 5, 3);
  ctx.fillStyle = "#8a8f97";
  ctx.font = "600 8px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("TERRA (PE)", 268, 449);
}

function drawSupply() {
  // cabo de entrada preto, como o cabo da rede na foto
  ctx.strokeStyle = "#2e3338";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(SUP.L.x + 18, 4);
  ctx.lineTo(SUP.L.x + 18, SUP.L.y - 20);
  ctx.stroke();
  ctx.fillStyle = "#e8e2d4";
  ctx.strokeStyle = "#b3ac9a";
  ctx.lineWidth = 1.5;
  roundRect(SUP.L.x - 22, SUP.L.y - 22, 80, 42, 5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#475569";
  ctx.font = "700 9.5px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("REDE 230 V", SUP.L.x + 18, SUP.L.y - 9);
  ctx.font = "600 8px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("L        N", SUP.L.x + 18, SUP.L.y + 15);
}

function drawNeutralBar() {
  // régua de bornes numerados (estilo Weidmüller), corpo bege e mola azul
  const h = NBAR.y1 - NBAR.y0;
  ctx.fillStyle = "#d8d2c4";
  ctx.strokeStyle = "#b3ac9a";
  ctx.lineWidth = 1.2;
  roundRect(NBAR.x - 13, NBAR.y0 - 6, 26, h + 12, 3);
  ctx.fill();
  ctx.stroke();
  const step = (h - 28) / (NBAR.screws - 1);
  for (let k = 0; k < NBAR.screws; k++) {
    const y = NBAR.y0 + 14 + k * step;
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(NBAR.x - 13, y - 9, 26, 3);
    ctx.fillStyle = "#e8e2d4";
    ctx.strokeStyle = "#b3ac9a";
    ctx.beginPath();
    ctx.rect(NBAR.x - 11, y - 6, 22, 15);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6b7280";
    ctx.font = "600 6.5px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(String(k + 1), NBAR.x + 6, y + 3);
  }
  ctx.save();
  ctx.translate(NBAR.x + 26, (NBAR.y0 + NBAR.y1) / 2);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = "#2563eb";
  ctx.font = "700 9px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("NEUTRO (N)", 0, 0);
  ctx.restore();
}

function drawDevice(d, now) {
  drawModuleBody(d.x, d.rail, deviceWidth(d), d.type, d, now);
}

function drawModuleBody(x, rail, w, type, d, now) {
  const top = RAILS[rail].y - DEV_H / 2;
  const cy = RAILS[rail].y;
  const isSel = selected?.kind === "device" && selected.id === d.id;
  // corpo branco-pérola tipo módulo modular real
  ctx.fillStyle = "#f7f5f0";
  ctx.strokeStyle = d.tripped ? (now % 500 < 250 ? "#ea580c" : "#f97316") : isSel ? "#1577d1" : "#b9bec5";
  ctx.lineWidth = isSel || d.tripped ? 2.4 : 1.3;
  roundRect(x, top, w, DEV_H, 3);
  ctx.fill();
  ctx.stroke();
  // sombras laterais (volume)
  ctx.fillStyle = "rgba(120,130,145,0.14)";
  ctx.fillRect(x + 1.5, top + 1.5, 3, DEV_H - 3);
  ctx.fillRect(x + w - 4.5, top + 1.5, 3, DEV_H - 3);
  // recessos dos terminais (cima/baixo)
  ctx.fillStyle = "#a9aeb5";
  ctx.fillRect(x + 4, top + 2, w - 8, 12);
  ctx.fillRect(x + 4, top + DEV_H - 14, w - 8, 12);
  // face central
  ctx.fillStyle = "#fdfcfa";
  roundRect(x + 3.5, top + 17, w - 7, DEV_H - 34, 2);
  ctx.fill();
  // manípulo cinzento (desliza)
  const on = d.on && !d.tripped;
  const leverY = cy - 8 + (on ? -8 : 4);
  ctx.fillStyle = "#5b6470";
  roundRect(x + w / 2 - (w > 40 ? 14 : 7), leverY, w > 40 ? 28 : 14, 16, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x + w / 2 - (w > 40 ? 14 : 7), leverY, w > 40 ? 28 : 14, 4);
  // bandeira de estado (verde ligado / vermelho desligado / laranja disparado)
  ctx.fillStyle = d.tripped ? "#f97316" : on ? "#16a34a" : "#dc2626";
  ctx.fillRect(x + w / 2 - 4, cy + 14, 8, 6);
  // janela transparente com o calibre
  ctx.fillStyle = "#e7edf3";
  ctx.strokeStyle = "#c6cfd8";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.rect(x + w / 2 - (w > 40 ? 16 : 10), top + 19, w > 40 ? 32 : 20, 11);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#334155";
  ctx.font = "700 8.5px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  const tag = type === "mcb" ? `C${d.rating}` : type === "rcd" ? `${d.rating}A 30mA` : `${d.rating}A`;
  ctx.fillText(tag, x + w / 2, top + 27.5);
  // botão de teste no diferencial (como nos reais)
  if (type === "rcd") {
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.arc(x + w - 12, cy - 2, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "600 5.5px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("T", x + w - 12, cy + 9);
  }
  // tipo do módulo
  ctx.fillStyle = "#8a919a";
  ctx.font = "600 6px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(type === "mcb" ? "DISJUNTOR" : type === "rcd" ? "DIFERENCIAL" : "GERAL", x + w / 2, top + DEV_H - 17.5);
}

function drawLoad(i, now) {
  const l = model.loads[i];
  const x = loadX(i);
  const amps = state.loadAmps.get(l.id) || 0;
  const live = amps > 0.05;
  const isSel = selected?.kind === "load" && selected.id === l.id;
  if (live) {
    ctx.fillStyle = "rgba(34,197,94,0.12)";
    roundRect(x - 4, LOAD_Y - 4, LOAD_W + 8, LOAD_H + 8, 14);
    ctx.fill();
  }
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = isSel ? "#1577d1" : live ? "#16a34a" : "#94a3b8";
  ctx.lineWidth = isSel ? 2.5 : 1.8;
  roundRect(x, LOAD_Y, LOAD_W, LOAD_H, 10);
  ctx.fill();
  ctx.stroke();
  ctx.font = "26px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(l.icon, x + LOAD_W / 2, LOAD_Y + 44);
  ctx.fillStyle = "#334155";
  ctx.font = "700 11.5px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(l.name, x + LOAD_W / 2, LOAD_Y + 64);
  ctx.font = "600 10.5px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = live ? "#16a34a" : "#94a3b8";
  ctx.fillText(
    live ? `ligado · ${amps.toFixed(1)} A · ${l.watts} W` : l.on ? "sem energia" : "desligado — clica para ligar",
    x + LOAD_W / 2, LOAD_Y + 84);
  // botão de avaria
  ctx.font = "13px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = l.fault ? "#dc2626" : "#cbd5e1";
  ctx.fillText("⚠", x + LOAD_W - 18, LOAD_Y + LOAD_H - 12);
}

function drawWire(w, dt, now) {
  const pts = wireRoute(w);
  if (!pts) return;
  const isSel = selected?.kind === "wire" && selected.id === w.id;
  const isHov = hovered?.kind === "wire" && hovered.id === w.id;
  if (isSel || isHov) {
    ctx.strokeStyle = isSel ? "rgba(21,119,209,0.4)" : "rgba(59,130,246,0.25)";
    ctx.lineWidth = 8;
    drawPath(pts);
  }
  ctx.strokeStyle = COLORS[w.color]?.hex || "#1f2937";
  ctx.lineWidth = 3.4;
  drawPath(pts);
  if (w.color === "pe") {
    ctx.strokeStyle = "#eab308";
    ctx.setLineDash([5, 7]);
    drawPath(pts);
    ctx.setLineDash([]);
  }
  // pontos de corrente ao longo da rota
  const i = wireCurrent.get(w.id) || 0;
  if (Math.abs(i) > 0.05) {
    const len = routeLength(pts);
    const speed = Math.max(-90, Math.min(90, i * 16));
    flowPhase.set(w.id, (((flowPhase.get(w.id) || 0) + speed * dt) % 22 + 22) % 22);
    for (let d = flowPhase.get(w.id); d < len; d += 22) {
      const p = routePoint(pts, d);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "#ff9f1c";
      ctx.fill();
    }
  }
}

function drawPath(pts) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) ctx.arcTo(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 7);
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
}

function drawTerminals() {
  for (const t of terminals()) {
    // parafuso de aperto com fenda, anel colorido pela função (L/N)
    ctx.beginPath();
    ctx.arc(t.x, t.y, 5.2, 0, Math.PI * 2);
    ctx.fillStyle = "#d6dade";
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = t.kind === "N" ? "#2563eb" : "#8a4b1f";
    ctx.stroke();
    ctx.strokeStyle = "#767d86";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(t.x - 3, t.y - 3);
    ctx.lineTo(t.x + 3, t.y + 3);
    ctx.stroke();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------------------ boot

if (!loadSaved()) {
  model = freshModel();
  loadExample();
} else {
  refresh();
}
history = [JSON.stringify({ model, nextId })];
histIdx = 0;
updateUndoButtons();
resize();
if (!localStorage.getItem(WELCOME_KEY)) el("qd-help").classList.remove("hidden");
requestAnimationFrame(frame);

// gancho para testes e2e
window.__qd = {
  model: () => model,
  state: () => state,
  toScreen: (wx, wy) => ({ x: wx * scale + offsetX, y: wy * scale + offsetY }),
  terminals,
};
