// 02 WRONG / 00T-02-ACK-CORE, 2026-11-22
// NEW combined synthetic contract only. Not integrated into index.html.
// No browser, live IndexedDB, real server, family account, real child/photo data.
// Unlike older V8 CAS probe, this specifically models lost-ACK readback-first,
// approval revision invalidation, request-ID pairing and late ACK rejection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const photo=Buffer.from('QA_SYNTHETIC_PHOTO_BYTES_NOT_REAL_PHOTO_20261122');
const PHOTO_HASH=hash(photo);

class QaOnlyLedger {
  constructor(){this.rows=new Map();this.events=[];this.posts=0;this.reads=0;}
  async post(request,{loseAck=false}={}){
    this.posts++;this.events.push({method:'POST',revision:request.revision,requestId:request.requestId});
    const previous=this.rows.get(request.id);
    if(previous&&request.revision<=previous.revision){
      return {code:409,revision:previous.revision,requestId:request.requestId};
    }
    const committed={...request,photoBytes:Buffer.from(photo)};
    this.rows.set(request.id,committed);
    const ack={code:200,id:request.id,revision:request.revision,requestId:request.requestId};
    if(loseAck)throw Object.assign(new Error('SYNTHETIC_ACK_DROPPED_AFTER_COMMIT'),{code:'ACK_UNKNOWN',ack});
    return ack;
  }
  async read(id){this.reads++;this.events.push({method:'GET',id});const row=this.rows.get(id);return row?{...row,photoBytes:Buffer.from(row.photoBytes)}:null;}
}

class QaOnlyRevisionGate {
  constructor(ledger){
    this.ledger=ledger;
    this.id='qa-record-r1-r2-single';
    this.revision=1;
    this.problemText='r1 synthetic problem';
    this.photoSha256=PHOTO_HASH;
    this.approvedRevision=null;
    this.requestId=null;
    this.nextRequest=0;
    this.unknown=null;
    this.confirmedRevision=null;
  }
  approve(){this.approvedRevision=this.revision;this.requestId='qa-request-'+(++this.nextRequest);return this.requestId;}
  parentEdit(problemText){
    assert.ok(typeof problemText==='string'&&problemText.length>0);
    this.revision++;
    this.problemText=problemText;
    this.approvedRevision=null;
    this.requestId=null;
    // IMPORTANT: do NOT forget an earlier ambiguous write merely because
    // the user edited the local draft. It must be reconciled before any POST.
  }
  onAck(ack){
    if(!ack||ack.id!==this.id||ack.revision!==this.revision||ack.requestId!==this.requestId||this.approvedRevision!==this.revision)
      return 'STALE_ACK_IGNORED';
    // Identity agreement alone must never elevate HTTP 4xx/5xx to a saved ACK.
    // This gate is a QA-only model; real product/transport remain unverified.
    if(ack.code!==200||ack.ok===false)return 'ACK_FAILURE_NOT_CONFIRMED';
    this.confirmedRevision=ack.revision;
    return 'CURRENT_ACK_CONFIRMED';
  }
  async reconcileUnknown(){
    if(!this.unknown)return {status:'NO_UNKNOWN'};
    const previous=this.unknown;
    const current=await this.ledger.read(this.id);
    if(!current||current.revision!==previous.revision||current.requestId!==previous.requestId||current.photoSha256!==previous.photoSha256||current.problemText!==previous.problemText||!Buffer.isBuffer(current.photoBytes)||hash(current.photoBytes)!==previous.photoSha256)
      return {status:'READBACK_MISMATCH_BLOCK',posts:this.ledger.posts};
    this.unknown=null;
    const ackState=this.onAck({code:200,id:previous.id,revision:previous.revision,requestId:previous.requestId});
    return {status:'READBACK_MATCH_NO_POST',ackState,posts:this.ledger.posts};
  }
  async save({loseAck=false}={}){
    if(this.unknown){
      // Readback first. This invocation is never allowed to issue a new POST.
      return this.reconcileUnknown();
    }
    if(this.approvedRevision!==this.revision||!this.requestId)
      return {status:'APPROVAL_REQUIRED'};
    const req={id:this.id,revision:this.revision,requestId:this.requestId,
      problemText:this.problemText,photoSha256:this.photoSha256};
    try{
      const ack=await this.ledger.post(req,{loseAck});
      if(ack.code!==200)return {status:'POST_REJECTED',code:ack.code};
      return {status:this.onAck(ack)};
    }catch(e){
      if(e.code!=='ACK_UNKNOWN')throw e;
      this.unknown=req;
      return {status:'ACK_UNKNOWN_READBACK_REQUIRED',requestId:req.requestId};
    }
  }
}

