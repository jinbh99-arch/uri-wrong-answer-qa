// QA18 / G08: synthetic 256-attempt history, next learning cycle, lossless backup
// and malicious 257-attempt restore rejection. Public isolated QA DB only.
// Evidence-only history files are NOT a restorable user backup.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const page=await ctx.newPage(),errors=[],passed=[];
page.on('pageerror',e=>errors.push(String(e)));
function pass(what){passed.push(what);console.log('PASS QA18',what)}
async function snapshot(){
 return page.evaluate(async name=>{
  const r=indexedDB.open(name);
  const db=await new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const req=(store,method)=>new Promise((res,rej)=>{const r=tx.objectStore(store)[method]();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
   const [rows,keys,photos]=await Promise.all([req('mistakes','getAll'),req('photos','getAllKeys'),req('photos','getAll')]);
   const images=await Promise.all(keys.map(async(key,i)=>[key,{type:photos[i].type,bytes:Array.from(new Uint8Array(await photos[i].arrayBuffer()))}]));
   return {rows:rows.sort((a,b)=>String(a.id).localeCompare(String(b.id))),images};
  }finally{db.close()}
 },DB);
}
async function history256(){
 return page.evaluate(async name=>{
  const req=indexedDB.open(name),db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  try{
   const tx=db.transaction('mistakes','readwrite'),store=tx.objectStore('mistakes');
   const r=store.getAll(),rows=await new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
   assertRows(rows);
   const row=rows[0],id=row.id;
   row.practiceHistory=Array.from({length:256},(_,i)=>({
    kind:'v27-fraction-add-pilot',at:'2026-11-07T05:00:00Z',answer:'3/4',
    explanation:'합성 검증 이력 '+String(i).padStart(3,'0'),matchesExample:true,
    checks:[{questionId:'same-unit-first',input:'1',matchesExample:true},
      {questionId:'same-unit-total',input:'3',matchesExample:true}],
    preHelpAnswer:'3/8',helpOpened:false,supportUsed:false,
    diagramCheck:{paint:[1,2],matchesExample:true},
    commonDenominator:4,problemSignature:'1/4+2/4',exampleAnswer:'3/4',
    source:'child_or_parent_input',reviewState:'draft_unapproved'
   }));
   store.put(row,id);
   await new Promise((res,rej)=>{tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error)});
   return id;
  }finally{db.close()}
  function assertRows(rows){if(rows.length!==1)throw Error('Expected one synthetic record');}
 },DB);
}
function sign(data){
 const clone=structuredClone(data);delete clone.integrity;
 data.integrity={...data.integrity,algorithm:'SHA-256',digest:createHash('sha256').update(JSON.stringify(clone)).digest('hex')};
 return data;
}
async function settings(){await page.locator('#nav-settings').click()}
async function view(id){await page.locator('#nav-records').click();await page.locator('#records-list button.item[data-record="'+id+'"]').click();}
async function rejectFile(name,modify,mode){
 const d=structuredClone(full);modify(d);sign(d);
 const before=await snapshot();
 await page.evaluate(()=>document.querySelector('#v18-verify-result').textContent='QA18 검사 대기');
 await page.locator(mode==='verify'?'#v18-verify-file':'#import-file').setInputFiles({
  name:name+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(d))});
 const phrase=mode==='verify'?'검사 실패':'복원 전 검사에서 차단';
 await page.waitForFunction(q=>document.querySelector('#v18-verify-result')?.textContent?.includes(q),phrase,{timeout:20000});
 if(mode==='restore')assert.equal(await page.locator('#confirm-dialog[open]').count(),0,'Bad backup reached destructive confirmation');
 assert.deepEqual(await snapshot(),before,'Invalid file changed current record/photo');
 pass(name+' — '+(mode==='verify'?'읽기 전용 검사 거부':'실제 복원경로 선차단')+'·원본 그대로');
}
let full,backupPath;
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#choose-photo').setInputFiles({name:'qa18-pixel.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 await page.locator('#problem').fill('1/4+2/4=?');
 await page.locator('#student-answer').fill('3/8');
 await page.locator('#memo').fill('QA18 256회 완전 보관 합성 데이터');
 await page.locator('#concept').selectOption('math.fraction.add.same_den');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const originalId=await history256();
 await page.reload({waitUntil:'domcontentloaded'});
 await view(originalId);
 assert.match(await page.locator('#v226-history-archive').innerText(),/256\/256회/);
 assert.equal(await page.locator('#v226-continue').isVisible(),true);
 const first=await snapshot();
 assert.equal(first.rows.length,1);assert.equal(first.images.length,1);
 assert.equal(first.rows[0].practiceHistory.length,256);
 pass('합성 사진·재풀이 256회 원본 유지와 이어가기 버튼');
 await page.locator('#v226-continue').click();
 assert.equal(await page.locator('#student-answer').inputValue(),'');
 assert.match(await page.locator('#memo').inputValue(),new RegExp('이전 학습 기록 ID: '+originalId));
 assert.equal((await snapshot()).rows.length,1);
 pass('새 회차는 양식만 채우며 원본·사진 자동 복제 없음');
 await page.locator('#student-answer').fill('3/4');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const before=await snapshot();
 assert.equal(before.rows.length,2);
 const old=before.rows.find(r=>r.id===originalId),next=before.rows.find(r=>r.id!==originalId);
 assert.equal(old.practiceHistory.length,256);
 assert.equal(next.practiceHistory.length,0);
 assert.equal(next.hasPhoto,false);
 assert.equal(before.images.length,1);
 assert.equal(before.images[0][0],originalId);
 pass('2번째 기록 저장 시 원본 256회·사진 바이트 보존, 신규 이력 0·사진 없음');
 await settings();
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#export-json').click()]);
 backupPath=await download.path();assert.ok(backupPath);
 full=JSON.parse(await readFile(backupPath,'utf8'));
 assert.equal(full.format,'uriaimath-offline-backup-v02');
 assert.equal(full.records.length,2);
 assert.equal(full.records.find(r=>r.id===originalId).practiceHistory.length,256);
 assert.equal(full.records.find(r=>r.id!==originalId).practiceHistory.length,0);
 assert.equal(Object.keys(full.photos).length,1);
 const payload=structuredClone(full);delete payload.integrity;
 assert.equal(full.integrity.digest,createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
 assert.deepEqual(await snapshot(),before);
 pass('전체 JSON 백업의 두 회차·256개 개별 이력·원본 사진 포함, SHA-256 일치');
 await rejectFile('257번째 이력 위조',d=>{d.records.find(r=>r.id===originalId).practiceHistory.push(structuredClone(d.records.find(r=>r.id===originalId).practiceHistory[0]));},'verify');
 await rejectFile('257번째 복원 시도',d=>{d.records.find(r=>r.id===originalId).practiceHistory.push(structuredClone(d.records.find(r=>r.id===originalId).practiceHistory[0]));},'restore');
 await rejectFile('검토되지 않은 자동 판정 위조',d=>{d.records.find(r=>r.id===originalId).practiceHistory[0].kind='auto_mastered';},'verify');
 await rejectFile('재풀이 설명 허용 길이 초과',d=>{d.records.find(r=>r.id===originalId).practiceHistory[2].explanation='a'.repeat(351);},'verify');
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:20000});
 await page.locator('#dlg-ok').click();
 await page.locator('#page-home:visible').waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 assert.deepEqual((await snapshot()).rows,[]);
 assert.deepEqual((await snapshot()).images,[]);
 pass('백업 후 합성 자료 전체 삭제·0건 확인');
 await settings();
 await page.locator('#import-file').setInputFiles(backupPath);
 await page.locator('#confirm-dialog[open]').waitFor({timeout:35000});
 await page.locator('#dlg-ok').click();
 await page.locator('#nav-records').click();
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 2건'),null,{timeout:25000});
 const restored=await snapshot();
 assert.deepEqual(restored.rows,before.rows,'Re-import changed a record or an old attempt');
 assert.deepEqual(restored.images,before.images,'Photo bytes changed after restore');
 pass('일반 전체 복원 실제 수행: 2회차·256회 이력 전체·원본 사진 바이트 완전 동일');
 await page.reload({waitUntil:'domcontentloaded'});
 assert.deepEqual(await snapshot(),before,'Reload changed restored attempts or photos');
 await view(originalId);
 assert.match(await page.locator('#v226-history-archive').innerText(),/256\/256회/);
 await view(next.id);
 await page.getByRole('button',{name:'↶ 이전 학습 기록 보기'}).click();
 assert.match(await page.locator('#v226-history-archive').innerText(),/256\/256회/);
 pass('새로고침 후 이어보기 역링크·원본 256회 일관성');
 await settings();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:20000});
 await page.locator('#dlg-ok').click();
 await page.locator('#page-home:visible').waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 assert.deepEqual((await snapshot()).rows,[]);
 assert.deepEqual((await snapshot()).images,[]);
 assert.deepEqual(errors,[]);
 pass('합성 자료 최종 삭제·브라우저 오류 0');
 console.log('QA_G08_RECOVERY_RESULT='+JSON.stringify({status:'PASS',checks:passed.length,passed,
  limitation:'Synthetic data, isolated DB. NOT infinite history, real devices or independent offsite retention.'}));
}catch(err){
 console.error('QA_G08_RECOVERY_RESULT='+JSON.stringify({status:'FAIL',passed,error:String(err),stack:String(err?.stack).slice(0,1000),errors}));
 try{await page.screenshot({path:'qa18-history-recovery-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
