# Site da Melperfaz, Construção Civil, Lda.

Site estático em português de Portugal para a Melperfaz (reabilitação de edifícios, espaços comerciais e apartamentos,
desde 2001): página inicial, galeria de obras com uma ficha por obra, pedido de orçamento pelo Netlify Forms, política
de privacidade. O visual é o do sistema de desenho «Melperfaz» (azul-marinho `ink` e laranja de obra `clay`, cantos
vivos, títulos em Fraunces, texto em Archivo, fotografias reais das obras), e a arquitetura é a do site da MDM
(`website/`): um gerador em Python sem dependências, dados em JSON, verificações antes de publicar e testes.

## Gerar

```bash
cd melperfaz
python3 build.py            # gera public/
python3 build.py --check    # gera e valida ligações, recursos, sintaxe, textos e o formulário (sai com 1 se falhar)
python3 build.py --faltam   # lista os dados que só a Melperfaz pode dar (não falha)
```

Só precisa de Python 3.11+ (biblioteca padrão). `public/` não entra no git: é sempre gerado. Para gerar noutra pasta:
`MELPERFAZ_OUT=/tmp/melperfaz python3 build.py --check`. Antes de gerar, o `build.py` apaga a pasta de saída, mas só se
for uma pasta que ele próprio gerou (deixa lá o ficheiro `.gerado-por-build`), uma pasta vazia ou nova; recusa, com o
motivo, a pasta do site, as pastas acima dela, a pasta pessoal, as fontes (`src/`, `data/`, `assets/`) e qualquer pasta
com `build.py`, `data/` ou `.git`.

Pré-visualizar: `python3 -m http.server -d public 8000` e abrir `http://localhost:8000/`.

## Pastas

| Pasta ou ficheiro | O que é |
| --- | --- |
| `data/site.json` | A empresa: nome, telefone, WhatsApp e as mensagens já escritas, o endereço do site (`baseUrl`), `preview`; `servicos` (o vocabulário: os serviços da página inicial, as opções do formulário, as etiquetas e os grupos das obras e o `?tipo=`; `antigos` são os nomes do «Tipo de obra» de antes do redesenho, para os endereços antigos com `?tipo=` continuarem a escolher o serviço), `provas` (a linha de prova junto dos botões) e `menu` |
| `data/dados-melperfaz.json` | O que só a Melperfaz pode dar (email, NIF, morada, alvará, seguro, zona, horário, Google Maps). Vazio = a frase ou a linha não aparece |
| `data/obras.json` | As obras: serviço (`cat`, o de `site.json › servicos`), `destaque` (na página inicial), título, fotografia, o que se vê, os factos (vazios até a empresa os dar), `fotosExtra` (mais fotografias, por baixo de «Na obra» na ficha) |
| `data/fotos.json` | As fotografias: tamanho do original, origem e texto alternativo. `data/lqip.json` são as prévias (gerado) |
| `src/templates/` | `layout.html` (a cabeça, o cabeçalho e o rodapé de todas as páginas) e `obra.html` (a ficha de cada obra) |
| `src/partials/` | Os componentes: `header` (menu de `site.json`, telefone, WhatsApp, «Pedir Orçamento»; variante `reduzido`), `barra-acoes` (Ligar, WhatsApp e Orçamento, fixa em baixo abaixo de 980 px), `footer`, `page-head` (migalhas, eyebrow, h1, introdução), `cta` (a faixa clay), `prova` (a linha de garantias), `orcamento-form` (o único formulário), `garantias` (a TrustList, inteira na página inicial e condensada em `orcamento.html`), `obra-foto` (cartão de obra) e `antes-depois` |
| `src/pages/` | Página inicial, Obras, Pedir Orçamento (`orcamento.html`, com o formulário), obrigado, 404 e privacidade, cada uma com o seu `<!--meta {...} -->` |
| `assets/css/` | `site.css` (o sistema de desenho), `pag-obras.css`, `pag-paginas.css`, `pag-orcamento.css` (formulário e lateral) |
| `assets/js/site.js` | Menu nos ecrãs estreitos (fundo escurecido, página sem deslizar, Esc), entrada ao fazer scroll, comparador (um toque ou um clique põe a linha, arrasta-se a partir da pega; setas do teclado), em `orcamento.html` o `?tipo=` (tipo escolhido e «Pedido para: X · alterar») e o `?de=` (campo `pagina`), e o envio do formulário: validação em português, `obrigado.html` se correu bem, e se falhar um aviso com o telefone e o WhatsApp (`wa.erro`, com o nome e o tipo escritos) |
| `assets/fonts/` | Fraunces (normal e itálico) e Archivo, variáveis, só latim, com as licenças (SIL OFL). Nada vem de terceiros |
| `assets/img/` | Logótipos, favicons, imagem de partilha e `fotos/` (o original `foto-NN.jpg` e os tamanhos em AVIF e WebP) |
| `tests/` | `site.test.mjs` (o site gerado, sem browser) e `browser.mjs` (Playwright) |
| `netlify.toml` | A publicação: `python3 build.py --check` (um erro pára a publicação e fica a versão anterior), pasta `public`; cache de um ano para o CSS e o JS (levam versão) e as letras, de um dia para as imagens (mudam no mesmo nome); nenhuma página dentro de outro site (`frame-ancestors`) |

