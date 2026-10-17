# Handoff Notes — Porting the Prototype into the Manus React Project

This document is for the developer who will translate `prototype/index.html` into the live React app at `client/src/pages/Home.tsx` on Manus.

## Mental model

The prototype is **one big HTML file** because the goal was to evaluate the UX, not impose an architecture. The React port should reorganize into components but **not change the visual or interaction design** unless something is clearly broken when ported.

## Suggested component split

Roughly one component per section. Keep them dumb (presentational); lift state only where it actually crosses boundaries.

```
Home.tsx (page composition + URL param read)
├── Topbar.tsx
├── Hero.tsx
├── MitsubishiPartnerBand.tsx
├── ContactQuick.tsx                 (mobile-only via media-query CSS, not JS)
├── Services/
│   ├── ServiceList.tsx              (accordion state lives here)
│   └── ServiceCard.tsx              (presentational; receives `expanded` prop)
├── SupplierStrip.tsx
├── Setores/
│   ├── SetoresCarousel.tsx
│   └── SetorCard.tsx
├── Empresa.tsx
├── TrustNumbers.tsx
├── Process.tsx                       (steps + reassurance pill)
├── QuoteForm/
│   ├── QuoteForm.tsx                 (form state, validation, submit)
│   ├── ServiceChips.tsx              (radio chips)
│   ├── B2BSection.tsx                (collapsible)
│   └── SuccessState.tsx
├── Testimonial.tsx                   (gate render on real-data flag)
├── ContactoCompleto.tsx
├── Footer.tsx
└── BottomBar.tsx                     (IntersectionObservers, scroll listener)
```

## State boundaries

Most components are stateless. The pieces that need state:

| Component | State |
|---|---|
| `ServiceList` | `expandedId: string \| null` (mobile only — desktop ignores and renders all open) |
| `QuoteForm` | form values, per-field invalid flags, submitted/success boolean |
| `B2BSection` | `open: boolean` |
| `BottomBar` | `pastHero: boolean`, `inForm: boolean`, `hidden: boolean` (scroll-down) |

Everything else takes props.

## IntersectionObserver for BottomBar

The prototype attaches two observers — one to the hero CTA block, one to the form section. The React component should use a `useEffect` with cleanup:

```tsx
useEffect(() => {
  const heroObs = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { threshold: 0 });
  const formObs = new IntersectionObserver(([e]) => setInForm(e.isIntersecting), { threshold: 0.25 });
  const hero = document.getElementById('hero-ctas');
  const form = document.getElementById('orcamento');
  if (hero) heroObs.observe(hero);
  if (form) formObs.observe(form);
  return () => { heroObs.disconnect(); formObs.disconnect(); };
}, []);
```

Plus a scroll listener with passive: true and a 6px delta threshold (see `prototype/index.html` for the exact pattern).

## URL param read for chip pre-select

The prototype reads `#orcamento?servico=climatizacao` on load. React port: read this on mount of `QuoteForm` (via `useEffect` with empty deps) and set the chip state accordingly.

```tsx
const [servico, setServico] = useState<string | null>(null);
useEffect(() => {
  const m = window.location.hash.match(/[?&]servico=([^&]+)/);
  if (m) setServico(decodeURIComponent(m[1]));
}, []);
```

## Form submission

Currently the prototype's submit is a no-op that just shows the success state. The React port should:

1. Validate client-side using the same rules (chip required, text fields non-empty, email format).
2. POST to whatever endpoint Manus exposes. Payload shape in `docs/ux-mobile-redesign-spec.md` §13.
3. On 2xx: show success state.
4. On 4xx: re-enable the form, show inline error (translate server validation errors into PT-PT).
5. On 5xx / network: same as 4xx, with a "Tente novamente" message and a WhatsApp escape link.

## What to throw away from the current Home.tsx

Based on the MHTML snapshot of the current live site:

