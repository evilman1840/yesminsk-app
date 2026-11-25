const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const {execFileSync}=require('node:child_process');
const out=mkdtempSync(join(tmpdir(),'gulyai-notices-'));
process.on('exit',()=>rmSync(out,{recursive:true,force:true}));
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','src/utils/notices.ts','--outDir',out,'--module','commonjs','--target','es2022','--skipLibCheck']);
const {nextMinskDay,readNoticeState,dismissNotice,pickNotice}=require(join(out,'notices.js'));
const now=Date.parse('2026-11-25T20:59:00Z');
const data=new Map();
global.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
test('closing one card frees the whole slot, including after reopening the app',()=>{
 data.clear(); const notices=[{id:'meetup:first'},{id:'meetup:next'}];
 assert.equal(pickNotice(notices,readNoticeState(now),now).id,'meetup:first');
 const state=dismissNotice('meetup:first',1,now);
 assert.equal(pickNotice(notices,state,now),undefined);
 assert.equal(pickNotice(notices,readNoticeState(now),now),undefined);
 assert.equal(pickNotice(notices,readNoticeState(now),nextMinskDay(now)+1).id,'meetup:next');
});
test('tomorrow follows Minsk calendar, not device time or a 24-hour delay',()=>{
 assert.equal(nextMinskDay(now),Date.parse('2026-11-25T21:00:00Z'));
 assert.equal(nextMinskDay(Date.parse('2026-11-25T21:01:00Z')),Date.parse('2026-11-26T21:00:00Z'));
});
test('preserves unexpired old dismissals and safely handles malformed or unavailable storage',()=>{
 data.clear();data.set('yesminsk_notice_hidden',JSON.stringify({old:now+1000,expired:now-1,invalid:'tomorrow'}));
 assert.deepEqual(readNoticeState(now).hidden,{old:now+1000});
 data.set('yesminsk_notice_hidden','bad json');assert.doesNotThrow(()=>readNoticeState(now));
 global.localStorage={getItem:()=>{throw Error('private')},setItem:()=>{throw Error('private')}};
 dismissNotice('blocked-storage',1,now);
 assert.equal(pickNotice([{id:'another'}],readNoticeState(now),now),undefined);
});
