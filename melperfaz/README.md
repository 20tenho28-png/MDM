# Site da Melperfaz, Construção Civil, Lda.

Site estático em português de Portugal para a Melperfaz (reabilitação de edifícios, espaços comerciais e apartamentos,
desde 2001): página inicial, galeria de obras com uma ficha por obra, pedido de orçamento pelo Netlify Forms, política
de privacidade. O visual é o do sistema de desenho «Melperfaz», agora em verde e vermelho a pedido do dono (verde-floresta
`ink` e vermelho `clay`, cantos vivos, títulos em Fraunces, texto em Archivo, fotografias reais das obras), e a
arquitetura é a do site da MDM (`website/`): um gerador em Python sem dependências, dados em JSON, verificações antes de
publicar e testes.

Documentos em `docs/`:

- `PLANO-REDESIGN.md`: o plano aprovado do redesenho e, no fim, onde o site construído difere dele (e porquê);
- `DESIGN.md`: o sistema de desenho como está construído (todos os tokens, superfícies, contrastes medidos, os 10
  estilos de texto, componentes, movimento e ícones), para quem escreve código;
- `PERGUNTAS-DONO.md`: as perguntas para a Melperfaz, por ordem de importância, cada uma com o sítio onde a resposta
  aparece e o campo que preenche.

## Gerar

```bash
cd melperfaz
python3 build.py            # gera public/
python3 build.py --check    # gera e valida ligações, recursos, sintaxe, textos, o formulário e o CSS (sai com 1 se falhar)
python3 build.py --faltam   # lista os dados que só a Melperfaz pode dar (não falha)
```

Só precisa de Python 3.11+ (biblioteca padrão). `public/` não entra no git: é sempre gerado. Para gerar noutra pasta:
`MELPERFAZ_OUT=/tmp/melperfaz python3 build.py --check`. Antes de gerar, o `build.py` apaga a pasta de saída, mas só se
for uma pasta que ele próprio gerou (deixa lá o ficheiro `.gerado-por-build`), uma pasta vazia ou nova; recusa, com o
motivo, a pasta do site, as pastas acima dela, a pasta pessoal, as fontes (`src/`, `data/`, `assets/`) e qualquer pasta
com `build.py`, `data/` ou `.git`.

Pré-visualizar: `python3 -m http.server -d public 8000` e abrir `http://localhost:8000/`.

## Páginas

O build gera 11 páginas (6 de `src/pages/` e uma ficha por obra), mais `sitemap.xml` e `robots.txt`.

| Página | Fonte | O que tem |
| --- | --- | --- |
| Início (`index.html`) | `src/pages/index.html` | Hero split (paper, com o cartão «25 anos»), Obras em destaque (ink, as obras com `"destaque": true`), Serviços (paper, a ServiceList), Porquê Nós e «Quem somos» (bone), CtaBand (o painel vermelho, na mesma bone) |
| Obras (`obras.html`) | `src/pages/obras.html` | PageHead com o índice por serviço; um grupo por serviço com obras (âncoras `#reabilitacao`, `#fachadas`, `#acabamentos`), a alternar ink e bone; CtaBand (paper) |
| Ficha de obra (`obras/<slug>.html`) | `src/templates/obra.html` | PageHead (o eyebrow leva ao grupo da obra), a fotografia na sua proporção ou o comparador antes/depois, «O problema» e «O que fizemos» (quando existem), «Na obra», as fotografias extra, a Ficha da obra, a CtaBand com o tipo de obra já escolhido e «Outras obras» (bone) |
| Pedir Orçamento (`orcamento.html`) | `src/pages/orcamento.html` | PageHead compacto, o QuoteForm (o único formulário do site) e a lateral bone (telefone, WhatsApp das fotografias, «O que acontece a seguir», a TrustList condensada, uma fotografia) |
| Obrigado (`obrigado.html`) | `src/pages/obrigado.html` | O sucesso do envio (o ícone «enviado» a desenhar-se), cabeçalho reduzido, sem barra de ações; fora do Google |
| 404 (`404.html`) | `src/pages/404.html` | Caminhos de volta (pedido, obras, início); fora do Google |
| Privacidade (`privacidade.html`) | `src/pages/privacidade.html` | Índice à esquerda e o texto, com uma Ficha por tratamento de dados |

