// QA44 Supabase policies tested in REAL ephemeral PostgreSQL 16.
// Supabase auth/storage schemas are MINIMAL test doubles; no live provider.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import pg from 'pg';
const {Pool}=pg;
const conn=process.env.QA39_TEST_DATABASE_URL;
if(!conn||!conn.includes('127.0.0.1'))throw Error('QA44_REQUIRES_EPHEMERAL_POSTGRES');
const admin=new Pool({connectionString:conn});
const UA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 UB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 UC='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FA='dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 FB='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PA=FA+'/RecordA/11111111-1111-4111-8111-111111111111.png',
 PB=FB+'/RecordB/22222222-2222-4222-8222-222222222222.jpg';
let checks=0;
const pass=x=>{checks++;console.log('PASS QA44 SUPABASE RLS',x)};
async function asUser(id,fn){
 const c=await admin.connect();
 try{
  await c.query('BEGIN');
  await c.query('SET LOCAL ROLE authenticated');
  if(id)await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[id]);
  const r=await fn(c);
  await c.query('ROLLBACK');return r;
 }catch(e){await c.query('ROLLBACK');throw e}
 finally{c.release()}
}
const rows=(id,sql,params=[])=>asUser(id,async c=>(await c.query(sql,params)).rows);
const denied=(id,sql,params=[])=>assert.rejects(asUser(id,c=>c.query(sql,params)));
try{
 await admin.query('CREATE ROLE authenticated NOLOGIN');
 await admin.query('CREATE ROLE anon NOLOGIN');
 await admin.query('CREATE SCHEMA auth');
 await admin.query('CREATE TABLE auth.users(id uuid PRIMARY KEY)');
 await admin.query("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$");
 await admin.query('CREATE SCHEMA storage');
 await admin.query('CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])');
 await admin.query('CREATE TABLE storage.objects(id bigserial PRIMARY KEY,bucket_id text NOT NULL,name text NOT NULL UNIQUE)');
 await admin.query('ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY');
 await admin.query('ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY');
 await admin.query('GRANT USAGE ON SCHEMA storage,auth TO authenticated');
 await admin.query('GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated');
 await admin.query('GRANT USAGE,SELECT ON SEQUENCE storage.objects_id_seq TO authenticated');
 await admin.query(readFileSync(new URL('../db/qa44_supabase_staging_rls.sql',import.meta.url),'utf8'));
 const bucket=(await admin.query("SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='qa44-family-photos'")).rows[0];
 assert.equal(bucket.public,false);
 assert.equal(Number(bucket.file_size_limit),1048576);
 assert.deepEqual(bucket.allowed_mime_types,['image/png','image/jpeg','image/webp']);
 assert.deepEqual(await rows(UA,'SELECT family_id FROM qa44.family_snapshots'),[]);
 await denied(UA,'INSERT INTO qa44.families(family_id) VALUES($1)',[FA]);
 pass('Supabase 구조 모의+실제 PostgreSQL RLS 설치, 1MiB 비공개 이미지 버킷과 무권한 가족 등록 차단');

 for(const id of [UA,UB,UC])await admin.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
 for(const id of [FA,FB]){
  await admin.query('INSERT INTO qa44.families(family_id) VALUES($1)',[id]);
  await admin.query('INSERT INTO qa44.family_snapshots(family_id) VALUES($1)',[id]);
 }
 async function seed(user,family,verified,consent,source){
  await admin.query("INSERT INTO qa44.guardian_memberships(family_id,guardian_user_id,role,verification_source,verified_at,consent_verified_at) VALUES($1,$2,'guardian',$3,CASE WHEN $4 THEN now() ELSE NULL END,CASE WHEN $5 THEN now() ELSE NULL END)",
   [family,user,source,verified,consent]);
 }
 await seed(UA,FA,true,true,'externally_verified');
 await seed(UB,FB,true,true,'externally_verified');
 await seed(UC,FA,false,false,'pending');
 assert.deepEqual((await rows(UA,'SELECT family_id FROM qa44.family_snapshots')).map(x=>x.family_id),[FA]);
 assert.deepEqual((await rows(UB,'SELECT family_id FROM qa44.family_snapshots')).map(x=>x.family_id),[FB]);
 assert.deepEqual(await rows(UC,'SELECT family_id FROM qa44.family_snapshots'),[]);
 assert.deepEqual(await rows(null,'SELECT family_id FROM qa44.family_snapshots'),[]);
 pass('두 가족 RLS 분리, 미검증 보호자·익명은 읽기 0건');
 await denied(UA,'UPDATE qa44.family_snapshots SET revision=revision+1 WHERE family_id=$1',[FA]);
 await denied(UA,'DELETE FROM qa44.family_snapshots WHERE family_id=$1',[FA]);
 await denied(UA,'UPDATE qa44.guardian_memberships SET verified_at=now() WHERE guardian_user_id=$1',[UA]);
 await denied(UA,"INSERT INTO qa44.guardian_memberships(family_id,guardian_user_id,role) VALUES($1,$2,'guardian')",[FA,UC]);
 pass('브라우저 자가 보호자 가입/승인·가족 기록 수정·삭제 SQL 권한 차단');
 assert.deepEqual((await rows(UA,'SELECT family_id FROM qa44.guardian_memberships')).map(x=>x.family_id),[FA]);
 assert.equal((await rows(UC,'SELECT family_id FROM qa44.guardian_memberships')).length,0);
 pass('보호자 검증과 별도 법정대리인 동의에 필요한 승인 상태는 독립 RLS로 보호');
 const select='SELECT name FROM storage.objects WHERE bucket_id=$1';
 const insert='INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2) RETURNING name';
 assert.equal((await rows(UA,insert,['qa44-family-photos',PA])).length,1);
 await denied(UA,insert,['qa44-family-photos',PB]);
 await denied(UA,insert,['qa44-family-photos',FA+'/R/../../../evil.png']);
 await denied(UA,insert,['public',PA]);
 await denied(UC,insert,['qa44-family-photos',PA]);
 pass('승인된 자기 가족 이미지 경로만 INSERT, 다른 가족·경로 탈출·무승인 접근 차단');
 // asUser() deliberately rolls back EVERY test transaction; seed the
 // previously authorized synthetic uploads as admin to test later RLS reads.
 await admin.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['qa44-family-photos',PA]);
 await admin.query('INSERT INTO storage.objects(bucket_id,name) VALUES($1,$2)',['qa44-family-photos',PB]);
 assert.deepEqual((await rows(UA,select,['qa44-family-photos'])).map(x=>x.name),[PA]);
 assert.deepEqual((await rows(UB,select,['qa44-family-photos'])).map(x=>x.name),[PB]);
 // A PostgreSQL RLS policy with no UPDATE/DELETE rules normally filters
 // the target rows and returns rowCount=0 instead of throwing SQLSTATE.
 assert.equal((await asUser(UA,c=>c.query('UPDATE storage.objects SET name=$1 WHERE name=$2',[PB,PA]))).rowCount,0);
 assert.equal((await asUser(UA,c=>c.query('DELETE FROM storage.objects WHERE name=$1',[PA]))).rowCount,0);
 assert.deepEqual((await rows(UA,select,['qa44-family-photos'])).map(x=>x.name),[PA]);
 pass('사진 Storage 열람 가족 RLS, 직접 덮어쓰기·삭제 정책 없음');
 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND guardian_user_id=$2',[FA,UA]);
 assert.deepEqual(await rows(UA,'SELECT family_id FROM qa44.family_snapshots'),[]);
 assert.deepEqual(await rows(UA,select,['qa44-family-photos']),[]);
 await denied(UA,insert,['qa44-family-photos',FA+'/RecordB/33333333-3333-4333-8333-333333333333.png']);
 assert.equal((await rows(UB,'SELECT family_id FROM qa44.family_snapshots')).length,1);
 pass('보호자 승인 철회 즉시 DB·사진 읽기와 업로드 차단, 타 가족 기록 정상');
 console.log('QA44_REAL_PG_SUPABASE_POLICY_RESULT='+JSON.stringify({
  status:'PASS',checks,postgresql16:true,simulatedSupabaseSchemas:true,
  guardianConsentGate:true,privatePhotoRls:true,realSupabaseConnected:false,
  realChildren:0,productionApproved:false}));
}catch(e){
 console.error('QA44_REAL_PG_SUPABASE_POLICY_RESULT='+JSON.stringify({
 status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1400)}));
 process.exitCode=1;
}finally{await admin.end()}
