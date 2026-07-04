/**
 * Pure DC circuit solver — Modified Nodal Analysis (MNA).
 *
 * Elements are 2-terminal devices between grid points:
 *   { id, type, x1, y1, x2, y2, value, closed }
 *
 * Types: "wire", "battery", "resistor", "lamp", "switch".
 *   - battery: `value` is EMF in volts, "+" terminal at (x2, y2)
 *   - resistor / lamp: `value` is resistance in ohms
 *   - switch: conducts only when `closed` is true
 *
 * Wires and closed switches are modelled as tiny resistances so every
 * element has a well-defined branch current (used for flow animation).
 *
 * No DOM access here — this module is also exercised from Node in tests.
 */

export const WIRE_R = 1e-3; // ohms
export const SWITCH_R = 1e-3; // ohms
export const SHORT_AMPS = 100; // above this magnitude we flag a short circuit

export function defaultValue(type) {
  switch (type) {
    case "battery":
      return 9; // volts
    case "resistor":
      return 100; // ohms
    case "lamp":
      return 12; // ohms
    default:
      return 0;
  }
}

export function nodeKey(x, y) {
  return x + "," + y;
}

/** Resistance of a purely resistive element, or null if it does not conduct. */
export function resistanceOf(el) {
  switch (el.type) {
    case "wire":
      return WIRE_R;
    case "switch":
      return el.closed ? SWITCH_R : null;
    case "resistor":
    case "lamp":
      return Math.max(el.value, 1e-6);
    default:
      return null; // battery is stamped as a voltage source
  }
}

/** Gaussian elimination with partial pivoting. Returns x, or null if singular. */
export function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / M[r][r];
  }
  return x;
}

/**
 * Solve the circuit.
 *
 * Returns {
 *   voltages:  Map(nodeKey -> volts),
 *   results:   Map(element.id -> { current, voltage, power }),
 *   shorted:   true if any branch current exceeds SHORT_AMPS,
 *   singular:  true if the system had no unique solution (e.g. conflicting
 *              ideal sources); all currents are reported as 0 in that case.
 * }
 *
 * `current` is the current flowing through the element from terminal 1
 * to terminal 2. `voltage` is v(terminal1) - v(terminal2). `power` is the
 * power dissipated (resistive elements) or delivered (battery), in watts.
 */
export function solveCircuit(elements) {
  const voltages = new Map();
  const results = new Map();
  const empty = { voltages, results, shorted: false, singular: false };
  if (elements.length === 0) return empty;

  // Every distinct grid point touched by a terminal is a node.
  const nodeIds = new Map();
  for (const el of elements) {
    for (const k of [nodeKey(el.x1, el.y1), nodeKey(el.x2, el.y2)]) {
      if (!nodeIds.has(k)) nodeIds.set(k, nodeIds.size);
    }
  }

  // Union-find over conducting elements, to pick one ground per island.
  const parent = Array.from(nodeIds, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (const el of elements) {
    if (el.type !== "battery" && resistanceOf(el) === null) continue;
    const a = find(nodeIds.get(nodeKey(el.x1, el.y1)));
    const b = find(nodeIds.get(nodeKey(el.x2, el.y2)));
    if (a !== b) parent[a] = b;
  }

  // Unknown index per node; the first node of each island is ground (-1).
  const grounds = new Set();
  const unknownOf = new Array(nodeIds.size).fill(-1);
  let n = 0;
  for (let i = 0; i < nodeIds.size; i++) {
    const root = find(i);
    if (!grounds.has(root)) {
      grounds.add(root);
    } else {
      unknownOf[i] = n++;
    }
  }
  const batteries = elements.filter((el) => el.type === "battery");
  const size = n + batteries.length;
  if (size === 0) {
    for (const k of nodeIds.keys()) voltages.set(k, 0);
    for (const el of elements) results.set(el.id, { current: 0, voltage: 0, power: 0 });
    return empty;
  }

  const A = Array.from({ length: size }, () => new Array(size).fill(0));
  const b = new Array(size).fill(0);
  const idx = (el, term) =>
    unknownOf[nodeIds.get(term === 1 ? nodeKey(el.x1, el.y1) : nodeKey(el.x2, el.y2))];

  for (const el of elements) {
    const R = resistanceOf(el);
    if (R !== null) {
      const g = 1 / R;
      const i = idx(el, 1);
      const j = idx(el, 2);
      if (i >= 0) A[i][i] += g;
      if (j >= 0) A[j][j] += g;
      if (i >= 0 && j >= 0) {
        A[i][j] -= g;
        A[j][i] -= g;
      }
    }
  }
  batteries.forEach((el, k) => {
    const row = n + k;
    const iPlus = idx(el, 2); // "+" terminal is (x2, y2)
    const iMinus = idx(el, 1);
    if (iPlus >= 0) {
      A[iPlus][row] += 1;
      A[row][iPlus] += 1;
    }
    if (iMinus >= 0) {
      A[iMinus][row] -= 1;
      A[row][iMinus] -= 1;
    }
    b[row] = el.value;
  });

  const x = solveLinear(A, b);
  if (x === null) {
    for (const k of nodeIds.keys()) voltages.set(k, 0);
    for (const el of elements) results.set(el.id, { current: 0, voltage: 0, power: 0 });
    return { voltages, results, shorted: false, singular: true };
  }

  for (const [k, i] of nodeIds) voltages.set(k, unknownOf[i] >= 0 ? x[unknownOf[i]] : 0);

  let shorted = false;
  batteries.forEach((el, k) => {
    // MNA source current flows "+" -> "-" inside the source; discharge is
    // the opposite, so current from terminal 1 to 2 through the element:
    const current = -x[n + k];
    const voltage =
      voltages.get(nodeKey(el.x1, el.y1)) - voltages.get(nodeKey(el.x2, el.y2));
    results.set(el.id, { current, voltage, power: Math.abs(el.value * current) });
    if (Math.abs(current) > SHORT_AMPS) shorted = true;
  });
  for (const el of elements) {
    const R = resistanceOf(el);
    if (el.type === "battery") continue;
    if (R === null) {
      results.set(el.id, { current: 0, voltage: 0, power: 0 });
      continue;
    }
    const voltage =
      voltages.get(nodeKey(el.x1, el.y1)) - voltages.get(nodeKey(el.x2, el.y2));
    const current = voltage / R;
    results.set(el.id, { current, voltage, power: voltage * current });
    if (Math.abs(current) > SHORT_AMPS) shorted = true;
  }

  return { voltages, results, shorted, singular: false };
}
