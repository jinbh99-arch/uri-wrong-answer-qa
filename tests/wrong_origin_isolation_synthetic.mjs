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
 const uxContext=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const ux=await uxContext.newPage();
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
 const exportUi=await ux.evaluate(()=>({banner:document.querySelector('#storage-banner')?.textContent?.slice(0,250),status:document.querySelector('#status')?.textContent?.slice(0,250),notify:document.querySelector('#toast')?.textContent?.slice(0,250)}));
 report.explicitBackup={downloads:uxDownloads,fileName:saved?.suggestedFilename()||null,sourceUnchanged:explicitUnchanged,exportUi};
 check('Explicit plaintext export starts one synthetic download without changing source record and photo',
  Boolean(saved)&&uxDownloads===1&&explicitUnchanged);
 let zoomOverflowFound=false;
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
  // CSS 200% emulation is not a physical device/browser zoom certification.
  await ux.evaluate(()=>{document.body.style.zoom='200%'});
  await realBackup.focus();await ux.keyboard.press('Enter');
  await dialog.waitFor({state:'visible'});
  const zoomView=await ux.evaluate(()=>{
   const d=document.querySelector('#wrong-backup-confirm');
   const c=document.querySelector('#wrong-backup-cancel');
   const p=document.querySelector('#wrong-backup-continue');
   const buttons=[c,p].map(x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
   const offenders=[...document.querySelectorAll('body *')].map(el=>{
      const r=el.getBoundingClientRect(),st=getComputedStyle(el);
      return {tag:el.tagName,id:el.id,cls:String(el.className||'').slice(0,45),
       left:Math.round(r.left),right:Math.round(r.right),width:Math.round(r.width),display:st.display};
    }).filter(x=>x.display!=='none'&&x.width>0&&x.right>innerWidth+1)
      .sort((a,b)=>b.right-a.right).slice(0,12);
   return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,offenders,
     controlsInWidth:buttons.every(r=>r.left>=0&&r.right<=innerWidth),
     warningVisible:d.getBoundingClientRect().top<innerHeight};
  });
  report['backupZoom200_'+width]=zoomView;
  zoomOverflowFound ||= zoomView.scrollWidth>zoomView.viewport;
  check('Full-page 200% CSS zoom has no horizontal scroll at '+width+'px',zoomView.scrollWidth<=zoomView.viewport);
  check('Backup modal controls stay inside viewport at CSS 200% and '+width+'px',
    zoomView.controlsInWidth&&zoomView.warningVisible);
  await ux.keyboard.press('Escape');
  await ux.evaluate(()=>{document.body.style.zoom=''});
 }
 report.cssZoom200PageOverflowFound=zoomOverflowFound;
 // Reuse existing app's isolated-IDB destructive-failure and backup/restore drills.
 // These only touch temporary test databases and never production records.
 await ux.locator('#nav-settings').click();
 await ux.locator('#v21-app-guard-details > summary').click();
 const drills=[
  {button:'v21-app-rollback-run',status:'v21-app-rollback-result',required:'보존'},
  {button:'v21-app-guard-run',status:'v21-app-guard-result',required:'통과'},
  {button:'v24-restore-guard-run',status:'v24-restore-guard-result',required:'통과'},
  {button:'v210-backup-drill-run',status:'v210-backup-drill-result',required:'8/8'},
  {button:'v212-mixed-drill-run',status:'v212-mixed-drill-result',required:'검사 통과'},
 ];
 report.isolatedAppDrills=[];
 for(const d of drills){
  await ux.locator('#'+d.button).click();
  await ux.waitForFunction(id=>{const t=document.getElementById(id)?.textContent?.trim()||'';
    return t.startsWith('✅')||t.startsWith('⛔')},d.status,{timeout:45000});
  const value=(await ux.locator('#'+d.status).innerText()).trim();
  report.isolatedAppDrills.push({name:d.button,result:value.slice(0,220)});
  check('Existing isolated app drill '+d.button+' passes',value.startsWith('✅')&&value.includes(d.required));
 }
 check('Existing app drills leave user-facing ledger/photo unchanged',
   JSON.stringify(await snapshot(ux))===JSON.stringify(uxBefore));
 // New responsive coverage on real input fields and save/cancel CTAs; no submission.
 await ux.locator('#nav-add').click();
 for(const width of [320,390]){
  await ux.setViewportSize({width,height:844});
  for(const zoom of ['','200%']){
   await ux.evaluate(z=>{document.body.style.zoom=z},zoom);
   const metrics=await ux.evaluate(()=>{
    const selectors=['#problem','#student-answer','#memo','#save-btn','#cancel-edit'];
    const controls=selectors.map(s=>{
      const el=document.querySelector(s),r=el.getBoundingClientRect(),st=getComputedStyle(el);
      return {selector:s,visible:st.display!=='none'&&r.width>0,left:r.left,right:r.right};
    });
    return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,controls};
   });
   report['addForm'+width+'Zoom'+(zoom||'100')]=metrics;
   check('Responsive add form at '+width+'px / '+(zoom||'100%')+' zoom',
    metrics.scrollWidth<=metrics.viewport&&metrics.controls.every(x=>x.visible&&x.left>=0&&x.right<=metrics.viewport));
  }
 }
 await ux.evaluate(()=>{document.body.style.zoom=''});
 // Non-operational privacy and restoration PROTOTYPE only. Never register real families,
 // implement a deployment key, read user records, or claim approved secure restore.
 const familyLab=await ux.evaluate(async ({bytes})=>{
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  const payload={familyId:'virtual-family-A',id:'synthetic-parent-child-1',problemText:'가상 문제',
    childExplanation:'가상 아이 설명',guardianObservation:'가상 부모 관찰',photoBytes:bytes};
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const nonce=crypto.getRandomValues(new Uint8Array(12));
  const keyFor=async password=>{
   const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
   return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},
      material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  };
  const aad=id=>encoder.encode('isolated-poc-v1:'+id);
  const key=await keyFor('virtual-A-long-secret-not-production');
  const sealed=new Uint8Array(await crypto.subtle.encrypt(
    {name:'AES-GCM',iv:nonce,additionalData:aad(payload.familyId)},key,
    encoder.encode(JSON.stringify(payload))));
  const reveal=async(pass,family,blob)=>{
    const k=await keyFor(pass);
    const pt=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:nonce,additionalData:aad(family)},k,blob);
    return JSON.parse(decoder.decode(pt));
  };
  const accepted=await reveal('virtual-A-long-secret-not-production',payload.familyId,sealed);
  const validBytes=JSON.stringify(accepted)===JSON.stringify(payload);
  const denied=async(pass,family,blob)=>{
   try{await reveal(pass,family,blob);return false}catch{return true}
  };
  const wrongFamilyRejected=await denied('virtual-A-long-secret-not-production','virtual-family-B',sealed);
  const wrongSecretRejected=await denied('virtual-B-secret','virtual-family-A',sealed);
  const corrupted=new Uint8Array(sealed);corrupted[corrupted.length-1]^=1;
  const tamperRejected=await denied('virtual-A-long-secret-not-production',payload.familyId,corrupted);
  const dbName='wrong-privacy-restore-poc-'+crypto.randomUUID();
  const req=indexedDB.open(dbName,1);
  req.onupgradeneeded=()=>{
    req.result.createObjectStore('mistakes');req.result.createObjectStore('photos');
  };
  const db=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});
  const transaction=(work)=>{
   return new Promise((resolve,reject)=>{
    const tx=db.transaction(['mistakes','photos'],'readwrite');
    work(tx);
    tx.oncomplete=()=>resolve('committed');
    tx.onabort=()=>reject(tx.error||Error('aborted'));
   });
  };
  const read=req=>new Promise((resolve,reject)=>{
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  const snapshot=async()=>{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const [records,photos]=await Promise.all([
    read(tx.objectStore('mistakes').getAll()),
    read(tx.objectStore('photos').getAll())]);
   return JSON.stringify({records,photos:photos.map(p=>Array.from(p))});
  };
  await transaction(tx=>{
   tx.objectStore('mistakes').put({id:'existing-virtual',guardianObservation:'기존 가상 관찰'},'existing-virtual');
   tx.objectStore('photos').put(new Uint8Array([1,2,3]),'existing-virtual');
  });
  const before=await snapshot();
  // A cancelled import and failed authentication never start a target write.
  const afterDeniedAndCancelled=await snapshot();
  const rejectAndCancelPreserve=before===afterDeniedAndCancelled;
  await transaction(tx=>{
   tx.objectStore('mistakes').add({...accepted,id:'synthetic-restored'},'synthetic-restored');
   tx.objectStore('photos').add(new Uint8Array(accepted.photoBytes),'synthetic-restored');
  });
  const afterRestore=await snapshot();
  const parsed=JSON.parse(afterRestore);
  const restored=parsed.records.length===2&&parsed.photos.length===2
   &&parsed.records.some(r=>r.id==='synthetic-restored'
     &&r.childExplanation===payload.childExplanation
     &&r.guardianObservation===payload.guardianObservation)
   &&parsed.photos.some(p=>JSON.stringify(p)===JSON.stringify(bytes));
  let collisionAborted=false;
  try{await transaction(tx=>{
    tx.objectStore('mistakes').add({id:'synthetic-restored',problemText:'incomplete'},'synthetic-restored');
    tx.objectStore('photos').put(new Uint8Array([9,9,9]),'synthetic-restored');
  })}catch{collisionAborted=true}
  const collisionPreserves=collisionAborted&&await snapshot()===afterRestore;
  db.close();
  const deleted=await new Promise(res=>{
   const d=indexedDB.deleteDatabase(dbName);d.onsuccess=()=>res(true);
   d.onerror=()=>res(false);d.onblocked=()=>res(false);
  });
  return {validBytes,wrongFamilyRejected,wrongSecretRejected,tamperRejected,
    rejectAndCancelPreserve,restored,collisionPreserves,deleted,
    productionIntegration:false,liveFamilyAccessControl:false,safeToRestore:false};
 },{bytes:Array.from(photo)});
 report.familyEncryptionRestorePrototype=familyLab;
 check('Synthetic AES-GCM family-scoped backup decrypt preserves photo, child explanation and parent observation',
   familyLab.validBytes);
 check('Synthetic other-family key, wrong secret and tampered backup fail closed',
   familyLab.wrongFamilyRejected&&familyLab.wrongSecretRejected&&familyLab.tamperRejected);
 check('Synthetic cancelled/unauthenticated import writes nothing to destination',
   familyLab.rejectAndCancelPreserve);
 check('Synthetic verified import preserves records and photo bytes with existing ledger',
   familyLab.restored);
 check('Synthetic conflict abort prevents partial import and keeps source records',
   familyLab.collisionPreserves&&familyLab.deleted);
 check('Prototype remains explicitly not operational authentication or safe restore',
   !familyLab.productionIntegration&&!familyLab.liveFamilyAccessControl&&!familyLab.safeToRestore);
 // Actual app UI synthetic photo+text+guardian note flow, in separate blank QA browser context.
 // Valid public-domain 1x1 PNG fixture, never a person's image.
 const imageBytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=','base64');
 await ux.locator('#v08-direct-file').setInputFiles({name:'synthetic-one-pixel.png',mimeType:'image/png',buffer:imageBytes});
 await ux.waitForFunction(()=>document.querySelector('#v08-photo-ready')?.textContent?.includes('사진 선택 완료'),null,{timeout:15000});
 await ux.locator('#problem').fill('가상 수학 문제: 1/2 + 1/3');
 await ux.locator('#student-answer').fill('가상 아이가 적은 답: 2/5');
 await ux.locator('#memo').fill('가상 보호자 관찰: 풀이를 다시 설명하도록 요청');
 await ux.locator('#save-btn').click();
 await ux.locator('#v09-save-confirm').waitFor({state:'visible',timeout:20000});
 const actualAppBefore=await snapshot(ux);
 const uiRec=actualAppBefore.records[0];
 const appSaveValid=actualAppBefore.records.length===1&&actualAppBefore.photos.length===1
  &&actualAppBefore.photos[0].length>0
  &&uiRec?.problemText?.includes('가상 수학 문제')
  &&uiRec?.studentAnswer?.includes('가상 아이가 적은 답')
  &&uiRec?.memo?.includes('가상 보호자 관찰');
 report.realUiSyntheticSave={records:actualAppBefore.records.length,
   photos:actualAppBefore.photos.length,photoBytes:actualAppBefore.photos[0]?.length||0,
   hasStudentAnswer:Boolean(uiRec?.studentAnswer),hasGuardianNote:Boolean(uiRec?.memo)};
 check('Real app UI saves synthetic photo, text, answer and guardian note together',appSaveValid);
 await ux.reload();
 check('Real app UI synthetic record and photo persist byte-for-byte after reload',
  JSON.stringify(await snapshot(ux))===JSON.stringify(actualAppBefore));
 await ux.locator('#nav-settings').click();
 const realGate=ux.locator('#wrong-backup-confirm'),realExport=ux.locator('#export-json');
 let postSaveDownloads=0;
 ux.on('download',()=>postSaveDownloads++);
 await realExport.click();
 await realGate.waitFor({state:'visible'});
 await ux.locator('#wrong-backup-cancel').click();
 const cancelledLedger=JSON.stringify(await snapshot(ux))===JSON.stringify(actualAppBefore);
 await realExport.click();await realGate.waitFor({state:'visible'});
 await ux.keyboard.press('Escape');
 const escapedLedger=JSON.stringify(await snapshot(ux))===JSON.stringify(actualAppBefore);
 const priorDownloadCount=postSaveDownloads;
 await realExport.click();await realGate.waitFor({state:'visible'});
 const liveSave=ux.waitForEvent('download',{timeout:15000}).catch(()=>null);
 await ux.locator('#wrong-backup-continue').click();
 const downloadAfterData=await liveSave;
 if(downloadAfterData)await downloadAfterData.failure().catch(()=>null);
 const savedLedger=JSON.stringify(await snapshot(ux))===JSON.stringify(actualAppBefore);
 report.realUiBackupWithPhoto={downloads:postSaveDownloads,priorDownloadCount,
  cancelledLedger,escapedLedger,savedLedger,filename:downloadAfterData?.suggestedFilename()||null};
 check('Real UI cancel/Escape make zero downloads, explicit plaintext save exactly one without photo or note loss',
  cancelledLedger&&escapedLedger&&savedLedger&&priorDownloadCount===0
  &&Boolean(downloadAfterData)&&postSaveDownloads===1);
 check('Mobile layout inspection and isolated app drills do not mutate source record/photo',
    JSON.stringify(await snapshot(ux))===JSON.stringify(uxBefore));
 await uxContext.close();
 await sameOriginOtherPath.close();
 await context.close();report.status='PASS';
}catch(e){report.error=String(e.stack||e);process.exitCode=1}
finally{await browser.close();console.log('WRONG_ORIGIN_SYNTHETIC_RESULT='+JSON.stringify(report))}
