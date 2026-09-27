# Lançamento do site MDM v3

**Para:** Carlos Melancia · **Data:** 27/09/2026 · **Site:** `site/v3/` (relançamento para `https://www.mdmassist.com.pt/`)

**Em resumo.** O site novo está construído, corrigido e verificado. Ainda não está publicado em lado nenhum. Os próximos passos dependem de si, por esta ordem:

1. Ligar o GitHub ao projeto Netlify `mdm-site-preview` (secção 3). Sem isto não há endereço para testar.
2. Dizer que email recebe os pedidos do formulário (secção 3, passo 9).
3. Fazer os testes num iPhone e num Android (secção 4).
4. Responder aos pendentes marcados "antes do lançamento" (secção 7).

Depois disso, seguimos a lista da secção 5 e o site passa para `www.mdmassist.com.pt`.

---

## 1. Estado atual

### Páginas

| Página | Endereço | Notas |
|---|---|---|
| Início | `/` | Promessa aprovada, prova, 6 serviços, obras, como funciona, perguntas, formulário |
| Ar condicionado | `/ar-condicionado-lisboa/` | Split, multi-split (com esquema), conduta |
| Bombas de calor | `/bombas-de-calor-lisboa/` | Por agora só águas quentes (AQS), até confirmar o resto (secção 7) |
| Manutenção e assistência | `/manutencao-assistencia-avac-lisboa/` | Contratos de manutenção e avarias |
| Instalações elétricas | `/instalacoes-eletricas-lisboa/` | Com esquema do quadro elétrico |
| Ventilação | `/ventilacao-lisboa/` | Ventilação e extração |
| Obras | `/obras/` | 23 fotografias reais em 4 grupos |
| Pedido enviado | `/obrigado/` | Para quem envia o formulário com o JavaScript desligado |
| Página não encontrada | `/404.html` | Leva à página inicial, ao ar condicionado, ao formulário e ao telefone |
| Política de privacidade | `/privacidade/` | Reescrita para a v3; não indexada e fora do sitemap, de propósito |

As 7 primeiras são as páginas públicas e estão no `sitemap.xml`.

### Contactos e formulário
- O telefone 218 935 050 está no topo em todas as larguras de ecrã.
- No telemóvel há uma barra fixa em baixo: **Ligar · Pedir orçamento · WhatsApp**. Esconde-se quando o formulário está à vista e quando o menu está aberto.
- WhatsApp: no máximo **uma** entrada visível de cada vez. Foi medido em 36 combinações de página e tamanho de ecrã, também depois de enviar o formulário.
- Formulário de orçamento com **Netlify Forms** (no painel do Netlify chama-se `orcamento`):
  - campos: serviço, tipo de imóvel, urgência, localidade, fotografia opcional (até 8 MB), nome e telemóvel ou email;
  - campo escondido contra spam, e outro campo escondido com a página de onde o pedido foi enviado;
  - erros junto a cada campo e num resumo no topo;
  - nas páginas de serviço, o serviço já vem escolhido;
  - a mensagem de sucesso aparece no ecrã e não promete prazo; com "Tenho uma avaria" mostra também o telefone.

### Estatísticas e privacidade
- Banner de consentimento com **Recusar** e **Aceitar** com o mesmo peso (a sua decisão de 27/09/2026).
- O PostHog (estatísticas, servidores na UE) só carrega depois de "Aceitar".
- "Recusar" também desliga o registo de erros (Sentry, servidores na UE).
- A escolha pode ser mudada no rodapé, em "Preferências de estatísticas".
- No código, o PostHog tem desligadas as gravações de sessão, os mapas de calor, os inquéritos e a captura de erros e de desempenho.
- Eventos medidos: visitas de página, toques no telefone (`call_tap`) e no WhatsApp (`whatsapp_tap`), início do formulário (`form_start`) e pedido enviado (`form_submit`).
- Política de privacidade nova, com data de 27 de setembro de 2026.

### Google e assistentes de pesquisa
- Endereço canónico em todas as páginas: `https://www.mdmassist.com.pt/`.
- Dados estruturados (JSON-LD) em todas as páginas: a empresa (AVAC e eletricista), os serviços, o caminho de navegação e as perguntas frequentes.
- `sitemap.xml` com as 7 páginas públicas, `llms.txt` e imagem de partilha 1200x630 (`img/og-v3.jpg`).
- `_redirects` com 2 regras (`/index.html` e `/privacidade.html`). A lista de endereços do site antigo ainda falta (secção 5).
- Enquanto for pré-visualização, o site pede para **não** ser indexado (cabeçalho `X-Robots-Tag: noindex` e `robots.txt` com `Disallow: /`). Isto só sai no lançamento (secção 5).

### Fotografias
- Só fotografias reais da MDM, todas com o mesmo tratamento: tom neutro-quente, contraste +10%, saturação -10%, sem filtros, vinhetas nem desfoque. As legendas ficam sempre por baixo, nunca sobre a fotografia.
- Duas fotografias foram recortadas de novo:
  - `bomba-varanda-deposito`, para tirar a pessoa que aparecia à direita;
  - `midea-cobertura`, para tirar o letreiro do edifício.
- Duas fotografias deixaram de aparecer em qualquer página:
  - `ventilacao-ventilbox`: técnico sem o polo MDM e sem proteção visível;
  - `split-sala-porta`: um quadro na casa do cliente.

  Os ficheiros continuam em `site/v3/img/` (secção 5, passo 6).
- Multi-split na página inicial: um esquema (uma unidade exterior ligada a três interiores) em vez de fotografia, até haver fotografia de um multi-split real.

