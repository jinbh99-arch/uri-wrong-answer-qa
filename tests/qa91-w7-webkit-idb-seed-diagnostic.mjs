// QA91: WebKit IndexedDB seed-only diagnostic; no product restore or real data.
import { webkit } from 'playwright';
import { randomBytes } from 'node:crypto';
import { startWrongQa66Preview } from '../scripts/qa66-wrong-loopback-preview.mjs';
const SHA=process.env.WRONG_QA90_DEV_SHA;
if(!/^[a-f0-9]{40}$/.test(SHA||''))throw Error('Set WRONG_QA90_DEV_SHA');
let server,browser;
try {
 const username='qa91',password=randomBytes(18).toString('hex');
 server=await startWrongQa66Preview({devSha:SHA,username,password});
 browser=await webkit.launch({headless:true});
 const context=await browser.newContext({httpCredentials:{username,password}});
 const page=await context.newPage();
 await page.route('**/*',r=>r.request().url().startsWith(server.url)?r.continue():r.abort());
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 const results=await page.evaluate(async()=>{
  const output={origin:location.origin,secure:isSecureContext,agent:navigator.userAgent,cases:[]};
  for(const [label,value] of [
   ['plain-object',{id:'old',hasPhoto:true}],
   ['uint8array-4',new Uint8Array([1,2,3,4])],
   ['blob-4',new Blob([new Uint8Array([1,2,3,4])],{type:'image/png'})],
   ['blob-4096',new Blob([new Uint8Array(4096)],{type:'image/png'})],
   ['blob-262144',new Blob([new Uint8Array(262144)],{type:'image/png'})]
  ]){
   const name='qa91-'+label+'-'+Math.random().toString(36).slice(2);
   let db;
   try {
    const open=indexedDB.open(name,1);
    db=await new Promise((resolve,reject)=>{
     open.onupgradeneeded=()=>open.result.createObjectStore('photos');
     open.onsuccess=()=>resolve(open.result);
     open.onerror=()=>reject(open.error||Error('open failed'));
    });
    const tx=db.transaction('photos','readwrite');
    const req=tx.objectStore('photos').put(value,'old');
    const errors=[];
    req.onerror=()=>errors.push('request:'+String(req.error?.name||'null'));
    tx.onerror=()=>errors.push('transaction:'+String(tx.error?.name||'null'));
    const status=await new Promise(resolve=>{
     tx.oncomplete=()=>resolve('complete');
     tx.onabort=()=>resolve('abort');
    });
    output.cases.push({label,status,errors,txError:tx.error?.name||null,requestError:req.error?.name||null});
   }catch(e){output.cases.push({label,status:'exception',error:e?.name||String(e),message:String(e?.message||'')})}
   finally{db?.close();indexedDB.deleteDatabase(name)}
  }
  return output;
 });
 console.log('QA91_SEED_DIAG '+JSON.stringify(results));
 if(results.cases.some(c=>c.status!=='complete'))process.exitCode=2;
 await context.close();
}finally{await browser?.close();await server?.close?.();}
