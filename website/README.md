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

## Visitor statistics (off by default)

`assets/analytics.js` loads Google Analytics 4 and Microsoft Clarity, but only
after the IDs at the top of the file are filled in. Until then it does nothing.

With IDs set, a consent banner appears and nothing loads until the visitor
accepts. Before switching it on, add a paragraph about statistics cookies to
`privacidade.html` and `en/privacidade.html`.

Events sent: `call_click`, `whatsapp_click`, `email_click`, `quote_open`,
`quote_sent`, `quote_whatsapp`, `quote_email`, `calculator_open`.

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
- Links, canonical URLs, hreflang, `og:url` and `sitemap.xml` all use the
  `.html` form (`/obras.html`), so the site works on any static host. The
  original host served `/obras` and redirected `.html`; this copy no longer
  depends on that.
