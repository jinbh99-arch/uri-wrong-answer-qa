// QA49 real Supabase SDK/CDN load and OAuth authorize URL smoke.
// No actual Google account, OAuth secret, access token, or real user data is used.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const ALLOW='https://hnpbwxgpwpellgeusjim.supabase.co';
const CALLBACK='https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html';
let browser, checks=0;
const pass=s=>{checks++;console.log('PASS QA49 SDK SMOKE',s)};
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:780}});
 await context.addInitScript(()=>{
  globalThis.__QA48_TEST_CLIENT_FACTORY__=async(url,key,opts)=>{
   globalThis.__QA49_LIVE_SDK_ATTEMPTED__=true;
   if(!url.endsWith('.supabase.co')||!key.startsWith('sb_publishable_'))
     throw Error('NONPUBLIC_KEY_OR_UNEXPECTED_PROJECT');
   const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
   return createClient(url,key,opts);
  };
 });
 const page=await context.newPage();
 const failRequests=[];
 page.on('requestfailed',r=>{if(/esm\.sh/.test(r.url()))failRequests.push(r.url())});
 await page.goto('http://127.0.0.1:4173/oauth-test.html',{waitUntil:'domcontentloaded'});
 await page.locator('#google-login:enabled').waitFor();
 await page.getByText('준비됐습니다. 파란색 Google 로그인 버튼을 눌러',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>globalThis.__QA49_LIVE_SDK_ATTEMPTED__||false),false);
 pass('first visit no false SDK call/error and Google test button enabled');
 let interceptedURL='';
 await page.route(ALLOW+'/auth/v1/authorize**',async route=>{
  interceptedURL=route.request().url();
  await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>QA49 OAuth intercepted</title><p>OAuth URL was formed; Google provider was NOT contacted.</p>'});
 });
 await page.locator('#google-login').click();
 await page.waitForURL(url=>url.origin===ALLOW&&url.pathname==='/auth/v1/authorize',{timeout:25000});
 const u=new URL(interceptedURL||page.url());
 assert.equal(u.origin,ALLOW);
 assert.equal(u.pathname,'/auth/v1/authorize');
 assert.equal(u.searchParams.get('provider'),'google');
 assert.equal(u.searchParams.get('redirect_to'),CALLBACK);
 assert.equal(await page.evaluate(()=>globalThis.__QA49_LIVE_SDK_ATTEMPTED__||false),true);
 assert.equal(failRequests.length,0,'Supabase SDK CDN network import failed');
 pass('real CDN Supabase SDK loaded, OAuth PKCE redirect URI and provider validated without actual Google login');
 console.log('QA49_NETWORK_SMOKE_RESULT='+JSON.stringify({status:'PASS',checks,realSDKLoaded:true,
    actualUserGoogleLogin:false,realJWTReceived:false,oauthAuthorizeRequestIntercepted:true,
    childDataCollected:false}));
}catch(e){
 console.error('QA49_NETWORK_SMOKE_RESULT='+JSON.stringify({status:'FAIL',checks,
  error:String(e),stack:String(e?.stack).slice(0,1250)}));
 process.exitCode=1;
}finally{if(browser)await browser.close()}
