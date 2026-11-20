# SNSHero 개발 및 개선 작업 로그 (WORK_LOGS.md)

이 문서는 매시 정각 주기 스케줄러 및 수동 실행 시 스프레드시트 작업 동기화, 코드 수정 및 검증, 작업 내역을 기록하는 영구 로그입니다.

## [2026-11-20 10:42 KST] [카드플레이 배틀 화면 상단 3줄 HUD 슬림화·불필요 라벨 제거 및 내 초상화 상단 균형 재배치 + 원격 푸시]
- **요청 및 개선 내역**:
  - 카드플레이(`BattleScreen.tsx`) 상대 초상화 하단을 가리던 3줄 HUD를 전면 정리:
    - **1줄**: 실시간 1:1 / 보가트 도박장 / 랭킹대전 / 스토리모드 정보를 단 1줄 컴팩트 필(`h=17~21px`)로 통합 슬림화.
    - **2줄**: `👑 치장품 보기`, `💬 감정표현`, `🔊 도발 허용` 중복 라벨 및 치장품 팝오버 완전 제거.
    - **3줄**: 현재 상황 안내 라벨(`battle-coach-banner`)을 **내 초상화 상단(`footer` 최상단)**으로 이동해 상단 1줄과 상하 대칭 균형 배치(`h=18~24px`).
- **검증**:
  - `npx tsc --noEmit && npm run build` 에러 0건 통과.
  - Playwright 데스크톱(`1280×800`)·모바일(`390×844`) 실측 검증 통과 (`topBadge h=17~21px`, `coachBanner h=18~24px`, `removedBtns=0`).
- **상태**: 로컬 커밋 및 `/git-push` 요청에 따른 `git push origin main` 완료.

## [2026-11-20 10:32 KST] [실시간 PvP 대결 중 상대 이탈·연결끊김 시 즉시 상대 패배(남은 플레이어 즉시 승리) 처리 구현]
- **요청 및 개선 내역**:
  - 실시간 1:1 PvP 대결 중 상대방이 브라우저 탭을 닫거나 새로고침(`beforeunload` / `pagehide`), 화면 이탈(언마운트), 항복, 또는 네트워크 단절로 나갔을 때 남은 플레이어 화면이 멈춰 있던 문제를 해결.
  - `snsheroLiveNetwork.ts`에 `PVP_FORFEIT`·`PVP_PING` 패킷 및 `setActiveBattleRoom`, `sendPvpForfeit`, `sendPvpPing`, `onPvpOpponentLeft`, `onPvpPing` API를 추가하고 `beforeunload`/`pagehide`/`PRESENCE_LEAVE` 발생 시 상대에게 즉시 이탈 신호를 전송하도록 구현.
  - `BattleScreen.tsx`에서 상대 이탈 신호 수신 또는 3초 주기 하트비트 12초 무응답 감지 시 즉시 `concede('OPPONENT')`를 실행하여 남은 플레이어가 즉시 승리 화면 및 보상 정산(`🚪 상대방이 대결에서 나가 즉시 승리했습니다!` 배지 표시)으로 전환되도록 적용.
- **검증**:
  - `npx tsc --noEmit && npm run build` 에러 0건 통과.
  - Playwright 2탭 실시간 E2E 검증: 게스트 탭 닫기 → 호스트 즉시 승리, 호스트 탭 닫기 → 게스트 즉시 승리 양방향 모두 통과.
- **상태**: 로컬 `git commit` 완료 (`git push` 미실행 · 사용자 수동 푸시 대기).

## [2026-11-20 10:18 KST] [랭킹대전 실시간 매칭 전환 + 보가트 도박장·9종족 수련 통합 및 주사위 자동배팅·회전 빨려듦 연출 구현]
- **요청 및 개선 내역**:
  1. **실시간 랭킹대전 (`RANKED`) 개편**:
     - 허브 턴테이블(`BoxHubScreen.tsx`) 순서를 **1순위 랭킹대전 (`Realtime!` 라벨 장착) → 2순위 보가트 도박장**으로 재배치.
     - 랭킹대전 진입 시 상단 3-모드 스위처 탭(`보가트/랭킹대전/9종족 수련`) 제거.
     - **친선(0G) / 골드(10G·50G·100G·300G·500G)** 선택 UI 추가 및 실시간 매칭 시작 시 실시간 대전방 자동 생성(또는 동일 판돈 대기 방 즉시 합류) → 휠로딩 상대 검색 화면 진입.
     - 검색 시간 **1분(60초)** 초과 시 `실시간 대전상대를 찾을 수 없습니다. 대전방에서 대기 합니다.` 팝업 표시, 휠로딩 종료, 생성된 대전방 자동 삭제 및 예치 골드 전액 환불.
     - 실시간 랭킹 PvP 승패 정산 시 공식 랭킹 전적·등급·연승·3승 보너스 및 골드 판돈 2배 정산 연동(`snsheroLiveNetwork.ts`, `storage.ts`, `BattleScreen.tsx`, `HearthstoneApp.tsx`).
  2. **보가트 도박장 + 9종족 수련 통합 (`BOGART_GAMBLE`)**:
     - 보가트 도박장 진입 시 상단 3-모드 스위처 탭 및 수동 골드 베팅 슬라이더/칩 완전 제거.
     - **9종족 수련(일반/숙련)** 난이도 토글 및 9종족 최초 제압 현황 통합 표시 (`일반`: `100~1,200G`, `숙련`: ×10배 `1,000~12,000G`, 숙련 9종족 올클리어 시 +2팩).
     - `[대전 시작]` 클릭 시 **주사위 2개 굴림 애니메이션 → 1~12 눈금 정지 & 배팅금액 자동 설정 → 화면 회전 빨려듦(Vortex Suck-In) 전환 → 랜덤 선택된 9종족 대표와의 카드게임 대결** 즉시 시작(`HeroDeckSelectScreen.tsx`, `hearthstone.css`).
- **검증**:
  - `npx tsc --noEmit && npm run build` 에러 0건 통과.
  - Playwright E2E 전수 검증(데스크톱 `1280×800` + 모바일 `390×844` + 한/영 `?lang=en`): 허브 순서/`Realtime!` 배지, 상단 탭 제거, 랭킹 1분 타임아웃 팝업 정확 문구 & 방 삭제/환불, 2인 실시간 랭킹 매칭 전투 진입, 보가트 일반/숙련 주사위 2개 자동배팅 → 회전 빨려듦 전환 → 랜덤 9종족 전투 진입, 모바일 가로 오버플로우 0건 및 영문 100% 번역 확인.
- **상태**: 로컬 `git commit` 완료 (`git push` 미실행 · 사용자 수동 푸시 대기).

## [2026-11-20 09:33 KST] [웹툰 전 회차(1화~40화 · 총 2,095장) 카단 이미지 전수조사 완료 및 추가 발견 5컷 자연 보정]
- **요청 및 개선 내역**:
  - 기존 24화~31화(437컷 · 60컷 수정)에 이어 나머지 미검수 **1화~23화 · 32화~40화(1,652컷) 및 웹툰 대표 이미지 6장**까지 웹툰 전체 **2,095장** 전수조사를 완료.
  - 추가 발견된 **5개 컷**을 카단 고유 디자인(이마 흉터·귀걸이 제거, 귀살대풍 의상·캐릭터 교체)으로 보정 및 원본 규격(`768×432`, WebP quality=88, method=6)으로 덮어쓰기 완료:
    - **6화 (`episode_06/scene_40.webp`)**: 귀살대 대원복·하오리·각반·짚신을 카단 고유 네이비 판타지 튜닉·붉은 스카프·가죽 브레이서·부츠 및 적갈색 머리로 교체.
    - **9화 (`episode_09/scene_37.webp`)**: 귀멸의 칼날 기유풍 캐릭터·대원복·청록 하오리를 카단 고유 외형·의상 및 중세 망토로 자연 교체.
    - **21화 (`episode_21/scene_15.webp`)**: 카단 이마 흉터 자연 제거.
    - **22화 (`episode_22/scene_00.webp`)**: 타이틀 카드 카단 이마 붉은 흉터 및 화투패 귀걸이 동시 제거(타이틀 문구 무손상 유지).
    - **23화 (`episode_23/scene_24.webp`)**: 카단 이마 흉터 자연 제거.
  - **누적 결과**: 웹툰 전체 40화 + 대표 이미지 6장(총 2,095장) 전수조사 완료, 총 **65컷** 보정 완료(1~5화, 7~8화, 10~20화, 32~40화 및 대표 이미지 6장은 이상 없음).
- **검증**: 5개 수정 이미지 전체 원본 해상도 육안 검수 통과 및 `768×432` WebP 규격 검증(5/5 통과) 완료.
- **상태**: 로컬 `git commit` 완료 (`git push` 미실행 · 사용자 수동 푸시 대기).

## [2026-11-20 09:05 KST] [웹툰 24화~31화 주인공 카단 이마 붉은 흉터(귀멸의 칼날 유사 요소) 전수 검수 및 자연 제거]
- **요청 및 개선 내역**:
  - `public/webtoon-assets/episode_24` ~ `episode_31` 전체 **437개 컷**을 육안 전수 검수하여 주인공 카단(Kadan)의 이마에 잘못 생성된 붉은 불꽃형 흉터(탄지로풍 흉터) 및 관련 귀멸의 칼날 혼입 요소가 포함된 **60개 컷**을 선별·자연 보정 완료.
  - 회차별 수정 내역 (총 60컷 / 437컷):
    - **24화 (3컷)**: `scene_00`, `scene_11`, `scene_44`
    - **25화 (13컷)**: `scene_00`, `scene_03`, `scene_11`, `scene_13`, `scene_27`, `scene_28`, `scene_30`, `scene_39`, `scene_42`, `scene_45`, `scene_48`, `scene_52`, `scene_53`
    - **26화 (9컷)**: `scene_00`, `scene_02`, `scene_06`, `scene_10`, `scene_13`, `scene_26`, `scene_48`, `scene_52`, `scene_56`
    - **27화 (13컷)**: `scene_02`, `scene_05`, `scene_06`, `scene_09`, `scene_13`(화투패 귀걸이 제거 포함), `scene_18`, `scene_23`, `scene_26`, `scene_31`, `scene_33`, `scene_38`, `scene_45`, `scene_50`
    - **28화 (8컷)**: `scene_00`, `scene_25`, `scene_28`, `scene_30`, `scene_31`, `scene_38`, `scene_41`, `scene_47`
    - **29화 (6컷)**: `scene_06`, `scene_23`, `scene_32`, `scene_36`, `scene_40`, `scene_46`
    - **30화 (3컷)**: `scene_00`, `scene_37`, `scene_43`
    - **31화 (5컷)**: `scene_00`, `scene_03`(좌측하단 초록·검정 체크무늬 하오리 및 흉터를 카단 고유 청색 튜닉·붉은 스카프로 교체), `scene_07`, `scene_19`, `scene_24`
- **검증**:
  - 수정된 60개 이미지 전체를 컨택트 시트 및 원본 해상도 육안 검수로 100% 통과 확인(포즈·구도·배경·타이틀/아웃트로 텍스트 무손상 유지).
  - 원본 규격(`768×432`, WebP quality=88, method=6)으로 전수 변환·덮어쓰기 및 무결성 검증(60/60 통과) 완료.
- **상태**: 로컬 `git commit` 완료 (`git push` 미실행 · 사용자 수동 푸시 대기).

## [2026-11-19 17:51 KST] [카단·실리아 합동 필살기 통합 & 좌측하단 이전 · 우측하단 리얼 실시간 채팅(대화수 배지 · 골드 선물 · 길드채팅 · 1:1 내 카드덱 대전방) 구축]
- **요청 및 개선 내역**:
  1. **카단·실리아 양측 공간 낭비 해소 — 카단 챗봇 좌측하단(실리아 위치) 이전 & 필살기 동시 합동 시전 (`KadanChatbotWidget.tsx`, `BattleScreen.tsx`, `BoardVfxCanvas.tsx`, `CollectionScreen.tsx`)**:
     - 기존 좌측하단 단독 `SiliaUltimateWidget` 상시 배치를 제거해 양쪽 하단 공간 낭비를 원천 해소하고, `KadanChatbotWidget`을 우측하단에서 **좌측하단(`bottom-2.5 left-2.5 sm:bottom-3.5 sm:left-3.5`)** 으로 이전.
     - 카단 필살기 발동 시(`카단의 기세 100 → 🔥필살기!`) 전장 상황(체력·아군 보호막 유무)에 맞춰 실리아 바람풍 필살기(`녹풍 대참격` / `폭풍 결계진` / `회오리 생명풍`)가 **지연 없이 카단 눈보라 필살기와 동시에 합동 시전**되도록 통합(`useKadanMomentumUltimate` + `useSiliaChainUltimate` 동시 실행).
     - 상단 합동 컷인 배너에 **카단 & 실리아 상반신 초상화 2종 동시 노출** 및 좌측하단 카단 옆에 **실리아 3등신 합동 시전 카메오(`kadan-silia-dual-cameo`)** 가 함께 등장하도록 연출 강화(수동 플레이 시에도 좌측하단 컴팩트 기세 오브 지원).
  2. **우측하단(기존 챗봇 자리) 리얼 실시간 채팅 아이콘 & 실시간 대화 인원 배지 (`LiveCommunityChatWidget.tsx`, `HearthstoneApp.tsx`, `PromoApp.tsx`)**:
     - 기존 우측하단 자리에 말풍선 기반 **리얼 실시간 채팅 플로팅 아이콘(`live-chat-trigger-btn`)** 과 **실시간 접속·대화 숫자 배지(`live-chat-count-badge` + 미확인 알림 카운터)** 표시(전투 화면에서는 우측하단 마나 수정 트레이와 겹치지 않도록 상단 오프셋 배치).
  3. **대중적 빌트인·서버리스 실시간 네트워크 엔진 구축 (`src/hearthstone/services/snsheroLiveNetwork.ts`)**:
     - 브라우저 표준 빌트인 `BroadcastChannel` + WebRTC P2P 데이터채널(`trystero`) + 글로벌 WSS Pub/Sub(`mqtt`) 3중 멀티 트랜스포트 및 패킷 중복 제거(`seenPktIds`) 아키텍처로 별도 백엔드 서버 없이 정적 호스팅(`snshero.com`)에서 즉시 동작하는 실시간 멀티플레이 네트워크 구현.
  4. **유저 간 실시간 골드 선물 · 길드 창설/길드채팅창 · 내 30장 카드덱 1:1 실시간 대전방 (`LiveCommunityChatWidget.tsx`, `storage.ts`, `GameEngine.ts`, `pvpSync.ts`, `BattleScreen.tsx`)**:
     - **유저 간 골드 선물(`GOLD_TRANSFER`)**: 접속 유저 선택 또는 ID 입력 후 `10G~500G`/직접 입력 골드를 즉시 송금·수령하며, 발신자 차감 및 수신자 적립(중복 수령 방지 `hero_hs_claimed_gold_transfers`)을 100% `localStorage`에 영구 반영.
     - **길드 & 길드채팅창(`GUILD`)**: 프리셋 공개 길드 즉시 가입, 커스텀 길드 창설(태그·길드명·아이콘), 초대코드/태그 가입 및 길드원 전용 실시간 길드채팅·길드 내전방 지원.
     - **내 카드덱 1:1 실시간 대전방(`DUEL` & `pvpSync.ts`)**: 플레이어가 보유한 30장 카드덱(`hsStorage.getDecks()`)을 직접 선택해 친선전(`0G`) 또는 골드 내기(`10G~500G` 에스크로) 대전방을 개설·참전하고, 양측 멀리건(`confirmPvpDualMulligan`)부터 턴 전환·카드 사용·영웅 능력·공격·감정표현·승패 및 판돈 정산까지 실시간 동기화.
  5. **다국어 언어팩 동기화 (`src/i18n/dynamicPatterns.ts`, `src/i18n/locales/*.ts`)**:
     - 한·영(`ko`/`en`) 및 다국어 로케일 파일(`ja`, `zh-CN`, `zh-TW`, `es`, `fr`, `de`, `pt`, `ru`) 번역 키 일괄 반영.
- **빌드 & 멀티 브라우저 Playwright E2E 검증**:
  - `npx tsc --noEmit && npm run build` 0 에러 통과, 수집 가능 카드 **382장 동결** 무결성 확인.
  - 데스크톱(`1280×800`)·모바일(`390×844`) 한·영(`ko`/`?lang=en`) 실측: 카단 좌측하단·리얼 채팅 우측하단 배치, 단독 실리아 위젯 제거, 마나 트레이 비겹침, 기세 100 달성 시 카단+실리아 동시 합동 필살기 컷인·카메오 확인.
  - 격리된 2개 브라우저 컨텍스트(`Player A` ↔ `Player B`) 실시간 멀티플레이 실측: 실시간 대화 숫자 `2` 자동 갱신, 전체 채팅 및 신규 길드 창설·길드채팅 실시간 송수신, `50G` 골드 선물 송수신(`250G→200G` / `250G→300G`), 내 30장 카드덱 1:1 대전방 개설·참전·멀리건·양방향 턴 전환 및 `50G` 내기 판돈 승리 정산(`200G→300G`) 전 과정 통과.
- **상태**: 로컬 `git commit` 완료 (`git push` 미실행 · 사용자 수동 푸시 대기).

## [2026-11-19 08:00 KST] [/checkAll 3대 관리 문서(이슈·개발·마케팅) 일괄 점검·구현 및 시트 동기화]
- **3대 문서 점검 요약**:
  - **이슈문서 (`게임 이슈 관리 로그`)**: 12건 전수 `완료` 상태 확인 (신규 미해결 0건).
  - **개발문서 (`개발개선점 분석 로그`, `DEV-056` ~ `DEV-078` 23건)**: 전수 코드 구현 및 검증 완료.
  - **마케팅문서 (`마케팅 분석 로그`)**: 코드·저장소 적용 가능 항목(`MKT-074`, `MKT-076`, `MKT-081`) 반영 완료 (외부 채널 전용 항목 상태 유지).
- **주요 코드 구현 내역**:
  1. **오카리나 리듬 오디오·그루브·등급 통합 엔진 신설 (`src/hearthstone/services/rhythmCueEngine.ts`)**:
     - 9종족 고유 화음(`playFactionChord`), 키워드 타악기(`playKeywordPercussion`), 24종 전투·팩 개봉·종지·핸드 경고·피날레 리듬 큐(`playRhythmCue`), 덱 마나커브 기반 BPM 그루브 분석(`computeDeckGrooveProfile`: Aggro 140 / Tempo 128 / Control 116 BPM), 오카리나 공명 S/A/B 등급 산출(`gradeRhythmPerformance`), 블루투스 3-Tap 오디오 싱크 보정(`computeBluetoothSyncOffsetMs`) 구현.
  2. **인게임 딥링크·옵션·컬렉션·팩 개봉·전투 결과창 연동 (`HearthstoneApp.tsx`, `Modals.tsx`, `CollectionScreen.tsx`, `PackOpeningScreen.tsx`, `BattleScreen.tsx`)**:
     - `?deck_focus=<cardId>` 및 `?wager=` 딥링크 파라미터 처리 및 추천 덱 자동 장착(`DEV-056`, `DEV-074`).
     - 옵션 모달 리듬 싱크 슬라이더 `-200ms ~ +200ms` 확장 및 `🎧 3탭 싱크` 캘리브레이터 탑재(`rhythm-bt-sync-btn`, `DEV-061`).
     - 컬렉션 덱 빌더 마나 커브 하단에 덱 그루브 BPM 배지 표시(`deck-groove-badge`, `DEV-060`).
     - 카드팩 개봉 시 5비트 오카리나 리듬 플립 오디오 큐 연동(`DEV-058`).
     - 전투 진입 멀리건 카운트인·종족 화음, 손패 9장 이상 심장박동 경고(`DEV-072`), 피날레 팡파르, 결과창 오카리나 공명 등급 바(`battle-rhythm-grade-bar`, `DEV-068`) 및 스토리 원작 웹소설 직결 링크(`battle-result-novel-link`, `MKT-076`) 추가.
  3. **프로모션 카드 라이트박스 & SEO 정합성 (`src/promo/PromoApp.tsx`, `game.html`)**:
     - 카드 상세 모달에 `[🎵 1.5x·2.0x 리듬 공명 시험]`(`promo-card-rhythm-test-btn`) 및 `[⚔️ 이 카드 주력 덱으로 즉시 출격]`(`/game?deck_focus=<id>&rhythm=on`, `promo-card-deck-focus-cta`) CTA 추가(`DEV-056`, `MKT-081`).
     - `game.html` `#hs-root`에 `data-nosnippet` 속성 추가해 검색 스니펫 오염 차단(`MKT-074`).
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 실측 검증(`/` KO 데스크톱 라이트박스 리듬 공명 시험 + `deck_focus`/`rhythm=on` 딥링크 정상, `/game.html?deck_focus=EX1_116&rhythm=on&lang=en` EN 모바일 `390×844` `data-nosnippet` 확인·가로 오버플로우 없음·콘솔/페이지 에러 0건).
- **상태**: 로컬 `git commit` 완료 (`git push` 미실행 · 사용자 수동 푸시 대기).

## [2026-11-19 07:56 KST] [『카단의 기세』 100 충전제 개편 · 100 달성 시 불꽃 점화(1초 클릭 중지) 후 수동 탭 필살기 작렬 구현]
- **요청 및 개선 내역**:
  1. **『카단의 기세』 `0/100 → 100` 충전제 개편 (`src/hearthstone/screens/BattleScreen.tsx`, `src/hearthstone/engine/GameEngine.ts`)**:
     - 기존 10스택 자동 발동 방식을 폐기하고, 마구 연타(`+1`) 또는 초록 링 정박 탭(`+10`)으로 **`0/100`부터 `100`까지 모아서 1회 발동**하는 필살기 충전제로 개편.
     - 100 충전 필살기 위력에 맞춰 카단 눈보라 필살기(`X100`) 피해량을 `적 전체·영웅 -5×단계` · `방어도 +6×단계` · `아군 전체 +2/+2×단계 및 천상의 보호막`으로 상향하고 직후 실리아 무작위 바람풍 연속 필살기가 이어지도록 연동.
  2. **100 도달 시 기세 버튼 불꽃 점화(`IGNITING`) 및 1초간 클릭 중지 → 1초 후 수동 탭(`READY`) 발동 (`src/hearthstone/screens/BattleScreen.tsx`, `src/hearthstone/hearthstone.css`)**:
     - 게이지가 `100`이 되는 즉시(`IGNITING`) 버튼이 다중 불꽃 왕관·화염 오라·불티 파티클로 활활 불타오르며 **1.0초 동안 클릭 및 `Space` 입력이 중지(`disabled`, 1초 원형 점화 게이지 표시)** 되어 연타 중 오발동을 원천 방지.
     - 1.0초 경과 후 불타는 `[🔥 필살기!]` 준비 상태(`READY`)로 전환되며, 플레이어가 버튼을 탭(또는 `Space`)하면 즉시 화면 진동과 함께 **카단 눈보라 + 실리아 바람풍 합동 필살기가 작렬**하고 게이지가 `0/100`으로 초기화되어 재충전 가능하도록 구현.
  3. **게임 방법 · 전투 규칙 · 옵션 · 카단 AI 챗봇 · 프로모션 한·영 안내 최신화 (`OnboardingGuideModal.tsx`, `KadanChatbotWidget.tsx`, `localLlmAssistant.ts`, `Modals.tsx`, `PromoApp.tsx`)**:
     - 한·영(`ko`/`en`) 전 화면 가이드를 `100 충전 → 불꽃 점화 & 1초 대기 → 탭 시 필살기 작렬` 규칙으로 동기화.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 한국어 모바일(`360×844`) 및 영문 데스크톱(`1280×800`) 스토리 모드에서 `0/100 → 🔥100(IGNITING, disabled=true, 1초 클릭 차단 확인) → 1초 후 READY(🔥필살기 작렬! 배지) → 클릭 시 눈보라 합동 필살기 발동 및 0/100 리셋` 전 과정 실측 통과.
- **상태**: 로컬 `git commit` 완료 (`git push` 미실행 · 수동 푸시 대기).

## [2026-11-18 17:31 KST] [Demand Gen 쇼츠 광고 영상 주역 영웅(카단·실리아·이그니스) 컷 전면 개편]
- **요청**: 알렉산다르 중심 클립 대신 게임 주역 3인방(카단·실리아·이그니스)이 등장하는 하이라이트 컷으로 재제작
- **수정 컷 구성 (`docs/ads/creatives/snshero_demandgen_shorts_{kr,en}_20s.mp4`)**:
  - Beat 1 (`0.0~4.2s`): `10화 불꽃 궁정의 포로` 오프닝 (이그니스 화염검 vs 카단·실리아 3인 대치) + `설치 0초 · 무료 3팩 + 250G` 훅
  - Beat 2 (`4.2~7.8s`): `16화 폐허 앞의 형제` 카단 & 이그니스 불꽃 대검 장면 + `카단 · 실리아 · 이그니스 덱 합류!` 배너 (`top: 1176px` 보정으로 자막 박스 비겹침 확보)
  - Beat 3 (`7.8~11.4s`): `38화 세 개의 비단 봉인` 실리아 공중 도약 녹옥 지팡이 바람 마법 액션
  - Beat 4 (`11.4~15.2s`): 인게임 실제 전투 필살기 + 천공 제단 미개봉 3팩 쇼케이스 + `39화` 클라이맥스 BGM
  - Beat 5 (`15.2~20.0s`): 방패 로고 + 3대 혜택 + 맥동하는 **`3초 만에 3팩 무료 개봉`** CTA 엔드카드
- **검증**: KR/EN 모두 `ffprobe` (`1080×1920`, H.264+AAC, `20.000000s`, 6.29MB/6.20MB) 및 디코딩 프레임 비겹침 육안 검수 완료
- **상태**: 로컬 커밋 완료 (원격 푸시 보류 · 구글 폼 보고 미수행)

## [2026-11-18 16:50 KST] [YouTube Shorts / Demand Gen 광고용 20초 숏폼 KR·EN 2종 제작 완료]
- **요청**: `@snshero` 40화 웹툰 쇼츠 하이라이트(15~25초)에 `"3초 3팩 무료 개봉"` CTA를 결합한 Google Ads Demand Gen / YouTube Shorts 광고 소재 제작
- **산출물 (`docs/ads/creatives/`)**:
  - `snshero_demandgen_shorts_kr_20s.mp4` (`1080×1920`, 30fps, H.264 + AAC, 20.0s, 5.6MB)
  - `snshero_demandgen_shorts_en_20s.mp4` (`1080×1920`, 30fps, H.264 + AAC, 20.0s, 5.8MB)
- **구성**:
  - Beat 1 (`0.0~4.2s`): EP01 눈보라 인트로 + `설치 0초 · 웹툰이 카드 배틀이 된다` 상단 훅 + `첫 방문 무료 3팩 + 250G 즉시 지급` 배너
  - Beat 2 (`4.2~11.4s`): EP01 알렉산다르 서약 클라이맥스 + `382종 카드 · 9대 종족 전략 TCG` / `40화 성우 풀보이스 · 첫 10팩 전설 100% 확정` 배너
  - Beat 3 (`11.4~15.2s`): 인게임 실제 전투 필살기(`guide_04_combat_ult.webp`) + 미개봉 3팩(`guide_05_packs.webp`) 줌인 쇼케이스
  - Beat 4 (`15.2~20.0s`): 방패 로고 + 3대 혜택 바 + 맥동하는 대형 골드 CTA(`3초 만에 3팩 무료 개봉` / EN `Open 3 Packs in 3 Sec`)
- **검증**: HyperFrames `check --json` 오류 0건(명암 대비 22/22 PASS), 스냅샷 및 최종 MP4 디코딩 프레임 검수 완료, `ffprobe` 스트림(1080×1920 H264+AAC 20.0s) 검증 통과
- **상태**: 로컬 파일 및 로그 기록 완료 (구글 폼 보고 미수행)

## [2026-11-18 16:32 KST] [전체 `.md` 지침 및 스킬에서 구글 폼 보고 규칙 제거]
- **요청**: 작업 완료 후 구글 폼 보고 중단 및 모든 `.md` 지침·스킬 문서에서 구글 폼 제출 지침 제거
- **수정 파일 (14종)**: `GEMINI.md`, `AGENTS.md`, `skills/{checkAll,checkIssue,checkBug,checkMarket,imp-mission,rsi,rsi-snshero,update-stone,ge,gemini-ex,script-anime,report-ex}/SKILL.md`
- **결과**: 모든 `.md` 문서 내 구글 폼 제출 명령(`submit_report.py`, `formResponse`) 및 보고 의무화 섹션 제거 완료 (`rg` 검증 확인)
- **상태**: 로컬 커밋 완료 (원격 푸시 보류 · 구글 폼 보고 미수행)

## [2026-11-18 16:27 KST] [Google Ads 웹 업로드 `04_web_negative_keywords.xlsx` 열/매치타입 수정]
- **원인**: `Keyword` + `Negative phrase` 조합 시 Google Ads 웹 일괄 업로드가 일반 키워드로 오인해 `Match type` 오류 발생
- **수정**: `04_web_negative_keywords.xlsx` 헤더를 `Negative keyword`, `Match type` 값을 `Phrase`로 수정 및 OOXML 무결성 검증 완료
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-18 16:20 KST] [Google Ads 일괄 업로드 엑셀 `EU political ads: No` 열 보완]
- **원인**: Google Ads 웹 미리보기 결과 2종 캠페인(`SNSHero_Search_TCG_KR`, `SNSHero_Search_TCG_EN`)에서 신규 정책 필수 열 `'EU 정치 광고'` 누락 오류 발생
- **수정**: `01_web_campaigns.xlsx`, `snshero_google_ads_campaigns.xlsx`, `snshero_google_ads_editor.csv` 에 `EU political ads` = `No` 컬럼 추가 및 OOXML 재검증 완료
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-18 16:17 KST] [Google Ads 웹 콘솔 일괄 업로드 전용 엑셀 5종(`docs/ads/web_upload/`) 생성 (푸시 대기)]
- **요청**: Google Ads 웹 콘솔(`도구 → 일괄 작업 → 업로드`) 방식에 맞춘 전용 엑셀 분할 제작
- **산출물 (`docs/ads/web_upload/`)**:
  - `01_web_campaigns.xlsx`, `02_web_ad_groups.xlsx`, `03_web_keywords.xlsx`, `04_web_negative_keywords.xlsx`, `05_web_responsive_search_ads.xlsx` (각 파일 `Action: Add`, 웹 업로드 표준 헤더 반영, OOXML XML 파싱 무결성 검증 통과)
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-18 16:15 KST] [Google Ads 캠페인 대량 업로드용 Excel(`.xlsx`) 및 Editor `.csv` 생성 (푸시 대기)]
- **요청**: `SNSHero_Search_TCG_KR` · `SNSHero_Search_TCG_EN` 캠페인 구조를 한 번에 업로드할 수 있는 엑셀/CSV 파일 제작
- **산출물**:
  - `docs/ads/snshero_google_ads_campaigns.xlsx` (7개 시트: `Editor_Import_All`, `Campaigns`, `Ad Groups`, `Keywords`, `Negative Keywords`, `Responsive Search Ads`, `Upload_Guide`)
  - `docs/ads/snshero_google_ads_editor.csv` (UTF-8 BOM CSV, 총 61행, Google Ads Editor 원클릭 가져오기용)
- **검증 결과**:
  - 한글 2바이트(전각) 글자수 폭 검증(`assert`): 모든 한국어/영문 제목 폭 `<= 30`, 설명 폭 `<= 90`, 경로 폭 `<= 15` 통과
  - OOXML(`.xlsx`) 12개 XML/RELS 파일 파싱 무결성 검증 통과
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-18 15:56 KST] [Google Ads 태그 `AW-980426001` 전역 gtag 스니펫 결합 연동 (푸시 대기)]
- **요청**: Google Ads 계정(`3072359722`)의 Google 태그 ID(`AW-980426001`)를 `snshero.com` 전체 페이지에 연동해 `Google 태그 사용: 아직 설치되지 않음` 해소 및 직접 전환/리마케팅 측정 기반 구축
- **수정 파일 (9종)**:
  - `index.html`, `game.html`, `book.html`, `sns.html`, `webtoon.html`, `novel.html`, `public/wiki/tip/index.html`: 기존 `gtag('config', 'G-MT60DTV1KJ')` 스니펫 내부에 `gtag('config', 'AW-980426001');` 결합 추가 (`localhost`/`127.0.0.1`/`*.ts.net` 비전송 및 `?ga_debug=1` 디버그 정책 동일 적용)
  - `scripts/post-build.js` (`/mcp` 정적 페이지 템플릿) 및 `scripts/generate-seo-pages.mjs` (192개 KO/EN SEO 페이지 공통 `GA_HEAD_SNIPPET`)에 `AW-980426001` config 동시 반영
- **검증 결과**:
  - `npx tsc --noEmit` 및 `npm run build` 통과 (`1777 modules transformed`, 192개 SEO 페이지 생성, `0` 에러)
  - Playwright 검증(`1280×800`, `?ga_debug=1`): `/` 및 `/game.html?open=pack3&lang=ko` 모두 `dataLayer` 내 `['config', 'G-MT60DTV1KJ']` + `['config', 'AW-980426001']` 초기화 및 팩 개봉 시 `hero_pack_opened`, `hero_first_pack_opened` 발화 확인 (`errors: []`)
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-18 15:19 KST] [Google Ads 퍼널 전환 이벤트 추적 + UTM/GCLID 보존 및 캠페인 플레이북 수립 (푸시 대기)]
- **요청**: Google Ads(`3072359722`) 및 GA4(`properties/223457203` / `G-MT60DTV1KJ`) 실측 분석을 바탕으로 실효성 있는 Google Ads 캠페인/전환 정리 플레이북 수립 및 광고 퍼널 어트리뷰션·전환 이벤트 코드 구현
- **수정 및 추가 파일**:
  - `src/hearthstone/services/analyticsEvents.ts` (신규 — `trackHeroEvent`, `trackHeroScreenView`, `trackHeroPackOpened`, `trackHeroBattleStarted`, `trackHeroBattleCompleted`, `trackHeroRewardedAdCompleted`, `appendAttributionToGameUrl` 구현: UTM/`gclid`/`fbclid`/`ttclid`/`msclkid` 쿼리 보존, `window.__heroTrackedEvents` 버퍼 기록 및 프로덕션/`?ga_debug=1` 환경 `gtag` 전송)
  - `src/promo/PromoApp.tsx` (프로모 랜딩 `/` → `/game` CTA 링크 `header-play-now-btn`, `promo-hero-primary-cta`, 하단 `Enter Elwin Village` 및 `claim_promo`/`mode=story` 경로에 `appendAttributionToGameUrl` + `hero_promo_cta_click` 이벤트 연결)
  - `src/hearthstone/HearthstoneApp.tsx` (`trackHeroScreenView` 연동)
  - `src/hearthstone/storage.ts` (`openOnePack` 완료 시 `trackHeroPackOpened` 호출 — 최초 1회 `hero_first_pack_opened` 및 `hero_pack_opened` 발생)
  - `src/hearthstone/screens/BattleScreen.tsx` (`PLAYING` 진입 시 `trackHeroBattleStarted` (`hero_battle_started`, 최초 1회 `hero_first_battle_started`) 및 `GAME_OVER` 시 `trackHeroBattleCompleted` (`hero_battle_won` / `hero_battle_lost`) 호출)
  - `src/hearthstone/components/Modals.tsx` (`TavernShopModal` 보상형 광고 수령 시 `trackHeroRewardedAdCompleted`, 체크아웃 시작 시 `hero_shop_checkout_started` 호출)
