# MDM Assist — Website

Site institucional da **M.D.M. - Manuel Domingos Melancia, Lda (MDM)** — assistência técnica a edifícios
(ar condicionado, eletricidade, ventilação) na grande Lisboa, desde 1991.

## Conteúdo

| Ficheiro | Descrição |
|---|---|
| `index.html` | **O site oficial (variante creme, escolhida pelo chefe em 08/2026)** — auto-contido (HTML + CSS + JS + imagens em base64), editável à mão. É o único ficheiro necessário para publicar. |
| `privacidade.html` | Política de privacidade (RGPD art. 13.º) com a recusa de medição. Ligada no rodapé, na gaveta do telemóvel e junto ao formulário. |
| `docs/entrega.md` | Lista de verificação da entrega: contas, domínio, formulário, afirmações comerciais a confirmar e decisões técnicas documentadas. |
| `mdm-logo.svg` | Logótipo vetorial limpo. Reutilizável em cartões, faturas, email. |
| `favicon/` | O logótipo rasterizado em PNG (32px favicon, 180px apple-touch-icon). Já embutidos no `index.html`. |
| `obras/` | As 14 fotografias de obra já otimizadas (JPEG, 480px de altura). Já embutidas no `index.html`. |
| `src/` | Os ficheiros-fonte da variante navy (arquivada) e o script que a gera. Ver **Como editar**. |
| `variante-navy/` | A variante escura, técnica — **não escolhida**, arquivada funcional caso se queira reaproveitar. Gera-se a partir de `src/`. |

## Como editar

O `index.html` (creme) é um ficheiro único **editável à mão** — texto, preços e contactos
alteram-se diretamente nele (as imagens em base64 não se tocam).

A variante navy arquivada gera-se a partir das fontes:

```bash
cd site/src
python3 assemble.py          # gera ../variante-navy/index.html a partir das fontes
```

| Ficheiro em `src/` | O que contém |
|---|---|
| `src_head.html` | `<head>` + toda a folha de estilo |
| `src_body.html` | todo o markup (com marcadores `{{LOGO_SVG}}` e `{{OBRAS}}`) |
| `src_script.html` | todo o JavaScript |
| `assemble.py` | junta as três partes e injeta o logótipo, o favicon e as 14 fotos (só stdlib) |
| `obras.json` | legendas (alt text) e dimensões das 14 fotos |
| `suppliers.html` | a secção Fornecedores isolada, para colar noutro sítio |

> As fotos originais em alta resolução (`assets-fonte/` do pacote antigo + as fotos de obra do
> telemóvel) **não estão neste repositório** por causa do tamanho (~10 MB) — guarde-as à parte.
> O `obras/` já otimizado é suficiente para reconstruir o site.

## As duas variantes

**Decisão tomada (08/2026): o chefe escolheu a creme** — é o `index.html` na raiz.
A navy fica arquivada em `variante-navy/`, completa e funcional.

| | Navy (`variante-navy/index.html`) | Creme (`index.html` — **oficial**) |
|---|---|---|
| Estética | Escura, técnica (navy dos polos) | Clara, editorial (a publicada) |
| Como se edita | Fontes em `src/` + `assemble.py` | Ficheiro único, editável à mão |
| Funcional | Navy: faixa de orçamento, barra fixa mobile, CTA de foto. Creme (oficial): **caminhos de lead** — três portas + formulário (ver secção própria), sem faixa nem barra fixa. Ambas: `LEAD_ENDPOINT`, PostHog, carrossel de obras (10 no oficial) |  |

Nota: o `LEAD_ENDPOINT` define-se diretamente no `<script>` do `index.html` (creme).
A navy arquivada tem o seu em `src/src_script.html` — só interessa se ela voltar.

## Privacidade, medição e recusa (09/2026)

- **`privacidade.html`** cobre o art. 13.º do RGPD: responsável, dados, finalidades e
  fundamentos (al. b) para o formulário, al. f) para medição e erros), prazos de conservação,
  subcontratantes (PostHog UE, Sentry DE, Formspree EUA com cláusulas-tipo, Google Fonts),
  direitos e CNPD. **Três valores foram escritos por omissão e o dono tem de os confirmar:**
  3 anos para pedidos sem contrato, 12 meses de medição, 90 dias de registos de erro.
- **Recusa de medição:** o botão na política grava `mdm-sem-medicao` no browser; o
  `index.html` lê essa marca antes de tudo (`window.MDM_SEM_MEDICAO`) e, se existir, **não
  carrega o PostHog nem o Sentry**. Verificado: com a marca, o único pedido externo que resta
  é o das fontes.
