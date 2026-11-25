# QA51 실제 세션 Revoke E2E 검증 가이드 v1.1

기존 00Q-02-AUTH / #96 #7152473939 후속. PR83 시험 전용, 미병합.
## 선행 조건
- 00·08이 승인 범위와 격리된 성인 시험 계정/가족 fixture를 확인한다. 실제 아동/가족 데이터 사용 금지.
- QA51 SQL·Edge·UI가 설치된 **승인된 시험 URL**과 해당 DB migration 및 Edge deployment의 정확한 버전 증거를 대조한다. 기존 공개 URL을 기본값으로 사용하지 않는다. UI의 OAuth callback/origin 허용 목록도 해당 URL과 일치해야 한다. 변경/배포 필요 시 기존 승인 경계를 따른다.
- Node 및 Playwright headed Chromium, 수동 Google 로그인 가능 환경. 세션 파일 생성, codegen --save-storage, 브라우저 저장 상태 내보내기, 트레이스/스크린샷/CI artifact 금지. .gitignore는 보조수단이지 유출 방지의 충분조건이 아니다.

## 실행 계약
환경 변수(승인된 시험값만 로컬에 설정):
- QA51_E2E_APPROVED=isolated-adult-fixture-only (실제 승인 확인 후 설정; 자체적으로 승인을 부여하는 값 아님)
- QA51_E2E_PAGE_URL, QA51_E2E_SUPABASE_URL, QA51_E2E_SUPABASE_PUBLISHABLE_KEY
- QA51_E2E_HTML_SHA256, QA51_E2E_UI_SHA256, QA51_E2E_CONFIG_SHA256: 검토된 배포 파일의 SHA-256
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
