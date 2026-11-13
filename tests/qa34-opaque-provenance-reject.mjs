// Only NEW counterexamples: duplicate IDs, opaque provenance drift, photo/
// parent-observation loss and metadata type mutations in the synthetic CAS.
// No real families or production auth/restore assumptions.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createIsolatedQaFamilyGateway} from '../scripts/qa-family-gateway.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

process.env.QA_SYNTHETIC_FAMILY_ONLY='1';
process.env.QA_DURABLE_TEST_ONLY='1';
const folder=mkdtempSync(join(tmpdir(),'qa34-opaque-marker-'));
const file=join(folder,'synthetic-aes-gcm.json');
const key=randomBytes(32).toString('hex');
const PASSWORD='ONLY-SYNTHETIC-QA-2026-OPAQUE-PROVENANCE';
const PHOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
let gate,checks=0;
function pass(name){checks++;console.log('PASS WRONG OPAQUE CAS',name)}
const original={
 format:'uriaimath-offline-backup-v02',
 exportedAt:'2026-11-14T01:00:00.000Z',
 backupRevision:'v1.8-integrity',
 notice:'가상 보호자 백업 보관 문구',
 provenance:{familyHint:'QA-A-ONLY',exporter:{tool:'simulator',version:1}},
 profile:{nickname:'QA 가족 A',grade:3},
 records:[{id:'qa-photo-001',problemText:'가상 틀린 문제',hasPhoto:true,
  studentAnswer:'가상 아이 답',practiceHistory:[],
  generalRetryHistory:[{answer:'첫 답',explanation:'처음 설명',review:'needs_help',
   parentNote:'가상 부모의 관찰'}]}],
 photos:{'qa-photo-001':PHOTO},
 backupSummary:{recordCount:1,photoCount:1},
 photosOmitted:0
};
const other={
 format:'uriaimath-offline-backup-v02',profile:{nickname:'QA 가족 B',grade:5},
 records:[{id:'qa-family-b-only',problemText:'B가 가진 가상 숙제',hasPhoto:false,practiceHistory:[]}],
 photos:{},backupSummary:{recordCount:1,photoCount:0}
};
function sign(source){const copy=structuredClone(source);delete copy.integrity;return signSynthetic(copy)}
const A=sign(original),B=sign(other);
async function call(path,method='GET',doc,token,rev){
 const headers={'cache-control':'no-store'};
 if(token)headers.authorization='Bearer '+token;
 if(doc!==undefined)headers['content-type']='application/json';
 if(rev!==undefined)headers['if-match']='"'+rev+'"';
 const response=await fetch(gate.baseUrl+path,{method,headers,
  body:doc===undefined?undefined:JSON.stringify(doc)});
 return {status:response.status,body:await response.json(),etag:response.headers.get('etag')};
}
async function newFamily(name){
 assert.equal((await call('/qa/register','POST',{familyKey:name,password:PASSWORD})).status,201);
 const logged=await call('/qa/login','POST',{familyKey:name,password:PASSWORD});
 assert.equal(logged.status,200);return logged.body.token;
}
async function revision(token){
 const result=await call('/qa/snapshot','GET',undefined,token);
 assert.equal(result.status,200);return result.body;
}
async function rejects(label,doc,status,error,token,rev){
 const before=readFileSync(file);
 const response=await call('/qa/snapshot','PUT',doc,token,rev);
 assert.equal(response.status,status,label+' '+JSON.stringify(response.body));
 if(error)assert.equal(response.body.error,error,label);
 assert.deepEqual(readFileSync(file),before,label+' modified encrypted ledger');
 return response;
}
try{
 gate=await createIsolatedQaFamilyGateway({durablePath:file,encryptionKey:key});
 const a=await newFamily('qa-opaque-source-a'),b=await newFamily('qa-opaque-source-b');
 assert.equal((await call('/qa/snapshot','PUT',A,a,0)).status,200);
 assert.equal((await call('/qa/snapshot','PUT',B,b,0)).status,200);
 const bytesBefore=readFileSync(file);
 assert.deepEqual((await revision(a)).snapshot,A);
 assert.deepEqual((await revision(b)).snapshot,B);
 pass('가상 A의 사진·아이 설명·부모 관찰 및 불투명 출처 표식과 B 원장을 별도 AES-GCM 파일에 고정');

 const changed=structuredClone(original);
 changed.provenance.exporter.version=2;
 await rejects('출처 필드 값 변경',sign(changed),409,'OPAQUE_BACKUP_MARKER_CHANGED',a,1);
 const omitted=structuredClone(original);delete omitted.provenance;
 await rejects('출처 필드 제거',sign(omitted),409,'OPAQUE_BACKUP_MARKER_CHANGED',a,1);
 const added=structuredClone(original);added.unverifiedSource='NEW-SOURCE';
 await rejects('출처 필드 삽입',sign(added),409,'OPAQUE_BACKUP_MARKER_CHANGED',a,1);
 pass('SHA 정상으로 다시 서명해도 알 수 없는 출처 필드 수정·제거·추가 3종 거절');

 const typed=structuredClone(original);typed.provenance=['QA-A-ONLY',1];
 await rejects('출처 객체를 배열로 변경',sign(typed),409,'OPAQUE_BACKUP_MARKER_CHANGED',a,1);
 const revTyped=structuredClone(original);revTyped.backupRevision=17;
 await rejects('기존 백업 스키마 표식 자료형 변경',sign(revTyped),409,'OPAQUE_BACKUP_MARKER_CHANGED',a,1);
 pass('알 수 없는 출처 및 백업 버전 표식의 객체/배열·숫자 자료형 바꿔치기 거부');

 const dup=structuredClone(original);dup.records.push(structuredClone(dup.records[0]));
 dup.backupSummary.recordCount=2;
 await rejects('중복 오답 ID',sign(dup),422,'DUPLICATE',a,1);
 pass('검증된 SHA와 표기상 정상 개수에도 중복 오답 ID를 사전 거부');

 const photoLost=structuredClone(original);delete photoLost.photos['qa-photo-001'];
 photoLost.backupSummary.photoCount=0;
 await rejects('사진 데이터만 삭제',sign(photoLost),422,'ORPHAN',a,1);
 const allLost=structuredClone(original);allLost.records=[];allLost.photos={};
 allLost.backupSummary={recordCount:0,photoCount:0};
 await rejects('사진·오답 전체 삭제',sign(allLost),409,'SILENT_RECORD_OR_PHOTO_LOSS',a,1);
 pass('사진 단독 누락 또는 기록·사진 전체 제거는 원본 건수/원장 변동 없이 거부');

 const parentDeleted=structuredClone(original);
 delete parentDeleted.records[0].generalRetryHistory[0].parentNote;
 await rejects('보호자 관찰 삭제',sign(parentDeleted),409,'RECORD_CONFLICT',a,1);
 pass('부모 관찰 삭제를 의미상 동일한 백업으로 취급하지 않고 409 거부');

 const wrongDate=structuredClone(original);wrongDate.exportedAt={unexpected:'date'};
 await rejects('백업 내보낸 시각 자료형 변경',sign(wrongDate),422,'INVALID_EXPORT_TIMESTAMP',a,1);
 const wrongCounts=structuredClone(original);wrongCounts.backupSummary.photoCount='1';
 await rejects('사진 개수 자료형 변경',sign(wrongCounts),422,'INVALID_BACKUP_SUMMARY',a,1);
 const countMismatch=structuredClone(original);countMismatch.backupSummary.recordCount=99;
 await rejects('백업 기록 개수 위장',sign(countMismatch),422,'INVALID_BACKUP_SUMMARY',a,1);
 pass('재서명한 메타데이터라도 시각 객체·개수 문자열·불일치 건수 422 사전 차단');

 // Reordered keys inside the same opaque provenance object are safe.
 const reordered=structuredClone(original);
 reordered.provenance={exporter:{version:1,tool:'simulator'},familyHint:'QA-A-ONLY'};
 reordered.exportedAt='2026-11-14T02:00:00.000Z';
 const noOp=await call('/qa/snapshot','PUT',sign(reordered),a,1);
 assert.equal(noOp.status,200,JSON.stringify(noOp.body));
 assert.equal(noOp.body.unchanged,true);
 assert.equal(noOp.body.revision,1);
 assert.deepEqual(readFileSync(file),bytesBefore);
 pass('키 순서·유효한 내보내기 시각만 달라진 백업은 CAS 무변경, 암호 파일 원본 유지');

 const appended=structuredClone(original);
 appended.records.push({id:'qa-new-002',problemText:'가상 새 오답',hasPhoto:false,
  studentAnswer:'가상 새 답',practiceHistory:[]});
 appended.backupSummary.recordCount=2;
 const next=await call('/qa/snapshot','PUT',sign(appended),a,1);
 assert.equal(next.status,200,JSON.stringify(next.body));
 assert.equal(next.body.revision,2);
 const after=await revision(a);
 assert.equal(after.revision,2);assert.equal(after.snapshot.records.length,2);
 assert.deepEqual(after.snapshot.photos,A.photos);
 assert.deepEqual(after.snapshot.records[0].generalRetryHistory,A.records[0].generalRetryHistory);
 assert.deepEqual((await revision(b)).snapshot,B);
 assert.equal((await revision(b)).revision,1);
 pass('출처 표시 유지한 진짜 오답 추가만 revision+1, 사진·부모 관찰과 B 가족 원장 불변');

 console.log('WRONG_QA34_OPAQUE_MARKER_RESULT='+JSON.stringify({status:'PASS',
  checks,syntheticFamilies:2,realNodeHttp:true,oldPhotoBytesPreserved:true,
  sourceMarkersNotAuthenticated:true,realFamilyAuth:false,
  safeToRestore:false,deployment:false}));
}catch(error){
 console.error('WRONG_QA34_OPAQUE_MARKER_RESULT='+JSON.stringify({status:'FAIL',
  checks,error:String(error),stack:String(error?.stack).slice(0,1200),
  safeToRestore:false}));process.exitCode=1;
}finally{
 if(gate)await gate.shutdown();
 rmSync(folder,{recursive:true,force:true});
}
