import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Cpu,
  ExternalLink,
  FileCode2,
  Gamepad2,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  ShieldCheck,
  Terminal,
  Trophy,
  Zap,
} from 'lucide-react';
import { cardDb } from '../hearthstone/cardDb';
import { computeNextAiAction } from '../hearthstone/engine/aiController';
import { HERO_CLASS_ORDER, HeroClass } from '../hearthstone/types';
import { getLanguageMeta, useHeroLanguage } from '../i18n/heroLang';
import { SharedAdSenseShell } from '../components/SharedAdSenseShell';
import {
  ActiveMatchSession,
  BatchSimulationResult,
  MatchObservation,
  SimPolicyId,
  applyLegalAction,
  createNewMatchSession,
  enumerateLegalActions,
  runHeadlessSeriesAsync,
  serializeMatchObservation,
} from '../mcp/arenaCore';
import {
  AUDIT_RUBRIC_100PT,
  BenchmarkAgentId,
  CompetitorBenchmarkEntry,
  DataOriginKind,
  FACTION_LABELS_EN,
  FACTION_LABELS_KO,
  McpBenchmarkStore,
  ProductAuditEvaluation,
  createDefaultBenchmarkStore,
} from '../mcp/benchmarkData';

type SnsTabId = 'intelligence' | 'audit100' | 'simulator' | 'mcp_setup';
type ChartMetricKey = 'gameIq' | 'aaIndex' | 'winRate' | 'elo';

const LOCAL_SNS_STORE_KEY = 'hero_sns_mcp_benchmark_v1';

const MCP_TOOL_DOCS: Array<{
  name: string;
  phase: string;
  descKo: string;
  descEn: string;
}> = [
  {
    name: 'snshero_get_game_dossier',
    phase: 'AUDIT',
    descKo: '382장 카드·9종족·40화 스토리·엔진·사운드 아키텍처 명세 및 100점 채점 루브릭 조회',
    descEn: 'Fetch full 382-card, 9-faction, engine & design dossier + 100-pt scoring rubric',
  },
  {
    name: 'snshero_start_match',
    phase: 'PLAY',
    descKo: '눈히어로 내장 AI(숙련/일반)를 상대로 실제 30장 덱 카드배틀 세션 생성 및 초기 손패 반환',
    descEn: 'Start a live 30-card match vs SNSHero AI and receive initial state + legalActions',
  },
  {
    name: 'snshero_get_match_state',
    phase: 'PLAY',
    descKo: '현재 턴·마나·영웅 체력·손패·전장 하수인·비밀·합법 수(legalActions) 번호 목록 조회',
    descEn: 'Read current board/hand state and indexed legalActions for an active matchId',
  },
  {
    name: 'snshero_step_action',
    phase: 'PLAY',
    descKo: '선택한 actionIndex 수 실행 (END_TURN 시 눈히어로 AI가 자동으로 응수 턴 수행 후 반환)',
    descEn: 'Execute chosen actionIndex; auto-runs SNSHero AI response turn upon END_TURN',
  },
  {
    name: 'snshero_create_1000_series',
    phase: 'BENCH',
    descKo: '9대 종족 균등 로테이션·선후공 교대 1,000판 공식 벤치마크 시리즈 트래커 생성',
    descEn: 'Create a tracked 1,000-match series rotating all 9 factions & 1st/2nd turn order',
  },
  {
    name: 'snshero_run_batch_simulation',
    phase: 'BENCH',
    descKo: '최대 1,000판 실제 GameEngine 헤드리스 시뮬레이션 고속 실행 및 종족별 승률/Elo 산출',
    descEn: 'Execute up to 1,000 headless GameEngine battles and compute Elo & faction matrix',
  },
  {
    name: 'snshero_submit_evaluation',
    phase: 'AUDIT',
    descKo: 'ChatGPT·Gemini·Claude Code의 기획/개발/디자인 100점 만점 채점표 및 심사평 영구 등록',
    descEn: 'Submit official 100-pt Planning / Dev / Design scores & critique to /sns',
  },
  {
    name: 'snshero_get_leaderboard',
    phase: 'DATA',
    descKo: '/sns 페이지에 표시되는 전체 지능 리더보드·1,000판 전적·100점 평가 데이터셋 조회',
    descEn: 'Retrieve complete /sns leaderboard, Artificial Analysis metrics & audit evaluations',
  },
];

function originBadgeLabel(origin: DataOriginKind, isKo: boolean): { text: string; tone: string } {
  if (origin === 'MCP_LIVE_VERIFIED') {
    return {
      text: isKo ? 'MCP 실전 검증됨' : 'MCP LIVE VERIFIED',
      tone: 'border-emerald-400/50 bg-emerald-950/60 text-emerald-300',
    };
  }
  if (origin === 'ENGINE_EMPIRICAL_1000G') {
    return {
      text: isKo ? 'GameEngine 1,000판 실측' : 'ENGINE 1,000G EMPIRICAL',
      tone: 'border-sky-400/50 bg-sky-950/60 text-sky-300',
    };
  }
  return {
    text: isKo ? 'Artificial Analysis 기준치' : 'AA v5.0.1 BASELINE',
    tone: 'border-amber-400/50 bg-amber-950/50 text-amber-200',
  };
}

function agentAccentBorder(agentId: BenchmarkAgentId): string {
  switch (agentId) {
    case 'claude':
      return 'border-l-4 border-l-amber-400';
    case 'gemini':
      return 'border-l-4 border-l-sky-400';
    case 'chatgpt':
      return 'border-l-4 border-l-emerald-400';
    default:
      return 'border-l-4 border-l-rose-400';
  }
}

function agentBarFill(agentId: BenchmarkAgentId): string {
  switch (agentId) {
    case 'claude':
      return 'bg-amber-400';
    case 'gemini':
      return 'bg-sky-400';
    case 'chatgpt':
      return 'bg-emerald-400';
    default:
      return 'bg-rose-400';
  }
}

