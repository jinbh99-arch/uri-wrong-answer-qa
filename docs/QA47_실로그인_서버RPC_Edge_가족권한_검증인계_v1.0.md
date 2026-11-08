# QA47 · 실제 Supabase 로그인 연동 · 실서버 가족 RLS 통합검증 v1.0

**작업일:** 2026-11-08 / 프로젝트: `uri-wrong-answer-qa` (`hnpbwxgpwpellgeusjim`) / 조직 `uri-level-test` **Free / 서울 리전**

## 결과 구분

- **실제 적용 완료:** Supabase Auth에 연결 가능한 **공개용 publishable 키** 확인, 인증 완료 상태를 조회하는 `qa47-auth-status` Edge Function **실배포 ACTIVE v1 / verify_jwt=true**, 공개 스키마에 **SECURITY INVOKER 읽기전용 RPC** `qa47_my_verified_family_ids` 실제 마이그레이션 성공, 성인 시험용 로컬 로그인 UI 소스 및 실제 Supabase JS SDK 호출 경로 연동.
- **실제 PostgreSQL 검증 완료:** 두 가구 합성 `auth.users`, `qa44`, `storage.objects`를 **트랜잭션 안에서 임시 작성 후 전부 ROLLBACK**; 인가된 A의 자체 보호자 1/스냅샷 1/사진 메타 1, 타가족 스냅샷·사진 메타 0, 동의 없는 B 0, 철회한 A 0. `qa47_my_verified_family_ids` 실제 DB에서 A에게 자기 가족 UUID만 1개 반환. 실제 DB에서 익명 RPC 실행권한 false, 로그인 계정 true, SECURITY DEFINER false. 재조회 후 실 가입자·가족·오답·사진 메타 **0**.
- **아직 실제로 완료하지 못한 것:** Google Cloud OAuth Client ID/Secret 등록·최종 사용자 Google 로그인, 실제 이메일 계정 가입/확인·메일 발송/수신, 실제 Supabase 로그인으로 얻은 JWT의 Edge/RPC 다중 사용자 종단간 테스트, Storage REST API 실제 JPEG 업로드·다운로드, 보호자 신원·동의 실증, 운영 동기화 Writer 연결/충돌·재시도·백업 복구, Android/iOS 실기기 검수. 아래 코드·CI는 이 항목들의 실검증 증빙을 대신하지 않는다.

## 서비스 API 적용 상태

| 구성 요소 | 실제 반영/검증 |
|---|---|
| `public.qa47_my_verified_family_ids()` | 실 Supabase DDL `apply_migration` success / 익명 불허 / 본인 역할 검증 후 UUID만 반환 |
| `qa47-auth-status` Edge Function | Supabase `deploy_edge_function` 응답 **ACTIVE v1**, `verify_jwt=true` / 실 OAuth 사용자 호출 미실시 |
| `supabase/functions/qa47-auth-status/handler.js` | 루프백 Origin 외부 403, JWT 없으면 401, 읽기 GET only, 서버 측 Auth `getUser(token)`, SECURITY INVOKER RPC로 검증 상태만 응답; 아동 기록·사진·쓰기 노출 없음 |
| `supabase/functions/qa47-auth-status/index.ts` | 서버 환경 제공 `SUPABASE_URL` 및 **public `SUPABASE_ANON_KEY`**만 사용, service_role·DB 비밀번호 불필요; 서명 토큰은 로그에 출력하지 않음 |
| `scripts/qa47-live-auth-lab.mjs` | 오답노트 실제 UI 설정에 통합. `http://127.0.0.1:4173/?qa47=1`에서만 보이며, 실제 Supabase SDK 이메일 로그인 → `auth.getUser()` → 보호자 RPC → 배포된 Edge를 순서대로 호출. 로컬 브라우저에서만 세션 유지. 공개 GitHub Pages/다른 원점에서는 UI 미출력 |
| `scripts/qa47-public-stage-config.mjs` | **공개용 publishable 키만** 보관(비밀키 아님); `realEmailSignInEnabled=true`, `googleOAuthVerified=false`, `customSmtpVerified=false`, `emailSignupEnabled=false`, `allowStudentData=false`. |
| 자동검사 | `tests/qa47-edge-auth-status.mjs`, `tests/qa47-live-auth-ui.mjs`; CI는 **합성 SDK**를 삽입하므로 실제 공급자에 로그인하지 않음 |

