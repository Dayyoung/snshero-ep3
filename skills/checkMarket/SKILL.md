---
name: checkMarket
description: SNSHero 마케팅문서(1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU, 마케팅 분석 로그)를 gsheets CLI로 조회해 코드·저장소 개선뿐만 아니라 연동된 MCP(GA4, Google Ads, YouTube, Search Console, Google Play, GitHub, Chrome DevTools)를 활용해 외부 채널·웹게임 포털(CrazyGames, itch.io, GDevelop/gd.games)·커뮤니티(정책/공지 사전 분석 필수) 마케팅 항목까지 처리하고, 빌드·검증 후 로컬 커밋(git commit · 푸시 대기) 및 시트 상태 최신화까지 일괄 수행하는 스킬 (자동 git push 금지, 사용자 확인 후 수동 푸시). Use whenever the user types /checkMarket or asks to check/apply the SNSHero marketing spreadsheet.
---

# /checkMarket 스킬 지침서 (v2 — Multi-MCP & Web Game Portal Edition)

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
  - `J`: 진행 상태 (`점검완료·실행대기`, `진행중`, `완료`, `보류`) — **반드시 대시보드 집계 문자열과 정확히 일치시킬 것** (비표준 상태값 예: `'제안 완료'` 발견 시 처리 과정에서 표준 상태로 정규화)
  - `K`: 참조 URL

---

## 연동된 마케팅 MCP & 도구 체계 (`~/.gemini/config/mcp_config.json`)

| MCP / 도구 | 담당 채널 및 계정 | `/checkMarket` 활용 범위 |
| :--- | :--- | :--- |
| **`gsheets` CLI** | Google Sheets (`dryudryu@gmail.com`) | 마케팅 로그 조회, 상태 일괄 갱신, 대시보드 집계 검증 |
| **`analytics-mcp`** | GA4 (`properties/223457203`, `snshero-1257`) | 채널·UTM별 세션/전환(`hero_first_pack_opened`, `hero_first_battle_started`, `purchase`)·퍼널 실측 및 KPI 검증 |
| **`google-ads-mcp`** | Google Ads (`3072359722`) | 캠페인 성과 조회, 광고 에셋/영상 업로드, 라벨 관리 |
| **`youtube-snshero-mcp`** | YouTube `@snshero` (`UCA6QmKiPstbiyBUHtnSMxyA`) | 영상 목록·메타 조회, 구버전 설명란/링크 일괄 치환, 다국어 로컬라이징 수정, 댓글 등록, 영상/쇼츠 업로드 |
| **`gsc-mcp`** | Google Search Console (`snshero.com`) | 검색어 CTR/노출수 조회, URL 색인 검사, `sitemap.xml` 제출, Indexing API 갱신 알림 |
| **`google-play-mcp`** | Google Play (`com.dryudryu.SNSHero`) | 다국어 스토어 등록정보(제목·짧은 설명·자세한 설명) 조회/교체, 유저 리뷰 조회 및 답글 |
| **`github-mcp`** | GitHub (`Dayyoung/snshero` 외) | 저장소 About/Homepage/Topics 갱신, Release 발행(`v2.0.0` 등), 구버전 레포 아카이브 |
| **`chrome-devtools-marketing`** | 영구 로그인 Chrome 프로필 (`~/.gemini/config/chrome_marketing_profile`) | 공식 API가 없는 외부 콘솔(YouTube Studio 댓글 고정, GSC URL 삭제, 문피아, 네이버 웹소설/도전만화/컷츠, PacPik), **웹게임 포털(CrazyGames·itch.io·GDevelop/gd.games)**, **커뮤니티 정책 분석 및 게시** |

---

## 커뮤니티·포털 게시 절대 원칙: 정책·공지 사전 분석 (Policy-First Governance)

> [!IMPORTANT]
> **외부 커뮤니티(Reddit, GeekNews, Disquiet, 인벤, 디시인사이드, 아카라이브, 루리웹, PacPik, 문피아/네이버 등) 및 웹게임 포털(CrazyGames, itch.io, GDevelop/gd.games, Poki 등)에 글을 등록하거나 빌드를 제출할 때는, 절대로 시트의 초안 카피를 그대로 복사·게시하지 않습니다.**

