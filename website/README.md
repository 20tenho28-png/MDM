# MDM website

Portuguese source pages live in `public/`. `scripts/localize.py` generates matching `/en/` pages using the checked-in `i18n/*.tsv` dictionaries. It reports missing translations. The original work-folder generator is now legacy; edit the canonical public pages here.

`node scripts/build.mjs` generates PT/EN metadata and the public sitemap, builds the Worker into `dist/server/index.js` and copies public assets into `dist/client`. The management HTML is embedded only in the protected Worker and is deliberately excluded from public assets. `node scripts/dev.mjs` serves the source Worker locally using SQLite for the D1 adapter. Local records are kept in ignored `.local/`; they are never included in a deployment. After building, run backend and packaged-route checks with `node --test tests/assistant.test.mjs`.

## Runtime configuration

Configure runtime values through Sites. Never put credentials in public files, source, the hosting manifest or browser storage.

- `OPENAI_API_KEY`: enables the legacy AI endpoint. The assistant UI was removed at the owner's request; do not re-enable it as part of launch. The normal request form works independently.
- `OPENAI_MODEL`: defaults to `gpt-4.1-mini`. Uses the Responses API with structured output and `store:false`.
- `ADMIN_EMAIL`: the existing Site owner's email, checked against the platform-authenticated request header. It restricts `/gestao.html` and its requests API.
- `BOOKING_CONFIG`: absent by default. Do not invent a schedule. Only enable after the owner confirms working days, hours, visit duration, travel buffer and the calendar to use. The implemented calendar uses D1 reservations; it does not claim synchronisation with Google or Microsoft. Supported shape: `{ "enabled": true, "timezone": "Europe/Lisbon", "days": [1,2,3,4,5], "open": 8, "close": 17, "duration": 60, "buffer": 30 }`. This is a schema example, not an approved schedule. Days use Sunday=0. Slots require 24 hours' notice and cover 14 days.

## What completion means

- Request confirmation means the request was durably saved to the MDM management area. Resend notifications are attempted only after storage succeeds. Missing email settings or a provider failure do not lose the request. The management screen shows notification status and offers an authenticated retry.
- Booking confirmation is displayed only after an atomic D1 conflict check succeeds. It includes the address and uses the configured Lisbon timetable and travel buffer.
- AI requests prepare draft details. The visitor reviews and explicitly confirms submission and booking through the UI. Model-generated text cannot create or confirm a booking.
- Missing credentials/calendar configuration never produce simulated AI answers or invented appointments.

Migrations are generated with Drizzle and applied by Sites on publication. Once published, retain migration files and append new ones.

## Resend activation (pending account setup)

The owner selected `mdmassistencia@gmail.com` as the recipient and the existing public Sites address for launch. Configure these production values using the native Sites environment tools, then redeploy the saved version:

- `REQUEST_EMAIL_TO`: already configured as `mdmassistencia@gmail.com`.
- `RESEND_API_KEY`: a Resend sending API key, stored as a secret.
- `REQUEST_EMAIL_FROM`: a sender on an MDM-controlled domain verified in Resend. Do not use the Gmail recipient as the sender or treat Resend's test sender as production-ready.

Never place the API key in chat, source or client code. The account owner must create the Resend account and verify the sender domain. See [Resend domain setup](https://resend.com/docs/dashboard/domains/introduction) and [send email API](https://resend.com/docs/api-reference/emails/send-email).

Notifications use a per-request idempotency key and a database claim to prevent concurrent duplicates. The provider retains idempotency keys for 24 hours; after an uncertain timeout and a retry beyond that window, inspect the provider log first. `accepted` means accepted by Resend, not confirmed inbox delivery. No delivery webhook or unattended retry schedule is configured. Pending notifications can be retried by the manager.

Management: visit `/gestao` and sign in with the existing owner's ChatGPT account. The notification recipient does not gain management access. Requests are paginated and can be contacted through email or telephone links. Scheduling stays manual until a real timetable has been approved.

## AC calculator

`/calculadora` and `/en/calculadora` adapt the calculator supplied by MDM in `calculadora-ar-condicionado-imagens.zip`. The original ZIP is preserved outside this checkout. The local, dependency-free model estimates room cooling load and optionally checks winter heating. The coefficients and generic equipment classes are indicative, not a certified thermal design or manufacturer selection. Postal ranges are approximate regional assumptions, with manual overrides and explicit unknown-range handling; they do not establish regulatory climate zones. Multi-split checks assume simultaneous room demand.

There is no approved price table. The interface and quote summary therefore show **Preço sob orçamento / Price on request**, with no numeric prices. The local draft contains only property and room inputs; restarting clears it. Attaching a result pre-fills the existing quote form and requires the visitor to review contacts and consent before submission. Summaries fit the existing 1,500-character details field.

Run `npm run build` then `npm test`. Calculator tests cover a reference calculation, invalid inputs, load sensitivity, unit-capacity limits, simultaneous demand, postal validation, draft sanitization, bilingual summaries and packaged pages. Browser visual verification was unavailable in the authoring environment; responsive styles require visual confirmation in a real browser.

## GitHub source copy

This folder is a source snapshot of the MDM Sites project, including public images and fonts. The existing ticket wall and training apps remain in their own folders. Live deployment continues through Sites; a GitHub push alone does not deploy this website. Build output, node_modules, runtime data and credentials are excluded. Run `npm ci`, `npm run build`, and `npm test` from this folder, using Node.js with `node:sqlite` support (22.13+ recommended) and Python 3 on PATH. The hosting project ID identifies the existing site and is not a secret.
