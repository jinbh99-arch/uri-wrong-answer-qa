// QA25 — Synthetic family account/snapshot flow exclusively on 127.0.0.1.
// In-memory, no persistence, no cloud, no HTTPS, no real users, no production auth.
// NOT imported by index.html and not reachable from public GitHub Pages.
// Explicit QA_SYNTHETIC_FAMILY_ONLY=1 guard prevents accidental use.
import {createServer} from 'node:http';
import {randomBytes,scryptSync,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
import {existsSync,readFileSync,lstatSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,sep} from 'node:path';
import {checkBackup,previewMerge,SyncPreflightError} from './qa-family-merge-preflight.mjs';
import {previewThreeWay} from './qa-family-threeway.mjs';

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
// Optional restorable AES-GCM encrypted test data: only under OS temp directory.
const DURABLE_FORMAT='qa26-family-encrypted-v01';
function createTestStorage(options={}){
 if(options.durablePath===undefined){
  return {accounts:new Map(),persist:()=>{},durable:false};
 }
 if(process.env.QA_DURABLE_TEST_ONLY!=='1')
  throw Error('QA_ONLY: QA_DURABLE_TEST_ONLY=1 required for encrypted persistence');
 const base=resolve(tmpdir()),target=resolve(options.durablePath);
 if(!target.startsWith(base+sep)||target.endsWith(sep)||target===base)
  throw Error('QA_ONLY: storage path must be a file below OS temporary directory');
 if(typeof options.encryptionKey!=='string'||!/^[a-f0-9]{64}$/i.test(options.encryptionKey))
  throw Error('QA_ONLY: a fresh 32-byte AES key is required, never a user password');
 const key=Buffer.from(options.encryptionKey,'hex');
 function noLink(path){
  if(existsSync(path)&&lstatSync(path).isSymbolicLink())throw Error('QA_ONLY: symlink file rejected');
 }
 noLink(target);noLink(dirname(target));
 let accounts=new Map();
 if(existsSync(target)){
  const source=readFileSync(target);
  if(source.length>16*1024*1024)throw Error('QA_ONLY: encrypted store limit exceeded');
  const envelope=JSON.parse(source.toString('utf8'));
  if(envelope.format!==DURABLE_FORMAT)throw Error('QA_ONLY: unknown encrypted format');
  const iv=Buffer.from(envelope.iv,'base64'),tag=Buffer.from(envelope.tag,'base64');
  const ciphertext=Buffer.from(envelope.ciphertext,'base64');
  if(iv.length!==12||tag.length!==16)throw Error('QA_ONLY: invalid authenticated envelope');
  const decipher=createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from(DURABLE_FORMAT));decipher.setAuthTag(tag);
  // Wrong key or altered file rejects startup: never silently create a new empty family.
  const parsed=JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));
  if(!Array.isArray(parsed?.accounts)||parsed.accounts.length>100)throw Error('QA_ONLY: invalid account list');
  for(const e of parsed.accounts){
   if(!isQaFamilyKey(e?.familyKey)||accounts.has(e.familyKey))throw Error('QA_ONLY: bad family identity');
   const salt=Buffer.from(e.salt,'base64'),hashed=Buffer.from(e.hashed,'base64');
   if(salt.length!==16||hashed.length!==32||!Number.isSafeInteger(e.revision)||e.revision<0)
    throw Error('QA_ONLY: invalid account credential/revision');
   if(e.snapshot!==null)checkBackup(e.snapshot);
   accounts.set(e.familyKey,{salt,hashed,revision:e.revision,snapshot:e.snapshot});
  }
 }
 function persist(candidate){
  const entries=Array.from(candidate,([familyKey,a])=>({
   familyKey,salt:a.salt.toString('base64'),hashed:a.hashed.toString('base64'),
   revision:a.revision,snapshot:a.snapshot
  }));
  if(entries.length>100)throw Error('QA_ONLY: at most 100 synthetic families allowed');
  const payload=Buffer.from(JSON.stringify({accounts:entries}),'utf8');
  if(payload.length>12*1024*1024)throw Error('QA_ONLY: plaintext snapshot limit exceeded');
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(DURABLE_FORMAT));
  const ciphertext=Buffer.concat([cipher.update(payload),cipher.final()]);
  const wrapper=JSON.stringify({
   format:DURABLE_FORMAT,iv:iv.toString('base64'),
   tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')
  });
  const temp=target+'.'+randomBytes(8).toString('hex')+'.tmp';
  let descriptor;
  try{
   descriptor=openSync(temp,'wx',0o600);
   writeFileSync(descriptor,wrapper,'utf8');
   fsyncSync(descriptor);closeSync(descriptor);descriptor=undefined;
   noLink(target);
   renameSync(temp,target);
   chmodSync(target,0o600);
  }catch(e){
   if(descriptor!==undefined)closeSync(descriptor);
   try{unlinkSync(temp)}catch{}
   throw e;
  }
 }
 return {accounts,persist,durable:true};
}
export async function createIsolatedQaFamilyGateway(options={}){
 if(process.env.QA_SYNTHETIC_FAMILY_ONLY!=='1')
  throw Error('QA_ONLY: explicit QA_SYNTHETIC_FAMILY_ONLY=1 required');
 const storage=createTestStorage(options),accounts=storage.accounts,tokens=new Map();
 const server=createServer(async(req,res)=>{
  try{
   if(!req.socket.remoteAddress||!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))
    throw reject(403,'LOOPBACK_ONLY');
   // QA29: a dedicated local-only HTML client can contact this random loopback port.
   // Never accept an arbitrary Origin (including a public GitHub Pages origin).
   const origin=req.headers.origin;
   if(origin!==undefined){
    if(origin!=='http://127.0.0.1:4173')throw reject(403,'ORIGIN_NOT_ALLOWED');
    res.setHeader('Access-Control-Allow-Origin',origin);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, If-Match');
    res.setHeader('Access-Control-Max-Age','0');
   }
   if(req.method==='OPTIONS'){
    if(origin!== 'http://127.0.0.1:4173')throw reject(403,'ORIGIN_NOT_ALLOWED');
    res.writeHead(204,{'cache-control':'no-store'});return res.end();
   }
   if(origin===undefined&&req.headers['sec-fetch-site']==='cross-site')throw reject(403,'CROSS_SITE_FORBIDDEN');
   if(req.url==='/qa/register'&&req.method==='POST'){
    const {familyKey,password}=await jsonBody(req);
    if(!isQaFamilyKey(familyKey)||!safePassword(password))throw reject(422,'SYNTHETIC_CREDENTIALS_ONLY');
    if(accounts.has(familyKey))throw reject(409,'ALREADY_REGISTERED');
    const salt=randomBytes(16);
    const created={salt,hashed:hash(password,salt),revision:0,snapshot:null};
    const candidate=new Map(accounts);candidate.set(familyKey,created);
    storage.persist(candidate);
    accounts.set(familyKey,created);
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
   if(req.url==='/qa/sync-preview'&&req.method==='POST'){
    const bearer=req.headers.authorization;
    if(typeof bearer!=='string'||!bearer.startsWith('Bearer '))
     throw reject(401,'AUTH_REQUIRED');
    const session=tokens.get(bearer.slice(7));
    if(!session||session.expiresAt<Date.now())throw reject(401,'SESSION_MISSING_OR_EXPIRED');
    const acct=accounts.get(session.familyKey);
    if(!acct||!acct.snapshot)throw reject(409,'BASELINE_NOT_STORED');
    const request=await jsonBody(req);
    if(!request.base||!request.local)throw reject(422,'MISSING_BASE_OR_LOCAL');
    let result;
    try{result=previewThreeWay(request.base,request.local,acct.snapshot)}
    catch(e){throw reject(422,e instanceof SyncPreflightError?e.code:'INVALID_THREE_WAY_BACKUP')}
    // Never send student records, photo bytes or a merged candidate back over this experimental API.
    const {candidate,...publicPlan}=result;
    return reply(res,200,{...publicPlan,candidateAvailable:!!candidate,qaOnly:true,storedRevision:acct.revision});
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
    const saved={...acct,snapshot:structuredClone(doc),revision:oldRev+1};
    const candidate=new Map(accounts);candidate.set(session.familyKey,saved);
    // Synchronous atomic write: no acknowledgement before verified disk commit.
    storage.persist(candidate);
    accounts.set(session.familyKey,saved);
    return reply(res,200,{stored:true,revision:saved.revision,qaOnly:true},{etag:'"'+saved.revision+'"'});
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
  qaOnly:true,cloudReady:false,productionAuth:false,encryptedRestartRecovery:storage.durable
 });
}
