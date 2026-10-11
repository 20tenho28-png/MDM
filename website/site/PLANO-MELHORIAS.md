# Plano de melhorias técnicas: site MDM

Documento de passagem para o Claude Code. Descreve o estado atual do site,
as regras a respeitar e as tarefas por ordem de prioridade, cada uma com o
que conta como "feito".

## 1. Contexto

- **O que é:** site público da MDM Assistência Técnica (ar condicionado,
  bombas de calor, ventilação, eletricidade e manutenção na Grande Lisboa,
  desde 1991).
- **Tecnologia:** HTML, CSS e JavaScript estáticos, sem build. Páginas PT na
  raiz de `website/` e EN em `website/en/`. São 66 páginas: início, galeria
  de obras e 24 obras, 5 serviços, calculadora e privacidade, em cada língua.
- **Origem:** cópia do site publicado em
  `https://www.mdmassist.pt`, tirada a
  10 out 2026, mais as correções listadas abaixo.
- **Repositório:** `github.com/20tenho28-png/MDM`, pasta `website/`, ramo
  `bernardo/website-import`, pull request #16. O repositório tem outras apps
  (painel de tickets, simulador elétrico, Circuit Planner) que não devem ser
  mexidas.
- **Servidor original (não incluído):** `GET /api/status`,
  `POST /api/requests` (pedidos do formulário), `/api/chat` (assistente IA,
  desligado), `/api/availability` e `/api/bookings` (marcação, desligada) e
  a área de gestão `/gestao`. Fora do alojamento original estas chamadas dão
  404, e o site trata isso sem partir.
- **Ver localmente:** `cd website && python3 -m http.server 8080`, e abrir
  `http://localhost:8080/`. Os caminhos começam por `/`, por isso não funciona
  abrindo o ficheiro diretamente.

### Já feito (não refazer)

- Perguntas frequentes repostas na página inicial (PT e EN), mais uma nova
  sobre a calculadora.
- Texto do topo e dos 4 passos em linguagem simples para particulares.
- Botão de WhatsApp na barra fixa do telemóvel, nas 66 páginas.
- JSON-LD `HVACBusiness` nas duas páginas iniciais.
- Fichas de obra com descrição completa (já não cortada a meio) e foto
  própria como imagem de partilha.
- `assets/analytics.js`: GA4 e Clarity atrás de um aviso de cookies. Está
  desligado até serem preenchidos os IDs.
- Um só endereço por página: links, canonical, hreflang, `og:url` e sitemap
  usam todos a forma `.html`.
- "Marcas parceiras" passou a "Marcas com que trabalhamos".
- Foto nova da obra Ventilbox (`foto-25`), com os textos ajustados.

## 2. Regras

1. **Não inventar factos.** Preços, certificações, avaliações, parceiros,
   prazos ou números só entram com dados confirmados pela MDM. Onde faltarem,
   deixar o código preparado e o valor vazio.
2. **Texto em português de Portugal**, simples para particulares. Termos
   técnicos (AVAC, carga térmica, UTA) só no separador "Comércio e serviços"
   e nas páginas de serviço. Não usar travessões (—) no texto.
3. **PT e EN sempre sincronizados.** As páginas EN são ficheiros separados:
   cada alteração de texto numa página PT tem de ser feita na página EN
   correspondente. As strings criadas por JavaScript estão em
   `assets/i18n.js`, indexadas pela frase portuguesa (ver tarefa 6).
4. **Não mudar o aspeto visual** sem pedido explícito.
5. **Fluxo de trabalho:** ramo próprio, commits pequenos, pull request contra
   `main`, CI verde. Ver `CONTRIBUTING.md` do repositório.
6. **Antes de cada push:** verificar links internos, consola sem erros (fora
   os 404 de `/api/*` em local) e ver as páginas alteradas em computador e
   telemóvel (390 px e 320 px) sem scroll horizontal.

## 3. Tarefas, por ordem

### Tarefa 1. Proteção contra spam no formulário (prioridade alta)

