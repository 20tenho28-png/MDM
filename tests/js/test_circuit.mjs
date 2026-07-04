/**
 * Solver tests for the electric simulator. Run with:  node tests/js/test_circuit.mjs
 * Exits non-zero on the first failing assertion.
 */
import assert from "node:assert/strict";
import { solveCircuit, WIRE_R } from "../../src/mdm/web/static/circuit.js";

let id = 0;
const el = (type, x1, y1, x2, y2, extra = {}) => ({
  id: ++id,
  type,
  x1,
  y1,
  x2,
  y2,
  value: 0,
  ...extra,
});

function approx(actual, expected, tol, msg) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg}: expected ~${expected}, got ${actual}`,
  );
}

// --- series circuit: 9 V battery + 100 Ω resistor, joined by two wires ----
{
  const battery = el("battery", 0, 0, 0, 2, { value: 9 });
  const resistor = el("resistor", 2, 0, 2, 2, { value: 100 });
  const circuit = [
    battery,
    el("wire", 0, 2, 1, 2),
    el("wire", 1, 2, 2, 2),
    resistor,
    el("wire", 2, 0, 1, 0),
    el("wire", 1, 0, 0, 0),
  ];
  const { results, shorted, singular } = solveCircuit(circuit);
  assert.equal(singular, false, "series: not singular");
  assert.equal(shorted, false, "series: not shorted");
  const expected = 9 / (100 + 4 * WIRE_R);
  approx(Math.abs(results.get(resistor.id).current), expected, 1e-6, "series current");
  approx(Math.abs(results.get(resistor.id).voltage), expected * 100, 1e-3, "resistor voltage");
  approx(results.get(battery.id).power, 9 * expected, 1e-4, "battery power");
  // Current is a loop: battery current equals resistor current.
  approx(
    Math.abs(results.get(battery.id).current),
    Math.abs(results.get(resistor.id).current),
    1e-9,
    "KCL around the loop",
  );
}

// --- open switch blocks current; closing it restores the flow -------------
{
  const sw = el("switch", 0, 2, 2, 2, { closed: false });
  const resistor = el("resistor", 2, 0, 2, 2, { value: 50 });
  const circuit = [
    el("battery", 0, 0, 0, 2, { value: 6 }),
    sw,
    resistor,
    el("wire", 2, 0, 0, 0),
  ];
  let out = solveCircuit(circuit);
  approx(out.results.get(resistor.id).current, 0, 1e-9, "open switch current");

  sw.closed = true;
  out = solveCircuit(circuit);
  approx(Math.abs(out.results.get(resistor.id).current), 6 / 50, 1e-3, "closed switch current");
}

// --- parallel resistors split current by conductance -----------------------
{
  const r1 = el("resistor", 1, 0, 1, 2, { value: 100 });
  const r2 = el("resistor", 2, 0, 2, 2, { value: 200 });
  const circuit = [
    el("battery", 0, 0, 0, 2, { value: 10 }),
    el("wire", 0, 2, 1, 2),
    el("wire", 1, 2, 2, 2),
    r1,
    r2,
    el("wire", 2, 0, 1, 0),
    el("wire", 1, 0, 0, 0),
  ];
  const { results } = solveCircuit(circuit);
  const i1 = Math.abs(results.get(r1.id).current);
  const i2 = Math.abs(results.get(r2.id).current);
  approx(i1, 0.1, 1e-3, "parallel branch 1");
  approx(i2, 0.05, 1e-3, "parallel branch 2");
  approx(i1 / i2, 2, 1e-3, "current splits inversely to resistance");
}

// --- battery shorted through bare wire is flagged --------------------------
{
  const circuit = [
    el("battery", 0, 0, 0, 1, { value: 9 }),
    el("wire", 0, 1, 1, 1),
    el("wire", 1, 1, 1, 0),
    el("wire", 1, 0, 0, 0),
  ];
  const { shorted } = solveCircuit(circuit);
  assert.equal(shorted, true, "bare wire loop across a battery is a short");
}

// --- disconnected islands solve independently ------------------------------
{
  const rA = el("resistor", 1, 0, 1, 1, { value: 10 });
  const rB = el("resistor", 6, 0, 6, 1, { value: 10 });
  const circuit = [
    el("battery", 0, 0, 0, 1, { value: 5 }),
    el("wire", 0, 1, 1, 1),
    rA,
    el("wire", 1, 0, 0, 0),
    // Far away, an isolated loop with no source.
    rB,
    el("wire", 6, 1, 7, 1),
    el("wire", 7, 1, 7, 0),
    el("wire", 7, 0, 6, 0),
  ];
  const { results, singular } = solveCircuit(circuit);
  assert.equal(singular, false, "islands: not singular");
  approx(Math.abs(results.get(rA.id).current), 0.5, 1e-3, "powered island current");
  approx(results.get(rB.id).current, 0, 1e-9, "sourceless island stays dead");
}

// --- two conflicting ideal batteries on the same nodes are singular --------
{
  const circuit = [
    el("battery", 0, 0, 0, 1, { value: 9 }),
    el("battery", 0, 0, 0, 1, { value: 5 }),
  ];
  const { singular, results } = solveCircuit(circuit);
  assert.equal(singular, true, "conflicting sources reported as singular");
  for (const r of results.values()) assert.equal(r.current, 0, "singular -> zero currents");
}

// --- empty circuit is a no-op ----------------------------------------------
{
  const { results, shorted, singular } = solveCircuit([]);
  assert.equal(results.size, 0);
  assert.equal(shorted, false);
  assert.equal(singular, false);
}

console.log("circuit.js: all solver tests passed");
