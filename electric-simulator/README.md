# Electric Simulator — EU edition

Two departments, switchable via the tabs in the header:

1. **Esquemas** (`index.html`) — schematic circuit builder (IEC 60617).
2. **Quadro elétrico** (`panel.html`, in Portuguese) — assemble a real
   distribution board like a certified electrician: energy meter + DCP
   (contracted power) at the entrance, main isolator, 30 mA RCDs, MCBs on
   DIN rails, two neutral bars (one per RCD group) and cables with real
   cross-sections (mm²). Protections behave like the real thing:
   - MCB/DCP: instant magnetic trip on shorts (~7×In) and time-delayed
     thermal trip on overloads (they visibly heat up first)
   - RCD: trips on real measured residual current (>30 mA) — earth
     faults, the working test (T) button, and swapped neutrals between
     groups; the main isolator never trips (it is a switch, not a breaker)
   - cables above their ampacity glow red
   "✓ Verificar instalação" audits each circuit: geral → diferencial →
   disjuntor, neutral on the right group, and "the breaker must protect
   the cable" (rating vs. smallest mm² on the run).
   Model logic lives in `panel_model.js` (DOM-free, Node-tested).

Interactive DC circuit simulator for technicians and new hires. Schematic
symbols follow **IEC 60617** (EU standard — rectangle resistor, crossed-circle
lamp), circuits are solved live with Modified Nodal Analysis, and current flow
is animated in real time.

Usability features: parts palette with drag & drop, move/rotate placed parts,
pan & zoom, undo/redo, EU value presets (1.5–24 V, E-series resistors), hover
readouts (V/A/W), short-circuit warnings, and a first-run guide.

Wiring & colours (designed for new hires without an engineering background):

- One drag draws a whole wire run — it bends around corners automatically,
  and dragging from any part's terminal starts a wire.
- Wires use real EU insulation colours (HD 308): brown = feed from +,
  blue = return to −, green/yellow = safety earth, plus black/grey/red.
  Recolouring a wire recolours its whole connected run.
- The "Voltage colours" view tints every conductor from red (near +) to
  blue (near −) as a teaching aid, and the status bar coaches in plain
  language ("a switch is open — click it to close it").

## Run it

- **Via the MDM app:** start the ticket-wall server and open
  `http://localhost:8000/simulator` (the folder is mounted automatically).
- **Standalone:** serve this folder with any static server, e.g.
  `python -m http.server 8080` here, then open `http://localhost:8080/`.
  (Opening `index.html` directly from disk won't work — browsers block ES
  module imports over `file://`.)

## Files

| File | Purpose |
| --- | --- |
| `index.html` | The page: toolbar, canvas, property panel, status bar |
| `simulator.js` | Editor UI: tools, placement, rendering, animation |
| `circuit.js` | Pure MNA solver — **DOM-free**, also runs under Node |
| `test/circuit.test.mjs` | Solver physics tests (`node test/circuit.test.mjs`) |

## Testing

```bash
node electric-simulator/test/circuit.test.mjs   # from the repo root
```

The Python suite (`python -m pytest`) also runs these Node tests plus HTTP
tests for the mounted routes. Keep `circuit.js` free of any `document`/DOM
usage so the Node tests keep working.
