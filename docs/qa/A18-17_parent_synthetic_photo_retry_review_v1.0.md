# 02 WRONG A18-17 학부모 핵심 여정 — 가상 사진·오답 등록→재풀이→학부모 확인·새로고침 v1.0

실행일 2026-11-17 KST · 00 총괄 [#82 #6948556832](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6948556832) 후속. **제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변, PR80 Draft, `safeToRestore:false`. 실가족·실사진·실제 학부모 참여0.**

## 기존 미완료와 실제 차이
A18-16a는 정상/잠금 저장소 접근성·비파괴 경고만 검증했고, **가상 사진을 선택해 사용자 입력 오답 등록→아이 재풀이→부모 확인→새로고침 원본 보존까지의 전체 사용자 경로는 미실행**이었다. 이번에는 선행 A18-11~16a 이미 PASS 경계를 중복 재시험하지 않고 오직 부모 여정의 새 경로만 격리 Chromium으로 실행했다.

## 격리 QA 작업
- 브랜치 `qa/wrong-a18-17-parent-photo-retry-observe-20261117-2210`은 A18-16a QA 검증본의 정적 후속. **`index.html` 소스 수정0**, 고정 Git blob `f3f0d3c2dffce09ed7af613238aa7f8a92708c35`, GitHub Actions `git hash-object` 대조. 전·역패치가 필요한 앱 추가 변경은 없다. 기존 A18-16a 전·역패치 원본 전체 바이트 성공은 별도 [CI #44088929366](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44088929366)에서 완료됨; 이번 CI에서 재실행하지 않았다.
- 신규 `tests/wrong-a18-17-parent-photo-retry-observe.mjs`: 빈 실제 QA 앱 IDB로 시작해 브라우저 내부 Canvas가 생성한 **개인정보 0의 가상 PNG 2,375바이트**를 `#choose-photo`로 선택, `#mistake-form`에 가상 과학 문제와 아이의 틀린 답 입력 및 저장, 실제 `#page-detail` 저장확인, `#wrong002-retry` 클릭으로 `#v230-answer` 초점 확인, 답·설명 `#v230-save` 기록, 이어 `#check-status`·`#check-memo`·`#check-save`로 **부모 관찰 이력 1건** 보관. 그때마다 **동일 앱 IndexedDB**를 직접 읽어 record/Blob/재풀이/부모 관찰 상태와 사진 전체 바이트가 바뀌지 않았는지 확인하고, 앱 새로고침 후 같은 원본을 재조회.
- 신규 `.github/workflows/wrong-a18-17-parent-flow.yml`: 전용 Ubuntu24/Chromium Playwright1.56.1, 320/390, PNG/JSON 제출. 기존 A18-16a CI와 별개의 신규 workflow로 기존 PASS 반복0.
- 삭제·복원·실계정/실DB·OCR 외부 실행·실사용자 이미지 업로드 없음. 외부망 요청 차단.

## 신규 실행 결과

**[GitHub Actions CI #44089831428 SUCCESS](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44089831428)**, job `134061752417`, 증거 artifact [`14331531334`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44089831428/artifacts/14331531334).

| 실사용자 경로 합성 재현 | Chromium 320px | Chromium 390px |
|---|---|---|
| 가상 사진 2,375바이트+과학 오답 1건, 사진 byte-read | PASS | PASS |
| 저장 후 앱 상세 화면 및 등록 확인 | PASS | PASS |
| 재풀이 CTA → 직접 답 입력에 키보드 초점 | PASS | PASS |
| 아이 재풀이 1건 기록, 사진 원본 유지 | PASS | PASS |
| 부모가 관찰 결과 1건 별도 저장, 재풀이 손실 없음 | PASS | PASS |
| 앱 새로고침 후 오답/사진/재풀이/부모 관찰 전체 동일 | PASS | PASS |
| 별도 PNG/JSON 증거 | PNG 3장 | PNG 3장 |

총 **PNG 6장+JSON 1건**, 외부 요청 **0건**, JS 오류 **0건**, 앱 소스 변경 **0건**. CI의 자동화 소요 약 1.97초·1.89초는 빠른 컴퓨터 자동화 시간일 뿐 **실제 학부모가 3분에 사용할 수 있다는 뜻이 아니다.** 3분 실부모·실모바일 조작 측정 **N/T**.

## 관찰한 핵심 장애 1건과 다음 최소작업

- **차단 상태의 부모 동선:** A18-16a 독립 정상/잠금 fixture를 통해 `storageOk=false` 상태에서도 삭제 버튼은 원본 보존을 설명하도록 수정했다. 그러나 **저장소 검사가 실패하면 오답 등록과 재풀이 저장이 의도적으로 차단된다**. 이때 부모에게 ‘안전한 원본 보관→상태 확인→다시 시도’ **완결된 안내 동선**이 어디에 있는지는 기존 정상 상태의 합성 시연만으로 검증되지 않았다. 시스템 안전성 때문에 우회 저장 기능을 만드는 것은 **금지**.
- **선택한 다음 최소 코드 후보:** 저장소 잠금 이유를 오답 등록 첫 화면의 `#v08-no-storage` 및 재풀이 위치에 **동일한 문구로 안내**하고, 기존 읽기전용 원본 보관 UI `#v221-rescue-current`로 안내하는 *내비게이션/링크만* A격리 후보를 검토한다. 기존 원장/사진·권한·운영 설정 변경하지 않는다. 단, 잠금 상태에서 원본 보관 가능성도 미확정이므로 **실제 백업 보장 또는 복구 성공을 약속하지 않는다**.
- 정상 저장소의 **합성 부모 경로는 연결되어 있음**을 확인. 다만 실제 학생 사진·교과 개념의 적절성·실부모 3분 참여·Safari/모바일 카메라·권리·개인정보·운영 서버/배포의 검증은 N/T.

## 최종 판정·다음
**완료:** 신규 부모 핵심 흐름 320/390 실 Chromium 코드/CI/PNG/JSON PASS, 실제 사진 Blob와 오답·이력 보존. **다음:** 00·06에 새 증분 독립검증과 잠금 동선 최소 UX 수정을 제안. **필요:** 실서비스 공개/합병·실부모 자료/원자 복원/배포/예약은 전혀 승인되지 않았음. 사용자 조치 없음.
