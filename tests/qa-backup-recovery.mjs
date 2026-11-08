// QA14 — G12 recovery failure matrix, synthetic data only (isolated QA DB).
// Does not read/write Netlify, another app, or real child records.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({acceptDownloads:true, viewport:{width:390,height:844}});
const page=await context.newPage();
const problems=[];const passed=[];
page.on('pageerror',err=>problems.push(String(err)));
const pass=(name)=>{passed.push(name);console.log('PASS QA14',name);};
async function snapshot(){
 return page.evaluate(async dbname=>{
  const request=indexedDB.open(dbname);
  const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
  try{
   const tx=db.transaction(['mistakes','photos','settings'],'readonly');
   const getAll=(st,kind)=>new Promise((resolve,reject)=>{const q=tx.objectStore(st)[kind]();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});
   const [records,photoKeys,photoBlobs,settingsKeys,settingsValues]=await Promise.all([
    getAll('mistakes','getAll'),getAll('photos','getAllKeys'),getAll('photos','getAll'),getAll('settings','getAllKeys'),getAll('settings','getAll')
   ]);
   const photoBytes=await Promise.all(photoBlobs.map(async blob=>({
    type:blob.type,bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))
   })));
   return {records,photos:photoKeys.map((key,i)=>[key,photoBytes[i]]),settings:settingsKeys.map((key,i)=>[key,settingsValues[i]])};
  }finally{db.close()}
 },DB);
}
async function mutatePhoto(mode){
 return page.evaluate(async ({dbname,mode})=>{
  const request=indexedDB.open(dbname);
  const db=await new Promise((res,rej)=>{request.onsuccess=()=>res(request.result);request.onerror=()=>rej(request.error)});
  try{
   const tx=db.transaction('photos','readwrite'),st=tx.objectStore('photos');
   if(mode==='add')st.put(new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4,5,6,7,8])],{type:'image/png'}),'qa14-orphan-photo');
   else st.delete('qa14-orphan-photo');
   await new Promise((res,rej)=>{tx.oncomplete=res;tx.onabort=()=>rej(tx.error);tx.onerror=()=>rej(tx.error)});
  }finally{db.close()}
 },{dbname:DB,mode});
}
function sign(data){
 const payload=structuredClone(data);delete payload.integrity;
 data.integrity={...data.integrity,algorithm:'SHA-256',digest:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
 return data;
}
function upload(name,data) {
 return {name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sign(data)))};
}
async function settings(){await page.locator('#nav-settings').click();}
async function verifyRejected(name,mutate){
 const bad=structuredClone(original);mutate(bad);
 const before=await snapshot();
 await page.evaluate(()=>{document.querySelector('#v18-verify-result').textContent='검사 대기';});
 await page.locator('#v18-verify-file').setInputFiles(upload(name+'.json',bad));
 await page.waitForFunction(()=>document.querySelector('#v18-verify-result')?.textContent?.includes('검사 실패'),null,{timeout:20000});
 assert.deepEqual(await snapshot(),before,name+' changed the DB during read-only inspection');
 pass('손상/미지원 백업 거부: '+name);
}
async function restoreRejected(name,mutate){
 const bad=structuredClone(original);mutate(bad);
 const before=await snapshot();
 await page.evaluate(()=>{document.querySelector('#v18-verify-result').textContent='복원 대기';});
 await page.locator('#import-file').setInputFiles(upload(name+'.json',bad));
 await page.waitForFunction(()=>document.querySelector('#v18-verify-result')?.textContent?.includes('복원 전 검사에서 차단'),null,{timeout:25000});
 assert.equal(await page.locator('#confirm-dialog[open]').count(),0,'Unsafe restore reached destructive confirm');
 assert.deepEqual(await snapshot(),before,name+' changed data on rejected restore');
 pass('실제 복원 경로 선차단: '+name);
}
let original,downloadPath;
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#nav-add').click();
 await page.locator('#choose-photo').setInputFiles({name:'qa14-synthetic-1px.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 await page.locator('#problem').fill('QA14 가상 문제: 직사각형을 설명하세요');
 await page.locator('#student-answer').fill('가상 답');
 await page.locator('#memo').fill('안전 백업/복원 QA14');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 assert.equal(await page.locator('.v230-general').isVisible(),true);
 await page.locator('#v230-answer').fill('가상 재풀이 답');
 await page.locator('#v230-explanation').fill('가상 이유 설명');
 await page.locator('#v230-save').click();
 await page.waitForFunction(()=>document.querySelector('.v230-history summary')?.textContent?.includes('1회'),null,{timeout:20000});
 const before=await snapshot();
 assert.equal(before.records.length,1);
 assert.equal(before.photos.length,1);
 assert.equal(before.records[0].generalRetryHistory.length,1);
 pass('합성 사진·일반 재풀이·원본 데이터 초기 보존');
 await settings();
 const [download]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.locator('#export-json').click()]);
 downloadPath=await download.path();
 assert.ok(downloadPath,'Browser backup did not download');
 original=JSON.parse(await readFile(downloadPath,'utf8'));
 assert.equal(original.format,'uriaimath-offline-backup-v02');
 assert.equal(original.records.length,1);
 assert.equal(Object.keys(original.photos).length,1);
 assert.equal(original.integrity?.algorithm,'SHA-256');
 assert.equal(original.records[0].generalRetryHistory.length,1);
 pass('실제 UI 서명 아닌 SHA-256 손상감지형 JSON 전체 백업');
 const id=before.records[0].id;
 await verifyRejected('사진 누락',d=>{delete d.photos[id];d.backupSummary.photoCount=0;});
 await verifyRejected('고아 사진',d=>{d.photos['qa14-ghost']=d.photos[id];d.backupSummary.photoCount=2;});
 await verifyRejected('사진 MIME/바이트 불일치',d=>{d.photos[id]='data:image/png;base64,AAAA';});
 await verifyRejected('중복 기록 ID',d=>{d.records.push(structuredClone(d.records[0]));d.backupSummary.recordCount=2;});
 await verifyRejected('알 수 없는 개념 코드',d=>{d.records[0].conceptId='math.unknown.experimental';});
 await verifyRejected('프로필 허용 길이 초과',d=>{d.profile.nickname='가'.repeat(30);});
 await verifyRejected('오답 메모 1000자 초과',d=>{d.records[0].memo='가'.repeat(1001);});
 await verifyRejected('공통 재풀이 관찰 자동채점 위조',d=>{d.records[0].generalRetryHistory[0].review='auto_pass';});
 await verifyRejected('알 수 없는 미래 프로필 필드',d=>{d.profile.futureField='must_not_silently_drop';});
 await restoreRejected('사진 누락',d=>{delete d.photos[id];d.backupSummary.photoCount=0;});
 await restoreRejected('재풀이 변조',d=>{d.records[0].generalRetryHistory[0].review='mastered';});
 // The export must fail closed with an unassociated local photograph, even if records remain valid.
 await mutatePhoto('add');
 const corrupted=await snapshot();assert.equal(corrupted.records.length,1);
 await page.locator('#export-json').click();
 await page.waitForFunction(()=>document.querySelector('#v07-backup-result')?.textContent?.includes('전체 백업 생성 중단'),null,{timeout:20000});
 assert.deepEqual((await snapshot()).records,before.records,'Failed export mutated record');
 await mutatePhoto('remove');
 assert.deepEqual(await snapshot(),before,'Orphan cleanup failed');
 pass('백업 중 미연결 사진 차단 및 기존 기록/사진 무변경');
 // Destructive restore is permitted only after user's confirm, after an actual verified backup.
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:20000});
 await page.locator('#dlg-ok').click();
 await page.locator('#nav-records').click();
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 0건'),null,{timeout:20000});
 pass('합성 데이터만 사용자 확인창을 거쳐 삭제');
 await settings();
 await page.locator('#import-file').setInputFiles(downloadPath);
 await page.locator('#confirm-dialog[open]').waitFor({timeout:30000});
 await page.locator('#dlg-ok').click();
 await page.locator('#nav-records').click();
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 1건'),null,{timeout:25000});
 const after=await snapshot();
 assert.deepEqual(after.records,before.records,'Records/history changed after restore');
 assert.deepEqual(after.photos,before.photos,'Original photo bytes changed after restore');
 assert.deepEqual(after.settings.find(x=>x[0]==='profile')?.[1],original.profile,'Restored profile differs from exported backup');
 pass('유효 백업 복원 직후 오답·재풀이·사진 바이트·프로필 동일성');
 await page.reload({waitUntil:'domcontentloaded'});
 assert.deepEqual(await snapshot(),after,'Reload mutated restored records');
 pass('페이지 재시작 후 복원 상태 유지');
 await settings();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:20000});
 await page.locator('#dlg-ok').click();
 await page.locator('#nav-records').click();
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('전체 0건'),null,{timeout:20000});
 assert.equal((await snapshot()).photos.length,0,'Test photos remain after cleanup');
 assert.deepEqual(problems,[]);
 pass('격리 합성 자료 사후 삭제 및 브라우저 오류 0');
 console.log('QA_G12_RECOVERY_RESULT='+JSON.stringify({status:'PASS',positiveOrNegativeChecks:passed.length,passed}));
}catch(err){
 console.error('QA_G12_RECOVERY_RESULT='+JSON.stringify({status:'FAIL',passed,error:String(err),problems}));
 try{await page.screenshot({path:'qa14-recovery-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close();}