Cada página tem no topo um `<!--meta {...} -->` (título, descrição, menu, JSON-LD, migalhas; `"header": "reduzido"` e
`"barra": "sem-orcamento"` ou `"nao"` mudam o cabeçalho e a barra de ações).

## Pastas

| Pasta ou ficheiro | O que é |
| --- | --- |
| `data/site.json` | A empresa: nome, telefone, WhatsApp e as mensagens já escritas, o endereço do site (`baseUrl`), `preview`; `servicos` (o vocabulário: os serviços da página inicial, as opções do formulário, as etiquetas e os grupos das obras e o `?tipo=`; `antigos` são os nomes do «Tipo de obra» de antes do redesenho, para os endereços antigos com `?tipo=` continuarem a escolher o serviço), `provas` (a linha de prova junto dos botões) e `menu` |
| `data/dados-melperfaz.json` | O que só a Melperfaz pode dar (email, NIF, morada, alvará, seguro, zona, horário, Google Maps). Vazio = a frase ou a linha não aparece |
| `data/obras.json` | As obras: serviço (`cat`, o de `site.json › servicos`), `destaque` (na página inicial), título, fotografia, o que se vê, os factos (vazios até a empresa os dar), `fotosExtra` (mais fotografias, por baixo de «Na obra» na ficha) |
| `data/fotos.json` | As fotografias: tamanho do original, origem e texto alternativo. `data/lqip.json` são as prévias (gerado) |
| `src/templates/` | `layout.html` (a cabeça, o cabeçalho e o rodapé de todas as páginas) e `obra.html` (a ficha de cada obra) |
| `src/partials/` | Os componentes (ver «Componentes») e `icones.svg` |
| `src/pages/` | As páginas (ver «Páginas»), cada uma com o seu `<!--meta {...} -->` |
| `assets/css/` | `site.css` (o sistema de desenho), `pag-obras.css`, `pag-paginas.css`, `pag-orcamento.css` (formulário e lateral) |
| `assets/js/site.js` | Menu nos ecrãs estreitos (fundo escurecido, página sem deslizar, Esc), cabeçalho compacto, entrada ao fazer scroll, comparador (um toque ou um clique põe a linha, arrasta-se a partir da pega; setas do teclado), em `orcamento.html` o `?tipo=` (tipo escolhido e «Pedido para: X · alterar») e o `?de=` (campo `pagina`), e o envio do formulário: validação em português, `obrigado.html` se correu bem, e se falhar um aviso com o telefone e o WhatsApp (`wa.erro`, com o nome e o tipo escritos) |
| `assets/fonts/` | Fraunces (normal e itálico) e Archivo, variáveis, só latim, com as licenças (SIL OFL). Nada vem de terceiros |
| `assets/img/` | Logótipos (`logo-melperfaz.png` verde, `logo-melperfaz-branco.png`), favicons, imagem de partilha e `fotos/` (o original `foto-NN.jpg` e os tamanhos em AVIF e WebP) |
| `gerar_fotos.py` | Os tamanhos das fotografias, as prévias e a imagem de partilha (precisa do Pillow; ver «Fotografias») |
| `tests/` | `site.test.mjs` (o site gerado, sem browser) e `browser.mjs` (Playwright) |
| `netlify.toml` | A publicação: `python3 build.py --check` (um erro pára a publicação e fica a versão anterior), pasta `public`; cache de um ano para o CSS e o JS (levam versão) e as letras, de um dia para as imagens (mudam no mesmo nome); nenhuma página dentro de outro site (`frame-ancestors`) |

A sintaxe dos modelos está no topo de `build.py`: `{{ site.phone }}`, `{{> parcial }}`, `{{> cta titulo="…" texto="…"}}`
(parâmetros declarados no topo do parcial com `<!--parametros {...} -->`), `{{foto 01 sizes="…"}}`, `{{wa geral}}`,
`{{each obra-foto all}}`, `{{#se dados.email}}…{{/se}}`, `{{#cada servicos}}…{{/cada}}`, `{{icone seta}}` (um ícone de
`src/partials/icones.svg`) e `{{li obra.detalhes visto}}` (uma lista com o visto).

## Componentes

Só estes (o plano, «Componentes permitidos»); o HTML de cada um está num parcial ou numa página, e o CSS em `site.css`.

