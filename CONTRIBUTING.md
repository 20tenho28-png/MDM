# Contributing

## Workflow

1. **Never commit directly to `main`.** Create a feature branch:
   `git checkout -b <yourname>/<short-description>`
2. Keep commits small with clear messages (imperative mood: "Add …", "Fix …").
3. Push your branch and open a **pull request** against `main`.
4. CI must be green before merging — it runs the Python test suite and the
   Circuit Planner test suite on every PR.
5. Get at least one review from a teammate before merging.

## Before you push

```bash
python -m pytest            # ticket wall + simulator tests
cd circuit-planner && npm test   # if you touched circuit-planner/
```

## Project-specific rules

- **`circuit-planner/`** has hard rules from the owner in
  [`circuit-planner/CLAUDE.md`](circuit-planner/CLAUDE.md) — read it before
  editing. Highlights: never rebuild the app, all work is incremental edits to
  `circuit_planner.html`, never remove features, and always run `npm test`
  after any edit.
- **Database changes** to the ticket app need an Alembic migration:
  `alembic revision --autogenerate -m "describe change"` and commit the
  generated file under `alembic/versions/`.
- **The simulator's solver** (`src/mdm/web/static/circuit.js`) must stay
  DOM-free — it is exercised from Node in tests.

## Reporting issues

Use the issue templates (bug report / feature request). Include steps to
reproduce and what you expected to happen.
