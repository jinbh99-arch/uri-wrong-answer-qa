# 02 WRONG 5단계 — 같은 기록의 늦은 OCR 신규경계 QA 준비 v1.0

작성 2026-11-21 KST. 기존 W03 ID 재사용. 검증 상태: 코드/명세 작성, 실행 및 06 판정 N/T.

## 기준과 재사용
- dev SHA 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b, index blob 250aff5b0a46490488b64f7b96a83c940d2d6c71 불변.
- W03 CI44883435344 / 06 #7060240364 / 00 #7060462054 합성 제한수락 유지. QA84 다른 기록 간 지연 응답 기존 증거 재사용.
- 기존 docs/qa/02_P0_5_늦은OCR_신규경계만_v1.0.md의 L01·L02 중 같은 기록의 미검증 부분만 대상.

## 독립 원시 소스분석
- dev index.html 1822~1845행: ocrBusy, activeImageRevision, photo/crop revision 및 route 가드. 완료 OCR은 preview에만 반영.
- 1847~1877행: 부모 직접 수정/명시적 적용/재확인 흐름. 설계가 있어도 실제 동시성 시험 PASS로 단정할 수 없음.

## 이번 신규 테스트 파일 (CI 실행 전 단계)
tests/wrong-p0-stage5-same-record-late-ocr-20261121.mjs. 320/390 별도 임시 브라우저, 합성 1px 사진, 가짜 OCR worker, 외부요청 차단.
1. 기존 한 건의 UUID/사진·원장 기준선 저장.
2. 동일 기록의 OCR1 대기 중 부모가 문제를 고침. 사진 OCR 전용 회전을 변경하고 늦은 OCR1 결과를 도착시켜 이전 결과 폐기/부모 입력 보존을 검사.
3. OCR1 종료 후 OCR2 결과는 미리보기 후보에만 위치하고 문제란이나 부모 확인 상태를 자동 변경하지 않아야 함. 동시 OCR1/2 역순 시나리오는 이번 테스트에 포함되지 않음.
4. 저장 없이 취소→아이 표시: OCR 후보/부모 수정 초안·캔버스·사진 input 잔여0, IDB 원장·사진 불변. 외부 요청 및 JS 오류0.
5. 실행되는 경우 PNG 320/390 각1, JSON1 기록. 아직 실제 실행하지 않았으므로 PASS나 생성 파일을 주장하지 않음.

## 승인 경계 및 다음
- 추가된 파일은 QA 전용 시험 소스+문서 2개. 전용 workflow 신설0, CI 실행0, 제품 코드/PR80/dev/main 변경0.
- 00이 새 CI 또는 실제 실행 범위를 승인한 다음에만 실행. 실패 시 원시 보존·반복 금지. 신규 ZIP/JSON/코드·원본 역패치를 06이 독립판정 후 00이 단계5 한정 판정.
- 실제 OCR/실가족 인증/실폰·운영 N/T. AUTH-GATE BLOCK, VIS 즉시 Playwright PNG FAIL, safeToRestore:false, 7/8 HOLD 유지.
