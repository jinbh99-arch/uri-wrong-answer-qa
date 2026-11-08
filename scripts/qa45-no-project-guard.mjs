// QA45 explicit pre-project / zero-billing stop gate.
// This module CANNOT create an organization, project or service.
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const fail=s=>Object.assign(new Error(s),{code:s});
const expectedStatuses=[
 'PREPARED_NOT_CREATED','PREPARED_NOT_APPLIED','PREPARED_NOT_CONFIGURED',
 'PREPARED_NOT_APPLIED','BLOCKED_NO_SERVER'
];
export function assertQa45NoProjectReadiness(plan,root=process.cwd()){
 if(!plan||plan.schema!=='qa45-precreate-free-v1'||
   plan.status!=='NO_PROJECT_NO_BILLING')throw fail('PRECREATE_CONTRACT_REQUIRED');
 if(plan.organization?.confirmedPlan!=='free'||
  plan.organization?.name!=='uri-level-test'||
  plan.organization?.projectCountObserved!==0)
  throw fail('FREE_EMPTY_ORGANIZATION_REQUIRED');
 const p=plan.policy;
 if(!p||!Object.entries(p).every(([key,v])=>
  [
   'createProject','upgradePlan','enterPaymentCard','enablePaidServices',
   'createRealUsers','collectChildData','enableProductionEmail',
   'publishProductionSite','changeNetlifyProduction'
  ].includes(key)&&v===false)||Object.keys(p).length!==9)
  throw fail('NO_PROJECT_NO_BILLING_GUARD');
 if(plan.freeArchitecture?.provider!=='Supabase'||
  plan.freeArchitecture?.tier!=='free'||
  plan.freeArchitecture?.monthlyCommittedCostKRW!==0||
  JSON.stringify(plan.freeArchitecture?.authProviders)!=='["google","email"]'||
  plan.freeArchitecture?.smtpCandidate!=='Resend Free'||
  plan.freeArchitecture?.photoStorage!=='private'||
  !plan.freeArchitecture?.parentVerification?.includes('separate from OAuth'))
  throw fail('FREE_PROVIDER_IDENTITY_POLICY');
 if(!Array.isArray(plan.tasks)||plan.tasks.length!==5)throw fail('FIVE_TASKS_REQUIRED');
 for(let i=0;i<5;i++){
  const t=plan.tasks[i];
  if(t?.id!==String(i+1)||t?.status!==expectedStatuses[i]||
    t.realServiceVerified!==false||
    !Array.isArray(t.evidence)||t.evidence.length<2)
    throw fail('UNVERIFIED_REAL_SERVICE_CLAIM');
  for(const file of t.evidence){
   if(typeof file!=='string'||!file.startsWith(i===0?'docs/':i===1?'db/':i===2?'scripts/':i===3?'db/':'tests/')&&
    file!== 'docs/QA45_실프로젝트_미생성_무료운영_실행계획_v1.0.md' &&
    !file.startsWith('tests/')&&!file.startsWith('docs/'))
    throw fail('INVALID_EVIDENCE_REFERENCE');
   if(file.includes('..')||!existsSync(resolve(root,file)))throw fail('MISSING_EVIDENCE_FILE');
  }
 }
 if(plan.externalGates?.projectCreationAuthorization!=='NOT_REQUESTED'||
  plan.externalGates?.realProviderCredentials!=='NOT_CONFIGURED'||
  plan.externalGates?.guardianConsent!=='NOT_VERIFIED'||
  plan.externalGates?.legalReview!=='DRAFT_ONLY'||
  plan.externalGates?.productionRelease!=='BLOCKED'||
  plan.externalGates?.physicalPhonesTested!==0||
  plan.externalGates?.g16StudyParticipants!==0)
  throw fail('FALSE_REAL_APPROVAL');
 const sql=readFileSync(resolve(root,'db/qa44_supabase_staging_rls.sql'),'utf8');
 for(const signature of ['ENABLE ROW LEVEL SECURITY','FORCE ROW LEVEL SECURITY',
  "verification_source='externally_verified'",'consent_verified_at',
  'CREATE POLICY qa44_private_photo_read','CREATE POLICY qa44_private_photo_insert',
  "public,file_size_limit,allowed_mime_types","GRANT UPDATE(revision,snapshot_text"])
  if(!sql.includes(signature))throw fail('MISSING_RLS_OR_STORAGE_DRY_RUN');
 // User project absent: live SQL application and live OAuth/SMTP never allowed.
 return Object.freeze({status:'PASS_PREPARED_NO_LIVE_APPLY',
  taskCount:5,prepared:4,blockedRealServer:1,
  projectCountObserved:0,projectCreated:false,billingTouched:false,
  actualSupabaseMigrationsApplied:0,actualOAuthConfigured:false,
  actualStorageBucketsCreated:0,realServerTestsPerformed:0,
  realChildren:0,productionApproved:false});
}
