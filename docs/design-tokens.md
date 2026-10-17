# Design Tokens — MDM Assist Redesign

Copy-pasteable into the Manus React project's global stylesheet, Tailwind config, or CSS-in-JS theme.

## Colors

```css
:root {
  /* Backgrounds */
  --bg-base:        #faf8f4;   /* warm off-white, page background */
  --bg-elevated:    #ffffff;   /* cards, form */
  --bg-subtle:      #f0ebe3;   /* section alternation, chip rest state */
  --bg-dark:        #2a2825;   /* footer */

  /* Borders */
  --border-soft:    #e5ddd0;
  --border-strong:  #2a2825;

  /* Text */
  --text-primary:    #2a2825;  /* near-black warm */
  --text-secondary:  #5c5852;  /* meta, sublines */
  --text-tertiary:   #8a857d;  /* timestamps, captions */
  --text-on-dark:    #faf8f4;  /* text on hero photo / footer */
  --text-on-dark-soft: rgba(250, 248, 244, 0.78);

  /* Brand red — restricted to conversion + accent */
  --accent:        #b61918;
  --accent-hover:  #9c1515;
  --accent-soft:   #fbeceb;    /* 8% red wash, for badges/highlights only */

  /* WhatsApp — universal recognition */
  --whatsapp:      #25D366;
  --whatsapp-dark: #1ea954;

  --success:       #2d6a4f;
  --focus-ring:    #b61918;
}
```

**Red usage rules:** hero terminal period, primary CTA fill (submit/orçamento/conversion), service-card icon background (accent-soft), link hover underline, error states, "Desde 1991" pill. **Nowhere else.**

**WhatsApp green usage rules:** any button or tile that opens WhatsApp (`wa.me/...`). The user already knows this color — leaning on universal recognition is worth more than brand consistency at the action level.

## Contrast (verified)

- `#2a2825` on `#faf8f4` → 14.1:1 (AAA)
- `#5c5852` on `#faf8f4` → 6.4:1 (AA, AAA for large text)
- `#b61918` on `#ffffff` → 5.9:1 (AA)
- `#faf8f4` on hero overlay → AAA (overlay is `rgba(42,40,37,0.82)` minimum)

## Type

```css
/* Display: keep Archivo. Drop weight 800 — too brutalist. */
font-family: 'Archivo', system-ui, sans-serif;
/* Weights used: 500 (italic in testimonial), 600 (titles), 700 (heavy nums) */

/* Body: swap IBM Plex Sans → Inter — warmer at body sizes. */
font-family: 'Inter', system-ui, -apple-system, sans-serif;
/* Weights used: 400 (body), 500 (labels), 600 (buttons, eyebrows), 700 (stats) */

/* Google Fonts CDN: */
/* https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap */
```

### Type scale (mobile → desktop)

| Token | Value | Use |
|---|---|---|
| `hero-title` | `clamp(1.85rem, 7vw, 2.5rem)` mobile, `clamp(3rem, 6vw, 5rem)` desktop | h1 |
| `section-title` | `clamp(1.5rem, 5vw, 2.25rem)` | h2 |
| `card-title` | 17–18px | service title, value title |
| `body` | 16px | paragraph default |
| `meta` | 13–14px | sublines, captions |
| `eyebrow` | 11–12px uppercase 0.08em | section labels |

Letter-spacing: `-0.01em` on display (Archivo), `-0.005em` on buttons, `0.08em` on uppercase eyebrows.

Line-heights: `1.05–1.15` on hero, `1.2` on section titles, `1.55` on body.

## Radius

| Token | Value | Use |
|---|---|---|
| `--radius-btn` | 10px | buttons |
| `--radius-card` | 14px | cards, tiles, form-card |
| `--radius-input` | 10px | inputs, textareas, b2b toggle |
| `--radius-pill` | 999px | chips, reassurance pill, supplier pills |

