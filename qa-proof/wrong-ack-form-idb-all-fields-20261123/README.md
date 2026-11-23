# 00T-02-ACK-CORE — 저장 필드 전체 승인무효화 격리 QA

- 제품 기준: `dev` `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`
- 이전 QA 기준: `c65c0e1554ad56d45a8dd6574c28b722ea858b28`
- RED: 이전 어댑터는 `problem:input`만 관찰하여 `student-answer:input`, `memo:input`, `wrong007-grade:change`가 승인무효화 경계에서 빠졌다.
- GREEN 후보: 네 실제 폼 이벤트를 동일한 격리 승인무효화 함수에 연결한다.
- 시험: 실제 제품 폼·IndexedDB·사진 blob, 로컬 Chromium 320/390px. 세 필드를 순차 수정·저장할 때마다 revision 변경, 이전 ACK 무시, 사진 SHA 불변을 확인한다.
- ACK 원장 GET/POST와 승인 상태는 합성 어댑터이며 실제 서버·Supabase/JWT·가족 A/B 검증이 아니다.
- 산출물: `ack-all-fields-320.png`, `ack-all-fields-390.png`, `evidence.json`, `result.tap`.
- 정확 역패치: 후보 checkout에서 `git diff c65c0e1554ad56d45a8dd6574c28b722ea858b28..<candidate-sha> | git apply -R`.
- `ACK/AUTH/VIS BLOCK`, `safeToRestore:false`; dev/main·PR80·DB/Edge·배포·실자료·예약 변경 없음.