**Problema:** o formulário de pedido (`#quote-form`, em todas as páginas)
envia para `POST /api/requests` sem qualquer proteção. O envio é feito em
`assets/assistant.js`, pela chamada `api('/api/requests', {...payload, id})`.

**Fazer:**
- Acrescentar ao `#quote-form` de todas as páginas (PT e EN) um campo-isco
  invisível, por exemplo `name="empresa_site"`, com `tabindex="-1"`,
  `autocomplete="off"` e `aria-hidden="true"`. Escondê-lo por CSS, nunca com
  `type="hidden"`.
- Enviar no payload o valor desse campo e o tempo desde a abertura do
  formulário (`elapsed_ms`).
- Preparar o widget Cloudflare Turnstile com a site key em constante vazia.
  Sem chave, não carrega nada; com chave, envia o token no payload.
- Documentar em `website/README.md` o que o servidor tem de fazer: rejeitar
  quando o campo-isco vem preenchido ou `elapsed_ms` é inferior a 3000, e
  verificar o token Turnstile no servidor.

**Feito quando:** o envio normal funciona igual, o campo não é visível nem
alcançável por teclado ou leitor de ecrã, e o README descreve o contrato.

### Tarefa 2. Testes da calculadora (prioridade alta)

**Contexto:** `assets/calculator-model.mjs` tem funções puras (`roomLoad`,
`validateRoom`, `sizeProject`, `postalInfo`, `monoPrice`, `multiPrice`) e
`assets/calculator-data.mjs` gera o texto do pedido (`quoteFromCalculation`).

**Fazer:**
- Criar `website/tests/calculator.test.mjs` com `node:test`, sem
  dependências.
- Caso de referência, já verificado: sala de 20 m², teto de 260 cm, 3 m² de
  vidro a Sul, 2 pessoas, sem sombreamento, sem equipamentos, não último
  andar, isolamento desconhecido. Resultado: `loadW` = 3270, `unit.btu` =
  12000, `unit.coolKW` = 3.5, 1 aparelho, opção "mono" recomendada e
  `price` null.
- Testar os limites de `validateRoom` (`LIMITS`), uma casa com 3 divisões
  (opções mono e multi), a escolha de classe nos limites entre tamanhos, e
  `monoPrice` e `multiPrice` com uma tabela de preços fictícia, apenas nos
  testes.
- Juntar `"test": "node --test tests/"` a um `website/package.json`.
- No repositório, acrescentar um job "Website" ao `.github/workflows/ci.yml`
  que corre estes testes e a verificação da tarefa 3.

**Feito quando:** `npm test` em `website/` passa e o CI corre-o em cada PR.

### Tarefa 3. Verificação automática do site (prioridade alta)

**Fazer** um script (Node ou Python, sem dependências pesadas) em
`website/tools/check-site` que falhe se:
- algum `href`, `src` ou `srcset` interno não aponta para um ficheiro
  existente;
- alguma página PT não tem a página EN equivalente, ou o contrário;
- algum `<script type="application/ld+json">` não é JSON válido;
- alguma `meta description` está vazia, tem mais de 160 caracteres ou acaba
  a meio de uma palavra;
- algum `<img>` não tem `alt`;
- o canonical de uma página não corresponde ao seu próprio caminho.

**Feito quando:** o script passa no estado atual e falha se se partir um link
de propósito. Corre no CI (tarefa 2).

### Tarefa 4. Desempenho (prioridade média)

- **Fontes:** acrescentar `<link rel="preload" as="font" type="font/woff2"
  crossorigin>` para as duas faces usadas acima da dobra (Archivo 700 no
  título e Newsreader itálico), em todas as páginas.
- **`i18n.js` (78 KB):** carregar só nas páginas EN. `site.js` e
  `assistant.js` usam `window.MDM?.t(s) || s`, por isso o PT funciona sem o
  ficheiro. Confirmar antes de retirar.
- **`assistant.js`:** o assistente IA está desligado (`/api/status` devolve
  `ai: false`), mas o ficheiro também trata do envio do formulário. Não
  retirar. Opcional: separar o envio do formulário do código do chat.
