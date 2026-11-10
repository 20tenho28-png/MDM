# MDM Assistência Técnica: plan to take mdmassist.pt to a real 5/5

Prepared 10 November 2026. Plan only: nothing in the repository was changed.

How to read the labels used throughout:

- **[V]** verified by reading the repository (`/home/user/MDM`, branch of draft PR 43 and `origin/main`).
- **[A]** assumed. Reasonable, but not checked. Nothing about live Google results, rankings or competitors could be checked from here, so every such statement is [A].
- **[O]** must be confirmed by the owner (or by a lawyer or certifying body where stated).
- Effort: **S** = under half a day, **M** = one to three days, **L** = a week or more. Every effort figure already includes the English copy of the page.
- Cross-references: "Part 3" to "Part 17" mean Deliverable 3 to Deliverable 17. Parts 0 to 2 are the summary, the verification notes and the analysis.
- "Code" as owner means whoever edits the website (developer or Claude Code session). "Owner" means the business owner or the office.

---

## Part 0. Executive summary (one page)

**Where the site is today: 2.8 out of 5 by my scoring, not 3.5.** The visible parts are good (design 3.5, speed 4, the internal lead system `/registo/` 4). The score is pulled down by what the owner cannot see from the home page: nothing is measured (1/5), the legal page and footer have gaps (2.5), the Google profile has only 14 reviews (2.5), and the service pages are 90 to 135 words of specification text with no price, no area and no process (2.5).

**Target: 5/5 by November 2027**, defined by numbers in Part 17: 100+ Google reviews at 4.6 or better, mobile speed score 95+, every lead with a known source, every lead answered by the end of the next working day, and leads per month at least 50% above the baseline the owner still has to give.

**The ten actions, in order (cheap and effective first):**

| # | Action | Who | Can start |
|---|---|---|---|
| 1 | Ask every customer of a finished job for a Google review, using the message in Part 3 | Owner / office | Today |
| 2 | Answer the owner questions at the end of this plan (certificate numbers, areas, prices, lead numbers) | Owner | Today |
| 3 | Verify the site in Google Search Console and complete the Google Business Profile | Owner gives access, code does it | Day 1 |
| 4 | Footer fix on the 65 old-design pages: add the Livro de Reclamações link, replace the embedded Google map with a plain link | Code | Day 1 |
| 5 | One button label everywhere ("Pedir orçamento") plus one breakdown block ("Reportar avaria") | Code | Day 2 |
| 6 | Rewrite the privacy page, send it to a lawyer, then switch on statistics (GA4) and fix the broken "request sent" signal | Code, lawyer, owner | Week 1 |
| 7 | Send each website request straight into `/registo/` and email the customer a confirmation | Code | Week 2 |
| 8 | Build one shared header, footer and form, and launch the new design on all 66 pages at once (not the home page alone) | Code, owner approves design | Week 3 |
| 9 | Rewrite the five service pages and add real pages: Contactos, A MDM, Perguntas frequentes, Avarias, Empresas, Condomínios | Code, owner supplies facts | Week 4 |
| 10 | Turn the 24 project pages into case studies (place, date, equipment, result) and publish "desde" prices if approved | Owner supplies facts, code | Week 8 |

**What the owner personally must do this week (about two hours in total):**

1. Answer the eleven questions in the last section. Thirty minutes. Most of the plan waits on four of them.
2. Send the review request (Part 3) to every customer whose job was closed in the last 60 days, and make it a fixed step from now on.
3. Give the person who edits the site manager access to the Google Business Profile, and the DNS access (or 10 minutes on a call) needed to verify Search Console.
4. Open the Netlify dashboard with the developer and confirm two things: both form notification emails are arriving, and what the monthly form limit of the current plan is.
5. Decide yes or no on the new home design ("Direção B", PR 43). Yes means the whole site moves to it together.
6. Find the certificates (fluorinated gases, IMPIC, APIRAC, insurance, electrician) and photograph them.

**Three things I advise against,** even though they are common advice: publishing the new home page alone while 65 pages keep the old design; adding star ratings to the site's hidden data (Google ignores self-declared ratings for local businesses); and creating one page per parish or municipality with the place name swapped.

---

## Part 1. What I checked, and where the repository disagrees with the brief

### 1.1 Owner inputs: all blank

None of the eight owner inputs was filled in. Assumptions used, each flagged again where it matters:

| Missing input | Assumption used | How the plan changes when known |
|---|---|---|
| Leads per month | Unknown; treated as low (under 40) [A] | Sets the experiment durations (Part 13) and the lead target (Part 17) |
| Most profitable service | Annual maintenance contracts and multi-unit installations treated as priority [A] | Decides which service page is rewritten first and which segment page leads the menu |
| Average job value | Unknown | Decides whether paid ads (Part 16) can ever pay for themselves |
| Service area limits | Tiers in Part 2.2 [A] | Decides which area pages exist and what the form says about locality |
| Certifications and numbers | `website/data/site.json` lists "APIRAC · IMPIC · Gases fluorados" [V] but with no numbers; treated as unconfirmed | Unblocks the trust strip, A MDM page, electricity page wording |
| Prices on site | "No" until told otherwise; `website/data/precos.json` is entirely `null` [V] | Unblocks Part 4 and the price FAQ |
| Budget | 0 EUR per month | Part 16 lists paid options separately |
| Who answers leads and how fast | Office, within working hours; public promise stays "dia útil seguinte" [V] | Sets the internal target in Part 12 |

### 1.2 Facts in the brief that the repository confirms

66 public pages and 66 sitemap entries; static HTML with no generator; the two Netlify forms and the field list; triage codes P1 to P5; reference format; both analytics IDs empty; 65 of 66 pages embed a Google map and load `assets/i18n.js` (78.8 KB); only the redesigned home links the Livro de Reclamações and loads Google Fonts; redesigned home is 120 KB with 26.7 KB of inline CSS and about 62 KB of inline JS; `precos.json` all `null`; home structured data has no `geo`, `sameAs` or rating; `/registo/` has exactly 11 states. All [V].

### 1.3 Where the repository disagrees or adds something

| # | Brief says | Repository shows [V] | Consequence |
|---|---|---|---|
| 1 | Live home has about ten lead buttons with five labels | Ten buttons, **six** labels: the five listed plus plain "Pedir orçamento" (mobile bar) | Same fix, slightly bigger |
| 2 | Redesigned home: nav still all anchors | Correct, and it now has **five** anchors (Soluções, Obras, Manutenção, A MDM, Contactos) versus four on live, where one ("Obras realizadas") is a real page. The redesign is a step back for sitelinks | Fix before launch (Part 5) |
| 3 | Redesign not described as having several labels | Redesigned home uses three labels: "Pedir orçamento", "Reportar avaria", "Solicitar manutenção" | Reduce to two (Part 2) |
| 4 | Project pages have about 185 words | 101 to 156 words of body text, average 133 | Thinner than stated |
| 5 | 3 of 24 project pages mention a place (Moscavide, Lisboa) | **6 of 24** mention Moscavide; none names another place in its body | A Moscavide page is better justified than the brief suggests |
| 6 | Service pages have 120 to 190 words | 91 to 133 words of body text | Thinner than stated |
| 7 | The Netlify form "declares `fotografia`" | True in `website/site/formularios.html`, but `fotografia` is **not** in the checked field list in `website/publica.py` or `website/tests/site-novo.mjs`. The test also asserts the request is URL-encoded and has no extra fields | A photo upload cannot be added without changing test 1 in `site-novo.mjs` and the sending method |
| 8 | `quote_sent` would not fire on the new home | Confirmed, and the cause is exact: the page calls `window.MDM_ANALYTICS.event('quote_sent')`, while `assets/analytics.js` only exposes `window.mdmTrack` | One-line fix (Part 11) |
| 9 | "I found no automatic link from Netlify into `/registo/`" | Confirmed: `website/netlify/functions/` holds only `agenda-ics.mts` and `proposta.mts`. In `/registo/` "Site" is an origin typed by hand. There is a dormant second route, `website/google/pedidos.gs` (Google Apps Script that emails the request, attaches the photo and writes a Google Sheet row), switched off because `pedidosUrl` in `site.json` is empty | Leads are retyped by hand today [O to confirm] |
| 10 | Privacy page gaps | Confirmed. In addition it contains two statements inherited from the previous host that are probably no longer true: "O site usa uma identificação de sessão" and "Uma visita só fica marcada quando o site apresenta uma confirmação de marcação" | Remove in the rewrite |
| 11 | Calculator: 35 W/m³, up to 5 rooms | 5% margin and the 9,000 to 24,000 BTU/h range confirmed; the other two constants not individually checked. Separately, `website/data/site.json` holds a **different** sizing rule (400 BTU/h per m², 7,000 to 24,000, up to 8 rooms) used by the quoting skill | A customer can get one number on the site and another on the quote. Add to owner questions |
| 12 | Structured data | Service pages also embed `HVACBusiness` as provider. `website/README.md` records an earlier decision that review numbers must not go into structured data | I keep that decision (Part 3) |
| 13 | Not mentioned | The map embed searches for "MDM AVAC e Assistência Técnica", a different business name from "MDM Assistência Técnica" used everywhere else | Name consistency issue (Part 7) |
| 14 | Not mentioned | No `404.html`; `assistant.css` is linked twice on 6 pages; `_headers` gives HTML, CSS and JS no cache rule; `sitemap.xml` has no dates | Small fixes (Part 10) |
| 15 | Not mentioned | The rating "4,4★, 14 avaliações" is typed by hand in two places per language | Will go stale as reviews arrive (Part 3) |

### 1.4 Not verifiable from here

The live site, Google results, the absence of sitelinks, the Lighthouse scores (owner-reported), the state of the Google Business Profile, competitors, and whether the Netlify notification emails actually arrive. All treated as [A].

---

## Part 2. Analysis the plan is built on

### 2.1 Segments × services × intent

Three segments, matching the form's "Tipo de espaço" options [V]: **H** = homeowner (Casa / apartamento), **B** = shop or office (Empresa / comércio), **C** = condominium or building manager (Condomínio / edifício). Search phrases are [A]: typical wording, not measured volumes.

