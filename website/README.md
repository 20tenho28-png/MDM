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

## Publicar

Qualquer alojamento estático serve, **servido na raiz do domínio** (a página 404 usa caminhos absolutos porque é mostrada em qualquer profundidade). Netlify: diretório base `website` (o `netlify.toml` já tem o comando e a pasta). O domínio é `https://www.mdmassist.com.pt` (`baseUrl` em `data/site.json`): dele saem o endereço canónico, `og:url`, `og:image`, o mapa do site, o `robots.txt`, os dados estruturados, o cartão `mdm.vcf` e os códigos QR. Antes de publicar, ver a lista de `--faltam` (abaixo).

### Pré-visualização (até ao lançamento)

Enquanto `data/site.json` tiver `"preview": true`, o site pede aos motores de busca para não o indexar, em três sítios ao mesmo tempo:

- `<meta name="robots" content="noindex">` em todas as páginas;
- `public/_headers`, gerado pelo `build.py`, com `X-Robots-Tag: noindex` para todos os endereços (o Netlify junta-o aos cabeçalhos do `netlify.toml`, que não aceita condições);
- `robots.txt` com `Disallow: /`.

`--check` confirma que os três estão lá. A imagem de partilha só aparece no WhatsApp ou no Facebook quando o domínio já abrir este site.

### Lançamento: desligar a pré-visualização

1. Ligar `www.mdmassist.com.pt` (e o domínio sem `www`, a redirecionar para ele) ao projeto Netlify e esperar pelo certificado HTTPS. Não mexer nos registos de email do DNS.
2. Em `data/site.json`, passar `"preview": true` a `"preview": false`. Mais nada muda: `robots.txt` passa a `Allow: /` com a linha `Sitemap:`, `_headers` deixa de ser gerado e as páginas voltam a `index,follow` (a 404 e a página das carrinhas continuam `noindex`, de propósito).
3. `python3 website/build.py --check` tem de passar (falha se sobrar algum `noindex` ou se `baseUrl` não for o domínio final). Fazer commit e esperar pelo deploy.
4. Confirmar: `curl -I https://www.mdmassist.com.pt/` já não mostra `X-Robots-Tag`, e `https://www.mdmassist.com.pt/robots.txt` mostra `Allow: /`.
5. Na Google Search Console, enviar `https://www.mdmassist.com.pt/sitemap.xml`. No Perfil da Empresa no Google, pôr `https://www.mdmassist.com.pt` como site.
6. Só agora gerar os códigos QR das carrinhas para a gráfica (secção seguinte).

### Dados para o Google

Todas as páginas levam a empresa em JSON-LD (`HVACBusiness` e `Electrician`): nome legal, NIF, morada, telefone, email, horário, área servida (Lisboa e Grande Lisboa), ano de fundação, logótipo, imagem, frase e a ligação ao Perfil da Empresa no Google (`googleMaps` em `data/site.json`, também no rodapé). Cada serviço tem ainda o seu `Service` com a lista do que inclui. Sem classificações nem número de avaliações: não as temos. A imagem de partilha (`assets/img/og-mdm.jpg`, 1200×630; nome novo porque `assets/img/` tem cache de um ano e a imagem antiga mostrava um técnico) mostra o logótipo, a frase, o telefone e o camião com a matrícula desfocada; as páginas de obra partilham a fotografia da obra.

## Estrutura

