# A18-8 — IndexedDB 쓰기 경계 국소 정적 감사 (2026-11-17 10:31 KST)

기준: 제품 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` (compare identical). 기존 A18-5~7 Chromium PASS 재실행 없음. 검토 대상은 dev index.html 일부 국소 줄만이며 전체 경로 감사 완료가 아니다.

| dev index.html 근거 | 실제 확인 | revision/CAS 판단 |
|---|---|---|
| 563~568 | `openDb()`는 mistakes/photos/settings 세 스토어 생성. `transaction(stores,mode,callback)`은 완료 후 `v20AnnounceWrite()`만 호출. | 이 공통 래퍼에서 단조 revision 원자 갱신은 관측되지 않음. `v20AnnounceWrite` 내부 동작은 별도 검토 필요 |
| 569~570 | `saveMistake`는 mistakes.put + photos.put/delete, `removeMistake`는 mistakes/photos delete를 단일 readwrite tx에서 수행 | 오답/사진 두 스토어의 원자성은 있으나 버전 조건부 쓰기(CAS)는 이 구간에 없음 |
| 610~633 | `v219CommitLegacyMigration`은 mistakes/photos/settings를 단일 readwrite tx에서 확인 후 쓰기, 완료 시 `v20AnnounceWrite()` | 빈 스토어 검사와 이전은 tx 단위로 보호되나 모든 후속 쓰기의 revision 규약은 별도 |
| 782~783, 809~831 | `v221InspectLiveSafety`와 `v221ReadCurrentEvidence`는 별도 snapshot 읽기와 Blob→dataUrl 비동기 변환 수행 | 파일 변환 사이 외부 쓰기 경합 가능성; A18-6 실제 UI ABA 미탐지 증거와 합치 |
| 680~687 | 초기화에서 restoreState→inspect→migrate→restoreState→inspect 순차 호출 | 초기화 단계의 검사 사이 쓰기 경합은 단일 원자 tx가 아님 |

## 결론 및 최소 후속
1. 확인된 쓰기 진입점은 공통 `transaction`, `saveMistake`, `removeMistake`, `v219CommitLegacyMigration`이다. **전체 쓰기 경로 누락 여부 N/T**: 설정 저장·직접 `db.transaction`·기타 복구/마이그레이션 함수는 별도 국소 확인 필요.
2. 단순 `v20AnnounceWrite` 이벤트나 파일 내용 해시만으로 ABA를 탐지할 수 없다. 보수적 계약은 **읽기 결과가 같더라도 safeToRestore:false 유지, 수동/자동 복원 금지**다.
3. 향후 revision은 모든 쓰기 경로가 동일 IDB 트랜잭션에서 단조 증가해야 하고, 비교와 조건부 갱신도 동일 tx 안에 있어야 한다. 다른 탭·기존 앱 버전이 revision을 갱신하지 않는다면 안전 보증 불가. 즉시 제품 반영하지 않는다.
4. 다음 A18-9: 설정 직접 쓰기·`v20AnnounceWrite`·다른 `readwrite` 진입점의 **국소 정적 대조**→누락/부작용 표→필요한 신규 실패만 격리 재현. 실제 CAS/복원/실데이터/실폰/배포 N/T.

A18-7 경고 PASS는 그대로 유지. 사진·오답 원장·pending 원본 보존, PR80 Draft, dev/운영 변경0.
