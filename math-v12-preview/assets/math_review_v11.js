/* v0.70. Only code/text from the clean 121 standards. Parent judgement, not official tests. */
(function(){
'use strict';
const GRADE_LABEL={'2':'1~2','4':'3~4','6':'5~6'};
const STORE='uriai-math-review-v069', EXPECT={'2':29,'4':47,'6':45}, AREAS={'01':42,'02':10,'03':57,'04':12};
const sel=document.getElementById('review-band'),start=document.getElementById('review-start'),holder=document.getElementById('review-items'),status=document.getElementById('review-status'),summary=document.getElementById('review-summary'),needs=document.getElementById('review-needs'),clear=document.getElementById('review-clear'),confirm=document.getElementById('review-confirm');
let standards=[],current=[],band='2',state={},persist=true,guides=new Map(),history={};
const HIST_STORE='uriai-math-review-history-v11',focusSel=document.getElementById('review-focus'),histBox=document.getElementById('review-history'),histStatus=document.getElementById('review-history-status');
/* v0.71 second-source safety: no content displayed before SHA-256 verification. */
const MATH121_SHA256='73d1b6aaf6001ae3ce39dc2323b54e64576558b761d2addb041bfa859bb68858';
async function verify121(data){
 if(!data||!Array.isArray(data.standards)||data.standards.length!==121)throw Error('기준 원문 121개 확인 실패');
 if(!crypto||!crypto.subtle||!TextEncoder)throw Error('안전한 원문 검증 미지원');
 const ordered=data.standards.slice().sort((a,b)=>a.code<b.code?-1:a.code>b.code?1:0);
 const bytes=new TextEncoder().encode(ordered.map(x=>x.code+'\0'+x.text+'\n').join(''));
 const hashed=await crypto.subtle.digest('SHA-256',bytes);
 const sha=Array.from(new Uint8Array(hashed)).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(sha!==MATH121_SHA256)throw Error('공식 성취기준 원문 변조 또는 변경 검출');
 return data;
}

function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n}
function day(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
/* Only retain valid local observations. Corrupt storage must never impersonate learning progress. */
function safeRecord(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||!Number.isInteger(x.count)||x.count<0||x.count>9)return null;
 if(typeof x.lastDay!=='string'||(x.lastDay!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(x.lastDay)))return null;
 if(typeof x.lastStatus!=='string'||!['','good','unsure','no'].includes(x.lastStatus))return null;
 return {count:x.count,lastDay:x.lastDay,lastStatus:x.lastStatus};
}
function read(){
 try{
  const x=JSON.parse(localStorage.getItem(STORE)||'{}');
  if(!x||typeof x!=='object'||Array.isArray(x))return{};
  const safe={};
  for(const [key,item] of Object.entries(x)){
   if(!/^[246]:\[[246]수0[1-4]-\d{2}\]$/.test(key)||key[0]!==key[3])continue;
   const row=safeRecord(item);if(row)safe[key]=row;
  }
  return safe;
 }catch(e){return{}}
}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));persist=true}catch(e){persist=false} }
function allRecords(data){
 if(!data||!Array.isArray(data.standards)||data.standards.length!==121)throw Error('기준 121개 원본이 아닙니다');
 const codes=new Set(),b={'2':0,'4':0,'6':0},a={'01':0,'02':0,'03':0,'04':0};
 for(const x of data.standards){
  const match=/^\[([246])수(0[1-4])-\d{2}\]$/.exec(x.code||'');
  if(!match||!x.text||!String(x.text).trim()||codes.has(x.code)||Object.keys(x).join(',')!=='code,text')throw Error('코드·원문 형식이 다릅니다');
  codes.add(x.code);b[match[1]]++;a[match[2]]++;
 }
 if(Object.keys(EXPECT).some(x=>b[x]!==EXPECT[x])||Object.keys(AREAS).some(x=>a[x]!==AREAS[x]))throw Error('학년군·영역 수량이 다릅니다');
 return data.standards.slice().sort((x,y)=>x.code.localeCompare(y.code,'ko'));
}