| Onde | O quê |
|---|---|
| `data/site.json` | Domínio (`baseUrl`), pré-visualização (`preview`), Perfil da Empresa no Google (`googleMaps`), contactos, horário, NIF, nome legal, marcas, mensagens de WhatsApp pré-preenchidas (com a etiqueta de triagem `[P1 · …]`). A barra do telemóvel, o rodapé e o contacto usam a mensagem da página: `wa` no `<!--meta-->` de cada serviço, `geral` nas outras |
| `data/obras.json` | As 24 obras: título, especialidade, equipamento, texto, pormenores e factos (data, local exato, cliente, duração: só aparecem na ficha quando preenchidos) |
| `data/dados-mdm.json` | Dados que só a MDM pode dar (números das certificações, testemunhos, perguntas por responder, privacidade). Vazio = escondido no site |
| `src/templates/layout.html` | Cabeçalho `<head>`, estrutura comum (topo, barra das estatísticas, rodapé, barra do telemóvel) |
| `src/partials/` | Cabeçalho e menu em gaveta, rodapé (com a política de privacidade e o Livro de Reclamações Eletrónico), barra fixa do telemóvel, barra das estatísticas (`consentimento.html`), contacto + formulário, certificações, testemunhos, cartões de obra |
| `src/pages/` | Página inicial, obras, 5 serviços (ar condicionado, bombas de calor, manutenção, eletricidade, ventilação), privacidade, 404, página do QR das carrinhas, `obrigado.html` (depois de enviar o formulário sem JavaScript). Cada serviço descreve-se no `<!--meta-->` em `servico` (nome, tipo e ofertas) para os dados estruturados `Service` |
| `src/templates/obra.html` | Modelo das 24 páginas de obra (`obras/<slug>.html`) |
| `assets/css/site.css` | Sistema visual completo e movimento |
| `assets/js/site.js` | Estatísticas (PostHog UE, sem cookies, só depois de «Aceitar»), formulário (envio para o Netlify), gaveta, carrossel, filtros, revelação |
| `assets/fonts/` | Archivo e Newsreader alojadas no site (licença OFL incluída): nenhum pedido ao Google |
| `assets/img/obras/` | Fotografias com correção de cor ligeira: o original `foto-NN-1600.jpg` e os tamanhos 400 a 1600 em AVIF e WebP (ver «Fotografias das obras») |
| `gerar_fotos.py` | Faz os tamanhos AVIF e WebP das fotografias a partir do JPEG de 1600 |
| `marketing/gerar_qr.py` | Códigos QR das carrinhas, em vetor, com a carrinha e o lado na ligação |

## Fotografias das obras

Cada obra tem um original, `assets/img/obras/foto-NN-1600.jpg` (1600×1200, ou 1200×1600 ao alto), já com a correção de cor e o corte finais e sem dados de localização. É também a reserva para browsers antigos e a imagem de partilha da página da obra. A partir dele, `gerar_fotos.py` faz seis tamanhos, pelo lado maior (400, 600, 800, 1000, 1200 e 1600), em AVIF e em WebP:

```bash
pip install "Pillow>=11.3"
python3 website/gerar_fotos.py        # só o que falta; --todas refaz tudo; 31 32 só estas obras
```

O `{{foto NN …}}` do `build.py` escreve um `<picture>` com os três formatos, `width`/`height` e um `sizes` à medida de cada sítio (cartão, carrossel, topo de serviço, página da obra). O browser escolhe o tamanho; o visor de ecrã inteiro pede outro, à medida do ecrã. Nos telemóveis com ecrã de 3x pede-se a imagem de 2x, como no topo da página inicial: à vista é igual e pesa metade. Só as imagens do primeiro ecrã carregam logo (`loading="eager"`; na grelha de `obras.html` as 8 primeiras); as outras esperam pela rolagem.

Uma obra nova: pôr o `foto-NN-1600.jpg` na pasta, correr `gerar_fotos.py` e depois `build.py --check`, que falha se faltar algum tamanho. Na página inicial, num telemóvel, as fotografias pesam cerca de 0,7 MB (antes 2,5 MB).

## Carrinhas: código QR e página de destino

