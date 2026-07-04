/**
 * Electric circuit simulator UI — EU edition.
 *
 * Schematic symbols follow IEC 60617; wire insulation colours follow EU
 * practice (HD 308: brown = line, blue = neutral, green/yellow = PE).
 *
 * Wiring model: wires are unit grid segments (so junctions work anywhere).
 * A single drag routes an L-shaped run; dragging from any part terminal
 * starts a wire; duplicate segments are ignored. Recolouring a wire applies
 * to its whole connected same-colour run.
 *
 * The circuit is re-solved on every change (solver in circuit.js). The
 * optional "Potentials" view tints every conductor by node voltage
 * (blue = lowest, red = highest) as a teaching aid.
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

// EU insulation colours (HD 308 S2 / IEC 60446).
const WIRE_COLORS = {
  brown: { hex: "#8a4b1f", label: "Brown — the feed wire, from the + side" },
  blue: { hex: "#2563eb", label: "Blue — the return wire, back to −" },
  pe: { hex: "#15803d", label: "Green/Yellow — safety earth" },
  black: { hex: "#1f2937", label: "Black" },
  grey: { hex: "#9ca3af", label: "Grey" },
  red: { hex: "#dc2626", label: "Red — DC positive" },
};
const DEFAULT_WIRE_COLOR = "brown";

const canvas = document.getElementById("sim-canvas");
const ctx = canvas.getContext("2d");
const el = (id) => document.getElementById(id);
const statusEl = el("sim-status");
const panel = el("sim-panel");
const tooltip = el("sim-tooltip");

let elements = [];
let nextId = 1;
let tool = "select";
let currentWireColor = DEFAULT_WIRE_COLOR;
let solution = solveCircuit(elements);
let selected = null;
let hovered = null;
let showLabels = true;
let potentialView = false;

// View transform: screen = world * scale + offset (in CSS px).
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// Pointer interaction state machine.
let action = null; // {kind: 'pan'|'place'|'move'|'drop', ...}
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
    for (const e of elements) {
      if (e.type === "wire" && !WIRE_COLORS[e.color]) e.color = DEFAULT_WIRE_COLOR;
    }
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

/** L-shaped route between two grid points (dominant axis first). */
function routeL(x1, y1, x2, y2) {
  if (x1 === x2 || y1 === y2) return [[x1, y1], [x2, y2]];
  if (Math.abs(x2 - x1) >= Math.abs(y2 - y1)) return [[x1, y1], [x2, y1], [x2, y2]];
  return [[x1, y1], [x1, y2], [x2, y2]];
}

function wireSegmentExists(x1, y1, x2, y2) {
  return elements.some(
    (e) =>
      e.type === "wire" &&
      ((e.x1 === x1 && e.y1 === y1 && e.x2 === x2 && e.y2 === y2) ||
        (e.x1 === x2 && e.y1 === y2 && e.x2 === x1 && e.y2 === y1)),
  );
}

/** Lay unit wire segments along a polyline path, skipping duplicates. */
function addWirePath(points, color = currentWireColor) {
  let added = false;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    for (let s = 0; s < steps; s++) {
      const x1 = ax + dx * s;
      const y1 = ay + dy * s;
      const x2 = x1 + dx;
      const y2 = y1 + dy;
      if (wireSegmentExists(x1, y1, x2, y2)) continue;
      elements.push({ id: nextId++, type: "wire", x1, y1, x2, y2, value: 0, color });
      added = true;
    }
  }
  if (added) {
    resolve();
    pushHistory();
  }
  return added;
}

function addPart(type, x1, y1, x2, y2) {
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
  if (!selected || selected.type === "wire") return;
  // Rotate 90° around terminal 1.
  const dx = selected.x2 - selected.x1;
  const dy = selected.y2 - selected.y1;
  selected.x2 = selected.x1 - dy;
  selected.y2 = selected.y1 + dx;
  resolve();
  pushHistory();
}