- **Sentry** deixou de ser um `<script>` bloqueante no `<head>`: é injetado em assíncrono e
  tem `beforeSend` que apaga `request.data`, cookies e `user` — o que o visitante escreve no
  formulário nunca sai no relatório de erro.
- **Sem banner de cookies**, por opção justificada: não há cookies nem identificação entre
  visitas. A única escrita no equipamento é a própria recusa.

## Captação de leads e medição

- **Formulário** (`#orcamento`, na secção Contacto) envia para um endpoint real quando
  `LEAD_ENDPOINT` está definido no `<script>` do `index.html` (ex.: Formspree
  `https://formspree.io/f/xxxxxxxx`, ou função serverless que reenvia para
  mdmassist@mdmassist.com). Payload: POST JSON com `origem` (`formulario`), `prioridade`,
  `segmento` e `pagina`. A faixa carmim de orçamento (só telefone) **saiu da oficial em
  09/2026** — ver **Caminhos de lead**; continua na navy arquivada.
- **Sem endpoint** (estado atual), o formulário abre o programa de email com o pedido
  preparado e o botão diz, honestamente, "Enviar por email". Definir o endpoint muda o rótulo
  para "Enviar pedido" e ativa a confirmação inline + fallback para email se o POST falhar.
  **Definir o endpoint é o passo nº 1 para maximizar leads.**
- **Caminho escolhido (09/2026): Formspree.** Criar conta em formspree.io, "New form",
  confirmar o email mdmassist@mdmassist.com quando o Formspree o pedir, e copiar o URL
  `https://formspree.io/f/xxxxxxxx` para `LEAD_ENDPOINT`. O site já envia `_subject`
  (assunto legível: origem + nome/telefone) e `_replyto` (responder direto ao cliente).
  Histórico: o 503 anterior vinha de um projeto Supabase pausado sem função publicada
  (ver `backend/README.md` — fica como alternativa se um dia se quiser guardar leads em BD).
- **PostHog** (org MDM, projeto 226321, região UE) está instalado com
  `persistence: 'memory'` — sem cookies nem storage, logo sem necessidade de banner de
  consentimento; perde-se a distinção novo/recorrente de propósito. Eventos (oficial):
  `quote_form_submit` (com `via`: endpoint/mailto + `prioridade`/`segmento`),
  `form_preselect`, `form_focus`, e `whatsapp_click` / `phone_click` / `email_click`, todos
  com a propriedade `lead` (montagem · avaria · manut · manut-mail · elet · tel · mail) —
  é o funil por segmento. Na navy arquivada existem ainda `lead_strip_submit`,
  `intent_click` e `strip_focus`.
- **Só na navy arquivada:** divisão de intenção acima do formulário ("Tenho uma avaria" vs
  "Quero um contrato"), barra fixa mobile ("Ligar agora" + "Enviar foto") e CTA do hero
  "Enviar foto da avaria". Na oficial estes papéis passaram para as três portas do hero e
  para o botão verde do header.
