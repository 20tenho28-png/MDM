# CONTENT-NEEDED: o que só o dono pode fornecer ou confirmar

Regra do projeto: nada de factos inventados. Enquanto um item não for fornecido, o site usa o marcador
indicado e **não** publica o elemento. Atualizado: 27/09/2026, fim da Fase 5 (site v3 pronto para pré-visualização).
Respostas anteriores do dono: AUDIT.md §0 "Owner decisions" e STRATEGY.md §6. A ordem de resposta e o contexto
de cada item estão em `LAUNCH.md` §7.

Legenda de prioridade (revista a 27/09 para o lançamento): **P1** antes do lançamento (bloqueia ou afeta uma
alegação que já está no site) · **P2** logo depois do lançamento (melhora a prova ou os dados) · **P3** melhora, sem pressa.

## 1. Identidade e dados do Google Business Profile (fonte da verdade do NAP)

| # | Item | Estado atual | Marcador no site | Prioridade |
|---|---|---|---|---|
| 1.1 | Link público do Perfil de Empresa Google | **Recebido:** https://maps.app.goo.gl/1NTJtEvzcYW6Cra18 (não abre neste ambiente; falta copiar os dados dele). Já está no site como `hasMap` e `sameAs` | `[[GBP_URL]]` | ✔ |
| 1.2 | Nome exato no GBP, carácter a carácter (o dono indicou "MDM \| AVAC e Assistência Técnica") | v3: "MDM" no título e nos dados estruturados, com os alternativos "MDM Assist" e "MDM AVAC e Assistência Técnica"; no topo do site aparece "Manuel Domingos Melancia, Lda" | `[[NOME_COMERCIAL]]` | P1 |
| 1.3 | Morada exata no GBP: aparece "Edifício Vila do Oriente"? "108A" ou "108 A"? | v3 usa "Alameda dos Oceanos 108A, Edifício Vila do Oriente, 1990-426 Lisboa" em todas as páginas; falta comparar com o GBP | (nenhum) | P1 |
| 1.4 | Telefone no GBP (formato) e horário no GBP | Site: 218 935 050 · 2ª a 6ª, 8h às 17h | (nenhum) | P1 |
| 1.5 | Categorias principal e secundárias do GBP | Desconhecidas | (nenhum) | P2 |
| 1.6 | Classificação Google e número de avaliações (reais, com data da leitura) | Desconhecidos. **Nenhuma classificação é mostrada até existir este número.** A faixa de avaliações foi retirada da home da v3 (27/09); o CSS fica pronto para ela voltar | `[[GBP_RATING]]` `[[GBP_REVIEWS]]` | P2 |
| 1.7 | Coordenadas do pin do GBP (latitude/longitude) para o schema `geo` | Em falta | `[[GEO]]` | P2 |
| 1.8 | Nome legal: **confirmado "Domingos"** (27/09); só falta a pontuação exata da certidão | Registo (racius): "M.D.M.-Manuel Domingos Melancia Lda"; site: "M.D.M. - Manuel Domingos Melancia, Lda". **"Domingos", não "Domingues"** (o brief tem gralha) | (nenhum) | P2 |
| 1.9 | CAE principal e secundários (o registo público mostra "outras atividades de serviços de apoio às empresas", não AVAC) | A confirmar | (nenhum) | P3 |

## 2. Domínio e sites existentes

| # | Item | Estado | Prioridade |
|---|---|---|---|
| 2.1 | Domínio: **decidido `www.mdmassist.com.pt`** (canónico de todas as páginas da v3). Falta: quem gere o DNS | Passos no `LAUNCH.md` §5 (domínio, HTTPS, 301 do domínio sem www) | P1 |
| 2.2 | O site antigo **www.mdmassist.com.pt** ("MDM-Assist \| Ar condicionado \| Lisboa") ainda está no ar e é o único site da MDM indexado. Quem o gere? | Tem de ser rastreado **antes** de mudar o DNS, para fazer um 301 por URL antigo em `site/v3/src/_redirects` (hoje só 2 regras) | P1 |
| 2.3 | O que está hoje em `mdmassist.manus.space` (v2.2) e o que lhe acontece no lançamento: redirecionar para o domínio novo ou retirar | Não verificável daqui | P1 |
| 2.4 | Projeto Netlify: **autorizado e criado** (`mdm-site-preview`, 27/09). Falta: o dono ligar o repositório GitHub ao projeto | Passos no `LAUNCH.md` §3. Sem isto não há endereço de pré-visualização | P1 |

