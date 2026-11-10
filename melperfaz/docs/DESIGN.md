# Melperfaz · design system (resumo para código)

Ler isto primeiro. Fonte: o site construído em `melperfaz/` (tokens no `:root` de `assets/css/site.css`), outubro de
2026. É a versão atualizada do `DESIGN.md` do pacote «melperfaz-design-system», que descrevia o site publicado em
melperfaz.netlify.app a 25/05/2026. O que mudou está marcado *Mudado* e explicado em `docs/PLANO-REDESIGN.md` (secção
«Onde o site construído difere do plano»).

**Marca:** Melperfaz, Construção Civil, Lda. Reabilitação de edifícios, espaços comerciais e apartamentos, desde 2001.
Verde-floresta e vermelho, cantos vivos, títulos com serifa, fotos reais das obras. Contacto: 961 245 288 (também
WhatsApp). *Mudado a pedido do dono:* era azul-marinho e laranja de obra; os papéis das cores guardam o nome (`ink`,
`clay`, `amber`), só os valores mudaram.

## Ficheiros

No pacote do sistema de desenho (que ficou com os valores de maio de 2026, azul-marinho e laranja):

- `tokens.css`: variáveis CSS (`--ink`, `--space-16`, `--font-serif`, ...) e uma classe por estilo de texto (`.eyebrow`, `.lead`, ...). Gerado de `tokens.json`.
- `components/bundle.css`: o CSS do site, com as classes originais (`.btn`, `.hero`, `.svc`, ...) ligadas aos tokens.
- `components/<Nome>/preview.html`: HTML de referência de cada componente (abre no browser). `README.md` ao lado com as regras.
- `assets/`: logótipos, favicons, imagem de partilha e fotos de obra, com um README por pasta.

No site construído (a fonte deste ficheiro):

- `assets/css/site.css`: os tokens (`:root`), as superfícies e todos os componentes; `pag-obras.css`, `pag-orcamento.css` e `pag-paginas.css` só para essas páginas.
- `src/partials/`: o HTML de cada componente (`header`, `barra-acoes`, `footer`, `page-head`, `cta`, `prova`, `garantias`, `obra-foto`, `antes-depois`, `orcamento-form`) e `icones.svg`.
- `assets/img/`: `logo-melperfaz.png` (verde), `logo-melperfaz-branco.png`, `favicon-32.png`, `favicon-180.png`, `og-melperfaz.jpg` e `fotos/`.
- `assets/fonts/`: Fraunces (normal e itálico) e Archivo, variáveis, só latim.

## Como usar

```html
<html lang="pt-PT">
<head>
  <meta name="color-scheme" content="only light">
  <meta name="theme-color" content="#12392b">
  <link rel="preload" href="assets/fonts/fraunces-latin-400-700-normal.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/archivo-latin-variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="assets/css/site.css">
</head>
<body class="grain">
```

*Mudado:* as letras vêm com o site (`@font-face` no `site.css`, `font-display: swap`), sem pedidos ao Google Fonts.

- Copiar o HTML dos parciais (`src/partials/`); não criar classes novas quando já existe uma.
- Valores sempre por `var(--token)`, nunca hex ou px soltos que já tenham token. O `python3 build.py --check` falha com um espaço em px solto, um `font-size` fora dos 10 estilos, uma `@media` que não seja a 980 ou a 640 px, uma duração ou curva fora dos tokens de movimento e texto escuro sobre o vermelho.
- Conteúdo dentro de `<div class="wrap">` (1240px, margens de 32px; 16px até 640px). Texto, cartões, legendas e botões começam na borda da `.wrap`.
- Cada secção tem uma superfície (`.s-paper`, `.s-bone`, `.s-ink`); a `.s-clay` só existe no painel da CtaBand. Os componentes só leem as variáveis da superfície (ver «Superfícies»).

## Cores (um só tema, claro)

*Mudado a pedido do dono:* verde e vermelho. `ink` é o verde-floresta e `clay` o vermelho; os neutros puxam ao verde e
os `rgba()` saem dos verdes novos.

