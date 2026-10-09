# Site da MDM Assistência Técnica

Site estático em português europeu para a MDM (ar condicionado, bombas de calor, ventilação, eletricidade e manutenção na grande Lisboa, desde 1991). Substitui o `index-carmim.html`: mesma lógica de pedidos, triagem e medição, novo desenho feito a partir das fotografias reais das obras.

## Gerar

```bash
python3 website/build.py            # gera website/public/
python3 website/build.py --check    # gera e valida ligações, recursos, sintaxe, placeholders e decisões do dono
python3 website/build.py --faltam   # lista os dados que só a MDM pode dar (não falha)
```

Só precisa de Python 3.11+ (biblioteca padrão). `public/` não entra no git: é sempre gerado.

Pré-visualizar: abrir `website/public/index.html` no browser, ou `python3 -m http.server -d website/public 8000`.

### Cache do CSS e do JavaScript (`?v=`)

O `build.py` escreve as ligações ao CSS (`site.css` do layout e o CSS de cada página) e ao `site.js` com `?v=<8 caracteres do sha1 do ficheiro>`, por exemplo `assets/css/site.css?v=e4bb77b5`. Quando o ficheiro muda, muda o `?v=` e o browser vai buscar a versão nova; por isso o `netlify.toml` deixa `/assets/css/*` e `/assets/js/*` um ano em cache (`immutable`), como as imagens e as letras. Não há nada a fazer à mão: basta gerar. O `--check` ignora o `?v=` ao confirmar que o ficheiro existe.

## Publicar

Qualquer alojamento estático serve, **servido na raiz do domínio** (a página 404 usa caminhos absolutos porque é mostrada em qualquer profundidade). Netlify: diretório base `website` (o `netlify.toml` já tem o comando e a pasta). O domínio é `https://www.mdmassist.com.pt` (`baseUrl` em `data/site.json`): dele saem o endereço canónico, `og:url`, `og:image`, o mapa do site, o `robots.txt` e os dados estruturados. Antes de publicar, ver a lista de `--faltam` (abaixo).

### Pré-visualização (até ao lançamento)

Enquanto `data/site.json` tiver `"preview": true`, o site pede aos motores de busca para não o indexar, em três sítios ao mesmo tempo:

- `<meta name="robots" content="noindex">` em todas as páginas;
- `public/_headers`, gerado pelo `build.py`, com `X-Robots-Tag: noindex` para todos os endereços (o Netlify junta-o aos cabeçalhos do `netlify.toml`, que não aceita condições);
- `robots.txt` com `Disallow: /`.

`--check` confirma que os três estão lá. A imagem de partilha só aparece no WhatsApp ou no Facebook quando o domínio já abrir este site.

### Lançamento: desligar a pré-visualização

1. Ligar `www.mdmassist.com.pt` (e o domínio sem `www`, a redirecionar para ele) ao projeto Netlify e esperar pelo certificado HTTPS. Não mexer nos registos de email do DNS.
2. Em `data/site.json`, passar `"preview": true` a `"preview": false`. Mais nada muda: `robots.txt` passa a `Allow: /` com a linha `Sitemap:`, `_headers` deixa de ser gerado e as páginas voltam a `index,follow` (a 404 e `obrigado.html` continuam `noindex`, de propósito).
3. `python3 website/build.py --check` tem de passar (falha se sobrar algum `noindex` ou se `baseUrl` não for o domínio final). Fazer commit e esperar pelo deploy.
4. Confirmar: `curl -I https://www.mdmassist.com.pt/` já não mostra `X-Robots-Tag`, e `https://www.mdmassist.com.pt/robots.txt` mostra `Allow: /`.
5. Na Google Search Console, enviar `https://www.mdmassist.com.pt/sitemap.xml`. No Perfil da Empresa no Google, pôr `https://www.mdmassist.com.pt` como site.

### Dados para o Google

Todas as páginas levam a empresa em JSON-LD (`HVACBusiness` e `Electrician`): nome legal, NIF, morada, telefone, email, horário, área servida (Lisboa e Grande Lisboa), ano de fundação, logótipo, imagem, frase e a ligação ao Perfil da Empresa no Google (`googleMaps` em `data/site.json`, também no rodapé). Cada serviço tem ainda o seu `Service` com a lista do que inclui. Sem classificações nem número de avaliações: não as temos. A imagem de partilha (`assets/img/og-mdm.jpg`, 1200×630; nome novo porque `assets/img/` tem cache de um ano e a imagem antiga mostrava um técnico) mostra o logótipo, a frase, o telefone e o camião com a matrícula desfocada; as páginas de obra partilham a fotografia da obra.

## Estrutura

