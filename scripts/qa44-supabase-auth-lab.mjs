// QA44 G15 actual app Settings: provider SDK integration preview, SYNTHETIC.
// Never load or initialize a real Supabase project from a public QA page.
// Real Auth SDK must be wired only after owner/provider/legal approvals.
import {createQa44StagingAuthAdapter} from './qa44-supabase-auth-adapter.mjs';
const ROOT='http://127.0.0.1:4173';
if(location.origin===ROOT&&document.getElementById('qa34-sync-bridge')){
 const html=[
 '<section class="card" id="qa44-auth-lab" aria-label="무료 로그인 로컬 시험">',
 '<h2>🧪 Supabase 구글·이메일 로그인 연동 사전시험 (QA44)</h2>',
 '<p class="small">개발용 합성 공급자만 사용합니다. 실제 로그인/이메일 발송/아동 데이터 업로드는 연결하지 않았습니다.</p>',
 '<label for="qa44-email">시험용 이메일 (실계정 사용 금지)</label>',
 '<input id="qa44-email" type="email" autocomplete="off" placeholder="parent@synthetic.invalid"/>',
 '<label for="qa44-password">가상 비밀번호 (12자 이상)</label>',
 '<input id="qa44-password" type="password" autocomplete="off"/>',
 '<button id="qa44-google" type="button" class="secondary" disabled>구글 로그인 흐름 검사</button>',
 '<button id="qa44-register" type="button" class="secondary" disabled>이메일 가입·확인 메일 흐름 검사</button>',
 '<button id="qa44-login" type="button" class="secondary" disabled>이메일 로그인 흐름 검사</button>',
 '<button id="qa44-reset" type="button" class="secondary" disabled>비밀번호 재설정 메일 흐름 검사</button>',
 '<button id="qa44-recheck" type="button" class="secondary" disabled>보호자 승인·동의 재확인</button>',
 '<button id="qa44-logout" type="button" class="secondary" disabled>합성 로그인 종료</button>',
 '<p id="qa44-guardian-status" class="small" aria-live="polite">실제 보호자 검증 없음 · 기록 열람·업로드 금지</p>',
 '<p id="qa44-status" role="status" aria-live="polite">합성 인증 공급자 연결 대기</p>',
 '</section>'
 ].join('');
 document.getElementById('qa34-sync-bridge').insertAdjacentHTML('afterend',html);
 const $=id=>document.getElementById(id);
 const buttons=['google','register','login','reset','recheck','logout'];
 let auth=null,busy=false;
 const provider=globalThis.__QA44_SYNTHETIC_CLIENT__;
 if(provider){
  try{auth=createQa44StagingAuthAdapter(provider,{
   mode:'SYNTHETIC_STAGE_ONLY',origin:ROOT,
   redirectUrl:ROOT+'/check.html',recoveryUrl:ROOT+'/check.html',
   allowRealChildren:false,isProduction:false
  })}catch{auth=null}
 }
 function state(text,error=false){
  $('qa44-status').textContent=text;
  $('qa44-status').dataset.error=String(error);
 }
 function statusOfGuardian(v){
  $('qa44-guardian-status').textContent=(v?.canAccessChildren===true
   ?'합성 DB에서 보호자·동의 승인된 가족 '+v.families.length+'곳 확인 (실서비스 승인 아님)'
   :'보호자 관계·동의 확인되지 않음 · 기록 열람·업로드 금지');
 }
 function controls(){
  for(const suffix of buttons)$('qa44-'+suffix).disabled=!auth||busy;
 }
 async function act(callback){
  if(!auth||busy)return;
  busy=true;controls();
  try{await callback()}catch{
   statusOfGuardian(null);
   state('시험 인증 요청 거부 또는 유효하지 않은 세션입니다. 실제 오답은 변경하지 않았습니다.',true);
  }finally{
   $('qa44-password').value='';
   busy=false;controls();
  }
 }
 $('qa44-google').addEventListener('click',()=>act(async()=>{
  const flow=await auth.google();
  if(!flow.requiresBrowserNavigation)throw Error('INVALID_GOOGLE_TEST');
  statusOfGuardian(null);
  state('가상 구글 OAuth 주소 생성 검사 완료. 실제 Google로 이동하거나 로그인하지 않았습니다.');
 }));
 $('qa44-register').addEventListener('click',()=>act(async()=>{
  const flow=await auth.register($('qa44-email').value,$('qa44-password').value);
  if(!flow.confirmationRequired)throw Error('INVALID_SIGNUP_TEST');
  statusOfGuardian(null);
  state('가상 가입·이메일 인증 요청 검사 완료. 실제 메일 발송 없음. 보호자 권한 미부여.');
 }));
 $('qa44-login').addEventListener('click',()=>act(async()=>{
  const r=await auth.passwordSignIn($('qa44-email').value,$('qa44-password').value);
  statusOfGuardian(r);
  state(r.canAccessChildren
   ?'가상 이메일 로그인 및 외부 승인된 보호자 확인 테스트 성공. 실제 서비스는 아님.'
   :'가상 이메일 로그인 성공. 법정대리인 확인·동의 전까지 오답 접근 불가.');
 }));
 $('qa44-reset').addEventListener('click',()=>act(async()=>{
  await auth.recovery($('qa44-email').value);
  state('가상 재설정 요청 테스트 완료. 실제 메일 발송 없음. 계정 존재는 공개하지 않습니다.');
 }));
 $('qa44-recheck').addEventListener('click',()=>act(async()=>{
  const r=await auth.refreshServerVerifiedIdentity();
  statusOfGuardian(r);
  state('가상 서버에서 가족 권한·동의·철회 상태 재확인 완료.');
 }));
 $('qa44-logout').addEventListener('click',()=>act(async()=>{
  await auth.logout();statusOfGuardian(null);
  state('가상 세션 종료. 오답 및 사진 저장소는 변경하지 않았습니다.');
 }));
 controls();
 state(auth?'합성 인증 모의 공급자 연결. 실제 이메일·구글 로그인은 실행하지 않습니다.'
  :'미연결. 외부 계정 승인 전까지 로그인·메일 발송 버튼 비활성화.');
}
