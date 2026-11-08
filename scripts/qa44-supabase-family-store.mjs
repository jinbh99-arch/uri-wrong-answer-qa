// QA44 server-only Supabase verified identity -> family RLS -> CAS snapshot.
// NO HTTP listener, NO actual provider connection, NO public DB password.
// A trusted backend may use this only after owner/legal/cloud approvals.
// Browser must NEVER receive the DB login nor service_role credentials.
import {createHash} from 'node:crypto';
import {checkBackup,previewMerge} from './qa-family-merge-preflight.mjs';
const error=code=>Object.assign(new Error(code),{code});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function familyId(id){if(typeof id!=='string'||!UUID.test(id))throw error('INVALID_FAMILY_ID');return id}
function revision(n){if(!Number.isSafeInteger(n)||n<0)throw error('INVALID_REVISION');return n}
function prepared(doc){
 checkBackup(doc);
 const text=JSON.stringify(doc);
 if(Buffer.byteLength(text,'utf8')>1024*1024)throw error('PHOTO_OR_RECORD_TOO_LARGE');
 return {text,hash:createHash('sha256').update(text).digest('hex')};
}
export function createQa44ServerFamilyStore({pool,authClient}={}){
 if(process.env.QA44_STAGE_ONLY!=='1')throw error('NO_LIVE_SUPABASE_AUTH_ALLOWED');
 if(!pool||typeof pool.connect!=='function'||
  typeof authClient?.auth?.getUser!=='function')throw error('TRUSTED_SERVER_REQUIREMENTS_MISSING');
 async function scoped(token,fn){
  if(typeof token!=='string'||token.length<50||token.length>12000)
   throw error('AUTH_REQUIRED');
  // Supabase Auth getUser(accessToken) performs server-side validation.
  // NEVER trust getSession() or the user-submitted JWT payload alone.
  let remote;
  try{remote=await authClient.auth.getUser(token)}catch{throw error('AUTH_REQUIRED')}
  const user=remote?.data?.user;
  if(remote?.error||!UUID.test(String(user?.id||''))||user?.is_anonymous===true)
   throw error('AUTH_REQUIRED');
  const c=await pool.connect();
  let active=false;
  try{
   await c.query('BEGIN');active=true;
   // Role credentials are server-private. GUC is protected by the private
   // database session, not by client-side user-controlled fields.
   await c.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[user.id]);
   const result=await fn(c);
   await c.query('COMMIT');active=false;
   return result;
  }catch(e){
   if(active)try{await c.query('ROLLBACK')}catch{}
   throw e;
  }finally{c.release()}
 }
 return Object.freeze({
  async families(token){
   return scoped(token,async c=>{
    const result=await c.query("SELECT family_id FROM qa44.guardian_memberships WHERE guardian_user_id=(SELECT auth.uid()) AND role='guardian' AND verification_source='externally_verified' AND verified_at IS NOT NULL AND consent_verified_at IS NOT NULL AND revoked_at IS NULL ORDER BY family_id");
    return result.rows.map(x=>x.family_id);
   });
  },
  async read(token,family){
   const id=familyId(family);
   return scoped(token,async c=>{
    const result=await c.query('SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1',[id]);
    if(result.rowCount!==1)return null;
    const row=result.rows[0];
    if(row.snapshot_text!==null&&
     createHash('sha256').update(row.snapshot_text).digest('hex')!==row.content_sha256)
     throw error('SERVER_DATA_TAMPERED');
    return {revision:Number(row.revision),
     snapshot:row.snapshot_text===null?null:JSON.parse(row.snapshot_text)};
   });
  },
  async put(token,family,expectedRevision,doc){
   const id=familyId(family),expected=revision(expectedRevision);
   const next=prepared(doc);
   return scoped(token,async c=>{
    const res=await c.query('SELECT revision,snapshot_text,content_sha256 FROM qa44.family_snapshots WHERE family_id=$1',[id]);
    if(res.rowCount!==1)throw error('FAMILY_NOT_ACCESSIBLE');
    const before=res.rows[0];
    if(Number(before.revision)!==expected)throw error('STALE_REVISION');
    if(before.snapshot_text!==null){
     if(createHash('sha256').update(before.snapshot_text).digest('hex')!==before.content_sha256)
      throw error('SERVER_DATA_TAMPERED');
     const merged=previewMerge(JSON.parse(before.snapshot_text),doc);
     if(merged.proposedRecords!==doc.records.length||
      merged.proposedPhotos!==Object.keys(doc.photos).length)
      throw error('SILENT_RECORD_OR_PHOTO_LOSS');
    }
    const updated=await c.query("UPDATE qa44.family_snapshots SET revision=revision+1,snapshot_text=$3,content_sha256=$4,updated_at=now() WHERE family_id=$1 AND revision=$2 RETURNING revision",
     [id,expected,next.text,next.hash]);
    if(updated.rowCount!==1)throw error('STALE_OR_REVOKED_GUARDIAN');
    return Object.freeze({stored:true,revision:Number(updated.rows[0].revision),sha256:next.hash});
   });
  }
 });
}
