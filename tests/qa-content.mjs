import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=readFileSync('index.html','utf8');
const evidence=[];
function ok(name,count){evidence.push({name,count});console.log('PASS CONTENT',name,count)}
function scriptById(id){
 const m=html.match(new RegExp('<script[^>]+id=["\x27]'+id+'["\x27][^>]*>([\\s\\S]*?)<\\/script>'));
 if(!m)throw Error('Embedded data not found: '+id);
 return JSON.parse(m[1]);
}
function sourceBlock(start,end) {
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert.ok(a>=0 && b>a,'Code block missing '+start);
 return html.slice(a,b);
}
const graph=scriptById('concept-data');
const mapping=scriptById('curriculum-candidate-data');
const ids=new Set(graph.concepts.map(x=>x.concept_id));
assert.equal(ids.size,12);
assert.equal(graph.edges.length,15);
assert.equal(graph.questions.length,48);
assert.equal(graph.approval_status,'draft_unapproved');
for(const c of graph.concepts){
 assert.equal(c.origin,'ai_authored_draft','공식 데이터 오인');
 assert.equal(c.is_official_standard,false);
 assert.equal(c.review_state,'draft');
 assert.equal(graph.questions.filter(q=>q.concept_id===c.concept_id).length,4);
}
ok('12개 개념과 48개 열린 질문의 구조 및 초안 표기',60);
for(const edge of graph.edges){
 assert.ok(ids.has(edge.from_concept_id)&&ids.has(edge.to_concept_id),'missing concept in graph edge');
 assert.equal(edge.active_for_recommendation,false,'승인 안 된 선행 관계가 추천에 활성화됨');
 assert.equal(edge.review_state,'draft');
 assert.ok(String(edge.scope_condition).length>0);
}
const keys=new Set(graph.questions.map(q=>q.question_id));
assert.equal(keys.size,48);
for(const q of graph.questions){
 assert.ok(ids.has(q.concept_id),'unmatched question');
 assert.equal(q.source_kind,'ai_authored_draft');
 assert.equal(q.review_state,'draft');
 assert.equal(q.education_approval,'교육 전문가 검증 전');
}
ok('15개 관계의 안전성/질문 ID 고유성과 교육 승인 미표기',111);
assert.equal(mapping.length,13);
for(const m of mapping){
 assert.ok(ids.has(m.concept_id));
 assert.equal(m.mapping_review_state,'ai_mapping_candidate_unapproved');
 assert.equal(m.expert_approved,false);
 assert.equal(m.official_server_file_identity_verified,false);
}
ok('13개 성취기준 대응 후보가 승인 전으로 남아 있음',13);
// Execute the EXACT application pilot arithmetic functions, not copied substitutes.
const source=[
 sourceBlock('// V27-LOGIC-START','// V27-LOGIC-END'),
 sourceBlock('// V211-LOGIC-START','// V211-LOGIC-END'),
 sourceBlock('// V222-LOGIC-START','// V222-LOGIC-END'),
 'globalThis.__qa={v27ParseFractionAdd,v27AnswerMatches,v211ParseEqualGroups,v211Evidence,v222TransferTask,v222TransferMatches,v222CauseCard};'
].join('\n');
const ctx={};vm.runInNewContext(source,ctx,{timeout:3000});
const app=ctx.__qa;
let fractions=0,groups=0;
const fractionSources=['1/3+1/4','1/2+1/4','1/3+1/6','1/4+1/6','1/2+1/3','1/4+1/8','1/3+1/9','1/2+1/6'];
for(const eq of fractionSources){
 const spec=app.v27ParseFractionAdd(eq);
 assert.ok(spec,'cannot parse: '+eq);
 const hints=app.v222CauseCard('fraction',spec,'2/10');
 assert.equal(hints.questions.length,3);
 assert.match(hints.candidate,/가능성|보류/);
 for(let i=0;i<32;i++){
  const task=app.v222TransferTask('fraction',spec,i);
  assert.notEqual(task.signature,spec.signature);
  const {a,b,c,d}=task.fractionSpec;
  const correctNumerator=a*d+c*b,correctDenominator=b*d;
  const [answerNumerator,answerDenominator]=task.exampleAnswer.split('/').map(Number);
  assert.equal(answerNumerator*correctDenominator,correctNumerator*answerDenominator,'wrong fraction calculation');
  assert.equal(app.v222TransferMatches(task,task.exampleAnswer),true);
  assert.equal(app.v222TransferMatches(task,String(answerNumerator*2)+'/'+String(answerDenominator*2)),true);
  assert.equal(app.v222TransferMatches(task,'0/1'),false);
  fractions++;
 }
}
assert.equal(app.v27ParseFractionAdd('1/2+1/3 그리고 다른 문제'),null);
ok('분수 원인 후보·전이 문제 256개, 정답/동치/불일치/범위 제한',fractions);
for(let g=2;g<=6;g++)for(let each=2;each<=6;each++){
 const spec=app.v211ParseEqualGroups(g+'×'+each);
 assert.ok(spec);
 const hints=app.v222CauseCard('groups',spec,String(g+each));
 assert.equal(hints.questions.length,3);
 assert.match(hints.candidate,/가능성|보류/);
 for(let i=0;i<24;i++){
  const task=app.v222TransferTask('groups',spec,i);
  assert.notEqual(task.itemsPerGroup,each);
  assert.equal(Number(task.exampleAnswer),g*task.itemsPerGroup);
  assert.equal(app.v222TransferMatches(task,task.exampleAnswer),true);
  assert.equal(app.v222TransferMatches(task,String(Number(task.exampleAnswer)+1)),false);
  groups++;
 }
}
assert.equal(app.v211ParseEqualGroups('7×3'),null);
ok('곱셈 원인 후보·전이 문제 600개, 정답/불일치/범위 제한',groups);
console.log('QA_CONTENT_RESULT='+JSON.stringify({status:'PASS',checks:evidence,totalTransferSamples:fractions+groups,
 note:'내부 산술·그래프 구조 확인이며 공식 교육과정 원문 대조 또는 교육전문가 검증이 아님'}));
