# 02 WRONG / 00Q-02-AUTH / A-isolated entrypoint regression — 2026-11-23 KST
- Source: QA branch prior HEAD dd6a7b7a6973341f464220379260759a6649380a. Local three files independently checked against exact Git blob IDs: index.ts 3f16f0fd781ae5dc44c42b5bf3281112ed78d125, handler.js 501d06b643c84405ddeab5776cb45d8b5ed873d4, auth-verified-denial.js 202b6ac57e21b7e269091b14c45b768b2ba50467.
- New finding: QA index.ts omitted the deployed v4's early OPTIONS routing. With unavailable env, requests attempted env.get before CORS preflight; the two new Node cases fail on the frozen QA source (red exit 1, 2 pass/2 fail), not a remote production proof.
- Local Node v22.16.0: new entrypoint (original index source in new Function with fixture SDK, real QA handler and typed-error adapter) + updated exact inverse Node tests: exit 0, 6 pass/0 fail. Run: node --test tests/qa47_edge_entrypoint_preflight_contract_20261123.test.mjs tests/qa47_auth_exact_inverse_20261123.test.mjs
- Local before-red.txt SHA256: 0812f358d4ad4bfc4888eacfc8fb794910f4da2aa4707e2925450d780fd31b51
- Local after-pass.txt SHA256: b34dbf686e13bdbd5db001711343dac7a356cbebd0e1188943b28afd79fcb861
- New test local SHA256: 68d4e7a25f55224ddbe77e141e2aac14e5aac2b9328e4c579bd47d115f1be134
- Exact inverse still restores original product dev index.ts 849057381bcfeaeda450e98190a535b0a072037b and handler.js 9c56c117e723617e0273bef92197175eb64c2008.
- Scope: QA-only source+synthetic Node integration. Actual pinned SDK Deno runtime, JWT/remote HTTP, Origin network behavior, family A/B, RLS, storage, 320/390, independent 06/08: NOT TESTED. AUTH/VIS/ACK BLOCK and safeToRestore:false unchanged. Product dev/main, PR80, Edge v4, DB, schedule unchanged.
