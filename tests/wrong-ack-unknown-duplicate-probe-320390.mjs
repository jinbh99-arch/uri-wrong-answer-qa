// WRONG ACK/duplicate one-shot dynamic reproduction (synthetic localhost only).
// Readback fault is injected into a served copy, NOT committed app source.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';

const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b';
const APP='250aff5b0a46490488b64f7b96a83c940d2d6c71';
assert.equal(process.env.WRONG_ACK_DEV_SHA,DEV);
const OUT='qa-proof/ack-unknown-double-submit';
mkdirSync(OUT,{recursive:true});
const report={contract:'WRONG_ACK_UNKNOWN_DOUBLE_SUBMIT_A_PROBE',phase:'BASELINE_ONLY',
  devSha:DEV,appBlob:APP,synthetic:true,realFamily:false,realPhone:false,
  appCommittedChanges:false,safeToRestore:false,cases:[],screenshots:[],
  pageErrors:[],externalRequests:[],errors:[]};
const png=(bytes)=>({width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),
  sha256:createHash('sha256').update(bytes).digest('hex')});
async function shot(page,name){
  const bytes=await page.screenshot({fullPage:true,animations:'disabled'});
  const file=OUT+'/'+name+'.png';writeFileSync(file,bytes);
  report.screenshots.push({file,...png(bytes)});
}
async function dbSnapshot(page){
 const data=await page.evaluate(async()=>{
  const name='uriaimath-github-qa-v224-only';
  const request=indexedDB.open(name);
  const db=await new Promise((ok,no)=>{request.onsuccess=()=>ok(request.result);request.onerror=()=>no(request.error)});
  if(!db.objectStoreNames.contains('mistakes')||!db.objectStoreNames.contains('photos'))
   throw Error('EXPECTED_APP_INDEXEDDB_NOT_READY');
  const transaction=db.transaction(['mistakes','photos'],'readonly');
  function get(store,method){return new Promise((ok,no)=>{
   const req=transaction.objectStore(store)[method]();
   req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);
  })}
  const [records,ids,photos,pids]=await Promise.all([
   get('mistakes','getAll'),get('mistakes','getAllKeys'),
   get('photos','getAll'),get('photos','getAllKeys')]);
  const pic=await Promise.all(photos.map(async(b,i)=>({
   id:String(pids[i]),bytes:Array.from(new Uint8Array(await b.arrayBuffer())),mime:b.type
  })));
  db.close();
  return {records,ids:ids.map(String),photos:pic};
 });
 const pic=data.photos.map(x=>({id:x.id,mime:x.mime,size:x.bytes.length,
  sha256:createHash('sha256').update(Buffer.from(x.bytes)).digest('hex')}));
 return {count:data.records.length,ids:data.ids,
  rows:data.records.map(x=>({id:x.id,subject:x.subject,problemText:x.problemText,
    memo:x.memo,hasPhoto:x.hasPhoto,childNickname:x.childNickname})),
  photos:pic};
}
async function one(preview,browser,width,mode,credentials) {
 const context=await browser.newContext({viewport:{width,height:850},
   httpCredentials:credentials,acceptDownloads:false});
 const page=await context.newPage();
 const evidence={width,mode,clientError:[],outbound:[],screens:[],faultInjected:false};
 page.on('pageerror',err=>evidence.clientError.push(String(err)));
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url===preview.url&&route.request().resourceType()==='document'){
   const response=await route.fetch(),html=await response.text();
   const needle="const verifiedRecord=await readOne('mistakes',id);";
   assert.equal(html.split(needle).length,2,'EXPECTED_VERIFIED_READBACK_SITE_UNIQUE');
   const injected="const verifiedRecord=await (window.__qaAckFailReadbackOnce ? "+
    "((window.__qaAckFailReadbackOnce=false),Promise.reject(new Error('SYNTHETIC_POST_COMMIT_READBACK_FAIL')))"+
    " : readOne('mistakes',id));";
   evidence.faultInjected=true;
   return route.fulfill({response,body:html.replace(needle,injected),
      contentType:'text/html; charset=utf-8'});
  }
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))evidence.outbound.push(url);
  return route.abort();
 });
 try{
  await page.goto(preview.url,{waitUntil:'domcontentloaded'});
  assert.ok((await page.locator('#wrong-qa66-preview-meta').textContent()).includes(DEV));
  await page.locator('#nav-add').click();
  await page.locator('#wrong007-subject').selectOption('science');
  await page.locator('#problem').fill('QA-ACK fictional science problem width '+width+' mode '+mode);
  await page.locator('#student-answer').fill('가상 아이 답 1');
  const memo='QA-ACK 부모 전용 메모 '+width+'-'+mode;
  await page.locator('#memo').fill(memo);
  const tiny=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
  await page.locator('#take-photo').setInputFiles({name:'synthetic-1px.png',mimeType:'image/png',buffer:tiny});
  await page.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'));
  const before=await dbSnapshot(page);
  assert.equal(before.count,0,'new private test browser must have no records');
  await page.evaluate(()=>{window.__qaAckFailReadbackOnce=true});
  if(mode==='sequential-after-ambiguous'){
   await page.locator('#save-btn').click();
   await page.waitForFunction(()=>document.querySelector('#form-error')?.textContent?.includes('중복 등록하지 말고'),
    null,{timeout:18000});
   evidence.firstWarning=await page.locator('#form-error').textContent();
   evidence.afterFirst=await dbSnapshot(page);
   assert.equal(evidence.afterFirst.count,1,'postcommit fault must retain exactly one record');
   assert.equal(evidence.afterFirst.photos.length,1,'photo must persist despite readback error');
   await shot(page,'width-'+width+'-after-readback-unknown');
   await page.locator('#save-btn').click();
   await page.waitForTimeout(1300);
  }else{
   // Two synthetic submit events in the SAME task, before either handler awaits.
   await page.evaluate(()=>{
    const form=document.querySelector('#mistake-form');
    form.requestSubmit();form.requestSubmit();
   });
   await page.waitForFunction(()=>document.querySelector('#form-error')?.textContent?.includes('중복 등록하지 말고')||
     !document.querySelector('#v09-save-confirm')?.classList.contains('hide'),
     null,{timeout:18000});
   await page.waitForTimeout(1300);
  }
  evidence.after=await dbSnapshot(page);
  assert.ok(evidence.after.count>=1 && evidence.after.count<=2,'unexpected synthetic record count');
  evidence.duplicate=evidence.after.count>1;
  evidence.idDistinct=new Set(evidence.after.ids).size===evidence.after.ids.length;
  evidence.photoBytesPreserved=evidence.after.photos.length>=1&&
    evidence.after.photos.every(x=>x.size>0)&&
    (mode!=='sequential-after-ambiguous'||
      evidence.afterFirst.photos.every(p=>evidence.after.photos.some(q=>q.id===p.id&&q.sha256===p.sha256)));
  evidence.uncertainMessage=(await page.locator('#form-error').textContent()).slice(0,240);
  evidence.url=page.url();
  await shot(page,'width-'+width+'-'+mode+'-final');
  // Child DOM check is independent of whether the second save was blocked.
  await page.locator('#v218-child-mode').click();
  if(await page.locator('#nav-records').count())await page.locator('#nav-records').click();
  const list=page.locator('#records-list button[data-record]');
  if(await list.count())await list.first().click();
  evidence.childMemoDom=await page.evaluate(memo=>({
    body:document.body.textContent?.includes(memo)||false,
    input:document.querySelector('#memo')?.value?.includes(memo)||false,
    detail:document.querySelector('#detail-memo')?.textContent?.includes(memo)||false
  }),memo);
  evidence.viewportOverflow=await page.evaluate(()=>({
    viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth
  }));
  assert.equal(evidence.photoBytesPreserved,true,'source photo bytes changed/missing');
  assert.equal(evidence.idDistinct,true,'nonunique IDs detected');
  assert.equal(evidence.childMemoDom.body,false,'parent memo leaked in child DOM text');
  assert.equal(evidence.childMemoDom.input,false,'parent memo leaked in child form input');
  assert.equal(evidence.childMemoDom.detail,false,'parent memo leaked in child detail');
  assert.ok(evidence.viewportOverflow.scrollWidth<=width+3,'horizontal overflow');
  assert.deepEqual(evidence.clientError,[],'JS errors');
  assert.deepEqual(evidence.outbound,[],'external requests');
  return evidence;
 }finally{await context.close()}
}
let browser,preview;let exitCode=0;
try{
 const username='wrong-ack-temp',password=randomBytes(24).toString('hex');
 const credentials={username,password};
 preview=await startWrongQa66Preview({devSha:DEV,...credentials});
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  for(const mode of ['sequential-after-ambiguous','rapid-double-submit']){
   const result=await one(preview,browser,width,mode,credentials);
   report.cases.push(result);
   console.log('WRONG_ACK_CASE='+JSON.stringify({width,mode,duplicate:result.duplicate,
    count:result.after.count,warning:result.uncertainMessage,childMemoDom:result.childMemoDom}));
  }
 }
 const anyDuplicate=report.cases.some(x=>x.duplicate);
 report.status=anyDuplicate?'DYNAMIC_DUPLICATE_CONFIRMED':'DYNAMIC_DUPLICATE_NOT_REPRODUCED';
 report.privacy='CHILD_DOM_TESTED_SYNTHETIC_ONLY';
 report.familyAuth='NOT_TESTED';
 console.log('WRONG_ACK_FINDING='+report.status);
}catch(error){
 exitCode=1;report.status='QA_HARNESS_FAILED';report.errors.push(String(error?.stack||error));
 console.error('WRONG_ACK_HARNESS_ERROR='+String(error?.stack||error));
}finally{
 report.pngCount=report.screenshots.length;
 writeFileSync(OUT+'/result.json',JSON.stringify(report,null,2)+'\n');
 if(browser)await browser.close();if(preview)await preview.close();
}
if(exitCode)process.exitCode=exitCode;
