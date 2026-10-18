# MDM

Team workspace with three apps, one folder each:

| App | Folder | What it is |
| --- | --- | --- |
| **Email ticket wall** | `src/mdm/` | IMAP-driven ticket tracking with a TV wall display (FastAPI + PostgreSQL) |
| **ERP: agenda + relatórios de intervenção** | `src/mdm/erp/` | Visit calendar, clients, technicians, and the intervention reports from the technicians' FM-TEC-04 app, at `/erp` in the same FastAPI app |
| **Funil de pedidos** | `mdm-funil/` | Local analysis of every customer request from first contact to invoice, and the shadow mode for states and deadlines (reads the ERP agenda) |
| **Electric simulator** | `electric-simulator/` | Interactive DC circuit simulator (canvas editor + live MNA solver) |
| **Circuit Planner — EU Edition** | `circuit-planner/` | Single-file EU electrical/HVAC training app (the trainer) |

```
MDM/
├── src/mdm/            # ticket wall backend + TV wall UI
├── src/mdm/erp/        # ERP: agenda, clients, intervention reports (/erp)
├── mdm-funil/          # request funnel analysis + shadow mode (runs locally, own tests)
├── alembic/            # database migrations for the ticket wall
├── tests/              # Python test suite (ticket wall + simulator routes)
├── electric-simulator/ # standalone circuit simulator (HTML/JS + own tests)
├── circuit-planner/    # standalone trainer app (HTML/JS + own tests)
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

### Tests

```bash
python -m pytest
```

Tests use an in-memory SQLite database — no PostgreSQL or IMAP account needed.

## ERP: agenda e relatórios de intervenção

Served by the same app at `http://localhost:8000/erp` (needs `alembic upgrade head` for the `0002` tables).
Set `ERP_UTILIZADOR` and `ERP_PALAVRA_PASSE` in `.env` before it is reachable from outside the office: without
them `/erp` is open.

- **Agenda** (`/erp/agenda`): visits by week and technician. A visit is *por marcar* until it has a day, then
  *marcada*, then *feita* when its intervention report arrives. `/erp/por-marcar` lists the queue, P1 first.
- **Relatórios de intervenção**: technicians keep using their app (FM-TEC-04 / V07, offline, data on the phone).
  The ERP serves it at `/erp/ri` (the file is `src/mdm/erp/static/relatorio-intervencao.html`, unchanged) plus a
  small bridge, `ri-erp.js`, that only uses the app's `window.RI_UI`:
  - from a visit, *Fazer o relatório na app* opens `/erp/ri?visita=N` and starts the report with the client,
    address, ORC number and the visit's internal ref (`V0012`);
  - *Enviar para o escritório (ERP)* posts emitted reports to `/erp/api/relatorios`; without network the report
    stays on the phone and can be sent later, or exported as JSON and uploaded at `/erp/relatorios/importar`;
  - `/erp/ri?ver=RI-…` shows a received report in the app's own A4 layout for printing.
  A report closes its visit (by `V0012` in *Ref. interna*, or the client's visit on that day). *Obra não
  concluída* leaves the next visit *por marcar*; *Aguarda peça* holds it until the office records the part arrived.
  A report already accepted never goes back to *emitido*; a rectification marks the original as replaced.
- **Funil**: `/erp/exportar/agenda.csv` goes into `dados/agenda/` of the funnel project, so the shadow mode measures
  *visita por marcar*, *visita marcada* and *à espera de peça/fornecedor* (see `mdm-funil/README.md`).

Two things to know before rolling it out:

- The app keeps its reports in the phone's browser storage, which is separate for each address. Reports made in
  the copy opened as a file are not visible in `/erp/ri` (and vice versa): on each phone, pick one, or move them
  with *Exportar tudo (JSON)* and *Importar JSON*. Opened from the ERP, the page needs the network to load; once
  open it works offline like before.
- Behind a reverse proxy, forward the original `Host` header (nginx: `proxy_set_header Host $host;`): the ERP
  refuses form posts whose `Origin` is a different host.

Two things to know before rolling it out:

- The app keeps its reports in the phone's browser storage, which is separate for each address. Reports made in
  the copy opened as a file are not visible in `/erp/ri` (and vice versa): on each phone, pick one, or move them
  with *Exportar tudo (JSON)* and *Importar JSON*. Opened from the ERP, the page needs the network to load; once
  open it works offline like before.
- Behind a reverse proxy, forward the original `Host` header (nginx: `proxy_set_header Host $host;`): the ERP
  refuses form posts whose `Origin` is a different host.

To update the technicians' app, replace `relatorio-intervencao.html` with the new version; the bridge needs the
app to keep exposing `window.RI_UI` (`R`, `abrirForm`, `entrega`, `renderPaginas`, `DB`) and the buttons
`btNovo`, `btContinuar`, `btEmail` and `btExportTudo`.

## Funil de pedidos

Lives in `mdm-funil/` and runs on the office computer: customer data never leaves it and never goes into git
(`mdm-funil/.gitignore`). See [`mdm-funil/README.md`](mdm-funil/README.md).

```bash
cd mdm-funil
pip install -r requirements.txt
python -m pytest            # its own suite
python -m funil exemplo     # invented data, to see the reports first
```

## Electric simulator

Lives in `electric-simulator/` and is served at `/simulator` by the ticket-wall
app, or standalone with any static file server. Two departments: schematic
circuits (`/simulator/`) and the **Quadro Elétrico** distribution-board trainer
(`/simulator/panel.html`, in Portuguese) where you assemble a breaker panel on
DIN rails like an electrician. Physics and panel logic have their own Node test
suites, run automatically from pytest. See
[`electric-simulator/README.md`](electric-simulator/README.md).

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
