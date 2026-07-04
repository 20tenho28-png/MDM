// Full test pipeline: extract -> syntax check -> smoke -> onboarding.
const {spawnSync}=require('child_process'), path=require('path');
const step=(name,args)=>{ const r=spawnSync('node',args,{stdio:'inherit',cwd:__dirname});
  if(r.status!==0){ console.error('\n\u274C FAILED at:',name); process.exit(1); } };
step('extract',['extract.js']);
step('syntax', ['--check', path.join(__dirname,'app_extracted.js')]);
step('smoke',  ['smoke.js']);
step('onboarding',['onboarding.test.js']);
console.log('\n\u2705 ALL TESTS PASSED');
