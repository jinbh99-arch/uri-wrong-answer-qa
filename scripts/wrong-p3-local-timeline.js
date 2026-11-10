// A real browser client of the B2/B3/B4 synthetic contract via loopback HTTP.
// No mock data/secret token bundled in the UI. textContent only (no HTML injection).
'use strict';
const $=id=>document.getElementById(id);
const parent=location.pathname.endsWith('/parent');
const state=$('app-state');
let revision=0,attempts=[];
const make=(tag,cls,text)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
};
const status=msg=>{state.textContent=msg};
const uid=()=> 'qa'+crypto.randomUUID().replaceAll('-','');
async function api(path,doc){
 const init={credentials:'same-origin',cache:'no-store',headers:{}};
 if(doc!==undefined){
  init.method='POST';
  init.headers={'content-type':'application/json','x-wrong-p3-action':'synthetic-only'};
  init.body=JSON.stringify(doc);
 }
 const response=await fetch('/qa-p3/api/'+path,init);
 const result=await response.json();
 if(!response.ok)throw Error('요청이 거부됐습니다 ('+result.error+'). 기존 기록은 변경되지 않았습니다.');
 return result;
}
function oneEvent(kind,head,detail,meta){
 const li=make('li','event '+kind);
 const title=make('div','event-head',head);
 const body=make('p','event-detail',detail);
 const small=make('p','event-meta',meta);
 li.append(title,body,small);return li;
}
async function parentLoad(){
 const root=$('guardian');root.hidden=false;
 const s=await api('parent/status');
 revision=s.revision;
 $('register-panel').hidden=s.registered;
 $('parent-study').hidden=!s.registered;
 if(!s.registered){
  status('가상 보호자 인증 확인 · 먼저 오답을 등록하세요.');
  return;
 }
 const t=await api('parent/timeline');
 revision=t.revision;attempts=t.attempts;
 $('parent-problem').textContent=t.record.problemText;
 $('parent-photo').textContent=t.record.hasPhoto?'합성 사진이 연결돼 있습니다. 사진 데이터 자체는 이 페이지에 표시하지 않습니다.':'사진 없음';
 const parentItems=new Map();
 for(const a of attempts){
  for(const o of a.observations)parentItems.set(o.id,{a,o});
 }
 const retryById=new Map(attempts.map(a=>[a.attemptId,a]));
 const list=$('timeline');list.replaceChildren();
 const labels={not_checked:'아직 확인하지 않음',explained:'스스로 설명했다고 관찰',needs_help:'도움이 더 필요하다고 관찰'};
 for(const step of t.order){
  const a=retryById.get(step.attemptId);
  if(!a)continue;
  if(step.kind==='child_retry'){
   const li=oneEvent('child_retry','아이 재풀이 · 개정 '+step.revision,
    '답: '+a.answer+'\n아이 설명: '+a.explanation,
    '원 시도 ID로 연결 · '+a.at);
   li.dataset.kind='child_retry';li.dataset.attemptId=step.attemptId;list.append(li);
  }else{
   const ref=parentItems.get(step.observationId);if(!ref)continue;
   const li=oneEvent('guardian_observation','보호자 관찰 · 개정 '+step.revision,
    labels[ref.o.status]+'\n부모 메모: '+(ref.o.note||'(없음)'),
    '아이 시도에 연결 · '+step.attemptId+' · '+String(ref.o.at));
   li.dataset.kind='guardian_observation';
   li.dataset.observationId=step.observationId;list.append(li);
  }
 }
 if(!t.order.length)list.append(oneEvent('child_retry','재풀이 대기','아이가 재풀이와 자기 설명을 저장하면 여기서 순서대로 볼 수 있습니다.',''));
 $('legacy-note').textContent=t.unlinkedBackupAttempts+
  '개의 구형 재풀이에는 서버 확인된 아동 시도 ID가 없어 임의로 부모 관찰과 연결하지 않았습니다.';
 const select=$('attempt-select');select.replaceChildren();
 attempts.forEach((a,i)=>{
  const opt=make('option',null,(i+1)+'번째 아이 재풀이 · 답: '+a.answer);
  opt.value=a.attemptId;select.append(opt);
 });
 $('observation-save').disabled=!attempts.length;
 status('가상 보호자에게 허용된 한 오답만 조회했습니다. 이 타임라인은 읽기 전용 서버 기록입니다.');
}
async function childLoad(){
 $('child').hidden=false;
 try{
  const value=await api('child/question');
  revision=value.revision;
  $('child-problem').textContent=value.record.problemText;
  const own=$('child-own-history');own.replaceChildren();
  for(const [i,a] of value.ownAttempts.entries())
   own.append(oneEvent('child_retry',(i+1)+'번째 내 재풀이',
    '답: '+a.answer+'\n설명: '+a.explanation,a.at));
  status('가상 아이에게 허용된 문제만 조회했습니다. 보호자 관찰은 노출되지 않습니다.');
 }catch(e){
  $('child-problem').textContent='등록된 가상 문제가 없습니다. 보호자가 등록한 뒤 새로고침하세요.';
  $('retry-save').disabled=true;
  status(e.message);
 }
}
function bind(form,handler){
 $(form).addEventListener('submit',async ev=>{
  ev.preventDefault();
  const btn=ev.target.querySelector('button[type=submit]');
  if(btn.disabled)return;
  btn.disabled=true;
  try{await handler();status('기록이 서버에 반영되고 화면을 다시 불러왔습니다.')}
  catch(e){status(e.message)}
  finally{btn.disabled=false}
 });
}
if(parent){
 bind('register-form',async()=>{
  await api('parent/register',{problemText:$('problem-input').value.trim()});
  await parentLoad();
 });
 bind('observe-form',async()=>{
  if(!attempts.length)throw Error('먼저 아이의 재풀이가 필요합니다.');
  await api('parent/observe',{
   attemptId:$('attempt-select').value,expectedRevision:revision,
   requestId:uid(),status:$('observation-status').value,
   note:$('observation-note').value
  });
  $('observation-note').value='';
  await parentLoad();
 });
 parentLoad().catch(e=>status(e.message));
}else{
 bind('retry-form',async()=>{
  await api('child/retry',{expectedRevision:revision,requestId:uid(),
   answer:$('retry-answer').value.trim(),explanation:$('retry-explanation').value.trim()});
  $('retry-answer').value='';$('retry-explanation').value='';
  await childLoad();
 });
 childLoad().catch(e=>status(e.message));
}
