# Website MDM

Public website of MDM Assistência Técnica: air conditioning, heat pumps,
ventilation, electrical work and maintenance in Greater Lisbon.

Static HTML/CSS/JS. Portuguese pages at the root, English pages under `en/`.

## Source

Imported on 10 Oct 2026 from the published site
<https://mdm-climatizacao-a-medida.jocund-bud-7221.chatgpt.site/>, exactly as
served (137 files). The first commit on this folder is that untouched copy, so
`git diff` against it shows every change made here.

## Run locally

```bash
cd website
python3 -m http.server 8080
# open http://localhost:8080/
```

Paths are absolute (`/assets/...`), so open the site through a server, not by
double-clicking `index.html`.

## Structure

| Path | What it is |
| --- | --- |
| `index.html`, `en/index.html` | Home page (PT / EN) |
| `obras.html`, `obras/*.html` | Gallery and 24 project pages |
| `servicos/*.html` | 5 service pages |
| `calculadora.html` | Air-conditioning sizing calculator (kW / BTU per room) |
| `privacidade.html` | Privacy page |
| `assets/site.js`, `assets/site.css` | Navigation, quote form, gallery |
| `assets/i18n.js` | PT → EN strings for text created by scripts |
| `assets/calculator*.{js,mjs,css}` | Calculator UI, sizing model and quote text |
| `assets/assistant.*` | AI chat assistant (server-side, currently off) |
| `assets/img/`, `assets/brands/`, `assets/fonts/` | Photos, brand logos, self-hosted fonts |

English pages are separate static files: a text change on a PT page must be
made on the matching `en/` page too.

## What does not work outside the original host

The original host also runs a small server. These parts call it and will not
work from this folder alone until they are connected to a new backend:

- **Quote form "Enviar pedido à MDM"** posts to `/api/requests`. The
  WhatsApp, email and copy buttons in the same form work anywhere.
- **AI assistant** (`/api/chat`) and **visit booking** (`/api/availability`,
  `/api/bookings`) are switched off on the original host as well.
- **Admin area** `/gestao` is not part of this copy.

## Before moving to a new domain

- Replace `https://mdm-climatizacao-a-medida.jocund-bud-7221.chatgpt.site` in
  canonical, Open Graph, hreflang and `sitemap.xml` with the new domain.
- The original host serves pages without `.html` (`/obras`) and redirects the
  `.html` URLs. Pick one form on the new host and keep links, canonical and
  sitemap consistent.
