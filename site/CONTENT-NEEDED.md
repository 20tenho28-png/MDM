# CONTENT-NEEDED — o que só o dono pode fornecer ou confirmar

Regra do projeto: nada de factos inventados. Enquanto um item não for fornecido, o site usa o marcador
indicado e **não** publica o elemento. Atualizado: 27/09/2026 (Fase 1).

Legenda de prioridade: **P1** bloqueia a Fase 2/3 · **P2** necessário antes do lançamento · **P3** melhora, não bloqueia.

## 1. Identidade e dados do Google Business Profile (fonte da verdade do NAP)

| # | Item | Estado atual | Marcador no site | Prioridade |
|---|---|---|---|---|
| 1.1 | Link público do Perfil de Empresa Google (botão "Partilhar" no Maps) e, se possível, o link `maps.google.com/?cid=…` | Não encontrado em pesquisa; o Maps não é acessível a partir deste ambiente | `[[GBP_URL]]` | P1 |
| 1.2 | Nome exato no GBP, carácter a carácter (o dono indicou "MDM \| AVAC e Assistência Técnica") | O site usa 4 variantes: "MDM — Assistência Técnica" (schema, og), "MDM Assist — Assistência Técnica" (formulário), nome legal no header | `[[NOME_COMERCIAL]]` | P1 |
| 1.3 | Morada exata no GBP: aparece "Edifício Vila do Oriente"? "108A" ou "108 A"? | Site mistura "108A" (schema, FAQ) e "108 A" (rodapé, privacidade) | — | P1 |
| 1.4 | Telefone no GBP (formato) e horário no GBP | Site: 218 935 050 · 2ª a 6ª, 8h às 17h | — | P1 |
| 1.5 | Categorias principal e secundárias do GBP | Desconhecidas | — | P2 |
| 1.6 | Classificação Google e número de avaliações (reais, com data da leitura) | Desconhecidos. **Nenhuma classificação será mostrada até existir este número** | `[[GBP_RATING]]` `[[GBP_REVIEWS]]` | P1 (faixa de prova) |
| 1.7 | Coordenadas do pin do GBP (latitude/longitude) para o schema `geo` | Em falta | `[[GEO]]` | P2 |
| 1.8 | Nome legal exato na certidão permanente | Registo (racius): "M.D.M.-Manuel Domingos Melancia Lda"; site: "M.D.M. - Manuel Domingos Melancia, Lda". **"Domingos", não "Domingues"** (o brief tem gralha) | — | P2 |
| 1.9 | CAE principal e secundários (o registo público mostra "outras atividades de serviços de apoio às empresas", não AVAC) | A confirmar | — | P3 |

## 2. Domínio e sites existentes

| # | Item | Estado | Prioridade |
|---|---|---|---|
| 2.1 | Domínio definitivo do site (`mdmassist.com`? `mdmassist.com.pt`?) e quem gere o DNS | Canonical atual: `mdmassist.manus.space` (provisório) | P1 |
| 2.2 | O site antigo **www.mdmassist.com.pt** ("MDM-Assist \| Ar condicionado \| Lisboa") ainda está no ar e é o único site da MDM indexado. Quem o gere? Pode receber redirecionamento 301 para o novo? | Encontrado em pesquisa, não foi possível abri-lo daqui | P1 |
| 2.3 | O que está hoje em `mdmassist.manus.space`: é a versão atual do repositório? | Não verificável daqui | P2 |
| 2.4 | Autorização para criar um projeto Netlify para pré-visualizações (e depois produção) | Existem 3 projetos na conta, nenhum é o site MDM | P1 |

## 3. Serviços e alegações (confirmar por escrito, uma a uma)

| # | Alegação hoje no site | Onde | Pergunta ao dono | Prioridade |
|---|---|---|---|---|
| 3.1 | "APIRAC · IMPIC" | faixa "Porquê a MDM" | São associações/registos reais da MDM? Há número de alvará IMPIC a mostrar? | P1 |
| 3.2 | "Eletricista certificado", "técnicos certificados" | hero, serviços | Que certificação exatamente (DGEG? técnico responsável?) e com que número? | P1 |
| 3.3 | Certificação de gases fluorados (F-gas) da empresa e dos técnicos | não aparece | Existe certificado de empresa (APA/Regulamento UE 2024/573)? Número? | P1 |
| 3.4 | "24–48h intervenção técnica", "24h resposta", "resposta em menos de 24 horas úteis" | band, FAQ, formulário | Qual o prazo real que a MDM quer prometer, para particulares e empresas? | P1 |
| 3.5 | "Peça o seu orçamento em 3 minutos" | formulário | Manter? (é uma promessa) | P3 |
| 3.6 | Bombas de calor ar-água (AQS, aquecimento central, piso radiante) | **não existe no site** | Que tipos instalam e mantêm? Marcas? Fotos de obras? | P1 |
| 3.7 | Multi-split | **não existe no site** (o infográfico foi retirado em `01b3c19`) | Confirmar que é serviço regular; há fotos? Voltar a pôr o infográfico? | P1 |
| 3.8 | Gás (o site antigo .com.pt lista "gás") | não existe no site novo | Ainda é serviço da MDM? | P2 |
| 3.9 | Zona servida | "grande Lisboa" | Lista de concelhos a nomear (Lisboa, Loures, Odivelas, Oeiras, Amadora, Sintra, Cascais, Almada…?) | P1 |
| 3.10 | Garantia | não aparece | Que garantia escrita dão (equipamento / instalação / anos)? | P1 |
| 3.11 | Preços indicativos ("a partir de") | não aparece | Aceita publicar intervalos? Quais? (só com números seus) | P3 |
| 3.12 | Lista de marcas | FAQ: Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi · schema: Mitsubishi Electric, Daikin, MIDEA | O brief novo diz "não reintroduzir referências a fornecedores". Mantém-se a frase no FAQ, só texto, ou sai? Qual a lista certa? | P1 |
| 3.13 | Clientes "banca, indústria, condomínios, escolas" | hero, band | O brief novo muda o público para particulares e pequenas empresas. Mantemos estes clientes como prova secundária? | P1 |

## 4. Prova

| # | Item | Prioridade |
|---|---|---|
| 4.1 | Origem das 14 fotografias do carrossel "Obras": todas reais de obras da MDM? (algumas vieram de uma composição única; confirmar que nenhuma é imagem gerada ou de banco) | P1 |
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
