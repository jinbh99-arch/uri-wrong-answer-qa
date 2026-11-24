# 02 로그아웃 후 구 JWT 직접 RPC 재사용 — P0 격리 설계 (2026-11-24)
상태: DESIGN ONLY / NO PRODUCT CHANGE / AUTH-VIS-ACK BLOCK / safeToRestore:false

## 새 증거와 결론
08 #82 댓글 7115682054: Jin 외부자문 브라우저에서 signOut 이후 만료 전 기존 JWT로 qa47_my_verified_family_ids RPC 200, 가족 UUID 1건. 08 직접 재생 N/T. 이는 Supabase JWT의 기본 만료 전 유효 동작과 일치하며 취약점 단정 금지. 다만 제품의 '로그아웃 즉시 서버 권한 차단' 요구가 확정된다면 P0 차단 요건.

## 선택지 비교
A. UI token 제거/짧은 exp: UX 보조이나 구 JWT 직접 RPC 재생을 막지 못함 — 단독 불가.
B. Edge에서만 auth.getUser/session 검사: Edge는 보호하지만 기존 SECURITY INVOKER RPC/RLS 직접 접근이 남음 — 단독 불가.
C. 서버측 활성 session_id 검증을 RPC 및 모든 아동 데이터 RLS 경로에 적용: 직접 RPC 우회도 차단 가능. auth.sessions 접근 권한, SECURITY DEFINER 사용 시 search_path/권한, RLS 재귀·성능, session_id 존재/삭제 시점 검증 필요.
D. 아동 데이터 직접 테이블/RPC 접근을 차단하고 단일 Edge 인가 경로로 통합: 정책 경계 명확하나 API 변경 범위와 마이그레이션 리스크 큼.
권고: 00/Jin 요구사항 확정 후 C/D를 격리 설계·최소 권한으로 비교, 운영 적용은 별도 승인.

## 격리 RED→GREEN 필수 매트릭스
1. 보호자 신규 로그인: 가족1, 비보호자 가족0, 익명 거부.
2. 보호자 signOut 직전 구 JWT 보관(로그에 토큰 기록 금지) → signOut 확인 → 동일 JWT로 RPC/Edge/직접 SELECT 및 사진·ACK 등 모든 접근이 가족0 또는 401/403, 데이터 반환0.
3. 새 세션 재로그인: 가족1 정상 복귀. 구 JWT는 계속 차단.
4. 만료·위조·철회·타가족 접근 거부; 공급자 장애503과 인증 실패401/403 구분.
5. 320/390 Chromium Back/cache/새로고침에서 이전 가족정보·승인 표시 비노출.
6. 원장 snapshot·사진·오답·메모 불변, 민감 로그0, 정확 역패치 증거.
7. 06/08 독립 판정 전 AUTH/VIS/ACK 차단 유지.


## 2026-11-24 차분 — 실 DB 메타 읽기전용 + 새 A격리 실행

- **실 DB 메타 SELECT (쓰기 0):** `public.qa47_my_verified_family_ids()`는 `SECURITY INVOKER`; 보호자 UID·externally_verified·동의·미철회만 검사하며 **JWT session_id/현재 세션 생존 조건 없음**. `qa44.guardian_memberships`와 `qa44.family_snapshots`의 SELECT RLS에도 활성 세션 검사 없음. `authenticated`의 `auth.sessions` SELECT 권한은 **false**, `public.qa47_my_verified_family_ids()` 실행 권한은 **true**. `auth.sessions.id` 열은 존재하며 행 수 **5건(집계만)**. 이 숫자로 특정 JWT 로그아웃 후 세션 행 삭제 여부는 알 수 없음.
- **A격리 검증 코드:** [`tests/qa49_logout_session_gate_isolated_20261124.test.mjs`](../../tests/qa49_logout_session_gate_isolated_20261124.test.mjs) Git blob `c3c2a1b456c42fe760c4cc0d1a82d811284ba47b` / SHA-256 `75c2548d868bf3df467bcf68f534e66c3877b2b9c65a4f8039e3cce3aa7ddabe`. `node --test tests/qa49_logout_session_gate_isolated_20261124.test.mjs` 실제 Node v22.16.0 **합성 12/12 PASS, exit0** (TAP SHA256 `11eea0a3ce8d10e1784af55c0471144eb9b5cf3304f8b1c4d853919ef201ca19`). 세션 검증만 의도적으로 제거한 변이 시험은 **7 PASS/5 FAIL, exit1** (원시 SHA256 `83f2478d06dbe5bd4fc84a7312f440b1b5a0f0a31d23614cec05c896f59f8476`). 변이 파일은 제출 QA 후보가 아님.
- **검증 범위 엄격 제한:** 테스트는 **합성 권한 모델의 계약 테스트**이며 SQL 엔진, Supabase SDK, 실제 `auth.sessions`, 실제 Google JWT, signOut, HTTP, IndexedDB 또는 아동자료 테스트가 **아님**. `auth.sessions` 실제 행 삭제를 가정하면 C/D 모델은 구 JWT 접근을 거부하지만, **행이 남아 있으면 접근이 계속된다는 위험 시험도 포함**. 12/12을 실제품·보안 PASS로 승격 금지.
- **실행 판단:** C는 모든 직접 RPC·SELECT·Storage·사진·ACK 경로에서 **서버측 신뢰 가능한 활성 session_id**를 확인해야 하며, `authenticated`에 `auth.sessions` SELECT를 넓게 부여하는 방식은 사용하지 않음. 필요 시 비노출 내부 스키마의 최소권한 검증 함수/실정책·search_path·EXECUTE·성능·로그아웃 시 세션행 소멸 여부를 08 승인 전제 아래 별도 설계. D는 직접 RPC `EXECUTE` 및 테이블·Storage 접근 차단을 **함께** 적용해야 Edge 전용 경로로 우회가 사라지며, 역시 Edge 내부 세션 폐기 검사가 필요함. 둘 다 실제 적용/권한변경/배포 **0**.
- **다음 독립검증:** 06/08이 이 신규 파일 원본 hash·합성 TAP·변이 시험부터 차분 판정한 뒤, Jin·00 요구 및 별도 인가 시 **실 공급자의 signOut → 동일 구 JWT RPC/RLS/Edge/Storage 재사용 여부**를 무해한 빈원장으로 독립 증명. 그전 `AUTH/VIS/ACK BLOCK`, `safeToRestore:false`, PR80 Draft, PUBLIC_HOLD 유지.

