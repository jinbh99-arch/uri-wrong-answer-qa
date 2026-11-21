# 02 WRONG AUTH B단계 — localhost 성인 가상 계정·실제 HTTP 접속검증 v1.0

작성 2026-11-21 KST. **사용자 명시 신규 승인:** B단계 실접속 시험, 성인 시험 계정만, 아동 데이터·실사진·실메일 금지, localhost 격리, 사후 정리, **06 기능·08 인가 독립검증 필수**. [00 이전 판정 #7063355475](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063355475)의 기존 B HOLD는 사용자 신규 승인 전 기록; **승인된 localhost 범위만 실행**하되, 이 승인으로 별개 클라우드 프로젝트 재개·배포·비용·실아동 데이터 접근을 허용한 것으로 해석하지 않음.

## 1. 실행환경/원시 보관

- **실제 수행:** 독립 Linux sandbox의 Python 3, `http.server.ThreadingHTTPServer`를 실제 `127.0.0.1` 임시 포트에 바인딩, `requests`에서 **HTTP(S가 아닌 HTTP loopback)** 실 요청 송·수신. Python `cryptography` + `PyJWT`로 실행 중 생성한 **2048bit RSA RS256** 키로 JWT를 실제 서명·검증. SQLite 임시 DB, 프로그램 메모리만에 있는 성인 가상 3개 페르소나 (A/B guardian, A restricted-viewer), 사진은 실제 이미지 대신 테스트 문자열 바이트.
- **중요 구별:** JWT 발급자는 **LOCAL QA issuer**로서 **Supabase 공급자 JWT가 아님**. RLS/실 Storage가 아니라 Python 서버의 가족 스코프 검사. **제품 dev API/브라우저에 이 서버가 연결되지 않았음**. 실 공급자 B 단계 E2E·실 인증 결론은 **N/T**.
- **실제 결과:** 자체 실행 `28/28 PASS`, `0 FAIL`. 체크 이름/결과/원장 SHA가 있는 `localhost-results.json`, **동일 실행 소스** `02_WRONG_B_localhost_http_auth_harness_v1.0.py`, README 총 3파일.
- **원시 ZIP:** `02_WRONG_B_로컬인증_원시증거_v1.0.zip`, **9,090 bytes**, SHA256 `4adc3396996736dcf14ef0eeb003d523db124f614ac87995519a5c288173efe7`, ZIP CRC **3/3 OK**. PY SHA256 `338146eb1bd2e880a90d7c3e0a2389e68d9afcaeec14e3883c4be10b86a2618b`.
- **공유:** 개인 Library에 **실파일 업로드 성공**: `/WRONG-QA/02_WRONG_B_로컬인증_원시증거_v1.0.zip` (library_file_id `libfile_1cd936a63cc8819188e5ae411827e3b9`), `/WRONG-QA/02_WRONG_B_로컬인증_README_v1.0.md` (library_file_id `libfile_460a37c77f4481919dd757ee40ff293b`). GitHub 본 파일·#82에는 원시 해시·검증 조건만 게시. **06/08 개별 채팅의 Library 접근·실 다운로드는 미확인**, 독립 PASS 아님. 사용자 채팅 sandbox 다운로드는 별도 제공.
- **고정 제품:** `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, index blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` 불변. PR80 Draft.

## 2. A~F 항목별 자체 시험

| 단계 | 실제 localhost HTTP 검증 내용 | 자체 판정 | 미검증/독립 판단 |
|---|---|---|---|
| A 격리 | 127.0.0.1 실제 동적 포트, health200, 익명 record401, OPTIONS403, 외부 API·도메인 접근0 | 3/3 PASS | **별도 Supabase 프로젝트·Auth/RLS/Storage·preview/alias 실제 환경 분리 N/T** |
| B 신원 | 성인 3개 QA 계정 메모리 발급, RS256 서명·검증, 위조/만료/audience 거부401, guardian 철회 뒤 기존 토큰401 | 6/6 PASS | **실 Supabase 서명 공급자/성인 공급자 계정·JWT 잔여/멤버십 서버 E2E N/T** |
| C 인가/최소 DTO | guardian A 자기 200/B 교차 404/사진 404/쓰기404/role·family spoof403, 제한 viewer guardianNote 0/쓰기403 | 7/7 PASS | 제품 아동 DTO·실 서버 API 401/403/404·실아동 세션 N/T |
| D Storage·CAS | 로컬 SQLite stale revision409·거부 후 원장 SHA 불변, 가상 사진 전달·임시 URL 세션 범위·logout 후 URL 거부 | 5/5 PASS | **실 Postgres RLS·Supabase Storage·발급 signed URL·실 사진·트랜잭션 권한 N/T** |
| E 공유·네트워크 | 외부 Origin PUT403, 응답 `Cache-Control:no-store, private`, cookie 발급0, 로그아웃 토큰401 | 4/4 PASS | **Chromium 320/390·동일 프로필 세션 교체/IDB/BFCache/DOM N/T** |
| F 증빙·회수 | 초기/최종 원장 SHA 동일; 미사용 실메일/아동/사진, 서버 shutdown+close/스레드 join/SQLite 임시디렉터리 삭제, 토큰/URL/비밀번호 메모리 맵 clear | 3/3 PASS | 06·08 독립 원시 대조/실 공급자 사후 자원회수 N/T |

합계 **28/28**은 실행 소스의 정확한 `checks` 배열 기준. **실제 RLS, 실제 사진 URL 공급자, 320/390 실브라우저 통과라고 해석 불가**.

**불변 확인:** 초기/최종 가상 원장 SHA256 `991cd41357ca39f1dc409a68c885f92b79b39707e0b29946fb79e8dfba1779d4` 일치. 로그/ZIP에 token/password/private key/실메일/실사진/실아동 자료 저장0. 아동 계정 생성0(성인 제한 viewer 역할만 테스트).

## 3. 실제 차단·정리

1. 독립 환경 Chromium으로 `http://127.0.0.1:<임시포트>/` 브라우저 1회 접속 시험: **`Page.goto: net::ERR_BLOCKED_BY_ADMINISTRATOR`**. 동적 UI·320/390 스크린샷/아이 DOM/BFCache/IndexedDB **N/T**. 관리자 정책 우회·대체 자동화 강행0. 이는 **앱 자체 기능 FAIL이 아닌 환경 BLOCK**.
2. Supabase `list_projects` + `get_project`를 **읽기전용** 실제 재조회: 조직 `uri-level-test` Free로 이전 보고, 기존 `uri-wrong-answer-qa` 프로젝트 `INACTIVE`. 격리 DB/운영 자료 무오염을 보장할 수 없으므로 기존 프로젝트 **재개/사용/변경 0**, 새 유료·무료 프로젝트/실계정 생성0. 따라서 **B 실제 Supabase 인증시험 미수행**.
3. localhost 시험 종료 시 `finally` 서버 종료·SQLite close/임시디렉터리 삭제·세션·URL·비밀번호 메모리 비움, 자원 정리 자체 PASS. 외부 자원 신규 생성0이므로 복구 대상 없음. 키는 프로세스 메모리에서만 생성, 종료 후 폐기.
4. `safeToRestore:false`; **AUTH-GATE BLOCK**·**VIS-FIX FAIL**·7/8 HOLD/PR80 Draft 불변. 사용자 이번 승인은 QA 격리 B 시험 승인이지 운영 인증 완료/승격 승인 아님.

## 4. 06/08 독립 검증 요청 (중복 수행 금지)

- **06 기능 담당:** Library ZIP 9,090B 동일 SHA·ZIP CRC 3/3, 소스와 `localhost-results.json` 28개 0오류, HTTP 200/401/403/404/409·원장 두 SHA 일치·cleanup, 실제 dev/브라우저 연결 부재를 각각 판정. Chromium 관리자 차단을 기능 실패와 혼동 금지. 기존 W03/QA84/3·4·6/VIS/OCR CI 재실행 금지.
- **08 인가 담당:** 실제 RS256 서명/변조/만료/철회와 server-side familyScope, 최소 viewer DTO, 가상 사진 URL 철회·no-store/Origin·CAS 증거를 **LOCAL_ISSUER_TEST_LIMITED**로 독립 평가. **Supabase Auth 공급자 JWT/Postgres RLS/Storage 실인가·실 아이 DTO/동일 프로필 320/390 E2E는 BLOCK/N/T**로 독립 명시하고 필요한 안전한 다음 환경 계약만 제안. 기존 실제 계정/프로젝트·DB 접근 승인으로 자동 확대 금지.
- **00 총괄:** 06·08 각자 실제 댓글/원시·독립 판정 도착 후 **로컬 A~F 시험 일부 한정 수락** 여부 및 남은 Supabase/Auth 실접속 실행환경의 위험/비용/격리 조건을 별도 판단. **CI SUCCESS 또는 이 자체 PASS만으로 4단계 완료 금지**.

## 버전 사유

v1.0 **신규 실측 생성:** 기존 [A~F 정적 계획](02_AUTH_GATE_A-F_추가보안반례_v1.1.md)은 B 단계 실행 원시가 전혀 없었으나 사용자 신규 승인으로 **현 런타임에서 가능한 최소 실제 localhost API 통신**을 실시. 변경 원인은 승인 범위의 실행과 장애(브라우저 관리자 차단·공급자 프로젝트 INACTIVE) 분리·정리증거 확보. **인증 코드/제품 수정이 아닌 QA 전용 실측 보고**.

GitHub 게시≠06·08 기존 ChatGPT 채팅의 직접 수신 또는 독립 검증 완료.
