# A18-9 — 설정·직접 readwrite·쓰기 알림 경계 국소 감사

- 기준: 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` (compare identical), `index.html` 한정 국소 읽기. 기존 A18-5~7 PASS 재실행 없음.
- **공통 쓰기**: 567행 `transaction`은 `readwrite` 완료 후 `v20AnnounceWrite()` 호출. 완료 알림은 revision을 같은 IDB 트랜잭션에 저장하는 CAS가 아니므로 ABA 감지 보증 없음.
- **설정 자가점검**: 1521·1524·1528행 `settings`에 nonce를 put/delete. 공통 트랜잭션을 통하므로 완료 알림은 호출하지만 별도 단조 증가 revision 저장은 보이지 않음. 임시 marker 쓰기와 삭제가 중간에 발생했다가 사라지는 A→B→A 상태 가능성은 정적 계약상 배제되지 않음.
- **프로필 직접 트랜잭션**: 1535~1548행 `v213SaveProfileGuarded`는 `settings` readwrite 안에서 현재 profile 값을 예상 값과 비교 후 put, tx 완료 후 알림. 동일 트랜잭션 내 값 비교는 경쟁 쓰기 방지에 유효하나, 기존 값으로 돌아오는 ABA 이력 자체를 검출하는 단조 revision은 없음. `announce=false` 경로는 알림 생략 가능(호출 빈도는 미검증).
- **복원 직접 트랜잭션**: 1660~1680행 `v22RestoreOnlyIfUnchanged`는 3개 저장소 readwrite에서 서명 재검사·clear/put·완료 알림. 같은 트랜잭션 내 원본 일치 검사와 중간 이력 추적은 별개. A18-6/7에서 보인 ABA 미탐지 경계를 해소했다고 볼 수 없음. 실제 복원 수행 금지.
- **이전·표식**: 613~629행 3스토어 직접 tx, 1751·1762행 reentry marker 쓰기는 각각 알림을 호출하지만 원자적 공통 revision 기록은 확인되지 않음.
- **결론**: 새로운 기능 실패를 실증한 것이 아닌 **정적 계약 차이**. `v20AnnounceWrite` 정의/전체 호출부와 브라우저 다중탭 전파는 이번 범위에서 전수 증명하지 못함. 기존 안전 경고 유지, `safeToRestore:false`, 사진·오답·pending 원장 보존. 제품 수정·병합·배포 없음.
- **다음 A18-10**: 알림 정의 및 직접 호출부를 국소 확인하여 알림 누락·ABA 반례 중 신규 실패 하나만 A격리에서 재현. 제품 수정 필요 시 격리 최소 패치·새 회귀/원복 검증 후 00 승인 경계 준수. 실제 원자 CAS·실복원·실폰 N/T.
- **재현**: `dev:index.html` 567, 613~629, 1521~1550, 1660~1680, 1751~1762행만 읽고 직접 tx와 공통 tx의 완료 알림·revision 저장 여부 비교.
