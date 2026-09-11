# Backend de leads (Supabase)

O formulário e a faixa de orçamento fazem `POST` JSON para `LEAD_ENDPOINT`
(definido no `<script>` do `index.html`). Este diretório tem o recetor:

| Ficheiro | O que é |
|---|---|
| `leads.sql` | migração: tabela `public.leads` com RLS (só a função escreve) |
| `lead/index.ts` | edge function pública `lead`: valida, guarda, e envia email se houver `RESEND_API_KEY` |

## Publicar (projeto `kfhxlrikqjynvjdtywuc`, eu-west-1)

1. O projeto tem de estar **ativo** (no painel Supabase, se aparecer "Paused": *Restore project*).
   Projeto pausado = **503 em tudo** — foi essa a causa do formulário "não dar em lado nenhum".
2. Aplicar `leads.sql` (SQL Editor) e publicar a função `lead` com **verify JWT desligado**
   (é um endpoint público de formulário com validação própria).
3. `LEAD_ENDPOINT = 'https://kfhxlrikqjynvjdtywuc.supabase.co/functions/v1/lead'` no `index.html`.
4. Testar: `curl -X POST <endpoint> -H 'content-type: application/json' -d '{"origem":"teste","tel":"218935050"}'`
   → `{"ok":true,...}` e a linha aparece em *Table Editor → leads*.

## Email para o escritório

Sem chave, os leads ficam **guardados na tabela** (nada se perde) mas ninguém é avisado.
Para receber email em mdmassist@mdmassist.com: criar conta em resend.com, obter a API key,
e no Supabase → Edge Functions → Secrets definir `RESEND_API_KEY` (e opcionalmente
`LEAD_FROM`, um remetente do domínio verificado). A função passa a enviar sem redeploy.
