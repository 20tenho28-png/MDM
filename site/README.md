# MDM Assist — Website

Site institucional da **Manuel Domingues Melancia, Lda (MDM)** — assistência técnica a edifícios
(ar condicionado, eletricidade, ventilação) na grande Lisboa, desde 1991.

## Conteúdo

| Ficheiro | Descrição |
|---|---|
| `index.html` | **O site oficial (variante creme, escolhida pelo chefe em 08/2026)** — auto-contido (HTML + CSS + JS + imagens em base64), editável à mão. É o único ficheiro necessário para publicar. |
| `mdm-logo.svg` | Logótipo vetorial limpo. Reutilizável em cartões, faturas, email. |
| `favicon/` | O logótipo rasterizado em PNG (32px favicon, 180px apple-touch-icon). Já embutidos no `index.html`. |
| `obras/` | As 14 fotografias de obra já otimizadas (JPEG, 480px de altura). Já embutidas no `index.html`. |
| `src/` | Os ficheiros-fonte da variante navy (arquivada) e o script que a gera. Ver **Como editar**. |
| `variante-navy/` | A variante escura, técnica — **não escolhida**, arquivada funcional caso se queira reaproveitar. Gera-se a partir de `src/`. |

## Como editar

O `index.html` (creme) é um ficheiro único **editável à mão** — texto, preços e contactos
alteram-se diretamente nele (as imagens em base64 não se tocam).

A variante navy arquivada gera-se a partir das fontes:

```bash
cd site/src
python3 assemble.py          # gera ../variante-navy/index.html a partir das fontes
```

| Ficheiro em `src/` | O que contém |
|---|---|
| `src_head.html` | `<head>` + toda a folha de estilo |
| `src_body.html` | todo o markup (com marcadores `{{LOGO_SVG}}` e `{{OBRAS}}`) |
| `src_script.html` | todo o JavaScript |
| `assemble.py` | junta as três partes e injeta o logótipo, o favicon e as 14 fotos (só stdlib) |
| `obras.json` | legendas (alt text) e dimensões das 14 fotos |
| `suppliers.html` | a secção Fornecedores isolada, para colar noutro sítio |

> As fotos originais em alta resolução (`assets-fonte/` do pacote antigo + as fotos de obra do
> telemóvel) **não estão neste repositório** por causa do tamanho (~10 MB) — guarde-as à parte.
> O `obras/` já otimizado é suficiente para reconstruir o site.

## As duas variantes

**Decisão tomada (08/2026): o chefe escolheu a creme** — é o `index.html` na raiz.
A navy fica arquivada em `variante-navy/`, completa e funcional.

| | Navy (`variante-navy/index.html`) | Creme (`index.html` — **oficial**) |
|---|---|---|
| Estética | Escura, técnica (navy dos polos) | Clara, editorial (a publicada) |
| Como se edita | Fontes em `src/` + `assemble.py` | Ficheiro único, editável à mão |
| Funcional | Igual nas duas: faixa de orçamento com `LEAD_ENDPOINT`, PostHog, CTA de foto, carrossel de obras (10 no oficial), barra fixa mobile |  |

Nota: o `LEAD_ENDPOINT` define-se diretamente no `<script>` do `index.html` (creme).
A navy arquivada tem o seu em `src/src_script.html` — só interessa se ela voltar.

## Captação de leads e medição

- **Faixa de orçamento** (por baixo do hero) e **formulário** enviam para um endpoint real
  quando `LEAD_ENDPOINT` está definido no `<script>` do `index.html` (ex.: Formspree
  `https://formspree.io/f/xxxxxxxx`, ou função serverless que reenvia para
  mdmassist@mdmassist.com). Payload: POST JSON com `origem` (`faixa-orcamento` /
  `formulario`) e `pagina`.
- **Sem endpoint** (estado atual), os rótulos ajustam-se sozinhos para não prometer o que
  não é captado: a faixa diz "Pedir contacto no WhatsApp" (abre rascunho com o número) e o
  formulário mantém o `mailto:`. Definir o endpoint muda os rótulos para "Quero ser
  contactado" / "Enviar pedido" e ativa a confirmação inline + fallback para email se o
  POST falhar. **Definir o endpoint é o passo nº 1 para maximizar leads.**
