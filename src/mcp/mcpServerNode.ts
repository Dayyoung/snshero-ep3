import fs from 'fs';
import type { IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import { cardDb } from '../hearthstone/cardDb';
import { CLASSIC_HEROES, ClassicCardDef, HERO_CLASS_ORDER, HeroClass } from '../hearthstone/types';
import {
  ActiveMatchSession,
  SimPolicyId,
  applyLegalAction,
  computeCalibratedEloAndIq,
  createNewMatchSession,
  enumerateLegalActions,
  runHeadlessSeriesAsync,
  serializeMatchObservation,
} from './arenaCore';
import {
  AUDIT_RUBRIC_100PT,
  BenchmarkAgentId,
  FACTION_LABELS_KO,
  McpBenchmarkStore,
  ProductAuditEvaluation,
  createDefaultBenchmarkStore,
} from './benchmarkData';

interface LiveSeriesTracker {
  seriesId: string;
  agentId: Exclude<BenchmarkAgentId, 'snshero_ai'>;
  modelName: string;
  targetGames: number;
  completedGames: number;
  wins: number;
  losses: number;
  draws: number;
  totalTurns: number;
  totalDecisionMs: number;
  lethalChances: number;
  lethalConverted: number;
  manaAvailable: number;
  manaSpent: number;
  firstGames: number;
  firstWins: number;
  secondGames: number;
  secondWins: number;
  factionGames: Record<HeroClass, number>;
  factionWins: Record<HeroClass, number>;
  createdAt: string;
}

const activeMatches = new Map<string, ActiveMatchSession>();
const activeSeries = new Map<string, LiveSeriesTracker>();
const sseClients = new Map<string, ServerResponse>();

let cardDbInitialized = false;

export function ensureNodeCardDbLoaded(rootDir = process.cwd()): void {
  if (cardDbInitialized || cardDb.isLoaded()) {
    cardDbInitialized = true;
    return;
  }
  const candidates = [
    path.join(rootDir, 'public', 'hs-assets', 'data', 'classic-cards.json'),
    path.join(rootDir, 'dist', 'hs-assets', 'data', 'classic-cards.json'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as {
        cards: ClassicCardDef[];
        tokens: ClassicCardDef[];
      };
      cardDb.hydrateFromJson(raw);
      cardDbInitialized = true;
      return;
    }
  }
}

export function getStoreFilePath(rootDir = process.cwd()): string {
  return path.join(rootDir, 'public', 'data', 'mcp-benchmark-store.json');
}

export function loadBenchmarkStore(rootDir = process.cwd()): McpBenchmarkStore {
  const storePath = getStoreFilePath(rootDir);
  try {
    if (fs.existsSync(storePath)) {
      const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8')) as McpBenchmarkStore;
      if (parsed && Array.isArray(parsed.competitors) && Array.isArray(parsed.evaluations)) {
        return parsed;
      }
    }
  } catch {
    // Fallback to clean default store
  }
  const fallback = createDefaultBenchmarkStore();
  saveBenchmarkStore(fallback, rootDir);
  return fallback;
}

export function saveBenchmarkStore(store: McpBenchmarkStore, rootDir = process.cwd()): void {
  const storePath = getStoreFilePath(rootDir);
  const dir = path.dirname(storePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  store.lastUpdated = new Date().toISOString();
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');

  // Mirror to dist/data if dist exists so preview server serves fresh static JSON too
  const distDataDir = path.join(rootDir, 'dist', 'data');
  if (fs.existsSync(path.join(rootDir, 'dist'))) {
    try {
      fs.mkdirSync(distDataDir, { recursive: true });
      fs.writeFileSync(
        path.join(distDataDir, 'mcp-benchmark-store.json'),
        JSON.stringify(store, null, 2),
        'utf8',
      );
    } catch {
      // Ignore dist write error
    }
  }
}

function normalizeAgentKey(raw?: string): Exclude<BenchmarkAgentId, 'snshero_ai'> {
  const s = (raw || '').toLowerCase();
  if (s.includes('claude') || s.includes('anthropic') || s.includes('opus') || s.includes('sonnet') || s.includes('fable')) {
    return 'claude';
  }
  if (s.includes('gemini') || s.includes('google')) {
    return 'gemini';
  }
  return 'chatgpt';
}

function buildGameDossier() {
  ensureNodeCardDbLoaded();
  const cards = cardDb.getAllCollectible();
  const classSummary = HERO_CLASS_ORDER.map((cls) => ({
    heroClass: cls,
    factionKo: CLASSIC_HEROES[cls].classNameKo,
    heroKo: CLASSIC_HEROES[cls].nameKo,
    heroPowerKo: `${CLASSIC_HEROES[cls].heroPowerNameKo}: ${CLASSIC_HEROES[cls].heroPowerTextKo}`,
    classCards: cards.filter((c) => c.cardClass === cls).length,
  }));

  return {
    gameTitle: '눈히어로 — 엘윈마을 전략 카드 배틀 (SNSHero: Kadan’s Journey)',
    canonicalUrls: {
      playGame: 'https://snshero.com/',
      showcase: 'https://snshero.com/promotion',
      novel40Ep: 'https://snshero.com/book',
      webtoon40Ep: 'https://snshero.com/webtoon',
      aiBenchmarkHub: 'https://snshero.com/sns',
      mcpEndpoint: 'https://snshero.com/mcp',
    },
    architecturePillars: {
      planning: {
        collectibleCards: cards.length, // Strictly frozen 382 cards
        classCards: 225, // 9 factions x 25
        neutralCards: 157,
        factions: classSummary,
        storyMode: '40-Episode Kadan’s Journey with 5-panel voiced webtoon theater & custom boss decks',
        modeRuleIsolation:
          'Story Mode exclusively activates 3-copies = 3x stat awakening + defeat 5-card reinforcement pack loop; Ranked & AI Practice enforce strict 1x competitive stats.',
        cardEconomy:
          '3 free starter packs, guaranteed first Legendary within 10 packs, 40-pack Legendary pity timer, 10-pack Epic pity timer, and lifetime duplicate protection.',
      },
      development: {
        stack: 'React 19 + TypeScript 5.8 + Vite 6 + Tailwind CSS 4.1',
        engineArchitecture:
          'Pure deterministic functional-clone state machine (GameEngine.ts + cardEffects.ts + aiController.ts) supporting Battlecry, Deathrattle, Secrets (Counterspell/Spellbender/Mirror Entity/Freezing Trap/Ice Block), Choose One, Combo, Overload, Taunt+Stealth suppression, Divine Shield, Windfury, Poisonous, Dynamic Auras, and Fatigue.',
        dataPersistence:
          '100% Zero-Server LocalStorage (hero_hs_* isolated namespace) with synchronous state commits and portable backup/restore codes.',
        mcpReadiness:
          'Native JSON-RPC 2.0 Streamable HTTP + SSE + Stdio MCP server exposing turn-by-turn play, legal action indexing, 1,000-match headless arena, and 100-pt rubric submission.',
      },
      design: {
        battlefieldLayout:
          '1:1 Symmetric Box & Board layout with x=50% centered hero arches, weapon/hero-power symmetry, and bottom-right 10-crystal sapphire mana tray.',
        artDirection:
          '382 zero-duplicate original fantasy character & monster illustrations, distinct steel weapon frames, and 24K golden foil shaders.',
        audioAndHaptics:
          '200 studio Korean male narrator MP3s, 135 character VOs, 30 physical SFX, 5 calm acoustic/orchestral BGM tracks (15% default volume), and 6-tier damage-proportional screen shake + Android Web Vibration priority arbiter.',
        mobileUx:
          'ResizeObserver distortion-free landscape/portrait scaling with dark-gold letterboxing and progressive disclosure modals.',
      },
    },
    evaluationRubric100Pt: AUDIT_RUBRIC_100PT,
  };
}

function recordCompletedLiveMatch(session: ActiveMatchSession, rootDir = process.cwd()): void {
  const store = loadBenchmarkStore(rootDir);
  const agentKey = normalizeAgentKey(session.agentId);
  const winner: 'PLAYER' | 'OPPONENT' | 'DRAW' =
    session.state.winner === 'PLAYER'
      ? 'PLAYER'
      : session.state.winner === 'OPPONENT'
        ? 'OPPONENT'
        : 'DRAW';
  const turns = Math.max(1, Math.ceil(session.state.turnNumber / 2));
  const durationMs = Math.max(1, Date.now() - session.createdAt);
  const pClass = session.state.player.heroClass;
  const oClass = session.state.opponent.heroClass;

  store.recentMatchLogs.unshift({
    id: session.matchId,
    timestamp: new Date().toISOString(),
    agentId: agentKey,
    playerClass: pClass,
    opponentClass: oClass,
    winner,
    turns,
    durationMs,
    summaryKo: `[MCP 실전] ${session.modelName} (${FACTION_LABELS_KO[pClass]}) vs 눈히어로 AI (${FACTION_LABELS_KO[oClass]}) — ${turns}턴 ${winner === 'PLAYER' ? '승리' : '패배'}`,
    summaryEn: `[MCP Live] ${session.modelName} (${pClass}) vs SNSHero AI (${oClass}) — ${turns}T ${winner}`,
  });
  if (store.recentMatchLogs.length > 30) store.recentMatchLogs.length = 30;

  if (session.seriesId && activeSeries.has(session.seriesId)) {
    const trk = activeSeries.get(session.seriesId)!;
    trk.completedGames += 1;
    trk.totalTurns += turns;
    trk.totalDecisionMs += durationMs / Math.max(1, session.movesPlayed);
    trk.lethalChances += session.lethalChances;
    trk.lethalConverted += session.lethalConverted;
    trk.manaAvailable += session.manaAvailableTotal;
    trk.manaSpent += session.manaSpentTotal;
    trk.factionGames[pClass] = (trk.factionGames[pClass] || 0) + 1;

    if (session.state.firstPlayer === 'PLAYER') {
      trk.firstGames += 1;
      if (winner === 'PLAYER') trk.firstWins += 1;
    } else {
      trk.secondGames += 1;
      if (winner === 'PLAYER') trk.secondWins += 1;
    }

    if (winner === 'PLAYER') {
      trk.wins += 1;
      trk.factionWins[pClass] = (trk.factionWins[pClass] || 0) + 1;
    } else if (winner === 'OPPONENT') {
      trk.losses += 1;
    } else {
      trk.draws += 1;
    }

    const comp = store.competitors.find((c) => c.agentId === trk.agentId);
    if (comp && trk.completedGames >= 1) {
      const winRatePct = Number(((trk.wins / trk.completedGames) * 100).toFixed(1));
      const { elo, gameIq } = computeCalibratedEloAndIq(winRatePct, 'SNSHERO_EXPERT');
      comp.origin = 'MCP_LIVE_VERIFIED';
      comp.updatedAt = new Date().toISOString();
      comp.modelLabel = trk.modelName || comp.modelLabel;
      comp.arenaStats.gamesCompleted = trk.completedGames;
      comp.arenaStats.targetGames = trk.targetGames;
      comp.arenaStats.wins = trk.wins;
      comp.arenaStats.losses = trk.losses;
      comp.arenaStats.draws = trk.draws;
      comp.arenaStats.winRatePct = winRatePct;
      comp.arenaStats.eloRating = elo;
      comp.arenaStats.gameIqScore = gameIq;
      comp.arenaStats.avgTurnsPerMatch = Number((trk.totalTurns / trk.completedGames).toFixed(1));
      comp.arenaStats.avgDecisionMs = Math.round(trk.totalDecisionMs / trk.completedGames);
      if (trk.lethalChances > 0) {
        comp.arenaStats.lethalAccuracyPct = Number(
          ((trk.lethalConverted / trk.lethalChances) * 100).toFixed(1),
        );
      }
      if (trk.manaAvailable > 0) {
        comp.arenaStats.manaEfficiencyPct = Number(
          Math.min(99.5, (trk.manaSpent / trk.manaAvailable) * 100).toFixed(1),
        );
      }
      if (trk.firstGames > 0) {
        comp.arenaStats.firstPlayerWinRatePct = Number(
          ((trk.firstWins / trk.firstGames) * 100).toFixed(1),
        );
      }
      if (trk.secondGames > 0) {
        comp.arenaStats.secondPlayerWinRatePct = Number(
          ((trk.secondWins / trk.secondGames) * 100).toFixed(1),
        );
      }
      for (const cls of HERO_CLASS_ORDER) {
        if (trk.factionGames[cls] > 0) {
          comp.arenaStats.factionWinRates[cls] = Number(
            ((trk.factionWins[cls] / trk.factionGames[cls]) * 100).toFixed(1),
          );
        }
      }
    }
  }

  saveBenchmarkStore(store, rootDir);
}

export const MCP_TOOLS_MANIFEST = [
  {
    name: 'snshero_get_game_dossier',
    description:
      'Retrieve SNSHero complete Planning, Engineering, and Design specification, 382-card & 9-faction architecture, and the 100-point evaluation rubric so an AI model (ChatGPT, Gemini, Claude Code) can audit the game.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'snshero_start_match',
    description:
      'Start a real playable SNSHero 30-card tactical battle against SNSHero Built-in AI. Returns matchId, full initial board/hand observation, and indexed legalActions.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Identifier of the AI agent playing: "chatgpt", "gemini", or "claude"',
        },
        modelName: {
          type: 'string',
          description: 'Specific model version string (e.g. "Claude Code", "Gemini 4", "ChatGPT")',
        },
        playerClass: {
          type: 'string',
          enum: ['RANDOM', ...HERO_CLASS_ORDER],
          description: 'Faction hero class to pilot (or RANDOM)',
        },
        opponentClass: {
          type: 'string',
          enum: ['RANDOM', ...HERO_CLASS_ORDER],
          description: 'Opponent SNSHero AI faction class (or RANDOM)',
        },
        opponentDifficulty: {
          type: 'string',
          enum: ['EXPERT', 'NORMAL'],
          description: 'SNSHero AI difficulty tier (default: EXPERT)',
        },
        seriesId: {
          type: 'string',
          description: 'Optional 1,000-game seriesId from snshero_create_1000_series',
        },
      },
    },
  },
  {
    name: 'snshero_get_match_state',
    description:
      'Inspect the current turn, mana, heroes, hand cards, board minions, secrets, action history, and numbered legalActions for an active matchId.',
    inputSchema: {
      type: 'object',
      properties: {
        matchId: { type: 'string', description: 'Active matchId' },
      },
      required: ['matchId'],
    },
  },
  {
    name: 'snshero_step_action',
    description:
      'Execute a legal move in an active SNSHero match by specifying actionIndex from legalActions. When END_TURN is chosen, SNSHero AI automatically executes its turn and returns the next turn state (or final GAME_OVER result).',
    inputSchema: {
      type: 'object',
      properties: {
        matchId: { type: 'string', description: 'Active matchId' },
        actionIndex: {
          type: 'integer',
          description: 'Index from the current legalActions array (0..N-1)',
        },
        reasoning: {
          type: 'string',
          description: 'Optional tactical thought explaining why this move was chosen',
        },
      },
      required: ['matchId', 'actionIndex'],
    },
  },
  {
    name: 'snshero_create_1000_series',
    description:
      'Initialize a tracked 1,000-match evaluation series against SNSHero Expert AI across all 9 factions to measure empirical Win Rate, Elo Rating, and Game Intelligence Score.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          enum: ['chatgpt', 'gemini', 'claude'],
          description: 'AI family identifier',
        },
        modelName: { type: 'string', description: 'Model display version' },
        targetGames: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description: 'Target match count (default 1000)',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'snshero_run_batch_simulation',
    description:
      'Run up to 1,000 genuine headless SNSHero GameEngine matches across all 9 factions to benchmark tactical policies, engine speed, Elo calibration, and faction win rates.',
    inputSchema: {
      type: 'object',
      properties: {
        games: {
          type: 'integer',
          minimum: 1,
          maximum: 1000,
          description: 'Number of full games to simulate (1..1000, default 100)',
        },
        playerPolicy: {
          type: 'string',
          enum: [
            'SNSHERO_EXPERT',
            'SNSHERO_NORMAL',
            'LOOKAHEAD_2PLY',
            'AGGRO_TEMPO',
            'CONTROL_VALUE',
            'RANDOM_LEGAL',
          ],
          description: 'Tactical policy for Player side',
        },
        opponentPolicy: {
          type: 'string',
          enum: ['SNSHERO_EXPERT', 'SNSHERO_NORMAL'],
          description: 'SNSHero AI opponent tier (default SNSHERO_EXPERT)',
        },
        updateEngineBaseline: {
          type: 'boolean',
          description: 'If true and playerPolicy is SNSHERO_EXPERT, persists empirical stats to /sns store',
        },
      },
    },
  },
  {
    name: 'snshero_submit_evaluation',
    description:
      'Submit an official 100-point Planning / Development / Design evaluation from ChatGPT, Gemini, or Claude Code after playing SNSHero. Immediately updates the /sns benchmark page.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          enum: ['chatgpt', 'gemini', 'claude'],
          description: 'Evaluator family ID',
        },
        modelVersion: { type: 'string', description: 'Exact model name/version' },
        matchesSampled: { type: 'integer', description: 'Number of matches played before scoring' },
        planningScore: { type: 'number', minimum: 0, maximum: 100, description: '기획 점수 (/100)' },
        devScore: { type: 'number', minimum: 0, maximum: 100, description: '개발 점수 (/100)' },
        designScore: { type: 'number', minimum: 0, maximum: 100, description: '디자인 점수 (/100)' },
        headlineKo: { type: 'string', description: 'One-line Korean evaluation headline' },
        headlineEn: { type: 'string', description: 'One-line English evaluation headline' },
        reviewKo: { type: 'string', description: 'Detailed Korean critique paragraph' },
        reviewEn: { type: 'string', description: 'Detailed English critique paragraph' },
        strengthsKo: { type: 'array', items: { type: 'string' } },
        improvementsKo: { type: 'array', items: { type: 'string' } },
      },
      required: ['agentId', 'planningScore', 'devScore', 'designScore', 'headlineKo', 'reviewKo'],
    },
  },
  {
    name: 'snshero_get_leaderboard',
    description:
      'Fetch the current /sns AI Intelligence Leaderboard (Artificial Analysis v5.0.1 baseline + 1,000-match Arena standings + 100-point Planning/Dev/Design evaluations).',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
];

