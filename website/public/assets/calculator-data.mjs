import {defaultRoom,LIMITS,BUILDING_OPTIONS,ORIENTATIONS,SHADING_OPTIONS,EQUIPMENT_OPTIONS,postalInfo,sizeProject} from './calculator-model.mjs';
export const STORAGE_KEY='mdm_ac_calculator_v2';
export const parseNumber=value=>{const raw=String(value??'').trim().replace(',','.');return raw===''?null:/^\d+(?:\.\d+)?$/.test(raw)?Number(raw):NaN;};
export function cleanState(raw){
 const base={step:0,rooms:[defaultRoom()],building:'unknown',heating:false,postal:'',zone:'auto',winter:'auto'};
 if(!raw||!Array.isArray(raw.rooms)||raw.rooms.length<1||raw.rooms.length>LIMITS.rooms.max)return base;
 const keys={orientation:ORIENTATIONS,shading:SHADING_OPTIONS,equipment:EQUIPMENT_OPTIONS};
 base.rooms=raw.rooms.map((value,i)=>{const room=defaultRoom(i);if(!value||typeof value!=='object')return room;room.name=typeof value.name==='string'?value.name.slice(0,30):'';for(const field of ['area','height','windows','people'])room[field]=typeof value[field]==='number'&&Number.isFinite(value[field])?value[field]:null;for(const [key,options] of Object.entries(keys))if(options.some(o=>o.key===value[key]))room[key]=value[key];room.topFloor=value.topFloor===true;return room;});
 if(BUILDING_OPTIONS.some(o=>o.key===raw.building))base.building=raw.building;
 base.heating=raw.heating===true;base.postal=typeof raw.postal==='string'?raw.postal.slice(0,8):'';
 if(['auto','V1','V2','V3'].includes(raw.zone))base.zone=raw.zone;
 if(['auto','I1','I2','I3'].includes(raw.winter))base.winter=raw.winter;
 // Always reopen the inputs; never restore a stale recommendation as a result.
 return base;
}
export function contextFor(state){const place=postalInfo(state.postal);return {building:state.building,heating:state.heating,zone:state.zone==='auto'?(place.zone||'V2'):state.zone,winter:state.winter==='auto'?(place.winter||'I1'):state.winter,diversity:false,prices:null};}
export function quoteFromCalculation(state,language='pt'){
 const en=language==='en',p=sizeProject(state.rooms,contextFor(state)),place=postalInfo(state.postal);
 if(!p.allValid||!place.valid)throw Error('invalid_calculation');
 const n=(v,d=1)=>Number(v).toFixed(d).replace('.',en?'.':',');
 const lines=[en?'Indicative AC calculation — subject to technical assessment.':'Estimativa de ar condicionado — sujeita a avaliação técnica.',(en?'Postal code: ':'Código postal: ')+place.formatted];
 p.rooms.forEach((r,i)=>{const name=state.rooms[i].name||(en?'Room ':'Divisão ')+(i+1);lines.push(`${name}: ${n(r.room.area)} m²; ${n(r.room.height,0)} cm; ${en?'glass':'vidro'} ${n(r.room.windows)} m²; ${r.room.orientation}/${r.room.shading}; ${r.room.people??2} ${en?'people':'pessoas'}; ${r.room.equipment}; ${en?'top floor':'último andar'} ${r.room.topFloor?(en?'yes':'sim'):(en?'no':'não')}. ${en?'Load':'Carga'} ${n(r.loadW/1000)} kW → ${r.units} × ${r.unit.btu} BTU/h.`);});
 lines.push((en?'Insulation: ':'Isolamento: ')+state.building+'; '+(en?'heating: ':'aquecimento: ')+(state.heating?(en?'yes':'sim'):(en?'no':'não'))+'; '+contextFor(state).zone+'/'+contextFor(state).winter+'.');
 lines.push(`${en?'Total estimated load':'Carga total estimada'}: ${n(p.totalLoadW/1000)} kW. ${en?'Indoor capacity':'Capacidade interior'}: ${n(p.totalUnitKW)} kW / ${p.totalUnitBTU} BTU/h.`);
 if(p.rooms.some(r=>r.heating&&!r.heating.ok))lines.push(en?'Heating capacity requires technical review.':'A potência de aquecimento requer revisão técnica.');
 lines.push(en?'Price on request.':'Preço sob orçamento.');
 const summary=lines.join('\n');if(summary.length>1500)throw Error('summary_too_long');
 return {summary,location:place.formatted,purpose:'Instalação',service:'Ar condicionado'};
}