- **PostHog** (org MDM, projeto 226321, região UE) está instalado com
  `persistence: 'memory'` — sem cookies nem storage, logo sem necessidade de banner de
  consentimento; perde-se a distinção novo/recorrente de propósito. Eventos:
  `lead_strip_submit`, `quote_form_submit` (com `via`: endpoint/mailto/whatsapp),
  `intent_click` (avaria/contrato), `whatsapp_click`, `phone_click`.
- **Divisão de intenção** acima do formulário: "Tenho uma avaria" (WhatsApp com foto) vs
  "Quero um contrato de manutenção" (pré-seleciona o serviço no formulário).
- **Barra fixa mobile** (≤620px): "Ligar agora" + "Enviar foto" substitui o FAB.
- CTA principal do hero: **"Enviar foto da avaria"** — a foto é o CTA que mais converte
  neste setor.
- **Segunda camada (ambas as variantes):** formulário reduzido ao essencial (NIF, localidade
  e assunto pedem-se depois do 1º contacto), rótulo "Nome" em vez de "Empresa", faixa
  sensível ao horário (fora de 2ª–6ª 8h–18h promete o próximo dia útil), "orçamento gratuito
  e sem compromisso" junto ao botão, ponte de CTA a seguir ao carrossel de obras, e a pill da
  nav navy passou de salto para o WhatsApp a âncora de captação (#orcamento).
- **Robustez da captação:** `sendLead` tem timeout de 8s (endpoint pendurado → fallback
  honesto, nunca spinner eterno); botões protegidos contra duplo envio; eventos disparados
  antes do PostHog carregar ficam em fila e são despachados no load; payloads levam
  `referrer`, `utm` e `ts` para atribuição futura. Eventos novos: `form_focus` e
  `strip_focus` (start-rate vs submit-rate). **Nota:** com adblock (~25–30% no desktop) o
  PostHog não carrega — a contagem de leads verdadeira é a do endpoint, o analytics é
  direcional.

## Desempenho em telemóvel (imagens)

- **WebP em todo o lado onde ganha**: as 14 fotos existem em `.jpg` e `.webp`
  (`obras/`); o `assemble.py` embute o mais pequeno dos dois por foto, e a variante
  creme foi re-encodada in place (incluindo a foto de fundo do hero). Resultado:
  navy 714→641 KB, creme 817→658 KB, qualidade visual igual (q78).
- **`loading="lazy"` em todas as imagens** fora da primeira vista: num telemóvel,
  só ~10 das 18 imagens são sequer descarregadas/descodificadas ao abrir a página.
- **Build de publicação com imagens externas** — `python3 externalize.py
  <index.html> <pasta>` gera `deploy/navy/` e `deploy/creme/`: HTML de 149/95 KB
  (com gzip do host fica ~40 KB) + imagens em ficheiros próprios, em paralelo e
  com cache. **É esta a build a publicar quando o alojamento aceita uma pasta**
  (Netlify/Vercel/FTP); o ficheiro único continua a ser o oficial para "arrastar
  um ficheiro só". Regenerar sempre as duas depois de editar as fontes.
- **SEO (09/2026):** `og.jpg` (cartão 1200×630 para partilhas WhatsApp/redes; gerado à mão,
  guardado em `site/og.jpg`) ligado por `og:image`/`twitter:image`; o `externalize.py` copia-o
  para a build e gera `robots.txt` + `sitemap.xml` a partir do canonical. **Quando houver domínio
  próprio** (a decisão SEO pendente mais importante): mudar o `canonical`, `og:url`, `og:image`
  e `twitter:image` no `index.html` e regenerar a build — robots/sitemap seguem sozinhos.
  Depois: registar no Search Console e tratar da ficha Google Business (map pack é o canal nº 1).
- Nota honesta: "1 ms" não existe em rede real — o que se otimizou foi o primeiro
  render (HTML pequeno primeiro) e o custo total, sem tocar na qualidade.

## Ícones e animações

- **Ícones:** conjunto único **Lucide** (licença ISC) inline nas duas variantes — ventoinha
  (AC, estática de propósito), raio, grelha de ventilação, prancheta-visto, câmara no CTA
  de foto do hero, telefone/pin/WhatsApp nos cartões de contacto. Traço 1.8, pontas redondas.
  O botão de foto do cabeçalho (só em ecrãs pequenos) usa o **glifo WhatsApp sobre verde**
  (`--wa`), não a câmara — pedido do dono; o link continua a pré-preencher a mensagem da foto.
- **Animações (painel curado por júri adversarial — 4 por variante, 12 ideias rejeitadas):**
  navy: LED do formulário que fica sólido quando nome+contacto estão preenchidos (`:has`),
  LED de disponibilidade junto ao telefone da nav (usa `lisbonOpen()`), flash único na linha
  Serviço quando o cartão de contrato a pré-preenche, e as linhas do processo desenham-se
  com o reveal. Creme: abanão de validação (4px, 1 ciclo) + assentar do sucesso, linha de
  progresso de leitura sob a nav (scroll-driven, só CSS), sublinhado carmim que se desenha
  sob o `<em>` dos títulos. (O esquema multi-split animado do cartão de AC foi
  **removido a pedido do dono em 09/2026** — SVG, animação e kills PRM saíram juntos.)
- **Reduced-motion:** todas as animações têm kill explícito. Atenção no creme: o bloco
  global usa `*` e **não cobre pseudo-elementos**, e os kills têm de igualar a
  especificidade das regras com `.in` — já corrigido duas vezes; não simplificar.

## Heatmaps e geometria da dobra

- **PostHog heatmaps ativados no cliente** (`enable_heatmaps: true` + `capture_dead_clicks`)
  nas duas variantes — cliques, scrollmap, rageclicks e dead clicks acumulam a partir do
  primeiro dia online. Falta ativar o produto Heatmaps nas definições do projeto PostHog
  (eu.posthog.com, projeto 226321) — hoje está desligado e **não existe ainda um único
  evento recolhido** (site não publicado), portanto qualquer "heatmap" atual seria inventado.
- **Auditoria de geometria (dados medidos, Playwright, 6 viewports):** com o hero a 100svh,
  a faixa de orçamento ficava a 1,0–1,17vh — invisível sem scroll em TODOS os ecrãs — e em
  1366×768 (o portátil de escritório mais comum) e 360×800 a linha de números (1991 · 35
  anos) era cortada. Correções: hero a `calc(100svh - 56px)` (a faixa carmim espreita acima
  da dobra: 0,93–0,95vh em desktop) e compressão do hero em `max-height: 820px`. No mobile
  a faixa continua a ~1vh de propósito — a barra fixa inferior já dá cobertura de CTA
  permanente e comprimir mais o hero custava legibilidade.

## Stack e decisões técnicas

- **Vanilla HTML/CSS/JS, um único ficheiro de saída.** Decisão deliberada — foi testada uma versão
  React e abandonada. Não converter para framework sem necessidade real.
- **Design — fundo azul-marinho.** A base é o navy `#0D1420`; os painéis são `#141D2E`, que é
  literalmente a cor dos polos dos técnicos (amostrada das fotos de obra). O creme `#F4F1EA` passou
  a ser a superfície de contraste (banda "Porquê a MDM" e a folha do formulário).
- **Tipografia:** Space Grotesk (títulos) + Inter (texto) + IBM Plex Mono (etiquetas e números).
- **Logótipo:** SVG inline na nav e no rodapé. Atenção: os path data usam espaços como separadores —
  não "minificar" removendo quebras de linha sem os substituir por espaço.
- **Animação de fundo:** Three.js (via cdnjs, import dinâmico em try/catch — se o CDN falhar, o site
  funciona na mesma). Sobre o navy usa *additive blending*.
- **Ordem da página (decidida pelo dono):** hero → faixa de orçamento → **obras** →
  **números** (1991 / 35 anos / 24–48h / 8–18h) → serviços → processo → … A prova
  visual vem antes da prova numérica; igual nas duas variantes.
- **Carrossel "Algumas das nossas obras":** 10 fotos reais — eram 14; as obras 4–7 (multímetro, tubagem de cobre, sala de bombas, intervenção na exterior) foram retiradas a pedido do dono em 09/2026, mas continuam em `obras/` se voltarem a ser precisas, auto-scroll, pausa em hover, arrastável,
  com setas. Os cartões são duplicados por JS para o ciclo fechar sem costura.
- **Fornecedores:** marquee contínuo para a esquerda, meia página. Velocidade constante (70 px/s)
  calculada por JS a partir da largura real.
- **Formulário de contacto:** POST para `LEAD_ENDPOINT` quando definido; caso contrário `mailto:`
  e `wa.me` pré-preenchidos (ver **Captação de leads e medição**).

### Contraste (verificado)

O vermelho do site é agora o **carmim do logótipo `#A30711`** (unificação feita em 09/2026, a partir
da variante paralela de tokens; com texto branco dá 8,1:1 — AAA). Sobre o
navy tem apenas 2,8:1, por isso não pode ser usado em texto nem em traços:

| Token | Uso | Rácio |
|---|---|---|
| `--red` `#A30711` | preenchimentos, botões, acentos | 8,1:1 com branco |
| `--red-mark` `#D6392C` | traços e losangos sobre navy | 3,9:1 |
| `--red-ink` `#F0857A` | texto vermelho sobre navy | 7,3:1 |
| `--wa` `#12823F` | botão WhatsApp | 4,9:1 com branco |
| `--on-dark-2` `#A6AEC0` | texto secundário | 8,3:1 |

## Por verificar / decisões em aberto

- ~~Vermelho do logótipo vs. do site~~ **Resolvido (09/2026):** o site inteiro usa o carmim do
  logótipo `#A30711` (tinta escura passou ao navy `#141D2E`, cinzento ao `#4E5871`, escala de
  raios `--r-s`/`--r-m`). Origem: variante paralela de tokens enviada pelo dono, fundida na oficial.
- **Logótipos dos fornecedores.** A secção Fornecedores está em texto porque não existem ficheiros
  dos logótipos das marcas. Para usar PNGs, trocar o texto de cada `<li>` **nas duas listas** por
  `<img src="..." alt="...">` — o CSS `.marquee-row li img` já normaliza a altura e passa a branco.
  Confirmar antes se há autorização das marcas para usar as suas imagens de marca.
- **Panasonic** aparece numa das fotos de obra mas não está na lista de marcas aprovada
  (Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi). Acrescentar se fizer sentido.
- **Sentry** — instalado, por verificar com o site online: abrir a consola do browser, executar
  `myUndefinedFunction();` e confirmar o evento no painel. Org `mdm-5s.sentry.io`, região DE (UE),
  `sendDefaultPii: false` (RGPD), Session Replay desligado de propósito (exigiria política de
  privacidade no site).

## Dados reais (não alterar sem confirmação)

- Telefone: 218 935 050 · WhatsApp: 910 307 579 · Email: mdmassist@mdmassist.com
- Morada: Alameda dos Oceanos, 108A, 1990-426 Lisboa · Horário: 2ª–6ª, 8h–18h · NIF: 502 644 761
- Fundação: 1991 (35 anos). Marcas: Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi.
- **Não introduzir dados financeiros privados** (faturação, clientes, etc.) — já foram removidos
  de versões antigas de propósito.

## Próximos passos

1. **Definir `LEAD_ENDPOINT`** em `src/src_script.html` (Formspree ou serverless) e correr
   `python3 assemble.py` — é o que transforma a faixa e o formulário em captação real.
2. **Publicar** — Netlify/Vercel/etc. Arrastar o `index.html` chega (site estático, sem build).
   Idealmente domínio próprio (ex.: mdmassist.pt) com HTTPS.
3. **Verificar o Sentry** (ver acima) e confirmar eventos no PostHog após publicar.
4. **Google Business Profile** — criar/reivindicar, NAP consistente com o site, fotos das
   obras; para pesquisas locais o map pack é o canal nº 1 e é gratuito.

## Notas para agentes de código

- Editar em `src/` e correr `python3 assemble.py`. Não editar o `index.html` diretamente.
- A classe `.in` é dos campos do formulário. **Não usar `.in` como classe de estado** — já houve
  uma colisão com o scroll-reveal (que agora usa `.is-in`) que pintava os títulos de escuro sobre
  escuro e tirava o fundo aos painéis.
- Testado em 1440/1180/900/768/620/390/360 px, sem overflow horizontal nem erros de consola
  (excluindo CDNs bloqueados em sandbox, que funcionam na web real).
