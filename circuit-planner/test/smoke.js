const fs=require('fs');
const appSrc=fs.readFileSync(require("path").join(__dirname,"app_extracted.js"),'utf-8');
const noop=()=>{};
const elCache={};
const fakeEl=(id)=>{
  const el={ addEventListener:noop,removeEventListener:noop,setAttribute:noop,getAttribute:()=>null,
  classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},style:{},dataset:{},_html:'',textContent:'',value:'',checked:false,
  appendChild:noop,querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800}),
  focus:noop,click:noop,closest:()=>null,insertAdjacentHTML:noop,remove:noop,offsetWidth:296,offsetHeight:300,files:[] };
  Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}});
  return el;
};
global.document={ getElementById:(id)=>elCache[id]||(elCache[id]=fakeEl(id)), querySelector:()=>fakeEl(), querySelectorAll:()=>[],
  createElement:()=>fakeEl(), createElementNS:()=>fakeEl(), addEventListener:noop, activeElement:null, body:fakeEl() };
global.window=global;global.localStorage={getItem:()=>null,setItem:noop};global.addEventListener=noop;global.requestAnimationFrame=noop;
global.confirm=()=>false;global.alert=noop;global.prompt=()=>null;global.navigator={};global.getComputedStyle=()=>({getPropertyValue:()=>''});
global.location={reload:noop};global.Blob=class{};global.URL={createObjectURL:()=>'',revokeObjectURL:noop};global.FileReader=class{readAsText(){}};

const testSrc=`
;(function(){
  let fails=0;
  /* --- batch-2 renderers: on/off x powered/unpowered --- */
  const parts=['contactor','relay','mcb','rcbo','terminal','thermostat','pressuresw'];
  for(const t of parts){
    const d=LIB_BY_TYPE[t];
    if(!d){ console.log('MISSING LIB ENTRY',t); fails++; continue; }
    if(!realRenderFor(d.shape,{type:t})){ console.log('NO RENDERER',t); fails++; continue; }
    for(const on of [true,false]) for(const powered of [true,false]){
      const svg=iconInner(d.shape,'#e8a13d',{type:t},{powered,on});
      if(!svg||svg.length<200){ console.log('BAD SVG',t,on,powered); fails++; }
      if(((svg.match(/"/g)||[]).length)%2!==0){ console.log('UNBALANCED QUOTES',t); fails++; }
    }
    const info=compInfoFor({type:t});
    if(!info||!info.purpose||!info.terminals||!info.safety||!info.mistakes){ console.log('MISSING INFO',t); fails++; }
  }
  /* switch semantics: new gear must toggle & block power via existing logic */
  for(const t of ['contactor','relay','mcb','rcbo','thermostat','pressuresw'])
    if(!isSwitchType(t)){ console.log('NOT A SWITCH TYPE',t); fails++; }
  if(!isNodeType('terminal')){ console.log('terminal NOT node'); fails++; }
  if(isSwitchType('terminal')){ console.log('terminal wrongly a switch'); fails++; }
  /* category present */
  if(!CATEGORIES.find(c=>c.key==='ctrl')){ console.log('NO ctrl CATEGORY'); fails++; }
  /* place a contactor and toggle it through real app functions */
  addComponent("contactor",300,300); const c=state.components.find(x=>x.type==="contactor");
  if(!c){ console.log('addComponent failed'); fails++; }
  else{ toggleSwitch(c.id); if(switchOn(c)!==false){ console.log('toggle failed'); fails++; } toggleSwitch(c.id); }
  /* --- AC trainer: full render in all 3 modes, both running states --- */
  for(const unit of ['single','lns','three']){
    state.acBench.unit=unit;
    try{
      renderACTab();
      const html=document.getElementById('acWrap').innerHTML;
      if(!html.includes('acSvg')){ console.log('NO acSvg for',unit); fails++; }
      for(const bit of ['INSIDE \\u00b7 METER BOARD','OUTSIDE','acBrick','HERMETIC COMPRESSOR','HERM','35\\u00b5F','cross-flow blower','fan guard','kWh METER'])
        if(!html.includes(bit)){ console.log('MISSING SCENE BIT',unit,bit); fails++; }
      if(unit==='lns'){ for(const bit of ['test monthly','OT40']) if(!html.includes(bit)){ console.log('MISSING DIN BIT',bit); fails++; } }
    }catch(e){ console.log('renderACTab THREW for',unit,e.message); fails++; }
  }
  /* fault visuals still render */
  state.acBench.unit='single'; state.acBench.comp='ground'; state.acBench.powerOn=true;
  try{ renderACTab(); }catch(e){ console.log('fault render THREW',e.message); fails++; }
  state.acBench.comp='none'; state.acBench.powerOn=false;
  /* realistic-off fallback still yields the legacy drawings */
  state.settings.realistic=false;
  const legacy=iconInner('outlet','#63b3ed',{type:'outlet'},{powered:true});
  if(!legacy.includes('plateGrad')){ console.log('LEGACY BROKEN'); fails++; }
  state.settings.realistic=true;
  /* EVERY library part renders realistic, non-empty, balanced quotes */
  for(const d of LIBRARY){
    for(const powered of [true,false]){
      const svg=iconInner(d.shape,'#63b3ed',{type:d.type},{powered,on:powered});
      if(!svg||svg.length<80){ console.log('EMPTY ICON',d.type,powered); fails++; }
      else if(((svg.match(/"/g)||[]).length)%2!==0){ console.log('QUOTES',d.type); fails++; }
      else if(svg.includes('NaN')||svg.includes('undefined')){ console.log('BAD VALUE',d.type); fails++; }
    }
  }
  console.log(fails===0?'SMOKE 3 PASSED — 7 parts x 4 states, 3 AC modes, fault mode, toggling verified':'FAILURES: '+fails);
  if(fails) process.exitCode=1;
})();`;
eval(appSrc+testSrc);