export async function executeMcpTool(
  name: string,
  args: Record<string, any> = {},
  rootDir = process.cwd(),
): Promise<any> {
  ensureNodeCardDbLoaded(rootDir);

  switch (name) {
    case 'snshero_get_game_dossier': {
      return buildGameDossier();
    }

    case 'snshero_start_match': {
      const seriesId = typeof args.seriesId === 'string' ? args.seriesId : undefined;
      let pClass: HeroClass | 'RANDOM' = args.playerClass || 'RANDOM';
      let oClass: HeroClass | 'RANDOM' = args.opponentClass || 'RANDOM';

      if (seriesId && activeSeries.has(seriesId)) {
        const trk = activeSeries.get(seriesId)!;
        const idx = trk.completedGames;
        if (pClass === 'RANDOM') pClass = HERO_CLASS_ORDER[idx % HERO_CLASS_ORDER.length];
        if (oClass === 'RANDOM') {
          oClass = HERO_CLASS_ORDER[(Math.floor(idx / 9) + idx + 4) % HERO_CLASS_ORDER.length];
        }
      }

      const session = createNewMatchSession({
        agentId: args.agentId || 'claude',
        modelName: args.modelName || args.agentId || 'MCP Agent',
        playerClass: pClass,
        opponentClass: oClass,
        opponentDifficulty: args.opponentDifficulty === 'NORMAL' ? 'NORMAL' : 'EXPERT',
        autoMulligan: args.autoMulligan !== false,
        seriesId,
      });
      activeMatches.set(session.matchId, session);
      // Prune stale sessions if > 200
      if (activeMatches.size > 200) {
        const oldestKey = activeMatches.keys().next().value;
        if (oldestKey) activeMatches.delete(oldestKey);
      }
      return serializeMatchObservation(session);
    }

    case 'snshero_get_match_state': {
      const session = activeMatches.get(String(args.matchId || ''));
      if (!session) {
        throw new Error(`Match session not found: ${args.matchId}`);
      }
      return serializeMatchObservation(session);
    }

    case 'snshero_step_action': {
      const session = activeMatches.get(String(args.matchId || ''));
      if (!session) {
        throw new Error(`Match session not found: ${args.matchId}`);
      }
      if (session.state.phase === 'GAME_OVER') {
        return serializeMatchObservation(session);
      }
      const legal = enumerateLegalActions(session.state, 'PLAYER');
      const idx = Number(args.actionIndex);
      if (!Number.isInteger(idx) || idx < 0 || idx >= legal.length) {
        throw new Error(
          `Invalid actionIndex ${args.actionIndex}. Valid range: 0..${Math.max(0, legal.length - 1)}`,
        );
      }
      applyLegalAction(
        session,
        legal[idx],
        typeof args.reasoning === 'string' ? args.reasoning : undefined,
      );
      if ((session.state.phase as string) === 'GAME_OVER') {
        recordCompletedLiveMatch(session, rootDir);
      }
      return serializeMatchObservation(session);
    }

    case 'snshero_create_1000_series': {
      const agentId = normalizeAgentKey(args.agentId);
      const targetGames = Math.min(1000, Math.max(1, Number(args.targetGames || 1000)));
      const seriesId = `series_${agentId}_${Date.now()}`;
      const factionGames = {} as Record<HeroClass, number>;
      const factionWins = {} as Record<HeroClass, number>;
      for (const cls of HERO_CLASS_ORDER) {
        factionGames[cls] = 0;
        factionWins[cls] = 0;
      }

      const tracker: LiveSeriesTracker = {
        seriesId,
        agentId,
        modelName: args.modelName || `${agentId.toUpperCase()} MCP Challenger`,
        targetGames,
        completedGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        totalTurns: 0,
        totalDecisionMs: 0,
        lethalChances: 0,
        lethalConverted: 0,
        manaAvailable: 0,
        manaSpent: 0,
        firstGames: 0,
        firstWins: 0,
        secondGames: 0,
        secondWins: 0,
        factionGames,
        factionWins,
        createdAt: new Date().toISOString(),
      };
      activeSeries.set(seriesId, tracker);
      return {
        seriesId,
        agentId,
        targetGames,
        instructions:
          'Pass this seriesId to snshero_start_match for each game. Every completed match automatically updates Win Rate, Elo, and Game IQ on /sns!',
      };
    }

    case 'snshero_run_batch_simulation': {
      const games = Math.min(1000, Math.max(1, Number(args.games || 100)));
      const playerPolicy: SimPolicyId = args.playerPolicy || 'SNSHERO_EXPERT';
      const opponentPolicy: 'SNSHERO_EXPERT' | 'SNSHERO_NORMAL' =
        args.opponentPolicy === 'SNSHERO_NORMAL' ? 'SNSHERO_NORMAL' : 'SNSHERO_EXPERT';

      const simResult = await runHeadlessSeriesAsync({
        games,
        playerPolicy,
        opponentPolicy,
      });

      if (args.updateEngineBaseline && playerPolicy === 'SNSHERO_EXPERT' && opponentPolicy === 'SNSHERO_EXPERT') {
        const store = loadBenchmarkStore(rootDir);
        const engineEntry = store.competitors.find((c) => c.agentId === 'snshero_ai');
        if (engineEntry) {
          engineEntry.origin = 'ENGINE_EMPIRICAL_1000G';
          engineEntry.updatedAt = new Date().toISOString();
          engineEntry.arenaStats.gamesCompleted = simResult.gamesRun;
          engineEntry.arenaStats.wins = simResult.wins;
          engineEntry.arenaStats.losses = simResult.losses;
          engineEntry.arenaStats.draws = simResult.draws;
          engineEntry.arenaStats.winRatePct = simResult.winRatePct;
          engineEntry.arenaStats.avgTurnsPerMatch = simResult.avgTurns;
          engineEntry.arenaStats.avgDecisionMs = Number(simResult.avgDecisionMs.toFixed(2));
          engineEntry.arenaStats.firstPlayerWinRatePct = simResult.firstPlayerWinRatePct;
          engineEntry.arenaStats.secondPlayerWinRatePct = simResult.secondPlayerWinRatePct;
          for (const cls of HERO_CLASS_ORDER) {
            engineEntry.arenaStats.factionWinRates[cls] = simResult.factionStats[cls].winRatePct;
          }
        }
        saveBenchmarkStore(store, rootDir);
      }

      return simResult;
    }

    case 'snshero_submit_evaluation': {
      const agentId = normalizeAgentKey(args.agentId);
      const pScore = Math.min(100, Math.max(0, Math.round(Number(args.planningScore))));
      const dScore = Math.min(100, Math.max(0, Math.round(Number(args.devScore))));
      const uScore = Math.min(100, Math.max(0, Math.round(Number(args.designScore))));
      const avg = Number(((pScore + dScore + uScore) / 3).toFixed(1));

      const split25 = (total: number): [number, number, number, number] => {
        const base = Math.floor(total / 4);
        const rem = total - base * 4;
        return [
          Math.min(25, base + (rem > 0 ? 1 : 0)),
          Math.min(25, base + (rem > 1 ? 1 : 0)),
          Math.min(25, base + (rem > 2 ? 1 : 0)),
          Math.min(25, base),
        ];
      };
      const [p1, p2, p3, p4] = split25(pScore);
      const [d1, d2, d3, d4] = split25(dScore);
      const [u1, u2, u3, u4] = split25(uScore);

      const store = loadBenchmarkStore(rootDir);
      const existing = store.evaluations.find((e) => e.agentId === agentId);
      const vendorMap = { claude: 'Anthropic', gemini: 'Google DeepMind', chatgpt: 'OpenAI' } as const;
      const nameMap = { claude: 'Claude Code', gemini: 'Gemini', chatgpt: 'ChatGPT' } as const;

      const updatedEval: ProductAuditEvaluation = {
        agentId,
        evaluatorName: nameMap[agentId],
        modelVersion: args.modelVersion || existing?.modelVersion || `${nameMap[agentId]} (MCP Live)`,
        vendor: vendorMap[agentId],
        origin: 'MCP_LIVE_VERIFIED',
        evaluatedAt: new Date().toISOString(),
        matchesSampled: Number(args.matchesSampled || existing?.matchesSampled || 3),
        planningScore: pScore,
        devScore: dScore,
        designScore: uScore,
        totalAverage: avg,
        breakdown: {
          planning: {
            worldbuildingAndLore: p1,
            cardPoolBalance382: p2,
            modeIsolationAndLoop: p3,
            fairEconomyPity: p4,
          },
          development: {
            deterministicEngine: d1,
            localStorageIsolation: d2,
            rendering60fpsVfx: d3,
            mcpAgentExtensibility: d4,
          },
          design: {
            battlefieldSymmetry: u1,
            zeroDuplicateArt382: u2,
            voiceBgmAndHaptics: u3,
            mobileOneHandUx: u4,
          },
        },
        headlineKo: args.headlineKo,
        headlineEn: args.headlineEn || args.headlineKo,
        reviewKo: args.reviewKo,
        reviewEn: args.reviewEn || args.reviewKo,
        strengthsKo:
          Array.isArray(args.strengthsKo) && args.strengthsKo.length > 0
            ? args.strengthsKo
            : existing?.strengthsKo || [],
        strengthsEn:
          Array.isArray(args.strengthsEn) && args.strengthsEn.length > 0
            ? args.strengthsEn
            : existing?.strengthsEn || [],
        improvementsKo:
          Array.isArray(args.improvementsKo) && args.improvementsKo.length > 0
            ? args.improvementsKo
            : existing?.improvementsKo || [],
        improvementsEn:
          Array.isArray(args.improvementsEn) && args.improvementsEn.length > 0
            ? args.improvementsEn
            : existing?.improvementsEn || [],
      };

      const idx = store.evaluations.findIndex((e) => e.agentId === agentId);
      if (idx >= 0) {
        store.evaluations[idx] = updatedEval;
      } else {
        store.evaluations.push(updatedEval);
      }
      saveBenchmarkStore(store, rootDir);
      return { ok: true, evaluation: updatedEval };
    }

    case 'snshero_get_leaderboard': {
      return loadBenchmarkStore(rootDir);
    }

    default:
      throw new Error(`Unknown MCP tool: ${name}`);
  }
}

