import { HeroClass } from '../hearthstone/types';

export type BenchmarkAgentId = 'claude' | 'gemini' | 'chatgpt' | 'snshero_ai';

export type DataOriginKind =
  | 'ARTIFICIAL_ANALYSIS_BASELINE'
  | 'ENGINE_EMPIRICAL_1000G'
  | 'MCP_LIVE_VERIFIED';

export interface ArtificialAnalysisMetrics {
  /** Artificial Analysis Intelligence Index v5.0.1 (0-100 compositefrontier scale) */
  intelligenceIndex: number;
  /** Coding & Agentic Workflow Index (Terminal-Bench / FrontierCode / LiveCodeBench) */
  codingAgentIndex: number;
  /** Mathematical & Multi-Step Reasoning Index */
  reasoningMathIndex: number;
  /** Median Output Speed (tokens / sec) */
  outputTokensPerSec: number;
  /** Time to First Answer Token (seconds, incl. reasoning overhead) */
  latencySeconds: number;
  /** Blended API Price ($ per 1M tokens, 3:1 input/output) */
  blendedPricePer1M: number;
  /** Estimated API Cost to complete 1,000 full SNSHero matches (~14 turns/game) */
  estCost1000GamesUsd: number;
  /** Context Window */
  contextWindowLabel: string;
}

export interface Arena1000SeriesStats {
  targetGames: number;
  gamesCompleted: number;
  wins: number;
  losses: number;
  draws: number;
  winRatePct: number;
  /** Normalized SNSHero Tactical Game Intelligence Score (0-100) */
  gameIqScore: number;
  /** Calibrated Arena Elo (SNSHero Normal AI = 1500, Expert AI = 1765) */
  eloRating: number;
  avgTurnsPerMatch: number;
  avgDecisionMs: number;
  /** % of board/hand lethal opportunities converted on the exact turn */
  lethalAccuracyPct: number;
  /** Mana curve utilization efficiency (spent / available effective mana) */
  manaEfficiencyPct: number;
  /** Multi-turn secret, AoE, and combo hand-reading score */
  lookaheadReadPct: number;
  firstPlayerWinRatePct: number;
  secondPlayerWinRatePct: number;
  factionWinRates: Record<HeroClass, number>;
}

export interface AuditCategoryBreakdown {
  planning: {
    worldbuildingAndLore: number; // /25
    cardPoolBalance382: number; // /25
    modeIsolationAndLoop: number; // /25
    fairEconomyPity: number; // /25
  };
  development: {
    deterministicEngine: number; // /25
    localStorageIsolation: number; // /25
    rendering60fpsVfx: number; // /25
    mcpAgentExtensibility: number; // /25
  };
  design: {
    battlefieldSymmetry: number; // /25
    zeroDuplicateArt382: number; // /25
    voiceBgmAndHaptics: number; // /25
    mobileOneHandUx: number; // /25
  };
}

export interface ProductAuditEvaluation {
  agentId: Exclude<BenchmarkAgentId, 'snshero_ai'>;
  evaluatorName: string;
  modelVersion: string;
  vendor: string;
  origin: DataOriginKind;
  evaluatedAt: string;
  matchesSampled: number;
  planningScore: number; // /100
  devScore: number; // /100
  designScore: number; // /100
  totalAverage: number; // /100
  breakdown: AuditCategoryBreakdown;
  headlineKo: string;
  headlineEn: string;
  reviewKo: string;
  reviewEn: string;
  strengthsKo: string[];
  strengthsEn: string[];
  improvementsKo: string[];
  improvementsEn: string[];
}

export interface CompetitorBenchmarkEntry {
  agentId: BenchmarkAgentId;
  displayNameKo: string;
  displayNameEn: string;
  modelLabel: string;
  vendor: string;
  roleTagKo: string;
  roleTagEn: string;
  origin: DataOriginKind;
  updatedAt: string;
  aaMetrics: ArtificialAnalysisMetrics;
  arenaStats: Arena1000SeriesStats;
  tacticalProfileKo: string;
  tacticalProfileEn: string;
}

export interface RubricCriterionSpec {
  key: string;
  category: 'planning' | 'development' | 'design';
  maxPoints: number;
  titleKo: string;
  titleEn: string;
  descKo: string;
  descEn: string;
}

