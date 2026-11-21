# 02 WRONG — 개발완성 2단계 / G1 대표 실제 제품 여정 간극 분석 v1.0

- 작성일 2026-11-21 KST · **정적 코드/기존 QA 증거 대조, 신규 실행 0**.
- 요청/지시: 00 [#82 #7063369574](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063369574), 99 G1 조건부 통합 판단(#94 #7063097353). 사용자 2026-11-21 '2단계 실제품 간극 분석 즉시 수행' 승인 없이 읽기전용.
- 고정 제품: [02 dev `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b`](https://github.com/jinbh99-arch/uri-wrong-answer-qa/tree/3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b) / `index.html` blob `250aff5b0a46490488b64f7b96a83c940d2d6c71` **5,578행**. 파일 줄번호는 이 blob에만 유효하다.
- 구분: **실제 개발 제품 코드의 존재/부재 정적대조**와 **QA 단회 합성 PASS·06 독립 국소 수락**은 다르며, 사용자의 실제 가족 데이터 E2E 증거는 0. 40 화면 12개·99 통합 판단은 **후보 설계이지 현재 dev 연결 증거가 아님**. 기존 `02_WRONG_개발완성10단계_부분복원_v1.0.md`는 원안 전문 미확보를 밝힌 복원본이며 사용자 성과물 10개와 구분.

## 대표 A 여정 (같은 오답 1건)

가상 부모가 기존 오답의 원문을 수동 수정 → 저장 후 읽기확인/ACK가 소실된 상황 → 기존 기록 재조회/중복 방지 → 아이가 같은 오답을 골라 재풀이 → 부모가 관찰을 남김. 여정은 **현재 제품 코드에 어떤 경로가 있는지 추적하는 정적 표**이지 이번 실행에서 전체 여정 PASS 했다는 진술이 아니다.

| # | 사용자의 행동·경계 | dev 실제 코드 근거(줄번호) | 구현/검증 구분 | 신규 간극 또는 다음 수용 조건 |
|---:|---|---|---|---|
| 1 | 오답 목록→기존 상세 | `index.html:876-878` `navigate('detail')`·record ID, `:1349-1356` 상세 렌더 | **구현 소스 확인** | 실제 guardian `GET /family/:id/records/:id` 인가·403/404 **N/T** |
| 2 | 부모가 기존 문장·사진을 수동 교정 | `:1374` `detail-edit`→`navigate('add')`; `:1244` 이전 `problem/memo/student-answer`·`edit-id` 재로딩; `:2270-2273` dirty snapshot | **구현 소스 확인** | 같은 ID/버전·사진 ownership 서버 계약·취소/복귀 저장 전값 미누출 필요 |
| 3 | 사진·OCR 미확인 | `:1290-1295` 사진 선택/자르기·`ocrImageRevision`; `:1822-1845` 지연 OCR 무효화; `:1854-1877` 수동 적용/교체와 체크 초기화 | **구현 소스 확인 + 06 합성 한정** | 실제 OCR/비동시 worker/실사진·가족별 서버 사진·아동 DTO 아직 N/T. [06 #7063285718](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-7063285718)는 순차 가상 OCR·320/390 두 경우만 검증 |
| 4 | 저장 요청/사진 원장 | `:1296-1306` 입력·이력 보존, `:1316-1326` 기존 사진 검사·원장 기록. `:2894-2919` IndexedDB 동일 트랜잭션 내 `expected` 스냅샷 CAS | **로컬 저장 코드 있음** | 서버 `If-Match`/revision·가족·권한 일관성·서버 409 응답 구현 **N/T**; IDB 스냅샷 CAS는 실 가족 서버 CAS 아님 |
| 5 | 성공 ACK·저장 재조회 | `:1327-1343` `mistakes/photos` 재조회/사진 바이트 대조, 이후 상세 화면·성공 문구 | **로컬 구현** | ACK 전달 손실·탭 종료/새 프로필·네트워크 응답유실의 실제 서버 readback 계약 **N/T** |
| 6 | **ACK_UNKNOWN** (커밋 성공, 후속 읽기 실패) | `:1326` `transactionDone=true`; `:1344-1347` '중복 등록하지 말고 목록에서 확인' **문구만**. `:2302-2313` `v13SaveBusy`는 try/finally 후 **false 복귀** | **부분 구현 / 중요 간극** | dev에 QA 전용 `wrongAckUnknown` 지속 잠금 상태·재전송 차단·동일 ID 조회 복원 계약 없음. 새 오답을 재제출하면 재발급 ID 가능성(추론, 신규 실측 아님). QA ACK 브랜치의 동작을 dev에 적용됐다고 보고 금지 |
| 7 | 아이 화면 전환·비공개 메모 | `:4498-4547` `v218Mode` body class/DOM 정리, 부모 미저장값 있으면 전환 차단. `:1356-1361` 상세가 먼저 `detail-memo`를 넣고 아이 시 `replaceChildren` | **화면 로컬 가드 구현 / 실제 권한 미구현** | 역할 구별은 presentation toggle, 서버 `child DTO` 자체 없음. **아이 JSON·네트워크·캐시·IDB에서 부모 메모가 애초부터 공급되지 않음**을 입증해야 한다. CSS 숨김/DOM 삭제만으로 PASS 아님 |
| 8 | 아이가 같은 ID를 골라 다시 풀이 | `:4399-4409` 저장된 목록에서 ID 선택→`navigate('detail')`·초점 유도; `:3453-3469` 수학 예시 재풀이 `practiceHistory` 로컬 CAS; `:1306` `generalRetryHistory` 보존 | **구현 경로 있음 / 전체 5과목 및 실 서버 N/T** | 실제 child 최소권한 응답과 '쓰기 가능한 재풀이 필드만' 서버에서 제한되어야 함 |
| 9 | 부모 관찰·다음 확인 분리 | `:1375-1377` `checkHistory`에 `by:parent_observation`, 아이 화면에서 이력 DOM 비우기; `:879-887` 기록 목록은 저장된 이력을 참고 | **로컬 경로 구현 + 기존 부분 QA** | 아동이 직접 parent observation POST/변경 불가능한 실 API/DTO·원장 동시성 필요 |
| 10 | 가족 A→로그아웃→B / 같은 기기 | `:554-573` 브라우저 공용 IndexedDB `uriaimath-github-qa-v224-only`; `:4500-4514` 권한 아닌 보기 모드. 시험 `qa-family-gateway.mjs:1,191-194`은 localhost 합성 전용 | **실제 제품 AUTH-GATE BLOCK** | 서버 JWT·verified guardian·철회·동일 프로필 A 기록/사진/캐시 잔류0 미구현. #82 #7063355475에 따른 Supabase 상태 **읽기전용**만; 실계정 접근 승인 없음 |
| 11 | 사진·백업·복원 범위 | `:543` 비암호화 JSON 백업·복원 안내, `:566-570` IDB; `:1378` `photos` 로컬 Blob 표시 | **로컬 구현** | 인증된 가족 Storage 소유권·기존 서명 URL 만료·실제 암호화 백업/원자적 복원·공유기기 재진입 **BLOCK**. `safeToRestore:false` |
| 12 | 320/390 핵심 CTA·경고 | `:10` `#toast` fixed bottom24/z10, `:53-55` save fixed bottom0/z9; `:1290` 사진 선택시 toast, `:545,547` 실 DOM | **정적 겹침 위험 후보** | 실제 알림/저장 CTA 픽셀 영역·초점·키보드·첫 viewport 미계측. 별도 [토스트 분석](02_WRONG_OCR_알림가림_정적위험분류_v1.0.md) 참고 |

## 계약 상태·선후 의존

- **Source/Local PASS 한정:** 부모 원문 수정·사진/오답 IDB 저장·재조회 성공 경로·아이 로컬 DOM 정리 및 일부 재풀이·관찰. QA79·W03·OCR 단회 가상 시험이 해당 범위를 부분 보강한다.
- **명확한 개발 간극:** `ACK_UNKNOWN` 지속적 제출잠금(실제 dev 없음), 서버 가족 인가/토큰·로그아웃·DB RLS·사진 Storage/아이 최소 DTO·서버 401/403/409·공유 프로필 세션별 데이터 격리. 이들 중 어떤 것도 합성 HTTP localhost PASS만으로 출시 PASS가 될 수 없음.
- **검증 필요 (N/T):** 40 화면 12개 실 라우트 매핑(후보 시안 원본 SHA와 실제 제품 연결 이번 분석에 제공되지 않음); 직접 Playwright native200 재캡처 FAIL 원인; 실제 OCR·실폰/네트워크/실 JWT.
- **기술 선후:** (a) ACK_UNKNOWN 재조회·중복 잠금 요구를 dev 계약으로 확정 → (b) 서버 guardian/child DTO와 가족/Storage 권한 정책(별도 승인 전 **설계만**) → (c) WR01~04/아이 재풀이 실제 API 연결 → (d) 06/08 독립+00 판정. 개발완성 7/8 단계 및 실인가 4단계 **승격/배포 금지**.

## 수정사유와 관리

기존 개발완성 10단계 [부분복원 v1.0](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-10stage-versioned-plan-20261121/docs/plans/02_WRONG_개발완성10단계_부분복원_v1.0.md)의 **2단계 '데이터/상태 전이 계약 보완'을 지금 dev 소스 라인과 QA 계약에 매핑**하기 위해 본 v1.0 하위 실증 갭표 신설. 원래 사용자 10개 성과물 제목·순서, 개발 10단계 원문/번호 변경0.

**최종 상태:** `00Q-00-D0GAP` / 2단계=**읽기전용 사실 차분 완료, 실제 제품 통합 미완료**. `AUTH-GATE BLOCK`, `VIS-FIX FAIL`, `safeToRestore:false`, PR80 Draft, 7·8 HOLD 유지. 코드/CI/운영/계정·DB/예약·광고·배포 변경0.
