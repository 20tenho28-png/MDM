/* Assistente de propostas da equipa MDM (página equipa/proposta.html, interna, com senha).
   A equipa escreve o pedido do cliente («sala de 25 m² e dois quartos, 3.º andar, quanto custa?»); o Claude faz as
   perguntas que faltam e chama as ferramentas abaixo, que fazem as contas com as mesmas regras e os mesmos números do
   formulário do site (netlify/lib/calculo.mjs, data/site.json «btu», data/precos.json). A IA nunca inventa um preço:
   repete o que as ferramentas devolvem. «preparar_proposta» devolve a proposta modelo pronta (texto e dados para o PDF).

   Um pedido HTTP = uma chamada ao modelo (mais as ferramentas, aqui no servidor). Quando o modelo pede ferramentas, a
   resposta traz «continuar: true» e a página volta a chamar com o histórico novo: assim nenhum pedido se aproxima do
   limite de 60 s das funções. O histórico vive na página e volta inteiro a cada pedido, sempre só acrescentado.

   Três caminhos, do mais barato ao mais caro (campo «acao» do pedido):
   - «tabela» e «calcular»: o formulário passo a passo. Sem IA, custo zero: as perguntas da tabela e a proposta.
   - «ler»: o Claude Haiku lê o texto do pedido do cliente (WhatsApp, email) e devolve os campos do formulário, que a
     equipa confirma. Uma chamada barata por pedido. Se falhar, o formulário continua a funcionar à mão.
   - sem «acao» (com «mensagens»): o assistente completo, em conversa (Opus), para os casos complexos.

   Variáveis no Netlify (âmbito Functions): MDM_EQUIPA_SENHA (sempre), ANTHROPIC_API_KEY (para «ler» e para a conversa;
   sem ela o formulário funciona na mesma) e, para experimentar com a tabela de teste (data/precos-teste.json, números
   falsos), MDM_PRECOS=teste. README.md, «Assistente de propostas». */
import Anthropic from "@anthropic-ai/sdk"
import type { Config, Context } from "@netlify/functions"
import { createHash, timingSafeEqual } from "node:crypto"
import site from "../../data/site.json" with { type: "json" }
import precosReais from "../../data/precos.json" with { type: "json" }
import precosTeste from "../../data/precos-teste.json" with { type: "json" }
import { configPotencia, configPreco, potencia, preco } from "../lib/calculo.mjs"

const MODELO = "claude-opus-5-5"
const MODELO_LEITURA = "claude-haiku-5-5"
const MAX_MENSAGENS = 120
const MAX_BYTES = 400_000

type Env = { get(nome: string): string | undefined }
declare const Netlify: { env: Env }

/* ── Dados e cálculo ── */

function tabela(env: Env) {
  const teste = env.get("MDM_PRECOS") === "teste"
  const C = configPotencia(site.btu)
  return { teste, C, T: configPreco(teste ? precosTeste : precosReais, C) }
}
type Tabela = ReturnType<typeof tabela>

/* o que o dono não quer em nada escrito pela MDM (as mesmas regras do build.py, PROIBIDO) */
const PROIBIDO: [RegExp, string][] = [
  [/\b\d+\s*(?:h|horas)\s+úteis|\b(?:24|48)\s*(?:h|horas)\b|\b\d+\s*(?:a|–|-)\s*\d+\s*(?:h|horas)\b|mesmo dia|\b\d+\s*minutos\b/i,
    "promessa de prazo de resposta"],
  [/\b[34]\d\s+anos\b/, "idade da empresa (só «desde 1991»)"],
  [/\b(?:LG|Hitachi|Vulcano|Panasonic|Climaveneta|Samsung|Toshiba|Fujitsu|Gree|Haier|Bosch|Ariston)\b/i,
    "marca fora da lista (só Midea, Mitsubishi Electric, Daikin, France Air)"],
]
function limpa(t: unknown, max = 300): string {
  return String(t ?? "").replace(/\s*[—–]\s*/g, ", ").replace(/\s+/g, " ").trim().slice(0, max)
}
function proibido(t: string): string | null {
  for (const [re, porque] of PROIBIDO) if (re.test(t)) return porque
  return null
}

