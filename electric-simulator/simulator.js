/**
 * Electric circuit simulator UI — EU edition.
 *
 * Schematic symbols follow IEC 60617 (EU standard): resistor is a rectangle,
 * lamp a crossed circle, battery long/short plates. The editor aims for a
 * Tinkercad-like feel: light theme, parts palette with drag & drop, move and
 * rotate placed parts, pan/zoom, undo/redo, hover readouts and a first-run
 * guide. The circuit is re-solved on every change (solver in circuit.js).
 */
import { SHORT_AMPS, defaultValue, nodeKey, solveCircuit } from "./circuit.js";

const CELL = 40; // world px per grid cell
const STORAGE_KEY = "mdm-electric-simulator";
const WELCOME_KEY = "mdm-electric-simulator-welcome";

const PART_NAMES = {
  wire: "Wire",
  battery: "Battery",
  resistor: "Resistor",
  lamp: "Lamp",
  switch: "Switch",
};
// EU-common quick values shown as preset chips in the property panel.
const PRESETS = {
  battery: [1.5, 4.5, 9, 12, 24],
  resistor: [10, 47, 100, 220, 470, 1000],
  lamp: [6, 12, 24],
};

const canvas = document.getElementById("sim-canvas");
const ctx = canvas.getContext("2d");
const el = (id) => document.getElementById(id);
const statusEl = el("sim-status");
const panel = el("sim-panel");
const tooltip = el("sim-tooltip");

let elements = [];
let nextId = 1;
let tool = "select";
let solution = solveCircuit(elements);
let selected = null;
let hovered = null;
let showLabels = true;

// View transform: screen = world * scale + offset (in CSS px).
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Pointer interaction state machine.
let action = null; // {kind: 'pan'|'place'|'move'|'handle'|'drop', ...}
const flowPhase = new Map(); // element id -> animated current phase

let history = [];
let histIdx = -1;

// ---------------------------------------------------------------- storage

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    elements = parsed;
    nextId = elements.reduce((m, e) => Math.max(m, e.id), 0) + 1;
    return true;
  } catch {
    return false;
  }
}

function resolve() {
  solution = solveCircuit(elements);
  save();
}

function pushHistory() {
  history = history.slice(0, histIdx + 1);
  history.push(JSON.stringify(elements));
  if (history.length > 100) history.shift();
  histIdx = history.length - 1;
  updateUndoButtons();
}

function restoreHistory(idx) {
  histIdx = idx;
  elements = JSON.parse(history[idx]);
  nextId = elements.reduce((m, e) => Math.max(m, e.id), 0) + 1;
  select(null);
  resolve();
  updateUndoButtons();
}

function undo() {
  if (histIdx > 0) restoreHistory(histIdx - 1);
}

function redo() {
  if (histIdx < history.length - 1) restoreHistory(histIdx + 1);
}

function updateUndoButtons() {
  el("sim-undo").disabled = histIdx <= 0;
  el("sim-redo").disabled = histIdx >= history.length - 1;
}

// ---------------------------------------------------------------- editing

function addElement(type, x1, y1, x2, y2) {
  if (type === "wire") {
    // Split wires into unit segments so junctions work anywhere along them.
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    for (let i = 0; i < steps; i++) {
      elements.push({
        id: nextId++,
        type,
        x1: x1 + dx * i,
        y1: y1 + dy * i,
        x2: x1 + dx * (i + 1),
        y2: y1 + dy * (i + 1),
        value: 0,
        closed: false,
      });
    }
  } else {
    elements.push({
      id: nextId++,
      type,
      x1,
      y1,
      x2,
      y2,
      value: defaultValue(type),
      closed: type === "switch" ? false : undefined,
    });
  }
  resolve();
  pushHistory();
}

function removeElement(target) {
  elements = elements.filter((e) => e.id !== target.id);
  if (selected && selected.id === target.id) select(null);
  resolve();
  pushHistory();
}

function rotateSelected() {
  if (!selected) return;
  // Rotate 90° around terminal 1.
  const dx = selected.x2 - selected.x1;
  const dy = selected.y2 - selected.y1;
  selected.x2 = selected.x1 - dy;
  selected.y2 = selected.y1 + dx;
  resolve();
  pushHistory();
}

