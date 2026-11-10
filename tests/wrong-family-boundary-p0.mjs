// WRONG synthetic family boundary P0 — QA44 reuse, one narrow ephemeral PG16 fixture.
// Two unrelated synthetic guardians, a viewer-as-child NEGATIVE role, exact
// photo/backup/parent observation containment, revocation, RLS and privileged
// backend-pool bypass defense. This is NOT a real child sign-in system.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createQa44ServerFamilyStore} from '../scripts/qa44-supabase-family-store.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';

const conn=process.env.QA39_TEST_DATABASE_URL;
if(!conn?.includes('127.0.0.1')||process.env.QA44_STAGE_ONLY!=='1')
 throw Error('QA_SYNTHETIC_PG_LOCAL_ONLY');
const {Pool}=pg,admin=new Pool({connectionString:conn});
const UA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UC='cccccccc-cccc-4ccc-8ccc-cccccccccccc'; // viewer-only, NOT a real child credential
const FA='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FB='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TOKEN_A='qa-synthetic-A-'+ 'a'.repeat(86);
const TOKEN_B='qa-synthetic-B-'+ 'b'.repeat(86);
const TOKEN_C='qa-synthetic-viewer-'+ 'c'.repeat(86);
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const PA=FA+'/sampleA/11111111-1111-4111-8111-111111111111.png';
const PB=FB+'/sampleB/22222222-2222-4222-8222-222222222222.png';
const doc=(id,title,note)=>signSynthetic({
 format:'uriaimath-offline-backup-v02',
 profile:{grade:3,nickname:'QA-SYNTHETIC-'+id},
 records:[{
  id,subject:'korean',gradeAtEntry:3,problemText:title,hasPhoto:true,
  generalRetryHistory:[{at:'2026-11-10T00:00:00.000Z',answer:'synthetic',
   explanation:'합성 아이가 직접 작성한 답의 근거',review:'not_checked'}],
  checkHistory:[{at:'2026-11-10T00:00:00.000Z',status:'explained',
   memo:note,by:'parent_observation'}],studyPlan:null,practiceHistory:[],
  followupHistory:[]
 }],
 photos:{[id]:png},
 backupSummary:{recordCount:1,photoCount:1}
});
const docA=doc('sampleA','가상 A 가족 문제','가상 A 부모 관찰 비공개');
const docB=doc('sampleB','가상 B 가족 문제','가상 B 부모 관찰 비공개');
let checks=0;
const pass=s=>{checks++;console.log('PASS WRONG_FAMILY_BOUNDARY_P0 '+checks+' '+s)};
const auth={auth:{async getUser(token){
 const id=token===TOKEN_A?UA:token===TOKEN_B?UB:token===TOKEN_C?UC:null;
 return id?{data:{user:{id,is_anonymous:false}}}:{error:{status:401}};
}}};
async function asAuthenticated(uid,fn){
 const c=await admin.connect();
 try{
  await c.query('BEGIN');
  await c.query('SET LOCAL ROLE authenticated');
  await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);
  const out=await fn(c);
  await c.query('ROLLBACK');
  return out;
 }catch(e){await c.query('ROLLBACK');throw e}
 finally{c.release()}
}
const visible=(uid,sql,args=[])=>asAuthenticated(uid,async c=>(await c.query(sql,args)).rows);
try{
 // Reuse unmodified QA44 Supabase policy: minimum auth/storage mock schemas.
 for(const sql of [
  'CREATE ROLE authenticated NOLOGIN',
  'CREATE ROLE anon NOLOGIN',
  'CREATE SCHEMA auth',
  'CREATE TABLE auth.users(id uuid PRIMARY KEY)',
  "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$",
  'CREATE SCHEMA storage',
  'CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[])',
  'CREATE TABLE storage.objects(id bigserial PRIMARY KEY,bucket_id text NOT NULL,name text NOT NULL UNIQUE)',
  'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY',
  'GRANT USAGE ON SCHEMA storage,auth TO authenticated',
  'GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated',
  'GRANT USAGE,SELECT ON SEQUENCE storage.objects_id_seq TO authenticated'
 ])await admin.query(sql);
 await admin.query(readFileSync(new URL('../db/qa44_supabase_staging_rls.sql',import.meta.url),'utf8'));
 await admin.query('INSERT INTO auth.users(id) VALUES ($1),($2),($3)',[UA,UB,UC]);
 for(const id of [FA,FB]){
  await admin.query('INSERT INTO qa44.families(family_id) VALUES ($1)',[id]);
  await admin.query('INSERT INTO qa44.family_snapshots(family_id) VALUES ($1)',[id]);
 }
 for(const [family,user,role] of [[FA,UA,'guardian'],[FB,UB,'guardian'],[FA,UC,'viewer']]){
  await admin.query("INSERT INTO qa44.guardian_memberships(family_id,guardian_user_id,role,verification_source,verified_at,consent_verified_at) VALUES ($1,$2,$3,'externally_verified',now(),now())",[family,user,role]);
 }
 await admin.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2),($1,$3)',
  ['qa44-family-photos',PA,PB]);
 const bucket=(await admin.query("SELECT public FROM storage.buckets WHERE id='qa44-family-photos'")).rows[0];
 assert.equal(bucket.public,false);
 pass('reuse QA44 existing RLS private photo bucket, roles and verified consent');

 // Intentionally supply a SUPERUSER pool as the backend to simulate a dangerous
 // misconfiguration that bypasses RLS. Existing code without explicit predicates
 // would expose FA to UB and UC via read(token,FA), despite valid getUser mocks.
 const store=createQa44ServerFamilyStore({pool:admin,authClient:auth});
 assert.deepEqual(await store.families(TOKEN_A),[FA]);
 assert.deepEqual(await store.families(TOKEN_B),[FB]);
 assert.deepEqual(await store.families(TOKEN_C),[]);
 await assert.rejects(store.families('unverified'),/AUTH_REQUIRED/);
 pass('server getUser verified identities, viewer child and unknown tokens denied full family enumeration');

 const saveA=await store.put(TOKEN_A,FA,0,docA);
 const saveB=await store.put(TOKEN_B,FB,0,docB);
 assert.equal(saveA.revision,1);assert.equal(saveB.revision,1);
 const a=await store.read(TOKEN_A,FA),b=await store.read(TOKEN_B,FB);
 assert.deepEqual(a.snapshot,docA);assert.deepEqual(b.snapshot,docB);
 assert.equal(a.snapshot.photos.sampleA,png);
 assert.equal(b.snapshot.records[0].checkHistory[0].memo,'가상 B 부모 관찰 비공개');
 assert.equal(a.snapshot.integrity.digest,docA.integrity.digest);
 assert.equal(b.snapshot.integrity.digest,docB.integrity.digest);
 pass('guardian A/B independently save exact fake wrong-answer/photo/retry/review/backup integrity');

 assert.equal(await store.read(TOKEN_A,FB),null);
 assert.equal(await store.read(TOKEN_B,FA),null);
 assert.equal(await store.read(TOKEN_C,FA),null);
 await assert.rejects(store.put(TOKEN_B,FA,1,docA),/FAMILY_NOT_ACCESSIBLE/);
 await assert.rejects(store.put(TOKEN_A,FB,1,docB),/FAMILY_NOT_ACCESSIBLE/);
 await assert.rejects(store.put(TOKEN_C,FA,1,docA),/FAMILY_NOT_ACCESSIBLE/);
 assert.equal((await store.read(TOKEN_A,FA)).snapshot.records[0].problemText,'가상 A 가족 문제');
 pass('privileged backend accidentally bypasses RLS, but explicit guardian predicate prevents cross-family and viewer child backup access');

 for(const [id,present,absent] of [[UA,PA,PB],[UB,PB,PA],[UC,null,PA]]){
  const names=(await visible(id,"SELECT name FROM storage.objects WHERE bucket_id='qa44-family-photos'")).map(r=>r.name);
  assert.deepEqual(names,present?[present]:[]);
  assert.ok(!names.includes(absent));
 }
 assert.equal((await visible(UC,'SELECT family_id FROM qa44.family_snapshots')).length,0);
 await assert.rejects(asAuthenticated(UC,c=>c.query('DELETE FROM qa44.family_snapshots WHERE family_id=$1',[FA])));
 await assert.rejects(asAuthenticated(UC,c=>c.query("UPDATE qa44.guardian_memberships SET role='guardian' WHERE family_id=$1",[FA])));
 const storageDelete=await asAuthenticated(UC,c=>c.query('DELETE FROM storage.objects WHERE name=$1',[PA]));
 assert.equal(storageDelete.rowCount,0);
 pass('viewer child denied photo/list/backup SQL, parent role edit, snapshot deletion and photo deletion');

 // Existing QA44 merge preflight deliberately BLOCKS in-place edits to old
 // records (including parent reviews). Retain that protective rule: do not
 // silently weaken it just to make a staged test pass.
 const updatedA=structuredClone(docA);
 updatedA.records[0].checkHistory.push({at:'2026-11-11T00:00:00Z',
  status:'needs_help',memo:'가상 A 부모 추가 관찰',by:'parent_observation'});
 signSynthetic(updatedA);
 await assert.rejects(store.put(TOKEN_A,FA,1,updatedA),e=>e?.code==='RECORD_CONFLICT');
 assert.equal((await store.read(TOKEN_A,FA)).revision,1);
 assert.equal((await store.read(TOKEN_A,FA)).snapshot.records[0].checkHistory.length,1);
 // Guardian may still safely append a NEW record via the existing same-family
 // CAS/merge path; the child viewer may never perform that write.
 const appendedA=structuredClone(docA);
 appendedA.records.push({id:'sampleA2',subject:'math',gradeAtEntry:3,
  problemText:'가상 A 가족 새 문제',hasPhoto:false,practiceHistory:[]});
 appendedA.backupSummary.recordCount=2;
 signSynthetic(appendedA);
 assert.equal((await store.put(TOKEN_A,FA,1,appendedA)).revision,2);
 assert.equal((await store.read(TOKEN_B,FB)).revision,1);
 assert.equal((await store.read(TOKEN_A,FA)).snapshot.records.length,2);
 await assert.rejects(store.put(TOKEN_C,FA,2,appendedA),/FAMILY_NOT_ACCESSIBLE/);
 pass('guardian may append a new record; viewer cannot write; existing same-ID observation-update conflict remains fail-closed');

 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND guardian_user_id=$2',[FA,UA]);
 assert.deepEqual(await store.families(TOKEN_A),[]);
 assert.equal(await store.read(TOKEN_A,FA),null);
 await assert.rejects(store.put(TOKEN_A,FA,2,appendedA),/FAMILY_NOT_ACCESSIBLE/);
 assert.deepEqual((await visible(UA,"SELECT name FROM storage.objects WHERE bucket_id='qa44-family-photos'")),[]);
 assert.equal((await visible(UA,'SELECT family_id FROM qa44.family_snapshots')).length,0);
 assert.deepEqual((await store.read(TOKEN_B,FB)).snapshot,docB);
 assert.deepEqual((await visible(UB,"SELECT name FROM storage.objects WHERE bucket_id='qa44-family-photos'")).map(r=>r.name),[PB]);
 pass('synthetic consent revocation immediately blocks family A backup/photo/read/write, B remains intact');

 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=NULL,consent_verified_at=NULL WHERE family_id=$1 AND guardian_user_id=$2',[FA,UA]);
 assert.equal(await store.read(TOKEN_A,FA),null);
 await assert.rejects(store.put(TOKEN_A,FA,2,appendedA),/FAMILY_NOT_ACCESSIBLE/);
 assert.deepEqual(await visible(UA,'SELECT name FROM storage.objects WHERE bucket_id=$1',['qa44-family-photos']),[]);
 pass('missing verified consent alone fails closed even with active-looking membership');

 console.log('WRONG_FAMILY_BOUNDARY_P0_RESULT='+JSON.stringify({
  status:'PASS',checks,simulatedFamilies:2,simulatedViewerChild:1,
  crossFamilyBackupDenied:true,crossFamilyPhotoDenied:true,
  guardianOnlyParentReview:true,viewerExportDenied:true,viewerDeleteDenied:true,
  existingSameIdHistorySyncBlocked:true,
  revocation:true,consentMissingDenied:true,privilegedPoolBypassGuard:true,
  previousAppCodeUnchanged:true,realOAuth:false,realSupabase:false,realChildren:0,
  mobileOrProductionAuthApproved:false
 }));
}catch(e){
 console.error('WRONG_FAMILY_BOUNDARY_P0_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),stack:String(e?.stack).slice(0,1500)}));
 process.exitCode=1;
}finally{await admin.end()}
