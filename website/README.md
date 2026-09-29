# Site da MDM Assistência Técnica

Site estático em português europeu para a MDM (ar condicionado, ventilação, eletricidade e manutenção na grande Lisboa, desde 1991). Substitui o `index-carmim.html`: mesma lógica de pedidos, triagem e medição, novo desenho feito a partir das fotografias reais das obras.

## Gerar

```bash
python3 website/build.py            # gera website/public/
python3 website/build.py --check    # gera e valida ligações, recursos e sintaxe; lista placeholders
```

Só precisa de Python 3.11+ (biblioteca padrão). `public/` não entra no git: é sempre gerado.

Pré-visualizar: abrir `website/public/index.html` no browser, ou `python3 -m http.server -d website/public 8000`.

## Publicar

Qualquer alojamento estático serve, **servido na raiz do domínio** (a página 404 usa caminhos absolutos porque é mostrada em qualquer profundidade). Netlify: diretório base `website` (o `netlify.toml` já tem o comando e a pasta). Antes de publicar, preencher os placeholders abaixo e trocar `baseUrl` em `data/site.json` pelo domínio final.

## Estrutura

| Onde | O quê |
|---|---|
| `data/site.json` | Contactos, horário, NIF, mensagens de WhatsApp pré-preenchidas (com a etiqueta de triagem `[P1 · …]`) |
| `data/obras.json` | As 24 obras: título, especialidade, equipamento, texto, pormenores e factos por preencher |
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

`python3 website/build.py --check` lista todos. Resumo:

- **Urgências fora de horas** — `[POLÍTICA DE URGÊNCIAS FORA DE HORAS]` (contacto e FAQ).
- **Testemunhos** — `[TESTEMUNHO REAL DE CLIENTE …]`, `[NOME OU CARGO]`, `[TIPO DE CLIENTE · LOCAL]`, setores/clientes que podem ser nomeados (com autorização por escrito). Em alternativa, retirar `{{> testemunhos }}` da página inicial.
- **Certificações** — `[Nº DE ASSOCIADO APIRAC]`, `[TIPO E Nº DO TÍTULO IMPIC]`. Se a MDM tiver certificação de gases fluorados, acrescentar um terceiro selo em `src/partials/certificacoes.html` (foi retirado por não estar confirmado).
- **Obras** — por obra: `[DATA DA OBRA]`, `[LOCAL EXATO]`, `[TIPO DE CLIENTE]`, `[DURAÇÃO]` em `data/obras.json` (campo `factos`).
- **Privacidade** — rever com assessoria jurídica; prazo de conservação dos pedidos; data da última atualização.
- **Serviços** — placeholders das perguntas frequentes de cada serviço (periodicidades, condições de contrato).
