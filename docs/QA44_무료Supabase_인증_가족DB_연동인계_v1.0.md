# QA44 · 무료 Supabase 우선 연동 개발 인계 v1.0

**기준일: 2026-11-08 / 실계정·실운영 연결 없음 / 실제 아동자료 0건**  
**기술 결정:** Supabase Free + Google OAuth/이메일·비밀번호 + Resend Free SMTP 우선. 운영에 유효한 실제 공급자/Google OAuth 등록·메일 발신 도메인·법정대리인 동의는 미완료.

## 1. 실제 개발 내용 및 보안 경계

| 컴포넌트 | 제공 내용 | 검증/한계 |
|---|---|---|
| `scripts/qa44-supabase-auth-adapter.mjs` | Supabase SDK의 Google OAuth, 이메일 회원가입·로그인, 확인 메일, 비밀번호 재설정·변경, 로그아웃, getUser 인증 및 별도 보호자 권한 조회 | 공식 SDK 호출 형태만 합성 mock 검증. 실제 Google·Supabase 계정 접속 미실시 |
| `scripts/qa44-supabase-auth-lab.mjs` | 실제 오답노트 설정 화면에 로컬 전용 구글/이메일 가상 로그인 UI | 정확히 127.0.0.1:4173, 외부 공급자 없음, 320/390px 브라우저 테스트 |
| `db/qa44_supabase_staging_rls.sql` | `auth.uid()` 이용 가족·보호자·DB 스냅샷·비공개 사진 RLS. 법정대리인 검증·동의가 모두 확인되지 않으면 접근 불가 | 실제 PostgreSQL16 + auth/storage 모의 스키마 검증, 실제 Supabase 환경 미적용 |
| `scripts/qa44-supabase-family-store.mjs` | 서버 측 `auth.getUser(accessToken)` 검증 후, 별도 제한 DB 역할의 가족별 전체 백업·사진 저장, SHA-256·CAS·손실 차단 | Supabase getUser는 합성 mock. 실 DB Postgres 접근 제어·충돌 동작은 실제 PostgreSQL에서 검사 |
| `scripts/qa44-free-budget.mjs` | 무료 저장량·전송량·메일 예산, 80% 경고/용량 초과 제안 차단, SMTP 비밀관리 참조 예시 | 실제 공급자 사용량 측정 API·자동 결제 차단 설정은 계정 미개설로 미검증 |

**중요:** 현재 앱의 QA44 로그인 실험실은 **합성 공급자에서만 작동**하며, 인증 후에도 실아동 자료를 서버로 전송하지 않는다. 실계정 Supabase 앱 설정·메일 전달·사진 버킷 운영을 검증 완료로 표시하면 안 된다.

## 2. 무과금 아키텍처 선택과 보수적 기준

- **Supabase Free** 공식 요금 문서: DB 500MB, 파일 저장소 1GB, 월 활성 사용자 50,000명, 비캐시 송신 5GB, 2개 무료 프로젝트. 무료 프로젝트는 활동이 적으면 약 1주 후 일시정지될 수 있음. 무료 플랜의 운영 백업/PITR·SLA는 보장할 수 없음.
- **Resend Free** 공식 가격표: 월 3,000통, 하루 100통, $0/월. 별도 발신 도메인 인증·SMTP 비밀번호 필요. 도메인 소유에 비용이 들면 **무단 구매 금지**; 다른 무료 방식 재검토.
- Supabase 기본 메일: 공식 안내상 기본 SMTP 2통/시간·팀 소속 등록 주소만 전송 가능. 일반 사용자 이메일 회원가입·복구에는 운영용 SMTP 연동 필요.
- `qa44-free-budget`은 무료 한도의 *예상 초과*를 미리 거부하는 설계 검증이다. 공급자 과금 정책·계정 요금제 잠금·실제 사용량 데이터에 접근한 증거는 아직 없음. **실제 서비스에서 영구 무료를 보장하지 않음**.
- 사진 1장 최대 1MiB, PNG/JPEG/WebP로 제한하고 버킷 공개 금지. EXIF, 사진 내용 개인정보, OCR 외부 전송은 실제 도입 전에 별도 검증.

