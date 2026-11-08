// QA42: actual app Settings -> signed synthetic JWT -> Postgres RLS HTTP API.
// Local synthetic QA only. No automatic transmission or destructive restore.
const ORIGIN='http://127.0.0.1:4173';
if(location.origin===ORIGIN&&document.getElementById('qa34-sync-bridge')){
 const html=[
 '<section class="card" id="qa42-real-api" aria-label="서명 JWT 가족 교환 시험">',
 '<h2>🧪 서명 JWT·가족 DB 수동 교환 (QA42)</h2>',
 '<p class="small">127.0.0.1 로컬 가상 시험 전용입니다. 실제 아동 정보·실계정 토큰을 입력하지 마세요. 자동 동기화가 아닙니다.</p>',
 '<label for="qa42-port">가상 가족 API 임시 포트</label>',
 '<input id="qa42-port" type="number" inputmode="numeric" min="1024" max="65535" placeholder="임시 포트 번호"/>',
 '<label for="qa42-token">합성 서명 JWT (실제 로그인 토큰 입력 금지)</label>',
 '<input id="qa42-token" type="password" autocomplete="off" spellcheck="false"/>',
 '<button id="qa42-connect" type="button" class="secondary">가상 JWT로 가족 확인</button>',
 '<button id="qa42-logout" type="button" class="secondary" disabled>시험 연결 종료</button>',
 '<label for="qa42-family">인증된 가상 가족</label>',
 '<select id="qa42-family" disabled><option value="">미연결</option></select>',
 '<p id="qa42-revision" class="small" aria-live="polite">서버 개정번호 미확인</p>',
 '<label style="display:flex;gap:9px;align-items:flex-start">',
 '<input id="qa42-synthetic" type="checkbox" style="flex:none;width:20px;margin-top:4px"/>',
 '모든 오답·사진·설정은 실제 아동이 없는 합성 시험자료임을 확인합니다.</label>',
 '<button id="qa42-upload" type="button" disabled>기록 원본 확인 후 수동 전송</button>',
 '<button id="qa42-pull" type="button" class="secondary" disabled>서버 최신본 → 앱 복원 확인창</button>',
 '<p id="qa42-status" role="status" aria-live="polite">테스트 전용 연결입니다.</p>',
 '</section>'
 ].join('');
 document.getElementById('qa34-sync-bridge').insertAdjacentHTML('afterend',html);
 const $=id=>document.getElementById(id);
 let bearer='',base='',revision=null,familyId='',busy=false;
 function status(message,err=false){
  $('qa42-status').textContent=message;
  $('qa42-status').dataset.error=String(err);
 }
 function ui(){
  $('qa42-connect').disabled=busy||!!bearer;
  $('qa42-logout').disabled=busy||!bearer;
  $('qa42-family').disabled=busy||!bearer;
  $('qa42-upload').disabled=busy||!bearer||revision===null||!familyId;
  $('qa42-pull').disabled=busy||!bearer||!familyId;
 }
 function clear(){
  bearer='';base='';revision=null;familyId='';
  $('qa42-token').value='';
  $('qa42-family').replaceChildren(new Option('미연결',''));
  $('qa42-revision').textContent='로그아웃됨 · 서버 개정번호 미확인';
  ui();
 }
 function address(){
  const raw=String($('qa42-port').value),p=Number(raw);
  if(!/^[0-9]{4,5}$/.test(raw)||!Number.isInteger(p)||p<1024||p>65535)
   throw Error('로컬 API 포트 1024~65535가 필요합니다.');
  const addr='http://127.0.0.1:'+p;
  if(bearer&&base!==addr)throw Error('서버를 바꾸려면 연결을 종료하세요.');
  return addr;
 }
 function route(){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(familyId))
   throw Error('인증된 가상 가족을 선택하세요.');
  return '/qa41/families/'+familyId+'/snapshot';
 }
 async function request(path,method='GET',body,expected){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  const headers={};
  if(bearer)headers.Authorization='Bearer '+bearer;
  if(body!==undefined)headers['Content-Type']='application/json';
  if(expected!==undefined)headers['If-Match']='"'+expected+'"';
  try{
   const res=await fetch(address()+path,{
    method,headers,mode:'cors',cache:'no-store',
    body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal
   });
   const data=await res.json();
   if(!res.ok){
    if(res.status===401||res.status===404)clear();
    throw Error('서버 응답 '+res.status+': '+String(data?.error||'요청 거절').slice(0,70));
   }
   return data;
  }catch(e){
   if(e?.name==='AbortError'||e instanceof TypeError)
    throw Error(method==='PUT'
     ? '서버 저장 결과를 확인할 수 없습니다. 자동 재전송하지 않습니다. 직접 최신본을 조회하세요.'
     : '가상 API 연결 오류. 로컬 오답과 사진은 그대로 유지됩니다.');
   throw e;
  }finally{clearTimeout(timer)}
 }
 async function act(fn){
  if(busy)return;
  busy=true;ui();
  try{await fn()}catch(e){
   status('중단: '+String(e?.message||e).slice(0,170)+
    ' · 앱 원본은 자동 교체하거나 삭제하지 않았습니다.',true);
  }finally{busy=false;ui()}
 }
 function showRevision(v,doc){
  if(!Number.isSafeInteger(v)||v<0)throw Error('서버 개정번호 오류');
  revision=v;
  $('qa42-revision').textContent='서버 개정번호 '+v+' · 합성 오답 '+
   (doc?.records?.length??0)+'건 · 사진 '+Object.keys(doc?.photos||{}).length+'장';
 }
 async function makeBackup(){
  const button=$('export-json');
  if(!button||button.disabled)throw Error('기존 앱의 완전 백업 버튼을 사용할 수 없습니다.');
  return new Promise((resolve,reject)=>{
   let timer;
   function cleanup(){clearTimeout(timer);document.removeEventListener('qa34:validated-synthetic-export',ready)}
   function ready(event){cleanup();resolve(event.detail)}
   document.addEventListener('qa34:validated-synthetic-export',ready,{once:true});
   timer=setTimeout(()=>{cleanup();reject(Error('기존 앱 백업 검증 시간 초과'))},17000);
   try{button.click()}catch(e){cleanup();reject(e)}
  });
 }
 $('qa42-connect').addEventListener('click',()=>act(async()=>{
  if(bearer)throw Error('먼저 기존 연결을 종료하세요.');
  const jwt=$('qa42-token').value.trim();
  if(!/^[A-Za-z0-9._~-]{50,12000}$/.test(jwt))throw Error('합성 서명 JWT 형식이 올바르지 않습니다.');
  base=address();bearer=jwt;$('qa42-token').value='';
  try{
   const list=await request('/qa41/families');
   if(!Array.isArray(list.families)||list.families.length===0)throw Error('승인된 가상 가족이 없습니다.');
   const select=$('qa42-family');select.replaceChildren();
   for(const id of list.families){
    if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('가족 ID 형식 오류');
    select.add(new Option('승인된 가상 가족 '+id.slice(0,8),id));
   }
   familyId=select.value;
   const current=await request(route());showRevision(current.revision,current.snapshot);
   status('JWT와 PostgreSQL 가족 권한 확인 완료. 모두 수동 교환입니다.');
  }catch(e){clear();throw e}
 }));
 $('qa42-logout').addEventListener('click',()=>act(async()=>{
  clear();status('가상 인증 연결 종료. 로컬 오답·사진은 변경하지 않았습니다.');
 }));
 $('qa42-family').addEventListener('change',()=>act(async()=>{
  familyId=$('qa42-family').value;revision=null;
  const current=await request(route());showRevision(current.revision,current.snapshot);
  status('가상 가족을 변경해 최신 개정번호를 다시 확인했습니다.');
 }));
 $('qa42-upload').addEventListener('click',()=>act(async()=>{
  if(!bearer||revision===null)throw Error('가상 서명 JWT 인증이 필요합니다.');
  if(!$('qa42-synthetic').checked)throw Error('합성자료 확인을 먼저 선택하세요.');
  const expected=revision;
  const remote=await request(route());
  if(remote.revision!==expected)throw Error('서버 최신본이 변경돼 원본 백업을 새로 만들지 않고 중단했습니다.');
  status('기존 앱의 사진·오답 원본과 복원 가능성 검사를 수행합니다.');
  const doc=await makeBackup();
  if(doc?.format!=='uriaimath-offline-backup-v02'||
    !Array.isArray(doc.records)||!doc.photos)throw Error('완전한 앱 백업이 아닙니다.');
  if(new Blob([JSON.stringify({snapshot:doc})]).size>1024*1024)
   throw Error('서버 1MiB 전송 제한. 다운로드한 기존 백업 원본을 보관하세요.');
  const sent=await request(route(),'PUT',{snapshot:doc},expected);
  if(sent?.stored!==true)throw Error('서버가 저장 완료를 확인하지 않았습니다.');
  showRevision(sent.revision,doc);
  status('개정번호 '+sent.revision+'에 합성 오답을 저장했습니다. 자동 동기화가 아닙니다.');
 }));
 $('qa42-pull').addEventListener('click',()=>act(async()=>{
  if(!bearer||!familyId)throw Error('가상 인증이 필요합니다.');
  const latest=await request(route());
  if(!latest?.snapshot||latest.snapshot.format!=='uriaimath-offline-backup-v02')
   throw Error('서버에 복원 가능한 가상 백업이 없습니다.');
  const json=JSON.stringify(latest.snapshot);
  if(new Blob([json]).size>1024*1024)throw Error('서버 백업 용량 초과');
  const field=$('import-file');
  if(!field)throw Error('기존 앱 복원 입력창을 찾지 못했습니다.');
  const dt=new DataTransfer();
  dt.items.add(new File([json],'qa42-synthetic-revision-'+latest.revision+'.json',{type:'application/json'}));
  // Delegate validation, dry run and explicit consent to the existing app.
  field.files=dt.files;field.dispatchEvent(new Event('change',{bubbles:true}));
  showRevision(latest.revision,latest.snapshot);
  status('앱 복원 검사에 가상 백업을 전달했습니다. 별도 확인창 승인 전에는 데이터가 바뀌지 않습니다.');
 }));
 ui();status('로컬 가상 JWT+가족 DB 수동 교환입니다. 실제 아동 정보는 입력하지 마세요.');
}