## Spacing scale

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 56 / 64 / 72 / 96`. Default vertical rhythm on mobile = 24px.

Page horizontal padding: 20 / 32 / 48 (mobile / tablet / desktop). Container max-width 1200px.

## Shadows

```css
--shadow-card:        0 1px 2px rgba(42,40,37,0.04), 0 4px 16px rgba(42,40,37,0.06);
--shadow-card-hover:  0 4px 8px rgba(42,40,37,0.06), 0 12px 32px rgba(42,40,37,0.10);
--shadow-btn:         0 1px 2px rgba(42,40,37,0.06), 0 1px 3px rgba(42,40,37,0.10);
--shadow-bar:         0 -4px 16px rgba(0,0,0,0.06);   /* bottom action bar */
```

## Motion

```css
--ease:    cubic-bezier(0.4, 0, 0.2, 1);
--t-fast:  150ms;   /* hover, focus, color change */
--t-med:   220ms;   /* accordion expand, bar slide, chevron rotate */
```

`prefers-reduced-motion: reduce` → all durations 0ms, no transforms. Implemented as global override in the prototype.

## Iconography

**Lucide line icons**, 1.5–1.8px stroke, 18–22px nominal, `currentColor`. Inlined as SVG (no icon font, no external request).

Used: shield-check (trust), zap (electricity), snowflake-cross (climatização), wind (ventilação), wrench (manutenção), phone, whatsapp (filled), mail, map-pin, clock, layers, building, factory, briefcase, check, chevron-down, chevron-right, arrow-right, file-text.

## Button system

| Variant | Color | Use |
|---|---|---|
| `.btn--whatsapp` | WhatsApp green fill | Any action that opens WhatsApp — universal recognition trumps brand consistency |
| `.btn--primary` | Brand red fill | Conversion: form submit, "Pedir orçamento" inside service cards, partner-band primary CTA |
| `.btn--outline` | Dark border, transparent | Secondary action on light bg (e.g. "Ligar" alongside WhatsApp on light card) |
| `.btn--outline-light` | Light border, glass bg | Secondary action on hero photo / dark bg |
| `.btn--ghost` | Red text, no fill, becomes underlined on hover | Tertiary, "Saber mais →" type links |

Sizes: `--lg` (56px tall, 16px), `--md` (48px, 15px), `--sm` (40px, 14px). All ≥44px tap target on mobile.

Modifier: `.btn--block` for full-width.

Bottom-bar buttons (`.bbtn`) use a compact 2-line stack (icon + label) at 52px height. WhatsApp variant fills green.

## Form controls

- Inputs/textareas: `--bg-base` rest, `--bg-elevated` focus, border `--border-soft` → `--text-primary` on focus, 3px `rgba(42,40,37,0.08)` glow ring on focus.
- Invalid state: border `--accent`, glow `--accent-soft`.
- Min-height 48px. Font-size 16px (prevents iOS zoom on focus).
- Labels above inputs (no floating).
- Chips (radio group): `--bg-base` rest, `--text-primary` filled when checked.

## Z-index scale

| Layer | Value |
|---|---|
| Skip link | 1000 |
| Heatmap legend | 9999 (debug only) |
| Bottom action bar | 50 |
| Topbar | 40 |
| Form success live region | 1 (in-flow) |
| Default | auto |

## Breakpoints

| Name | Min-width | Use |
|---|---|---|
| `sm` | 480px | Reveal brand wordmark next to logo |
| `md` | 768px | Tablet adjustments, multi-column grids on numbers/footer |
| `lg` | 1024px | Desktop: 4-column service grid, compose-window chrome, hide bottom bar, show WhatsApp QR |

## Porting to Tailwind

If the Manus React project uses Tailwind, add to `tailwind.config.js`:

```js
theme: {
  extend: {
    colors: {
      'mdm-bg':      { base: '#faf8f4', elevated: '#fff', subtle: '#f0ebe3', dark: '#2a2825' },
      'mdm-text':    { primary: '#2a2825', secondary: '#5c5852', tertiary: '#8a857d' },
      'mdm-border':  { soft: '#e5ddd0', strong: '#2a2825' },
      'mdm-accent':  { DEFAULT: '#b61918', hover: '#9c1515', soft: '#fbeceb' },
      'whatsapp':    { DEFAULT: '#25D366', dark: '#1ea954' },
    },
    fontFamily: {
      display: ['Archivo', 'system-ui', 'sans-serif'],
      sans:    ['Inter', 'system-ui', 'sans-serif'],
    },
    borderRadius: { btn: '10px', card: '14px', input: '10px' },
    boxShadow: {
      card:        '0 1px 2px rgba(42,40,37,0.04), 0 4px 16px rgba(42,40,37,0.06)',
      'card-hover':'0 4px 8px rgba(42,40,37,0.06), 0 12px 32px rgba(42,40,37,0.10)',
      btn:         '0 1px 2px rgba(42,40,37,0.06), 0 1px 3px rgba(42,40,37,0.10)',
      bar:         '0 -4px 16px rgba(0,0,0,0.06)',
    },
  },
}
```