### O que não aparece no site até termos os seus dados
- A classificação e o número de avaliações Google. A faixa de avaliações foi retirada até haver números reais.
- Os números de certificação: alvará IMPIC, eletricista e F-gas.
- Aquecimento com bomba de calor (radiadores, piso radiante). Por agora o site só fala de águas quentes.
- Preços e prazos de resposta. Prazos, nenhum: foi decisão sua.

### Verificações feitas a 27/09/2026
- 0 travessões em todo o site e 0 formas do português do Brasil.
- 0 ligações internas partidas (801 ligações e âncoras verificadas). Todos os blocos JSON-LD são válidos e não há ids repetidos.
- Dados da empresa iguais em todas as páginas: telefone, WhatsApp, email, NIF e morada.
- Acessibilidade (axe-core, WCAG 2.2 AA): 0 violações em 10 páginas, a 390 e a 1440 px, com o banner visível.
- Teclado: o foco está sempre visível, com contraste de 6,96:1 a 8,09:1, e já não fica escondido atrás da barra do telemóvel.
- Sem deslocamento para os lados a 320 px. Botões e campos com 44 px ou mais a 390 px. O modo "reduzir movimento" é respeitado.
- Nenhum texto sobre fotografias.

A versão anterior (v2.2: `site/index.html` e `site/deploy/creme/`) não foi alterada.

---

## 2. Antes e depois

**Como ler os números.** Medições do Lighthouse 13.5 (a ferramenta do Google), no mesmo computador e em `localhost`, para a v2.2 e para a v3.
- Desempenho, Acessibilidade, Boas práticas e SEO vão de 0 a 100.
- **LCP**: tempo até aparecer o maior elemento do primeiro ecrã. Objetivo: menos de 2,0 s no telemóvel.
- **CLS**: quanto a página "salta" enquanto carrega. Objetivo: menos de 0,05.
- Telemóvel: mediana de 3 medições. Computador: 1 medição na v3, mediana de 3 na v2.2.

A v2.2 era uma só página, por isso só a página inicial tem comparação direta.

### Página inicial: v2.2 e v3

| Medida | Objetivo | v2.2, telemóvel | v3, telemóvel (verificação) | v3, telemóvel (depois das correções) | v2.2, computador | v3, computador |
|---|---|---|---|---|---|---|
| Desempenho | 95 ou mais | 96 | 98 | **100** | 95 | **100** |
| Acessibilidade | 100 | 100 | 100 | por medir | 100 | 100 |
| Boas práticas | | 96 | 96 | 96 | 96 | 96 |
| SEO | 100 | 100 | 69 (100 sem a regra de indexação) | por medir | 100 | 69 (100 sem a regra de indexação) |
| LCP | menos de 2,0 s | 2,63 s | 2,33 s | **1,73 s** com compressão; 2,18 s sem compressão | 0,58 s | 0,45 s |
| CLS | menos de 0,05 | 0,006 | 0,000 | 0 | **0,14** | **0,000** |

- **Depois das correções:** a página inicial passou a carregar no telemóvel uma fotografia do topo mais pequena (720 px em vez de 960 px). O estilo (CSS) passou a ir dentro de cada página, reduzido.
  - Com compressão, como no Netlify: LCP de 1,73 s (medições de 1,655 s, 1,804 s e 1,730 s), desempenho 100, CLS 0.
  - Sem compressão, como na medição da v2.2: 2,18 s. Esta medição foi feita numa cópia com a mesma correção.
- **SEO 69 na v3 é de propósito:** a pré-visualização pede para não ser indexada. Sem essa regra, o SEO dá 100 em todas as páginas e volta a 100 no lançamento.
- **Boas práticas 96:** o único erro é o Sentry, bloqueado pela rede deste ambiente de testes. Na v2.2 era igual. Num browser normal não acontece.

### Todas as páginas da v3 (verificação de 27/09, antes da última ronda de correções)

| Página | Desempenho | Acessibilidade | Boas práticas | SEO (sem a regra de indexação) | LCP telemóvel, servidor simples | LCP telemóvel, servidor tipo produção | FCP telemóvel | LCP computador |
|---|---|---|---|---|---|---|---|---|
| Início | 98 | 100 | 96 | 69 (100) | 2,33 s | 2,03 s | 1,20 s | 0,45 s |
| Ar condicionado | 99 | 100 | 96 | 69 (100) | 1,95 s | 1,51 s | 1,20 s | 0,48 s |
| Bombas de calor | 100 | 100 | 96 | 69 (100) | 1,80 s | 1,80 s | por medir | 0,44 s |
| Manutenção e assistência | 100 | 100 | 96 | 69 (100) | 1,80 s | 1,36 s | por medir | 0,42 s |
| Instalações elétricas | 100 | 100 | 96 | 69 (100) | 1,66 s | 1,35 s | por medir | 0,41 s |
| Ventilação | 100 | 100 | 96 | 69 (100) | 1,80 s | 1,50 s | por medir | 0,47 s |
| Obras | 100 | 100 | 96 | 69 (100) | 1,73 s | 1,28 s | por medir | 0,45 s |
| Privacidade | 100 | 100 | 96 | 66 (100) | 1,50 s | 1,35 s | por medir | 0,40 s |

- Os quatro valores de pontuação são do telemóvel. No computador, todas as páginas tiveram 100 / 100 / 96 / 69 (a privacidade, 66). Sem a regra de indexação, o SEO dá 100 em todas.
- CLS 0,000 e tempo de bloqueio (TBT) 0 ms em todas as medições, no telemóvel e no computador.
- "Servidor tipo produção": com compressão gzip e cache longa para imagens e fontes, como o Netlify fará. Nessa medição, o desempenho ficou entre 99 e 100 em todas as páginas.
- **Depois das correções:**
  - Ar condicionado, Obras, Ventilação e Privacidade: desempenho 100 e LCP entre 1,35 e 1,5 s. O valor de cada página está por medir.
  - Bombas de calor, Manutenção e Instalações elétricas: por medir.

