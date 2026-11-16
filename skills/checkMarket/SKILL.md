---
name: checkMarket
description: SNSHero 마케팅문서(1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU, 마케팅 분석 로그)를 gsheets CLI로 조회해 미완료 항목 중 코드·저장소에서 적용 가능한 항목을 수정하고, 실제 빌드 및 테스트 통과 후 원격 배포(git push) 및 시트 상태 최신화까지 일괄 수행하는 스킬. Use whenever the user types /checkMarket or asks to check/apply the SNSHero marketing spreadsheet.
---

# /checkMarket 스킬 지침서

## 대상 문서 정보
- **문서명**: SNSHero 마케팅문서
- **Spreadsheet ID**: `1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU`
- **URL**: `https://docs.google.com/spreadsheets/d/1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU/edit?gid=1#gid=1`
- **데이터 탭**: `'마케팅 분석 로그'` (`gid=1`)
- **대시보드 탭**: `'요약 대시보드'` (`gid=0`)
- **컬럼 구조 (`A:K`)**:
  - `A`: 분석 일시
  - `B`: 회차 ID (`MKT-001`, ...)
  - `C`: 마케팅 영역
  - `D`: 대상 페이지 및 소스 URL
  - `E`: 실제 라이브 현황 진단
  - `F`: 발견된 병목 및 이슈
  - `G`: 즉시 실행 마케팅 액션 및 실전 카피
  - `H`: 목표 핵심 KPI
  - `I`: 우선순위 (`P0`, `P1`, `P2`, `P3`)
  - `J`: 진행 상태 (`점검완료·실행대기`, `진행중`, `완료`, `보류`) — **반드시 대시보드 집계 문자열과 정확히 일치시킬 것**
  - `K`: 참조 URL

---

## 수행 절차

### 1단계: 미해결 마케팅 항목 조회 (`gsheets` CLI 사용)
1. `gsheets` CLI로 `'마케팅 분석 로그'` 시트를 조회합니다:
   ```bash
   gsheets readonly read 1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU "'마케팅 분석 로그'!A1:K200" --json
   ```
2. `J`열(`진행 상태`)이 `'완료'` 또는 `'보류'`가 아닌 항목을 추출하고 `P0 → P1 → P2 → P3` 순으로 분류합니다:
   - **코드/저장소 완결형**: `index.html`, `book.html`, `webtoon.html`, `PromoApp.tsx`, `HearthstoneApp.tsx`, `llms.txt`, `sitemap.xml`, `robots.txt`, `README.md`, 리다이렉트 등 저장소 수정만으로 100% 종결 가능한 항목 → 구현 완료 시 **`완료`** 처리.
   - **하이브리드형**: 코드/저장소 개선 + 외부 플랫폼(Google Search Console, Google Play 스토어, 문피아, 네이버 웹소설/도전만화 `titleId=857363`, 유튜브 스튜디오, 커뮤니티 배포 등) 수동 작업이 함께 포함된 항목 → 코드 부분 구현 후 **`진행중`** 처리(이미 외부 작업까지 확인된 경우 **`완료`**).
   - **외부 채널 전용**: 코드 수정 대상이 전혀 없는 외부 채널 작업 → 기존 상태(`점검완료·실행대기`) 유지 후 결과 안내.

### 2단계: 소스코드 반영 및 구현
1. SEO/AEO 메타태그, 구조화 데이터(`JSON-LD`), `llms.txt`, `sitemap.xml`, `robots.txt`, 리다이렉트, 프로모션 랜딩 FTUE 퍼널, 웹소설/웹툰 리더 브릿지, 인게임 딥링크·결제·백업·리텐션 UI를 소스코드에 정확히 구현합니다.
2. **주의사항**:
   - 네이버 도전만화 공식 링크는 `https://comic.naver.com/challenge/list?titleId=857363`를 기준으로 유지·검증합니다.
   - 382장 카드 수 동결 및 `/stone.html` 임의 수정 금지 원칙, `hero_hs_*` 로컬스토리지 보존 원칙을 준수합니다.

### 3단계: 실제 테스트 및 검증 (필수 통과)
1. **정적 타입·빌드 검증**:
   ```bash
   npx tsc --noEmit && npm run build
   ```
2. **실제 런타임/브라우저 동작 테스트**:
   - 로컬 프리뷰 서버(`vite preview`) 또는 Playwright/HTTP 검증을 통해 수정된 페이지(`/`, `/game`, `/book`, `/webtoon`, `/sitemap.xml`, `/llms.txt`, 리다이렉트 경로 등)의 실제 렌더링, 딥링크 작동, 콘솔/페이지 에러 `0`건을 확인합니다.
   - 실패 시 수정 후 재검증하여 통과할 때까지 진행합니다.

### 4단계: 로컬 커밋 및 원격 배포 (`git push`)
- 테스트 통과 확인 후 커밋 및 원격 푸시를 실행합니다:
  ```bash
  git add <수정된 파일들>
  git commit -m "feat(marketing): apply [MKT-XXX 목록] and verify live bundle"
  git push origin main
  ```

### 5단계: 구글 시트 최신화 & 작업 보고 후 종료
1. `gsheets mutate batch`로 해당 행의 `J`열(`진행 상태`)만 정확히 갱신합니다 (`"완료"` 또는 `"진행중"`).
2. `'요약 대시보드'`(`'요약 대시보드'!B9:H15`)를 조회해 상태 집계 반영을 확인합니다.
3. `WORK_LOGS.md` 누적 기록 및 구글 폼 보고 스크립트를 실행합니다:
   ```bash
   python3 skills/report-ex/scripts/submit_report.py --dept "개발" --task "[/checkMarket] 마케팅 개선사항 적용 및 배포 완료" --status "작업완료" --details "[처리한 MKT ID, 구현/테스트 결과, 커밋/푸시 해시, 시트 최신화 결과]"
   ```
4. 완료/진행중/외부대기 내역과 테스트·배포 결과를 한국어로 보고하고 종료합니다.
