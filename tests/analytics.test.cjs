const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {execFileSync}=require('node:child_process');
const out=mkdtempSync(join(tmpdir(),'gulyai-analytics-test-'));
process.on('exit',()=>rmSync(out,{recursive:true,force:true}));

execFileSync(process.execPath,['node_modules/typescript/bin/tsc','src/analytics/core.ts','--outDir',out,'--module','commonjs','--target','es2022','--skipLibCheck']);
const {ActivityTracker}=require(join(out,'core.js'));
let n=0; const uuid=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;
function fixture(){let time=100000;const batches=[];const t=new ActivityTracker(async es=>batches.push(es),()=>time,uuid);return {t,batches,advance:ms=>time+=ms,events:()=>batches.flat()};}
test('disabled analytics sends nothing',async()=>{const f=fixture();f.t.click('profile_save');f.advance(10000);await f.t.flush();assert.equal(f.events().length,0);});
test('attributes active time to old tab and excludes idle/background',async()=>{const f=fixture();f.t.configure(true);f.advance(10000);f.t.setScreen('people');f.advance(90000);f.t.setVisible(false);f.advance(300000);await f.t.flush();assert.deepEqual(f.events().filter(e=>e.event==='gulyai_screen_active').map(e=>[e.properties.screen,e.properties.active_ms]),[['map',10000],['people',60000]]);});
test('deduplicates exposure within a visit, then records next visit',async()=>{const f=fixture();f.t.configure(true);f.t.impression('profile_save');f.t.impression('profile_save');f.t.click('profile_save');f.t.setScreen('profile');f.t.impression('profile_save');await f.t.flush();assert.equal(f.events().filter(e=>e.event==='gulyai_element_seen').length,2);assert.equal(f.events().filter(e=>e.event==='gulyai_element_clicked').length,1);});
test('retry preserves event UUID and does not block user actions',async()=>{let count=0;const sent=[];const t=new ActivityTracker(async es=>{sent.push(es);if(++count===1)throw Error('offline')},()=>100000,uuid);t.configure(true);await t.flush();await t.flush();assert.equal(sent[0][0].id,sent[1][0].id);});
test('background start records view only when visible',async()=>{const f=fixture();f.t.setVisible(false);f.t.configure(true);await f.t.flush();assert.equal(f.events().length,0);f.t.setVisible(true);await f.t.flush();assert.equal(f.events().filter(e=>e.event==='gulyai_screen_viewed').length,1);});
test('long idle starts a fresh session',async()=>{const f=fixture();f.t.configure(true);f.advance(31*60000);f.t.interaction();await f.t.flush();const views=f.events().filter(e=>e.event==='gulyai_screen_viewed');assert.equal(views.length,2);assert.notEqual(views[0].session_id,views[1].session_id);});
