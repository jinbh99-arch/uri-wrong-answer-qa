// QA22/G14 — independent guard against conflating notice validity with official
// file/text identity or academic approval. No external files or real child records.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const html=readFileSync('index.html','utf8');
const manifest=JSON.parse(readFileSync('data/curriculum-notice-lineage-v0.1.json','utf8'));
const match=html.match(/<script\s+id="curriculum-candidate-data"\s+type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(match,'curriculum candidate payload unavailable');
const rows=JSON.parse(match[1]);
const codes=new Set(),mappingKeys=new Set(),summary={checks:0,issues:[]};
function check(cond,msg){assert.ok(cond,msg);summary.checks++}
check(manifest.version==='qa22-2026-notice-lineage-v0.1','manifest version mismatch');
check(manifest.baseline.id==='교육부 고시 제2022-33호','baseline notice mismatch');
check(manifest.current_notice==='국가교육위원회 고시 제2026-1호','current notice mismatch');
check(manifest.current_effective==='2026-03-01','effective date mismatch');
check(manifest.baseline.math_annex==='별책 8','math annex number mismatch');
check(manifest.subsequent_amendments.length===2,'notice review evidence missing');
check(manifest.subsequent_amendments.every(a=>a.math_annex_8_listed_as_amended===false),'Math annex amended! Re-review source');
check(manifest.subsequent_amendments.find(x=>x.id.includes('2026-1호')).amended_annex_numbers.join(',')==='1,2,3,4,15','2026-1 annex list changed');
check(manifest.primary_subject_notice_lineage_verified===true,'public notice review not documented');
check(manifest.source_2022_annex_binary_equal_to_user_pdf===null,'unverified PDF identity must remain unknown');
check(manifest.baseline.official_attachment_bytes_verified===false,'official PDF bytes not independently verified');
check(manifest.official_2022_math_annex_text_independently_compared===false,'independent source text not verified');
check(manifest.academic_relationships_expert_reviewed===false,'educational mapping not reviewed');
check(manifest.g14_final_completed===false,'G14 cannot be falsely marked complete');
check(rows.length===13,'expected 13 original mapping candidates, not verified standards');
for(const [i,r] of rows.entries()){
 const key=r.concept_id+'::'+r.standard_code;
 check(!mappingKeys.has(key),'duplicate concept-to-code pair at '+i);
 mappingKeys.add(key);
 check(/^\[(?:2|4|6)수01-\d{2}\]$/.test(r.standard_code),'unrecognized code syntax '+i);
 const prefix=r.standard_code[1];
 const band={'2':'1~2학년','4':'3~4학년','6':'5~6학년'}[prefix];
 check(r.grade_band===band,'grade-band mismatch: '+key);
 check(r.domain==='수와 연산','unsupported domain '+key);
 check(r.source_pdf_text?.length>=20&&r.source_pdf_page>0,'text/page absent '+key);
 check(r.standard_uid==='MOE-KR-2022-MATH::'+r.standard_code,'UID mismatch '+key);
 check(r.source_db_validation==='부분 검증','not appropriately qualified '+key);
 check(r.mapping_review_state==='ai_mapping_candidate_unapproved','approval escalated '+key);
 check(r.official_server_file_identity_verified===false,'forged official file identity '+key);
 check(r.expert_approved===false&&r.academic_mapping_approved===false,'expert/academic approval escalated '+key);
 check(r.official_text_validation.includes('공식 서버 미대조'),'independent official source falsely claimed '+key);
 check(r.curriculum_notice.includes('제2022-33호')&&r.curriculum_notice.includes('최종 대조 미완료'),'notice footnote lost '+key);
 codes.add(r.standard_code);
}
check(codes.size>=7,'unexpected distinct standard code coverage');
const contents=readFileSync('data/concept-graph-v0.3-demo.json','utf8');
const graph=JSON.parse(contents);
const conceptSet=new Set(graph.concepts.map(x=>x.concept_id));
check(rows.every(x=>conceptSet.has(x.concept_id)),'orphan candidate mapping');
check(graph.approval_status==='draft_unapproved'&&graph.edges.every(e=>e.active_for_recommendation===false),'AI draft was promoted');
console.log('QA_G14_NOTICE_AUDIT='+JSON.stringify({status:'PASS',candidateRows:rows.length,distinctCodes:codes.size,checks:summary.checks,
 noticeLineageVerified:true,official2022AnnexByteMatchVerified:false,independent13TextVerified:false,expertMappingApproval:false,
 result:'G14 PARTIAL — notice lineage verified, candidate official source+mapping NOT VERIFIED',
 manifestSHA256:createHash('sha256').update(readFileSync('data/curriculum-notice-lineage-v0.1.json')).digest('hex')}));
