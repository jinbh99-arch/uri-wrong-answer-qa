// QA17 G10 — parent/child PRESENTATION only, no login or access control.
// Runs solely on isolated public QA browser with synthetic local text; no real child data.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const DB='uriaimath-github-qa-v224-only';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const page=await context.newPage(),exceptions=[],passed=[];
page.on('pageerror',e=>exceptions.push(String(e)));
const pass=msg=>{passed.push(msg);console.log('PASS QA17',msg)};
async function recordsSnapshot(){
 return page.evaluate(async name=>{
  const request=indexedDB.open(name);
  const db=await new Promise((res,rej)=>{request.onsuccess=()=>res(request.result);request.onerror=()=>rej(request.error)});
  try{
   const tx=db.transaction(['mistakes','photos'],'readonly');
   const a=tx.objectStore('mistakes').getAll(),b=tx.objectStore('photos').getAllKeys();
   const [rows,photoKeys]=await Promise.all([a,b].map(r=>new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})));
   return {rows,photoKeys};
  }finally{db.close()}
 },DB);
}
async function openRecord(){
 await page.locator('#nav-records').click();
 await page.locator('#records-list button.item').filter({hasText:'QA17 가상'}).first().click();
 await page.locator('#detail-text').waitFor();
}
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'false');
 assert.match(await page.locator('.v218-mode-note').innerText(),/계정|비밀번호|보호가 아님/);
 assert.equal(await page.locator('#nav-add').isVisible(),true);
 assert.equal(await page.locator('#nav-settings').isVisible(),true);
 pass('기본 부모 화면·모드 상태 및 비인증 안내 확인');
 await page.locator('#v218-child-mode').focus();
 await page.keyboard.press('Enter');
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('#nav-add').isVisible(),false);
 assert.equal(await page.locator('#nav-settings').isVisible(),false);
 assert.equal(await page.locator('#v218-child-intro').isVisible(),true);
 pass('키보드로 아이 모드 진입, 부모 등록·설정 메뉴/내용 숨김');
 // Non-security router guard: hidden navigation buttons are still DOM elements.
 await page.locator('#nav-settings').evaluate(el=>el.click());
 assert.equal(await page.locator('#page-settings').isVisible(),false);
 assert.equal(await page.locator('#page-home').isVisible(),true);
 await page.locator('#nav-add').evaluate(el=>el.click());
 assert.equal(await page.locator('#page-add').isVisible(),false);
 pass('아이 보기 모드에서 숨겨진 부모 메뉴 DOM 클릭도 학부모 화면으로 이동하지 않음');
 assert.deepEqual(await recordsSnapshot(),{rows:[],photoKeys:[]});
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('QA17 가상 문제: 2+3은?');
 await page.locator('#student-answer').fill('5');
 await page.locator('#memo').fill('실사용자 정보가 아닌 QA 합성 오답');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 let before=await recordsSnapshot();
 assert.equal(before.rows.length,1);
 pass('부모 보기 모드에서만 합성 오답 UI 등록 완료');
 await openRecord();
 assert.equal(await page.locator('#detail-edit').isVisible(),true);
 assert.equal(await page.locator('#detail-delete').isVisible(),true);
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#detail-edit').isVisible(),false);
 assert.equal(await page.locator('#detail-delete').isVisible(),false);
 assert.equal(await page.locator('#check-save').isVisible(),false);
 assert.equal(await page.locator('#detail-concept').isVisible(),true);
 assert.deepEqual(await recordsSnapshot(),before);
 pass('아이 상세 화면에서 수정·삭제·부모 관찰 숨김, 개념 읽기 유지');
 await page.locator('#detail-concept').click();
 await page.locator('#page-concepts:visible').waitFor();
 await page.locator('#tree-toggle').click();
 assert.equal(await page.locator('#tree-section').isVisible(),true);
 assert.deepEqual(await recordsSnapshot(),before);
 pass('아이 모드 개념 연결 탐색 가능, 데이터에 자동 쓰기 없음');
 await openRecord();
 await page.locator('#v218-parent-mode').click();
 assert.equal(await page.locator('#detail-edit').isVisible(),true);
 assert.equal(await page.locator('#detail-delete').isVisible(),true);
 assert.deepEqual(await recordsSnapshot(),before);
 pass('부모 모드 복귀 시 관리 버튼 회복, 기존 기록 무변경');
 // Entering child mode must not discard an unsaved parent's draft.
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('QA17 아직 저장하지 않은 보호자 초안');
 await page.locator('#memo').fill('작성 중 내용을 보존');
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'false');
 assert.equal(await page.locator('#page-add').isVisible(),true);
 assert.equal(await page.locator('#problem').inputValue(),'QA17 아직 저장하지 않은 보호자 초안');
 assert.equal(await page.locator('#memo').inputValue(),'작성 중 내용을 보존');
 assert.deepEqual(await recordsSnapshot(),before);
 pass('미저장 작성 중 아이 화면 전환 차단, 초안·기존 DB 무손실');
 await page.locator('#nav-home').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#v218-child-mode').getAttribute('aria-pressed'),'true');
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.locator('#v218-parent-mode').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#nav-settings').isVisible(),true);
 assert.deepEqual(await recordsSnapshot(),before);
 pass('보기 모드가 계정 권한으로 저장되지 않고 새로고침 시 부모 화면으로 초기화됨');
 await page.locator('#nav-settings').click();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor({timeout:20000});
 await page.locator('#dlg-ok').click();
 await page.locator('#page-home:visible').waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#home-count')?.textContent==='0',null,{timeout:20000});
 const after=await recordsSnapshot();
 assert.equal(after.rows.length,0);
 assert.equal(after.photoKeys.length,0);
 assert.deepEqual(exceptions,[]);
 pass('가상 기록 정상 삭제·개인정보 없음·브라우저 예외 0');
 console.log('QA_G10_MODES_RESULT='+JSON.stringify({status:'PASS',checks:passed.length,passed,security:'VIEW ONLY; NO AUTHENTICATION'}));
}catch(err){
 console.error('QA_G10_MODES_RESULT='+JSON.stringify({status:'FAIL',passed,error:String(err),exceptions}));
 try{await page.screenshot({path:'qa17-modes-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
