# 02 WRONG A-03-8 — dev 정본 기반 +9/-3 선별 적용 사전검증

- 날짜: 2026-11-16 KST / A 합성·격리 QA 전용. 제품 dev·운영/인증/DB/광고/배포/예약 변경 0.
- 실제 dev SHA40: 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b (불변).
- QA: qa/wrong-a03-8-dev-selective-preflight-20261116-1920 — dev 직접 분기, 기존 QA 25커밋 이식 0.
- A-03-6의 제품 index.html +9/-3 패치를 그대로 tests/fixtures/a03-6-selective-index-only.patch에 보존.
- [새 CI 43849588951](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43849588951): 테스트 3/3 PASS; [artifact 14216153588](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43849588951/artifacts/14216153588) JSON.
- 판정: BLOCKED_UNSATISFIED_PREREQUISITES — 사전 충돌 검증 PASS이지 적용·회귀·배포 PASS 아님. 제품 index.html 변경 0.

## 직접 확인한 신규 차이
1. A-03-6 선별 패치는 실제 추가9/삭제3줄로 고정.
2. 현재 dev에는 선행 wrongA03UnknownCreateId / wrongA03SaveBusy 변수가 둘 다 없고, ACK 불명시 오답 목록 비동기 재읽기 블록도 없음. 원래 photoBlob() await 미포착 경로는 존재.
3. dev 파일 바이트 복사본에 실제 git apply --check: 종료 1, index.html:881 patch does not apply. git apply --reject도 종료 1 및 index.html.rej 생성.
4. 거부된 적용의 임시 복사본에 원본을 재작성한 결과 SHA256 완전 일치: 15ebe6c36a615c03ce76c555989ebabee6024949157b3ab76fa9d85a2d2106ff. 실서비스 원복 아님.
5. dev 대비 신규 브랜치 추가 파일은 패치·테스트·워크플로 3개뿐. 기존 A-03-6 및 A-03-3/5 PASS 재실행 0.

## 원인·안전한 대안
- 원인: +9/-3 패치는 자체 완결 수정이 아니라 이전 QA의 신규 저장 불명 상태관리·busy 가드·목록 재읽기 동작을 전제함. dev에서 그대로 이식 가능한 독립 패치가 아님.
- 선택 A: 선행 상태관리 중 꼭 필요한 부분만 범위를 산정해 dev-rooted 격리 QA에서 단계별 이식·신규 회귀·원복 확인. 하지만 +9/-3 외 코드가 필요하므로 총괄의 범위 판단 선행.
- 선택 B: dev의 기존 저장 흐름에 맞게 사진 변환 예외·첫등록 ACK 유실 방어를 재설계하고 별도 A 합성 계약으로 QA. 역시 +9/-3 단순 이식과 다르므로 총괄 재지시 선행.
- 25커밋 일괄 병합·dev/PR80 변경/실가족/실OCR/서버 ACK/배포 검증 금지. PR80 Draft, safeToRestore:false 유지.
- 결론: A-03-8은 충돌/모의 원복 사전검증 완료, 실제 선별 이식은 선행 의존성 때문에 차단.