| Onde | O quê |
|---|---|
| `data/site.json` | Domínio (`baseUrl`), pré-visualização (`preview`), Perfil da Empresa no Google (`googleMaps`), contactos, horário, NIF, nome legal, marcas, mensagens de WhatsApp pré-preenchidas (sem etiquetas: a triagem `[P1 · …]` vai só no campo escondido e no assunto do email, postos por `site.js`), números da estimativa de potência do formulário (`btu`). O rodapé e o contacto usam a mensagem da página: `wa` no `<!--meta-->` de cada serviço, `geral` nas outras; a barra do telemóvel e o topo das páginas de serviço usam sempre `geral` e `avaria` |
| `data/obras.json` | As 24 obras: título, especialidade, equipamento, texto, pormenores e factos (data, local exato, cliente, duração e resultado numa frase: só aparecem na ficha quando preenchidos; o resultado aparece também no diapositivo da obra na página inicial) e, se a fotografia ficar mal cortada no cartão, `foco` (ex.: `"50% 22%"`, o ponto que fica à vista). O serviço de cada obra é calculado pelo `build.py` a partir da `especialidade` (ver «Obras por serviço») |
| `data/precos.json` | Preço provável do formulário (montagem de ar condicionado e bomba de calor para águas quentes), copiado à mão da folha «MDM, tabela de preços para o site». Começa vazio; vazio = escondido (ver «Preço provável») |
| `data/dados-mdm.json` | Dados que só a MDM pode dar (números das certificações, testemunhos, nota e avaliações do Google, unidades por ano, contratos ativos, garantia, seguro, preços indicativos, concelhos, perguntas por responder, privacidade). Vazio = escondido no site |
| `src/templates/layout.html` | Cabeçalho `<head>`, estrutura comum (topo, barra das estatísticas, rodapé, barra do telemóvel) |
| `src/partials/` | Cabeçalho e menu em gaveta, rodapé (com a política de privacidade e o Livro de Reclamações Eletrónico), barra fixa do telemóvel, barra das estatísticas (`consentimento.html`), contacto + formulário, certificações, testemunhos, cartões de obra |
| `src/pages/` | Página inicial (ver «Página inicial»), obras, 5 serviços (ar condicionado, bombas de calor, manutenção, eletricidade, ventilação), privacidade, 404, `obrigado.html` (depois de enviar o formulário sem JavaScript). Cada serviço descreve-se no `<!--meta-->` em `servico` (nome, tipo e ofertas) para os dados estruturados `Service` |
| `src/templates/obra.html` | Modelo das 24 páginas de obra (`obras/<slug>.html`) |
| `assets/css/site.css` | Sistema visual completo e movimento |
| `assets/js/site.js` | Estatísticas (PostHog UE, sem cookies, só depois de «Aceitar»), formulário (envio para o Netlify, estimativa de potência), gaveta, carrossel, faixa das marcas, filtros, revelação |
| `assets/fonts/` | Archivo e Newsreader alojadas no site (licença OFL incluída): nenhum pedido ao Google |
| `assets/img/obras/` | Fotografias com correção de cor ligeira: o original `foto-NN-1600.jpg` e os tamanhos 400 a 1600 em AVIF e WebP (ver «Fotografias das obras») |
| `gerar_fotos.py` | Faz os tamanhos AVIF e WebP das fotografias a partir do JPEG de 1600 |
| `equipa/`, `netlify/`, `data/precos-teste.json`, `package.json`, `tests/` | Assistente de propostas da equipa (uso interno, fora do site): ver «Assistente de propostas» |

## Página inicial

`src/pages/index.html`, de cima para baixo:

1. **Topo «Central»**: a obra F03 (sete unidades exteriores numa central técnica em cave) a toda a largura, com o texto por cima, num véu azul-noite. Em cima, «Lisboa · 38,7° N» e o horário com o telefone; o h1 é «Ar condicionado em Lisboa · desde 1991» (linha pequena, a palavra-chave) e «Vemos o local antes de dar preço.»; um parágrafo e os dois botões (orçamento e avaria por WhatsApp); em baixo, por cima de um filete, três pares (Cinco ofícios, Orçamento, Certificação), a nota do Google se existir, a legenda da fotografia com ligação à obra F03 e «Ver serviços ↓». No computador o véu vai da esquerda (escuro, onde está o texto) para a direita (claro, onde as máquinas se leem); no telemóvel e com o ecrã ao alto é vertical e o texto fica em baixo: título, parágrafo e os dois botões cabem no primeiro ecrã, por cima da barra fixa. No computador o topo mede um ecrã menos o cabeçalho; na primeira visita, enquanto a barra das estatísticas está em baixo, acaba onde ela começa (`--consent-h`, medida pelo `site.js`), para a linha de dados não ficar tapada. Todos os textos passam 4,5:1 contra o pixel mais claro da fotografia por baixo deles. A fotografia é a única imagem que carrega logo (`loading="eager"`, `fetchpriority="high"`); o `sizes` pede-a à largura do ecrã deitado e, ao alto, onde fica cortada à altura do primeiro ecrã, a 4/3 dessa altura (`110vh`). Estilos em `site.css`, «Topo Central».
2. **Faixa de dados**: 1991, Grande Lisboa e o telefone; com os dados preenchidos, também a nota do Google, as unidades instaladas por ano, os contratos de manutenção ativos e os concelhos (por baixo de «Grande Lisboa»).
3. **Portas** (`<nav aria-label="O que precisa">`): «Tenho uma avaria», «Quero instalar» e «Manutenção». Cada uma leva ao formulário com o serviço já escolhido (`data-preselect`, lido pelo `site.js` ao clicar ou com Enter); sem JavaScript vão só ao formulário.
4. **Testemunhos** (escondidos enquanto não houver nenhum).
5. **O que ouvimos**, 6. **Especialidades** (com a linha «Preço indicativo» nos cartões Ar condicionado e Manutenção, se a MDM publicar preços), 7. **Obras** (carrossel; cada diapositivo mostra o resultado da obra, se existir), 8. **Como trabalhamos** (com a fotografia do camião com a plataforma elevatória, que antes estava no topo, e a legenda com ligação à obra F17, o mesmo pavilhão), 9. **Certificações** (com a garantia da instalação e o seguro, se existirem), 10. **Contacto** (com os concelhos por baixo da morada e, junto ao botão do formulário, «Instalação com garantia.» e «Com seguro de responsabilidade civil.» se a garantia e o seguro existirem; as frases completas ficam nas certificações).