function cleanHistory(){
 let raw={};try{raw=JSON.parse(localStorage.getItem(HIST_STORE)||'{}')}catch(e){return{}}
 if(!raw||Array.isArray(raw)||typeof raw!=='object')return{};
 const valid=new Set(standards.map(x=>x.code)),safe={};
 for(const [code,records] of Object.entries(raw)){
  if(!valid.has(code)||!Array.isArray(records))continue;
  const recent=records.filter(x=>x&&typeof x==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(x.day)&&['good','unsure','no'].includes(x.status)).slice(-30);
  if(recent.length)safe[code]=recent;
 }
 return safe;
}
function saveHistory(code,statusValue,when){
 if(!standards.some(x=>x.code===code))return;
 let a=Array.isArray(history[code])?history[code]:[];
 a=a.filter(x=>x.day!==when);a.push({day:when,status:statusValue});history[code]=a.slice(-30);
 try{localStorage.setItem(HIST_STORE,JSON.stringify(history))}catch(e){persist=false}
}
function renderHistory(){
 histBox.replaceChildren();
 const allowed=new Set(standards.filter(x=>x.code[1]===sel.value).map(x=>x.code));
 const entries=Object.entries(history).filter(([code,v])=>allowed.has(code)&&Array.isArray(v)&&v.length)
  .map(([code,v])=>({code,day:v[v.length-1].day,status:v[v.length-1].status,count:v.length}))
  .sort((a,b)=>b.day.localeCompare(a.day)).slice(0,12);
 histStatus.textContent='이 학년군에서 날짜별 관찰한 기준 '+entries.length+'개 (최근 최대 12개 표시)';
 if(!entries.length){histBox.append(node('p','help','아직 관찰 날짜가 없습니다. 먼저 개념 대화를 시작해 보세요.'));return}
 for(const item of entries){
  const row=node('div','history-row');
  const button=node('button','history-revisit',item.code+' 다시 확인');
  button.type='button';button.addEventListener('click',()=>{
   focusSel.value=item.code;sel.value=item.code[1];start.click();histBox.scrollIntoView({block:'nearest'});
  });
  row.append(button,node('span','','마지막 '+item.day+' · '+({good:'스스로 설명',unsure:'헷갈림',no:'어려움'}[item.status])+' · 관찰한 날 '+item.count+'일 (점수·레벨 아님)'));
  histBox.append(row);
 }
}
function fillFocus(){
 const previous=focusSel.value;
 focusSel.replaceChildren();
 const initial=node('option','','영역을 섞어 5개 예시 제안');initial.value='';focusSel.append(initial);
 for(const row of standards.filter(x=>x.code[1]===sel.value)){const option=node('option','',row.code+' '+row.text.slice(0,24));option.value=row.code;focusSel.append(option)}
 if(standards.some(x=>x.code===previous&&x.code[1]===sel.value))focusSel.value=previous;
 focusSel.disabled=false;renderHistory();
}
function validateGuides(p){
 if(!p||!Array.isArray(p.guides)||p.guides.length!==121||p.official_code_text_sha256!==MATH121_SHA256)throw Error('AI 질문 원문 연결 범위 오류');
 const codes=new Set(standards.map(x=>x.code));const result=new Map();
 for(const g of p.guides){
  if(!codes.has(g.code)||result.has(g.code)||g.provenance!=='AI 작성 학부모 콘텐츠'||g.review_status!=='교사 검토 전 · 학습 효과 미검증')throw Error('코드 연결/AI 출처 오류');
  for(const k of ['explanation_ai','life_example_ai','question_ai','expected_response_ai','observe_ai'])
   if(typeof g[k]!=='string'||g[k].length<1||g[k].length>420)throw Error('AI 안내 형식 오류');
  result.set(g.code,g);
 }
 if(result.size!==121)throw Error('AI 안내 데이터 일부 누락');
 return result;
}
function pick(b){
 const by={};
 standards.filter(x=>x.code[1]===b).forEach(x=>{const a=x.code.slice(3,5);(by[a]||(by[a]=[])).push(x)});
 // Deterministic round-robin across available domains; these 5 are NOT representative official diagnostics.
 const out=[],order=['01','02','03','04'];let i=0;
 while(out.length<5){
  let added=false;
  for(const area of order){const a=by[area]||[];if(a[i]){out.push(a[i]);added=true;if(out.length===5)break}}
  if(!added)throw Error('점검 기준을 고를 수 없습니다');i++;
 }
 const selected=focusSel.value;
 if(selected&&selected[1]===b&&standards.some(x=>x.code===selected))return [standards.find(x=>x.code===selected),...out.filter(x=>x.code!==selected).slice(0,4)];
 return out;
}
function value(x){const k=band+':'+x.code;const item=state[k];return item&&typeof item==='object'?item:{count:0,lastDay:'',lastStatus:''}}
function draw(focusCode,focusAnswer){
 holder.replaceChildren();
 for(const x of current){
  const card=node('article','review-card');card.id='review-'+x.code.replace(/[\[\]]/g,'');
  card.dataset.code=x.code;
  const heading=node('h3','',x.code);heading.id=card.id+'-title';card.setAttribute('aria-labelledby',heading.id);
  const g=guides.get(x.code);
  card.append(heading,node('p','review-official','공식 수학과 성취기준 원문: '+x.text),
    node('p','review-ai','AI 작성 쉬운 설명(교사 검토 전): '+g.explanation_ai),
    node('p','review-ai','생활 예시: '+g.life_example_ai),
    node('p','review-ai','AI 작성 개념 확인 질문: '+g.question_ai));
  const answerBox=node('details','expected-answer');answerBox.append(node('summary','','부모용 예상 답변·관찰 방법 보기'),
    node('p','','참고 답변: '+g.expected_response_ai),node('p','','관찰 포인트: '+g.observe_ai),
    node('p','','다음 확인 활동: '+g.revisit_ai));
  card.append(answerBox);
  const buttons=node('div','review-actions');buttons.setAttribute('role','group');buttons.setAttribute('aria-label',x.code+' 부모 관찰 선택');
  for(const [value,label] of [['good','스스로 설명해요'],['unsure','조금 헷갈려요'],['no','아직 어려워요']]){
   const btn=node('button','',label);btn.type='button';btn.dataset.answer=value;btn.setAttribute('aria-pressed',String(value===valueFor(x)));
   btn.addEventListener('click',()=>answer(x,value));
   buttons.append(btn)
  }
  const p=value(x),progress=node('span','review-stage','비공식 연습 단계(서로 다른 날 기준): '+p.count+'/9회 · '+(p.lastStatus?'마지막 관찰: '+({good:'설명했음',unsure:'헷갈림',no:'어려움'}[p.lastStatus]||'미확인'):'아직 미응답'));
  card.append(buttons,progress);holder.append(card)
 }
 paint();
 if(focusCode){const target=Array.from(holder.querySelectorAll('.review-card')).find(c=>c.dataset.code===focusCode);const button=target&&target.querySelector('button[data-answer="'+focusAnswer+'"]');if(button)button.focus({preventScroll:true})}
}
function valueFor(x){return value(x).lastStatus}
function answer(x,answer){
 const key=band+':'+x.code;const old=value(x),d=day();
 if(old.lastDay!==d){
  old.count=Math.max(0,Math.min(9,(Number(old.count)||0)+(answer==='good'?1:-2)));
  old.lastDay=d;
 }
 old.lastStatus=answer;
 state[key]=old;save();saveHistory(x.code,answer,d);draw(x.code,answer);renderHistory();
 status.textContent='선택한 '+GRADE_LABEL[band]+'학년군 · 관찰 응답이 반영됐습니다. 같은 날 다시 누르면 연습 단계 횟수는 바뀌지 않습니다.'+(persist?'':' 브라우저 저장 불가: 현재 화면에서만 유지');
}
function paint(){
 const answered=current.filter(x=>!!value(x).lastStatus);
 const weak=current.filter(x=>['unsure','no'].includes(value(x).lastStatus));
 summary.textContent='5개 중 '+answered.length+'개 관찰 · 다시 확인할 기준 '+weak.length+'개. '+(answered.length===5?'5개 질문 관찰을 마쳤습니다. 실제 소요시간은 개인마다 다릅니다.':'나머지 질문도 이야기해 보세요.');
 needs.replaceChildren();
 if(!weak.length){needs.append(node('p','review-good','현재 다시 확인 목록이 없습니다. 정답 또는 공식 학습 수준을 판정한 것은 아닙니다.'));return}
 for(const x of weak){
  const row=node('p','');const a=node('a','',x.code+' 기준 다시 보기');a.href='#review-'+x.code.replace(/[\[\]]/g,'');
  row.append(a,node('span','',' · 아이가 설명하기 어려워한 부분을 부모와 다시 이야기하세요.'));needs.append(row)
 }
}
sel.addEventListener('change',fillFocus);
start.addEventListener('click',()=>{if(!standards.length||guides.size!==121){status.textContent='공식 원문과 AI 안내를 아직 검증하지 못했습니다';return}band=sel.value;current=pick(band);draw();status.textContent=GRADE_LABEL[band]+'학년군 예시 5개를 불러왔습니다. 공식 학년·학기 진단이 아닙니다.';const first=holder.querySelector('.review-card h3');if(first){first.tabIndex=-1;first.focus({preventScroll:true})}holder.scrollIntoView({block:'nearest'})});
clear.addEventListener('click',()=>{confirm.hidden=false;document.getElementById('review-clear-no').focus()});
document.getElementById('review-clear-no').addEventListener('click',()=>{confirm.hidden=true;clear.focus()});
document.getElementById('review-clear-yes').addEventListener('click',()=>{state={};history={};try{localStorage.removeItem(STORE);localStorage.removeItem(HIST_STORE);persist=true}catch(e){persist=false}confirm.hidden=true;if(current.length)draw();renderHistory();status.textContent='이 내부 점검 기록을 지웠습니다. 다른 학습기록에는 영향을 주지 않습니다.';clear.focus()});
function fetchPinnedGuide(){return fetch('./data/math_parent_guides_121_v1.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('AI JSON HTTP '+r.status);return r.text()}).then(async text=>{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const got=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');if(got!=='617e19d6bb00d24eac55b0a9bbf5fc08e4e3bc4100468ae10ac463e26da1321e')throw Error('AI 가이드 무결성 오류');return JSON.parse(text);});}

state=read();
renderHistory();
fetch('./data/math_standards_121_v1.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(verify121).then(data=>{standards=allRecords(data);return fetchPinnedGuide().then(p=>{guides=validateGuides(p);history=cleanHistory();fillFocus();start.disabled=false;status.textContent='공식 수학과 성취기준 121개와 AI 질문 121개를 구분해 확인했습니다. 학년군을 선택하세요.'})}).catch(()=>{status.textContent='성취기준 원본의 정확성을 확인하지 못해 점검을 시작할 수 없습니다.';start.disabled=true});
})();
