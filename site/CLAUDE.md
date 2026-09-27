# MDM website — design system rules (Figma → code)

Rules for turning Figma designs (via the Figma MCP) into changes to the MDM site.
Scope: everything under `site/`. The rest of the repo (Python app, `circuit-planner/`,
`electric-simulator/`) is unrelated and does not share this design system.

## 0. Hard constraints — check before any change

- **Business data is fixed.** Never change without the owner's written confirmation:
  218 935 050 · `wa.me/351910307579` · mdmassist@mdmassist.com ·
  Alameda dos Oceanos 108A, Edifício Vila do Oriente, 1990-426 Lisboa · NIF 502 644 761 ·
  2ª–6ª 8h–17h · the brand list. A Figma mock with different numbers/copy does **not** count.
- **No invented content.** No fabricated testimonials, ratings, client logos or stats.
  Supplier logos need the supplier's written permission.
- **No private financial data** on the site. The client intervention PDF is never committed.
- **No cookies / third-party trackers** that would require a consent banner
  (PostHog runs with `persistence: 'memory'`; no reCAPTCHA/Turnstile — see README).
- Copy is **European Portuguese** (pt-PT: "telemóvel", "equipa", "orçamento").

## 1. Which file is the site

| Path | Status | How it is edited |
|---|---|---|
| `site/index.html` | **Official site — "creme" variant**, owner-approved 08/2026 | Hand-edited, single self-contained file (CSS + JS + base64 images) |
| `site/deploy/creme/` | Publish folder, **generated** | `python3 externalize.py index.html deploy/creme` — never edit by hand |
| `site/variante-carmim/` | Alternative proposal awaiting approval | Hand-edited `index.html` + `img/` + `fonts/`; `unico.py` inlines to one file |
| `site/variante-navy/` | Archived, **generated** | Edit `site/src/*` then `cd site/src && python3 assemble.py` |
| `site/privacidade.html` | Privacy policy (RGPD) | Hand-edited |
| `site/backend/` | Supabase lead endpoint + SQL | See `backend/README.md` |

A Figma frame targets **one** variant. Default to `site/index.html` (creme) unless told otherwise,
then regenerate `deploy/creme/` in the same commit. Do **not** pass `--url` to `externalize.py`
until the owner picks a domain (canonical stays `https://mdmassist.manus.space`).

## 2. Frameworks, libraries, build

- **No framework, no bundler, no npm.** Plain HTML + one `<style>` + one `<script>` per page.
  Vanilla JS in IIFEs, `const $q = id => document.getElementById(id)`.
- Build tools are **stdlib-only Python**: `externalize.py` (base64 → `img/` files, lazy-loading,
  domain swap, `robots.txt`/`sitemap.xml`), `src/assemble.py` (navy), `variante-carmim/unico.py`.
- Do not introduce React/Tailwind/CSS-in-JS or a package.json for the site. Translate Figma
  output (which the MCP gives as React + Tailwind) **into this plain-CSS vocabulary**.

## 3. Design tokens

Tokens are CSS custom properties in the single `:root` block at the top of the `<style>`
in `site/index.html` (~line 78). There is no token pipeline (no Style Dictionary, no JSON);
the `:root` block **is** the source of truth.

```css
:root {
  --cream:  #FAF9F5;   /* page background */
  --paper:  #F0EEE6;   /* raised surfaces, bands */
  --sand:   #E8E4D9;   /* hairlines, outlines */
  --ink:    #141D2E;   /* text + dark surfaces — navy of the team polos */
  --slate:  #4E5871;   /* secondary text */
  --red:    #A30711;   /* logo carmine — the ONLY red on the site */
  --red-dk: #7C050D;   /* red hover/pressed */
  --red-sf: #F6E4E4;   /* red soft fill (error bg) */
  --wa:     #12823F;   /* WhatsApp button (4.9:1 with white) */
  --wa-d:   #0B6E34;
  --ok-bg:  #E9F2EC;  --ok-fg: #1F5C33;   /* form success alert */
  --r-s: 6px;  --r-m: 10px;  --r-l: 16px; /* radii: inputs / cards / wide panels */
  --serif: 'Lora', Georgia, serif;        /* headings */
  --sans:  'Inter', sans-serif;           /* body, UI */
  --mono:  'JetBrains Mono', monospace;   /* labels, numbers, kickers */
  --ease:  cubic-bezier(0.16, 1, 0.3, 1);
}
/* layout token, set later: --nav-h: 89px (81px ≤640px) */
```

Rules:
- **Map every Figma colour to an existing token.** If a Figma value is within a few units of a
  token, use the token. A genuinely new colour becomes a new named token in `:root` with a
  comment saying where it is used — never a raw hex inside a component rule.
- Contrast was checked by hand: `--red` is a **fill** colour (white text on it); red *text* on
  navy fails. Re-check WCAG AA (4.5:1 body, 3:1 large) for any new pairing.
- Tinted translucency is written as `rgba()` of a token's RGB (e.g. `rgba(20,29,46,.3)` = ink).
- Known leftovers still hard-coded: `#fff`/`#000`, a few greys (`#8F8B80`, `#7B8598`,
  `#CFCDC6`) and the "open now" dot `#2FA35B`. Tokenise them if you touch those rules.
- `variante-carmim` has its **own semantic token set** (`--bg --fg --muted --line --surface
  --accent --on-accent --deep --field …`, Geist/Geist Mono). Do not mix the two vocabularies.

### Typography
- Headings: `var(--serif)` (Lora 400/500/600, italic 400/500). `<em>` inside h2 gets the
  underline accent (`.sec-head h2 em::after`).