| token | valor | uso |
|---|---|---|
| `ink` | #12392b | o verde: texto principal no claro, logótipo, superfícies escuras (obras da página inicial, grupos de obras, rodapé, painel do menu, barra de ações), botão com o rato no claro, `theme-color` |
| `bone` | #edf2ec | secções alternadas (Porquê Nós, grupos de obras, outras obras, lateral do pedido, Ficha); texto sobre ink |
| `paper` | #f7f9f5 | fundo da página e do cabeçalho; botão no painel clay; texto do botão com o rato no claro |
| `clay` | #c8102e | o vermelho: botão principal, painel da CtaBand, célula «Orçamento» da barra, traço do eyebrow no claro, caixa de visto, traço do menu ao passar o rato, borda do cartão «25 anos», etiquetas «Antes e depois» e «Acabamento», seleção de texto |
| `clay-deep` | #9b0d24 | o vermelho do texto sobre o claro: itálico do h1, visto da TrustList, ícone de `obrigado.html`, traço da página atual no menu; texto do botão do painel com o rato |
| `sage` | #3b5a4a | na paleta, sem uso |
| `line` | #d3ddd4 | filetes no claro (`--rule`), borda do cabeçalho, do cartão do formulário e da Ficha |
| `muted` | #56645b | texto secundário no claro (`--fg-2`, `--fg-cat`), borda dos campos, `dt` da Ficha |
| `shadow` | rgba(18,57,43,.14) | a cor das sombras (as sombras escrevem o mesmo valor) |
| `white` | #ffffff | texto e foco sobre o clay, campos e cartão do formulário, pega do comparador, botão do painel com o rato |
| `amber` | #ff8a7a | vermelho claro, só sobre o verde: traço do eyebrow, `.cat` e «Ver obra» dos cartões, títulos do rodapé, página atual no menu móvel, foco, botão com o rato no ink |
| `ink-deep` | #0a2a1f | fundo do comparador; a base dos `overlay` |
| `ink-raised` | #194634 | fim do degradê da moldura; fundo dos cartões de obra e das miniaturas a carregar; legenda dos cartões no telemóvel |
| `bone-70` | bone a 70% | sobre ink: texto secundário (`--fg-2`), ligações do rodapé |
| `bone-60`, `bone-50` | bone a 60 e 50% | na paleta, sem uso (bone-50 sobre ink dá 4,0:1: não serve para texto) |
| `bone-15`, `bone-07`, `bone-05` | bone a 15, 7 e 5% | sobre ink: filetes (`--rule`) e a borda da barra; o anel decorativo do painel clay; a grelha de planta da moldura |
| `overlay` | rgba(10,42,31,.9) | a faixa da legenda dos cartões de obra (*Mudado:* de 85 para 90%, ver os contrastes) |
| `overlay-soft` | rgba(10,42,31,.1) | o meio do degradê dos cartões |
| `overlay-menu` | rgba(10,42,31,.5) | o fundo escurecido com o menu aberto |
| `overlay-hover` | degradê de ink-deep a 47, 35 e 15% | o escurecer do cartão de obra com o rato |
| `whatsapp` | #25d366 | na paleta, sem uso (a bolha saiu; o ícone usa `currentColor`) |
| `erro` | #a3161a | o erro do formulário: só texto, contorno e o círculo do «!»; nunca um fundo cheio como os botões |
| `focus`, `focus-on-ink`, `focus-on-clay` | = ink, = amber, = white | o anel de foco de cada superfície |

Retirado: `header-glass` (o cabeçalho é paper opaco: o vidro ficava cinzento e deixava ver os títulos por trás).

### Superfícies

Cada `.s-*` define estas variáveis; os componentes só as leem.

| superfície | texto `--fg` | secundário `--fg-2` | categoria `--fg-cat` | filete `--rule` | traço do eyebrow | foco `--focus-c` | botão `.btn` | `.btn` com o rato |
|---|---|---|---|---|---|---|---|---|
| `s-paper`, `s-bone` | ink | muted | muted | line | clay | ink | clay, texto white | ink, texto paper |
| `s-ink` | bone | bone-70 | amber | bone-15 | amber | amber | clay, texto white | amber, texto ink |
| `s-clay` (só o painel da CtaBand) | white | white | white | white | white | white | paper, texto ink | white, texto clay-deep |

O `.btn-ghost` é transparente, com o texto e o contorno de 1,5px em `--fg`; com o rato, fundo `--fg` e texto `--bg`.

Ritmo das secções (*Mudado*: o hero é split e a CtaBand é um painel, não uma faixa):

