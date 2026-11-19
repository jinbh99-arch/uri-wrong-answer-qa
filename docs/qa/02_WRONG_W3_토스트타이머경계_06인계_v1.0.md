# 02 WRONG W3 토스트 타이머 경계 — 격리 QA/06 인계 v1.0

작업일: 2026-11-20 KST
성격: 신규 합성 시간경계 1건. 운영/제품/실가족 자료 변경 없음.

## 근거 및 시험 목적
- 00 승인: https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6980621371
- 기존 06 독립검증: https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7006256046 (W3 즉시 토스트 제거/미저장 3가드 10/10 격리 PASS)
- 08 dev 배포연결 게이트: https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7006604511 (외부 자동배포 비연동 N/T, dev push BLOCK)
- 기존 검증에서 별도 측정하지 않았던 **3.4초 타이머 만료 후 부모 알림 재노출** 및 **빠른 부모/아이 전환** 두 시간경계만 신규 시험. 기존 10/10 반복 아님.

## 코드와 보호 불변
- dev HEAD: 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b
- dev index blob: 250aff5b0a46490488b64f7b96a83c940d2d6c71
- 기존 W3 QA index blob: 6ff6cf1c2cfeef3706381a68fc105feab8258b04 (제품 대비 +4/-0)
- 격리 브랜치: qa/wrong-w3-toast-timeout-boundary-20261120
- 시험 실행 SHA: 2c135fa6c95ee0e7e84197263876d06c80456fd8
- 신규 test: tests/wrong-w3-toast-timeout-rapid-mode-320-390.mjs
- 신규 workflow: .github/workflows/wrong-w3-toast-timeout-320390.yml
- index.html, dev, main, PR80, 저장원장/사진, 인증, 광고, 예약은 수정하지 않음.

## 320px/390px 신규 검증 계약
각 폭에서 ① 합성 부모 알림 가시 → ② 아이 전환 즉시 텍스트·가시성 제거 → ③ 3650ms 이후에도 미노출(원본 토스트 타이머는 3400ms) → ④ 빠른 왕복 3회 재노출 없음 → ⑤ 일회성 IndexedDB 오답·사진 0→0 불변. 총 10 체크, 화면 PNG 최대 6장 + JSON 1개 목표, JS 오류/외부요청 0 요구. 루프백 127.0.0.1 인증, 외부 요청 차단, 실사진 0.

**시험 한계:** 부모 알림은 QA에서 실제 notify() 함수에 합성 문자열을 주입한다. 실제 버튼 전체 사용자 여정이나 지연된 비동기 저장 작업에서의 토스트 방출까지 실증하지 않는다.

## 실제 1차 실패와 수정
- 최초 CI https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44636194747 **FAIL**. 사진 미선택 시 숨겨진 remove-photo 버튼을 클릭한 **테스트 준비 오류**; 30초 UI 타임아웃. 제품 실패 증거 아님. 원본/index 핀 검사는 통과.
- 수정 범위: 테스트 파일만; 숨겨진 버튼 클릭을 합성 notify() 함수 호출로 대체. workflow 및 앱 소스 불변. 테스트 재검증용 신규 SHA 2c135fa6c95ee0e7e84197263876d06c80456fd8.
- 신규 CI https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44636474051 **작성 시 실행 중**. 앱 소스 핀 검사 PASS, Chromium 320/390 결과·원시 PNG/JSON·CRC·06 독립 검증 아직 N/T. 실제 결과 확인 전 PASS로 승격 금지.

## 다음/보호
CI 완료 시 06은 신규 3.4초 시간경계·반복 전환·원장/사진·화면 및 원시 결과만 독립 대조. 실폰·실인증·운영 N/T. PR80 Draft, safeToRestore:false, dev push BLOCK 유지. 자동배포 전 채널 비연동 검증 및 00 별도 판단 없이는 제품 반영 금지. 신규방 GitHub 열람과 00 인수 승인/예약 연결은 별도다.
