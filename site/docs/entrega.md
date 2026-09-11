# Entrega do site — o que tem de ficar em nome da MDM

Lista de verificação para o site deixar de depender de quem o construiu. Cada linha tem
**quem** faz, **onde** se faz e **como se confirma que ficou feito**. Enquanto houver linhas
por fechar, o site funciona, mas não é um ativo controlado pela empresa.

## 1 · Contas e propriedade (bloqueia tudo o resto)

| O quê | Estado | Como confirmar |
|---|---|---|
| **Domínio próprio** (ex.: mdmassist.pt) registado em nome da MDM, com o NIF da empresa | **Por fazer** — o site aponta para `mdmassist.manus.space` | Entrar no registrador com uma conta da empresa e ver o domínio na lista |
| **Alojamento** numa conta com email da empresa | **Por confirmar** | Entrar sem pedir palavra-passe a terceiros e publicar uma alteração |
| **Email `mdmassist@mdmassist.com`** com acesso ao painel | Existe | Entrar e criar/apagar um alias |
| **PostHog** (medição, projeto 226321, região UE) | Existe — confirmar o dono | Entrar em eu.posthog.com e ver a MDM como organização |
| **Sentry** (erros, org `mdm-5s`, região DE) | Existe — confirmar o dono | Entrar em sentry.io e abrir o projeto |
| **Formspree** (receção do formulário) | **Por criar** | Ver um pedido de teste na caixa de entrada do formulário |
| **Google Business Profile** | **Por criar/reivindicar** | A ficha aparece no Google Maps com a morada certa |
| **Google Search Console** | **Por criar** | O domínio aparece verificado e o sitemap submetido |

Regra prática: se para mexer no site for preciso pedir alguma coisa a alguém de fora da
empresa, essa linha ainda não está fechada.

## 2 · Passar para o domínio próprio

Um único comando reescreve tudo o que aponta para o domínio antigo — canonical, `og:url`,
`og:image`, `twitter:image`, o JSON-LD, o `robots.txt` e o `sitemap.xml`:

```bash
cd site
python3 externalize.py index.html deploy/creme --url https://www.mdmassist.pt
```

Depois: publicar a pasta `deploy/creme`, ativar HTTPS, e fazer o redirecionamento
permanente (301) de `mdmassist.pt` para `www.mdmassist.pt` (ou o contrário, mas **só uma**
das versões é a definitiva). Submeter o sitemap no Search Console.

## 3 · Ligar o formulário (sem isto não há leads)

1. Criar conta em formspree.io e um formulário novo.
2. Confirmar `mdmassist@mdmassist.com` quando o Formspree pedir.
3. Copiar o URL `https://formspree.io/f/xxxxxxxx` para a linha
   `const LEAD_ENDPOINT = '';` no `<script>` do `index.html`.
4. Correr `python3 externalize.py index.html deploy/creme` e publicar.
5. **Teste obrigatório:** enviar um pedido a partir de um telemóvel sem programa de email
   configurado e confirmar que chega à caixa de entrada. Guardar o print.

O que já está preparado do lado do site: assunto do email com a prioridade da lead
(`[P1 · Montagem AC]`…), `_replyto` com o email do cliente, campo-armadilha `_gotcha`
contra robôs, estados de "a enviar / enviado / tentar novamente" e, se o envio falhar duas
vezes, abertura do programa de email com o pedido preparado.

## 4 · Antes de divulgar o endereço

- [x] Política de privacidade publicada (`privacidade.html`), ligada no rodapé, na gaveta do
      telemóvel e junto ao formulário
- [x] Recusa de medição a funcionar (desliga PostHog e Sentry nesse browser)
- [x] `robots.txt` e `sitemap.xml` gerados com o domínio certo
- [x] Dados estruturados (HVACBusiness + Electrician + FAQPage) válidos
- [ ] HTTPS ativo no domínio próprio
- [ ] Ficha do Google Business Profile com o mesmo nome, morada e telefone do site
- [ ] **Confirmação por escrito das afirmações comerciais** (ponto 5)

## 5 · Afirmações que o dono tem de confirmar por escrito

O site publica-as; se alguma não for verdade, tem de ser corrigida antes de divulgar.

| Afirmação no site | Confirmado? |
|---|---|
| Fundação em 1991 (o site calcula "35 anos" a partir daí) | |
| Assistência multi-marca com peças originais e garantia de fabricante (Mitsubishi Electric, MIDEA, LG, France Air, Vulcano, Hitachi, entre outras) — e em que qualidade: revenda, assistência autorizada ou apenas intervenção multi-marca? | |
| "Intervenção em 24 a 48 h" e "resposta em menos de 24 horas úteis" | |
| Horário 2ª–6ª, 8h–17h, e o que acontece fora dele | |
| "Técnicos certificados em AVAC e eletricidade" — números de certificado | |
| "Certificação APIRAC · Registo IMPIC" — números e validade | |
| WhatsApp 910 307 579 pertence à empresa | |
| Clientes referidos (banca, indústria, condomínios, escolas) — com autorização para os mencionar, mesmo sem nome | |
| Fotografias das obras: são da MDM e há autorização dos clientes para as publicar | |
| Orçamento gratuito e sem compromisso | |

Já foi corrigido: "Resposta **garantida** em dias úteis" passou a "Respondemos em dias
úteis" — uma garantia que depende da carga de trabalho não deve ser publicada como promessa.

## 6 · Cópia de segurança e continuidade

- O site inteiro é o ficheiro `site/index.html` mais `site/privacidade.html`. Guardar uma
  cópia dos dois fora do alojamento (por exemplo, no Drive da empresa) e no repositório.
- As fotografias originais estão em `site/obras/`; o logótipo vetorial em `site/mdm-logo.svg`.
- Para reconstruir a pasta de publicação a partir do ficheiro único basta correr o
  `externalize.py`. Não é preciso ferramenta de compilação, conta de terceiros nem internet.

## 7 · Decisões técnicas que ficam documentadas (não são esquecimentos)

- **Ficheiro único.** O `index.html` traz o CSS, o JavaScript e as imagens em base64 (~570 KB)
  para poder ser aberto e publicado sem mais nada. Para publicar uma pasta usa-se o
  `externalize.py`, que separa as imagens: o HTML desce para ~114 KB e as imagens passam a ter
  cache própria e carregamento diferido. O CSS e o JavaScript continuam embutidos de
  propósito: são ~65 KB e, numa página só, poupar dois pedidos pesa mais do que a cache.
- **Google Fonts.** Os tipos de letra (Lora, Inter, JetBrains Mono) são carregados do Google,
  o que comunica o endereço IP do visitante ao fornecedor. Está declarado na política de
  privacidade. Para eliminar essa transferência é preciso alojar os ficheiros de fonte no
  próprio domínio (acrescenta ~150–250 KB à publicação). **Decisão do dono.**
- **Sem banner de cookies.** O site não usa cookies nem identifica o visitante entre visitas
  (PostHog com `persistence: 'memory'`), por isso não há consentimento a pedir para
  armazenamento. A medição assenta em interesse legítimo e pode ser recusada na política de
  privacidade. A única coisa escrita no equipamento é essa recusa, quando o visitante a faz.
