# 02 WRONG 첫 화면 ACK 불명 상단 경고 A격리 후보 v1.0
- 날짜: 2026-11-21 KST. 제품 dev 3eac1ec8fbf9a38b75ca317c4088dd9c759ac39b, blob 250aff5b0a46490488b64f7b96a83c940d2d6c71 불변.
- 이전 A격리 HEAD d0497b0812dbc7f34903ecb9b022856706d0d1bd, index blob 63e31915875a79a2ebcf21d7c722daa9f8deeb98; 기존 중복방지 4/4 수락은 그대로 보존.
- 새 후보: `qa/wrong-ack-top-warning-native200-20261121`; index blob `a3d12711fa3a170645e01dd4c1b4e6e347f85132`. 원본 form-error(하단 role=alert)와 ACK busy/unknown 저장 차단·ID·사진 기록 로직 변경 없음.
- diff: ① 문서 최상단 부모 전용 role=note 요약 한 곳 ② 320/390 줄바꿈 안전 CSS·자녀 모드 숨김 ③ commit 성공 후 readback 실패일 때만 경고 요약 표시. 초기/정상 저장/일반 필드 오류에서는 표시하지 않음. 하단 form-error를 유지해 저장 직후 현재 스크롤 경고를 보존하며 고정 오버레이를 추가하지 않음.
- 시험 계약: 320/390 CSS px·실 Chromium 탭 zoom2, 최초 Tab→skip→main·Tab/Enter 저장, 원본 form-error 저장 직후 경고·scrollY0 최상단 요약 시야·헤더 비가림, 기존 UUID/사진 SHA·부모 메모 child DOM0·별도 컨테이너/동일 프로필 경계(가족 실제 인증 미구현 BLOCK), 가로넘침0·외부요청0·정확 역패치.
- 후보 보완은 **A격리 미수락**, CI 성공과 항목 PASS 분리. 제품 dev 승격·실계정/실기기/운영 ACK·실가족 인증·배포·예약 모두 N/T 또는 금지.
- 원시 신규 증거는 `wrong-ack-top-warning-native200-320390.yml` 단일 신규 push 작업에서 PNG/JSON·SHA/CRC 확인 후 06 독립 판정 요청. 이전 CI 44849711801 재실행 금지.
