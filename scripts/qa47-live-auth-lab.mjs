// QA47: actually pointed at live Supabase Auth, but ONLY from local owner lab.
// Public GitHub Pages, localhost alias, ordinary QA and student views never run
// real OAuth, email delivery or child-data synchronization.
const OWNER_ORIGIN='http://127.0.0.1:4173';
if(location.origin===OWNER_ORIGIN &&
   new URLSearchParams(location.search).get('qa47')==='1' &&
   document.getElementById('qa34-sync-bridge')){
 const {qa47PublicStage:cfg}=await import('./qa47-public-stage-config.mjs');
 if(cfg.localOrigin!==OWNER_ORIGIN||cfg.allowStudentData!==false||
   cfg.allowProduction!==false||!cfg.publishableKey.startsWith('sb_publishable_'))
  throw Error('QA47_UNSAFE_CONFIG');
 const html=[
  '<section class="card" id="qa47-live-auth" aria-label="실제 Supabase 로그인 로컬 보안 시험">',
  '<h2>🔐 실제 Supabase 이메일 로그인 · 개발자 로컬 시험 (QA47)</h2>',
  '<p class="small">실제 Supabase 무료 서버를 호출합니다. **성인 시험용 계정만** 이용하세요. 실제 아동 데이터·사진·동기화는 차단되어 있습니다.</p>',
  '<p class="small">Google OAuth와 이메일 가입·확인·비밀번호 재설정은 제공자/SMTP 설정 전까지 실행하지 않습니다.</p>',
  '<label for="qa47-live-email">성인 시험 계정 이메일</label>',
  '<input id="qa47-live-email" autocomplete="off" inputmode="email" type="email" placeholder="adult-test@example.invalid">',
  '<label for="qa47-live-password">비밀번호</label>',
  '<input id="qa47-live-password" autocomplete="off" type="password">',
  '<button id="qa47-live-login" type="button" class="secondary">실제 서버 이메일 로그인</button>',
  '<button id="qa47-live-recheck" type="button" class="secondary" disabled>실제 서버 보호자 상태 다시 확인</button>',
  '<button id="qa47-live-logout" type="button" class="secondary" disabled>실제 서버 로그아웃</button>',
  '<button id="qa47-live-google" type="button" class="secondary" disabled>Google OAuth (제공자 미설정)</button>',
  '<p id="qa47-live-guardian" role="status" aria-live="polite">보호자 관계·동의 미확인 · 학생 기록·사진·동기화 불가</p>',
  '<p id="qa47-live-status" role="status" aria-live="polite">실제 Supabase 연결 대기</p>',
  '</section>'
 ].join('');
 document.getElementById('qa34-sync-bridge').insertAdjacentHTML('afterend',html);
 const $=id=>document.getElementById('qa47-live-'+id);
 let client=null,verified=false,busy=false,ownerApprovedCount=0;
 const uuid=s=>typeof s==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
 const state=(message,isError=false)=>{$('status').textContent=message;$('status').dataset.error=String(isError)};
 function resetState(){
  verified=false;ownerApprovedCount=0;
  $('guardian').textContent='보호자 관계·동의 미확인 · 학생 기록·사진·동기화 불가';
 }
 function controls(){
  $('login').disabled=busy||!cfg.realEmailSignInEnabled;
  $('recheck').disabled=busy||!verified;
  $('logout').disabled=busy||!client;
  $('google').disabled=true;
 }
 async function load(){
  if(client)return client;
  let made;
  const f=globalThis.__QA47_LOCAL_TEST_CLIENT_FACTORY__;
  if(typeof f==='function')made=await f(cfg);
  else{
   const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
   made=createClient(cfg.projectUrl,cfg.publishableKey,{auth:{
    persistSession:false,autoRefreshToken:false,detectSessionInUrl:false
   }});
  }
  if(typeof made?.auth?.getUser!=='function'||
   typeof made?.auth?.signInWithPassword!=='function'||
   typeof made?.auth?.signOut!=='function'||
   typeof made?.rpc!=='function'||
   typeof made?.functions?.invoke!=='function')
   throw Error('REAL_SUPABASE_CLIENT_REQUIRED');
  client=made;return client;
 }
 async function refresh(){
  const c=await load();
  const id=await c.auth.getUser();
  if(id.error||!uuid(id.data?.user?.id)||id.data.user.is_anonymous===true)
   throw Error('VERIFIED_AUTH_REQUIRED');
  const families=await c.rpc('qa47_my_verified_family_ids');
  if(families.error||!Array.isArray(families.data)||
   families.data.some(x=>!uuid(x)))throw Error('GUARDIAN_RLS_UNAVAILABLE');
  // Edge itself validates the current JWT with auth.getUser(token) again.
  const edge=await c.functions.invoke(cfg.edgeFunction,{method:'GET'});
  if(edge.error||!edge.data?.authenticated||
   edge.data.studentRecordsEnabled!==false||
   edge.data.syncWritesEnabled!==false||
   edge.data.verifiedFamilyCount!==families.data.length)
   throw Error('AUTH_GATEWAY_UNVERIFIED');
  verified=true;ownerApprovedCount=families.data.length;
  $('guardian').textContent=ownerApprovedCount?
   '실 서버에 외부 승인된 보호자 가족 '+ownerApprovedCount+'곳 확인 · 학생 기록·사진·동기화는 여전히 비활성화':
   '실제 이메일 로그인 확인 · 법정대리인 관계·동의 미검증 · 학생 기록·사진·동기화 불가';
  return ownerApprovedCount;
 }
 async function act(task){
  if(busy)return;busy=true;controls();
  try{await task()}catch{
   resetState();
   if(client)try{await client.auth.signOut({scope:'local'})}catch{}
   state('실제 인증/보호자 상태 확인 실패 또는 사용할 수 없는 계정입니다. 기록·사진은 전송하지 않았습니다.',true);
  }finally{
   $('password').value='';busy=false;controls();
  }
 }
 $('login').addEventListener('click',()=>act(async()=>{
  if(!cfg.realEmailSignInEnabled)throw Error('EMAIL_LOGIN_NOT_READY');
  const email=$('email').value.trim(),password=$('password').value;
  if(email.length>254||!/@/.test(email)||password.length<12)throw Error('INVALID_INPUT');
  const c=await load();
  const result=await c.auth.signInWithPassword({email,password});
  if(result.error)throw Error('EMAIL_LOGIN_REJECTED');
  await refresh();
  state('실제 Supabase Auth 서명된 사용자 확인 및 실서버 보호자 상태 점검 완료. 학생 데이터 전송 없음.');
 }));
 $('recheck').addEventListener('click',()=>act(async()=>{
  await refresh();state('실제 Supabase 보호자 관계·동의 상태 재확인 완료. 학생 데이터는 비활성화입니다.');
 }));
 $('logout').addEventListener('click',()=>act(async()=>{
  if(client){
   const r=await client.auth.signOut({scope:'local'});
   if(r.error)throw Error('SIGNOUT_FAILED');
  }
  resetState();state('실제 Supabase Auth 세션 로그아웃 완료.');
 }));
 resetState();controls();state('실제 Supabase 무료 서버용 성인 시험 로그인 대기. Google/SMTP 구성 전 실제 가입은 차단.');
}
