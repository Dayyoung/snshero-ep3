# SNSHero 개발 및 개선 작업 로그 (WORK_LOGS.md)

이 문서는 매시 정각 주기 스케줄러 및 수동 실행 시 스프레드시트 작업 동기화, 코드 수정 및 검증, 구글 폼 보고 내역을 기록하는 영구 로그입니다.

## [2026-11-15 07:30 KST] [`/mcp` 공식 AI 에이전트 대전·심사 서버 개발 및 `/sns` Artificial Analysis 기반 1,000판 지능 벤치마크 & 기획·개발·디자인 100점 평가 리포트 구축 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 사전 준비된 표준 `/mcp` 서버 구축 (`src/mcp/mcpServerNode.ts`, `src/mcp/arenaCore.ts`, `scripts/mcp-server.ts`)**:
    - **지원 프로토콜**: Model Context Protocol (`2025-03-26` / `2024-11-05`) JSON-RPC 2.0 Streamable HTTP(`POST /mcp`), SSE(`GET /mcp/sse` + `POST /mcp/messages`), 로컬 Stdio(`npx tsx scripts/mcp-server.ts --stdio`), ChatGPT Actions용 OpenAPI 3.1(`GET /mcp/openapi.json`) 및 `/api/mcp/*` REST 연동 완비.
    - **8종 MCP Tool 제공**: `snshero_get_game_dossier`(기획/개발/디자인 전체 아키텍처 및 100점 루브릭 조회), `snshero_start_match`(실제 382장 카드 풀·30장 덱 대전 생성), `snshero_get_match_state`(전장/손패/비밀/번호가 부여된 `legalActions` 관측), `snshero_step_action`(선택 수 실행 및 `END_TURN` 시 눈히어로 AI 자동 응수), `snshero_create_1000_series`(9종족 균등 로테이션 1,000판 시리즈 트래커), `snshero_run_batch_simulation`(최대 1,000판 실제 `GameEngine` 헤드리스 고속 검증), `snshero_submit_evaluation`(기획/개발/디자인 100점 만점 채점 등록), `snshero_get_leaderboard`(`/sns` 리더보드 조회).
    - **1,000판 자동화 실행 스크립트(`scripts/run-llm-1000-benchmark.ts`)**: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` 주입 시 각 AI가 `/mcp`를 통해 1,000판 연속 대전을 수행하고 `/sns` 데이터를 자동 갱신하도록 구성.
  - **2. `/sns` AI 벤치마크 & 100점 평가 허브 페이지 신설 (`sns.html`, `src/sns/SnsBenchmarkApp.tsx`, `src/mcp/benchmarkData.ts`)**:
    - **Artificial Analysis(`artificialanalysis.ai`) Intelligence Index v5.0.1 기준치 우선 반영**: 실시간 LLM 1,000판 완주 전까지 공인 Artificial Analysis 지표(Intelligence Index, Coding Agent, Math/Reasoning, Output tok/s, API Cost)를 토대로 산출한 Claude Code(`94.2 IQ` / AA `65.0` / 예상 승률 `61.8%`), Gemini(`91.6 IQ` / AA `60.0` / 예상 승률 `58.4%`), ChatGPT(`89.8 IQ` / AA `57.0` / 예상 승률 `55.9%`) 지표와 실제 `GameEngine` 1,000판 실측이 완료된 눈히어로 내장 AI(`86.5 IQ` / Elo `1,765` / 미러전 `50.9%` 균형 / `$0.00` 초고속 로컬 연산) 비교 차트·9종족 승률 매트릭스 제공.
    - **기획·개발·디자인 100점 만점 심사 리포트**: 3대 AI별 기획/개발/디자인 점수 및 12개 세부 루브릭(각 25점 × 4항목) 대조표, 핵심 강점·고도화 제언, 실시간 평가 반영 테스트 기능 제공.
    - **실시간 엔진 시뮬레이터 & MCP 턴 인스펙터**: 브라우저 및 서버에서 즉시 20/100/1,000판 실제 `GameEngine` 대전을 돌리고, LLM이 수신하는 `MatchObservation` 및 `legalActions`를 1스텝씩 직접 실행·검증 가능하도록 구현 (`DESIGN.md` `font-mono`·`0px/4px` 플랫 터미널 미학 100% 준수).
  - **3. 검증 및 구글 폼 보고 완료**:
    - 382장 카드 동결 원칙 및 `/stone.html` 무간섭 원칙 100% 준수, `npx tsc --noEmit` 에러 0건, `npm run build` 프로덕션 번들(`dist/sns/index.html`) 생성, 1,000판 실측 캘리브레이션 및 MCP 3판 턴제 프로토콜 검증 통과, 로컬 git 커밋 및 구글 폼 보고 제출 완료.

## [2026-11-15 07:26 KST] [`/stone.html` 오리지널 블리자드 하스스톤 1:1 충실도 전면 재설계 및 전장 소켓·드래그 조작·상자 허브 고도화 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 로컬 `/Applications/Hearthstone` 추출 에셋·폰트(`BelweBdBT`)·공식 `koKR` 문자열(`GAMEPLAY.txt`, `GLUE.txt`) 전면 적용**:
    - [`stone.html`](file:///Users/dayyoung/project/snshero/stone.html) & [`src/stone/hearthstone.css`](file:///Users/dayyoung/project/snshero/src/stone/hearthstone.css): 블리자드 공식 타이틀/숫자 서체 `BelweBdBTBold.ttf` 프리로드 및 `.hs-num`·`.hs-title` 연결, 드래그 중 건틀릿 그랩 커서(`grab.png`) 고정, 3D 상자 문 스윙·카드 드로우 비행·상대 카드 공개 쇼케이스·하수인 착지·밧줄 불꽃 키프레임 추가.
  - **2. 여관 상자 허브(`The Box`) 3D 양문 개폐 & 3슬롯 황동 회전판 복원 (`BoxHubScreen.tsx`)**:
    - [`src/stone/screens/BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/BoxHubScreen.tsx): `box_chest_left.webp` / `box_chest_right.webp` 3D 경첩 양문 스윙 오픈 연출, `hs_thebox_ring.webp` + `box_menu_disk.webp` 중앙 원형 회전판(`대전` / `연습` / `튜토리얼`), 하단 벨벳 서랍 트레이(`팩 개봉`, `내 수집품`, `퀘스트`, `상점`) 구성.
  - **3. 영웅·덱 선택 메달리온 & 고대비 원통형 매칭 슬롯 휠 (`HeroDeckSelectScreen.tsx`)**:
    - [`src/stone/screens/HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/HeroDeckSelectScreen.tsx): 우측 하단 원형 소용돌이 `대전!` 메달리온(`play_swirl_medallion.webp`) 적용 및 `/Applications/Hearthstone/Strings/koKR/GLUE.txt` 공식 `GLUE_SPINNER_*` 호칭 기반 5행 아이보리 원통 슬롯 휠 구현.
  - **4. 전장 보드(`STORMWIND`/`ORGRIMMAR`/`PANDARIA`) 픽셀 정밀 소켓 정렬 및 포인터 드래그 앤 드롭 전투 (`BattleScreen.tsx`, `CardVisual.tsx`)**:
    - [`src/stone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/BattleScreen.tsx): 각 보드 이미지 원본 해상도 비율(`1110:700`, `1600:925`, `1600:931`)에 맞춘 데스크톱 스테이지 정렬로 배경의 영문 `"END TURN"` 위에 한국어 3상태 레버(`턴 종료` / `할 일 없음` / `상대 턴`)가 오차 없이 100% 덮이도록 교정하고, 상·하단 영웅 아치·우측 3D 덱 슬롯(탈진 카운터 포함)·좌측 행동 기록 타일·우측 하단 마나 수정 트레이(카드 호버 시 소모 예정 마나 점멸) 정밀 배치.
    - 손패 카드 드래그 즉시 사용(하수인 전장 위치 갈라짐 프리뷰, 주문/무기 즉시 시전, 대상 지정 주문/전투의 함성 붉은 조준 화살표 연동) 및 아군 하수인/영웅/영웅 능력 드래그 타격 구현(단순 클릭 확대 `CardZoomModal` 완벽 병행).
    - 1클릭 멀리건(`시작 카드` / `교환할 카드 선택` / `교체` ✕ 스탬프 + 후공 `동전 한 닢` 획득 연출), 상대 카드 사용 시 좌측 대형 카드 쇼케이스, 덱→손패 카드 드로우 비행 연출 추가.
    - [`src/stone/components/CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/stone/components/CardVisual.tsx): 모든 전장 하수인에 추출 석재 타원 베젤(`minion_oval_bezel.webp`)·도발 방패(`taunt_shield.webp`)·지속 발동 번개(`⚡`)/죽음의 메아리 해골 배지 정렬, 상대 턴 무기 강철 셔터 닫힘 연출, 영웅 능력 사용 시 3D 코인 뒤집기, 패배 영웅 초상화 균열 연출 적용.
  - **5. 수집품 1클릭 덱 편집 · 팩 제단 드래그 개봉 · 데이터 초기화 자동 새로고침 (`CollectionScreen.tsx`, `PackOpeningScreen.tsx`, `Modals.tsx`)**:
    - 덱 편집 중 보유 카드 클릭 즉시 편입 / 우측 덱 타일 클릭 즉시 제외, 팩 개봉 화면에서 팩을 중앙 제단으로 직접 드래그해 개봉 지원, `/stone.html` 데이터 초기화 시 `window.location.reload()` 반영.
  - **6. 382장 동결 원칙 준수 · 타입체크 · 프로덕션 빌드 · Playwright 실브라우저 검증 & 구글 폼 보고 완료**:
    - 수집 가능 카드 **382장** 엄격 동결 및 100% 무료 정책 확인, `/game.html` 무간섭 격리 확인, `npx tsc --noEmit` 및 `npm run build` 에러 0건 통과, Playwright(`1440×900`) 전 화면 렌더링 및 `ERRORS: 0` 검증 완료, 구글 폼 작업완료 보고 제출.

## [2026-11-14 11:20 KST] [게임 시작 전 대결 양쪽 캐릭터 이름만 짧게 호명·표시하도록 음성 및 VS UI 최적화 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 전체 32종 짧은 캐릭터 이름 스튜디오 음성 MP3(`short_*.mp3`) 생성 및 매핑 통합**:
    - 기존 `announcer_*.mp3`("에린의 눈히어로, 카단", "불꽃의 태양황제, 이그니시우스") 및 스토리 `hero_*.mp3`("성기사 카단", "망념의 죽음기사 아르투스", "훈련용 허수아비 로봇")가 긴 수식어·직함까지 전부 읽어 대전 개시 대기가 길어지던 문제를 해소.
    - `ko-KR-InJoonNeural` 기반 32종 짧은 이름 MP3([`public/hs-assets/snshero-audio/story/short_*.mp3`](file:///Users/dayyoung/project/snshero/public/hs-assets/snshero-audio/story/hero_name_vo_map.json)) 생성 및 80개 별칭 매핑 완료.
  - **2. 짧은 이름 추출 공통 헬퍼 및 VS 인트로 한/영 적용 (`audio.ts` · `BattleScreen.tsx`)**:
    - [`src/hearthstone/audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts): `extractShortHeroCalloutName()` 신설 및 `playMatchupAnnouncement()`에서 한국어(`카단 대! 허수아비 로봇` 등)·영어(`Kadan versus Scarecrow Bot` 등) 모두 수식어·AI 접두사를 뺀 이름만 짧게 호명하도록 변경.
    - [`src/hearthstone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx): `runVsIntroAndTransition()`에 언어별 정확한 캐릭터 이름을 전달하고, VS 인트로 화면 헤드라인(`pDispName`/`oDispName`)도 짧은 이름만 표시(서브타이틀 유지)하도록 정리.
  - **3. 타입체크 · 빌드 · Playwright 실브라우저 검증 완료**:
    - `npx tsc --noEmit` (`src/stone/` 제외 에러 0건) 및 `npm run build` 통과.
    - Playwright `ko-KR` / `en-US` 실검증: `story_battle`(`["카단", "허수아비 로봇"]`, `["Kadan", "Scarecrow Bot"]`) 및 `ai_battle`(`["카단", "토람"]`, `["Kadan", "Toram"]`) 짧은 이름 표시, `short_kadan.mp3` 요청, `pageerror` 0건 확인.

## [2026-11-14 10:53 KST] [게임 시작 전 튜토리얼 웹툰 5컷 이미지·대사·성우 낭독 100% 일치화 및 원격 푸시 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 에피소드 0 웹툰 5컷 이미지(`ep0_slide_1~5[_en].webp`)·자막·성우 낭독 MP3(`ep00_cut1~5.mp3`) 내용 불일치 해소**:
    - [`src/hearthstone/kadanJourneyData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/kadanJourneyData.ts): 기존 1~5컷 대사가 구버전 규칙(마나/도발/주문무기/3배각성)으로 남아 `ep0_slide_1~5.webp` 이미지 및 `ep00_cut1~5.mp3` 음성과 어긋나던 문제를 실제 슬라이드·음성 내용에 맞춰 1:1 재정렬(1컷 승리 조건 30→0 / 2컷 카드 읽는 법 / 3컷 마나 성장 & 소환 / 4컷 전투 & 도발 키워드 / 5컷 카단 vs 허수아비 로봇).
    - [`src/hearthstone/kadanJourneyEnData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/kadanJourneyEnData.ts): `EP0_SCENES_EN` 및 `applyEnEpisodeLocalization()` 영문 대사·라벨·요약도 `ep0_slide_1~5_en.webp` 5컷 영문 슬라이드 내용과 동일하게 1:1 동기화.
  - **2. 빌드 및 Playwright KO/EN 5컷 전수 검증 완료**:
    - `npx tsc --noEmit` (`src/stone/` 제외 에러 0건) 및 `npm run build` 정상 통과.
    - Playwright 모바일(`390×844`) `ko-KR`/`en-US` 양쪽 언어에서 1~5컷 이미지·단계 라벨·하단 대사 일치 및 `pageerror` 0건 검증 완료.

## [2026-11-14 10:48 KST] [게임 내 모든 팝업 우측 상단 닫기 버튼 일관성 통일 및 모바일 웹툰 팝업 스킵 버튼 가림 해소]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 모바일 웹툰 팝업(`KadanJourneyStoryModal.tsx`) 스킵 버튼 가림/클릭 불가 해결**:
    - 기존 모달 본문(`flex-1`)에 `min-h-0 overflow-y-auto`가 없고 `<footer>`에 `shrink-0`가 빠져 작은 모바일 화면에서 웹툰 이미지+자막이 `<footer>`의 스킵 버튼(`story-skip-start-btn`)을 모달 밖으로 밀어내 잘리던 문제를 수정.
    - 본문만 `min-h-0 flex-1 overflow-y-auto overscroll-contain`으로 스크롤되도록 분리하고, 모바일 이미지 상한을 `max-h-[34dvh] sm:max-h-[48vh]`로 조정하며, `<footer>`를 `shrink-0`로 하단 고정(`w-full sm:w-auto min-h-[44px]`).
    - `<header>` 우측 상단에 `story-modal-close-btn`(`✕`)을 `shrink-0`로 고정하고 `showVideoPlayer`와 `useModalDismiss` LIFO 스택을 분리해 ESC/우클릭 시 영상 팝업이 먼저 닫히도록 통일.
  - **2. 게임 전체 팝업 우측 상단 닫기(`✕`) 버튼 일관성 통일**:
    - [`src/hearthstone/components/Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx): `GameOptionsModal`(`options-close-btn`), `PaymentSuccessModal`(`payment-success-close-btn`)에 우측 상단 `✕` 닫기 버튼 신설 및 `TavernShopModal` 닫기 버튼 `shrink-0` 보강.
    - [`src/hearthstone/screens/HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx): 매칭 대기 팝업(`!wheelLocked`) 우측 상단 `✕` 닫기(`matchmaking-close-btn`) 및 배경 클릭 닫기 통일.
    - [`src/hearthstone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx): 패배 보강 팩 모달(`defeat-pack-close-btn`) 및 승/패 종료 모달(`gameover-close-btn`) 우측 상단 `✕` 닫기 버튼 추가.
  - **3. 타입체크 · 빌드 · Playwright 모바일(`375×667`) 검증 완료**:
    - `npx tsc --noEmit` (`src/stone/` 제외 에러 `0`건) 및 `npm run build` 통과.
    - Playwright 모바일(`375×667`) `/game.html?mode=story`: `story-modal-close-btn`(`inViewport: true`, `hitSelf: true`) 및 `story-skip-start-btn`(`inViewport: true`, `hitSelf: true`) 확인 및 스킵 클릭 시 전투 진입 검증, 콘솔/페이지/로컬 HTTP 에러 `0`건.

