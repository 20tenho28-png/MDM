/**
 * Calculadora de ar condicionado da MDM Assist. Interface (DOM).
 * Toda a matemática está em calc_model.js (sem DOM, testado em Node).
 */
import {
  BUILDING_OPTIONS,
  EQUIPMENT_OPTIONS,
  LIMITS,
  METHOD_PT,
  ORIENTATIONS,
  ROOM_PRESETS,
  SHADING_OPTIONS,
  ZONES,
  defaultRoom,
  postalInfo,
  roomLoad,
  sizeProject,
  summaryText,
} from "./calc_model.js";
import { PRICES } from "./prices.js";

const CONTACT = {
  phone: "218 935 050",
  phoneHref: "tel:+351218935050",
  whatsapp: "910 307 579",
  whatsappNumber: "351910307579",
  email: "mdmassist@mdmassist.com",
  site: "https://www.mdmassist.com.pt/",
};

const STORAGE_KEY = "mdm_ac_calc_v1";
const STEPS = [
  { key: "intro", title: "Começar", sticky: false },
  { key: "select", title: "Selecionar", sticky: true },
  { key: "rooms", title: "Dimensionamento", sticky: true },
  { key: "postal", title: "Localização", sticky: true },
  { key: "result", title: "Resultado", sticky: true },
];

// ------------------------------------------------------------------ icons
const I = {
  check: '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  one: '<svg aria-hidden="true" focusable="false" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M26 52H13a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3h38a3 3 0 0 1 3 3v34a3 3 0 0 1-3 3H38"/><path d="M16 42h14M20 20h24"/></svg>',
  many: '<svg aria-hidden="true" focusable="false" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="10" width="44" height="44" rx="3"/><path d="M32 10v24M10 34h44M32 34v20M43 34v12"/></svg>',
  chev: '<svg aria-hidden="true" focusable="false" class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  plus: '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  warn: '<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 18H2L12 3zM12 10v5M12 18.5v.5"/></svg>',
  info: '<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  ok: '<svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/></svg>',
  phone: '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
  wa: '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 1.8a8.2 8.2 0 11-4.2 15.3l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0112 3.8zm-3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.2 5 4.4 2.5 1 3 .8 3.5.7.5 0 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4l-.6-.3-2-1c-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.3.2-.6.1a7 7 0 01-2-1.3 7.8 7.8 0 01-1.5-1.8c-.1-.3 0-.4.1-.6l.5-.5.3-.5v-.5l-1-2.2c-.2-.5-.4-.5-.6-.5H9z"/></svg>',
  mail: '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  print: '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v7H6z"/></svg>',
  pin: '<svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-7.1 7-12a7 7 0 10-14 0c0 4.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
};

// ------------------------------------------------------------------ state
const state = loadState() || {
  step: 0,
  mode: null, // 'single' | 'multi'
  rooms: [defaultRoom(0)],
  heating: false,
  building: "unknown",
  postal: "",
  openRoom: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !Array.isArray(s.rooms) || !s.rooms.length) return null;
    if (!s.rooms.every((r) => r && typeof r === "object")) return null;
    // Estados guardados por versões anteriores da calculadora.
    for (const r of s.rooms) {
      if (r.equipment == null) r.equipment = r.kitchen ? "kitchen" : "none";
      delete r.kitchen;
    }
    if (!BUILDING_OPTIONS.some((o) => o.key === s.building)) s.building = "unknown";
    // Nunca reabrir diretamente no resultado: o utilizador vê o resumo do que já tinha.
    s.step = Number.isInteger(s.step) ? Math.max(0, Math.min(3, s.step)) : 0;
    // Divisões que já não validam (regras novas) mandam de volta ao passo 2.
    if (s.step > 2 && !sizeProject(s.rooms, { building: s.building }).allValid) s.step = 2;
    return s;
  } catch {
    return null;
  }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* modo privado: continua sem persistência */
  }
}

const ctx = () => {
  const info = state.postal ? postalInfo(state.postal) : null;
  return {
    heating: state.heating,
    building: state.building,
    zone: info && info.valid ? info.zone : "V2",
    winter: info && info.valid ? info.winter : "I1",
    prices: PRICES,
  };
};