- **산출물(플레이북)**: `google_ads_campaign_playbook.md` (오전/과거 잘못된 `페이지 로드` 구매 전환 `7614809758`/`7614812589`·`7611270384` 보조 전환 정리, `SNSHero_Search_TCG_KR`·`SNSHero_Search_TCG_EN`·YouTube Shorts Demand Gen 세팅, 제외 키워드 및 KO/EN RSA 카피 세트 수록)
- **검증 결과**:
  - `npx tsc --noEmit` 및 `npm run build` 통과 (`1777 modules transformed`, `0` 에러)
  - Playwright E2E 검증(`verify_ads_funnel.mjs`) 통과 (`ok: true`, 콘솔/페이지 에러 `0`건):
    - 데스크톱(`1280×800`, `ko-KR`) 프로모 CTA href UTM/`gclid` 보존 확인 (`/game?open=pack3&utm_source=google_ads&utm_medium=cpc&utm_campaign=kr_test&gclid=test123&lang=ko`)
    - 모바일(`390×844`, `en-US`) 팩 개봉 시 `hero_pack_opened`, `hero_first_pack_opened` 및 스토리 전투 진입·항복 시 `hero_battle_started`, `hero_first_battle_started`, `hero_battle_lost` 발화 확인
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-18 14:24 KST] [상점 Google H5 Games 보상형 광고(+50G) 골드 충전 기능 구현 (푸시 대기)]
- **요청**: Google 애드센스 정책 준수 범위 내 1번 방식(Google H5 Games Ads `Ad Placement API`)으로 상점 내 광고 시청 후 골드 충전 기능 구현
- **수정 및 추가 파일**:
  - `game.html` (`ca-pub-6937094123258335` 스크립트에 `data-ad-frequency-hint="30s"` 및 공식 `window.adBreak` / `window.adConfig` 큐 초기화 추가)
  - `src/hearthstone/services/h5RewardedAds.ts` (신규 — `adConfig({ preloadAdBreaks: 'on' })`, `adBreak({ type: 'reward', name: 'shop_gold_recharge' })` 래퍼: `beforeReward` 자발적 Opt-In 프롬프트, `adViewed` 완료 시에만 보상 지급, `adDismissed`·오류 시 0G, `beforeAd`/`afterAd` 오디오 일시정지/복귀)
  - `src/hearthstone/audio.ts` (`suspendForAd()` / `resumeAfterAd()` 비영구 오디오 일시정지·복원 추가)
  - `src/hearthstone/storage.ts` (`hero_hs_rewarded_ad_log` 로컬스토리지 기반 1회 `+50G`, 일일 최대 5회·250G/일 및 45초 쿨타임 제한 `getRewardedAdQuotaStatus`·`claimRewardedAdGold` 구현)
  - `src/hearthstone/HearthstoneApp.tsx` (앱 시작 시 `initH5GamesAds` 및 음소거 설정 변경 시 `syncH5AdSound` 연동)
  - `src/hearthstone/components/Modals.tsx` (`TavernShopModal` 1단계 골드 카드팩 영역 하단에 `shop-rewarded-ad-card` 추가 — Opt-In 확인 2단계 버튼, 남은 횟수 `5/5`, 45초 쿨타임 카운트다운, 비현금성 게임 내 재화 안내 표기)
- **검증 결과**:
  - `npx tsc --noEmit` 및 `npm run build` 통과 (`0` 에러)
  - Playwright 데스크톱(`1280×800` 한국어) 및 모바일(`390×844` 영문) E2E 검증 완료: H5 API 전역 훅·`data-ad-frequency-hint="30s"` 확인, `adDismissed` 중도 이탈 시 `0G` 유지(`250G`), `adViewed` 시청 완료 시 `+50G` 반영(`300G`) 및 일일 한도(`4/5`)·쿨타임 비활성화 확인, 모바일 스크린샷 및 콘솔/페이지 에러 `0`건 확인
- **안내 사항**: 실제 라이브 도메인(`snshero.com`)에서 실 광고가 노출되려면 AdSense 콘솔 내 **H5 Games Ads 프로그램 신청·승인**이 추가로 필요합니다.
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-18 12:53 KST] [『카단의 기세』 마구 연타(`+1`) · 초록 정박(`+10`) 누적 방식 개편 및 스토리 모드(`TUTORIAL`) 전용 제한 적용]
- **요청 및 개선 내역**:
  1. **『카단의 기세』 연타(`+1`) 및 초록 링 타이밍(`+10`) 이중 누적 체계 구현 (`src/hearthstone/screens/BattleScreen.tsx`, `src/hearthstone/audio.ts`)**:
     - 기존 빨간 링 구간 `엇박!(MISS)` 무효 처리를 제거하고, **아무 때나 마구 눌러도 `+1`씩 기세 스택이 누적**되도록 개편(`연타+1` / `TAP+1` 큐 및 `+1` 배지 피드백, 경쾌한 하모닉 단음 사운드 재생).
     - **초록 링(`TAP+10`) 정박 타이밍**에 맞춰 탭하면 **한 번에 `+10` 스택(`+10⚡` / `🛡+10`)** 이 대폭 누적되도록 개편(동일 비트 중복 수령 및 280ms 미만 무작위 고속 연타 시에는 `+1` 연타 판정으로 분리).
     - 누적 기세가 10의 배수 구간(`10, 20, 30…`)을 도달하거나 돌파(`Math.floor(next / 10) > Math.floor(prev / 10)`, 예: `X3`에서 초록 정박 `+10` 적중 → `X13`)할 때마다 즉시 배수 비례 **카단 눈보라 필살기 + 실리아 무작위 바람풍 연속 필살기**가 발동하도록 개선.
  2. **『카단의 기세』 스토리 모드(`mode === 'TUTORIAL'`) 전용 제한 (`src/hearthstone/screens/BattleScreen.tsx`)**:
     - `CenterRhythmRingHud`, `handleRhythmOrbTap`, `Space` 키보드 단축키, 영웅 직접 공격 시 실리아 연속 바람풍 체인을 모두 `mode === 'TUTORIAL'`(스토리 여정 모드)에서만 활성화되도록 격리하고, 랭킹·일반·연습·보가트 도박장 모드에서는 공정 경쟁을 위해 완전 비활성화.
  3. **게임 방법(`How to Play`) · 전투 규칙 · 옵션 · 카단 AI 챗봇 · 프로모션 한·영 안내 동기화 (`src/hearthstone/components/OnboardingGuideModal.tsx`, `src/hearthstone/components/KadanChatbotWidget.tsx`, `src/hearthstone/services/localLlmAssistant.ts`, `src/hearthstone/components/Modals.tsx`, `src/promo/PromoApp.tsx`)**:
     - 전 화면의 한·영(`ko`/`en`) 설명을 **스토리 모드 전용 · 마구 연타 시 `+1` / 초록 정박 타이밍 탭 시 `+10`** 규칙에 맞춰 일괄 최신화.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 한국어 모바일(`360×844`) 스토리 모드 연타(`X0 → X1 → X3`) 및 초록 정박(`X3 → X13` + 눈보라 필살기 즉시 발동) 검증, 영문 데스크톱(`1280×800`) 랭킹전 자동플레이 시 `kadan-command-orb = 0` 및 `Space` 비활성 검증 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 12:19 KST] [405종 전 카드 일러스트 `768×768` 웹툰 화풍 전면 리마스터 · 소설 등장인물 상반신 100% 일치 · 5단계 등급 및 24K 소버린 드래곤 전설 디자인 고도화]
- **요청 및 개선 내역**:
  1. **전 카드(수집 가능 382종 동결 + 소환 토큰 23종 = 총 405종) `768×768` 한국형 다크 판타지 웹툰 일러스트 전면 리마스터 (`public/hs-assets/cards/{class,neutral,tokens}/*.webp`)**:
     - 기존 `3×3` 격자 슬라이싱(`384×384`)으로 인해 선명도가 떨어지던 이미지를 100% 폐기하고 전수 `768×768` WebP(면적 4배 향상, 총 40.33MB · 평균 102KB)로 교체.
     - 24종의 소설 무대 배경지 시트 + 12종 영웅 무기 + 16종 특급 주문 + 28종 희귀 주문 + 15종 소환 토큰 등 101종의 신규 `1024×1024` 한국형 다크 판타지 웹툰 원화를 생성해 반영하고, 기본·일반 주문 107종도 격자 테두리 제거 및 셀 잉크·속성 광원 리마스터 완료.
  2. **소설·웹툰 등장인물 상반신(`upper-hd` 24인 + 정식 `cutouts` 199종) 100% 픽셀 일치 (`src/hearthstone/cardDb.ts`, `public/hs-assets/cards/**`)**:
     - 스토리 대화창 및 프로모션에 노출되는 `public/hs-assets/upper-hd/*.webp` 24인(카단, 실리아, 로비나드, 레이, 발리안, 알렉산다르, 카르마, 제논, 포세이돈, 이그니스, 엘윈 등)과 웹툰 공식 캐릭터 컷아웃을 얼굴·어깨 중심축 자동 정렬로 카드에 직접 합성하여 대화창 ↔ 영웅 아치 초상화(`resolveUpperBodyHeroUrl`) ↔ 카드 일러스트 간 외모/복장 괴리를 100% 해소.
  3. **기본/일반/희귀/특급/전설 5단계 등급 조형 차별화 및 전설 소유욕 극대화 (`src/hearthstone/components/CardVisual.tsx`, `src/hearthstone/components/SnsHeroArtKit.tsx`, `src/hearthstone/hearthstone.css`)**:
     - **기본(`FREE`)**: 정통 하스스톤 기본 규칙에 맞춘 무보석 주철 각인 명판 · 수련생 석재 프레임 · 가죽 리본.
     - **일반(`COMMON`)**: 백랍 은빛 테두리 · 4귀 코너 리벳 · 날개형 은받침 백수정 보석.
     - **희귀(`RARE`)**: 문실버 & 코발트 이중 필리그리 레일 · 4귀 다이아몬드 장식 · 사파이어 내부 글로우 & 로열 사파이어 보석.
     - **특급(`EPIC`)**: 골드 & 자수정 이중 베벨 프레임 · 4귀 아케인 첨탑 조각 · 비전 오로라 스윕(`hsEpicArcaneSweep`) & 다면 컷 자수정 보석.
     - **전설(`LEGENDARY`)**: `SnsLegendaryCardDragonSvg`를 평면 회색 다각형에서 **입체 주조 24K 소버린 골드 & 선파이어 브론즈 엘리트 드래곤 크레스트**(왕관 용두·이마 태양석·날개·양쪽 발톱 그립)로 전면 재조각하고, 4귀 용왕관 가드 · 왕실 아이보리/크림슨 골드 리본 · 용날개 왕관 받침 선파이어 호박 보석 · 상시 프리즘 광택(`hsLegendaryPrismaticSweep`)을 적용.
  4. **정통 하스스톤 카드 설명 표현 보존 및 도감·확대 모달 UX 개선 (`src/promo/PromoCard.tsx`, `src/hearthstone/components/CardZoomModal.tsx`, `src/hearthstone/screens/CollectionScreen.tsx`, `public/sw.js`)**:
     - 프로모션 메인(`PromoCard.tsx`)의 요약 칩 모드를 해제하고 하스스톤 정통 굵은 키워드(`전투의 함성:`, `죽음의 메아리:`, `도발` 등 `.hs-card-ability-text`) 텍스트 박스로 통일, 무기 카드의 비표준 `[영웅 장착 무기]` 문구 제거.
     - `CardZoomModal.tsx`에 5단계 등급 프레스티지 헤더 배지·후광 페데스탈·소설 등장인물 40인 서사 시너지 해설을 확장하고, `CollectionScreen.tsx`에 전설 `★ 보유 ×1` 골드 배지 및 모바일(`390×844`) 우측 하단 챗봇 겹침 방지 여백(`pr-16 sm:pr-0`) 적용.
