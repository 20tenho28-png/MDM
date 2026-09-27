# MDM website — Phase 2 strategy

27/09/2026 · builds on `AUDIT.md` (Phase 1, approved) and the owner decisions recorded in its §0 · status: **awaiting approval**

All proposed copy is PT-PT with no em dashes. Anything that depends on a fact the owner has not yet supplied is marked `[[…]]` and is listed in `CONTENT-NEEDED.md`; it will not be published as a placeholder.

---

## 1. Positioning

### The promise (headline)
> **Ar condicionado e bombas de calor em Lisboa, instalados e mantidos pela mesma equipa desde 1991.**

Short form for small spaces (sticky bar, OG image, GBP description opening): *"A mesma equipa, da instalação à manutenção. Lisboa, desde 1991."*

Why this and not a slogan: the three things only MDM can say together are (1) 35 years based **inside** Lisboa, (2) its **own electricians** on the same job, and (3) the people who install are the people who maintain. Competitors each have one of these at most (AUDIT §5). "Since 1991" alone is not enough: Climonta says it too.

### Three supporting proof points
| # | Proof point | How it is shown (only verifiable material) |
|---|---|---|
| 1 | **35 anos em Lisboa.** Sede no Parque das Nações desde 1991. | Founding year, full address and NIF in the footer and on Contactos; real photos with the place in the caption. |
| 2 | **A obra completa, com a nossa equipa.** Frio, calor e a parte elétrica: sem subempreiteiros para o quadro ou a alimentação. | Service pages explain the electrical part of each job (heat pumps, multi-split); certifications named: APIRAC · IMPIC, eletricista certificado, certificação F-gas (numbers when supplied). |
| 3 | **Quem instala, mantém.** Contratos de manutenção e assistência técnica pela mesma equipa. | Maintenance page with what a visit includes; the real Google rating and review count next to the quote button (`[[GBP_RATING]]`, `[[GBP_REVIEWS]]`, hidden until supplied). |

No response-time promise anywhere (owner decision). No prices unless the owner supplies ranges.

### Tone of voice
**Confident, technical when it helps, always plain.** Like a senior technician explaining the job at your door: says what will be done, why, and what it needs from you.

| Do | Don't |
|---|---|
| Speak to *you*: "a sua casa", "o seu apartamento", "a sua loja" | "Os nossos clientes institucionais", "soluções integradas" |
| Name the equipment and the place: "Bomba de calor Midea em moradia, Loures" | Adjectives in place of facts: "excelência", "o melhor serviço" |
| Explain one technical point per section in one sentence ("Uma bomba de calor precisa de uma alimentação elétrica própria; tratamos disso na mesma obra.") | Jargon without translation: "alimentações AVAC", "chiller" on the home page |
| Short sentences. Commas, full stops, parentheses | Em dashes (—). En dashes as separators: write "2ª a 6ª, 8h às 17h" |
| European Portuguese: telemóvel, equipa, orçamento, casa de banho, arrendatário | Brazilian forms: celular, equipe, time, contato |
| Sentence case in buttons: "Pedir orçamento" | Title Case, "GRÁTIS", "Já!", exclamation marks |
| State certifications exactly as held | Any time promise ("24h", "rápido"), invented numbers, "nº 1" |

Word list: *orçamento* (never "cotação"), *visita técnica*, *assistência técnica*, *manutenção*, *avaria*, *instalação*, *bomba de calor ar-água*, *multi-split*, *unidade interior / exterior*, *quadro elétrico*.

---

## 2. Site structure

### Proposed map (domain `mdmassist.com.pt`, decided)

