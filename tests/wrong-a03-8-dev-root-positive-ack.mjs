// A-03-8 dev-rooted integration *simulation*: two patches in temporary CI
// checkout; new positive ACK-lock release scenario only, no prior suite reruns.
// The tracked product index.html is restored byte-for-byte after this test.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const TARGET='b85aa7176d4da135c2ac4b0d9758a4145081759b';
const PRED='tests/fixtures/a03-8-dev-to-predecessor-guard.patch';
const DELTA='tests/fixtures/a03-6-selective-index-only.patch';
const DIR='qa-proof/wrong-a03-8-positive-ack';
const original=readFileSync('index.html'),hash=b=>createHash('sha256').update(b).digest('hex');
const gitblob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const result={status:'STARTED',candidate:'dev + explicit predecessor safety patch + A03-6 9/3',
 devSha:DEV,targetBlob:TARGET,originalBlob:gitblob(original),
 safeToRestore:false,syntheticOnly:true,productDevModified:false,
 priorSuitesRerun:false,actualOCR:false,actualServerAck:false,actualFamilyAuth:false,
 patches:[],screenshots:[],pageErrors:[],externalRequests:[]};
let preview,browser,context,patched=false,seeded=false;
mkdirSync(DIR,{recursive:true});
const check=(args,label)=>{
 const r=spawnSync('git',args,{encoding:'utf8'});
 result.patches.push({label,exit:r.status,stderr:String(r.stderr||'').slice(0,500)});
 assert.equal(r.status,0,label+': '+r.stderr);
};
async function ledger(page){
 return page.evaluate(dbname=>new Promise((res,rej)=>{
  const o=indexedDB.open(dbname);
  o.onerror=()=>rej(o.error);
  o.onsuccess=()=>{
   const db=o.result,tx=db.transaction(['mistakes','photos'],'readonly'),
     rows=tx.objectStore('mistakes').getAll(),
     keys=tx.objectStore('photos').getAllKeys(),
     photos=tx.objectStore('photos').getAll();
   tx.onerror=()=>{db.close();rej(tx.error)};
   tx.oncomplete=async()=>{try{
    const result={records:rows.result.sort((a,b)=>a.id.localeCompare(b.id)),
       photos:await Promise.all(keys.result.map(async(id,i)=>({
        id,bytes:Array.from(new Uint8Array(await photos.result[i].arrayBuffer()))
       })))};
    db.close();res(result);
   }catch(err){db.close();rej(err)}};
  };
 }), 'uriaimath-github-qa-v224-only');
}
async function screenshot(page,label){
 const path=DIR+'/'+label+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});
 result.screenshots.push(path);
}
async function fillNew(page,problem,memo,withPhoto){
 await page.locator('#nav-add').click();
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(problem);
 await page.locator('#memo').fill(memo);
 if(withPhoto){
  await page.locator('#take-photo').setInputFiles({
   name:'a038-synthetic-1px.png',mimeType:'image/png',
   buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64')});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:14000});
 }
}
async function main(){
 assert.equal(result.originalBlob,'250aff5b0a46490488b64f7b96a83c940d2d6c71','Must be exact immutable dev index blob');
 check(['apply','--check',PRED],'predecessor check');
 check(['apply',PRED],'predecessor apply ephemeral');
 check(['apply','--check',DELTA],'A036 +9/-3 check');
 check(['apply',DELTA],'A036 +9/-3 apply ephemeral');
 patched=true;
 const computed=gitblob(readFileSync('index.html'));
 result.composedBlob=computed;
 assert.equal(computed,TARGET,'Two patch composition must exactly match existing independently PASSed A036 app blob');

 const password=randomBytes(24).toString('hex');
 preview=await startWrongQa66Preview({devSha:DEV,username:'a038-synthetic-qa',password});
 browser=await chromium.launch({headless:true});
 context=await browser.newContext({viewport:{width:320,height:760},
  httpCredentials:{username:'a038-synthetic-qa',password},acceptDownloads:false});
 const page=await context.newPage();
 page.on('pageerror',e=>result.pageErrors.push(String(e)));
 await page.route('**/*',route=>{
  const u=route.request().url();
  if(u.startsWith(preview.url))return route.continue();
  if(!u.startsWith('data:')&&!u.startsWith('blob:'))result.externalRequests.push(u);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 assert.ok((await page.locator('#wrong-qa66-preview-meta').innerText()).includes(DEV));
 assert.equal((await ledger(page)).records.length,0);

 const firstProblem='A038 합성 과학 문제 첫 저장 후 ACK 확인',
       memo='A038 합성 보호자 메모: 아이 모드 비공개',
       secondProblem='A038 확인 뒤 새로 등록하는 별개의 과학 문제';
 await fillNew(page,firstProblem,memo,true);
 // The injected failure only hits the first post-COMMIT readonly mistakes
 // receipt; it does NOT affect the readwrite transaction or original photo.
 await page.evaluate(()=>{
  const original=IDBDatabase.prototype.transaction;
  const state={armed:true,count:0};window.__a038Ack=state;
  IDBDatabase.prototype.transaction=function(stores,mode,...args){
   const names=Array.isArray(stores)?stores:[stores];
   if(state.armed&&mode==='readonly'&&names.length===1&&names[0]==='mistakes'){
    state.armed=false;state.count++;
    throw Error('A038_SYNTHETIC_COMMITTED_READBACK_LOST_ONCE');
   }
   return original.call(this,stores,mode,...args);
  };
 });
 await page.locator('#save-btn').click();
 await page.locator('#form-error:not(.hide)').waitFor({timeout:16000});
 assert.equal(await page.evaluate(()=>window.__a038Ack.count),1);
 const before=await ledger(page);
 assert.equal(before.records.length,1);
 assert.equal(before.photos.length,1);
 assert.equal(before.photos[0].id,before.records[0].id);
 assert.equal(before.records[0].problemText,firstProblem);
 assert.equal(before.records[0].memo,memo);
 assert.equal(await page.locator('#save-btn').isDisabled(),true);
 await screenshot(page,'01-unknown-locked-320');

 // NEW boundary: explicit fresh records-list read discovers the exact
 // committed ID and releases only this uncertain create lock.
 await page.locator('#nav-records').click();
 await page.waitForTimeout(350);
 const pendingDialog=page.locator('#confirm-dialog[open]');
 result.navigationHadConfirm=Boolean(await pendingDialog.count());
 if(result.navigationHadConfirm)await page.locator('#dlg-ok').click();
 await page.waitForTimeout(350);
 result.navigationDebug=await page.evaluate(()=>({
  recordsVisible:!document.querySelector('#page-records')?.classList.contains('hide'),
  addVisible:!document.querySelector('#page-add')?.classList.contains('hide'),
  recordsCount:document.querySelector('#records-count')?.textContent,
  listItems:document.querySelectorAll('#records-list [data-record]').length,
  dialogOpen:document.querySelector('#confirm-dialog')?.open,
  recordsText:(document.querySelector('#records-list')?.textContent||'').slice(0,260)
 }));
 await screenshot(page,'02-records-navigation-debug-320');
 await page.waitForFunction(()=>{
  const text=document.querySelector('#records-count')?.textContent||'';
  return !text.includes('저장 여부 확인 중')&&document.querySelectorAll('[data-record]').length>0;
 },null,{timeout:16000});
 const listing=await page.locator('#page-records').innerText();
 assert.ok(listing.includes(firstProblem));
 await screenshot(page,'02-verified-in-list-320');

 await page.locator('#nav-add').click();
 assert.equal(await page.locator('#save-btn').isDisabled(),false,
  'Confirmed original ID must unlock a genuinely new create after list read');
 await page.locator('#wrong007-grade').selectOption('3');
 await page.locator('#wrong007-subject').selectOption('science');
 await page.locator('#problem').fill(secondProblem);
 await page.locator('#memo').fill('A038 두 번째 독립 메모');
 await page.locator('#save-btn').click();
 await page.waitForFunction(()=>!document.querySelector('#page-detail')?.classList.contains('hide'),null,{timeout:16000});
 const after=await ledger(page);
 assert.equal(after.records.length,2,'distinct intended follow-up entry must succeed');
 assert.equal(after.photos.length,1,'existing photo must not duplicate or disappear');
 const first=after.records.find(x=>x.id===before.records[0].id);
 const second=after.records.find(x=>x.problemText===secondProblem);
 assert.ok(first&&second&&first.id!==second.id);
 assert.deepEqual(first,before.records[0],'Original record bytes/fields unchanged');
 assert.deepEqual(after.photos,before.photos,'Photo blob bytes unchanged');
 await screenshot(page,'03-new-distinct-entry-320');
 await page.setViewportSize({width:390,height:844});
 await screenshot(page,'04-new-distinct-entry-390');
 const dims=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(dims.scroll<=dims.width+2,'390px horizontal overflow');
 assert.deepEqual(result.pageErrors,[]);
 assert.deepEqual(result.externalRequests,[]);
 result.ledger={afterUnknownRecords:before.records.length,
  afterUnknownPhotos:before.photos.length,afterVerifiedRecords:after.records.length,
  afterVerifiedPhotos:after.photos.length,firstId:before.records[0].id,
  secondId:second.id,originalPhotoBytesPreserved:true,
  pendingCreateUnlockAfterVerifiedList:true};
 result.viewport390=dims;
 result.status='PASS_DEV_ROOT_COMPOSITION_POSITIVE_ONLY';
}
try{await main()}
catch(err){
 result.status='FAIL';result.error=String(err);
 result.stack=String(err?.stack||'').slice(0,2500);
 process.exitCode=1;
 console.error('A038_POSITIVE_FAIL '+String(err));
}
finally{
 if(context)await context.close();
 if(browser)await browser.close();
 if(preview)await preview.close();
 writeFileSync('index.html',original);
 result.originalRestoredByteExact=hash(readFileSync('index.html'))===hash(original);
 result.originalRestoredBlob=gitblob(readFileSync('index.html'));
 assert.equal(result.originalRestoredByteExact,true,'Runner restore must be byte-exact');
 assert.equal(result.originalRestoredBlob,'250aff5b0a46490488b64f7b96a83c940d2d6c71');
 result.productDevModified=false;
 writeFileSync(DIR+'/a03-8-positive-result.json',JSON.stringify(result,null,2));
 console.log('A038_POSITIVE_RESULT='+JSON.stringify({status:result.status,patched,byteExactRollback:result.originalRestoredByteExact,
  sourceBlob:result.composedBlob,shotCount:result.screenshots.length,external:result.externalRequests.length}));
}