| Cell | Searches for [A] | Fears | Proof that convinces | First action | Landing page |
|---|---|---|---|---|---|
| H · AC · breakdown | "ar condicionado não arrefece", "ar condicionado a pingar água", "reparação ar condicionado lisboa" | Paying a call-out for nothing; being told to buy a new unit | Clear statement of what the visit includes and costs [O]; reviews mentioning repairs; brands serviced | Phone 8:00 to 17:00; WhatsApp with photo and error code otherwise | new `avarias.html` |
| H · AC · planned | "instalação ar condicionado lisboa", "ar condicionado preço instalação", "quantos btu para sala" | Wrong size; ugly pipe runs; hidden extras | Calculator, "desde" price [O], project photos of interiors and facades | Form (with calculator result attached) | `servicos/ar-condicionado.html`, `calculadora.html` |
| H · maintenance · planned | "limpeza ar condicionado lisboa", "manutenção ar condicionado preço" | Paying for a wipe with a cloth | Checklist of what is done; price per unit [O] | Form | `servicos/manutencao.html` |
| H · heat pump · planned | "bomba de calor águas quentes preço", "substituir termoacumulador por bomba de calor" | Cost, space for the tank, noise | The two heat-pump projects [V]; sizing by household | Form | `servicos/bombas-de-calor.html` |
| H · heat pump · breakdown | "bomba de calor não aquece água" | No hot water | Same-brand experience | Phone | `avarias.html` |
| B · AC · breakdown | "avaria ar condicionado loja", "assistência ar condicionado empresa" | Shop closed or staff sent home | Invoice with NIF, contract option, commercial projects | Phone | `avarias.html`, then `empresas.html` |
| B · AC / VRF · planned | "ar condicionado para escritório", "ar condicionado loja lisboa", "VRF instalação" | Works disrupting trading hours; landlord rules | Commercial projects: "Substituição em rua comercial", "Escritório com vista para a ponte", pavilion jobs [V] | Form or email with plans | new `empresas.html` |
| B · maintenance · contract | "contrato manutenção avac", "manutenção ar condicionado empresas" | Paying for a contract and still waiting when it breaks | What the contract includes, visit frequency [O], intervention report (the team already produces FM-TEC-04 in `/registo/` [V]) | Form ("Pedir proposta de manutenção" becomes a preselected "Manutenção") | `servicos/manutencao.html`, `empresas.html` |
| B · ventilation · planned | "extração restaurante", "ventilação loja" | Licensing problems, smells, noise complaints | Duct and extraction projects [V] | Form | `servicos/ventilacao.html` |
| B · electricity · planned | "quadro elétrico ar condicionado", "alimentação elétrica avac" | Unsafe or non-compliant work | Electrician certification [O], photo of a finished board | Form | `servicos/eletricidade.html` |
| C · maintenance · contract | "manutenção avac condomínio", "manutenção ventilação garagem condomínio" | Assembly approval, comparable quotes, continuity | Written scope, report per visit, insurance [O], references [O] | Email or form; the manager needs a document, not a call | new `condominios.html` |
| C · ventilation · breakdown | "ventilador garagem avariado", "extração garagem condomínio" | Liability, complaints from residents | "Grupo de aspiração em cave" project [V] | Phone | `avarias.html`, then `condominios.html` |
| C · facade rules · planned | "ar condicionado fachada condomínio regras" | Disputes between owners | A neutral explanation; MDM's facade and roof projects [V] | Form | FAQ entry on `condominios.html` |

Cells MDM should **not** chase:

- **Electricity outside HVAC** (general domestic electrical work). The service is described as "Eletricidade AVAC" [V]; ranking for "eletricista lisboa" brings the wrong calls.
- **Any query naming a brand outside the four** (Midea, Mitsubishi Electric, Daikin, France Air). The build check forbids naming others [V], so there can be no page for them. Breakdowns of other brands can still be received through the generic `avarias.html` page if the owner accepts them [O].
- **"Barato", "low cost", same-day or 24-hour emergency queries.** They contradict the positioning and the single promise in use ("dia útil seguinte") [V].
- **Portable units, sales without installation, online shop queries.**
- **Heat pumps for underfloor heating and radiators as a named product.** The README records that the owner confirmed only hot water and combined systems [V].
- **Homeowner ventilation as a standalone product.** Keep one paragraph on the ventilation page; do not build a page.

### 2.2 Geography

All tiers are [A] until the owner confirms the limits. Travel times are rough estimates from Alameda dos Oceanos outside rush hour.

| Tier | Places | Travel and tolls [A] | Page policy |
|---|---|---|---|
| 1. Doorstep, about 15 minutes, no tolls | Parque das Nações, Olivais, Marvila, Beato; in Loures: Moscavide e Portela, Sacavém e Prior Velho | Two or more visits fit in a morning | Named on every page. Own page only where there is proof: **Parque das Nações** (head office) and **Moscavide** (6 project pages) |
| 2. Lisbon and near north, 15 to 30 minutes, no tolls | Rest of Lisbon (Alvalade, Areeiro, Lumiar, Avenidas Novas, Arroios, Penha de França, Benfica and others), Odivelas, Loures (Santo António dos Cavaleiros, Bobadela, Santa Iria de Azóia), southern Vila Franca de Xira (Póvoa de Santa Iria, Alverca) | Parking in central Lisbon costs more time than the drive | Listed by name on one areas page. One page "Lisboa" at most, built from real Lisbon jobs once the owner dates and places them |
| 3. Outer ring, 30 to 50 minutes, congestion or tolls | Amadora, Oeiras, Cascais (A5 toll), Sintra (IC19 congestion) | Half a day per visit | Listed by name, no own page. Mention a travel charge if one applies [O] |
| 4. South bank | Almada, Seixal (25 de Abril bridge); Montijo and Alcochete (Vasco da Gama bridge, which starts next to the office) | Bridge toll on the return; Montijo and Alcochete are closer in time than Cascais | Ask the owner. If accepted, list them; no page |

How travel should shape pages: a place earns its own page only if (a) it is in tier 1 or 2, so a small job there is still profitable, **and** (b) MDM can show at least two real jobs there with photos. Everything else is a line of text. That rule gives two pages today (Parque das Nações, Moscavide) and a route to more as project pages get their place filled in.

The form's "Localidade" field becomes the data source for this: after three months, the localities in `/registo/` show where requests actually come from.

### 2.3 Seasonality

Demand curve for Portugal [A], general pattern, to be corrected with MDM's own numbers from `/registo/` (the "Funil por mês" table exists [V]).

| Months | Demand | What should already be live | Lead time |
|---|---|---|---|
| Nov to Feb | Heating use of AC, heat-pump and hot-water interest; few installations; quiet weeks | Heat-pump page rewritten (go live November); contract and condominium pages (December, before annual assemblies, usually January to March [A]) | 4 to 8 weeks for Google to index and settle |
| Mar to May | Pre-season maintenance; early installation quotes | Maintenance page with checklist and price [O] live by end of February; Google Business posts weekly from March | Publish 6 weeks before |
| Jun to Aug | Breakdown and installation peak; phones busy | `avarias.html` and troubleshooting articles live by end of April; no new builds in July and August, only reviews and photos | Publish 8 weeks before |
| Sep to Oct | Post-summer repairs, replacements decided after a bad summer, business budgets | Replacement and "empresas" content live by August; case studies from summer jobs | Publish 4 weeks before |

---

### 2.4 Portuguese legal context to check

Nothing here is legal advice. The "what the rule requires" column is my understanding and must be confirmed by the person named.

| Item | What the rule appears to require [A] | What the site does today [V] | Who confirms |
|---|---|---|---|
| RGPD, privacy page | Identify the controller, purposes, legal basis for each purpose, retention periods, recipients and processors, transfers outside the EEA, the rights of the person (access, rectification, erasure, restriction, objection, portability) and the right to complain to CNPD (the Portuguese data protection authority) | `privacidade.html` names the company and Netlify (with possible transfer to the USA) and the Google map. No legal basis, no retention, no rights, no CNPD, no mention of Supabase (where `/registo/` stores customers) or of WhatsApp Business. Contains two outdated statements (Part 1.3, row 10). README says no legal review | Lawyer; owner supplies retention periods (README suggests 3 years for requests without a job, to confirm) |
| Cookies and trackers | Prior consent for non-essential storage or reading on the device (statistics, embedded third-party content). Refusing must be as easy as accepting | `analytics.js` already waits for consent and offers "Recusar" and "Aceitar" [V]. The Google map loads on 65 pages with no consent. Google Fonts on the new home sends the visitor's IP to Google with no consent | Lawyer. Technical fix removes both issues without a legal question: no embedded map, self-hosted font |
| Livro de Reclamações Eletrónico | Businesses with a website must show a visible, easy link to the electronic complaints book | Only the redesigned home (not live) has the link. The 66 live pages have none | Owner confirms MDM is registered on the platform; code adds the link everywhere on day 1 |
| Consumer dispute resolution (RAL) | Businesses selling to consumers must state on the website which alternative dispute resolution body covers them (for Lisbon, typically the Centro de Arbitragem de Conflitos de Consumo de Lisboa) | Not mentioned anywhere | Lawyer or owner. Added to the footer once confirmed |
| Fluorinated gases | Work on equipment with fluorinated refrigerants requires a certified company and certified technicians. The certificate may normally be cited by number and certifying body | Site shows nothing. `site.json` holds "Gases fluorados" without a number | Owner supplies certificate number, body and validity. Certifying body confirms how its mark may be shown |
| IMPIC | Installation work in buildings requires an alvará or certificado de empreiteiro issued by IMPIC, with the relevant categories; the number is public and can be shown | Nothing shown | Owner supplies type and number |
| Electrician, route "P3 · Eletricista certificado" | Electrical installation work must be carried out or signed off by a technician registered with DGEG | The triage code already uses the words "Eletricista certificado" internally; the public page says nothing | Owner confirms who holds the registration and its number. Until then, public copy must not say "certificado" |
| Supplier logos, "instalador autorizado" | Logos are trademarks; use normally needs the brand's or distributor's permission. "Instalador autorizado" or similar wording only with a written agreement | Four logos shown under "Marcas com que trabalhamos" (neutral wording, good) | Owner checks with each distributor. Keep the neutral wording unless a written partner status exists |
| Prices to consumers | Prices shown to consumers must be the total price including IVA, with what is included stated clearly; "desde" prices must be achievable | No prices shown. `precos.json` is already designed as "Euros com IVA incluído" [V] | Lawyer confirms wording; owner supplies numbers |
| Consumer warranty | Legal conformity guarantee for goods sold to consumers (three years since 2022); services have their own rules. A commercial guarantee, if offered, must be stated precisely | No warranty statement | Owner decides whether to state one; lawyer checks wording. Until then the site says nothing beyond "garantia legal" |
| Review display | Showing a rating is fine if true and current | "4,4★, 14 avaliações" typed by hand | Owner updates monthly (Part 11 report) |

---

## Deliverable 1. Scorecard

