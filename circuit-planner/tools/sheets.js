// Renders visual verification sheets (SVG; PNG if `sharp` is installed).
const {spawnSync}=require('child_process'), fs=require('fs'), path=require('path');
spawnSync('node',[path.join(__dirname,'../test/extract.js')],{stdio:'inherit'});
for(const f of ['sheet_parts.js','sheet_ac.js'])
  spawnSync('node',[path.join(__dirname,f)],{stdio:'inherit'});
let sharp=null; try{ sharp=require('sharp'); }catch(e){}
const svgs=fs.readdirSync(__dirname).filter(f=>f.startsWith('out_')&&f.endsWith('.svg'));
if(!sharp){ console.log('SVGs written:',svgs.join(', '),'\n(install sharp for PNGs: npm i sharp)'); process.exit(0); }
(async()=>{ for(const f of svgs) await sharp(path.join(__dirname,f),{density:120}).png().toFile(path.join(__dirname,f.replace('.svg','.png')));
  console.log('PNG sheets rendered:',svgs.length); })();