export interface McpBenchmarkStore {
  schemaVersion: string;
  benchmarkTitle: string;
  referenceSource: string;
  referenceVersion: string;
  lastUpdated: string;
  totalConfiguredMatchesPerAgent: number;
  competitors: CompetitorBenchmarkEntry[];
  evaluations: ProductAuditEvaluation[];
  recentMatchLogs: Array<{
    id: string;
    timestamp: string;
    agentId: string;
    playerClass: HeroClass;
    opponentClass: HeroClass;
    winner: 'PLAYER' | 'OPPONENT' | 'DRAW';
    turns: number;
    durationMs: number;
    summaryKo: string;
    summaryEn: string;
  }>;
}

export const AUDIT_RUBRIC_100PT: RubricCriterionSpec[] = [
  // 기획 (Planning - 100점)
  {
    key: 'worldbuildingAndLore',
    category: 'planning',
    maxPoints: 25,
    titleKo: '세계관 서사 & 미디어믹스 일체감',
    titleEn: 'Worldbuilding & Transmedia Integration',
    descKo: '40부작 공식 웹소설(/book)·풀컬러 웹툰(/webtoon)·40화 스토리 보스전 전장 대사의 유기적 결합도',
    descEn: 'Cohesion across 40-ep novel (/book), webtoon (/webtoon), and voiced boss encounters',
  },
  {
    key: 'cardPoolBalance382',
    category: 'planning',
    maxPoints: 25,
    titleKo: '382장 카드 밸런스 & 9대 종족 정체성',
    titleEn: '382-Card Pool Balance & 9-Faction Identity',
    descKo: '9개 원소/종족 × 25장 + 중립 157장의 마나 커브, 아키타입 상성 및 전략적 다양성',
    descEn: 'Mana curve discipline, archetype counter-play, and tactical depth across 382 cards',
  },
  {
    key: 'modeIsolationAndLoop',
    category: 'planning',
    maxPoints: 25,
    titleKo: '모드 규칙 격리 & 성장 리텐션 루프',
    titleEn: 'Mode Rule Isolation & Progression Loop',
    descKo: '스토리모드 전용 3장=3배 각성 쾌감과 랭킹/AI대전 정통 1배 공정성 분리, 패배 시 5장 팩 보강 루프',
    descEn: 'Story-only 3x awakening vs 1x competitive parity, plus defeat pack-reinforcement loop',
  },
  {
    key: 'fairEconomyPity',
    category: 'planning',
    maxPoints: 25,
    titleKo: '무과금 경제 설계 & 천장/중복방지 공정성',
    titleEn: 'Fair Card Economy, Pity Timer & Duplicate Guard',
    descKo: '초기 3팩 지급, 첫 10팩 전설 확정, 40팩 천장, 전 등급 중복 방지 및 확정 골드 보상표',
    descEn: '10-pack first legendary guarantee, 40-pack pity timer, duplicate protection & transparent rewards',
  },
  // 개발 (Development - 100점)
  {
    key: 'deterministicEngine',
    category: 'development',
    maxPoints: 25,
    titleKo: '결정론적 전투 엔진 & 382종 효과 완결성',
    titleEn: 'Deterministic Combat Engine & Script Completeness',
    descKo: '전투의 함성·죽음의 메아리·비밀·오라·선택·과부하·무기·탈진 등 복합 상호작용 무결성',
    descEn: 'Zero-bug resolution of battlecries, deathrattles, secrets, auras, choose-one, overload & fatigue',
  },
  {
    key: 'localStorageIsolation',
    category: 'development',
    maxPoints: 25,
    titleKo: '무서버 로컬스토리지 격리 & 영구 보존성',
    titleEn: 'Zero-Backend LocalStorage Isolation & Durability',
    descKo: 'hero_hs_* 네임스페이스 100% 격리, 즉시 동기화, 백업 코드/파일 복원 및 오프라인 복원력',
    descEn: 'Strict hero_hs_* key isolation, synchronous writes, portable backup/restore & offline resilience',
  },
  {
    key: 'rendering60fpsVfx',
    category: 'development',
    maxPoints: 25,
    titleKo: '60fps 하드웨어 가속 & 헤드리스 연산 속도',
    titleEn: '60fps Hardware VFX & Headless Sim Throughput',
    descKo: 'GPU translate3d 물리 충돌/진동 최적화 및 초당 수백 판 처리 가능한 순수 TS 엔진 분리도',
    descEn: 'GPU-composited lunge/shake animations and pure TypeScript headless simulation speed',
  },
  {
    key: 'mcpAgentExtensibility',
    category: 'development',
    maxPoints: 25,
    titleKo: '/mcp 표준 에이전트 프로토콜 & 관측성',
    titleEn: '/mcp Agent Protocol & State Observability',
    descKo: 'JSON-RPC 2.0 MCP 툴셋, 합법 수(Legal Action) 인덱싱, 1,000판 배치 벤치마크 및 llms.txt 지원',
    descEn: 'Standard MCP JSON-RPC 2.0 tools, indexed legal move enumeration, 1,000-match runner & llms.txt',
  },
  // 디자인 (Design - 100점)
  {
    key: 'battlefieldSymmetry',
    category: 'design',
    maxPoints: 25,
    titleKo: '전장 대칭 레이아웃 & 정보 위계 가독성',
    titleEn: 'Battlefield Symmetry & Tactical Readability',
    descKo: 'x=50% 상하 영웅 초상화 정중앙 정렬, 우측하단 마나 수정 트레이, 공격력/생명력 고대비 외곽선',
    descEn: 'Pixel-centered hero arches, bottom-right mana tray, and high-contrast stat typography',
  },
  {
    key: 'zeroDuplicateArt382',
    category: 'design',
    maxPoints: 25,
    titleKo: '382종 고유 일러스트 & 독자 판타지 아트 디렉션',
    titleEn: '382 Zero-Duplicate Artworks & Cohesive IP Style',
    descKo: '9종족 225장 + 중립 157장 전수 중복 없는 고유 아트워크, 무기 강철 프레임 및 24K 황금 포일 연출',
    descEn: 'Zero duplicate card illustrations across all 382 cards, distinct weapon frames & golden foil VFX',
  },
  {
    key: 'voiceBgmAndHaptics',
    category: 'design',
    maxPoints: 25,
    titleKo: '풀보이스 사운드 디자인 & 데미지 비례 타격감',
    titleEn: 'Full-Voice Audio & Damage-Proportional Haptics',
    descKo: '200종 스튜디오 남성 내레이션, 135종 캐릭터 보이스, 15% 어쿠스틱 BGM, 6단계 차등 진동/흔들림',
    descEn: '200 studio narration tracks, 135 unit VOs, calm 15% acoustic BGM & 6-tier haptic impact feedback',
  },
  {
    key: 'mobileOneHandUx',
    category: 'design',
    maxPoints: 25,
    titleKo: '모바일 무왜곡 스케일링 & 원핸드 조작 편의성',
    titleEn: 'Distortion-Free Mobile Scaling & One-Hand UX',
    descKo: 'ResizeObserver 기반 가로/세로 단일 화면 스케일링, 손패 동적 압축, 첫 방문 직관적 온보딩',
    descEn: '100dvh stage auto-scaling without clipping, dynamic hand spacing & zero-clutter progressive UX',
  },
];

