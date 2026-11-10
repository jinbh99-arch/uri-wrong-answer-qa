// WRONG P1 synthetic child retry authorization & versioned append/CAS.
// Uses existing QA44 guardian store + existing backup signature with a stage-ONLY
// SQL extension. No real IdP, actual children, deployed app, or mobile sign-in.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createQa44ServerFamilyStore} from '../scripts/qa44-supabase-family-store.mjs';
import {signSynthetic} from '../scripts/qa-family-merge-preflight.mjs';
const conn=process.env.QA39_TEST_DATABASE_URL;
if(!conn?.includes('127.0.0.1')||process.env.QA44_STAGE_ONLY!=='1'||
 process.env.QA44_SYNTHETIC_CHILD_ONLY!=='1')
 throw Error('QA_SYNTHETIC_CHILD_PG_ONLY');
const {Pool}=pg;
const admin=new Pool({connectionString:conn});
const childPool=new Pool({connectionString:conn});
const writer={connect:async()=>{
 const c=await childPool.connect();
 await c.query('SET ROLE qa44_child_retry_writer');
 return c;
}};
const FA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UA='11111111-1111-4111-8111-111111111111';
const UB='22222222-2222-4222-8222-222222222222';
const CA='33333333-3333-4333-8333-333333333333';
const CB='44444444-4444-4444-8444-444444444444';
const CX='55555555-5555-4555-8555-555555555555';
const TOKENS=new Map([
 ['synthetic-guardian-A-'+'a'.repeat(64),UA],
 ['synthetic-guardian-B-'+'b'.repeat(64),UB],
 ['synthetic-child-A-'+'c'.repeat(64),CA],
 ['synthetic-child-B-'+'d'.repeat(64),CB],
 ['synthetic-child-ungranted-'+'e'.repeat(64),CX],
]);
const tokens=[...TOKENS.keys()];
const [TA,TB,TCA,TCB,TCX]=tokens;
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO3L3YcAAAAASUVORK5CYII=';
const auth={auth:{async getUser(token){
 const id=TOKENS.get(token);
 return id?{data:{user:{id,is_anonymous:false}}}:{error:{status:401}};
}}};
const mkRecord=(id,problemText,hasPhoto=false)=>({
 id,subject:id==='mathA'?'math':'korean',gradeAtEntry:3,
 problemText,hasPhoto,createdAt:'2026-11-10T13:00:00.000Z',
 generalRetryHistory:[],checkHistory:[{at:'2026-11-10T12:00:00.000Z',status:'explained',
  memo:'부모 전용 합성 관찰',by:'parent_observation'}],
 studentAnswer:'부모 작성 답변 · 아이 공개 금지',
 memo:'부모 비공개 메모',studyPlan:null,practiceHistory:[],followupHistory:[]
});
const mkBackup=(family,records)=>{
 const photos=Object.create(null);
 for(const record of records)if(record.hasPhoto)photos[record.id]=PNG;
 return signSynthetic({
  format:'uriaimath-offline-backup-v02',
  profile:{grade:3,nickname:'QA-SYNTHETIC-'+family},
  records,photos,backupSummary:{recordCount:records.length,photoCount:Object.keys(photos).length}
 });
};
const backupA=mkBackup('FAMILY-A',[
 mkRecord('mathA','가상 A 아이가 보는 덧셈 7+5?',true),
 mkRecord('hiddenA','가상 A 같은 가족 미허용 문제',true)]);
