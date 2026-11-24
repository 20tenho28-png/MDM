/* Espelho da caixa de correio oficial no registo, só de leitura.
   De 15 em 15 minutos liga-se por IMAP, abre a caixa de entrada em modo de leitura (EXAMINE), lê as mensagens novas
   desde a última vez e guarda remetente, assunto, data e as primeiras linhas na tabela public.correio do Supabase
   (registo/supabase/correio.sql). Não marca como lida, não move, não apaga e não envia nada.

   Segredos, postos à mão no painel do Netlify (Site configuration, Environment variables), nunca no repositório:
     IMAP_HOST, IMAP_USER, IMAP_PASSWORD       servidor e conta da caixa oficial
     SUPABASE_SERVICE_ROLE_KEY                 chave de serviço do projeto (só esta função a usa)
   Opcionais:
     IMAP_PORT (993), IMAP_PASTA (INBOX)
     CORREIO_DESDE (AAAA-MM-DD)                na primeira vez, de quando em diante se carrega o histórico
     CORREIO_MAX (25)                          mensagens por execução; o histórico entra aos poucos, 25 de cada vez */
import type { Config } from "@netlify/functions"
import { ImapFlow } from "imapflow"
import { simpleParser } from "mailparser"

const SUPABASE_URL = "https://kfhxlrikqjynvjdtywuc.supabase.co"
const RESUMO_MAX = 600
const FONTE_MAX = 200000

type Estado = { uidvalidity: number | null; ultimo_uid: number }

function env(nome: string): string {
  const v = process.env[nome]
  if (!v) throw new Error("falta a variável " + nome)
  return v
}

async function supabase(caminho: string, init: RequestInit = {}): Promise<Response> {
  const chave = env("SUPABASE_SERVICE_ROLE_KEY")
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + caminho, {
    ...init,
    headers: { apikey: chave, Authorization: "Bearer " + chave, "Content-Type": "application/json", ...(init.headers || {}) },
  })
  if (!r.ok) throw new Error("Supabase " + r.status + " em " + caminho.split("?")[0])
  return r
}

async function lerEstado(pasta: string): Promise<Estado> {
  const r = await supabase("correio_estado?pasta=eq." + encodeURIComponent(pasta) + "&select=uidvalidity,ultimo_uid")
  const linhas = (await r.json()) as Estado[]
  return linhas.length ? linhas[0] : { uidvalidity: null, ultimo_uid: 0 }
}

export function resumir(texto: string | undefined | null): string | null {
  if (!texto) return null
  const limpo = texto.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim()
  return limpo ? limpo.slice(0, RESUMO_MAX) : null
}

/* Escolhe o que se lê nesta execução: os UID acima do último visto, do mais antigo para o mais recente, até ao limite.
   Um intervalo «n:*» devolve sempre a última mensagem da caixa, mesmo que o UID dela seja menor que n: filtra-se. */
export function escolher(uids: number[], ultimo: number, max: number): number[] {
  return uids.filter((u) => u > ultimo).sort((a, b) => a - b).slice(0, max)
}

export default async function correioEspelho(): Promise<Response> {
  const pasta = process.env.IMAP_PASTA || "INBOX"
  const max = Math.max(1, Math.min(100, Number(process.env.CORREIO_MAX || 25)))
  const cliente = new ImapFlow({
    host: env("IMAP_HOST"),
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: env("IMAP_USER"), pass: env("IMAP_PASSWORD") },
    logger: false,
  })
  let guardadas = 0
  let vistas = 0
  try {
    const estado = await lerEstado(pasta)
    await cliente.connect()
    const caixa = await cliente.mailboxOpen(pasta, { readOnly: true })
    const validade = Number(caixa.uidValidity)
    let ultimo = estado.ultimo_uid
    if (estado.uidvalidity !== null && Number(estado.uidvalidity) !== validade) ultimo = 0

    const criterio =
      ultimo > 0
        ? { uid: ultimo + 1 + ":*" }
        : process.env.CORREIO_DESDE
          ? { since: new Date(process.env.CORREIO_DESDE) }
          : { since: new Date(Date.now() - 7 * 86400000) }
    const achados = (await cliente.search(criterio, { uid: true })) || []
    const uids = escolher(achados, ultimo, max)

    const linhas: Record<string, unknown>[] = []
    for (const uid of uids) {
      const m = await cliente.fetchOne(String(uid), { envelope: true, source: { maxLength: FONTE_MAX } }, { uid: true })
      vistas++
      if (!m || !m.envelope) continue
      const de = (m.envelope.from && m.envelope.from[0]) || { name: "", address: "" }
      let resumo: string | null = null
      try {
        if (m.source) resumo = resumir((await simpleParser(m.source, { skipHtmlToText: false })).text)
      } catch (e) {
        resumo = null
      }
      linhas.push({
        pasta,
        uid,
        message_id: m.envelope.messageId || null,
        de_nome: de.name || null,
        de_email: (de.address || "").toLowerCase() || null,
        assunto: m.envelope.subject || null,
        recebido_em: m.envelope.date ? new Date(m.envelope.date).toISOString() : null,
        resumo,
        em_resposta_a: m.envelope.inReplyTo || null,
      })
    }

    if (linhas.length) {
      await supabase("correio?on_conflict=pasta,uid", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(linhas),
      })
      guardadas = linhas.length
    }
    const novoUltimo = uids.length ? uids[uids.length - 1] : ultimo
    await supabase("correio_estado?on_conflict=pasta", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([{ pasta, uidvalidity: validade, ultimo_uid: novoUltimo, atualizado: new Date().toISOString() }]),
    })
    return Response.json({ ok: true, vistas, guardadas, ultimo_uid: novoUltimo })
  } catch (e) {
    /* A mensagem de erro nunca leva a palavra-passe nem o conteúdo de mensagens. */
    const motivo = e instanceof Error ? e.message.slice(0, 200) : "erro"
    console.error("correio-espelho:", motivo)
    return Response.json({ ok: false, vistas, guardadas, motivo }, { status: 500 })
  } finally {
    try {
      await cliente.logout()
    } catch (e) {
      /* ligação já fechada */
    }
  }
}

export const config: Config = { schedule: "*/15 * * * *" }