/** Recolour a wire and every wire connected to it that shares its colour. */
function recolorRun(wire, color) {
  const old = wire.color || DEFAULT_WIRE_COLOR;
  if (old === color) return;
  const byNode = new Map();
  for (const e of elements) {
    if (e.type !== "wire" || (e.color || DEFAULT_WIRE_COLOR) !== old) continue;
    for (const k of [nodeKey(e.x1, e.y1), nodeKey(e.x2, e.y2)]) {
      if (!byNode.has(k)) byNode.set(k, []);
      byNode.get(k).push(e);
    }
  }
  const stack = [wire];
  const seen = new Set([wire.id]);
  while (stack.length) {
    const w = stack.pop();
    w.color = color;
    for (const k of [nodeKey(w.x1, w.y1), nodeKey(w.x2, w.y2)]) {
      for (const n of byNode.get(k) || []) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          stack.push(n);
        }
      }
    }
  }
  resolve();
  pushHistory();
}

function loadExample() {
  elements = [];
  nextId = 1;
  const part = (type, x1, y1, x2, y2) =>
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
  const wire = (x1, y1, x2, y2, color) => addWireSilent(x1, y1, x2, y2, color);
  function addWireSilent(ax, ay, bx, by, color) {
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    for (let s = 0; s < steps; s++) {
      elements.push({
        id: nextId++,
        type: "wire",
        x1: ax + dx * s,
        y1: ay + dy * s,
        x2: ax + dx * (s + 1),
        y2: ay + dy * (s + 1),
        value: 0,
        color,
      });
    }
  }
  // 9 V battery -> switch -> lamp in parallel with a resistor.
  // EU colours: brown feed on the + side, blue return to the - terminal.
  part("battery", 6, 8, 6, 5);
  wire(6, 5, 10, 5, "brown");
  part("switch", 10, 5, 13, 5);
  wire(13, 5, 16, 5, "brown");
  wire(13, 5, 13, 6, "brown");
  part("lamp", 13, 6, 13, 9);
  wire(13, 9, 13, 10, "blue");
  wire(16, 5, 16, 6, "brown");
  part("resistor", 16, 6, 16, 9);
  wire(16, 9, 16, 10, "blue");
  wire(16, 10, 6, 10, "blue");
  wire(6, 10, 6, 8, "blue");
  select(null);
  resolve();
  pushHistory();
  fitView();
}

// ------------------------------------------------------------- selection