const SERVICOS: Record<string, string> = {
  ac: "Montagem de ar condicionado",
  aguasQuentes: "Bomba de calor para águas quentes",
}
const CONDICOES = [
  "Preço com IVA.",
  "O preço final fica fechado depois da visita, que é gratuita.",
  "Proposta modelo, feita a partir do que nos contou. Não é vinculativa.",
]

function agoraLisboa() {
  const d = new Date()
  const p = Object.fromEntries(new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon", year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]))
  return {
    ref: `MDM-P-${p.year}${p.month}${p.day}-${p.hour}${p.minute}`,
    data: new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", day: "numeric", month: "long", year: "numeric" }).format(d),
  }
}

/* entrada das ferramentas (o formato do esquema) para o formato de calculo.mjs */
function divisoesDe(input: any) {
  return (Array.isArray(input?.divisoes) ? input.divisoes : []).map((d: any) => (
    { tipo: d.tipo, area: d.area, sol: !!d.sol, ultimoAndar: !!d.ultimo_andar }))
}
function opcoesDe(input: any) {
  return { servico: input?.servico, divisoes: divisoesDe(input), respostas: input?.respostas || {} }
}

/* o que o modelo recebe de volta: só o que precisa para responder, com o texto já formatado */
function paraModelo(r: any, teste: boolean) {
  const base: any = { modo: r.modo, valores_de_teste: teste || undefined }
  if (r.erro) base.erro = r.erro
  if (r.potencia) base.potencia = r.potencia.resumo
  if (r.modo === "preco") {
    base.blocos = r.blocos
    base.inclui = r.inclui
    base.considerado = r.dets
    base.nota = CONDICOES.slice(0, 2).join(" ")
  }
  if (r.modo === "visita") base.nota = "Para este caso o preço dá-se depois da visita, que é gratuita."
  if (r.modo === "sem_tabela") base.nota = "Ainda não há preços para este produto na tabela da MDM. Não dê nenhum valor."
  if (r.modo === "escolhe") base.nota = "Falta o tamanho do depósito."
  if (r.porResponder?.length) base.perguntas_por_responder = r.porResponder
  if (r.ignoradas?.length) base.respostas_ignoradas = r.ignoradas
  return base
}

function textoProposta(p: any): string {
  const l: string[] = []
  if (p.teste) l.push("VALORES DE TESTE, NÃO ENVIAR AO CLIENTE", "")
  l.push(`Proposta modelo ${p.ref} · ${p.data}`, `${site.name}`, "")
  const c = p.cliente
  if (c.nome) l.push(`Cliente: ${c.nome}`)
  if (c.contacto) l.push(`Contacto: ${c.contacto}`)
  if (c.local) l.push(`Local: ${c.local}`)
  if (c.nome || c.contacto || c.local) l.push("")
  l.push(`${p.servico}`)
  if (p.pedido) l.push(`O que nos pediu: ${p.pedido}`)
  if (p.potencia) l.push(`Potência estimada: ${p.potencia}`)
  l.push("")
  if (p.modo === "visita") l.push("Para este caso o preço dá-se depois da visita, que é gratuita.")
  for (const b of p.blocos) {
    l.push(b.titulo)
    for (const g of b.gamas) {
      l.push(`- ${g.gama} (${g.exemplo}): ${g.texto}`)
      if (g.umaPorDivisao) l.push(`  Com uma máquina para cada divisão: ${g.umaPorDivisao}`)
    }
  }
  if (p.inclui) l.push(`Inclui: ${p.inclui}`)
  if (p.considerado.length > 1) l.push(`Considerámos: ${p.considerado.slice(1).join(", ")}.`)
  if (p.observacoes.length) { l.push("", "Notas:"); p.observacoes.forEach((o: string) => l.push(`- ${o}`)) }
  l.push("", ...p.condicoes, "")
  l.push(`${site.name} · desde ${site.founded} · ${site.phone} (${site.hours}) · WhatsApp ${site.whatsapp} · ${site.email}`)
  l.push(`${site.address1}, ${site.address2}`)
  return l.join("\n")
}

function prepararProposta(input: any, tab: Tabela) {
  const servico = input?.servico
  const r: any = preco(tab.T, opcoesDe(input))
  if (r.modo === "erro" || r.modo === "sem_tabela" || r.modo === "escolhe") return { erro: paraModelo(r, tab.teste) }
  const recusadas: string[] = []
  const observacoes = (Array.isArray(input?.observacoes) ? input.observacoes : []).slice(0, 6)
    .map((o: unknown) => limpa(o, 240)).filter((o: string) => {
      const porque = o && proibido(o)
      if (porque) recusadas.push(`«${o}»: ${porque}`)
      return o && !porque
    })
  const pedido = limpa(input?.pedido, 400)
  const porque = proibido(pedido)
  if (porque) recusadas.push(`pedido: ${porque}`)
  const { ref, data } = agoraLisboa()
  const proposta = {
    ref, data, teste: tab.teste, modo: r.modo,
    servico: SERVICOS[servico] || servico,
    cliente: { nome: limpa(input?.cliente?.nome, 120), contacto: limpa(input?.cliente?.contacto, 120), local: limpa(input?.cliente?.local, 160) },
    pedido: porque ? "" : pedido,
    potencia: r.potencia ? r.potencia.resumo : "",
    divisoes: r.potencia ? r.potencia.divs : [],
    blocos: r.modo === "preco" ? r.blocos : [],
    inclui: r.modo === "preco" ? r.inclui : "",
    considerado: r.modo === "preco" ? r.dets : [],
    resumo: r.modo === "preco" ? r.resumo : "",
    observacoes,
    condicoes: CONDICOES,
    empresa: {
      nome: site.name, nomeLegal: site.legalName, nif: site.nif, desde: site.founded, telefone: site.phone, horario: site.hours,
      whatsapp: site.whatsapp, email: site.email, morada: [site.address1, site.address2],
    },
  }
  const texto = textoProposta(proposta)
  return {
    proposta: { ...proposta, texto },
    paraModelo: {
      ok: true, ref, modo: r.modo, valores_de_teste: tab.teste || undefined,
      perguntas_por_responder: r.porResponder?.length ? r.porResponder : undefined,
      notas_recusadas: recusadas.length ? recusadas : undefined,
      mostrada: "A proposta já aparece à equipa, com texto para copiar e PDF. Não a repita por inteiro: diga só o essencial.",
    },
  }
}

/* ── Ferramentas ── */

function esquemaDivisoes() {
  const tipos = Object.keys(site.btu.tipos)
  return {
    type: "array", description: "As divisões a climatizar (só para ar condicionado; vazio para águas quentes).",
    items: {
      type: "object", additionalProperties: false, required: ["tipo", "area", "sol", "ultimo_andar"],
      properties: {
        tipo: { type: "string", enum: tipos },
        area: { type: "number", description: "Área em m²." },
        sol: { type: "boolean", description: "Muito sol (janelas grandes viradas a sul ou a poente)." },
        ultimo_andar: { type: "boolean", description: "Último andar (por baixo do telhado)." },
      },
    },
  }
}
function esquemaRespostas(tab: Tabela) {
  const respostaProps: Record<string, any> = {}
  for (const k of ["pre", "dist", "furo", "fora", "luz", "antigas", "deposito"]) {
    const q = tab.T.perguntas.find((p: any) => p.k === k)
    respostaProps[k] = {
      type: "string", enum: ["", ...(q ? q.op.map((o: string[]) => o[0]) : [])],
      description: q ? `${q.t} Opções: ${q.op.map((o: string[]) => `«${o[0]}» = ${o[1].replace(/ /g, " ")}`).join("; ")}. «» = ainda não respondido.`
        : "A tabela não tem esta pergunta: deixe «».",
    }
  }
  return { type: "object", additionalProperties: false, required: Object.keys(respostaProps), properties: respostaProps }
}

function ferramentas(tab: Tabela): Anthropic.Tool[] {
  const divisoes = esquemaDivisoes(), respostas = esquemaRespostas(tab)
  const servico = { type: "string", enum: ["ac", "aguasQuentes"], description: "«ac» = montagem de ar condicionado; «aguasQuentes» = bomba de calor para águas quentes." }
  return [
    {
      name: "calcular_potencia", strict: true,
      description: "Estima a potência de ar condicionado (BTU/h) de cada divisão e o total, com as regras do formulário do site. Use sempre esta ferramenta para potências: nunca faça a conta de cabeça.",
      input_schema: { type: "object", additionalProperties: false, required: ["divisoes"], properties: { divisoes } },
    },
    {
      name: "calcular_preco", strict: true,
      description: "Preço provável com IVA (intervalo mínimo e máximo por gama), com a tabela de preços da MDM e as mesmas regras do formulário do site. Devolve também as perguntas ainda por responder que mudam o preço. Use sempre esta ferramenta para preços e repita os valores exatamente como vêm.",
      input_schema: { type: "object", additionalProperties: false, required: ["servico", "divisoes", "respostas"], properties: { servico, divisoes, respostas } },
    },
    {
      name: "preparar_proposta", strict: true,
      description: "Prepara a proposta modelo para o cliente (texto para copiar e PDF), com os preços calculados aqui a partir dos mesmos dados de calcular_preco. Use quando a equipa pedir a proposta, depois de ter os dados que mudam o preço.",
      input_schema: {
        type: "object", additionalProperties: false, required: ["servico", "divisoes", "respostas", "cliente", "pedido", "observacoes"],
        properties: {
          servico, divisoes, respostas,
          cliente: {
            type: "object", additionalProperties: false, required: ["nome", "contacto", "local"],
            properties: {
              nome: { type: "string", description: "Nome do cliente, se a equipa o deu; senão «»." },
              contacto: { type: "string", description: "Telefone ou email do cliente, se a equipa o deu; senão «»." },
              local: { type: "string", description: "Localidade ou morada da obra, se a equipa a deu; senão «»." },
            },
          },
          pedido: { type: "string", description: "Uma frase simples com o que o cliente pediu, nas palavras dele." },
          observacoes: { type: "array", items: { type: "string" }, description: "No máximo 4 notas curtas e factuais tiradas da conversa (ex.: «A máquina de fora fica na varanda das traseiras.»). Sem preços, prazos, garantias ou promessas. Vazio se não houver." },
        },
      },
    },
  ] as Anthropic.Tool[]
}

function sistema(tab: Tabela): string {
  const perguntas = tab.T.perguntas.length
    ? tab.T.perguntas.map((q: any) => `- ${q.ac ? "Ar condicionado" : "Águas quentes"}: ${q.t} (${q.op.map((o: string[]) => o[1].replace(/ /g, " ")).join(" / ")})`).join("\n")
    : "- (a tabela de preços ainda está vazia: não há perguntas de preço)"
  const produtos = [tab.T.temAC ? "montagem de ar condicionado (split para 1 divisão, multi-split para 2 a 4)" : "",
    tab.T.temBC ? "bomba de calor para águas quentes (depósito de 200 L ou 300 L)" : ""].filter(Boolean).join(" e ")
  return `És o assistente de propostas da equipa da ${site.name}, empresa de Lisboa desde ${site.founded}: ar condicionado, bombas de calor, ventilação, eletricidade e manutenção, na Grande Lisboa. Falas com a equipa da MDM, não com o cliente. A equipa conta-te o que o cliente pediu e tu ajudas a responder à pergunta «quanto custa?» e a preparar uma proposta modelo.

Como trabalhas:
- As contas são sempre das ferramentas. Potência: calcular_potencia. Preço: calcular_preco. Proposta: preparar_proposta. Nunca calcules, arredondes, somes ou estimes um número tu mesmo, e repete os valores exatamente como as ferramentas os devolvem.
- Nunca inventes preços, descontos, prazos, garantias, marcas, modelos de máquinas ou datas. Se a ferramenta disser que não há preço («sem_tabela») ou que o preço se dá depois da visita («visita»), diz isso mesmo.
- Hoje a tabela tem preços para: ${produtos || "nada (ainda vazia)"}. Para outros trabalhos (reparação, manutenção, ventilação, eletricidade, outros equipamentos) não há tabela: o preço dá-se depois da visita, que é gratuita.
- Para ar condicionado, precisas de cada divisão: tipo (${Object.keys(site.btu.tipos).join(", ")}), área em m², se tem muito sol e se é último andar. Se a equipa só disser «um T2», pergunta as áreas.
- Depois, as perguntas que mudam o preço (faz só as que faltam, no máximo três de cada vez, numa mensagem curta):
${perguntas}
- Se faltar alguma resposta, podes dar já o preço com o que há e dizer o que ainda pode mudar. Uma resposta «não sei» é válida.
- Quando a equipa pedir a proposta, chama preparar_proposta com os mesmos dados. As observações são notas curtas e factuais da conversa, sem preços nem promessas.${tab.teste ? `
- ATENÇÃO: a tabela em uso é de TESTE, com números falsos. Lembra a equipa disso sempre que deres um preço ou uma proposta.` : ""}

Como escreves:
- Português de Portugal, frases curtas e simples, tom de colega. Texto simples, sem markdown: nada de asteriscos, cardinais ou tabelas. Para listas usa linhas que começam por «- ».
- Os preços são sempre um intervalo por gama, com IVA, e terminam com: «O preço final fica fechado depois da visita, que é gratuita.»
- Marcas: só podes nomear Midea, Mitsubishi Electric, Daikin e France Air.
- A idade da empresa diz-se só com «desde ${site.founded}», nunca em anos.
- Nenhum prazo de resposta, a não ser «respondemos no dia útil seguinte».
- Sem travessões.`
}

/* ── Formulário (sem IA) ── */

/* o que o formulário precisa de saber da tabela: tipos de divisão, limites e as perguntas que mudam o preço */
function infoTabela(tab: Tabela) {
  const b = site.btu
  return {
    teste: tab.teste, temAC: tab.T.temAC, temBC: tab.T.temBC, tipos: Object.keys(b.tipos),
    areaMin: b.areaMin, areaMax: b.areaMax, maxDivisoes: b.maxDivisoes,
    perguntas: tab.T.perguntas.map((q: any) => ({ k: q.k, ac: q.ac, t: q.t, op: q.op.map((o: string[]) => [o[0], o[1].replace(/ /g, " ")]) })),
  }
}

/* quando é melhor passar o caso ao assistente completo (ou à visita): o que a tabela não cobre */
function complexidade(input: any, r: any, extra: string[] = []): string[] {
  const m = [...extra]
  const servico = input?.servico
  if (servico !== "ac" && servico !== "aguasQuentes")
    m.push("Trabalho sem tabela de preços (reparação, manutenção, ventilação, eletricidade ou outro): o preço dá-se depois da visita.")
  else if (r?.modo === "sem_tabela") m.push("Ainda não há preços na tabela da MDM para este produto.")
  if (servico === "ac" && r?.potencia) {
    if (r.potencia.n > 4) m.push(`São ${r.potencia.n} divisões: a tabela vai até 4 (multi-split); acima disso, dimensiona-se na visita.`)
    if (r.potencia.acima) m.push("Há uma divisão acima do maior aparelho da tabela: pode precisar de mais do que uma máquina ou de condutas.")
  }
  return [...new Set(m)]
}

function calcular(input: any, tab: Tabela) {
  const servico = input?.servico
  if (servico !== "ac" && servico !== "aguasQuentes") return { modo: "outro", complexo: complexidade(input, null) }
  const r: any = preco(tab.T, opcoesDe(input))
  const out: any = { modo: r.modo, resultado: paraModelo(r, tab.teste), complexo: complexidade(input, r) }
  if (r.modo === "preco" || r.modo === "visita") {
    const p: any = prepararProposta(input, tab)
    if (p.proposta) { out.proposta = p.proposta; out.notasRecusadas = p.paraModelo.notas_recusadas || [] }
  }
  return out
}

/* ── Leitura do pedido em texto livre (Claude Haiku): só preenche campos; a equipa confirma antes de calcular ── */

function esquemaLeitura(tab: Tabela) {
  return {
    type: "object", additionalProperties: false,
    required: ["servico", "divisoes", "respostas", "local", "pedido", "notas", "duvidas", "complexo", "motivo_complexo"],
    properties: {
      servico: { type: "string", enum: ["ac", "aguasQuentes", "outro"],
        description: "«ac» = montar ar condicionado; «aguasQuentes» = bomba de calor para águas quentes; «outro» = qualquer outro trabalho (reparação, manutenção, ventilação, eletricidade, condutas, VRV, comercial)." },
      divisoes: { ...esquemaDivisoes(), description: "As divisões a climatizar, só com ar condicionado. Área 0 quando o texto não a diz." },
      respostas: esquemaRespostas(tab),
      local: { type: "string", description: "Localidade ou zona da obra, se o texto a diz (sem morada completa); senão «»." },
      pedido: { type: "string", description: "Uma frase simples com o que o cliente pede, sem nomes, telefones nem moradas." },
      notas: { type: "array", items: { type: "string" }, description: "Até 3 notas factuais úteis para a obra que não cabem nos campos. Sem preços nem prazos." },
      duvidas: { type: "array", items: { type: "string" }, description: "O que falta ou é ambíguo e muda o preço, como pergunta curta a fazer ao cliente." },
      complexo: { type: "boolean", description: "true se o caso sai do normal: mais de 4 divisões, espaço comercial, condutas ou VRV, vários serviços juntos, pedido confuso ou contraditório." },
      motivo_complexo: { type: "string", description: "Porquê, numa frase, se complexo; senão «»." },
    },
  }
}

const SISTEMA_LEITURA = `Lês pedidos de clientes de uma empresa de ar condicionado em Lisboa (mensagens de WhatsApp, emails, notas de telefone, em português) e passas o que lá está para os campos de um formulário. Não respondes ao cliente nem dás preços.

Regras:
- Só preenches o que o texto diz. Nunca adivinhes: o que não está escrito fica vazio («» ou área 0) e, se mudar o preço, vai para «duvidas».
- Áreas: «uns 30», «30 metros», «30 m2» = 30. Sem número, área 0 e uma dúvida.
- Tipo de divisão: sala, quarto, cozinha e escritório pelo nome; o resto é «Outra divisão». «Suite» é quarto.
- «sol» só se o texto falar em muito sol, sol direto, virado a sul ou a poente.
- «ultimo_andar» só se for o último andar ou por baixo do telhado; um andar com número não chega.
- Respostas que mudam o preço: escolhe a opção que corresponde ao que o texto diz, pelo texto da opção; se o texto não diz, «».
- «pedido» e «notas» sem nomes, telefones, emails, NIF nem moradas.
- Escreve em português de Portugal, sem travessões.`

function redige(t: string): string {
  return t
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/(?:\+?351[\s.-]?)?\b[29]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g, "[telefone]")
    .replace(/\bNIF:?\s*\d{9}\b/gi, "[NIF]")
    .replace(/\b\d{4}-\d{3}\b/g, "[código postal]")
}

