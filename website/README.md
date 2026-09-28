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

Qualquer alojamento estático serve. Netlify: diretório base `website` (o `netlify.toml` já tem o comando e a pasta). Antes de publicar, preencher os placeholders abaixo e trocar `baseUrl` em `data/site.json` pelo domínio final.

## Estrutura

| Onde | O quê |
|---|---|
| `data/site.json` | Contactos, horário, NIF, mensagens de WhatsApp pré-preenchidas (com a etiqueta de triagem `[P1 · …]`) |
| `data/obras.json` | As 24 obras: título, especialidade, equipamento, texto, pormenores e factos por preencher |
| `src/templates/layout.html` | Cabeçalho `<head>`, recusa de medição, estrutura comum |
| `src/partials/` | Cabeçalho e menu em gaveta, rodapé, barra fixa do telemóvel, contacto + formulário, certificações, testemunhos, cartões de obra |
| `src/pages/` | Página inicial, obras, 4 serviços, privacidade, 404 |
| `src/templates/obra.html` | Modelo das 24 páginas de obra (`obras/<slug>.html`) |
| `assets/css/site.css` | Sistema visual completo e movimento |
| `assets/js/site.js` | Medição (PostHog UE, sem cookies), formulário, gaveta, carrossel, filtros, revelação |
| `assets/fonts/` | Archivo e Newsreader alojadas no site (licença OFL incluída): nenhum pedido ao Google |
| `assets/img/obras/` | Fotografias com correção de cor ligeira, em WebP (800/1600) e JPEG |

## Receber pedidos num servidor

Hoje o formulário abre o email do visitante com o pedido preparado (ou o WhatsApp). Para receber os pedidos diretamente, preencher `LEAD_ENDPOINT` em `assets/js/site.js` com o endereço de um recetor (Supabase, Base44…). O código já trata o envio, o tempo limite de 8 s, a nova tentativa e a passagem para email à segunda falha.

## Antes de publicar: dados que só a MDM tem

`python3 website/build.py --check` lista todos. Resumo:

- **Urgências fora de horas** — `[POLÍTICA DE URGÊNCIAS FORA DE HORAS]` (contacto e FAQ).
- **Testemunhos** — `[TESTEMUNHO REAL DE CLIENTE …]`, `[NOME OU CARGO]`, `[TIPO DE CLIENTE · LOCAL]`, setores/clientes que podem ser nomeados (com autorização por escrito). Em alternativa, retirar `{{> testemunhos }}` da página inicial.
- **Certificações** — `[Nº DE ASSOCIADO APIRAC]`, `[Nº DO ALVARÁ IMPIC]`, e confirmar a certificação de gases fluorados.
- **Obras** — por obra: `[DATA DA OBRA]`, `[LOCAL EXATO]`, `[TIPO DE CLIENTE]`, `[DURAÇÃO]` em `data/obras.json` (campo `factos`).
- **Privacidade** — rever com assessoria jurídica; prazo de conservação dos pedidos; data da última atualização.
- **Serviços** — placeholders das perguntas frequentes de cada serviço (periodicidades, condições de contrato).