공식 참고: https://supabase.com/pricing , https://supabase.com/docs/guides/platform/billing-on-supabase , https://supabase.com/docs/guides/auth/auth-smtp , https://supabase.com/docs/guides/storage/security/access-control , https://resend.com/pricing

## 3. 실제 공급자 연결 시의 순서 (현재 미실시)

1. **소유자 개인 계정·약관/지역 확인:** 운영자 명의 Supabase Free 프로젝트, Google Cloud OAuth 프로젝트, Resend Free 계정의 실제 소유권·요금제·정보 처리 계약 확인. 어떤 계정도 임의 생성하지 않음.
2. **공식 인증 설정:** Google OAuth redirect URL, 이메일 주소 인증, 안전한 PKCE/세션 처리, 비밀번호 재설정, 비정상 요청 제한, 테스트용 이메일과 실서비스 구분. Google OAuth는 Supabase 로그인 경로에 연결. OAuth 클라이언트 비밀정보는 브라우저/저장소에 공개 금지.
3. **운영 DB 역할/정책:** `qa44` 전용 스키마의 RLS와 PostgREST API 노출 설정·GRANT·기존 Storage 정책 충돌/우회·감사로그 별도 테스트. 서버 전용 `qa44_sync_writer` 역할은 브라우저에 공개 금지. 공개 회원가입으로 보호자 DB 관계가 자동 승인되면 안 됨.
4. **사진:** 비공개 Storage bucket 파일 크기/용량 제한과 경로 접근정책을 *실제 Supabase에서* 검증. CDN·공유링크·장기 signed URL·Storage UPDATE/DELETE 경로 확인.
5. **서버 통합:** 앱 기존 백업 검사, 보존/삭제·동의 철회 절차, 사진+DB 복구 원자성, 서버 재시작, 네트워크 단절, 동시 업로드, 장애 알림. 현재 무료 플랜 운영 PITR 검증을 완료했다고 주장하지 않음.
6. **실기기·법률 검토·운영 공개:** 실제 Android/iOS, 해외 저장/위탁 검토, 법정대리인 확인·동의·열람/삭제 절차, 약관/개인정보처리방침 최종 승인 뒤에만 실제 아동 자료 수집.

## 4. 해제되지 않은 승인 게이트

실제 Google·이메일 인증 공급자 연결, 법정대리인 관계·동의 검증 절차, 무료 계정 및 발신 도메인, 개인정보 보존·국외이전·위탁, 실물 기기 2대, 사용자의 운영 공개 승인, G16 연구윤리·실증은 **모두 미완료**. G15·G16 OPEN, 기존 QA 목표 14/16=87.5%, 실제 제품 최종 승인 0/16 유지.

## 5. 소스와 시험 조건

- 테스트 데이터는 모두 가상이며 GitHub Actions 임시 PostgreSQL16의 실제 RLS·SQL 트랜잭션을 사용한다.
- `tests/qa44-supabase-auth.mjs`: 공급자 mock + 강제 보호자 동의 거부
- `tests/qa44-supabase-postgres-rls.mjs`: 실제 PostgreSQL + 모의 Supabase auth/storage 스키마
- `tests/qa44-supabase-family-store.mjs`: 제한 DB 역할 + mock getUser + CAS·사진 원본
- `tests/qa44-free-budget.mjs`: 무료 쿼터·메일 예산
- `tests/qa44-mobile-auth-ui.mjs`: 실제 앱 320/390px Chromium SDK mock UX

본 결과가 실제 Supabase에서 테스트한 인증, 운영 보안 인증, 클라우드 사용량 측정 또는 법적 적법성 보증으로 해석되지 않게 유의한다.
