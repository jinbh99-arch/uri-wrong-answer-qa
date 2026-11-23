// QA47 Supabase Edge Function. Actual deployment is via the Supabase connector.
// No service_role/secret API key, SQL credentials or user data in source.
// A-isolated candidate only; pinned version and error constructor identity.
import {createClient,AuthApiError} from 'npm:@supabase/supabase-js@2.118.0';
import {handleQa47AuthenticatedGuardianStatus} from './handler.js';
import {rejectSdkAuthError} from './auth-verified-denial.js';
Deno.serve(async req=>{
 // Preflight must not depend on env/SDK state; handler checks exact Origin.
 if(req.method==='OPTIONS')return handleQa47AuthenticatedGuardianStatus(req);
 const url=Deno.env.get('SUPABASE_URL');
 const key=Deno.env.get('SUPABASE_ANON_KEY');
 // Missing platform configuration MUST fail closed; do not log secrets.
 if(!url||!key)return new Response(JSON.stringify({error:'STAGING_BACKEND_UNAVAILABLE'}),
  {status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});
 let verifiedClient=null,verifiedToken=null;
 const services={
  async getUser(token){
   const client=createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:'Bearer '+token}}
   });
   const response=await client.auth.getUser(token);
   if(response.error)rejectSdkAuthError(response.error,AuthApiError);
   verifiedClient=client;verifiedToken=token;
   return response.data?.user;
  },
  async findVerifiedFamilies(token){
   if(token!==verifiedToken||!verifiedClient)throw new Error('AUTH_ORDER_INVALID');
   const response=await verifiedClient.rpc('qa47_my_verified_family_ids');
   if(response.error)throw new Error('MEMBERSHIP_CHECK_FAILED');
   return response.data;
  }
 };
 return handleQa47AuthenticatedGuardianStatus(req,services);
});
