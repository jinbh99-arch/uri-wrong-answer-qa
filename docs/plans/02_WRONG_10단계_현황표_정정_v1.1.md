# 02 WRONG — 10단계 기준 분리·진행현황 정정 v1.1

- 기준일: 2026-11-21 KST. 사용자 '지난번 10단계와 다른 것 같다' 이의에 따른 **보고 분류 정정**. 기존 10개 제목·순서 변경 **0**.
- 입력/고정: 사용자 성과물 10개 [원문보존 v1.0](02_WRONG_사용자성과물10개_원문보존_v1.0.md), 개발완성 10단계 [부분복원 v1.0](02_WRONG_개발완성10단계_부분복원_v1.0.md), QA79 [별도 10단계](../wrong-qa79-single-record-ten-steps-v1.md).
- 최신 근거: [#82 현행 0-6](https://github.com/jinbh99-arch/uri-homework-manager/issues/82), [#86 과거 0-6의 1·2](https://github.com/jinbh99-arch/uri-homework-manager/issues/86), [#82 #7062126485 개발단계 인수](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7062126485), [06 VIS #7063238763](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063238763), [06 OCR #7063285718](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063285718), [08 AUTH #7063201193](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063201193), [00 한정판정 #7063355475](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063355475), [00 신규 읽기전용 dev 간극지시 #7063369574](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063369574).
- **절대 혼동 금지:** 사용자 성과물 `1~10` ≠ 개발완성 `1~10` ≠ QA79 합성 단일 오답 10단계. **'1/10 완료'는 직전 개발완성 분류에 관한 서술일 뿐 원래 사용자 성과물 10개에 적용한 계산이 아니었다.** 이 구별 없이 보고한 것이 이번 수정 사유.

## A. 사용자 성과물 10개: 원문 번호를 유지한 현황

| 번호 | 원문 목표의 간략 참조(제목 원문은 v1.0) | 이번 기준 판정 | 지원 근거 / 실제 미검증 |
|---:|---|---|---|
| 1 | 미저장 입력 이탈·복귀 | **국소 로컬 PASS** | #82 완료 목록에 미저장 메모 로컬 PASS 이관. 실제 다양한 강제종료/실기기/가족 교대 N/T |
| 2 | 두 번째 이상 재풀이·아이 DOM 비잔존 | **국소 로컬 PASS** | #82 완료 목록에 2회 재풀이 아이 DOM 로컬 PASS 이관. 실 가족·모든 화면 API 전수 N/T |
| 3 | OCR·사진 초안이 아이 모드에 남지 않음 | **국소 합성 PASS / 실 OCR N/T** | QA78/84, 신규 06 #7063285718 320/390 순차 지연 OCR·아이잔여0. 실제 OCR/동시 worker·실폰 N/T |
| 4 | 가족별 인증으로 타가족 데이터 접근 차단 | **BLOCK** | 08 #7063201193 A~F 설계 정적 수락, signed JWT·guardian·RLS·사진/실세션 미검증. 실제 같은 프로필 IndexedDB 노출 |
| 5 | 사진 선택·전환·원장/바이트 보존 | **국소 합성 PASS / 실사진 N/T** | QA85 및 신규 OCR 사진/IDB 원장 보존. 물리 카메라/실기기/서버 사진 경계 N/T |
| 6 | 누적 재풀이·관찰/재확인 이력 구별 | **국소 로컬 PASS** | QA83 기존 분류·누적 이력. 실가족 UI 통합 및 전체 UX 독립 검증 N/T |
| 7 | 인증·암호화 백업의 원자적 복원 | **진행 중·운영 차단** | QA89 합성/일부 원자성 증거, PR80 Draft. 실암호화·인가·WebKit Blob/안전복원 미검증, `safeToRestore:false` |
| 8 | 인증 후 가족 사진·오답 완전 삭제 | **BLOCK** | 실제 가족 인가·보존삭제 정책·타가족 403/삭제 검증 없음 |
| 9 | 200%·키보드 주요 동선 | **국소 로컬 PASS / 신규 VIS-FIX FAIL** | QA86/92 기존 화면 조작 부분 PASS. 신규 06 #7063238763 CDP false/true만 제한PASS, **Playwright 즉시 PNG2 단색 원인·실폰/Safari N/T** |
| 10 | 보호된 비운영 URL로 자기 가족 기록 확인 | **미착수·보안 승인 대기** | Supabase QA 연구/설계는 이 제품의 보호된 비운영 URL 실사용 증거 아님. Jin B단계 별도 승인 없음 |

**정확한 수량:** '국소 합성/로컬 PASS 증거가 있는 성과물'은 1·2·3·5·6·9 **6개**, 인증·운영 범위 BLOCK 4·8 **2개**, 복원 7 **진행 1개**, 보호된 URL 10 **미착수 1개**. **이것은 6/10 실제 제품 완성 또는 60% 개발 완료가 절대 아님.** 완전한 실가족/모바일/운영 수용 단계 0개. 원문 기준 3~10은 여전히 #82 진행 목록이며, 1·2는 로컬 완료 목록 이동과 제품 최종 승인 여부를 분리한다.

## B. '개발완성 10단계' 별도 현황 — 지난 답변의 대상

| 개발단계 | 복원 구분 | 판정 |
|---:|---|---|
| 1 | 기준선·증거 확정 | **기준선 완료** |
| 2 | 데이터/상태전이 계약 | **진행 중**: 현재 dev vs 부모 수동수정·ACK_UNKNOWN·아이 DTO·재풀이·Storage/동일 프로필 갭 분석 읽기전용 신규 지시 [#7063369574](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063369574) |
| 3 | 원장·기록 무결성 | **합성 국소 제한 검증**, 제품 실보안 N/T |
| 4 | 실가족 인증 | **AUTH-GATE BLOCK**, A~F 정적설계만 수락 |
| 5 | OCR/W03 부모 교정 | **합성 국소 제한 수락**, 실제 OCR·UI 가림 N/T |
| 6 | ACK 유실·중복복구 | **합성 국소 제한 검증**, 제품 통합·실 인가 N/T |
| 7 | WR01~04 제품 통합 | **HOLD** |
| 8 | 아이/부모 재풀이·관찰 통합 | **HOLD** |
| 9 | 모바일·보안 독립검증 | **HOLD / VIS-FIX FAIL**, 새 성공 CI만으로 해제 불가 |
| 10 | 출고·운영 승인 | **HOLD**, PR80 Draft·실데이터/운영/배포 금지 |

**지난 보고의 '완료 1/10'은 이 B표의 '기준선'만 완료로 센 값**이다. A표(원안 사용자 성과물)나 실제 제품 기능 완성 비율로 보이게 한 것은 부정확하여 정정한다.

## C. 개발/검증 게이트를 나누는 공식 집계 정책

- **로컬/합성 PASS:** 해당 시험 입력·화면·브라우저·가상원장 한정. 사용자가 실제로 가입해 자기 사진/자료를 안전하게 이용 가능한지와 별개.
- **06 독립:** 원시 ZIP/PNG/JSON/SHA 검증의 판정까지; **00 기술제한수락:** 특정 P0 합성 계약에 국한. 이 둘도 제품 최종 완료와 다름.
- **08 정적 수락:** AUTH A~F 설계에만 성립. 서버 Auth/Storage RLS/사진 서명 URL/아이 API, 같은 브라우저 가족 전환의 실제 보안 PASS 아님.
- **제품·운영 완료:** 실제 인증·데이터 분리·복원·실기기/접근성·독립 QA·총괄 승인 **모두** 확인한 때에만 해당 성과물 전체 PASS로 변경.
- 향후 사용자 '10단계' 보고에는 반드시 **A 사용자 성과물 / B 개발완성 / QA79 단일오답** 중 어떤 기준인지 첫 줄 명시. 별도 근거 없이 항목 번호·제목·분모·완료판정 변경 금지.

## D. 불변·다음 1건

`AUTH-GATE BLOCK` / `VIS-FIX FAIL` / `safeToRestore:false` / PR80 Draft / 7·8 HARD HOLD 유지. dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 원본 불변. 코드·신규 CI·기존 성공 시험 반복·새 계정/DB/배포/운영 자료·광고/예약 변경0.

다음 승인된 문서 작업: 00 [#7063369574](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063369574)의 **현재 dev 대표 사용자 여정 1개 실제 제품 갭표**(새 앱 기능 구현 아님) 및 08 #7063201193의 JWT 잔존·기발급 사진 URL·Cookie/CSRF·캐시 반례 보완. 범위 바꾸는 신규 수정은 00/99 승인 후에만.
