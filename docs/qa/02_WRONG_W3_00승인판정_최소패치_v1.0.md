# 02 WRONG W3 — 00 내부 제품 반영 판단용 최소 수정 승인 패킷 v1.0

**작성일:** 2026-11-18 KST. **상태: 00 승인 요청을 위한 A격리 후보 준비 완료 / 제품 dev 미반영 / 외부 배포 금지.** 원본 앱 변경 없이 GitHub QA 브랜치에 **4줄 최소 diff**만 추가했다. 이 문서는 00의 승인 자체가 아니다.

## 1. 기준 소스·정확한 변경 경계

| 구분 | 확인한 값 | 의미 |
|---|---|---|
| 02 WRONG 제품 기준 `dev` | `3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b` | 실제 GitHub 브랜치 재조회 결과 |
| 원본 `index.html` Git blob | `250aff5b0a46490488b64f7b96a83c940d2d6c71` | 패치 적용 **전** 승인 필수 핀 |
| 현재 QA 증거 | [W3 부모 토스트 CI44253835980](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253835980), [두 가드 CI44310593267](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44310593267) | 재실행/성공소급 불필요 |
| 06 독립 판정 | [원래 토스트 #6979473254](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979473254), [신규 부모 두 가드 #6979749342](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979749342) | **QA 수정 효과와 정·역복원 PASS**, 제품 도입 승인 아님 |
| 임시 수정 앱 Git blob | `6ff6cf1c2cfeef3706381a68fc105feab8258b04` | 기존 CI GREEN 중 잠시 생성·검증한 **동일 내용**; 제품 dev 반영 사실 아님 |
| 제안 diff | [W3 정확 4줄 후보 패치](https://github.com/jinbh99-arch/uri-wrong-answer-qa/blob/qa/wrong-w3-dirty-observation-question-guards-20261118/qa/w3-child-mode-toast-candidate-reviewed.patch) | 기존 코드에 **추가 4줄**, 삭제 0 · 원본 파일 수정 0 |
| W7/복원 PR #80 | Draft, `safeToRestore:false`, WebKit Blob seed에 따른 복원 게이트 BLOCK | **이 W3 제안에 포함하지 않고 PR80과 합치지 않음** |

패치 위치: `v218ApplyMode(mode)` 내부의 ① 오답 작성 초안 ② 상세 부모 관찰 메모 ③ 비수학 재확인 질문 `return 'blocked'` 검사들이 끝난 **후**, 아이 모드로 실제 전환된 `if(mode==='child'){` 진입점(원본 HTML **4515행**). 기존 `notify()`는 부모 알림 텍스트를 `#toast`에 설정하고 3.4초 타이머에만 숨기는 문제가 있어, 아이 화면으로 즉시 전환하면 직전 부모 설명 문구가 남는다.

**정확히 적용할 4줄** (실제 diff 파일에 원문 보관):

```js
// QA-only: remove previous parent toast AFTER all draft-block guards pass.
clearTimeout(toastTimer);
$('toast').textContent='';
$('toast').classList.add('hide');
```

문구의 `QA-only`는 기존 독립 검증된 **동일 바이트 후보**를 유지하기 위한 표식이며, 00이 제품 반영을 승인하면 주석 변경 없이 해당 검증 후보를 먼저 정확 적용·재검증하는 것이 가장 낮은 회귀 위험이다. `child` 전환이 차단될 때는 이 블록에 도달하지 않으므로 **유효한 차단 경고는 그대로 보인다**.

## 2. 정적 재대조·기존 독립 기능 계약

이번 회차 GitHub API에서 **현재 dev HTML 실제 본문**에 대해 원본 두 줄 연결 앵커가 **단 한 번만** 존재함을 확인했다. 앵커를 위의 4줄을 추가한 정확 내용으로 변환하면 새 내용은 1회 발생하며, 같은 내용으로 **역치환 시 원본 전체 문자열과 완전 동일**함을 프로그램으로 확인했다. **제품 Git 파일은 한 글자도 수정하지 않았다.**

원시 독립증거:
- 최초 토스트: [CI 44253835980](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44253835980) artifact `14405321094` SHA256 `e44a2d3f391e730f01798f09a670c42c02e3506a9f2d8676b1e947cc350aec6a`, PNG8+JSON2. **320/390 RED 잔류 → GREEN DOM/화면 제거**, 미저장 오답 차단 경고 유지. 06이 ZIP 열람+CRC/정·역패치 독립 PASS 판정.
- 부모 관찰/재확인 질문 두 추가 가드: [CI 44310593267](https://github.com/jinbh99-arch/uri-wrong-answer-qa/actions/runs/44310593267) artifact `14429374261` SHA256 `89d125ef4a84d07e0a26ca0fc2a48e4bd9b5f4400bcd99bc1e7e6ec978e4a9b8`, PNG12+JSON2. 320/390 RED 차단 경고 보존·아이 화면 부모 경고 잔류 → GREEN 정상 전환 시 경고 DOM/표시 제거, 두 가드 자체·06 독립 PASS.
- 기존 사진·원장 보호는 같은 합성 QA 범위의 확인사항이다. **실사진·물리 휴대전화·가족별 실제 접근통제·실OCR·웹 배포 실환경은 N/T**, 화면 토글을 인증으로 오인해서는 안 된다.

## 3. 00 선택지와 적용 후 완료 기준

| 선택지 | 가능한 효과 | 제한·선택 기준 |
|---|---|---|
| **A. 현재 QA 결과만 승인/보관** (기본 상태) | 우선 P0를 진행하면서 제품 dev 그대로 보호 | 실제 사용자 화면 W3 토스트 잔류가 남음. 공개/정식 사용 안전을 보증하지 않음 |
| **B. 제품 내부 dev 국소 반영 별도 승인** | 단일 `index.html` 4줄만 반영한 뒤 *새 커밋*에서 검증 및 오류 시 역복원 가능 | **00 명시 승인 전 수행 금지**. PR80 W7·백업/복원·인증/실가족·운영 호스팅 관련 변경 금지 |
| **C. 공개/운영 배포·실가족 테스트** | 외부 환경 실증 가능 | 현재 승인되지 않았고, AdSense 보안 및 실가족/접근권한 게이트가 남아 **이번 안건 범위 밖** |

**00에 제안하는 판단:** W3 QA 후보는 이미 06이 두 회차 독립 검증했으므로 **A 증거 확정·유지**를 즉시 선택할 수 있다. 제품 dev 반영 **B는 AdSense 콘텐츠 P0·C안 보안 평가와 별도로 00이 일정·한정 변경 범위를 승인할 때만 진행**하는 것이 합리적이다. 사용자의 실폰 조작/실계정 제공은 이 단계에 필요하지 않다.

**향후 B 승인 시 정확한 실행 게이트:** (1) 직전 원본 dev SHA·blob이 위 고정값과 동일한지 다시 확인(달라지면 자동 중단), (2) 4줄 이외 앱 diff 0, W7 PR80 별도 유지, (3) 원시 테스트와 신규 dev 변경 SHA로 기능 회귀·320/390을 분리 검증, (4) 미저장 입력 3종 보호 및 사진·원장 불변, (5) 실패 시 정확 역패치/원장 불변 확인. 00의 *A 코드수정 승인*은 B 보호인터넷 시험이나 D 운영 배포를 자동 승인하지 않는다.

## 4. 최종 금지·미검증 항목

**지금 변경 0:** `dev`/`main`, PR #80, 실제 계정/아동 자료, 운영 IndexedDB·Netlify, 배포·광고·AdSense 검토 요청·유료API·기존 예약. 08 독립 보안에서 새로 확인한 Google AdSense 콘텐츠 가치 부족 [00 P0 #6979880572](https://github.com/jinbh99-arch/uri-homework-manager/issues/82#issuecomment-6979880572)은 09 담당 범위이며 02가 중복 수행하거나 광고계정에 접근하지 않는다. W7 WebKit Linux/macOS Blob seed `UnknownError`도 별도 미해결: [PR80](https://github.com/jinbh99-arch/uri-wrong-answer-qa/pull/80)의 W7가 안전하게 병합 가능한 상태라는 뜻이 아니다.

**인계:** 00은 이 승인 판단 패킷을 검토하여 **A 유지 / B 한정 승인 / 보완** 중 결정을 공식 #82에 기록할 수 있다. 단순 GitHub 문서/댓글은 기존 00 채팅의 실제 새 모델 응답/승인 증거가 아니다.