// -------------------------------------------------------------- helpers
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Inteiros com separador de milhares em espaço inseparável (pt-PT não agrupa 4 dígitos: "9000").
const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
const fmtKW = (w) => (w / 1000).toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtKW1 = (kw) => Number(kw).toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtFactor = (f) => Number(f).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtEUR = (n) => fmtInt(n) + "\u00a0€";
const fmtDec = (n, d = 1) => Number(n).toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: d });
const parseNum = (v) => {
  const t = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const notice = (kind, html) => `<div class="notice ${kind}">${kind === "ok" ? I.ok : kind === "info" ? I.info : I.warn}<span>${html}</span></div>`;

// Valor numérico guardado -> texto do campo (vírgula decimal; NaN ou vazio -> "").
const numVal = (v) => (Number.isFinite(v) ? String(v).replace(".", ",") : "");
// Erro só depois de o campo ter algum valor: um campo por preencher não é um erro.
const fieldErr = (room, load, f) => (room[f] == null ? "" : load.errors[f] || "");
const postalErr = (v) => (String(v).replace(/\D/g, "").length >= 7 && !postalInfo(v).valid ? "Indique um código postal português com 7 dígitos (ex. 1990-426)." : "");
const formatPostal = (v) => { const d = String(v).replace(/\D/g, "").slice(0, 7); return d.length > 4 ? `${d.slice(0, 4)}-${d.slice(4)}` : d; };

function roomLabel(room, index) {
  return room.name && room.name.trim() ? room.name.trim() : `Divisão ${index + 1}`;
}
function unitLabel(load) {
  if (!load.ok) return "por preencher";
  return load.units > 1 ? `${load.units} × ${fmtInt(load.unit.btu)} BTU` : `${fmtInt(load.unit.btu)} BTU`;
}

// ------------------------------------------------------------- stepbar
function renderStepbar() {
  const visible = STEPS.length - 1; // o passo "Começar" não conta
  const n = Math.max(1, state.step);
  $("#step-title").textContent = STEPS[state.step].title;
  $("#step-count").textContent = state.step === 0 ? "Antes de começar" : `Passo ${n} de ${visible}`;
  $("#progress").innerHTML = Array.from({ length: visible }, (_, i) => {
    const idx = i + 1;
    const cls = idx < state.step ? "done" : idx === state.step ? "now" : "";
    return `<i class="${cls}"></i>`;
  }).join("");
  $("#back-btn").disabled = state.step === 0;
}

// ------------------------------------------------------------- step 0
function renderIntro() {
  return `
    <h2 class="lead" tabindex="-1">Vamos dimensionar o seu <em>ar condicionado</em></h2>
    <p class="sub">Em quatro passos curtos calculamos a potência de que cada divisão precisa e preparamos o pedido de orçamento. Demora menos de cinco minutos.</p>
    <div class="card">
      <h2>O que vai precisar</h2>
      <p>Pode configurar até ${LIMITS.rooms.max} divisões. Para cada uma, tenha à mão:</p>
      <ul class="checklist" role="list">
        <li>${I.check}<span>Área da divisão em m² (comprimento × largura)</span></li>
        <li>${I.check}<span>Altura do teto em cm (o normal são 260 cm)</span></li>
        <li>${I.check}<span>Área total das janelas em m²</span></li>
        <li>${I.check}<span>Tipo de sombreamento (cortinas, estores, nenhum)</span></li>
        <li>${I.check}<span>Orientação das janelas (norte, sul, nascente, poente)</span></li>
        <li>${I.check}<span>Quantas pessoas costumam estar na divisão</span></li>
      </ul>
      <button class="btn primary block" type="button" data-action="start">Vamos começar</button>
    </div>
    <p class="fine">Esta calculadora dá uma estimativa de dimensionamento. O orçamento final é sempre confirmado por um técnico certificado da MDM Assist, com visita gratuita.</p>
  `;
}

// ------------------------------------------------------------- step 1
function renderSelect() {
  const multi = state.mode === "multi";
  const single = state.mode === "single";
  return `
    <h2 class="lead" tabindex="-1">Para quantas divisões precisa de ar condicionado?</h2>
    <p class="sub">Escolha uma opção. Pode acrescentar ou retirar divisões no passo seguinte.</p>
    <div class="choice-grid">
      <button class="choice ${single ? "on" : ""}" type="button" data-action="mode" data-mode="single">
        ${I.one}<b>1 divisão</b><small>Um aparelho mono-split</small>
      </button>
      <button class="choice ${multi ? "on" : ""}" type="button" data-action="mode" data-mode="multi">
        ${I.many}<b>Múltiplas divisões</b><small>Até ${LIMITS.rooms.max} divisões, mono ou multi-split</small>
      </button>
    </div>
    ${multi ? `
    <div class="card" style="margin-top:14px">
      <h2>Múltiplas divisões</h2>
      <p>Uma solução multi-split pode aquecer ou arrefecer até ${LIMITS.rooms.max} divisões com uma só unidade exterior.</p>
      <div class="field" style="margin-top:14px">
        <div class="label" id="l-rooms"><b>Divisões</b></div>
        <div class="stepper" role="group" aria-labelledby="l-rooms">
          <button type="button" data-action="rooms-dec" ${state.rooms.length <= 2 ? "disabled" : ""} aria-label="Menos uma divisão">−</button>
          <output aria-live="polite">${state.rooms.length}</output>
          <button type="button" data-action="rooms-inc" ${state.rooms.length >= LIMITS.rooms.max ? "disabled" : ""} aria-label="Mais uma divisão">+</button>
        </div>
      </div>
    </div>` : ""}
    ${state.mode ? `
    <div class="card">
      <h2>Sobre a casa</h2>
      <div class="field" style="margin-top:12px">
        <label class="label" for="f-building"><b>Idade do edifício</b><span class="hint">afeta o isolamento</span></label>
        <div class="control">
          <select id="f-building" data-field="building">
            ${BUILDING_OPTIONS.map((o) => `<option value="${o.key}" ${state.building === o.key ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
          </select>
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" data-field="heating" ${state.heating ? "checked" : ""} />
        <span class="sw"></span>
        <span class="txt"><b>Também quero aquecer no inverno</b><small>Verificamos se a potência de aquecimento chega</small></span>
      </label>
    </div>` : ""}
  `;
}

// ------------------------------------------------------------- step 2
function renderRooms() {
  const openId = state.rooms.some((r) => r.id === state.openRoom) ? state.openRoom : state.rooms[0].id;
  return `
    <h2 class="lead" tabindex="-1">Descreva cada <em>divisão</em></h2>
    <p class="sub">A potência recomendada atualiza à medida que preenche. Valores aproximados chegam: o técnico confirma na visita.</p>
    ${state.rooms.map((r, i) => renderRoom(r, i, r.id === openId)).join("")}
    <button class="add-room" type="button" data-action="add-room" ${state.rooms.length >= LIMITS.rooms.max ? "disabled" : ""}>
      <b>${I.plus} Adicionar uma divisão</b>
      <small>Pode definir até um máximo de ${LIMITS.rooms.max} divisões</small>
    </button>
  `;
}

function renderRoom(room, index, open) {
  const load = roomLoad(room, ctx());
  return `
    <section class="room ${open ? "open" : ""}" data-room="${room.id}">
      <h3 class="room-head-h">
        <button class="room-head" type="button" data-action="toggle-room" data-id="${room.id}" aria-expanded="${open}" aria-controls="b-${room.id}">
          ${I.chev}
          <span class="room-title" data-role="title">${esc(roomLabel(room, index))}</span>
          <span class="pill ${load.ok ? "" : "muted"}" data-role="pill">${unitLabel(load)}</span>
        </button>
      </h3>
      <div class="room-body" id="b-${room.id}">
        <div class="field">
          <label class="label" for="f-${room.id}-name"><b>Nome da divisão</b></label>
          <div class="control"><input id="f-${room.id}-name" type="text" data-field="name" data-id="${room.id}" value="${esc(room.name)}" placeholder="Divisão ${index + 1}" maxlength="40" /></div>
          <div class="chips" data-role="presets">
            ${ROOM_PRESETS.map((p) => `<button class="chip ${room.name === p.name ? "on" : ""}" type="button" data-action="preset" data-id="${room.id}" data-name="${esc(p.name)}" data-equipment="${esc(p.equipment)}" data-people="${p.people}">${esc(p.name)}</button>`).join("")}
          </div>
        </div>
        <div class="row2">
          <div class="field">
            <label class="label" for="f-${room.id}-area"><b>Área <span class="req" aria-hidden="true">*</span></b></label>
            <div class="control"><input id="f-${room.id}-area" class="has-unit" type="text" inputmode="decimal" required data-field="area" data-id="${room.id}" value="${numVal(room.area)}" placeholder="ex. 18" aria-invalid="${fieldErr(room, load, "area") ? "true" : "false"}" aria-describedby="u-${room.id}-area e-${room.id}-area" /><span class="unit" id="u-${room.id}-area">m²</span></div>
            <div class="error" id="e-${room.id}-area" data-err="area">${esc(fieldErr(room, load, "area"))}</div>
          </div>
          <div class="field">
            <label class="label" for="f-${room.id}-height"><b>Altura <span class="req" aria-hidden="true">*</span></b></label>
            <div class="control"><input id="f-${room.id}-height" class="has-unit" type="text" inputmode="numeric" required data-field="height" data-id="${room.id}" value="${numVal(room.height)}" placeholder="260" aria-invalid="${fieldErr(room, load, "height") ? "true" : "false"}" aria-describedby="u-${room.id}-height e-${room.id}-height" /><span class="unit" id="u-${room.id}-height">cm</span></div>
            <div class="error" id="e-${room.id}-height" data-err="height">${esc(fieldErr(room, load, "height"))}</div>
          </div>
        </div>
        <div class="row2">
          <div class="field">
            <label class="label" for="f-${room.id}-windows"><b>Janelas <span class="req" aria-hidden="true">*</span></b></label>
            <div class="control"><input id="f-${room.id}-windows" class="has-unit" type="text" inputmode="decimal" required data-field="windows" data-id="${room.id}" value="${numVal(room.windows)}" placeholder="ex. 2" aria-invalid="${fieldErr(room, load, "windows") ? "true" : "false"}" aria-describedby="u-${room.id}-windows e-${room.id}-windows" /><span class="unit" id="u-${room.id}-windows">m²</span></div>
            <div class="error" id="e-${room.id}-windows" data-err="windows">${esc(fieldErr(room, load, "windows"))}</div>
          </div>
          <div class="field">
            <label class="label" for="f-${room.id}-people"><b>Pessoas</b></label>
            <div class="control"><input id="f-${room.id}-people" class="has-unit" type="text" inputmode="numeric" data-field="people" data-id="${room.id}" value="${numVal(room.people)}" placeholder="2" aria-invalid="${fieldErr(room, load, "people") ? "true" : "false"}" aria-describedby="u-${room.id}-people e-${room.id}-people" /><span class="unit" id="u-${room.id}-people">pessoas</span></div>
            <div class="error" id="e-${room.id}-people" data-err="people">${esc(fieldErr(room, load, "people"))}</div>
          </div>
        </div>
        <div class="field">
          <label class="label" for="f-${room.id}-shading"><b>Sombreamento</b><span class="hint">das janelas</span></label>
          <div class="control">
            <select id="f-${room.id}-shading" data-field="shading" data-id="${room.id}">
              ${SHADING_OPTIONS.map((o) => `<option value="${o.key}" ${room.shading === o.key ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="field">
          <label class="label" for="f-${room.id}-orientation"><b>Orientação</b><span class="hint">para onde dão as janelas</span></label>
          <div class="control">
            <select id="f-${room.id}-orientation" data-field="orientation" data-id="${room.id}">
              ${ORIENTATIONS.map((o) => `<option value="${o.key}" ${room.orientation === o.key ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
            </select>
          </div>
        </div>
        <label class="toggle">
          <input type="checkbox" data-field="topFloor" data-id="${room.id}" ${room.topFloor ? "checked" : ""} />
          <span class="sw"></span>
          <span class="txt"><b>Último andar ou sob o telhado</b><small>O telhado aquece a divisão no verão</small></span>
        </label>
        <div class="field" style="margin-top:12px">
          <label class="label" for="f-${room.id}-equipment"><b>Equipamentos que aquecem</b></label>
          <div class="control">
            <select id="f-${room.id}-equipment" data-field="equipment" data-id="${room.id}">
              ${EQUIPMENT_OPTIONS.map((o) => `<option value="${o.key}" ${room.equipment === o.key ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
            </select>
          </div>
        </div>
        <div data-role="result">${renderRoomResult(load)}</div>
        ${state.rooms.length > 1 ? `<button class="remove-room" type="button" data-action="remove-room" data-id="${room.id}">Remover esta divisão</button>` : ""}
      </div>
    </section>
  `;
}

function renderRoomResult(load) {
  if (!load.ok) {
    return `<div class="room-result"><div class="k">Potência recomendada</div><div class="big" style="color:var(--slate-lt)">…</div><div class="detail">Preencha a área, a altura e as janelas para ver a recomendação.</div></div>`;
  }
  const u = load.unit;
  const pct = Math.min(100, Math.round(load.ratio * 100));
  // Linhas arredondadas uma a uma; a última fecha a soma com o total.
  const rows = { envelope: Math.round(load.parts.envelope), solar: Math.round(load.parts.solar), internal: Math.round(load.parts.internal), roof: Math.round(load.parts.roof) };
  rows.rest = Math.round(load.loadW) - rows.envelope - rows.solar - rows.internal - rows.roof;
  const warnHtml = load.warnings.map((w) => notice(w.level, esc(w.text))).join("");
  const heat = load.heating
    ? load.heating.ok
      ? notice("ok", `Aquecimento: num dia frio ${load.units > 1 ? `as ${load.units} unidades de ${fmtInt(u.btu)} BTU ainda dão` : `a unidade de ${fmtInt(u.btu)} BTU ainda dá`} cerca de ${fmtKW1(load.heating.unitHeatKW)} kW de calor, acima dos ${fmtKW(load.heating.loadW)} kW de que esta divisão precisa.`)
      : notice("warn", `Aquecimento: num dia frio esta divisão precisa de cerca de ${fmtKW(load.heating.loadW)} kW de calor e ${load.units > 1 ? "as unidades só dão" : "a unidade só dá"} ${fmtKW1(load.heating.unitHeatKW)} kW. ${load.heating.suggest ? `Sugerimos ${load.units > 1 ? `${load.units} × ` : ""}${fmtInt(load.heating.suggest.btu)} BTU (${fmtKW1(load.heating.suggestHeatKW)} kW num dia frio).` : "Fale connosco para uma solução à medida."}`)
    : "";
  return `
    <div class="room-result">
      <div class="k">Potência recomendada</div>
      <div class="big">${load.units > 1 ? `${load.units} × ${fmtInt(u.btu)} BTU/h<small>${fmtKW1(u.coolKW * load.units)} kW frio no total</small>` : `${fmtInt(u.btu)} BTU/h<small>${fmtKW1(u.coolKW)} kW frio</small>`}</div>
      <div class="detail">Carga térmica estimada: <b>${fmtInt(load.loadBTU)} BTU/h</b> (${fmtKW(load.loadW)} kW) · ${pct}% da capacidade ${load.units > 1 ? "de cada unidade" : "da unidade"}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      ${warnHtml}${heat}
      <details class="why">
        <summary>Como chegámos a este valor</summary>
        <div class="breakdown">
          <span>Paredes, ar exterior e inércia (${fmtDec(load.volume)} m³)</span><b>${fmtInt(rows.envelope)} W</b>
          <span>Sol pelas janelas (${fmtDec(load.room.windows)} m², ${esc(load.labels.orientation)}, ${esc(load.labels.shading).toLowerCase()})</span><b>${fmtInt(rows.solar)} W</b>
          <span>Pessoas (${load.room.people == null ? 2 : load.room.people}) e equipamentos</span><b>${fmtInt(rows.internal)} W</b>
          ${load.parts.roof ? `<span>Telhado (último andar)</span><b>${fmtInt(rows.roof)} W</b>` : ""}
          <span>Clima (zona ${esc(load.zone)} ×${fmtFactor(load.factors.climate)} sobre o que vem de fora), margem ×${fmtFactor(load.factors.margin)} e arredondamento</span><b>${fmtInt(rows.rest)} W</b>
          <span class="tot">Carga total</span><b class="tot">${fmtInt(load.loadW)} W</b>
        </div>
      </details>
    </div>
  `;
}

// ------------------------------------------------------------- step 3
function renderPostal() {
  const info = postalInfo(state.postal);
  return `
    <h2 class="lead" tabindex="-1">Introduza o seu <em>código postal</em></h2>
    <p class="sub">O código postal ajuda-nos a ajustar o cálculo ao clima da sua zona e a confirmar se estamos na sua área de intervenção.</p>
    <div class="card">
      <div class="field" style="margin-bottom:0">
        <label class="label" for="f-postal"><b>Código postal <span class="req" aria-hidden="true">*</span></b><span class="hint">só os 7 dígitos, ex. 1990426</span></label>
        <div class="control"><input id="f-postal" type="text" inputmode="numeric" autocomplete="postal-code" required data-field="postal" value="${esc(formatPostal(state.postal))}" placeholder="1990-426" maxlength="8" aria-invalid="${postalErr(state.postal) ? "true" : "false"}" aria-describedby="e-postal" /></div>
        <div class="error" id="e-postal" data-err="postal">${postalErr(state.postal)}</div>
      </div>
      <div data-role="zone">${renderZone(info)}</div>
    </div>
  `;
}

function renderZone(info) {
  if (!info.valid) return "";
  const z = ZONES[info.zone];
  return `
    <div class="zone-box">
      <div class="z">${esc(info.zone)}</div>
      <div><b>${esc(z.label)}</b><small>${esc(info.district)}. ${esc(z.hint)}</small></div>
    </div>
    ${info.inAML
      ? notice("ok", `<b>Estamos na sua zona.</b> A MDM Assist intervém em toda a Área Metropolitana de Lisboa, normalmente em 24 a 48 horas. Respondemos em menos de 24 horas úteis.`)
      : notice("info", `Fora da Área Metropolitana de Lisboa. Pode usar o cálculo na mesma; para instalação fora de Lisboa fale connosco para confirmar disponibilidade.`)}
  `;
}

// ------------------------------------------------------------- step 4
function renderResult() {
  const c = ctx();
  const p = sizeProject(state.rooms, c);
  const info = postalInfo(state.postal);
  const best = p.options.find((o) => o.recommended) || p.options[0];
  return `
    <div class="result-hero">
      <div class="k">Potência total recomendada</div>
      <div class="big">${fmtInt(p.totalUnitBTU)} BTU/h<small>${fmtKW1(p.totalUnitKW)} kW de frio</small></div>
      <p>${p.rooms.length === 1 ? "Uma divisão" : `${p.rooms.length} divisões`} · carga térmica estimada de ${fmtInt(p.totalLoadBTU)} BTU/h (${fmtKW(p.totalLoadW)} kW)${info.valid ? ` · zona climática ${esc(info.zone)}` : ""}${c.heating ? " · com aquecimento no inverno" : ""}</p>
    </div>

    <div class="card">
      <h2>Divisão a divisão</h2>
      <table class="rooms">
        <thead><tr><th>Divisão</th><th style="text-align:right">Unidade</th></tr></thead>
        <tbody>
          ${p.rooms.map((l, i) => `<tr>
            <td>${esc(roomLabel(state.rooms[i], i))}<small>${fmtDec(l.room.area)} m² · ${esc(l.labels.orientation)} · ${fmtInt(l.loadBTU)} BTU/h de carga</small></td>
            <td class="num"><span class="nw">${unitLabel(l)}</span><small><span class="nw">${fmtKW1(l.unit.coolKW * l.units)} kW frio</span><br /><span class="nw">${fmtKW1(l.unit.heatKW * l.units)} kW calor</span></small></td>
          </tr>`).join("")}
        </tbody>
      </table>
      ${p.warnings.map((w) => notice(w.level, esc(w.text))).join("")}
    </div>

    <div class="card">
      <h2>${p.options.length > 1 ? "Duas formas de o fazer" : "A nossa recomendação"}</h2>
      <p>${p.options.length > 1 ? "Ambas funcionam. Qual é a melhor depende de onde ficam as divisões e do espaço para unidades exteriores. O técnico confirma na visita." : p.totalUnits === 1 ? "Um aparelho mono-split: uma unidade interior na divisão e uma unidade exterior na fachada ou varanda." : `Esta instalação precisa de ${p.totalUnits} unidades murais. Na visita o técnico confirma se compensa antes uma solução de cassete ou conduta, ou um multi-split.`}</p>
      ${p.options.map((o) => `
        <div class="option ${o === best && p.options.length > 1 ? "best" : ""}">
          ${o === best && p.options.length > 1 ? `<span class="tag">Sugestão</span>` : ""}
          <h3>${esc(o.title)}</h3>
          <ul>${o.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
          ${o.price != null ? `<div class="price">desde ${fmtEUR(o.price)} <small>equipamento e instalação standard, IVA incluído</small></div>` : ""}
        </div>`).join("")}
      ${PRICES && PRICES.note ? `<p class="fine">${esc(PRICES.note)}</p>` : `<p class="fine">Preços só após visita técnica gratuita: dependem da marca, da distância entre unidades e do trabalho de instalação. Peça o orçamento com um clique abaixo.</p>`}
    </div>

    <div class="card no-print">
      <h2>Peça o seu orçamento gratuito</h2>
      <p>Enviamos-lhe o resumo deste cálculo. Respondemos em menos de 24 horas úteis e a visita técnica é gratuita.</p>
      <div class="cta-grid">
        <a class="btn whatsapp" href="${waHref(p)}" target="_blank" rel="noopener">${I.wa} WhatsApp ${CONTACT.whatsapp}</a>
        <a class="btn primary" href="${CONTACT.phoneHref}">${I.phone} Ligar ${CONTACT.phone}</a>
        <a class="btn" href="${mailHref(p)}">${I.mail} Enviar por email</a>
        <button class="btn" type="button" data-action="print">${I.print} Imprimir ou guardar PDF</button>
      </div>
    </div>

    <div class="card">
      <h2>Como calculámos</h2>
      <p>${esc(METHOD_PT)}</p>
      <p class="fine">Valores indicativos para dimensionamento. Não substituem a visita técnica: o estado do isolamento, as pontes térmicas e o percurso das tubagens mudam a solução final. 1 kW = 3 412 BTU/h.</p>
    </div>

    <div class="no-print" style="display:flex;justify-content:center;margin-top:8px">
      <button class="btn ghost" type="button" data-action="restart">Recomeçar do zero</button>
    </div>
  `;
}

function waHref(project) {
  const text = summaryText(project, state.rooms, { ...ctx(), postal: state.postal });
  return `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(text)}`;
}
function mailHref(project) {
  const text = summaryText(project, state.rooms, { ...ctx(), postal: state.postal });
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent("Pedido de orçamento: ar condicionado")}&body=${encodeURIComponent(text)}`;
}

// ------------------------------------------------------------- sticky
let lastStickyHtml = "";
function refreshSticky() {
  const st = STEPS[state.step];
  const el = $("#sticky");
  el.classList.toggle("hidden", !st.sticky);
  const total = $("#sticky .total");
  const note = $("#sticky-note");
  const btn = $("#next-btn");
  const label = $("#next-label");
  note.className = "note";
  note.textContent = "";
  label.textContent = "Continuar";
  total.classList.add("hidden");

  if (st.key === "select") {
    btn.disabled = !state.mode;
    note.textContent = state.mode ? "" : "Escolha uma opção para continuar";
  } else if (st.key === "rooms") {
    const p = sizeProject(state.rooms, ctx());
    total.classList.remove("hidden");
    $("#sticky-k").textContent = "Potência total";
    const html = p.allValid
      ? `${fmtInt(p.totalUnitBTU)} BTU/h <small>${fmtKW1(p.totalUnitKW)} kW de frio</small>`
      : `<span style="color:var(--slate-lt)">…</span>`;
    if (html !== lastStickyHtml) { lastStickyHtml = html; $("#sticky-v").innerHTML = html; }
    btn.disabled = !p.allValid;
    if (!p.allValid) {
      note.textContent = "Complete todas as divisões antes de continuar";
      note.classList.add("bad");
    }
  } else if (st.key === "postal") {
    const info = postalInfo(state.postal);
    btn.disabled = !info.valid;
    label.textContent = "Ver resultado";
    note.textContent = info.valid ? "" : "Indique o código postal para continuar";
  } else if (st.key === "result") {
    btn.disabled = false;
    label.textContent = "Pedir orçamento gratuito";
  }
}

// ------------------------------------------------------------- render
function render(opts = {}) {
  const key = STEPS[state.step].key;
  const app = $("#app");
  app.innerHTML = key === "intro" ? renderIntro() : key === "select" ? renderSelect() : key === "rooms" ? renderRooms() : key === "postal" ? renderPostal() : renderResult();
  renderStepbar();
  refreshSticky();
  saveState();
  syncStickyHeight();
  if (opts.newStep) {
    window.scrollTo({ top: 0 });
    // Leitores de ecrã e teclado: o foco vai para o título do passo.
    const lead = $(".lead", app);
    if (lead) lead.focus({ preventScroll: true });
  }
}

function go(step, { fromHistory = false } = {}) {
  state.step = Math.max(0, Math.min(STEPS.length - 1, step));
  if (!fromHistory && typeof history !== "undefined" && history.pushState) {
    try { history.pushState({ step: state.step }, ""); } catch { /* ignore */ }
  }
  render({ newStep: true });
}

// O gesto "voltar" do telemóvel volta ao passo anterior em vez de sair da página.
window.addEventListener("popstate", (ev) => {
  const step = ev.state && Number.isInteger(ev.state.step) ? ev.state.step : 0;
  go(Math.min(step, state.step === 4 ? 3 : step), { fromHistory: true });
});

function next() {
  const key = STEPS[state.step].key;
  if (key === "select") {
    if (!state.mode) return;
    if (state.mode === "single") state.rooms = state.rooms.slice(0, 1);
    state.openRoom = state.rooms[0].id;
    go(2);
  } else if (key === "rooms") {
    if (!sizeProject(state.rooms, ctx()).allValid) return;
    go(3);
  } else if (key === "postal") {
    if (!postalInfo(state.postal).valid || !sizeProject(state.rooms, ctx()).allValid) return;
    go(4);
  } else if (key === "result") {
    openContact();
  }
}

// -------------------------------------------------------- room updates
function roomById(id) {
  return state.rooms.find((r) => String(r.id) === String(id));
}
function refreshRoom(id) {
  const room = roomById(id);
  const index = state.rooms.indexOf(room);
  const sec = $(`.room[data-room="${id}"]`);
  if (!sec) return;
  const load = roomLoad(room, ctx());
  $('[data-role="result"]', sec).innerHTML = renderRoomResult(load);
  $('[data-role="title"]', sec).textContent = roomLabel(room, index);
  const pill = $('[data-role="pill"]', sec);
  pill.textContent = unitLabel(load);
  pill.classList.toggle("muted", !load.ok);
  for (const f of ["area", "height", "windows", "people"]) {
    const inp = $(`input[data-field="${f}"]`, sec);
    const err = $(`[data-err="${f}"]`, sec);
    const msg = fieldErr(room, load, f);
    if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false");
    if (err) err.textContent = msg;
  }
  for (const chip of sec.querySelectorAll('[data-action="preset"]')) {
    chip.classList.toggle("on", chip.dataset.name === room.name);
  }
  refreshSticky();
  saveState();
}

function setRoomCount(n) {
  n = Math.max(LIMITS.rooms.min, Math.min(LIMITS.rooms.max, n));
  while (state.rooms.length < n) state.rooms.push(defaultRoom(state.rooms.length));
  while (state.rooms.length > n) state.rooms.pop();
}

// ------------------------------------------------------------ contact
let contactOpener = null;
function openContact() {
  contactOpener = document.activeElement;
  const p = sizeProject(state.rooms, ctx());
  const done = state.step === 4 || p.allValid;
  $("#contact-ctas").innerHTML = `
    <a class="btn whatsapp" href="${done ? waHref(p) : `https://wa.me/${CONTACT.whatsappNumber}`}" target="_blank" rel="noopener">${I.wa} WhatsApp ${CONTACT.whatsapp}</a>
    <a class="btn primary" href="${CONTACT.phoneHref}">${I.phone} Ligar ${CONTACT.phone}</a>
    <a class="btn" href="${done ? mailHref(p) : `mailto:${CONTACT.email}`}">${I.mail} ${CONTACT.email}</a>
  `;
  $("#contact-overlay").classList.remove("hidden");
  $("#contact-close").focus();
}
function closeContact() {
  const overlay = $("#contact-overlay");
  if (overlay.classList.contains("hidden")) return;
  overlay.classList.add("hidden");
  if (contactOpener && typeof contactOpener.focus === "function") contactOpener.focus();
  contactOpener = null;
}
// Foco preso dentro da folha de contacto enquanto está aberta.
document.addEventListener("keydown", (ev) => {
  const overlay = $("#contact-overlay");
  if (ev.key !== "Tab" || overlay.classList.contains("hidden")) return;
  const focusables = overlay.querySelectorAll("a[href], button:not([disabled])");
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
});

// ------------------------------------------------------------- events
document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-action]");
  if (!t) return;
  const a = t.dataset.action;
  if (a === "start") go(1);
  else if (a === "mode") {
    state.mode = t.dataset.mode;
    if (state.mode === "multi" && state.rooms.length < 2) setRoomCount(2);
    render();
    $(`[data-action="mode"][data-mode="${state.mode}"]`)?.focus({ preventScroll: true });
  } else if (a === "rooms-inc" || a === "rooms-dec") {
    // Atualiza no sítio: sem re-render, o botão mantém a posição e o foco.
    setRoomCount(state.rooms.length + (a === "rooms-inc" ? 1 : -1));
    $(".stepper output").textContent = state.rooms.length;
    $('[data-action="rooms-dec"]').disabled = state.rooms.length <= 2;
    $('[data-action="rooms-inc"]').disabled = state.rooms.length >= LIMITS.rooms.max;
    saveState();
  }
  else if (a === "toggle-room") {
    state.openRoom = state.openRoom === t.dataset.id ? null : t.dataset.id;
    for (const sec of document.querySelectorAll(".room")) {
      const open = sec.dataset.room === state.openRoom;
      sec.classList.toggle("open", open);
      $(".room-head", sec).setAttribute("aria-expanded", String(open));
    }
    saveState();
  } else if (a === "add-room") {
    if (state.rooms.length >= LIMITS.rooms.max) return;
    const r = defaultRoom(state.rooms.length);
    state.rooms.push(r);
    state.mode = "multi";
    state.openRoom = r.id;
    render();
    const sec = $(`.room[data-room="${r.id}"]`);
    if (sec) { sec.scrollIntoView({ behavior: "smooth", block: "start" }); $('input[data-field="name"]', sec)?.focus(); }
  } else if (a === "remove-room") {
    if (state.rooms.length <= 1) return;
    const idx = state.rooms.findIndex((r) => String(r.id) === t.dataset.id);
    state.rooms = state.rooms.filter((r) => String(r.id) !== t.dataset.id);
    if (state.rooms.length === 1) state.mode = "single";
    const neighbour = state.rooms[Math.max(0, idx - 1)];
    state.openRoom = neighbour.id;
    const y = window.scrollY;
    render();
    window.scrollTo({ top: y });
    const sec = $(`.room[data-room="${neighbour.id}"]`);
    if (sec) { sec.scrollIntoView({ block: "start" }); $(".room-head", sec)?.focus({ preventScroll: true }); }
  } else if (a === "preset") {
    const room = roomById(t.dataset.id);
    room.name = t.dataset.name;
    room.equipment = t.dataset.equipment || "none";
    if (t.dataset.people) room.people = Number(t.dataset.people);
    const sec = $(`.room[data-room="${room.id}"]`);
    $('input[data-field="name"]', sec).value = room.name;
    $('select[data-field="equipment"]', sec).value = room.equipment;
    $('input[data-field="people"]', sec).value = room.people;
    refreshRoom(room.id);
  } else if (a === "print") window.print();
  else if (a === "restart") {
    if (!confirm("Apagar tudo e recomeçar?")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    location.reload();
  }
});

document.addEventListener("input", (ev) => {
  const el = ev.target;
  const f = el.dataset.field;
  if (!f) return;
  if (f === "postal") {
    const formatted = formatPostal(el.value);
    if (el.value !== formatted) {
      const atEnd = el.selectionStart === el.value.length;
      el.value = formatted;
      if (!atEnd) el.setSelectionRange(formatted.length, formatted.length);
    }
    state.postal = formatted;
    const info = postalInfo(state.postal);
    el.setAttribute("aria-invalid", postalErr(state.postal) ? "true" : "false");
    $('[data-err="postal"]').textContent = postalErr(state.postal);
    $('[data-role="zone"]').innerHTML = renderZone(info);
    refreshSticky();
    saveState();
    return;
  }
  if (!el.dataset.id) return;
  const room = roomById(el.dataset.id);
  if (!room) return;
  if (f === "name") room.name = el.value;
  else if (["area", "height", "windows", "people"].includes(f)) {
    const n = parseNum(el.value);
    room[f] = n === null ? null : Number.isNaN(n) ? NaN : n;
  }
  refreshRoom(room.id);
});

document.addEventListener("change", (ev) => {
  const el = ev.target;
  const f = el.dataset.field;
  if (!f) return;
  if (f === "building") { state.building = el.value; saveState(); return; }
  if (f === "heating") { state.heating = el.checked; saveState(); return; }
  if (!el.dataset.id) return;
  const room = roomById(el.dataset.id);
  if (!room) return;
  if (f === "shading" || f === "orientation" || f === "equipment") room[f] = el.value;
  else if (f === "topFloor") room[f] = el.checked;
  else if (f === "postal") return;
  else return;
  refreshRoom(room.id);
});

// A barra de passos cola-se por baixo do cabeçalho, seja qual for a altura dele,
// e o conteúdo nunca fica escondido atrás da barra fixa de baixo.
const headerEl = $(".site-header");
const stickyEl = $("#sticky");
const syncHeaderHeight = () => document.documentElement.style.setProperty("--header-h", `${headerEl.offsetHeight}px`);
function syncStickyHeight() {
  document.documentElement.style.setProperty("--sticky-h", `${stickyEl.classList.contains("hidden") ? 0 : stickyEl.offsetHeight}px`);
}
syncHeaderHeight();
if (typeof ResizeObserver !== "undefined") { new ResizeObserver(syncHeaderHeight).observe(headerEl); new ResizeObserver(syncStickyHeight).observe(stickyEl); }
window.addEventListener("resize", () => { syncHeaderHeight(); syncStickyHeight(); });

$("#back-btn").addEventListener("click", () => go(state.step - 1));
$("#next-btn").addEventListener("click", next);
$("#contact-btn").addEventListener("click", openContact);
$("#contact-close").addEventListener("click", closeContact);
$("#contact-overlay").addEventListener("click", (ev) => { if (ev.target.id === "contact-overlay") closeContact(); });
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeContact(); });

try {
  if (typeof history !== "undefined" && history.replaceState) history.replaceState({ step: state.step }, "");
  render({ newStep: true });
} catch (err) {
  // Estado guardado irrecuperável: começa de novo em vez de ficar em branco.
  console.error(err);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  Object.assign(state, { step: 0, mode: null, rooms: [defaultRoom(0)], heating: false, building: "unknown", postal: "", openRoom: null });
  render({ newStep: true });
}
