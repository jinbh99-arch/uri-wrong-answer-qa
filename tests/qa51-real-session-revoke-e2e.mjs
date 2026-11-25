// QA51 / 00Q-02-AUTH — REAL end-to-end revoke proof.
//
// WHY THIS EXISTS: every verification round so far (06, 08) has been source-level
// or synthetic (injected fake Supabase client). The repeated "N/T" gap is the
// one thing those rounds cannot prove: that after a real logged-in user clicks
// logout, their OLD real JWT is actually rejected by the server afterwards.
// This script proves exactly that, against the real deployed stack:
//   oauth-test.html -> real Supabase project -> real qa51-session-revoke Edge
//   Function -> real qa44.session_allowed()/tombstone check in Postgres.
//
// WHAT THIS SCRIPT NEVER DOES (by design, not by accident):
//   - It never performs the Google sign-in itself and never sees a Google
//     password. Automating a real sign-in against accounts.google.com is both
//     against this project's own security review expectations (Google treats
//     scripted logins as abuse) and outside what this harness should do.
//   - It never prints a full token. Only a short, non-reversible fingerprint
//     is logged, so a CI log can never leak a live bearer token.
//
// HOW A REAL RUN WORKS (one manual step, done once by whoever holds the
// registered Google test account — see docs/QA51_실제세션revoke_E2E_가이드_v1.0.md):
//   1. A human logs in once, for real, in an ordinary browser session driven
//      by `npx playwright codegen --save-storage=qa51.e2e.storageState.json
//      https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html`
//      and clicks the real Google login button themselves.
//   2. That storageState file (session only, no password) is kept OUTSIDE
//      git, referenced by path via QA51_E2E_STORAGE_STATE.
//   3. This script reuses that already-authenticated session to drive the
//      verify/logout buttons and confirm the server-side revoke for real.
//
// Without QA51_E2E_STORAGE_STATE set, this script exits 0 with a clear
// "SKIPPED — no real session provided" message. It is intentionally
// impossible for it to pass by accident without a real authenticated session.
// `playwright` is imported dynamically, AFTER that skip check, so this file
// can be committed and even run in an environment that has no browser
// binaries at all (it will just skip) and does not crash at import time.

const STORAGE_STATE = process.env.QA51_E2E_STORAGE_STATE || '';
const PAGE_URL = process.env.QA51_E2E_PAGE_URL ||
  'https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html';
const SUPABASE_URL = process.env.QA51_E2E_SUPABASE_URL ||
  'https://hnpbwxgpwpellgeusjim.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.QA51_E2E_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_MxRDT4iLkykSApfRHukUhA_H9KOcRJb';
const SESSION_KEY = 'uri-qa48-owner-google-test-session';

let checks = 0, failures = 0;
const pass = s => { checks++; console.log('PASS QA51-E2E', s); };
const fail = s => { checks++; failures++; console.error('FAIL QA51-E2E', s); };
const fingerprint = token => {
  if (!token) return '(none)';
  // Short, non-reversible marker only — never log the real token.
  let h = 0;
  for (const ch of token) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `len${token.length}:${h.toString(16)}`;
};

if (!STORAGE_STATE) {
  console.log('SKIPPED QA51-E2E — no QA51_E2E_STORAGE_STATE provided. ' +
    'This is expected until a real test account session is captured once ' +
    '(see docs/QA51_실제세션revoke_E2E_가이드_v1.0.md). Not a pass, not a fail.');
  process.exit(0);
}

let browser;
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (e) {
  console.log(`SKIPPED QA51-E2E — playwright not installed in this environment (${e?.message || e}). ` +
    'Not a pass, not a fail: install it (`npm i -D playwright && npx playwright install chromium`) where a real browser can run.');
  process.exit(0);
}
try {
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    console.log(`SKIPPED QA51-E2E — this environment cannot launch a real Chromium ` +
      `(${e?.message || e}). This is an environment/sandbox limitation (seen before as ` +
      `"ENV_BLOCKED" in 06's reports), not a test failure. Run this from an environment ` +
      'where a real browser can launch.');
    process.exit(0);
  }
  const ctx = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });

  // Step 1: confirm the reused real session actually verifies (real JWT, real RLS, real Edge Function).
  await page.locator('#verify:enabled').waitFor({ timeout: 15000 });
  await page.locator('#verify').click();
  await page.getByText('실제 Google', { exact: false }).waitFor({ timeout: 20000 });
  pass('real session verify() succeeded against live Supabase project + qa47-auth-status Edge Function');

  // Capture the OLD access token BEFORE logout, from the page's own sessionStorage,
  // the same storage key the production script uses. We never type or generate this
  // token ourselves — it is the real one issued by Supabase during the human's login.
  const oldAccessToken = await page.evaluate((key) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    } catch { return null; }
  }, SESSION_KEY);

  if (!oldAccessToken) {
    fail('could not read a real access_token out of sessionStorage before logout — cannot prove revocation without it');
  } else {
    pass(`captured pre-logout access token for replay check (fingerprint ${fingerprint(oldAccessToken)})`);
  }

  // Step 2: real logout / revoke through the real UI.
  await page.locator('#logout:enabled').waitFor({ timeout: 15000 });
  await page.locator('#logout').click();
  await page.getByText('잠갔습니다', { exact: false }).waitFor({ timeout: 20000 });
  pass('logout click reached the locked/pending-then-confirmed UI state');

  // Give the server ledger a moment (ACK already required by qa51-session-revoke
  // before local signOut per the production script; this is just a safety margin).
  await page.waitForTimeout(1500);

  // Step 3: THE actual proof — replay the OLD token directly against the real
  // backend (bypassing the page entirely) and assert the server now denies it.
  if (oldAccessToken) {
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/qa47_my_verified_family_ids`;
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'apikey': SUPABASE_PUBLISHABLE_KEY,
        'authorization': `Bearer ${oldAccessToken}`,
      },
      body: '{}',
    });
    const bodyText = await res.text().catch(() => '');
    if (res.status === 200) {
      fail(`REVOKED TOKEN WAS STILL ACCEPTED (HTTP 200) — this is the exact P0 the AUTH/VIS/ACK BLOCK exists for. Body: ${bodyText.slice(0, 300)}`);
    } else if ([401, 403].includes(res.status) || /42501|SESSION_DENIED|JWT/i.test(bodyText)) {
      pass(`revoked token correctly rejected by live server (HTTP ${res.status})`);
    } else {
      fail(`unexpected server response to revoked-token replay: HTTP ${res.status} — ${bodyText.slice(0, 300)}`);
    }
  }

  await ctx.close();
} catch (e) {
  fail(`unhandled error during real E2E run: ${e?.message || e}`);
} finally {
  if (browser) await browser.close();
}

console.log(`\nQA51-E2E summary: ${checks - failures}/${checks} checks passed.`);
if (failures > 0) process.exit(1);