모든 외부 게시·제출 작업 전 반드시 아래 **3단계 정책 준수 프로토콜**을 수행합니다:
1. **1단계 — 공지사항·규칙·심사 정책 최우선 분석**:
   - `chrome-devtools-marketing`으로 해당 게시판의 **상단 공지사항, 사이드바 규칙(Rules), 이용약관, 심사 가이드라인**을 먼저 열어 핵심 제약사항을 추출합니다.
   - 필수 점검 항목:
     - **말머리 / 플레어(Flair) / 태그** 의무 여부
     - **자기홍보(Self-Promotion) 규정**: 1:10 활동 비율, 주간 홍보 횟수 제한, 특정 요일(예: Feedback Friday / 홍보 게시판 전용) 제한
     - **링크·UTM·수익화 금지 규정**: 외부 URL/단축URL/UTM 금지, 인앱결제·광고·코인 언급 금지, 개발자 본인 인증 요구 여부
     - **웹게임 포털 전용 정책**:
       - **CrazyGames** (`https://www.crazygames.com/` / `https://developer.crazygames.com/`): 외부 이탈 링크·자체 결제·외부 광고(AdSense 등) 제거, CrazyGames SDK v3 라이프사이클 훅, 상대경로 HTML5 zip 준수
       - **itch.io** (`https://itch.io/`): HTML5 iframe 상대경로(`./`) 호환, 커버(630×500)·스크린샷·적합 태그·Devlog 규칙 준수
       - **GDevelop / gd.games** (`https://gdevelop.io/` / `https://gd.games/`): **gd.games가 GDevelop 엔진 제작물 전용 정책인지 최우선 확인** 후, 전용 제한 시 GDevelop 경량 프로모션 데모 제작 또는 포럼 정책에 맞는 방식으로만 진행
2. **2단계 — 커뮤니티 맞춤형 리라이팅 & 정책 필터링**:
   - 정책 위반 소지가 있는 과장 홍보 문구·금지 링크·부적합 톤을 제거하고, 각 커뮤니티가 선호하는 형식(예: GeekNews/Disquiet → 기술 회고·아키텍처 중심, Reddit `r/WebGames` → 무료 무설치 플레이 링크와 피드백 요청 중심, 국내 게임 커뮤니티 → 직접 플레이 GIF + 솔직한 1인 개발 밸런스 피드백 요청)으로 원고를 재작성합니다.
   - 중복/도배 방지를 위해 동일 게시판 최근 게시 이력을 먼저 확인합니다.
3. **3단계 — 최종 정책 체크리스트 검증 후 게시**:
   - `[ ] 공지·규칙 위반 요소 0건` / `[ ] 필수 말머리·태그·이미지 규격 일치` / `[ ] 중복 게시 아님` 확인.
   - 영구 정지 위험이 있거나 민감한 커뮤니티의 첫 게시물은 **정책 요약 + 맞춤 초안**을 사용자에게 먼저 보여주고 확인받은 뒤 최종 등록합니다.

---

## 수행 절차

### 1단계: 시트 조회 + GA4/Ads 실측 현황 파악
1. `gsheets` CLI로 `'마케팅 분석 로그'` 시트를 조회합니다:
   ```bash
   gsheets readonly read 1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU "'마케팅 분석 로그'!A1:K300" --json
   ```
2. `J`열(`진행 상태`)이 `'완료'` 또는 `'보류'`가 아닌 모든 항목(`점검완료·실행대기`, `진행중`, 비표준 `'제안 완료'` 포함)을 추출하고 `P0 → P1 → P2 → P3` 순으로 분류합니다:
   - **① 코드/저장소 완결형**: `index.html`, `book.html`, `webtoon.html`, `PromoApp.tsx`, `HearthstoneApp.tsx`, `llms.txt`, `sitemap.xml`, `robots.txt`, `firebase.json` 리다이렉트, 포털 전용 빌드 설정 등 저장소 수정만으로 100% 종결 가능한 항목 → 구현·검증 후 **`완료`**.
   - **② 연동 MCP 직접 실행형**: `youtube-snshero-mcp`, `gsc-mcp`, `google-play-mcp`, `github-mcp`, `google-ads-mcp`로 직접 조회·수정 가능한 항목 → API 실행·검증 후 **`완료`** (동일 채널의 중복 누적 `진행중` 항목도 실제 반영 확인 시 일괄 **`완료`** 처리).
   - **③ 브라우저(Chrome DevTools) 실행형**: `chrome-devtools-marketing`의 로그인 세션으로 외부 콘솔(YouTube Studio, GSC URL 삭제, 문피아, 네이버 웹소설/도전만화/컷츠, PacPik), 웹게임 포털(**CrazyGames, itch.io, GDevelop/gd.games**), 커뮤니티(정책 사전 분석 필수)에 직접 반영 가능한 항목 → 실행 완료 시 **`완료`**, 로그인 필요 시 사용자에게 로그인 요청 후 재개.
   - **④ 하이브리드형**: 코드 부분 + 미인증 외부 채널이 섞인 경우 → 가능한 부분까지 완료 후 **`진행중`** 유지 및 남은 수동/로그인 단계 명시.
