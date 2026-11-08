/* Parent-facing curriculum record index; ONLY exact standard codes/text, no semester mapping. */
(function(){
'use strict';
var bandSel=document.getElementById('math-band'),areaSel=document.getElementById('math-domain');
var query=document.getElementById('math-search'),reset=document.getElementById('math-reset');
var count=document.getElementById('math-count'),results=document.getElementById('math-results');
var domainNames={'01':'수와 연산','02':'변화와 관계','03':'도형과 측정','04':'자료와 가능성'};
var gradeNames={'2':'1~2학년군','4':'3~4학년군','6':'5~6학년군'};
var all=[],parentGuides=new Map();
/* Verifies the entire 121-record code/text corpus before any content is shown.
 * This pins to user-provided annex-8 PDF-derived reference, NOT a claim of live NCIC binary equivalence.
 */
var MATH121_SHA256='73d1b6aaf6001ae3ce39dc2323b54e64576558b761d2addb041bfa859bb68858';
async function verify121(data){
 if(!data||!Array.isArray(data.standards)||data.standards.length!==121)throw Error('원문 121개 범위 불일치');
 if(!crypto||!crypto.subtle||!TextEncoder)throw Error('안전한 원문 검증을 지원하지 않는 브라우저');
 var ordered=data.standards.slice().sort(function(a,b){return a.code<b.code?-1:a.code>b.code?1:0});
 var joined=ordered.map(function(x){return x.code+'\0'+x.text+'\n'}).join('');
 var bytes=new TextEncoder().encode(joined);
 var hashed=await crypto.subtle.digest('SHA-256',bytes);
 var sha=Array.from(new Uint8Array(hashed)).map(function(x){return x.toString(16).padStart(2,'0')}).join('');
 if(sha!==MATH121_SHA256)throw Error('저장된 공식 성취기준 원문이 검증 기준과 다릅니다');
 return data;
}

function el(t,cls,value){var node=document.createElement(t);if(cls)node.className=cls;if(value!==undefined)node.textContent=String(value);return node}
function parse(data){
 if(!data||!Array.isArray(data.standards))throw Error('수학 교육과정 데이터 형식 오류');
 var seen=new Map();
 data.standards.forEach(function(st){
   var code=String(st.code||''),text=String(st.text||'');
   var match=/^\[([246])수(0[1-4])-(\d{2})\]$/.exec(code);
   if(!match||!text.trim())throw Error('성취기준 코드·내용 누락 '+code);
   if(seen.has(code)){
    if(seen.get(code).text!==text)throw Error('동일 코드의 원문 불일치 '+code);
   }else seen.set(code,{code:code,text:text,band:match[1],domain:match[2],status:String(st.status||'부분 검증')});
 });
 var list=Array.from(seen.values()).sort(function(a,b){return a.code.localeCompare(b.code,'ko')});
 var bands={'2':0,'4':0,'6':0},domains={'01':0,'02':0,'03':0,'04':0};
 list.forEach(function(x){bands[x.band]++;domains[x.domain]++});
 if(list.length!==121||bands['2']!==29||bands['4']!==47||bands['6']!==45
 ||domains['01']!==42||domains['02']!==10||domains['03']!==57||domains['04']!==12){
  throw Error('기대된 수학 121개 데이터와 다른 범위입니다. 공식 자료를 다시 대조하세요.');
 }
 return list
}
function paint(){
 var b=bandSel.value,a=areaSel.value,q=query.value.replace(/[\[\]\s]/g,'').toLowerCase();
 var filtered=all.filter(function(x){
  return(!b||b===x.band)&&(!a||a===x.domain)&&(!q||(x.code.replace(/[\[\]\s]/g,'').toLowerCase().includes(q)||x.text.replace(/\s/g,'').toLowerCase().includes(q)))
 });
 count.textContent='전체 121개 중 '+filtered.length+'개 표시'+(q?' · 검색어: '+query.value:'');
 results.replaceChildren();
 if(!filtered.length){results.append(el('p','empty','검색 결과가 없습니다. 학년군·영역·검색어를 바꾸어 보세요.'));return}
 filtered.forEach(function(x){
  var card=el('article','std-card'),meta=el('p','meta');
  meta.append(el('span','grade',gradeNames[x.band]),document.createTextNode(' · '+domainNames[x.domain]));
  card.append(meta,el('h3','code',x.code),el('p','standard-text',x.text),el('p','meta','출처: 교육부 수학과 [별책 8] · NCIC 공식원문 코드별 정밀대조 121/121 (2026-11-08) · 전체 G41 부분 검증'));
  var g=parentGuides.get(x.code);
  if(g){
    var box=el('section','parent-guide');
    box.append(el('h4','','부모용 쉬운 설명 · AI 작성(교사 검토 전)'),el('p','',g.explanation_ai),el('p','', '생활 예시: '+g.life_example_ai));
    var details=el('details','parent-activity'),sum=el('summary','','아이에게 물어볼 질문·예상 답변 보기');
    details.append(sum,el('p','','질문: '+g.question_ai),el('p','','부모 참고 답변: '+g.expected_response_ai),el('p','','관찰: '+g.observe_ai));
    box.append(details,el('p','meta','공식 진단·학년별 교과서 배치·교사 검수 완료 자료가 아닙니다.'));
    card.append(box);
  }
  results.append(card)
 })
}
function failed(){count.textContent='성취기준 자료를 불러오거나 검증하지 못했습니다.';results.replaceChildren(el('p','load-error','데이터를 확인할 수 없어요. 이 화면에서 누락된 내용을 추정해 보여 주지 않습니다.'))}
[bandSel,areaSel].forEach(function(x){x.addEventListener('change',paint)});
query.addEventListener('input',paint);
reset.addEventListener('click',function(){bandSel.value='';areaSel.value='';query.value='';paint();query.focus()});

function verifyParentGuides(p){
 if(!p||!Array.isArray(p.guides)||p.guides.length!==121||p.official_code_text_sha256!==MATH121_SHA256)throw Error('학부모 콘텐츠 출처·범위 검증 실패');
 var codes=new Set(all.map(x=>x.code)),seen=new Set(),result=new Map();
 for(const g of p.guides){
  if(!codes.has(g.code)||seen.has(g.code)||g.provenance!=='AI 작성 학부모 콘텐츠'||g.review_status!=='교사 검토 전 · 학습 효과 미검증')throw Error('연결 코드·작성주체 불일치');
  for(const key of ['concept_label_ai','explanation_ai','life_example_ai','question_ai','expected_response_ai','observe_ai']){
   if(typeof g[key]!=='string'||g[key].length<1||g[key].length>420)throw Error('부모콘텐츠 형식 오류');
  }
  seen.add(g.code);result.set(g.code,g);
 }
 if(result.size!==121)throw Error('일부 학부모 콘텐츠 누락');
 return result;
}

function fetchPinnedGuide(){return fetch('./data/math_parent_guides_121_v1.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('AI JSON HTTP '+r.status);return r.text()}).then(async text=>{const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const got=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');if(got!=='617e19d6bb00d24eac55b0a9bbf5fc08e4e3bc4100468ae10ac463e26da1321e')throw Error('AI 가이드 무결성 오류');return JSON.parse(text);});}

fetch('./data/math_standards_121_v1.json',{cache:'no-cache'})
.then(function(r){if(!r.ok)throw Error('data HTTP '+r.status);return r.json()})
.then(verify121)
.then(function(data){all=parse(data);return fetchPinnedGuide().then(function(p){parentGuides=verifyParentGuides(p);paint()})})
.catch(function(){failed()});
})();