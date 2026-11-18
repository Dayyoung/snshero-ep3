---
name: checkBug
description: SNSHero 개발문서(1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU, 개발개선점 분석 로그)를 gsheets CLI로 조회해 미해결 결함·개발 개선 항목을 소스코드에 적용하고, 실제 빌드 및 E2E 테스트 통과 후 로컬 커밋(git commit · 푸시 대기) 및 시트 상태·조치내역 최신화까지 일괄 수행하는 스킬 (자동 git push 금지, 사용자 확인 후 수동 푸시). Use whenever the user types /checkBug or asks to check/fix the SNSHero dev/bug spreadsheet.
---

# /checkBug 스킬 지침서

## 대상 문서 정보
- **문서명**: SNSHero 개발문서
- **Spreadsheet ID**: `1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU`
- **URL**: `https://docs.google.com/spreadsheets/d/1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU/edit?gid=0#gid=1`
- **데이터 탭**: `'개발개선점 분석 로그'` (`gid=1`)
- **대시보드 탭**: `'요약 대시보드'` (`gid=0`)
- **컬럼 구조 (`A:K`)**:
  - `A`: 분석 일시
  - `B`: 회차 ID (`DEV-001`, ...)
  - `C`: 개발개선 영역
  - `D`: 대상 페이지 및 소스 URL
  - `E`: 실제 라이브 현황 진단
  - `F`: 발견된 결함 및 이슈
  - `G`: 즉시 실행 개발 패치 및 구현 가이드
  - `H`: 목표 핵심 기대효과
  - `I`: 우선순위 (`P0`, `P1`, `P2`, `P3`)
  - `J`: 진행 상태 (`점검완료·실행대기`, `진행중`, `완료`, `보류`) — **반드시 대시보드 집계 문자열과 정확히 일치시킬 것**
  - `K`: 조치 및 검증 내역 (`[DEV-XXX 완료·조치+검증] ...` 형식으로 상세 기재)

---

## 수행 절차

### 1단계: 미해결 개발·버그 항목 조회 (`gsheets` CLI 사용)
1. `gsheets` CLI로 `'개발개선점 분석 로그'` 시트를 조회합니다:
   ```bash
   gsheets readonly read 1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU "'개발개선점 분석 로그'!A1:K200" --json
   ```
2. `J`열(`진행 상태`)이 `'완료'` 또는 `'보류'`가 아닌 모든 행(`'점검완료·실행대기'`, `'진행중'`, 공란)을 추출하고 `P0 → P1 → P2 → P3` 우선순위로 작업 대상을 확정합니다.
3. 미해결 항목이 없으면 현재 상태를 요약 보고하고 종료합니다.

### 2단계: 결함 수정 및 소스코드 반영
1. 각 항목의 `D`(대상 URL), `F`(결함 및 이슈), `G`(즉시 실행 개발 패치), `H`(기대효과)를 근거로 관련 엔진·UI·에셋·데이터 파일을 수정합니다.
2. **프로젝트 핵심 원칙 준수**:
   - **382장 카드 풀 엄격 동결**: 수집 가능 카드 수 382장을 절대 변경하지 않습니다.
   - **단일 진실 공급원**: 게임 상태는 `localStorage`(`hero_hs_*`) 기반으로 무결하게 보존합니다.
   - **`/stone.html` 보호**: 개발문서 항목이 명시적으로 `/stone.html` 수정을 지시하지 않는 한 `/stone.html`(`src/stone/**`)을 임의로 변경하지 않습니다.
   - **KO/EN 다국어 동시 반영**: 텍스트/카드명/UI 수정 시 한국어 및 영어 모두 정상 동작하도록 처리합니다.

### 3단계: 실제 테스트 및 검증 (필수 통과)
1. **정적 타입·빌드 검증**:
   ```bash
   npx tsc --noEmit && npm run build
   ```
2. **실제 동작 테스트**:
   - 로컬 프리뷰 서버(`vite preview` 또는 `scripts/start-server.sh`)와 Playwright E2E/엔진 스크립트로 수정한 버그의 재현 시나리오(전투 판정, UI 조작, 모바일/데스크톱 뷰포트, 콘솔/페이지 에러 `0`건 등)를 직접 실행해 통과를 확인합니다.
   - 테스트 실패 시 통과할 때까지 수정 후 재검증합니다.

### 4단계: 로컬 커밋 (`git commit` · 원격 푸시 보류)
- 모든 테스트가 통과한 후 **로컬 커밋만** 실행하고, **절대 `git push`를 실행하지 않습니다**. 사용자가 확인 후 수동으로 푸시(`/git-push`)할 수 있도록 대기합니다:
  ```bash
  git add <수정된 파일들>
  git commit -m "fix(dev): resolve [DEV-XXX 목록] from SNSHero dev/bug log"
  # 주의: git push는 자동 실행하지 않고 사용자 수동 확인 후 진행합니다.
  ```

### 5단계: 구글 시트 최신화(`J`열 + `K`열) & 작업 보고 후 종료
1. `gsheets mutate batch`로 해결된 행의 `J`열(`진행 상태`)을 `"완료"`로, `K`열(`조치 및 검증 내역`)을 `[완료·조치+검증] <수정 파일·핵심 패치·테스트 결과>` 형식으로 업데이트합니다.
2. `'요약 대시보드'`(`'요약 대시보드'!A1:H15`)를 조회해 집계 수치가 정상 반영되었는지 확인합니다.
3. `WORK_LOGS.md`에 처리 내역을 누적 기록합니다.
4. 수정·검증·배포·문서 최신화 내역을 사용자에게 한국어로 상세히 보고하고 종료합니다.
