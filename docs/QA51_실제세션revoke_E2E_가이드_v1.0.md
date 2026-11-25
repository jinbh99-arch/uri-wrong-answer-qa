# QA51 실제 세션 Revoke E2E 검증 가이드 v1.0 (2026-11-25)

작성: 외부자문방 (Jin 승인 후 `advisor/qa51-real-e2e-harness-20261125` 브랜치에 게시)

## 이 문서가 다루는 문제

`00Q-02-AUTH`(QA51 로그아웃 후 구 JWT 재사용 차단)는 06·08이 여러 차례 독립검증했지만,
모든 검증이 **소스 레벨 정적 확인** 또는 **가짜(synthetic) Supabase 클라이언트를 주입한
Playwright 테스트**였습니다. 실제로 한 번도 증명되지 않은 것은 다음 한 가지입니다:

> **진짜 사람이 진짜 Google 계정으로 로그인한 뒤 로그아웃을 누르면, 그 사람의 예전 토큰이
> 서버에서 진짜로 거부되는가?**

이 문서와 `tests/qa51-real-session-revoke-e2e.mjs`는 이 질문에 실제로 답하기 위한 도구입니다.

## 이 도구가 절대 하지 않는 것 (보안상 의도된 설계)

- **Google 로그인 자체를 자동화하지 않습니다.** Google은 자동화된 로그인 시도를 이상행위로
  간주해 차단하며, 비밀번호를 자동화 스크립트에 넣는 것 자체가 바람직하지 않습니다.
- **토큰 값을 로그에 남기지 않습니다.** 재사용 확인에 꼭 필요한 접속 토큰(access token)은
  짧은 지문(fingerprint)만 출력하고, 실제 값은 절대 출력하지 않습니다.
- **크리덴셜(비밀번호, 계정 정보)을 어디에도 저장하지 않습니다.**

## 딱 한 번, 사람이 직접 해야 하는 단계

Google 테스트 계정을 가진 사람(Jin 또는 00가 지정한 사람)이 **딱 한 번만** 아래를 실행합니다:

```bash
npx playwright install chromium   # 최초 1회
npx playwright codegen \
  --save-storage=qa51.e2e.storageState.json \
  https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html
```

브라우저 창이 뜨면 **본인이 직접** "Google 계정으로 로그인 시험" 버튼을 누르고 실제 Google
테스트 계정으로 로그인합니다. 로그인이 끝나면 그 창을 닫으면 됩니다 (아무 버튼도 추가로
누를 필요 없음). 그러면 로그인된 세션 정보가 `qa51.e2e.storageState.json`에 저장됩니다.

**이 파일은 비밀번호를 담고 있지 않지만, 로그인된 세션 토큰은 담고 있으므로 절대 git에
커밋하지 않습니다.** (이 저장소 `.gitignore`에 이미 패턴을 추가해 두었습니다.)

## 자동 검증 실행 (이후로는 반복 가능)

```bash
QA51_E2E_STORAGE_STATE=./qa51.e2e.storageState.json \
  node tests/qa51-real-session-revoke-e2e.mjs
```

이 스크립트가 실제로 확인하는 것:
1. 저장된 실제 세션으로 "로그인·보호자 권한 다시 확인" → 실제 Supabase RLS + Edge Function 통과 확인
2. 로그아웃 전 실제 접속 토큰을 (값은 노출하지 않고) 캡처
3. 실제 "로그아웃" 버튼 클릭 → UI가 잠금 상태로 전환되는지 확인
4. **핵심 증거:** 캡처해둔 예전 토큰으로 서버 RPC(`qa47_my_verified_family_ids`)를 직접
   재호출 → 서버가 401/403 또는 `SESSION_DENIED`로 거부하는지 확인

4번이 실패(즉 예전 토큰이 여전히 200으로 받아들여짐)하면, 이는 `AUTH/VIS/ACK BLOCK`이
존재하는 바로 그 이유가 실제로 재현된 것이므로 **즉시 00/08에게 보고하고 배포 보류를
유지**해야 합니다.

## 환경 제약 안내

이 스크립트는 실제 브라우저(Chromium)를 띄울 수 없는 샌드박스 환경에서는 자동으로
"SKIPPED"로 끝나고 실패로 처리되지 않습니다 (06가 이전에 보고한 `ENV_BLOCKED`
—`socket() failed: Operation not permitted`—와 같은 종류의 제약). 이 경우 실제 브라우저를
띄울 수 있는 환경(예: Jin의 PC, 또는 Chromium 실행이 가능한 CI 러너)에서 실행해야 합니다.

## 범위 확인

이 PR은 **테스트 코드와 가이드 문서만 추가**합니다. 제품 코드(`db/`, `supabase/functions/`,
`scripts/qa48-google-oauth-test.mjs`)는 전혀 건드리지 않았습니다. 실행은 여전히 사람(Jin
또는 00가 지정한 사람)이 실제 테스트 계정으로 한 번 로그인해야만 가능하며, 이 PR 자체가
자동으로 그 로그인을 수행하거나 보안 검증을 생략하지 않습니다. 06/08의 독립검증은 그대로
필요합니다 — 이 도구는 06/08이 검증할 때 쓸 "실제 환경 테스트 도구"를 미리 준비해 둔 것입니다.
