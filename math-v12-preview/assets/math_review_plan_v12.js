/* v1.2 supplementary client-side review scheduler: reads only v1.1 local observation history. */
(()=>{
'use strict';
const box=document.getElementById('review-plan'),status=document.getElementById('review-plan-status');
const band=document.getElementById('review-band'),focus=document.getElementById('review-focus'),start=document.getElementById('review-start');
const HIST_KEY='uriai-math-review-history-v11',DELAYS={no:1,unsure:2,good:7};
const label={no:'아직 어려움',unsure:'조금 헷갈림',good:'스스로 설명'};
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;}
function isoDate(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
 const dt=new Date(s+'T12:00:00Z');
 return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===s?dt:null;
}
function today(){
 const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function addDays(s,n){const d=isoDate(s);if(!d)return null;return new Date(d.getTime()+n*86400000).toISOString().slice(0,10);}
function daysBetween(a,b){return Math.round((isoDate(b)-isoDate(a))/86400000);}
function read(){
 try{const x=JSON.parse(localStorage.getItem(HIST_KEY)||'{}');return x&&!Array.isArray(x)&&typeof x==='object'?x:{};}catch(e){return{};}
}
function calculate(){
 const now=today(),rows=[];
 for(const [code,history] of Object.entries(read())){
  if(!/^\[[246]수0[1-4]-\d{2}\]$/.test(code)||code[1]!==band.value||!Array.isArray(history))continue;
  const valid=history.filter(x=>x&&isoDate(x.day)&&x.day<=now&&Object.prototype.hasOwnProperty.call(DELAYS,x.status))
   .sort((a,b)=>a.day.localeCompare(b.day));
  if(!valid.length)continue;
  const last=valid[valid.length-1],due=addDays(last.day,DELAYS[last.status]);
  if(due)rows.push({code,lastDay:last.day,observation:last.status,due,days:daysBetween(now,due)});
 }
 return rows.sort((a,b)=>a.days-b.days||a.code.localeCompare(b.code));
}
function render(){
 box.replaceChildren();
 if(start.disabled){status.textContent='공식 성취기준과 AI 안내가 확인되면 복습 일정을 표시합니다.';return;}
 const rows=calculate(),due=rows.filter(x=>x.days<=0),soon=rows.filter(x=>x.days>0&&x.days<=7);
 status.textContent='오늘까지 복습할 개념 '+due.length+'개 · 7일 내 예정 '+soon.length+'개 · 기록 기반 총 '+rows.length+'개 (점수·레벨 아님)';
 if(!rows.length){box.append(node('p','help','관찰 기록이 없습니다. 개념 대화를 시작해 관찰을 남기면 여기에 자동 표시됩니다.'));return;}
 if(!due.length)box.append(node('p','review-good','오늘까지 복습할 개념은 없습니다. 다음 예정일을 확인하세요.'));
 const shown=due.slice(0,6).concat(soon.slice(0,due.length?3:6));
 for(const item of shown){
  const wrapper=node('div','plan-row '+(item.days<=0?'plan-due':'plan-upcoming'));
  const desc=node('div','plan-description');
  desc.append(node('strong','',item.code),node('p','plan-meta','마지막 관찰 '+item.lastDay+' · '+label[item.observation]),
   node('p','plan-meta','권장 복습일 '+item.due+' · '+(item.days<0?(-item.days)+'일 지남':item.days===0?'오늘':item.days+'일 남음')));
  const btn=node('button','plan-start',item.code+' 복습 시작');btn.type='button';
  btn.addEventListener('click',()=>{band.value=item.code[1];band.dispatchEvent(new Event('change',{bubbles:true}));focus.value=item.code;start.click();});
  wrapper.append(desc,btn);box.append(wrapper);
 }
 if(rows.length>shown.length)box.append(node('p','help','우선 복습할 개념만 표시합니다. 다른 날짜에 다시 확인하세요.'));
}
band.addEventListener('change',render);
document.addEventListener('click',e=>{
 if(e.target.closest('.review-actions button, #review-clear-yes, .history-revisit'))queueMicrotask(render);
});
const watcher=new MutationObserver(render);watcher.observe(start,{attributes:true,attributeFilter:['disabled']});
render();
})();
