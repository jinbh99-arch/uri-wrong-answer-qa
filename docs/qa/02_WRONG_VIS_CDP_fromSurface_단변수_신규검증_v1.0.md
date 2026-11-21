# 02 WRONG VIS CDP fromSurface 단변수 비운영 신규 시험 v1.0

2026-11-21 KST. 00 승인 #7062893616/#7062900528. 기존 VIS ACK 저장직후 Playwright PNG2 단색 FAIL 유지. 본 시험은 CDP의 fromSurface false/true만 전환하여 PNG4/JSON1, 고유색·SHA·뷰포트·native200·레이아웃·정지상태 일치 여부를 기록한다. CDP 두 호출이 물리적으로 동일 시각은 아니며 같은 앱 상태를 유지하는 순차 시험이다. CI 최대1회. 기존 CI44875702927·기타 ACK/W03/QA 재실행0. 제품 원본 exact inverse 확인.

브랜치 `qa/wrong-ack-top-warning-native200-20261121`, dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` unchanged, QA index blob `101e7ea5ee5ba34e107c77981daaf58101c97750`. 소스 `tests/wrong-vis-cdp-fromsurface-single-variable-20261121.mjs`, 전용 workflow. 결과는 CI/job/artifact/JSON/PNG 실제 생성 뒤만 PASS/PARTIAL/FAIL. AUTH-GATE BLOCK, safeToRestore:false, PR80 Draft, 제품/운영/실자료/예약 불변.
