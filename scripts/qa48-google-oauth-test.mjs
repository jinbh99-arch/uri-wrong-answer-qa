// QA48 · actual Google OAuth/PKCE test against the user's real Supabase project.
// Public GitHub Pages QA test route only; NEVER used for production or child records.
import {qa47PublicStage as cfg} from './qa47-public-stage-config.mjs';
const callback='https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html';
const exactPublicTest=location.href.split(/[?#]/,1)[0]===callback;
const isInjectedCi=location.origin==='http://127.0.0.1:4173' &&
  location.pathname==='/oauth-test.html' &&
  typeof globalThis.__QA48_TEST_CLIENT_FACTORY__==='function';
const allowed=exactPublicTest||isInjectedCi;
const $=id=>document.getElementById(id);
const login=$('google-login'),check=$('verify'),logout=$('logout'),status=$('status');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const callbackKeys=['code','state','error','error_description','access_token','refresh_token','token_type'];
const callbackHasParams=callbackKeys.some(k=>new URL(location.href).searchParams.has(k));
let client=null,busy=false,active=false;
function say(message,state='neutral'){
 status.textContent=message;
 status.dataset.state=state;
}
function controls(){
 login.disabled=!allowed||busy||active;
 check.disabled=!allowed||busy||!active;
 logout.disabled=!allowed||busy||!active;
}
function stripCallbackUrl(){
 if(!callbackHasParams)return;
 // Supabase SDK must initialize and exchange the PKCE code FIRST.
 history.replaceState({},'',location.pathname);
}
async function supabaseClient(){
 if(client)return client;
 if(!allowed||!cfg.projectUrl.endsWith('.supabase.co')||
  !cfg.publishableKey.startsWith('sb_publishable_')||
  cfg.allowStudentData!==false||cfg.allowProduction!==false)
  throw Error('QA48_STAGE_NOT_ALLOWED');
 const factory=isInjectedCi?globalThis.__QA48_TEST_CLIENT_FACTORY__:null;
 const create=typeof factory==='function'
   ?factory
   :(await import('https://esm.sh/@supabase/supabase-js@2')).createClient;
 const candidate=await create(cfg.projectUrl,cfg.publishableKey,{
  auth:{
   flowType:'pkce',
   detectSessionInUrl:true,
   persistSession:true,
   autoRefreshToken:false,
   storageKey:'uri-qa48-owner-google-test-session',
   storage:window.sessionStorage
  }
 });
 if(!candidate?.auth||typeof candidate.auth.signInWithOAuth!=='function'||
  typeof candidate.auth.getSession!=='function'||
  typeof candidate.auth.getUser!=='function'||
  typeof candidate.auth.signOut!=='function'||
  typeof candidate.rpc!=='function'||
  typeof candidate.functions?.invoke!=='function')
   throw Error('INVALID_AUTH_CLIENT');
 client=candidate;return client;
}
async function verify(){
 const c=await supabaseClient();
 const session=await c.auth.getSession();
 // The session is ONLY a bearer token; server-side auth.getUser and RLS
 // determine identity and authorization. Never trust session.user alone.
 if(session.error)throw Error('SESSION_EXCHANGE_FAILED');
 if(!session.data?.session?.access_token) {
  active=false; controls();
  say(callbackHasParams
   ?'Google 로그인 결과를 확인하지 못했습니다. Supabase의 Redirect URL을 확인해 주세요.'
   :'Google 로그인 버튼을 누르면 본인 계정 확인 화면으로 이동합니다.');
  return false;
 }
 const user=await c.auth.getUser();
 if(user.error||!UUID.test(String(user.data?.user?.id||''))||
  user.data.user.is_anonymous===true)throw Error('ACTUAL_USER_NOT_VERIFIED');
 const family=await c.rpc('qa47_my_verified_family_ids');
 if(family.error||!Array.isArray(family.data)||
    family.data.some(x=>typeof x!=='string'||!UUID.test(x)))throw Error('FAMILY_RLS_UNVERIFIED');
 const edge=await c.functions.invoke('qa47-auth-status',{method:'GET'});
 if(edge.error||edge.data?.authenticated!==true||
    edge.data?.studentRecordsEnabled!==false||
    edge.data?.uploadsEnabled!==false||
    edge.data?.syncWritesEnabled!==false||
    edge.data?.productionApproved!==false||
    edge.data?.verifiedFamilyCount!==family.data.length)
    throw Error('EDGE_JWT_UNVERIFIED');
 active=true;controls();
 say(family.data.length===0
  ?'실제 Google 계정 로그인 확인 성공! 별도 보호자 검증은 아직 없으므로 자녀 기록과 사진 접근은 차단되어 있습니다.'
  :'실제 Google 로그인 및 외부 보호자 검증 정보 확인 완료. 이 화면에서는 자녀 기록과 사진을 열거나 저장하지 않습니다.','success');
 return true;
}
async function safely(task){
 if(busy)return;
 busy=true;controls();
 try{await task()}
 catch{
  active=false;
  if(client)try{await client.auth.signOut()}catch{}
  say('연결 확인에 실패했습니다. 개인 정보나 비밀키를 보내지 마세요. Google 테스트 사용자·Supabase Redirect URL·설정을 확인해 주세요.','error');
 }finally{
  busy=false;stripCallbackUrl();controls();
 }
}
login.addEventListener('click',()=>safely(async()=>{
 const c=await supabaseClient();
 // redirectTo MUST match one exact Supabase Auth allowed redirect URI.
 const started=await c.auth.signInWithOAuth({
  provider:'google',options:{
   redirectTo:callback,
   scopes:'openid email profile',
   queryParams:{prompt:'select_account'}
  }
 });
 if(started.error)throw Error('GOOGLE_OAUTH_START_FAILED');
 // Supabase SDK normally moves the browser to Google automatically.
 say('Google 계정 선택 화면으로 이동합니다.');
}));
check.addEventListener('click',()=>safely(verify));
logout.addEventListener('click',()=>safely(async()=>{
 const c=await supabaseClient();
 const result=await c.auth.signOut();
 if(result.error)throw Error('SIGNOUT_FAILED');
 active=false;
 say('로그아웃했습니다. 이 탭의 시험용 로그인 세션을 종료했습니다.','success');
}));
controls();
if(!allowed){
 say('이 로그인 시험은 격리된 공식 QA 시험 주소에서만 실행할 수 있습니다.','error');
}else{
 safely(verify);
}
