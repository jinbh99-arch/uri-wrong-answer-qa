// QA34 G15 — real app settings -> synthetic local family gateway.
// This is NOT deployed family auth/cloud sync. No automatic upload/restore.
// Strictly gated to 127.0.0.1:4173. Never use actual child records.
const LOCAL_ORIGIN='http://127.0.0.1:4173';
const root=document.getElementById('qa34-sync-bridge');
if(root&&location.origin===LOCAL_ORIGIN){
 root.hidden=false;
 const $=id=>document.getElementById(id);
 let token='',revision=null,server='',busy=false;
 // QA-only accidental cross-family exposure guard. A local UI cover is NOT
 // security authentication; every IndexedDB byte is preserved on logout.
 const BOUND_KEY='qa34-synthetic-local-family-v1';
 let cover=null;
 const boundFamily=()=>localStorage.getItem(BOUND_KEY)||'';
 function lockLocalView(){
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
    '<form id="qa34-family-reenter" style="display:grid;gap:10px">'+
    '<label>시험 서버 포트<input id="qa34-reenter-port" type="number" min="1024" max="65535" required/></label>'+
    '<label>가상 가족 ID<input id="qa34-reenter-family" type="text" autocomplete="off" required/></label>'+
    '<label>가상 비밀번호<input id="qa34-reenter-password" type="password" autocomplete="off" required/></label>'+
    '<button type="submit">같은 가상 가족으로 화면 다시 열기</button></form>'+
    '<p id="qa34-reenter-status" role="alert"></p>';
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
  cover.querySelector('#qa34-reenter-family').value=boundFamily();
  cover.querySelector('#qa34-reenter-password').value='';
  cover.querySelector('#qa34-reenter-family').focus();
 }
 function unlockLocalView(){
  if(cover?.isConnected)cover.remove();
  const main=document.getElementById('qa-main');if(main)main.inert=false;
  const header=document.querySelector('header');if(header)header.inert=false;
 }
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
  token='';server='';revision=null;
  $('qa34-password').value='';
  if(cover)cover.querySelector('#qa34-reenter-password').value='';
  $('qa34-revision').textContent='로그아웃됨 · 서버 개정번호 미확인';
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
  const base=address(),headers={};
  if(token)headers.Authorization='Bearer '+token;
  if(body!==undefined)headers['Content-Type']='application/json';
  if(ifMatch!==undefined&&ifMatch!==null)headers['If-Match']='"'+ifMatch+'"';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
   const response=await fetch(base+path,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),
    mode:'cors',cache:'no-store',signal:controller.signal
   });
   const result=await response.json();
   if(!response.ok){
    // A revoked/expired gateway session must not appear active in the app.
    // Clear only ephemeral local credentials; never touch IndexedDB.
    if(response.status===401&&token)clearSession();
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
  try{await action()}
  catch(error){
   status('중단: '+String(error?.message||error).slice(0,180)+
    ' · 원본 기록을 자동 삭제하거나 복원하지 않았습니다.',true);
  }finally{busy=false;state()}
 }
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
   const onBackup=event=>{
    clearTimeout(timer);
    resolve(event.detail);
   };
   timer=setTimeout(()=>{
    document.removeEventListener('qa34:validated-synthetic-export',onBackup);
    reject(Error('기존 오답노트 백업 검증 완료 신호를 받지 못했습니다. 앱 점검 화면을 확인하세요.'));
   },15000);
   document.addEventListener('qa34:validated-synthetic-export',onBackup,{once:true});
   try{button.click()}
   catch(err){
    clearTimeout(timer);
    document.removeEventListener('qa34:validated-synthetic-export',onBackup);
    reject(err);
   }
  });
 }
 async function loginFamily(familyKey,password){
  if(!/^qa-[a-z0-9-]{4,32}$/.test(familyKey))throw Error('가상 가족 ID는 qa-로 시작해야 합니다.');
  if(password.length<16||password.length>160)throw Error('실제 비밀번호가 아닌 16~160자 가상 비밀번호가 필요합니다.');
  if(token)throw Error('이미 로그인했습니다. 먼저 로그아웃하세요.');
  const bound=boundFamily();
  if(bound&&bound!==familyKey)
   throw Error('이 브라우저에는 다른 가상 가족의 오답·사진·관찰이 남아 있어 가족 전환을 차단했습니다. 별도 브라우저 프로필을 사용하세요.');
  const response=await request('/qa/login','POST',{familyKey,password});
  server=address();token=response.token;
  $('qa34-password').value='';
  try{
   const loaded=await request('/qa/snapshot');
   setRevision(loaded.revision,loaded.snapshot);
   // Persist only the SYNTHETIC family label. Do not delete or move photos.
   localStorage.setItem(BOUND_KEY,familyKey);
   unlockLocalView();
   status('가상 가족 로그인 완료. 백업 보내기는 합성자료 체크 후 수동으로 실행하며, 가져오기는 기존 복원 확인창을 반드시 거칩니다.');
  }catch(err){clearSession();throw err}
 }
 $('qa34-login').addEventListener('click',()=>perform(()=>
  loginFamily($('qa34-family').value.trim(),$('qa34-password').value)));
 $('qa34-logout').addEventListener('click',()=>perform(async()=>{
  try{if(token)await request('/qa/logout','POST')}
  finally{clearSession();lockLocalView()}
  status('가상 가족 세션 종료. 오답·사진·관찰 기록은 삭제하지 않았고 다른 가상 가족 전환은 차단했습니다.');
 }));
 $('qa34-upload').addEventListener('click',()=>perform(async()=>{
  if(!token||revision===null)throw Error('가상 가족 로그인과 서버 개정번호 확인이 필요합니다.');
  if(!$('qa34-synthetic').checked)throw Error('실제 아동 기록이 없는 합성자료 확인을 먼저 선택하세요.');
  // Trigger THE APP'S existing lossless export (photos, history, profile,
  // hash, stale-tab guards). This also downloads a separate fallback JSON.
  const savedRevision=revision;
  // QA35: fail before generating/downloading a new raw JSON backup if the
  // server is newer, or if this session was revoked by another device.
  // Keep CAS on the final PUT: a write may still race after this preflight.
  const current=await request('/qa/snapshot');
  if(current.revision!==savedRevision)
   throw Error('서버 기록이 다른 기기에서 변경되어 전송을 중단했습니다. 먼저 최신본을 검토하세요.');
  status('오답노트 기존 백업 보호 검사 및 JSON 내보내기를 실행 중입니다.');
  const doc=await validatedAppBackup();
  if(!doc||doc.format!=='uriaimath-offline-backup-v02'||
     !Array.isArray(doc.records)||!doc.photos||typeof doc.photos!=='object')
   throw Error('오답노트가 완전한 백업을 생성하지 않았습니다.');
  if(new Blob([JSON.stringify(doc)]).size>1000000)
   throw Error('가상 게이트웨이는 최대 1MB까지만 전송합니다. 다운로드한 백업 원본을 보존하세요.');
  // CAS: never silently refresh revision to replace another device's data.
  const sent=await request('/qa/snapshot','PUT',doc,savedRevision);
  if(!sent.stored)throw Error('서버가 저장을 확정하지 않았습니다.');
  setRevision(sent.revision,doc);
  status('합성 오답 '+doc.records.length+'건과 사진 '+Object.keys(doc.photos).length+
   '장을 서버 개정번호 '+sent.revision+'에 저장했습니다. 원본 JSON도 별도로 내려받도록 요청했습니다. 자동 동기화는 아닙니다.');
 }));
 $('qa34-pull').addEventListener('click',()=>perform(async()=>{
  if(!token)throw Error('로그인이 필요합니다.');
  const loaded=await request('/qa/snapshot');
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