export async function handleMcpJsonRpcPayload(
  rpcReq: any,
  rootDir = process.cwd(),
): Promise<any | null> {
  if (!rpcReq || typeof rpcReq !== 'object') {
    return {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid Request' },
    };
  }

  const { id, method, params } = rpcReq;
  const isNotification = id === undefined;

  try {
    switch (method) {
      case 'initialize': {
        const clientVersion = params?.protocolVersion || '2025-03-26';
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: clientVersion,
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false },
            },
            serverInfo: {
              name: 'snshero-mcp-arena',
              version: '2.1.0',
            },
            instructions:
              'SNSHero Official MCP Server (/mcp). Use snshero_get_game_dossier to inspect Planning/Dev/Design specs, snshero_start_match + snshero_step_action to play tactical card battles against SNSHero AI, snshero_create_1000_series for 1,000-match intelligence benchmarking, and snshero_submit_evaluation to post 100-point scores to /sns.',
          },
        };
      }

      case 'notifications/initialized':
      case 'notifications/cancelled': {
        return null;
      }

      case 'ping': {
        return { jsonrpc: '2.0', id, result: {} };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: MCP_TOOLS_MANIFEST },
        };
      }

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};
        const output = await executeMcpTool(toolName, toolArgs, rootDir);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
            structuredContent: output,
            isError: false,
          },
        };
      }

      case 'resources/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: [
              {
                uri: 'snshero://spec/architecture',
                name: 'SNSHero Architecture & Game Design Dossier',
                description: 'Full Planning, Engineering, and Design overview + 100-pt rubric',
                mimeType: 'application/json',
              },
              {
                uri: 'snshero://benchmark/leaderboard',
                name: 'SNSHero /sns AI Intelligence & Audit Leaderboard',
                description: 'Artificial Analysis v5.0.1 baseline + 1,000-game Arena results',
                mimeType: 'application/json',
              },
              {
                uri: 'snshero://rubric/100pt',
                name: 'SNSHero 100-Point Product Audit Rubric',
                description: '12 criteria (4x25pt each) across Planning, Development, and Design',
                mimeType: 'application/json',
              },
            ],
          },
        };
      }

      case 'resources/read': {
        const uri = String(params?.uri || '');
        let data: unknown;
        if (uri === 'snshero://spec/architecture') {
          data = buildGameDossier();
        } else if (uri === 'snshero://rubric/100pt') {
          data = AUDIT_RUBRIC_100PT;
        } else {
          data = loadBenchmarkStore(rootDir);
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(data, null, 2),
              },
            ],
          },
        };
      }

      case 'prompts/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            prompts: [
              {
                name: 'audit_snshero_100pt',
                description:
                  'Play 3 full games of SNSHero via MCP, inspect the game dossier, and submit a 100-point Planning / Development / Design score.',
                arguments: [
                  {
                    name: 'agentId',
                    description: 'chatgpt | gemini | claude',
                    required: true,
                  },
                ],
              },
              {
                name: 'benchmark_1000_matches',
                description:
                  'Start and run a 1,000-match series against SNSHero Expert AI to compare tactical Game IQ and Elo.',
                arguments: [
                  {
                    name: 'agentId',
                    description: 'chatgpt | gemini | claude',
                    required: true,
                  },
                ],
              },
            ],
          },
        };
      }

      case 'prompts/get': {
        const pName = params?.name;
        const agentId = params?.arguments?.agentId || 'claude';
        const promptText =
          pName === 'benchmark_1000_matches'
            ? `You are benchmarking your tactical intelligence in SNSHero against SNSHero Expert AI over 1,000 matches.\n1. Call snshero_create_1000_series({ agentId: "${agentId}", targetGames: 1000 }).\n2. Loop 1,000 times: call snshero_start_match({ agentId: "${agentId}", seriesId }) and play optimal moves via snshero_step_action until phase === "GAME_OVER".\n3. Call snshero_get_leaderboard to inspect your final Elo, Win Rate, and Game IQ on /sns.`
            : `You are evaluating SNSHero (https://snshero.com) as an official AI game critic (${agentId}).\n1. Call snshero_get_game_dossier to review Planning (382 cards, 40-ep story, 3x awakening isolation, pity economy), Development (deterministic GameEngine, hero_hs_* LocalStorage, 60fps VFX, /mcp), and Design (x=50% symmetric board, 382 unique artworks, 200 voice tracks, haptics).\n2. Play at least 3 full matches against SNSHero Expert AI using snshero_start_match and snshero_step_action.\n3. Score Planning (/100), Development (/100), and Design (/100) strictly using the 12-item rubric, then submit via snshero_submit_evaluation.`;
        return {
          jsonrpc: '2.0',
          id,
          result: {
            description: `SNSHero MCP Prompt: ${pName}`,
            messages: [
              {
                role: 'user',
                content: { type: 'text', text: promptText },
              },
            ],
          },
        };
      }

      default: {
        if (isNotification) return null;
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
      }
    }
  } catch (err: any) {
    if (isNotification) return null;
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code: -32000,
        message: err?.message || 'MCP Tool Execution Error',
      },
    };
  }
}

