// QA34 G15 — real app settings -> synthetic local family gateway.
// This is NOT deployed family auth/cloud sync. No automatic upload/restore.
// Strictly gated to 127.0.0.1:4173. Never use actual child records.
const LOCAL_ORIGIN='http://127.0.0.1:4173';
const root=document.getElementById('qa34-sync-bridge');
if(root&&location.origin===LOCAL_ORIGIN){
 root.hidden=false;
 const $=id=>document.getElementById(id);
 const buttons=['qa34-login','qa34-logout','qa34-upload','qa34-pull'];
 let token='',revision=null,server='',busy=false;
 function status(message,error=false){
  $('qa34-status').textContent=message;
  $('qa34-status').setAttribute('data-error',String(error));
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
   if(!response.ok)throw Error('서버 응답 '+response.status+': '+String(result?.error||'요청 실패').slice(0,55));
   return result;
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
 $('qa34-login').addEventListener('click',()=>perform(async()=>{
  const familyKey=$('qa34-family').value.trim(),password=$('qa34-password').value;
  if(!/^qa-[a-z0-9-]{4,32}$/.test(familyKey))throw Error('가상 가족 ID는 qa-로 시작해야 합니다.');
  if(password.length<16||password.length>160)throw Error('실제 비밀번호가 아닌 16~160자 가상 비밀번호가 필요합니다.');
  if(token)throw Error('이미 로그인했습니다. 먼저 로그아웃하세요.');
  const response=await request('/qa/login','POST',{familyKey,password});
  server=address();token=response.token;
  $('qa34-password').value='';
  try{
   const loaded=await request('/qa/snapshot');
   setRevision(loaded.revision,loaded.snapshot);
   status('가상 가족 로그인 완료. 백업 보내기는 합성자료 체크 후 수동으로 실행하며, 가져오기는 기존 복원 확인창을 반드시 거칩니다.');
  }catch(err){clearSession();throw err}
 }));
 $('qa34-logout').addEventListener('click',()=>perform(async()=>{
  try{if(token)await request('/qa/logout','POST')}
  finally{clearSession()}
  status('로컬 가상 가족 세션을 종료했습니다. 기기의 오답은 변경하지 않았습니다.');
 }));
 $('qa34-upload').addEventListener('click',()=>perform(async()=>{
  if(!token||revision===null)throw Error('가상 가족 로그인과 서버 개정번호 확인이 필요합니다.');
  if(!$('qa34-synthetic').checked)throw Error('실제 아동 기록이 없는 합성자료 확인을 먼저 선택하세요.');
  // Trigger THE APP'S existing lossless export (photos, history, profile,
  // hash, stale-tab guards). This also downloads a separate fallback JSON.
  const savedRevision=revision;
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
  status('개정번호 '+loaded.revision+'의 합성 백업을 기존 오답노트 복원 검사에 전달했습니다. **복원 확인창에서 직접 허용하기 전에는 자료가 바뀌지 않습니다.**');
 }));
 state();
 status('127.0.0.1 로컬 전용 기능입니다. 실제 자녀 자료는 입력하지 마세요.');
}
