# WRONG A-03-6 — 사진 변환 예외와 미확정 첫등록 메뉴 재진입 신규 검증 계약

2026-11-16 15시대 KST · 02 WRONG · 격리 QA / **실제 재현·브라우저 PASS 아님**

## 기준과 범위
- 제품 dev: `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`; QA 브랜치 dev 대비 ahead19/behind0, 제품 변경 `index.html` +56/−8. 00 총괄 #82 6909009117이 승인한 A-03-6의 **두 가설만** 다룬다.
- A-03-5 정적 10/10, A-03-3 Chromium 7/7은 이미 통과했으므로 반복하지 않는다.
- 합성 이미지·합성 오답만 사용; IndexedDB `mistakes`/`photos`의 ID·건수·원본 바이트를 실패 전후 대조. 실가족·서버·실OCR·복원·삭제·외부배포 금지.

## A. 사진 변환 await 예외 → busy 잠금 잔류 가설
1. 격리 Chromium 320px에서 신규 오답·합성 사진을 입력하고, **사진 Blob 변환 Promise만 1회 reject**하도록 사진 변환 함수 호출 경계에 주입한다. IDB transaction/write는 건드리지 않는다.
2. 저장 클릭 → 오류 문구·버튼 활성 여부·`wrongA03SaveBusy`와 `v13SaveBusy` 상태·pageerror·저장 전후 원장/사진을 기록한다.
3. 동일 양식의 사진을 정상 합성 이미지로 바꿔 재시도한다. 두 번째 저장이 영구 차단되면 실제 결함; 예외 후 busy 해제와 1건 저장이 되면 가설 기각.
4. 결함 재현 시 `wrongA03SaveBusy=true` 이후 사진 변환 `await`까지 포함하도록 `try/finally` 경계를 국소 이동. 저장 함수 전체 재작성·IDB CAS/restoreState 수정 금지. 수정 전 실패·수정 후 신규 PASS·PNG·원복 diff 제출.

## B. ACK 미확정 → 메뉴 재진입 → 중복 신규 ID 가설
1. A-03-3의 `injectPostCommitReadbackOnce` 방식을 사용해 **첫 IDB write 성공 후 readonly mistakes 조회만 1회 실패**시킨다.
2. 미확정 경고와 원장 1건·사진 1건을 캡처한 뒤, `records` 화면을 열지 않고 다른 메뉴→`nav-add`로 재진입한다. 이전 입력이 사라지는지, 경고/미확정 ID가 유지되는지, 동일 내용을 새 ID로 재저장 가능한지 기록한다.
3. 저장 재시도 전후 `mistakes` ID 배열·사진 바이트를 비교한다. 동일 사용자 의도의 미확정 첫등록이 2건이 되면 결함. **서로 다른 의도적 새 등록은 동일 텍스트라도 허용**하므로 내용 동일성만으로 자동 병합하지 않는다.
4. 결함이면 `renderAdd()`에서 미확정 ID 무조건 초기화를 막고, 읽기 전용 목록 확인 또는 명시적 새 등록 의도 확인 전까지 재저장을 제한하는 최소 UX 수정. 저장소·사진 원장 쓰기 변경 금지.

## 검증 및 보류
- 320/390 Chromium 신규 두 경계, 실패 시점·수정 후 화면 PNG, pageerror 0, 외부 요청 0, 원장/사진 byte 비교, 원복 후 기준 dev 바이트 동일 확인.
- **현재 실제 브라우저 실행 미실시.** 이번 환경의 직접 git clone은 `Could not resolve host: github.com`로 실패; GitHub 연결을 통한 제한 범위 파일·커밋 비교는 가능. 격리 브라우저와 해당 함수 경계에 대한 주입이 확보되면 위 절차 실행.
- dev/main/PR80 병합 금지, PR80 Draft, `safeToRestore:false`, 사진/오답 원장 보존. A/B 확인 전 QA 정적 가설을 제품 결함 확정 또는 PASS로 승격하지 않는다.