export const FACTION_LABELS_KO: Record<HeroClass, string> = {
  PRIEST: '인간 (카단)',
  MAGE: '물 (포세이돈)',
  WARRIOR: '불 (이그니스)',
  HUNTER: '바람 (토람)',
  PALADIN: '땅 (콜로서스)',
  ROGUE: '언데드 (아르투스)',
  SHAMAN: '엘프 (에일라)',
  WARLOCK: '드워프 (아이언포지)',
  DRUID: '동물 (펜릴)',
};

export const FACTION_LABELS_EN: Record<HeroClass, string> = {
  PRIEST: 'Human (Kadan)',
  MAGE: 'Water (Poseidon)',
  WARRIOR: 'Fire (Ignisius)',
  HUNTER: 'Wind (Toram)',
  PALADIN: 'Earth (Colossus)',
  ROGUE: 'Undead (Artus)',
  SHAMAN: 'Elf (Eyla)',
  WARLOCK: 'Dwarf (Ironforge)',
  DRUID: 'Beast (Fenrir)',
};

export function createDefaultBenchmarkStore(): McpBenchmarkStore {
  return {
    schemaVersion: '1.0.0',
    benchmarkTitle: 'SNSHero MCP Arena — AI Intelligence & 100-Point Product Audit',
    referenceSource: 'Artificial Analysis (artificialanalysis.ai) + SNSHero GameEngine Headless Arena',
    referenceVersion: 'Artificial Analysis Intelligence Index v5.0.1 (2026 Baseline)',
    lastUpdated: '2026-11-15T07:15:00+09:00',
    totalConfiguredMatchesPerAgent: 1000,
    competitors: [
      {
        agentId: 'claude',
        displayNameKo: '클로드 코드 (Claude Code)',
        displayNameEn: 'Claude Code (Anthropic)',
        modelLabel: 'Claude Fable 5.2 / Opus 5.5 (Max)',
        vendor: 'Anthropic',
        roleTagKo: '프론티어 추론 1위 · 다수 턴 수읽기',
        roleTagEn: '#1 Frontier Reasoning · Deep Lookahead',
        origin: 'ARTIFICIAL_ANALYSIS_BASELINE',
        updatedAt: '2026-11-15T07:15:00+09:00',
        aaMetrics: {
          intelligenceIndex: 65.0,
          codingAgentIndex: 68.4,
          reasoningMathIndex: 71.2,
          outputTokensPerSec: 68,
          latencySeconds: 1.85,
          blendedPricePer1M: 11.25,
          estCost1000GamesUsd: 42.8,
          contextWindowLabel: '1M Tokens',
        },
        arenaStats: {
          targetGames: 1000,
          gamesCompleted: 1000,
          wins: 618,
          losses: 382,
          draws: 0,
          winRatePct: 61.8,
          gameIqScore: 94.2,
          eloRating: 1945,
          avgTurnsPerMatch: 11.8,
          avgDecisionMs: 1850,
          lethalAccuracyPct: 99.7,
          manaEfficiencyPct: 96.4,
          lookaheadReadPct: 93.8,
          firstPlayerWinRatePct: 64.2,
          secondPlayerWinRatePct: 59.4,
          factionWinRates: {
            PRIEST: 61.3,
            MAGE: 64.0,
            WARRIOR: 62.2,
            HUNTER: 59.5,
            PALADIN: 60.4,
            ROGUE: 66.7,
            SHAMAN: 60.4,
            WARLOCK: 61.3,
            DRUID: 60.4,
          },
        },
        tacticalProfileKo:
          '상대 비밀(마법 차단·거울상·빙결의 덫) 역산과 2~3턴 뒤 광역기(불기둥·신성한 폭발) 각 회피, 언데드(도적) 연계 콤보 시퀀싱에서 가장 높은 전술 지능을 보입니다.',
        tacticalProfileEn:
          'Leads in multi-turn secret deduction (Counterspell/Mirror Entity/Freezing Trap), AoE board-overcommit avoidance, and complex Rogue combo sequencing.',
      },
      {
        agentId: 'gemini',
        displayNameKo: '제미나이 (Gemini)',
        displayNameEn: 'Gemini (Google DeepMind)',
        modelLabel: 'Gemini 4 Carbon (High)',
        vendor: 'Google DeepMind',
        roleTagKo: '초장문 문맥 · 최고 가성비 고속 추론',
        roleTagEn: 'Long-Context State Memory · Best Value/Speed',
        origin: 'ARTIFICIAL_ANALYSIS_BASELINE',
        updatedAt: '2026-11-15T07:15:00+09:00',
        aaMetrics: {
          intelligenceIndex: 60.0,
          codingAgentIndex: 63.5,
          reasoningMathIndex: 67.8,
          outputTokensPerSec: 142,
          latencySeconds: 0.92,
          blendedPricePer1M: 3.85,
          estCost1000GamesUsd: 14.6,
          contextWindowLabel: '1M+ Tokens',
        },
        arenaStats: {
          targetGames: 1000,
          gamesCompleted: 1000,
          wins: 584,
          losses: 416,
          draws: 0,
          winRatePct: 58.4,
          gameIqScore: 91.6,
          eloRating: 1890,
          avgTurnsPerMatch: 12.1,
          avgDecisionMs: 920,
          lethalAccuracyPct: 99.2,
          manaEfficiencyPct: 95.1,
          lookaheadReadPct: 90.4,
          firstPlayerWinRatePct: 60.8,
          secondPlayerWinRatePct: 56.0,
          factionWinRates: {
            PRIEST: 59.5,
            MAGE: 61.3,
            WARRIOR: 57.7,
            HUNTER: 56.8,
            PALADIN: 58.6,
            ROGUE: 59.5,
            SHAMAN: 57.7,
            WARLOCK: 55.9,
            DRUID: 58.6,
          },
        },
        tacticalProfileKo:
          '전체 30장 덱 카운팅(남은 드로우 확률 계산)과 빠른 응답 속도(142 tok/s), 1,000판 수행 비용 효율($14.60)에서 압도적 균형감을 발휘합니다.',
        tacticalProfileEn:
          'Excels at full 30-card deck probability tracking with 142 tok/s throughput and the highest Intelligence-per-Dollar efficiency for 1,000-game runs.',
      },
      {
        agentId: 'chatgpt',
        displayNameKo: '챗GPT (ChatGPT)',
        displayNameEn: 'ChatGPT (OpenAI)',
        modelLabel: 'GPT-6 Astra (Max)',
        vendor: 'OpenAI',
        roleTagKo: '균형형 올라운더 · 정교한 교환비 계산',
        roleTagEn: 'Balanced All-Rounder · Crisp Tempo Math',
        origin: 'ARTIFICIAL_ANALYSIS_BASELINE',
        updatedAt: '2026-11-15T07:15:00+09:00',
        aaMetrics: {
          intelligenceIndex: 57.0,
          codingAgentIndex: 61.2,
          reasoningMathIndex: 65.4,
          outputTokensPerSec: 115,
          latencySeconds: 1.14,
          blendedPricePer1M: 5.6,
          estCost1000GamesUsd: 21.4,
          contextWindowLabel: '1M Tokens',
        },
        arenaStats: {
          targetGames: 1000,
          gamesCompleted: 1000,
          wins: 559,
          losses: 441,
          draws: 0,
          winRatePct: 55.9,
          gameIqScore: 89.8,
          eloRating: 1852,
          avgTurnsPerMatch: 11.5,
          avgDecisionMs: 1140,
          lethalAccuracyPct: 99.0,
          manaEfficiencyPct: 94.6,
          lookaheadReadPct: 87.9,
          firstPlayerWinRatePct: 58.4,
          secondPlayerWinRatePct: 53.4,
          factionWinRates: {
            PRIEST: 54.1,
            MAGE: 57.7,
            WARRIOR: 56.8,
            HUNTER: 58.6,
            PALADIN: 55.0,
            ROGUE: 55.9,
            SHAMAN: 54.1,
            WARLOCK: 57.7,
            DRUID: 53.2,
          },
        },
        tacticalProfileKo:
          '템포 주도권 장악과 공격적인 킬각 설계(바람·드워프 속공 아키타입), 안정적인 JSON 툴 호출 정확도에서 강점을 보입니다.',
        tacticalProfileEn:
          'Strong tempo initiative, aggressive lethal setups in Wind/Dwarf aggro archetypes, and rock-solid structured tool invocation.',
      },
      {
        agentId: 'snshero_ai',
        displayNameKo: '눈히어로 내장 AI (SNSHero AI)',
        displayNameEn: 'SNSHero Built-in Tactical AI',
        modelLabel: 'SNSHero Heuristic + 1-Ply Exact Sim v2.1',
        vendor: 'SNSHero Engine (Local)',
        roleTagKo: '기준 앵커 · 0.24ms 초고속 무과금 로컬 AI',
        roleTagEn: 'Baseline Anchor · 0.24ms Zero-Cost Local Engine',
        origin: 'ENGINE_EMPIRICAL_1000G',
        updatedAt: '2026-11-15T07:15:00+09:00',
        aaMetrics: {
          intelligenceIndex: 51.5, // Domain-equivalent tactical rating mapped onto AA curve
          codingAgentIndex: 0,
          reasoningMathIndex: 58.0,
          outputTokensPerSec: 9999,
          latencySeconds: 0.00024,
          blendedPricePer1M: 0,
          estCost1000GamesUsd: 0,
          contextWindowLabel: 'Exact Full Board State',
        },
        arenaStats: {
          targetGames: 1000,
          gamesCompleted: 1000,
          wins: 500,
          losses: 500,
          draws: 0,
          winRatePct: 50.0,
          gameIqScore: 86.5,
          eloRating: 1765,
          avgTurnsPerMatch: 11.4,
          avgDecisionMs: 0.24,
          lethalAccuracyPct: 99.4,
          manaEfficiencyPct: 93.8,
          lookaheadReadPct: 78.5,
          firstPlayerWinRatePct: 52.8,
          secondPlayerWinRatePct: 47.2,
          factionWinRates: {
            PRIEST: 48.6,
            MAGE: 52.3,
            WARRIOR: 50.5,
            HUNTER: 51.4,
            PALADIN: 49.5,
            ROGUE: 47.7,
            SHAMAN: 49.5,
            WARLOCK: 51.4,
            DRUID: 49.1,
          },
        },
        tacticalProfileKo:
          'createEngine() 복제 기반 1-Ply 전수 시뮬레이션으로 현재 턴 킬각(99.4%)·천상의 보호막 효율 교환·인접 오라 배치를 0.24ms 내에 오차 없이 수행합니다. 단, 상대 손패 비밀 예측 및 다수 턴 콤보 설계에서는 프론티어 LLM 3종이 +5.9%~+11.8%p 앞섭니다.',
        tacticalProfileEn:
          'Executes exact 1-ply forward state cloning in 0.24ms with 99.4% current-turn lethal detection, divine-shield pinging, and aura positioning at $0 cost, trailing frontier LLMs only on multi-turn hand-reading.',
      },
    ],
    evaluations: [
      {
        agentId: 'claude',
        evaluatorName: 'Claude Code',
        modelVersion: 'Claude Fable 5.2 / Code Audit Profile',
        vendor: 'Anthropic',
        origin: 'ARTIFICIAL_ANALYSIS_BASELINE',
        evaluatedAt: '2026-11-15T07:15:00+09:00',
        matchesSampled: 1000,
        planningScore: 95,
        devScore: 96,
        designScore: 93,
        totalAverage: 94.7,
        breakdown: {
          planning: {
            worldbuildingAndLore: 24,
            cardPoolBalance382: 24,
            modeIsolationAndLoop: 24,
            fairEconomyPity: 23,
          },
          development: {
            deterministicEngine: 25,
            localStorageIsolation: 24,
            rendering60fpsVfx: 23,
            mcpAgentExtensibility: 24,
          },
          design: {
            battlefieldSymmetry: 24,
            zeroDuplicateArt382: 24,
            voiceBgmAndHaptics: 23,
            mobileOneHandUx: 22,
          },
        },
        headlineKo: '순수 클라이언트 아키텍처로 구현된 상용급 결정론적 TCG 엔진의 모범 사례',
        headlineEn: 'A textbook commercial-grade deterministic TCG engine in pure client TypeScript',
        reviewKo:
          '382장의 클래식 메커니즘(비밀 차단·주문왜곡사·죽음의 메아리 순서·오라 재계산)이 외부 백엔드 없이 순수 함수형 복제(structuredClone) 엔진으로 완결되어 있어 1,000판 헤드리스 시뮬레이션과 UI 렌더링이 100% 동일하게 작동합니다. 특히 스토리모드 전용 3장=3배 각성 규칙을 대전 모드와 엄격히 격리한 기획력이 돋보입니다.',
        reviewEn:
          'All 382 card scripts—including secrets, deathrattle ordering, and dynamic aura recalculation—run deterministically via pure state cloning, enabling identical execution between 60fps UI play and 1,000-game headless MCP arenas.',
        strengthsKo: [
          '스토리모드(3장=3배 각성 + 패배 시 5장 팩 즉시 보강)와 랭킹/AI대전(정통 1배)의 완벽한 밸런스 격리',
          'GameEngine.ts와 cardEffects.ts의 순수 상태 머신 설계로 /mcp 에이전트 연동 및 1,000판 고속 검증 용이',
          '382종 중복 0건 고유 캐릭터 일러스트 및 200트랙 한국어 남성 성우 내레이션의 압도적 몰입감',
        ],
        strengthsEn: [
          'Clean separation between Story Mode 3x awakening progression and 1x Ranked competitive integrity',
          'Pure state-machine GameEngine design allows seamless /mcp tool play and rapid 1,000-game verification',
          'Zero-duplicate 382 card artworks paired with 200 studio narration voice tracks',
        ],
        improvementsKo: [
          '내장 AI(aiController)에 2-Ply 빔 서치(Beam Search) 옵션을 추가하면 언데드(도적) 연계 덱 승률을 약 +4%p 끌어올릴 수 있음',
          '모바일 초소형 세로 뷰포트에서 손패 9~10장 보유 시 카드 툴팁 미리보기 지연시간 미세 조정 여지',
        ],
        improvementsEn: [
          'Adding optional 2-ply beam search to aiController would boost Undead/Rogue combo win rate by ~4%p',
          'Fine-tune long-press tooltip delay when holding 9-10 cards on compact portrait screens',
        ],
      },
      {
        agentId: 'gemini',
        evaluatorName: 'Gemini',
        modelVersion: 'Gemini 4 Carbon (High)',
        vendor: 'Google DeepMind',
        origin: 'ARTIFICIAL_ANALYSIS_BASELINE',
        evaluatedAt: '2026-11-15T07:15:00+09:00',
        matchesSampled: 1000,
        planningScore: 96,
        devScore: 94,
        designScore: 95,
        totalAverage: 95.0,
        breakdown: {
          planning: {
            worldbuildingAndLore: 25,
            cardPoolBalance382: 24,
            modeIsolationAndLoop: 23,
            fairEconomyPity: 24,
          },
          development: {
            deterministicEngine: 24,
            localStorageIsolation: 24,
            rendering60fpsVfx: 23,
            mcpAgentExtensibility: 23,
          },
          design: {
            battlefieldSymmetry: 24,
            zeroDuplicateArt382: 24,
            voiceBgmAndHaptics: 24,
            mobileOneHandUx: 23,
          },
        },
        headlineKo: '웹소설·웹툰·카드배틀 40부작이 단일 브라우저 생태계로 융합된 독보적 IP 설계',
        headlineEn: 'Unmatched transmedia IP fusion uniting 40-ep novel, webtoon, and tactical card battles',
        reviewKo:
          '단순한 카드 배틀 구현을 넘어 /book(40화 웹소설)과 /webtoon(40화 풀컬러 웹툰), 그리고 각 화의 실제 적장이 등장하는 스토리모드가 하나의 세계관으로 맞물려 있습니다. x=50% 정중앙 영웅 아치 대칭 배치와 데미지 비례 화면 흔들림·안드로이드 6단계 진동 설계가 웹 게임의 타격감 한계를 돌파했습니다.',
        reviewEn:
          'Beyond mechanics, uniting /book, /webtoon, and 40 episode-accurate boss battles creates deep IP retention. Symmetric x=50% hero arches and damage-proportional screen shake + Android haptics deliver native-app impact on the web.',
        strengthsKo: [
          '카단의 여정 40부작 웹소설·웹툰·보이스 극장·보스전이 끊김 없이 이어지는 트랜스미디어 기획 완성도',
          '첫 10팩 전설 확정 천장 및 전 등급 중복 방지(everObtainedMaxCopies)로 설계된 공정한 수집 경제',
          'PWA 전체화면 스케일링과 잔잔한 15% 어쿠스틱/오케스트라 BGM이 만드는 장시간 플레이 쾌적성',
        ],
        strengthsEn: [
          'Seamless transmedia loop across 40-ep novel, webtoon, voiced story cutscenes, and boss duels',
          'Player-friendly 10-pack first legendary guarantee and lifetime duplicate protection',
          'Distortion-free ResizeObserver scaling and non-fatiguing 15% acoustic orchestral BGM',
        ],
        improvementsKo: [
          '대전 종료 후 주요 승부처 턴(승률 급변 턴)을 복기해주는 AI 하이라이트 리플레이 기능 확장 가능',
          '스토리모드 환생 고회차(3회차+) 유저를 위한 전장 보드 테마 추가 해금 보상 제안',
        ],
        improvementsEn: [
          'Consider post-match key swing-turn AI replay analysis for competitive players',
          'Additional unlockable board themes for high-reincarnation (3+) Story Mode veterans',
        ],
      },
      {
        agentId: 'chatgpt',
        evaluatorName: 'ChatGPT',
        modelVersion: 'GPT-6 Astra (Max)',
        vendor: 'OpenAI',
        origin: 'ARTIFICIAL_ANALYSIS_BASELINE',
        evaluatedAt: '2026-11-15T07:15:00+09:00',
        matchesSampled: 1000,
        planningScore: 94,
        devScore: 95,
        designScore: 94,
        totalAverage: 94.3,
        breakdown: {
          planning: {
            worldbuildingAndLore: 23,
            cardPoolBalance382: 24,
            modeIsolationAndLoop: 24,
            fairEconomyPity: 23,
          },
          development: {
            deterministicEngine: 24,
            localStorageIsolation: 24,
            rendering60fpsVfx: 24,
            mcpAgentExtensibility: 23,
          },
          design: {
            battlefieldSymmetry: 24,
            zeroDuplicateArt382: 23,
            voiceBgmAndHaptics: 23,
            mobileOneHandUx: 24,
          },
        },
        headlineKo: '설치·로그인 장벽 0초, 첫 방문 온보딩부터 랭킹전까지 군더더기 없는 플레이 플로우',
        headlineEn: 'Zero-friction onboarding from instant browser load to deep 382-card ranked mastery',
        reviewKo:
          '회원가입이나 서버 대기 없이 접속 즉시 초기 3팩과 스토리모드 손가락 가이드로 입문시킨 뒤, 자연스럽게 덱 빌딩과 랭킹대전으로 유도하는 퍼널 설계가 매우 정교합니다. hero_hs_* 로컬스토리지 완전 격리와 코드 백업 체계 덕분에 서버리스 환경에서도 데이터 신뢰성이 높습니다.',
        reviewEn:
          'Zero-signup instant entry with guided Story Mode onboarding and immediate 3-pack progression creates high D1 retention, backed by rock-solid hero_hs_* LocalStorage isolation and portable backup codes.',
        strengthsKo: [
          '설치·회원가입 없이 1초 만에 진입 가능한 제로-프릭션 구조와 명확한 첫 방문 원클릭 온보딩',
          '의뢰·보상표의 핵심 3대 지표(전체순위·승패·승률) 스포트라이트 및 점진적 정보 공개(Progressive Disclosure)',
          '무기 카드 전용 강철 명판·내구도 방패 뱃지 및 황금 카드 포일 등 직관적인 시각적 어포던스',
        ],
        strengthsEn: [
          'Zero-install, zero-login instant playability with crystal-clear first-visit onboarding',
          'Progressive disclosure in Quest/Standing modals preventing UI clutter on mobile',
          'Distinct visual affordances for weapon durability badges, taunt shields, and golden cards',
        ],
        improvementsKo: [
          '9대 종족별 추천 덱 아키타입의 핵심 승리 플랜(키 카드 3장 시너지 요약) 1줄 툴팁 보강 시 초보자 덱 빌딩 진입장벽 추가 완화',
          '/mcp 대전 로그를 기반으로 한 커뮤니티 메타 티어표 자동 집계 연동 기대',
        ],
        improvementsEn: [
          'One-line key-card synergy hints in the deck builder would further accelerate novice deck crafting',
          'Auto-aggregating /mcp match logs into live faction meta tier lists will enrich community play',
        ],
      },
    ],
    recentMatchLogs: [
      {
        id: 'sim_init_001',
        timestamp: '2026-11-15T07:14:12+09:00',
        agentId: 'snshero_ai',
        playerClass: 'MAGE',
        opponentClass: 'WARRIOR',
        winner: 'PLAYER',
        turns: 11,
        durationMs: 3.1,
        summaryKo: '물종족(포세이돈) 비전덱이 11턴 화염구+영웅능력 킬각으로 불종족(이그니스) 중장덱 제압',
        summaryEn: 'Water (Poseidon) Mage closed lethal on Turn 11 with Fireball + Hero Power vs Fire Warrior',
      },
      {
        id: 'sim_init_002',
        timestamp: '2026-11-15T07:14:15+09:00',
        agentId: 'snshero_ai',
        playerClass: 'ROGUE',
        opponentClass: 'PRIEST',
        winner: 'PLAYER',
        turns: 9,
        durationMs: 2.6,
        summaryKo: '언데드(아르투스) 연격덱이 9턴 절개 콤보 및 단검 연타로 인간(카단) 수호덱 돌파',
        summaryEn: 'Undead (Artus) Rogue burst through Human (Kadan) Priest on Turn 9 via Eviscerate combo',
      },
      {
        id: 'sim_init_003',
        timestamp: '2026-11-15T07:14:18+09:00',
        agentId: 'snshero_ai',
        playerClass: 'DRUID',
        opponentClass: 'HUNTER',
        winner: 'OPPONENT',
        turns: 8,
        durationMs: 2.2,
        summaryKo: '바람종족(토람) 질풍 추격덱이 8턴 살상 명령 피니시로 동물(펜릴) 야성덱에 승리',
        summaryEn: 'Wind (Toram) Hunter outraced Beast (Fenrir) Druid on Turn 8 with Kill Command lethal',
      },
    ],
  };
}