- **Imagem não usada:** `assets/img/hero-hvac-pexels-30210086.jpg` (330 KB)
  só é usada pela cena `terraco` em `site.js`, que não tem botão. Retirar a
  cena e a imagem, e as referências ao Pexels em `assets/hero.css`.

**Feito quando:** Lighthouse em telemóvel melhora ou fica igual em todas as
métricas, e o EN continua todo traduzido.

### Tarefa 5. Gerador de páginas estáticas (prioridade média, maior esforço)

**Problema:** cada página repete o cabeçalho, o rodapé, o formulário de
orçamento e a barra do telemóvel. Numa ficha de obra, só cerca de 20% é
conteúdo próprio. Qualquer alteração comum obriga a editar 66 ficheiros.

**Fazer:**
- Usar Eleventy (11ty), ou Astro em modo estático, numa pasta `website-src/`
  que gera exatamente a estrutura atual de `website/`.
- Um modelo base com cabeçalho, rodapé, formulário e barra do telemóvel.
  Modelos para início, galeria, obra, serviço, calculadora e privacidade.
- As 24 obras e os 5 serviços passam a ficheiros de dados (título, categoria,
  fotos, descrição, lista de pontos, em PT e EN), extraídos das páginas
  atuais por script e não reescritos à mão.
- **Critério principal:** o HTML gerado tem de ser igual ao atual, ignorando
  espaços em branco. Fazer o diff página a página antes de aceitar a
  migração.
- Configurar a publicação a partir da pasta gerada.

**Feito quando:** o diff das 66 páginas não mostra diferenças de conteúdo, e
mudar o rodapé num só ficheiro muda as 66 páginas.

### Tarefa 6. Traduções por chave (junto com a tarefa 5)

**Problema:** `assets/i18n.js` usa a frase portuguesa como chave
(`"Pedido recebido": "Request received"`). Se a frase PT mudar, a tradução
deixa de ser encontrada sem dar erro.

**Fazer:** passar para chaves estáveis (`quote.sent`, `faq.price.q`, …), com
ficheiros `pt.json` e `en.json` usados pelo gerador e pelo JavaScript.
Manter a API `window.MDM.t()` para não partir `site.js` nem `assistant.js`.
Juntar à tarefa 3 uma verificação de que todas as chaves existem nas duas
línguas.

### Tarefa 7. Alojamento e servidor (precisa de decisões e acessos do Bernardo)

Não começar sem confirmação. O objetivo é tirar o site da dependência do
`chatgpt.site`:
- Publicar `website/` no Netlify ou Cloudflare Pages, a partir do GitHub, com
  domínio próprio.
- Ligar o formulário ao projeto Supabase existente da MDM (está em pausa):
  tabela de pedidos, função no servidor que valida o campo-isco e o
  Turnstile, e aviso por email para `mdmassistencia@gmail.com`.
- Uma página de gestão protegida por login, só para a MDM.
- Atualizar no código o domínio de canonical, Open Graph, hreflang, sitemap e
  JSON-LD.

## 4. Pendente de dados da MDM (não inventar)

| O quê | Onde entra |
| --- | --- |
| Preço instalado por tamanho de aparelho: 9 000, 12 000, 18 000 e 24 000 BTU, e multi-split com 2, 3 e 4 unidades | Tabela de preços da calculadora (`monoPrice` e `multiPrice` já existem, a tabela está vazia) |
| Nota e 3 a 5 avaliações do Perfil da Empresa no Google | Secção nova na página inicial |
| Certificação de gases fluorados, alvará, seguro de responsabilidade civil e garantia | Faixa de confiança junto às marcas |
| IDs do GA4 e do Clarity, e parágrafo sobre cookies na privacidade | `assets/analytics.js`, `privacidade.html` e `en/privacidade.html` |
| Se a MDM é instaladora autorizada de alguma marca | Voltar a "Marcas parceiras", só se for verdade |
| Domínio próprio | Tarefa 7 |
