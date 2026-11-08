// QA44: actual app Settings 320/390px synthetic Supabase adapter UI.
// Not a live provider integration; email/Google never leave loopback.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const BASE='http://127.0.0.1:4173/';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS QA44 MOBILE AUTH',s)};
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:740}});
  try{
   await ctx.addInitScript(()=>{
    const user='cccccccc-cccc-4ccc-8ccc-cccccccccccc',
     family='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    let logged=false,approved=false,calls=[];
    globalThis.__QA44_SYNTHETIC_STATE__={setApproved:v=>approved=v,getCalls:()=>calls};
    globalThis.__QA44_SYNTHETIC_CLIENT__={
     auth:{
      async signInWithOAuth(options){calls.push('google');return {
       data:{url:'https://accounts.google.com/o/oauth2/v2/auth?state=qa44'}}},
      async signUp(){calls.push('register');return {data:{user:{id:user},session:null}}},
      async signInWithPassword(){calls.push('login');logged=true;return {data:{}}},
      async resetPasswordForEmail(){calls.push('reset');return {data:{}}},
      async updateUser(){return {data:{}}},
      async getUser(){return {data:{user:logged?{id:user}:null}}},
      async signOut(){logged=false;calls.push('logout');return {data:{}}}
     },
     schema(name){
      if(name!=='qa44')throw Error('invalid schema');
      return {from(table){
       if(table!=='guardian_memberships')throw Error('invalid table');
       return {select(){return {eq(){return Promise.resolve({data:[{
        family_id:family,verification_source:approved?'externally_verified':'pending',
        verified_at:approved?'2026-11-08T00:00:00Z':null,
        consent_verified_at:approved?'2026-11-08T00:00:00Z':null,
        revoked_at:null
       }]})}}}}
      }}
     }
    };
   });
   const p=await ctx.newPage();
   await p.goto(BASE,{waitUntil:'domcontentloaded'});
   await p.locator('#nav-settings').click();
   await p.locator('#qa44-auth-lab:visible').waitFor();
   assert.equal(await p.locator('#qa44-google').isEnabled(),true);
   const overshoot=await p.evaluate(()=>
    document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert.ok(overshoot<=3,'width '+width+' overflow '+overshoot);
   assert.equal(await p.locator('#qa44-password').getAttribute('type'),'password');
   assert.equal(await p.locator('#qa44-status').getAttribute('role'),'status');
   pass(width+'px 실제 앱 설정 구글·이메일 가상 로그인 카드 반응형/레이블/보안입력');
   await p.locator('#qa44-google').click();
   await p.getByText('가상 구글 OAuth 주소 생성 검사 완료.',{exact:false}).waitFor();
   assert.equal((await p.evaluate(()=>globalThis.__QA44_SYNTHETIC_STATE__.getCalls())).at(-1),'google');
   pass(width+'px 실제 Google 접속 없이 구글 OAuth SDK 메서드 호출 및 결과 표현');
   await p.locator('#qa44-email').fill('fake@synthetic.invalid');
   await p.locator('#qa44-password').fill('QA44-synthetic-password-test');
   await p.locator('#qa44-register').click();
   await p.getByText('가상 가입·이메일 인증 요청 검사 완료.',{exact:false}).waitFor();
   assert.equal(await p.locator('#qa44-password').inputValue(),'');
   await p.locator('#qa44-password').fill('QA44-synthetic-password-test');
   await p.locator('#qa44-login').click();
   await p.getByText('법정대리인 확인·동의 전까지 오답 접근 불가.',{exact:false}).waitFor();
   assert.equal(await p.locator('#qa44-password').inputValue(),'');
   pass(width+'px 이메일 가입·로그인 실제 UI, 미검증 보호자 권한 차단');
   await p.evaluate(()=>globalThis.__QA44_SYNTHETIC_STATE__.setApproved(true));
   await p.locator('#qa44-recheck').click();
   await p.getByText('합성 DB에서 보호자·동의 승인된 가족 1곳 확인',{exact:false}).waitFor();
   await p.evaluate(()=>globalThis.__QA44_SYNTHETIC_STATE__.setApproved(false));
   await p.locator('#qa44-recheck').click();
   await p.getByText('보호자 관계·동의 확인되지 않음',{exact:false}).waitFor();
   pass(width+'px 외부 승인 상태 변경/철회 즉시 가족 접근 표시 거부');
   await p.locator('#qa44-reset').click();
   await p.getByText('가상 재설정 요청 테스트 완료.',{exact:false}).waitFor();
   await p.locator('#qa44-logout').click();
   await p.getByText('가상 세션 종료.',{exact:false}).waitFor();
   assert.equal(await p.locator('#qa44-password').inputValue(),'');
   assert.equal(await p.locator('#qa44-guardian-status').textContent().then(x=>x.includes('기록 열람·업로드 금지')),true);
   pass(width+'px 재설정·로그아웃·가족 권한 제거, 실제 이메일/서버 전송 없음');
  }finally{await ctx.close()}
 }
 const pub=await browser.newContext();
 try{
  const p=await pub.newPage();
  await p.goto('http://localhost:4173/',{waitUntil:'domcontentloaded'});
  await p.locator('#nav-settings').click();
  assert.equal(await p.locator('#qa44-auth-lab').count(),0);
  pass('localhost 등 허용되지 않은 원점에서는 구글·이메일 시험 UI 미표시');
 }finally{await pub.close()}
 console.log('QA44_MOBILE_AUTH_RESULT='+JSON.stringify({
  status:'PASS',checks,chromiumWidths:[320,390],
  providerMockOnly:true,realGoogleOAuth:false,
  realEmailSent:false,realChildren:0,productionApproved:false
 }));
}catch(e){
 console.error('QA44_MOBILE_AUTH_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1300)}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
