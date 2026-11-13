# SNSHero 개발 및 개선 작업 로그 (WORK_LOGS.md)

이 문서는 매시 정각 주기 스케줄러 및 수동 실행 시 스프레드시트 작업 동기화, 코드 수정 및 검증, 구글 폼 보고 내역을 기록하는 영구 로그입니다.

## [2026-11-13 12:40 KST] [/promo.html 주인공 카단·이그니스 명칭 정립, 인게임 1920x1080 스크린샷 6종 교체(#latest·#modes), 미디어믹스 4대 섹션(웹소설·웹툰·네이버웹소설·네이버웹툰) 및 신규 네이버 웹툰 URL 갱신 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 주인공 명칭 '카단 / 이그니스' 및 불종족 영웅명 정합성 수정 (`types.ts`, `cardDb.ts`, `aiController.ts`, `PromoApp.tsx`)**:
    - [`src/hearthstone/types.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/types.ts): `CLASSIC_HEROES.WARRIOR.nameKo`를 `'이그니시우스'`에서 원작 소설/웹툰 주인공 명칭인 **`'이그니스'`**로 수정 (382장 카드 총수 동결 원칙 준수).
    - [`src/hearthstone/cardDb.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/cardDb.ts): 불종족 프리셋 덱 명칭을 `'불종족의 이그니스'`로 수정.
    - [`src/hearthstone/engine/aiController.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/aiController.ts): 불종족 AI 덱 명칭을 `'불종족의 이그니스 홍련 중장덱'`으로 수정.
    - [`src/promo/PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx):
      - `#hero`: 좌/우 플랭킹 히어로를 카단(좌) & 이그니스(우)로 정립하고 헤드라인 서브타이틀을 `엘윈마을의 영웅들 · 카단과 이그니스의 여정`으로 명시.
      - `#heroes`: 9대 종족 & 전설 영웅 쇼케이스에서 불종족 대표 영웅명이 자동으로 `'이그니스'`로 렌더링되도록 연동.
  - **2. 실제 인게임 고화질 1920x1080 스크린샷 6종 캡처 및 `#latest`, `#modes` 이미지 전면 교체**:
    - 자동 캡처 스크립트([`scripts/capture_promo_screenshots.mjs`](file:///Users/dayyoung/project/snshero/scripts/capture_promo_screenshots.mjs))를 통해 실제 인게임 전장/시스템 화면 6종 생성:
      - `ingame_ranked_battle.png` (랭킹대전 진홍빛 용광로 전장), `ingame_ai_battle.png` (AI대전 에메랄드 전장), `ingame_story_battle.png` (스토리 엘윈 설원 전장), `ingame_story_theater.png` (40화 웹툰 극장 5컷 상영관), `ingame_collection_awake.png` (내 카드첩 3배 각성 도감), `ingame_pack_altar.png` (황금 천장 카드팩 개봉 제단).
    - `#latest` (카단의 여정 핵심 시스템 3탭):
      - `story` ➔ `/hs-assets/screenshots/ingame_story_theater.png` (40화 웹툰 극장)
      - `awake` ➔ `/hs-assets/screenshots/ingame_collection_awake.png` (여정 전용 3배 각성 도감)
      - `pack` ➔ `/hs-assets/screenshots/ingame_pack_altar.png` (황금 천장 팩 개봉 제단)
    - `#modes` (3대 게임 모드 지그재그 쇼케이스):
      - 랭킹대전 ➔ `/hs-assets/screenshots/ingame_ranked_battle.png`
      - AI대전 ➔ `/hs-assets/screenshots/ingame_ai_battle.png`
      - 스토리모드 ➔ `/hs-assets/screenshots/ingame_story_battle.png`
  - **3. `#universe` 4대 추천 미디어믹스 및 신규 네이버 웹툰 URL 갱신**:
    - 4대 카드 섹션을 **[웹소설 / 웹툰 / 네이버웹소설 / 네이버웹툰]**으로 재편성:
      - 웹소설: `/book.html` (40부작 공식 판타지 웹소설)
      - 웹툰: `/webtoon.html` (카단과 이그니스의 서사 풀컬러 웹툰)
      - 네이버웹소설: `https://novel.naver.com/challenge/list?novelId=1250635` (네이버 챌린지리그 공식 연재처)
      - 네이버웹툰: `https://comic.naver.com/challenge/list?titleId=857363` (네이버 도전만화 신규 공식 연재처)
    - 소셜/연재 목재 배너 내 네이버 웹툰 URL도 신규 주소인 `https://comic.naver.com/challenge/list?titleId=857363`로 업데이트 완료.
  - **4. 빌드 및 실서버 응답 검증**:
    - `npx tsc --noEmit` 검증 통과 (에러 0건).
    - `npm run build` 프로덕션 번들 정상 빌드 완료 (`dist/promo.html`, `dist/assets/promo-*.js` 등).
    - `curl -I http://localhost:3000/promo.html` 및 신규 스크린샷 이미지 6종 HTTP 200 OK 서빙 검증 완료.
  - **5. 구글 폼 완료 보고서 제출**: 연동 구글 폼 완료 보고 제출 (`report-ex`).
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. `/public` 용도별 디렉토리 재구성**:
    - 루트 메타/PWA 표준 파일만 루트에 유지하고, 게임(`public/hs-assets/{brand,characters/{cutouts,busts,chibi},cards,cardbacks,bosses,bg,data,snshero-audio,tutorial}`), 하스스톤(`public/stone-assets/` 원형 유지), 웹소설(`public/novel-assets/`), 웹툰(`public/webtoon-assets/`)으로 용도별 완전 분리.
    - [`public/hs-assets/data/classic-cards.json`](file:///Users/dayyoung/project/snshero/public/hs-assets/data/classic-cards.json)(카드 382 + 토큰 123), [`manifest.json`](file:///Users/dayyoung/project/snshero/public/hs-assets/characters/manifest.json), [`public/sw.js`](file:///Users/dayyoung/project/snshero/public/sw.js), [`public/game-manifest.json`](file:///Users/dayyoung/project/snshero/public/game-manifest.json), 루트 HTML 6종, `src/hearthstone/**`, `src/reader/**`, `src/promo/**` 참조 경로 전수 동기화 및 누락 `propUrl`/`fallback_panel.webp` 404 방지 처리.
  - **2. 미사용 에셋 제거 & 이미지/동영상 경량화 (`public/` 533MB ➔ 257MB, `dist/` 917MB ➔ 334MB)**:
    - 미사용 `*_bust.png`(54MB), `raw_ep_sheets/`(26MB), 구버전 웹툰 JPG 8종, 미사용 `logo.png`/`logo.jpg`(2.3MB), `book/image_narrations/`(3.2MB), `.agents/teamwork/`(10MB) 삭제 및 `WORK_LOGS.md`(2.4MB) 경량화.
    - 캐릭터 `cutouts`/`busts`/`chibi` 및 `logo-ko`/`kadan_novel_cover` 총 335개 이미지 WebP 변환, 에피소드 0 한/영 튜토리얼 MP4 720p 재인코딩(`12MB/15MB` ➔ `2.9MB/3.7MB`).
  - **3. 로컬 트레일러 MP4(42MB) 삭제 및 유튜브 공식 웹툰 재생목록 교체 (`PromoApp.tsx`)**:
    - `public/promo-assets/videos/` 삭제 및 [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) 플레이어를 `@snshero/playlists`(`PLVch67W9z4TA`, 제1화 `KOf8IAic2QY` · 제8화 `BIHe4MrtCIw` · 제15화 `LHHngbtkJwg`) 유튜브 `<iframe>` 임베드로 교체.
  - **4. 빌드 및 E2E 실브라우저 검증**:
    - 코드/JSON/HTML 내 6,860개 에셋 경로 실존 100% 검증(누락 0건), 클린 `npm run build` 성공 및 Playwright E2E(`deep_check_cataclysm.py`) 0 errors · 0 404s 통과.

## [2026-11-13 11:12 KST] [/game.html 에피소드 0 튜토리얼(슬라이드 5컷·튜토리얼 동영상 바로보기·허수아비 로봇 vs 카단 3초 교차 실전·제1화 자동 전환) 구축 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 비환생(`journeyReincarnation === 0`) 유저 에피소드 0 시작 및 환생 보존 (`storage.ts`, `BoxHubScreen.tsx`)**:
    - [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts): `defaultProfile()`의 초기 `journeyEpisode`를 `0`으로 설정하고, `getProfile()` / `setJourneyProgress()` / `recordMatchOutcome()` 및 `CURRENT_LORE_VERSION='snshero_v4'` 마이그레이션에서 `journeyReincarnation === 0`일 때 `episode 0`을 허용하며 환생(`>= 1`) 계정은 기존대로 `제1화`부터 시작하도록 분리.
    - 에피소드 0 완료 시 50G + 튜토리얼 수료 보너스 50G 지급 후 `journeyEpisode = 1`로 진행.
    - [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx): `profile.journeyEpisode ?? 0` 처리 및 로비 카드에 `에피소드 0 튜토리얼 · 허수아비 로봇 기초 훈련` 표기 연동.
  - **2. 튜토리얼 스타일 5슬라이드 극장 & 동영상 바로보기 & 베이직 덱 데이터 (`kadanJourneyData.ts`, `KadanJourneyStoryModal.tsx`)**:
    - [`kadanJourneyData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/kadanJourneyData.ts): `KADAN_TUTORIAL_EPISODE_0`(5종 하스스톤 양피지/원목 슬라이드 `ep0_slide_1~5.webp` + 남성 TTS `ep00_cut1~5.mp3` + 상반신 초상화 `kadan_upper.webp` / `scarecrow_robot.webp`), `TUTORIAL_EP0_CARD_REASONS` 카드별 해설 맵, `buildTutorialEp0PlayerDeck()`, `buildTutorialEp0ScarecrowDeck()`(베이직 `FREE` 등급 하수인·주문·무기 혼합), `getJourneyDifficultySpec(0, 0)`(`enemyHeroHealth: 10`, `enemyStatScale: 0.55`) 추가 (`382`장 카드 풀 동결 원칙 준수).
    - [`KadanJourneyStoryModal.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/KadanJourneyStoryModal.tsx): 에피소드 선택 드롭다운에 `제0화 · 튜토리얼` 추가 및 **`🎬 튜토리얼 동영상 바로보기`** 버튼/모달(`tutorial-video-modal`) 탑재(한국어/영문 16:9 튜토리얼 MP4 즉시 전환 재생).
  - **3. 상반신 카단·허수아비 로봇 3초 교차 플레이 · 턴 종료 이유 설명 · 승리 환영 후 3초 제1화 자동플레이 (`BattleScreen.tsx`)**:
    - [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx): 중앙 영웅 초상화(`10 HP`)를 가리지 않는 좌·우 상반신 비중첩 듀얼 스피커 오버레이(`ep0-explanation-banner`), 1초 Turn Rope 리셋 영향을 차단한 `playerActionStateKey` 기반 안정 **3,000ms(3초/카드)** 교차 실행, 매 턴 종료 시 **카단 턴 마무리 이유 설명**, 허수아비 로봇 방어 스톨/치명타 안전 가드, 승리 시 카단 **웰컴 인사(`ep0-welcome-banner`)** 및 3초 뒤 **제1화(`autoPlay = true`) 자동 전환** 완결.
  - **4. 빌드 및 E2E 브라우저 검증**:
    - `npx tsc --noEmit` (`src/hearthstone/**` 에러 0건) 및 `npm run build` 정상 통과.
    - Playwright 실브라우저(`http://localhost:3000/game.html`) E2E 검증 완료: 비환생 에피소드 0 진입 · 환생 제1화 유지 · 5슬라이드/동영상 모달 · 3초 간격 상반신 교차 전투 & 턴 종료 해설 · 43.6초 카단 승리 웰컴 · 제1화 자동 전환 전 항목 `0 errors` 통과 및 스크린샷 육안 검수 완료.

## [2026-11-13 09:58 KST] [전설 카드 황금색 테두리 적용 및 /promo.html 첫 화면 카단·이그니시우스 키아트 교체 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 전설 카드 외곽·드래곤 릴리프 황금색 테두리 채색**:
    - [`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx#L242-L545): `SnsLegendaryCardDragonSvg`의 입체 백랍/은빛 드래곤 본체를 유지한 채 날개 외곽선·뿔·등뼈 돌기·발톱·머리 갑주 및 하이라이트 엣지(`#fde047`, `url(#goldFiligree_*)`, 온기 있는 브론즈 그림자 음영)를 전면 황금색 테두리로 채색.
    - [`CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx#L795-L809): 전설(`isLegendary`) 카드의 외곽 베젤(`bezelGrad_*`)이 우하단까지 어둡게 죽지 않고 4면 전체(`strokeWidth="5.2"`)에 연속된 황금빛으로 빛나도록 보강하고, 내부 필리그리 레일(`rgba(253,224,71,0.72)`)을 황금색으로 강화.
  - **2. `/promo.html` 첫 화면(`#hero`) 키 아트 카단·이그니시우스 배치 및 헤드라인 정돈**:
    - [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx#L327-L368): 첫 화면 좌우 전신 캐릭터 키아트를 기존(`이그니시우스`/`포세이돈`)에서 주인공 **카단(`041_Kadan.png`, 좌측)** 과 **이그니시우스(`020_Ignisius.png`, 우측)** 로 교체하고 시인성을 높였으며, 메인 `<h1>` 헤드라인에 `break-keep` 2행 줄바꿈을 적용해 한국어 어절 분리를 방지.
  - **3. 빌드 및 브라우저 시각 검증**:
    - `npm run build` 정상 종료 (exit code `0`, `dist/promo.html`·`dist/game.html`·`dist/assets/CardVisual-BWHBg9PW-v2.js` 갱신).
    - `http://localhost:3000/promo.html` 캐시 우회 리로드 검사: 콘솔 JS 에러 **0건**, 실패 요청 **0건**(50/50건 200 OK). 줌 모달 전설 카드 황금 테두리 및 첫 화면 카단·이그니시우스 좌우 구도·2행 헤드라인 육안 확인 완료.


*(이전 2026-09~10 작업 로그는 기존 원격 저장소 이력에 보관되어 있습니다.)*