function select(target) {
  selected = target;
  if (!target) {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  el("sim-panel-title").textContent = PART_NAMES[target.type];
  const isWire = target.type === "wire";
  const hasValue = !isWire && target.type !== "switch";
  el("sim-value-row").classList.toggle("hidden", !hasValue);
  el("sim-panel-rotate").classList.toggle("hidden", isWire);
  if (hasValue) {
    el("sim-panel-unit").textContent = target.type === "battery" ? "V" : "Ω";
    el("sim-panel-value").value = target.value;
  }
  const chips = el("sim-chips");
  chips.innerHTML = "";
  if (isWire) {
    for (const [key, c] of Object.entries(WIRE_COLORS)) {
      const b = document.createElement("button");
      b.className = "swatch" + (key === "pe" ? " pe" : "");
      b.dataset.color = key;
      b.style.background = key === "pe" ? "" : c.hex;
      b.title = c.label;
      if ((target.color || DEFAULT_WIRE_COLOR) === key) b.classList.add("active");
      b.addEventListener("click", () => {
        recolorRun(target, key);
        select(target);
      });
      chips.appendChild(b);
    }
  } else {
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
el("sim-potentials").addEventListener("click", (e) => {
  potentialView = !potentialView;
  e.currentTarget.classList.toggle("active", potentialView);
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

for (const sw of document.querySelectorAll("#sim-wire-colors .swatch")) {
  sw.addEventListener("click", () => {
    currentWireColor = sw.dataset.color;
    for (const s of document.querySelectorAll("#sim-wire-colors .swatch")) {
      s.classList.toggle("active", s === sw);
    }
    setTool("wire");
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
  if (type === "wire") addWirePath([[gx - 1, gy], [gx + 1, gy]]);
  else addPart(type, gx - 1, gy, gx + 1, gy);
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

/** Part terminal near a world point — dragging from it starts a wire. */
function terminalAt(wx, wy) {
  for (const e of elements) {
    for (const [tx, ty] of [[e.x1, e.y1], [e.x2, e.y2]]) {
      if (Math.hypot(wx - tx * CELL, wy - ty * CELL) < 11) return { x: tx, y: ty };
    }
  }
  return null;
}

// ----------------------------------------------------------- canvas input

canvas.addEventListener("pointerdown", (e) => {
  tooltip.classList.add("hidden");
  if (action?.kind === "drop") return;
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
    // Dragging from any terminal starts a new wire (Tinkercad-style).
    const t = terminalAt(w.x, w.y);
    if (t) {
      action = { kind: "place", type: "wire", x1: t.x, y1: t.y, x2: t.x, y2: t.y, fromTerminal: true };
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

  // Placement tool: drag out a new part / wire run between grid points.
  action = { kind: "place", type: tool, x1: gx, y1: gy, x2: gx, y2: gy };
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const gx = Math.round(w.x / CELL);
  const gy = Math.round(w.y / CELL);

  if (action?.kind === "pan") {
    offsetX = action.ox + (e.clientX - action.startX);
    offsetY = action.oy + (e.clientY - action.startY);
    return;
  }
  if (action?.kind === "place") {
    if (action.type === "wire") {
      // Wires route freely with an automatic L-bend.
      action.x2 = gx;
      action.y2 = gy;
    } else if (Math.abs(gx - action.x1) >= Math.abs(gy - action.y1)) {
      // Parts stay straight along the dominant axis.
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

  // Idle: hover feedback.
  hovered = tool === "select" ? elementAt(w.x, w.y) : null;
  canvas.style.cursor =
    tool !== "select" ? "crosshair" : hovered ? "pointer" : terminalAt(w.x, w.y) ? "crosshair" : "default";
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
      if (a.type === "wire") {
        addWirePath(routeL(a.x1, a.y1, a.x2, a.y2));
      } else {
        addPart(a.type, a.x1, a.y1, a.x2, a.y2);
        setTool("select");
      }
    }
    return;
  }
  if (a.kind === "move") {
    if (a.moved) {
      resolve();
      pushHistory();
    } else if (a.el.type === "switch") {
      // A click: toggle switches, select everything else.
      a.el.closed = !a.el.closed;
      resolve();
      pushHistory();
      if (selected && selected.id === a.el.id) select(a.el);
    } else {
      select(a.el);
    }
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
      return WIRE_COLORS[e.color || DEFAULT_WIRE_COLOR].label.split(" — ")[0] + " wire";
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
let potentialRange = null; // {min, max} refreshed each frame in potential view

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  ctx.fillStyle = "#fafcff";
  ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawGrid();

  if (potentialView) {
    let min = Infinity;
    let max = -Infinity;
    for (const v of solution.voltages.values()) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    potentialRange = max > min ? { min, max } : null;
  } else {
    potentialRange = null;
  }

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

  if (action?.kind === "place" && (action.x1 !== action.x2 || action.y1 !== action.y2)) {
    if (action.type === "wire") {
      drawWirePreview(routeL(action.x1, action.y1, action.x2, action.y2));
    } else {
      drawElement(
        { id: -1, type: action.type, x1: action.x1, y1: action.y1, x2: action.x2, y2: action.y2, value: defaultValue(action.type), closed: false },
        { current: 0, voltage: 0, power: 0 }, false, now, true);
    }
  }
  if (action?.kind === "drop" && action.active) {
    drawElement(
      { id: -1, type: action.type, x1: action.gx - 1, y1: action.gy, x2: action.gx + 1, y2: action.gy, value: defaultValue(action.type), closed: false, color: currentWireColor },
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

function drawWirePreview(points) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = WIRE_COLORS[currentWireColor].hex;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0][0] * CELL, points[0][1] * CELL);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x * CELL, y * CELL);
  ctx.stroke();
  ctx.restore();
}

function drawJunctions() {
  const counts = new Map();
  for (const e of elements) {
    for (const k of [nodeKey(e.x1, e.y1), nodeKey(e.x2, e.y2)]) {
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  for (const [k, n] of counts) {
    const [x, y] = k.split(",").map(Number);
    ctx.beginPath();
    ctx.arc(x * CELL, y * CELL, n >= 3 ? 4 : 2.4, 0, Math.PI * 2);
    ctx.fillStyle = n >= 3 ? "#334155" : "#8fa0b5";
    ctx.fill();
  }
}

function drawStatus() {
  if (solution.singular) {
    setStatus("Two batteries are fighting each other on the same wires — remove one.", "warn");
    return;
  }
  if (solution.shorted) {
    setStatus("⚡ Short circuit! The current found a path with nothing to slow it down — put a lamp or resistor in the loop.", "error");
    return;
  }
  if (potentialView) {
    setStatus("Voltage colours are on: red wires are near +, blue wires are near −.", "ok");
    return;
  }
  // Plain-language coaching for people without an electrical background.
  if (elements.length === 0) {
    setStatus("Drag a part from the left panel onto the grid to start building.", "ok");
    return;
  }
  const hasBattery = elements.some((e) => e.type === "battery");
  if (!hasBattery) {
    setStatus("Add a battery — without a power source nothing will flow.", "ok");
    return;
  }
  let watts = 0;
  for (const e of elements) {
    if (e.type !== "battery") continue;
    const r = solution.results.get(e.id);
    if (r) watts += r.power;
  }
  if (watts < 1e-9) {
    const openSwitch = elements.some((e) => e.type === "switch" && !e.closed);
    setStatus(
      openSwitch
        ? "Nothing is flowing — a switch is open. Click it to close it."
        : "Nothing is flowing yet — connect the parts in a complete loop from + back to −.",
      "ok");
    return;
  }
  setStatus(`It works! The battery is delivering ${fmt(watts, "W")} of power.`, "ok");
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status-" + kind;
}

function potentialColor(e) {
  if (!potentialRange) return "#94a3b8";
  const v1 = solution.voltages.get(nodeKey(e.x1, e.y1)) ?? 0;
  const v2 = solution.voltages.get(nodeKey(e.x2, e.y2)) ?? 0;
  const t = ((v1 + v2) / 2 - potentialRange.min) / (potentialRange.max - potentialRange.min);
  const lerp = (a, b, u) => Math.round(a + (b - a) * u);
  const lo = [37, 99, 235]; // blue
  const mid = [148, 163, 184]; // grey
  const hi = [220, 38, 38]; // red
  const c =
    t < 0.5
      ? lo.map((v, i) => lerp(v, mid[i], t * 2))
      : mid.map((v, i) => lerp(v, hi[i], (t - 0.5) * 2));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

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
  const isWire = e.type === "wire";

  ctx.save();
  ctx.globalAlpha = ghost ? 0.45 : 1;

  // Conductor colour: EU insulation colour for wires, slate for parts,
  // node-potential colour in potential view, red flash when overloaded.
  let lineColor = isWire ? WIRE_COLORS[e.color || DEFAULT_WIRE_COLOR].hex : "#334155";
  if (potentialView && !ghost) lineColor = potentialColor(e);
  if (isOverloaded) lineColor = now % 460 < 230 ? "#dc2626" : "#f87171";
  ctx.lineCap = "round";

  // Selection / hover glow under the conductor.
  if (isSel || isHov) {
    ctx.strokeStyle = isSel ? "rgba(21,119,209,0.4)" : "rgba(59,130,246,0.22)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  }

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = isWire ? 3 : 2.4;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();

  // Green/yellow PE wires get their yellow stripe.
  if (isWire && (e.color || DEFAULT_WIRE_COLOR) === "pe" && !potentialView && !isOverloaded) {
    ctx.strokeStyle = "#eab308";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Animated current dots (white ring keeps them visible on any colour).
  const len = Math.hypot(bx - ax, by - ay);
  if (!ghost && len > 0 && Math.abs(r.current) > 1e-6 && !(e.type === "switch" && !e.closed)) {
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    const spacing = 15;
    const phase = ((flowPhase.get(e.id) || 0) % spacing + spacing) % spacing;
    for (let d = phase; d < len; d += spacing) {
      const px = ax + ux * d;
      const py = ay + uy * d;
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = isOverloaded ? "#ef4444" : "#ff9f1c";
      ctx.fill();
    }
  }

  // IEC 60617 symbol, drawn over the conductor with an opaque plate.
  ctx.strokeStyle = isOverloaded ? lineColor : isSel ? "#1577d1" : "#334155";
  ctx.lineWidth = 2.4;
  if (!isWire) {
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

  if (!ghost && showLabels && !isWire) {
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
    ctx.fillStyle = ctx.strokeStyle;
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
