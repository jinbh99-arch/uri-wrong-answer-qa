// QA70 isolated metadata-only test. Fictional endpoints, refs and evidence labels.
// Does not call the network, login, mutate any DB, or read production secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {auditWrongPreviewBoundary as audit} from '../scripts/qa70-wrong-photo-boundary-audit.mjs';

const refA='aaaaaaaaaaaaaaaaaaaa',refB='bbbbbbbbbbbbbbbbbbbb';
const sha='1234567890abcdef1234567890abcdef12345678';
function fictional(){
 return {
  qa:{databaseProjectRef:refA,photoProjectRef:refA,
   photoBucketId:'fictional-qa-photos',photoBucketPrivate:true},
  operational:{databaseProjectRef:refB,databaseSource:'fictional read-only provider observation',
   photoProjectRef:refB,photoBucketId:'fictional-production-photos',
   photoSource:'fictional read-only provider observation'},
  web:{publicUrl:'https://public.example/qa/',previewUrl:'https://private-preview.example/',
   operationalUrl:'https://operations.example/',unauthenticatedStatus:403,
   authenticatedStatus:200,accessEvidence:'fictional protected GET observation',
   fictionalOnly:true,fictionalEvidence:'fictional synthetic-only content evidence',
   expectedDevSha:sha,deployedDevSha:sha,observedAt:new Date(Date.now()-60000).toISOString()}
 };
}
const codes=e=>audit(e).blockers.map(x=>x.code);
test('same database reference is rejected even if bucket names differ',()=>{
 const e=fictional();e.operational.databaseProjectRef=refA;
 assert.ok(codes(e).includes('DB_PROJECT_SHARED'));
});
test('same photo project is rejected regardless of differing private bucket names',()=>{
 const e=fictional();e.operational.photoProjectRef=refA;
 assert.ok(codes(e).includes('PHOTO_PROJECT_SHARED'));
});
test('a missing real operational project cannot pass when staging metadata is known',()=>{
 const e=fictional();delete e.operational;
 const r=audit(e);
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.blockers.some(b=>b.code==='OPERATIONAL_DB_ID_MISSING'));
 assert.ok(r.blockers.some(b=>b.code==='OPERATIONAL_PHOTO_ID_MISSING'));
});
test('staging private bucket evidence is required independently of project ref',()=>{
 const e=fictional();e.qa.photoBucketPrivate=false;
 assert.ok(codes(e).includes('QA_PHOTO_ID_MISSING'));
});
test('the public origin must differ from the private external preview',()=>{
 const e=fictional();e.web.previewUrl=e.web.publicUrl;
 assert.ok(codes(e).includes('EXTERNAL_PRIVATE_ORIGIN_NOT_PROVED'));
});
test('localhost Basic Auth never proves an external private URL',()=>{
 const e=fictional();e.web.previewUrl='http://127.0.0.1:4173/';
 assert.ok(codes(e).includes('EXTERNAL_PRIVATE_ORIGIN_NOT_PROVED'));
});
test('no anonymous rejection means Access not verified',()=>{
 const e=fictional();e.web.unauthenticatedStatus=200;
 assert.ok(codes(e).includes('EXTERNAL_ACCESS_NOT_PROVED'));
});
test('no authenticated success means Access not verified',()=>{
 const e=fictional();e.web.authenticatedStatus=401;
 assert.ok(codes(e).includes('EXTERNAL_ACCESS_NOT_PROVED'));
});
test('fictional-only data evidence must be explicit',()=>{
 const e=fictional();e.web.fictionalEvidence='';
 assert.ok(codes(e).includes('FICTIONAL_ONLY_NOT_PROVED'));
});
test('deployed SHA must exactly match stated development SHA',()=>{
 const e=fictional();e.web.deployedDevSha='a'.repeat(40);
 assert.ok(codes(e).includes('DEPLOYED_SHA_TIME_NOT_PROVED'));
});
test('a future or missing observation timestamp cannot prove deployment',()=>{
 const e=fictional();e.web.observedAt='2099-01-01T00:00:00Z';
 assert.ok(codes(e).includes('DEPLOYED_SHA_TIME_NOT_PROVED'));
});
test('all fictional fields present is not external verification',()=>{
 const r=audit(fictional());
 assert.equal(r.status,'STRUCTURALLY_READY_NOT_LIVE_VERIFIED');
 assert.equal(r.structurallyComplete,true);
 assert.equal(r.externallyVerified,false);
 assert.equal(r.safeToRestore,false);
});
test('result never echoes supplied secrets or actual identifiers',()=>{
 const e=fictional();e.password='FAKE_SECRET_SHOULD_NOT_BE_RETURNED';
 const serialized=JSON.stringify(audit(e));
 assert.ok(!serialized.includes(e.password));
 assert.ok(!serialized.includes(e.qa.databaseProjectRef));
 assert.ok(!serialized.includes(e.operational.databaseProjectRef));
});
test('an empty observation fails closed without exceptions',()=>{
 const r=audit({});
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.externallyVerified,false);
 assert.equal(r.safeToRestore,false);
 assert.ok(r.blockers.length>=5);
});
