'use strict';
const t=s=>window.MDM?.t(s)||s;
const isEnglish=document.documentElement.lang.startsWith('en');
const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
const scenes={"casa":{"credit":"Arquivo MDM","author":"MDM","kind":"OBRA MDM","isMdm":true,"src":"/assets/img/foto-04-1600.webp","caption":"Bomba de calor para moradia","alt":"Bomba de calor monobloco preta assente em lajetas de betão, no jardim de uma moradia.","source":"/obras/bomba-de-calor-para-moradia.html","label":"Ver bomba de calor na moradia","width":1200,"height":1600,"frame":"heat-pump"},"empresa":{"src":"/assets/img/foto-28-1600.webp","caption":"Midea e solar térmico na cobertura.","alt":"Unidade exterior Midea numa cobertura de Lisboa, junto a painéis solares térmicos","credit":"Ver esta obra MDM","source":"/obras/vrf-ao-lado-do-solar-termico.html","author":"MDM","label":"Ver cobertura Midea com painéis solares","width":1600,"height":1200,"kind":"OBRA MDM","isMdm":true,"frame":"solar-rooftop"},"terraco":{"src":"/assets/img/hero-hvac-pexels-30210086.jpg","caption":"Equipamentos na cobertura.","alt":"Cobertura industrial com unidade de ar condicionado, ventilação e céu azul","credit":"Alexey Baikov / Pexels","source":"https://www.pexels.com/photo/industrial-rooftop-with-hvac-unit-and-ladder-30210086/","author":"Alexey Baikov","label":"Ver instalação exterior de climatização","width":2400,"height":1600}};
function changeScene(key){
 const scene=scenes[key],image=q('#hero-image');if(!scene||!image)return;
 image.src=scene.src;image.width=scene.width;image.height=scene.height;image.alt=t(scene.alt);
 q('.hero-immersive').classList.toggle('hero-mdm-terrace',!!scene.isMdm);
 q('.hero-immersive').classList.toggle('hero-heat-pump',scene.frame==='heat-pump');
 q('.hero-immersive').classList.toggle('hero-solar-rooftop',scene.frame==='solar-rooftop');
}
qa('[data-audience]').forEach(b=>b.addEventListener('click',()=>{qa('[data-audience]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));q('#audience-note').textContent=t(b.dataset.audience==='casa'?'Sistemas residenciais selecionados em função da carga térmica, das divisões e das condições de instalação.':'Climatização de espaços comerciais e edifícios, considerando ocupação, zonamento e condições de utilização.');changeScene(b.dataset.audience);spaceChosen=false;}));
function setMenu(open,restoreFocus=false){const menu=q('.nav nav'),toggle=q('.menu-toggle');if(!menu||!toggle)return;menu.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',t(open?'Fechar menu':'Abrir menu'));if(restoreFocus)toggle.focus();}
q('.menu-toggle')?.addEventListener('click',()=>setMenu(!q('.nav nav').classList.contains('open')));
qa('.nav nav a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&q('.nav nav.open')&&!q('dialog[open]')){e.preventDefault();setMenu(false,true)}});

// Services share the same panel state for pointer and keyboard navigation.
const serviceTabs=qa('[data-service-tab]');
function selectService(id,focus=false){const selected=serviceTabs.find(b=>b.dataset.serviceTab===id);if(!selected)throw new Error('Solução não encontrada.');serviceTabs.forEach(b=>{const active=b===selected;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;q('#'+b.getAttribute('aria-controls')).hidden=!active});if(focus)selected.focus();}
serviceTabs.forEach((b,i)=>{b.addEventListener('click',()=>selectService(b.dataset.serviceTab));b.addEventListener('keydown',e=>{let target;if(['ArrowDown','ArrowRight'].includes(e.key))target=(i+1)%serviceTabs.length;if(['ArrowUp','ArrowLeft'].includes(e.key))target=(i-1+serviceTabs.length)%serviceTabs.length;if(e.key==='Home')target=0;if(e.key==='End')target=serviceTabs.length-1;if(target!==undefined){e.preventDefault();selectService(serviceTabs[target].dataset.serviceTab,true)}})});

// Filter the actual portfolio cards. No duplicate gallery data or remote requests.
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let category='all';
function filterProjects(nextCategory=category,search=q('#project-search')?.value||''){
 const valid=['all',...qa('[data-filter]').map(b=>b.dataset.filter)];
 if(!q('#project-grid')||!valid.includes(nextCategory))throw new Error('Filtro indisponível.');
 category=nextCategory;q('#project-search').value=search;const term=normalize(search.trim());let count=0;
 qa('#project-grid .project-card').forEach(card=>{const show=(category==='all'||card.dataset.category===category)&&normalize(card.dataset.search+' '+card.textContent).includes(term);card.hidden=!show;if(show)count++});
 qa('[data-filter]').forEach(b=>{const active=b.dataset.filter===category;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 q('#result-count').textContent=isEnglish?(count===1?'1 project':count+' projects'):(count===1?'1 obra':count+' obras');q('#empty-results').hidden=count!==0;return count;
}
qa('[data-filter]').forEach(b=>b.addEventListener('click',()=>filterProjects(b.dataset.filter)));
q('#project-search')?.addEventListener('input',()=>filterProjects());
q('#reset-filters')?.addEventListener('click',()=>filterProjects('all',''));

const dialog=q('#quote-dialog'),form=q('#quote-form');
let step=0,projectContext='',requestText='',lastOpener=null,spaceChosen=false;
const field=name=>form.elements.namedItem(name);
const getValue=name=>field(name).value.trim();
function goStep(next){
 step=next;qa('[data-step]').forEach((el,i)=>el.hidden=i!==step);
 qa('[data-track]').forEach((el,i)=>{el.classList.toggle('active',i===step);el.classList.toggle('done',i<step);if(i===step)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current')});
 q('#quote-back').disabled=step===0;q('#quote-next').hidden=step===3;
 q('#quote-next').textContent=t(step===2?'Rever o pedido':'Continuar');q('.step-counter').textContent=(isEnglish?'Step ':'Passo ')+(step+1)+(isEnglish?' of 4':' de 4');q('#form-error').textContent='';
 q('.copy-status').textContent='';q('[data-step="'+step+'"] h2').focus();dialog.scrollTop=0;
}
function openQuote(purpose='',service='',project=''){
 if(form?.dataset.sending==='true'){if(!dialog.open)dialog.showModal();return;}
 if(!dialog)return;lastOpener=document.activeElement;projectContext=project;
 if(purpose){const radio=qa('input[name="purpose"]').find(x=>x.value===purpose);if(radio)radio.checked=true;}
 if(service&&[...field('service').options].some(o=>o.value===service))field('service').value=service;
 const audience=q('[data-audience][aria-pressed="true"]')?.dataset.audience;
 if(audience&&!spaceChosen)field('space').value=audience==='empresa'?'Empresa / comércio':'Casa / apartamento';
 form.dispatchEvent(new Event('mdm:quote-open'));
 if(!dialog.open)dialog.showModal();goStep(0);
}
qa('[data-quote]').forEach(b=>b.addEventListener('click',()=>openQuote(b.dataset.quote||'',b.dataset.service||'',b.dataset.project||'')));
document.addEventListener('mdm:calculator-quote',event=>{
 const detail=event.detail;
 if(!form||!detail||typeof detail.summary!=='string'||detail.summary.length>1500||typeof detail.location!=='string'||!/^\d{4}-\d{3}$/.test(detail.location))return;
 if(form.dataset.sending==='true'){openQuote();return;}
 openQuote('Instalação','Ar condicionado');
 field('space').value='Casa / apartamento';spaceChosen=true;
 field('location').value=detail.location;
 field('details').value=detail.summary;
 form.dispatchEvent(new Event('input',{bubbles:true}));
});
field('space')?.addEventListener('change',()=>{spaceChosen=true;});
q('.close-dialog')?.addEventListener('click',()=>dialog.close());
dialog?.addEventListener('close',()=>lastOpener?.focus());
dialog?.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close()});
q('#quote-back')?.addEventListener('click',()=>{if(step>0)goStep(step-1)});
function invalid(message,el){q('#form-error').textContent=t(message);if(el){el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby','form-error');el.focus();}return false}
function validateStep(){
 qa('[aria-invalid]',form).forEach(el=>{el.removeAttribute('aria-invalid');el.removeAttribute('aria-describedby')});
 if(step===0&&!getValue('purpose'))return invalid('Escolha uma opção para continuarmos.',q('input[name="purpose"]'));
 if(step===1&&getValue('location').length<2)return invalid('Indique a localidade do espaço.',field('location'));
 if(step===2){
  if(getValue('name').length<2)return invalid('Indique o seu nome.',field('name'));
  const phone=getValue('phone'),email=getValue('email');
  if(!phone&&!email)return invalid('Indique um telefone ou email para podermos responder.',field('phone'));
  if(phone&&!/^[+\d\s().-]{7,24}$/.test(phone))return invalid('Verifique o número de telefone.',field('phone'));
  if(phone&&phone.replace(/\D/g,'').length<7)return invalid('O número de telefone parece incompleto.',field('phone'));
  if(email&&(!field('email').validity.valid||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))return invalid('Verifique o endereço de email.',field('email'));
 }
 return true;
}
function makeSummary(){
 const entries=[['Pedido',getValue('purpose')],['Solução',getValue('service')],['Espaço',getValue('space')],['Localidade',getValue('location')],['Nome',getValue('name')],['Telefone',getValue('phone')],['Email',getValue('email')],['Detalhes',getValue('details')],['Obra de referência',projectContext]].filter(([,v])=>v).map(([k,v])=>[t(k),['Pedido','Solução','Espaço'].includes(k)?t(v):v]);
 q('#quote-summary').replaceChildren(...entries.map(([key,value])=>{const div=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;div.append(dt,dd);return div}));
 requestText=(isEnglish?'Hello MDM. I would like to request a technical assessment for the following intervention:\n\n':'Solicito à MDM avaliação técnica para a seguinte intervenção:\n\n')+entries.map(([k,v])=>k+': '+v).join('\n');
 q('#send-whatsapp').href='https://wa.me/351910307579?text='+encodeURIComponent(requestText);
 q('#send-email').href='mailto:mdmassistencia@gmail.com?subject='+encodeURIComponent((isEnglish?'MDM request · ':'Pedido MDM · ')+t(getValue('purpose')))+'&body='+encodeURIComponent(requestText);
}
form?.addEventListener('submit',e=>{e.preventDefault();if(step<3&&validateStep()){if(step===2)makeSummary();goStep(step+1)}});
q('.copy-request')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(requestText);q('.copy-status').textContent=t('Pedido copiado. Pode colá-lo na sua mensagem.');}catch{q('.copy-status').textContent=t('Não foi possível copiar automaticamente. Use o WhatsApp ou email, ou selecione o resumo para o copiar.')}});

// Progressive browser tools stage a request; sending remains an explicit visitor action.
if(document.modelContext?.registerTool){
 const lifecycle=new AbortController();
 const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
 register({name:'start_mdm_quote',title:'Preparar pedido MDM',description:'Abre o pedido guiado da MDM com uma necessidade selecionada. Não envia dados nem mensagens.',inputSchema:{type:'object',properties:{purpose:{type:'string',enum:['Instalação','Manutenção','Avaria','Aconselhamento']}},required:['purpose'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='purpose')||!['Instalação','Manutenção','Avaria','Aconselhamento'].includes(input.purpose))throw new Error('Escolha uma necessidade válida.');openQuote(input.purpose);return{status:'draft_started',purpose:input.purpose,step:1,sent:false}}});
 if(q('#project-grid'))register({name:'filter_mdm_projects',title:'Filtrar obras MDM',description:'Filtra as obras visíveis no portefólio por categoria e pesquisa de texto.',inputSchema:{type:'object',properties:{category:{type:'string',enum:['all','int','cob','fac','vent','cen']},search:{type:'string',maxLength:100}},required:['category'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Object.keys(input).some(k=>!['category','search'].includes(k))||!['all','int','cob','fac','vent','cen'].includes(input.category)||(input.search!==undefined&&(typeof input.search!=='string'||input.search.length>100)))throw new Error('Filtro inválido.');return{visible:filterProjects(input.category,input.search||''),category:input.category}}});
 window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}


// Keep all four marks visible without JavaScript or when motion is reduced.
qa('[data-brand-carousel]').forEach(carousel=>{
 const toggle=q('.brand-toggle',carousel);
 const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
 let paused=false;
 function syncBrandMotion(){
  carousel.classList.toggle('is-animated',!motionPreference.matches);
  carousel.dataset.paused=String(paused);
  toggle.hidden=motionPreference.matches;
  const action=t(paused?'Retomar movimento':'Pausar movimento');
  toggle.setAttribute('aria-label',action);
  toggle.title=action;
 }
 toggle.addEventListener('click',()=>{paused=!paused;syncBrandMotion()});
 motionPreference.addEventListener('change',syncBrandMotion);
 syncBrandMotion();
});
