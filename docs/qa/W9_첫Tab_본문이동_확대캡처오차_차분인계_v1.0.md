# 02 WRONG W9 — 실제 200% 탭 확대의 첫 Tab 본문 이동·화면 캡처 오차 차분 검증 v1.0

**2026-11-18 / 02 담당 / 격리 QA 전용.** 이 문서는 [기존 W9 자체 PASS 12/12 #6975842245](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6975842245)를 반복하지 않고 **남아 있던 키보드 바로가기 목적지 검증·캡처 글자 잘림 여부**만 독립 차분으로 검사한다. **신규 CI 44289641424 자체 PASS(2/2)·원시 ZIP PNG6/JSON1 직접 대조 완료. 06 독립/실기기 N/T.**

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

**다음:** 아래 완료 증거와 원본앱 SHA를 00/06에 인계하고, AdSense P0 이후 06 차분 독립검증. 06 독립 판정은 01 AdSense 보안·00 공개 승인 게이트보다 후순위. 제품 dev/main·PR80 Draft·`safeToRestore:false`·DB·실가족·배포·광고/계정·유료 API·예약 설정 변경 0.


## 4. 실제 CI·ZIP·문서 기하학 대조 — 02 자체 PASS(2/2)

- [**CI 44289641424**](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44289641424) job `134751202390`: completed/success, **실행 SHA `e412955198b8308c5f0a9a7217a92ac09198e8b6`**. 실행 단계 `W9_SKIP_SOURCE_BYTES_INTACT` PASS, product dev의 `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` + QA 서버 코드 변경 0. 테스트/워크플로 두 파일만 신규 추가. 현 문서 추가 후에도 dev 원본 불변.
- [**원시 artifact 14421072282**](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44289641424/artifacts/14421072282) ZIP **595,070 bytes**, SHA256 **`6b5c1d75b7f9d3eae2299779d8b365f2516ce9ef890ec97e976ec952df894077`**; GitHub artifact digest 동일. **실제 ZIP 개봉:** PNG 6장(폭별 3장)+`result.json` 1개(328,783 bytes, SHA256 `ddc9c0cfad0aa1336f869a892f94f7ecb06cde8d9042104813db895ef31bdf8a`)를 직접 읽어 PNG 서명·해상도·JSON의 DOM 좌표/해시를 대조. 원시 320/390 첫 Tab viewport PNG를 별도 열어 시각 검토했다.
- W9 전용 신코드는 **브라우저 확장 `chrome.tabs.setZoom(2)`**로 실제 내장 탭 확대를 수행했고 `getZoom`을 다시 읽었다. 물리 viewport 640/780, 유효 CSS `innerWidth` 320/390. 인위 `.focus()` 전 `document.activeElement=BODY`, 첫 Tab 뒤 실제 `<a class="qa16-skip">` 포커스, `href="#qa-main"`. 네이티브 `Enter` 뒤 두 폭 모두 `location.hash="#qa-main"`, **`document.activeElement===main#qa-main` = true**, `main.tabIndex=-1`. 단순 URL/hash 변화가 아니라 **본문 초점 이동을 직접 실증**한 것.

| 정량적 원시 항목 | 320 CSS px | 390 CSS px |
|---|---|---|
| Chrome native zoom / CSS zoom | 2.0 / 없음 | 2.0 / 없음 |
| 바로가기 링크 DOM rectangle (CSS px) | left 12, right **258.71** / 폭 246.71 | left 12, right **258.71** / 폭 246.71 |
| 바로가기 텍스트 Range 조각 viewport 초과 | **0개** | **0개** |
| 헤더 제목·소개·배지의 Range 조각 viewport 초과 | **0개** | **0개** |
| 첫 Tab 후 native Enter의 main 실제 초점/해시 | **PASS** / `#qa-main` | **PASS** / `#qa-main` |
| 문서 scrollWidth | 320 | 390 |
| viewport 페이지 PNG 실제 크기 | **640×940 픽셀** | **780×940 픽셀** |
| 스킵링크 요소만 PNG 크기 | 246×50 | 246×50 |
| page JS 오류 / 차단 대상 외부요청 | **0 / 0** | **0 / 0** |
| 실제 휴대전화·실스크린리더·Chrome 수동 메뉴 UI | **N/T** | **N/T** |

**핵심 원인 분리:** 이전 W9 성공 CI가 `fullPage:true`로 생성한 PNG는 **320/390 픽셀 너비**, 브라우저의 물리 viewport는 640/780이었다. 그 이미지만 보면 글자가 오른쪽으로 잘려 실제 UI가 결함인 듯 보였다. 이번 **native 탭 확대 조건의 viewport 캡처 `fullPage:false,scale:'css'`는 640/780 픽셀 너비**로 출력됐고, 동일한 첫 Tab 상태에서 전면의 스킵링크와 제목·설명 글자가 온전히 표시됐다. 동시에 DOM 텍스트의 실제 CSS Range 좌표도 320/390 너비 안에 있었다. 따라서 **검사한 링크·제목·설명에서 실제 CSS 영역 밖 글리프 노출 결함을 확인할 수 없었고**, **이전 잘림 의심은 특정 Playwright fullPage screenshot 출력 좌표계의 불일치로 설명되는 게 유력**하다. 이것을 모든 200% 브라우저·휴대폰의 전체 글자 가독성 보증으로 승격할 수는 없다.

**시각 표본 PNG 해시:**
- `320-firsttab-page-viewport.png` 640×940, SHA256 `38314565e846ca4203ea87143c32cd7426d3020940249149cb7c1da9b5192c46`.
- `390-firsttab-page-viewport.png` 780×940, SHA256 `8f667d45ce471a2300574039181d8fd27e8071ca2e738d766e4d7256e6c18e1f`.
- `320-after-skip-enter.png` SHA256 `52276a84ba52299455318893b1d37aa30ea310f44d87e93afd3e68f4f3788037`.

**증거 수준/후속:** 02의 새 범위 **격리 Chromium 자체 PASS 2/2**. [이전 W9 native200 저장 안전 PASS 12/12](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44284806565)와 이번 2/2는 **서로 다른 시험**이며 기존 성공 CI 재실행 0. 실폰·화면낭독기·실데이터/가족 인증 및 06 독립 판정 N/T. **01 AdSense URL 비저장 C안의 00 P0를 우선**, 02 W9는 후행 독립 QA 요청. 제품 dev/main·PR병합·배포·광고/실자료·유료 도구/예약 변경 0.