A sintaxe dos modelos está no topo de `build.py`: `{{ site.phone }}`, `{{> parcial }}`, `{{> cta titulo="…" texto="…"}}`
(parâmetros declarados no topo do parcial com `<!--parametros {...} -->`), `{{foto 01 sizes="…"}}`, `{{wa geral}}`,
`{{each obra-foto all}}`, `{{#se dados.email}}…{{/se}}`, `{{#cada servicos}}…{{/cada}}`, `{{icone seta}}` (um ícone de
`src/partials/icones.svg`) e `{{li obra.detalhes visto}}` (uma lista com o visto). No `<!--meta {...} -->`,
`"header": "reduzido"` e `"barra": "sem-orcamento"` ou `"nao"` mudam o cabeçalho e a barra de ações.

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
privacidade; o foco de teclado visível; a imagem de partilha da empresa nas fichas com fotografia ao alto.

A idade da empresa («25 anos») calcula-se do ano de fundação em cada geração do site. O Netlify gera o site em cada
publicação; se o site ficar um ano sem mudanças, publicar de novo em janeiro atualiza o número.

## Verificações (`--check`)

Ligações, imagens e `srcset` que existem; `?v=` nos CSS e JS; sem sintaxe de modelo nem placeholders; sem travessões,
emoji ou o telefone escrito de outra forma; `lang`, um só `h1`, título e descrição com tamanho certo, canonical e
`og:image` no domínio; JSON-LD válido com a empresa; o formulário Netlify só em `orcamento.html`, com os atributos, os
campos e as opções de `site.json`; todos os «Pedir Orçamento» (texto ou `aria-label`) a levar a `orcamento.html`; nenhuma ligação para `#contacto` nem para `…index.html` (a página inicial é `./`) e nenhum dos rótulos retirados («Pedir Orçamento Gratuito», «Chamar no WhatsApp», «Orçamento Gratuito» como nome de ligação); `robots.txt`, `_headers` e `netlify.toml` de acordo com `preview`, com o `--check` no comando de publicação e `frame-ancestors`; os comentários tirados ao CSS e ao JS publicados sem partir nada; todas as fotografias com os tamanhos e a
prévia; os dados de `dados-melperfaz.json` com o formato certo (email, NIF, ligação do Google Maps, sem ponto final no alvará, seguro, zona e morada); `fotosExtra` sem repetidas; nenhum dos glifos
que passaram a ícone (→, ≡, ✓, ‹).

E o lint das folhas de estilo, para o sistema visual não voltar a derivar. Fora do bloco `:root` (os tokens), falha com:
espaços (`margin`, `padding`, `gap`, `inset`, `top`/`right`/`bottom`/`left`) em px soltos em vez de `--space-*`;
`font-size` fora dos estilos de texto `--fs-*`; `@media` que não seja a 980 ou a 640 px (as de preferência, como
`prefers-reduced-motion`, passam); texto paper ou branco num seletor de `.s-clay` ou `.btn` sem fundo ink na mesma regra;
qualquer animação `infinite`; e o movimento: durações e curvas que não sejam os tokens `--dur-1`/`--dur-2`/`--dur-3` e
`--ease-out`/`--ease-in-out`, uma duração sem curva, um `--dur-*` acima de 500 ms, ou uma transição de algo que não seja
`transform`, `opacity`, as cores ou `stroke-dashoffset` (nada de `width`, `top` ou `all`). As exceções são só `1px`
(hairline), `env(safe-area-inset-*)` e `0s`.

