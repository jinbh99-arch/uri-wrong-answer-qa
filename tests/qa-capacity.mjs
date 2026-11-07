import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:390,height:844}});
let a,b;
const evidence=[];
const pass=(name,detail='')=>{evidence.push({name,detail});console.log('PASS BOUNDARY',name,detail)};
async function dbStat(page,id){
 return page.evaluate(async({name,id})=>{
  const req=indexedDB.open(name);
  const db=await new Promise((rs,rj)=>{req.onsuccess=()=>rs(req.result);req.onerror=()=>rj(req.error)});
  const tx=db.transaction(['mistakes','photos'],'readonly');
  const c=tx.objectStore('mistakes').count();
  const photo=tx.objectStore('photos').get(id);
  try{
   const count=await new Promise((rs,rj)=>{c.onsuccess=()=>rs(c.result);c.onerror=()=>rj(c.error)});
   const blob=await new Promise((rs,rj)=>{photo.onsuccess=()=>rs(photo.result);photo.onerror=()=>rj(photo.error)});
   return {count,photoBytes:blob instanceof Blob?Array.from(new Uint8Array(await blob.arrayBuffer())):null};
  }finally{db.close()}
 },{name:DB,id});
}
try{
 a=await ctx.newPage();await a.goto(BASE,{waitUntil:'domcontentloaded'});
 const saved=await a.evaluate(async name=>{
  const req=indexedDB.open(name);const db=await new Promise((rs,rj)=>{req.onsuccess=()=>rs(req.result);req.onerror=()=>rj(req.error)});
  const tx=db.transaction(['mistakes'],'readwrite');
  const store=tx.objectStore('mistakes');
  for(let i=0;i<499;i++){
   const id='qa-synthetic-'+String(i).padStart(3,'0');
   store.put({id,subject:'math',childNickname:'가상',gradeAtEntry:3,
      problemText:'가상 검사용 합성 문항 '+i,studentAnswer:'',memo:'QA only',
      reason:'unknown',conceptId:'',createdAt:'2026-11-07T00:00:00Z',updatedAt:'2026-11-07T00:00:00Z',
      source:'local-demo',ocrStatus:'manual_only',conceptVerified:false,hasPhoto:false,
      checkHistory:[],prerequisiteChecks:[],studyPlan:null,followupHistory:[],practiceHistory:[]},id);
  }
  await new Promise((rs,rj)=>{tx.oncomplete=rs;tx.onerror=()=>rj(tx.error);tx.onabort=()=>rj(tx.error)});
  db.close();return 499;
 },DB);
 assert.equal(saved,499);
 await a.reload({waitUntil:'domcontentloaded'});
 await a.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='499',null,{timeout:20000});
 pass('499개 합성 기록 읽기','원래 사용자 기록 0건');
 await a.locator('#nav-add').click();
 await a.locator('#problem').fill('QA 탭A의 501번째 중복 등록 시도');
 await a.locator('#memo').fill('오래된 탭 A - 저장 금지');
 b=await ctx.newPage();
 await b.goto(BASE,{waitUntil:'domcontentloaded'});
 await b.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='499',null,{timeout:20000});
 await b.locator('#nav-add').click();
 await b.locator('#choose-photo').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:PNG});
 await b.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 await b.locator('#problem').fill('QA 탭B가 먼저 저장한 500번째 문항');
 await b.locator('#memo').fill('안전하게 보존해야 할 B의 사진');
 await b.locator('#save-btn').click();
 await b.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 const id=(await b.evaluate(()=>[...document.querySelectorAll('#records-list [data-record]')].map(x=>x.dataset.record).at(-1)))||'';
 const snapshot=await b.evaluate(async name=>{
  const req=indexedDB.open(name);const db=await new Promise((rs,rj)=>{req.onsuccess=()=>rs(req.result);req.onerror=()=>rj(req.error)});
  const tx=db.transaction('mistakes','readonly');
  const vals=await new Promise((rs,rj)=>{const q=tx.objectStore('mistakes').getAll();q.onsuccess=()=>rs(q.result);q.onerror=()=>rj(q.error)});
  db.close();return vals.find(x=>x.problemText==='QA 탭B가 먼저 저장한 500번째 문항')?.id;
 },DB);
 assert.ok(snapshot,'B 저장의 새 ID 없음');
 const prev=await dbStat(b,snapshot);
 assert.equal(prev.count,500);
 assert.ok(prev.photoBytes?.length>20);
 pass('B의 500번째 문항·사진 저장','저장소 500건');
 await a.locator('#save-btn').click();
 await a.waitForFunction(()=>{const msg=document.querySelector('#form-error');return msg&& !msg.classList.contains('hide') && /500건|최대 500/.test(msg.textContent)},null,{timeout:20000});
 const after=await dbStat(b,snapshot);
 assert.equal(after.count,500,'한도 넘는 501번째가 들어감');
 assert.deepEqual(after.photoBytes,prev.photoBytes,'B의 사진을 덮어쓰거나 삭제함');
 pass('A의 501번째 저장 차단·기존 사진 보존','저장소 500건 그대로');
 console.log('QA_BOUNDARY_RESULT='+JSON.stringify({status:'PASS',checks:evidence}));
}catch(e){
 console.error('QA_BOUNDARY_RESULT='+JSON.stringify({status:'FAIL',checks:evidence,error:String(e)}));
 try{await a?.screenshot({path:'qa-boundary-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
