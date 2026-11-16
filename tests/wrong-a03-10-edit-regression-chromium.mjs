// A-03-10: ONLY previously untested existing-record EDIT paths in A-03-9 QA.
// Synthetic browser/IndexedDB, no prior A-03-9 create/error/multitab suite rerun.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const QA_INDEX_BLOB='3e950881c7ad050fb634ef46d7b9be08e69a6075';
const DB='uriaimath-github-qa-v224-only';
const DIR='qa-proof/wrong-a03-10';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const hash=b=>createHash('sha256').update(b).digest('hex');
const gitblob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const startHtml=readFileSync('index.html');
const summary={status:'RUNNING',devSha:DEV,qaAppBlob:gitblob(startHtml),testType:'new existing-edit only',
 syntheticOnly:true,realOCR:false,realServerAck:false,realFamilyAuth:false,safeToRestore:false,
 priorCreateSuitesRepeated:false,devModified:false,cases:{},screenshots:[],externalRequests:[],pageErrors:[]};
mkdirSync(DIR,{recursive:true});
let preview,browser;
async function ledger(page){
 const {records,photos}=await page.evaluate(name=>new Promise((resolve,reject)=>{
  const o=indexedDB.open(name);
  o.onerror=()=>reject(o.error);
  o.onsuccess=()=>{
   const db=o.result,tx=db.transaction(['mistakes','photos'],'readonly');
   const r=tx.objectStore('mistakes').getAll(),k=tx.objectStore('photos').getAllKeys(),p=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(k.result.map(async(id,i)=>({
     id,type:p.result[i].type,bytes:Array.from(new Uint8Array(await p.result[i].arrayBuffer()))
    })));
    db.close();resolve({records:r.result.sort((a,b)=>a.id.localeCompare(b.id)),
     photos:photos.sort((a,b)=>a.id.localeCompare(b.id))});
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
 return {records,photos,sha:photos.map(p=>({id:p.id,sha256:hash(Buffer.from(p.bytes))}))};
}
async function shot(page,label){
 const path=DIR+'/'+label+'.png';await page.screenshot({path,fullPage:true,animations:'disabled'});
 summary.screenshots.push(path);
}
async function assertMobile(page,label){
 await page.setViewportSize({width:390,height:844});
 const dims=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.w+2,'390px horizontal overflow: '+JSON.stringify(dims));
 await shot(page,label);
}
async function setup(ctx){
 const page=await ctx.newPage();
 page.on('pageerror',e=>summary.pageErrors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))summary.externalRequests.push(u);
  return route.abort();
 });
 await page.setViewportSize({width:320,height:760});
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 assert.equal((await ledger(page)).records.length,0);
 return page;
}
async function waitDetail(page){
 await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:16000});
}
async function seedWithPhoto(page,problem){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('math');
 await page.locator('#problem').fill(problem);
 await page.locator('#memo').fill('A0310 합성 보호자 메모 원본');
 await page.locator('#take-photo').setInputFiles({name:'a0310-synthetic-1px.png',mimeType:'image/png',buffer:PNG});
 await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:16000});
 await page.locator('#save-btn').click();await waitDetail(page);
 const l=await ledger(page);
 assert.equal(l.records.length,1);assert.equal(l.photos.length,1);
 return l;
}
async function edit(page){
 await page.locator('#detail-edit').click();
 await page.waitForFunction(()=>!document.querySelector('#page-add')?.classList.contains('hide'),null,{timeout:12000});
 assert.equal(await page.locator('#save-btn').isDisabled(),false);
}
async function runCase(name,fn,password){
 const ctx=await browser.newContext({httpCredentials:{username:'a0310-synthetic-qa',password},acceptDownloads:false});
 try{summary.cases[name]=await fn(ctx);summary.cases[name].status='PASS';console.log('A0310_'+name+'_PASS')}
 catch(e){summary.cases[name]={status:'FAIL',error:String(e),stack:String(e?.stack||'').slice(0,2000)};summary.status='FAIL';console.error('A0310_'+name+'_FAIL '+String(e))}
 finally{await ctx.close()}
}
async function preservedEdit(ctx){
 const page=await setup(ctx),problem='A0310 합성 수학: 3/5과 1/5을 더하는 문제';
 await seedWithPhoto(page,problem);
 // Use app's real parent observation UI, not fake IDB fields.
 await page.locator('#check-status').selectOption('explained');
 await page.locator('#check-memo').fill('A0310 합성 부모 확인: 분모를 유지해 설명');
 await page.locator('#check-save').click();
 await page.waitForFunction(()=>document.querySelector('#check-history')?.textContent?.includes('A0310 합성 부모 확인'),null,{timeout:14000});
 const before=await ledger(page);
 assert.equal(before.records[0].checkHistory.length,1);
 const initialId=before.records[0].id,initialPhotoSha=before.sha[0].sha256;
 await edit(page);
 const photoPreview=page.locator('#v13-old-photo img');
 await photoPreview.waitFor({timeout:10000});
 assert.equal(await page.locator('#problem').inputValue(),problem);
 await page.locator('#memo').fill('A0310 합성 수정 메모: 사진과 학습 이력 보존');
 await page.locator('#save-btn').click();await waitDetail(page);
 const after=await ledger(page);
 assert.equal(after.records.length,1);assert.equal(after.photos.length,1);
 const edited=after.records[0];
 assert.equal(edited.id,initialId);
 assert.equal(edited.memo,'A0310 합성 수정 메모: 사진과 학습 이력 보존');
 assert.deepEqual(edited.checkHistory,before.records[0].checkHistory);
 for(const field of ['practiceHistory','generalRetryHistory','prerequisiteChecks','followupHistory','studyPlan','createdAt'])
  assert.deepEqual(edited[field],before.records[0][field],'Preserve '+field);
 assert.deepEqual(after.photos,before.photos);
 assert.equal(after.sha[0].sha256,initialPhotoSha);
 await shot(page,'01-existing-edit-photo-history-320');
 // Changing subject after learning history exists must fail without mutating
 // the confirmed edit (pre-write rejection through new submit wrapper).
 await edit(page);
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:9000});
 assert.match(await page.locator('#form-error').innerText(),/복습 이력|개념/);
 assert.deepEqual((await ledger(page)).records,after.records,'Rejected subject edit must keep original row');
 assert.deepEqual((await ledger(page)).photos,after.photos,'Rejected edit must keep photo bytes');
 await shot(page,'02-rejected-subject-edit-320');
 await assertMobile(page,'03-rejected-subject-edit-390');
 return {rowCount:after.records.length,photoCount:after.photos.length,historyLength:edited.checkHistory.length,
 photoSha256:initialPhotoSha,unchangedPhotoBytes:true,unchangedHistory:true,
 unsupportedSubjectChangeRejected:true};
}
async function uncertainEdit(ctx){
 const page=await setup(ctx);
 const seeded=await seedWithPhoto(page,'A0310 합성 수학: 평행사변형 넓이');
 await edit(page);
 await page.locator('#memo').fill('A0310 수정 커밋 후 ACK 불확실');
 await page.evaluate(()=>{
  const original=IDBDatabase.prototype.transaction,state={armed:true,hits:0};window.__a0310Ack=state;
  IDBDatabase.prototype.transaction=function(stores,mode,...args){
   const names=Array.isArray(stores)?stores:[stores];
   if(state.armed&&mode==='readonly'&&names.length===1&&names[0]==='mistakes'){
    state.armed=false;state.hits++;
    throw Error('A0310_SYNTHETIC_EDIT_POST_COMMIT_READ_FAIL');
   }
   return original.call(this,stores,mode,...args);
  };
 });
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:12000});
 await page.waitForFunction(()=>!document.querySelector('#save-btn')?.disabled,null,{timeout:12000});
 assert.equal(await page.evaluate(()=>window.__a0310Ack.hits),1);
 assert.match(await page.locator('#form-error').innerText(),/저장 동작은 실행됐으나 저장 후 확인에 실패/);
 const after=await ledger(page);
 assert.equal(after.records.length,1);assert.equal(after.photos.length,1);
 assert.equal(after.records[0].id,seeded.records[0].id);
 assert.equal(after.records[0].memo,'A0310 수정 커밋 후 ACK 불확실');
 assert.deepEqual(after.photos,seeded.photos);
 const status=await page.locator('#v13-save-state').innerText();
 // v1.3 wrapper MUST NOT claim the committed edit definitely failed.
 assert.doesNotMatch(status,/저장하지 못했습니다|저장 실패/);
 assert.match(status,/확인|불확실|목록/);
 await shot(page,'04-existing-edit-unknown-ack-320');
 // Retry against unchanged stale edit snapshot must abort; no new ID,
 // no overwrite, and the photo bytes must remain intact.
 await page.locator('#mistake-form').evaluate(x=>x.requestSubmit());
 await page.waitForFunction(()=>document.querySelector('#form-error')?.textContent?.includes('다른 탭'),null,{timeout:12000});
 const retried=await ledger(page);
 assert.deepEqual(retried.records,after.records);
 assert.deepEqual(retried.photos,after.photos);
 await assertMobile(page,'05-existing-edit-stale-retry-390');
 return {committedEditConfirmedByLedger:true,ackLost:true,wrapperStatus:status,
 staleRetrySafelyRejected:true,newIdCreated:false,photoSha256:seeded.sha[0].sha256};
}
try{
 assert.equal(gitblob(startHtml),QA_INDEX_BLOB,'Must run from exact prior A-03-9 source under review');
 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a0310-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 for(const [n,fn] of [['preservedEdit',preservedEdit],['uncertainEdit',uncertainEdit]])
  await runCase(n,fn,password);
 if(Object.values(summary.cases).some(x=>x.status!=='PASS'))throw Error('A0310_NEW_EDIT_REGRESSION_FAILURE');
 assert.deepEqual(summary.externalRequests,[]);
 assert.deepEqual(summary.pageErrors,[]);
 summary.status='PASS';
}catch(err){summary.status='FAIL';summary.error=String(err);process.exitCode=1;console.error('A0310_TEST_FAIL '+String(err))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 summary.appByteExactAfterRun=hash(readFileSync('index.html'))===hash(startHtml);
 writeFileSync(DIR+'/result.json',JSON.stringify(summary,null,2));
 console.log('A0310_RESULT='+JSON.stringify({status:summary.status,cases:Object.fromEntries(Object.entries(summary.cases).map(([k,v])=>[k,v.status])),
  screenshots:summary.screenshots.length,network:summary.externalRequests.length,errors:summary.pageErrors.length,
  unchanged:summary.appByteExactAfterRun}));
}