## 사용자·데이터 및 비용 안전장치

- 실 DB 공개 전, 법정대리인 관계와 동의가 **독립적으로 검증된 멤버십**만 보호자 접근 허용. OAuth/이메일 인증만으로 보호자 자격 승인하지 않음. 테스트 중 사용한 `externally_verified` 플래그는 **ROLLBACK 안의 합성값**일 뿐이며 실제 보호자 승인 기록이 아님.
- 로컬 UI는 **기존 계정 비밀번호 로그인만 허용**; 신규 회원가입·Google 버튼·비밀번호 복구 이메일은 별도 Provider/SMTP 준비까지 비활성화. 프런트에서 서버 `service_role`, OAuth Secret, SMTP Secret, DB 비밀번호를 절대 저장·전송하지 않음.
- **실제 학생 오답·사진 업로드 기능은 비활성화**, 아직 운영 사이트 공개·Netlify 프로덕션 변경 없음.
- Free 플랜 유지. 무료 구독의 향후 한도·중단에 대해서는 실제 사용량 모니터링과 운영 전 백업·복구 설계를 추가해야 함.
- Cloud Edge Functions는 배포만 확인했고, 공개 인터넷에서의 401 응답·로그인 JWT 종단간 동작 확인은 별도 남겨 둠.

## 남은 완료 조건

1. **Google Cloud OAuth**: 프로젝트 소유자 인증 하에 Google OAuth 웹 클라이언트 생성, Supabase `Authentication > Providers > Google`에 Client ID/Secret 저장 및 활성화. 콜백: `https://hnpbwxgpwpellgeusjim.supabase.co/auth/v1/callback`(Supabase 대시보드 표시 주소와 최종 대조). 시험용 성인 로그인 성공/로그아웃/재진입 실측 후 로컬 Google 버튼 활성화 및 PKCE redirect URL 검증.
2. **이메일/SMTP**: 사용자 본인 계정 소유로 Resend Free 등 SMTP 제공자 및 인증된 발신 도메인 마련(유료/도메인 구매 승인 없음), Supabase 이메일 발신·도메인/SPF/DKIM 구성, 성인 시험 주소로 가입·확인·재설정·비밀번호 로그인/메일 수신 검증. 조직 멤버만 되는 기본 테스트 SMTP는 일반 사용자의 메일 발송 성공으로 간주하지 않음.
3. **실서비스 Auth+가족 간 분리**: 실제 Supabase Auth가 발급한 JWT **성인 시험 계정 2개**로 API/RPC/사진 Storage REST 접근·권한 회수·CAS/복구를 실측; 현재의 DB GUC 합성 테스트는 이를 대신하지 않음.
4. **아동 개인정보/운영 승인**: 독립 법정대리인 관계 확인·동의와 철회, 탈퇴/삭제/위탁·국외이전/보관기간, 사진·DB 일관 복구, 실 Android/iOS 물리 기기 시험 및 운영 검수.

**결론:** 실제 Supabase 쪽 RLS, 읽기전용 보호자 RPC, JWT 게이트 Edge 배포 및 로컬 실제 SDK 호출 코드까지는 진전. 그러나 실제 Google/이메일 사용자 로그인과 SMTP·사진 REST 통합검증을 수행하지 않은 이상 '로그인 완료/출시 승인'으로 표시하지 않음. G15 OPEN, G16 OPEN, 제품 운영 최종 승인 0/16 유지.
