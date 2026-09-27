# MDM website — Phase 1 audit

27/09/2026 · baseline: `site/index.html` at commit `4340be4` (the owner's "v2.2"; see §0) · status: **awaiting approval**

Scoring: **Impact** 1–5 (effect on qualified quote requests, calls, rankings or trust) × **Effort** 1–5 (1 = under an hour).
**Priority = Impact × (6 − Effort)**, max 25. Detailed evidence (screenshots, JSON, Lighthouse reports) is in the session scratchpad `audit/` folder; each finding below cites the key measurement.

---

## 0. Before reading: what the brief assumed vs what exists

| Brief says | Reality | Decision needed |
|---|---|---|
| Starting point `mdm-site-v2.2-FINAL.html` | No file with that name exists in the repo. The official site is `site/index.html` (creme), which is what was audited. | If v2.2-FINAL is a different file you have locally, upload it and I will diff it against this baseline. |
| v2.2 has a multi-split infographic, WhatsApp pre-fill strip, sticky mobile bar (Ligar / WhatsApp) | **None are on the page.** Multi-split schematic removed in `01b3c19`; sticky bar and green WhatsApp removed today by Header v5 (per the v4 "institutional" brief). Pre-filled WhatsApp messages survive only inside links. | The new brief reverses the v4 header brief on the sticky bar. Recommendation: bring back a sticky mobile bar (Phase 3). |
| "Manuel **Domingues** Melancia, Lda" | Registry (racius, NIF 502 644 761) and every third-party source say **Domingos**. Site uses Domingos. | Keep Domingos unless the certidão says otherwise. |
| Audience: homeowners and small businesses | The whole page speaks to facility managers: "edifícios de banca, indústria e condomínios", "Serviços críticos", "edifícios exigentes". | Confirm the audience switch (it changes H1, copy, form, proof). |
| Quote form via Netlify Forms | Form has a Supabase endpoint **not connected** (`LEAD_ENDPOINT = ''`); the main button opens the visitor's mail app. | Netlify Forms (brief) needs a Netlify project: needs your OK to create one. |
| PostHog only behind RGPD consent | PostHog runs cookieless (`persistence: 'memory'`) with no banner; opt-out on the privacy page. | Phase 2: consent banner vs cookieless mode (a banner costs conversions; cookieless may not need one). |
| "Do NOT reintroduce supplier references" | The FAQ still lists 6 brands (text only); JSON-LD `brand` lists 3 (one, Daikin, is not on the page). | Keep brands as FAQ text, or remove all? |
| GBP as source of truth for NAP, hours, photos | GBP not found by search; Google Maps is unreachable from this environment. | Send the GBP share link + fields in CONTENT-NEEDED.md §1. |
| No own domain yet | **An old MDM site is live and indexed at `www.mdmassist.com.pt`** ("MDM-Assist \| Ar condicionado \| Lisboa"). It is the only MDM site search engines return. | Which domain will the new site use; can .com.pt be 301-redirected? |

---

## 1. Execution log: what each Phase 1 step actually ran

| Step | Requested | What ran | Status |
|---|---|---|---|
| 1 | `/figma-preflight` | Not an installed command. Equivalent run: Figma `whoami` + file metadata. Account Carlos Melancia, **View seat on Starter plan = up to 20 read calls/month** (writes exempt). File `f6utVl8Hx1POsomLjSVd9Y` holds 3 boards: carmim (1:2), creme (15:2), Header v5 (17:2). | Done (equivalent) |
| 2 | `/map-design` → DESIGN.md | `site/DESIGN.md` already documents the language (merge 27/09); updated for Header v5 and one stale font reference fixed. | Done |
| 3 | `/searchfit-seo:seo-audit`, `technical-seo`, `ai-visibility` | Not installed. Equivalent manual audits: technical + on-page + schema + AI visibility (24 findings), and a local-presence/NAP sweep (10 findings). | Done (equivalent) |
| 3b | Live URL audit | `mdmassist.manus.space`, `mdmassist.com(.pt)`: **blocked by this environment's network policy** (retried 27/09, still `EGRESS_BLOCKED`). | **Not possible here**: see §9 |
| 4 | `/design-review`, `/design:accessibility-review` | Not installed. Equivalents: design + CRO review using the `impeccable-design` and `taste` skills with screenshots at 390/768/1440; WCAG 2.1 AA audit with axe-core 4.13 (15 viewport/state runs), keyboard runs, pixel-sampled contrast. Plus Lighthouse 13.5 baseline (12 runs). | Done (equivalent) |
| 5 | Competitor analysis | 10 search queries; top 5 chosen by frequency. **Competitor pages could not be opened (network block)**; analysis is from search titles and snippets. Not google.pt, no Maps pack. | Done with limits |
| 6 | AUDIT.md | This file + `CONTENT-NEEDED.md`. | Done |

---

## 2. Baseline numbers (Lighthouse 13.5, median of 3, localhost)

| Build | Form factor | Perf | A11y | Best Pr. | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
| `deploy/creme` (published) | mobile | 96 | 100 | 96* | 100 | **2.63 s** | 0.006 |
| `deploy/creme` | desktop | 95 | 100 | 96* | 100 | 0.58 s | **0.14** |
| `index.html` single file | mobile | **71** | 100 | 96* | 100 | **5.02 s** | 0.006 |
| `index.html` single file | desktop | 93 | 100 | 96* | 100 | 1.03 s | **0.14** |

\*Only failure: 2 console errors from Sentry/PostHog being blocked in the sandbox. Targets (95+, LCP < 2.0 s, CLS < 0.05) are missed on LCP (mobile) and CLS (desktop, web-font swap on the H1). axe-core: 0 violations; the real accessibility problems are the ones axe cannot see (§4).

---

## 3. The 10 highest-impact changes

| # | Change | Why (evidence) | I | E | Priority |
|---|---|---|---|---|---|
| 1 | **Make the form actually capture leads** (Netlify Forms, one "Enviar pedido" button, on-page success state with response time) | `LEAD_ENDPOINT = ''`; the primary button opens `mailto:`; on phones that often goes nowhere. The page admits it: "Se nada aconteceu, escreva para…" | 5 | 2 | 20 |
| 2 | **One primary CTA + sticky mobile bar** (Ligar · Pedir orçamento · WhatsApp as the single WhatsApp entry) | Hero has 3 equal "doors" to 3 channels; no quote button below 1200 px; form is 6.3 screens down on a phone | 5 | 2 | 20 |
| 3 | **Own domain, 301 from the old `mdmassist.com.pt`, GBP website field pointing to it** | All SEO equity goes to `manus.space`; the old .com.pt is the only indexed MDM site | 5 | 2 | 20 |
| 4 | **Service landing pages**: Ar condicionado, Bombas de calor, Instalações elétricas, Ventilação, Manutenção e assistência técnica | A 651-word one-pager cannot rank for 3 intents; every top competitor has one URL per service with "Lisboa" in the slug | 5 | 4 | 10 (but unlocks all local SEO) |
| 5 | **Heat pumps and multi-split exist on the site** (copy, form option, schema, infographic back) | "bomba de calor" appears 0 times, "multi-split" 0 times; heat-pump results are held by a Braga firm and marketplaces | 5 | 2 | 20 |
| 6 | **Rewrite for homeowners and small businesses** (H1/title with service terms + "Lisboa", "a sua casa, apartamento ou loja") | H1 is a slogan about "edifícios"; title leads with a non-query; B2B jargon throughout | 4 | 2 | 16 |
| 7 | **6-field qualifying form**: service (required), property type, urgency, locality, optional photo, contact | Today only 1 of 4 qualifying fields exists and it is optional | 4 | 2 | 16 |
| 8 | **Proof strip + how it works + real Google reviews summary** | No rating, no reviews link, no service-area line, no process; nobody in the competitor set shows a Google rating or promises a response time: open ground | 4 | 3 | 12 |
| 9 | **Hero readable and fast**: sharp real photo instead of the blurred background, content visible at first paint, font preload / metric fallback | Door subtitles 1.1–4.3:1 contrast over the photo (A11Y-01, serious); mobile LCP 2.63 s held back by reveal animation; desktop CLS 0.14 from font swap | 4 | 2 | 16 |
| 10 | **One entity everywhere**: one trading name (= GBP), NAP identical, schema fixed (`sameAs`, `geo`, `@id`, services; remove `brand`; FAQ text = visible text), `llms.txt` | 4 name variants on the page; "108A" vs "108 A"; FAQ schema answer contradicts visible text; no llms.txt | 3 | 1 | 15 |

---

## 4. All findings, scored

### Conversion (CRO)
| ID | Finding | Evidence | I | E | P |
|---|---|---|---|---|---|
| CRO-01 | No primary CTA; 3 equal hero doors to WhatsApp / mailto-or-tel / form | `.hero-doors` | 5 | 2 | 20 |
| CRO-02 | No sticky mobile bar; "Pedir orçamento" only ≥1200 px; form at y≈5358 of 6481 (390 px) | Header v5 removed it | 5 | 2 | 20 |
| CRO-03 | Form doesn't store leads (mailto fallback) | `LEAD_ENDPOINT = ''` | 5 | 2 | 20 |
| CRO-04 | Form doesn't qualify: no property type, urgency, locality, photo; service optional | `#quoteForm` | 4 | 2 | 16 |
| CRO-10 | No heat pumps, multi-split or "assistência técnica" as a service; "Quatro especialidades" | `#servicos` | 4 | 2 | 16 |
| CRO-11 | Copy aimed at facility managers, not homeowners/small businesses | H1, hero proof, band, form placeholders | 4 | 2 | 16 |
| CRO-09 | Missing: proof strip after hero, how it works, reviews, final CTA band | page order | 4 | 3 | 12 |
| CRO-05 | Email acts as a 4th channel (hero door 2, service row, contact card, form) | CTA map | 3 | 1 | 15 |
| CRO-13 | Claims needing written confirmation: "APIRAC · IMPIC", "certificados", "24–48h", "3 minutos"; brand lists disagree | band, FAQ, schema | 3 | 1 | 15 |
| CRO-06 | 2 WhatsApp links in one viewport at 768 and 1440 (AC + Ventilação rows) | scroll scan | 2 | 1 | 10 |
| CRO-07 | Ventilação row sends an "avaria" message; WhatsApp contact card sends the AC-install message | pre-fills | 2 | 1 | 10 |
| CRO-08 | FAQ tells visitors to use "o botão verde do topo", which no longer exists | last FAQ | 2 | 1 | 10 |
| CRO-12 | Contact-card links 22 px tall, FAQ links 19 px | 390 px | 2 | 1 | 10 |

### SEO, local and AI visibility
| ID | Finding | Evidence | I | E | P |
|---|---|---|---|---|---|
| SEO-01 | "bomba de calor" ×0, "multi-split" ×0 on the site | visible-text count | 5 | 2 | 20 |
| SEO-15 / LOC-02 | Canonical on `manus.space`; old `mdmassist.com.pt` is the only indexed MDM site | canonical, search | 5 | 2 | 20 |
| LOC-01 | GBP not findable by search; its URL, rating, categories, geo unknown | CONTENT-NEEDED §1 | 5 | 1 | 25 |
| SEO-02 | Single page (651 words) can't rank for service + city queries | word/keyword counts | 5 | 4 | 10 |
| SEO-03 | Title leads with "Manutenção e Assistência de Edifícios"; no "ar condicionado"/"AVAC" | l.48 | 4 | 1 | 20 |
| SEO-04 | H1 has no service term | hero | 4 | 1 | 20 |
| SEO-11 / LOC-03 | 4 trading-name variants on the page; "MDM-Assist" on the old site | schema, header, form, og | 4 | 1 | 20 |
| LOC-05 | No Facebook / Instagram / LinkedIn / directory listings found: no `sameAs` anchors | search | 4 | 3 | 12 |
| SEO-07 | FAQ schema answer ≠ visible answer (the "botão verde") | JSON-LD vs l.1206 | 3 | 1 | 15 |
| SEO-09 | LocalBusiness schema lacks `geo`, `sameAs`, `logo`, `image`, `@id`, services, municipalities | JSON-LD | 3 | 2 | 12 |
| SEO-10 | `brand` misused (means own brand); lists Daikin, not on the page | JSON-LD | 3 | 1 | 15 |
| SEO-13 | No municipalities named (Loures, Oeiras, Amadora…: 0 each) | text | 3 | 2 | 12 |
| SEO-16 | Favicons only as `data:` URIs; no crawlable favicon file, no manifest | deploy/creme | 3 | 1 | 15 |
| SEO-21 | No `llms.txt`; hero lacks a plain "who, what, where, since 1991" line | — | 3 | 2 | 12 |
| SEO-22 | Service cards link to wa.me/mailto, not to pages; no crawl path to service content | anchors | 3 | 2 | 12 |
| LOC-04 | Registry activity shows "business support services", not AVAC | racius | 3 | 3 | 9 |
| LOC-08 | "MDM" collides with other entities (an MDMA blog, a women's movement): always pair with "AVAC"/"Lisboa" | search | 3 | 1 | 15 |
| SEO-06 / DES-08 | Em dashes: 12 in visible copy + title, meta, JSON-LD, form messages, WhatsApp pre-fills; 9 en dashes as separators | text scan | 3 | 1 | 15 |
| SEO-12 | "108A" vs "108 A" | footer, privacy | 2 | 1 | 10 |
| SEO-17 | No 404 page | deploy/creme | 2 | 1 | 10 |
| SEO-18 | 3 JPEGs left, no `srcset`, 1920×1080 background served to phones | img/ | 2 | 1 | 10 |
| SEO-19 | Sentry `tracesSampleRate: 1.0` in head; PostHog loads eagerly | l.11–46 | 2 | 1 | 10 |
| SEO-23 | H2s are slogans with no keywords | headings | 2 | 1 | 10 |
| SEO-14 | Sitemap `lastmod` stale | sitemap.xml | 1 | 1 | 5 |
| SEO-08 | FAQ rich results no longer shown for this kind of site (keep markup only if synced) | Google policy since 08/2023 | 1 | 1 | 5 |

### Performance (Lighthouse)
| ID | Finding | Evidence | I | E | P |
|---|---|---|---|---|---|
| PERF-01 | Publish the externalised build only; single file = Perf 71, LCP 5.0 s on mobile | §2 | 4 | 1 | 20 |
| PERF-02 | Above-the-fold content gated behind JS reveal/animation; LCP element is the Obras H2 (render delay 1.19 s) | trace | 4 | 2 | 16 |
| PERF-03 | Desktop CLS 0.14 from Geist swapping on the H1 | cls-culprits | 4 | 2 | 16 |
| PERF-04 | Images oversized for their display size (103–160 KiB savings) | image-delivery | 3 | 2 | 12 |
| PERF-05 | Carousel rAF loop forces 46–62 ms reflow; auto-scroll doesn't actually run until interaction (fights `scroll-behavior: smooth`) | forced-reflow; a11y run | 2 | 2 | 8 |
| PERF-06 | Compression and long cache headers must be set at the host (verify on Netlify) | localhost had none | 3 | 1 | 15 |

### Accessibility (WCAG 2.1 AA): axe: 0 violations; found by manual checks
| ID | SC | Finding | I | E | P |
|---|---|---|---|---|---|
| A11Y-01 | 1.4.3 | **Serious**: hero door text over the blurred photo: 1.1–4.3:1 (768–1440 worst) | 4 | 2 | 16 |
| A11Y-04 | 1.4.3 | **Serious**: form placeholders #8F8B80: 2.8–3.4:1 and they carry real hints | 3 | 1 | 15 |
| A11Y-02 | 1.4.3 | "funcionar" (h1 em) 2.98:1 at 1440; hero proof line 2.0–4.0 | 3 | 2 | 12 |
| A11Y-03 | 1.4.3 | Carousel captions 2.4–4.4:1 on gradient | 2 | 1 | 10 |
| A11Y-05 | 2.4.7 | Carousel strip and FAQ `summary` use the browser's faint default focus ring | 3 | 1 | 15 |
| A11Y-06 | 1.4.11 | Red focus ring over the photo ~2.3:1 | 2 | 1 | 10 |
| A11Y-07 | 1.4.10 | "Para: mdmassist@…" clipped at 320–375 px | 2 | 1 | 10 |
| A11Y-08 | 1.4.11 | Inputs have no visible boundary (1.16:1 dividers) | 3 | 1 | 15 |
| A11Y-09 | 3.3.2 | "Email or phone" rule only stated after the fields | 3 | 1 | 15 |
| A11Y-10 | 3.3.1 | Error text renders off-screen below the textarea; focus not moved | 3 | 1 | 15 |
| A11Y-11 … 21 | various | Low: Enter doesn't submit; service-card link names start with the photo alt; "+" read in FAQ names; unnamed SVG; orphan label; all sizes in px (ignores user font size); hover-only captions; reveal hides focused cards; pause button shown under reduced motion | 1–2 | 1 | 5–10 |

### Visual design
| ID | Finding | I | E | P |
|---|---|---|---|---|
| DES-04 | Two photo sets look like two companies (polished carousel vs dim phone shots); **carousel provenance must be confirmed as real MDM work** | 4 | 2 | 16 |
| DES-01 | Blurred fixed background photo lowers contrast and carries no meaning | 3 | 1 | 15 |
| DES-03 | Mock macOS mail-window form: gimmick, off-palette dots, clipping on mobile | 3 | 2 | 12 |
| DES-07 | Navy "why us" panel is a template block of unevidenced claims | 3 | 2 | 12 |
| DES-02 | Same heading formula ×6 (red mono eyebrow + 2-line H2 + carmine last word): the most templated thing on the page | 2 | 2 | 8 |
| DES-05 | Browser-default blue links in the FAQ and form note | 2 | 1 | 10 |
| DES-06 | Alignment switches to centred in Contact/Quote; ~180 px dead space under hero at 1440 | 2 | 1 | 10 |
| DES-09 | Self-moving drag carousel instead of project cards with job, place, result | 2 | 2 | 8 |

### What is already good (keep)
Real Lisbon address, NIF, legal name and hours shown openly · 35 years is true and verifiable · lean stack (no framework, self-hosted fonts, WebP, lazy loading, width/height on images) · Accessibility and SEO both 100 in Lighthouse; 0 axe violations; keyboard, skip link, drawer and reduced motion all work · clean heading outline · descriptive PT-PT alt text on every photo · cookieless EU analytics with opt-out · new header passes all 23 of its acceptance checks.

---

## 5. Competitors (summary; full notes in the session scratchpad)

| | Termo Clima | AirTouch | Climonta | KLCLIMA | KR Ar Condicionado |
|---|---|---|---|---|---|
| Seen in (of 10 queries) | 6 | 4 | 4 | 4 | 3 |
| Base | Sintra | Lisboa (Lumiar) | Loures | **Braga** | Amadora |
| Main proof | 35/39/40 years (inconsistent), written guarantee, named clients | 10+ years, 500+ jobs, **3-year guarantee**, F-gas certified, projects page | **"desde 1991"**, F-gas certified, brands page | price ranges published | brands, reports after each job |
| Service + "Lisboa" pages | yes | yes (+ English pages) | exact-match domain | **many, 6+ heat-pump pages** | 1 heat-pump page |
| Google rating shown | no | no | no | no | no |

**What they do better:** one URL per service and per city; heat-pump content (KLCLIMA holds 4 of 10 results for "bomba de calor ar-água Lisboa" from Braga); explicit F-gas certification and written guarantees (AirTouch: 3 years); a projects page; published price ranges (KLCLIMA).

**Where MDM can win:**
1. **Lisbon-city HQ with 35 years.** Only AirTouch is inside Lisboa, and it has 10 years.
2. **AVAC + electrical under one roof.** No competitor shows this, and heat pumps often need a panel or power upgrade.
3. **Heat-pump searches are held by weak or distant players.** 3–4 honest pages with real photos can compete.
4. **"Manutenção / assistência AVAC Lisboa" is only contested by facility-management firms.** A clear maintenance-contract page fits MDM exactly.
5. **Nobody shows a Google rating or promises a response time.**
6. **Parque das Nações is a niche MDM can own** (district cooling, building rules; verify first).

Note: **Climonta also claims "desde 1991"** and is in nearby Loures, so "since 1991" alone won't differentiate.

Leads also go to marketplaces (Zaask ranked #1 in 7 of 10 queries, Fixando, OLX, Habitissimo) and to 24h call networks (BricoVitor, Tecnilar and SOS Lar share phone numbers).

---

## 6. Positioning recommendation

MDM should stop presenting itself as a facility-management supplier and speak as **the Lisbon installer that has done this for 35 years and does the whole job with its own team**. The recommended positioning is climate comfort (air conditioning, multi-split and heat pumps) installed, wired and then maintained by the same technicians, from a base in Parque das Nações since 1991. That one sentence carries three things competitors cannot match together: 35 years inside Lisbon itself (not Sintra, Loures or Braga), in-house electricians (the part of a heat-pump or multi-split job others subcontract), and after-sales maintenance by the people who installed it. Proof should be concrete and checkable: real photos with equipment, brand and place in the caption, the real Google rating and review count next to the quote button, written guarantee terms, certification numbers, and a stated reply time. Tone: confident and plain-spoken PT-PT, with no jargon and no em dashes. A working promise to test in Phase 2: *"Ar condicionado e bombas de calor em Lisboa, instalados e mantidos pela mesma equipa desde 1991."*

---

## 7. Real-device checklist for this checkpoint

There is no preview URL yet (see §9). As soon as a Netlify preview exists, test on **iPhone (Safari)** and **Android (Chrome)**:

1. First screen: can you see the phone number and understand what MDM does in under 5 seconds?
2. Tap the header phone number: the dialler opens with 218 935 050.
3. Open the menu: 5 links, phone, WhatsApp, "Pedir orçamento", hours. It closes on a link tap and on a tap outside.
4. WhatsApp from the menu opens WhatsApp to 910 307 579.
5. Scroll the whole page: no sideways scrolling, and nothing overlaps the header.
6. Hero text is readable over the photo in bright daylight (known issue A11Y-01).
7. Fill the form and send: note exactly what happens (today it opens the mail app). This is the #1 finding.
8. Rotate to landscape on a tablet: the menu or the burger shows, never neither.
9. Turn on "Reduce Motion" (iOS) or "Remove animations" (Android): nothing moves on its own.
10. Increase the system text size: note anything that doesn't grow (known issue A11Y-17).

---

## 8. Proposed next step (Phase 2, after approval)

STRATEGY.md: the promise and three proof points; tone guide; site map (home + 5 service pages + Obras + Contactos + Privacidade), checked against the data above; keyword → page map with title, meta and H1; a CTA map with 3 channels and one WhatsApp per viewport; the 6-field form spec; and the decisions from §0.

## 9. Blocked here, and how to unblock

- **Network.** This environment's network policy blocks `mdmassist.manus.space`, `mdmassist.com`, `mdmassist.com.pt`, `google.com/maps` and all competitor sites. It was retried and is still blocked. To allow them, open the environment settings (cloud environment menu in the session title bar → Edit → Network access) and add those domains or choose a broader access level ([docs](https://code.claude.com/docs/en/claude-code-on-the-web)). Then live-site checks and full competitor page reads can be re-run.
- **Preview URL.** The Netlify connector works, but none of the 3 existing Netlify projects is the MDM site. Creating a new project needs your OK.
- **Figma budget.** The Starter plan with a View seat allows about 20 read calls a month. Phases 3–4 should rely on write calls, which are exempt, and on local screenshots. Upgrading to a Dev or Full seat (200 calls a day) removes the limit.