- página inicial: hero `paper`, Obras em destaque `ink`, Serviços `paper`, Porquê Nós `bone`, CtaBand na mesma `bone` (sem o espaço de cima) com o painel `clay`, rodapé `ink`;
- `obras.html`: PageHead `paper`, grupos a alternar `ink` e `bone` (a começar em ink), CtaBand `paper` com o painel, rodapé `ink`;
- ficha de obra: PageHead, fotografia e corpo `paper`, CtaBand na mesma `paper` com o painel, Outras obras `bone`, rodapé `ink`;
- `orcamento.html`: PageHead `paper`, cartão do formulário `white` e lateral `bone`, rodapé `ink`;
- `obrigado.html`, `404.html`, `privacidade.html`: PageHead e conteúdo `paper`, rodapé `ink`.

Duas secções ink nunca se tocam. O vermelho nunca encosta ao verde: o painel clay vive dentro da `.wrap` de uma secção
paper ou bone, com 48px ou mais de claro até qualquer secção ink e 16px ou mais dos lados (teste do browser); nunca uma
faixa clay a toda a largura (o `--check` recusa a `s-clay` fora do painel e uma CtaBand numa secção que não seja paper
ou bone). O clay fica nos botões, na célula «Orçamento» da barra, nas etiquetas, nos traços e no painel.

### Contrastes medidos

Razão de contraste WCAG 2.x, calculada a partir dos valores do `:root` (os `rgba()` compostos sobre o fundo). Os testes
do browser medem os botões, a barra, o painel clay e as legendas dos cartões nas páginas geradas e exigem 4,5:1.

| texto | fundo | razão | onde |
|---|---|---|---|
| ink | paper, bone, white | 12,0, 11,2, 12,8 | texto principal; botão do painel (ink sobre paper) |
| muted | paper, bone, white | 5,9, 5,5, 6,2 | texto secundário, ajudas do formulário |
| clay-deep | paper, bone, white | 8,0, 7,5, 8,5 | itálico do h1, vistos; botão do painel com o rato (sobre white) |
| white | clay | 5,9 | botão, painel da CtaBand, célula «Orçamento», etiquetas |
| paper | ink | 12,0 | botão com o rato no claro, etiqueta «Demolição», ligação «Saltar» |
| bone | ink | 11,2 | texto no ink, barra de ações |
| bone-70 | ink | 6,3 | texto secundário no ink, ligações do rodapé |
| amber | ink, ink-deep, ink-raised | 5,6, 6,7, 4,66 | acentos no ink; `.cat` da legenda no telemóvel (ink-raised) |
| ink | amber | 5,6 | botão com o rato no ink |
| bone | ink-raised | 9,4 | título da legenda no telemóvel |
| bone, amber | faixa `overlay` sobre uma fotografia branca | 10,1, 5,0 | título e `.cat` dos cartões no pior caso |
| erro | white, paper | 7,8, 7,4 | mensagens de erro |
| white | erro | 7,8 | o «!» do erro |

| elemento (3:1) | fundo | razão |
|---|---|---|
| borda dos campos (muted) | white | 6,2 |
| traço do eyebrow, caixa de visto (clay) | paper, bone | 5,6, 5,2 |
| borda do botão paper no painel | clay | 5,6 |
| traço da página atual no menu (clay-deep) | paper | 8,0 |
| foco ink, amber, white | paper ou bone, ink, clay | 12,0 ou 11,2, 5,6, 5,9 |

O que não se usa, porque não passa:

- texto escuro (ink, ink-deep, ink-raised, sage, muted, clay-deep, erro, preto) sobre clay: ink dá 2,2:1. O `--check` recusa-o;
- amber sobre o claro: 2,2:1. O amber é só para o verde;
- clay ao lado de ink: 2,2:1 entre as duas cores, e lê-se como uma bandeira. Sobre o verde o acento é o amber;
- bone-50 sobre ink: 4,0:1 (sem uso);
- `line` como borda de um campo: 1,4:1 sobre white. É só para filetes; os campos usam muted;
- white sobre whatsapp: 2,0:1 (sem uso).

