# 02 WRONG AUTH-GATE A~F — 비운영 격리 구성·수용증빙 설계 v1.0

2026-11-21 KST. 작업 ID `00Q-02-AUTH` / `00T-02-AUTH-GATE`. **상태: 요구/설계 정리 완료, 실 신원·서버 구현/시험/계정 생성 없음. AUTH-GATE BLOCK 유지.**

## 0. 원문과 현재 실제 근거

- 08 수용기준 원문 [#82 #7062593397](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062593397), 00 비운영 설계 승인/실접속 보류 [#7062893616](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062893616), 00 담당방 후속 [#7062900528](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062900528).
- 기존 `docs/qa/02_P0_4_가족인증_권한분리_차분수용계약_v1.0.md` blob `e3ffb418633322c41e400d30d638ec07f56d73d0`, `docs/qa/02_오답노트_공유기기_백업복원_보안설계초안_v0.1.md` blob `a0dc4aa9651e751e462c61185d662dda8d362c4a`, 합성 3/4 단계 06 독립 #7062059788와 08 정적 #7061958825. 합성은 실가족 권한의 근거가 아님.
- 02 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` / index blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`은 **기기 IndexedDB+UI 모드 기반**. 동일 프로필 A 기록 접근 기존 실측1. `scripts/qa-p0-family-response-epoch-guard.mjs`는 **QA 전용**, 제품 UI/서버 미연결.
- 실인증 구성 **후보**: `scripts/qa44-supabase-auth-adapter.mjs` 합성 localhost, QA47 성인전용 로컬 Supabase provider 연구. **Supabase Auth/RLS**가 주 인증 후보, Cloudflare Access는 향후 비운영 preview 출입층일 뿐 가족 인가 대체 금지. 본 문서는 실제 서비스 기술 선택을 승인하지 않음.

## 1. A~F 비운영 구성/수용증빙 표

| A~F | 비운영 구성 사전조건(현재는 설계만) | 08에 제출할 원시·거부 반례 | 수용 기준 및 현황 |
|---|---|---|---|
| **A. 환경 격리** | 운영과 다른 전용 비공개 preview origin, 인증 공급자 프로젝트, DB, 사진 Storage 버킷, 서비스/시험 계정의 완전 분리; preview·alias·익명 경로 차단, 유료·실자료 금지 | 승인된 시험환경 구성 식별자/리전·테스트 origin, public/preview/alias 무인증 GET401/403, DNS/스토리지/DB 분리 스키마·정책 SHA, prod 참조0 | **N/T**: 비운영 B 실접속 및 신규 자원/비용 승인 전 |
| **B. 실제 서명 신원·멤버십** | 승인된 *합성 성인* A/B 시험 계정, 공급자 서명 JWT를 서버에서 `getUser`/issuer·audience·expiry 검증, guardian verified/consent/revoked 멤버십을 서버 신뢰값으로 재확인; URL/body/role/familyId 자가신고 무시 | 서명 정상/위조/만료/비로그인 200/401, 위조 guardian 403, 로그아웃·철회 후 기존 토큰 401/403 및 서버 측 감사증빙; JWT·주소·민감정보 **전부 마스킹** | **N/T/BLOCK**: 합성 패스워드와 QA44/47 실험은 아동 이용권한이 아님 |
| **C. IDOR·아이 최소 DTO** | A/B 동일 recordId로 API GET/PUT/POST·사진 원본/축소·백업/복원 명령과 관찰·정답 등 역할별 DTO가 한 서버 인가 계층을 거침; 아이는 부모 전용 DTO를 **서버에서 생성하지 않음** | A→B 직접 URL/body/header 조작, 원본 사진 다운로드·백업/복원·아이 POST 전부 403/404 또는 무토큰401; child JSON/HTML/캐시/Network에 부모 메모·원문 사진·정답·미확인 OCR 0, 거부 뒤 A/B DB hash 불변 | **N/T/BLOCK**: 현 UI `display:none`/v218 child 토글은 서버 권한 아님 |
| **D. RLS·Storage·CAS** | 인증된 `auth.uid()`와 서버 guardian membership에 묶인 DB row-level security·사진 객체 소유권/서명 URL 재검증, 클라이언트 `service_role` 0, revision/ETag CAS | A가 B의 row/storage/bucket 경로 조작 시 403/404·자료0, stale revision=409, 정당한 guardian만 접근, 철회 시 RLS/Storage 재접근 차단, A/B 봉인원장 SHA/bytes·사진 SHA 변경0 | **N/T/BLOCK**: QA47 일부 RLS/Edge 근거는 실사진 REST·2인 E2E 검증과 다름 |
| **E. 공유 프로필·캐시 잔류** | 실제 비운영 320/390 동일 Chrome 프로필에서 A 로그인→지연 GET→로그아웃→B 로그인; 각 세션 전환 때 fetch 응답 epoch·메모리/DOM·IndexedDB·CacheStorage·Service Worker·뒤로가기·재접속 경계 | A 지연 응답이 B 화면/hidden input/ARIA/network cache에 재노출0, 백/포워드·재접속 A 화면0, 이전 IndexedDB 평문 열람0, 아이/부모 API body/header·PNG/JSON/네트워크 원시 및 row/photo SHA 검증 | **현행 BLOCK**: 같은 profile A 기록 접근 실측1, 합성 epoch helper 제품 미연결 |
| **F. 증거·정리·독립판정** | A~E 실행 승인 ID, 고정 source SHA40·CI/job ID, 비식별 합성 fixture·오류 원시, rollback과 계정/키/가상자료 회수·삭제 승인된 범위 | PNG/JSON·HTTP status·ZIP sha256/CRC·source/diff/원본 inverse, 테스트 토큰 비공개·비용0·실가족/운영 접근0; 06 UI/기능·08 API/보안 별도 PASS/PARTIAL/BLOCK/N/T | **N/T**: 설계 문서 SHA는 실행 원시/독립 PASS가 아님 |

## 2. 의존 순서 및 기술대안 선택

1. **선행(지금 문서만):** 00이 격리 origin·공급자 후보(Supabase Auth/RLS vs Cloudflare Access 미리보기)·DB/Storage·성인 가상 계정 생성·비용/삭제·비밀 마스킹·사용자 승인 범위를 **계획서로 판단**. 인증 공급자는 단순 UI/Cloudflare Access preview 코드가 아닌, 서버가 실제 서명된 신원 및 guardian 멤버십을 검증할 수 있는 선택이 필요.
2. **A 승인 후에만:** 비운영 리소스 생성·접근 방식·운영과 연결 0을 독립 확인. 승인 없는 credential 요청, 실제 사용자/실가족 데이터 액세스 금지.
3. **B→C→D:** 실서명+보호자 검증과 철회 뒤 서버403/401이 우선. 그 뒤에 원본사진/아이 DTO 최소화와 DB RLS·Storage 실정책·CAS. `role=child`/familyId를 클라이언트에서 바꾸는 방식은 보호가 아니다.
4. **E→F:** 동일 프로필 경쟁/캐시·로그아웃 검증을 통과하기 전 사용자 UI와 보관·복원 연결 불가. 06·08은 각 고유 원시에서 독립 판단, 00·99 승인과 운영환경 시험은 별도 게이트. CI SUCCESS만으로 실제 가족정보 공개 불가.

### 리스크·중단 조건

- C/E의 서버 DTO/공유기기 보호가 실패하면 데이터·아이 사진 노출 위험 P0, 전단계 HOLD.
- A/B/D를 임의로 인증했다고 표시하거나 합성 계정 토큰/사진/로그를 공개 GitHub에 넣는 행위 금지.
- B단계 자원·계정·DB 접근은 Jin/99 승인 전 **실행 차단**. 이 문서는 신규 계정 생성·테스트 환경 배포의 위임이 아니다.
- 운영 데이터, Cloudflare/Supabase 기존 프로젝트, 실제 가족 계정, PR80 Draft, 제품 dev/main, 광고·예약 변경 **0**. `safeToRestore:false`, VIS 즉시 PNG FAIL, 7/8 HARD HOLD 유지.

## 3. 판정/인계

- **완료:** 08 A~F 원문 기준으로 비운영 환경 구성과 테스트/수용 증빙항목을 연결한 문서 작성. 기존 3/4/6 합성 시험 및 QA44/47 재실행0.
- **미검증:** 실제 signed JWT, guardian consent, 서버 API/Storage, 실 320/390 공유기기, 비운영 B 실접속, 원시 06/08 독립판정. **AUTH-GATE BLOCK**.
- **다음 1건:** 00/99/Jin이 **비운영 A 환경 격리·성인 합성 계정·공급자·정리/비용 범위 승인 여부**를 판단한 뒤에만 실행계획으로 전환. 08이 본 문서 A~F 범위를 읽기전용 검토할 수는 있지만 실제 계정/DB/API 검증 승인으로 해석 금지.

GitHub 게시≠00/08 기존 ChatGPT 방이 새 모델 메시지를 직접 수신했다는 증거.
