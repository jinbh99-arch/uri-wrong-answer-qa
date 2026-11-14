// QA34 G15 — real app settings -> synthetic local family gateway.
// This is NOT deployed family auth/cloud sync. No automatic upload/restore.
// Strictly gated to 127.0.0.1:4173. Never use actual child records.
const LOCAL_ORIGIN='http://127.0.0.1:4173';
const root=document.getElementById('qa34-sync-bridge');
if(root&&location.origin===LOCAL_ORIGIN){
 root.hidden=false;
 const $=id=>document.getElementById(id);
 let token='',revision=null,server='',busy=false,operationGeneration=0;
 let checkingForeground=false;
 // QA-only accidental cross-family exposure guard. A local UI cover is NOT
 // security authentication; every IndexedDB byte is preserved on logout.
 const BOUND_KEY='qa34-synthetic-local-family-v1';
 // A family label alone is NOT unique: separate loopback QA gateways can
 // independently register the same synthetic family name.
 const SERVER_KEY='qa34-synthetic-local-gateway-v1';
 const INSTANCE_KEY='qa34-synthetic-local-gateway-instance-v1';
 const REVOKE_KEY='qa34-synthetic-local-session-revoke-v1';
 let cover=null,activeFamily='';
 const boundFamily=()=>localStorage.getItem(BOUND_KEY)||'';
 const boundServer=()=>localStorage.getItem(SERVER_KEY)||'';
 const boundInstance=()=>localStorage.getItem(INSTANCE_KEY)||'';
 function lockLocalView(){
  // A suspended request cannot hold the re-login form hostage after logout.
  operationGeneration++;busy=false;state();
  if(!cover){
   cover=document.createElement('section');
   cover.id='qa34-family-privacy-cover';
   cover.setAttribute('role','dialog');
   cover.setAttribute('aria-modal','true');
   cover.setAttribute('aria-label','가상 가족 기록 화면 잠금');
   cover.style.cssText='position:fixed;inset:0;z-index:2147483646;background:#fff;color:#183365;overflow:auto;padding:24px;display:grid;place-content:center;gap:12px';
   cover.innerHTML='<h2>가상 가족 기록 화면 가림</h2>'+
    '<p>로그아웃 후 이 브라우저에 오답·사진·부모 관찰이 그대로 남아 있습니다. 같은 가상 가족으로만 다시 연결할 수 있습니다. 다른 가족은 별도 브라우저 프로필을 사용하세요.</p>'+
    '<p>이 화면 가림은 서버 인증·암호화가 아니며 실제 가족 정보 보호 수단이 아닙니다.</p>'+
    '<button id="qa34-foreground-retry" type="button" hidden>시험 서버 상태 다시 확인</button>'+
    '<form id="qa34-family-reenter" style="display:grid;gap:10px">'+
    '<label>시험 서버 포트<input id="qa34-reenter-port" type="number" min="1024" max="65535" required/></label>'+
    '<label>가상 가족 ID<input id="qa34-reenter-family" type="text" autocomplete="off" required/></label>'+
    '<label>가상 비밀번호<input id="qa34-reenter-password" type="password" autocomplete="off" required/></label>'+
    '<button type="submit">같은 가상 가족으로 화면 다시 열기</button></form>'+
    '<p id="qa34-reenter-status" role="alert"></p>';
   cover.querySelector('#qa34-foreground-retry').addEventListener('click',()=>checkForegroundSession(true));
   cover.querySelector('form').addEventListener('submit',event=>{
    event.preventDefault();
    if(busy)return;
    const port=cover.querySelector('#qa34-reenter-port').value;
    const family=cover.querySelector('#qa34-reenter-family').value.trim();
    const password=cover.querySelector('#qa34-reenter-password').value;
    $('qa34-port').value=port;$('qa34-family').value=family;
    perform(()=>loginFamily(family,password));
   });
  }
  if(!cover.isConnected)document.body.append(cover);
  const main=document.getElementById('qa-main');
  if(main)main.inert=true;
  const header=document.querySelector('header');
  if(header)header.inert=true;
  const retry=cover.querySelector('#qa34-foreground-retry');
  retry.hidden=!token;
  retry.disabled=checkingForeground;
  cover.querySelector('#qa34-reenter-family').value=boundFamily();
  cover.querySelector('#qa34-reenter-password').value='';
  cover.querySelector('#qa34-reenter-family').focus();
  // Signal the actual app to withdraw any previously granted UI consent.
  document.dispatchEvent(new Event('qa34:family-locked'));
 }
 function unlockLocalView(){
  if(cover?.isConnected)cover.remove();
  const main=document.getElementById('qa-main');if(main)main.inert=false;
  const header=document.querySelector('header');if(header)header.inert=false;
 }
 // Storage signals are QA-only presentation locks, NEVER real authentication.
 // A tab opened before the family was bound must not keep showing local photos.
 // A logout or rejected session revokes the visual access of ALL same-origin tabs.
 function broadcastLock(){
  try{localStorage.setItem(REVOKE_KEY,String(Date.now())+':'+Math.random())}catch{}
 }
 window.addEventListener('storage',event=>{
  if(event.storageArea!==localStorage)return;
  if(event.key===REVOKE_KEY){
   clearSession();lockLocalView();
  }else if(event.key===BOUND_KEY&&event.newValue&&event.newValue!==activeFamily){
   clearSession();lockLocalView();
  }else if(event.key===SERVER_KEY&&event.newValue&&activeFamily&&event.newValue!==server){
   clearSession();lockLocalView();
  }
 });
 function status(message,error=false){
  $('qa34-status').textContent=message;
  $('qa34-status').setAttribute('data-error',String(error));
  if(cover?.isConnected)cover.querySelector('#qa34-reenter-status').textContent=message;
 }
 function state(){
  $('qa34-login').disabled=busy;
  $('qa34-logout').disabled=busy||!token;
  $('qa34-upload').disabled=busy||!token||revision===null;
  $('qa34-pull').disabled=busy||!token;
 }
 function clearSession(){
  token='';server='';revision=null;activeFamily='';
  $('qa34-password').value='';
  if(cover)cover.querySelector('#qa34-reenter-password').value='';
  $('qa34-revision').textContent='로그아웃됨 · 서버 개정번호 미확인';
  if(cover?.isConnected)cover.querySelector('#qa34-foreground-retry').hidden=true;
  state();
 }
 function address(){
  const raw=String($('qa34-port').value);
  const port=Number(raw);
  if(!/^\d{4,5}$/.test(raw)||!Number.isInteger(port)||port<1024||port>65535)
   throw Error('로컬 서버 포트 번호(1024~65535)를 입력하세요.');
  const base='http://127.0.0.1:'+port;
  if(token&&server!==base)throw Error('서버를 바꾸려면 기존 가상 가족에서 먼저 로그아웃하세요.');
  return base;
 }
 async function request(path,method='GET',body,ifMatch){
  const base=address(),requestToken=token,requestFamily=activeFamily,
   requestRevoke=localStorage.getItem(REVOKE_KEY)||'',headers={};
  if(requestToken)headers.Authorization='Bearer '+requestToken;
  if(body!==undefined)headers['Content-Type']='application/json';
  if(ifMatch!==undefined&&ifMatch!==null)headers['If-Match']='"'+ifMatch+'"';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
   const response=await fetch(base+path,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),
    mode:'cors',cache:'no-store',signal:controller.signal
   });
   const result=await response.json();
   // A late 401 *or success* from an older synthetic family session is not
   // allowed to act on the next session, even if the browser delivered it.
   // Reject before the 401 lock path or any caller sees a stale snapshot.
   if(requestToken&&
      (token!==requestToken||activeFamily!==requestFamily||
       (localStorage.getItem(REVOKE_KEY)||'')!==requestRevoke))
    throw Error('이전 가족 세션의 늦은 응답을 폐기했습니다. 현재 연결은 유지됩니다.');
   if(!response.ok){
    // A revoked/expired gateway session must not appear active in the app.
    // Clear only ephemeral local credentials; never touch IndexedDB.
    if(response.status===401&&requestToken&&token===requestToken&&
       activeFamily===requestFamily&&
       (localStorage.getItem(REVOKE_KEY)||'')===requestRevoke){
     clearSession();lockLocalView();broadcastLock();
    }
    throw Error('서버 응답 '+response.status+': '+String(result?.error||'요청 실패').slice(0,55));
   }
   return result;
  }catch(error){
   // QA37: a lost PUT response does NOT prove the remote write failed.
   // Never retry a non-idempotent upload automatically after a network loss.
   if(error?.name==='AbortError'||error instanceof TypeError){
    throw Error(method==='PUT'
     ? '전송 결과를 확인할 수 없습니다. 자동 재전송하지 않습니다. 연결 복구 뒤 서버 최신본을 먼저 확인하세요.'
     : '가상 서버 연결을 확인할 수 없습니다. 로컬 기록은 그대로 유지됩니다. 연결 복구 후 수동으로 다시 시도하세요.');
   }
   throw error;
  }finally{clearTimeout(timer)}
 }
 async function perform(action){
  if(busy)return;
  busy=true;state();
  const thisOperation=++operationGeneration;
  const startedToken=token,startedFamily=activeFamily,
   startedRevoke=localStorage.getItem(REVOKE_KEY)||'';
  const sameSession=()=>token===startedToken&&activeFamily===startedFamily&&
   (localStorage.getItem(REVOKE_KEY)||'')===startedRevoke;
  try{await action()}
  catch(error){
   if(thisOperation===operationGeneration&&sameSession())status('중단: '+String(error?.message||error).slice(0,180)+
    ' · 원본 기록을 자동 삭제하거나 복원하지 않았습니다.',true);
  }finally{if(thisOperation===operationGeneration){busy=false;state()}}
 }
 // Capture the active synthetic identity when starting a multi-await workflow.
 // A sibling tab can revoke its UI session while this tab awaits an HTTP reply.
 function activeEpoch(){
  const expectedToken=token,expectedFamily=activeFamily,
   expectedRevoke=localStorage.getItem(REVOKE_KEY)||'';
  return ()=>{
   if(!expectedToken||token!==expectedToken||activeFamily!==expectedFamily||
      (localStorage.getItem(REVOKE_KEY)||'')!==expectedRevoke)
    throw Error('다른 탭의 가족 로그아웃 이후 도착한 응답을 폐기했습니다. 다시 로그인해 직접 확인하세요.');
  };
 }
 // A remote synthetic account can be deleted while this tab is still open.
 // On focus/foreground, conceal retained photos and observations BEFORE the
 // live session check, including while a server response is delayed.
 // Never treat an offline failure as proof of revocation or reopen on timeout.
 function checkForegroundSession(allowCovered=false){
  if(!token||checkingForeground||document.hidden||(!allowCovered&&cover?.isConnected))return;
  const expectedToken=token,expectedFamily=activeFamily,
   expectedServer=server,expectedRevoke=localStorage.getItem(REVOKE_KEY)||'';
  checkingForeground=true;
  lockLocalView();
  status('가상 서버 세션을 다시 확인하는 중입니다. 확인 전까지 사진·오답·관찰을 가립니다.');
  request('/qa/snapshot').then(loaded=>{
   if(token!==expectedToken||activeFamily!==expectedFamily||server!==expectedServer||
      (localStorage.getItem(REVOKE_KEY)||'')!==expectedRevoke||!cover?.isConnected)return;
   if(boundFamily()!==expectedFamily||boundServer()!==expectedServer){
    clearSession();lockLocalView();
    status('브라우저의 가상 가족 귀속 표시가 달라 화면을 계속 잠급니다.',true);
    return;
   }
   setRevision(loaded.revision,loaded.snapshot);
   unlockLocalView();
   status('가상 서버에서 기존 세션을 다시 확인했습니다. 자동 복원·업로드는 하지 않았습니다.');
  }).catch(error=>{
   // request() already clears/revokes on HTTP 401. For network failure,
   // preserve the current token and data but offer an explicit retry.
   if(cover?.isConnected&&(token===expectedToken||!token))
    status('서버 재확인 실패: '+String(error?.message||error).slice(0,110)+
      ' · 가림 유지. 연결 복구 후 화면의 서버 확인 버튼이나 재로그인을 사용하세요.',true);
  }).finally(()=>{
   checkingForeground=false;
   if(cover?.isConnected){
    const retry=cover.querySelector('#qa34-foreground-retry');
    retry.hidden=!token;retry.disabled=false;
   }
   state();
  });
 }
 window.addEventListener('focus',()=>checkForegroundSession());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkForegroundSession()});
 function setRevision(value,snapshot){
  revision=value;
  $('qa34-revision').textContent='서버 개정번호 '+value+' · 저장된 합성 오답 '+
   (snapshot?.records?.length??0)+'건 · 사진 '+Object.keys(snapshot?.photos||{}).length+'장';
 }
 function validatedAppBackup(){
  return new Promise((resolve,reject)=>{
   const button=$('export-json');
   if(!button||button.disabled)return reject(Error('백업 생성 버튼이 아직 준비되지 않았습니다.'));
   let timer;
   function cleanup(){
    clearTimeout(timer);
    document.removeEventListener('qa34:validated-synthetic-export',onBackup);
    document.removeEventListener('qa34:family-locked',onLocked);
   }
   function onLocked(){
    cleanup();reject(Error('다른 탭에서 가족 세션이 종료되어 대기 중인 백업 동의를 취소했습니다.'));
   }
   function onBackup(event){
    cleanup();resolve(event.detail);
   }
   timer=setTimeout(()=>{
    cleanup();reject(Error('기존 오답노트 백업 검증 완료 신호를 받지 못했습니다. 앱 점검 화면을 확인하세요.'));
   },15000);
   document.addEventListener('qa34:validated-synthetic-export',onBackup,{once:true});
   document.addEventListener('qa34:family-locked',onLocked,{once:true});
   try{button.click()}catch(err){cleanup();reject(err)}
  });
 }
 async function loginFamily(familyKey,password){
  if(!/^qa-[a-z0-9-]{4,32}$/.test(familyKey))throw Error('가상 가족 ID는 qa-로 시작해야 합니다.');
  if(password.length<16||password.length>160)throw Error('실제 비밀번호가 아닌 16~160자 가상 비밀번호가 필요합니다.');
  if(token)throw Error('이미 로그인했습니다. 먼저 로그아웃하세요.');
  const bound=boundFamily(),originalServer=boundServer(),originalInstance=boundInstance(),requestedServer=address(),
   startedRevoke=localStorage.getItem(REVOKE_KEY)||'';
  const assertFresh=()=>{
   if((localStorage.getItem(REVOKE_KEY)||'')!==startedRevoke||
      boundFamily()!==bound||boundServer()!==originalServer||boundInstance()!==originalInstance)
    throw Error('다른 탭에서 가족 세션이 종료·변경되어 이전 로그인 응답을 폐기했습니다. 새로운 연결은 직접 다시 확인하세요.');
  };
  if(bound&&bound!==familyKey)
   throw Error('이 브라우저에는 다른 가상 가족의 오답·사진·관찰이 남아 있어 가족 전환을 차단했습니다. 별도 브라우저 프로필을 사용하세요.');
  if(bound&&originalServer!==requestedServer)
   throw Error('동일한 가상 가족 이름이라도 다른 시험 서버의 기록과 섞을 수 없습니다. 기존 브라우저 프로필은 원래 서버에서만 다시 연결하세요.');
  const response=await request('/qa/login','POST',{familyKey,password});
  // A delayed reply is not permission to reopen a tab after sibling logout.
  assertFresh();
  if(!/^[a-f0-9]{48}$/.test(String(response.gatewayInstanceId||''))||
     (bound&&(!originalInstance||originalInstance!==response.gatewayInstanceId)))
   throw Error('시험 서버가 재시작·교체되어 기존 가족 사진·관찰 기록을 이 서버에 연결할 수 없습니다. 기존 기록은 삭제하지 않았습니다.');
  server=requestedServer;token=response.token;
  $('qa34-password').value='';
  try{
   const loaded=await request('/qa/snapshot');
   assertFresh(); // also guard a late family snapshot response
   setRevision(loaded.revision,loaded.snapshot);
   // Persist only the SYNTHETIC family label. Do not delete or move photos.
   activeFamily=familyKey;
   // Keep synthetic family and gateway binding across logout/reload.
   localStorage.setItem(INSTANCE_KEY,response.gatewayInstanceId);
   localStorage.setItem(SERVER_KEY,requestedServer);
   localStorage.setItem(BOUND_KEY,familyKey);
   unlockLocalView();
   status('가상 가족 로그인 완료. 백업 보내기는 합성자료 체크 후 수동으로 실행하며, 가져오기는 기존 복원 확인창을 반드시 거칩니다.');
  }catch(err){clearSession();throw err}
 }
 $('qa34-login').addEventListener('click',()=>perform(()=>
  loginFamily($('qa34-family').value.trim(),$('qa34-password').value)));
 $('qa34-logout').addEventListener('click',()=>{
  // QA-only: a stalled HTTP logout acknowledgement must NEVER leave another
  // tab's photo/parent observation exposed while the network is pending.
  // Start the remote revocation while the old token exists, then revoke the
  // local presentation synchronously. No retry or automatic record deletion.
  if(busy||!token)return;
  const pending=request('/qa/logout','POST');
  clearSession();lockLocalView();broadcastLock();
  status('가상 가족 화면을 즉시 잠갔습니다. 원격 세션 종료 확인은 별도로 진행 중이며, 오답·사진·관찰은 삭제하지 않았습니다.');
  pending.then(()=>{
   // A late old logout ACK cannot overwrite a newly authenticated session.
   if(!token&&cover?.isConnected)status('가상 가족 화면 잠금 완료. 원격 로그아웃 요청도 완료되었습니다. 로컬 기록은 그대로입니다.');
  }).catch(()=>{
   if(!token&&cover?.isConnected)status('가상 가족 화면은 잠겼지만 원격 세션 종료는 확인되지 않았습니다. 연결 복구 뒤 다시 확인하세요.',true);
  });
 });
 $('qa34-upload').addEventListener('click',()=>perform(async()=>{
  if(!token||revision===null)throw Error('가상 가족 로그인과 서버 개정번호 확인이 필요합니다.');
  if(!$('qa34-synthetic').checked)throw Error('실제 아동 기록이 없는 합성자료 확인을 먼저 선택하세요.');
  // Trigger THE APP'S existing lossless export (photos, history, profile,
  // hash, stale-tab guards). This also downloads a separate fallback JSON.
  const savedRevision=revision,assertStillLoggedIn=activeEpoch();
  // QA35: fail before generating/downloading a new raw JSON backup if the
  // server is newer, or if this session was revoked by another device.
  // Keep CAS on the final PUT: a write may still race after this preflight.
  const current=await request('/qa/snapshot');
  assertStillLoggedIn();
  if(current.revision!==savedRevision)
   throw Error('서버 기록이 다른 기기에서 변경되어 전송을 중단했습니다. 먼저 최신본을 검토하세요.');
  status('오답노트 기존 백업 보호 검사 및 JSON 내보내기를 실행 중입니다.');
  const doc=await validatedAppBackup();
  assertStillLoggedIn();
  if(!doc||doc.format!=='uriaimath-offline-backup-v02'||
     !Array.isArray(doc.records)||!doc.photos||typeof doc.photos!=='object')
   throw Error('오답노트가 완전한 백업을 생성하지 않았습니다.');
  if(new Blob([JSON.stringify(doc)]).size>1000000)
   throw Error('가상 게이트웨이는 최대 1MB까지만 전송합니다. 다운로드한 백업 원본을 보존하세요.');
  // CAS: never silently refresh revision to replace another device's data.
  const sent=await request('/qa/snapshot','PUT',doc,savedRevision);
  assertStillLoggedIn();
  if(!sent.stored)throw Error('서버가 저장을 확정하지 않았습니다.');
  setRevision(sent.revision,doc);
  status('합성 오답 '+doc.records.length+'건과 사진 '+Object.keys(doc.photos).length+
   '장을 서버 개정번호 '+sent.revision+'에 저장했습니다. 원본 JSON도 별도로 내려받도록 요청했습니다. 자동 동기화는 아닙니다.');
 }));
 $('qa34-pull').addEventListener('click',()=>perform(async()=>{
  if(!token)throw Error('로그인이 필요합니다.');
  const assertStillLoggedIn=activeEpoch();
  const loaded=await request('/qa/snapshot');
  assertStillLoggedIn();
  if(!loaded.snapshot)throw Error('서버에 저장된 합성 백업이 없습니다.');
  const doc=loaded.snapshot;
  if(doc.format!=='uriaimath-offline-backup-v02'||!Array.isArray(doc.records))
   throw Error('원격 백업 형식이 올바르지 않습니다.');
  const encoded=JSON.stringify(doc);
  if(encoded.length>30*1024*1024)throw Error('백업 용량이 앱 제한을 초과합니다.');
  const field=$('import-file');
  if(!field)throw Error('앱 복원 입력창을 찾지 못했습니다.');
  // SAFETY: NEVER write IndexedDB directly. The existing app's import path
  // performs checksum, photo and dry-run checks and shows its confirmation
  // dialog before any destructive operation.
  const dt=new DataTransfer();
  dt.items.add(new File([encoded],'qa34-synthetic-server-revision-'+loaded.revision+'.json',
   {type:'application/json'}));
  field.files=dt.files;
  field.dispatchEvent(new Event('change',{bubbles:true}));
  setRevision(loaded.revision,doc);
  status('개정번호 '+loaded.revision+'의 합성 백업을 기존 오답노트 복원 검사에 전달했습니다. 복원 확인창에서 직접 허용하기 전에는 자료가 바뀌지 않습니다.');
 }));
 state();
 try{if(boundFamily())lockLocalView()}catch{lockLocalView();status('로컬 기록 소유 가족 표시를 확인할 수 없어 화면을 닫았습니다.',true)}
 if(!cover?.isConnected)status('127.0.0.1 로컬 전용 기능입니다. 실제 자녀 자료는 입력하지 마세요.');
}


// QA42 is imported ONLY by the exact local synthetic QA site. Never attach
// the signed-JWT prototype or its controls to public/production origins.
if(location.origin===LOCAL_ORIGIN)
 import('./qa42-app-http-bridge.mjs').catch(()=>{
  const el=document.getElementById('qa34-status');
  if(el)el.textContent='QA42 시험 모듈을 불러오지 못했습니다. 기존 로컬 기록은 그대로 유지됩니다.';
 });


// QA44: synthetic Supabase Auth SDK preview in the ACTUAL app Settings,
// isolated to the exact loopback origin. No real network/cloud or child data.
if(location.origin===LOCAL_ORIGIN)
 import('./qa44-supabase-auth-lab.mjs').catch(()=>{
  const el=document.getElementById('qa34-status');
  if(el)el.textContent='QA44 로컬 로그인 연동 예시를 불러오지 못했습니다. 오답 원본은 그대로입니다.';
 });
