# QA49 · Google 로그인 시험 페이지 최초 진입 오류 수정 / 실제 SDK 로딩 검증

**작업일:** 2026-11-09 · **개발자 진단·수정 / 실제 계정 로그인 미완료**

## 사용자가 보여준 실제 화면

- 사용자 Supabase **Authentication → URL Configuration** 스크린샷에서 두 리디렉션 주소 등록 확인:
  - `http://127.0.0.1:4173/?qa47=1`
  - `https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html`
- Site URL: `http://127.0.0.1:4173/` 유지.
- 사용자 실제 QA 사이트 `oauth-test.html` 최초 방문 화면에 로그인 버튼은 켜져 있으나 아래에 빨간 **“연결 확인에 실패했습니다. Google 테스트 사용자·Supabase Redirect URL·설정을 확인해 주세요”** 메시지 표시. Google 계정선택 창·실제 로그인 결과는 보이지 않음.
- **확정된 원인:** 기존 `scripts/qa48-google-oauth-test.mjs`가 신규 방문자에게 **로그인 요청 전에도** `safely(verify)`를 자동 수행하여, 외부 SDK 로딩 실패·브라우저 환경 제약 등이 있어도 Google 인증·Supabase Redirect 설정 오류로 뭉뚱그려 잘못 안내하는 구조였음. 어떤 내부 예외였는지 실제 브라우저 콘솔 기록은 없어 미확정.

## 수정

- 신규 방문 및 세션이 없는 경우 **실제 SDK import/로그인 API를 호출하지 않고**, 초록/중립 상태 **“준비됐습니다. 파란색 Google 로그인 버튼…”** 안내로 시작.
- OAuth 리디렉션 코드가 있거나 해당 브라우저 탭에 이미 세션이 저장된 경우에는 기존 검증 유지.
- 로그인 도구 다운로드 실패, 세션 교환 실패, 서버 사용자 검증·가족 RPC·Edge 실패, Google 로그인 시작 실패를 **서로 다른 비밀정보 없는 한국어 오류**로 표기. 알 수 없는 내부 오류는 임의 원인 단정 없이 안내.
- 기존 OAuth PKCE, 서버 getUser → 가족 RLS → JWT Edge → 로그아웃 흐름, 보호자 검증 없을 때 학생 데이터·사진·쓰기 기본 차단 유지.
- 신규 CI: 빈 세션에서는 **SDK조차 호출하지 않는** 브라우저 320/390px 회귀검사 및 이전 OAuth 콜백·로그아웃·Edge 실패 복원. 별도로 실제 공용 CDN의 Supabase JavaScript SDK를 브라우저에서 불러온 뒤, 실제 Google로 이동하기 전 Supabase의 authorize 요청만 Playwright로 가로채 생성된 provider=google 및 redirect URL을 검증. **실 사용자 Google 로그인, 실제 JWT 로그인 성공은 이 시험이 증명하지 않음**.

## 운영·사용자 행동

- **Supabase 두 주소가 이미 정확하므로 추가 URL/Google Cloud 비밀키 변경 불필요.**
- GitHub Pages 배포·CI 정상확인 후 사용자에게 기존 `https://jinbh99-arch.github.io/uri-wrong-answer-qa/oauth-test.html` 새로고침 → 파란 Google 로그인 시험 버튼 클릭만 요청.
- 시험 대상은 Google Cloud에 등록된 **성인 본인 Google 계정** 한 명. 비밀번호·OTP·OAuth Client Secret 채팅 전송 금지.
- 구글 로그인 성공·실 JWT 가족차단·사진 REST 업로드·실아동 동의·G15/G16 운영 승인 **미검증**, 유료·기존 운영 Netlify 변경 없음.
