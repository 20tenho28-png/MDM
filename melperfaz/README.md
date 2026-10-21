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
| `data/site.json` | A empresa: nome, telefone, WhatsApp e as mensagens já escritas, o endereço do site (`baseUrl`), `preview`, os tipos de obra do formulário |
| `data/dados-melperfaz.json` | O que só a Melperfaz pode dar (email, NIF, morada, alvará, seguro, zona, horário, Google Maps). Vazio = a frase ou a linha não aparece |
| `data/obras.json` | As obras: categoria, título, fotografia, o que se vê, os factos (vazios até a empresa os dar) |
| `data/fotos.json` | As fotografias: tamanho do original, origem e texto alternativo. `data/lqip.json` são as prévias (gerado) |
| `src/templates/` | `layout.html` (a cabeça, o cabeçalho, o rodapé e o botão WhatsApp de todas as páginas) e `obra.html` (a ficha de cada obra) |
| `src/partials/` | Cabeçalho, rodapé, WhatsApp, faixa de contacto com o formulário, cartão de obra, comparador antes/depois |
| `src/pages/` | Página inicial, Obras, obrigado, 404 e privacidade, cada uma com o seu `<!--meta {...} -->` |
| `assets/css/` | `site.css` (o sistema de desenho), `pag-obras.css`, `pag-paginas.css` |
| `assets/js/site.js` | Menu nos ecrãs estreitos, entrada ao fazer scroll, comparador, tipo de obra pré-escolhido, envio do formulário sem sair da página |
| `assets/fonts/` | Fraunces (normal e itálico) e Archivo, variáveis, só latim, com as licenças (SIL OFL). Nada vem de terceiros |
| `assets/img/` | Logótipos, favicons, imagem de partilha e `fotos/` (o original `foto-NN.jpg` e os tamanhos em AVIF e WebP) |
| `tests/` | `site.test.mjs` (o site gerado, sem browser) e `browser.mjs` (Playwright) |
| `netlify.toml` | A publicação: `python3 build.py`, pasta `public`, cache de um ano para o que leva versão |

A sintaxe dos modelos está no topo de `build.py`: `{{ site.phone }}`, `{{> parcial }}`, `{{foto 01 sizes="…"}}`,
`{{wa geral}}`, `{{each obra-foto all}}`, `{{#se dados.email}}…{{/se}}`, `{{#cada tipos}}…{{/cada}}`.

## Regras do texto

As do sistema de desenho («Voz e texto»), conferidas pelo `--check` onde dá:

- português de Portugal; tratar o cliente por você sem o pronome («Peça o seu orçamento»); a empresa fala no plural;
- frases curtas e afirmativas, só com factos verdadeiros: «desde 2001», «dois anos de garantia», «no prazo de um dia útil»;
- títulos em frase normal; menu, botões e nomes de serviço em maiúsculas iniciais («Pedir Orçamento»); os botões começam por verbo;
- telefone sempre «961 245 288»; sem emoji; sem travessões (—): vírgulas ou parênteses;
- nunca inventar factos: preços, prazos, números, clientes, locais. O que falta fica vazio em `data/` e escondido no site.

Desvios deliberados em relação ao sistema de desenho: as letras alojadas com o site em vez do Google Fonts; um menu para os
ecrãs estreitos (o botão ≡ entra a 760 px, porque abaixo disso o logótipo, os links e o botão não cabem; o site publicado
escondia os links a 640 px e o botão não abria nada); âncoras em português; os cartões de serviço como ligações para o
formulário com o tipo pré-escolhido; a opção «Acabamentos» no formulário; as páginas Obras, fichas, obrigado, 404 e
privacidade; o foco de teclado visível; a imagem de partilha da empresa nas fichas com fotografia ao alto.

A idade da empresa («25 anos») calcula-se do ano de fundação em cada geração do site. O Netlify gera o site em cada
publicação; se o site ficar um ano sem mudanças, publicar de novo em janeiro atualiza o número.

## Verificações (`--check`)

Ligações, imagens e `srcset` que existem; `?v=` nos CSS e JS; sem sintaxe de modelo nem placeholders; sem travessões,
emoji ou o telefone escrito de outra forma; `lang`, um só `h1`, título e descrição com tamanho certo, canonical e
`og:image` no domínio; JSON-LD válido com a empresa; o formulário Netlify com os atributos, os campos e as opções de
`site.json`; `robots.txt`, `_headers` e `netlify.toml` de acordo com `preview`; todas as fotografias com os tamanhos e a
prévia; os dados de `dados-melperfaz.json` com o formato certo (email, NIF, ligação do Google Maps).

## Testes

```bash
cd melperfaz
npm test                                                    # o site gerado, sem browser (node:test)
NODE_PATH=/caminho/para/node_modules node tests/browser.mjs  # no browser; precisa do Playwright, fora das dependências
```

Os do browser geram o site numa pasta temporária e servem-no num servidor local que guarda cada envio do formulário
como o Netlify o receberia (e pode falhar de propósito): o pedido que segue, a validação, o aviso de falha com o que se
escreveu a ficar, o envio sem JavaScript, o tipo de obra pré-escolhido, o isco para robôs, nenhuma página a deslizar
para o lado a 390 e 320 px, o menu dos ecrãs estreitos, o comparador com rato e teclado, o foco e as imagens. O CI
(`.github/workflows/ci.yml`) corre o `--check`, o `npm test` e os testes do browser em cada pull request.

## Fotografias

O original de cada fotografia é `assets/img/fotos/foto-NN.jpg`, registado em `data/fotos.json` com o tamanho, a origem
e o texto alternativo. `python3 gerar_fotos.py` faz os tamanhos em AVIF e WebP (precisa de `pip install "Pillow>=11.3"`)
e as prévias de 16 px de `data/lqip.json`; só faz o que falta, `--todas` refaz tudo. Uma obra nova: juntar a fotografia
(sem dados de localização na EXIF; `obra5.jpg` foi cortada para tirar um contador de gostos), registá-la em `fotos.json`,
correr o `gerar_fotos.py`, juntar a obra a `obras.json` e correr `python3 build.py --check`.

As fotografias, os logótipos, os favicons e a imagem de partilha vêm do sistema de desenho (pasta `assets/` do pacote
«melperfaz-design-system»). Os logótipos foram recortados às linhas de recorte que os PNG traziam e reduzidos a 400 px de
largura.

## Publicar no Netlify

1. No painel do site, ligar o repositório GitHub e pôr **Base directory** = `melperfaz`. O `netlify.toml` desta pasta
   faz o resto: `python3 build.py` e a pasta `public`.
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
