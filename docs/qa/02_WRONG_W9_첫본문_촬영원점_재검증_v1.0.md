# 02 WRONG W9 — 첫 본문 200% 확대 촬영원점 재검증 v1.0

- 수행: 2026-11-20 KST · 02 담당 · **A격리 합성 QA 전용**
- 총괄 승인: [#82 #7031674279](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7031674279) / [9항목 작업지시](https://github.com/jinbh99-arch/uri-homework-manager/blob/docs/00-work-efficiency-20261120/docs/workorders/00_w9_viewport_qa_followup_20261120_v1.0.md).
- **자체 결론:** 320/390 CSS 폭, native 200% 확대에서 Enter 후 본문 시작은 **CDP 직접 viewport PNG에 실제 표시**됨. 기존 Playwright after PNG의 상단 단색은 **캡처 스크롤 원점 적용 차이**로 확인. 동일 브라우저의 다른 취득 API 결과이며 실제 OS 화면·실폰·스크린리더/실가족/운영은 N/T. **06 독립 판정은 아직 N/T**.

## 1. 원본과 변경 범위

| 항목 | 확정 증거 |
|---|---|
| 제품 dev HEAD 불변 | 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b |
| 앱 index.html blob 불변 | 250aff5b0a46490488b64f7b96a83c940d2d6c71 |
| 선행 QA 기준 | qa/wrong-w9-skiplink-zoom200-viewport-20261118 @ b1a80539bde5cf089570a073da619458a8347148 |
| 신규 QA 브랜치 | qa/wrong-w9-viewport-origin-recapture-20261120 |
| 새 테스트 CI 실행 커밋 | **3c0bb5ab234bd3822660bc7abc1b345ccad39d1e** |
| 신규 변경 파일 2개 | tests/wrong-w9-first-viewport-recapture-320-390.mjs (+216), .github/workflows/wrong-w9-first-viewport-origin-320390.yml (+44). 기존 앱/QA·미리보기 소스 변경 0 |
| CI | [44684867110](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44684867110), job 136116671617 SUCCESS, 기존 성공 CI 재실행 0 |
| 원시 증거 | [ZIP artifact 14605867395](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44684867110/artifacts/14605867395), **1,209,237 B**, SHA256 **e37b2105976e6e8a8bf69ec8c61768a5aad5f3d5f7c408798c0cb0819b2008f4**. 개봉 ZIP CRC PASS. **PNG 8장 + result.json 1개** |

## 2. 같은 브라우저 화면의 두 캡처 API와 CSS·물리 좌표 대조

Chromium chrome.tabs.setZoom(2), getZoom=2. native 물리 viewport 폭=640/780px, CSS innerWidth=320/390px, devicePixelRatio=2, CSS 높이 470px. **첫 Tab→스킵링크→Enter** 실제 키보드 사용, 자동 포커스/스크롤 주입 없음. DOM 첫 글자 범위와 elementFromPoint, CDP Page.getLayoutMetrics를 교차해 원시 CDP viewport screenshot(fromSurface true/false, captureBeyondViewport false)을 직접 저장했음.

| 항목 | 320 CSS px | 390 CSS px |
|---|---:|---:|
| Enter 후 hash / 실제 초점 | #qa-main / main#qa-main | 동일 |
| scrollY (CSS px) | 709 | 647 |
| main viewport top (CSS px) | -0.078125 | -0.171875 |
| 본문 첫 텍스트 y (CSS px) | **22.921875** | **22.828125** |
| elementFromPoint(44, 약 29.9) | 본문 #storage-banner | 본문 #storage-banner |
| CDP cssLayoutViewport.pageY / layoutViewport.pageY | **709 / 1418** | **647 / 1294** |
| Playwright after PNG | 640×940 px | 780×940 px |
| CDP compositor/view 각각 | 640×801 px | 780×801 px |
| Playwright PNG 상단 배경만 있는 행 수 | **709** | **647** |
| 직접 CDP PNG 상단의 실제 본문/학습 UI | **보임(y=0부터)** | **보임(y=0부터)** |
| Playwright 아래 잔여 영역↔CDP 상단 픽셀 | **231행×640=147,840픽셀 전부 일치** | **293행×780=228,540픽셀 전부 일치** |
| CDP compositor↔CDP view | 원시 PNG 바이트 동일 | 원시 PNG 바이트 동일 |
| IndexedDB 각 스토어 레코드 수 before→after | 불변 | 불변 |
| JS 예외 / 외부 요청 | 0 / 0 | 0 / 0 |

**원인 판정:** Playwright viewport PNG 상단 709/647px는 배경만 나오지만, 바로 그 행 다음부터 마지막까지의 **모든 픽셀이 직접 CDP viewport 이미지 첫 231/293행과 동일**하다. native zoom=2의 CDP layout pageY는 CSS pageY의 2배(1418/1294)이다. DOM의 본문 첫 텍스트 y는 ~23 CSS px로 정상이고 elementFromPoint도 본문을 확인한다. 이는 **Playwright screenshot 취득 경로의 스크롤 원점 좌표 착오**를 강하게 입증한다. 같은 조건에서 CDP 첫 viewport에는 사용자가 읽을 수 있는 오답 등록 안내와 본문 카드가 나타나므로 **실제 본문 가림 FAIL로 승격 금지**.

## 3. 실패/미확인과 06 독립 인계 절차

- 임시 확장 chrome.tabs.captureVisibleTab은 permission error(Either '<all_urls>' or 'activeTab' permission is required) 때문에 **취득 실패/N/T**. 성공으로 표기하지 않음. CDP compositor/view는 동일 바이트이므로 독립 렌더러 2개가 아닌 **같은 Chromium의 두 취득 옵션**이며, Playwright와는 별도 호출 경로.
- [신규 CI](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44684867110)의 **실행 SHA**와 앱 blob·2개 QA 신규 파일/원본 역패치를 대조. 위 ZIP SHA·CRC 검증 후 PNG 8·JSON 1개를 실제 열람. 320/390마다 Playwright after의 **상단 배경행 수=scrollY**, 이후 **완전 픽셀 일치**, CDP PNG에 본문 첫 카드 표시를 독립 확인.
- 추가 독립 브라우저·OS 실제 캡처, 실폰·Safari·스크린리더, 실가족/사진, 서버/운영 DB, 제품 반영은 **N/T**. 이 QA 자체 PASS는 배포/제품 승인과 다름.
- **06 인계자료는 생성 완료, 기존 06 ChatGPT 채팅방의 신규 실제 수신·응답은 N/T**. 06은 새 자료만 검증하고 기존 W3/선행 W9 성공 CI는 재실행하지 않는다.
- PR80 Draft, safeToRestore:false, 제품 dev push BLOCK 유지. 실사진·DB·배포·광고·계정·예약 변경 **0**.

### 06용 독립 픽셀 재검증 예시 (CI 재실행 불필요)

아래 파일을 ZIP에서 읽는다: 폭별 *-after-enter-playwright.png, *-after-enter-cdp-compositor.png, result.json. PIL에서 viewport PNG를 scrollY 행만큼 잘라 CDP 이미지 맨 위와 비교한다.

1. 320: Playwright PNG y=709..939 vs CDP PNG y=0..230, RGB **147,840픽셀 모두 동일**.
2. 390: Playwright PNG y=647..939 vs CDP PNG y=0..292, RGB **228,540픽셀 모두 동일**.
3. ZIP result.json의 scenarios.320/.390.after 및 layout.cssLayoutViewport/cssVisualViewport 검증, 실제 cdP PNG 본문 가시와 IndexedDB 변화0 대조.

**최종 상태:** 02 자체 **합성 QA PASS(첫 본문 CDP 노출/Playwright 캡처 좌표 오차)** / 06 독립 **N/T** / 실기기·운영 N/T / 제품 적용 BLOCK.
