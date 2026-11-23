# 02 로그아웃 후 구 JWT 직접 RPC 재사용 — P0 격리 설계 (2026-11-24)
상태: DESIGN ONLY / NO PRODUCT CHANGE / AUTH-VIS-ACK BLOCK / safeToRestore:false

## 새 증거와 결론
08 #82 댓글 7115682054: Jin 외부자문 브라우저에서 signOut 이후 만료 전 기존 JWT로 qa47_my_verified_family_ids RPC 200, 가족 UUID 1건. 08 직접 재생 N/T. 이는 Supabase JWT의 기본 만료 전 유효 동작과 일치하며 취약점 단정 금지. 다만 제품의 '로그아웃 즉시 서버 권한 차단' 요구가 확정된다면 P0 차단 요건.

## 선택지 비교
A. UI token 제거/짧은 exp: UX 보조이나 구 JWT 직접 RPC 재생을 막지 못함 — 단독 불가.
B. Edge에서만 auth.getUser/session 검사: Edge는 보호하지만 기존 SECURITY INVOKER RPC/RLS 직접 접근이 남음 — 단독 불가.
C. 서버측 활성 session_id 검증을 RPC 및 모든 아동 데이터 RLS 경로에 적용: 직접 RPC 우회도 차단 가능. auth.sessions 접근 권한, SECURITY DEFINER 사용 시 search_path/권한, RLS 재귀·성능, session_id 존재/삭제 시점 검증 필요.
D. 아동 데이터 직접 테이블/RPC 접근을 차단하고 단일 Edge 인가 경로로 통합: 정책 경계 명확하나 API 변경 범위와 마이그레이션 리스크 큼.
권고: 00/Jin 요구사항 확정 후 C/D를 격리 설계·최소 권한으로 비교, 운영 적용은 별도 승인.

## 격리 RED→GREEN 필수 매트릭스
1. 보호자 신규 로그인: 가족1, 비보호자 가족0, 익명 거부.
2. 보호자 signOut 직전 구 JWT 보관(로그에 토큰 기록 금지) → signOut 확인 → 동일 JWT로 RPC/Edge/직접 SELECT 및 사진·ACK 등 모든 접근이 가족0 또는 401/403, 데이터 반환0.
3. 새 세션 재로그인: 가족1 정상 복귀. 구 JWT는 계속 차단.
4. 만료·위조·철회·타가족 접근 거부; 공급자 장애503과 인증 실패401/403 구분.
5. 320/390 Chromium Back/cache/새로고침에서 이전 가족정보·승인 표시 비노출.
6. 원장 snapshot·사진·오답·메모 불변, 민감 로그0, 정확 역패치 증거.
7. 06/08 독립 판정 전 AUTH/VIS/ACK 차단 유지.

## 금지/미검증
실 DB/Auth/Edge/RPC/RLS 수정, 세션 강제철회, 배포, PR 병합, 실제 아동 데이터 시험 금지. 현 시점 테스트 코드/Chromium/원시 네트워크 및 06/08 독립 검증 N/T. 이 문서는 P0 설계 후보이지 PASS가 아니다.