const tests=[];
test('parent r1 approval is invalid after r2 edit; no POST before new approval',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  gate.approve();gate.parentEdit('r2 corrected problem');
  assert.equal(gate.approvedRevision,null);
  assert.equal(gate.requestId,null);
  assert.equal((await gate.save()).status,'APPROVAL_REQUIRED');
  assert.equal(ledger.posts,0);
  tests.push('r1 approval invalidated after parent revision change');
});
test('ambiguous r1 ACK -> readback first -> r2 approved write; stale r1 ACK cannot overwrite r2/photo',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  const r1Id=gate.approve();
  assert.equal((await gate.save({loseAck:true})).status,'ACK_UNKNOWN_READBACK_REQUIRED');
  assert.equal(ledger.posts,1);
  gate.parentEdit('r2 corrected parent text');
  // Even when the parent has edited, the first next save only reads back r1.
  const recover=await gate.save();
  assert.equal(recover.status,'READBACK_MATCH_NO_POST');
  assert.equal(recover.ackState,'STALE_ACK_IGNORED');
  assert.equal(ledger.posts,1);
  assert.deepEqual(ledger.events.map(x=>x.method),['POST','GET']);
  assert.equal((await gate.save()).status,'APPROVAL_REQUIRED');
  const r2Id=gate.approve();assert.notEqual(r2Id,r1Id);
  assert.equal((await gate.save()).status,'CURRENT_ACK_CONFIRMED');
  assert.deepEqual(ledger.events.map(x=>x.method),['POST','GET','POST']);
  assert.equal(gate.onAck({code:200,id:gate.id,revision:1,requestId:r1Id}),'STALE_ACK_IGNORED');
  const after=await ledger.read(gate.id);
  assert.equal(after.revision,2);
  assert.equal(after.problemText,'r2 corrected parent text');
  assert.equal(after.photoSha256,PHOTO_HASH);
  assert.equal(hash(after.photoBytes),PHOTO_HASH);
  assert.equal(gate.confirmedRevision,2);
  assert.equal(ledger.posts,2);
  tests.push('readback GET precedes new POST; r1 late ack ignored; r2/photo unchanged');
});
test('readback mismatch is fail closed, does not re-POST ambiguous r1',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  gate.approve();
  assert.equal((await gate.save({loseAck:true})).status,'ACK_UNKNOWN_READBACK_REQUIRED');
  // Synthetic server might return data with a mismatched requestId.
  ledger.rows.set(gate.id,{...ledger.rows.get(gate.id),requestId:'unexpected-request'});
  const one=await gate.save(),two=await gate.save();
  assert.equal(one.status,'READBACK_MISMATCH_BLOCK');
  assert.equal(two.status,'READBACK_MISMATCH_BLOCK');
  assert.equal(ledger.posts,1);
  assert.deepEqual(ledger.events.map(x=>x.method),['POST','GET','GET']);
  tests.push('unknown-result mismatch blocks every new POST');
});
test('readback matching revision/request/photo but changed problem text blocks without re-POST',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  gate.approve();
  assert.equal((await gate.save({loseAck:true})).status,'ACK_UNKNOWN_READBACK_REQUIRED');
  const original=ledger.rows.get(gate.id);
  ledger.rows.set(gate.id,{...original,problemText:'SYNTHETIC_TAMPERED_PROBLEM_TEXT'});
  const result=await gate.save();
  assert.equal(result.status,'READBACK_MISMATCH_BLOCK');
  assert.equal(gate.confirmedRevision,null);
  assert.equal(ledger.posts,1);
  assert.deepEqual(ledger.events.map(x=>x.method),['POST','GET']);
  assert.equal(hash((await ledger.read(gate.id)).photoBytes),PHOTO_HASH);
  tests.push('problem text mismatch fails closed; original photo preserved and no second POST');
});
test('readback declared photo hash unchanged but actual photo bytes altered blocks without re-POST',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  gate.approve();
  assert.equal((await gate.save({loseAck:true})).status,'ACK_UNKNOWN_READBACK_REQUIRED');
  const original=ledger.rows.get(gate.id);
  const tampered=Buffer.from('QA_SYNTHETIC_TAMPERED_PHOTO_BYTES');
  assert.notEqual(hash(tampered),PHOTO_HASH);
  ledger.rows.set(gate.id,{...original,photoBytes:tampered});
  const result=await gate.save();
  assert.equal(result.status,'READBACK_MISMATCH_BLOCK');
  assert.equal(gate.confirmedRevision,null);
  assert.equal(gate.unknown.requestId,original.requestId);
  assert.equal(ledger.posts,1);
  assert.deepEqual(ledger.events.map(x=>x.method),['POST','GET']);
  assert.equal(ledger.rows.get(gate.id).photoSha256,PHOTO_HASH);
  tests.push('declared hash unchanged but tampered actual photo bytes fail closed without retry POST');
});
test('wrong requestId or wrong revision ACK cannot confirm the current r2',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  gate.parentEdit('new text');const correct=gate.approve();
  assert.equal(gate.onAck({id:gate.id,revision:2,requestId:'old-request'}),'STALE_ACK_IGNORED');
  assert.equal(gate.onAck({id:gate.id,revision:1,requestId:correct}),'STALE_ACK_IGNORED');
  assert.equal(gate.confirmedRevision,null);
  assert.equal(ledger.posts,0);
  tests.push('mismatched id/revision/requestId cannot acknowledge current content');
});
test('matching requestId/revision with 409 or 503 must not confirm saved ACK',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  gate.parentEdit('new r2');const current=gate.approve();
  for(const code of [409,503]){
    const result=gate.onAck({code,id:gate.id,revision:2,requestId:current});
    assert.equal(result,'ACK_FAILURE_NOT_CONFIRMED','wrongly confirmed failed '+code);
    assert.equal(gate.confirmedRevision,null);
  }
  assert.equal(ledger.posts,0);
  tests.push('HTTP 409/503 matching identity cannot confirm current revision');
});
test('explicit unsuccessful 200 or missing response code cannot confirm',async()=>{
  const ledger=new QaOnlyLedger(),gate=new QaOnlyRevisionGate(ledger);
  gate.parentEdit('new r2');const current=gate.approve();
  const base={id:gate.id,revision:2,requestId:current};
  for(const ack of [{...base,code:200,ok:false},{...base}]){
    assert.equal(gate.onAck(ack),'ACK_FAILURE_NOT_CONFIRMED');
    assert.equal(gate.confirmedRevision,null);
  }
  assert.equal(gate.onAck({...base,code:200,ok:true}),'CURRENT_ACK_CONFIRMED');
  assert.equal(gate.confirmedRevision,2);
  assert.equal(ledger.posts,0);
  tests.push('explicit unsuccessful/missing HTTP success rejected; 200 confirmed');
});
// Node --test TAP output is the execution proof; this is only synthetic.
process.on('exit',()=>{
  console.log('WRONG_ACK_R2_CONTRACT_SCOPE='+JSON.stringify({
    testChecks:tests,synthetic:true,actualProductIntegration:false,
    actualBrowser:false,actualIndexedDb:false,actualHTTP:false,
    actualFamilyAuth:false,originalPhotoHash:PHOTO_HASH,
    devMainModified:false,deploy:false,safeToRestore:false
  }));
});