## 3. Serviços e alegações (confirmar por escrito, uma a uma)

| # | Alegação | Onde (v3) | Pergunta ao dono / estado | Prioridade |
|---|---|---|---|---|
| 3.1 | "APIRAC · IMPIC" | faixa de prova da home (em "Certificados") | **Confirmado.** Falta o número de alvará IMPIC. Com o número, acerta-se a palavra "Certificados" (APIRAC é associação, IMPIC é alvará) | P2 |
| 3.2 | "Eletricista certificado" | home, páginas de serviço | **Confirmado.** Falta: entidade (DGEG?) e número | P2 |
| 3.3 | Certificação F-gas | home ("técnicos com certificação para gases fluorados"), ar condicionado, bombas de calor, manutenção | **Confirmado.** Falta o número do certificado de empresa | P2 |
| 3.4 | Prazos de resposta | (nenhum) | **Decidido: nenhuma promessa de prazo.** Retirados todos | ✔ |
| 3.5 | "Peça o seu orçamento em 3 minutos" | (nenhum) | **Retirado** (decisão do dono: nenhuma promessa de tempo, AUDIT.md §0) | ✔ |
| 3.6 | Bombas de calor ar-água | página `/bombas-de-calor-lisboa/`, linha na home, FAQ | **Respondido a 28/09/2026:** águas quentes e sistemas combinados águas quentes + aquecimento. Radiadores e piso radiante não confirmados em separado, por isso não são nomeados. | P1 |
| 3.7 | Multi-split | secção na página de ar condicionado; linha na home com esquema | **Confirmado como serviço.** Faltam fotografias de um multi-split real. A unidade Midea grande em `multisplit-cobertura-midea` é de um multi-split? | P2 |
| 3.8 | Gás | (nenhum) | **Decidido: não é serviço.** | ✔ |
| 3.9 | Zona servida | dados estruturados (8 concelhos: Lisboa, Loures, Odivelas, Amadora, Oeiras, Sintra, Cascais, Almada); lista do formulário (os mesmos + Vila Franca de Xira) | Confirmar a lista | P1 |
| 3.10 | Garantia | página de bombas de calor: "Uma revisão periódica mantém o rendimento e a garantia do equipamento" | Que garantia escrita dão (equipamento / instalação / anos)? Confirmar esta frase ou retirá-la | P1 |
| 3.11 | Preços indicativos ("a partir de") | não aparece | Aceita publicar intervalos? Quais? (só com números seus) | P3 |
| 3.12 | Marcas | FAQ, texto da home | **Decidido: só texto, MIDEA, Mitsubishi Electric, Daikin, France Air** | ✔ |
| 3.13 | Público | hero, faixa "Também para lojas, condomínios e empresas" | **Decidido: particulares e pequenas empresas**; banca, indústria, condomínios como prova secundária | ✔ |

## 4. Prova

