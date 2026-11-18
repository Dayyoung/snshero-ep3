---
name: checkIssue
description: SNSHero 이슈문서(1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4, 게임 이슈 관리 로그)를 gsheets CLI로 조회해 미해결 이슈를 소스코드에 구현·수정하고, 실제 빌드 및 E2E 테스트 통과 후 로컬 커밋(git commit · 푸시 대기) 및 시트 상태 최신화까지 일괄 수행하는 스킬 (자동 git push 금지, 사용자 확인 후 수동 푸시). Use whenever the user types /checkIssue or asks to check/resolve the SNSHero issue spreadsheet.
---

# /checkIssue 스킬 지침서

## 대상 문서 정보
- **문서명**: SNSHero 이슈문서
- **Spreadsheet ID**: `1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4`
- **URL**: `https://docs.google.com/spreadsheets/d/1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4/edit?gid=1#gid=1`
- **데이터 탭**: `'게임 이슈 관리 로그'` (`gid=1`)
- **대시보드 탭**: `'요약 대시보드'` (`gid=0`)
- **컬럼 구조 (`A:K`)**:
  - `A`: 등록 일시
  - `B`: 이슈 ID (`ISS-001`, ...)
  - `C`: 이슈 영역
  - `D`: 대상 페이지 및 소스 URL
  - `E`: 실제 라이브 현황 진단
  - `F`: 발견된 병목 및 이슈
  - `G`: 즉시 실행 조치 및 개발 명세
  - `H`: 목표 핵심 KPI / 검증 기준
  - `I`: 우선순위 (`P0`, `P1`, `P2`, `P3`)
  - `J`: 진행 상태 (`점검완료·실행대기`, `진행중`, `완료`, `보류`) — **반드시 대시보드 집계 문자열과 정확히 일치시킬 것**
  - `K`: 참조 URL

---

## 수행 절차

### 1단계: 미해결 이슈 조회 (`gsheets` CLI 사용)
1. `gsheets` CLI를 확인·초기화하고(필요 시 `~/.gemini/config/plugins/gsheets/skills/gsheets/scripts/gsheets --version`), 시트 전체를 JSON으로 읽습니다:
   ```bash
   gsheets readonly read 1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4 "'게임 이슈 관리 로그'!A1:K200" --json
   ```
2. `J`열(`진행 상태`)이 `'완료'` 또는 `'보류'`가 아닌 모든 행(예: `'점검완료·실행대기'`, `'진행중'`, 공란)을 추출하고 `P0 → P1 → P2 → P3` 우선순위로 정렬합니다.
3. 미해결 이슈가 `0`건이면 요약 후 종료합니다.

### 2단계: 소스코드 반영 및 구현
1. 각 이슈의 `D`(대상 URL), `F`(병목/이슈), `G`(즉시 실행 조치 및 개발 명세), `H`(검증 기준)를 정밀 분석해 관련 소스코드를 수정합니다.
2. **프로젝트 핵심 원칙 준수**:
   - **382장 카드 풀 엄격 동결**: 수집 가능 카드 수(9종족 × 25 + 중립 157 = 382장)를 임의 증감하지 않습니다.
   - **로컬스토리지 격리**: `/game.html`은 `hero_hs_*`, `/stone.html`은 `stone_hs_*` 네임스페이스를 엄격히 분리합니다. (`/stone.html`은 이슈 문서에 명시적으로 요구된 항목만 최소 범위로 수정합니다.)
   - **다국어 & UI**: 한국어/영어 동시 지원(`tr()` / `heroLang.ts`), 모바일(`100dvh`, 44px+ 터치 타깃) 및 PC 반응형 깨짐 방지.

### 3단계: 실제 테스트 및 검증 (필수 통과)
1. **정적 타입·빌드 검증**:
   ```bash
   npx tsc --noEmit && npm run build
   ```
2. **실제 런타임/브라우저 동작 테스트**:
   - 프리뷰 서버(`vite preview` 또는 `scripts/start-server.sh`)를 기동하거나 Playwright/Node E2E 스크립트로 수정된 이슈 영역(`/`, `/game`, `/stone.html`, `/sns`, `/book`, `/webtoon` 등)의 실제 동작, 레이아웃, 콘솔/페이지 에러 `0`건, 핵심 KPI 기준(`H`열)을 직접 검증합니다.
   - 테스트 실패 시 통과할 때까지 코드를 수정하고 재검증합니다. (테스트 미통과 시 절대 배포하지 않습니다.)

### 4단계: 로컬 커밋 (`git commit` · 원격 푸시 보류)
- 모든 테스트가 통과하면 변경 파일을 스테이징하여 **로컬 커밋만** 수행하고, **절대 `git push`를 실행하지 않습니다**. 사용자가 변경 내역을 확인한 뒤 수동으로 푸시(`/git-push`)할 수 있도록 대기합니다:
  ```bash
  git add <수정된 파일들>
  git commit -m "fix(issue): resolve [이슈 ID 목록] from SNSHero issue tracker"
  # 주의: git push는 자동 실행하지 않고 사용자 수동 확인 후 진행합니다.
  ```

### 5단계: 구글 시트 최신화 & 작업 보고 후 종료
1. 해결된 이슈 행의 `J`열(`진행 상태`)을 `"완료"`로 업데이트합니다(부분 해결이나 외부 작업 잔여 시 `"진행중"`). 타 행의 서식·수식을 훼손하지 않도록 `gsheets mutate batch`로 해당 셀(`J<row>`)만 정확히 기록합니다.
2. `'요약 대시보드'`(`'요약 대시보드'!A1:H15`)를 조회해 `"완료"` 건수가 정상 반영되었는지 검증합니다.
3. `WORK_LOGS.md`에 처리 내역을 기록합니다.
4. 처리한 이슈 목록, 테스트 결과, 배포 커밋, 문서 갱신 현황을 사용자에게 한국어로 보고하고 종료합니다.
