// QA51 / 00Q-02-AUTH — restricted real-session proof, no saved credentials.
// Run only against separately approved isolated QA51 environment.
// A human logs in in this same ephemeral headed context; sessionStorage is not
// supported by Playwright storageState. No token files, traces or screenshots.
import {createHash} from 'node:crypto';
const env=process.env;
const required=['QA51_E2E_PAGE_URL','QA51_E2E_SUPABASE_URL','QA51_E2E_SUPABASE_PUBLISHABLE_KEY',
 'QA51_E2E_HTML_SHA256','QA51_E2E_UI_SHA256','QA51_E2E_CONFIG_SHA256','QA51_E2E_SDK_SHA256','QA51_E2E_DB_VERSION','QA51_E2E_EDGE_VERSION'];
const log=(label)=>console.log('QA51-E2E '+label);
if(env.QA51_E2E_APPROVED!=='isolated-adult-fixture-only'||required.some(k=>!env[k])){
 log('N/T: approved isolated target and version pins required');process.exit(2);
}
let browser,context,releaseLogout=()=>{},stage='CONFIG';
const SESSION_KEY='uri-qa48-owner-google-test-session';
function requireOk(value,code){if(!value)throw new Error(code);}
const sha=b=>createHash('sha256').update(b).digest('hex');
let pageURL,api,pins;
const verifiedBytes=new Map();
// Google login is interactive; only exact identity-provider origins are
// permitted during the off-app navigation, never from the app document.
const googleOrigins=new Set(['https://accounts.google.com','https://ssl.gstatic.com','https://www.gstatic.com','https://fonts.gstatic.com','https://fonts.googleapis.com','https://lh3.googleusercontent.com']);
const apiPaths=new Map([['/auth/v1/authorize',['GET']],['/auth/v1/callback',['GET','POST']],['/auth/v1/token',['POST']],['/auth/v1/user',['GET']],['/auth/v1/logout',['POST']],['/rest/v1/rpc/qa47_my_verified_family_ids',['POST']],['/functions/v1/qa47-auth-status',['GET']],['/functions/v1/qa51-session-revoke',['POST']]]);
function networkAllowed(u,method,source,navigation,providerPhase){
 if(u.origin===api.origin)return (apiPaths.get(u.pathname)||[]).includes(method)||method==='OPTIONS'&&apiPaths.has(u.pathname);
 if(!providerPhase||!googleOrigins.has(u.origin))return false;
 if(navigation&&u.origin==='https://accounts.google.com'&&source===api.origin)return true;
 return googleOrigins.has(source)&&['GET','POST','OPTIONS'].includes(method);
}
const key=env.QA51_E2E_SUPABASE_PUBLISHABLE_KEY;

