// QA51 / 00Q-02-AUTH — restricted real-session proof, no saved credentials.
// Run only against separately approved isolated QA51 environment.
// A human logs in in this same ephemeral headed context; sessionStorage is not
// supported by Playwright storageState. No token files, traces or screenshots.
import {createHash} from 'node:crypto';
const env=process.env;
const required=['QA51_E2E_PAGE_URL','QA51_E2E_SUPABASE_URL','QA51_E2E_SUPABASE_PUBLISHABLE_KEY',
 'QA51_E2E_HTML_SHA256','QA51_E2E_UI_SHA256','QA51_E2E_CONFIG_SHA256','QA51_E2E_DB_VERSION','QA51_E2E_EDGE_VERSION'];
const log=(label)=>console.log('QA51-E2E '+label);
if(env.QA51_E2E_APPROVED!=='isolated-adult-fixture-only'||required.some(k=>!env[k])){
 log('N/T: approved isolated target and version pins required');process.exit(2);
}
let browser,context,releaseLogout=()=>{},stage='CONFIG';
const SESSION_KEY='uri-qa48-owner-google-test-session';
function requireOk(value,code){if(!value)throw new Error(code);}
const sha=b=>createHash('sha256').update(b).digest('hex');
const pageURL=new URL(env.QA51_E2E_PAGE_URL), api=new URL(env.QA51_E2E_SUPABASE_URL);
const key=env.QA51_E2E_SUPABASE_PUBLISHABLE_KEY;
const pins=[
 [pageURL.href,env.QA51_E2E_HTML_SHA256],
 [new URL('./scripts/qa48-google-oauth-test.mjs?v=49',pageURL).href,env.QA51_E2E_UI_SHA256],
 [new URL('./scripts/qa47-public-stage-config.mjs',pageURL).href,env.QA51_E2E_CONFIG_SHA256]
];
async function checkPins(){
 for(const [url,pin] of pins){
  requireOk(/^[a-f0-9]{64}$/.test(pin),'PIN_INVALID');
  const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  requireOk(response.ok&&sha(Buffer.from(await response.arrayBuffer()))===pin,'PIN_MISMATCH');
 }
}
function expires(token){
 const parts=token.split('.');
 requireOk(parts.length===3,'JWT_FORMAT');
 return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')).exp;
}
async function rpc(token){
 const response=await fetch(new URL('/rest/v1/rpc/qa47_my_verified_family_ids',api),{
  method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
  headers:{'content-type':'application/json',apikey:key,authorization:'Bearer '+token},body:'{}'});
 let data=null;try{data=await response.json();}catch{}
 return {status:response.status,data}; // Never log data, family IDs, or errors.
}
try{
 requireOk(pageURL.protocol==='https:'&&api.protocol==='https:'&&
  !pageURL.username&&!pageURL.password&&!pageURL.search&&!pageURL.hash&&
  api.pathname==='/'&&!api.username&&!api.password&&!api.search&&!api.hash&&
  key.startsWith('sb_publishable_'),'TARGET_INVALID');
 // DB/Edge pins must be matched to independently reviewed deployment evidence
 // before setting APPROVED. This harness cannot attest server version itself.
 stage='BUILD_PIN';await checkPins();
 stage='BROWSER';
 let chromium;
 try{({chromium}=await import('playwright'));browser=await chromium.launch({headless:false});}
 catch{log('N/T: headed Chromium unavailable');process.exitCode=2;}
 if(browser){
  context=await browser.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});
  const page=await context.newPage();
  stage='MANUAL_LOGIN';
  await page.goto(pageURL.href,{waitUntil:'domcontentloaded'});
  log('Manual login required in the opened browser, adult isolated fixture only.');
  await page.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='success'&&
   !document.querySelector('#verify')?.disabled,undefined,{timeout:300000});
  requireOk(page.url().split(/[?#]/)[0]===pageURL.href,'CALLBACK_MISMATCH');
  await checkPins();
  const old=await page.evaluate(k=>{
   const value=JSON.parse(sessionStorage.getItem(k)||'null');
   return value?.access_token||value?.currentSession?.access_token||null;
  },SESSION_KEY);
  requireOk(typeof old==='string'&&Number.isFinite(expires(old))&&expires(old)>Date.now()/1000+90,'JWT_TOO_SHORT');
  stage='POSITIVE_CONTROL';
  const before=await rpc(old);
  requireOk(before.status===200&&Array.isArray(before.data)&&before.data.length>0,'GUARDIAN_POSITIVE_REQUIRED');
  log('PASS: verified guardian RPC positive control');
  // Hold only provider logout, allowing real ledger commit and direct replay
  // BEFORE provider session deletion can account for denial. Always release.
  let held=false;
  const gate=new Promise(resolve=>{releaseLogout=resolve;});
  await page.route(u=>u.origin===api.origin&&u.pathname==='/auth/v1/logout',async route=>{
   held=true;await gate;await route.continue();
  });
  stage='REVOCATION_ACK';
  const ackWait=page.waitForResponse(res=>{
   const u=new URL(res.url());
   return u.origin===api.origin&&u.pathname==='/functions/v1/qa51-session-revoke'&&res.request().method()==='POST';
  },{timeout:20000});
  await page.locator('#logout:enabled').click();
  const ack=await ackWait;
  requireOk(ack.status()===200&&(await ack.json())?.serverRevocationCommitted===true,'ACK_MISSING');
  requireOk(await page.locator('#verify').isDisabled()&&await page.locator('#google-login').isDisabled(),'UI_NOT_LOCKED');
  await page.waitForTimeout(100);
  requireOk(held,'PROVIDER_LOGOUT_NOT_HELD');
  stage='REPLAY_BEFORE_PROVIDER_LOGOUT';
  requireOk(expires(old)>Date.now()/1000+30,'JWT_EXPIRY_AMBIGUOUS');
  const after=await rpc(old);
  requireOk(expires(old)>Date.now()/1000,'JWT_EXPIRED_DURING_REPLAY');
  requireOk(after.status!==200,'OLD_JWT_ACCEPTED');
  requireOk([401,403].includes(after.status)&&after.data?.code==='42501'&&after.data?.message==='SESSION_DENIED','DENIAL_NOT_LEDGER_PROOF');
  log('PASS: same unexpired JWT denied by ledger before provider logout');
  releaseLogout();
  stage='UI_COMPLETION';
  await page.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='success'&&
   document.querySelector('#status')?.textContent?.includes('서버 로그아웃이 확정'),undefined,{timeout:20000});
  requireOk(await page.evaluate(k=>sessionStorage.getItem(k)===null,SESSION_KEY),'SESSION_NOT_CLEARED');
  log('PASS: confirmed UI logout and session removal');
  log('LIMITED PASS: local logout RPC only. N/T: global, fresh session, other family, direct RLS/writer, Storage/signed URL, server version attestation.');
 }
}catch{
 // Fixed stage only; exception messages, URLs, response bodies and tokens
 // can contain sensitive data and must never reach console or CI artifacts.
 log('FAIL or N/T at '+stage+'; no sensitive details recorded');process.exitCode=1;
}finally{
 releaseLogout();
 if(context)try{await context.close();}catch{}
 if(browser)try{await browser.close();}catch{}
}
