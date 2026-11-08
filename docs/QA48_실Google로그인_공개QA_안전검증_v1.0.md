# QA48 — 실제 Google OAuth 로그인 시험 페이지 및 인계 v1.0

**작성:** 2026-11-09 · **실운영 아님** · 구분: 본인 성인 테스트만 / 운영 승인 0.

## 구현 결과 및 접속 경로

- 독립된 공개 QA GitHub Pages 전용 시험 URL: **https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html**
- 본 페이지는 기존 `index.html` / Netlify 운영 앱과 분리된 독립 HTML입니다. 실제 자녀 이름·사진·오답 자료 입력 UI가 없으며 이메일·Google 계정 정보·JWT 등을 화면/서버 로그에 표시하지 않습니다.
- `oauth-test.html` + `scripts/qa48-google-oauth-test.mjs`: 실제 **Supabase JavaScript SDK → Google OAuth (PKCE) → 로그인 완료 콜백 → auth.getUser() 서버 검증 → public.qa47_my_verified_family_ids() RLS 검증 → qa47-auth-status Edge Function JWT 확인 → 로그아웃** 구성.
- 공개 Supabase `sb_publishable_` 키만 사용. Client Secret·SMTP/DB 비밀번호·service_role 키를 HTML/JS/GitHub에 보관하지 않습니다.
- 세션은 **브라우저 탭의 sessionStorage**에만 유지하도록 설정. 인증 코드/오류 파라미터는 브라우저에서 교환 작업 후 주소표시줄에서 지웁니다. 화면의 **로그아웃** 버튼은 Supabase 세션을 종료합니다. 자동 갱신은 비활성화입니다.
- 테스트 주소 외에는 Google 시험 버튼 작동 안 함. 외부/임의 Origin 접근은 Edge가 차단, QA Pages의 정확한 Origin에 대해서만 JWT 확인을 요구. 원점 제한은 인증 대체가 아니며, JWT·RLS 검증을 별도로 수행합니다.
- Supabase 보호자 관계에 `externally_verified`+실제 검증 및 동의가 없다면 **가족정보 0건**. 계정 로그인만으로 가족 접근 열지 않음.

## 운영 계정에서 반드시 필요한 URL 허용 목록

Supabase 프로젝트: `uri-wrong-answer-qa` (`hnpbwxgpwpellgeusjim`), Free 플랜, 서울.

**Supabase > Authentication > URL Configuration > Redirect URLs > Add URL** 에 정확히 아래 주소를 **한 개 추가**해야 실제 Google 인증 뒤 시험 페이지로 돌아옵니다.

`https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html`

기존 Site URL `http://127.0.0.1:4173/`와 기존 Redirect URL `http://127.0.0.1:4173/?qa47=1`는 유지해도 됩니다. *Google Cloud*의 승인된 리디렉션 URI `https://hnpbwxgpwpellgeusjim.supabase.co/auth/v1/callback`은 **변경하지 않습니다**. 서로 다른 역할입니다. 클라이언트 ID/비밀키는 이미 Supabase Google 제공자에 저장된 사용자 설정을 그대로 사용합니다.

**주의:** ChatGPT에서 Supabase의 Google 제공자 설정·URL 리디렉션 허용 목록을 수정하는 관리 도구는 현재 제공되지 않습니다. 본인 Supabase 계정에서 위 URL만 추가하면 됩니다. Client Secret을 공유하거나 추가 생성할 필요 없음.

Google Cloud의 대상(Audience)은 **테스트 중**, 허용된 본인 계정만 로그인 가능하므로 운영 공개가 아닙니다. 해당 계정 외 다른 사용자 시험 금지.

## 검증 방법과 완료 기준

- [x] Google OAuth 시험 웹페이지 / 실제 Supabase JS SDK 호출 코드 구성
- [x] QA47 읽기 전용 JWT 인증 Edge에서 GitHub Pages 시험 Origin 추가, 401·403·쓰기 차단 규칙 유지
- [ ] 신규 QA48 Playwright **320/390px**, OAuth PKCE·콜백·세션·로그아웃·잘못된 Edge 결과 시 fail-closed 검사 (GitHub Actions 결과 확인 후 변경)
- [ ] GitHub Actions 병합 후 Pages 주소 실제 배포 확인
- [ ] 실제 Supabase Redirect URL 허용 목록에 Pages 콜백 등록 (계정 소유자가 수행)
- [ ] 등록된 **성인 Google 테스트 사용자**가 페이지에서 로그인 → Google 동의 → 복귀 → '로그인 확인 성공' 문구 확인
- [ ] 로그인/로그아웃과 실제 발급 JWT에 의한 Edge·가족 RLS 종단간 결과 확인
- [ ] 모바일 물리 Android/iOS 실제 기기 확인은 별도

**선택된 운영상 안전 경계:** 아동 개인정보 처리, 구글 로그인 결과를 실제 학생 데이터에 연결, 가족별 쓰기/업로드, 실제 사진 파일 및 복구는 **모두 비활성화**. 이 구현은 로컬 테스트 화면을 실제 Google OAuth에 연결하는 **성인 시험 페이지**이며 서비스 전체 G15 승인과 다름.

사용자 행동 최소화: **리디렉션 URL 한 번 추가 → 위 테스트 링크에서 Google 로그인 버튼 한 번 → 결과 안내**. 그 외 코드·CI·배포는 담당자가 수행.
