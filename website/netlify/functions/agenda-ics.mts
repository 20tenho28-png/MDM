/* Calendário de cada técnico, para subscrever no Google Calendar ou no iPhone: /api/agenda/<código>.ics
   O código é o ical_token do técnico (registo, «Prazos e exportar», Técnicos). A função só chama a função pública
   agenda_ical do Supabase (registo/supabase/agenda.sql) com a chave publicável, a mesma que as páginas usam, e devolve o
   texto em iCalendar. Não guarda nada, não precisa de chaves secretas nem de entrar no Google.
   Sentido único: o Google lê o registo de tantas em tantas horas (o iPhone pode ler de 15 em 15 minutos); mudar uma
   visita no Google não a muda no registo. */
import type { Config } from "@netlify/functions"

const SUPABASE_URL = "https://kfhxlrikqjynvjdtywuc.supabase.co"
const SUPABASE_KEY = "sb_publishable_Kpi28Ee4n0q7NAOaFVg7tQ_EtjyFgov"

/* RFC 5545: linhas com mais de 75 octetos partem-se e a continuação começa com um espaço. Conta em bytes UTF-8 e nunca
   parte um carácter a meio. */
export function dobra(texto: string): string {
  const enc = new TextEncoder()
  return texto
    .split("\r\n")
    .map((linha) => {
      if (enc.encode(linha).length <= 75) return linha
      const partes: string[] = []
      let atual = ""
      let bytes = 0
      let limite = 75
      for (const c of linha) {
        const n = enc.encode(c).length
        if (bytes + n > limite) {
          partes.push(atual)
          atual = ""
          bytes = 0
          limite = 74
        }
        atual += c
        bytes += n
      }
      partes.push(atual)
      return partes.join("\r\n ")
    })
    .join("\r\n")
}

export default async (req: Request) => {
  const ultimo = new URL(req.url).pathname.split("/").pop() || ""
  const token = decodeURIComponent(ultimo).replace(/\.ics$/i, "")
  if (!/^[A-Za-z0-9]{20,100}$/.test(token)) return new Response("Calendário não encontrado", { status: 404 })
  let r: Response
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/agenda_ical`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    })
  } catch {
    return new Response("Sem ligação ao registo", { status: 502 })
  }
  if (!r.ok) return new Response("Sem ligação ao registo", { status: 502 })
  const texto = (await r.json()) as string | null
  if (!texto) return new Response("Calendário não encontrado", { status: 404 })
  return new Response(dobra(texto), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="agenda-mdm.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}

export const config: Config = {
  path: "/api/agenda/:token",
  method: "GET",
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ["ip", "domain"] },
}