async function checkPins(){
 for(const [url,pin] of pins){
  requireOk(/^[a-f0-9]{64}$/.test(pin),'PIN_INVALID');
  const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  const bytes=Buffer.from(await response.arrayBuffer());
  requireOk(response.ok&&sha(bytes)===pin,'PIN_MISMATCH');
  verifiedBytes.set(url,bytes);
 }
}
function claims(token){
 const parts=token.split('.');
 requireOk(parts.length===3,'JWT_FORMAT');
 return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
}
function expires(token){return claims(token).exp;}
async function rpc(token){
 requireOk(claims(token).iss===api.origin+'/auth/v1','JWT_ISSUER_MISMATCH');
 const response=await fetch(new URL('/rest/v1/rpc/qa47_my_verified_family_ids',api),{
  method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
  headers:{'content-type':'application/json',apikey:key,authorization:'Bearer '+token},body:'{}'});
 let data=null;try{data=await response.json();}catch{}
 return {status:response.status,data}; // Never log data, family IDs, or errors.
}
try{
 pageURL=new URL(env.QA51_E2E_PAGE_URL);api=new URL(env.QA51_E2E_SUPABASE_URL);
 pins=[[pageURL.href,env.QA51_E2E_HTML_SHA256],
 [new URL('./scripts/qa48-google-oauth-test.mjs?v=49',pageURL).href,env.QA51_E2E_UI_SHA256],
 [new URL('./scripts/qa47-public-stage-config.mjs',pageURL).href,env.QA51_E2E_CONFIG_SHA256],
 [new URL('./scripts/vendor/qa51-supabase.bundle.mjs',pageURL).href,env.QA51_E2E_SDK_SHA256]];
 requireOk(pageURL.protocol==='https:'&&api.protocol==='https:'&&
  !pageURL.username&&!pageURL.password&&!pageURL.search&&!pageURL.hash&&
  api.pathname==='/'&&!api.username&&!api.password&&!api.search&&!api.hash&&
  key.startsWith('sb_publishable_')&&pageURL.origin!=='https://jinbh99-arch.github.io'&&
  /^[a-z0-9]+\.supabase\.co$/.test(api.hostname),'TARGET_INVALID');
 // DB/Edge pins must be matched to independently reviewed deployment evidence
 // before setting APPROVED. This harness cannot attest server version itself.
 stage='BUILD_PIN';await checkPins();
 // Only import reviewed, hash-pinned configuration bytes; reject nonliteral
 // or executable config before evaluation. No network token has been read.
 const configText=verifiedBytes.get(pins[2][0]).toString('utf8');
 const fields=Object.create(null);
 const stripped=configText.replace(/^\s*\/\/.*$/gm,'').trim();
 const match=/^export const qa47PublicStage=Object\.freeze\(\{([\s\S]*)\}\);$/.exec(stripped);
 requireOk(match,'CONFIG_FORMAT');
 for(const entry of match[1].split(',').map(x=>x.trim()).filter(Boolean)){
  const m=/^([A-Za-z][A-Za-z0-9]*):\s*(?:'([^'\\]*)'|"([^"\\]*)"|(true|false|null))$/.exec(entry);
  requireOk(m&&!Object.hasOwn(fields,m[1]),'CONFIG_FIELD');
  fields[m[1]]=m[2]??m[3]??m[4];
 }
 requireOk(fields.projectUrl===api.origin&&fields.publishableKey===key&&
  fields.qa51IsolatedCallback===pageURL.href&&fields.allowStudentData==='false'&&fields.allowProduction==='false','APP_TARGET_MISMATCH');
 const html=verifiedBytes.get(pageURL.href).toString('utf8');
 const csp="default-src 'none'; script-src 'self'; connect-src "+api.origin+"; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; upgrade-insecure-requests";
 requireOk(html.includes('http-equiv="Content-Security-Policy" content="'+csp+'"'),'ISOLATED_CSP_MISMATCH');
 stage='BROWSER';
 let chromium;
 try{({chromium}=await import('playwright'));browser=await chromium.launch({headless:false});}
 catch{log('N/T: headed Chromium unavailable');process.exitCode=2;}
 if(browser){
  context=await browser.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});
  // Verify the actual browser responses before allowing execution; retain
  // original response headers (including CSP) and reject redirects.
  // Block unexpected same-origin scripts/documents.
  const loaded=new Set();let providerPhase=true;
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.origin!==pageURL.origin){
    let source='';try{source=new URL(request.frame().url()).origin;}catch{}
    // The provider redirect may retain the initiating app frame URL; permit
    // only its top-level accounts.google.com navigation, without bearer headers.
    if(providerPhase&&request.isNavigationRequest()&&u.origin==='https://accounts.google.com'&&request.redirectedFrom()){
     const prev=new URL(request.redirectedFrom().url());
     if(prev.origin===api.origin&&prev.pathname==='/auth/v1/authorize'&&!(await request.allHeaders()).authorization)return route.continue();
    }
    return networkAllowed(u,request.method(),source,request.isNavigationRequest(),providerPhase)?route.continue():route.abort('blockedbyclient');
   }
   const normalized=u.href.split('#')[0];
   const asset=u.pathname===pageURL.pathname&&request.isNavigationRequest()?pageURL.href:normalized;
   const bytes=verifiedBytes.get(asset);
   if(bytes){
    try{
     const response=await route.fetch({maxRedirects:0,timeout:15000});
     const actual=await response.body();
     if(response.status()!==200||sha(actual)!==sha(bytes))return route.abort('blockedbyclient');
     loaded.add(asset);return route.fulfill({response,body:actual});
    }catch{return route.abort('blockedbyclient');}
   }
   return route.abort('blockedbyclient');
  });
  const page=await context.newPage();
  stage='MANUAL_LOGIN';
  await page.goto(pageURL.href,{waitUntil:'domcontentloaded'});
  log('Manual login required in the opened browser, adult isolated fixture only.');
  await page.waitForFunction(()=>document.querySelector('#status')?.dataset.state==='success'&&
   !document.querySelector('#verify')?.disabled,undefined,{timeout:300000});
  requireOk(page.url().split(/[?#]/)[0]===pageURL.href,'CALLBACK_MISMATCH');
  providerPhase=false;
  requireOk(pins.every(([url])=>loaded.has(url)),'BROWSER_ASSETS_NOT_VERIFIED');
  await checkPins();
  const old=await page.evaluate(k=>{
   const value=JSON.parse(sessionStorage.getItem(k)||'null');
   return value?.access_token||value?.currentSession?.access_token||null;
  },SESSION_KEY);
  requireOk(typeof old==='string'&&claims(old).iss===api.origin+'/auth/v1'&&Number.isFinite(expires(old))&&expires(old)>Date.now()/1000+90,'JWT_TOO_SHORT');
  stage='POSITIVE_CONTROL';
  const before=await rpc(old);
  requireOk(before.status===200&&Array.isArray(before.data)&&before.data.length>0,'GUARDIAN_POSITIVE_REQUIRED');
  log('PASS: verified guardian RPC positive control');
  // Hold only provider logout, allowing real ledger commit and direct replay
  // BEFORE provider session deletion can account for denial. Always release.
  let signalHeld;
  const providerHeld=new Promise(resolve=>{signalHeld=resolve;});
  const gate=new Promise(resolve=>{releaseLogout=resolve;});
  await page.route(u=>u.origin===api.origin&&u.pathname==='/auth/v1/logout',async route=>{
   signalHeld(true);await gate;await route.continue();
  });
  stage='REVOCATION_ACK';
  const ackWait=page.waitForResponse(res=>{
   const u=new URL(res.url());
   return u.origin===api.origin&&u.pathname==='/functions/v1/qa51-session-revoke'&&res.request().method()==='POST';
  },{timeout:20000});
  await page.locator('#logout:enabled').click();
  const ack=await ackWait;
  requireOk((await ack.request().allHeaders()).authorization==='Bearer '+old,'ACK_TOKEN_MISMATCH');
  requireOk(ack.status()===200&&(await ack.json())?.serverRevocationCommitted===true,'ACK_MISSING');
  requireOk(await page.locator('#verify').isDisabled()&&await page.locator('#google-login').isDisabled(),'UI_NOT_LOCKED');
  let holdTimer;
  const held=await Promise.race([providerHeld,new Promise(resolve=>{holdTimer=setTimeout(()=>resolve(false),5000);})]);
  clearTimeout(holdTimer);requireOk(held,'PROVIDER_LOGOUT_NOT_HELD');
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
