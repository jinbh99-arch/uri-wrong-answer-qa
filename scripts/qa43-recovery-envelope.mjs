// QA43: deliberately isolated, synthetic-only disaster-recovery envelope.
// THIS IS NOT a production key escrow, backup retention or GDPR erase service.
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {checkBackup} from './qa-family-merge-preflight.mjs';
const bad=code=>Object.assign(new Error(code),{code});
const isUuid=s=>typeof s==='string'&&
 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
function guard(family,revision,key){
 if(process.env.QA43_SYNTHETIC_RECOVERY_ONLY!=='1')throw bad('LIVE_RECOVERY_DISABLED');
 if(!isUuid(family)||!Number.isSafeInteger(revision)||revision<0)
  throw bad('INVALID_RECOVERY_SCOPE');
 if(!Buffer.isBuffer(key)||key.length!==32)throw bad('INVALID_TEST_AES_KEY');
}
export function sealQa43SyntheticRecovery(family,revision,snapshot,key){
 guard(family,revision,key);
 checkBackup(snapshot);
 const plain=Buffer.from(JSON.stringify(snapshot),'utf8');
 if(plain.length>1024*1024)throw bad('RECOVERY_TOO_LARGE');
 const nonce=randomBytes(12),aad=Buffer.from('qa43-family-recovery-v1\0'+family+'\0'+revision);
 const cipher=createCipheriv('aes-256-gcm',key,nonce);
 cipher.setAAD(aad);
 const encrypted=Buffer.concat([cipher.update(plain),cipher.final()]);
 return Object.freeze({schema:'qa43-synthetic-recovery-envelope-v1',
  familyId:family,revision,nonce:nonce.toString('base64'),
  ciphertext:encrypted.toString('base64'),tag:cipher.getAuthTag().toString('base64'),
  sha256:createHash('sha256').update(plain).digest('hex'),
  realChildData:false,productionRestoreAllowed:false});
}
export function openQa43SyntheticRecovery(envelope,family,revision,key){
 guard(family,revision,key);
 if(envelope?.schema!=='qa43-synthetic-recovery-envelope-v1'||
    envelope.familyId!==family||envelope.revision!==revision||
    envelope.realChildData!==false||envelope.productionRestoreAllowed!==false)
  throw bad('RECOVERY_SCOPE_MISMATCH');
 let plain;
 try{
  const nonce=Buffer.from(envelope.nonce,'base64'),
   tag=Buffer.from(envelope.tag,'base64'),
   data=Buffer.from(envelope.ciphertext,'base64');
  if(nonce.length!==12||tag.length!==16||data.length>1024*1024)throw bad('INVALID_CIPHERTEXT');
  const dec=createDecipheriv('aes-256-gcm',key,nonce);
  dec.setAAD(Buffer.from('qa43-family-recovery-v1\0'+family+'\0'+revision));
  dec.setAuthTag(tag);
  plain=Buffer.concat([dec.update(data),dec.final()]);
 }catch{throw bad('RECOVERY_AUTHENTICATION_FAILED')}
 if(plain.length>1024*1024||createHash('sha256').update(plain).digest('hex')!==envelope.sha256)
  throw bad('RECOVERY_HASH_MISMATCH');
 try{
  const doc=JSON.parse(plain.toString('utf8'));
  checkBackup(doc);
  return doc;
 }catch{throw bad('RECOVERY_BACKUP_INVALID')}
}
