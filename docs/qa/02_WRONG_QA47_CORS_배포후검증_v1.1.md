# 02 WRONG — 실제 QA47 Edge CORS 수정 후 배포·검증 보고 v1.1

날짜: 2026-11-22 KST. **사용자 승인:** 인증 성공(사용자 제보상 실 토큰 발급) 후 `qa47-auth-status` CORS preflight OPTIONS에서 헤더 누락/Failed to fetch 해결 및 기존 함수 한 건 재배포. 아동·실사진·실메일 및 신규 CI 승인 없음.

## 실행환경 실제 접근 확인

| 도구·대상 | 확인 | 결과 |
|---|---|---|
| Supabase 관리 API 프로젝트 | `get_project(hnpbwxgpwpellgeusjim)` | `ACTIVE_HEALTHY`, ap-northeast-2 |
| Supabase 배포 코드·설정 | `get_edge_function(qa47-auth-status)` 실제 호출 | 변경 전 **v3/ACTIVE/verify_jwt:true**, 변경 후 **v4/ACTIVE/verify_jwt:false**, v4 SHA256 `b136fb254697de0a93d77673695fe8d2a30a465bc61468a95e98366f0283c36f` |
| 재배포 명령 | `deploy_edge_function` `name=qa47-auth-status`, `files=[index.ts,handler.js]`, `entrypoint_path=index.ts`, `verify_jwt=false` | 성공, v4 응답·재조회 일치 |
| 소스 버전 | GitHub QA `qa/wrong-p0-346-integrity-auth-ack-20261121@862eb8e90d2f6db2d6fa3bdb4c6b8a3c339830c3` | 기존 제품 dev/main 변경0. 요청한 Edge 원본 소스에서 `index.ts` OPTIONS 우선 처리 3줄 추가, QA handler 원본의 `x-client-info` 포함 CORS 헤더 그대로 배포 |
| HTTP wire 실제 OPTIONS/GET | 실행 컨테이너 Python `requests.request('OPTIONS'/'GET', https://hnpbwxgpwpellgeusjim.supabase.co/functions/v1/qa47-auth-status)` | **DNS NameResolutionError**. 외부 OPTIONS 204·Access-Control-* 수신 N/T; 실 브라우저 CORS 통과 N/T |
| 실제 Supabase 성인 토큰/실 가족 인가 | 사용자 제보로 로그인·직접 GET 성공, 이번 수행자는 JWT·계정·실 HTTP 원시 직접 검증 없음 | 사용자 보고 확인 / 독립 검증 **N/T** |

## 변경 원인·최소 수정

1. 사용자 브라우저 사전 요청은 `x-client-info` 헤더를 제안하지만, 원격 v3 `handler.js`는 `Access-Control-Allow-Headers: authorization, apikey, content-type`만 반환하도록 구현. v4는 `authorization, x-client-info, apikey, content-type`을 일반 응답/OPTIONS 양측에 추가.
2. v3의 `verify_jwt:true`는 **토큰 없는 OPTIONS가 함수 진입 전 플랫폼 인증에서 거부될 위험**이 있다. v4는 `verify_jwt:false`로 두되 `index.ts`가 OPTIONS를 **환경 변수/인증 처리 전에** `handler.js`로 전달. 허용한 `Origin`에서만 204 CORS 반환하고 미허용은 403. `Access-Control-Allow-Origin: *` 사용하지 않음.
3. **보안 경계의 의미:** `verify_jwt:false`는 플랫폼 단계 사용자 JWT 확인을 더 이상 하지 않는 것임. 하지만 **GET을 공개로 바꾸지 않았음**. `handler.js`는 GET Bearer 토큰 없으면 401, `index.ts`는 매 요청마다 Supabase Auth `getUser(token)` 검증하고 `qa47_my_verified_family_ids` RPC를 실제 사용자 토큰으로 수행. 예외/권한 미확인은 503 거부. 아이 기록·사진·업로드·동기화 응답은 모두 false. **이 정책의 실제 공격 반례·실 토큰·서명확인은 08 독립검증 N/T**.
4. 기존 `https://jinbh99-arch.github.io`·`http://127.0.0.1:4173` 2 Origin allowlist를 유지(확대0). 새 Access-Control-Allow-Credentials 없음. DB DDL·RLS·Storage·계정·운영 콘텐츠·PR80·신규 CI·예약 변경0.

## 실제 검증 범위와 인계

- **직접 확인된 실물:** v4의 원격 배포 메타데이터와 업로드된 소스. 코드 검사 9/9 (허용 Origin·OPTIONS 우선·x-client-info 2회·GET 무토큰 거부·실 `getUser`·가족 RPC·아동 기능 false 포함). 결과 **배포 완료 및 정적 서버 코드 확인**.
- **아직 N/T:** 네트워크에서 실제 OPTIONS 응답 204/Allow-* 수신, 실제 브라우저 CORS 해결, 유효·무효 JWT GET, 로그아웃/철회/동일 프로필·가족 A/B, 실 RLS/Storage, 320/390, 06/08 독립 판정.
- **06 기능 인계:** 사용자의 QA47 Windows localhost:4173 실제 Chrome 접속에서 x-client-info 포함 `OPTIONS` 204·`Access-Control-Allow-Origin: http://127.0.0.1:4173`·`Access-Control-Allow-Headers`에 `x-client-info`, 이어지는 `GET`의 정상 브라우저 처리/오류를 토큰 마스킹한 네트워크 원시로 확인. 기본 `Failed to fetch` 해소 전 PASS 금지.
- **08 인가 인계:** `verify_jwt:false` 변경으로 플랫폼 검증 한 층이 제외됨을 반영해 **서버측 `getUser(token)` fail-closed**, Origin 제한, 무토큰 GET·임의 토큰, JWT 만료·철회, 가족 RPC RLS/데이터 잔류 반례를 실제 공급자에 대해 독립 검증. 추가 실계정·아동·사진·메일 사용 필요하면 새 승인 요구.
- **00 의사결정:** 기존 `00Q-02-AUTH`의 `AUTH-GATE BLOCK`, `safeToRestore:false`, VIS FAIL, PR80 Draft, 7/8 HOLD 유지. 실제 OPTIONS 테스트가 현재 접근 도구에서 DNS 차단이므로 `[ENV_BLOCKED / 실제 검증 요청]`을 기존 #82 업무 ID로 등록.
- 링크: [원인·수정계약 v1.0](02_WRONG_QA47_CORS_preflight_수정계약_v1.0.md). v1.1은 실제 v4 배포·실증 추가로 별도 작성해 v1.0 변경 전 가설을 보존.

**GitHub 등록=06·08 채팅 직접수신 또는 독립 PASS 아님.**