## 금지/미검증
실 DB/Auth/Edge/RPC/RLS 수정, 세션 강제철회, 배포, PR 병합, 실제 아동 데이터 시험 금지. 격리 합성 Node 테스트만 신규 12/12; 실 Chromium/원시 네트워크 및 06/08의 이 신규 SHA 독립 검증 N/T. 이 문서는 P0 설계 후보이지 PASS가 아니다.


## 2026-11-24 QA50 신규 증분 — 잔존 세션 행에서도 fail-closed 설계 (합성, 실제품 N/T)

- 최신 00 기술 기준: 현재기기 로그아웃 후 구 JWT로 RPC·RLS/SELECT·Edge·Storage/사진·ACK 접근 불가, global 로그아웃 후 사용자 전체 구세션 차단. **단순 `auth.sessions` 행 존재검사만은 행이 남는 반례에서 미수용**. Jin 보안정책 최종승인 아님. [00 지시 #7129215040](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7129215040), [08 단일지시 #7126906766](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7126906766).
- **코드:** [`tests/qa50_logout_revocation_ledger_isolated_20261124.test.mjs`](../../tests/qa50_logout_revocation_ledger_isolated_20261124.test.mjs) Git blob `ba69244cbb834b84a46e67ed378b4019bad05be8`; 동일 소스 git hash-object 실제 일치; source SHA256 `56ccb44900c48b6e694496147f8b873f110bc233b8b2463d7b62b25b2e839199`.
- **실행:** Node.js `v22.16.0`에서 해당 SHA 동일 소스 `node --test` 실제 **15/15 PASS, exit 0**. TAP SHA256 `1fc66acfa8d852f4fceee7259434c85fd770d1352ca886d178123f0fd572fb2e`. `revoked`·`globalEpoch` 검사만 제거한 **로컬 임시 변형**(GitHub에 업로드하지 않음)은 **9 PASS / 6 FAIL, exit 1**, TAP SHA256 `a191b9b53b20d62bdadb679efee02d27130d361797550977f9179f8a1a610926` — 실패는 구 JWT RPC/Edge·로컬/전체 로그아웃·신세션 분리·중복 로그아웃. 옛 12/12 검증을 재실행한 것이 아닌 새 QA50 계약이다.
- **새 설계 C+:** 독립적인 **서버 소유·내구성 있는 철회 집합**(`revoked_session_id`)과 **사용자별 global 철회 세대**를 현재 세션·보호자 소유/동의 조건과 **모두** 교차검사. 직접 RPC/SELECT/RLS·Storage·사진·ACK에서 동일한 검증을 강제. `authenticated`에게 `auth.sessions` SELECT를 그대로 부여하지 말 것. 실제로는 서버측으로 신원·`session_id`를 검증하고 비노출 최소권한 내부 헬퍼(권한·`search_path`·RLS 재귀·성능·관측성 별도 검토)만 이용해야 한다. **누락 경로·오류는 deny**.
- **새 설계 D+:** 직접 가족 RPC `EXECUTE`, 테이블 SELECT/RLS 및 Storage/사진 URL/ACK 경로의 권한을 **실제로 모두 차단**하고, 검증된 단일 Edge 경로에서 상기 철회 집합·global 세대·가족 동의 검사를 통과해야만 허용. Edge만 수정하고 기존 직접 RPC를 남기면 미수용. 기존에 발행한 **signed photo URL·브라우저 캐시**는 별도의 수명·회수/비노출 대응이 필수다.
- **서버 로그아웃 ACK 계약:** 철회 기록이 **서버에서 확인된 이후**만 '이전 JWT 즉시 차단' 성공을 안내한다. 철회 쓰기 장애는 성공으로 표시하면 안 되고, 그 사이 미철회 JWT가 여전히 사용 가능한 반례를 QA에 보존했다. UI 로그아웃이나 Supabase refresh 철회만으로는 해당 보안 보장을 주장하지 않는다. 다중기기 global logout의 세대 증가와 신규 정상 세션 등록은 원자성·경합/시간순서·위조등록 공격에 대한 08 보안 검증이 필요하다.
- **한계:** 위 C+/D+는 테스트 파일의 *가상 데이터 구조*일 뿐 실제 서버 철회 장부가 없다. 원본 Supabase PostgreSQL/RLS/Auth·실 `signOut` 뒤 `auth.sessions` 보존/삭제·JWT 재생·Storage signed URL·실 원격 401/403/503·실브라우저·06/08 신규 독립 **모두 N/T**. 테스트의 path별 boolean은 실제 직접 쿼리·사진 접근 차단 증명이 아니다.
- **다음:** 08이 신규 Git SHA·자체 격리 실행/신뢰경계, 06이 실제 화면 Back/cache의 신규 차분만 독립 확인. 제품/실 DB/Auth/RPC/RLS/Edge·Storage/PR/배포/CI/예약은 **0건 변경**, `AUTH/VIS/ACK BLOCK`·`safeToRestore:false`·PR80 Draft·PUBLIC_HOLD 유지.