### O que mudou além dos números

| | v2.2 | v3 |
|---|---|---|
| Páginas | 1 | 7 públicas + 3 de apoio |
| Formulário | Não guardava pedidos; o botão abria a app de email | Netlify Forms, 6 campos, fotografia, sucesso no ecrã |
| Barra fixa no telemóvel | Não havia | Ligar · Pedir orçamento · WhatsApp |
| "Bomba de calor" no site | 0 vezes | Página própria |
| Texto sobre fotografia no topo | Contraste de 1,1 a 4,3:1 | Nenhum texto sobre fotografias |
| Nome da empresa | 4 variantes | "MDM" e o nome legal; falta acertar o nome no topo (secção 8, F17) |
| Travessões no texto | 12 | 0 |
| Endereço canónico | `mdmassist.manus.space` | `www.mdmassist.com.pt` |
| Página de erro 404 | Não havia | Sim |
| Estatísticas | PostHog sem cookies e sem banner | PostHog só depois de "Aceitar" |

---

## 3. Pré-visualização

**Estado: PENDENTE.** Ainda não há endereço de pré-visualização.
- O projeto Netlify `mdm-site-preview` já existe, mas não está ligado ao repositório no GitHub.
- A partir deste ambiente não conseguimos publicar no Netlify, porque a rede bloqueia o acesso.
- Quem tem a conta Netlify tem de fazer a ligação uma vez. A partir daí, cada alteração enviada para o GitHub é publicada sozinha.

### Ligar o repositório (uma vez)
1. Abrir **app.netlify.com** e entrar com a conta onde está o projeto.
2. Abrir o projeto **mdm-site-preview**.
3. Ir a **Project configuration > Build & deploy** e carregar em **Link repository**.
4. Escolher **GitHub**, autorizar o Netlify se for pedido e escolher o repositório **20tenho28-png/MDM**.
5. Em *Branch to deploy*, escolher o ramo **claude/new-session-tjh2dn**.
6. Não é preciso escrever mais nada. O ficheiro `netlify.toml` na raiz do repositório já diz ao Netlify para construir `site/v3` e publicar `site/v3/dist`. Se o ecrã mostrar estes campos, devem ficar assim:
   - Base directory: vazio
   - Build command: `cd site/v3 && python3 build.py`
   - Publish directory: `site/v3/dist`
7. Confirmar e esperar que o primeiro deploy fique **Published**, no separador *Deploys*. O endereço aparece no topo da página do projeto, normalmente `https://mdm-site-preview.netlify.app`.

### Ativar o formulário e os emails
8. Abrir o separador **Forms**. Deve aparecer o formulário **orcamento**. Se, em vez disso, aparecer um botão para ativar a deteção de formulários (*Enable form detection*), ativar e publicar de novo em *Deploys > Trigger deploy*.
9. Ligar os avisos por email: **Forms > Form notifications > Add notification > Email notification**.
   - Evento: novo pedido (*New form submission*).
   - Formulário: `orcamento`.
   - Email: o endereço que escolher para receber os pedidos (pendente 5.1 da secção 7).

   Se o painel tiver outro caminho, procurar em *Project configuration > Notifications > Form submission notifications*.
10. Enviar um pedido de teste a partir do telemóvel (secção 4, passos 15 a 20) e confirmar que o email chega.

Notas:
- A pré-visualização fica aberta a quem tiver o endereço, mas não aparece no Google.
- Os pedidos de teste ficam guardados em *Forms* e podem ser apagados depois.
- O Netlify publica o que estiver no GitHub nesse ramo. Se o deploy falhar, abra o deploy, copie o fim do registo (*Deploy log*) e envie-nos.

---

## 4. Testes em telemóveis reais

**Telemóveis:** um iPhone com Safari e um Android com Chrome. Use uma janela normal do browser, não privada, porque a escolha do banner fica guardada no browser.

**Antes de começar:** anote o modelo de cada telemóvel e a versão do sistema (iOS ou Android).

**Como registar:** marque cada passo em ☐ iPhone e ☐ Android. Quando algo falhar, tire uma captura de ecrã e anote o número do passo.

### A. Primeira visita e consentimento
1. **Abrir o endereço da pré-visualização.**
   Esperado: o banner de estatísticas aparece em baixo; "Recusar" e "Aceitar" têm o mesmo tamanho; o texto lê-se inteiro. ☐ iPhone ☐ Android
2. **Tocar em "Saber mais" no banner.**
   Esperado: abre a política de privacidade na secção 3. Voltar atrás. ☐ iPhone ☐ Android
3. **Tocar em "Recusar".**
   Esperado: o banner desaparece. Ao recarregar a página, não volta. ☐ iPhone ☐ Android
4. **No fim da página, tocar em "Preferências de estatísticas".**
   Esperado: o banner volta. Tocar em "Aceitar": desaparece. ☐ iPhone ☐ Android
5. **Abrir a política de privacidade (rodapé) e ir à secção 3.**
   Esperado: lê-se "Neste browser: estatísticas aceites." e o botão "Alterar preferências" volta a mostrar o banner. ☐ iPhone ☐ Android

### B. Primeiro ecrã e menu
6. **Página inicial, sem mexer.**
   Esperado: percebe-se logo o que a MDM faz e onde; o telefone 218 935 050 está no topo; a fotografia está nítida e sem texto por cima. ☐ iPhone ☐ Android
