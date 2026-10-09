'use strict';
(()=>{
 const $=s=>document.querySelector(s),tr=s=>window.MDM.t(s),host=$('#admin-list');if(!host)return;
 let offset=null,loading=false;
 const date=new Intl.DateTimeFormat(document.documentElement.lang==='en'?'en-GB':'pt-PT',{timeZone:'Europe/Lisbon',dateStyle:'medium',timeStyle:'short'});
 async function api(path,data){const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();return response.json();}
 const emailLabel=state=>tr(state==='accepted'?'Aviso aceite pelo serviço de email.':'Aviso por email pendente.');
 function card(r,configured){
  const article=document.createElement('article');article.className='admin-card';
  const title=document.createElement('h2'),p=document.createElement('p'),meta=document.createElement('small'),state=document.createElement('p'),actions=document.createElement('div');actions.className='admin-actions';
  title.textContent=r.name+' · '+tr(r.purpose);p.textContent=[tr(r.service),r.location,r.details,r.address,r.start?tr('Visita confirmada para ')+date.format(r.start):tr('A combinar visita')].filter(Boolean).join('\n');meta.textContent=r.id+' · '+date.format(r.created);state.textContent=emailLabel(r.email_status);
  for(const [label,href] of [[r.phone,r.phone?'tel:'+r.phone.replace(/[^+\d]/g,''):null],[r.email,r.email?'mailto:'+r.email:null]]){if(!href)continue;const a=document.createElement('a');a.className='text-link';a.textContent=label;a.href=href;actions.append(a);}
  if(r.email_status!=='accepted'&&configured){const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent=tr('Reenviar aviso por email');button.addEventListener('click',async()=>{button.disabled=true;try{await api('/api/status');const result=await api('/api/admin/notify',{id:r.id});state.textContent=emailLabel(result.notification);button.hidden=result.notification==='accepted';}catch{state.textContent=tr('Não foi possível enviar o aviso. O pedido continua guardado.');}finally{button.disabled=false;}});actions.append(button);}
  article.append(title,p,actions,state,meta);return article;
 }
 async function load(append=false){if(loading)return;loading=true;$('#admin-refresh').disabled=true;$('#admin-more').disabled=true;$('#admin-status').textContent=tr('A carregar pedidos…');
  try{const result=await api('/api/admin/requests?offset='+(append?offset:0));if(!append)host.replaceChildren();result.requests.forEach(r=>host.append(card(r,result.emailConfigured)));if(!host.children.length)host.textContent=tr('Ainda não há pedidos.');offset=result.nextOffset;$('#admin-more').hidden=offset===null;$('#admin-email-state').textContent=tr(result.emailConfigured?'Notificações por email configuradas. A aceitação pelo serviço não confirma a entrega na caixa de entrada.':'Envio automático de email por configurar. Consulte os pedidos nesta página.');$('#admin-status').textContent='';}
  catch{$('#admin-status').textContent=tr('Não foi possível carregar os pedidos. Confirme que tem acesso de gestão.');}
  finally{loading=false;$('#admin-refresh').disabled=false;$('#admin-more').disabled=false;}
 }
 $('#admin-refresh').addEventListener('click',()=>load());$('#admin-more').addEventListener('click',()=>load(true));load();
})();
