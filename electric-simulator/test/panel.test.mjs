/**
 * Testes do modelo do Quadro Elétrico. Correr com:
 *   node electric-simulator/test/panel.test.mjs
 */
import assert from "node:assert/strict";
import {
  V_SUPPLY,
  buildElements,
  checkInstallation,
  computeState,
  pathBetween,
} from "../panel_model.js";

function baseModel() {
  // Quadro correto: alimentação -> geral (2P) -> diferencial (2P) -> 2 disjuntores.
  const model = {
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
      { id: 1, a: "SUP_L", b: "g:Lin" },
      { id: 2, a: "SUP_N", b: "g:Nin" },
      { id: 3, a: "g:Lout", b: "dif:Lin" },
      { id: 4, a: "g:Nout", b: "dif:Nin" },
      { id: 5, a: "dif:Lout", b: "q1:Lin" },
      { id: 6, a: "dif:Lout", b: "q2:Lin" },
      { id: 7, a: "dif:Nout", b: "NBAR" },
      { id: 8, a: "q1:Lout", b: "luz:L" },
      { id: 9, a: "q2:Lout", b: "tom:L" },
      { id: 10, a: "luz:N", b: "NBAR" },
      { id: 11, a: "tom:N", b: "NBAR" },
    ],
  };
  return model;
}

const approx = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg}: esperado ~${b}, obtido ${a}`);

// --- quadro correto alimenta os dois circuitos ------------------------------
{
  const m = baseModel();
  const st = computeState(m);
  assert.equal(st.events.length, 0, "sem disparos num quadro correto");
  approx(st.loadAmps.get("luz"), 300 / V_SUPPLY, 0.05, "corrente da iluminação");
  approx(st.loadAmps.get("tom"), 2300 / V_SUPPLY, 0.1, "corrente das tomadas");
  approx(st.supplyAmps, (300 + 2300) / V_SUPPLY, 0.15, "corrente total");
  const check = checkInstallation(m);
  assert.ok(check.every((c) => c.ok), "verificação passa num quadro correto");
}

// --- interruptor geral desligado corta tudo ---------------------------------
{
  const m = baseModel();
  m.devices[0].on = false;
  const st = computeState(m);
  approx(st.supplyAmps, 0, 1e-6, "geral desligado -> sem consumo");
  // A verificação de instalação ignora o estado on/off (só topologia).
  assert.ok(checkInstallation(m).every((c) => c.ok), "verificação é topológica");
}

// --- sobrecarga dispara o disjuntor do circuito -----------------------------
{
  const m = baseModel();
  m.loads[1].watts = 4000; // 17.4 A num disjuntor C16 -> dispara
  const st = computeState(m);
  const trip = st.events.find((e) => e.kind === "trip" && e.devId === "q2");
  assert.ok(trip, "C16 dispara com 4000 W");
  assert.equal(trip.reason, "sobrecarga");
  assert.equal(m.devices.find((d) => d.id === "q2").tripped, true);
  // O outro circuito continua alimentado.
  approx(st.loadAmps.get("luz"), 300 / V_SUPPLY, 0.05, "iluminação continua");
  approx(st.loadAmps.get("tom"), 0, 1e-6, "tomadas ficam sem energia");
}

// --- curto-circuito dispara proteções ----------------------------------------
{
  const m = baseModel();
  // Curto franco entre L e N do circuito das tomadas.
  m.wires.push({ id: 99, a: "tom:L", b: "tom:N" });
  const st = computeState(m);
  assert.ok(st.events.some((e) => e.reason === "curto"), "curto detetado e protegido");
  approx(st.supplyAmps, 300 / V_SUPPLY, 0.2, "após disparo, só a iluminação consome");
}

// --- fuga à terra dispara o diferencial --------------------------------------
{
  const m = baseModel();
  m.loads[0].fault = true;
  const st = computeState(m);
  const trip = st.events.find((e) => e.reason === "fuga");
  assert.ok(trip, "diferencial dispara com fuga à terra");
  assert.equal(trip.devId, "dif");
  approx(st.supplyAmps, 0, 1e-6, "diferencial corta os dois circuitos");
}

// --- verificação aponta o que falta ------------------------------------------
{
  const m = baseModel();
  // Ligar as tomadas diretamente à saída do geral (salta diferencial e disjuntor).
  m.wires = m.wires.filter((w) => w.id !== 9);
  m.wires.push({ id: 12, a: "g:Lout", b: "tom:L" });
  const check = checkInstallation(m);
  const tom = check.find((c) => c.loadId === "tom");
  assert.equal(tom.ok, false);
  assert.ok(tom.issues.includes("sem_diferencial"), "aponta falta de diferencial");
  assert.ok(tom.issues.includes("sem_disjuntor"), "aponta falta de disjuntor");
  const luz = check.find((c) => c.loadId === "luz");
  assert.ok(luz.ok, "circuito correto continua ok");
}

// --- neutro esquecido ---------------------------------------------------------
{
  const m = baseModel();
  m.wires = m.wires.filter((w) => w.id !== 10);
  const check = checkInstallation(m);
  assert.ok(
    check.find((c) => c.loadId === "luz").issues.includes("sem_neutro"),
    "aponta neutro em falta");
  const st = computeState(m);
  approx(st.loadAmps.get("luz"), 0, 1e-6, "sem neutro não há corrente");
}

// --- pathBetween respeita estados quando pedido -------------------------------
{
  const m = baseModel();
  m.devices[1].tripped = true;
  assert.equal(
    pathBetween(m, "SUP_L", "luz:L", { forceConduct: false }).reached,
    false,
    "diferencial disparado corta o caminho real");
  assert.equal(
    pathBetween(m, "SUP_L", "luz:L", { forceConduct: true }).reached,
    true,
    "verificação topológica ignora o disparo");
}

// --- buildElements é consumível pelo solver ------------------------------------
{
  const els = buildElements(baseModel());
  assert.ok(els.some((e) => e.type === "battery"));
  assert.ok(els.filter((e) => e.type === "switch").length === 6, "2P+2P+1P+1P = 6 polos");
}

console.log("panel_model.js: todos os testes passaram");
