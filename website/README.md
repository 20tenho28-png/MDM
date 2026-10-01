# Site da MDM Assistência Técnica

Site estático em português europeu para a MDM (ar condicionado, ventilação, eletricidade e manutenção na grande Lisboa, desde 1991). Substitui o `index-carmim.html`: mesma lógica de pedidos, triagem e medição, novo desenho feito a partir das fotografias reais das obras.

## Gerar

```bash
python3 website/build.py            # gera website/public/
python3 website/build.py --check    # gera e valida ligações, recursos, sintaxe, placeholders e decisões do dono
python3 website/build.py --faltam   # lista os dados que só a MDM pode dar (não falha)
```

Só precisa de Python 3.11+ (biblioteca padrão). `public/` não entra no git: é sempre gerado.

Pré-visualizar: abrir `website/public/index.html` no browser, ou `python3 -m http.server -d website/public 8000`.

## Publicar

Qualquer alojamento estático serve, **servido na raiz do domínio** (a página 404 usa caminhos absolutos porque é mostrada em qualquer profundidade). Netlify: diretório base `website` (o `netlify.toml` já tem o comando e a pasta). Antes de publicar, trocar `baseUrl` em `data/site.json` pelo domínio final e ver a lista de `--faltam` (abaixo).

## Estrutura

| Onde | O quê |
|---|---|
| `data/site.json` | Contactos, horário, NIF, nome legal, marcas, mensagens de WhatsApp pré-preenchidas (com a etiqueta de triagem `[P1 · …]`). A barra do telemóvel, o rodapé e o contacto usam a mensagem da página: `wa` no `<!--meta-->` de cada serviço, `geral` nas outras |
| `data/obras.json` | As 24 obras: título, especialidade, equipamento, texto, pormenores e factos (data, local exato, cliente, duração: só aparecem na ficha quando preenchidos) |
| `data/dados-mdm.json` | Dados que só a MDM pode dar (números das certificações, testemunhos, perguntas por responder, privacidade). Vazio = escondido no site |
| `src/templates/layout.html` | Cabeçalho `<head>`, recusa de medição, estrutura comum |
| `src/partials/` | Cabeçalho e menu em gaveta, rodapé, barra fixa do telemóvel, contacto + formulário, certificações, testemunhos, cartões de obra |
| `src/pages/` | Página inicial, obras, 4 serviços, privacidade, 404, página do QR das carrinhas |
| `src/templates/obra.html` | Modelo das 24 páginas de obra (`obras/<slug>.html`) |
| `assets/css/site.css` | Sistema visual completo e movimento |
| `assets/js/site.js` | Medição (PostHog UE, sem cookies), formulário, gaveta, carrossel, filtros, revelação |
| `assets/fonts/` | Archivo e Newsreader alojadas no site (licença OFL incluída): nenhum pedido ao Google |
| `assets/img/obras/` | Fotografias com correção de cor ligeira, em WebP (800/1600) e JPEG |
| `marketing/gerar_qr.py` | Códigos QR das carrinhas, em vetor, com a carrinha e o lado na ligação |

## Carrinhas: código QR e página de destino

Cada carrinha leva códigos QR que abrem `carrinha.html?v=01&p=t` (carrinha 01, traseira). A página está fora do menu e do mapa do site (`noindex`) e junta a origem, por exemplo `[Carrinha 01 · traseira]`, às mensagens de WhatsApp, ao pedido do formulário e ao evento `qr_carrinha` na medição. Assim fica a saber que carrinha e que lado trazem contactos. Não guarda nada no equipamento do visitante. Lados: `t` traseira, `e` lateral esquerda, `d` lateral direita, `m` íman, `c` cartão de vizinho.

```bash
pip install segno
python3 website/marketing/gerar_qr.py --carrinhas 3   # SVG à medida final em website/marketing/qr/
```

Os códigos usam o `baseUrl` de `data/site.json`. **Trocar pelo domínio final antes de gerar os ficheiros para a gráfica**, e ler cada código com dois telemóveis antes de imprimir. `marketing/qr/` não entra no git.

A página oferece ainda `mdm.vcf`, o cartão de contacto para guardar no telemóvel, gerado a partir de `data/site.json`.

## Receber pedidos num servidor

Hoje o formulário abre o email do visitante com o pedido preparado (ou o WhatsApp). Para receber os pedidos diretamente, preencher `LEAD_ENDPOINT` em `assets/js/site.js` com o endereço de um recetor (Supabase, Base44…). O código já trata o envio, o tempo limite de 8 s, a nova tentativa e a passagem para email à segunda falha.

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
- **Privacidade**: revisão jurídica, prazo de conservação dos pedidos (até lá, «apenas pelo tempo necessário»), se o PostHog descarta o IP, data da última atualização.
- **Outras**: fotografias de quadros elétricos AVAC; confirmar «peças originais» e se há garantia a anunciar.

`--check` falha se chegar a `public/` um placeholder (`[MAIÚSCULAS…]`, `[[CHAVE]]`, «por preencher») ou algo que o dono retirou a 27/09/2026: promessas de prazo de resposta («24 horas», «24–48h», «mesmo dia», «N minutos»), idade em anos («35 anos»: só «1991»), marcas fora de Midea, Mitsubishi Electric, Daikin e France Air, ou o nome legal com outra grafia («M.D.M. - Manuel Domingos Melancia, Lda»). Verifica as páginas, a meta, o JSON-LD, as mensagens de WhatsApp, os scripts e o cartão de contacto.