| # | Item | Estado | Prioridade |
|---|---|---|---|
| 4.1 | Carrossel "Obras" antigo (10 fotos): #1 (carga de gás) e #10 (bateria de unidades) não são da MDM | Retiradas; a v3 não usa o carrossel | ✔ |
| 4.2 | Fotografias recentes por serviço | **✔ Recebidas 30 fotografias** (27/09, `Fotos_separadas.zip`), tratadas com a direção fotográfica (regradação de 27/09) e **publicadas** na home, nas páginas de serviço e em `/obras/` (23 fotografias nesta página). **Falta:** fotografias recentes de trabalho elétrico (quadros) com boa resolução; a do topo de Instalações elétricas vem de um original de 641 px | ✔ (resto P2) |
| 4.3 | 3 a 4 obras para cartões de projeto: tipo de imóvel, zona, problema, solução (sem nomes de clientes sem autorização) | Em falta | P3 |
| 4.4 | Autorização escrita dos clientes para qualquer nome/logótipo ou testemunho a publicar; e do técnico, se a fotografia `ventilacao-ventilbox` voltar a ser usada (com o polo MDM) | Em falta | P3 |
| 4.5 | Os passos de "Como funciona" tal como a MDM trabalha hoje | No site: 1 Pedido (formulário, telefone ou WhatsApp) · 2 Visita e orçamento (sem compromisso) · 3 Instalação e manutenção pela mesma equipa. Confirmar | P1 |
| 4.6 | Local de cada fotografia (concelho ou bairro), sem nomes de clientes, para as legendas "Equipamento marca · tipo de imóvel, local" | Só uma legenda tem local ("Cobertura, Lisboa") | P2 |
| 4.7 | Confirmar as legendas deduzidas: `reparacao-unidade` (o texto diz técnico, não aparece ninguém), `cobertura-unidades-solar` (plural, vê-se uma unidade), `midea-cobertura` (bomba de calor ou loja?), `conduta-teto` (ventilação ou ar condicionado de condutas?), `multisplit-cobertura-midea` (é multi-split?) | Pormenores no `LAUNCH.md` §7 | P1 **28/09:** `midea-cobertura` = ar condicionado/edifício; `conduta-teto` = ar condicionado de conduta. Faltam as restantes. |
| 4.8 | Fotografias retiradas das páginas (`ventilacao-ventilbox`: técnico sem polo e sem proteção visível; `split-sala-porta`: quadro na casa do cliente): apagar também do servidor? | Os ficheiros ainda estão em `site/v3/img/` e são publicados sem ligação | P1 |

## 5. Operação dos contactos

| # | Item | Estado | Prioridade |
|---|---|---|---|
| 5.1 | Email que recebe os pedidos do formulário (Netlify Forms) | Em falta. Necessário para ligar os avisos por email no Netlify (`LAUNCH.md` §3, passo 9) | P1 |
| 5.2 | O WhatsApp 910 307 579 é atendido por quem, e em que horário? | Em falta | P2 |
| 5.3 | Redes sociais existentes (Facebook, Instagram, LinkedIn) para `sameAs` | Em falta | P2 |
| 5.4 | Imagem de partilha (OG) | **✔ Feita** (27/09): `site/v3/img/og-v3.jpg`, 1200x630, 160 KiB, com o logótipo, a promessa aprovada, o telefone e a fotografia real do hero; gerada por `site/v3/og/render.cjs`; todas as páginas apontam para ela. Falta só a aprovação do dono. Nota: num recorte quadrado (WhatsApp, iMessage) o título fica cortado; pode fazer-se uma versão com a frase curta | P3 |

## 6. Política de privacidade

| # | Item | Estado | Prioridade |
|---|---|---|---|
| 6.1 | Política de privacidade da v3 | **✔ Reescrita** (27/09): `site/v3/src/privacidade.html`, publicada em `/privacidade/` (noindex), com o consentimento do PostHog, o Sentry, o Netlify Forms e os prazos de conservação da versão anterior. Falta: leitura e aprovação do dono, e do texto do banner de consentimento | P1 |
| 6.2 | Retenção das estatísticas | A política diz 12 meses; é uma definição no projeto PostHog que o site não controla. Confirmar no PostHog ou mudar o texto | P1 |
| 6.3 | Serviço que aloja o email `mdmassist@mdmassist.com` | Em falta; entra na lista de quem trata dados por conta da MDM | P1 |
| 6.4 | Medidas de segurança dos equipamentos (§6 da política) | Vieram de recomendações (`relatorio-intervencao/README.md`), não de prática confirmada. Confirmar ou ajustar | P1 |
