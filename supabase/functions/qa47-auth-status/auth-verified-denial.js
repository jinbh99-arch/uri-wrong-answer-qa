// 02 WRONG / 00Q-02-AUTH — private QA-only Supabase SDK error boundary.
// This module cannot prove a Supabase instance's true identity or family RLS.
// Only the *real imported* AuthApiError class is a recognized denial source;
// never accept messages, arbitrary fields, or client-provided role/claims.
const DENIAL_CODES = new Set(['bad_jwt','session_expired','session_not_found']);
export class Qa47VerifiedAuthDenied extends Error {
  constructor() {
    super('QA47_CONFIRMED_AUTH_DENIAL');
    this.name='Qa47VerifiedAuthDenied';
  }
}
export function rejectSdkAuthError(error, AuthApiError) {
  // Constructor identity is injected ONLY by index.ts from the pinned SDK.
  // This rejects arbitrary network errors and unauthenticated JSON objects.
  if (typeof AuthApiError==='function' && error instanceof AuthApiError &&
      (error.status===401 || error.status===403) && DENIAL_CODES.has(error.code)) {
    throw new Qa47VerifiedAuthDenied();
  }
  // This is an unknown/provider failure, not a proven invalid JWT.
  throw new Error('QA47_AUTH_PROVIDER_UNAVAILABLE');
}
