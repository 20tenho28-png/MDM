# UX Mobile Redesign Spec — MDM Assist

This is the canonical written spec for the redesign. It mirrors the prototype in `prototype/index.html` and is intended as the handover doc for the developer porting the design back into the live React project at `client/src/pages/Home.tsx` on Manus.

## 1. Context

MDM Assist is a Lisbon-based technical-services company (HVAC, electricity, ventilation, building maintenance) operating since 1991. The current site at [mdmassist.manus.space](https://mdmassist.manus.space) is a single-page React app built on Manus. The current design is competent on desktop but:

- Brutalist typography (`clamp(2.6rem, 10vw, 7.5rem)` headlines, weight 900) that reads as design-school cosplay rather than serious trades.
- A mobile menu button that opens nothing.
- A WhatsApp QR shown to mobile users who cannot scan their own screen.
- A 9-field form with no `inputmode`, no client validation, and a service-select that has `aria-invalid="true"` set by default (a bug).
- No icons, no photographs of real work, no testimonials, no process clarity.

**Result:** the site fails the urgent mobile user (no clear "tap to call now" path) AND the considered B2B user (no proof, no testimonials, no process). The redesign attacks both failure modes.

## 2. Primary mobile JTBD

> "Reach a real human at MDM in under 30 seconds, with enough proof — local, since 1991, Mitsubishi-authorized — that I trust them before I tap."

Every mobile decision below ladders up to that. The form is a secondary path for non-urgent buyers.

## 3. Information architecture

Mobile order:

1. **Topbar** — MDM logo (real PNG, height 32px), single "Contacto" link.
2. **Hero** — full-bleed background photo + warm-dark gradient overlay + trust strip + structured 3-line headline + WhatsApp/Ligar CTAs.
3. **Mitsubishi Electric partner band** — official Mitsubishi logo + "Parceiro oficial · Instalação e manutenção certificada".
4. **Contacto rápido** — WhatsApp + Telefone tiles, mobile-only.
5. **Serviços** — 4 accordion cards, each with a photo header.
6. **Multi-brand supplier strip** — "Serviço multimarca" (Mitsubishi · Daikin · LG · Samsung · Toshiba · Hitachi).
7. **Setores** — horizontal snap-scroll carousel, 4 cards.
8. **Empresa** — operations photo + 3 values.
9. **MDM em números** — 30+ · 4 · 2h · 100%.
10. **Como funciona** — 4-step process flow + "Orçamento gratuito · sem compromisso" pill.
11. **Orçamento** — form (compose-window chrome on desktop, plain card on mobile).
12. **Testemunho** — 1 quote card (data-placeholder).
13. **Contacto completo** — WhatsApp + Telefone + Email tiles + static map + (desktop only) WhatsApp QR.
14. **Footer** — MDM logo + legal copy.

Sticky overlay layer:
- **Topbar** — always sticky.
- **Bottom action bar** — appears after hero CTAs scroll out, hides when form is in view, hide-on-scroll-down.

Desktop renders identical sections in the same order, except `contact-quick` is hidden (its content is covered by the hero CTAs + later contacto section).

## 4. Sticky bottom action bar

Three actions, equal width, left-to-right: **Ligar** (neutral, transparent) · **WhatsApp** (filled WhatsApp green) · **Orçamento** (neutral, transparent, anchors to `#orcamento`).

**Behavior:**
- Hidden on page load.
- IntersectionObserver on `#hero-ctas` — when it leaves viewport, bar fades in (200ms).
- IntersectionObserver on `#orcamento` (threshold 0.25) — when form is in view, bar hides (no point competing with itself).
- Scroll listener: if scroll delta > 6px AND scrolling down AND scrollY > 200, bar slides down. On scroll-up, slides back.
- 52px tap height, `env(safe-area-inset-bottom)` padding for iOS.
- `role="toolbar" aria-label="Ações rápidas"`. Buttons announce destinations via `aria-label`.
- Hidden on `≥1024px`.
- Respects `prefers-reduced-motion`.

## 5. Hero

**Background:** full-bleed `mdm-service-hvac-electrical.webp`, `background-size: cover`, `background-position: center 30%` (so a person's hands working on equipment is roughly centered, not their face).

**Overlay (mobile):**
```
linear-gradient(180deg,
  rgba(42,40,37,0.82) 0%,
  rgba(42,40,37,0.62) 50%,
  rgba(250,248,244,0.98) 100%)
```

**Overlay (desktop ≥1024px):**
```
linear-gradient(95deg,
  rgba(42,40,37,0.85) 0%,
  rgba(42,40,37,0.55) 60%,
  rgba(42,40,37,0.25) 100%),
linear-gradient(180deg, transparent 70%, rgba(250,248,244,0.95) 100%)
```

(Left-weighted on desktop so the text column stays readable while the right side reveals more of the photograph.)

**Trust strip** (above headline):
- "DESDE 1991" pill (red-tinted, on dark bg uses `rgba(182,25,24,0.20)` with `#ffd5d4` text + 1px border `rgba(255,213,212,0.30)`)
- "LISBOA · MITSUBISHI ELECTRIC AUTHORIZED" in 11px uppercase 0.08em.

**Headline:** 3 lines, structured with `<br>`, soft cadence:
```
O seu ar condicionado,
a sua eletricidade,
a sua ventilação.
```
Final `.` colored `#ff6b6a` (a brighter red that reads on the dark overlay). Archivo 600, `clamp(1.85rem, 7vw, 2.5rem)` mobile, `clamp(3rem, 6vw, 5rem)` desktop. `text-wrap: balance` for browsers that support it.

**Subline:** "Assistência técnica em Lisboa. Resposta no mesmo dia, com transparência e relatório claro." — Inter 17px (`text-on-dark-soft`).

**CTAs:**
- Primary: **`btn--whatsapp btn--lg`** — WhatsApp green, full-width. Label "Falar no WhatsApp" with inline WhatsApp icon. Opens `wa.me/351910307579?text=...` with a pre-filled greeting.
- Secondary: **`btn--outline-light btn--lg`** — glass-style outline, full-width. Label "Ligar 910 307 579" with phone icon. `href="tel:+351910307579"`.

**Meta line below CTAs:** small green pulse dot + "Resposta típica em 2h em horário útil" — sets the response-time expectation immediately.

## 6. Mitsubishi Electric partner band

Immediately after the hero. White bg, soft top/bottom borders.

Layout (mobile = stacked, desktop ≥768 = horizontal):
- Left: official Mitsubishi Electric logo (84px wide mobile, 104px desktop), padded inside a cream box with soft border.
- Right (body):
  - Red eyebrow with shield-check icon: "PARCEIRO OFICIAL"
  - h2 (Archivo 600, 17–19px): "Instalação e manutenção certificada Mitsubishi Electric em Lisboa, desde 1991."
  - CTA row: `btn--ghost` "Saber mais →" (anchors `#empresa`) + `btn--primary btn--sm` "Pedir orçamento" (anchors `#orcamento`).

Rationale: Mitsubishi authorization is the single highest-credibility signal MDM has. Putting it second-on-page (immediately after the headline) front-loads trust before any service exploration.

## 7. Services (accordion)

4 cards, vertical stack on mobile, 4-column grid on desktop. Each card:

- **Photo header** (16:9, 108px tall mobile, 160px desktop): real photo where available, CSS-painted placeholder elsewhere. Photos listed in `docs/image-manifest.md`.
- **Header button** (`aria-expanded`, `aria-controls`): icon chip (red on `accent-soft`) + eyebrow + title + 1-line desc + chevron.
- **Body** (collapsed on mobile, always shown on desktop):
  - 3 bullets, red dot markers.
  - `btn--primary btn--sm` "Pedir orçamento" — anchors `#orcamento` AND adds `data-srv-cta` so JS pre-selects the correct chip in the form.

JS behavior:
- Tap header → expand inline. Only one open at a time (closing all others first).
- On desktop, ignore the click — body always visible.
- URL parameter `#orcamento?servico=climatizacao` (etc.) is read on page load and pre-selects the chip.

## 8. Multi-brand supplier strip

After services. White-card pills in a horizontal scroller on mobile (`scroll-snap-type: x proximity`), wrapped flex on tablet+. Each pill:
- 12px × 18px padding, `border-radius: 999px`, `border: 1px solid var(--border-soft)`.
- Mitsubishi pill uses the real logo PNG (height 18px).
- Other 5 pills use brand-colored wordmark text (placeholder until brand-approved logos exist).
- All start at `filter: grayscale(0.5) opacity(0.85)`. On hover/touch: `grayscale(0)`, `opacity(1)`, border darkens.

Below the strip: italic note "Logótipos das marcas a substituir pelos ficheiros oficiais antes de publicação." — only present in the prototype, removed in production.

## 9. Setores carousel

Horizontal snap-scroll (`scroll-snap-type: x mandatory`) on mobile. 4-column grid on desktop. Each card:

- **Photo** (4:3, 180px mobile / 220px desktop): CSS-painted gradient placeholder + sector icon overlay + "Placeholder" badge top-left.
- **Body**: title + 1-line description.

The placeholder pattern is intentionally honest — anyone reviewing the prototype sees "this needs a real photo" instead of being misled by stock that looks final.

## 10. Empresa

Two-column on desktop (text + 4:3 operations photo), stacked on mobile. The photo (`mdm-contact-operations.webp`) is real and stays. Below the lead paragraph: 3 value cards (Transparência / Versatilidade / Confiança), each with a 3px red left border.

## 11. MDM em números

Trust strip on `--bg-subtle`. 2×2 grid mobile, 4×1 desktop. Each stat:
- 22px line icon `--text-tertiary`
- Big numeral (Archivo 700, `clamp(2rem, 8vw, 3rem)`, `--accent`)
- 12px label `--text-secondary`, max 14ch width

Stats:
1. **30+** anos desde 1991 (shield icon)
2. **4** serviços integrados (layers icon)
3. **2h** resposta média (clock icon)
4. **100%** Lisboa & redondezas (map-pin icon)

## 12. Como funciona

4-step process flow with numbered circles (32px, red fill, white text), connected by 1px borders on desktop and stacked on mobile.

1. **Pedido** — Preenche o formulário ou WhatsApp.
2. **Resposta em 2h** — Confirmação e dúvidas iniciais.
3. **Visita gratuita** — Avaliação técnica sem compromisso.
4. **Orçamento <24h** — Proposta clara por email.

Below: reassurance pill in `--accent-soft` with red check icon — "Orçamento gratuito · sem compromisso · resposta em horário útil".

This block sits **above** the form, priming the reader that requesting an orçamento is fast, free, and clear.

## 13. Quote form

Drop the macOS compose-window chrome on mobile entirely. Keep it on `≥1024px` as desktop identity — wrap chrome in `.compose-chrome` div that's `display: contents` (passthrough) on mobile and `display: block` on desktop.

### Fields

In display order:

| # | Field | Input | inputmode | autocomplete | Required |
|---|---|---|---|---|---|
| 1 | Serviço | Segmented chips (4), `role="radiogroup"` | — | — | yes |
| 2 | Assunto | text | text | off | yes |
| 3 | Mensagem | textarea, 4 rows, auto-grow | text | off | yes |
| 4 | Nome | text | text | name | yes |
| 5 | Telefone | tel | tel | tel | yes |
| 6 | Email | email | email | email | yes |
| 7 | **Sou empresa (opcional)** — collapsed by default: | | | | |
| 7a | Empresa | text | text | organization | no |
| 7b | NIF | text, `pattern="[0-9]{9}"`, `maxlength="9"` | numeric | off | no |
| 7c | Localidade | text | text | address-level2 | no |

### Rules

- Static labels above inputs (no floating).
- Errors inline below the field on blur, `aria-describedby`, never `alert()`, never error-summary on mobile.
- **Remove the existing `aria-invalid="true"` default on the service select** — it's a bug in the current site.
- "Prefere falar agora? WhatsApp →" escape-hatch link below submit (WhatsApp green underlined).
- Honeypot `<input name="website">` hidden field; no captcha.
- Submit button: `btn--primary btn--lg btn--block`, label "Enviar pedido". Brand red — this is the conversion.
- Success state: green-bordered card with check icon, "Pedido recebido", + "Resposta tipicamente em 2h em horário útil. Para urgências:" + WhatsApp button. Live region `role="status" aria-live="polite"`.

### Payload shape (for backend implementation)

```json
{
  "servico": "climatizacao | eletricidade | ventilacao | manutencao",
  "assunto": "string",
  "mensagem": "string",
  "nome": "string",
  "telefone": "string",
  "email": "string",
  "empresa": "string | null",
  "nif": "string | null (9 digits)",
  "localidade": "string | null",
  "_source": "mdmassist.manus.space",
  "_userAgent": "string"
}
```

POST to whatever endpoint the Manus app exposes. Validate server-side: required fields, email format, NIF length. Send confirmation email to both customer and `geral@mdmassist.com`.

## 14. Testimonial

Single quote card on `--bg-subtle`. Currently uses synthetic copy + initials avatar, both clearly flagged as data-placeholder. **Do not ship this section until at least one real quote exists** — see `docs/image-manifest.md` for the collection brief.

## 15. Contacto completo

Two-column layout on desktop: tiles + map on the left, WhatsApp QR card on the right (real `mdm-qr-whatsapp.png`). On mobile, the QR is hidden (`display: none` below 1024px) — the contacto-quick section already handles mobile contact.

Three tiles: WhatsApp (green left border) · Telefone · Email. Each tile is the full row, with a 48px icon chip, label / value / meta lines, and an optional chevron.

Static map: CSS-painted grid background with an SVG pin overlay. Links to `maps.google.com/?q=Parque+das+Nações+Lisboa`. Real production should swap this for a real static map image.

## 16. Footer

Dark `--bg-dark` background. Three blocks:
- MDM logo (44px tall, color-inverted via `filter: brightness(0) invert(1)` to render as white on dark) + brand text + tagline.
- Contact lines (WhatsApp + Email).

## 17. Visual system

See `docs/design-tokens.md` for the canonical token list (colors, type, radius, spacing, shadows, motion, button system).

Highlights:
- Palette is warm/neutral with red restricted to conversion + accent moments.
- WhatsApp green is universal — every WhatsApp button uses it, not brand red.
- Archivo (display) kept; IBM Plex Sans (body) swapped to Inter.
- Sharp 0px corners gone — buttons 10px, cards 14px, chips pill.
- Subtle motion (150–220ms) honored by `prefers-reduced-motion`.

## 18. Accessibility

- `lang="pt-PT"`, semantic landmarks (`<header>`, `<nav>` implied via topbar, `<main>`, `<section aria-labelledby>`, `<footer>`), skip link "Saltar para o conteúdo".
- All interactive ≥44px (bottom bar 52px, hero CTAs 56px).
- Focus rings preserved (`:focus-visible` 2px solid `--focus-ring` 2px offset).
- Form: every input `<label for>`, errors via `aria-describedby`, required visually marked `*` with `aria-label="obrigatório"`. Live region for success.
- Accordion: `aria-expanded` + `aria-controls`. Carousel: `role="region" aria-roledescription="carrossel"`. Bottom bar: `role="toolbar"`.
- Color contrast verified (AAA primary text, AA secondary, AA red on white).
- All copy PT-PT ("telemóvel", "orçamento", "telefone"). `&nbsp;` between number + unit.

## 19. Heatmap thinking + instrumentation

Predicted touch heatmap (see `data-heat-tier` attributes across the prototype):

- **Tier 1** (>60% of taps): bottom-bar WhatsApp, hero WhatsApp, bottom-bar Ligar, hero Ligar, contacto-quick WhatsApp tile, service-card headers, form submit, success-state WhatsApp, contacto WhatsApp tile.
- **Tier 2** (~25%): bottom-bar Orçamento, in-card "Pedir orçamento" buttons, Mitsubishi-band "Pedir orçamento", chips, form-escape WhatsApp link, contacto Telefone/Email tiles.
- **Tier 3** (~15%): topbar Contacto, form text fields, B2B toggle, Mitsubishi "Saber mais", map block, setores cards.
- **Tier 4** (near-zero — fix signal if heat lands here): topbar brand mark.

Instrumentation for production: **Microsoft Clarity** (free, GDPR-friendly, heatmaps + session recordings + rage/dead clicks). Single script tag in `<head>`. Spec:

```html
<!-- Microsoft Clarity — gated behind cookie consent in production -->
<script type="text/javascript">
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "YOUR_CLARITY_ID");
</script>
```

Add only after a working consent banner is in place.

Post-launch validation (≥2 weeks of traffic):
1. Tier 1 elements collectively own ≥60% of taps.
2. No rage clicks on Tier 4.
3. No dead clicks in the hero, services or partner band.
4. Cross-reference scroll depth with form submission rate.
5. Time-to-first-WhatsApp-tap median <15s for urgent-path persona.

Debug overlay: append `?heatmap=debug` to the prototype URL to see predicted tiers visualized. Not for production.

## 20. Open questions (not blockers)

1. **WhatsApp green as the primary CTA system color?** Already adopted in this prototype — WhatsApp green for WhatsApp actions, brand red for conversion. Worth confirming with MDM brand owner before production.
2. **Multi-brand supplier strip — keep or drop?** If MDM is not officially authorized for Daikin/LG/Samsung/Toshiba/Hitachi, the strip risks misrepresenting partnership. Either keep with a qualifying line ("Compatível com as principais marcas — autorizado oficial Mitsubishi Electric") or remove.
3. **Testimonial — collect first or drop?** Section ships only with real quotes.
4. **EN translation toggle?** Out of scope for v1.
5. **Cookie consent banner?** Out of scope for the prototype, mandatory for production with Microsoft Clarity.
6. **Real form endpoint?** Not in prototype — the React port needs to wire up the `payload shape` above.

## 21. Out of scope

- Tablet-specific layout (mobile works fine 768–1023).
- BEM / utility-class methodology (semantic classes + custom properties is enough for a 1-page site).
- Component library or design-token framework (overengineered).
- Service worker / PWA.
- Tests (it's a prototype).
- Production-grade image optimization pipeline.
