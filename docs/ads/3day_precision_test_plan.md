# SNSHero Google Ads (`307-235-9722`) 0노출 진단 & 3일 소액 정밀 테스트 계획

- **작성 일시**: 2026-11-24 KST
- **광고 계정 ID**: `307-235-9722` (`KRW`, `billing_setup.id: 418711328` `APPROVED`)
- **연동 태그**: `AW-980426001` + GA4 `G-MT60DTV1KJ`

---

## 1. 실측 진단 결과 (Google Ads API & GA4 최근 7일 기준)

| 캠페인명 | 캠페인 ID | 현재 상태 | 일 예산 | 입찰 전략 & CPC 상한 | 실측 노출 / 클릭 (11/18~11/24) |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **`SNSHero_Search_TCG_KR`** | `24487212616` | `ENABLED` (`ELIGIBLE`) | 12,000원 | `TARGET_SPEND` / **상한 800원** (광고그룹 기본 **250원**) | **0노출 / 0클릭 / 0원** |
| **`SNSHero_Search_TCG_EN`** | `24475998192` | **`PAUSED`** | 10,000원 | `TARGET_SPEND` / **상한 700원** (광고그룹 기본 **400원**) | **0노출 / 0클릭 / 0원** |

> *(참고: GA4 최근 7일 `google_ads / cpc` 4세션 · `youtube_shorts / cpc` 4세션은 기존 테스트/단축 링크 잔여 유입이며, 위 Search 캠페인 2건은 `2026-11-18 16:25:00` 생성 이후 6일 연속 실제 노출이 0건입니다.)*

### 왜 `ENABLED`인데도 0노출이었는가? (핵심 원인 3가지)
1. **키워드 검색량 극소 (`RARELY_SERVED`) + 지나치게 좁은 일치**:
   - `무설치 카드게임` 키워드가 Google Ads 시스템상 `RARELY_SERVED`(게재 빈도 낮음) 상태로 분류됨.
   - 한국어 시장에서 `브라우저 카드게임`, `무설치 카드게임`, `무료 덱빌딩 게임`의 순수 `PHRASE`(구문) 검색량 자체가 매우 작음.
2. **입찰 상한 과소 설정 (250원 ~ 800원)**:
   - `하스스톤`, `슬레이 더 스파이어`, `전략 카드게임` 등 실제 검색량이 있는 키워드는 국내 게임/앱 광고 경쟁 단가 때문에 250~800원 상한으로는 경매 상위 노출에서 전량 탈락.
3. **영어권(`SNSHero_Search_TCG_EN`) 캠페인 일시중지(`PAUSED`) 상태**:
   - US·UK·CA·AU·DE·SG 6개국 영어권은 `"free browser card game"`, `"no download card game"`, `"games like hearthstone free"` 검색 모수가 한국보다 훨씬 크지만, 캠페인 자체가 `PAUSED` 상태라 전혀 돌지 않고 있음.

---

## 2. 3일 소액 정밀 테스트 설계 (총 상한 최대 60,000원)

> **목표**: 광고비 대규모 투입 전에 **"실제 클릭당 비용(CPC)"**, **"체류시간 (현재 4초 이탈 vs 60초+ 게임 진입)"**, **"첫 3팩 개봉/전투 진입률"**을 72시간 안에 실측 검증한다.

### 트랙 A — 한국어 고의도 테스트 (`SNSHero_Search_TCG_KR` / `24487212616`)
- **일 예산**: **10,000원/일 × 3일** (최대 30,000원)
- **입찰 전략 조정**: `클릭수 최대화(TARGET_SPEND)` 유지, **최대 CPC 입찰가 상한 `800원` → `1,500원`**(광고그룹 기본 `250원` → `800원`)으로 상향해 경매 탈락 해제
- **키워드 최적화**:
  - 유지/승격: `"하스스톤 같은 게임"`, `"무료 카드게임"`, `"덱빌딩 게임"`, `"전략 카드게임"`, `"브라우저 게임 추천"`
  - 넓은 매칭 테스트 추가(`PHRASE`): `"PC 무료 카드게임"`, `"설치없는 게임"`, `"웹게임 추천"`
  - **필수 제외(Negative) 키워드 보강**: `포커`, `맞고`, `고스톱`, `섯다`, `카지노`, `홀덤`, `바둑이`, `도박`, `슬롯`, `토토`, `모바일 앱 다운로드`, `구글플레이 쿠폰`
