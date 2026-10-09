import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import worker,{candidateSlots,bookingConfig} from '../src/worker.mjs';
import builtWorker from '../dist/server/index.js';
import {cleanState,quoteFromCalculation} from '../public/assets/calculator-data.mjs';
import {defaultRoom} from '../public/assets/calculator-model.mjs';
const origin='https://mdm.example';const sid=crypto.randomUUID();
function setup(){const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));return{sqlite,env:{DB:{prepare(sql){return{bind(...args){return{async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return{results:sqlite.prepare(sql).all(...args)}},async run(){return sqlite.prepare(sql).run(...args)}}}}}},ADMIN_EMAIL:'owner@example.test',ASSETS:{fetch:async()=>new Response('static')}}};}
function request(path,data,session=sid,headers={}){return new Request(origin+path,{method:data?'POST':'GET',headers:{Origin:origin,Cookie:'mdm_session='+session,'Content-Type':'application/json',...headers},body:data?JSON.stringify(data):undefined});}
const lead=()=>({id:crypto.randomUUID(),name:'QA Example',email:'qa@example.test',phone:'',purpose:'Instalação',service:'Ar condicionado',location:'Lisboa',details:'A test request',language:'en',consent:true});
test('missing AI and calendar are reported honestly',async()=>{const {env}=setup();const r=await worker.fetch(request('/api/status'),env);assert.deepEqual(await r.json(),{ai:false,requests:true,booking:false});assert.match(r.headers.get('Set-Cookie'),/HttpOnly/);assert.equal((await worker.fetch(request('/api/chat',{messages:[{role:'user',content:'Hello'}],consent:true}),env)).status,503);assert.deepEqual(await(await worker.fetch(request('/api/availability'),env)).json(),{enabled:false,slots:[]});});
test('submission validates origin, session, consent and contacts',async()=>{const {env}=setup();for(const r of [request('/api/requests',lead(),sid,{Origin:'https://evil.example'}),request('/api/requests',lead(),'',{Cookie:''})])assert.ok([401,403].includes((await worker.fetch(r,env)).status));for(const patch of [{consent:false},{email:'wrong'},{email:'',phone:''},{purpose:'invented'},{name:''}])assert.equal((await worker.fetch(request('/api/requests',{...lead(),...patch}),env)).status,400);});
test('a request is durable, idempotent, session-bound and admin-only',async()=>{const {env,sqlite}=setup(),data=lead();assert.equal((await worker.fetch(request('/api/requests',data),env)).status,201);assert.equal((await worker.fetch(request('/api/requests',data),env)).status,200);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM requests').get().n,1);assert.equal((await worker.fetch(request('/api/requests',data,crypto.randomUUID()),env)).status,400);assert.equal((await worker.fetch(request('/api/admin/requests'),env)).status,403);const result=await worker.fetch(request('/api/admin/requests',null,sid,{'oai-authenticated-user-email':'owner@example.test'}),env);assert.equal((await result.json()).requests[0].email,'qa@example.test');for(const path of ['/gestao','/gestao.html','/en/gestao','/en/gestao.html'])assert.equal((await worker.fetch(request(path),env)).status,303);});
test('prepared SQL preserves hostile text as data',async()=>{const {env,sqlite}=setup(),data={...lead(),details:"<img src=x onerror=alert(1)> '; DROP TABLE requests; --"};await worker.fetch(request('/api/requests',data),env);assert.equal(sqlite.prepare('SELECT details FROM requests').get().details,data.details);});
test('calculator summary survives the real request endpoint without truncation',async()=>{
 const {env,sqlite}=setup(),state={...cleanState(null),postal:'1990-426',rooms:[{...defaultRoom(),name:'Sala',area:25,windows:4}]};
 const calculation=quoteFromCalculation(state,'pt'),data={...lead(),purpose:calculation.purpose,service:calculation.service,location:calculation.location,details:calculation.summary,language:'pt'};
 const response=await worker.fetch(request('/api/requests',data),env);assert.equal(response.status,201);
 const stored=sqlite.prepare('SELECT details, location FROM requests').get();assert.equal(stored.details,calculation.summary);assert.equal(stored.location,'1990-426');
});
const config={enabled:true,timezone:'Europe/Lisbon',days:[1,2,3,4,5],open:8,close:17,duration:60,buffer:30};

test('management pages are protected before static assets and never publicly packaged',async()=>{
 const {env}=setup();for(const route of ['/gestao','/gestao.html','/gestao/','/en/gestao','/en/gestao.html','/g%65stao']){
  const anonymous=await builtWorker.fetch(request(route),env);assert.equal(anonymous.status,303);assert.match(anonymous.headers.get('location'),/^\/signin-with-chatgpt\?return_to=/);assert.match(anonymous.headers.get('cache-control'),/no-store/);
  const denied=await builtWorker.fetch(request(route,null,sid,{'oai-authenticated-user-email':'other@example.test'}),env);assert.equal(denied.status,403);assert.doesNotMatch(await denied.text(),/id="admin-list"/);
  const owner=await builtWorker.fetch(request(route,null,sid,{'oai-authenticated-user-email':'owner@example.test'}),env);assert.equal(owner.status,200);assert.match(owner.headers.get('cache-control'),/no-store/);assert.match(owner.headers.get('x-robots-tag'),/noindex/);assert.match(await owner.text(),/id="admin-list"/);
 }
 assert.equal(fs.existsSync('dist/client/gestao.html'),false);assert.equal(fs.existsSync('dist/client/en/gestao.html'),false);
});

test('parallel retries create one request without losing the original details',async()=>{
 const {env,sqlite}=setup(),data=lead();const results=await Promise.all([worker.fetch(request('/api/requests',data),env),worker.fetch(request('/api/requests',data),env)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(sqlite.prepare('SELECT count(*) n FROM requests').get().n,1);
 assert.equal((await(await worker.fetch(request('/api/requests',{...data,name:'Changed replay'}),env)).json()).notification,'not_configured');assert.equal(sqlite.prepare('SELECT name FROM requests').get().name,data.name);
});

test('Resend notification uses the stored record and cannot override the recipient',async()=>{
 const {env,sqlite}=setup();Object.assign(env,{RESEND_API_KEY:'test-secret',REQUEST_EMAIL_FROM:'MDM <quotes@example.test>',REQUEST_EMAIL_TO:'mdmassistencia@gmail.com'});const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers.Authorization,'Bearer test-secret');const payload=JSON.parse(options.body);assert.deepEqual(payload.to,['mdmassistencia@gmail.com']);assert.equal(payload.reply_to,'qa@example.test');assert.match(payload.text,/A test request/);assert.match(options.headers['Idempotency-Key'],/^mdm-request-/);return Response.json({id:'test-provider-id'});};
 try{const data={...lead(),to:'attacker@example.test'};const a=await worker.fetch(request('/api/requests',data),env);assert.equal(a.status,201);assert.equal((await a.json()).notification,'accepted');await worker.fetch(request('/api/requests',data),env);assert.equal(calls,1);assert.equal(sqlite.prepare('SELECT status FROM request_notifications').get().status,'accepted');}finally{globalThis.fetch=original;}
});

test('email failure preserves the lead and only an authorized manager can retry',async()=>{
 const {env,sqlite}=setup();Object.assign(env,{RESEND_API_KEY:'test-secret',REQUEST_EMAIL_FROM:'MDM <quotes@example.test>',REQUEST_EMAIL_TO:'mdmassistencia@gmail.com'});const original=globalThis.fetch;globalThis.fetch=async()=>new Response('unavailable',{status:503});
 try{const data=lead(),r=await worker.fetch(request('/api/requests',data),env);assert.equal(r.status,201);assert.equal((await r.json()).notification,'pending');assert.equal(sqlite.prepare('SELECT count(*) n FROM requests').get().n,1);assert.equal((await worker.fetch(request('/api/admin/notify',{id:data.id}),env)).status,403);
  assert.equal((await worker.fetch(request('/api/admin/notify',{id:data.id},sid,{'oai-authenticated-user-email':'owner@example.test',Origin:'https://evil.example'}),env)).status,403);
  globalThis.fetch=async()=>Response.json({id:'retry-provider-id'});const retried=await worker.fetch(request('/api/admin/notify',{id:data.id},sid,{'oai-authenticated-user-email':'owner@example.test'}),env);assert.equal((await retried.json()).notification,'accepted');assert.equal(sqlite.prepare('SELECT attempts FROM request_notifications').get().attempts,2);
 }finally{globalThis.fetch=original;}
});

test('body limits, rate limiting and expired rate record cleanup work',async()=>{
 const {env,sqlite}=setup();assert.equal((await worker.fetch(request('/api/requests',{...lead(),details:'x'.repeat(20000)}),env)).status,400);
 sqlite.prepare('INSERT INTO rate_limits VALUES (?,?,?)').run('expired',100,0);
 for(let i=0;i<12;i++)assert.equal((await worker.fetch(request('/api/requests',lead()),env)).status,201);
 const limited=await worker.fetch(request('/api/requests',lead()),env);assert.equal(limited.status,429);assert.ok(limited.headers.get('Retry-After'));assert.equal(sqlite.prepare("SELECT key FROM rate_limits WHERE key='expired'").get(),undefined);
});

test('management pagination exposes all requests without exposing them publicly',async()=>{
 const {env,sqlite}=setup();for(let i=0;i<55;i++)sqlite.prepare('INSERT INTO requests (id,session,created,name,email,phone,purpose,service,location,details,language,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),sid,i,'QA','qa@example.test','','Instalação','Ar condicionado','Lisboa','','pt','received');
 const headers={'oai-authenticated-user-email':'owner@example.test'};
 const first=await(await worker.fetch(request('/api/admin/requests',null,sid,headers),env)).json();assert.equal(first.requests.length,50);assert.equal(first.nextOffset,50);
 const next=await(await worker.fetch(request('/api/admin/requests?offset=50',null,sid,headers),env)).json();assert.equal(next.requests.length,5);assert.equal(next.nextOffset,null);assert.equal(new Set([...first.requests,...next.requests].map(x=>x.id)).size,55);
 assert.equal((await worker.fetch(request('/api/admin/requests?offset=50'),env)).status,403);
});

test('every public sitemap page has a PT/EN counterpart, metadata and correct launch content',()=>{
 const urls=[...fs.readFileSync('dist/client/sitemap.xml','utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>new URL(m[1]).pathname);assert.equal(urls.length,66);
 for(const url of urls){const path='dist/client'+url+(url.endsWith('/')?'index.html':'.html');const page=fs.readFileSync(path,'utf8');assert.match(page,/<link rel="canonical"/);assert.match(page,/hreflang="pt-PT"/);assert.match(page,/hreflang="en"/);assert.match(page,/mdmassistencia@gmail.com/);assert.doesNotMatch(page,/mdmassist@mdmassist.com/);assert.ok(!url.includes('gestao'));}
 for(const lang of ['','en/']){const page=fs.readFileSync('dist/client/'+lang+'index.html','utf8');assert.match(page,/foto-04-1600.webp/);assert.doesNotMatch(page,/id="assistant-form"|Questões técnicas frequentes|class="topbar"/);}
 assert.equal(JSON.parse(fs.readFileSync('i18n/missing.json','utf8')).length,0);
});
test('missing pages return a real localized 404 body without an asset redirect',async()=>{
 const {env}=setup();env.ASSETS.fetch=async()=>new Response(null,{status:404,headers:{Location:'/404'}});
 for(const path of ['/missing-mdm-page','/en/missing-mdm-page']){const response=await builtWorker.fetch(request(path),env);assert.equal(response.status,404);assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('content-type'),/text\/html/);const body=await response.text();assert.match(body,path.startsWith('/en/')?/<html lang="en">/:/<html lang="pt-PT">/);assert.match(body,/<main id="conteudo">/);}
});
test('calendar applies Lisbon time, travel buffer and advance notice',()=>{const now=Date.UTC(2026,9,23,8);const slots=candidateSlots(config,now);assert.ok(slots.length>0);for(const slot of slots){assert.ok(slot.start>=now+86400000);assert.equal(slot.busyUntil-slot.end,1800000);const local=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(slot.start);assert.ok(!/Sat|Sun/.test(local));assert.ok(slot.end>slot.start);}assert.equal(bookingConfig({BOOKING_CONFIG:'{}'}),null);});
test('competing bookings cannot double-book and repeated confirmation is idempotent',async()=>{const {env,sqlite}=setup();env.BOOKING_CONFIG=JSON.stringify(config);const a=lead(),b=lead();await worker.fetch(request('/api/requests',a),env);await worker.fetch(request('/api/requests',b),env);const slots=await(await worker.fetch(request('/api/availability'),env)).json();const first={id:crypto.randomUUID(),requestId:a.id,start:slots.slots[0].start,address:'QA address 10, 1000-001 Lisboa',consent:true};const second={...first,id:crypto.randomUUID(),requestId:b.id};const results=await Promise.all([worker.fetch(request('/api/bookings',first),env),worker.fetch(request('/api/bookings',second),env)]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM bookings').get().n,1);assert.equal((await worker.fetch(request('/api/bookings',results[0].status===201?first:second),env)).status,200);const next=await(await worker.fetch(request('/api/availability'),env)).json();assert.ok(!next.slots.some(s=>s.start===first.start));assert.equal((await worker.fetch(request('/api/bookings',{...second,start:Date.now()}),env)).status,409);});
test('AI gateway keeps key server-side and validates structured output',async()=>{const {env}=setup();env.OPENAI_API_KEY='test-only-not-a-real-key';const original=globalThis.fetch;let sent;globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(options.body);return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({reply:'How many rooms?',purpose:'Instalação',service:'Ar condicionado',location:'Lisboa',details:'Apartment',ready:false})}]}]})};try{const r=await worker.fetch(request('/api/chat',{consent:true,language:'en',messages:[{role:'user',content:'I need air conditioning.'}]}),env);assert.equal(r.status,200);assert.equal((await r.json()).reply,'How many rooms?');assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);assert.match(sent.instructions,/cannot submit a request/);}finally{globalThis.fetch=original;}});