| Dimension | Today | Evidence | What a 5 looks like for MDM |
|---|---|---|---|
| Conversion | 3.0 | Live: form hidden in a dialog; 10 buttons with 6 labels [V]. No photo, no urgency question, no confirmation to the customer [V] | One label; form visible on home, contactos and service pages; breakdown path in two taps; customer gets a reference by email; completion rate measured and above 45% |
| Trust | 3.0 | 1991, real photos, 4.4 rating shown [V]. No certificates, no named people, no testimonials, 14 reviews | Certificates with numbers on every page footer and on A MDM; 100+ reviews; a named technical lead with photo [O]; three customer quotes with written permission |
| Offer clarity | 2.5 | No price anywhere; price FAQ is a non-answer [V]; maintenance contract contents unstated | "Desde" price for a wall unit, a price per unit for maintenance, a diagnostic fee and what a contract includes, all approved by the owner |
| Information architecture | 2.5 | No contactos, sobre or FAQ page; redesign nav is 5 anchors [V]; no 404 page | Menu of six real pages; every service and segment has a page; Google shows sitelinks [A, cannot be forced] |
| SEO | 3.0 | Titles, canonicals, hreflang, sitemap in place [V]. Service pages about 110 words; project titles describe the photo; no area signal beyond "Grande Lisboa" | Each service page 600+ useful words with FAQ; project pages titled by job and place; an areas page; Search Console showing impressions for service plus place queries |
| Local presence | 2.5 | 14 reviews [V in prompt]; profile state unknown [A]; name variant in map embed [V] | Profile complete, weekly photo or post, 100+ reviews, identical name, address and phone on six directories |
| Content | 2.5 | 24 real projects but no date, place, client type, equipment or result [V] | 24 case studies with those five facts; one new case per month; four troubleshooting articles written with the technicians |
| Design | 3.5 | Direção B is strong and on-brand, but exists on one page of 66; EN home differs [V] | One system on all 66 pages, PT and EN identical in structure |
| Performance | 4.0 | Owner-reported mobile 83 on the new home [A]; 62 KB inline JS, Google Fonts, 79 KB unused script on PT pages [V] | Mobile 95+ on home, a service page and a project page |
| Measurement | 1.0 | IDs empty, nothing measured; "request sent" signal broken on new home [V] | Search Console, GA4 with consent, six events, a one-page monthly report, source recorded for 90% of leads |
| Operations | 4.0 | `/registo/` covers 11 states, follow-ups, agenda, quotes, reports [V]. Leads retyped by hand; no review step | Web request appears in `/registo/` by itself; customer receives a confirmation; review request is a fixed closing step |
| Legal | 2.5 | Gaps listed in Part 2.4 | Privacy page reviewed by a lawyer; complaints book and dispute body in every footer; no third-party request before consent |
| **Average** | **2.8** | | **5.0** |

---

## Deliverable 2. Conversion path and form

### Decisions

1. **One primary action, one label: "Pedir orçamento".** It replaces all six labels on the live site and "Solicitar manutenção" on the redesign. Buttons that used a different label keep their behaviour (preselecting the request type and service through the existing `data-quote` and `data-service` attributes [V]), only the visible text changes.
2. **One secondary action for breakdowns: "Reportar avaria".** Already used on the redesign [V]. It is not a second primary: it is shown smaller, next to the phone number.
3. **Inline form or dialog.** Inline on the home (PT and EN), the new `contactos.html`, the five service pages and the two segment pages, because those are the pages people arrive on with intent. Dialog stays on the 24 project pages, `obras.html`, `calculadora.html` (it carries the estimate) and `privacidade.html`. Until the shared shell exists (action D9.1), the 65 old pages keep the dialog and only get the label change.
4. **No separate thank-you page.** The form already shows "Pedido recebido. Referência …" in place [V]. The conversion is counted from the `quote_sent` event (Part 11), which is more reliable on a static site than a page view and keeps the tests unchanged.

### The breakdown path

During 8:00 to 17:00, Monday to Friday: phone first. Outside those hours: WhatsApp with a photo of the unit, a photo of its label and the error code. The page decides which to show first from the visitor's clock (a few lines of JavaScript; both options always remain visible).

Copy for the block, used on `avarias.html`, on the home and in the form when "Avaria" is chosen:

> **Tem uma avaria?**
> Segunda a sexta, das 8:00 às 17:00, ligue 218 935 050.
> Fora deste horário, envie por WhatsApp (910 307 579) uma fotografia do equipamento, uma fotografia da etiqueta de características e o código de erro, se existir. Respondemos no dia útil seguinte.

Prefilled WhatsApp text (extends `wa.avaria` in `site.json`):

> Olá MDM. Tenho uma avaria. Marca e modelo: ___. Código de erro: ___. Localidade: ___. Envio fotografias a seguir.

### Field changes (Netlify field set, form names, triage codes and reference format unchanged)

Everything new travels inside the existing `mensagem` field as an extra line, exactly as "Espaço:" and "Localidade:" do today [V]. No new Netlify field is needed.

| Step | Today [V] | Change | Where it goes |
|---|---|---|---|
| 1 | Four options; hint with phone number | Keep. When "Avaria" is selected, replace the hint with the breakdown block above | No data change |
| 2 | "Localidade" (required, placeholder "Ex.: Lisboa") | Keep the label and the line "Localidade:" (test 1 checks it). Change placeholder to "Ex.: Moscavide ou 1990-426" and help text to "Localidade ou código postal." | Same line in `mensagem`, same place in `subject` |
| 2 | "Dados técnicos disponíveis (opcional)" | Relabel "Marca, modelo e código de erro (opcional)" when "Avaria" is selected; unchanged otherwise | `mensagem`, under "Detalhes:" |
| 2 | Nothing about urgency | Only when "Avaria": one select "Situação", options "Equipamento parado", "Funciona com falhas", "Fuga de água", "Ruído ou cheiro anormal". One checkbox "Espaço com atividade comercial ou pessoas vulneráveis" | New line "Situação: …" in `mensagem`. Triage code stays "P4 · Avaria …"; the office reads the line |
| 2 | Nothing about number of units | Only when "Manutenção": number input "Número de equipamentos (aproximado)" | New line "Equipamentos: …" in `mensagem` |
| 3 | Name, phone, email (one of the two) | Keep. Add optional select "Melhor altura para contacto": "Manhã", "Tarde", "Indiferente" | New line in `mensagem` |
| 4 | "Enviar pedido à MDM", "Continuar no WhatsApp", "Copiar pedido" | Keep the three. After a successful send, show a fourth link: "Juntar fotografias pelo WhatsApp" using the existing `wa.pedido` text plus the reference | No data change |
| After | Status text only | Add: "Guardámos a referência [ref]. Se indicou email, enviámos-lhe uma cópia do pedido." (only once action D12.1 is live) | |

**Photo upload inside the form: not now.** It needs the request to be sent as multipart instead of URL-encoded, which breaks two assertions in test 1 of `website/tests/site-novo.mjs`, and Netlify's free plan has a small monthly upload allowance [A, to check in the dashboard]. The WhatsApp link after sending gets most of the benefit at no risk. It is experiment 7 in Part 13.

### Actions

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D2.1 | Replace the six labels by "Pedir orçamento" on the 65 old-design pages (130 edits are a scripted find and replace) and "Solicitar manutenção" on `site/index.html` | One action, one name; easier to recognise and to measure | S | Medium | Code | `grep` finds one label; `publica.py` passes |
| D2.2 | Add the breakdown block to the home, the dialog and the future `avarias.html` | Urgent visitors should not fill four steps | S | High | Code | `call_click` and `whatsapp_click` counts from breakdown block |
| D2.3 | Step 2 conditional fields (situation, units, placeholder) in `site/index.html` inline script and in `assets/assistant.js` for the dialog | Office can prioritise without calling back first | M | Medium | Code | Share of breakdown requests with "Situação" filled; test 1 and 3 still pass unchanged |
| D2.4 | Post-send WhatsApp photo link with reference | Gets photos without an upload field | S | Medium | Code | Share of web requests followed by a WhatsApp photo (office count) |
| D2.5 | Inline form on service and segment pages (after D9.1) | Form visible where intent is highest | M | High | Code | Completion rate per page type. Test change: `site-novo.mjs` tests 2 and 4, which open the dialog on a service page, must target the inline form there |
| D2.6 | Bring the EN home to the same 4-step inline form as the PT home (today it has a one-step quick form, `#quick-form` [V]) | Same behaviour in both languages | M | Low | Code | Test 4b in `site-novo.mjs` rewritten for the 4-step form |

---

## Deliverable 3. Trust and reviews

### From 14 to 100+ Google reviews

86 more reviews in 12 months is about 7 a month. Whether that is realistic depends on jobs closed per month [O]. If MDM closes 40 jobs a month, a 20% response rate is enough.

**Rules.** Ask every customer of a finished job, satisfied or not: asking only happy customers is "review gating" (filtering who gets asked) and breaks Google's rules. No discount, gift or raffle in exchange. Never write or edit a review for a customer. Do not ask from the office Wi-Fi on a shared tablet: reviews should come from the customer's own phone.

| Step | When | Who | Channel |
|---|---|---|---|
| 1 | At the end of the job, when the customer signs the intervention report | Technician | Spoken: "Vai receber uma mensagem nossa com uma ligação para avaliar o serviço no Google. Agradecemos a sua opinião." |
| 2 | Next working day | Office | WhatsApp if the customer used it, otherwise email |
| 3 | Seven days later, once, only if no review | Office | Same channel |
| 4 | Within two working days of any review | Owner or office | Reply on Google |

Get the direct review link from the Google Business Profile ("Pedir avaliações"). It replaces `[LIGAÇÃO]` below.

WhatsApp message:

> Bom dia, [NOME]. Fala [NOME DO COLABORADOR], da MDM Assistência Técnica. Concluímos ontem a intervenção em [LOCALIDADE]. Se tiver dois minutos, agradecemos a sua avaliação no Google. Ajuda outros clientes a decidir e ajuda-nos a melhorar: [LIGAÇÃO]
> Se alguma coisa não ficou como esperava, diga-nos por aqui ou pelo 218 935 050.

Email:

> Assunto: A sua opinião sobre a intervenção da MDM
>
> Exmo.(a) Sr.(a) [NOME],
>
> A MDM concluiu a intervenção [TIPO DE TRABALHO] em [LOCALIDADE] no dia [DATA]. Agradecemos que avalie o serviço no Google, com as suas palavras: [LIGAÇÃO]
>
> A avaliação é pública e demora cerca de dois minutos. Se algum ponto do trabalho não correspondeu ao esperado, responda a este email ou ligue 218 935 050 para o resolvermos.
>
> Com os melhores cumprimentos,
> [NOME DO COLABORADOR]
> MDM Assistência Técnica · 218 935 050

Reminder (once):

> Bom dia, [NOME]. Deixo novamente a ligação para avaliar a intervenção da MDM, caso seja útil: [LIGAÇÃO]. Obrigado.

Reply to a positive review:

> Obrigado pela avaliação, [NOME]. Registámos o seu comentário sobre [ASPETO REFERIDO]. Ficamos disponíveis para a manutenção do equipamento.

Reply to a negative review (never argue, never reveal customer data, move the detail to a private channel):

> [NOME], lamentamos que a intervenção não tenha correspondido ao esperado. Queremos analisar o que se passou em [ASPETO REFERIDO]. Pedimos que nos contacte pelo 218 935 050 ou por mdmassist@mdmassist.com, indicando a data da intervenção, para revermos o processo com o técnico responsável.

Reply to a review from someone who was not a customer:

> Não encontramos nos nossos registos uma intervenção com estes dados. Pedimos que nos contacte pelo 218 935 050 para esclarecermos a situação.

### Rating on the site and in structured data

Keep the visible rating with the link to the profile. Do **not** add `aggregateRating` to the `HVACBusiness` data: Google does not show stars for ratings a local business declares about itself, and the README already records this decision [V]. Add instead `sameAs` and `hasMap` pointing to the profile (Part 6).

