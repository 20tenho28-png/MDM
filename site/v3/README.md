# MDM site v3.0 (relançamento)

Fonte: `src/` · construção: `python3 build.py` (só biblioteca-padrão) · saída: `dist/` (não versionada; o Netlify constrói).

| Fonte | Saída | Nota |
|---|---|---|
| `src/mdm-site-v3.0.html` | `dist/index.html` | Home: CSS e JS inline (ficheiro autónomo); imagens em `img/` |
| `src/ar-condicionado-lisboa.html` | `dist/ar-condicionado-lisboa/index.html` | 1.ª página de serviço; usa `assets/v3.css` |
| `src/obrigado.html`, `src/404.html` | `dist/obrigado/`, `dist/404.html` | Sucesso sem JS e página de erro |
| `src/partials/*` | incluídos com `{{include:…}}` | header, gaveta, barra móvel, formulário, rodapé, scripts |
| `src/v3.css` | inline na home, `dist/assets/v3.css` nas outras | tokens do sistema v3 (DESIGN.md §13) |
| `img/` | `dist/img/` | AVIF/WebP/JPEG com o tratamento da direção fotográfica; `manifest.json` gera os `srcset` |

- A v2.2 (`site/index.html`, `site/deploy/creme/`) não é tocada.
- Formulário: Netlify Forms (`data-netlify`, honeypot `website`), 6 campos, envio por `fetch`, sucesso no ecrã sem promessa de prazo.
- PostHog só depois de "Aceitar"; Sentry como antes (sem replay, `sendDefaultPii: false`, tracing 0.1).
- Pré-visualização local: `cd dist && python3 -m http.server` (a 404 usa caminhos absolutos).
