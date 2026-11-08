// QA41 G15: local-only HTTP integration of QA40 signed synthetic JWT and
// QA39 PostgreSQL guardian RLS. Never deploy this module to the public web.
// This is NOT a production HTTPS API or real legal-guardian verification.
import {createServer} from 'node:http';
import {createQa39TenantStore} from './qa39-tenant-store.mjs';

const SITE_ORIGIN='http://127.0.0.1:4173';
const BODY_LIMIT=1024*1024;
const UUID_PATH=/^\/qa41\/families\/([0-9a-fA-F-]{36})\/snapshot$/;
const HEADERS={
 'cache-control':'no-store, max-age=0',
 pragma:'no-cache',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'x-frame-options':'DENY',
 'content-security-policy':"default-src 'none'; frame-ancestors 'none'",
 vary:'Origin'
};
function output(res,status,value,extra={}){
 res.writeHead(status,{...HEADERS,'content-type':'application/json; charset=utf-8',...extra});
 res.end(JSON.stringify(value));
}
function statusFor(err){
 const code=err?.code;
 if(code==='AUTHENTICATION_REJECTED'||code==='UNVERIFIED_PRINCIPAL')return [401,'AUTH_REQUIRED'];
 if(code==='INVALID_FAMILY_ID'||code==='INVALID_REVISION')return [400,'INVALID_INPUT'];
 if(code==='FAMILY_NOT_ACCESSIBLE')return [404,'NOT_FOUND'];
 if(code==='STALE_REVISION'||code==='STALE_OR_UNAUTHORIZED_COMMIT'||
    code==='SILENT_RECORD_OR_PHOTO_LOSS'||code==='RECORD_CONFLICT'||
    code==='PROFILE_CONFLICT'||code==='PHOTO_CONFLICT')return [409,'CONFLICT'];
 if(code==='CHECKSUM'||code==='ORPHAN'||code==='FORMAT'||
    code==='PROFILE'||code==='COUNT'||code==='ROW'||code==='PHOTOS'||
    code==='DUPLICATE'||code==='KEY'||code==='CAPACITY'||code==='SIZE')
  return [422,'INVALID_BACKUP'];
 if(code==='QA39_DOCUMENT_TOO_LARGE')return [413,'BODY_TOO_LARGE'];
 return [500,'REQUEST_FAILED'];
}
async function bodyAsJson(req){
 let size=0;const parts=[];
 for await(const buf of req){
  size+=buf.byteLength;
  if(size>BODY_LIMIT)throw Object.assign(Error('max body'),{code:'BODY_TOO_LARGE'});
  parts.push(buf);
 }
 try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}
 catch{throw Object.assign(Error('invalid json'),{code:'MALFORMED_JSON'})}
}
export async function createQa41LoopbackFamilyApi({pool,resolveAuthenticatedPrincipal}={}){
 if(process.env.QA41_LOOPBACK_ONLY!=='1')throw Error('QA41_PRODUCTION_NETWORK_DISABLED');
 if(!pool||typeof pool.connect!=='function'||typeof resolveAuthenticatedPrincipal!=='function')
  throw Error('QA41_MISSING_VERIFIED_STORE');
 const store=createQa39TenantStore(pool,resolveAuthenticatedPrincipal);
 const server=createServer(async(req,res)=>{
  try{
   if(req.headers.origin!==SITE_ORIGIN){
    output(res,403,{error:'ORIGIN_NOT_ALLOWED'});return;
   }
   const cors={
    'access-control-allow-origin':SITE_ORIGIN,
    'access-control-allow-methods':'GET, PUT, OPTIONS',
    'access-control-allow-headers':'Authorization, Content-Type, If-Match',
    'access-control-max-age':'300'
   };
   if(req.method==='OPTIONS'){
    if(req.url==='/qa41/families'||UUID_PATH.test(req.url||'')){
     res.writeHead(204,{...HEADERS,...cors});res.end();
    }else output(res,404,{error:'NOT_FOUND'},cors);
    return;
   }
   if(!req.url||req.url.length>200||req.url.includes('?')){
    output(res,404,{error:'NOT_FOUND'},cors);return;
   }
   const familyMatch=UUID_PATH.exec(req.url);
   const isFamilyList=req.url==='/qa41/families';
   if(!familyMatch&&!isFamilyList){
    output(res,404,{error:'NOT_FOUND'},cors);return;
   }
   if((isFamilyList&&req.method!=='GET')||
      (familyMatch&&!['GET','PUT'].includes(req.method))){
    output(res,405,{error:'METHOD_NOT_ALLOWED'},
     {...cors,allow:isFamilyList?'GET, OPTIONS':'GET, PUT, OPTIONS'});return;
   }
   const authorization=req.headers.authorization;
   const bearer=(typeof authorization==='string'&&
    /^Bearer [A-Za-z0-9._~-]{50,12000}$/.test(authorization))
    ?authorization.slice(7):null;
   if(!bearer){
    output(res,401,{error:'AUTH_REQUIRED'},cors);return;
   }
   const ctx={bearerToken:bearer};
   if(isFamilyList){
    const families=await store.families(ctx);
    output(res,200,{families},cors);return;
   }
   const id=familyMatch[1];
   if(req.method==='GET'){
    const result=await store.read(ctx,id);
    if(!result){output(res,404,{error:'NOT_FOUND'},cors);return}
    output(res,200,result,{...cors,etag:'"'+result.revision+'"'});return;
   }
   const ifMatch=String(req.headers['if-match']||'');
   if(!ifMatch){output(res,428,{error:'PRECONDITION_REQUIRED'},cors);return}
   if(!/^"(0|[1-9][0-9]{0,14})"$/.test(ifMatch)){
    output(res,400,{error:'INVALID_IF_MATCH'},cors);return;
   }
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')){
    output(res,415,{error:'JSON_REQUIRED'},cors);return;
   }
   if(Number(req.headers['content-length']||0)>BODY_LIMIT){
    output(res,413,{error:'BODY_TOO_LARGE'},cors);return;
   }
   let body;
   try{body=await bodyAsJson(req)}
   catch(err){
    output(res,err.code==='BODY_TOO_LARGE'?413:400,
     {error:err.code==='BODY_TOO_LARGE'?'BODY_TOO_LARGE':'MALFORMED_JSON'},cors);
    return;
   }
   if(!body||Array.isArray(body)||typeof body!=='object'||
      Object.keys(body).length!==1||!Object.hasOwn(body,'snapshot')){
    output(res,400,{error:'INVALID_REQUEST_BODY'},cors);return;
   }
   const result=await store.put(ctx,id,Number(ifMatch.slice(1,-1)),body.snapshot);
   output(res,200,result,{...cors,etag:'"'+result.revision+'"'});
  }catch(err){
   const [status,code]=statusFor(err);
   // Do not leak SQL, tokens, student contents, or verifier stack traces.
   output(res,status,{error:code});
  }
 });
 server.headersTimeout=10000;server.requestTimeout=15000;server.maxHeadersCount=64;
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
 });
 const address=server.address();
 if(address?.address!=='127.0.0.1')throw Error('QA41_INSECURE_BINDING');
 return Object.freeze({
  baseUrl:'http://127.0.0.1:'+address.port,
  shutdown:()=>new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()))
 });
}