### Actions

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D3.1 | Start the four-step review routine with the messages above | Reviews are the strongest local ranking and trust signal MDM controls [A] | S | High | Owner / office | New reviews per month; 7 or more |
| D3.2 | Print a small card with a QR code to the review link for the technician to leave | Works for customers without WhatsApp | S | Low | Owner | Cards handed out versus reviews |
| D3.3 | Reply to all 14 existing reviews | Shows the profile is attended | S | Medium | Owner | 100% replied |
| D3.4 | Trust strip in the shared footer and under the hero: "Desde 1991 · Certificado de gases fluorados n.º [__] · IMPIC n.º [__] · Associado APIRAC n.º [__]", each shown only when the number exists | Certificates with numbers are checkable; without numbers they are claims | S once facts arrive | High | Owner supplies; code | Strip live on 66 pages |
| D3.5 | "A MDM" page with the company history since 1991, the legal entity, certificates as images, one named technical lead with photo, the team at work | No page today shows who does the work | M | Medium | Owner supplies names and photos with consent; code | Page indexed; visits to it before `quote_sent` |
| D3.6 | Three customer quotes on the site, copied from Google reviews with the author's written permission, linked to the original | Testimonials must be real and traceable (README rule [V]) | S | Medium | Owner asks; code | Three quotes live |
| D3.7 | Replace the hand-typed "4,4★, 14 avaliações" by a value in one place (`data/site.json`, copied into pages by the shared shell) and update it in the monthly report | Prevents a stale number in four places | S | Low | Code, owner | Number on site equals profile at each monthly check |

---

## Deliverable 4. Pricing and offer

No price is invented here. Blanks are marked `[__]`. All prices would be shown with IVA included, as `precos.json` already requires [V].

| Option | What the visitor sees | What the owner must supply | Risk | Recommendation |
|---|---|---|---|---|
| A. Nothing (today) | "Preço sob orçamento" | Nothing | Price shoppers leave; the office spends time on requests that will never fit | Not a 5/5 |
| B. Fixed diagnostic fee | "Deslocação e diagnóstico na zona [__]: [__] € com IVA. [Descontado / Não descontado] se a reparação for adjudicada." | The fee, the zone it applies to, whether it is deducted | Low: it is a price MDM already charges [O] | **First to publish.** It filters breakdown requests and answers the main fear in the H · breakdown cell |
| C. "Desde" price for a standard job | "Instalação de um split mural de 9 000 BTU/h, desde [__] € com IVA, com [__] metros de tubagem, montagem em [condições]." | One real minimum price and the exact inclusions (`inclui.split` in `precos.json`) | Medium: "desde" must be a price actually sold | Second |
| D. Range from the calculator | After the sizing result: "Preço provável: [mín] a [máx] €" per room, economy and premium ranges | The full `precos.json` table: 5 split sizes × 2 ranges, multi-split for 2 to 4 rooms, 9 extras, 2 hot-water sizes, 3 "inclui" sentences. The code is already written and waits for numbers [V] | Medium: needs upkeep when supplier prices change | Third, after C has run for two months |
| E. Maintenance price per unit | "Manutenção preventiva de unidade mural: [__] € por equipamento, a partir de [__] equipamentos." | Unit price and minimum | Low | Publish with B |
| F. Annual contract tiers | A table of two or three plans: visits per year, what is checked, response priority, whether repairs or parts are included | Plan names and contents. The home already states "Visitas programadas, duas por ano" [V], to confirm | Low if contents are real | Publish on `servicos/manutencao.html` and `condominios.html`, price "sob proposta" if the owner prefers |

Replacement for the price FAQ answer (home and FAQ page), usable as soon as B or C exists:

> **Quanto custa uma instalação?**
> A instalação de um split mural de 9 000 BTU/h começa em [__] € com IVA, incluindo [__]. O valor final depende do equipamento, do número de divisões, do percurso da tubagem e do acesso à unidade exterior. A calculadora indica a potência por divisão e pode juntar o resultado ao pedido. A proposta é escrita e não tem compromisso.

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D4.1 | Owner fills a one-page price sheet: diagnostic fee, maintenance per unit, one "desde" installation price, inclusions | Unblocks options B, C, E | S | High | Owner | Sheet returned |
| D4.2 | Publish B and E on `avarias.html`, `servicos/manutencao.html`, the FAQ and the home FAQ | Answers the most common question | S | High | Code | Fewer "quanto custa" calls [office count]; completion rate of breakdown requests |
| D4.3 | Publish C on `servicos/ar-condicionado.html` and the home | Sets expectations before the visit | S | High | Code | Quote acceptance rate in `/registo/` |
| D4.4 | Fill `precos.json` and switch on the calculator range (D) | The code exists and is unused | M (owner time) | Medium | Owner, code | Share of requests with an estimate attached |
| D4.5 | Contract tier table (F) | Makes "contrato anual" a product | M | Medium | Owner, code | Contract proposals requested per month |
| D4.6 | Align the two sizing rules (site calculator versus `site.json` used by the quote skill) | Same customer, same number | M | Low | Technicians confirm; code | One documented rule |

---

## Deliverable 5. Information architecture

### Target sitemap (PT; each page has an EN twin under `en/`)

| Menu | Page | File | Status |
|---|---|---|---|
| Serviços | Ar condicionado | `servicos/ar-condicionado.html` | Rewrite |
| | Manutenção e assistência | `servicos/manutencao.html` | Rewrite |
| | Bombas de calor | `servicos/bombas-de-calor.html` | Rewrite |
| | Ventilação | `servicos/ventilacao.html` | Rewrite |
| | Eletricidade AVAC | `servicos/eletricidade.html` | Rewrite |
| | Avarias | `avarias.html` | New |
| Para quem | Empresas e comércio | `empresas.html` | New |
| | Condomínios e edifícios | `condominios.html` | New |
| Obras | Obras realizadas + 24 pages | `obras.html`, `obras/*.html` | Enrich |
| A MDM | A MDM | `sobre.html` | New |
| | Zonas de intervenção | `zonas.html` | New |
| | Marcas (4 pages) | `marcas/midea.html` etc. | New, only with content (Part 6) |
| Calculadora | Calculadora | `calculadora.html` | Keep |
| Contactos | Contactos | `contactos.html` | New |
| Footer | Perguntas frequentes | `perguntas-frequentes.html` | New |
| | Preços | section of FAQ first; `precos.html` only when options B, C and F are all live | Later |
| | Privacidade, Livro de Reclamações, resolução de litígios | `privacidade.html`, external links | Rewrite |
| | Página não encontrada | `404.html` | New |

Header menu, six items, all real pages: **Serviços · Obras · Empresas e condomínios · A MDM · Contactos** plus the button **Pedir orçamento**. On the home, the same items may scroll to a section if it exists, but the `href` must be the real page. Sitelinks cannot be requested; Google derives them from a clear menu of real pages with distinct titles [A].

### URLs

**Keep the `.html` endings.** Changing them brings no ranking benefit and puts 66 indexed addresses at risk. New pages follow the same convention. Keep the 24 project file names even when titles change. One exception to decide later: `obras/chiller-e-deposito-na-varanda.html` has a title that now says "Bomba de calor" [V]; rename only after the owner confirms what the unit is, with a permanent redirect.

Redirects, in a new `website/site/_redirects` file (a list Netlify reads to forward old addresses):

```
/contactos        /contactos.html        301
/sobre            /sobre.html            301
/faq              /perguntas-frequentes.html  301
/avaria           /avarias.html          301
```

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D5.1 | Create `contactos.html`: inline form, phone, WhatsApp, email, address, hours, a static map image linking to Google Maps, parking and access notes [O], areas served | Most searched page of any local business; today it is a footer anchor | M | High | Code | Indexed; appears for "MDM contactos" [A] |
| D5.2 | Create `sobre.html` (see D3.5) | Trust and sitelinks | M | Medium | Owner, code | Indexed |
| D5.3 | Create `perguntas-frequentes.html` from the 7 existing questions plus 10 to 15 new ones grouped by service, price, areas, breakdowns, condominiums | Answers that are today split or missing | M | Medium | Code, technicians review | Search Console impressions for question queries |
| D5.4 | Menu of real pages in the shared header; home anchors become page links | Sitelinks, clearer navigation | S (inside D9.1) | Medium | Code | No `href="#…"` in the main menu |
| D5.5 | `404.html` with menu, phone and button; `_redirects` | Lost visitors recover | S | Low | Code | 404 page served |
| D5.6 | Add `<lastmod>` dates to `sitemap.xml` and generate the file in `publica.py` instead of by hand | New pages get discovered; no forgotten entries | S | Low | Code | Sitemap count equals page count in the build check |
| D5.7 | Breadcrumb data on new pages; `ContactPage`, `AboutPage`, `FAQPage` types | Consistent structured data | S | Low | Code | Rich Results Test passes |

---

## Deliverable 6. SEO keyword map and page plan

Queries are typical phrasings [A]. Real volumes come from Search Console after action D11.1; revisit this map after 8 weeks of data.

### Services and segments

| Page | Main queries | Proposed title (under 60 characters) | H1 | Unique content that justifies it |
|---|---|---|---|---|
| `index.html` | "ar condicionado lisboa", "avac lisboa", brand name | Keep: "MDM \| Ar condicionado e AVAC na Grande Lisboa" | Keep [V] | Form, proof, routes to everything |
| `servicos/ar-condicionado.html` | "instalação ar condicionado lisboa", "ar condicionado multi-split", "preço instalação ar condicionado" | "Instalação de ar condicionado em Lisboa \| MDM" | "Instalação de ar condicionado: split, multi-split e VRF." | Process in 4 steps; what the visit checks; price "desde" [O]; duration of a typical job [O]; 6 projects; FAQ of 6; link to calculator |
| `servicos/manutencao.html` | "manutenção ar condicionado lisboa", "limpeza ar condicionado", "contrato manutenção avac" | "Manutenção de ar condicionado e AVAC em Lisboa \| MDM" | "Manutenção preventiva, assistência e contratos anuais." | The checklist of a preventive visit (from the real report form FM-TEC-04 [V]); price per unit [O]; contract tiers [O]; 3 projects; FAQ |
| `avarias.html` | "reparação ar condicionado lisboa", "ar condicionado não arrefece", "assistência ar condicionado" | "Reparação e avarias de ar condicionado em Lisboa \| MDM" | "Avarias de ar condicionado e bombas de calor." | Breakdown block; what to send; diagnostic fee [O]; five common symptoms with a safe first check written with the technicians; "Diagnóstico com a máquina aberta" and "Reparação no telhado" projects [V] |
| `servicos/bombas-de-calor.html` | "bomba de calor águas quentes", "bomba de calor aqs instalação", "substituir termoacumulador" | "Bombas de calor para águas quentes em Lisboa \| MDM" | "Bombas de calor para águas quentes e aquecimento." | Tank size by household; where the unit can go; 2 projects [V]; FAQ |
| `servicos/ventilacao.html` | "ventilação extração loja", "condutas ventilação", "ventilação garagem" | "Ventilação e extração para comércio e edifícios \| MDM" | "Ventilação: extração, insuflação e condutas." | 4 ventilation projects [V]; France Air equipment; who it is for |
| `servicos/eletricidade.html` | "quadro elétrico ar condicionado", "alimentação elétrica avac" | "Eletricidade para AVAC: quadros e alimentações \| MDM" | "Eletricidade para sistemas AVAC." | Scope limited to HVAC, stated plainly; certification [O] |
| `empresas.html` | "ar condicionado escritório", "ar condicionado loja lisboa", "manutenção avac empresas" | "Ar condicionado e AVAC para empresas em Lisboa \| MDM" | "Climatização para lojas, escritórios e armazéns." | Works outside trading hours [O]; invoice and contract terms; 5 commercial projects [V] |
| `condominios.html` | "manutenção avac condomínio", "ventilação garagem condomínio" | "AVAC e ventilação para condomínios em Lisboa \| MDM" | "Manutenção e ventilação para condomínios e edifícios." | What a proposal for an assembly contains; report per visit; insurance [O]; garage ventilation project [V]; facade question in the FAQ |