*Mudado:* os pares abaixo de AA que o site de maio mantinha por fidelidade (paper sobre clay, clay sobre claro, white
sobre whatsapp, bone-50 sobre ink, a borda `line` dos campos) já não existem. Dois acertos à paleta proposta pelo dono,
medidos: `ink-raised` um passo mais escuro do que #1f5640 (o `.cat` amber da legenda no telemóvel ficava a 3,7:1) e a
faixa `overlay` de 85 para 90% (o `.cat` sobre uma fotografia branca ficava a 4,2:1).

## Tipografia

Fraunces (`--font-serif`): h1 a h4 a 600, entrelinha 1.05, -0.01em; números e destaques. Archivo (`--font-sans`): o
resto, 400, entrelinha 1.6. O h1 e o h2 partem em linhas equilibradas (`text-wrap: balance`), as introduções sem uma
palavra sozinha na última linha (`pretty`).

*Mudado:* de 29 tamanhos para 10 estilos (e o das etiquetas de formulário); mais nenhum `font-size` (o `--check` falha).

| estilo | tamanho | uso |
|---|---|---|
| `--fs-display-hero` | clamp(2.6rem, 9vw, 5rem) | o h1 da página inicial, só; a 2.ª linha em `<em>` itálico clay-deep |
| `--fs-section` | clamp(2.2rem, 6vw, 3.4rem) | h2 de secção e h1 das páginas interiores |
| `--fs-cta` | clamp(2.4rem, 6vw, 3.6rem) | h2 da CtaBand |
| `--fs-card` | 1.5rem | títulos de cartão, h2 dos grupos de obras, da prosa, da Ficha e do formulário |
| `--fs-step` | 1.25rem | títulos da lateral do pedido, os números dos passos, h3 da prosa, o telefone do cabeçalho |
| `--fs-list` | 1.12rem | linhas de serviço, TrustList, passos, «Quem somos» |
| `--fs-lead` | 1.15rem | lead do hero e introduções |
| `--fs-body` | 1rem | texto e todos os campos de formulário (16px: sem zoom no iOS) |
| `--fs-category` | .8125rem (13px) | etiquetas em MAIÚSCULAS: eyebrow, `.cat`, `dt`, rodapé, menu, botões, barra |
| `--fs-phone` | 2.4rem | o telefone da CtaBand e da lateral do pedido; o número do cartão «25 anos» |
| `--fs-label` | .875rem (14px) | etiquetas de formulário, notas, migalhas, ProofLine; sem maiúsculas |

Etiquetas em Archivo e MAIÚSCULAS por CSS, todas a 13px: `eyebrow` 700 .16em · `.cat` e `dt` 700 .12em · rodapé, `.pg-tag`,
«Ver obra» e etiquetas do comparador 700 .1em · menu 600 .08em · botões 700 .07em.

## Espaço, forma, sombras, medidas

- Espaços (px exatos, sem escala): `space-2 6 12 16 18 22 26 32 36 38 44 50 60 64 80 90 110` (o 36 e o 110 ficam nos tokens, sem uso). *Mudado:* secções 80 em cima e em baixo (50 até 640px); hero 80 em cima e 90 em baixo (50 e 50); SectionHead a 44 do conteúdo (38); PageHead 50 e 64 (26 e 44); rodapé 64 e 44. Um passo de token abaixo do design system (110 e 64), para a página inicial ficar em menos de 6.000px a 390 e até 4.400 a 1440.
- Raios: `radius-none` 0 em tudo; `radius-round` 50% na pega do comparador, no anel do painel clay, no indicador de envio e no círculo do «!». *Mudado:* `radius-pill` retirado com a bolha do WhatsApp.
- Linhas: `border-hairline` 1px, `border-control` 1.5px (botão fantasma, campos, botão do menu, WhatsApp do cabeçalho, contorno do alerta), `border-rule` 2px (traço do eyebrow, traço do menu, caixa de visto, indicador de envio), `border-step` 3px (linha do comparador, página atual no menu móvel), `border-accent` 4px (só o cartão «25 anos»).
- Sombras só no que flutua: `shadow-tag` (cartão «25 anos»), `shadow-badge` (cabeçalho depois de 80px de scroll, painel do menu), `shadow-knob` (pega do comparador). *Mudado:* `shadow-whatsapp` retirado.
- Medidas: `container` 1240px, `sec-head-width` 640px, `col-acoes` 360px (coluna das ações da CtaBand), `nav-height` 78px (64 até 980), `logo-height` 52px (85% no cabeçalho compacto), `logo-height-footer` 64px, `photo-row` 300px, `photo-row-1col` 280px (uma coluna, até 980), `mini` 64px (miniaturas dos serviços), `alvo` 44px e `alvo-menu` 48px (alvos de toque), `barra-height` 56px, `wa-icon` 22px, `wa-icon-barra` min(22px, 5.6vw). *Mudado:* `hero-visual` e `slider-width` retirados (o comparador fica à largura do contentor, até 78% da altura do ecrã).
- Quebras: só duas, `980px` (o cabeçalho colapsa num menu, aparece a barra de ações, as grelhas de 2 colunas empilham) e `640px` (1 coluna e menos espaço), escritas com o valor literal nas media queries (`bp-tablet` e `bp-mobile` saíram dos tokens: uma variável CSS não entra numa `@media`). O `--check` recusa qualquer outra largura ou altura; as de preferência (`prefers-reduced-motion`, `hover`, `forced-colors`) passam.
- Camadas: `z-skip` 200, `z-header` 100, `z-menu-fundo` 95, `z-barra` 90, `z-grain` 9999. *Mudado:* `z-whatsapp` retirado.

