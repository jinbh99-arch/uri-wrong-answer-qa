// ISOLATED QA ONLY; not imported by product index.html or used for real auth.
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function createQaPendingAckGate({requestId,recordId,expectedRevision,signedSnapshot,initialDraft}){
 if(typeof requestId!=='string'||requestId.length<4||typeof recordId!=='string'||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('INVALID_PENDING_ACK_METADATA');
 if(!signedSnapshot?.records?.some(x=>x.id===recordId))throw Error('RECORD_MISSING_FROM_SUBMISSION');
 const expectedSnapshotHash=sha(signedSnapshot);
 let phase='IN_FLIGHT',draft=initialDraft,blockedAttempts=0,readbackAttempts=0;
 const identity=Object.freeze({requestId,recordId,expectedRevision,expectedSnapshotHash});
 return Object.freeze({
  identity:()=>identity,phase:()=>phase,pendingDraft:()=>draft,
  editDraft(next){draft=String(next);return phase;},
  markUnknown(){if(phase!=='IN_FLIGHT')throw Error('ACK_STATE_NOT_IN_FLIGHT');phase='ACK_UNKNOWN';},
  async attemptNewWrite(write){
   if(phase!=='ACK_UNKNOWN')throw Error('INVALID_ACK_STATE');
   blockedAttempts++;
   return {status:'BLOCKED_PENDING_ACK',requestId,recordId,writeInvoked:false};
  },
  async confirmByReadback(lookup){
   if(phase!=='ACK_UNKNOWN')throw Error('ACK_LOOKUP_NOT_ALLOWED');
   readbackAttempts++;
   let response;
   try{response=await lookup()}catch{return {status:'UNVERIFIED',reason:'GET_FAILED',phase};}
   if(response.status!==200)return {status:'UNVERIFIED',reason:'NOT_AUTHORIZED_OR_UNAVAILABLE',phase};
   const body=response.body;
   const rows=body?.snapshot?.records?.filter(x=>x.id===recordId)||[];
   if(body?.revision!==expectedRevision+1||response.etag!=='"'+body.revision+'"'||rows.length!==1||sha(body.snapshot)!==expectedSnapshotHash)
    return {status:'UNVERIFIED',reason:'SERVER_SNAPSHOT_MISMATCH',phase};
   phase='CONFIRMED_BY_READBACK';
   return {status:phase,requestId,recordId,revision:body.revision,snapshotSha256:expectedSnapshotHash};
  },
  metrics:()=>({phase,blockedAttempts,readbackAttempts,requestId,recordId,draftPreserved:draft!==undefined})
 });
}
