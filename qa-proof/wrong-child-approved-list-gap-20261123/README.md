# 02 WRONG — 아이 승인목록 필터 간극 격리 재현

- 제품 기준: `dev` `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`
- 실행: `node --test tests/wrong-child-approved-list-gap-20261123.mjs`
- 범위: 실제 제품 화면·IndexedDB, 합성 텍스트 2건, 320/390px Chromium

제품 폼으로 기록 2건을 저장한 뒤 시험 fixture에서 하나는 `approved`, 다른 하나는 `draft_unapproved`로 표시했다. 아이 표시모드의 `wrongChildNextOneRender()` 결과에는 두 기록이 모두 나타났다. 즉 현재 아이 목록은 승인 원장이 아니라 전체 로컬 `records`를 사용한다. 부모 메모 문자열은 아이 DOM에서 발견되지 않았다.

이 시험은 제품 코드 결함을 수정하지 않는다. `guardianApproval`은 향후 계약을 표현하기 위한 합성 fixture이며 현재 제품 스키마가 아니다. 실제 가족 인증·서버 승인원장·JWT·A/B 권한은 N/T다. 제품 `dev/main`, PR #80, DB·Edge·배포는 변경하지 않았으며 `AUTH/VIS/ACK BLOCK`, `safeToRestore:false`를 유지한다.
