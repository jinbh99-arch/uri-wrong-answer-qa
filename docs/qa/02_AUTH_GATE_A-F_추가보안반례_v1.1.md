# 02 WRONG — AUTH-GATE A~F 추가 비운영 보안 반례 v1.1

- 작성 2026-11-21 KST. **v1.0 원본은 그대로 보존**: [A~F 환경·수용증빙 설계 v1.0](02_AUTH_GATE_A-F_비운영분리_수용증빙_구성설계_v1.0.md) blob `412e811d87ff04009754c1633736e7b72c081c3c`.
- 수정사유: 08 독립 [#82 #7063201193](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063201193)의 **(a) JWT 잔여 유효·기발급 사진 signed URL, (b) cookie/Origin·CORS/CSRF·캐시, (c) 증거 마스킹** 추가 요구를 00 [#7063355475](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063355475) 읽기전용 허용 범위로 보완. `AUTH-GATE BLOCK`.
- **아래는 시험 목록/기대 계약만**: 실제 계정 로그인, 서명 URL 발급/재생, API·DB·Storage 요청, CI·브라우저 실행 **0건**. 로그인/URL/토큰·가족 식별자는 모두 합성 표기. 실제 상태는 **N/T / EXECUTION_BLOCKED_PENDING_JIN_APPROVAL**.

## A~F 기존 설계에 추가할 거부·복구 반례

| ID · 연계 | 비운영 가상 반례(사용자 생성/네트워크 실행 아님) | 수용 관측·서버 요구 | 현 상태 |
|---|---|---|---|
| **A1 / A** | 운영 origin vs 분리된 private preview, 우회 alias/하위 경로 접근 | 승인된 시험 origin·Auth tenant/DB/Storage/계정 식별/설정 SHA 상호 불일치, 무로그인 기본/alias 401·403, prod 연동0 | 환경 독립 증거 **N/T** |
| **A2 / A·C** | 비로그인 API `GET /private`가 **302 로그인 → 200 공개 로그인 HTML**로 오인되거나 캐시에 남음 | API 클라이언트에서는 401/403(또는 정책상 비식별 404)을 판별; `redirect`/최종 status/Content-Type 분리 기록, 사유 숨김·원본 자료0 | **N/T** |
| **B1 / B** | **로그아웃** 직전에 발급된 정상 JWT가 access-token 잔여 유효시간 동안 다시 제출됨 | 서버가 `getUser` 확인뿐 아니라 세션 철회/guardian 멤버십 상태를 요청 시 재평가; 정책상 폐기가 즉각 불가능하면 서버 접근차단·잔여 TTL/강제 무효화 범위를 사전 명시·검증. **로그아웃 UI만으로 서버 토큰 폐기 인정 금지** | **N/T / BLOCK** |
| **B2 / B** | guardian 자격/동의 **철회** 직후 유효 JWT 재이용; familyId·role을 body/header에서 A→B 변조 | 서버 멤버십·동의·revoked 상태에 따라 읽기/쓰기·백업 403/404, JWT 서명 정상이어도 거부. row/photo 원장 불변 | **N/T / BLOCK** |
| **B3 / B** | 탈취/위조·만료·다른 issuer/audience JWT / localStorage 재사용 | 서명·aud/iss/exp·서버 사용자/세션 검증 거부401; 브라우저에 `service_role`·refresh token 노출0, 비밀로그0 | **N/T** |
| **C1 / C** | 아이 세션에 `guardianMemo`·OCR 미검토 텍스트·정답·원문사진이 **숨김 DOM/HTML/네트워크 JSON/302 캐시/브라우저 history**로 남음 | 서버 **child 최소 DTO**를 먼저 생성, 부모 필드 아예 직렬화0. CSS/DOM 삭제만으로 불합격. GET body·헤더·CacheStorage·백/포워드까지 점검 | **제품 DTO 실증 N/T/BLOCK** |
| **C2 / C** | A 토큰으로 B의 동일 recordId `GET/PUT/POST`, 사진·백업·복원 직접 URL 조작 | 각 접근 403/404, 무로그인401, child 관리 POST도403. 합법적 동시성 충돌은 별도409. 가족 A/B 사진·행 SHA 불변 | **N/T/BLOCK** |
| **C3 / C·E** | CORS 임의 origin에서 인증 cookie 포함 preflight·동일출처 아닌 POST | 엄격한 allowlist Origin, `Access-Control-Allow-Credentials`/허용 origin 점검; 와일드카드+자격증명 거부, `Origin:null`/불명확 출처 fail-closed | **N/T** |
| **C4 / C·E** | 브라우저가 cookie 기반 세션을 쓸 때 외부 폼 POST, 이미지 GET, SameSite 우회·CSRF 토큰 누락 | 상태변경 요청은 CSRF/Origin/Referer 정책 검증, `Secure/HttpOnly/SameSite` 쿠키 정책; `GET` 읽기만·민감 캐시 금지. **Bearer만 쓰는 설계와 cookie 쓰는 설계를 혼합하지 않고 실제 선정 후 분기** | **설계 선택 미정/N/T** |
| **D1 / D** | guardian 철회 **전 발급**한 사진 signed URL을 철회 후 재사용 | 기존 URL의 실제 만료시간·객체·캐시·CDN 재요청 거부 또는 허용 TTL의 한계/폐기 메커니즘 명시; 철회 뒤 새 발급 403. **DB RLS만으로 이미 발급한 URL이 무효라는 추정 금지** | **N/T/BLOCK** |
| **D2 / D** | B family storage object key로 원본·썸네일·범위 요청(HEAD/GET/Range)·백업 다운로드 | 객체 소유권 검사/비밀 없는 키, 타가족 403/404, 응답 Content-Disposition/Cache-Control/ETag로 메모·사진 파일명 노출0 | **N/T** |
| **D3 / D** | 정당 guardian이 오래된 revision PUT/동시에 두 요청 → 일부 사진만 저장/구 레코드 덮어쓰기 | revision CAS `409`(권한이 먼저 유효해야 함), row/photo 원자성·해시/원장 일치, ACK_UNKNOWN 후 신규 POST0·재조회만. `409`과 `403` 의미 혼동 금지 | **로컬/합성 제한만** |
| **E1 / E** | A→로그아웃→B 동일 프로필에서 A의 **in-flight 200 응답**이 뒤늦게 도착 | client epoch 무효화 + 서버 재인가, B DOM·메모리·ARIA·IDB·CacheStorage·history A 값0. **QA-only epoch helper ≠ 제품 연동** | **N/T/BLOCK** |
| **E2 / E** | A 화면에서 브라우저 뒤로가기(BFCache)·304 재검증·서비스워커/프리패치 후 B 재접속 | 민감 API/사진 `Cache-Control:no-store` 정책+실 캐시 저장/복원 조사, 304/redirect도 전·후 family scope 유지. 성인/아이 전환 시 DOM/hide 필드·브라우저 저장소 접근권한 확인 | **N/T/BLOCK** |
| **E3 / E** | 비밀번호 재설정/세션 강제만료/동시 탭 A→B, 로그아웃 뒤 토큰/임시 URL 클립보드·다운로드 파일 남음 | 현황·삭제/보존 책임 분리. 앱 내 세션/메모리/캐시 clear 및 사용자에게 다운로드 보존 고지; **허가 없이 기기 파일 삭제0**. 재로그인 B에서 A 평문0 | **N/T** |
| **F1 / F** | 증거 ZIP에 JWT/access/refresh 토큰, cookie, 임시 사진 signed URL 쿼리, 실메일/실사진 포함 | 비식별 synthetic fixture만, ID도 임의 해시·접두어 사용, 로그/캡처 URL 쿼리 전량 마스킹, 실제 토큰 원문0, ZIP SHA256/CRC·원본 복원 및 별도 06/08 판정 | **인수 계약만 완료** |
| **F2 / F** | 비운영 시험 완료 후 자원/키/계정·가상 사진/DB가 남거나 운영과 혼동 | 승인 ID/비용·정리 순서, 환경·계정·서명 URL/사진/캐시 정리(수동 승인 포함)·원본 정책·SHA·rollback 증빙. **사전 Jin B단계 실행 승인 없으면 아무것도 생성·삭제 안 함** | **실행 BLOCK** |

## 08 독립 판정 전 사전 대조 체크

1. AUTH provider=**Supabase Auth/RLS 주 후보**와 Cloudflare Access=private preview **입구 보호층**을 분리. 어떤 공급자·쿠키/토큰 전달 방식을 실제 선택했는지는 미확정. 읽기전용 Supabase 조직/프로젝트 현황이 있어도 `INACTIVE` 프로젝트 재개·유료 전환·실DB 접속을 승인하지 않는다.
2. 비운영 B 시험 승인 이전에는 A/B 실인증·Storage·서명URL·DB·HTTP 401/403를 **시험에서 확인했다고 쓸 수 없음**. 이 표의 상태는 전부 설계 / N/T / BLOCK이며 기존 stage3/4/6 합성 결과를 중복 재실행하지 않음.
3. JWT 철회와 서명URL 철회를 **별개 보호 게이트**로 취급하고, 클라이언트 logout 이벤트와 서버 거부·CDN 캐시 무효화를 혼동하지 않음.
4. GET /민감 API의 302→200 리다이렉트나 304·stale 캐시를 **정상 인증 200**으로 간주하지 않는다. 서버·브라우저 body와 header·cache/ETag를 함께 검사할 수 있어야 함.
5. 320/390 동일 프로필 A→B·child/guardian에서 browser history/cache/IndexedDB 잔류와 사진/메모 비노출 원시·봉인원장/사진 SHA를 분리한다.
6. 모든 실측에는 원시/비식별 지표·범위·시점·제공자 계약·독립 06(기능)·08(인가)·00(기술 판단)·99(최종 범위 승인)을 구분. 문서만으로 QA PASS·제품 승인 표시 금지.

## 변경 이력과 다음 단계

- **v1.0** A~F 6조건·환경/수용증거 설계 작성, 08 `AUTH_A_F_DESIGN_STATIC_ACCEPTED`.
- **v1.1** 위 A1~F2 **17개 반례/증거조건 확장**. 이유=08 #7063201193의 JWT 잔여, 기발급 signed URL, CORS/CSRF/cookie/cache/302·마스킹 공백 보완. 기존 v1.0 파일 수정0; 본문 추가만. 원안 10단계·제품 정책 변경0.
- **다음:** 08이 **읽기전용 계약 보강** 여부만 판정하고 00/99/Jin은 별도 B단계 실접속 환경 승인 여부를 독립적으로 결정. 이 문서는 승인 요청을 대체하거나 계정/DB/Storage 자원 변경을 허용하지 않는다.

**불변:** `AUTH-GATE BLOCK`, `VIS-FIX FAIL`, `safeToRestore:false`, PR80 Draft, 7/8 HARD HOLD, 제품 dev/main·실자료/실가족·배포·광고·예약·CI/보안 설정 변경0.
