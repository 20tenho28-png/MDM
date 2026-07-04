/**
 * Testes do modelo do Quadro Elétrico. Correr com:
 *   node electric-simulator/test/panel.test.mjs
 */
import assert from "node:assert/strict";
import {
  V_SUPPLY,
  RCD_TRIP_A,
  buildElements,
  checkInstallation,
  computeState,
  defaultEntry,
  pathBetween,
  updateThermal,
} from "../panel_model.js";

function baseModel() {
  // Quadro correto: rede -> contador -> DCP -> geral (2P) -> diferencial (2P)
  // -> 2 disjuntores. Cabos: 10 mm² na entrada, 1,5/2,5 mm² nos circuitos.
  return {
    entry: defaultEntry(), // DCP 30 A (6,9 kVA)
    devices: [
      { id: "g", type: "main", rating: 63, on: true, tripped: false },
      { id: "dif", type: "rcd", rating: 40, on: true, tripped: false },
      { id: "q1", type: "mcb", rating: 10, on: true, tripped: false },
      { id: "q2", type: "mcb", rating: 16, on: true, tripped: false },
    ],
    loads: [
      { id: "luz", name: "Iluminação", watts: 300, on: true, fault: false },
      { id: "tom", name: "Tomadas", watts: 2300, on: true, fault: false },
    ],
    wires: [
      { id: 1, a: "SUP_L", b: "g:Lin", section: 10 },
      { id: 2, a: "SUP_N", b: "g:Nin", section: 10 },
      { id: 3, a: "g:Lout", b: "dif:Lin", section: 10 },
      { id: 4, a: "g:Nout", b: "dif:Nin", section: 10 },
      { id: 5, a: "dif:Lout", b: "q1:Lin", section: 10 },
      { id: 6, a: "dif:Lout", b: "q2:Lin", section: 10 },
      { id: 7, a: "dif:Nout", b: "NBAR", section: 10 },
      { id: 8, a: "q1:Lout", b: "luz:L", section: 1.5 },
      { id: 9, a: "q2:Lout", b: "tom:L", section: 2.5 },
      { id: 10, a: "luz:N", b: "NBAR", section: 1.5 },
      { id: 11, a: "tom:N", b: "NBAR", section: 2.5 },
    ],
  };
}

