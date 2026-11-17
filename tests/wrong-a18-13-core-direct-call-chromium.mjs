// A18-13 new boundary only: real isolated app core restore direct calls before write.
// Do NOT replay previous restore-button UI, A18-11, or real-family paths.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {startWrongQa66Preview} from '../scripts/qa66-wrong-loopback-preview.mjs';
const DEV='3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b',APP='4734102b111b20b2185f9fe175ac0802eaebf5e5';
const DB='uriaimath-github-qa-v224-only',PENDING='wrongA012PendingCreateV1',DIR='qa-proof/wrong-a18-13';
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
const blobSha=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const app=readFileSync('index.html');assert.equal(blobSha(app),APP,'QA blob changed');mkdirSync(DIR,{recursive:true});
const result={status:'RUNNING',dev:DEV,appBlob:APP,widths:{},errors:[],requests:[],screenshots:[],realFamily:false,safeToRestore:false,previousPassRepeated:false};
let browser,preview;
async function ledger(page){
 return page.evaluate(dbName=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos','settings'],'readonly');
   const m=tx.objectStore('mistakes'),p=tx.objectStore('photos'),s=tx.objectStore('settings');
   const mr=m.getAll(),mk=m.getAllKeys(),pr=p.getAll(),pk=p.getAllKeys(),sr=s.getAll(),sk=s.getAllKeys();
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=async()=>{try{
    const photos=await Promise.all(pr.result.map(async(b,i)=>({key:pk.result[i],size:b.size,mime:b.type,bytes:Array.from(new Uint8Array(await b.arrayBuffer()))})));
    db.close();resolve({
     records:mk.result.map((key,i)=>({key,value:mr.result[i]})),
     photos,settings:sk.result.map((key,i)=>({key,value:sr.result[i]}))
    });
   }catch(e){db.close();reject(e)}};
  };
 }),DB);
}
async function seed(page){
 await page.evaluate(({dbName,marker,bytes})=>new Promise((resolve,reject)=>{
  const req=indexedDB.open(dbName);
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{
   const db=req.result,tx=db.transaction(['mistakes','photos','settings'],'readwrite'),id='wrong-a18-13-fake-photo-parent-01';
   tx.objectStore('mistakes').put({id,subject:'science',gradeAtEntry:3,problemText:'A18-13 합성 과학 오답',
    hasPhoto:true,memo:'가상 부모 기록',reason:'unknown',createdAt:'2026-11-17T01:00:00Z',updatedAt:'2026-11-17T01:00:00Z',
    checkHistory:[{at:'2026-11-17T01:00:00Z',status:'explained',memo:'합성 부모 관찰 1건',by:'parent_observation'}]},id);
   tx.objectStore('photos').put(new Blob([Uint8Array.from(bytes)],{type:'image/png'}),id);
   tx.objectStore('settings').put({id:'a18-13-damaged-pending-ledger',at:1731774000000,v:1},marker);
   tx.onerror=()=>{db.close();reject(tx.error)};
   tx.oncomplete=()=>{db.close();resolve()};
  };
 }),{dbName:DB,marker:PENDING,bytes:Array.from(PNG)});
}
async function exercise(page,width,before){
 await page.setViewportSize({width,height:width===320?760:844});
 const results=await page.evaluate(async()=>{
  if(typeof window.__wrongA1813Probe!=='function')throw Error('isolated internal function probe missing');
  const original=IDBDatabase.prototype.transaction;let writes=0;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   const list=Array.isArray(stores)?stores:[stores];
   if(mode==='readwrite'&&list.includes('mistakes'))writes++;
   return original.call(this,stores,mode,...rest);
  };
  let tested=[];
  try{
   for(const alternateHandle of [false,true]){
    for(const kind of ['directAtomic','directPhoto','directClear']){
     const data=await window.__wrongA1813Probe(kind,alternateHandle);
     tested.push(data);
    }
   }
  }finally{IDBDatabase.prototype.transaction=original}
  const info=document.createElement('p');info.id='a18-13-direct-result';info.setAttribute('role','status');
  info.style.cssText='background:#fff6de;color:#231f12;padding:12px;border:2px solid #8c5e13;white-space:normal;overflow-wrap:anywhere';
  info.textContent='A18-13 격리 직접호출 6경계 차단 판정: '+tested.map(x=>x.blocked?'BLOCK':'FAIL').join(', ')+' / IDB 교체 트랜잭션 '+writes+'회 / 실복원 아님';
  document.getElementById('a18-10-restore-block').after(info);
  return {tested,writes};
 });
 assert.equal(results.tested.length,6);
 assert.ok(results.tested.every(x=>x.blocked&&x.code==='A1813_RESTORE_DISABLED'),JSON.stringify(results));
 assert.equal(results.writes,0,'A destructive readwrite transaction was opened');
 assert.deepEqual(await ledger(page),before,'raw photo bytes, records, parent observations, pending receipt changed');
 assert.ok(await page.locator('#a18-13-direct-result').isVisible());
 const dims=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
 assert.ok(dims.document<=dims.viewport+2,'mobile overflow '+JSON.stringify(dims));
 const path=DIR+'/wrong-a18-13-direct-core-block-'+width+'.png';
 await page.screenshot({path,fullPage:true,animations:'disabled'});result.screenshots.push(path);
 result.widths[String(width)]={status:'PASS',kinds:results.tested.length,atomicGuardErrors:6,destructiveTransactions:0,photoBytesUnchanged:true,pendingUnchanged:true};
}
try{
 const pw=randomBytes(22).toString('hex'),user='a18-13-qa-probe';
 preview=await startWrongQa66Preview({devSha:DEV,username:user,password:pw});
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({httpCredentials:{username:user,password:pw},acceptDownloads:true});
 const page=await ctx.newPage();
 page.on('pageerror',e=>result.errors.push(String(e)));
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(preview.url))return route.continue();
  if(!url.startsWith('data:')&&!url.startsWith('blob:'))result.requests.push(url);
  return route.abort();
 });
 await page.goto(preview.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결'),null,{timeout:17000});
 await seed(page);await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#storage-state')?.textContent?.includes('저장소 연결')||document.querySelector('#storage-state')?.textContent?.includes('저장 차단'),null,{timeout:17000});
 const before=await ledger(page);
 assert.equal(before.records.length,1);assert.equal(before.photos.length,1);assert.equal(before.records[0].value.checkHistory.length,1);
 assert.equal(before.settings.find(x=>x.key===PENDING)?.value.id,'a18-13-damaged-pending-ledger');
 await page.locator('#nav-settings').click();
 await exercise(page,320,before);await exercise(page,390,before);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(400);
 assert.deepEqual(await ledger(page),before,'reload unexpectedly changed synthetic original');
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.requests,[]);
 result.status='PASS_ISOLATED_PRIMARY_RESTORE_DIRECT_CALL_FAIL_CLOSED';
 await ctx.close();
}catch(err){result.status='FAIL';result.error=String(err);result.stack=String(err?.stack||'').slice(0,2800);process.exitCode=1;console.error('A1813_FAIL '+String(err))}
finally{
 await browser?.close();await preview?.close();
 result.appSourceUnchanged=blobSha(readFileSync('index.html'))===APP;
 writeFileSync(DIR+'/result.json',JSON.stringify(result,null,2));
 console.log('A1813_RESULT='+JSON.stringify({status:result.status,widths:result.widths,screenshots:result.screenshots.length,requests:result.requests.length,errors:result.errors.length,appSourceUnchanged:result.appSourceUnchanged,error:result.error}));
}