7. **Tocar no botão do menu (três traços).**
   Esperado:
   - abre com Serviços, Obras, Como funciona, Perguntas, Contacto, o telefone, "Pedir orçamento" e o horário "2ª a 6ª, 8h às 17h";
   - fecha ao tocar outra vez no botão, ao tocar fora do menu e ao escolher um link, que leva à secção certa;
   - com o menu aberto, a barra de baixo não aparece.

   ☐ iPhone ☐ Android

### C. Telefone, barra fixa e WhatsApp
8. **Tocar no número 218 935 050 no topo.**
   Esperado: abre a app Telefone com +351 218 935 050. No iPhone aparece primeiro a pergunta para ligar. Não é preciso fazer a chamada. ☐ iPhone ☐ Android
9. **Descer na página até aparecer a barra fixa em baixo.**
   Esperado:
   - a barra não fica tapada pela barra do Safari nem pela linha de gestos do telemóvel;
   - o fim da página (rodapé) não fica escondido atrás dela;
   - "Ligar" abre a app Telefone com o mesmo número.

   ☐ iPhone ☐ Android
10. **Tocar no ícone do WhatsApp na barra.**
    Esperado: abre a app WhatsApp, não uma página web, numa conversa com 910 307 579 e com a mensagem "Olá MDM, gostaria de pedir informações." já escrita. Não é preciso enviar. ☐ iPhone ☐ Android
11. **Tocar em "Pedir orçamento" na barra.**
    Esperado: a página desce até ao formulário e a barra desaparece enquanto o formulário está à vista. ☐ iPhone ☐ Android
12. **Percorrer devagar cada página: início, as 5 de serviço e Obras.**
    Esperado: nunca aparecem duas entradas de WhatsApp no mesmo ecrã. ☐ iPhone ☐ Android

### D. Formulário, do princípio ao email recebido
13. **Na página inicial, tocar em "Enviar pedido" sem preencher nada.**
    Esperado: aparece no topo do formulário a lista do que falta; os campos em falta ficam a vermelho; o ecrã salta para o primeiro campo em falta. ☐ iPhone ☐ Android
14. **Abrir a página Bombas de calor e descer até ao formulário.**
    Esperado: "O que precisa?" já diz "Bomba de calor". ☐ iPhone ☐ Android
15. **Preencher o formulário.**
    - Tipo de imóvel: Casa
    - Urgência: Estou só a planear
    - Localidade: escrever "Lou" e escolher "Loures" na lista
    - Fotografia: escolher uma foto da galeria (no iPhone, experimentar também "Tirar fotografia")
    - Nome: "Teste MDM"
    - Telemóvel ou email: o seu telemóvel

    Esperado: depois de escolher a foto, o nome do ficheiro aparece no lugar de "Escolher fotografia (até 8 MB)". ☐ iPhone ☐ Android
16. **Tocar em "Enviar pedido".**
    Esperado:
    - aparece "Pedido recebido. Obrigado, Teste MDM." e um botão verde "Enviar fotografias por WhatsApp";
    - esse botão é a única entrada de WhatsApp no ecrã;
    - nada promete prazo.

    ☐ iPhone ☐ Android
17. **Tocar no botão verde.**
    Esperado: abre o WhatsApp para 910 307 579 com a mensagem "Olá MDM, acabei de enviar um pedido de orçamento e envio fotografias." ☐ iPhone ☐ Android
18. **Recarregar e enviar outro pedido.** Desta vez: "Tenho uma avaria", sem fotografia, com um email em vez do telemóvel.
    Esperado: a mensagem de sucesso inclui "Se for urgente, ligue 218 935 050 (2ª a 6ª, 8h às 17h)." e o número liga. ☐ iPhone ☐ Android
19. **Fotografia grande, se tiver uma com mais de 8 MB.**
    Esperado: aparece "A fotografia tem mais de 8 MB. Escolha outra." e essa foto não é enviada. ☐ iPhone ☐ Android
20. **Ver os emails recebidos**, no endereço escolhido na secção 3, passo 9.
    Esperado:
    - chega um email por pedido;
    - serviço, tipo de imóvel, urgência, localidade, nome, contacto e página de origem estão certos;
    - a fotografia do primeiro pedido chega, como anexo ou como ligação, e abre.

    Se não chegar nada, ver a pasta de spam do email e, no Netlify, *Forms > orcamento*, incluindo a lista de spam. Anote quanto tempo demorou cada email. ☐ iPhone ☐ Android

### E. Outras páginas
21. **Escrever no endereço `/pagina-que-nao-existe`.**
    Esperado: aparece a página "não existe" da MDM, com o mesmo topo e rodapé, e não um erro do Netlify. "Pedir orçamento" leva ao formulário da página inicial. ☐ iPhone ☐ Android
22. **Tocar no link "Política de privacidade" por baixo do botão "Enviar pedido", e depois no do rodapé.**
    Esperado: os dois abrem a política; a lista "Nesta página" leva a cada secção. ☐ iPhone ☐ Android
23. **Abrir Obras.**
    Esperado: as fotografias carregam ao descer; cada uma tem a legenda por baixo; nenhuma aparece duas vezes. ☐ iPhone ☐ Android

### F. Leitura, zoom e tamanho do texto
24. **Fazer zoom com dois dedos numa página de serviço.**
    Esperado: o zoom funciona, não está bloqueado, e o texto continua legível. ☐ iPhone ☐ Android
