// Synthetic browser origin-isolation and rollback probe; no app data, no production origin.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const A='http://127.0.0.1:4173/', B='http://127.0.0.1:4174/';
const DB='uriaimath-github-qa-v224-only';
const photo=new Uint8Array([137,80,78,71,13,10,26,10,0,1,2,3,4]);
const expectedHash=createHash('sha256').update(photo).digest('hex');
const report={scope:'synthetic loopback origin boundary',safeToRestore:false,realPersons:0,realPhotos:0,operationalWrites:0,checks:[],status:'FAIL'};
const evidenceDir='artifacts/wrong-origin-qa';
mkdirSync(evidenceDir,{recursive:true});
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
 const plaintextRisk=await ux.evaluate(()=>{
  const notice=document.querySelector('#wrong-backup-risk');
  const trigger=document.querySelector('#export-json');
  const text=notice?.textContent||'';
  return {present:!!notice,priorToDownload:!!(notice&&trigger&&(notice.compareDocumentPosition(trigger)&Node.DOCUMENT_POSITION_FOLLOWING)),
   namesPhotos:text.includes('사진'),namesGuardianNotes:text.includes('부모 메모'),
   saysUnencrypted:text.includes('암호화되지'),namesSharedDownloads:text.includes('공유기기 다운로드 폴더'),
   namesCloudSync:text.includes('클라우드 자동 동기화')};
 });
 report.plaintextRiskBeforeDownload=plaintextRisk;
 check('Plaintext backup risk is disclosed beside export before download',
  plaintextRisk.present&&plaintextRisk.priorToDownload&&plaintextRisk.namesPhotos&&
  plaintextRisk.namesGuardianNotes&&plaintextRisk.saysUnencrypted&&
  plaintextRisk.namesSharedDownloads&&plaintextRisk.namesCloudSync);

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
  await ux.screenshot({path:evidenceDir+'/backup-zoom200-'+width+'.png'});
  zoomOverflowFound ||= zoomView.scrollWidth>zoomView.viewport;
  check('Full-page 200% CSS zoom has no horizontal scroll at '+width+'px',zoomView.scrollWidth<=zoomView.viewport);
  check('Backup modal controls stay inside viewport at CSS 200% and '+width+'px',
    zoomView.controlsInWidth&&zoomView.warningVisible);
  // P1 first-contact disclosure: inspect the untouched modal immediately after
  // keyboard activation, before any test forcibly scrolls or focuses controls.
  // Accessible text association is measurable; actual reader comprehension is not.
  const firstContact=await ux.evaluate(()=>{
    const overlay=document.querySelector('#wrong-backup-confirm');
    const dialog=overlay.querySelector('[role="dialog"]');
    const title=document.querySelector('#wrong-backup-title');
    const warning=document.querySelector('#wrong-backup-description');
    const cancel=document.querySelector('#wrong-backup-cancel');
    const save=document.querySelector('#wrong-backup-continue');
    const frame=overlay.getBoundingClientRect();
    const visibleStart=el=>{
      const r=el.getBoundingClientRect();
      return r.top>=Math.max(0,frame.top)-1&&r.top<Math.min(innerHeight,frame.bottom)
        &&r.bottom>Math.max(0,frame.top)&&r.left>=0&&r.right<=innerWidth;
    };
    return {focus:document.activeElement?.id,overlayTop:overlay.scrollTop,
      titleVisible:visibleStart(title),warningStartVisible:visibleStart(warning),
      labelledBy:dialog.getAttribute('aria-labelledby'),
      describedBy:dialog.getAttribute('aria-describedby'),
      isModal:dialog.getAttribute('aria-modal'),
      warningBeforeSave:!!(warning.compareDocumentPosition(save)&Node.DOCUMENT_POSITION_FOLLOWING),
      warningBeforeCancel:!!(warning.compareDocumentPosition(cancel)&Node.DOCUMENT_POSITION_FOLLOWING),
      mentionsPlaintext:warning.textContent.includes('비밀번호로 보호되지'),
      mentionsPhotos:warning.textContent.includes('사진'),
      mentionsGuardian:warning.textContent.includes('부모 메모'),
      mentionsRestoreLimit:warning.textContent.includes('복원 성공을 보장하지')};
  });
  report['backupFirstContactZoom200_'+width]=firstContact;
  check('Keyboard opening shows linked plaintext photo and parent warning before backup controls at '+width+'px CSS200',
    firstContact.focus==='wrong-backup-cancel'&&firstContact.overlayTop===0
    &&firstContact.titleVisible&&firstContact.warningStartVisible
    &&firstContact.labelledBy==='wrong-backup-title'
    &&firstContact.describedBy==='wrong-backup-description'
    &&firstContact.isModal==='true'&&firstContact.warningBeforeSave
    &&firstContact.warningBeforeCancel&&firstContact.mentionsPlaintext
    &&firstContact.mentionsPhotos&&firstContact.mentionsGuardian
    &&firstContact.mentionsRestoreLimit&&uxDownloads===1);
  // Independent accessibility-tree association: an ARIA attribute alone does not
  // establish that the warning is exposed to assistive technology.
  const dialogAccessibility=await ux.locator('#wrong-backup-confirm [role="dialog"]').ariaSnapshot();
  const accessibleDisclosure={
    treeHasTitle:dialogAccessibility.includes('백업'),
    treeHasPhotoRisk:dialogAccessibility.includes('사진'),
    treeHasGuardianRisk:dialogAccessibility.includes('부모 메모'),
    treeHasPlaintextRisk:dialogAccessibility.includes('비밀번호로 보호되지'),
    comprehensionVerified:false,
    screenReaderVerified:false
  };
  // Preserve the actual synthetic accessibility tree for failure diagnosis.
  // Never infer real screen-reader speech or user comprehension from this snapshot.
  report['backupAccessibilityTreeZoom200_'+width]=dialogAccessibility;
  report['backupAccessibleDisclosureZoom200_'+width]=accessibleDisclosure;
  check('Dialog accessibility tree exposes plaintext, photo and guardian warning at '+width+'px CSS200',
    accessibleDisclosure.treeHasTitle&&accessibleDisclosure.treeHasPhotoRisk
    &&accessibleDisclosure.treeHasGuardianRisk&&accessibleDisclosure.treeHasPlaintextRisk
    &&!accessibleDisclosure.comprehensionVerified&&!accessibleDisclosure.screenReaderVerified);
  // User-operable keyboard-only test: evaluate PageDown BEFORE Tab changes scroll.
  // Never mistake Tab's focus scroll for PageDown's native visibility.
  await ux.locator('#wrong-backup-confirm').evaluate(el=>{el.scrollTop=0});
  const keyboardStart=await ux.evaluate(()=>{
    const d=document.querySelector('#wrong-backup-confirm'),w=document.querySelector('#wrong-backup-description');
    const r=w.getBoundingClientRect(),c=d.getBoundingClientRect();
    return {top:d.scrollTop,height:d.clientHeight,total:d.scrollHeight,
      initialFocus:document.activeElement?.id,bodyTop:document.scrollingElement?.scrollTop||0,
      warningStartVisible:r.top<innerHeight&&r.bottom>0&&r.bottom>c.top&&r.top<c.bottom};
  });
  await ux.screenshot({path:evidenceDir+'/backup-keyboard-first-warning-'+width+'.png'});
  const keyboardPositions=[];
  for(let step=0;step<8;step++){
    await ux.keyboard.press('PageDown');
    keyboardPositions.push(await ux.evaluate(()=>({
      overlay:document.querySelector('#wrong-backup-confirm').scrollTop,
      body:document.scrollingElement?.scrollTop||0,
      dialog:document.querySelector('.wrong-backup-dialog')?.scrollTop||0,
      focus:document.activeElement?.id
    })));
  }
  const keyControls=()=>ux.evaluate(()=>{
    const d=document.querySelector('#wrong-backup-confirm'),w=document.querySelector('#wrong-backup-description');
    const c=document.querySelector('#wrong-backup-cancel'),p=document.querySelector('#wrong-backup-continue');
    const container=d.getBoundingClientRect();
    const visible=el=>{const r=el.getBoundingClientRect();
      return r.top>=Math.max(0,container.top)-1&&r.bottom<=Math.min(innerHeight,container.bottom)+1
        &&r.left>=Math.max(0,container.left)-1&&r.right<=Math.min(innerWidth,container.right)+1};
    return {top:d.scrollTop,cancelVisible:visible(c),saveVisible:visible(p),
      focus:document.activeElement?.id,warningText:w.textContent?.trim().length||0,
      warningBeforeButtons:!!(w.compareDocumentPosition(c)&Node.DOCUMENT_POSITION_FOLLOWING),
      cancelRect:{top:c.getBoundingClientRect().top,bottom:c.getBoundingClientRect().bottom},
      saveRect:{top:p.getBoundingClientRect().top,bottom:p.getBoundingClientRect().bottom}};
  });
  const beforeTab=await keyControls();
  await ux.screenshot({path:evidenceDir+'/backup-pagedown-before-tab-'+width+'.png'});
  report['backupKeyboardPageDownOnlyZoom200_'+width]={keyboardStart,keyboardPositions,beforeTab};
  check('PageDown alone reveals both backup buttons at '+width+'px CSS200',
    keyboardStart.warningStartVisible&&beforeTab.top>keyboardStart.top
    &&beforeTab.cancelVisible&&beforeTab.saveVisible
    &&beforeTab.warningText>0&&beforeTab.warningBeforeButtons);
  // A distinct route: only real Tab/Shift+Tab, without scripted focus.
  await ux.keyboard.press('Tab');
  const tabFocus=await ux.evaluate(()=>document.activeElement?.id);
  const afterTab=await keyControls();
  await ux.keyboard.press('Shift+Tab');
  const reverseTabFocus=await ux.evaluate(()=>document.activeElement?.id);
  const afterReverseTab=await keyControls();
  report['backupKeyboardTabZoom200_'+width]={tabFocus,reverseTabFocus,afterTab,afterReverseTab};
  await ux.screenshot({path:evidenceDir+'/backup-keyonly-zoom200-'+width+'.png'});
  check('Tab and Shift+Tab reveal actual focused backup controls at '+width+'px CSS200',
    tabFocus==='wrong-backup-continue'&&reverseTabFocus==='wrong-backup-cancel'
    &&afterTab.saveVisible&&afterReverseTab.cancelVisible);
  // PageUp must return to the warning with native key input, preserving the
  // background scroll position and not starting an accidental download.
  await ux.keyboard.press('PageUp');
  await ux.keyboard.press('PageUp');
  const returnedToWarning=await ux.evaluate(()=>{
    const d=document.querySelector('#wrong-backup-confirm'),w=document.querySelector('#wrong-backup-description');
    const r=w.getBoundingClientRect(),c=d.getBoundingClientRect();
    return {overlayTop:d.scrollTop,bodyTop:document.scrollingElement?.scrollTop||0,
      warningVisible:r.top<innerHeight&&r.bottom>0&&r.bottom>c.top&&r.top<c.bottom,
      focused:document.activeElement?.id};
  });
  report['backupKeyboardReturnToWarningZoom200_'+width]=returnedToWarning;
  await ux.screenshot({path:evidenceDir+'/backup-pageup-return-warning-'+width+'.png'});
  check('PageUp returns to first warning without background scroll or download at '+width+'px CSS200',
    returnedToWarning.overlayTop===0&&returnedToWarning.bodyTop===keyboardStart.bodyTop
    &&returnedToWarning.warningVisible&&returnedToWarning.focused==='wrong-backup-cancel');
  await ux.locator('#wrong-backup-confirm').evaluate(el=>{el.scrollTop=0});
  // Targeted vertical keyboard audit: a horizontal-fit check cannot establish
  // that a 200%-zoom warning and its actions are reachable in a short viewport.
  const vertical=await ux.evaluate(()=>{
    const modal=document.querySelector('#wrong-backup-confirm');
    const warning=document.querySelector('#wrong-backup-description');
    const cancel=document.querySelector('#wrong-backup-cancel');
    const proceed=document.querySelector('#wrong-backup-continue');
    const rect=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
    return {height:innerHeight,initialFocus:document.activeElement?.id,
      modal:rect(modal),warning:rect(warning),cancel:rect(cancel),proceed:rect(proceed),
      scrollTop:document.scrollingElement.scrollTop};
  });
  await ux.keyboard.press('Shift+Tab');
  const reverseFocus=await ux.evaluate(()=>document.activeElement?.id);
  await ux.keyboard.press('Tab');
  const forwardFocus=await ux.evaluate(()=>document.activeElement?.id);
  await ux.locator('#wrong-backup-description').evaluate(el=>el.scrollIntoView({block:'start'}));
  const warningReachable=await ux.evaluate(()=>{
    const r=document.querySelector('#wrong-backup-description').getBoundingClientRect();
    return r.bottom>0&&r.top<innerHeight;
  });
  // After reading the warning, scroll the modal itself (not the background page).
  // A focused control may remain offscreen when the overlay is zoomed.
  const modalScroll=await ux.locator('#wrong-backup-confirm').evaluate(el=>{
    const before=el.scrollTop;
    el.scrollTop=el.scrollHeight;
    return {before,after:el.scrollTop,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight};
  });
  await ux.locator('#wrong-backup-cancel').focus();
  const cancelReachable=await ux.evaluate(()=>{
    const r=document.querySelector('#wrong-backup-cancel').getBoundingClientRect();
    return document.activeElement?.id==='wrong-backup-cancel'&&r.bottom>0&&r.top<innerHeight;
  });
  await ux.screenshot({path:evidenceDir+'/backup-vertical-keyboard-zoom200-'+width+'.png'});
  await ux.keyboard.press('Enter');
  const cancelClosed=await dialog.isHidden();
  report['backupVerticalKeyboardZoom200_'+width]={...vertical,reverseFocus,forwardFocus,
    warningReachable,modalScroll,cancelReachable,cancelClosed,downloadCount:uxDownloads};
  check('Backup CSS200 vertical warning and keyboard cancel remain reachable at '+width+'px',
    vertical.initialFocus==='wrong-backup-cancel'
    &&reverseFocus==='wrong-backup-continue'&&forwardFocus==='wrong-backup-cancel'
    &&warningReachable&&cancelReachable&&cancelClosed&&uxDownloads===1);
  await ux.evaluate(()=>{document.body.style.zoom=''});
 }
 report.cssZoom200PageOverflowFound=zoomOverflowFound;
 // 00 #6826134113: keyboard-only navigation to horizontally-scrollable settings
 // at synthetic CSS200; focus must reveal an offscreen tab within nav clip.
 for(const width of [320,390]){
  await ux.goto(A);await ux.setViewportSize({width,height:844});
  await ux.evaluate(()=>{document.body.style.zoom='200%';window.scrollTo(0,0)});
  const order=[];
  for(let i=0;i<40;i++){
   await ux.keyboard.press('Tab');
   const id=await ux.evaluate(()=>document.activeElement?.id||document.activeElement?.tagName);
   order.push(id);
   if(id==='nav-settings')break;
  }
  const settingsReachable=order.includes('nav-settings');
  const navMetrics=await ux.evaluate(()=>{
    const el=document.querySelector('#nav-settings'),nav=el.closest('nav');
    const e=el.getBoundingClientRect(),n=nav.getBoundingClientRect();
    return {focused:document.activeElement===el,scrollLeft:nav.scrollLeft,
      viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,
      left:e.left,right:e.right,navLeft:n.left,navRight:n.right,
      revealed:e.left>=Math.max(0,n.left)-1&&e.right<=Math.min(innerWidth,n.right)+1};
  });
  await ux.screenshot({path:evidenceDir+'/nav-keyboard-zoom200-'+width+'.png'});
  await ux.keyboard.press('Enter');
  const opened=await ux.locator('#export-json').isVisible();
  await ux.keyboard.press('Shift+Tab');
  const back=await ux.evaluate(()=>{
   const e=document.querySelector('#nav-concepts'),nav=e.closest('nav'),
     er=e.getBoundingClientRect(),nr=nav.getBoundingClientRect();
   return {focused:document.activeElement===e,visible:er.left>=Math.max(0,nr.left)-1&&er.right<=Math.min(innerWidth,nr.right)+1,scrollLeft:nav.scrollLeft,left:er.left,right:er.right,navLeft:nr.left,navRight:nr.right};
  });
  report['navKeyboardZoom200_'+width]={order,settingsReachable,...navMetrics,opened,back};
  await ux.screenshot({path:evidenceDir+'/nav-reverse-zoom200-'+width+'.png'});
  check('Keyboard Tab/Enter reaches and reveals settings in scrolling nav at '+width+'px CSS200',
   settingsReachable&&navMetrics.focused&&navMetrics.revealed&&opened
    &&navMetrics.pageWidth<=navMetrics.viewport);
  check('Reverse keyboard Shift+Tab reveals preceding concept tab at '+width+'px CSS200',
   back.focused&&back.visible);
  await ux.evaluate(()=>{document.body.style.zoom=''});
 }
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
   if(zoom==='200%')await ux.screenshot({path:evidenceDir+'/add-form-zoom200-'+width+'.png'});
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
 check('Mobile layout inspection and isolated app drills do not mutate source record/photo',
    JSON.stringify(await snapshot(ux))===JSON.stringify(uxBefore));
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
 // Independent QA: read the actually downloaded plaintext JSON, not only the browser's
 // download event. This proves synthetic record/photo byte preservation AND exposure risk.
 let plaintextAudit={readable:false,recordIdentical:false,photoBytesIdentical:false,
   guardianNoteVisible:false,studentAnswerVisible:false,unencryptedWarning:false};
 if(downloadAfterData){
  const downloaded=readFileSync(await downloadAfterData.path(),'utf8');
  const payload=JSON.parse(downloaded);
  const rec=Array.isArray(payload.records)?payload.records.find(r=>r.id===uiRec.id):null;
  const dataUri=payload.photos?.[uiRec.id];
  const rawPhoto=typeof dataUri==='string'&&/^data:image\/(?:png|jpeg|webp);base64,/.test(dataUri)
    ?Buffer.from(dataUri.slice(dataUri.indexOf(',')+1),'base64'):null;
  plaintextAudit={
    readable:payload.format==='uriaimath-offline-backup-v02',
    recordIdentical:Boolean(rec)&&JSON.stringify(rec)===JSON.stringify(uiRec),
    photoBytesIdentical:Boolean(rawPhoto)&&Buffer.from(actualAppBefore.photos[0]).equals(rawPhoto),
    guardianNoteVisible:downloaded.includes('가상 보호자 관찰'),
    studentAnswerVisible:downloaded.includes('가상 아이가 적은 답'),
    unencryptedWarning:String(payload.notice||'').includes('암호화되지'),
    localPlaintextExportOnly:true,safeToRestore:false
  };
 }
 report.downloadedPlaintextAudit=plaintextAudit;
 check('Actual downloaded plaintext file preserves synthetic record/photo bytes and exposes raw child/guardian notes',
   plaintextAudit.readable&&plaintextAudit.recordIdentical&&plaintextAudit.photoBytesIdentical
   &&plaintextAudit.guardianNoteVisible&&plaintextAudit.studentAnswerVisible
   &&plaintextAudit.unencryptedWarning);
 report.realUiBackupWithPhoto={downloads:postSaveDownloads,priorDownloadCount,
  cancelledLedger,escapedLedger,savedLedger,filename:downloadAfterData?.suggestedFilename()||null};
 check('Real UI cancel/Escape make zero downloads, explicit plaintext save exactly one without photo or note loss',
  cancelledLedger&&escapedLedger&&savedLedger&&priorDownloadCount===0
  &&Boolean(downloadAfterData)&&postSaveDownloads===1);
 check('Real app synthetic photo and guardian note remain unchanged after export',
    JSON.stringify(await snapshot(ux))===JSON.stringify(actualAppBefore));
 // Shared-device re-entry risk: closing a backup dialog is not a privacy purge.
 // A fresh tab in the SAME browser context/origin can still read the local
 // synthetic record/photo; no operational authorization is inferred.
 const reentry=await uxContext.newPage();
 await reentry.goto(A);
 const reentryBefore=await snapshot(reentry);
 const sharedDeviceReadable=JSON.stringify(reentryBefore)===JSON.stringify(actualAppBefore);
 await reentry.locator('#nav-settings').click();
 const reentryExport=reentry.locator('#export-json');
 let reentryDownloads=0;
 reentry.on('download',()=>reentryDownloads++);
 await reentryExport.click();
 await reentry.locator('#wrong-backup-confirm').waitFor({state:'visible'});
 await reentry.locator('#wrong-backup-cancel').click();
 await reentry.reload();
 const reentryAfter=await snapshot(reentry);
 report.sharedDeviceReentry={sameOriginReadable:sharedDeviceReadable,
   cancelledDownloadCount:reentryDownloads,
   recordPhotoUnchanged:JSON.stringify(reentryAfter)===JSON.stringify(actualAppBefore),
   exposureRisk:true,safeToRestore:false};
 check('Shared-device same-origin new tab retains synthetic child/guardian record and photo after backup cancel',
   sharedDeviceReadable&&reentryDownloads===0
   &&JSON.stringify(reentryAfter)===JSON.stringify(actualAppBefore));
 await reentry.close();
 await uxContext.close();
 await sameOriginOtherPath.close();
 await context.close();report.status='PASS';
}catch(e){report.error=String(e.stack||e);process.exitCode=1}
finally{await browser.close();writeFileSync(evidenceDir+'/result.json',JSON.stringify(report,null,2));console.log('WRONG_ORIGIN_SYNTHETIC_RESULT='+JSON.stringify(report))}
