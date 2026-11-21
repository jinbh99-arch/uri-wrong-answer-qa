# 02 WRONG · ACK 불명·가족 A/B 브라우저 격리·첫 경고 200% 증분검증 v1.0

- 일시: 2026-11-21 KST
- 담당: 02 WRONG / **판정: 합성 동적 PARTIAL** / 06 독립 신규 원시검증 **N/T**, 00 후속 최종판정 **N/T**
- 지시: [00 #82 #7051938322](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7051938322), [06 계약 정적 #7053576567](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7053576567)
- 제품 기준 `dev` HEAD `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, `index.html` 원본 blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`, **변경 없음**
- 전회 ACK 중복저장 격리 수정 `index.html` blob `63e31915875a79a2ebcf21d7c722daa9f8deeb98`, 기존 06/00 **4/4 한정 수락 보존**, 중복 CI 재실행 없음
- 이번 QA 브랜치: `qa/wrong-ack-unknown-duplicate-probe-20261121`; 동적 시험 SHA `f42c3abc9ca988997c8a3b1052d9f46bb6c90629`
- 시험 파일 `tests/wrong-ack-native200-first-viewport-and-browser-family-320390.mjs`; 전용 CI `.github/workflows/wrong-ack-native200-first-viewport-320390.yml`; 변경은 이 두 QA 파일 및 이미 인계한 문서만, 제품 코드는 수정하지 않음

## 신규 CI 원시 증거

- 최종 [CI #44849711801](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44849711801), job `136677907986`, attempt 1 **SUCCESS**. CI 성공은 **시험이 정상 수행됐다는 뜻**이며 항목 전체 PASS가 아님.
- [ZIP artifact #14684103318](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44849711801/artifacts/14684103318): **1,325,441 bytes**, SHA256 `8945471a6b5bddcdc7f0a78a12bff2a0de5d8076ee2d64316abcd0566744dd14`, 독자 ZIP 재계산·CRC **PASS**, **PNG 12장 / JSON 1개** 직접 개봉.
- `qa-proof/ack-followup-native200-family-browser/result.json`의 `status=PARTIAL_WARNING_VIEWPORT_OR_AUTH_BLOCK`, `caseCount=2`, `firstViewportAtScroll0Pass=0`, `errors=[]`, `jsErrors=[]`, `externalRequests=[]` 확인.
- 이전 [CI #44849478198](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44849478198) FAIL: 320→390 순서에서 **같은 임시 Chromium 프로필을 재사용한 QA 하네스 오류**(`390 baseline count=1`). 앱 결함 근거 아님. **폭별 새 임시 프로필**로 수정 후 신규 최종 CI PASS; 실패 run과 최종 성공 run 결과 혼동 금지.

## 세부 결과: Chromium 브라우저 기본 Zoom API로 200%

Chrome extension `chrome.tabs.setZoom(tabId,2)` 및 `getZoom()=2`를 확인했다. Playwright/CSS `zoom` 또는 DPR 확대를 브라우저 실제 확대라고 바꾸어 부르지 않는다. 유효 CSS 뷰포트는 320px/390px, 높이 470px.

| 항목 | 320px | 390px | 판정 범위 |
|---|---:|---:|---|
| 브라우저 native zoom | 2.0 | 2.0 | 합성 PASS |
| 첫 Tab→skip link, Enter→main | PASS | PASS | 자연 키보드 진행 |
| 폼 이유 선택→Tab 순서→저장 Enter | PASS | PASS | 합성 PASS |
| 저장 후 ACK 불명 경고 즉시 viewport 표시 | true | true | 합성 PASS, 스크롤 후 |
| 저장 직후 scrollY | 4685.5 | 4068.5 | CSS px |
| 문서 scrollY=0에서 경고 top | 4950.65 | 4333.53 | CSS px |
| scrollY=0 첫 viewport 높이 | 470 | 470 | CSS px |
| **페이지 최상단 첫 viewport에서 경고 표시** | **false** | **false** | **FAIL / 별도 UX 판단** |
| 문서 scrollWidth | 320 | 390 | 가로넘침 0 |
| 합성 오류·외부 요청 | 0 | 0 | PASS |

경고는 `#form-error[role=alert]`로 존재하며, 버튼을 눌러 저장한 직후 **자동 스크롤된 현재 뷰포트에서는 보인다**. 반면 *문서 최상단(`scrollY=0`)* 에서는 큰 폼의 하단에 있어 **보이지 않는다**. 이 차이를 경고가 항상 숨겨진 결함이라고 과장하지 않는다. 처음 화면에서도 항상 확인되어야 하는 요구가 00 계약이라면 위쪽 경고 요약/초점 이동 등 접근성 국소개선 설계가 필요하며, 현재 개선 코드 **미작성**.

## 가상 A/B 브라우저 분리와 실제 가족 인증을 혼동하지 않음

- 두 개의 **서로 다른 Chromium 브라우저 저장공간**으로 합성 A/B 실험: A에 저장된 오답·사진 **1/1**, 완전히 새 B에서는 최초 **0/0**, B에 별도 오답·사진을 저장한 뒤 **B 1/1**, A는 변경 없이 **1/1**.
- A/B 각각 가상 사진 SHA 보존, 아이 모드 실제 진입 후 부모 메모의 body·input·detail DOM 노출 **0**, 사진·UUID 불변, 새 네트워크 요청·JS오류 **0**.
- **같은 브라우저 프로필의 또 다른 탭은 A 기록 1건을 그대로 읽음**. 현재 로컬 시연 앱에는 독립된 가족 로그인/인가가 없고, 테스트용 HTTP Basic 접근문은 가족 인증이 아님. 따라서 **브라우저 컨테이너 격리 PASS ≠ 제품의 가족 A/B 인증 분리**. 제품용 가족 분리 **BLOCK_NOT_IMPLEMENTED**, 실제 가족 계정·클라우드 인증·실운영 데이터 경계 **N/T**.
- 실폰/OS, 스크린리더, 실가족 A/B, 운영 ACK, 다른 탭의 사용자 권한 실패 등은 모두 **N/T**.

## 06 독립검증 요청 / 00 후속 판단

06은 **신규 ZIP 하나만** 직접 다운로드하여 SHA256·CRC·PNG12/JSON1을 확인하고, 각 폭의 CDP/Playwright 첫 뷰포트 원시, 경고 rect와 scrollY(즉시/0)·native zoom API 증거, 키보드 focus, A/B·동일프로필 IndexedDB UUID/사진 SHA, 아이 DOM 0, `node tests/wrong-ack-exact-patch-revert-check.mjs` 역패치 로그·원본 `index.html` blob을 독립 확인한다.

기대 판정은 `PASS(가상 브라우저별 저장공간·동작 직후 경고·키보드·200%) / FAIL(문서 최상단 첫 viewport 경고) / BLOCK(제품 가족 인증 경계 없음) / N/T(실기기·운영)`의 **경계별 PARTIAL**이다. 06 신규 독립판정 전 자체검증을 06 PASS로 기재하지 않는다.

00은 '첫 viewport'를 **제출 직후 현재 스크롤 위치**로 볼지, **문서 상단 0위치**로 볼지를 명시하고, 가족 인증은 현재 독립 저장공간 시연만으로 승인하지 않는다. UI 개선·실제 가족 인증은 **별도 기술·데이터 계약 및 승인 전 제품 이식 금지**.

기존 `safeToRestore:false`, PR80 Draft·미병합, 제품 `dev/main` push BLOCK, 실가족·실사진·운영 DB·SDK·광고·공개배포·예약 변경0. GitHub 인계는 타 담당 ChatGPT 채팅방의 실제 수신/새 agent 응답 증거가 아니다.