A linha a prumo (`[data-prumo]`) desenha-se de «O que ouvimos» ao formulário.

**Dados opcionais juntos numa linha.** Um bloco `{{#se}}` dentro de outro é «um e outro» (a nota do Google só aparece com o número de avaliações). Para «um ou outro» (a linha «Preço indicativo» aparece com qualquer dos dois preços do cartão; o bloco da garantia e do seguro nas certificações, com qualquer dos dois) o `build.py` calcula chaves em `DADOS_OU`: `precosAC`, `precosManutencao` e `garantias`. Não se preenchem e não aparecem em `--faltam`; o que aparece são os dados de que dependem.

## Marcas (logótipos)

Na faixa das certificações (`src/partials/certificacoes.html`: página inicial e as cinco páginas de serviço), por baixo dos selos APIRAC, IMPIC e F-gas, «Multimarca, peças originais» e os logótipos reais das quatro marcas, pela ordem de `marcas` em `data/site.json`: Midea, Mitsubishi Electric, Daikin, France Air. Só estas quatro podem aparecer no site (`--check` falha com outra marca).

```json
"marcas": [
  {"nome": "Midea", "logo": "assets/img/marcas/midea.svg", "w": 487, "h": 193, "escala": 1.2},
  {"nome": "Mitsubishi Electric", "logo": "assets/img/marcas/mitsubishi-electric.svg", "w": 357, "h": 109, "escala": 1.05},
  {"nome": "Daikin", "logo": "assets/img/marcas/daikin.svg", "w": 1899, "h": 378, "escala": 0.72},
  {"nome": "France Air", "logo": "assets/img/marcas/france-air.png", "w": 900, "h": 141, "escala": 0.7}
]
```

- **`logo`** (com `w` e `h`, a largura e a altura do ficheiro; num SVG, os dois últimos números do `viewBox`): mostra o logótipo, com o nome da marca como texto alternativo. Os ficheiros estão em `assets/img/marcas/`, com as cores originais: nunca se pintam, esticam, cortam ou enfeitam.
- **`simbolo`**, sem `logo`: o símbolo e, ao lado, o nome em texto (Archivo).
- **Só `nome`**: o nome em texto, sem imitar o logótipo da marca.
- **`escala`** (opcional, 1 por omissão, entre 0,5 e 2): acerta a altura de uma marca para as quatro parecerem do mesmo tamanho (um logótipo largo e cheio, como o da Daikin ou o da France Air, fica mais baixo; um com letras pequenas, como o da Midea ou o da Mitsubishi Electric, mais alto). A altura de base é 28 px no telemóvel e 34 px a partir de 768 px (`--marca-h` em `site.css`).

**Ficheiros.** Os quatro são os logótipos reais, com as cores originais: Daikin vetorizado de um original de 1920 px, Midea tirado de um ficheiro vetorial, Mitsubishi Electric (símbolo oficial dos três diamantes e o nome redesenhado da imagem do dono) e France Air (a imagem do dono, PNG transparente de 900 px). O da France Air vai **sem a assinatura «Os Arquitectos do Ar»**: o dono não a quer no site, e `--check` falha se ela aparecer numa página ou dentro de um SVG. Para trocar ou juntar uma marca: pôr o ficheiro em `assets/img/marcas/` e mudar `logo`, `w` e `h` (e `escala`, se precisar); mais nada muda. Um logótipo novo leva sempre um nome de ficheiro novo (por exemplo `france-air-2.png`), nunca o mesmo nome: o `netlify.toml` guarda `assets/img/` um ano em cache, e quem já visitou o site continuaria a ver o antigo. `--check` falha também se um ficheiro não existir, se faltar `w` ou `h` ou se não baterem com o ficheiro (num SVG, a proporção do `viewBox`; num PNG, o tamanho em píxeis): o logótipo ficaria esticado.

**A faixa.** Com JavaScript, os logótipos deslizam devagar (cerca de 34 px por segundo), com as pontas esbatidas. O `site.js` junta cópias da lista para a volta não ter buracos; as cópias ficam escondidas dos leitores de ecrã e do teclado (`aria-hidden`, `inert`, imagens sem texto alternativo), que leem cada marca uma vez. A faixa para com o botão «Pausa» / «Continuar» (WCAG 2.2.2; o texto diz o que o botão faz), com o rato ou o foco em cima dela e quando sai do ecrã (para não gastar processador). Sem JavaScript (ou se o `site.js` falhar), ou com «reduzir movimento» no sistema, é uma linha fixa (que quebra no telemóvel), sem cópias nem botão. Estilos em `site.css`, «Marcas»: as classes da faixa começam todas por `marcas-` (`.marcas-item`, `.marcas-logo`, `.marcas-simbolo`, `.marcas-nome`), porque `.marca`, `.marca-logo` e `.marca-nome` são do logótipo MDM no topo.

## Obras por serviço

Cada obra tem um serviço (`serv`), calculado pelo `build.py` (`SERV`) a partir da `especialidade` de `data/obras.json`: Ar condicionado e «Ar condicionado e ventilação» → `ar-condicionado`; Ventilação → `ventilacao`; Manutenção → `manutencao`; Eletricidade → `eletricidade`; Bombas de calor → `bombas-de-calor`. Qualquer outra especialidade (hoje Climatização, F29, e Águas quentes, F14) fica em `outros`: a obra aparece em «Todas», mas sem ligação a uma página de serviço.

