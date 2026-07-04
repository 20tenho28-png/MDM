/**
 * Electric circuit simulator UI: grid canvas editor + live solve/animation.
 *
 * Drag on the grid to place the selected component between two grid nodes.
 * The circuit is re-solved on every change; current flow is animated as
 * moving dashes whose speed and direction follow the branch current.
 */
import {
  SHORT_AMPS,
  defaultValue,
  nodeKey,
  solveCircuit,
} from "./circuit.js";

const CELL = 44; // px per grid cell
const STORAGE_KEY = "mdm-electric-simulator";

const canvas = document.getElementById("sim-canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("sim-status");
const panel = document.getElementById("sim-panel");
const panelTitle = document.getElementById("sim-panel-title");
const panelValue = document.getElementById("sim-panel-value");
const panelUnit = document.getElementById("sim-panel-unit");
const tooltip = document.getElementById("sim-tooltip");

let elements = [];
let nextId = 1;
let tool = "select";
let solution = solveCircuit(elements);
let selected = null; // element or null
let hovered = null;
let drag = null; // { x1, y1, x2, y2 } in grid coords while placing
let showLabels = true;
const dashOffsets = new Map(); // element id -> animated dash phase

// ---------------------------------------------------------------- helpers

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(elements));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return false;
    elements = parsed;
    nextId = elements.reduce((m, el) => Math.max(m, el.id), 0) + 1;
    return elements.length > 0;
  } catch {
    return false;
  }
}

function resolve() {
  solution = solveCircuit(elements);
  save();
}

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
}

function removeElement(el) {
  elements = elements.filter((e) => e.id !== el.id);
  if (selected && selected.id === el.id) select(null);
  resolve();
}

function loadExample() {
  elements = [];
  nextId = 1;
  // A 9 V battery drives a lamp (via a switch) in parallel with a resistor.
  addElement("battery", 6, 8, 6, 5);
  addElement("wire", 6, 5, 10, 5);
  addElement("switch", 10, 5, 13, 5);
  addElement("wire", 13, 5, 16, 5);
  addElement("lamp", 13, 6, 13, 9);
  addElement("wire", 13, 5, 13, 6);
  addElement("wire", 13, 9, 13, 10);
  addElement("resistor", 16, 6, 16, 9);
  addElement("wire", 16, 5, 16, 6);
  addElement("wire", 16, 9, 16, 10);
  addElement("wire", 6, 10, 16, 10);
  addElement("wire", 6, 8, 6, 10);
  select(null);
}

// ------------------------------------------------------------- selection

function select(el) {
  selected = el;
  if (!el || el.type === "wire" || el.type === "switch") {
    panel.classList.add("hidden");
    return;
  }
  panel.classList.remove("hidden");
  panelTitle.textContent = el.type === "battery" ? "Battery" : el.type === "lamp" ? "Lamp" : "Resistor";
  panelUnit.textContent = el.type === "battery" ? "V" : "Ω";
  panelValue.value = el.value;
}

panelValue.addEventListener("input", () => {
  if (!selected) return;
  const v = parseFloat(panelValue.value);
  if (Number.isFinite(v) && v > 0) {
    selected.value = v;
    resolve();
  }
});
document.getElementById("sim-panel-delete").addEventListener("click", () => {
  if (selected) removeElement(selected);
});

// ---------------------------------------------------------------- toolbar

for (const btn of document.querySelectorAll("[data-tool]")) {
  btn.addEventListener("click", () => setTool(btn.dataset.tool));
}
function setTool(t) {
  tool = t;
  select(null);
  for (const btn of document.querySelectorAll("[data-tool]")) {
    btn.classList.toggle("active", btn.dataset.tool === t);
  }
}
document.getElementById("sim-clear").addEventListener("click", () => {
  elements = [];
  select(null);
  resolve();
});
document.getElementById("sim-example").addEventListener("click", loadExample);
document.getElementById("sim-labels").addEventListener("click", (e) => {
  showLabels = !showLabels;
  e.currentTarget.classList.toggle("active", showLabels);
});

const TOOL_KEYS = { 1: "select", 2: "wire", 3: "battery", 4: "resistor", 5: "lamp", 6: "switch", 7: "delete" };
window.addEventListener("keydown", (e) => {
  if (e.target === panelValue) return;
  if (TOOL_KEYS[e.key]) setTool(TOOL_KEYS[e.key]);
  if (e.key === "Escape") select(null);
  if ((e.key === "Delete" || e.key === "Backspace") && selected) removeElement(selected);
});