function loadExample() {
  elements = [];
  nextId = 1;
  const put = (type, x1, y1, x2, y2, extra = {}) =>
    elements.push({
      id: nextId++,
      type,
      x1,
      y1,
      x2,
      y2,
      value: defaultValue(type),
      closed: type === "switch" ? false : undefined,
      ...extra,
    });
  // 9 V battery -> switch -> lamp in parallel with a resistor.
  put("battery", 6, 8, 6, 5);
  for (let x = 6; x < 10; x++) put("wire", x, 5, x + 1, 5, { value: 0 });
  put("switch", 10, 5, 13, 5);
  for (let x = 13; x < 16; x++) put("wire", x, 5, x + 1, 5, { value: 0 });
  put("wire", 13, 5, 13, 6, { value: 0 });
  put("lamp", 13, 6, 13, 9);
  put("wire", 13, 9, 13, 10, { value: 0 });
  put("wire", 16, 5, 16, 6, { value: 0 });
  put("resistor", 16, 6, 16, 9);
  put("wire", 16, 9, 16, 10, { value: 0 });
  for (let x = 6; x < 16; x++) put("wire", x, 10, x + 1, 10, { value: 0 });
  put("wire", 6, 8, 6, 9, { value: 0 });
  put("wire", 6, 9, 6, 10, { value: 0 });
  select(null);
  resolve();
  pushHistory();
  fitView();
}

// ------------------------------------------------------------- selection

function select(target) {
  selected = target;
  if (!target || target.type === "wire") {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  el("sim-panel-title").textContent = PART_NAMES[target.type];
  const hasValue = target.type !== "switch";
  el("sim-value-row").classList.toggle("hidden", !hasValue);
  if (hasValue) {
    el("sim-panel-unit").textContent = target.type === "battery" ? "V" : "Ω";
    el("sim-panel-value").value = target.value;
  }
  const chips = el("sim-chips");
  chips.innerHTML = "";
  for (const v of PRESETS[target.type] || []) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = target.type === "battery" ? `${v} V` : v >= 1000 ? `${v / 1000} kΩ` : `${v} Ω`;
    b.addEventListener("click", () => {
      target.value = v;
      el("sim-panel-value").value = v;
      resolve();
      pushHistory();
    });
    chips.appendChild(b);
  }
  if (target.type === "switch") {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = target.closed ? "Open switch" : "Close switch";
    b.addEventListener("click", () => {
      target.closed = !target.closed;
      resolve();
      pushHistory();
      select(target);
    });
    chips.appendChild(b);
  }
  updateReadout();
}

function updateReadout() {
  if (!selected || panel.classList.contains("hidden")) return;
  const r = solution.results.get(selected.id) || { current: 0, voltage: 0, power: 0 };
  el("sim-readout").innerHTML =
    `Current <b>${fmt(Math.abs(r.current), "A")}</b><br>` +
    `Voltage <b>${fmt(Math.abs(r.voltage), "V")}</b><br>` +
    `Power <b>${fmt(Math.abs(r.power), "W")}</b>`;
}

el("sim-panel-value").addEventListener("input", () => {
  if (!selected) return;
  const v = parseFloat(el("sim-panel-value").value);
  if (Number.isFinite(v) && v > 0) {
    selected.value = v;
    resolve();
  }
});
el("sim-panel-value").addEventListener("change", pushHistory);
el("sim-panel-delete").addEventListener("click", () => selected && removeElement(selected));
el("sim-panel-rotate").addEventListener("click", rotateSelected);

// ---------------------------------------------------------------- topbar

el("sim-undo").addEventListener("click", undo);
el("sim-redo").addEventListener("click", redo);
el("sim-clear").addEventListener("click", () => {
  if (elements.length === 0) return;
  elements = [];
  select(null);
  resolve();
  pushHistory();
});
el("sim-example").addEventListener("click", loadExample);
el("sim-labels").addEventListener("click", (e) => {
  showLabels = !showLabels;
  e.currentTarget.classList.toggle("active", showLabels);
});
el("sim-helpbtn").addEventListener("click", () => el("sim-help").classList.remove("hidden"));
el("sim-help-close").addEventListener("click", () => {
  el("sim-help").classList.add("hidden");
  localStorage.setItem(WELCOME_KEY, "1");
});