## Componentes (HTML em `src/partials/` e nas páginas)

| componente | estrutura |
|---|---|
| Button | `a.btn` (clay com texto white), `a.btn.btn-ghost` (contorno `--fg`), `button.btn`; a cor vem da superfície; 48px de altura. Grupo `.acoes` (12px entre botões; até 640px todos a toda a largura e com a mesma altura) |
| Links | só dois: `.link` (sublinhado a 3px) e `.link-seta` (Archivo 600, ícone `seta`, 44px de alvo) |
| SiteHeader + menu | `header.topo` (paper, fixo): `a.logo > img.logo-img` (logo-melperfaz.png), `ul.navlinks` (de `site.json › menu`), telefone, WhatsApp e «Pedir Orçamento»; até 980px `button.menu-toggle` e o painel `.menu-movel.s-ink` com o fundo `.menu-fundo`. Variante `topo-reduzido` (`obrigado.html`) |
| ActionBar | `nav.barra` (só até 980px, fixa em baixo, ink): Ligar, WhatsApp e Orçamento (clay) em terços de 56px; em `orcamento.html` a terceira é «Enviar fotografias» |
| SiteFooter | `footer.rodape.s-ink > .wrap > .foot-grid` (`.foot-brand` com logo-melperfaz-branco.png, `nav.foot-col` «Site» e `.foot-col` «Contactos», títulos `p.foot-h`) + `.foot-bottom` (linha legal) |
| PageHead | `section.page-head.s-paper`: `nav.migalhas`, eyebrow, h1, introdução; `compacto` em `orcamento.html`, `icone` em `obrigado.html`; o que vem a seguir na mesma superfície vai numa `.sec-junta` |
| Eyebrow | `span.eyebrow` (texto `--fg`, traço de 34px em `--eyebrow-rule`). *Mudado:* o texto já não é clay |
| SectionHead | `section.sec > .wrap > .sec-head` (eyebrow, h2, p), alinhado à esquerda |
| Hero | `section.hero.s-paper > .wrap.hero-grid`: texto (eyebrow, h1 com `<br><em>`, `p.lead`, `.acoes`, `p.hero-apoio`, ProofLine) + `figure.hero-visual` (`.frame` com a foto-01 e um só `p.tag-card` direito «25 anos», em baixo à esquerda; até 640px em cima) |
| ProofLine | `ul.prova` (`site.json › provas` e o alvará quando existir), por baixo de cada grupo de botões |
| ServiceList | `ul.svc-lista > li.svc` (`.svc-num`, h3, miniatura de 64px da primeira obra em destaque do serviço, p, `.svc-links` «Ver obras (N)» e «Pedir orçamento»). Linhas sem caixa e sem seta. *Mudado:* era a ServiceGrid |
| ProjectGrid | `.photo-grid > figure.pg` (`obra-foto.html`: a fotografia, `figcaption` com `.pg-tag`, `.cat`, h2 ou h3 com a ligação que cobre o cartão inteiro, «Ver obra»). Legenda em fluxo sobre a faixa `overlay`; até 640px por baixo da fotografia (4/3 ou 4/5), menos nas obras em destaque da página inicial (`.destaques`, a segunda ao alto) |
| BeforeAfter | `.ba-wrap > .ba-slider` (depois, `.ba-before-img` com o antes e a etiqueta «Demolição», `.ba-handle` com os ícones `seta-esq` e `seta-dir`, «Acabamento», `input.ba-range`); só na ficha da obra que o tem (M05), à largura do contentor |
| TrustList | `ul.trust-list > li` (`span.tick` com o ícone `visto`, h3, p); `.trust-list-curta` (só os títulos) na lateral do pedido |
| Ficha | `.ficha` (bone, 1px de `line`, `dl` em 2 colunas): a «Ficha da obra» (só com pelo menos um facto) e os tratamentos da política de privacidade |
| CtaBand | `section.sec.cta.s-paper` (ou `s-bone`) `> .wrap > .cta-painel.s-clay > .cta-grid`: eyebrow, h2, `p.cta-p`, `a.cta-phone`, horário, e a coluna `.cta-acoes` («Pedir Orçamento», WhatsApp, ProofLine). *Mudado:* um painel dentro da `.wrap`, não uma faixa; o formulário saiu daqui |
| QuoteForm | `orcamento-form.html`, só em `orcamento.html`: `.form-cartao` (white, 1px de `line`) com `form[name=orcamento][data-netlify]`, `.field` (label de 14px, campo de 16px com borda muted, ajuda, `.field-erro` com «!»), «Localidade» opcional e `button.btn` a toda a largura; ao lado a lateral `bone` (telefone, «O que acontece a seguir», TrustList curta, fotografia). Sucesso: `obrigado.html` |