| URL | Page | Role | Primary keyword |
|---|---|---|---|
| `/` | Home | Conversion hub; brand + "empresa AVAC Lisboa" | empresa AVAC Lisboa (+ brand) |
| `/ar-condicionado-lisboa/` | Ar condicionado (split, **multi-split**, conduta) | Service landing | ar condicionado Lisboa |
| `/bombas-de-calor-lisboa/` | Bombas de calor ar-água | Service landing | bomba de calor Lisboa |
| `/instalacoes-eletricas-lisboa/` | Instalações elétricas | Service landing | instalações elétricas Lisboa |
| `/ventilacao-lisboa/` | Ventilação e extração | Service landing | ventilação Lisboa |
| `/manutencao-assistencia-avac-lisboa/` | Manutenção e assistência técnica | Service landing | assistência técnica AVAC Lisboa |
| `/obras/` | Obras (galeria com legendas) | Proof | obras AVAC Lisboa (secondary) |
| `/contactos/` | Contactos | NAP, map link, form | MDM contactos (brand) |
| `/privacidade/` | Política de privacidade | Legal | n/a (noindex, follow) |
| `/404.html` | Página não encontrada | Recovery | n/a |

### Where the data supports the brief, and where it challenges it
- **Keep the 5 service pages. The data is unambiguous.** Every top competitor has one URL per service, and a 651-word one-pager cannot rank for three intents (AUDIT SEO-02). Heat pumps and maintenance are the two weakest-contested intents (AUDIT §5, points 3 and 4), so they are built first.
- **Multi-split is a section, not a page.** It shares the "ar condicionado" intent. It gets a dedicated section with the **multi-split infographic brought back**, and "multi-split Lisboa" as a secondary keyword. A separate page would cannibalise the AC page.
- **"Instalações elétricas" is framed for the new audience.** Homeowners don't search "alimentações AVAC". The page leads with *eletricista / quadro elétrico* and uses the heat-pump and AC power supply as its differentiator. Secondary keyword: "eletricista Lisboa". This is the least competitive fit of the five; it stays because it carries proof point 2.
- **Obras as its own page, conditionally.** Only **8 real photos** are confirmed today (#2 to #9; #1 and #10 removed). A gallery page with 8 photos is thin. Recommendation: build it at launch only if at least 12 real, captioned photos exist; otherwise keep projects as a home section and publish `/obras/` when the photos arrive. (Decision for the owner, §6.)
- **Contactos page: keep it light.** It is the page GBP, directories and sitelinks point to. It holds NAP identical to the GBP, the map link, hours and the form. The home keeps its own final CTA.
- **Not now, later:**
  - a Parque das Nações page (district cooling, building rules; needs verification);
  - an English version for expats (AirTouch has one);
  - a "quanto custa" guide (only with the owner's own price ranges).
- **Old site redirects.** The old `mdmassist.com.pt` URLs must 301 to their closest new page. Known today: `/`, `/index.html` → `/`; `/#Contato` → `/contactos/`. A full crawl of the old site is blocked from this environment (AUDIT §9) and must be done before launch.

### Home page order (the brief's order, tested against the data)
1. **Hero**
   - The promise (H1), one sentence of who/what/where/since.
   - Primary CTA **Pedir orçamento** (to the form) and secondary **Ligar 218 935 050**.
   - A sharp, real job photo instead of the blurred background (A11Y-01, DES-01).
2. **Proof strip:** Desde 1991 · Google `[[GBP_RATING]]` (`[[GBP_REVIEWS]]` avaliações) · Grande Lisboa `[[CONCELHOS]]` · APIRAC · IMPIC · F-gas. The rating cell is omitted until the real numbers exist.
3. **Services:** 6 rows, each linking to its page:
   - Ar condicionado
   - Multi-split (anchor into the AC page)
   - Bombas de calor
   - Instalações elétricas
   - Ventilação
   - Manutenção e assistência

   This keeps the current row design, with real photos.
4. **Featured projects:** 3 or 4 cards: photo, equipment and brand, type of property, place.
5. **How it works (3 steps):** 1 Pedido (formulário, telefone ou WhatsApp) → 2 Visita técnica e orçamento → 3 Instalação e manutenção pela mesma equipa. Wording to be confirmed by the owner (CONTENT-NEEDED 4.5).
6. **Google reviews:** a summary line + "Ver avaliações no Google" link to the GBP. Shown only with real numbers; no quotes unless copied verbatim with the reviewer's public name as shown on Google.
7. **FAQ:** 5 or 6 questions rewritten for homeowners, e.g.:
   - "Fazem orçamento sem compromisso?"
   - "Que marcas instalam?" (answer: MIDEA, Mitsubishi Electric, Daikin, France Air, as text)
   - "A bomba de calor precisa de obras elétricas?"
   - "Fazem contratos de manutenção para casas e lojas?"
   - "Que zonas servem?"
   - "Como peço assistência para uma avaria?"
8. **Final CTA:** the form (6 fields), plus phone and WhatsApp as alternatives.

Removed from the current home: the navy "Porquê a MDM" template panel (its true claims move into the proof strip), the mock mail-window form styling, the self-moving carousel (replaced by the project cards), the blurred background.

---

## 3. Keyword map: one primary keyword per page

No search-volume tool is available in this environment, so clustering is based on the SERP evidence gathered in Phase 1: which queries return which kinds of page (AUDIT §5). Volumes should be checked in Google Search Console after launch and the map revised at 90 days.

| Page | Primary | Secondary (same intent) | `<title>` (≤ 60) | Meta description (≤ 155) | H1 |
|---|---|---|---|---|---|
| Home | empresa AVAC Lisboa | MDM AVAC, ar condicionado e bombas de calor Lisboa | Ar condicionado e AVAC em Lisboa desde 1991 \| MDM (49) | Instalação e manutenção de ar condicionado, bombas de calor, eletricidade e ventilação em Lisboa. A mesma equipa desde 1991. Peça orçamento. (140) | Ar condicionado e bombas de calor em Lisboa, instalados e mantidos pela mesma equipa desde 1991. |
| Ar condicionado | ar condicionado Lisboa | instalação ar condicionado Lisboa, multi-split Lisboa, ar condicionado conduta | Instalação de ar condicionado em Lisboa \| MDM (45) | Split, multi-split e conduta em casas, apartamentos e lojas de Lisboa. Instalação certificada, com eletricista da casa e manutenção pela mesma equipa. | Instalação de ar condicionado em Lisboa |
| Bombas de calor | bomba de calor Lisboa | bomba de calor ar-água Lisboa, instalação bomba de calor, bomba de calor AQS | Bombas de calor ar-água em Lisboa \| MDM (39) | Instalação e manutenção de bombas de calor ar-água para águas quentes e aquecimento em Lisboa. Técnicos certificados F-gas e eletricistas da casa. (146) | Bombas de calor ar-água em Lisboa |
| Instalações elétricas | instalações elétricas Lisboa | eletricista Lisboa, quadro elétrico Lisboa | Eletricista e instalações elétricas em Lisboa \| MDM (51) | Quadros elétricos, alimentações para ar condicionado e bombas de calor, remodelações. Eletricista certificado com 35 anos de obra em Lisboa. (140) | Instalações elétricas e quadros em Lisboa |
| Ventilação | ventilação Lisboa | extração de fumos Lisboa, ventilação restaurante | Ventilação e extração em Lisboa \| MDM (37) | Instalação e manutenção de ventilação e extração para casas, cozinhas, lojas e restaurantes em Lisboa. Condutas, grupos de extração e revisões. (143) | Ventilação e extração em Lisboa |
| Manutenção e assistência | assistência técnica AVAC Lisboa | manutenção ar condicionado Lisboa, reparação ar condicionado Lisboa, contrato manutenção AVAC | Manutenção e assistência técnica AVAC em Lisboa \| MDM (53) | Assistência técnica e contratos de manutenção de ar condicionado e bombas de calor em Lisboa, para casas, lojas e condomínios. `[[com relatório em cada visita, se confirmado]]` | Manutenção e assistência técnica AVAC em Lisboa |
| Obras | obras AVAC Lisboa | fotografias instalação ar condicionado | Obras de ar condicionado e AVAC em Lisboa \| MDM (47) | Fotografias de obras reais da MDM em Lisboa: ar condicionado, bombas de calor, quadros elétricos e ventilação, com equipamento e local. (135) | Obras da MDM em Lisboa |
| Contactos | MDM contactos | MDM Parque das Nações | Contactos da MDM, AVAC no Parque das Nações (43) | Telefone 218 935 050, WhatsApp 910 307 579 e formulário de orçamento. Alameda dos Oceanos 108A, 1990-426 Lisboa. 2ª a 6ª, 8h às 17h. (132) | Contactos |

Rules:
- One H1 per page.
- Each service page is 400–800 words of original PT-PT, with 3–5 FAQs specific to that service and one internal link to each related service. Example: heat pumps ↔ instalações elétricas ↔ manutenção.
- The home links to all service pages from the service rows, which today go to wa.me/mailto.
- The trading name in `<title>` is "MDM" until the exact GBP name is copied (CONTENT-NEEDED 1.2).

---

## 4. Conversion architecture

### Channels (three only)
| Channel | Role | Where it lives |
|---|---|---|
| **Formulário de orçamento** | Primary. Qualified quote requests | Hero primary button, service pages, home final CTA, Contactos, sticky bar |
| **Telefone 218 935 050** | Secondary. Assistance calls, people who prefer to talk | Header (all widths), hero secondary, sticky bar, footer, Contactos |
| **WhatsApp 910 307 579** | Tertiary. Photos of an avaria or of the site | **Exactly one entry per viewport**: the sticky bar on mobile; on desktop only in the contact block and the form's success state |

Email leaves the conversion path. It stays in the footer, on Contactos and in the schema, but it is not a CTA (AUDIT CRO-05).

### CTA map
| Location | Primary | Secondary | WhatsApp? |
|---|---|---|---|
| Header ≥1200 px | Pedir orçamento (outline) → form | 218 935 050 | no |
| Header <1200 px | (sticky bar takes over) | 218 935 050 | no |
| **Sticky bar (≤1023 px)** | **Pedir orçamento** (filled, carmine) → form | Ligar | **yes: the only one on screen**. Hidden while the form is in view and while the menu is open |
| Hero | Pedir orçamento → form | Ligar 218 935 050 | no |
| Service rows (home) | Row → service page | none | no |
| Service page, top | Pedir orçamento (form pre-set to that service) | Ligar | no (sticky bar on mobile) |
| Service page, end | Form embedded, service pre-selected | Ligar | no |
| FAQ "avaria" answer | Ligar | (sticky bar) | no |
| Home final CTA / Contactos | Form | Ligar · WhatsApp (desktop only, since the sticky bar is hidden there) | yes, one |
| Form success state | none | none | yes: "Enviar fotografias por WhatsApp" |

Desktop has no WhatsApp in the header or the hero, by design. The brief's "one per viewport" rule and the calm Header v5 both hold.

### Quote form (Netlify Forms)

**Six fields, in this order:**

| # | Field | Type | Required | Options / notes |
|---|---|---|---|---|
| 1 | O que precisa? | select | yes | Instalar ar condicionado · Multi-split · Bomba de calor · Instalação elétrica · Ventilação · Manutenção ou avaria |
| 2 | Tipo de imóvel | radio (chips) | yes | Casa · Apartamento · Comércio |
| 3 | Urgência | radio (chips) | yes | Tenho uma avaria · Nas próximas semanas · Estou só a planear |
| 4 | Localidade | text + datalist | yes | Datalist: Lisboa, Loures, Odivelas, Amadora, Oeiras, Sintra, Cascais, Almada… (`[[CONCELHOS]]` confirmed list) |
| 5 | Fotografia | file (image/*, 1 file, ≤ 8 MB) | no | "Ajuda-nos a preparar a visita." (Netlify Forms supports file fields) |
| 6 | Como o contactamos | fieldset: Nome + Telemóvel **or** email | name + one contact | Counted as one field. Its two inputs share one label group: `autocomplete=name`, `tel`/`email` |

**Other rules:**
- Hidden honeypot (`netlify-honeypot`).
- One submit button: **"Enviar pedido"**.
- Labels above the inputs.
- Errors next to the field and in a summary at the top; focus moves to the first error.
- The old two-button email/WhatsApp choice is removed.

**Success state, on the page (no time promise, owner decision):**
> **Pedido recebido.** Obrigado, [nome]. Vamos analisar o seu pedido e entrar em contacto consigo pelo contacto que indicou.
> Se quiser, envie já fotografias pelo WhatsApp 910 307 579.

**Pre-selection:** each service page and each service row opens the form with field 1 already set. Urgency "Tenho uma avaria" changes the success text to also show "Se for urgente, ligue 218 935 050 (2ª a 6ª, 8h às 17h)."

**Notification:** each submission emails `[[EMAIL_PEDIDOS]]` (CONTENT-NEEDED 5.1), with the service and urgency in the subject, e.g. "[Bomba de calor · Nas próximas semanas] Loures".

### Measurement (Phase 5; behind consent, per the brief)
- **Events:** `call_tap`, `whatsapp_tap`, `form_start` (first field focus), `form_submit` (success), each with `page` and `service`.
- **Sentry:** stays as configured (Session Replay off, `sendDefaultPii: false`). Tracing sample rate drops from 1.0 to 0.1 (AUDIT SEO-19).
- **PostHog:** loads only after "Aceitar" in a consent banner that has an equal-weight "Recusar" and no pre-ticked boxes.
  - Tradeoff to note: today PostHog runs cookieless with no banner. The brief asks for consent. A banner has a small conversion cost, and the choice is recorded in `localStorage` only.

---

## 5. What Phase 3 will receive from this
- Components to design:
  - header (exists, Header v5)
  - **sticky mobile bar**
  - hero with a real photo
  - proof strip
  - service row (exists) and service-page hero
  - multi-split infographic
  - project card with caption
  - 3-step "how it works"
  - reviews summary
  - 6-field form with states (empty, error, sending, success)
  - FAQ accordion
  - consent banner
  - footer
- Photography treatment for the real photos: crop ratios, grade, caption style "Equipamento marca, local".
- Figma budget: build with write calls (exempt from the 20/month read limit) and verify with local screenshots.

---

## 6. Decisions requested at this checkpoint
1. **Promise:** approve *"Ar condicionado e bombas de calor em Lisboa, instalados e mantidos pela mesma equipa desde 1991."* (or edit).
2. **Obras page:** publish at launch only with ≥ 12 real captioned photos (recommended), or publish now with 8.
3. **Form field 6:** name + telemóvel/email counted as one "Como o contactamos" field (recommended), or drop the name to keep six single inputs.
4. **Consent banner for PostHog:** follow the brief (recommended; it's your call), or keep today's cookieless mode without a banner.
5. **Service-page build order:** Bombas de calor → Manutenção e assistência → Ar condicionado → Instalações elétricas → Ventilação (by opportunity, AUDIT §5).

## 7. Preview and device check at this checkpoint
- Netlify project **`mdm-site-preview`** was created (27/09): https://app.netlify.com/projects/mdm-site-preview. The first upload is **blocked by this environment's network** (`api.netlify.com` and `netlify-mcp.netlify.app` are denied). To unblock it, add both domains to the environment's allowed network domains (cloud environment menu in the session title bar, then Edit, then Network access). Or connect the GitHub repo to the project in the Netlify dashboard with publish directory `site/deploy/creme`.
- The preview will be served `noindex, nofollow` (headers + robots.txt; ready in the preview folder).
- Phase 2 changes no code, so the phone checklist from AUDIT §7 applies unchanged to the first preview.