// ------------------------------------------------------------ interaction

function gridFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((e.clientX - rect.left) / CELL),
    y: Math.round((e.clientY - rect.top) / CELL),
    px: e.clientX - rect.left,
    py: e.clientY - rect.top,
  };
}

function elementAt(px, py) {
  let best = null;
  let bestDist = 10;
  for (const el of elements) {
    const d = distToSegment(px, py, el.x1 * CELL, el.y1 * CELL, el.x2 * CELL, el.y2 * CELL);
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

canvas.addEventListener("mousedown", (e) => {
  const g = gridFromEvent(e);
  if (tool === "select") {
    const el = elementAt(g.px, g.py);
    if (el && el.type === "switch") {
      el.closed = !el.closed;
      resolve();
      return;
    }
    select(el);
    return;
  }
  if (tool === "delete") {
    const el = elementAt(g.px, g.py);
    if (el) removeElement(el);
    return;
  }
  drag = { x1: g.x, y1: g.y, x2: g.x, y2: g.y };
});

canvas.addEventListener("mousemove", (e) => {
  const g = gridFromEvent(e);
  if (drag) {
    // Force the segment straight along the dominant axis.
    if (Math.abs(g.x - drag.x1) >= Math.abs(g.y - drag.y1)) {
      drag.x2 = g.x;
      drag.y2 = drag.y1;
    } else {
      drag.x2 = drag.x1;
      drag.y2 = g.y;
    }
    return;
  }
  hovered = elementAt(g.px, g.py);
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

canvas.addEventListener("mouseleave", () => {
  tooltip.classList.add("hidden");
  hovered = null;
});

window.addEventListener("mouseup", () => {
  if (!drag) return;
  const { x1, y1, x2, y2 } = drag;
  drag = null;
  if (x1 !== x2 || y1 !== y2) addElement(tool, x1, y1, x2, y2);
});

// ---------------------------------------------------------------- drawing

function label(el) {
  switch (el.type) {
    case "battery":
      return `${el.value} V`;
    case "resistor":
      return `${el.value} Ω`;
    case "lamp":
      return `Lamp ${el.value} Ω`;
    case "switch":
      return el.closed ? "Switch (closed)" : "Switch (open)";
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

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener("resize", resize);

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  drawGrid();

  const overloaded = new Set();
  for (const el of elements) {
    const r = solution.results.get(el.id);
    if (r && Math.abs(r.current) > SHORT_AMPS) overloaded.add(el.id);
  }

  for (const el of elements) {
    const r = solution.results.get(el.id) || { current: 0, voltage: 0, power: 0 };
    // Advance dash phase: speed proportional to current, capped for legibility.
    const speed = Math.max(-90, Math.min(90, r.current * 60));
    dashOffsets.set(el.id, (dashOffsets.get(el.id) || 0) - speed * dt);
    drawElement(el, r, overloaded.has(el.id), now);
  }
  if (drag && (drag.x1 !== drag.x2 || drag.y1 !== drag.y2)) {
    drawElement(
      { id: -1, type: tool, ...drag, value: defaultValue(tool), closed: false },
      { current: 0, voltage: 0, power: 0 },
      false,
      now,
      true,
    );
  }
  drawStatus();
  requestAnimationFrame(frame);
}

function drawGrid() {
  ctx.fillStyle = "#1f2733";
  for (let x = 0; x * CELL <= canvas.clientWidth; x++) {
    for (let y = 0; y * CELL <= canvas.clientHeight; y++) {
      ctx.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
    }
  }
}

function drawStatus() {
  if (solution.singular) {
    setStatus("Circuit has no unique solution — check for conflicting batteries.", "warn");
  } else if (solution.shorted) {
    setStatus("⚡ Short circuit! A battery is connected with (almost) no resistance.", "error");
  } else {
    let watts = 0;
    for (const el of elements) {
      if (el.type !== "battery") continue;
      const r = solution.results.get(el.id);
      if (r) watts += r.power;
    }
    setStatus(
      elements.length === 0
        ? "Pick a component and drag on the grid to build a circuit."
        : `Total source power: ${fmt(watts, "W")}`,
      "ok",
    );
  }
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = "status-" + kind;
}

function drawElement(el, r, overloaded, now, ghost = false) {
  const ax = el.x1 * CELL;
  const ay = el.y1 * CELL;
  const bx = el.x2 * CELL;
  const by = el.y2 * CELL;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const angle = Math.atan2(by - ay, bx - ax);
  const isSel = selected && selected.id === el.id;
  const isHov = hovered && hovered.id === el.id;

  ctx.save();
  ctx.globalAlpha = ghost ? 0.45 : 1;
  let stroke = "#cbd5e1";
  if (overloaded) stroke = now % 500 < 250 ? "#ef4444" : "#f87171";
  else if (isSel) stroke = "#22d3ee";
  else if (isHov) stroke = "#93c5fd";
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  const symbolHalf = { wire: 0, battery: 10, resistor: 16, lamp: 12, switch: 14 }[el.type] ?? 0;
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const s1x = mx - ux * symbolHalf;
  const s1y = my - uy * symbolHalf;
  const s2x = mx + ux * symbolHalf;
  const s2y = my + uy * symbolHalf;

  // Leads from the endpoints to the symbol body.
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(s1x, s1y);
  ctx.moveTo(s2x, s2y);
  ctx.lineTo(bx, by);
  ctx.stroke();

  ctx.translate(mx, my);
  ctx.rotate(angle);
  switch (el.type) {
    case "battery":
      drawBattery(el);
      break;
    case "resistor":
      drawResistor();
      break;
    case "lamp":
      drawLamp(r);
      break;
    case "switch":
      drawSwitch(el);
      break;
  }
  ctx.rotate(-angle);
  ctx.translate(-mx, -my);

  // Animated current flow dashes over the whole span.
  if (!ghost && Math.abs(r.current) > 1e-6 && !(el.type === "switch" && !el.closed)) {
    ctx.strokeStyle = overloaded ? "#fca5a5" : "#facc15";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([3, 11]);
    ctx.lineDashOffset = dashOffsets.get(el.id) || 0;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Terminal dots.
  ctx.fillStyle = stroke;
  for (const [tx, ty] of [[ax, ay], [bx, by]]) {
    ctx.beginPath();
    ctx.arc(tx, ty, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (!ghost && showLabels && el.type !== "wire") {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    const horizontal = el.y1 === el.y2;
    const tx = horizontal ? mx : mx + 16;
    const ty = horizontal ? my - 18 : my;
    ctx.textAlign = horizontal ? "center" : "left";
    ctx.fillText(label(el), tx, ty);
    if (Math.abs(r.current) > 1e-6) {
      ctx.fillStyle = "#facc15";
      ctx.fillText(fmt(Math.abs(r.current), "A"), tx, ty + (horizontal ? 46 : 14));
    }
  }
  ctx.restore();
}

function drawBattery(el) {
  // Short plate = "-" (towards terminal 1), long plate = "+" (towards terminal 2).
  ctx.beginPath();
  ctx.moveTo(-4, -7);
  ctx.lineTo(-4, 7);
  ctx.moveTo(4, -13);
  ctx.lineTo(4, 13);
  ctx.stroke();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("+", 13, -12);
}

function drawResistor() {
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  const teeth = [-12, -8, -4, 0, 4, 8, 12];
  teeth.forEach((x, i) => ctx.lineTo(x, i % 2 === 0 ? -7 : 7));
  ctx.lineTo(16, 0);
  ctx.stroke();
}

function drawLamp(r) {
  const brightness = Math.min(1, Math.abs(r.power) / 5);
  if (brightness > 0.02) {
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    glow.addColorStop(0, `rgba(253, 224, 71, ${0.85 * brightness})`);
    glow.addColorStop(1, "rgba(253, 224, 71, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = brightness > 0.02 ? `rgba(254, 240, 138, ${0.3 + 0.7 * brightness})` : "#0b0f14";
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

function drawSwitch(el) {
  ctx.beginPath();
  ctx.arc(-14, 0, 3, 0, Math.PI * 2);
  ctx.moveTo(17, 0);
  ctx.arc(14, 0, 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  if (el.closed) ctx.lineTo(14, 0);
  else ctx.lineTo(10, -12);
  ctx.stroke();
}

// ------------------------------------------------------------------ boot

if (!load()) loadExample();
resolve();
setTool("select");
document.getElementById("sim-labels").classList.add("active");
resize();
requestAnimationFrame(frame);
