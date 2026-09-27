# MDM site v3.0 (relançamento)

Fonte: `src/` · construção: `python3 build.py` (só biblioteca-padrão) · saída: `dist/` (não versionada; o Netlify constrói).

| Fonte | Saída | Nota |
|---|---|---|
| `src/mdm-site-v3.0.html` | `dist/index.html` | Home; imagens em `img/` |
| `src/ar-condicionado-lisboa.html` | `dist/ar-condicionado-lisboa/index.html` | 1.ª página de serviço |
| `src/_servico.html` + `services.py` | `dist/<slug>/index.html` | Bombas de calor, manutenção e assistência, instalações elétricas, ventilação (conteúdo em `services.py`) |
| `src/obrigado.html`, `src/404.html` | `dist/obrigado/`, `dist/404.html` | Sucesso sem JS e página de erro |
| `src/privacidade.html` | `dist/privacidade/` | Política de privacidade v3 (noindex; fora do sitemap) |
| `src/_redirects` | `dist/_redirects` | 301 dos sites antigos (Netlify); lista do site antigo a completar após rastreio |
| `src/partials/*` | incluídos com `{{include:…}}` | header, gaveta, barra móvel, formulário, rodapé, scripts |
| `src/v3.css` | minificado e inline em todas as páginas (sem CSS que bloqueie a primeira pintura) | tokens do sistema v3 (DESIGN.md §13) |
| `img/` | `dist/img/` | AVIF/WebP/JPEG com o tratamento da direção fotográfica; `manifest.json` gera os `srcset` |

- A v2.2 (`site/index.html`, `site/deploy/creme/`) não é tocada.
- Formulário: Netlify Forms (`data-netlify`, honeypot `website`), 6 campos, envio por `fetch`, sucesso no ecrã sem promessa de prazo.
- PostHog só depois de "Aceitar"; Sentry como antes (sem replay, `sendDefaultPii: false`, tracing 0.1).
- Pré-visualização local: `cd dist && python3 -m http.server` (a 404 usa caminhos absolutos).

## Estado (27/09/2026)
- 6 páginas públicas: home + 5 serviços, 445 a 670 palavras cada, 0 travessões, 0 links partidos, JSON-LD válido.
- Sem fotografia real de bombas de calor: usa-se um esquema, nunca uma foto que não seja da MDM.
- `privacidade/` é a página nova da v3 (`src/privacidade.html`), com o consentimento do PostHog e o Netlify Forms.
- `_redirects`: só `/index.html` e `/privacidade.html` por agora. Antes do lançamento, rastrear `www.mdmassist.com.pt` e acrescentar um 301 por URL antigo.
- `/obras/` só é publicada com 12 ou mais fotos reais legendadas (decisão do dono).
