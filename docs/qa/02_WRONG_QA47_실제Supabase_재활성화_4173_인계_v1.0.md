# 02 WRONG — QA47 실제 Supabase Auth 원본 복귀·4173 로컬 실행·재활성화 v1.0

- 수행일: 2026-11-21 KST / 사용자 요청: **새 자체 모의 로그인 서버 폐기**, 11/8~9 기존 QA47 실제 공급자 소스 3개 재사용, `localhost:4173`에서 실행, 기존 프로젝트가 INACTIVE이면 재활성화 확인.
- 승인 범위: 성인 테스트 계정, 아동 데이터·실사진·실메일 발송 0, loopback 격리, 시험 후 로컬 자원 정리, 06 기능·08 인가 독립판정. **실 공급자 가입/계정 신규 생성·기존 DB 변경·Edge 재배포·비용/운영 변경은 수행하지 않음.**
- 이번 실행은 GitHub 제품 코드 자체를 수정하지 않았으며 **기존 dev 소스 그대로** 가져왔다. 원본 git SHA`3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, 제품 index blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` 불변.

## 1. 실제 Supabase 소스 확인

| 원본 경로 | 원본 Git blob SHA1 | SHA 일치 | 역할 |
|---|---|---|---|
| `scripts/qa47-live-auth-lab.mjs` | `75e192bb8ef02c69001bab8353499f8df4d93e96` | **PASS** | `http://127.0.0.1:4173/?qa47=1`에서만 실제 Supabase `signInWithPassword`→`getUser`→`rpc('qa47_my_verified_family_ids')`→`functions.invoke('qa47-auth-status')` |
| `scripts/qa47-public-stage-config.mjs` | `af5cacd8cc550a06cb175342dedd892ed1569956` | **PASS** | `https://hnpbwxgpwpellgeusjim.supabase.co`, 공개 publishable 키, `allowStudentData:false`, `allowProduction:false`, 이메일 가입·SMTP/Google OFF |
| `supabase/functions/qa47-auth-status/handler.js` | `9c56c117e723617e0273bef92197175eb64c2008` | **PASS(저장된 GitHub 원본)** | 배포 Edge Function의 로컬 소스 참고. 이 파일을 localhost용 인증서버로 **실행하지 않음** |

**원격 배포 코드 별도 검증:** Supabase 커넥터 직접 조회 결과 `qa47-auth-status` 배포 v2 / ACTIVE / `verify_jwt:true`. 배포된 `handler.js`는 GitHub 원본과 **CORS allow-headers에서 `x-client-info` 항목이 빠진 차이**가 있다. SDK가 해당 헤더를 내보내면 Edge OPTIONS preflight가 차단될 가능성: **현 단계 원인 후보 / 실제 브라우저 N/T**. 원격 Edge를 재배포하지 않고 실제 배포본 그대로 유지.

## 2. Supabase 재활성화

- `get_project(hnpbwxgpwpellgeusjim)` 시작: **INACTIVE**.
- 사용자 지정에 따라 `restore_project` 1회: **success:true**.
- 이후 실제 상태 확인: **COMING_UP → ACTIVE_HEALTHY**.
- `get_project_url` = `https://hnpbwxgpwpellgeusjim.supabase.co`.
- 읽기전용 SQL `select to_regprocedure('public.qa47_my_verified_family_ids()')` → **함수 존재**.
- 기존 Supabase Auth 계정·유효 비밀번호·가족 RLS 실제 호출/인증 **수행하지 않음(N/T)**. 실제 행/개인정보 조회, 계정 생성·메일·Storage 파일 업로드/복원, 기존 SQL/Edge 수정0.

## 3. localhost:4173 실행과 증거

