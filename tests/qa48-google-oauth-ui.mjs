// QA48 actual-app-origin Google OAuth PKCE test with injected synthetic SDK.
// This browser test NEVER visits Google nor sends a real user's token.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS QA48 GOOGLE',s)};
const BASE='http://127.0.0.1:4173/oauth-test.html';
const CALLBACK='https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html';
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const ctx=await browser.newContext({viewport:{width,height:800}});
  await ctx.addInitScript(()=>{
   const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
   globalThis.__QA48_TEST_CALLS__=[];
   globalThis.__QA48_TEST_CLIENT_FACTORY__=async(_url,_key,opts)=>{
    globalThis.__QA48_TEST_CALLS__.push({type:'factory',flow:opts.auth.flowType,
     sessionStorage:opts.auth.storage===window.sessionStorage,
     detectSession:opts.auth.detectSessionInUrl,
     noAutoRefresh:!opts.auth.autoRefreshToken,
     publicKey:_key.startsWith('sb_publishable_')});
    return {
     auth:{
      async signInWithOAuth(p){
       globalThis.__QA48_TEST_CALLS__.push({type:'oauth',p});
       return {data:{provider:'google',url:'https://accounts.google.com'},error:null}
      },
      async getSession(){
       globalThis.__QA48_TEST_CALLS__.push({type:'session'});
       return {data:{session:sessionStorage.getItem('qa48-test-session')==='active'
        ?{access_token:'synthetic-only'}:null},error:null}
      },
      async getUser(){
       globalThis.__QA48_TEST_CALLS__.push({type:'getUser'});
       return {data:{user:{id:U,is_anonymous:false}},error:null}
      },
      async signOut(){
       globalThis.__QA48_TEST_CALLS__.push({type:'logout'});
       sessionStorage.removeItem('qa48-test-session');
       sessionStorage.removeItem('uri-qa48-owner-google-test-session');
       return {error:null}
      }
     },
     async rpc(name){
      globalThis.__QA48_TEST_CALLS__.push({type:'rpc',name});
      return {data:[],error:null}
     },
     functions:{
      async invoke(name,opts){
       globalThis.__QA48_TEST_CALLS__.push({type:'edge',name,opts});
       if(sessionStorage.getItem('qa48-test-edge-fail')==='yes')
        return {error:new Error('Synthetic fake auth failure'),data:null};
       return {error:null,data:{
        authenticated:true,guardianVerificationRequired:true,
        verifiedFamilyCount:0,studentRecordsEnabled:false,
        uploadsEnabled:false,syncWritesEnabled:false,
        productionApproved:false
       }}
      }
     }
    }
   };
  });
  try{
   const p=await ctx.newPage();
   await p.goto(BASE,{waitUntil:'domcontentloaded'});
   await p.locator('#google-login:enabled').waitFor();
   await p.getByText('준비됐습니다. 파란색 Google 로그인 버튼을 눌러',{exact:false}).waitFor();
   assert.equal(await p.evaluate(()=>globalThis.__QA48_TEST_CALLS__.length),0);
   pass(width+'px first visit shows normal ready state without calling auth SDK, no false red error');
   assert.equal(await p.locator('#logout').isDisabled(),true);
   assert.equal(await p.locator('#verify').isDisabled(),true);
   assert.equal(await p.locator('input[type=file]').count(),0);
   assert.ok((await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth))<=3);
   pass(width+'px no OAuth session: test-page mobile responsive, only Google button and no child-data upload');
   await p.locator('#google-login').click();
   await p.getByText('Google 계정 선택 화면으로 이동합니다.').waitFor();
   let calls=await p.evaluate(()=>globalThis.__QA48_TEST_CALLS__);
   assert.equal(calls.find(x=>x.type==='oauth')?.p?.provider,'google');
   assert.equal(calls.find(x=>x.type==='oauth')?.p?.options?.redirectTo,CALLBACK);
   assert.equal(calls.find(x=>x.type==='factory')?.flow,'pkce');
   assert.equal(calls.find(x=>x.type==='factory')?.sessionStorage,true);
   assert.equal(calls.find(x=>x.type==='factory')?.noAutoRefresh,true);
   assert.equal(calls.find(x=>x.type==='factory')?.publicKey,true);
   pass(width+'px Google authorization uses one exact QA callback, PKCE, per-tab storage, publishable key');
   await p.evaluate(()=>sessionStorage.setItem('qa48-test-session','active'));
   await p.goto(BASE+'?code=synthetic-fake-oauth-code&state=synthetic',{waitUntil:'domcontentloaded'});
   await p.getByText('실제 Google 계정 로그인 확인 성공!',{exact:false}).waitFor();
   assert.equal(await p.locator('#google-login').isDisabled(),true);
   assert.equal(await p.locator('#verify').isEnabled(),true);
   assert.equal(await p.locator('#logout').isEnabled(),true);
   assert.equal(new URL(p.url()).search,'');
   calls=await p.evaluate(()=>globalThis.__QA48_TEST_CALLS__);
   assert.ok(calls.some(x=>x.type==='getUser'));
   assert.ok(calls.some(x=>x.type==='rpc'&&x.name==='qa47_my_verified_family_ids'));
   assert.ok(calls.some(x=>x.type==='edge'&&x.name==='qa47-auth-status'&&x.opts.method==='GET'));
   pass(width+'px OAuth callback exchanges session, verifies getUser/RLS/Edge, scrubs code and blocks student data');
   await p.locator('#logout').click();
   await p.getByText('로그아웃했습니다.',{exact:false}).waitFor();
   assert.equal(await p.locator('#google-login').isEnabled(),true);
   assert.equal(await p.evaluate(()=>sessionStorage.getItem('qa48-test-session')),null);
   pass(width+'px user-triggered logout ends in-tab auth session');
   await p.evaluate(()=>{
    sessionStorage.setItem('qa48-test-session','active');
    sessionStorage.setItem('uri-qa48-owner-google-test-session','synthetic-session-marker');
    sessionStorage.setItem('qa48-test-edge-fail','yes')
   });
   await p.reload({waitUntil:'domcontentloaded'});
   await p.getByText('Google 인증 이후 보호자 접근권한 확인에 실패했습니다.',{exact:false}).waitFor();
   assert.equal(await p.locator('#logout').isDisabled(),true);
   assert.equal(await p.evaluate(()=>sessionStorage.getItem('qa48-test-session')),null);
   pass(width+'px backend Edge failure fails closed, logs out, never grants records');
  }finally{await ctx.close()}
 }
 const ctx=await browser.newContext();
 try{
  const p=await ctx.newPage();
  await p.goto('http://localhost:4173/oauth-test.html',{waitUntil:'domcontentloaded'});
  assert.equal(await p.locator('#google-login').isDisabled(),true);
  await p.getByText('격리된 공식 QA 시험 주소에서만 실행',{exact:false}).waitFor();
  pass('unapproved localhost alias cannot launch real OAuth');
 }finally{await ctx.close()}
 console.log('QA48_GOOGLE_TEST_RESULT='+JSON.stringify({status:'PASS',checks,
  testedRealGoogleAuthorization:false,testedLiveJWT:false,
  redirectsTo:CALLBACK,adultTesterActionStillRequired:true,
  realChildDataCreated:false,liveProductionApproved:false}));
}catch(e){
 console.error('QA48_GOOGLE_TEST_RESULT='+JSON.stringify({status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1300)}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
