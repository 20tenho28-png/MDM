# MDM site v3 (relançamento)

Fonte: `src/` · construção: `python3 build.py`, a partir desta pasta (só biblioteca-padrão) · saída: `dist/` (não versionada; apagada e recriada em cada construção; o Netlify constrói com o `netlify.toml` da raiz do repositório).

Lançamento, testes em telemóveis e pendentes do dono: **`site/LAUNCH.md`**.

| Fonte | Saída | Nota |
|---|---|---|
| `src/mdm-site-v3.0.html` | `dist/index.html` | Home; imagens em `img/` |
| `src/ar-condicionado-lisboa.html` | `dist/ar-condicionado-lisboa/index.html` | 1.ª página de serviço (split, multi-split, conduta) |
| `src/_servico.html` + `services.py` | `dist/<slug>/index.html` | Bombas de calor, manutenção e assistência, instalações elétricas, ventilação (conteúdo em `services.py`) |
| `src/obras.html` | `dist/obras/index.html` | Galeria por tipo de trabalho; o número de fotografias na introdução é calculado pelo build |
| `src/obrigado.html`, `src/404.html` | `dist/obrigado/`, `dist/404.html` | Sucesso sem JS e página de erro |
| `src/privacidade.html` | `dist/privacidade/` | Política de privacidade v3 (noindex; fora do sitemap) |
| `src/_redirects` | `dist/_redirects` | 301 dos sites antigos (Netlify); lista do site antigo a completar após rastreio |
| `src/partials/*` | incluídos com `{{include:…}}` | header e banner de consentimento, gaveta, barra móvel, formulário, rodapé, scripts, logótipo |
| `src/partials/*.svg` | inline nas páginas | Esquemas: bomba de calor (`heatpump*.svg`), multi-split (`multisplit.svg`, `multisplit-thumb.svg`), quadro elétrico (`eletrico.svg`); classe `dg` sobe o texto no telemóvel |
| `src/v3.css` | minificado e inline em todas as páginas (sem CSS que bloqueie a primeira pintura) | tokens do sistema v3 (DESIGN.md §13) |
| `img/` | `dist/img/` | AVIF/WebP/JPEG com o tratamento da direção fotográfica; `manifest.json` gera os `srcset` (não é copiado) |
| `og/og.html` + `og/render.cjs` | `img/og-v3.jpg` (versionado) | Imagem de partilha 1200x630. Gerar de novo: `node site/v3/og/render.cjs --preview <ficheiro.png>` (precisa do Playwright: `$PLAYWRIGHT_PATH` ou uma pasta atual com `node_modules/playwright`) |
| `build.py` | `robots.txt`, `sitemap.xml`, `llms.txt`, `_headers`, `favicon.svg`, `apple-touch-icon.png` | `robots.txt` e `_headers` bloqueiam a indexação durante a pré-visualização |

- A v2.2 (`site/index.html`, `site/deploy/creme/`) não é tocada.
- Formulário: Netlify Forms (nome `orcamento`, `data-netlify`, honeypot `website`, campo escondido `pagina`), 6 campos com fotografia opcional até 8 MB, envio por `fetch`, sucesso no ecrã sem promessa de prazo.
- Consentimento (decisão do dono, 27/09/2026): PostHog (UE) só depois de "Aceitar", com gravação de sessões, mapas de calor, inquéritos e captura de erros e desempenho desligados no código. Sentry (UE; sem replay, `sendDefaultPii: false`, tracing 0.1) carrega por omissão e deixa de carregar se o visitante recusar. Escolha em `localStorage` `mdm-consent`.
- Pré-visualização local: `cd dist && python3 -m http.server` (a 404 usa caminhos absolutos).

## Estado (27/09/2026)
- 7 páginas públicas (home, ar condicionado, 4 serviços, obras) mais `obrigado/`, `404.html` e `privacidade/`. As 7 estão no `sitemap.xml`.
- Verificação final: 0 travessões, 0 ligações internas partidas (801), JSON-LD válido, sem ids repetidos; axe-core 0 violações (10 páginas, a 390 e 1440 px); Lighthouse no telemóvel de 98 a 100 antes das correções finais. Números completos em `site/LAUNCH.md` §2.
- Fotografias reais em todas as páginas, incluindo bombas de calor (hero). O multi-split da home usa um esquema até haver fotografia de um multi-split real.
- Bombas de calor: só águas quentes (AQS) até o dono confirmar o aquecimento (CONTENT-NEEDED 3.6).
- `/obras/` publicada com 23 fotografias reais legendadas (regra do dono: 12 ou mais).
- `privacidade/` é a página nova da v3 (`src/privacidade.html`), com o consentimento do PostHog, o Sentry e o Netlify Forms.
- `_redirects`: só `/index.html` e `/privacidade.html` por agora. Antes do lançamento, rastrear `www.mdmassist.com.pt` e acrescentar um 301 por URL antigo.
- Fotografias fora de uso ainda em `img/` (e por isso publicadas, sem ligação): `ventilacao-ventilbox-*`, `split-sala-porta-*`. Decisão do dono pendente.
- O tratamento das fotografias (regradação de 27/09) foi feito fora do repositório; os ficheiros em `img/` já estão tratados.
- No lançamento: tirar o `Disallow` do `robots.txt` e o `X-Robots-Tag` do `_headers` em `build.py` (LAUNCH.md §5).