Cada carrinha leva códigos QR que abrem `carrinha.html?v=01&p=t` (carrinha 01, traseira). A página está fora do menu e do mapa do site (`noindex`) e junta a origem, por exemplo `[Carrinha 01 · traseira]`, às mensagens de WhatsApp, ao pedido do formulário e ao evento `qr_carrinha` nas estatísticas (se o visitante as aceitar). Assim fica a saber que carrinha e que lado trazem contactos. Não guarda nada no equipamento do visitante. Lados: `t` traseira, `e` lateral esquerda, `d` lateral direita, `m` íman, `c` cartão de vizinho.

```bash
pip install segno
python3 website/marketing/gerar_qr.py --carrinhas 3   # SVG à medida final em website/marketing/qr/
```

Os códigos usam o `baseUrl` de `data/site.json` (`https://www.mdmassist.com.pt`). **Gerar os ficheiros para a gráfica só depois do lançamento** (`"preview": false` e o domínio já a abrir o site novo; o script avisa enquanto o site estiver em pré-visualização), e ler cada código com dois telemóveis antes de imprimir. `marketing/qr/` não entra no git.

A página oferece ainda `mdm.vcf`, o cartão de contacto para guardar no telemóvel, gerado a partir de `data/site.json`.

## Formulário de orçamento (Netlify Forms)

O formulário (`src/partials/contacto.html`, em todas as páginas que o têm) é um formulário Netlify com o nome `orcamento`. O Netlify encontra-o no HTML gerado e guarda cada pedido em **Forms** no painel do projeto. Campos: `nome`, `email`, `telefone`, `servico`, `mensagem`, `fotografia` (opcional, uma imagem até 8 MB, o limite do Netlify por pedido) e os escondidos `pagina` (de onde foi enviado), `triagem` (`[P1 · Montagem AC]`…), `origem` (a carrinha, em `carrinha.html`) e `subject` (o assunto do email de aviso, com a triagem). `bot-field` é a armadilha para robôs (`netlify-honeypot`). `--check` falha se o formulário de alguma página perder um destes campos ou atributos.

- **Com JavaScript**, `site.js` valida (nome e um email ou telefone; fotografia até 8 MB e só imagens), envia para `/` sem sair da página e mostra a confirmação no próprio formulário, sem prazos. Se o envio falhar (rede, tempo, serviço), nada se apaga: a mensagem oferece telefone e WhatsApp, este já com o pedido escrito.
- **Sem JavaScript**, o envio é normal e o Netlify mostra `obrigado.html` (fora do mapa do site, `noindex`).
- O botão **Enviar por WhatsApp** continua ao lado, com o mesmo pedido validado; a fotografia junta-se na conversa.
- No ficheiro único para o cliente (aberto do disco, sem servidor), o formulário volta ao email do visitante e ao WhatsApp, e o campo da fotografia não aparece.

**O que a MDM tem de fazer no Netlify** (uma vez, depois da primeira publicação):

1. **Forms → Enable form detection** e voltar a publicar (o Netlify só procura formulários depois disto).
2. **Forms → Form notifications → Add notification → Email notification**: o email que recebe os pedidos (**falta saber qual**: `mdmassist@mdmassist.com` ou outro).
3. Enviar um pedido de teste com fotografia e confirmar que chega ao email e aparece em **Forms**. Apagar depois o pedido de teste.

O filtro de spam do Netlify está ligado por omissão; os pedidos marcados como spam ficam em **Forms → Spam**, convém espreitar de vez em quando.

## Estatísticas e consentimento

O PostHog (instância europeia, `persistence: 'memory'`, sem cookies nem perfis) **só carrega depois de o visitante carregar em «Aceitar»**. Até lá, o site não faz nenhum pedido ao PostHog.

