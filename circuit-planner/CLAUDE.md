# Circuit Planner — EU Edition

Single-file EU electrical/HVAC training web app (`circuit_planner.html`, ~500KB).
Floorplan designer + breaker Panels lab + Load Calc + Learn tab + A/C Wiring Trainer.
All component drawings are "photo-real" inline SVG modeled on real EU products.

## Hard rules (from the owner — do not violate)
1. **Never rebuild the app.** All work is incremental edits to `circuit_planner.html`.
2. **Never change core logic** (power flow, wiring rules, load calc, trainer checker). Visual/additive work only unless explicitly asked.
3. **Never remove features.** Superseded code is left as dead branches (`if(false){...}` / `*Legacy` functions) rather than deleted.
4. **Explain every change** to the user, file/anchor by anchor.
5. The **"Real" toolbar toggle** (`state.settings.realistic`) must always revert the whole app to the legacy symbol drawings. Every realistic renderer must have a working fallback path.

## Architecture map
- **One HTML file.** CSS ≈ lines 1–590, static HTML body ≈ 590–692 (includes the ONE `<svg>` `<defs>` block with all gradients — it lives in *static HTML*, before `<script>` at ~693; browsers resolve these ids document-wide, across separate `<svg>` elements).
- **`iconInner(shape, color, comp, opts)`** is the single choke point for all part drawings (canvas, sidebar, ghost, custom list, detail card). It calls `realRenderFor(shape, comp)` first; if that returns a function the realistic drawing is used, else legacy.
- **`REAL_RENDER`** registry: keys are shape names or `'type:<type>'` (most specific wins). Renderers receive `(color, comp, opts, glyph)`; `opts.powered` = live, `opts.on` = switch state. **Never return null/empty** — that blanks the icon.
- **`R`** = shared drawing helpers (screw, gland, led, chip, din, cage, modBody, plate, schuko, glow…).
- **`LIBRARY`** (~line 730) → `LIB_BY_TYPE` built by forEach — **later entries overwrite earlier** (this bit us once with a duplicate `thermostat`). Grep for the type before adding one.
- **`SWITCH_TYPES`** set (~line 902): membership makes a part click-to-operate and power-blocking. contactor/relay/mcb/rcbo/thermostat/pressuresw are in it. `node:true` on a lib entry = junction pass-through (terminal blocks, splitter).
- **`COMPONENT_INFO` / `SHAPE_INFO`** feed the hover/click datasheet cards (`compInfoFor`). It's a `const` — any `Object.assign(COMPONENT_INFO, …)` must appear *after* its definition (TDZ).
- **A/C Trainer** (`renderACTab`, `acLayout`, `acUnitArt`, `acSceneArt`, `acCompressorArt`, `acDinModuleArt`): **terminal/port/block coordinates from `acLayout()` are the contract** — wiring, guide, checker, multimeter and faults all key off them. Redraw art around them freely; never move them. The trainer's own `<svg>` embeds its own defs with unique `ac*` gradient ids (duplicate gradient ids across SVGs conflict; main-canvas ids like `metalGrad`, `euOrange` are referenced cross-SVG and work because the static defs are in the document).
- **Onboarding**: `showWelcome`/`initOnboarding`, first-run flag `localStorage['cp_welcome_v1']`, ❓ Help button reopens.

## Extension recipe (adding a part)
1. Add `LIBRARY` entry (check `LIB_BY_TYPE` for type collisions first).
2. Add `REAL_RENDER['<shape>']` (or `'type:<type>'`) renderer.
3. Add `COMPONENT_INFO.<type>` datasheet (purpose / terminals / safety / mistakes, EU-spec).
4. If operable: add type to `SWITCH_TYPES`. If a junction: `node:true, maxAmps`.
5. New gradients go in the static `<defs>` (anchor near `realBrass`); use unique ids.

## Editing & testing workflow
- Edit with exact-string anchors; verify anchor count before replacing (duplicated anchors exist in dead legacy code).
- After ANY edit: `npm test` (extract → `node --check` → behavioral smoke incl. every library part, all 3 trainer modes, faults, onboarding flow).
- Visual check: `npm run sheets` writes `tools/out_*.svg/png` (PNGs need `npm i sharp`), or just open `circuit_planner.html` in a browser.
- Historic gotcha: Python splice strings — single quotes write literal `\n`/`\uXXXX`; the syntax check catches it.

## Backlog (owner-approved ideas, not started)
- Floorplan **tinker mode**: inject faults (ground fault, tripped RCBO, overload) and diagnose.
- **Guided challenges/quizzes** using the realistic parts.
- **Furnace/thermostat trainer** (R/W/Y/G/C low-voltage to a control board — owner has reference photos).
- **MCU bridge lesson**: microcontroller thermostat logic driving the contactor (Wokwi-style tie-in).