### Areas

| Page | Verdict | Unique content |
|---|---|---|
| `zonas.html` | **Build** | The tier list confirmed by the owner, written as text; travel charge rule [O]; links to projects by place |
| `zonas/parque-das-nacoes.html` | **Build** | Head office is here; buildings of the same age and type (many with pre-installation [A, to confirm with technicians]); at least two dated local jobs [O] |
| `zonas/moscavide.html` | **Build** | Six project pages already name Moscavide [V]; roof and pavilion work |
| `zonas/lisboa.html` | **Later**, when 3 Lisbon jobs are dated and placed | Older buildings, facade restrictions, access |
| Olivais, Marvila, Beato, Sacavém, Odivelas, Loures, Amadora, Oeiras, Cascais, Sintra, Almada, Seixal, VFX | **Reject as pages** | No project proof today. They are named on `zonas.html` only. A page becomes possible when two real jobs exist there |

### Brands (only the four)

| Page | Verdict | Unique content |
|---|---|---|
| `marcas/midea.html` | **Build** | Eight project pages name Midea [V]; what MDM installs and services; where the model label is; what to send for a breakdown |
| `marcas/mitsubishi-electric.html` | **Build** | Three projects [V]; same structure |
| `marcas/daikin.html` | **Build after** the owner supplies a second Daikin job | One project today [V]: too thin alone |
| `marcas/france-air.html` | **Merge** into the ventilation page | One product line; not a consumer search |

Wording on brand pages stays "Instalamos e assistimos equipamentos [marca]" and never "instalador autorizado" until a written agreement is shown (Part 2.4).

### Error codes and troubleshooting

| Page | Verdict | Condition |
|---|---|---|
| "Ar condicionado não arrefece: o que verificar antes de chamar o técnico" | **Build** as the first article | Written from a 20-minute interview with a technician; five checks safe for a customer (filters, mode, breaker, outdoor unit blocked, remote). Lives under `avarias/` |
| "Ar condicionado a pingar água" | **Build** | Same method |
| "Bomba de calor não aquece a água" | **Build** in autumn | Same method |
| Per-brand error-code tables | **Reject for now** | Copying manufacturer tables is thin and possibly a copyright issue. Build only if the technicians write, for the ten codes they see most on a given brand, what they actually do about each |

### Structured data: exact additions

On `index.html` and `en/index.html`, inside the existing `HVACBusiness` object [V]:

```json
"@id": "https://www.mdmassist.pt/#empresa",
"hasMap": "https://maps.app.goo.gl/1NTJtEvzcYW6Cra18",
"sameAs": ["https://maps.app.goo.gl/1NTJtEvzcYW6Cra18"],
"geo": {"@type": "GeoCoordinates", "latitude": [__], "longitude": [__]},
"areaServed": [
  {"@type": "City", "name": "Lisboa"},
  {"@type": "AdministrativeArea", "name": "Loures"}
],
"knowsAbout": ["Ar condicionado", "Bombas de calor", "Ventilação", "Manutenção AVAC"],
"priceRange": "[__]"
```

Coordinates are copied from the Google profile, not guessed. `areaServed` lists only the municipalities the owner confirms. `sameAs` gains Facebook, Instagram or LinkedIn addresses if they exist [O]. `priceRange` only if prices are published. On service pages, replace the embedded copy of `HVACBusiness` by a reference `"provider": {"@id": "https://www.mdmassist.pt/#empresa"}`. On project pages add an `Article` object with `headline`, `image`, `datePublished` and `about`, once the job date exists. Keep the `FAQPage` data, knowing Google now shows FAQ results for very few sites [A]; it costs nothing and helps other search tools read the answers.

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D6.1 | Rewrite the 5 service pages to the structure above (600 to 900 words each, PT and EN) | 91 to 133 words cannot rank or convince | L | High | Code; owner and technicians supply facts | Impressions and clicks per page in Search Console; `quote_sent` per page |
| D6.2 | Create `avarias.html` | Highest-intent queries have no page | M | High | Code | Calls and WhatsApp clicks from the page |
| D6.3 | Create `empresas.html` and `condominios.html` | Two of three form segments have no page | M | High | Code, owner | Requests with "Empresa" or "Condomínio" per month |
| D6.4 | Create `zonas.html`, then Parque das Nações and Moscavide | Area signal backed by proof | M | Medium | Code, owner confirms areas | Impressions for service plus place queries |
| D6.5 | Brand pages for Midea and Mitsubishi Electric | Brand plus service queries; real projects exist | M | Medium | Code; owner checks logo permission | Impressions for brand queries |
| D6.6 | Three troubleshooting articles with technicians | Summer breakdown traffic | M | Medium | Technician interview, code | Live by end of April 2027 |
| D6.7 | Structured data additions above | Clearer entity for Google | S | Low | Code | Rich Results Test clean |
| D6.8 | Retitle the 24 project pages by job, equipment and place, keeping URLs (see Part 8) | Titles describe a photo, not a job | M | Medium | Owner supplies facts; code | Impressions on project pages |

---

## Deliverable 7. Google Business Profile and citations

Profile state is [A]; check each line on first login.

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D7.1 | Decide the one public name and use it identically everywhere. The site says "MDM Assistência Técnica"; the map embed searches "MDM AVAC e Assistência Técnica" [V]. Use the real trading name with no added keywords | Inconsistent names weaken the listing; keyword names break Google's rules | S | Medium | Owner | Same name on profile, site and directories |
| D7.2 | Categories. Primary: the closest to "Serviço de reparação de ar condicionado" or "Empresa de AVAC" (pick whichever MDM earns more from [O]). Secondary: instalação de ar condicionado, fornecedor de bombas de calor, serviço de ventilação. Exact names are chosen from Google's list | Category is the main local relevance signal [A] | S | High | Owner, code | Categories set |
| D7.3 | Services list with a two-line description each, matching the five service pages plus "Avarias" and "Contratos de manutenção"; link each to its page | Lets the profile match specific searches | S | Medium | Code | Services complete |
| D7.4 | Hours Monday to Friday 8:00 to 17:00; service areas set to the confirmed municipalities; phone 218 935 050; website link with `?utm_source=google&utm_medium=perfil` so visits from the profile are identifiable | Consistency and measurement | S | Medium | Owner | Profile visits visible in GA4 |
| D7.5 | Upload 30 photos now (the best of the 24 project photos, the van, the office entrance, the team at work), then 2 per week from real jobs, taken by the technicians | Active profiles get more calls [A] | S, recurring | Medium | Owner, technicians | Photo count; profile views |
| D7.6 | One post per week from March to September, one per fortnight otherwise, from the calendar in Part 8 | Freshness; reuses content | S, recurring | Low | Office | Posts published |
| D7.7 | Seed the profile's questions section with five real questions and answers from the FAQ | Answers appear on the profile | S | Low | Owner | Five live |
| D7.8 | Business description (below) | | S | Low | Owner | Live |
| D7.9 | Free listings with the identical name, address and phone: Bing Places, Apple Business Connect, Páginas Amarelas (pai.pt), Infoempresas or Racius company record (check data), the APIRAC member directory if MDM is a member [O], Facebook page if one exists. Also the installer locators of the four brands, if MDM qualifies [O] | Consistent citations; Apple Maps matters for iPhone users | M | Medium | Owner or office | Six listings identical |

Profile description (750 characters maximum):

> A MDM Assistência Técnica instala, mantém e repara sistemas de ar condicionado, bombas de calor e ventilação na Grande Lisboa desde 1991. Trabalhamos em habitações, lojas, escritórios e condomínios, com sistemas split, multi-split e VRF, e executamos as instalações elétricas associadas. Avaliação no local e proposta escrita, sem compromisso. Atendimento de segunda a sexta, das 8:00 às 17:00, no Parque das Nações. Telefone 218 935 050.

---

## Deliverable 8. 12-month content calendar

Each month has one main page, one case study rebuilt from an existing project page, and Google Business posts. "Go live" dates allow the lead time in Part 2.3.

Case study template (replaces the current project page body; every bracket is filled by the owner or left out, never invented):

> **Título:** [Trabalho] de [equipamento] em [tipo de espaço], [localidade]
> **Dados:** Local: [__] · Data: [mês e ano] · Cliente: [particular / empresa / condomínio] · Equipamento: [marca e modelo] · Duração: [__] · Especialidade: [__]
> **O pedido:** o que o cliente precisava, em duas frases.
> **A solução:** o que a MDM propôs e porquê.
> **A execução:** os pontos técnicos (o texto e a lista atuais da ficha).
> **O resultado:** [o que ficou a funcionar; medição ou confirmação do cliente, se existir].

| Month | Main page going live | Case study rebuilt | Google Business posts | Why now |
|---|---|---|---|---|
| Nov 2026 | Legal footer, labels, privacy draft; `servicos/bombas-de-calor.html` rewritten | "Bomba de calor para moradia" | Heat pump for hot water; winter hours | Heating season starts |
| Dec 2026 | `condominios.html`, `servicos/manutencao.html` with contract tiers | "Grupo de aspiração em cave" | Contracts for 2027 | Condominium budgets and assemblies ahead [A] |
| Jan 2027 | `empresas.html`, `contactos.html`, `sobre.html`; new design on all pages | "Substituição em rua comercial" | New site; business contracts | Quiet month for building |
| Feb 2027 | `perguntas-frequentes.html`; maintenance checklist and price | "Revisão de conduta em teto falso" | Book pre-season maintenance | Six weeks before spring demand |
| Mar 2027 | `servicos/ar-condicionado.html` rewritten with "desde" price | "Mural em parede lisa" | Maintenance before summer, weekly | Maintenance season |
| Apr 2027 | `avarias.html` and article "não arrefece" | "Diagnóstico com a máquina aberta" | Maintenance; calculator | Eight weeks before breakdown peak |
| May 2027 | Article "a pingar água"; `zonas.html`, Moscavide, Parque das Nações | "Unidade Midea numa cobertura em Moscavide" | Install before the heat | Installation quotes rise |
| Jun 2027 | `marcas/midea.html`, `marcas/mitsubishi-electric.html` | "Tubagem a prumo no terraço" | What to send when it breaks | Peak begins |
| Jul 2027 | No new pages. One new case from a 2027 job | New job | Photos of the week | Team is busy |
| Aug 2027 | No new pages. One new case | New job | August hours [O] | Team is busy |
| Sep 2027 | `servicos/ventilacao.html` and `servicos/eletricidade.html` rewritten | "Condutas espiraladas em fachada" | Replace after a hard summer | Replacement decisions |
| Oct 2027 | Article "bomba de calor não aquece"; yearly review of all prices and FAQs | "Termoacumulador em armário" | Heat pump season | Before heating season |

By October 2027 twelve of the 24 project pages are case studies; the other twelve follow at one per month or faster if the owner supplies the facts in one sitting (30 minutes with the photo list).

---

## Deliverable 9. Design and UX rules

Rules, consistent with the owner's rejections [V]:

1. Colours: ink #19232c for text and dark bands, red #a50b1a for one primary button per screen and for small accents only. White and a light neutral for backgrounds.
2. Type: one family across the whole site. Headings no larger than about 44 px on desktop and 30 px on a phone. No all-caps headlines longer than three words.
3. Headlines state what is done, where, and for whom. No slogans, no exclamation marks, no promises in hours.
4. Supplier logos in their own colours, on a white band, never grey, never larger than the MDM logo.
5. The form sits beside the hero text on a solid background, never over the photo. On a phone it comes directly under the text.
6. Photographs are MDM's own jobs. No stock images.
7. One primary button label ("Pedir orçamento"); the phone number is always text that can be tapped.
8. Every page ends with the same contact band: button, phone, WhatsApp, hours.
9. PT and EN pages have the same structure, section for section.
10. Nothing is copied from a competitor's layout.

### Bringing 66 pages into one system

The site has no generator, so header, footer and form are repeated by hand in 66 files [V]. Every action in this plan that touches all pages costs 66 edits, twice when both designs are live. The cheapest fix is a small include step in `website/publica.py`, which already copies `site/` to `public/` on every publish: shared pieces live once in `website/site/_partes/` (`cabecalho.html`, `rodape.html`, `pedido.html`, each in PT and EN) and each page holds a marker such as `<!-- parte: rodape -->`. The pages stay plain HTML that anyone can read.

**Recommendation: do not publish PR 43 as it is.** Publish the new design when the shared header, footer, form, colours and type are on all 66 pages and the EN home matches the PT home. Inner page bodies can be restyled progressively after that, because the shell makes them look like one site.

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D9.0 | Owner approves Direção B as the direction for the whole site, on the PR 43 preview | Everything below depends on it | S | High | Owner | Written yes or no |
| D9.1 | Include step in `publica.py` plus shared header, footer and form partials; convert the 66 pages | One edit instead of 66; ends the PT/EN drift in shared parts | L | High | Code | `publica.py` checks every page contains the three partials; `site-novo.mjs` passes |
| D9.2 | Move the home's inline CSS (26.7 KB) and JS (about 62 KB) into `assets/base.css`, `assets/pedido.js`, `assets/calculadora-inline.js`, used by all pages | One design system, cacheable files | M | High | Code | No `<style>` block over 2 KB in any page |
| D9.3 | Rebuild `en/index.html` on the new home structure | EN home has a different hero and form [V] | M | Medium | Code | Section-by-section parity check added to `publica.py` |
| D9.4 | Restyle page bodies in order: 5 service pages, `obras.html`, the project template (24 pages share one layout), `calculadora.html`, `privacidade.html` | Finish the system | L | Medium | Code | Visual review at 390 and 320 px; test 5 passes |
| D9.5 | Extend `site-novo.mjs` test 5 (no sideways scroll) to every new page | Keeps the guarantee | S | Low | Code | Test lists all pages |

---

## Deliverable 10. Performance: path to mobile 95+

Lighthouse is Google's page speed test. LCP (largest contentful paint) is the moment the biggest element on screen, usually the hero photo, appears.

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D10.1 | Self-host the font. Either keep Bricolage Grotesque as one variable file, Latin subset, in `assets/fonts/` with `preload`, or use the already self-hosted Archivo for the whole site. Remove both Google Fonts lines from `site/index.html` | Removes a render-blocking request to another server and the consent question | S | High | Code; owner picks the typeface | No request to `fonts.googleapis.com` |
| D10.2 | External, deferred JS (D9.2). Load the calculator script only when its section nears the screen | 62 KB of script parsed before the page is usable | M | High | Code | Total blocking time under 150 ms on mobile |
| D10.3 | Hero: three photos load eagerly with no priority hint [V]. Mark the one visible on a phone `fetchpriority="high"`, make the others lazy on small screens, and export AVIF versions beside WebP with `website/gerar_fotos.py` | LCP | S | High | Code | LCP under 2.0 s on mobile test |
| D10.4 | The four 48 px option thumbnails in the form use 600 px files of 6 to 49 KB each [V]. Generate 96 px versions | About 100 KB saved above the fold | S | Medium | Code | Thumbnails under 3 KB each |
| D10.5 | Replace the Google Maps iframe on 65 pages by a static map image (or no image) and the link "Ver no mapa" that already exists beside it [V] | Removes the heaviest third-party load on every page and the consent issue | S | High | Code | No `<iframe` in `site/` |
| D10.6 | Stop loading `assets/i18n.js` (78.8 KB) on PT pages. It defines `window.MDM`, which other scripts call, so add a five-line PT stub to `assets/site.js` (`window.MDM = window.MDM \|\| {language:'pt', t: s => s}`) and keep the file on `en/` pages only | 79 KB unused on every PT page | S | Medium | Code | PT pages do not request `i18n.js`; test 6 (no JS errors) passes |
| D10.7 | Optimise `assets/img/logo-mdm.svg` (23 KB, loaded on every page) | Likely reducible to a few KB | S | Low | Code | Under 5 KB |
| D10.8 | Remove the duplicate `assistant.css` link on 6 pages; load `calculator.css` only where the calculator is | Less CSS | S | Low | Code | One link per file |
| D10.9 | Cache rules: have `publica.py` add a content hash to CSS and JS addresses (`?v=`), as `build.py` does for the old site [V], then cache them for a year in `_headers` | Repeat visits load instantly | M | Medium | Code | Second visit transfers under 50 KB |
| D10.10 | Run Lighthouse on three page types in CI and fail under 90 (free, `@lhci/cli`) | Stops regressions | M | Medium | Code | CI job green |

Order: D10.5, D10.6, D10.1, D10.3, D10.4 are each under half a day and should take the home from 83 to above 90 [A]. D10.2 and D10.9 take it to 95+.

---

## Deliverable 11. Measurement and consent

### Free stack

| Tool | What it gives | Consent needed |
|---|---|---|
| Google Search Console | Which searches show and bring visits to which page. Verified by a DNS record, adds nothing to the site | No |
| Google Business Profile performance | Calls, direction requests, searches on the profile | No |
| GA4 (Google Analytics) through the existing `assets/analytics.js` | Visits, sources, events | Yes, banner already built [V] |
| Microsoft Clarity | Recordings of sessions | Yes. **Leave off** for the first three months: one more processor to declare, little use at low traffic |
| `/registo/` | The truth about leads, quotes and invoices | Internal |

Because many visitors refuse statistics cookies, GA4 will undercount. The lead count in the monthly report therefore comes from `/registo/`, not from GA4.

### Events

| Event | Status | Change |
|---|---|---|
| `quote_sent` | Broken on the new home [V] | In `site/index.html` replace `window.MDM_ANALYTICS.event('quote_sent')` by `window.mdmTrack && window.mdmTrack('quote_sent', {tipo: purpose, servico: service})`. Old pages keep the `#delivery-result` observer |
| `quote_open` | Works on old pages (`data-quote`) | On inline forms, fire `form_start` on the first interaction instead |
| `form_step` | New | Fire with `{step: 2 \| 3 \| 4}` when a step is shown |
| `quote_whatsapp`, `quote_email` | Wired to old IDs `send-whatsapp`, `send-email` [V] | Also match the new IDs `qWa` and `qCopy` (`quote_copy`) |
| `call_click`, `whatsapp_click`, `email_click` | Work everywhere (they match links) [V] | Add `{page: location.pathname}` |
| `calculator_open` | Only on `calculadora.html` | Add `calculator_result` and `calculator_attach` for the inline calculator |
| `review_click` | New | Click on the Google reviews link |

Conversions (GA4 "key events"): `quote_sent` (primary), `call_click`, `whatsapp_click`, `quote_whatsapp`.

Source of every lead: the form already sends `pagina` [V]. Add, inside `mensagem`, a line "Origem: …" with the `utm_source` or the referring site of the first page of the visit (kept in `sessionStorage`, which is functional storage for the request, to be confirmed in the privacy text). For calls, the office asks one question, "Como chegou até nós?", and records it in a team column in `/registo/` (team columns exist [V], no code needed).

### Privacy page changes required before switching GA4 on

Draft for the lawyer, to replace the "Cookies e estatísticas" section and add the missing ones in `privacidade.html` and `en/privacidade.html`:

> **Fundamento e finalidades**
> Tratamos os dados que nos envia para responder ao seu pedido e preparar uma proposta (diligências pré-contratuais a seu pedido), para executar e faturar o trabalho (execução do contrato e obrigações legais) e, com o seu consentimento, para estatísticas de utilização do site.
>
> **Conservação**
> Pedidos sem trabalho adjudicado: [__] meses. Dados de clientes e faturação: pelo prazo legal aplicável. Estatísticas: [__] meses.
>
> **Quem trata os dados por nossa conta**
> Netlify, Inc. (alojamento do site e receção dos pedidos), Supabase, Inc. (registo de pedidos e clientes, servidores em [__]), Google Ireland Limited (estatísticas, apenas com consentimento) e o nosso serviço de email. Alguns destes prestadores podem tratar dados fora do Espaço Económico Europeu, com as garantias previstas no RGPD.
>
> **Cookies e estatísticas**
> O site só usa cookies de estatística (Google Analytics 4) se os aceitar no aviso apresentado na primeira visita. Pode recusar sem qualquer efeito no funcionamento do site e alterar a escolha em qualquer momento em "Preferências de cookies", no rodapé.
>
> **Os seus direitos**
> Pode pedir o acesso, a retificação, o apagamento, a limitação ou a portabilidade dos seus dados, e opor-se ao tratamento, através de mdmassist@mdmassist.com. Pode apresentar reclamação à Comissão Nacional de Proteção de Dados (www.cnpd.pt).

Also remove the two outdated sentences (Part 1.3, row 10) and the "Mapa do Google" section once the embedded map is gone. Add a footer link "Preferências de cookies" that reopens the banner; `analytics.js` stores the choice in `mdm-consent-v1` [V] and currently offers no way to change it.

### Monthly one-page report (first Monday of the month, 20 minutes)

| Line | Source | This month | Last month | Same month last year |
|---|---|---|---|---|
| Requests received (form, phone, WhatsApp, email) | `/registo/`, by origin | | | |
| Requests by type (P1 to P5) and segment | `/registo/` | | | |
| Share with a known source | `/registo/` team column | | | |
| Answered by end of next working day | `/registo/` clock | | | |
| Quotes sent, accepted, value | `/registo/` Números | | | |
| Google reviews: count, average, new, replied | Profile | | | |
| Profile: calls, direction requests | Profile | | | |
| Search: impressions, clicks, top 10 queries | Search Console | | | |
| Site: visits, form starts, requests sent, completion rate | GA4 | | | |
| Mobile speed score, home | Lighthouse | | | |
| One decision for next month | Owner | | | |

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D11.1 | Verify Search Console by DNS and submit `sitemap.xml` | Free, no consent, data starts accumulating now | S | High | Owner gives DNS access; code | Data visible within a week |
| D11.2 | Fix `quote_sent` and rewire the events above | The main conversion is not recorded | S | High | Code | Test send shows the event in GA4 debug view |
| D11.3 | Rewrite privacy page (draft above), lawyer review | Required before statistics | M | High | Code, lawyer, owner | Lawyer's written approval |
| D11.4 | Create GA4 property, put the ID in `assets/analytics.js`, mark conversions | Starts measurement | S | High | Owner account; code | Banner appears; events arrive after "Aceitar" |
| D11.5 | "Preferências de cookies" footer link | Consent must be reversible | S | Medium | Code | Link reopens banner |
| D11.6 | "Origem" line in `mensagem`; intake question for calls | Known source for 90% of leads | S | High | Code; office | Report line "known source" |
| D11.7 | Report template as a shared spreadsheet | One page the owner reads | S | Medium | Code sets up, office fills | Twelve reports in twelve months |