25. **Aumentar o texto para 150%.**
    - iPhone: no Safari, tocar em "aA" na barra de endereço e aumentar até 150%.
    - Android: no Chrome, *Definições > Acessibilidade* e aumentar a escala do texto para 150%.

    Esperado: o texto cresce, nada fica por cima de nada, não aparece deslocamento para os lados e a barra de baixo continua a funcionar. No fim, voltar a 100%. ☐ iPhone ☐ Android
26. **Rodar o telemóvel na horizontal.**
    Esperado: sem deslocamento para os lados; o menu e a barra continuam a funcionar. ☐ iPhone ☐ Android
27. **Reduzir movimento** (opcional).
    - iPhone: *Definições > Acessibilidade > Movimento > Reduzir movimento*.
    - Android: *Definições > Acessibilidade > Remover animações*; o nome muda de marca para marca.

    Esperado: "Pedir orçamento" salta logo para o formulário, sem deslizar. ☐ iPhone ☐ Android
28. **Modo escuro: não se aplica.** O site só tem a versão clara e deve aparecer igual com o telemóvel em modo escuro. Se algum browser escurecer a página à força, anote, mas não é um defeito a corrigir agora.

**Nota sobre a partilha:** ao partilhar o endereço da pré-visualização no WhatsApp, a imagem de partilha **não** aparece, porque aponta para o domínio definitivo. Isto testa-se depois do lançamento (secção 5, passo 22).

---

## 5. Antes de passar a produção

### A. Aprovações
1. Os testes da secção 4 estão feitos nos dois telemóveis, sem falhas por resolver.
2. Os pendentes marcados "antes do lançamento" na secção 7 estão respondidos.
3. A política de privacidade e o texto do banner foram lidos e aprovados por si e, se possível, por quem trata dos assuntos jurídicos da MDM.

### B. Alterações no código (quem mantém o site)
4. **Tirar o bloqueio de indexação** em `site/v3/build.py`:
   - no `robots.txt`, trocar `Disallow: /` por `Allow: /` e acrescentar a linha `Sitemap: https://www.mdmassist.com.pt/sitemap.xml`;
   - no `_headers`, apagar o bloco `/*` com `X-Robots-Tag: noindex, nofollow`, mas manter as regras de cache de `/img/*` e `/fonts/*`;
   - a política de privacidade continua `noindex`, de propósito.

   Depois do deploy, confirmar que `curl -I https://www.mdmassist.com.pt/` já não mostra `X-Robots-Tag` e que `/robots.txt` mostra `Allow`.
5. **Redirecionamentos**: em `site/v3/src/_redirects`, acrescentar uma linha 301 por cada endereço do site antigo (passo 8).
6. **Fotografias fora de uso**: decidir se `ventilacao-ventilbox-*` e `split-sala-porta-*` saem de `site/v3/img/` e de `img/manifest.json`. Enquanto lá estiverem, são publicadas, embora nenhuma página ligue a elas.
7. **Projeto e ramo de produção**: decidir que projeto Netlify serve o site definitivo (o mais simples é o mesmo `mdm-site-preview`, com o domínio acrescentado) e que ramo do GitHub vai para o ar (*Production branch*).

### C. Site antigo e domínio
8. **Rastrear o site antigo `www.mdmassist.com.pt` antes de mudar o DNS**, porque depois deixa de estar acessível.
   - Listar todos os endereços. Pode usar o programa Screaming Frog SEO Spider (versão gratuita), o Search Console do site antigo, se existir, ou pesquisar `site:mdmassist.com.pt` no Google.
   - Para cada endereço, escolher a página nova mais próxima e escrever a linha no `_redirects`, por exemplo: `/pagina-antiga.html   /ar-condicionado-lisboa/   301`.
   - Fragmentos como `/#Contato` não se redirecionam, porque o browser não os envia ao servidor. Esses endereços caem na página inicial, o que está certo.
9. **Saber quem gere o DNS de `mdmassist.com.pt`** (pendente 2.1) e quem aloja o site antigo (pendente 2.2).
10. **Domínio no Netlify**, em *Domain management > Add a domain*:
    - `www.mdmassist.com.pt` como domínio principal;
    - `mdmassist.com.pt` (sem www) como alias.

    Com o www como principal, o Netlify redireciona o endereço sem www para `https://www.mdmassist.com.pt/` com 301. Confirmar com `curl -I http://mdmassist.com.pt/`: a resposta deve ser 301 para `https://www.mdmassist.com.pt/`.
11. **No DNS**, apontar o `www` (CNAME) e o domínio sem www para os valores que o Netlify mostrar nesse ecrã. **Não mexer nos registos MX nem noutros registos de email.** O email da MDM é `@mdmassist.com`, outro domínio, mas se houver email em `mdmassist.com.pt` tem de continuar a funcionar.
12. **HTTPS**: o Netlify emite o certificado sozinho quando o DNS estiver certo. Confirmar o cadeado no browser e que `http://` passa para `https://`.
13. **`mdmassist.manus.space` (v2.2)**: decidir se passa a redirecionar para o domínio novo ou se sai do ar (pendente 2.3), para não ficar um segundo site da MDM sem ligação ao novo.

### D. Google e Bing
14. **Perfil de Empresa Google**: mudar o campo "Website" para `https://www.mdmassist.com.pt/`.
15. **Comparar carácter a carácter** o nome, a morada, o telefone e o horário do Perfil com o site. Hoje o site diz:
    - Nome: "MDM" (nome legal "M.D.M. - Manuel Domingos Melancia, Lda")
    - Morada: "Alameda dos Oceanos 108A, Edifício Vila do Oriente, 1990-426 Lisboa"
    - Telefone: "218 935 050"
    - Horário: "2ª a 6ª, 8h às 17h"

    Se houver diferenças, decidir qual é o certo e acertar os dois. No site, estes dados estão em `src/partials/footer.html`, em `build.py` (dados estruturados e `llms.txt`) e em `src/privacidade.html`.
