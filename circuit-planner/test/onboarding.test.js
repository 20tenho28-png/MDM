const fs=require('fs');
const appSrc=fs.readFileSync(require("path").join(__dirname,"app_extracted.js"),'utf-8');
const noop=()=>{};
const elCache={}; const listeners={};
const fakeEl=(id)=>{ const el={ id, addEventListener:(ev,fn)=>{(listeners[id+':'+ev]=listeners[id+':'+ev]||[]).push(fn);},removeEventListener:noop,setAttribute:noop,getAttribute:()=>null,
  classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},style:{},dataset:{},_html:'',textContent:'',value:'',checked:false,
  appendChild:noop,querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800}),focus:noop,click(){ (listeners[id+':click']||[]).forEach(f=>f({target:this})); },closest:()=>null,insertAdjacentHTML:noop,remove:noop,files:[] };
  Object.defineProperty(el,'innerHTML',{get(){return this._html;},set(v){this._html=v;}});
  return el; };
global.document={ getElementById:(id)=>elCache[id]||(elCache[id]=fakeEl(id)), querySelector:()=>fakeEl('q'), querySelectorAll:()=>[],
  createElement:()=>fakeEl('ce'), addEventListener:noop, activeElement:null, body:fakeEl('body') };
let stored={}; global.localStorage={getItem:k=>stored[k]||null,setItem:(k,v)=>{stored[k]=v;}};
global.window=global;global.addEventListener=noop;global.requestAnimationFrame=noop;global.confirm=()=>false;global.alert=noop;global.navigator={};global.location={};
let timeouts=[]; global.setTimeout=(fn,ms)=>{timeouts.push(fn);return 1;};
eval(appSrc+`
;(function(){
  let fails=0;
  /* boot scheduled the first-run welcome */
  if(!timeouts.length){ console.log('no first-run timeout scheduled'); fails++; }
  timeouts.forEach(f=>f());
  const mb=elCache['modalBox'];
  if(!mb||!mb._html.includes('Welcome to Circuit Planner')){ console.log('welcome modal missing'); fails++; }
  for(const bit of ['Place &amp; learn','Wire &amp; operate','Panels &amp; loads','Train on A/C','<svg viewBox="-21 -21 42 42"'])
    if(!mb._html.includes(bit)){ console.log('missing modal bit:',bit); fails++; }
  if(elCache['modalOverlay'].style.display!=='flex'){ console.log('overlay not shown'); fails++; }
  /* Start planning sets the flag and closes */
  elCache['wlGo'].click();
  if(stored['cp_welcome_v1']!=='1'){ console.log('flag not set'); fails++; }
  if(elCache['modalOverlay'].style.display!=='none'){ console.log('overlay not closed'); fails++; }
  /* Help button reopens */
  elCache['btnHelp'].click();
  if(elCache['modalOverlay'].style.display!=='flex'){ console.log('help does not reopen'); fails++; }
  console.log(fails===0?'ONBOARDING PASSED — first-run show, flag, close, Help reopen':'FAILURES: '+fails);
  if(fails) process.exitCode=1;
})();`);
