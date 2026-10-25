# Melperfaz: plano final de redesign (UX, informação e sistema visual)

## Resumo

1. O site tem o conteúdo certo e a marca certa, mas funciona como uma única página de 7.400px (11.700px no telemóvel), com o único formulário no fundo. Cada secção foi desenhada à parte, por isso nada partilha a mesma grelha, o mesmo ritmo ou os mesmos componentes.
2. A base escolhida é a proposta **Conversão primeiro**. Acrescentam-se três ideias das outras duas: superfícies que definem a cor do texto e do foco (proposta Portfólio), o catálogo de obras agrupado por categoria com âncoras (Portfólio), e um "lint" no `build.py --check` que impede o sistema de voltar a derivar (Sistema).
3. Cada página passa a ter uma função e uma ação principal: "Pedir Orçamento" leva a uma página nova, `orcamento.html`. "Ligar 961 245 288" e "Falar por WhatsApp" ficam sempre à mão: no cabeçalho em computador e numa barra fixa em baixo no telemóvel.
4. A marca mantém-se tal como no design system do cliente (ink #1b2540, clay #e08a1e, Fraunces + Archivo, cantos retos, fotografias reais). Há uma única correção obrigatória: o texto sobre laranja passa a ink (5,65:1) em vez de branco (2,53:1).
5. O que só o dono sabe (zona, horário, alvará, seguro, NIF, morada, factos de cada obra, mais fotografias) fica escondido até ser preenchido. Não se inventa nada. A falta da **zona de trabalho** é o problema de negócio mais grave e não se resolve com design.

---

## O que está mal hoje

### Crítico

| # | Problema | Evidência |
|---|---|---|
| C1 | A única forma de pedir orçamento é um formulário no fundo da home, e todos os botões mandam para lá | `#contacto` está a y=6018 de 7401px (desktop) e a y=9098 de 11669px (390px). A partir de uma obra, o visitante muda de página e o formulário só começa a y=636 de 844. |
| C2 | No telemóvel não há telefone nem botão de orçamento no cabeçalho | `.topo-btn` está em `display:none`. O primeiro telefone visível está a y=9495. |
| C3 | A zona onde a empresa trabalha não aparece em lado nenhum | `zona.valor = ""` em `data/dados-melperfaz.json`. A única pista é "pela região". |
| C4 | Os botões laranja e a faixa de contacto não cumprem o contraste mínimo | Branco sobre clay dá 2,53:1 (o AA exige 4,5:1). O próprio DESIGN.md aceita isto "por fidelidade". |
| C5 | O hero está fora da grelha e o foco do teclado não se vê | O texto do hero começa 104px à direita do resto do site (`.wrap` encolhida dentro de um flex). O anel de foco é ink sobre fundo escuro (cerca de 1:1). |

### Grave

- **Arquitetura**: o menu mistura âncoras da home com páginas, "Obras" leva a dois sítios diferentes e não há `aria-current` na home. Os menus de desktop e de telemóvel têm itens diferentes.
- **Conteúdo duplicado**: a secção de obras da home repete `obras.html`. A M05 aparece duas vezes em cada uma das páginas (cartão e slider). "Ver Todas as Obras" mostra as mesmas 5.
- **Vocabulário**: os tipos de obra têm cinco nomes diferentes (serviços, formulário, filtros, etiquetas, rodapé). Três dos seis serviços não têm nenhuma obra associada.
- **Cartões de serviço**: a seta "→" parece "saber mais", mas salta 5.000 a 7.900px até ao formulário.
- **Ações**: há mais de 7 rótulos para 3 ações. No hero há 5 ações e uma legenda disfarçada de link. A bolha de WhatsApp pulsa sem parar e tapa o hero, os cartões e os campos do formulário.
- **Confiança**: "Licenciada & segurada", "100% Licenciada" e "2 anos de garantia" não têm alvará, seguradora nem NIF. "25 anos / 2001" aparece 7 vezes.
- **Páginas de obra**: descrevem a fotografia ("O que se vê na fotografia") em vez do trabalho. A ficha mostra sobretudo o código interno. Há três navegações seguidas para "mais obras". Ink encosta a ink no rodapé.
- **Sistema visual**: o mesmo cartão de obra aparece em 4 tamanhos e os filtros deixam buracos na grelha. Há 3 padrões de cabeçalho de página, 2 faixas de contacto, 29 tamanhos de letra, cerca de 40 espaçamentos que não são tokens, 3 botões secundários e 2 fichas.
- **Telemóvel**: a foto do hero está ampliada 3,7x. A home tem 11.800px. Há duas animações infinitas (marquee e pulsação).

### Menor

- Alvos de toque pequenos no rodapé, nas migalhas e no índice de privacidade.
- Menu móvel sem fundo escurecido e sem bloqueio de scroll.
- Títulos que saltam níveis em `obras.html`.
- Etiquetas abaixo de 13px.
- O slider antes/depois captura todo o toque na imagem.
- O email parece obrigatório e os campos com 15,2px fazem zoom no iOS.
- A mensagem de erro ("Ups…") não oferece WhatsApp.
- A página de obrigado volta a pedir orçamento.
- Não há horário junto ao telefone.
- O logótipo do rodapé usa carregamento diferido (lazy).

---

## Princípios

1. **Uma página, uma função, uma ação principal.** A ação principal é sempre "Pedir Orçamento" e leva a `orcamento.html` (com `?tipo=` e `?de=` quando o contexto os conhece).
2. **Um rótulo por ação**, em todo o site:
   - "Pedir Orçamento" (botão)
   - "Enviar pedido de orçamento" (submeter o formulário)
   - "Ligar 961 245 288" ("Ligar" só na barra móvel)
   - "Falar por WhatsApp" ("Enviar fotografias por WhatsApp" só em `orcamento`, `obrigado` e nas páginas de obra, onde as fotografias são o objetivo)
   - "Gratuito" é texto de apoio, não um nome de botão: "Visita e orçamento gratuitos, sem compromisso."
3. **A prova fica junto da ação.** Cada grupo de botões tem por baixo a ProofLine e uma fotografia real por perto. Só se usam afirmações que já estão no site ou em `data/*.json`.
4. **Cada facto aparece uma vez por página.** "25 anos, desde 2001" fica no cartão do hero e no rodapé. Acaba o stat card e acaba o "100%".
5. **Páginas, não âncoras, no menu.** Há uma só lista de itens, igual em desktop e telemóvel, e o `aria-current` funciona sempre.
6. **Um vocabulário.** `data/site.json` › `servicos` gera os serviços, as opções do formulário, as etiquetas das obras, os grupos do catálogo e o rodapé.
7. **Uma margem esquerda.** Todo o conteúdo começa na borda da `.wrap` (1240px). Não há colunas centradas mais estreitas.
8. **Um componente por função, só do DS.** A lista fechada está mais abaixo. Espaços e tamanhos de letra vêm só de `tokens.css`, e o `--check` falha se não vierem.
9. **A superfície decide a cor.** Clay leva texto ink. Ink leva texto bone e foco amber. Superfícies claras levam texto ink e foco ink. Nunca branco sobre laranja.
10. **WCAG AA é o mínimo:**
    - contraste de 4,5:1
    - foco visível em todas as superfícies
    - etiquetas com 13px ou mais
    - campos com 16px ou mais
    - alvos de toque com 44px ou mais
    - nenhuma animação infinita
11. **Os estados dos dados nunca partem o layout.** A grelha funciona com 1 ou com 5 obras. A ficha some quando está vazia. Os "dados do dono" ficam escondidos até existirem.

---

## Mapa do site

| Página | Função | Estado |
|---|---|---|
| `index.html` (Início) | Mostrar o trabalho, dizer o que fazem e encaminhar para orçamento, telefone ou WhatsApp, em menos de 6.000px a 390px. Já não tem formulário. | Reescrita |
| `obras.html` (Obras) | O único catálogo completo: as 5 obras agrupadas por serviço, com âncoras `#reabilitacao`, `#fachadas` e `#acabamentos`. Os chips de filtro só voltam a partir de 8 obras. | Reescrita |
| `obras/<slug>.html` x5 | Uma obra contada como caso: fotografia, trabalho, ficha (se houver dados), pedido com o tipo pré-escolhido e outras obras. O slider antes/depois existe só em `obras/da-remocao-ao-revestimento-novo.html`. | Template reescrito |
| `orcamento.html` (Pedir Orçamento) | Página de conversão: o único `#quoteForm` (Netlify "orcamento"), telefone, WhatsApp, "O que acontece a seguir" (os 4 passos do processo) e confiança. | **Nova** |
| `obrigado.html` | Confirma o envio e oferece enviar fotografias por WhatsApp, ligar ou ver obras. Cabeçalho reduzido, sem barra. `noindex`. | Reescrita |
| `privacidade.html` | Texto legal com PageHead e Ficha. | Ajustada |
| `404.html` | Recupera o visitante: PageHead e 3 ações. `noindex`. | Ajustada |

**Menu (igual em todos os tamanhos):** Início · Obras | telefone · WhatsApp · **Pedir Orçamento**.

**Rodapé:** Início, Obras, Pedir Orçamento, Política de privacidade, Livro de Reclamações.

**Retirado do site:**
- âncoras no menu (Serviços, Processo, Porquê Nós), embora as secções se mantenham na home
- o formulário da home
- o marquee e o stat card
- os cartões 25/2001 duplicados
- o slider na home e em `obras.html`
- os chips de filtro
- a navegação anterior/seguinte e o botão "Ver Todas as Obras" nas obras
- a bolha de WhatsApp a pulsar

**Fica para depois:**
- `servicos.html` (proposta Sistema): só quando houver mais obras por serviço.
- `empresa.html`: só quando o dono der morada, zona, alvará e seguro.

Até lá, os serviços e o "Quem somos" vivem na home.

**Links antigos:** um script no topo de `index.html` reencaminha `#contacto` e `?tipo=` para `orcamento.html` com `location.replace`. Os ids `#servicos` e `#contacto` mantêm-se na home para quem não tem JS.

---

## Fluxos do utilizador

1. **Particular no telemóvel, vindo do Google**
   - Primeiro ecrã: h1, "Pedir Orçamento" e "Ligar 961 245 288". A barra Ligar | WhatsApp | Orçamento está visível desde o primeiro pixel.
   - Ecrã e meio abaixo: 3 obras reais (hoje a primeira fotografia de obra está a cerca de 5.100px).
   - Toca em "Orçamento" e chega a `orcamento.html` com o formulário no topo.
   - Preenche Tipo, Nome e Telefone sem zoom no iOS, envia e chega a `obrigado.html`, onde a ação seguinte é "Enviar fotografias por WhatsApp".
   - Total: 2 toques e 3 campos obrigatórios. Hoje são cerca de 11 ecrãs de scroll.
2. **Visitante convencido por uma obra (M04, fachada)**
   - Caminho: `obras.html#fachadas` › M04 › CtaBand "Quer uma obra assim?" › `orcamento.html?tipo=fachadas&de=obras/reboco-e-tratamento-de-fachada`.
   - Por cima do formulário aparece "Pedido para: **Fachadas e Impermeabilização** · alterar".
   - O campo escondido `pagina` regista a obra de origem, para o dono saber o que vendeu.
3. **Visitante que pensa por serviço**
   - Na ServiceList da home, a linha "Fachadas e Impermeabilização" tem uma miniatura da obra com corda e duas ligações: "Ver obras (1)" (`obras.html#fachadas`) e "Pedir orçamento".
   - Os serviços sem obra (Espaços Comerciais, Apartamentos, Trabalhos de Estrutura) mostram só "Pedir orçamento". Não há promessas vazias.
4. **Administrador de condomínio a verificar a empresa**
   - Vê o telefone no cabeçalho de todas as páginas.
   - Em "Porquê Nós" encontra a TrustList e "Quem somos". Quando o dono der os dados, aparecem também o alvará, o seguro, o NIF e a morada, no rodapé e na lateral de `orcamento.html`.
   - Não precisa de sair do site para confirmar quem é a empresa.
5. **Quem só quer ligar ou mandar WhatsApp**
   - Desktop: telefone e ícone de WhatsApp no cabeçalho.
   - Telemóvel: a barra.
   - Em todas as CtaBand: o número grande e o botão de WhatsApp. O horário aparece quando existir.
6. **Envio falhado**
   - Os dados escritos ficam no formulário e o foco vai para o alerta: "O pedido não seguiu. Tente outra vez, ligue 961 245 288 ou envie por WhatsApp."
   - O link de WhatsApp vem preenchido com o nome e o tipo escritos.
7. **Depois de enviar**
   - `obrigado.html` não tem "Pedir Orçamento" em lado nenhum. As saídas são WhatsApp com fotografias, Ligar e Ver as obras.
   - Sem JS, o Netlify serve a mesma página.
8. **Teclado e leitor de ecrã**
   - Ordem: skip link › cabeçalho › botões do hero (foco ink sobre paper) › cartões de obra (foco amber sobre ink) › CtaBand (foco ink sobre clay).
   - Os títulos seguem H1 › H2 › H3 sem saltos nem duplicados.
   - O menu fecha com Esc e devolve o foco ao botão.
   - O slider funciona com as setas do teclado.

---

## Plantas das páginas

Legenda: `[superfície] Componente`. Os textos são os já existentes, salvo quando estão marcados NOVO (texto de interface, sem factos) ou *dado do dono*.

### Comum a todas as páginas

- **Header** (`[paper]`, sticky, 78px; 64px abaixo de 980px)
  - Desktop: logo › nav "Início", "Obras" › link tel "961 245 288", com o horário por baixo quando existir › ícone WhatsApp 44x44 (`aria-label` "Falar por WhatsApp") › `.btn` "Pedir Orçamento".
  - Abaixo de 980px: logo e botão de menu de 48x48 com 3 barras CSS que viram X. O painel é `[ink]` sobre um fundo escurecido `rgba(15,22,40,.5)`, com `html{overflow:hidden}` enquanto aberto e fecho com Esc ou clique fora.
  - Itens do painel: a mesma lista, mais Pedir Orçamento, Ligar e WhatsApp, cada um com 48px de altura.
  - Variante `reduzido` (só em `obrigado`): logo e telefone.
  - Em `orcamento.html`, o botão é substituído pelo texto "Orçamento gratuito" com `aria-current="page"`.
- **ActionBar** (só abaixo de 980px)
  - Fixa em baixo, 3 células de 56px mais `env(safe-area-inset-bottom)`: Ligar (ink), WhatsApp (ink), Orçamento (clay com texto ink, leva `?tipo=` quando a página o conhece).
  - O `body` recebe `padding-bottom` igual à altura da barra.
  - Meta `barra: "sem-orcamento"` em `orcamento.html`: a terceira célula passa a "Enviar fotografias". Meta `barra: "nao"` em `obrigado.html`.
  - Não há bolha flutuante nenhuma: em desktop o cabeçalho já tem os três canais.
- **Footer** (`[ink]`), 3 colunas
  - Marca: logo com `loading="eager"`, "Melperfaz, Construção Civil, Lda. Reabilitação de edifícios, espaços comerciais e apartamentos. Mãos à obra desde 2001." e "Trabalhamos em {zona}" (*dado do dono*).
  - "Site": as ligações listadas no mapa do site.
  - "Contactos": Ligar, Falar por WhatsApp, depois email, morada, horário e Google Maps (*dados do dono*).
  - Linha de baixo: "© {ano} Melperfaz, Construção Civil, Lda." mais NIF e "Alvará n.º …" quando existirem, e o Livro de Reclamações.
  - Saem: "25 Anos (2001–2026)", o "Empresa Licenciada" solto e os 4 links de serviço iguais.
  - Todos os links têm `display:block` e 44px de altura mínima.

### index.html

O ritmo de fundos é paper › ink › paper › bone › clay › rodapé ink.

| # | Secção | Função | Componente e conteúdo |
|---|---|---|---|
| 1 | `[paper]` Hero | Quem, o quê, ação | **Hero (variante split do DS)**, grelha 1.15fr/.85fr, padding 80/90 (50/50 abaixo de 640px; ver «Ritmo de secções»).<br>Esquerda: Eyebrow "Reabilitação e construção" (+ " · {zona}", *dado do dono*); h1 "Reabilitamos *de raiz.*" com o estilo `display-hero`, `clamp(2.6rem,9vw,5rem)`; lead (muted, máx. 480px) "Reabilitação de edifícios, espaços comerciais e apartamentos. Da estrutura ao acabamento, com uma equipa responsável do início ao fim."; botões `.btn` "Pedir Orçamento" e `.btn-ghost` "Ligar 961 245 288", ambos com a mesma altura; texto de apoio "Visita e orçamento gratuitos, sem compromisso."; ProofLine.<br>Direita: foto-01 (a carrinha) em moldura 4:3, `sizes="(max-width:980px) calc(100vw - 32px), 520px"`; um único cartão "25 / anos, desde 2001", sem rotação, no canto de baixo (abaixo de 640px sobe para o canto de cima e encolhe, para não tapar a carrinha); legenda em texto simples, sem link.<br>No telemóvel: texto, botões, ProofLine e depois a foto. |
| 2 | `[ink]` Obras em destaque `#obras` | Prova primeiro | SectionHead: "Obras" / "Obras nossas, fotografadas no local" / "Fotografias tiradas durante e no fim de cada trabalho."<br>**ProjectGrid** com as 3 obras `destaque` (M01 reabilitação, M04 fachadas em `p-tall`, M05 acabamentos com a etiqueta "Antes e depois").<br>Por baixo, alinhado à esquerda: `.btn-ghost` "Ver as 5 obras" (o número vem dos dados). |
| 3 | `[paper]` Serviços `#servicos` | O que fazem e onde está a prova | SectionHead: "O que fazemos" / "Construção e reabilitação, do alicerce ao acabamento".<br>**ServiceList** com 6 linhas, 2 colunas (1 abaixo de 640px), separadas por uma linha de 1px e sem caixas. Cada linha: número (na linha de base do h3), h3, uma frase do texto atual, miniatura 64x64 se o serviço tiver obras (a todas as larguras), e as ligações "Ver obras (N)" (`obras.html#cat`, só se N>0) e "Pedir orçamento" (`orcamento.html?tipo=id`). A linha em si não é um link e não tem seta.<br>Alvo de altura: cerca de 1.500px a 390px (hoje 2.542px). *Corrigido na revisão:* com o ritmo de secções e as miniaturas de 64px a secção mede cerca de 930px em desktop (os 640px eram uma estimativa que o próprio ritmo do plano não deixa cumprir); o alvo que vale é o da página inteira (cerca de 4.300px a 1440px). |
| 4 | `[bone]` Porquê Nós `#porque-nos` | Confiança verificável | Esquerda: SectionHead "Porque nos escolhem" / "Reputações constroem-se uma obra de cada vez"; **TrustList** com os 4 itens atuais (o item "Licenciada" acrescenta ", alvará n.º X" e o seguro quando existirem); parágrafo "Quem somos": "A Melperfaz, Construção Civil, Lda. trabalha desde 2001 com equipa própria." mais zona e morada (*dados do dono*).<br>Direita: foto-02 numa moldura 4:5 (substitui o stat card), com o link "Ver a obra"; "Ver o perfil e as avaliações no Google" só se `googleMaps` existir (as avaliações nunca são citadas no site). |
| 5 | `[clay]` **CtaBand** `#contacto` | Fechar | Esquerda: Eyebrow "Vamos conversar" (texto e traço ink); h2 "Peça o orçamento. A visita é gratuita."; p "Respondemos no prazo de um dia útil e marcamos uma visita sem compromisso."; `.cta-phone` "961 245 288" com o horário por baixo (*dado do dono*, substitui "Mãos à obra").<br>Direita: botões empilhados com a mesma largura (mín. 280px, 100% no telemóvel): "Pedir Orçamento" (fundo ink, texto paper) e "Falar por WhatsApp" (ghost); ProofLine em ink. |

O processo (4 passos) passa para `orcamento.html`, onde responde a "o que acontece depois de enviar". Alvo de altura da home: cerca de 4.300px a 1440px e menos de 6.000px a 390px, medido sem os dados do dono (com todos preenchidos cresce cerca de 380px a 390px; ver «Onde o site construído difere do plano»).

### obras.html

| # | Secção | Componente |
|---|---|---|
| 1 | `[paper]` PageHead | Migalhas "Início › Obras"; eyebrow "Obras"; h1 "Cada fotografia é uma obra nossa"; intro "Fotografias tiradas no local, durante e no fim de cada trabalho. Abra uma obra para ver o que se fez."; índice gerado "Reabilitação de Edifícios (2) · Fachadas e Impermeabilização (1) · Acabamentos (2)" (as categorias sem obras são omitidas). |
| 2–4 | Uma secção por serviço com obras, alternando `[ink]`/`[bone]`/`[ink]`, `id=<cat>` | h2 com o nome do serviço e o número de obras, depois **ProjectGrid** (2 colunas, linhas de 300px). Os cartões são h3, o que dá H1 › H2 › H3. Um grupo de 1 obra fica com meio cartão alinhado à esquerda dentro da sua própria secção, por isso não parece um buraco. Funciona sem JS. Sem slider. |
| 5 | `[clay]` CtaBand | h2 "Quer uma obra assim?". É a última secção antes do rodapé ink. |

Se a última secção de categoria for ink, sai clay e depois o rodapé ink, sem ink a encostar a ink. A alternância começa no paper do PageHead.

### obras/<slug>.html (template `src/templates/obra.html`)

| # | Secção | Componente |
|---|---|---|
| 1 | `[paper]` PageHead | Migalhas "Início › Obras › {title}"; eyebrow = nome do serviço (link para `obras.html#cat`, sem código); h1 com o título; intro com o resumo. |
| 2 | `[paper]` Media | A foto à largura do contentor, na proporção natural, máximo 78vh. Só na M05: o **BeforeAfter** à largura do contentor, com `margin:0` e alinhado com o h1. |
| 3 | `[paper]` O trabalho | Grelha 7/5, com os dois títulos alinhados no topo.<br>Esquerda: h2 "Na obra" com a lista `detalhes`. Quando o dono preencher os factos, aparecem antes "O problema" e "O que fizemos".<br>Direita: **Ficha** só se `obra.temFactos` (Local, Data, Duração, Resultado). Saem "Código" e o "Trabalho" duplicado. |
| 4 | `[clay]` CtaBand | Eyebrow "Vamos conversar"; h2 "Quer uma obra assim?"; p "Peça o orçamento com o tipo de obra já escolhido, ou envie fotografias do seu espaço por WhatsApp."; botões "Pedir Orçamento" (`?tipo=` e `?de=`) e "Enviar fotografias por WhatsApp" (mensagem `wa.obra` com o código); linha pequena "Referência da obra: M04"; telefone; ProofLine. |
| 5 | `[bone]` Outras obras | Eyebrow e h2 com a mesma regra (`relEyebrow` e `relTitulo`): "Obras semelhantes" / "Outras obras de {serviço}" só quando as duas são do mesmo serviço; senão "Obras" / "Outras obras" (o eyebrow não diz "semelhantes" de obras de outro serviço); 2 cartões. Sem anterior/seguinte e sem "Ver todas" (as migalhas já fazem esse papel). |

Ritmo: paper › clay › bone › rodapé ink. Ink já não encosta a ink.

### orcamento.html (nova)

| # | Secção | Componente |
|---|---|---|
| 1 | `[paper]` PageHead compacto (padding 50/38) | Migalhas "Início › Pedir Orçamento"; eyebrow "Orçamento gratuito"; h1 "Peça o seu orçamento"; intro "Respondemos no prazo de um dia útil e marcamos uma visita gratuita e sem compromisso." |
| 2 | `[paper]` Principal, grelha 1.1fr/.9fr (abaixo de 980px o formulário vem primeiro) | **QuoteForm** (cartão branco, linha de 1px, padding 38; 26 no telemóvel, largura 100%).<br>Linha "Pedido para: **X** · alterar" quando há `?tipo=`.<br>Campos: Tipo de obra (select gerado de `servicos` mais "Outro") › Nome\* › Telefone\* ("Para combinarmos a visita.") › Localidade (opcional, NOVO) › Email (opcional) › Mensagem (opcional, placeholder "Descreva a obra: o que quer fazer, onde e para quando.").<br>Legenda "\* obrigatório"; etiquetas de 14px; campos de 16px; botão a toda a largura "Enviar pedido de orçamento"; nota de privacidade.<br>Campo escondido `pagina` preenchido a partir de `?de=`.<br>**Lateral** `[bone]`: (a) "Prefere falar já?" com `.cta-phone`, o horário e "Enviar fotografias por WhatsApp"; (b) "O que acontece a seguir", os 4 passos atuais (Consulta, Projeto e Orçamento, Execução, Entrega) em lista numerada; (c) TrustList condensada (só títulos) mais alvará e seguro quando existirem; (d) foto-03 com a legenda "Uma das nossas obras", em lazy load. |

Esta página não tem CtaBand: é ela a ação. Segue-se o rodapé.

### obrigado.html

Cabeçalho reduzido, sem ActionBar e sem "Pedir Orçamento" no rodapé.

- `[paper]` PageHead alinhado à esquerda: eyebrow "Pedido enviado"; h1 "Obrigado. Entraremos em contacto no prazo de um dia útil."; lead "Se tiver fotografias do local, envie-as por WhatsApp: ajudam a preparar o orçamento."
- Botões `.btn` "Enviar fotografias por WhatsApp" (`wa.pedido`) e `.btn-ghost` "Ligar 961 245 288".
- Link-seta "Ver as obras".
- É também o destino do envio por JS (`location.assign`), para haver uma só experiência de sucesso.

### privacidade.html

- `[paper]` PageHead (deixa de usar `.work`).
- Índice com links de 44px.
- Texto com largura máxima de 760px, encostado à esquerda.
- **Ficha** do responsável pelos dados (nome legal sempre; NIF, morada e email quando existirem).

### 404.html

- `[paper]` PageHead: eyebrow "Erro 404", h1 "Esta página não existe".
- Ações: `.btn` "Pedir Orçamento", links-seta "Ver as obras" e "Voltar ao início".

---

## Sistema de componentes e grelha

### Tokens (de `tokens.css`, sem valores novos inventados)

- **Cor**: `--ink #1b2540`, `--clay #e08a1e`, `--clay-deep`, `--amber #f0a838`, `--paper`, `--bone`, `--white`, `--muted #5c6479`, `--line`, `--ink-deep`, `--ink-raised`, `--bone-70/-15`, `--overlay`, `--whatsapp`. O foco usa `--focus` (ink) e `--focus-on-ink` (amber). *Mudado a pedido do dono:* os valores são agora verde e vermelho, com os mesmos nomes (ver «Onde o site construído difere do plano», ponto 13).
- **Espaço** (só estes): `--space-2, 6, 12, 16, 18, 22, 26, 32, 36, 38, 44, 50, 60, 64, 80, 90, 110`.
- **Bordas e raios**: hairline 1, control 1.5, rule 2. Raio 0 em todo o lado (o pill deixa de ser usado).
- **Layout**: `--container 1240px`, `--sec-head-width 640px`, `--nav-height 78px`, `--photo-row 300px`.

### Grelha e breakpoints

- `.wrap`: `max-width: var(--container)`, `padding-inline: 32px` (16px até 640px). Todo o texto, cartão, legenda e botão vive dentro de uma `.wrap` e começa na borda dela.
- Breakpoints: só `--bp-tablet 980px` (o cabeçalho colapsa, as grelhas de 2 colunas empilham e aparece a ActionBar) e `--bp-mobile 640px` (1 coluna e paddings reduzidos). Qualquer outro `@media` falha no `--check`.
- Os filhos flex e grid de secção têm `width:100%`. Isto corrige o desvio de 104px do hero.

### Ritmo de secções

- `.sec`: padding `--space-80` em cima e em baixo (`--space-50` abaixo de 640px). SectionHead com `--space-44` até ao conteúdo (`--space-38` abaixo de 640px). *Corrigido na revisão:* um passo de token abaixo dos 90/60 e 50 de antes (o design system tem 110 e 64), para a página inicial caber nos alvos de altura da Fase 7 (menos de 6.000px a 390px e cerca de 4.300px a 1440px); com os 90/60/50 passava os 6.000px a 390px. Hero 80/90 (50/50 abaixo de 640px); rodapé 64/44.
- Superfícies (ideia da proposta Portfólio): cada secção tem uma classe `.s-paper`, `.s-bone`, `.s-ink` ou `.s-clay`, que define `--fg`, `--fg-2`, `--rule`, `--eyebrow-rule` e `--focus-c`. Os componentes só leem estas variáveis.

| Superfície | Texto | Secundário | Traço do eyebrow | Foco |
|---|---|---|---|---|
| paper / bone | ink | muted | clay | ink |
| ink | bone | bone-70 | amber | amber |
| clay | **ink** | ink (sem opacidade) | **ink** | ink |

*Mudado a pedido do dono* (ponto 13 de «Onde o site construído difere do plano»): com o clay vermelho, a linha do clay
passa a branco em tudo (texto, secundário, traço e foco), e o botão na faixa a paper com texto ink.

- Duas secções ink nunca se tocam. A CtaBand clay é a última antes do rodapé ink (exceto em `orcamento`; nas obras vem a seguir uma secção bone).

### Escala tipográfica (estilos do DS; tudo o resto é apagado, de 29 tamanhos para 10)

| Estilo | Uso |
|---|---|
| `display-hero` clamp(2.6rem, 9vw, 5rem) | h1 da home, só |
| `heading-section` clamp(2.2rem, 6vw, 3.4rem) | h2 de secção e h1 das páginas interiores |
| `heading-cta` clamp(2.4rem, 6vw, 3.6rem) | h2 da CtaBand |
| `heading-card` 1.5rem | títulos de cartão e h2 dos grupos de obras |
| `heading-step` 1.25rem | passos, títulos da lateral |
| `heading-list` 1.12rem | linhas de serviço, TrustList |
| `lead` 1.15rem | lead do hero e intro do PageHead |
| `body` 1rem / 1.6 | texto, **todos os campos de formulário (16px)** |
| `category` **0.8125rem (13px) mínimo**, maiúsculas, `letter-spacing .08em` | eyebrow, `.cat`, `dt`, cabeçalhos do rodapé, etiquetas, texto de botão |
| `.cta-phone` 2.4rem Fraunces | telefone na CtaBand e na lateral do orçamento |

As etiquetas de formulário ficam em 0.875rem, sem maiúsculas. Apagar o `.prosa h2` duplicado.

### Regras de cor (AA)

- `.btn` (primário): fundo clay, texto ink (5,65:1). No hover: fundo ink, texto paper. Dentro de `.s-clay`: fundo ink, texto paper (14,6:1).
- `.btn-ghost` (o único secundário): fundo transparente, `color: var(--fg)`, `box-shadow: inset 0 0 0 1.5px currentColor`, com a mesma altura do `.btn`. Apagar `.btn-ghost-ink` e `.btn-ghost-paper`.
- Nunca usar clay como cor de texto sobre superfícies claras: o eyebrow é ink e só o traço de 34px é clay.
- Foco: `:focus-visible { outline: 3px solid var(--focus-c); outline-offset: 3px }`.
- Atualizar o DESIGN.md: "paper sobre clay" passa a ser proibido.
- *Mudado a pedido do dono* (ponto 13 de «Onde o site construído difere do plano»): com o clay vermelho, é o contrário.
  O `.btn` é clay com texto branco (5,9:1), na faixa clay é paper com texto ink, e o proibido é texto escuro sobre o
  vermelho (ink sobre clay dá 2,2:1).

### Componentes permitidos (e mais nenhum)

| Componente | Ficheiro | Notas |
|---|---|---|
| Header + MenuPanel | `partials/header.html` | Uma lista `site.json › menu` desenhada duas vezes; variante `reduzido` |
| ActionBar | `partials/barra-acoes.html` | Substitui `whatsapp.html` |
| Footer | `partials/footer.html` | 3 colunas, dados do dono com `{{#se}}` |
| Hero (split do DS) | em `index.html` | Apagar `.hero-cheio`, `.hero-factos`, `.hero-tag2` |
| PageHead | `partials/page-head.html` | Substitui `.pag-cab`, `.obra-cab`, `.pag-simples` e as regras duplicadas de `.migalhas` |
| SectionHead | `.sec-head` existente | Eyebrow, h2, p, alinhado à esquerda |
| Eyebrow | CSS | Traço e texto pela superfície |
| Button (`.btn`, `.btn-ghost`) | CSS | Grupo `.acoes`: gap 12, no telemóvel todos com 100% e a mesma largura |
| Links | CSS | Só dois: `.link` (sublinhado, offset 3px) e `.link-seta` ("Texto →", Archivo 600, padding 10px 0) |
| ProofLine | `partials/prova.html` | `site.json › provas` mais alvará se existir |
| ProjectGrid / ProjectCard | `partials/obra-foto.html` | `.photo-grid` do DS: 2 colunas, gap 18, linhas de 300px, `.p-tall` opcional. A legenda passa para baixo da imagem abaixo de 640px, com proporção 4/5 (retrato) ou 4/3 (paisagem) e `object-position` a partir de `foco`. *Exceção, a aprovar pelo dono:* as obras em destaque da página inicial ficam com a legenda por cima da fotografia também abaixo de 640px (cartão de 280px, faixa só à medida do texto, sem "Ver obra"), porque com a legenda por baixo (em 4:3, e mesmo em 16:9) a página inicial passa os 6.000px a 390px. A legenda está em fluxo (a linha cresce com o texto maior) e o cartão inteiro é a ligação. O nível de título é um parâmetro (`cartaoH`). Sem `.mosaico`. |
| ServiceList | bloco em `index.html` (`{{#cada servicos}}`) | Linhas sem caixa e sem seta; ligações alinhadas com `margin-top:auto` |
| TrustList | DS | `tick` de 1rem |
| BeforeAfter | `partials/antes-depois.html` | Só no template de obra (M05); `touch-action: pan-y`; arrasto só a 32px da pega; range para teclado com foco desenhado na pega; etiquetas de 13px |
| Ficha | CSS único | Fundo bone, 1px de linha, padding 32, `dl` em 2 colunas; só aparece se tiver pelo menos 1 linha; substitui `.ficha` e `.priv-ficha` |
| CtaBand | `partials/cta.html` (parâmetros: titulo, texto, tipo, wa) | Um só layout; apagar `.cta-faixa` e `.cta-inner` |
| QuoteForm | `partials/orcamento-form.html` | Só em `orcamento.html` |

**Apagados:** Marquee (`.strip`), StatCard, `tag-card` rodado, `wa-float` e a sua pulsação, chips e `.filtros` (voltam automaticamente com 8 ou mais obras), `.obra-nav`, `.work-mais`, `.form-novo`, `.pag-links`, o link `.hero-foto-leg` e o `catLabel` em texto livre.

### Vocabulário (`data/site.json › servicos`)

| id | nome | cat |
|---|---|---|
| `reabilitacao` | Reabilitação de Edifícios | reabilitacao |
| `comercial` | Espaços Comerciais | (vazio) |
| `apartamentos` | Apartamentos | (vazio) |
| `estrutura` | Trabalhos de Estrutura | (vazio) |
| `fachadas` | Fachadas e Impermeabilização | fachadas |
| `acabamentos` | Acabamentos | acabamentos |

Cada serviço tem também `texto`, copiado tal qual dos cartões atuais. O formulário acrescenta "Outro". As opções do formulário, os eyebrows e `.cat` das obras, os grupos do catálogo, o rodapé e `?tipo=` usam todos `servicos.id` e `servicos.nome`.

---

## Acessibilidade e desempenho

**Contraste**
- Ink sobre clay em todos os botões e em todo o texto da CtaBand.
- Eyebrows em ink sobre fundos claros e em bone ou amber sobre ink.
- Rótulos `.cat` em muted sobre claro e amber sobre ink.
- A verificação automática mede todos os `.btn` e `.s-clay *` com `getComputedStyle` e exige 4,5:1 ou mais.

**Foco**: anel por superfície (amber no ink, ink no claro e no clay). Os primeiros elementos depois do menu deixam de estar sobre foto escura.

**Alvos de toque**
- 44px ou mais no rodapé, nas migalhas, no índice de privacidade e no menu (48px).
- Botão do menu de 48x48 com barras SVG ou CSS.

**Títulos**
- H1 único por página.
- `obras.html`: H1 › H2 por serviço › H3 por obra.
- Acaba o h3 duplicado da M05.

**Movimento**: sem animações infinitas (o marquee sai, a pulsação contínua sai). Ícones SVG animados e tokens de movimento, ver Fase 5b. O `.reveal` mantém-se e é desligado com `prefers-reduced-motion`.

**Menu móvel**: fundo escurecido, scroll bloqueado, Esc, e o foco volta ao botão.

**Formulário**
- Campos de 16px.
- Obrigatórios marcados com "\*".
- "(opcional)" no email.
- Erros ligados com `aria-describedby`.
- O alerta recebe o foco.
- Os dados nunca se perdem.

**Imagens**
- Hero em moldura 4:3 com `sizes` correto: acaba a ampliação de 3,7x. `fetchpriority="high"` só na imagem LCP.
- Cartões com `sizes="(min-width:981px) 600px, calc(100vw - 32px)"` e proporção 4/5 ou 4/3 no telemóvel (o `sizes` do telemóvel conta com o corte de uma fotografia mais deitada do que a moldura). Num telemóvel de 3x pede-se a imagem de 2x da largura do telemóvel, seja qual for a ordem das entradas do `sizes`.
- Miniaturas de serviço com o AVIF de 400w.
- Recortar a faixa preta da foto-05 com `gerar_fotos.py` se estiver nos derivados. Se estiver no original, perguntar ao dono.

**Peso e velocidade**
- `<link rel="prefetch">` da página do pedido em todas as páginas que levam a ela, com o endereço dos botões da página (nas fichas de obra, com `?tipo=` e `?de=`, para o prefetch servir). Não em `orcamento.html` (é ela) nem em `obrigado.html` (não leva lá).
- `orcamento.html` sem imagem de topo; uma única foto em lazy load na lateral.
- Logótipo do rodapé com carregamento imediato (é pequeno).
- O CLS mantém-se em 0 (`width` e `height` em todas as imagens).

**Sem JS**: menu e links funcionam, o formulário publica para `/obrigado.html` e as âncoras do catálogo funcionam. Só o "Pedido para:" e o reencaminhamento de `#contacto` dependem de JS, e nenhum dos dois é crítico.

---

## Plano de implementação

Tudo em `/home/user/MDM/melperfaz`. O build continua a ser `python3 build.py`. Os testes ficam em `tests/` (Node + Playwright, `tests/site.test.mjs`).

### Fase 0: rede de segurança
- Capturar os ecrãs atuais (375, 768, 1280, 1440) de todas as páginas, como referência "antes".
- Correr `python3 build.py --check` e os testes atuais e registar o estado de base.
- **Teste:** as duas coisas passam, ou o que falha fica anotado como pré-existente.

### Fase 1: dados e vocabulário
- `data/site.json`:
  - substituir `tiposDeObra` por `servicos` (6 entradas, textos copiados tal qual de `src/pages/index.html`)
  - acrescentar `provas`, `["Equipa própria","Orçamento a preço fixo","2 anos de garantia de execução"]`, só com texto já existente
  - acrescentar `menu` (Início e Obras)
  - acrescentar `wa.erro`: "Olá! Sou {nome} e queria um orçamento para {tipo}. O formulário do site não enviou."
- `data/obras.json`:
  - apagar `catLabel` em todas as obras (a demolição da M05 já está nos `detalhes`)
  - `"destaque": true` em M01, M04 e M05
  - acrescentar a `factos` as chaves `problema` e `trabalho`, vazias
  - acrescentar `fotosExtra: []`
  - derivar `categorias` dos `servicos`
- `build.py`:
  - substituir `CAT_TIPO` e `TIPOS_DE_OBRA` por `SERVICOS`
  - em `campos_obra`, preencher `servico`, `orcamentoHref` (`../orcamento.html?tipo=<id>&de=obras/<slug>`), `temFactos` e `catAnchor`
  - contexto: `servicos` (cada um com `obrasN` e `primeiraFoto`), `provas`, `menu`, `cartaoH`, e o seletor `destaque` em `{{each}}`
  - `FORM_CAMPOS` passa a incluir `localidade`
  - `--faltam` passa a listar também os `factos` vazios de cada obra
- **Teste:** `python3 build.py --check` passa. `--faltam` mostra zona, horário, alvará, seguro, NIF, morada, email, googleMaps e os factos das 5 obras.

### Fase 2: fundações CSS (`assets/css/site.css`)
- Bloco de superfícies `.s-paper/.s-bone/.s-ink/.s-clay` e foco por superfície.
- `.btn` com ink sobre clay. Um único `.btn-ghost` com `inset box-shadow`.
- Eyebrow por superfície, o que corrige o traço invisível na CTA.
- `.wrap` com 16px até 640px. Os filhos flex e grid do hero com `width:100%`.
- Mapear todos os `font-size` para os 10 estilos. Etiquetas com 13px de mínimo. `input, select, textarea { font-size: 1rem }`.
- Substituir os cerca de 40 px soltos por tokens: 24→22, 10/14→12, 28/30→26 ou 32, 34/40→38 ou 44, 56→60, e retirar o `calc(110px + 40px)`.
- Apagar `.strip`, `.stat-card`, `.tag-card` rodado, `.hero-tag2`, `.hero-cheio`, `.wa-float`, `.chip`, `.filtros`, `.obra-nav`, `.cta-faixa*`, `.btn-ghost-ink/-paper`, `.pag-simples`, `.photo-grid.mosaico`, e as regras duplicadas de `.pag-cab`, `.migalhas` e `.prosa h2` em `pag-obras.css` e `pag-paginas.css`.
- Remover todas as animações `infinite`.
- **Lint novo no `build.py --check`** (ideia da proposta Sistema). Falha quando encontra:
  - `px` em margin, padding, gap ou inset fora do `:root` (com uma pequena lista de exceções comentada: hairlines e `safe-area`)
  - `font-size` fora dos estilos
  - `@media` diferente de 980 e 640
  - `color` paper ou white em seletores sob `.s-clay` ou `.btn`
  - `infinite`
- **Teste:** `--check` passa com o lint ativo. O screenshot a 1280 mostra o x do h1 do hero igual ao x do logótipo.

### Fase 3: partials (`src/partials/`)
- **Novos**: `page-head.html`, `cta.html`, `prova.html`, `barra-acoes.html`, `orcamento-form.html` (formulário movido de `contacto.html`, campos reordenados, `localidade`, marcadores "\*", contentores `[data-pedido-para]` e `#formAlerta`).
- **Reescritos**:
  - `header.html`: uma lista, tel, WhatsApp, botão, painel com fundo escurecido, variante `reduzido`
  - `footer.html`
  - `obra-foto.html`: ProjectCard com nível de título parametrizado e legenda abaixo da imagem no telemóvel (menos nas obras em destaque da página inicial, ver ProjectGrid)
  - `antes-depois.html`: `margin:0`, touch, foco
- **Apagados**: `contacto.html` e `whatsapp.html`. Em `src/templates/layout.html`, incluir `barra-acoes.html` exceto quando `page.barra == "nao"`.
- Se `{{> partial}}` não aceitar parâmetros, passá-los por chaves de meta ou de `ctx`, com o mesmo mecanismo já usado para `ficha` e `baLoading`.
- **Teste:** o `--check` confirma que não há links partidos e que todos os `href` de "Pedir Orçamento" apontam para `orcamento.html`.

### Fase 4: páginas (`src/pages/`, `src/templates/obra.html`)
- `index.html`: Hero split › Obras em destaque › ServiceList › Porquê Nós › CtaBand `#contacto`. Script de reencaminhamento de `#contacto` e `?tipo=` no topo do `<head>`, antes das letras, do CSS e do prefetch (um script depois de uma folha de estilo espera por ela).
- `obras.html`: PageHead, secções por serviço (só as que têm obras) com `cartaoH` 3, CtaBand.
- `templates/obra.html`: PageHead › Media (foto, ou BeforeAfter na M05) › "Na obra" com a Ficha condicional › CtaBand com "Referência da obra" › Outras obras em bone.
- `orcamento.html` (nova): meta `nav: orcamento`, `barra: sem-orcamento`, css `pag-orcamento.css`, JSON-LD breadcrumb, indexável e incluída no sitemap.
- `obrigado.html` (`header: reduzido`, `barra: nao`), `privacidade.html` e `404.html` passam a usar PageHead e Ficha.
- `check_formulario` passa a esperar o formulário só em `orcamento.html`. O `--check` falha se aparecer `index.html#contacto` em qualquer `href`, ou "Pedir Orçamento Gratuito", "Orçamento Gratuito" (como rótulo de link) ou "Chamar no WhatsApp".
- **Teste:** `python3 build.py && python3 build.py --check`. Grep em `public/` por `#contacto` e pelos rótulos proibidos devolve 0. Os textos continuam sem travessões nem emoji (verificação já existente).

### Fase 5: JS (`assets/js/site.js`)
1. Em `orcamento.html`:
   - ler `?tipo=` e selecionar `#qTipo`
   - mostrar "Pedido para: X · alterar" (alterar dá foco ao select)
   - passar `?de=` para o campo escondido `pagina`
2. Ao enviar com sucesso: `location.assign('obrigado.html')`. Em caso de erro, mostrar a mensagem nova e um link `wa.erro` com `encodeURIComponent` do nome e do tipo, e dar foco ao alerta.
3. Menu: fundo escurecido, `html.menu-aberto{overflow:hidden}`, Esc e clique fora fecham, o foco volta ao botão, e as barras viram X através de `aria-expanded`.
4. Slider: arrasto só a 32px da pega, `pan-y`, range para teclado.
5. Apagar os handlers de `data-preselect`, o código dos chips e o scroll-spy.
- **Teste:** `tests/site.test.mjs` passa a incluir:
  - `orcamento.html?tipo=fachadas` mostra a linha certa e o select certo
  - o envio falhado localmente mostra o alerta com o link de WhatsApp e mantém os valores
  - o menu fecha com Esc
  - o slider move-se com as setas

### Fase 5b: ícones e movimento suave
- **Tokens de movimento** em `site.css`: `--dur-1: 150ms`, `--dur-2: 250ms`, `--dur-3: 500ms`, `--ease-out: cubic-bezier(.2,.7,.3,1)`, `--ease-in-out: cubic-bezier(.65,0,.35,1)`. O lint do `--check` passa a recusar durações e curvas fora destes tokens.
- **Ícones SVG** em `src/partials/icones.svg` (seta, menu, fechar, telefone, WhatsApp, visto, setas do comparador), traço 1,75px, `currentColor`. Novo marcador `{{icone nome}}` no `build.py`. Substitui os caracteres `→`, `≡` e `✓`.
- **Animações dos ícones:**
  - menu: as 3 barras viram X com `aria-expanded` (250ms)
  - setas: avançam 4 a 6px em hover e `:focus-visible` (150ms)
  - vistos da lista: desenham-se com `stroke-dashoffset` ao entrar no ecrã, em cascata de 80ms
  - telefone: abanão curto, uma vez, em hover
  - WhatsApp: pulsa 2 vezes ao carregar e para (nada `infinite`)
  - comparador: as setas afastam-se ao agarrar
  - pedido enviado: visto desenhado num círculo em `obrigado.html`
- **Suavidade geral:**
  - painel do menu e fundo escurecido entram com fade e slide (250ms)
  - cabeçalho fica compacto e ganha sombra depois de 80px de scroll
  - `scroll-behavior: smooth` só com `prefers-reduced-motion: no-preference`
  - `.reveal` mais curto (16px, 500ms) e em cascata nas grelhas
  - fotografias passam da pré-visualização LQIP para a imagem final com fade
  - botão de envio com indicador de carga
- **Regras:** só `transform` e `opacity`; com `prefers-reduced-motion: reduce` ficam as mudanças de cor e nenhuma deslocação; tudo funciona sem JS; nada passa de 500ms.
- **Teste:** Playwright confirma que o menu vira X, que com reduced-motion nada se desloca, que CLS fica abaixo de 0,05 e que não há animações `infinite`.

### Fase 6: imagens
- Hero com `sizes` correto. Cartões com `sizes` e `object-position` a partir de `foco` (confirmar que a cabeça do trabalhador da M04 fica no enquadramento).
- foto-05: confirmar e recortar a faixa preta com `gerar_fotos.py`, sem gerar imagens novas.
- **Teste:** a 375px, `naturalHeight / renderedHeight` da imagem do hero é 1 ou mais (sem ampliação).

### Fase 7: verificação visual e de acessibilidade (Playwright, 375, 768, 1280, 1440)
- Assertivas automáticas:
  1. o x do h1 do hero é igual ao x do logótipo e ao x do SectionHead em todas as larguras
  2. a altura da home é menor que 6.000px a 390px e cerca de 4.300px a 1440px (sem os dados do dono; ver «Onde o site construído difere do plano», ponto 4)
  3. contraste de 4,5:1 ou mais em `.btn` e `.s-clay`
  4. anel de foco visível nos botões do hero e da CTA
  5. nenhum elemento fixo se sobrepõe a campos ou a botões (com a ActionBar e o `padding-bottom` corretos)
  6. todos os campos com `font-size` de 16px ou mais
  7. hierarquia de títulos sem saltos e sem h3 repetidos
  8. alvos de 44px ou mais no menu, no rodapé e nas migalhas
  9. nenhuma animação infinita
  10. sem overflow horizontal
- Comparar lado a lado com os screenshots da Fase 0.

### Fase 8: publicação
- Deploy no Netlify. Confirmar que o formulário "orcamento" é detetado em `orcamento.html` e que aparece o campo `localidade`.
- Fazer um envio de teste real.
- Durante 4 a 6 semanas, comparar o número de pedidos com o período anterior.

### Fase 9: dados do dono e documentação
- Enviar ao dono a lista do `--faltam` em linguagem simples (ver perguntas abaixo). Cada dado aparece sozinho quando é preenchido e não fica nenhum marcador visível.
- Atualizar o DESIGN.md do cliente:
  - regra de ink sobre clay
  - Marquee, StatCard, tag-cards e hero full-bleed como retirados do site
  - 10 estilos de texto
  - retirar "abaixo de AA, mantidos por fidelidade"

---

## Onde o site construído difere do plano (de propósito)

O que a revisão mudou em relação ao plano acima, e porquê. Cada ponto está também na secção a que diz respeito; os
testes (`tests/site.test.mjs` e `tests/browser.mjs`) conferem o que está construído, não o texto original.

1. **Legenda sobre a fotografia nas obras em destaque da página inicial, também no telemóvel** (*exceção a aprovar pelo
   dono*, ver ProjectGrid). Em `obras.html` e nas outras obras de cada ficha a legenda passa para baixo da fotografia
   abaixo de 640px, como o plano pede; na página inicial fica por cima, num cartão de 280px com a faixa só à medida do
   texto, porque com ela por baixo a página passa os 6.000px a 390px. Se o dono preferir a legenda por baixo também aí,
   o alvo de altura da página inicial tem de subir.
2. **Ritmo de secções um passo de token abaixo** (ver «Ritmo de secções»): `.sec` 80/50 em vez de 90/60, SectionHead
   44/38 em vez de 50, hero 80/90 (50/50 no telemóvel) em vez de 90/110 e rodapé 64/44. Com os valores do plano a
   página inicial passava os 6.000px a 390px.
3. **ServiceList**: as miniaturas são as do plano (64x64, a todas as larguras), mas a secção mede cerca de 930px em
   desktop e não 640px; o alvo que vale é o da página inteira (cerca de 4.300px a 1440px), e esse cumpre-se.
4. **Os alvos de altura da página inicial medem o desenho, sem os dados do dono.** Com todos os dados de
   `dados-melperfaz.json` preenchidos (zona no eyebrow e em «Quem somos», sede, alvará na ProofLine, alvará e seguro em
   «Licenciada & segurada», perfil do Google, horário junto ao telefone, email, morada, horário e mapa no rodapé) a
   página cresce cerca de 380px a 390px e 250px a 1440px (6.360px e 4.590px, medidos com valores de exemplo). O teste
   do browser mede uma cópia com os dados vazios, para o CI não ficar vermelho quando a Melperfaz os der; não se
   tiram dados do dono para caber no alvo.
5. **Os cartões de `obras.html` não repetem o nome do serviço** (o `.cat` por cima do título): o h2 de cada grupo já é
   esse nome (princípio 4, cada facto uma vez por página). A página inicial e as outras obras de cada ficha, que
   misturam serviços, mantêm-no.
6. **O primeiro grupo de `obras.html` não entra ao fazer scroll** (sem `.reveal`): tem a imagem LCP, e o fade atrasava-a
   cerca de meio segundo (ou escondia-a se o JavaScript não corresse). Os outros grupos entram como o plano descreve.
7. **«fotosExtra»** (o plano só dizia que ficam escondidas até existirem): aparecem na ficha da obra, em duas colunas
   por baixo de «Na obra», cada uma na sua proporção e em lazy load.
8. **Os dados do dono nas frases**: «Quem somos» acrescenta «Trabalhamos em {zona}.» e «Sede: {morada}.» (cabe
   qualquer morada, sem artigo); «Licenciada & segurada» acrescenta «Alvará n.º X.» e «Seguro de responsabilidade
   civil: {seguro}.», cada um com o seu rótulo; o `--check` recusa um ponto final no fim destes valores. O rótulo
   «Alvará n.º» fica, e o pedido do `--faltam` pede só o alvará: se a empresa tiver outro título do IMPIC, o rótulo
   muda antes de o número entrar.
9. **As migalhas das fichas de obra ficam numa linha**: o título da obra, o último elemento, acaba em «…» quando não
   cabe (o h1 logo abaixo repete-o inteiro), para o h1 começar à mesma altura que nas outras páginas.
10. **A ligação para a página inicial é a pasta** (`./`, `../` ou `/` na 404), como o canonical e o mapa do site, e
    não `index.html`.
11. **Em `orcamento.html`, «Enviar fotografias»** (a terceira célula da ActionBar e o botão da lateral) abre o WhatsApp
    com a mensagem das fotografias (`site.json › wa.fotos`), diferente da de «WhatsApp» ao lado.
12. **Por fazer, de propósito**: com 400% de zoom (320x256) o cabeçalho fixo e a ActionBar ocupam quase metade do ecrã.
    O foco já nunca fica tapado (o scroll reserva a altura da barra), mas soltar o cabeçalho em ecrãs muito baixos
    precisava de um `@media (max-height: …)`, que a regra das quebras (só 980 e 640px) não deixa. Fica para decidir.
13. **Verde e vermelho, a pedido do dono** (depois do redesenho). O azul-marinho e o laranja deram lugar ao verde e ao
    vermelho. Os nomes dos papéis ficam, para o código continuar legível: `ink` é o verde-floresta #12392b (`ink-deep`
    #0a2a1f, `ink-raised` #194634, `sage` #3b5a4a), `clay` o vermelho #c8102e (`clay-deep` #9b0d24, o vermelho do texto
    sobre o claro) e `amber` um vermelho claro, #ff8a7a, só para texto de acento e foco sobre o verde. Os neutros puxam
    ao verde (`paper` #f7f9f5, `bone` #edf2ec, `line` #d3ddd4, `muted` #56645b) e os `rgba()` saem dos verdes novos.
    As regras de cor viram-se com o vermelho: no clay o texto é branco (5,9:1), nunca ink (2,2:1); na faixa clay o botão
    é paper com texto ink, o ghost tem contorno branco e o foco é branco (ink no claro, amber no ink). O `--check`
    passou a recusar texto escuro sobre o vermelho. Dois acertos à paleta proposta, medidos: o `ink-raised` ficou um
    passo mais escuro do que o #1f5640 (o `.cat` amber da legenda dos cartões no telemóvel ficava a 3,7:1; agora 4,66:1)
    e a faixa da legenda passou de 85% para 90% de `ink-deep` (o `.cat` amber sobre uma fotografia branca ficava a
    4,2:1; agora 5:1). O erro (`--erro` #a3161a) não usa o vermelho da marca: é só texto e contorno, com um «!» branco
    num círculo antes da mensagem. O logótipo, os favicons e a imagem de partilha foram recoloridos para o verde (o
    logótipo branco fica igual); as fotografias não mudam.

---

## Riscos e perguntas para o dono

### Riscos

- **A zona de trabalho continua por responder** até o dono a dar. O design só prepara os sítios onde ela entra (eyebrow do hero, rodapé, "Quem somos", lateral do orçamento) e acrescenta o campo Localidade como remedeio. Convém não promover o site antes disto.
- **As afirmações de confiança não estão verificadas.** "Licenciada e segurada", "2 anos de garantia", "preço fixo" e "atualizações semanais" ficam porque já estão no site. Se o dono não confirmar alguma, sai do site; não se suaviza o texto.
- **Mais uma página antes do formulário.** É compensado pelo prefetch, por uma página leve e por 4 pontos de entrada (cabeçalho, barra, CtaBand, obras). É preciso medir os pedidos depois do lançamento.
- **Mudam os valores do select** (por exemplo "Fachadas / Impermeabilização" passa a "Fachadas e Impermeabilização") **e entra o campo `localidade`.** Filtros de email ou folhas que usem os valores antigos têm de ser atualizados. Os envios antigos mantêm os valores antigos.
- **Ink sobre laranja muda o aspeto dos botões.** É obrigatório para cumprir AA. Mostrar ao dono o antes e o depois em screenshot, com as medições (2,53:1 contra 5,65:1).
- **Um hero split é mais calmo que o full-bleed atual.** É o hero do próprio DS e resolve ao mesmo tempo o alinhamento, o contraste, o foco e a ampliação de 3,7x.
- **Com 5 obras, o portfólio parece curto**, e tirar os duplicados torna isso mais visível. Só cresce com fotografias e factos reais do dono. Nunca usar imagens de banco nem geradas.
- **A ActionBar ocupa 56px no telemóvel.** É preciso testar no iOS Safari, com a barra de endereço a recolher, que não tapa o botão de envio nem os links legais.
- **O lint do `--check` pode bloquear exceções legítimas** (hairlines, `safe-area`). Fica uma lista de exceções curta e comentada, só no bloco de tokens.
- **Saem do site o marquee, o stat card e o processo na home.** O conteúdo do processo não se perde, passa para o lado do formulário. Explicar ao dono como "o mesmo conteúdo, posto onde ajuda o cliente a decidir".

### Perguntas para o dono (por ordem de importância)

1. **Em que concelhos ou distritos trabalham?** (bloqueante)
2. Qual o horário de atendimento do telefone e do WhatsApp?
3. Qual o número do alvará IMPIC? Qual a seguradora de responsabilidade civil?
4. Qual o NIF, a morada da sede e o email público? Há perfil no Google (link do Maps)?
5. Confirma, por escrito, "orçamento a preço fixo", "garantia de execução de 2 anos", "equipa própria" e "atualizações semanais"?
6. Para cada uma das 5 obras: concelho ou freguesia, data, duração, qual era o problema, o que foi feito e o resultado. E 2 a 4 fotografias extra por obra (antes, durante, depois)?
7. Aceita o campo opcional "Localidade" no formulário?
8. A foto-05 (espaço interior) tem a faixa preta no original?
9. Usa os valores atuais do "tipo de obra" em algum filtro de email ou folha de cálculo?
10. Aprova a legenda por cima da fotografia nas obras em destaque da página inicial, no telemóvel (ver «Onde o site construído difere do plano», ponto 1)?

---

## Pontuação das propostas

Escala de 1 a 10. Em "esforço para construir", 10 quer dizer mais fácil.

| Proposta | Resolve os problemas da auditoria | Clareza para um particular | Consistência e rigor do sistema | Esforço para construir | Total |
|---|---|---|---|---|---|
| **1. Conversão primeiro** (base) | 9 | 9 | 8 | 7 | **33** |
| 2. Portfólio primeiro | 8 | 8 | 7 | 6 | 29 |
| 3. Sistema primeiro | 9 | 8 | 10 | 4 | 31 |

**Porque a proposta 1 é a base:**
- Resolve diretamente os problemas críticos: formulário enterrado, telemóvel sem contacto, contraste, hero fora da grelha e foco.
- Fica dentro dos tokens do DS do cliente, sem uma escala nova de 8px.
- Usa o menor número de componentes e as partials e `data/*.json` que já existem.

**Enxertos:**
- **Da 2:** superfícies que definem texto e foco; catálogo agrupado por serviço com âncoras (funciona sem JS, corrige a hierarquia de títulos e evita os buracos); legendas abaixo da imagem no telemóvel; o slider só na M05.
- **Da 3:**
  - o lint no `build.py --check` (px, tamanhos de letra, media queries, paper sobre clay, `infinite`, `#contacto`, rótulos proibidos)
  - `?de=` para o campo `pagina`
  - um só caminho de sucesso (`obrigado.html`)
  - setas e ligações alinhadas com `margin-top:auto`
  - a Ficha como componente único, condicional

**Rejeitados:**
- Da 2: o pill de WhatsApp em desktop com IntersectionObserver e o scroll-spy. São complexidade a mais, porque o cabeçalho já mostra os três canais.
- Da 3: a escala de 8px, que se afasta do DS, e a página `servicos.html`, que ainda não tem conteúdo real suficiente.