# WRONG-008 · 비수학 일반 재풀이 → 학부모 관찰 → 수동 날짜 메모 연결 v1.0

## 기준
- 총괄 [공통 `uri-homework-manager#52` §16 WRONG-008](https://github.com/jinbh99-arch/uri-homework-manager/issues/52); 원 오답 PRD v0.2의 OB-02(직접 분류·원인 선택), OB-03(단정적 진단 금지), OB-05(관찰 전 자동 완료 금지), 재풀이→학부모 직접 관찰 목적.
- 기존 기준 [WRONG-007 Draft PR #50](https://github.com/jinbh99-arch/uri-wrong-answer-qa/pull/50) 성공 HEAD `19ff123a4234efa45118f4b51a79b6b6255ea87c`, [Actions #42648013561](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/42648013561).
- 사전 옵션·계약 판단 [#52 설계 인계 댓글](https://github.com/jinbh99-arch/uri-homework-manager/issues/52#issuecomment-6751392732). 기존 코드와 별도 계약이 필요한 지점을 총괄에 먼저 보고 후 진행.

## 코드 문제와 대안
- 실물 앱에는 비수학 수동 일반 재풀이 `generalRetryHistory[]`, 그 결과의 부모 실제 관찰 `review/reviewedAt`, 별도 부모 직접 확인 `checkHistory[]`는 이미 존재. 그런데 '다음 확인일'로 넘어가는 부모 동선은 없었다.
- A) 수학 `studyPlan/followupHistory`를 비수학에 복제: 수학 `conceptId`가 필수이고 `wrong007NonmathSafe`와 기존 백업/복원 의미를 위반하므로 **기각**.
- B) 기계가 읽을 수 있는 새로운 `generalReviewPlan` 계약(기한·상태·취소/재계획): 미래 알림·모아보기에는 적합하나 구버전 백업/가족 계약 버전 업그레이드와 승인 필요. **총괄 결정 전 보류.**
- C) **채택**: 기존 수동 `checkHistory[{at,status:'not_checked',memo,by:'parent_observation'}]`만 활용. 날짜·미확인 상태를 인간이 읽는 일정 **메모**로 추가하고, 아이 재풀이·부모 실제 관찰은 기존 `generalRetryHistory`와 구분. 새 저장 필드·백업 버전·사진 키·기존 수학 데이터 변경 **0건**.

## 실제 구현
- `index.html`: 국어·영어·과학·사회 오답의 일반 재풀이 뒤 학부모 보기로만 '④ 다음에 다시 확인할 날짜 메모하기'를 노출. 화면의 날짜 선택·다음에 할 질문을 기존 '확인 전' `checkHistory` 메모 문자열 `다음 확인 메모: YYYY-MM-DD · …`로 **명시적 저장 클릭 시만** 기록. 조회 후 최근 수동 날짜·확인 전 상태·날짜 지남을 읽기 전용 안내. 확인 예정일이 지났다고 실제 확인/학습 효과/완료를 자동 기록하지 않음.
- 잘못된 날짜·과거 날짜·저장소 미사용·이력400건 이상·전체 데이터 예산·동일 ID의 다른 탭 변경을 안전 차단. 기존 CAS `v20SaveMistakeGuarded`와 저장 후 전 레코드 재읽기를 재사용. 사진·다른 오답·부모 실제 관찰·복수 원인·과목·학년·ID 불변. 과목별 수학 개념 AI 후보·수학 전용 복습 일정은 여전히 비수학에 제공하지 않음.
- `wrong008ManualDate`는 접두어가 **정확한 기존 status=not_checked + 유효한 날짜**와 함께 있는 텍스트만 수동 메모로 표시. 기존 일반 `not_checked` 관찰은 다른 뜻으로 바꾸지 않음. `v227ReportModel` 집계는 이런 미래 **메모**를 실제 부모 확인 수에 포함하지 않고 별도 일지 이벤트로 출력. 기존 WRONG-002 상태, 홈 요약, 상세/보고서 관찰 회수 역시 수동 메모 제외. 원 `checkHistory` 자체는 100% 보존.
- **제약**: 날짜는 수동 메모일 뿐 예약·알림·오늘 할 일 큐·다음 날짜 자동 변경·자동동기화가 아님. 일반 재풀이/관찰과 '다음 확인 메모' 사이에 정식 관계 ID/상태머신이 없으므로 구조화 일정으로 오인하면 안 됨. 실제 날짜를 기반으로 재확인했다고 주장하지 않음.

## 검증 방법
- 신규 `tests/wrong008-nonmath-manual-recheck.mjs`: 수학4·국어3·영어5·과학6·사회4학년 합성 5ID/사진2장, 재풀이 전 기록 금지→부모 기존 리뷰→잘못된 날짜 거부→비수학 수동 다음 날짜 저장→실제 부모 관찰 분리→두 번째 날짜 append-only→활동 보고 집계 수동 메모 제외→기존 JSON 사진 백업/복원 후 320px 재접속, 390px 모바일 넘침·오류 검사. 신 `checkHistory` 항목 키는 기존 **4개만**.
- 강화 `tests/wrong004-two-browser-journey.mjs`: 가상 가족 수학 사진 오답 + 영어5학년 복수 후보·일반 재풀이·부모 관찰·수동 예정 날짜를 서명 **합성** JWT/localhost PostgreSQL RLS, 수동 전송→아이 가져오기→부모 교환으로 동일하게 보존.
- `.github/workflows/qa-e2e.yml` 기존 QA42 및 WRONG-002~007 전체 테스트 삭제·생략 없이 신규 단계 추가. 최종 **동일 PR HEAD**의 Github Actions 결과 확인을 완료 조건으로 지정.

## 비수용 / 결정 필요
- 원 PRD `error_id UUID`와 현 `m+uuid`의 공식 타서비스 ID 매핑 계약 **미승인**. 기존 ID 변경/일괄 마이그레이션 없음.
- 머신 판독식 `nextCheckDate/nextCheckStatus`와 별도 구조화 계획/상태 전이, 자동 알림·과목별 교육 검증 개념, 진짜 보호자 인증/동의·물리 Android/iOS·교사/실아동 현장검증은 **미실시**. 추후 구조화 계획을 하려면 명시적 데이터 계약·구형 백업 역호환 정책을 총괄/사용자 승인 후 별도 진행.
- 운영 Supabase·Netlify·공개 Pages·PR 병합/배포/실아동 기록은 변경하지 않음. 기존 기술 QA14/16·제품 최종 승인0/16 집계는 총괄 판단 전 유지.

## 작업 이력
- 2026-11-10 KST: #52 §16 확인 → 기존 #50 전체 코드·PR·CI 검증 → 신규 스키마 위험·선택지 사전 #52 보고 → 기존 메모 계약의 국어·영어·과학·사회 수동 날짜 UI 연결 구현, 사진/이력/부모 분리 검증 자동화. 최종 Actions는 실행 결과를 확인해 별도 인계한다.
