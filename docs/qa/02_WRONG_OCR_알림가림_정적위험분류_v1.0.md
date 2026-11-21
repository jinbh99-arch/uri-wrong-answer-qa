# 02 WRONG — OCR 임시 사진 알림·하단 저장 CTA 가림 정적 위험 분류 v1.0

2026-11-21 KST · 00 [#82 #7063355475](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063355475)의 **실제 OCR 신규 원시에서 토스트가 화면 하단 일부를 가린 현상** 정적 분석. 06 관찰 [#7063317009](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063317009) / OCR ZIP#14708207083·CI44907635062 / 06 신규 시험 한정 [#7063285718](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063285718). **새 CI·브라우저 실행·PNG 가림픽셀 직접 독자 계산은 이번에 하지 않음.** QA 동일기록 지연 OCR PASS≠핵심 화면 전체 PASS.

## 1. 실제 제품 구조의 정적 위치·레이어 사실

기준: dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`, `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`.

| 요소 | 소스 | 실제 코드상 지정 | 판단 |
|---|---|---|---|
| 임시 toast | `index.html:10` | `#toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 16px;max-width:90%;z-index:10}` | 화면 하단에 오버레이, 사용자 입력을 가리는 것 자체를 방지하는 CSS 없음 |
| 알림 시간 | `:564` | `notify()`가 토스트를 보이고 **3,400ms** 뒤 hide. 중간 새 알림은 기존 타이머 clear | 일시적이지만 3.4초는 사용자가 저장 버튼 누를 수 있는 구간 |
| 알림 생성 트리거 | `:1290` | 사진 선택 성공시 `notify('사진이 선택됐습니다...')` | OCR 합성 테스트도 사진 선택 포함. 실제 OCR 결과 알림 `:1861`도 toast 호출 |
| 바닥 저장판 | `:53-55` | `.v08-sticky-save{position:fixed;bottom:0;left:0;right:0;z-index:9;padding:9px ... calc(9px + safe-area-bottom)}` / 버튼 min-height49px | toast **z10이 저장판 z9보다 앞**, 두 영역은 같은 viewport 하단 |
| 저장 버튼 | `:545` | `#v08-floating-save` `💾 이 오답 저장` | 핵심 저장 CTA의 실제 DOM 확인 |
| 저장판 노출 조건 | `:876` | `next==='add'`일 때 sticky `hide` 제거 | 부모 수정·OCR 처리 시 노출되는 구조 |
| 알림 DOM | `:547` | `#toast.hide` role=status | 시각적 겹침 가능성 별개로 메시지 접근성·포커스 가림 검증 필요 |

**정적 세로 교차 추론:** 기본 안전영역 0에서 저장판 최소 높이는 버튼 **49px + 위/아래 padding 최소 9+9px + border 1px = 약 68px 이상**(실제 폰트/줄바꿈/안전영역에 따라 증가). 토스트의 bottom은 24px이므로, 저장판의 상단이 viewport bottom−68px 이하일 때 토스트가 차지하는 bottom−24px 위 영역과 **서로 겹칠 수 있다**. 토스트 실제 높이·폭·저장버튼 x 좌표는 메시지 줄바꿈·폰트·기기별 레이아웃이 달라 정적 수치로 확정 불가. **토스트가 CTA를 완전히 덮거나 탭을 빼앗았다는 실증은 아직 없음.**

## 2. 320/390 정적 위험 분류 — 확정과 N/T 분리

| 화면 | 정적 위험 | 기존 증거 | 아직 모르는 것 | 임시 등급 |
|---|---|---|---|---|
| 320px 부모 등록/수정 | toast 중앙 폭 최대 90%, CTA 오른쪽 flex, toast 우선 z-index. 세로 겹침 가능 | 06 OCR PNG가 화면 하단 일부 가림 관찰 | 실제 toast∩CTA 사각형 `px²`, 저장 버튼 중앙점/전체 hit-test, 포커스/Tab, 특정 toast 문구 줄바꿈 | **P0 위험 후보·미확정** |
| 390px 부모 등록/수정 | 동일 CSS, 저장판 높이/CTA 위치는 390px 폭에 따라 변동 | 06 OCR PNG가 하단 일부 가림 관찰 | 390px toast/CTA 실제 좌표, 최소 확대/키보드 겹침, 핵심 경고 숨김 여부 | **P0 위험 후보·미확정** |
| Child/기록 목록 | `:876` add 외 sticky 숨김 | 특정 add 외 경로의 저장판 충돌 소스상 일반화 불가 | 하단 toast가 다른 핵심 CTA/중요 alert 가리는지 | **별도 N/T** |
| native200·실폰 | CSS 확대/뷰포트 달라짐, safe-area 변수 변동 | VIS CI44907598970의 CDP 비교 원시는 **scrollY가 320=4926.5/390=4224.5**인 화면 | 첫 viewport/실폰·키보드·가상키보드 결합 가림 면적, Playwright 즉시 단색 FAIL 원인 | **VIS-FIX FAIL 유지** |

**잠정 우선순위 정책(00 #7063355475 준수):**
- **P0 결함 확정 조건:** 경고/저장/중복 차단 등 안전 관련 CTA의 실제 클릭·키보드 조작이 toast 때문에 불가능하거나 가려진 상태로 잘못된 저장/중복/유실로 이어지는 **실측·재현 증거**.
- **P1 조건:** 핵심 CTA와 경고·포커스 불가 없이 비핵심 하단 안내만 일시적으로 가리고, 사용자가 정상 조작 가능한 **실측 증거**.
- **지금 결론:** **`OVERLAP_POSSIBLE_STATIC / P0_RISK_CANDIDATE / P0_P1_NOT_DETERMINED`**. 코드상 겹침 가능성과 원시 화면 일부 가림을 구별하고, **P0 확정/수정 완료/기존 VIS 해제 선언 0**.

## 3. 06에 요청할 추가 읽기전용 대조 (CI/제품 변경 승인 아님)

기존 새 ZIP#14708207083 PNG 320/390만 재사용하고 **기수락 OCR 테스트 재실행0**. 06 또는 담당의 이미지/DOM 소스 독립 판독 시 다음 7개를 분리 보고할 것:

1. 각 PNG에서 toast 실측 bounding rect x/y/w/h와 하단 CTA 실제 버튼 rect 또는 **해당 프레임에서는 좌표 재구성이 불가능함(N/T)**.
2. `toast∩#v08-floating-save` pixel²과 **toast∩sticky 전체** pixel² 구분(버튼 가림과 배경 패널 가림은 다름).
3. 저장 폼 `#form-error`(role alert)·기존 사진 미확인 경고·OCR 미확인 표시와 겹침 여부.
4. 실제 키보드 Tab/ShiftTab/Enter, `document.elementFromPoint` 버튼 중앙점 hit-test는 **기존 PNG만으로 측정 불가=N/T**. 필요한 신규 동적 시험은 **00 승인 후**.
5. toast 문구/발생시점(`:1290` 사진선택 vs `:1861` OCR 적용), 가림 지속 3400ms, screenshot 타임스탬프·route=add 여부 구별.
6. 320/390에서 200% 확대·safe-area·가상키보드 상태는 기존 OCR ZIP 범위 밖이면 N/T 유지.
7. 실제 UX 문제를 수정하려면 **00 별도 코드 범위·QA 승인** 필요; 이번 판정만으로 CSS 배포/숨김 처리 변경 금지.

## 4. 개선 대안 비교(미실행)

| 옵션 | 의도 | 위험 | 판정 |
|---|---|---|---|
| A. toast를 sticky 위로 높여 표시 | 핵심 저장 버튼 비가림 | 실제 sticky 동적 높이·safe area 계산 필요, 상단 경고 가림 가능 | 실측 후 **후보** |
| B. toast 자체를 등록폼의 비고정 role=status로 이동 | 고정 CTA 겹침 제거 가능 | 폼 길이/스크롤/첫 화면 인지성 악화, ARIA 알림 동선 변경 | 실측 후 **후보** |
| C. 현상 유지·문구 단축 | 구현 범위 최소화 | 안전 버튼 가림이 실제면 P0 위험을 해결하지 못함 | 핵심 CTA hit-test 확인 전 수용 금지 |

**결론:** 정적 원인은 **두 하단 fixed 요소가 z10/z9로 같은 공간을 점유할 수 있는 구조**. 이미지상 가림이 버튼 클릭·포커스 실패로 연결되는지 아직 모름. 우선 신규 실행 없이 06의 **기존 원시만** 좌표/가림 대조 → 00 P0/P1 판단 → 승인 시 별도 국소 검증/제품 수정.

`AUTH-GATE BLOCK`, `VIS-FIX FAIL`, `safeToRestore:false`, PR80 Draft/dev/main/예약/실자료/운영 변경0.