- **최종 도착 URL 비교 테스트**:
  - 광고 1(직행): `https://snshero.com/game?open=pack3&lang=ko&utm_source=google_ads&utm_medium=cpc&utm_campaign=kr_test3d_game`
  - 광고 2(설득 랜딩): `https://snshero.com/free-browser-card-game/?utm_source=google_ads&utm_medium=cpc&utm_campaign=kr_test3d_seo`

### 트랙 B — 영어권 고의도 테스트 (`SNSHero_Search_TCG_EN` / `24475998192`)
- **캠페인 상태 변경**: `PAUSED` → **`ENABLED`** (사용자 승인 후 활성화)
- **일 예산**: **10,000원/일 × 3일** (최대 30,000원)
- **타깃 국가**: US(`2840`), UK(`2826`), CA(`2124`), AU(`2036`), DE(`2276`), SG(`2702`) — 영문(`1000`)
- **입찰 전략 조정**: 최대 CPC 상한 `700원` → **`1,200원`**, 광고그룹 기본 `400원` → **`700원`**
- **핵심 키워드(`PHRASE`)**: `"free browser card game"`, `"no download card game"`, `"games like hearthstone free"`, `"browser deckbuilder game"`, `"card battle game online"`, `"play tcg online free"`
- **필수 제외 키워드 보강**: `poker`, `casino`, `blackjack`, `solitaire`, `tarot`, `pokemon`, `yugioh`, `mtg arena`, `apk`, `ios`, `crypto`, `nft`
- **최종 도착 URL 비교 테스트**:
  - 광고 1(직행): `https://snshero.com/en/game/?open=pack3&lang=en&utm_source=google_ads&utm_medium=cpc&utm_campaign=en_test3d_game`
  - 광고 2(설득 랜딩): `https://snshero.com/en/free-browser-card-game/?utm_source=google_ads&utm_medium=cpc&utm_campaign=en_test3d_seo`

---

## 3. 3일 후 판정 기준 (Go / Fix / Stop)

테스트 종료 시(72시간 후) Google Ads + GA4(`utm_campaign=*test3d*`)를 비교하여 다음 기준으로 판정한다:

| 판정 | 조건 | 다음 액션 |
| :---: | :--- | :--- |
| **🟢 GO (확장 가능)** | 평균 CPC `≤ 600원`, GA4 참여율 `≥ 45%`, 평균 체류시간 `≥ 90초` | 수익화(보급소/리텐션) 대비 효율 계산 후 일 예산 증액 및 Shorts 리마케팅 병행 |
| **🟡 FIX (랜딩/온보딩 수정)** | 클릭은 발생하나 평균 체류시간 `< 20초` 또는 참여율 `< 25%` | **광고 추가 지출 즉시 중단**, `/game` 직행 대신 `/free-browser-card-game/` 경유 + 첫 5초 튜토리얼/카드팩 연출 개선 먼저 진행 |
| **🔴 STOP (채널 전환)** | 상한 1,500원에서도 노출 미미 또는 CPC `> 1,200원` + 전환 0건 | 검색광고 비중을 줄이고 **웹게임 포털(CrazyGames·Yandex) + 15초 인게임 쇼츠 클립 + 크리에이터 시딩**으로 예산/시간 집중 |

---

## 4. 사용자 확인 후 실행 체크리스트
- [ ] Google Ads 웹 콘솔(또는 승인 후 자동 제어)에서 `SNSHero_Search_TCG_KR` 입찰 상한 1,500원 · 일 예산 10,000원 및 3일 종료일 설정
- [ ] `SNSHero_Search_TCG_EN` 일 예산 10,000원 · 입찰 상한 1,200원 · 3일 종료일 설정 후 `ENABLED` 전환
- [ ] 부정 키워드(카지노/포커/모바일 앱/크립토) 추가 적용
- [ ] 72시간 후 GA4 `sessionCampaignName` 기준 `kr_test3d_*` vs `en_test3d_*` 성과 리포트 추출