- **Filtros de `obras.html`**: um por serviço, com a contagem calculada pelo `build.py` (`serv_n`): Todas 24, Ar condicionado 15, Ventilação 3, Manutenção e avarias 2, Eletricidade 1, Bombas de calor 1. `obras.html#ar-condicionado` (e os outros) abre a página já filtrada; as páginas de serviço ligam para lá em «Todas as obras de …». Os cartões levam o serviço em `data-cat`, que o `site.js` lê.
- **Página da obra** (`src/templates/obra.html`): a «Especialidade» da ficha liga à página do serviço (texto simples nas de `outros`); a faixa «Quer uma obra assim?» (ou «Tem uma avaria parecida?», nos trabalhos de Reparação e Diagnóstico) leva ao formulário da página do serviço, já com o serviço escolhido, e ao WhatsApp com a mensagem a dizer o código da obra («Vi a obra F09 no site…»); as três obras relacionadas são primeiro as do mesmo serviço, depois as do mesmo tipo de local, depois as outras. Tudo isto são campos calculados por `campos_obra()` no `build.py` (`serv`, `servLabel`, `servicoUrl`, `orcamentoHref`, `waHref`, `ctaTitulo`, `relTitulo`, `relLigacao`, `relHref`, `fotoSizes`); em `obras.json` não há nada a preencher.

## Fotografias das obras

Cada obra tem um original, `assets/img/obras/foto-NN-1600.jpg` (1600×1200, ou 1200×1600 ao alto), já com a correção de cor e o corte finais e sem dados de localização. É também a reserva para browsers antigos e a imagem de partilha da página da obra. A partir dele, `gerar_fotos.py` faz seis tamanhos, pelo lado maior (400, 600, 800, 1000, 1200 e 1600), em AVIF e em WebP:

```bash
pip install "Pillow>=11.3"
python3 website/gerar_fotos.py        # só o que falta; --todas refaz tudo; 31 32 só estas obras
```

O `{{foto NN …}}` do `build.py` escreve um `<picture>` com os três formatos, `width`/`height` e um `sizes` à medida de cada sítio (cartão, carrossel, topo de serviço, página da obra). O browser escolhe o tamanho; o visor de ecrã inteiro pede outro, à medida do ecrã. Nos telemóveis com ecrã de 3x pede-se a imagem de 2x, como no topo da página inicial: à vista é igual e pesa metade. Só as imagens do primeiro ecrã carregam logo (`loading="eager"`; na grelha de `obras.html` as 8 primeiras); as outras esperam pela rolagem.

Enquanto uma fotografia descarrega, o cartão mostra uma prévia de 16 px da mesma fotografia (`data/lqip.json`, feita pelo `gerar_fotos.py`), em vez de um rectângulo vazio. Uma obra nova: pôr o `foto-NN-1600.jpg` na pasta, correr `gerar_fotos.py` e depois `build.py --check`, que falha se faltar algum tamanho. Na página inicial, num telemóvel, as fotografias pesam cerca de 0,7 MB (antes 2,5 MB).

## Formulário de orçamento (Netlify Forms)

O formulário (`src/partials/contacto.html`, em todas as páginas que o têm) é um formulário Netlify com o nome `orcamento`. O título é «Peça orçamento ou assistência.»: serve para pedir uma obra e para comunicar uma avaria. O Netlify encontra-o no HTML gerado e guarda cada pedido em **Forms** no painel do projeto. Campos: `nome`, `email`, `telefone`, `servico`, `mensagem`, `fotografia` (opcional, uma imagem até 8 MB, o limite do Netlify por pedido) e os escondidos `pagina` (de onde foi enviado), `triagem` (`[P1 · Montagem AC]`…), `potencia` (a estimativa de potência, se o visitante a juntar), `estimativa` (o preço provável que o visitante viu, ver «Preço provável») e `subject` (o assunto do email de aviso, com a triagem). `bot-field` é a armadilha para robôs (`netlify-honeypot`). `--check` falha se o formulário de alguma página perder um destes campos ou atributos.