const approx = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: esperado ~${b}, obtido ${a}`);

/** Simula o tempo a passar (disparo térmico). */
function runSeconds(model, seconds, dt = 0.5) {
  const all = [];
  for (let t = 0; t < seconds; t += dt) {
    const st = computeState(model);
    all.push(...st.events);
    all.push(...updateThermal(model, st, dt));
  }
  return all;
}

// --- quadro correto alimenta os dois circuitos (via contador + DCP) --------
{
  const m = baseModel();
  const st = computeState(m);
  assert.equal(st.events.length, 0, "sem disparos num quadro correto");
  approx(st.loadAmps.get("luz"), 300 / V_SUPPLY, 0.05, "corrente da iluminação");
  approx(st.loadAmps.get("tom"), 2300 / V_SUPPLY, 0.1, "corrente das tomadas");
  approx(st.supplyAmps, (300 + 2300) / V_SUPPLY, 0.15, "corrente total pelo contador");
  const check = checkInstallation(m);
  assert.ok(check.every((c) => c.ok), "verificação passa num quadro correto");
}

// --- interruptor geral: corta tudo mas NUNCA dispara -------------------------
{
  const m = baseModel();
  m.devices[0].on = false;
  approx(computeState(m).supplyAmps, 0, 1e-6, "geral desligado -> sem consumo");

  const m2 = baseModel();
  m2.wires.push({ id: 99, a: "g:Lout", b: "g:Nout", section: 10 }); // curto após o geral
  computeState(m2);
  assert.equal(m2.devices[0].tripped, false, "interruptor geral não dispara (é de corte)");
}

// --- sobrecarga: disparo TÉRMICO temporizado, não instantâneo ----------------
{
  const m = baseModel();
  m.loads[1].watts = 4600; // 20 A num C16 -> 1,25×In
  const st = computeState(m);
  assert.equal(st.events.length, 0, "sobrecarga moderada não dispara instantaneamente");
  const events = runSeconds(m, 40);
  const trip = events.find((e) => e.devId === "q2");
  assert.ok(trip, "C16 dispara termicamente com 20 A");
  assert.equal(trip.reason, "sobrecarga");
  assert.equal(m.devices.find((d) => d.id === "q2").tripped, true);
  const after = computeState(m);
  approx(after.loadAmps.get("luz"), 300 / V_SUPPLY, 0.05, "iluminação continua");
  approx(after.loadAmps.get("tom") || 0, 0, 1e-6, "tomadas ficam sem energia");
}

// --- curto-circuito: disparo magnético instantâneo e seletivo ----------------
{
  const m = baseModel();
  m.wires.push({ id: 99, a: "tom:L", b: "tom:N", section: 2.5 }); // curto franco
  const st = computeState(m);
  const trip = st.events.find((e) => e.kind === "trip");
  assert.ok(trip, "curto dispara instantaneamente");
  assert.equal(trip.devId, "q2", "dispara o disjuntor mais próximo do defeito");
  assert.equal(trip.reason, "curto");
  assert.equal(m.entry.dcpTripped, false, "o DCP a montante não dispara (seletividade)");
  approx(st.supplyAmps, 300 / V_SUPPLY, 0.2, "após disparo, só a iluminação consome");
}

// --- fuga à terra: corrente residual real dispara o diferencial --------------
{
  const m = baseModel();
  m.loads[0].fault = true;
  const st = computeState(m);
  const trip = st.events.find((e) => e.reason === "fuga");
  assert.ok(trip, "diferencial dispara com fuga à terra");
  assert.equal(trip.devId, "dif");
  assert.ok(trip.amps > RCD_TRIP_A, `residual medida (${trip.amps.toFixed(3)} A) > 30 mA`);
  approx(st.supplyAmps, 0, 1e-6, "diferencial corta os dois circuitos");
  assert.equal(m.devices.find((d) => d.id === "q1").tripped, false, "MCB não dispara com 49 mA");
}

// --- botão de teste (T) do diferencial ---------------------------------------
{
  const m = baseModel();
  m.devices[1].testing = true;
  const st = computeState(m);
  const trip = st.events.find((e) => e.reason === "teste");
  assert.ok(trip, "botão T dispara o diferencial");
  assert.equal(trip.devId, "dif");

  // Sem energia (geral desligado), o botão T não faz nada — como na realidade.
  const m2 = baseModel();
  m2.devices[0].on = false;
  m2.devices[1].testing = true;
  assert.equal(computeState(m2).events.length, 0, "T sem energia não dispara");
}

// --- neutros trocados entre grupos diferenciais -------------------------------
{
  // Dois grupos: difA -> q1 -> luz (neutro NBAR), difB -> q2 -> tom (neutro NBAR2).
  const m = baseModel();
  m.devices.push({ id: "difB", type: "rcd", rating: 40, on: true, tripped: false });
  m.wires = m.wires.filter((w) => ![6, 11].includes(w.id));
  m.wires.push(
    { id: 20, a: "g:Lout", b: "difB:Lin", section: 10 },
    { id: 21, a: "g:Nout", b: "difB:Nin", section: 10 },
    { id: 22, a: "difB:Lout", b: "q2:Lin", section: 10 },
    { id: 23, a: "difB:Nout", b: "NBAR2", section: 10 },
    { id: 24, a: "tom:N", b: "NBAR2", section: 2.5 });
  assert.ok(checkInstallation(m).every((c) => c.ok), "dois grupos corretos passam");
  assert.equal(computeState(m).events.length, 0, "dois grupos corretos não disparam");

  // Agora troca o neutro das tomadas para a barra do grupo A (erro clássico).
  m.wires.find((w) => w.id === 24).b = "NBAR";
  const check = checkInstallation(m);
  const tom = check.find((c) => c.loadId === "tom");
  assert.ok(tom.issues.includes("neutro_trocado"), "verificação aponta neutros trocados");
  const st = computeState(m);
  const trip = st.events.find((e) => e.reason === "desequilibrio");
  assert.ok(trip, "diferencial dispara por corrente residual com neutros trocados");
}

// --- o disjuntor protege o cabo -----------------------------------------------
{
  const m = baseModel();
  m.devices.find((d) => d.id === "q1").rating = 20; // C20 num cabo de 1,5 mm²
  const check = checkInstallation(m);
  const luz = check.find((c) => c.loadId === "luz");
  assert.ok(luz.issues.includes("cabo_subdimensionado"), "C20 em 1,5 mm² é rejeitado");
  assert.ok(luz.notes[0].includes("C16"), "a nota diz o máximo admissível");
  assert.ok(check.find((c) => c.loadId === "tom").ok, "circuito correto continua ok");
}

// --- cabo em sobrecarga (acima da ampacidade Iz) --------------------------------
{
  const m = baseModel();
  m.devices.find((d) => d.id === "q1").rating = 25; // proteção errada de propósito
  m.loads[0].watts = 4600; // 20 A num cabo de 1,5 mm² (Iz = 17,5 A)
  const st = computeState(m);
  assert.ok(st.hotWires.has(8), "cabo de 1,5 mm² com 20 A aparece em sobreaquecimento");
}

// --- DCP: potência contratada excedida dispara na entrada -----------------------
{
  const m = baseModel();
  m.entry.dcpRating = 15; // 3,45 kVA contratados
  m.loads[1].watts = 4600; // total ~21 A >> 15 A
  const events = runSeconds(m, 40);
  const trip = events.find((e) => e.devId === "DCP");
  assert.ok(trip, "DCP dispara com a potência contratada excedida");
  assert.equal(trip.reason, "potencia");
  assert.equal(m.entry.dcpTripped, true);
  approx(computeState(m).supplyAmps, 0, 1e-6, "casa toda sem energia (DCP)");
}

// --- verificação continua a apontar o que falta ---------------------------------
{
  const m = baseModel();
  m.wires = m.wires.filter((w) => w.id !== 9);
  m.wires.push({ id: 12, a: "g:Lout", b: "tom:L", section: 2.5 });
  const tom = checkInstallation(m).find((c) => c.loadId === "tom");
  assert.equal(tom.ok, false);
  assert.ok(tom.issues.includes("sem_diferencial"));
  assert.ok(tom.issues.includes("sem_disjuntor"));

  const m2 = baseModel();
  m2.wires = m2.wires.filter((w) => w.id !== 10);
  assert.ok(
    checkInstallation(m2).find((c) => c.loadId === "luz").issues.includes("sem_neutro"));
  approx(computeState(m2).loadAmps.get("luz"), 0, 1e-6, "sem neutro não há corrente");
}

// --- pathBetween respeita estados quando pedido ----------------------------------
{
  const m = baseModel();
  m.devices[1].tripped = true;
  assert.equal(
    pathBetween(m, "SUP_L", "luz:L", { forceConduct: false }).reached, false,
    "diferencial disparado corta o caminho real");
  assert.equal(
    pathBetween(m, "SUP_L", "luz:L", { forceConduct: true }).reached, true,
    "verificação topológica ignora o disparo");
}

// --- buildElements: cadeia de entrada + polos ------------------------------------
{
  const els = buildElements(baseModel());
  assert.ok(els.some((e) => e.type === "battery"));
  const sw = els.filter((e) => e.type === "switch");
  // contador (2) + DCP (2) + geral (2) + dif (2) + 2×mcb (1) = 10 polos
  assert.equal(sw.length, 10, "polos da cadeia de entrada + módulos");
}

console.log("panel_model.js: todos os testes passaram");