| Componente | Onde | Notas |
| --- | --- | --- |
| Header + menu | `partials/header.html` | Paper, fixo: logótipo, menu de `site.json › menu`, telefone (com o horário), WhatsApp e «Pedir Orçamento». Até 980 px, o botão do menu (as barras viram X) e o painel ink. Variante `reduzido` (só o logótipo e o telefone, em `obrigado.html`) |
| ActionBar | `partials/barra-acoes.html` | Até 980 px, fixa em baixo: Ligar, WhatsApp e Orçamento (clay), em terços; em `orcamento.html` a terceira é «Enviar fotografias» |
| Footer | `partials/footer.html` | Ink, 3 colunas (a marca, «Site», «Contactos») e a linha legal; os dados do dono com `{{#se}}` |
| PageHead | `partials/page-head.html` | Migalhas, eyebrow, h1, introdução; `compacto`, `icone` e `indice` |
| SectionHead e Eyebrow | `.sec-head`, `.eyebrow` | Eyebrow com o texto da superfície e o traço de 34 px (clay no claro, amber no ink, branco no clay) |
| Botões | `.btn`, `.btn-ghost`, grupo `.acoes` | Um primário e um secundário, com a mesma altura (48 px); a cor vem da superfície |
| Ligações | `.link`, `.link-seta` | Só estas duas |
| Hero | `pages/index.html` | Split do sistema de desenho, com um só cartão «25 anos», direito |
| ProofLine | `partials/prova.html` | `site.json › provas` e o alvará quando existir, por baixo dos botões do hero e da CtaBand |
| ServiceList | `pages/index.html` | Linhas sem caixa, com a miniatura de 64 px, «Ver obras (N)» e «Pedir orçamento» com o tipo pré-escolhido |
| ProjectGrid / ProjectCard | `partials/obra-foto.html` | A legenda na faixa escura por cima da fotografia, em fluxo; o cartão inteiro é a ligação |
| BeforeAfter | `partials/antes-depois.html` | Só na ficha da obra com `antesDepois` (M05) |
| TrustList | `partials/garantias.html` | Inteira na página inicial, condensada (`curta`) em `orcamento.html` |
| Ficha | `.ficha` | A «Ficha da obra» (só com pelo menos um facto) e os tratamentos da privacidade |
| CtaBand | `partials/cta.html` | Um painel clay dentro da `.wrap` de uma secção paper ou bone (`sup`); `junta` continua a secção de cima |
| QuoteForm | `partials/orcamento-form.html` | Só em `orcamento.html`; quem muda os campos muda também `FORM_CAMPOS` no `build.py` |

Retirados do sistema de desenho: Marquee, StatCard, ProcessSteps (o conteúdo passou para «O que acontece a seguir» em
`orcamento.html`), a bolha do WhatsApp, os cartões rodados do hero, o hero a toda a largura, a ServiceGrid e o
formulário na página inicial (ver `docs/DESIGN.md`).

## Regras do texto

As do sistema de desenho («Voz e texto»), conferidas pelo `--check` onde dá:

- português de Portugal; tratar o cliente por você sem o pronome («Peça o seu orçamento»); a empresa fala no plural;
- frases curtas e afirmativas, só com factos verdadeiros: «desde 2001», «dois anos de garantia», «no prazo de um dia útil»;
- títulos em frase normal; menu, botões e nomes de serviço em maiúsculas iniciais («Pedir Orçamento»); os botões começam por verbo;
- telefone sempre «961 245 288»; sem emoji; sem travessões (—): vírgulas ou parênteses;
- nunca inventar factos: preços, prazos, números, clientes, locais. O que falta fica vazio em `data/` e escondido no site.

Desvios deliberados em relação ao sistema de desenho: as letras alojadas com o site em vez do Google Fonts; um menu para os
ecrãs estreitos (o botão entra a 980 px e a barra de ações em baixo leva o telefone, o WhatsApp e o orçamento; o site
publicado escondia os links a 640 px e o botão não abria nada); o formulário numa página própria, `orcamento.html`, em vez
do fundo da página inicial; a bolha de WhatsApp sai (o cabeçalho e a barra já o têm); âncoras em português; a lista de
serviços com «Ver obras (N)» e «Pedir orçamento» com o tipo pré-escolhido; as obras agrupadas por serviço em `obras.html`; a opção «Acabamentos» no formulário; as páginas Obras, fichas, obrigado, 404 e
privacidade; o foco de teclado visível; a imagem de partilha da empresa nas fichas com fotografia ao alto; e o verde e
vermelho no lugar do azul-marinho e laranja, a pedido do dono.

