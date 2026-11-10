// WRONG-P8 QA ONLY. Attach P7's verified, restored read-only records to
// EXISTING A v1.4 parent detail DOM, NOT to an invented stand-alone mock UI.
// No local IndexedDB writes, no auto-sync or restore, no browser JWT/DB secret.
(()=>{
 'use strict';
 if(location.hostname!=='127.0.0.1'||location.pathname!=='/qa-p8/a-parent')
  return;
 const DB='uriaimath-github-qa-v224-only';
 const $=id=>document.getElementById(id);
 let selectedId=null,epoch=0,busy=false;
 const panel=document.createElement('section');
 panel.id='wrong-p8-restored-read';panel.className='card';panel.hidden=true;
 panel.setAttribute('aria-label','복원된 학습 변화 확인 · 가상 읽기 전용');
 const heading=document.createElement('h3');
 heading.textContent='복원된 아이 재풀이·부모 관찰 확인 (가상 읽기 전용)';
 const warning=document.createElement('p');warning.className='small';
 warning.textContent='실제 계정 연결이 아닙니다. 로컬 가상 보호자 권한과 동일 오답 ID·과목·문제 내용·학년·사진 표시가 확인된 경우에만 조회합니다. A의 기기 내 기록과 서버 복원 원장을 자동 병합하거나 저장하지 않습니다.';
 const btn=document.createElement('button');btn.type='button';btn.className='secondary';
 btn.id='wrong-p8-read-action';btn.textContent='가상 복원 이력 안전 조회';
 const status=document.createElement('p');status.id='wrong-p8-read-status';
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const list=document.createElement('ol');list.id='wrong-p8-read-events';
 list.setAttribute('aria-label','검증된 가상 복원 학습 변화');
 const end=document.createElement('p');end.className='small';
 end.textContent='기존 v02 JSON에는 별도 부모 관찰 원장이 포함되지 않습니다. 운영 인증·동의·암호키·사진 이관·실 DB 적용 미완료 · safeToRestore:false.';
 panel.append(heading,warning,btn,status,list,end);
 const insert=()=>{
  const d=$('page-detail'),card=$('detail-card');
  if(d&&card&&!panel.isConnected)card.before(panel);
 };
 const clear=(message)=>{
  epoch++;list.replaceChildren();status.textContent=message||'조회 전 · 원본 데이터 변경 없음';
 };
 const parentActive=()=>Boolean(
  $('page-detail')&&!$('page-detail').classList.contains('hide')&&
  $('v218-parent-mode')?.getAttribute('aria-pressed')==='true'&&
  $('v218-child-mode')?.getAttribute('aria-pressed')==='false'
 );
 const readLocal=async id=>{
  if(typeof indexedDB.databases!=='function')
   throw Error('로컬 저장소 존재 여부 확인 미지원');
  const databases=await indexedDB.databases();
  if(!databases.some(x=>x.name===DB))
   throw Error('A 로컬 기록 없음');
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB);
   req.onerror=()=>reject(Error('A 로컬 기록 조회 실패'));
   req.onsuccess=()=>{
    const db=req.result;
    if(!db.objectStoreNames.contains('mistakes')){
     db.close();reject(Error('A 로컬 오답 저장소 없음'));return;
    }
    const tx=db.transaction('mistakes','readonly');
    const query=tx.objectStore('mistakes').get(id);
    query.onsuccess=()=>resolve(query.result??null);
    query.onerror=()=>reject(Error('A 로컬 오답 읽기 실패'));
    tx.oncomplete=()=>db.close();
    tx.onerror=()=>db.close();
   };
  });
 };
 const verifiedPair=(row,view,id)=>{
  const r=view?.record;
  return !!row&&r&&r.id===id&&row.id===id&&
   row.subject===r.subject&&row.problemText===r.problemText&&
   Number(row.gradeAtEntry)===Number(r.gradeAtEntry)&&
   (row.hasPhoto===true)===(r.hasPhoto===true);
 };
 const event=(kind,title,description,revision)=>{
  const li=document.createElement('li');
  li.dataset.kind=kind;
  li.style.cssText='border:1px solid #d9e3ef;border-left:4px solid #236e90;border-radius:10px;padding:12px;margin:10px 0;';
  const top=document.createElement('strong');top.textContent=title+' · 개정 '+revision;
  const p=document.createElement('p');p.style.whiteSpace='pre-wrap';p.textContent=description;
  li.append(top,p);return li;
 };
 const load=async()=>{
  if(busy)return;
  insert();
  const id=selectedId;
  const started=++epoch;
  list.replaceChildren();
  if(!id||!parentActive()){
   status.textContent='차단: A 부모 화면의 실제 오답 상세에서만 조회할 수 있습니다.';return;
  }
  const detail=$('detail-text');
  if(!detail||!detail.isConnected){
   status.textContent='차단: A 오답 상세 정보가 준비되지 않았습니다.';return;
  }
  busy=true;btn.disabled=true;
  status.textContent='로컬 원본과 가상 복원 접근 권한 대조 중…';
  try{
   const local=await readLocal(id);
   if(!local||local.id!==id||detail.textContent!==local.problemText)
    throw Error('LOCAL_RECORD_NOT_MATCHED');
   const response=await fetch('/qa-p3/api/parent/timeline',{
    credentials:'same-origin',cache:'no-store',
    headers:{accept:'application/json'}
   });
   if(!response.ok)throw Error('RESTORED_GUARDIAN_ACCESS_DENIED');
   const t=await response.json();
   // Both server-provided record scope and A local detail must match.
   if(!verifiedPair(local,t,id))throw Error('A_P7_RECORD_CONTRACT_MISMATCH');
   const newest=await readLocal(id);
   if(!verifiedPair(newest,t,id)||JSON.stringify(local)!==JSON.stringify(newest)||
    started!==epoch||selectedId!==id||!parentActive()||
    $('detail-text')?.textContent!==local.problemText)
    throw Error('STALE_A_PARENT_DETAIL');
   const byId=new Map(t.attempts.map(a=>[a.attemptId,a]));
   const obs=new Map(t.attempts.flatMap(a=>
    a.observations.map(o=>[o.id,{a,o}])));
   const fragment=document.createDocumentFragment();
   for(const step of t.order){
    const attempt=byId.get(step.attemptId);
    if(!attempt)throw Error('UNLINKED_CHILD_REQUEST');
    if(step.kind==='child_retry')fragment.append(event('child_retry','아이 재풀이',
     '답: '+attempt.answer+'\n아이 설명: '+attempt.explanation,step.revision));
    else if(step.kind==='guardian_observation'){
     const link=obs.get(step.observationId);
     if(!link||link.a.attemptId!==step.attemptId)
      throw Error('UNLINKED_PARENT_OBSERVATION');
     const label={explained:'아이가 설명함',needs_help:'도움 필요',
      not_checked:'아직 확인하지 않음'}[link.o.status];
     if(!label)throw Error('INVALID_PARENT_OBSERVATION');
     fragment.append(event('guardian_observation','보호자 관찰',
      label+'\n직접 남긴 메모: '+link.o.note,step.revision));
    }else throw Error('UNEXPECTED_EVENT_KIND');
   }
   if(!t.readOnlyRestored||t.safeToRestore!==false||
    t.observationEventsIncludedInJsonBackup!==false)
    throw Error('P7_READ_ONLY_CONTRACT_MISSING');
   // Commit only after *all* checks. Never render an unverified partial list.
   list.replaceChildren(fragment);
   status.textContent='연결 검증 완료 · 가상 복원 기록 '+t.order.length+
    '개 · 서버 개정 '+t.revision+' · 읽기 전용 · 로컬 A 데이터 무변경';
  }catch(e){
   list.replaceChildren();
   status.textContent='조회 차단: 신원·오답 일치·복원 무결성 계약을 확인하지 못했습니다 ('+
    String(e?.message||'UNKNOWN').slice(0,70)+'). A의 원본은 변경하지 않았습니다.';
  }finally{
   busy=false;btn.disabled=false;
  }
 };
 btn.addEventListener('click',load);
 document.addEventListener('click',event=>{
  const record=event.target.closest?.('[data-record]');
  const nav=event.target.closest?.('[data-route],#v218-child-mode,#v218-parent-mode');
  if(record){selectedId=record.dataset.record;insert();panel.hidden=false;clear();}
  else if(nav){selectedId=null;panel.hidden=true;clear();}
 },true);
 const obs=new MutationObserver(()=>{
  insert();
  if(!parentActive()&&panel.isConnected){
   panel.hidden=true;if(list.childElementCount)clear('부모 상세를 벗어나 조회 결과를 닫았습니다.');
  }else if(selectedId&&parentActive())panel.hidden=false;
 });
 if($('qa-main'))obs.observe($('qa-main'),{subtree:false,childList:true,attributes:true});
 if($('page-detail'))obs.observe($('page-detail'),{attributes:true,attributeFilter:['class']});
 insert();
})();
