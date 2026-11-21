# 02 WRONG QA47 CORS 사전요청 수정 계약 v1.0

- 사용자 지시: 2026-11-22 KST 기존 실제 Supabase QA47 로그인 성공 후 Edge Function OPTIONS CORS 실패 제보. 실 공급자 토큰 원문 미수집.
- 실제 Edge 기준: `hnpbwxgpwpellgeusjim` `qa47-auth-status` v3 ACTIVE `verify_jwt:true`, `handler.js` OPTIONS/일반 응답 허용 헤더에 `x-client-info` 없음.
- 검증 환경: Supabase 관리 API, GitHub 직접 성공. 외부 HTTPS OPTIONS/GET 로컬 탐침은 DNS 해석 실패로 N/T. 320/390 사용자 PC 실제 브라우저 독립 재현 N/T. 사용자 제보의 로그인 토큰/Edge 직접 호출 성공은 제보상 확인(직접 검증 아님).
- 최소 수정: `handler.js`의 CORS allowed headers에 정확히 `x-client-info` 추가(Origin 허용목록 변경 없음), `index.ts` 진입 즉시 OPTIONS를 원래 handler로 보내어 요청 Origin을 검사하고 204 CORS 응답. GET 등 요청은 JWT Bearer 확인→실 공급자 `auth.getUser(token)`→guardian RPC 통과 전 성공 반환 금지.
- 배포 설정: 브라우저의 사전요청에는 인증 토큰이 없으므로 API 게이트웨이가 preflight를 차단하지 않도록 Edge `verify_jwt:false`로 변경. **보안 경계 변경을 명시:** 게이트웨이 JWT 필터가 빠지고 각 GET마다 서버-side Supabase Auth `getUser`와 RLS RPC가 단일 인증장벽. 무토큰 GET=401, 미허용 Origin=403을 유지하도록 설계. 사용자 실 인증 독립검증 필수. 실제 배포 승인 범위는 `qa47-auth-status` 한 건.
- 어떤 외부 Origin이든 허용하는 `*` 미사용. `Access-Control-Allow-Credentials` 추가 없음. 학생 원장·사진·업로드·동기화 필드 계속 false. 신규 프로젝트·계정·DB 변경 없음.
- 추가 완료 근거: 실제 배포 버전·설정·소스 재조회와 외부 OPTIONS Origin/header/GET 무토큰 확인을 따로 보고. 환경 차단 시 **실 브라우저 CORS PASS로 승격 금지**, `00Q-02-AUTH`에 ENV_BLOCKED 보고.