// --------------------------------------------------------------- palette

function setTool(t) {
  tool = t;
  select(null);
  for (const tile of document.querySelectorAll("[data-tool]")) {
    tile.classList.toggle("active", tile.dataset.tool === t);
  }
  canvas.style.cursor = t === "select" ? "default" : "crosshair";
}

for (const tile of document.querySelectorAll("[data-tool]")) {
  tile.addEventListener("pointerdown", (e) => {
    const type = tile.dataset.tool;
    setTool(type);
    if (type === "select") return;
    // Drag from the palette onto the canvas drops a ready-made part.
    action = { kind: "drop", type, active: false };
    e.preventDefault();
  });
}

window.addEventListener("pointermove", (e) => {
  if (action?.kind !== "drop") return;
  const rect = canvas.getBoundingClientRect();
  const inCanvas =
    e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inCanvas) {
    action.active = false;
    return;
  }
  action.active = true;
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  action.gx = Math.round(w.x / CELL);
  action.gy = Math.round(w.y / CELL);
});

window.addEventListener("pointerup", () => {
  if (action?.kind !== "drop") return;
  const { type, active, gx, gy } = action;
  action = null;
  if (!active) return; // released without reaching the canvas: tool stays armed
  if (type === "wire") addElement(type, gx - 1, gy, gx + 1, gy);
  else addElement(type, gx - 1, gy, gx + 1, gy);
  setTool("select");
});

// ------------------------------------------------------------- transforms

function screenToWorld(sx, sy) {
  return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
}

function setZoom(newScale, anchorX, anchorY) {
  const s = Math.min(2.5, Math.max(0.35, newScale));
  const w = screenToWorld(anchorX, anchorY);
  offsetX = anchorX - w.x * s;
  offsetY = anchorY - w.y * s;
  scale = s;
  el("sim-zoom").textContent = Math.round(s * 100) + "%";
}

function fitView() {
  if (elements.length === 0) {
    scale = 1;
    offsetX = 40;
    offsetY = 20;
    el("sim-zoom").textContent = "100%";
    return;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of elements) {
    minX = Math.min(minX, e.x1, e.x2);
    maxX = Math.max(maxX, e.x1, e.x2);
    minY = Math.min(minY, e.y1, e.y2);
    maxY = Math.max(maxY, e.y1, e.y2);
  }
  const w = (maxX - minX + 4) * CELL;
  const h = (maxY - minY + 4) * CELL;
  const s = Math.min(2.5, Math.max(0.35, Math.min(canvas.clientWidth / w, canvas.clientHeight / h)));
  scale = s;
  offsetX = (canvas.clientWidth - (maxX + minX) * CELL * s) / 2;
  offsetY = (canvas.clientHeight - (maxY + minY) * CELL * s) / 2;
  el("sim-zoom").textContent = Math.round(s * 100) + "%";
}

el("sim-zoom-in").addEventListener("click", () =>
  setZoom(scale * 1.2, canvas.clientWidth / 2, canvas.clientHeight / 2));
el("sim-zoom-out").addEventListener("click", () =>
  setZoom(scale / 1.2, canvas.clientWidth / 2, canvas.clientHeight / 2));
el("sim-fit").addEventListener("click", fitView);

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  setZoom(scale * Math.exp(-e.deltaY * 0.0012), e.clientX - rect.left, e.clientY - rect.top);
}, { passive: false });

