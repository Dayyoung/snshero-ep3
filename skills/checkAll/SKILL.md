---
name: checkAll
description: SNSHero 3대 관리 문서(이슈문서 checkIssue · 개발문서 checkBug · 마케팅문서 checkMarket)를 gsheets CLI로 한 번에 조회해 미해결 항목을 우선순위(P0→P3)별로 일괄 소스코드 구현·수정하고, 통합 빌드 및 E2E 테스트 통과 후 로컬 커밋(git commit · 푸시 대기) 및 3개 시트 상태 최신화·구글 폼 보고까지 일괄 수행하는 통합 스킬 (자동 git push 금지, 사용자 확인 후 수동 푸시). Use whenever the user types /checkAll or asks to check/process all three SNSHero spreadsheets together.
---

# /checkAll 통합 스킬 지침서 (3대 문서 일괄 점검 및 처리)

## 대상 3대 문서 정보

| 구분 | 문서명 | Spreadsheet ID | 데이터 탭 | 상태/조치 갱신 열 | 요약 대시보드 범위 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **이슈 (`/checkIssue`)** | SNSHero 이슈문서 | `1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4` | `'게임 이슈 관리 로그'!A1:K200` | `J`열 (`완료`/`진행중`) | `'요약 대시보드'!A1:H15` |
| **개발 (`/checkBug`)** | SNSHero 개발문서 | `1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU` | `'개발개선점 분석 로그'!A1:K200` | `J`열 (`완료`/`진행중`) + `K`열 (`[완료·조치+검증] ...`) | `'요약 대시보드'!A1:H15` |
| **마케팅 (`/checkMarket`)** | SNSHero 마케팅문서 | `1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU` | `'마케팅 분석 로그'!A1:K200` | `J`열 (`완료`/`진행중` — 외부 전용은 상태 유지) | `'요약 대시보드'!B9:H15` |

---

## 수행 절차

### 1단계: 3대 시트 일괄 조회 (`gsheets` CLI)
1. `gsheets` CLI로 3개 시트를 모두 JSON으로 조회합니다:
   ```bash
   gsheets readonly read 1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4 "'게임 이슈 관리 로그'!A1:K200" --json
   gsheets readonly read 1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU "'개발개선점 분석 로그'!A1:K200" --json
   gsheets readonly read 1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU "'마케팅 분석 로그'!A1:K200" --json
   ```
2. 각 시트에서 `J`열(`진행 상태`)이 `'완료'` 또는 `'보류'`가 아닌 항목을 추출하고, `P0 → P1 → P2 → P3` 우선순위로 작업 목록을 정리합니다.
   - 마케팅 시트 항목은 `코드/저장소 완결형` vs `하이브리드형(코드 반영 후 진행중)` vs `외부 채널 전용(상태 유지)`으로 구분합니다.
3. 3개 시트 모두 새로 처리할 코드/저장소 미완료 항목이 `0`건이면 현재 요약 현황(각 시트의 `완료` / `진행중` / `외부 대기` 집계)만 보고하고 불필요한 수정을 하지 않습니다.

### 2단계: 3개 영역 소스코드 일괄 구현 · 패치
1. **이슈(`ISS-*`) · 개발(`DEV-*`) · 마케팅(`MKT-*`)** 순 또는 상호 연관 파일 단위로 중복 없이 일괄 수정·구현합니다.
2. **프로젝트 절대 원칙 준수**:
   - **382장 카드 풀 엄격 동결**: 수집 가능 카드 수(9종족 × 25 + 중립 157 = 382장)를 절대 임의 증감하지 않습니다.
   - **로컬스토리지 데이터 격리**: `/game.html`은 `hero_hs_*`, `/stone.html`은 `stone_hs_*` 네임스페이스를 엄격히 분리합니다. (`/stone.html`은 시트에 명시적으로 지정된 경우에만 최소 수정.)
   - **다국어 & UI**: 한국어/영어 동시 지원(`tr()` / `heroLang.ts`), 모바일(`100dvh`, 44px+ 터치 타깃) 및 PC 반응형 레이아웃 유지.
   - **네이버 도전만화 공식 링크**: `https://comic.naver.com/challenge/list?titleId=857363` 기준 유지.

### 3단계: 통합 빌드 및 실제 동작 E2E 검증 (필수 통과)
1. **정적 타입·프로덕션 빌드 검증**:
   ```bash
   npx tsc --noEmit && npm run build
   ```
2. **실제 런타임/브라우저 동작 테스트**:
   - 로컬 프리뷰 서버(`vite preview`) + Playwright/HTTP 스크립트로 이번 회차에서 수정된 모든 페이지(`/`, `/game`, `/book`, `/webtoon`, `/sns`, `/sitemap.xml`, `/llms.txt` 등)의 실제 렌더링, 기능 동작, KPI 기준, 콘솔/페이지 앱 에러 `0`건을 직접 검증합니다.
   - 실패 항목이 있으면 통과할 때까지 코드를 수정하고 재검증합니다.

### 4단계: 로컬 커밋 전용 (`git commit` · 자동 `git push` 절대 금지)
- 모든 테스트가 통과하면 이번 작업에서 변경한 파일만 스테이징하여 **로컬 커밋만** 수행하고, **절대 `git push`를 실행하지 않습니다**. 사용자가 확인 후 수동으로 푸시(`/git-push`)할 수 있도록 대기합니다:
  ```bash
  git add <수정된 파일들>
  git commit -m "fix(checkAll): resolve [ISS/DEV/MKT ID 목록] across all trackers"
  # 주의: git push는 자동 실행하지 않고 사용자 수동 확인 후 진행합니다.
  ```

### 5단계: 3개 구글 시트 일괄 최신화 & 작업 보고 후 종료
1. 각 시트의 처리 결과를 `gsheets mutate batch`로 정확한 셀(`J<row>`, 개발문서는 `J<row>` + `K<row>`)만 업데이트해 타 행의 수식·서식을 보존합니다.
   - 대시보드 집계 문자열 정확히 일치: `"완료"`, `"진행중"`, `"보류"`, `"점검완료·실행대기"`
2. 3개 시트의 `'요약 대시보드'`를 각각 다시 조회해 집계 수치가 정상 반영되었는지 검증합니다.
3. `WORK_LOGS.md`에 3대 문서 통합 처리 내역을 기록하고, 구글 폼 완료 보고 스크립트를 실행합니다:
   ```bash
   python3 skills/report-ex/scripts/submit_report.py --dept "개발" --task "[/checkAll] 3대 문서 통합 점검·수정 및 로컬 커밋 완료 (푸시 대기)" --status "작업완료" --details "[이슈/개발/마케팅 처리 ID 목록, 수정 요약, 빌드/E2E 검증 결과, 로컬 커밋 해시(푸시 대기), 3개 시트 최신화 완료]"
   ```
4. 문서별 처리 내역(`완료`/`진행중`/`외부 대기`), 검증 결과, 로컬 커밋 해시(수동 푸시 대기 안내)를 사용자에게 한국어로 보고하고 종료합니다.