---

## Deliverable 12. Operations after the lead

The public promise does not change: "Respondemos no dia útil seguinte." The targets below are internal and never published.

| Stage | Internal target [A, owner to confirm] | Who [O] | State in `/registo/` [V] |
|---|---|---|---|
| Web request arrives | Appears in `/registo/` automatically; customer gets a confirmation email with the reference | System | **Novo**, origin "Site", with triage code and reference in the notes |
| First contact | Breakdowns (P4): a call the same working day when received before 15:00. Others: by the end of the next working day | Office | Novo → **Visita por marcar**, or → **Orçamento por fazer** when no visit is needed |
| Visit booked | Customer chooses the day through the existing `/marcar/` link | Office | **Visita marcada** |
| Quote | Sent within [__] working days of the visit | Owner or commercial | **Orçamento por fazer** → **À espera do cliente** |
| Quote follow-up | Day 3 and day 10 after sending, then closed as lost with a reason | Office (follow-up engine, type C) | À espera do cliente → **Em execução** or **Perdido** |
| Parts | Customer told the expected date | Office | **À espera de peça/fornecedor** |
| Work | Intervention report signed | Technician | **Em execução** → **Por faturar** |
| Review request | Next working day after the report (Part 3) | Office | At **Por faturar**; do not wait for payment |
| Invoice and payment | Invoice within 2 working days of the report (already the rule in the app [V]) | Office | **Faturado, à espera do pagamento** → **Resolvido** |
| Maintenance reminder | 11 months after an installation or maintenance: offer the next visit | Office ("A contactar", situation "manutenção" exists [V]) | New request |

Customer confirmation email (sent automatically; no promise in hours):

> Assunto: Recebemos o seu pedido · referência [REF]
>
> Exmo.(a) Sr.(a) [NOME],
>
> A MDM Assistência Técnica recebeu o seu pedido de [TIPO] ([SERVIÇO]) para [LOCALIDADE], com a referência [REF].
>
> Respondemos no dia útil seguinte. O nosso horário é de segunda a sexta, das 8:00 às 17:00.
>
> Para acelerar a avaliação, pode enviar fotografias do equipamento, da etiqueta de características e do local para o WhatsApp 910 307 579, indicando a referência.
>
> Se for urgente, ligue 218 935 050 dentro do horário.
>
> MDM Assistência Técnica
> Alameda dos Oceanos 108 A, 1990-426 Lisboa

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| D12.1 | Netlify function named `submission-created` (Netlify runs it by itself on every form submission) that creates the request in Supabase as "Novo", origin "Site", and sends the confirmation email. The Netlify notification email stays as a backup | Ends retyping and lost requests; customer has proof | M | High | Code; owner chooses the sending email account | Web requests in `/registo/` equal Netlify submissions each month |
| D12.2 | Confirm who answers and write the internal targets on one page | A target nobody owns is not met | S | High | Owner | Report line "answered by next working day" at 90%+ |
| D12.3 | Add the review request as a fixed follow-up at "Por faturar" (the follow-up engine has editable texts [V]; a new follow-up type needs a small change in `registo/supabase/seguimentos.sql` [A]) | Makes D3.1 automatic | M | High | Code | Review requests sent equal jobs closed |
| D12.4 | Lost reasons reviewed monthly (price, timing, no reply, out of area) | Feeds pricing and area decisions | S | Medium | Owner | Reasons filled on 90% of lost requests |
| D12.5 | Out-of-area reply template, so the office answers every request | A polite no protects reviews | S | Low | Office | No request left unanswered |

Out-of-area reply:

> Bom dia, [NOME]. Agradecemos o seu pedido. A MDM não realiza intervenções em [LOCALIDADE], pelo que não podemos apresentar proposta. Lamentamos o incómodo.

---

## Deliverable 13. Ten prioritised experiments

With low traffic, side-by-side tests (half the visitors see each version) will not reach a reliable answer. These are before-and-after comparisons: run one change at a time per page type, compare the same number of weeks before and after, and avoid judging across a season change. Durations assume under 40 requests a month [A]; halve them if the baseline is higher.

| # | Hypothesis | Change | Metric | Minimum duration | Decision rule |
|---|---|---|---|---|---|
| 1 | A visible form converts better than a button opening a dialog | Inline form on the five service pages | `quote_sent` ÷ visits on those pages | 8 weeks or 30 form starts | Keep if rate is at least equal and no fall in calls; extend to segment pages |
| 2 | A published diagnostic fee reduces unqualified breakdown requests without reducing good ones | Fee on `avarias.html` and in the breakdown block | Breakdown requests per month and share converted to a job | 8 weeks | Keep if conversion to job rises, even if requests fall by up to 20% |
| 3 | A "desde" price raises quote acceptance | Price on `servicos/ar-condicionado.html` | Accepted ÷ sent quotes for P1 | 12 weeks | Keep if acceptance rises 5 points or more |
| 4 | Showing phone first during office hours raises calls for breakdowns | Time-aware breakdown block | `call_click` from block ÷ views | 6 weeks | Keep if calls rise and form breakdowns do not fall more than calls rise |
| 5 | Fewer steps raise completion | Merge step 1 and step 2 into one screen on phones | `quote_sent` ÷ `form_start` | 8 weeks or 40 starts | Keep if completion rises 5 points; otherwise revert |
| 6 | Certificates with numbers under the hero raise form starts | Trust strip (D3.4) | `form_start` ÷ home visits | 6 weeks | Keep unless starts fall |
| 7 | A photo field in the form produces better-prepared requests | Optional photo upload on the breakdown path only (needs the test and limit changes in Part 2) | Share of requests needing a second contact before quoting | 8 weeks, and only after experiment 4 | Keep if second contacts fall by a quarter and no submission failures |
| 8 | Asking by WhatsApp gets more reviews than by email | Alternate channel by week | Reviews ÷ requests sent | 8 weeks | Make the better channel the default |
| 9 | Case-study titles with place and equipment bring more search visits than photo titles | Retitle 6 of the 24 project pages first | Search Console impressions and clicks on those 6 versus the other 18 | 10 weeks | If the 6 gain, retitle all |
| 10 | The calculator result with a price range increases requests with an estimate | Fill `precos.json` (D4.4) | Share of installation requests with `estimativa` filled | 8 weeks in spring | Keep if share rises and acceptance does not fall |

---

## Deliverable 14. Risks and safeguards

| Risk | How it would happen | Safeguard | Owner |
|---|---|---|---|
| Lost form submissions | Netlify notification email goes to spam or the address changes; nobody notices | D12.1 writes each request to Supabase as well; the monthly report compares Netlify's submission count with `/registo/`; a test request is sent on the first working day of each month | Code, office |
| Netlify form limit reached in summer | Free plan allows a limited number of submissions per month [A, check dashboard] | Check the plan now; alert at 70% of the limit; the Supabase copy means nothing is lost even if Netlify stops accepting | Owner, code |
| Broken Netlify form after a change | A field renamed or the hidden form removed | `publica.py` already fails the build on a missing field [V]; never rename the two forms; run `site-novo.mjs` before every publish and add it to CI (today CI does not run it [V]) | Code |
| Spam | Honeypot only [V] | Keep honeypot; add a minimum fill time in the function of D12.1 before it writes to Supabase | Code |
| Ranking loss | URL changes, or launching a redesign that removes text | Keep all `.html` URLs; redirects for anything renamed; keep every title and H1 unless this plan lists a new one; compare Search Console four weeks before and after launch | Code |
| Unverified claims | "Certificado", "autorizado", prices or guarantees published without proof | Nothing is published until the owner supplies the number or document; extend the existing `build.py --check` idea to `publica.py`: fail on `[__]`, "instalador autorizado", exclamation marks in PT pages, response promises in hours, and brand names outside the four | Code, owner |
| Review policy breach | Incentives, asking only happy customers, staff writing reviews | Rules in Part 3 written into the office procedure | Owner |
| Privacy complaint | Statistics switched on before the page is updated; map and fonts loading without consent | Order of work: remove map and Google Fonts first (D10.5, D10.1), lawyer review, then GA4 | Code, lawyer |
| Mixed designs live | PR 43 merged alone | D9: launch only with the shared shell on 66 pages | Owner, code |
| PT and EN drift | A change made in one language only | Parity check in `publica.py`: same set of files and same partials in both languages | Code |
| Stale facts | Review count, prices, hours typed in several places | Single source in `data/site.json`; yearly review in October (calendar) | Code, owner |
| Customer data in the repository | Real names in tests or examples | Keep the existing rule: data lives only in Supabase [V] | Code |
| Supplier objects to logo use | No written permission | Owner asks each distributor; logos can be removed in one edit once the shell exists | Owner |

---

## Deliverable 15. Roadmap

### Day 1 quick wins (one working day of code, plus the owner's two hours)

| ID | Action | Reason | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|---|
| Q1 | Start review requests (D3.1) and reply to the 14 reviews (D3.3) | Free and immediate | S | High | Owner | First new reviews within a week |
| Q2 | Search Console verified, sitemap submitted (D11.1) | Data starts now | S | High | Owner, code | Property verified |
| Q3 | Livro de Reclamações link in the footer of the 65 old-design pages, PT and EN ("Livro de Reclamações" / "Complaints book", to `https://www.livroreclamacoes.pt/`) | Legal exposure on the live site | S | High | Code | Link on 66 pages; `publica.py` passes |
| Q4 | Remove the Google Maps iframe from 65 pages, keep "Ver no mapa" (D10.5); remove the "Mapa do Google" section from the privacy page | Speed and consent | S | High | Code | No iframe |
| Q5 | One label "Pedir orçamento" (D2.1) | Consistency | S | Medium | Code | One label |
| Q6 | Stop loading `i18n.js` on PT pages with the stub (D10.6); remove duplicate `assistant.css` (D10.8) | Speed | S | Medium | Code | Test 6 passes |
| Q7 | Fix the `quote_sent` call in PR 43 (D11.2) | So it is right when the design launches | S | High | Code | Event fires in a local test |
| Q8 | Google Business Profile: name, categories, hours, services, description, 30 photos (D7.1 to D7.5, D7.8) | Local presence | S | High | Owner, code | Profile complete |

**What the owner sees at the end of day 1:** the complaints book link in the footer, the same button name on every page, a faster site, a completed Google profile, and the first review requests sent.

### Days 2 to 30