export function buildOpenApiSchema(baseUrl = 'http://localhost:3000') {
  return {
    openapi: '3.1.0',
    info: {
      title: 'SNSHero MCP Arena & 100-Point Audit API',
      version: '2.1.0',
      description:
        'Allows ChatGPT, Gemini, and Claude Code to play SNSHero tactical card battles, run 1,000-match benchmarks against SNSHero AI, and submit 100-point Planning/Development/Design evaluations.',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/mcp': {
        post: {
          operationId: 'mcpJsonRpc',
          summary: 'Model Context Protocol JSON-RPC 2.0 Streamable HTTP Endpoint',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: { '200': { description: 'JSON-RPC 2.0 Response' } },
        },
      },
      '/api/mcp/benchmark': {
        get: {
          operationId: 'getBenchmarkLeaderboard',
          summary: 'Get Artificial Analysis baseline + 1,000-match Arena & 100-pt Audit scores',
          responses: { '200': { description: 'Benchmark Store JSON' } },
        },
      },
      '/api/mcp/evaluate': {
        post: {
          operationId: 'submitProductEvaluation',
          summary: 'Submit 100-point Planning / Development / Design evaluation',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: MCP_TOOLS_MANIFEST.find((t) => t.name === 'snshero_submit_evaluation')
                  ?.inputSchema,
              },
            },
          },
          responses: { '200': { description: 'Saved evaluation' } },
        },
      },
    },
  };
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Mcp-Session-Id, Last-Event-ID',
  );
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