- **Segunda camada (ambas as variantes):** formulário reduzido ao essencial (NIF, localidade
  e assunto pedem-se depois do 1º contacto), rótulo "Nome" em vez de "Empresa", faixa
  sensível ao horário (fora de 2ª–6ª 8h–17h promete o próximo dia útil), "orçamento gratuito
  e sem compromisso" junto ao botão, ponte de CTA a seguir ao carrossel de obras, e a pill da
  nav navy passou de salto para o WhatsApp a âncora de captação (#orcamento).
- **Anti-spam e estados (09/2026):** campo-armadilha `_gotcha` (escondido fora do ecrã; o
  Formspree também o reconhece do lado do servidor) e estados explícitos no botão — *A
  enviar…* → *Pedido enviado ✓* ou *Tentar novamente*; à segunda falha abre o programa de
  email com o pedido preparado. Não há armadilha temporal: bloqueava quem preenche depressa.
- **Robustez da captação:** `sendLead` tem timeout de 8s (endpoint pendurado → fallback
  honesto, nunca spinner eterno); botões protegidos contra duplo envio; eventos disparados
  antes do PostHog carregar ficam em fila e são despachados no load; payloads levam
  `referrer`, `utm` e `ts` para atribuição futura. `form_focus` dá o start-rate do
  formulário (vs `quote_form_submit`). **Nota:** com adblock (~25–30% no desktop) o
  PostHog não carrega — a contagem de leads verdadeira é a do endpoint, o analytics é
  direcional.

## Desempenho em telemóvel (imagens)

- **WebP em todo o lado onde ganha**: as 14 fotos existem em `.jpg` e `.webp`
  (`obras/`); o `assemble.py` embute o mais pequeno dos dois por foto, e a variante
  creme foi re-encodada in place (incluindo a foto de fundo do hero). Resultado:
  navy 714→641 KB, creme 817→658 KB, qualidade visual igual (q78).
- **`loading="lazy"` em todas as imagens** fora da primeira vista: num telemóvel,
  só ~10 das 18 imagens são sequer descarregadas/descodificadas ao abrir a página.
- **Build de publicação com imagens externas** — `python3 externalize.py
  <index.html> <pasta>` gera `deploy/navy/` e `deploy/creme/`: HTML de 149/95 KB
  (com gzip do host fica ~40 KB) + imagens em ficheiros próprios, em paralelo e
  com cache. **É esta a build a publicar quando o alojamento aceita uma pasta**
  (Netlify/Vercel/FTP); o ficheiro único continua a ser o oficial para "arrastar
  um ficheiro só". Regenerar sempre as duas depois de editar as fontes.
- **SEO (09/2026):** `og.jpg` (cartão 1200×630 para partilhas WhatsApp/redes; gerado à mão,
  guardado em `site/og.jpg`) ligado por `og:image`/`twitter:image`; o `externalize.py` copia-o
  para a build e gera `robots.txt` + `sitemap.xml` a partir do canonical. **Quando houver domínio
  próprio** (a decisão SEO pendente mais importante): mudar o `canonical`, `og:url`, `og:image`
  e `twitter:image` no `index.html` e regenerar a build — robots/sitemap seguem sozinhos.
  Depois: registar no Search Console e tratar da ficha Google Business (map pack é o canal nº 1).
- **AEO / tendências (09/2026):** secção **FAQ** (6 respostas diretas, `<details>` nativo)
  com **schema FAQPage** cujo texto iguala o visível — feita para a pesquisa por voz e para
  os motores de resposta por IA escolherem o site como fonte. Duas **linhas de confiança**
  junto ao formulário ("site sem cookies nem rastreio" / "técnicos, não robôs" — ambas
  verdadeiras por construção). **Subtítulo sazonal** no hero via JS (jun–set: arrefecimento;
  nov–fev: aquecimento; resto do ano: o texto estático, que é também o fallback sem JS).
- Nota honesta: "1 ms" não existe em rede real — o que se otimizou foi o primeiro
  render (HTML pequeno primeiro) e o custo total, sem tocar na qualidade.

## Triagem de leads (09/2026) — hierarquia do dono

**P1 montagem de ar condicionado · P2 manutenção preventiva · P3 eletricista certificado
(foco AVAC)** · P4 avarias/ventilação · P5 por classificar. A lógica vive numa única tabela
`TRIAGEM` no `<script>` do `index.html` (serviço → prioridade + segmento) e é usada em
todo o lado — mudar a hierarquia é editar essa tabela:

- **Assunto do email** (Formspree `_subject` e `mailto`): começa por `[P1 · Montagem AC]`,
  `[P2 · Manutenção preventiva]`, … — a caixa de entrada ordena-se e filtra-se pelo prefixo.
- **Payload do endpoint**: campos `prioridade` e `segmento`; **PostHog**: `quote_form_submit`
  leva os mesmos dois campos (funil por segmento).
- **WhatsApp**: só existem dois textos pré-preenchidos, definidos uma vez no `<script>`
  (`WA_MONTAGEM` → `[P1 · Montagem AC] …` com pedido de fotos do local; `WA_AVARIA` →
  `[P4 · Avaria] …` com pedido de foto) — pesquisáveis na app pelo prefixo.
- **Hero**: as três portas são exatamente P1/P2/P3, **em estilo INEOS** (barra de cor de 4px,
  título Lora com seta, uma linha — sem caixa nem botões), com a cor da barra a seguir a
  prioridade (carmim · navy · cinzento) e o canal fixado pelo dono — ver **Caminhos de lead**.
- **Formulário**: opções do serviço pela ordem da prioridade; **secção Serviços**: os quatro
  cartões (AC · Manutenção · Eletricidade · Ventilação) são espelhos exatos das portas.

## Hero de qualificação (09/2026) — filtra a clientela

Conceito produzido a partir de `docs/prompt-hero-avac.md` (gramática INEOS: declaração,
prova, três portas) e implementado tal e qual:

- **Slogan:** "Mantemos os edifícios de Lisboa a *funcionar*." — evolução do aprovado
  ("Mantemos Lisboa a funcionar."). A palavra que filtra é **edifícios**: quem gere um
  edifício reconhece-se; quem compra um split para a sala não.
- **Linha de prova** (substitui o subtítulo e o sazonal por JS, que era escrito para o
  particular): 35 anos · banca, indústria e condomínios · assistência multi-marca com peças
  originais · técnicos certificados em AVAC e eletricidade. Só factos reais, nenhum deles um
  prazo. **"intervenção em 24 a 48 h" saiu do hero em 09/2026, a pedido do dono:** um prazo
  no primeiro ecrã é uma promessa que depende da carga de trabalho. O prazo continua a ser
  dito onde é uma expectativa e não uma garantia — na banda de números (`24–48h`) e na FAQ
  ("tipicamente em 24–48 h"). Se o dono quiser tirá-lo também daí, são dois sítios. **"6 marcas representadas" saiu em 09/2026:** era o
  único sítio do site a sugerir representação oficial das marcas (o resto sempre disse
  "multi-marca") e era o facto mais fraco dos três — falava do fornecedor, não do cliente.
- **Três portas**, com o canal fixado pelo dono: **Contratos de manutenção** (barra carmim
  → telefone 218 935 050 + `mailto` com assunto e corpo), **Ar condicionado** (barra navy
  → WhatsApp com texto que pede a foto), **Ventilação e UTA** (barra cinzenta → formulário
  com `data-preselect` + `data-msg` a preencher serviço e esqueleto da mensagem).
- **Saíram:** o eyebrow em mono, os dois CTAs do hero (fundiram-se nos cartões A e B) e a
  troca sazonal do subtítulo. O telefone continua no header.
- **Por decidir (assinalado, não executado):** a banda "MDM em números" repete 35 anos e
  24–48h que agora vivem na linha de prova — posicionada por decisão do dono, não se mexeu.
  A faixa carmim abaixo do hero (quarta porta genérica) **foi retirada em 09/2026** na
  passagem aos caminhos de lead (ver secção própria); volta com `git revert` se o dono quiser.

## Header (09/2026 — 3ª iteração, CRO)

O dono rejeitou a 1ª versão (barra navy + nav em mono maiúsculas). A versão final,
escolhida por agente de design entre 3 candidatos fotografados: **uma só faixa creme**,
5 âncoras reais (Obras · Serviços · Porquê a MDM · Perguntas · Contacto) em **Inter
14,5px/500 caixa normal** (o mono ficou só no telefone, papel de "etiqueta de
instrumento"), e o **estado vivo como chip inline** junto ao telefone — ponto verde +
"Aberto agora · até às 18h" via `lisbonOpen()` (ids `tbDot`/`tbEstado`). Hierarquia: o
CTA carmim é o único elemento alto. Degradação: ≤1240px o chip esconde-se, ≤1180px
aperta, ≤1020px caem as âncoras `.nl-desk`, ≤760px nav mobile intocada.

**4ª iteração (09/2026 — caminhos de lead, passos mínimos):** ver secção **Caminhos de
lead** abaixo — os dropdowns e o CTA "Pedir Orçamento Grátis" saíram; ficou o menu plano de
5 âncoras, o telefone com estado vivo e o WhatsApp de avaria com rótulo. O parágrafo seguinte
descreve a 3ª iteração, já substituída.

**Reformulado como header de conversão (CRO, 3ª iteração):** navegação reduzida a **3 itens** —
*Serviços* e *Sobre nós* são dropdowns (Serviços → AC/Eletricidade/Ventilação com
deep-link ao cartão + "Manutenção & Contratos" que pré-seleciona o serviço no
formulário; Sobre nós → Porquê a MDM/Perguntas/Contacto), *Obras* é link direto.
**Zona de ação à direita:** telefone com ícone + micro-texto de estado vivo ("Aberto ·
até às 18h") e o CTA passivo "Quero ser contactado" passou a **"Pedir Orçamento Grátis"**
(carmim, alto contraste, hover). **Mobile (≤760px):** botão **"Ligar"** carmim em
evidência + hambúrguer com gaveta (scroll-lock, fecha ao escolher/Esc) + o WhatsApp
verde de sempre; o CTA de texto esconde-se. Dropdowns: hover em ponteiro fino, clique/
teclado sempre; `aria-expanded` em todos. Justificação das decisões no histórico do commit.

## Caminhos de lead (09/2026) — um caminho por lead, passos mínimos

Pedido do dono: "há vários botões para as mesmas coisas; a UX tem de ser o mais user
friendly possível, passos mínimos". Antes havia 17 ações de contacto no desktop (5 WhatsApp
com textos diferentes, 8 rótulos para "pedir orçamento"). Regra aplicada: **cada tipo de
lead tem um único destino, repetido apenas em dois momentos de leitura** — o hero (decidir)
e a secção Contacto (confirmar); o header trata só do "agora".

| Lead | Destino único | Onde aparece |
|---|---|---|
| **P1 Montagem de AC** | WhatsApp 910 307 579 com `[P1 · Montagem AC] …` (pede fotos do local) | porta 1 do hero · cartão AC · cartão WhatsApp em Contacto |
| **P2 Manutenção preventiva** | desktop: `mailto` com assunto `[P2 · Manutenção preventiva] …`; telemóvel (`pointer: coarse`): liga 218 935 050 | porta 2 · cartão Manutenção · cartões Telefone/Email em Contacto · FAQ |
| **P3 Eletricista certificado** | formulário `#orcamento` com serviço, esqueleto da mensagem e título pré-preenchidos | porta 3 · cartão Eletricidade |
| **P4 Avaria** (AC, ventilação, quadro) | WhatsApp com `[P4 · Avaria] …` (pede foto) | botão verde do header (desktop com rótulo "Avaria? Envie foto", ≤1000px só ícone) · cartão Ventilação · FAQ |
| Outro | formulário (select) ou email direto | Contacto |

- **Uma fonte única no `<script>`:** `WA_MONTAGEM`, `WA_AVARIA`, `MAIL_P2`, `TEL_MDM`,
  `PRESELECT_ELET`; `applyLeads()` aplica-os a todos os `[data-lead]`. Os `href` estáticos
  no HTML são os mesmos (fallback sem JS). Mudar um destino = mudar uma constante.
- **Saíram:** faixa carmim `#orcamento` (só telefone → WhatsApp genérico), CTA "Pedir
  Orçamento Grátis" do header, dropdowns da nav (+ deep-links `data-svc`), ligação "Peça
  orçamento" após o carrossel, "Pedir orçamento grátis" da
  gaveta mobile. A âncora `#orcamento` passou para o formulário (`.quote-wrap`), com
  `scroll-margin-top` a compensar o header fixo e o `translateY` do reveal.
- **Header:** menu plano Serviços · Obras · Porquê a MDM · FAQ · Contacto; um só ponto de
  viragem a **1000px** (acima: menu + telefone com estado + WhatsApp com rótulo; abaixo:
  "Ligar" com estado vivo por baixo + WhatsApp ícone + hambúrguer). `--nav-h` (89px / 81px
  ≤640px) alimenta a gaveta e o `scroll-margin-top` das secções. Estado vivo:
  "Aberto · até às 17h" / "Fechado · 2ª–6ª 8h–17h" (`[data-estado]`, versão curta no mobile).
- **Contacto:** três cartões que dizem para que serve cada canal (Telefone → contratos e
  urgências; WhatsApp → montagem e avarias, com fotos; Email → propostas de manutenção),
  morada em texto corrido, formulário com dois botões de envio (ver secção seguinte), "Nome *" e
  ajuda "* obrigatório: o nome e um contacto". Ecrãs estreitos (≤400px): prova numa linha
  mais curta (`.hp-x` esconde a linha das marcas) para as três portas caberem em 375×667 (medido:
  fundo da 3ª porta a 467px).
- **Contagem depois:** 13 ações de contacto no desktop (2 header · 3 portas · 4 cartões ·
  3 canais + botões do formulário), mais 3 ligações inline de texto (FAQ e nota do
  formulário). Verificação Playwright: sem erros, header sem overflow em 900–1440px,
  âncoras a aterrar abaixo do header, pré-seleção e validação a funcionar.
- **Decisões do dono a validar:** (1) a faixa carmim saiu; (2) o WhatsApp de avaria ganhou
  rótulo no desktop. Ambas revertem-se em CSS/HTML sem tocar no resto.

## Conversão do formulário e do WhatsApp (09/2026)

Ronda focada só no fim do funil: o pedido já está escrito, falta chegar à MDM.

- **Segunda via de envio.** O formulário passa a ter dois botões: "Enviar por email"
  (vermelho, primário) e "Enviar por WhatsApp" (verde). O segundo corre a mesma validação,
  monta o mesmo `quoteBody(d)` e abre `wa.me` com o pedido já escrito. Se houver
  `LEAD_ENDPOINT`, a lead segue **também** por POST (`origem: 'formulario-whatsapp'`) —
  duplicar é melhor do que perder. O `window.open` é chamado dentro do gesto, antes de
  qualquer `await`, senão o browser bloqueia a janela.
  Isto **reverte** a remoção feita na ronda "um caminho por lead": lá o botão saiu por ser
  um destino repetido; aqui volta por outra razão — no momento de maior intenção o site
  oferecia só o canal mais lento.
- **Mensagens de WhatsApp enviáveis sem edição.** A de montagem tinha 193 caracteres e três
  `…` para o cliente preencher dentro da caixa de texto do telemóvel; a de avaria, 126.
  Agora têm 107 e 68, sem reticências, e a etiqueta de triagem passou do início para o fim
  (a conversa do cliente já não abre com um código interno). As perguntas de qualificação
  passam a ser a primeira resposta da MDM, que é onde funcionam.
- **`quote_form_start`.** Dispara uma vez, no primeiro `focusin` de um campo real (ignora o
  honeypot). Sem ele não se sabia quantas pessoas começaram a preencher e desistiram:
  desistências = `quote_form_start` − `quote_form_submit`. Não há evento de abandono próprio
  — seria ruído, o número já sai da subtração.
- **Campos.** `qEmpresa` tinha `autocomplete="organization"` com um rótulo ("Nome") que
  aceita pessoa singular: o browser não oferecia o nome no preenchimento automático. Passou
  a `name`, com `autocapitalize="words"`. Email ganhou `autocapitalize="off"` e
  `spellcheck="false"`; os três ganharam `enterkeyhint="next"`.
- **"Orçamento gratuito e sem compromisso"** saiu do bloco de notas cinzento e ficou
  imediatamente por baixo dos botões (`.mw-reassure`). O grupo de ações leva
  `margin-left: auto` para, ao passar para a linha de baixo, encostar à direita como
  fazia quando era um só botão.
- **Estados de fim.** Sucesso e falha do `mailto` passam a oferecer uma ligação de WhatsApp
  (`quoteAlert(msg, ok, comWhats)`, construída com `createElement`, sem `innerHTML`). O
  `textContent` limpa os filhos antes, por isso as ligações não se acumulam. Importa
  sobretudo no `mailto`: quando não acontece nada, o cliente passa a ter alternativa visível.
- **Contraste:** branco sobre `--wa` 4,89:1; sobre `--wa-d` 6,37:1; `--wa-d` sobre o fundo do
  alerta de sucesso 5,58:1. Botão de 45px de altura.
- **Verificação Playwright** (1440/390/360): sem erros de página, sem overflow, botões lado a
  lado no desktop e empilhados no telemóvel, validação a bloquear o envio por WhatsApp tal
  como o do email, `wa.me` a levar nome/contacto/etiqueta, `quote_form_start` a disparar uma
  só vez.

### Por fazer nesta frente

1. **`LEAD_ENDPOINT` continua vazio** (`site/index.html`) — todo o `submit` cai em `mailto:`,
   que no telemóvel obriga a enviar outra vez noutra app e em quem usa webmail muitas vezes
   não faz nada. É o maior buraco de conversão do site e espera só pelo URL do Formspree.
   Enquanto não existir, o botão verde é na prática o caminho fiável; quando existir, o
   vermelho volta a ser o primário sem mudar nada.
2. **Decisão do dono:** o botão verde do header diz "Avaria? Envie foto" — é o CTA mais
   visível do site e está fechado no lead P4. Neutro ("WhatsApp 910 307 579") serve todos os
   pedidos, mas perde a urgência que faz converter a avaria. No telemóvel não se põe: aí já
   é só o ícone.
3. **Decisão do dono:** o formulário está a 76% da profundidade da página no telemóvel
   (4770px de 6264). Uma chamada a seguir ao carrossel de obras resolveria, ao custo de mais
   um CTA na página.
4. **Ideia por avaliar:** trocar o `<select>` de serviço por chips (radios estilizados) —
   tira uma modal nativa no telemóvel, mantém o sinal de triagem.

## Domínio próprio — um só comando

O `index.html` aponta para o domínio provisório `mdmassist.manus.space`. Para mudar **não se
editam as etiquetas à mão**:

```bash
cd site && python3 externalize.py index.html deploy/creme --url https://www.mdmassist.pt
```

reescreve canonical, `og:url`, `og:image`, `twitter:image`, o JSON-LD, o `robots.txt`, o
`sitemap.xml` (que passou a incluir a página de privacidade) e a própria `privacidade.html`.

## Acessibilidade do carrossel de obras (09/2026)

O carrossel movia-se sozinho e só parava com o rato em cima — o que falha o critério 2.2.2
das WCAG para quem usa teclado ou toque. Passou a ter **botões visíveis de anterior, pausa e
seguinte** (46 px, `aria-pressed` no de pausa), **setas do teclado** e barra de espaço para
parar. O movimento automático suspende-se 700 ms quando se usa um botão, senão a escrita de
`scrollLeft` a cada frame anulava o scroll suave. Continua desligado com
`prefers-reduced-motion`.

## Ícones e animações

- **Ícones:** conjunto único **Lucide** (licença ISC) inline nas duas variantes — ventoinha
  (AC, estática de propósito), raio, grelha de ventilação, prancheta-visto, câmara no CTA
  de foto do hero, telefone/pin/WhatsApp nos cartões de contacto. Traço 1.8, pontas redondas.
  O botão de foto do cabeçalho (só em ecrãs pequenos) usa o **glifo WhatsApp sobre verde**
  (`--wa`), não a câmara — pedido do dono; o link continua a pré-preencher a mensagem da foto.
- **Animações (painel curado por júri adversarial — 4 por variante, 12 ideias rejeitadas):**
  navy: LED do formulário que fica sólido quando nome+contacto estão preenchidos (`:has`),
  LED de disponibilidade junto ao telefone da nav (usa `lisbonOpen()`), flash único na linha
  Serviço quando o cartão de contrato a pré-preenche, e as linhas do processo desenham-se
  com o reveal. Creme: abanão de validação (4px, 1 ciclo) + assentar do sucesso, linha de
  progresso de leitura sob a nav (scroll-driven, só CSS), sublinhado carmim que se desenha
  sob o `<em>` dos títulos. (O esquema multi-split animado do cartão de AC foi
  **removido a pedido do dono em 09/2026** — SVG, animação e kills PRM saíram juntos.)
- **Reduced-motion:** todas as animações têm kill explícito. Atenção no creme: o bloco
  global usa `*` e **não cobre pseudo-elementos**, e os kills têm de igualar a
  especificidade das regras com `.in` — já corrigido duas vezes; não simplificar.

## Heatmaps e geometria da dobra

- **PostHog heatmaps ativados no cliente** (`enable_heatmaps: true` + `capture_dead_clicks`)
  nas duas variantes — cliques, scrollmap, rageclicks e dead clicks acumulam a partir do
  primeiro dia online. Falta ativar o produto Heatmaps nas definições do projeto PostHog
  (eu.posthog.com, projeto 226321) — hoje está desligado e **não existe ainda um único
  evento recolhido** (site não publicado), portanto qualquer "heatmap" atual seria inventado.
- **Auditoria de geometria (dados medidos, Playwright, 6 viewports):** com o hero a 100svh,
  a faixa de orçamento ficava a 1,0–1,17vh — invisível sem scroll em TODOS os ecrãs — e em
  1366×768 (o portátil de escritório mais comum) e 360×800 a linha de números (1991 · 35
  anos) era cortada. Correções: hero a `calc(100svh - 56px)` (a faixa carmim espreitava acima
  da dobra: 0,93–0,95vh em desktop) e compressão do hero em `max-height: 820px`. A faixa
  saiu em 09/2026; o `-56px` mantém-se para a secção seguinte (obras) espreitar como pista
  de scroll.

## Stack e decisões técnicas

- **Vanilla HTML/CSS/JS, um único ficheiro de saída.** Decisão deliberada — foi testada uma versão
  React e abandonada. Não converter para framework sem necessidade real.
- **Design — fundo azul-marinho.** A base é o navy `#0D1420`; os painéis são `#141D2E`, que é
  literalmente a cor dos polos dos técnicos (amostrada das fotos de obra). O creme `#F4F1EA` passou
  a ser a superfície de contraste (banda "Porquê a MDM" e a folha do formulário).
- **Tipografia:** Space Grotesk (títulos) + Inter (texto) + IBM Plex Mono (etiquetas e números).
- **Logótipo:** SVG inline na nav e no rodapé. Atenção: os path data usam espaços como separadores —
  não "minificar" removendo quebras de linha sem os substituir por espaço.
- **Animação de fundo:** Three.js (via cdnjs, import dinâmico em try/catch — se o CDN falhar, o site
  funciona na mesma). Sobre o navy usa *additive blending*.
- **Ordem da página (decidida pelo dono):** hero → **obras** → **números** (1991 / 35 anos /
  24–48h / 8–17h) → serviços → porquê → FAQ → contacto (formulário). A prova visual vem
  antes da prova numérica. (Na navy arquivada há ainda a faixa de orçamento entre o hero e
  as obras.)
- **Carrossel "Algumas das nossas obras":** 10 fotos reais — eram 14; as obras 4–7 (multímetro, tubagem de cobre, sala de bombas, intervenção na exterior) foram retiradas a pedido do dono em 09/2026, mas continuam em `obras/` se voltarem a ser precisas, auto-scroll, pausa em hover, arrastável,
  com setas. Os cartões são duplicados por JS para o ciclo fechar sem costura.
- **Fornecedores:** marquee contínuo para a esquerda, meia página. Velocidade constante (70 px/s)
  calculada por JS a partir da largura real.
- **Formulário de contacto:** POST para `LEAD_ENDPOINT` quando definido; caso contrário `mailto:`
  pré-preenchido (ver **Captação de leads e medição**; o botão WhatsApp do formulário saiu em
  09/2026 — o WhatsApp vive na porta P1 e no header).

### Contraste (verificado)

O vermelho do site é agora o **carmim do logótipo `#A30711`** (unificação feita em 09/2026, a partir
da variante paralela de tokens; com texto branco dá 8,1:1 — AAA). Sobre o
navy tem apenas 2,8:1, por isso não pode ser usado em texto nem em traços:

| Token | Uso | Rácio |
|---|---|---|
| `--red` `#A30711` | preenchimentos, botões, acentos | 8,1:1 com branco |
| `--red-mark` `#D6392C` | traços e losangos sobre navy | 3,9:1 |
| `--red-ink` `#F0857A` | texto vermelho sobre navy | 7,3:1 |
| `--wa` `#12823F` | botão WhatsApp | 4,9:1 com branco |
| `--on-dark-2` `#A6AEC0` | texto secundário | 8,3:1 |

## Por verificar / decisões em aberto

- ~~Vermelho do logótipo vs. do site~~ **Resolvido (09/2026):** o site inteiro usa o carmim do
  logótipo `#A30711` (tinta escura passou ao navy `#141D2E`, cinzento ao `#4E5871`, escala de
  raios `--r-s`/`--r-m`). Origem: variante paralela de tokens enviada pelo dono, fundida na oficial.
- **Logótipos dos fornecedores.** A secção Fornecedores está em texto porque não existem ficheiros
  dos logótipos das marcas. Para usar PNGs, trocar o texto de cada `<li>` **nas duas listas** por
  `<img src="..." alt="...">` — o CSS `.marquee-row li img` já normaliza a altura e passa a branco.
  Confirmar antes se há autorização das marcas para usar as suas imagens de marca.
- **Panasonic** aparece numa das fotos de obra mas não está na lista de marcas aprovada
  (Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi). Acrescentar se fizer sentido.
- **Sentry** — instalado, por verificar com o site online: abrir a consola do browser, executar
  `myUndefinedFunction();` e confirmar o evento no painel. Org `mdm-5s.sentry.io`, região DE (UE),
  `sendDefaultPii: false` (RGPD), Session Replay desligado de propósito (exigiria política de
  privacidade no site).

## Dados reais (não alterar sem confirmação)

- Telefone: 218 935 050 · WhatsApp: 910 307 579 · Email: mdmassist@mdmassist.com
- Denominação legal: **M.D.M. - Manuel Domingos Melancia, Lda** ("Domingos", não "Domingues" —
  confirmado em 09/2026 no registo público (racius.com, base.gov.pt) e no impresso FM-TEC-04 da
  própria empresa; o site dizia "Domingues" por erro).
- Morada: Alameda dos Oceanos, 108A, Edifício Vila do Oriente, 1990-426 Lisboa · Horário: 2ª–6ª, 8h–17h · NIF: 502 644 761
- Fundação: 1991 (35 anos). Marcas: Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi.
- **Não introduzir dados financeiros privados** (faturação, clientes, etc.) — já foram removidos
  de versões antigas de propósito.

## Próximos passos

1. **Definir `LEAD_ENDPOINT`** no `<script>` do `index.html` (creme oficial) com o URL do
   Formspree — é o que transforma o formulário em captação real. (Navy arquivada:
   `src/src_script.html` + `python3 assemble.py`.)
2. **Publicar** — Netlify/Vercel/etc. Arrastar o `index.html` chega (site estático, sem build).
   Idealmente domínio próprio (ex.: mdmassist.pt) com HTTPS.
3. **Verificar o Sentry** (ver acima) e confirmar eventos no PostHog após publicar.
4. **Google Business Profile** — criar/reivindicar, NAP consistente com o site, fotos das
   obras; para pesquisas locais o map pack é o canal nº 1 e é gratuito.

## Notas para agentes de código

- Editar em `src/` e correr `python3 assemble.py`. Não editar o `index.html` diretamente.
- A classe `.in` é dos campos do formulário. **Não usar `.in` como classe de estado** — já houve
  uma colisão com o scroll-reveal (que agora usa `.is-in`) que pintava os títulos de escuro sobre
  escuro e tirava o fundo aos painéis.
- Testado em 1440/1180/900/768/620/390/360 px, sem overflow horizontal nem erros de consola
  (excluindo CDNs bloqueados em sandbox, que funcionam na web real).