## Sistema visual (`assets/css/site.css`)

- **Superfícies**: cada secção tem `.s-paper`, `.s-bone`, `.s-ink` ou `.s-clay`, que definem `--fg`, `--fg-2`, `--fg-cat`,
  `--rule`, `--eyebrow-rule`, `--focus-c` e as cores do botão. Os componentes só leem estas variáveis. No clay o texto é
  ink (5,65:1), nunca paper.
- **Botões**: `.btn` (clay com texto ink; ink com texto paper na faixa clay) e um só secundário, `.btn-ghost`, com a
  mesma altura. Grupo `.acoes` (no telemóvel, todos a toda a largura). Ligações: `.link` e `.link-seta`.
- **Texto**: 10 estilos (`--fs-display-hero`, `--fs-section`, `--fs-cta`, `--fs-card`, `--fs-step`, `--fs-list`,
  `--fs-lead`, `--fs-body`, `--fs-category` de 13 px, `--fs-phone`) e `--fs-label` para as etiquetas de formulário.
  Os campos têm 16 px.
- **Grelha**: `.wrap` com 32 px de margem (16 px até 640 px); só duas quebras, 980 e 640 px. Secções com 80 px em cima e
  em baixo (50 até 640 px) e 44 px do SectionHead ao conteúdo (38 até 640 px), um passo de token abaixo do design system,
  para a página inicial ficar em menos de 6.000 px a 390 e até 4.400 a 1440.
- **Cartão de obra** (`obra-foto.html`): a legenda na faixa escura por cima da fotografia, em fluxo (cresce com o texto);
  linhas de 300 px no mínimo em duas colunas e, até 980 px, uma coluna com linhas de 280 px (`--photo-row-1col`). Até
  640 px a legenda passa para baixo da fotografia (4/3 ou 4/5), menos nas obras em destaque da página inicial. O
  cartão inteiro é a ligação.
- **Ícones**: `src/partials/icones.svg` (seta, menu, telefone, WhatsApp, visto, as setas do comparador e o visto num
  círculo de `obrigado.html`), traço de 1,75 em `currentColor`, cantos vivos. `{{icone nome}}` copia o símbolo para a
  página em linha (para o CSS animar as partes) e um nome que não existe pára o build.
- **Movimento**: `--dur-1` 150 ms, `--dur-2` 250 ms, `--dur-3` 500 ms, `--ease-out`, `--ease-in-out` e `--cascata` de
  80 ms. As barras do menu viram X; o painel e o fundo entram com fade; o cabeçalho ganha sombra e um logótipo menor
  depois de 80 px (sem mudar de altura); a entrada ao fazer scroll sobe 16 px em 500 ms, em cascata; os vistos
  desenham-se; as setas avançam 5 px; o telefone abana uma vez; o WhatsApp pulsa duas vezes; as setas do comparador
  afastam-se ao agarrar; as fotografias em lazy load passam da prévia à imagem num fade; o envio mostra um indicador de
  carga (40 voltas de 500 ms, o tempo máximo de espera). Com `prefers-reduced-motion: reduce` as animações e as
  transições acabam logo e nada se desloca; o deslize suave das âncoras só existe sem essa preferência. Sem JavaScript
  tudo fica à vista.

## Testes

```bash
cd melperfaz
npm test                                                    # o site gerado, sem browser (node:test)
NODE_PATH=/caminho/para/node_modules node tests/browser.mjs  # no browser; precisa do Playwright, fora das dependências
```

