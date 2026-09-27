# CONTENT-NEEDED — o que só o dono pode fornecer ou confirmar

Regra do projeto: nada de factos inventados. Enquanto um item não for fornecido, o site usa o marcador
indicado e **não** publica o elemento. Atualizado: 27/09/2026 (Fase 1, com as respostas do dono: ver AUDIT.md §0 "Owner decisions").

Legenda de prioridade: **P1** bloqueia a Fase 2/3 · **P2** necessário antes do lançamento · **P3** melhora, não bloqueia.

## 1. Identidade e dados do Google Business Profile (fonte da verdade do NAP)

| # | Item | Estado atual | Marcador no site | Prioridade |
|---|---|---|---|---|
| 1.1 | Link público do Perfil de Empresa Google | **Recebido:** https://maps.app.goo.gl/1NTJtEvzcYW6Cra18 (não abre neste ambiente; falta copiar os dados dele) | `[[GBP_URL]]` | ✔ |
| 1.2 | Nome exato no GBP, carácter a carácter (o dono indicou "MDM \| AVAC e Assistência Técnica") | O site usa 4 variantes: "MDM — Assistência Técnica" (schema, og), "MDM Assist — Assistência Técnica" (formulário), nome legal no header | `[[NOME_COMERCIAL]]` | P1 |
| 1.3 | Morada exata no GBP: aparece "Edifício Vila do Oriente"? "108A" ou "108 A"? | Site mistura "108A" (schema, FAQ) e "108 A" (rodapé, privacidade) | — | P1 |
| 1.4 | Telefone no GBP (formato) e horário no GBP | Site: 218 935 050 · 2ª a 6ª, 8h às 17h | — | P1 |
| 1.5 | Categorias principal e secundárias do GBP | Desconhecidas | — | P2 |
| 1.6 | Classificação Google e número de avaliações (reais, com data da leitura) | Desconhecidos. **Nenhuma classificação será mostrada até existir este número** | `[[GBP_RATING]]` `[[GBP_REVIEWS]]` | P1 (faixa de prova) |
| 1.7 | Coordenadas do pin do GBP (latitude/longitude) para o schema `geo` | Em falta | `[[GEO]]` | P2 |
| 1.8 | Nome legal: **confirmado "Domingos"** (27/09); só falta a pontuação exata da certidão | Registo (racius): "M.D.M.-Manuel Domingos Melancia Lda"; site: "M.D.M. - Manuel Domingos Melancia, Lda". **"Domingos", não "Domingues"** (o brief tem gralha) | — | P2 |
| 1.9 | CAE principal e secundários (o registo público mostra "outras atividades de serviços de apoio às empresas", não AVAC) | A confirmar | — | P3 |

## 2. Domínio e sites existentes

| # | Item | Estado | Prioridade |
|---|---|---|---|
| 2.1 | Domínio: **decidido mdmassist.com.pt**. Falta: quem gere o DNS e o alojamento atual | Canonical atual: `mdmassist.manus.space` (provisório) | P1 |
| 2.2 | O site antigo **www.mdmassist.com.pt** ("MDM-Assist \| Ar condicionado \| Lisboa") ainda está no ar e é o único site da MDM indexado. Quem o gere? Pode receber redirecionamento 301 para o novo? | Encontrado em pesquisa, não foi possível abri-lo daqui | P1 |
| 2.3 | O que está hoje em `mdmassist.manus.space`: é a versão atual do repositório? | Não verificável daqui | P2 |
| 2.4 | Projeto Netlify: **autorizado** (27/09) | — | ✔ |

## 3. Serviços e alegações (confirmar por escrito, uma a uma)

| # | Alegação hoje no site | Onde | Pergunta ao dono | Prioridade |
|---|---|---|---|---|
| 3.1 | "APIRAC · IMPIC" | faixa "Porquê a MDM" | **Confirmado.** Falta o número de alvará IMPIC | P2 |
| 3.2 | "Eletricista certificado" | hero, serviços | **Confirmado.** Falta: entidade (DGEG?) e número | P2 |
| 3.3 | Certificação F-gas | não aparece | **Confirmado.** Falta o número do certificado de empresa | P2 |
| 3.4 | Prazos de resposta | band, FAQ, formulário | **Decidido: nenhuma promessa de prazo.** Retirar todos | ✔ |
| 3.5 | "Peça o seu orçamento em 3 minutos" | formulário | Manter? (é uma promessa) | P3 |
| 3.6 | Bombas de calor ar-água | **não existe no site** | **Confirmado como serviço.** Falta: que tipos (AQS, aquecimento central, piso radiante) e fotos | P1 |
| 3.7 | Multi-split | **não existe no site** | **Confirmado como serviço.** Falta: fotos | P1 |
| 3.8 | Gás | — | **Decidido: não é serviço.** | ✔ |
| 3.9 | Zona servida | "grande Lisboa" | Lista de concelhos a nomear (Lisboa, Loures, Odivelas, Oeiras, Amadora, Sintra, Cascais, Almada…?) | P1 |
| 3.10 | Garantia | não aparece | Que garantia escrita dão (equipamento / instalação / anos)? | P1 |
| 3.11 | Preços indicativos ("a partir de") | não aparece | Aceita publicar intervalos? Quais? (só com números seus) | P3 |
| 3.12 | Marcas | FAQ e schema divergem | **Decidido: só texto, MIDEA, Mitsubishi Electric, Daikin, France Air** | ✔ |
| 3.13 | Público | hero, band | **Decidido: particulares e pequenas empresas**; banca, indústria, condomínios como prova secundária | ✔ |

## 4. Prova

| # | Item | Prioridade |
|---|---|---|
| 4.1 | Carrossel "Obras" (10 fotos): **#1 (carga de gás) e #10 (bateria de unidades) não são da MDM, retirar**; #2 a #9 confirmadas | ✔ |
| 4.2 | 6 a 12 fotografias recentes por serviço (AC, multi-split, bomba de calor, quadro elétrico, ventilação, manutenção), com legenda "Equipamento, marca, local" (ex.: "Bomba de calor Midea, Lisboa") | P1 |
| 4.3 | 3 a 4 obras para cartões de projeto: tipo de imóvel, zona, problema, solução (sem nomes de clientes sem autorização) | P2 |
| 4.4 | Autorização escrita dos clientes para qualquer nome/logótipo ou testemunho a publicar | P2 |
| 4.5 | Os 3 a 5 pontos de "Como funciona" tal como a MDM trabalha hoje (ex.: pedido → visita/orçamento → instalação → manutenção) | P2 |

## 5. Operação dos contactos

| # | Item | Prioridade |
|---|---|---|
| 5.1 | Email que recebe os pedidos do formulário (Netlify Forms) | P1 |
| 5.2 | O WhatsApp 910 307 579 é atendido por quem, e em que horário? | P2 |
| 5.3 | Redes sociais existentes (Facebook, Instagram, LinkedIn) para `sameAs` | P2 |
| 5.4 | Imagem de partilha (OG) — aprovar a composição proposta na Fase 3 | P3 |
