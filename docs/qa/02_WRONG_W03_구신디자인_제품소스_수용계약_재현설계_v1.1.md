# 02 WRONG · 00T-02-W03-EDIT-PERSIST — 구·신 디자인/제품 경계 및 최종 수용계약 v1.1

작성: 2026-11-21 KST · 소유: 02 WRONG · 협업: 40 디자인 · 독립검증: 06 · 승인: 00. 기존 W03 업무 ID 유지, 새 00T 없음.

## 1. 대조 기준 — 세 원본을 직접 개봉

1. 구 [02 WRONG 오프라인 클릭형 v1.1 HTML](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-ui-html-storyboard-20261115-2000/문서/스토리보드/02_WRONG_클릭형_오프라인_프로토타입_v1.1.html): Git blob **ab6e49fd0822241a93391d57a7b11a94b37f9e58**, 25,030자. W03, qtext(), confirmtext/save, render() 실제 소스 검사.
2. [40 통합 클릭형 v0.9.9 HTML](https://github.com/jinbh99-arch/uri-homework-manager/blob/docs/ui-v099-hw-candidate-defer-20261119/문서/디자인인계/UI_3앱_후보별확인_준비물보류_통합클릭형_v0.9.9.html): Git blob **956e7b587cf685b9784a0a260258f87c47e7e84f**, 93,302자. WR-02=wrong:review/confirmed, WR-03=wrong:child, 모형 예외 wrong:uncertain/lookup 검사.
3. [현재 02 제품 index.html](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/dev/index.html): dev HEAD **3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b**, index Git blob **250aff5b0a46490488b64f7b96a83c940d2d6c71**, 499,433자. OCR UI/비동기·수정·IndexedDB 원장/사진·아이 DOM 검사.
4. 40 [12화면 개발인계 v1.0](https://github.com/jinbh99-arch/uri-homework-manager/blob/docs/ui-d0-developer-handoff-v10-20261121/문서/디자인인계/40_웹앱_디자인_개발인계_v1.0.md) blob **e589da67f5ce8b1ef1a871b6d2a5e7e37dd9b9eb**: WR-02에 부모 문장 재확인, WR-03에 저장 ACK 후 아이 문제 노출을 요구. 시안의 memory saved는 실제 저장 ACK와 별개.

## 2. 원인·차분 분석

| 기준 | 실제 코드 동작 | 판정 / 주의 |
|---|---|---|
| 구 v1.1 W03 수정→확인 | textarea#ocrText 원본 값은 qtext()→state.recordTitle에서 생성. confirmtext는 state.draft / reviewSignature만 수정하고 render()를 호출하지만 recordTitle은 save 이전 그대로다. | **정적 재현 가능한 시안 논리 오류**. 새 문장 입력→확인→재렌더 후 이전 문장 재등장; 이어지는 save 시 textarea와 reviewSignature가 달라 저장 차단 가능. 구 시안 자체는 메모리 가상 체험. 이번 작업에서 구 시안 실제 클릭 브라우저 재시험은 하지 않음. |
| v0.9.9 WR-02 | 입력 이벤트가 state.wrong.ocr를 갱신하고, 기존 confirmed와 다르면 confirmed를 비우고 saved=false 및 ocrDirty=true. confirm은 현재 ocr를 confirmed로 복사. | **구 시안 수정값 렌더 유실 경로를 디자인 상태에서 보완**. 그러나 실제 OCR 엔진, IDB 저장/재열람, 인증/권한 없음. |
| v0.9.9 예외 | commit은 confirmed===ocr이면 브라우저 메모리 saved=true→child; retrydemo는 confirmed=ocr 및 saved=true를 직접 설정. | **제품 이식 금지:** retrydemo는 부모의 명시 검토/서버 ACK를 건너뛰는 시연용 샛길. 화면만 보고 제품 안전 통과로 판정할 수 없음. |
| 현재 dev OCR 미리보기 | #ocr-preview 수동 input→ocrExtracted 갱신·OCR 적용/교체 활성. ocr-replace는 다른 기존 문장이 있으면 확인창 후 v12ApplyOcrText로 #problem에 현재 수정본 반영. | 구 시안의 recordTitle/render 재생성 설계와 다름. 수정값 저장 전 상태가 #problem 필드에 남는다. |
| 현재 dev 재확인 | 적용 때 #ocr-reviewed false. #problem 입력 때 기존 확인이 true이면 false와 경고. 저장 레코드의 ocrStatus는 실제 체크 여부에 따라 browser_ocr_reviewed/browser_ocr_unconfirmed로 분기. | 기존 승인 표식을 수정 내용에 무단 승계하지 않음. 모든 직접 입력/변경 도구·상태 조합의 전수 검증은 N/T. |
| 현재 dev 늦은 OCR | OCR 실행 당시 activeImageRevision 캡처. photo/crop 변경은 ocrImageRevision 증가; 결과 반영 직전 revision·route add를 대조. 성공한 OCR 결과는 #ocr-preview로 들어가고 **#problem을 자동 교체하지 않음**. | 사진/화면 변경 뒤 오래된 콜백 차단 장치 있음. editId 자체를 결과 적용 시 직접 대조하는 독립 가드로 입증한 것은 아님; 실제 비동기 경쟁 전수 PASS 주장 금지. |
| 현재 dev 저장/재조회 | v20SaveMistakeGuarded는 IDB readwrite transaction 안에 기대 기록 스냅샷 대조 후 쓰기, 이후 readOne으로 기록·사진 조회, 재로딩 상세 화면 표시. | W03 합성 브라우저 320/390에서 교정본·UUID·사진 보존 실증. 운영 서버 ACK/실가족 권한 보증 아님. |
| 현재 dev 부모/아이 | v218-child는 **표시 모드**. 부모 메모의 특정 DOM 제거 및 편집 진입 차단 코드 있음. | 특정 메모의 child DOM0 합성 증거와 별도로 **동일 기기/브라우저의 실가족 인증은 BLOCK**. v218 토글≠인가. |

## 3. 승인 기준: 오답 한 건의 안전한 단계 상태

**데이터 경계:** photoOriginal(사진 bytes/hash), ocrCandidate(비확정 추출), parentEditedText(현재 부모 문제 내용), reviewConfirmedValue/Revision(확인된 정확 텍스트), savedRecordId(기존 UUID/원장), ocrStatus, parentMemo를 구분. OCR 추출이 학습 이해도/정답/공식 성취기준을 자동 확정하지 않는다.

**허용 전이:** draft → ocr_candidate → parent_edit_unreviewed → parent_reviewed → saving → saved_confirmed(저장·재조회 일치). 수정/photo·crop 변경 시 검토 표식 즉시 해제; 변경된 텍스트에 대해 이전 확인 무효. 저장 실패 확정은 failed, 쓰기 완료 여부 불명은 unknown으로 구분하여 **unknown에서 자동 중복 POST/두 번째 UUID 발행 금지**, 기존 기록 조회를 우선한다.

**아이 노출 게이트:** 미확인 OCR·부모 메모·저장 불명/미확정 문제는 아이 응답에서 제외. 화면 display:none이나 v218 child 전환만으로 인증/서버 허가 판정 불가. 실 가족 A/B·401/403/세션폐기/캐시·응답 직렬화는 기존 **00T-02-AUTH-GATE**와 08의 독립 보안 판정이 선행되어야 한다.

**기록 불변식:** 같은 기록을 교정·재저장할 때 UUID 유지·신규 등록 0, 기존 사진 삭제를 명시하지 않았다면 이미지 SHA/바이트 불변, 이전 복습/재풀이/관찰 히스토리 불변. 타 탭의 최신 버전과 충돌하면 원본 덮어쓰기 대신 중단. 저장 후 새로고침→목록→상세→편집에서 parentEditedText, 검토상태, 사진, recordId 동일; 중복 저장 방지. 원시 시험은 실제 사진/OCR 성능을 입증하지 않는다.

## 4. 재현설계 및 증거 매핑 — 기존 성공 자료를 다시 돌리지 않음

| 사례/절차 | 실패 시 표시·불변 조건 | 기존 증거 | 판정 |
|---|---|---|---|
| OLD-W03: 구 v1.1 W03 입력을 예시 12 ÷ 3 = ?에서 새 문장으로 교체 → 직접 고쳐서 확인 → 저장 | 확인 전 새 문장과 render 후 보이는 값이 같아야 함. 구 소스는 recordTitle 재렌더로 불일치 가능 | 구 HTML qtext/confirmtext/save 정적 원문 | **구 시안 논리 결함 정적 확인**. 새 브라우저 재현 N/T |
| NEW-UI: v0.9.9 wrong:review에서 ocr 수정→confirm→edit→재수정→confirm | 수정마다 saved=false, confirmed 공백, 보이는 textarea에는 수정문구 유지 | v0.9.9 상태/input/event 코드 | **디자인 정적 계약 확인**, 실제 제품 저장 아님 |
| DEV-W03: 320/390 가상 OCR → 부모 직접교정 → replace 확인 → 다시 수동 수정 → 검토 무효 → 재확인 → 저장 → 새로고침/상세/편집 | 정확한 최종 문구, browser_ocr_reviewed, ID 동일/사진 759B SHA 동일/부모 메모 child DOM0 | [CI44883435344](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44883435344) [ZIP14698708544](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44883435344/artifacts/14698708544) | **06 독립 LIMITED_PASS** [#7060240364](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7060240364); **00 A격리 기술제한수락** [#7060462054](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7060462054) |
| LATE-A-B: A사진 OCR 시작 → A 편집 취소 → B 기록 수정 중 늦은 A 응답 도착 | B의 problem/ocr 원문·DOM·A/B 원장·사진 바이트 불변, 아이 잔여 OCR DOM0 | dev 테스트 소스 tests/qa84-w3-cross-record-late-ocr-chromium.mjs; 이번 신규 실행 없음 | **기존 시험 설계 확인**, 이 문서에서 신규 동적 PASS 주장 안 함 |
| LATE-SAME: 같은 기록 수정 중 동일 사진/다른 사진·crop 변경/사용자 타이핑 후 늦은 OCR 응답 | 편집값 자동 덮어쓰기0, 사용자가 명시 재확인하기 전 reviewed=false, 저장 전후 무결성 | dev activeImageRevision/route 체크 정적, 관련 실제 신규 원시 별도 필요 | **부분 검증/N/T**: 본 W03 CI에서 비동기 지연 경합을 발생시키지 않음 |
| UNKNOWN/AUTH: ACK 확인불가 중복/다른 가족 같은 프로필 아이 API | 기존 원장 조회 우선, 새 UUID·POST0, 타가족/부모메모/미검토 OCR 응답0 | 별도 ACK 격리·08 AUTH-GATE. 기존 320/390 ACK Playwright 즉시 PNG 2장 단색 FAIL | **기존 별도 BLOCK/시각 FAIL**, W03 LIMITED_PASS로 승격 불가 |

**향후 실패 재현 시 원시 산출 요구:** 고정 SHA/부모 기록 ID(비식별)/사진 SHA, 응답 도착시각·request/record/edit epoch·OCR preview/problem/checked 상태 전후, 클릭 순서, 320/390 및 native200 한계, 실패 PNG·JSON, IDB 전후+정확 역패치. 새 CI/코드 수정을 무조건 요구하지 않고 **기존 원시와 차이를 먼저 대조한 후 00의 차분 승인**을 거친다.

## 5. 최종 상태와 변경 이력

- **완료:** 구·신·dev 실제 3원본 상태 차분 및 W03 수용계약/재현설계. 구 시안의 편집값 재렌더 결함은 제품 dev와 구별. [W03 개발 자체 증거](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7059728593) 후 신규 [06 독립 #7060240364](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7060240364), [00 제한수락 #7060462054](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7060462054)까지 확인. 이 작업에서 해당 CI를 재실행하지 않음.
- **다음:** 40 디자인은 구 v1.1의 recordTitle 재렌더 오류를 *역사적 결함*으로 표시하고 v0.9.9의 s.ocr·확인 무효화 계약을 보존. **retrydemo/commit 가상 saved 우회는 제품 이식 금지**. 02/06/08은 실제 OCR 비동기 경쟁 및 가족별 인증 경계에 **새 증거가 생긴 경우에만** 기존 ID로 후속 판정.
- **필요:** 실가족 인증·권한 서버/API와 실폰/운영·실사진 OCR 증거 미접수, AUTH-GATE BLOCK·safeToRestore:false 유지. 전 기능 출시 승인 아님.
- **변경:** 이번 차분은 **이 문서만 신규 작성**, 제품 index/dev/main·PR80 Draft·CI/워크플로·실자료·배포·광고·예약 변경 **0**. GitHub 원장 기재와 다른 ChatGPT 채팅방의 실제 새 모델 수신은 다른 사건.
