// WRONG QA65: actual parent QA9 first-action source vs P17 strict time guard.
// Synthetic in-memory records, original app source execution, no storage writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function slice(a,b){const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'source missing: '+a);return html.slice(start,end)}
const time=slice('function wrongParentTimeIssue(raw,nowMs=Date.now()){','function wrongParentTimeIssueEntries(');
const next=slice('function qa9RenderOneAction(){','const qa9PreviousRenderHome=renderHome;');
assert.match(next,/wrongParentTimeIssue\(attempt\.at,now\)===null/);
assert.match(next,/wrongParentTimeIssue\(attempt\.at\)!==null/);
assert.doesNotMatch(next,/Number\.isFinite\(stamp\)/);
let checks=0;const pass=x=>{checks++;console.log('PASS WRONG QA65 '+x)};
const day=86400000,date=d=>new Date(Date.now()+d).toISOString();
const attempt=at=>({at,answer:'가상 답',explanation:'아이 설명',review:'not_checked'});
const rec=(id,created,at)=>({id,createdAt:created,problemText:'가상 오답 '+id,
 generalRetryHistory:[attempt(at)],checkHistory:[],hasPhoto:false,studyPlan:null});
const rows=[
 rec('impossible',date(-1000),'2026-02-30T08:00:00Z'),
 rec('future',date(-2000),date(day)),
 rec('valid',date(-3000),date(-day))
];
const preserved=JSON.stringify(rows);
function rig(input=rows,{child=false}={}){
 const button={dataset:{},textContent:'',onclick:null,
  removeAttribute(name){if(name==='data-record')delete this.dataset.record}};
 const desc={textContent:''};
 const card={classList:{add(){this.hidden=true},remove(){this.hidden=false}}};
 const nodes={'qa9-next-action':card,'qa9-next-desc':desc,'qa9-next-open':button};
 const events={stop:0,nav:[],notices:[]};
 const $=id=>nodes[id]||null;
 const run=new Function('p',[
  'const records=p.rows,$=p.$;',
  'const localToday=()=>new Date().toISOString().slice(0,10);',
  "const wrongDevDueDateReached=()=>false;",
  'const requestAnimationFrame=cb=>cb();',
  'const notify=t=>p.events.notices.push(t);',
  'const document={body:{classList:{contains:x=>p.child}}};',
  'let route="home",detailId=null,v218Mode=p.child?"child":"parent";',
  'const navigate=routeName=>{route=routeName;p.events.nav.push(routeName)};',
  time,next,
  'return {render:qa9RenderOneAction,getDetail:()=>detailId};'
 ].join('\n'))({rows:input,$,events,child});
 return {...run,button,desc,events,rows:input};
}
const x=rig();x.render();
assert.equal(x.button.dataset.record,'valid');
assert.match(x.button.textContent,/아이 설명 보고 부모가 관찰하기/);
pass('invalid calendar and future attempt cannot outrank latest genuine pending child explanation');
assert.notEqual(x.button.dataset.record,'impossible');
pass('Date.parse rollover case 2026-02-30 does not become actionable');
x.rows.find(r=>r.id==='valid').generalRetryHistory.at(-1).at='2026-02-30T08:00:00Z';
let stopped=false;await x.button.onclick({stopPropagation(){stopped=true}});
assert.equal(stopped,true);assert.deepEqual(x.events.nav,[]);
assert.notEqual(x.button.dataset.record,'valid');
pass('saved record changed before click: stale invalid timestamp stops navigation and refreshes CTA');
const y=rig([rec('only-bad',date(-1000),'2026-02-30T08:00:00Z')]);y.render();
assert.match(y.button.textContent,/최근 오답 학습 이어가기/);
assert.equal(y.button.onclick,null);
pass('invalid-only case falls back to existing recent record, no parent-review CTA');
const f=rig([rec('only-future',date(-1000),date(day))]);f.render();
assert.match(f.button.textContent,/최근 오답 학습/);
pass('future-only retry never becomes current parent observation task');
const old=rig([rec('reviewed',date(-1000),date(-day))]);
old.rows[0].generalRetryHistory[0].review='explained';old.rows[0].generalRetryHistory[0].reviewedAt=date(-day);
old.render();assert.match(old.button.textContent,/최근 오답 학습/);
pass('already-reviewed retry never becomes parent pending task');
const photo=rig([{...rec('photo',date(-1000),'2026-02-30T08:00:00Z'),hasPhoto:true,problemText:''}]);
photo.render();assert.match(photo.button.textContent,/사진 기록 이어서 정리하기/);
pass('original photo-only fallback priority remains');
const ocr=rig([{...rec('ocr',date(-1000),'2026-02-30T08:00:00Z'),ocrStatus:'browser_ocr_unconfirmed'}]);
ocr.render();assert.match(ocr.button.textContent,/OCR 기록 검토하기/);
pass('original OCR fallback priority remains');
const child=rig(rows,{child:true});child.render();
assert.match(child.button.textContent,/최근 오답 학습/);
pass('parent helper never elevates invalid child attempt in child mode');
assert.doesNotMatch(next,/indexedDB|v20SaveMistakeGuarded|localStorage\.setItem|fetch\(/);
assert.equal(JSON.stringify(rows.slice(0,2)),JSON.stringify(JSON.parse(preserved).slice(0,2)));
pass('source is navigation-only and does not modify unrelated saved records');
console.log('WRONG_QA65_NODE_RESULT='+JSON.stringify({status:'PASS',checks,
 type:'actual parent QA9 source + calendar validation Node22',writes:0,
 realChildren:0,safeToRestore:false,deployed:false}));