- The "mobile Menu" button that opens nothing — gone. Replaced by the single "Contacto" topbar link + the bottom action bar.
- The decorative window dots over the hero ("h-3 w-3 rounded-full bg-[#28c840]" etc.) — gone. They communicated nothing.
- The mailto with prefilled body — replaced with empty mailto on mobile, kept the prefill only as a desktop affordance if at all.
- The mobile WhatsApp QR — gone on mobile (cannot scan own screen), kept on desktop.
- The default `aria-invalid="true"` on the service select — bug, fixed.
- The `<select>` for service — replaced with chips.
- The huge `clamp(2.6rem, 10vw, 7.5rem)` hero — capped at 5.5rem and dropped to weight 600.
- The 0px radius everywhere — replaced with consistent 10/14/pill radii.

## What to keep from the current Home.tsx

- Section anchor IDs (`topo`, `servicos`, `setores`, `empresa`, `orcamento`, `contacto`). They are used externally.
- Existing copy where it works — the redesign mostly preserves Portuguese microcopy from the original.
- The brand color `#b61918`.
- The Mitsubishi Electric supplier badge concept (now upgraded to a full band).
- The macOS compose-window chrome around the form — kept as a desktop-only flourish.

## Asset pipeline

Six real brand assets in `prototype/assets/`. For production, these should:

1. Move to whatever asset CDN Manus uses (or stay in `manus-storage/`).
2. PNGs compressed with pngquant (target 60–80% size reduction).
3. WebP photos generated with `srcset` variants at 480w / 800w / 1280w / 1920w.
4. Logos preferably converted to SVG.

See `docs/image-manifest.md` for details and replacement briefs for the placeholder assets.

## Fonts

Currently loaded via Google Fonts CDN:
```
https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap
```

For production, consider self-hosting (use `fontsource` packages or downloaded woff2) to avoid the Google connection on every page load. Both fonts are OFL-licensed.

## Heatmap instrumentation

Microsoft Clarity snippet in `<head>`. Must be gated behind a working cookie-consent banner — Clarity records sessions, so PII/consent rules apply.

## A11y checklist for the React port

- [ ] `lang="pt-PT"` on `<html>`.
- [ ] Skip link as the first focusable element.
- [ ] All inputs have associated `<label htmlFor>` (or `aria-label` if no visible label).
- [ ] Required field asterisks have `aria-label="obrigatório"`.
- [ ] Validation errors connected via `aria-describedby`.
- [ ] Accordion buttons have `aria-expanded` + `aria-controls`.
- [ ] Carousel has `role="region" aria-roledescription="carrossel"`.
- [ ] Bottom bar has `role="toolbar" aria-label="Ações rápidas"`.
- [ ] Success state has `role="status" aria-live="polite"`.
- [ ] No `outline: none` without a `:focus-visible` replacement.
- [ ] Tap targets ≥44px (bottom bar 52px).
- [ ] Honors `prefers-reduced-motion`.

## Performance budget

Target Lighthouse mobile scores:
- Performance ≥85 (drops slightly because real photos exist)
- Accessibility ≥95
- Best practices ≥95
- SEO ≥95

Largest expected risks:
- Hero `.webp` if not responsive — see asset pipeline.
- Google Fonts blocking render — preconnect already in place; `font-display: swap` is in the URL.
- Backdrop-filter on topbar/bottom-bar — fine on modern phones, falls back gracefully.

## Testing checklist (run before merging the React port)

See `docs/ux-mobile-redesign-spec.md` §19 + the verification section of the original plan at `/root/.claude/plans/`.

Quick sanity loop:
1. iPhone SE (375×667) — visual sweep, every section has an image or chromed element.
2. Tap bottom-bar WhatsApp → opens `wa.me`.
3. Tap a service card → expands, "Pedir orçamento" pre-selects the chip.
4. Tap each form field → correct keyboard appears (tel/email/numeric).
5. Submit empty form → inline errors on all required fields, page scrolls to first error.
6. Submit valid form → success state, announces via screen reader, WhatsApp escape button visible.
7. Append `?heatmap=debug` → tier overlay appears.
8. Test in Safari + Chrome + Firefox.
9. Test with VoiceOver / TalkBack — landmarks announced, form is navigable.

## When in doubt

Don't redesign during the port. If something doesn't translate cleanly (e.g. a CSS feature isn't supported by your build pipeline), find the closest visually-faithful workaround and flag it in a PR comment rather than improvising a new pattern.
