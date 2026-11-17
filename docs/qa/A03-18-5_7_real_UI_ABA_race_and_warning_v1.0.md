# 02 WRONG A-03-18-5~7 — 실제 Chromium ABA 경계와 읽기 전용 경고 v1.0

**작업 시각:** 2026-11-17 09:06~09:15 KST. **기준:** `dev@3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` 불변, PR #80 Draft·미병합, `safeToRestore:false`. 모든 단계 합성 A격리, 운영·가족 자료·복원·배포 미변경. A-03-13~17 PASS 재실행 없음.

## 문제 분석
[#87 2026-11-17 08:16 KST 현재 커서](https://github.com/jinbh99-arch/uri-homework-manager/issues/87)는 A18-4의 **workflow 등록/실행 N/T**를 마지막 체크포인트로 지정했다. GitHub Actions [#43950875196](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43950875196)을 직접 조회했더니, `ubuntu-latest`→`ubuntu26.04` runner에서 Playwright Chromium 설치 중 **`Playwright does not support chromium on ubuntu26.04-x64`**, 테스트 본문·PNG는 전혀 실행되지 않았다. 이는 앱 결함이 아니라 **테스트 환경 차단**이다.

A18-1 Node 4/4는 A→B→A에서 두 시점 내용만 같으면 중간 변경 사실을 모르는 문제를 모형으로 지적했으나, **실제 A-03-17 앱의 원본 비교 UI에 주입한 증거는 N/T**였다.

## 대안과 선택
1. 기존 PASS 테스트 재실행·운영 계정에서 확인: 중복/위험이므로 **거부**.
2. `ubuntu-24.04`로 CI를 고정하고 고립 IndexedDB fixture를 320/390 실제 실행: **A18-5 채택**.
3. **A-03-17 원본 UI 그대로**를 격리 실행해 IDB 사진 변환 경로에 A→B→A를 주입: **A18-6 채택**. 앱 코드는 수정하지 않고 Test만 분리한다.
4. 전면적인 `revision` 동기화 없이 '원본이 완전하게 안전함'으로 표시하거나 저장 잠금을 해제: **거부**.
5. A18-6 사실을 반영해 '두 스냅샷 일치'의 한계를 명시하는 **비파괴적인 경고 문구만 A격리 패치**: **A18-7 채택**. **ABA 탐지·복구 성공 기능이 아님**.

## 실제 변경 및 CI 증거
| 증분 | QA 브랜치/커밋 | 신규 검증 | 결과 |
| --- | --- | --- | --- |
| A18-5 | `qa/wrong-a03-18-5-ci-ubuntu24-20261117-0910` / `d142f55c446f297ffde6e4938a0da68a9bcdfb7f` | [CI #43985104597](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43985104597) ubuntu24.04+Playwright1.56.1, 실제 isolated IndexedDB에서 A→B→A, 320/390 각 `expected=true` | **PASS**, artifact `14284737716` (PNG2·JSON2) |
| A18-6 1차 | `qa/wrong-a03-18-6-real-ui-aba-injection-20261117-0915` / `d08f86ab33940f0fe7663b48e2b4d5e7fc8ecd94` | [CI #43985295469](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43985295469), 앱 IIFE 내부 `v221ReadCurrentEvidence`를 `window`에서 교체 불가 | **FAIL — 시험 주입점 오류**, 앱 결함 증거 아님 |
| A18-6 최종 | 같은 브랜치 / `44c38421ca198b233cabb0a4726340e76e03b3d3` | [CI #43985535389](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43985535389) 실제 A17 FileReader 사진 변환 경로 후 B·A 2회 IDB `readwrite` 삽입, 320/390에서 2회 IDB 원본 비교 후 '✅ 동일' 표시 | **PASS — ABA 미탐지 재현**, artifact `14284578306` PNG2·JSON |
| A18-7 | `qa/wrong-a03-18-7-aba-warning-20261117-0920` / CI `66c3ccc06536dcf82a5a49f7d17d09f4156f4507` | [CI #43985844503](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/43985844503), 동일 실제 UI ABA 주입 시 **'⚠️ 두 시점만 일치, 중간 A→B→A 미감지, 복구 안전 보류·잠금 유지'** 표시, 320/390 | **PASS — 경고 표시**, artifact `14285551523` PNG2·JSON |

- A18-6·7 신규 로그: 브라우저 `pageerror=0`, 외부 요청0, 실행 중 QA 앱 파일 바이트 변경0. **A18-6은 실제 IDB 설정 2회 쓰기(B→A)를 시험용으로 수행하나 최종 A 복귀**. 오답 ID, PNG 사진 전체 바이트, 학부모 관찰 이력, 미확정 장부 원본이 동일하며 재시작 후 새 등록 버튼 잠금 유지 확인.
- A18-7 앱 `index.html`은 A17 앱 blob `f8361d6176d1ab54501fb6d701d4bfb04eb46b1b`에서 **결과 안내 문자열 1곳만** 교체한 `ef15e271ca7f9495e604255a8152bc6c9c9220a1`. GitHub 원문으로 **신규 안내 문자열 역치환 시 A17 원문 전체 정확 일치** 확인. A17 다중 파일 SHA·사진/설정 계산·저장 경로 변경0.

## 사실·한계·최선안
- **실증한 것:** 실제 A17 앱의 비파괴 비교는 합성 A→B→A 중간 변화를 **검출하지 못한다**. 두 읽기의 결과가 같아도 그 사이에 쓰기가 없었다고 증명할 수 없다. 저장 잠금을 해제하거나 복구/재등록하지 않는 기존 안전 경계는 유지된다.
- **A18-7 개선:** 이용자에게 `✅` 오해를 주지 않고, 원본 파일 일치의 범위를 명확히 안내한다. **ABA를 탐지하거나 완전한 동시성 보호를 구현한 것은 아니다**.
- **미완료/BLOCK:** 실제 복원 적합성, 모든 IndexedDB 쓰기에서 단조 증가 버전을 원자적 기록하는 구조, 동시 변경 감지·CAS 원자 비교, 악의적/무단 외부 쓰기, 기기 강제종료·저장공간 부족·실OCR·실서버 ACK·실폰 Safari·실가족/실사진.
- **다음 최소 A격리 작업:** 전체 사진/오답/설정 IndexedDB `readwrite` 진입 경로 정적 목록·누락과 버전 기록 가능 위치 감사. 변경을 감지할 **단조 revision + 모든 쓰기 경로 일관 적용**의 범위·부작용을 표로 정리한 뒤 **실제 CAS 경계 구현은 별도 근거로 검증**. 수동 장부 해제/삭제·복원은 계속 **금지**.

## 전달 판정
**완료:** A18-4 CI 환경 실패 원인 확인 → A18-5 실제 Chromium PASS → A18-6 실제 앱 ABA 중간 변경 미검출 재현 PASS → A18-7 안내 문구 국소 수정·320/390 검증·역패치 원복 일치 PASS.

**승인/차단:** A 내부 증분 결과일 뿐 `safeToRestore:true`, 제품 병합, 실데이터 복구, 계정/DB, 외부 공개/배포, 예약 변경을 허가하지 않는다.
