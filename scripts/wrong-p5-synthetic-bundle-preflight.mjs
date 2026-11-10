// WRONG-P5: synthetic-only v02 + B2/B3 ledger bundle preflight.
// This is an in-memory contract, NOT a restore, live backup, API or signature.
import {createHash} from 'node:crypto';
import {assessSyntheticLedgerRestore,makeSyntheticLedgerManifest} from './wrong-p4-synthetic-ledger-preflight.mjs';
const fail=code=>Object.assign(new Error(code),{code});
const sha=text=>createHash('sha256').update(text).digest('hex');
function guard(){
 if(process.env.QA44_STAGE_ONLY!=='1'||process.env.WRONG_P4_SYNTHETIC_BACKUP_ONLY!=='1'||
    process.env.WRONG_P5_SYNTHETIC_BUNDLE_ONLY!=='1')throw fail('SYNTHETIC_BUNDLE_ONLY');
}
function keys(o,expected){return !!o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).sort().join('|')===expected.slice().sort().join('|')}
const clone=o=>JSON.parse(JSON.stringify(o));
export function exportSyntheticBundle(input){
 guard();
 const {familyId,snapshotText,snapshotHash,revision,childEvents,parentEvents}=input;
 const manifest=makeSyntheticLedgerManifest({familyId,snapshotText,revision,childEvents,parentEvents});
 const status=assessSyntheticLedgerRestore({...input,manifest});
 if(!status.manifestConsistent||status.safeToRestore!==false)throw fail('P4_PREFLIGHT_NOT_CONSISTENT');
 const payload={format:'wrong-synthetic-export-bundle-p5',familyId,revision,
  snapshotText,snapshotHash,childEvents:clone(childEvents),parentEvents:clone(parentEvents),
  manifest:clone(manifest)};
 return JSON.stringify({...payload,bundleSha256:sha(JSON.stringify(payload))});
}
export function preflightSyntheticImport(bundleText,{expectedFamilyId,expectedRevision}={}){
 guard();
 if(typeof bundleText!=='string')throw fail('INVALID_BUNDLE_JSON');
 let b;try{b=JSON.parse(bundleText)}catch{throw fail('INVALID_BUNDLE_JSON')}
 const fields=['format','familyId','revision','snapshotText','snapshotHash','childEvents','parentEvents','manifest','bundleSha256'];
 if(!keys(b,fields)||b.format!=='wrong-synthetic-export-bundle-p5')throw fail('INVALID_BUNDLE_SHAPE');
 if(typeof b.bundleSha256!=='string'||!(/^[a-f0-9]{64}$/).test(b.bundleSha256))throw fail('INVALID_BUNDLE_DIGEST');
 const {bundleSha256,...payload}=b;
 if(sha(JSON.stringify(payload))!==bundleSha256)throw fail('BUNDLE_DIGEST_MISMATCH');
 if(typeof expectedFamilyId!=='string'||expectedFamilyId!==b.familyId)throw fail('FAMILY_CONTEXT_MISMATCH');
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision!==b.revision)throw fail('REVISION_CONTEXT_MISMATCH');
 const result=assessSyntheticLedgerRestore({familyId:b.familyId,snapshotText:b.snapshotText,
  snapshotHash:b.snapshotHash,revision:b.revision,childEvents:b.childEvents,
  parentEvents:b.parentEvents,manifest:b.manifest});
 if(!result.manifestConsistent||result.safeToRestore!==false)throw fail('P4_PREFLIGHT_NOT_CONSISTENT');
 return Object.freeze({preflightPassed:true,safeToRestore:false,
  familyId:b.familyId,revision:b.revision,childCount:b.childEvents.length,
  parentCount:b.parentEvents.length,reason:'TRANSACTIONAL_RESTORE_AND_CONSENT_NOT_IMPLEMENTED'});
}