- **A pergunta.** Uma barra pequena no fundo do ecrã (`src/partials/consentimento.html`): uma frase, «Aceitar» e «Recusar» com o mesmo peso e a ligação para a política. No telemóvel fica por cima da barra Ligar / WhatsApp / Orçamento. Enquanto taparia os botões do topo, recolhe-se. `site.js` mede a altura para o foco do teclado nunca ficar por baixo dela.
- **A escolha.** Fica no `localStorage` como `mdm-estatisticas` = `sim` ou `nao`. Depois de escolher, a barra não volta. Se o browser enviar «não seguir» (Global Privacy Control ou Do Not Track), a barra não aparece e nada se mede.
- **Mudar de ideias.** A política de privacidade (`privacidade.html#estatisticas`) tem os botões «Aceitar» e «Recusar» (`assets/js/privacidade.js`). Recusar depois de aceitar para o envio logo nessa página.
- **Os eventos** (`track()` em `site.js`) nunca falham antes da escolha. Ficam só na memória da página e seguem se o visitante aceitar ali. Com «Recusar», perdem-se.
- **No ficheiro único** (aberto do disco) não há estatísticas nem barra.

## Movimento

Poucos efeitos, todos em `assets/css/site.css`, sem bibliotecas e sem nada a correr com a página parada:

- **Topo:** encolhe depois de descer 80 px e passa a vidro (gesso a 86%, desfocado). Onde o browser não desfoca, fica opaco. Por baixo corre o **termómetro de leitura**, um filete do carmim ao azul que enche com o scroll (só onde o browser liga animações ao scroll).
- **Perguntas:** a resposta abre e fecha a deslizar (`::details-content`). Noutros browsers abre de imediato. Funciona sem JavaScript e com o teclado.
- **Botão principal (carmim):** um brilho atravessa-o uma vez ao passar o rato ou com o foco do teclado.
- **Revelação** das secções ao descer, entrada do topo da página inicial, fotografias que crescem ao passar o rato.

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
- **Obras**: data, local exato, tipo de cliente e duração de cada obra. A ficha mostra só os que existem.
- **Serviços**: preço indicativo de ar condicionado (se quiser), duração de uma montagem, plano e periodicidade da manutenção, avarias no contrato, reparação de placas, âmbito do trabalho elétrico, extração de cozinhas, periodicidade da limpeza de condutas. Cada pergunta sem resposta fica escondida.
- **Privacidade**: a política foi reescrita a 01/10/2026 e **não teve revisão jurídica**: falta a revisão por um jurista antes do lançamento. Confirmar também os prazos de conservação que vêm da versão anterior do site (pedidos e contactos sem trabalho: no máximo 3 anos; estatísticas: 12 meses, a acertar no projeto PostHog) e apagar no Netlify os pedidos mais antigos do que isso. Falta ainda saber se o PostHog descarta o IP e, se a MDM quiser nomeá-lo, que serviço de email recebe os pedidos. Se a política mudar, mudar também a data no topo.
- **Bombas de calor**: confirmar se a obra F29 (unidade e depósito numa varanda) é uma bomba de calor, como dizia a v3, ou um chiller, como diz a ficha; fotografias de outras bombas de calor montadas pela MDM (hoje a página mostra só F04 e F29). A página fala só de águas quentes e de sistemas combinados (águas quentes e aquecimento), como o dono confirmou; radiadores e piso radiante não são nomeados.
- **Outras**: fotografias de quadros elétricos AVAC; confirmar «peças originais» e se há garantia a anunciar.
- **Formulário**: o email que recebe os pedidos no Netlify, e ligar a deteção de formulários (ver «Formulário de orçamento»).

`--check` falha se chegar a `public/` um placeholder (`[MAIÚSCULAS…]`, `[[CHAVE]]`, «por preencher») ou algo que o dono retirou a 27/09/2026: promessas de prazo de resposta («24 horas», «24–48h», «mesmo dia», «N minutos»), idade em anos («35 anos»: só «1991»), marcas fora de Midea, Mitsubishi Electric, Daikin e France Air, ou o nome legal com outra grafia («M.D.M. - Manuel Domingos Melancia, Lda»). Verifica as páginas, a meta, o JSON-LD, as mensagens de WhatsApp, os scripts e o cartão de contacto.
