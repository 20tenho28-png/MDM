# Electric Simulator

Interactive DC circuit simulator: drag batteries, resistors, lamps, switches
and wires onto a grid; the circuit is solved live with Modified Nodal Analysis
and current flow is animated in real time.

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