// ------------------------------------------------------------ hit testing

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function elementAt(wx, wy) {
  let best = null;
  let bestDist = 13;
  for (const e of elements) {
    const d = distToSegment(wx, wy, e.x1 * CELL, e.y1 * CELL, e.x2 * CELL, e.y2 * CELL);
    if (d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

function handleAt(wx, wy) {
  if (!selected) return 0;
  if (Math.hypot(wx - selected.x1 * CELL, wy - selected.y1 * CELL) < 10) return 1;
  if (Math.hypot(wx - selected.x2 * CELL, wy - selected.y2 * CELL) < 10) return 2;
  return 0;
}

// ----------------------------------------------------------- canvas input

canvas.addEventListener("pointerdown", (e) => {
  tooltip.classList.add("hidden");
  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    action = { kind: "pan", startX: e.clientX, startY: e.clientY, ox: offsetX, oy: offsetY };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const gx = Math.round(w.x / CELL);
  const gy = Math.round(w.y / CELL);

  if (tool === "select") {
    const handle = handleAt(w.x, w.y);
    if (handle) {
      action = { kind: "handle", el: selected, handle, moved: false };
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    const hit = elementAt(w.x, w.y);
    if (hit) {
      action = {
        kind: "move",
        el: hit,
        startGx: gx,
        startGy: gy,
        orig: { x1: hit.x1, y1: hit.y1, x2: hit.x2, y2: hit.y2 },
        moved: false,
      };
    } else {
      action = { kind: "pan", startX: e.clientX, startY: e.clientY, ox: offsetX, oy: offsetY, empty: true };
    }
    canvas.setPointerCapture(e.pointerId);
    return;
  }

  // Placement tool: drag out a new part between grid points.
  action = { kind: "place", type: tool, x1: gx, y1: gy, x2: gx, y2: gy };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const w = screenToWorld(sx, sy);
  const gx = Math.round(w.x / CELL);
  const gy = Math.round(w.y / CELL);

  if (action?.kind === "pan") {
    offsetX = action.ox + (e.clientX - action.startX);
    offsetY = action.oy + (e.clientY - action.startY);
    return;
  }
  if (action?.kind === "place") {
    // Straight segments only, along the dominant axis.
    if (Math.abs(gx - action.x1) >= Math.abs(gy - action.y1)) {
      action.x2 = gx;
      action.y2 = action.y1;
    } else {
      action.x2 = action.x1;
      action.y2 = gy;
    }
    return;
  }
  if (action?.kind === "move") {
    const dx = gx - action.startGx;
    const dy = gy - action.startGy;
    if (dx !== 0 || dy !== 0) action.moved = true;
    action.el.x1 = action.orig.x1 + dx;
    action.el.y1 = action.orig.y1 + dy;
    action.el.x2 = action.orig.x2 + dx;
    action.el.y2 = action.orig.y2 + dy;
    if (action.moved) solution = solveCircuit(elements);
    return;
  }
  if (action?.kind === "handle") {
    const a = action.el;
    const fixed = action.handle === 1 ? { x: a.x2, y: a.y2 } : { x: a.x1, y: a.y1 };
    let nx = gx;
    let ny = gy;
    if (Math.abs(nx - fixed.x) >= Math.abs(ny - fixed.y)) ny = fixed.y;
    else nx = fixed.x;
    if (nx === fixed.x && ny === fixed.y) return; // zero length not allowed
    if (action.handle === 1) {
      a.x1 = nx;
      a.y1 = ny;
    } else {
      a.x2 = nx;
      a.y2 = ny;
    }
    action.moved = true;
    solution = solveCircuit(elements);
    return;
  }

  // Idle: hover feedback.
  hovered = tool === "select" ? elementAt(w.x, w.y) : null;
  canvas.style.cursor =
    tool !== "select" ? "crosshair" : hovered ? "pointer" : "default";
  if (hovered) {
    const r = solution.results.get(hovered.id) || { current: 0, voltage: 0, power: 0 };
    tooltip.classList.remove("hidden");
    tooltip.style.left = e.clientX + 14 + "px";
    tooltip.style.top = e.clientY + 14 + "px";
    tooltip.textContent =
      `${label(hovered)}  ·  ${fmt(Math.abs(r.current), "A")}  ·  ` +
      `${fmt(Math.abs(r.voltage), "V")}  ·  ${fmt(Math.abs(r.power), "W")}`;
  } else {
    tooltip.classList.add("hidden");
  }
});

canvas.addEventListener("pointerup", (e) => {
  if (action?.kind === "drop") return; // handled by the window-level palette handler
  const a = action;
  action = null;
  if (!a) return;
  if (a.kind === "place") {
    if (a.x1 !== a.x2 || a.y1 !== a.y2) {
      addElement(a.type, a.x1, a.y1, a.x2, a.y2);
      if (a.type !== "wire") setTool("select");
    }
    return;
  }
  if (a.kind === "move") {
    if (a.moved) {
      resolve();
      pushHistory();
    } else {
      // A click: toggle switches, select everything else.
      if (a.el.type === "switch") {
        a.el.closed = !a.el.closed;
        resolve();
        pushHistory();
        if (selected && selected.id === a.el.id) select(a.el);
      } else {
        select(a.el);
      }
    }
    return;
  }
  if (a.kind === "handle" && a.moved) {
    resolve();
    pushHistory();
    return;
  }
  if (a.kind === "pan" && a.empty) {
    const moved = Math.hypot(e.clientX - a.startX, e.clientY - a.startY) > 4;
    if (!moved) select(null);
  }
});

canvas.addEventListener("pointerleave", () => {
  tooltip.classList.add("hidden");
  hovered = null;
});

// ---------------------------------------------------------------- keyboard

const TOOL_KEYS = { 1: "select", 2: "wire", 3: "battery", 4: "resistor", 5: "lamp", 6: "switch" };
window.addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
    return;
  }
  if (TOOL_KEYS[e.key]) setTool(TOOL_KEYS[e.key]);
  else if (e.key === "Escape") {
    el("sim-help").classList.add("hidden");
    select(null);
    setTool("select");
  } else if ((e.key === "Delete" || e.key === "Backspace") && selected) removeElement(selected);
  else if (e.key.toLowerCase() === "r") rotateSelected();
  else if (e.key === "+" || e.key === "=") setZoom(scale * 1.2, canvas.clientWidth / 2, canvas.clientHeight / 2);
  else if (e.key === "-") setZoom(scale / 1.2, canvas.clientWidth / 2, canvas.clientHeight / 2);
  else if (e.key === "0") fitView();
});

// ---------------------------------------------------------------- helpers

function label(e) {
  switch (e.type) {
    case "battery":
      return `${e.value} V`;
    case "resistor":
      return e.value >= 1000 ? `${e.value / 1000} kΩ` : `${e.value} Ω`;
    case "lamp":
      return `Lamp ${e.value} Ω`;
    case "switch":
      return e.closed ? "Switch (closed)" : "Switch (open)";
    default:
      return "Wire";
  }
}

function fmt(v, unit) {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(2) + " k" + unit;
  if (Math.abs(v) >= 1) return v.toFixed(2) + " " + unit;
  if (Math.abs(v) >= 1e-3) return (v * 1000).toFixed(1) + " m" + unit;
  if (Math.abs(v) >= 1e-6) return (v * 1e6).toFixed(1) + " µ" + unit;
  return "0 " + unit;
}

// ---------------------------------------------------------------- drawing

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
}
window.addEventListener("resize", resize);

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = "#fafcff";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawGrid();

  const overloaded = new Set();
  for (const e of elements) {
    const r = solution.results.get(e.id);
    if (r && Math.abs(r.current) > SHORT_AMPS) overloaded.add(e.id);
  }

  for (const e of elements) {
    const r = solution.results.get(e.id) || { current: 0, voltage: 0, power: 0 };
    const speed = Math.max(-120, Math.min(120, r.current * 80));
    flowPhase.set(e.id, (flowPhase.get(e.id) || 0) + speed * dt);
    drawElement(e, r, overloaded.has(e.id), now);
  }
  drawJunctions();
  if (selected) drawHandles(selected);

  if (action?.kind === "place" && (action.x1 !== action.x2 || action.y1 !== action.y2)) {
    drawElement(
      { id: -1, type: action.type, x1: action.x1, y1: action.y1, x2: action.x2, y2: action.y2, value: defaultValue(action.type), closed: false },
      { current: 0, voltage: 0, power: 0 }, false, now, true);
  }
  if (action?.kind === "drop" && action.active) {
    drawElement(
      { id: -1, type: action.type, x1: action.gx - 1, y1: action.gy, x2: action.gx + 1, y2: action.gy, value: defaultValue(action.type), closed: false },
      { current: 0, voltage: 0, power: 0 }, false, now, true);
  }

  drawStatus();
  updateReadout();
  requestAnimationFrame(frame);
}

