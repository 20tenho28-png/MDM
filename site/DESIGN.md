# MDM Design Language

> Site institucional da M.D.M. (assistência técnica a edifícios: ar condicionado, eletricidade, ventilação, grande Lisboa, desde 1991). Utilizadores: gestores de condomínio, facility managers de banca/indústria, particulares com uma avaria.

Esta é a linguagem **fundida** das duas variantes do site (09/2026): a **creme** (oficial, `site/index.html`) dá a tipografia, a paleta e o tom; a **carmim** (`site/variante-carmim/`) dá a estrutura — listas tipográficas com filete e faixas de números em células. Onde divergiam, ganhou a creme (decisão do dono). O registo das diferenças está no fim (§12).

Fonte da verdade dos valores: o bloco `:root` no topo do `<style>` de `site/index.html`. Regras de trabalho com Figma e restrições de conteúdo: `site/CLAUDE.md`.

## 1. Visual Theme

**Theme statement:** técnico, sóbrio, caloroso — ofício.

**Character:** Papel creme e tinta azul-marinho, como um relatório de obra bem feito. O serifado (Lora) dá a confiança de uma casa com 35 anos; o carmim do logótipo aparece pouco e sempre com intenção (ênfase em itálico, ação principal). A estrutura é editorial e contida: filetes finos, listas grandes, fotografias reais de obra — nunca ilustração de stock.

**References:** relatório técnico impresso; revistas de arquitetura (títulos serifados com ênfase em itálico); a variante carmim / referência de construtora (listas tipográficas, grelha de filetes).

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

**Font families** (Google Fonts, carregadas no `<head>`; também disponíveis no Figma):
- Display / títulos: `var(--serif)` — Lora 400/500/600, itálico 400/500
- Corpo / UI: `var(--sans)` — Inter 400/500/600
- Rótulos, números, eyebrows: `var(--mono)` — JetBrains Mono 400/500

**Type scale** (fluida nos títulos, fixa na UI):
| Role | Size | Weight | Line height | Where |
|------|------|--------|-------------|-------|
| Display (h1) | clamp(40px, 6.4vw, 80px) | Lora 500 | 1.04 | Hero |
| Section (h2) | clamp(30px, 4.2vw, 50px) | Lora 500 | 1.1 | Cabeçalhos de secção; `<em>` itálico carmim |
| List title | clamp(32px, 4.2vw, 54px) | Lora 500 | 1.04 | Linhas da lista de serviços (`.svc h3`) |
| Stat | 30px | Lora 600 itálico | 1.15 | Faixa de números (`.hm-num`) |
| Question | 18.5px | Lora 600 | 1.55 | FAQ |
| Body lg | 17px | Inter 400 | 1.75 | Texto do hero |
| Body | 15px | Inter 400 | 1.5–1.65 | Descrições, respostas |
| Small | 12.5–14.5px | Inter 400/500 | 1.5 | Nav, notas, rodapé |
| Eyebrow | 11px | JetBrains Mono 400, maiúsculas, +2.5px | — | Rótulo acima do h2, cor `--red` |
| Label | 11–12.5px | JetBrains Mono 500/600, maiúsculas, +0.6–1.5px | — | Canais ("Montagem · envie foto →"), botões do formulário |

Escala ad-hoc (sem rácio modular); os saltos grandes são intencionais (títulos editoriais vs UI pequena).

## 4. Components

| Component | Hierarchy | Purpose | Key variants |
|-----------|-----------|---------|--------------|
| Section head (`.sec-head`) | Component | Eyebrow mono + h2 serifado com `<em>` carmim | — |
| Service list (`.svc-row` / `.svc`) | Pattern | **Da carmim:** linha com filete; miniatura real 104×72, nome grande Lora, descrição Inter, canal mono + → à direita | Canal: WhatsApp, email, formulário |
| Stat cells (`.meta-band .hero-meta`) | Component | **Da carmim:** números em células separadas por filetes verticais, com filete em cima e em baixo | — |
| Hero doors (`.door`) | Component | Três entradas diretas com filete superior colorido | montagem (red), manut (ink), elet (slate) |
| Works carousel (`.ob-shot`) | Pattern | Fotografias reais de obra, arrastável, setas + pausa | — |
| Trust band (`.band`) | Component | Painel navy com lista de garantias e brilho radial carmim | — |
| FAQ item (`<details>`) | Component | Pergunta Lora + resposta Inter, filete inferior | aberto/fechado |
| Contact card (`.c-card`) | Component | Rótulo mono + valor Lora + nota | Telefone, WhatsApp, Email |
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
| Nav | fundo `rgba(250,249,245,.85)` + `backdrop-filter: blur(16px)` | Barra fixa |