async function ler(texto: string, tab: Tabela, client: Anthropic) {
  const resposta: any = await client.messages.create({
    model: MODELO_LEITURA,
    max_tokens: 4000,
    output_config: { effort: "low", format: { type: "json_schema", schema: esquemaLeitura(tab) } },
    system: SISTEMA_LEITURA,
    messages: [{ role: "user", content: `Pedido do cliente:\n\n${redige(texto)}` }],
  } as any)
  if (resposta.stop_reason === "refusal") return { erro: "A IA não leu este pedido. Preencha o formulário à mão." }
  if (resposta.stop_reason === "max_tokens") return { erro: "O pedido é demasiado longo para ler de uma vez. Preencha o formulário à mão ou use o assistente completo." }
  const txt = (resposta.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
  let campos: any
  try { campos = JSON.parse(txt) } catch { return { erro: "A leitura veio incompleta. Preencha o formulário à mão." } }
  /* limpeza: nada de travessões nem de regras do dono quebradas nos textos livres */
  const notas = (campos.notas || []).map((n: unknown) => limpa(n, 240)).filter((n: string) => n && !proibido(n)).slice(0, 3)
  const pedido = limpa(campos.pedido, 400)
  const divisoes = (campos.divisoes || []).slice(0, 12)
  const semArea = divisoes.filter((d: any) => !(d.area > 0)).length
  const duvidas = (campos.duvidas || []).map((n: unknown) => limpa(n, 200)).filter(Boolean).slice(0, 6)
  if (semArea && !duvidas.some((d: string) => /área|m²|m2|metros/i.test(d))) duvidas.unshift(`Falta a área de ${semArea === 1 ? "uma divisão" : semArea + " divisões"}.`)
  const limpo = { ...campos, divisoes, notas, pedido: proibido(pedido) ? "" : pedido, local: limpa(campos.local, 160), duvidas,
    motivo_complexo: limpa(campos.motivo_complexo, 240) }
  const r: any = limpo.servico === "ac" || limpo.servico === "aguasQuentes" ? preco(tab.T, opcoesDe(limpo)) : null
  const complexo = complexidade(limpo, r, limpo.complexo && limpo.motivo_complexo ? [limpo.motivo_complexo] : limpo.complexo ? ["A IA marcou este pedido como fora do normal."] : [])
  return { campos: limpo, complexo }
}

/* ── Pedido HTTP ── */

function iguais(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest(), hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}
const json = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store" } })

export async function atende(req: Request, env: Env, cliente?: Anthropic): Promise<Response> {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405)
  const senha = env.get("MDM_EQUIPA_SENHA")
  const chave = env.get("ANTHROPIC_API_KEY")
  if (!senha) return json({ erro: "O assistente ainda não está configurado no Netlify (falta MDM_EQUIPA_SENHA)." }, 503)
  if (!iguais(req.headers.get("x-mdm-senha") || "", senha)) return json({ erro: "Senha errada." }, 401)

  const bruto = await req.text()
  if (bruto.length > MAX_BYTES) return json({ erro: "A conversa ficou demasiado longa. Comece uma nova." }, 413)
  let corpo: any
  try { corpo = JSON.parse(bruto) } catch { return json({ erro: "Pedido inválido." }, 400) }
  const tab = tabela(env)
  const semIA = () => json({ erro: "A IA ainda não está ligada (falta ANTHROPIC_API_KEY no Netlify). O formulário funciona na mesma." }, 503)

  /* formulário: sem IA, sem custo */
  if (corpo?.acao === "tabela") return json(infoTabela(tab))
  if (corpo?.acao === "calcular") {
    try { return json(calcular(corpo.dados, tab)) } catch (e) { console.error(e); return json({ erro: "Não foi possível calcular com estes dados." }, 400) }
  }
  /* leitura do texto livre (Haiku) */
  if (corpo?.acao === "ler") {
    const texto = String(corpo.texto || "").trim()
    if (!texto) return json({ erro: "Cole primeiro o pedido do cliente." }, 400)
    if (texto.length > 6000) return json({ erro: "O texto é demasiado longo: cole só o pedido do cliente." }, 413)
    if (!(chave || cliente)) return semIA()
    try { return json(await ler(texto, tab, cliente || new Anthropic({ apiKey: chave }))) }
    catch (e) { console.error("leitura falhou", e); return json({ erro: "A leitura falhou. Preencha o formulário à mão ou tente outra vez." }, 502) }
  }

  /* assistente completo (conversa) */
  if (!(chave || cliente)) return semIA()
  const mensagens = corpo?.mensagens
  if (!Array.isArray(mensagens) || !mensagens.length || mensagens.length > MAX_MENSAGENS || mensagens[0]?.role !== "user")
    return json({ erro: mensagens?.length > MAX_MENSAGENS ? "A conversa ficou demasiado longa. Comece uma nova." : "Pedido inválido." }, 400)

  const client = cliente || new Anthropic({ apiKey: chave })
  let resposta: any
  try {
    resposta = await (client.beta.messages.create as any)({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [{ type: "text", text: sistema(tab), cache_control: { type: "ephemeral" } }],
      tools: ferramentas(tab),
      messages: mensagens,
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erro: "Muitos pedidos ao mesmo tempo. Tente outra vez daqui a um minuto." }, 429)
    if (e instanceof Anthropic.AuthenticationError) return json({ erro: "A chave da API no Netlify não é válida." }, 502)
    if (e instanceof Anthropic.BadRequestError) { console.error("pedido recusado pela API", e.message); return json({ erro: "A API recusou a conversa. Comece uma nova." }, 502) }
    if (e instanceof Anthropic.APIError) { console.error("erro da API", e.status, e.message); return json({ erro: "O serviço de IA falhou. Tente outra vez." }, 502) }
    console.error(e)
    return json({ erro: "Não foi possível falar com o serviço de IA. Tente outra vez." }, 502)
  }

  if (resposta.stop_reason === "refusal")
    return json({ novas: [], continuar: false, propostas: [], erro: "O modelo não respondeu a este pedido. Reformule a mensagem." })

  const novas: any[] = [{ role: "assistant", content: resposta.content }]
  const propostas: any[] = []
  if (resposta.stop_reason === "tool_use") {
    const resultados = resposta.content.filter((b: any) => b.type === "tool_use").map((b: any) => {
      let conteudo: any, erro = false
      try {
        if (b.name === "calcular_potencia") {
          const r: any = potencia(tab.C, divisoesDe(b.input))
          if (r.erro) { conteudo = { erro: r.erro }; erro = true }
          else conteudo = { resumo: r.resumo, divisoes: r.divs, total_btuh: r.total, acima_do_maior_tamanho: r.acima, erros: r.erros.length ? r.erros : undefined }
        } else if (b.name === "calcular_preco") {
          conteudo = paraModelo(preco(tab.T, opcoesDe(b.input)), tab.teste)
          erro = conteudo.modo === "erro"
        } else if (b.name === "preparar_proposta") {
          const r: any = prepararProposta(b.input, tab)
          if (r.erro) { conteudo = r.erro; erro = true } else { propostas.push(r.proposta); conteudo = r.paraModelo }
        } else { conteudo = { erro: `Ferramenta desconhecida: ${b.name}` }; erro = true }
      } catch (e) {
        console.error(e)
        conteudo = { erro: "A ferramenta falhou com estes dados." }; erro = true
      }
      return { type: "tool_result", tool_use_id: b.id, content: JSON.stringify(conteudo), ...(erro ? { is_error: true } : {}) }
    })
    novas.push({ role: "user", content: resultados })
  }
  return json({
    novas, propostas, teste: tab.teste,
    continuar: resposta.stop_reason === "tool_use" || resposta.stop_reason === "pause_turn",
    cortada: resposta.stop_reason === "max_tokens" || undefined,
  })
}

export default async (req: Request, _context: Context) => atende(req, Netlify.env)

export const config: Config = {
  path: "/api/proposta",
  method: "POST",
  rateLimit: { windowLimit: 120, windowSize: 60, aggregateBy: ["ip", "domain"] },
}
