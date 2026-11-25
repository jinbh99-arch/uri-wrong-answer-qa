# QA51 실제 세션 Revoke E2E 검증 가이드 v1.4

기존 00Q-02-AUTH / #96 #7152473939 후속. PR83 시험 전용, 미병합.
## 선행 조건
- 00·08이 승인 범위와 격리된 성인 시험 계정/가족 fixture를 확인한다. 실제 아동/가족 데이터 사용 금지.
- QA51 SQL·Edge·UI가 설치된 **승인된 시험 URL**과 해당 DB migration 및 Edge deployment의 정확한 버전 증거를 대조한다. 기존 공개 URL을 기본값으로 사용하지 않는다. UI의 OAuth callback/origin 허용 목록도 해당 URL과 일치해야 한다. 변경/배포 필요 시 기존 승인 경계를 따른다.
- Node 및 Playwright headed Chromium, 수동 Google 로그인 가능 환경. 세션 파일 생성, codegen --save-storage, 브라우저 저장 상태 내보내기, 트레이스/스크린샷/CI artifact 금지. .gitignore는 보조수단이지 유출 방지의 충분조건이 아니다.

## 격리 설치 설정 (기본 비활성, 아직 설치하지 않음)
- 승인된 별도 HTTPS 시험 URL을 `qa47PublicStage.qa51IsolatedCallback`에 정확히 설정하고 같은 시험 프로젝트의 projectUrl/publishableKey를 지정한다. 기본 null은 기존 공개 QA 동선을 유지하지만 E2E 실행은 거부한다.
- 양쪽 Edge Function에 `QA51_ISOLATED_ORIGIN`을 동일한 HTTPS origin으로 설정한다. 설정이 있는 경우 기존 공개 origin/localhost를 허용하지 않는다. Supabase OAuth redirect allowlist와 HTML CSP connect-src도 정확한 시험 환경에 맞춰 검토·설치해야 한다. 현재 실제 승인 URL/설치 버전은 미확인, 운영변경 금지.
- 실행 전 해시 검증된 config의 projectUrl/key/callback을 환경 변수와 정확히 대조한다. 브라우저 실제 HTML/UI/config 응답 바이트도 실행 전에 해시 검증하고 원래 응답 헤더를 유지한다. JWT issuer 및 Edge ACK의 bearer 동일성도 검사한다. 격리 UI는 CDN 대신 같은 origin의 `scripts/vendor/qa51-supabase.bundle.mjs`만 로드한다. 해당 파일은 별도 검토된 정확 버전·lockfile 기반 단일 ESM 번들로 준비하고 SHA-256을 고정해야 한다. 현재 번들 실물은 미확보이며, 임의 파일로 대체하지 않는다.
- 격리 HTML의 CSP meta는 기존 공개 페이지를 수정하지 않고 설치본에서 `default-src 'none'; script-src 'self'; connect-src <승인 Supabase origin>; style-src 'unsafe-inline'; img-src 'self' data:; base-uri 'none'; form-action 'none'; upgrade-insecure-requests`로 지정한다. 서버 CSP 헤더도 독립 대조한다. 브라우저 하네스는 승인 API의 지정 method/path, 정확히 허용된 Google 로그인 origin 및 해시 고정된 4개 앱 자산 외 요청을 차단하도록 구성했다. 공급자 redirect 및 실제 네트워크 적용은 N/T이고, 브라우저 route만으로 완전한 네트워크 격리를 보증하지 않는다.

