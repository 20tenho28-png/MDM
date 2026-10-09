import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultRoom,roomLoad,validateRoom,sizeProject,postalInfo} from '../public/assets/calculator-model.mjs';
import {parseNumber,cleanState,contextFor,quoteFromCalculation} from '../public/assets/calculator-data.mjs';
const room=(patch={})=>({...defaultRoom(),area:20,windows:3,...patch});
const state=(rooms=[room()],patch={})=>({...cleanState(null),rooms,postal:'1990-426',building:'mid',...patch});
test('reference calculation separates thermal load, conversion and unit class',()=>{
 const r=roomLoad(room(),{building:'mid',zone:'V2'});
 // 20 × 2.6 × 35 envelope + 3 × 220 solar + 2 × 100 occupants + 100 equipment, with 5% margin.
 assert.equal(r.loadW,2920);assert.equal(r.loadBTU,9960);assert.equal(r.unit.coolKW,3.5);assert.equal(r.unit.btu,12000);assert.equal(r.units,1);
});
test('greater solar exposure, people, roof, equipment and poor insulation increase load',()=>{
 const base=roomLoad(room(),{building:'mid'}).loadW;
 for(const r of [room({windows:8}),room({people:7}),room({topFloor:true}),room({equipment:'kitchen'}),room({orientation:'O'})])assert.ok(roomLoad(r,{building:'mid'}).loadW>base);
 assert.ok(roomLoad(room(),{building:'old'}).loadW>base);assert.ok(roomLoad(room(),{building:'new'}).loadW<base);
 assert.ok(roomLoad(room({shading:'blinds_out'}),{building:'mid'}).loadW<base);
 assert.ok(roomLoad(room(),{building:'mid',zone:'V3'}).loadW>base);
});
test('invalid numbers, bounds and fractional occupancy block results',()=>{
 for(const patch of [{area:null},{area:NaN},{area:Infinity},{area:3.9},{area:120.1},{height:219},{height:451},{windows:-1},{windows:61},{people:13},{people:1.5},{orientation:'bad'}])assert.equal(validateRoom(room(patch)).ok,false);
 assert.equal(validateRoom(room({area:4,height:220,windows:0,people:0})).ok,true);
 assert.equal(parseNumber('12,5'),12.5);assert.equal(parseNumber('12.5'),12.5);assert.equal(parseNumber(''),null);
 for(const raw of ['1e5','4m2','-5','Infinity','1,2,3'])assert.ok(Number.isNaN(parseNumber(raw)));
 assert.equal(sizeProject([]).allValid,false);assert.equal(sizeProject(Array.from({length:6},()=>room())).allValid,false);
});
test('no valid cooling calculation exceeds the nominal capacity it selects',()=>{
 let sawMultiple=false;
 for(let area=4;area<=120;area+=.5){const r=roomLoad(room({area,windows:8,topFloor:true}),{building:'old',zone:'V3'});assert.equal(r.ok,true);assert.ok(r.unit.coolKW*1000*r.units>=r.loadW);sawMultiple ||= r.units>1;}
 assert.equal(sawMultiple,true);
});
test('winter shortfall is reported and multi-split covers simultaneous demand',()=>{
 const r=roomLoad(room({windows:15,shading:'blinds_out',orientation:'N'}),{building:'old',heating:true,winter:'I3'});assert.equal(r.heating.ok,false);
 const s=state([room({area:12,windows:1}),room({area:14,windows:1}),room({area:10,windows:1})],{heating:true});
 const p=sizeProject(s.rooms,contextFor(s)),multi=p.options.find(o=>o.kind==='multi');assert.ok(multi);assert.ok(multi.outdoor.coolKW*1000>=p.totalLoadW);
 assert.ok(multi.outdoor.heatKW*.9*1000>=p.rooms.reduce((sum,r)=>sum+r.heating.loadW,0));
});
test('postcodes validate format and unknown ranges never invent a region',()=>{
 assert.equal(postalInfo('1990-426').inAML,true);assert.equal(postalInfo('1990426').formatted,'1990-426');assert.equal(postalInfo('8000-100').inAML,false);
 for(const raw of ['','1990','1990-426abc','999-9999','abc1990426','0999-001'])assert.equal(postalInfo(raw).valid,false);
 const p=postalInfo('3900-100');assert.equal(p.valid,true);assert.equal(p.mapped,false);assert.equal(p.district,'');
});
test('local drafts are bounded, sanitized and restart on the first step',()=>{
 const s=cleanState({step:3,rooms:[{...room(),id:'"><img>',name:'x'.repeat(80),orientation:'bad'}],building:'__proto__',heating:'true',zone:'wrong'});
 assert.equal(s.step,0);assert.equal(s.rooms[0].name.length,30);assert.doesNotMatch(s.rooms[0].id,/[<>]/);assert.equal(s.rooms[0].orientation,'S');assert.equal(s.building,'unknown');assert.equal(s.heating,false);assert.equal(s.zone,'auto');
 assert.equal(cleanState({rooms:Array(100).fill(room())}).rooms.length,1);
});
test('prices remain absent and five-room summaries fit the existing quote form',()=>{
 const rooms=Array.from({length:5},()=>room({name:'Quarto principal com escritório'.slice(0,30),area:120,height:450,windows:60,people:12,equipment:'kitchen',shading:'blinds_out',topFloor:true}));
 const s=state(rooms,{heating:true,building:'unknown',winter:'I3'}),p=sizeProject(rooms,contextFor(s));assert.ok(p.options.every(o=>o.price===null));
 for(const language of ['pt','en']){const q=quoteFromCalculation(s,language);assert.ok(q.summary.length<=1500);assert.equal(q.location,'1990-426');assert.equal(q.purpose,'Instalação');assert.match(q.summary,language==='pt'?/Preço sob orçamento/:/Price on request/);assert.doesNotMatch(q.summary,/€/);assert.equal((q.summary.match(/24000 BTU\/h/g)||[]).length,5);}
 assert.throws(()=>quoteFromCalculation(state([room({area:null})])));assert.throws(()=>quoteFromCalculation(state([room()],{postal:'invalid'})));
});
test('both packaged calculator pages include the module, accessible quote form and translated metadata',()=>{
 for(const lang of ['','en/']){const page=fs.readFileSync('dist/client/'+lang+'calculadora.html','utf8');assert.match(page,/type="module" src="\/assets\/calculator.js"/);assert.match(page,/id="quote-form"/);assert.match(page,/maxlength="1500"/);assert.match(page,lang?/<html lang="en">/:/<html lang="pt-PT">/);assert.match(page,lang?/Air conditioning calculator/:/Calculadora de ar condicionado/);}
 const missing=JSON.parse(fs.readFileSync('i18n/missing.json','utf8'));assert.deepEqual(missing,[]);
});
