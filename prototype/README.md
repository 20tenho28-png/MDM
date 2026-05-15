# MDM Assist — Mobile-First UX Prototype

A self-contained single-file prototype of the proposed redesign for [mdmassist.manus.space](https://mdmassist.manus.space). Mobile-first, polished desktop breakpoint, warmer/more trustworthy visual language with the brand red restricted to conversion moments.

## Open it

```sh
# Locally:
xdg-open prototype/index.html     # Linux
open prototype/index.html         # macOS

# Or via GitHub raw proxy (renders HTML, no clone needed):
# https://raw.githack.com/20tenho28-png/MDM/claude/ux-mobile-redesign-miWdj/prototype/index.html
```

No build step. No framework. Inline `<style>` + inline `<script>` + `assets/`. The page works offline once `assets/` is present.

## Target viewports

| Device | Width | What to check |
|---|---|---|
| iPhone SE | 375×667 | Hero fits one viewport; bottom bar appears after scrolling past hero |
| iPhone 14 | 390×844 | Rhythm; bottom bar hide-on-scroll behavior |
| iPhone 14 Plus | 414×896 | Same as 14, larger text breathing room |
| Desktop | 1280+ | macOS compose-window chrome, capped headline, 4-col service grid, real WhatsApp QR side panel |

Open DevTools → Device Mode → cycle through these.

## What's in v2

1. **Real brand assets** — MDM logo (header + footer), official Mitsubishi Electric logo (partner band + supplier strip), real service/operations photography, real WhatsApp QR. All extracted from the live site's MHTML snapshot.
2. **Hero with full-bleed photography** — warm-dark gradient overlay so the headline reads AAA contrast.
3. **Mitsubishi Electric partner band** — immediately after hero, the single highest-credibility signal.
4. **Multi-brand supplier strip** — "Serviço multimarca" (Mitsubishi, Daikin, LG, Samsung, Toshiba, Hitachi). Placeholders.
5. **Service cards with photo headers** — every card has a visual.
6. **Setores carousel with sector photos** — placeholders (CSS-painted illustrations) until real on-site photos are sourced.
7. **MDM em números** — 30+ anos · 4 serviços · 2h resposta · 100% Lisboa.
8. **Como funciona** — 4-step process flow above the form, "Orçamento gratuito · sem compromisso" reassurance pill.
9. **Testimonial card** — clearly marked as data-placeholder, intended to be filled with real quotes before production.
10. **Sticky bottom action bar** — Ligar · WhatsApp (green, primary) · Orçamento. Materializes past hero, hides on form.
11. **Stronger button system** — WhatsApp green (`#25D366`) for any WhatsApp action (universal recognition), brand red (`#b61918`) reserved for conversion (submit, primary "Pedir orçamento"), dark outline for secondary, ghost for tertiary. Sizes `lg`/`md`/`sm`.

## Heatmap debug overlay

Append `?heatmap=debug` to the URL to enable the predicted-touch-intensity overlay:

```
file:///path/to/prototype/index.html?heatmap=debug
```

Every interactive element gets outlined in its predicted tier color (Tier 1 red → Tier 4 dashed grey). A legend appears top-right. Close it with the `×` to inspect without it.

This is a designer/reviewer tool — it shows where the *intended* heatmap should land. Use it to spot interactivity that's miscategorized or missing.

## Re-extract assets from a fresh snapshot

```sh
python3 prototype/extract_assets.py /path/to/new_snapshot.mhtml
```

Outputs go to `prototype/assets/`. The script targets the 6 known brand asset filenames; new assets need new entries in the `WANTED` dict at the top of the script.

## What's intentionally placeholder

| Section | Asset | Replace with |
|---|---|---|
| Setores (4 cards) | CSS-painted gradient illustrations | Real on-site photos of an indústria job, an escritório install, a condomínio façade, a Parque das Nações view |
| Ventilação service card photo | CSS-painted gradient | Real photo of a ventilation/duct install |
| Supplier strip | Wordmarks in Archivo | Brand-approved SVG/PNG logos from each manufacturer |
| Testimonial quote + avatar | Synthetic example | 2–3 real customer quotes (full name + role + sector); do not ship section until at least one real quote exists |
| Static map | CSS grid illustration | Optional: real static map image from the maps provider |

See `docs/image-manifest.md` for the full asset inventory.

## What's intentionally out of scope

- Real form backend (submit is a no-op showing the success state)
- Analytics + cookie banner (production-only; spec calls out the Microsoft Clarity snippet)
- EN translation toggle (v2)
- Tablet-specific layout (mobile layout scales fine at 768–1023)
- Tests (it's a prototype, not a shipping product)
- Splitting into multiple CSS/JS files (one-file rule)

## File layout

```
prototype/
├── index.html              ← the prototype
├── extract_assets.py       ← one-shot MHTML asset extractor
├── README.md               ← this file
└── assets/
    ├── mdm-logo-original.png
    ├── mdm-logo-mono-bg.png
    ├── mitsubishi-electric-logo.png
    ├── mdm-qr-whatsapp.png
    ├── mdm-service-hvac-electrical.webp
    └── mdm-contact-operations.webp
```

For the written spec, design tokens and handoff notes, see `docs/`.