## 네트워크 경계 보완 (08 #7157004599)
- 요청의 출발 origin, 로그인 단계(login/provider/callback/verified), 정확 method/path, 중복 없는 query와 인증 헤더를 모두 확인한다. authorize의 provider=google 및 redirect_to는 승인 callback과 일치해야 하고 PKCE s256만 허용한다. token은 callback 단계의 pkce 교환만, logout은 verified 단계의 local scope만 허용한다.
- 승인된 app origin 이외의 frame에서 API 호출을 거부한다. Google 정적 자산은 provider 단계의 Google 계정 origin 출발 GET만 허용하며, bearer/API key를 Google로 보내지 않는다. 별도 logout 보류 route에도 동일 검사 적용.
- 검증 경계: Playwright redirect 체인 및 frame origin의 실제 관측, 브라우저 preflight 동작, 공급자 요청 형태는 아직 N/T. 관측이 불충분하면 시험 중단하며 허용범위를 임의로 넓히지 않는다. 브라우저 라우팅 단독으로 외부 네트워크 완전 차단을 보장하지 않는다.
- SDK 준비: 저장소 내 package lock/번들 없음 확인. 현재 실행 환경의 npm registry 조회는 DNS EAI_AGAIN으로 실패했고 로컬 npm cache에도 해당 패키지/번들러 항목이 없었다. 검토된 lockfile 및 실제 번들 확보 전 실로그인 금지.

## 실행 계약
환경 변수(승인된 시험값만 로컬에 설정):
- QA51_E2E_APPROVED=isolated-adult-fixture-only (실제 승인 확인 후 설정; 자체적으로 승인을 부여하는 값 아님)
- QA51_E2E_PAGE_URL, QA51_E2E_SUPABASE_URL, QA51_E2E_SUPABASE_PUBLISHABLE_KEY
- QA51_E2E_HTML_SHA256, QA51_E2E_UI_SHA256, QA51_E2E_CONFIG_SHA256, QA51_E2E_SDK_SHA256: 검토된 배포 파일의 SHA-256
- QA51_E2E_DB_VERSION, QA51_E2E_EDGE_VERSION: 독립 대조 완료한 설치 버전 식별자(하네스는 원격 버전 자체를 증명하지 못함).
실행: node tests/qa51-real-session-revoke-e2e.mjs

1. 새 headed 브라우저의 동일 context에서 지정 성인 사용자가 직접 로그인한다. Playwright storageState는 sessionStorage를 복원하지 않으므로 저장 파일 재사용 경로를 제거했다.
2. 성공 UI + 동일 미만료 JWT 직접 RPC HTTP200 및 가족 fixture 1개 이상을 양성 대조한다.
3. 로그아웃 클릭 후 정확한 QA51 Edge POST HTTP200 + serverRevocationCommitted=true, UI 잠금을 확인한다. 공급자 logout 요청을 잠시 보류하고 원장 ACK 이전 공급자 signOut으로 성공을 오인하지 않도록 한다.
4. 동일 JWT가 미만료 상태에서 직접 RPC 401/403 및 42501 SESSION_DENIED인 경우에만 서버 원장 차단의 제한 PASS. HTTP200은 FAIL; 만료·장애·다른 거부·잘못된 대상은 증명 불가. finally에서 보류를 해제하고 임시 context를 폐기한다.
5. 정상 로그아웃 완료 메시지 및 sessionStorage 제거 확인. 결과는 고정 단계/판정만 출력한다. 토큰, URL, 가족 ID, 응답 본문, 예외 원문은 출력하지 않는다.

## 미검증 범위 / 독립 검증
- 기본 설정 없음/브라우저 미설치: N/T(exit 2). 실패와 증명 불가의 분류는 06·08이 실제 원시를 대조한다. 제한PASS가 전체 제품 PASS를 뜻하지 않는다.
- 실제 서버 버전 대조, provider 경계, global 및 신규 정상 세션, 타가족, 직접 RLS/writer, Storage/signed URL, 실제 PG 동시성/old snapshot은 별도 승인된 fixture로 검증할 후속 범위이며 이 하네스로 PASS 처리하지 않는다.
- 시험 시작 전 08이 endpoint/버전/fixture/보류 방식 검토, 06이 화면 계약 검토. 기존 승인 없이 실로그인/철회/배포/병합하지 않는다.
- 임시 브라우저 폐기 후에도 공급자 세션 철회가 불확정이면 승인된 담당자가 별도 안전한 절차로 종료한다. 실제 세션 정보를 Git/채팅/CI에 남기지 않는다.
