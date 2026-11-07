import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
const p=await ctx.newPage();const evidence=[],errors=[];
p.on('pageerror',e=>errors.push(String(e)));
function pass(name,detail=''){evidence.push({name,detail});console.log('PASS ARCHIVE',name,detail)}
async function records(page=p){
 return page.evaluate(async(name)=>{
  const req=indexedDB.open(name);
  const db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  try{
   const q=db.transaction('mistakes','readonly').objectStore('mistakes').getAll();
   return await new Promise((res,rej)=>{q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
  }finally{db.close()}
 },DB);
}
try{
 await p.goto(BASE,{waitUntil:'domcontentloaded'});
 await p.locator('#nav-add').click();
 await p.locator('#problem').fill('1/4+2/4=?');
 await p.locator('#student-answer').fill('3/8');
 await p.locator('#memo').fill('합성 QA 256회 보존 대상');
 await p.locator('#concept').selectOption('math.fraction.add.same_den');
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const id=(await records())[0]?.id;
 assert.ok(id);
 const row=await p.evaluate(async(name)=>{
  const req=indexedDB.open(name),db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  try{
   const tx=db.transaction('mistakes','readwrite'),store=tx.objectStore('mistakes');
   const q=store.getAll();const rows=await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
   const row=rows[0];
   const trial=i=>({kind:'v27-fraction-add-pilot',at:'2026-11-07T05:00:00Z',answer:'3/4',
     explanation:'합성 기록 '+i,matchesExample:true,
     checks:[{questionId:'same-unit-first',input:'1',matchesExample:true},
       {questionId:'same-unit-total',input:'3',matchesExample:true}],
     preHelpAnswer:'3/8',helpOpened:false,supportUsed:false,
     diagramCheck:{paint:[1,2],matchesExample:true},
     commonDenominator:4,problemSignature:'1/4+2/4',exampleAnswer:'3/4',
     source:'child_or_parent_input',reviewState:'draft_unapproved'});
   row.practiceHistory=Array.from({length:256},(_,i)=>trial(i));
   store.put(row,row.id);
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error)});
   return {id:row.id,history:row.practiceHistory.length};
  }finally{db.close()}
 },DB);
 assert.equal(row.history,256);
 await p.reload({waitUntil:'domcontentloaded'});
 await p.locator('#nav-records').click();
 await p.locator('#records-list button.item').first().click();
 await p.locator('#v226-history-archive').waitFor({timeout:20000});
 assert.match(await p.locator('#v226-history-archive').innerText(),/256\/256회/);
 assert.equal(await p.locator('#v226-continue').isVisible(),true);
 pass('256개 합성 재풀이 이력·원본 읽기','원본 1건');
 const before=await records();
 const [download]=await Promise.all([
   p.waitForEvent('download',{timeout:20000}),
   p.locator('#v226-export-history').click()
 ]);
 const path=await download.path();
 assert.ok(path);
 const exported=JSON.parse(await readFile(path,'utf8'));
 assert.equal(exported.format,'uriaimath-practice-evidence-v01');
 assert.equal(exported.historyCount,256);
 assert.equal(exported.history.length,256);
 assert.equal(exported.recordId,id);
 assert.equal(exported.integrity.algorithm,'SHA-256');
 const {integrity,...rest}=exported;
 assert.equal(integrity.digest,createHash('sha256').update(JSON.stringify(rest)).digest('hex'));
 assert.deepEqual(await records(),before,'내보내기 동작에서 원본이 변경됨');
 pass('256회 전체 이력 파일 내보내기·SHA256 일치','기존 문항과 사진 미변경; 복원용 아닌 별도 JSON');
 await p.locator('#nav-settings').click();
 await p.locator('#v18-verify-file').setInputFiles(path);
 await p.waitForFunction(()=>document.querySelector('#v18-verify-result')?.textContent?.includes('검사')||document.querySelector('#v18-verify-result')?.textContent?.includes('백업'),null,{timeout:20000});
 const info=await p.locator('#v18-verify-result').innerText();
 assert.match(info,/백업 규격|미지원|복원|형식|파일/);
 assert.deepEqual(await records(),before);
 pass('이력 파일을 일반 복원용 백업으로 오용하지 못함','원본 유지');

 await p.locator('#nav-records').click();
 await p.locator('#records-list button.item').first().click();
 await p.locator('#v226-continue').click();
 assert.equal(await p.locator('#problem').inputValue(),'1/4+2/4=?');
 assert.equal(await p.locator('#student-answer').inputValue(),'');
 assert.match(await p.locator('#memo').inputValue(),/^\[이전 학습 기록 ID:/);
 assert.equal((await records()).length,1);
 pass('새 학습 회차 양식만 채우고 자동 저장 안 함');
 await p.locator('#student-answer').fill('3/4');
 await p.locator('#save-btn').click();
 await p.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const both=await records();
 assert.equal(both.length,2);
 const original=both.find(x=>x.id===id);
 const next=both.find(x=>x.id!==id);
 assert.equal(original.practiceHistory.length,256);
 assert.equal(next.practiceHistory.length,0);
 assert.match(next.memo,new RegExp('이전 학습 기록 ID: '+id));
 pass('새 기록 저장 후 이전 256회 보존','기존 256회·신규 0회, 둘 다 잔존');
 await p.locator('#nav-records').click();
 await p.locator('#records-list button.item[data-record="'+next.id+'"]').click();
 await p.getByRole('button',{name:'↶ 이전 학습 기록 보기'}).click();
 assert.match(await p.locator('#v226-history-archive').innerText(),/256\/256회/);
 pass('새 기록에서 원본으로 되돌아가기');

 await p.locator('#nav-settings').click();
 const [full]=await Promise.all([p.waitForEvent('download',{timeout:20000}),p.locator('#export-json').click()]);
 const backup=JSON.parse(await readFile(await full.path(),'utf8'));
 assert.equal(backup.records.length,2);
 assert.equal(backup.records.find(x=>x.id===id).practiceHistory.length,256);
 assert.equal(backup.records.find(x=>x.id===next.id).practiceHistory.length,0);
 pass('일반 전체 JSON 백업에 원본·새 회차 모두 포함');
 await p.locator('#clear-all').click();
 await p.locator('#confirm-dialog[open]').waitFor();
 await p.locator('#dlg-ok').click();
 await p.waitForFunction(async name=>{
   const req=indexedDB.open(name);
   const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
   try{const q=db.transaction('mistakes','readonly').objectStore('mistakes').count();
     return await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result===0);q.onerror=()=>reject(q.error)});
   }finally{db.close()}
 },DB,{timeout:20000});
 assert.equal((await records()).length,0);
 pass('가상 데이터 정리', '0건');
 assert.deepEqual(errors,[]);
 pass('JavaScript 예외 없음');
 console.log('QA_ARCHIVE_RESULT='+JSON.stringify({status:'PASS',checks:evidence}));
}catch(e){
 console.error('QA_ARCHIVE_RESULT='+JSON.stringify({status:'FAIL',checks:evidence,error:String(e),stack:String(e?.stack).slice(0,1300),pageErrors:errors}));
 try{await p.screenshot({path:'qa-archive-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close();}
