// QA44: strictly no-billing budget estimator, not an API that can upgrade plans.
// Current free reference caps verified 2026-11-08 from Supabase/Resend.
// Alert at 80%; hard-stop proposed uploads/sends at cap. Actual vendor
// meters, quotas, email deliverability and pause are still NOT verified.
export const QA44_FREE_CAPS=Object.freeze({
 dbBytes:500*1000*1000,
 photoBytes:1000*1000*1000,
 egressBytes:5*1000*1000*1000,
 emailDaily:100,emailMonthly:3000,
 photosPerFileBytes:1048576
});
const fail=code=>Object.assign(new Error(code),{code});
const fields=['dbBytes','photoBytes','egressBytes','emailDaily','emailMonthly'];
export function assertQa44FreeBudget(current,proposed={}){
 const remainder={};
 if(!current||typeof current!=='object'||Array.isArray(current)||
    !proposed||typeof proposed!=='object'||Array.isArray(proposed))
  throw fail('MISSING_FREE_QUOTA_COUNTS');
 for(const key of fields){
  const val=current[key],delta=proposed[key]??0;
  if(!Number.isSafeInteger(val)||val<0||
     !Number.isSafeInteger(delta)||delta<0)throw fail('INVALID_FREE_QUOTA_COUNT');
  if(val+delta>QA44_FREE_CAPS[key])throw fail('FREE_PLAN_HARD_STOP_'+key);
  remainder[key]=QA44_FREE_CAPS[key]-val-delta;
 }
 if((proposed.photoUploadBytes??0)!==0){
  const size=proposed.photoUploadBytes;
  if(!Number.isSafeInteger(size)||size<1||size>QA44_FREE_CAPS.photosPerFileBytes)
   throw fail('PHOTO_PER_FILE_LIMIT');
 }
 const warnings=fields.filter(key=>current[key]+(proposed[key]??0)>=QA44_FREE_CAPS[key]*0.8);
 return Object.freeze({
  projectedNoOverage:true,neverUpgradeAutomatically:true,
  warnings,remaining:remainder,monthlyCostAssumptionKRW:0,
  realVendorBillingVerified:false,pausedServicePossible:true
 });
}
export function qa44EmailSmtpPlan({senderDomain,fromAddress,secretReference}={}){
 if(typeof senderDomain!=='string'||!/^([a-z0-9-]+\.)+[a-z]{2,24}$/.test(senderDomain)||
    senderDomain.endsWith('.invalid'))
  throw fail('VERIFIED_SENDER_DOMAIN_REQUIRED');
 if(typeof fromAddress!=='string'||!fromAddress.toLowerCase().endsWith('@'+senderDomain)||
    !/^[^@\s]+@[^@\s]+$/.test(fromAddress))
  throw fail('SENDER_MISMATCH');
 if(typeof secretReference!=='string'||!/^secret-manager:\/\/[A-Za-z0-9/_-]{8,100}$/.test(secretReference))
  throw fail('SMTP_CREDENTIALS_MUST_USE_SECRET_REFERENCE');
 // This is a PLAN ONLY. Never create a client or send email from this module.
 return Object.freeze({
  provider:'Resend',smtpHost:'smtp.resend.com',smtpPort:465,
  tls:'implicit',username:'resend',passwordSecretRef:secretReference,
  fromAddress,realDomainVerified:false,realEmailSent:false,
  automatedPaidOverage:false
 });
}
