# WRONG-005 · ER-R005/006 관련 개념·원인 후보·복습 관찰 분리 무결성 검증 v1.0

- 기준일: 2026-11-09
- 통합 지시: [uri-homework-manager #52 §13.5](https://github.com/jinbh99-arch/uri-homework-manager/issues/52)
- 기준: WRONG-004 [Draft PR #47](https://github.com/jinbh99-arch/uri-wrong-answer-qa/pull/47), 성공 HEAD `d4bf065bb3159c3121a7525c02a671c64f1f52a2`, [Actions #42632722612](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/42632722612).
- 신규 Draft PR: [#48](https://github.com/jinbh99-arch/uri-wrong-answer-qa/pull/48). 기존 #45→#46→#47→#48 의존, 원본 변경/병합/배포 금지.

## 1. 의미·소스·판정 경계

| 정보 | 저장 필드 / 코드 | 현행 화면 뜻 | 검증 기준 |
|---|---|---|---|
| 문제에서 다룬 개념 | `conceptId` (미분류는 `''`) | **학부모가 수동으로 연결한 문제 관련 개념**, 이해 부족/실제 원인·선수개념 자동 단정 아님 | 수정/백업·복원/재풀이/학습 보고에서 같은 ID 유지 |
| 아이가 틀린 실제 이유에 대한 **후보·추정** | `reason`: `unknown/calculation/reading/concept/other` | 실제 원인 확정이나 학부모의 **복습 후 관찰**과 별개. 여러 원인은 `unknown/other` 및 기존 `memo`에 후보로 적어 확정 보류 | 단일 후보를 확정 원인으로 변환하지 않고 기록별 보존 |
| **복습 뒤** 학부모가 실제로 기록한 관찰 | `checkHistory[]`, `followupHistory[]` | 결과/시점/메모는 기록된 학부모 관찰이며 진단·향상/숙련도 측정 아님. 재풀이 `generalRetryHistory[]`도 별도 | 기존 history append-only 저장, 전송/복원·재방문·보고 보존 |

원본 PRD v0.2(OB-01~05), ER-R004~006/012~017의 **최신 #52 §13.5 인용 범위**를 요구 기준으로 사용. 이 개발방에서는 Library PRD 원문 전체 항목을 직접 대조하지 못했으므로 해당 원문 전체 확인은 **부분 검증**으로 유지한다.

## 2. 기존 기능 재사용과 발견된 UI 의미 문제

- **이미 구현된 기능**: `index.html`의 `mistake-form`·`renderDetail`, `v20SaveMistakeGuarded`, IndexedDB 사진 Blob, `v214` 완전 JSON 백업·`v18` 무결성 검사·복원, `v230` 재풀이, `v05/v06` 학부모 복습 계획·관찰, `v227` 부모 활동 집계, QA42 가상 JWT·Postgres RLS·CAS 수동 가족교환. 스키마 변경 없음.
- **발견된 표현 오류**: 저장 폼의 `reason` 선택문이 '틀린 이유에 대한 학부모 관찰'이어서 복습 후 실제 확인 이력과 의미 혼동. 상세에서도 '관찰한 오답 이유(추정)' 혼용. 부모 보고서는 개별 이벤트를 보여주지만 **현재 개념/원인 후보/복습 이력의 구분 표시**가 없음.
- **최소 수정**: 입력 필드를 '틀린 이유 후보 (학부모 추정·미확정)'로 명명. 상세는 기존 필드를 읽기 전용으로 나란히 설명, 보고서 이벤트에 **현재 저장된 분류**와 **과거 관찰 시점**을 구별해 표시. 새로운 확정 판정/모델 결과·실가족 데이터/스키마 변경 없음.

## 3. 신규·기존 QA 기준

- 신규 `tests/wrong005-semantics-journey.mjs` : 세 가상 오답(개념만 있음/원인 후보만 있음/복수 후보 메모)을 등록하여 서로 다른 ID와 사진을 확인. 수정/부모 재풀이 및 상반된 관찰/학부모 보고서/JSON 전체 백업·복원/390·320px 서로 다른 Chromium 브라우저 재접속. 원본 바이트/타 기록 불변.
- 강화 `tests/wrong004-two-browser-journey.mjs`: 가족에 **서로 다른 두 오답**(사진+개념/무개념+원인 후보)을 담아 부모→아이→부모→아이 교환·재풀이/복습 후 같은 ID/필드/사진 불변 및 타가족 거절·충돌/오프라인 fail-closed.
- 보존: `tests/wrong002-core-journey.mjs`, `tests/wrong003-first-use-photo-flow.mjs`, QA42 등 기존 `.github/workflows/qa-e2e.yml`의 전 항목.
- 완료 판정은 반드시 **신규 최종 HEAD GitHub Actions `completed/success`와 로그**를 별도로 확인한 뒤만 부여한다. 코드 커밋·테스트 작성 자체는 실행 통과 아님.

## 4. 승인·미완료

- 이 기능은 **실제 사용자 원인 규명이나 학력평가가 아니다**. 개념→원인→관찰을 하나로 추정 합성하지 않음.
- 운영 Netlify/Supabase, 실가족 OAuth/법정대리인 권한·실아동 정보/사진, 정식 가족 자동동기화, 정식 오답→레벨·숙제 자동 연결 모두 미검증/미승인.
- 기존 기술 QA 14/16·제품 최종 승인 0/16 변경 없음. PR #45·46·47 선행 병합과 실제 운영 배포는 별도 승인 대상.

## 5. 이력

| 날짜 | 수행 | 상태 |
|---|---|---|
| 2026-11-09 | #52 §13.5·기존 PR #47 코드·CI 대조, 본체 의미 혼동 검토, 별도 Draft PR #48 및 신규/회귀 테스트 추가 | 자동검사 결과 확인 전 |