A idade da empresa («25 anos») calcula-se do ano de fundação em cada geração do site. O Netlify gera o site em cada
publicação; se o site ficar um ano sem mudanças, publicar de novo em janeiro atualiza o número.

## Verificações (`--check`)

Ligações, imagens e `srcset` que existem; `?v=` nos CSS e JS; sem sintaxe de modelo nem placeholders; sem travessões,
emoji ou o telefone escrito de outra forma; `lang`, um só `h1`, título e descrição com tamanho certo, canonical e
`og:image` no domínio; JSON-LD válido com a empresa; o formulário Netlify só em `orcamento.html`, com os atributos, os
campos e as opções de `site.json`; todos os «Pedir Orçamento» (texto ou `aria-label`) a levar a `orcamento.html`; nenhuma ligação para `#contacto` nem para `…index.html` (a página inicial é `./`) e nenhum dos rótulos retirados («Pedir Orçamento Gratuito», «Chamar no WhatsApp», «Orçamento Gratuito» como nome de ligação); o vermelho nunca a toda a largura (a superfície `s-clay` só no painel da CtaBand, e a CtaBand numa secção paper ou bone, para não encostar ao verde); `robots.txt`, `_headers` e `netlify.toml` de acordo com `preview`, com o `--check` no comando de publicação e `frame-ancestors`; os comentários tirados ao CSS e ao JS publicados sem partir nada; todas as fotografias com os tamanhos e a
prévia, e cada `foto-NN.jpg` com o tamanho que `fotos.json` diz; a imagem de partilha com o tamanho do `og:image`; os dados de `dados-melperfaz.json` com o formato certo (email, NIF, ligação do Google Maps, sem ponto final no alvará, seguro, zona e morada); `fotosExtra` sem repetidas; nenhum dos glifos
que passaram a ícone (→, ≡, ✓, ‹).

### O lint das folhas de estilo

Para o sistema visual não voltar a derivar, o `--check` lê `site.css` e as folhas de cada página. Fora do bloco `:root`
(os tokens), falha com:

- espaços (`margin`, `padding`, `gap`, `inset`, `top`/`right`/`bottom`/`left`, `scroll-padding`) em px soltos em vez de
  `--space-*`;
- `font-size` fora dos estilos de texto `--fs-*` (ou `inherit`), e o atalho `font` com outra coisa que não `inherit`;
- `@media` com uma largura ou altura que não seja a de 980 ou de 640 px (`max-width: 980px`, `max-width: 640px` e os
  `min-width` de 981 e 641); as de preferência (`prefers-reduced-motion`, `hover`, `forced-colors`) passam;
- texto escuro (ink, ink-deep, ink-raised, sage, muted, clay-deep, erro ou preto) sobre o vermelho, em todas as regras,
  também no `:root`: um `color` escuro numa regra com fundo clay ou num seletor de `.s-clay` ou `.btn` sem fundo claro
  (paper, white, bone) na mesma regra, um `--btn-fg`/`--btn-fg-h` escuro com `--btn-bg`/`--btn-bg-h` clay e um `--fg`,
  `--fg-2` ou `--fg-cat` escuro em `.s-clay`;
- qualquer animação `infinite`;
- o movimento: durações e curvas que não sejam os tokens `--dur-1`/`--dur-2`/`--dur-3` e `--ease-out`/`--ease-in-out`,
  uma duração sem curva, um `--dur-*` acima de 500 ms, ou uma transição de algo que não seja `transform`, `opacity`, as
  cores ou `stroke-dashoffset` (nada de `width`, `top` ou `all`).

As exceções são só `1px` (hairline), `env(safe-area-inset-*)` e `0s`.

## Sistema visual (`assets/css/site.css`)

O pormenor (cada token, cada par de contraste medido, os componentes retirados) está em `docs/DESIGN.md`.

### Cores

Verde e vermelho, a pedido do dono. Os papéis guardam o nome do sistema de desenho, para o código continuar legível:

| Token | Valor | Papel |
| --- | --- | --- |
| `--ink` | #12392b | O verde-floresta: o escuro principal (texto no claro, superfícies escuras, rodapé, barra de ações) |
| `--ink-deep`, `--ink-raised` | #0a2a1f, #194634 | Fundo do comparador e base das faixas escuras; fotografias a carregar e legenda dos cartões no telemóvel |
| `--clay` | #c8102e | O vermelho do acento: botões, painel da CtaBand, célula «Orçamento», traços, caixa de visto |
| `--clay-deep` | #9b0d24 | O vermelho do texto sobre o claro (itálico do h1, vistos, página atual no menu) |
| `--amber` | #ff8a7a | Vermelho claro, só sobre o verde: texto de acento e foco |
| `--paper`, `--bone`, `--white` | #f7f9f5, #edf2ec, #ffffff | Os claros: fundo da página, secções alternadas, campos e texto sobre o vermelho |
| `--line`, `--muted` | #d3ddd4, #56645b | Filetes; texto secundário e borda dos campos |
| `--erro` | #a3161a | O erro do formulário: só texto e contorno, sempre com um «!» num círculo. Não é o vermelho da marca |

Mais: `--sage` (sem uso), `--bone-70/60/50/15/07/05`, `--overlay` (90% de ink-deep, a faixa das legendas),
`--overlay-soft`, `--overlay-menu`, `--overlay-hover`, `--shadow`, `--whatsapp` (sem uso) e os focos `--focus`,
`--focus-on-ink`, `--focus-on-clay`. O logótipo, os favicons e a imagem de partilha estão no mesmo verde (o logótipo
branco do rodapé fica igual).

### Regras de contraste

Todo o texto passa AA (4,5:1); os testes do browser medem-no nas páginas geradas.

- No vermelho (clay) o texto é sempre branco (5,9:1), nunca ink (2,2:1): o `--check` recusa texto escuro sobre o vermelho.
- Sobre o claro, o vermelho do texto é `clay-deep` (8:1 sobre paper); o amber nunca vai sobre o claro (2,2:1).
- Sobre o verde, o acento é o amber (5,6:1 sobre ink; 4,66:1 sobre ink-raised, a legenda dos cartões no telemóvel).
- As legendas dos cartões assentam na faixa `--overlay`: sobre uma fotografia branca, o `.cat` amber fica a 5:1 e o
  título bone a 10:1.
- O vermelho nunca encosta ao verde: o clay é só o painel da CtaBand, dentro da `.wrap` de uma secção paper ou bone (os
  bordos do painel são os da `.wrap`), nunca uma faixa a toda a largura; o teste do browser exige 48 px ou mais de
  claro entre o painel e qualquer secção ink.
- O erro (`--erro`, 7,8:1 sobre branco) é texto e contorno com o «!», para não se confundir com os botões vermelhos.
- Os campos têm borda muted (6,2:1 sobre branco); `line` (1,4:1) é só para filetes.

### Superfícies e botões

- Cada secção tem `.s-paper`, `.s-bone`, `.s-ink` ou `.s-clay`, que definem `--fg`, `--fg-2`, `--fg-cat`, `--rule`,
  `--eyebrow-rule`, `--focus-c` e as cores do botão. Os componentes só leem estas variáveis. O anel de foco
  (3 px, a 3 px) é ink no claro, amber no ink e branco no clay.
- `.btn`: clay com texto branco (com o rato, ink com texto paper no claro e amber com texto ink no ink); no painel clay,
  paper com texto ink, e com o rato branco com texto clay-deep, nunca verde no vermelho. Um só secundário, `.btn-ghost`
  (contorno da cor do texto; no painel clay, branco), com a mesma altura. Grupo `.acoes` (no telemóvel, todos a toda a
  largura). Ligações: `.link` e `.link-seta`.

### Texto, grelha e cartões

- **Texto**: 10 estilos (`--fs-display-hero`, `--fs-section`, `--fs-cta`, `--fs-card`, `--fs-step`, `--fs-list`,
  `--fs-lead`, `--fs-body`, `--fs-category` de 13 px, `--fs-phone`) e `--fs-label` (14 px) para as etiquetas de
  formulário. Os campos têm 16 px.
- **Grelha**: `.wrap` com 32 px de margem (16 px até 640 px); só duas quebras, 980 e 640 px. Secções com 80 px em cima e
  em baixo (50 até 640 px) e 44 px do SectionHead ao conteúdo (38 até 640 px), um passo de token abaixo do design system,
  para a página inicial ficar em menos de 6.000 px a 390 e até 4.400 a 1440.
- **Cartão de obra** (`obra-foto.html`): a legenda na faixa escura por cima da fotografia, em fluxo (cresce com o texto);
  linhas de 300 px no mínimo em duas colunas e, até 980 px, uma coluna com linhas de 280 px (`--photo-row-1col`). Até
  640 px a legenda passa para baixo da fotografia (4/3 ou 4/5), menos nas obras em destaque da página inicial. O
  cartão inteiro é a ligação.

