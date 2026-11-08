# QA46 · 실제 Supabase 무료 프로젝트 생성 및 가족·사진 RLS 적용 검증 v1.0

**작업일:** 2026-11-08  
**상태:** 실 Supabase 무료 프로젝트 생성·DB 스키마·사진 버킷 RLS 적용 및 제한적 권한 점검 완료 / 로그인 공급자·운영 데이터·법적 동의·실기기 미완료.

## 1. 프로젝트 생성 증빙

- 사용자: `무료 프로젝트 생성 동의` 명시 승인 후 실행.
- 조직: `uri-level-test` / Supabase Free(`tier_free`).
- 월 견적: `get_cost(type=project)` = **$0/month**. 사용자가 무료 프로젝트 생성 동의 → 비용 확인 ID → 생성.
- 프로젝트 이름 `uri-wrong-answer-qa`; 프로젝트 ref `hnpbwxgpwpellgeusjim`; **서울 `ap-northeast-2`**; 상태 `ACTIVE_HEALTHY` (직접 `get_project` 조회).
- 인스턴스: PostgreSQL **17.11**. 기존 GitHub QA는 PostgreSQL16 합성 검증이었으므로 실제 버전이 다르다는 점 기록.
- 프로젝트 API 주소: `https://hnpbwxgpwpellgeusjim.supabase.co` (공개 주소; 실제 계정 비밀키는 별도 저장·미공개).
- 요금제 업그레이드·결제 정보 등록·유료 분기 생성 **미수행**.

## 2. 실제 Supabase 마이그레이션

- GitHub 원본: `db/qa44_supabase_staging_rls.sql`; 버전 `20261108133338` / `qa44_initial_family_guardian_and_private_photos`.
- **Supabase `apply_migration`에서 `success: true` 확인.** 앞·뒤 트랜잭션 구분자와 파일의 '미적용' 주석만 제외한 동일 실질 SQL.
- 실제 생성된 스키마: `qa44.families`, `qa44.guardian_memberships`, `qa44.family_snapshots`.
- 세 테이블 모두 RLS **ENABLED + FORCE**. 5개의 가족/권한 관련 정책 확인.
- 인증된 사용자에게는 자신의 외부 검증 보호자 관계·동의 확인 후에만 가족 기록 SELECT 허용. 브라우저 직접 가족 생성/승인·snapshot UPDATE/DELETE 불가.
- 별도 `qa44_sync_writer`은 NOLOGIN이고 일반 클라이언트 역할에 부여하지 않음. 자체 서버 백엔드가 실제 검증 토큰과 DB의 허용 조건을 이용해야 함.
- 사진: Storage 비공개 `qa44-family-photos` 버킷 하나 생성, 최대 1,048,576 byte, PNG/JPEG/WebP, 가족별 경로 INSERT/SELECT RLS 정책 2개. 실제 사진 파일은 **0개**.

## 3. 직접 SQL 점검 결과

- 실제 생성/조회 수: `auth.users=0`, `qa44.families=0`, `qa44.guardian_memberships=0`, `qa44.family_snapshots=0`, `storage.objects=0`.
- 로그인 미확인 역할 `authenticated`의 실제 트랜잭션 질의: 보호자 0건, 기록 0건, 사진 0건, `auth.uid()=null`. (실 로그인 JWT 검사는 아직 미실시.)
- `anon`: `qa44` 스키마 접근 **false**.
- `authenticated`: 보호자 관계 INSERT/UPDATE **false**, snapshot UPDATE/DELETE **false**; 읽기권한은 있으나 RLS가 적용됨.
- `qa44_sync_writer`: 저장 컬럼별 UPDATE 권한은 **true**, 공개역할에 권한 부여 0건.
- 권한 세 테이블의 `FORCE ROW LEVEL SECURITY=true`; 사진 버킷 `public=false`, 최대 1MB.
- 보안 Advisor: `qa44.families`에 RLS는 있지만 정책이 없다는 **INFO 알림 1건**. 이 테이블을 클라이언트에서 조회·수정하지 못하도록 *의도적으로 기본 접근 거부*한 설계. 외부 공개 시 다시 검토.
- 유의: RLS 구조/GRANT/테이블 비공개는 실제 점검했으나 **서로 다른 실제 합성 Supabase Auth 계정 2명으로 JWT 로그인/교차 접근·업로드 테스트는 아직 미실시**.

## 4. 잔여 사항 및 별도 승인·접근 요건

| 대상 | 현재 실제 상태 | 무엇이 필요한가 |
|---|---|---|
| Google OAuth | 실제 제공자 등록/로그인 미설정 | Google Cloud 콘솔의 OAuth 등록과 비밀정보 안전 보관·동의 화면/콜백 확인 |
| 이메일 가입·재설정 | 실제 발송 미설정 | Supabase 이메일 설정, Resend 무료 계정·검증된 발신도메인·안전한 SMTP 설정 |
| 운영용 앱 연결 | 실 클라우드용 API/실사용자 연결 미배포 | 프런트/서버 접근, 세션/토큰 교환, 서버 전용 DB Writer 인수, 공개 전 보안검증 |
| 부모 관계·동의 | 법정대리인 0명, 동의 0건 | 실제 관계 확인·증빙, 동의·철회·삭제, 운영자 법적 책임 검토 |
| 실서버 통합 QA | 기본 SQL/스토리지 비공개·미승인 역할 차단 확인 | 서로 다른 합성 계정 JWT·사진/복구/스토리지 동작·선택한 데이터 지역·비용 확인 |
| 실제 기기·G16 | Android/iOS 물리 기기 0대·연구 참여자 0명 | 별도 기기와 실제 윤리·법적 검토 |

**무료 서비스 제약:** 무료 플랜 자체에는 운영 등급 PITR/일관된 사진 복원이 보장되지 않으므로, 실사용 아동 정보 저장 전에 백업·복구·탈퇴·유출 대응을 실증해야 함. 월 견적 $0는 영구 무과금 보장이 아님.

## 5. 기록 일관성

- 이전 [QA45 문서](QA45_실프로젝트_미생성_무료운영_실행계획_v1.0.md)의 ‘프로젝트 0개’는 **2026-11-08 프로젝트 생성 전 시점의 관측값**으로 보존한다. 현재 상태를 나타내는 기록으로 사용하지 않는다.
- 기존 QA44 임시 PostgreSQL16 합성 검사와 이번 실 PostgreSQL17 마이그레이션을 명확히 구분한다.
- 기존 기술 QA 목표 14/16(87.5%) 및 운영·실서비스 최종 승인 0/16 유지. G15 실제 인증·합법적 보호자 확인·앱 연결·전반적 보안 인수 미완료. G16 연구 미완료.