- **빌드 & 한·영 E2E 검증**: `405 / 405`장 `768×768` 해상도 및 382장 카드 동결 정량 감사 통과, `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 한국어 데스크톱(`1280×840`) 및 영어 모바일(`390×844`) 도감 5등급 비교·전설 확대 모달·프로모션 쇼케이스 검증(`FINAL_E2E_ERRORS: []`) 통과 (`/stone.html` 격리 준수).
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 12:13 KST] [구글 기색인 구 URL `404` 누수 100% 복구 및 한·영 192개 페이지 프로그래매틱 SEO(`sitemap.xml` 32배 확장) 구현]
- **요청 및 개선 내역**:
  1. **GA4 상위 유입 구 URL(`890+ 세션` 규모) `404` 누수 차단 (`scripts/generate-seo-pages.mjs`, `scripts/post-build.js`, `vite.config.ts`)**:
     - `/home`, `/main` → `/`, `/play`, `/card-play`, `/ranking`, `/setting` → `/game`, `/deck` → `/game?open=collection`, `/shop` → `/game?open=shop`, `/animation`, `/cinema`, `/movie` → `/webtoon`에 대해 정적 `HTTP 200` `canonical` 리다이렉트 페이지(UTM 쿼리 보존 · GA4 포함)와 `404.html` 서브경로 라우터 및 Vite 미들웨어를 전수 구현.
  2. **프로그래매틱 SEO 자동 생성기로 검색 노출 입구 `6개 → 192개` 한·영 정적 URL 확장 (`scripts/generate-seo-pages.mjs`, `public/sitemap.xml`, `public/robots.txt`, `public/llms.txt`)**:
     - **영문 전용 클린 경로 허브(`/en`, `/en/game`, `/en/book`, `/en/webtoon`, `/en/sns`, `/en/wiki/tip`)**: 기존 `robots.txt`의 `/*?lang=*` 차단 제약을 해결하고 영문 고유 `<title>`, `description`, `VideoGame`/`Article` JSON-LD, 양방향 `hreflang="ko|en|x-default"` 태그를 탑재 (`src/i18n/heroLang.ts`에서 `/en/*` 자동 언어 감지 연동).
     - **웹소설 40화 & 보이스 웹툰 40화 한·영 개별 회차 정적 페이지(`160개`: `/book/ep-1..40`, `/en/book/ep-1..40`, `/webtoon/ep-1..40`, `/en/webtoon/ep-1..40`)**: 실제 에피소드 원문 발췌·컷 수·대사 프리뷰·`Chapter`/`ComicIssue` JSON-LD·보스전 직행 CTA(`/game?mode=story&ep=N`)와 풀 인터랙티브 리더(`BookSection.tsx`, `WebtoonSection.tsx`, `bookMain.ts`, `webtoonMain.ts`)를 단일 URL에서 동시 렌더링.
     - **382종 카드 전체 도감 & 9대 종족 덱 공략 한·영 페이지(`20개`: `/wiki/cards`, `/wiki/faction-*`, `/en/wiki/*`)**: 382장 카드 동결 원칙을 준수하며 `classic-cards.json` 기반으로 종족별 수호자 능력·전용 25장 전수 도감·전략 가이드를 모바일 퍼스트(`46px+` 터치 타깃)로 자동 생성.
- **빌드 & 한·영 E2E 검증**: `npx tsc --noEmit && npm run build` 통과, 192개 전 URL 고유 `<title>`·`hreflang`·`G-MT60DTV1KJ` 정적 감사 통과, Playwright 한국어·영어 모바일(`390×844`) 및 데스크톱(`1280×800`) 리다이렉트·가로 스크롤 `0`·영문 한글 잔존 `0` 검증 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 12:08 KST] [황금 주화 교환소(`Gold Exchange`) 전면 개편(골드 보물상자·스튜디오 일러스트) 및 카드 뒷면 교환소 통합·유료 판매 전환]
- **요청 및 개선 내역**:
  1. **복잡했던 황금 주화 교환소 UI 단순화 및 고매력 골드 보물상자 4종 도입 (`src/hearthstone/components/Modals.tsx`, `src/hearthstone/storage.ts`, `src/hearthstone/types.ts`)**:
     - 중첩 헤더·4단 추상 서브탭·갈색 표 크롭 스크린샷 배너를 전면 제거하고, 한눈에 들어오는 3탭(`🎁 보물 상자` · `🎴 카드 뒷면` · `👑 24K 세트`) 구조로 직관화.
     - 플레이어가 골드를 모아 반복 구매할 수 있는 실질 성장형 **`🎁 보물 상자` 4종** 신규 구성:
       - `300G` **신비한 마력 가루 보석함** (`영웅 가루 +250` 즉시 획득)
       - `450G` **3배 각성 5팩 특급 보급함** (`카드팩 5개 + 가루 100`, 10% 할인)
       - `1,000G` **24K 전설 영웅 확정 보물상자** (`미보유 전설 영웅 1장 100% 확정 소환 + 가루 100`, 구매 즉시 황금 전설 소환 축하 배너 연출)
       - `2,200G` **엘윈 왕실 황금 대금고** (`미보유 전설 영웅 2장 + 카드팩 10개 + 가루 400`)
  2. **스튜디오 판타지 쇼케이스 일러스트 8종 및 전용 신규 카드 뒷면 아트 2종 제작 (`public/hs-assets/prestige/shop_*.webp`, `public/hs-assets/cardbacks/snshero-*.webp`, `src/hearthstone/components/SnsHeroArtKit.tsx`)**:
     - 기존 텍스트/이모지(`🎲👑`) 오버레이 및 깨진 크롭 이미지를 제거하고, 눈히어로 고유 성물·영웅 일러스트 기반 고해상도 쇼케이스 배너 8종(`shop_chest_*`, `shop_set_*`)과 신규 카드 뒷면 전용 아트워크 2종(`snshero-sanctuary.webp` 엘윈 눈꽃 성소, `snshero-vip-dragon.webp` 황금 용옥새 VIP)을 제작·적용.
  3. **카드 뒷면 변경 기능을 교환소(`🎴 카드 뒷면`)로 완전 이동 및 유료 판매 전환 (`src/hearthstone/paymentGateway.ts`, `src/hearthstone/storage.ts`, `src/hearthstone/components/Modals.tsx`)**:
     - 기존 `[카드팩 · 보급 패키지]` 탭 하단의 무료 카드 뒷면 변경 위젯을 제거(교환소 바로가기 버튼으로 대체)하고 `[황금 주화 교환소 → 🎴 카드 뒷면]` 탭으로 일원화.
     - 기본 지급 스킨(`클래식 브론즈`, `0G`) 외 프리미엄 카드 뒷면 4종(`프로스트 실버`, `24K 로얄 골드`, `엘윈 눈꽃 성소`, `황금 용옥새 VIP`)을 유료 상품으로 전환하여 **유료 즉시 결제(`CARDBACK_PAID_PACKAGES`: 단품 `1,400~3,900원` / `$0.99~$2.99`, 4종 올패스+보너스 2팩 `6,500원` / `$4.99`)** 및 **골드 교환(`500G~2,400G`)** 을 모두 지원(`?payapp_success=hs_cb_*` 자동 해금 연동 포함).
  4. **16종 파편화 치장품을 『👑 24K 세트』 3-in-1 왕실 세트로 정예화 및 프로모션/가이드 스크린샷 동기화 (`src/promo/PromoApp.tsx`, `src/hearthstone/screens/BattleScreen.tsx`, `public/hs-assets/screenshots/ingame_prestige_shop_{ko,en}.webp`)**:
     - 테두리 프레임 + 영웅 초상화 뱃지 + 전용 칭호가 한 번에 해금·장착되는 4단계 왕실 세트(`참나무 기본 0G` / `성소 황동 기사단 600G` / `사파이어 현자 1,200G` / `24K 순금 황제 2,000G`)로 정리하고, 한·영 인게임 교환소 스크린샷 및 프로모션 `#gold-prestige` 섹션을 최신화.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 모바일(`360×844` / `390×844` `ko`) · 데스크톱(`1280×800` `en`) 양방향 보물상자 골드 구매·전설 확정 소환·카드 뒷면 유료 결제창 연동·24K 세트 장착 실측 검증 통과 (382장 카드 동결 및 `/stone.html` 격리 준수).
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 11:43 KST] [Google Analytics MCP(`analytics-mcp`) 설치·연동 및 전 페이지 GA4(`G-MT60DTV1KJ`) 방문자 집계 복구]
- **요청 및 개선 내역**:
  1. **공식 Google Analytics MCP(`analytics-mcp` v1.1.0) 설치 및 전용 서비스 계정 연동 (`~/.gemini/config/mcp_config.json`, `ga4-mcp-reader@gen-lang-client-0764739742.iam.gserviceaccount.com`)**:
     - Python 3.11 가상환경(`~/.gemini/config/tools/analytics-mcp`)에 `analytics-mcp`를 설치하고 Google Analytics Admin/Data API 활성화 및 전용 서비스 계정 인증으로 `snshero.com` 속성(`properties/223457203`) 방문자 데이터를 조회·분석.
     - 누적 실서비스(`snshero.com`) 활성 사용자 665명(1,816 세션, 18,223 PV) 및 11월 16일 이후 `gtag.js` 누락에 따른 집계 중단 원인을 규명.
  2. **전체 진입 HTML 엔트리 GA4(`G-MT60DTV1KJ`) 측정 스크립트 복원 (`index.html`, `game.html`, `book.html`, `novel.html`, `webtoon.html`, `sns.html`, `public/wiki/tip/index.html`, `scripts/post-build.js`)**:
     - 루트 소개(`/`), 인게임(`/game`), 웹소설(`/book`, `/novel`), 웹툰(`/webtoon`), 벤치마크(`/sns`), 공략집(`/wiki/tip`), `/mcp` 정적 페이지 `<head>`에 `G-MT60DTV1KJ` `gtag.js` 스니펫을 복원.
     - 로컬 개발/테스트 환경(`localhost`, `127.0.0.1`, `*.ts.net`)에서 발생하는 자동화 테스트 트래픽이 실서비스 지표를 오염시키지 않도록 호스트 가드를 적용하되 `?ga_debug=1` 쿼리로 로컬 디버깅이 가능하도록 지원.
  3. **인게임 화면 전환 이벤트(`screen_view`) 및 서비스 워커 외부 도메인 패스스루 보강 (`src/hearthstone/HearthstoneApp.tsx`, `public/sw.js`)**:
     - `/game` 내부 화면(`BOX_HUB`, `DECK_SELECT`, `BATTLE`, `COLLECTION`, `PACK_OPENING`) 전환 시 `gtag('event', 'screen_view')`를 전송해 인게임 퍼널 집계를 복원.
     - `public/sw.js`(`snshero-media-v22-20261118`)에서 외부 오리진(`url.origin !== self.location.origin`) 요청을 즉시 통과시켜 Google Analytics/GTM/AdSense 수집 픽셀이 캐시 정규식에 가로채이지 않도록 원천 보호.
- **빌드 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, `dist/` 내 13개 생성 HTML 엔트리 전수 `G-MT60DTV1KJ` 포함 확인 (`/stone.html` 격리 원칙 준수).
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 11:22 KST] [게임 방법(`How to Play`) · 전투 규칙 · 카단 도우미 내 자동플레이 『카단의 기세』 활용법 및 한·영 최신 스크린샷 반영]
- **요청 및 개선 내역**:
  1. **게임 방법 6단계 가이드 STEP 4 『카단의 기세』 전용 가이드 및 3단계 시각 카드 추가 (`src/hearthstone/components/OnboardingGuideModal.tsx`, `src/promo/PromoApp.tsx`)**:
     - 상단 4번 탭 명칭을 **`4. 카단의 기세` (`4. Kadan Spirit`)** 으로 명확히 표시하고, 자동플레이 시 하단 중앙 수축 링 활용법(**① 🔴 빨강(대기) · 🟢 초록(TAP!) 탭 타이밍** → **② `X1` → `X10` → `X20` 누적 스택** → **③ 10배수 달성 즉시 카단 눈보라 + 실리아 무작위 바람풍 연속 합동 필살기**)을 3단계 요약 카드(`howto-kadan-spirit-breakdown`)와 본문·팁에 한·영 모두 상세히 수록.
     - 하단 핵심 키워드 아코디언(`QuickRulesModal`)에도 **`🟢 카단의 기세 (X10 합동 필살기)`** 항목을 추가해 로비 `[게임 방법]`, 전장 `[? 규칙]`, 프로모션 `#how-to-play` 전 화면에서 즉시 확인 가능하도록 구성.
  2. **한국어·영문 전용 최신 인게임 가이드 스크린샷 재캡처 반영 (`public/hs-assets/guide/guide_04_combat_ult.webp`, `public/hs-assets/guide/guide_en_04_combat_ult.webp`)**:
     - 기존 구버전 스크린샷을 대체하여 하단 중앙 `카단의 기세` 링·`X10` 스택 배지·눈보라 및 바람풍 연속 필살기가 실제 작동 중인 한국어/영문 화면(`960×570` WebP)으로 각각 최신화.
  3. **카단 전장/로비 챗봇 및 온디바이스 AI 문답 지식 추가 (`src/hearthstone/components/KadanChatbotWidget.tsx`, `src/hearthstone/services/localLlmAssistant.ts`)**:
     - 전장 카단 메뉴에 **`🟢 자동플레이 [카단의 기세] 활용법 알려줘`** 원탭 도움말 버튼을 추가하고, 로컬 AI 질의응답에 `카단의 기세`·`초록 링`·`X10 스택` 규칙을 등록.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 한·영(`ko` `360×844`, `en` `390×844` / `1280×800`) `[게임 방법]` 모달·프로모션 `#how-to-play`·언어별 스크린샷 분기 검증 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 11:14 KST] [필살기 내 축포형 리본·폭죽 별 파티클 전량 제거 및 카단 『눈보라』·실리아 『바람풍』 본격 원소 폭풍 VFX 전면 재구현]
- **요청 및 개선 내역**:
  1. **축포처럼 보이던 구석 발사 리본(`SWEEP`/`STREAM`) 및 별·파편 폭죽(`STAR` 폭발) 100% 제거 (`src/hearthstone/vfx/BoardVfxCanvas.tsx`)**:
     - 기존 카단·실리아 필살기 발동 시 좌하단·우하단 모서리에서 부채꼴로 솟구치던 노랑·초록·파랑 리본(`windGustsRef`)과 원형 폭죽 별 파티클(`spawnBurst(..., 'STAR')`) 및 피격 시 붉은/노란 폭죽 파편을 전량 삭제.
  2. **카단 『눈보라 필살기(`KADAN_BLIZZARD`)』 고품격 설원 폭풍 연출 구현 (`src/hearthstone/vfx/BoardVfxCanvas.tsx`)**:
     - **사방 성에 결빙 & 한파 암전**: 화면 상하 성에 그라데이션·네 모서리 얼음 결정 가시와 심연 한파 스카이 대비 레이어로 눈과 얼음의 발광 대비 극대화.
     - **대설원 눈보라 구름 파동 & 칼바람 진눈깨비**: `-25°` 대각선으로 몰아치는 6겹 볼류메트릭 눈안개 스퀄과 초고속 진눈깨비 궤적(`78개`), 6갈래 겨울 양치형 눈꽃 결정·방사형 폭설 눈송이 보케(`135개`) 구현.
     - **입체 빙하 운석 낙하 & 반투명 빙산 결정 융기(`FROST_PRISON`)**: 3면 음영 입체 빙하 혜성이 대각선으로 낙하해 영롱한 반투명 3중 빙산 결정과 냉기 안개·빙결 충격파를 피워 올리며 적을 얼음 감옥에 가두도록 구현.
  3. **실리아 『바람풍 필살기(`SILIA_WINDSTORM`)』 초음속 회오리·진공 초승달 풍아 참격 구현 (`src/hearthstone/vfx/BoardVfxCanvas.tsx`)**:
     - **3대 입체 소용돌이 회오리 토네이도**: 직선 원뿔 없이 26단 고속 회전 곡선 기류 링과 에메랄드 안개 코어가 전장을 가로지르는 거대 회오리 폭풍 기둥 구현.
     - **두 원 교차 기반 예리한 중공(Hollow) 초승달 진공 칼날(`풍아 참격`) & 3중 진공 풍참(`AERO_SLASH`)**: 백색 진공 날과 에메랄드 후류·날개끝 슬립스트림을 가진 예리한 초승달 바람칼날 24개, 전장 관통 S자 제트기류 8줄기, 3D 회전 신록 나뭇잎 72개가 휘몰아치도록 구현.
  4. **전장 캔버스 레이어(`z-[83]`) 격상 & 컷인 배너 상단 컴팩트 배치 (`src/hearthstone/screens/BattleScreen.tsx`, `src/hearthstone/components/SiliaUltimateWidget.tsx`)**:
     - 폭풍 VFX가 카드·하수인 위를 생생하게 덮도록 `BoardVfxCanvas`를 `z-[83]`으로 올리고, 필살기 대사 컷인을 상단(`top-[48px]`) 컴팩트 배너로 배치해 전장 중앙과 우하단 전술 버튼을 전혀 가리지 않도록 개선.
- **빌드 & 실화면 캡처 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 모바일(`390×844` 한국어) 및 데스크톱(`1280×800` 영어) `X10` 실시간 폭풍 렌더링 스크린샷 육안 검증 완료.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 10:52 KST] [`승부처 카단 지휘` (`Clutch Choice` / `Clutch Break`) 기능·모달·설정·가이드 완전 제거]
- **요청 및 개선 내역**:
  1. **전장 자동플레이 `승부처 카단 지휘` 중단 로직 및 팝업 완전 제거 (`src/hearthstone/screens/BattleScreen.tsx`)**:
     - 자동플레이 진행 중 체력 10 이하 위기·킬각·7코스트+ 에이스 카드 보유 시 흐름을 멈추고 띄우던 `승부처 카단 지휘` (`kadan-clutch-choice-modal`) 팝업 UI, 감지 로직, 5초 자동 해제 타이머, 하단 중앙 `카단의 기세` 링 필의 `⚡` (`clutch-break-toggle`) 토글 버튼을 모두 제거해 전투 흐름이 끊기지 않도록 개선.
  2. **게임 옵션 설정 및 오디오 설정 정리 (`src/hearthstone/components/Modals.tsx`, `src/hearthstone/audio.ts`)**:
     - 설정 모달의 `카단 승부처 ON/OFF` (`toggle-clutch-break`) 토글을 제거하고 `도발 말풍선 켜짐/꺼짐` (`toggle-emote-bubbles`) 버튼을 2열 전체 폭(`col-span-2`)으로 정렬해 빈 칸 없이 정돈.
     - `AudioSettings` 인터페이스 및 `DEFAULT_AUDIO`에서 미사용 `kadanClutchBreakEnabled` 필드를 정리.
  3. **게임 가이드 STEP 4 안내 문구 최신화 (`src/hearthstone/components/OnboardingGuideModal.tsx`)**:
     - STEP 4 한·영 팁 문구에서 `[승부처 브레이크]` / `Clutch Break` 언급을 제거하고, `10배수(X10·X20…)마다 카단 눈보라 & 실리아 바람풍 연속 필살기가 발동` 안내로 최신화.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 한·영(`ko` 360×844 / `en` 390×844 / 데스크톱 1280×800) 설정·가이드·전장(`story_battle`) 검증 통과(`center_diff=0.0px`, `0 clutch elements`, `0 errors`).
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 10:35 KST] [전투 BGM 원속 긴박감 복원 + 2박 1스택 · `X10`/`X22` 누적 스택 표기 · 카단 공격 시 실리아 연속 무작위 필살기 연계 · 눈보라/바람풍 대형 폭풍 VFX 고도화]
- **요청 및 개선 내역**:
  1. **전투 배경음악 원속 긴박감 복원 & 2박 1회 스택 유지 (`src/hearthstone/audio.ts`)**:
     - `duel_1`(128 BPM) · `duel_2`(132 BPM) · `mulligan`(122 BPM)의 재생 속도를 원속(`playbackRate: 1.0`)으로 복원해 긴박하고 박진감 넘치는 사운드를 유지하면서, 수축 링은 **2박에 1번(`~0.92초` 주기, 초록 구간 `420ms`)** 탭하여 편안하게 스택을 쌓도록 구성.
  2. **`카단의 기세` 누적 스택 직관적 표기 (`X1` → `X10` → `X22`, `src/hearthstone/screens/BattleScreen.tsx`)**:
     - 기존 몫(`X1`, `X2`) + `0/10` 분리 표기를 단일 누적 카운터 **`X{누적횟수}`(`X0`, `X1`, ..., `X10`, ..., `X22`...) 배지**로 변경해 쌓이는 기세 수치가 직관적으로 보이도록 개선.
  3. **카단 공격 시 실리아 연속 무작위 필살기 자동 연계 (`src/hearthstone/engine/GameEngine.ts`, `src/hearthstone/screens/BattleScreen.tsx`)**:
     - `X10`, `X20`, `X30`... 카단 눈보라 필살기 작렬 직후(`0.95초` 연속 콤보) 및 카단 영웅 직접 타격 직후, **실리아가 무작위 바람풍 필살기(`녹풍 대참격` / `폭풍 결계진` / `회오리 생명풍`)를 연속 발동**(`useSiliaChainUltimate`, 수동 턴 횟수 미차감)하며 즉발 대사 컷인과 2차 화면 강진을 일으키도록 구현.
  4. **필살기 전용 전 화면 폭풍 VFX 대폭 강화 (`src/hearthstone/vfx/BoardVfxCanvas.tsx`)**:
     - **카단 『눈보라 공격(`KADAN_BLIZZARD`)』**: 전 화면 빙결 화이트아웃·사선 폭풍선 + 하늘에서 쏟아져 내려와 파열하는 거대 **빙하 얼음창(`IceSpear`) & 지면 얼음 가시** + **6각 눈꽃 결정(`Snowflake`) 50~70개**가 휘몰아치는 대눈보라 연출 구현.
     - **실리아 『바람풍 공격(`SILIA_WINDSTORM`)』**: 전 화면 에메랄드 질풍 스트림 + 전장을 가로지르는 **3개의 거대 14단 회오리 토네이도(`WindTornado`)** + 초고속 **초승달 바람칼날(`WindBlade`) 30~44개**가 적진을 베어 넘기는 바람폭풍 연출 구현.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 한·영(`ko`/`en`) 모바일(`360×844`, `390×844`) `X10`/`X22` 누적 표시 및 카단 눈보라 → 실리아 바람풍 연속 콤보·캔버스 폭풍 렌더링 검증 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 10:17 KST] [프로모션 치장품 깨진 이미지 복구 · 전투 BGM/정박 주기 완화 · `카단의 기세` X스택 & 카단·실리아 즉발 대사·화면진동 필살기 구현]
- **요청 및 개선 내역**:
  1. **프로모션 치장품 스크린샷 깨짐 복구 (`public/hs-assets/screenshots/ingame_prestige_shop_{ko,en}.webp`, `src/promo/PromoApp.tsx`)**:
     - 누락되어 404가 발생하던 `/hs-assets/screenshots/ingame_prestige_shop_ko.webp` 및 `en.webp` 정적 파일을 생성·배치하고, 프로모션 황금 명예 컬렉션 4종 카드 모두 전용 인게임 적용 프리뷰(`/hs-assets/prestige/preview_{badge,frame,cardback,title}_{ko,en}.webp`)로 연결해 한·영 전 페이지 깨진 이미지 `0건` 검증 완료.
  2. **카드 전투 배경음악 템포 완화 & 여유로운 2박 강박 링 주기 (`src/hearthstone/audio.ts`)**:
     - 전투 BGM(`duel_1` 128 BPM · `duel_2` 132 BPM)에 피치 보존(`preservesPitch = true`) 기반 템포 완화(`playbackRate = 0.78 / 0.75`, 약 `99 BPM`)를 적용해 여유롭고 웅장한 템포로 조정.
     - 수축 링 주기를 빠른 1박(`0.46초`)에서 **2박 강박(`약 1.20초`)** 으로 넓히고 초록색 탭 가능 구간을 **`520ms`** 로 대폭 확장해 누구나 사운드에 맞춰 편안하게 탭할 수 있도록 개선.
  3. **`정박 탭` → `카단의 기세` 명칭 변경 & 10배수 `X스택` 옆면 표시 + 배수 비례 카단 눈히어로 필살기 (`src/hearthstone/screens/BattleScreen.tsx`, `src/hearthstone/engine/GameEngine.ts`, `src/hearthstone/vfx/BoardVfxCanvas.tsx`, `src/hearthstone/types.ts`)**:
     - 하단 중앙 링 라벨을 **`카단의 기세`**(`Kadan Spirit`)로 변경하고, 링 바로 옆에 충전도(`0/10`~`9/10`)와 10배수 돌파 시마다 누적되는 **`X1`, `X2`, `X3`... 스택 배지**(`kadan-x-stack-badge`)를 표시.
     - 10배수(10·20·30회...) 달성 즉시 카단 상반신 컷인과 전체 대사를 **음성/타이핑 없이 즉시 표시**하고, 강력한 **화면 흔들림(`520ms`)** 과 함께 배수(`X1`: 적 전체·영웅 `-2` & 방어 `+3` & 아군 `+1/+1`, `X2`: `-4` & 방어 `+6` & 아군 `+2/+2·보호막`, `X3+`: `-2×N` 창성 눈보라 심판)에 비례하는 **카단 눈히어로 필살기**(`useKadanMomentumUltimate`)가 전장에 즉시 작렬하도록 구현.
  4. **실리아 필살기 대사 즉발 표시 & 화면 진동 동시 작렬 (`src/hearthstone/components/SiliaUltimateWidget.tsx`, `src/hearthstone/vfx/BoardVfxCanvas.tsx`, `src/hearthstone/screens/BattleScreen.tsx`)**:
     - 기존 글자 단위 타이핑/보이스 읽기(`useAnimaleseTypewriter`) 대기를 제거하고, 스킬 선택 즉시 전체 대사를 화면에 바로 띄우면서 전장 화면이 강하게 떨리고 바람 필살기가 즉시 폭발하도록 개선.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright 한·영(`ko`/`en`) 모바일(`360×844`, `390×844`) 및 이미지 무결성 검증 전원 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 09:18 KST] [전장 하단 중앙 BGM 맥박 동기화 초록/빨강 정박 링탭 · 로비 의뢰/보급소 뱃지 정리 · 프로모션 전 섹션 상시 노출 간결화]
- **요청 및 개선 내역**:
  1. **전장 수축 정박 링탭 하단 중앙 배치 & BGM 실시간 맥박·초록/빨강 타이밍 표시 (`src/hearthstone/audio.ts`, `src/hearthstone/screens/BattleScreen.tsx`, `src/hearthstone/components/SiliaUltimateWidget.tsx`)**:
     - 기존 우상단에 있던 정박 링탭(`CenterRhythmRingHud`)을 좌하단 실리아와 우하단 카단 사이 정중앙(`fixed bottom-2.5 left-1/2 -translate-x-1/2`, `56×56px` 모바일 원핸드 터치 타깃)으로 이동 배치하고 60fps ref 렌더링으로 분리.
     - 실제 전투 BGM(`duel_1.mp3` 128 BPM / `duel_2.mp3` 132 BPM)의 실시간 재생 시각(`HTMLAudioElement.currentTime` 서브프레임 보간 + 실측 드럼 어택 오프셋 `290ms`/`150ms`)에 1:1 동기화하여 매 정박마다 중앙 코어와 파동 링이 심장 맥박(`pulse01`)처럼 박동하도록 구현.
     - 눌러야 하는 정박 타이밍(`isTapWindow === true`)에는 **초록색(`#22c55e`, `TAP!`)**, 누르면 안 되는 엇박 구간(`isTapWindow === false`)에는 **빨간색(`#ef4444`, `대기/WAIT`)** 으로 수축 링을 직관적으로 표시하고 판정 윈도우와 100% 일치시킴.
  2. **의뢰 일지 숫자 뱃지 수령 가능 시에만 표시 (`src/hearthstone/screens/BoxHubScreen.tsx`, `src/hearthstone/components/Modals.tsx`)**:
     - 미완료 의뢰 개수를 상시 표시하던 동작을 제거하고, 완료 후 보상을 수령해야 하는 항목(`claimableQ > 0`)이 있을 때만 숫자 뱃지가 표시되도록 수정.
  3. **골드·현금 팩 구매(`눈히어로 보급소`) 무의미한 `99` 숫자 뱃지 제거 (`src/hearthstone/screens/BoxHubScreen.tsx`)**:
     - 보유 골드 기반 `Math.min(99, Math.floor(profile.gold / 100))` 빨간 숫자 뱃지 완전 제거.
  4. **프로모션 페이지 전 항목 상시 노출 & 군더더기 없는 간결화 (`src/promo/PromoApp.tsx`)**:
     - 접이식 아코디언(`tier2Expanded`, `howToDrawerOpen`, `heroesDetailOpen`, `cardsSearchExpanded`, `externalChannelsOpen`)을 전면 해제하여 전체 소개 섹션(히어로 · 세계관/트레일러 · 핵심 시스템 · 게임 특징 · 6단계 게임 방법 · 9대 종족 영웅 · 382종 카드 도감 · 3대 게임 모드 · 황금 명예 컬렉션 · 무료 3팩 · 공식 웹소설/웹툰/채널)이 접힘 없이 한눈에 모두 보이도록 복원.
     - 중복 위젯·장문 설명·불필요한 태그/이탈 팝업을 덜어내고 핵심 내용만 간결하게 압축 정리(번들 크기 `90kB → 55.25kB`).
- **빌드 & E2E 검증**: `npm run build` 0 에러 통과, Playwright 한·영(`ko`/`en`) 데스크톱(`1280×800`) 및 모바일(`390×844`, `360×800`) 실측 검증 전원 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(`git push` 미실행 · 수동 푸시 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-18 08:37 KST] [`/checkAll` 3대 관리 문서 야간·오전 신규 항목(`DEV-042`~`055` · `MKT-062`~`073`) 전수 통합 구현 · E2E 통과 · 로컬 커밋 완료 (푸시 대기)]
- **대상 문서**:
  1. **이슈문서 (`1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4`)**: 미해결 이슈 `0`건 (`12/12건` 전원 완료 유지 확인)
  2. **개발문서 (`1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU`)**: 기완료 `DEV-013`~`DEV-041` 상태 `"완료"` 복원 + 신규 **`DEV-042`~`DEV-055`(14건, P0 3건 · P1 11건)** 전수 구현 완료 (`55/55건 100.0% 완료`)
  3. **마케팅문서 (`1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU`)**: 웹 코드 단독 해결 항목(`MKT-062`, `MKT-063`, `MKT-066`, `MKT-068`, `MKT-069`, `MKT-072`) `"완료"` 및 하이브리드 코드 반영·외부 채널 수동 발행 대기 항목(`MKT-064`, `MKT-065`, `MKT-067`, `MKT-070`, `MKT-071`, `MKT-073`) `"진행중"` 최신화
- **핵심 코드 구현 내역 (`382장 카드 동결` & `/stone.html` 격리 보존)**:
  - **P0 (`DEV-043`, `DEV-044`, `DEV-045`, `MKT-062`, `MKT-068`, `MKT-069`, `MKT-071`)**:
    - `audio.ts` & `BattleScreen.tsx` & `design.md` (v3.2): `AudioContext.currentTime` 하드웨어 클럭 `BeatSyncScheduler(120/128/140 BPM)` 양자화, `C–G–Am–F` 실시간 오카리나 화음 합성(`Harmonic Chord-Locked SFX`), 모드별 2트랙 밸런스 보호(`PvE 스토리` 턴당 최대 1회 성소 공명·보스 리듬 패링 vs `공식 랭킹·보가트 도박장` 스탯 변화 `0%` + 오카리나 골드 피버), 일체형 `카단 리듬 지휘 오브(Kadan Command Orb)` 및 환경 설정 싱크 보정(`±100ms`) 구현.
    - `public/wiki/tip/index.html`, `vite.config.ts`, `scripts/post-build.js`, `public/robots.txt`, `public/sitemap.xml`: 구버전 스펙(`코너 뒤집기·110종·1,000 SNS·SHBP·BTC`) 100% 소거 후 `canonical` 단일 URL(`https://snshero.com/wiki/tip`) 기반 현행 **382종 정통 웹 TCG 공식 공략집(Ch.1~6 + 국문 AEO 블록)** 인플레이스 교체.
    - `PromoApp.tsx`, `index.html`, `classic-cards.json`: 유튜브 즉시 마운트 iframe을 `data-nosnippet` Click-to-Play 썸네일 파사드로 교체(`"An error occurred"` 스니펫 오염 차단), 한·영 병기 H1/메타 적용, 382종 카드 영문명·종족어(`Murloc` → `Deep Sea` 등) 100% 엘윈 오리지널 IP 치환, 푸터 구 `AI Battle·Classic Stone` 제거, `webtoon.html` 38화 정상 재생 클린 폴백(`Lf2ZI9KrhHY` / `qH-essuMM1w`) 및 KO/EN 재생목록 동적 분기.
  - **P1 (`DEV-042`, `DEV-046`~`054`, `MKT-063`~`067`, `MKT-070`, `MKT-072`)**:
    - `PromoApp.tsx`, `PromoCard.tsx`, `CardVisual.tsx`, `OnboardingGuideModal.tsx`, `KadanChatbotWidget.tsx`: 상단 미니멀 GNB(`[로고 + KO/EN + 바로 플레이]`), 재방문 유저 `이어서 플레이(/game 직행)` 상단 바, 히어로 2버튼 압축 + 무스크롤 3탭 아코디언, 무료 선개봉 카드 `snshero_showcase_drawn_cards` 인게임 자동 영구 귀속, 보가트 기본 판돈 `250G` 및 `?mode=bogart&stake=` 딥링크 연동, 도감 `All(382)` `12/382` 정상 매칭·클린 아트 그리드·`3x/1x` 공정 범위 배지, `Idle Chibi Kadan` 및 `'Water Water'` 중복 `alt` 완전 제거, 6단계 가이드·9영웅·외부 채널 접이식 수납.
    - `Modals.tsx`, `BoxHubScreen.tsx`, `HeroDeckSelectScreen.tsx`, `PackOpeningScreen.tsx`, `BookSection.tsx`: 의뢰 일지 우선순위 1건 `Single-Focus` 뷰, 로비 첫 명예 배지(`250G/300G` 83%) 코칭 바, 요정 샘 `+150G` 구제 내 보급소(`$4/$2.99`) 브릿지, 팩 개봉 `3/10팩` 전설 확정 게이지 & 가루 제작 브릿지, 공식 랭킹 종료 화면 상대 MVP 카드·스킨 입수 및 첫 1승 백업(`+100G`), 보가트 결과 영수증 1클릭 복사, 웹소설 클라이맥스 점프 바(`10·18·31·40화`) 및 2지선다 `CYOA 전술 선택(Option A/B)` + `&rhythm=on` 직행 연동.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright E2E(`ko`·`en`, 데스크톱 `1280×800` & 모바일 `390×844` 가로 밀림 `0px`, 페이지 에러 `0`건, `/wiki/tip` canonical·`12/382` 도감·카단 리듬 지휘 오브 탭·`?stake=250` 검증) 전원 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(**`git push` 미실행 · 수동 푸시 대기**), 3대 시트 반영 및 `submit_report.py` 제출 완료.

## [2026-11-17 20:12 KST] [`/checkAll` 3대 관리 문서(이슈 · 개발 · 마케팅) 전수 통합 점검·구현 · E2E 통과 · 로컬 커밋 완료 (푸시 대기)]
- **대상 문서**:
  1. **이슈문서 (`1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4`)**: 미해결 이슈 `0`건 (`ISS-001`~`ISS-004` 총 12건 전원 완료 확인)
  2. **개발문서 (`1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU`)**: 기조치된 `DEV-013`~`DEV-031`(19건) 상태 `"완료"` 동기화 + 신규 **`DEV-032`~`DEV-041`(10건, P0 2건 · P1 8건)** 전수 구현 완료 (`41/41건 100% 완료`)
  3. **마케팅문서 (`1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU`)**: 웹 코드 단독 해결 항목(`MKT-036`, `MKT-039`, `MKT-042`, `MKT-054`, `MKT-057`, `MKT-060`) `"완료"` 및 하이브리드 코드 구현 완료 항목(`MKT-003`, `MKT-040`, `MKT-046`, `MKT-053`, `MKT-055`, `MKT-056`, `MKT-058`, `MKT-059`, `MKT-061`) `"진행중"` 최신화
- **핵심 코드 구현 내역 (`382장 카드 동결` & `/stone.html` 격리 보존)**:
  - **P0 (`DEV-036`, `DEV-037`, `MKT-056`, `MKT-057`, `MKT-058`, `MKT-059`, `MKT-061`)**:
    - `PromoApp.tsx` & `design.md` (v3.1): 상단 Tier 1을 `[1줄 타이틀 + 인터랙티브 핵심 재미 3카드(①카단 전술·3배각성 / ②온라인 도전자 랭킹전 / ③보가트의 도박장) + 숙련자/입문자 Two-Track 출정 CTA]`로 압축하고 상세 섹션을 `[+ 상세 세계관·382장 도감 천천히 둘러보기]` 접이식 드로어(Tier 2)로 수납.
    - `BoxHubScreen.tsx` & `storage.ts`: 진척도 기반 `Stage 1~4` 순차 해금 및 우상단 숙련자용 `[🔓 전체 메뉴 열기]` 1탭 토글 적용.
    - `index.html`, `webtoon.html`, `public/llms.txt`, `README.md`: `VideoGame` `featureList`, `VideoObject`·`ItemList` JSON-LD(40화 웹툰 색인), 1,105+ 커밋 공식 쇼케이스 최신화.
  - **P1 (`DEV-032`~`035`, `DEV-038`~`040`, `MKT-036`, `MKT-039`, `MKT-042`, `MKT-053`~`055`, `MKT-060`)**:
    - `audio.ts`, `SnsHeroArtKit.tsx`, `Modals.tsx`: 성소 하늘 시간대 고정(`실시간/아침/한낮/황혼/밤`), 도발 말풍선·카단 승부처·클린 아트 뷰 토글, 의뢰 일지(`보가트 +300G / 랭킹 카단 +250G / 3배 각성 +200G`) 및 잔여 골드 450G/850G 프로그레스 브릿지, 보급소 골드/현금 통화 가치 분리 배너 및 명예 치장품 백업 락인(`+100G`).
    - `BookSection.tsx` & `WebtoonSection.tsx`: `snshero_media_read_eps` 회차 열람 초회 `+100G` 시드머니·10/40화 호칭(`〈성소의 연대기 학자〉`, `〈운명의 오카리나 계승자〉`) 자동 해금, 웹툰 성우 200트랙 보이스 오디오 싱크 바, 하단 1메인(`다음 화 읽기`) + 1서브(`보스전 체험`) 브릿지 단순화.
    - `HeroDeckSelectScreen.tsx`, `BattleScreen.tsx`, `StoryEncounterOverlays.tsx`, `CardVisual.tsx`, `PreBattleDeckModal.tsx`, `CollectionScreen.tsx`: 30종 도전자 페르소나 4대 골드 치장품 프리셋 & `치장품 보기(상점 바로가기)` 팝오버, 보가트 일일 구제(`+100G`), 스토리 `5화 단위 8챕터 거점 맵`·`⚡ 즉시 결투 진입` & 프로모션 단일 대표 보스 스포트라이트(`DEV-041`), 전장 `클린 아트 뷰` & 상단 유틸바 정리, 출격 프리셋 마나커브 접기 토글, 카드첩 상단 `3배 각성 임박(x2)` 추천 & `카단 1탭 자동 보강` 및 가루 비용 포함 덱 챌린지 공유 URL 적용.
- **빌드 & E2E 검증**: `npx tsc --noEmit && npm run build` 0 에러 통과, Playwright E2E(`ko`·`en`, 데스크톱 `1280×800` & 모바일 `390×844` 가로 밀림 `0px`, 페이지 에러 `0`건, 수집 카드 `382장` 동결 확인) 전원 통과.
- **버전 관리 & 보고**: 로컬 `git commit` 완료(**`git push` 미실행 · 수동 푸시 대기**), 3대 시트 반영 및 `submit_report.py` 제출 완료.

## [2026-11-17 17:39 KST] [`/upload-youtube` SNSHero 영문 프로모션 본편(16:9) · 쇼츠(9:16) · 커스텀 썸네일 유튜브 자동 업로드 및 API 검증 완료]
- **요청**: 영문 제목·내용 구성 및 `/upload-youtube` 스킬로 '모두의 기술'(`@modooskill`, `UC_xayYwKaB5TbH3eZXeREpA`) 채널에 본편·쇼츠 자동 업로드
- **업로드 및 YouTube Data API v3 검증 결과**:
  1. **16:9 유튜브 본편 + 로고 강조 커스텀 썸네일 (`snshero_promo_thumbnail.jpg`)**:
     - URL: `https://www.youtube.com/watch?v=av-d3J5vuvM` (`https://youtu.be/av-d3J5vuvM`)
     - Title: `Deceptively Simple, Insanely Fun! Play SNSHero FREE in Your Browser (382 Cards & 3x Power!)`
     - 상태: `uploadStatus: "uploaded"`, `privacyStatus: "public"`, `madeForKids: false`
  2. **9:16 유튜브 쇼츠 (`--shorts`)**:
     - URL: `https://www.youtube.com/shorts/mVM29ugxIUA` (`https://youtu.be/mVM29ugxIUA`)
     - Title: `STOP SCROLLING! Full 382-Card Fantasy RPG in Your Browser?! 🤯🔥 #Shorts #SNSHero`
     - 상태: `uploadStatus: "uploaded"`, `privacyStatus: "public"`, `madeForKids: false`
- **구글 폼 보고**: `submit_report.py` 제출 완료.


## [2026-11-17 17:11 KST] [SNSHero (`https://snshero.com`) 공식 영문 소개 동영상(16:9) · 쇼츠(9:16) · 로고 강조 썸네일 제작 완료]
- **요청**: `https://snshero.com` 실제 플레이 화면을 웹브라우저로 녹화해 SNSHero 프로모션 소개 내용을 기준으로 시작·종료 화면 로고가 강조된 영문 소개 동영상(`16:9`), 쇼츠(`9:16`), 로고 강조 썸네일(`1920×1080`) 제작 (쾌활하고 흥분된 영문 남성 보이스오버 및 `https://snshero.com` 참여 유도 엔딩 포함)
- **제작 내역**:
  - **실브라우저 녹화 (`https://snshero.com/?lang=en` & `/game.html?lang=en`)**: 프로모션 쇼케이스·엘윈 성소 허브, 무료 3팩/24K 골든 포일 팩 제단, 382종 스타라이트 기록실(`3장=3배` 각성), 40화 풀보이스 스토리모드(실리아 필살기·자동플레이), 랭킹대전 & 보가트 `1~1,000G` 랜덤덱 도박장 데스크톱/모바일 녹화 및 광고 배너 여백 클린 크롭 처리.
  - **보이스오버 & 오디오**: 쾌활한 영문 남성 성우(`en-US-RogerNeural`, `rate=+16%`, `pitch=+4Hz`, `-15 LUFS`) + SNSHero 고유 BGM(`tavern_hub`, `duel_1`) 및 효과음 믹싱.
  - **산출물 (`brain/508197bb-ca29-4055-b945-84716b4197a6/`)**:
    - 16:9 본편: `snshero_promo_youtube_16x9.mp4` (`1920×1080`, `30fps`, `103.2s`, `36.8 MB`)
    - 9:16 쇼츠: `snshero_promo_shorts_9x16.mp4` (`1080×1920`, `30fps`, `43.4s`, `24.3 MB`)
    - 로고 강조 썸네일: `snshero_promo_thumbnail.png` / `snshero_promo_thumbnail.jpg` (`441 KB`)
    - 프로덕션 리포트(유튜브/쇼츠 제목·설명·챕터·고정댓글 포함): `snshero_promo_video_report.md`
- **검증 결과**: `npx hyperframes check --json` (`0 errors`), `npx hyperframes audio --json` (`warnings: []`), 디코딩된 시작/중간/종료 프레임 시각 검수 통과.
- **구글 폼 보고**: `submit_report.py` 제출 완료.


## [2026-11-17 17:01 KST] [보가트 도박장 영문 허브 버튼 1줄 표시 교정 및 원격 푸시 완료]
- **요청**: 영문판에서 `🎲 Bogart's Gambling Hall`이 2줄로 줄바꿈되는 문제 해결 및 `/git-push` 반영
- **수정 파일**:
  - `src/hearthstone/screens/BoxHubScreen.tsx` (`hub-mode-gamble` 영문 라벨을 `Bogart's Hall`로 축약하고 `whitespace-nowrap text-[14.5px] sm:text-[17px] tracking-normal sm:tracking-wide`를 `hub-mode-gamble`·`hub-mode-ranked`에 적용해 1줄 유지 보장)
- **검증 결과**:
  - `npx tsc --noEmit` 및 `npm run build` 통과 (`0` 에러)
  - Playwright 영문 데스크톱(`1280×800`)·모바일(`390×844`) 검증에서 `🎲 Bogart's Hall`, `🏆 Ranked Arena`, `📖 Story Mode` 모두 `rects: 1`, `fitsWidth: true`로 단일 줄 렌더링 및 모바일 스크린샷 확인 완료
- **상태**: 로컬 커밋 · 원격 푸시(`git push origin main`) 완료 · 구글 폼 보고 완료

## [2026-11-17 16:15 KST] [로고 방패 문장 교체(한·영) 및 영문 페이지 유튜브 재생목록·영상 분기 적용 (푸시 대기)]
- **요청**:
  1. 리뉴얼된 고대비 황금·스노우 로고(`눈히어로`, `SNSHero`) 뒤 배경을 원형 메달리온에서 **방패 문장**으로 변경
  2. 프로모션 메인(`/`) 영문 버전(`?lang=en`)에서 유튜브 재생목록과 트레일러 영상 링크를 영문 더빙 유튜브 링크로 표시
- **수정 파일**:
  - `public/hs-assets/brand/logo-ko.webp` (`1154×581` RGBA 투명 배경, `100KB` — 사파이어 눈꽃이 각인된 중세 황동·참나무 방패 문장 + 고대비 황금 입체 `눈히어로` + 상단 스노우)
  - `public/hs-assets/brand/logo-en.webp` (`1194×646` RGBA 투명 배경, `125KB` — 동일 방패 문장 + 고대비 황금 입체 `SNSHero` + 상단 스노우)
  - `src/promo/PromoApp.tsx` (`YOUTUBE_PLAYLIST_URL_EN = 'https://www.youtube.com/playlist?list=PLFvV2raCoFww'`, 영문 트레일러 1/8/15화 `q6-w_dz8Hbs`·`GQ3_HDM-bW8`·`qFsQnrjnv4E` 및 채널/재생목록 링크 언어별 분기)
- **검증 결과**:
  - `npx tsc --noEmit` 및 `npm run build` 통과 (`0` 에러)
  - 다크/라이트 배경 합성 프린지 `0` 확인 및 Playwright 한/영 데스크톱·모바일 검증(`/?lang=en` 데스크톱, `/?lang=ko` 모바일, `/game.html?lang=ko` 데스크톱, `/game.html?lang=en` 모바일) 전수 통과, 스크린샷으로 방패 문장·가독성 확인 완료
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-17 16:09 KST] [대결 항복하기 최상단 배치 및 승리/패배 팝업 2단계 분기 간소화 (푸시 대기)]
- **요청**:
  1. 전투 중 열리는 게임 메뉴에서 `대결 항복하기` 버튼을 가장 상단에 배치
  2. 복잡했던 승리/패배 결과 팝업을 단순화해 1차 화면은 최소 버튼(핵심 1~2개)만 노출하고, 세부 분기 선택은 다음 팝업(`다음 행동 선택`)에서 표시
- **수정 파일**:
  - `src/hearthstone/components/Modals.tsx` (`GameOptionsModal` 내 `options-concede-btn`을 스크롤 영역 최상단, 2×2 퀵 그리드 위쪽으로 이동)
  - `src/hearthstone/screens/BattleScreen.tsx` (`postGameStep: 'SUMMARY' | 'NEXT_ACTIONS'` 2단계 상태 도입 — 1단계 핵심 결과 요약·최소 버튼 2개 / 2단계 MVP 공유·인증 카드 저장·카단 추천 역상성 재도전·보급소 상점·로비 복귀 분기 메뉴 제공)
- **검증 결과**:
  - `npx tsc --noEmit` 및 `npm run build` 통과 (`0` 에러)
  - Playwright 실측 검증 (`desktop_ko`, `mobile_ko`, `desktop_en`, `mobile_en` 전수 통과): `options-concede-btn` Y좌표가 `options-quick-grid` 상단(`194 < 242`, `152 < 216`)에 위치함을 확인, 1단계 최소 버튼 → `gameover-next-step-btn` 클릭 → 2단계 `gameover-next-popup` 분기 팝업 전환 및 `← 결과 요약` 복귀까지 스크린샷 포함 확인 완료
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-17 16:01 KST] [SNSHero/눈히어로 공식 타이틀 로고(영문·국문) 하스스톤 풍 황금 입체 + 스노우 포인트 디자인 리뉴얼 (푸시 대기)]
- **요청**: 전체가 얼어붙은 기존 로고의 가독성 저하를 개선하여 하스스톤 스타일의 개성 있는 고대비 타이포그래피와 스노우 감성을 살리고, 유튜브 썸네일에도 바로 활용할 수 있도록 리뉴얼
- **수정 파일**:
  - `public/hs-assets/brand/logo-en.webp` (`1226×534` RGBA 투명 배경, 123KB — 3D 주조 황금·청동 입체 `SNSHero` 타이포그래피 + 글자 상단 스노우 포인트 + 사파이어 눈꽃 메달리온)
  - `public/hs-assets/brand/logo-ko.webp` (`1217×540` RGBA 투명 배경, 125KB — 동일 톤앤매너 고대비 국문 `눈히어로` 로고 동기화)
- **검증 결과**:
  - `npm run build` 성공 (`0` 에러)
  - 다크/라이트 배경 합성 검수에서 외곽 마젠타 프린지 `0` 확인 및 Playwright 한/영 실측(`/?lang=en` 데스크톱, `/?lang=ko` 모바일, `/game.html?lang=en` 데스크톱, `/game.html?lang=ko` 모바일) 모두 가로 넘침·에러 없이 선명한 렌더링 확인 완료
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-17 15:42 KST] [게임 메뉴 팝업 디자인 가이드 준수 리디자인 및 전체화면 성능Up! 라벨 추가 (푸시 대기)]
- **요청**:
  1. 게임 메뉴/환경설정 팝업(`GameOptionsModal`)을 SNSHero 공식 팝업 디자인 가이드(`.hs-wood-panel`, `.hs-ocarina-dialog`, 이중 주조 황동 베젤, `.hs-brass-btn`/`.hs-zelda-a|b|c-btn`/`.hs-arcane-btn`/`.hs-mario-spring`)에 맞게 전면 재디자인
  2. 전체화면 모드 플레이 유도 및 프레임 향상을 알리는 **`성능Up!`** (`FPS Up!`) 라벨을 로비 상단 버튼과 게임 메뉴 팝업 내부에 추가
- **수정 파일**:
  - `src/hearthstone/components/Modals.tsx` (`GameOptionsModal` 선술집 목재 프레임 + 이중 황동 테두리 + 성소 다이얼로그 적용, `⚡ 성능Up!` 배지 및 안내 추가, `hs-zelda-c-btn` 탭 대비 적용 및 `z-[120]` 레이어 정비)
  - `src/hearthstone/screens/BoxHubScreen.tsx` (`hub-fullscreen-btn` 최소 높이 `44px` 및 `hub-fullscreen-boost-badge` `성능Up!` / `FPS Up!` 라벨 추가)
  - `src/hearthstone/hearthstone.css` (`.hs-gold-btn`을 `.hs-zelda-c-btn`과 동일 황금 주조 그라데이션 규칙으로 보강)
- **검증 결과**:
  - `npx tsc --noEmit` 및 `npm run build` 성공 (`0` 에러)
  - Playwright E2E 및 시각 스크린샷 검증 완료 (`desktop_ko` `1280×800`, `mobile_ko` `390×844`, `desktop_en` `?lang=en`, `mobile_en` `?lang=en` 모두 통과, 모바일 터치 타깃 `44px+`/`54px`, 콘솔/페이지 에러 `0`건, 활성 탭 대비·레이아웃 확인 완료)
- **상태**: 로컬 커밋 완료 (원격 푸시 보류) · 구글 폼 보고 완료

## [2026-11-17 15:30 KST] [카드팩 개봉 전 미개봉 팩 카드 뒷면 선택 스킨 실시간 동기화 적용 (푸시 대기)]
- **요청**: 상점에서 카드 뒷면을 변경해 선택했을 때 카드팩 뽑기 전 미개봉 카드 팩의 겹친 카드들도 변경된 카드 뒷면 스킨으로 표시되도록 수정
- **원인**: [`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx)의 `SnsBoosterPackArt`가 `variant`를 받지 않고 `/hs-assets/cardbacks/snshero-gold.png` 이미지를 고정 렌더링하고 있었음.
- **수정 내용**:
  - [`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx): `resolveCardBackKey` 공통 헬퍼 추출, `SnsBoosterPackArt`가 `variant?: SnsCardBackId | string`을 받아 `SNS_CARD_BACK_THEMES[key]`의 광채(`glowColor`)와 각 겹친 카드 레이어에 `<SnsCardBackArt variant={key} />`를 렌더링하도록 개선 (또한 `ocarina_crest` 오버레이 인장도 `<SnsSnowCompassSeal size={38} />`로 통일).
  - [`PackOpeningScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/PackOpeningScreen.tsx) & [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx): 미개봉 카드 팩(천공 제단·좌측 대기열·모바일 바·드래그 고스트·허브 아이콘) 전수에 `variant={profile.selectedCardBack}` 전달.
- **검증 및 저장 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (`0` errors) 및 Playwright 데스크톱(`1280×800`)·모바일(`390×844`) E2E 검증에서 상점 카드 뒷면 변경 시(`gold → silver → bronze`) 카드팩 뽑기 전 미개봉 팩 카드 뒷면이 즉시 전환됨을 확인(`0` errors).
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류) 및 구글 폼 완료 보고 제출.

## [2026-11-17 15:10 KST] [`/checkIssue` ISS-004 해결 — 웹툰 31화 원작 『고블린 도박왕 보가트』 손실 위험 경고 나레이션씬 · `1~1,000G` 슬라이드 & 베팅버튼 · `100% 랜덤 30장 덱` 결투 · 골드 명예 보상품 인게임 적용 스크린샷 & 프로모션 홈페이지 업데이트 (푸시 대기)]
- **연동 시트**: `1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4` (`'게임 이슈 관리 로그'` 13행 `ISS-004`, 우선순위 `P0`, 상태 `점검완료·실행대기` → `완료` 갱신 · `'요약 대시보드'` `12/12 100.0%` 완료)
- **구현 및 수정 내역**:
  1. **웹툰 제31화 원작 『고블린 도박왕 보가트』 고화질 상반신 일러스트 및 입장 손실 위험 경고 나레이션씬 구현** ([`bogart_dealer.webp`](file:///Users/dayyoung/project/snshero/public/hs-assets/upper-hd/bogart_dealer.webp), [`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx)):
     - `webtoon.html?ep=31` 원작 설정과 일치하는 녹색 피부·뾰족한 귀·금 귀걸이·황금 주사위·보석 반지와 보라색 도박왕 망토 외형의 『고블린 도박왕 보가트』 HD 상반신 일러스트(`bogart_dealer.webp`) 생성 및 적용.
     - 보가트 도박장 입장 시 보가트 상반신(`54%~60%` 화면 높이) 나레이션씬(`bogart-narration-scene`)이 자동 표시되어 패배 시 베팅 골드가 소멸되는 손실 위험을 한·영 타이프라이터 연출로 경고(`[⚠️ 위험 확인 · 도박장 입장]`, `[건너뛰기 ▸▸]`, `[🎙 보가트 경고]` 다시 보기 지원).
  2. **`1 ~ 1,000` 골드 슬라이드 베팅 조절 바 + 우측 인접 `[🎲 베팅 시작]` 버튼 구현** ([`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx), [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts)):
     - 기존 고정 4티어 버튼을 `1G ~ 1,000G` 연속 레인지 슬라이더(`bogart-bet-slider`) + 빠른 금액 칩(`1G`/`100G`/`500G`/`1,000G`/`보유최대`)으로 개편하고, 슬라이더 바로 우측에 `[🎲 베팅 시작]` 버튼(`bogart-slider-bet-btn`)을 배치하여 원클릭 베팅 시작 지원.
     - `placeBogartWager` 및 `recordMatchOutcome`에서 `1G ~ 1,000G` 모든 정수 판돈 차감·2배 정산 완벽 연동.
  3. **뻔한 미러덱 폐지 → 양측 예측불허 `100% 랜덤 30장 덱` 결투 전환** ([`cardDb.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/cardDb.ts), [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx), [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx), [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx)):
     - 동결된 382장 수집 카드 풀 내에서 매 판 플레이어와 상대방 각각에게 서로 독립적인 30장 마나커브 균형 랜덤덱(`buildBogartRandomDeck`)을 새로 배분하도록 교체(382장 카드 동결 엄수).
  4. **골드 명예 보상품(황금 주화 교환소) 실제 인게임 적용 한·영 스크린샷 탑재 및 텍스트 간소화** ([`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx), `public/hs-assets/prestige/*_{ko,en}.webp`):
     - 4대 카테고리(프로필 뱃지·카드 프레임·카드 뒷면·캐릭터 호칭) 상단 실제 인게임 적용 대표 배너(`prestige-live-screenshot-banner`, 탭 확대 모달 지원) 및 전 18종 개별 아이템별 실제 인게임 장착 크롭 스크린샷(한·영 분리 총 44장 WebP) 적용.
  5. **프로모션 홈페이지(`/`) 보가트 도박장 3단계 가이드 & 실제 한·영 스크린샷 추가** ([`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx), `public/hs-assets/screenshots/ingame_bogart_{narration,slider,battle}_{ko,en}.webp`):
     - `#modes` 및 `#gold-economy` 섹션에 고블린 도박왕 보가트 경고 나레이션씬 · `1~1,000G` 슬라이더 시뮬레이터 · 30장 랜덤덱 실전 전장 · 4대 명예 보상품 실제 인게임 스크린샷을 한국어(`ko`)·영어(`en`) 분기로 반영.
- **검증 및 보고 결과**:
  - `npx tsc --noEmit && npm run build` 통과 (`0` errors).
  - Playwright 데스크톱(`1280×800` KO/EN) 및 모바일 Apple WebKit(`390×844` iOS 뷰포트) E2E 전수 통과 (커스텀 `37G` 슬라이드 차감·랜덤 30장 비미러덱 검증, 모든 한·영 스크린샷 `naturalWidth > 0`, 가로 스크롤 `0`, 터치 타깃 `>=44px`, 앱 에러 `0`건, 382장 카드 동결 확인).
  - 로컬 커밋 완료(`git push` 보류·대기), 이슈 시트 `J13` `"완료"` 갱신 및 구글 폼 완료 보고서 제출 완료.

## [2026-11-17 14:50 KST] [홈 화면 성소 SVG 마크 제거 및 첫 화면(`TAVERN_INTRO`) 스킵 후 홈 로비(`BOX_HUB`) 단일 문열림 직행 적용 (푸시 대기)]
- **요청**: ① 홈 화면 원판 상단 파란 마크(`<svg>` `SnsOcarinaCrestSeal`) 제거, ② 진입 시 문이 2번 열리는 느낌의 첫 화면(`TavernIntroScreen`) 제거 후 바로 홈 화면(`BoxHubScreen`)으로 한 번에 문 열리며 입장
- **수정 내용**:
  - [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx): 중앙 원판 위 `<SnsOcarinaCrestSeal size={40} ... />` 및 미사용 import 제거.
  - [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx): 초기 `screen` 상태를 `'TAVERN_INTRO'` → `'BOX_HUB'`로 변경하고 `TavernIntroScreen` 초기 분기 제거로 진입 즉시 홈 보관함 문열림 연출 1회만 재생되도록 단일화.
- **검증 및 저장 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (`0` errors) 및 Playwright 데스크톱(`1280×800`)·모바일(`390×844`) 실사 캡처에서 즉시 홈 진입 및 `#ocarinaBrass`/`#ocarinaSapphire` 마크 `0`건·앱 에러 `0`건 확인.
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류) 및 구글 폼 완료 보고 제출.

## [2026-11-17 14:18 KST] [라이센스 명칭(`시간의 오카리나` → `엘윈 성소의 문장`) 교체 및 `보가트 도박장` 표기 일원화 완료 (푸시 대기)]
- **요청**: 타사 라이센스 우려가 있는 `시간의 오카리나 성소` 관련 표기를 독자 IP 표현으로 변경하고, `보가트의 도박장` / `보가트 도박장의` 표기를 **`보가트 도박장`**으로 축약·통일
- **수정 내용**:
  - `시간의 오카리나(성소/문장)` / `Ocarina` → **`엘윈 성소의 문장` / `엘윈 성소 사파이어 문장` / `엘윈 성소의 수호자` (`Elwin Sanctuary Crest` / `Elwin Sanctuary Back` / `Guardian of Elwin` / `ElwinSage`)** 로 전수 치환([`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx), [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts), [`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx), [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx)). (기존 로컬스토리지 `ocarina_crest` 키 호환성 유지)
  - `보가트의 도박장` / `보가트 도박장의 승부사` → **`보가트 도박장` / `보가트 도박장 승부사`** 로 일괄 축약 통일([`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx), [`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx), [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx), [`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx), [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts), [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx)).
- **검증 및 저장 상태**: `npx tsc --noEmit && npm run build` 통과 및 Playwright로 `/`, `/game.html` 로비·도박장·상점·컬렉션 UI 문자열 검증 후 로컬 커밋(`git push` 보류) 및 구글 폼 보고 완료.

## [2026-11-17 13:54 KST] [카단·실리아 채팅창 외부 클릭 닫기 및 로컬 LLM·마이크 음성 질문 기능 구현 (푸시 대기)]
- **요청**: ① 카단 / 실리아 채팅창 외부 영역 클릭 시 자동 닫힘 적용, ② 로컬 LLM 구동 가능 브라우저(`LanguageModel` / `window.ai.languageModel` · WebGPU)에서 `명령` 버튼 옆 마이크 버튼(`🎤`) 표시 및 다양한 SNSHero 질문 응답 지원
- **구현 내용**:
  - [`KadanChatbotWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/KadanChatbotWidget.tsx) & [`SiliaUltimateWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SiliaUltimateWidget.tsx): `pointerdown`(캡처 단계) 및 `Escape` 키 리스너를 적용해 위젯 외부 클릭 시 열린 채팅/말풍선/스킬 메뉴가 즉시 닫히도록 개선.
  - [`localLlmAssistant.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/services/localLlmAssistant.ts): Chrome 온디바이스 Prompt API(`LanguageModel` / `ai.languageModel`) 및 WebGPU 기반 브라우저 지원 감지(`detectLocalLlmCapability`), SNSHero 382종 카드/3배 각성/실리아 필살기/팩 천장/실시간 전장 스냅샷 컨텍스트 기반 온디바이스 LLM 호출 및 내장 로컬 AI 폴백 응답(`askLocalLlmAssistant`) 구현.
  - [`KadanChatbotWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/KadanChatbotWidget.tsx): 로비·카드첩·전투 등 모든 화면에서 질문/명령 입력바 상시 제공, 로컬 LLM 지원 브라우저일 때 `명령` 버튼 옆 `🎤` 마이크 버튼(`kadan-mic-btn`, `44px×44px` 터치 타깃 · Web Speech API 실시간 음성 입력) 표시 및 질문/전술 명령 자동 분기 처리.
- **검증 및 저장 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (`0` errors).
  - Playwright E2E(`1280×800` KO + `390×844` EN): 카단·실리아 외부 클릭 닫힘, Prompt API(`LanguageModel`) 모의 온디바이스 Q&A + 마이크 버튼(`>=40px`) 표시, 미지원 환경 마이크 숨김·모바일 폭 비이탈·로컬 지식 엔진 폴백 및 앱 에러 `0`건 통과.
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류) 및 구글 폼 완료 보고 제출.

## [2026-11-17 13:38 KST] [iOS Safari `/game` WebKit 프로세스 재시작(`문제가 반복적으로 발생했습니다`) 7대 원인 근본 수정 완료 (푸시 대기)]
- **요청**: 아이폰(iOS Safari)에서 `https://snshero.com/game` 접속 시 `'https://snshero.com/game'에서 문제가 반복적으로 발생했습니다.` WebKit Jetsam / 프로세스 크래시 재발 오류 수정
- **원인 진단 및 근본 조치**:
  1. [`public/sw.js`](file:///Users/dayyoung/project/snshero/public/sw.js) (`snshero-media-v21-20261117`): iOS Safari `AVPlayer`의 오디오 `HTTP 206 Partial Content`(Range) 요청에 대해 SW가 `cache.put()` 예외 및 캐시된 `200` 응답을 반환하며 WebKit 미디어 디코더 충돌을 유발하던 문제를 차단 (오디오·비디오·`Range` 요청 100% 네트워크 직통 바이패스 및 `status === 200` 검증 강화).
  2. [`src/hearthstone/audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts): 첫 터치 전 `suspended` 상태의 `AudioContext`에 `OscillatorNode`/`GainNode`/`BiquadFilterNode`가 해제되지 않고 누적되던 누수 및 자동재생 `AVPlayer` 다중 생성을 차단 (`capture: true` 사용자 제스처 언락 이후에만 `AudioContext` 및 오디오 파이프라인 구동, 동시 신디 노드 상한 캡 적용).
  3. [`CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx) · [`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx) · [`hearthstone.css`](file:///Users/dayyoung/project/snshero/src/hearthstone/hearthstone.css) · [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts): 카드당 Retina 오프스크린 `IOSurface` 버퍼(~9MB/장)를 생성하던 SVG `<mask>`를 순수 벡터 `fillRule="evenodd"` 경로로 전환(`0` SVG mask)하고, `<feDropShadow>` SVG 필터 제거(`0` SVG filter), 모바일 터치 환경 `backdrop-blur` 및 카드 `filter: drop-shadow` 오프스크린 버퍼 비활성화, 카드별 중복 이벤트 리스너/`JSON.parse`를 단일 구독 캐시(`getEquippedCardFrame`)로 통합.
  4. [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx) · [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx) · [`journeyEpisodeTitles.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/journeyEpisodeTitles.ts): `BattleScreen`·`CollectionScreen`·`PackOpeningScreen`·`HeroDeckSelectScreen` 지연 로딩(Safe Glob Lazy) 및 40화 대본 데이터(`575KB`) 분리로 `/game` 초기 JS 엔트리 번들을 `522KB → 150KB`(`-71%`)로 경량화.
  5. [`TavernIntroScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/TavernIntroScreen.tsx) · [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) · [`GameAdSenseLayout.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/GameAdSenseLayout.tsx) · [`main.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/main.tsx) · [`post-build.js`](file:///Users/dayyoung/project/snshero/scripts/post-build.js): 모바일 인트로 `mix-blend-lighten` 제거, 프로모션(`/`) 하단 고해상도 이미지 `loading="lazy"` 적용(탭 내 `/`→`/game` 이동 시 PageCache 메모리 절감), AdSense `Error: no_div` 방지 DOM 고정 마운트, `GameErrorBoundary` 복구 가드 및 `/game-manifest.json` 절대경로 보정 적용.
- **검증 및 저장 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (`0` errors).
  - 실제 Apple WebKit(`webkit-2287`, iPhone 14 KO/EN 및 데스크톱 `1280×800`) E2E 검증 완료 (`Crashes=0, Errors=0, Pre-gesture AudioWarnings=0, masks=0, filters=0, CollectibleCards=382`).
  - 로컬 `git commit` 완료 (`git push` 대기) 및 구글 폼 완료 보고 제출.

## [2026-11-17 13:35 KST] [스토리 모드 · 실리아 필살기 대사 컷신 캐릭터 상반신 위치 상향 조정(`bottom-[112px] sm:bottom-[132px]`) 완료 (푸시 대기)]
- **요청**: 스토리 모드 캐릭터 대사 시 하단 대사창에 상반신이 가려 머리만 보이는 현상을 개선해 상반신을 위로 끌어올림
- **수정 내용**:
  - [`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx) (`StoryDuelDialogueOverlay` 좌/우 캐릭터 · `StoryVictorySceneOverlay`): 포트레이트 컨테이너 위치를 `-bottom-2.5 h-[51%] sm:h-[55%]` → `bottom-[112px] sm:bottom-[132px]` (`h-[50%] sm:h-[56%]`)로 상향 이동하고, `/characters/cutouts/` 폴백 시 하단 클리핑(`overflow-hidden`) 및 하단 부드러운 페이드 마스크(`PORTRAIT_BOTTOM_MASK`)를 적용해 허리·가슴·무기·팔까지 대사창 위로 온전히 드러나도록 개선.
  - [`SiliaUltimateWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SiliaUltimateWidget.tsx) (`SiliaDialogueCutsceneOverlay`): 실리아 상반신 컷신 위치(`bottom-[112px] sm:bottom-[132px]`, `h-[50%] sm:h-[56%]`), 배경 오라 위치(`bottom-10 sm:bottom-16`), 하단 페이드 마스크를 동일 기준으로 정렬.
- **검증 및 저장 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (`0` errors).
  - Playwright 실측 스크린샷(`desktop 1280×800`, `mobile 390×844`)으로 대사창 위 전신 상반신(갑옷·벨트·칼자루·얼굴) 노출 및 0에러 확인 완료.
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류) 및 구글 폼 완료 보고 제출.

## [2026-11-17 13:03 KST] [`/checkBug` 개발개선점 전수 패치(`DEV-013~031` 31/31 완료) 및 `/git-push` 원격 배포 완료]
- **요청**: `/checkBug /git-push` — SNSHero 개발문서(`1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU`) 미해결 과제 전수 구현·검증·시트 최신화 및 `origin main` 원격 푸시 수행
- **신규 구현 및 검증 완료 항목 (`DEV-025 ~ DEV-031` + 기존 완료분 `DEV-013 ~ DEV-024` 시트 상태 동기화)**:
  1. **`DEV-030` (`P0`) — 닌텐도 젤다(시간의 오카리나)·마리오 감성 리부트 및 루트 `design.md` 표준 확립**:
     - 루트 [`design.md`](file:///Users/dayyoung/project/snshero/design.md) 제정 및 [`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx)에 성검+방패+오카리나 문장(`SnsOcarinaCrestSeal`) 및 새벽·낮·황혼·밤 시간대별 스카이 라이팅(`getElwinTimeOfDayTheme`) 적용.
     - [`hearthstone.css`](file:///Users/dayyoung/project/snshero/src/hearthstone/hearthstone.css)에 감청색+이중 황동 대화창(`.hs-ocarina-dialog`), A블루·B그린·C앰버 보석 버튼(`.hs-zelda-a/b/c-btn`), 마리오 스프링 물리(`.hs-mario-spring`) 적용 및 [`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts)에 프로시저럴 10대 SFX(`mario_coin` B5→E6, `zelda_secret`, `zelda_chest_open`, `ocarina_chime` 등) 구현.
  2. **`DEV-027` (`P0`) — `'보가트의 도박장'`(100% 동일 미러덱 · 판돈 베팅) 및 `'황금 주화 교환소'` 신설**:
     - [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx) · [`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx) · [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) · [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts)에 `BOGART_GAMBLE` 모드(`100G/500G/2,000G/5,000G` 베팅, 승리 시 `2×` 상금, 100G 미만 무료 구호칩 `+100G`, 양측 100% 동일 30장 미러덱 배분) 구현.
     - [`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx) 보급소에 `'황금 주화 교환소'` 탭 신설 (`프로필 뱃지` · `카드 프레임 디자인` · `카드 뒷면 스킨` · `캐릭터 호칭` 4대 치장 상품 골드 해금·즉시 장착, `localStorage` 영구 저장).
  3. **`DEV-028` (`P0`) — `'온라인형 랭킹대전'` 승격(실시간 도전자 초상화·도발 멘트) 및 공식 전적 단독 반영**:
     - 매칭 시 닉네임·장착 호칭·뱃지·티어 액자 기반 도전자 초상화(`ChallengerPortrait`) 매칭, 배틀 중 18초 쿨타임 전황 반응형 도발 말풍선 및 6종 감정표현·도발 차단(`Mute`) 버튼 제공.
     - `storage.ts` · `QuestLogModal` 공식 전적(`rankedWins`, `rankedGames`, `rankedWinStreak`)을 오직 `RANKED` 승패만 반영하도록 완전 분리.
  4. **`DEV-025` (`P1`) — 배틀 결과 모달 카단 패인 진단·역상성 재도전 및 승리 MVP·챌린지 공유**:
     - 패배 시 카단 1줄 패인 진단 및 `[카단 추천 프리셋+전술 즉시 재도전]` 원탭 버튼(`onRematchWithPreset`), 승리 시 `🏆 BATTLE MVP` 카드 하이라이트 및 `/game?challenge=<deckCode>&tactic=<mode>` 공유 링크 복사 연동.
  5. **`DEV-026` (`P1`) — 내 카드첩 전술 키워드 칩 필터·카단 전술형 30장 자동 편성·모바일 마나커브 고정**:
     - [`CollectionScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/CollectionScreen.tsx)에 `[전체/돌진·속공/도발·방어/3배 각성/광역·번]` 필터 칩, 카단 3대 전술 자동 편성, 모바일 상단 고정 미니 마나 커브 바 적용 (382장 카드 동결 준수).
  6. **`DEV-029` (`P1`) — 프로모션 페이지(`/`) 3대 모드 개편 및 `#gold-economy` 쇼케이스 신설**:
     - [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) `#modes` 3대 체제 개편 및 `#gold-economy` 섹션(판돈 상금 시뮬레이터·4대 골드 치장 쇼케이스·`?mode=gamble` 직행 CTA) 탑재.
  7. **`DEV-031` (`P1`) — 보가트의 도박장 판돈 에스크로(F5 이어하기)·요정 샘 파산 구제 및 4대 치장품 전장 실시간 바인딩**:
     - `sessionStorage('snshero_gamble_active_match')` 에스크로 턴 스냅샷 및 새로고침 시 `이어하기 / 포기(판돈 몰수)` 모달 구현, `<100G` 요정 샘 재기 지원금(일 3회 `+150G` + 다음 공식 랭킹 1승 `+200G` 보너스), [`CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx) 앞면 프레임·뒷면 스킨·영웅 상단 호칭 리본·좌하단 뱃지 실시간 렌더링 바인딩.
- **검증 · 시트 최신화 · 배포 상태**:
  - `npx tsc --noEmit` 오류 0건, `npm run build` 성공, Playwright 데스크톱/모바일 한·영 E2E 통과 (`PAGE_ERRORS: []`).
  - 개발문서(`1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU`) `DEV-013~031` 전수 `"완료"` (`31/31`, `100%`) 최신화 완료.
  - 사용자 `/git-push` 요청에 따라 로컬 커밋 후 `git push origin main` 원격 배포 및 구글 폼 보고 완료.

## [2026-11-17 11:48 KST] [스토리 대사화면(EP 0~40 · 실리아 필살기) 및 프로모션 홈화면 상반신 일러스트 33종(34슬롯) 1024px 고화질 재생성·적용 완료 (푸시 대기)]
- **요청**: 대사할 때 표시되는 상반신 이미지와 프로모션 홈화면(`/`)에 표시되는 상반신 이미지 중 저화질로 나오는 이미지를 전수 조사해 고화질로 다시 생성하여 적용
- **원인 분석 (전수 해상도·선명도 감사)**:
  1. **보스 포트레이트 9종 + `kadan_upper` (`public/hs-assets/bosses/*.webp`, `cutouts/*.webp`)**: 기존 에셋이 `400×420` / `416×428` / `512×512` (`37KB~78KB`) 초저해상도로 제작되어 있어 프로모션 홈화면 보스 쇼케이스 4종 및 스토리모드 보스 대사 장면에서 픽셀 뭉개짐과 외곽선 계단 현상이 발생함.
  2. **영웅·주역 캐릭터 24종 (`EP 0~40` 대사화면 · 실리아 필살기 · 프로모션 홈 히어로 배너 & 9종족 대표 영웅)**: 기존 전신(`Full-body`, `1024px`) 컷아웃을 `h-[168%]`로 강제 확대 크롭해 상반신 유효 세로 해상도가 약 `480~550px`에 불과했으며, 일부 캐릭터(`013_Belphegor`, `061_Lucian`, `060_Death_Knight_Artus`, `006_Leviathan`, `011_Ignis`, `089_Medusa_Gorgo` 등)의 내부 선명도(Laplacian variance)가 낮아 레티나/고해상도 화면에서 흐릿하게 보임.
- **고화질 재생성 및 코드 적용 내역**:
  - **`public/hs-assets/upper-hd/*.webp` (신규 24종, 세로 `1024px` 전용 상반신 투명 RGBA WebP, `144KB~322KB`)**: `005_Aqualord`, `006_Leviathan`, `010_Poseidon`, `011_Ignis`, `013_Belphegor`, `025_Aeolus`, `030_Wind_God_Toram`, `040_Colossus`, `041_Kadan`, `045_Gawain`, `049_Hercul`, `050_Aleksandar`, `054_Arachne`, `060_Death_Knight_Artus`, `061_Lucian`, `062_Celia`, `066_Malfuon`, `069_Gandar`, `070_Aila`, `074_Grimli`, `080_Ironforge`, `081_Fenrir`, `086_Leonar`, `089_Medusa_Gorgo` 전수 고화질 상반신 일러스트 신규 제작.
  - **`public/hs-assets/bosses/*.webp` (10종) & `public/hs-assets/bosses/cutouts/*.webp` (9종)**: `boss_abyss_lucian`, `boss_balthazar`, `boss_bolton`, `boss_karg`, `boss_krakenlord`, `boss_malakai`, `boss_morgana`, `boss_zephyr`, `scarecrow_robot`, `kadan_upper` 전수 `1024px` 고화질 재제작 (`116KB~241KB`).
  - **`src/hearthstone/storyEncounterData.ts` · `StoryEncounterOverlays.tsx` · `SiliaUltimateWidget.tsx` · `BattleScreen.tsx`**: `resolveDialogueSpriteUrl()`이 24종 `upper-hd` 및 10종 HD 보스 에셋(`?v=hd20`)을 반환하도록 연결하고, `items-end` + `h-full` 정배율 렌더링으로 전환해 다리 크롭 확대(`h-[168%]`)로 인한 화질 저하를 원천 해소 (전투/덱 선택 아치 프레임용 기존 전신 `characters/cutouts/*.webp`는 100% 보존).
  - **`src/promo/PromoApp.tsx` · `public/sw.js`**: 프로모션 홈 상단 히어로 배너 좌·우(`카단` · `이그니스`), 스토리 보스 쇼케이스 4종, `9종족과 대표 영웅` 쇼케이스에 `1024px` HD 상반신 일러스트를 적용하고 서비스워커 미디어 캐시 버전(`snshero-media-v20-20261117`)을 갱신.
- **검증 및 저장소 상태**:
  - `npx tsc --noEmit` 오류 0건 및 `npm run build` 성공 (`dist/` 반영 완료).
  - Playwright 데스크톱(`1280×800`) · 모바일(`390×844`) 한·영 E2E 실측 검증 통과 (`naturalHeight === 1024`, `PAGE_ERRORS: []`).
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류) 및 구글 폼 완료 보고 제출.

## [2026-11-17 10:57 KST] [`AGENTS.md` 신규 기능 모바일 최적화 필수 원칙 명시 완료 (푸시 대기)]
- **요청**: 새로 추가되는 모든 기능들 역시 모바일에 최적화되어야 한다는 점을 `AGENTS.md`에 필수로 명시
- **수정 내용 (`AGENTS.md`)**:
  - **신규 기능 모바일 최적화 필수 원칙 (Mobile-First & Touch-Optimized Governance)** 섹션 신설: ① `360~430px`·`100dvh` 우선 설계 및 전장/광고(`#adsense-mobile-top` `32px+` 세이프존) 비침범, ② 원핸드 터치 타깃 최소 `44px×44px` 이상 보장, ③ WebP 경량화·Progressive Disclosure·터치 스와이프/원탭 적용, ④ 데스크톱+모바일 뷰포트 양방향 Playwright E2E 검증 의무.
- **저장소 및 보고 상태**: 정책에 따라 로컬 `git commit`만 수행(`git push` 보류) 및 구글 폼 완료 보고 제출.

## [2026-11-17 10:56 KST] [실리아 필살기 환생(NG+) 누적 비례 강화 시스템 구현 완료 (푸시 대기)]
- **요청**: 환생을 거듭할수록 실리아의 3종 필살기가 단계적으로 강해지도록 개선
- **구현 내용**:
  - `src/hearthstone/types.ts`: `getSiliaSkillPowerSpec(reincarnation)` 공통 스펙 함수 신설 (`r = 환생 횟수` 기준:
    - **바람 결계(DEFENSE)**: 아군 하수인 전체 천상의 보호막 + 영구 `+(2r)/+(2r)` 스탯 강화 (0환생: 보호막, 1환생: `+2/+2`, 2환생: `+4/+4`...)
    - **녹풍 참격(ATTACK)**: 적 하수인 전체 `-(1 + 2r)` 광역 피해 (0환생: `-1`, 1환생: `-3`, 2환생: `-5`...)
    - **생명의 미풍(HEAL)**: 아군 영웅 `+(2 + 3r)` 생명력 회복 + `+(2r)` 방어도 추가 부여 (0환생: `+2 HP`, 1환생: `+5 HP · +2 방어도`, 2환생: `+8 HP · +4 방어도`...))
  - `src/hearthstone/engine/GameEngine.ts`: `useSiliaSkill`에 환생 배율 버프/광역 피해/치유+방어도(`addArmor`)·VFX 배지·전투 로그 반영.
  - `src/hearthstone/screens/BattleScreen.tsx`: `SiliaUltimateWidget`으로 `matchState.journeyMeta?.reincarnation` 전달.
  - `src/hearthstone/components/SiliaUltimateWidget.tsx`: 환생 각성 배지(`★ N환생 강화` / `★ NG+N`), 하단 이름표(`실리아 ★N`), 스킬 버튼 수치/배지, 상반신 컷신 각성 대사·요약 및 시전 말풍선 한·영 100% 동기화.
  - `src/hearthstone/vfx/BoardVfxCanvas.tsx`: 환생 피해/파워 값에 비례해 녹풍 바람폭풍 파티클 및 충격파 링 반경 강화.
- **검증 결과**:
  - `npx tsc --noEmit` (수정 5개 파일 오류 0건) 및 `npm run build` 성공.
  - Playwright 2환생(`journeyReincarnation: 2`) 한·영 스토리 모드 검증: 한국어 메뉴/컷신/영웅 방어도 `+4` 실전 적용 확인 및 영문판 `NG+2` 메뉴/컷신 한글 노출 0건·`PAGE_ERRORS: []` 확인 완료.
- **구글 폼 보고**: `submit_report.py` 제출 완료.


## [2026-11-17 10:48 KST] [영문판 실리아 필살기 발동 시 일부 한글 노출 수정 완료 (푸시 대기)]
- **요청**: 영문판에서 실리아가 스킬(바람 결계 · 녹풍 참격 · 생명의 미풍)을 사용할 때 일부 한글이 노출되는 현상 수정
- **원인 분석**:
  1. `src/hearthstone/engine/GameEngine.ts`: `createMinionInstance` 및 `equipWeapon`이 `def.name`(한국어 원문)을 그대로 저장하고, `useSiliaSkill`이 VFX 배지(`🛡 ${m.name} 보호막/Shield!`) 및 전투 로그 상세(`targetNames`)에서 `m.name`을 직접 참조함.
  2. `src/hearthstone/screens/BattleScreen.tsx`: `SiliaUltimateWidget`의 `friendlyNames` / `enemyNames` prop으로 `m.name`을 그대로 전달해 영문판 실리아 말풍선에 한글 하수인명이 출력됨.
  3. `src/hearthstone/components/SiliaUltimateWidget.tsx`: `formatTargetSummary`에서 3기 이상 대상 요약 시 영문 분기 없이 `'... 외 N'` 한글 문자열이 하드코딩됨.
  4. `src/hearthstone/vfx/BoardVfxCanvas.tsx`: `SILIA_WIND_DEFENSE` / `SILIA_WIND_ATTACK` 기본 폴백 라벨이 한국어로 고정되어 있었음.
- **수정 내용**:
  - `src/hearthstone/engine/GameEngine.ts`: `createMinionInstance` · `equipWeapon`에서 `getCardName(def)` 적용 및 `useSiliaSkill` 대상명 조회에 `cardDispName(m.cardId, m.name)` 적용.
  - `src/hearthstone/screens/BattleScreen.tsx`: `SiliaUltimateWidget`의 `friendlyNames` / `enemyNames`를 `getCardName(def, lang)`으로 현지화 전달.
  - `src/hearthstone/components/SiliaUltimateWidget.tsx`: `formatTargetSummary` 3기 이상 영문 요약(`+${names.length - 2} more`) 분기 추가.
  - `src/hearthstone/vfx/BoardVfxCanvas.tsx`: 실리아 VFX 폴백 배너/배지 라벨 `isKoreanLanguage()` 한·영 분기 적용.
- **검증 결과**:
  - `npx tsc --noEmit` (수정 4개 파일 오류 0건) 및 `npm run build` 성공.
  - Playwright 영문 스토리 모드(`/game.html?lang=en`) 실전 검증: 메뉴 · 상반신 컷신 · VFX 배너 · 전장 하수인 타겟 말풍선(`🛡 Wind Barrier! Shielded Frost-Tusk Wild Boar!`) · 전투 기록 툴팁(`Granted Divine Shield to 1 friendly minion(s): Frost-Tusk Wild Boar`) 모두 한글 노출 0건 및 `PAGE_ERRORS: []` 확인 완료.
- **구글 폼 보고**: `submit_report.py` 제출 완료.


## [2026-11-17 10:45 KST] [영문 버전 전용 How to Play 스크린샷 6종 분리 적용 및 AGENTS.md 한·영/다국어 원칙 명시]
- **요청**: 영문 버전에서는 영문 UI 스크린샷이 표시되도록 분기하고, `AGENTS.md`에 영문 버전 고려사항과 한·영/다국어 언어팩 작업 지침을 필수로 명시
- **수정 내역**:
  - `public/hs-assets/guide/guide_en_01_hub.webp` ~ `guide_en_06_collection.webp`: `?lang=en` (`en-US` 로케일) 환경에서 실제 영문 게임 화면 6단계 실사 캡처 후 960×570 WebP(33~47KB)로 저장.
  - `src/hearthstone/components/OnboardingGuideModal.tsx`: `GuideStepSlide`를 `imageUrlKo` / `imageUrlEn` 이중 경로로 확장해 `lang === 'en'`일 때 영문 스크린샷만 표시되도록 실시간 언어 전환 분기 적용.
  - `AGENTS.md`: 최상단에 **영문 버전 고려사항 및 한·영/다국어 언어팩 작업 필수 원칙** 섹션 추가(`heroLang.ts` `tr(ko, en)` 준수, 텍스트 포함 스크린샷/로고/에셋 언어별 분리 의무, 한·영 양방향 E2E 검증 의무).
- **검증 및 저장소 상태**:
  - `npx tsc --noEmit && npm run build` 통과 및 Playwright 한·영 양방향 E2E 검증(`/?lang=en`, 실시간 EN↔KO 전환, `/game.html?lang=en` 모달 `0 errors`) 완료.
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류).

## [2026-11-17 10:39 KST] [영문 카드명 SVG 가로 압착(납작함) 현상 수정 완료 (푸시 대기)]
- **요청**: 영문 카드 이름이 가로로 심하게 눌려 납작하게 표시되는 현상 해결
- **원인 분석**: `src/hearthstone/components/CardVisual.tsx`의 SVG `<textPath>`에 `cardDisplayName.length >= 15`일 때 `textLength={216}` 및 `lengthAdjust="spacingAndGlyphs"`가 강제 적용되어 있어, 대부분 15자 이상인 영문 카드명의 글자(Glyph) 비율이 수평으로 비정상 압축·왜곡되는 문제가 발생함.
- **수정 내용 (`src/hearthstone/components/CardVisual.tsx`)**:
  - `lengthAdjust="spacingAndGlyphs"` 및 `textLength={216}` 제거로 글자 자체 비율 왜곡 원천 차단.
  - 문자별 폭 가중치 기반 동적 타이포그래피 계산 헬퍼 `getCardTitleTypography(title)` 추가 (`fontSize` `10.8..19` 비례 축소, `strokeWidth` `2.2..3.6` 비례 조정, 자간 최적화).
  - 리본 아치 경로 `#titleArch_${uid}` 폭 확장 (`M 32 233 Q 150 207 268 233`)으로 긴 영문 카드명도 리본 안에 여유 있게 안착하도록 개선.
- **검증 결과**:
  - `npx tsc --noEmit` (`CardVisual.tsx` 에러 0건) 및 `npm run build` 성공 (`dist/` 생성 완료).
  - Playwright 실브라우저 검증(`/game.html?mode=collection&lang=en`, 확대 모달, `lang=ko` 대조)에서 `PAGE_ERRORS: []`, 영문/한글 카드명 모두 정상 비율·선명도 확인.
- **구글 폼 보고**: `submit_report.py` 제출 완료.


## [2026-11-17 10:39 KST] [`/checkIssue` 이슈 Row 12 (`How to Play` 실제 게임 스크린샷 6단계 페이징 가이드 개편) 완료 (푸시 대기)]
- **요청**: `/checkIssue` 실행 — 이슈문서 미해결 항목(Row 12, `P0`, `"How to Play 가 너무 심플해. 실제 게임 스크린샷을 캡쳐해서 페이징 처리해서 설명해 줄 수 있어."`) 해결
- **구현 내역**:
  - `public/hs-assets/guide/guide_01_hub.webp` ~ `guide_06_collection.webp`: 실제 `game.html` 실행 화면(여관 로비·멀리건 Keep/Swap·마나/전투 보드·실리아/카단 필살기&자동플레이·무료 3팩 개봉·내 카드첩 3배 각성&로어 브릿지)을 Playwright로 1280×760 실사 캡처 후 960×570 WebP(34~47KB)로 최적화 저장.
  - `src/hearthstone/components/OnboardingGuideModal.tsx`: 공용 6단계 스크린샷 페이징 캐러셀(`HowToPlayCarousel`: 1~6 스텝 칩·이전/다음 버튼·도트 인디케이터·좌우 오버레이 화살표·키보드 방향키·모바일 스와이프 지원) 구현 및 `QuickRulesModal`(`게임 방법`) 전면 업그레이드.
  - `src/promo/PromoApp.tsx`: 루트(`/`) 프로모션 랜딩에도 `#how-to-play` 전용 섹션·상단 네비게이션·모바일 메뉴·히어로 배지 링크를 추가해 실제 게임 화면 페이징 가이드를 바로 탐색할 수 있도록 연동.
- **검증 및 저장소 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (`0` errors).
  - Playwright E2E(`vite preview` `127.0.0.1:4183`)에서 `/` `#how-to-play` 1→6페이지 이미지 로드 및 `/game.html` `QuickRulesModal` 페이징(1/6→2/6→4/6→3/6)·키워드 드로어·0에러 검증 통과.
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류 · 수동 확인 대기).

## [2026-11-17 10:34 KST] [성공한 일일 퀘스트(의뢰) 개별 카드 클릭 보상 수령 불가 결함 수정]
- **요청**: 성공한 퀘스트 카드를 클릭해도 보상이 수령되지 않는 버그 수정
- **원인**: `Modals.tsx`의 `QuestLogModal`에서 완료된 의뢰 카드가 클릭 이벤트 없는 일반 `<div>`로 렌더링되고 `storage.ts`에 개별 의뢰 보상 수령 메서드가 부재했으며, 수령 가능 의뢰가 있어도 아코디언이 기본 접힘(`'NONE'`) 상태였음.
- **수정 내역**:
  - `src/hearthstone/storage.ts`: `claimCompletedQuest(questId)` 신규 구현, `claimAllCompletedQuests()` 통합 및 마이그레이션 시 `bonusClaimed` 보존.
  - `src/hearthstone/components/Modals.tsx` (`QuestLogModal`): 수령 가능 의뢰(`!bonusClaimed`)가 있으면 `'QUESTS'` 패널 자동 오픈, 완료된 의뢰 카드를 클릭 가능한 `<button>`(`data-testid="quest-card-*"`)으로 전환해 카드 직접 클릭 시 `+20G` 추가 보상(미지급 기본 골드 포함) 즉시 수령 및 배너/사운드 피드백 제공, 이미 수령한 의뢰 클릭 시 안내 배너 표시.
  - `src/hearthstone/screens/BoxHubScreen.tsx`: 허브 의뢰 배지 수령 가능 조건을 `(q.completed || q.progress >= q.goal) && !q.bonusClaimed`로 통일.
- **검증 및 저장소 상태**:
  - `npx tsc --noEmit && npm run build` 통과 및 Playwright E2E(`game.html`)에서 완료 퀘스트 직접 클릭 수령(`250G → 270G`), 중복 클릭 방지, 일괄 수령(`270G → 290G`) 및 0에러 확인 완료.
  - 정책에 따라 로컬 `git commit`만 수행(`git push` 보류).

## [2026-11-17 10:27 KST] [`/checkAll` 3대 문서 재점검 및 `MKT-052` 역방향 로어 브릿지 구현 완료 (푸시 대기)]
- **요청**: `/checkAll` 실행으로 이슈문서 · 개발문서 · 마케팅문서 3종 일괄 재점검
- **시트 현황 확인**:
  - **이슈문서 (`ISSUE`)**: 미해결 `0`건 (`10/10` 완료).
  - **개발문서 (`DEV`)**: 미해결 `0`건 (`24/24` 완료).
  - **마케팅문서 (`MARKET`)**: 신규 `MKT-052`(`2026-11-17 10:11` 등록, `점검완료·실행대기`) 확인 및 코드 반영 가능 영역 구현.
- **구현 내역 (`MKT-052` 코드측 완료)**:
  - `src/hearthstone/components/CardZoomModal.tsx`: `getCardNovelLoreBridge()` 매핑(알렉산다르/카단 Ep.1, 헤르쿨/에일라 Ep.2, 펜릴 Ep.4, 이그니스 Ep.10, 아이언포지/그림리 Ep.12, 말라카이 Ep.18, 포세이돈 Ep.20, 아르투스 Ep.25, 루시안 Ep.38 및 9종족·중립 폴백) 및 `'내 카드첩'` 확대 모달(`showFlavor`) 내 `card-novel-lore-bridge` 박스(`📖 제N화 원작 읽기 → book.html?ep=N&utm_source=card_lore` + `⚔ 제N화 스토리 출격`) 탑재.
  - `book.html`: 정적 `<title>` / `description` / `og:title` 메타에 `'몰락한 성기사의 3배 각성 대서사시 — 382종 웹 TCG 원작'` 부제 리패키징 반영.
- **검증 및 저장소 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (`✓ built in 4.24s`).
  - Playwright E2E(`vite preview` `127.0.0.1:4180`) 실측: `/game.html?mode=collection` 카드 확대 모달에서 `card-novel-lore-bridge` 및 `/book.html?ep=20&utm_source=card_lore` / `/game.html?mode=story&ep=20&utm_source=card_lore_story` 링크, `/book.html?ep=20` 연결 및 앱 에러 `0`건 통과.
  - **로컬 `git commit`만 완료(`git push` 보류 · 사용자 수동 확인 대기)**.

## [2026-11-17 10:26 KST] [스토리 모드 · 실리아 필살기 컷신 상반신 크기 현재 대비 70% 비율 축소(`h-[51%] sm:h-[55%]`) 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - [`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx) 내 `StoryDialogueOverlay`(좌·우 대화 `h-[68%] sm:h-[78%]` ➔ `h-[51%] sm:h-[55%]`) 및 `StoryVictoryItemOverlay`(`h-[70%] sm:h-[80%]` ➔ `h-[52%] sm:h-[56%]`) 상반신 크기를 현재 대비 약 70% 수준(화면 절반 이상 유지)으로 축소 조정.
  - [`SiliaUltimateWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SiliaUltimateWidget.tsx) 내 `SiliaDialogueCutsceneOverlay` 상반신 포트레이트(`h-[68%] sm:h-[78%]` ➔ `h-[51%] sm:h-[55%]`) 및 배경 오라(`h-[78vh]` ➔ `h-[56vh]`)도 동일하게 70% 비율로 축소.
- **검증 및 보고**:
  - `npm run build` 성공 및 Playwright 데스크톱/모바일 스토리 대화·실리아 필살기 컷신 E2E 검수 완료, 구글 폼 보고 완료.

## [2026-11-17 09:45 KST] [`/checkAll` 후속 신규 과제 `DEV-024 · MKT-051` 일괄 구현·검증 완료 (푸시 대기)]
- **요청**: `/checkAll` 실행 중 대시보드 검증 과정에서 추가 확인된 신규 대기 항목(`DEV-024`, `MKT-051`) 후속 구현 및 E2E 검증 완료
- **개발문서 (`DEV-024` 완료)**:
  - `src/hearthstone/screens/BattleScreen.tsx`: 멀리건(Mulligan) 오버레이에 카단 전술(`AGGRO` / `CONTROL` / `AWAKENING` / `BALANCED`)별 `유지 추천 (Keep)` / `교체 권장 (Swap)` 배지(`getKadanMulliganAdvice`) 및 `'🪄 카단 추천대로 교체'` 원탭 버튼(`mulligan-apply-kadan-btn`) 구현.
  - `src/hearthstone/HearthstoneApp.tsx` · `src/promo/PromoApp.tsx`: `?preset=aggro|control|awakening`, `?tactic=aggressive|defensive|awakening`, `?starter=human|fire|undead` 딥링크 라우팅 연동 및 `#heroes` 영웅 쇼케이스·에피소드 출격 버튼에 전술/프리셋 파라미터 연결.
- **마케팅문서 (`MKT-051` 완료)**:
  - `src/promo/PromoApp.tsx`: `#heroes` 상단 `'⚡ 3초 전술 성향 매칭'` 인터랙티브 3종 위젯(`promo-3s-match-widget` — 철벽 방어 카단 / 초고속 돌진 이그니스 / 3배 각성 아르투스) 탑재 및 모바일 상단 AdSense(`#adsense-mobile-top`, 52px 고정 높이) 아래 20px 버퍼 스페이서 추가(총 34px 세이프존 확보).
- **검증 및 저장소 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (0 errors).
  - Playwright E2E(`vite preview` 포트 4179) 실측 검증 통과: 모바일(`/promotion` 390x844) `adHeight=52px, gap=34px`, 3초 성향 매칭 CTA 링크 3종 확인, `story?ep=1&preset=aggro&tactic=aggressive` 멀리건 Keep/Swap 배지 + `AGGRO` 전술 배지, `starter=fire&preset=aggro&tactic=aggressive` 직행 출격 모두 정상 및 앱 에러 `0`건 확인.
  - **로컬 `git commit`만 완료(`git push` 보류 · 사용자 수동 확인 대기)**.

## [2026-11-17 09:35 KST] [`/checkAll` 3대 문서 일괄 점검 및 `ISS-003 · DEV-013~023 · MKT-044/050` 구현 완료 (푸시 대기)]
- **요청**: `/checkAll` 실행으로 SNSHero 이슈문서 · 개발문서 · 마케팅문서 미완료 항목 일괄 점검 및 구현·테스트·시트 최신화
- **이슈문서 (`ISS-003` 완료)**:
  - `src/hearthstone/components/Modals.tsx` (`GameOptionsModal`): 3단 IA 리디자인 적용 — ① 상단 2×2 Zero-Emoji 벡터 아이콘 그리드(`lucide-react strokeWidth=1.75`: 사운드/전체화면/빠른백업/로비이동, 52px 터치 타깃), ② 3탭 카테고리(`전투·시스템` / `백업·계정` / `세계관·링크`), ③ `#090d16` 다크 서피스 + 16px 패딩 + 하단 분리된 위험 액션(`대결 항복하기`). `HearthstoneApp.tsx`에 `onGoHome` 연결.
- **개발문서 (`DEV-013~019` 완료 확인 + `DEV-020~023` 신규 구현)**:
  - `DEV-013~019`: 기존 패치 내역 검증 후 상태(`J14:J20`) `'완료'` 최신화.
  - `DEV-020`: `PackOpeningScreen.tsx` 3장(전설 2장) 각성 달성 시 `★ 3배 각성 달성!` 골드 배지 및 `'내 카드첩에서 바로 편성'` 버튼 추가, `storage.ts` `claimAllCompletedQuests()` 구현 및 `Modals.tsx` `'완료 의뢰 일괄 수령'` 버튼 추가, `BoxHubScreen.tsx` 의뢰 일지·보급소 레드닷 배지 바인딩.
  - `DEV-021`: `KadanChatbotWidget.tsx`, `aiController.ts`, `BattleScreen.tsx`, `HearthstoneApp.tsx` 연동 실시간 카단 전술 지휘(`AGGRO` 맹공 · `CONTROL` 수비 · `AWAKENING` 각성연계) 칩·자연어 명령 입력·실시간 AI 가중치 및 HUD 배지 구현.
  - `DEV-022`: `PreBattleDeckModal.tsx` 신설 및 `BattleScreen.tsx` 멀리건 화면 연결 — 3대 완성형 프리셋(`속공 돌파형`, `철벽 반격형`, `3배 각성 일격형`)·마나 커브·보스 상성 브리핑·초기 카단 전술 연동.
  - `DEV-023`: `BattleScreen.tsx` & `aiController.ts` 반자동 `집중 타격 핀(Focus Pin)` 1탭 우선 점사 및 5초 자동 복귀 `승부처 카단 브레이크(Clutch Choice)` 구현.
- **마케팅문서 (`MKT-044 · MKT-050` 코드 반영)**:
  - `public/manifest.json` 생성(한글 PWA 메타·`utm_source=pwa_app`), `game.html` 타이틀/메타 한국어 브랜드 키워드(`눈히어로 · 엘윈마을의 영웅들 · 카단의 여정 · 382종 무설치 웹 카드게임 TCG`) 보강 (`MKT-050` 코드 측 완료, 외부 티스토리/스토어 수동 작업 대기로 `'진행중'`).
- **검증 및 저장소 상태**:
  - `npx tsc --noEmit && npm run build` 통과 (에러 0건).
  - Playwright E2E(`game.html`)에서 `manifest.json` 200 OK, `GameOptionsModal` 3탭/2×2 그리드, `PreBattleDeckModal` 3배 각성/속공 프리셋, 카단 실시간 전술 전환 및 `OPPONENT_HERO` 집중 타격 핀 동작 및 앱 에러 `[]` 확인 완료.
  - 정책에 따라 **로컬 `git commit`만 완료(`git push` 보류 · 수동 확인 대기)**.

## [2026-11-17 09:17 KST] [신규 통합 스킬 `/checkAll` 생성 및 `AGENTS.md` 등록 완료]
- **요청**: 3가지 문서(`이슈문서 /checkIssue`, `개발문서 /checkBug`, `마케팅문서 /checkMarket`)를 한 번에 조회하고 일괄 처리하는 `/checkAll` 스킬 생성
- **작업 내역**:
  - `skills/checkAll/SKILL.md` (`.agents/skills/checkAll/SKILL.md`) 신규 생성: 3대 시트 일괄 `gsheets` 조회 → 우선순위별 구현/패치 → 통합 `tsc` + `vite build` + Playwright E2E 검증 → 로컬 `git commit` 전용(자동 `git push` 금지 · 수동 푸시 대기) → 3개 시트 배치 갱신 및 대시보드 검증 → `WORK_LOGS.md` 및 구글 폼 보고까지 전체 워크플로우 정의.
  - `AGENTS.md` 등록된 커스텀 스킬 목록에 `/checkAll` 항목 추가.

## [2026-11-17 08:42 KST] [자동플레이 속도 1.5배 감속 및 실리아 필살기 사용 시 자동 일시정지 적용]
- **요청**: 게임 진행이 너무 빨라 필살기 사용이 어려우므로 자동플레이 속도를 1.5배 느리게 조정
- **수정 내역**:
  1. **자동플레이 1.5배 감속 (`src/hearthstone/screens/BattleScreen.tsx`)**:
     - 자동 멀리건 대기 시간 `750ms → 1,125ms` (`EP.0: 1,100ms → 1,650ms`)로 1.5배 조정.
     - 플레이어 자동플레이 액션 스텝 지연 `560ms → 840ms` (`EP.0: ×1.5` 적용)로 감속.
     - 자동플레이(`autoPlay`) ON 상태일 때 상대 턴 스텝 지연도 `620ms → 930ms` (`EP.0: ×1.5`)로 1.5배 감속해 전체 자동 진행 호흡에 여유를 확보.
  2. **실리아 필살기 선택·시전 중 자동 일시정지 (`SiliaUltimateWidget.tsx`, `BattleScreen.tsx`)**:
     - 자동플레이가 켜진 상태에서도 실리아 메뉴를 열거나 대사/바람폭풍을 시전하는 동안(`siliaAutoPaused`) 자동 턴 넘김을 일시 정지해 필살기를 안정적으로 발동한 뒤 자동플레이가 자연스럽게 재개되도록 연동.
- **검증**: `npx tsc --noEmit && npm run build` 통과 및 Playwright E2E에서 자동플레이 ON 상태 실리아 메뉴 유지(1.8초 이상 대기 중 자동 턴 종료 차단) · 필살기 완료 후 재개 및 에러 `[]` 확인 완료.

## [2026-11-17 08:39 KST] [실리아 대사 종료 후 바람폭풍 재생 및 적용 대상 타겟 강조 연출 구현]
- **요청**: 실리아 대사가 종료된 뒤에 바람폭풍 효과를 재생하고, 누구에게 효과가 적용되었는지 한눈에 확인할 수 있도록 개선
- **원인 및 수정**:
  1. **실행 타이밍 분리 (`SiliaUltimateWidget.tsx`)**: 기존에는 스킬 클릭 즉시 `onCastSkill()`이 호출되어 어두운 대사 오버레이 뒤에서 VFX가 끝나버리던 문제를 해결. 대사 컷신이 끝난 뒤 오버레이를 먼저 닫고(`handleDialogueComplete`) 바람폭풍 발동 및 3등신 시전 모션·적용 대상 이름 말풍선을 재생하도록 변경.
  2. **사망 전 보드 좌표 스냅샷 (`BattleScreen.tsx`)**: `useSiliaSkill()` 호출 직전 `[data-hs-entity]` 및 `[data-silia-toggle="true"]`의 무대 좌표를 `recordEntityStagePosition()`으로 사전 기록하여 1체력 하수인 처치 시에도 정확한 위치에 타격 연출이 표시되도록 보완.
  3. **개별 타겟 이벤트 발행 (`GameEngine.ts`)**: `SILIA_WIND_DEFENSE`/`ATTACK`/`HEAL` 시전 시 전체 요약 배너(`적용 대상 수·이름 기록`)와 함께 각 피격/보호 대상 `uid`별 개별 바람줄기·타겟 강조 이벤트를 발생시키도록 개선.
  4. **파동 바람폭풍 & 스포트라이트 링 (`BoardVfxCanvas.tsx`)**: 실리아 위치(`SILIA_WIDGET`)에서 각 적용 대상까지 이어지는 곡선 바람줄기(`STREAM`), 사인파 바람폭풍 아크(`SWEEP`), 이중 점선 타겟 강조 링(`TARGET_RING`), 가독성 높은 `BANNER` 필 렌더링 추가.
- **검증**: `npx tsc --noEmit && npm run build` 통과 및 Playwright E2E(`game.html?mode=story&ep=1`)에서 대사 종료 후 실제 전장 하수인(`백은성단 빛방패 종자`, `해골기사 워커`, `해골 망령병`) 대상 바람폭풍·강조 링·결과 말풍선 확인 완료 (콘솔 앱 에러 `[]`).

## [2026-11-17 08:23 KST] [실리아 3등신 치비 스프라이트 & 대사화면 스타일 상반신 필살기 컷신 적용 완료]
- **요청**: 게임화면에서 실리아도 카단처럼 3등신 컷신으로 제작·적용하고, 필살기 사용 시 실리아 상반신이 나오며 대사화면처럼 필살기를 사용하도록 개선
- **작업 내역**:
  1. **3등신 치비 실리아 스프라이트 신규 제작 (`public/hs-assets/silia-bot/`)**:
     - 기존 7등신 크롭 및 단색 선 이미지를 폐기하고, 카단(`kadan-bot/*.webp`)과 동일한 3등신(3-head-tall) 치비 애니메이션 10프레임(`idle_01~04.webp`, `cast_defense_01~02.webp`, `cast_attack_01~02.webp`, `cast_heal_01~02.webp`, 320×320 RGBA 투명 배경)으로 전면 교체.
  2. **카단 스타일 대칭 하단 3등신 위젯 (`src/hearthstone/components/SiliaUltimateWidget.tsx`)**:
     - 사각 테두리 박스를 제거하고 투명 배경 3등신 스프라이트 크로스페이드 + 상단 상태 배지(`1/1✦`) + 하단 캡슐 네임플레이트(`실리아 · 필살기`) 적용.
  3. **대사화면 스타일 상반신 필살기 컷신 (`SiliaDialogueCutsceneOverlay`)**:
     - `StoryEncounterOverlays.tsx`의 `useAnimaleseTypewriter` 훅을 export해 재사용.
     - 필살기 시전 시 실리아 대형 상반신(`/hs-assets/characters/cutouts/062_Celia.webp`) + 스킬 속성 바람 오라 + 3등신 필살기 미니 컷인 + 다크 사다리꼴 네임플레이트(`실리아`)·크림 화이트 대사창(Animalese 타이핑 보이스 + `talkBob` 바운스 + 클릭 즉시 전체 표시/스킵/자동 복귀) 오버레이 구현.
- **검증**:
  - `npx tsc --noEmit && npm run build` 통과 (에러 0건).
  - Playwright E2E(`game.html?mode=story&ep=1`)에서 320×320 치비 4프레임 로드, 필살기 시전 시 상반신(`732×1024`) 대사화면 컷신 표시 및 자동 복귀, 콘솔/페이지 에러 `[]` 확인 완료.

## [2026-11-17 08:06 KST] [스킬 정책 변경: `/checkIssue`, `/checkBug`, `/checkMarket` 자동 `git push` 중단 및 수동 푸시 대기 전환]
- **요청**: `checkIssue`, `checkBug`, `checkMarket` 모두 `git push`는 실행하지 않고 사용자 확인 후 수동 푸시하도록 대기 정책 반영
- **수정 파일**:
  - `skills/checkIssue/SKILL.md`: 4단계를 로컬 커밋 전용으로 변경(`git push origin main` 제거), 자동 푸시 금지 명시
  - `skills/checkBug/SKILL.md`: 4단계를 로컬 커밋 전용으로 변경(`git push origin main` 제거), 자동 푸시 금지 명시
  - `skills/checkMarket/SKILL.md`: 4단계를 로컬 커밋 전용으로 변경(`git push origin main` 제거), 자동 푸시 금지 명시
  - `AGENTS.md`: `/checkIssue`, `/checkMarket`, `/checkBug` 설명을 로컬 커밋 + 사용자 수동 푸시 대기 정책으로 갱신
- **배포 상태**: 정책에 따라 로컬 `git commit`만 수행하며 `git push`는 보류

## [2026-11-17 08:04 KST] [`/checkIssue` 추가 2건(드럼리스 판타지 BGM · `/webtoon`/`/book` AdSense 전면 적용) 완료]
- **작업자**: `Antigravity Assistant`
- **해결 내역**:
  1. **Row 9 (`ISS-004` 판타지 게임 맞춤 BGM 전면 교체)**: GM 드럼 트랙(`ch 9`)을 100% 제거하고 하프·나일론 류트·플루트·오보에·바이올린·첼로·프렌치 호른·팀파니 기반의 정통 판타지 오케스트라 5트랙 재작곡·마스터링 (`public/hs-assets/snshero-audio/bgm/*.mp3`, [`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts) `?v=fantasy_orch2`).
  2. **Row 10 (`ISS-004` `/webtoon`·`/book`·`/novel` 포함 전 화면 Google AdSense 확장)**: [`webtoon.html`](file:///Users/dayyoung/project/snshero/webtoon.html), [`book.html`](file:///Users/dayyoung/project/snshero/book.html), [`novel.html`](file:///Users/dayyoung/project/snshero/novel.html), [`ReaderChrome.ts`](file:///Users/dayyoung/project/snshero/src/reader/ReaderChrome.ts)(`ensureReaderContentMount`), [`bookMain.ts`](file:///Users/dayyoung/project/snshero/src/reader/bookMain.ts), [`webtoonMain.ts`](file:///Users/dayyoung/project/snshero/src/reader/webtoonMain.ts)에 상시 고정 AdSense 슬롯 적용 + [`WebtoonSection.tsx`](file:///Users/dayyoung/project/snshero/src/reader/WebtoonSection.tsx) 16:9 `aspect-video` 보강.
- **검증 및 배포**: `npm run build`(`4.17s`), Chrome E2E `/webtoon.html`·`/book.html`·`/`·`/sns.html` 모두 `CLS 0`, `origin main` 푸시 및 이슈 시트 `J9:J10` `"완료"`(9/9 100%) 반영·구글 폼 보고 완료.

## [2026-11-17 07:59 KST] [`/checkIssue` + `/checkBug` + `/checkMarket` 3종 시트 일괄 해결·테스트·배포 완료]
- **작업자**: `Antigravity Assistant`
- **해결 및 구현 내역**:
  1. **`/checkIssue` (Row 8, `ISS-004`)**: 좌측 실리아 필살기를 [`KadanChatbotWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/KadanChatbotWidget.tsx) 스타일의 **실리아 챗봇 버튼(클릭 시 3스킬 팝업 열림) + 컷신별 스프라이트 애니메이션(`idle_01..04`, `cast_defense/attack/heal_01..02`)**으로 전면 업그레이드 (`public/hs-assets/silia-bot/` 10종 WebP 및 [`SiliaUltimateWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SiliaUltimateWidget.tsx)).
  2. **`/checkBug` (`DEV-013` ~ `DEV-019`, 7건 전수 완료)**:
     - `DEV-013`·`DEV-019`: [`index.html`](file:///Users/dayyoung/project/snshero/index.html) `/promotion` 앵커 추가, [`SharedAdSenseShell.tsx`](file:///Users/dayyoung/project/snshero/src/components/SharedAdSenseShell.tsx)·[`GameAdSenseLayout.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/GameAdSenseLayout.tsx) 광고 컨테이너 `data-nosnippet` 적용, [`aiController.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/aiController.ts) 잔여 덱 5장 이하 어그로/킬각 보강.
     - `DEV-014`·`DEV-015`: `/webtoon` 전용 SEO 분리 검증, [`book.html`](file:///Users/dayyoung/project/snshero/book.html) 40화 목차 링크 보강 및 [`BookSection.tsx`](file:///Users/dayyoung/project/snshero/src/reader/BookSection.tsx) `snshero_last_novel_ep` 이어읽기 배너 구현.
     - `DEV-016`·`DEV-017`·`DEV-018`: [`types.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/types.ts) `'태양 갑주'` 명명 통일, [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) 영웅 능력 0.85s 카드 드로우 프리뷰 토스트·패배 자동이동 6초 완화, [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx) `sessionStorage('snshero_deeplink_intent')` 보존 및 미해금 회차 체험 안내 토스트, 사용자 확정 도전만화 링크(`titleId=857363`) 단일화 검증 완료.
  3. **`/checkMarket` (코드 적용 가능 항목 추가 완료)**:
     - `MKT-038`([`robots.txt`](file:///Users/dayyoung/project/snshero/public/robots.txt) 크롤링 규칙 검증 완료), `MKT-044`([`game-manifest.json`](file:///Users/dayyoung/project/snshero/public/game-manifest.json) 382종 명세 갱신), `MKT-045`(팩 개봉 후 1클릭 출격 검증), `MKT-048`([`CollectionScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/CollectionScreen.tsx) 30장 덱 완성도 게이지 바 추가), `MKT-049`([`victoryCardShare.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/utils/victoryCardShare.ts) & [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) 승리 결과 1초 1200x630 전적 인증 카드 PNG 저장·공유 추가).
- **통합 검증 및 배포**:
  - `npx tsc --noEmit && npm run build` 0에러(`✓ built in 6.09s`), 100전 자동플레이(`fatigueEnds: 0`, `avgTurns: 17.3`), 실리아 컷신·영웅 스킬 아이콘·`/webtoon` SEO·`/book.html` 이어읽기·`/`·`/sns`·`/stone` AdSense(`CLS <= 0.0923`, `data-nosnippet`) Chrome E2E 전수 통과.
  - `git push origin main` 배포, 3대 구글 시트 최신화 및 구글 폼 보고 완료.

## [2026-11-17 07:25 KST] [구글 시트 브라우저 바로열기 3종 스킬(`/showIssue`, `/showMarket`, `/showBug`) 생성 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - [`.agents/skills/showIssue/SKILL.md`](file:///Users/dayyoung/project/snshero/.agents/skills/showIssue/SKILL.md): SNSHero 이슈문서(`1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4`) 브라우저 창 오픈 및 현황 요약 스킬 생성.
  - [`.agents/skills/showMarket/SKILL.md`](file:///Users/dayyoung/project/snshero/.agents/skills/showMarket/SKILL.md): SNSHero 마케팅문서(`1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU`) 브라우저 창 오픈 및 현황 요약 스킬 생성.
  - [`.agents/skills/showBug/SKILL.md`](file:///Users/dayyoung/project/snshero/.agents/skills/showBug/SKILL.md): SNSHero 개발문서(`1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU`) 브라우저 창 오픈 및 현황 요약 스킬 생성.
  - [`AGENTS.md`](file:///Users/dayyoung/project/snshero/AGENTS.md) 커스텀 스킬 목록 업데이트 및 로컬 커밋·구글 폼 보고 완료.

## [2026-11-17 07:21 KST] [`/checkIssue` 이슈문서(`1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4`) 5건 전수 수정·테스트·배포 완료]
- **작업자**: `Antigravity Assistant`
- **처리 이슈 및 구현 내역 (`ISS-001` ~ `ISS-004`)**:
  1. **`ISS-001` (P1) Google AdSense 공유 레이아웃 4대 라우트 확장**: [`SharedAdSenseShell.tsx`](file:///Users/dayyoung/project/snshero/src/components/SharedAdSenseShell.tsx) 신규 구축 및 [`GameAdSenseLayout.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/GameAdSenseLayout.tsx)·[`adsenseManager.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/services/adsenseManager.ts) 고정 크기(`52px !important` 모바일 띠배너, `176px` 데스크톱 좌·우 사이드 거터) 보강. [`index.html`](file:///Users/dayyoung/project/snshero/index.html), [`sns.html`](file:///Users/dayyoung/project/snshero/sns.html), [`stone.html`](file:///Users/dayyoung/project/snshero/stone.html), [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx), [`SnsBenchmarkApp.tsx`](file:///Users/dayyoung/project/snshero/src/sns/SnsBenchmarkApp.tsx), [`stone/HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/stone/HearthstoneApp.tsx) 적용(스톤 무료/결제 배제 준수).
  2. **`ISS-002` (P0) 자동플레이 AI 상호 카드 소멸·탈진 데드락 근절**: [`aiController.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/aiController.ts) 및 [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) 내 `history.length <= 24` 상한 버그(`didHistoryAdvance`로 교체) 완전 해결 및 저잔여덱/후반전 페이스 압박·2턴 킬·과도한 드로우 억제 휴리스틱 개선.
  3. **`ISS-003` (P0) 스토리 모드 전용 좌측 실리아(`062_Celia.webp`) 궁극기 위젯 & 난이도 밸런싱**: [`SiliaUltimateWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SiliaUltimateWidget.tsx), [`GameEngine.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/GameEngine.ts)(`useSiliaSkill` 턴당 1회 제한), [`BoardVfxCanvas.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/vfx/BoardVfxCanvas.tsx)(녹풍 회오리 VFX), [`kadanJourneyData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/kadanJourneyData.ts)(1~40화 적 체력·배율 상향 밸런싱) 구현.
  4. **`ISS-004 #1` (P0) 경쾌한 하스스톤 선술집풍 BGM 전면 교체**: CoreAudio DLS 오케스트라/어쿠스틱 합주로 5트랙(`tavern_hub.mp3`, `collection.mp3`, `mulligan.mp3`, `duel_1.mp3`, `duel_2.mp3`) 재제작 및 [`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts) 캐시 키(`?v=tavern_upbeat1`) 갱신.
  5. **`ISS-004 #2` (P0) 영웅 능력(스킬) 전용 아트워크 분리**: `public/hs-assets/hero-powers/` 12종 `.webp` 스킬 아이콘 제작 및 [`cardDb.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/cardDb.ts)(`getHeroPowerArtUrl`), [`CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx), [`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx) 적용.
  6. **`ISS-004 #3` (P0) 홈페이지(`/`) 초기 진입 흰 글자 깨짐(FOUC) 제거**: [`index.html`](file:///Users/dayyoung/project/snshero/index.html) 초기 `html, body` 다크 배경(`#120b06`) 고정 및 SSR SEO 텍스트 블록 `.promo-seo-sr` 오프스크린 전환으로 마운트 전 깨진 텍스트 플래시 0% 달성.
- **검증 및 배포 결과**:
  - `npx tsc --noEmit && npm run build`: 0에러 빌드 완료.
  - 자동플레이 100회 연속 헤드리스 검증: `combatEnds: 100, fatigueEnds: 0 (0.0%), avgTurns: 17.7`.
  - 실리아 3대 스킬·턴당 1회 제한·스토리 전용 제한·영웅 스킬 아이콘 분리 유닛 검증 통과.
  - Playwright Chromium 라이브 E2E(`/`, `/sns.html`, `/stone.html`, `/game.html`): 데스크톱/모바일 AdSense 및 CLS(`/`: 0.0001/0, `/sns`: 0/0, `/stone`: 0.0923/0.0502), 실리아 UI 1회 제한 잠금, 5종 BGM HTTP 200 OK 전수 통과.
  - `git push origin main` 배포, 이슈 시트 `J2:J6` `"완료"` 갱신 및 구글 폼 보고 완료.

## [2026-11-17 06:53 KST] [구글 시트 연동 3종 자동화 스킬(`/checkIssue`, `/checkMarket`, `/checkBug`) 생성 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - [`.agents/skills/checkIssue/SKILL.md`](file:///Users/dayyoung/project/snshero/.agents/skills/checkIssue/SKILL.md): SNSHero 이슈문서(`1fdGot6Com2_2k0_rSphIjFCKbCHgiV9ehuzoCjUsDL4`, `'게임 이슈 관리 로그'`) 조회 → 코드 수정 → 빌드·E2E 테스트 → 통과 시 `git push origin main` 배포 → 시트 상태(`완료`/`진행중`) 최신화 워크플로우 구축.
  - [`.agents/skills/checkMarket/SKILL.md`](file:///Users/dayyoung/project/snshero/.agents/skills/checkMarket/SKILL.md): SNSHero 마케팅문서(`1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU`, `'마케팅 분석 로그'`) 조회 → 코드 수정 → 빌드·테스트 → 통과 시 배포 → 시트 상태 최신화 워크플로우 구축.
  - [`.agents/skills/checkBug/SKILL.md`](file:///Users/dayyoung/project/snshero/.agents/skills/checkBug/SKILL.md): SNSHero 개발문서(`1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU`, `'개발개선점 분석 로그'`) 조회 → 결함 패치 → 빌드·E2E 테스트 → 통과 시 배포 → 시트 상태(`J`열) 및 조치내역(`K`열) 최신화 워크플로우 구축.
  - [`AGENTS.md`](file:///Users/dayyoung/project/snshero/AGENTS.md) 등록된 커스텀 스킬 목록 갱신.
- **검증 및 보고**:
  - 각 스프레드시트 탭명·대시보드 수식·컬럼(`A:K`)·진행 상태 문자열(`점검완료·실행대기`, `진행중`, `완료`, `보류`) 실측 검증 완료, 로컬 커밋 및 구글 폼 보고 완료.

## [2026-11-16 17:24 KST] [네이버 도전만화 링크(`titleId=857363`) 단일 통일 및 `sitemap.xml` `lastmod` 최신화 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - [`src/promo/PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) 및 [`src/reader/types.ts`](file:///Users/dayyoung/project/snshero/src/reader/types.ts) 내 네이버 도전만화 링크(`856677`) 4곳을 모두 사용자 지정 공식 주소(`https://comic.naver.com/challenge/list?titleId=857363`)로 단일 통일.
  - [`public/sitemap.xml`](file:///Users/dayyoung/project/snshero/public/sitemap.xml) 내 `/book`, `/webtoon` `<lastmod>`를 `2026-11-16`으로 갱신하여 Google Search Console 재제출·재크롤링 대비.
- **검증 및 보고**:
  - `rg -n "856677"` 잔존 0건 확인, `npx tsc --noEmit && npm run build` 0에러 통과.
  - 로컬 git 커밋 및 구글 폼 보고 완료.

## [2026-11-16 16:47 KST] [스토리 모드 캐릭터 대화·승리 오버레이 상반신 비율 축소(기존 ~70% 수준 · 전체 화면 50% 이하 엄격 제한) 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - [`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx) 내 `StoryDialogueOverlay`(좌·우 캐릭터) 및 `StoryVictoryItemOverlay`(승리 캐릭터)의 상반신 포트레이트 컨테이너 높이를 기존 `54%~126%`에서 **`h-[38%~40%] sm:h-[47%~48%] max-h-[48%]` (`overflow-hidden`)** 로 축소·재배치하여, 어떠한 해상도에서도 전체 화면의 절반(50%)을 초과하지 않고 기존 대비 약 70% 수준의 균형 잡힌 상반신 구도로 노출되도록 개선.
  - 전신 컷아웃(`/characters/cutouts/`) 에셋은 하단 고정(`bottom-0`) + `items-start` + `h-[155%]` 조합으로 하반신 노출 없이 깔끔한 상반신 크롭 유지.
- **검증 및 보고**:
  - `npm run build` 성공 및 Playwright 데스크톱(`1280x800`: 좌 47.9%, 우 44.6%)·모바일(`390x844`: 좌 37.1%, 우 37.9%) 실측 비율(전수 50% 이하) 및 스크린샷 시각 검수 완료. 구글 폼 보고 완료.

## [2026-11-16 16:39 KST] [`https://snshero.com/stone.html?lang=ko` 한글판 유튜브 본편(16:9) · 쇼츠(9:16) · 한글 썸네일 · 후킹 제목/설명 제작 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **한국어 UI 실플레이 녹화 (`?lang=ko`)**: Playwright로 데스크톱(`1280x720`) 4개 화면 및 모바일(`540x960`→`720x1280`) 한국어 하스스톤 웹게임 녹화.
  - **한글 유튜브 본편 (`stone_youtube_ko_16x9.mp4`, 87.50초) & 한글 쇼츠 (`stone_youtube_shorts_ko_9x16.mp4`, 39.13초)**: 쾌활한 한국어 남성 음성(`ko-KR-InJoonNeural`, `rate=+15%`, `pitch=+4Hz`) + 정품 BGM/SFX 믹싱 + `NotoSansKR` 볼드/블랙 자막 적용.
  - **한국어 유튜브 썸네일 (`1920x1080`)**: `stone_youtube_thumbnail_ko.png` / `.jpg` 및 복붙용 한글 후킹 제목/설명/타임스탬프/고정 댓글 리포트 생성.
- **검증 및 보고**:
  - HyperFrames `check --json`(0 에러) · `audio --json` · `ffprobe` · 디코드 프레임 검수 및 구글 폼 보고 완료.

## [2026-11-16 16:29 KST] [마케팅 분석 로그(MKT-001~MKT-034) 코드 반영 및 스프레드시트 상태 갱신 완료]
- **작업자**: `Antigravity Assistant`
- **연동 스프레드시트**: `1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU` (`마케팅 분석 로그` / `요약 대시보드`)
- **작업 개요**:
  - **1. SEO · AEO · 라우팅 및 레거시 제거 (`index.html`, `book.html`, `webtoon.html`, `public/llms*.txt`, `public/robots.txt`, `vite.config.ts`, `scripts/post-build.js`, `TavernIntroScreen.tsx`, `BoxHubScreen.tsx`, `README.md`, `.gitignore`)**:
    - `index.html`, `book.html`, `webtoon.html` 한·영 병기 메타·OG·JSON-LD(`alternateName` 음성 오인식 대응 포함) 및 크롤러용 정적 초록/내비게이션 보강, `public/llms.txt` & `public/llms-full.txt` Zero-Legacy 현행화.
    - 구버전 오염 경로(`/reddit`, `/wiki/*`, `/shop/*`, `/bench/*`) 301/404 리다이렉트 및 `robots.txt` 차단, `public/promotion/index.html` 정적 프리렌더 배치.
    - `TavernIntroScreen.tsx`·`BoxHubScreen.tsx` 내 잔존 `11종족 110영웅` / `110 Heroes` 문구를 `9대 종족 수호자` / `9 Guardian Heroes`로 교정.
    - `README.md` KO/EN 듀얼 리브랜딩 및 `.gitignore` 내부 마케팅 CSV·로그 패턴 차단.
  - **2. 프로모션 랜딩 · Pre-Game FTUE 전환 퍼널 (`src/i18n/heroLang.ts`, `src/promo/PromoApp.tsx`, `src/promo/PromoCard.tsx`)**:
    - `?lang=en`/`?lang=ko` URL 쿼리 동기화, 네이버 도전만화 링크 단일 통일(`857363` → `856677`), 히어로 딥링크 3원화(`?open=pack3`, `?mode=story&ep=1`, `?mode=story&ep=0`) 및 9대 종족 선택 바(`?faction=...&open=pack3`) 적용.
    - 무료 1호 카드팩(5장) 랜딩 선개봉 위젯(`hero_hs_promo_pack` → `/game?claim_promo=1`), 카드 라이브러리 `🔥 3장=3배 각성 시뮬레이터` 토글, `10초 핵심 전술 키워드` 인터랙티브 프리뷰, 게임 모드 보상 배지·UTM, 인페이지 제1화 성우 보이스+5컷 웹툰 극장 모달 구현.
  - **3. 공식 웹소설·웹툰 리더 & 양방향 진행도 연동 (`src/reader/episodeBridge.ts`, `src/reader/BookSection.tsx`, `src/reader/WebtoonSection.tsx`)**:
    - `book.html` 상단 성우 보이스·등장 보스 스탯 토글, 4대 막(Act I~IV) 목차 탭 및 막 보스 레이드 직행 버튼, 5배수 마일스톤·핵심 카드 3종 하단 브릿지, `hero_hs_last_novel_ep` ↔ `hero_hs_profile.journeyMaxStageCleared` 양방향 자동 연동 구현.
    - `webtoon.html` 하단 에피소드 보스 카드 & 인게임 보스전 직행 배너 추가.
  - **4. 인게임 리텐션 · 과금 브릿지 · 세이프가드 (`src/hearthstone/`)**:
    - `HearthstoneApp.tsx`·`storage.ts`: `?open=pack3|shop`, `?claim_promo=1`, `?mode=story&ep=N`, `?faction=`, `?deck=`, `?restore=` 딥링크 및 `hero_hs_last_novel_ep` 이어하기 토스트 구현.
    - `GameAdSenseLayout.tsx`: `TAVERN_INTRO` 및 초기 FTUE 구간 AdSense 비노출 유예 & 광고 제거(`$2.99`) 숏컷 버튼 추가.
    - `PackOpeningScreen.tsx`·`CollectionScreen.tsx`·`Modals.tsx`·`BoxHubScreen.tsx`·`BattleScreen.tsx`: 첫 전설 확정 프로그레스 바 및 7팩 이하 5팩/광고제거 브릿지, 전설 획득/결제 완료 1초 백업(+100G) 세이프가드, 여분 분해/가루 부족 시 보급소 브릿지, 덱 공유 URL 복사, PC↔모바일 3초 QR/복원 URL(`?restore=`) 생성기, 인앱 브라우저(카카오톡·네이버 등) 외부 브라우저 탈출 배너, 스토리 패배 시 2장 보유 카드 하이라이트 & 보급소 리벤지 버튼 구현.
  - **5. 검증, 시트 갱신 및 보고 완료**:
    - `npx tsc --noEmit && npm run build` 0에러 통과 및 레거시 문자열(`110 Heroes`, `11종족 110영웅`, `857363`) 0건 확인.
    - 구글 시트 `마케팅 분석 로그` 갱신: 코드 반영 완결 **12건(`완료`)**, 코드 반영 완료·외부 채널 잔여 **16건(`진행중`)**, 외부 채널 전용 **6건(`점검완료·실행대기`)** (총 34건 중 28건 코드/저장소 조치).
    - 로컬 git 커밋 및 구글 폼 보고 완료.

## [2026-11-16 16:19 KST] [`https://snshero.com/stone.html` 영문 유튜브 16:9 본편 + 9:16 쇼츠 동영상 및 후킹 썸네일 제작 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **실제 브라우저 플레이 녹화(`https://snshero.com/stone.html`, `en-US`)**: Playwright로 데스크톱(`1280x720`) 4개 화면(`desktop_hub.mp4`, `desktop_packs.mp4`, `desktop_collection.mp4`, `desktop_battle.mp4`) 및 모바일 세로(`540x960`→`720x1280`) 플레이(`mobile_gameplay.mp4`) 직접 녹화.
  - **유튜브 본편(`1920x1080`, 91.27초) & 유튜브 쇼츠(`1080x1920`, ~42.5초) HyperFrames 합성**:
    - 쾌활한 영어 남성 음성 내레이션(`edge-tts` `en-US-RogerNeural`, `rate=+14%`, `pitch=+3Hz`) + 정품 BGM(`tavern_hub.mp3`, `duel_1.mp3`) 및 게임 SFX(`box_open`, `pack_open`, `pack_legendary`, `card_flip`, `big_attack`, `victory`) 정밀 믹싱.
    - 구글 안티그래비티 제미나이 카본 × REA 1시간 복제 과정, 화면별 소개(여관/상자 허브, 카드 팩 개봉, 382장 카드첩·덱 빌더, 실시간 전투·멀리건·자동플레이), 영문 동기화 자막, 마지막 `https://snshero.com/stone.html` 참여 유도 엔드카드 구성.
  - **유튜브 후킹 썸네일 1920x1080 제작**: `stone_youtube_thumbnail.png` (1.5MB) 및 `stone_youtube_thumbnail.jpg` (328KB).
- **검증 및 보고**:
  - HyperFrames `check --json`(오류 0건) 및 `audio --json` 측정 검증, `ffprobe` 및 디코드 프레임 시각 검수 완료.
  - 아티팩트 디렉토리에 최종 MP4/썸네일 산출물 인도 및 구글 폼 보고 완료.

## [2026-11-16 15:57 KST] [`/stone-assets/audio/sfx/whoosh.mp3` 효과음 완전 제거 및 `stone.html` 전투 사운드 정제]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - [`public/stone-assets/audio/sfx/whoosh.mp3`](file:///Users/dayyoung/project/snshero/public/stone-assets/audio/sfx/whoosh.mp3) 에셋 파일 영구 삭제 및 `dist/` 빌드 산출물에서도 제외 확인.
  - [`audio.ts`](file:///Users/dayyoung/project/snshero/src/stone/audio.ts) `playSfx` 목록에서 `'whoosh'` 타입 제거.
  - [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/BattleScreen.tsx)(공격 개시 시 `whoosh` 호출 제거 및 멀리건 교체 시 `card_flip` 적용) 및 [`BoardVfxCanvas.tsx`](file:///Users/dayyoung/project/snshero/src/stone/vfx/BoardVfxCanvas.tsx)(`WHIRLWIND` 시 `attack` 타격음으로 교체) 전수 정리.
- **검증 및 보고**:
  - `npx tsc --noEmit && npm run build` 0에러 통과 및 `stone.html` 전투 E2E 검증 완료.
  - 구글 폼 보고 및 `/git-push` (`git push origin main`) 완료.

## [2026-11-16 15:56 KST] [`/game` (`game.html`) 입장 시 0.5초 후 홈 화면(`BOX_HUB`) 자동 입장 구현 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - [`TavernIntroScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/TavernIntroScreen.tsx)에 자동 입장 타이머(`AUTO_ENTER_DOOR_START_MS = 90ms`, `AUTO_ENTER_HOME_DELAY_MS = 500ms`)를 적용하여, `/game` 접속 시 수동 클릭 없이 0.5초(500ms) 후 자동으로 성소 문이 열리며 홈 화면(`BOX_HUB`)으로 전환되도록 구현.
  - 성소 양문 3D 스윙 및 페이드 트랜지션 시간을 0.42s~0.45s로 동기화하고, `completedRef` 및 타이머 정리(`clearScheduledTimers`)로 언마운트·조기 수동 클릭(`handleEnter`) 시 중복 전환이나 메모리 누수가 발생하지 않도록 보호.
- **검증 및 보고**:
  - `npx tsc --noEmit && npm run build` 0에러 통과.
  - Playwright E2E(`http://localhost:3000/game` 데스크톱 `1280x800` 및 모바일 `390x844`): 클릭 없이 자동 홈 화면(`BoxHubScreen`) 진입 확인(데스크톱 1,355ms, 모바일 1,155ms, 콘솔/페이지 에러 0건, 스크린샷 검수 완료).
  - 구글 폼 보고 완료.

## [2026-11-16 15:48 KST] [`stone.html` 좌상단 하스스톤 로고/타이틀 홈(`/`) 이동 링크 교체 및 영/한 글로벌 언어팩(기본 영어 · 한국어 브라우저 자동 감지 · 메뉴 실시간 전환) 개발·적용 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 허브 좌상단 버튼 → 하스스톤 로고 & 타이틀 홈 링크 교체 ([`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/BoxHubScreen.tsx))**:
    - 기존 상단 좌측 `일지` 및 `원본 검증` 2개 버튼을 제거하고, 공식 타이틀 로고(`/stone-assets/ui/hs_titlelogo.webp`)와 타이틀(`Hearthstone · Heroes of Warcraft` / `하스스톤 · 워크래프트의 영웅들`)이 결합된 `<a href="/">` 버튼(`[data-testid="stone-hub-home-logo"]`)으로 교체해 클릭 시 `/`로 즉시 이동하도록 적용(하단 트레이 `퀘스트`/`Quests` 및 메뉴 내 `REA` 검증 진입 경로는 유지).
  - **2. 메뉴 언어 설정(Language) 추가 및 브라우저 로케일 기반 기본 언어 자동 감지 ([`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/stone/components/Modals.tsx), [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/stone/HearthstoneApp.tsx), [`stone.html`](file:///Users/dayyoung/project/snshero/stone.html))**:
    - `GameOptionsModal` 최상단에 `Language / 언어 설정` 세그먼트 토글(`English` | `한국어`, `[data-testid="stone-options-language-selector"]`) 추가 및 [`heroLang.ts`](file:///Users/dayyoung/project/snshero/src/i18n/heroLang.ts) 연동.
    - 한국어 브라우저(`ko*`) 접속 시 자동으로 한국어(`ko`), 비한국어 브라우저 접속 시 기본 영어(`en`)가 적용되며, `html[lang]`과 `document.title`까지 동적 동기화되도록 구현(`useHeroLanguage` 구독 및 `HearthstoneApp` `useEffect` 루프 방지 처리 완료).
  - **3. 공식 `enUS` 382+123 카드 메타데이터 및 전 화면 영/한 언어팩 구축 ([`classic-cards.json`](file:///Users/dayyoung/project/snshero/public/stone-assets/data/classic-cards.json), [`i18nData.ts`](file:///Users/dayyoung/project/snshero/src/stone/i18nData.ts), [`cardDb.ts`](file:///Users/dayyoung/project/snshero/src/stone/cardDb.ts))**:
    - 수집 가능 카드 **382종 + 토큰 123종 전수**(382장 동결 원칙 엄수)에 공식 Blizzard `enUS` 영문 이름(`nameEn`), 효과(`textEn`), 플레이버 텍스트(`flavorEn`) 주입 및 카드 이미지 렌더 URL(`koKR` / `enUS`) 언어별 실시간 전환 연동.
    - [`src/stone/i18nData.ts`](file:///Users/dayyoung/project/snshero/src/stone/i18nData.ts)에 9대 클래식 영웅/영웅능력/감정표현, 등급 25~0(`CLASSIC_RANK_NAMES_EN`), 프리셋 덱명, 카드 뒷면명, 종족·희귀도·유형 라벨, 매칭 룰렛(`SPINNER_TITLES_EN`), 엔진 에러 번역 매핑 구축.
    - [`TavernIntroScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/TavernIntroScreen.tsx), [`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/HeroDeckSelectScreen.tsx), [`CollectionScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/CollectionScreen.tsx), [`PackOpeningScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/PackOpeningScreen.tsx), [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/BattleScreen.tsx), [`CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/stone/components/CardVisual.tsx), [`CardZoomModal.tsx`](file:///Users/dayyoung/project/snshero/src/stone/components/CardZoomModal.tsx), [`BoardVfxCanvas.tsx`](file:///Users/dayyoung/project/snshero/src/stone/vfx/BoardVfxCanvas.tsx), [`storage.ts`](file:///Users/dayyoung/project/snshero/src/stone/storage.ts), [`GameEngine.ts`](file:///Users/dayyoung/project/snshero/src/stone/engine/GameEngine.ts), [`cardEffects.ts`](file:///Users/dayyoung/project/snshero/src/stone/engine/cardEffects.ts), [`aiController.ts`](file:///Users/dayyoung/project/snshero/src/stone/engine/aiController.ts) 전수 영/한 동적 현지화(전장 영웅 능력 버튼 라벨 포함).
  - **4. 타입체크 · 프로덕션 빌드 · Playwright 이중 로케일 E2E 검증 완료**:
    - `npx tsc --noEmit` 및 `npm run build` 에러 `0`건 통과, `classic-cards.json` 382장 + 123토큰 무결성 유지.
    - Playwright E2E 검증(`en-US` 기본 영어 인트로·허브·옵션 실시간 한/영 전환·수집품 `/enUS/` 카드 확대·연습전 멀리건 및 전장 `Fireblast`/`Armor Up!` 확인·좌상단 로고 `/` 이동 + `ko-KR` 자동 한국어 적용) 전체 통과, 콘솔·페이지 에러 각 `0`건.

## [2026-11-16 14:59 KST] [스토리모드(`카단의 여정`) 박진감 전면 개편 — 5컷 웹툰 인트로 제거, `제N화 - 제목` VS 직행, 전장 상반신 교차 대사(최대 6대사) 및 승리 시 성물 획득/승리 멘트 분기 구현 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 5컷 웹툰 사전 재생 제거 & `제N화 - 제목` VS 대결화면 즉시 시작 (`src/hearthstone/screens/BattleScreen.tsx`)**:
    - 기존 매 회차 시작 전 재생되던 5컷 웹툰 극장(`KadanJourneyStoryModal` `PRE_BATTLE`)을 제거하고, 스토리모드 진입 즉시 **VS 대결화면 상단에 `제N화 - [에피소드 제목]`**(예: `제1화 - 눈보라 아래 두 서약`, EP.0: `에피소드 0 - 허수아비 로봇 기초 훈련`)과 장막 정보를 표시하며 바로 시작하도록 개편.
    - 대사 종료 즉시 막힘 없이 1턴 카드 대결이 펼쳐지도록 스토리모드 초기 멀리건을 자동 최적화 완료 상태로 준비하고, 대사 종료와 함께 `내 턴!` / `상대 턴` 배너 및 후공 은화 연출이 발동되도록 연동.
  - **2. 카드게임 화면 위 상반신(`waist-up`) 교차 대사 오버레이 구현 (`캐릭터 대사 장면.mp4` 레퍼런스 1:1 재현)**:
    - [`src/hearthstone/storyEncounterData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storyEncounterData.ts), [`src/hearthstone/components/StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx): 에피소드 0~40화 전수(41개 회차, 한/영 다국어 지원)에 대해 대결 인물 간 핵심 대립을 압축한 **최대 6대사(`4~6대사`) 교차 스크립트** 구축 및 9종 보스 알파 누끼 컷아웃(`public/hs-assets/bosses/cutouts/*.webp`) 생성.
    - 카드 전장 배경을 일시 정지(`autoPlay` · 상대 AI · 75초 밧줄 타이머 완벽 정지)한 상태에서 좌/우 상반신 캐릭터(화이트 셀셰이딩 스티커 외곽선, 발화자 밝기·스케일 포커스 vs 비발화자 디밍)와 사다리꼴 네임태그 크림 대사창을 교차 렌더링하며, **화면 클릭(또는 Space/Enter) 시 다음 대사로 이동 후 마지막 대사 클릭 즉시 카드 대결 개시**(우상단 `건너뛰기 ▸▸` 및 상단 `회차/대사` 선택 모달 병행 제공).
  - **3. 승리 시 회차별 성물 아이템 획득 연출(`아이템 획득 장면.mp4`) 및 미배정 회차 승리 멘트 종료 분기 구현**:
    - 20대 핵심 서사 성물(`PROP-001` 은빛 단검 ~ `PROP-020` 소금 결정 창, `public/hs-assets/items/prop_001.webp` ~ `prop_020.webp` 2D 셀셰이딩 투명 아이콘 20종 제작)을 정식 획득 회차 20개 에피소드에 매핑하고 `localStorage`(`hero_hs_story_items`)에 영구 기록.
    - **획득 아이템이 있는 회차(1·2·3·6·7·8·9·10·12·13·15·17·23·24·27·28·33·35·36·38화)**: 승리 캐릭터 대사 후 별무늬 양피지 프레임·스티치 타이틀 필(`✦ 아이템명 ✦`)·월계수 장식·스토리 설명·`확인 · 다음 화로 ▶` / `로비로 종료` 버튼이 포함된 아이템 획득 장면 표시.
    - **획득 아이템이 없는 회차(0·4·5화 등 나머지 21개 회차)**: 아이템 팝업 없이 승리 캐릭터 상반신 승리 멘트와 함께 즉시 회차 종료(`회차 종료 (로비)` / `다음 화 계속하기 ▶`) 처리.
  - **4. 타입체크 · 프로덕션 빌드 · Playwright E2E 실전 검증 완료**:
    - 수집 가능 카드 **382장 동결** 유지, `npx tsc --noEmit` 및 `npm run build` 에러 `0`건 통과.
    - Playwright 데스크톱(`1440×900`)·모바일(`390×844`) E2E 검증: 5컷 웹툰 미노출, 1화 VS 배너·6대사 일시정지 및 클릭 진행·즉시 카드 대결 개시·승리 후 `[은빛 단검]` 획득 카드 및 `hero_hs_story_items` 저장 확인, 4화(무아이템) 승리 멘트 및 로비 복귀 확인(`Total app errors: 0`).

## [2026-11-16 14:46 KST] [전장 전설 하수인(`BoardMinionToken`) 드래곤 프레임 깨짐 수정 및 손패 카드와 디자인 통일 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 전장 전설 크레스트 SVG(`SnsLegendaryCrestSvg`) 깨짐 원인 해소 및 통합 (`SnsHeroArtKit.tsx`)**:
    - 기존 [`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx)의 전장 전용 `SnsLegendaryCrestSvg`가 손패 카드의 입체 조각 용 프레임(`SnsLegendaryCardDragonSvg`)과 달리 거친 다각형 + 고정 `<defs>` ID(`snsLegWingGold` 등) + 빗나간 좌표(`260×120`)로 렌더링되어 전장 타원 위에서 깨진 회색 조각처럼 보이던 문제를 해소.
    - `SnsLegendaryCardDragonSvg`에 `preserveAspectRatio` 옵션을 추가하고 `SnsLegendaryCrestSvg`가 이를 래핑(`preserveAspectRatio="none"`, `React.useId()` 고유 그라데이션 ID 보장)하도록 전면 교체해 손패·멀리건·도감과 100% 동일한 조각 용 아트를 사용하도록 통일.
  - **2. 전장 하수인 타원 베젤 및 드래곤 정렬 최적화 (`CardVisual.tsx`)**:
    - [`src/hearthstone/components/CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx)의 `BoardMinionToken`에서 전설 하수인의 타원 테두리를 황금 메탈 베젤(`border-[#eab308] ring-[1.5px] ring-[#241305]`)로 보강하고, 드래곤 크레스트를 전장 타원 비율에 맞춰 모바일(`67×73`, `-top-[10px]`) 및 데스크톱(`131×134`, `-top-[19px]`) `z-[22]` 위치에 정밀 정렬(공격력·생명력·Zzz 배지 `z-30` 비간섭).
  - **3. 타입체크 · 빌드 · 데스크톱/모바일 Playwright 실화면 검증 완료**:
    - `npx tsc --noEmit` 및 `npm run build` 에러 0건 통과.
    - Playwright 데스크톱(`1440×900`, `EX1_012 진홍해골 리치 켈투스`) 및 모바일(`390×844`, `NEW1_029 허세꾼 마도공작 이바르`) 실전 소환 화면 캡처에서 손패와 동일한 입체 전설 용 프레임 정상 렌더링 확인.

## [2026-11-16 14:32 KST] [`/hs-assets/screenshots/ingame_ranked_battle.png` 서비스 워커 캐시 고착 및 이미지 미표시 방지 개선 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 서비스 워커(`public/sw.js`) 캐시 무효화 및 `Network-First` 전환**:
    - 기존 `snshero-media-v18-clean20261113` 캐시가 `/hs-assets/screenshots/*.png` 및 직접 URL 탐색(`request.mode === 'navigate'`)까지 Cache-First로 가로채어 배포 직후나 과거 깨진/스테일 응답이 영구 고정될 수 있던 문제를 해결.
    - [`public/sw.js`](file:///Users/dayyoung/project/snshero/public/sw.js): `MEDIA_CACHE_NAME`을 `snshero-media-v19-20261116`으로 갱신해 구버전 캐시를 자동 폐기하고, `request.mode === 'navigate'`는 네트워크 표준 스택으로 통과시키며, `/hs-assets/screenshots/`를 `Network-First` 대상으로 편입하고 `isValidMediaResponse()`(`res.ok` 및 `text/html` 오캐싱 차단) 검증 추가.
  - **2. 서비스 워커 즉시 갱신 & 홍보 이미지 캐시 버스팅 (`index.html`, `game.html`, `src/promo/PromoApp.tsx`)**:
    - [`index.html`](file:///Users/dayyoung/project/snshero/index.html) 및 [`game.html`](file:///Users/dayyoung/project/snshero/game.html)의 `navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })` 옵션 추가로 브라우저의 구형 `sw.js` HTTP 캐시 재사용 방지.
    - [`src/promo/PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) 내 `/hs-assets/screenshots/*.png` 경로에 `?v=20261116` 쿼리 버저닝 적용.
  - **3. 타입체크 · 빌드 · Playwright 검증 완료**:
    - `npx tsc --noEmit` 및 `npm run build` 에러 0건 통과, Playwright 검증에서 `snshero-media-v19-20261116` 활성·홍보 페이지 스크린샷 전종(`1920×1080`) 및 `/hs-assets/screenshots/ingame_ranked_battle.png` 직접 접속(`200 OK`, `1920×1080`)·`ERRORS: []` 확인.

## [2026-11-16 13:00 KST] [`/stone.html` 적용 전체 개선사항 `/game.html`(눈히어로) 전수 동기화 및 실브라우저 검증 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 대전 전장(`BattleScreen.tsx`, `CardVisual.tsx`) 연출·UX·자동전투 안정성 전수 동기화**:
    - [`src/hearthstone/components/CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx):
      - `BoardMinionToken`에 전장 접지 그림자(`bg-black/60 blur-[3px]`) 및 지속·격발 능력 하수인 번개(`⚡`) 배지(`TRIGGER_CARD_IDS` + 지혜의 축복·압도적인 힘·부패 상태 포함) 추가.
      - `HeroPortraitZone` 장착 무기 슬롯에 상대 턴 진입 시 좌우 강철 셔터가 닫히는 트윈 셔터 연출(`-translate-x-full` / `translate-x-full` + `SnsSnowCompassSeal` 잠금 인장) 적용, 영웅 능력 메달리온에 사용 시 3D 코인 뒤집힘(`perspective: 700px`, `rotateY(180deg)`) 애니메이션 적용.
    - [`src/hearthstone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx):
      - `triggerPhysicalAttack` 시작 여부(`boolean`) 반환 및 플레이어 자동전투(`autoPlay`)·상대 AI 턴 실행 루프에 무진행 안전 폴백(`errorBanner` 또는 `history` 미증가 시 즉시 `endTurn()`), 유효 대상 있는 선택 옵션 우선 채택(`viableOpt`), 자동 멀리건 후공 보너스 은화 쇼케이스(`coinGiftShowcase`) 추가.
      - `운명의 선택`(`chooseOnePrompt`) 및 `정찰 추적`(`trackingPrompt`) 모달을 1클릭 즉시 발동·선택 + `🔍 카드 확대`(또는 우클릭) 구조로 업그레이드.
  - **2. 성소 로비(`BoxHubScreen.tsx`, `hearthstone.css`) · 팩 개봉(`PackOpeningScreen.tsx`) · 카드첩(`CollectionScreen.tsx`) · 매치메이킹(`HeroDeckSelectScreen.tsx`) 동기화**:
    - [`src/hearthstone/screens/BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx), [`src/hearthstone/hearthstone.css`](file:///Users/dayyoung/project/snshero/src/hearthstone/hearthstone.css): 성소 보관함 3D 양문 스윙 개방(`hsBoxDoorLeftSwing` / `hsBoxDoorRightSwing`), 하단 황동 서랍 슬라이드인(`trayReady`), 상단 `눈히어로` 로고 클릭 시 상자 개폐 연출 다시 보기(`replayBoxUnlatch`) 구현.
    - [`src/hearthstone/screens/PackOpeningScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/PackOpeningScreen.tsx): 레거시 HTML5 `draggable` 대신 `#hs-stage-canvas` 스케일 좌표를 반영한 포인터/터치 드래그-투-천공제단(`packPointerDrag` + 부유 팩 추종 + 제단 드롭 개봉) 구현.
    - [`src/hearthstone/screens/CollectionScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/CollectionScreen.tsx): 덱 편집 중 바인더 보유 카드 1클릭 즉시 덱 추가, 우측 덱 타일 1클릭 즉시 1장 제외 + `🔍` 상세 버튼, 덱 타일 호버 플로팅 카드 프리뷰(`isGolden` 반영 및 `#hs-stage-canvas` 내부 `absolute` 정렬) 적용.
    - [`src/hearthstone/screens/HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx): 랭킹대전 맞수 탐색 모달을 좌우 황동 포인터(`▶`/`◀`)와 5단 원통형 아이보리 슬롯 드럼(`matchmaking-slot-drum`)으로 업그레이드.
  - **3. 거버넌스 준수 · 프로덕션 빌드 · Playwright E2E 검증 완료**:
    - 수집 가능 카드 총수 **382장** 엄격 동결(`game.html: 382`, `stone.html: 382`) 및 눈히어로 독자 IP·스토리지 격리(`hero_hs_*`, `/hs-assets/**`, `stone-assets` 참조 0건) 100% 확인.
    - `npx tsc --noEmit` 및 `npm run build` 에러 `0`건 통과, Playwright 데스크톱(`1440×900`)·모바일(`390×844`) 통합 E2E 검증 전 항목 통과(`Total app errors: 0`).

## [2026-11-16 12:46 KST] [게임 시작 VS 캐릭터 호명 음성 무공백 연속 재생 최적화 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 32종 짧은 캐릭터 이름(`short_*.mp3`) 및 `announcer_versus.mp3` 전후 무음 구간 정밀 트리밍**:
    - 기존 `public/hs-assets/snshero-audio/story/short_*.mp3` 32개 파일(각 앞 무음 ~0.35초 + 뒤 무음 ~1.0초)과 `public/hs-assets/snshero-audio/vo/announcer_versus.mp3`(뒤 무음 ~1.39초) 때문에 "알렉산다르 대 루시안" 소개 시 약 3.5~4초의 빈 공백이 발생하던 원인을 제거.
    - `ffmpeg` `-55dB` 기준 발화 경계 검출 + 미세 페이드(`8ms`/`10ms`) 트리밍으로 단어 내부 호흡은 보존하면서 전후 무음을 20ms 수준으로 압축(`short_aleksandar.mp3` `1.87s → 0.779s`, `announcer_versus.mp3` `1.69s → 0.355s`, `short_lucian.mp3` `1.94s → 0.547s`).
  - **2. Web Audio API 병렬 디코딩 & 0ms 무공백 연속 스케줄링 도입 (`src/hearthstone/audio.ts`)**:
    - [`src/hearthstone/audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts): `playGaplessVoSequence()`, `loadDecodedVoBuffer()`, `trimAudioBufferSilence()`, `playSequentialPreloadedUrls()` 신설 및 `playMatchupAnnouncement()` 고도화.
    - 플레이어 이름 · `"대!"` · 상대방 이름 3개 음원을 병렬 fetch/decode하고 디코딩된 PCM의 MP3 인코더 패딩 무음까지 제거한 뒤 `AudioBufferSourceNode`로 정확히 이어 붙여 공백 없이 순서대로 호명하도록 구현(AudioContext 미활성 시 병렬 프리로드 `<audio>` 폴백 + `?v=tight1` 캐시 버스팅 적용).
  - **3. 타입체크 · 프로덕션 빌드 · Playwright 실브라우저 검증 완료**:
    - `npx tsc --noEmit` 및 `npm run build` 에러 0건 통과.
    - Playwright(`1280×800`, `ko-KR`) 1화("알렉산다르 대 루시안") 실전 테스트: VS 화면 진입부터 3개 음원 병렬 요청(`?v=tight1`, `deltaMs: 0`) 및 VS 전환 완료까지 `1963ms` 기록, `PAGE_ERRORS: []` 확인.

## [2026-11-16 12:42 KST] [`/` 공식 게임 소개(구 `/promo`) 승격 및 `/game` 게임 엔트리포인트 전환 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 루트(`/`) 및 `/game`, `/promo` 라우팅·엔트리포인트 전환 (`index.html`, `game.html`, `promo.html`, `vite.config.ts`, `scripts/post-build.js`)**:
    - [`index.html`](file:///Users/dayyoung/project/snshero/index.html)을 공식 소개 페이지(`#promo-root`, `/src/promo/main.tsx`)로 전환하고 `https://snshero.com/` canonical 및 SEO/OG/JSON-LD(`WebSite`, `WebPage`, `VideoGame`, `FAQPage`) 메타데이터 적용.
    - [`game.html`](file:///Users/dayyoung/project/snshero/game.html)을 `/game` (및 `/game.html`) 카드 배틀 게임 정식 진입점으로 유지·갱신(`canonical: https://snshero.com/game`, `robots: index, follow`, `#sns` 해시 리다이렉트 보강).
    - [`vite.config.ts`](file:///Users/dayyoung/project/snshero/vite.config.ts)의 `mpaRewriteMiddleware` 및 [`promo.html`](file:///Users/dayyoung/project/snshero/promo.html), [`scripts/post-build.js`](file:///Users/dayyoung/project/snshero/scripts/post-build.js)(`404.html` 포함)에서 `/promo`, `/promo.html`, `/promotion`, `/promotion.html` 접근 시 `302`/`replace`로 `/`로 자동 리다이렉트되도록 구성.
  - **2. 전 페이지 내부 링크·PWA 매니페스트·SEO/GEO 파일 동기화**:
    - [`src/promo/PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx), [`src/reader/ReaderChrome.ts`](file:///Users/dayyoung/project/snshero/src/reader/ReaderChrome.ts), [`src/reader/WebtoonSection.tsx`](file:///Users/dayyoung/project/snshero/src/reader/WebtoonSection.tsx), [`src/hearthstone/screens/BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx), [`src/sns/SnsBenchmarkApp.tsx`](file:///Users/dayyoung/project/snshero/src/sns/SnsBenchmarkApp.tsx), [`src/mcp/mcpServerNode.ts`](file:///Users/dayyoung/project/snshero/src/mcp/mcpServerNode.ts) 내 게임 실행 링크를 `/game`으로, 공식 소개 링크를 `/`로 일괄 갱신.
    - [`public/game-manifest.json`](file:///Users/dayyoung/project/snshero/public/game-manifest.json), [`public/robots.txt`](file:///Users/dayyoung/project/snshero/public/robots.txt), [`public/sitemap.xml`](file:///Users/dayyoung/project/snshero/public/sitemap.xml), [`public/llms.txt`](file:///Users/dayyoung/project/snshero/public/llms.txt), [`public/llms-full.txt`](file:///Users/dayyoung/project/snshero/public/llms-full.txt) 경로 최신화.
  - **3. 빌드 · 실브라우저 검증 · 서버 재기동 완료**:
    - `npx tsc --noEmit` 및 `npm run build` 에러 `0`건 통과 후 `scripts/start-server.sh`로 포트 3000 프리뷰 서버 재기동.
    - Playwright 실브라우저 및 `curl` 검증에서 `http://localhost:3000/`(`#promo-root` 정상 렌더), `http://localhost:3000/game`(`#hs-root` 정상 렌더), `http://localhost:3000/promo` → `http://localhost:3000/`(`302` 리다이렉트) 동작 및 앱 콘솔 에러 `0`건 확인 완료.

## [2026-11-16 11:13 KST] [`/stone.html` (및 `/game.html` 동기화) 상대 턴 진행 멈춤 데드락 및 `자동 ON` 자동플레이 미진행 버그 전수 해결 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 하수인·영웅 공격 직후 `attackLockRef` / `attackAnim` 의존성 누락으로 인한 턴 정지 데드락 해결 (`src/stone/screens/BattleScreen.tsx`, `src/hearthstone/screens/BattleScreen.tsx`)**:
    - 기존 [`src/stone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/BattleScreen.tsx)에서 `triggerPhysicalAttack`이 `0ms`에 `attackLockRef.current = true`를 걸고 `270ms`에 `setMatchState(next)`를 호출할 때 AI/자동플레이 `useEffect`가 `if (attackLockRef.current) return;`으로 조기 종료된 뒤, `500ms`에 `attackLockRef.current = false` 및 `setAttackAnim(null)`이 실행되어도 `useEffect` 의존성 배열에 `attackAnim`이 없어 다음 행동 타이머가 영구히 재등록되지 않던 결정적 데드락을 해결(`attackAnim` 의존성 추가 및 `tImpact` `try...finally` 보장).
  - **2. 1초 밧줄 타이머·배너 해제 리렌더링에 의한 `setTimeout` 취소 원천 차단 (`actionStateKey` 정밀화)**:
    - `matchState` 객체 참조 전체 대신 순수 전투 상태 시그니처(`actionStateKey` / `playerActionStateKey`: `phase`, `activeSide`, `turnNumber`, `history`, `chooseOnePrompt`, `trackingPrompt`, 양측 마나·체력·방어도·공격 횟수·무기·비밀·손패·하수인 세부 상태)만 구독하도록 변경하여 매 1초 `turnSecondsLeft` 감소 및 `bannerMessage`/`errorBanner` 해제 시 진행 중이던 AI/자동플레이 타이머가 취소·초기화되던 현상 제거.
    - [`src/hearthstone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) 내 `playerActionStateKey` 및 Ep0 분기에서 존재하지 않던 필드명(`heroHealth`/`heroArmor`/`attacksRemaining`)을 실제 `PlayerBattleState`/`MinionInstance` 필드(`health`/`armor`/`attacksMadeThisTurn`/`permAttack`/`divineShield`)로 교정하여 천상의 보호막/얼음 방패 타격 직후에도 막힘 없이 진행되도록 보강.
  - **3. 플레이어 `자동 ON` 시뮬레이션 구조 정상화 및 프롬프트·모달 자동 해소 (`src/stone/engine/aiController.ts`, `src/stone/screens/BattleScreen.tsx`)**:
    - 기존 `simStateForPlayer`에서 `player`와 `opponent`를 억지로 뒤바꿔 시뮬레이션하면서 하수인 소유자(`owner`), 비밀, 사냥꾼 `추적`(`DS1_184`), 드루이드 `선택` 카드에서 오작동·멈춤이 발생하던 문제를 해결하기 위해 [`src/stone/engine/aiController.ts`](file:///Users/dayyoung/project/snshero/src/stone/engine/aiController.ts)의 `evaluateStateForAi` 및 `computeNextAiAction`이 `actorSide: 'OPPONENT' | 'PLAYER'`를 직접 지원하도록 개선(유효 대상 없는 선택 주문 제외 및 무진행 후보 필터링 포함).
    - 플레이어 `자동 ON` 상태에서 멀리건(`4코스트 이상` 자동 교체 + 후공 동전 연출 + 멀리건 화면 내 `⚙ 자동플레이 ON/OFF` 버튼 추가), 드루이드 `선택`(`chooseOnePrompt`), 사냥꾼 `추적`(`trackingPrompt`) 팝업까지 모두 자동으로 즉시 해결하도록 구현하고, `자동 ON` 전환 시 열려 있던 카드 확대 모달(`zoomState`)/조준 상태(`selection`)를 자동 해제하며 무진행 예외 발생 시 안전하게 `endTurn()`으로 폴백하도록 방어 로직 추가.
  - **4. 빌드 및 Playwright 다수 턴 실전 교전 검증 · 구글 폼 보고 완료**:
    - `npx tsc --noEmit` 및 `npm run build` 에러 `0`건 통과.
    - Playwright 실브라우저 검증에서 `/stone.html` 사냥꾼 덱으로 멀리건부터 `자동 ON` 활성화 후 5턴 이상 연속 아군/상대 교전·하수인 공격·턴 교대 무정지 진행 및 수동 전환 후 상대 공격 턴 왕복(`manual_opponent_turn_roundtrip_ok: true`, 콘솔/페이지 에러 `0`건), `/game.html` 다수 턴 자동플레이 정상 진행 확인 완료, 로컬 커밋 및 구글 폼 보고 제출 완료.

## [2026-11-16 09:16 KST] [`/stone.html` 오리지널 하스스톤 정밀 고증 업그레이드 및 `/game.html`(눈히어로) 전수 양방향 엔진·연출·UI 동기화 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 게임 엔진(`GameEngine.ts`)·타입(`types.ts`)·60fps 파티클 캔버스(`BoardVfxCanvas.tsx`)·프로시저럴 오디오(`audio.ts`) 정밀 복원 (양쪽 동시 반영)**:
    - [`src/stone/engine/GameEngine.ts`](file:///Users/dayyoung/project/snshero/src/stone/engine/GameEngine.ts), [`src/hearthstone/engine/GameEngine.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/GameEngine.ts): 손패 10장 초과 시 카드 소각(`MILL_BURN`), 덱 소진 시 해골 탈진 피해(`FATIGUE` / `FATIGUE_HIT`), 하수인 소환 충격파(`MINION_SUMMON`), 하수인 사망 파편·영혼 승천(`MINION_DEATH`), 빙결 결정 파편(`FREEZE_SHARD`), 독성 즉사 맹독(`POISON_VENOM`), 상대편 비밀 비공개 마스킹(`isHiddenSecret: side === 'OPPONENT'`) 정밀 구현.
    - [`src/stone/vfx/BoardVfxCanvas.tsx`](file:///Users/dayyoung/project/snshero/src/stone/vfx/BoardVfxCanvas.tsx), [`src/hearthstone/vfx/BoardVfxCanvas.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/vfx/BoardVfxCanvas.tsx): 하수인 사망 직전 DOM 좌표 캐시 연동, `SKULL` 해골 배지, 12종 신규 VFX(투석기 포물선 바위 발사 `TOY_CATAPULT`, 종 파동 `TOY_BELL`, 순무/황금 영초 수확 `TOY_RADISH`, 북 `TOY_DRUM`, 대장간 불꽃 `TOY_SPARKS`, 물보라 `TOY_SPLASH` 포함) 렌더링 추가.
    - [`src/stone/audio.ts`](file:///Users/dayyoung/project/snshero/src/stone/audio.ts), [`src/hearthstone/audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts): `DEATH_CRACK`, `CARD_BURN`, `POISON` 및 5종 전장 기물 전용 WebAudio 효과음 합성 추가.
  - **2. 대전 전장(`BattleScreen.tsx`, `CardVisual.tsx`, `hearthstone.css`) 오리지널 하스스톤 상호작용 및 연출 완성**:
    - [`src/stone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/BattleScreen.tsx), [`src/hearthstone/screens/BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx):
      - **좌측 대형 카드 공개 쇼케이스(`playedCardShowcase`)**: 상대 하수인/주문/무기 사용(`PLAY_MINION` · `CAST_SPELL` · `EQUIP_WEAPON`), 상대 비공개 비밀 시전(`?` 비밀 카드), 비밀 발동(`SECRET_TRIGGER`), 덱 고갈 탈진(`☠` 탈진 카드), 손패 10장 초과 소각(`🔥` 불타는 카드) 전수 연동 및 상대 비밀 발동 전 정체 완벽 은닉(행동 기록·툴팁·모달 전체 보호).
      - **포인터 드래그 앤 드롭 전투(`/game.html` `#hs-stage-canvas` 스케일 좌표 동기화 포함)**: 손패 카드를 전장으로 드래그해 원하는 슬롯(`여기 배치` / `소환 위치`)에 즉시 소환하거나 대상에게 드래그 시전, 아군 하수인·영웅·영웅 능력 드래그 조준 공격(단순 클릭 시 확대 모달 `CardZoomModal` 병행 유지), 손패 호버 시 우측 하단 마나 수정 소모 예정 개수 점멸 미리보기, 덱→손패 드로우 비행 연출.
      - **1클릭 멀리건(`✕` 교체 스탬프) & 2단계 교체 애니메이션**: 카드 클릭 즉시 `✕` 교체 토글(`카드 확대` 보조 버튼 및 우클릭 확대 지원) + 확인 클릭 시 교체 카드 뒤집힘 퇴장(`hsMulliganSwapOut`) → 새 카드 드로우 비행 → 후공 보너스 카드(`동전 한 닢` / `엘윈의 은화`) 쇼케이스.
      - **6방향 방사형 말풍선 감정표현 & 상대 차단(`Squelch`)**: 영웅 좌우 3개씩 펼쳐지는 정통 6개 말풍선(`감사/칭찬/인사` · `감탄/실수/위협`), 상대 영웅 우클릭/클릭 시 `🔇 차단` / `🔊 차단 해제` 토글 및 `차단됨` 배지, 플레이 오류 시 영웅 말풍선 + 성우 대사 연동, 4코너 전장 기물 물리 인터랙션(판다리아 황금 순무 / 바람 신전 황금 영초 이스터에그 포함), 덱 스택 호버 상태 팝오버, 밧줄 도화선 불꽃(`hsRopeSpark`), 문장형 턴 전환 배너, 모바일 한국어 `턴 종료` 라벨 보정.
  - **3. 덱 선택 및 카드첩(`HeroDeckSelectScreen.tsx`, `CollectionScreen.tsx`) `0~7+` 마나 커브 히스토그램 및 카드 유형 통계 추가**:
    - [`src/stone/screens/HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/HeroDeckSelectScreen.tsx), [`src/hearthstone/screens/HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx), [`src/stone/screens/CollectionScreen.tsx`](file:///Users/dayyoung/project/snshero/src/stone/screens/CollectionScreen.tsx), [`src/hearthstone/screens/CollectionScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/CollectionScreen.tsx): 선택/편집 중인 덱의 `0~7+` 실시간 마나 커브 막대 그래프 및 `하수인 · 주문 · 무기` 구성 비율 표시 추가.
  - **4. 거버넌스 준수 · 프로덕션 빌드 · Playwright E2E 검증 · 구글 폼 보고 완료**:
    - 수집 가능 카드 수 **382장** 엄격 동결 확인(`stone: 382`, `game: 382`), `/stone.html` 100% 무료 및 로컬스토리지/에셋 격리(`stone_hs_*` vs `hero_hs_*`) 100% 준수, `npx tsc --noEmit` 및 `npm run build` 에러 0건 통과, Playwright 데스크톱(`1440×900`)·모바일(`390×844`) 전 기능 검증 및 콘솔/런타임 에러 `0`건 확인, 로컬 git 커밋 및 구글 폼 보고서 제출 완료.

## [2026-11-15 09:36 KST] [`/stone.html` 및 `/game.html` 카드 확대 모달(`CardZoomModal`) 좌우 스와이프·이동 버튼·키보드 조작 및 카드첩 382장 전체 순회 네비게이션 구현 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 카드 확대 모달 좌우 이동 UI·터치 스와이프·키보드 조작 구현 (`src/stone/components/CardZoomModal.tsx`, `src/hearthstone/components/CardZoomModal.tsx`)**:
    - 확대된 `LG` 카드 좌우에 황동 원형 이동 버튼(`‹` / `›`, 44px+ 모바일 원핸드 터치 타깃) 및 현재 위치 카운터 배지(`직업/진영 · N / 전체`) 추가.
    - 포인터/터치 수평 드래그 스와이프(`38px` 임계값, 드래그 추종 오프셋 + 슬라이드 전환 애니메이션, 스와이프 직후 배경 클릭 닫힘 오작동 차단 가드) 및 키보드 `ArrowLeft`/`ArrowRight`, `A`/`D` 방향 전환 지원.
  - **2. 카드첩(`CollectionScreen.tsx`) 382장 전체 카드 무경계 이동 및 탭·페이지 실시간 동기화 (`src/stone/screens/CollectionScreen.tsx`, `src/hearthstone/screens/CollectionScreen.tsx`)**:
    - 단일 직업 탭(25장) 경계를 넘어 9개 직업 + 중립 전수 **382장 전체**(덱 편집 중에는 해당 직업 + 중립 전체, 필터 적용 시 필터 결과 전체)를 순환 이동 가능하도록 `allNavigableCards` 및 `navigateToInspectCard` 구현.
    - 이전/다음 카드로 이동할 때 카드첩 하단 직업 탭(`activeTab`)과 바인더 페이지(`page`)가 해당 카드가 위치한 페이지로 자동 동기화되며, 덱 편집 중 `[덱에 카드 넣기]` / `[덱에서 1장 빼기]` 실행 시 모달이 닫히지 않고(30/30 완성 시에만 자동 닫힘) 연속 편성 및 옆 카드 이동 가능.
  - **3. 팩 개봉(`PackOpeningScreen.tsx`) 및 대전 전장(`BattleScreen.tsx`) 모든 확대 카드 뷰 연동**:
    - 팩 개봉 화면에서 뒤집힌 개봉 카드들 간 좌우 스와이프/버튼 이동 지원.
    - 대전 중 내 손패(`HAND_CARD`), 멀리건 시작 손패(`MULLIGAN_CARD`), 선택 효과(`CHOOSE_ONE_CARD`), 추적 카드(`TRACKING_CARD`), 전장 하수인(`BOARD_MINION`), 전투 기록(`HISTORY_ITEM`) 전 영역에서 좌우 이동 지원.
  - **4. 검증 및 구글 폼 보고 완료**:
    - 382장 카드 동결 원칙 및 `/stone.html` 무료 원칙 100% 준수, `npx tsc --noEmit` 및 `npm run build` 에러 0건 통과, Playwright E2E 검증(`1 / 382` ➔ `2 / 382` ➔ `382 / 382` 탭 경계 순환·터치 스와이프·키보드 전환·콘솔 에러 0건) 완료, 로컬 git 커밋 및 구글 폼 제출 완료.

## [2026-11-15 07:57 KST] [`/sns` 페이지 접속 불가 원인 전수 해결 — macOS 듀얼스택(`::`) IPv6/IPv4 바인딩, 절대경로/SW 자동갱신 및 정적 호스팅 404/대소문자 라우팅 보강 완료]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 로컬 프리뷰/개발 서버(`localhost:3000`) IPv6 `[::1]` 접속 거부 수정 (`scripts/start-server.sh`, `vite.config.ts`)**:
    - 기존 `--host 0.0.0.0` 설정이 IPv4 소켓만 바인딩하여 macOS `/etc/hosts`(`::1 localhost`) 환경에서 IPv6 우선 연결 시 접속이 거부되던 문제를 `--host ::` (듀얼스택 IPv6 + IPv4 동시 리스닝)로 전환하여 `http://[::1]:3000/sns`, `http://127.0.0.1:3000/sns`, `http://localhost:3000/sns`, LAN/Tailscale 전 경로 `HTTP 200` 즉시 응답 보장.
    - `MPA_REWRITES` 대소문자 무관 정규화(`/sns`, `/sns/`, `/SNS`) 및 `index.html`의 `#sns` 해시 리다이렉트 지원 추가.
  - **2. 정적 호스팅(`snshero.com`) 및 구버전 서비스워커 캐시 간섭 차단 (`sns.html`, `scripts/post-build.js`, `public/sitemap.xml`)**:
    - `sns.html` 로드 시 최신 `/sw.js`(`updateViaCache: 'none'`) 즉시 강제 업데이트 등록 추가.
    - `scripts/post-build.js`에서 `./favicon.png`, `./hs-assets/` 상대경로를 루트 절대경로(`/favicon.png`, `/hs-assets/`)로 일괄 보정하여 `/sns/` 슬래시 경로에서도 깨짐 원천 차단.
    - 정적 GitHub Pages 환경에서도 `/mcp`, `/mcp/guide.md` 진입 시 404 대신 안내 문서가 응답하도록 `dist/mcp/` 미러링 및 대소문자/하위경로 자동 복구용 `dist/404.html` 라우터 생성, `public/sitemap.xml`에 `https://snshero.com/sns` 등록 완료.
  - **3. 검증 및 구글 폼 보고 완료**:
    - `npx tsc --noEmit` 및 `npm run build` 무결성 통과, IPv6/IPv4/대소문자/트레일링 슬래시 전 경로 `200 OK` 검증, 로컬 git 커밋 및 구글 폼 제출 완료.

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
  - **4. AI 전달용 공식 가이드(`/mcp/guide.md` · `public/mcp-guide.md`) 및 원클릭 프롬프트 복사 기능 보강**:
    - AI 에이전트가 URL 하나만 읽고 즉시 JSON-RPC 호출 순서를 이해할 수 있도록 `/mcp/guide.md` 엔드포인트와 `/sns` `[04] /mcp 서버 연동` 탭 상단 원클릭 프롬프트 복사 패널 추가 완료.

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

## [2026-11-16 13:15 KST] [382장 전체 카드 `stone.html` 디자인·설명 계승 전면 개편 및 『갈바테인: 모험가 길드 사무소』 화풍 405종 카드 일러스트 전수 신규 생성·적용]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 기존 컷아웃 전용 카드 매핑 전면 폐기 및 `stone.html` 정통 카드 디자인·효과 설명 계승**:
    - 캐릭터 컷아웃만으로 주문·무기·스킬 카드를 표현해 발생하던 이름·설명·디자인 불일치를 근본적으로 해결하기 위해 `game.html`([`classic-cards.json`](file:///Users/dayyoung/project/snshero/public/hs-assets/data/classic-cards.json)) 382장 수집 카드 및 123종 토큰을 `stone.html`의 원본 카드 구성(주문 151장 · 하수인 219장 · 무기 12장)과 능력 텍스트에 100% 정렬하여 전면 재설계 (`stone.html` 원본 코드·에셋 무변경 원칙 엄수).
    - **9대 눈히어로 종족 ↔ 직업 매핑 (각 25장 = 225장)**:
      - `물종족(MAGE)`: `신비한 화살` → `마법 물보라`, `얼음창` → `물의 창`, `화염구` → `심해 수압구` 등 물·파도·빙결 정령 개성 반영.
      - `불종족(WARRIOR)`: `내면의 불꽃`, `적열 단조!`, `이글거리는 염화도끼`, `태양신검 프로미넌스` 등 화염·용암 정령 개성 반영.
      - `바람종족(HUNTER)`: `돌풍의 표적`, `천공 섬광탄`, `진공 바람화살`, `독수리 풍각궁` 등 기류·폭풍 정령 개성 반영.
      - `땅종족(PALADIN)`: `대지의 겸손`, `반사 수정결계`, `신성한 대지진`, `오리하르콘 축복검` 등 암석·수정 정령 개성 반영.
      - `인간종족(PRIEST)`: `설원 치유의 진`, `수호의 눈꽃방패`, `새벽별 성광폭발` 등 라이트헤븐·엘윈마을 성광·전술 개성 반영.
      - `언데드종족(ROGUE)`: `망령 그림자밟기`, `무덤 기습`, `맹독 사체독액`, `원혼 절멸비수` 및 해골·구울·맹독거미·누더기골렘 괴물 특성 반영.
      - `엘프종족(SHAMAN)`: `실반 선인의 치유`, `정령석 공명`, `초승달 갈래번개`, `초승달 천둥망치` 등 달빛 실반 엘프 개성 반영.
      - `드워프종족(WARLOCK)`: `용광로 영혼화염`, `보일러 한계돌파`, `지하 화산분출`, `황금거신 아이언포지` 등 딥포지 대장간·화약 개성 반영.
      - `동물종족(DRUID)`: `은월 야수섬광`, `설원랑 할퀴기`, `백수의 대포효`, `거대곰 휘둘러치기` 등 야성 수인·영수 동물성 반영.
    - **중립 157장 (`NEUTRAL`)**: 원본 하스스톤 카드 디자인·역할을 유지하면서 『눈히어로』 세계관과 충돌 없는 독창적 이름·설명으로 전면 신규 구성.
    - **캐릭터 배정**: 웹툰 출연 **34명 전원 최우선 배정 완료(34/34명, 100%)** 및 나머지 하수인 슬롯에 [`cardDatabase.ts`](file:///Users/dayyoung/project/snshero/src/cardDatabase.ts) 캐릭터(총 219명 고유 배정) 골고루 반영.
  - **2. 『갈바테인: 모험가 길드 사무소』 화풍 `3x3` 그리드 45장(총 405컷) 전수 생성 및 `384x384 WEBP` 적용**:
    - 여성 캐릭터는 종족별 글래머러스하고 섹시한 전투 복장·특수 무기로, 남성·괴수 캐릭터는 근육질 체형과 개성 있는 갑주·특수 무기로 표현한 `1024x1024` `3x3` 그리드 시트 45장 생성 후 흑색 구분선 자동 감지 슬라이싱으로 **405개**(`382` 수집 카드 + `23` 핵심 소환 토큰) 고해상도 풀프레임 카드 일러스트([`public/hs-assets/cards/class/`](file:///Users/dayyoung/project/snshero/public/hs-assets/cards/class), [`neutral/`](file:///Users/dayyoung/project/snshero/public/hs-assets/cards/neutral), [`tokens/`](file:///Users/dayyoung/project/snshero/public/hs-assets/cards/tokens)) 생성·반영 완료 (미싱 에셋 `0건`, 잔여 컷아웃 참조 `0건`).
    - [`CardZoomModal.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardZoomModal.tsx) 주문/무기 확대 시 중복 명칭 배지 노출 방지 개선.
  - **3. 빌드 검증 및 구글 폼 보고**:
    - `npm run build` 정상 완료 (`5.46s`, 에러 `0건`).
    - 로컬 커밋 및 연동 구글 폼 작업 완료 보고 제출 완료.

## [2026-11-16 15:12 KST] [전체화면 우측하단 2등신 『카단 챗봇』 개발(좌우 살피기·달리기 8프레임 스프라이트) 및 전 모드 시작 시 자동플레이 기본 중지 적용]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 2등신(SD Chibi) 카단 애니메이션 프레임 8종(`idle` 4컷 + `run` 4컷) 크로마키 생성 및 정밀 투명화**:
    - `#FF00AA` 핫핑크 크로마키 배경과 폐곡선 흑색 선화로 2등신 눈히어로 카단(눈꽃 방패 · 은빛 룬 단검 · 붉은 머플러) 스프라이트 시트 2종 생성 후 발 위치 기준선 정렬 및 마젠타 디스필 처리를 거쳐 투명 `RGBA WEBP` 8프레임([`idle_01~04.webp`](file:///Users/dayyoung/project/snshero/public/hs-assets/kadan-bot/idle_01.webp), [`run_01~04.webp`](file:///Users/dayyoung/project/snshero/public/hs-assets/kadan-bot/run_01.webp)) 저장 완료.
  - **2. 전 게임 모드 시작 시 자동플레이 기본 중지(`OFF`) 전환**:
    - [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx), [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx), [`storage.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/storage.ts)에서 스토리모드(제0화~40화)·랭킹대전·일반전·AI대전 등 어떤 모드로 시작하든 자동플레이가 기본 `false`(중지)로 시작하며 전투 종료 시에도 자동플레이가 해제되도록 통일.
  - **3. 우측하단 인터랙티브 2등신 카단 챗봇([`KadanChatbotWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/KadanChatbotWidget.tsx)) 구현**:
    - 전체화면 우측하단 상시 노출(`/game` 전 화면 및 `/` 메인 쇼케이스 [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) 연동).
    - **정지 상태(가만히 서서 좌우 살피는 카단)** 클릭 시: 현재 화면(전투 실시간 손패·마나·공격 추천, 카드첩 덱 구성·제작, 카드팩 개봉 3배 각성, 영웅 선택 종족 가이드, 로비 길 안내) 맞춤 도움말 메뉴 표시 ➔ 항목 클릭 시 카단 대사 코칭 또는 해당 화면 즉시 이동.
    - **`⚡ 자동플레이 해줘.` 클릭 시**: 카단이 즉시 **달리기 애니메이션 모드**로 변경되며 자동플레이 전환(비전투 화면에서는 즉시 전장 진입 + 자동플레이 가동).
    - **달리는 카단 클릭 시**: 자동플레이 즉시 중지 및 가만히 서서 좌우 살피는 카단으로 복귀 ➔ 다시 클릭 시 도움말 메뉴 재표시.
  - **4. 빌드·타입 검증 및 구글 폼 보고**:
    - `npx tsc --noEmit` 에러 `0건`, `npm run build` 정상 완료 (`6.88s`).
    - 로컬 커밋 및 연동 구글 폼 작업 완료 보고 제출 완료.

## [2026-11-16 15:43 KST] [스토리모드 캐릭터 대사 『동물의 숲』 스타일 한글자씩 타이핑 + 음성 효과음 합성 + 클릭 전체표시·자동진행 + 종료 후 자동플레이/게임 시작화면 분기 구현]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 『동물의 숲(Animalese)』 스타일 글자 단위 음성 효과음 신디사이저 추가 ([`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts))**:
    - `hsAudio.playAnimaleseBlip()` 구현: 화자 성별·개성(실리아/엘윈 등 밝은 여성 톤 `445Hz`, 카단/로비냐드 등 주인공 톤 `358Hz`, 허수아비 로봇 기계 톤 `315Hz`, 벨페고르/아르투스 등 중저음 보스 톤 `232Hz`)과 한글 중성(모음 `ㅏ·ㅐ·ㅣ` vs `ㅗ·ㅜ·ㅡ·ㅓ`) 포먼트 필터 및 물음표(`?`) 억양 상승을 결합해 글자마다 귀엽고 따뜻한 음성 블립 효과음 재생.
  - **2. 스토리모드 대사 한글자씩 표시 · 클릭 시 전체 표시 후 이동 · 자동 다음 대사 진행 ([`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx))**:
    - `useAnimaleseTypewriter` 훅을 전투 시작 전 교차 대사(`StoryDuelDialogueOverlay`)와 승리 대사(`StoryVictorySceneOverlay`)에 공통 적용.
    - 대사 출력 중 캐릭터 상반신 컷아웃 미세 토킹 바운스 모션 및 말풍선 높이 흔들림 방지 레이아웃 적용.
    - 타이핑 중 클릭 시 전체 문장을 한 번에 표시하고 잠시 후(`750ms`) 다음 대사로 자동 이동하며, 클릭하지 않아도 대사 완료 후(`1,150ms`) 다음 대사로 자연스럽게 자동 진행.
  - **3. 대사 종료 시 자동플레이 상태별 분기 처리 ([`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx), [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx))**:
    - **자동플레이가 켜져 있었다면(`autoPlay === true`)**: 대사 완료 즉시 초기 손패 멀리건을 자동 완료하고 바로 **계속 자동플레이**로 진입하며, 스토리모드 승리/다음 화 이동 시에도 자동플레이 상태를 연속 유지.
    - **자동플레이가 꺼져 있었다면(`autoPlay === false`)**: 대사 완료 후 **`⚔ 게임 시작화면`**(시작 카드 선택 + `[게임 시작 (전투 개시)]` 화면)으로 이동하여 수동 시작 대기.
  - **4. 빌드·타입 검증 및 구글 폼 보고**:
    - `npx tsc --noEmit` 에러 `0건`, `npm run build` 정상 완료 (`18.52s`).
    - 로컬 커밋 및 연동 구글 폼 작업 완료 보고 제출 완료.


## [2026-11-16 16:50 KST] [27차 라이브 점검 마스터 시트(BLD-2701~BLD-2712) 전수 확인·수정·빌드/Playwright 검증 및 시트 완료 처리]
- **작업자**: `Antigravity Assistant`
- **대상 시트**: `1wiklEr79bqts1CZdI-lyVP9CmQ8L7JSMZXGWqBU5ZbU` (`SNSHero.com 라이브 페이지 개발개선점 점검 마스터 시트`)
- **작업 개요**:
  - **1. 메인 게임 (`snshero.com/game`, BLD-2701~2704)**:
    - [`classic-cards.json`](file:///Users/dayyoung/project/snshero/public/hs-assets/data/classic-cards.json), [`cardEffects.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/cardEffects.ts): 영문 원작 카드명·로어 전수 치환(382장+토큰), `CS2_101t` 대지 성채 수호병 메타 교정, `CS2_050` 실반 불꽃 정령석 설명란 추가.
    - [`GameEngine.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/engine/GameEngine.ts), [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx), [`CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx), [`pwaFullscreen.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/pwaFullscreen.ts): 포세이돈 영웅 능력 자해 방지 가드(`allowFriendlyHeroTarget: false`), 무기 슬롯 배지 `overflow-visible`/`z-30` 클리핑 해소, 손패 1탭 선택·더블탭 즉시 사용·드래그 배치, 승리/패배 모달 SVG 닫기 아이콘 교체, Fullscreen API 옵션 폴백 적용.
    - [`CollectionScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/CollectionScreen.tsx), [`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx): 보유 ×3 카드 `⚡3배 각성` 배지 및 개별 `마력 추출` 3배 각성 해제 경고 모달 추가, 30장 미만 덱 완료 시 `[자동 완성]` 프롬프트 모달, 전 진영 통합 검색, 설정 내 커스텀 `코드 붙여넣기` 텍스트 모달 및 `/game 전용` 표기 정규화.
  - **2. 프로모션 (`snshero.com/`, BLD-2705~2707)**:
    - [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx), [`CardVisual.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardVisual.tsx): 장문 카드 설명(`line-clamp-5` 및 폰트 스케일) 잘림 완화, 9종족 덱 플레이 `?faction=` 및 4대 보스 `?ep=` 딥링크 연동, `#universe` `/book.html`·`/webtoon.html` 문구/경로 정규화, `#cards` 마나 코스트(0~7+) 필터·검색 초기화(X) 추가, `#latest` 이미지 `key` 바인딩, `#modes` 한국어 랭킹대전 실측 스크린샷([`ingame_ranked_battle_ko.png`](file:///Users/dayyoung/project/snshero/public/hs-assets/screenshots/ingame_ranked_battle_ko.png)) 캡처 및 적용.
  - **3. 공식 웹소설·웹툰 (`book.html`, `webtoon`, BLD-2708~2712)**:
    - [`episodes.json`](file:///Users/dayyoung/project/snshero/src/content/episodes.json), [`kadanRpgStory.ts`](file:///Users/dayyoung/project/snshero/src/content/kadanRpgStory.ts), [`BookSection.tsx`](file:///Users/dayyoung/project/snshero/src/reader/BookSection.tsx), [`bookMain.ts`](file:///Users/dayyoung/project/snshero/src/reader/bookMain.ts), [`WebtoonSection.tsx`](file:///Users/dayyoung/project/snshero/src/reader/WebtoonSection.tsx), [`webtoonMain.ts`](file:///Users/dayyoung/project/snshero/src/reader/webtoonMain.ts): 1~40화 단일 제목 스키마 통합, `구름 돌아오는 장원` 띄어쓰기 교정, 웹소설 목차 모달 백드롭/ESC 닫기, 웹소설·웹툰 40화 완결편 재시작 분기 및 상호 브릿지(`/webtoon?ep=N`, `/book.html?ep=N`, `/game?mode=story&ep=N`) CTA 추가, 웹툰 키보드 좌우/ESC 제어 강화.
  - **4. 검증 및 시트 완료 처리**:
    - `npx tsc --noEmit`, `npm run build` 성공 및 헤드리스 Chromium Playwright 통합 검증 통과(페이지 오류 0건).
    - 구글 시트 `개발개선점 상세`(`K4:L16`) 및 `4대페이지 기능별 실측판정`(`I10:I72`) 전수 완료 처리 및 로컬 커밋·구글 폼 보고 완료.

## [2026-11-16 17:29 KST] [스토리모드 대사 화면(전투 전·승리 대사) 캐릭터 상반신 키 높이 화면 절반 이상(68%~80%) 확대 적용]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 스토리모드 대사 화면 캐릭터 상반신 비율 대폭 확대 ([`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx))**:
    - 기존 `max-h-[48%]`(`38%~47%`) 제한을 제거하고, 전투 전 교차 대사(`StoryDuelDialogueOverlay`)는 모바일 **`68%`** · 데스크톱 **`78%`**, 승리 대사(`StoryVictorySceneOverlay`)는 모바일 **`70%`** · 데스크톱 **`80%`** 높이로 상반신이 화면의 절반을 훌쩍 넘어 시원하게 꽉 차도록 확대.
    - 7등신 전신 컷아웃(`/characters/cutouts/*.webp`)은 내부 `h-[168%]` 및 상단 정렬(`items-start`)로 정수리부터 허리·골반까지 큼직한 상반신이 표시되도록 조정하고, `kadan_upper.webp`의 상단 `18.6%` 투명 여백은 `h-[122%]`로 보정하여 제0화 허수아비 로봇 및 제1~40화 전 캐릭터의 시각적 키 높이를 일관되게 통일.
    - 컨테이너 `overflow-hidden`으로 인한 외곽 스티커 테두리 잘림 현상을 해소하고 `transformOrigin: 'bottom center'` 및 `-bottom-2.5` 앵커링으로 토킹 바운스 시에도 하단 절단선이 노출되지 않도록 마감.
  - **2. 빌드·타입 검증 및 구글 폼 보고**:
    - `npx tsc --noEmit` 에러 `0건`, `npm run build` 정상 완료 (`8.07s`).
    - 로컬 커밋 및 연동 구글 폼 작업 완료 보고 제출 완료.

## [2026-11-16 20:33 KST] [모바일 iOS Safari(`/game`) 플레이 중 『문제가 반복적으로 발생했습니다』 WebKit 프로세스 크래시(GPU/메모리/MutationObserver/WebAudio 누수) 5대 원인 전수 해결]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. AdSense `MutationObserver` 마이크로태스크 폭주 및 스타일 핑퐁 루프 차단 ([`adsenseManager.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/services/adsenseManager.ts))**:
    - `document.body`에 `subtree: true, attributeFilter: ['style']`이 등록되어 게임 플레이 중 매 프레임(대사 바운스·카드 드래그·공격 연출)마다 전체 DOM `querySelectorAll` 순회와 AdSense `aswift_*` 인라인 `style` 재변이가 반복되던 치명적 CPU/메모리 루프를 제거 (`subtree: false`, `attributeFilter: ['aria-hidden', 'class']`, `350ms` 스로틀링 및 값 변경 시에만 `setProperty` 호출).
  - **2. 대사 화면 5중 중첩 `drop-shadow` + `backdrop-blur` Metal GPU VRAM 폭발 해소 ([`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx))**:
    - `@3x` 아이폰 Retina 해상도의 대형 상반신 레이어 2개에 각각 5중 `drop-shadow`와 전면 `backdrop-blur`가 중첩되어 약 `250~360MB`의 오프스크린 GPU 텍스처를 점유하던 문제를 단일 패스 `drop-shadow` 및 불투명 시네마 암전(`bg-black/62`, `bg-black/68`)으로 경량화.
  - **3. iOS WebKit `AudioContext` 노드 그래프 누수 및 `HTMLAudioElement`(`AVPlayer`) 디코더 고갈 방지 ([`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts))**:
    - `playAnimaleseBlip` 및 `playProceduralVfxSound` 종료(`onended`) 시 모든 `OscillatorNode`·`BiquadFilterNode`·`GainNode`를 즉시 `disconnect()`하고 `38ms` 간격 가드를 추가.
    - `playSfx` 및 `playCustomVoUrl` 종료 시 `a.pause(); a.src = '';`로 iOS 네이티브 미디어 디코더를 즉시 반환하고 동시 활성 SFX 상한(`<= 10`) 및 `decodedVoBufferCache` 상한(`<= 16`) 적용.
  - **4. 턴 타이머 매초 전체 앱 리렌더 차단·코스트 `NaN` 수정 및 2등신 카단 무디코딩 프레임 전환 ([`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx), [`KadanChatbotWidget.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/KadanChatbotWidget.tsx), [`GameAdSenseLayout.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/GameAdSenseLayout.tsx))**:
    - 1초마다 감소하는 `turnSecondsLeft`에 의해 `setBattleSnapshot`이 매초 전체 앱 트리를 리렌더하던 현상을 전황 스냅샷 키 게이팅으로 차단하고 `hc.costMod` 계산 오류 수정.
    - `KadanChatbotWidget`이 자동플레이 중 `<img src>`를 교체하며 WebP 재디코딩을 유발하던 구조를 4프레임 사전 마운트 `opacity` 전환으로 변경하고, `GameAdSenseLayout`의 동일 치수 `setStageMetrics` 객체 재생성을 차단.
  - **5. 빌드·타입 검증 및 구글 폼 보고**:
    - `npx tsc --noEmit` 에러 `0건`, `npm run build` 정상 완료 (`5.27s`), 포트 `3000` 프리뷰 서버 즉시 반영 완료.
    - 로컬 커밋 및 연동 구글 폼 작업 완료 보고 제출 완료.

## [2026-11-16 20:54 KST] [스토리모드 대사 화면에서 첫 번째 화자만 활성화되고 상대 화자가 비활성화로 고정되던 WebKit CSS 필터 전환 버그 수정 및 원격 푸시]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 대사 교차 시 화자 활성/비활성 전환 고착 버그 근본 해결 ([`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx))**:
    - **원인**: 외곽 컨테이너에서 서로 다른 타입의 CSS `filter`(`drop-shadow(...)` ↔ `brightness(...) saturate(...)`, 불연속 50% 시점 `110ms` 플립)와 `44ms` 주기의 `talkBob` `transform` 인라인 스타일 변경이 같은 엘리먼트에서 충돌하여, WebKit CoreAnimation 레이어가 `110ms` 전환점에 도달하기 전에 매 `44ms`마다 리셋되어 초기 첫 번째 화자만 밝게 고정되고 두 번째 화자는 끝까지 어두운 상태(`비활성화`)로 남던 현상 확인.
    - **해결**: `talkBob`·스케일 `transform`은 외곽 `<div>`에만 두고, 밝기/채도 활성 상태는 내부 `<img>`에만 동일한 함수 시그니처(`brightness(1) saturate(1)` ↔ `brightness(0.36) saturate(0.45)` + `opacity: 1` ↔ `0.72`)로 완전 분리 적용하여 대사 턴이 바뀔 때마다 좌·우 캐릭터 활성화가 즉시 정확히 교차되도록 수정.
    - `useAnimaleseTypewriter`의 `resetKey` 변경 감지를 렌더 단계 동기 리셋으로 보강해 대사 전환 시 잔여 프레임 지연 제거.
  - **2. 빌드·원격 푸시(`/git-push`) 및 구글 폼 보고**:
    - `npx tsc --noEmit` 에러 `0건`, `npm run build` 정상 완료.
    - 로컬 커밋 및 `git push origin main` 원격 배포, 연동 구글 폼 작업 완료 보고 제출 완료.

## [2026-11-18 15:14 KST] [모바일 전장 상단 유틸리티 바 넘침 수정 — 불필요한 기물(Toys)·클린뷰(Clean) 버튼 제거 및 반응형 압축]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 상단 바 불필요 버튼 제거 ([`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx))**:
    - 전장 네 모서리 기물(Toys)과 직접 중복되던 모바일 전용 `기물(Toys)` 버튼과 환경설정(`Modals.tsx`)에 이미 탑재되어 있던 `클린뷰(Clean)` 토글 버튼(및 미사용 `cleanCardView` 상태 동기화)을 상단 유틸리티 바에서 제거.
  - **2. 모바일(`360px`~`430px`) 상단 메뉴 버튼 잘림 방지 반응형 개편 ([`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx))**:
    - 상대 정보 배지(`max-w-[54px] truncate`, 모바일 `💎{mana}/{maxMana}` 표기), 상대 손패(`-space-x-3.5`, `w-4`), 우측 버튼 라벨(`?`, `📖 N화`, `⚙ 메뉴` ↔ 데스크톱 `? 규칙`, `📖 제N화 · 회차/대사`, `⚙ 메뉴 · 항복`)을 반응형으로 압축해 소형 모바일에서도 우측 끝 `⚙ 메뉴` 버튼이 화면 밖으로 밀려나지 않도록 보장.
  - **3. 빌드·Playwright 양방향 검증 및 구글 폼 보고**:
    - `npx tsc --noEmit` 에러 `0건`, `npm run build` 정상 완료 (`14.54s`).
    - Playwright 실측: `360×740`(KO), `390×844`(EN), `1280×800`(KO) 스토리 1화 실전 화면 모두 `battle-top-gear-btn`이 뷰포트 내부에 완전 노출되고 클릭 시 설정 모달이 정상 오픈됨을 확인 (`기물`/`클린뷰` 부재 검증 포함).
    - 로컬 커밋 및 연동 구글 폼 작업 완료 보고 제출 완료.

*(이전 2026-09~10 작업 로그는 기존 원격 저장소 이력에 보관되어 있습니다.)*

## [2026-11-19 09:05 KST] [마케팅 7대 MCP 확장 연동, 웹게임 포털(CrazyGames·itch.io·GDevelop) 과제 추가 및 /checkMarket v2 업그레이드]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 마케팅 MCP 5종 추가 구축 및 `~/.gemini/config/mcp_config.json` 연동 (총 7개 MCP)**:
    - 기존 `analytics-mcp`(GA4 `properties/223457203`), `google-ads-mcp`(`3072359722`) 유지.
    - GCP(`gen-lang-client-0764739742`)에 `searchconsole.googleapis.com`, `indexing.googleapis.com`, `androidpublisher.googleapis.com` API 활성화 완료.
    - 신규 MCP 서버 5종 구축 및 등록: `youtube-snshero-mcp`(`@snshero`, `UCA6QmKiPstbiyBUHtnSMxyA`), `gsc-mcp`(Google Search Console + Indexing API), `google-play-mcp`(`com.dryudryu.SNSHero`), `github-mcp`(`Dayyoung/snshero`), `chrome-devtools-marketing`(영구 프로필 `~/.gemini/config/chrome_marketing_profile`).
    - 보조 스크립트 생성: YouTube 쓰기 권한 확장용 `reauth_full_scope.py`, 커뮤니티·포털 일괄 로그인용 `open_marketing_browser.sh`.
  - **2. 마케팅 시트(`1bpYZA4x0n35jfVgch_lQV2F2y_gQ_0l4a74qgOXwKEU`)에 웹게임 포털 배포 과제 3건 추가**:
    - `MKT-099` (P0): CrazyGames (`https://www.crazygames.com/` · `developer.crazygames.com`) HTML5 포털 전용 빌드 및 정책 준수 심사 제출
    - `MKT-100` (P0): itch.io (`https://itch.io/login`) HTML5 iframe zip 빌드·커버·Devlog 배포
    - `MKT-101` (P1): GDevelop / gd.games (`https://gdevelop.io/` · `gd.games`) 플랫폼 엔진 정책 사전 검증 및 적합 방식 배포
  - **3. `/checkMarket` 스킬 지침서 v2 전면 개정 (`skills/checkMarket/SKILL.md`)**:
    - 7대 MCP 통합 실행 절차, GA4 실측 KPI 검증, 웹게임 포털 배포 파이프라인, **커뮤니티·포털 게시글 등록 전 '정책·공지 사전 분석 3단계' 절대 원칙** 반영 완료.
  - **4. 검증 및 로컬 커밋**:
    - 4종 신규 Python MCP 스모크 테스트 및 MCP JSON-RPC `initialize` 핸드셰이크 통과, `mcp_config.json` 구문 검증 완료.
    - 로컬 `git commit` 완료 (원격 `git push` 보류).

## [2026-11-19 09:38 KST] [/checkMarket 전면 실행 — YouTube 167개 영상·7개 댓글 일괄 교정, GSC 독성 사이트맵 4종 삭제, MKT-078/084/086/087/088/092/093/098 코드 구현 및 웹게임 포털·커뮤니티 정책 분석]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. YouTube (`youtube-snshero-mcp`, `@snshero`) 일괄 교정 완료**:
    - 157개 영상의 12개 국어 설명란에서 구버전 `3x3`·`110종 미션 게임`·깨진 `snshero.com/#webtoon` 링크를 전량 소거하고 에피소드별 직행 링크(`/game?mode=story&ep=N&utm_source=youtube` · `/webtoon.html`)와 현행 382종 웹 TCG 스펙으로 일괄 교체 (`MKT-023`, `MKT-059`, `MKT-089` 완료).
    - 10개 `#PRISMLiveStudio` 라이브 아카이브(`Yi_fvtVjKk4`, `eMP2oz_syuE` 외 8건) 제목·설명 전면 교체 (`MKT-032` 완료).
    - 최상위 조회수 7개 영상(`55vgWkvuLLE` EP06 356뷰, `k2ZER1xjl2E`, `vvGqNI1kwXQ`, `GA46xr2mgMY`, `vbDbsSmpGYc`, `q6-w_dz8Hbs`, `uEXB-kGnfPk` EP31)에 에피소드·보가트 도박장 브릿지 댓글 등록 완료 (`MKT-041`, `MKT-065` 완료).
  - **2. Google Search Console (`gsc-mcp`, `sc-domain:snshero.com`) 정리 완료**:
    - `/reddit`·`/r/news/*` 구버전 뉴스룸 오염원이던 독성 레거시 사이트맵 4종(`news-feed.xml`, `news-feed.xml?v=2`, `sitemap-news.xml`, `sitemap.xml?v=2`)을 GSC에서 완전 삭제하고 정식 `https://snshero.com/sitemap.xml` 재제출(에러 0건) 및 `/`, `/game`, `/book.html`, `/webtoon.html` 색인 `PASS` 확인 (`MKT-001`, `MKT-014`, `MKT-026`, `MKT-098` 완료).
  - **3. 소스코드 개선 및 빌드·Playwright E2E 검증 완료**:
    - [`public/404.html`](file:///Users/dayyoung/project/snshero/public/404.html) 신설(`/reddit`, `/r/**` `noindex, nofollow` + `/` 리다이렉트), [`index.html`](file:///Users/dayyoung/project/snshero/index.html)·[`game.html`](file:///Users/dayyoung/project/snshero/game.html)·[`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) 한글 SEO 디렉토리 블록(`#kr-official-directory`, `#kr-seo-overview`) 및 3대 모드 한글 병기·`alt` 정리 (`MKT-086`, `MKT-092`, `MKT-098`).
    - [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx)·[`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx): `Story Mode` 링크를 `/game?mode=story&ep=1&theater=on`으로 분리해 `EP.0 튜토리얼`과 역할 구분 및 중·후반 프리뷰 체크포인트 안내 보강 (`MKT-088`, `MKT-093`).
    - [`StoryEncounterOverlays.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/StoryEncounterOverlays.tsx)·[`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx): `invisible` 중복 스팬 3곳 제거로 제0화·스토리 대사 이중 중첩/잘림 DOM 버그 완전 해결 및 `[📖 원작 소설]` 직행 링크 탑재 (`MKT-087`, `MKT-088`).
    - [`paymentGateway.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/paymentGateway.ts)·[`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx): 광고제거 상품을 `엘윈 성소 후원 VIP 패스`로 한·영 리패키징 (`MKT-078`).
    - `npx tsc --noEmit && npm run build` 통과(`4.12s`), Python Playwright 데스크톱(`1280×800`)·모바일(`390×844`) 한·영 5개 시나리오 에러 0건·가로 넘침 0건·중복 대사 스팬 0건 통과.
  - **4. 웹게임 포털(CrazyGames·itch.io·GDevelop/gd.games) & 커뮤니티 정책 사전 분석 완료**:
    - CrazyGames(외부 광고·결제·이탈링크·풀스크린 버튼 금지, Basic/Full 2단계), itch.io(루트 `index.html`+상대경로 zip+Devlog), GDevelop/gd.games(GDevelop 엔진 제작물 전용 정책 확인 — 외부 Vite 빌드 업로드 불가), Reddit 90/10 규칙 및 GeekNews/Disquiet/인벤 가이드라인 정리.
  - **5. 구글 시트 정규화 및 일괄 최신화**:
    - 85~99행(`MKT-084`~`MKT-098`) 밀린 컬럼 15건 표준 11열 스키마로 복구, 총 **17건 추가 `완료`** 처리 및 `MKT-088` `진행중` 전환. 로컬 `git commit` 완료 (원격 `git push` 보류).

## [2026-11-19 09:50 KST] [MKT-075 전투 KO/EN 1탭 토글, MKT-090 랭킹 3승 스탬프·9종족 AI 배지, MKT-099/100 CrazyGames·itch.io HTML5 포털 ZIP 패키저 구축]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 전투 상단 바 1탭 `KO/EN` 토글 (`MKT-075`) & 랭킹 3승 스탬프 / 9종족 숙련 AI 배지 (`MKT-090`)**:
    - [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx): 전장 상단 유틸리티 바에 모바일 안전(`390×844` 우측 넘침 0px 검증) `EN/한` 1탭 언어 토글(`battle-top-lang-btn`) 추가 및 CrazyGames SDK 라이프사이클 훅(`portalGameplayStart`/`portalGameplayStop`) 연동.
    - [`HeroDeckSelectScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/HeroDeckSelectScreen.tsx): 공식 랭킹대전 카드 내 3승 스탬프 진행 바(`1승 +25G · 2승 +50G · 3승 +105G=1팩!`) 및 AI 수련 모드 `9종족 숙련 AI X/9 (+2팩)` 배지 추가.
  - **2. HTML5 웹게임 포털 배포 런타임 & 자동 패키저 구축 (`MKT-099`, `MKT-100`, `MKT-101`)**:
    - [`portalBridge.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/portalBridge.ts) & [`paymentGateway.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/paymentGateway.ts): CrazyGames/itch.io 포털 환경 자동 감지 시 외부 AdSense 배너 전면 차단 및 CrazyGames SDK 이벤트 안전 래핑.
    - [`scripts/build-portal-zips.mjs`](file:///Users/dayyoung/project/snshero/scripts/build-portal-zips.mjs) (`npm run build:portals`):
      - `dist-portals/snshero-itchio.zip` (**939개 파일 / 107.28 MB** — itch.io 1,000파일·500MB 상한 충족, 루트 `index.html`·AdSense 제거)
      - `dist-portals/snshero-crazygames.zip` (**1,271개 파일 / 134.04 MB** — CrazyGames 1,500파일·250MB 상한 충족, SDK v2 포함·AdSense 제거)
      - `dist-portals/PORTAL_SUBMISSION_GUIDE.md` (CrazyGames · itch.io · GDevelop/gd.games 정책 및 등록 메타 가이드 생성)
  - **3. 검증·시트 최신화·로컬 커밋**:
    - `vite build` + `post-build.js` + `build-portal-zips.mjs` 통과, Playwright 데스크톱(`1280×800`)·모바일(`390×844`) 한·영 3개 시나리오 에러 `0건`·가로 넘침 `0건`·우측 메뉴 버튼 잘림 없음 확인.
    - 구글 시트 `MKT-075`, `MKT-090` → `완료`, `MKT-099`, `MKT-100`, `MKT-101` → `진행중` 반영 (대시보드 누적 완료 **48건 / 45.7%**). 로컬 `git commit` 완료 (`git push` 보류).

## [2026-11-19 10:05 KST] [/checkMarket 3차 가속 — YouTube 장편 14편 챕터(MKT-077), 3초 도파민 훅(MKT-103), 6-Step 동적 CTA(MKT-099), 3배 각성 공유(MKT-091), 40화 정적 SEO(MKT-082/083) 완료율 52%+ 돌파]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. YouTube 장편 웹툰 본편 Key Moments 타임스탬프 챕터 삽입 (`MKT-077` → `완료`)**:
    - 최상위 조회수 장편 웹툰 14편(`q6-w_dz8Hbs`, `qFsQnrjnv4E`, `GQ3_HDM-bW8`, `dw8NvSqKxDo` 등)에 4막 타임스탬프 챕터(`00:00`~) LIVE 반영 완료 (금일 YouTube API 할당량 10,000 units 100% 알차게 소진: 총 181개 영상 수정 + 7개 댓글 등록).
  - **2. 프로모션·가이드·도감·웹소설/웹툰 코드 개선**:
    - [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx) & [`OnboardingGuideModal.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/OnboardingGuideModal.tsx): 유튜브 임베드 `origin`+`enablejsapi=1`·`strict-origin-when-cross-origin` 교정, `HowToPlayCarousel` 1~6단계별 동적 게임 직행 CTA 탑재 (`MKT-099` → `완료`), 히어로 3초 도파민 훅 2종(`3장=3배 각성` · `보가트 도박장 2배`) 전면 배치 (`MKT-103` → `진행중`).
    - [`CardZoomModal.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/CardZoomModal.tsx): 3배 각성 카드 1클릭 공유 링크(`?mode=collection&card=ID&awakened=3x`) 버튼 탑재 (`MKT-091` → `진행중`).
    - [`book.html`](file:///Users/dayyoung/project/snshero/book.html) & [`webtoon.html`](file:///Users/dayyoung/project/snshero/webtoon.html): 1~40화 전 회차 정적 `<nav>` 목차 및 보스전(`/game?mode=story&ep=1~40`) 직행 링크 탑재 (`MKT-028`, `MKT-029` → `완료`, `MKT-082`, `MKT-083` → `진행중`).
    - 기존 코드·외부 통합 완료 검증: `MKT-004`(도전만화 `857363` 단일화), `MKT-011`(`/webtoon` SEO + 유튜브 정비), `MKT-053`(성우 풀보이스 오디오 웹툰 모드) → `완료`.
  - **3. 검증·로컬 커밋**:
    - `npm run build` 통과(`12.01s`), Playwright 데스크톱·모바일 4개 시나리오 에러 `0건`·가로 넘침 `0건`·훅/CTA 렌더링 통과. 로컬 `git commit` 완료 (`git push` 보류).

## [2026-11-19 10:16 KST] [7대 MCP 전면 가동 — Google Play 4개국어(EN/KO/JA/ZH) 전면 교체, GitHub 메타/릴리스 v2.1.0/레거시 아카이브, 언어별 커뮤니티 마케팅 원칙 명문화 (완료율 58.1% 돌파)]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. Google Play Store (`google-play-mcp`, `com.dryudryu.SNSHero`) 4개국어 스토어 등록정보 LIVE 커밋 완료**:
    - 구버전 `'1,000 SNS points · Over 110 cute cards'` 문구를 완전 제거하고 `en-US`, `ko-KR`, `ja-JP`, `zh-CN` 4개 언어 모두 현행 **382종 전략 웹 TCG · 무료 3팩+250G · 40화 풀보이스(3장=3배 각성) · 보가트 도박장** 스펙으로 LIVE 커밋 완료 (`MKT-005`, `MKT-008`, `MKT-080` → `완료`).
  - **2. GitHub (`github-mcp`, `Dayyoung/snshero` & `Dayyoung/snshero-board`) LIVE 정비 완료**:
    - `Dayyoung/snshero` About 설명·홈페이지(`https://snshero.com/`)·10개 토픽 태그 갱신, 공식 Release **`v2.1.0`** 발행(`https://github.com/Dayyoung/snshero/releases/tag/v2.1.0`), 구버전 레포 `Dayyoung/snshero-board` 설명 리다이렉트 및 `archived: true` 전환 완료 (`MKT-019`, `MKT-043`, `MKT-091` → `완료`).
  - **3. `/checkMarket` 스킬 (`skills/checkMarket/SKILL.md`) 언어별 커뮤니티 마케팅 원칙 추가**:
    - 각 커뮤니티 주 사용 언어(영어 `?lang=en`, 한국어 `?lang=ko`, 일본어 `?lang=ja`, 중국어 `?lang=zh-CN`/`zh-TW` 등)에 맞춘 원어민 톤 카피 + 대응 `?lang=` 직행 링크 + 해당 언어 스크린샷 매칭 원칙 명문화.
  - **4. 브라우저(`chrome-devtools-marketing`) 세션 점검**:
    - CrazyGames Developer Portal(`SNSHero` 로그인 확인) 제출 페이지 진입 및 6대 사전 체크리스트 통과 확인 (ZIP 업로드 경로는 브라우저에서 직접 드래그앤드롭 안내).
    - 기존 `gd.games` 페이지(`SNSHero.com - Ai Rebellion`, 407 plays) 및 `itch.io`(`snshero.itch.io/game`) 확인 완료; PacPik·문피아·네이버·Reddit·GeekNews·Disquiet·gd.games는 해당 브라우저 프로필 내 로그인 필요 상태 확인.
  - **5. 시트 최신화 및 로컬 커밋**:
    - 구글 시트 대시보드 완료율 **`34.9% (29건)` → `58.1% (61 / 105건)`** (+32건 완료, +23.2%p 상승) 달성. 로컬 `git commit` 완료 (`git push` 보류).

## [2026-11-19 10:21 KST] [/checkMarket 전수 점검 최종 완료 — Google Play 스크린샷 8장(EN/KO) 업로드, MKT-038/044/096 완료 및 105건 전수 감사 (완료율 61.0% 달성)]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. Google Play Store 382종 실플레이 스크린샷 8장(`en-US` 4장 + `ko-KR` 4장) LIVE 업로드 커밋 완료 (`MKT-044` → `완료`)** + [`public/manifest.json`](file:///Users/dayyoung/project/snshero/public/manifest.json) OS 퀵 쇼트컷 3종(`스토리모드` · `랭킹대전` · `공식 웹툰`) 탑재.
  - **2. [`public/robots.txt`](file:///Users/dayyoung/project/snshero/public/robots.txt) 구버전 `/shop/` · `/bench/` 차단 보강 (`MKT-038` → `완료`)**.
  - **3. [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) 전투 종료 모달에 `3배 각성 설계도 & 4대 골드 외형` 직행 스트립 탑재 (`MKT-096` → `완료`)**.
  - **4. 105건 전수 감사 및 시트 최신화**:
    - Row 101(`MKT-100`) 비표준 `'제안 완료'` 스키마 정규화 완료 (비표준 0건).
    - 최종 완료율 **`61.0%` (`64 / 105건` 완료 · `27건` 진행중 · `14건` 실행대기 · `0건` 누락)**. `npm run build` 통과(`6.53s`), 로컬 `git commit` 완료 (`git push` 보류).

## [2026-11-19 10:05 KST] [게임 지원 언어 2개(KO/EN) → 글로벌 10개 언어 전면 확장]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 글로벌 10개 언어 코어 i18n 엔진 고도화 (`src/i18n/`)**:
    - [`heroLang.ts`](file:///Users/dayyoung/project/snshero/src/i18n/heroLang.ts): 기존 `en | ko` 2개 언어에서 **`en`, `ko`, `ja`(日本語), `zh-CN`(简体中文), `zh-TW`(繁體中文), `es`(Español), `fr`(Français), `de`(Deutsch), `pt`(Português), `ru`(Русский)** 총 10개 글로벌 언어로 확장.
    - 브라우저 언어(`navigator.languages`) 자동 감지, URL `?lang=` 및 경로 프리픽스 정규화(`normalizeHeroLanguage`), `localStorage['hero_language']` 영구 저장, Vite 코드 스플리팅 기반 온디맨드 로케일 청크 로딩(`ensureLocaleLoaded`) 및 리렌더링 동기화 구현.
    - [`dynamicPatterns.ts`](file:///Users/dayyoung/project/snshero/src/i18n/dynamicPatterns.ts): `Turn N`, `Rank N`, `Owned: N Gold`, `Open Card Packs (N packs)`, `Left Today N/M`, `Cooldown Ns` 등 동적 템플릿 문자열의 10개 언어 패턴 번역기 구현.
    - `src/i18n/locales/{ja,zh-CN,zh-TW,es,fr,de,pt,ru}.ts`: 8개 신규 언어별 **1,181개 UI 번역 키**(총 9,448개 번역 엔트리)를 판타지 TCG 전문 용어로 완비(청크당 ~30–35kB gzip).
  - **2. 게임 데이터·카드 효과·TTS 10개 언어 현지화 (`src/hearthstone/`)**:
    - [`i18nGameData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/i18nGameData.ts) & [`i18nData.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/i18nData.ts): 9대 영웅(이름·칭호·종족·영역·영웅 능력·감정표현 8종), 카드 직업/희귀도/종족/세력 라벨, 랭크 명칭, 프리셋 덱 이름, 382종 카드 효과 키워드·구문 자동 현지화(`localizeCardText`)를 10개 언어로 확장.
    - [`BattleScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BattleScreen.tsx) 등 6개 게임 화면의 `isKo` 하드코딩 UI 분기 126건을 `tr()` 파이프라인으로 통합.
    - [`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts): Web Speech API TTS 음성 언어를 `getSpeechLocale()`로 10개 언어 자동 연동.
    - [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx), [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx), [`SnsBenchmarkApp.tsx`](file:///Users/dayyoung/project/snshero/src/sns/SnsBenchmarkApp.tsx): `document.documentElement.lang`이 `ko/en`으로 덮어써지지 않고 10개 언어 `htmlLang`으로 정확히 동기화되도록 수정.
  - **3. 10개 언어 선택 UI 업그레이드 (모바일 44px+ 터치 타깃)**:
    - [`Modals.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/Modals.tsx) (`GameOptionsModal`): 10개 언어 2열 그리드 선택기(`min-h-[44px]`, 국기·원어명·코드 배지, `options-lang-<code>` testid).
    - [`PromoApp.tsx`](file:///Users/dayyoung/project/snshero/src/promo/PromoApp.tsx): 헤더 컴팩트 글로벌 언어 드롭다운(`header-lang-toggle`, `44px` 터치 타깃) 및 푸터 10개 언어 칩 선택기(`footer-language-switcher`).
    - [`src/reader/i18n.ts`](file:///Users/dayyoung/project/snshero/src/reader/i18n.ts) 및 [`src/stone/components/CardZoomModal.tsx`](file:///Users/dayyoung/project/snshero/src/stone/components/CardZoomModal.tsx): `HeroLanguage` 타입 호환성 동기화.
  - **4. 빌드 및 실측 E2E 검증 완료**:
    - `npx tsc --noEmit && npm run build` 0에러 통과 (8개 언어 청크 정상 분리 확인).
    - Python Playwright로 데스크톱(`1280×800`) 및 모바일(`390×844`)에서 `/game.html` 10개 언어 URL 직접 진입, `GameOptionsModal` 10개 언어 실시간 전환, `/` 프로모션 헤더·푸터 전환, 가로 오버플로우 `0px`, 터치 타깃 `>= 44px`, 콘솔/페이지 에러 `0건` 전수 통과. 로컬 `git commit` 완료 (`git push` 보류).

## [2026-11-19 10:08 KST] [비한국어 9개 언어 로고 이미지·성우 음성 영문 기본화 보강]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 로고 및 번역 불가 시각 에셋 영문 기본화**:
    - [`SnsHeroArtKit.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/SnsHeroArtKit.tsx): `SNS_LOGO_URL` 기본값을 `/hs-assets/brand/logo-en.webp`로 변경하고, `getSnsLogoUrl(lang)`이 `lang === 'ko'`일 때만 한글 로고, 그 외 9개 언어(`en`, `ja`, `zh-CN`, `zh-TW`, `es`, `fr`, `de`, `pt`, `ru`)에서는 모두 영문 로고를 반환하도록 수정.
    - [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx), [`ReaderChrome.ts`](file:///Users/dayyoung/project/snshero/src/reader/ReaderChrome.ts), [`BoxHubScreen.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/screens/BoxHubScreen.tsx): 로딩·결제창·리더 헤더 로고 및 `alt` 속성이 한국어 외 모든 언어에서 영문 로고(`logo-en.webp`) 및 `SNSHero`를 기본 표시하도록 통일.
  - **2. 성우 음성(VO / 스토리 나레이션 / 매치업 TTS) 영어 기본화**:
    - [`audio.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/audio.ts): 한국어(`ko`)만 한국어 성우 MP3/TTS(`ko-KR`)를 사용하고, 영어(`en`) 및 기타 8개 언어에서는 모두 **영어 성우 음성(`en-US`)**을 기본으로 재생하도록 통일.
  - **3. 검증 및 로컬 커밋**:
    - `npx tsc --noEmit && npm run build` 0에러 통과, 로컬 `git commit` 완료 (`git push` 보류).

## [2026-11-19 11:01 KST] [/checkMarket 기존 Chrome 연동 — 티스토리·문피아·네이버 웹소설/도전만화·itch.io LIVE 반영 & Reddit·gd.games 정책 분석 (완료율 68.6% 돌파)]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 티스토리 구글 1페이지 포스트 전면 리뉴얼 (`MKT-050` → `완료`)**:
    - `https://androday.tistory.com/34` 의 2013년 구버전 3x3 빙고 설명을 **2026년 9대 종족 382종 카드 · 30장 덱 · 10마나 · 30체력 · 3장=3배 각성 · 보가트의 도박장 · 40화 성우 풀보이스 웹툰/웹소설 완벽 가이드**로 전면 교체 및 공개 발행 LIVE 검증 완료.
  - **2. 문피아(`616551`) & 네이버 웹소설(`1250635`) 전면 현행화 (`MKT-058`, `MKT-100`, `MKT-003`, `MKT-016`, `MKT-022`, `MKT-076` → `완료`)**:
    - 양대 연재처 작품소개에서 구버전 `"11대 종족과 100인의 가디언"` 완전 삭제 → **9대 종족·중립 382종 카드·3배 각성·무료 3팩+250G·`?lang=ko` 직행 링크**로 LIVE 교체 및 공개 페이지 검증 완료 (`#각성` 태그 추가).
    - 문피아 **1화(`눈보라 아래 두 서약`), 5화(`폭우 속의 유령`, 마지막 비로그인 무료 회차), 40화(`영웅이 아닌 사람`)** 작가의 말에 각 회차 보스전 직행(`game?mode=story&ep=1/5/40&lang=ko`) 및 **6~40화 비로그인 전편 무료 정주행(`book.html?ep=6&lang=ko`)** 브릿지 LIVE 삽입 완료.
    - 문피아 공식 **작가공지 (`[완결 감사 & 382종 무설치 웹 TCG 정식 연동 안내]`)** 신규 게시 완료.
  - **3. 네이버 도전만화(`857363`) 공식 단일 채널 현행화 (`MKT-017` → `완료`)**:
    - 구버전 `856677` 종료 확인 후, 공식 단일 채널 `857363` 작품 줄거리에 **382종 무설치 웹 TCG 무료 3팩 링크(`https://snshero.com/promotion?lang=ko`)** 삽입 및 저장 LIVE 완료.
  - **4. 글로벌 웹게임 포털 및 커뮤니티 정책 분석 (`MKT-073`, `MKT-085`, `MKT-101`, `MKT-037`, `MKT-097`)**:
    - **itch.io (`https://snshero.itch.io/game`)**: 구버전 설명(`1,000 SNS points · 110 cute cards`) 삭제 및 영문 382종 전략 웹 TCG 설명·제목·`1280×720` 와이드 뷰포트 LIVE 갱신 완료 (`dist-portals/snshero-itchio.zip` 파일 첨부만 사용자 1클릭 대기).
    - **CrazyGames (`developer.crazygames.com/submit`)**: 제출 전 체크리스트 6항목 통과 및 Step 1 폼 오픈 (`dist-portals/snshero-crazygames.zip` 첨부 대기).
    - **GDevelop / `gd.games` (`MKT-101`)**: 공식 문서(`wiki.gdevelop.io/gdevelop5/publishing/web/`) 실측 분석 결과 GDevelop 5 에디터 내부 Share → Export 전용 포털로 확정(일반 HTML5 zip 직접 업로드 불가).
    - **Reddit (`r/WebGames`, `r/PlayMyGame`)**: 규칙 API(`/about/rules.json`) 사전 분석 완료 (`r/WebGames` P3 게임명 시작·P4 직접 게임 링크 `https://snshero.com/game?lang=en`·P6 레퍼럴/UTM 금지). 구버전 코인 글 8건은 `u/greggyou` 계정 소유로 확인되어 해당 계정 전환 후 삭제 필요.
  - **5. 구글 시트 최신화**:
    - 8건(`MKT-003`, `MKT-016`, `MKT-017`, `MKT-022`, `MKT-050`, `MKT-058`, `MKT-076`, `MKT-100`) `완료` 반영 (누적 완료 **72/105건, 68.6%**).

## [2026-11-19 11:09 KST] [/checkMarket 2차 기존 Chrome 실행 — PacPik 공식 답변·개발자 공지(MKT-025), 인벤 개발일지(MKT-061), Reddit r/WebGames 폼 세팅 (완료율 70.5% 돌파)]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. PacPik Games 공식 소통 & `#개발자 공지` 오픈 (`MKT-025` → `완료`, `MKT-079` → `진행중`)**:
    - `'똥똥'` 유저 질문글(`무슨 게임인지 잘 모르겠는데 어떤겜인거죠 ?`)에 구버전 3x3 자동배틀 폐기 및 382종 정통 전략 웹 TCG 리마스터 공식 개발자 대댓글 등록 완료.
    - PacPik `#개발자 공지` 채널에 `[대규모 리마스터] 구버전 자동배틀 폐기! 9대 종족 382종 정통 전략 웹 TCG '눈히어로' 정식 오픈 (+무료 3팩)` 1호 공지 LIVE 게시 완료.
  - **2. 인벤 인디게임개발 파티(`come_idx=6019`) 개발일지 LIVE 게시 (`MKT-061` → `완료`)**:
    - 게시판 최근 게시 형식·공지 사전 확인 후 `[일지]` 카테고리에 `[1인개발/웹] 구버전 3x3 자동배틀을 폐기하고 382종 정통 전략 웹 TCG로 전면 리마스터한 개발기 (무설치)` 게시 및 목록 최상단 노출 검증 완료.
  - **3. Reddit `r/WebGames` 제출 폼 세팅 (`MKT-037`, `MKT-097`)**:
    - `https://old.reddit.com/r/WebGames/submit`에 규칙 준수 제목(`SNSHero: Heroes of Elwin Village — ...`) 및 직행 링크(`https://snshero.com/game?lang=en`, UTM 없음) 입력 완료 (reCAPTCHA 게이트 존재로 사용자 직접 체크 후 제출 대기).
  - **4. 구글 시트 최신화**:
    - `MKT-025`, `MKT-061` → `완료`, `MKT-079` → `진행중` 갱신 (누적 완료 **74/105건, 70.5%** 돌파).

## [2026-11-19 11:16 KST] [포털 iframe 체험 → 본 서비스(SNSHero.com) 전환 유도 브릿지 & 1.32KB 초경량 itch.io 래퍼 구축]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 포털 iframe 감지 및 본 서비스 유도 브릿지 구현**:
    - [`portalBridge.ts`](file:///Users/dayyoung/project/snshero/src/hearthstone/portalBridge.ts): `detectEmbedSource()` 및 `getFullSiteLaunchUrl()` 추가 (itch.io 등 외부 iframe 임베드 자동 감지, CrazyGames 환경에서는 심사 정책 보호를 위해 `null` 반환으로 외부 유도 전면 차단).
    - [`EmbedFullSiteBridge.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/components/EmbedFullSiteBridge.tsx) & [`HearthstoneApp.tsx`](file:///Users/dayyoung/project/snshero/src/hearthstone/HearthstoneApp.tsx): 비전투 화면 좌하단 접기 가능한 미니 배너 + 1판 이상 전투 완료·스토리 EP.2+·2.5분 체험 도달 시 세션 1회 공식 풀버전 전환 모달(영구 저장·40화 풀보이스·랭킹전·보가트 도박장 안내, 모바일 44px+ 터치 타깃·한·영/10개국어 `tr()` 대응) 구현.
  - **2. 초경량 itch.io iframe 래퍼 ZIP 패키징**:
    - [`build-portal-zips.mjs`](file:///Users/dayyoung/project/snshero/scripts/build-portal-zips.mjs): `dist-portals/snshero-itchio-iframe.zip` (**1.32 KB, 1개 파일 `index.html`**) 자동 생성 (`https://snshero.com/game?lang=en&embed=itchio` 전체화면 iframe + 차단 시 폴백 버튼 포함).
  - **3. 검증 및 로컬 커밋**:
    - `npx tsc --noEmit && npm run build && node scripts/build-portal-zips.mjs` 0에러 통과.
    - Playwright 데스크톱(`1280×800`, EN)·모바일(`390×844`, KO) 및 CrazyGames(`portal=crazygames`) 정책 차단 검증 전수 통과(에러 0건, 가로 넘침 0px). 로컬 `git commit` 완료 (`git push` 보류).

## [2026-11-19 16:46 KST] [/checkMarket 국내 커뮤니티 집중 배포 — 티스토리 신규글·GeekNews·Velog·루리웹 LIVE 완료 & Disquiet 세팅 (완료율 72.4% 돌파)]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **1. 티스토리 신규 최신 글 발행 & 기존 글 이미지 보강**:
    - 신규 글 `https://androday.tistory.com/58` 발행 (2026년 최신 작성일 + 고화질 스크린샷 4장 + `?lang=ko` 직행 링크), 기존 `https://androday.tistory.com/34`에도 고화질 스크린샷 4장 삽입 완료.
  - **2. 국내 핵심 커뮤니티 4곳 집중 배포 (`MKT-055`, `MKT-073` → `완료`)**:
    - **GeekNews (`Show GN`)**: `https://news.hada.io/topic?id=37462` 기술 회고 프로젝트 소개 게시 완료.
    - **Velog (1인 개발기)**: `https://velog.io/@snshero/...` 고화질 인게임 스크린샷 4장 포함 기술 회고 발행 및 이미지 4장 LIVE 로드 검증 완료.
    - **루리웹 (`앱 추천/홍보 모바일`)**: `https://bbs.ruliweb.com/mobile/board/300034/read/301292` `[개발자 홍보/웹]` 게시 및 고화질 스크린샷 4장 LIVE 로드 검증 완료.
    - **Disquiet (`disquiet.io/products/new`)**: 프로덕트 이름·한 줄 소개·상세 소개·URL 입력 완료 (썸네일/스크린샷 첨부 후 등록 대기).
    - **아카라이브 (`arca.live/b/gamedev`)**: 비활성화 채널(`403`) 확인 후 스킵.
  - **3. 구글 시트 최신화**:
    - `MKT-055`, `MKT-073` → `완료` 갱신 (누적 완료 **76/105건, 72.4%**).

## [2026-11-20 16:42 KST] [카드플레이 확대 모달 중복 정보 제거 및 모바일 사용 버튼 상시 노출 개선]
- **작업자**: `Antigravity Assistant`
- **작업 개요**:
  - **문제 원인**: [`CardZoomModal.tsx`](file:///home/antigravity/Dayyoung/snshero-ep3/src/hearthstone/components/CardZoomModal.tsx)에서 확대 카드(`HearthstoneCard size="LG"`) 하단에 카드명·마나·공격력·생명력·능력 텍스트·일반 카드 유형 설명·제작/추출 가루·3배 각성 링크 공유 버튼 등이 중복으로 나열되어, 모바일 화면(`375×667`, `390×844`)에서 실제 `카드 사용` 버튼(`primaryAction`)이 뷰포트 밖으로 밀려 보이지 않는 문제 발생.
  - **수정 내용**:
    - 전투 플레이 확대 모드(`!showFlavor`)에서 확대 카드와 겹치는 중복 정보 패널(이름·스탯·유형 안내·능력 텍스트·제작/추출 가루·공유 버튼)을 제거하고, 전장 하수인 점검(`liveStats`) 시에만 현재 전장 수치 및 상태 배지를 간결하게 표시하도록 정리.
    - 컬렉션/팩 개봉 확대 모드(`showFlavor`)에서는 중복 이름/스탯/능력 설명을 제거하고 비중복 정보(제작/추출 가루·플레이버·원작 웹소설 로어 브릿지·3배 각성 링크)만 스크롤 영역에 유지.
    - 모달 레이아웃을 `max-h-[92dvh] overflow-hidden` + 내부 스크롤 영역(`flex-1 overflow-y-auto`) + 하단 고정 액션 푸터(`shrink-0`, `min-h-[48px]` 사용 버튼 + `44px` 닫기 버튼)로 개편하여 모바일에서 스크롤 없이 사용 버튼이 항상 즉시 표시되도록 보장.
  - **검증 및 로컬 커밋**:
    - `npx tsc --noEmit && npm run build` 0에러 통과.
    - Playwright 실측 검증: 모바일(`375×667` KO, `390×844` KO/EN) 및 데스크톱(`1280×800` KO/EN) 전 뷰포트에서 `[data-testid="card-zoom-primary-action"]` 뷰포트 내 즉시 노출(`inViewport: true`), 44px+ 터치 타깃, 중복 정보 미노출, 영문 미번역 한글 0건 확인.
    - 로컬 `git commit` 완료 (`git push` 보류).
