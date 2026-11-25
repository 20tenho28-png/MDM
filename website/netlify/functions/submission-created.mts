/* Pedidos do site entram sozinhos no registo.
   O Netlify chama esta função (pelo nome, submission-created) em cada envio dos formulários que não marcou como spam.
   Para os dois formulários de pedido («orcamento» e «orcamento-comercial», site/formularios.html) chama a função
   pedido_do_site do Supabase (registo/supabase/pedidos-do-site.sql) e o pedido aparece em Novo, com origem «site».
   O aviso por email do Netlify continua igual: isto junta-se a ele, não o substitui.
   Precisa da variável MDM_SITE_ENTRADA no Netlify (a mesma chave cujo sha256 está na tabela segredos). Sem ela, ou com o
   Supabase em baixo, regista o erro no log e responde 200: o cliente nunca vê um erro por causa disto, e o pedido
   continua no email e no painel Forms do Netlify. */

const SUPABASE_URL = "https://kfhxlrikqjynvjdtywuc.supabase.co"
const SUPABASE_KEY = "sb_publishable_Kpi28Ee4n0q7NAOaFVg7tQ_EtjyFgov"
const FORMULARIOS = ["orcamento", "orcamento-comercial"]

type Dados = Record<string, unknown>

const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

/* «Pedido: Avaria» → tipo do registo (TIPOS em registo/index.html). */
export function tipoDe(servico: string, mensagem: string): string | null {
  const pedido = (/^Pedido:\s*(.+)$/m.exec(mensagem)?.[1] || servico.split(":")[0] || "").trim()
  if (pedido === "Avaria") return "reparacao"
  if (pedido === "Manutenção") return "manutencao"
  if (pedido === "Instalação") return "instalacao"
  return null
}

/* Monta os campos que pedido_do_site recebe a partir do envio do Netlify (payload.data). */
export function camposDe(formulario: string, data: Dados, chave: string) {
  const mensagem = txt(data.mensagem)
  const servico = txt(data.servico)
  const linha = (rotulo: string) => new RegExp("^" + rotulo + ":\\s*(.+)$", "m").exec(mensagem)?.[1]?.trim() || ""
  const triagem = txt(data.triagem)
  const descricao = [servico, triagem && "Triagem do site: " + triagem, mensagem].filter(Boolean).join("\n")
  return {
    p_chave: chave,
    p_referencia: linha("Referência") || null,
    p_formulario: formulario,
    p_cliente: txt(data.nome),
    p_telefone: txt(data.telefone),
    p_email: txt(data.email),
    p_tipo: tipoDe(servico, mensagem),
    p_localidade: linha("Localidade"),
    p_descricao: descricao,
  }
}

export async function regista(corpo: string, chave: string | undefined, fetcher: typeof fetch = fetch) {
  let payload: { form_name?: string; data?: Dados }
  try {
    payload = JSON.parse(corpo || "{}").payload || {}
  } catch {
    return { ok: false, motivo: "corpo inválido" }
  }
  const formulario = payload.form_name || txt(payload.data?.["form-name"])
  if (!FORMULARIOS.includes(formulario)) return { ok: true, motivo: "outro formulário" }
  if (!chave) return { ok: false, motivo: "falta MDM_SITE_ENTRADA" }
  const r = await fetcher(SUPABASE_URL + "/rest/v1/rpc/pedido_do_site", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(camposDe(formulario, payload.data || {}, chave)),
  })
  if (!r.ok) return { ok: false, motivo: "Supabase " + r.status + ": " + (await r.text()).slice(0, 300) }
  return { ok: true, id: await r.json() }
}

export const handler = async (event: { body?: string | null }) => {
  try {
    const res = await regista(event.body || "", process.env.MDM_SITE_ENTRADA)
    if (!res.ok) console.error("submission-created: pedido não entrou no registo:", res.motivo)
    else if ("id" in res) console.log("submission-created: entrou no registo como", res.id)
  } catch (e) {
    console.error("submission-created: erro", e)
  }
  return { statusCode: 200, body: "" }
}
