# MDM Assist — Website · Pacote de passagem

Site institucional da **Manuel Domingues Melancia, Lda (MDM)** — assistência técnica a edifícios
(ar condicionado, eletricidade, ventilação) na grande Lisboa, desde 1991.

## Conteúdo do pacote

| Ficheiro | Descrição |
|---|---|
| `index.html` | O site completo, auto-contido (HTML + CSS + JS + imagens em base64). É o único ficheiro necessário para publicar. |
| `mdm-logo.svg` | Logótipo vetorial limpo (recriado por trace do original). Reutilizável em cartões, faturas, email. |
| `assets-fonte/` | Fotos originais em alta resolução (já estão embutidas e otimizadas no index.html; guardadas aqui para reutilização futura). |

## Stack e decisões técnicas

- **Vanilla HTML/CSS/JS, um único ficheiro.** Decisão deliberada — foi testada uma versão React e abandonada
  (complexidade sem benefício para uma one-page). Não converter para framework sem necessidade real.
- **Design:** paleta creme (#F4F1EA aprox.) + carmim (#A30711, a cor do logótipo). Tipografia serif nos títulos
  com itálico vermelho de destaque. Fontes via Google Fonts.
- **Logótipo:** SVG inline no `<head>` da nav (classe `.logo-img`, 56×54px). Atenção: os path data do SVG usam
  espaços como separadores — não "minificar" removendo quebras de linha sem os substituir por espaço.
- **Animação de fundo:** Three.js (via cdnjs, import dinâmico em try/catch — se o CDN falhar, o site funciona na mesma).
- **Carrossel "Algumas das nossas obras":** 9 fotos reais, auto-scroll, pausa em hover, arrastável.
- **Formulário de contacto:** sem back-end — os botões abrem mailto: e wa.me pré-preenchidos.

## Monitorização (Sentry) — instalado, por verificar

- Loader Script + `Sentry.init` no `<head>` com DSN:
  `https://f31a40fed7d908991cf6b3b9e8932c77@o4511750499926016.ingest.de.sentry.io/4511802709573712`
- Org: `mdm-5s.sentry.io` · plataforma Browser JavaScript · região DE (UE).
- `sendDefaultPii: false` (decisão RGPD — não recolher IP/dados pessoais).
- Session Replay **desligado** de propósito (exigiria política de privacidade no site). As linhas
  `replaysSessionSampleRate`/`replaysOnErrorSampleRate` não estão no init.
- **Verificação pendente** (só possível com o site online): abrir o site, consola do browser,
  executar `myUndefinedFunction();` e confirmar o evento no painel Sentry.

## Dados reais (não alterar sem confirmação)

- Telefone: 218 935 050 · WhatsApp: 910 307 579 · Email: mdmassist@mdmassist.com
- Morada: Alameda dos Oceanos, 108A, 1990-426 Lisboa · Horário: 2ª–6ª, 8h–18h · NIF: 502 644 761
- Fundação: 1991 (35 anos). Marcas: Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi.
- **Não introduzir dados financeiros privados** (faturação, clientes, etc.) — já foram removidos
  de versões antigas de propósito.

## Próximos passos (por ordem)

1. **Publicar** — Netlify/Vercel/etc. Arrastar o `index.html` chega (site estático, sem build).
   Idealmente domínio próprio (ex.: mdmassist.pt) com HTTPS.
2. **Verificar Sentry** — teste `myUndefinedFunction();` na consola do site publicado.
3. **Formulário a sério (opcional)** — trocar mailto/wa.me por envio real de email
   (Resend, Formspree ou função serverless) para mdmassist@mdmassist.com.
4. **Analytics (opcional)** — existe projeto PostHog criado (org "MDM", projeto id 226321,
   eu.posthog.com) mas o snippet **não** está no site. Se se quiser analytics, adicionar o
   snippet do PostHog e a respetiva nota de privacidade/cookies (RGPD).
5. **Session Replay do Sentry (opcional)** — se se ativar, adicionar política de privacidade no site.

## Notas para agentes de código

- O ficheiro é grande (~320 KB) por causa das imagens base64 — é intencional. Ao editar,
  evitar reescrever o ficheiro inteiro; fazer edições cirúrgicas.
- Testado em desktop (1440px) e mobile (390px), sem erros de consola
  (excluindo CDNs bloqueados em sandbox, que funcionam na web real).
