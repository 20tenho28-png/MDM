# MDM

Team workspace with two apps:

| App | Where | What it is |
| --- | --- | --- |
| **Email ticket wall** | `src/mdm/` | IMAP-driven ticket tracking with a TV wall display (FastAPI + PostgreSQL) |
| **Electric simulator** | `/simulator` route | Interactive DC circuit simulator (canvas editor + live MNA solver) |
| **Circuit Planner — EU Edition** | `circuit-planner/` | Standalone single-file EU electrical/HVAC training web app |

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

### Tests

```bash
python -m pytest
```

Tests use an in-memory SQLite database — no PostgreSQL or IMAP account needed.
The simulator's physics solver is additionally covered by Node-based tests
(`tests/js/test_circuit.mjs`), run automatically from pytest when `node` is
installed.

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