16. **Google Search Console**:
    - criar uma propriedade de domínio para `mdmassist.com.pt`, verificada com um registo TXT no DNS;
    - enviar o sitemap `https://www.mdmassist.com.pt/sitemap.xml`;
    - em "Inspeção de URL", pedir a indexação da página inicial.
17. **Bing Webmaster Tools**: importar o site a partir do Search Console e enviar o mesmo sitemap.

### E. Estatísticas e erros
18. **PostHog**: no site já em produção, aceitar as estatísticas, visitar 2 páginas, tocar no telefone e enviar um pedido de teste. Em PostHog, na lista de eventos em direto (*Activity*), devem aparecer as visitas (`$pageview`), `call_tap`, `form_start` e `form_submit`. Noutro browser, com "Recusar", não deve aparecer nada.
19. **No projeto PostHog**: confirmar que a gravação de sessões, os mapas de calor e os inquéritos estão desligados. Confirmar também que a retenção dos dados corresponde aos 12 meses que a política promete; se não, muda-se a política (pendente 6.2).
20. **Sentry**: confirmar que o projeto recebe dados do domínio novo. As medições de desempenho são uma amostra (cerca de 1 em cada 10 visitas). Na lista de erros só aparece alguma coisa se houver erros. Com "Recusar", o Sentry não carrega.

### F. Verificação final no endereço definitivo
21. **Lighthouse** na página inicial, no telemóvel (Chrome DevTools ou pagespeed.web.dev): LCP abaixo de 2,0 s. Confirmar que o Netlify envia as páginas comprimidas: a resposta deve trazer `content-encoding: br` ou `gzip`. A meta de LCP da página inicial depende disso (secção 8).
22. **Partilha**: enviar o endereço a si próprio no WhatsApp. Deve aparecer a imagem de partilha com o título.
23. **Formulário**: enviar um pedido de teste já em produção e confirmar que o email chega.
24. **Telemóvel**: repetir num telemóvel os passos 8 a 20 da secção 4.

---

## 6. Depois do lançamento

### Primeira semana
- **Search Console:**
  - em "Sitemaps", o estado deve ficar "Êxito";
  - em "Páginas", acompanhar quantas das 7 páginas ficam indexadas;
  - em "Inspeção de URL", verificar 2 ou 3 endereços antigos, que devem aparecer como redirecionados.
- **Perfil de Empresa:** confirmar que o link do site abre `https://www.mdmassist.com.pt/`.
- **Pedidos:** todos os dias, ver se os emails do formulário chegam e comparar com *Forms* no Netlify, incluindo a lista de spam.

### Primeiro mês
- **Avaliações:** pedir a clientes de trabalhos recentes que deixem uma avaliação no Google, com o link "Pedir avaliações" do Perfil de Empresa. Nada de ofertas ou descontos em troca, porque as regras do Google proíbem-no. Quando houver avaliações, envie-nos a classificação, o número de avaliações e a data em que os leu. Só com esses números a faixa de avaliações volta à página inicial.
- **Fotografias no Perfil:** carregar pela app Google Maps as mesmas fotografias tratadas que estão no site (a versão maior de cada uma, em `site/v3/img/`). Se a app deixar pôr uma descrição, usar o formato "Equipamento marca, tipo de imóvel, local", sem nomes de clientes.
- **Formulário:** rever os pedidos todas as semanas e avisar-nos se houver muito spam. Confirmar no Netlify os limites do plano (pedidos e fotografias por mês).

### Aos 90 dias
- Rever o mapa de palavras-chave (`STRATEGY.md` §3) com os dados reais do Search Console, em *Desempenho*, por consulta e por página:
  - ver que pesquisas trazem impressões e cliques a cada página;
  - ajustar os títulos e as descrições das páginas com muitas impressões e poucos cliques.
- No PostHog, comparar por página os pedidos enviados (`form_submit`), os toques no telefone (`call_tap`) e no WhatsApp (`whatsapp_tap`).

### Data a lembrar
- **Cada ano novo:** o número de anos na página inicial ("35 anos em Lisboa") é calculado a partir de 1991 em cada publicação. Basta publicar de novo depois de 1 de janeiro para passar a 36.

---

## 7. Pendentes do dono

Os números entre parênteses são os de `CONTENT-NEEDED.md`, onde está o estado de cada item.

### Antes do lançamento

