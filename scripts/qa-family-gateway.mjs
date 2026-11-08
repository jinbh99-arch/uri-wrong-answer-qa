// QA25 — Synthetic family account/snapshot flow exclusively on 127.0.0.1.
// In-memory, no persistence, no cloud, no HTTPS, no real users, no production auth.
// NOT imported by index.html and not reachable from public GitHub Pages.
// Explicit QA_SYNTHETIC_FAMILY_ONLY=1 guard prevents accidental use.
import {createServer} from 'node:http';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {checkBackup,previewMerge,SyncPreflightError} from './qa-family-merge-preflight.mjs';

const MAX_BODY=1024*1024;
function reply(res,status,payload,extra={}){
 res.writeHead(status,{
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff',
  'x-qa-service':'non-production-loopback-only',
  ...extra
 });
 res.end(JSON.stringify(payload));
}
function reject(status,reason){return {status,reason}}
async function jsonBody(req){
 const chunks=[];let length=0;
 for await(const chunk of req){
  length+=chunk.length;
  if(length>MAX_BODY)throw reject(413,'SIZE_LIMIT');
  chunks.push(chunk);
 }
 if(!length)throw reject(400,'BODY_REQUIRED');
 try{
  const obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error('NOT_OBJECT');
  return obj;
 }catch{throw reject(400,'INVALID_JSON')}
}
function safePassword(password){
 return typeof password==='string'&&password.length>=16&&password.length<=160;
}
function hash(password,salt){
 return scryptSync(password,salt,32);
}
function isQaFamilyKey(key){
 return typeof key==='string'&&/^qa-[a-z0-9-]{4,32}$/.test(key);
}
export async function createIsolatedQaFamilyGateway(){
 if(process.env.QA_SYNTHETIC_FAMILY_ONLY!=='1')
  throw Error('QA_ONLY: explicit QA_SYNTHETIC_FAMILY_ONLY=1 required');
 const accounts=new Map(),tokens=new Map();
 const server=createServer(async(req,res)=>{
  try{
   if(!req.socket.remoteAddress||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
    throw reject(403,'LOOPBACK_ONLY');
   if(req.url==='/qa/register'&&req.method==='POST'){
    const {familyKey,password}=await jsonBody(req);
    if(!isQaFamilyKey(familyKey)||!safePassword(password))throw reject(422,'SYNTHETIC_CREDENTIALS_ONLY');
    if(accounts.has(familyKey))throw reject(409,'ALREADY_REGISTERED');
    const salt=randomBytes(16);
    accounts.set(familyKey,{salt,hashed:hash(password,salt),revision:0,snapshot:null});
    return reply(res,201,{created:true,qaOnly:true,cloudReady:false});
   }
   if(req.url==='/qa/login'&&req.method==='POST'){
    const {familyKey,password}=await jsonBody(req);
    if(!isQaFamilyKey(familyKey)||!safePassword(password))throw reject(401,'CREDENTIALS_INVALID');
    const acct=accounts.get(familyKey);
    if(!acct||!timingSafeEqual(acct.hashed,hash(password,acct.salt)))
     throw reject(401,'CREDENTIALS_INVALID');
    const token=randomBytes(32).toString('hex');
    tokens.set(token,{familyKey,expiresAt:Date.now()+600000});
    return reply(res,200,{token,expiresInSeconds:600,qaOnly:true,cloudReady:false});
   }
   if(req.url==='/qa/logout'&&req.method==='POST'){
    const bearer=req.headers.authorization;
    if(typeof bearer==='string'&&bearer.startsWith('Bearer '))tokens.delete(bearer.slice(7));
    return reply(res,200,{loggedOut:true});
   }
   if(req.url==='/qa/snapshot'&&['GET','PUT'].includes(req.method)){
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))
     throw reject(401,'AUTH_REQUIRED');
    const session=tokens.get(bearer.slice(7));
    if(!session||session.expiresAt<Date.now())throw reject(401,'SESSION_MISSING_OR_EXPIRED');
    const acct=accounts.get(session.familyKey);
    if(!acct)throw reject(401,'SESSION_FAMILY_MISSING');
    if(req.method==='GET')
     return reply(res,200,{revision:acct.revision,snapshot:acct.snapshot,qaOnly:true},{etag:'"'+acct.revision+'"'});
    const oldRev=acct.revision;
    const match=req.headers['if-match'];
    if(typeof match!=='string'||!/^"\d+"$/.test(match))
     throw reject(428,'IF_MATCH_REQUIRED');
    if(match!=='"'+oldRev+'"')throw reject(409,'STALE_REVISION');
    const doc=await jsonBody(req);
    try{checkBackup(doc)}catch(err){
     throw reject(422,err instanceof SyncPreflightError?err.code:'INVALID_BACKUP');
    }
    if(acct.snapshot){
     let plan;
     try{plan=previewMerge(acct.snapshot,doc)}
     catch(err){throw reject(409,err instanceof SyncPreflightError?err.code:'MERGE_PREVIEW_FAILED')}
     // Only append-only same-ID content is allowed; old records/photos may not vanish.
     if(plan.proposedRecords!==doc.records.length||plan.proposedPhotos!==Object.keys(doc.photos).length)
      throw reject(409,'SILENT_RECORD_OR_PHOTO_LOSS');
    }
    // In-memory atomic commit; revision increment, separate family storage.
    acct.snapshot=structuredClone(doc);
    acct.revision=oldRev+1;
    return reply(res,200,{stored:true,revision:acct.revision,qaOnly:true},{etag:'"'+acct.revision+'"'});
   }
   throw reject(404,'NOT_FOUND');
  }catch(error){
   const status=Number.isInteger(error?.status)?error.status:500;
   // No error stacks, token values, passwords, record contents or family keys in responses.
   return reply(res,status,{error:status===500?'INTERNAL_TEST_ONLY_ERROR':error.reason||'REQUEST_REJECTED',qaOnly:true});
  }
 });
 // Explicitly bind loopback; port=0 prevents collision and any public access.
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 return Object.freeze({
  baseUrl:'http://127.0.0.1:'+server.address().port,
  shutdown:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve())),
  qaOnly:true,cloudReady:false,productionAuth:false
 });
}
