---
name: showMarket
description: SNSHero 마케팅문서(1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU, 마케팅 분석 로그)를 macOS 기본/Chrome 브라우저 창으로 즉시 열어 표시하고 현재 요약 현황을 안내하는 스킬. Use whenever the user types /showMarket or asks to open/show the SNSHero marketing spreadsheet in browser.
---

# /showMarket 스킬 지침서

## 대상 문서 정보
- **문서명**: SNSHero 마케팅문서
- **Spreadsheet ID**: `1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU`
- **데이터 탭 (`'마케팅 분석 로그'`, `gid=1`) URL**:
  `https://docs.google.com/spreadsheets/d/1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU/edit?gid=1#gid=1`
- **요약 대시보드 탭 (`'요약 대시보드'`, `gid=0`) URL**:
  `https://docs.google.com/spreadsheets/d/1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU/edit?gid=0#gid=0`

---

## 수행 절차

1. **브라우저 창 열기 대상 URL 결정**:
   - 사용자가 `"요약"` 또는 `"대시보드"`를 함께 요청한 경우 `'요약 대시보드'`(`gid=0`) URL을 사용합니다.
   - 그 외 기본 호출(`/showMarket`) 시에는 `'마케팅 분석 로그'`(`gid=1`) URL을 사용합니다.
2. **macOS 브라우저 창으로 즉시 표시**:
   - `run_command`로 아래 명령을 실행해 사용자의 실제 데스크톱 브라우저(Google Chrome 우선, 미설치 시 시스템 기본 브라우저) 창/탭에 시트를 띄웁니다:
     ```bash
     URL="https://docs.google.com/spreadsheets/d/1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU/edit?gid=1#gid=1"
     open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"
     ```
3. **현재 진행 현황 요약 조회 (선택적 보조 안내)**:
   - 가능하면 `gsheets readonly read 1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU "'마케팅 분석 로그'!B1:J50" --json`으로 전체 건수와 미완료(`완료`가 아닌 행) 건수를 함께 조회해 안내합니다.
   - 주의: **`/showMarket`은 읽기/열람 전용 스킬이므로 소스코드 수정·커밋·푸시나 시트 내용 변경은 수행하지 않습니다.** (마케팅 반영·배포까지 실행하려면 `/checkMarket`을 안내합니다.)
4. **응답 작성**:
   - 한국어로 브라우저 창 오픈 완료 여부, 클릭 가능한 Google Sheets 링크, 현재 대기/완료 건수를 간결히 안내합니다.