### Ícones

`src/partials/icones.svg`, desenhados numa grelha de 24 (o `enviado` em 48), traço de 1,75 em `currentColor`, cantos
vivos. Substituem os glifos →, ≡, ✓ e ‹ › (o `--check` recusa-os; o › das migalhas fica, escondido do leitor de ecrã).

| Ícone | Onde |
| --- | --- |
| `seta` | `.link-seta` e «Ver obra» dos cartões (avança 5 px com o rato e com o foco) |
| `menu` | O botão do menu (as três barras viram X) |
| `telefone` | Cabeçalho (abana uma vez com o rato) e barra de ações |
| `whatsapp` | Cabeçalho e barra de ações (o logótipo, cheio; pulsa duas vezes ao abrir a página) |
| `visto` | TrustList e «Na obra» das fichas, na caixa `.tick` (desenha-se ao entrar no ecrã) |
| `seta-esq`, `seta-dir` | A pega do comparador (afastam-se ao agarrar) |
| `enviado` | Um visto num círculo, em `obrigado.html` (desenha-se ao abrir) |

`{{icone nome}}` copia o símbolo para a página em linha (para o CSS animar as partes), com `aria-hidden`; um nome que não
existe pára o build.

### Movimento

| Token | Valor | Uso |
| --- | --- | --- |
| `--dur-1` | 150 ms | As setas que avançam, a cor das ligações do rodapé |
| `--dur-2` | 250 ms | Hovers, o menu, o cabeçalho compacto, os cartões |
| `--dur-3` | 500 ms | A entrada ao fazer scroll, os vistos, o fade das fotografias, o telefone, o WhatsApp, o indicador de envio |
| `--ease-out` | cubic-bezier(.2,.7,.3,1) | Quase tudo |
| `--ease-in-out` | cubic-bezier(.65,0,.35,1) | O telefone, o WhatsApp, o indicador de envio |
| `--cascata` | 80 ms | O intervalo entre os elementos que entram juntos |
| `--espera-js` | 2.5 s | Sem o `site.js`, tudo aparece ao fim deste tempo |

As barras do menu viram X; o painel e o fundo entram com fade; o cabeçalho ganha sombra e um logótipo menor depois de
80 px (sem mudar de altura); a entrada ao fazer scroll sobe 16 px em 500 ms, em cascata; os vistos desenham-se; as setas
avançam 5 px; o telefone abana uma vez; o WhatsApp pulsa duas vezes; as setas do comparador afastam-se ao agarrar; as
fotografias em lazy load passam da prévia à imagem num fade; o envio mostra um indicador de carga (40 voltas de 500 ms,
o tempo máximo de espera). Com `prefers-reduced-motion: reduce` as animações e as transições acabam logo e nada se
desloca; o deslize suave das âncoras só existe sem essa preferência. Sem JavaScript tudo fica à vista.

## Testes

```bash
cd melperfaz
rm -rf public && python3 build.py && python3 build.py --check
npm test                                                    # o site gerado, sem browser (node --test tests/site.test.mjs)
NODE_PATH=/caminho/para/node_modules node tests/browser.mjs  # no browser; precisa do Playwright, fora das dependências
```