Extras: `<body class="grain">` liga o grão do site (4%); `.reveal` + `.in` (IntersectionObserver a 12%) para a entrada ao
fazer scroll; `.so-leitor` (só para leitores de ecrã) e `.skip` («Saltar para o conteúdo»).

### Retirados do site

- **Marquee** (`.strip`): a faixa com os nomes dos serviços a deslizar.
- **StatCard** (`.stat-card`: 25 anos, 2001, 100% licenciada, 2 anos de garantia): os mesmos factos ficam no cartão «25 anos» do hero, na ProofLine e na TrustList.
- **ProcessSteps** na página inicial: o mesmo conteúdo passou para «O que acontece a seguir» (`.orc-passos`), ao lado do formulário.
- **WhatsAppButton** (`a.wa-float`) e a sua pulsação: o WhatsApp está no cabeçalho, na barra de ações e na CtaBand.
- **Tag-cards rodados** (`.hero-tag2` e o `tag-card` inclinado): fica um só cartão direito.
- **Hero a toda a largura** (full-bleed, `.hero-cheio`, `.hero-factos`): o hero é o split do design system.
- **ServiceGrid** (caixas com seta), **QuoteForm na página inicial**, `.cta-inner` e `.cta-faixa`, `.btn-ghost-ink` e `.btn-ghost-paper`, chips e `.filtros` das obras (a pensar de novo só com 8 ou mais obras), `.obra-nav`, `.work-mais`, `.pag-links`.

## Movimento

*Mudado:* tokens de movimento no lugar das durações soltas (0.2 a 0.3s nos hovers, 0.7s na entrada, faixa a 28s).

| token | valor | uso |
|---|---|---|
| `--dur-1` | 150ms | setas que avançam, cor das ligações do rodapé |
| `--dur-2` | 250ms | hovers, menu (as barras viram X, o painel e o fundo entram com fade), cabeçalho compacto, cartões |
| `--dur-3` | 500ms | entrada ao fazer scroll, vistos a desenhar-se, fade das fotografias, telefone, WhatsApp, indicador de envio |
| `--ease-out` | cubic-bezier(.2,.7,.3,1) | quase tudo |
| `--ease-in-out` | cubic-bezier(.65,0,.35,1) | o telefone que abana, o WhatsApp que pulsa, o indicador de envio |
| `--cascata` | 80ms | o intervalo entre elementos que entram juntos |
| `--espera-js` | 2.5s | sem o `site.js`, tudo aparece ao fim deste tempo |

