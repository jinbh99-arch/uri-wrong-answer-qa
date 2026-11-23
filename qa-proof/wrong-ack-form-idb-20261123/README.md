# 00T-02-ACK-CORE — 실제 폼·IndexedDB 결합 격리 증거

- 기준 제품: `dev` `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`
- 실행: Node `v24.22.3`, Playwright `1.56.1`, 번들 Chromium headless
- 명령: `node --test tests/wrong-ack-form-idb-integration-20261123.mjs`
- 결과: 320px·390px 2/2 PASS, exit 0

검증한 경계:

1. 실제 화면 폼으로 r1 기록과 가상 사진을 IndexedDB에 저장한다.
2. r1 승인 뒤 ACK 불명 상태를 만들고, 보호자가 같은 기록을 r2로 수정하면 구 승인과 requestId를 무효화한다.
3. 지연 r1 성공 ACK는 무시한다.
4. r2 승인·POST 뒤에는 원장 GET readback을 우선하고 같은 회복 호출에서 추가 POST는 0건이다.
5. r1→r2 수정 전후 UUID와 사진 실제 바이트 SHA-256은 유지된다.
6. 503/`ok:false` ACK는 성공으로 확정하지 않는다.

실행 요약:

```text
ACK_FORM_IDB_CASE={"width":320,"revisionChanged":true,"oldApprovalInvalidated":true,"getBeforeRetry":true,"newPostDuringReadback":0,"lateR1Ignored":true,"photoBytesStable":true}
ACK_FORM_IDB_CASE={"width":390,"revisionChanged":true,"oldApprovalInvalidated":true,"getBeforeRetry":true,"newPostDuringReadback":0,"lateR1Ignored":true,"photoBytesStable":true}
ACK_FORM_IDB_RESULT={"status":"PASS_SYNTHETIC_BROWSER_IDB_INTEGRATION","cases":2,"realServerAck":"NOT_TESTED","realFamilyAuth":"BLOCK","safeToRestore":false}
```

한계: 화면·IndexedDB는 실제 제품 소스지만 ACK 서버와 GET/POST는 격리 상태기계다. 실제 원격 HTTP, Supabase/JWT, 가족 A/B 권한, 운영 DB·사진 원장은 검증하지 않았다. 제품 `dev/main`, PR #80, Edge, DB, 배포에는 변경이 없다. `ACK/AUTH/VIS BLOCK`과 `safeToRestore:false`를 유지한다.
