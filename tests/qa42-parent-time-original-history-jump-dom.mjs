// QA42: new selected parent-only jump from timestamp warning to the EXACT
// saved checkHistory/generalRetryHistory entry, even before the last 8 retries.
// Executes the product's actual source functions with synthetic Node DOM only.
// No old suite replay, real children, IndexedDB writes, uploads or deployment.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
let n=0;const pass=s=>{n++;console.log('PASS WRONG QA42 DATE HISTORY JUMP DOM',s)};
function slice(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'source missing: '+start);return html.slice(a,b);
}
const historySource=slice('function v230HistoryPanel(parent,r){','// QA11: read-only concept mini-map');
const linkSource=slice('  // WRONG-QA41: identify WHICH stored timestamp needs a parent',
 '  // WRONG-A-ONLY-INAPP-BACK:');
class Node{
 constructor(tag,css='',text=''){
  this.tag=tag;this.className=css||'';this.textContent=String(text||'');
  this.children=[];this.parentElement=null;this.id='';
  this.tabIndex=0;this.open=false;this.type='';this.focused=0;
  this.scrolled=0;this.attrs={};this.onclick=null;
  this.classList={
   contains:v=>this.className.split(/\s+/).includes(v),
   add:v=>{if(!this.classList.contains(v))this.className=(this.className+' '+v).trim()}
  };
 }
 append(...nodes){for(const x of nodes){x.parentElement=this;this.children.push(x)}}
 prepend(...nodes){for(const x of nodes){x.parentElement=this;this.children.unshift(x)}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 setAttribute(k,v){this.attrs[k]=v}
 focus(){this.focused++}
 scrollIntoView(){this.scrolled++}
 closest(tag){let x=this.parentElement;while(x){if(x.tag===tag)return x;x=x.parentElement}return null}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this)}
}
const make=(tag,cls,txt)=>new Node(tag,cls,txt);
const now=Date.now(),day=86400000,at=x=>new Date(now+x).toISOString();
const date=s=>Number.isFinite(Date.parse(s))?new Date(s).toLocaleDateString('ko-KR'):'날짜 없음';
const manual=c=>c?.by==='manual_due_date'||c?.manualDate===true;
function create(record,opts={}){
 const area=make('section');area.id='detail-card';
 const records=record?[record]:[],requestedId='qa-record';
 let detailId=requestedId,route=opts.route||'detail',v218Mode=opts.mode||'parent';
 const find=(root,id)=>{
  if(root.id===id)return root;
  for(const c of root.children){const r=find(c,id);if(r)return r}
  return null;
 };
 const $=id=>find(area,id);
 let history=()=>{throw Error('source history not available')};
 const previous=async()=>{
  area.replaceChildren();
  const checklist=make('div');checklist.id='check-history';area.append(checklist);
  for(const c of [...(record?.checkHistory||[])].reverse()){
   const row=make('div','tagline');
   row.append(make('strong',null,'원본 학부모 확인: '+(c.memo||'')));
   checklist.append(row);
  }
  const generic=make('section');generic.id='generic-retry-section';
  area.append(generic);
  if(record)history(generic,record);
 };
 const funcs=new Function('make','$','wrong008ManualDate','records','detailId',
  'route','renderDetail','v218Mode','date','v230ExplanationCompare',
  historySource+'\n'+linkSource+
  '\nreturn {history:v230HistoryPanel,render:renderDetail,oldItems:wrongParentTimeIssueItems,items:wrongParentTimeIssueEntries};'
 )(make,$,manual,records,detailId,route,previous,v218Mode,date,()=>{});
 history=funcs.history;
 return {funcs,area,$,setMode(v){v218Mode=v},getMode(){return v218Mode}};
}
const synthetic={
 id:'qa-record',hasPhoto:true,problemText:'가상 아이 사진 문제',
 checkHistory:[
  {status:'needs_help',at:'not-a-time',memo:'부모 관찰 첫 기록'},
  {status:'explained',at:at(-day*2),memo:'두 번째 관찰'},
  {status:'not_checked',at:'bad-due',by:'manual_due_date',memo:'수동 예정일'}
 ],
 generalRetryHistory:Array.from({length:11},(_,i)=>({
  at:i===0?'not-a-time':at(-(12-i)*day),
  review:i===2?'needs_help':'not_checked',
  ...(i===2?{reviewedAt:'2026-02-30T13:30:00.000Z'}:{}),
  answer:'저장된 원본 답 '+i,explanation:'원본 아이가 쓴 설명 '+i
 }))
};
const unchanged=JSON.stringify(synthetic),env=create(synthetic);
assert.deepEqual(env.funcs.oldItems(synthetic),[
 '학부모 관찰 1번째: 시각 형식 확인 불가',
 '아이 재풀이 1번째 기록일: 시각 형식 확인 불가',
 '재풀이 3번째의 학부모 확인일: 저장된 날짜·시각 확인 불가'
]);
assert.deepEqual(env.funcs.items(synthetic).map(x=>[x.type,x.index]),
 [['check',0],['retry',0],['retry',2]]);
