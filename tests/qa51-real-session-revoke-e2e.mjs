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
const googleStatic=new Set([...googleOrigins].filter(x=>x!=='https://accounts.google.com'));
const apiMethods=new Map([['/auth/v1/token','POST'],['/auth/v1/user','GET'],['/auth/v1/logout','POST'],['/rest/v1/rpc/qa47_my_verified_family_ids','POST'],['/functions/v1/qa47-auth-status','GET'],['/functions/v1/qa51-session-revoke','POST']]);
function onlyQuery(u,allowed){
 const keys=[...u.searchParams.keys()];
 return keys.every(k=>allowed.includes(k))&&new Set(keys).size===keys.length;
}
function appBearer(headers){
 const auth=headers.authorization||'';
 if(!auth.startsWith('Bearer '))return false;
 try{return claims(auth.slice(7)).iss===api.origin+'/auth/v1';}catch{return false;}
}
// Outbound guard only: issuer inspection is NOT authentication. Server still
// validates signatures/expiry/session. Deny unknown initiator/phase/query.
function networkAllowed(u,method,source,navigation,phase,headers={},previous=null){
 if(u.protocol!=='https:'||u.username||u.password||u.hash)return false;
 const credential=!!(headers.authorization||headers.apikey);
 const app=source===pageURL.origin;
 if(u.origin===api.origin){
  if(u.pathname==='/auth/v1/authorize'){
   return phase==='login'&&app&&navigation&&method==='GET'&&!credential&&
    onlyQuery(u,['provider','redirect_to','scopes','code_challenge','code_challenge_method','prompt','skip_http_redirect'])&&
    u.searchParams.get('provider')==='google'&&u.searchParams.get('redirect_to')===pageURL.href&&
    u.searchParams.get('code_challenge_method')==='s256'&&
    /^[A-Za-z0-9_-]{43,128}$/.test(u.searchParams.get('code_challenge')||'')&&
    u.searchParams.get('scopes')==='openid email profile'&&u.searchParams.get('prompt')==='select_account'&&
    !u.searchParams.has('skip_http_redirect');
  }
  if(u.pathname==='/auth/v1/callback'){
   return phase==='provider'&&source==='https://accounts.google.com'&&navigation&&method==='GET'&&!credential&&
    onlyQuery(u,['code','state','scope','authuser','prompt','hd','error','error_description','error_uri'])&&
    !!u.searchParams.get('state')&&!!(u.searchParams.get('code')||u.searchParams.get('error'));
  }
  if(!app||navigation||!apiMethods.has(u.pathname))return false;
  if(u.pathname==='/auth/v1/token'){
   if(phase!=='callback'||!onlyQuery(u,['grant_type'])||u.searchParams.get('grant_type')!=='pkce')return false;
  }else if(u.pathname==='/auth/v1/logout'){
   if(phase!=='verified'||!onlyQuery(u,['scope'])||u.searchParams.get('scope')!=='local')return false;
  }else if(u.pathname==='/functions/v1/qa51-session-revoke'){
   if(phase!=='verified'||u.search)return false;
  }else if(!['callback','verified'].includes(phase)||u.search)return false;
  if(method==='OPTIONS')return !credential&&headers.origin===pageURL.origin&&
   headers['access-control-request-method']===apiMethods.get(u.pathname);
  if(method!==apiMethods.get(u.pathname)||headers.apikey!==key)return false;
  return u.pathname==='/auth/v1/token'?(!headers.authorization||headers.authorization==='Bearer '+key):appBearer(headers);
 }
 if(credential||phase!=='provider'||!googleOrigins.has(u.origin))return false;
 if(u.origin==='https://accounts.google.com'){
  if(navigation&&method==='GET'&&previous?.origin===api.origin&&previous.pathname==='/auth/v1/authorize')return true;
  return source==='https://accounts.google.com'&&['GET','POST'].includes(method);
 }
 return googleStatic.has(u.origin)&&source==='https://accounts.google.com'&&!navigation&&method==='GET';
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
  const loaded=new Set();let phase='login';
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());
   let source='',previous=null;
   try{source=new URL(request.frame().url()).origin;}catch{}
   try{if(request.redirectedFrom())previous=new URL(request.redirectedFrom().url());}catch{}
   const headers=await request.allHeaders();
   const navigation=request.isNavigationRequest();
   if(u.origin!==pageURL.origin){
    if(!networkAllowed(u,request.method(),source,navigation,phase,headers,previous))return route.abort('blockedbyclient');
    if(u.origin===api.origin&&u.pathname==='/auth/v1/authorize')phase='provider';
    return route.continue();
   }
   // Exact OAuth callback only; reject arbitrary query, cross-frame
   // navigation and credential-bearing requests to static app assets.
   if(headers.authorization||headers.apikey||request.method()!=='GET')return route.abort('blockedbyclient');
   if(navigation&&u.pathname===pageURL.pathname){
    if(u.search){
     if(phase!=='provider'||previous?.origin!==api.origin||previous.pathname!=='/auth/v1/callback'||
      !onlyQuery(u,['code','error','error_code','error_description'])||!(u.searchParams.get('code')||u.searchParams.get('error')))return route.abort('blockedbyclient');
     phase='callback';
    }else if(phase!=='login'&&source!==pageURL.origin)return route.abort('blockedbyclient');
   }else if(source!==pageURL.origin)return route.abort('blockedbyclient');
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
  requireOk(phase==='callback','CALLBACK_PHASE_NOT_PROVEN');
  phase='verified';
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
   const request=route.request(),u=new URL(request.url());
   let source='';try{source=new URL(request.frame().url()).origin;}catch{}
   if(!networkAllowed(u,request.method(),source,request.isNavigationRequest(),phase,await request.allHeaders()))return route.abort('blockedbyclient');
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
