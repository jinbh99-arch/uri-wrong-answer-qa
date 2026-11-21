# 02 WRONG — W03 OCR 부모 교정값 저장·재열람 원시 인계 v1.0

- 2026-11-21 KST. ID: 00T-02-W03-EDIT-PERSIST. 담당: 02 WRONG.
- 00의 A4 P0 격리 작업승인: [#82 #7059677693](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7059677693). 40 디자인 계약 [WR-02/03](https://github.com/jinbh99-arch/uri-homework-manager/blob/docs/ui-d0-developer-handoff-v10-20261121/문서/디자인인계/40_웹앱_디자인_개발인계_v1.0.md) blob e589da67f5ce8b1ef1a871b6d2a5e7e37dd9b9eb.
- 현행 제품 dev HEAD 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b, index.html blob 250aff5b0a46490488b64f7b96a83c940d2d6c71. 실제 소스에 OCR 미리보기 직접 교정 → 기존 문제 교체 확인 → 문제란 반영 → 교정 시 review 무효화 → 보호자 재확인 → IDB 기록 및 재읽기가 존재. 결함을 가정하여 제품 코드를 덮어쓰지 않고 **누락된 종단 여정 검증**부터 수행.
- 별도 QA 브랜치 qa/wrong-w03-edit-persist-p0-20261121, 시험 커밋 0e742b9bf3aeb4f953cde8ff3d5478e92cf324ea, 신규 tests/wrong-w03-edit-persist-p0-20261121.mjs (blob b228ee701be51aa5f2a3b6847bc9b640d4a934c8) 및 전용 workflow (blob 63c1f680a5cab53cb7c592f372f4d4220baf879d) **2파일만 추가**. index.html·제품 dev·기존 OCR/ACK 스크립트 변경 0.

## 새로운 실증

- [CI44883435344](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44883435344) job136783496029 attempt1 **SUCCESS**, 원본 index/dev Git SHA 대조·코드 구문검사 PASS. 기존 OCR QA81/84·ACK CI 재실행 **0**.
- [artifact14698708544](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44883435344/artifacts/14698708544): ZIP **586,276B**, SHA256 **0c488f1d6161beaae1019c943d903938105faa5873665b5bdcbef3bea6fcf6ad**. GitHub digest와 02 직접 계산 일치. ZIP CRC PASS·PNG6/JSON1 개봉. 320×900 PNG3 + 390×900 PNG3, 모든 PNG 유효/비단색, 64×64 RGB 축소 표본 고유 색상 **989~2571**.
- 시험 환경: loopback HTTP Basic Auth·무작위 임시 브라우저, 1px 가상 사진·합성 Tesseract worker, 외부망 요청 차단·실자료0. **실제 사진/OCR 모델·실가족 인증·실운영 검증 아님**.

| 테스트 조건 | 320px | 390px |
|---|---|---|
| OCR 인식초안 직접 수정/교체 확인창 | PASS | PASS |
| OCR 적용 시 기존 부모 확인 해제, 문제란 2차 교정 시 다시 해제 | PASS | PASS |
| 보호자 명시 재확인 후 저장됨, ocrStatus=browser_ocr_reviewed | PASS | PASS |
| 저장→새로고침→목록/상세→수정 화면에 교정 문장 동일 | PASS | PASS |
| 기존 UUID 유지·중복 0, 문제 1·사진 1 | PASS | PASS |
| 재수정·재열람 후 사진 바이트 SHA256 불변 | PASS | PASS |
| 아이 모드에서 부모 메모의 DOM/text/input 값 노출 0 | PASS (합성) | PASS (합성) |
| 저장 후 새로고침 원본 완전일치·JS/외부요청 오류 0 | PASS | PASS |

- JSON 상태 **PASS_SYNTHETIC_W03_EDIT_PERSIST_AUTH_BLOCK**, case2, screenshot6, errors/pageErrors/external=[], safeToRestore=false. 사진 759B SHA256 9871ecf2f1ac74e30bc79d2477df43f72ae19d871aa43dbc7ee9cec059a2ad28 각 폭 보존.
- **국소 결론:** 이 시험에서 W03 교정값 유실은 **재현되지 않음**, 기존 제품 저장 경로를 새로 구현할 근거 없음. 기존 QA84의 **서로 다른 기록 간 늦은 OCR 도착**은 별도 선행 테스트이며 이번 CI가 모든 경쟁 시나리오를 재검증한 것은 아니다.
- **미해결:** 뷰 모드(v218)는 가족 인증이 아니며 동일 브라우저 프로필 가족 권한 차단 실증 없음 → 기존 00T-02-AUTH-GATE, 08 보안 BLOCK 유지. 02 기존 00T-02-VIS-FIX Playwright 저장직후 캡처 FAIL 역시 변함없음. 실제 OCR, 실기기, 운영 서버 ACK, 실가족 원장/권한 N/T.

## 인계/재개

1. 06은 위 신규 ZIP 하나만 **독립 다운로드·SHA/CRC·PNG6/JSON1·원본 blob·사진 해시/교정 저장/재확인/아이 메모 비노출**을 대조하여 W03 A격리 국소 PASS/PARTIAL/FAIL로 판정. 기존 성공 CI를 재실행하지 말 것.
2. 00은 독립 신규 원시 이후 W03 합성 범위의 제한 수락 여부 판단. 제품 이식·가족 인증·실OCR 승인으로 승격 금지.
3. 결과 링크 등록만으로 06 채팅방의 실제 새 모델 수신을 주장하지 않음.

**불변:** dev/main, PR80 Draft, safeToRestore:false, 사용자/가족/운영DB, 광고·배포·예약, 결제/유료 API, 제품 index 파일 전부 변경 0.
