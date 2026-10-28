# Image Manifest — MDM Assist Prototype

Every visual asset in `prototype/index.html`, what it is, where it sits, and what to do before production.

## Real brand assets (extracted from live site)

These come from the user's MHTML snapshot of [mdmassist.manus.space](https://mdmassist.manus.space) and are committed to `prototype/assets/`. They are brand-correct and lawful to use because they're MDM's own assets.

| File | Dimensions | Bytes | Used in |
|---|---|---|---|
| `mdm-logo-original.png` | 618×703 | 360 KB | Topbar brand mark (32px tall), footer brand block (44px tall, color-inverted via CSS filter) |
| `mdm-logo-mono-bg.png` | 2472×2812 | 1.2 MB | (Currently unused — reserved for a dark-section variant if needed. Compress to ~80 KB before production.) |
| `mitsubishi-electric-logo.png` | 2400×2400 | 75 KB | Mitsubishi partner band (104px wide), multi-brand supplier strip (first chip) |
| `mdm-qr-whatsapp.png` | 938×982 | 50 KB | Desktop contact section QR card (200×200 displayed) |
| `mdm-service-hvac-electrical.webp` | 1920×1080 | 244 KB | Hero background (with overlay), climatização card photo (16:9, top crop), eletricidade card photo (16:9, bottom crop) |
| `mdm-contact-operations.webp` | 1408×1056 | 104 KB | Empresa section photo (4:3, side panel on desktop), manutenção service card photo |

**Production action:**
- Run all PNGs through pngquant or oxipng (target 60–80% size reduction).
- Convert `mdm-logo-mono-bg.png` (currently 1.2 MB) to SVG if possible — it's a logotype, lossless vector preferred.
- Convert `mdm-qr-whatsapp.png` to SVG (QRs are scalable patterns — easy regen with `qrencode`).
- Generate `srcset` variants for the two `.webp` photos at 480w / 800w / 1280w / 1920w.

## Placeholders (replace before production)

### Setores section — 4 illustrations

Currently CSS-painted linear-gradient blocks with a placeholder badge and a Lucide icon overlay. Each `<div>` has class `setor__photo--{name}`.

| Card | What we want | Recommended source |
|---|---|---|
| **Indústria** | Industrial HVAC roof unit, factory mechanical room, or warehouse climate rack | Photograph an existing MDM industrial-client job (with permission) |
| **Escritórios** | Modern office interior showing ceiling diffusers, or a server-room split unit | Photograph an existing escritório client install |
| **Condomínios** | Lisbon apartment building façade with split-unit outdoor compressors on balconies | Photograph a Lisbon residential block MDM services |
| **Parque das Nações** | Vasco da Gama tower silhouette, Oriente station, or the Ponte Vasco da Gama from a job-site rooftop | Take a wide shot from any MDM rooftop job in the area |

**Aspect ratio:** 4:3 (1200×900 minimum). **Constraint:** must look candid/real, not stock — the entire point is to communicate "we actually work in places like yours."

### Ventilação service card

Currently the same placeholder treatment as setores. Replace with a single photo of a real MDM ventilation job — duct install, extraction unit, or an air-quality check in progress. 16:9, 800×450 minimum.

### Multi-brand supplier strip

Currently 5 of 6 brands are rendered as Archivo wordmarks in approximately the brand color:

| Brand | Current placeholder | Replace with |
|---|---|---|
| Mitsubishi Electric | Real logo PNG (`mitsubishi-electric-logo.png`) | Keep |
| Daikin | Text "Daikin" in `#0086D6` | Brand-approved SVG/PNG from Daikin's partner kit |
| LG | Text "LG" in `#A50034` | LG brand-approved logo |
| Samsung | Text "SAMSUNG" in `#1428A0` | Samsung brand-approved logo |
| Toshiba | Text "TOSHIBA" in `#E60012` | Toshiba brand-approved logo |
| Hitachi | Text "HITACHI" in `#000` | Hitachi brand-approved logo |

**Important:** brand logos for non-Mitsubishi manufacturers require MDM to either be an authorized installer/reseller for each brand, or to qualify the relationship in copy (e.g. "Servimos equipamentos das principais marcas"). Trademark caution — if MDM is *not* officially authorized for Daikin/LG/etc., consider removing the strip or downgrading the copy to "Compatível com" rather than implying partnership.

### Testimonial

Currently a synthetic example marked with a "Placeholder · usar testemunho real" badge. The section should **not ship to production** until at least one real customer quote exists with:
- Full quote text (1–3 sentences)
- Customer name (or sector role if customer prefers anonymity, e.g. "Administradora · condomínio Av. dos Combatentes")
- Photo or initials avatar
- Permission for use in marketing

Spec suggests collecting 2–3 quotes and rotating them. If MDM cannot produce a real one in the next 4 weeks, drop the section entirely — fake testimonials destroy trust faster than no testimonials build it.

### Static map snippet

`prototype/.../map-block__img` is a CSS-painted grid with a static pin. For production, replace with one of:

- Static map image from Google Maps Static API or Mapbox Static, sized 480×240 (mobile) / 240×120 (desktop). One image, no embedded iframe — performance.
- Or a hand-illustrated SVG that doesn't tie to a paid map API.

## Asset performance budget

| Asset class | Mobile budget | Notes |
|---|---|---|
| Hero photo | ≤120 KB (WebP, srcset to 800w) | Current source is 244 KB at 1920w — needs responsive variants |
| Service photos | ≤80 KB each | Lazy-load below the fold |
| Setor photos | ≤80 KB each | Lazy-load — they're in the carousel |
| Logos | ≤20 KB each | SVG ideal, otherwise pngquant |
| QR | ≤8 KB | SVG regen from `qrencode` is ~2 KB |

Total mobile asset payload target: ≤500 KB above-the-fold, ≤1.2 MB full page. Currently the prototype is ≈2 MB because we haven't compressed the source PNGs — flag this before production handoff.

## Alt-text strategy

| Image type | Alt approach |
|---|---|
| Brand logos | `alt="MDM Assist"`, `alt="Mitsubishi Electric — fornecedor autorizado"` — name the entity, qualify the relationship |
| Hero photo | Decorative role (alt empty) since headline carries the message; expose via `role="img" aria-label="..."` only for context |
| Service photos | Describe the service the photo demonstrates: `alt="Unidade de ar condicionado instalada"` |
| Setor photos | Describe the setting: `alt="Edifício residencial em Lisboa com unidades de ar condicionado"` |
| QR code | `alt="QR code para WhatsApp MDM Assist"` |
| Decorative gradients/icons | `alt=""` + `aria-hidden="true"` on the icon wrapper |

All text in Portuguese (PT-PT). Avoid `alt="image"` or filenames.

## Future visual investment

When MDM is ready for a photo refresh, the highest-ROI shoots are:

1. **One real on-site photo per setor (4 photos)** — replaces all four placeholder gradients. ~½ day of a photographer's time across existing jobs.
2. **One technician portrait** — would go in the Empresa section to put a face on the company.
3. **One short video loop (5–10s)** — hero background could become a Ken Burns crossfade or a muted autoplay video of a real install. Significantly more expensive but high-impact.

The current prototype is built so each of these can be swapped in without code changes beyond a single `background-image` URL or `<img src>`.
