# 06 독립검증 · WRONG W3 부모 경고 토스트 3,650ms 시간경계 v1.1

**2026-11-20 KST · 담당: 기존 06 독립검증방 · 판정: 신규 격리 QA 원시·코드 차분 PASS / 제품 dev push BLOCK / 실기기·실자료·A/B 가족분리 N/T.**

## 0. 작업선정·중복 방지
- #82 최신 00 [#7030457718](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7030457718)과 #87 최신 커서 대조: 06은 01/02 **신규 원시 증거 준비된 1건**만 독립 검증. 03 H7-19 전체 시각 BLOCK 종료·재시험 금지.
- 01 LEVEL q 인벤토리 브랜치 HEAD `7616f860123d01519437baf337af67189059e1ef`는 기존 06 [#7029910179](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7029910179) 이후 신규 커밋/CI 없음 → NO-OP.
- 02 WRONG의 이전 06 [#7025598972](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7025598972) 발견사항: 첫 전환 후 3,650ms 검사는 있지만 **마지막 빠른 전환 후 100ms만 관찰**, 남은 3,400ms 타이머의 재노출 위험 미검증.
- 새 실행 SHA40 `4d85151ec8fb290d9196376ee5ba916c79a7cfcb`, 브랜치 `qa/wrong-w3-toast-timeout-boundary-20261120`; 최초 결함 SHA `75c7cc06466d8ac2bfc97f5575295dacc86dca1c`. 기존 CI 재실행0.

## 1. 신규 CI·아티팩트 실물 무결성
- [Actions CI #44647190787](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44647190787), job `135992660990`: `completed/success`, HEAD 정확히 `4d85151ec8fb290d9196376ee5ba916c79a7cfcb`. 기존 CI #44637181739 반복 없음.
- [artifact ZIP #14589002112](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44647190787/artifacts/14589002112) **791,614 bytes** 직접 다운로드/개봉. 전체 SHA256 `849442aa70c0e2ecfdc165e6be8c350e08175cf4cf09f709d4d4f4c68394425f` = GitHub Actions digest 정확 일치. `ZipFile.testzip()=None` → **CRC PASS**.
- 원시 목록 **320·390 각 parent-warning/child-cleared/rapid-child-clean PNG 3장 = 6 PNG, result.json 1건**. RGB 색상 각각 약 1만~1.3만 종, 정색화면 없음. 원본 각 폭 **320×800, 390×850**, 이미지 직접 육안 판독: 부모 경고 부유토스트가 보이다 아이 화면에서는 사라짐.
- `result.json`: `status=PASS_W3_TEMPORAL_BOUNDARY`, `checks=10`, `widths.320/390.status=PASS`, `originalTimeoutMs=3400`, `observedAfterMs=3650`, **`rapidFinalObservedAfterMs=3650` 양쪽 모두 존재**, `pageErrors=[]`, `externalRequests=[]`, `productionMutation=false`, `realFamilyAuth=false`, `realDevice=false`, `safeToRestore=false`. 실제 GitHub CI 로그 W3_TIMEOUT_PASS **각 폭 5건, 총 10건** 및 최종 사진 수 6장과 일치.
- 독립 PNG 픽셀 차분: 일반 child-cleared↔3,650ms 후 rapid-child-clean 이미지에서 차이는 **320px 41픽셀, 390px 8픽셀**에 한정(메시지/모드 재노출 차이 없음). 사진에는 시간을 직접 인코딩하지 않으므로 **타이밍은 테스트 소스 실행 순서+CI 로그+JSON 결합 증거**, 정지화면만의 단독 증명은 아님.

## 2. 소스 SHA·최소 diff·원복
- **제품 dev HEAD** `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`; dev `index.html` Git blob `250aff5b0a46490488b64f7b96a83c940d2d6c71`. QA candidate `index.html` blob `6ff6cf1c2cfeef3706381a68fc105feab8258b04`. 5,578줄 원본이 5,582줄 후보의 **순서와 내용 그대로 전체 포함**, 정확히 **4줄만 추가/삭제0**. 후미 삽입 없이 해당 4줄 제거 시 dev 원본 문자열·blob 1:1 재현.
- 승인 +4줄은 `v218ApplyMode('child')`에서 세 미저장 차단 조건 **뒤**, 허용 전환이 확정된 경우에만 실행: `clearTimeout(toastTimer)`, `toast.textContent=''`, `toast.classList.add('hide')` + 설명 주석. 기존 차단 경고 자체를 삭제하지 않음.
- 이번 **신규 변경은 테스트 한 파일만 `+7/-1`**: `tests/wrong-w3-toast-timeout-rapid-mode-320-390.mjs` (blob `2797d2e310a6b924369524b6ea71c2d51e17ac4b`). **최종 빠른 전환 후 별도 3,650ms 대기** 및 토스트 텍스트·표시 여부·아이 `aria-pressed=true` 재검사, `rapidFinalObservedAfterMs` 기록. 앱 HTML/JS·원장/서버·CI 워크플로를 바꾸지 않음.
- `startWrongQa66Preview` 로컬 미리보기 소스 blob `57750b971342b8ccc15213cd57892880b3cf3661`, `HOST=127.0.0.1`, 임시 인증·합성 저장 공간만 사용. PR #80 **Draft/open, merged=false**, 제품 dev HEAD 변동 없음. 06이 제품·PR·배포·예약을 변경하지 않음.

## 3. 기능·화면·안전 검증 범위

| 증거/검증 조건 | 320px | 390px | 06 판정 |
|---|---|---|---|
| 부모 mode에서 실제 in-closure 토스트 문자열·보이기 | 원시 PNG/CI | 원시 PNG/CI | **격리 PASS** |
| 아이 전환 즉시 텍스트 공백/숨김 | PNG+assert | PNG+assert | **격리 PASS** |
| 첫 전환 후 기존 3.4초를 지난 3,650ms | JSON+CI | JSON+CI | **격리 PASS** |
| 빠른 부모↔아이 최종 전환 이후 **또 3,650ms** | 추가 assert+CI | 추가 assert+CI | **신규 결함 보정 PASS** |
| 키보드 접근성 의미 있는 값 | 아이 버튼 aria-pressed 검증 | 동일 | **일부 PASS**, Tab/스크린리더 N/T |
| 화면 320/390, 토스트/아이화면 시각 | PNG 각 3 | PNG 각 3 | **지정 6개 장면 PASS** |
| IndexedDB `mistakes/photos` | 0→0 | 0→0 | **합성 일회성 원장 불변 PASS** |
| 페이지 JS 오류/외부요청 | 0/0 | 0/0 | **격리 PASS** |
| 실제 사진첨부·저장·OCR·지연 비동기 알림 | 미사용 | 미사용 | **N/T** |
| 가족 A/B 서로 다른 ID·비공유 원장 | 단일 임시 context만 사용 | 별도 context지만 가족 고유ID/분리검증 없음 | **N/T** |
| 실기기 iOS/Android·실인증/운영데이터·독립 로컬 Chromium 재실행 | 미실행 | 미실행 | **N/T** |
| 기존 미저장 오답/부모메모/재확인 질문 3종 회귀 | 구 06 #7006256046 근거 재사용 | 동일 | **이전 PASS 유지, 이번 신규 재시험 N/T** |

**중요한 경계:** QA는 숨겨진 `remove-photo` 버튼에 synthetic `.click()` 이벤트를 보내 **실제 클로저 내부 `notify()` 3,400ms 타이머**를 실행했다. 사진을 실제 선택/제거하지 않았으며, 실패/복구를 통한 진짜 파일 처리 파이프라인은 검증하지 않음. 3650ms는 타이머 만료 250ms 뒤로, 짧은 왕복 이후 알림 **재노출 부재**만 검증한다. 내부 타이머 취소 여부는 위 앱 코드의 `clearTimeout()` 정적 근거와 합쳐 제한 해석.

## 4. 최종 독립 판정, 남은 위험, 00 인계
- **DECISION=PASS (신규 3.4초 토스트·빠른 왕복 320/390 합성 QA의 원시 증거 계약 한정)**. 한 회차에서 파일·SHA/CI/코드/변경/사진/JSON/로그/안전/원복 대조 완료. 이전 정적 검증의 마지막 100ms 결함은 이번 후보에서 **3,650ms 검증**으로 해소.
- **BLOCK 유지:** 08의 외부 자동배포 전 채널 비연동 `N/T` → **제품 dev push 금지**, PR80 Draft, 실자료 복원 `safeToRestore:false`. 이 합성 테스트의 PASS는 운영 승인이나 사용자 안전보증이 아님. H7-19 별건 전체 시각 BLOCK, 01 AdSense 구형 최초 GET 공개 HOLD_BLOCK 유지.
- **NEXT=READY_FOR_00**: 00은 이 신규 시간경계 독립 PASS를 **A격리 QA로만 수락**하고, 08의 배포비연동·실기기·실파일/가족분리 증거 없이는 제품 반영 승격/PR 병합/배포를 승인하지 말 것. 추가 코드 변경·CI 반복 0. 실패 시 재개 조건은 *새 제품·테스트 SHA 및 실제 신규 원시 ZIP + 적시 영향분*.