pass('기존 한글 오류 안내 그대로 보존·원본 check/retry 인덱스 별도 추적');
await env.funcs.render();
const warning=env.$('wrong-parent-time-review');
assert.ok(warning&&warning.className.includes('v218-parent-only'));
const buttons=warning.children.filter(x=>x.tag==='button');
assert.equal(buttons.length,3);
assert.ok(buttons.every(x=>x.type==='button'&&x.className.includes('wrong-parent-time-jump')));
assert.equal(JSON.stringify(synthetic),unchanged);
pass('상세 부모 전용 경고마다 원본 이력 보기 버튼 1개, 사진·관찰·설명 무변경');
const check=env.$('wrong-parent-time-check-0');
assert.ok(check&&check.textContent===''&&check.children[0].textContent.includes('첫 기록'));
assert.equal(check.tabIndex,-1);
buttons[0].onclick();
assert.equal(check.scrolled,1);assert.equal(check.focused,1);
assert.ok(warning.children.at(-1).textContent.includes('수정하지 않았습니다'));
pass('첫 학부모 관찰 항목 누르면 역순 렌더된 실제 첫 checkHistory 행에 초점·스크롤');
const generic=env.$('generic-retry-section');
const details=generic.children.find(x=>x.tag==='details');
assert.ok(details&&details.open===false);
const target0=env.$('wrong-parent-time-retry-0'),target2=env.$('wrong-parent-time-retry-2');
assert.ok(target0&&target2,'old invalid entries before last eight must be rendered');
assert.ok(target0.className.includes('v218-parent-only'));
assert.ok(target2.className.includes('v218-parent-only'));
assert.ok(target0.children.some(x=>x.textContent.includes('저장된 원본 답 0')));
buttons[1].onclick();
assert.equal(details.open,true);
assert.equal(target0.scrolled,1);assert.equal(target0.focused,1);
assert.equal(target0.closest('details'),details);
pass('최근 8회보다 오래된 오류 재풀이도 기존 history details를 열고 정확한 원본 행으로 이동');
details.open=false;
buttons[2].onclick();
assert.equal(details.open,true);assert.equal(target2.focused,1);
assert.ok(target2.children.some(x=>x.textContent.includes('원본 아이가 쓴 설명 2')));
pass('학부모 reviewedAt 오류는 아이 at으로 대체하지 않고 동일 재풀이의 원본 이력으로 이동');
assert.equal(generic.children.length,1);
assert.equal(details.children.filter(x=>x.className.includes('v230-attempt')).length,10);
assert.ok(details.children.at(-1).textContent.includes('최근 8회'));
assert.equal(JSON.stringify(synthetic),unchanged);
pass('기존 최근 8회와 날짜 오류 2회만 읽기 표기, 원래 11회 배열·사진 원본 보존');
assert.ok(html.includes('.wrong-parent-time-history-row:focus'));
assert.ok(html.includes('.wrong-parent-time-jump{display:block;width:100%'));
pass('휴대폰/키보드 포커스용 44px 버튼·원본 행 강조·가로 내용 줄바꿈 계약');
const valid={
 id:'qa-record',checkHistory:[{status:'needs_help',at:at(-day),memo:'정상 관찰'}],
 generalRetryHistory:[{at:at(-day*2),review:'explained',reviewedAt:at(-day),answer:'정상 답',explanation:'정상 설명'}]
};
const ok=create(valid);await ok.funcs.render();
assert.equal(ok.$('wrong-parent-time-review'),null);
pass('문제 없는 원본에는 경고·임의 링크 생성하지 않음');
const home=create(synthetic,{route:'home'});await home.funcs.render();
assert.equal(home.$('wrong-parent-time-review'),null);
pass('상세 화면 외에서는 원본 날짜 확인 링크를 생성하지 않음');
const child=create(synthetic,{mode:'child'});await child.funcs.render();
const childLinks=child.$('wrong-parent-time-review').children.filter(x=>x.tag==='button');
const childTarget=child.$('wrong-parent-time-check-0');
childLinks[0].onclick();
assert.equal(childTarget.focused,0);assert.equal(childTarget.scrolled,0);
assert.ok(child.$('wrong-parent-time-review').className.includes('v218-parent-only'));
pass('아이 보기 모드에는 부모 버튼이 가려지고 실행하더라도 원본 기록으로 이동하지 않음');
assert.ok(!linkSource.includes('writeOne(')&&!linkSource.includes('fetch('));
assert.ok(!linkSource.includes('indexedDB')&&!linkSource.includes('localStorage.setItem('));
assert.equal(JSON.stringify(synthetic),unchanged);
pass('신규 원본 바로가기는 영속 기록 수정·서버 POST·백업 변경 없음');
console.log('WRONG_QA42_PARENT_HISTORY_JUMP_RESULT='+JSON.stringify({
 status:'PASS',checks:n,realProductFunctions:true,syntheticNodeDOM:true,
 oldHistoryAnchors:true,parentOnly:true,originalPhotosAndRecordsIntact:true,
 writeCalls:0,realChromium:false,realFamilyAuth:false,safeToRestore:false,deployed:false}));