export function createMcpHttpMiddleware(rootDir = process.cwd()) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url) return next();
    const rawPath = req.url.split('?')[0].replace(/\/+$/, '') || '/';

    const isMcpRoute =
      rawPath === '/mcp' ||
      rawPath.startsWith('/mcp/') ||
      rawPath.startsWith('/api/mcp/');

    if (!isMcpRoute) return next();

    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      // 0. Markdown Agent Usage Guide (/mcp/guide.md)
      if ((rawPath === '/mcp/guide.md' || rawPath === '/mcp/guide') && req.method === 'GET') {
        const guidePath = path.join(rootDir, 'public', 'mcp-guide.md');
        const guideText = fs.existsSync(guidePath)
          ? fs.readFileSync(guidePath, 'utf8')
          : '# SNSHero /mcp Guide\nPOST JSON-RPC 2.0 to /mcp';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.end(guideText);
        return;
      }

      // 1. OpenAPI 3.1 Schema for ChatGPT Actions
      if (rawPath === '/mcp/openapi.json' && req.method === 'GET') {
        const host = req.headers.host || 'localhost:3000';
        const proto = (req.headers['x-forwarded-proto'] as string) || 'http';
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(buildOpenApiSchema(`${proto}://${host}`), null, 2));
        return;
      }

      // 2. MCP SSE Stream (GET /mcp with text/event-stream OR GET /mcp/sse)
      const accept = String(req.headers.accept || '');
      if (
        req.method === 'GET' &&
        (rawPath === '/mcp/sse' || (rawPath === '/mcp' && accept.includes('text/event-stream')))
      ) {
        const sessionId = `mcp_sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Mcp-Session-Id', sessionId);
        res.write(`event: endpoint\ndata: /mcp/messages?sessionId=${sessionId}\n\n`);
        sseClients.set(sessionId, res);
        req.on('close', () => {
          sseClients.delete(sessionId);
        });
        return;
      }

      // 3. Discovery Manifest on GET /mcp (Browser / Health Check)
      if (rawPath === '/mcp' && req.method === 'GET') {
        ensureNodeCardDbLoaded(rootDir);
        const store = loadBenchmarkStore(rootDir);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify(
            {
              status: 'online',
              protocol: 'Model Context Protocol (MCP)',
              supportedVersions: ['2025-03-26', '2024-11-05'],
              transports: {
                streamableHttp: '/mcp (POST JSON-RPC 2.0)',
                sse: '/mcp/sse (GET) + /mcp/messages (POST)',
                stdioCommand: 'npx tsx scripts/mcp-server.ts --stdio',
                openApiActions: '/mcp/openapi.json',
                dashboardUi: '/sns',
              },
              serverInfo: {
                name: 'snshero-mcp-arena',
                version: '2.1.0',
                collectibleCardsLoaded: cardDb.getAllCollectible().length,
                activeMatchSessions: activeMatches.size,
                active1000Series: activeSeries.size,
              },
              quickConnect: {
                claudeCodeHttp: 'claude mcp add --transport http snshero http://localhost:3000/mcp',
                claudeCodeStdio: 'claude mcp add snshero -- npx tsx scripts/mcp-server.ts --stdio',
                geminiCli: 'gemini mcp add --transport http snshero http://localhost:3000/mcp',
                chatgptConnector: 'http://localhost:3000/mcp (or import /mcp/openapi.json)',
              },
              tools: MCP_TOOLS_MANIFEST.map((t) => ({ name: t.name, description: t.description })),
              benchmarkSummary: store.competitors.map((c) => ({
                agentId: c.agentId,
                model: c.modelLabel,
                aaIntelligenceIndex: c.aaMetrics.intelligenceIndex,
                gameIqScore: c.arenaStats.gameIqScore,
                winRate1000G: `${c.arenaStats.winRatePct}%`,
                origin: c.origin,
              })),
            },
            null,
            2,
          ),
        );
        return;
      }

      // 4. Streamable HTTP JSON-RPC 2.0 (POST /mcp or POST /mcp/messages)
      if ((rawPath === '/mcp' || rawPath === '/mcp/messages') && req.method === 'POST') {
        const urlObj = new URL(req.url, 'http://localhost');
        const sessionId =
          urlObj.searchParams.get('sessionId') ||
          (req.headers['mcp-session-id'] as string) ||
          `mcp_${Date.now()}`;
        res.setHeader('Mcp-Session-Id', sessionId);

        const body = await readJsonBody(req);
        const isBatch = Array.isArray(body);
        const responses = isBatch
          ? (await Promise.all(body.map((item) => handleMcpJsonRpcPayload(item, rootDir)))).filter(
              Boolean,
            )
          : await handleMcpJsonRpcPayload(body, rootDir);

        const ssePipe = sseClients.get(sessionId);
        if (rawPath === '/mcp/messages' && ssePipe && responses) {
          ssePipe.write(`event: message\ndata: ${JSON.stringify(responses)}\n\n`);
          res.statusCode = 202;
          res.end('Accepted');
          return;
        }

        if (!responses || (Array.isArray(responses) && responses.length === 0)) {
          res.statusCode = 202;
          res.end();
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(responses));
        return;
      }

      // 5. REST Convenience Endpoints for /sns Dashboard & CLI Scripts
      if (rawPath === '/api/mcp/status' && req.method === 'GET') {
        ensureNodeCardDbLoaded(rootDir);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(
          JSON.stringify({
            online: true,
            cardsLoaded: cardDb.getAllCollectible().length,
            activeMatches: activeMatches.size,
            activeSeries: activeSeries.size,
            toolsCount: MCP_TOOLS_MANIFEST.length,
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }

      if (rawPath === '/api/mcp/benchmark' && req.method === 'GET') {
        const store = loadBenchmarkStore(rootDir);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(store));
        return;
      }

      if (rawPath === '/api/mcp/simulate' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const out = await executeMcpTool('snshero_run_batch_simulation', body, rootDir);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(out));
        return;
      }

      if (rawPath === '/api/mcp/evaluate' && req.method === 'POST') {
        const body = await readJsonBody(req);
        const out = await executeMcpTool('snshero_submit_evaluation', body, rootDir);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(out));
        return;
      }

      if (rawPath === '/api/mcp/reset-baseline' && req.method === 'POST') {
        const fresh = createDefaultBenchmarkStore();
        saveBenchmarkStore(fresh, rootDir);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true, store: fresh }));
        return;
      }

      next();
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err?.message || 'Internal MCP Server Error' }));
    }
  };
}