Raios: `--r-s` 6px (inputs, botões, miniaturas), `--r-m` 10px (cartões), `--r-l` 16px (painéis largos), 999px (pílulas).

## 7. Do's and Don'ts

### Do
- Usar os tokens do `:root`; uma cor nova é um token novo com comentário.
- Ênfase = `<em>` em Lora itálico carmim, uma por título.
- Separar itens de lista com filetes `--sand` (estrutura carmim).
- Usar só fotografias reais da MDM, com `alt` em português a descrever a obra.
- Rótulos de ação em JetBrains Mono maiúsculas com seta →.

### Don't
- Não introduzir Geist, Space Grotesk ou outra família — ficou decidido: Lora + Inter + JetBrains Mono.
- Não usar o vermelho como texto sobre navy (2.8:1); lá usa-se `#E89B8A`.
- Não trazer da carmim o campo vermelho do hero, a barra lateral nem a galeria dispersa — são dessa variante.
- Não alterar telefone, email, morada, NIF, horário ou marcas sem confirmação escrita do dono.
- Não inventar testemunhos, números ou logótipos de clientes.

## 8. Responsive

Desktop-first, `max-width`. Breakpoints em uso: 1160, 1040, 1000, 980, 900, 760, 720, 640, 400px, mais `max-height: 820px/520px` e `hover: none`. Lista de serviços: 4 colunas → (≤1040) miniatura + nome + canal com descrição por baixo → (≤640) miniatura à esquerda, nome/descrição/canal empilhados → (≤400) nome 26px, canal pode quebrar. Verificar a 1440/1180/900/768/620/390/360: sem scroll horizontal.

## 9. Agent Prompt Guide

- A fonte da verdade é o `:root` de `site/index.html`; nunca hex solto numa regra de componente.
- Tipografia fechada: `var(--serif)` títulos, `var(--sans)` corpo, `var(--mono)` rótulos.
- Um só vermelho (`--red`); ênfase em itálico, não em negrito.
- Estrutura por filetes `--sand`; sombras só nos níveis 1–2 da §6.
- Conteúdo em português europeu; dados do negócio intocáveis (ver `site/CLAUDE.md` §0).

## 10. Motion

`--ease: cubic-bezier(0.16, 1, 0.3, 1)`. Entradas por scroll (`[data-r]` → `.in`), hovers de 0.25–0.35s (cor, −2/−3px, seta +4px, miniatura ×1.04). Carrossel e revelações param com `prefers-reduced-motion: reduce`.

## 11. Voice & Tone

Direto, técnico, sem letra pequena: "Respostas diretas, sem letra pequena." Números concretos e verificáveis (1991, 35 anos). Português europeu ("telemóvel", "equipa", "orçamento"). Canais sempre explícitos: "envie foto", "formulário", "email".

## 12. Reconciliação creme × carmim (09/2026)

| Área | Creme | Carmim | Resultado |
|------|-------|--------|-----------|
| Paleta base | #FAF9F5 / #141D2E / #4E5871 / #A30711 / #12823F | igual | **Alinhada** |
| Raios | 6 / 10 / 16px | 6 / 10px | **Alinhada** |
| Tipografia | Lora + Inter + JetBrains Mono | Geist + Geist Mono | **Divergente → creme** |
| Serviços | cartões fotográficos com véu escuro | lista tipográfica com filetes | **Carmim adotada** (com tipografia creme e miniatura real) |
| Faixa de números | números soltos | células com filetes | **Carmim adotada** (mesmo conteúdo) |
| Hero | foto desfocada + véu creme | campo vermelho `--field` | Só carmim — não adotado |
| Navegação | barra fixa translúcida | barra lateral `--rail` #0F1522 | Só carmim — não adotado |
| Obras | carrossel | galeria dispersa em navy | Só carmim — não adotado |
