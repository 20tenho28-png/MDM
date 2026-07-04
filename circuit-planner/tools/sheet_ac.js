const fs=require('fs');
const appSrc=fs.readFileSync(require('path').join(__dirname,'../test/app_extracted.js'),'utf-8');
const noop=()=>{};
const elCache={};
const fakeEl=()=>{ const el={addEventListener:noop,setAttribute:noop,classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},style:{},dataset:{},_html:'',value:'',checked:false,appendChild:noop,querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800}),focus:noop,closest:()=>null,files:[]};
Object.defineProperty(el,'innerHTML',{get(){return this._html},set(v){this._html=v}}); return el; };
global.document={getElementById:(id)=>elCache[id]||(elCache[id]=fakeEl()),querySelector:()=>fakeEl(),querySelectorAll:()=>[],createElement:()=>fakeEl(),addEventListener:noop,activeElement:null,body:fakeEl()};
global.window=global;global.localStorage={getItem:()=>null,setItem:noop};global.addEventListener=noop;global.confirm=()=>false;global.alert=noop;global.navigator={};global.location={};global.Blob=class{};global.URL={createObjectURL:()=>''};global.FileReader=class{};
let out='';
const build=`
;(function(){
  /* -- part icon strip: 7 new parts, ON+powered vs OFF -- */
  const parts=[['contactor','#e8a13d'],['relay','#e8a13d'],['mcb','#e8a13d'],['rcbo','#e8a13d'],['terminal','#e8a13d'],['thermostat','#e8a13d'],['pressuresw','#e8a13d']];
  let cells='';
  parts.forEach(([t,col],i)=>{
    const d=LIB_BY_TYPE[t];
    [[true,true,'ON'],[false,true,'OFF']].forEach(([on,powered,tag],j)=>{
      const x=40+i*110, y=60+j*120;
      cells+='<g transform="translate('+x+' '+y+') scale(2.2)">'+iconInner(d.shape,col,{type:t},{powered,on})+'</g>';
      cells+='<text x="'+x+'" y="'+(y+58)+'" font-size="11" fill="#333" text-anchor="middle">'+t+' '+tag+'</text>';
    });
  });
  const htmlSrc=require('fs').readFileSync(require('path').join(__dirname,'../circuit_planner.html'),'utf-8');
  const dm=htmlSrc.match(/<defs>[\\s\\S]*?<\\/defs>/);
  const defsStr=dm?dm[0]:'';
  global.__parts='<svg xmlns="http://www.w3.org/2000/svg" width="820" height="300" viewBox="0 0 820 300"><rect width="820" height="300" fill="#f4f6f8"/>'+defsStr+cells+'</svg>';
  /* -- AC trainer scenes -- */
  global.__ac={};
  for(const unit of ['single','lns','three']){
    state.acBench.unit=unit; state.acBench.comp='none'; state.acBench.powerOn=false;
    acAutoWire&&acAutoWire();
    renderACTab();
    const html=elCache['acWrap']._html;
    const m=html.match(/<svg id="acSvg"[\\s\\S]*?<\\/svg>/);
    global.__ac[unit]=m?m[0]:'';
  }
})();`;
eval(appSrc+build);
fs.writeFileSync(require('path').join(__dirname,'out_')+'parts2.svg',global.__parts);
for(const u of Object.keys(global.__ac)) fs.writeFileSync(require('path').join(__dirname,'out_')+'ac_'+u+'.svg',global.__ac[u]);
console.log('svg sizes:',global.__parts.length,Object.entries(global.__ac).map(([k,v])=>k+':'+v.length).join(' '));
