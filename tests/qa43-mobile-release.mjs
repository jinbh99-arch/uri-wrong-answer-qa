// QA43: mobile release rehearsal in real Chromium, not a physical device.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import pg from 'pg';
import {createQa40SyntheticOidcResolver} from '../scripts/qa40-oidc-resolver.mjs';
import {createQa41LoopbackFamilyApi} from '../scripts/qa41-signed-family-http.mjs';
const {Pool}=pg;
const ORIGIN='http://127.0.0.1:4173';
if(!process.env.QA39_TEST_DATABASE_URL||
 !process.env.QA39_TEST_DATABASE_URL.includes('127.0.0.1'))
 throw Error('QA43_MOBILE_MUST_USE_EPHEMERAL_DATABASE');
process.env.QA39_REFERENCE_ONLY='1';
process.env.QA40_SYNTHETIC_JWKS_ONLY='1';
process.env.QA41_LOOPBACK_ONLY='1';
const u=new URL(process.env.QA39_TEST_DATABASE_URL);
u.username='qa39_app';u.password='QA39-SYNTHETIC-LOCAL-TEST-ONLY';
const pool=new Pool({connectionString:u.toString()});
let api,browser,checks=0;
const pass=x=>{checks++;console.log('PASS QA43 MOBILE',x)};
try{
 const {publicKey,privateKey}=await generateKeyPair('RS256',{modulusLength:2048});
 const jwk={...await exportJWK(publicKey),alg:'RS256',kid:'qa43-mobile',use:'sig'};
 const resolver=createQa40SyntheticOidcResolver({issuer:'https://qa43-mobile.invalid',
  audience:'qa43-mobile-api',jwks:{keys:[jwk]}});
 api=await createQa41LoopbackFamilyApi({pool,resolveAuthenticatedPrincipal:resolver});
 const expired=await new SignJWT({qa:'mobile'})
  .setProtectedHeader({alg:'RS256',kid:jwk.kid})
  .setIssuer('https://qa43-mobile.invalid').setAudience('qa43-mobile-api')
  .setSubject('qa43-synthetic-expired-mobile')
  .setIssuedAt(Math.floor(Date.now()/1000)-1800)
  .setExpirationTime(Math.floor(Date.now()/1000)-120).sign(privateKey);
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:740},acceptDownloads:true});
  try{
   const page=await ctx.newPage();
   await page.goto(ORIGIN+'/',{waitUntil:'domcontentloaded'});
   await page.locator('#nav-settings').click();
   await page.locator('#qa42-real-api:visible').waitFor();
   const horizontal=await page.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert.ok(horizontal<=3,'horizontal overflow '+width+': '+horizontal);
   assert.equal(await page.locator('#qa42-token').getAttribute('type'),'password');
   assert.equal(await page.locator('#qa42-status').getAttribute('aria-live'),'polite');
   assert.equal(await page.locator('label[for=qa42-token]').count(),1);
   await page.locator('#qa42-token').focus();
   await page.keyboard.press('Tab');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'qa42-connect');
   pass(width+'px 설정 반응형 가로넘침·접근 가능한 토큰 레이블·키보드 탭·상태 안내');

   await page.locator('#qa42-port').fill(String(new URL(api.baseUrl).port));
   await page.locator('#qa42-token').fill(expired);
   await page.locator('#qa42-connect').click();
   await page.getByText('서버 응답 401: AUTH_REQUIRED',{exact:false}).waitFor();
   assert.equal(await page.locator('#qa42-token').inputValue(),'');
   assert.equal(await page.locator('#qa42-upload').isDisabled(),true);
   assert.equal(await page.locator('#qa42-pull').isDisabled(),true);
   assert.equal(await page.evaluate(jwt=>
    Object.values(localStorage).every(v=>!v.includes(jwt)),expired),true);
   pass(width+'px 유효기간 만료 JWT 401 시 인증버튼 폐쇄·비밀번호 입력창 제거·토큰 비저장');

   await ctx.setOffline(true);
   await page.locator('#nav-add').click();
   await page.locator('#problem').fill('QA43 offline arithmetic '+width);
   await page.locator('#student-answer').fill('Synthetic answer');
   await page.locator('#memo').fill('Offline child-free rehearsal');
   await page.locator('#save-btn').click();
   await page.locator('#v09-save-confirm:not(.hide)').waitFor();
   await page.locator('#nav-records').click();
   await page.getByText('QA43 offline arithmetic '+width,{exact:false}).first().waitFor();
   await ctx.setOffline(false);
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#nav-records').click();
   await page.getByText('QA43 offline arithmetic '+width,{exact:false}).first().waitFor();
   pass(width+'px 서버 오프라인에서도 IndexedDB 오답 작성·재접속/새로고침 후 원본 보존');

   await page.locator('#nav-settings').click();
   assert.equal(await page.locator('#qa42-token').inputValue(),'');
   assert.equal(await page.locator('#qa42-upload').isDisabled(),true);
   pass(width+'px 새로고침 이후 가상 JWT 인증 자동 복원 없이 수동 확인 요구');
  }finally{await ctx.close()}
 }
 const pub=await browser.newContext({viewport:{width:390,height:740}});
 try{
  const p=await pub.newPage();
  await p.goto('http://localhost:4173/',{waitUntil:'domcontentloaded'});
  await p.locator('#nav-settings').click();
  assert.equal(await p.locator('#qa42-real-api').count(),0);
  pass('localhost 및 공개 출처는 시험용 JWT 가족 연결 UI 자체 미표시');
 }finally{await pub.close()}
 console.log('QA43_MOBILE_RELEASE_RESULT='+JSON.stringify({
  status:'PASS',checks,chromiumWidths:[320,390],offlinePersistence:true,
  expiredJwtDenied:true,manualReauthentication:true,physicalDevicesTested:0,
  productionCloudTested:false,realChildren:0
 }));
}catch(err){
 console.error('QA43_MOBILE_RELEASE_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(err),stack:String(err?.stack).slice(0,1400)}));
 process.exitCode=1;
}finally{
 if(browser)await browser.close();
 if(api)await api.shutdown();
 await pool.end();
}
