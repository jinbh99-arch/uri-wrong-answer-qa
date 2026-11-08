// QA39 G15: tenant-scoped Postgres repository prototype.
// NOT a hosted API, NOT deployed, NOT a provider authentication verifier.
// A trusted server must verify provider identity + guardian authority before
// supplying resolveAuthenticatedPrincipal. Never ship DB credentials to clients.
import {createHash} from 'node:crypto';
import {checkBackup,previewMerge} from './qa-family-merge-preflight.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function error(code){return Object.assign(new Error(code),{code})}
function familyId(x){if(typeof x!=='string'||!uuid.test(x))throw error('INVALID_FAMILY_ID');return x}
function revision(x){if(!Number.isSafeInteger(x)||x<0)throw error('INVALID_REVISION');return x}
function principal(x){
 if(typeof x!=='string'||x.length<4||x.length>160||!/^[A-Za-z0-9:._/@-]+$/.test(x))
  throw error('UNVERIFIED_PRINCIPAL');
 return x;
}
function preparedDocument(doc){
 // Do not trust the caller's own digest; validate original app backup first.
 checkBackup(doc);
 const snapshotText=JSON.stringify(doc);
 if(Buffer.byteLength(snapshotText,'utf8')>1024*1024)throw error('QA39_DOCUMENT_TOO_LARGE');
 return {snapshotText,hash:createHash('sha256').update(snapshotText,'utf8').digest('hex')};
}
export function createQa39TenantStore(pool,resolveAuthenticatedPrincipal){
 if(process.env.QA39_REFERENCE_ONLY!=='1')throw error('NO_PRODUCTION_AUTH_PROVIDER_CONNECTED');
 if(!pool||typeof pool.connect!=='function'||typeof resolveAuthenticatedPrincipal!=='function')
  throw error('AUTHENTICATED_POOL_AND_RESOLVER_REQUIRED');
 async function scoped(requestContext,fn){
  // Fail closed until the hosting layer supplies a VERIFIED OIDC or equivalent
  // subject. No raw family ID from the user is an authorization credential.
  const subject=principal(await resolveAuthenticatedPrincipal(requestContext));
  const db=await pool.connect();
  let started=false;
  try{
   await db.query('BEGIN');started=true;
   await db.query("SELECT set_config('qa39.principal_id',$1,true)",[subject]);
   const result=await fn(db);
   await db.query('COMMIT');started=false;
   return result;
  }catch(err){
   if(started)try{await db.query('ROLLBACK')}catch{}
   throw err;
  }finally{db.release()}
 }
 return Object.freeze({
  async families(context){
   return scoped(context,async db=>{
    const result=await db.query(`SELECT family_id
      FROM qa39.guardian_memberships
      WHERE principal_id=current_setting('qa39.principal_id',true)
        AND role='guardian' AND verified_at IS NOT NULL AND revoked_at IS NULL
      ORDER BY family_id`);
    return result.rows.map(r=>r.family_id);
   });
  },
  async read(context,requestedFamilyId){
   const id=familyId(requestedFamilyId);
   return scoped(context,async db=>{
    const res=await db.query(`SELECT revision,snapshot_text,content_sha256
      FROM qa39.family_snapshots WHERE family_id=$1`,[id]);
    if(res.rowCount!==1)return null; // no family enumeration
    const row=res.rows[0];
    if(row.snapshot_text!==null){
     const digest=createHash('sha256').update(row.snapshot_text,'utf8').digest('hex');
     if(row.content_sha256!==digest)throw error('PERSISTED_DOCUMENT_TAMPERED');
    }
    return {revision:Number(row.revision),
      snapshot:row.snapshot_text===null?null:JSON.parse(row.snapshot_text)};
   });
  },
  async put(context,requestedFamilyId,expectedRevision,document){
   const id=familyId(requestedFamilyId),expected=revision(expectedRevision);
   const {snapshotText,hash}=preparedDocument(document);
   return scoped(context,async db=>{
    const rows=await db.query(`SELECT revision,snapshot_text,content_sha256
      FROM qa39.family_snapshots WHERE family_id=$1`,[id]);
    if(rows.rowCount!==1)throw error('FAMILY_NOT_ACCESSIBLE');
    const prior=rows.rows[0];
    if(Number(prior.revision)!==expected)throw error('STALE_REVISION');
    if(prior.snapshot_text!==null){
     const priorHash=createHash('sha256').update(prior.snapshot_text).digest('hex');
     if(priorHash!==prior.content_sha256)throw error('PERSISTED_DOCUMENT_TAMPERED');
     // Existing records/photos cannot disappear or silently change on PUT.
     const plan=previewMerge(JSON.parse(prior.snapshot_text),document);
     if(plan.proposedRecords!==document.records.length||
        plan.proposedPhotos!==Object.keys(document.photos).length)
      throw error('SILENT_RECORD_OR_PHOTO_LOSS');
    }
    // Single SQL compare-and-swap: no lost updates even after concurrent reads.
    const updated=await db.query(`UPDATE qa39.family_snapshots
      SET revision=revision+1,snapshot_text=$3,content_sha256=$4,updated_at=now()
      WHERE family_id=$1 AND revision=$2 RETURNING revision`,
      [id,expected,snapshotText,hash]);
    if(updated.rowCount!==1)throw error('STALE_OR_UNAUTHORIZED_COMMIT');
    return {stored:true,revision:Number(updated.rows[0].revision),sha256:hash};
   });
  }
 });
}
