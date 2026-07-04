
"use strict";

/* ============================================================
   CONSTANTS
   ============================================================ */
const GRID = 25;                 // px per grid square
const PALETTE = ['#f0a830','#5fd394','#63b3ed','#9f7aea','#f687b3','#4fd1c5','#fbd38d','#fc8181','#76e0a0','#90cdf4'];
const BREAKER_AMPS = [15,20,25,30,40,50,60,70,80,90,100,125];
const MAIN_AMP_OPTIONS = [60,100,125,150,200,225,400];
const PANEL_SPACE_OPTIONS = [12,16,20,24,30,40,42];

/* wire gauge by breaker amperage (copper, NEC 60/75C general) */
const GAUGE_BY_AMP = {15:'14 AWG',20:'12 AWG',25:'10 AWG',30:'10 AWG',40:'8 AWG',50:'6 AWG',60:'6 AWG',70:'4 AWG',80:'4 AWG',90:'3 AWG',100:'3 AWG',125:'1 AWG'};
/* circular mils per AWG (for voltage-drop math) */
const CM_BY_GAUGE = {'14 AWG':4110,'12 AWG':6530,'10 AWG':10380,'8 AWG':16510,'6 AWG':26240,'4 AWG':41740,'3 AWG':52620,'2 AWG':66360,'1 AWG':83690};
const K_COPPER = 12.9;           // ohm-cmil/ft

/* category metadata: order, label, accent var */
const CATEGORIES = [
  { key:'dist',    label:'Distribution',     color:'var(--cat-dist)' },
  { key:'recep',   label:'Receptacles',      color:'var(--cat-recep)' },
  { key:'light',   label:'Lighting',         color:'var(--cat-light)' },
  { key:'switch',  label:'Switches',         color:'var(--cat-switch)' },
  { key:'ctrl',    label:'Controls & Protection', color:'var(--cat-ctrl)' },
  { key:'kitchen', label:'Kitchen',          color:'var(--cat-kitchen)' },
  { key:'laundry', label:'Laundry',          color:'var(--cat-laundry)' },
  { key:'hvac',    label:'HVAC & Climate',   color:'var(--cat-hvac)' },
  { key:'water',   label:'Water & Pumps',    color:'var(--cat-water)' },
  { key:'ev',      label:'EV & Exterior',    color:'var(--cat-ev)' },
  { key:'safety',  label:'Safety & Low-V',   color:'var(--cat-safety)' },
  { key:'custom',  label:'Custom Parts',     color:'var(--amber)' },
];

/* ------------------------------------------------------------
   DEVICE LIBRARY
   watts = VA estimate, v = nominal volts, poles = 1|2,
   cont = continuous load (counted at 125%), shape = icon family,
   node = can feed downstream parts (splitter / subpanel),
   isPanel / isSub mark distribution equipment.
   ------------------------------------------------------------ */
const LIBRARY = [
  // ---- Distribution ----
  { type:'panel',    cat:'dist', label:'Main Panel',      glyph:'MP', watts:0, v:240, poles:2, shape:'panel',    isPanel:true },
  { type:'subpanel', cat:'dist', label:'Sub-Panel',       glyph:'SP', watts:0, v:240, poles:2, shape:'subpanel', isPanel:true, isSub:true, node:true },
  { type:'splitter', cat:'dist', label:'Junction / Splitter', glyph:'J', watts:0, v:120, poles:1, shape:'splitter', node:true, maxAmps:20 },
  { type:'disconnect', cat:'dist', label:'Disconnect',    glyph:'D', watts:0, v:240, poles:2, shape:'disconnect' },

  // ---- Receptacles ----
  { type:'outlet',     cat:'recep', label:'Duplex Outlet 15A', glyph:'',  watts:180, v:120, poles:1, shape:'outlet' },
  { type:'outlet20',   cat:'recep', label:'Duplex Outlet 20A', glyph:'',  watts:180, v:120, poles:1, shape:'outlet' },
  { type:'gfci',       cat:'recep', label:'GFCI Outlet',       glyph:'',  watts:180, v:120, poles:1, shape:'gfci', gfci:true },
  { type:'usboutlet',  cat:'recep', label:'USB / Smart Outlet',glyph:'',  watts:180, v:120, poles:1, shape:'outlet' },
  { type:'outlet240',  cat:'recep', label:'240V Receptacle',   glyph:'',  watts:0,   v:240, poles:2, shape:'outlet240' },
  { type:'floorbox',   cat:'recep', label:'Floor Box',         glyph:'',  watts:180, v:120, poles:1, shape:'outlet' },

  // ---- Lighting ----
  { type:'light',      cat:'light', label:'Light Fixture',  glyph:'L', watts:60,  v:120, poles:1, shape:'light' },
  { type:'recessed',   cat:'light', label:'Recessed Can',   glyph:'',  watts:12,  v:120, poles:1, shape:'recessed' },
  { type:'pendant',    cat:'light', label:'Pendant',        glyph:'',  watts:60,  v:120, poles:1, shape:'pendant' },
  { type:'chandelier', cat:'light', label:'Chandelier',     glyph:'',  watts:200, v:120, poles:1, shape:'chandelier' },
  { type:'fan',        cat:'light', label:'Ceiling Fan',    glyph:'F', watts:75,  v:120, poles:1, shape:'fan' },
  { type:'fanlight',   cat:'light', label:'Fan + Light',    glyph:'',  watts:135, v:120, poles:1, shape:'fan' },
  { type:'ledstrip',   cat:'light', label:'LED Strip',      glyph:'',  watts:24,  v:120, poles:1, shape:'led' },
  { type:'outdoorlight', cat:'light', label:'Outdoor Light',glyph:'',  watts:30,  v:120, poles:1, shape:'light' },
  { type:'flood',      cat:'light', label:'Flood Light',    glyph:'',  watts:120, v:120, poles:1, shape:'flood' },

  // ---- Switches (control, 0 VA) ----
  { type:'switch',   cat:'switch', label:'Switch',        glyph:'S',  watts:0, v:120, poles:1, shape:'switch', control:true },
  { type:'switch3',  cat:'switch', label:'3-Way Switch',  glyph:'S3', watts:0, v:120, poles:1, shape:'switch', control:true },
  { type:'dimmer',   cat:'switch', label:'Dimmer',        glyph:'',   watts:0, v:120, poles:1, shape:'dimmer', control:true },
  { type:'motion',   cat:'switch', label:'Motion Sensor', glyph:'M',  watts:0, v:120, poles:1, shape:'switch', control:true },
  { type:'smartsw',  cat:'switch', label:'Smart Switch',  glyph:'',   watts:5, v:120, poles:1, shape:'dimmer', control:true },

  /* controls & protection (EU control-panel gear \u2014 click to operate) */
  { type:'contactor', cat:'ctrl', label:'Contactor 3P',       glyph:'K1', watts:0, v:400, poles:2, shape:'contactor',  control:true },
  { type:'relay',     cat:'ctrl', label:'Interface Relay',    glyph:'RY', watts:0, v:230, poles:1, shape:'relay',      control:true },
  { type:'mcb',       cat:'ctrl', label:'MCB B16',            glyph:'F1', watts:0, v:230, poles:1, shape:'mcb',        control:true },
  { type:'rcbo',      cat:'ctrl', label:'RCBO B16 30mA',      glyph:'F2', watts:0, v:230, poles:1, shape:'rcbo',       control:true },
  { type:'terminal',  cat:'ctrl', label:'Terminal Blocks',    glyph:'X1', watts:0, v:230, poles:1, shape:'terminal',   node:true, maxAmps:32 },
  { type:'pressuresw',cat:'ctrl', label:'Pressure Switch',    glyph:'P',  watts:0, v:230, poles:1, shape:'pressuresw', control:true },

  // ---- Kitchen ----
  { type:'fridge',    cat:'kitchen', label:'Refrigerator',    glyph:'R', watts:700,   v:120, poles:1, shape:'appliance' },
  { type:'dishwasher',cat:'kitchen', label:'Dishwasher',      glyph:'DW',watts:1200,  v:120, poles:1, shape:'appliance' },
  { type:'microwave', cat:'kitchen', label:'Microwave',       glyph:'MW',watts:1500,  v:120, poles:1, shape:'appliance' },
  { type:'disposal',  cat:'kitchen', label:'Garbage Disposal',glyph:'GD',watts:900,   v:120, poles:1, shape:'motor' },
  { type:'range',     cat:'kitchen', label:'Range / Oven',    glyph:'RG',watts:12000, v:240, poles:2, shape:'appliance' },
  { type:'cooktop',   cat:'kitchen', label:'Cooktop',         glyph:'CT',watts:7200,  v:240, poles:2, shape:'appliance' },
  { type:'walloven',  cat:'kitchen', label:'Wall Oven',       glyph:'OV',watts:4800,  v:240, poles:2, shape:'appliance' },
  { type:'hood',      cat:'kitchen', label:'Range Hood',      glyph:'H', watts:300,   v:120, poles:1, shape:'motor' },
  { type:'icemaker',  cat:'kitchen', label:'Ice Maker',       glyph:'IM',watts:120,   v:120, poles:1, shape:'appliance' },

  // ---- Laundry ----
  { type:'washer',    cat:'laundry', label:'Washer',         glyph:'W', watts:1200, v:120, poles:1, shape:'appliance' },
  { type:'dryer',     cat:'laundry', label:'Electric Dryer', glyph:'DR',watts:5500, v:240, poles:2, shape:'appliance' },
  { type:'gasdryer',  cat:'laundry', label:'Gas Dryer',      glyph:'GD',watts:700,  v:120, poles:1, shape:'appliance' },

  // ---- HVAC ----
  { type:'ac',        cat:'hvac', label:'Window AC Unit',     glyph:'AC',watts:1440, v:120, poles:1, shape:'ac',   cont:true },
  { type:'minisplit', cat:'hvac', label:'Mini-Split',         glyph:'MS',watts:1200, v:240, poles:2, shape:'ac',   cont:true },
  { type:'condenser', cat:'hvac', label:'AC Condenser',       glyph:'CU',watts:3600, v:240, poles:2, shape:'ac',   cont:true },
  { type:'airhandler',cat:'hvac', label:'Air Handler',        glyph:'AH',watts:1500, v:120, poles:1, shape:'motor' },
  { type:'furnace',   cat:'hvac', label:'Electric Furnace',   glyph:'FU',watts:10000,v:240, poles:2, shape:'heat', cont:true },
  { type:'heatpump',  cat:'hvac', label:'Heat Pump',          glyph:'HP',watts:5000, v:240, poles:2, shape:'ac',   cont:true },
  { type:'baseboard', cat:'hvac', label:'Baseboard Heater',   glyph:'BB',watts:1500, v:240, poles:2, shape:'heat', cont:true },
  { type:'exhaustfan',cat:'hvac', label:'Exhaust Fan',        glyph:'EF',watts:60,   v:120, poles:1, shape:'motor' },
  { type:'acindoor',  cat:'hvac', label:'Split Indoor Unit',  glyph:'IU',watts:60,   v:240, poles:2, shape:'ac',   split:'indoor' },
  { type:'acoutdoor', cat:'hvac', label:'Split Outdoor Unit', glyph:'OU',watts:2400, v:240, poles:2, shape:'ac',   cont:true, split:'outdoor' },
  { type:'ac3cond',   cat:'hvac', label:'3-Phase Condenser',  glyph:'3\u03C6',watts:8000, v:400, poles:2, shape:'ac', cont:true, phase3:true, split:'outdoor' },
  { type:'ac3vrf',    cat:'hvac', label:'3-Phase VRF Outdoor',glyph:'VRF',watts:12000,v:400, poles:2, shape:'ac', cont:true, phase3:true, split:'outdoor' },
  { type:'ac3rtu',    cat:'hvac', label:'3-Phase Rooftop Unit',glyph:'RTU',watts:15000,v:400,poles:2, shape:'ac', cont:true, phase3:true },

  // ---- Water & Pumps ----
  { type:'waterheater',cat:'water', label:'Water Heater',     glyph:'WH',watts:4500, v:240, poles:2, shape:'water', cont:true },
  { type:'tankless',   cat:'water', label:'Tankless Heater',  glyph:'TL',watts:18000,v:240, poles:2, shape:'water', cont:true },
  { type:'wellpump',   cat:'water', label:'Well Pump',        glyph:'WP',watts:1500, v:240, poles:2, shape:'motor' },
  { type:'sumppump',   cat:'water', label:'Sump Pump',        glyph:'SP',watts:800,  v:120, poles:1, shape:'motor' },
  { type:'poolpump',   cat:'water', label:'Pool Pump',        glyph:'PP',watts:1500, v:240, poles:2, shape:'motor', cont:true },

  // ---- EV & Exterior ----
  { type:'ev32',     cat:'ev', label:'EV Charger 32A',  glyph:'EV',watts:7680,  v:240, poles:2, shape:'ev', cont:true },
  { type:'ev48',     cat:'ev', label:'EV Charger 48A',  glyph:'EV',watts:11520, v:240, poles:2, shape:'ev', cont:true },
  { type:'hottub',   cat:'ev', label:'Hot Tub / Spa',   glyph:'HT',watts:7500,  v:240, poles:2, shape:'water', cont:true },
  { type:'gate',     cat:'ev', label:'Gate / Opener',   glyph:'GA',watts:500,   v:120, poles:1, shape:'motor' },
  { type:'genset',   cat:'ev', label:'Generator Inlet', glyph:'GN',watts:0,     v:240, poles:2, shape:'disconnect' },

  // ---- Safety & Low Voltage ----
  { type:'smoke',    cat:'safety', label:'Smoke Detector', glyph:'SD',watts:5,  v:120, poles:1, shape:'smoke' },
  { type:'co',       cat:'safety', label:'CO Detector',    glyph:'CO',watts:5,  v:120, poles:1, shape:'smoke' },
  { type:'doorbell', cat:'safety', label:'Doorbell',       glyph:'DB',watts:10, v:120, poles:1, shape:'smoke' },
  { type:'security', cat:'safety', label:'Security Panel', glyph:'SE',watts:30, v:120, poles:1, shape:'appliance' },
  /* upgraded in batch 2: same type key (saved projects keep working), now an operable EU room stat */
  { type:'thermostat',cat:'ctrl',  label:'Room Thermostat', glyph:'T', watts:5,  v:230, poles:1, shape:'thermostat', control:true },
];
const LIB_BY_TYPE = {};
LIBRARY.forEach(d => LIB_BY_TYPE[d.type] = d);

/* ============================================================
   STATE
   ============================================================ */
function freshState(){
  const mainId = 1;
  return {
    meta:{ name:'Untitled Project', sqft:0, created:Date.now(), modified:Date.now() },
    settings:{ ftPerSquare:1, snap:true, showFlow:true, showConductors:true, symbolScale:1, demandCalc:false, realistic:true },
    components:[
      { id:mainId, type:'panel', x:150, y:150, rot:0, label:'Main Panel', room:'', notes:'',
        watts:0, v:240, gfci:false, afci:false,
        spaces:30, mainAmp:200, busAmp:200, isMain:true, fedByCircuitId:null }
    ],
    circuits:[
      { id:1, panelId:mainId, name:'Circuit 1', amp:15, poles:1, color:PALETTE[0], breakerOn:true, slot:1, breakerType:'std' }
    ],
    connections:[],
    walls:[],
    customTypes:[],
    training:{ completed:[], current:null, coachOpen:false },
    acBench:{ unit:'single', standard:'iec', color:null, wires:[], sel:null, selWire:null, comp:'none', cap:'ok', powerOn:false, guide:false, meter:{ mode:'ohm', a:null, b:null, probe:false }, install:{ lines:[], selPort:null, slope:'none', insul:false, gauges:false, vacuum:false, valves:false } },
    panelLab:{ view:'live', mainOn:false, brk:false, amp:20, gauge:'12', wires:[], sel:null, meter:{ mode:'v', a:null, b:null, probe:false } },
    dinLab:{ preset:'cu', wires:[], sel:null, powerOn:false, fault:'none', sealed:true },
    counters:{ comp:2, circuit:2, conn:1, wall:1 },
  };
}

let state = freshState();

/* view (SVG viewBox) + transient UI */
let view = { x:0, y:0, w:1400, h:900 };
let ui = {
  tab:'floorplan',
  tool:'select',            // select | wire | wall | pan | place:<type>
  placeType:null,
  activeCircuit:1,
  selectedId:null,
  selectedWallId:null,
  selectedConnId:null,
  pendingWireFrom:null,
  wireDraft:null,           // { from:id, points:[{x,y}] } while routing a wire
  wirePreview:null,         // live cursor point for the rubber-band
  selectedBreaker:null,     // circuit id selected in the Panels simulator
  wallDraftStart:null,
  wallPreviewPoint:null,
  partFilter:'',
  collapsedCats:{},
  mouseWorld:{x:0,y:0},
};
let dragId=null, dragMoved=false, suppressClick=false, toastTimer=null;
let isPanning=false, panStart=null, panViewStart=null, panMoved=false;
let wpDrag=null;            // { connId, index } while dragging a wire bend point
let undoStack=[], redoStack=[];

/* ============================================================
   HELPERS
   ============================================================ */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmt(n){ return Math.round(n*10)/10; }
function fmt0(n){ return Math.round(n); }
function svgEl(){ return document.getElementById('canvas'); }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }

function svgPoint(evt){
  const svg = svgEl();
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
  return { x:loc.x, y:loc.y };
}
function snap(p){
  if(!state.settings.snap) return { x:Math.round(p.x), y:Math.round(p.y) };
  return { x:Math.round(p.x/GRID)*GRID, y:Math.round(p.y/GRID)*GRID };
}
function ftPer(){ return state.settings.ftPerSquare || 1; }
function pxToFt(px){ return (px/GRID)*ftPer(); }

/* lookups */
function findComp(id){ return state.components.find(c=>c.id===id); }
function getCircuit(id){ return state.circuits.find(c=>c.id===id); }
function getPanels(){ return state.components.filter(c=>LIB_BY_TYPE[c.type] && LIB_BY_TYPE[c.type].isPanel || c.type==='panel' || c.type==='subpanel'); }
function getMainPanel(){ return state.components.find(c=>c.type==='panel'); }
function panelCircuits(panelId){ return state.circuits.filter(c=>c.panelId===panelId); }
function isPanelType(type){ const d=LIB_BY_TYPE[type]; return !!(d && d.isPanel); }
function isNodeType(type){ const d=LIB_BY_TYPE[type]; return !!(d && d.node); }
function isControl(type){ const d=LIB_BY_TYPE[type]; return !!(d && d.control); }
const SWITCH_TYPES = new Set(['switch','switch3','dimmer','motion','smartsw',
  /* batch-2 control gear operates through the same click-to-toggle power logic */
  'contactor','relay','mcb','rcbo','thermostat','pressuresw']);
function isSwitchType(type){
  if(SWITCH_TYPES.has(type)) return true;
  const d=LIB_BY_TYPE[type]; if(d) return d.shape==='switch'||d.shape==='dimmer';
  const ct=state.customTypes.find(t=>t.key===type);
  return ct? (ct.shape==='switch'||ct.shape==='dimmer'):false;
}
function switchOn(comp){ return comp.on!==false; } // default ON

/* ---- live energy-flow simulation ----
   Power starts at energized panels, travels the wires, and is blocked by
   any switch that is OFF. A device "draws" only when it is actually live. */
let LIVE=null;
function invalidateLive(){ LIVE=null; }
function ensureLive(){ if(LIVE===null) LIVE=computeEnergized(); return LIVE; }
function computeEnergized(){
  const live=new Set();
  const panelIds=new Set(state.components.filter(c=>isPanelType(c.type)).map(c=>c.id));
  const adj={};
  state.components.forEach(c=>adj[c.id]=[]);
  state.connections.forEach(w=>{ if(adj[w.fromId]&&adj[w.toId]){ adj[w.fromId].push(w.toId); adj[w.toId].push(w.fromId); } });

  const byCircuit={};
  state.components.forEach(c=>{ if(isPanelType(c.type)||c.circuitId==null) return; (byCircuit[c.circuitId]=byCircuit[c.circuitId]||[]).push(c); });

  Object.keys(byCircuit).forEach(cid=>{
    const circuit=getCircuit(parseInt(cid,10));
    if(!circuit || !circuitPowered(circuit)) return;  // breaker / panel off -> nothing live
    const comps=byCircuit[cid];
    const idset=new Set(comps.map(c=>c.id));
    const degIn=c=>adj[c.id].filter(n=>idset.has(n)||panelIds.has(n)).length;
    const wiredToPanel=comps.filter(c=>adj[c.id].some(n=>panelIds.has(n)));

    // any device with no wiring at all is assumed fed straight off the circuit
    comps.forEach(c=>{ if(degIn(c)===0) live.add(c.id); });

    let seeds;
    if(wiredToPanel.length){
      seeds=wiredToPanel.map(c=>c.id);
    } else {
      // no panel feeder wired in: seed everything that isn't sitting only behind a switch
      seeds=[];
      comps.forEach(c=>{
        const touchesSwitch=adj[c.id].some(n=>{ const nc=findComp(n); return nc&&isSwitchType(nc.type); });
        if(degIn(c)===0 || isSwitchType(c.type) || !touchesSwitch) seeds.push(c.id);
      });
    }
    const visited=new Set(), q=seeds.slice();
    while(q.length){
      const id=q.shift();
      if(visited.has(id)) continue;
      visited.add(id); live.add(id);
      const c=findComp(id); if(!c) continue;
      if(isSwitchType(c.type) && !switchOn(c)) continue; // an open switch stops power here
      adj[id].forEach(n=>{ if(idset.has(n) && !visited.has(n)) q.push(n); });
    }
  });
  return live;
}
function isLive(comp){
  if(isPanelType(comp.type)) return panelPowered(comp);
  return ensureLive().has(comp.id);
}

function libDef(type){
  if(LIB_BY_TYPE[type]) return LIB_BY_TYPE[type];
  const ct = state.customTypes.find(t=>t.key===type);
  if(ct) return { type, cat:'custom', label:ct.label, glyph:ct.glyph, watts:ct.watts, v:ct.v||120, poles:ct.poles||1, shape:ct.shape||'custom', cont:!!ct.cont, control:!!ct.control };
  return { type, cat:'custom', label:'Device', glyph:'?', watts:0, v:120, poles:1, shape:'custom' };
}
function allPlaceableTypes(){
  return LIBRARY.concat(state.customTypes.map(t=>libDef(t.key)));
}

/* voltage of a component (from its circuit, else its own default) */
function compVoltage(comp){
  if(comp.circuitId){ const c=getCircuit(comp.circuitId); if(c) return c.poles===2?240:120; }
  return comp.v || libDef(comp.type).v || 120;
}

function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),2600);
}

/* ============================================================
   UNDO / REDO + AUTOSAVE
   ============================================================ */
function snapshotData(){
  return { state:clone(state) };
}
function pushUndo(){
  undoStack.push(snapshotData());
  if(undoStack.length>60) undoStack.shift();
  redoStack.length=0;
}
function applySnapshot(snap){
  state = clone(snap.state);
  // keep selection valid
  if(ui.selectedId && !findComp(ui.selectedId)) ui.selectedId=null;
  if(!getCircuit(ui.activeCircuit)) ui.activeCircuit = state.circuits[0]? state.circuits[0].id : null;
}
function undo(){
  if(!undoStack.length){ showToast('Nothing to undo.'); return; }
  redoStack.push(snapshotData());
  applySnapshot(undoStack.pop());
  renderAll(); markDirty();
}
function redo(){
  if(!redoStack.length){ showToast('Nothing to redo.'); return; }
  undoStack.push(snapshotData());
  applySnapshot(redoStack.pop());
  renderAll(); markDirty();
}

const LS_AUTOSAVE='circuitPlanner.autosave.v2';
const LS_PROJECTS='circuitPlanner.projects.v2';
let dirty=false, autosaveTimer=null;

function markDirty(){
  invalidateLive();
  dirty=true;
  state.meta.modified=Date.now();
  document.getElementById('saveState').textContent='\u25CF unsaved';
  clearTimeout(autosaveTimer);
  autosaveTimer=setTimeout(autosave,800);
}
function autosave(){
  try{
    localStorage.setItem(LS_AUTOSAVE, serialize());
    document.getElementById('saveState').textContent='auto-saved';
  }catch(e){ /* storage unavailable (e.g. sandbox) -> silently skip */ }
}
function serialize(){
  state.meta.name=document.getElementById('projName').value||'Untitled Project';
  return JSON.stringify({ state, view });
}
function deserialize(str){
  const obj=JSON.parse(str);
  if(!obj.state) throw new Error('bad file');
  state=obj.state;
  // backfill any missing fields from newer versions
  state.settings=Object.assign({ ftPerSquare:1, snap:true, showFlow:true, showConductors:true, symbolScale:1, demandCalc:false, realistic:true }, state.settings||{});
  state.training=Object.assign({ completed:[], current:null, coachOpen:false }, state.training||{});
  state.acBench=Object.assign({ unit:'single', standard:'iec', color:null, wires:[], sel:null, selWire:null, comp:'none', cap:'ok', powerOn:false, meter:{ mode:'ohm', a:null, b:null, probe:false } }, state.acBench||{});
  state.acBench.meter=Object.assign({ mode:'ohm', a:null, b:null, probe:false }, state.acBench.meter||{});
  state.panelLab=Object.assign({ view:'live', mainOn:false, brk:false, amp:20, gauge:'12', wires:[], sel:null, meter:{ mode:'v', a:null, b:null, probe:false } }, state.panelLab||{});
  state.dinLab=Object.assign({ preset:'cu', wires:[], sel:null, powerOn:false, fault:'none', sealed:true }, state.dinLab||{});
  state.panelLab.meter=Object.assign({ mode:'v', a:null, b:null, probe:false }, state.panelLab.meter||{});
  state.meta=Object.assign({ name:'Untitled Project', sqft:0 }, state.meta||{});
  state.customTypes=state.customTypes||[];
  // normalize wires from older versions
  (state.connections||[]).forEach(c=>{ if(!Array.isArray(c.points)) c.points=[]; if(!c.run) c.run='wall'; });
  if(obj.view) view=obj.view;
  ui.selectedId=null; ui.selectedWallId=null; ui.selectedConnId=null; ui.selectedBreaker=null; ui.wireDraft=null; ui.wirePreview=null;
  ui.activeCircuit = state.circuits[0] ? state.circuits[0].id : null;
  document.getElementById('projName').value=state.meta.name;
}

/* ============================================================
   LOAD MATH
   ============================================================ */
function circuitPowered(circuit){
  if(!circuit) return false;
  const panel=findComp(circuit.panelId);
  if(!panel) return circuit.breakerOn;
  return panelPowered(panel) && circuit.breakerOn;
}
function panelPowered(panel){
  if(!panel) return false;
  if(panel.type==='panel') return panel.mainOn!==false; // main
  // subpanel: powered if its feeder circuit is powered
  if(panel.fedByCircuitId){
    const feeder=getCircuit(panel.fedByCircuitId);
    return circuitPowered(feeder);
  }
  return true;
}
/* devices physically assigned to a circuit (includes splitter children since they carry circuitId too) */
function circuitDevices(circuitId){
  return state.components.filter(c=>c.circuitId===circuitId && !isPanelType(c.type));
}
/* a circuit that feeds a subpanel: find that subpanel */
function subpanelFedBy(circuitId){
  return state.components.find(c=>c.type==='subpanel' && c.fedByCircuitId===circuitId);
}
function circuitLoad(circuit){
  const volts = circuit.poles===2?240:120;
  let connectedVA=0, contVA=0, nonContVA=0, count=0, liveVA=0;
  const liveSet=ensureLive();
  const sub=subpanelFedBy(circuit.id);
  if(sub){
    const pl=panelLoad(sub.id);
    connectedVA=pl.connectedVA; contVA=pl.contVA; nonContVA=pl.nonContVA; count=pl.deviceCount; liveVA=pl.liveVA;
  } else {
    circuitDevices(circuit.id).forEach(d=>{
      const va=d.watts||0;
      connectedVA+=va; count++;
      if(d.cont!==undefined? d.cont : libDef(d.type).cont) contVA+=va; else nonContVA+=va;
      if(liveSet.has(d.id)) liveVA+=va;
    });
  }
  const adjVA = nonContVA + contVA*1.25;
  const amps = connectedVA/volts;
  const adjAmps = adjVA/volts;
  const liveAmps = liveVA/volts;
  const capVA = circuit.amp*volts;
  const pct = capVA? Math.min(200,(adjVA/capVA)*100) : 0;
  const livePct = capVA? Math.min(200,(liveVA/capVA)*100) : 0;
  let status='OK', color='var(--green)';
  if(!circuitPowered(circuit)){ status='OFF'; color='var(--text-dimmer)'; }
  else if(adjVA>capVA){ status='OVER'; color='var(--red)'; }
  else if(adjVA>=capVA*0.8){ status='NEAR'; color='var(--amber)'; }
  return { volts,connectedVA,contVA,nonContVA,adjVA,amps,adjAmps,liveVA,liveAmps,capVA,pct,livePct,status,color,count,isFeeder:!!sub,sub };
}
/* splitter: children are devices whose feedFromId points to it */
function splitterChildren(splitId){
  return state.components.filter(c=>c.feedFromId===splitId);
}
function splitterLoad(split){
  let va=0, count=0;
  splitterChildren(split.id).forEach(c=>{ va+=c.watts||0; count++; });
  const volts=compVoltage(split);
  const amps=va/volts;
  const max=split.maxAmps || libDef(split.type).maxAmps || 20;
  const capVA=max*volts;
  const pct=capVA?Math.min(200,(va/capVA)*100):0;
  let status='OK',color='var(--green)';
  if(va>capVA){ status='OVER'; color='var(--red)'; }
  else if(va>=capVA*0.8){ status='NEAR'; color='var(--amber)'; }
  return { va,amps,volts,max,capVA,pct,status,color,count };
}
/* recursive panel load (rolls up subpanels via feeder circuits) */
function panelLoad(panelId){
  let connectedVA=0, contVA=0, nonContVA=0, deviceCount=0, liveVA=0;
  const liveSet=ensureLive();
  panelCircuits(panelId).forEach(c=>{
    const sub=subpanelFedBy(c.id);
    if(sub){
      const pl=panelLoad(sub.id);
      connectedVA+=pl.connectedVA; contVA+=pl.contVA; nonContVA+=pl.nonContVA; deviceCount+=pl.deviceCount; liveVA+=pl.liveVA;
    } else {
      circuitDevices(c.id).forEach(d=>{
        const va=d.watts||0; connectedVA+=va; deviceCount++;
        if(d.cont!==undefined? d.cont : libDef(d.type).cont) contVA+=va; else nonContVA+=va;
        if(liveSet.has(d.id)) liveVA+=va;
      });
    }
  });
  const adjVA=nonContVA+contVA*1.25;
  const panel=findComp(panelId);
  const mainAmp=panel? (panel.mainAmp||200):200;
  const amps=adjVA/240;
  const liveAmps=liveVA/240;
  const capVA=mainAmp*240;
  const pct=capVA?Math.min(200,(adjVA/capVA)*100):0;
  const livePct=capVA?Math.min(200,(liveVA/capVA)*100):0;
  let status='OK',color='var(--green)';
  if(adjVA>capVA){ status='OVER'; color='var(--red)'; }
  else if(adjVA>=capVA*0.8){ status='NEAR'; color='var(--amber)'; }
  return { connectedVA,contVA,nonContVA,adjVA,amps,liveVA,liveAmps,capVA,pct,livePct,status,color,deviceCount,mainAmp };
}
function totalConnectedVA(){
  return state.components.filter(c=>!isPanelType(c.type)).reduce((s,c)=>s+(c.watts||0),0);
}
/* simplified NEC-220 standard dwelling estimate (transparent, not a stamped calc) */
function serviceCalc(){
  const sqft = state.meta.sqft||0;
  const general = sqft*3;                 // 3 VA/sqft general lighting+receptacle
  const smallAppl = 2*1500;               // 2 small-appliance branch circuits
  const laundry = 1500;                   // 1 laundry branch
  const lightingBase = general+smallAppl+laundry;
  // first 3000 @ 100%, remainder @ 35%
  let lightingDemand;
  if(lightingBase<=3000) lightingDemand=lightingBase;
  else lightingDemand=3000+(lightingBase-3000)*0.35;

  // fixed appliances (exclude range/dryer/hvac/ev which are handled separately)
  const sep=['range','cooktop','walloven','dryer','ac','minisplit','condenser','furnace','heatpump','baseboard','ev32','ev48'];
  const fixed = state.components.filter(c=>!isPanelType(c.type) && !sep.includes(c.type) && !isControl(c.type));
  let fixedVA = fixed.reduce((s,c)=>s+(c.watts||0),0) - (general?0:0);
  // subtract the receptacle/lighting that the per-sqft already covers? keep simple: count appliances >= 500VA as "fixed appliances"
  const fixedAppl = fixed.filter(c=>(c.watts||0)>=500);
  let fixedApplVA = fixedAppl.reduce((s,c)=>s+(c.watts||0),0);
  const fixedDemand = fixedAppl.length>=4 ? fixedApplVA*0.75 : fixedApplVA;

  // range demand (NEC 220.55 col C, 1 range <=12kW => 8000)
  const ranges = state.components.filter(c=>['range','cooktop','walloven'].includes(c.type));
  let rangeVA=0;
  if(ranges.length){
    const total=ranges.reduce((s,c)=>s+(c.watts||0),0);
    rangeVA = ranges.length===1 ? Math.min(8000, total>12000? 8000+(Math.ceil((total-12000)/1000)*400):8000) : total*0.65;
  }
  // dryer (min 5000, 100% for first 4)
  const dryers=state.components.filter(c=>c.type==='dryer');
  const dryerVA = dryers.reduce((s,c)=>s+Math.max(5000,c.watts||0),0);
  // HVAC: larger of heating vs cooling
  const cool=state.components.filter(c=>['ac','minisplit','condenser','heatpump'].includes(c.type)).reduce((s,c)=>s+(c.watts||0),0);
  const heat=state.components.filter(c=>['furnace','baseboard','heatpump'].includes(c.type)).reduce((s,c)=>s+(c.watts||0),0);
  const hvacVA=Math.max(cool,heat);
  // EV at 100% continuous*1.25
  const evVA=state.components.filter(c=>['ev32','ev48'].includes(c.type)).reduce((s,c)=>s+(c.watts||0)*1.25,0);

  const totalVA=lightingDemand+fixedDemand+rangeVA+dryerVA+hvacVA+evVA;
  const amps=totalVA/240;
  return { sqft,general,smallAppl,laundry,lightingBase,lightingDemand,fixedAppl:fixedAppl.length,fixedApplVA,fixedDemand,rangeVA,dryerVA,cool,heat,hvacVA,evVA,totalVA,amps };
}
/* voltage drop for a wire run */
/* full routed path of a wire: source, bend points, target */
function wirePath(conn){
  const a=findComp(conn.fromId), b=findComp(conn.toId);
  if(!a||!b) return null;
  const pts=(conn.points||[]).map(p=>({x:p.x,y:p.y}));
  return [{x:a.x,y:a.y}, ...pts, {x:b.x,y:b.y}];
}
function pathLengthPx(path){
  let L=0;
  for(let i=1;i<path.length;i++) L+=Math.hypot(path[i].x-path[i-1].x, path[i].y-path[i-1].y);
  return L;
}
function pathMidpoint(path){
  const total=pathLengthPx(path);
  let half=total/2, acc=0;
  for(let i=1;i<path.length;i++){
    const seg=Math.hypot(path[i].x-path[i-1].x, path[i].y-path[i-1].y);
    if(acc+seg>=half){ const t=seg? (half-acc)/seg:0; return { x:path[i-1].x+(path[i].x-path[i-1].x)*t, y:path[i-1].y+(path[i].y-path[i-1].y)*t }; }
    acc+=seg;
  }
  return path[Math.floor(path.length/2)]||{x:0,y:0};
}
/* offset a polyline sideways by `off` px (per-vertex averaged normals) */
function offsetPath(path, off){
  if(!path || path.length<2) return (path||[]).map(p=>p.x+','+p.y).join(' ');
  const out=[];
  for(let i=0;i<path.length;i++){
    let nx=0,ny=0,cnt=0;
    if(i>0){ const dx=path[i].x-path[i-1].x, dy=path[i].y-path[i-1].y, l=Math.hypot(dx,dy)||1; nx+=-dy/l; ny+=dx/l; cnt++; }
    if(i<path.length-1){ const dx=path[i+1].x-path[i].x, dy=path[i+1].y-path[i].y, l=Math.hypot(dx,dy)||1; nx+=-dy/l; ny+=dx/l; cnt++; }
    if(cnt){ const l=Math.hypot(nx,ny)||1; nx/=l; ny/=l; }
    out.push((path[i].x+nx*off)+','+(path[i].y+ny*off));
  }
  return out.join(' ');
}
/* real conductor colours for a cable run (hot=black/red, neutral=white, ground=green) */
const WIRE_BLACK='#23272e', WIRE_RED='#e0473c', WIRE_WHITE='#e9edf2', WIRE_GREEN='#43b25f';
function conductorsFor(conn){
  const circuit=wireCircuitFor(conn);
  const a=findComp(conn.fromId), b=findComp(conn.toId);
  const involvesSwitch=(a&&isSwitchType(a.type))||(b&&isSwitchType(b.type));
  const poles=circuit? circuit.poles : (a&&a.poles)||1;
  if(involvesSwitch){
    return [ {c:WIRE_BLACK,hot:true}, {c:WIRE_RED,hot:true}, {c:WIRE_GREEN,hot:false} ]; // line + switched leg + ground
  }
  if(poles===2){
    const needsNeutral=[a,b].some(c=>c&&['range','cooktop','walloven','dryer'].includes(c.type));
    const arr=[ {c:WIRE_BLACK,hot:true}, {c:WIRE_RED,hot:true} ];
    if(needsNeutral) arr.push({c:WIRE_WHITE,hot:false});
    arr.push({c:WIRE_GREEN,hot:false});
    return arr;
  }
  return [ {c:WIRE_BLACK,hot:true}, {c:WIRE_WHITE,hot:false}, {c:WIRE_GREEN,hot:false} ]; // hot / neutral / ground
}
function wireVoltageDrop(conn){
  const path=wirePath(conn);
  if(!path) return null;
  const lenFt=pxToFt(pathLengthPx(path));
  const circuit=wireCircuitFor(conn);
  if(!circuit) return { lenFt, gauge:'\u2014', dropV:0, dropPct:0, amps:0, volts:120 };
  const ld=circuitLoad(circuit);
  const gauge=conn.gauge||gaugeFor(circuit.amp);
  const cm=CM_BY_GAUGE[gauge]||6530;
  const amps=ld.adjAmps||0;
  const volts=ld.volts;
  const dropV = (2*K_COPPER*amps*lenFt)/cm;
  const dropPct = volts? (dropV/volts)*100 : 0;
  return { lenFt, gauge, dropV, dropPct, amps, volts };
}
function gaugeFor(amp){ return GAUGE_BY_AMP[amp]||'\u2014'; }
/* total wire length on a circuit (routed runs if present, else an estimate) */
function circuitLengthFt(circuit){
  const conns=state.connections.filter(c=>{ const cc=wireCircuitFor(c); return cc && cc.id===circuit.id; });
  if(conns.length) return conns.reduce((s,c)=>{ const p=wirePath(c); return s+(p?pxToFt(pathLengthPx(p)):0); },0);
  const panel=findComp(circuit.panelId); const devs=circuitDevices(circuit.id);
  if(!panel||!devs.length) return 0;
  let far=0; devs.forEach(d=>{ far=Math.max(far,Math.hypot(d.x-panel.x,d.y-panel.y)); });
  return pxToFt(far)*1.5; // rough home-run estimate w/ vertical drops
}
/* the cable a circuit needs: type, conductors and ground size */
function cableSpec(circuit){
  const amp=circuit.amp, poles=circuit.poles;
  const gauge=gaugeFor(amp);
  const n=(gauge.match(/\d+/)||['?'])[0];
  const sub=subpanelFedBy(circuit.id);
  const devs=circuitDevices(circuit.id);
  const needsNeutral = poles===2 ? devs.some(d=>['range','cooktop','walloven','dryer'].includes(d.type)) : true;
  const gndSize = amp<=15?'14':amp<=20?'12':amp<=60?'10':amp<=100?'8':'6';
  let label, conductors;
  if(sub){
    label=`${n}-3 + #${gndSize} grd (feeder)`;
    conductors=[{c:WIRE_BLACK,role:'L1 hot',size:n},{c:WIRE_RED,role:'L2 hot',size:n},{c:WIRE_WHITE,role:'neutral',size:n},{c:WIRE_GREEN,role:'ground',size:gndSize}];
  } else if(poles===2 && needsNeutral){
    label=`${n}-3 NM-B`;
    conductors=[{c:WIRE_BLACK,role:'hot L1',size:n},{c:WIRE_RED,role:'hot L2',size:n},{c:WIRE_WHITE,role:'neutral',size:n},{c:WIRE_GREEN,role:'ground',size:gndSize}];
  } else if(poles===2){
    label=`${n}-2 NM-B (240V)`;
    conductors=[{c:WIRE_BLACK,role:'hot L1',size:n},{c:WIRE_RED,role:'hot L2',size:n},{c:WIRE_GREEN,role:'ground',size:gndSize}];
  } else {
    label=`${n}-2 NM-B`;
    conductors=[{c:WIRE_BLACK,role:'hot',size:n},{c:WIRE_WHITE,role:'neutral',size:n},{c:WIRE_GREEN,role:'ground',size:gndSize}];
  }
  return { gauge, label, conductors, groundSize:gndSize, lenFt:circuitLengthFt(circuit), amp, poles };
}
/* where a circuit goes in the house (room summary from the floor plan) */
function circuitDestination(circuit){
  const sub=subpanelFedBy(circuit.id);
  if(sub) return '\u2192 '+sub.label;
  const devs=circuitDevices(circuit.id);
  if(!devs.length) return 'no loads yet';
  const rooms={}; devs.forEach(d=>{ const r=(d.room||'').trim()||'unassigned'; rooms[r]=(rooms[r]||0)+1; });
  const top=Object.entries(rooms).sort((a,b)=>b[1]-a[1]);
  return `${top[0][0]}${top.length>1?' +'+(top.length-1):''}`;
}

/* ============================================================
   CRUD
   ============================================================ */
function addComponent(type,x,y){
  const d=libDef(type);
  // only one main panel
  if(type==='panel' && getMainPanel()){
    showToast('There is already a main panel. Add a Sub-Panel instead.');
    return;
  }
  pushUndo();
  const p=snap({x,y});
  const comp={
    id:state.counters.comp++, type, x:p.x, y:p.y, rot:0,
    label:d.label, room:'', notes:'',
    watts:d.watts, v:d.v, poles:d.poles,
    cont:!!d.cont, gfci:!!d.gfci, afci:false,
    circuitId: isPanelType(type)? null : ui.activeCircuit,
    feedFromId:null,
  };
  if(isPanelType(type)){
    comp.spaces=type==='subpanel'?12:30;
    comp.mainAmp=type==='subpanel'?100:200;
    comp.busAmp=comp.mainAmp;
    comp.isMain=type==='panel';
    comp.fedByCircuitId=null;
    comp.circuitId=null;
  }
  if(isNodeType(type) && !isPanelType(type)){ comp.maxAmps=d.maxAmps||20; }
  if(isSwitchType(type)) comp.on=true;
  state.components.push(comp);
  ui.selectedId=comp.id; ui.selectedWallId=null; ui.selectedConnId=null;
  invalidateLive(); renderAll(); markDirty();
}
function deleteComponent(id){
  const comp=findComp(id);
  if(!comp) return;
  if(comp.type==='panel'){ showToast('The main panel cannot be deleted.'); return; }
  pushUndo();
  // detach children
  state.components.forEach(c=>{ if(c.feedFromId===id) c.feedFromId=null; });
  if(comp.type==='subpanel'){
    // remove that subpanel's circuits + reassign its devices to nothing
    const subCircuits=panelCircuits(id).map(c=>c.id);
    state.components.forEach(c=>{ if(subCircuits.includes(c.circuitId)) c.circuitId=null; });
    state.circuits=state.circuits.filter(c=>c.panelId!==id);
  }
  state.components=state.components.filter(c=>c.id!==id);
  state.connections=state.connections.filter(c=>c.fromId!==id && c.toId!==id);
  if(ui.selectedId===id) ui.selectedId=null;
  renderAll(); markDirty();
}
function duplicateComponent(id){
  const c=findComp(id);
  if(!c || isPanelType(c.type)) { if(c&&isPanelType(c.type)) showToast('Panels are unique \u2014 not duplicated.'); return; }
  pushUndo();
  const copy=clone(c);
  copy.id=state.counters.comp++;
  copy.x+=GRID; copy.y+=GRID;
  copy.feedFromId=null;
  state.components.push(copy);
  ui.selectedId=copy.id;
  renderAll(); markDirty();
}
function deleteWall(id){
  pushUndo();
  state.walls=state.walls.filter(w=>w.id!==id);
  if(ui.selectedWallId===id) ui.selectedWallId=null;
  renderAll(); markDirty();
}
function deleteConnection(id){
  pushUndo();
  state.connections=state.connections.filter(c=>c.id!==id);
  if(ui.selectedConnId===id) ui.selectedConnId=null;
  renderAll(); markDirty();
}
function addCircuit(panelId){
  panelId = panelId || (getMainPanel()? getMainPanel().id : (getPanels()[0]&&getPanels()[0].id));
  if(!panelId){ showToast('Add a panel first.'); return; }
  pushUndo();
  const id=state.counters.circuit++;
  const color=PALETTE[(state.circuits.length)%PALETTE.length];
  const slot=findFreeSlot(panelId,1)||1;
  state.circuits.push({ id, panelId, name:'Circuit '+id, amp:15, poles:1, color, breakerOn:true, slot, breakerType:'std' });
  ui.activeCircuit=id;
  renderAll(); markDirty();
}
function removeCircuit(id){
  const circuit=getCircuit(id);
  if(!circuit) return;
  if(state.circuits.length<=1){ showToast('Keep at least one circuit.'); return; }
  if(circuitDevices(id).length){ showToast('Move or delete this circuit\u2019s devices first.'); return; }
  if(subpanelFedBy(id)){ showToast('This breaker feeds a sub-panel. Detach it first.'); return; }
  pushUndo();
  state.circuits=state.circuits.filter(c=>c.id!==id);
  if(ui.activeCircuit===id) ui.activeCircuit=state.circuits[0].id;
  renderAll(); markDirty();
}
function toggleBreaker(id){ const c=getCircuit(id); if(!c) return; pushUndo(); c.breakerOn=!c.breakerOn; invalidateLive(); renderAll(); markDirty(); }
function toggleMain(panelId){ const p=findComp(panelId)||getMainPanel(); if(!p) return; pushUndo(); p.mainOn=p.mainOn===false?true:false; invalidateLive(); renderAll(); markDirty(); }
function toggleSwitch(id){ const c=findComp(id); if(!c||!isSwitchType(c.type)) return; pushUndo(); c.on=!switchOn(c); invalidateLive(); renderAll(); markDirty(); }

/* ---- wiring ---- */
function wireCircuitFor(conn){
  const a=findComp(conn.fromId), b=findComp(conn.toId);
  if(!a||!b) return null;
  const ca=a.circuitId?getCircuit(a.circuitId):null;
  const cb=b.circuitId?getCircuit(b.circuitId):null;
  if(ca&&cb&&ca.id!==cb.id) return null;
  return ca||cb||null;
}
function wireColor(conn){
  const c=wireCircuitFor(conn);
  return c? c.color : '#5d7396';
}
function tryConnect(aId,bId,points){
  const a=findComp(aId), b=findComp(bId);
  if(!a||!b) return;
  const exists=state.connections.some(c=>(c.fromId===aId&&c.toId===bId)||(c.fromId===bId&&c.toId===aId));
  if(exists){ showToast('Already connected.'); return; }
  const pts=(points||[]).map(p=>({x:p.x,y:p.y}));
  // a splitter/panel can connect to anything on the same feed; devices connect within a circuit or to panel/splitter
  const aPanel=isPanelType(a.type), bPanel=isPanelType(b.type);
  const aSplit=a.type==='splitter', bSplit=b.type==='splitter';
  const sameCircuit=a.circuitId!=null && b.circuitId!=null && a.circuitId===b.circuitId;
  // auto-assign: wiring a device to a splitter sets feedFromId + matches circuit
  if((aSplit||bSplit) && !aPanel && !bPanel){
    const split=aSplit?a:b, dev=aSplit?b:a;
    if(!isPanelType(dev.type) && dev.type!=='splitter'){
      pushUndo();
      dev.feedFromId=split.id;
      if(split.circuitId) dev.circuitId=split.circuitId;
      state.connections.push({ id:state.counters.conn++, fromId:aId, toId:bId, gauge:null, points:pts, run:'wall' });
      return;
    }
  }
  if(!sameCircuit && !aPanel && !bPanel && !aSplit && !bSplit){
    showToast('Wire devices on the same circuit, or to a panel / splitter.');
    return;
  }
  pushUndo();
  state.connections.push({ id:state.counters.conn++, fromId:aId, toId:bId, gauge:null, points:pts, run:'wall' });
}

/* ---- tools / tabs ---- */
function setTool(t,placeType){
  ui.tool=t; ui.placeType=placeType||null;
  ui.pendingWireFrom=null; ui.wireDraft=null; ui.wirePreview=null; ui.wallDraftStart=null; ui.wallPreviewPoint=null;
  const c=svgEl();
  c.classList.toggle('select-mode', t==='select');
  c.classList.toggle('pan-mode', t==='pan');
  renderToolbar(); renderPartLibrary(); renderCanvas(); updateHint();
}
function setTab(tab){
  ui.tab=tab;
  document.getElementById('floorplanView').style.display = tab==='floorplan'?'flex':'none';
  document.getElementById('panelsView').style.display = tab==='panels'?'block':'none';
  document.getElementById('loadsView').style.display = tab==='loads'?'block':'none';
  document.getElementById('learnView').style.display = tab==='learn'?'block':'none';
  document.getElementById('acView').style.display = tab==='acwiring'?'block':'none';
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.getElementById('toolbar').style.display = tab==='floorplan'?'flex':'none';
  if(tab==='panels') renderPanelsTab();
  if(tab==='loads') renderLoadsTab();
  if(tab==='learn') renderLearnTab();
  if(tab==='acwiring') renderACTab();
  updateCoach();
}
function updateHint(){
  const h=document.getElementById('canvasHint');
  const map={
    select:'Select \u00b7 click to inspect, drag to move, right-click for options. Scroll to zoom, drag empty space or hold Space to pan.',
    wire:'Wire \u00b7 click a part to start, click open space to drop bend points through walls/ceilings, then click the target part. Esc cancels.',
    wall:'Wall \u00b7 click each corner. Double-click or Esc to finish the run.',
    pan:'Pan \u00b7 drag to move the view. Scroll to zoom.',
  };
  let txt = ui.tool==='place' ? ('Placing '+esc(libDef(ui.placeType).label)+' \u00b7 click the grid to drop it. Esc to cancel.') : (map[ui.tool]||'');
  h.textContent=txt; h.style.display= txt? 'block':'none';
}

/* ============================================================
   ICON DRAWING
   ============================================================ */
/* ============================================================
   REALISTIC COMPONENT RENDERER  (EU technical-illustration style)
   ------------------------------------------------------------
   A registry of drop-in drawing functions consulted by iconInner()
   BEFORE its built-in switch. Each renderer returns an SVG string in
   the same -20..20 local coordinate space the app already uses, so
   rotation, scaling, selection rings, badges, wiring anchors and
   hit-testing all keep working unchanged. Toggle with the "Real"
   checkbox in the toolbar (state.settings.realistic).

   To add a new realistic component later:
     1. (optional) add a part to LIBRARY with a `shape`
     2. add REAL_RENDER['type:<type>'] or REAL_RENDER['<shape>']
     3. add COMPONENT_INFO['<type>'] for the hover/click detail card
   Nothing else needs to change.
   ============================================================ */

/* ---- tiny shared drawing helpers (screws, glands, LEDs, chips) ---- */
const R = {
  screw:(x,y,r)=>{ r=r||1.15; return `<circle cx="${x}" cy="${y}" r="${r}" fill="#c9ced6" stroke="#6d747e" stroke-width="0.5"/><line x1="${x-r*0.62}" y1="${y+r*0.62}" x2="${x+r*0.62}" y2="${y-r*0.62}" stroke="#6d747e" stroke-width="0.55"/>`; },
  gland:(x,y)=>`<rect x="${x-1.9}" y="${y}" width="3.8" height="2.4" rx="0.9" fill="#3a3f45"/><rect x="${x-1.25}" y="${y+2.1}" width="2.5" height="2.1" rx="0.8" fill="#23262b"/>`,
  led:(x,y,lit,col)=>{ col=col||'#5fd394'; return `<circle cx="${x}" cy="${y}" r="1.35" fill="${lit?col:'#3a4658'}"/>${lit?`<circle cx="${x}" cy="${y}" r="2.7" fill="${col}" opacity="0.35"/>`:''}`; },
  chip:(glyph,color,cx,cy)=>{ if(!glyph) return ''; const w=glyph.length*3.7+4.4;
    const x=(cx===undefined)? 19.5-w : cx, y=(cy===undefined)? -19.5 : cy;
    return `<rect x="${x}" y="${y}" width="${w}" height="6.8" rx="1.7" fill="#0d1420" stroke="${color}" stroke-width="0.7" opacity="0.93"/><text x="${x+w/2}" y="${y+5}" font-size="5" font-weight="700" fill="${color}" text-anchor="middle">${esc(glyph)}</text>`; },
  vfins:(x0,y0,x1,y1,step,stroke)=>{ let s=''; for(let x=x0;x<=x1;x+=step) s+=`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="${stroke||'#7d848d'}" stroke-width="0.45"/>`; return s; },
  hslats:(x,y,w,n,gap,stroke)=>{ let s=''; for(let i=0;i<n;i++) s+=`<line x1="${x}" y1="${y+i*gap}" x2="${x+w}" y2="${y+i*gap}" stroke="${stroke||'#8a919b'}" stroke-width="0.7" stroke-linecap="round"/>`; return s; },
  feet:(y,xs)=>xs.map(x=>`<rect x="${x-2.2}" y="${y}" width="4.4" height="2.4" rx="0.8" fill="#3a3f45"/>`).join('')
};

/* ---- the renderer registry ----------------------------------------
   key priority: 'type:<comp.type>'  >  '<shape>'
   each fn: (color, comp, opts, glyph) => svg string                    */
const REAL_RENDER = {};

/* -------- 1. HVAC outdoor unit (condenser / heat pump / VRF) ------- */
REAL_RENDER['ac'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  const d=libDef(comp.type)||{};
  const indoor = d.split==='indoor';
  const windowAC = comp.type==='ac';                 // window unit
  if(indoor) return realIndoorUnit(color, lit, glyph);
  if(windowAC) return realWindowAC(color, lit, glyph);
  return realOutdoorUnit(color, lit, glyph, !!d.phase3);
};

function realOutdoorUnit(color, lit, glyph, three){
  const spin = lit? '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.9s" repeatCount="indefinite"/>' : '';
  const blade = a=>`<path d="M0,-1.4 Q5.6,-4.6 7.4,-1.2 Q4.4,2.4 0,1.4 Z" fill="#aeb5bd" transform="rotate(${a})"/>`;
  return `
    <rect x="-19" y="-13" width="38" height="25" rx="2.2" fill="url(#realCase)" stroke="#565e69" stroke-width="1.1"/>
    <rect x="-18.2" y="-12.2" width="36.4" height="2.6" rx="1.1" fill="#ffffff" opacity="0.45"/>
    ${R.hslats(-17,-10.6,10,2,1.7,'#9aa1ab')}
    <rect x="-18.2" y="-8" width="7.6" height="18.6" fill="#9aa1ab" stroke="#7d848d" stroke-width="0.6"/>
    ${R.vfins(-17.6,-7.4,-11.2,10,1.05)}
    <circle cx="4" cy="0.5" r="9.6" fill="url(#realFan)" stroke="#565e69" stroke-width="0.8"/>
    <g transform="translate(4,0.5)"><g>${spin}${blade(0)}${blade(120)}${blade(240)}</g><circle r="1.7" fill="#cfd6df" stroke="#6d747e" stroke-width="0.4"/></g>
    <g stroke="#c3c9d1" stroke-width="0.55" fill="none">
      <circle cx="4" cy="0.5" r="4.4"/><circle cx="4" cy="0.5" r="7"/><circle cx="4" cy="0.5" r="9.2"/>
      <line x1="4" y1="-8.7" x2="4" y2="9.7"/><line x1="-5.2" y1="0.5" x2="13.2" y2="0.5"/>
    </g>
    <rect x="14.2" y="-9.6" width="4.2" height="9.4" rx="0.9" fill="#d6dade" stroke="#8a919b" stroke-width="0.6"/>
    ${R.screw(16.3,-8.2,0.85)}${R.led(16.3,-2,lit)}
    <circle cx="15.2" cy="4.2" r="1.5" fill="url(#realBrass)" stroke="#8a6a2a" stroke-width="0.5"/>
    <circle cx="15.2" cy="8"   r="1.5" fill="url(#realBrass)" stroke="#8a6a2a" stroke-width="0.5"/>
    <rect x="-8.5" y="8.6" width="10" height="3" rx="0.6" fill="#e8ebef" stroke="#9aa1ab" stroke-width="0.5"/>
    <line x1="-7.6" y1="9.7" x2="0.6" y2="9.7" stroke="#9aa1ab" stroke-width="0.5"/><line x1="-7.6" y1="10.7" x2="-1.4" y2="10.7" stroke="#9aa1ab" stroke-width="0.5"/>
    ${R.gland(16.3,12.1)}
    ${R.feet(12.2,[-14,10])}
    ${three?`<text x="-14" y="-14.6" font-size="4.6" font-weight="700" fill="#9f7aea">3~400V</text>`:''}
    ${R.chip(glyph,color)}`;
}

function realIndoorUnit(color, lit, glyph){
  return `
    <rect x="-19" y="-14" width="38" height="1.6" rx="0.8" fill="#3a4658"/>
    <rect x="-18" y="-9.5" width="36" height="15.5" rx="6" fill="url(#realWhite)" stroke="#b9bec6" stroke-width="1"/>
    <rect x="-16.5" y="-8.4" width="33" height="3" rx="1.5" fill="#ffffff" opacity="0.7"/>
    <line x1="-15" y1="-1.4" x2="15" y2="-1.4" stroke="#ccd1d8" stroke-width="0.6"/>
    <rect x="9.5" y="-6.2" width="6.4" height="4.2" rx="1" fill="#0d1420" stroke="#8a919b" stroke-width="0.5"/>
    <text x="12.7" y="-2.9" font-size="3.4" font-weight="700" fill="${lit?'#63d6f0':'#3a4658'}" text-anchor="middle">21.5</text>
    ${R.led(6.6,-4.1,lit,'#63d6f0')}
    <rect x="-15" y="1.4" width="26" height="2.8" rx="1.4" fill="#d6dade" stroke="#a7adb6" stroke-width="0.5"/>
    ${lit?`<g stroke="#63b3ed" stroke-width="0.8" opacity="0.75" fill="none">
      <path d="M -9 6 q 1.4 2.4 0 4.8"><animate attributeName="opacity" values="0.75;0.15;0.75" dur="1.4s" repeatCount="indefinite"/></path>
      <path d="M -1 6 q 1.4 2.4 0 4.8"><animate attributeName="opacity" values="0.15;0.75;0.15" dur="1.4s" repeatCount="indefinite"/></path>
      <path d="M 7 6 q 1.4 2.4 0 4.8"><animate attributeName="opacity" values="0.45;0.75;0.45" dur="1.4s" repeatCount="indefinite"/></path></g>`:''}
    ${R.chip(glyph,color,undefined,-19)}`;
}

function realWindowAC(color, lit, glyph){
  const spinDash = lit? `<animate attributeName="stroke-dashoffset" values="0;-8" dur="0.8s" repeatCount="indefinite"/>`:'';
  return `
    <rect x="-16" y="-11" width="32" height="22" rx="2" fill="url(#realCase)" stroke="#565e69" stroke-width="1.1"/>
    <rect x="-14.4" y="-9.2" width="19" height="18.4" rx="1" fill="#e8ebef" stroke="#a7adb6" stroke-width="0.5"/>
    ${R.hslats(-13.2,-7.4,16.6,8,2.05)}
    <rect x="6" y="-9.2" width="8.6" height="18.4" rx="1" fill="#d6dade" stroke="#a7adb6" stroke-width="0.5"/>
    <circle cx="10.3" cy="-4.4" r="2.3" fill="#f2f4f7" stroke="#8a919b" stroke-width="0.6" stroke-dasharray="1.4 1.4">${spinDash}</circle>
    <line x1="10.3" y1="-4.4" x2="10.3" y2="-6.4" stroke="#565e69" stroke-width="0.7"/>
    <circle cx="10.3" cy="2.6" r="2.3" fill="#f2f4f7" stroke="#8a919b" stroke-width="0.6"/>
    <line x1="10.3" y1="2.6" x2="11.9" y2="1.4" stroke="#565e69" stroke-width="0.7"/>
    ${R.led(10.3,7.6,lit)}
    ${R.chip(glyph,color)}`;
}

/* -------- 2. Motor / pump family (TEFC motor, EU style) ------------ */
REAL_RENDER['motor'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  const pump = /pump|disposal/.test(comp.type||'');
  const spin = lit? '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.7s" repeatCount="indefinite"/>':'';
  const body = `
    <rect x="-17.5" y="-9.5" width="7.6" height="19" rx="3" fill="#aeb5bd" stroke="#6d747e" stroke-width="0.9"/>
    <g transform="translate(-13.7,0)"><g>${spin}
      ${[0,45,90,135].map(a=>`<line x1="-4.6" y1="0" x2="4.6" y2="0" stroke="#565e69" stroke-width="0.9" transform="rotate(${a})"/>`).join('')}
    </g><circle r="1.3" fill="#cfd6df"/></g>
    <circle cx="-13.7" cy="0" r="5.4" fill="none" stroke="#6d747e" stroke-width="0.8"/>
    <rect x="-10" y="-8.2" width="19.6" height="16.4" rx="1.6" fill="url(#realCyl)" stroke="#565e69" stroke-width="1"/>
    ${R.vfins(-8.6,-7.4,8.6,7.4,1.7,'#8a919b')}
    <rect x="-5.4" y="-14.2" width="9.6" height="6.4" rx="1.1" fill="#d6dade" stroke="#8a919b" stroke-width="0.7"/>
    ${R.screw(-3.4,-11,0.85)}${R.screw(2.2,-11,0.85)}
    <rect x="4.2" y="-12.4" width="3.4" height="2.4" rx="0.9" fill="#3a3f45"/>
    ${R.led(-0.6,-5.6,lit)}
    ${R.feet(9.6,[-6.5,5.5])}`;
  const drive = pump ? `
    <circle cx="14" cy="0" r="6" fill="url(#realCase)" stroke="#565e69" stroke-width="1"/>
    <circle cx="14" cy="0" r="3" fill="none" stroke="#8a919b" stroke-width="0.7"/>
    ${R.screw(14,-4.4,0.75)}${R.screw(17.8,2.2,0.75)}${R.screw(10.2,2.2,0.75)}
    <rect x="12.6" y="-12.6" width="2.8" height="6.8" fill="#9aa1ab" stroke="#6d747e" stroke-width="0.6"/>
    <rect x="11.9" y="-13.8" width="4.2" height="1.6" rx="0.5" fill="#7d848d"/>` : `
    <rect x="9.6" y="-1.6" width="5.4" height="3.2" fill="#8a919b" stroke="#565e69" stroke-width="0.5"/>
    <rect x="15" y="-2.4" width="1.6" height="4.8" rx="0.5" fill="#6d747e"/>`;
  return body + drive + R.chip(glyph,color);
};

/* -------- 3. Electric heat (furnace cabinet / baseboard) ------------ */
REAL_RENDER['heat'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  if(comp.type==='baseboard') return `
    <line x1="-20" y1="-7.5" x2="20" y2="-7.5" stroke="#3a4658" stroke-width="1.2"/>
    <rect x="-19" y="-5.5" width="38" height="11" rx="1.4" fill="url(#realWhite)" stroke="#b9bec6" stroke-width="1"/>
    <rect x="-16.5" y="-3.2" width="30" height="6" rx="0.8" fill="${lit?'#3a2a22':'#232a36'}"/>
    ${R.vfins(-15.6,-2.6,12.8,2.4,1.5, lit?'#ff8a5b':'#4a5468')}
    ${lit?`<rect x="-16.5" y="-3.2" width="30" height="6" rx="0.8" fill="#ff7a3c" opacity="0.18"><animate attributeName="opacity" values="0.18;0.32;0.18" dur="1.6s" repeatCount="indefinite"/></rect>`:''}
    <rect x="14.2" y="-4.6" width="4" height="8.6" rx="0.8" fill="#e8ebef" stroke="#a7adb6" stroke-width="0.6"/>
    ${R.screw(16.2,-2.6,0.8)}${R.gland(16.2,5.6)}
    ${R.chip(glyph,color)}`;
  return `
    <rect x="-13" y="-15" width="26" height="30" rx="2" fill="url(#realCase)" stroke="#565e69" stroke-width="1.1"/>
    ${R.hslats(-10.5,-12.6,21,3,2,'#9aa1ab')}
    <rect x="-10.5" y="-5" width="21" height="17" rx="1.4" fill="#e8ebef" stroke="#a7adb6" stroke-width="0.7"/>
    ${R.screw(-8.4,-3,0.8)}${R.screw(8.4,-3,0.8)}${R.screw(-8.4,9.9,0.8)}${R.screw(8.4,9.9,0.8)}
    <path d="M-6.6,8 L-6.6,-1 L-3.3,5 L0,-1 L3.3,5 L6.6,-1 L6.6,8" fill="none" stroke="${lit?'#ff8a5b':'#8a919b'}" stroke-width="1.5" stroke-linejoin="round"/>
    ${lit?`<path d="M-6.6,8 L-6.6,-1 L-3.3,5 L0,-1 L3.3,5 L6.6,-1 L6.6,8" fill="none" stroke="#ffb27a" stroke-width="0.6" stroke-linejoin="round"><animate attributeName="opacity" values="1;0.3;1" dur="1.3s" repeatCount="indefinite"/></path>`:''}
    ${R.led(8.7,-8.6,lit,'#f0a830')}${R.gland(0,15.2)}
    ${R.chip(glyph,color)}`;
};

/* -------- 4. Hot-water plant (unvented cylinder / tankless) --------- */
REAL_RENDER['water'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  if(comp.type==='tankless') return `
    <rect x="-11" y="-14" width="22" height="24" rx="2.4" fill="url(#realWhite)" stroke="#b9bec6" stroke-width="1"/>
    <rect x="-8.5" y="-11.5" width="17" height="6.4" rx="1.2" fill="#0d1420" stroke="#8a919b" stroke-width="0.5"/>
    <text x="0" y="-6.7" font-size="3.6" font-weight="700" fill="${lit?'#63d6f0':'#3a4658'}" text-anchor="middle">55&#176;C</text>
    <circle cx="0" cy="2.6" r="3.4" fill="#e8ebef" stroke="#a7adb6" stroke-width="0.7"/><line x1="0" y1="2.6" x2="0" y2="-0.2" stroke="#565e69" stroke-width="0.8"/>
    ${R.led(7.4,3,lit)}
    <rect x="-7.4" y="10" width="2.8" height="5" fill="#2b6fe0" opacity="0.85"/><rect x="4.6" y="10" width="2.8" height="5" fill="#e0473c" opacity="0.85"/>
    ${R.gland(0,10.2)}
    ${R.chip(glyph,color)}`;
  return `
    <path d="M -9 -8 A 9 6.5 0 0 1 9 -8 L 9 10 A 9 5.5 0 0 1 -9 10 Z" fill="url(#realCylV)" stroke="#b9bec6" stroke-width="1"/>
    <ellipse cx="0" cy="-8" rx="9" ry="6.5" fill="url(#realWhite)" stroke="#b9bec6" stroke-width="1"/>
    <rect x="-3.6" y="1.6" width="9" height="6" rx="1" fill="#d6dade" stroke="#8a919b" stroke-width="0.7"/>
    ${R.screw(-1.8,3.2,0.75)}${R.screw(3.6,6,0.75)}${R.gland(0.9,7.8)}
    <rect x="8.6" y="-6.4" width="4.4" height="2.4" rx="0.7" fill="url(#realBrass)" stroke="#8a6a2a" stroke-width="0.5"/>
    <line x1="12.4" y1="-6.6" x2="14.6" y2="-9" stroke="#8a6a2a" stroke-width="1"/>
    <rect x="-2" y="-16.8" width="3" height="3.6" fill="#e0473c" opacity="0.85"/>
    <rect x="8.8" y="7.4" width="4.6" height="2.6" fill="#2b6fe0" opacity="0.85"/>
    <rect x="-7" y="11.4" width="14" height="2.2" rx="1" fill="#8a919b"/>
    <text x="-0.2" y="-6.2" font-size="3.2" font-weight="700" fill="#8a919b" text-anchor="middle">200 L</text>
    ${R.led(-5.6,4.6,lit,'#f0a830')}
    ${R.chip(glyph,color)}`;
};

/* -------- 5. EU rotary isolator (disconnect) ------------------------ */
REAL_RENDER['disconnect'] = function(color, comp, opts, glyph){
  const on=!!(opts&&opts.powered);
  return `
    <rect x="-12.5" y="-14.5" width="25" height="29" rx="2.6" fill="url(#realWhite)" stroke="#adb4be" stroke-width="1.1"/>
    <rect x="-10.6" y="-12.6" width="21.2" height="25.2" rx="1.8" fill="none" stroke="#ccd1d8" stroke-width="0.7"/>
    ${R.screw(-9.4,-11.4)}${R.screw(9.4,-11.4)}${R.screw(-9.4,11.4)}${R.screw(9.4,11.4)}
    <rect x="-7" y="-8" width="14" height="14" rx="2" fill="#f0c000" stroke="#b98f00" stroke-width="0.8"/>
    <text x="0" y="-9.6" font-size="3.6" font-weight="700" fill="#565e69" text-anchor="middle">${on?'I  ON':'O  OFF'}</text>
    <g transform="rotate(${on?0:90} 0 -1)">
      <rect x="-1.9" y="-7.2" width="3.8" height="12.4" rx="1.6" fill="#d6452f" stroke="#8f1f14" stroke-width="0.7"/>
      <circle cx="0" cy="-1" r="1.2" fill="#8f1f14"/>
    </g>
    ${R.gland(-4.5,14.6)}${R.gland(4.5,14.6)}
    ${R.led(9.2,8.4,on)}
    ${R.chip(glyph,color)}`;
};

/* -------- batch 2/4: EU control & protection gear (photo-real) -------
   Modeled on real EU products: RAL-7035 module bodies with bevel
   shading, printed ratings, sealing flags, RCD toroid diagram, Finder
   style relay internals, WAGO/Phoenix terminal details, Danfoss KP
   pressure switch. Switch-type parts receive opts.on / opts.powered. */

/* shared: DIN rail with slotted holes */
R.din = (y=1)=>`
    <rect x="-19" y="${y}" width="38" height="7" rx="0.8" fill="url(#realCyl)"/>
    <line x1="-19" y1="${y+0.7}" x2="19" y2="${y+0.7}" stroke="#e8ecf0" stroke-width="0.7"/>
    <line x1="-19" y1="${y+6.3}" x2="19" y2="${y+6.3}" stroke="#5c636c" stroke-width="0.7"/>
    ${[-15,-5,5,15].map(x=>`<rect x="${x-2.2}" y="${y+2.1}" width="4.4" height="2.8" rx="1.3" fill="#7d848d" opacity="0.85"/>`).join('')}`;

/* shared: cage-clamp terminal opening with screw */
R.cage = (x,y)=>`
    <rect x="${x-2.9}" y="${y-2.4}" width="5.8" height="4.8" rx="0.7" fill="#23262b"/>
    <rect x="${x-2.9}" y="${y-2.4}" width="5.8" height="1.1" fill="#3a3f45"/>
    <circle cx="${x}" cy="${y+0.3}" r="1.7" fill="#c9ced4"/><circle cx="${x}" cy="${y+0.3}" r="1.7" fill="none" stroke="#565e69" stroke-width="0.45"/>
    <rect x="${x-1.25}" y="${y-0.05}" width="2.5" height="0.7" rx="0.3" fill="#454b53" transform="rotate(38 ${x} ${y+0.3})"/>`;

/* shared: EU module body with bevel light, w = half-width */
R.modBody = (hw,h0,h1)=>`
    <rect x="${-hw-0.7}" y="${h0+0.7}" width="${hw*2+1.4}" height="${h1-h0}" rx="1.8" fill="#000" opacity="0.16"/>
    <rect x="${-hw}" y="${h0}" width="${hw*2}" height="${h1-h0}" rx="1.8" fill="url(#euMod)" stroke="#9aa1a8" stroke-width="0.7"/>
    <rect x="${-hw+0.7}" y="${h0+0.8}" width="1.4" height="${h1-h0-1.6}" rx="0.7" fill="#ffffff" opacity="0.55"/>
    <rect x="${hw-2}" y="${h0+0.8}" width="1.3" height="${h1-h0-1.6}" rx="0.6" fill="#7d848d" opacity="0.35"/>`;

/* -------- MCB — Hager/ABB-style 1P miniature breaker ----------------- */
function realDinBreaker(color, opts, cfg){
  const on = opts && opts.on!==false;
  const lit = !!(opts && opts.powered);
  const hw = cfg.rcd? 9.5 : 7.5;
  let s = R.din(1.5);
  s += R.modBody(hw,-16,16.5);
  /* cable funnels + cage clamps */
  s+=`<rect x="-2.6" y="-20" width="5.2" height="4.2" rx="0.7" fill="#c6cbd1" stroke="#9aa1a8" stroke-width="0.5"/>
      <rect x="-1.7" y="-19.4" width="3.4" height="3" rx="0.5" fill="#31363d"/>
      <rect x="-2.6" y="16.2" width="5.2" height="3.8" rx="0.7" fill="#c6cbd1" stroke="#9aa1a8" stroke-width="0.5"/>`;
  s += R.cage(0,-13.2) + R.cage(0,13.6);
  /* face plate */
  s+=`<rect x="${-hw+1.5}" y="-9.6" width="${hw*2-3}" height="19.4" rx="0.9" fill="#eceff1" stroke="#d6dade" stroke-width="0.4"/>`;
  const lx = cfg.rcd? -4.2 : 0;
  /* lever recess + orange lever with grip ribs */
  s+=`<rect x="${lx-3.4}" y="-7.2" width="6.8" height="12.4" rx="1" fill="#b9bfc6"/>
      <rect x="${lx-3.4}" y="-7.2" width="6.8" height="12.4" rx="1" fill="none" stroke="#8a919a" stroke-width="0.45"/>
      <rect x="${lx-2.7}" y="${on?-6.7:-0.6}" width="5.4" height="6.3" rx="1" fill="url(#euOrange)" stroke="#a8500f" stroke-width="0.5"/>
      <line x1="${lx-1.6}" y1="${on?-4.4:1.7}" x2="${lx+1.6}" y2="${on?-4.4:1.7}" stroke="#a8500f" stroke-width="0.5"/>
      <line x1="${lx-1.6}" y1="${on?-3.1:3}" x2="${lx+1.6}" y2="${on?-3.1:3}" stroke="#a8500f" stroke-width="0.5"/>
      <text x="${lx}" y="${on?4.1:-2.5}" font-size="2.6" font-weight="700" fill="#565e69" text-anchor="middle">${on?'0':'I'}</text>`;
  /* contact-position window: red flag = closed, green = open */
  s+=`<rect x="${lx-1.5}" y="6.6" width="3" height="2" rx="0.4" fill="${on?'#c0392b':'#2f9e4f'}" stroke="#565e69" stroke-width="0.35"/>`;
  /* printed ratings: curve+amps, voltage, breaking-capacity box */
  s+=`<text x="${lx}" y="-10.9" font-size="3.1" font-weight="700" fill="#33475f" text-anchor="middle">B16</text>
      <text x="${lx}" y="10.9" font-size="1.8" fill="#6a7178" text-anchor="middle">230/400V~</text>
      <rect x="${lx-2.6}" y="11.7" width="5.2" height="2.9" fill="none" stroke="#8a919a" stroke-width="0.35"/>
      <text x="${lx}" y="13.4" font-size="1.7" fill="#6a7178" text-anchor="middle">6000</text>
      <line x1="${lx-2.6}" y1="13.7" x2="${lx+2.6}" y2="13.7" stroke="#8a919a" stroke-width="0.3"/>
      <text x="${lx}" y="14.55" font-size="1.05" fill="#6a7178" text-anchor="middle">3</text>`;
  if(cfg.rcd){
    /* test button + 30mA + printed toroid wiring diagram (iconic on RCDs) */
    s+=`<circle cx="4.9" cy="-3.4" r="2.5" fill="#2b6fe0" stroke="#1a4a9e" stroke-width="0.6"/>
        <circle cx="4.9" cy="-3.4" r="1.6" fill="none" stroke="#7fa4e8" stroke-width="0.4"/>
        <text x="4.9" y="-2.1" font-size="2.6" font-weight="800" fill="#fff" text-anchor="middle">T</text>
        <text x="4.9" y="2.2" font-size="2" font-weight="700" fill="#33475f" text-anchor="middle">30mA</text>
        <circle cx="4.9" cy="6.2" r="2.2" fill="none" stroke="#6a7178" stroke-width="0.5"/>
        <line x1="4.1" y1="3.2" x2="4.1" y2="9.2" stroke="#6a7178" stroke-width="0.45"/>
        <line x1="5.7" y1="3.2" x2="5.7" y2="9.2" stroke="#6a7178" stroke-width="0.45"/>
        <path d="M 7.1 4.2 l 0.9 0.9 l -0.9 0.9 l 0.9 0.9" fill="none" stroke="#6a7178" stroke-width="0.4"/>
        <text x="4.9" y="12" font-size="1.9" fill="#6a7178" text-anchor="middle">Type A</text>
        <text x="-8.2" y="-17" font-size="2" font-weight="700" fill="#2b6fe0">N</text>`;
  }
  /* sealing flag holes + DIN clip */
  s+=`<circle cx="${-hw+2.6}" cy="-11.5" r="0.55" fill="#8a919a"/><circle cx="${-hw+2.6}" cy="11.5" r="0.55" fill="#8a919a"/>
      <rect x="-2.6" y="16.9" width="5.2" height="2.8" rx="0.5" fill="#7d848d"/><rect x="-2.6" y="19.1" width="5.2" height="0.9" rx="0.4" fill="#565e69"/>`;
  s += R.led(hw-1.7,-13.6,lit&&on);
  return s;
}
REAL_RENDER['mcb']  = (color,comp,opts,glyph)=> realDinBreaker(color,opts,{rcd:false}) + R.chip(glyph,color);
REAL_RENDER['rcbo'] = (color,comp,opts,glyph)=> realDinBreaker(color,opts,{rcd:true})  + R.chip(glyph,color);

/* -------- contactor — installation contactor, 1L1..6T3 --------------- */
REAL_RENDER['contactor'] = function(color, comp, opts, glyph){
  const on = opts && opts.on!==false;
  const lit = !!(opts && opts.powered);
  const pulled = lit && on;
  let s = R.din(10.5);
  s += R.modBody(14,-14,15);
  /* terminal banks: molded labels 1L1 3L2 5L3 / 2T1 4T2 6T3 + A1/A2 */
  [-8,0,8].forEach((x,i)=>{
    s+=`<rect x="${x-2.7}" y="-18.4" width="5.4" height="4.6" rx="0.6" fill="#c6cbd1" stroke="#9aa1a8" stroke-width="0.45"/>`+R.cage(x,-11.6);
    s+=`<text x="${x}" y="-15.2" font-size="1.7" font-weight="700" fill="#454b53" text-anchor="middle">${[1,3,5][i]}L${i+1}</text>`;
    s+=`<rect x="${x-2.7}" y="13.8" width="5.4" height="4.6" rx="0.6" fill="#c6cbd1" stroke="#9aa1a8" stroke-width="0.45"/>`+R.cage(x,11.6);
    s+=`<text x="${x}" y="17.2" font-size="1.7" font-weight="700" fill="#454b53" text-anchor="middle">${[2,4,6][i]}T${i+1}</text>`;
  });
  s+=`${R.screw(-12.2,-11.6,1)}<text x="-12.2" y="-15.2" font-size="1.9" font-weight="800" fill="#b06a10" text-anchor="middle">A1</text>
      ${R.screw(-12.2,11.6,1)}<text x="-12.2" y="17.2" font-size="1.9" font-weight="800" fill="#b06a10" text-anchor="middle">A2</text>`;
  /* face: brand line, indicator slider window, AC-3 microtext */
  s+=`<rect x="-12.6" y="-7.6" width="25.2" height="15.2" rx="0.9" fill="#eceff1" stroke="#d6dade" stroke-width="0.4"/>
      <text x="-11.4" y="-4.6" font-size="2.2" font-weight="700" fill="#33475f">ESB 24-40</text>
      <text x="-11.4" y="6.9" font-size="1.7" fill="#6a7178">AC-3 \u00b7 4kW</text>
      <text x="-11.4" y="4.3" font-size="1.7" fill="#6a7178">230V~ coil</text>`;
  /* mechanical position indicator: slider shows I (red) when pulled in */
  s+=`<rect x="1.6" y="-4.9" width="9.8" height="9.8" rx="0.9" fill="#b9bfc6" stroke="#8a919a" stroke-width="0.45"/>
      <rect x="2.5" y="${pulled?-4:0.1}" width="8" height="3.9" rx="0.7" fill="${pulled?'#c0392b':'#454b53'}"/>
      <text x="6.5" y="${pulled?-1.2:2.95}" font-size="2.8" font-weight="800" fill="#fff" text-anchor="middle">${pulled?'I':'0'}</text>
      ${pulled?`<rect x="1.6" y="-4.9" width="9.8" height="9.8" rx="0.9" fill="#e8762b" opacity="0.16"><animate attributeName="opacity" values="0.16;0.05;0.16" dur="1.1s" repeatCount="indefinite"/></rect>`:''}`;
  /* side heat vents */
  [[-14,-13.1],[12.7,14]].forEach(([x0,x1])=>{ for(let i=0;i<4;i++){ const vy=-4+i*2.6; s+=`<rect x="${x0}" y="${vy}" width="${x1-x0}" height="1.1" rx="0.4" fill="#8a919a" opacity="0.6"/>`; } });
  s += R.led(11.5,-11.5,pulled);
  return s + R.chip(glyph,color);
};

/* -------- relay — Finder-style on blue socket with retaining clip ---- */
REAL_RENDER['relay'] = function(color, comp, opts, glyph){
  const on = opts && opts.on!==false;
  const lit = !!(opts && opts.powered);
  const act = lit && on;
  let s = R.din(13.5);
  /* blue socket with screw rows + pin marks */
  s+=`<rect x="-9.7" y="4.4" width="19.4" height="9.4" rx="1.3" fill="#000" opacity="0.16"/>
      <rect x="-10" y="4" width="20" height="9.6" rx="1.3" fill="url(#euSock)" stroke="#173f86" stroke-width="0.7"/>
      <rect x="-9.3" y="4.6" width="1.2" height="8.2" rx="0.6" fill="#7fa4e8" opacity="0.5"/>
      ${[-7,-2.4,2.4,7].map(x=>`<circle cx="${x}" cy="7.2" r="1.5" fill="#c9ced4" stroke="#173f86" stroke-width="0.45"/><rect x="${x-1.05}" y="6.9" width="2.1" height="0.6" rx="0.3" fill="#454b53"/>`).join('')}
      <text x="-7" y="12.3" font-size="1.7" font-weight="700" fill="#dce6f8" text-anchor="middle">11</text>
      <text x="-2.4" y="12.3" font-size="1.7" font-weight="700" fill="#dce6f8" text-anchor="middle">14</text>
      <text x="2.4" y="12.3" font-size="1.7" font-weight="700" fill="#dce6f8" text-anchor="middle">A1</text>
      <text x="7" y="12.3" font-size="1.7" font-weight="700" fill="#dce6f8" text-anchor="middle">A2</text>`;
  /* clear cover with visible internals */
  s+=`<rect x="-8.4" y="-15.6" width="16.8" height="20" rx="1.5" fill="url(#euClear)" stroke="#9fb3c8" stroke-width="0.8"/>
      <rect x="-7.6" y="-14.9" width="2.4" height="18.4" rx="1" fill="#ffffff" opacity="0.35"/>`;
  /* coil bobbin: flanges + copper winding, iron yoke, armature */
  s+=`<rect x="-6.6" y="-9.2" width="7.4" height="1.4" fill="#2f3540"/>
      <rect x="-6.6" y="-1.2" width="7.4" height="1.4" fill="#2f3540"/>
      <rect x="-5.9" y="-7.8" width="6" height="6.6" fill="url(#euCu)"/>
      ${[0,1,2,3,4].map(i=>`<line x1="-5.9" y1="${-7.2+i*1.3}" x2="0.1" y2="${-7.2+i*1.3}" stroke="#7a4415" stroke-width="0.35" opacity="0.8"/>`).join('')}
      <rect x="-6.6" y="0.2" width="10.8" height="1.6" fill="#565e69"/>
      <rect x="2.7" y="-9.4" width="1.5" height="11.2" fill="#565e69"/>`;
  /* armature + changeover contact springs */
  s+=`<line x1="-6.4" y1="${act?-10.6:-9.9}" x2="3.4" y2="${act?-9.7:-11.3}" stroke="#8f97a1" stroke-width="1.1" stroke-linecap="round"/>
      <line x1="5.2" y1="-12.4" x2="5.2" y2="1.6" stroke="#c9a24a" stroke-width="0.65"/>
      <line x1="6.9" y1="-12.4" x2="6.9" y2="1.6" stroke="#c9a24a" stroke-width="0.65"/>
      <line x1="5.2" y1="${act?-8.6:-10.2}" x2="${act?6.9:5.9}" y2="${act?-8.4:-10.2}" stroke="#8f97a1" stroke-width="0.9"/>
      <circle cx="5.2" cy="${act?-8.6:-10.2}" r="0.55" fill="#e8c97a"/><circle cx="6.9" cy="-8.4" r="0.55" fill="#e8c97a"/>`;
  /* orange test/flag lever + label */
  s+=`<rect x="4.6" y="-15" width="3.3" height="2.4" rx="0.5" fill="url(#euOrange)" stroke="#a8500f" stroke-width="0.4"/>
      <text x="0" y="3.4" font-size="1.9" font-weight="700" fill="#33475f" text-anchor="middle">55.32 \u00b7 230V~</text>`;
  /* steel retaining clip over the cover */
  s+=`<path d="M -9.4 3.2 v -13.4 q 0 -1.8 1.8 -1.8 h 2.2 M 9.4 3.2 v -13.4 q 0 -1.8 -1.8 -1.8 h -2.2" fill="none" stroke="#aeb6bf" stroke-width="0.9"/>
      <path d="M -9.4 3.2 v -13.4 q 0 -1.8 1.8 -1.8 h 2.2 M 9.4 3.2 v -13.4 q 0 -1.8 -1.8 -1.8 h -2.2" fill="none" stroke="#e8ecf0" stroke-width="0.35"/>`;
  s += R.led(-6.2,-12.6,act,'#e0473c');
  return s + R.chip(glyph,color);
};

/* -------- terminal blocks — WAGO/Phoenix rail assembly ---------------- */
REAL_RENDER['terminal'] = function(color, comp, opts, glyph){
  const lit = !!(opts && opts.powered);
  let s = R.din(5);
  const blocks=[
    {x:-16.4,c:'#c9ced4',e:'#9aa1a8',n:'1'},{x:-10.1,c:'#c9ced4',e:'#9aa1a8',n:'2'},{x:-3.8,c:'#c9ced4',e:'#9aa1a8',n:'3'},
    {x:2.5,c:'#3e6cc7',e:'#274a92',n:'N'},{x:8.8,c:'#3fae5a',e:'#2a7a3e',n:'PE',pe:true}];
  blocks.forEach(b=>{
    s+=`<rect x="${b.x}" y="-11.5" width="5.8" height="25" rx="0.9" fill="${b.c}" stroke="${b.e}" stroke-width="0.55"/>
        <rect x="${b.x+0.5}" y="-11" width="1" height="24" rx="0.5" fill="#ffffff" opacity="0.4"/>`;
    if(b.pe) s+=`<rect x="${b.x+2}" y="-11.5" width="1.8" height="25" fill="#f2c200"/>`;
    /* push-in funnels top+bottom, test point, marking tag */
    s+=`<rect x="${b.x+1.6}" y="-10.3" width="2.6" height="2.8" rx="0.5" fill="#23262b"/>
        <rect x="${b.x+1.6}" y="7.6" width="2.6" height="2.8" rx="0.5" fill="#23262b"/>
        ${R.screw(b.x+2.9,-5.2,1)}${R.screw(b.x+2.9,4.6,1)}
        <circle cx="${b.x+2.9}" cy="-0.4" r="0.6" fill="#31363d"/>
        <rect x="${b.x+0.9}" y="11" width="4" height="3.4" rx="0.5" fill="#fdfdfb" stroke="#b9bfc6" stroke-width="0.4"/>
        <text x="${b.x+2.9}" y="13.6" font-size="2.3" font-weight="700" fill="#33475f" text-anchor="middle">${b.n}</text>`;
  });
  /* red jumper comb bridging 1-2 */
  s+=`<rect x="-15" y="-8.1" width="11.2" height="1.7" rx="0.7" fill="#c0392b" stroke="#8f1f14" stroke-width="0.4"/>
      <rect x="-14.2" y="-7" width="1.4" height="1.6" fill="#8f1f14"/><rect x="-7.9" y="-7" width="1.4" height="1.6" fill="#8f1f14"/>`;
  /* metal end bracket + end plate */
  s+=`<rect x="15.4" y="-11.5" width="3" height="25" rx="0.7" fill="url(#realCyl)" stroke="#6d747e" stroke-width="0.5"/>
      ${R.screw(16.9,-7,1)}${R.screw(16.9,6.4,1)}
      <rect x="14.7" y="-11.5" width="0.9" height="25" fill="#e8e2d2" stroke="#b9ad91" stroke-width="0.3"/>`;
  s += R.led(-17.6,-13.6,lit);
  return s + R.chip(glyph,color);
};

/* -------- room thermostat — modern EU wall stat ----------------------- */
REAL_RENDER['thermostat'] = function(color, comp, opts, glyph){
  const on = opts && opts.on!==false;
  const lit = !!(opts && opts.powered);
  const disp = !lit ? '' : (on ? '21.5' : 'OFF');
  let s=`
    <rect x="-13.4" y="-13.2" width="27" height="27" rx="3.8" fill="#000" opacity="0.16"/>
    <rect x="-14" y="-14" width="28" height="28" rx="3.8" fill="url(#euMod)" stroke="#b3b9bf" stroke-width="0.9"/>
    <rect x="-12.9" y="-12.9" width="25.8" height="25.8" rx="3" fill="none" stroke="#ffffff" stroke-width="0.7" opacity="0.6"/>
    <rect x="-11.6" y="-11.6" width="23.2" height="23.2" rx="2.4" fill="#f4f6f7" stroke="#d6dade" stroke-width="0.5"/>`;
  /* LCD with segment ghosting */
  s+=`<rect x="-9.6" y="-9.4" width="19.2" height="11.4" rx="1.1" fill="${lit?'#dbe8dc':'#cfd5d4'}" stroke="#a7adb3" stroke-width="0.55"/>
      <rect x="-9.6" y="-9.4" width="19.2" height="2.6" rx="1.1" fill="#ffffff" opacity="0.25"/>
      <text x="-1.2" y="-1.6" font-size="6.2" font-weight="700" fill="#3a4a40" opacity="0.08" text-anchor="middle" style="font-family:monospace">88.8</text>
      ${disp?`<text x="-1.2" y="-1.6" font-size="6.2" font-weight="700" fill="${on?'#22392c':'#57635c'}" text-anchor="middle" style="font-family:monospace">${disp}</text>`:''}
      ${lit&&on?`<text x="6.9" y="-5.4" font-size="2.6" fill="#22392c">\u00b0C</text>
      <path d="M -7.6 -6.4 q 1.5 1.5 0 3 q -1.5 -0.55 -0.85 -1.85 q -1.05 0.2 -0.65 -1.5 q 0.95 -0.4 1.5 0.35 Z" fill="#d1622f"/>`:''}
      ${lit?`<rect x="5.6" y="-8.6" width="3" height="1.6" rx="0.3" fill="none" stroke="#57635c" stroke-width="0.35"/><rect x="8.6" y="-8.25" width="0.5" height="0.9" fill="#57635c"/><rect x="5.9" y="-8.35" width="1.7" height="1.1" fill="#57635c"/>`:''}`;
  /* buttons: - / mode / + pills */
  s+=`<rect x="-9.4" y="4.6" width="5.4" height="3.6" rx="1.8" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.5"/><text x="-6.7" y="7.3" font-size="3" font-weight="700" fill="#565e69" text-anchor="middle">\u2013</text>
      <rect x="-2.7" y="4.6" width="5.4" height="3.6" rx="1.8" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.5"/><circle cx="0" cy="6.4" r="1" fill="none" stroke="#565e69" stroke-width="0.5"/>
      <rect x="4" y="4.6" width="5.4" height="3.6" rx="1.8" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.5"/><text x="6.7" y="7.4" font-size="3" font-weight="700" fill="#565e69" text-anchor="middle">+</text>
      <text x="0" y="11.4" font-size="1.7" fill="#8a919a" text-anchor="middle">therm \u00b7 230V~</text>`;
  s += R.led(10.6,-11,lit&&on,'#e0743c');
  return s + R.chip(glyph,color);
};

/* -------- pressure switch — Danfoss KP style --------------------------- */
REAL_RENDER['pressuresw'] = function(color, comp, opts, glyph){
  const on = opts && opts.on!==false;
  const lit = !!(opts && opts.powered);
  let s=`
    <rect x="-9.2" y="-11.6" width="19" height="21.6" rx="1.8" fill="#000" opacity="0.16"/>
    <rect x="-9.6" y="-12.2" width="19" height="21.6" rx="1.8" fill="url(#euIvory)" stroke="#8f8a7a" stroke-width="0.8"/>
    <rect x="-8.9" y="-11.6" width="1.6" height="20.4" rx="0.8" fill="#ffffff" opacity="0.5"/>`;
  /* black top cap with range + differential spindles */
  s+=`<rect x="-9.6" y="-16.2" width="19" height="4.6" rx="1.2" fill="#2b2f35" stroke="#14171b" stroke-width="0.6"/>
      <circle cx="-4.4" cy="-14" r="1.9" fill="#454b53" stroke="#14171b" stroke-width="0.45"/><rect x="-5.6" y="-14.3" width="2.4" height="0.65" rx="0.3" fill="#c9ced4"/>
      <circle cx="3.4" cy="-14" r="1.9" fill="#454b53" stroke="#14171b" stroke-width="0.45"/><rect x="2.2" y="-14.3" width="2.4" height="0.65" rx="0.3" fill="#c9ced4"/>
      <text x="-4.4" y="-17.2" font-size="1.7" fill="#6a7178" text-anchor="middle">RANGE</text>
      <text x="3.4" y="-17.2" font-size="1.7" fill="#6a7178" text-anchor="middle">DIFF</text>`;
  /* printed scale plate with dual red pointers */
  s+=`<rect x="-7.4" y="-9.6" width="9.4" height="13.4" rx="0.8" fill="#fdfdfb" stroke="#b3ac98" stroke-width="0.5"/>
      ${[0,1,2,3,4,5].map(i=>`<line x1="-6.4" y1="${-8.2+i*2.2}" x2="${i%2? -4.9 : -4.2}" y2="${-8.2+i*2.2}" stroke="#6a7178" stroke-width="0.4"/>`).join('')}
      <text x="-2.4" y="-7.4" font-size="1.6" fill="#6a7178">8</text><text x="-2.4" y="-1" font-size="1.6" fill="#6a7178">4</text><text x="-2.4" y="2.6" font-size="1.6" fill="#6a7178">0</text>
      <line x1="-6.2" y1="${on?-6.2:-1.8}" x2="-0.4" y2="${on?-6.2:-1.8}" stroke="#c0392b" stroke-width="0.8"/>
      <line x1="-6.2" y1="${on?-3.4:0.6}" x2="-1.6" y2="${on?-3.4:0.6}" stroke="#e07a3c" stroke-width="0.6"/>
      <text x="-2.6" y="5.8" font-size="2" font-weight="700" fill="#33475f">KP15</text><text x="-6.8" y="5.8" font-size="1.8" fill="#6a7178">bar</text>`;
  /* terminal cover screw, gland, earth screw, manual reset */
  s+=`${R.screw(6,-8.6,1.2)}<text x="6" y="-4.9" font-size="1.6" fill="#6a7178" text-anchor="middle">cover</text>
      ${R.gland(-10,-1.6)}
      ${R.screw(6,0.6,1)}<text x="6" y="3.4" font-size="1.5" fill="#2a7a3e" text-anchor="middle">\u23DA</text>
      <rect x="4.2" y="5" width="3.6" height="2.6" rx="0.6" fill="#c0392b" stroke="#8f1f14" stroke-width="0.4"/><text x="6" y="10" font-size="1.5" fill="#6a7178" text-anchor="middle">reset</text>`;
  /* 1/4" flare + capillary coil to the pressure side */
  s+=`<rect x="-2.6" y="9.2" width="4.4" height="2.8" rx="0.5" fill="url(#realBrass)" stroke="#8a6a2a" stroke-width="0.5"/>
      <path d="M -0.4 12 v 2.4 a 3.6 3.6 0 1 0 3.6 3.6" fill="none" stroke="#8a531f" stroke-width="2.1"/>
      <path d="M -0.4 12 v 2.4 a 3.6 3.6 0 1 0 3.6 3.6" fill="none" stroke="#e0a25e" stroke-width="0.9"/>`;
  s += R.led(8,-10.8,lit&&on);
  return s + R.chip(glyph,color);
};

/* -------- batch 5: EU everyday electrics (photo-real) -----------------
   Schuko sockets, CEE 3-phase, rocker switches, rotary dimmer, PIR,
   luminaires with true glow, consumer unit, junction box, appliance
   fronts, EV wallbox with Type 2 face, detectors. Lights glow with
   opts.powered; switch shapes tilt with opts.on. */

R.glow=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#glowGrad)" opacity="0.9"/><circle cx="${x}" cy="${y}" r="${r*0.45}" fill="${c||'#fff2c8'}" opacity="0.55"/>`;
R.plate=(hw)=>`
    <rect x="${-hw-0.6}" y="${-hw-0.4}" width="${hw*2+1.2}" height="${hw*2+1.2}" rx="3.4" fill="#000" opacity="0.15"/>
    <rect x="${-hw}" y="${-hw-1}" width="${hw*2}" height="${hw*2}" rx="3.4" fill="url(#euMod)" stroke="#b3b9bf" stroke-width="0.8"/>
    <rect x="${-hw+1.1}" y="${-hw+0.1}" width="${hw*2-2.2}" height="${hw*2-2.2}" rx="2.6" fill="none" stroke="#ffffff" stroke-width="0.7" opacity="0.6"/>`;
R.schuko=(cx,cy,r,lit)=>`
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#dfe2e4" stroke="#a7adb3" stroke-width="0.7"/>
    <circle cx="${cx}" cy="${cy}" r="${r-1.1}" fill="#cfd3d6"/>
    <circle cx="${cx}" cy="${cy}" r="${r-1.1}" fill="none" stroke="#8f959b" stroke-width="0.45"/>
    <circle cx="${cx-r*0.42}" cy="${cy}" r="1.55" fill="#17191c"/><circle cx="${cx+r*0.42}" cy="${cy}" r="1.55" fill="#17191c"/>
    <rect x="${cx-2}" y="${cy-r+0.2}" width="4" height="2.4" rx="0.7" fill="#b3b9bf" stroke="#6d747b" stroke-width="0.45"/>
    <rect x="${cx-2}" y="${cy+r-2.6}" width="4" height="2.4" rx="0.7" fill="#b3b9bf" stroke="#6d747b" stroke-width="0.45"/>
    <line x1="${cx-1.1}" y1="${cy-r+1.4}" x2="${cx+1.1}" y2="${cy-r+1.4}" stroke="#565e69" stroke-width="0.5"/>
    <line x1="${cx-1.1}" y1="${cy+r-1.4}" x2="${cx+1.1}" y2="${cy+r-1.4}" stroke="#565e69" stroke-width="0.5"/>
    ${lit?`<circle cx="${cx+r-1.6}" cy="${cy-r+1.6}" r="0.9" fill="#5fd394"/>`:''}`;

/* ---- sockets: Schuko family --------------------------------------- */
REAL_RENDER['outlet'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered); const t=comp&&comp.type;
  let s=R.plate(14);
  if(t==='usboutlet'){
    s+=R.schuko(0,-4.2,8.2,lit);
    s+=`<rect x="-8.6" y="7" width="7.6" height="4.6" rx="1" fill="#23262b"/><rect x="-7.2" y="8.6" width="4.8" height="1.4" rx="0.4" fill="#c9ced4"/>
        <rect x="1" y="7" width="7.6" height="4.6" rx="1" fill="#23262b"/><rect x="2.4" y="8.6" width="4.8" height="1.4" rx="0.4" fill="#c9ced4"/>
        <text x="0" y="6" font-size="2" font-weight="700" fill="#6a7178" text-anchor="middle">USB 2.4A</text>`;
  } else if(t==='floorbox'){
    s=`<rect x="-14.4" y="-14.2" width="29" height="29" rx="2.4" fill="#000" opacity="0.15"/>
       <rect x="-14.5" y="-14.5" width="29" height="29" rx="2.4" fill="url(#realBrass)" stroke="#7a5a1e" stroke-width="0.9"/>
       <rect x="-11.5" y="-11.5" width="23" height="23" rx="1.6" fill="#c9b06a" stroke="#8a6a2a" stroke-width="0.7"/>
       ${R.screw(-12.6,-12.6,1)}${R.screw(12.6,-12.6,1)}${R.screw(-12.6,12.6,1)}${R.screw(12.6,12.6,1)}
       <rect x="-11.5" y="-2" width="23" height="1.2" fill="#8a6a2a" opacity="0.6"/>
       <circle cx="9.2" cy="-8.6" r="1.6" fill="#8a6a2a"/><circle cx="9.2" cy="-8.6" r="0.7" fill="#5c4415"/>`
       +R.schuko(0,3.4,7.4,lit)+`<text x="0" y="-6.6" font-size="2.4" font-weight="700" fill="#5c4415" text-anchor="middle">FLOOR \u00b7 IP44</text>`;
  } else {
    s+=R.schuko(0,0,10.2,lit);
    s+=`<text x="0" y="13" font-size="2" fill="#8f959b" text-anchor="middle">${t==='outlet20'?'16A \u00b7 IP20':'250V~ 16A'}</text>`;
    s+=R.screw(0,-12.2,0.9)+R.screw(0,12.6,0.9);
  }
  return s+R.chip(glyph,color);
};
REAL_RENDER['gfci'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  let s=R.plate(14)+R.schuko(0,-3.4,8.6,lit);
  s+=`<rect x="-9.4" y="7" width="8.6" height="4.8" rx="1.1" fill="#2b6fe0" stroke="#1a4a9e" stroke-width="0.5"/><text x="-5.1" y="10.4" font-size="2.6" font-weight="800" fill="#fff" text-anchor="middle">TEST</text>
      <rect x="0.8" y="7" width="8.6" height="4.8" rx="1.1" fill="#c0392b" stroke="#8f1f14" stroke-width="0.5"/><text x="5.1" y="10.4" font-size="2.3" font-weight="800" fill="#fff" text-anchor="middle">RESET</text>
      <text x="0" y="-13.6" font-size="2" font-weight="700" fill="#6a7178" text-anchor="middle">RCD 30mA</text>`;
  return s+R.chip(glyph,color);
};
/* CEE 3-phase 16A red industrial socket */
REAL_RENDER['outlet240'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  return `
    <rect x="-10.4" y="-15.6" width="21" height="31.4" rx="4.4" fill="#000" opacity="0.16"/>
    <rect x="-10.8" y="-16.2" width="21" height="31.4" rx="4.4" fill="#c0392b" stroke="#7e1f16" stroke-width="1"/>
    <rect x="-9.6" y="-15.2" width="2.2" height="29" rx="1.1" fill="#ffffff" opacity="0.2"/>
    <rect x="-8.4" y="-14.4" width="16.2" height="6" rx="2" fill="#a83226" stroke="#7e1f16" stroke-width="0.6"/>
    <text x="-0.3" y="-10.2" font-size="3" font-weight="800" fill="#f6d9d4" text-anchor="middle">CEE 16A</text>
    <g transform="rotate(-14 -0.3 2.4)">
      <circle cx="-0.3" cy="2.4" r="8.6" fill="#d9463a" stroke="#7e1f16" stroke-width="0.9"/>
      <circle cx="-0.3" cy="2.4" r="6.8" fill="#3a3f45" stroke="#17191c" stroke-width="0.6"/>
      ${[72,144,216,288].map(a=>`<circle cx="${-0.3+4.4*Math.cos(a*Math.PI/180)}" cy="${2.4+4.4*Math.sin(a*Math.PI/180)}" r="1.35" fill="#17191c" stroke="#565e69" stroke-width="0.35"/>`).join('')}
      <circle cx="-0.3" cy="-2" r="1.6" fill="#17191c" stroke="#565e69" stroke-width="0.35"/>
      <rect x="-1.3" y="-9.4" width="2" height="2.6" rx="0.6" fill="#a83226" stroke="#7e1f16" stroke-width="0.5"/>
    </g>
    <text x="-0.3" y="14" font-size="2.4" font-weight="700" fill="#f6d9d4" text-anchor="middle">400V 3P+N+E \u00b7 6h</text>
    ${lit?`<circle cx="7.6" cy="-12" r="1" fill="#5fd394"/>`:''}
    ${R.chip(glyph,color)}`;
};

/* ---- switches: EU rocker / PIR / rotary dimmer / smart glass ------- */
REAL_RENDER['switch'] = function(color, comp, opts, glyph){
  const on=opts&&opts.on!==false; const t=comp&&comp.type;
  if(t==='motion'){
    const lit=!!(opts&&opts.powered);
    return R.plate(14)+`
      <circle cx="0" cy="-1" r="9.4" fill="#f4f6f7" stroke="#b3b9bf" stroke-width="0.7"/>
      ${[-6,-2,2,6].map(x=>`<line x1="${x}" y1="${-1-Math.sqrt(Math.max(0,81-x*x))*0.92}" x2="${x}" y2="${-1+Math.sqrt(Math.max(0,81-x*x))*0.92}" stroke="#d6dade" stroke-width="0.6"/>`).join('')}
      ${[-6.4,-2.6,1.2,5].map(y=>`<line x1="${-Math.sqrt(Math.max(0,86-(y+1)*(y+1)))*0.95}" y1="${y}" x2="${Math.sqrt(Math.max(0,86-(y+1)*(y+1)))*0.95}" y2="${y}" stroke="#d6dade" stroke-width="0.6"/>`).join('')}
      <ellipse cx="-3" cy="-4.6" rx="2.6" ry="1.7" fill="#ffffff" opacity="0.7"/>
      <circle cx="0" cy="10.6" r="1.1" fill="${on&&lit?'#e0473c':'#8f959b'}"/>
      <text x="0" y="-12.2" font-size="2" font-weight="700" fill="#6a7178" text-anchor="middle">PIR 180\u00b0</text>`+R.chip(glyph,color);
  }
  const two=t==='switch3';
  let s=R.plate(14);
  const rocker=(x0,w)=>`
      <rect x="${x0}" y="-10.6" width="${w}" height="21.2" rx="1.6" fill="url(#euMod)" stroke="#b3b9bf" stroke-width="0.6"/>
      <rect x="${x0}" y="${on?-10.6:0}" width="${w}" height="10.6" rx="1.6" fill="${on?'#eceff0':'#f8fafa'}"/>
      <line x1="${x0+1}" y1="0" x2="${x0+w-1}" y2="0" stroke="#9aa1a8" stroke-width="0.7"/>
      <rect x="${x0+0.8}" y="${on?0.6:-10}" width="${w-1.6}" height="1.6" rx="0.8" fill="#aab0b6" opacity="0.55"/>
      <circle cx="${x0+w/2}" cy="${on?-6.4:6.4}" r="0.75" fill="${on?'#e0473c':'#c9ced4'}"/>`;
  if(two){ s+=rocker(-9.8,9); s+=rocker(0.8,9); }
  else s+=rocker(-6.4,12.8);
  return s+R.chip(glyph,color);
};
REAL_RENDER['dimmer'] = function(color, comp, opts, glyph){
  const on=opts&&opts.on!==false; const lit=!!(opts&&opts.powered); const t=comp&&comp.type;
  if(t==='smartsw'){
    return `
      <rect x="-13.4" y="-13.2" width="27" height="27" rx="3.2" fill="#000" opacity="0.18"/>
      <rect x="-14" y="-14" width="28" height="28" rx="3.2" fill="#20242a" stroke="#0e1114" stroke-width="0.8"/>
      <rect x="-12.6" y="-12.6" width="25.2" height="25.2" rx="2.4" fill="none" stroke="#3a414a" stroke-width="0.6"/>
      <path d="M -13 -12 L 8 -14 L -14 6 Z" fill="#ffffff" opacity="0.05"/>
      <circle cx="0" cy="-2.4" r="4.6" fill="none" stroke="${on&&lit?'#4fc3f7':'#3a414a'}" stroke-width="1.1"/>
      <line x1="0" y1="-7" x2="0" y2="-3.4" stroke="${on&&lit?'#4fc3f7':'#3a414a'}" stroke-width="1.1"/>
      ${[0,1,2,3].map(i=>`<rect x="${-6.6+i*3.7}" y="7.4" width="2.5" height="1.4" rx="0.7" fill="${on&&lit&&i<3?'#4fc3f7':'#3a414a'}"/>`).join('')}
      <text x="0" y="12.4" font-size="1.8" fill="#5c6672" text-anchor="middle">smart \u00b7 wifi</text>`+R.chip(glyph,color);
  }
  return R.plate(14)+`
    <circle cx="0" cy="-0.6" r="8.8" fill="#000" opacity="0.14"/>
    <circle cx="0" cy="-1.2" r="8.8" fill="url(#euMod)" stroke="#a7adb3" stroke-width="0.8"/>
    <circle cx="0" cy="-1.2" r="8.8" fill="none" stroke="#ffffff" stroke-width="0.6" opacity="0.5" stroke-dasharray="9 46"/>
    <circle cx="0" cy="-1.2" r="6.2" fill="#e6e9ea" stroke="#b3b9bf" stroke-width="0.5"/>
    <g transform="rotate(${on?52:-115} 0 -1.2)"><rect x="-0.7" y="-7.6" width="1.4" height="4.4" rx="0.7" fill="#565e69"/></g>
    ${[-115,-60,-5,52].map(a=>`<line x1="0" y1="-11.2" x2="0" y2="-10" stroke="#9aa1a8" stroke-width="0.6" transform="rotate(${a} 0 -1.2)"/>`).join('')}
    <circle cx="7.6" cy="9.4" r="0.9" fill="${on&&lit?'#f0a830':'#c9ced4'}"/>
    <text x="0" y="12.6" font-size="1.9" fill="#8f959b" text-anchor="middle">min \u2013 max</text>`+R.chip(glyph,color);
};

/* ---- luminaires (glow with power) ---------------------------------- */
REAL_RENDER['light'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered); const t=comp&&comp.type;
  if(t==='outdoorlight'){
    return `
      ${lit?R.glow(0,0,15):''}
      <ellipse cx="0.4" cy="0.6" rx="12.6" ry="9.2" fill="#000" opacity="0.18"/>
      <ellipse cx="0" cy="0" rx="12.6" ry="9.2" fill="url(#euMod)" stroke="#8f959b" stroke-width="1"/>
      <ellipse cx="0" cy="0" rx="9.4" ry="6.4" fill="${lit?'#fff3cf':'#e8ebec'}" stroke="#9aa1a8" stroke-width="0.7"/>
      ${lit?`<ellipse cx="0" cy="0" rx="9.4" ry="6.4" fill="url(#glowGrad)"/>`:''}
      <path d="M -9 -4.4 Q 0 -8.4 9 -4.4 M -10.4 0 H 10.4 M -9 4.4 Q 0 8.4 9 4.4" fill="none" stroke="#8f959b" stroke-width="1.3"/>
      ${R.screw(-11.2,0,0.9)}${R.screw(11.2,0,0.9)}
      <text x="0" y="12.8" font-size="2" fill="#8f959b" text-anchor="middle">bulkhead \u00b7 IP65</text>`+R.chip(glyph,color);
  }
  return `
    ${lit?R.glow(0,2,15):''}
    <rect x="-5.4" y="-14.6" width="10.8" height="4.2" rx="1.2" fill="url(#euMod)" stroke="#9aa1a8" stroke-width="0.7"/>
    <path d="M -3.4 -10.4 h 6.8 l -1 4 h -4.8 Z" fill="url(#realCyl)" stroke="#6d747b" stroke-width="0.6"/>
    ${[-9,-7.6,-6.2].map(y=>`<line x1="-3.1" y1="${y}" x2="3.1" y2="${y}" stroke="#9aa1a8" stroke-width="0.55"/>`).join('')}
    <circle cx="0" cy="2.6" r="9" fill="${lit?'#fff6d8':'#eef1f2'}" fill-opacity="${lit?0.95:0.75}" stroke="#b9bfc5" stroke-width="0.8"/>
    <ellipse cx="-3.2" cy="-1.2" rx="2.6" ry="3.8" fill="#ffffff" opacity="0.55"/>
    <path d="M -2.6 -3.2 v 3.4 M 2.6 -3.2 v 3.4 M -2.6 0.2 l 1.3 1.5 l 1.3 -1.5 l 1.3 1.5 l 1.3 -1.5" fill="none" stroke="${lit?'#e8a13d':'#8f959b'}" stroke-width="0.7"/>
    ${lit?`<circle cx="0" cy="2.6" r="4.6" fill="#ffe9a8" opacity="0.55"/>`:''}`+R.chip(glyph,color);
};
REAL_RENDER['recessed'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  return `
    ${lit?R.glow(0,0,14):''}
    <circle cx="0.5" cy="0.6" r="11.6" fill="#000" opacity="0.16"/>
    <circle cx="0" cy="0" r="11.6" fill="url(#realCyl)" stroke="#8f959b" stroke-width="0.8"/>
    <circle cx="0" cy="0" r="9.2" fill="#e8ebec" stroke="#a7adb3" stroke-width="0.5"/>
    <circle cx="0" cy="0" r="7" fill="${lit?'#fff3cf':'#cfd3d6'}"/>
    <circle cx="0" cy="0" r="4.6" fill="${lit?'#ffe9a8':'#b9bfc5'}"/>
    ${lit?`<circle cx="0" cy="0" r="3" fill="#fff8e2"/>`:''}
    <path d="M -8.2 -8.2 A 11.6 11.6 0 0 1 8.2 -8.2" fill="none" stroke="#ffffff" stroke-width="0.9" opacity="0.5"/>`+R.chip(glyph,color);
};
REAL_RENDER['pendant'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  return `
    <circle cx="0" cy="-16.4" r="1.9" fill="url(#euMod)" stroke="#9aa1a8" stroke-width="0.5"/>
    <line x1="0" y1="-14.6" x2="0" y2="-6.4" stroke="#3a3f45" stroke-width="1"/>
    ${lit?R.glow(0,7.6,13):''}
    <path d="M -9.6 1.4 L -3.2 -6.6 H 3.2 L 9.6 1.4 Z" fill="url(#realCyl)" stroke="#565e69" stroke-width="0.8"/>
    <path d="M -9.6 1.4 L -3.2 -6.6 h 2 L -6.4 1.4 Z" fill="#ffffff" opacity="0.28"/>
    <ellipse cx="0" cy="1.5" rx="9.6" ry="1.7" fill="#454b53"/>
    <circle cx="0" cy="6.4" r="5.4" fill="${lit?'#fff6d8':'#eef1f2'}" fill-opacity="${lit?0.95:0.8}" stroke="#b9bfc5" stroke-width="0.7"/>
    <path d="M -1.7 3.6 v 2.2 M 1.7 3.6 v 2.2 M -1.7 5.8 l 0.85 1.1 l 0.85 -1.1 l 0.85 1.1 l 0.85 -1.1" fill="none" stroke="${lit?'#e8a13d':'#8f959b'}" stroke-width="0.6"/>
    ${lit?`<circle cx="0" cy="6.4" r="2.8" fill="#ffe9a8" opacity="0.6"/>`:''}`+R.chip(glyph,color);
};
REAL_RENDER['chandelier'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  let s=`<line x1="0" y1="-17" x2="0" y2="-8" stroke="#8a6a2a" stroke-width="1"/><circle cx="0" cy="-6.4" r="2.4" fill="url(#realBrass)" stroke="#8a6a2a" stroke-width="0.6"/>`;
  [[-11,3],[-5.6,6.6],[0,8],[5.6,6.6],[11,3]].forEach(([x,y])=>{
    s+=`<path d="M 0 -5 Q ${x*0.7} ${y-8} ${x} ${y-2.4}" fill="none" stroke="url(#realBrass)" stroke-width="1.4"/>`;
    s+=`<path d="M ${x-1.7} ${y-2.4} h 3.4 l -0.7 2.6 h -2 Z" fill="url(#realBrass)" stroke="#8a6a2a" stroke-width="0.4"/>`;
    if(lit) s+=R.glow(x,y-5.4,4.6);
    s+=`<ellipse cx="${x}" cy="${y-4.6}" rx="1.5" ry="2.3" fill="${lit?'#ffedb0':'#e8ebec'}" stroke="#c9ced4" stroke-width="0.4"/>`;
  });
  return s+R.chip(glyph,color);
};
REAL_RENDER['fan'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered); const t=comp&&comp.type;
  const spin=lit?`<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="1.4s" repeatCount="indefinite"/>`:'';
  let s=`<circle cx="0.5" cy="0.6" r="4.4" fill="#000" opacity="0.2"/>`;
  s+=`<g>${spin}${[0,90,180,270].map(a=>`
      <g transform="rotate(${a})"><path d="M 3.4 -1 Q 12 -4.4 16.4 -1.6 Q 15.4 3 8.4 3 Q 5 3 3.4 1.6 Z" fill="url(#euWood)" stroke="#6b4a26" stroke-width="0.6"/>
      <path d="M 5 -0.6 Q 11 -2.8 15 -1.4" fill="none" stroke="#8a6236" stroke-width="0.4" opacity="0.8"/></g>`).join('')}</g>`;
  s+=`<circle cx="0" cy="0" r="4.6" fill="url(#realCyl)" stroke="#565e69" stroke-width="0.8"/>`;
  if(t==='fanlight'){ if(lit) s+=R.glow(0,0,7); s+=`<circle cx="0" cy="0" r="3" fill="${lit?'#fff3cf':'#dfe2e4'}" stroke="#9aa1a8" stroke-width="0.5"/>`; }
  else s+=`<circle cx="0" cy="0" r="1.6" fill="#8f959b"/>`;
  return s+R.chip(glyph,color);
};
REAL_RENDER['led'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  return `
    ${lit?`<rect x="-17" y="-4.4" width="34" height="8.8" rx="4.4" fill="url(#glowGrad)" opacity="0.8"/>`:''}
    <rect x="-16.4" y="-2.9" width="33" height="6.2" rx="1.2" fill="#000" opacity="0.18"/>
    <rect x="-16.8" y="-3.4" width="33.6" height="6.2" rx="1.2" fill="url(#realCyl)" stroke="#6d747b" stroke-width="0.7"/>
    <rect x="-15.6" y="-2.2" width="31.2" height="3.8" rx="0.9" fill="${lit?'#fff2c4':'#e8ebec'}" stroke="#b9bfc5" stroke-width="0.4"/>
    ${Array.from({length:9},(_,i)=>`<circle cx="${-13.4+i*3.35}" cy="-0.3" r="0.75" fill="${lit?'#ffd97a':'#c9ced4'}"/>`).join('')}
    <rect x="-16.8" y="-3.4" width="2" height="6.2" rx="0.8" fill="#8f959b"/><rect x="14.8" y="-3.4" width="2" height="6.2" rx="0.8" fill="#8f959b"/>
    <text x="0" y="7.6" font-size="2" fill="#8f959b" text-anchor="middle">24V LED \u00b7 alu profile</text>`+R.chip(glyph,color);
};
REAL_RENDER['flood'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  const head=(x,rot)=>`
    <g transform="translate(${x} -4) rotate(${rot})">
      ${lit?`<path d="M -5 3 L -11 15 H 11 L 5 3 Z" fill="url(#glowGrad)" opacity="0.75"/>`:''}
      <rect x="-6.2" y="-5.4" width="12.4" height="9" rx="1.6" fill="#2b2f35" stroke="#0e1114" stroke-width="0.7"/>
      <rect x="-4.9" y="-4.1" width="9.8" height="6.4" rx="0.9" fill="${lit?'#fff2c4':'#4a525c'}"/>
      ${[-2.4,0,2.4].map(xx=>`<line x1="${xx}" y1="-4.1" x2="${xx}" y2="2.3" stroke="${lit?'#e8c97a':'#3a414a'}" stroke-width="0.5"/>`).join('')}
    </g>`;
  return `
    <rect x="-2" y="-15.4" width="4" height="5.4" rx="1" fill="url(#euMod)" stroke="#9aa1a8" stroke-width="0.6"/>
    ${head(-8,-14)}${head(8,14)}
    <line x1="-6" y1="-8.6" x2="0" y2="-11" stroke="#565e69" stroke-width="1.4"/><line x1="6" y1="-8.6" x2="0" y2="-11" stroke="#565e69" stroke-width="1.4"/>
    <circle cx="0" cy="7.8" r="3.4" fill="#f4f6f7" stroke="#b3b9bf" stroke-width="0.7"/>
    <path d="M -2.4 7 h 4.8 M -2.9 8.6 h 5.8" stroke="#d6dade" stroke-width="0.5" fill="none"/>
    <text x="0" y="14.6" font-size="2" fill="#8f959b" text-anchor="middle">2\u00d720W \u00b7 PIR</text>`+R.chip(glyph,color);
};

/* ---- consumer unit / junction box / EV / detectors ----------------- */
REAL_RENDER['panel'] = function(color, comp, opts, glyph){
  return `
    <rect x="-15" y="-16.4" width="30.8" height="33" rx="2.6" fill="#000" opacity="0.16"/>
    <rect x="-15.4" y="-17" width="30.8" height="33" rx="2.6" fill="url(#euMod)" stroke="#9aa1a8" stroke-width="1"/>
    <rect x="-13.6" y="-15.2" width="27.2" height="29.4" rx="1.8" fill="#f4f6f7" stroke="#c9ced4" stroke-width="0.6"/>
    <rect x="-12.6" y="-11" width="25.2" height="10.4" rx="0.8" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.5"/>
    <rect x="-12" y="-6.4" width="24" height="1.6" fill="url(#realCyl)"/>
    <rect x="-11.6" y="-10" width="5.4" height="8.6" rx="0.7" fill="#fbfcfc" stroke="#9aa1a8" stroke-width="0.5"/>
    <rect x="-10.4" y="${'-8.4'}" width="3" height="3" rx="0.6" fill="#c0392b"/><text x="-8.9" y="-6.2" font-size="2" font-weight="800" fill="#fff" text-anchor="middle">I</text>
    ${[0,1,2,3,4].map(i=>{const x=-5.2+i*3.6;return `<rect x="${x}" y="-10" width="3.1" height="8.6" rx="0.5" fill="#fbfcfc" stroke="#9aa1a8" stroke-width="0.45"/><rect x="${x+0.6}" y="-8.6" width="1.9" height="2.6" rx="0.4" fill="url(#euOrange)"/>`;}).join('')}
    <rect x="-12.6" y="2.4" width="25.2" height="7" rx="0.8" fill="#e9ecee" stroke="#c9ced4" stroke-width="0.5"/>
    ${[0,1,2,3,4,5,6].map(i=>`<circle cx="${-10.2+i*3.5}" cy="5.9" r="0.8" fill="#b98f2e"/>`).join('')}
    <text x="0" y="12.6" font-size="2.3" font-weight="700" fill="#6a7178" text-anchor="middle">CONSUMER UNIT</text>
    ${R.screw(-13.2,-15,0.8)}${R.screw(13.2,-15,0.8)}${R.screw(-13.2,14,0.8)}${R.screw(13.2,14,0.8)}`+R.chip(glyph,color);
};
REAL_RENDER['subpanel'] = function(color, comp, opts, glyph){
  return `
    <rect x="-12.2" y="-13.4" width="25" height="27" rx="2.2" fill="#000" opacity="0.16"/>
    <rect x="-12.6" y="-14" width="25" height="27" rx="2.2" fill="url(#euMod)" stroke="#9aa1a8" stroke-width="0.9"/>
    <rect x="-11" y="-12.4" width="21.8" height="23.6" rx="1.5" fill="#f4f6f7" stroke="#c9ced4" stroke-width="0.5"/>
    <rect x="-10" y="-8.6" width="19.8" height="9.4" rx="0.7" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.5"/>
    <rect x="-9.4" y="-4.4" width="18.6" height="1.4" fill="url(#realCyl)"/>
    ${[0,1,2,3].map(i=>{const x=-8.6+i*4.5;return `<rect x="${x}" y="-7.8" width="3.6" height="7.8" rx="0.5" fill="#fbfcfc" stroke="#9aa1a8" stroke-width="0.45"/><rect x="${x+0.8}" y="-6.6" width="2" height="2.6" rx="0.4" fill="url(#euOrange)"/>`;}).join('')}
    <text x="0" y="8.4" font-size="2.1" font-weight="700" fill="#6a7178" text-anchor="middle">SUB \u00b7 DIN 4M</text>`+R.chip(glyph,color);
};
REAL_RENDER['splitter'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  return `
    <circle cx="0.5" cy="0.6" r="11.8" fill="#000" opacity="0.16"/>
    <circle cx="0" cy="0" r="11.8" fill="url(#euIvory)" stroke="#8f8a7a" stroke-width="0.9"/>
    <circle cx="0" cy="0" r="9.2" fill="none" stroke="#b3ac98" stroke-width="0.6"/>
    ${[45,135,225,315].map(a=>`<g transform="rotate(${a})">${R.screw(0,-10.4,1)}</g>`).join('')}
    ${[0,90,180,270].map(a=>`<g transform="rotate(${a})"><rect x="-2.4" y="-14.6" width="4.8" height="3.4" rx="1.4" fill="#3a3f45" stroke="#17191c" stroke-width="0.5"/><circle cx="0" cy="-12.9" r="1" fill="#17191c"/></g>`).join('')}
    <path d="M -9.2 0 H 9.2 M 0 -9.2 V 9.2" stroke="#cfc7ae" stroke-width="0.7"/>
    <rect x="-4.6" y="-2.4" width="9.2" height="4.8" rx="1" fill="#e8762b" stroke="#a8500f" stroke-width="0.5" opacity="0.92"/>
    <text x="0" y="0.9" font-size="2.4" font-weight="800" fill="#fff" text-anchor="middle">WAGO</text>
    ${lit?`<circle cx="7" cy="-7" r="0.9" fill="#5fd394"/>`:''}
    <text x="0" y="13.9" font-size="1.9" fill="#8f8a7a" text-anchor="middle">junction \u00b7 IP20</text>`+R.chip(glyph,color);
};
REAL_RENDER['ev'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered);
  return `
    <rect x="-9.4" y="-16.4" width="19.4" height="30" rx="4.6" fill="#000" opacity="0.16"/>
    <rect x="-9.8" y="-17" width="19.4" height="30" rx="4.6" fill="url(#euMod)" stroke="#9aa1a8" stroke-width="1"/>
    <rect x="-8.6" y="-15.9" width="2.4" height="27.8" rx="1.2" fill="#ffffff" opacity="0.5"/>
    <rect x="-7.4" y="-14.4" width="14.6" height="6.4" rx="1.4" fill="#20242a"/>
    <text x="-0.1" y="-10" font-size="3.2" font-weight="700" fill="${lit?'#5fd394':'#4a525c'}" text-anchor="middle">${lit?'READY':'\u2014'}</text>
    <circle cx="-0.1" cy="0.6" r="6.6" fill="#2b2f35" stroke="#0e1114" stroke-width="0.8"/>
    <path d="M -6.7 -1.6 a 6.6 6.6 0 0 1 13.2 0" fill="#20242a"/>
    <circle cx="-0.1" cy="0.6" r="6.6" fill="none" stroke="${lit?'#5fd394':'#565e69'}" stroke-width="0.8"/>
    <circle cx="-3.1" cy="-1.4" r="1" fill="#0e1114" stroke="#565e69" stroke-width="0.3"/><circle cx="2.9" cy="-1.4" r="1" fill="#0e1114" stroke="#565e69" stroke-width="0.3"/>
    <circle cx="-4.3" cy="1.8" r="1.25" fill="#0e1114" stroke="#565e69" stroke-width="0.3"/><circle cx="-0.1" cy="1.8" r="1.25" fill="#0e1114" stroke="#565e69" stroke-width="0.3"/><circle cx="4.1" cy="1.8" r="1.25" fill="#0e1114" stroke="#565e69" stroke-width="0.3"/>
    <circle cx="-2.2" cy="4.6" r="1.25" fill="#0e1114" stroke="#565e69" stroke-width="0.3"/><circle cx="2" cy="4.6" r="1.25" fill="#0e1114" stroke="#565e69" stroke-width="0.3"/>
    <path d="M -7.6 9.4 q -4 4.4 0 7.4" fill="none" stroke="#20242a" stroke-width="2.2"/>
    <text x="-0.1" y="11.6" font-size="2.1" font-weight="700" fill="#6a7178" text-anchor="middle">Type 2</text>`+R.chip(glyph,color);
};
REAL_RENDER['smoke'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered); const t=comp&&comp.type;
  if(t==='doorbell'){
    return `
      <rect x="-6.4" y="-11.4" width="13.4" height="23.4" rx="3.2" fill="#000" opacity="0.16"/>
      <rect x="-6.8" y="-12" width="13.4" height="23.4" rx="3.2" fill="url(#realCyl)" stroke="#565e69" stroke-width="0.8"/>
      <circle cx="-0.1" cy="-4" r="4.4" fill="#f4f6f7" stroke="#8f959b" stroke-width="0.7"/>
      <circle cx="-0.1" cy="-4" r="2.6" fill="${lit?'#ffedb0':'#dfe2e4'}" stroke="#b3b9bf" stroke-width="0.5"/>
      ${lit?`<circle cx="-0.1" cy="-4" r="4.4" fill="url(#glowGrad)" opacity="0.7"/>`:''}
      <text x="-0.1" y="6.4" font-size="2.4" font-weight="700" fill="#454b53" text-anchor="middle">RING</text>
      ${R.screw(-0.1,9,0.8)}`+R.chip(glyph,color);
  }
  const co=t==='co';
  return `
    <circle cx="0.5" cy="0.6" r="12.4" fill="#000" opacity="0.15"/>
    <circle cx="0" cy="0" r="12.4" fill="url(#euMod)" stroke="#b3b9bf" stroke-width="0.8"/>
    <circle cx="0" cy="0" r="10" fill="#f4f6f7" stroke="#c9ced4" stroke-width="0.5"/>
    ${[0,45,90,135,180,225,270,315].map(a=>`<g transform="rotate(${a})"><rect x="-1.1" y="-9.4" width="2.2" height="3.4" rx="0.9" fill="#c9ced4"/></g>`).join('')}
    <circle cx="0" cy="0" r="4.6" fill="#e8ebec" stroke="#b3b9bf" stroke-width="0.5"/>
    ${[30,90,150,210,270,330].map(a=>`<line x1="0" y1="-1.4" x2="0" y2="-4" stroke="#9aa1a8" stroke-width="0.7" transform="rotate(${a})"/>`).join('')}
    <text x="0" y="1.6" font-size="${co?3:2}" font-weight="800" fill="#6a7178" text-anchor="middle">${co?'CO':'test'}</text>
    <circle cx="6.4" cy="6.4" r="0.9" fill="${lit?'#e0473c':'#c9ced4'}">${lit?'<animate attributeName="opacity" values="1;0.15;1" dur="2.4s" repeatCount="indefinite"/>':''}</circle>`+R.chip(glyph,color);
};

/* ---- appliance fronts (per type) ----------------------------------- */
REAL_RENDER['appliance'] = function(color, comp, opts, glyph){
  const lit=!!(opts&&opts.powered); const t=(comp&&comp.type)||'';
  const box=(w,h,fill)=>`
    <rect x="${-w/2+0.5}" y="${-h/2+0.6}" width="${w}" height="${h}" rx="2" fill="#000" opacity="0.16"/>
    <rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="2" fill="${fill||'url(#realCylV)'}" stroke="#7d848d" stroke-width="0.9"/>
    <rect x="${-w/2+1}" y="${-h/2+0.9}" width="1.8" height="${h-1.8}" rx="0.9" fill="#ffffff" opacity="0.35"/>`;
  if(t==='fridge') return box(24,33)+`
    <line x1="1.2" y1="-16.5" x2="1.2" y2="3.2" stroke="#565e69" stroke-width="0.7"/>
    <line x1="-12" y1="3.2" x2="12" y2="3.2" stroke="#565e69" stroke-width="0.9"/>
    <rect x="-1.6" y="-13.4" width="1.5" height="13.4" rx="0.7" fill="#8f97a1"/><rect x="2.6" y="-13.4" width="1.5" height="13.4" rx="0.7" fill="#8f97a1"/>
    <rect x="-9.8" y="-12.4" width="6.4" height="9.4" rx="1" fill="#20242a"/><text x="-6.6" y="-8.4" font-size="2" fill="#4fc3f7" text-anchor="middle">${lit?'4\u00b0':'--'}</text>
    <rect x="-8" y="6.4" width="16" height="1.5" rx="0.7" fill="#8f97a1"/>
    <text x="0" y="13.4" font-size="1.9" fill="#565e69" text-anchor="middle">no-frost \u00b7 A++</text>`+R.chip(glyph,color);
  if(t==='washer'||t==='dryer'||t==='gasdryer'){ const dry=t!=='washer';
    return box(26,28,'url(#euMod)')+`
    <rect x="-12" y="-12.9" width="24" height="4.6" rx="1" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.5"/>
    <circle cx="-8.4" cy="-10.6" r="1.7" fill="#c9ced4" stroke="#8f959b" stroke-width="0.5"/><line x1="-8.4" y1="-12" x2="-8.4" y2="-10.6" stroke="#565e69" stroke-width="0.6"/>
    <rect x="-4.6" y="-11.6" width="9.4" height="2" rx="0.6" fill="#20242a"/><text x="0.1" y="-10" font-size="1.6" fill="${lit?'#5fd394':'#4a525c'}" text-anchor="middle">${lit?(dry?'1:20':'2:10'):'--:--'}</text>
    <rect x="7.2" y="-12.2" width="4" height="3.2" rx="0.5" fill="#d6dade" stroke="#9aa1a8" stroke-width="0.4"/>
    <circle cx="0" cy="3.2" r="9.4" fill="url(#realCyl)" stroke="#6d747b" stroke-width="0.9"/>
    <circle cx="0" cy="3.2" r="7.2" fill="${dry?'#3a414a':'url(#euPort)'}" stroke="#565e69" stroke-width="0.6"/>
    ${dry?[45,90,135,180,225,270,315,360].map(a=>`<circle cx="${4.4*Math.cos(a*Math.PI/180)}" cy="${3.2+4.4*Math.sin(a*Math.PI/180)}" r="0.75" fill="#20242a"/>`).join(''):
      `<g>${lit?`<animateTransform attributeName="transform" type="rotate" from="0 0 3.2" to="360 0 3.2" dur="1.6s" repeatCount="indefinite"/>`:''}
       <path d="M -4.4 0 Q 0 -1.6 4.4 1.4" fill="none" stroke="#7fa4c8" stroke-width="1.1" opacity="0.8"/>
       <path d="M -4 5.6 Q 0.6 7.4 4.2 4.6" fill="none" stroke="#9fc0dc" stroke-width="1" opacity="0.7"/></g>
       <ellipse cx="-2.6" cy="0.4" rx="2.2" ry="3" fill="#ffffff" opacity="0.35"/>`}
    <circle cx="0" cy="3.2" r="9.4" fill="none" stroke="#ffffff" stroke-width="0.7" opacity="0.4" stroke-dasharray="4 42"/>
    ${t==='gasdryer'?`<path d="M 9.4 10.4 q 1.7 1.7 0 3.4 q -1.7 -0.6 -1 -2.1 q -1.1 0.2 -0.7 -1.7 q 1 -0.4 1.7 0.4 Z" fill="#d1622f"/>`:''}`+R.chip(glyph,color);
  }
  if(t==='dishwasher') return box(25,28)+`
    <rect x="-11.4" y="-12.6" width="22.8" height="4" rx="0.9" fill="#20242a"/>
    ${[0,1,2].map(i=>`<circle cx="${-8.6+i*3.4}" cy="-10.6" r="0.8" fill="${lit&&i<2?'#5fd394':'#4a525c'}"/>`).join('')}
    <text x="7" y="-9.6" font-size="1.8" fill="#8f97a1" text-anchor="end">ECO</text>
    <rect x="-10.4" y="-6.6" width="20.8" height="1.8" rx="0.9" fill="#8f97a1"/>
    <line x1="-11.4" y1="10.4" x2="11.4" y2="10.4" stroke="#565e69" stroke-width="0.7"/>
    ${lit?`<path d="M -3 13 h 6" stroke="#e0473c" stroke-width="0.8" opacity="0.8"/>`:''}`+R.chip(glyph,color);
  if(t==='cooktop') return `
    <rect x="-15" y="-11.4" width="30.8" height="23.4" rx="2" fill="#000" opacity="0.2"/>
    <rect x="-15.4" y="-12" width="30.8" height="23.4" rx="2" fill="#14171c" stroke="#0a0c0f" stroke-width="0.9"/>
    <path d="M -14 -11 L 6 -12 L -15 4 Z" fill="#ffffff" opacity="0.05"/>
    ${[[-7.4,-4.6,4.4],[7,-4.6,3.4],[-7.4,4.4,3.4],[7,4.4,4.4]].map(([x,y,r],i)=>`
      <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${lit&&i===0?'#e0473c':'#3a414a'}" stroke-width="0.8"/>
      <circle cx="${x}" cy="${y}" r="${r-1.6}" fill="none" stroke="${lit&&i===0?'#a83226':'#2b3037'}" stroke-width="0.6"/>
      <line x1="${x-1}" y1="${y}" x2="${x+1}" y2="${y}" stroke="${lit&&i===0?'#e0473c':'#3a414a'}" stroke-width="0.5"/>`).join('')}
    ${[0,1,2,3].map(i=>`<circle cx="${-4.6+i*3.1}" cy="9.2" r="0.7" fill="${lit&&i===0?'#e0473c':'#3a414a'}"/>`).join('')}
    <text x="0" y="-8.8" font-size="1.8" fill="#4a525c" text-anchor="middle">induction</text>`+R.chip(glyph,color);
  if(t==='range') return box(26,30)+`
    <rect x="-12" y="-14" width="24" height="5.4" rx="1" fill="#14171c" stroke="#0a0c0f" stroke-width="0.6"/>
    ${[-8.4,-2.8,2.8,8.4].map((x,i)=>`<circle cx="${x}" cy="-11.3" r="2" fill="none" stroke="${lit&&i===1?'#e0473c':'#3a414a'}" stroke-width="0.7"/>`).join('')}
    ${[-6,-2,2,6].map(x=>`<circle cx="${x}" cy="-6.6" r="1.1" fill="#c9ced4" stroke="#8f959b" stroke-width="0.4"/><line x1="${x}" y1="-7.5" x2="${x}" y2="-6.6" stroke="#565e69" stroke-width="0.5"/>`).join('')}
    <rect x="-10.4" y="-3.4" width="20.8" height="1.7" rx="0.8" fill="#8f97a1"/>
    <rect x="-9.4" y="0.4" width="18.8" height="10.4" rx="1.2" fill="#20242a" stroke="#0e1114" stroke-width="0.6"/>
    <rect x="-7.9" y="1.9" width="15.8" height="7.4" rx="0.8" fill="${lit?'#4a3220':'#2b3037'}"/>
    ${lit?`<rect x="-7.9" y="1.9" width="15.8" height="7.4" rx="0.8" fill="url(#glowGrad)" opacity="0.35"/>`:''}
    <text x="0" y="13.9" font-size="1.8" fill="#565e69" text-anchor="middle">400V \u00b7 3P</text>`+R.chip(glyph,color);
  if(t==='walloven') return box(25,26)+`
    <rect x="-11.4" y="-11.6" width="22.8" height="4.2" rx="0.9" fill="#20242a"/>
    <text x="0" y="-8.7" font-size="2" fill="${lit?'#e8a13d':'#4a525c'}" text-anchor="middle">${lit?'180\u00b0C':'--'}</text>
    <rect x="-10.4" y="-5.6" width="20.8" height="1.7" rx="0.8" fill="#8f97a1"/>
    <rect x="-9.6" y="-2" width="19.2" height="12.4" rx="1.2" fill="#20242a" stroke="#0e1114" stroke-width="0.6"/>
    <rect x="-8" y="-0.4" width="16" height="9.2" rx="0.8" fill="${lit?'#4a3220':'#2b3037'}"/>
    ${lit?`<rect x="-8" y="-0.4" width="16" height="9.2" rx="0.8" fill="url(#glowGrad)" opacity="0.4"/>`:''}`+R.chip(glyph,color);
  if(t==='microwave') return box(27,17)+`
    <rect x="-11.9" y="-6.4" width="16.4" height="12.8" rx="1" fill="#20242a" stroke="#0e1114" stroke-width="0.6"/>
    <rect x="-10.6" y="-5.1" width="13.8" height="10.2" rx="0.7" fill="#2b3037"/>
    ${Array.from({length:12},(_,i)=>`<circle cx="${-9+(i%4)*3.6}" cy="${-3.2+Math.floor(i/4)*3.4}" r="0.55" fill="#171b20"/>`).join('')}
    ${lit?`<rect x="-10.6" y="-5.1" width="13.8" height="10.2" rx="0.7" fill="#ffedb0" opacity="0.14"/>`:''}
    <rect x="5.9" y="-6.4" width="6.6" height="12.8" rx="0.8" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.5"/>
    <rect x="7" y="-5.2" width="4.4" height="2.2" rx="0.4" fill="#20242a"/><text x="9.2" y="-3.5" font-size="1.5" fill="${lit?'#5fd394':'#4a525c'}" text-anchor="middle">${lit?'0:45':'--'}</text>
    ${Array.from({length:6},(_,i)=>`<circle cx="${7.9+(i%2)*2.6}" cy="${-0.8+Math.floor(i/2)*2.4}" r="0.65" fill="#b3b9bf"/>`).join('')}
    <rect x="4.5" y="-6.4" width="1" height="12.8" fill="#8f97a1"/>`+R.chip(glyph,color);
  if(t==='security') return box(21,25,'url(#euMod)')+`
    <rect x="-8" y="-9.6" width="16" height="5.4" rx="0.9" fill="#20242a"/>
    <text x="0" y="-5.8" font-size="2.2" font-weight="700" fill="${lit?'#5fd394':'#4a525c'}" text-anchor="middle">${lit?'ARMED':'OFF'}</text>
    ${Array.from({length:9},(_,i)=>`<rect x="${-6.4+(i%3)*4.5}" y="${-1.4+Math.floor(i/3)*3.9}" width="3.4" height="2.9" rx="0.6" fill="#e3e6e8" stroke="#b3b9bf" stroke-width="0.4"/>`).join('')}
    <circle cx="7" cy="9.4" r="0.9" fill="${lit?'#e0473c':'#c9ced4'}"/>`+R.chip(glyph,color);
  if(t==='icemaker') return box(20,22)+`
    <rect x="-8" y="-8" width="16" height="3.4" rx="0.8" fill="#20242a"/><circle cx="6" cy="-6.3" r="0.7" fill="${lit?'#4fc3f7':'#4a525c'}"/>
    <rect x="-7" y="-2.6" width="14" height="8.4" rx="1" fill="#2b3037" stroke="#0e1114" stroke-width="0.5"/>
    ${[0,1,2].map(i=>`<rect x="${-5.4+i*3.8}" y="-0.8" width="2.8" height="2.8" rx="0.6" fill="#bfe3f2" opacity="0.85"/>`).join('')}
    <rect x="-8" y="8.4" width="16" height="1.3" rx="0.6" fill="#8f97a1"/>`+R.chip(glyph,color);
  /* generic stainless appliance for custom types */
  return box(24,26)+`<text x="0" y="2.4" font-size="7" font-weight="700" fill="#565e69" text-anchor="middle">${glyph||''}</text>
    <rect x="-9" y="-9.4" width="18" height="1.6" rx="0.8" fill="#8f97a1"/>`+R.chip(glyph,color);
};

/* look-up used by iconInner(): most specific key wins */
function realRenderFor(shape, comp){
  if(state.settings && state.settings.realistic===false) return null;
  if(comp && comp.type && REAL_RENDER['type:'+comp.type]) return REAL_RENDER['type:'+comp.type];
  return REAL_RENDER[shape]||null;
}

/* ============================================================
   COMPONENT KNOWLEDGE BASE  — powers the hover / click detail card
   (EU wiring practice: 230 V L/N/PE, 400 V 3~ L1 L2 L3 N PE,
    harmonised colours brown / blue / green-yellow per IEC 60446)
   ============================================================ */
const COMPONENT_INFO = {
  condenser:{ purpose:'Outdoor condensing unit of a split system. Rejects heat through the finned coil and axial fan; houses the compressor, run capacitor and control board.',
    terminals:'Supply: <b>L</b> (brown), <b>N</b> (blue), <b>PE</b> (green/yellow). Interconnect to indoor unit: <b>S1 S2 S3</b> (S3 carries communication). Local lockable rotary isolator within sight of the unit.',
    safety:'Isolate and lock off before removing the terminal cover. The run capacitor holds a charge after power-off &mdash; discharge before touching. Protect the circuit with a 30 mA RCD (IEC 60364).',
    mistakes:'Swapping S2/S3 (unit powers up but never communicates) &middot; sizing cable for run current instead of locked-rotor current &middot; no drip loop at the cable gland &middot; forgetting the local isolator.' },
  heatpump:{ purpose:'Air-to-air / air-to-water heat pump outdoor unit. Reversible refrigerant circuit provides heating and cooling; includes defrost logic and often a crankcase heater.',
    terminals:'<b>L N PE</b> supply (or <b>L1 L2 L3 N PE</b> on larger 400 V units) plus <b>S1 S2 S3</b> or bus terminals to the indoor unit/controller.',
    safety:'The crankcase heater is live even when the unit is idle &mdash; the terminal box is never "dead" until the isolator is off. Allow defrost drain clearance; condensate freezes on walkways.',
    mistakes:'Cutting power overnight (kills the crankcase heater, liquid slugging at start) &middot; undersized backup-heater circuit &middot; interconnect run in the same conduit as mains without rated insulation.' },
  minisplit:{ purpose:'Single-room split system (one outdoor + one indoor unit). Most common EU comfort-cooling install.',
    terminals:'Mains normally lands at the <b>outdoor</b> unit: L N PE. Indoor unit is fed from outdoor via <b>S1 (L), S2 (N), S3 (signal), PE</b> in 4-core cable.',
    safety:'One isolation point must kill both units &mdash; verify before working on the indoor side. 30 mA RCD required.',
    mistakes:'Feeding indoor and outdoor from two different circuits &middot; using 3-core cable and "borrowing" earth for S3 &middot; reversing S1/S2 polarity (many inverters are polarity-sensitive).' },
  acindoor:{ purpose:'Wall-mounted indoor unit: fan coil, filter, louvre and condensate tray. Electronics run from the outdoor unit feed.',
    terminals:'<b>S1 S2 S3 + PE</b> from the outdoor unit, matched number-to-number. Condensate drain must fall continuously (&ge;1 cm/m).',
    safety:'Even "off" at the remote, terminals stay live &mdash; isolate at the outdoor rotary switch. Never mount above a consumer unit or socket (condensate leaks).',
    mistakes:'Drain trap sagging (water drips from the louvre) &middot; crossing S1&harr;S3 &middot; over-tightening the plastic terminal screws.' },
  acoutdoor:{ purpose:'Outdoor unit of a split pair &mdash; compressor, coil, fan and the system\'s mains connection point.',
    terminals:'<b>L N PE</b> supply in; <b>S1 S2 S3 PE</b> out to the indoor unit. Service valves (liquid &amp; gas) and the service port are next to the terminal cover.',
    safety:'Isolator lockable in the OFF position; discharge the run capacitor; refrigerant work only with F-gas certification (EU 517/2014).',
    mistakes:'Reversing interconnect cores &middot; leaving service-valve caps loose (slow refrigerant leak) &middot; no anti-vibration feet, gland fatigue cracks the cores.' },
  ac3cond:{ purpose:'Three-phase 400 V condensing unit for larger cooling loads. Scroll compressors are rotation-direction sensitive.',
    terminals:'<b>L1 L2 L3 N PE</b> (brown / black / grey / blue / green-yellow). Check rotation with a phase-sequence meter before first start.',
    safety:'400 V between phases &mdash; test dead on all five conductors. Fit correctly-rated motor protection (thermal-magnetic, type D or motor CB).',
    mistakes:'Wrong phase rotation (scroll runs backwards: loud, no pressure, dies in minutes) &middot; testing L-N only and calling it dead &middot; single-phasing after one fuse blows.' },
  ac3vrf:{ purpose:'VRF/VRV outdoor unit serving many indoor units on one refrigerant circuit with a communication bus.',
    terminals:'<b>L1 L2 L3 N PE</b> power; shielded 2-core <b>bus (F1/F2 style)</b> daisy-chained to every indoor unit &mdash; polarity and screen continuity matter.',
    safety:'Large refrigerant charge: room concentration limits (EN 378) may require leak detection. Lock-off isolation before bus work &mdash; bus terminals sit next to mains.',
    mistakes:'Star-wiring the bus instead of daisy-chain &middot; earthing the screen at both ends (hum/comms errors) &middot; ignoring phase rotation.' },
  ac3rtu:{ purpose:'Packaged rooftop unit: compressors, fans, heat section and controls in one 400 V cabinet.',
    terminals:'<b>L1 L2 L3 N PE</b> to the built-in isolator; separate low-voltage terminal rail for thermostat/BMS.',
    safety:'Multiple motors restart automatically &mdash; lock off before entering panels. Keep 230 V and extra-low-voltage control wiring segregated (EN 60204).',
    mistakes:'Landing BMS wires on mains terminals &middot; not checking rotation on all three fans &middot; undersized supply for simultaneous heat + fan load.' },
  airhandler:{ purpose:'Indoor air handler: blower, coil and filters distributing conditioned air through ductwork.',
    terminals:'<b>L N PE</b> supply plus control terminals to the thermostat/controller. Interlock with the heat source so the element never runs without airflow.',
    safety:'Blower restarts on thermostat demand &mdash; isolate, don\'t trust the stat. Door interlock switches must not be defeated.',
    mistakes:'Bypassing the airflow interlock &middot; control cable run parallel with mains picking up interference &middot; filter access blocked by the cable route.' },
  furnace:{ purpose:'Electric duct heater / furnace: staged resistance elements switched by contactors, interlocked with the fan.',
    terminals:'<b>L1 L2 L3 N PE</b> (or L N PE on small units) to element contactors; control circuit for stat and airflow proving switch.',
    safety:'Elements glow within seconds &mdash; airflow proving is a safety device, never a jumper point. High-limit thermal cutout must be manual-reset type.',
    mistakes:'Jumping the airflow switch during test and forgetting it &middot; aluminium cable under-torqued at high-current lugs &middot; staging all elements on one contactor.' },
  baseboard:{ purpose:'Fin-tube convection heater at floor level; simple resistive load controlled by a wall thermostat.',
    terminals:'<b>L N PE</b> looped through the end-cap terminal box; thermostat breaks the <b>line</b> conductor (double-pole stat preferred in EU).',
    safety:'Surface gets hot enough to melt cable insulation &mdash; keep supply flex out of the convection channel. Never install below a socket outlet or behind curtains.',
    mistakes:'Switching neutral instead of line at the stat &middot; supply cable resting on the fins &middot; painting over the element fins (smell + derating).' },
  exhaustfan:{ purpose:'Extract fan for bathrooms/kitchens; often with run-on timer.',
    terminals:'<b>L N PE</b> plus a switched-line terminal <b>(T or LS)</b> for the timer trigger from the light switch.',
    safety:'In bathroom zones, follow IEC 60364-7-701: correct IP rating per zone, 30 mA RCD, SELV in zone 0/1 where required.',
    mistakes:'Swapping permanent-L and switched-L (fan never stops, or timer never triggers) &middot; no isolation means for maintenance &middot; wrong zone/IP rating.' },
  ac:{ purpose:'Window / portable room air conditioner &mdash; plug-connected 230 V appliance with compressor and fan behind the front grille.',
    terminals:'Factory moulded plug to a standard socket; no field terminals. Needs its own lightly-loaded circuit &mdash; compressor inrush dips shared circuits.',
    safety:'Never bypass the plug with fixed wiring unless the manual allows it; keep the condensate path clear of the electrics.',
    mistakes:'Extension leads (undersized, coiled = heat) &middot; sharing a circuit with a fridge (nuisance tripping) &middot; blocking the outdoor grille.' },
  waterheater:{ purpose:'Unvented storage cylinder with immersion element(s) and rod thermostat; stores domestic hot water under mains pressure.',
    terminals:'<b>L N PE</b> to the thermostat then element (typ. 3 kW = 13 A at 230 V, dedicated circuit + local double-pole isolator).',
    safety:'The T&amp;P relief valve and expansion device are life-safety parts &mdash; never cap them. Combined stat/cutout must be the manual-reset type. Test PE continuity to the tank shell.',
    mistakes:'Wiring around a tripped thermal cutout instead of finding the cause &middot; undersized flex melting at the element cap &middot; no local isolation switch.' },
  tankless:{ purpose:'Instantaneous electric water heater: heats on demand, very high current draw for its size (often 3-phase).',
    terminals:'Small units: <b>L N PE</b>; larger: <b>L1 L2 L3 (N) PE</b>. Always a dedicated circuit sized to the nameplate, with local isolation.',
    safety:'Loads of 8&ndash;27 kW &mdash; check the incoming supply and main fuse can take it before installing. Torque terminals to spec; these run near their rating for minutes at a time.',
    mistakes:'Installing on an existing shower circuit "because it fits" &middot; loose terminals (classic burn-out point) &middot; ignoring minimum water pressure requirements.' },
  wellpump:{ purpose:'Borehole/well pump motor delivering water via a pressure vessel and pressure switch.',
    terminals:'<b>L N PE</b> (or 3~) through the pressure switch / control box; capacitor-start motors have the capacitor in the surface control box.',
    safety:'Water + electricity: 30 mA RCD mandatory. Isolate before touching the pressure switch &mdash; its contacts are line-voltage.',
    mistakes:'Adjusting the pressure switch live &middot; wrong capacitor value after replacement &middot; PE not carried down to a submersible motor.' },
  sumppump:{ purpose:'Automatic drainage pump with float switch in a basement/lift pit.',
    terminals:'Plug-in or <b>L N PE</b> fixed wiring; float switch usually integral. Socket must be above flood level.',
    safety:'30 mA RCD required; test the float monthly &mdash; a stuck float is a flooded basement.',
    mistakes:'Socket mounted low in the pit &middot; float cable zip-tied so it can\'t move &middot; no non-return valve, pump short-cycles.' },
  poolpump:{ purpose:'Circulation pump for pool filtration; long continuous runtimes.',
    terminals:'<b>L N PE</b> (or 3~) via a local rotary isolator; bonding conductor to the pool bonding grid where required.',
    safety:'IEC 60364-7-702 zones apply: distances, IP ratings and 30 mA RCD are non-negotiable around pools.',
    mistakes:'Isolator outside arm\'s reach of the pump &middot; missing supplementary bonding &middot; running dry after winterising (seal destroyed).' },
  disconnect:{ purpose:'Rotary isolator (switch-disconnector): a lockable means to make equipment safe for mechanical and electrical work. It isolates &mdash; it is not overload protection.',
    terminals:'Breaks <b>all live conductors</b>: L+N on single-phase, L1 L2 L3 (+N) on three-phase. <b>PE passes straight through, never switched.</b> Line side at the top by convention.',
    safety:'Lock off with a padlock and prove dead at the equipment, not at the isolator. Must be within sight of, or lockable for, the machine it serves (EN 60204-1).',
    mistakes:'Switching the neutral only on multi-pole units wired wrong &middot; treating it as an on/off control for daily use (contacts not rated for frequent load switching on some types) &middot; feeding line to the bottom terminals so the "off" side stays live.' },
  disposal:{ purpose:'Sink waste-disposal motor, switch-controlled short-duty appliance.',
    terminals:'<b>L N PE</b> via a switched fused connection or plug; control switch out of reach of the sink.',
    safety:'Isolate before clearing a jam &mdash; the thermal cutout can reset and restart the motor with your hand inside.',
    mistakes:'Relying on the wall switch instead of unplugging when clearing jams &middot; flex touching hot waste pipework.' },
  hood:{ purpose:'Cooker extract hood: fan + lamps above the hob.',
    terminals:'<b>L N PE</b> from a switched fused connection unit above cupboard level.',
    safety:'Keep the connection point accessible after the hood is fitted; grease + heat degrade cheap flex quickly.',
    mistakes:'Burying the connection behind the ducting &middot; recirculation grease filters never cleaned (fire load).' },
  gate:{ purpose:'Gate/door operator: motor, controller and safety edges/photocells outdoors.',
    terminals:'<b>L N PE</b> supply to the controller; SELV terminals for photocells and safety edges &mdash; keep segregated from mains.',
    safety:'Force limitation and photocells are legally required safety functions (Machinery Directive) &mdash; never bridge them out.',
    mistakes:'Mains and photocell cable in one duct without rated separation &middot; bypassing a "faulty" photocell.' },
  genset:{ purpose:'Generator inlet: connection point for a portable generator with changeover switching.',
    terminals:'Inlet appliance plug to a <b>break-before-make changeover switch</b> &mdash; the generator must never parallel the grid supply.',
    safety:'Back-feed kills line workers: an interlocked changeover is mandatory, a "suicide lead" is never acceptable. Check generator earthing arrangement (floating vs TN).',
    mistakes:'Male-to-male cords &middot; changeover that doesn\'t switch the neutral where the earthing system requires it.' }
};
/* shape-level fallbacks when a type has no dedicated entry */
const SHAPE_INFO = {
  motor:{ purpose:'Motor-driven machine (pump / fan / drive). Induction motor with terminal box and, on single-phase units, a run capacitor.',
    terminals:'<b>L N PE</b> at 230 V or <b>L1 L2 L3 PE</b> at 400 V, landed in the terminal box (U V W bridges set for star or delta).',
    safety:'Isolate and lock off &mdash; thermal cutouts auto-reset and restart motors. Discharge capacitors on single-phase machines.',
    mistakes:'Star/delta links left in the wrong position &middot; ignoring rotation direction &middot; undersized overload setting.' },
  heat:{ purpose:'Resistive electric heater &mdash; continuous load counted at full rating.',
    terminals:'<b>L N PE</b> or 3~ via a double-pole control device; high-limit cutout in series with the element.',
    safety:'Treat as continuous load for cable sizing; clearances to combustibles per the manual.',
    mistakes:'Switching neutral only &middot; covering the heater &middot; jumping the thermal cutout.' },
  water:{ purpose:'Water-heating appliance &mdash; element + thermostat near stored or flowing water.',
    terminals:'<b>L N PE</b> on a dedicated circuit with local double-pole isolation.',
    safety:'RCD 30 mA; manual-reset over-temperature cutout; verify PE to metal parts.',
    mistakes:'No local isolator &middot; loose element terminals overheating.' },
  ac:{ purpose:'Air-conditioning / refrigerant-circuit unit (compressor + fan).',
    terminals:'<b>L N PE</b> (or 3~) supply plus S1 S2 S3 interconnect on split systems.',
    safety:'Discharge capacitors; lockable local isolator; F-gas rules for refrigerant work.',
    mistakes:'Crossed interconnect cores &middot; no local isolation.' },
  disconnect: null /* covered by type entry */
};
/* -------- batch 2: control & protection knowledge sheets ------------- */
Object.assign(COMPONENT_INFO, {
  contactor:{ purpose:'Electrically-held power switch for motors, compressors and heater banks. A small coil signal closes the main poles, so a thermostat or controller can switch a heavy load. Click it on the plan to operate the coil.',
    terminals:'Coil: <b>A1</b> (line/signal) and <b>A2</b> (neutral/common). Main poles: <b>1-2, 3-4, 5-6</b> (line in odd, load out even). Auxiliary contact <b>13-14</b> (NO) for status/holding circuits.',
    safety:'A remote signal can pull the contactor in at any moment &mdash; isolate upstream and lock off before touching the load side. Match coil voltage exactly (230 V AC vs 24 V AC/DC are common EU variants).',
    mistakes:'Switching the coil <b>neutral</b> instead of the line &middot; using a contactor with no overload relay on a motor &middot; landing supply on the even (load) terminals &middot; humming/chatter from an undersized control transformer.' },
  relay:{ purpose:'Interface relay on a DIN socket: separates delicate controller outputs from field wiring. The clear cover shows the coil, armature and changeover contact.',
    terminals:'Coil: <b>A1 / A2</b>. Changeover contact: <b>11 (COM) &ndash; 12 (NC) &ndash; 14 (NO)</b>. Socket screw terminals take the field wiring; the relay itself just plugs in.',
    safety:'Contacts may switch 230 V while the coil is SELV &mdash; treat both sides by their own voltage. On DC coils observe polarity and fit/verify the flyback diode module.',
    mistakes:'Switching a compressor or motor directly through a small relay (inrush welds the contact &mdash; use a contactor) &middot; mixing SELV and 230 V on adjacent socket terminals &middot; relying on the test flag as isolation.' },
  mcb:{ purpose:'Miniature circuit breaker: protects the <b>cable</b> against overload and short-circuit. Tripping curve B (domestic), C (small motors), D (high inrush).',
    terminals:'Line in at <b>1</b> (top), load out at <b>2</b> (bottom). Single module = single pole; the neutral runs unbroken to the N bar.',
    safety:'An MCB protects the wiring, not people &mdash; pair with an RCD/RCBO for shock protection. After a trip, find the cause before resetting; repeated resets into a fault is how fires start.',
    mistakes:'Upsizing the breaker to "cure" nuisance trips &middot; two conductors under one clamp without a twin ferrule &middot; picking curve C where a long cable needs curve B to meet disconnection times.' },
  rcbo:{ purpose:'RCBO = MCB + 30 mA residual-current device in one module: overload, short-circuit and earth-leakage protection for a single circuit.',
    terminals:'Supply to the top; circuit <b>L and N both</b> to the bottom of the same RCBO &mdash; the neutral must return through the device it left from. Some models have a functional-earth pigtail that must be landed.',
    safety:'Press <b>T</b> monthly &mdash; a test button that no longer trips means the protection is dead. A tripped RCBO signals a real leakage path; find it, don\'t just reset.',
    mistakes:'Borrowed neutral from another circuit (instant, "random" tripping) &middot; pigtail left coiled up unconnected &middot; ignoring the type marking (Type A needed for inverter/EV loads, not AC).' },
  terminal:{ purpose:'DIN-rail terminal blocks: the tidy, numbered landing point where circuits are distributed, extended or handed over &mdash; grey for line, blue for neutral, green/yellow for PE.',
    terminals:'One conductor per clamp side unless the block is rated for two. Number both the block and the conductor. PE blocks bond through the rail foot; jumper bars link adjacent blocks of the same potential.',
    safety:'Ferrules on all fine-stranded conductors, torqued to spec &mdash; loose strands are the classic hot-joint. Adjacent blocks at different voltages need a partition or spacing.',
    mistakes:'No ferrules &middot; unlabeled terminals ("it was obvious at the time") &middot; a jumper bar bridging one block too far &middot; mixing 230 V and SELV side by side without separation.' },
  thermostat:{ purpose:'Room thermostat: measures air temperature and switches the heating/cooling demand signal. Click it on the plan to simulate a call for heat.',
    terminals:'Electronic stats: <b>L</b> and <b>N</b> for power plus switched-live outputs (commonly <b>3</b> = heat, <b>4</b> = cool). Volt-free models: <b>COM / NO / NC</b> dry contacts.',
    safety:'"Volt-free" contacts can still carry 230 V fed from elsewhere &mdash; always prove dead. The stat\'s tiny contact must never switch a compressor directly; drive a contactor.',
    mistakes:'Mounting above a radiator, in sunlight or on an outside wall (false readings) &middot; switching the neutral &middot; exceeding the contact rating with an inductive load &middot; long unscreened stat cable run beside mains picking up interference.' },
  pressuresw:{ purpose:'Pressure switch (KP style): opens or closes a control circuit at a set refrigerant or water pressure &mdash; HP safety cutout, LP loss-of-charge protection, or pump control.',
    terminals:'Dry contact <b>COM / NO / NC</b> (often marked 1-2-4) in the control circuit; \u00bc" flare or capillary connection to the pressure side. Range and differential set by the two spindles.',
    safety:'A high-pressure cutout is a <b>safety device</b> &mdash; manual-reset types must stay manual-reset, never bridged. The refrigerant side holds pressure even with power off.',
    mistakes:'"Adjusting" the range spindle without gauges connected &middot; jumping out a tripping HP switch to keep a system running &middot; differential set too tight, so the plant short-cycles itself to death.' }
});

function compInfoFor(comp){
  const def=libDef(comp.type)||{};
  return COMPONENT_INFO[comp.type] || SHAPE_INFO[def.shape] || null;
}

/* ============================================================
   DETAIL CARD  — hover a component to preview, click to pin
   (purely additive listeners: selection, dragging and wiring
    behave exactly as before)
   ============================================================ */
let infoPinnedId=null, infoShowTimer=null, infoHideTimer=null, infoCurrentId=null;
function infoEl(){ return document.getElementById('compInfo'); }
function hideCompInfo(force){
  if(infoPinnedId!==null && !force) return;
  infoPinnedId=null; infoCurrentId=null;
  clearTimeout(infoShowTimer); clearTimeout(infoHideTimer);
  const el=infoEl(); if(el) el.style.display='none';
}
function compInfoHTML(comp, pinned){
  const def=libDef(comp.type)||{};
  const info=compInfoFor(comp);
  const v=compVoltage(comp);
  const cat=def.cat? catColor(def.cat) : '#f0a830';
  let body='';
  if(info){
    body=`
      <div class="ci-sec"><div class="ci-h" style="color:var(--blue)">Purpose</div><div class="ci-b">${info.purpose}</div></div>
      <div class="ci-sec"><div class="ci-h" style="color:var(--teal)">EU wiring terminals</div><div class="ci-b">${info.terminals}</div></div>
      <div class="ci-sec"><div class="ci-h" style="color:var(--red)">Safety</div><div class="ci-b">${info.safety}</div></div>
      <div class="ci-sec"><div class="ci-h" style="color:var(--amber)">Beginner mistakes</div><div class="ci-b">${info.mistakes}</div></div>`;
  } else {
    body=`<div class="ci-sec"><div class="ci-b" style="color:var(--text-dim)">No detail sheet for this part yet. Rated ${comp.watts||0} W at ${v} V.</div></div>`;
  }
  return `
    <div class="ci-head">
      <svg viewBox="-20 -20 40 40" class="ci-ico" xmlns="http://www.w3.org/2000/svg">${iconInner(def.shape||'custom', cat, {type:comp.type})}</svg>
      <div class="ci-title">
        <div class="ci-name">${esc(comp.label||def.label||comp.type)}</div>
        <div class="ci-meta">${v} V &middot; ${comp.watts||0} W${def.cont?' &middot; continuous':''}${def.phase3?' &middot; 3~':''}</div>
      </div>
      <button class="ci-close" data-ciclose title="Close">&times;</button>
    </div>
    ${body}
    <div class="ci-foot">${pinned?'Pinned &mdash; press Esc or &times; to close':'Click the component to pin this card'}</div>`;
}
function showCompInfo(comp, clientX, clientY, pinned){
  const el=infoEl(), wrap=document.getElementById('canvasWrap');
  if(!el||!wrap||!comp) return;
  infoCurrentId=comp.id;
  if(pinned) infoPinnedId=comp.id;
  el.innerHTML=compInfoHTML(comp, !!infoPinnedId);
  el.style.display='block';
  const wr=wrap.getBoundingClientRect();
  let x=clientX-wr.left+16, y=clientY-wr.top+12;
  const pw=el.offsetWidth, ph=el.offsetHeight;
  if(x+pw>wr.width-10) x=Math.max(10, clientX-wr.left-pw-16);
  if(y+ph>wr.height-10) y=Math.max(10, wr.height-ph-10);
  el.style.left=x+'px'; el.style.top=y+'px';
  const cb=el.querySelector('[data-ciclose]');
  if(cb) cb.onclick=(e)=>{ e.stopPropagation(); hideCompInfo(true); };
}
function initCompInfo(){
  const svg=svgEl(), el=infoEl();
  if(!svg||!el) return;
  svg.addEventListener('mouseover',e=>{
    if(ui.tool!=='select') return;
    const t=e.target.closest('[data-id]'); if(!t) return;
    const comp=findComp(parseInt(t.dataset.id)); if(!comp) return;
    clearTimeout(infoShowTimer); clearTimeout(infoHideTimer);
    if(infoPinnedId!==null && infoPinnedId!==comp.id) return;
    infoShowTimer=setTimeout(()=>{ if(dragId===null && !isPanning) showCompInfo(comp,e.clientX,e.clientY,false); },350);
  });
  svg.addEventListener('mouseout',e=>{
    const t=e.target.closest('[data-id]'); if(!t) return;
    clearTimeout(infoShowTimer);
    if(infoPinnedId===null) infoHideTimer=setTimeout(()=>hideCompInfo(),250);
  });
  svg.addEventListener('mousedown',()=>{ clearTimeout(infoShowTimer); if(infoPinnedId===null) hideCompInfo(); });
  svg.addEventListener('click',e=>{
    if(ui.tool!=='select'||dragMoved) return;
    const t=e.target.closest('[data-id]');
    if(!t){ hideCompInfo(true); return; }
    const comp=findComp(parseInt(t.dataset.id)); if(!comp) return;
    showCompInfo(comp,e.clientX,e.clientY,true);
  });
  svg.addEventListener('wheel',()=>{ if(infoPinnedId===null) hideCompInfo(); },{passive:true});
  el.addEventListener('mouseenter',()=>clearTimeout(infoHideTimer));
  el.addEventListener('mouseleave',()=>{ if(infoPinnedId===null) infoHideTimer=setTimeout(()=>hideCompInfo(),250); });
  window.addEventListener('keydown',e=>{ if(e.key==='Escape') hideCompInfo(true); });
}


function iconInner(shape, color, comp, opts){
  opts=opts||{};
  const lit=!!opts.powered;            // device is energized
  const on = opts.on;                  // switch position (true/false/null)
  const glyph=(comp&&libDef(comp.type).glyph)||'';
  // realistic technical-illustration renderers (see REAL_RENDER registry above)
  const rr=realRenderFor(shape, comp||{});
  if(rr) return rr(color, comp||{}, opts, glyph);
  // shared bits
  const screw=(x,y)=>`<circle cx="${x}" cy="${y}" r="1.3" fill="#b9b2a0"/><line x1="${x-1}" y1="${y}" x2="${x+1}" y2="${y}" stroke="#7c7666" stroke-width="0.5"/>`;
  const plate=(w,h,r)=>`<rect x="${-w/2-0.6}" y="${-h/2+1}" width="${w+1.2}" height="${h}" rx="${r+1}" fill="#000000" opacity="0.16"/><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="${r}" fill="url(#plateGrad)" stroke="#b7b0a0" stroke-width="0.8"/><rect x="${-w/2+1}" y="${-h/2+1}" width="${w-2}" height="2.2" rx="1.2" fill="#ffffff" opacity="0.4"/>`;
  const accent=(w,h)=>`<rect x="${-w/2}" y="${h/2-3}" width="${w}" height="3" rx="1.5" fill="${color}" opacity="0.9"/>`; // circuit colour tab
  const liveDot=(x,y)=>`<circle cx="${x}" cy="${y}" r="1.7" fill="${lit?'#5fd394':'#3a4658'}"/>${lit?`<circle cx="${x}" cy="${y}" r="3.4" fill="#5fd394" opacity="0.35"/>`:''}`;

  switch(shape){
    case 'panel': return `
      <rect x="-20" y="-27" width="40" height="54" rx="3" fill="url(#metalGrad)" stroke="#11151c" stroke-width="1.6"/>
      <rect x="-16" y="-23" width="32" height="46" rx="2" fill="#1b212b" stroke="#0c1016" stroke-width="1"/>
      ${[-16,-8,0,8,16].map(y=>`<rect x="-12" y="${y-2.4}" width="11" height="4.8" rx="1" fill="#3a4350"/><rect x="1" y="${y-2.4}" width="11" height="4.8" rx="1" fill="#3a4350"/><rect x="${-1.5}" y="${y-3}" width="3" height="6" rx="1" fill="${color}" opacity="0.5"/>`).join('')}
      <circle cx="14" cy="-23.5" r="1.4" fill="#cfd6df"/>`;
    case 'subpanel': return `
      <rect x="-15" y="-21" width="30" height="42" rx="3" fill="url(#metalGrad)" stroke="#11151c" stroke-width="1.4"/>
      <rect x="-11.5" y="-17" width="23" height="34" rx="2" fill="#1b212b" stroke="#0c1016" stroke-width="0.8"/>
      ${[-11,-3,5,13].map(y=>`<rect x="-8" y="${y-2}" width="7" height="4" rx="1" fill="#3a4350"/><rect x="1" y="${y-2}" width="7" height="4" rx="1" fill="#3a4350"/>`).join('')}`;
    case 'splitter': return `
      <line x1="0" y1="0" x2="-15" y2="-13" stroke="${color}" stroke-width="2"/><line x1="0" y1="0" x2="15" y2="-13" stroke="${color}" stroke-width="2"/>
      <line x1="0" y1="0" x2="-15" y2="13" stroke="${color}" stroke-width="2"/><line x1="0" y1="0" x2="15" y2="13" stroke="${color}" stroke-width="2"/>
      <circle cx="-15" cy="-13" r="2.6" fill="${color}"/><circle cx="15" cy="-13" r="2.6" fill="${color}"/><circle cx="-15" cy="13" r="2.6" fill="${color}"/><circle cx="15" cy="13" r="2.6" fill="${color}"/>
      <circle r="9" fill="#cfd3d8" stroke="#8d949c" stroke-width="1"/><circle r="9" fill="url(#domeGrad)"/><circle r="4" fill="none" stroke="${color}" stroke-width="2"/>`;
    case 'disconnect': return `
      <rect x="-13" y="-15" width="26" height="30" rx="3" fill="url(#metalGrad)" stroke="#11151c" stroke-width="1.4"/>
      <rect x="-9.5" y="-11.5" width="19" height="23" rx="2" fill="#1b212b"/>
      <circle cx="-5" cy="-2" r="2" fill="${color}"/><line x1="-5" y1="-2" x2="7" y2="-9" stroke="${color}" stroke-width="2.4"/><circle cx="7" cy="2" r="2" fill="${color}"/>`;
    case 'outlet': case 'gfci': case 'usboutlet': case 'floorbox': {
      const gf=shape==='gfci';
      return `${plate(26,30,5)}${screw(0,-12)}${screw(0,12)}
        <rect x="-9.5" y="-9.5" width="19" height="19" rx="3" fill="#efeade" stroke="#cdc6b5" stroke-width="0.7"/>
        <circle cx="0" cy="-4.5" r="5.4" fill="#fbf8f0" stroke="#d8d1c0" stroke-width="0.7"/>
        <rect x="-1" y="-6.5" width="2" height="3.2" rx="0.6" fill="#2a2a2a"/><rect x="-3.4" y="-5.6" width="1.6" height="2.4" fill="#2a2a2a"/><rect x="1.8" y="-5.6" width="1.6" height="2.4" fill="#2a2a2a"/>
        <circle cx="0" cy="5" r="5.4" fill="#fbf8f0" stroke="#d8d1c0" stroke-width="0.7"/>
        <rect x="-1" y="3" width="2" height="3.2" rx="0.6" fill="#2a2a2a"/><rect x="-3.4" y="3.9" width="1.6" height="2.4" fill="#2a2a2a"/><rect x="1.8" y="3.9" width="1.6" height="2.4" fill="#2a2a2a"/>
        ${gf?`<rect x="-2.4" y="-1.6" width="4.8" height="2.4" rx="0.6" fill="#d6452f"/>`:''}
        ${accent(26,30)}${liveDot(8.5,-12.5)}`;
    }
    case 'outlet240': return `
      <circle r="14" fill="url(#plateGrad)" stroke="#b7b0a0" stroke-width="0.8"/>${screw(0,-11)}${screw(0,11)}
      <circle r="9.5" fill="#efeade" stroke="#cdc6b5" stroke-width="0.8"/>
      <path d="M -4 -6 L -6.5 -1.5 L -1.5 -1.5 Z" fill="#2a2a2a"/><path d="M 4 -6 L 6.5 -1.5 L 1.5 -1.5 Z" fill="#2a2a2a"/>
      <path d="M 0 7 a 3 3 0 1 1 0.01 0" fill="none" stroke="#2a2a2a" stroke-width="2"/>
      <circle cx="10" cy="-9" r="1.6" fill="${color}"/>${liveDot(10,9)}`;
    case 'light': case 'pendant': case 'chandelier': {
      const glow=lit?`<circle r="20" fill="url(#glowGrad)"/>`:'';
      const bulb=lit?'#ffe89a':'#46506280';
      const stroke=lit?'#f5c542':color;
      if(shape==='chandelier') return `${glow}<line x1="0" y1="-13" x2="0" y2="-5" stroke="${stroke}" stroke-width="1.6"/><line x1="-11" y1="0" x2="11" y2="0" stroke="${stroke}" stroke-width="2"/>
        <circle cx="-11" cy="3" r="2.8" fill="${bulb}" stroke="${stroke}" stroke-width="1"/><circle cx="0" cy="5" r="2.8" fill="${bulb}" stroke="${stroke}" stroke-width="1"/><circle cx="11" cy="3" r="2.8" fill="${bulb}" stroke="${stroke}" stroke-width="1"/>`;
      if(shape==='pendant') return `${glow}<line x1="0" y1="-13" x2="0" y2="-3" stroke="${stroke}" stroke-width="1.6"/><path d="M -8 7 Q 0 -6 8 7 Z" fill="${bulb}" stroke="${stroke}" stroke-width="2"/>`;
      return `${glow}<circle r="10" fill="${bulb}" stroke="${stroke}" stroke-width="2.4"/>
        <path d="M -4 4 q 4 -3 8 0" fill="none" stroke="${lit?'#caa238':stroke}" stroke-width="1.2"/>
        <rect x="-3" y="8" width="6" height="3" rx="1" fill="${stroke}"/>`;
    }
    case 'recessed': return `
      ${lit?'<circle r="16" fill="url(#glowGrad)"/>':''}
      <circle r="11" fill="#e9e6dd" stroke="#c6bfae" stroke-width="1.4"/>
      <circle r="7" fill="${lit?'#fff3cf':'#2a3346'}" stroke="${lit?'#f0c84a':'#46506280'}" stroke-width="1"/>
      <circle r="7" fill="${lit?'#fff3cf':'#2a3346'}"/>`;
    case 'fan': {
      const sp=lit?'<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.4s" repeatCount="indefinite"/>':'';
      return `<circle r="13" fill="#20283440"/><g>${sp}
        <path d="M0,0 Q9,-3 11,-9 Q4,-9 0,0" fill="${color}" opacity="0.9"/><path d="M0,0 Q3,9 9,11 Q9,4 0,0" fill="${color}" opacity="0.9"/>
        <path d="M0,0 Q-9,3 -11,9 Q-4,9 0,0" fill="${color}" opacity="0.9"/><path d="M0,0 Q-3,-9 -9,-11 Q-9,-4 0,0" fill="${color}" opacity="0.9"/></g>
        <circle r="2.6" fill="#cfd6df"/>`;
    }
    case 'led': return `<rect x="-13" y="-4" width="26" height="8" rx="4" fill="#1a2740" stroke="${color}" stroke-width="1.4"/>
      ${[-7,0,7].map(x=>`<circle cx="${x}" cy="0" r="1.8" fill="${lit?'#fff0b0':'#3a4658'}"/>${lit?`<circle cx="${x}" cy="0" r="3.4" fill="#ffe070" opacity="0.4"/>`:''}`).join('')}`;
    case 'flood': return `${lit?'<circle cx="0" cy="0" r="16" fill="url(#glowGrad)"/>':''}
      <path d="M -9 -8 L 9 -8 L 12 8 L -12 8 Z" fill="url(#metalGrad)" stroke="#11151c" stroke-width="1.2"/>
      ${[-5,0,5].map(x=>`<rect x="${x-1}" y="-2" width="2" height="6" rx="1" fill="${lit?'#fff0b0':'#2a3346'}"/>`).join('')}`;
    case 'switch': {
      const up = on!==false;
      return `${plate(18,30,3)}${screw(0,-12.5)}${screw(0,12.5)}
        <rect x="-6" y="-11" width="12" height="22" rx="2" fill="#efeade" stroke="#cdc6b5" stroke-width="0.7"/>
        <rect x="-4" y="${up?-9:0}" width="8" height="9" rx="2" fill="${up?'#fbf8f0':'#d9d3c4'}" stroke="#bdb6a4" stroke-width="0.6"/>
        <rect x="-4" y="${up?-9:0}" width="8" height="3" rx="1.5" fill="#ffffff" opacity="0.5"/>
        ${accent(18,30)}<circle cx="0" cy="${up?-13.5:13.5}" r="1.4" fill="${up?'#5fd394':'#3a4658'}"/>`;
    }
    case 'dimmer': {
      const lev = on!==false? -4 : 4;
      return `${plate(18,30,3)}${screw(0,-12.5)}${screw(0,12.5)}
        <rect x="-6" y="-11" width="12" height="22" rx="2" fill="#efeade" stroke="#cdc6b5" stroke-width="0.7"/>
        <line x1="0" y1="-8" x2="0" y2="8" stroke="#bdb6a4" stroke-width="1.4"/>
        <rect x="-5" y="${lev-2}" width="10" height="5" rx="2" fill="#fbf8f0" stroke="#bdb6a4" stroke-width="0.6"/>
        ${accent(18,30)}`;
    }
    case 'appliance': return `
      <rect x="-15" y="-15" width="30" height="30" rx="4" fill="url(#applGrad)" stroke="#2a3344" stroke-width="1.4"/>
      <rect x="-15" y="-15" width="30" height="9" rx="4" fill="#ffffff" opacity="0.06"/>
      <text text-anchor="middle" dominant-baseline="central" y="0" font-size="${glyph.length>1?10:13}" font-weight="700" fill="${color}">${esc(glyph||'A')}</text>
      ${liveDot(11,11)}`;
    case 'ac': {
      const sp=lit?'<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1s" repeatCount="indefinite"/>':'';
      return `<rect x="-15" y="-12" width="30" height="24" rx="3" fill="url(#applGrad)" stroke="#2a3344" stroke-width="1.4"/>
        <g transform="translate(0,0)"><g>${sp}<path d="M0,-7 Q2,-2 0,0 Q-2,-2 0,-7" fill="${color}"/><path d="M7,0 Q2,2 0,0 Q2,-2 7,0" fill="${color}"/><path d="M0,7 Q-2,2 0,0 Q2,2 0,7" fill="${color}"/><path d="M-7,0 Q-2,-2 0,0 Q-2,2 -7,0" fill="${color}"/></g><circle r="1.6" fill="#cfd6df"/></g>
        ${liveDot(11,8.5)}`;
    }
    case 'heat': return `
      <rect x="-15" y="-12" width="30" height="24" rx="3" fill="url(#applGrad)" stroke="#2a3344" stroke-width="1.4"/>
      <path d="M-9,7 Q-9,-7 -5,-7 Q-1,-7 -1,7 Q-1,-7 3,-7 Q7,-7 7,7" fill="none" stroke="${lit?'#ff8a5b':color}" stroke-width="1.8"/>
      ${liveDot(11,8.5)}`;
    case 'water': return `
      <path d="M0,-14 C8,-4 11,2 11,6 A11,11 0 1 1 -11,6 C-11,2 -8,-4 0,-14 Z" fill="url(#applGrad)" stroke="#2a3344" stroke-width="1.6"/>
      <path d="M-5,2 a5,5 0 0 0 5,7" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.4"/>
      <text text-anchor="middle" dominant-baseline="central" y="3" font-size="8.5" font-weight="700" fill="${color}">${esc(glyph)}</text>`;
    case 'motor': {
      const sp=lit?'<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="0.9s" repeatCount="indefinite"/>':'';
      return `<circle r="13" fill="url(#applGrad)" stroke="#2a3344" stroke-width="1.4"/>
        <g>${sp}${[0,60,120,180,240,300].map(a=>`<rect x="-1" y="-12" width="2" height="4" rx="1" fill="${color}" transform="rotate(${a})"/>`).join('')}</g>
        <text text-anchor="middle" dominant-baseline="central" font-size="${glyph.length>1?9:12}" font-weight="700" fill="${color}">${esc(glyph||'M')}</text>`;
    }
    case 'ev': return `
      <rect x="-13" y="-15" width="26" height="30" rx="4" fill="url(#applGrad)" stroke="#2a3344" stroke-width="1.4"/>
      <rect x="-13" y="-15" width="26" height="8" rx="4" fill="#ffffff" opacity="0.06"/>
      <circle cx="-3.5" cy="-6" r="1.7" fill="${color}"/><circle cx="3.5" cy="-6" r="1.7" fill="${color}"/>
      <path d="M0,-2 L0,3 M-4,3 L4,3 L4,9 L-4,9 Z" stroke="${color}" stroke-width="1.6" fill="none"/>
      <text y="13" text-anchor="middle" font-size="6.5" fill="${color}">EV</text>${liveDot(10,-11)}`;
    case 'smoke': return `
      <circle r="12.5" fill="#f3f1ea" stroke="#cdc6b5" stroke-width="1.2"/>
      <circle r="12.5" fill="url(#domeGrad)"/>
      ${[0,45,90,135,180,225,270,315].map(a=>`<rect x="-0.7" y="-10" width="1.4" height="3" rx="0.7" fill="#c4bdab" transform="rotate(${a})"/>`).join('')}
      <circle r="2" fill="${lit?'#5fd394':'#c4bdab'}"/>${lit?'<circle r="3.6" fill="#5fd394" opacity="0.35"/>':''}`;
    default: return `
      <circle r="14" fill="url(#applGrad)" stroke="#2a3344" stroke-width="1.6"/>
      <text text-anchor="middle" dominant-baseline="central" font-size="${(glyph||'?').length>1?10:13}" font-weight="700" fill="${color}">${esc(glyph||'?')}</text>`;
  }
}

function badgesFor(comp){
  const b=[];
  const v=compVoltage(comp);
  if(comp.gfci) b.push('GFCI');
  if(comp.afci) b.push('AFCI');
  if(v===240) b.push('240V');
  if(comp.cont) b.push('CONT');
  return b;
}

function iconSVG(comp){
  const circuit = isPanelType(comp.type)? null : (comp.circuitId? getCircuit(comp.circuitId):null);
  let color, powered;
  if(comp.type==='panel'){ color='#e8eef5'; powered=panelPowered(comp); }
  else if(comp.type==='subpanel'){ color=circuit?circuit.color:'#cdd8e6'; powered=panelPowered(comp); }
  else if(comp.type==='splitter'){ color=circuit?circuit.color:'#7d93b2'; powered=isLive(comp); }
  else { color=circuit?circuit.color:'#5d7396'; powered=isLive(comp); }
  const swOn = isSwitchType(comp.type) ? switchOn(comp) : null;
  const opacity=powered?1:0.42;
  const d=libDef(comp.type);
  const selected=comp.id===ui.selectedId;
  const pending=comp.id===((ui.wireDraft&&ui.wireDraft.from)||ui.pendingWireFrom);

  // hover/title
  const v=compVoltage(comp);
  const amps=(comp.watts||0)/v;
  const tparts=[comp.label];
  if(comp.room) tparts.push('('+comp.room+')');
  let titleText=esc(tparts.join(' '));
  if(isSwitchType(comp.type)) titleText+=`&#10;Switch ${swOn?'ON':'OFF'} \u2014 click the handle to flip`;
  else if(!isPanelType(comp.type)) titleText+=`&#10;${powered?'LIVE \u00b7 ':'off \u00b7 '}${comp.watts||0} W \u00b7 ${fmt(amps)} A @ ${v}V`;
  if(comp.notes) titleText+='&#10;'+esc(comp.notes);

  const ring=selected
    ? `<circle r="24" fill="none" stroke="#fff" stroke-width="1" stroke-dasharray="3 3" opacity="0.85"/>`
    : pending
      ? `<circle r="24" fill="none" stroke="var(--green)" stroke-width="1.6" stroke-dasharray="3 3" class="pulse-ring"/>`
      : '';

  const inner=iconInner(d.shape||'custom', color, comp, { powered, on:swOn });
  const badges=badgesFor(comp);

  // sub-label lines
  let lines='';
  let ly=28;
  lines+=`<text y="${ly}" text-anchor="middle" font-size="8.5" fill="#9fb3c8">${esc(comp.label)}</text>`; ly+=10;
  if(comp.type==='panel'){
    const pl=panelLoad(comp.id);
    lines+=`<text y="${ly}" text-anchor="middle" font-size="7.5" fill="#5d7396">${comp.mainAmp}A \u00b7 ${fmt(pl.liveAmps)}A now</text>`;
  } else if(comp.type==='subpanel'){
    const pl=panelLoad(comp.id);
    lines+=`<text y="${ly}" text-anchor="middle" font-size="7.5" fill="#5d7396">${comp.mainAmp}A sub \u00b7 ${fmt(pl.liveAmps)}A now</text>`;
  } else if(comp.type==='splitter'){
    const sl=splitterLoad(comp);
    lines+=`<text y="${ly}" text-anchor="middle" font-size="7.5" fill="${sl.color}">${sl.count} \u00b7 ${fmt(sl.amps)}/${sl.max}A</text>`;
  } else if(isSwitchType(comp.type)){
    lines+=`<text y="${ly}" text-anchor="middle" font-size="8" font-weight="700" fill="${swOn?'var(--green)':'var(--text-dimmer)'}">${swOn?'ON':'OFF'}</text>`;
  } else if(!isControl(comp.type) && comp.watts>0){
    lines+=`<text y="${ly}" text-anchor="middle" font-size="7.5" fill="${powered?'#7fe0a8':'#5d7396'}">${powered?fmt(amps)+'A now':'off'} \u00b7 ${comp.watts}W</text>`;
  }
  ly+=9;
  if(badges.length) lines+=`<text y="${ly}" text-anchor="middle" font-size="7" fill="var(--amber)" font-weight="600">${esc(badges.join(' \u00b7 '))}</text>`;

  // clickable toggle handle for switches
  let switchHit='';
  if(isSwitchType(comp.type)) switchHit=`<rect data-switch="${comp.id}" x="-11" y="-15" width="22" height="30" rx="3" fill="transparent" style="cursor:pointer"/>`;

  const cursor = ui.tool==='select'?'grab':'pointer';
  const rot = comp.rot? ` rotate(${comp.rot})`:'';
  const s = (comp.scale||1) * (state.settings.symbolScale||1);
  const scaleAttr = s!==1? ` scale(${s})` : '';
  return `<g class="comp-icon" data-id="${comp.id}" transform="translate(${comp.x},${comp.y})${scaleAttr}" style="cursor:${cursor};opacity:${opacity}">
    <title>${titleText}</title>
    ${ring}
    <g transform="${rot? rot.trim():''}">${inner}${switchHit}</g>
    ${lines}
  </g>`;
}

/* ============================================================
   VIEW / ZOOM / PAN
   ============================================================ */
function applyView(){
  const svg=svgEl();
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  ['bgRect','bgRectMajor'].forEach(id=>{
    const r=document.getElementById(id);
    r.setAttribute('x',view.x-2000); r.setAttribute('y',view.y-2000);
    r.setAttribute('width',view.w+4000); r.setAttribute('height',view.h+4000);
  });
  const z=Math.round((svg.clientWidth/view.w)*100);
  const zr=document.getElementById('zoomReadout'); if(zr) zr.textContent=isFinite(z)?z+'%':'100%';
}
function zoomAt(factor, cx, cy){
  const newW=clamp(view.w/factor, 250, 6000);
  const newH=newW*(view.h/view.w);
  // keep point under cursor stable
  view.x = cx-(cx-view.x)*(newW/view.w);
  view.y = cy-(cy-view.y)*(newH/view.h);
  view.w=newW; view.h=newH;
  applyView();
}
function zoomButton(f){
  const svg=svgEl();
  const cx=view.x+view.w/2, cy=view.y+view.h/2;
  zoomAt(f,cx,cy);
}
function fitView(){
  const items=[...state.components.map(c=>({x:c.x,y:c.y})),
    ...state.walls.flatMap(w=>[{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}])];
  if(!items.length){ view={x:0,y:0,w:1400,h:900}; applyView(); return; }
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  items.forEach(p=>{ minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y); });
  const pad=120;
  minX-=pad;minY-=pad;maxX+=pad;maxY+=pad;
  const svg=svgEl();
  const aspect=svg.clientWidth/svg.clientHeight || 1.55;
  let w=maxX-minX, h=maxY-minY;
  if(w/h<aspect) w=h*aspect; else h=w/aspect;
  view={ x:(minX+maxX)/2-w/2, y:(minY+maxY)/2-h/2, w, h };
  applyView();
}

/* ============================================================
   CANVAS RENDER
   ============================================================ */
function renderCanvas(){
  invalidateLive();
  // walls
  let wallHtml=state.walls.map(w=>{
    const sel=w.id===ui.selectedWallId;
    const lenFt=fmt(pxToFt(Math.hypot(w.x2-w.x1,w.y2-w.y1)));
    const mx=(w.x1+w.x2)/2, my=(w.y1+w.y2)/2;
    return `<g data-wall-id="${w.id}" style="cursor:${ui.tool==='select'?'pointer':'default'}">
      <line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="transparent" stroke-width="18"/>
      <line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="#2c4566" stroke-width="9" stroke-linecap="round"/>
      <line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${sel?'#ffffff':'#5a78a3'}" stroke-width="${sel?2.5:1.6}" stroke-linecap="round"/>
      ${sel?`<text x="${mx}" y="${my-8}" text-anchor="middle" font-size="11" fill="#fff">${lenFt} ${esc(unitLabel())}</text>`:''}
    </g>`;
  }).join('');
  if(ui.tool==='wall' && ui.wallDraftStart && ui.wallPreviewPoint){
    const s=ui.wallDraftStart,p=ui.wallPreviewPoint;
    const lenFt=fmt(pxToFt(Math.hypot(p.x-s.x,p.y-s.y)));
    wallHtml+=`<line x1="${s.x}" y1="${s.y}" x2="${p.x}" y2="${p.y}" stroke="#5a78a3" stroke-width="9" stroke-dasharray="4 5" opacity="0.6" stroke-linecap="round"/>
      <text x="${(s.x+p.x)/2}" y="${(s.y+p.y)/2-8}" text-anchor="middle" font-size="11" fill="#9fb3c8">${lenFt} ${esc(unitLabel())}</text>`;
  }
  document.getElementById('wallLayer').innerHTML=wallHtml;

  // wires (routed polylines) -- realistic conductor bundles + live energy flow
  const liveSet=ensureLive();
  let wireHtml='', hitHtml='', wireLabels='';
  state.connections.forEach(conn=>{
    const path=wirePath(conn);
    if(!path) return;
    const ptsStr=path.map(p=>`${p.x},${p.y}`).join(' ');
    const a=findComp(conn.fromId), b=findComp(conn.toId);
    const color=wireColor(conn);
    const circuit=wireCircuitFor(conn);
    // energized only if both ends are live (or one end is a live panel feeding it)
    const endLive = c=> c ? (isPanelType(c.type)? panelPowered(c) : liveSet.has(c.id)) : false;
    const energized = circuit && circuitPowered(circuit) && endLive(a) && endLive(b);
    const sel=conn.id===ui.selectedConnId;
    const vd=wireVoltageDrop(conn);
    const warn = vd && vd.dropPct>3;
    const dash = conn.run==='ceiling' ? 'stroke-dasharray="9 5"' : (conn.run==='floor' ? 'stroke-dasharray="2 5"' : '');

    if(state.settings.showConductors!==false){
      // draw the cable jacket then each colored conductor offset across the run
      const cols=conductorsFor(conn);
      const n=cols.length, spread=2.1;
      wireHtml+=`<polyline points="${ptsStr}" fill="none" stroke="#0c1422" stroke-width="${n*spread+5}" stroke-linejoin="round" stroke-linecap="round" opacity="${energized?0.5:0.32}" style="pointer-events:none"/>`;
      cols.forEach((col,i)=>{
        const off=(i-(n-1)/2)*spread;
        const op=energized?1:0.4;
        const isHot = col.hot;
        wireHtml+=`<polyline points="${offsetPath(path,off)}" fill="none" stroke="${col.c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" opacity="${op}" ${dash}/>`;
        if(energized && isHot && state.settings.showFlow!==false){
          wireHtml+=`<polyline class="flow" points="${offsetPath(path,off)}" fill="none" stroke="#fff" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" opacity="0.8" style="pointer-events:none"/>`;
        }
      });
      if(sel) wireHtml+=`<polyline points="${ptsStr}" fill="none" stroke="#fff" stroke-width="${n*spread+7}" stroke-linejoin="round" opacity="0.18" style="pointer-events:none"/>`;
    } else {
      if(energized && state.settings.showFlow!==false){
        wireHtml+=`<polyline points="${ptsStr}" fill="none" stroke="${color}" stroke-width="${sel?4:2.6}" stroke-linejoin="round" stroke-linecap="round" opacity="0.5" ${dash} style="pointer-events:none"/>`;
        wireHtml+=`<polyline class="flow" points="${ptsStr}" fill="none" stroke="${warn?'var(--red)':color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style="pointer-events:none"/>`;
      } else {
        wireHtml+=`<polyline points="${ptsStr}" fill="none" stroke="${sel?'#fff':color}" stroke-width="${sel?3:2}" stroke-linejoin="round" stroke-linecap="round" opacity="${energized?0.55:0.22}" ${dash} style="pointer-events:none"/>`;
      }
    }
    // live current at the routed midpoint
    if(vd && circuit){
      const liveA = energized ? circuitLoad(circuit).liveAmps : 0;
      if(energized || sel){
        const mid=pathMidpoint(path);
        wireLabels+=`<g style="pointer-events:none" transform="translate(${mid.x},${mid.y})">
          <rect x="-26" y="-9" width="52" height="14" rx="7" fill="#081020" opacity="0.82"/>
          <text text-anchor="middle" y="1.5" font-size="9" font-weight="600" fill="${warn?'var(--red)':(energized?'#7fe0a8':'#5d7396')}">${fmt(liveA)} A</text></g>`;
      }
    }
    hitHtml+=`<polyline data-conn-id="${conn.id}" points="${ptsStr}" fill="none" stroke="transparent" stroke-width="14" style="cursor:${ui.tool==='select'?'pointer':'default'}"/>`;
  });
  document.getElementById('wireLayer').innerHTML=wireHtml+wireLabels+hitHtml;

  // icons
  document.getElementById('iconLayer').innerHTML = state.components.map(iconSVG).join('');

  // overlay: ghost placement, wire-routing rubber band, selected wire bend handles
  let ov='';
  if(ui.tool==='place' && ui.placeType && ui.mouseWorld){
    const p=snap(ui.mouseWorld);
    const d=libDef(ui.placeType);
    ov+=`<g transform="translate(${p.x},${p.y})" opacity="0.5">${iconInner(d.shape||'custom','#f0a830',{type:ui.placeType})}</g>`;
  }
  if(ui.tool==='wire' && ui.wireDraft){
    const from=findComp(ui.wireDraft.from);
    if(from){
      const chain=[{x:from.x,y:from.y}, ...ui.wireDraft.points];
      if(ui.wirePreview) chain.push(ui.wirePreview);
      ov+=`<polyline points="${chain.map(p=>p.x+','+p.y).join(' ')}" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 5" stroke-linejoin="round" opacity="0.85" style="pointer-events:none"/>`;
      ui.wireDraft.points.forEach(p=>{ ov+=`<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--green)" stroke="#081020" stroke-width="1.5" style="pointer-events:none"/>`; });
    }
  }
  // bend handles for the selected wire
  if(ui.tool==='select' && ui.selectedConnId!=null){
    const conn=state.connections.find(c=>c.id===ui.selectedConnId);
    if(conn){
      (conn.points||[]).forEach((p,i)=>{
        ov+=`<circle data-wp="${conn.id}" data-wpi="${i}" cx="${p.x}" cy="${p.y}" r="6" fill="var(--amber)" stroke="#081020" stroke-width="1.5" style="cursor:grab"/>`;
      });
    }
  }
  document.getElementById('overlayLayer').innerHTML=ov;
}
function unitLabel(){ return ftPer()===1?'ft':('ft'); }

/* ============================================================
   PART LIBRARY (left panel)
   ============================================================ */
function partIconSVG(def){
  return `<svg class="part-ico" viewBox="-20 -20 40 40" xmlns="http://www.w3.org/2000/svg">${iconInner(def.shape||'custom', def.cat? catColor(def.cat):'#f0a830', {type:def.type})}</svg>`;
}
function catColor(key){ const c=CATEGORIES.find(c=>c.key===key); return c?c.color:'var(--amber)'; }
function partSubLabel(def){
  if(def.isPanel) return def.isSub?'sub-panel':'service';
  if(def.node) return 'feeds parts';
  if(def.control) return 'control';
  if((def.watts||0)===0) return def.v+'V';
  const a=(def.watts/(def.v||120));
  return `${def.watts}W \u00b7 ${fmt(a)}A \u00b7 ${def.v}V`;
}
const PART_DESC={
  panel:'Where power comes in and splits into circuits.',
  subpanel:'A second, smaller panel for a garage or addition.',
  splitter:'A junction where one circuit branches to several parts.',
  disconnect:'A local on/off to isolate equipment for service.',
  outlet:'Standard wall socket \u2014 lamps, chargers, the TV.',
  outlet20:'Heavier-duty socket for kitchen and counter loads.',
  gfci:'Safety socket for wet areas \u2014 cuts power on a leak.',
  usboutlet:'Wall socket with built-in USB charging.',
  outlet240:'High-power socket for a dryer, range or EV.',
  floorbox:'An outlet set flush into the floor.',
  light:'A ceiling or wall light fixture.',
  recessed:'A light set into the ceiling (a \u201ccan\u201d).',
  pendant:'A single light hanging on a cord.',
  chandelier:'A larger decorative hanging light.',
  fan:'A ceiling fan.',
  fanlight:'A ceiling fan with a built-in light.',
  ledstrip:'A run of LED strip lighting.',
  outdoorlight:'An exterior wall light.',
  flood:'A bright outdoor floodlight.',
  switch:'Turns a light on and off.',
  switch3:'One of a pair \u2014 controls a light from two places.',
  dimmer:'Turns a light on/off and sets brightness.',
  motion:'Switches a light on when it senses movement.',
  smartsw:'App or voice-controlled switch.',
  fridge:'Refrigerator \u2014 usually its own circuit.',
  dishwasher:'Dishwasher \u2014 built-in under the counter.',
  microwave:'Microwave \u2014 often a dedicated circuit.',
  disposal:'Garbage disposal under the sink.',
  range:'Electric range/oven \u2014 big 240V circuit.',
  cooktop:'Cooktop \u2014 240V circuit.',
  walloven:'Wall oven \u2014 240V circuit.',
  smoke:'Smoke / CO alarm.'
};
const CAT_DESC={ dist:'Power distribution.', recep:'A place to plug things in.', light:'Lighting.', switch:'Lighting control.', kitchen:'Kitchen appliance.', laundry:'Laundry appliance.', hvac:'Heating / cooling equipment.', water:'Water-heating equipment.', ev:'EV charging.', safety:'Safety device.', custom:'Custom part.' };
function partDesc(def){ return PART_DESC[def.type] || CAT_DESC[def.cat] || def.label; }
function renderPartLibrary(){
  const filter=ui.partFilter.trim().toLowerCase();
  let html=`<div class="lib-hint">Pick a part, then click the plan to place it.</div>`;
  CATEGORIES.forEach(cat=>{
    let items = cat.key==='custom'
      ? state.customTypes.map(t=>libDef(t.key))
      : LIBRARY.filter(d=>d.cat===cat.key);
    if(filter) items=items.filter(d=>d.label.toLowerCase().includes(filter)||d.type.toLowerCase().includes(filter));
    if(!items.length && (filter || cat.key==='custom' && !state.customTypes.length)) {
      if(filter) return; // hide empty groups while searching
      if(cat.key==='custom'){
        html+=`<div class="cat-group"><div class="cat-head"><span class="cat-dot" style="background:${cat.color}"></span>${esc(cat.label)}</div><div class="cat-items"><div class="empty-hint" style="padding:4px 8px">None yet \u2014 use + Custom Part below.</div></div></div>`;
        return;
      }
      return;
    }
    if(!items.length) return;
    const collapsed = ui.collapsedCats[cat.key] && !filter;
    html+=`<div class="cat-group ${collapsed?'collapsed':''}" data-cat="${cat.key}">
      <div class="cat-head" data-cattoggle="${cat.key}"><span class="cat-dot" style="background:${cat.color}"></span>${esc(cat.label)}<span class="cat-caret">\u25BC</span></div>
      <div class="cat-items">`;
    items.forEach(def=>{
      const active = ui.tool==='place' && ui.placeType===def.type;
      html+=`<div class="part-item ${active?'active':''}" data-place="${def.type}" title="${esc(def.label)} \u2014 ${esc(partDesc(def))}">
        <div class="part-ico-wrap">${partIconSVG(def)}</div>
        <div class="part-meta"><div class="part-name">${esc(def.label)}</div><div class="part-desc">${esc(partDesc(def))}</div><div class="part-spec">${esc(partSubLabel(def))}</div></div>
      </div>`;
    });
    html+=`</div></div>`;
  });
  document.getElementById('partLibrary').innerHTML=html;
  document.querySelectorAll('[data-place]').forEach(el=>{
    el.addEventListener('click',()=>{
      setTool('place', el.dataset.place);
    });
  });
  document.querySelectorAll('[data-cattoggle]').forEach(el=>{
    el.addEventListener('click',()=>{
      const k=el.dataset.cattoggle;
      ui.collapsedCats[k]=!ui.collapsedCats[k];
      renderPartLibrary();
    });
  });
}

/* ============================================================
   TOOLBAR
   ============================================================ */
function renderToolbar(){
  const bar=document.getElementById('toolbar');
  bar.innerHTML=`
    <button class="tool-btn ${ui.tool==='select'?'active':''}" data-t="select" title="Select, move and edit (V)">&#9716; Select</button>
    <button class="tool-btn wire-btn ${ui.tool==='wire'?'active':''}" data-t="wire" title="Wire two parts (W)">&#9586; Wire</button>
    <button class="tool-btn wall-btn ${ui.tool==='wall'?'active':''}" data-t="wall" title="Draw walls (L)">&#9474; Wall</button>
    <button class="tool-btn pan-btn ${ui.tool==='pan'?'active':''}" data-t="pan" title="Pan the view (H)">&#10021; Pan</button>
    <div class="toolbar-sep"></div>
    <button class="tool-btn" id="zOut" title="Zoom out">&minus;</button>
    <span class="zoom-readout" id="zoomReadout">100%</span>
    <button class="tool-btn" id="zIn" title="Zoom in">&plus;</button>
    <button class="tool-btn" id="zFit" title="Fit to content">Fit</button>
    <div class="toolbar-sep"></div>
    <button class="tool-btn" id="undoBtn" title="Undo (Ctrl+Z)">&#8630; Undo</button>
    <button class="tool-btn" id="redoBtn" title="Redo (Ctrl+Shift+Z)">&#8631; Redo</button>
    <div class="toolbar-sep"></div>
    <label class="chk"><input type="checkbox" id="snapChk" ${state.settings.snap?'checked':''}> Snap</label>
    <label class="chk"><input type="checkbox" id="flowChk" ${state.settings.showFlow?'checked':''}> Flow</label>
    <label class="chk"><input type="checkbox" id="condChk" ${state.settings.showConductors!==false?'checked':''}> Wires</label>
    <label class="chk" title="Realistic technical drawings for components (uncheck for classic symbols)"><input type="checkbox" id="realChk" ${state.settings.realistic!==false?'checked':''}> Real</label>
    <span class="tb-sep"></span>
    <label class="chk" title="Resize all floor-plan symbols" style="gap:6px">Size <input type="range" id="sizeRange" min="0.5" max="2.5" step="0.1" value="${state.settings.symbolScale||1}" style="width:84px;accent-color:var(--amber)"></label>
    <div class="toolbar-sep"></div>
    <button class="tool-btn" id="resetPlanBtn" title="Clear the floor plan">&#8635; Reset</button>
  `;
  bar.querySelectorAll('[data-t]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.t)));
  document.getElementById('zOut').addEventListener('click',()=>zoomButton(1/1.25));
  document.getElementById('zIn').addEventListener('click',()=>zoomButton(1.25));
  document.getElementById('zFit').addEventListener('click',fitView);
  document.getElementById('undoBtn').addEventListener('click',undo);
  document.getElementById('redoBtn').addEventListener('click',redo);
  document.getElementById('snapChk').addEventListener('change',e=>{ state.settings.snap=e.target.checked; markDirty(); });
  document.getElementById('flowChk').addEventListener('change',e=>{ state.settings.showFlow=e.target.checked; renderCanvas(); markDirty(); });
  document.getElementById('condChk').addEventListener('change',e=>{ state.settings.showConductors=e.target.checked; renderCanvas(); markDirty(); });
  document.getElementById('realChk').addEventListener('change',e=>{ state.settings.realistic=e.target.checked; renderCanvas(); renderPartLibrary(); markDirty(); });
  const sr=document.getElementById('sizeRange'); if(sr){ sr.addEventListener('input',e=>{ state.settings.symbolScale=parseFloat(e.target.value); renderCanvas(); }); sr.addEventListener('change',()=>markDirty()); }
  const rp=document.getElementById('resetPlanBtn'); if(rp) rp.addEventListener('click',resetFloorPlan);
  applyView();
}

/* ============================================================
   RIGHT SIDEBAR : summary + circuits + inspector
   ============================================================ */
function statusPill(status){
  const map={OK:['OK','var(--green)'],NEAR:['NEAR LIMIT','var(--amber)'],OVER:['OVERLOADED','var(--red)'],OFF:['OFF','var(--text-dimmer)']};
  const [t,c]=map[status]||['',''];
  return `<span class="status-pill" style="background:${c}22;color:${c}">${t}</span>`;
}
function renderSidebar(){
  invalidateLive();
  const main=getMainPanel();
  const totalVA=totalConnectedVA();
  const pl = main? panelLoad(main.id):{amps:0,mainAmp:200,pct:0,color:'var(--green)'};

  let html=`<div class="side-section">
    <div class="side-title">House Summary</div>
    <div class="summary-row"><span>Drawing now</span><b style="color:var(--green)">${fmt(pl.liveAmps||0)} A</b></div>
    <div class="summary-row"><span>Connected load</span><b>${fmt0(totalVA)} W</b></div>
    <div class="summary-row"><span>Sized for (demand)</span><b>${fmt(pl.amps)} / ${pl.mainAmp} A</b></div>
    <div class="meter"><div style="width:${pl.pct}%;background:${pl.color}"></div></div>
    <div class="summary-row"><span>Devices \u00b7 circuits</span><b>${state.components.filter(c=>!isPanelType(c.type)).length} \u00b7 ${state.circuits.length}</b></div>
  </div>`;

  // circuits grouped by panel
  html+=`<div class="side-section"><div class="side-title">Circuits <button class="mini-btn" id="addCircuitTop">+ Add</button></div>`;
  getPanels().forEach(panel=>{
    const cs=panelCircuits(panel.id);
    if(getPanels().length>1) html+=`<div class="part-sub" style="margin:2px 0 6px;color:var(--text-dim)">${esc(panel.label)}</div>`;
    cs.forEach(circuit=>{
      const ld=circuitLoad(circuit);
      const feederTag = ld.isFeeder? `<span class="tag">feeds ${esc(ld.sub.label)}</span>`:'';
      const btTag = circuit.breakerType!=='std'? `<span class="tag">${circuit.breakerType.toUpperCase()}</span>`:'';
      html+=`<div class="circuit-card ${circuit.id===ui.activeCircuit?'active':''}" style="--circuit-color:${circuit.color}" data-circuit="${circuit.id}">
        <div class="cc-top">
          <div class="swatch" style="background:${circuit.color}"></div>
          <div class="cc-name">${esc(circuit.name)}</div>
          <select class="mini-sel" data-poles="${circuit.id}" title="Poles / voltage">
            <option value="1" ${circuit.poles===1?'selected':''}>120V</option>
            <option value="2" ${circuit.poles===2?'selected':''}>240V</option>
          </select>
          <select class="mini-sel" data-amp="${circuit.id}" title="Breaker size">
            ${BREAKER_AMPS.map(a=>`<option value="${a}" ${a===circuit.amp?'selected':''}>${a}A</option>`).join('')}
          </select>
          <button class="power-btn" data-power="${circuit.id}" title="Toggle breaker" style="color:${circuitPowered(circuit)?'var(--green)':'var(--text-dimmer)'}">&#9211;</button>
          <button class="remove-x" data-rmcirc="${circuit.id}" title="Remove circuit">&times;</button>
        </div>
        <div class="meter"><div style="width:${ld.pct}%;background:${ld.color}"></div></div>
        <div class="cc-meta">
          <span>${fmt(ld.liveAmps)}A now \u00b7 ${fmt(ld.adjAmps)}/${circuit.amp}A \u00b7 ${gaugeFor(circuit.amp)}</span>
          ${statusPill(ld.status)}
        </div>
        <div class="pill-row"><span class="tag">${ld.count} parts</span>${btTag}${feederTag}</div>
      </div>`;
    });
  });
  html+=`<button id="addCircuitBtn">+ Add Circuit</button></div>`;

  // inspector
  html+=`<div class="side-section"><div class="side-title">Inspector</div>${inspectorHTML()}</div>`;

  document.getElementById('rightPanel').innerHTML=html;
  wireSidebarEvents();
}

function inspectorHTML(){
  const comp=findComp(ui.selectedId);
  const wall=state.walls.find(w=>w.id===ui.selectedWallId);
  const conn=state.connections.find(c=>c.id===ui.selectedConnId);

  if(comp) return inspectorForComp(comp);
  if(wall){
    const len=fmt(pxToFt(Math.hypot(wall.x2-wall.x1,wall.y2-wall.y1)));
    return `<div class="ins-readout"><div class="ro-line"><span>Wall length</span><b>${len} ${esc(unitLabel())}</b></div></div>
      <button class="danger-btn" id="delWallBtn">Delete wall</button>`;
  }
  if(conn){
    const vd=wireVoltageDrop(conn);
    const warn=vd&&vd.dropPct>3;
    const bends=(conn.points||[]).length;
    return `<div class="ins-readout">
      <div class="ro-big" style="color:${warn?'var(--red)':'var(--green)'}">${fmt(vd.amps)} A</div>
      <div class="ro-line"><span>Current on run</span>${warn?'<span class="status-pill" style="background:var(--red)22;color:var(--red)">HIGH DROP</span>':''}</div>
      <div class="ro-line"><span>Run length</span><b>${fmt(vd.lenFt)} ${esc(unitLabel())}</b></div>
      <div class="ro-line"><span>Conductor</span><b>${esc(vd.gauge)}</b></div>
      <div class="ro-line"><span>Volt drop</span><b style="color:${warn?'var(--red)':'var(--green)'}">${fmt(vd.dropPct)}% (${fmt(vd.dropV)}V)</b></div>
      <div class="ro-line"><span>Bend points</span><b>${bends}</b></div>
    </div>
    <div class="ins-row">
      <div class="ins-field"><label>Routed through</label>
        <select id="connRun">
          <option value="wall" ${(conn.run||'wall')==='wall'?'selected':''}>Wall</option>
          <option value="ceiling" ${conn.run==='ceiling'?'selected':''}>Ceiling</option>
          <option value="floor" ${conn.run==='floor'?'selected':''}>Floor / slab</option>
        </select></div>
      <div class="ins-field"><label>Conductor</label>
        <select id="connGauge">
          <option value="">Auto (${esc(gaugeFor((wireCircuitFor(conn)||{amp:15}).amp))})</option>
          ${Object.keys(CM_BY_GAUGE).map(g=>`<option value="${g}" ${conn.gauge===g?'selected':''}>${g}</option>`).join('')}
        </select></div>
    </div>
    <div class="empty-hint" style="margin-bottom:8px">Drag the amber dots to pull the wire through walls and ceilings. Double-click the wire to add a bend; double-click a dot to remove it.</div>
    ${warn?`<div class="empty-hint" style="color:var(--amber);margin-bottom:8px">Over 3% drop \u2014 use heavier wire or a shorter route.</div>`:''}
    <button class="danger-btn" id="delConnBtn">Delete wire</button>`;
  }
  return `<div class="empty-hint">Pick a part from the library and click the grid to place it. Select a part to edit its details, wire it up, and watch its draw here. Use <b>Wall</b> to sketch rooms and <b>Wire</b> to connect parts to a circuit, panel, or splitter.</div>`;
}

function inspectorForComp(comp){
  const def=libDef(comp.type);
  // PANEL
  if(comp.type==='panel'||comp.type==='subpanel'){
    const pl=panelLoad(comp.id);
    const isSub=comp.type==='subpanel';
    const feederOpts=()=>{
      // breakers in OTHER panels that aren't already feeding a different subpanel
      let opts=`<option value="">\u2014 not connected \u2014</option>`;
      state.circuits.forEach(c=>{
        if(c.panelId===comp.id) return;
        const fb=subpanelFedBy(c.id);
        if(fb && fb.id!==comp.id) return;
        const pnl=findComp(c.panelId);
        opts+=`<option value="${c.id}" ${comp.fedByCircuitId===c.id?'selected':''}>${esc(pnl?pnl.label:'?')} \u00b7 ${esc(c.name)}</option>`;
      });
      return opts;
    };
    return `
      <div class="ins-readout">
        <div class="ro-big">${fmt(pl.amps)} A</div>
        <div class="ro-line"><span>of ${comp.mainAmp}A bus</span>${statusPill(pl.status)}</div>
        <div class="meter"><div style="width:${pl.pct}%;background:${pl.color}"></div></div>
        <div class="ro-line"><span>Connected</span><b>${fmt0(pl.connectedVA)} W</b></div>
        <div class="ro-line"><span>Demand (cont \u00d71.25)</span><b>${fmt0(pl.adjVA)} W</b></div>
        <div class="ro-line"><span>Circuits used</span><b>${panelCircuits(comp.id).length} / ${comp.spaces}</b></div>
      </div>
      <div class="ins-field"><label>Panel name</label><input id="insLabel" type="text" value="${esc(comp.label)}"></div>
      <div class="ins-row">
        <div class="ins-field"><label>${isSub?'Sub main':'Main breaker'}</label>
          <select id="insMainAmp">${MAIN_AMP_OPTIONS.map(a=>`<option value="${a}" ${a===comp.mainAmp?'selected':''}>${a}A</option>`).join('')}</select></div>
        <div class="ins-field"><label>Spaces</label>
          <select id="insSpaces">${PANEL_SPACE_OPTIONS.map(s=>`<option value="${s}" ${s===comp.spaces?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      ${isSub?`<div class="ins-field"><label>Fed from breaker</label><select id="insFeeder">${feederOpts()}</select></div>`:''}
      <div class="ins-field"><label>Location</label><input id="insRoom" type="text" value="${esc(comp.room)}" placeholder="e.g. Garage"></div>
      <div class="ghost-row">
        <button class="mini-btn" id="goPanelTab">Open in Panels</button>
        <button class="mini-btn" id="addCircHere">+ Circuit here</button>
      </div>
      ${isSub?`<button class="danger-btn" id="delBtn">Delete sub-panel</button>`:`<div class="empty-hint" style="margin-top:8px">The main panel is the service source. Edit breakers in the Panels tab.</div>`}`;
  }
  // SPLITTER
  if(comp.type==='splitter'){
    const sl=splitterLoad(comp);
    const circuit=comp.circuitId?getCircuit(comp.circuitId):null;
    return `
      <div class="ins-readout">
        <div class="ro-big" style="color:${sl.color}">${fmt(sl.amps)} A</div>
        <div class="ro-line"><span>of ${sl.max}A rating</span>${statusPill(sl.status)}</div>
        <div class="meter"><div style="width:${sl.pct}%;background:${sl.color}"></div></div>
        <div class="ro-line"><span>Downstream parts</span><b>${sl.count}</b></div>
        <div class="ro-line"><span>Downstream load</span><b>${fmt0(sl.va)} W</b></div>
        <div class="ro-line"><span>Headroom</span><b>${fmt(Math.max(0,sl.max-sl.amps))} A</b></div>
      </div>
      <div class="ins-field"><label>Label</label><input id="insLabel" type="text" value="${esc(comp.label)}"></div>
      <div class="ins-row">
        <div class="ins-field"><label>Rating</label>
          <select id="insMaxAmps">${[15,20,30,40,50,60].map(a=>`<option value="${a}" ${a===sl.max?'selected':''}>${a}A</option>`).join('')}</select></div>
        <div class="ins-field"><label>On circuit</label>
          <select id="insCircuit">${circuitOptions(comp.circuitId)}</select></div>
      </div>
      <div class="empty-hint" style="margin-bottom:8px">Wire parts to this junction to group them. Their load rolls up here and into ${circuit?esc(circuit.name):'its circuit'}.</div>
      <div class="ins-field"><label>Location</label><input id="insRoom" type="text" value="${esc(comp.room)}" placeholder="e.g. Attic"></div>
      <button class="danger-btn" id="delBtn">Delete junction</button>`;
  }
  // GENERIC DEVICE
  const circuit=comp.circuitId?getCircuit(comp.circuitId):null;
  const v=compVoltage(comp);
  const amps=(comp.watts||0)/v;
  const control=isControl(comp.type);
  const isSw=isSwitchType(comp.type);
  const live=isLive(comp);
  const fedSplit = comp.feedFromId? findComp(comp.feedFromId):null;
  // SWITCH-specific top block
  if(isSw){
    const on=switchOn(comp);
    // count controlled loads = live devices reachable past this switch when on
    const controlled=state.components.filter(c=>!isPanelType(c.type) && !isSwitchType(c.type) && c.circuitId===comp.circuitId);
    return `
      <div class="ins-readout" style="text-align:center">
        <button id="swToggle" class="switch-big ${on?'on':'off'}"><span class="kn"></span><span class="lbl">${on?'ON':'OFF'}</span></button>
        <div class="ro-line" style="justify-content:center;margin-top:8px"><span>${esc(def.label)} \u00b7 ${live?'powered':'no power'}</span></div>
      </div>
      <div class="ins-field"><label>Label</label><input id="insLabel" type="text" value="${esc(comp.label)}"></div>
      <div class="ins-field"><label>Circuit</label><select id="insCircuit">${circuitOptions(comp.circuitId)}</select></div>
      <div class="empty-hint" style="margin-bottom:8px">Flip this switch to power the parts wired after it (away from the panel). Wire panel \u2192 switch \u2192 light so the switch controls the light.</div>
      <div class="ins-row">
        <div class="ins-field"><label>Room</label><input id="insRoom" type="text" value="${esc(comp.room)}" placeholder="e.g. Hallway"></div>
        <div class="ins-field"><label>Rotate</label><input id="insRot" type="number" step="15" value="${comp.rot||0}"></div>
      </div>
      <div class="ins-field"><label>Size <span class="muted" id="insScaleVal">${Math.round((comp.scale||1)*100)}%</span></label><input id="insScale" type="range" min="0.5" max="3" step="0.1" value="${comp.scale||1}" style="accent-color:var(--amber)"></div>
      <div class="ins-field"><label>Notes</label><textarea id="insNotes" rows="2" placeholder="Any detail...">${esc(comp.notes)}</textarea></div>
      <div class="ghost-row">
        <button class="mini-btn" id="dupBtn">Duplicate</button>
        <button class="mini-btn" id="wireFromBtn">Wire from here</button>
      </div>
      <button class="danger-btn" id="delBtn">Delete switch</button>`;
  }
  return `
    ${control?'':`<div class="ins-readout">
      <div class="ro-big" style="color:${live?'var(--green)':'var(--text-dim)'}">${live?fmt(amps):'0'} A</div>
      <div class="ro-line"><span>${live?'drawing now':'no power'} \u00b7 ${comp.watts||0}W rated</span>${live?'<span class="status-pill" style="background:var(--green)22;color:var(--green)">LIVE</span>':'<span class="status-pill" style="background:var(--text-dimmer)22;color:var(--text-dimmer)">OFF</span>'}</div>
      ${circuit?`<div class="ro-line"><span>On circuit</span><b style="color:${circuit.color}">${esc(circuit.name)} (${circuitPowered(circuit)?'breaker on':'breaker off'})</b></div>`:`<div class="ro-line"><span>Circuit</span><b style="color:var(--amber)">unassigned</b></div>`}
      ${fedSplit?`<div class="ro-line"><span>Fed via</span><b>${esc(fedSplit.label)}</b></div>`:''}
    </div>`}
    <div class="ins-field"><label>Label</label><input id="insLabel" type="text" value="${esc(comp.label)}"></div>
    ${control?`<div class="empty-hint" style="margin-bottom:8px">Control device \u2014 no load. Wire it into its circuit for documentation.</div>`:`
    <div class="ins-row">
      <div class="ins-field"><label>Watts (VA)</label><input id="insWatts" type="number" min="0" step="10" value="${comp.watts}"></div>
      <div class="ins-field"><label>Continuous</label>
        <select id="insCont"><option value="0" ${!comp.cont?'selected':''}>No</option><option value="1" ${comp.cont?'selected':''}>Yes</option></select></div>
    </div>`}
    <div class="ins-field"><label>Circuit</label><select id="insCircuit">${circuitOptions(comp.circuitId)}</select></div>
    ${comp.type==='outlet'||comp.type==='outlet20'||comp.type==='gfci'||comp.type==='floorbox'||comp.type==='usboutlet'?`
      <label class="chk-line"><input type="checkbox" id="insGfci" ${comp.gfci?'checked':''}> GFCI protected</label>
      <label class="chk-line"><input type="checkbox" id="insAfci" ${comp.afci?'checked':''}> AFCI protected</label>`:''}
    <div class="ins-row">
      <div class="ins-field"><label>Room</label><input id="insRoom" type="text" value="${esc(comp.room)}" placeholder="e.g. Kitchen"></div>
      <div class="ins-field"><label>Rotate</label><input id="insRot" type="number" step="15" value="${comp.rot||0}"></div>
    </div>
    <div class="ins-field"><label>Size <span class="muted" id="insScaleVal">${Math.round((comp.scale||1)*100)}%</span></label><input id="insScale" type="range" min="0.5" max="3" step="0.1" value="${comp.scale||1}" style="accent-color:var(--amber)"></div>
    <div class="ins-field"><label>Notes</label><textarea id="insNotes" rows="2" placeholder="Any detail...">${esc(comp.notes)}</textarea></div>
    <div class="ghost-row">
      <button class="mini-btn" id="dupBtn">Duplicate</button>
      <button class="mini-btn" id="wireFromBtn">Wire from here</button>
    </div>
    <button class="danger-btn" id="delBtn">Delete device</button>`;
}
function circuitOptions(selId){
  let html=`<option value="">\u2014 unassigned \u2014</option>`;
  getPanels().forEach(p=>{
    const cs=panelCircuits(p.id);
    if(!cs.length) return;
    html+=`<optgroup label="${esc(p.label)}">`;
    cs.forEach(c=>{ html+=`<option value="${c.id}" ${c.id===selId?'selected':''}>${esc(c.name)} (${c.poles===2?240:120}V \u00b7 ${c.amp}A)</option>`; });
    html+=`</optgroup>`;
  });
  return html;
}

/* ---- sidebar event wiring ---- */
function wireSidebarEvents(){
  // circuit cards
  document.querySelectorAll('.circuit-card').forEach(card=>{
    card.addEventListener('click',e=>{
      if(e.target.closest('select')||e.target.closest('.remove-x')||e.target.closest('.power-btn')) return;
      ui.activeCircuit=parseInt(card.dataset.circuit);
      renderSidebar();
    });
  });
  document.querySelectorAll('[data-poles]').forEach(sel=>{
    sel.addEventListener('click',e=>e.stopPropagation());
    sel.addEventListener('change',e=>{ pushUndo(); getCircuit(parseInt(sel.dataset.poles)).poles=parseInt(sel.value); renderAll(); markDirty(); });
  });
  document.querySelectorAll('[data-amp]').forEach(sel=>{
    sel.addEventListener('click',e=>e.stopPropagation());
    sel.addEventListener('change',e=>{ pushUndo(); getCircuit(parseInt(sel.dataset.amp)).amp=parseInt(sel.value); renderAll(); markDirty(); });
  });
  document.querySelectorAll('[data-power]').forEach(btn=>{
    btn.addEventListener('click',e=>{ e.stopPropagation(); toggleBreaker(parseInt(btn.dataset.power)); });
  });
  document.querySelectorAll('[data-rmcirc]').forEach(btn=>{
    btn.addEventListener('click',e=>{ e.stopPropagation(); removeCircuit(parseInt(btn.dataset.rmcirc)); });
  });
  const addTop=document.getElementById('addCircuitTop');
  if(addTop) addTop.addEventListener('click',()=>addCircuit());
  const addBtn=document.getElementById('addCircuitBtn');
  if(addBtn) addBtn.addEventListener('click',()=>addCircuit());

  const comp=findComp(ui.selectedId);
  const wall=state.walls.find(w=>w.id===ui.selectedWallId);
  const conn=state.connections.find(c=>c.id===ui.selectedConnId);

  // text/number inputs snapshot once on focus so undo captures pre-edit value
  function liveText(id,apply,rerender){
    const el=document.getElementById(id); if(!el) return;
    el.addEventListener('focus',()=>{ pushUndo(); },{once:true});
    el.addEventListener('input',()=>{ apply(el.value); markDirty(); (rerender||renderCanvas)(); });
  }
  function onChange(id,apply){
    const el=document.getElementById(id); if(!el) return;
    el.addEventListener('change',()=>{ pushUndo(); apply(el); renderAll(); markDirty(); });
  }

  if(comp){
    liveText('insLabel',v=>{ comp.label=v; });
    liveText('insWatts',v=>{ comp.watts=Math.max(0,parseFloat(v)||0); }, ()=>{ renderCanvas(); refreshSidebarMeters(); });
    liveText('insRoom',v=>{ comp.room=v; });
    liveText('insNotes',v=>{ comp.notes=v; });
    liveText('insRot',v=>{ comp.rot=parseInt(v)||0; });
    const scl=document.getElementById('insScale');
    if(scl){
      let snapped=false;
      scl.addEventListener('input',e=>{ if(!snapped){ pushUndo(); snapped=true; } comp.scale=parseFloat(e.target.value); const vv=document.getElementById('insScaleVal'); if(vv) vv.textContent=Math.round(comp.scale*100)+'%'; renderCanvas(); });
      scl.addEventListener('change',()=>{ snapped=false; markDirty(); });
    }
    onChange('insCont',el=>{ comp.cont=el.value==='1'; });
    onChange('insCircuit',el=>{ comp.circuitId = el.value? parseInt(el.value):null; if(comp.feedFromId){ const s=findComp(comp.feedFromId); if(s&&s.circuitId!==comp.circuitId) comp.feedFromId=null; } });
    onChange('insGfci',el=>{ comp.gfci=el.checked; });
    onChange('insAfci',el=>{ comp.afci=el.checked; });
    onChange('insMainAmp',el=>{ comp.mainAmp=parseInt(el.value); comp.busAmp=comp.mainAmp; });
    onChange('insSpaces',el=>{ comp.spaces=parseInt(el.value); });
    onChange('insMaxAmps',el=>{ comp.maxAmps=parseInt(el.value); });
    onChange('insFeeder',el=>{ comp.fedByCircuitId = el.value? parseInt(el.value):null; });

    const dup=document.getElementById('dupBtn'); if(dup) dup.addEventListener('click',()=>duplicateComponent(comp.id));
    const swt=document.getElementById('swToggle'); if(swt) swt.addEventListener('click',()=>toggleSwitch(comp.id));
    const wf=document.getElementById('wireFromBtn'); if(wf) wf.addEventListener('click',()=>{ setTool('wire'); ui.wireDraft={from:comp.id,points:[]}; ui.wirePreview=null; renderCanvas(); updateHint(); showToast('Click bend points to route, then click the part to connect.'); });
    const del=document.getElementById('delBtn'); if(del) del.addEventListener('click',()=>deleteComponent(comp.id));
    const gp=document.getElementById('goPanelTab'); if(gp) gp.addEventListener('click',()=>setTab('panels'));
    const ach=document.getElementById('addCircHere'); if(ach) ach.addEventListener('click',()=>addCircuit(comp.id));
  }
  if(wall){
    const d=document.getElementById('delWallBtn'); if(d) d.addEventListener('click',()=>deleteWall(wall.id));
  }
  if(conn){
    const d=document.getElementById('delConnBtn'); if(d) d.addEventListener('click',()=>deleteConnection(conn.id));
    const g=document.getElementById('connGauge'); if(g) g.addEventListener('change',()=>{ pushUndo(); conn.gauge=g.value||null; renderAll(); markDirty(); });
    const r=document.getElementById('connRun'); if(r) r.addEventListener('change',()=>{ pushUndo(); conn.run=r.value; renderCanvas(); markDirty(); });
  }
}
/* lightweight meter refresh while typing watts (keeps focus) */
function refreshSidebarMeters(){
  invalidateLive();
  state.circuits.forEach(circuit=>{
    const ld=circuitLoad(circuit);
    const card=document.querySelector(`.circuit-card[data-circuit="${circuit.id}"]`);
    if(!card) return;
    const bar=card.querySelector('.meter > div'); if(bar){ bar.style.width=ld.pct+'%'; bar.style.background=ld.color; }
    const meta=card.querySelector('.cc-meta span'); if(meta) meta.textContent=`${fmt(ld.liveAmps)}A now \u00b7 ${fmt(ld.adjAmps)}/${circuit.amp}A \u00b7 ${gaugeFor(circuit.amp)}`;
  });
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderAll(){
  renderCanvas();
  renderSidebar();
  if(ui.tab==='panels') renderPanelsTab();
  if(ui.tab==='loads') renderLoadsTab();
  if(ui.tab==='learn') renderLearnTab();
  updateCoach();
}

/* ============================================================
   PANEL SLOT MODEL
   ============================================================ */
function slotPhase(pos){ const row=Math.floor(((pos||1)-1)/2); return row%2===0?'A':'B'; }
function circuitPositions(c){ return c.poles===2?[c.slot,c.slot+2]:[c.slot]; }
function panelOccupancy(panelId, exceptId){
  const occ={};
  panelCircuits(panelId).forEach(c=>{ if(c.id===exceptId) return; circuitPositions(c).forEach(p=>occ[p]=c.id); });
  return occ;
}
function findFreeSlot(panelId, poles){
  const panel=findComp(panelId); const spaces=panel?panel.spaces:30;
  const occ=panelOccupancy(panelId);
  for(let pos=1;pos<=spaces;pos++){
    const need = poles===2?[pos,pos+2]:[pos];
    if(need.some(p=>p>spaces||occ[p])) continue;
    return pos;
  }
  return 0;
}
function repackPanel(panelId){
  const cs=panelCircuits(panelId).slice().sort((a,b)=>(a.slot||0)-(b.slot||0));
  const panel=findComp(panelId); const spaces=panel?panel.spaces:30;
  const used={};
  cs.forEach(c=>{
    let placed=false;
    for(let pos=1;pos<=spaces;pos++){
      const need=c.poles===2?[pos,pos+2]:[pos];
      if(need.some(p=>p>spaces||used[p])) continue;
      need.forEach(p=>used[p]=c.id); c.slot=pos; placed=true; break;
    }
    if(!placed) c.slot=0;
  });
}
function panelPhaseLoads(panelId){
  let A=0,B=0;
  panelCircuits(panelId).forEach(c=>{
    if(!circuitPowered(c)) return;
    const ld=circuitLoad(c);
    if(c.poles===2){ A+=ld.adjAmps; B+=ld.adjAmps; }
    else { if(slotPhase(c.slot||1)==='A') A+=ld.adjAmps; else B+=ld.adjAmps; }
  });
  return {A,B};
}

/* ---- breaker operations ---- */
function installBreaker(panelId,pos,poles){
  const panel=findComp(panelId); if(!panel) return;
  const spaces=panel.spaces; poles=poles||1;
  const need=poles===2?[pos,pos+2]:[pos];
  const occ=panelOccupancy(panelId);
  if(need.some(p=>p>spaces||p<1||occ[p])){ showToast('That slot is taken or out of range.'); return; }
  pushUndo();
  const id=state.counters.circuit++;
  const color=PALETTE[(state.circuits.length)%PALETTE.length];
  state.circuits.push({ id, panelId, name:'Circuit '+id, amp:poles===2?30:15, poles, color, breakerOn:true, slot:pos, breakerType:'std' });
  ui.activeCircuit=id; ui.selectedBreaker=id;
  renderPanelsTab(); renderSidebar(); markDirty();
}
function quickAddBreaker(panelId,poles){
  const pos=findFreeSlot(panelId,poles);
  if(!pos){ showToast(poles===2?'No room for a 2-pole \u2014 free two slots in one column.':'Panel is full \u2014 add spaces in Edit.'); return; }
  installBreaker(panelId,pos,poles);
}
function moveBreaker(circuitId,targetPos){
  const c=getCircuit(circuitId); if(!c) return;
  const panel=findComp(c.panelId); const spaces=panel.spaces;
  const need=c.poles===2?[targetPos,targetPos+2]:[targetPos];
  if(need.some(p=>p>spaces||p<1)){ showToast('Does not fit there.'); return; }
  const occ=panelOccupancy(panel.id,c.id);
  if(need.some(p=>occ[p])){ showToast('Slot already occupied.'); return; }
  pushUndo(); c.slot=targetPos; renderPanelsTab(); markDirty();
}
function setBreakerPoles(circuitId,poles){
  const c=getCircuit(circuitId); if(!c||c.poles===poles) return;
  const panel=findComp(c.panelId); const spaces=panel.spaces;
  if(poles===2){
    const occ=panelOccupancy(panel.id,c.id);
    if(c.slot+2>spaces || occ[c.slot+2]){
      const pos=findFreeSlot(panel.id,2);
      if(!pos){ showToast('No room for a 2-pole breaker. Free two slots in one column.'); return; }
      pushUndo(); c.poles=2; c.slot=pos; if(c.amp<30)c.amp=30; renderPanelsTab(); renderSidebar(); markDirty(); return;
    }
  }
  pushUndo(); c.poles=poles; if(poles===2 && c.amp<30)c.amp=30; renderPanelsTab(); renderSidebar(); markDirty();
}
function removeBreaker(circuitId){
  const c=getCircuit(circuitId); if(!c) return;
  if(circuitDevices(circuitId).length){ showToast('Move or delete this breaker\u2019s devices first.'); return; }
  if(subpanelFedBy(circuitId)){ showToast('This breaker feeds a sub-panel. Detach it first.'); return; }
  if(state.circuits.length<=1){ showToast('Keep at least one breaker.'); return; }
  pushUndo();
  state.circuits=state.circuits.filter(x=>x.id!==circuitId);
  if(ui.selectedBreaker===circuitId) ui.selectedBreaker=null;
  if(ui.activeCircuit===circuitId) ui.activeCircuit=state.circuits[0].id;
  renderPanelsTab(); renderSidebar(); markDirty();
}
function selectBreaker(circuitId){ ui.selectedBreaker=circuitId; ui.activeCircuit=circuitId; renderPanelsTab(); }

/* ============================================================
   PANELS TAB — hyper-realistic SVG panel with live conductors
   ============================================================ */
function trunc(s,n){ s=String(s||''); return s.length>n? s.slice(0,n-1)+'\u2026' : s; }
function centerOn(x,y){ view.x=x-view.w/2; view.y=y-view.h/2; applyView(); }
function focusPanelInFloorplan(pid){
  const p=findComp(pid); if(!p) return;
  setTab('floorplan'); ui.selectedId=pid; ui.selectedBreaker=null;
  centerOn(p.x,p.y); renderAll();
  showToast('Showing '+p.label+' in the floor plan.');
}

/* geometry constants (SVG user units) */
const PG = { margin:10, barW:11, gutter:34, bw:104, cb:34, mainTop:12, mainH:44, rowsTop:76, pitch:30, rowH:24 };
function panelDims(panel){
  const leftBarX=PG.margin;
  const leftColX=leftBarX+PG.barW+PG.gutter;
  const centerX=leftColX+PG.bw;
  const rightColX=centerX+PG.cb;
  const rightBarX=rightColX+PG.bw+PG.gutter;
  const W=rightBarX+PG.barW+PG.margin;
  const perCol=Math.ceil((panel.spaces||30)/2);
  const H=PG.rowsTop+perCol*PG.pitch+14;
  return { leftBarX,leftColX,centerX,rightColX,rightBarX,W,perCol,H,
    busL:centerX+9, busR:centerX+21,
    cableNodeL:leftBarX+PG.barW+PG.gutter/2,
    cableNodeR:rightColX+PG.bw+PG.gutter/2 };
}

function breakerSVG(panel,c,pos,row,col,D){
  const span2=c.poles===2;
  const y=PG.rowsTop+row*PG.pitch;
  const h=span2? PG.rowH+PG.pitch : PG.rowH;
  const x=col==='L'? D.leftColX : D.rightColX;
  const innerX = col==='L'? x+PG.bw : x;       // toward centre bus
  const outerX = col==='L'? x : x+PG.bw;       // toward load cable
  const node = col==='L'? D.cableNodeL : D.cableNodeR;
  const barInner = col==='L'? D.leftBarX+PG.barW : D.rightBarX;  // edge of N/G bar facing node
  const mid=y+h/2;
  const ld=circuitLoad(c), powered=circuitPowered(c), live=powered && ld.liveAmps>0.0001;
  const sel=ui.selectedBreaker===c.id, over=ld.status==='OVER';
  const phases=circuitPositions(c).map(slotPhase);
  const phaseColor=p=> p==='A'? '#63b3ed':'#f0a830';
  const hotColor=WIRE_BLACK;

  // --- conductors (drawn behind the breaker) ---
  let wires='';
  const stabY1=span2? y+PG.rowH/2 : mid;
  // bus stab(s): line-side hot from panel bus to breaker
  const busFor=ph=> ph==='A'? D.busL : D.busR;
  const stabOn = live? 1 : 0.4;
  if(span2){
    const y2=y+PG.rowH+ (PG.pitch-PG.rowH) + PG.rowH/2 - (PG.pitch-PG.rowH); // approx second pole centre
    const yA=y+PG.rowH/2, yB=y+PG.pitch+PG.rowH/2;
    wires+=`<line x1="${busFor('A')}" y1="${yA}" x2="${innerX}" y2="${yA}" stroke="${phaseColor('A')}" stroke-width="3" opacity="${stabOn}"/>`;
    wires+=`<line x1="${busFor('B')}" y1="${yB}" x2="${innerX}" y2="${yB}" stroke="${phaseColor('B')}" stroke-width="3" opacity="${stabOn}"/>`;
  } else {
    wires+=`<line x1="${busFor(phases[0])}" y1="${mid}" x2="${innerX}" y2="${mid}" stroke="${phaseColor(phases[0])}" stroke-width="3" opacity="${stabOn}"/>`;
  }
  // load conductors: hot from breaker -> cable node; neutral & ground from N/G bar -> node; cable node -> wall
  const lw = sel? 2.4 : 1.6;
  const op = live? 1 : 0.5;
  const flowCls = (live && state.settings.showFlow!==false)? 'flow':'';
  // hot (load) — black, plus red for 2-pole
  wires+=`<polyline points="${outerX},${mid-(span2?3:0)} ${node},${mid-(span2?3:0)}" fill="none" stroke="${hotColor}" stroke-width="${lw+0.4}" opacity="${op}"/>`;
  if(live) wires+=`<polyline class="${flowCls}" points="${outerX},${mid-(span2?3:0)} ${node},${mid-(span2?3:0)}" fill="none" stroke="#ffffff" stroke-width="0.9" opacity="0.8"/>`;
  if(span2) wires+=`<polyline points="${outerX},${mid+3} ${node},${mid+3}" fill="none" stroke="${WIRE_RED}" stroke-width="${lw+0.4}" opacity="${op}"/>`;
  // neutral (white) from bar
  wires+=`<polyline points="${barInner},${mid+ (span2?7:5)} ${node},${mid+(span2?7:5)}" fill="none" stroke="${WIRE_WHITE}" stroke-width="${lw}" opacity="${op}"/>`;
  // ground (green) from bar
  wires+=`<polyline points="${barInner},${mid+(span2?11:9)} ${node},${mid+(span2?11:9)}" fill="none" stroke="${WIRE_GREEN}" stroke-width="${lw}" opacity="${op}"/>`;
  // cable jacket from node out through bar to wall
  const wallX = col==='L'? 3 : D.W-3;
  wires+=`<polyline points="${node},${mid} ${wallX},${mid}" fill="none" stroke="#0c1422" stroke-width="7" opacity="${op*0.6}"/>`;
  wires+=`<polyline points="${node},${mid} ${wallX},${mid}" fill="none" stroke="#3a4658" stroke-width="4.5" opacity="${op}"/>`;
  // small bundle dots at node
  wires+=`<circle cx="${node}" cy="${mid}" r="2" fill="#cfd6df" opacity="${op}"/>`;
  // cable entry marker at the can edge (circuit colour); destination label is drawn in the wall pad
  const labelX = col==='L'? wallX+4 : wallX-4;
  wires+=`<circle cx="${labelX+(col==='L'?2:-2)}" cy="${mid-6}" r="2.4" fill="${c.color}"/>`;

  // --- breaker body ---
  const btypeStripe = (c.breakerType&&c.breakerType!=='std')? ({gfci:'#5fd394',afci:'#9f7aea',dual:'#4fd1c5'}[c.breakerType]) : null;
  const handleW=12, handleH=Math.min(18,PG.rowH-6);
  const handleX = col==='L'? innerX-handleW-3 : innerX+3;
  const handleY = mid-handleH/2;
  const nub = powered? `<rect x="${handleX+2}" y="${handleY+2}" width="${handleW-4}" height="${(handleH-6)/2}" rx="1.5" fill="#5fd394"/>`
                     : `<rect x="${handleX+2}" y="${handleY+handleH-2-(handleH-6)/2}" width="${handleW-4}" height="${(handleH-6)/2}" rx="1.5" fill="#566"/>`;
  const nameX = col==='L'? outerX+6 : outerX-6;
  const nameAnchor = col==='L'? 'start':'end';
  const ampX = col==='L'? handleX-4 : handleX+handleW+4;
  const ampAnchor = col==='L'? 'end':'start';
  let body='';
  body+=`<rect x="${x}" y="${y}" width="${PG.bw}" height="${h}" rx="3" fill="url(#panBreaker)" stroke="${sel?'#f0a830':'#0c1016'}" stroke-width="${sel?1.6:1}"/>`;
  if(btypeStripe) body+=`<rect x="${col==='L'?x:x+PG.bw-3}" y="${y}" width="3" height="${h}" rx="1.5" fill="${btypeStripe}"/>`;
  body+=`<rect x="${col==='L'?x+3:x}" y="${y+1}" width="${PG.bw-3}" height="2.5" fill="#ffffff" opacity="0.05"/>`;
  // handle well + handle (data-toggle)
  body+=`<rect x="${handleX-1}" y="${handleY-1}" width="${handleW+2}" height="${handleH+2}" rx="2" fill="#10141b"/>`;
  body+=`<g data-toggle="${c.id}" style="cursor:pointer"><rect x="${handleX}" y="${handleY}" width="${handleW}" height="${handleH}" rx="2" fill="${powered?'#243':'#1a2029'}" stroke="#0a0d12"/>${nub}</g>`;
  // amp number
  body+=`<text x="${ampX}" y="${mid+3.5}" font-size="11" font-weight="700" fill="#fff" text-anchor="${ampAnchor}">${c.amp}</text>`;
  // name + live amps + phase chip
  body+=`<text x="${nameX}" y="${mid-2}" font-size="8" font-weight="600" fill="#eef3f8" text-anchor="${nameAnchor}">${esc(trunc(c.name,16))}</text>`;
  body+=`<text x="${nameX}" y="${mid+8}" font-size="7" fill="${live?'#7fe0a8':'#9fb3c8'}" text-anchor="${nameAnchor}">${span2?'A+B':phases[0]} \u00b7 ${fmt(ld.liveAmps)}A</text>`;
  if(over) body+=`<rect x="${x}" y="${y}" width="${PG.bw}" height="${h}" rx="3" fill="none" stroke="var(--red)" stroke-width="1.6"/>`;
  // selection highlight labels (training)
  if(sel){
    body+=`<rect x="${x}" y="${y}" width="${PG.bw}" height="${h}" rx="3" fill="#f0a830" opacity="0.08"/>`;
    const lx = col==='L'? node-2 : node+2;
    const la = col==='L'? 'end':'start';
    body+=`<text x="${lx}" y="${mid-(span2?6:3)}" font-size="6" font-weight="700" fill="#20293a" text-anchor="${la}">HOT</text>`;
    body+=`<text x="${lx}" y="${mid+(span2?9:7)}" font-size="6" font-weight="700" fill="#5a626d" text-anchor="${la}">NEU</text>`;
    body+=`<text x="${lx}" y="${mid+(span2?14:12)}" font-size="6" font-weight="700" fill="#1c6b34" text-anchor="${la}">GND</text>`;
  }
  // invisible body hit target for select/drag
  body+=`<rect data-breaker="${c.id}" data-slot="${panel.id}:${pos}" x="${x}" y="${y}" width="${PG.bw}" height="${h}" fill="transparent" style="cursor:grab"/>`;

  return wires+body;
}

function emptySlotSVG(panel,pos,row,col,D){
  const y=PG.rowsTop+row*PG.pitch;
  const x=col==='L'? D.leftColX : D.rightColX;
  const innerX=col==='L'? x+PG.bw : x;
  const mid=y+PG.rowH/2;
  const busFor=ph=> ph==='A'? D.busL:D.busR;
  const ph=slotPhase(pos);
  let s='';
  s+=`<line x1="${busFor(ph)}" y1="${mid}" x2="${innerX}" y2="${mid}" stroke="#c98a4a" stroke-width="2" opacity="0.6"/>`;
  s+=`<rect data-install="${panel.id}:${pos}" data-slot="${panel.id}:${pos}" x="${x}" y="${y}" width="${PG.bw}" height="${PG.rowH}" rx="3" fill="#dde1e6" stroke="#9aa1ab" stroke-width="1.2" stroke-dasharray="4 3" style="cursor:pointer"/>`;
  s+=`<text x="${x+PG.bw/2}" y="${mid+3.5}" font-size="11" font-weight="700" fill="#5a626d" text-anchor="middle" style="pointer-events:none">+</text>`;
  return s;
}

function panelSVG(panel){
  const D=panelDims(panel);
  const occ=panelOccupancy(panel.id);
  const isSub=panel.type==='subpanel';
  const powered=panelPowered(panel);
  const pl=panelLoad(panel.id);
  let body='';

  // enclosure can + deadfront (brushed metal)
  body+=`<rect x="2" y="2" width="${D.W-4}" height="${D.H-4}" rx="8" fill="url(#metalGrad)" stroke="#11151c" stroke-width="2"/>`;
  for(let bx=14; bx<D.W-14; bx+=7) body+=`<line x1="${bx}" y1="4" x2="${bx}" y2="${D.H-4}" stroke="#ffffff" stroke-width="0.4" opacity="0.04"/>`;
  body+=`<rect x="7" y="7" width="${D.W-14}" height="${D.H-14}" rx="5" fill="url(#panDead)" stroke="#0c0f14" stroke-width="1"/>`;
  body+=`<rect x="7" y="7" width="${D.W-14}" height="3" rx="2" fill="#ffffff" opacity="0.06"/>`;
  // corner deadfront screws
  [[12,12],[D.W-12,12],[12,D.H-12],[D.W-12,D.H-12]].forEach(([sx,sy])=>{ body+=`<circle cx="${sx}" cy="${sy}" r="2.4" fill="#9aa3ad"/><line x1="${sx-1.6}" y1="${sy}" x2="${sx+1.6}" y2="${sy}" stroke="#4a525c" stroke-width="0.7"/>`; });
  // N/G bars (both sides)
  [D.leftBarX, D.rightBarX].forEach(bx=>{
    body+=`<rect x="${bx}" y="${PG.rowsTop-6}" width="${PG.barW}" height="${D.perCol*PG.pitch}" rx="2" fill="url(#panBar)" stroke="#7c848d" stroke-width="0.6"/>`;
    for(let r=0;r<D.perCol;r++){ const sy=PG.rowsTop+r*PG.pitch+PG.rowH/2; body+=`<circle cx="${bx+PG.barW/2}" cy="${sy+5}" r="1.3" fill="#7d8893"/><circle cx="${bx+PG.barW/2}" cy="${sy+9}" r="1.3" fill="#43b25f"/>`; }
  });
  body+=`<text x="${D.leftBarX+PG.barW/2}" y="${PG.rowsTop-9}" font-size="6.5" fill="#5a626d" text-anchor="middle">N/G</text>`;
  body+=`<text x="${D.rightBarX+PG.barW/2}" y="${PG.rowsTop-9}" font-size="6.5" fill="#5a626d" text-anchor="middle">N/G</text>`;
  // centre bus bars (copper)
  body+=`<rect x="${D.busL-3}" y="${PG.rowsTop-6}" width="6" height="${D.perCol*PG.pitch}" fill="url(#panCopper)" opacity="${powered?1:0.45}"/>`;
  body+=`<rect x="${D.busR-3}" y="${PG.rowsTop-6}" width="6" height="${D.perCol*PG.pitch}" fill="url(#panCopper)" opacity="${powered?1:0.45}"/>`;
  body+=`<text x="${D.busL}" y="${PG.rowsTop-9}" font-size="6.5" font-weight="700" fill="#1d6fd6" text-anchor="middle">L1</text>`;
  body+=`<text x="${D.busR}" y="${PG.rowsTop-9}" font-size="6.5" font-weight="700" fill="#b9791a" text-anchor="middle">L2</text>`;

  // main breaker
  const mainW=120, mainX=(D.W-mainW)/2, my=PG.mainTop, mh=PG.mainH;
  const feederColorTop = powered? 1:0.4;
  body+=`<line x1="${mainX+mainW*0.38}" y1="0" x2="${mainX+mainW*0.38}" y2="${my+6}" stroke="${WIRE_BLACK}" stroke-width="4" opacity="${feederColorTop}"/>`;
  body+=`<line x1="${mainX+mainW*0.62}" y1="0" x2="${mainX+mainW*0.62}" y2="${my+6}" stroke="${WIRE_RED}" stroke-width="4" opacity="${feederColorTop}"/>`;
  body+=`<polyline points="${mainX},${my+mh/2} ${D.leftBarX+PG.barW},${my+mh/2} ${D.leftBarX+PG.barW/2},${PG.rowsTop-6}" fill="none" stroke="#9aa1ab" stroke-width="2.4" opacity="0.85"/>`;
  body+=`<polyline points="${mainX+mainW},${my+mh/2} ${D.rightBarX},${my+mh/2} ${D.rightBarX+PG.barW/2},${PG.rowsTop-6}" fill="none" stroke="#2ea24d" stroke-width="2.4" opacity="0.85"/>`;
  body+=`<line x1="${D.busL}" y1="${my+mh}" x2="${D.busL}" y2="${PG.rowsTop-6}" stroke="url(#panCopper)" stroke-width="6" opacity="${powered?1:0.5}"/>`;
  body+=`<line x1="${D.busR}" y1="${my+mh}" x2="${D.busR}" y2="${PG.rowsTop-6}" stroke="url(#panCopper)" stroke-width="6" opacity="${powered?1:0.5}"/>`;
  body+=`<rect x="${mainX}" y="${my}" width="${mainW}" height="${mh}" rx="4" fill="url(#panBreaker)" stroke="#0c1016" stroke-width="1.2"/>`;
  body+=`<rect x="${mainX+2}" y="${my+1.5}" width="${mainW-4}" height="2" rx="1" fill="#fff" opacity="0.06"/>`;
  const mhW=18, mhH=22, mhx=(D.W-mhW)/2, mhy=my+(mh-mhH)/2;
  body+=`<rect x="${mhx-2}" y="${mhy-2}" width="${mhW+4}" height="${mhH+4}" rx="3" fill="#10141b"/>`;
  body+=`<g data-main="${panel.id}" style="cursor:pointer"><rect x="${mhx}" y="${mhy}" width="${mhW}" height="${mhH}" rx="3" fill="${powered?'#264':'#1a2029'}" stroke="#0a0d12"/>`;
  body+= powered? `<rect x="${mhx+3}" y="${mhy+3}" width="${mhW-6}" height="${mhH/2-3}" rx="2" fill="#5fd394"/>`
                : `<rect x="${mhx+3}" y="${mhy+mhH-3-(mhH/2-3)}" width="${mhW-6}" height="${mhH/2-3}" rx="2" fill="#566"/>`;
  body+=`</g>`;
  body+=`<text x="${mainX+10}" y="${my+mh/2+3.5}" font-size="9" font-weight="700" fill="#eef1f5" text-anchor="start">${isSub?'SUB':'MAIN'}</text>`;
  body+=`<text x="${mainX+mainW-10}" y="${my+mh/2+3.5}" font-size="11" font-weight="700" fill="#fff" text-anchor="end">${panel.mainAmp}A</text>`;

  // breakers / empty slots  (+ collect wall cable runs)
  let pad='';
  const PADX=92, PADT=58, PADB=18;
  const OW=D.W+2*PADX, OH=D.H+PADT+PADB;
  for(let r=0;r<D.perCol;r++){
    [['L',2*r+1],['R',2*r+2]].forEach(([col,pos])=>{
      if(pos>panel.spaces) return;
      const cid=occ[pos];
      if(cid){
        const c=getCircuit(cid); if(c.slot!==pos) return;
        body+=breakerSVG(panel,c,pos,r,col,D);
        // --- wall cable run + destination label (absolute coords) ---
        const span2=c.poles===2, h=span2?PG.rowH+PG.pitch:PG.rowH;
        const midAbs=PADT+(PG.rowsTop+r*PG.pitch)+h/2;
        const live=circuitPowered(c) && circuitLoad(c).liveAmps>0.0001;
        const op=live?1:0.5;
        const dest=circuitDestination(c), spec=cableSpec(c);
        const tag=`${pos}${span2?'/'+(pos+2):''} ${trunc(dest,14)}`;
        const sub=`${spec.label} \u00b7 ${fmt0(spec.lenFt)}ft`;
        if(col==='L'){
          const x0=PADX+2, x1=10, studX=PADX-26;
          pad+=`<polyline points="${x0},${midAbs} ${x1},${midAbs}" fill="none" stroke="#0c1422" stroke-width="6" opacity="${op*0.5}"/>`;
          pad+=`<polyline points="${x0},${midAbs} ${x1},${midAbs}" fill="none" stroke="#3a4658" stroke-width="3.5" opacity="${op}"/>`;
          pad+=`<ellipse cx="${studX+8}" cy="${midAbs}" rx="3" ry="4.5" fill="#0c1422" opacity="0.5"/>`;
          pad+=`<circle cx="${x0}" cy="${midAbs}" r="2.2" fill="${c.color}"/>`;
          pad+=`<text x="${x1}" y="${midAbs-3}" font-size="7" font-weight="600" fill="#cdd8e6" text-anchor="start">${esc(tag)}</text>`;
          pad+=`<text x="${x1}" y="${midAbs+6}" font-size="5.6" fill="#7d8ea3" text-anchor="start">${esc(sub)}</text>`;
        } else {
          const x0=PADX+D.W-2, x1=OW-10, studX=PADX+D.W+10;
          pad+=`<polyline points="${x0},${midAbs} ${x1},${midAbs}" fill="none" stroke="#0c1422" stroke-width="6" opacity="${op*0.5}"/>`;
          pad+=`<polyline points="${x0},${midAbs} ${x1},${midAbs}" fill="none" stroke="#3a4658" stroke-width="3.5" opacity="${op}"/>`;
          pad+=`<ellipse cx="${studX+8}" cy="${midAbs}" rx="3" ry="4.5" fill="#0c1422" opacity="0.5"/>`;
          pad+=`<circle cx="${x0}" cy="${midAbs}" r="2.2" fill="${c.color}"/>`;
          pad+=`<text x="${x1}" y="${midAbs-3}" font-size="7" font-weight="600" fill="#cdd8e6" text-anchor="end">${esc(tag)}</text>`;
          pad+=`<text x="${x1}" y="${midAbs+6}" font-size="5.6" fill="#7d8ea3" text-anchor="end">${esc(sub)}</text>`;
        }
      } else body+=emptySlotSVG(panel,pos,r,col,D);
    });
  }

  // ---- installation backdrop (wall cavity + studs + service) ----
  let back='';
  back+=`<rect x="0" y="0" width="${OW}" height="${OH}" fill="#0c1422"/>`;
  // studs framing the can
  const studs=[PADX-26, PADX+D.W+10];
  studs.forEach(sx=>{ back+=`<rect x="${sx}" y="${PADT-14}" width="16" height="${OH-PADT-2}" fill="url(#studGrad)" stroke="#6b5333" stroke-width="0.5"/><line x1="${sx+8}" y1="${PADT-14}" x2="${sx+8}" y2="${OH-2}" stroke="#7a5e38" stroke-width="0.5" opacity="0.5"/>`; });
  // top plate
  back+=`<rect x="${PADX-30}" y="${PADT-16}" width="${D.W+60}" height="12" fill="url(#studGrad)" stroke="#6b5333" stroke-width="0.5"/>`;
  // mounting screws fixing can to studs
  [[PADX+6,PADT+8],[PADX+6,PADT+D.H-8],[PADX+D.W-6,PADT+8],[PADX+D.W-6,PADT+D.H-8]].forEach(([sx,sy])=>{ back+=`<circle cx="${sx}" cy="${sy}" r="2" fill="#cfd6df"/><circle cx="${sx}" cy="${sy}" r="1" fill="#6b7480"/>`; });
  // service mast / feeder
  const cx=PADX+D.W/2;
  if(!isSub){
    back+=`<rect x="${cx-7}" y="6" width="14" height="${PADT-2}" rx="4" fill="url(#mastGrad)" stroke="#3a4048" stroke-width="0.6"/>`;
    back+=`<path d="M ${cx-7} 12 q -10 -8 -2 -10" fill="none" stroke="url(#mastGrad)" stroke-width="6"/>`;
    back+=`<line x1="${cx-3}" y1="14" x2="${cx-3}" y2="${PADT}" stroke="${WIRE_BLACK}" stroke-width="3" opacity="${feederColorTop}"/>`;
    back+=`<line x1="${cx+3}" y1="14" x2="${cx+3}" y2="${PADT}" stroke="${WIRE_RED}" stroke-width="3" opacity="${feederColorTop}"/>`;
    back+=`<text x="${cx}" y="${PADT-2}" font-size="7.5" font-weight="700" fill="#cbd5e6" text-anchor="middle">SERVICE 120/240V \u00b7 ${panel.mainAmp}A</text>`;
  } else {
    const f=getCircuit(panel.fedByCircuitId); const par=f&&findComp(f.panelId);
    back+=`<rect x="6" y="${PADT-10}" width="${PADX-12}" height="12" rx="4" fill="url(#mastGrad)" stroke="#3a4048" stroke-width="0.6"/>`;
    back+=`<text x="10" y="${PADT-14}" font-size="7" font-weight="700" fill="#9fb3c8" text-anchor="start">FEEDER ${par?'from '+esc(trunc(par.label,12)):'\u2014 not connected'}</text>`;
  }

  const used=panelCircuits(panel.id).reduce((n,c)=>n+(c.poles===2?2:1),0);
  const feeder = isSub && panel.fedByCircuitId ? (()=>{ const f=getCircuit(panel.fedByCircuitId); const par=f&&findComp(f.panelId); return f?`Fed from ${esc(par?par.label:'?')} \u00b7 ${esc(f.name)}`:'Not connected'; })() : (isSub?'Not connected':'Service entrance');

  return `<div class="panel-card">
    <div class="box-header">
      <div><div class="box-label">${esc(panel.label)}</div><div class="box-sub">${esc(feeder)} \u00b7 ${used}/${panel.spaces} spaces \u00b7 ${fmt(pl.liveAmps)}A now</div></div>
      <div style="display:flex;gap:6px">
        <button class="box-edit" data-focuspanel="${panel.id}" title="Select this panel in the floor plan">In plan</button>
        <button class="box-edit" data-editpanel="${panel.id}">Edit</button>
      </div>
    </div>
    <svg class="panel-svg" viewBox="0 0 ${OW} ${OH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-width:${OW}px" xmlns="http://www.w3.org/2000/svg">
      ${back}${pad}
      <g transform="translate(${PADX},${PADT})">${body}</g>
    </svg>
  </div>`;
}

/* ===== Panel Build & Test trainer ===== */
const LAB_GAUGE_AMP={ '14':15, '12':20, '10':30, '8':40, '6':55 };
function labMinGauge(a){ return a<=15?'14':a<=20?'12':a<=30?'10':a<=40?'8':'6'; }
function labName(id){ return ({cHOT:'HOT',cNEU:'NEUTRAL',cGND:'GROUND',brkLoad:'BREAKER',BUS:'BUS L1',MAINLUG:'MAIN',NBAR:'NEUTRAL BAR',GBAR:'GROUND BAR'})[id.split(':')[1]]||id; }
function labRole(id){ const n=id.split(':')[1]; if(n==='cNEU'||n==='NBAR') return 'neutral'; if(n==='cGND'||n==='GBAR') return 'ground'; return 'hot'; }
function panelLabTerms(){
  const L=state.panelLab, T={};
  const add=(id,x,y,label,kind)=>{ T[id]={id,x,y,label,role:labRole(id),kind}; };
  add('lab:BUS',255,116,'L1','bus');
  if(L.brk) add('lab:brkLoad',150,168,'LOAD','lug');
  add('lab:NBAR',432,150,'N','bar');
  add('lab:GBAR',476,150,'G','bar');
  add('lab:cHOT',150,300,'HOT','cable');
  add('lab:cNEU',188,318,'N','cable');
  add('lab:cGND',226,300,'GND','cable');
  return T;
}
function panelLabCorrect(){ return [['lab:cHOT','lab:brkLoad'],['lab:cNEU','lab:NBAR'],['lab:cGND','lab:GBAR']]; }
function labNets(){ const p={}; const find=x=>{ if(p[x]===undefined)p[x]=x; while(p[x]!==x){ p[x]=p[p[x]]; x=p[x]; } return x; }; state.panelLab.wires.forEach(w=>{ p[find(w.from)]=find(w.to); }); return {find}; }
function panelLabCheck(){
  const L=state.panelLab, wires=L.wires, items=[];
  const {find}=labNets(); const linked=(a,c)=>find(a)===find(c);
  wires.forEach(w=>{ const ra=labRole(w.from), rb=labRole(w.to);
    if((ra==='hot'&&rb==='neutral')||(rb==='hot'&&ra==='neutral')) items.push({level:'danger',msg:'Hot tied to Neutral \u2014 dead short the moment it\u2019s energized.',w:w.id});
    else if((ra==='hot'&&rb==='ground')||(rb==='hot'&&ra==='ground')) items.push({level:'danger',msg:'Hot landed on the ground bar \u2014 instant trip / live metalwork.',w:w.id});
    else if((ra==='neutral'&&rb==='ground')||(rb==='neutral'&&ra==='ground')) items.push({level:'warn',msg:'Neutral bonded to ground here \u2014 keep them separate in a sub-panel.',w:w.id});
  });
  const brk=L.brk;
  const hotOK=brk&&linked('lab:cHOT','lab:brkLoad');
  const neuOK=linked('lab:cNEU','lab:NBAR');
  const gndOK=linked('lab:cGND','lab:GBAR');
  const need=LAB_GAUGE_AMP[L.gauge]||0, gaugeOK=need>=L.amp;
  panelLabCorrect().forEach(([a,c])=>{ if(!linked(a,c)){ const r=labRole(a);
    if(r==='hot'&&!brk) return;
    items.push({level:'warn',msg:({hot:'Hot (black) not landed on the breaker yet.',neutral:'Neutral (white) not on the neutral bar yet.',ground:'Ground (green) not on the ground bar yet.'})[r]}); } });
  if(!brk) items.push({level:'warn',msg:'No breaker installed \u2014 click the empty slot to rack one on the bus.'});
  if(!gaugeOK && brk) items.push({level:'warn',msg:`${L.gauge} AWG is too small for a ${L.amp}A breaker \u2014 use ${labMinGauge(L.amp)} AWG.`});
  const noDanger=!items.some(i=>i.level==='danger');
  const allCorrect=brk&&hotOK&&neuOK&&gndOK&&gaugeOK&&noDanger;
  if(L.mainOn && !allCorrect) items.unshift({level:'danger',msg:'\u26A0 LIVE PANEL \u2014 switch the MAIN off before landing any conductor.'});
  const energized=allCorrect && L.mainOn;
  const steps=[
    {done:brk,label:'Rack the breaker onto the bus'},
    {done:hotOK,label:'Land HOT (black) on the breaker'},
    {done:neuOK,label:'Land NEUTRAL (white) on the neutral bar'},
    {done:gndOK,label:'Land GROUND (green) on the ground bar'},
    {done:gaugeOK,label:'Cable size matches the breaker'},
    {done:energized,label:'Switch the MAIN on \u2014 test 120 V'}
  ];
  let status = items.some(i=>i.level==='danger')?'danger' : allCorrect?(energized?'ok':'warn') : (wires.length||brk||L.mainOn)?'warn':'empty';
  return {items,status,allCorrect,energized,steps};
}
function labPotential(){
  const L=state.panelLab; const {find}=labNets(); const linked=(a,b)=>find(a)===find(b);
  const ids=Object.keys(panelLabTerms());
  const hotSeeds=[]; if(L.mainOn){ hotSeeds.push('lab:BUS'); if(L.brk) hotSeeds.push('lab:brkLoad'); }
  const cls={};
  ids.forEach(id=>{ if(hotSeeds.some(s=>linked(id,s))) cls[id]='H'; else if(linked(id,'lab:NBAR')) cls[id]='N'; else if(linked(id,'lab:GBAR')) cls[id]='G'; else cls[id]='F'; });
  return cls;
}
function labVolt(a,b){ const cls=labPotential(), ca=cls[a]||'F', cb=cls[b]||'F'; if((ca==='H'&&(cb==='N'||cb==='G'))||(cb==='H'&&(ca==='N'||ca==='G'))) return 120; return 0; }
function labMeasure(){
  const m=state.panelLab.meter;
  if(m.mode==='cont'){ if(!m.a||!m.b) return {txt:'\u2014\u2014',sub:'probe two points'}; const {find}=labNets(); const beep=find(m.a)===find(m.b); return {txt:beep?'\u25CF BEEP':'\u00b7 open', sub:beep?'continuous':'no continuity'}; }
  if(!m.a||!m.b) return {txt:'\u2014\u2014',sub:'probe two points'};
  const v=labVolt(m.a,m.b); return {txt:v.toFixed(0)+' V~', sub:labName(m.a)+' \u2194 '+labName(m.b)};
}
function labWireColor(w){ const r=labRole(w.from)==='hot'&&labRole(w.to)==='hot'?'hot':(labRole(w.from)!=='hot'?labRole(w.from):labRole(w.to)); return r==='neutral'?WIRE_WHITE:r==='ground'?WIRE_GREEN:WIRE_BLACK; }

function renderPanelLab(wrap){
  const L=state.panelLab, T=panelLabTerms(), chk=panelLabCheck(), m=L.meter;
  const W=560, H=430;
  const mainOn=L.mainOn;
  let g=`<svg id="labSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-width:${W}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">`;
  g+=`<defs>
    <linearGradient id="labStage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3b54"/><stop offset="1" stop-color="#18222f"/></linearGradient>
    <linearGradient id="labSteel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dadee3"/><stop offset=".5" stop-color="#b7bcc4"/><stop offset="1" stop-color="#d0d4da"/></linearGradient>
    <linearGradient id="labDead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f3"/><stop offset="1" stop-color="#d9dde2"/></linearGradient>
    <linearGradient id="labCopper" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b96f2c"/><stop offset=".5" stop-color="#f4bd7a"/><stop offset="1" stop-color="#b96f2c"/></linearGradient>
    <linearGradient id="labAlum" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a7adb6"/><stop offset=".5" stop-color="#dfe3e8"/><stop offset="1" stop-color="#a7adb6"/></linearGradient>
    <linearGradient id="labBrk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d434c"/><stop offset="1" stop-color="#252a31"/></linearGradient>
  </defs>`;
  g+=`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#labStage)"/>`;
  g+=`<text x="280" y="21" font-size="11.5" font-weight="700" fill="#e0e8f4" text-anchor="middle" letter-spacing=".5">LOAD CENTRE \u2014 install one branch circuit</text>`;
  // steel enclosure + light interior
  g+=`<rect x="40" y="32" width="470" height="376" rx="10" fill="url(#labSteel)" stroke="#787f88" stroke-width="2"/>`;
  g+=`<rect x="52" y="44" width="446" height="352" rx="6" fill="url(#labDead)" stroke="#b0b6bf" stroke-width="1.4"/>`;
  [[62,54],[488,54],[62,386],[488,386]].forEach(([x,y])=>{ g+=`<circle cx="${x}" cy="${y}" r="3.4" fill="#c2c7cf" stroke="#7d848d"/><path d="M ${x-2} ${y} H ${x+2}" stroke="#5c636c" stroke-width="1"/>`; });
  // service conductors in
  g+=`<rect x="262" y="28" width="8" height="30" fill="#2b2f36"/><rect x="292" y="28" width="8" height="30" fill="#c0392b"/>`;
  // MAIN breaker
  g+=`<rect x="212" y="56" width="136" height="38" rx="4" fill="url(#labBrk)" stroke="#15181d"/>`;
  g+=`<text x="223" y="79" font-size="11" font-weight="700" fill="#eef1f5">MAIN</text>`;
  g+=`<text x="300" y="79" font-size="12" font-weight="700" fill="#ffd9a0" text-anchor="end">100A</text>`;
  g+=`<g data-labmain="1" style="cursor:pointer"><rect x="306" y="60" width="28" height="30" rx="3" fill="#e2e5ea" stroke="#9aa1ab"/><rect x="309" y="${mainOn?63:76}" width="22" height="11" rx="2.5" fill="${mainOn?'#25a85a':'#c0392b'}"/><text x="320" y="${mainOn?72:85}" font-size="7" font-weight="700" fill="#fff" text-anchor="middle">${mainOn?'ON':'OFF'}</text></g>`;
  g+=`<text x="320" y="104" font-size="8" font-weight="700" fill="${mainOn?'#8ff0b6':'#ffb0b0'}" text-anchor="middle">MAIN ${mainOn?'ON':'OFF'}</text>`;
  // bus L1 (bright copper)
  g+=`<path d="M 300 94 V 108 H 256" fill="none" stroke="url(#labCopper)" stroke-width="6" opacity="${mainOn?1:0.5}"/>`;
  g+=`<rect x="251" y="108" width="9" height="250" rx="2.5" fill="url(#labCopper)" stroke="#8a531f" stroke-width="0.6" opacity="${mainOn?1:0.5}"/>`;
  if(mainOn) g+=`<text x="262" y="352" font-size="8" font-weight="600" fill="#a85f22">bus LIVE</text>`;
  // branch breaker / empty slot
  if(L.brk){
    g+=`<rect x="150" y="150" width="104" height="40" rx="4" fill="url(#labBrk)" stroke="#15181d"/>`;
    g+=`<text x="150" y="145" font-size="8" font-weight="600" fill="#4a525d">BRANCH BREAKER</text>`;
    g+=`<text x="192" y="176" font-size="13" font-weight="700" fill="#ffd9a0" text-anchor="middle">${L.amp}A</text>`;
    g+=`<rect x="236" y="158" width="17" height="24" rx="2.5" fill="#e2e5ea" stroke="#9aa1ab"/><rect x="238.5" y="${mainOn?160:172}" width="12" height="10" rx="2" fill="${mainOn?'#25a85a':'#8a929c'}"/>`;
  } else {
    g+=`<rect data-labinstall="1" x="150" y="150" width="104" height="40" rx="4" fill="#d3d8de" stroke="#8b929b" stroke-width="1.6" stroke-dasharray="6 4" style="cursor:pointer"/>`;
    g+=`<text x="202" y="175" font-size="9.5" font-weight="700" fill="#495159" text-anchor="middle" style="pointer-events:none">+ click to rack ${L.amp}A</text>`;
  }
  // neutral + ground bars (aluminium)
  [['lab:NBAR','NEUTRAL','#3a4353','#6b7280'],['lab:GBAR','GROUND','#1e7a3a','#25a85a']].forEach(([id,lbl,lc,sc2])=>{
    const bx=T[id].x;
    g+=`<rect x="${bx-8}" y="108" width="16" height="250" rx="3" fill="url(#labAlum)" stroke="#868d97"/>`;
    for(let sy=122; sy<352; sy+=22) g+=`<circle cx="${bx}" cy="${sy}" r="2.4" fill="${sc2}"/>`;
    g+=`<text x="${bx}" y="102" font-size="8" font-weight="700" fill="${lc}" text-anchor="middle">${lbl}</text>`;
  });
  // incoming feed cable + fan-out to the three cores
  g+=`<path d="M 150 410 V 334" stroke="#9098a1" stroke-width="13" stroke-linecap="round"/>`;
  g+=`<path d="M 150 410 V 340" stroke="#c2c7cf" stroke-width="6" stroke-linecap="round"/>`;
  g+=`<path d="M 150 334 L 150 300 M 150 334 L 188 318 M 150 334 L 226 300" stroke="#8a919b" stroke-width="2.6" fill="none"/>`;
  g+=`<text x="150" y="404" font-size="8" font-weight="600" fill="#d3dcea" text-anchor="middle">FEED CABLE</text>`;
  // landed wires
  L.wires.forEach(w=>{ const a=T[w.from], c=T[w.to]; if(!a||!c) return; const bad=chk.items.some(it=>it.level==='danger'&&it.w===w.id); const midx=(a.x+c.x)/2; const path=`M ${a.x} ${a.y} C ${midx} ${a.y}, ${midx} ${c.y}, ${c.x} ${c.y}`; const col=labWireColor(w);
    const oc = col===WIRE_WHITE? '#8b929b' : col===WIRE_GREEN? '#17662f' : '#c9ced5';
    if(bad) g+=`<path d="${path}" fill="none" stroke="#e0473c" stroke-width="9" opacity="0.55"><animate attributeName="opacity" values="0.55;0.12;0.55" dur="0.6s" repeatCount="indefinite"/></path>`;
    if(L.sel===w.id) g+=`<path d="${path}" fill="none" stroke="#f0a830" stroke-width="9" opacity="0.5"/>`;
    g+=`<path d="${path}" fill="none" stroke="${oc}" stroke-width="6.6" stroke-linecap="round"/>`;
    g+=`<path data-labwire="${w.id}" d="${path}" fill="none" stroke="${col}" stroke-width="3.8" stroke-linecap="round" style="cursor:pointer"/>`;
    if(col===WIRE_GREEN) g+=`<path d="${path}" fill="none" stroke="#f2c200" stroke-width="1.5" stroke-dasharray="5 6" style="pointer-events:none"/>`;
  });
  // terminals
  Object.values(T).forEach(t=>{
    const isA=m.a===t.id, isB=m.b===t.id, sel=L.sel===t.id;
    const ring = isA?'#e0473c':isB?'#1d6fd6':sel?'#e08a1a':'#5c636c';
    if(t.kind==='cable'){
      const cc=t.role==='neutral'?'#f2f4f7':t.role==='ground'?WIRE_GREEN:'#2b2f36';
      const nm=t.role==='neutral'?'NEUTRAL':t.role==='ground'?'GROUND':'HOT';
      g+=`<rect x="${t.x-3.6}" y="${t.y-13}" width="7.2" height="13" rx="2" fill="${cc}" stroke="#5c636c" stroke-width="0.7"/>`;
      g+=`<circle cx="${t.x}" cy="${t.y}" r="4.4" fill="#e7b980" stroke="${ring}" stroke-width="${(isA||isB||sel)?2.6:1.3}"/>`;
      g+=`<text x="${t.x}" y="${t.y+19}" font-size="7.5" font-weight="700" fill="#20293a" text-anchor="middle" style="pointer-events:none">${nm}</text>`;
    } else {
      g+=`<rect x="${t.x-7.5}" y="${t.y-7.5}" width="15" height="15" rx="3" fill="#eceef1" stroke="#aab0b9"/>`;
      g+=`<circle cx="${t.x}" cy="${t.y}" r="6.2" fill="url(#labAlum)" stroke="${ring}" stroke-width="${(isA||isB||sel)?2.8:1.4}"/>`;
      g+=`<path d="M ${t.x-3.4} ${t.y} H ${t.x+3.4} M ${t.x} ${t.y-3.4} V ${t.y+3.4}" stroke="#5c636c" stroke-width="1.2" style="pointer-events:none"/>`;
      const lx=t.id==='lab:brkLoad'?t.x-12:t.x+12, anc=t.id==='lab:brkLoad'?'end':'start';
      g+=`<text x="${lx}" y="${t.y+3}" font-size="8.5" font-weight="700" fill="#20293a" text-anchor="${anc}" style="pointer-events:none">${t.label}</text>`;
    }
    if(isA||isB) g+=`<circle cx="${t.x}" cy="${t.y}" r="11.5" fill="none" stroke="${isA?'#e0473c':'#1d6fd6'}" stroke-width="1.9" style="pointer-events:none"/>`;
    g+=`<circle data-labterm="${t.id}" cx="${t.x}" cy="${t.y}" r="12" fill="transparent" style="cursor:pointer"/>`;
  });
  g+=`</svg>`;

  const sc={danger:['#e0473c','\u26A0 DANGER'],warn:['#f0a830','\u26A0 KEEP GOING'],ok:['#43b25f','\u2713 CIRCUIT LIVE & CORRECT'],empty:['#5d7396','Start the install']}[chk.status];
  const items=chk.items.slice().sort((a,b)=>({danger:0,warn:1,ok:2}[a.level]-{danger:0,warn:1,ok:2}[b.level]));

  wrap.innerHTML=`
  <div class="ac-toolbar" style="margin-bottom:12px">
    <div class="seg"><button data-panelmode="live">Live panel</button><button class="on">\u{1F527} Build &amp; Test</button><button data-panelmode="din">\u{1F50C} DIN board</button></div>
    <span class="tb-sep"></span>
    <button class="mini-btn ${L.mainOn?'primary':''}" data-labmaintog>Main: ${L.mainOn?'ON':'OFF'}</button>
    <button class="mini-btn" data-labbrk>${L.brk?'Remove breaker':'Install breaker'}</button>
    <label style="font-size:12px;color:var(--text-dim)">Breaker <select class="ac-sel" style="width:auto;display:inline-block;padding:4px 6px" id="labAmp">${[15,20,30,40,50].map(a=>`<option value="${a}" ${a===L.amp?'selected':''}>${a}A</option>`).join('')}</select></label>
    <label style="font-size:12px;color:var(--text-dim)">Cable <select class="ac-sel" style="width:auto;display:inline-block;padding:4px 6px" id="labGauge">${['14','12','10','8','6'].map(x=>`<option value="${x}" ${x===L.gauge?'selected':''}>${x} AWG</option>`).join('')}</select></label>
    <span class="tb-sep"></span>
    <button class="mini-btn" data-labauto>Auto-build</button>
    <button class="mini-btn" data-labclear>Clear wires</button>
    <button class="mini-btn" data-labreset>\u21BB Reset</button>
    ${L.sel&&state.panelLab.wires.some(w=>w.id===L.sel)?`<button class="mini-btn danger-mini" data-labdelwire>Delete wire</button>`:''}
  </div>
  <div class="ac-stage">
    <div class="ac-canvas">${g}</div>
    <div class="ac-side">
      <div class="ac-status" style="border-color:${sc[0]};color:${sc[0]}">${sc[1]}</div>
      <div class="ac-diag">
        <div class="side-title">Install steps</div>
        ${chk.steps.map(s=>`<div class="lab-step ${s.done?'done':''}">${s.done?'\u2713':'\u25CB'} ${esc(s.label)}</div>`).join('')}
      </div>
      <div class="ac-alerts">
        ${items.length? items.map(it=>`<div class="ac-alert ${it.level}">${esc(it.msg)}</div>`).join('') : '<div class="ac-alert ok">Isolate the main, rack the breaker, then land the three conductors.</div>'}
      </div>
      <div class="ac-diag">
        <div class="side-title">Tester</div>
        <button class="mini-btn ${m.probe?'primary':''}" id="labProbe" style="width:100%">${m.probe?'\u25C9 Probing \u2014 click two points':'Use probes'}</button>
        <div class="mm-modes">${[['v','V~'],['cont','\u25CF cont']].map(([k,l])=>`<button class="mm-mode ${m.mode===k?'on':''}" data-labmeter="${k}">${l}</button>`).join('')}</div>
        <div class="mm-display"><div class="mm-val">${esc(labMeasure().txt)}</div><div class="mm-sub">${esc(labMeasure().sub)}</div></div>
        <div class="mm-probes">A: <b>${m.a?esc(labName(m.a)):'\u2014'}</b> \u00b7 B: <b>${m.b?esc(labName(m.b)):'\u2014'}</b> <button class="linkbtn" id="labProbeClear">clear</button></div>
        <div class="empty-hint" style="margin-top:6px">Real habit: switch the main OFF, prove it dead, wire it, then re-energise and verify. Correct wiring should read <b>~120 V</b> hot\u2013neutral and hot\u2013ground, and <b>0 V</b> neutral\u2013ground.</div>
      </div>
    </div>
  </div>`;

  const svg=document.getElementById('labSvg');
  svg.addEventListener('click',e=>{
    const t=e.target.closest('[data-labterm]'); if(t){ panelLabClick(t.dataset.labterm); return; }
    const w=e.target.closest('[data-labwire]'); if(w){ L.sel=w.dataset.labwire; renderPanelsTab(); return; }
    const inst=e.target.closest('[data-labinstall]'); if(inst){ L.brk=true; renderPanelsTab(); markDirty(); return; }
    const mn=e.target.closest('[data-labmain]'); if(mn){ L.mainOn=!L.mainOn; renderPanelsTab(); markDirty(); return; }
    L.sel=null; renderPanelsTab();
  });
  const on=(sel,f)=>{ const el=wrap.querySelector(sel); if(el) el.addEventListener('click',f); };
  wrap.querySelectorAll('[data-panelmode]').forEach(b=>b.addEventListener('click',()=>{ state.panelLab.view=b.dataset.panelmode; renderPanelsTab(); }));
  on('[data-labmaintog]',()=>{ L.mainOn=!L.mainOn; renderPanelsTab(); markDirty(); });
  on('[data-labbrk]',()=>{ L.brk=!L.brk; if(!L.brk) L.wires=L.wires.filter(w=>w.from!=='lab:brkLoad'&&w.to!=='lab:brkLoad'); renderPanelsTab(); markDirty(); });
  on('[data-labauto]',()=>{ L.brk=true; L.gauge=labMinGauge(L.amp); L.wires=panelLabCorrect().map((p,i)=>({id:'lw'+i,from:p[0],to:p[1]})); L.mainOn=true; L.sel=null; renderPanelsTab(); markDirty(); });
  on('[data-labclear]',()=>{ L.wires=[]; L.sel=null; L.mainOn=false; renderPanelsTab(); markDirty(); });
  on('[data-labreset]',resetLab);
  on('[data-labdelwire]',()=>{ L.wires=L.wires.filter(w=>w.id!==L.sel); L.sel=null; renderPanelsTab(); markDirty(); });
  const amp=wrap.querySelector('#labAmp'); if(amp) amp.addEventListener('change',()=>{ L.amp=parseInt(amp.value); renderPanelsTab(); markDirty(); });
  const ga=wrap.querySelector('#labGauge'); if(ga) ga.addEventListener('change',()=>{ L.gauge=ga.value; renderPanelsTab(); markDirty(); });
  on('#labProbe',()=>{ m.probe=!m.probe; if(m.probe) L.sel=null; renderPanelsTab(); });
  on('#labProbeClear',()=>{ m.a=null; m.b=null; renderPanelsTab(); });
  wrap.querySelectorAll('[data-labmeter]').forEach(x=>x.addEventListener('click',()=>{ m.mode=x.dataset.labmeter; renderPanelsTab(); }));
}
function panelLabClick(id){
  const L=state.panelLab, m=L.meter;
  if(m.probe){ if(!m.a||(m.a&&m.b)){ m.a=id; m.b=null; } else if(id!==m.a){ m.b=id; } renderPanelsTab(); return; }
  if(L.sel && L.sel!==id && !L.wires.some(w=>w.id===L.sel)){
    L.wires.push({id:'lw'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),from:L.sel,to:id});
    L.sel=null; renderPanelsTab(); markDirty();
  } else { L.sel=(L.sel===id)?null:id; renderPanelsTab(); }
}

/* ============================================================
   DIN BOARD BUILDER — recreate real installs (user's photos):
   preset 'cu'    = RCBO consumer unit (numbered earth bar, comb)
   preset 'kiosk' = outdoor automation kiosk (RCD, MCBs, 24V PSU,
                    logic controller, glands, underground duct)
   ============================================================ */
function dinLayout(){
  const preset=(state.dinLab&&state.dinLab.preset)||'cu';
  const T={};
  const t=(id,x,y,label,role,lp)=>{ T[id]={id,x,y,label,role,lp}; };
  if(preset==='cu'){
    t('ebar:E',68,96,'E','earth','above'); t('ebar:1',200,96,'1','earth','above'); t('ebar:2',290,96,'2','earth','above'); t('ebar:3',380,96,'3','earth','above');
    t('main:Lin',120,162,'L','phase','mod'); t('main:Nin',160,162,'N','neutral','mod');
    const rx=[240,340,440], names=['LIGHTS','SOCKETS','COOKER'], amps=['B6','B20','B32'];
    rx.forEach((x,i)=>{ const k=i+1;
      t('rcbo'+k+':L',x+16,162,'L','phase','mod'); t('rcbo'+k+':N',x+48,162,'N','neutral','mod');
      t('ckt'+k+':L',x+16,126,'L','phase','ctop'); t('ckt'+k+':N',x+48,126,'N','neutral','ctop'); t('ckt'+k+':E',x+80,126,'E','earth','ctop');
    });
    t('sup:L',58,170,'L','phase','left'); t('sup:N',58,200,'N','neutral','left'); t('sup:E',58,230,'E','earth','left');
    const pairs=[['sup:L','main:Lin'],['sup:N','main:Nin'],['sup:E','ebar:E']];
    for(let k=1;k<=3;k++) pairs.push(['rcbo'+k+':L','ckt'+k+':L'],['rcbo'+k+':N','ckt'+k+':N'],['ebar:'+k,'ckt'+k+':E']);
    return {preset,T,pairs,W:880,H:390,rx,names,amps};
  }
  t('ebar:E',64,96,'E','earth','above'); t('ebar:1',84,96,'1','earth','above');
  t('main:Lin',105,162,'L','phase','mod'); t('main:Nin',140,162,'N','neutral','mod'); t('main:Lout',105,258,'L','phase','modb'); t('main:Nout',140,258,'N','neutral','modb');
  t('rcd:Lin',200,162,'L','phase','mod'); t('rcd:Nin',235,162,'N','neutral','mod'); t('rcd:Lout',200,258,'L','phase','modb'); t('rcd:Nout',235,258,'N','neutral','modb');
  t('mcb1:Lin',300,162,'L','phase','mod'); t('mcb1:Lout',300,258,'L','phase','modb');
  t('mcb2:Lin',350,162,'L','phase','mod'); t('mcb2:Lout',350,258,'L','phase','modb');
  t('psu:L',415,162,'L','phase','mod'); t('psu:N',455,162,'N','neutral','mod'); t('psu:P',415,258,'+24','dcp','modb'); t('psu:M',455,258,'0V','dcm','modb');
  t('ctrl:P',200,342,'+24','dcp','mod'); t('ctrl:M',235,342,'0V','dcm','mod');
  t('sup:L',95,480,'L','phase','below'); t('sup:N',125,480,'N','neutral','below'); t('sup:E',155,480,'E','earth','below');
  t('pump:L',600,480,'L','phase','below'); t('pump:N',630,480,'N','neutral','below'); t('pump:E',660,480,'E','earth','below');
  const pairs=[['sup:L','main:Lin'],['sup:N','main:Nin'],['sup:E','ebar:E'],
    ['main:Lout','rcd:Lin'],['main:Nout','rcd:Nin'],
    ['rcd:Lout','mcb1:Lin'],['rcd:Lout','mcb2:Lin'],
    ['mcb1:Lout','pump:L'],['rcd:Nout','pump:N'],['pump:E','ebar:1'],
    ['mcb2:Lout','psu:L'],['rcd:Nout','psu:N'],
    ['psu:P','ctrl:P'],['psu:M','ctrl:M']];
  return {preset,T,pairs,W:880,H:560};
}
function dinNets(){ const p={}; const find=x=>{ if(p[x]===undefined)p[x]=x; while(p[x]!==x){ p[x]=p[p[x]]; x=p[x]; } return x; }; state.dinLab.wires.forEach(w=>{ p[find(w.from)]=find(w.to); }); return {find}; }
function dinColorFor(role){ const s=AC_STD.iec; return role==='phase'?s.L1: role==='neutral'?s.N: role==='earth'?s.PE: role==='dcp'?'#c0392b':'#3a3f45'; }
function dinRoleName(role){ return role==='phase'?'brown (live)':role==='neutral'?'blue (neutral)':role==='earth'?'green/yellow (earth)':role==='dcp'?'red (+24V DC)':'dark grey (0V DC)'; }
function dinHuman(id){ const [b]=id.split(':'); const L=dinLayout();
  const names={sup:'Supply tails',main:'Main switch',rcd:'RCD 30mA',mcb1:'MCB B6 \u00b7 pump',mcb2:'MCB B6 \u00b7 ctrl',psu:'24V power supply',ctrl:'Controller',ebar:'Earth bar',pump:'Pump cable',rcbo1:'RCBO Lights',rcbo2:'RCBO Sockets',rcbo3:'RCBO Cooker',ckt1:'Lights cable',ckt2:'Sockets cable',ckt3:'Cooker cable'};
  return (names[b]||b)+' \u00b7 '+(L.T[id]?L.T[id].label:''); }
function checkDIN(){
  const L=dinLayout(); const {find}=dinNets();
  const linked=(a,c)=>find(a)===find(c);
  const items=[]; let danger=false;
  const nets={};
  Object.keys(L.T).forEach(id=>{ const r=find(id); (nets[r]=nets[r]||[]).push(id); });
  Object.values(nets).forEach(ids=>{ if(ids.length<2) return;
    const roles=new Set(ids.map(id=>L.T[id].role)); const has=r=>roles.has(r);
    if(has('phase')&&has('neutral')){ items.push({level:'danger',msg:'Live and neutral joined \u2014 dead short.'}); danger=true; }
    if(has('phase')&&has('earth')){ items.push({level:'danger',msg:'Live tied to earth \u2014 short to earth.'}); danger=true; }
    if(has('neutral')&&has('earth')){ items.push({level:'danger',msg:'Neutral tied to earth \u2014 the RCD will trip.'}); danger=true; }
    if((has('dcp')||has('dcm'))&&(has('phase')||has('neutral'))){ items.push({level:'danger',msg:'230V wired into the 24V DC side \u2014 destroys the electronics.'}); danger=true; }
    if(ids.includes('psu:P')&&ids.includes('psu:M')){ items.push({level:'danger',msg:'+24V shorted to 0V across the power supply.'}); danger=true; }
  });
  if(L.preset==='kiosk' && !danger){
    const rev=(linked('psu:P','ctrl:M')||linked('psu:M','ctrl:P')) && !(linked('psu:P','ctrl:P')&&linked('psu:M','ctrl:M'));
    if(rev) items.push({level:'warn',msg:'DC polarity reversed \u2014 the controller will not start.'});
  }
  const missing=L.pairs.filter(([a,c])=>!linked(a,c));
  const allCorrect=!danger && missing.length===0 && !items.some(i=>i.level==='warn');
  if(missing.length && !danger) items.push({level:'warn',msg:missing.length+' connection'+(missing.length>1?'s':'')+' still to make.'});
  if(allCorrect) items.push({level:'ok',msg:'Board wired correctly.'});
  return {items,missing,allCorrect,danger,total:L.pairs.length};
}
function dinNextStep(){ const L=dinLayout(); const {find}=dinNets(); for(const [a,c] of L.pairs){ if(find(a)!==find(c)) return {from:a,to:c,role:L.T[a].role}; } return null; }
function dinDoStep(){ const s=dinNextStep(); if(!s){ renderPanelsTab(); return; } state.dinLab.wires.push({id:'dw'+(state.counters.conn++)+'_'+Date.now().toString(36),from:s.from,to:s.to,color:dinColorFor(s.role)}); state.dinLab.sel=null; renderPanelsTab(); markDirty(); }
function dinAutoWire(){ const L=dinLayout(); const {find}=dinNets(); L.pairs.forEach(([a,c])=>{ if(find(a)!==find(c)) state.dinLab.wires.push({id:'dw'+(state.counters.conn++)+'_'+Date.now().toString(36),from:a,to:c,color:dinColorFor(L.T[a].role)}); }); state.dinLab.sel=null; renderPanelsTab(); markDirty(); }
function dinClickTerminal(id){ const D=state.dinLab;
  if(D.sel && D.sel!==id){ const L=dinLayout(); const role=L.T[D.sel]?L.T[D.sel].role:'phase';
    D.wires.push({id:'dw'+(state.counters.conn++)+'_'+Date.now().toString(36),from:D.sel,to:id,color:dinColorFor(role)});
    D.sel=null; renderPanelsTab(); markDirty();
  } else { D.sel=(D.sel===id?null:id); renderPanelsTab(); } }
function dinState(){
  const D=state.dinLab; const chk=checkDIN(); const L=dinLayout();
  if(!D.powerOn) return {label:'ISOLATED \u2014 safe to work',color:'#5d7396'};
  if(chk.danger) return {tripped:true,label:'\u26A0 TRIPPED \u2014 fault on the board',color:'#e0473c'};
  if(!chk.allCorrect) return {label:'\u26A0 POWERED \u2014 wiring incomplete',color:'#f0a830'};
  if(L.preset==='kiosk' && D.fault==='water') return {tripped:true,label:'\u26A0 RCD TRIPPED \u2014 earth leakage',color:'#e0473c',reason:'Water in the duct is leaking to earth. Insulation L\u2013E \u2248 0.02 M\u03A9. Seal the duct and dry it out.'};
  return {running:true,label:L.preset==='kiosk'?'\u2713 RUNNING \u2014 controller online':'\u2713 LIVE \u2014 all circuits healthy',color:'#43b25f'};
}
function resetDIN(){ if(!confirm('Reset the DIN board? Clears all wiring, power and faults.')) return; Object.assign(state.dinLab,{wires:[],sel:null,powerOn:false,fault:'none',sealed:true}); renderPanelsTab(); markDirty(); showToast('DIN board reset'); }

function renderDINLab(wrap){
  if(!state.dinLab) state.dinLab={preset:'cu',wires:[],sel:null,powerOn:false,fault:'none',sealed:true};
  const D=state.dinLab; const L=dinLayout(); const T=L.T; const chk=checkDIN(); const st=dinState();
  const next=dinNextStep(); const hi=next?new Set([next.from,next.to]):null;
  const W=L.W,H=L.H; const on=D.powerOn;
  let g=`<svg id="dinSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-width:${W}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">`;
  g+=`<defs>
    <linearGradient id="dinStage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd2dc"/><stop offset="1" stop-color="#b1bac6"/></linearGradient>
    <linearGradient id="dinDead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f4f7"/><stop offset="1" stop-color="#dde1e6"/></linearGradient>
    <linearGradient id="dinBrass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b58a3a"/><stop offset=".5" stop-color="#eec984"/><stop offset="1" stop-color="#b58a3a"/></linearGradient>
    <linearGradient id="dinRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe3e8"/><stop offset="1" stop-color="#9aa1ab"/></linearGradient>
  </defs>`;
  g+=`<rect width="${W}" height="${H}" fill="url(#dinStage)"/>`;
  if(L.preset==='kiosk'){
    g+=`<rect x="16" y="14" width="${W-32}" height="${H-28}" rx="14" fill="#2e5d46" stroke="#1f4130" stroke-width="2"/>`;
    g+=`<rect x="38" y="46" width="${W-76}" height="${H-108}" rx="8" fill="url(#dinDead)" stroke="#aab0b9"/>`;
    g+=`<text x="${W/2}" y="34" font-size="11" font-weight="700" fill="#dfeee6" text-anchor="middle" letter-spacing=".5">OUTDOOR AUTOMATION KIOSK \u2014 like your photo</text>`;
  } else {
    g+=`<rect x="26" y="36" width="${W-52}" height="${H-70}" rx="10" fill="#e6e9ee" stroke="#8b929b" stroke-width="2"/>`;
    g+=`<rect x="40" y="50" width="${W-80}" height="${H-98}" rx="6" fill="url(#dinDead)" stroke="#b0b6bf"/>`;
    g+=`<text x="${W/2}" y="26" font-size="11" font-weight="700" fill="#33475f" text-anchor="middle" letter-spacing=".5">CONSUMER UNIT \u2014 RCBO board like your photo</text>`;
  }
  const ebX0=L.preset==='cu'?56:52, ebX1=L.preset==='cu'?470:96;
  g+=`<rect x="${ebX0}" y="74" width="${ebX1-ebX0}" height="12" fill="#2f9e4f"/>`;
  g+=`<rect x="${ebX0}" y="87" width="${ebX1-ebX0}" height="15" rx="3" fill="url(#dinBrass)" stroke="#8a6a2a"/>`;
  for(let sx=ebX0+10; sx<ebX1-6; sx+=24){ g+=`<circle cx="${sx}" cy="94.5" r="4" fill="#d9dee4" stroke="#7d848d" stroke-width="0.8"/><path d="M ${sx-2.2} 94.5 H ${sx+2.2}" stroke="#5c636c" stroke-width="1"/>`; }
  g+=`<text x="${ebX1+12}" y="98" font-size="8" font-weight="700" fill="#20293a">EARTH BAR</text>`;
  if(L.preset==='kiosk'){ g+=`<rect x="340" y="82" width="420" height="20" rx="3" fill="#e7ebf0" stroke="#aab0b9"/>`; for(let sx=352; sx<752; sx+=22) g+=`<circle cx="${sx}" cy="92" r="3.4" fill="#c6cbd2" stroke="#8a919b" stroke-width="0.7"/>`; g+=`<text x="550" y="115" font-size="7" fill="#5a6472" text-anchor="middle">terminal strip</text>`; }
  const railY=206;
  g+=`<rect x="70" y="${railY}" width="${L.preset==='cu'?720:700}" height="9" fill="url(#dinRail)" stroke="#868d97" stroke-width="0.7"/>`;
  if(L.preset==='kiosk') g+=`<rect x="70" y="376" width="700" height="9" fill="url(#dinRail)" stroke="#868d97" stroke-width="0.7"/>`;
  const shadow=(x,y,w,h)=>`<rect x="${x+1.5}" y="${y+2}" width="${w}" height="${h}" rx="4" fill="#000" opacity="0.1"/>`;
  const handle=(x,y,w)=>`<rect x="${x}" y="${y}" width="${w}" height="22" rx="3" fill="${on?'#25a85a':'#3a3f45'}"/><text x="${x+w/2}" y="${y+14.5}" font-size="7" font-weight="700" fill="#fff" text-anchor="middle">${on?'I-ON':'O-OFF'}</text>`;
  if(L.preset==='cu'){
    g+=shadow(100,150,80,120)+`<rect x="100" y="150" width="80" height="120" rx="4" fill="#f7f9fb" stroke="#adb4be" stroke-width="1.2"/>`;
    g+=`<text x="140" y="200" font-size="9" font-weight="700" fill="#33475f" text-anchor="middle">100A</text>`;
    g+=handle(112,212,56);
    g+=`<text x="140" y="286" font-size="7.5" font-weight="700" fill="#33475f" text-anchor="middle">MAIN SWITCH</text>`;
    L.rx.forEach((x,i)=>{
      g+=shadow(x,150,64,120)+`<rect x="${x}" y="150" width="64" height="120" rx="4" fill="#f7f9fb" stroke="#adb4be" stroke-width="1.2"/>`;
      g+=`<text x="${x+32}" y="200" font-size="8.5" font-weight="700" fill="#33475f" text-anchor="middle">${L.amps[i]}</text>`;
      g+=`<circle cx="${x+15}" cy="222" r="5.5" fill="#e08a1a" stroke="#a8650e"/><text x="${x+15}" y="225" font-size="6" font-weight="700" fill="#fff" text-anchor="middle">T</text>`;
      g+=handle(x+26,212,30);
      g+=`<text x="${x+32}" y="286" font-size="7" font-weight="700" fill="#33475f" text-anchor="middle">${L.names[i]}</text>`;
      g+=`<text x="${x+32}" y="243" font-size="5" fill="#8a919b" text-anchor="middle">RCBO 30mA</text>`;
    });
    g+=`<rect x="106" y="274" width="392" height="7" rx="2" fill="#e39a3b" stroke="#a86a1e" stroke-width="0.8"/>`;
    [140,272,372,472].forEach(cx=>{ g+=`<rect x="${cx-3}" y="268" width="6" height="7" fill="#e39a3b" stroke="#a86a1e" stroke-width="0.6"/>`; });
    g+=`<text x="300" y="296" font-size="7" fill="#7a5a20" text-anchor="middle">busbar comb \u2014 feeds every breaker</text>`;
    if(on) g+=`<text x="396" y="296" font-size="7" font-weight="700" fill="#b9791a">LIVE</text>`;
    g+=`<text x="58" y="256" font-size="6.5" font-weight="700" fill="#33475f" text-anchor="middle">SUPPLY</text>`;
    g+=`<text x="58" y="265" font-size="6.5" font-weight="700" fill="#33475f" text-anchor="middle">TAILS</text>`;
    g+=`<text x="620" y="130" font-size="7" fill="#5a6472" text-anchor="middle">circuit cables come in from the top \u2014 like your photo</text>`;
  } else {
    const mods=[{x:90,w:70,type:'main'},{x:185,w:70,type:'rcd'},{x:280,w:40,type:'mcb',name:'PUMP',amp:'B6'},{x:330,w:40,type:'mcb',name:'CTRL',amp:'B6'},{x:395,w:110,type:'psu'}];
    mods.forEach(m=>{
      const dark=m.type==='psu';
      g+=shadow(m.x,150,m.w,120)+`<rect x="${m.x}" y="150" width="${m.w}" height="120" rx="4" fill="${dark?'#2c3e6b':'#f7f9fb'}" stroke="${dark?'#1d2a4a':'#adb4be'}" stroke-width="1.2"/>`;
      if(m.type==='main'){ g+=`<text x="${m.x+m.w/2}" y="198" font-size="8.5" font-weight="700" fill="#33475f" text-anchor="middle">63A</text>`+handle(m.x+10,208,m.w-20)+`<text x="${m.x+m.w/2}" y="286" font-size="7" font-weight="700" fill="#33475f" text-anchor="middle">MAIN</text>`; }
      if(m.type==='rcd'){ g+=`<rect x="${m.x+10}" y="208" width="18" height="22" rx="2" fill="#2f9e4f"/><text x="${m.x+19}" y="222" font-size="7" font-weight="700" fill="#fff" text-anchor="middle">T</text>`+handle(m.x+34,208,26)+`<text x="${m.x+m.w/2}" y="286" font-size="7" font-weight="700" fill="#33475f" text-anchor="middle">30mA RCD</text>`; }
      if(m.type==='mcb'){ g+=`<text x="${m.x+m.w/2}" y="198" font-size="7.5" font-weight="700" fill="#33475f" text-anchor="middle">${m.amp}</text>`+handle(m.x+7,208,m.w-14)+`<text x="${m.x+m.w/2}" y="286" font-size="6.5" font-weight="700" fill="#33475f" text-anchor="middle">${m.name}</text>`; }
      if(m.type==='psu'){
        g+=`<text x="${m.x+m.w/2}" y="200" font-size="9" font-weight="700" fill="#eaf1fb" text-anchor="middle">DC 24V</text>`;
        g+=`<text x="${m.x+m.w/2}" y="212" font-size="6" fill="#9fb3d8" text-anchor="middle">POWER SUPPLY</text>`;
        g+=`<circle cx="${m.x+m.w-16}" cy="226" r="3.2" fill="${st.running?'#5fd394':'#39424f'}"/><text x="${m.x+m.w-16}" y="238" font-size="5" fill="#9fb3d8" text-anchor="middle">DC OK</text>`;
      }
    });
    g+=shadow(170,330,260,100)+`<rect x="170" y="330" width="260" height="100" rx="6" fill="#23262b" stroke="#0f1114" stroke-width="1.2"/>`;
    g+=`<rect x="180" y="380" width="240" height="14" rx="2" fill="#5fd394"/><text x="300" y="390.5" font-size="8" font-weight="700" fill="#123420" text-anchor="middle">LOGIC CONTROLLER</text>`;
    for(let sx=186; sx<414; sx+=14) g+=`<rect x="${sx}" y="408" width="10" height="12" rx="1.5" fill="#c0392b" stroke="#7d241c" stroke-width="0.6"/>`;
    g+=`<circle cx="410" cy="344" r="3.4" fill="${st.running?'#5fd394':'#3a3f45'}"/>`;
    if(st.running) g+=`<circle cx="410" cy="344" r="3.4" fill="#5fd394"><animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite"/></circle>`;
    g+=`<text x="300" y="369" font-size="6" fill="#8a929c" text-anchor="middle">smart-home / automation module (24V DC)</text>`;
    g+=`<circle cx="125" cy="505" r="9" fill="#c6cbd2" stroke="#8a919b"/><text x="125" y="527" font-size="7" font-weight="700" fill="#dfeee6" text-anchor="middle">SUPPLY</text>`;
    g+=`<circle cx="630" cy="505" r="9" fill="#c6cbd2" stroke="#8a919b"/><text x="630" y="527" font-size="7" font-weight="700" fill="#dfeee6" text-anchor="middle">PUMP cable</text>`;
    const sealed=D.sealed && D.fault!=='water';
    g+=`<ellipse cx="430" cy="516" rx="30" ry="13" fill="#8a5a34" stroke="#6b451f" stroke-width="1.2"/>`;
    if(sealed) g+=`<path d="M 408 512 Q 418 502 430 508 Q 442 500 452 512 Q 444 518 430 516 Q 416 520 408 512 Z" fill="#f2f4f7" stroke="#c9ced5"/>`;
    else { for(let i=0;i<3;i++) g+=`<circle cx="${418+i*12}" cy="${506-i*4}" r="3" fill="#4aa3e8" opacity="0.9"/>`; }
    g+=`<text x="430" y="543" font-size="7" font-weight="700" fill="${sealed?'#9fe0b8':'#ff9e9e'}" text-anchor="middle">${sealed?'underground duct \u2014 sealed':'underground duct \u2014 UNSEALED \u00b7 water path!'}</text>`;
  }
  D.wires.forEach(w=>{ const a=T[w.from], c=T[w.to]; if(!a||!c) return;
    const conflict=(a.role!==c.role);
    const dy=Math.abs(a.y-c.y), lo=Math.min(a.y,c.y), hi2=Math.max(a.y,c.y);
    let path;
    if(lo<310 && hi2>450){ // long run: route through the clear channel between rails
      const lane=302, dir=c.x>a.x?1:-1;
      path=`M ${a.x} ${a.y} C ${a.x} ${lane}, ${a.x} ${lane}, ${a.x+dir*22} ${lane} L ${c.x-dir*22} ${lane} C ${c.x} ${lane}, ${c.x} ${lane}, ${c.x} ${c.y}`;
    } else if(dy<60){ const mx=(a.x+c.x)/2; path=`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${c.y}, ${c.x} ${c.y}`; }
    else { const my=(a.y+c.y)/2; path=`M ${a.x} ${a.y} C ${a.x} ${my}, ${c.x} ${my}, ${c.x} ${c.y}`; }
    if(conflict) g+=`<path d="${path}" fill="none" stroke="#e0473c" stroke-width="9" opacity="0.5"><animate attributeName="opacity" values="0.5;0.12;0.5" dur="0.6s" repeatCount="indefinite"/></path>`;
    g+=`<path d="${path}" fill="none" stroke="#2c333c" stroke-width="6.4" stroke-linecap="round" style="pointer-events:none"/>`;
    g+=`<path data-dinwire="${w.id}" d="${path}" fill="none" stroke="${w.color}" stroke-width="3.6" stroke-linecap="round" style="cursor:pointer"/>`;
    g+=`<path d="${path}" fill="none" stroke="#fff" stroke-width="1" opacity="0.2" style="pointer-events:none"/>`;
    if(w.color===AC_STD.iec.PE) g+=`<path d="${path}" fill="none" stroke="#f2c200" stroke-width="1.4" stroke-dasharray="5 6" style="pointer-events:none"/>`;
  });
  Object.values(T).forEach(t2=>{
    const sel=D.sel===t2.id;
    const dark=t2.id.indexOf('psu:')===0||t2.id.indexOf('ctrl:')===0;
    if(t2.lp==='below'){ g+=`<rect x="${t2.x-3.5}" y="${t2.y-17}" width="7" height="13" rx="2" fill="${dinColorFor(t2.role)}" stroke="#5c636c" stroke-width="0.7"/>`; }
    if(t2.lp==='ctop'){ g+=`<rect x="${t2.x-3.5}" y="${t2.y-17}" width="7" height="13" rx="2" fill="${dinColorFor(t2.role)}" stroke="#5c636c" stroke-width="0.7"/>`; }
    if(t2.lp==='left'){ g+=`<rect x="${t2.x-17}" y="${t2.y-3.5}" width="13" height="7" rx="2" fill="${dinColorFor(t2.role)}" stroke="#5c636c" stroke-width="0.7"/>`; }
    g+=`<rect x="${t2.x-7}" y="${t2.y-7}" width="14" height="14" rx="3" fill="${dark?'#39424f':'#e7ebf0'}" stroke="${dark?'#5c6673':'#adb4be'}"/>`;
    g+=`<circle cx="${t2.x}" cy="${t2.y}" r="5.8" fill="#c6cbd2" stroke="${sel?'#e08a1a':'#7a828d'}" stroke-width="${sel?2.6:1.2}"/>`;
    g+=`<path d="M ${t2.x-3.1} ${t2.y} H ${t2.x+3.1} M ${t2.x} ${t2.y-3.1} V ${t2.y+3.1}" stroke="#5c636c" stroke-width="1.1" style="pointer-events:none"/>`;
    g+=`<circle cx="${t2.x+4.6}" cy="${t2.y-4.6}" r="2.3" fill="${dinColorFor(t2.role)}" stroke="#fff" stroke-width="0.7" style="pointer-events:none"/>`;
    if(hi&&hi.has(t2.id)) g+=`<circle cx="${t2.x}" cy="${t2.y}" r="12" fill="none" stroke="#f0a830" stroke-width="2.6" style="pointer-events:none"><animate attributeName="r" values="11;16;11" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite"/></circle>`;
    const lc=dark?'#eaf1fb':'#20293a';
    if(t2.lp==='above') g+=`<text x="${t2.x}" y="${t2.y-12}" font-size="7.5" font-weight="700" fill="#fff" text-anchor="middle" style="pointer-events:none">${t2.label}</text>`;
    else if(t2.lp==='mod') g+=`<text x="${t2.x}" y="${t2.y+16}" font-size="6.5" font-weight="700" fill="${lc}" text-anchor="middle" style="pointer-events:none">${t2.label}</text>`;
    else if(t2.lp==='modb') g+=`<text x="${t2.x}" y="${t2.y-10.5}" font-size="6.5" font-weight="700" fill="${lc}" text-anchor="middle" style="pointer-events:none">${t2.label}</text>`;
    else if(t2.lp==='ctop') g+=`<text x="${t2.x}" y="${t2.y+13.5}" font-size="6" font-weight="700" fill="#20293a" text-anchor="middle" style="pointer-events:none">${t2.label}</text>`;
    else if(t2.lp==='left') g+=`<text x="${t2.x-21}" y="${t2.y+2.6}" font-size="7" font-weight="700" fill="#20293a" text-anchor="end" style="pointer-events:none">${t2.label}</text>`;
    else g+=`<text x="${t2.x}" y="${t2.y+19}" font-size="7.5" font-weight="700" fill="${L.preset==='kiosk'?'#dfeee6':'#20293a'}" text-anchor="middle" style="pointer-events:none">${t2.label}</text>`;
    g+=`<circle data-dinterm="${t2.id}" cx="${t2.x}" cy="${t2.y}" r="11" fill="transparent" style="cursor:pointer"/>`;
  });
  g+=`</svg>`;

  const wired=chk.total-chk.missing.length;
  const insul = D.fault==='water' ? '0.02 M\u03A9 \u2014 FAIL' : '>200 M\u03A9 \u2014 PASS';
  let side=`<div class="ac-side">
    <div class="ac-status" style="border-color:${st.color};color:${st.color}">${st.label}</div>
    ${st.reason?`<div class="ac-alert danger">${esc(st.reason)}</div>`:''}
    <button class="ac-energize ${on?'on':''}" data-dinenergize>${on?'\u23FB Power is ON \u2014 click to isolate':'\u26A1 Energize / Test'}</button>
    ${next?`<div class="ac-guide">
      <div class="ac-guide-h">Next \u00b7 ${wired+1} of ${chk.total}</div>
      <div class="ac-guide-b">Run a <b style="color:${dinColorFor(next.role)}">${esc(dinRoleName(next.role))}</b> wire:</div>
      <div class="ac-guide-run">${esc(dinHuman(next.from))}<br><span class="ac-guide-arr">\u2193 to \u2193</span><br>${esc(dinHuman(next.to))}</div>
      <div class="ac-guide-t">Click the two <b>glowing screws</b> \u2014 or:</div>
      <button class="mini-btn primary" data-dindostep style="width:100%;margin-top:6px">\u26A1 Make this connection for me</button>
    </div>`:(chk.allCorrect&&!on?`<div class="ac-guide ok"><div class="ac-guide-h">\u2713 Board complete!</div><div class="ac-guide-t">Press <b>Energize / Test</b> to bring it live.</div></div>`:'')}
    <div class="ac-diag">
      <div class="side-title">Board check \u00b7 wired ${wired} / ${chk.total}</div>
      ${chk.items.map(i=>`<div class="ac-alert ${i.level}">${esc(i.msg)}</div>`).join('')||'<div class="empty-hint">Start connecting \u2014 click a screw, then its partner.</div>'}
    </div>
    ${L.preset==='kiosk'?`<div class="ac-diag">
      <div class="side-title">Scenario \u2014 water ingress (your photo\u2019s fault)</div>
      <div class="ac-read"><span>Insulation L\u2013E</span><b style="color:${D.fault==='water'?'#e0473c':'#5fd394'}">${insul}</b></div>
      ${D.fault==='water'
        ?`<button class="mini-btn primary" data-dinseal style="width:100%;margin-top:6px">\u{1F527} Seal duct &amp; dry out</button>`
        :`<button class="mini-btn" data-dinfault style="width:100%;margin-top:6px">\u{1F4A7} Insert water-ingress fault</button>`}
      <div class="empty-hint" style="margin-top:6px">Unsealed underground ducts carry water in \u2014 damp cable reads low insulation and the RCD trips randomly.</div>
    </div>`:''}
    <div class="ac-diag">
      <div class="side-title">What\u2019s on this board</div>
      ${(L.preset==='cu'
        ?[['Main switch','isolates the whole board'],['RCBO','breaker + 30mA earth-leakage in one module, one per circuit'],['Earth bar','numbered brass bar \u2014 every circuit\u2019s earth, identifiable'],['Busbar comb','feeds live to every breaker \u2014 cover unused teeth']]
        :[['RCD 30mA','earth-leakage protection for everything after it'],['MCBs','one per circuit (pump, controls)'],['24V DC PSU','powers the electronics \u2014 keep 230V and 24V apart'],['Controller','automation logic \u2014 runs on 24V DC'],['Duct & glands','seal them \u2014 water follows the cables in']]
      ).map(([k,v])=>`<div class="lab-step">\u2022 <b>${k}</b> \u2014 ${v}</div>`).join('')}
    </div>
  </div>`;

  wrap.innerHTML=`
    <div class="ac-toolbar" style="margin-bottom:12px">
      <div class="seg"><button data-panelmode="live">Live panel</button><button data-panelmode="build">\u{1F527} Build &amp; Test</button><button class="on">\u{1F50C} DIN board</button></div>
      <div class="seg"><button data-dinpreset="cu" class="${L.preset==='cu'?'on':''}">Consumer unit</button><button data-dinpreset="kiosk" class="${L.preset==='kiosk'?'on':''}">Automation kiosk</button></div>
      <button class="mini-btn" data-dinauto>Auto-build</button>
      <button class="mini-btn" data-dinclear>Clear wires</button>
      <button class="mini-btn" data-dinreset>\u21BB Reset</button>
    </div>
    <div class="learn-sub" style="margin-bottom:12px">Rebuild the two boards from your photos. Click a screw, then its partner \u2014 the colour is picked for you. The glowing screws show the next connection. On the kiosk, try the <b>water-ingress</b> scenario and fix it like the real callout.</div>
    <div class="ac-stage"><div class="ac-canvas">${g}</div>${side}</div>`;

  const onSel=(s,f)=>{ const e=wrap.querySelector(s); if(e) e.addEventListener('click',f); };
  wrap.querySelectorAll('[data-panelmode]').forEach(b=>b.addEventListener('click',()=>{ state.panelLab.view=b.dataset.panelmode; renderPanelsTab(); }));
  wrap.querySelectorAll('[data-dinpreset]').forEach(b=>b.addEventListener('click',()=>{ if(D.preset!==b.dataset.dinpreset){ D.preset=b.dataset.dinpreset; D.wires=[]; D.sel=null; D.powerOn=false; D.fault='none'; D.sealed=true; renderPanelsTab(); markDirty(); } }));
  onSel('[data-dinauto]',dinAutoWire);
  onSel('[data-dinclear]',()=>{ D.wires=[]; D.sel=null; renderPanelsTab(); markDirty(); });
  onSel('[data-dinreset]',resetDIN);
  onSel('[data-dinenergize]',()=>{ D.powerOn=!D.powerOn; renderPanelsTab(); markDirty(); });
  onSel('[data-dindostep]',dinDoStep);
  onSel('[data-dinfault]',()=>{ D.fault='water'; D.sealed=false; renderPanelsTab(); markDirty(); });
  onSel('[data-dinseal]',()=>{ D.fault='none'; D.sealed=true; renderPanelsTab(); markDirty(); showToast('Duct sealed & dried \u2014 insulation restored'); });
  const svgEl=document.getElementById('dinSvg');
  svgEl.addEventListener('click',e=>{
    const term=e.target.closest('[data-dinterm]');
    if(term){ dinClickTerminal(term.dataset.dinterm); return; }
    const wire=e.target.closest('[data-dinwire]');
    if(wire){ D.wires=D.wires.filter(w=>w.id!==wire.dataset.dinwire); D.sel=null; renderPanelsTab(); markDirty(); return; }
    if(D.sel){ D.sel=null; renderPanelsTab(); }
  });
}

function renderPanelsTab(){
  invalidateLive();
  const wrap=document.getElementById('panelsWrap');
  if(state.panelLab && state.panelLab.view==='build'){ renderPanelLab(wrap); return; }
  if(state.panelLab && state.panelLab.view==='din'){ renderDINLab(wrap); return; }
  const panels=getPanels();
  panels.forEach(p=>repackOverlapOnly(p.id));
  let html='';
  html+=`<div class="ac-toolbar" style="margin-bottom:12px"><div class="seg"><button class="on">Live panel</button><button data-panelmode="build">\u{1F527} Build &amp; Test</button><button data-panelmode="din">\u{1F50C} DIN board</button></div><span style="font-size:11.5px;color:var(--text-dim)">Practise installing a breaker end-to-end \u2014 isolate, land the wires, energise, test.</span><span class="tb-sep"></span><button class="mini-btn" data-panelreset>\u21BB Reset panels</button></div>`;
  html+=`<div class="panel-legend">
    <div class="side-title" style="margin:0 0 6px">How to read this panel</div>
    <div class="pl-grid">
      <div><span class="pl-sw" style="background:#63b3ed"></span><span class="pl-sw" style="background:#f0a830"></span> Bus bars \u2014 the two hot legs <b>L1 / L2</b></div>
      <div><span class="pl-sw" style="background:#23272e;outline:1px solid #555"></span><span class="pl-sw" style="background:#e0473c"></span> Hot (live) load wires</div>
      <div><span class="pl-sw" style="background:#e9edf2"></span> Neutral \u00b7 <span class="pl-sw" style="background:#3fae5a"></span> Ground (to the N/G bar)</div>
      <div><span class="pl-sw" style="background:#5fd394"></span>GFCI \u00b7 <span class="pl-sw" style="background:#9f7aea"></span>AFCI \u00b7 <span class="pl-sw" style="background:#4fd1c5"></span>Dual (breaker stripe)</div>
      <div>Handle <b>up = ON</b>, down = OFF \u2014 click a handle to switch it.</div>
      <div>A dashed <b>+</b> slot is empty \u2014 click it to add a breaker.</div>
    </div>
  </div>`;
  html+=`<div class="panels-main"><div class="panels-col">`;
  panels.forEach(panel=>{ html+=panelSVG(panel); });
  html+=`</div>`;

  // ---- side: summary + breaker inspector ----
  const main=getMainPanel();
  const pl=main?panelLoad(main.id):{amps:0,mainAmp:200,pct:0,color:'var(--green)',status:'OK',connectedVA:0,adjVA:0};
  const ph=main?panelPhaseLoads(main.id):{A:0,B:0};
  const tot=ph.A+ph.B||1;
  const imbal=Math.abs(ph.A-ph.B)/Math.max(ph.A,ph.B,1)*100;
  const neutrals=state.circuits.filter(c=>c.poles===1).length;
  const grounds=state.circuits.length;
  html+=`<div class="panel-side">
    <div class="side-section">
      <div class="side-title">Service Load</div>
      <div class="summary-row"><span>Drawing now</span><b style="color:var(--green)">${fmt(pl.liveAmps||0)} A</b></div>
      <div class="summary-row"><span>Connected</span><b>${fmt0(pl.connectedVA)} W</b></div>
      <div class="summary-row"><span>Demand</span><b>${fmt0(pl.adjVA)} W</b></div>
      <div class="summary-row"><span>Sized draw</span><b>${fmt(pl.amps)} / ${pl.mainAmp} A</b></div>
      <div class="meter"><div style="width:${pl.pct}%;background:${pl.color}"></div></div>
      <div class="cc-meta"><span>240V service</span>${statusPill(pl.status)}</div>
    </div>
    <div class="side-section">
      <div class="side-title">Phase Balance</div>
      <div class="balance"><div class="a" style="width:${(ph.A/tot)*100}%"></div><div class="b" style="width:${(ph.B/tot)*100}%"></div></div>
      <div class="bal-legend"><span style="color:#63b3ed">L1 (A) ${fmt(ph.A)}A</span><span style="color:#f0a830">L2 (B) ${fmt(ph.B)}A</span></div>
      <div class="summary-row" style="margin-top:6px"><span>Imbalance</span><b style="color:${imbal>40?'var(--red)':imbal>20?'var(--amber)':'var(--green)'}">${fmt0(imbal)}%</b></div>
      <div class="empty-hint">Spread big 120V loads across L1/L2 to keep the legs even.</div>
    </div>
    <div class="neutral-bus">
      <div class="nb">Neutral bar<b>${neutrals}</b>landed</div>
      <div class="nb">Ground bar<b>${grounds}</b>landed</div>
    </div>`;

  // wiring / cable schedule
  const allC=getPanels().flatMap(p=>panelCircuits(p.id));
  if(allC.length){
    html+=`<div class="side-section" style="margin-top:14px">
      <div class="side-title">Wiring needed</div>
      <div class="wire-sched">${allC.map(c=>{
        const sp=cableSpec(c); const dest=circuitDestination(c);
        return `<div class="ws-row" data-wsbrk="${c.id}">
          <span class="ws-dot" style="background:${c.color}"></span>
          <div class="ws-main"><div class="ws-name">${esc(c.name)} <span class="muted">\u2192 ${esc(dest)}</span></div>
          <div class="ws-sub">${esc(sp.label)} \u00b7 ${fmt0(sp.lenFt)} ft \u00b7 ${c.amp}A breaker</div></div>
        </div>`;
      }).join('')}</div>
      <div class="empty-hint">Estimated from your wire runs (or panel-to-device distance). Verify with an electrician.</div>
    </div>`;
  }


  const sel=ui.selectedBreaker?getCircuit(ui.selectedBreaker):null;
  if(sel){
    const ld=circuitLoad(sel);
    const phs=circuitPositions(sel).map(slotPhase).join('+');
    html+=`<div class="side-section" style="margin-top:18px">
      <div class="side-title">Breaker <button class="mini-btn" id="brkClose">Done</button></div>
      <div class="ins-readout">
        <div class="ro-big" style="color:${ld.color}">${fmt(ld.adjAmps)} A</div>
        <div class="ro-line"><span>of ${sel.amp}A breaker</span>${statusPill(ld.status)}</div>
        <div class="meter"><div style="width:${ld.pct}%;background:${ld.color}"></div></div>
        <div class="ro-line"><span>Slots</span><b>${circuitPositions(sel).join(' / ')} \u00b7 phase ${phs}</b></div>
        <div class="ro-line"><span>Wire</span><b>${gaugeFor(sel.amp)}</b></div>
      </div>
      <div class="ins-field"><label>Name</label><input id="brkName" type="text" value="${esc(sel.name)}"></div>
      <div class="ins-row">
        <div class="ins-field"><label>Size</label><select id="brkAmp">${BREAKER_AMPS.map(a=>`<option value="${a}" ${a===sel.amp?'selected':''}>${a}A</option>`).join('')}</select></div>
        <div class="ins-field"><label>Color</label><select id="brkColor">${PALETTE.map(c=>`<option value="${c}" ${c===sel.color?'selected':''} style="background:${c}">\u25CF</option>`).join('')}</select></div>
      </div>
      <div class="ins-field"><label>Poles</label><div class="seg" id="brkPoles"><button data-p="1" class="${sel.poles===1?'on':''}">1-pole 120V</button><button data-p="2" class="${sel.poles===2?'on':''}">2-pole 240V</button></div></div>
      <div class="ins-field"><label>Type</label><div class="seg" id="brkType">
        ${['std','gfci','afci','dual'].map(t=>`<button data-bt="${t}" class="${(sel.breakerType||'std')===t?'on':''}">${t==='std'?'Std':t.toUpperCase()}</button>`).join('')}
      </div></div>
      <div class="ghost-row">
        <button class="mini-btn" id="brkToggle">${circuitPowered(sel)?'Switch OFF':'Switch ON'}</button>
      </div>
      <button class="danger-btn" id="brkDelete">Remove breaker</button>
    </div>`;
  } else {
    html+=`<div class="side-section" style="margin-top:18px">
      <div class="side-title">Add a breaker</div>
      <div class="empty-hint">Click any empty slot to install a breaker, or:</div>
      <div class="install-row">
        <button class="mini-btn" id="add1p">+ 1-pole 120V</button>
        <button class="mini-btn" id="add2p">+ 2-pole 240V</button>
      </div>
      <div class="empty-hint" style="margin-top:10px">Drag a breaker to an empty slot to move it. Click a breaker to rename it, change its size, poles, or type. Flip the handle to turn it on/off. A 2-pole breaker bridges both bus legs (A+B) for 240V.</div>
    </div></div>`;
  }
  if(sel) html+=`</div>`;
  html+=`</div>`; // close .panels-main

  wrap.innerHTML=html;

  // panel chassis interactions (toggle, select, drag-move, install, edit, focus) are
  // handled by delegation in initPanelInteractions(); only inspector fields bind here.

  // breaker inspector events
  const bn=document.getElementById('brkName'); if(bn) bn.addEventListener('input',()=>{ sel.name=bn.value; markDirty(); renderSidebar(); });
  const ba=document.getElementById('brkAmp'); if(ba) ba.addEventListener('change',()=>{ pushUndo(); sel.amp=parseInt(ba.value); renderPanelsTab(); renderSidebar(); markDirty(); });
  const bc=document.getElementById('brkColor'); if(bc) bc.addEventListener('change',()=>{ pushUndo(); sel.color=bc.value; renderPanelsTab(); renderAll(); markDirty(); });
  const bps=document.getElementById('brkPoles'); if(bps) bps.querySelectorAll('[data-p]').forEach(b=>b.addEventListener('click',()=>setBreakerPoles(sel.id,parseInt(b.dataset.p))));
  const bt=document.getElementById('brkType'); if(bt) bt.querySelectorAll('[data-bt]').forEach(b=>b.addEventListener('click',()=>{ pushUndo(); sel.breakerType=b.dataset.bt; renderPanelsTab(); renderSidebar(); markDirty(); }));
  const btog=document.getElementById('brkToggle'); if(btog) btog.addEventListener('click',()=>toggleBreaker(sel.id));
  const bdel=document.getElementById('brkDelete'); if(bdel) bdel.addEventListener('click',()=>removeBreaker(sel.id));
  const bclose=document.getElementById('brkClose'); if(bclose) bclose.addEventListener('click',()=>{ ui.selectedBreaker=null; renderPanelsTab(); });
  const a1=document.getElementById('add1p'); if(a1) a1.addEventListener('click',()=>quickAddBreaker((getMainPanel()||panels[0]).id,1));
  const a2=document.getElementById('add2p'); if(a2) a2.addEventListener('click',()=>quickAddBreaker((getMainPanel()||panels[0]).id,2));
  wrap.querySelectorAll('[data-panelmode]').forEach(b=>b.addEventListener('click',()=>{ state.panelLab.view=b.dataset.panelmode; renderPanelsTab(); }));
  const prb=wrap.querySelector('[data-panelreset]'); if(prb) prb.addEventListener('click',resetPanels);
}
/* only re-pack a panel if two breakers actually overlap (preserves manual layout) */
function repackOverlapOnly(panelId){
  const occ={}; let overlap=false;
  panelCircuits(panelId).forEach(c=>{ circuitPositions(c).forEach(p=>{ if(occ[p]){ overlap=true; } occ[p]=c.id; }); });
  const panel=findComp(panelId);
  const overflow=panelCircuits(panelId).some(c=>circuitPositions(c).some(p=>!p||p>(panel?panel.spaces:30)));
  if(overlap||overflow) repackPanel(panelId);
}

/* delegated interactions for the SVG panel simulator (bound once) */
let panelDrag=null;
function initPanelInteractions(){
  const wrap=document.getElementById('panelsWrap');
  wrap.addEventListener('mousedown',e=>{
    const tog=e.target.closest('[data-toggle]');
    if(tog){ e.preventDefault(); toggleBreaker(parseInt(tog.dataset.toggle)); return; }
    const mn=e.target.closest('[data-main]');
    if(mn){ e.preventDefault(); toggleMain(parseInt(mn.dataset.main)); return; }
    const brk=e.target.closest('[data-breaker]');
    if(brk){ e.preventDefault(); panelDrag={ id:parseInt(brk.dataset.breaker), x:e.clientX, y:e.clientY, moved:false }; }
  });
  wrap.addEventListener('click',e=>{
    if(e.target.closest('[data-toggle]')||e.target.closest('[data-breaker]')||e.target.closest('[data-main]')) return;
    const inst=e.target.closest('[data-install]'); if(inst){ const [pid,pos]=inst.dataset.install.split(':').map(Number); installBreaker(pid,pos,1); return; }
    const ed=e.target.closest('[data-editpanel]'); if(ed){ openPanelDesigner(parseInt(ed.dataset.editpanel)); return; }
    const fp=e.target.closest('[data-focuspanel]'); if(fp){ focusPanelInFloorplan(parseInt(fp.dataset.focuspanel)); return; }
    const ws=e.target.closest('[data-wsbrk]'); if(ws){ selectBreaker(parseInt(ws.dataset.wsbrk)); return; }
  });
  window.addEventListener('mousemove',e=>{ if(panelDrag && (Math.abs(e.clientX-panelDrag.x)+Math.abs(e.clientY-panelDrag.y))>4) panelDrag.moved=true; });
  window.addEventListener('mouseup',e=>{
    if(!panelDrag) return;
    const d=panelDrag; panelDrag=null;
    if(!d.moved){ selectBreaker(d.id); return; }
    const el=document.elementFromPoint(e.clientX,e.clientY);
    const slot=el&&el.closest?el.closest('[data-slot]'):null;
    if(slot){
      const [pid,pos]=slot.dataset.slot.split(':').map(Number);
      const c=getCircuit(d.id);
      if(c&&c.panelId===pid) moveBreaker(d.id,pos); else { showToast('Move breakers within their own panel.'); selectBreaker(d.id); }
    } else selectBreaker(d.id);
  });
}

/* ============================================================
   LEARN / BUILD  — a guided, game-like trainer
   Each lesson watches your real model and checks your work live.
   ============================================================ */
const LIGHT_TYPES=new Set(['light','recessed','pendant','chandelier','fan','fanlight','ledstrip','outdoorlight','flood']);
function L_comps(pred){ return state.components.filter(c=>!isPanelType(c.type)).filter(pred); }
function L_anyLiveLight(){ return state.components.some(c=>LIGHT_TYPES.has(c.type) && isLive(c)); }
/* does flipping this switch actually turn the target on/off? (non-destructive) */
function switchControls(switchId,targetId){
  const sw=findComp(switchId); if(!sw||!isSwitchType(sw.type)) return false;
  const prev=sw.on, savedLIVE=LIVE;
  sw.on=true;  LIVE=null; const onLive=ensureLive().has(targetId);
  sw.on=false; LIVE=null; const offLive=ensureLive().has(targetId);
  sw.on=prev;  LIVE=savedLIVE; invalidateLive();
  return onLive && !offLive;
}
function anySwitchControlsALight(){
  const sws=state.components.filter(c=>isSwitchType(c.type));
  const lights=state.components.filter(c=>LIGHT_TYPES.has(c.type));
  return sws.some(s=>lights.some(l=>switchControls(s.id,l.id)));
}

const LEVELS=[
  { id:'safety', title:'How electricity reaches a device', icon:'\u26A1', mins:2,
    blurb:'The big picture before you build anything.',
    concept:[
      'Power comes from the utility into your <b>main panel</b>. The panel splits it into <b>circuits</b>, each protected by a <b>breaker</b>.',
      'From a breaker, three wires do the work: the <b>hot</b> (black/red) carries power out, the <b>neutral</b> (white) carries it back, and the <b>ground</b> (green/bare) is a safety path.',
      'A device only runs when there is a complete, switched-on path from the panel to it. This trainer simulates that path so you can see it work.',
      '<b>Real-world safety:</b> real wiring is done with the power OFF and verified dead with a tester. Mains and panel work can injure or kill and is regulated \u2014 this app is for learning and planning, not a substitute for hands-on qualified training.'
    ],
    steps:[
      { label:'Open the Panels tab and look at the MAIN, the bus bars (L1/L2) and the N/G bars', test:()=>true },
      { label:'Make sure the main breaker is ON', test:()=>panelPowered(getMainPanel()) }
    ],
    tip:'In Panels, the big breaker at top is the MAIN. Click its handle to flip it.' },

  { id:'firstlight', title:'Level 1 \u2014 Power your first light', icon:'\u{1F4A1}', mins:3,
    blurb:'Place a light, put it on a circuit, energize it.',
    concept:[
      'Every load needs a circuit (a breaker) feeding it. Assign the light to a circuit, turn that breaker on, and power flows.',
      'Watch the light: when it is energized it glows and shows \u201cA now\u201d \u2014 the real current it draws.'
    ],
    steps:[
      { label:'Place a Light fixture on the floor plan', test:()=>L_comps(c=>LIGHT_TYPES.has(c.type)).length>0 },
      { label:'Assign it to a circuit (Inspector \u2192 Circuit)', test:()=>L_comps(c=>LIGHT_TYPES.has(c.type)).some(c=>c.circuitId) },
      { label:'Turn that circuit\u2019s breaker ON', test:()=>L_comps(c=>LIGHT_TYPES.has(c.type)).some(c=>c.circuitId&&circuitPowered(getCircuit(c.circuitId))) },
      { label:'The light is now LIVE (it glows)', test:()=>L_anyLiveLight() }
    ],
    tip:'From the Parts library (left) open Lighting and click a Light, then click the grid. Select it and pick a Circuit in the inspector.' },

  { id:'switch', title:'Level 2 \u2014 Control it with a switch', icon:'\u{1F39B}', mins:4,
    blurb:'Wire panel \u2192 switch \u2192 light so the switch really works.',
    concept:[
      'A single-pole switch breaks the <b>hot</b> on its way to the light. Power must pass <b>through</b> the switch to reach the light.',
      'Use the Wire tool: connect the panel (or the circuit\u2019s first device) to the switch, then the switch to the light. Now flipping the switch turns the light on and off.',
      'The switch leg uses black (incoming hot) and red (switched hot) plus ground \u2014 you can see those colors on the cable.'
    ],
    steps:[
      { label:'Place a Switch', test:()=>state.components.some(c=>isSwitchType(c.type)) },
      { label:'Place a Light (if you haven\u2019t)', test:()=>L_comps(c=>LIGHT_TYPES.has(c.type)).length>0 },
      { label:'Wire panel \u2192 switch \u2192 light so the switch is in the path', test:()=>anySwitchControlsALight() },
      { label:'Flip the switch and watch the light react', test:()=>anySwitchControlsALight() }
    ],
    tip:'Pick the Wire tool. Click the panel, then the switch (connect). Then click the switch, then the light. Flip the switch by clicking its handle.' },

  { id:'recep', title:'Level 3 \u2014 A receptacle circuit', icon:'\u{1F50C}', mins:4,
    blurb:'Outlets share one 15/20A circuit on the right wire.',
    concept:[
      'Receptacles connect in parallel on a 120V circuit. A 15A circuit uses 14-gauge wire; a 20A circuit uses 12-gauge.',
      'Don\u2019t mix a 20A breaker with 14-gauge wire \u2014 the wire would overheat before the breaker trips.'
    ],
    steps:[
      { label:'Place at least 3 outlets', test:()=>L_comps(c=>c.type==='outlet'||c.type==='outlet20'||c.type==='gfci').length>=3 },
      { label:'Put them on a 120V circuit (1-pole)', test:()=>L_comps(c=>(c.type==='outlet'||c.type==='outlet20'||c.type==='gfci')&&c.circuitId).some(c=>{const cc=getCircuit(c.circuitId);return cc&&cc.poles===1;}) },
      { label:'Breaker size matches the wire (\u226420A)', test:()=>L_comps(c=>(c.type==='outlet'||c.type==='outlet20'||c.type==='gfci')&&c.circuitId).some(c=>{const cc=getCircuit(c.circuitId);return cc&&cc.poles===1&&cc.amp<=20;}) }
    ],
    tip:'Place outlets, select each and set the same Circuit. In the Circuits list set that breaker to 15A or 20A.' },

  { id:'gfci', title:'Level 4 \u2014 GFCI where it\u2019s wet', icon:'\u{1F6BF}', mins:3,
    blurb:'Kitchens, baths, outdoors and garages need GFCI.',
    concept:[
      'A <b>GFCI</b> shuts off in milliseconds if current leaks (e.g., through a person). Code requires it near water and outdoors.',
      'Mark a receptacle as GFCI in its inspector. <b>AFCI</b> protects against arcing faults in living areas.'
    ],
    steps:[
      { label:'Place a receptacle and set its Room to a wet area (Bath/Kitchen/Outdoor)', test:()=>L_comps(c=>(c.type==='outlet'||c.type==='gfci'||c.type==='outlet20')&&/bath|kitchen|out|garage|laundry/i.test(c.room||'')).length>0 },
      { label:'Tick \u201cGFCI protected\u201d on that outlet', test:()=>L_comps(c=>(c.type==='outlet'||c.type==='gfci'||c.type==='outlet20')&&c.gfci).length>0 }
    ],
    tip:'Select an outlet, set Room to \u201cBathroom\u201d, then check GFCI protected in the inspector. Or use a dedicated GFCI part / GFCI breaker.' },

  { id:'two40', title:'Level 5 \u2014 A 240-volt circuit', icon:'\u{1F525}', mins:5,
    blurb:'Big appliances use both legs of the panel.',
    concept:[
      'Combining L1 and L2 gives 240V. A <b>2-pole breaker</b> bridges both legs and feeds two hots (black + red).',
      'A dryer/range that also needs 120V controls uses a neutral too (that\u2019s the 10-3 / 6-3 cable). A pure 240V load (AC, water heater) needs only the two hots + ground.'
    ],
    steps:[
      { label:'Place a 240V appliance (Range, Dryer, AC\u2026)', test:()=>L_comps(c=>['range','cooktop','walloven','dryer','ac','minisplit','condenser','heatpump','evcharger','ev32','ev48','wh_elec','hottub'].includes(c.type)).length>0 },
      { label:'Put it on a 2-pole 240V circuit', test:()=>L_comps(c=>c.circuitId).some(c=>['range','cooktop','walloven','dryer','ac','minisplit','condenser','heatpump','ev32','ev48','hottub'].includes(c.type)&&getCircuit(c.circuitId)&&getCircuit(c.circuitId).poles===2) },
      { label:'Energize it (breaker on \u2192 it draws current)', test:()=>L_comps(c=>['range','cooktop','walloven','dryer','ac','minisplit','condenser','heatpump','ev32','ev48','hottub'].includes(c.type)).some(c=>isLive(c)) }
    ],
    tip:'In the Circuits list switch a circuit to 240V (2-pole), then assign the appliance to it.' },

  { id:'noverload', title:'Level 6 \u2014 Don\u2019t overload a circuit', icon:'\u{1F4CF}', mins:5,
    blurb:'Keep the load under the breaker rating.',
    concept:[
      'A breaker protects the wire. Continuous loads are counted at 125%. Keep a branch circuit loaded to about 80% or less.',
      'If a circuit reads OVER (red), move loads to another circuit or use a bigger wire+breaker.'
    ],
    steps:[
      { label:'Build a circuit that is meaningfully loaded (over 40% of the breaker)', test:()=>state.circuits.some(c=>{const l=circuitLoad(c);return l.pct>=40;}) },
      { label:'Make sure NO circuit is OVER (none red)', test:()=>state.circuits.length>0 && !state.circuits.some(c=>circuitLoad(c).status==='OVER') }
    ],
    tip:'Add loads until a circuit fills up, then keep it under 100% by spreading devices or raising the breaker+wire size.' },

  { id:'subpanel', title:'Level 7 \u2014 Add a sub-panel', icon:'\u{1F5C4}', mins:6,
    blurb:'Feed a second panel for a garage or addition.',
    concept:[
      'A sub-panel is fed by a 2-pole <b>feeder</b> breaker in the main. It then hosts its own branch circuits.',
      'In a sub-panel, neutrals and grounds are kept separate (unlike the main). The feeder cable carries 2 hots + neutral + ground.'
    ],
    steps:[
      { label:'Place a Sub-Panel', test:()=>state.components.some(c=>c.type==='subpanel') },
      { label:'Feed it from a 2-pole breaker on the main (Inspector \u2192 Fed by)', test:()=>state.components.some(c=>c.type==='subpanel'&&c.fedByCircuitId) },
      { label:'Add a circuit on the sub-panel and power a device on it', test:()=>state.components.some(sp=>sp.type==='subpanel'&&panelPowered(sp)&&panelCircuits(sp.id).length>0&&circuitDevices(panelCircuits(sp.id)[0]?.id||-1).length>0) }
    ],
    tip:'Place a Sub-Panel, select it, choose a 2-pole feeder under \u201cFed by\u201d, then add circuits and devices to it.' },

  { id:'acwire', title:'Level 8 \u2014 Wire a split A/C', icon:'\u2744\uFE0F', mins:6,
    blurb:'Land L, N, PE and S1/S2/S3 on a split system \u2014 no shorts.',
    concept:[
      'Open the \u26A1 A/C Wiring tab. The supply (L, N, PE) feeds the <b>outdoor</b> unit; <b>S1/S2/S3</b> interconnect outdoor \u2194 indoor (S1/S2 often carry power, S3 is signal).',
      'Never land a phase on Neutral or on an S terminal, and always connect the earth. One wrong cable can short the supply or destroy the indoor board \u2014 the live alerts show exactly what would happen.'
    ],
    steps:[
      { label:'Open the \u26A1 A/C Wiring tab', test:()=>ui.tab==='acwiring' || (state.acBench&&state.acBench.wires.length>0) },
      { label:'Attempt the full connection (6+ conductors)', test:()=>state.acBench&&state.acBench.wires.length>=6 },
      { label:'Clear every DANGER alert (no shorts, earth present)', test:()=>state.acBench&&state.acBench.wires.length>0&&!checkACWiring().items.some(i=>i.level==='danger') },
      { label:'Board is fully correct \u2014 Energize passes', test:()=>state.acBench&&checkACWiring().allCorrect }
    ],
    tip:'In A/C Wiring: try Auto-wire to see it done, then Clear and wire it yourself. Use Insert fault to practice finding a bad cable.' },

  { id:'panelbuild', title:'Install a breaker \u2014 Build & Test', icon:'\u{1F527}', mins:5,
    blurb:'Rack a breaker, land hot/neutral/ground, energize and test.',
    concept:[
      'Real installs follow a safe order: <b>isolate</b> the main, <b>rack</b> the breaker onto the bus, <b>land</b> the three conductors \u2014 hot on the breaker, neutral on the neutral bar, ground on the ground bar \u2014 then <b>re-energize</b> and <b>test</b>.',
      'Open <b>Panels \u2192 Build &amp; Test</b>. Landing wires with the main on is flagged as live work. A correct circuit reads about <b>120&nbsp;V</b> hot\u2013neutral and hot\u2013ground, and <b>0&nbsp;V</b> neutral\u2013ground on the tester.'
    ],
    steps:[
      { label:'Open Panels \u2192 Build & Test', test:()=>state.panelLab&&(state.panelLab.view==='build'||state.panelLab.wires.length>0) },
      { label:'Rack a breaker onto the bus', test:()=>state.panelLab&&state.panelLab.brk },
      { label:'Land hot, neutral and ground correctly', test:()=>{ try{return state.panelLab&&panelLabCheck().allCorrect;}catch(e){return false;} } },
      { label:'Switch the main on and confirm it\u2019s live', test:()=>{ try{return state.panelLab&&panelLabCheck().energized;}catch(e){return false;} } }
    ],
    tip:'Panels \u2192 Build & Test. Install the breaker, click each cable end then where it lands, switch the main on, and probe hot\u2013neutral for 120 V.' },

  { id:'acdiag', title:'Diagnose a compressor', icon:'\u{1F50D}', mins:5,
    blurb:'Use the multimeter to find a compressor or capacitor fault.',
    concept:[
      'Technicians test a compressor with a meter: <b>winding resistance</b> (C\u2013R run, C\u2013S start), an <b>insulation</b> test from a winding to the CASE (a grounded winding reads near zero), and a <b>\u00B5F</b> check on the run capacitor.',
      'In the \u26A1 A/C Trainer, set a fault, press <b>Energize</b> to see what happens \u2014 a grounded winding trips the RCCB, a seized rotor trips on overload, a bad capacitor won\u2019t start \u2014 then confirm it with the meter.'
    ],
    steps:[
      { label:'Open the A/C Trainer tab', test:()=>ui.tab==='acwiring' },
      { label:'Set a compressor or capacitor fault', test:()=>state.acBench&&((state.acBench.comp&&state.acBench.comp!=='none')||(state.acBench.cap&&state.acBench.cap!=='ok')) },
      { label:'Take a reading with the multimeter', test:()=>state.acBench&&state.acBench.meter&&state.acBench.meter.a&&state.acBench.meter.b }
    ],
    tip:'A/C Trainer: pick a fault from the dropdowns, click \u201cUse probes\u201d, then click two terminals. Try an insulation (M\u03A9) test from a winding to CASE.' }
];
function L_levelDone(lv){ return lv.steps.every(s=>{ try{return !!s.test();}catch(e){return false;} }); }
function L_levelProgress(lv){ let n=0; lv.steps.forEach(s=>{ try{ if(s.test()) n++; }catch(e){} }); return n; }

/* live validation of the current floor-plan / panel design (drives the Learn "Design check") */
function designIssues(){
  const out=[];
  const main=getMainPanel();
  if(main && !panelPowered(main)) out.push({level:'warn',msg:'The main breaker is off, so nothing downstream can run.',fix:'panels'});
  const needsCkt=c=>!isPanelType(c.type)&&!isSwitchType(c.type)&&((c.watts||0)>0||LIGHT_TYPES.has(c.type)||/outlet|gfci|recep/.test(c.type));
  const unassigned=state.components.filter(c=>needsCkt(c)&&!c.circuitId);
  if(unassigned.length) out.push({level:'warn',msg:`${unassigned.length} device${unassigned.length>1?'s aren\u2019t':' isn\u2019t'} on a circuit yet.`,fix:'floorplan'});
  const over=state.circuits.filter(c=>circuitLoad(c).status==='OVER');
  if(over.length) out.push({level:'danger',msg:`${over.length} circuit${over.length>1?'s are':' is'} overloaded past the breaker rating.`,fix:'panels'});
  const near=state.circuits.filter(c=>circuitLoad(c).status==='NEAR');
  if(near.length) out.push({level:'info',msg:`${near.length} circuit${near.length>1?'s are':' is'} above 80% \u2014 leave some headroom.`,fix:'panels'});
  const wet=L_comps(c=>/outlet|gfci|recep/.test(c.type)&&/bath|kitchen|out|garage|laundry/i.test(c.room||'')&&!c.gfci);
  if(wet.length) out.push({level:'warn',msg:`${wet.length} outlet${wet.length>1?'s in wet areas need':' in a wet area needs'} GFCI protection.`,fix:'floorplan'});
  return out;
}
/* lessons grouped into learning tracks */
const LESSON_TRACKS=[
  ['Basics','How power flows, start to finish',['safety','firstlight','switch']],
  ['Branch circuits','Size and protect circuits correctly',['recep','gfci','two40','noverload']],
  ['Panels','Feeders, sub-panels and real installs',['subpanel','panelbuild']],
  ['Air-conditioning','Wire and fault-find a split system',['acwire','acdiag']]
];

function startLesson(id){
  state.training.current=id; state.training.coachOpen=true;
  if(ui.tab==='learn') setTab('floorplan'); else updateCoach();
  showToast('Lesson started \u2014 your coach is on the floor plan.');
  markDirty();
}
function exitLesson(){ state.training.coachOpen=false; updateCoach(); markDirty(); }
function completeLesson(id){
  if(!state.training.completed.includes(id)){ state.training.completed.push(id); showToast('\u2705 Lesson complete!'); }
  markDirty();
}

function renderLearnTab(){
  const wrap=document.getElementById('learnWrap');
  const done=state.training.completed||[];
  const byId=id=>LEVELS.find(l=>l.id===id);
  const total=LEVELS.length, dn=LEVELS.filter(l=>done.includes(l.id)).length;
  const pct=Math.round(dn/total*100);
  const issues=designIssues();
  const order=LESSON_TRACKS.flatMap(t=>t[2]);
  const nextId=order.find(id=>!done.includes(id));
  const nx=nextId?byId(nextId):null;

  let html=`<div class="learn2">
    <div class="learn-head2">
      <div class="lh-left">
        <div class="learn-title">Learn to wire it</div>
        <div class="learn-sub">Short, hands-on lessons. Read the idea, then build it on the real tools \u2014 each lesson watches your work and checks it as you go.</div>
        ${dn>0?`<button class="mini-btn" data-resetlessons style="margin-top:10px">\u21BA Reset lesson progress</button>`:''}
      </div>
      <div class="lh-ring" style="--p:${pct}"><div class="ring-inner"><div class="ring-num">${dn}<span>/${total}</span></div><div class="ring-cap">lessons</div></div></div>
    </div>

    <div class="dcheck ${issues.length?'':'clear'}">
      <div class="dc-head">${issues.length?`Design check \u00b7 ${issues.length} thing${issues.length>1?'s':''} to review`:'Design check \u00b7 all clear'}</div>
      ${issues.length
        ? `<div class="dc-list">${issues.map(it=>`<div class="dc-row ${it.level}"><span class="dc-dot"></span><span class="dc-msg">${esc(it.msg)}</span>${it.fix?`<button class="dc-go" data-gotab="${it.fix}">Fix in ${it.fix==='panels'?'Panels':'Floor Plan'}</button>`:''}</div>`).join('')}</div>`
        : `<div class="dc-sub">No unassigned devices, no overloaded circuits, and wet-area outlets are GFCI-protected.</div>`}
    </div>`;

  if(nx){ html+=`<button class="learn-next" data-startlesson="${nx.id}"><span class="ln-ic">${nx.icon}</span><span class="ln-tx"><span class="ln-lab">Pick up where you left off</span><span class="ln-title">${esc(nx.title)}</span></span><span class="ln-go">Start &rarr;</span></button>`; }

  LESSON_TRACKS.forEach(([tname,tdesc,ids])=>{
    const lvs=ids.map(byId).filter(Boolean);
    const tdone=lvs.filter(l=>done.includes(l.id)).length;
    html+=`<div class="track">
      <div class="track-head"><div><div class="track-name">${esc(tname)}</div><div class="track-desc">${esc(tdesc)}</div></div><div class="track-count">${tdone}<span>/${lvs.length}</span></div></div>`;
    lvs.forEach(lv=>{
      const isDone=done.includes(lv.id), cur=state.training.current===lv.id, open=ui.learnOpen===lv.id;
      const prog=L_levelProgress(lv), p=Math.round(prog/lv.steps.length*100);
      html+=`<div class="lrow ${isDone?'done':''} ${cur?'cur':''} ${open?'open':''}">
        <button class="lrow-main" data-openlesson="${lv.id}">
          <span class="lrow-ic">${lv.icon}</span>
          <span class="lrow-tx"><span class="lrow-title">${esc(lv.title)}${isDone?' <span class="tick">\u2713</span>':cur?' <span class="cur-chip">in progress</span>':''}</span><span class="lrow-blurb">${esc(lv.blurb)}</span></span>
          <span class="lrow-meta"><span class="lrow-mini"><span style="width:${p}%"></span></span><span class="lrow-mins">${lv.steps.length} steps \u00b7 ${lv.mins}m</span></span>
          <span class="lrow-caret">${open?'\u2212':'+'}</span>
        </button>`;
      if(open){
        html+=`<div class="lrow-body">
          <div class="lrow-concept">${lv.concept.map(c=>`<p>${c}</p>`).join('')}</div>
          <div class="lrow-steps-t">What you\u2019ll do</div>
          <div class="lrow-steps">${lv.steps.map((s,i)=>{let ok=false;try{ok=!!s.test();}catch(e){} return `<div class="lrow-step ${ok?'ok':''}"><span class="ls-box">${ok?'\u2713':(i+1)}</span><span>${esc(s.label)}</span></div>`;}).join('')}</div>
          <div class="lrow-tip"><b>Tip.</b> ${esc(lv.tip)}</div>
          <button class="lc-start" data-startlesson="${lv.id}">${cur?'Resume with the coach':(isDone?'Practice again':'Start with the coach')}</button>
        </div>`;
      }
      html+=`</div>`;
    });
    html+=`</div>`;
  });

  html+=`<div class="learn-foot">A <b>simulator for learning and planning</b> \u2014 it shows how systems work and lets you practise safely on screen. Real installations must follow your local code, and live mains or panel work is hazardous; do it only when properly qualified.</div></div>`;
  wrap.innerHTML=html;
  wrap.querySelectorAll('[data-openlesson]').forEach(b=>b.addEventListener('click',()=>{ ui.learnOpen = ui.learnOpen===b.dataset.openlesson? null : b.dataset.openlesson; renderLearnTab(); }));
  wrap.querySelectorAll('[data-startlesson]').forEach(b=>b.addEventListener('click',e=>{ e.stopPropagation(); startLesson(b.dataset.startlesson); }));
  wrap.querySelectorAll('[data-gotab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.gotab)));
  const rl=wrap.querySelector('[data-resetlessons]'); if(rl) rl.addEventListener('click',()=>{ if(confirm('Reset all lesson progress? This clears your completed lessons and current lesson. Your project design is not affected.')){ state.training.completed=[]; state.training.current=null; state.training.coachOpen=false; ui.learnOpen=null; markDirty(); renderLearnTab(); updateCoach(); showToast('Lesson progress reset'); } });
}

let _coachCelebrated=null;
function updateCoach(){
  const dock=document.getElementById('coachDock');
  if(!dock) return;
  const id=state.training.current;
  const show = state.training.coachOpen && id && (ui.tab==='floorplan'||ui.tab==='panels'||ui.tab==='acwiring');
  if(!show){ dock.style.display='none'; return; }
  const lv=LEVELS.find(l=>l.id===id); if(!lv){ dock.style.display='none'; return; }
  const prog=L_levelProgress(lv), allDone=prog===lv.steps.length;
  if(allDone && !state.training.completed.includes(id)) completeLesson(id);
  const idx=LEVELS.indexOf(lv), next=LEVELS[idx+1];
  dock.style.display='block';
  dock.innerHTML=`
    <div class="coach-h">
      <span class="coach-ic">${lv.icon}</span>
      <div class="coach-t">${lv.title}</div>
      <button class="coach-x" id="coachExit" title="Hide coach">\u2715</button>
    </div>
    <div class="coach-steps">
      ${lv.steps.map(s=>{ let ok=false; try{ok=!!s.test();}catch(e){} return `<div class="coach-step ${ok?'ok':''}"><span class="cs-box">${ok?'\u2713':''}</span><span>${s.label}</span></div>`; }).join('')}
    </div>
    ${allDone?`<div class="coach-win">\u{1F389} Lesson complete!${next?'':' You\u2019ve finished the course.'}</div>`:''}
    <details class="coach-concept"><summary>How this works</summary><div>${lv.concept.map(p=>`<p>${p}</p>`).join('')}</div></details>
    <div class="coach-tip"><b>Tip:</b> ${esc(lv.tip)}</div>
    <div class="coach-actions">
      <button class="mini-btn" id="coachCurriculum">All lessons</button>
      ${allDone&&next?`<button class="mini-btn primary" id="coachNext">Next lesson \u2192</button>`:''}
    </div>`;
  const ex=document.getElementById('coachExit'); if(ex) ex.addEventListener('click',exitLesson);
  const cu=document.getElementById('coachCurriculum'); if(cu) cu.addEventListener('click',()=>setTab('learn'));
  const nx=document.getElementById('coachNext'); if(nx) nx.addEventListener('click',()=>{ startLesson(next.id); });
  // celebrate once per completion
  if(allDone && _coachCelebrated!==id){ _coachCelebrated=id; }
  if(!allDone && _coachCelebrated===id) _coachCelebrated=null;
}

/* ============================================================
   A/C WIRING TRAINER  — split-system + 3-phase terminal wiring
   Connect real terminal blocks (L N S1 S2 S3 PE), learn colour
   schemes, and get live neutral/phase + short-circuit alerts.
   ============================================================ */
const AC_STD = {
  iec:{ name:'IEC / EU', L:'#7a4a2b', L1:'#7a4a2b', L2:'#23272e', L3:'#8a8f98', N:'#2b6fe0', PE:'#3fae5a', S:'#e08a2b',
        Lname:'brown', L1name:'brown', L2name:'black', L3name:'grey', Nname:'blue', PEname:'green/yellow' },
  us:{  name:'US / NEC', L:'#23272e', L1:'#23272e', L2:'#e0473c', L3:'#2b6fe0', N:'#e9edf2', PE:'#3fae5a', S:'#e08a2b',
        Lname:'black', L1name:'black', L2name:'red', L3name:'blue', Nname:'white', PEname:'green' },
  poster:{ name:'A/C poster', L:'#e0473c', L1:'#e0473c', L2:'#e0473c', L3:'#e0473c', N:'#23272e', PE:'#3fae5a', S:'#f0c000',
        Lname:'red', L1name:'red', L2name:'red', L3name:'red', Nname:'black', PEname:'green' }
};
const AC_PALETTE=['#7a4a2b','#23272e','#8a8f98','#2b6fe0','#3fae5a','#e9edf2','#e0473c','#f0c000','#e08a2b'];
const AC_COLNAME={'#7a4a2b':'brown','#23272e':'black','#8a8f98':'grey','#2b6fe0':'blue','#3fae5a':'green/yellow','#e9edf2':'white','#e0473c':'red','#f0c000':'yellow','#e08a2b':'orange'};

/* geometry + terminals for the selected unit type */
function acLayout(){
  const mode = state.acBench.unit; // 'single' | 'three' | 'lns'
  const three = mode==='three';
  const lns = mode==='lns';
  const powered = three? ['L1','L2','L3','N','PE'] : ['L','N','PE'];
  const rowH=34, top=70;
  const bw = lns? 112 : 150;
  const T={}; const blocks=[];
  function addBlock(key,title,x,left,right){
    const rows=Math.max(left.length,right.length,1);
    const h=rows*rowH+34;
    blocks.push({key,title,x,y:top,w:bw,h});
    left.forEach((t,i)=>{ T[key+':'+t.n]={id:key+':'+t.n,x:x,y:top+30+i*rowH,label:t.n,role:t.role,block:key,side:'L'}; });
    right.forEach((t,i)=>{ T[key+':'+t.n]={id:key+':'+t.n,x:x+bw,y:top+30+i*rowH,label:t.n,role:t.role,block:key,side:'R'}; });
  }
  const roleOf=n=> n[0]==='N'?'neutral': (n==='E'||n==='PE')?'earth': n[0]==='S'?'signal':'phase';
  const P=n=>({n,role:roleOf(n)});

  if(lns){
    // Supply -> RCCB(30mA) -> Isolator(2P) -> Outdoor(L N S E) -> Indoor(L N S E)
    let x=24, gap=64;
    addBlock('supply','MAINS SUPPLY',x, [], [P('L'),P('N'),P('E')]); x+=bw+gap;
    addBlock('rccb','RCCB 30mA',x, [P('Lin'),P('Nin')], [P('Lout'),P('Nout')]); x+=bw+gap;
    addBlock('iso','ISOLATOR 2P',x, [P('Lin'),P('Nin')], [P('Lout'),P('Nout')]); x+=bw+gap+16;
    addBlock('outdoor','OUTDOOR UNIT',x, [P('L'),P('N'),P('S'),P('E')], []); x+=bw+gap+30;
    addBlock('indoor','INDOOR UNIT',x, [P('L'),P('N'),P('S'),P('E')], []);
    const W=x+bw+24;
    const ports=acAddPipePorts(T,blocks);
    acAddCompressor(T,blocks);
    return {T,blocks,ports,mode,three:false,lns:true,powered:['L','N','E'],W};
  }
  // classic: Supply -> Outdoor(S1/S2/S3) -> Indoor
  let supX=42, outX=360, indX=690;
  addBlock('supply','MAINS SUPPLY',supX, [], powered.map(P));
  addBlock('outdoor','OUTDOOR UNIT',outX, powered.map(P), [P('S1'),P('S2'),P('S3')]);
  addBlock('indoor','INDOOR UNIT',indX, [P('S1'),P('S2'),P('S3'),P('PE')], []);
  const ports=acAddPipePorts(T,blocks);
  acAddCompressor(T,blocks);
  return {T,blocks,ports,mode,three,lns:false,powered,W:880};
}
/* refrigerant + condensate ports (separate from the electrical terminals) */
function acAddPipePorts(T,blocks){
  const P={};
  const ob=blocks.find(b=>b.key==='outdoor'), ib=blocks.find(b=>b.key==='indoor'); if(!ob||!ib) return P;
  const baseY=Math.max(ob.y+ob.h, ib.y+ib.h)+30;
  blocks._pipeY=baseY;
  const oX=ob.x+ob.w*0.5;
  P['outdoor:LIQ']={id:'outdoor:LIQ',x:oX-16,y:baseY,label:'LIQUID',role:'liquid',unit:'outdoor'};
  P['outdoor:GAS']={id:'outdoor:GAS',x:oX+16,y:baseY,label:'GAS',role:'gas',unit:'outdoor'};
  P['outdoor:SVC']={id:'outdoor:SVC',x:oX+44,y:baseY,label:'SERVICE',role:'service',unit:'outdoor'};
  const iX=ib.x+ib.w*0.5;
  P['indoor:LIQ']={id:'indoor:LIQ',x:iX-16,y:baseY,label:'LIQUID',role:'liquid',unit:'indoor'};
  P['indoor:GAS']={id:'indoor:GAS',x:iX+16,y:baseY,label:'GAS',role:'gas',unit:'indoor'};
  P['indoor:DRN']={id:'indoor:DRN',x:ib.x+ib.w-14,y:baseY,label:'DRAIN',role:'drain',unit:'indoor'};
  P['drain:OUT']={id:'drain:OUT',x:ib.x+ib.w-14,y:baseY+46,label:'to outside',role:'drain',unit:'drain'};
  return P;
}
/* correct connections (ordered pairs, by terminal id) */
function acCorrect(){
  const mode=state.acBench.unit;
  const pairs=[];
  if(mode==='lns'){
    pairs.push(['supply:L','rccb:Lin'],['rccb:Lout','iso:Lin'],['iso:Lout','outdoor:L']);
    pairs.push(['supply:N','rccb:Nin'],['rccb:Nout','iso:Nin'],['iso:Nout','outdoor:N']);
    pairs.push(['supply:E','outdoor:E']);
    ['L','N','S','E'].forEach(n=> pairs.push(['outdoor:'+n,'indoor:'+n]));
    return pairs;
  }
  const power = mode==='three'?['L1','L2','L3','N','PE']:['L','N','PE'];
  power.forEach(n=> pairs.push(['supply:'+n,'outdoor:'+n]));
  ['S1','S2','S3'].forEach(n=> pairs.push(['outdoor:'+n,'indoor:'+n]));
  pairs.push(['outdoor:PE','indoor:PE']);
  return pairs;
}
function acTermRole(id){ const p=id.split(':'); const blk=p[0], n=p[1]||''; if(blk==='comp') return n==='CASE'?'earth':'comp'; if(n[0]==='N') return 'neutral'; if(n==='E'||n==='PE') return 'earth'; if(n[0]==='S') return 'signal'; if(n[0]==='L') return 'phase'; return 'phase'; }
function acTermName(id){ return id.split(':')[1]; }
function acIsProtection(id){ const b=id.split(':')[0]; return b==='rccb'||b==='iso'; }
/* add the compressor (diagnostic element inside the outdoor unit) to a layout */
function acAddCompressor(T,blocks){
  const ob=blocks.find(b=>b.key==='outdoor'); if(!ob) return;
  const cw=Math.max(ob.w+20,150), cx=ob.x-(cw-ob.w)/2, cy=(blocks._pipeY||ob.y+ob.h)+56, ch=100;
  blocks.push({key:'comp',title:'COMPRESSOR',x:cx,y:cy,w:cw,h:ch,compressor:true});
  ['C','R','S'].forEach((n,i)=>{ T['comp:'+n]={id:'comp:'+n,x:cx+26+i*((cw-52)/2),y:cy+40,label:n,role:'comp',block:'comp',side:'T'}; });
  T['comp:CASE']={id:'comp:CASE',x:cx+cw/2,y:cy+ch-14,label:'CASE \u23DA',role:'earth',block:'comp',side:'B'};
}

/* ---- validation: the heart of the trainer ---- */
function checkACWiring(){
  const b=state.acBench, std=AC_STD[b.standard];
  const items=[]; // {level:'ok'|'warn'|'danger', msg, wireIds:[]}
  const wires=b.wires;
  const adj={}; // terminal -> [{other,wire}]
  wires.forEach(w=>{ (adj[w.from]=adj[w.from]||[]).push({other:w.to,w}); (adj[w.to]=adj[w.to]||[]).push({other:w.from,w}); });

  // 1) direct phase<->neutral / phase<->earth shorts on a single cable
  wires.forEach(w=>{
    const ra=acTermRole(w.from), rb=acTermRole(w.to);
    const isPhase=r=>r==='phase';
    if((isPhase(ra)&&rb==='neutral')||(isPhase(rb)&&ra==='neutral'))
      items.push({level:'danger',msg:`SHORT: a phase (${acTermName(isPhase(ra)?w.from:w.to)}) is tied to Neutral \u2014 dead short when energized.`,wireIds:[w.id]});
    if((isPhase(ra)&&rb==='earth')||(isPhase(rb)&&ra==='earth'))
      items.push({level:'danger',msg:`SHORT: a phase is tied to Earth (PE) \u2014 breaker will trip instantly.`,wireIds:[w.id]});
    if((ra==='neutral'&&rb==='earth')||(rb==='neutral'&&ra==='earth'))
      items.push({level:'warn',msg:`Neutral bonded to Earth at the unit \u2014 causes nuisance RCD/GFCI trips.`,wireIds:[w.id]});
    if(ra==='signal'&&isPhase(rb) || rb==='signal'&&isPhase(ra))
      items.push({level:'danger',msg:`A phase is landed on a signal terminal (S) \u2014 will destroy the control board.`,wireIds:[w.id]});
  });

  // 2) two different phases on the SAME terminal (phase-phase short)
  const phaseTag=id=>{ const n=acTermName(id); if(/^L[123]$/.test(n)) return n; if(n[0]==='L') return 'L'; return null; };
  Object.keys(adj).forEach(t=>{
    const phases=new Set();
    const own=phaseTag(t); if(own) phases.add(own);
    adj[t].forEach(e=>{ const p=phaseTag(e.other); if(p) phases.add(p); });
    if(phases.size>1) items.push({level:'danger',msg:`Phase-to-phase short at ${acTermName(t)}: ${[...phases].join(' + ')} meet on one terminal.`,wireIds:adj[t].map(e=>e.w.id)});
  });

  // 3) required connections present & correct
  const correct=acCorrect();
  const linked=(a,c)=> wires.some(w=>(w.from===a&&w.to===c)||(w.from===c&&w.to===a));
  correct.forEach(([a,c])=>{
    if(!linked(a,c)){
      const nm=acTermName(a);
      const role=acTermRole(a);
      if(role==='earth') items.push({level:'danger',msg:`Missing Earth: ${a.split(':')[0]} PE not bonded \u2014 shock hazard.`});
      else if(role==='signal') items.push({level:'warn',msg:`Comms wire ${nm} (outdoor\u2192indoor) missing \u2014 unit will show a communication error.`});
      else if(role==='neutral') items.push({level:'warn',msg:`Neutral to outdoor unit missing \u2014 unit won\u2019t power.`});
      else items.push({level:'warn',msg:`Power wire ${nm} to outdoor unit missing \u2014 no supply.`});
    }
  });

  // 4) S1/S2/S3 crossed (comms miswired) — dangerous on power-carrying S1/S2 systems
  ['S1','S2','S3'].forEach(n=>{
    const o='outdoor:'+n;
    adj[o]&&adj[o].forEach(e=>{ if(e.other.startsWith('indoor:')){ const m=acTermName(e.other); if(m!==n) items.push({level:'danger',msg:`Comms crossed: outdoor ${n} \u2192 indoor ${m}. On many units S1/S2 carry power \u2014 crossing them blows the indoor PCB.`,wireIds:[e.w.id]}); } });
  });

  // 6) earth must never pass through the RCCB / isolator poles
  wires.forEach(w=>{
    const ra=acTermRole(w.from), rb=acTermRole(w.to);
    if(((ra==='earth')&&acIsProtection(w.to)) || ((rb==='earth')&&acIsProtection(w.from)))
      items.push({level:'danger',msg:`Earth routed through the RCCB/isolator \u2014 the earth (PE) must never be switched or interrupted.`,wireIds:[w.id]});
  });

  // 7) protection bypassed (L or N reaches the unit without going through RCCB + isolator)
  if(state.acBench.unit==='lns'){
    const linked=(a,c)=> wires.some(w=>(w.from===a&&w.to===c)||(w.from===c&&w.to===a));
    const chain = linked('supply:L','rccb:Lin')&&linked('rccb:Lout','iso:Lin')&&linked('iso:Lout','outdoor:L');
    const direct = wires.some(w=>{ const s=new Set([w.from,w.to]); return (s.has('supply:L')&&s.has('outdoor:L'))||(s.has('supply:L')&&s.has('iso:Lin')); });
    if(direct || (!chain && wires.some(w=>w.from.startsWith('supply:L')||w.to.startsWith('supply:L'))))
      items.push({level:'warn',msg:`Protection bypassed: run L (and N) through the RCCB then the isolator before the unit.`});
  }

  // 5) colour-scheme coaching (warnings only)
  wires.forEach(w=>{
    const rr=[acTermRole(w.from),acTermRole(w.to)];
    const nm=[acTermName(w.from),acTermName(w.to)];
    let want=null;
    if(rr.includes('earth')) want=std.PE;
    else if(rr.includes('neutral')) want=std.N;
    else if(nm.includes('L')||nm.includes('L1')) want=std.L1;
    else if(nm.includes('L2')) want=std.L2;
    else if(nm.includes('L3')) want=std.L3;
    if(want && w.color && want!==w.color && !rr.includes('signal'))
      items.push({level:'warn',msg:`Colour: ${nm.find(x=>x!=='PE')||nm[0]} should be ${AC_COLNAME[want]} (${std.name}); you used ${AC_COLNAME[w.color]||'?'}.`,wireIds:[w.id]});
  });

  const danger=items.some(i=>i.level==='danger');
  const warn=items.some(i=>i.level==='warn');
  const allCorrect = correct.every(([a,c])=>linked(a,c)) && !danger;
  let status = danger?'danger':(warn?'warn':(allCorrect?'ok':'warn'));
  if(!wires.length){ status='empty'; }
  return {items,status,allCorrect};
}

/* auto-wire correctly (teach the answer) */
function acAutoWire(){
  const std=AC_STD[state.acBench.standard];
  const colorFor=id=>{ const n=acTermName(id); const r=acTermRole(id); if(r==='earth')return std.PE; if(r==='neutral')return std.N; if(n==='L2')return std.L2; if(n==='L3')return std.L3; if(r==='signal')return std.S; return std.L1; };
  state.acBench.wires=acCorrect().map(([a,c],i)=>({id:'acw'+i,from:a,to:c,color:colorFor(a)}));
  state.acBench.sel=null; state.acBench.selWire=null; renderACTab(); markDirty();
}
function acInsertFault(){
  acAutoWire();
  const w=state.acBench.wires; if(!w.length) return;
  const kind=Math.floor(Math.random()*3);
  if(kind===0){ // swap a neutral and a phase destination -> reversed polarity / short risk
    const nw=w.find(x=>acTermRole(x.to)==='neutral'); const lw=w.find(x=>acTermRole(x.to)==='phase');
    if(nw&&lw){ const t=nw.to; nw.to=lw.to; lw.to=t; }
  } else if(kind===1){ // drop the earth
    const i=w.findIndex(x=>acTermRole(x.to)==='earth'||acTermRole(x.from)==='earth'); if(i>=0) w.splice(i,1);
  } else { // land a phase on an earth or signal terminal -> short / board damage
    const lw=w.find(x=>acTermRole(x.to)==='phase');
    const tgt=Object.keys(acLayout().T).find(id=>acTermRole(id)==='signal'||acTermRole(id)==='earth');
    if(lw&&tgt){ lw.to=tgt; }
  }
  state.acBench.selWire=null; renderACTab(); markDirty();
  showToast('A fault was inserted \u2014 find and fix it.');
}
function acClear(){ state.acBench.wires=[]; state.acBench.sel=null; state.acBench.selWire=null; renderACTab(); markDirty(); }

/* ---- compressor + multimeter diagnostics ---- */
const AC_COMP_FAULTS=[
  ['none','Healthy'],['ground','Winding\u2192Earth (short to case)'],['open_run','Open RUN winding'],
  ['open_start','Open START winding'],['shorted','Shorted windings'],['seized','Seized (locked rotor)']
];
function acNets(){
  const parent={};
  const find=x=>{ if(parent[x]===undefined) parent[x]=x; while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x]; } return x; };
  state.acBench.wires.forEach(w=>{ parent[find(w.from)]=find(w.to); });
  return {find};
}
/* resistance between two probed terminals (ohms, or Infinity=OL, or null) */
function acRes(a,b){
  if(!a||!b||a===b) return null;
  const comp=state.acBench.comp||'none';
  const isC=id=>id.split(':')[0]==='comp';
  if(isC(a)&&isC(b)){
    const set=new Set([acTermName(a),acTermName(b)]);
    const has=(x,y)=>set.has(x)&&set.has(y);
    if(set.has('CASE')){ // winding-to-earth insulation
      return comp==='ground'? 700 : Infinity;
    }
    const Rrun=2.0,Rstart=5.0;
    if(comp==='shorted') return 0.3;
    if(comp==='open_run'){ if(has('C','R')||has('R','S')) return Infinity; return Rstart; }
    if(comp==='open_start'){ if(has('C','S')||has('R','S')) return Infinity; return Rrun; }
    if(has('C','R')) return Rrun;
    if(has('C','S')) return Rstart;
    if(has('R','S')) return Rrun+Rstart;
    return Infinity;
  }
  const {find}=acNets();
  if(find(a)===find(b)) return 0.2; // joined by wire
  return Infinity;
}
/* AC volts between two probed terminals (0 if off/tripped/floating) */
function acVolt(a,b){
  const st=acSystemState();
  if(!state.acBench.powerOn || st.tripped || !a || !b) return 0;
  const {find}=acNets(); const T=acLayout().T;
  const potOf=id=>{
    const root=find(id); let pot=0, tag=null, isPhase=false;
    Object.keys(T).forEach(t=>{ if(find(t)!==root) return; if(!t.startsWith('supply:')) return;
      const r=acTermRole(t), nm=acTermName(t);
      if(r==='phase'){ isPhase=true; tag=/^L[123]$/.test(nm)?nm:'L'; } });
    return {isPhase,tag};
  };
  const pa=potOf(a), pb=potOf(b);
  if(pa.isPhase&&pb.isPhase) return pa.tag!==pb.tag?400:0;
  if(pa.isPhase||pb.isPhase) return 230;
  return 0;
}
/* overall system state incl. RCCB / overload trips caused by the compressor */
function acSystemState(){
  const chk=checkACWiring();
  const comp=state.acBench.comp||'none';
  const cap=state.acBench.cap||'ok';
  const on=!!state.acBench.powerOn;
  const {find}=acNets();
  const linked=(a,c)=>find(a)===find(c);
  const correct=acCorrect();
  const earthPairs=correct.filter(([a])=>acTermRole(a)==='earth');
  const earthOK=earthPairs.length>0 && earthPairs.every(([a,c])=>linked(a,c));
  const lnPairs=correct.filter(([a])=>{const r=acTermRole(a);return r==='phase'||r==='neutral';});
  const lnOK=lnPairs.length>0 && lnPairs.every(([a,c])=>linked(a,c));
  const energizable=chk.allCorrect;
  let tripped=false, liveCasing=false, reason='';
  if(on){
    if(comp==='ground'){
      if(earthOK){ tripped=true; reason='RCCB tripped \u2014 earth leakage from a compressor winding (insulation breakdown). Power is cut.'; }
      else if(lnOK){ liveCasing=true; reason='\u2620 NO TRIP \u2014 winding shorted to an UN-EARTHED casing. The metal case is LIVE. With no earth the RCCB can\u2019t see the leak. Electrocution risk.'; }
    }
    else if(energizable && comp==='shorted'){ tripped=true; reason='Breaker/overload tripped \u2014 shorted compressor windings drew fault current.'; }
    else if(energizable && comp==='seized'){ tripped=true; reason='Thermal overload tripped \u2014 seized compressor pulled locked-rotor amps.'; }
    else if(energizable && cap==='short'){ tripped=true; reason='Overload tripped \u2014 shorted run capacitor.'; }
  }
  const willNotStart = on && energizable && !tripped && !liveCasing && (comp==='open_run'||comp==='open_start'||cap==='open'||cap==='weak');
  const running = on && energizable && !tripped && !liveCasing && !willNotStart;
  return { energizable, on, tripped, liveCasing, running, willNotStart, reason, comp, cap, earthOK, lnOK };
}
/* clamp-meter running current */
function acCurrent(){
  const c=state.acBench.comp||'none', cap=state.acBench.cap||'ok';
  if(!state.acBench.powerOn) return {a:0,note:'power off'};
  const st=acSystemState();
  if(c==='seized') return {a:22,note:'locked-rotor amps \u2014 overload will trip'};
  if(c==='shorted') return {a:30,note:'fault current \u2014 breaker trips'};
  if(st.liveCasing) return {a:0.4,note:'leaking to casing (no earth)'};
  if(c==='open_run') return {a:0,note:'open run winding \u2014 no current'};
  if(c==='open_start'||cap==='open'||cap==='weak') return {a:9,note:'high start current \u2014 won\u2019t start'};
  if(st.running) return {a:4.8,note:'normal running current (FLA)'};
  return {a:0,note:''};
}
function acCapValue(){ const cap=state.acBench.cap||'ok'; return cap==='ok'?35: cap==='weak'?18: cap==='short'?0: null; }
function acSetCap(f){ state.acBench.cap=f; renderACTab(); markDirty(); }
/* multimeter reading for the current probes + mode */
function acMeasure(){
  const m=state.acBench.meter;
  if(m.mode==='amp'){ const c=acCurrent(); return {txt:(c.a<10?c.a.toFixed(1):c.a.toFixed(0))+' A', sub:c.note||'clamp on the line conductor'}; }
  if(m.mode==='cap'){ const v=acCapValue(); if(v===null) return {txt:'OL \u00B5F',sub:'open capacitor \u2014 failed'}; if(v===0) return {txt:'0 \u00B5F',sub:'shorted capacitor'}; return {txt:v+' \u00B5F',sub:v<25?'weak \u2014 below rating':'healthy (\u224835 \u00B5F)'}; }
  if(!m.a||!m.b) return {txt:'\u2014\u2014', sub:'probe two points'};
  const powered=state.acBench.powerOn && !acSystemState().tripped;
  if(m.mode==='vac'){ const v=acVolt(m.a,m.b); return {txt:(v?v.toFixed(0):'0')+' V~', sub:acTermName(m.a)+' \u2194 '+acTermName(m.b)}; }
  const r=acRes(m.a,m.b);
  if(m.mode==='cont'){ const beep=(r!==null&&r!==Infinity&&r<2); return {txt:beep?'\u25CF BEEP':'\u00b7 open', sub:beep?r.toFixed(1)+' \u03A9 (continuous)':'no continuity (OL)'}; }
  if(m.mode==='ohm'){ return {txt:(r===Infinity||r===null)?'OL':r.toFixed(1)+' \u03A9', sub:powered?'\u26A0 power ON \u2014 read \u03A9 de-energized':(acTermName(m.a)+' \u2194 '+acTermName(m.b))}; }
  if(m.mode==='insul'){
    if(r===null) return {txt:'\u2014\u2014',sub:'probe winding \u2192 CASE'};
    if(r===Infinity) return {txt:'>50 M\u03A9', sub:'insulation OK'};
    const meg=r/1e6;
    return {txt:(meg<0.1? r.toFixed(0)+' \u03A9':meg.toFixed(2)+' M\u03A9')+' \u2717', sub:'insulation FAIL \u2014 winding leaking to earth'};
  }
  return {txt:'\u2014\u2014',sub:''};
}

/* recognizable equipment art for the supply / outdoor / indoor blocks */
/* ============================================================
   A/C TRAINER — realistic scene & equipment art
   ------------------------------------------------------------
   Pure artwork upgrade. Terminal, port and block coordinates all
   still come from acLayout(), so wiring, the guide, the checker,
   the multimeter and every fault scenario work unchanged.
   The drawing is a building cross-section:
     [inside \u00b7 meter board]  | wall |  [outside]  | wall |  [inside \u00b7 room]
   ============================================================ */

function acSceneArt(blocks, OW, OH, lns){
  const ob=blocks.find(b=>b.key==='outdoor'), ib=blocks.find(b=>b.key==='indoor');
  if(!ob||!ib) return '';
  const leftEnd=Math.max(...blocks.filter(b=>['supply','rccb','iso'].includes(b.key)).map(b=>b.x+b.w));
  const w1=Math.round((leftEnd+ob.x)/2), w2=Math.round((ob.x+ob.w+ib.x)/2);
  const groundY=OH-26, pipeY=blocks._pipeY||0;
  const comp=blocks.find(b=>b.key==='comp');
  let s='';
  /* zone A — interior plant/meter area */
  s+=`<rect x="0" y="0" width="${w1}" height="${OH}" fill="url(#acRoomA)"/>`;
  s+=`<rect x="0" y="${OH-20}" width="${w1}" height="20" fill="#c1c7cf"/><line x1="0" y1="${OH-20}" x2="${w1}" y2="${OH-20}" stroke="#a7adb6" stroke-width="1"/>`;
  /* zone B — outside: sky, sun, cloud, ground */
  s+=`<rect x="${w1}" y="0" width="${w2-w1}" height="${OH}" fill="url(#acSky)"/>`;
  s+=`<circle cx="${w1+36}" cy="30" r="15" fill="#f6e3a1" opacity="0.55"/><circle cx="${w1+36}" cy="30" r="10" fill="#f8ecc0"/>`;
  s+=`<g fill="#ffffff" opacity="0.8"><ellipse cx="${w2-74}" cy="40" rx="20" ry="8"/><ellipse cx="${w2-58}" cy="34" rx="14" ry="7"/><ellipse cx="${w2-92}" cy="36" rx="12" ry="6"/></g>`;
  s+=`<rect x="${w1}" y="${groundY}" width="${w2-w1}" height="${OH-groundY}" fill="url(#acGround)"/>`;
  s+=`<line x1="${w1}" y1="${groundY}" x2="${w2}" y2="${groundY}" stroke="#7e9166" stroke-width="1.2"/>`;
  s+=`<ellipse cx="${w1+22}" cy="${groundY-4}" rx="9" ry="8" fill="#6f8f5a"/><ellipse cx="${w1+31}" cy="${groundY-2}" rx="7" ry="6" fill="#5d7a4a"/>`;
  if(comp) s+=`<rect x="${comp.x-8}" y="${comp.y+comp.h-4}" width="${comp.w+16}" height="10" rx="2" fill="#b9bec6" stroke="#9aa1ab" stroke-width="0.8"/><text x="${comp.x+comp.w/2}" y="${comp.y+comp.h+14}" font-size="6" fill="#5a6a52" text-anchor="middle">concrete plinth</text>`;
  /* zone C — interior living room */
  s+=`<rect x="${w2}" y="0" width="${OW-w2}" height="${OH}" fill="url(#acRoomB)"/>`;
  s+=`<rect x="${w2}" y="${OH-20}" width="${OW-w2}" height="20" fill="#b99b74"/><line x1="${w2}" y1="${OH-20}" x2="${OW}" y2="${OH-20}" stroke="#9a7d58" stroke-width="1"/>`;
  s+=`<rect x="${w2+9}" y="${OH-26}" width="${OW-w2-9}" height="6" fill="#e6dccb" stroke="#c9baa1" stroke-width="0.6"/>`;
  /* the two building walls (running-bond brick with plaster edges) */
  [w1,w2].forEach(wx=>{
    s+=`<rect x="${wx-9}" y="0" width="18" height="${OH}" fill="url(#acBrick)" stroke="#9c8468" stroke-width="1"/>`;
    s+=`<line x1="${wx-9}" y1="0" x2="${wx-9}" y2="${OH}" stroke="#efe8dc" stroke-width="1.6"/><line x1="${wx+9}" y1="0" x2="${wx+9}" y2="${OH}" stroke="#7c6a52" stroke-width="1.2"/>`;
  });
  /* cable sleeves where the wiring crosses each wall */
  [w1,w2].forEach(wx=>{
    s+=`<rect x="${wx-12}" y="124" width="24" height="11" rx="5" fill="#d6dade" stroke="#8a919b" stroke-width="0.9"/>`;
    s+=`<line x1="${wx-12}" y1="129.5" x2="${wx+12}" y2="129.5" stroke="#b6bcc4" stroke-width="0.8"/>`;
  });
  s+=`<text x="${w1}" y="118" font-size="5.6" fill="#5a6472" text-anchor="middle">sleeve</text>`;
  s+=`<text x="${w2}" y="118" font-size="5.6" fill="#5a6472" text-anchor="middle">sleeve</text>`;
  /* line-set core drill through the room wall */
  if(pipeY) s+=`<ellipse cx="${w2}" cy="${pipeY+8}" rx="13" ry="11" fill="#e8ebef" stroke="#8a919b" stroke-width="1"/><ellipse cx="${w2}" cy="${pipeY+8}" rx="8" ry="6.5" fill="#c9ced6" stroke="#8a919b" stroke-width="0.7"/><text x="${w2}" y="${pipeY+28}" font-size="5.6" fill="#5a6472" text-anchor="middle">core drill</text>`;

  /* consumer unit around the DIN devices — brass bars + tied looms (ref photo) */
  const dinB=blocks.filter(b=>b.key==='rccb'||b.key==='iso');
  if(dinB.length){
    const x0=Math.min(...dinB.map(d=>d.x))-24, x1=Math.max(...dinB.map(d=>d.x+d.w))+24;
    const y0=dinB[0].y-50, y1=Math.max(...dinB.map(d=>d.y+d.h))+22;
    s+=`<rect x="${x0+2}" y="${y0+3}" width="${x1-x0}" height="${y1-y0}" rx="7" fill="#000" opacity="0.12"/>`;
    s+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="${y1-y0}" rx="7" fill="#f2f4f7" stroke="#aab2bd" stroke-width="1.4"/>`;
    s+=`<rect x="${x0}" y="${y0}" width="${x1-x0}" height="10" rx="7" fill="#dfe4ea"/>`;
    /* brass neutral/earth bar with terminal screws */
    const bx0=x0+16, bx1=x1-58, by=y0+15;
    s+=`<rect x="${bx0}" y="${by}" width="${bx1-bx0}" height="7" rx="1.5" fill="url(#acBrassBar)" stroke="#8a6a2a" stroke-width="0.8"/>`;
    for(let hx=bx0+6; hx<bx1-3; hx+=11) s+=`<circle cx="${hx}" cy="${by+3.5}" r="1.7" fill="#8a6a2a"/><line x1="${hx-0.9}" y1="${by+3.5}" x2="${hx+0.9}" y2="${by+3.5}" stroke="#5c4415" stroke-width="0.6"/>`;
    s+=`<circle cx="${bx1+9}" cy="${by+3.5}" r="3" fill="#2b6fe0"/><text x="${bx1+9}" y="${by+5.6}" font-size="4.6" font-weight="800" fill="#fff" text-anchor="middle">N</text>`;
    s+=`<circle cx="${bx1+21}" cy="${by+3.5}" r="3" fill="#3fae5a"/><text x="${bx1+21}" y="${by+5.6}" font-size="4.4" font-weight="800" fill="#fff" text-anchor="middle">E</text>`;
    s+=`<text x="${bx1+34}" y="${by+6}" font-size="4.8" fill="#5a6472">bars</text>`;
    /* red tails looping from the bar zone down to each module */
    dinB.forEach(d=>{ const mx=d.x+d.w/2;
      s+=`<path d="M ${mx-10} ${by+7} C ${mx-14} ${by+22}, ${mx-4} ${d.y-14}, ${mx-6} ${d.y-1}" fill="none" stroke="#c23b2e" stroke-width="2.2" stroke-linecap="round"/>`;
      s+=`<path d="M ${mx+10} ${by+7} C ${mx+15} ${by+20}, ${mx+5} ${d.y-16}, ${mx+7} ${d.y-1}" fill="none" stroke="#2c333c" stroke-width="2.2" stroke-linecap="round"/>`;
    });
    /* tidy tied loom on the left wall of the box */
    const lx0=x0+9;
    s+=`<path d="M ${lx0} ${y0+26} C ${lx0-3} ${y0+56}, ${lx0+3} ${y1-56}, ${lx0} ${y1-14}" fill="none" stroke="#3fae5a" stroke-width="2.4"/>`;
    s+=`<path d="M ${lx0+4} ${y0+26} C ${lx0+1} ${y0+58}, ${lx0+7} ${y1-58}, ${lx0+4} ${y1-14}" fill="none" stroke="#e6e9ee" stroke-width="2.4"/>`;
    s+=`<path d="M ${lx0+8} ${y0+26} C ${lx0+5} ${y0+60}, ${lx0+11} ${y1-60}, ${lx0+8} ${y1-14}" fill="none" stroke="#c23b2e" stroke-width="2.4"/>`;
    [y0+42,(y0+y1)/2,y1-34].forEach(ty=>{ s+=`<rect x="${lx0-3.4}" y="${ty}" width="15" height="3.4" rx="1.4" fill="#e9edf2" stroke="#9aa1ab" stroke-width="0.6"/><rect x="${lx0+9.4}" y="${ty-1.4}" width="2.6" height="3" fill="#cfd6dd" stroke="#9aa1ab" stroke-width="0.4"/>`; });
  }
  /* zone captions */
  s+=`<text x="${w1/2}" y="13" font-size="8" font-weight="700" letter-spacing="1.2" fill="#5a6472" text-anchor="middle">INSIDE \u00b7 METER BOARD</text>`;
  s+=`<text x="${(w1+w2)/2}" y="13" font-size="8" font-weight="700" letter-spacing="1.2" fill="#4a6a8a" text-anchor="middle">OUTSIDE</text>`;
  s+=`<text x="${(w2+OW)/2}" y="13" font-size="8" font-weight="700" letter-spacing="1.2" fill="#7a6448" text-anchor="middle">INSIDE \u00b7 ROOM</text>`;
  return s;
}

/* ---- realistic DIN modules for the RCCB / rotary isolator ---------- */
function acDinModuleArt(bl,st,b){
  const trip = bl.key==='rccb' && st.tripped && b.comp==='ground';
  const cx=bl.x+bl.w/2;
  let s=`<rect x="${bl.x+2}" y="${bl.y+3}" width="${bl.w}" height="${bl.h}" rx="4" fill="#000" opacity="0.14"/>`;
  s+=`<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" rx="4" fill="#f7f9fb" stroke="#9aa1ab" stroke-width="1.3"/>`;
  /* terminal shrouds top & bottom, with clamp screws */
  [[bl.y+4],[bl.y+bl.h-15]].forEach(([sy])=>{
    s+=`<rect x="${bl.x+7}" y="${sy}" width="${bl.w-14}" height="11" rx="2" fill="#dfe4ea" stroke="#c2c8d0" stroke-width="0.7"/>`;
    [bl.x+20,bl.x+bl.w-20].forEach(sx=>{ s+=`<circle cx="${sx}" cy="${sy+5.5}" r="3" fill="#c6cbd2" stroke="#7a828d" stroke-width="0.7"/><line x1="${sx-1.7}" y1="${sy+5.5}" x2="${sx+1.7}" y2="${sy+5.5}" stroke="#5c636c" stroke-width="0.8"/>`; });
  });
  /* printed face */
  s+=`<rect x="${bl.x+6}" y="${bl.y+18}" width="${bl.w-12}" height="${bl.h-36}" rx="2" fill="#f0f3f6" stroke="#e0e4e9" stroke-width="0.6"/>`;
  s+=`<rect x="${bl.x+6}" y="${bl.y+18}" width="${bl.w-12}" height="5" rx="1.5" fill="${bl.key==='rccb'?'#2b6fe0':'#e08a1a'}"/>`;
  s+=`<text x="${cx}" y="${bl.y+33}" font-size="7.5" font-weight="700" fill="#33475f" text-anchor="middle">${bl.title}</text>`;
  if(bl.key==='rccb'){
    /* lever in its recess */
    s+=`<rect x="${cx+2}" y="${bl.y+38}" width="19" height="36" rx="3" fill="#c9d0d9" stroke="#a7adb6" stroke-width="0.7"/>`;
    const lvy = trip? bl.y+57 : bl.y+41;
    s+=`<rect x="${cx+4}" y="${lvy}" width="15" height="15" rx="2.5" fill="${trip?'#e0473c':'url(#euOrange)'}" stroke="${trip?'#8f1f14':'#b5520f'}" stroke-width="0.7"/>`;
    s+=`<line x1="${cx+7}" y1="${lvy+4}" x2="${cx+16}" y2="${lvy+4}" stroke="${trip?'#8f1f14':'#a8500f'}" stroke-width="0.8"/>`;
    s+=`<line x1="${cx+7}" y1="${lvy+7}" x2="${cx+16}" y2="${lvy+7}" stroke="${trip?'#8f1f14':'#a8500f'}" stroke-width="0.8"/>`;
    s+=`<text x="${cx+11.5}" y="${lvy+10}" font-size="7" font-weight="800" fill="${trip?'#fff':'#5c2a05'}" text-anchor="middle">${trip?'0':'I'}</text>`;
    /* test button */
    s+=`<circle cx="${bl.x+18}" cy="${bl.y+52}" r="7" fill="#2b6fe0" stroke="#1d4fa0" stroke-width="1"/><text x="${bl.x+18}" y="${bl.y+55.5}" font-size="8" font-weight="800" fill="#fff" text-anchor="middle">T</text>`;
    s+=`<text x="${bl.x+18}" y="${bl.y+67}" font-size="4.6" fill="#5a6472" text-anchor="middle">test monthly</text>`;
    /* printed toroid wiring diagram, as on real RCD faces */
    s+=`<circle cx="${bl.x+18}" cy="${bl.y+80}" r="5" fill="none" stroke="#7a828d" stroke-width="0.9"/>`;
    s+=`<line x1="${bl.x+16}" y1="${bl.y+73}" x2="${bl.x+16}" y2="${bl.y+87}" stroke="#7a828d" stroke-width="0.8"/>`;
    s+=`<line x1="${bl.x+20}" y1="${bl.y+73}" x2="${bl.x+20}" y2="${bl.y+87}" stroke="#7a828d" stroke-width="0.8"/>`;
    s+=`<path d="M ${bl.x+24.5} ${bl.y+76} l 1.6 1.6 l -1.6 1.6 l 1.6 1.6" fill="none" stroke="#7a828d" stroke-width="0.7"/>`;
    s+=`<circle cx="${bl.x+9}" cy="${bl.y+36}" r="1.1" fill="#8a919a"/><circle cx="${bl.x+9}" cy="${bl.y+96}" r="1.1" fill="#8a919a"/>`;
    s+=`<text x="${cx}" y="${bl.y+84}" font-size="6.6" font-weight="700" fill="#25324a" text-anchor="middle">40A \u00b7 30mA</text>`;
    s+=`<text x="${cx}" y="${bl.y+93}" font-size="5" fill="#5a6472" text-anchor="middle">Type A ~</text>`;
    if(trip) s+=`<text x="${cx}" y="${bl.y+bl.h-19}" font-size="7.5" font-weight="800" fill="#e0473c" text-anchor="middle">TRIPPED<animate attributeName="opacity" values="1;0.25;1" dur="0.9s" repeatCount="indefinite"/></text>`;
  } else {
    /* rotary isolator: yellow plate + red handle, always shown ON here */
    s+=`<rect x="${cx-13}" y="${bl.y+38}" width="26" height="26" rx="3" fill="#f0c000" stroke="#b98f00" stroke-width="1"/>`;
    s+=`<rect x="${cx-3.4}" y="${bl.y+40.5}" width="6.8" height="21" rx="2.6" fill="#d6452f" stroke="#8f1f14" stroke-width="0.9"/>`;
    s+=`<circle cx="${cx}" cy="${bl.y+51}" r="2" fill="#8f1f14"/>`;
    s+=`<text x="${cx}" y="${bl.y+74}" font-size="6" font-weight="700" fill="#25324a" text-anchor="middle">I \u00b7 ON</text>`;
    s+=`<text x="${cx}" y="${bl.y+86}" font-size="6.2" font-weight="700" fill="#25324a" text-anchor="middle">OT40 \u00b7 2P</text>`;
    s+=`<text x="${cx}" y="${bl.y+95}" font-size="4.8" fill="#5a6472" text-anchor="middle">lockable \u{1F512}</text>`;
  }
  /* DIN clip foot */
  s+=`<rect x="${cx-6}" y="${bl.y+bl.h}" width="12" height="4" rx="1" fill="#8a919b"/>`;
  return s;
}

/* ---- hermetic compressor pot + CBB65 run capacitor ------------------ */
function acCompressorArt(bl,st,b){
  const live = st.liveCasing;
  const tripped = st.tripped && (b.comp==='ground'||b.comp==='shorted'||b.comp==='seized');
  const cx=bl.x+bl.w/2, potTop=bl.y+56, potCy=bl.y+72;
  let s='';
  s+=`<rect x="${bl.x+2}" y="${bl.y+3}" width="${bl.w}" height="${bl.h}" rx="12" fill="#000" opacity="0.14"/>`;
  s+=`<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" rx="12" fill="#2c3644" stroke="${(tripped||live)?'#e0473c':'#1b222c'}" stroke-width="${live?2.6:1.5}"/>`;
  s+=`<rect x="${bl.x+2}" y="${bl.y+2}" width="${bl.w-4}" height="6" rx="6" fill="#ffffff" opacity="0.06"/>`;
  s+=`<text x="${cx}" y="${bl.y+14}" font-size="10" font-weight="700" fill="#cfe0f5" text-anchor="middle">HERMETIC COMPRESSOR</text>`;
  /* galvanized service tray with vent perforations (ref photo) */
  s+=`<rect x="${bl.x+8}" y="${bl.y+bl.h-17}" width="${bl.w-16}" height="11" rx="2" fill="url(#acZinc)" stroke="#8f97a1" stroke-width="0.8"/>`;
  for(let hx=bl.x+16; hx<bl.x+bl.w-16; hx+=9) s+=`<circle cx="${hx}" cy="${bl.y+bl.h-11.5}" r="1" fill="#6d747e"/>`;
  /* Fusite terminal plate with glass-seal bosses + spade tabs under C / R / S */
  s+=`<rect x="${bl.x+16}" y="${bl.y+28}" width="${bl.w-32}" height="24" rx="6" fill="#11161d" stroke="#3a4658" stroke-width="1"/>`;
  [0,1,2].forEach(i=>{ const tx=bl.x+26+i*((bl.w-52)/2);
    s+=`<circle cx="${tx}" cy="${bl.y+40}" r="9" fill="#1c242e" stroke="#39434f" stroke-width="1"/>`;
    s+=`<rect x="${tx-1.4}" y="${bl.y+30.5}" width="2.8" height="4.6" rx="0.5" fill="#d8c07a" stroke="#8a6a2a" stroke-width="0.4"/>`;
  });
  s+=`<text x="${bl.x+bl.w-20}" y="${bl.y+26}" font-size="4.8" fill="#8fa0b4" text-anchor="end">Fusite \u00b7 glass seals</text>`;
  /* steel pot: dome + shell + weld seam + feet */
  s+=`<ellipse cx="${cx-2}" cy="${bl.y+bl.h-9}" rx="40" ry="4" fill="#000" opacity="0.25"/>`;
  s+=`<rect x="${cx-34}" y="${potTop}" width="64" height="32" rx="15" fill="url(#acPotG)" stroke="#0c1016" stroke-width="1.4"/>`;
  s+=`<ellipse cx="${cx-2}" cy="${potTop}" rx="32" ry="11" fill="url(#acPotG)" stroke="#0c1016" stroke-width="1.4"/>`;
  s+=`<ellipse cx="${cx-2}" cy="${potTop}" rx="32" ry="11" fill="#ffffff" opacity="0.05"/>`;
  s+=`<path d="M ${cx-34} ${potTop+15} q 32 8 64 0" fill="none" stroke="#4a545f" stroke-width="1" stroke-dasharray="2 2.4"/>`;
  s+=`<rect x="${cx-24}" y="${potTop+4}" width="6" height="24" rx="3" fill="#ffffff" opacity="0.07"/>`;
  /* suction line with black loom sleeve at the cabinet entry (ref photo) */
  s+=`<path d="M ${bl.x+8} ${potTop+13} H ${cx-33}" stroke="#8a531f" stroke-width="5" stroke-linecap="round"/><path d="M ${bl.x+8} ${potTop+13} H ${cx-33}" stroke="#f3ba76" stroke-width="2.2" stroke-linecap="round"/>`;
  s+=`<rect x="${bl.x+9}" y="${potTop+9}" width="13" height="8" rx="3.5" fill="#141b24" stroke="#2c3644" stroke-width="0.7"/>`;
  s+=`<path d="M ${cx+22} ${potTop-8} v -6" stroke="#8a531f" stroke-width="4.4" stroke-linecap="round"/><path d="M ${cx+22} ${potTop-8} v -6" stroke="#f3ba76" stroke-width="1.9" stroke-linecap="round"/>`;
  s+=`<text x="${bl.x+8}" y="${potTop+26}" font-size="4.6" fill="#8fa0b4">suction</text>`;
  /* rubber mounting feet with bolts */
  [cx-26,cx-2,cx+22].forEach(fx=>{ s+=`<rect x="${fx-4}" y="${bl.y+bl.h-14}" width="8" height="5" rx="1.5" fill="#1b222c" stroke="#39434f" stroke-width="0.6"/><circle cx="${fx}" cy="${bl.y+bl.h-11.5}" r="1.2" fill="#6d7885"/>`; });
  /* rotor indicator while running */
  if(st.running) s+=`<g><animateTransform attributeName="transform" type="rotate" from="0 ${cx-2} ${potTop+16}" to="360 ${cx-2} ${potTop+16}" dur="0.7s" repeatCount="indefinite"/><path d="M ${cx-2} ${potTop+16} L ${cx-2} ${potTop+4} A 12 12 0 0 1 ${cx+8} ${potTop+22} Z" fill="#5fd394" opacity="0.35"/></g>`;
  /* status badge + faults */
  const badge=b.comp==='none'?['#43b25f','\u2713 OK']:(tripped?['#e0473c','\u26A0 FAULT']:['#f0a830','\u26A0 FAULT SET']);
  s+=`<text x="${cx-2}" y="${potCy+3}" font-size="8" font-weight="800" fill="${badge[0]}" text-anchor="middle" style="pointer-events:none">${live?'':badge[1]}</text>`;
  if(live) s+=`<text x="${cx-2}" y="${potCy+3}" font-size="8" font-weight="800" fill="#ff8d84" text-anchor="middle" style="pointer-events:none">CASE LIVE \u26A1<animate attributeName="opacity" values="1;0.3;1" dur="0.7s" repeatCount="indefinite"/></text>`;
  if(b.comp==='ground') s+=`<path d="M ${cx+12} ${potTop+8} L ${cx-2} ${bl.y+bl.h-18}" stroke="#e0473c" stroke-width="1.8" stroke-dasharray="3 3" fill="none"><animate attributeName="opacity" values="1;0.2;1" dur="0.5s" repeatCount="indefinite"/></path>`;
  /* earth lug at the CASE terminal */
  s+=`<rect x="${cx-9}" y="${bl.y+bl.h-22}" width="18" height="9" rx="2" fill="url(#metalGrad)" stroke="#5a6572" stroke-width="0.8"/>`;
  /* bare-metal run capacitor: crimp ring, spade clusters, mounting strap (ref photo) */
  const capx=bl.x+bl.w-15, capTop=bl.y+48;
  s+=`<rect x="${capx-9.5}" y="${capTop}" width="19" height="42" rx="4" fill="url(#acZinc)" stroke="#7f8894" stroke-width="0.9"/>`;
  s+=`<rect x="${capx-9.5}" y="${capTop+4.6}" width="19" height="1.7" fill="#8f97a1"/>`;
  s+=`<rect x="${capx-6.5}" y="${capTop+8}" width="4.5" height="30" rx="2" fill="#ffffff" opacity="0.28"/>`;
  [[-6.4,-3.6],[-1.2,1.2],[3.6,6.4]].forEach(g=>g.forEach(dx=>{ s+=`<rect x="${capx+dx-0.9}" y="${capTop-4.4}" width="1.8" height="4.8" rx="0.4" fill="#cfd6dd" stroke="#7f8894" stroke-width="0.35"/>`; }));
  s+=`<text x="${capx-8}" y="${capTop-6.5}" font-size="3.6" fill="#8fa0b4">HERM</text><text x="${capx+8.5}" y="${capTop-6.5}" font-size="3.6" fill="#8fa0b4" text-anchor="end">FAN</text>`;
  s+=`<rect x="${capx-12}" y="${capTop+24}" width="24" height="3.4" rx="1.4" fill="#8f97a1" stroke="#6d747e" stroke-width="0.5"/><circle cx="${capx-10}" cy="${capTop+25.7}" r="1.1" fill="#565e69"/>`;
  s+=`<text x="${capx}" y="${capTop+16}" font-size="4.2" font-weight="700" fill="#3a4450" text-anchor="middle">35\u00b5F</text>`;
  s+=`<text x="${capx}" y="${capTop+35}" font-size="3.8" fill="#4a5460" text-anchor="middle">450V~</text>`;
  if(b.cap&&b.cap!=='ok') s+=`<text x="${capx}" y="${capTop+50}" font-size="5.4" font-weight="800" fill="#ff8d84" text-anchor="middle">BAD</text>`;
  return s;
}

/* ---- realistic supply board / outdoor unit / indoor unit ------------ */
function acUnitArt(bl,T,st){
  let s='';
  const terms=Object.values(T).filter(t=>t.block===bl.key);
  const sides=new Set(terms.map(t=>t.side));
  const padL=sides.has('L')?20:10, padR=sides.has('R')?20:10;
  const ax=bl.x+padL, aw=bl.w-padL-padR, acx=ax+aw/2, ay=bl.y+26;
  const wide=aw>=62;
  const lab=(x,y,t,col)=>wide?`<text x="${x}" y="${y}" font-size="5.3" fill="${col||'#5a6472'}" text-anchor="middle" style="pointer-events:none">${t}</text>`:'';
  s+=`<rect x="${bl.x+2}" y="${bl.y+3}" width="${bl.w}" height="${bl.h}" rx="10" fill="#000" opacity="0.14"/>`;
  const shellFill = bl.key==='outdoor'? 'url(#acCaseG)' : bl.key==='indoor'? '#fbfcfd' : '#eef1f5';
  s+=`<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" rx="10" fill="${shellFill}" stroke="#9aa1ab" stroke-width="1.4"/>`;
  s+=`<path d="M ${bl.x} ${bl.y+20} V ${bl.y+11} Q ${bl.x} ${bl.y} ${bl.x+11} ${bl.y} H ${bl.x+bl.w-11} Q ${bl.x+bl.w} ${bl.y} ${bl.x+bl.w} ${bl.y+11} V ${bl.y+20} Z" fill="#33475f"/>`;
  s+=`<text x="${bl.x+bl.w/2}" y="${bl.y+14}" font-size="9.5" font-weight="700" fill="#eef4fb" text-anchor="middle">${bl.title}</text>`;

  if(bl.key==='supply'){
    /* kWh meter with LCD register, optical port and lead seals */
    const mh=Math.min(58, bl.h-72);
    s+=`<rect x="${ax+3}" y="${ay}" width="${aw-6}" height="${mh}" rx="4" fill="#f7f9fb" stroke="#b6bcc4" stroke-width="1"/>`;
    s+=`<rect x="${ax+3}" y="${ay}" width="${aw-6}" height="9" rx="4" fill="#33475f"/>`;
    s+=`<text x="${acx}" y="${ay+7}" font-size="5.4" font-weight="700" fill="#dfe7f2" text-anchor="middle">kWh METER \u00b7 230V~</text>`;
    s+=`<rect x="${ax+9}" y="${ay+13}" width="${aw-18}" height="13" rx="1.5" fill="#dfe8db" stroke="#a7b3a0" stroke-width="0.7"/>`;
    s+=`<text x="${acx-6}" y="${ay+23}" font-size="8" font-weight="700" fill="#2a3d33" opacity="0.1" text-anchor="middle" style="letter-spacing:2px;font-family:monospace">888888</text>`;
    s+=`<text x="${acx-6}" y="${ay+23}" font-size="8" font-weight="700" fill="#2a3d33" text-anchor="middle" style="letter-spacing:2px;font-family:monospace">046321</text>`;
    s+=`<text x="${ax+aw-11}" y="${ay+23}" font-size="4.6" font-weight="700" fill="#2a3d33" text-anchor="end">kWh</text>`;
    /* EAN barcode strip + IR optical port */
    let bxx=ax+9; while(bxx<ax+aw*0.55){ const bw=(bxx*7)%3===0?1.6:0.8; s+=`<rect x="${bxx}" y="${ay+42}" width="${bw}" height="6" fill="#33475f"/>`; bxx+=bw+((bxx*13)%2)+1; }
    s+=`<circle cx="${ax+aw-14}" cy="${ay+45}" r="3.2" fill="#5a2a1a" stroke="#3a1a10" stroke-width="0.7"/><circle cx="${ax+aw-15}" cy="${ay+44}" r="1" fill="#a86a4a" opacity="0.7"/>`;
    s+=lab(ax+aw-14,ay+53,'IR port');
    s+=`<circle cx="${ax+13}" cy="${ay+33}" r="3" fill="#3a3f45"/><circle cx="${ax+13}" cy="${ay+33}" r="1.2" fill="#c04040"><animate attributeName="opacity" values="1;0.2;1" dur="1.4s" repeatCount="indefinite"/></circle>`;
    s+=lab(ax+13,ay+38.5,'pulse');
    s+=`<circle cx="${acx+4}" cy="${ay+33}" r="2.4" fill="#c6cbd2" stroke="#7a828d" stroke-width="0.7"/><circle cx="${acx+11}" cy="${ay+33}" r="1.9" fill="#d4b34a" stroke="#a8842a" stroke-width="0.6"/>`;
    s+=lab(acx+8,ay+38.5,'seals');
    /* main switch DIN module */
    const my=ay+mh+7;
    s+=`<rect x="${ax+8}" y="${my}" width="${aw-16}" height="22" rx="2.5" fill="#f7f9fb" stroke="#a7adb6" stroke-width="0.9"/>`;
    s+=`<rect x="${ax+aw-30}" y="${my+4}" width="14" height="14" rx="2" fill="#2f9e4f"/><text x="${ax+aw-23}" y="${my+13.5}" font-size="6.6" font-weight="800" fill="#fff" text-anchor="middle">I</text>`;
    s+=`<text x="${ax+14}" y="${my+14}" font-size="6.2" font-weight="700" fill="#33475f">63A MAIN</text>`;
    /* earth reference symbol */
    const ey=bl.y+bl.h-13;
    s+=`<line x1="${acx}" y1="${ey-7}" x2="${acx}" y2="${ey}" stroke="#6b7280" stroke-width="1.6"/>`;
    s+=`<line x1="${acx-9}" y1="${ey}" x2="${acx+9}" y2="${ey}" stroke="#25a85a" stroke-width="2"/><line x1="${acx-5.5}" y1="${ey+3}" x2="${acx+5.5}" y2="${ey+3}" stroke="#25a85a" stroke-width="1.6"/><line x1="${acx-2.5}" y1="${ey+6}" x2="${acx+2.5}" y2="${ey+6}" stroke="#25a85a" stroke-width="1.4"/>`;
    s+=lab(acx+22,ey+2,'earth');
  }
  else if(bl.key==='outdoor'){
    /* condenser coil fins across the back */
    for(let fx=ax+3; fx<ax+aw-3; fx+=4) s+=`<line x1="${fx}" y1="${ay+2}" x2="${fx}" y2="${bl.y+bl.h-32}" stroke="#b9c2cc" stroke-width="1"/>`;
    s+=`<rect x="${ax+2}" y="${ay+1}" width="${aw-4}" height="${bl.h-(ay-bl.y)-33}" fill="none" stroke="#9aa1ab" stroke-width="0.8"/>`;
    s+=lab(ax+aw-14,ay-2,'coil','#7a8ba0');
    /* copper return bends on the coil edge (ref photo) */
    for(let i=0;i<3;i++){ const by=ay+9+i*13; s+=`<path d="M ${ax+aw-5} ${by} a 4.6 4.6 0 0 1 0 9.2" fill="none" stroke="#8a531f" stroke-width="3.4"/><path d="M ${ax+aw-5} ${by} a 4.6 4.6 0 0 1 0 9.2" fill="none" stroke="#e0a25e" stroke-width="1.5"/>`; }
    /* guarded axial fan with airfoil blades */
    const fr=Math.max(15,Math.min(aw,60)*0.36), fy=ay+fr+6;
    s+=`<circle cx="${acx}" cy="${fy}" r="${fr+5}" fill="url(#acFanRad)" stroke="#565e69" stroke-width="1.4"/>`;
    const spin=st.running?`<animateTransform attributeName="transform" type="rotate" from="0 ${acx} ${fy}" to="360 ${acx} ${fy}" dur="0.55s" repeatCount="indefinite"/>`:'';
    s+=`<g>${spin}`;
    for(let k=0;k<3;k++) s+=`<path d="M ${acx} ${fy} Q ${acx+fr*0.75} ${fy-fr*0.55} ${acx+fr*0.55} ${fy-fr*0.9} Q ${acx+fr*0.1} ${fy-fr*0.62} ${acx} ${fy} Z" fill="#c7ccd3" transform="rotate(${k*120} ${acx} ${fy})"/>`;
    s+=`<circle cx="${acx}" cy="${fy}" r="3.6" fill="#dfe3e8" stroke="#7c848f" stroke-width="0.8"/></g>`;
    for(let i=1;i<=3;i++) s+=`<circle cx="${acx}" cy="${fy}" r="${(fr*i/3+2).toFixed(1)}" fill="none" stroke="#8f97a1" stroke-width="0.8"/>`;
    s+=`<line x1="${acx-fr-4}" y1="${fy}" x2="${acx+fr+4}" y2="${fy}" stroke="#8f97a1" stroke-width="0.8"/><line x1="${acx}" y1="${fy-fr-4}" x2="${acx}" y2="${fy+fr+4}" stroke="#8f97a1" stroke-width="0.8"/>`;
    s+=lab(acx,fy-fr-8,'fan guard');
    /* rating plate + service valve caps */
    for(let hx=ax+6; hx<ax+aw-6; hx+=7) s+=`<circle cx="${hx}" cy="${bl.y+bl.h-30}" r="0.9" fill="#8f97a1"/>`;
    s+=`<rect x="${ax+4}" y="${bl.y+bl.h-27}" width="22" height="10" rx="1.5" fill="#e8ebef" stroke="#9aa1ab" stroke-width="0.6"/>`;
    s+=`<line x1="${ax+7}" y1="${bl.y+bl.h-23.5}" x2="${ax+23}" y2="${bl.y+bl.h-23.5}" stroke="#9aa1ab" stroke-width="0.7"/><line x1="${ax+7}" y1="${bl.y+bl.h-20.5}" x2="${ax+19}" y2="${bl.y+bl.h-20.5}" stroke="#9aa1ab" stroke-width="0.7"/>`;
    /* compressor pod (dashed link runs from here to the pot below) */
    s+=`<rect x="${acx-16}" y="${bl.y+bl.h-27}" width="32" height="18" rx="6" fill="#2c3644" stroke="#1b222c" stroke-width="1"/>`;
    s+=`<text x="${acx}" y="${bl.y+bl.h-15}" font-size="5.2" font-weight="700" fill="#dfe7f2" text-anchor="middle" style="pointer-events:none">COMP \u2193</text>`;
  }
  else if(bl.key==='indoor'){
    /* curved white casing */
    s+=`<path d="M ${ax+2} ${ay+3} Q ${acx} ${ay-4} ${ax+aw-2} ${ay+3}" fill="none" stroke="#d3d8de" stroke-width="1.6"/>`;
    /* intake filter mesh */
    for(let i=0;i<3;i++){ const ly=ay+4+i*3.6; s+=`<line x1="${ax+4}" y1="${ly}" x2="${ax+aw-4}" y2="${ly}" stroke="#c3cad2" stroke-width="1.2"/>`; }
    for(let hx=ax+8; hx<ax+aw-6; hx+=9) s+=`<line x1="${hx}" y1="${ay+3}" x2="${hx}" y2="${ay+11.5}" stroke="#d7dce2" stroke-width="0.7"/>`;
    s+=lab(acx,ay-1,'intake \u00b7 filter');
    /* evaporator coil */
    const cyTop=ay+15;
    s+=`<rect x="${ax+4}" y="${cyTop}" width="${aw-8}" height="12" fill="#e6eef4" stroke="#b6c2cc" stroke-width="0.8"/>`;
    for(let hx=ax+4; hx<ax+aw-8; hx+=4.5) s+=`<line x1="${hx}" y1="${cyTop+1}" x2="${hx+4.5}" y2="${cyTop+11}" stroke="#9fb3c8" stroke-width="0.8"/>`;
    s+=lab(ax+aw-10,cyTop+9,'coil','#7a8ba0');
    /* cross-flow blower roller */
    const ry0=cyTop+17, rh=13;
    s+=`<rect x="${ax+5}" y="${ry0}" width="${aw-10}" height="${rh}" rx="${rh/2}" fill="url(#acRoll)" stroke="#7f8894" stroke-width="0.9"/>`;
    for(let i=0;i<3;i++){ const ly=ry0+3+i*3.4;
      s+=`<line x1="${ax+8}" y1="${ly}" x2="${ax+aw-8}" y2="${ly}" stroke="#6d7885" stroke-width="0.8" stroke-dasharray="3 3">${st.running?`<animate attributeName="stroke-dashoffset" values="0;-12" dur="0.5s" repeatCount="indefinite"/>`:''}</line>`; }
    s+=lab(acx,ry0+rh+7,'cross-flow blower');
    /* display pod + status LED */
    s+=`<rect x="${ax+aw-22}" y="${ry0+rh+10}" width="18" height="9" rx="2" fill="#0d1420" stroke="#8a919b" stroke-width="0.6"/>`;
    s+=`<text x="${ax+aw-13}" y="${ry0+rh+16.8}" font-size="4.8" font-weight="700" fill="${st.running?'#63d6f0':'#3a4658'}" text-anchor="middle">21.5</text>`;
    s+=`<circle cx="${ax+9}" cy="${ry0+rh+14.5}" r="1.8" fill="${st.running?'#5fd394':'#8a919b'}"/>`;
    /* drain tray + louvre with air stream */
    s+=`<rect x="${ax+3}" y="${bl.y+bl.h-22}" width="${aw-6}" height="4" rx="2" fill="#cfd6dd" stroke="#9aa1ab" stroke-width="0.6"/>`;
    s+=lab(ax+16,bl.y+bl.h-24,'drain tray','#7a8ba0');
    s+=`<rect x="${ax+3}" y="${bl.y+bl.h-14}" width="${aw-6}" height="7" rx="3" fill="#c4cad2" stroke="#9aa1ab" stroke-width="0.8"/>`;
    s+=`<line x1="${ax+8}" y1="${bl.y+bl.h-10.5}" x2="${ax+aw-8}" y2="${bl.y+bl.h-10.5}" stroke="#8a919b" stroke-width="0.7"/>`;
    if(st.running) for(let i=0;i<3;i++){ const vx=ax+10+i*((aw-20)/2); s+=`<path d="M ${vx} ${bl.y+bl.h-4} q 3 6 0 12" stroke="#63b3ed" stroke-width="1.3" fill="none" opacity="0.65"><animate attributeName="opacity" values="0.65;0.15;0.65" dur="1.2s" repeatCount="indefinite" begin="${i*0.3}s"/></path>`; }
  }
  /* terminal rails on whichever sides carry screws (unchanged geometry) */
  ['L','R'].forEach(side=>{
    const col=terms.filter(t=>t.side===side); if(!col.length) return;
    const xs=col[0].x, y0=Math.min(...col.map(t=>t.y))-15, y1=Math.max(...col.map(t=>t.y))+11;
    s+=`<rect x="${xs-9}" y="${y0}" width="18" height="${y1-y0}" rx="3" fill="#e9e2cf" stroke="#b9ad91"/>`;
    col.forEach((t,i)=>{ s+=`<line x1="${xs-9}" y1="${t.y+15.5}" x2="${xs+9}" y2="${t.y+15.5}" stroke="#cfc4a8" stroke-width="0.8"/>`; });
    s+=`<rect x="${xs-9}" y="${y0}" width="18" height="10" rx="2" fill="#33475f"/>`;
    s+=`<text x="${xs}" y="${y0+7}" font-size="4.4" font-weight="700" fill="#dfe7f2" text-anchor="middle">TERMS</text>`;
  });
  return s;
}

function acUnitArtLegacy(bl,T,st){
  let s='';
  const terms=Object.values(T).filter(t=>t.block===bl.key);
  const sides=new Set(terms.map(t=>t.side));
  s+=`<rect x="${bl.x+1.5}" y="${bl.y+2.5}" width="${bl.w}" height="${bl.h}" rx="10" fill="#000" opacity="0.1"/>`;
  s+=`<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" rx="10" fill="#f1f4f8" stroke="#adb4be" stroke-width="1.4"/>`;
  s+=`<path d="M ${bl.x} ${bl.y+20} V ${bl.y+11} Q ${bl.x} ${bl.y} ${bl.x+11} ${bl.y} H ${bl.x+bl.w-11} Q ${bl.x+bl.w} ${bl.y} ${bl.x+bl.w} ${bl.y+11} V ${bl.y+20} Z" fill="#33475f"/>`;
  s+=`<text x="${bl.x+bl.w/2}" y="${bl.y+14}" font-size="9.5" font-weight="700" fill="#eef4fb" text-anchor="middle">${bl.title}</text>`;
  const padL=sides.has('L')?20:10, padR=sides.has('R')?20:10;
  const ax=bl.x+padL, aw=bl.w-padL-padR, acx=ax+aw/2, ay=bl.y+26;
  const wide=aw>=62;
  const lab=(x,y,t,col)=>wide?`<text x="${x}" y="${y}" font-size="5.3" fill="${col||'#5a6472'}" text-anchor="middle" style="pointer-events:none">${t}</text>`:'';
  if(bl.key==='supply'){
    s+=`<rect x="${ax+3}" y="${ay}" width="${aw-6}" height="${bl.h-(ay-bl.y)-8}" rx="5" fill="#e7ebf0" stroke="#c2c8d0"/>`;
    s+=`<circle cx="${acx}" cy="${ay+18}" r="13" fill="#f7f9fb" stroke="#b6bcc4"/>`;
    s+=`<text x="${acx}" y="${ay+16}" font-size="7.5" font-weight="700" fill="#1c6b34" text-anchor="middle">230V~</text>`;
    s+=lab(acx,ay+26,'kWh meter');
    s+=`<rect x="${ax+8}" y="${ay+34}" width="${aw-16}" height="13" rx="2" fill="#33475f"/>`;
    s+=`<rect x="${ax+aw-24}" y="${ay+36}" width="10" height="9" rx="1.5" fill="#25a85a"/>`;
    s+=lab(acx,ay+56,'main switch');
    const ey=bl.y+bl.h-13;
    s+=`<line x1="${acx}" y1="${ey-6}" x2="${acx}" y2="${ey}" stroke="#6b7280" stroke-width="1.6"/>`;
    s+=`<line x1="${acx-9}" y1="${ey}" x2="${acx+9}" y2="${ey}" stroke="#25a85a" stroke-width="2"/><line x1="${acx-5.5}" y1="${ey+3}" x2="${acx+5.5}" y2="${ey+3}" stroke="#25a85a" stroke-width="1.6"/><line x1="${acx-2.5}" y1="${ey+6}" x2="${acx+2.5}" y2="${ey+6}" stroke="#25a85a" stroke-width="1.4"/>`;
  } else if(bl.key==='outdoor'){
    for(let fx=ax+3; fx<ax+aw-3; fx+=5) s+=`<line x1="${fx}" y1="${ay}" x2="${fx}" y2="${bl.y+bl.h-30}" stroke="#c6cfd9" stroke-width="1"/>`;
    const fr=Math.max(13,Math.min(aw,58)*0.34), fy=ay+fr+2;
    s+=`<circle cx="${acx}" cy="${fy}" r="${fr+4}" fill="#2b323c" stroke="#5b626d" stroke-width="1.4"/>`;
    for(let i=1;i<=3;i++) s+=`<circle cx="${acx}" cy="${fy}" r="${(fr*i/3).toFixed(1)}" fill="none" stroke="#7c848f" stroke-width="0.7"/>`;
    const spin=st.running?`<animateTransform attributeName="transform" type="rotate" from="0 ${acx} ${fy}" to="360 ${acx} ${fy}" dur="0.5s" repeatCount="indefinite"/>`:'';
    s+=`<g>${spin}`;
    for(let k=0;k<4;k++) s+=`<ellipse cx="${acx}" cy="${(fy-fr*0.48).toFixed(1)}" rx="${(fr*0.16).toFixed(1)}" ry="${(fr*0.48).toFixed(1)}" fill="#c7ccd3" transform="rotate(${k*90} ${acx} ${fy})"/>`;
    s+=`<circle cx="${acx}" cy="${fy}" r="3.4" fill="#dfe3e8"/></g>`;
    s+=lab(acx,fy-fr-5,'fan');
    s+=lab(ax+aw-9,ay-3,'condenser coil','#8a9bb0');
    s+=`<rect x="${acx-15}" y="${bl.y+bl.h-26}" width="30" height="17" rx="6" fill="#3a4048" stroke="#252a31"/>`;
    s+=`<text x="${acx}" y="${bl.y+bl.h-14.5}" font-size="5" font-weight="700" fill="#dfe7f2" text-anchor="middle" style="pointer-events:none">COMP</text>`;
  } else if(bl.key==='indoor'){
    for(let i=0;i<3;i++){ const ly=ay+i*4.5; s+=`<line x1="${ax+3}" y1="${ly}" x2="${ax+aw-3}" y2="${ly}" stroke="#aeb5bf" stroke-width="1.5"/>`; }
    s+=lab(acx,ay-3,'air intake / filter');
    const cyTop=ay+11;
    s+=`<rect x="${ax+3}" y="${cyTop}" width="${aw-6}" height="12" fill="#eaf1f6" stroke="#b6c2cc"/>`;
    for(let hx=ax+3; hx<ax+aw-6; hx+=5) s+=`<line x1="${hx}" y1="${cyTop+1}" x2="${hx+5}" y2="${cyTop+11}" stroke="#9fb3c8" stroke-width="0.8"/>`;
    s+=lab(ax+aw-8,cyTop+9,'coil','#8a9bb0');
    const bx=acx, by=cyTop+24;
    s+=`<circle cx="${bx}" cy="${by}" r="8" fill="#dfe4ea" stroke="#adb4be"/>`;
    const bspin=st.running?`<animateTransform attributeName="transform" type="rotate" from="0 ${bx} ${by}" to="360 ${bx} ${by}" dur="0.6s" repeatCount="indefinite"/>`:'';
    s+=`<g>${bspin}`; for(let k=0;k<8;k++) s+=`<line x1="${bx}" y1="${by}" x2="${bx}" y2="${by-7}" stroke="#9aa1ab" stroke-width="1" transform="rotate(${k*45} ${bx} ${by})"/>`; s+=`</g>`;
    s+=lab(bx,by+14,'blower fan');
    s+=`<circle cx="${ax+aw-6}" cy="${ay+2}" r="2" fill="${st.running?'#25a85a':'#b6bcc4'}"/>`;
    s+=`<rect x="${ax+3}" y="${bl.y+bl.h-14}" width="${aw-6}" height="7" rx="3" fill="#c4cad2" stroke="#9aa1ab"/>`;
    if(st.running) for(let i=0;i<3;i++){ const vx=ax+10+i*((aw-20)/2); s+=`<path d="M ${vx} ${bl.y+bl.h-4} q 3 6 0 12" stroke="#25a85a" stroke-width="1.2" fill="none" opacity="0.6"/>`; }
  }
  ['L','R'].forEach(side=>{
    const col=terms.filter(t=>t.side===side); if(!col.length) return;
    const xs=col[0].x, y0=Math.min(...col.map(t=>t.y))-15, y1=Math.max(...col.map(t=>t.y))+11;
    s+=`<rect x="${xs-9}" y="${y0}" width="18" height="${y1-y0}" rx="3" fill="#e9e2cf" stroke="#b9ad91"/>`;
    col.forEach((t,i)=>{ s+=`<line x1="${xs-9}" y1="${t.y+15.5}" x2="${xs+9}" y2="${t.y+15.5}" stroke="#cfc4a8" stroke-width="0.8"/>`; });
    s+=`<rect x="${xs-9}" y="${y0}" width="18" height="10" rx="2" fill="#33475f"/>`;
    s+=`<text x="${xs}" y="${y0+7}" font-size="4.4" font-weight="700" fill="#dfe7f2" text-anchor="middle">TERMS</text>`;
  });
  return s;
}

function acSteps(){
  const {find}=acNets(); const linked=(a,c)=>find(a)===find(c);
  const pairs=acCorrect();
  const isInter=([a,c])=>{const A=a.split(':')[0],C=c.split(':')[0]; return (A==='outdoor'&&C==='indoor')||(A==='indoor'&&C==='outdoor');};
  const supply=pairs.filter(p=>!isInter(p)), inter=pairs.filter(isInter);
  const chk=checkACWiring();
  const mi=checkACInstall(); const ins=state.acBench.install;
  return [
    {done: supply.length>0 && supply.every(([a,c])=>linked(a,c)), label:'Feed the supply to the unit (L, N, earth)'},
    {done: inter.length>0 && inter.every(([a,c])=>linked(a,c)), label:'Interconnect outdoor \u2194 indoor'},
    {done: state.acBench.wires.length>0 && !chk.items.some(i=>i.level==='danger'), label:'No shorts \u2014 earth connected'},
    {done: chk.allCorrect, label:'Wiring correct'},
    {done: mi.liquid&&mi.gas&&!mi.crossed, label:'Refrigerant lines connected (liquid + gas)'},
    {done: ins.insul, label:'Copper lines insulated'},
    {done: mi.drain&&ins.slope==='down', label:'Drain fitted & falling downhill'},
    {done: ins.vacuum, label:'Vacuum pulled'},
    {done: ins.valves&&ins.vacuum, label:'Service valves opened \u2014 ready to run'}
  ];
}

function renderACTab(){
  const wrap=document.getElementById('acWrap');
  const b=state.acBench; const std=AC_STD[b.standard];
  if(!b.install) b.install={lines:[],selPort:null,slope:'none',insul:false,gauges:false,vacuum:false,valves:false};
  const ins=b.install;
  const {T,blocks,ports,three,lns,W}=acLayout();
  const chk=checkACWiring();
  const pipeBottom=(blocks._pipeY||0)+70;
  const OW=W, OH=Math.max(Math.max(...blocks.map(bl=>bl.y+bl.h)), pipeBottom)+30;

  // svg
  let svg=`<svg id="acSvg" viewBox="0 0 ${OW} ${OH}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;max-width:${OW}px;display:block;margin:0 auto" xmlns="http://www.w3.org/2000/svg">`;
  svg+=`<defs>
    <linearGradient id="acStage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbd2dc"/><stop offset="1" stop-color="#b1bac6"/></linearGradient>
    <linearGradient id="acSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd4e8"/><stop offset="1" stop-color="#e9f2f8"/></linearGradient>
    <linearGradient id="acGround" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a3b489"/><stop offset="1" stop-color="#7e9166"/></linearGradient>
    <linearGradient id="acRoomA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0e4ea"/><stop offset="1" stop-color="#ccd2da"/></linearGradient>
    <linearGradient id="acRoomB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ede5d7"/><stop offset="1" stop-color="#dbd0bd"/></linearGradient>
    <linearGradient id="acCaseG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="0.55" stop-color="#dfe3e8"/><stop offset="1" stop-color="#c3c9d1"/></linearGradient>
    <radialGradient id="acFanRad" cx="0.5" cy="0.45" r="0.7"><stop offset="0" stop-color="#2b313a"/><stop offset="1" stop-color="#14181e"/></radialGradient>
    <linearGradient id="acPotG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#232a33"/><stop offset="0.45" stop-color="#4a545f"/><stop offset="1" stop-color="#10141a"/></linearGradient>
    <linearGradient id="acRoll" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd6dd"/><stop offset="1" stop-color="#8f98a2"/></linearGradient>
    <linearGradient id="acZinc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#dde2e7"/><stop offset="0.5" stop-color="#b0b8c1"/><stop offset="1" stop-color="#8f98a2"/></linearGradient>
    <linearGradient id="acBrassBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecd07c"/><stop offset="1" stop-color="#b98f2e"/></linearGradient>
    <pattern id="acBrick" width="26" height="16" patternUnits="userSpaceOnUse"><rect width="26" height="16" fill="#c8b49c"/><path d="M0 0 H26 M0 8 H26 M0 16 H26 M13 0 V8 M0 8 V16 M26 8 V16" stroke="#a08a70" stroke-width="1" fill="none"/></pattern>
  </defs>`;
  svg+=`<rect x="0" y="0" width="${OW}" height="${OH}" fill="url(#acStage)"/>`;
  svg+=acSceneArt(blocks,OW,OH,lns);
  // blocks
  const st=acSystemState();
  const guide=!!b.guide; const gstep=guide?acNextStep():null;
  const hi = gstep? new Set([gstep.from, gstep.to]) : null;
  // DIN rail behind the protective devices
  const din=blocks.filter(bl=>bl.key==='rccb'||bl.key==='iso');
  if(din.length){
    const x0=Math.min(...din.map(d=>d.x))-16, x1=Math.max(...din.map(d=>d.x+d.w))+16, ry=din[0].y-24;
    svg+=`<rect x="${x0}" y="${ry}" width="${x1-x0}" height="13" rx="2" fill="url(#metalGrad)" stroke="#5a6572"/>`;
    svg+=`<rect x="${x0}" y="${ry+8}" width="${x1-x0}" height="5" fill="#0c1422" opacity="0.35"/>`;
    svg+=`<text x="${(x0+x1)/2}" y="${ry+21.5}" font-size="6.5" fill="#5d7396" text-anchor="middle">DIN RAIL</text>`;
  }
  blocks.forEach(bl=>{
    if(bl.compressor){ svg+=acCompressorArt(bl,st,b); return; }
    if(false){ /* legacy compressor art kept for reference */
      const live = st.liveCasing;
      const tripped = st.tripped && (b.comp==='ground'||b.comp==='shorted'||b.comp==='seized');
      const cxc=bl.x+bl.w/2, domeCy=bl.y+76;
      svg+=`<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" rx="12" fill="url(#applGrad)" stroke="${(tripped||live)?'#e0473c':'#2a3344'}" stroke-width="${live?2.4:1.5}"/>`;
      svg+=`<text x="${cxc}" y="${bl.y+14}" font-size="10" font-weight="700" fill="#cfe0f5" text-anchor="middle">COMPRESSOR</text>`;
      // Fusite terminal plate around C/R/S
      svg+=`<rect x="${bl.x+16}" y="${bl.y+30}" width="${bl.w-32}" height="20" rx="5" fill="#1a222e" stroke="#3a4658"/>`;
      // hermetic dome
      svg+=`<ellipse cx="${cxc}" cy="${domeCy}" rx="30" ry="22" fill="#0c1016"/>`;
      svg+=`<ellipse cx="${cxc}" cy="${domeCy}" rx="30" ry="22" fill="url(#domeGrad)"/>`;
      svg+=`<ellipse cx="${cxc-6}" cy="${domeCy-8}" rx="16" ry="7" fill="#ffffff" opacity="0.07"/>`;
      if(st.running) svg+=`<g><animateTransform attributeName="transform" type="rotate" from="0 ${cxc} ${domeCy}" to="360 ${cxc} ${domeCy}" dur="0.7s" repeatCount="indefinite"/><line x1="${cxc}" y1="${domeCy}" x2="${cxc}" y2="${domeCy-15}" stroke="#5fd394" stroke-width="2.4"/></g>`;
      const badge=b.comp==='none'?['#43b25f','OK']:(tripped?['#e0473c','FAULT']:['#f0a830','FAULT']);
      svg+=`<text x="${cxc}" y="${domeCy+16}" font-size="8" font-weight="700" fill="${badge[0]}" text-anchor="middle" style="pointer-events:none">${badge[1]}</text>`;
      // earth/ground lug tab at the shell (CASE)
      svg+=`<rect x="${cxc-8}" y="${bl.y+bl.h-19}" width="16" height="9" rx="1.5" fill="url(#metalGrad)" stroke="#5a6572"/>`;
      if(live) svg+=`<text x="${cxc}" y="${domeCy-1}" font-size="7.5" font-weight="800" fill="#e0473c" text-anchor="middle" style="pointer-events:none">CASE LIVE \u26A1</text>`;
      // run capacitor cylinder (right)
      const capx=bl.x+bl.w-12, capTop=bl.y+26;
      svg+=`<rect x="${capx-7}" y="${capTop}" width="14" height="28" rx="4" fill="#28323f" stroke="#4a586c"/>`;
      svg+=`<rect x="${capx-7}" y="${capTop}" width="14" height="5" rx="2.5" fill="#c9a86a"/>`;
      svg+=`<text x="${capx}" y="${capTop+19}" font-size="6.5" fill="#9fb0c4" text-anchor="middle" transform="rotate(90 ${capx} ${capTop+19})">CAP</text>`;
      if(b.comp==='ground') svg+=`<path d="M ${cxc+14} ${domeCy+6} L ${cxc} ${bl.y+bl.h-16}" stroke="#e0473c" stroke-width="1.6" stroke-dasharray="3 3" fill="none"><animate attributeName="opacity" values="1;0.2;1" dur="0.5s" repeatCount="indefinite"/></path>`;
      return;
    }
    if(bl.key==='rccb'||bl.key==='iso'){ svg+=acDinModuleArt(bl,st,b); return; }
    if(false){ /* legacy DIN module art kept for reference */
      const trip = bl.key==='rccb' && st.tripped && b.comp==='ground';
      svg+=`<rect x="${bl.x+1.5}" y="${bl.y+2.5}" width="${bl.w}" height="${bl.h}" rx="4" fill="#000" opacity="0.12"/>`;
      svg+=`<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="${bl.h}" rx="4" fill="#f7f9fb" stroke="#9aa1ab" stroke-width="1.3"/>`;
      svg+=`<rect x="${bl.x}" y="${bl.y}" width="${bl.w}" height="15" rx="4" fill="#33475f"/>`;
      svg+=`<text x="${bl.x+bl.w/2}" y="${bl.y+11}" font-size="8" font-weight="700" fill="#eef4fb" text-anchor="middle">${bl.title}</text>`;
      svg+=`<rect x="${bl.x+6}" y="${bl.y+bl.h-15}" width="${bl.w-12}" height="9" rx="2" fill="#dfe4ea" stroke="#c2c8d0" stroke-width="0.6"/>`;
      if(bl.key==='rccb'){
        svg+=`<rect x="${bl.x+8}" y="${bl.y+21}" width="15" height="12" rx="2" fill="#2b6fe0"/><text x="${bl.x+15.5}" y="${bl.y+30}" font-size="8" font-weight="700" fill="#fff" text-anchor="middle">T</text>`;
        const lvy = trip? bl.y+38 : bl.y+22;
        svg+=`<rect x="${bl.x+bl.w-25}" y="${bl.y+21}" width="18" height="27" rx="3" fill="#c9d0d9"/>`;
        svg+=`<rect x="${bl.x+bl.w-23}" y="${lvy}" width="14" height="12" rx="2" fill="${trip?'#e0473c':'#2b6fe0'}"/>`;
        svg+=`<text x="${bl.x+bl.w/2}" y="${bl.y+bl.h-7}" font-size="7" font-weight="700" fill="#25324a" text-anchor="middle">30mA</text>`;
        if(trip) svg+=`<text x="${bl.x+bl.w/2}" y="${bl.y+19}" font-size="7" font-weight="800" fill="#e0473c" text-anchor="middle">TRIPPED</text>`;
      } else {
        svg+=`<rect x="${bl.x+bl.w/2-20}" y="${bl.y+22}" width="16" height="30" rx="3" fill="#c9d0d9"/><rect x="${bl.x+bl.w/2-18}" y="${bl.y+24}" width="12" height="13" rx="2" fill="#e0473c"/>`;
        svg+=`<rect x="${bl.x+bl.w/2+4}" y="${bl.y+22}" width="16" height="30" rx="3" fill="#c9d0d9"/><rect x="${bl.x+bl.w/2+6}" y="${bl.y+24}" width="12" height="13" rx="2" fill="#23272e"/>`;
        svg+=`<text x="${bl.x+bl.w/2}" y="${bl.y+bl.h-7}" font-size="7" font-weight="700" fill="#25324a" text-anchor="middle">ON</text>`;
      }
      return;
    }
    // supply / outdoor / indoor drawn as recognizable equipment
    svg+=acUnitArt(bl,T,st);
  });
  // wires (draw first, under terminals)
  b.wires.forEach(w=>{
    const a=T[w.from], c=T[w.to]; if(!a||!c) return;
    const sel=b.selWire===w.id;
    const bad=chk.items.some(it=>it.level==='danger'&&(it.wireIds||[]).includes(w.id));
    const midx=(a.x+c.x)/2;
    const path=`M ${a.x} ${a.y} C ${midx} ${a.y}, ${midx} ${c.y}, ${c.x} ${c.y}`;
    if(bad) svg+=`<path d="${path}" fill="none" stroke="#e0473c" stroke-width="9" opacity="0.55"><animate attributeName="opacity" values="0.55;0.12;0.55" dur="0.6s" repeatCount="indefinite"/></path>`;
    if(sel) svg+=`<path d="${path}" fill="none" stroke="#f0a830" stroke-width="9" opacity="0.55"/>`;
    svg+=`<path d="${path}" fill="none" stroke="#2c333c" stroke-width="6.6" stroke-linecap="round" opacity="0.85" style="pointer-events:none"/>`;
    svg+=`<path class="acw" data-acwire="${w.id}" d="${path}" fill="none" stroke="${w.color}" stroke-width="3.8" stroke-linecap="round" style="cursor:pointer"/>`;
    svg+=`<path d="${path}" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.22" style="pointer-events:none"/>`;
    if(w.color==='#3fae5a') svg+=`<path d="${path}" fill="none" stroke="#f2c200" stroke-width="1.5" stroke-dasharray="5 6" style="pointer-events:none"/>`;
    if(Math.abs(a.x-c.x)+Math.abs(a.y-c.y)>70){
      const tang=Math.atan2(1.5*(c.y-a.y),0.75*(c.x-a.x))*180/Math.PI;
      svg+=`<g transform="translate(${(a.x+c.x)/2} ${(a.y+c.y)/2}) rotate(${tang.toFixed(1)})" style="pointer-events:none"><rect x="-1.7" y="-5.4" width="3.4" height="10.8" rx="1.3" fill="#141b24" opacity="0.9"/><rect x="-1.7" y="-5.4" width="3.4" height="2.6" rx="1" fill="#33404f"/></g>`;
    }
  });
  // terminals
  const m=b.meter||{};
  Object.values(T).forEach(t=>{
    const sel=b.sel===t.id;
    const isA=m.a===t.id, isB=m.b===t.id;
    const col = t.role==='comp'?'#c9a86a' : t.role==='neutral'?std.N : t.role==='earth'?std.PE : t.role==='signal'?std.S : (t.label==='L2'?std.L2:t.label==='L3'?std.L3:std.L1);
    const lx = t.side==='L'? t.x+11 : t.side==='R'? t.x-11 : t.x; const anc=t.side==='L'?'start':t.side==='R'?'end':'middle';
    const ly = t.side==='T'? t.y-12 : t.side==='B'? t.y+15 : t.y+3.2;
    // crimp ferrule where a conductor lands
    const wired=b.wires.find(w=>w.from===t.id||w.to===t.id);
    if(wired){
      if(t.side==='R') svg+=`<rect x="${t.x+3}" y="${t.y-1.6}" width="4" height="3.2" fill="#c9d0d7" stroke="#7f8894" stroke-width="0.4"/><rect x="${t.x+6}" y="${t.y-3.5}" width="8" height="7" rx="2.4" fill="${wired.color}" stroke="#0c1422" stroke-width="0.6"/>`;
      else if(t.side==='L') svg+=`<rect x="${t.x-7}" y="${t.y-1.6}" width="4" height="3.2" fill="#c9d0d7" stroke="#7f8894" stroke-width="0.4"/><rect x="${t.x-14}" y="${t.y-3.5}" width="8" height="7" rx="2.4" fill="${wired.color}" stroke="#0c1422" stroke-width="0.6"/>`;
      else if(t.side==='T') svg+=`<rect x="${t.x-1.6}" y="${t.y-7}" width="3.2" height="4" fill="#c9d0d7" stroke="#7f8894" stroke-width="0.4"/><rect x="${t.x-3.5}" y="${t.y-14}" width="7" height="8" rx="2.4" fill="${wired.color}" stroke="#0c1422" stroke-width="0.6"/>`;
      else svg+=`<rect x="${t.x-1.6}" y="${t.y+3}" width="3.2" height="4" fill="#c9d0d7" stroke="#7f8894" stroke-width="0.4"/><rect x="${t.x-3.5}" y="${t.y+6}" width="7" height="8" rx="2.4" fill="${wired.color}" stroke="#0c1422" stroke-width="0.6"/>`;
    }
    // terminal well + metal screw with cross slot
    svg+=`<rect x="${t.x-7}" y="${t.y-7}" width="14" height="14" rx="3" fill="#e7ebf0" stroke="#adb4be"/>`;
    svg+=`<circle cx="${t.x}" cy="${t.y}" r="6" fill="#c6cbd2" stroke="${isA?'#e0473c':isB?'#1d6fd6':sel?'#e08a1a':'#7a828d'}" stroke-width="${(isA||isB||sel)?2.6:1.3}"/>`;
    svg+=`<path d="M ${t.x-3.3} ${t.y} H ${t.x+3.3} M ${t.x} ${t.y-3.3} V ${t.y+3.3}" stroke="#5c636c" stroke-width="1.1" style="pointer-events:none"/>`;
    svg+=`<circle cx="${t.x+4.7}" cy="${t.y-4.7}" r="2.5" fill="${col}" stroke="#ffffff" stroke-width="0.7" style="pointer-events:none"/>`;
    if(isA||isB) svg+=`<circle cx="${t.x}" cy="${t.y}" r="10.5" fill="none" stroke="${isA?'#e0473c':'#1d6fd6'}" stroke-width="1.8" style="pointer-events:none"/>`;
    if(hi&&hi.has(t.id)) svg+=`<circle cx="${t.x}" cy="${t.y}" r="12" fill="none" stroke="#f0a830" stroke-width="2.6" style="pointer-events:none"><animate attributeName="r" values="11;16;11" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite"/></circle>`;
    svg+=`<circle data-acterm="${t.id}" cx="${t.x}" cy="${t.y}" r="10" fill="transparent" style="cursor:pointer"/>`;
    svg+=`<text x="${lx}" y="${ly}" font-size="8.5" font-weight="700" fill="${t.block==='comp'?'#eaf1fb':'#20293a'}" text-anchor="${anc}" style="pointer-events:none">${t.label}</text>`;
  });
  // ---- refrigerant pipework + condensate drain zone ----
  if(ports){
    const ins=b.install; const py=blocks._pipeY;
    const ob=blocks.find(x=>x.key==='outdoor'), ib=blocks.find(x=>x.key==='indoor'), cb=blocks.find(x=>x.key==='comp');
    // short stubs tying each port up to its unit
    ['outdoor:LIQ','outdoor:GAS','outdoor:SVC','indoor:LIQ','indoor:GAS','indoor:DRN'].forEach(id=>{ const p=ports[id]; const u=id.split(':')[0]==='outdoor'?ob:ib; if(p&&u) svg+=`<line x1="${p.x}" y1="${u.y+u.h}" x2="${p.x}" y2="${p.y}" stroke="#adb4be" stroke-width="1.4"/>`; });
    // connector from outdoor unit down to the compressor block
    if(ob&&cb) svg+=`<line x1="${ob.x+ob.w*0.5}" y1="${ob.y+ob.h}" x2="${cb.x+cb.w*0.5}" y2="${cb.y}" stroke="#adb4be" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.7"/>`;
    // faint guide showing where the line-set runs (outdoor <-> indoor)
    [['outdoor:LIQ','indoor:LIQ'],['outdoor:GAS','indoor:GAS'],['indoor:DRN','drain:OUT']].forEach(([a,c])=>{ const pa=ports[a],pc=ports[c]; if(pa&&pc && !acLineBetween(a.includes('DRN')?'drain':(a.includes('LIQ')?'liquid':'gas'),a,c)){ const mx=(pa.x+pc.x)/2; svg+=`<path d="M ${pa.x} ${pa.y} C ${mx} ${pa.y+22}, ${mx} ${pc.y+22}, ${pc.x} ${pc.y}" fill="none" stroke="#aab2bd" stroke-width="1.4" stroke-dasharray="3 4" opacity="0.55"/>`; } });
    const lx=ports['outdoor:LIQ'].x, rx=ports['indoor:GAS'].x;
    // pipes
    ins.lines.forEach(l=>{ const a=ports[l.from], c=ports[l.to]; if(!a||!c) return;
      const midx=(a.x+c.x)/2; const path=`M ${a.x} ${a.y} C ${midx} ${a.y+26}, ${midx} ${c.y+26}, ${c.x} ${c.y}`;
      const bad=l.kind==='cross';
      if(bad){ svg+=`<path d="${path}" fill="none" stroke="#e0473c" stroke-width="5" stroke-dasharray="6 4" style="pointer-events:none"><animate attributeName="opacity" values="1;0.3;1" dur="0.6s" repeatCount="indefinite"/></path>`;
        svg+=`<path data-acpipe="${l.id}" d="${path}" fill="none" stroke="transparent" stroke-width="12" style="cursor:pointer"/>`; return; }
      if(l.kind==='drain'){ svg+=`<path d="${path}" fill="none" stroke="#7c848f" stroke-width="8" stroke-linecap="round"/><path d="${path}" fill="none" stroke="#c4cad2" stroke-width="4.5" stroke-linecap="round"/>`;
        svg+=`<path data-acpipe="${l.id}" d="${path}" fill="none" stroke="transparent" stroke-width="12" style="cursor:pointer"/>`; return; }
      const thick=l.kind==='gas'?9:6;
      if(ins.insul) svg+=`<path d="${path}" fill="none" stroke="#dfe3e8" stroke-width="${thick+6}" stroke-linecap="round" opacity="0.95"/>`;
      svg+=`<path d="${path}" fill="none" stroke="#8a531f" stroke-width="${thick}" stroke-linecap="round"/>`;
      svg+=`<path d="${path}" fill="none" stroke="#f3ba76" stroke-width="${Math.max(2,thick-3)}" stroke-linecap="round"/>`;
      svg+=`<path data-acpipe="${l.id}" d="${path}" fill="none" stroke="transparent" stroke-width="${thick+6}" style="cursor:pointer"/>`;
    });
    // ports
    Object.values(ports).forEach(p=>{ const glow=hi&&hi.has(p.id), selp=ins.selPort===p.id;
      const rc=p.role==='drain'?'#8a919b':p.role==='service'?'#3f7fbf':'#c98a4a';
      if(p.role==='service'){
        svg+=`<rect x="${p.x-7}" y="${p.y-7}" width="14" height="14" rx="3" fill="#e7ebf0" stroke="#adb4be"/>`;
        svg+=`<circle cx="${p.x}" cy="${p.y}" r="5.5" fill="${ins.gauges?'#3f7fbf':'#c6cbd2'}" stroke="${selp?'#e08a1a':'#7a828d'}" stroke-width="1.4"/>`;
      } else {
        svg+=`<circle cx="${p.x}" cy="${p.y}" r="7" fill="#e7ebf0" stroke="#adb4be"/>`;
        svg+=`<circle cx="${p.x}" cy="${p.y}" r="4.6" fill="${rc}" stroke="${selp?'#e08a1a':'#7a828d'}" stroke-width="${selp?2.4:1.2}"/>`;
      }
      if(glow) svg+=`<circle cx="${p.x}" cy="${p.y}" r="12" fill="none" stroke="#f0a830" stroke-width="2.6" style="pointer-events:none"><animate attributeName="r" values="11;16;11" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0.25;1" dur="1.1s" repeatCount="indefinite"/></circle>`;
      const below=(p.id==='drain:OUT');
      svg+=`<text x="${p.x}" y="${p.y+(below?16:-11)}" font-size="7" font-weight="700" fill="#20293a" text-anchor="middle" style="pointer-events:none">${p.label}</text>`;
      svg+=`<circle data-acport="${p.id}" cx="${p.x}" cy="${p.y}" r="11" fill="transparent" style="cursor:pointer"/>`;
    });
    if(ins.gauges){ const sp=ports['outdoor:SVC']; svg+=`<rect x="${sp.x+9}" y="${sp.y-11}" width="22" height="22" rx="3" fill="#12303f" stroke="#3f7fbf"/><circle cx="${sp.x+20}" cy="${sp.y}" r="7" fill="#0a1a24" stroke="#5aa0e0"/><line x1="${sp.x+20}" y1="${sp.y}" x2="${sp.x+24}" y2="${sp.y-4}" stroke="#5fd394" stroke-width="1"/>`; }
    if(acDrainOK()){ const d=ports['drain:OUT']; const dir=ins.slope==='down'?'\u2198':ins.slope==='up'?'\u2197':'\u2192'; svg+=`<text x="${d.x-18}" y="${d.y+4}" font-size="12" font-weight="700" fill="${ins.slope==='down'?'#25a85a':'#e0473c'}">${dir}</text>`; }
  }
  svg+=`</svg>`;

  // status banner (electrical + mechanical combined)
  const mi=checkACInstall(); const cm=acCommission();
  const allItems=[...chk.items, ...mi.items];
  const combined = allItems.some(i=>i.level==='danger')?'danger' : (chk.allCorrect&&mi.mechOK)?'ok' : allItems.some(i=>i.level==='warn')?'warn' : (state.acBench.wires.length||state.acBench.install.lines.length)?'warn':'empty';
  const sc={danger:['#e0473c','\u26A0 DANGER'],warn:['#f0a830','\u26A0 KEEP GOING'],ok:['#43b25f','\u2713 INSTALL COMPLETE & CORRECT'],empty:['#5d7396','Start the install']}[combined];
  const items=allItems.slice().sort((a,b)=>({danger:0,warn:1,ok:2}[a.level]-{danger:0,warn:1,ok:2}[b.level]));

  wrap.innerHTML=`
  <div class="ac-head">
    <div><div class="learn-title">\u26A1 A/C Wiring Trainer</div>
    <div class="learn-sub">New here? Press <b>\u{1F9ED} Guide me</b> \u2014 it walks you through every wire, one at a time. Just click the two <b>glowing screws</b> (or let it do the connection for you). Want to try yourself? Pick a colour, click one screw, then the screw it joins. Then set a compressor or capacitor fault, press <b>Energize</b>, and find it with the <b>multimeter</b>. Green/yellow = earth \u2014 never switch it.</div></div>
  </div>
  <div class="ac-toolbar">
    <div class="seg"><button data-acunit="single" class="${b.unit==='single'?'on':''}">Split S1/S2/S3</button><button data-acunit="lns" class="${b.unit==='lns'?'on':''}">Split L-N-S +RCCB</button><button data-acunit="three" class="${b.unit==='three'?'on':''}">3-phase</button></div>
    <div class="seg"><button data-acstd="iec" class="${b.standard==='iec'?'on':''}">IEC/EU</button><button data-acstd="us" class="${b.standard==='us'?'on':''}">US/NEC</button><button data-acstd="poster" class="${b.standard==='poster'?'on':''}">Poster R/B</button></div>
    <span class="tb-sep"></span>
    <span class="ac-swatches">${AC_PALETTE.map(c=>`<button class="ac-sw ${b.color===c?'on':''}" data-accolor="${c}" style="background:${c}" title="${AC_COLNAME[c]}"></button>`).join('')}</span>
    <span class="tb-sep"></span>
    <button class="mini-btn ${b.guide?'primary':''}" data-acguide>${b.guide?'\u{1F9ED} Guiding\u2026':'\u{1F9ED} Guide me'}</button>
    <button class="mini-btn" data-acauto>Auto-wire</button>
    <button class="mini-btn" data-acfault>Insert fault</button>
    <button class="mini-btn" data-acclear>Clear</button>
    <button class="mini-btn" data-acreset>\u21BB Reset</button>
    ${b.selWire?`<button class="mini-btn danger-mini" data-acdelwire>Delete wire</button>`:''}
  </div>
  <div class="ac-stage">
    <div class="ac-canvas">${svg}</div>
    <div class="ac-side">
      ${guide ? (gstep ? `<div class="ac-guide">
        <div class="ac-guide-h">\u{1F9ED} Step ${gstep.done+1} of ${gstep.total}</div>
        <div class="ac-guide-b">${gstep.type==='wire'?`Run a <b style="color:${gstep.color}">${esc(AC_COLNAME[gstep.color]||'')}</b> wire:` : gstep.type==='pipe'?`<b>${esc(gstep.head)}</b>` : `<b>${esc(gstep.head)}</b>`}</div>
        ${(gstep.type==='wire'||gstep.type==='pipe')?`<div class="ac-guide-run">${esc(gstep.fromH)}<br><span class="ac-guide-arr">\u2193 to \u2193</span><br>${esc(gstep.toH)}</div>
        <div class="ac-guide-t">Click the two <b>glowing points</b> \u2014 or:</div>`:`<div class="ac-guide-t">Do it below, or:</div>`}
        <button class="mini-btn primary" data-acdostep style="width:100%;margin-top:6px">\u26A1 ${gstep.type==='action'?esc(gstep.btn||'Do this step'):'Make this connection for me'}</button>
      </div>` : `<div class="ac-guide ok">
        <div class="ac-guide-h">\u2713 Install complete!</div>
        <div class="ac-guide-t">Wiring, pipework, vacuum, valves and drain are all done. Press <b>Energize / Test</b>, add a fault, and diagnose it.</div>
      </div>`) : ''}
      <div class="ac-status" style="border-color:${sc[0]};color:${sc[0]}">${sc[1]}</div>
      <button class="ac-energize ${b.powerOn?'on':''}" data-acenergize>${b.powerOn?'\u23FB Power is ON \u2014 click to cut':'\u26A1 Energize / Test'}</button>
      ${b.powerOn&&acSystemState().tripped?`<div class="ac-alert danger">\u26A1 ${esc(acSystemState().reason)}</div>`:''}
      ${b.powerOn&&acSystemState().liveCasing?`<div class="ac-alert danger">${esc(acSystemState().reason)}</div>`:''}
      ${b.powerOn&&acSystemState().running?`<div class="ac-alert ok">\u2713 Compressor running.</div>`:''}
      ${b.powerOn&&acSystemState().willNotStart?`<div class="ac-alert warn">Powered, but the compressor won\u2019t start.</div>`:''}
      ${b.powerOn?`<div class="ac-diag">
        <div class="side-title">Commissioning \u2014 gauges & readings</div>
        <div class="ac-verdict ${cm.cool?'ok':'bad'}">${esc(cm.verdict)}</div>
        ${cm.reason?`<div class="ac-guide-t" style="margin-bottom:6px">${esc(cm.reason)}</div>`:''}
        <div class="ac-read"><span>Suction (low side)</span><b>${esc(cm.suction)}</b></div>
        <div class="ac-read"><span>Discharge (high side)</span><b>${esc(cm.discharge)}</b></div>
        <div class="ac-read"><span>Air temp split</span><b>${esc(cm.split)}</b></div>
        <div class="ac-read"><span>Run current</span><b>${esc(cm.amps)}</b></div>
        ${!b.install.gauges?`<div class="empty-hint" style="margin-top:6px">Tip: click the SERVICE port (or Attach gauges) to read pressures.</div>`:''}
      </div>`:''}

      <div class="ac-diag">
        <div class="side-title">Wiring steps</div>
        ${acSteps().map(s=>`<div class="lab-step ${s.done?'done':''}">${s.done?'\u2713':'\u25CB'} ${esc(s.label)}</div>`).join('')}
      </div>

      <div class="ac-diag">
        <div class="side-title">Refrigerant, drain & vacuum</div>
        <div class="empty-hint" style="margin-bottom:6px">Click a copper port then its match to run a pipe (liquid\u2192liquid, gas\u2192gas). Click a pipe to remove it.</div>
        <div class="ac-btn-row">
          <button class="mini-btn ${ins.insul?'primary':''}" data-acact="insul">${ins.insul?'\u2713 Insulated':'Insulate lines'}</button>
          <button class="mini-btn ${ins.gauges?'primary':''}" data-acact="gauges">${ins.gauges?'\u2713 Gauges on':'Attach gauges'}</button>
        </div>
        <div class="ac-btn-row">
          <button class="mini-btn ${ins.vacuum?'primary':''}" data-acact="vacuum">${ins.vacuum?'\u2713 Vacuum done':'Pull vacuum'}</button>
          <button class="mini-btn ${ins.valves?'primary':''}" data-acact="valves">${ins.valves?'\u2713 Valves open':'Open valves'}</button>
        </div>
        <div class="side-title" style="margin-top:8px">Drain slope</div>
        <select id="acSlope" class="ac-sel">${[['none','\u2014 not set'],['down','Falls downhill \u2713'],['flat','Flat'],['up','Rises (wrong)']].map(([v,l])=>`<option value="${v}" ${ins.slope===v?'selected':''}>${l}</option>`).join('')}</select>
        <button class="mini-btn" data-acclearpipes style="margin-top:8px;width:100%">Clear pipework</button>
      </div>

      <div class="ac-diag">
        <div class="side-title">Compressor fault</div>
        <select id="acCompSel" class="ac-sel">${AC_COMP_FAULTS.map(([v,l])=>`<option value="${v}" ${(b.comp||'none')===v?'selected':''}>${l}</option>`).join('')}</select>
        <div class="side-title" style="margin-top:8px">Run capacitor</div>
        <select id="acCapSel" class="ac-sel">${[['ok','Healthy \u224835 \u00B5F'],['weak','Weak \u224818 \u00B5F'],['open','Open (failed)'],['short','Shorted']].map(([v,l])=>`<option value="${v}" ${(b.cap||'ok')===v?'selected':''}>${l}</option>`).join('')}</select>

        <div class="side-title" style="margin-top:12px">Multimeter</div>
        <button class="mini-btn ${m.probe?'primary':''}" id="acProbe" style="width:100%">${m.probe?'\u25C9 Probing \u2014 click two points':'Use probes'}</button>
        <div class="mm-modes">${[['vac','V~'],['ohm','\u03A9'],['cont','\u25CF cont'],['insul','M\u03A9'],['amp','A'],['cap','\u00B5F']].map(([k,l])=>`<button class="mm-mode ${(m.mode||'ohm')===k?'on':''}" data-acmeter="${k}">${l}</button>`).join('')}</div>
        <div class="mm-display"><div class="mm-val">${esc(acMeasure().txt)}</div><div class="mm-sub">${esc(acMeasure().sub)}</div></div>
        <div class="mm-probes">A: <b>${m.a?esc(acTermName(m.a)):'\u2014'}</b> \u00b7 B: <b>${m.b?esc(acTermName(m.b)):'\u2014'}</b> <button class="linkbtn" id="acProbeClear">clear</button></div>
        <div class="empty-hint" style="margin-top:6px">Cut power &amp; isolate before \u03A9/insulation tests. Windings: C\u2013R \u2248 run, C\u2013S \u2248 start. Insulation: probe a winding \u2192 CASE \u2014 healthy &gt;50 M\u03A9, a grounded winding reads near 0. A = clamp current, \u00B5F = capacitor test.</div>
      </div>

      <div class="ac-alerts">
        ${items.length? items.map(it=>`<div class="ac-alert ${it.level}">${esc(it.msg)}</div>`).join('') : '<div class="ac-alert ok">No connections yet. Use Auto-wire to see a correct example, or wire it yourself.</div>'}
      </div>
      <div class="ac-legend">
        <div class="side-title">Colour key \u00b7 ${std.name}</div>
        <div class="lg"><span style="background:${std.L1}"></span>L / L1 \u2014 ${std.L1name}</div>
        ${three?`<div class="lg"><span style="background:${std.L2}"></span>L2 \u2014 ${std.L2name}</div><div class="lg"><span style="background:${std.L3}"></span>L3 \u2014 ${std.L3name}</div>`:''}
        <div class="lg"><span style="background:${std.N}"></span>N \u2014 ${std.Nname}</div>
        <div class="lg"><span style="background:${std.PE}"></span>${lns||b.standard==='poster'?'E':'PE'} \u2014 ${std.PEname}</div>
        <div class="lg"><span style="background:${std.S}"></span>${lns?'S \u2014 signal (indoor\u2194outdoor)':'S1/S2/S3 \u2014 interconnect'}</div>
        <div class="empty-hint" style="margin-top:8px">${lns
          ? 'This is the L\u00b7N\u00b7S\u00b7E layout from your photo: mains \u2192 RCCB (30\u202FmA) \u2192 2-pole isolator \u2192 outdoor, then L N S E across to the indoor unit. Never switch the earth, and never land a phase on S.'
          : 'S1/S2 usually carry power from the outdoor to the indoor unit; S3 is the signal. Never swap them and never land a phase on S.'}</div>
      </div>
    </div>
  </div>`;

  // interactions
  const svgEl=document.getElementById('acSvg');
  svgEl.addEventListener('click',e=>{
    const port=e.target.closest('[data-acport]');
    if(port){ acClickPort(port.dataset.acport); return; }
    const pipe=e.target.closest('[data-acpipe]');
    if(pipe){ b.install.lines=b.install.lines.filter(l=>l.id!==pipe.dataset.acpipe); b.install.selPort=null; renderACTab(); markDirty(); return; }
    const term=e.target.closest('[data-acterm]');
    if(term){ acClickTerminal(term.dataset.acterm); return; }
    const wire=e.target.closest('[data-acwire]');
    if(wire){ b.selWire=wire.dataset.acwire; b.sel=null; renderACTab(); return; }
    b.sel=null; b.selWire=null; b.install.selPort=null; renderACTab();
  });
  wrap.querySelectorAll('[data-acunit]').forEach(x=>x.addEventListener('click',()=>{ b.unit=x.dataset.acunit; b.wires=[]; b.sel=null; b.selWire=null; renderACTab(); markDirty(); }));
  wrap.querySelectorAll('[data-acstd]').forEach(x=>x.addEventListener('click',()=>{ b.standard=x.dataset.acstd; renderACTab(); markDirty(); }));
  wrap.querySelectorAll('[data-accolor]').forEach(x=>x.addEventListener('click',()=>{ b.color=x.dataset.accolor; if(b.selWire){ const w=b.wires.find(w=>w.id===b.selWire); if(w) w.color=b.color; markDirty(); } renderACTab(); }));
  const byId=(a,f)=>{ const el=wrap.querySelector(a); if(el) el.addEventListener('click',f); };
  byId('[data-acguide]',()=>{ b.guide=!b.guide; b.sel=null; b.selWire=null; if(b.guide){ const s=acNextStep(); if(s&&s.type==='wire') b.color=s.color; } renderACTab(); markDirty(); });
  byId('[data-acdostep]',acDoStep);
  byId('[data-acauto]',acAutoWire);
  byId('[data-acfault]',acInsertFault);
  byId('[data-acclear]',acClear);
  byId('[data-acreset]',resetACTrainer);
  byId('[data-acdelwire]',()=>{ b.wires=b.wires.filter(w=>w.id!==b.selWire); b.selWire=null; renderACTab(); markDirty(); });
  byId('[data-acenergize]',acEnergize);
  wrap.querySelectorAll('[data-acact]').forEach(x=>x.addEventListener('click',()=>acAct(x.dataset.acact)));
  byId('[data-acclearpipes]',acClearPipes);
  const slp=document.getElementById('acSlope'); if(slp) slp.addEventListener('change',()=>acSetSlope(slp.value));
  const cs=document.getElementById('acCompSel'); if(cs) cs.addEventListener('change',()=>acSetComp(cs.value));
  const cps=document.getElementById('acCapSel'); if(cps) cps.addEventListener('change',()=>acSetCap(cps.value));
  byId('#acProbe',acToggleProbe);
  wrap.querySelectorAll('[data-acmeter]').forEach(x=>x.addEventListener('click',()=>acSetMeter(x.dataset.acmeter)));
  byId('#acProbeClear',()=>{ b.meter.a=null; b.meter.b=null; renderACTab(); });
  updateCoach();
}
function acClickTerminal(id){
  const b=state.acBench;
  if(b.meter && b.meter.probe){
    if(!b.meter.a || (b.meter.a && b.meter.b)){ b.meter.a=id; b.meter.b=null; }
    else if(id!==b.meter.a){ b.meter.b=id; }
    renderACTab(); return;
  }
  if(b.sel && b.sel!==id){
    let color=b.color || acDefaultColor(b.sel);
    if(b.guide){ const s=acNextStep(); if(s&&s.type==='wire') color=s.color; }
    b.wires.push({id:'acw'+(state.counters.conn++)+'_'+Date.now().toString(36),from:b.sel,to:id,color});
    b.sel=null; b.selWire=null; renderACTab(); markDirty();
  } else {
    b.sel = (b.sel===id)? null : id; b.selWire=null; renderACTab();
  }
}
function acDefaultColor(id){
  const std=AC_STD[state.acBench.standard]; const n=acTermName(id), r=acTermRole(id);
  if(r==='earth')return std.PE; if(r==='neutral')return std.N; if(r==='signal')return std.S; if(n==='L2')return std.L2; if(n==='L3')return std.L3; return std.L1;
}
function acTermHuman(id){
  const [blk,n]=id.split(':');
  const B={supply:'Supply',rccb:'RCCB',iso:'Isolator',outdoor:'Outdoor unit',indoor:'Indoor unit',comp:'Compressor'}[blk]||blk;
  const T={Lin:'L (in)',Lout:'L (out)',Nin:'N (in)',Nout:'N (out)',PE:'Earth',E:'Earth',N:'Neutral',L:'Live',S:'Signal',S1:'Signal 1',S2:'Signal 2',S3:'Signal 3'}[n]||n;
  return B+' \u00b7 '+T;
}
function acStepDone(s){
  const {find}=acNets();
  if(s.type==='wire') return find(s.from)===find(s.to);
  if(s.type==='pipe') return acLineBetween(s.kind,s.from,s.to);
  if(s.type==='action'){ const ins=state.acBench.install; return s.act==='insul'?ins.insul : s.act==='slope'?ins.slope==='down' : s.act==='gauges'?ins.gauges : s.act==='vacuum'?ins.vacuum : s.act==='valves'?ins.valves : false; }
  return false;
}
function acGuideSteps(){
  const steps=[];
  acCorrect().forEach(([a,c])=>steps.push({type:'wire',from:a,to:c,color:acDefaultColor(a),fromH:acTermHuman(a),toH:acTermHuman(c),head:`Run a ${AC_COLNAME[acDefaultColor(a)]||''} wire`}));
  steps.push({type:'pipe',from:'outdoor:LIQ',to:'indoor:LIQ',kind:'liquid',fromH:'Outdoor \u00b7 Liquid valve',toH:'Indoor \u00b7 Liquid port',head:'Connect the LIQUID line (small copper pipe)'});
  steps.push({type:'pipe',from:'outdoor:GAS',to:'indoor:GAS',kind:'gas',fromH:'Outdoor \u00b7 Gas valve',toH:'Indoor \u00b7 Gas port',head:'Connect the GAS line (big copper pipe)'});
  steps.push({type:'action',act:'insul',head:'Insulate both copper lines',btn:'Insulate lines'});
  steps.push({type:'pipe',from:'indoor:DRN',to:'drain:OUT',kind:'drain',fromH:'Indoor \u00b7 Drain spigot',toH:'Drain \u00b7 to outside',head:'Fit the condensate drain'});
  steps.push({type:'action',act:'slope',head:'Set the drain to fall downhill',btn:'Set drain to fall'});
  steps.push({type:'action',act:'gauges',head:'Attach gauges to the service port',btn:'Attach gauges'});
  steps.push({type:'action',act:'vacuum',head:'Pull a vacuum (remove air & moisture)',btn:'Pull vacuum'});
  steps.push({type:'action',act:'valves',head:'Open both service valves',btn:'Open valves'});
  return steps;
}
function acNextStep(){
  const steps=acGuideSteps(); const done=steps.filter(acStepDone).length;
  for(const s of steps){ if(!acStepDone(s)) return Object.assign({},s,{done,total:steps.length}); }
  return null;
}
function acDoStep(){
  const s=acNextStep(); if(!s){ renderACTab(); return; }
  const b=state.acBench, ins=b.install;
  if(s.type==='wire') b.wires.push({id:'acw'+(state.counters.conn++)+'_'+Date.now().toString(36),from:s.from,to:s.to,color:s.color});
  else if(s.type==='pipe') ins.lines.push({id:'pl'+(state.counters.conn++)+'_'+Date.now().toString(36),from:s.from,to:s.to,kind:s.kind});
  else if(s.type==='action'){ if(s.act==='insul')ins.insul=true; else if(s.act==='slope')ins.slope='down'; else if(s.act==='gauges')ins.gauges=true; else if(s.act==='vacuum'){ins.gauges=true;ins.vacuum=true;} else if(s.act==='valves'){ins.gauges=true;ins.vacuum=true;ins.valves=true;} }
  b.sel=null; b.selWire=null; ins.selPort=null; renderACTab(); markDirty();
}

/* ===== refrigerant / drain / commissioning logic ===== */
function acPortRole(id){ const n=(id.split(':')[1]||''); if(n==='LIQ')return'liquid'; if(n==='GAS')return'gas'; if(n==='DRN'||id==='drain:OUT')return'drain'; if(n==='SVC')return'service'; return''; }
function acPipeKind(a,c){ const ra=acPortRole(a), rc=acPortRole(c);
  if(ra==='service'||rc==='service')return null;
  if(ra==='drain'||rc==='drain')return (ra==='drain'&&rc==='drain')?'drain':null;
  if(ra==='liquid'&&rc==='liquid')return'liquid';
  if(ra==='gas'&&rc==='gas')return'gas';
  if((ra==='liquid'&&rc==='gas')||(ra==='gas'&&rc==='liquid'))return'cross';
  return null; }
function acLineBetween(kind,x,y){ return state.acBench.install.lines.some(l=>l.kind===kind && ((l.from===x&&l.to===y)||(l.from===y&&l.to===x))); }
function acPipeOK(kind){ const t=kind==='liquid'?'LIQ':'GAS'; return acLineBetween(kind,'outdoor:'+t,'indoor:'+t); }
function acDrainOK(){ return acLineBetween('drain','indoor:DRN','drain:OUT'); }
function acCrossed(){ return state.acBench.install.lines.some(l=>l.kind==='cross'); }
function acClickPort(id){
  const ins=state.acBench.install;
  if(id==='outdoor:SVC'){ ins.gauges=!ins.gauges; ins.selPort=null; renderACTab(); markDirty(); return; }
  if(ins.selPort && ins.selPort!==id){
    const kind=acPipeKind(ins.selPort,id);
    if(kind) ins.lines.push({id:'pl'+(state.counters.conn++)+'_'+Date.now().toString(36),from:ins.selPort,to:id,kind});
    ins.selPort=null; renderACTab(); markDirty();
  } else { ins.selPort = ins.selPort===id? null : id; state.acBench.sel=null; renderACTab(); }
}
function acAct(k){ const ins=state.acBench.install;
  if(k==='gauges') ins.gauges=!ins.gauges;
  else if(k==='vacuum'){ ins.gauges=true; ins.vacuum=!ins.vacuum; }
  else if(k==='valves') ins.valves=!ins.valves;
  else if(k==='insul') ins.insul=!ins.insul;
  renderACTab(); markDirty(); }
function acSetSlope(v){ state.acBench.install.slope=v; renderACTab(); markDirty(); }
function acClearPipes(){ const ins=state.acBench.install; ins.lines=[]; ins.selPort=null; ins.gauges=false; ins.vacuum=false; ins.valves=false; ins.insul=false; ins.slope='none'; renderACTab(); markDirty(); }
function checkACInstall(){
  const ins=state.acBench.install; const items=[];
  const liquid=acPipeOK('liquid'), gas=acPipeOK('gas'), crossed=acCrossed(), drain=acDrainOK();
  if(crossed) items.push({level:'danger',msg:'Refrigerant lines crossed \u2014 liquid tied to gas. System can\u2019t run; high-pressure fault.'});
  if(!liquid) items.push({level:'warn',msg:'Liquid line (small pipe) not connected yet.'});
  if(!gas) items.push({level:'warn',msg:'Gas / suction line (big pipe) not connected yet.'});
  if((liquid||gas)&&!ins.insul) items.push({level:'warn',msg:'Copper lines not insulated \u2014 they will sweat and waste energy.'});
  if(!drain) items.push({level:'warn',msg:'Condensate drain not fitted \u2014 indoor unit will drip water.'});
  else if(ins.slope!=='down') items.push({level:'danger',msg:'Drain does not fall downhill \u2014 water backs up and floods the room.'});
  if(ins.valves && !ins.vacuum) items.push({level:'danger',msg:'Valves opened without a vacuum \u2014 air & moisture now trapped in the system (icing, acid).'});
  if(liquid&&gas&&!crossed){
    if(!ins.vacuum) items.push({level:'warn',msg:'Lines joined \u2014 pull a vacuum before releasing refrigerant.'});
    else if(!ins.valves) items.push({level:'warn',msg:'Vacuum done \u2014 now open both service valves to release the charge.'});
  }
  const pipesOK=liquid&&gas&&!crossed;
  const mechOK = pipesOK && ins.vacuum && ins.valves && drain && ins.slope==='down' && ins.insul;
  if(mechOK) items.push({level:'ok',msg:'Pipework, vacuum, valves & drain all correct.'});
  return {items,liquid,gas,crossed,drain,pipesOK,mechOK};
}
function acCommission(){
  const b=state.acBench, ins=b.install; const st=acSystemState(); const mi=checkACInstall();
  const out={running:st.running,cool:false,verdict:'',reason:'',suction:'\u2014',discharge:'\u2014',split:'\u2014',amps:'\u2014'};
  if(!b.powerOn){ out.verdict='Power off'; return out; }
  if(st.tripped){ out.verdict='Protection tripped'; out.reason=st.reason; out.amps='0.0 A'; return out; }
  if(!st.running){ out.verdict='Not running'; out.reason=st.reason||'Compressor is not starting.'; return out; }
  out.amps=(acCurrent().a).toFixed(1)+' A';
  if(mi.crossed){ out.verdict='Running \u2014 NOT cooling'; out.reason='Lines crossed \u2014 head pressure spikes, will trip on overload.'; out.suction='very low'; out.discharge='very high'; out.split='0\u00B0C'; return out; }
  if(!mi.pipesOK){ out.verdict='Running \u2014 NOT cooling'; out.reason='Both refrigerant lines must be connected.'; out.split='0\u00B0C'; return out; }
  if(!ins.valves){ out.verdict='Running \u2014 NOT cooling'; out.reason='Service valves shut \u2014 no refrigerant flow (compressor pulling vacuum).'; out.suction='0 bar (vac)'; out.discharge='high'; out.split='0\u00B0C'; return out; }
  if(!ins.vacuum){ out.verdict='Cooling poorly'; out.reason='No vacuum \u2014 moisture/air causing icing and weak cooling.'; out.suction='3.5 bar'; out.discharge='24 bar'; out.split='4\u00B0C'; return out; }
  out.cool=true; out.verdict='Cooling normally \u2713'; out.suction='5.0 bar'; out.discharge='18 bar'; out.split='11\u00B0C';
  if(!mi.drain) out.reason='Cooling \u2014 but no drain, water on the floor.';
  else if(ins.slope!=='down') out.reason='Cooling \u2014 but drain doesn\u2019t fall, it will leak.';
  else if(!ins.insul) out.reason='Cooling \u2014 but bare lines are sweating.';
  return out;
}
function acSetComp(f){ state.acBench.comp=f; renderACTab(); markDirty(); }
function acSetMeter(mode){ state.acBench.meter.mode=mode; renderACTab(); }
function acToggleProbe(){ const m=state.acBench.meter; m.probe=!m.probe; if(m.probe){ state.acBench.sel=null; } renderACTab(); }
function acEnergize(){
  state.acBench.powerOn=!state.acBench.powerOn;
  if(!state.acBench.powerOn){ showToast('Powered OFF.'); renderACTab(); return; }
  const st=acSystemState();
  if(st.liveCasing){ showToast('\u2620 '+st.reason); acFlash('#e0473c'); }
  else if(!st.energizable){ showToast('Wiring not complete/correct \u2014 fix the faults first.'); acFlash('#f0a830'); }
  else if(st.tripped){ showToast('\u26A1 '+st.reason); acFlash('#e0473c'); }
  else if(st.willNotStart){ showToast('Powered \u2014 but the compressor won\u2019t start.'); acFlash('#f0a830'); }
  else { showToast('\u2713 Running \u2014 compressor healthy.'); acFlash('#43b25f'); }
  renderACTab();
}
function acFlash(color){
  const el=document.getElementById('acSvg'); if(!el) return;
  el.style.transition='none'; el.style.boxShadow='0 0 0 3px '+color;
  setTimeout(()=>{ el.style.transition='box-shadow .6s'; el.style.boxShadow='none'; },80);
}

/* ============================================================
   LOADS & REPORT TAB
   ============================================================ */
function statusClass(s){ return s==='OVER'?'badge-over':s==='NEAR'?'badge-near':s==='OFF'?'badge-off':'badge-ok'; }
function statusText(s){ return {OK:'OK',NEAR:'Near',OVER:'Over',OFF:'Off'}[s]||s; }

function renderLoadsTab(){
  invalidateLive();
  const wrap=document.getElementById('loadsWrap');
  const main=getMainPanel();
  const pl=main?panelLoad(main.id):{connectedVA:0,adjVA:0,amps:0,mainAmp:200,pct:0,status:'OK',deviceCount:0};
  const sc=serviceCalc();
  const name=esc(state.meta.name||'Untitled Project');
  const date=new Date(state.meta.modified||Date.now()).toLocaleDateString();

  // stat cards
  let html=`<div class="report-head">
    <div><h2>${name}</h2><div class="sub">Load report \u00b7 ${date} \u00b7 estimate only, not a stamped calculation</div></div>
    <div style="display:flex;gap:8px"><button class="bar-btn no-print" id="resetLoadsBtn" title="Clear all design data">&#8635; Reset</button><button class="bar-btn no-print" id="printBtn">&#128424; Print / Save PDF</button></div>
  </div>
  <div class="card-grid">
    <div class="stat-card"><div class="k">Connected load</div><div class="v">${fmt0(pl.connectedVA)} <span style="font-size:13px">W</span></div><div class="sub">${pl.deviceCount} devices</div></div>
    <div class="stat-card"><div class="k">Demand (NEC est.)</div><div class="v">${fmt0(sc.totalVA)} <span style="font-size:13px">W</span></div><div class="sub">${fmt(sc.amps)} A @ 240V</div></div>
    <div class="stat-card"><div class="k">Service draw</div><div class="v" style="color:${pl.color}">${fmt(pl.amps)} <span style="font-size:13px">A</span></div><div class="sub">of ${pl.mainAmp}A \u2014 ${statusText(pl.status)}</div></div>
    <div class="stat-card"><div class="k">Circuits</div><div class="v">${state.circuits.length}</div><div class="sub">${getPanels().length} panel(s)</div></div>
  </div>`;

  // per-panel schedules
  getPanels().forEach(panel=>{
    const cs=panelCircuits(panel.id).slice().sort((a,b)=>(a.slot||0)-(b.slot||0));
    html+=`<div class="rep-section"><h3>${esc(panel.label)} \u2014 ${panel.mainAmp}A \u00b7 ${panel.spaces} spaces</h3>`;
    if(!cs.length){ html+=`<div class="empty-hint">No circuits.</div></div>`; return; }
    html+=`<table class="rep"><thead><tr><th>#</th><th>Circuit</th><th>Breaker</th><th>Wire</th><th class="num">Load</th><th class="num">Amps</th><th class="num">% cap</th><th>Status</th></tr></thead><tbody>`;
    cs.forEach((c,i)=>{
      const ld=circuitLoad(c);
      html+=`<tr>
        <td>${c.slot||i+1}</td>
        <td><span class="swatch" style="display:inline-block;background:${c.color};margin-right:6px;vertical-align:middle"></span>${esc(c.name)}${ld.isFeeder?` <span class="tag">feeder</span>`:''}</td>
        <td>${c.amp}A ${c.poles===2?'2-pole 240V':'1-pole 120V'}</td>
        <td>${gaugeFor(c.amp)}</td>
        <td class="num">${fmt0(ld.connectedVA)} W</td>
        <td class="num">${fmt(ld.adjAmps)} A</td>
        <td class="num">${fmt0(ld.pct)}%</td>
        <td class="${statusClass(ld.status)}">${statusText(ld.status)}</td>
      </tr>`;
    });
    html+=`</tbody></table></div>`;
  });

  // bill of materials
  const counts={};
  state.components.forEach(c=>{ if(isPanelType(c.type)) return; counts[c.type]=(counts[c.type]||0)+1; });
  const bomRows=Object.keys(counts).map(t=>({def:libDef(t),n:counts[t]})).sort((a,b)=>b.n-a.n);
  html+=`<div class="rep-section"><h3>Device Schedule</h3>`;
  if(!bomRows.length){ html+=`<div class="empty-hint">No devices placed yet.</div>`; }
  else{
    html+=`<table class="rep"><thead><tr><th>Qty</th><th>Part</th><th class="num">Unit VA</th><th class="num">Total VA</th><th>Voltage</th></tr></thead><tbody>`;
    bomRows.forEach(r=>{
      html+=`<tr><td class="num">${r.n}</td><td>${esc(r.def.label)}</td><td class="num">${r.def.watts}</td><td class="num">${fmt0(r.def.watts*r.n)}</td><td>${r.def.v}V</td></tr>`;
    });
    html+=`</tbody></table></div>`;
  }

  // panels + sub-panels list
  html+=`<div class="rep-section"><h3>Panel Schedule</h3>
    <table class="rep"><thead><tr><th>Panel</th><th>Type</th><th>Main</th><th>Spaces used</th><th class="num">Draw</th><th>Fed from</th></tr></thead><tbody>`;
  getPanels().forEach(p=>{
    const ppl=panelLoad(p.id);
    let fed='Service';
    if(p.type==='subpanel'){ const f=p.fedByCircuitId&&getCircuit(p.fedByCircuitId); const par=f&&findComp(f.panelId); fed=f?`${esc(par?par.label:'?')} / ${esc(f.name)}`:'\u2014'; }
    html+=`<tr><td>${esc(p.label)}</td><td>${p.type==='panel'?'Main':'Sub'}</td><td>${p.mainAmp}A</td><td>${panelCircuits(p.id).length} / ${p.spaces}</td><td class="num">${fmt(ppl.amps)} A</td><td>${fed}</td></tr>`;
  });
  html+=`</tbody></table></div>`;

  // service calc breakdown
  html+=`<div class="rep-section"><h3>Service Load Calculation <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-dimmer);font-size:11px">(NEC 220 standard method, approximate)</span></h3>
    <div class="ins-field" style="max-width:220px"><label>House area (sq ft) \u2014 drives lighting load</label><input id="repSqft" type="number" min="0" value="${state.meta.sqft||0}"></div>
    <div class="calc-grid">
      <div class="lbl">General lighting &amp; receptacles (3 VA/ft\u00b2)</div><div class="val">${fmt0(sc.general)} VA</div>
      <div class="lbl">Small-appliance circuits (2 \u00d7 1500)</div><div class="val">${fmt0(sc.smallAppl)} VA</div>
      <div class="lbl">Laundry circuit</div><div class="val">${fmt0(sc.laundry)} VA</div>
      <div class="lbl">\u2192 General load after demand factor</div><div class="val">${fmt0(sc.lightingDemand)} VA</div>
      <div class="lbl">Fixed appliances${sc.fixedAppl>=4?' (\u00d70.75, 4+ units)':''}</div><div class="val">${fmt0(sc.fixedDemand)} VA</div>
      <div class="lbl">Range / oven (220.55)</div><div class="val">${fmt0(sc.rangeVA)} VA</div>
      <div class="lbl">Dryer (min 5000)</div><div class="val">${fmt0(sc.dryerVA)} VA</div>
      <div class="lbl">HVAC \u2014 larger of heat (${fmt0(sc.heat)}) / cool (${fmt0(sc.cool)})</div><div class="val">${fmt0(sc.hvacVA)} VA</div>
      <div class="lbl">EV charging (\u00d71.25 continuous)</div><div class="val">${fmt0(sc.evVA)} VA</div>
      <div class="tot"><div class="lbl">Calculated service load</div></div><div class="tot"><div class="val">${fmt0(sc.totalVA)} VA \u00b7 ${fmt(sc.amps)} A</div></div>
    </div>
    <div class="empty-hint" style="margin-top:12px">This is a planning estimate to size a service and spot problems early. Final design and permit drawings should be verified by a licensed electrician against your local code.</div>
  </div>`;

  wrap.innerHTML=html;
  const pb=document.getElementById('printBtn'); if(pb) pb.addEventListener('click',()=>window.print());
  const rlb=document.getElementById('resetLoadsBtn'); if(rlb) rlb.addEventListener('click',resetLoads);
  const sq=document.getElementById('repSqft'); if(sq) sq.addEventListener('change',()=>{ pushUndo(); state.meta.sqft=Math.max(0,parseFloat(sq.value)||0); renderLoadsTab(); markDirty(); });
}

/* ============================================================
   MODALS
   ============================================================ */
function openModal(html){
  document.getElementById('modalBox').innerHTML=html;
  document.getElementById('modalOverlay').style.display='flex';
}
function closeModal(){ document.getElementById('modalOverlay').style.display='none'; }

/* ---- custom part ---- */
function openCustomPart(){
  const shapes=['outlet','light','switch','appliance','ac','heat','water','motor','ev','smoke','splitter','custom'];
  const existing = state.customTypes.length
    ? `<div class="side-title" style="margin-top:14px">Your custom parts</div>`+state.customTypes.map(t=>{
        const def=libDef(t.key);
        return `<div class="custom-row"><svg class="custom-glyph" viewBox="-20 -20 40 40">${iconInner(def.shape||'custom','#f0a830',{type:t.key})}</svg><span class="custom-name">${esc(t.label)} \u00b7 ${t.watts}W \u00b7 ${t.v||120}V</span><button class="remove-x" data-rmcustom="${t.key}">&times;</button></div>`;
      }).join('')
    : `<div class="empty-hint" style="margin-top:12px">No custom parts yet.</div>`;
  openModal(`<div class="modal-title">&#10133; Custom Part</div>
    <div class="ins-field"><label>Name</label><input id="cpName" type="text" placeholder="e.g. Aquarium pump"></div>
    <div class="ins-row">
      <div class="ins-field"><label>Glyph (1-2 ch)</label><input id="cpGlyph" type="text" maxlength="2" placeholder="auto"></div>
      <div class="ins-field"><label>Watts (VA)</label><input id="cpWatts" type="number" min="0" value="100"></div>
    </div>
    <div class="ins-row">
      <div class="ins-field"><label>Voltage</label><select id="cpVolts"><option value="120">120V</option><option value="240">240V</option></select></div>
      <div class="ins-field"><label>Continuous</label><select id="cpCont"><option value="0">No</option><option value="1">Yes</option></select></div>
    </div>
    <div class="ins-field"><label>Icon style</label><select id="cpShape">${shapes.map(s=>`<option value="${s}">${s}</option>`).join('')}</select></div>
    <div class="ins-field"><label>Category</label><select id="cpCat">${CATEGORIES.filter(c=>c.key!=='custom').map(c=>`<option value="${c.key}">${esc(c.label)}</option>`).concat('<option value="custom" selected>Custom</option>').join('')}</select></div>
    <div class="modal-actions"><button class="primary-btn" id="cpAdd">Add part</button><button class="ghost-btn" id="cpClose">Close</button></div>
    <div id="cpExisting">${existing}</div>`);
  document.getElementById('cpAdd').addEventListener('click',addCustomFromForm);
  document.getElementById('cpClose').addEventListener('click',closeModal);
  document.querySelectorAll('[data-rmcustom]').forEach(b=>b.addEventListener('click',()=>removeCustomType(b.dataset.rmcustom)));
}
function addCustomFromForm(){
  const name=document.getElementById('cpName').value.trim();
  if(!name){ showToast('Give the part a name.'); return; }
  const glyph=(document.getElementById('cpGlyph').value.trim()||name.slice(0,2)).toUpperCase().slice(0,2);
  const watts=Math.max(0,parseFloat(document.getElementById('cpWatts').value)||0);
  const v=parseInt(document.getElementById('cpVolts').value);
  const cont=document.getElementById('cpCont').value==='1';
  const shape=document.getElementById('cpShape').value;
  const cat=document.getElementById('cpCat').value;
  pushUndo();
  const key='custom_'+Date.now()+Math.floor(Math.random()*1000);
  state.customTypes.push({ key, label:name, glyph, watts, v, poles:v===240?2:1, cont, shape, cat, control:watts===0 });
  closeModal(); renderPartLibrary(); markDirty();
  setTool('place',key);
  showToast('Added \u2014 click the grid to place it.');
}
function removeCustomType(key){
  pushUndo();
  const n=state.components.filter(c=>c.type===key).length;
  state.components=state.components.filter(c=>c.type!==key);
  state.connections=state.connections.filter(c=>findComp(c.fromId)&&findComp(c.toId));
  state.customTypes=state.customTypes.filter(t=>t.key!==key);
  if(ui.placeType===key) setTool('select');
  if(n>0) showToast(`Removed that part and ${n} placed instance${n>1?'s':''}.`);
  openCustomPart(); renderAll(); markDirty();
}

/* ---- panel designer ---- */
function openPanelDesigner(panelId){
  const p=findComp(panelId); if(!p) return;
  const isSub=p.type==='subpanel';
  const feederOpts=()=>{
    let opts=`<option value="">\u2014 not connected \u2014</option>`;
    state.circuits.forEach(c=>{
      if(c.panelId===p.id) return;
      const fb=subpanelFedBy(c.id); if(fb&&fb.id!==p.id) return;
      const pnl=findComp(c.panelId);
      opts+=`<option value="${c.id}" ${p.fedByCircuitId===c.id?'selected':''}>${esc(pnl?pnl.label:'?')} \u00b7 ${esc(c.name)}</option>`;
    });
    return opts;
  };
  const cs=panelCircuits(p.id).slice().sort((a,b)=>(a.slot||0)-(b.slot||0));
  const rows = cs.length? cs.map(c=>`<div class="custom-row">
      <span class="swatch" style="background:${c.color}"></span>
      <input class="mini-sel" style="width:120px" data-cname="${c.id}" value="${esc(c.name)}">
      <select class="mini-sel" data-cpoles="${c.id}"><option value="1" ${c.poles===1?'selected':''}>120V</option><option value="2" ${c.poles===2?'selected':''}>240V</option></select>
      <select class="mini-sel" data-camp="${c.id}">${BREAKER_AMPS.map(a=>`<option value="${a}" ${a===c.amp?'selected':''}>${a}A</option>`).join('')}</select>
      <button class="remove-x" data-crm="${c.id}">&times;</button>
    </div>`).join('') : `<div class="empty-hint" style="margin:8px 0">No circuits yet.</div>`;
  openModal(`<div class="modal-title">&#9881; ${esc(p.label)}</div>
    <div class="ins-field"><label>Panel name</label><input id="pdName" type="text" value="${esc(p.label)}"></div>
    <div class="ins-row">
      <div class="ins-field"><label>${isSub?'Sub main':'Main breaker'}</label><select id="pdMain">${MAIN_AMP_OPTIONS.map(a=>`<option value="${a}" ${a===p.mainAmp?'selected':''}>${a}A</option>`).join('')}</select></div>
      <div class="ins-field"><label>Spaces</label><select id="pdSpaces">${PANEL_SPACE_OPTIONS.map(s=>`<option value="${s}" ${s===p.spaces?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>
    ${isSub?`<div class="ins-field"><label>Fed from breaker</label><select id="pdFeeder">${feederOpts()}</select></div>`:''}
    <div class="side-title" style="margin-top:6px">Breaker schedule <button class="mini-btn" id="pdAddCirc">+ Add</button></div>
    <div id="pdRows">${rows}</div>
    <div class="modal-actions"><button class="primary-btn" id="pdDone">Done</button></div>`);

  document.getElementById('pdName').addEventListener('input',e=>{ p.label=e.target.value; markDirty(); });
  document.getElementById('pdMain').addEventListener('change',e=>{ pushUndo(); p.mainAmp=parseInt(e.target.value); p.busAmp=p.mainAmp; markDirty(); renderAll(); });
  document.getElementById('pdSpaces').addEventListener('change',e=>{ pushUndo(); p.spaces=parseInt(e.target.value); markDirty(); renderAll(); });
  const fd=document.getElementById('pdFeeder'); if(fd) fd.addEventListener('change',e=>{ pushUndo(); p.fedByCircuitId=e.target.value?parseInt(e.target.value):null; markDirty(); renderAll(); });
  document.getElementById('pdAddCirc').addEventListener('click',()=>{ addCircuit(p.id); openPanelDesigner(p.id); });
  document.getElementById('pdDone').addEventListener('click',()=>{ closeModal(); renderAll(); });
  document.querySelectorAll('[data-cname]').forEach(el=>el.addEventListener('input',()=>{ getCircuit(parseInt(el.dataset.cname)).name=el.value; markDirty(); renderAll(); }));
  document.querySelectorAll('[data-cpoles]').forEach(el=>el.addEventListener('change',()=>{ pushUndo(); getCircuit(parseInt(el.dataset.cpoles)).poles=parseInt(el.value); markDirty(); renderAll(); }));
  document.querySelectorAll('[data-camp]').forEach(el=>el.addEventListener('change',()=>{ pushUndo(); getCircuit(parseInt(el.dataset.camp)).amp=parseInt(el.value); markDirty(); renderAll(); }));
  document.querySelectorAll('[data-crm]').forEach(el=>el.addEventListener('click',()=>{ removeCircuit(parseInt(el.dataset.crm)); openPanelDesigner(p.id); }));
}

/* ============================================================
   PROJECTS  (save / open / export / import)
   ============================================================ */
function readProjects(){
  try{ return JSON.parse(localStorage.getItem(LS_PROJECTS)||'{}'); }catch(e){ return {}; }
}
function writeProjects(obj){
  try{ localStorage.setItem(LS_PROJECTS, JSON.stringify(obj)); return true; }
  catch(e){ return false; }
}
function saveProject(){
  const name=(document.getElementById('projName').value||'Untitled Project').trim();
  state.meta.name=name;
  const projects=readProjects();
  projects[name]={ data:serialize(), modified:Date.now() };
  if(writeProjects(projects)){
    dirty=false;
    document.getElementById('saveState').textContent='saved';
    showToast('Saved \u201c'+name+'\u201d.');
  } else {
    showToast('Local saving is blocked here \u2014 use Export to download the file.');
  }
}
function openProjectPicker(){
  const projects=readProjects();
  const keys=Object.keys(projects).sort((a,b)=>(projects[b].modified||0)-(projects[a].modified||0));
  const rows = keys.length? keys.map(k=>`<div class="proj-list-row">
      <div style="min-width:0;flex:1"><div class="pname">${esc(k)}</div><div class="pdate">${new Date(projects[k].modified||0).toLocaleString()}</div></div>
      <button class="proj-open" data-openproj="${esc(k)}">Open</button>
      <button class="remove-x" data-delproj="${esc(k)}">&times;</button>
    </div>`).join('') : `<div class="empty-hint" style="margin:10px 0">No saved projects yet. Save one, or Import a .json file.</div>`;
  openModal(`<div class="modal-title">&#128194; Open Project</div>${rows}
    <div class="modal-actions"><button class="ghost-btn" id="opClose">Close</button></div>`);
  document.getElementById('opClose').addEventListener('click',closeModal);
  document.querySelectorAll('[data-openproj]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.openproj; const projects=readProjects();
    if(!projects[k]) return;
    try{ deserialize(projects[k].data); closeModal(); setTab('floorplan'); fitView(); renderAll(); dirty=false; document.getElementById('saveState').textContent='saved'; showToast('Opened \u201c'+k+'\u201d.'); undoStack.length=0; redoStack.length=0; }
    catch(e){ showToast('Could not open that project.'); }
  }));
  document.querySelectorAll('[data-delproj]').forEach(b=>b.addEventListener('click',()=>{
    const k=b.dataset.delproj; const projects=readProjects(); delete projects[k]; writeProjects(projects); openProjectPicker();
  }));
}
function resetFloorPlan(){
  if(!confirm('Clear the floor plan? This removes every device, wall and wire you have drawn. Panels and their breakers are kept.')) return;
  pushUndo();
  state.components=state.components.filter(c=>isPanelType(c.type));
  state.walls=[]; state.connections=[];
  ui.selectedId=null;
  renderAll(); markDirty(); showToast('Floor plan cleared');
}
function resetPanels(){
  if(!confirm('Remove every breaker from all panels? Devices stay on the plan but become unassigned.')) return;
  pushUndo();
  state.circuits=[];
  state.components.forEach(c=>{ if(!isPanelType(c.type)) c.circuitId=null; });
  ui.selectedBreaker=null; ui.activeCircuit=null;
  renderPanelsTab(); renderAll(); markDirty(); showToast('Breakers cleared');
}
function resetLab(){
  if(!confirm('Reset the Build & Test bench? Removes the breaker, wires and turns the main off.')) return;
  const L=state.panelLab; L.brk=false; L.wires=[]; L.sel=null; L.mainOn=false; L.meter={mode:'v',a:null,b:null,probe:false};
  renderPanelsTab(); markDirty(); showToast('Bench reset');
}
function resetACTrainer(){
  if(!confirm('Reset the A/C trainer? Clears all wiring, pipework, faults and power.')) return;
  const b=state.acBench;
  b.wires=[]; b.sel=null; b.selWire=null; b.comp='none'; b.cap='ok'; b.powerOn=false; b.guide=false;
  b.meter={mode:'ohm',a:null,b:null,probe:false};
  b.install={lines:[],selPort:null,slope:'none',insul:false,gauges:false,vacuum:false,valves:false};
  renderACTab(); markDirty(); showToast('A/C trainer reset');
}
function resetLoads(){
  if(!confirm('Reset all design data? This removes every device, wall, breaker and wire from the project. Panels are kept.')) return;
  pushUndo();
  state.components=state.components.filter(c=>isPanelType(c.type));
  state.walls=[]; state.connections=[]; state.circuits=[];
  ui.selectedId=null; ui.selectedBreaker=null; ui.activeCircuit=null;
  renderAll(); markDirty(); showToast('Design reset');
}

function newProject(){
  openModal(`<div class="modal-title">&#43; New Project</div>
    <div class="empty-hint" style="margin-bottom:12px">Start a fresh plan. Unsaved changes to the current project will be lost unless you Save or Export first.</div>
    <div class="ins-field"><label>Project name</label><input id="npName" type="text" value="Untitled Project"></div>
    <div class="ins-field"><label>Start from</label><select id="npTemplate"><option value="empty">Empty (just a main panel)</option><option value="starter">Starter home (sample circuits)</option></select></div>
    <div class="modal-actions"><button class="primary-btn" id="npCreate">Create</button><button class="ghost-btn" id="npClose">Cancel</button></div>`);
  document.getElementById('npClose').addEventListener('click',closeModal);
  document.getElementById('npCreate').addEventListener('click',()=>{
    const nm=document.getElementById('npName').value.trim()||'Untitled Project';
    const tpl=document.getElementById('npTemplate').value;
    state=freshState(); state.meta.name=nm;
    document.getElementById('projName').value=nm;
    if(tpl==='starter') buildStarter();
    ui.selectedId=null; ui.activeCircuit=state.circuits[0].id; undoStack.length=0; redoStack.length=0;
    closeModal(); setTab('floorplan'); fitView(); renderAll(); markDirty();
  });
}
function buildStarter(){
  // a few representative circuits + devices around the main panel
  const main=getMainPanel();
  state.circuits=[
    { id:1, panelId:main.id, name:'Kitchen Recep', amp:20, poles:1, color:PALETTE[0], breakerOn:true, slot:1, breakerType:'gfci' },
    { id:2, panelId:main.id, name:'Living Lights', amp:15, poles:1, color:PALETTE[1], breakerOn:true, slot:2, breakerType:'std' },
    { id:3, panelId:main.id, name:'Range', amp:50, poles:2, color:PALETTE[2], breakerOn:true, slot:3, breakerType:'std' },
    { id:4, panelId:main.id, name:'AC Condenser', amp:30, poles:2, color:PALETTE[3], breakerOn:true, slot:4, breakerType:'std' },
  ];
  state.counters.circuit=5;
  let id=2;
  const add=(type,x,y,circuitId)=>{ const d=libDef(type); state.components.push({ id:id++, type, x, y, rot:0, label:d.label, room:'', notes:'', watts:d.watts, v:d.v, poles:d.poles, cont:!!d.cont, gfci:!!d.gfci, afci:false, circuitId, feedFromId:null }); };
  add('gfci',350,150,1); add('gfci',450,150,1); add('fridge',350,250,1);
  add('recessed',350,400,2); add('recessed',450,400,2); add('switch',300,400,2);
  add('range',600,250,3);
  add('condenser',600,450,4);
  state.counters.comp=id;
}
function exportJSON(){
  const name=(document.getElementById('projName').value||'project').trim();
  state.meta.name=name;
  const blob=new Blob([serialize()],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name.replace(/[^\w\-]+/g,'_')+'.circuit.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  showToast('Exported '+a.download);
}
function importJSON(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{ deserialize(reader.result); setTab('floorplan'); fitView(); renderAll(); undoStack.length=0; redoStack.length=0; dirty=false; document.getElementById('saveState').textContent='loaded'; showToast('Imported project.'); }
    catch(e){ showToast('That file could not be read as a project.'); }
  };
  reader.readAsText(file);
}

/* ============================================================
   CONTEXT MENU
   ============================================================ */
function showCtxMenu(x,y,comp){
  const m=document.getElementById('ctxMenu');
  const isPanel=isPanelType(comp.type);
  let items=`<div class="ctx-item" data-act="inspect">&#9716; Inspect</div>
    <div class="ctx-item" data-act="wire">&#9586; Wire from here</div>`;
  if(!isPanel) items+=`<div class="ctx-item" data-act="dup">&#10697; Duplicate</div>
    <div class="ctx-item" data-act="rotate">&#8635; Rotate 90&deg;</div>`;
  if(isPanel && comp.type!=='panel') items+=`<div class="ctx-item" data-act="design">&#9881; Edit panel</div>`;
  if(comp.type==='panel') items+=`<div class="ctx-item" data-act="design">&#9881; Edit panel</div>`;
  if(comp.type!=='panel') items+=`<div class="ctx-sep"></div><div class="ctx-item danger" data-act="del">&times; Delete</div>`;
  m.innerHTML=items;
  m.style.display='block';
  const mw=m.offsetWidth, mh=m.offsetHeight;
  m.style.left=Math.min(x,window.innerWidth-mw-8)+'px';
  m.style.top=Math.min(y,window.innerHeight-mh-8)+'px';
  m.querySelectorAll('.ctx-item').forEach(it=>it.addEventListener('click',()=>{
    const act=it.dataset.act; hideCtxMenu();
    if(act==='inspect'){ ui.selectedId=comp.id; setTool('select'); renderAll(); }
    else if(act==='wire'){ setTool('wire'); ui.wireDraft={from:comp.id,points:[]}; ui.wirePreview=null; renderCanvas(); updateHint(); showToast('Click bend points to route, then click the part to connect.'); }
    else if(act==='dup'){ duplicateComponent(comp.id); }
    else if(act==='rotate'){ pushUndo(); comp.rot=((comp.rot||0)+90)%360; renderCanvas(); markDirty(); }
    else if(act==='design'){ openPanelDesigner(comp.id); }
    else if(act==='del'){ deleteComponent(comp.id); }
  }));
}
function hideCtxMenu(){ document.getElementById('ctxMenu').style.display='none'; }

/* ============================================================
   CANVAS INTERACTION
   ============================================================ */
let spaceHeld=false;
function initInteraction(){
  const svg=svgEl();

  svg.addEventListener('mousedown',e=>{
    hideCtxMenu();
    if(e.button===1 || ui.tool==='pan' || spaceHeld){
      e.preventDefault(); isPanning=true; panMoved=false; panStart={x:e.clientX,y:e.clientY}; panViewStart={x:view.x,y:view.y};
      svg.classList.add('panning'); return;
    }
    if(ui.tool==='select'){
      const swEl=e.target.closest('[data-switch]');
      if(swEl){ e.stopPropagation(); suppressClick=true; toggleSwitch(parseInt(swEl.dataset.switch)); return; }
      const wpEl=e.target.closest('[data-wp]');
      if(wpEl){ e.stopPropagation(); wpDrag={ connId:parseInt(wpEl.dataset.wp), index:parseInt(wpEl.dataset.wpi) }; dragMoved=false; pushUndo(); return; }
      const iconEl=e.target.closest('[data-id]');
      if(iconEl){ e.stopPropagation(); dragId=parseInt(iconEl.dataset.id); dragMoved=false; return; }
      const wallEl=e.target.closest('[data-wall-id]');
      if(wallEl){ ui.selectedWallId=parseInt(wallEl.dataset.wallId); ui.selectedId=null; ui.selectedConnId=null; renderAll(); return; }
      const connEl=e.target.closest('[data-conn-id]');
      if(connEl){ ui.selectedConnId=parseInt(connEl.dataset.connId); ui.selectedId=null; ui.selectedWallId=null; renderAll(); return; }
      // start a pan by dragging empty space
      isPanning=true; panMoved=false; panStart={x:e.clientX,y:e.clientY}; panViewStart={x:view.x,y:view.y}; svg.classList.add('panning');
    }
  });

  svg.addEventListener('click',e=>{
    if(suppressClick){ suppressClick=false; return; }
    const tool=ui.tool;
    if(tool==='place' && ui.placeType){ const p=svgPoint(e); addComponent(ui.placeType,p.x,p.y); return; }
    if(tool==='wire'){ handleWireClick(e); return; }
    if(tool==='wall'){ handleWallClick(e); return; }
    if(tool==='select'){
      if(e.target.closest('[data-id]')||e.target.closest('[data-wall-id]')||e.target.closest('[data-conn-id]')) return;
      ui.selectedId=null; ui.selectedWallId=null; ui.selectedConnId=null; renderAll();
    }
  });

  svg.addEventListener('dblclick',e=>{
    if(ui.tool==='wall'){ e.preventDefault(); ui.wallDraftStart=null; ui.wallPreviewPoint=null; renderCanvas(); return; }
    if(ui.tool==='select'){
      const wpEl=e.target.closest('[data-wp]');
      if(wpEl){ e.preventDefault(); const conn=state.connections.find(c=>c.id===parseInt(wpEl.dataset.wp)); const i=parseInt(wpEl.dataset.wpi); if(conn&&conn.points){ pushUndo(); conn.points.splice(i,1); renderAll(); markDirty(); } return; }
      const connEl=e.target.closest('[data-conn-id]');
      if(connEl){ e.preventDefault(); const conn=state.connections.find(c=>c.id===parseInt(connEl.dataset.connId)); if(conn) addBendAt(conn, snap(svgPoint(e))); }
    }
  });

  svg.addEventListener('contextmenu',e=>{
    const iconEl=e.target.closest('[data-id]');
    if(iconEl){ e.preventDefault(); const c=findComp(parseInt(iconEl.dataset.id)); if(c){ ui.selectedId=c.id; renderAll(); showCtxMenu(e.clientX,e.clientY,c); } }
  });

  window.addEventListener('mousemove',e=>{
    ui.mouseWorld=svgPoint(e);
    if(isPanning && panStart){
      panMoved=true;
      const svgRect=svg.getBoundingClientRect();
      const scaleX=view.w/svgRect.width, scaleY=view.h/svgRect.height;
      view.x=panViewStart.x-(e.clientX-panStart.x)*scaleX;
      view.y=panViewStart.y-(e.clientY-panStart.y)*scaleY;
      applyView(); return;
    }
    if(wpDrag){
      dragMoved=true;
      const conn=state.connections.find(c=>c.id===wpDrag.connId);
      if(conn && conn.points && conn.points[wpDrag.index]){ const p=snap(svgPoint(e)); conn.points[wpDrag.index]={x:p.x,y:p.y}; renderCanvas(); }
      return;
    }
    if(dragId!==null){
      dragMoved=true;
      const p=snap(svgPoint(e));
      const comp=findComp(dragId);
      if(comp){ comp.x=p.x; comp.y=p.y; renderCanvas(); }
      return;
    }
    if(ui.tool==='wall' && ui.wallDraftStart){ ui.wallPreviewPoint=snap(svgPoint(e)); renderCanvas(); return; }
    if(ui.tool==='wire' && ui.wireDraft){ ui.wirePreview=snap(svgPoint(e)); renderCanvas(); return; }
    if(ui.tool==='place'){ renderCanvas(); }
  });

  window.addEventListener('mouseup',()=>{
    if(isPanning){ isPanning=false; svg.classList.remove('panning'); if(panMoved) suppressClick=true; panMoved=false; return; }
    if(wpDrag){ if(dragMoved){ suppressClick=true; markDirty(); renderSidebar(); } wpDrag=null; dragMoved=false; return; }
    if(dragId===null) return;
    if(!dragMoved){ ui.selectedId=dragId; ui.selectedWallId=null; ui.selectedConnId=null; renderAll(); }
    else { suppressClick=true; pushUndo(); markDirty(); renderSidebar(); }
    dragId=null; dragMoved=false;
  });

  // wheel zoom at cursor
  svg.addEventListener('wheel',e=>{
    e.preventDefault();
    const p=svgPoint(e);
    zoomAt(e.deltaY<0?1.12:1/1.12, p.x, p.y);
  },{passive:false});

  // keyboard
  window.addEventListener('keydown',e=>{
    const tag=(document.activeElement&&document.activeElement.tagName)||'';
    const typing = tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA';
    if(e.key===' ' && !typing){ spaceHeld=true; svg.classList.add('pan-mode'); }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); saveProject(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='d' && ui.selectedId!=null && !typing){ e.preventDefault(); duplicateComponent(ui.selectedId); return; }
    if(typing) return;
    if(e.key==='Escape'){ ui.wallDraftStart=null; ui.wallPreviewPoint=null; ui.pendingWireFrom=null; ui.wireDraft=null; ui.wirePreview=null; if(ui.tool==='place') setTool('select'); hideCtxMenu(); renderCanvas(); }
    else if(e.key==='Delete'||e.key==='Backspace'){
      if(ui.selectedId!=null) deleteComponent(ui.selectedId);
      else if(ui.selectedWallId!=null) deleteWall(ui.selectedWallId);
      else if(ui.selectedConnId!=null) deleteConnection(ui.selectedConnId);
    }
    else if(e.key.toLowerCase()==='v') setTool('select');
    else if(e.key.toLowerCase()==='w') setTool('wire');
    else if(e.key.toLowerCase()==='l') setTool('wall');
    else if(e.key.toLowerCase()==='h') setTool('pan');
    else if(e.key.toLowerCase()==='r' && ui.selectedId!=null){ const c=findComp(ui.selectedId); if(c){ pushUndo(); c.rot=((c.rot||0)+90)%360; renderCanvas(); markDirty(); } }
  });
  window.addEventListener('keyup',e=>{ if(e.key===' '){ spaceHeld=false; if(ui.tool!=='pan') svg.classList.remove('pan-mode'); } });

  document.addEventListener('click',e=>{ if(!e.target.closest('#ctxMenu')) hideCtxMenu(); });
  document.getElementById('modalOverlay').addEventListener('click',e=>{ if(e.target.id==='modalOverlay') closeModal(); });
  window.addEventListener('resize',applyView);
}

function handleWireClick(evt){
  const el=evt.target.closest('[data-id]');
  // clicking a device
  if(el){
    const id=parseInt(el.dataset.id);
    if(!ui.wireDraft){ ui.wireDraft={ from:id, points:[] }; ui.wirePreview=null; updateHint(); renderCanvas(); return; }
    if(ui.wireDraft.from===id){ ui.wireDraft=null; ui.wirePreview=null; renderCanvas(); return; } // cancel on self
    tryConnect(ui.wireDraft.from, id, ui.wireDraft.points);
    ui.wireDraft=null; ui.wirePreview=null;
    renderAll(); markDirty();
    return;
  }
  // clicking empty space
  if(ui.wireDraft){ ui.wireDraft.points.push(snap(svgPoint(evt))); renderCanvas(); return; }
  // nothing started, clicked empty -> clear
  ui.wireDraft=null; ui.wirePreview=null; renderCanvas();
}
function addBendAt(conn, p){
  // insert the new point into whichever segment it is closest to
  const path=wirePath(conn);
  if(!path) return;
  let best=0, bestD=Infinity;
  for(let i=1;i<path.length;i++){
    const a=path[i-1], b=path[i];
    const dx=b.x-a.x, dy=b.y-a.y;
    const len2=dx*dx+dy*dy || 1;
    let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/len2; t=clamp(t,0,1);
    const cx=a.x+dx*t, cy=a.y+dy*t;
    const d=Math.hypot(p.x-cx,p.y-cy);
    if(d<bestD){ bestD=d; best=i-1; } // segment index (0 = before first interior point)
  }
  pushUndo();
  conn.points=conn.points||[];
  conn.points.splice(best, 0, {x:p.x,y:p.y});
  renderAll(); markDirty();
}
function handleWallClick(evt){
  const p=snap(svgPoint(evt));
  if(ui.wallDraftStart===null){ ui.wallDraftStart=p; }
  else {
    pushUndo();
    state.walls.push({ id:state.counters.wall++, x1:ui.wallDraftStart.x, y1:ui.wallDraftStart.y, x2:p.x, y2:p.y });
    ui.wallDraftStart=p; markDirty();
  }
  renderCanvas();
}

/* ============================================================
   BOOT
   ============================================================ */
/* -------- onboarding: first-run welcome + Help button ---------------- */
function wlIcon(type){
  const d=LIB_BY_TYPE[type]; if(!d) return '';
  return `<svg viewBox="-21 -21 42 42" xmlns="http://www.w3.org/2000/svg">${iconInner(d.shape, d.cat?catColor(d.cat):'#f0a830', {type:d.type}, {powered:true,on:true})}</svg>`;
}
function showWelcome(){
  openModal(`<div class="modal-title">&#9889; Welcome to Circuit Planner <span class="brand-eu">EU</span></div>
    <div class="wl-sub">Design EU electrical installations, then train on them \u2014 every part is drawn like the real product and carries a datasheet.</div>
    <div class="wl-grid">
      <div class="wl-step"><div class="wl-ico">${wlIcon('outlet')}</div><div><h4><span class="wl-num">1</span>Place &amp; learn</h4><p>Drag parts from the library onto the plan. <b>Hover any part</b> for its EU info card: terminals, safety notes and classic beginner mistakes. Click to pin it.</p></div></div>
      <div class="wl-step"><div class="wl-ico">${wlIcon('mcb')}</div><div><h4><span class="wl-num">2</span>Wire &amp; operate</h4><p>Connect circuits and watch power flow. Switches, MCBs, RCBOs, contactors and thermostats are <b>click-to-operate</b> \u2014 trip a breaker and everything downstream goes dead.</p></div></div>
      <div class="wl-step"><div class="wl-ico">${wlIcon('panel')}</div><div><h4><span class="wl-num">3</span>Panels &amp; loads</h4><p>The <b>Panels</b> tab is a hands-on breaker board \u2014 isolate, land wires, energise, test. <b>Load Calc</b> totals demand for the whole installation.</p></div></div>
      <div class="wl-step"><div class="wl-ico">${wlIcon('condenser')}</div><div><h4><span class="wl-num">4</span>Train on A/C</h4><p>The <b>A/C Trainer</b> wires a real split system through meter, RCCB and isolator \u2014 inject faults, probe with the multimeter, pass the checker.</p></div></div>
    </div>
    <div class="wl-foot">Tip: the <b>Real</b> toggle in the toolbar switches between photo-real drawings and classic symbols. Reopen this tour any time with <b>&#10067; Help</b>.</div>
    <div class="modal-actions"><button class="primary-btn" id="wlGo">Start planning</button></div>`);
  const b=document.getElementById('wlGo');
  if(b) b.addEventListener('click',()=>{ try{ localStorage.setItem('cp_welcome_v1','1'); }catch(e){} closeModal(); });
}
function initOnboarding(){
  const h=document.getElementById('btnHelp');
  if(h) h.addEventListener('click',showWelcome);
  let seen=null; try{ seen=localStorage.getItem('cp_welcome_v1'); }catch(e){}
  if(!seen) setTimeout(showWelcome,450);
}
function wireAppbar(){
  document.getElementById('btnNew').addEventListener('click',newProject);
  document.getElementById('btnOpen').addEventListener('click',openProjectPicker);
  document.getElementById('btnSave').addEventListener('click',saveProject);
  document.getElementById('btnExport').addEventListener('click',exportJSON);
  document.getElementById('btnImport').addEventListener('click',()=>document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change',e=>{ if(e.target.files[0]){ importJSON(e.target.files[0]); e.target.value=''; } });
  document.getElementById('projName').addEventListener('input',()=>{ state.meta.name=document.getElementById('projName').value; markDirty(); });
  document.getElementById('partSearch').addEventListener('input',e=>{ ui.partFilter=e.target.value; renderPartLibrary(); });
  document.getElementById('addCustomBtn').addEventListener('click',openCustomPart);
  document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
}

function boot(){
  // try to restore autosave
  let restored=false;
  try{
    const saved=localStorage.getItem(LS_AUTOSAVE);
    if(saved){ deserialize(saved); restored=true; }
  }catch(e){ /* ignore */ }
  if(!restored){ document.getElementById('projName').value=state.meta.name; }

  wireAppbar();
  renderToolbar();
  renderPartLibrary();
  initInteraction();
  initCompInfo();
  initOnboarding();
  initPanelInteractions();
  setTool('select');
  setTab('floorplan');
  applyView();
  fitView();
  renderAll();
  document.getElementById('saveState').textContent = restored?'restored':'new project';
}
boot();