| ID | Action | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|
| D2.2, D2.3, D2.4 | Breakdown block, conditional fields, WhatsApp photo link | M | High | Code | Live on all pages |
| D11.3, D11.4, D11.5, D11.6 | Privacy rewrite, lawyer, GA4 on, cookie preferences, lead source | M | High | Code, lawyer, owner | First monthly report with real numbers |
| D12.1, D12.2 | Requests into `/registo/` automatically; confirmation email; internal targets | M | High | Code, owner | Zero retyping |
| D9.0, D9.1 | Owner approves design; shared shell built | L | High | Owner, code | Preview of all 66 pages with the new header and footer |
| D3.4 | Trust strip, as soon as certificate numbers arrive | S | High | Owner, code | Live |
| D4.1 | Owner's price sheet | S | High | Owner | Returned |
| D6.1 (first) | `servicos/bombas-de-calor.html` rewritten (season) | M | Medium | Code | Live in November |

**What the owner sees at day 30:** the first one-page report; a web request appearing in `/registo/` by itself; a preview link of the whole site in the new design; 20 or more reviews.

### Days 31 to 60

| ID | Action | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|
| D9.2, D9.3, D10.1 to D10.4, D10.9 | New design launched on all 66 pages with external CSS and JS, self-hosted font, EN home rebuilt | L | High | Code | Mobile score 95+ on home |
| D5.1 to D5.5 | `contactos.html`, `sobre.html`, `perguntas-frequentes.html`, real menu, 404, redirects | M | High | Code, owner | Pages indexed |
| D6.2, D6.3 | `avarias.html`, `empresas.html`, `condominios.html` | M | High | Code, owner | Live by end of January |
| D4.2, D4.5 | Diagnostic fee, maintenance price, contract tiers published | S | High | Owner approves; code | Live |
| D6.1 (second) | `servicos/manutencao.html` rewritten | M | High | Code | Live by end of February |
| D2.5, D2.6 | Inline form on service pages; EN home form | M | High | Code | Experiment 1 running |

**What the owner sees at day 60:** one design everywhere in both languages; a menu with Contactos, A MDM and Perguntas frequentes; a breakdown page; prices for diagnosis and maintenance.

### Days 61 to 90

| ID | Action | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|
| D6.1 (third), D4.3 | `servicos/ar-condicionado.html` rewritten with "desde" price | M | High | Code, owner | Live by March |
| D6.8, calendar | First 6 case studies; experiment 9 | M | Medium | Owner facts, code | 6 retitled pages |
| D6.4, D6.7 | `zonas.html`, structured data additions | M | Medium | Code, owner | Live |
| D7.9 | Six directory listings | M | Medium | Office | Identical name, address, phone |
| D12.3 | Review request as an automatic follow-up | M | High | Code | Requests sent equal jobs closed |
| D10.10, D9.5 | Lighthouse and Playwright in CI | M | Medium | Code | CI green |
| D3.5, D3.6 | Team content and three customer quotes | M | Medium | Owner, code | Live |

**What the owner sees at day 90:** 35 to 40 reviews; an installation price on the site; six case studies with place and equipment; three monthly reports to compare.

### Months 4 to 12

| When | Action | Effort | Impact | Owner | Success measure |
|---|---|---|---|---|---|
| Apr to May 2027 | Troubleshooting articles (D6.6); Moscavide and Parque das Nações pages; `precos.json` filled (D4.4) | M | Medium | Technicians, code, owner | Live before June |
| Jun 2027 | Brand pages (D6.5) | M | Medium | Code | Live |
| Jul to Aug 2027 | No builds. Reviews, photos, two new cases | S | Medium | Office, technicians | 70+ reviews |
| Sep to Oct 2027 | Ventilation and electricity pages; remaining case studies; yearly review of prices and FAQ | M | Medium | Code, owner | All five service pages rewritten |
| Nov 2027 | Score the site again against Part 17 | S | | Owner, code | 5/5 or a dated list of what is missing |

**What the owner sees at month 12:** 100+ reviews, 24 case studies, a year of reports, and the scorecard repeated.

---

## Deliverable 16. Budget

Default: 0 EUR per month. Everything above runs on tools MDM already has (Netlify, Supabase, a Google account) or on free ones.

| Item | Cost | Needed? | What it replaces or adds |
|---|---|---|---|
| Search Console, Business Profile, GA4, Clarity, Bing Places, Apple Business Connect | 0 | Yes | |
| Sending the confirmation email | 0 with the existing Google account (the dormant Apps Script route already sends email [V]) or a free tier of an email service [A] | Yes | Manual acknowledgement |
| Lawyer review of the privacy page, cookie text, price and warranty wording | One-off fee, to be quoted [O] | Yes, once | Risk in Part 14 |
| Printed QR cards for reviews | About 20 to 40 EUR one-off [A] | Optional | |
| Netlify paid forms level | Only if the monthly limit is reached; price to check in the dashboard [A] | Probably no | Free form allowance |
| Google Ads for breakdown and installation searches, June to August | Suggested test of 150 to 300 EUR per month for three months [A] | Only after measurement works and only if the average job value [O] justifies it | Faster summer demand; replaces nothing |
| Professional photo session (team, van, office) | One-off, to be quoted | Optional; phone photos by the technicians are enough to start | Stock-free trust content |
| Developer or Claude Code time | Not costed here | Yes | |

---

## Deliverable 17. Definition of 5/5

Measured in November 2027. Targets marked [A] are proposals to adjust once eight weeks of real data exist.

| Dimension | Measure | Target |
|---|---|---|
| Reviews | Count and average on Google | 100 or more, average 4.6 or higher, 100% replied |
| Speed | Mobile Lighthouse on home, one service page, one project page | 95 or higher on all three |
| Conversion | Requests sent ÷ form starts | 45% or higher [A] |
| Leads | Requests per month in `/registo/`, all origins | Owner's baseline + 50% [A; baseline missing] |
| Source | Share of requests with a known source | 90% or higher |
| Response | Requests contacted by the end of the next working day | 95% or higher |
| Quotes | Accepted ÷ sent | Baseline + 5 points [A; baseline from `/registo/`] |
| Search | Search Console clicks on non-brand queries | Three times the first full month measured [A] |
| Content | Service pages with 600+ words, price or price logic, FAQ and projects | 5 of 5 |
| Proof | Project pages with place, date, client type, equipment and result | 24 of 24 |
| Structure | Real pages in the main menu; one design on all pages; PT and EN parity | 100% |
| Legal | Privacy page approved by a lawyer; complaints book and dispute body on every page; no third-party request before consent | All three |
| Trust | Certificates shown with numbers; named technical lead; three permitted customer quotes | All three |
| Operations | Web requests entered by hand | Zero |
| Local | Listings with identical name, address and phone | 6 of 6 |

---

## Final list 1. Top ten actions, in order

| # | Action | Owner | Start day |
|---|---|---|---|
| 1 | Review routine: ask every finished job, reply to every review (D3.1, D3.3) | Owner / office | Day 1 |
| 2 | Answer the questions below and send photos of the certificates | Owner | Day 1 |
| 3 | Search Console verified and Google Business Profile completed (D11.1, D7.1 to D7.5) | Owner gives access; code | Day 1 |
| 4 | Footer on 65 pages: Livro de Reclamações link in, Google map iframe out (Q3, Q4) | Code | Day 1 |
| 5 | One label "Pedir orçamento" and the breakdown block (D2.1, D2.2) | Code | Day 2 |
| 6 | Privacy page rewrite to the lawyer; then GA4 on, with `quote_sent` fixed and lead source recorded (D11.2 to D11.6) | Code, lawyer, owner | Day 3 (GA4 on when the lawyer approves) |
| 7 | Web requests written into `/registo/` automatically, with a confirmation email to the customer (D12.1) | Code | Day 8 |
| 8 | Shared header, footer and form; launch Direção B on all 66 pages together, with the speed fixes (D9.0 to D9.3, D10) | Owner approves; code | Day 15 (launch about day 45) |
| 9 | Real pages and rewritten service pages: contactos, sobre, FAQ, avarias, empresas, condomínios, then the five services in season order (D5, D6.1 to D6.3) | Code; owner supplies facts | Day 30 |
| 10 | Prices (diagnostic fee, maintenance, "desde" installation) and the 24 case studies (D4, D6.8) | Owner supplies; code | Day 30 for the price sheet, day 60 for publication |

## Final list 2. Questions for the owner, ordered by how many actions each unblocks

| # | Question | Unblocks |
|---|---|---|
| 1 | Which certificates does MDM hold, with numbers, issuing body and validity: fluorinated gases (company and how many technicians), IMPIC (alvará or certificado, number), APIRAC membership number, DGEG electrician registration (whose, number), civil liability insurance (insurer, amount)? | D3.4, D3.5, electricity page, condominium page, brand pages, GBP, legal table: about 9 actions |
| 2 | May prices be shown? If yes: the diagnostic and call-out fee (and whether it is deducted from the repair), the maintenance price per unit, one real minimum price for a 9,000 BTU/h wall unit installed and what it includes. Later, the full `precos.json` table | D4.1 to D4.5, price FAQ, experiments 2, 3 and 10, `avarias.html`: about 8 actions |
| 3 | Do you approve the new home design (Direção B, PR 43) as the design for the whole site? Which typeface: the new one or the current one? | D9.0 to D9.5, D10.1, D2.5, D2.6: about 8 actions |
| 4 | Where do you work? Confirm or correct the four tiers in Part 2.2, name any municipality you refuse, say whether Montijo and Alcochete are accepted, and whether a travel charge applies beyond some distance | `zonas.html`, area pages, GBP service areas, `areaServed`, FAQ, out-of-area reply: about 6 actions |
| 5 | How many requests arrive per month today (form, phone, WhatsApp, email), who answers them, and how fast in practice? Are web requests typed into `/registo/` by hand? Are both Netlify notification emails arriving, and what is the plan's monthly form limit? | D12.1, D12.2, Part 13 durations, Part 17 lead target, risk table: about 6 actions |
| 6 | For each of the 24 projects (a 30-minute sitting with the photo list): place, month and year, type of client, equipment brand and model, duration, result. And: is the unit in "chiller-e-deposito-na-varanda" a heat pump or a chiller? | D6.8, calendar, area and brand pages, experiment 9: about 5 actions |
| 7 | Which service earns the most, and what is the average value of an installation, a repair and an annual contract? | Order of page rewrites, GBP primary category, whether ads are worth testing: about 4 actions |
| 8 | Maintenance contracts: what plans exist, how many visits per year (the new home says two), what is checked, are repairs or parts included, is there priority for contract customers? | D4.5, maintenance page, `empresas.html`, `condominios.html`: 4 actions |
| 9 | Who can be named and photographed on the site (technical lead, team)? Do you have written permission from any customer to quote their review? Do you have Facebook, Instagram or LinkedIn pages? | D3.5, D3.6, `sameAs`: 3 actions |
| 10 | Legal housekeeping: is MDM registered on the Livro de Reclamações Eletrónico platform? Which consumer dispute resolution body applies? Do you have written permission to show each of the four supplier logos, or any official installer status? What warranty do you give on installation work? How long do you keep requests that did not become jobs? Who is your lawyer for the privacy page review? | Footer, privacy page, brand pages, warranty wording: 4 actions |
| 11 | Which rule do the technicians consider correct for sizing: the site calculator (per volume) or the quoting rule in `site.json` (400 BTU/h per m²)? Which breakdowns of brands outside the four do you accept? What is the exact public business name on Google? | D4.6, `avarias.html` wording, D7.1: 3 actions |
