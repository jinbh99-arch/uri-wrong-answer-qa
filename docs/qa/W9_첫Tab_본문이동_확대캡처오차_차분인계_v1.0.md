# 02 WRONG W9 — 실제 200% 탭 확대의 첫 Tab 본문 이동·화면 캡처 오차 차분 검증 v1.0

**2026-11-18 / 02 담당 / 격리 QA 전용.** 이 문서는 [기존 W9 자체 PASS 12/12 #6975842245](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6975842245)를 반복하지 않고 **남아 있던 키보드 바로가기 목적지 검증·캡처 글자 잘림 여부**만 독립 차분으로 검사한다. **신규 CI 결과 확인 전 판정은 진행 중.**

## 1. 선행 사실과 미검증

- 원본 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`. 이전 [CI 44284806565](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44284806565) 자체 PASS 320/390, Chrome MV3 `setZoom(2)/getZoom(2)`, 자연 첫 Tab이 `본문 학습 영역으로 바로가기` 링크에 포커스되는 사실은 확인됨. 하지만 **Enter를 누른 뒤 본문 초점이 실제로 옮겨지는지**와 **화면 글자 잘림이 실제 UI 문제인지 캡처 배율 문제인지**는 직접 판정하지 않았다.
- 원본 Git 코드 직접 검토: `<a class="qa16-skip" href="#qa-main">`, `<main id="qa-main" tabindex="-1">`. CSS에는 링크의 `:focus-visible` 표시가 있고, `.qa16-skip`의 위치·변환 방식은 첫 포커스 때 표시되도록 되어 있다. **정적 링크 존재≠브라우저 Enter 실제 도달/초점 PASS**.
- 이전 원시 PNG는 유효 CSS 폭 320/390의 출력 너비를 가지는데, 실 브라우저 물리 viewport는 640/780이었다. 원시 PNG에서 한국어 글자가 오른쪽으로 잘린 듯 보이는 장면만으로 실제 CSS 가독성 실패를 선언하면 캡처 좌표계나 native-zoom 래스터 배율에 기인한 **거짓 FAIL** 가능성. 반대로 `document.scrollWidth`가 정확하다는 이유만으로 일부 텍스트 클리핑을 무조건 PASS 하면 **거짓 PASS** 가능성. 따라서 CSS 요소·텍스트 glyph의 실제 `Range.getClientRects()`와 화면 폭·화면 캡처 크기를 따로 비교한다.

## 2. 선택한 최소 검증

| 방법 | 확인 가능한 사실 | 한계 |
|---|---|---|
| 이전 PNG만 육안 재사용 | 의심 화면 발생 사실 | 브라우저 물리 viewport vs CSS 캡처 배율 오해 가능 |
| **채택: 네이티브 Chrome 200% + DOM 글리프 영역 + Enter 실제 키보드 동작** | 실제 focus target, hash, 본문 초점, CSS glyph 영역, 캡처 픽셀 크기 차이 | 사람이 보는 OS 브라우저/실휴대폰 글씨 가독성까지 자동 확정 불가 |
| 제품에 CSS 자동 수정 | 시각 현상 격리 전 원인 미확정 | 가상 환경 관측만으로 제품 패치하기 부적절 |

전용 [신규 테스트](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w9-skiplink-zoom200-viewport-20261118/tests/wrong-w9-skiplink-native200-viewport.mjs)와 [workflow](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w9-skiplink-zoom200-viewport-20261118/.github/workflows/wrong-w9-skiplink-native200-viewport.yml)만 현재 dev HEAD에 추가. `index.html` 및 미리보기 서버의 정확한 원본 SHA/바이트 변경 없음. 기존 W9 CI 반복 실행 0.

- 물리 viewport 640/780, `chrome.tabs.setZoom(tabId,2)` / `getZoom=2`, 유효 `innerWidth=320/390`, CSS zoom 공백을 직접 검사.
- 모든 인위적 `.focus()`, 클릭 전에 `page.keyboard.press('Tab')`으로 첫 포커스가 `.qa16-skip`인지 확인. 스킵링크 자체·문구의 기하학적 좌표를 `Range.getClientRects()`로 검사하고 `scrollWidth`도 확인.
- `Enter` 실행 후 URL `#qa-main` 및 `document.activeElement === main#qa-main`의 실제 초점 이동을 직접 검사. 단순 hash 변경만으로 판정하지 않음.
- 각 320/390의 첫 Tab 페이지·바로가기 요소·Enter 후 본문 **PNG 각3장**, 상태 JSON 1개, CSS 요소/범위 좌표와 PNG 캡처 폭·높이를 저장하여 오해 가능성 분리.
- **N/T:** 실제 실폰·Safari·Android 키보드/운영체제 확대, 화면낭독기·Chrome 수동 메뉴 UX, 실제 광고/가족 자료. 시연판 본문 DOM의 `#qa-main` 초점 이동은 실가족 인증이나 영구 저장 안전 보장이 아님.

## 3. 판정 규칙

**PASS:** 두 폭 모두 native zoom=2, 스킵링크 첫 focus가 키보드로 도달·시각 포커스 존재, 링크 텍스트 범위가 CSS viewport 안에 위치, Enter 뒤 본문 실제 초점·해시 일치. **별도 육안 분리:** PNG의 2배 확대 잘림 의심과 CSS Range 결과를 비교해 실제 클리핑인지 캡처 산출물 한계인지 확인; 본문 전체 가독성 N/T 잔존 가능. **FAIL:** Enter 뒤 focus 이동 실패, 링크 CSS 글리프 뷰포트 밖, 수평 넘침 등의 실제 DOM 증거. **N/T:** 원시 캡처/CI 접근 불가, 실폰·스크린리더·브라우저 간 동일성.

**다음:** 신규 CI 결과와 원시 ZIP/PNG/JSON의 SHA/실물 화면을 확인해 이번 문서에 추가하고 #82에 인계. 06 독립 판정은 01 AdSense 보안·00 공개 승인 게이트보다 후순위. 제품 dev/main·PR80 Draft·`safeToRestore:false`·DB·실가족·배포·광고/계정·유료 API·예약 설정 변경 0.