- **Com JavaScript**, `site.js` valida (nome e um email ou telefone, este com pelo menos 9 algarismos; fotografia até 8 MB e só imagens), envia para `/` sem sair da página e, no fim, esconde o formulário e mostra o painel de confirmação (`.form-feito`, logo a seguir ao `</form>`): «Pedido enviado. Obrigado.», para que contactos vamos responder, o telefone para urgências, um botão para juntar fotografias por WhatsApp (já com o nome do visitante na mensagem) e «Enviar outro pedido», que volta a mostrar o formulário limpo. Sem prazos de resposta. Se o painel não existir na página, `site.js` volta ao aviso dentro do formulário. Se o envio falhar (rede, tempo, serviço), nada se apaga: a mensagem oferece telefone e WhatsApp, este já com o pedido escrito.
- **O serviço** (`<select id="qServico">`) está agrupado em «Avaria ou reparação», «Instalação ou substituição» e «Manutenção», com textos em linguagem corrente. Os `value` são as chaves que o `site.js` usa (triagem, frases do WhatsApp) e não mudam: `Ar condicionado: avaria / reparação`, `Bomba de calor: avaria / reparação`, `Eletricidade: avaria / reparação`, `Ventilação: avaria / reparação`, `Ar condicionado: montagem / instalação`, `Bomba de calor: instalação / manutenção`, `Ventilação: instalação / revisão`, `Eletricidade: quadros e alimentações AVAC`, `Manutenção preventiva: contrato anual`, `Outro / vários serviços`. Para mudar um texto visível, muda-se só o que está entre `<option>` e `</option>`.
- **Sem JavaScript**, o envio é normal e o Netlify mostra `obrigado.html` (fora do mapa do site, `noindex`).
- O botão **Enviar por WhatsApp** continua ao lado, com o mesmo pedido validado; a fotografia junta-se na conversa.
- No ficheiro único para o cliente (aberto do disco, sem servidor), o formulário volta ao email do visitante e ao WhatsApp, e o campo da fotografia não aparece.
- **«Não sabe a potência do ar condicionado? Calcule por divisão»**: bloco opcional e fechado dentro do formulário (só com JavaScript), visível quando ainda não há serviço escolhido ou o serviço é a instalação de ar condicionado. Se o visitante calcular e não carregar em «Juntar ao pedido», o `site.js` junta a estimativa sozinho ao enviar. Por divisão: tipo, área e «Muito sol ou janelas grandes» / «Último andar ou sótão». Conta `área × porM2 × fator do tipo × sol × último andar` e arredonda ao tamanho de aparelho que serve, com uma folga de 10% (`folga`: 12 100 BTU/h fica num aparelho de 12 000, não salta para 18 000); acima do maior, diz que a MDM dimensiona na visita. Os números estão em `data/site.json`, em `btu` (`porM2`, `tipos`, `sol`, `ultimoAndar`, `tamanhos`, `folga`, `btuPorKw`, `areaMin`, `areaMax`, `maxDivisoes`): mudam-se aí, sem mexer no código, e `--check` confirma que são válidos. «Juntar ao pedido» põe o resumo no campo `potencia` (por exemplo `Quarto 12 m² (muito sol): 7 000 BTU/h · Sala 25 m²: 12 000 BTU/h · Total 19 000 BTU/h (5,6 kW)`), que acompanha as mudanças até «Retirar»; sem serviço escolhido, escolhe a montagem de ar condicionado. O resumo vai também no email e no WhatsApp; nas estatísticas vão só o número de divisões e o total. A página do ar condicionado tem uma ligação que abre o bloco.

### Preço provável

Logo a seguir à estimativa de potência, dentro do formulário, o visitante pode ver um intervalo de preço provável (máquina e montagem, com IVA, em euros inteiros) para a **montagem de ar condicionado** (split para uma divisão, multi-split para 2 a 4) e para a **bomba de calor para águas quentes** (depósito de 200 L ou 300 L). Os valores estão em `data/precos.json` e vêm da folha da MDM «MDM, tabela de preços para o site» (abas Como preencher, Split 1 divisão, Multi-split, Extras, Águas quentes, O que inclui): copiam-se à mão quando a MDM a preencher. **Nada se inventa: o ficheiro começa vazio e, enquanto estiver vazio, nada disto aparece** (o bloco fica escondido, não há perguntas nem medição e o campo `estimativa` segue vazio).

O ficheiro (`_leia` explica-o em português):

| Chave | O quê |
|---|---|
| `split.<tamanho>` | Split para uma divisão, por tamanho de aparelho. Os tamanhos são os de `btu.tamanhos` em `data/site.json` (7000, 9000, 12000, 18000, 24000): se mudarem lá, mudam aqui (`--check` falha se faltar algum) |
| `multisplit.2`, `.3`, `.4` | Multi-split para 2, 3 e 4 divisões, com divisões até 12 000 BTU/h |
| `multisplit.acrescimoGrande` | Soma-se por cada divisão com mais de 12 000 BTU/h |
| `extras.metrosIncluidos` | Metros de tubagem e calha incluídos no preço base (um número de metros, não euros) |
| `extras.metroExtra` | Por metro a mais (por divisão) |
| `extras.preInstalacaoDesconto` | Desconto por máquina interior com a pré-instalação já feita (um por divisão; no multi-split, um por máquina interior) |
| `extras.furoBetao` | Por furo em betão ou pedra (um por divisão) |
| `extras.alturaEscada`, `alturaAndaime`, `alturaPlataforma` | Trabalho em altura, por obra |
| `extras.ligacaoEletrica` | Ligação elétrica nova a partir do quadro, por circuito (conta-se um) |
| `extras.retirarAntiga` | Retirar uma máquina antiga, por máquina |
| `aguasQuentes.200`, `.300` | Bomba de calor para águas quentes, por tamanho de depósito |
| `inclui.split`, `.multisplit`, `.aguasQuentes` | A frase do que o preço base inclui (aba «O que inclui»), mostrada ao cliente |

Cada linha tem duas gamas: `eco` («Gama económica (ex.: Midea)») e `sup` («Gama superior (ex.: Mitsubishi Electric, Daikin)»); só se escrevem estas marcas. Cada preço é `null` ou `[mínimo, máximo]`, números inteiros sem aspas, com o mínimo menor ou igual ao máximo (os extras também). `--check` falha se a estrutura mudar, se um preço vier noutro formato, se o mínimo passar o máximo ou se os tamanhos do split não forem os de `btu.tamanhos`; `--faltam` diz se a tabela está vazia ou preenchida em parte.

**O que aparece.** O bloco só aparece com o serviço «Ar condicionado: instalação ou substituição» ou «Bomba de calor: instalação», e só com os dados de que a resposta precisa:

- um produto aparece só com a sua linha (ou linhas) e a sua frase de `inclui` preenchidas; uma gama vazia não aparece (fica só a outra);
- uma pergunta extra aparece só com o seu preço (a da distância precisa também de `metrosIncluidos`; em «Onde fica a máquina de fora?» cada opção de altura aparece só com o seu preço);
- **ar condicionado**: usa as divisões da estimativa de potência. Sem nenhuma área escrita, o bloco pede-a (com uma ligação que abre a estimativa). 1 divisão: a linha do split do seu tamanho. 2 a 4: a linha do multi-split desse número de divisões, mais `acrescimoGrande` por cada divisão acima de 12 000 BTU/h; com as linhas do split de todas as divisões preenchidas, junta «Com uma máquina para cada divisão: X a Y €» (a soma dessas linhas, com os mesmos extras). Uma divisão acima do maior tamanho (a estimativa diz «a dimensionar na visita»), mais de 4 divisões ou uma linha que falte: «Para este caso o preço dá-se depois da visita, que é gratuita.»;
- **bomba de calor**: «Tamanho do depósito» 200 L / 300 L / Não sei («Não sei», só com as duas linhas, mostra os dois). Sem extras.

