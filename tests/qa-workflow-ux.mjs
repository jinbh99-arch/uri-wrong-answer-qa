import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE=process.env.QA_BASE||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const exceptions=[];
page.on('pageerror',e=>exceptions.push(String(e)));
let checks=0;
const pass=(what)=>{checks++;console.log('PASS QA9:',what)};
try{
 await page.goto(BASE,{waitUntil:'domcontentloaded'});
 await page.locator('#v08-home-add').waitFor();
 const order=await page.evaluate(()=>{
  const a=document.querySelector('.v08-start').getBoundingClientRect().top;
  const b=document.querySelector('#v09-runtime-card').getBoundingClientRect().top;
  return {start:a,diagnostic:b};
 });
 assert.ok(order.start<order.diagnostic,'등록 시작보다 기술 안내가 앞에 있음');
 pass('부모 첫 화면의 핵심 촬영 CTA 우선 배치');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:844});
  const rect=await page.locator('#v08-home-add').evaluate(button=>{
   const r=button.getBoundingClientRect();
   return {left:r.left,right:r.right,width:r.width,screen:innerWidth};
  });
  assert.ok(rect.left>=-1&&rect.right<=rect.screen+1,'CTA horizontal overflow at '+width);
  assert.ok(rect.width>=200,'CTA too narrow at '+width);
 }
 await page.setViewportSize({width:390,height:844});
 pass('320·390·768px 모바일/태블릿 화면에서 핵심 등록 버튼 표시');

 assert.equal(await page.locator('#qa9-next-action').isVisible(),false);
 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('QA9 가상 문항 1/4+2/4=?');
 await page.locator('#memo').fill('QA9 저장 전 임시 메모');
 await page.locator('#nav-home').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 assert.match(await page.locator('#dlg-title').innerText(),/저장하지 않은 입력/);
 await page.locator('#dlg-cancel').click();
 assert.equal(await page.locator('#page-add').isVisible(),true);
 assert.equal(await page.locator('#problem').inputValue(),'QA9 가상 문항 1/4+2/4=?');
 assert.equal(await page.locator('#memo').inputValue(),'QA9 저장 전 임시 메모');
 pass('입력 중 이동 취소 시 문항·메모 그대로 유지');

 await page.locator('#nav-home').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.locator('#page-home').waitFor({state:'visible'});
 assert.equal(await page.locator('#qa9-next-action').isVisible(),false);
 pass('사용자가 명시적으로 확인한 경우에만 초안 이탈 허용');

 await page.locator('#nav-add').click();
 await page.locator('#problem').fill('1/4+2/4=?');
 await page.locator('#student-answer').fill('3/8');
 await page.locator('#memo').fill('QA9 가상 데이터. 실제 아이 자료 아님');
 await page.locator('#concept').selectOption('math.fraction.add.same_den');
 await page.locator('#save-btn').click();
 await page.locator('#v09-save-confirm:not(.hide)').waitFor({timeout:20000});
 pass('가상 오답 실제 저장 완료');

 await page.locator('#nav-home').click();
 await page.locator('#qa9-next-action:not(.hide)').waitFor();
 const title=await page.locator('#qa9-next-open').innerText();
 assert.match(title,/최근 오답 학습 이어가기/);
 await page.locator('#qa9-next-open').click();
 assert.equal(await page.locator('#page-detail').isVisible(),true);
 assert.match(await page.locator('#detail-text').innerText(),/1\/4\+2\/4/);
 pass('홈의 다음 활동 1개에서 오답 상세로 연결');

 await page.locator('#detail-edit').click();
 await page.locator('#memo').fill('QA9 편집 중 메모');
 await page.locator('#nav-concepts').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-cancel').click();
 assert.equal(await page.locator('#memo').inputValue(),'QA9 편집 중 메모');
 pass('기존 기록 수정 중 메뉴 이동 보호');
 await page.locator('#cancel-edit').click();

 await page.locator('#nav-home').click();
 await page.locator('#v218-child-mode').click();
 assert.equal(await page.locator('#qa9-next-action').isVisible(),false);
 assert.equal(await page.locator('#nav-add').isVisible(),false);
 pass('아이 화면은 보호자용 후속 정리와 등록 메뉴를 숨김');
 await page.locator('#v218-parent-mode').click();
 await page.locator('#nav-settings').click();
 await page.locator('#clear-all').click();
 await page.locator('#confirm-dialog[open]').waitFor();
 await page.locator('#dlg-ok').click();
 await page.locator('#nav-home').click();
 assert.equal(await page.locator('#qa9-next-action').isVisible(),false);
 pass('가상 데이터 삭제 후 다음 작업 패널 초기화');

 assert.deepEqual(exceptions,[]);
 pass('JavaScript 페이지 오류 없음');
 console.log('QA9_RESULT='+JSON.stringify({status:'PASS',checks}));
}catch(error){
 console.error('QA9_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(error),exceptions}));
 try{await page.screenshot({path:'qa-workflow-ux-failure.png',fullPage:true})}catch{}
 process.exitCode=1;
}finally{await browser.close()}
