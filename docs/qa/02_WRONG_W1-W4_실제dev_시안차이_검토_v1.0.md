# 02 WRONG — W1~W4 실제 dev ↔ v0.9.3 디자인 시안 차이 검토 v1.0

**작성/범위:** 2026-11-18 KST · 02 WRONG 담당 · **정적 소스 대조만 수행**. 실서비스 제품 코드/PR/기존 UI 시안/실계정/실자료/배포/예약을 수정하거나 새 CI·브라우저를 실행하지 않았다. 00 [02 담당 지시 #6967850202](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6967850202)의 **A18-22 URL 판정 정정 완료 후** 진행한 후행 문서다.

## 1. 대조 대상과 근거 우선순위

1. **실제 02 제품 개발 후보 코드:** [`uri-wrong-answer-qa` dev `index.html`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b/index.html), 커밋 `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, Git blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`; [README.md](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b/README.md), blob `ec928b04a7bb33d0c7aa40541a5d175d815262f4`. **dev에 없는 QA 패치는 제품 구현으로 계산하지 않는다.**
2. **디자인 비교 기준:** [UI v0.9.3 단일 HTML](https://github.com/jinbh99-arch/uri-homework-manager/blob/docs/ui-v093-commute-review-20261118/%EB%AC%B8%EC%84%9C/%EB%94%94%EC%9E%90%EC%9D%B8%EC%9D%B8%EA%B3%84/UI_3%EC%95%B1_%EC%A7%80%ED%95%98%EC%B2%A0%EA%B2%80%ED%86%A0_%EB%B0%94%EB%A1%9C%EC%B2%B4%ED%97%98_v0.9.3.html), Git blob `e25ee55f28c2e34ef2ee6ed77ae5548e2959e76b`, 오답 섹션 `#column-wrong` 및 `data-core="wrong:0..3"`. **가상 HTML/JavaScript 데모**이며 제품·실OCR·로그인·사진 업로드/동기화가 아니다. 더 최신 v0.9.4는 별도 시안으로 존재하나 이번 00 지시의 비교 기준은 v0.9.3이다.
3. **검증의 수준:** [00 종합 UI-005](https://github.com/jinbh99-arch/uri-homework-manager/issues/90#issuecomment-6964162249) 및 [09 사업화 휴리스틱](https://github.com/jinbh99-arch/uri-homework-manager/issues/90#issuecomment-6964155963)은 설계 평가. [A18-21 CI 44132887314](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44132887314), [A18-22 CI 44138438965](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44138438965)은 **합성 Chromium/격리 QA**, 실제 부모·실기기·운영 PASS가 아니다.

## 2. W1~W4 실제 소스/시안 1:1 정적 대조

| 단계·부모의 첫 행동 | **dev 실코드 근거** | **v0.9.3 시안 / 차이** | **현재 분류 / 위험 / 보존해야 할 게이트** |
|---|---|---|---|
| **W1 문제 등록**: 사진이 있으면 선택, 아니면 문장 직접 입력 | `#page-add`, `#mistake-form`, `#take-photo`, `#choose-photo`, `#v08-direct-file`, `#problem`, `#save-btn`; 사진은 브라우저 IndexedDB `photos`, 오답은 `mistakes`에 별도 객체로 기록. 저장 직후 `readOne('mistakes', id)` 및 사진 Blob/바이트 일치 검사, 이후 화면 `#v09-save-confirm`. 실패/ACK 불명은 경고로 표시. | `#column-wrong` 첫 단계의 ‘사진/글로 등록’과 가상 예시 사진. 데모 버튼은 실제 파일 촬영이나 IndexedDB 저장과 연결되지 않음. | **로컬 입력·읽기 확인 코드=실제 구현**, **시안 UI=가상**, **실사진/실폰=미검증**. 원본·수기 대체, 사진 바이트 보존, 중복 등록 금지 및 ‘저장 실행됨/읽기 확인 불명’ 구분을 유지. |
| **W2 원본 대조→인식 초안 수정→부모 재확인→저장 확인** | `#ocr-panel`·`#ocr-run`(선택적 OCR 시범), `#ocr-preview` 수동 편집, `#ocr-reviewed` 확인 체크, `#ocr-apply`/`#ocr-replace`; 외부 OCR 라이브러리·모델 다운로드는 별도 확인 대화상자 후 실행하며 제3자 코드 통신 위험 검증 전. 선택적 저장 경로는 기록/사진 재읽기·일치 검사 및 실패 경고. | ‘가상 원본 사진’ ↔ ‘가상 인식 초안’ 수정 및 ‘원본과 비교한 문장 검토 완료’ → 별도 ‘가상 저장/확인’ 상태. 시안의 검토 완료/저장 단계는 실제 ACK를 제공하지 않음. | **OCR 수정·동의 흐름=일부 실제 구현**, **실 OCR 인식률·제3자 네트워크/안전=미검증**, **시안=가상**. W2 중복 화면은 시각적으로 한 흐름으로 압축할 수 있지만 **원본·수정 흔적/재확인·저장 ACK·실패 후 읽기/중복 방지**를 합치거나 삭제하면 안 됨. OCR 처리 성공≠저장 성공. |
| **W3 아이 스스로 재풀이→제출 뒤 결과** | 상세 화면 `#page-detail` 및 `#wrong002-journey`의 ‘① 아이가 다시 풀기’ 버튼은 재풀이 입력으로 이동하고, `practiceHistory`/`generalRetryHistory` 기록을 합산 표기. `body.v218-child`에서는 학부모 메모/확인 이력 UI를 숨기거나 비움. **실제 계정 인증/권한 정책은 아님**(코드 내부 명시). | ‘아이 재풀이’ 단계가 직접 답을 적고 가상 정답을 보는 흐름. 화면의 샘플 답/개념 후보는 실제 5과목 자동채점 또는 진단이 아님. | **재풀이 인터페이스·로컬 이력=일부 실제 구현**, **시안=가상**, **정답 선노출·아이 DOM/브라우저 보호/실역할 인증 전체=미검증**. 결과 전 정답 노출 금지, 부모 메모·미확정 OCR 초안의 아이 비노출을 지속 검증할 것. 화면 모드 전환을 가족 권한으로 표현 금지. |
| **W4 부모 관찰→다음 복습·기록** | `#check-status`, `#check-memo`, `#check-save`, `checkHistory`의 `by:'parent_observation'` append, `v20SaveMistakeGuarded`; `studyPlan`/복습 일정 및 `#wrong002-state` 관찰·재풀이 횟수 요약. 저장 실패 `notify('확인 기록 저장에 실패했습니다.')`; **dev에는 A18-21 클릭 가드 및 A18-22 beforeunload 가드 없음**. | ‘부모 관찰’ 시안이 결과·다음 확인을 가상 상태로 표시. 실제 브라우저 복귀나 부모 저장 충돌을 처리하지 않음. | **부모 관찰·로컬 이력=실제 코드**, **실패 후 메모 이탈보호=A18-21/22 격리 QA만**, **시안=가상**, **물리폰/종료 복구=미검증**. 기존 관찰 이력과 재풀이/복습계획을 혼동하지 않고, 미저장 메모 보호는 제품에 아직 적용되지 않았음을 표시. |

**IndexedDB와 개인정보:** 브라우저별 로컬 DB는 실제 가족/교사/학교 계정 인증이나 서버 원장이 아니다. 같은 기기를 공유하는 사람이 자료를 열람할 가능성이 있어 실제 아동 사진·이름·학교 정보를 시험하지 않는다. 사진 저장·복원·삭제·로컬 백업 및 암호화/실계정 권한은 서로 다른 검증 항목이며, **`safeToRestore:false`, PR #80 Draft, 병합·운영 승인 0**을 보존한다. 01 개념트리와 자동 연동하거나 5과목 자동 인식·개별 학년 공식 성취도/원인진단을 확정하지 않는다.

## 3. A18-22 URL/메모/원장 독립판정 정정(후행 디자인 작업 선행 완료)

- **경로 코드 실물:** `tests/wrong-a18-22-parent-browser-back.mjs`는 `page.goto(preview.url+'?a1822=entry')` **후** `page.goto(preview.url)`로 현재 주소 `baseUrl=/`를 만든다. `entryUrl=?a1822=entry`는 **history.back()의 목적지(이전 페이지)**이지 뒤로가기 직전 현재 주소가 아니다. dialog `dismiss()`('머무르기') 후 `urlAfterBack=/`이고 `stayed=(urlAfterBack===baseUrl)=true`이므로 **현재 URL 유지 검증과 모순이 없다.** `history.state`의 실측 시퀀스는 기록되지 않았다.
- **DOM/원장:** [GREEN 44138438965](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44138438965) 로그의 320/390 `nativeDialogs[beforeunload]`, `draftExact=true`, `unchanged=true`, `savedBackAllowed=true`, 사진 2,099바이트, PNG8/JSON1은 **격리 합성 Chromium 자기검증 PASS**. RED [44137806914](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44137806914)에서는 경고 없이 이전 URL로 이동. `baselineApp=false`는 `LEGACY_QA_APP`(옛 미패치 Git blob)와 **현재 패치 후 index.html blob을 비교**한 별도 플래그로, 예상되는 값이며 제품 PASS가 아니다.
- **모바일 한계:** `beforeunload` 대화상자는 브라우저/사용자 활성화/종료 상황에 따라 발생하지 않을 수 있고, 물리폰 뒤로가기·새로고침·탭 강제종료·앱 백그라운드 종료·Safari/기타 브라우저의 실동작은 **N/T**. 이것은 안전한 초안 영구보존이나 복원 기능이 아니다. 06이 원시 PNG/JSON과 주소/DOM/IDB 판정을 독립 대조해 이 한계를 분리 표기해야 한다.
- **#82 정정 보고:** [#6968116941](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6968116941). 06 과거 부분검증은 원시 증거 수준에 따라 유지; 제품 승인/운영 PASS로 승격하지 않는다.

## 4. 첫 3분 최소 가치 검증 계획(실행 아님)

**목표:** ‘보호자가 가상의 수동 오답 1건을 등록하고, 저장되었는지 확인한 뒤, 아이가 정답을 미리 보지 않고 재풀이를 시작한다.’ 01 LEVEL/03 HOMEWORK와의 실데이터 연동은 제외한다.

1. **0~30초(첫 가치 이해):** 부모가 도움말 없이 ‘누구를 위한 앱인지 / 어떤 문제를 해결하는지 / 첫 행동이 무엇인지’를 말하고 ‘사진 없이 직접 입력’을 찾는지 관찰. 시안과 제품 화면을 명확히 구별한다.
2. **30~120초(수동 오답 1건):** 합성 문제를 직접 입력하고 저장한다. **저장 후 독립 재조회·사진 원본 유지**를 기록하며, ACK 불명이나 실패 주입 시 연속 저장 버튼 연타/중복 등록이 없어야 한다.
3. **120~180초(아이 재풀이 시작):** 아이 모드에서 재풀이 입력 시작까지 이동. 정답·보호자 메모·OCR 미확인 문구가 결과 전 노출되지 않았는지 DOM/화면을 검사한다. 관찰 이력과 복습 예약은 후행이며 자동채점/공식 진단 완료로 표기하지 않는다.

| 검증 항목 | 완성 기준(향후 시험 설계) | 현재 관측 상태 |
|---|---|---|
| 320/390 시각·키보드·뒤로가기 | 첫 행동 명료, 44~48px CTA, 초점·오류·URL/IDB 분리 증거 | 기존 합성 QA 일부 PASS, **이번 문서에서는 시험 안 함** |
| 데이터 안전 | 합성 오답1/사진 바이트 재조회, 실패/불명 ACK 분리, 중복0, 아이 메모 비노출 | dev의 일부 로컬 로직 확인, 실제 가족/폰 N/T |
| 사용자의 첫 3분 경험 | 동의가 적절한 별도 B단계에서 무설명 부모 8~12명 관찰(행동시간·오류·중도이탈 기록) | **N/T**; ‘3분 완료’는 목표이지 실적 아님 |
| OCR/복원/계정 | 실OCR 정확도, 가족 로그인/권한, 사진 저장 삭제·복원, SDK 요청/개인정보 처리 | **N/T / 별도 승인 필요** |

## 5. 비교 결론과 품질 판정

**현재 선택:** v0.9.3의 W1~W4 가치 흐름을 ‘유지하되 중복 설명/확인 페이지의 시각적 부담을 줄이는 안’으로 검토한다. **원본 사진·인식 문장 수정·보호자 재확인·읽기 검증 ACK·저장 실패/복원 경계는 UI를 압축하더라도 독립 상태로 반드시 유지**한다. 현재 제품에 디자인을 복사하지 않는다.

| 자체 문서 품질 평가(10점 만점, 정적 검토 기준) | 점수 | 한계 |
|---|---:|---|
| 적합도 | 9 | 00의 W1~W4 4단계/선행 위험 정정에 대응 |
| 근거 추적성 | 9 | dev SHA/blob·시안 blob·코드 ID·CI URL 직접 대조, 실데이터 아님 |
| 실행가능성 | 8 | 제품 변경 없는 문서 제안, 실제 이식/기능 QA 후속 분리 |
| 검증 완결성 | 6 | 원시 ZIP 내 모든 시각 내용·실폰/학부모 실측은 N/T |
| **평균(자체 추정)** | **8.0** | 06 독립 검증·제품 적용 승인 아님 |

**다음 한 건:** 06이 기존 A18-22 원시 화면·JSON과 정확한 URL 목적지/현재 주소/메모·원장 판정을 대조한 뒤, 00이 필요 시 별도의 격리 히스토리 타임라인 QA를 승인한다. W1~W4 제품 변경·이식은 별도 00/Jin 권한 게이트에 따른다.
