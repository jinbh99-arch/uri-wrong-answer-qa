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
check(manifest.baseline.official_attachment_bytes_verified===true,'MOE official HWP bytes not verified');
check(manifest.official_2022_math_annex_text_independently_compared===true,'independent MOE HWP text proof missing');
check(manifest.academic_relationships_expert_reviewed===false,'educational mapping not reviewed');
check(manifest.g14_final_completed===false,'G14 cannot be falsely marked complete');
const attestation=JSON.parse(readFileSync('data/official-math-source-2022-33-attestation-v0.1.json','utf8'));
check(attestation.zip_sha256==='b37a372a90d6d00bb3985888bbb41caae7a35f28877dc243a6f4b28861c53146','official ZIP SHA changed');
check(attestation.math_hwp_sha256==='aab8eed59ecf244223d04afad75f4cf5ac5085fadcfc3cf52c2f6d54ddfc7856','official math HWP SHA changed');
check(attestation.candidate_entries_verified_against_original===13 && attestation.unmatched_pairs===0,'official text mismatch');
check(attestation.official_original_code_and_text_verified===true,'official source not checked');
check(attestation.expert_concept_mapping_approved===false,'unreviewed mapping elevated');
check(manifest.g14_qa_technical_source_completed===true,'G14 official source technical QA not complete');
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
 check(r.source_db_validation==='원문 공식 대조 완료·개념 연결 부분 검증','source vs academic mapping conflated '+key);
 check(r.mapping_review_state==='ai_mapping_candidate_unapproved','approval escalated '+key);
 check(r.official_server_file_identity_verified===true,'official source file evidence lost '+key);
 check(r.expert_approved===false&&r.academic_mapping_approved===false,'expert/academic approval escalated '+key);
 check(r.official_text_validation.includes('교육부 공식 원본')&&r.official_text_validation.includes('전문가 미승인'),'source mapping status unclear '+key);
 check(r.curriculum_notice.includes('제2022-33호')&&r.curriculum_notice.includes('제2026-1호'),'notice lineage missing '+key);
 check(r.official_source_provenance_version==='qa24-official-2022-33-math-hwp-verify-v01','provenance link missing '+key);
 codes.add(r.standard_code);
}
check(codes.size>=7,'unexpected distinct standard code coverage');
const contents=readFileSync('data/concept-graph-v0.3-demo.json','utf8');
const graph=JSON.parse(contents);
const conceptSet=new Set(graph.concepts.map(x=>x.concept_id));
check(rows.every(x=>conceptSet.has(x.concept_id)),'orphan candidate mapping');
check(graph.approval_status==='draft_unapproved'&&graph.edges.every(e=>e.active_for_recommendation===false),'AI draft was promoted');
console.log('QA_G14_NOTICE_AUDIT='+JSON.stringify({status:'PASS',candidateRows:rows.length,distinctCodes:codes.size,checks:summary.checks,
 noticeLineageVerified:true,official2022HwpSourceVerified:true,independent13TextVerified:true,expertMappingApproval:false,
 result:'G14 SOURCE QA PASS — direct original HWP 13/13; AI academic mapping remains unapproved',
 manifestSHA256:createHash('sha256').update(readFileSync('data/curriculum-notice-lineage-v0.1.json')).digest('hex')}));