- Body/UI: `var(--sans)` (Inter 400/500/600). Kickers, numbers, labels: `var(--mono)`.
- Display sizes are fluid `clamp()` (hero `clamp(40px, 6.4vw, 80px)`, section h2
  `clamp(30px, 4.2vw, 50px)`); UI text is fixed px (11–17px). Keep new sizes on that scale;
  don't add a new px size when an existing one is within 0.5px.
- Fonts load from Google Fonts (`<link>` in `<head>`, `display=swap`). Adding a weight means
  editing that URL. Carmim self-hosts Geist in `variante-carmim/fonts/` (OFL files alongside).

## 4. Components

No component library, no Storybook. Components are **class-prefixed blocks** in one stylesheet,
laid out in page order. Prefix = component:

| Prefix | Component |
|---|---|
| `nav-`, `burger`, `tb-` | top bar, nav, mobile drawer, "open now" status |
| `hero`, `hm-` | hero |
| `obras-`, `ob-` | works carousel (14 photos) |
| `meta-band`, `band` | numbers band |
| `svc-` | service cards |
| `perk`, `porque` | "Porquê a MDM" |
| `faq-` | FAQ (`<details>`) |
| `quote-`, `mailwin`, `mw-` | quote form styled as a mail window |
| `sec-`, `btn`, `btn-red`, `btn-line` | shared: section header, buttons |
| `ft-` | footer |

Pattern:

```css
.btn { /* base: layout, radius var(--r-s), transition with var(--ease) */ }
.btn-red  { background: var(--red); color: #fff; }
.btn-red:hover { background: var(--red-dk); transform: translateY(-3px); }
.btn-line { color: var(--ink); border: 1.5px solid var(--sand); }
```

- Modifiers use `--` (`.mw-send--wa`, `.mw-alert--ok`); state classes use `is-`/plain words
  (`.is-in`, `.aberto`, `.invalid`). Never reuse a state class name that is also a component
  class (a `.in` collision once broke the form — see PR #12 notes).
- A Figma component maps to an **existing prefix first**. New component → new short prefix,
  its CSS placed next to related sections, its markup in page order.
- Sections: `<section class="… " id="…">` with ids `topo obras servicos porque faq contacto`
  (nav links and scroll-spy depend on them — do not rename).

## 5. Icons

- **Creme:** inline `<svg>` per use, 24×24 viewBox, `currentColor`, `aria-hidden="true"`.
  Two styles only: filled (`fill="currentColor"`) and stroked
  (`fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`).
  Size with CSS on the parent, not with width/height attributes.
- **Carmim:** one hidden sprite of `<symbol id="i-…">` (Phosphor names: `i-phone`,
  `i-whatsapp-logo`, `i-envelope-simple`, `i-map-pin`, `i-caret-left`, …) used as
  `<svg class="ico" aria-hidden="true"><use href="#i-phone"/></svg>`. New icons: add a `<symbol>`
  with the Phosphor name prefixed `i-`.
- The logo is the inline SVG from `site/mdm-logo.svg` (`class="logo-img" role="img" aria-label="MDM"`).
- Don't export Figma icons as PNG; get the SVG and strip fills to `currentColor`.

## 6. Assets

- Sources: `site/obras/*.jpg|webp` (works photos, 480px tall, the smaller of jpg/webp wins),
  `site/favicon/`, `site/og.jpg`, `site/mdm-logo.svg`. Captions/dimensions: `site/src/obras.json`.
- In `index.html` images are **base64 data URIs**; `externalize.py` pulls anything ≥ 8 KB out to
  `deploy/creme/img/<sha1>.<ext>` with `loading="lazy"`. So: add the optimised file, embed it as
  a data URI in `index.html`, then regenerate `deploy/creme/`.
- Every `<img>` needs `width`/`height` (no layout shift) and a Portuguese `alt` describing the
  real job. Budget: `index.html` ≈ 580 KB, deploy HTML ≈ 116 KB — don't blow these up.
- No CDN. Only external requests: Google Fonts and PostHog (EU). Keep it that way.
- Only real MDM photos. No stock photos presented as MDM work.

## 7. Styling approach and responsiveness

- One global stylesheet, plain CSS, reset at the top (`*{box-sizing:border-box;margin:0;padding:0}`).
  No CSS Modules/BEM tooling; the prefix convention is the scoping.
- **Desktop-first** `max-width` media queries, placed with the component they affect. Breakpoints
  in use: 1160, 1000, 980, 900, 760, 720, 640, 400px, plus `min-width: 1800px`,
  `max-height: 820px / 520px`, `hover: none`. Reuse one of these before adding another.
- Verify at **1440 / 1180 / 900 / 768 / 620 / 390 / 360 px**: no horizontal overflow, no page errors.
- Motion: always respect `@media (prefers-reduced-motion: reduce)` and the JS `reduceMotion`
  flag; ease with `var(--ease)`.
- Accessibility baseline to preserve: skip link, `:focus-visible` outline 3px `var(--red)`,
  `aria-live` form status, `aria-invalid` on bad fields, 44px touch targets.

## 8. Figma → code workflow

1. `get_design_context` / `get_screenshot` for the node; identify the target variant and section.
2. Map Figma styles to tokens (§3) and layers to existing prefixed components (§4).
3. Rewrite the MCP's React/Tailwind output as plain HTML + CSS in `site/index.html`.
4. Replace any placeholder copy, phone, email or address in the Figma frame with the fixed
   business data (§0); flag differences to the owner instead of copying them.
5. Regenerate `deploy/creme/`; check the breakpoints in §7 in Chromium (Playwright is installed,
   `/opt/node22/lib/node_modules/playwright`), and compare computed styles when a change should be
   visually neutral.
6. Commit on `claude/new-session-tjh2dn`; message in Portuguese, footer as in previous commits.
