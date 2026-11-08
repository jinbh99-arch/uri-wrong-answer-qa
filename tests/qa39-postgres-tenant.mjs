// QA39 G15: real PostgreSQL RLS + transactional compare-and-swap against
// ephemeral CI database. No cloud provider, external user or child information.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {createQa39TenantStore} from '../scripts/qa39-tenant-store.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const {Pool}=pg;
if(!process.env.QA39_TEST_DATABASE_URL||
   !process.env.QA39_TEST_DATABASE_URL.includes('127.0.0.1'))
 throw Error('QA39_TEST_DATABASE_URL must be isolated loopback test Postgres');
process.env.QA39_REFERENCE_ONLY='1';
const admin=new Pool({connectionString:process.env.QA39_TEST_DATABASE_URL,max:3});
const ROLE_PASSWORD='QA39-SYNTHETIC-LOCAL-TEST-ONLY';
const base=new URL(process.env.QA39_TEST_DATABASE_URL);
const appUrl=new URL(base);
appUrl.username='qa39_app';appUrl.password=ROLE_PASSWORD;
const app=new Pool({connectionString:appUrl.toString(),max:6});
const ID_A='11111111-1111-4111-8111-111111111111';
const ID_B='22222222-2222-4222-8222-222222222222';
const ID_C='33333333-3333-4333-8333-333333333333';
const contexts={
 a:{verified:true,subject:'oidc:synthetic-guardian-a'},
 b:{verified:true,subject:'oidc:synthetic-guardian-b'},
 viewer:{verified:true,subject:'oidc:synthetic-viewer'},
 pending:{verified:true,subject:'oidc:synthetic-pending'},
 revoked:{verified:true,subject:'oidc:synthetic-revoked'}
};
const resolveSyntheticContext=async ctx=>{
 if(!ctx?.verified||!Object.values(contexts).some(x=>x===ctx))
  throw Object.assign(new Error('NO_VERIFIED_IDENTITY'),{code:'NO_VERIFIED_IDENTITY'});
 return ctx.subject;
};
let checks=0;const pass=(description)=>{checks++;console.log('PASS QA39 DB',description)};
const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const row=(id,photoFlag)=>({id,problemText:'QA39 synthetic only '+id,hasPhoto:photoFlag,practiceHistory:[]});
function doc(rows){
 const photos={};
 for(const r of rows)if(r.hasPhoto)photos[r.id]=photo;
 return signSynthetic({
  format:'uriaimath-offline-backup-v02',
  profile:{nickname:'QA39 synthetic family',grade:4},
  records:rows,photos,
  backupSummary:{recordCount:rows.length,photoCount:Object.keys(photos).length}
 });
}
const store=createQa39TenantStore(app,resolveSyntheticContext);
try{
 await admin.query("CREATE ROLE qa39_app LOGIN PASSWORD '"+ROLE_PASSWORD+"'");
 await admin.query(readFileSync(new URL('../db/qa39_family_rls.sql',import.meta.url),'utf8'));
 for(const familyId of [ID_A,ID_B,ID_C]){
  await admin.query('INSERT INTO qa39.families (family_id) VALUES ($1)',[familyId]);
  await admin.query('INSERT INTO qa39.family_snapshots(family_id) VALUES ($1)',[familyId]);
 }
 const memberships=[
  [ID_A,contexts.a.subject,'guardian',true,false],
  [ID_B,contexts.b.subject,'guardian',true,false],
  [ID_A,contexts.viewer.subject,'viewer',true,false],
  [ID_A,contexts.pending.subject,'guardian',false,false],
  [ID_A,contexts.revoked.subject,'guardian',true,true]
 ];
 for(const [familyId,principal,role,verified,revoked] of memberships)
  await admin.query(`INSERT INTO qa39.guardian_memberships
   (family_id,principal_id,role,verified_at,revoked_at)
   VALUES ($1,$2,$3,CASE WHEN $4 THEN now() ELSE NULL END,
    CASE WHEN $5 THEN now() ELSE NULL END)`,
   [familyId,principal,role,verified,revoked]);
 assert.deepEqual(await store.families(contexts.a),[ID_A]);
 assert.deepEqual(await store.families(contexts.b),[ID_B]);
 assert.deepEqual(await store.families(contexts.viewer),[]);
 assert.deepEqual(await store.families(contexts.pending),[]);
 pass('독립 DB 세 가족: 검증된 보호자만 자기 가족 ID 목록 조회');

 assert.equal(await store.read(contexts.a,ID_B),null);
 assert.equal(await store.read(contexts.b,ID_A),null);
 assert.equal(await store.read(contexts.viewer,ID_A),null);
 assert.equal(await store.read(contexts.pending,ID_A),null);
 assert.equal(await store.read(contexts.revoked,ID_A),null);
 assert.equal(await store.read(contexts.a,ID_C),null);
 pass('RLS 가족 간 읽기·미승인·철회·viewer 접근 차단');

 await assert.rejects(store.families({verified:false,subject:contexts.a.subject}),/NO_VERIFIED_IDENTITY/);
 await assert.rejects(store.read({...contexts.a},ID_A),/NO_VERIFIED_IDENTITY/);
 const start=await store.read(contexts.a,ID_A);
 assert.equal(start.revision,0);assert.equal(start.snapshot,null);
 pass('공급자 검증을 통과하지 않은 요청은 DB 접근 전 중단, 초기 revision 0');

 const first=doc([row('QA39-PHOTO-A',true)]);
 const v1=await store.put(contexts.a,ID_A,0,first);
 assert.equal(v1.revision,1);
 const got=await store.read(contexts.a,ID_A);
 assert.equal(got.revision,1);
 assert.equal(JSON.stringify(got.snapshot),JSON.stringify(first));
 assert.equal(got.snapshot.photos['QA39-PHOTO-A'],photo);
 pass('사진 base64 원본·JSON 항목 순서를 그대로 저장해 재조회, 사진 바이트 불변');

 await assert.rejects(store.put(contexts.a,ID_B,0,first),/FAMILY_NOT_ACCESSIBLE/);
 await assert.rejects(store.put(contexts.viewer,ID_A,1,first),/FAMILY_NOT_ACCESSIBLE/);
 await assert.rejects(store.put(contexts.a,ID_A,0,first),/STALE_REVISION/);
 assert.equal((await store.read(contexts.a,ID_A)).revision,1);
 pass('다른 가족·읽기 전용 사용자·오래된 revision 쓰기 차단');

 const malformed=structuredClone(first);
 malformed.records[0].problemText='tamper without re-sign';
 await assert.rejects(store.put(contexts.a,ID_A,1,malformed),/local backup digest does not match/);
 const dropped=doc([]);
 await assert.rejects(store.put(contexts.a,ID_A,1,dropped),/SILENT_RECORD_OR_PHOTO_LOSS/);
 const changed=doc([{...first.records[0],problemText:'silently changed same id'}]);
 await assert.rejects(store.put(contexts.a,ID_A,1,changed),/same record ID contains different content/);
 assert.equal((await store.read(contexts.a,ID_A)).revision,1);
 pass('SHA-256 무결성 불일치·사진 삭제·동일 ID 변경은 반영 전 거절');

 const docB=doc([...first.records,row('QA39-APPEND-B',false)]);
 const docC=doc([...first.records,row('QA39-APPEND-C',false)]);
 const outcomes=await Promise.allSettled([
  store.put(contexts.a,ID_A,1,docB),
  store.put(contexts.a,ID_A,1,docC)
 ]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
 const afterRace=await store.read(contexts.a,ID_A);
 assert.equal(afterRace.revision,2);
 assert.equal(afterRace.snapshot.records.length,2);
 assert.equal(afterRace.snapshot.photos['QA39-PHOTO-A'],photo);
 pass('동시 PUT 두 건 중 한 건만 CAS 성공, 다른 요청 최신 기록 덮어쓰기 차단');

 const client=await app.connect();
 try{
  await client.query('BEGIN');
  await client.query("SELECT set_config('qa39.principal_id',$1,true)",[contexts.a.subject]);
  await assert.rejects(client.query('DELETE FROM qa39.family_snapshots WHERE family_id=$1',[ID_A]),/permission denied/);
  await client.query('ROLLBACK');
 }finally{client.release()}
 pass('앱 최소권한 DB 역할의 가족 삭제·가입/관리 기능 직접 실행 거부');

 await admin.query('UPDATE qa39.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND principal_id=$2',[ID_A,contexts.a.subject]);
 assert.equal(await store.read(contexts.a,ID_A),null);
 await assert.rejects(store.put(contexts.a,ID_A,2,afterRace.snapshot),/FAMILY_NOT_ACCESSIBLE/);
 assert.deepEqual(await store.families(contexts.a),[]);
 assert.equal((await store.read(contexts.b,ID_B)).revision,0);
 pass('관리자에 의한 가족 권한 철회 즉시 RLS 반영, 다른 가족 무영향');

 console.log('QA39_PG_RLS_RESULT='+JSON.stringify({
  status:'PASS',checks,realPostgreSQL:true,rlsPolicies:true,tenantCount:3,
  atomicCompareAndSwap:true,exactJsonBytesPreserved:true,realCloud:false,
  providerIdentityConnected:false,realChildren:0,productionApproved:false
 }));
}catch(e){
 console.error('QA39_PG_RLS_RESULT='+JSON.stringify({status:'FAIL',checks,
  message:String(e),code:e?.code,stack:String(e?.stack).slice(0,1100)}));
 process.exitCode=1;
}finally{await app.end();await admin.end()}
