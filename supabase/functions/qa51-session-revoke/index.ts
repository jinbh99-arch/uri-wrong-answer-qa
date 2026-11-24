// QA51 deployment candidate only. Revocation must commit before UI reports logout.
// Never use a service-role key. PostgREST verifies the bearer JWT and supplies
// auth.uid()/session_id; the DB verifies provider session state for new operations.
// The same signed, unexpired JWT may retrieve only its own prior operation receipt.
import {createClient} from 'npm:@supabase/supabase-js@2';
const origins=new Set(['http://127.0.0.1:4173','https://jinbh99-arch.github.io']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
   'x-content-type-options':'nosniff','vary':'Origin'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(!origins.has(origin))return reply(403,{error:'ORIGIN_DENIED'});
 Object.assign(headers,{'access-control-allow-origin':origin,
   'access-control-allow-headers':'authorization, apikey, x-client-info, content-type',
   'access-control-allow-methods':'POST, OPTIONS'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'});
 const authorization=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~-]{50,12000}$/.test(authorization))return reply(401,{error:'AUTH_REQUIRED'});
 const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!key)return reply(503,{error:'REVOCATION_UNAVAILABLE'});
 let body;
 try {
  const raw=await req.text();
  if(raw.length>1024)return reply(400,{error:'INVALID_REQUEST'});
  body=JSON.parse(raw);
 } catch {return reply(400,{error:'INVALID_REQUEST'});}
 if(!body||typeof body!=='object'||!uuid.test(String(body.operationId||''))||
   !['local','global'].includes(body.scope))return reply(400,{error:'INVALID_REQUEST'});
 try {
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:authorization}}});
  const response=await client.rpc('qa51_revoke_session',
   {p_operation:body.operationId,p_global:body.scope==='global'});
  if(response.error){
   if(response.status===401||response.status===403)return reply(401,{error:'AUTH_REQUIRED'});
   return reply(503,{error:'REVOCATION_UNAVAILABLE'});
  }
  if(response.data!==true)return reply(403,{error:'REVOCATION_DENIED'});
  // This acknowledges the application ledger, not upstream refresh-token removal.
  // The client must hide private UI immediately and call provider signOut after ACK.
  return reply(200,{serverRevocationCommitted:true});
 } catch {return reply(503,{error:'REVOCATION_UNAVAILABLE'});}
});
