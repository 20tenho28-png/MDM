const fs=require('fs');
const appSrc=fs.readFileSync(require('path').join(__dirname,'../test/app_extracted.js'),'utf-8');
const noop=()=>{};
const fakeEl=()=>({addEventListener:noop,setAttribute:noop,classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},style:{},dataset:{},innerHTML:'',value:'',checked:false,appendChild:noop,querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({left:0,top:0,width:1200,height:800}),focus:noop,closest:()=>null,files:[]});
global.document={getElementById:()=>fakeEl(),querySelector:()=>fakeEl(),querySelectorAll:()=>[],createElement:()=>fakeEl(),addEventListener:noop,activeElement:null,body:fakeEl()};
global.window=global;global.localStorage={getItem:()=>null,setItem:noop};global.addEventListener=noop;global.confirm=()=>false;global.alert=noop;global.navigator={};global.location={};global.Blob=class{};global.URL={createObjectURL:()=>''};global.FileReader=class{};
const build=`
;(function(){
  const types=['outlet','usboutlet','floorbox','gfci','outlet240','switch','switch3','motion','dimmer','smartsw',
    'light','outdoorlight','recessed','pendant','chandelier','fan','fanlight','ledstrip','flood','panel',
    'subpanel','splitter','ev32','smoke','co','doorbell','fridge','washer','dryer','dishwasher',
    'cooktop','range','walloven','microwave','security','icemaker'];
  let cells=''; const COLS=10;
  types.forEach((t,i)=>{
    const d=LIB_BY_TYPE[t]; if(!d){console.log('missing',t);return;}
    const x=55+(i%COLS)*105, y=70+Math.floor(i/COLS)*115;
    cells+='<g transform="translate('+x+' '+y+') scale(2.05)">'+iconInner(d.shape,'#63b3ed',{type:t},{powered:true,on:true})+'</g>';
    cells+='<text x="'+x+'" y="'+(y+52)+'" font-size="10" fill="#333" text-anchor="middle">'+t+'</text>';
  });
  const htmlSrc=require('fs').readFileSync(require('path').join(__dirname,'../circuit_planner.html'),'utf-8');
  const dm=htmlSrc.match(/<defs>[\\s\\S]*?<\\/defs>/);
  global.__sheet='<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="480" viewBox="0 0 1100 480"><rect width="1100" height="480" fill="#f4f6f8"/>'+(dm?dm[0]:'')+cells+'</svg>';
})();`;
eval(appSrc+build);
fs.writeFileSync(require('path').join(__dirname,'out_')+'basics.svg',global.__sheet);
console.log('sheet size',global.__sheet.length);
