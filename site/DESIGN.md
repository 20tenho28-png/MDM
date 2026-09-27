# MDM Design Language

> Site institucional da M.D.M. (assistência técnica a edifícios: ar condicionado, eletricidade, ventilação, grande Lisboa, desde 1991). Utilizadores: gestores de condomínio, facility managers de banca/indústria, particulares com uma avaria.

Esta é a linguagem **fundida** das duas variantes do site (09/2026): a **creme** (oficial, `site/index.html`) dá a paleta, o tom e as fotografias; a **carmim** (`site/variante-carmim/`) dá a estrutura — listas tipográficas com filete e faixas de números em células — e, desde 27/09, a **letra** (Geist pesada e apertada, a pedido do dono). O registo das diferenças está no fim (§12).

Fonte da verdade dos valores: o bloco `:root` no topo do `<style>` de `site/index.html`. Regras de trabalho com Figma e restrições de conteúdo: `site/CLAUDE.md`.

## 1. Visual Theme

**Theme statement:** técnico, sóbrio, caloroso — ofício.

**Character:** Papel creme e tinta azul-marinho, como um relatório de obra bem feito. A Geist pesada e apertada nos títulos dá a firmeza de uma empresa técnica com 35 anos; o carmim do logótipo aparece pouco e sempre com intenção (a palavra de ênfase, a ação principal). A estrutura é editorial e contida: filetes finos, listas grandes, fotografias reais de obra — nunca ilustração de stock.

**References:** relatório técnico impresso; revistas de arquitetura (listas tipográficas grandes); a variante carmim / referência de construtora (listas tipográficas, grelha de filetes).

## 2. Color Palette

### Neutros (papel e tinta)
| Token | Value | Usage |
|-------|-------|-------|
| `--cream` | #FAF9F5 | Fundo da página |
| `--paper` | #F0EEE6 | Superfícies elevadas, faixas, cartões de contacto |
| `--sand` | #E8E4D9 | Filetes, contornos, divisórias de lista |
| `--slate` | #4E5871 | Texto secundário (cinzento frio derivado do navy) |
| `--ink` | #141D2E | Texto principal e superfícies escuras (navy dos polos da equipa) |

### Marca
| Token | Value | Usage |
|-------|-------|-------|
| `--red` | #A30711 | Carmim do logótipo — o único vermelho: ênfase `<em>`, CTA principal, eyebrows |
| `--red-dk` | #7C050D | Hover/pressed do vermelho; links de rodapé |
| `--red-sf` | #F6E4E4 | Fundo suave de erro |
| `#E89B8A` | — | Ênfase em fundo navy (painel "Porquê a MDM"); por tokenizar |

### Semântica
| Role | Token | Notes |
|------|-------|-------|
| WhatsApp / ação secundária | `--wa` #12823F, `--wa-d` #0B6E34 | 4.9:1 com branco |
| Sucesso | `--ok-bg` #E9F2EC, `--ok-fg` #1F5C33 | Alerta do formulário |
| Erro | `--red-sf` + `--red` | Campos inválidos |
| Info / aviso | — | Não existem; não inventar |

Não há modo escuro. Contraste verificado à mão: `--red` é cor de **preenchimento** (texto branco por cima); vermelho como texto só sobre `--cream`/`--paper`.

## 3. Typography

**Font families** (Geist e Geist Mono, OFL, variáveis 100–900, **embutidas** no `<style>` — sem Google Fonts; na publicação `externalize.py` passa-as para `fonts/`; também disponíveis no Figma):
- Display / títulos: `var(--display)` — Geist 650/700. Espaçamento apertado **só nos títulos grandes** (≥ 30px de h1/h2/lista: −0.045 a −0.05em); nos tamanhos médios (17–30px) quase normal (0 a −0.02em), para não apertar a leitura
- Corpo / UI: `var(--sans)` — Geist 400/500/600
- Rótulos, números, eyebrows: `var(--mono)` — Geist Mono 400/500/600