**As perguntas do ar condicionado** (escolhas de 44 px; sem resposta, não contam): «Já tem pré-instalação (tubos na parede)?» (Sim tira o desconto por divisão); «Distância entre a máquina de dentro e a de fora» (até os metros incluídos, cerca de +5 m, cerca de +10 m, «Mais do que isso», que conta +10 m e diz «a confirmar na visita»; com várias divisões, a distância de cada uma, em média); «A parede é de betão ou pedra?» (um furo por divisão); «Onde fica a máquina de fora?» (chão ou varanda; fachada até ao 1.º andar, escada grande; fachada mais alta, do menor mínimo ao maior máximo de andaime e plataforma); «Precisa de ligação elétrica nova a partir do quadro?» (um circuito); «Há máquinas antigas para retirar?» (0 a 4). «Não sei» soma 0 ao mínimo e o preço todo ao máximo. Um desconto baixa o mínimo pelo desconto maior e o máximo pelo menor; nenhum preço desce abaixo de 0.

**O resultado**, recalculado a cada mudança (sem botão): por gama, «Gama económica (ex.: Midea): entre 1 050 € e 1 400 €» (espaço inseparável nos milhares e antes de «€»), depois a frase de `inclui`, depois «Preço com IVA. O preço final fica fechado depois da visita, que é gratuita.» O leitor de ecrã ouve o preço quando para de mudar (`aria-live="polite"`).

**Com o pedido.** O preço que o visitante vê segue sozinho, como a estimativa de potência quando é junta ao enviar: no campo escondido `estimativa` (posto a cada mudança e outra vez ao enviar), numa linha do email (`mailto`, no ficheiro único) e na mensagem de WhatsApp: «Preço provável mostrado: Gama económica 1 050–1 400 €; Gama superior 1 300–1 750 € (split 12 000 BTU/h, pré-instalação: não, distância: até 3 m)». As respostas às perguntas não são campos do formulário: só segue este resumo. Na medição (só depois de «Aceitar»), `preco_mostrado` uma vez por produto, com o serviço, o número de divisões e as gamas mostradas.

**O que a MDM tem de fazer no Netlify** (uma vez, depois da primeira publicação):

1. **Forms → Enable form detection** e voltar a publicar (o Netlify só procura formulários depois disto).
2. **Forms → Form notifications → Add notification → Email notification**: o email que recebe os pedidos (**falta saber qual**: `mdmassist@mdmassist.com` ou outro).
3. Enviar um pedido de teste com fotografia e confirmar que chega ao email e aparece em **Forms**. Apagar depois o pedido de teste.

O filtro de spam do Netlify está ligado por omissão; os pedidos marcados como spam ficam em **Forms → Spam**, convém espreitar de vez em quando.

## Assistente de propostas (uso interno da equipa)

Uma página com senha, `/equipa/proposta.html`, para responder ao «quanto custa?» e preparar a **proposta modelo** do cliente, com texto para copiar (email, WhatsApp) e PDF em A4 («Guardar PDF» abre a impressão do browser: escolher «Guardar como PDF»). Não aparece no site: sem ligações, sem estatísticas, `noindex` na página e no cabeçalho (`netlify.toml`) e `Disallow: /equipa/` no `robots.txt`.

**Três caminhos, do mais barato ao mais caro:**

1. **Formulário (custo zero, sem IA).** Serviço, divisões (tipo, área, sol, último andar), as perguntas que mudam o preço (vêm da tabela) e os dados do cliente. A proposta atualiza-se sozinha a cada mudança. Funciona mesmo sem a chave da API.
2. **«Preencher com IA» (cêntimos por mês).** Cola-se a mensagem do cliente e o Claude Haiku passa-a para os campos do formulário, com a lista do que falta perguntar ao cliente. A equipa confirma antes de enviar. Telefones, emails, NIF e códigos postais são cortados antes de o texto sair. Se a leitura falhar (sem chave, sem rede, texto confuso), aparece o aviso e preenche-se à mão: nada se perde.
3. **Assistente completo (o recurso para casos complexos).** Quando o caso sai do que a tabela cobre (mais de 4 divisões, uma divisão acima do maior aparelho, outro tipo de trabalho, produto ainda sem preços, ou um pedido que a IA marcou como fora do normal), o formulário mostra porquê e oferece «Passar para o assistente completo», que abre a conversa (Claude Opus) já com os dados. É o caminho mais caro (alguns cêntimos por conversa), por isso só se usa quando é preciso.

**A IA nunca faz contas.** Os números saem de `netlify/lib/calculo.mjs`, com as mesmas regras e os mesmos dados do formulário do site (`btu` em `data/site.json` e `data/precos.json`, ver «Preço provável»). No assistente completo, o modelo chama as ferramentas `calcular_potencia`, `calcular_preco` e `preparar_proposta` e repete o que elas devolvem. A proposta é sempre montada pela função a partir desses números. As notas passam pelas regras do dono (sem prazos de resposta, sem «N anos», só as quatro marcas, sem travessões): uma nota que falhe fica de fora.

