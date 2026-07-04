// Extracts the app's <script> into app_extracted.js for headless testing.
const fs=require('fs'), path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(root,'circuit_planner.html'),'utf-8');
const m=src.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);
if(!m){ console.error('FAIL: could not locate app <script>'); process.exit(1); }
fs.writeFileSync(path.join(__dirname,'app_extracted.js'), m[1]);
console.log('extracted', m[1].length, 'chars');
