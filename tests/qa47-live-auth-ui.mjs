// QA47 actual QA app Settings: real-service route is owner localhost only.
// This CI test uses injected synthetic SDK and DOES NOT contact providers.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ROOT='http://127.0.0.1:4173/';
let browser,checks=0;
const pass=s=>{checks++;console.log('PASS QA47 REAL AUTH STAGE',s)};
try{
 browser=await chromium.launch({headless:true});
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:740}});
  try{
   await context.addInitScript(()=>{
    const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',F='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    let logged=false,approved=false,edgeFail=false,calls=[];
    globalThis.__QA47_TEST_CONTROL__={
     calls:()=>calls,approve:v=>{approved=v},edgeFail:v=>{edgeFail=v}
    };
    globalThis.__QA47_LOCAL_TEST_CLIENT_FACTORY__=async cfg=>{
     if(!cfg.publishableKey.startsWith('sb_publishable_'))throw Error('unsafe key');
     return {
      auth:{
       async signInWithPassword(){calls.push('real-sdk-email-sign-in');logged=true;return {error:null}},
       async getUser(){calls.push('real-sdk-get-user');return {
        data:{user:logged?{id:U,is_anonymous:false}:null},error:null
       }},
       async signOut(){calls.push('real-sdk-sign-out');logged=false;return {error:null}}
      },
      async rpc(name){calls.push('rpc-'+name);if(name!=='qa47_my_verified_family_ids')throw Error('WRONG_RPC');
       return {data:approved?[F]:[],error:null}},
      functions:{
       async invoke(name,opts){calls.push('live-edge-'+name);
        if(name!=='qa47-auth-status'||opts.method!=='GET')throw Error('WRONG_EDGE');
        return edgeFail?{error:Error('fail')}:{data:{
         authenticated:true,studentRecordsEnabled:false,
         syncWritesEnabled:false,verifiedFamilyCount:approved?1:0
        },error:null}}
      }
     };
    };
   });
   const p=await context.newPage();
   await p.goto(ROOT+'?qa47=1',{waitUntil:'domcontentloaded'});
   await p.locator('#nav-settings').click();
   await p.locator('#qa47-live-auth:visible').waitFor();
   assert.equal(await p.locator('#qa47-live-google').isDisabled(),true);
   assert.equal(await p.locator('#qa47-live-password').getAttribute('type'),'password');
   assert.equal(await p.locator('#qa47-live-status').getAttribute('role'),'status');
   const over=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
   assert.ok(over<=3,width+'px horizontal overflow '+over);
   pass(width+'px actual app uses real-service login staging UI, Google disabled, responsive');
   await p.locator('#qa47-live-email').fill('adult-test@synthetic.invalid');
   await p.locator('#qa47-live-password').fill('QA47-SYNTHETIC-PASSWORD-LONG');
   await p.locator('#qa47-live-login').click();
   await p.getByText('실제 이메일 로그인 확인 · 법정대리인 관계·동의 미검증',{exact:false}).waitFor();
   assert.equal(await p.locator('#qa47-live-password').inputValue(),'');
   const calls=await p.evaluate(()=>globalThis.__QA47_TEST_CONTROL__.calls());
   assert.ok(calls.includes('real-sdk-email-sign-in'));
   assert.ok(calls.includes('real-sdk-get-user'));
   assert.ok(calls.includes('rpc-qa47_my_verified_family_ids'));
   assert.ok(calls.includes('live-edge-qa47-auth-status'));
   pass(width+'px real Supabase SDK contract -> getUser -> real read-only guardian RPC -> edge diagnostic');
   await p.evaluate(()=>globalThis.__QA47_TEST_CONTROL__.approve(true));
   await p.locator('#qa47-live-recheck').click();
   await p.getByText('외부 승인된 보호자 가족 1곳 확인 · 학생 기록·사진·동기화는 여전히 비활성화',{exact:false}).waitFor();
   pass(width+'px guardian approval remains blocked from student record transmission');
   await p.evaluate(()=>globalThis.__QA47_TEST_CONTROL__.edgeFail(true));
   await p.locator('#qa47-live-recheck').click();
   await p.getByText('실제 인증/보호자 상태 확인 실패',{exact:false}).waitFor();
   assert.equal(await p.locator('#qa47-live-recheck').isDisabled(),true);
   assert.ok((await p.evaluate(()=>globalThis.__QA47_TEST_CONTROL__.calls())).includes('real-sdk-sign-out'));
   pass(width+'px failed actual Edge verification clears identity, automatic logout, no student data');
  }finally{await context.close()}
 }
 for(const url of [ROOT,'http://localhost:4173/?qa47=1']){
  const ctx=await browser.newContext();try{
   const p=await ctx.newPage();await p.goto(url,{waitUntil:'domcontentloaded'});
   await p.locator('#nav-settings').click();
   assert.equal(await p.locator('#qa47-live-auth').count(),0);
   pass('QA47 live login UI absent on '+url);
  }finally{await ctx.close()}
 }
 console.log('QA47_REAL_LOGIN_UI_RESULT='+JSON.stringify({status:'PASS',checks,
  realProvidersContacted:false,actualGoogleOAuthConfigured:false,actualEmailSent:false,
  liveEdgeDeploymentVerifiedByCI:false,realChildren:0,productionApproved:false}));
}catch(e){
 console.error('QA47_REAL_LOGIN_UI_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(e),stack:String(e?.stack).slice(0,1300)}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