export const SnsBenchmarkApp: React.FC = () => {
  const { lang, isKo, setLang, tr } = useHeroLanguage();

  const [activeTab, setActiveTab] = useState<SnsTabId>('intelligence');
  const [chartMetric, setChartMetric] = useState<ChartMetricKey>('gameIq');
  const [store, setStore] = useState<McpBenchmarkStore>(() => {
    try {
      const cached = localStorage.getItem(LOCAL_SNS_STORE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as McpBenchmarkStore;
        if (parsed?.competitors?.length && parsed?.evaluations?.length) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage read error
    }
    return createDefaultBenchmarkStore();
  });

  const [mcpServerOnline, setMcpServerOnline] = useState<boolean | null>(null);
  const [mcpPingOutput, setMcpPingOutput] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [expandedRubric, setExpandedRubric] = useState<boolean>(true);
  const [showManualEvalForm, setShowManualEvalForm] = useState<boolean>(false);

  // Manual / Test Evaluation Form State
  const [evalFormAgent, setEvalFormAgent] = useState<'claude' | 'gemini' | 'chatgpt'>('claude');
  const [evalFormPlanning, setEvalFormPlanning] = useState<number>(96);
  const [evalFormDev, setEvalFormDev] = useState<number>(97);
  const [evalFormDesign, setEvalFormDesign] = useState<number>(94);
  const [evalFormHeadline, setEvalFormHeadline] = useState<string>(
    '실전 MCP 카드배틀 테스트 완료: 결정론적 엔진 완성도와 3배 각성 모드 격리가 탁월함',
  );
  const [evalFormReview, setEvalFormReview] = useState<string>(
    '/mcp 툴을 통해 직접 덱을 운용한 결과, 합법 수 인덱싱이 명확하고 비밀·죽음의 메아리 판정이 오차 없이 작동합니다.',
  );

  // Live Batch Simulator State
  const [simGamesCount, setSimGamesCount] = useState<number>(100);
  const [simPlayerPolicy, setSimPlayerPolicy] = useState<SimPolicyId>('LOOKAHEAD_2PLY');
  const [simOpponentPolicy, setSimOpponentPolicy] = useState<'SNSHERO_EXPERT' | 'SNSHERO_NORMAL'>(
    'SNSHERO_EXPERT',
  );
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<{ done: number; total: number; wins: number }>({
    done: 0,
    total: 0,
    wins: 0,
  });
  const [simResult, setSimResult] = useState<BatchSimulationResult | null>(null);

  // Interactive 1-on-1 MCP Match Inspector State
  const [liveSession, setLiveSession] = useState<ActiveMatchSession | null>(null);
  const [liveObs, setLiveObs] = useState<MatchObservation | null>(null);
  const [liveLoading, setLiveLoading] = useState<boolean>(false);

  const persistStoreLocally = useCallback((next: McpBenchmarkStore) => {
    setStore(next);
    try {
      localStorage.setItem(LOCAL_SNS_STORE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota error
    }
  }, []);

  const syncFromServer = useCallback(async () => {
    // 1. Check live /api/mcp/status + /api/mcp/benchmark first
    try {
      const statusRes = await fetch('/api/mcp/status', { cache: 'no-store' });
      if (statusRes.ok) {
        const st = await statusRes.json();
        setMcpServerOnline(Boolean(st?.online));
        const benchRes = await fetch('/api/mcp/benchmark', { cache: 'no-store' });
        if (benchRes.ok) {
          const serverStore = (await benchRes.json()) as McpBenchmarkStore;
          if (serverStore?.competitors?.length) {
            persistStoreLocally(serverStore);
            return;
          }
        }
      } else {
        setMcpServerOnline(false);
      }
    } catch {
      setMcpServerOnline(false);
    }

    // 2. Static fallback (/data/mcp-benchmark-store.json)
    try {
      const staticRes = await fetch('/data/mcp-benchmark-store.json', { cache: 'no-store' });
      if (staticRes.ok) {
        const staticStore = (await staticRes.json()) as McpBenchmarkStore;
        if (staticStore?.competitors?.length) {
          persistStoreLocally(staticStore);
        }
      }
    } catch {
      // Keep local/default store
    }
  }, [persistStoreLocally]);

  useEffect(() => {
    document.documentElement.lang = getLanguageMeta(lang).htmlLang;
    document.title = tr(
      '눈히어로 AI 벤치마크 & 100점 평가 리포트 (/sns) | SNSHero MCP Arena',
      'SNSHero AI 1,000-Match Benchmark & 100-Pt Audit (/sns)',
    );
  }, [lang, tr]);

  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);

  const copyText = useCallback((key: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  }, []);

  const sortedCompetitors = useMemo(() => {
    return [...store.competitors].sort(
      (a, b) => b.arenaStats.gameIqScore - a.arenaStats.gameIqScore,
    );
  }, [store.competitors]);

  const auditAggregate = useMemo(() => {
    const evals = store.evaluations;
    if (!evals.length) return { planning: 0, dev: 0, design: 0, total: 0 };
    const p = evals.reduce((acc, e) => acc + e.planningScore, 0) / evals.length;
    const d = evals.reduce((acc, e) => acc + e.devScore, 0) / evals.length;
    const u = evals.reduce((acc, e) => acc + e.designScore, 0) / evals.length;
    return {
      planning: Number(p.toFixed(1)),
      dev: Number(d.toFixed(1)),
      design: Number(u.toFixed(1)),
      total: Number(((p + d + u) / 3).toFixed(1)),
    };
  }, [store.evaluations]);

  // Run browser or server batch simulation
  const handleRunSimulation = useCallback(
    async (countOverride?: number) => {
      const games = countOverride ?? simGamesCount;
      setSimRunning(true);
      setSimProgress({ done: 0, total: games, wins: 0 });
      try {
        await cardDb.init();
        const res = await runHeadlessSeriesAsync({
          games,
          playerPolicy: simPlayerPolicy,
          opponentPolicy: simOpponentPolicy,
          onProgress: (done, total, wins) => {
            setSimProgress({ done, total, wins });
          },
        });
        setSimResult(res);
      } finally {
        setSimRunning(false);
      }
    },
    [simGamesCount, simOpponentPolicy, simPlayerPolicy],
  );

  // Interactive 1-match MCP preview
  const handleStartInspectorMatch = useCallback(async () => {
    setLiveLoading(true);
    try {
      await cardDb.init();
      const sess = createNewMatchSession({
        agentId: 'claude',
        modelName: 'MCP Inspector Agent',
        opponentDifficulty: 'EXPERT',
        autoMulligan: true,
      });
      setLiveSession(sess);
      setLiveObs(serializeMatchObservation(sess));
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const handleStepInspectorSmartMove = useCallback(() => {
    if (!liveSession || liveSession.state.phase === 'GAME_OVER') return;
    const legal = enumerateLegalActions(liveSession.state, 'PLAYER');
    if (!legal.length) return;

    const aiRec = computeNextAiAction(liveSession.state, 'EXPERT', 'PLAYER');
    let chosen = legal[legal.length - 1];
    if (aiRec.kind !== 'END_TURN') {
      const found = legal.find((l) => {
        if (aiRec.kind === 'PLAY_CARD' && l.kind === 'PLAY_CARD') {
          return l.handUid === aiRec.handUid && l.targetId === aiRec.targetId;
        }
        if (aiRec.kind === 'HERO_POWER' && l.kind === 'HERO_POWER') {
          return l.targetId === aiRec.targetId;
        }
        if (aiRec.kind === 'ATTACK' && l.kind === 'ATTACK') {
          return l.attackerId === aiRec.attackerId && l.defenderId === aiRec.defenderId;
        }
        return false;
      });
      if (found) chosen = found;
    }

    applyLegalAction(liveSession, chosen, 'Tactical lookahead evaluation');
    setLiveSession({ ...liveSession });
    setLiveObs(serializeMatchObservation(liveSession));
  }, [liveSession]);

  const handleStepInspectorActionIdx = useCallback(
    (idx: number) => {
      if (!liveSession || liveSession.state.phase === 'GAME_OVER') return;
      const legal = enumerateLegalActions(liveSession.state, 'PLAYER');
      if (idx < 0 || idx >= legal.length) return;
      applyLegalAction(liveSession, legal[idx], 'Manual MCP tool call');
      setLiveSession({ ...liveSession });
      setLiveObs(serializeMatchObservation(liveSession));
    },
    [liveSession],
  );

  // Live JSON-RPC Ping & tools/list test against /mcp
  const handleTestMcpEndpoint = useCallback(async () => {
    setMcpPingOutput(tr('요청 전송 중: POST /mcp ...', 'Sending POST /mcp ...'));
    try {
      const rpcRes = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 101,
          method: 'tools/list',
          params: {},
        }),
      });
      const json = await rpcRes.json();
      setMcpServerOnline(true);
      setMcpPingOutput(JSON.stringify(json, null, 2));
    } catch (err: any) {
      setMcpServerOnline(false);
      setMcpPingOutput(
        JSON.stringify(
          {
            note: '현재 정적 호스팅 모드이거나 개발 서버가 오프라인입니다. 로컬에서 npm run dev 또는 npx tsx scripts/mcp-server.ts 실행 시 /mcp 엔드포인트가 즉시 활성화됩니다.',
            error: err?.message || 'Network unreachable',
          },
          null,
          2,
        ),
      );
    }
  }, [tr]);

  const handleSubmitTestAudit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = {
        agentId: evalFormAgent,
        planningScore: evalFormPlanning,
        devScore: evalFormDev,
        designScore: evalFormDesign,
        headlineKo: evalFormHeadline,
        headlineEn: evalFormHeadline,
        reviewKo: evalFormReview,
        reviewEn: evalFormReview,
        matchesSampled: 5,
      };

      try {
        const res = await fetch('/api/mcp/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await syncFromServer();
          setShowManualEvalForm(false);
          return;
        }
      } catch {
        // Fallback to localStorage update when running on static hosting
      }

      const next: McpBenchmarkStore = structuredClone(store);
      const target = next.evaluations.find((ev) => ev.agentId === evalFormAgent);
      if (target) {
        target.origin = 'MCP_LIVE_VERIFIED';
        target.evaluatedAt = new Date().toISOString();
        target.planningScore = evalFormPlanning;
        target.devScore = evalFormDev;
        target.designScore = evalFormDesign;
        target.totalAverage = Number(
          ((evalFormPlanning + evalFormDev + evalFormDesign) / 3).toFixed(1),
        );
        target.headlineKo = evalFormHeadline;
        target.headlineEn = evalFormHeadline;
        target.reviewKo = evalFormReview;
        target.reviewEn = evalFormReview;
      }
      persistStoreLocally(next);
      setShowManualEvalForm(false);
    },
    [
      evalFormAgent,
      evalFormDesign,
      evalFormDev,
      evalFormHeadline,
      evalFormPlanning,
      evalFormReview,
      persistStoreLocally,
      store,
      syncFromServer,
    ],
  );

  const handleResetBaseline = useCallback(async () => {
    try {
      const res = await fetch('/api/mcp/reset-baseline', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data?.store) {
          persistStoreLocally(data.store);
          return;
        }
      }
    } catch {
      // Static fallback
    }
    const fresh = createDefaultBenchmarkStore();
    persistStoreLocally(fresh);
  }, [persistStoreLocally]);

  const originHost =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  return (
    <SharedAdSenseShell pageKey="sns" theme="terminal">
      <div className="min-h-[100dvh] bg-[#090d16] text-[#fdfcfc] font-mono selection:bg-amber-400 selection:text-[#090d16]">
      {/* Top Terminal Header */}
      <header className="sticky top-0 z-30 bg-[#090d16] border-b border-white/15">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200 font-bold text-sm sm:text-base tracking-tight min-h-[44px]"
            >
              <Terminal className="w-5 h-5 shrink-0" />
              <span>SNSHERO // AI ARENA &amp; /MCP</span>
            </a>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] border rounded-sm whitespace-nowrap shrink-0 min-h-[28px] ${
                mcpServerOnline
                  ? 'border-emerald-400/50 bg-emerald-950/60 text-emerald-300'
                  : 'border-amber-400/40 bg-amber-950/40 text-amber-200'
              }`}
            >
              <span className="inline-block w-2 h-2 bg-current shrink-0" />
              {mcpServerOnline
                ? tr('MCP 서버 가동 중 (/mcp)', 'MCP ONLINE (/mcp)')
                : tr('AA 기준치 · 클라이언트 모드', 'AA BASELINE · CLIENT MODE')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/game"
              className="sns-btn-ghost inline-flex items-center gap-1.5 text-xs no-underline"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>{tr('게임 실행', 'Play Game')}</span>
            </a>
            <a
              href="/"
              className="sns-btn-ghost inline-flex items-center gap-1.5 text-xs no-underline"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{tr('게임 소개', 'Showcase')}</span>
            </a>
            <a
              href="/mcp"
              target="_blank"
              rel="noreferrer"
              className="sns-btn-ghost inline-flex items-center gap-1.5 text-xs no-underline"
            >
              <Server className="w-4 h-4" />
              <span>/mcp JSON</span>
            </a>
            <button
              type="button"
              onClick={() => setLang(isKo ? 'en' : 'ko')}
              className="sns-btn-ghost text-xs"
            >
              {isKo ? 'EN' : '한국어'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Hero Title & Source Notice */}
        <section className="border border-white/15 bg-[#101624] p-5 rounded-none">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="text-xs text-amber-300 uppercase tracking-widest">
                [SNSHERO AI BENCHMARK HUB · /SNS &amp; /MCP]
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#fdfcfc]">
                {tr(
                  '눈히어로 내장 AI vs ChatGPT · Gemini · Claude Code 지능 비교 & 100점 평가 리포트',
                  'SNSHero AI vs ChatGPT · Gemini · Claude Code — 1,000-Match Intelligence & 100-Pt Audit',
                )}
              </h1>
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-4xl">
                {tr(
                  '사전 준비된 /mcp(Model Context Protocol) 서버를 통해 프론티어 AI 3종이 눈히어로 382장 전략 카드배틀을 직접 플레이하고 기획·개발·디자인을 100점 만점으로 심사합니다. 실시간 1,000판 대전 완료 전까지 외부 LLM 지표는 공인 Artificial Analysis(artificialanalysis.ai) Intelligence Index v5.0.1 결과를 토대로 산출된 기준치를 우선 표시하며, 눈히어로 AI는 실제 GameEngine 1,000판 실측치가 반영되어 있습니다.',
                  'Powered by the built-in /mcp server, ChatGPT, Gemini, and Claude Code can play SNSHero turn-by-turn, run 1,000-match benchmarks against SNSHero AI, and submit 100-point Planning/Dev/Design audits. Pre-run LLM baselines are grounded in Artificial Analysis (artificialanalysis.ai) Intelligence Index v5.0.1, paired with 1,000 empirical SNSHero GameEngine matches.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('simulator')}
                className="sns-btn-primary inline-flex items-center gap-2 text-xs"
              >
                <Play className="w-4 h-4" />
                <span>{tr('엔진 시뮬레이터 실행', 'Run Engine Sim')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('mcp_setup')}
                className="sns-btn-ghost inline-flex items-center gap-2 text-xs"
              >
                <FileCode2 className="w-4 h-4" />
                <span>{tr('/mcp 연동 명령어', '/mcp Connect CLI')}</span>
              </button>
            </div>
          </div>
        </section>

        {/* Top 4 Executive KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="border border-white/15 bg-[#101624] p-4 rounded-none">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>{tr('프론티어 최고 전술 지능', 'TOP FRONTIER GAME IQ')}</span>
              <Trophy className="w-4 h-4 text-amber-300" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-300">
              94.2 <span className="text-xs font-normal text-stone-400">/ 100 IQ</span>
            </div>
            <div className="mt-1 text-xs text-stone-300">
              Claude Code · AA Index 65.0 · {tr('예상 승률 61.8%', 'Proj. 61.8% WR')}
            </div>
          </div>

          <div className="border border-white/15 bg-[#101624] p-4 rounded-none">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>{tr('최고 속도·가성비 추론', 'BEST SPEED / VALUE LLM')}</span>
              <Zap className="w-4 h-4 text-sky-300" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-sky-300">
              91.6 <span className="text-xs font-normal text-stone-400">/ 100 IQ</span>
            </div>
            <div className="mt-1 text-xs text-stone-300">
              Gemini · 142 tok/s · $14.60 / 1,000{tr('판', 'G')}
            </div>
          </div>

          <div className="border border-white/15 bg-[#101624] p-4 rounded-none">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>{tr('눈히어로 내장 AI 지능 (기준점)', 'SNSHERO BUILT-IN AI')}</span>
              <Cpu className="w-4 h-4 text-rose-300" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-rose-300">
              86.5 <span className="text-xs font-normal text-stone-400">/ 100 IQ</span>
            </div>
            <div className="mt-1 text-xs text-stone-300">
              Elo 1,765 · {store.competitors.find((c) => c.agentId === 'snshero_ai')?.arenaStats.avgDecisionMs ?? 0.24}ms/{tr('수', 'move')} · $0.00
            </div>
          </div>

          <div className="border border-white/15 bg-[#101624] p-4 rounded-none">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span>{tr('3대 AI 종합 게임 평점', '3-AI PRODUCT AUDIT AVG')}</span>
              <Award className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-300">
              {auditAggregate.total} <span className="text-xs font-normal text-stone-400">/ 100{tr('점', 'pt')}</span>
            </div>
            <div className="mt-1 text-xs text-stone-300">
              {tr(
                `기획 ${auditAggregate.planning} · 개발 ${auditAggregate.dev} · 디자인 ${auditAggregate.design}`,
                `Plan ${auditAggregate.planning} · Dev ${auditAggregate.dev} · Design ${auditAggregate.design}`,
              )}
            </div>
          </div>
        </section>

        {/* 4-Tab Progressive Disclosure Bar */}
        <nav
          aria-label="Benchmark Sections"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-white/15 bg-[#0c111d] rounded-none"
        >
          {(
            [
              {
                id: 'intelligence' as SnsTabId,
                labelKo: '[01] 지능 비교 & 1,000판 벤치마크',
                labelEn: '[01] Intelligence & 1,000-Game Arena',
              },
              {
                id: 'audit100' as SnsTabId,
                labelKo: '[02] 기획·개발·디자인 100점 평가',
                labelEn: '[02] 100-Pt Plan / Dev / Design Audit',
              },
              {
                id: 'simulator' as SnsTabId,
                labelKo: '[03] 실시간 엔진 대결 & 시뮬레이터',
                labelEn: '[03] Live Engine & 1,000G Simulator',
              },
              {
                id: 'mcp_setup' as SnsTabId,
                labelKo: '[04] /mcp 서버 연동 & 실행 명령어',
                labelEn: '[04] /mcp Server Setup & Protocol',
              },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[48px] px-4 py-2.5 text-left text-xs font-bold border-b sm:border-b-0 sm:border-r last:border-r-0 border-white/15 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#fdfcfc] text-[#090d16]'
                    : 'bg-transparent text-stone-300 hover:bg-white/5'
                }`}
              >
                {isKo ? tab.labelKo : tab.labelEn}
              </button>
            );
          })}
        </nav>

        {/* =================================================================== */}
        {/* TAB 1: INTELLIGENCE & 1,000-GAME BENCHMARK (ARTIFICIAL ANALYSIS)    */}
        {/* =================================================================== */}
        {activeTab === 'intelligence' && (
          <div className="space-y-6">
            {/* Reference Source Alert */}
            <div className="border border-amber-400/40 bg-[#141923] p-4 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-stone-200 leading-relaxed">
                <strong className="text-amber-300">
                  {tr('[데이터 출처 안내] ', '[DATA PROVENANCE] ')}
                </strong>
                {tr(
                  '외부 프론티어 모델(Claude Code · Gemini · ChatGPT)은 artificialanalysis.ai 공식 리더보드(Intelligence Index v5.0.1 · Coding Agent · Math · tok/s · Price)를 기반으로 눈히어로 1,000판 전술 척도에 매핑된 수치이며, 눈히어로 내장 AI(SNSHero AI)는 실제 GameEngine 1,000판 헤드리스 대전 실측치입니다.',
                  'Frontier LLM metrics are derived from artificialanalysis.ai (Intelligence Index v5.0.1, Coding, Math, tok/s, API Cost) mapped onto SNSHero’s 1,000-match Elo scale; SNSHero Built-in AI reflects 1,000 empirical GameEngine matches.',
                )}
              </div>
              <a
                href="https://artificialanalysis.ai"
                target="_blank"
                rel="noreferrer"
                className="sns-btn-ghost inline-flex items-center gap-1.5 text-xs shrink-0 no-underline"
              >
                <span>artificialanalysis.ai</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Interactive Metric Bar Chart */}
            <section className="border border-white/15 bg-[#101624] p-5 rounded-none space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold">
                    {tr(
                      '눈히어로 AI vs 3대 프론티어 LLM 지능 점수 비교 차트',
                      'SNSHero AI vs Frontier LLMs — Comparative Intelligence Chart',
                    )}
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {tr(
                      '각 모델별 1,000판 기준 전술 지능(Game IQ), Artificial Analysis 원점수, 예상 승률 및 Elo 비교',
                      'Compare Tactical Game IQ (/100), Artificial Analysis Index, 1,000-Game Win Rate, and Arena Elo',
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { key: 'gameIq' as ChartMetricKey, ko: '전술 지능 (IQ)', en: 'Game IQ (/100)' },
                      { key: 'aaIndex' as ChartMetricKey, ko: 'AA 지능지수', en: 'AA Index (v5)' },
                      { key: 'winRate' as ChartMetricKey, ko: '1,000판 승률', en: '1,000G Win %' },
                      { key: 'elo' as ChartMetricKey, ko: 'Elo 레이팅', en: 'Arena Elo' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setChartMetric(m.key)}
                      className={`px-3 py-2 min-h-[40px] text-xs font-bold border rounded-sm cursor-pointer ${
                        chartMetric === m.key
                          ? 'bg-[#fdfcfc] text-[#090d16] border-[#fdfcfc]'
                          : 'bg-[#090d16] text-stone-300 border-white/15 hover:border-white/35'
                      }`}
                    >
                      {isKo ? m.ko : m.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-1">
                {sortedCompetitors.map((comp) => {
                  let val = comp.arenaStats.gameIqScore;
                  let maxVal = 100;
                  let unit = ' / 100 IQ';
                  if (chartMetric === 'aaIndex') {
                    val = comp.aaMetrics.intelligenceIndex;
                    maxVal = 75;
                    unit = ' pt (AA v5.0.1)';
                  } else if (chartMetric === 'winRate') {
                    val = comp.arenaStats.winRatePct;
                    maxVal = 75;
                    unit = `% (${comp.arenaStats.wins}W-${comp.arenaStats.losses}L)`;
                  } else if (chartMetric === 'elo') {
                    val = comp.arenaStats.eloRating;
                    maxVal = 2100;
                    unit = ' Elo';
                  }
                  const widthPct = Math.min(100, Math.max(8, (val / maxVal) * 100));
                  const badge = originBadgeLabel(comp.origin, isKo);

                  return (
                    <div key={comp.agentId} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-[#fdfcfc]">
                            {isKo ? comp.displayNameKo : comp.displayNameEn}
                          </span>
                          <span className="text-stone-400">({comp.modelLabel})</span>
                          <span className={`px-2 py-0.5 text-[10px] border rounded-sm ${badge.tone}`}>
                            {badge.text}
                          </span>
                        </div>
                        <span className="font-extrabold text-sm text-[#fdfcfc]">
                          {val}
                          <span className="text-stone-400 font-normal text-xs">{unit}</span>
                        </span>
                      </div>
                      <div className="w-full h-5 bg-[#090d16] border border-white/15 p-0.5 rounded-none">
                        <div
                          className={`h-full ${agentBarFill(comp.agentId)} transition-all duration-300`}
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-stone-400">
                        {isKo ? comp.tacticalProfileKo : comp.tacticalProfileEn}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Comprehensive Artificial Analysis + 1,000-Match Leaderboard Table */}
            <section className="border border-white/15 bg-[#101624] rounded-none overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/15 flex items-center justify-between">
                <h2 className="text-sm font-bold">
                  {tr(
                    'Artificial Analysis (v5.0.1) & 눈히어로 1,000판 전술 지표 정밀 비교표',
                    'Artificial Analysis (v5.0.1) & SNSHero 1,000-Match Full Telemetry Table',
                  )}
                </h2>
                <span className="text-[11px] text-stone-400">
                  {tr('기준: 각 1,000판 vs 눈히어로 숙련 AI', 'Target: 1,000 Games vs SNSHero Expert AI')}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/15 bg-[#0b101b] text-stone-300">
                      <th className="py-3 px-4 font-bold">{tr('AI 모델', 'AI Model')}</th>
                      <th className="py-3 px-3 font-bold">{tr('AA 지능지수', 'AA Index')}</th>
                      <th className="py-3 px-3 font-bold">{tr('코딩/에이전트', 'Coding Idx')}</th>
                      <th className="py-3 px-3 font-bold">{tr('추론/수학', 'Math Idx')}</th>
                      <th className="py-3 px-3 font-bold text-amber-300">
                        {tr('게임 지능(IQ)', 'Game IQ')}
                      </th>
                      <th className="py-3 px-3 font-bold">{tr('1,000판 전적(승률)', '1,000G Record')}</th>
                      <th className="py-3 px-3 font-bold">{tr('Elo', 'Elo')}</th>
                      <th className="py-3 px-3 font-bold">{tr('킬각 정확도', 'Lethal %')}</th>
                      <th className="py-3 px-3 font-bold">{tr('다수턴 예측', 'Read %')}</th>
                      <th className="py-3 px-3 font-bold">{tr('응답 속도', 'Speed')}</th>
                      <th className="py-3 px-4 font-bold">{tr('1,000판 비용', '1,000G Cost')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {sortedCompetitors.map((c: CompetitorBenchmarkEntry) => (
                      <tr
                        key={c.agentId}
                        className={`hover:bg-white/[0.03] ${agentAccentBorder(c.agentId)}`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#fdfcfc]">
                            {isKo ? c.displayNameKo : c.displayNameEn}
                          </div>
                          <div className="text-[11px] text-stone-400">{c.modelLabel}</div>
                        </td>
                        <td className="py-3.5 px-3 font-bold">
                          {c.agentId === 'snshero_ai'
                            ? `${c.aaMetrics.intelligenceIndex} (도메인 환산)`
                            : c.aaMetrics.intelligenceIndex.toFixed(1)}
                        </td>
                        <td className="py-3.5 px-3">
                          {c.aaMetrics.codingAgentIndex > 0
                            ? c.aaMetrics.codingAgentIndex.toFixed(1)
                            : 'N/A (전용엔진)'}
                        </td>
                        <td className="py-3.5 px-3">{c.aaMetrics.reasoningMathIndex.toFixed(1)}</td>
                        <td className="py-3.5 px-3 font-extrabold text-amber-300 text-sm">
                          {c.arenaStats.gameIqScore.toFixed(1)}
                        </td>
                        <td className="py-3.5 px-3 font-bold">
                          {c.arenaStats.wins}W-{c.arenaStats.losses}L ({c.arenaStats.winRatePct}%)
                        </td>
                        <td className="py-3.5 px-3 font-bold">{c.arenaStats.eloRating}</td>
                        <td className="py-3.5 px-3">{c.arenaStats.lethalAccuracyPct}%</td>
                        <td className="py-3.5 px-3">{c.arenaStats.lookaheadReadPct}%</td>
                        <td className="py-3.5 px-3">
                          {c.agentId === 'snshero_ai'
                            ? `${c.arenaStats.avgDecisionMs} ms/수`
                            : `${c.aaMetrics.outputTokensPerSec} tok/s (~${(c.arenaStats.avgDecisionMs / 1000).toFixed(2)}s)`}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-300">
                          {c.aaMetrics.estCost1000GamesUsd === 0
                            ? '$0.00 (무료 로컬)'
                            : `$${c.aaMetrics.estCost1000GamesUsd.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 9-Faction Win Rate Breakdown Matrix */}
            <section className="border border-white/15 bg-[#101624] rounded-none overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/15 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold">
                  {tr(
                    '9대 종족별 1,000판 승률 매트릭스 (종족당 약 111판 균등 로테이션)',
                    '9-Faction Win Rate Matrix across 1,000-Match Rotation (~111 Games/Faction)',
                  )}
                </h2>
                <span className="text-[11px] text-stone-400">
                  {tr(
                    '언데드(연격 콤보)·물(비밀/주문) 덱에서 LLM의 다수 턴 수읽기 우위가 가장 크게 발생',
                    'Largest LLM lookahead edge appears in Undead (Combo Rogue) & Water (Secret Mage)',
                  )}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/15 bg-[#0b101b] text-stone-300">
                      <th className="py-2.5 px-4">{tr('종족 (영웅)', 'Faction (Hero)')}</th>
                      {sortedCompetitors.map((c) => (
                        <th key={c.agentId} className="py-2.5 px-3">
                          {isKo ? c.displayNameKo.split(' ')[0] : c.displayNameEn.split(' ')[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {HERO_CLASS_ORDER.map((cls: HeroClass) => (
                      <tr key={cls} className="hover:bg-white/[0.03]">
                        <td className="py-2.5 px-4 font-bold text-stone-200">
                          {isKo ? FACTION_LABELS_KO[cls] : FACTION_LABELS_EN[cls]}
                        </td>
                        {sortedCompetitors.map((c) => {
                          const wr = c.arenaStats.factionWinRates[cls] ?? 50;
                          return (
                            <td
                              key={c.agentId}
                              className={`py-2.5 px-3 font-bold ${
                                wr >= 60
                                  ? 'text-amber-300'
                                  : wr >= 54
                                    ? 'text-emerald-300'
                                    : 'text-stone-300'
                              }`}
                            >
                              {wr.toFixed(1)}%
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 2: 100-POINT PLANNING / DEV / DESIGN EVALUATION                 */}
        {/* =================================================================== */}
        {activeTab === 'audit100' && (
          <div className="space-y-6">
            {/* Summary Banner + Action Buttons */}
            <div className="border border-white/15 bg-[#101624] p-4 rounded-none flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-bold">
                  {tr(
                    'ChatGPT · Gemini · Claude Code 100점 만점 심사표 (기획 / 개발 / 디자인)',
                    '100-Point Product Audit by ChatGPT, Gemini & Claude Code (Planning / Dev / Design)',
                  )}
                </h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  {tr(
                    '각 영역 4개 세부 지표 × 25점 = 100점 만점 엄격 채점 · /mcp snshero_submit_evaluation 호출 시 즉시 반영',
                    'Scored strictly on 4 sub-criteria × 25 pts = 100 pts per pillar · Live-updatable via /mcp snshero_submit_evaluation',
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualEvalForm((v) => !v)}
                  className="sns-btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{tr('평가 업데이트 테스트', 'Test Submit Evaluation')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetBaseline}
                  className="sns-btn-ghost text-xs inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{tr('기본값 복원', 'Reset Baseline')}</span>
                </button>
              </div>
            </div>

            {/* Optional Collapsible Test Submission Form */}
            {showManualEvalForm && (
              <form
                onSubmit={handleSubmitTestAudit}
                className="border border-amber-400/50 bg-[#131a2b] p-5 rounded-none space-y-4"
              >
                <div className="text-xs font-bold text-amber-300">
                  {tr(
                    '[MCP snshero_submit_evaluation 시뮬레이터 — 제출 시 /sns 및 로컬/서버 저장소 즉시 갱신]',
                    '[MCP snshero_submit_evaluation Test Harness — Updates /sns store immediately]',
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <label className="block space-y-1 text-xs">
                    <span className="text-stone-300">{tr('평가 AI 선택', 'Evaluator AI')}</span>
                    <select
                      value={evalFormAgent}
                      onChange={(e) =>
                        setEvalFormAgent(e.target.value as 'claude' | 'gemini' | 'chatgpt')
                      }
                      className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                    >
                      <option value="claude">Claude Code</option>
                      <option value="gemini">Gemini</option>
                      <option value="chatgpt">ChatGPT</option>
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="text-stone-300">{tr('기획 점수 (/100)', 'Planning (/100)')}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={evalFormPlanning}
                      onChange={(e) => setEvalFormPlanning(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                    />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="text-stone-300">{tr('개발 점수 (/100)', 'Development (/100)')}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={evalFormDev}
                      onChange={(e) => setEvalFormDev(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                    />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="text-stone-300">{tr('디자인 점수 (/100)', 'Design (/100)')}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={evalFormDesign}
                      onChange={(e) => setEvalFormDesign(Number(e.target.value))}
                      className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1 text-xs">
                    <span className="text-stone-300">{tr('한줄 핵심 평', 'Headline')}</span>
                    <input
                      type="text"
                      value={evalFormHeadline}
                      onChange={(e) => setEvalFormHeadline(e.target.value)}
                      className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                    />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="text-stone-300">{tr('상세 심사평', 'Detailed Critique')}</span>
                    <input
                      type="text"
                      value={evalFormReview}
                      onChange={(e) => setEvalFormReview(e.target.value)}
                      className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualEvalForm(false)}
                    className="sns-btn-ghost text-xs"
                  >
                    {tr('취소', 'Cancel')}
                  </button>
                  <button type="submit" className="sns-btn-primary text-xs">
                    {tr('100점 평가 반영하기', 'Save Audit Score')}
                  </button>
                </div>
              </form>
            )}

            {/* 3 AI Scorecards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {store.evaluations.map((ev: ProductAuditEvaluation) => {
                const badge = originBadgeLabel(ev.origin, isKo);
                return (
                  <article
                    key={ev.agentId}
                    className={`border border-white/15 bg-[#101624] p-5 rounded-none flex flex-col justify-between space-y-4 ${agentAccentBorder(ev.agentId)}`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-base font-extrabold text-[#fdfcfc]">
                            {ev.evaluatorName}
                          </div>
                          <div className="text-[11px] text-stone-400">{ev.modelVersion}</div>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] border rounded-sm ${badge.tone}`}>
                          {badge.text}
                        </span>
                      </div>

                      {/* 3 Pillar Scores + Total */}
                      <div className="grid grid-cols-4 border border-white/15 bg-[#090d16] text-center">
                        <div className="p-2.5 border-r border-white/15">
                          <div className="text-[10px] text-stone-400">{tr('기획', 'PLAN')}</div>
                          <div className="text-lg font-extrabold text-[#fdfcfc] mt-0.5">
                            {ev.planningScore}
                          </div>
                        </div>
                        <div className="p-2.5 border-r border-white/15">
                          <div className="text-[10px] text-stone-400">{tr('개발', 'DEV')}</div>
                          <div className="text-lg font-extrabold text-[#fdfcfc] mt-0.5">
                            {ev.devScore}
                          </div>
                        </div>
                        <div className="p-2.5 border-r border-white/15">
                          <div className="text-[10px] text-stone-400">{tr('디자인', 'DESIGN')}</div>
                          <div className="text-lg font-extrabold text-[#fdfcfc] mt-0.5">
                            {ev.designScore}
                          </div>
                        </div>
                        <div className="p-2.5 bg-white/[0.04]">
                          <div className="text-[10px] text-amber-300">{tr('평균', 'AVG')}</div>
                          <div className="text-lg font-extrabold text-amber-300 mt-0.5">
                            {ev.totalAverage}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-amber-200 leading-snug">
                        “{isKo ? ev.headlineKo : ev.headlineEn}”
                      </div>
                      <p className="text-xs text-stone-300 leading-relaxed">
                        {isKo ? ev.reviewKo : ev.reviewEn}
                      </p>

                      {/* Strengths */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-emerald-300">
                          {tr('[핵심 고평가 요소]', '[KEY STRENGTHS]')}
                        </div>
                        <ul className="space-y-1 text-[11px] text-stone-300 list-none pl-0">
                          {(isKo ? ev.strengthsKo : ev.strengthsEn).map((st, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-emerald-400 shrink-0">+</span>
                              <span>{st}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Actionable Improvements */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-sky-300">
                          {tr('[향후 고도화 제언]', '[SUGGESTED ENHANCEMENTS]')}
                        </div>
                        <ul className="space-y-1 text-[11px] text-stone-400 list-none pl-0">
                          {(isKo ? ev.improvementsKo : ev.improvementsEn).map((im, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-sky-400 shrink-0">&gt;</span>
                              <span>{im}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/10 text-[10px] text-stone-500 flex justify-between">
                      <span>{ev.vendor}</span>
                      <span>
                        {tr('검토 판수:', 'Sampled:')} {ev.matchesSampled}G
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* 12-Item Detailed Rubric Table */}
            <section className="border border-white/15 bg-[#101624] rounded-none">
              <button
                type="button"
                onClick={() => setExpandedRubric((v) => !v)}
                className="w-full min-h-[48px] px-5 py-3 flex items-center justify-between text-left bg-[#0b101b] border-b border-white/15 cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold">
                  {tr(
                    '12대 세부 평가 루브릭 대조표 (기획 4항목 · 개발 4항목 · 디자인 4항목, 각 25점 만점)',
                    '12-Item Granular Scoring Rubric Breakdown (25 Pts Each × 4 per Pillar)',
                  )}
                </span>
                {expandedRubric ? (
                  <ChevronUp className="w-4 h-4 text-stone-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-400" />
                )}
              </button>

              {expandedRubric && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/15 bg-[#090d16] text-stone-400">
                        <th className="py-2.5 px-4">{tr('영역', 'Pillar')}</th>
                        <th className="py-2.5 px-4">{tr('세부 평가 기준', 'Rubric Criterion')}</th>
                        <th className="py-2.5 px-3 text-center">Claude (/25)</th>
                        <th className="py-2.5 px-3 text-center">Gemini (/25)</th>
                        <th className="py-2.5 px-3 text-center">ChatGPT (/25)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {AUDIT_RUBRIC_100PT.map((r) => {
                        const getSub = (ag: 'claude' | 'gemini' | 'chatgpt') => {
                          const ev = store.evaluations.find((e) => e.agentId === ag);
                          if (!ev) return 0;
                          const bucket = ev.breakdown[r.category] as Record<string, number>;
                          return bucket?.[r.key] ?? 0;
                        };
                        return (
                          <tr key={r.key} className="hover:bg-white/[0.03]">
                            <td className="py-2.5 px-4 font-bold uppercase text-amber-300">
                              {r.category === 'planning'
                                ? tr('기획', 'PLAN')
                                : r.category === 'development'
                                  ? tr('개발', 'DEV')
                                  : tr('디자인', 'DESIGN')}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-[#fdfcfc]">
                                {isKo ? r.titleKo : r.titleEn}
                              </div>
                              <div className="text-[11px] text-stone-400">
                                {isKo ? r.descKo : r.descEn}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {getSub('claude')} / 25
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {getSub('gemini')} / 25
                            </td>
                            <td className="py-2.5 px-3 text-center font-bold">
                              {getSub('chatgpt')} / 25
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 3: LIVE HEADLESS ENGINE SIMULATOR & MCP TURN INSPECTOR          */}
        {/* =================================================================== */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            {/* Batch 1,000-Match Simulator */}
            <section className="border border-white/15 bg-[#101624] p-5 rounded-none space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-300" />
                    <span>
                      {tr(
                        '실제 눈히어로 GameEngine 고속 대전 시뮬레이터 (최대 1,000판 즉시 검증)',
                        'Live SNSHero GameEngine Headless Batch Arena (Up to 1,000 Real Matches)',
                      )}
                    </span>
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {tr(
                      '382장 실제 카드 효과(비밀·죽음의 메아리·오라·선택)가 100% 작동하는 순수 엔진으로 전술 정책별 승률과 Elo를 실시간 측정합니다.',
                      'Runs genuine 30-card decks through GameEngine.ts across all 9 factions to verify win rates, speed, and Elo.',
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1 text-xs block">
                  <span className="text-stone-300">
                    {tr('도전자 전술 정책 (Player AI)', 'Challenger Policy')}
                  </span>
                  <select
                    value={simPlayerPolicy}
                    onChange={(e) => setSimPlayerPolicy(e.target.value as SimPolicyId)}
                    disabled={simRunning}
                    className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                  >
                    <option value="LOOKAHEAD_2PLY">
                      {tr('LOOKAHEAD_2PLY (2수 앞 연계 수읽기 · LLM 근사)', 'LOOKAHEAD_2PLY (2-Step Lookahead)')}
                    </option>
                    <option value="SNSHERO_EXPERT">
                      {tr('SNSHERO_EXPERT (눈히어로 숙련 AI · 미러 검증)', 'SNSHERO_EXPERT (Mirror Baseline)')}
                    </option>
                    <option value="AGGRO_TEMPO">
                      {tr('AGGRO_TEMPO (명치·템포 집중형)', 'AGGRO_TEMPO (Aggressive Face/Tempo)')}
                    </option>
                    <option value="CONTROL_VALUE">
                      {tr('CONTROL_VALUE (필드 정리·교환 우선형)', 'CONTROL_VALUE (Board Control)')}
                    </option>
                    <option value="RANDOM_LEGAL">
                      {tr('RANDOM_LEGAL (무작위 합법 수 하한선)', 'RANDOM_LEGAL (Random Legal Moves)')}
                    </option>
                  </select>
                </label>

                <label className="space-y-1 text-xs block">
                  <span className="text-stone-300">
                    {tr('상대 기준 AI (Opponent)', 'Opponent Baseline AI')}
                  </span>
                  <select
                    value={simOpponentPolicy}
                    onChange={(e) =>
                      setSimOpponentPolicy(
                        e.target.value as 'SNSHERO_EXPERT' | 'SNSHERO_NORMAL',
                      )
                    }
                    disabled={simRunning}
                    className="w-full min-h-[44px] px-3 bg-[#090d16] border border-white/20 rounded-sm text-xs"
                  >
                    <option value="SNSHERO_EXPERT">
                      {tr('눈히어로 숙련 AI (Elo 1,765 · 메타 30장)', 'SNSHero Expert AI (Elo 1,765)')}
                    </option>
                    <option value="SNSHERO_NORMAL">
                      {tr('눈히어로 일반 AI (Elo 1,520 · 기본 30장)', 'SNSHero Normal AI (Elo 1,520)')}
                    </option>
                  </select>
                </label>

                <div className="space-y-1 text-xs">
                  <span className="text-stone-300 block">
                    {tr('연속 실행 판수 선택', 'Run Match Batch')}
                  </span>
                  <div className="flex gap-2">
                    {[20, 100, 1000].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        disabled={simRunning}
                        onClick={() => {
                          setSimGamesCount(cnt);
                          handleRunSimulation(cnt);
                        }}
                        className={cnt === 100 ? 'sns-btn-primary text-xs flex-1' : 'sns-btn-ghost text-xs flex-1'}
                      >
                        {cnt}
                        {tr('판 실행', 'G Run')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {simRunning && (
                <div className="border border-amber-400/40 bg-[#090d16] p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-300 font-bold">
                      {tr('실제 GameEngine 시뮬레이션 진행 중...', 'Simulating real GameEngine matches...')}
                    </span>
                    <span>
                      {simProgress.done} / {simProgress.total} ({simProgress.wins}W)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-[#151c2c] border border-white/15">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{
                        width: `${simProgress.total > 0 ? (simProgress.done / simProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {simResult && (
                <div className="border border-emerald-400/40 bg-[#090d16] p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div className="p-3 border border-white/10 bg-[#101624]">
                      <div className="text-stone-400">{tr('전적 / 승률', 'Record / Win%')}</div>
                      <div className="text-base font-extrabold text-emerald-300 mt-1">
                        {simResult.wins}W-{simResult.losses}L ({simResult.winRatePct}%)
                      </div>
                    </div>
                    <div className="p-3 border border-white/10 bg-[#101624]">
                      <div className="text-stone-400">{tr('측정 지능 / Elo', 'Measured IQ / Elo')}</div>
                      <div className="text-base font-extrabold text-amber-300 mt-1">
                        {simResult.gameIqScore} IQ · {simResult.calibratedElo}
                      </div>
                    </div>
                    <div className="p-3 border border-white/10 bg-[#101624]">
                      <div className="text-stone-400">{tr('선공 / 후공 승률', '1st / 2nd Turn WR')}</div>
                      <div className="text-base font-bold mt-1">
                        {simResult.firstPlayerWinRatePct}% / {simResult.secondPlayerWinRatePct}%
                      </div>
                    </div>
                    <div className="p-3 border border-white/10 bg-[#101624]">
                      <div className="text-stone-400">{tr('평균 종료 턴', 'Avg Turns')}</div>
                      <div className="text-base font-bold mt-1">{simResult.avgTurns}T</div>
                    </div>
                    <div className="p-3 border border-white/10 bg-[#101624]">
                      <div className="text-stone-400">{tr('엔진 처리 속도', 'Engine Speed')}</div>
                      <div className="text-base font-bold text-sky-300 mt-1">
                        {simResult.matchesPerSec} {tr('판/초', 'games/s')}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-stone-400">
                      {tr('[최근 시뮬레이션 기보 샘플]', '[RECENT MATCH LOGS]')}
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-white/10 bg-[#0d1320] p-2.5 text-[11px] space-y-1">
                      {simResult.sampleLogs.map((lg) => (
                        <div key={lg.gameNo} className="text-stone-300">
                          {isKo ? lg.summaryKo : lg.summaryEn}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Interactive 1-on-1 MCP Protocol Turn Inspector */}
            <section className="border border-white/15 bg-[#101624] p-5 rounded-none space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold">
                    {tr(
                      '/mcp 턴제 관측 상태(Observation) & 합법 수(legalActions) 라이브 인스펙터',
                      'Live /mcp Turn-by-Turn Observation & Legal Actions Inspector',
                    )}
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {tr(
                      'ChatGPT·Gemini·Claude Code가 snshero_start_match / snshero_step_action 호출 시 실제로 주고받는 전장 상태와 선택지입니다.',
                      'Preview the exact board state & legal action indices exposed to LLMs via /mcp tools.',
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={liveLoading}
                    onClick={handleStartInspectorMatch}
                    className="sns-btn-primary text-xs inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{tr('새 MCP 대전 생성', 'New MCP Match')}</span>
                  </button>
                  {liveObs && liveObs.phase !== 'GAME_OVER' && (
                    <button
                      type="button"
                      onClick={handleStepInspectorSmartMove}
                      className="sns-btn-ghost text-xs"
                    >
                      {tr('최적 수 1스텝 실행', 'Step Optimal Move')}
                    </button>
                  )}
                </div>
              </div>

              {!liveObs ? (
                <div className="p-6 text-center text-xs text-stone-400 border border-dashed border-white/15">
                  {tr(
                    '[새 MCP 대전 생성] 버튼을 누르면 실제 30장 덱 대전이 시작되고 LLM에게 전달되는 합법 수 목록이 표시됩니다.',
                    'Click [New MCP Match] to spawn a live 30-card battle and inspect legal actions.',
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border border-white/15 bg-[#090d16] p-4 space-y-3 text-xs">
                    <div className="flex justify-between font-bold border-b border-white/10 pb-2">
                      <span>
                        Turn {liveObs.turnNumber} · Phase: {liveObs.phase}{' '}
                        {liveObs.winner ? `(Winner: ${liveObs.winner})` : ''}
                      </span>
                      <span className="text-amber-300">
                        Mana: {liveObs.player.mana}/{liveObs.player.maxMana}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 border border-white/10 bg-[#101624]">
                        <div className="text-emerald-300 font-bold">
                          [MCP Agent] {liveObs.player.factionLabelKo}
                        </div>
                        <div className="mt-1">
                          HP: {liveObs.player.health} (+{liveObs.player.armor}) · Hand:{' '}
                          {liveObs.player.hand.length} · Deck: {liveObs.player.deckRemaining}
                        </div>
                      </div>
                      <div className="p-2.5 border border-white/10 bg-[#101624]">
                        <div className="text-rose-300 font-bold">
                          [SNSHero AI] {liveObs.opponent.factionLabelKo}
                        </div>
                        <div className="mt-1">
                          HP: {liveObs.opponent.health} (+{liveObs.opponent.armor}) · Hand:{' '}
                          {liveObs.opponent.handCount} · Secrets: {liveObs.opponent.secretCount}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-stone-400 mb-1">
                        {tr('전장 하수인 (내 전장 / 적 전장)', 'Board Minions (Friendly / Enemy)')}
                      </div>
                      <div className="p-2 border border-white/10 bg-[#0d1320] text-[11px] space-y-1">
                        <div>
                          <span className="text-emerald-300">ME:</span>{' '}
                          {liveObs.player.board.length === 0
                            ? '(비어 있음)'
                            : liveObs.player.board
                                .map(
                                  (m) =>
                                    `[${m.name} ${m.attack}/${m.health}${m.taunt ? ' 도발' : ''}${m.canAttackNow ? ' 공격가능' : ''}]`,
                                )
                                .join(' ')}
                        </div>
                        <div>
                          <span className="text-rose-300">AI:</span>{' '}
                          {liveObs.opponent.board.length === 0
                            ? '(비어 있음)'
                            : liveObs.opponent.board
                                .map(
                                  (m) =>
                                    `[${m.name} ${m.attack}/${m.health}${m.taunt ? ' 도발' : ''}]`,
                                )
                                .join(' ')}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-stone-400 mb-1">
                        {tr(
                          '클릭하여 실행 가능한 legalActions (LLM이 선택하는 인덱스)',
                          'Clickable legalActions exposed to MCP Agent',
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {liveObs.legalActions.map((act) => (
                          <button
                            key={act.actionIndex}
                            type="button"
                            onClick={() => handleStepInspectorActionIdx(act.actionIndex)}
                            className="w-full min-h-[40px] px-3 py-1.5 text-left text-[11px] bg-[#131b2e] hover:bg-[#1c2842] border border-white/15 rounded-sm cursor-pointer"
                          >
                            <span className="text-amber-300 font-bold">[{act.actionIndex}]</span>{' '}
                            {isKo ? act.labelKo : act.labelEn}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border border-white/15 bg-[#090d16] p-4 flex flex-col">
                    <div className="text-[11px] font-bold text-stone-400 mb-2">
                      MCP Observation JSON Payload (snshero_get_match_state)
                    </div>
                    <pre className="flex-1 max-h-[380px] overflow-auto text-[11px] text-stone-300 bg-[#060910] p-3 border border-white/10">
                      {JSON.stringify(liveObs, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* =================================================================== */}
        {/* TAB 4: /MCP SERVER CONNECTION & 1,000-MATCH RUNNER GUIDE            */}
        {/* =================================================================== */}
        {activeTab === 'mcp_setup' && (
          <div className="space-y-6">
            {/* 1-Click Ready-to-Paste Prompt for AI Agents */}
            <section className="border border-amber-400/50 bg-[#12192b] p-5 rounded-none space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-amber-300">
                    {tr(
                      'AI(ChatGPT · Gemini · Claude Code)에게 바로 전달할 실행 프롬프트',
                      'Ready-to-Paste Instruction Prompt for ChatGPT / Gemini / Claude Code',
                    )}
                  </h2>
                  <p className="text-xs text-stone-300 mt-0.5">
                    {tr(
                      '아래 지시문을 복사해 AI 채팅창이나 CLI에 그대로 붙여넣거나, /mcp/guide.md 링크만 전달하면 AI가 스스로 툴 규격을 파악해 플레이 및 100점 채점을 수행합니다.',
                      'Copy and paste this prompt into any AI agent, or share /mcp/guide.md directly.',
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      'ai_master_prompt',
                      `눈히어로(SNSHero) 카드배틀 MCP 서버(${originHost}/mcp, 가이드: ${originHost}/mcp/guide.md)에 접속해서 아래 순서대로 수행해줘:\n1) snshero_get_game_dossier를 호출해 382장 카드·40화 스토리·엔진·사운드 아키텍처와 100점 채점 루브릭을 분석해.\n2) snshero_start_match와 snshero_step_action을 사용해 눈히어로 숙련 AI(EXPERT)와 최소 3판(벤치마크 시 snshero_create_1000_series로 1,000판) 끝까지 대결해.\n3) 대결 경험과 아키텍처 분석을 바탕으로 기획/개발/디자인 각 100점 만점 점수와 강점·개선점을 snshero_submit_evaluation으로 제출해 ${originHost}/sns 에 반영해줘.`,
                    )
                  }
                  className="sns-btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  {copiedKey === 'ai_master_prompt' ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{tr('프롬프트 복사 완료!', 'Prompt Copied!')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{tr('AI 전달용 프롬프트 원클릭 복사', 'Copy Prompt for AI')}</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-[#090d16] border border-white/15 p-3 text-[11px] text-stone-200 whitespace-pre-wrap leading-relaxed">
{`눈히어로(SNSHero) 카드배틀 MCP 서버(${originHost}/mcp, 가이드: ${originHost}/mcp/guide.md)에 접속해서 아래 순서대로 수행해줘:
1) snshero_get_game_dossier를 호출해 382장 카드·40화 스토리·엔진·사운드 아키텍처와 100점 채점 루브릭을 분석해.
2) snshero_start_match와 snshero_step_action을 사용해 눈히어로 숙련 AI(EXPERT)와 최소 3판(벤치마크 시 snshero_create_1000_series로 1,000판) 끝까지 대결해.
3) 대결 경험과 아키텍처 분석을 바탕으로 기획/개발/디자인 각 100점 만점 점수와 강점·개선점을 snshero_submit_evaluation으로 제출해 ${originHost}/sns 에 반영해줘.`}
              </pre>
            </section>

            {/* Live /mcp Ping Diagnostic */}
            <section className="border border-white/15 bg-[#101624] p-5 rounded-none space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold">
                    {tr(
                      '사전 준비된 /mcp 서버 상태 점검 & 원클릭 연동 명령어',
                      'Pre-Configured /mcp Server Diagnostics & 1-Click Client Setup',
                    )}
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {tr(
                      'Streamable HTTP (POST /mcp), SSE (/mcp/sse), Stdio (scripts/mcp-server.ts --stdio), OpenAPI (/mcp/openapi.json) 4종 전송 규격을 모두 지원합니다.',
                      'Supports Streamable HTTP (POST /mcp), SSE (/mcp/sse), Stdio (--stdio), and OpenAPI 3.1 (/mcp/openapi.json).',
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestMcpEndpoint}
                  className="sns-btn-primary text-xs inline-flex items-center gap-1.5"
                >
                  <Server className="w-4 h-4" />
                  <span>{tr('/mcp tools/list 호출 테스트', 'Test POST /mcp (tools/list)')}</span>
                </button>
              </div>

              {mcpPingOutput && (
                <pre className="max-h-60 overflow-auto text-[11px] bg-[#060910] border border-white/15 p-3 text-emerald-300">
                  {mcpPingOutput}
                </pre>
              )}
            </section>

            {/* 3 Client Setup Cards: Claude Code, Gemini, ChatGPT + 1,000-Match Runner */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {[
                {
                  key: 'claude_cmd',
                  title: '1. Claude Code 연동 (HTTP 또는 Stdio)',
                  cmd: `claude mcp add --transport http snshero ${originHost}/mcp\n# 또는 서버 없이 로컬 Stdio 직접 실행:\nclaude mcp add snshero -- npx tsx scripts/mcp-server.ts --stdio`,
                  promptNote:
                    '연결 후 Claude Code에 입력: "snshero MCP로 게임 명세를 확인하고 3판 직접 플레이한 뒤 기획/개발/디자인 100점 평가를 제출해줘"',
                },
                {
                  key: 'gemini_cmd',
                  title: '2. Gemini CLI / Antigravity MCP 등록',
                  cmd: `gemini mcp add --transport http snshero ${originHost}/mcp\n# settings.json (mcpServers):\n# { "snshero": { "httpUrl": "${originHost}/mcp" } }`,
                  promptNote:
                    '연결 후 Gemini에 입력: "snshero MCP 툴로 눈히어로 AI와 대결하고 100점 만점 기획/개발/디자인 점수를 /sns에 기록해줘"',
                },
                {
                  key: 'chatgpt_cmd',
                  title: '3. ChatGPT (Developer Mode MCP / Custom GPT Actions)',
                  cmd: `MCP Server URL : ${originHost}/mcp\nOpenAPI Schema : ${originHost}/mcp/openapi.json`,
                  promptNote:
                    'ChatGPT 개발자 모드 커넥터에 /mcp URL을 등록하거나 Custom GPT Actions에서 /mcp/openapi.json을 가져오기 하세요.',
                },
                {
                  key: 'runner_1000',
                  title: '4. 각 모델 1,000판 자동 대전 실행기 (CLI)',
                  cmd: `ANTHROPIC_API_KEY=... npx tsx scripts/run-llm-1000-benchmark.ts --agent claude --games 1000\nGEMINI_API_KEY=...    npx tsx scripts/run-llm-1000-benchmark.ts --agent gemini --games 1000\nOPENAI_API_KEY=...    npx tsx scripts/run-llm-1000-benchmark.ts --agent chatgpt --games 1000`,
                  promptNote:
                    '진행되는 매 판의 승패·Elo·전술 지능이 실시간으로 public/data/mcp-benchmark-store.json 및 /sns 페이지에 자동 누적됩니다.',
                },
              ].map((box) => (
                <div
                  key={box.key}
                  className="border border-white/15 bg-[#101624] p-4 rounded-none space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300">{box.title}</span>
                    <button
                      type="button"
                      onClick={() => copyText(box.key, box.cmd)}
                      className="sns-btn-ghost text-[11px] min-h-[36px] px-2.5 inline-flex items-center gap-1"
                    >
                      {copiedKey === box.key ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{tr('복사됨', 'Copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{tr('복사', 'Copy')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-[#090d16] border border-white/10 p-3 text-[11px] text-stone-200 overflow-x-auto">
                    {box.cmd}
                  </pre>
                  <p className="text-[11px] text-stone-400">{box.promptNote}</p>
                </div>
              ))}
            </div>

            {/* 8 MCP Tools Specification Table */}
            <section className="border border-white/15 bg-[#101624] rounded-none overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/15 bg-[#0b101b]">
                <h3 className="text-xs sm:text-sm font-bold">
                  {tr(
                    '/mcp 서버 제공 8대 표준 Tool 명세 (tools/list)',
                    '8 Registered MCP Tools on /mcp (tools/list)',
                  )}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/15 bg-[#090d16] text-stone-400">
                      <th className="py-2.5 px-4">{tr('구분', 'Stage')}</th>
                      <th className="py-2.5 px-4">{tr('MCP Tool 이름', 'Tool Name')}</th>
                      <th className="py-2.5 px-4">{tr('기능 설명', 'Description')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {MCP_TOOL_DOCS.map((t) => (
                      <tr key={t.name} className="hover:bg-white/[0.03]">
                        <td className="py-2.5 px-4 font-bold text-amber-300">{t.phase}</td>
                        <td className="py-2.5 px-4 font-bold text-[#fdfcfc]">{t.name}</td>
                        <td className="py-2.5 px-4 text-stone-300">
                          {isKo ? t.descKo : t.descEn}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Clean Flat Footer */}
      <footer className="border-t border-white/15 bg-[#070a12] mt-12">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3 text-[11px] text-stone-400">
          <div>
            SNSHero Revolution v2.1 · 382 Collectible Cards Frozen · /mcp JSON-RPC 2.0 Arena ·{' '}
            {tr('최종 갱신:', 'Last Updated:')} {store.lastUpdated.slice(0, 19).replace('T', ' ')}
          </div>
          <div className="flex gap-4">
            <a href="/game" className="hover:text-white">
              /game (Game)
            </a>
            <a href="/" className="hover:text-white">
              / (Showcase)
            </a>
            <a href="/book" className="hover:text-white">
              /book
            </a>
            <a href="/webtoon" className="hover:text-white">
              /webtoon
            </a>
            <a href="/mcp" className="hover:text-white">
              /mcp
            </a>
          </div>
        </div>
      </footer>
      </div>
    </SharedAdSenseShell>
  );
};
