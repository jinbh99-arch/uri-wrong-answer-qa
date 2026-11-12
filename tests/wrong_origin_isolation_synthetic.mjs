// Synthetic browser origin-isolation and rollback probe; no app data, no production origin.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
const A='http://127.0.0.1:4173/', B='http://127.0.0.1:4174/';
const DB='uriaimath-github-qa-v224-only';
const photo=new Uint8Array([137,80,78,71,13,10,26,10,0,1,2,3,4]);
const expectedHash=createHash('sha256').update(photo).digest('hex');
const report={scope:'synthetic loopback origin boundary',safeToRestore:false,realPersons:0,realPhotos:0,operationalWrites:0,checks:[],status:'FAIL'};
const check=(label,ok)=>{assert.ok(ok,label);report.checks.push(label)};
const openDb=async (page)=>page.evaluate(async dbName=>{
 const r=indexedDB.open(dbName,1);
 r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('mistakes'))db.createObjectStore('mistakes',{keyPath:'id'});if(!db.objectStoreNames.contains('photos'))db.createObjectStore('photos')};
 return await new Promise((resolve,reject)=>{r.onsuccess=()=>{r.result.close();resolve(true)};r.onerror=()=>reject(r.error)});
},DB);
const snapshot=async page=>page.evaluate(async dbName=>{
 const req=indexedDB.open(dbName);
 const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
 try {const tx=db.transaction(['mistakes','photos'],'readonly');const read=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
 const records=await read(tx.objectStore('mistakes').getAll());
 const keys=await read(tx.objectStore('photos').getAllKeys());
 const photos=await read(tx.objectStore('photos').getAll());
 return {records,keys,photos:await Promise.all(photos.map(async x=>Array.from(new Uint8Array(await x.arrayBuffer()))))};
 }finally{db.close()}
},DB);
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();
 const a=await context.newPage(),b=await context.newPage();
 await a.goto(A);await b.goto(B);
 await openDb(a);await openDb(b);
 await a.evaluate(async ({dbName,bytes})=>{
  const req=indexedDB.open(dbName);
  const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction(['mistakes','photos'],'readwrite');tx.objectStore('mistakes').put({id:'synthetic-1',problemText:'가상 오답',childExplanation:'가상 아이 설명',guardianObservation:'가상 부모 관찰',rechecked:false});tx.objectStore('photos').put(new Blob([new Uint8Array(bytes)],{type:'image/png'}),'synthetic-1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();
 },{dbName:DB,bytes:Array.from(photo)});
 const before=await snapshot(a);
 check('A synthetic record and photo exist',before.records.length===1&&before.photos.length===1);
 check('A photo bytes hash match',createHash('sha256').update(Buffer.from(before.photos[0])).digest('hex')===expectedHash);
 const isolated=await snapshot(b);
 check('B independent origin does not automatically receive records or photos',isolated.records.length===0&&isolated.photos.length===0);
 const cross=await b.evaluate(async url=>{try{await fetch(url,{mode:'cors'});return 'unexpected-success'}catch{return 'blocked'}},A);
 check('B cannot fetch A document cross-origin without CORS',cross==='blocked');
 // Synthetic interrupted target write: abort must preserve B's empty ledger and A's original.
 const aborted=await b.evaluate(async dbName=>{
  const req=indexedDB.open(dbName);
  const db=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
  const result=await new Promise(resolve=>{const tx=db.transaction('mistakes','readwrite');tx.objectStore('mistakes').put({id:'partial',problemText:'incomplete'});tx.abort();tx.onabort=()=>resolve(true);tx.onerror=()=>resolve(false)});
  db.close();return result;
 },DB);
 check('B interrupted transaction abort observed',aborted);
 check('B rollback leaves no partial records',JSON.stringify(await snapshot(b))===JSON.stringify(isolated));
 check('A source remains byte-for-byte unchanged',JSON.stringify(await snapshot(a))===JSON.stringify(before));
 await a.reload();await b.reload();
 check('A source persists after reload',JSON.stringify(await snapshot(a))===JSON.stringify(before));
 check('B remains empty after reload',JSON.stringify(await snapshot(b))===JSON.stringify(isolated));
 await context.close();report.status='PASS';
}catch(e){report.error=String(e.stack||e);process.exitCode=1}
finally{await browser.close();console.log('WRONG_ORIGIN_SYNTHETIC_RESULT='+JSON.stringify(report))}
