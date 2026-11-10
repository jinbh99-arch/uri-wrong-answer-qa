// WRONG-RC-ROLLBACK: actual main -> RC -> main -> RC on ONE browser origin,
// using only synthetic 1px photos, fake data, and GitHub Actions localhost.
// Must never write to main, deployed Pages/Netlify or real family data.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const URL='http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const OLD='baseline-main/index.html';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
let browser,step=0;
function passed(s){step++;console.log('PASS WRONG_RC_ROLLBACK '+step+' '+s)}
async function stored(p){
 return p.evaluate(async name=>{
  const req=indexedDB.open(name);
  const db=await new Promise((ok,bad)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error)});
  const finish=req=>new Promise((ok,bad)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>bad(req.error)});
  try{
    const t=db.transaction(['mistakes','photos'],'readonly');
    const [records,keys,photos]=await Promise.all([
       finish(t.objectStore('mistakes').getAll()),
       finish(t.objectStore('photos').getAllKeys()),
       finish(t.objectStore('photos').getAll())]);
    return {records:records.sort((a,b)=>a.id.localeCompare(b.id)),
      photos:await Promise.all(keys.map(async(id,i)=>({id,type:photos[i]?.type,
        bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))})))};
  }finally{db.close()}
 },DB);
}
const pick=(s,id)=>{const r=s.records.find(r=>r.id===id);assert.ok(r,'missing ID '+id);return r};
async function oldAdd(p){
 await p.locator('#nav-add').click();
 await p.locator('#problem').fill('구버전 가상 수학 오답: 3 + 4 = ?');
 await p.locator('#student-answer').fill('6');
 await p.locator('#concept').selectOption('math.natural.addition');
 await p.locator('#choose-photo').setInputFiles({name:'old-math-synthetic.png',mimeType:'image/png',buffer:PNG});
 await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const s=await stored(p),r=s.records.find(r=>r.problemText.includes('구버전 가상'));
 assert.ok(r);assert.ok(r.id.startsWith('m'));assert.equal(s.photos.length,1);
 return r.id;
}
async function rcAdd(p,subject,grade,{photo=false,reasons=[]}={}){
 const label={korean:'국어',english:'영어',science:'과학',social:'사회'}[subject];
 assert.ok(label);
 const name='신버전 가상 '+label+' 오답';
 await p.locator('#nav-add').click();
 await p.locator('#wrong007-subject').selectOption(subject);
 await p.locator('#wrong007-grade').selectOption(String(grade));
 await p.locator('#problem').fill(name);
 if(photo){
  await p.locator('#choose-photo').setInputFiles({name:'new-subject-synthetic.png',mimeType:'image/png',buffer:PNG});
  await p.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
 }
 for(const reason of reasons)await p.locator('#wrong006-candidates input[value="'+reason+'"]').check();
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:25000});
 const s=await stored(p),r=s.records.find(r=>r.problemText===name);
 assert.ok(r);assert.equal(r.subject,subject);assert.equal(r.gradeAtEntry,grade);
 return r.id;
}
async function detail(p,id){
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+id+'"]').click();
 await p.locator('#wrong008-next-review').waitFor({state:'attached',timeout:25000});
}
async function backup(p){
 await p.locator('#nav-settings').click();
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:25000}),p.locator('#export-json').click()]);
 return readFile(await dl.path());
}
async function restored(p,bytes){
 await p.locator('#nav-settings').click();
 await p.locator('#import-file').setInputFiles({name:'synthetic-rc-lossless.json',mimeType:'application/json',buffer:bytes});
 await p.locator('#confirm-dialog[open]').waitFor({timeout:25000});
 await p.locator('#dlg-ok').click();
 await p.getByText('복원 후 재읽기 확인:',{exact:false}).waitFor({timeout:25000});
}
try{
 const oldHtml=await readFile(OLD,'utf8');
 assert.ok(oldHtml.includes('uriaimath-github-qa-v224-only'),'main DB namespace changed unexpectedly');
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const p=await ctx.newPage();const pageErrors=[];
 p.on('pageerror',e=>pageErrors.push(String(e)));
 // Serve actual historical main document over the RC localhost origin.
 // This tests actual IndexedDB continuity without mutating the file system.
 const mainRoute=async route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:oldHtml});
 await p.route(URL,mainRoute);
 await p.goto(URL,{waitUntil:'domcontentloaded'});
 const oldId=await oldAdd(p);
 await p.locator('#v230-answer:visible').waitFor({timeout:25000});
 await p.locator('#v230-answer').fill('7 (구버전 재풀이)');
 await p.locator('#v230-save').click();
 await p.waitForFunction(()=>document.querySelector('#v230-review')!==null,null,{timeout:25000});
 await p.locator('#v230-review').selectOption('explained');
 await p.locator('#v230-review-save').click();
 await p.waitForFunction(async name=>{
   const req=indexedDB.open(name);
   const db=await new Promise(y=>req.onsuccess=()=>y(req.result));
   const one=await new Promise(y=>{const q=db.transaction('mistakes').objectStore('mistakes').getAll();q.onsuccess=()=>y(q.result)});
   db.close();return one.some(x=>x.generalRetryHistory?.at(-1)?.review==='explained');
 },DB,{timeout:25000});
 const oldSnapshot=await stored(p);
 assert.equal(pick(oldSnapshot,oldId).generalRetryHistory.length,1);
 assert.equal(pick(oldSnapshot,oldId).generalRetryHistory[0].review,'explained');
 const oldBackup=JSON.parse((await backup(p)).toString('utf8'));
 assert.equal(oldBackup.records.length,1);
 assert.equal(oldBackup.records[0].id,oldId);
 assert.ok(oldBackup.photos[oldId]);
 passed('main v-old: math ID, bytes of photo, retry + parent review, JSON backup');
 // Upgrade at same origin; no records, IndexedDB or photos are cleared.
 await p.unroute(URL,mainRoute);
 await p.reload({waitUntil:'domcontentloaded'});
 const upgrade=await stored(p);
 assert.equal(canonical(upgrade),canonical(oldSnapshot));
 await p.locator('#nav-records').click();
 await p.locator('#records-list button[data-record="'+oldId+'"]').waitFor({timeout:25000});
 passed('RC upgrade: old math, photo, ID, retry and parent review unchanged');
 const korean=await rcAdd(p,'korean',3,{photo:true,reasons:['reading','concept']});
 const english=await rcAdd(p,'english',4,{reasons:['reading']});
 const science=await rcAdd(p,'science',5,{reasons:['concept']});
 const social=await rcAdd(p,'social',6,{reasons:[]});
 await detail(p,korean);
 await p.locator('#v230-answer').fill('국어 지문을 다시 설명함 (가상)');
 await p.locator('#v230-save').click();
 await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('다시 푼 기록 1회'),null,{timeout:25000});
 await p.locator('#check-status').selectOption('needs_help');
 await p.locator('#check-memo').fill('가상 학부모 관찰: 읽기 설명 도움 필요');
 await p.locator('#check-save').click();
 await p.waitForFunction(()=>document.querySelector('#wrong002-state')?.textContent?.includes('학부모 관찰 1회'),null,{timeout:25000});
 const beforeDown=await stored(p);
 assert.equal(beforeDown.records.length,5);
 assert.equal(beforeDown.photos.length,2);
 assert.equal(pick(beforeDown,korean).generalRetryHistory.length,1);
 assert.equal(pick(beforeDown,korean).checkHistory.length,1);
 assert.deepEqual(pick(beforeDown,korean).reasonCandidates,['reading','concept']);
 assert.equal(pick(beforeDown,oldId).id,oldId);
 assert.equal(pick(beforeDown,oldId).generalRetryHistory[0].review,'explained');
 assert.deepEqual(beforeDown.photos.find(x=>x.id===oldId),oldSnapshot.photos[0]);
 const rcBytes=await backup(p),rcJson=JSON.parse(rcBytes.toString('utf8'));
 assert.equal(rcJson.records.length,5);
 assert.deepEqual(new Set(rcJson.records.map(x=>x.id)),new Set(beforeDown.records.map(x=>x.id)));
 assert.deepEqual(new Set(Object.keys(rcJson.photos)),new Set(beforeDown.photos.map(x=>x.id)));
 passed('RC: math + 4 nonmath, 2 photos, multi-cause, retry, parent observation, backup all kept');
 // Roll back just the app JS/HTML, not the browser origin or the persisted DB.
 await p.route(URL,mainRoute);
 await p.reload({waitUntil:'domcontentloaded'});
 const persisted=await stored(p);
 assert.equal(canonical(persisted),canonical(beforeDown),'rollback must never physically mutate IDB');
 await p.locator('#nav-records').click();
 const shown=await p.locator('#records-list button.item').count();
 assert.equal(shown,1,'main hides nonmath records (expected risk reproduction)');
 await p.locator('#nav-settings').click();
 await p.locator('#v07-backup-audit').click();
 await p.waitForFunction(()=>document.querySelector('#v07-backup-result')?.textContent?.includes('비지원/중복 기록'));
 const audit=await p.locator('#v07-backup-result').innerText();
 assert.match(audit,/전체 백업 생성 불가/);
 assert.match(audit,/비지원\/중복 기록 4/);
 const stillStored=await stored(p);
 assert.equal(canonical(stillStored),canonical(beforeDown));
 console.log('WRONG_RC_DOWNGRADE_OBSERVED='+JSON.stringify({
   totalRows:stillStored.records.length,visibleRows:shown,hiddenNonmath:stillStored.records.length-shown,
   backupRejected:true,photoBytesUnchanged:true,recordIdsUnchanged:true,
   audit: audit.slice(0,250)}));
 passed('main rollback: four nonmath disappear from UI and old audit blocks backup, underlying DB intact');
 // Switch back to RC without any data migration, reindex, or rekey.
 await p.unroute(URL,mainRoute);
 await p.reload({waitUntil:'domcontentloaded'});
 const revived=await stored(p);
 assert.equal(canonical(revived),canonical(beforeDown));
 await p.locator('#nav-records').click();
 assert.equal(await p.locator('#records-list button.item').count(),5);
 const rcAfter=JSON.parse((await backup(p)).toString('utf8'));
 assert.equal(rcAfter.records.length,5);
 assert.deepEqual(new Set(Object.keys(rcAfter.photos)),new Set(beforeDown.photos.map(x=>x.id)));
 passed('return to RC: all five records/photo IDs/retry/parent history reappear; backup works again');
 // Restoration exercised ONLY in a fresh empty synthetic context.
 const isolated=await browser.newContext({viewport:{width:320,height:740},acceptDownloads:true});
 const q=await isolated.newPage();await q.goto(URL,{waitUntil:'domcontentloaded'});
 assert.equal((await stored(q)).records.length,0);
 await restored(q,rcBytes);
 const recovered=await stored(q);
 assert.equal(canonical(recovered),canonical(beforeDown),'backup/restore must be byte- and ID-preserving');
 passed('fresh synthetic browser: RC JSON restored all IDs, photos byte-for-byte and all learning history');
 assert.deepEqual(pageErrors,[],'JavaScript errors in version swap');
 console.log('WRONG_RC_ROLLBACK_RESULT='+JSON.stringify({
    status:'PASS',checks:step,mainSha:process.env.WRONG_BASELINE_SHA,
    rcSha:process.env.WRONG_RC_SHA,subjects:5,oldMathRetained:true,newNonmath:4,
    photoCount:2,downloadBeforeRollback:true,oldMainHiddenNonmath:4,
    oldMainBackupRejected:true,rcRestoredAll:true,restoredFromJson:true,
    originalPhotoBytesPreserved:true,noRealChildren:true,noCloud:true,noProductionChange:true
 }));
}catch(e){
 console.error('WRONG_RC_ROLLBACK_RESULT='+JSON.stringify({
  status:'FAIL',checks:step,error:String(e),stack:String(e?.stack).slice(0,2300)}));
 process.exitCode=1;
}finally{await browser?.close()}
