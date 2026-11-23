# 02 WRONG 실서버 보호자/가족 인가 — A격리 연결·프로비저닝 계약 (2026-11-24)

작업 ID: `00Q-02-AUTH` · 기준: 00 #82 댓글 7105662414 · 범위: **읽기 전용 실물 검증 및 시험 계약**. 이 문서는 실인가 성공 또는 B 승인 증거가 아니다.

## 직접 확인한 원격 실물 (2026-11-24)
- Supabase 프로젝트 `hnpbwxgpwpellgeusjim`의 Edge `qa47-auth-status` v4 ACTIVE. `verify_jwt=false`이므로 Edge 내부에서 `auth.getUser(token)` 검증이 필수이며, 실제 `index.ts`는 Supabase anon key로 사용자 JWT를 전달해 `auth.getUser(token)` 호출 후 동일 클라이언트로 `qa47_my_verified_family_ids` RPC 호출.
- `handler.js`: 정확한 Origin `http://127.0.0.1:4173` 또는 `https://jinbh99-arch.github.io`만 허용; GET/OPTIONS 이외 405, Bearer 부재 401, 공급자 오류 503, 모두 `cache-control:no-store`. GET 200 응답은 `authenticated`, `guardianVerificationRequired`, `verifiedFamilyCount` 및 기능 비활성 플래그만 포함; 가족 UUID·아동 데이터 미반환.
- 실 DB `qa44.guardian_memberships` 7필드: `family_id uuid NOT NULL`, `guardian_user_id uuid NOT NULL`, `role text NOT NULL`, `verification_source text NOT NULL`, `verified_at timestamptz NULL`, `consent_verified_at timestamptz NULL`, `revoked_at timestamptz NULL`.
- 실 RPC는 SECURITY INVOKER(`prosecdef=false`), `auth.uid()`와 guardian 역할·externally_verified·검증시각/동의시각 NOT NULL·미철회 조건으로 family_id만 반환. 이는 **조회 필터**이지 외부검증·동의의 진정성을 자체 증명하는 절차가 아니다.
- 앞선 00 읽기전용 계수: auth.users=3, families/memberships/snapshots=0, verifiedFamilyCount=0. **가족 0은 정상 로그인과 별개이며 가족 1 허용 증거가 아니다.**

## 연결 상태 및 보안 경계
| 구간 | 실물 확인 | 아직 검증되지 않은 것 |
|---|---|---|
| 브라우저 로그인 → Supabase Auth | 기존 QA47 브라우저 정상경로에 대한 Jin 보고 #7065719675 | 본 회차 신규 실 로그인/실 JWT 세션 |
| Edge → getUser → RPC | 배포 소스와 RPC 실 정의 읽기 확인 | 실 JWT로 가족 1/타가족/철회 E2E |
| membership → 보호자 상태 | 7필드와 필터 계약 확인 | 검증 운영자·동의증거·서버 원자적 쓰기 절차 |
| 아동 승인 목록/ACK | 기존 A격리 fail-closed 기술한정 수용 | 원격 승인원장/실가족 A/B/실 ACK/제품 연동 |

## 신뢰된 프로비저닝 계약 (설계; 아직 실행 금지)
1. 신뢰된 운영자만 시험용 성인 UID 및 별도 **비실제** 가족 A/B를 식별. 인증 이메일 소유만으로 보호자 관계를 추정하지 않는다.
2. 검증 담당자·증빙 참조번호·검증시각·동의 주체/범위/시각·철회 책임자와 보존/삭제기한을 시험 기록으로 승인 후 남긴다. `externally_verified`는 실제 외부 확인 증빙이 있을 때만 설정. 이 7필드 테이블만으로 증빙 원문 저장을 대체했다고 주장하지 않는다.
3. 권한 있는 서버 트랜잭션으로 family 생성 → UID 연결 → 검증/동의 승인 상태를 일관되게 기록. 브라우저에서 familyId/role/verification_source/consent 필드 쓰기 금지. 기존 실 RLS/GRANT 및 삽입 주체 권한·원자성은 B 전에 별도 검증.
4. 철회는 서버에서 `revoked_at` 갱신 후 즉시 RPC 결과 0, 보호자 화면 캐시 무효화·no-store. 기록 원복은 시험용 row ID·선행 스냅샷·트랜잭션/철회·접근회수 증거를 확보한 뒤 승인된 범위에서만 수행.
5. 본 A격리에서는 **실 DB INSERT/UPDATE/DELETE, 계정 생성·로그인, Edge 배포, 인증/가족 데이터 변조, 실제 아동 데이터 접근 모두 0**.

## B 진입 전 필수 게이트
- Jin의 명시적 B 승인 및 08 사전 보안 판정; 분리된 시험환경·시험 계정/비실제 가족 A/B·원장 쓰기 권한·증빙 책임자 확인.
- JWT 공급자/만료·`getUser`·RLS/GRANT·CORS/CSRF·로그/세션·원복계획의 독립 점검.
- 실행 시 401(무토큰/만료/위조/아동), 403(타가족/철회), 가족 0·1·N, consent 철회, 새 로그인/뒤로가기/캐시, 원장 불변·개인정보 로그0을 실 HTTP+320/390px와 비식별 artifact로 입증.
- 06·08 독립판정 전 `LIVE_FAMILY_E2E_NT`; `AUTH/VIS/ACK BLOCK`, `safeToRestore:false`, PR#80 Draft, dev/main/배포/예약 불변.

## 다음 A격리 단일 구현
현재 QA 화면의 로그인 성공/실 RPC/Edge 호출 상태를 **read-only** UI 상태로 연결하고, 401/403/503/가족0/철회는 아동 목록·저장·동기화 모두 fail-closed. 실제 보호자 소유가 확인되기 전 가족 ID나 로컬 IndexedDB ACK로 권한을 승격하지 않는다. 320/390 격리 브라우저 원시·원본 역패치와 08/06 인계를 별도로 제출.