| Ref. | O que precisamos | Para quê |
|---|---|---|
| 5.1 | O email que recebe os pedidos do formulário | Ligar os avisos por email no Netlify (secção 3, passo 9) |
| 2.1 | Quem gere o DNS de `mdmassist.com.pt` | Apontar o domínio para o Netlify |
| 2.2 | Quem aloja o site antigo `www.mdmassist.com.pt` | Rastreá-lo e fazer os redirecionamentos 301 |
| 2.3 | O que fazer a `mdmassist.manus.space` | Não deixar um segundo site no ar |
| 1.2 a 1.4 | Nome, morada, telefone e horário exatamente como estão no Perfil de Empresa Google. Em alternativa, desbloquear o acesso ao Google neste ambiente | Dados iguais em todo o lado (secção 5, passo 15) |
| 3.6 | Que trabalhos de bomba de calor fazem: águas quentes, aquecimento central, piso radiante, sistemas mistos | Hoje o site só fala de águas quentes. Se confirmar o aquecimento, repomos o que foi retirado |
| 3.10 | Que garantia escrita dão | A página de bombas de calor diz que uma revisão periódica mantém a garantia do equipamento: confirmar ou retirar |
| 3.9 | Os concelhos que servem | Os dados estruturados nomeiam 8 (Lisboa, Loures, Odivelas, Amadora, Oeiras, Sintra, Cascais, Almada) e a lista do formulário tem também Vila Franca de Xira |
| 4.5 | Confirmar os 3 passos de "Como funciona": pedido; visita e orçamento; instalação e manutenção pela mesma equipa | Descrevem como a MDM trabalha |
| 4.7 | Confirmar as legendas deduzidas das fotografias (lista abaixo) | Não afirmar mais do que a fotografia mostra |
| 4.8 | Se as fotografias retiradas (`ventilacao-ventilbox`, `split-sala-porta`) saem do servidor | Secção 5, passo 6 |
| 6.1 | Ler e aprovar a política de privacidade e o texto do banner | Texto legal |
| 6.2 | Confirmar no PostHog a retenção de 12 meses | A política promete-a e o site não a controla |
| 6.3 | Que serviço aloja o email `mdmassist@mdmassist.com` | Lista de quem trata dados por conta da MDM |
| 6.4 | Confirmar as medidas de segurança dos equipamentos descritas no §6 da política | Vieram de recomendações, não de prática confirmada |

**Legendas a confirmar (4.7):**
- `reparacao-unidade`: o texto alternativo diz que um técnico está a reparar a unidade, mas na fotografia não aparece ninguém. Proposta: "Unidade exterior aberta para reparação".
- `cobertura-unidades-solar`: a legenda diz "Unidades exteriores", no plural. Vê-se uma unidade Midea V4 Plus VRF, coletores solares e uma caixa de ventilação.
- `midea-cobertura`: tem um vaso de expansão azul e tubagem de água, o que parece uma bomba de calor ar-água. Aparece na página de bombas de calor, mas nas Obras está em "Lojas, empresas e edifícios". Qual está certo?
- `conduta-teto`: uma grelha de retorno num teto falso, com um tubo isolado à vista. Parece ar condicionado de condutas, mas está na página de Ventilação.
- `multisplit-cobertura-midea`: a unidade Midea grande é de um multi-split? Se for, pode substituir o esquema na página inicial.

### Pode ser depois do lançamento

| Ref. | O que precisamos | Para quê |
|---|---|---|
| 1.6 | Classificação Google e número de avaliações, com a data da leitura | Voltar a mostrar a faixa de avaliações |
| 1.5, 1.7 | Categorias do Perfil de Empresa e coordenadas do pin | Dados estruturados |
| 1.8 | Pontuação exata do nome legal, como está na certidão | Nome legal no rodapé e nos dados estruturados |
| 3.1 a 3.3 | Número do alvará IMPIC; entidade e número do eletricista certificado; número do certificado F-gas da empresa | Faixa de prova e páginas de serviço, e acertar as palavras "certificado" e "certificados" (secção 8, F15) |
| 4.2 | Fotografias recentes de trabalho elétrico (quadros), com boa resolução | A fotografia do topo de Instalações elétricas vem de um original pequeno e fica pouco nítida em ecrãs de alta densidade |
| 3.7 | Fotografias de um multi-split real | Substituir o esquema |
| 4.6 | O local de cada fotografia (concelho ou bairro), sem nomes de clientes | Legendas no formato "Equipamento marca · tipo de imóvel, local". Hoje só uma legenda tem local |
| 4.3, 4.4 | Obras para cartões de projeto e autorizações escritas de clientes | Prova com casos concretos |
| 4.4 | Para voltar a usar a fotografia do técnico na ventilação: consentimento escrito dele e fotografia com o polo MDM | Direção fotográfica |
| 5.2, 5.3 | Quem atende o WhatsApp e em que horário; redes sociais da MDM | Texto de contacto e dados estruturados |
| 5.4 | Aprovar a imagem de partilha (`img/og-v3.jpg`) | Aparece quando o site é partilhado |

---

## 8. Problemas encontrados que ficaram por corrigir

A verificação de 27/09 encontrou 0 problemas P0, 2 P1 e 10 P2. Os P1 e P2 foram todos corrigidos, alguns retirando conteúdo até termos os seus dados. Também ficaram corrigidos três P3: o estilo dentro das páginas, as fotografias com terceiros e o texto pequeno nos esquemas. Na ronda final (27/09) foram corrigidos mais 14 pontos P3, na tabela abaixo. Os que ficaram são todos P3 (não bloqueiam o lançamento). Ficaram por uma de duas razões: dependem de dados seus, ou são acabamentos para a próxima ronda.

### Corrigidos, com uma condição

| ID | O que foi feito | Condição |
|---|---|---|
| LH-01 | LCP da página inicial no telemóvel: 1,73 s com compressão | Sem compressão fica em 2,18 s. Confirmar no endereço real que o Netlify comprime as páginas (secção 5, passo 21) |
| F03, F04, F05 | Retirados a fotografia errada do multi-split, a faixa de avaliações sem números e o aquecimento com bomba de calor | Voltam quando chegarem os seus dados (secção 7: 3.7, 1.6, 3.6) |
| F06 | O banner diz agora o que fica guardado, que "Recusar" também desliga o Sentry e tem "Saber mais" | O texto ficou mais comprido: ocupa cerca de 270 px acima da barra, a 390 px de largura. Precisa da sua leitura (6.1) |
| F02 | A mesma bomba de calor já não aparece duas vezes na mesma página | A imagem de partilha usa a mesma fotografia do topo. Ficou assim porque não aparece em nenhuma página |
| LH-06 | O estilo (CSS) vai dentro de cada página, por isso já não há um ficheiro de estilo sem cache | A compressão e a cache verificam-se no endereço real |
| F22 | `site/CLAUDE.md` já diz que a v3 usa o banner de consentimento antes do PostHog | Nenhuma |