function drawGrid() {
  const w0 = screenToWorld(0, 0);
  const w1 = screenToWorld(canvas.clientWidth, canvas.clientHeight);
  const x0 = Math.floor(w0.x / CELL);
  const x1 = Math.ceil(w1.x / CELL);
  const y0 = Math.floor(w0.y / CELL);
  const y1 = Math.ceil(w1.y / CELL);
  ctx.fillStyle = "#ccd6e4";
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      ctx.beginPath();
      ctx.arc(x * CELL, y * CELL, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function terminalCounts() {
  const counts = new Map();
  for (const e of elements) {
    for (const k of [nodeKey(e.x1, e.y1), nodeKey(e.x2, e.y2)]) {
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return counts;
}

function drawJunctions() {
  const counts = terminalCounts();
  for (const [k, n] of counts) {
    const [x, y] = k.split(",").map(Number);
    ctx.beginPath();
    ctx.arc(x * CELL, y * CELL, n >= 3 ? 4 : 2.4, 0, Math.PI * 2);
    ctx.fillStyle = n >= 3 ? "#334155" : "#8fa0b5";
    ctx.fill();
  }
}

function drawHandles(e) {
  for (const [x, y] of [[e.x1, e.y1], [e.x2, e.y2]]) {
    ctx.beginPath();
    ctx.arc(x * CELL, y * CELL, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1577d1";
    ctx.stroke();
  }
}

function drawStatus() {
  if (solution.singular) {
    setStatus("This circuit has no unique solution — check for conflicting batteries.", "warn");
  } else if (solution.shorted) {
    setStatus("⚡ Short circuit! A battery is connected with (almost) no resistance — add a load.", "error");
  } else {
    let watts = 0;
    for (const e of elements) {
      if (e.type !== "battery") continue;
      const r = solution.results.get(e.id);
      if (r) watts += r.power;
    }
    setStatus(
      elements.length === 0
        ? "Drag a part from the left panel onto the grid to start building."
        : `Total source power: ${fmt(watts, "W")}`,
      "ok");
  }
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status-" + kind;
}

const SYMBOL_HALF = { wire: 0, battery: 14, resistor: 22, lamp: 14, switch: 17 };

function drawElement(e, r, isOverloaded, now, ghost = false) {
  const ax = e.x1 * CELL;
  const ay = e.y1 * CELL;
  const bx = e.x2 * CELL;
  const by = e.y2 * CELL;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const angle = Math.atan2(by - ay, bx - ax);
  const isSel = selected && selected.id === e.id;
  const isHov = hovered && hovered.id === e.id;

  ctx.save();
  ctx.globalAlpha = ghost ? 0.45 : 1;
  let stroke = "#334155";
  if (isOverloaded) stroke = now % 460 < 230 ? "#dc2626" : "#f87171";
  else if (isSel) stroke = "#1577d1";
  else if (isHov) stroke = "#3b82f6";
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";

  // Full-span conductor line (symbol is drawn opaquely on top).
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Animated current dots.
  const len = Math.hypot(bx - ax, by - ay);
  if (!ghost && len > 0 && Math.abs(r.current) > 1e-6 && !(e.type === "switch" && !e.closed)) {
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const spacing = 15;
    const phase = ((flowPhase.get(e.id) || 0) % spacing + spacing) % spacing;
    ctx.fillStyle = isOverloaded ? "#ef4444" : "#ff9f1c";
    for (let d = phase; d < len; d += spacing) {
      ctx.beginPath();
      ctx.arc(ax + ux * d, ay + uy * d, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // IEC 60617 symbol, drawn over the conductor with an opaque plate.
  if (e.type !== "wire") {
    ctx.translate(mx, my);
    ctx.rotate(angle);
    switch (e.type) {
      case "battery":
        drawBattery();
        break;
      case "resistor":
        drawResistor();
        break;
      case "lamp":
        drawLamp(r);
        break;
      case "switch":
        drawSwitch(e);
        break;
    }
    ctx.rotate(-angle);
    ctx.translate(-mx, -my);
  }

  if (!ghost && showLabels && e.type !== "wire") {
    ctx.fillStyle = "#5b6b80";
    ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
    const horizontal = e.y1 === e.y2;
    ctx.textAlign = horizontal ? "center" : "left";
    const tx = horizontal ? mx : mx + 22;
    const ty = horizontal ? my - 24 : my - 4;
    ctx.fillText(label(e), tx, ty);
    if (Math.abs(r.current) > 1e-6) {
      ctx.fillStyle = "#e07b00";
      ctx.fillText(fmt(Math.abs(r.current), "A"), tx, ty + (horizontal ? 56 : 14));
    }
  }
  ctx.restore();

  function plate(w, h) {
    ctx.fillStyle = "#fafcff";
    ctx.fillRect(-w / 2, -h / 2, w, h);
  }

  function drawBattery() {
    plate(20, 34);
    ctx.beginPath();
    // IEC cell: short thick plate = "-" (terminal 1), long thin plate = "+".
    ctx.lineWidth = 4.5;
    ctx.moveTo(-5, -7);
    ctx.lineTo(-5, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.lineWidth = 2.2;
    ctx.moveTo(5, -15);
    ctx.lineTo(5, 15);
    ctx.stroke();
    // "+" mark near the positive terminal.
    ctx.beginPath();
    ctx.lineWidth = 1.8;
    ctx.moveTo(11, -14);
    ctx.lineTo(17, -14);
    ctx.moveTo(14, -17);
    ctx.lineTo(14, -11);
    ctx.stroke();
  }

  function drawResistor() {
    ctx.fillStyle = "#fafcff";
    ctx.beginPath();
    ctx.rect(-20, -9, 40, 18);
    ctx.fill();
    ctx.stroke();
  }

  function drawLamp(res) {
    const brightness = Math.min(1, Math.abs(res.power) / 5);
    if (brightness > 0.02) {
      const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 34);
      glow.addColorStop(0, `rgba(255, 200, 60, ${0.75 * brightness})`);
      glow.addColorStop(1, "rgba(255, 200, 60, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle =
      brightness > 0.02 ? `rgba(255, 226, 130, ${0.35 + 0.65 * brightness})` : "#fafcff";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const d = 12 / Math.SQRT2;
    ctx.beginPath();
    ctx.moveTo(-d, -d);
    ctx.lineTo(d, d);
    ctx.moveTo(-d, d);
    ctx.lineTo(d, -d);
    ctx.stroke();
  }

  function drawSwitch(sw) {
    plate(34, 30);
    ctx.beginPath();
    ctx.moveTo(-17, 0);
    ctx.lineTo(-13, 0);
    ctx.moveTo(13, 0);
    ctx.lineTo(17, 0);
    ctx.stroke();
    ctx.fillStyle = stroke;
    for (const px of [-12, 12]) {
      ctx.beginPath();
      ctx.arc(px, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    if (sw.closed) ctx.lineTo(12, 0);
    else ctx.lineTo(9, -13);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ boot

if (!load()) loadExample();
resolve();
history = [JSON.stringify(elements)];
histIdx = 0;
updateUndoButtons();
setTool("select");
el("sim-labels").classList.add("active");
resize();
fitView();
if (!localStorage.getItem(WELCOME_KEY)) el("sim-help").classList.remove("hidden");
requestAnimationFrame(frame);

// Test hook for end-to-end tests (world grid -> canvas CSS px).
window.__sim = {
  toScreen: (gx, gy) => ({ x: gx * CELL * scale + offsetX, y: gy * CELL * scale + offsetY }),
  elements: () => elements,
  results: () => Object.fromEntries(solution.results),
};
