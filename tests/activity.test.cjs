const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {execFileSync}=require('node:child_process');
const out=mkdtempSync(join(tmpdir(),'gulyai-activity-'));
process.on('exit',()=>rmSync(out,{recursive:true,force:true}));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','src/utils/activitySeen.ts','--outDir',out,'--module','commonjs','--target','es2022','--skipLibCheck']);
const {readActivitySeen,markActivitySeen}=require(join(out,'activitySeen.js'));
const store=new Map();
global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
test('read state is isolated by account and survives reopening',()=>{
 const seen=markActivitySeen(101,new Set(),['like:1','event:2','news:3']);
 assert.equal(seen.size,3);assert.equal(readActivitySeen(101).size,3);assert.equal(readActivitySeen(102).size,0);
 const keys=['like:1','event:2','news:3','like:4'];
 assert.deepEqual(keys.filter(k=>!readActivitySeen(101).has(k)),['like:4']);
});
test('marks all currently visible items even with very large counts',()=>{
 const keys=Array.from({length:2500},(_,i)=>'like:'+i);
 const seen=markActivitySeen(103,new Set(),keys);
 assert.equal(keys.filter(k=>!seen.has(k)).length,0);assert.equal(readActivitySeen(103).size,2500);
});
test('malformed data and private mode do not break activity views',()=>{
 store.set('gulyai_activity_seen_104','bad json');assert.equal(readActivitySeen(104).size,0);
 global.localStorage={getItem:()=>{throw Error('private')},setItem:()=>{throw Error('private')}};
 assert.equal(readActivitySeen(104).size,0);assert.equal(markActivitySeen(104,new Set(),['like:1']).size,1);
});
