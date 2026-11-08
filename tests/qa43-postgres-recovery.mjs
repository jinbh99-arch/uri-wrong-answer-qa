// QA43: synthetic encrypted recovery + REAL temporary PostgreSQL data repair,
// lossless photo bytes, family isolation, revocation, deletion, restart and CAS.
// No child data. No production disaster recovery claim.
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
import {createQa39TenantStore} from '../scripts/qa39-tenant-store.mjs';
import {sealQa43SyntheticRecovery,openQa43SyntheticRecovery}
 from '../scripts/qa43-recovery-envelope.mjs';
const {Pool}=pg;
if(!process.env.QA39_TEST_DATABASE_URL||!process.env.QA39_TEST_DATABASE_URL.includes('127.0.0.1'))
 throw Error('QA43_REQUIRES_ISOLATED_POSTGRES');
process.env.QA39_REFERENCE_ONLY='1';process.env.QA43_SYNTHETIC_RECOVERY_ONLY='1';
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const appUrl=new URL(process.env.QA39_TEST_DATABASE_URL);
appUrl.username='qa39_app';appUrl.password='QA39-SYNTHETIC-LOCAL-TEST-ONLY';
let app=new Pool({connectionString:appUrl.toString()});
const a='88888888-8888-4888-8888-888888888888',b='99999999-9999-4999-8999-999999999999';
const guardianA={subject:'qa43-guardian-a'},guardianB={subject:'qa43-guardian-b'};
const resolver=async context=>{
 if(context===guardianA)return 'qa43:guardian-a';
 if(context===guardianB)return 'qa43:guardian-b';
 throw Error('UNVERIFIED_PRINCIPAL');
};
let store=createQa39TenantStore(app,resolver),checks=0;
const pass=x=>{checks++;console.log('PASS QA43 RECOVERY',x)};
const key=randomBytes(32),dir=mkdtempSync(join(tmpdir(),'qa43-recovery-'));
const file=join(dir,'synthetic.enc');
const pic='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
function doc(rows){
 const photos={};
 for(const row of rows)if(row.hasPhoto)photos[row.id]=pic;
 return signSynthetic({
  format:'uriaimath-offline-backup-v02',
  profile:{nickname:'qa43 synthetic only',grade:4},
  records:rows,photos
 });
}
const base=doc([{id:'qa43-photo-a',problemText:'2/5+1/5',hasPhoto:true,practiceHistory:[]}]);
try{
 for(const [id,principal] of [[a,'qa43:guardian-a'],[b,'qa43:guardian-b']]){
  await admin.query('INSERT INTO qa39.families(family_id) VALUES ($1)',[id]);
  await admin.query('INSERT INTO qa39.family_snapshots(family_id) VALUES ($1)',[id]);
  await admin.query("INSERT INTO qa39.guardian_memberships(family_id,principal_id,role,verified_at) VALUES ($1,$2,'guardian',now())",[id,principal]);
 }
 assert.equal((await store.put(guardianA,a,0,base)).revision,1);
 assert.equal(await store.read(guardianB,a),null);
 assert.deepEqual(await store.families(guardianA),[a]);
 pass('두 가족 별도 DB 테넌트, 보호자 A만 자신의 사진 기록에 접근');

 delete process.env.QA43_SYNTHETIC_RECOVERY_ONLY;
 assert.throws(()=>sealQa43SyntheticRecovery(a,1,base,key),/LIVE_RECOVERY_DISABLED/);
 process.env.QA43_SYNTHETIC_RECOVERY_ONLY='1';
 const pack=sealQa43SyntheticRecovery(a,1,base,key);
 writeFileSync(file,JSON.stringify(pack),{mode:0o600,flag:'wx'});
 assert.equal(statSync(file).mode&0o077,0);
 const raw=readFileSync(file,'utf8');
 assert.ok(!raw.includes('qa43-photo-a')&&!raw.includes(pic));
 assert.deepEqual(openQa43SyntheticRecovery(JSON.parse(raw),a,1,key),base);
 pass('AES-256-GCM 가족/개정번호 AAD, 0600 로컬 합성 백업 파일, 평문 사진·기록 미포함');

 assert.throws(()=>openQa43SyntheticRecovery(pack,b,1,key),/RECOVERY_SCOPE_MISMATCH/);
 assert.throws(()=>openQa43SyntheticRecovery(pack,a,2,key),/RECOVERY_SCOPE_MISMATCH/);
 assert.throws(()=>openQa43SyntheticRecovery(pack,a,1,randomBytes(32)),/RECOVERY_AUTHENTICATION_FAILED/);
 const altered={...pack,ciphertext:(pack.ciphertext[0]==='A'?'B':'A')+pack.ciphertext.slice(1)};
 assert.throws(()=>openQa43SyntheticRecovery(altered,a,1,key),/RECOVERY_AUTHENTICATION_FAILED/);
 assert.equal((await store.read(guardianA,a)).revision,1);
 pass('다른 가족/개정번호/키/암호문 손상은 실패 폐쇄, 서버 기존 원본 불변');

 // This deliberately simulates accidental DB table-row loss, NOT a user's
 // right-to-erasure event; do not silently resurrect intentionally deleted data.
 await admin.query('DELETE FROM qa39.family_snapshots WHERE family_id=$1',[a]);
 assert.equal(await store.read(guardianA,a),null);
 await admin.query('INSERT INTO qa39.family_snapshots(family_id) VALUES ($1)',[a]);
 const rescued=openQa43SyntheticRecovery(JSON.parse(readFileSync(file,'utf8')),a,1,key);
 assert.equal((await store.put(guardianA,a,0,rescued)).revision,1);
 assert.deepEqual((await store.read(guardianA,a)).snapshot,base);
 pass('가상 장애로 snapshot 행 손실 후 복구, 기록·사진 원본/해시 확인, 권한 승인 보호자만 읽음');

 await app.end();
 app=new Pool({connectionString:appUrl.toString()});
 store=createQa39TenantStore(app,resolver);
 assert.deepEqual((await store.read(guardianA,a)).snapshot,base);
 pass('API DB 연결 풀 재시작 후에도 실 DB 원본 및 보호자 RLS 유지');

 await admin.query("UPDATE qa39.family_snapshots SET content_sha256=$2 WHERE family_id=$1",[a,'0'.repeat(64)]);
 await assert.rejects(store.read(guardianA,a),/PERSISTED_DOCUMENT_TAMPERED/);
 const correctHash=createHash('sha256').update(JSON.stringify(base)).digest('hex');
 await admin.query('UPDATE qa39.family_snapshots SET content_sha256=$2 WHERE family_id=$1',[a,correctHash]);
 assert.deepEqual((await store.read(guardianA,a)).snapshot,base);
 pass('DB 저장 내용 SHA 손상 시 조용한 복원·표시 불허; 관리자 수정 후에만 정상');

 const plus1=doc([...base.records,{id:'qa43-add-1',problemText:'3/6+2/6',hasPhoto:false,practiceHistory:[]}]);
 const plus2=doc([...base.records,{id:'qa43-add-2',problemText:'4/6+1/6',hasPhoto:false,practiceHistory:[]}]);
 const outcomes=await Promise.allSettled([
  store.put(guardianA,a,1,plus1),store.put(guardianA,a,1,plus2)
 ]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
 const current=await store.read(guardianA,a);
 assert.equal(current.revision,2);
 assert.equal(current.snapshot.photos['qa43-photo-a'],pic);
 await assert.rejects(store.put(guardianA,a,1,plus1),/STALE_REVISION/);
 pass('동시 저장 중 단 한 건만 CAS 성공; 낡은 요청·사진 삭제/손상 차단');

 await admin.query("INSERT INTO qa39.family_snapshots(family_id) VALUES ($1) ON CONFLICT DO NOTHING",[b]);
 await store.put(guardianB,b,0,doc([{id:'qa43-b-record',problemText:'QA B',hasPhoto:false,practiceHistory:[]}]));
 await admin.query('DELETE FROM qa39.families WHERE family_id=$1',[b]);
 assert.equal(await store.read(guardianB,b),null);
 const deleted=await admin.query('SELECT COUNT(*)::int AS n FROM qa39.guardian_memberships WHERE family_id=$1',[b]);
 assert.equal(deleted.rows[0].n,0);
 assert.deepEqual(await store.families(guardianB),[]);
 assert.equal((await store.read(guardianA,a)).revision,2);
 pass('가족 B 명시적 삭제 시 snapshot·회원권한 cascade 제거, A 가족 원본 영향 없음');

 const userA='qa43:guardian-a';
 await admin.query('UPDATE qa39.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND principal_id=$2',[a,userA]);
 assert.equal(await store.read(guardianA,a),null);
 await assert.rejects(store.put(guardianA,a,2,plus1),/FAMILY_NOT_ACCESSIBLE/);
 pass('보호자 권한 철회 후 읽기/쓰기 모두 거절, 사진·기록 복구 백업이 자동 재활성화되지 않음');

 console.log('QA43_DB_RECOVERY_RESULT='+JSON.stringify({
  status:'PASS',checks,syntheticOnly:true,realPostgres:true,
  encryptedBackup:true,photoExact:true,cas:true,roleRevocation:true,
  productionPitrTested:false,productionDeletionPolicyApproved:false,realChildren:0
 }));
}catch(e){
 console.error('QA43_DB_RECOVERY_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),code:e?.code,stack:String(e?.stack).slice(0,1500)
 }));
 process.exitCode=1;
}finally{
 await app.end();await admin.end();rmSync(dir,{recursive:true,force:true});
}