## [2026-11-13 16:33 KST] [카드게임 대결 화면(`/game.html`) 저사양 기기 프레임 끊김 해소 및 렌더링 성능 최적화 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. `BattleScreen.tsx` 포인터 이동 리렌더링·레이아웃 스래싱 제거 및 타깃 화살표 격리 (`TargetingArrowOverlay`)**:
    - 기존 전역 `window.pointermove`마다 `setPointerPos` + DOM 전체 좌표 탐색(`querySelectorAll`/`getBoundingClientRect`)으로 배틀 화면 전체가 60~120fps 재렌더링되던 병목을 `TargetingArrowOverlay` 별도 `React.memo` 컴포넌트로 분리하고 `requestAnimationFrame` 기반 쓰로틀링 + 타깃 선택 중 한정 리스너 등록으로 개선.
    - 타깃 화살표 `<svg>` 내 전체 화면 `<feGaussianBlur>` 필터를 제거하고 2중 스트로크 패스로 대체해 모바일 GPU 필레이트 부하 제거.
    - 소환 위치 미리보기(`insertPreviewIdx`) 리스너도 `isPlacingMinion`일 때만 `requestAnimationFrame` 쓰로틀 + 동일 인덱스 early return으로 격리.
    - `BoardMinionToken` 및 `HeroPortraitZone` 인라인 화살표 클로저를 `useCallback` + ref 기반 안정 핸들러(`handleMinionSelectCb`, `handleMinionHoverCb`, `handleOpponentHeroClickCb`, `handlePlayerHeroClickCb`, `handlePlayerHeroPowerCb`)로 교체해 `React.memo` 무력화 해소.
    - 핸드 카드 래퍼 `transition-all` ➔ `transition-transform` 전환 및 모달 7곳의 풀스크린 `backdrop-blur-*`를 단색 반투명 배경(`bg-black/88`, `bg-red-950/84`)으로 교체.
    - 미지정 `boardTheme`(예: `?mode=ai_battle` 진입 시) 크래시 방지를 위해 `BOARD_CORNER_TOYS` 및 `BOARD_BG_URL`에 `STORMWIND` 폴백 추가.
  - **2. `BoardVfxCanvas.tsx` · `CardVisual.tsx` · `hearthstone.css` · `heroLang.ts` GPU/CPU 경량화**:
    - `BoardVfxCanvas`: `React.memo` 래핑, 저사양 기기 자동 감지(`detectLowPowerDevice`: DPR 1.25 상한, 파티클 34개 상한), `stageSizeRef` 리사이즈 캐싱, 투사체 프레임당 `createRadialGradient` 할당 제거.
    - `CardVisual.tsx`: 초상화 `decoding="async"`, 클리핑 내부 중첩 `drop-shadow` 및 수면/타깃 `animate-bounce`·`animate-pulse` 제거.
    - `hearthstone.css`: `.hs-card-glow-*` / `.hs-card-shadow-base`의 3~4겹 `drop-shadow` 체인을 단일 패스 + `contain: layout style`로 단순화.
    - `heroLang.ts`: 컴포넌트당 2개씩 붙던 `window` 언어 리스너(~50개)를 모듈 단일 Pub/Sub(`langListeners` + `ensureGlobalLangListener`)로 통합.
  - **3. 타입체크 · 빌드 · Playwright 저사양 성능 검증 완료**:
    - `npx tsc --noEmit` (`src/stone/` 제외 에러 0건) 및 `npm run build` 정상 완료.
    - Playwright(`http://localhost:3000/game.html?mode=ai_battle`):
      - 데스크톱(`1280x800`, 1x CPU): 684프레임 `avgFrameMs=8.66`, `p95FrameMs=9.3`, `jankFramesOver50ms=0`, `longTaskCount=0`, 콘솔/페이지/HTTP 에러 0건.
      - 모바일 저사양(`430x932`, 4x CPU 스로틀링): 711프레임 `avgFrameMs=9.32`, `p95FrameMs=9.4`, `jankFramesOver50ms=4`, `longTaskCount=3`, 콘솔/페이지/HTTP 에러 0건.

