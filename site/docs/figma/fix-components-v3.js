// Correção pendente do quadro "Components" (página "Design system v3", ficheiro f6utVl8Hx1POsomLjSVd9Y).
// Não correu: o plano Figma Starter atingiu o limite de chamadas MCP (27/09/2026).
// Correr com use_figma quando houver chamadas disponíveis (ou colar na consola de um plugin de desenvolvimento).
const page = await figma.getNodeByIdAsync("19:69"); await figma.setCurrentPageAsync(page);
for (const s of ['Regular','Medium','SemiBold','Bold']) await figma.loadFontAsync({family:'Geist',style:s});
await figma.loadFontAsync({family:'Geist Mono',style:'Medium'});
const board = await figma.getNodeByIdAsync('24:69');
for (const n of board.findAll(n => n.type === 'FRAME' && n.layoutMode !== 'NONE')) {
  const f = n.fills; if (Array.isArray(f) && f.length === 1 && f[0].type === 'SOLID' && !(f[0].boundVariables && f[0].boundVariables.color) && f[0].color.r === 1 && f[0].color.g === 1 && f[0].color.b === 1) n.fills = [];
}
for (const c of board.findAll(n => n.type === 'COMPONENT')) {
  if (c.layoutMode === 'VERTICAL') c.primaryAxisSizingMode = 'AUTO';
  if (c.layoutMode === 'HORIZONTAL') { if (c.name.startsWith('Kind=')) { c.primaryAxisSizingMode = 'AUTO'; c.counterAxisSizingMode = 'FIXED'; } else c.counterAxisSizingMode = 'AUTO'; }
}
for (const n of board.findAll(n => n.type === 'FRAME' && n.layoutMode === 'HORIZONTAL' && ['Ligar','WhatsApp','Recusar','Aceitar'].includes(n.name))) { n.primaryAxisSizingMode = 'AUTO'; n.counterAxisSizingMode = 'FIXED'; }
for (const n of board.findAll(n => n.type === 'FRAME' && n.layoutMode !== 'NONE' && n.name !== 'Photo')) {
  const keepH = [44,48,52].includes(Math.round(n.height)) && n.layoutMode === 'HORIZONTAL';
  if (n.layoutMode === 'VERTICAL') n.primaryAxisSizingMode = 'AUTO'; else if (!keepH) n.counterAxisSizingMode = 'AUTO';
}
for (const s of board.findAll(n => n.type === 'COMPONENT_SET')) { s.primaryAxisSizingMode = 'AUTO'; s.counterAxisSizingMode = 'AUTO'; }
const strip = await figma.getNodeByIdAsync('24:100'); const tt = strip.children[3].findAll(n => n.type === 'TEXT');
tt[0].characters = 'Certificados'; tt[1].characters = 'F-gas, APIRAC, IMPIC e eletricista certificado';
for (const s of board.children) if ('clipsContent' in s) s.clipsContent = false;
return { h: board.height };
