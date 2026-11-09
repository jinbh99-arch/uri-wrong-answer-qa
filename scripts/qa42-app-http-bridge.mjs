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
 '<label for="qa42-target">같은 오답으로 돌아갈 기록 선택 (가상 ID)</label>',
 '<select id="qa42-target" aria-label="돌아갈 오답 ID" disabled><option value="">연결 후 오답 선택</option></select>',
 '<button id="qa42-open-record" type="button" class="secondary" disabled>선택한 오답 상세로 돌아가기</button>',
 '<p class="small" id="qa42-safety-note">로컬에 독립 변경사항이 있으면 서버 기록으로 자동 덮어쓰지 않습니다. 충돌은 백업을 보존한 뒤 수동 검토하세요.</p>',
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
 // WRONG-004: baseline is the complete byte-level proof from an explicitly
 // confirmed upload/restore; it is only kept in this browser tab's memory.
 let baselineProof=null,pendingRestore=null,preferredId='';
 const DB='uriaimath-github-qa-v224-only';
 const idOkay=id=>/^[A-Za-z0-9_-]{1,100}$/.test(String(id||''));
 const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 async function sha(bytes){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))}
 // Read all app stores in ONE readonly transaction; no writes or downloaded
 // raw JSON, so failed preflight cannot clobber a local family record.
 async function localProof(){
  const request=indexedDB.open(DB);
  const db=await new Promise((ok,bad)=>{
   request.onsuccess=()=>ok(request.result);request.onerror=()=>bad(request.error);
   request.onblocked=()=>bad(Error('브라우저 저장소가 잠겨 있습니다.'));
  });
  try{
   const snapshot=await new Promise((ok,bad)=>{
    const tx=db.transaction(['mistakes','photos','settings'],'readonly');
    const tasks=[
     tx.objectStore('mistakes').getAll(),tx.objectStore('photos').getAllKeys(),
     tx.objectStore('photos').getAll(),tx.objectStore('settings').get('profile'),
     tx.objectStore('settings').getAllKeys()
    ];const vals=[];
    tasks.forEach((r,i)=>r.onsuccess=()=>{vals[i]=r.result});
    tx.oncomplete=()=>ok(vals);
    tx.onerror=()=>bad(tx.error||Error('로컬 원본을 읽을 수 없습니다.'));
    tx.onabort=()=>bad(tx.error||Error('로컬 원본 읽기가 취소됐습니다.'));
   });
   const [rows,keys,blobs,profile,settings]=snapshot;
   if(!Array.isArray(rows)||!Array.isArray(keys)||!Array.isArray(blobs)||keys.length!==blobs.length||
      !Array.isArray(settings)||settings.some(k=>k!=='profile'))
    throw Error('기존 기록·사진·설정 검사 실패: 미지원 저장 상태');
   return {empty:rows.length===0&&keys.length===0,
    signature:JSON.stringify({
     records:rows.map(r=>[String(r.id),JSON.stringify(r)]).sort((a,b)=>a[0].localeCompare(b[0])),
     photos:await Promise.all(keys.map(async(k,i)=>[String(k),blobs[i]?.type,await sha(await blobs[i].arrayBuffer())])).then(a=>a.sort((x,y)=>x[0].localeCompare(y[0]))),
     profile:JSON.stringify(profile||null)
    })};
  }finally{db.close()}
 }
 async function backupProof(doc){
  if(!Array.isArray(doc?.records)||!doc?.photos||typeof doc.photos!=='object')throw Error('가상 백업 자료 형식 오류');
  const photos=[];
  for(const [id,source] of Object.entries(doc.photos)){
   const m=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(source));
   if(!m)throw Error('가상 백업 사진 형식 오류');
   const raw=atob(m[2]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
   photos.push([String(id),m[1],await sha(bytes)]);
  }
  return JSON.stringify({
   records:doc.records.map(r=>[String(r.id),JSON.stringify(r)]).sort((a,b)=>a[0].localeCompare(b[0])),
   photos:photos.sort((a,b)=>a[0].localeCompare(b[0])),
   profile:JSON.stringify(doc.profile||null)
  });
 }
 function targetOptions(doc){
  const select=$('qa42-target'),prior=select.value;
  select.replaceChildren(new Option('직접 선택하세요',''));
  if(!Array.isArray(doc?.records)){select.disabled=true;ui();return}
  for(const r of doc.records){
   if(!idOkay(r.id))continue;
   const label=(String(r.problemText||'사진만 저장된 문제').replace(/\s+/g,' ').slice(0,35)||'사진만 저장된 문제');
   select.add(new Option(label+' · '+r.id.slice(0,12),r.id));
  }
  const desired=[preferredId,prior].find(id=>id&&Array.from(select.options).some(o=>o.value===id));
  if(desired)select.value=desired;
  else if(select.options.length===2)select.selectedIndex=1;
  select.disabled=!bearer||busy;
  ui();
 }

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
  $('qa42-target').disabled=busy||!bearer;
  $('qa42-open-record').disabled=busy||!bearer||!idOkay($('qa42-target').value);
 }
 function clear(){
  bearer='';base='';revision=null;familyId='';baselineProof=null;pendingRestore=null;preferredId='';
  $('qa42-token').value='';
  $('qa42-family').replaceChildren(new Option('미연결',''));
  $('qa42-target').replaceChildren(new Option('연결 후 오답 선택',''));
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
  targetOptions(doc);
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
  baselineProof=null;pendingRestore=null;preferredId='';
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
  baselineProof=await backupProof(doc); // remote acknowledged exact export
  showRevision(sent.revision,doc);
  status('개정번호 '+sent.revision+'에 합성 오답을 저장했습니다. 자동 동기화가 아닙니다.');
 }));
 $('qa42-pull').addEventListener('click',()=>act(async()=>{
  if(!bearer||!familyId)throw Error('가상 인증이 필요합니다.');
  const latest=await request(route());
  if(!latest?.snapshot||latest.snapshot.format!=='uriaimath-offline-backup-v02')
   throw Error('서버에 복원 가능한 가상 백업이 없습니다.');
  // Fail closed on local unsynced edits, unknown origin or family change.
  // An empty local DB may join the verified synthetic family; otherwise
  // require a previously confirmed matching baseline or EXACT remote equality.
  const local=await localProof(),remoteProof=await backupProof(latest.snapshot);
  if(!local.empty&&local.signature!==baselineProof&&local.signature!==remoteProof)
   throw Error('이 기기에 미전송·다른 가족 기록 또는 충돌 변경이 있습니다. 전체 복원 시 원본이 사라질 수 있어 가져오기를 차단했습니다. 먼저 백업 후 수동으로 검토하세요.');
  const json=JSON.stringify(latest.snapshot);
  if(new Blob([json]).size>1024*1024)throw Error('서버 백업 용량 초과');
  const field=$('import-file');
  if(!field)throw Error('기존 앱 복원 입력창을 찾지 못했습니다.');
  const dt=new DataTransfer();
  dt.items.add(new File([json],'qa42-synthetic-revision-'+latest.revision+'.json',{type:'application/json'}));
  // Delegate validation, dry run and explicit consent to the existing app.
  pendingRestore={doc:latest.snapshot,targetId:$('qa42-target').value,proof:remoteProof};
  field.files=dt.files;field.dispatchEvent(new Event('change',{bubbles:true}));
  showRevision(latest.revision,latest.snapshot);
  status('앱 복원 검사에 가상 백업을 전달했습니다. 별도 확인창 승인 전에는 데이터가 바뀌지 않습니다.');
 }));
 $('qa42-target').addEventListener('change',()=>{preferredId=$('qa42-target').value;ui()});
 $('qa42-open-record').addEventListener('click',()=>{
  const id=$('qa42-target').value;if(!bearer||!idOkay(id))return;
  document.dispatchEvent(new CustomEvent('wrong004:open-record',{detail:{id}}));
 });
 document.addEventListener('wrong004:remember-record',event=>{
  const id=event.detail?.id;
  if(!idOkay(id))return;
  preferredId=id;
  if(Array.from($('qa42-target').options).some(o=>o.value===id))$('qa42-target').value=id;
  ui();
 });
 document.addEventListener('wrong004:restore-verified',async event=>{
  const pending=pendingRestore;pendingRestore=null;
  if(!pending||!bearer||!familyId)return;
  try{
   const evidence=await localProof();
   if(evidence.signature!==pending.proof)throw Error('복원 후 원본 바이트 재검사에서 차이가 확인됐습니다.');
   baselineProof=pending.proof;
   status('복원 확인 및 같은 기록·사진 재조회가 완료됐습니다. 자동 가족 공유는 아닙니다.');
   if(idOkay(pending.targetId)&&event.detail?.ids?.includes(pending.targetId))
    document.dispatchEvent(new CustomEvent('wrong004:open-record',{detail:{id:pending.targetId}}));
  }catch(err){baselineProof=null;status('복원 후 재검사 실패: '+String(err.message||err).slice(0,100)+' · 원본 백업을 확인하세요.',true)}
 });
 ui();status('로컬 가상 JWT+가족 DB 수동 교환입니다. 실제 아동 정보는 입력하지 마세요.');
}
