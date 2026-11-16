// A-03-9 only: new dev-tailored guard implementation, synthetic Chromium.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b', DIR='qa-proof/wrong-a03-9';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const DB='uriaimath-github-qa-v224-only';
const sha=b=>createHash('sha256').update(b).digest('hex');
const gitblob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const outcome={status:'RUNNING',baseDevSha:DEV,qaAppBlob:gitblob(readFileSync('index.html')),
cases:{},screenshots:[],external:[],errors:[],syntheticOnly:true,realOCR:false,realServerAck:false,realFamilyAuth:false,
 safeToRestore:false,priorSuitesRepeated:false,devChanged:false};
let preview,browser;
mkdirSync(DIR,{recursive:true});
async function ledger(page){
 const l=await page.evaluate(name=>new Promise((resolve,reject)=>{
  const o=indexedDB.open(name);
  o.onerror=()=>reject(o.error);
  o.onsuccess=()=>{
   const d=o.result,t=d.transaction(['mistakes','photos'],'readonly'),r=t.objectStore('mistakes').getAll(),
    p=t.objectStore('photos').getAll(),k=t.objectStore('photos').getAllKeys();
   t.onerror=()=>{d.close();reject(t.error)};
   t.oncomplete=async()=>{try{
    const photos=await Promise.all(k.result.map(async(id,i)=>({id,type:p.result[i].type,bytes:Array.from(new Uint8Array(await p.result[i].arrayBuffer()))})));
    d.close();resolve({records:r.result.sort((a,b)=>a.id.localeCompare(b.id)),photos:photos.sort((a,b)=>a.id.localeCompare(b.id))});
   }catch(e){d.close();reject(e)}};
  };
 }),DB);
 return {...l,photoHashes:l.photos.map(p=>({id:p.id,sha256:sha(Buffer.from(p.bytes)),length:p.bytes.length}))};
}
async function pageSetup(ctx,w=320){
 const page=await ctx.newPage();
 await page.setViewportSize({width:w,height:760});
 page.on('pageerror',e=>outcome.errors.push(String(e)));
 await page.route('**/*',r=>{
  const url=r.request().url();
  if(url.startsWith(preview.url))return r.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))outcome.external.push(url);
  return r.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 return page;
}
async function fill(page,subject,problem,memo,withPhoto){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption(subject);
 await page.locator('#problem').fill(problem);
 await page.locator('#memo').fill(memo);
 if(withPhoto){
  await page.locator('#take-photo').setInputFiles({name:'synthetic-one-pixel.png',mimeType:'image/png',buffer:PNG});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:16000});
 }
}
async function shot(page,label){
 const path=DIR+'/'+label+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 outcome.screenshots.push(path);
}
async function viewport390(page,label){
 await page.setViewportSize({width:390,height:844});
 const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.width+2,'390 overflow: '+JSON.stringify(dims));
 await shot(page,label);
}
async function confirmIfOpen(page){
 const dia=page.locator('#confirm-dialog[open]');
 if(await dia.count())await page.locator('#dlg-ok').click();
}
async function waitDetail(page){await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:16000})}
async function runCase(name,fn){
 const ctx=await browser.newContext({viewport:{width:320,height:760},httpCredentials:{username:'a039-synthetic-qa',password:outcome._password},acceptDownloads:false});
 try{outcome.cases[name]=await fn(ctx);outcome.cases[name].status='PASS';console.log('A039_'+name+'_PASS')}
 catch(e){outcome.cases[name]={status:'FAIL',error:String(e),stack:String(e?.stack||'').slice(0,1100)};outcome.status='FAIL';console.error('A039_'+name+'_FAIL: '+String(e))}
 finally{await ctx.close()}
}
async function casePhoto(ctx){
 const page=await pageSetup(ctx),text='A039 합성 국어 문제: 이야기의 중심 문장',memo='A039 합성 보호자 메모(아동 정보 아님)';
 await fill(page,'korean',text,memo,true);
 await page.evaluate(()=>{
  const prior=CanvasRenderingContext2D.prototype.drawImage;
  window.__a039PhotoReject={called:0};
  CanvasRenderingContext2D.prototype.drawImage=function(...args){
   window.__a039PhotoReject.called++;CanvasRenderingContext2D.prototype.drawImage=prior;
   throw Error('A039_SYNTHETIC_PHOTO_CONVERSION_REJECT');
  };
 });
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:16000});
 const message=await page.locator('#form-error').innerText();
 assert.match(message,/사진 변환에 실패/);
 assert.equal(await page.locator('#problem').inputValue(),text);
 assert.equal(await page.locator('#memo').inputValue(),memo);
 assert.equal((await ledger(page)).records.length,0);
 assert.equal(await page.locator('#save-btn').isDisabled(),false);
 await shot(page,'A01-photo-reject-320');
 await page.locator('#mistake-form').evaluate(f=>f.requestSubmit());
 await waitDetail(page);
 const after=await ledger(page);
 assert.equal(after.records.length,1);
 assert.equal(after.photos.length,1);
 assert.equal(after.records[0].problemText,text);
 assert.equal(after.records[0].memo,memo);
 assert.equal(after.photos[0].id,after.records[0].id);
 await viewport390(page,'A02-photo-retry-390');
 return {failureDisplayed:true,inputPreserved:true,originalRows:0,retryRows:1,retryPhotos:1,photoSha256:after.photoHashes[0].sha256};
}
async function injectReadOnce(page,label){
 await page.evaluate(label=>{
  const old=IDBDatabase.prototype.transaction;
  const state={armed:true,hits:0};window.__a039ReadOnce=state;
  IDBDatabase.prototype.transaction=function(stores,mode,...args){
   const ss=Array.isArray(stores)?stores:[stores];
   if(state.armed&&mode==='readonly'&&ss.length===1&&ss[0]==='mistakes'){
    state.hits++;state.armed=false;throw Error(label);
   }
   return old.call(this,stores,mode,...args);
  };
 },label);
}
async function caseAck(ctx){
 const page=await pageSetup(ctx),text='A039 합성 과학 문제: 달의 모양',memo='A039 합성 부모 전용 관찰';
 await fill(page,'science',text,memo,true);
 await injectReadOnce(page,'A039_SYNTHETIC_COMMITTED_ACK_LOST');
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:16000});
 assert.equal(await page.evaluate(()=>window.__a039ReadOnce.hits),1);
 const before=await ledger(page);
 assert.equal(before.records.length,1);assert.equal(before.photos.length,1);
 assert.equal(await page.locator('#save-btn').isDisabled(),true);
 await shot(page,'B01-ack-unknown-320');
 // The same unconfirmed intent must stay locked even after home -> add.
 await page.locator('#nav-home').click();await confirmIfOpen(page);
 await page.locator('#nav-add').click();
 assert.equal(await page.locator('#save-btn').isDisabled(),true);
 await page.locator('#mistake-form').evaluate(f=>f.requestSubmit());
 assert.equal((await ledger(page)).records.length,1);
 await shot(page,'B02-guard-menu-reentry-320');
 // One transient failure of records-list read must NOT unlock.
 await injectReadOnce(page,'A039_SYNTHETIC_LIST_READ_FAIL');
 await page.locator('#nav-records').click();await confirmIfOpen(page);
 await page.waitForFunction(()=>document.querySelector('#records-count')?.textContent?.includes('목록을 읽지 못했습니다'),null,{timeout:10000});
 assert.equal(await page.evaluate(()=>window.__a039ReadOnce.hits),1);
 await page.locator('#nav-add').click();await confirmIfOpen(page);
 assert.equal(await page.locator('#save-btn').isDisabled(),true);
 assert.equal((await ledger(page)).records.length,1);
 // A successful READONLY snapshot with the original precise ID releases lock.
 await page.locator('#nav-records').click();await confirmIfOpen(page);
 await page.waitForFunction(()=>{const c=document.querySelector('#records-count')?.textContent||'';return !c.includes('저장 여부 확인 중')&&document.querySelector('#records-list')?.textContent?.includes('A039 합성 과학 문제');},null,{timeout:13000});
 await page.locator('#nav-add').click();
 assert.equal(await page.locator('#save-btn').isDisabled(),false);
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill('A039 완전히 새로운 과학 문제: 행성');
 await page.locator('#memo').fill('A039 새 메모');
 await page.locator('#save-btn').click();
 await waitDetail(page);
 const after=await ledger(page);
 assert.equal(after.records.length,2);assert.equal(after.photos.length,1);
 assert.deepEqual(after.photos,before.photos,'Original photo bytes must stay unchanged');
 assert.deepEqual(after.records.find(r=>r.id===before.records[0].id),before.records[0]);
 assert.notEqual(after.records.find(r=>r.problemText.includes('행성')).id,before.records[0].id);
 await viewport390(page,'B03-new-intent-after-confirm-390');
 return {ackLostOneTime:true,lockedAcrossMenu:true,lockedWhenListReadFails:true,
  unlockedOnlyAfterOriginalIdConfirmed:true,firstRows:1,finalRows:2,photos:1,
  preservedPhotoSha256:before.photoHashes[0].sha256,photoByteStable:true};
}
async function caseTabs(ctx){
 const a=await pageSetup(ctx),b=await pageSetup(ctx);
 await fill(a,'english','A039 합성 영어 A: The cat is small','A039 보호자 A',false);
 await fill(b,'english','A039 합성 영어 B: The dogs are big','A039 보호자 B',false);
 await Promise.all([
  a.locator('#mistake-form').evaluate(f=>{f.requestSubmit();f.requestSubmit()}),
  b.locator('#mistake-form').evaluate(f=>{f.requestSubmit();f.requestSubmit()})
 ]);
 await Promise.all([waitDetail(a),waitDetail(b)]);
 const rows=await ledger(a);
 assert.equal(rows.records.length,2);
 assert.equal(rows.photos.length,0);
 assert.equal(new Set(rows.records.map(r=>r.id)).size,2);
 assert.deepEqual(new Set(rows.records.map(r=>r.problemText)),new Set([
 'A039 합성 영어 A: The cat is small','A039 합성 영어 B: The dogs are big'
 ]));
 await shot(a,'C01-two-tabs-320');
 await viewport390(b,'C02-two-tabs-390');
 return {records:rows.records.length,photos:rows.photos.length,uniqueIds:2,duplicateClickBlocked:true,legitimateTabBPreserved:true};
}
function rollbackProof(){
 const orig=readFileSync('index.html');const dir=mkdtempSync(join(tmpdir(),'wrong-a039-'));
 try{
  const r=spawnSync('git',['diff',DEV,'HEAD','--','index.html'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const patch=r.stdout;assert.ok(patch.includes('diff --git a/index.html'));
  writeFileSync(join(dir,'index.html'),orig);
  const init=spawnSync('git',['init','-q'],{cwd:dir,encoding:'utf8'});
  assert.equal(init.status,0,init.stderr);
  const reverse=spawnSync('git',['apply','--reverse','-'],{cwd:dir,input:patch,encoding:'utf8'});
  assert.equal(reverse.status,0,reverse.stderr);
  const restored=readFileSync(join(dir,'index.html'));
  assert.equal(gitblob(restored),'250aff5b0a46490488b64f7b96a83c940d2d6c71');
  const forward=spawnSync('git',['apply','-'],{cwd:dir,input:patch,encoding:'utf8'});
  assert.equal(forward.status,0,forward.stderr);
  assert.equal(sha(readFileSync(join(dir,'index.html'))),sha(orig));
  outcome.rollback={gitApplyReverse:true,originalDevBlob:gitblob(restored),
   qaReappliedByteExact:true,appSourceUnchanged:sha(readFileSync('index.html'))===sha(orig)};
 }finally{rmSync(dir,{force:true,recursive:true})}
}
try{
 outcome._password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a039-synthetic-qa',password:outcome._password});
 browser=await chromium.launch({headless:true});
 for(const [name,fn] of [['photoReject',casePhoto],['ackUnknown',caseAck],['twoTabs',caseTabs]])await runCase(name,fn);
 rollbackProof();
 assert.deepEqual(outcome.external,[]);
 assert.deepEqual(outcome.errors,[]);
 if(Object.values(outcome.cases).some(x=>x.status!=='PASS'))throw Error('A039_NEW_CASE_FAILURE');
 outcome.status='PASS';
}catch(e){outcome.status='FAIL';outcome.error=String(e);process.exitCode=1;console.error('A039_RESULT_FAIL '+String(e))}
finally{
 if(browser)await browser.close();
 if(preview)await preview.close();
 delete outcome._password;
 writeFileSync(DIR+'/result.json',JSON.stringify(outcome,null,2));
 console.log('A039_RESULT='+JSON.stringify({status:outcome.status,cases:Object.fromEntries(Object.entries(outcome.cases).map(([k,x])=>[k,x.status])),
  screenshots:outcome.screenshots.length,requests:outcome.external.length,pageErrors:outcome.errors.length,rollback:outcome.rollback}));
}
