// P5 only: ephemeral PG16 synthetic fixture, no A/production data or restore writes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {exportSyntheticBundle,preflightSyntheticImport} from '../scripts/wrong-p5-synthetic-bundle-preflight.mjs';
if(process.env.QA44_STAGE_ONLY!=='1'||process.env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1'||
 process.env.WRONG_P5_SYNTHETIC_BUNDLE_ONLY!=='1'||!process.env.QA39_TEST_DATABASE_URL?.includes('127.0.0.1'))
 throw Error('P5_SYNTHETIC_PG16_ONLY');
const hash=s=>createHash('sha256').update(s).digest('hex');
const pool=new pg.Pool({connectionString:process.env.QA39_TEST_DATABASE_URL});
const FA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',FB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const snap=(id)=>JSON.stringify({format:'uriaimath-offline-backup-v02',records:[
 {id:'r-'+id,generalRetryHistory:[{at:'2026-11-11T00:00:00Z',answer:'A',explanation:'가상 풀이'}]}]});
let count=0;const pass=s=>{count++;console.log('PASS WRONG_P5 '+count+' '+s)};
const err=code=>e=>e?.code===code;
try{
 await pool.query('CREATE TEMP TABLE p5_bundle_fixture(family_id text,revision int,snapshot_text text,child_events jsonb,parent_events jsonb)');
 const child=id=>[{family_id:id,record_id:'r-'+id,child_user_id:'child-'+id,
  request_id:'retry-1',applied_revision:2,attempt_json:{at:'2026-11-11T00:00:00Z',answer:'A',explanation:'가상 풀이'}}];
 const parent=id=>[{family_id:id,record_id:'r-'+id,guardian_user_id:'parent-'+id,
  request_id:'observe-1',child_user_id:'child-'+id,child_request_id:'retry-1',applied_revision:3}];
 for(const id of [FA,FB])await pool.query('INSERT INTO p5_bundle_fixture VALUES($1,3,$2,$3,$4)',
  [id,snap(id),JSON.stringify(child(id)),JSON.stringify(parent(id))]);
 const rows=(await pool.query('SELECT * FROM p5_bundle_fixture ORDER BY family_id')).rows;
 assert.equal(rows.length,2);
 const input=row=>({familyId:row.family_id,revision:row.revision,snapshotText:row.snapshot_text,
  snapshotHash:hash(row.snapshot_text),childEvents:row.child_events,parentEvents:row.parent_events});
 const a=input(rows[0]),b=input(rows[1]);
 const original=JSON.stringify(rows);
 const bundle=exportSyntheticBundle(a);
 const good=preflightSyntheticImport(bundle,{expectedFamilyId:FA,expectedRevision:3});
 assert.deepEqual({passed:good.preflightPassed,safe:good.safeToRestore,child:good.childCount,parent:good.parentCount},
  {passed:true,safe:false,child:1,parent:1});
 pass('PG16 synthetic v02+B2+B3 export and matching import preflight, restore remains disabled');
 assert.throws(()=>preflightSyntheticImport(bundle,{expectedFamilyId:FB,expectedRevision:3}),err('FAMILY_CONTEXT_MISMATCH'));
 assert.throws(()=>preflightSyntheticImport(bundle,{expectedFamilyId:FA,expectedRevision:4}),err('REVISION_CONTEXT_MISMATCH'));
 pass('foreign family and stale target revision fail closed');
 const corrupt=JSON.parse(bundle);corrupt.parentEvents[0].request_id='forged';
 assert.throws(()=>preflightSyntheticImport(JSON.stringify(corrupt),{expectedFamilyId:FA,expectedRevision:3}),err('BUNDLE_DIGEST_MISMATCH'));
 pass('tampered parent observation fails integrity check');
 const missing=JSON.parse(bundle);missing.parentEvents=[];
 const {bundleSha256:old,...payload}=missing;
 missing.bundleSha256=hash(JSON.stringify(payload));
 assert.throws(()=>preflightSyntheticImport(JSON.stringify(missing),{expectedFamilyId:FA,expectedRevision:3}),err('EVENT_REVISION_GAP'));
 pass('omitted guardian event rejected even if untrusted bundle digest recalculated');
 const foreign=JSON.parse(bundle);foreign.parentEvents=b.parentEvents;
 const {bundleSha256:old2,...payload2}=foreign;foreign.bundleSha256=hash(JSON.stringify(payload2));
 assert.throws(()=>preflightSyntheticImport(JSON.stringify(foreign),{expectedFamilyId:FA,expectedRevision:3}),err('FOREIGN_FAMILY_EVENT'));
 pass('cross-family guardian event rejected');
 assert.equal(JSON.stringify((await pool.query('SELECT * FROM p5_bundle_fixture ORDER BY family_id')).rows),original);
 pass('PostgreSQL synthetic source rows unchanged; no restore executed');
 console.log('WRONG_P5_BUNDLE_RESULT='+JSON.stringify({status:'PASS',checks:count,
  syntheticFamilies:2,restoreImplemented:false,safeToRestore:false,realUsers:false,realDB:false}));
}catch(e){console.error('WRONG_P5_BUNDLE_RESULT='+JSON.stringify({status:'FAIL',checks:count,error:String(e),stack:e.stack}));process.exitCode=1}
finally{await pool.end()}
