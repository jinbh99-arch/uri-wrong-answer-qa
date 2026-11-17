# 02 WRONG A18-20 — 부모 확인 기록 연속 활성화·중복/화면 안내 격리 QA v1.0

- 확인 시각: 2026-11-18 KST
- 공식 근거: [#82 #6953720560](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6953720560), [현재 #87](https://github.com/jinbh99-arch/uri-homework-manager/issues/87)
- 제품 기준: `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` (직접 HEAD 대조, 변경 없음)
- QA 브랜치: `qa/wrong-a18-19-parent-visible-feedback-20261117-2235`; A18-20 테스트·workflow만 추가. `index.html` Git blob `f3f0d3c2dffce09ed7af613238aa7f8a92708c35` 불변.

## 원인 및 새 검증 경계

기존 A18-19는 부모 메모의 정상 단일 저장, 강제 1회 실패 안내, 성공 안내, 재진입을 확인했다. 그러나 **부모 확인 기록 저장 버튼에 짧은 간격으로 두 번 활성화 이벤트가 전달될 경우** 메모 중복·성공과 실패 안내 모순이 없는지는 검증하지 않았다. 따라서 새로운 A18-20은 기존 A18-19 전 구간을 반복하지 않고 위 한 상황에 집중했다.

## 수행·증거

- 새 시험: [`tests/wrong-a18-20-parent-repeat-tap.mjs`](../../tests/wrong-a18-20-parent-repeat-tap.mjs)
- 새 전용 workflow: [`wrong-a18-20-parent-repeat-tap.yml`](../../.github/workflows/wrong-a18-20-parent-repeat-tap.yml)
- [신규 GitHub Actions #44128705455](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44128705455): `completed/success`, job `134199514521`
- [증거 artifact #14347718874](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44128705455/artifacts/14347718874): PNG 4장+결과 JSON 1건, ZIP 1,779,405바이트
- 합성 PNG 2,069바이트·오답 1건을 만든 뒤 같은 부모 확인 버튼에 **동일 브라우저 작업 내 2회 클릭 이벤트**를 발생시켰다. 이것은 실사용자의 터치 속도 측정이 아니라 신속 연속 활성화에 대한 합성 스트레스 시험이다.
- 원시 CI 로그: `A1820_RESULT=PASS_A1820_REPEAT_PARENT_SAVE_SINGLE_OBSERVATION`

| 실제 Chromium 격리 항목 | 320px | 390px |
| --- | --- | --- |
| 연속 2회 이벤트 후 오답 1건·부모 확인 이력 정확히 1건 | PASS | PASS |
| 저장된 메모 본문 상세 화면 표시 | PASS | PASS |
| 최종 사용자 안내가 성공을 나타내고 실패와 모순되지 않음 | PASS | PASS |
| 가상 PNG 원본 2,069바이트 불변 | PASS | PASS |
| 새로고침 후 기록 1건·메모 1건 및 사진 원본 유지 | PASS | PASS |
| 외부 요청·JS `pageerror` | 0건 | 0건 |
| 상속 QA 원본 전·역패치 바이트 일치, 제품 앱 수정 없음 | PASS | PASS |

## 판정·보류

- **판정:** A18-20 신규 격리 Chromium 자체 2/2 PASS. 이 시나리오에서 앱 결함을 재현하지 않았으므로 제품 기능을 근거 없이 수정하지 않았다.
- **06 독립검증:** 이 신규 시험에 대한 독립 판정 대기. 기존 A18-19의 [추가 workflow #44127112336](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44127112336)은 별도로 `completed/success`를 확인했으나 06의 독립 판정과 혼동하지 않는다.
- **미검증:** 실제 물리적 이중탭, 비동기 느린 디스크/실제 다중탭 경합, Safari·VoiceOver·TalkBack, 실제 사용자 3분 동선, 카메라/OCR·실가족, 운영환경. 자동 실행시간은 사람의 사용시간이 아니다.
- **불변:** 제품 `dev/main`·PR #80 Draft, `safeToRestore:false`, 실제 사진·오답/원본 삭제·복원·광고/DB/배포·기존 자동화 변경 없음.
- **다음:** 06에 신규 코드/CI/증거·원복 독립 판정을 요청. 이후 실제 사용자 관점에서 다른 한 미검증 저장 상태/안내 경계를 선택하여 합성 QA로 재현.