const backupB=mkBackup('FAMILY-B',[mkRecord('koreanB','가상 B 문장의 중심 생각',true)]);
const P='수학 풀이에서 7과 5를 더했어요.';
let checks=0;const pass=t=>{checks++;console.log('PASS WRONG_CHILD_MIN_PRIV_CAS '+checks+' '+t)};
async function asClientRole(user,sql,params=[]){
 const c=await admin.connect();
 try{
  await c.query('BEGIN');
  await c.query('SET LOCAL ROLE authenticated');
  await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user]);
  const ret=await c.query(sql,params);
  await c.query('ROLLBACK');
  return ret;
 }catch(e){await c.query('ROLLBACK');throw e}
 finally{c.release()}
}
function assertNoParents(doc){
 const raw=JSON.stringify(doc);
 for(const x of ['부모 전용 합성 관찰','부모 비공개 메모','부모 작성 답변','hiddenA','QA-SYNTHETIC-FAMILY-A'])
  assert.ok(!raw.includes(x),'child response contains private value '+x);
}
async function revision(family){
 return Number((await admin.query('SELECT revision FROM qa44.family_snapshots WHERE family_id=$1',[family])).rows[0].revision);
}
try{
 for(const statement of [
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
 ])await admin.query(statement);
 await admin.query(readFileSync(new URL('../db/qa44_supabase_staging_rls.sql',import.meta.url),'utf8'));
 await admin.query(readFileSync(new URL('../db/qa44_child_retry_stage_only.sql',import.meta.url),'utf8'));
 for(const user of [UA,UB,CA,CB,CX])await admin.query('INSERT INTO auth.users(id) VALUES($1)',[user]);
 for(const family of [FA,FB]){
  await admin.query('INSERT INTO qa44.families(family_id) VALUES($1)',[family]);
  await admin.query('INSERT INTO qa44.family_snapshots(family_id) VALUES($1)',[family]);
 }
 for(const [family,guardian] of [[FA,UA],[FB,UB]]){
  await admin.query("INSERT INTO qa44.guardian_memberships(family_id,guardian_user_id,role,verification_source,verified_at,consent_verified_at) VALUES($1,$2,'guardian','externally_verified',now(),now())",[family,guardian]);
 }
 for(const [family,child,record] of [[FA,CA,'mathA'],[FB,CB,'koreanB']]){
  await admin.query("INSERT INTO qa44.child_retry_grants(family_id,child_user_id,record_id,role,consent_verified_at) VALUES($1,$2,$3,'child',now())",[family,child,record]);
 }
 // Nobody gets child_retry_writer via client auth; only server-private role.
 await assert.rejects(asClientRole(CA,'SELECT * FROM qa44.child_retry_events'));
 await assert.rejects(asClientRole(CA,"INSERT INTO qa44.child_retry_grants(family_id,child_user_id,record_id) VALUES($1,$2,'hiddenA')",[FA,CA]));
 pass('existing guardian RLS preserved; new child-grant/event tables deny browser direct access');

 const guardian=createQa44ServerFamilyStore({pool:admin,authClient:auth});
 const child=createQa44ServerFamilyStore({pool:writer,authClient:auth});
 assert.equal((await guardian.put(TA,FA,0,backupA)).revision,1);
 assert.equal((await guardian.put(TB,FB,0,backupB)).revision,1);
 assert.equal(await revision(FA),1);
 assert.equal(await revision(FB),1);
 pass('two synthetic families initialize independent full SHA256 backups with photo, observations, prior structure');

 assert.deepEqual(await guardian.families(TCA),[]);
 assert.equal(await guardian.read(TCA,FA),null);
 await assert.rejects(guardian.put(TCA,FA,1,backupA),/FAMILY_NOT_ACCESSIBLE/);
 await assert.rejects(guardian.put(TCA,FB,1,backupB),/FAMILY_NOT_ACCESSIBLE/);
 await assert.rejects(guardian.families('forged-token'),/AUTH_REQUIRED/);
 pass('child cannot invoke full backup read/export/put or forge guardian authority');

 const selected=await child.childRead(TCA,FA,'mathA');
 assert.equal(selected.revision,1);
 assert.equal(selected.record.photo,PNG);
 assert.equal(selected.record.problemText,'가상 A 아이가 보는 덧셈 7+5?');
 assert.deepEqual(selected.ownAttempts,[]);
 assertNoParents(selected);
 assert.equal(await child.childRead(TCA,FA,'hiddenA'),null);
 assert.equal(await child.childRead(TCA,FB,'koreanB'),null);
 assert.equal(await child.childRead(TCB,FA,'mathA'),null);
 assert.equal(await child.childRead(TCX,FA,'mathA'),null);
 pass('child sees only allowed record/photo, no parent memo, observation, full backup or other family IDs');

 const invalid=[
  {answer:'12',explanation:P,review:'explained'},
  {answer:'12',explanation:P,checkHistory:[]},
  {answer:'12',explanation:P,photos:{mathA:'forgery'}},
  {answer:'',explanation:P},
  {answer:'x'.repeat(501),explanation:P},
  {answer:'12',explanation:P,at:'2026-11-10T00:00:00Z'},
 ];
 for(const input of invalid)await assert.rejects(
  child.childAppend(TCA,FA,'mathA',1,'client-BadRequest0001',input),
  /CHILD_RETRY_FIELDS_DENIED/);
 assert.equal(await revision(FA),1);
 await assert.rejects(child.childAppend(TCA,FA,'hiddenA',1,'child-privilege-0001',{answer:'12',explanation:P}),/CHILD_RECORD_NOT_ACCESSIBLE/);
 await assert.rejects(child.childAppend(TCB,FA,'mathA',1,'cross-family-0001',{answer:'12',explanation:P}),/CHILD_RECORD_NOT_ACCESSIBLE/);
 pass('reject forged parent review, edits, image replacement, invalid input, ungranted & cross-family IDs, zero mutations');

 const input={answer:'12',explanation:P},request='child-attempt-A-001';
 const first=await child.childAppend(TCA,FA,'mathA',1,request,input);
 assert.deepEqual(first,{stored:true,duplicate:false,revision:2});
 const firstState=(await guardian.read(TA,FA)).snapshot;
 assert.equal(firstState.records.length,2);
 assert.equal(firstState.records[0].generalRetryHistory.length,1);
 assert.deepEqual(firstState.records[0].generalRetryHistory[0].review,'not_checked');
 assert.equal(firstState.records[0].generalRetryHistory[0].answer,'12');
 assert.equal(firstState.records[0].checkHistory[0].memo,'부모 전용 합성 관찰');
 assert.deepEqual(firstState.photos,backupA.photos);
 assert.equal(firstState.integrity.algorithm,'SHA-256');
 assert.equal((await child.childRead(TCA,FA,'mathA')).ownAttempts.length,1);
 assertNoParents(await child.childRead(TCA,FA,'mathA'));
 pass('child appends only own answer/explanation, server sets unreviewed; guardian parent observations, photo & signed backup remain intact');

 const again=await child.childAppend(TCA,FA,'mathA',1,request,input);
 assert.deepEqual(again,{stored:true,duplicate:true,revision:2});
 const childReopened=createQa44ServerFamilyStore({pool:writer,authClient:auth});
 assert.deepEqual(await childReopened.childAppend(TCA,FA,'mathA',1,request,input),again);
 assert.equal(await revision(FA),2);
 assert.equal((await guardian.read(TA,FA)).snapshot.records[0].generalRetryHistory.length,1);
 await assert.rejects(child.childAppend(TCA,FA,'mathA',1,request,{answer:'13',explanation:P}),/REQUEST_ID_REUSED/);
 await assert.rejects(child.childAppend(TCA,FA,'mathA',1,'child-attempt-A-002',input),/STALE_REVISION/);
 pass('duplicate request stable after new store instance; same event ID + different payload and stale revision fail closed');

 const before=2;
 const twin=await Promise.allSettled([
  child.childAppend(TCA,FA,'mathA',before,'child-attempt-A-003',{answer:'11',explanation:'첫 번째 가상 제출'}),
  childReopened.childAppend(TCA,FA,'mathA',before,'child-attempt-A-004',{answer:'13',explanation:'두 번째 가상 제출'})
 ]);
 assert.equal(twin.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(twin.filter(x=>x.status==='rejected').length,1);
 assert.equal(twin.find(x=>x.status==='rejected').reason.code,'STALE_REVISION');
 assert.equal(await revision(FA),3);
 assert.equal((await guardian.read(TA,FA)).snapshot.records[0].generalRetryHistory.length,2);
 assert.equal((await child.childRead(TCA,FA,'mathA')).ownAttempts.length,2);
 pass('two simultaneous same-base events produce one CAS success and one stale failure; no lost history');

 const edited=structuredClone((await guardian.read(TA,FA)).snapshot);
 edited.records[0].checkHistory.push({at:new Date().toISOString(),status:'explained',memo:'추가 부모 관찰',by:'parent_observation'});
 signSynthetic(edited);
 await assert.rejects(guardian.put(TA,FA,3,edited),e=>e?.code==='RECORD_CONFLICT');
 assert.equal(await revision(FA),3);
 assert.equal((await guardian.read(TA,FA)).snapshot.records[0].checkHistory.length,1);
 pass('existing guardian same-ID RECORD_CONFLICT policy remains strict; no implicit overwrite/merge of child attempt or parent review');

 await admin.query('UPDATE qa44.child_retry_grants SET revoked_at=now() WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 assert.equal(await child.childRead(TCA,FA,'mathA'),null);
 await assert.rejects(child.childAppend(TCA,FA,'mathA',3,'child-after-revoke-001',input),/CHILD_RECORD_NOT_ACCESSIBLE/);
 await assert.rejects(child.childAppend(TCA,FA,'mathA',1,request,input),/CHILD_RECORD_NOT_ACCESSIBLE/);
 assert.equal(await revision(FA),3);
 assert.equal((await guardian.read(TB,FB)).snapshot.records[0].id,'koreanB');
 assert.equal((await child.childRead(TCB,FB,'koreanB')).record.photo,PNG);
 pass('child grant revocation invalidates even idempotent replay; other family and parent backups survive');

 await admin.query('UPDATE qa44.child_retry_grants SET revoked_at=NULL,consent_verified_at=NULL WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 assert.equal(await child.childRead(TCA,FA,'mathA'),null);
 await admin.query('UPDATE qa44.child_retry_grants SET consent_verified_at=now() WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 await admin.query('UPDATE qa44.guardian_memberships SET revoked_at=now() WHERE family_id=$1 AND guardian_user_id=$2',[FA,UA]);
 assert.equal(await child.childRead(TCA,FA,'mathA'),null);
 await assert.rejects(child.childAppend(TCA,FA,'mathA',3,'child-parentrevoke-01',input),/CHILD_RECORD_NOT_ACCESSIBLE/);
 assert.equal((await guardian.read(TB,FB)).snapshot.records[0].id,'koreanB');
 pass('child missing consent and guardian revocation both deny new read/append without affecting other family');

 const ev=await admin.query('SELECT count(*)::int AS n FROM qa44.child_retry_events WHERE family_id=$1 AND child_user_id=$2',[FA,CA]);
 assert.equal(ev.rows[0].n,2);
 assert.equal(await revision(FA),3);
 assert.deepEqual((await admin.query('SELECT snapshot_text FROM qa44.family_snapshots WHERE family_id=$1',[FB])).rows[0].snapshot_text,JSON.stringify(backupB));
 pass('durable per-child event ledger contains exactly two appended events; other family unchanged');

 console.log('WRONG_CHILD_MIN_PRIV_CAS_RESULT='+JSON.stringify({
  status:'PASS',checks,source:'synthetic PostgreSQL16 stage-only',
  families:2,childAccounts:2,permissions:'guardian backup; child allowlisted read and append only',
  perRecordPhoto:true,parentNotesHidden:true,guardianBackupPreserved:true,
  noAutomaticCorrectness:true,duplicateDurable:true,staleCasDenied:true,
  sameIdConflictUnchanged:true,childGrantRevocation:true,guardianRevocation:true,
  realIdp:false,realSupabase:false,realChildren:0,operatingDeployment:false
 }));
}catch(e){
 console.error('WRONG_CHILD_MIN_PRIV_CAS_RESULT='+JSON.stringify({
  status:'FAIL',checks,error:String(e),code:e?.code,stack:String(e?.stack).slice(0,1600)}));
 process.exitCode=1;
}finally{await childPool.end();await admin.end()}