3. 필요 시 `analytics-mcp`(`run_report`, `run_funnel_report`)로 최근 7~28일 채널/랜딩/전환 KPI를 실측해 우선순위를 보정하고, 이미 KPI가 충족되거나 구버전 트래픽 누수가 0건인 항목을 검증합니다.

### 2단계: 소스코드 반영 및 MCP/포털/커뮤니티 실행
1. **코드·SEO/AEO·FTUE·포털 빌드**:
   - SEO/AEO 메타태그, JSON-LD, `llms.txt`, `sitemap.xml`, `robots.txt`, `firebase.json` 리다이렉트, 프로모션/인게임 FTUE, 웹소설/웹툰 브릿지, 웹게임 포털용 빌드 타깃(CrazyGames/itch.io/gd.games)을 정확히 구현합니다.
   - **필수 준수**: 네이버 도전만화 공식 링크(`https://comic.naver.com/challenge/list?titleId=857363`) 유지·검증, 382장 카드 수 동결 및 `/stone.html` 임의 수정 금지, `hero_hs_*` 로컬스토리지 보존, 한·영 이중 언어(`heroLang.ts`) 및 모바일 44px+ 터치 최적화 준수.
2. **MCP / 외부 채널 실행**:
   - 수정형 MCP(`youtube_bulk_find_replace`, `play_update_listing` 등)는 반드시 `dry_run=True`로 먼저 대상을 확인한 뒤 적용합니다.
   - 커뮤니티·포털 게시는 반드시 위 **정책·공지 사전 분석 3단계**를 거칩니다.

### 3단계: 실제 테스트 및 검증 (필수 통과)
1. **코드 변경이 있을 경우 정적 타입·빌드 검증**:
   ```bash
   npx tsc --noEmit && npm run build
   ```
2. **실제 런타임/브라우저 동작 테스트**:
   - 로컬 프리뷰 서버(`vite preview`) 또는 Playwright/Chrome DevTools를 통해 수정된 페이지(`/`, `/game`, `/book`, `/webtoon`, `/sitemap.xml`, `/llms.txt`, 리다이렉트 경로 등)의 데스크톱·모바일 및 한·영 양방향 렌더링과 콘솔 에러 `0`건을 확인합니다.
   - 외부 채널 변경 시 해당 MCP 조회 또는 페이지 확인으로 실제 라이브 반영을 검증합니다.

### 4단계: 로컬 커밋 (`git commit` · 원격 푸시 보류)
- 코드/스킬 변경 및 테스트 통과 확인 후 **로컬 커밋만** 실행하고, **절대 `git push`를 실행하지 않습니다**. 사용자가 확인 후 수동으로 푸시(`/git-push`)할 수 있도록 대기합니다:
  ```bash
  git add <수정된 파일들>
  git commit -m "feat(marketing): apply [MKT-XXX 목록] and verify live bundle"
  # 주의: git push는 자동 실행하지 않고 사용자 수동 확인 후 진행합니다.
  ```

### 5단계: 구글 시트 최신화 & 작업 보고 후 종료
1. `gsheets mutate batch`로 처리된 행의 `J`열(`진행 상태`)을 표준 문자열(`"완료"` 또는 `"진행중"`)로 정확히 갱신합니다. (비표준 `'제안 완료'` 및 밀린 행이 있으면 함께 정리합니다.)
2. `'요약 대시보드'`(`'요약 대시보드'!B9:H15`)를 조회해 완료율 및 상태 집계 반영을 확인합니다.
3. `WORK_LOGS.md`에 실행 일시, 처리한 `MKT-XXX` 내역, MCP/포털/커뮤니티 정책 검토 결과, 테스트 결과를 누적 기록합니다.
4. 완료/진행중/로그인 대기 내역과 최신 완료율을 한국어로 보고하고 종료합니다.