Os do browser geram o site numa pasta temporária e servem-no num servidor local que guarda cada envio do formulário
como o Netlify o receberia (e pode falhar de propósito): o pedido que segue e abre `obrigado.html`, a validação, o aviso
de falha (foco, telefone, WhatsApp com o nome e o tipo) com o que se escreveu a ficar, o envio sem JavaScript, o tipo de
obra pré-escolhido com «Pedido para:» e o `?de=` no campo `pagina`, o isco para robôs, nenhuma página a deslizar para o
lado a 390 e 320 px, os endereços antigos com `?tipo=` (os nomes de antes do redesenho), o menu dos ecrãs estreitos (também aberto a meio da página), a barra fixa sem tapar o foco ao tabular, o comparador com toque, clique, arrasto e teclado, o foco e as
imagens, nenhuma fotografia ampliada para lá do original (o hero a 375 px, os cartões, a ficha na sua proporção),
nenhuma animação sem fim nem acima de 500 ms, o movimento (o menu que vira X e sai no fim da transição, o
cabeçalho compacto, os vistos em cascata, o fade das fotografias, o indicador de envio, o CLS abaixo de 0,05 e, com
movimento reduzido, nada a animar nem a deslocar-se), e o sistema visual: o h1 do hero e os cabeçalhos de secção no x do logótipo, contraste de
4,5:1 nos botões e na faixa clay, o anel de foco da cor de cada superfície, campos de 16 px e etiquetas de 13 px, a altura da página inicial (menos de 6.000 px a 390, até 4.400 a 1440), a
legenda dos cartões (sobre a fotografia; a 390 px por baixo, menos nas obras em destaque), o cartão inteiro como
ligação, as miniaturas dos serviços com 64 px, os títulos sem uma palavra sozinha na última linha, os botões de cada
grupo com a mesma altura e a barra de ações em terços, sem nada fora do ecrã. O CI
(`.github/workflows/ci.yml`) corre o `--check`, o `npm test` e os testes do browser em cada pull request.

## Fotografias

O original de cada fotografia é `assets/img/fotos/foto-NN.jpg`, registado em `data/fotos.json` com o tamanho, a origem
e o texto alternativo. `python3 gerar_fotos.py` faz os tamanhos em AVIF e WebP (precisa de `pip install "Pillow>=11.3"`)
e as prévias de 16 px de `data/lqip.json`; só faz o que falta, `--todas` refaz tudo. Uma obra nova: juntar a fotografia
(sem dados de localização na EXIF; `obra5.jpg` foi cortada para tirar um contador de gostos), registá-la em `fotos.json`,
correr o `gerar_fotos.py`, juntar a obra a `obras.json` e correr `python3 build.py --check`.

Cada `{{foto}}` leva um `sizes` com a largura a que a fotografia aparece: os cartões pedem 579 px em computador (duas
colunas) e, no telemóvel, mais do que a largura do cartão quando a moldura (4/3 ou 4/5; nas obras em destaque da página
inicial, o cartão de 280 px de altura) corta os lados de uma fotografia mais deitada do que ela (o `build.py` calcula-o
de cada fotografia); num telemóvel de 3x pede-se a de 2x; a fotografia da ficha aparece na sua proporção, até 78% da altura do ecrã, sem corte. O
`foco` de cada obra (`obras.json`) é o ponto que fica à vista nos cortes (na M04, a cabeça do trabalhador), também na
miniatura de 64 px dos serviços, que mostra a primeira obra em destaque de cada serviço (nos Acabamentos a M05, o
assentamento do pavimento, e não o teto branco da M02).
A `foto-05` tem uma faixa preta de 8 px no topo, que já vem no original do sistema de desenho (`obra5.jpg`): fica à
espera da resposta do dono antes de se cortar.

As fotografias, os logótipos, os favicons e a imagem de partilha vêm do sistema de desenho (pasta `assets/` do pacote
«melperfaz-design-system»). Os logótipos foram recortados às linhas de recorte que os PNG traziam e reduzidos a 400 px de
largura.

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

## O que só a Melperfaz pode dar

`python3 build.py --faltam` lista tudo. Hoje: o email da empresa, o NIF, a morada da sede, o número do alvará, o seguro
de responsabilidade civil, a zona onde trabalha, o horário de atendimento, a ligação do Google Maps, e os factos de cada
obra (data, local, duração, resultado). Enquanto faltam, o site esconde a frase ou a linha que os usa; nunca se inventa.
