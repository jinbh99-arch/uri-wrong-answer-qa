// QA13 / G04: independent draft-graph schema, provenance and reference invariants.
// Synthetic/public data only. Zero automatic curriculum approval or child diagnosis.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const load = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const graph = load('../data/concept-graph-v0.3-demo.json');
const schema = load('../data/concept-graph.schema.json');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function embedded(id) {
  const match = html.match(new RegExp('<script[^>]*id=["\\x27]'+id+'["\\x27][^>]*>([\\s\\S]*?)<\\/script>'));
  assert.ok(match, 'Missing application data script: ' + id);
  return JSON.parse(match[1]);
}
const candidateMappings = embedded('curriculum-candidate-data');
function schemaCheck(value, spec, path = 'graph') {
  if (spec.$ref) {
    const name = spec.$ref.split('/').at(-1);
    assert.ok(Object.hasOwn(schema.$defs, name), path + ' has missing schema definition');
    return schemaCheck(value, schema.$defs[name], path);
  }
  if (Object.hasOwn(spec, 'const')) assert.deepStrictEqual(value, spec.const, path + ' status changed');
  if (spec.type === 'null') assert.equal(value, null, path);
  if (spec.type === 'string') {
    assert.equal(typeof value, 'string', path + ' must be a string');
    if (spec.minLength !== undefined) assert.ok(value.trim().length >= spec.minLength, path + ' empty');
  }
  if (spec.type === 'boolean') assert.equal(typeof value, 'boolean', path);
  if (spec.type === 'array') {
    assert.ok(Array.isArray(value), path + ' must be an array');
    if (spec.minItems !== undefined) assert.ok(value.length >= spec.minItems, path + ' too short');
    if (spec.maxItems !== undefined) assert.ok(value.length <= spec.maxItems, path + ' too long');
    if (spec.items) value.forEach((item,i) => schemaCheck(item,spec.items,path+'['+i+']'));
  }
  if (spec.type === 'object') {
    assert.ok(value && typeof value === 'object' && !Array.isArray(value), path + ' must be an object');
    for (const key of spec.required || []) assert.ok(Object.hasOwn(value,key), path + ' missing '+key);
    if (spec.additionalProperties === false) {
      for (const key of Object.keys(value)) assert.ok(Object.hasOwn(spec.properties,key),path+' unexpected '+key);
    }
    for (const [key,rule] of Object.entries(spec.properties || {})) {
      if (Object.hasOwn(value,key)) schemaCheck(value[key],rule,path+'.'+key);
    }
  }
}
function check(g,mapping) {
  schemaCheck(g,schema);
  const ids = new Set();
  for (const c of g.concepts) {
    assert.ok(/^math\.[a-z0-9._]+$/.test(c.concept_id),'invalid concept ID');
    assert.ok(!ids.has(c.concept_id),'duplicate concept ID');
    ids.add(c.concept_id);
  }
  const edges = new Set();
  for (const e of g.edges) {
    assert.ok(ids.has(e.from_concept_id) && ids.has(e.to_concept_id),'orphan graph edge');
    assert.notEqual(e.from_concept_id,e.to_concept_id,'graph self loop');
    assert.ok(['related','representation_of','prerequisite_supportive'].includes(e.relation_type));
    const key=e.from_concept_id+'>'+e.to_concept_id+'|'+e.relation_type;
    assert.ok(!edges.has(key),'duplicate graph link');
    edges.add(key);
    assert.ok(!e.active_for_recommendation,'unreviewed link activated');
  }
  const questionIds=new Set(), questionCounts=new Map();
  for (const q of g.questions) {
    assert.ok(ids.has(q.concept_id),'orphan question reference');
    assert.ok(!questionIds.has(q.question_id),'duplicate question ID');
    questionIds.add(q.question_id);
    assert.ok(['concept','representation','reasoning','transfer'].includes(q.question_type),'unexpected question type');
    questionCounts.set(q.concept_id,(questionCounts.get(q.concept_id)||0)+1);
  }
  for (const id of ids) assert.equal(questionCounts.get(id),4,'one concept must have exactly four questions');
  assert.equal(mapping.length,13,'candidate mapping count changed');
  for (const m of mapping) {
    assert.ok(ids.has(m.concept_id),'curriculum candidate orphan');
    assert.equal(m.mapping_review_state,'ai_mapping_candidate_unapproved');
    assert.equal(m.expert_approved,false);
    assert.equal(m.academic_mapping_approved,false);
    assert.equal(m.official_server_file_identity_verified,true);
    assert.equal(m.source_db_validation,'원문 공식 대조 완료·개념 연결 부분 검증');
    assert.match(m.official_text_validation,/교육부 공식 원본/);
    assert.equal(m.official_source_provenance_version,'qa24-official-2022-33-math-hwp-verify-v01');
  }
  return {concepts:ids.size,edges:edges.size,questions:questionIds.size,candidateMappings:mapping.length};
}
assert.deepStrictEqual(graph,embedded('concept-data'),'External JSON drifted from the app embedded graph');
const result=check(graph,candidateMappings);
const clone=(x)=>structuredClone(x);
const negative = [
  ['version drift',g=>{g.version='uncontrolled-new-version'}],
  ['approval escalation',g=>{g.approval_status='approved'}],
  ['AI draft claimed official',g=>{g.concepts[0].is_official_standard=true}],
  ['broken graph edge',g=>{g.edges[0].to_concept_id='math.missing'}],
  ['duplicate edge ID',g=>{g.edges[1].from_concept_id=g.edges[0].from_concept_id;g.edges[1].to_concept_id=g.edges[0].to_concept_id;g.edges[1].relation_type=g.edges[0].relation_type}],
  ['active recommendation',g=>{g.edges[0].active_for_recommendation=true}],
  ['scope removed',g=>{g.edges[0].scope_condition=''}],
  ['question orphan',g=>{g.questions[0].concept_id='math.not_exist'}],
  ['duplicate question',g=>{g.questions[1].question_id=g.questions[0].question_id}],
  ['question status forged',g=>{g.questions[0].education_approval='교육 전문가 검증 완료'}],
  ['missing field',g=>{delete g.concepts[0].label_ko}],
  ['extra unreviewed key',g=>{g.concepts[0].grade='4학년'}],
  ['graph self loop',g=>{g.edges[0].to_concept_id=g.edges[0].from_concept_id}]
];
for (const [name,mutate] of negative) {
  const bad=clone(graph);mutate(bad);
  assert.throws(()=>check(bad,candidateMappings),'Unsafe mutation not rejected: '+name);
}
const badMapping=clone(candidateMappings);badMapping[0].expert_approved=true;
assert.throws(()=>check(graph,badMapping),'False expert approval not rejected');
const badMapping2=clone(candidateMappings);badMapping2[0].concept_id='math.nonexistent';
assert.throws(()=>check(graph,badMapping2),'Orphan curriculum candidate not rejected');
console.log('QA_G04_GRAPH_RESULT='+JSON.stringify({status:'PASS',...result,negativeCases:negative.length+2,
  appDataMatchesFile:true, schemaVersion:graph.version,
  educationApproval:'NOT APPROVED',note:'Independent technical contract only; official curriculum and expert reviews remain incomplete'}));
