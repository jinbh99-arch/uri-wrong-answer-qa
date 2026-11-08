// QA47 public staging configuration. Supabase publishable keys are public by design.
// NEVER add sb_secret_, service_role, DB passwords, SMTP, Google client secrets.
// This module is dynamically loaded ONLY on http://127.0.0.1:4173/?qa47=1.
export const qa47PublicStage=Object.freeze({
 projectUrl:'https://hnpbwxgpwpellgeusjim.supabase.co',
 publishableKey:"sb_publishable_MxRDT4iLkykSApfRHukUhA_H9KOcRJb",
 edgeFunction:'qa47-auth-status',
 localOrigin:'http://127.0.0.1:4173',
 realEmailSignInEnabled:true,
 googleOAuthVerified:false,
 customSmtpVerified:false,
 emailSignupEnabled:false,
 allowStudentData:false,
 allowProduction:false
});