### Corrigidos na ronda final (27/09, depois da verificação)

| ID | O que foi feito |
|---|---|
| F09 | Legendas e textos alternativos acertados ao que a fotografia mostra: "Unidade exterior aberta para reparação" e "Unidade exterior Midea" na cobertura |
| F12 | Números de telefone e NIF já não se partem ao meio; títulos com linhas equilibradas (`text-wrap`) |
| F14 | Exemplo no campo de contacto encurtado para "912 345 678 ou email" |
| F15 (parte) | "Instalação certificada" passou a "Técnicos certificados"; "eletricista da casa" no singular |
| F16 (parte) | Frase da garantia retirada; "Vila Franca de Xira" retirada das sugestões do formulário; anos desde 1991 calculados na publicação |
| F17 (parte) | "pára", "Que marcas assistem?", "contacto" repetido e título da lista da manutenção ("O que está incluído.") |
| F18 (a, c) | A política diz que o Netlify regista o IP e o browser de cada pedido, e que o Sentry carrega salvo se recusar |
| F20 | No máximo 2 etiquetas em maiúsculas por página (retiradas as de "Obras", da secção de destaque e de "Multi-split") |
| A11Y-05 | Links longos da política partem a linha; botão do WhatsApp na barra mantém 48 px |
| A11Y-06 | O campo da fotografia tem uma só etiqueta e a dica ligada ao campo |
| A11Y-07 | O conteúdo principal recebe o foco com "Saltar para o conteúdo"; o contorno fica todo visível |
| A11Y-08 | Os links que abrem noutra janela dizem-no aos leitores de ecrã |
| A11Y-09 | Com o menu aberto, "Saltar para o conteúdo" fica inativo |
| LH-04 | Em Obras, as três primeiras fotografias carregam logo, com prioridade |

Depois desta ronda: axe-core com 0 violações nas 10 páginas a 390 e 1440 px; sem deslocamento para os lados a 320, 390 e 1440 px; sem erros de JavaScript; ligações, dados estruturados e travessões verificados sem erros.

### Por corrigir

| ID | Problema | Porque ficou | Quando |
|---|---|---|---|
| F18 | A política de privacidade ainda tem pontos por completar:<br>(b) faltam o serviço de email e o WhatsApp como meios por onde a MDM recebe dados;<br>(d) os toques e o início do formulário anteriores à escolha são enviados se o visitante aceitar na mesma página;<br>(e) ao retirar o consentimento, o PostHog continua na página aberta (a política já o diz);<br>(f) as medidas de segurança do §6 não estão confirmadas.<br>Os pontos (a) IP e browser registados pelo Netlify e (c) Sentry antes da escolha já foram corrigidos. | (b) e (f) dependem de respostas suas (6.3, 6.4) | **Recomendado antes do lançamento** |
| F11 | Duas fotografias estão em secções que talvez não sejam as certas (`midea-cobertura`, `conduta-teto`) | Depende da sua confirmação (4.7) | Antes do lançamento, com 4.7 |
| F15 | A faixa de prova usa a palavra "Certificados" para F-gas, APIRAC, IMPIC e eletricista. APIRAC é uma associação e IMPIC emite alvarás, por isso a palavra certa depende dos seus documentos | Acertar com os números e os títulos exatos (3.1 a 3.3). "Instalação certificada" e "eletricistas" (plural) já foram corrigidos | Com 3.1 a 3.3 |
| F16 | Os concelhos nos dados estruturados (8) dependem de 3.9 | Dados seus. A frase sobre a garantia foi retirada, o formulário já sugere os mesmos 8 concelhos e o número de anos é calculado na publicação | Com 3.9 |
| F17 | No topo, "Manuel Domingos Melancia, Lda" não é o nome legal nem o nome comercial | Depende do nome exato no Perfil (1.2). Os outros pormenores de texto ("pára", "Que marcas assistem?", "contacto" repetido, título da manutenção) já foram corrigidos | Com 1.2 |
| F19 | A fotografia do topo de Instalações elétricas vem de um original de 641 px e fica pouco nítida em ecrãs de alta densidade. `ventilacao-cobertura` (640 px) aparece a toda a largura nas Obras, no telemóvel. Duas imagens estão mais saturadas do que as outras | Precisa de fotografias novas (4.2) e de retocar o tratamento de duas imagens | Com 4.2 |
| F21 | Num recorte quadrado (WhatsApp, iMessage), a imagem de partilha corta o título a meio. Usa a promessa inteira em vez da frase curta prevista na estratégia | P3. O script `site/v3/og/render.cjs` permite fazer uma versão nova | Com a aprovação de 5.4 |
| LH-02 | A miniatura de Instalações elétricas na página inicial carrega uma imagem de 641 px para um espaço de 96x72 px (telemóvel) ou 200x150 px (computador) | P3, sem efeito na pontuação. É preciso gerar uma versão pequena | Próxima ronda |
| LH-03 | Algumas imagens não têm largura intermédia e o browser escolhe um ficheiro maior do que o preciso | P3, sem efeito na pontuação. É preciso gerar novas larguras a partir dos originais | Próxima ronda |
| LH-07 | A fonte Geist Mono (23 KB) só é descoberta depois do estilo | P3. Só serve etiquetas pequenas; pré-carregá-la pode atrasar a fotografia do topo | Próxima ronda |