- O que mexe: o cabeçalho ganha sombra e um logótipo a 85% depois de 80px (sem mudar de altura); a entrada ao fazer scroll sobe 16px em 500ms, em cascata; os vistos desenham-se; as setas avançam 5px; o telefone abana uma vez; o WhatsApp pulsa duas vezes; as setas do comparador afastam-se ao agarrar; as fotografias em lazy load passam da prévia de 16px à imagem num fade; o envio mostra um anel (no máximo 40 voltas de 500ms); o círculo de `obrigado.html` desenha-se.
- Regras (o `--check` confere): durações e curvas só pelos tokens (0s é a exceção), cada duração com a sua curva, nenhum `--dur-*` acima de 500ms, nada `infinite`, e só se anima `transform`, `opacity`, as cores e `stroke-dashoffset` (nunca `width`, `top` ou `all`).
- Com `prefers-reduced-motion: reduce` as animações e as transições acabam logo e nada se desloca; o deslize suave das âncoras só existe sem essa preferência. Sem JavaScript tudo fica à vista.

## Ícones

*Mudado:* uma biblioteca própria em `src/partials/icones.svg` no lugar dos glifos ✦ → ✓ ‹ › ≡ (o `--check` recusa →, ≡,
✓ e ‹ no site; o › fica só como separador das migalhas, escondido do leitor de ecrã). Grelha de 24 (o `enviado` em 48),
traço de 1,75 em `currentColor`, sem preenchimento, cantos vivos (sem pontas redondas). `{{icone nome}}` copia o
símbolo para a página em linha, num `<svg class="icone i-nome" aria-hidden="true">`, para o CSS animar as partes; um
nome que não existe pára o build.

| ícone | onde |
|---|---|
| `seta` | `.link-seta`, «Ver obra» dos cartões |
| `menu` | o botão do menu (as três barras viram X) |
| `telefone` | cabeçalho, barra de ações |
| `whatsapp` | cabeçalho, barra de ações (o logótipo, cheio) |
| `visto` | TrustList e «Na obra» das fichas, dentro da caixa `.tick` |
| `seta-esq`, `seta-dir` | a pega do comparador |
| `enviado` | um visto num círculo, em `obrigado.html` |

## Regras

- Texto: português de Portugal; tratar o cliente por você sem o pronome ("Peça o seu orçamento"); a empresa fala no plural ("Reabilitamos"). Frases curtas com factos verdadeiros (25 anos, desde 2001, 2 anos de garantia). Títulos em frase normal; botões e menu com verbo e maiúsculas iniciais ("Pedir Orçamento"). Telefone "961 245 288". Sem emoji. Sem travessões (—): usar vírgulas ou parênteses. Nunca inventar factos: o que falta fica vazio e escondido.
- Cor: no vermelho (clay) o texto é sempre branco; sobre o claro o vermelho do texto é `clay-deep`; sobre ink o acento é `amber`. O clay nunca encosta ao verde e nunca é uma faixa a toda a largura. O erro usa `erro`, só em texto e contorno, com o «!». Degradês só na moldura do hero e nas legendas das fotos.
- Forma: cantos vivos; nada de cartões arredondados nem sombras em cartões e secções.
- Imagem: só fotos reais de obra, `object-fit: cover` a partir do `foco` de cada obra, sem moldura; nada de banco de imagens nem ilustrações. *Mudado:* a faixa preta da `obra5.jpg` (foto-05) e da `antes-wc.jpg` (foto-06) foi cortada no próprio JPEG, e o ícone de gostos da `obra5.jpg` também.
- Logótipo: lockup completo em PNG (não há SVG), recortado às linhas de recorte e reduzido a 400px; `logo-melperfaz.png` em fundos claros, `logo-melperfaz-branco.png` em ink. *Mudado a pedido do dono:* o logótipo foi recolorido de azul-marinho para o verde `ink` (os favicons também); o branco fica igual. Não redesenhar. A imagem de partilha é o logótipo branco ao centro de 1200 × 630, sobre o `--ink` (`python3 gerar_fotos.py --partilha`).
- Ícones: os de `icones.svg` (ver «Ícones»), nunca glifos de texto.
- Movimento: os tokens de «Movimento»; nada sem fim, nada acima de 500ms, sempre com `prefers-reduced-motion`.
- Acessibilidade: foco com `outline: 3px solid var(--focus-c); outline-offset: 3px` (ink no claro, amber no ink, branco no clay). *Mudado:* todos os pares de texto passam AA (ver «Contrastes medidos»); alvos de toque de 44px (48 nos botões e no menu); campos de 16px; o erro não depende só da cor.
