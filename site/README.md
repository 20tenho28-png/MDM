# MDM Assist — Website

Site institucional da **Manuel Domingues Melancia, Lda (MDM)** — assistência técnica a edifícios
(ar condicionado, eletricidade, ventilação) na grande Lisboa, desde 1991.

## Conteúdo

| Ficheiro | Descrição |
|---|---|
| `index.html` | O site completo, auto-contido (HTML + CSS + JS + imagens em base64). É o único ficheiro necessário para publicar. |
| `mdm-logo.svg` | Logótipo vetorial limpo. Reutilizável em cartões, faturas, email. |
| `favicon/` | O logótipo rasterizado em PNG (32px favicon, 180px apple-touch-icon). Já embutidos no `index.html`. |
| `obras/` | As 14 fotografias de obra já otimizadas (JPEG, 480px de altura). Já embutidas no `index.html`. |
| `src/` | Os ficheiros-fonte e o script que gera o `index.html`. Ver **Como editar**. |
| `variante-creme/` | A variante clara (a que está em mdmassist.manus.space), com as mesmas correções de captação/medição e o carrossel de obras. **O chefe decide entre as duas.** |

## Como editar

O `index.html` tem ~560 KB por causa das imagens em base64 — **não é para editar à mão**.
As fontes estão em `src/` e o ficheiro final é gerado:

```bash
cd site/src
python3 assemble.py          # gera ../index.html a partir das fontes
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

Há duas versões completas do site, para decisão:

| | Navy (`index.html`) | Creme (`variante-creme/index.html`) |
|---|---|---|
| Estética | Escura, técnica (navy dos polos) | Clara, editorial (a publicada) |
| Como se edita | Fontes em `src/` + `assemble.py` | Ficheiro único, editável à mão |
| Funcional | Igual nas duas: faixa de orçamento com `LEAD_ENDPOINT`, PostHog, CTA de foto, carrossel de 14 obras, barra fixa mobile |  |

Nota: o `LEAD_ENDPOINT` define-se em cada variante (no `src/src_script.html` da navy;
diretamente no `<script>` da creme). Ao escolher uma, aplicar o endpoint só nela.

## Captação de leads e medição

- **Faixa de orçamento** (por baixo do hero) e **formulário** enviam para um endpoint real
  quando `LEAD_ENDPOINT` está definido em `src/src_script.html` (ex.: Formspree
  `https://formspree.io/f/xxxxxxxx`, ou função serverless que reenvia para
  mdmassist@mdmassist.com). Payload: POST JSON com `origem` (`faixa-orcamento` /
  `formulario`) e `pagina`.
- **Sem endpoint** (estado atual), os rótulos ajustam-se sozinhos para não prometer o que
  não é captado: a faixa diz "Pedir contacto no WhatsApp" (abre rascunho com o número) e o
  formulário mantém o `mailto:`. Definir o endpoint muda os rótulos para "Quero ser
  contactado" / "Enviar pedido" e ativa a confirmação inline + fallback para email se o
  POST falhar. **Definir o endpoint é o passo nº 1 para maximizar leads.**
- **PostHog** (org MDM, projeto 226321, região UE) está instalado com
  `persistence: 'memory'` — sem cookies nem storage, logo sem necessidade de banner de
  consentimento; perde-se a distinção novo/recorrente de propósito. Eventos:
  `lead_strip_submit`, `quote_form_submit` (com `via`: endpoint/mailto/whatsapp),
  `intent_click` (avaria/contrato), `whatsapp_click`, `phone_click`.
- **Divisão de intenção** acima do formulário: "Tenho uma avaria" (WhatsApp com foto) vs
  "Quero um contrato de manutenção" (pré-seleciona o serviço no formulário).
- **Barra fixa mobile** (≤620px): "Ligar agora" + "Enviar foto" substitui o FAB.
- CTA principal do hero: **"Enviar foto da avaria"** — a foto é o CTA que mais converte
  neste setor.

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
- **Carrossel "Algumas das nossas obras":** 14 fotos reais, auto-scroll, pausa em hover, arrastável,
  com setas. Os cartões são duplicados por JS para o ciclo fechar sem costura.
- **Fornecedores:** marquee contínuo para a esquerda, meia página. Velocidade constante (70 px/s)
  calculada por JS a partir da largura real.
- **Formulário de contacto:** POST para `LEAD_ENDPOINT` quando definido; caso contrário `mailto:`
  e `wa.me` pré-preenchidos (ver **Captação de leads e medição**).

### Contraste (verificado)

O vermelho da marca `#B61918` **só serve como preenchimento** (com texto branco dá 6,7:1). Sobre o
navy tem apenas 2,8:1, por isso não pode ser usado em texto nem em traços:

| Token | Uso | Rácio |
|---|---|---|
| `--red` `#B61918` | preenchimentos, botões | 6,7:1 com branco |
| `--red-mark` `#D6392C` | traços e losangos sobre navy | 3,9:1 |
| `--red-ink` `#F0857A` | texto vermelho sobre navy | 7,3:1 |
| `--wa` `#12823F` | botão WhatsApp | 4,9:1 com branco |
| `--on-dark-2` `#A6AEC0` | texto secundário | 8,3:1 |

## Por verificar / decisões em aberto

- **Vermelho do logótipo vs. do site.** O quadrado do logótipo é carmim `#A30711`; o acento do site
  é `#B61918`. Ficaram diferentes de propósito (decisão adiada) — unificar quando houver decisão.
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
- Morada: Alameda dos Oceanos, 108A, 1990-426 Lisboa · Horário: 2ª–6ª, 8h–18h · NIF: 502 644 761
- Fundação: 1991 (35 anos). Marcas: Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi.
- **Não introduzir dados financeiros privados** (faturação, clientes, etc.) — já foram removidos
  de versões antigas de propósito.

## Próximos passos

1. **Definir `LEAD_ENDPOINT`** em `src/src_script.html` (Formspree ou serverless) e correr
   `python3 assemble.py` — é o que transforma a faixa e o formulário em captação real.
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
