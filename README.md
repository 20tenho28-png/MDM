# MDM

Team workspace with three apps, one folder each:

| App | Folder | What it is |
| --- | --- | --- |
| **Email ticket wall** | `src/mdm/` | IMAP-driven ticket tracking with a TV wall display (FastAPI + PostgreSQL) |
| **Electric simulator** | `electric-simulator/` | Interactive DC circuit simulator (canvas editor + live MNA solver) |
| **Circuit Planner — EU Edition** | `circuit-planner/` | Single-file EU electrical/HVAC training app (the trainer) |
| **Calculadora de ar condicionado** | `ac-calculator/` | Client-facing AC sizing calculator (BTU/kW per room, mono vs multi-split), MDM brand design, PT-PT |

```
MDM/
├── src/mdm/            # ticket wall backend + TV wall UI
├── alembic/            # database migrations for the ticket wall
├── tests/              # Python test suite (ticket wall + simulator routes)
├── electric-simulator/ # standalone circuit simulator (HTML/JS + own tests)
├── circuit-planner/    # standalone trainer app (HTML/JS + own tests)
├── ac-calculator/      # client-facing AC sizing calculator (HTML/JS + own tests)
└── .github/            # CI workflow, PR and issue templates
```

## Email ticket wall + electric simulator

### Setup

```bash
# 1. Python 3.11+ and dependencies
pip install -e ".[dev]"

# 2. Database (PostgreSQL via Docker)
docker compose up -d postgres
alembic upgrade head

# 3. Configuration
cp .env.example .env   # fill in IMAP credentials; app runs without them (polling disabled)

# 4. Run
uvicorn mdm.main:app --reload
```

- `http://localhost:8000/` — TV wall (kiosk) with ticket cards colored by age
- `http://localhost:8000/simulator` — electric circuit simulator (drag components,
  toggle switches, live current/voltage/power readouts)
- `http://localhost:8000/calculadora` — AC sizing calculator for clients

### Tests

```bash
python -m pytest
```

Tests use an in-memory SQLite database — no PostgreSQL or IMAP account needed.

## Electric simulator

Lives in `electric-simulator/` and is served at `/simulator` by the ticket-wall
app, or standalone with any static file server. Two departments: schematic
circuits (`/simulator/`) and the **Quadro Elétrico** distribution-board trainer
(`/simulator/panel.html`, in Portuguese) where you assemble a breaker panel on
DIN rails like an electrician. Physics and panel logic have their own Node test
suites, run automatically from pytest. See
[`electric-simulator/README.md`](electric-simulator/README.md).

## Calculadora de ar condicionado

Lives in `ac-calculator/` and is served at `/calculadora` by the ticket-wall app
(or standalone with any static server). A four-step, mobile-first flow in
European Portuguese modelled on manufacturer configurators: rooms → per-room
sizing (area, height, glass, shading, orientation, people, top floor, kitchen)
→ postal code (REH climate zone + Lisbon service area) → result with the
recommended unit per room, mono vs multi-split comparison and a one-tap quote
request (WhatsApp / phone / email). The sizing model (`calc_model.js`) is
DOM-free and Node-tested; prices are off until `prices.js` is filled. See
[`ac-calculator/README.md`](ac-calculator/README.md).

## Circuit Planner

Open `circuit-planner/circuit_planner.html` in any browser — that's the whole
app. See `circuit-planner/README.md` and `circuit-planner/CLAUDE.md` for its
rules and workflow before editing.

```bash
cd circuit-planner
npm test          # full headless test suite, no dependencies needed
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch workflow, review rules
and CI requirements.