- 패키지: `02_WRONG_QA47_실제Supabase_로컬4173_v1.0.zip`, **13,035B**, SHA256 `00ca06bd5a9b6704b5cd9b47f57039f07d3076845ac49b5516815460758b9961`; ZIP 8개 파일/CRC **8/8 PASS**.
- 개인 Library **실파일 등록 확인**: `/WRONG-QA/02_WRONG_QA47_실제Supabase_로컬4173_v1.0.zip`, library ID `libfile_4fb0c5aaafe08191ba47a3ed550d04e1`; 06/08 별도 채팅의 직접 접근은 미확인.
- **서버:** stdlib Python으로 `127.0.0.1:4173`에 실제 HTTP 바인딩. 자체 인증/계정·DB/쿠키 없음. 단지 HTML·원본 QA47 `.mjs` 두 개만 정적으로 제공하고 다른 경로는 404.
- **확인된 HTTP:** `/?qa47=1` 200, `/index.html` 200, `/scripts/qa47-live-auth-lab.mjs` 200 (`text/javascript`), `/scripts/qa47-public-stage-config.mjs` 200 (`text/javascript`), 원본 서버 핸들러 경로/비허용경로 404, POST 405. 원본 3개 Git blob 검사·node syntax PASS.
- **브라우저 동적:** Chromium 390px 실제 `page.goto` 1회 시도 → `net::ERR_BLOCKED_BY_ADMINISTRATOR` **ENV_BLOCK**, 따라서 로그인 UI·실 비밀번호 로그인·Edge CORS·320/390 독립 기능 **N/T**. 관리자 우회/CI·운영 배포0.
- 로컬 서버 실행 후 직접 종료 확인(`127.0.0.1:4173` 응답 불가) = **정리 완료**. 사용자의 PC에서 자동 실행된 것이 아니라, ZIP의 `RUN_WINDOWS.bat`을 그 PC에서 실행해야 해당 PC의 loopback 주소로 접속 가능.

## 4. 이전 모의 서버 폐기

이전 자체 모의 로그인 `02_WRONG_B_성인테스트_로그인_v1.0` 디렉터리와 동일명의 ZIP을 **현재 작업 컨테이너에서 실제 삭제·부재 검증**. 이전 대화에 남아 있는 첨부파일·다른 위치의 복사본까지 원격 삭제했다고 주장하지 않는다. 이전 모의 계정 `adult-a`/`adult-b`는 **실 Supabase 계정 아님**, QA47에 사용할 수 없음. 별도 합성 HTTP 인증 근거 ZIP의 추적 이력은 회귀·감사용으로만 보존, 실 공급자 증거로 승격하지 않음.

## 5. 06/08 독립검증 요청 및 블로커

- **06 기능:** ZIP 원본 3개 해시와 HTTP/ZIP/cleanup, 사용자 PC에서 320/390 실 브라우저 진입·키보드·로그인/로그아웃 UI를 별도 원시로 판정. 현재 관리자 브라우저 차단은 환경 N/T, 기능 PASS 아님.
- **08 인가:** 실 Supabase 가입된 성인 QA 계정의 JWT `getUser`, RPC 가족멤버십, Edge v2 헤더·실 401/403·로그아웃/철회·실 RLS/Storage/부모 최소 DTO 조건을 **별도 보호된 가상 환경**에서 비식별 원시로 판정. 기존 사용자 아동 데이터·실사진·실메일·비밀번호/토큰 원문을 GitHub/채팅에 남기지 않음.
- 실제 성인 QA 계정의 이메일/비밀번호는 **이 자료에서 확보하지 못함**. 기존 QA47 소스는 `emailSignupEnabled:false`; 임의 계정 생성/실메일 발송 금지. 실 계정 자격증명 없는 환경에서 인증 성공/실사용 URL 공개를 주장하지 않음.
- **AUTH-GATE BLOCK**, `safeToRestore:false`, `VIS-FIX FAIL`, PR80 Draft, 7/8 HARD HOLD 유지. Supabase 프로젝트 재활성화는 실 공급자 인증 승인과 다르다. 제품 dev/main, 광고/배포/기존 CI/예약·비용 변경0.

## 변경 이유·버전관리

v1.0 신규: 사용자가 기존 자체 mock 로그인 결과를 명시 거부하고 **11/8~9의 실제 공급자 QA47 소스를 다시 이용하도록 지시**했기 때문에, 원본 Git SHA 고정·프로젝트 복원·루프백 정적 서버 실접속·N/T 한계·이전 모의 파일 폐기를 분리한 새 인계 문서로 기록한다. 원본 코드/QA47 클라우드 함수는 수정하거나 재배포하지 않았다.

GitHub 게시≠06·08 기존 대화의 메시지 직접 수신·독립 판정. 00 판단·06/08 실물 독립 결과 전까지 인증완료 승격 금지.