**As regras do preço estão em dois sítios** (`assets/js/site.js` para o formulário do site, `netlify/lib/calculo.mjs` para o assistente). Quem mudar uma tem de mudar a outra; `tests/paridade.mjs` compara os dois em 67 casos com a tabela de teste e falha se derem resumos diferentes.

**Como funciona.** A página fala com a função `netlify/functions/proposta.mts` em `/api/proposta`, com o campo `acao`: `tabela` e `calcular` (formulário, sem IA), `ler` (Haiku, `claude-haiku-5-5`, esforço `low`, saída em JSON com esquema fixo) e, sem `acao`, a conversa (`claude-opus-5-5`, esforço `medium`, com `fallbacks: "default"` para o caso de o modelo recusar um pedido). Na conversa, cada pedido HTTP faz uma só chamada ao modelo; quando o modelo pede contas, a função faz-as e a página volta a chamar até ao fim da resposta, para nenhum pedido se aproximar do limite de 60 s das funções. O formulário, a conversa e as propostas vivem no separador (`sessionStorage`); fechar o separador apaga-os. Limite: 120 pedidos por minuto por IP.

**Custos (estimativa, a confirmar com o uso real):** formulário 0 €; «Preencher com IA» cerca de 0,0004 € por pedido (menos de 0,20 € por mês com 300 propostas); assistente completo cerca de 0,10 a 0,30 € por conversa. A API da Anthropic não tem plano gratuito: carregamento mínimo de 5 $ na consola.

**Ligar no Netlify** (Site configuration → Environment variables, âmbito **Functions**), e depois voltar a publicar:

| Variável | O quê |
|---|---|
| `MDM_EQUIPA_SENHA` | A senha que a equipa escreve na página. Obrigatória |
| `ANTHROPIC_API_KEY` | Chave da API da Anthropic (console.anthropic.com), para «Preencher com IA» e o assistente completo. Sem ela, o formulário funciona e os botões de IA avisam que não está ligada |
| `MDM_PRECOS` | `teste` para experimentar com `data/precos-teste.json` (números falsos e redondos; cada proposta sai com «VALORES DE TESTE · NÃO ENVIAR AO CLIENTE»). Apagar a variável quando a tabela real estiver preenchida |

Com `precos.json` vazio (hoje) e sem `MDM_PRECOS=teste`, o formulário calcula potências mas avisa que ainda não há preços. O `package.json` só existe para a função (o site continua a ser gerado só com Python); o Netlify instala as dependências sozinho.

**Testes** (a partir de `website/`): `npm install && node tests/funcao.mjs` (a função contra uma API falsa, sem chave nem rede: senha, formulário sem chave, leitura com o Haiku e o corte de telefones e emails, leituras falhadas, casos complexos, conversa, proposta, notas recusadas); `tests/paridade.mjs` precisa do Playwright (ver o cabeçalho do ficheiro). `build.py --check` valida também `precos-teste.json` e as páginas de `equipa/`.

## Estatísticas e consentimento

O PostHog (instância europeia, `persistence: 'memory'`, sem cookies nem perfis) **só carrega depois de o visitante carregar em «Aceitar»**. Até lá, o site não faz nenhum pedido ao PostHog.

- **A pergunta.** Uma barra pequena no fundo do ecrã (`src/partials/consentimento.html`): uma frase, «Aceitar» e «Recusar» com o mesmo peso e a ligação para a política. No telemóvel fica por cima da barra Ligar / WhatsApp / Orçamento. Enquanto taparia os botões do topo, recolhe-se. `site.js` mede a altura para o foco do teclado nunca ficar por baixo dela.
- **A escolha.** Fica no `localStorage` como `mdm-estatisticas` = `sim` ou `nao`. Depois de escolher, a barra não volta. Se o browser enviar «não seguir» (Global Privacy Control ou Do Not Track), a barra não aparece e nada se mede.
- **Mudar de ideias.** A política de privacidade (`privacidade.html#estatisticas`) tem os botões «Aceitar» e «Recusar» (`assets/js/privacidade.js`). Recusar depois de aceitar para o envio logo nessa página.
- **Os eventos** (`track()` em `site.js`) nunca falham antes da escolha. Ficam só na memória da página e seguem se o visitante aceitar ali. Com «Recusar», perdem-se.
- **No ficheiro único** (aberto do disco) não há estatísticas nem barra.

## Movimento

Poucos efeitos, todos em `assets/css/site.css`, sem bibliotecas e sem nada a correr com a página parada:

- **Topo:** encolhe depois de descer 80 px e passa a vidro (gesso a 86%, desfocado). Onde o browser não desfoca, fica opaco.
- **Perguntas (páginas de serviço):** a resposta abre e fecha a deslizar (`::details-content`). Noutros browsers abre de imediato. Funciona sem JavaScript e com o teclado.
- **Botão principal (carmim):** um brilho atravessa-o uma vez ao passar o rato ou com o foco do teclado.
- **Topo da página inicial:** ao abrir, o texto sobe (250 ms) e a fotografia assenta de 1,04 a 1 (1,2 s), uma vez. Sem prender o scroll.
- **Revelação** das secções ao descer, linha a prumo da página inicial, fotografias que crescem ao passar o rato.

Com «reduzir movimento» ligado no sistema, nada disto se mexe. Regras para efeitos novos: nada em ciclo sem botão de pausa, nada por baixo de texto que lhe baixe o contraste, só `transform` e `opacity` quando possível.

## Antes de publicar: dados que só a MDM tem

