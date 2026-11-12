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
  await new Promise((resolve,reject)=>{const tx=db.transaction(['mistakes','photos'],'readwrite');tx.objectStore('mistakes').put({id:'synthetic-1',problemText:'가상 오답',childExplanation:'가상 아이 설명',guardianObservation:'가상 부모 관찰',rechecked:false},'synthetic-1');tx.objectStore('photos').put(new Blob([new Uint8Array(bytes)],{type:'image/png'}),'synthetic-1');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
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
  const result=await new Promise(resolve=>{const tx=db.transaction('mistakes','readwrite');tx.objectStore('mistakes').put({id:'partial',problemText:'incomplete'},'partial');tx.abort();tx.onabort=()=>resolve(true);tx.oncomplete=()=>resolve(false)});
  db.close();return result;
 },DB);
 check('B interrupted transaction abort observed',aborted);
 check('B rollback leaves no partial records',JSON.stringify(await snapshot(b))===JSON.stringify(isolated));
 check('A source remains byte-for-byte unchanged',JSON.stringify(await snapshot(a))===JSON.stringify(before));
 await a.reload();await b.reload();
 check('A source persists after reload',JSON.stringify(await snapshot(a))===JSON.stringify(before));
 check('B remains empty after reload',JSON.stringify(await snapshot(b))===JSON.stringify(isolated));
 // S-01: A browser's storage is keyed by origin, NOT path. Positive risk evidence,
 // not a permission/access-control success or a supported migration route.
 const sameOriginOtherPath=await context.newPage();
 await sameOriginOtherPath.goto(A+'index.html');
 const sameOriginLedger=await snapshot(sameOriginOtherPath);
 const sourceStill=await snapshot(a);
 const s01Shared=JSON.stringify(sameOriginLedger)===JSON.stringify(before);
 check('S-01 same-origin different-path page CAN access same record and photo without changing source',
   s01Shared&&JSON.stringify(sourceStill)===JSON.stringify(before));
 report.s01SameOriginPathShared=s01Shared; // true is an exposure risk, not privacy protection
 // Backup consent: opening the plaintext-export gate must not itself download.
 // Cancel and Escape are both explicit no-export paths; synthetic page only.
 const backupButton=sameOriginOtherPath.locator('#export-json');
 await backupButton.waitFor({state:'attached'});
 let downloads=0;
 sameOriginOtherPath.on('download',()=>downloads++);
 await backupButton.evaluate(el=>el.click());
 const gate=sameOriginOtherPath.locator('#wrong-backup-confirm');
 await gate.waitFor({state:'visible'});
 const warning=await gate.locator('#wrong-backup-description').innerText();
 const warningPresent=warning.includes('비밀번호로 보호되지')&&warning.includes('사진')&&warning.includes('복원 성공을 보장하지');
 await gate.locator('#wrong-backup-cancel').click();
 const cancelled=await gate.isHidden();
 await backupButton.evaluate(el=>el.click());
 await gate.waitFor({state:'visible'});
 await sameOriginOtherPath.keyboard.press('Escape');
 const escaped=await gate.isHidden();
 check('Plaintext backup gate warns before download; cancel and Escape create no download',
   warningPresent&&cancelled&&escaped&&downloads===0);
 report.backupCancelDownloads=downloads;
 // P1: use real visible navigation and keyboard, never a hidden DOM click.
 const ux=await context.newPage({viewport:{width:390,height:844},acceptDownloads:true});
 await ux.goto(A);
 await ux.locator('#nav-settings').focus();
 const navFocused=await ux.evaluate(()=>document.activeElement?.id==='nav-settings');
 await ux.keyboard.press('Enter');
 const realBackup=ux.locator('#export-json');
 await realBackup.waitFor({state:'visible'});
 const settingsVisible=await realBackup.isVisible();
 await realBackup.focus();
 const triggerFocused=await ux.evaluate(()=>document.activeElement?.id==='export-json');
 const uxBefore=await snapshot(ux);
 let uxDownloads=0;
 ux.on('download',()=>uxDownloads++);
 await ux.keyboard.press('Enter');
 const dialog=ux.locator('#wrong-backup-confirm');
 await dialog.waitFor({state:'visible'});
 const cancelDefault=await ux.evaluate(()=>document.activeElement?.id==='wrong-backup-cancel');
 await ux.keyboard.press('Shift+Tab');
 const reverseWrap=await ux.evaluate(()=>document.activeElement?.id==='wrong-backup-continue');
 await ux.keyboard.press('Tab');
 const forwardWrap=await ux.evaluate(()=>document.activeElement?.id==='wrong-backup-cancel');
 await ux.keyboard.press('Escape');
 const escapeClosed=await dialog.isHidden();
 const focusRestored=await ux.evaluate(()=>document.activeElement?.id==='export-json');
 const cancelUnchanged=JSON.stringify(await snapshot(ux))===JSON.stringify(uxBefore);
 check('Visible settings keyboard navigation, dialog focus trap and Escape restore without data mutation',
  navFocused&&settingsVisible&&triggerFocused&&cancelDefault&&reverseWrap&&forwardWrap&&escapeClosed&&focusRestored&&cancelUnchanged&&uxDownloads===0);
 report.keyboardBackup={navFocused,settingsVisible,triggerFocused,cancelDefault,reverseWrap,forwardWrap,escapeClosed,focusRestored,cancelUnchanged,downloadsAfterEscape:uxDownloads};
 // Separate explicit save. The original export is intentionally plaintext and must
 // never be interpreted as encrypted or guaranteed-restorable.
 await realBackup.focus();await ux.keyboard.press('Enter');
 await dialog.waitFor({state:'visible'});
 const explicitDownload=ux.waitForEvent('download',{timeout:15000}).catch(()=>null);
 await ux.locator('#wrong-backup-continue').click();
 const saved=await explicitDownload;
 if(saved){await saved.failure().catch(()=>null)}
 const explicitUnchanged=JSON.stringify(await snapshot(ux))===JSON.stringify(uxBefore);
 check('Explicit plaintext export starts one synthetic download without changing source record and photo',
  Boolean(saved)&&uxDownloads===1&&explicitUnchanged);
 report.explicitBackup={downloads:uxDownloads,fileName:saved?.suggestedFilename()||null,sourceUnchanged:explicitUnchanged};
 for(const width of [320,390]){
  await ux.setViewportSize({width,height:844});
  await realBackup.focus();await ux.keyboard.press('Enter');
  await dialog.waitFor({state:'visible'});
  const view=await ux.evaluate(()=>{
   const d=document.querySelector('#wrong-backup-confirm');
   const c=document.querySelector('#wrong-backup-cancel');
   const p=document.querySelector('#wrong-backup-continue');
   const bounds=[d,c,p].map(x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
   return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttonsVisible:bounds.slice(1).every(r=>r.right<=innerWidth&&r.left>=0&&r.bottom>0),dialogVisible:bounds[0].top<innerHeight};
  });
  report['backupViewport'+width]=view;
  check('Backup warning and controls fit '+width+'px viewport',view.scrollWidth<=view.viewport&&view.buttonsVisible&&view.dialogVisible);
  await ux.keyboard.press('Escape');
 }
 await ux.close();
 await sameOriginOtherPath.close();
 await context.close();report.status='PASS';
}catch(e){report.error=String(e.stack||e);process.exitCode=1}
finally{await browser.close();console.log('WRONG_ORIGIN_SYNTHETIC_RESULT='+JSON.stringify(report))}