**Type scale** (fluida nos títulos, fixa na UI):
| Role | Size | Weight | Line height | Where |
|------|------|--------|-------------|-------|
| Display (h1) | clamp(40px, 6.4vw, 80px) | Geist 700, −0.05em | 1 | Hero |
| Section (h2) | clamp(30px, 4.2vw, 50px) | Geist 650, −0.045em | 1.02 | Cabeçalhos de secção; `<em>` carmim, direito |
| List title | clamp(32px, 3.9vw, 50px) | Geist 650, −0.05em | 1 | Linhas da lista de serviços (`.svc h3`) |
| Stat | 30px | Geist 650, −0.02em | 1.1 | Faixa de números (`.hm-num`) |
| Door / perk | 25–26px | Geist 650, −0.012 a −0.015em | 1.1 | Entradas do hero (`.door-t`), garantias (`.perk-big`) |
| Question | 18.5px | Geist 550, −0.005em | 1.55 | FAQ |
| Contact value | 17px | Geist 600, 0 | — | Cartões de contacto (`.c-val`) |
| Body lg | 17px | Geist 400 | 1.75 | Texto do hero |
| Body | 15px | Geist 400 | 1.5–1.65 | Descrições, respostas |
| Small | 12.5–14.5px | Geist 400/500 | 1.5 | Nav, notas, rodapé |
| Eyebrow | 11px | Geist Mono 400, maiúsculas, +2.5px | — | Rótulo acima do h2, cor `--red` |
| Label | 11–12.5px | Geist Mono 500/600, maiúsculas, +0.6–1.5px | — | Canais ("Montagem · envie foto →"), botões do formulário |

Escala ad-hoc (sem rácio modular); os saltos grandes são intencionais (títulos editoriais vs UI pequena).

## 4. Components

| Component | Hierarchy | Purpose | Key variants |
|-----------|-----------|---------|--------------|
| Header (`#nav` + `#mDrawer`) | Pattern | **Figma "Header v5"**: faixa creme sólida 72px (60px ≤1023), contentor de 1200px, grelha `1fr auto 1fr`; logótipo + nome legal (≥1200) · 5 ligações (Obras, Serviços, Porquê a MDM, Perguntas, Contacto) · telefone em texto + botão de contorno "Pedir orçamento" → `#contacto` (≥1200). ≤1023: logótipo, número, hambúrguer; gaveta com as 5 ligações, telefone, WhatsApp, pedido e horário. Geist 15/13, 500/600, só `--ink`; carmim só no logótipo, no sublinhado de hover e no foco | desktop 1200+, 1024–1199 (sem nome nem botão), ≤1023 |
| Section head (`.sec-head`) | Component | Eyebrow mono + h2 Geist pesada com `<em>` carmim | — |
| Service list (`.svc-row` / `.svc`) | Pattern | **Da carmim:** linha com filete; fotografia real **sempre visível** (200×136, prova de trabalho), nome grande Geist 650, descrição Geist 400, canal Geist Mono sublinhado + → à direita como apelo à ação; a **linha inteira é o link** de contacto | Canal: WhatsApp, email, formulário |
| Stat cells (`.meta-band .hero-meta`) | Component | **Da carmim:** números em células separadas por filetes verticais, com filete em cima e em baixo | — |
| Hero doors (`.door`) | Component | Três entradas diretas com filete superior colorido | montagem (red), manut (ink), elet (slate) |
| Works carousel (`.ob-shot`) | Pattern | Fotografias reais de obra, arrastável, setas + pausa | — |
| Trust band (`.band`) | Component | Painel navy com lista de garantias e brilho radial carmim | — |
| FAQ item (`<details>`) | Component | Pergunta Geist 550 + resposta Geist 400, filete inferior | aberto/fechado |
| Contact card (`.c-card`) | Component | Rótulo mono + valor Geist 600 + nota | Telefone, WhatsApp, Email |
| Mail window form (`.mailwin`) | Pattern | Formulário como janela de email (barra navy, linhas "Para:/Nome/Email…") | estados: erro, a enviar, enviado |
| Buttons | Primitive | `.btn-red` (principal), `.btn-line` (secundário), WhatsApp `--wa` | hover eleva −2/−3px |

## 5. Layout

**Contentor:** `max-width: 1200px`, padding lateral 40px (20px ≤640px). Secções: `padding: 100px 40px` (70px 20px ≤640px).

**Base:** grelha implícita de 4px; valores em uso 4, 8, 12, 16, 20, 24, 28, 32, 40, 44 — ad-hoc, não um token.

**Estrutura (da carmim):** listas e faixas separam-se por **filetes de 1px `--sand`**, não por cartões com sombra. Colunas de listas usam trilhos fixos para alinhar linha a linha (cada linha é a sua própria grelha).

**Density:** confortável — muito ar entre secções, texto compacto dentro delas.

## 6. Depth