Os do browser geram o site numa pasta temporária e servem-no num servidor local que guarda cada envio do formulário
como o Netlify o receberia (e pode falhar de propósito): o pedido que segue e abre `obrigado.html`, a validação, o aviso
de falha (foco, telefone, WhatsApp com o nome e o tipo) com o que se escreveu a ficar, o envio sem JavaScript, o tipo de
obra pré-escolhido com «Pedido para:» e o `?de=` no campo `pagina`, o isco para robôs, nenhuma página a deslizar para o
lado a 390 e 320 px, os endereços antigos com `?tipo=` (os nomes de antes do redesenho), o menu dos ecrãs estreitos (também aberto a meio da página, e com o anel de foco da primeira e da última ligação inteiro dentro do painel), a barra fixa sem tapar o foco ao tabular, o comparador com toque, clique, arrasto e teclado, o foco e as
imagens, nenhuma fotografia ampliada para lá do original (o hero a 375 px, os cartões, a ficha na sua proporção),
nenhuma animação sem fim nem acima de 500 ms, o movimento (o menu que vira X e sai no fim da transição, o
cabeçalho compacto, os vistos em cascata, o fade das fotografias, o indicador de envio, o CLS abaixo de 0,05 e, com
movimento reduzido, nada a animar nem a deslocar-se), e o sistema visual: o h1 do hero e os cabeçalhos de secção no x do logótipo, contraste de
4,5:1 nos botões e no painel clay (branco sobre o vermelho), o anel de foco da cor de cada superfície, o hover dos botões no vermelho sem verde, o painel vermelho dentro da `.wrap` e a 48 px ou mais de qualquer secção ink (o vermelho nunca encosta ao verde), o erro com o seu «!» (não se confunde com o vermelho dos botões), campos de 16 px e etiquetas de 13 px, a altura da página inicial (menos de 6.000 px a 390, até 4.400 a 1440, medida numa cópia com os dados da Melperfaz
vazios: preenchidos, acrescentam linhas que não são o desenho), a legenda dos cartões (sobre a fotografia; a 390 px por baixo, menos nas obras em destaque), o cartão inteiro como
ligação, as miniaturas dos serviços com 64 px, os títulos sem uma palavra sozinha na última linha, os botões de cada
grupo com a mesma altura e a barra de ações em terços, sem nada fora do ecrã, e as fotografias sem faixa preta nem orla
escura nas bordas. O CI (`.github/workflows/ci.yml`) corre o `--check`, o `npm test` e os testes do browser em cada pull
request.

## Juntar uma obra

1. Pôr a fotografia em `assets/img/fotos/foto-NN.jpg` (o número seguinte), já com o corte final e sem dados de
   localização na EXIF.
2. Registá-la em `data/fotos.json`: `"NN": {"w": …, "h": …, "origem": "…", "alt": "…"}` (o tamanho do JPEG, de onde
   veio e o texto alternativo, que descreve só o que se vê).
3. Correr `python3 gerar_fotos.py NN` (precisa de `pip install "Pillow>=11.3"`): faz os tamanhos em AVIF e WebP e a
   prévia em `data/lqip.json`.
4. Juntar a obra a `data/obras.json › obras`, com `n`, `code` (M06, …), `slug` (minúsculas sem acentos, algarismos e
   hífens: o endereço `obras/<slug>.html`), `cat` (o `cat` de um serviço de `site.json`; hoje `reabilitacao`,
   `fachadas` ou `acabamentos`; um serviço com `cat` vazio passa a ter obras quando o seu `cat` for o próprio `id`),
   `title`, `foto` (`"NN"`), `foco` (`"X% Y%"`, o ponto que fica à vista nos cortes), `resumo` e `detalhes` (só o que
   se vê na fotografia) e `factos` com as seis chaves (`problema`, `trabalho`, `data`, `localExato`, `duracao`,
   `resultado`), vazias até a Melperfaz as dar. Opcionais: `"destaque": true` (na página inicial, desenhada para três),
   `fotosExtra` (outras fotografias de `fotos.json`) e `antesDepois` (`{"antes": "NN", "depois": "NN"}`, o comparador).
5. Correr `python3 build.py --check` (confere a fotografia, os tamanhos, o slug, o código, o `foco` e os factos) e os
   testes.

A obra aparece sozinha em `obras.html` (no grupo do seu serviço), na sua ficha, nas «Outras obras» das fichas, no mapa
do site e, com `destaque`, na página inicial; a contagem «Ver obras (N)» atualiza-se.

## Fotografias

O original de cada fotografia é `assets/img/fotos/foto-NN.jpg`, registado em `data/fotos.json` com o tamanho, a origem
e o texto alternativo. `python3 gerar_fotos.py` faz os tamanhos em AVIF e WebP e as prévias de 16 px de
`data/lqip.json`; só faz o que falta, `--todas` refaz tudo. `obra5.jpg` foi cortada para tirar um contador de gostos.