O site nunca mostra um dado por preencher. Cada um tem um lugar em `data/dados-mdm.json` (e, para as obras, em `factos` de `data/obras.json`); enquanto o valor estiver vazio, a frase, a linha da ficha, a pergunta ou a secção que o usa não aparece. Basta escrever o valor e voltar a gerar. Nunca escrever um número ou um facto que não esteja confirmado.

```bash
python3 website/build.py --faltam   # o que falta, em que páginas entra, e outras tarefas
```

Resumo do que falta hoje:

- **Certificações**: número de associado APIRAC, tipo e número do título IMPIC, número do certificado de gases fluorados (o selo F-gas já aparece, sem número), certificação do eletricista se a MDM a quiser publicar.
- **Contactos**: o que fazer fora do horário e ao fim de semana (sem prazos de resposta). Sem isto não aparece o bloco «Fora de horas» nem a pergunta da página inicial.
- **Testemunhos**: só reais e com autorização por escrito. Sem eles a secção «Clientes» não aparece.
- **Prova** (página inicial): nota média e número de avaliações do Perfil da Empresa no Google (só aparecem os dois juntos, no topo e na faixa de dados), unidades instaladas por ano e contratos de manutenção ativos (faixa de dados), garantia da instalação e seguro de responsabilidade civil (certificações e junto ao botão do formulário). Os números da nota e das avaliações não vão para os dados estruturados.
- **Contactos**: os concelhos onde a MDM trabalha (contacto, por baixo da morada, e faixa de dados).
- **Obras**: data, local exato, tipo de cliente, duração e resultado de cada obra. A ficha mostra só os que existem; o resultado aparece também no carrossel da página inicial.
- **Serviços**: preço indicativo de ar condicionado (se quiser; numa frase para a pergunta da página do serviço e, curtos, os de um split, de um multi-split, do contrato anual e do diagnóstico para os cartões da página inicial), duração de uma montagem, plano e periodicidade da manutenção, avarias no contrato, reparação de placas, âmbito do trabalho elétrico, extração de cozinhas, periodicidade da limpeza de condutas. Cada pergunta sem resposta fica escondida.
- **Privacidade**: a política foi reescrita a 01/10/2026 e **não teve revisão jurídica**: falta a revisão por um jurista antes do lançamento. Confirmar também os prazos de conservação que vêm da versão anterior do site (pedidos e contactos sem trabalho: no máximo 3 anos; estatísticas: 12 meses, a acertar no projeto PostHog) e apagar no Netlify os pedidos mais antigos do que isso. Falta ainda saber se o PostHog descarta o IP e, se a MDM quiser nomeá-lo, que serviço de email recebe os pedidos. Se a política mudar, mudar também a data no topo.
- **Bombas de calor**: confirmar se a obra F29 (unidade e depósito numa varanda) é uma bomba de calor, como dizia a v3, ou um chiller, como diz a ficha; fotografias de outras bombas de calor montadas pela MDM (hoje a página mostra só F04 e F29). A página fala só de águas quentes e de sistemas combinados (águas quentes e aquecimento), como o dono confirmou; radiadores e piso radiante não são nomeados.
- **Outras**: fotografias de quadros elétricos AVAC; confirmar «peças originais» e se há garantia a anunciar (vai para `garantiaInstalacao`).
- **Ficheiros sem uso**: as fotografias largas do camião (`assets/img/hero/mdm-plataforma-largo-*`, 10 ficheiros, 1,6 MB) eram do topo antigo e já não entram em nenhuma página, mas o `build.py` copia toda a pasta `assets/`. Apagar depois de o dono aprovar o topo novo; as `mdm-plataforma-600` a `-1200` (ao alto) continuam em uso em «Como trabalhamos».
- **Preço provável**: a tabela de preços (folha «MDM, tabela de preços para o site»), copiada para `data/precos.json`. Enquanto estiver vazia, o formulário não mostra preços (ver «Preço provável»).
- **Formulário**: o email que recebe os pedidos no Netlify, e ligar a deteção de formulários (ver «Formulário de orçamento»).
- **Estimativa de potência**: os técnicos da MDM confirmam os números de `btu` em `data/site.json`. Hoje: 400 BTU/h por m² (cerca de 117 W/m², uma regra prudente para casas em Lisboa), quarto 1,0, sala 1,1, cozinha 1,25, escritório 1,15, outra divisão 1,0, muito sol × 1,15, último andar × 1,10, aparelhos de 7 000, 9 000, 12 000, 18 000 e 24 000 BTU/h, folga de 10% antes de passar ao tamanho seguinte.

`--check` falha se chegar a `public/` um placeholder (`[MAIÚSCULAS…]`, `[[CHAVE]]`, «por preencher») ou algo que o dono retirou a 27/09/2026: promessas de prazo de resposta («24 horas», «24–48h», «mesmo dia», «N minutos»), idade em anos («35 anos»: só «1991»), marcas fora de Midea, Mitsubishi Electric, Daikin e France Air, ou o nome legal com outra grafia («M.D.M. - Manuel Domingos Melancia, Lda»). Verifica as páginas, a meta, o JSON-LD, as mensagens de WhatsApp, os scripts e o cartão de contacto. Falha também se um dado da página inicial vier num formato que a página não espera (`FORMATOS` no `build.py`): um número sem aspas, a nota do Google com ponto em vez de vírgula, números com pontos, um preço sem «€», a garantia ou o seguro sem ponto final, menos de duas avaliações, ou a nota sem o número de avaliações (ou o contrário). No site, o espaço dentro de um número («1 200») e antes de «€» passa a espaço inseparável, para não partirem ao fim da linha.