| Level | Value | Usage |
|-------|-------|-------|
| 0 | filete 1px `--sand` | Listas, faixas, rodapé — o default |
| 1 | `0 10px 24px -18px rgba(20,29,46,.30)` | Cartões de obra |
| 2 | `0 20px 48px -28px rgba(20,29,46,.32)` | Janela do formulário |
| Nav | fundo `--cream` sólido, filete `--sand` ao rolar; sem blur nem sombra | Header fixo (72/60px) |

Raios: `--r-s` 6px (inputs, botões), `--r-m` 10px (cartões, fotos de serviço), `--r-l` 16px (painéis largos), 999px (pílulas).

## 7. Do's and Don'ts

### Do
- Usar os tokens do `:root`; uma cor nova é um token novo com comentário.
- Ênfase = `<em>` carmim, direito (sem itálico nem sublinhado), uma por título.
- Separar itens de lista com filetes `--sand` (estrutura carmim).
- Usar só fotografias reais da MDM, com `alt` em português a descrever a obra — e mostrá-las: são a principal prova de confiança, nunca escondidas atrás de um clique.
- Rótulos de ação em Geist Mono maiúsculas com seta →.

### Don't
- Não introduzir outra família (Lora, Inter, Space Grotesk…) — ficou decidido em 27/09: Geist + Geist Mono, embutidas.
- Não usar o vermelho como texto sobre navy (2.8:1); lá usa-se `#E89B8A`.
- Não trazer da carmim o campo vermelho do hero, a barra lateral nem a galeria dispersa — são dessa variante.
- Não alterar telefone, email, morada, NIF, horário ou marcas sem confirmação escrita do dono.
- Não inventar testemunhos, números ou logótipos de clientes.

## 8. Responsive

Desktop-first, `max-width`. Breakpoints em uso: 1160, 1040, 1023 (colapso do header), 1000, 980, 900, 760, 720, 640, 400px, `min-width: 1200px` (nome legal e botão do header), mais `max-height: 820px/520px` e `hover: none`. Lista de serviços: foto + 3 colunas → (≤1040) foto 150px, nome e descrição empilhados, canal à direita → (≤760) canal por baixo da descrição → (≤640) foto a toda a largura por cima, texto empilhado → (≤400) nome 26px, canal pode quebrar. Verificar a 1440/1180/900/768/620/390/360: sem scroll horizontal.

## 9. Agent Prompt Guide

- A fonte da verdade é o `:root` de `site/index.html`; nunca hex solto numa regra de componente.
- Tipografia fechada: `var(--display)` títulos (Geist 650/700, apertada), `var(--sans)` corpo, `var(--mono)` rótulos.
- Um só vermelho (`--red`); a ênfase é a cor, nunca itálico.
- Estrutura por filetes `--sand`; sombras só nos níveis 1–2 da §6.
- Conteúdo em português europeu; dados do negócio intocáveis (ver `site/CLAUDE.md` §0).

## 10. Motion

`--ease: cubic-bezier(0.16, 1, 0.3, 1)`. Entradas por scroll (`[data-r]` → `.in`), hovers de 0.25–0.35s (cor, −2/−3px, seta +4px, foto de serviço ×1.03). Carrossel e revelações param com `prefers-reduced-motion: reduce`.

## 11. Voice & Tone

Direto, técnico, sem letra pequena: "Respostas diretas, sem letra pequena." Números concretos e verificáveis (1991, 35 anos). Português europeu ("telemóvel", "equipa", "orçamento"). Canais sempre explícitos: "envie foto", "formulário", "email".

## 12. Reconciliação creme × carmim (09/2026)

| Área | Creme | Carmim | Resultado |
|------|-------|--------|-----------|
| Paleta base | #FAF9F5 / #141D2E / #4E5871 / #A30711 / #12823F | igual | **Alinhada** |
| Raios | 6 / 10 / 16px | 6 / 10px | **Alinhada** |
| Tipografia | Lora + Inter + JetBrains Mono | Geist + Geist Mono | **Carmim adotada** (27/09, pedido do dono) |
| Serviços | cartões fotográficos com véu escuro | lista tipográfica com filetes | **Carmim adotada** (tipografia creme; foto real sempre visível; linha inteira clicável) |
| Faixa de números | números soltos | células com filetes | **Carmim adotada** (mesmo conteúdo) |
| Hero | foto desfocada + véu creme | campo vermelho `--field` | Só carmim — não adotado |
| Navegação | barra fixa sólida (Header v5, 27/09) | barra lateral `--rail` #0F1522 | Só carmim — não adotado |
| Obras | carrossel | galeria dispersa em navy | Só carmim — não adotado |