Cada `{{foto}}` leva um `sizes` com a largura a que a fotografia aparece: os cartões pedem 579 px em computador (duas
colunas) e, no telemóvel, mais do que a largura do cartão quando a moldura (4/3 ou 4/5; nas obras em destaque da página
inicial, o cartão de 280 px de altura) corta os lados de uma fotografia mais deitada do que ela (o `build.py` calcula-o
de cada fotografia); num telemóvel de 3x pede-se a de 2x; a fotografia da ficha aparece na sua proporção, até 78% da altura do ecrã, sem corte. O
`foco` de cada obra (`obras.json`) é o ponto que fica à vista nos cortes (na M04, a cabeça do trabalhador), também na
miniatura de 64 px dos serviços, que mostra a primeira obra em destaque de cada serviço (nos Acabamentos a M05, o
assentamento do pavimento, e não o teto branco da M02).
A `foto-05` e a `foto-06` traziam uma faixa preta do original do sistema de desenho (`obra5.jpg` 10 linhas em cima,
`antes-wc.jpg` 20 em baixo): foram cortadas no próprio JPEG, sem tirar nada da fotografia, e os tamanhos refeitos com
`--todas`. O `--check` falha quando um `foto-NN.jpg` não mede o que `fotos.json` diz (depois de um corte), e o teste do
browser quando uma fotografia, ou um dos seus tamanhos, tem uma faixa preta ou uma orla escura numa borda.

As fotografias, os logótipos e os favicons vêm do sistema de desenho (pasta `assets/` do pacote
«melperfaz-design-system»). Os logótipos foram recortados às linhas de recorte que os PNG traziam e reduzidos a 400 px de
largura; o logótipo e os favicons foram recoloridos do azul-marinho para o verde `--ink`. A imagem de partilha
(`og-melperfaz.jpg`, o `og:image` das páginas sem fotografia própria) já não é a do sistema de desenho: faz-se com
`python3 gerar_fotos.py --partilha`, o logótipo branco do rodapé ao centro de 1200 × 630, no `--ink` do `site.css`.
Refaz-se depois de mudar o logótipo ou o `--ink`.

## Preencher os dados da Melperfaz

`python3 build.py --faltam` lista tudo o que falta. Hoje são 14: o email da empresa, o NIF, a morada da sede, o número
do alvará, o seguro de responsabilidade civil, a zona onde trabalha, o horário de atendimento, a ligação do Google Maps,
e os seis factos de cada obra (o problema, o que se fez, data, local, duração, resultado), em falta nas cinco obras.
Enquanto faltam, o site esconde a frase ou a linha que os usa; nunca se inventa. As perguntas a fazer ao dono, por ordem
de importância e com o sítio onde cada resposta aparece, estão em `docs/PERGUNTAS-DONO.md`.

1. Dados da empresa: escrever o `valor` da chave em `data/dados-melperfaz.json` (`email`, `nif`, `morada`, `alvara`,
   `seguro`, `zona`, `horario`, `googleMaps`). Cada um entra sozinho em todas as páginas que o usam (o `pedido` de cada
   chave diz onde) e na ficha JSON-LD da empresa. Formato: email válido, NIF com nove algarismos, uma ligação do Google
   Maps; sem ponto final no alvará, no seguro, na zona e na morada (o site já o põe); sem travessões.
2. Factos das obras: em `data/obras.json`, os `factos` de cada obra. `problema` e `trabalho` entram em «O problema» e
   «O que fizemos»; `localExato`, `data`, `duracao` e `resultado` na Ficha da obra (que só aparece com pelo menos um).
   O local é o bairro ou o concelho, nunca o nome do cliente.
3. Correr `python3 build.py --check` (falha num valor mal escrito) e `python3 build.py --faltam` para ver o que sobra.

Só o que a Melperfaz confirmar por escrito. A altura da página inicial nos testes mede-se com os dados vazios, por isso
preencher os dados não põe o CI vermelho.

## Publicar no Netlify

1. No painel do site, ligar o repositório GitHub e pôr **Base directory** = `melperfaz`. O `netlify.toml` desta pasta
   faz o resto: `python3 build.py --check` e a pasta `public`. Se o `--check` falhar (um travessão, um email mal
   escrito, uma ligação partida), a publicação pára e fica no ar a versão anterior.
2. **Forms**: ligar a deteção de formulários e, em «Form notifications», o email que recebe cada pedido do formulário
   «orcamento». O Netlify só regista o formulário depois da primeira publicação.
3. **Domínio**: quando o site tiver domínio próprio, mudar `baseUrl` em `data/site.json` (canonical, `og:url`, mapa do
   site e JSON-LD) e publicar.
4. **Antes do lançamento** pode pôr-se `"preview": true` em `data/site.json`: o site fica fora dos motores de busca
   (noindex em todas as páginas, `X-Robots-Tag` e `robots.txt` com `Disallow`). No lançamento volta a `false`.
