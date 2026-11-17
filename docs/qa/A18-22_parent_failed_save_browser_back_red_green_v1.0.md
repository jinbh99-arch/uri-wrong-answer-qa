# 02 WRONG A18-22 — 부모 저장실패→브라우저 뒤로가기 원고 보호 RED→GREEN v1.0

- 기준: 2026-11-18 KST. [00 최신 #82 지시 #6955255527](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6955255527), [02 #87 실행 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87).
- 제품 `dev` SHA40: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` **직접 조회 불변**. PR #80 Draft, `safeToRestore:false`. A18-21 완료 QA 브랜치 `qa/wrong-a18-21-parent-draft-nav-20261118@db24ce47157ddfb310c6b544ea6d4cdf3bb0a76a` 불변.
- 격리 작업 브랜치: `qa/wrong-a18-22-parent-back-20261118`, 제품/운영·배포·실인증·사진·가족데이터와 별개.
- 합성 사진 2,099바이트, 가상의 문제·오답·부모 메모, 브라우저 320/390px.

## 1. 원인 분석 / 실제 RED

A18-21은 앱 메뉴/목록 클릭으로 작성 중인 학부모 메모가 없어지는 문제를 보호하지만, 전체 브라우저에서 뒤로가기를 누르는 경우에는 클릭 가드가 실행되지 않는다. 기존 앱 `index.html`에는 `beforeunload`/history popstate 가드가 없다. 두 개의 동일 출처 문서 이동 이력을 만든 후 앱 화면에서 메모를 작성하고, **합성 IndexedDB 첫 쓰기 실패 1회**를 발생시킨 뒤 브라우저 `history.back()`을 호출했다.

- [RED CI #44137806914](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44137806914): `completed/failure`(의도된 신규 결함 재현). **320px** nativeDialogs 0, stayed false, draftVisible false, draftExact false. 원장/사진 불변 true, 외부요청/JS 오류 0. [PNG2 + JSON1 artifact #14353031980](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44137806914/artifacts/14353031980).
- 이 RED는 **실부모/운영 데이터 손실 사고 증거가 아니라 합성 격리 환경에서 발견한 사용자경험 결함**이다.

## 2. 대안 검토 / 국소 수정

| 방안 | 보완 범위 | 판단 |
|---|---|---|
| 브라우저 닫힘 직전 자동저장 | DB 구조·비동기 쓰기/복원, 보안/신뢰성 영향 | A범위 확대, 보류 |
| app 내부 URL history 구조 재설계 | 내비게이션 전역/뒤로가기 전체 수정 | 회귀 위험, 보류 |
| **기본 브라우저의 이탈 확인 사용** | 상세 화면에 저장하지 않은 부모 메모 텍스트가 있을 때만 `beforeunload`에서 `preventDefault` + `returnValue=''` | 현재 문제에 가장 작은 국소 수정, 선택 |

실행 코드: [`index.html`](../../index.html)의 내비게이션 클릭 이벤트 직전에 **6줄 삽입**. 웹 표준 브라우저 기본 안내를 사용하므로 문구를 임의로 바꾸거나 정확한 Korean 경고를 보장하지 않는다. [패치 생성/원복 `qa/a18_22_parent_browser_back_patch.py`](../../qa/a18_22_parent_browser_back_patch.py)의 전·역패치 바이트 일치 확인. 저장소, 사진, 백업, 삭제, 운영인증, 배포 코드는 수정하지 않음.

## 3. 수정 후 실제 GREEN

- [최종 CI #44138438965](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44138438965), 실행 커밋 `26f8613e90dae38c0f95fb85cc8a9a0f2fef9279`, job `134234298721`: **completed/success**.
- `A1822_RESULT=PASS_A1822_BROWSER_BACK_UNSAVED_DRAFT_GUARD`
- `A1822_ISOLATED_FORWARD_REVERSE_BYTES_PASS` · `A1822_FULL_QA_INHERITANCE_REVERSE_BYTES_PASS`
- [PNG 8장 + JSON 1개 artifact #14354170347](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44138438965/artifacts/14354170347), 업로드 2,700,985바이트.

| 실제 Chromium 합성 검증 | 320px | 390px |
|---|---|---|
| 메모 저장 실패 후 브라우저 뒤로가기 → native beforeunload 대화상자 발생 | PASS | PASS |
| 대화상자에서 ‘머무르기’ 시 현재 주소/상세화면 유지 | PASS | PASS |
| 입력한 부모 메모 본문 정확히 보존 | PASS | PASS |
| 오답·사진 원본 바이트 불변(합성 PNG 2,099B) | PASS | PASS |
| 정상 재저장 뒤 브라우저 뒤로가기 허용·기록 1건 유지 | PASS | PASS |
| 외부 요청·페이지 자바스크립트 오류 | 0 / 0 | 0 / 0 |

**테스트 이력 구분:** 첫 QA 패치 검증 [CI #44138070082](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44138070082)는 메모 보호·브라우저 대화상자·원장 불변을 확인했지만, 재진입 후 특정 `#storage-state` 문구에 의존하는 테스트가 브라우저 BFCache 문서 복원과 맞지 않아 `waitForFunction` 시간 초과로 실패했다. 제품 결함 여부와 구분하고, 실제 IndexedDB 바이트를 검증하도록 테스트만 조정한 뒤 최종 CI 성공을 확인했다. 이전 FAILED CI를 GREEN으로 소급하지 않음.

## 4. 범위/남은 위험/06 인계

- 이번 PASS는 **자동화된 진짜 Chromium의 history.back() 호출 및 합성 자료** 기준이다. 스마트폰 물리 뒤로가기, Safari, 모바일 백그라운드 종료·브라우저 강제 종료, 사용자가 '나가기'를 승인했을 때의 데이터 소실, 브라우저가 이탈 경고를 무시하는 환경에는 적용되지 않을 수 있다. `beforeunload`은 신뢰할 수 있는 자동저장 수단이 아니다.
- 정확히 측정하지 않은 것: 실제 학부모 3분 동선, 가족 계정, 실제 사진·OCR, 2탭 동시 쓰기, 아이 개인정보, 운영 DB, 복원/삭제, 06 독립검증 및 서비스 배포.
- **판정:** A단계 격리 합성 브라우저 RED→GREEN 자체 PASS, 06 독립판정 **N/T/대기**. **실제품 서비스 반영 없음.**
- 06: `index.html`의 6줄 diff, RED/중간불완료/GREEN 3개 CI 원시 로그, JSON·PNG 원본, 원장/사진 불변, `apply22` 및 `apply21`/상위 `apply16a` 단계별 정확 역패치를 독립 대조 요청. 일반 모바일 브라우저 이탈 경고 비보장 한계를 PASS에 포함하지 말 것.
- 다음 A격리 후보: **부모 메모는 비었지만 확인 상태만 변경한 경우**의 이동 시 오해/미저장 상태 보호. 00 우선순위와 06 추가 판정 확인 후 신규 경계로 처리.