## [2026-11-13 15:19 KST] [에피소드 0 튜토리얼 웹툰 영문 전용 슬라이드 5종 제작 및 EN/KO 분기 연동 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 영문 UI 기반 실게임 스크린샷 촬영 및 영문 튜토리얼 슬라이드 5종(`ep0_slide_1~5_en.webp`) 제작**:
    - `locale="en-US"` 실제 `/game.html` 화면(성소 로비·카드첩 382종·카드 확대·멀리건·실시간 전장·빠른 규칙 모달) 6종 캡처.
    - 1280×720 영문 튜토리얼 웹툰 슬라이드 [`public/hs-assets/tutorial/ep0_slide_1_en.webp`](file:///Users/dayyoung/project/snshero/public/hs-assets/tutorial/ep0_slide_1_en.webp) ~ `ep0_slide_5_en.webp` 5컷 전수 생성 및 시각 검수 완료.
  - **2. 에피소드 0 영문화 이미지 분기 연동 (`kadanJourneyEnData.ts`)**:
    - [`src/hearthstone/kadanJourneyEnData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/kadanJourneyEnData.ts)의 `applyEnEpisodeLocalization()` (`base.episode <= 0`)에서 `coverIllustrationUrl` 및 5컷 `illustrationUrl`을 `_en.webp` 영문 전용 슬라이드로 자동 매핑 (`ko` 모드는 기존 `ep0_slide_1~5.webp` 유지).
  - **3. 빌드 및 E2E 실브라우저 검증 완료**:
    - `npx tsc --noEmit` (신규/수정 코드 에러 0건) 및 `npm run build` 정상 통과.
    - Playwright 실브라우저(`/game.html?mode=story`) 검증: `en-US` 모드에서 `_en.webp` (`1280×720`) 로드 및 한글 노출 `[]` 0건, `ko-KR` 모드에서 `.webp` (`1280×720`) 로드 확인.

## [2026-11-13 13:21 KST] [전 페이지 영문화·한국어 브라우저 자동 감지·설정/푸터 언어 선택기 연동 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 브라우저 언어 기본값 규칙 및 언어 상태 영구 동기화 (`heroLang.ts`)**:
    - 한국어 브라우저(`ko*`)만 기본 `'ko'`, 그 외 모든 국가는 기본 `'en'`(영어)으로 표시되며, 선택값은 `localStorage('hero_language')`와 `document.documentElement.lang`에 동기화 (`useHeroLanguage()` 객체 반환 규격 통일 및 `Modals.tsx`·`BoxHubScreen.tsx`·`BattleScreen.tsx`·`HearthstoneApp.tsx`·`PromoApp.tsx` 등 전체 호출부 정비).
  - **2. 게임 페이지(`/` · `/game.html`) 옵션 팝업 언어 선택 및 전면 영문화 (`/stone.html` 불변 유지)**:
    - [`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx) 설정 모달 내 `English` / `한국어` 토글 연동 및 [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx) 첫 방문 상태에서도 설정(`hub-options-btn`) 즉시 열람 허용.
    - [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) 및 [`KadanJourneyStoryModal.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/KadanJourneyStoryModal.tsx)의 잘못된 3인자 `tr(lang, ko, en)` 141건을 2인자 `tr(ko, en)`으로 전량 복원.
    - [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts) `getModeRewardGuide()` 추가, [`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts) 영웅/카드 비한국어 음성 가드 및 `getLocalizedHeroInfo()` 매칭, [`GameEngine.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/GameEngine.ts)·[`aiController.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/aiController.ts)·[`cardEffects.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/cardEffects.ts)·[`BoardVfxCanvas.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/vfx/BoardVfxCanvas.tsx) 영문 로컬라이징 완비.
  - **3. 일반 페이지(`/promo.html` · `/book.html` · `/novel.html` · `/webtoon.html`) 하단 푸터 언어 선택기 및 정적 HTML 영문 기본값**:
    - `index.html`, `promo.html`, `book.html`, `webtoon.html` 메타/타이틀 영문 기본값 적용 및 하단 `[data-testid="footer-language-switcher"]` EN/KO 양방향 전환 검증.
  - **4. 타입체크·프로덕션 빌드·Playwright E2E 검증 완료**:
    - `npx tsc --noEmit` (신규/수정 파일 에러 0건) 및 `npm run build` 정상 통과.
    - Playwright(`en-US`·`ko-KR` 컨텍스트) E2E 검증 통과: 전 6개 경로(`/`·`/game.html`·`/promo.html`·`/book.html`·`/novel.html`·`/webtoon.html`) `en-US` 기본 영어·`ko-KR` 기본 한국어 감지, 스토리모드 제0화 전장 진입 시 한글 잔존 문자열 0건, 설정/푸터 전환 및 새로고침 영구 유지 0 errors 확인.

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

## [2026-11-15 06:45 KST] [`cardDatabase.ts` 382캐릭터 확장 및 눈히어로 세계관 투명 컷아웃 292종 전수 생성·적용 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. `src/cardDatabase.ts` · `src/types.ts` 382종 수집 캐릭터 확장 (로봇·용 슬롯 20종 보존)**:
    - [`types.ts`](file:///Users/dayyoung/project/snshero/src/types.ts) 타입 정의 및 [`cardDatabase.ts`](file:///Users/dayyoung/project/snshero/src/cardDatabase.ts) 확장 완료 (`402`개 항목: 9개 종족 × 25장 = 225장 + 중립 157장 = 382장 + 보존된 `robot` 10장 [`91~100`] · `dragon` 10장 [`101~110`]).
  - **2. 눈히어로(『카단의 여정』) 세계관 기반 7등신 투명 `RGBA WEBP` 컷아웃 292종 전수 생성 및 카드 적용**:
    - 9개 종족 추가 영웅 135종(`111~245`, 종족별 15종) + 기타종족 157종(`301~457`) 총 **292종**의 한국 웹툰풍 7등신 전신 컷아웃을 생성·투명 배경제거·`RGBA WEBP` 변환하여 [`public/hs-assets/characters/cutouts/`](file:///Users/dayyoung/project/snshero/public/hs-assets/characters/cutouts)에 저장.
    - [`classic-cards.json`](file:///Users/dayyoung/project/snshero/public/hs-assets/data/classic-cards.json) 전수 동기화: 수집 카드 **382장** 및 토큰 **123장** 전수 `/hs-assets/characters/cutouts/*.webp` 적용 (`non_cutout: 0`, `missing_files: 0`, `bad_rgba: 0`). `/stone.html` 및 `robot`/`dragon` 예약 슬롯 무변경.
  - **3. 빌드 · 타입체크 · 구글 폼 보고**:
    - `npx tsc --noEmit` (`src/cardDatabase.ts`, `src/types.ts`, `src/hearthstone/**` 에러 0건) 및 `npm run build` 정상 통과 (`5.96s`).
    - 구글 폼 최종 완료 보고(`작업완료`) 제출 완료.

## [2026-11-15 07:28 KST] [웹툰 등장 캐릭터 34명 외형·복장 1:1 카드 리팩토링 및 크로마키 핑크(`#FF00AA`) 정밀 누끼 적용 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 웹툰 40화 실제 장면(`public/webtoon-assets/episode_01~40`) 전수 대조 및 34종 외형·복장·종족 리팩토링**:
    - 웹툰 출연 카드 캐릭터 **34명 전원**(`006 레비아탄`, `011 이그니스`, `013 벨페고르`, `023 실피드`, `025 에올루스`, `034 이셀라`, `041~050 라이트헤븐 10인 전원`, `051 워커`, `054 아라크네`, `060 데스나이트 아르투스`, `061 루시안`, `062 실리아`, `063 엘리아나`, `064 티타니아`, `066 말퓨온`, `070 에일라`, `071 발보`, `074 그림리`, `081 펜릴`, `084 그리폰`, `086 레오나르`, `087 바르가스트`, `088 우르삭`, `089 메두사 고르고`, `090 페가수스`)을 실제 웹툰 속 얼굴·헤어스타일·의상·무기 디자인에 맞춰 7등신 전신으로 재설계·재생성 완료.
    - [`classic-cards.json`](file:///Users/dayyoung/project/snshero/public/hs-assets/data/classic-cards.json) 및 [`manifest.json`](file:///Users/dayyoung/project/snshero/public/hs-assets/characters/manifest.json) 내 34종의 카드 플레이버·역할 설명도 웹툰 정사에 100% 동기화 (382장 카드 총수 동결 준수).
  - **2. 크로마키 핫핑크(`#FF00AA`) 단색 배경 생성 + 다중 패스 마젠타 디스필(Despill) 누끼 적용**:
    - 기존 백색 배경 제거 시 백발·은발·흰 의상이 침식되거나 배경 잔상이 남던 현상을 해결하기 위해, 34종 전원을 `#FF00AA` 크로마키 핑크 단색 배경 + 폐곡선 흑색 잉크 외곽선으로 생성 후 6px 경계 알파 페더링 및 마젠타·라벤더 디스필 처리로 전신 컷아웃 [`cutouts/0XX_*.webp`](file:///Users/dayyoung/project/snshero/public/hs-assets/characters/cutouts) 34종 및 상반신 초상화 [`busts/0XX_bust.webp`](file:///Users/dayyoung/project/snshero/public/hs-assets/characters/busts) 34종(총 68개 `RGBA WEBP`) 일괄 갱신.
    - 어두운 배경·흰 배경 양방향 육안 검수 및 픽셀 정량 검증 완료.
  - **3. 프로덕션 빌드 및 구글 폼 보고**:
    - `npm run build` 정상 통과 (`1758 modules transformed`) 및 포트 3000 프리뷰 서버 실시간 반영 확인.
    - 구글 폼 작업 완료 보고 제출 완료.


*(이전 2026-09~10 작업 로그는 기존 원격 저장소 이력에 보관되어 있습니다.)*
