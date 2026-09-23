// Edge function "lead": recebe o POST JSON do site (faixa + formulário),
// guarda em public.leads e, se existir RESEND_API_KEY, envia email ao escritório.
// Público (sem JWT): validação própria + limite de tamanho + CORS restrito.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const DESTINO = "mdmassist@mdmassist.com";
const ORIGENS = ["https://mdmassist.com", "https://www.mdmassist.com", "https://mdmassist.manus.space"];

function cors(req: Request) {
  const o = req.headers.get("origin") ?? "";
  // file:// e previews enviam "null"/vazio — aceitam-se para testes; produção é a lista
  const ok = ORIGENS.includes(o) || o === "null" || o === "";
  return {
    "Access-Control-Allow-Origin": ok ? (o || "*") : ORIGENS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, accept",
    "Content-Type": "application/json",
  };
}
const s = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : null);

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
  if (req.method !== "POST") return new Response(JSON.stringify({ erro: "método" }), { status: 405, headers: h });
  if (+(req.headers.get("content-length") ?? 0) > 20_000)
    return new Response(JSON.stringify({ erro: "demasiado grande" }), { status: 413, headers: h });

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return new Response(JSON.stringify({ erro: "json" }), { status: 400, headers: h }); }

  const lead = {
    origem: s(b.origem, 40) ?? "desconhecida",
    nome: s(b.empresa ?? b.nome, 200),
    email: s(b.email, 200),
    telefone: s(b.tel ?? b.telefone, 40),
    servico: s(b.servico, 120),
    mensagem: s(b.msg ?? b.mensagem, 4000),
    pagina: s(b.pagina, 500),
    referrer: s(b.referrer, 500),
    utm: s(b.utm, 500),
    ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    user_agent: s(req.headers.get("user-agent"), 300),
  };
  if (!lead.telefone && !lead.email)
    return new Response(JSON.stringify({ erro: "sem contacto" }), { status: 422, headers: h });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await db.from("leads").insert(lead);
  if (error) return new Response(JSON.stringify({ erro: "bd", detalhe: error.message }), { status: 500, headers: h });

  // email opcional (Resend): só se a chave estiver definida nos secrets
  const key = Deno.env.get("RESEND_API_KEY");
  let email = "não configurado";
  if (key) {
    const linhas = Object.entries(lead).filter(([k]) => !["ip", "user_agent"].includes(k))
      .map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("LEAD_FROM") ?? "Site MDM <onboarding@resend.dev>",
        to: [DESTINO],
        reply_to: lead.email ?? undefined,
        subject: `Novo pedido no site (${lead.origem}) — ${lead.nome ?? lead.telefone ?? lead.email}`,
        text: linhas,
      }),
    });
    email = r.ok ? "enviado" : `falhou ${r.status}`;
  }
  return new Response(JSON.stringify({ ok: true, email }), { status: 200, headers: h });
});
