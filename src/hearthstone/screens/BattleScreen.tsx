import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isKoreanLanguage, tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import {
  CLASSIC_RANK_NAMES,
  CLASS_CREST_URL,
  cardDb,
  getCardArtUrl,
  getCardTileUrl,
  getHeroArtUrl,
} from '../cardDb';
import { getCardName, getLocalizedHeroInfo, getRankTitle } from '../i18nData';
import {
  BoardMinionToken,
  HearthstoneCard,
  HeroPortraitZone,
  HsGoldCoinIcon,
  HsManaGem,
} from '../components/CardVisual';
import { CardZoomAction, CardZoomModal } from '../components/CardZoomModal';
import { KadanJourneyStoryModal } from '../components/KadanJourneyStoryModal';
import { QuickRulesModal, hasSeenQuickRules } from '../components/OnboardingGuideModal';
import { useModalDismiss } from '../useModalDismiss';
import {
  SNS_LOCATIONS,
  SnsBoosterPackArt,
  SnsCardBackArt,
  SnsRankMedallion,
} from '../components/SnsHeroArtKit';
import { AiAction, buildAiOpponentSetup, computeNextAiAction } from '../engine/aiController';
import {
  createBattleMatch,
  createEngine,
  getHeroAttack,
  getMinionAttack,
  getMinionHealth,
  getMinionMaxHealth,
  hasMinionTaunt,
} from '../engine/GameEngine';
import {
  buildJourneyBossDeck,
  buildJourneyPlayerDeckAndMultipliers,
  buildTutorialEp0PlayerDeck,
  buildTutorialEp0ScarecrowDeck,
  getEp0CardReason,
  getJourneyDifficultySpec,
  getJourneyEpisodeDef,
} from '../kadanJourneyData';
import { DefeatPackReinforcementResult, OpenedPackCard, hsStorage } from '../storage';
import {
  clientToStagePoint,
  elementCenterInStage,
  getStageSize,
} from '../stageCoords';
import {
  ActionHistoryItem,
  BattleMatchState,
  BoardThemeId,
  CLASSIC_HEROES,
  CustomDeck,
  GameMode,
  HeroClass,
  MatchRewardBreakdown,
  MinionInstance,
  PlayerBattleState,
  PlayerSide,
} from '../types';
import { BoardVfxCanvas, recordEntityStagePosition } from '../vfx/BoardVfxCanvas';

export interface BattleScreenProps {
  mode: GameMode;
  playerDeck: CustomDeck;
  preferredOpponentClass?: HeroClass;
  preferredBoardTheme?: BoardThemeId;
  journeyEpisodeOverride?: number;
  skipStoryIntro?: boolean;
  onOpenOptions: (concedeHandler: () => void) => void;
  onExitBattle: () => void;
  onOpenShopFromBattle?: () => void;
  onGoOpenPacksFromBattle?: () => void;
  onGoCollectionFromBattle?: () => void;
  onStartJourneyEpisode?: (episode: number, skipStoryIntro?: boolean) => void;
  onRematchSameMode?: () => void;
}

type PendingSelection =
  | {
      kind: 'HAND_CARD';
      handUid: string;
      cardId: string;
      needsTarget: boolean;
      validTargets: string[];
      isMinion: boolean;
      hasChooseOne: boolean;
    }
  | {
      kind: 'CHOOSE_OPTION_TARGET';
      handUid: string;
      cardId: string;
      optionIndex: 0 | 1;
      insertIndex: number;
      validTargets: string[];
    }
  | {
      kind: 'HERO_POWER';
      validTargets: string[];
    }
  | {
      kind: 'ATTACKER';
      attackerId: string;
      validTargets: string[];
    };

type BattleZoomState =
  | { kind: 'HAND_CARD'; handUid: string }
  | { kind: 'MULLIGAN_CARD'; handUid: string }
  | { kind: 'CHOOSE_ONE_CARD'; optionIndex: 0 | 1 }
  | { kind: 'TRACKING_CARD'; cardId: string }
  | { kind: 'BOARD_MINION'; minion: MinionInstance; isFriendly: boolean }
  | { kind: 'HISTORY_ITEM'; item: ActionHistoryItem };

interface ActiveAttackAnim {
  id: number;
  side: PlayerSide;
  attackerId: string;
  defenderId: string;
  isHeroAttacker: boolean;
  artUrl: string;
  nameKo: string;
  attackVal: number;
  healthVal: number;
  armorVal: number;
  taunt: boolean;
  divineShield: boolean;
  rarity?: string;
  frameGradient: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  defenderDamage: number;
  attackerCounterDamage: number;
  attackerWillDie: boolean;
  phase: 'WINDUP' | 'LUNGE' | 'IMPACT_RETURN';
}

const BOARD_BG_URL: Record<BoardThemeId, string> = {
  STORMWIND: SNS_LOCATIONS.BOARD_LIGHTHAVEN,
  ORGRIMMAR: SNS_LOCATIONS.BOARD_RED_PALACE,
  PANDARIA: SNS_LOCATIONS.BOARD_WIND_ISLE,
};

const BOARD_CORNER_TOYS: Record<
  BoardThemeId,
  { pos: 'TL' | 'TR' | 'BL' | 'BR'; icon: string; name: string; nameEn: string; reaction: string; reactionEn: string }[]
> = {
  STORMWIND: [
    { pos: 'TL', icon: '🔔', name: '엘윈마을 설원 종탑', nameEn: 'Elwin Snowfield Bell Tower', reaction: '땡~ 땡~! 엘윈마을 설원 종탑의 종소리가 맑게 울려 퍼집니다!', reactionEn: 'Clang~ clang! The Elwin Snowfield bell rings crystal clear!' },
    { pos: 'TR', icon: '🏮', name: '설원 온기 등불', nameEn: 'Warm Frost Lantern', reaction: '화르륵! 엘윈마을 청동 등불이 따스하게 타오릅니다!', reactionEn: 'Whoosh! Elwin Village’s bronze lantern glows warmly!' },
    { pos: 'BL', icon: '🛡', name: '눈꽃 방패 거치대', nameEn: 'Snowflake Shield Rack', reaction: '챙! 카단의 눈꽃 방패에서 푸른 서리빛이 반짝입니다!', reactionEn: 'Clang! Kadan’s Snowflake Shield shimmers with frostlight!' },
    { pos: 'BR', icon: '❄️', name: '엘윈 빙결 수정', nameEn: 'Elwin Frost Crystal', reaction: '반짝! 만년설 빙결 수정 속에서 오로라 빛이 춤춥니다!', reactionEn: 'Sparkle! Aurora light dances inside the permafrost crystal!' },
  ],
  ORGRIMMAR: [
    { pos: 'TL', icon: '🔥', name: '불꽃 성채 화로', nameEn: 'Flame Citadel Brazier', reaction: '활활! 불꽃 성채의 용암 화로에서 뜨거운 불길이 솟구칩니다!', reactionEn: 'Roar! Fierce flames surge from the Flame Citadel brazier!' },
    { pos: 'TR', icon: '⚒', name: '황금 제련 모루', nameEn: 'Gilded Forge Anvil', reaction: '깡! 깡! 달궈진 강철 모루에서 불꽃 파편이 튱니다!', reactionEn: 'Clink! Sparks fly off the glowing forge anvil!' },
    { pos: 'BL', icon: '🦁', name: '태양 사자 부조', nameEn: 'Sun Lion Relief', reaction: '크르르! 성채 수호 사자상의 붉은 보석 눈이 번쩍입니다!', reactionEn: 'Growl! The guardian lion’s ruby eyes flash fiercely!' },
    { pos: 'BR', icon: '🥁', name: '결투장 전고', nameEn: 'Arena War Drum', reaction: '둥! 둥! 불꽃 성채 결투장의 우렁찬 북소리가 울립니다!', reactionEn: 'Boom! Boom! Thunderous war drums echo across the arena!' },
  ],
  PANDARIA: [
    { pos: 'TL', icon: '🎐', name: '바람 신전 비취 풍경', nameEn: 'Jade Wind Chime', reaction: '딸랑~! 바람의 신전 비취 풍경 소리가 은은하게 퍼집니다!', reactionEn: 'Ting-ling~ Gentle jade chimes drift across the Wind Shrine!' },
    { pos: 'TR', icon: '🌊', name: '천공 폭포 수차', nameEn: 'Sky Cascade Mill', reaction: '쏴아아~ 구름 너머 천공 폭포수가 시원하게 쏟아집니다!', reactionEn: 'Whoosh~ Skyfall waters tumble cleanly past the clouds!' },
    { pos: 'BL', icon: '🏹', name: '청풍 활터 과녁', nameEn: 'Zephyr Archery Target', reaction: '핑— 퍽! 바람 화살이 과녁 정중앙을 꿰뚫었습니다!', reactionEn: 'Twang—thwack! A wind arrow splits the bullseye!' },
    { pos: 'BR', icon: '🍃', name: '신록의 에메랄드 석등', nameEn: 'Verdant Emerald Lantern', reaction: '반짝~ 에메랄드 룬 석등에서 청량한 바람 기운이 피어오릅니다!', reactionEn: 'Glow~ Cool emerald breeze rises from the rune lantern!' },
  ],
};

const EndTurnLeverPlate: React.FC<{
  isPlayerTurn: boolean;
  noMovesLeft: boolean;
  isKo: boolean;
  compact?: boolean;
}> = ({ isPlayerTurn, noMovesLeft, isKo, compact = false }) => {
  const fillGrad = !isPlayerTurn
    ? 'linear-gradient(180deg, #57534e 0%, #292524 55%, #1c1917 100%)'
    : noMovesLeft
      ? 'linear-gradient(180deg, #34d399 0%, #059669 52%, #064e3b 100%)'
      : 'linear-gradient(180deg, #fde047 0%, #d97706 52%, #78350f 100%)';

  const rimColor = !isPlayerTurn ? '#78716c' : noMovesLeft ? '#a7f3d0' : '#fef08a';

  return (
    <div
      style={{
        background: fillGrad,
        borderColor: rimColor,
        boxShadow: !isPlayerTurn
          ? 'inset 0 1px 1px rgba(255,255,255,0.25), 0 4px 10px rgba(0,0,0,0.8)'
          : noMovesLeft
            ? '0 0 18px rgba(52,211,153,0.9), inset 0 1.5px 1px rgba(255,255,255,0.8)'
            : '0 6px 14px rgba(0,0,0,0.85), inset 0 1.5px 1px rgba(255,255,255,0.85)',
      }}
      className={`flex h-full w-full items-center justify-center rounded-2xl border-[2.5px] px-2 ${
        compact ? 'rounded-xl border-2' : ''
      }`}
    >
      <span
        className={`hs-title hs-outline-sm font-extrabold tracking-wide ${
          compact ? 'text-[10.5px]' : 'text-xs'
        } ${!isPlayerTurn ? 'text-stone-300' : 'text-white'}`}
      >
        {!isPlayerTurn
          ? isKo
            ? '상대 턴'
            : 'Enemy Turn'
          : noMovesLeft
            ? isKo
              ? '할 일 없음'
              : 'Job Done'
            : isKo
              ? '턴 종료'
              : 'End Turn'}
      </span>
    </div>
  );
};

export const BattleScreen: React.FC<BattleScreenProps> = ({
  mode,
  playerDeck,
  preferredOpponentClass,
  preferredBoardTheme,
  journeyEpisodeOverride,
  skipStoryIntro = false,
  onOpenOptions,
  onExitBattle,
  onOpenShopFromBattle,
  onGoOpenPacksFromBattle,
  onGoCollectionFromBattle,
  onStartJourneyEpisode,
  onRematchSameMode,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const buildBattleMatchState = useCallback(
    (targetEpisode?: number): BattleMatchState => {
      const curKo = isKoreanLanguage();
      if (mode === 'TUTORIAL') {
        hsStorage.markJourneyGuideDone();
        const curProfile = hsStorage.getProfile();
        const ep = targetEpisode ?? journeyEpisodeOverride ?? curProfile.journeyEpisode;
        const reinc = curProfile.journeyReincarnation;
        const epDef = getJourneyEpisodeDef(ep, curKo);
        const diffSpec = getJourneyDifficultySpec(ep, reinc);
        const isEp0 = epDef.episode === 0 && reinc === 0;
        const col = hsStorage.getCollection();
        const playerJourney = isEp0
          ? { deckCards: buildTutorialEp0PlayerDeck(), playerCardMultipliers: {} }
          : buildJourneyPlayerDeckAndMultipliers(col);
        const bossDeck = isEp0
          ? buildTutorialEp0ScarecrowDeck()
          : buildJourneyBossDeck(epDef.bossHeroClass, ep, reinc);

        return createBattleMatch({
          mode: 'TUTORIAL',
          playerName: epDef.playerHeroSpec.heroNameKo,
          playerClass: 'PRIEST',
          playerDeck: playerJourney.deckCards,
          playerCustomHero: epDef.playerHeroSpec,
          opponentName: epDef.bossNameKo,
          opponentClass: epDef.bossHeroClass,
          opponentDeck: bossDeck,
          opponentCustomHero: epDef.bossHeroSpec,
          boardTheme: diffSpec.boardTheme,
          journeyMeta: {
            episode: epDef.episode,
            reincarnation: reinc,
            episodeTitle: epDef.titleKo,
            actTitle: epDef.actTitle,
            opponentTitle: epDef.bossHeroSpec.titleKo,
            enemyHeroHealth: diffSpec.enemyHeroHealth,
            enemyStatScale: diffSpec.enemyStatScale,
            playerCardMultipliers: playerJourney.playerCardMultipliers,
          },
        });
      }

      const opp = buildAiOpponentSetup(mode, preferredOpponentClass);
      return createBattleMatch({
        mode,
        playerName: curKo ? '엘윈마을 모험가' : 'Elwin Adventurer',
        playerClass: playerDeck.heroClass,
        playerDeck: playerDeck.cards,
        opponentName: opp.opponentName,
        opponentClass: opp.opponentClass,
        opponentDeck: opp.opponentDeck,
        boardTheme: preferredBoardTheme,
      });
    },
    [mode, playerDeck, preferredOpponentClass, preferredBoardTheme, journeyEpisodeOverride],
  );

  const [matchState, setMatchState] = useState<BattleMatchState>(() =>
    buildBattleMatchState(),
  );
  const [liveProfile, setLiveProfile] = useState(() => hsStorage.getProfile());

  // 스토리모드 = 에피소드 스토리 극장 먼저 오픈 + 자동 플레이 기본 ON (단, 1화 초회 플레이는 직접 조작 유도)
  // 랭킹대전 / AI대전 = 매판 시작 시 자동플레이 비활성화(OFF) 시작, 전투 종료 시에도 즉시 비활성화(OFF) 초기화!
  const [storyPhase, setStoryPhase] = useState<'PRE_BATTLE' | 'CLOSED' | 'REVIEW'>(() =>
    mode === 'TUTORIAL' && !skipStoryIntro ? 'PRE_BATTLE' : 'CLOSED',
  );
  const [autoPlay, setAutoPlay] = useState<boolean>(() => {
    if (mode !== 'TUTORIAL') return false;
    const epNum = matchState.journeyMeta?.episode ?? 1;
    if (epNum === 0) return true;
    const isFirstEp1 = epNum === 1 && liveProfile.totalGames === 0;
    return !isFirstEp1;
  });
  const [quickRulesOpen, setQuickRulesOpen] = useState(false);
  const [coachCollapsed, setCoachCollapsed] = useState(false);
  const isEp0Tutorial = mode === 'TUTORIAL' && (matchState.journeyMeta?.episode ?? 1) === 0;
  const [ep0Dialogue, setEp0Dialogue] = useState<{
    speaker: 'KADAN' | 'SCARECROW';
    badge: string;
    headline: string;
    reason: string;
  } | null>(() =>
    mode === 'TUTORIAL' && (matchState.journeyMeta?.episode ?? 1) === 0
      ? {
          speaker: 'KADAN',
          badge: isKoreanLanguage() ? '튜토리얼 실전 시작' : 'Tutorial Drill Start',
          headline: isKoreanLanguage() ? '3초마다 카드 해설!' : 'Card Tip Every 3s!',
          reason: isKoreanLanguage()
            ? '매 턴 카드를 내는 이유를 쉽게 알려드릴게요!'
            : "I'll explain why each card is played every turn!",
        }
      : null,
  );
  const [ep0SummaryNonce, setEp0SummaryNonce] = useState(0);
  const ep0TurnPlaysRef = useRef<string[]>([]);
  const ep0OpponentPlaysRef = useRef<string[]>([]);
  const ep0SummaryShownTurnRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'TUTORIAL') {
      setAutoPlay(false);
    }
  }, [matchState.matchId, mode]);

  const [vsIntroActive, setVsIntroActive] = useState(
    () => mode !== 'TUTORIAL' || skipStoryIntro,
  );
  const [selection, setSelection] = useState<PendingSelection | null>(null);
  const [zoomState, setZoomState] = useState<BattleZoomState | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);

  useModalDismiss(Boolean(selection), () => {
    hsAudio.playSfx('ui_click', 0.45);
    setSelection(null);
  });
  useModalDismiss(emoteMenuOpen, () => setEmoteMenuOpen(false));
  useModalDismiss(mobileHistoryOpen, () => setMobileHistoryOpen(false));
  const [isCompactMobile, setIsCompactMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth < 640 &&
      window.innerHeight >= window.innerWidth,
  );
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [insertPreviewIdx, setInsertPreviewIdx] = useState<number>(0);

  const [hoveredBoardMinion, setHoveredBoardMinion] = useState<MinionInstance | null>(null);
  const [hoveredHistoryItem, setHoveredHistoryItem] = useState<ActionHistoryItem | null>(null);
  const [playerEmoteText, setPlayerEmoteText] = useState<string | null>(null);
  const [opponentEmoteText, setOpponentEmoteText] = useState<string | null>(null);
  const [toyToast, setToyToast] = useState<string | null>(null);
  const [shakeState, setShakeState] = useState<{
    active: boolean;
    seq: number;
    damage: number;
    ampX: number;
    ampY: number;
    rotDeg: number;
    durationMs: number;
  }>({
    active: false,
    seq: 0,
    damage: 0,
    ampX: 0,
    ampY: 0,
    rotDeg: 0,
    durationMs: 240,
  });
  const [aiHighlightText, setAiHighlightText] = useState<string | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState<MatchRewardBreakdown | null>(null);
  const [postGameAutoPaused, setPostGameAutoPaused] = useState<boolean>(false);
  const [postGameRemainingMs, setPostGameRemainingMs] = useState<number>(3000);
  const [defeatPackResult, setDefeatPackResult] = useState<
    (DefeatPackReinforcementResult & { flipped: boolean }) | null
  >(null);
  const [drawRetryRemainingMs, setDrawRetryRemainingMs] = useState<number>(3500);
  const [attackAnim, setAttackAnim] = useState<ActiveAttackAnim | null>(null);

  const friendlyRowRef = useRef<HTMLDivElement | null>(null);
  const recordedResultRef = useRef(false);
  const postGameFiredRef = useRef(false);
  const drawRetryFiredRef = useRef(false);
  const matchStateRef = useRef<BattleMatchState>(matchState);
  matchStateRef.current = matchState;
  const attackLockRef = useRef(false);
  const attackSeqRef = useRef(0);
  const attackTimersRef = useRef<number[]>([]);
  const shakeTimerRef = useRef<number | null>(null);
  const activeShakeRef = useRef<{ until: number; strength: number }>({ until: 0, strength: 0 });
  const profile = liveProfile;

  useEffect(() => {
    return () => {
      for (const tid of attackTimersRef.current) window.clearTimeout(tid);
      attackTimersRef.current = [];
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
      attackLockRef.current = false;
    };
  }, []);

  const resolveHeroPortraitUrl = useCallback((p: PlayerBattleState): string => {
    if (p.isJaraxxus) return '/hs-assets/characters/cutouts/080_Ironforge.webp';
    if (p.customHero?.portraitUrl) return p.customHero.portraitUrl;
    return getHeroArtUrl(CLASSIC_HEROES[p.heroClass].heroId);
  }, []);

  const resolveHistoryIconUrl = useCallback(
    (item: ActionHistoryItem): string => {
      const p = item.actorSide === 'PLAYER' ? matchState.player : matchState.opponent;
      if (
        p.customHero &&
        (item.cardId === p.heroId || item.cardId === p.heroPowerId || item.kind === 'HERO_POWER')
      ) {
        return p.customHero.portraitUrl;
      }
      return getCardTileUrl(item.cardId);
    },
    [matchState.player, matchState.opponent],
  );

  useEffect(() => {
    const syncProfile = () => setLiveProfile(hsStorage.getProfile());
    window.addEventListener('snshero:state-changed', syncProfile);
    return () => window.removeEventListener('snshero:state-changed', syncProfile);
  }, []);

  const journeyDeckStats = useMemo(() => {
    const multMap: Record<string, number> =
      matchState.journeyMeta?.playerCardMultipliers || {};
    const vals: number[] = Object.values(multMap);
    return {
      boostedCount: vals.filter((v) => v > 1).length,
      maxMultiplier: vals.length > 0 ? Math.max(1, ...vals) : 1,
    };
  }, [matchState.journeyMeta]);

  const getPlayerCardMult = useCallback(
    (cardId: string): number => {
      if (mode !== 'TUTORIAL') return 1;
      return matchState.journeyMeta?.playerCardMultipliers[cardId] || 1;
    },
    [mode, matchState.journeyMeta],
  );

  const engine = useMemo(() => createEngine(matchState), [matchState]);
  const playerSpellPower = engine.getTotalSpellPower('PLAYER');
  const playerVelenMult = matchState.player.board.some(
    (m) => !m.silenced && m.cardId === 'EX1_350',
  )
    ? 2
    : 1;

  // Ensure removed/destroyed/returned minions or evicted history entries NEVER linger beside End Turn
  const liveHoveredBoardMinion = useMemo(() => {
    if (!hoveredBoardMinion || matchState.phase !== 'PLAYING') return null;
    return (
      matchState.player.board.find((m) => m.uid === hoveredBoardMinion.uid) ||
      matchState.opponent.board.find((m) => m.uid === hoveredBoardMinion.uid) ||
      null
    );
  }, [hoveredBoardMinion, matchState.phase, matchState.player.board, matchState.opponent.board]);

  const liveHoveredHistoryItem = useMemo(() => {
    if (!hoveredHistoryItem) return null;
    return matchState.history.slice(0, 7).find((it) => it.id === hoveredHistoryItem.id) || null;
  }, [hoveredHistoryItem, matchState.history]);

  useEffect(() => {
    if (hoveredBoardMinion && !liveHoveredBoardMinion) {
      setHoveredBoardMinion(null);
    }
  }, [hoveredBoardMinion, liveHoveredBoardMinion]);

  useEffect(() => {
    if (hoveredHistoryItem && !liveHoveredHistoryItem) {
      setHoveredHistoryItem(null);
    }
  }, [hoveredHistoryItem, liveHoveredHistoryItem]);

  const vsIntroRunIdRef = useRef(0);

  const runVsIntroAndTransition = useCallback(
    (activeMatch: typeof matchState, minDelayMs: number) => {
      const runId = ++vsIntroRunIdRef.current;
      setVsIntroActive(true);

      const minDelayPromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, minDelayMs);
      });
      const announcePromise = hsAudio.playMatchupAnnouncement(
        activeMatch.player.heroClass,
        activeMatch.opponent.heroClass,
        activeMatch.player.heroNameKo || activeMatch.player.name,
        activeMatch.opponent.heroNameKo || activeMatch.opponent.name,
        Boolean(activeMatch.player.customHero),
        Boolean(activeMatch.opponent.customHero || activeMatch.journeyMeta),
      );
      const safetyCapPromise = new Promise<void>((resolve) => {
        window.setTimeout(resolve, 7500);
      });

      void Promise.race([Promise.all([announcePromise, minDelayPromise]), safetyCapPromise]).then(
        () => {
          if (vsIntroRunIdRef.current !== runId) return;
          setVsIntroActive(false);
          if (activeMatch.journeyMeta?.episode === 0) {
            hsAudio.playCustomVoFile('/hs-assets/snshero-audio/story/ep00_start_scarecrow.mp3');
          } else {
            hsAudio.playHeroVo(activeMatch.opponent.heroClass, 'start');
          }
          if (activeMatch.opponent.customHero?.emotesKo.start) {
            setOpponentEmoteText(activeMatch.opponent.customHero.emotesKo.start);
            window.setTimeout(() => setOpponentEmoteText(null), 2900);
          }
        },
      );
    },
    [],
  );

  // Opening VS Clash + Matchup Fanfare (runs immediately for non-TUTORIAL or skipStoryIntro retry, or right after Story Theater closes in TUTORIAL)
  useEffect(() => {
    hsAudio.playBgm('mulligan');
    if (mode === 'TUTORIAL' && !skipStoryIntro) return;
    runVsIntroAndTransition(matchState, skipStoryIntro ? 1200 : 1400);
    return () => {
      vsIntroRunIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCompletePreBattleStory = useCallback(
    (selectedEpisode?: number) => {
      const curP = hsStorage.getProfile();
      let activeMatch = matchState;
      if (
        mode === 'TUTORIAL' &&
        selectedEpisode &&
        selectedEpisode !== matchState.journeyMeta?.episode
      ) {
        hsStorage.setJourneyProgress(selectedEpisode, curP.journeyReincarnation);
        activeMatch = buildBattleMatchState(selectedEpisode);
        setMatchState(activeMatch);
      }
      setStoryPhase('CLOSED');
      if (
        mode === 'TUTORIAL' &&
        (activeMatch.journeyMeta?.episode ?? 1) === 1 &&
        curP.totalGames === 0 &&
        !hasSeenQuickRules()
      ) {
        setQuickRulesOpen(true);
      }
      runVsIntroAndTransition(activeMatch, 1200);
    },
    [mode, matchState, buildBattleMatchState, runVsIntroAndTransition],
  );

  // 실시간 초보자 코치 배너 1줄 메시지 계산
  const coachTip = useMemo(() => {
    if (matchState.phase === 'MULLIGAN') {
      return {
        tone: 'amber' as const,
        badge: isKo ? '멀리건' : 'Mulligan',
        text: isKo
          ? '1~3코스트 카드는 남기고, 큰 카드를 눌러 1회 교체한 뒤 [확인]을 누르세요.'
          : 'Keep 1–3 Cost cards, tap high-Cost cards to replace once, then press [Confirm].',
      };
    }
    if (matchState.phase === 'GAME_OVER') {
      return null;
    }
    if (matchState.phase !== 'PLAYING' || matchState.activeSide !== 'PLAYER') {
      return {
        tone: 'slate' as const,
        badge: isKo ? '상대 턴' : 'Enemy Turn',
        text: isKo
          ? '상대가 카드를 내고 공격하는 중입니다. 내 턴이 올 때까지 잠시 기다리세요.'
          : 'Opponent is playing cards and attacking. Please wait for your turn.',
      };
    }
    const playableCount = matchState.player.hand.filter(
      (hc) => engine.inspectPlayability('PLAYER', hc).canPlay,
    ).length;
    const minionAttackers = matchState.player.board.filter(
      (m) => engine.canAttackerSwing('PLAYER', m.uid).ok,
    ).length;
    const heroCanAttack = engine.canAttackerSwing('PLAYER', 'PLAYER_HERO').ok;
    const totalAttackers = minionAttackers + (heroCanAttack ? 1 : 0);

    if (autoPlay) {
      if (playableCount > 0) {
        return {
          tone: 'sky' as const,
          badge: isKo ? '자동플레이' : 'Auto-Play',
          text: isKo
            ? `AI가 남은 마나(${matchState.player.mana})로 낼 수 있는 카드를 선택 중입니다. (상단 버튼으로 수동 전환 가능)`
            : `AI is picking playable cards with ${matchState.player.mana} Mana remaining. (Tap Auto to take control)`,
        };
      }
      if (totalAttackers > 0) {
        return {
          tone: 'sky' as const,
          badge: isKo ? '자동플레이' : 'Auto-Play',
          text: isKo
            ? `AI가 공격 가능한 유닛(${totalAttackers}기)으로 적을 공격하고 있습니다.`
            : `AI is attacking with ${totalAttackers} ready unit(s).`,
        };
      }
      return {
        tone: 'sky' as const,
        badge: isKo ? '자동플레이' : 'Auto-Play',
        text: isKo
          ? 'AI가 이번 턴 행동을 마치고 턴을 넘깁니다. 직접 조종하려면 [자동 OFF]를 누르세요.'
          : 'AI is ending the turn. Tap [Auto OFF] anytime to play manually.',
      };
    }

    if (selection?.kind === 'MINION' || selection?.kind === 'HERO') {
      const hasEnemyTaunt = matchState.opponent.board.some(
        (m) => !m.stealth && (m.taunt || m.auraTaunt),
      );
      return {
        tone: 'emerald' as const,
        badge: isKo ? '공격 조준' : 'Targeting',
        text: hasEnemyTaunt
          ? isKo
            ? '🛡️ 도발 하수인이 앞을 막고 있습니다! 도발 방패 하수인을 먼저 공격하세요.'
            : '🛡️ A Taunt minion blocks the way! Attack the shielded Taunt minion first.'
          : isKo
            ? '상대 하수인이나 위쪽 상대 영웅 초상화를 눌러 공격하세요! (취소: 빈 곳 클릭)'
            : 'Tap an enemy minion or top enemy hero portrait to attack! (Tap empty space to cancel)',
      };
    }
    if (selection?.kind === 'HAND_CARD') {
      return {
        tone: 'emerald' as const,
        badge: isKo ? '대상 선택' : 'Select Target',
        text: isKo
          ? '초록·노란빛으로 강조된 대상(아군 또는 적)을 눌러 카드 효과를 발동하세요!'
          : 'Tap any highlighted target (ally or enemy) to trigger the card effect!',
      };
    }
    if (playableCount > 0) {
      return {
        tone: 'emerald' as const,
        badge: isKo ? `마나 ${matchState.player.mana}/${matchState.player.maxMana}` : `Mana ${matchState.player.mana}/${matchState.player.maxMana}`,
        text: isKo
          ? '아래 손패에서 초록빛 테두리 카드를 눌러 전장에 소환하세요!'
          : 'Tap a green-glowing card in your hand below to play it onto the board!',
      };
    }
    if (totalAttackers > 0) {
      return {
        tone: 'emerald' as const,
        badge: isKo ? '공격 가능' : 'Ready to Attack',
        text: isKo
          ? `전장의 초록빛 내 하수인${heroCanAttack ? ' 또는 영웅' : ''}을 누른 뒤 적을 공격하세요!`
          : `Tap a green-glowing minion${heroCanAttack ? ' or hero' : ''}, then tap an enemy target!`,
      };
    }
    return {
      tone: 'amber' as const,
      badge: isKo ? '턴 마무리' : 'Wrap Up',
      text: isKo
        ? '할 수 있는 행동을 마쳤습니다! 오른쪽 [턴 종료] 버튼을 눌러 턴을 넘기세요.'
        : 'All moves done! Press [End Turn] on the right to pass the turn.',
    };
  }, [matchState, autoPlay, selection, engine, isKo]);

  // Clear banner / error messages smoothly
  useEffect(() => {
    if (!matchState.bannerMessage) return;
    if (matchState.bannerMessage === '내 턴!' || matchState.bannerMessage === 'YOUR TURN!') {
      hsAudio.playSfx('player_turn', 0.85);
      hsAudio.playProceduralVfxSound('MANA_GAIN');
    }
    const t = window.setTimeout(() => {
      setMatchState((s) => ({ ...s, bannerMessage: null }));
    }, 1450);
    return () => clearTimeout(t);
  }, [matchState.bannerMessage, matchState.turnNumber]);

  useEffect(() => {
    if (!matchState.errorBanner) return;
    const t = window.setTimeout(() => {
      setMatchState((s) => ({ ...s, errorBanner: null }));
    }, 2100);
    return () => clearTimeout(t);
  }, [matchState.errorBanner]);

  useEffect(() => {
    const onResize = () =>
      setIsCompactMobile(
        window.innerWidth < 640 && window.innerHeight >= window.innerWidth,
      );
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Record match outcome & rewards once when GAME_OVER triggers
  // (In Ranked / AI modes, immediately deactivate Auto-Play upon battle end so each match requires fresh activation!)
  useEffect(() => {
    if (matchState.phase === 'GAME_OVER' && mode !== 'TUTORIAL' && autoPlay) {
      setAutoPlay(false);
    }
  }, [matchState.phase, mode, autoPlay]);

  useEffect(() => {
    if (matchState.phase === 'GAME_OVER' && !recordedResultRef.current) {
      recordedResultRef.current = true;
      if (mode !== 'TUTORIAL') {
        setAutoPlay(false);
      }
      setSelection(null);
      setZoomState(null);
      setAiHighlightText(null);
      const didWin = matchState.winner === 'PLAYER';
      if (didWin) {
        hsAudio.playHeroVo(matchState.opponent.heroClass, 'concede');
        if (matchState.opponent.customHero?.emotesKo.concede) {
          setOpponentEmoteText(matchState.opponent.customHero.emotesKo.concede);
        }
      } else {
        hsAudio.playHeroVo(matchState.player.heroClass, 'concede');
        if (matchState.player.customHero?.emotesKo.concede) {
          setPlayerEmoteText(matchState.player.customHero.emotesKo.concede);
        }
      }
      const summary = hsStorage.recordMatchOutcome(
        matchState.player.heroClass,
        didWin,
        mode,
        matchState.opponent.heroClass,
      );
      setOutcomeSummary(summary);
      setLiveProfile(hsStorage.getProfile());
      setPostGameRemainingMs(3000);
      postGameFiredRef.current = false;
    }
  }, [
    matchState.phase,
    matchState.winner,
    matchState.player.heroClass,
    matchState.opponent.heroClass,
    mode,
  ]);

  const triggerDefeatPackReinforcement = useCallback(() => {
    const res = hsStorage.purchaseAndOpenReinforcementPack();
    setLiveProfile(hsStorage.getProfile());
    hsAudio.playSfx('pack_open', 0.92);
    setDefeatPackResult({ ...res, flipped: false });
    setDrawRetryRemainingMs(3500);
    drawRetryFiredRef.current = false;

    window.setTimeout(() => {
      setDefeatPackResult((prev) => (prev ? { ...prev, flipped: true } : null));
      const rarityOrder: Record<string, number> = {
        LEGENDARY: 4,
        EPIC: 3,
        RARE: 2,
        COMMON: 1,
        FREE: 0,
      };
      const best = [...res.cards].sort(
        (a, b) =>
          (rarityOrder[b.card.rarity] || 0) - (rarityOrder[a.card.rarity] || 0) ||
          (b.isGolden ? 1 : 0) - (a.isGolden ? 1 : 0),
      )[0];
      if (!best) return;
      const rar = best.card.rarity;
      if (rar === 'LEGENDARY') {
        hsAudio.playSfx('pack_legendary', 0.95);
        hsAudio.playInnkeeper(best.isGolden ? 'golden_legendary' : 'legendary');
      } else if (rar === 'EPIC') {
        hsAudio.playSfx('pack_epic', 0.9);
        hsAudio.playInnkeeper(best.isGolden ? 'golden_epic' : 'epic');
      } else if (rar === 'RARE') {
        hsAudio.playSfx('pack_rare', 0.85);
        hsAudio.playInnkeeper(best.isGolden ? 'golden_rare' : 'rare');
      } else if (best.isGolden) {
        hsAudio.playSfx('pack_rare', 0.78);
        hsAudio.playInnkeeper('golden_common');
      } else {
        hsAudio.playSfx('card_flip', 0.85);
      }
    }, 220);
  }, []);

  // Auto-advance Victory / Defeat popup after 3 seconds when Auto-Play is ON
  // On Story Mode (TUTORIAL) defeat, instead of jumping straight into a rematch, buy 1 pack with Gold (if >= 100G) and open the pack first to strengthen the deck!
  useEffect(() => {
    if (
      matchState.phase !== 'GAME_OVER' ||
      !outcomeSummary ||
      !autoPlay ||
      postGameAutoPaused ||
      defeatPackResult !== null
    ) {
      return;
    }

    const tickMs = 100;
    const id = window.setInterval(() => {
      setPostGameRemainingMs((prev) => {
        const next = Math.max(0, prev - tickMs);
        if (next === 0 && !postGameFiredRef.current) {
          postGameFiredRef.current = true;
          window.setTimeout(() => {
            if (matchState.winner === 'PLAYER') {
              if (
                mode === 'TUTORIAL' &&
                onStartJourneyEpisode &&
                outcomeSummary.nextEpisode
              ) {
                hsAudio.playSfx('box_press');
                onStartJourneyEpisode(outcomeSummary.nextEpisode, false);
              } else {
                hsAudio.playSfx('menu_select');
                hsAudio.playBgm('tavern_hub');
                onExitBattle();
              }
            } else if (mode === 'TUTORIAL') {
              triggerDefeatPackReinforcement();
            } else {
              hsAudio.playSfx('menu_select');
              hsAudio.playBgm('tavern_hub');
              onExitBattle();
            }
          }, 0);
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(id);
  }, [
    matchState.phase,
    matchState.winner,
    outcomeSummary,
    autoPlay,
    postGameAutoPaused,
    defeatPackResult,
    mode,
    onStartJourneyEpisode,
    onExitBattle,
    triggerDefeatPackReinforcement,
  ]);

  // After buying & opening 1 reinforcement pack (5 cards) on Defeat, auto-retry the SAME episode with the strengthened deck after 3.5 seconds!
  useEffect(() => {
    if (
      !defeatPackResult ||
      !autoPlay ||
      postGameAutoPaused ||
      !onStartJourneyEpisode
    ) {
      return;
    }

    const retryEp = matchState.journeyMeta?.episode ?? profile.journeyEpisode ?? 0;
    const tickMs = 100;
    const id = window.setInterval(() => {
      setDrawRetryRemainingMs((prev) => {
        const next = Math.max(0, prev - tickMs);
        if (next === 0 && !drawRetryFiredRef.current) {
          drawRetryFiredRef.current = true;
          window.setTimeout(() => {
            hsAudio.playSfx('box_press');
            onStartJourneyEpisode(retryEp, true);
          }, 0);
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(id);
  }, [
    defeatPackResult,
    autoPlay,
    postGameAutoPaused,
    onStartJourneyEpisode,
    matchState.journeyMeta?.episode,
    profile.journeyEpisode,
  ]);

  // 75-second Turn Timer + 15-second Burning Rope Fuse (disabled during Ep0 tutorial playback)
  useEffect(() => {
    if (
      isEp0Tutorial ||
      storyPhase !== 'CLOSED' ||
      matchState.phase !== 'PLAYING' ||
      matchState.activeSide !== 'PLAYER'
    ) {
      return;
    }
    const iv = window.setInterval(() => {
      setMatchState((prev) => {
        if (prev.phase !== 'PLAYING' || prev.activeSide !== 'PLAYER') return prev;
        const nextSec = prev.turnSecondsLeft - 1;
        if (nextSec === 15) {
          hsAudio.playHeroVo(prev.player.heroClass, 'time');
        }
        if (nextSec <= 15 && nextSec > 0) {
          hsAudio.playProceduralVfxSound('ROPE_TICK');
        }
        if (nextSec <= 0) {
          setSelection(null);
          const nextEng = createEngine(prev);
          hsAudio.playSfx('end_turn');
          return nextEng.endTurn();
        }
        return { ...prev, turnSecondsLeft: nextSec };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [storyPhase, matchState.phase, matchState.activeSide, matchState.turnNumber]);

  /**
   * 카드가 주고받는 데미지(공격 피해 + 반격 피해, 또는 주문 피해량)에 비례한 정밀 화면 흔들림 엔진
   * - 1~2 경미한 진동(±2px, 195ms) ➔ 4~6 일반 타격(±5.5px, 285ms) ➔ 8~11 강타(±10.5px, 385ms) ➔ 12+ 대격돌(±15~22px, 490~560ms)
   */
  const triggerDamageImpact = useCallback(
    (rawDamage: number, opts?: { isFinisher?: boolean }) => {
      const dmg = Math.max(1, Math.round(rawDamage || 1));
      const isFinisher = Boolean(opts?.isFinisher);
      const strength = isFinisher ? 120 : dmg;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now < activeShakeRef.current.until && strength < activeShakeRef.current.strength) {
        return;
      }

      let ampX: number;
      const rotDeg = 0; // GPU 래스터화 쟁크 및 텍스트 블러 방지를 위해 60fps 순수 translate3d 이동
      let durationMs: number;

      if (isFinisher) {
        ampX = 12;
        durationMs = 360;
      } else if (dmg <= 2) {
        ampX = Number((1.2 + dmg * 0.5).toFixed(2));
        durationMs = 180;
      } else if (dmg <= 4) {
        ampX = Number((1.8 + dmg * 0.6).toFixed(2));
        durationMs = 210;
      } else if (dmg <= 7) {
        ampX = Number((2.6 + dmg * 0.6).toFixed(2));
        durationMs = 250;
      } else if (dmg <= 11) {
        ampX = Number((3.6 + Math.min(11, dmg) * 0.55).toFixed(2));
        durationMs = 290;
      } else {
        // 12+ 대격돌: 최대 11px 상한으로 가볍고 빠른 타격감 제공 (저사양 쟁크 0%)
        ampX = Number(Math.min(10.8, 7.2 + (dmg - 12) * 0.2).toFixed(2));
        durationMs = 310;
      }

      const ampY = Number((ampX * 0.68).toFixed(2));
      activeShakeRef.current = { until: now + durationMs * 0.85, strength };

      setShakeState((prev) => ({
        active: true,
        seq: prev.seq + 1,
        damage: dmg,
        ampX,
        ampY,
        rotDeg,
        durationMs,
      }));

      if (shakeTimerRef.current !== null) {
        window.clearTimeout(shakeTimerRef.current);
      }
      shakeTimerRef.current = window.setTimeout(() => {
        setShakeState((prev) => ({ ...prev, active: false }));
      }, durationMs + 25);
    },
    [],
  );

  /**
   * 오리지널 하스스톤 물리 돌진·충돌·반동 타격 애니메이션 (Physical Card Lunge -> Impact -> Recoil)
   * - 아군 수동 공격 / 아군 자동플레이 공격 / 적군 AI 공격 모두 동일하게 실제 카드 토큰·영웅 초상화가
   *   공중으로 부양(WINDUP) -> 대상에게 고속 돌진(LUNGE) -> 정면 충돌 파열 & 피해 반영(IMPACT) -> 제자리 복귀(RETURN) 수행!
   */
  const triggerPhysicalAttack = useCallback(
    (side: PlayerSide, attackerId: string, defenderId: string) => {
      if (attackLockRef.current) return;
      const cur = matchStateRef.current;
      if (cur.phase !== 'PLAYING') return;

      const enemySide: PlayerSide = side === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
      const atkPlayer = side === 'PLAYER' ? cur.player : cur.opponent;
      const defPlayer = enemySide === 'PLAYER' ? cur.player : cur.opponent;
      const isHeroAttacker = attackerId === `${side}_HERO`;
      const isHeroDefender = defenderId === 'PLAYER_HERO' || defenderId === 'OPPONENT_HERO';

      const atkMinion = isHeroAttacker
        ? null
        : atkPlayer.board.find((m) => m.uid === attackerId) || null;
      if (!isHeroAttacker && !atkMinion) return;

      const defMinion = isHeroDefender
        ? null
        : defPlayer.board.find((m) => m.uid === defenderId) || null;
      if (!isHeroDefender && !defMinion) return;

      const { width: stageW, height: stageH } = getStageSize();
      const atkEl = document.querySelector(`[data-hs-entity="${attackerId}"]`);
      const defEl = document.querySelector(`[data-hs-entity="${defenderId}"]`);

      const startPos = atkEl
        ? elementCenterInStage(atkEl)
        : {
            x: stageW * 0.5,
            y: side === 'PLAYER' ? stageH * 0.62 : stageH * 0.34,
          };
      const targetPos = defEl
        ? elementCenterInStage(defEl)
        : {
            x: stageW * 0.5,
            y: enemySide === 'PLAYER' ? stageH * 0.77 : stageH * 0.17,
          };

      recordEntityStagePosition(attackerId, startPos);
      recordEntityStagePosition(defenderId, targetPos);

      const attackVal = isHeroAttacker
        ? getHeroAttack(atkPlayer, true)
        : getMinionAttack(atkMinion!);
      const healthVal = isHeroAttacker ? atkPlayer.health : getMinionHealth(atkMinion!);
      const armorVal = isHeroAttacker ? atkPlayer.armor : 0;
      const counterDmg = isHeroDefender ? 0 : getMinionAttack(defMinion!);
      const attackerWillDie =
        !isHeroAttacker &&
        !atkMinion!.divineShield &&
        counterDmg >= healthVal;

      const minionDef = atkMinion ? cardDb.mustGetCard(atkMinion.cardId) : null;
      const artUrl = isHeroAttacker
        ? resolveHeroPortraitUrl(atkPlayer)
        : getCardArtUrl(minionDef!);
      const atkMinionDef = isHeroAttacker ? null : cardDb.getCard(atkMinion!.cardId);
      const defMinionDef = isHeroDefender ? null : cardDb.getCard(defMinion!.cardId);
      const nameKo = isHeroAttacker
        ? atkPlayer.heroNameKo
        : atkMinionDef
          ? getCardName(atkMinionDef, lang)
          : atkMinion!.name;
      const defNameKo = isHeroDefender
        ? defPlayer.heroNameKo
        : defMinionDef
          ? getCardName(defMinionDef, lang)
          : defMinion!.name;
      const frameGradient =
        atkPlayer.customHero?.frameGradient || CLASSIC_HEROES[atkPlayer.heroClass].frameGradient;

      attackLockRef.current = true;
      attackSeqRef.current += 1;
      const animId = attackSeqRef.current;

      hsAudio.playSfx('whoosh', 0.85);
      setAiHighlightText(
        isKo
          ? `${side === 'PLAYER' ? '⚔ 아군 타격' : '💥 적군 타격'}: [${nameKo}](${attackVal}) ➔ [${defNameKo}]!`
          : `${side === 'PLAYER' ? '⚔ Ally Strike' : '💥 Enemy Strike'}: [${nameKo}](${attackVal}) ➔ [${defNameKo}]!`,
      );

      setAttackAnim({
        id: animId,
        side,
        attackerId,
        defenderId,
        isHeroAttacker,
        artUrl,
        nameKo,
        attackVal,
        healthVal,
        armorVal,
        taunt: atkMinion ? hasMinionTaunt(atkMinion) : false,
        divineShield: atkMinion ? atkMinion.divineShield : false,
        rarity: minionDef?.rarity,
        frameGradient,
        startX: startPos.x,
        startY: startPos.y,
        targetX: targetPos.x,
        targetY: targetPos.y,
        defenderDamage: attackVal,
        attackerCounterDamage: counterDmg,
        attackerWillDie,
        phase: 'WINDUP',
      });

      const tLunge = window.setTimeout(() => {
        setAttackAnim((prev) =>
          prev && prev.id === animId ? { ...prev, phase: 'LUNGE' } : prev,
        );
      }, 115);

      const tImpact = window.setTimeout(() => {
        // 주고받는 총 데미지 (공격 피해 + 반격으로 받은 피해) 비례 화면 흔들림 & 안드로이드 진동 강도 차등 적용
        const exchangedDamage = Math.max(1, attackVal + counterDmg);
        hsAudio.vibrateByDamage(exchangedDamage);
        const latest = matchStateRef.current;
        if (latest.phase === 'PLAYING') {
          const sim = createEngine(latest);
          const next = sim.performAttack(side, attackerId, defenderId);
          setMatchState(next);
        }
        hsAudio.playSfx(
          exchangedDamage >= 7 || attackVal >= 5 ? 'big_attack' : 'attack',
          Math.min(1, 0.72 + Math.min(12, exchangedDamage) * 0.024),
        );
        triggerDamageImpact(exchangedDamage);
        setAttackAnim((prev) =>
          prev && prev.id === animId ? { ...prev, phase: 'IMPACT_RETURN' } : prev,
        );
      }, 270);

      const tDone = window.setTimeout(() => {
        setAttackAnim((prev) => (prev && prev.id === animId ? null : prev));
        attackLockRef.current = false;
      }, 500);

      attackTimersRef.current = [
        ...attackTimersRef.current.slice(-12),
        tLunge,
        tImpact,
        tDone,
      ];
    },
    [resolveHeroPortraitUrl, triggerDamageImpact],
  );

  const describeEp0Action = useCallback(
    (side: 'PLAYER' | 'OPPONENT', cardId: string): { badge: string; headline: string; reason: string } => {
      const def = cardDb.mustGetCard(cardId);
      const dispName = getCardName(def, lang);
      const custom = getEp0CardReason(cardId, isKo);
      const fallbackReason = isKo
        ? def.type === 'MINION'
          ? `${def.cost}마나 ${def.attack ?? 1}/${def.health ?? 1} 기본 하수인으로 필드를 전개합니다.`
          : def.type === 'WEAPON'
            ? `${def.cost}마나 무기를 장착해 영웅이 직접 공격력을 얻습니다.`
            : `${def.cost}마나 주문 카드로 전황을 유리하게 바꿉니다.`
        : def.type === 'MINION'
          ? `Deploy a ${def.cost}-Mana ${def.attack ?? 1}/${def.health ?? 1} minion onto the board.`
          : def.type === 'WEAPON'
            ? `Equip a ${def.cost}-Mana weapon so your Hero can attack directly.`
            : `Cast a ${def.cost}-Mana spell to swing board control.`;
      if (side === 'PLAYER') {
        return {
          badge: isKo
            ? `카단 ${matchState.turnNumber}턴 · ${custom?.kindLabel || def.type}`
            : `Kadan T${matchState.turnNumber} · ${custom?.kindLabel || def.type}`,
          headline: isKo ? `[${dispName}] (마나 ${def.cost})` : `[${dispName}] (${def.cost} Mana)`,
          reason: custom?.playerReason || fallbackReason,
        };
      }
      return {
        badge: isKo
          ? `허수아비 로봇 ${matchState.turnNumber}턴 · ${custom?.kindLabel || def.type}`
          : `Scarecrow Bot T${matchState.turnNumber} · ${custom?.kindLabel || def.type}`,
        headline: isKo ? `[${dispName}] (마나 ${def.cost})` : `[${dispName}] (${def.cost} Mana)`,
        reason: custom?.scarecrowLine || fallbackReason,
      };
    },
    [matchState.turnNumber, lang, isKo],
  );

  const latestMatchRef = useRef(matchState);
  latestMatchRef.current = matchState;

  const playerActionStateKey = useMemo(() => {
    const p = matchState.player;
    const o = matchState.opponent;
    return [
      matchState.matchId,
      matchState.phase,
      matchState.activeSide,
      matchState.turnNumber,
      p.mana,
      p.hand.length,
      p.board.length,
      p.heroHealth,
      p.heroArmor,
      p.heroPowerUsedThisTurn ? 1 : 0,
      p.heroAttacksRemaining,
      p.board.map((m) => `${m.uid}:${m.attacksRemaining}:${m.attack}:${m.health}`).join(','),
      o.mana,
      o.hand.length,
      o.board.length,
      o.heroHealth,
      o.heroArmor,
      o.heroPowerUsedThisTurn ? 1 : 0,
      o.heroAttacksRemaining,
      o.board.map((m) => `${m.uid}:${m.attacksRemaining}:${m.attack}:${m.health}`).join(','),
      matchState.chooseOnePrompt ? 1 : 0,
      matchState.trackingPrompt ? 1 : 0,
    ].join('|');
  }, [matchState]);

  // ==================== PLAYER AUTO-PLAY ENGINE (카단의 여정 기본 ON, 수동 전환 즉시 해제) ====================
  useEffect(() => {
    const cur = latestMatchRef.current;
    if (!autoPlay || storyPhase !== 'CLOSED' || vsIntroActive) return;
    if (cur.phase === 'GAME_OVER') return;
    if (attackAnim || attackLockRef.current) return;

    // 1. Auto-Mulligan: swap cards costing >= 4 and start duel!
    if (cur.phase === 'MULLIGAN') {
      const t = window.setTimeout(() => {
        const snap = latestMatchRef.current;
        if (snap.phase !== 'MULLIGAN') return;
        const replaceUids = snap.player.hand
          .filter((hc) => cardDb.mustGetCard(hc.cardId).cost >= 4)
          .map((hc) => hc.uid);
        hsAudio.playSfx('box_press', 0.8);
        hsAudio.playBgm(Math.random() < 0.5 ? 'duel_1' : 'duel_2');
        const eng = createEngine(snap);
        if (isEp0Tutorial) {
          ep0TurnPlaysRef.current = [];
          ep0OpponentPlaysRef.current = [];
          ep0SummaryShownTurnRef.current = null;
          setEp0Dialogue({
            speaker: 'KADAN',
            badge: isKo ? '1턴 개시 · 멀리건 완료' : 'Turn 1 Start · Mulligan Done',
            headline: isKo ? '저비용 카드 확보 완료!' : 'Low-Cost Hand Ready!',
            reason: isKo
              ? '초반에 바로 낼 수 있는 저코스트 카드를 남겼어요!'
              : 'Kept low-Mana cards to play right away early on!',
          });
        }
        setMatchState(eng.confirmMulligan(replaceUids));
      }, isEp0Tutorial ? 1100 : 750);
      return () => window.clearTimeout(t);
    }

    if (cur.phase !== 'PLAYING' || cur.activeSide !== 'PLAYER') {
      return;
    }

    // Pause auto-play tick while player is inspecting an enlarged card
    if (zoomState) return;
    if (selection) setSelection(null);

    const plannedAction: AiAction | null =
      !cur.chooseOnePrompt && !cur.trackingPrompt
        ? computeNextAiAction(cur, 'EXPERT', 'PLAYER')
        : null;
    const isEp0TurnSummaryPending =
      isEp0Tutorial &&
      plannedAction?.kind === 'END_TURN' &&
      ep0SummaryShownTurnRef.current !== `${cur.turnNumber}_PLAYER`;
    const stepDelayMs = isEp0Tutorial
      ? plannedAction?.kind === 'PLAY_CARD'
        ? 3000
        : plannedAction?.kind === 'END_TURN' && !isEp0TurnSummaryPending
          ? 2400
          : 950
      : 560;
    const timer = window.setTimeout(() => {
      if (attackLockRef.current) return;
      const snap = latestMatchRef.current;
      if (snap.phase !== 'PLAYING' || snap.activeSide !== 'PLAYER') return;
      const sim = createEngine(snap);

      // Handle Choose-One prompt automatically
      if (snap.chooseOnePrompt) {
        const prompt = snap.chooseOnePrompt;
        const opt = prompt.options[0];
        const targetId = opt.needsTarget ? opt.validTargets[0] : undefined;
        hsAudio.playSfx('card_place', 0.8);
        setMatchState(
          sim.playCardFromHand('PLAYER', prompt.sourceHandUid, {
            chooseOptionIndex: opt.index,
            insertIndex: prompt.insertIndex,
            targetId,
          }),
        );
        return;
      }

      // Handle Tracking prompt automatically
      if (snap.trackingPrompt) {
        const pickId = snap.trackingPrompt.cards[0];
        hsAudio.playSfx('card_place', 0.8);
        setMatchState(sim.resolveTrackingChoice(pickId));
        return;
      }

      const action: AiAction = computeNextAiAction(snap, 'EXPERT', 'PLAYER');
      if (action.kind === 'PLAY_CARD') {
        const def = cardDb.mustGetCard(action.cardId);
        const dispName = getCardName(def, lang);
        hsAudio.playSfx('card_place', 0.85);
        setAiHighlightText(
          isKo ? `⚡ 자동 전투: [${dispName}] 사용!` : `⚡ Auto-Play: Played [${dispName}]!`,
        );
        if (isEp0Tutorial) {
          const info = describeEp0Action('PLAYER', action.cardId);
          ep0TurnPlaysRef.current.push(`[${dispName}] → ${info.reason}`);
          setEp0Dialogue({ speaker: 'KADAN', ...info });
        }
        const next = sim.playCardFromHand('PLAYER', action.handUid, {
          targetId: action.targetId,
          insertIndex: action.insertIndex,
          chooseOptionIndex: action.chooseOptionIndex,
        });
        if (next.chooseOnePrompt === null) {
          if (def.type === 'MINION') hsStorage.recordQuestProgress('MINION', 1);
          else if (def.type === 'SPELL') hsStorage.recordQuestProgress('SPELL', 1);
        }
        setMatchState(next);
      } else if (action.kind === 'HERO_POWER') {
        hsAudio.playSfx('hero_power', 0.85);
        setAiHighlightText(
          isKo
            ? `⚡ 자동 전투: 영웅 능력 [${snap.player.heroPowerNameKo}]!`
            : `⚡ Auto-Play: Hero Power [${snap.player.heroPowerNameKo}]!`,
        );
        if (isEp0Tutorial) {
          const hpReason = isKo
            ? '남은 2마나로 영웅 능력을 사용합니다.'
            : 'Spending 2 leftover Mana on Hero Power.';
          ep0TurnPlaysRef.current.push(
            isKo ? `영웅 능력 → ${hpReason}` : `Hero Power → ${hpReason}`,
          );
          setEp0Dialogue({
            speaker: 'KADAN',
            badge: isKo ? `카단 ${snap.turnNumber}턴 · 영웅 능력` : `Kadan T${snap.turnNumber} · Hero Power`,
            headline: `[${snap.player.heroPowerNameKo}]`,
            reason: hpReason,
          });
        }
        setMatchState(sim.useHeroPower('PLAYER', action.targetId));
      } else if (action.kind === 'ATTACK') {
        if (isEp0Tutorial) {
          const isFace = action.defenderId === 'OPPONENT_HERO';
          setEp0Dialogue({
            speaker: 'KADAN',
            badge: isKo ? `카단 ${snap.turnNumber}턴 · 공격` : `Kadan T${snap.turnNumber} · Attack`,
            headline: isFace
              ? isKo
                ? '상대 본체 직접 타격!'
                : 'Direct Hero Strike!'
              : isKo
                ? '적 하수인 먼저 정리!'
                : 'Clear Enemy Minion First!',
            reason: isFace
              ? isKo
                ? '도발이 없어 본체를 직접 공격합니다.'
                : 'No Taunt blocks the lane — hit the Hero directly!'
              : isKo
                ? '적 하수인을 먼저 잡아 필드를 지킵니다.'
                : 'Trade with enemy minions first to hold the board!',
          });
        }
        triggerPhysicalAttack('PLAYER', action.attackerId, action.defenderId);
      } else {
        if (isEp0Tutorial) {
          const turnKey = `${snap.turnNumber}_PLAYER`;
          if (ep0SummaryShownTurnRef.current !== turnKey) {
            ep0SummaryShownTurnRef.current = turnKey;
            const summaryText =
              ep0TurnPlaysRef.current.length > 0
                ? ep0TurnPlaysRef.current[ep0TurnPlaysRef.current.length - 1]
                : isKo
                  ? '마나가 부족해 다음 턴(+1)을 준비합니다.'
                  : 'Low on Mana — preparing +1 Max Mana next turn!';
            setAiHighlightText(
              isKo ? `💬 카단 ${snap.turnNumber}턴 요약` : `💬 Kadan Turn ${snap.turnNumber} Recap`,
            );
            setEp0Dialogue({
              speaker: 'KADAN',
              badge: isKo ? `카단 ${snap.turnNumber}턴 종료` : `Kadan End of T${snap.turnNumber}`,
              headline: isKo ? '이번 턴 핵심 이유' : 'Key Move This Turn',
              reason: summaryText,
            });
            setEp0SummaryNonce((n) => n + 1);
            return;
          }
          ep0TurnPlaysRef.current = [];
        }
        hsAudio.playSfx('end_turn', 0.85);
        setAiHighlightText(null);
        setMatchState(sim.endTurn());
      }
    }, stepDelayMs);

    return () => window.clearTimeout(timer);
  }, [
    autoPlay,
    storyPhase,
    vsIntroActive,
    playerActionStateKey,
    selection,
    zoomState,
    attackAnim,
    triggerPhysicalAttack,
    isEp0Tutorial,
    ep0SummaryNonce,
    describeEp0Action,
  ]);

  // Step-by-Step Opponent AI Turn Execution Loop
  useEffect(() => {
    const cur = latestMatchRef.current;
    if (
      storyPhase !== 'CLOSED' ||
      cur.phase !== 'PLAYING' ||
      cur.activeSide !== 'OPPONENT'
    ) {
      if (cur.activeSide !== 'PLAYER' && !attackAnim) setAiHighlightText(null);
      return;
    }
    if (attackAnim || attackLockRef.current) return;

    const difficulty =
      mode === 'TUTORIAL'
        ? getJourneyDifficultySpec(
            cur.journeyMeta?.episode ?? 1,
            cur.journeyMeta?.reincarnation || 0,
          ).aiDifficulty
        : mode === 'PRACTICE_NORMAL'
          ? 'NORMAL'
          : 'EXPERT';

    const plannedOppRaw = computeNextAiAction(cur, difficulty, 'OPPONENT');
    let plannedOpp = plannedOppRaw;
    if (isEp0Tutorial) {
      if (plannedOpp.kind === 'HERO_POWER') {
        plannedOpp = { kind: 'END_TURN' };
      } else if (plannedOpp.kind === 'PLAY_CARD' && ep0OpponentPlaysRef.current.length >= 1) {
        plannedOpp = { kind: 'END_TURN' };
      } else if (
        cur.player.heroHealth <= 10 &&
        plannedOpp.kind === 'ATTACK' &&
        plannedOpp.defenderId === 'PLAYER_HERO'
      ) {
        plannedOpp = { kind: 'END_TURN' };
      }
    }
    const isEp0OppSummaryPending =
      isEp0Tutorial &&
      plannedOpp.kind === 'END_TURN' &&
      ep0SummaryShownTurnRef.current !== `${cur.turnNumber}_OPPONENT`;
    const stepDelayMs = isEp0Tutorial
      ? plannedOpp.kind === 'PLAY_CARD'
        ? 3000
        : plannedOpp.kind === 'END_TURN' && !isEp0OppSummaryPending
          ? 2400
          : 950
      : 620;
    const timer = window.setTimeout(() => {
      if (attackLockRef.current) return;
      const snap = latestMatchRef.current;
      if (snap.phase !== 'PLAYING' || snap.activeSide !== 'OPPONENT') return;
      let action: AiAction = computeNextAiAction(snap, difficulty, 'OPPONENT');
      const sim = createEngine(snap);

      // 에피소드 0 훈련 보장: 허수아비 로봇은 턴당 1장씩만 내고 방어도 스톨/치명타를 피함
      if (isEp0Tutorial) {
        if (action.kind === 'HERO_POWER') {
          action = { kind: 'END_TURN' };
        } else if (action.kind === 'PLAY_CARD' && ep0OpponentPlaysRef.current.length >= 1) {
          action = { kind: 'END_TURN' };
        } else if (
          snap.player.heroHealth <= 10 &&
          action.kind === 'ATTACK' &&
          action.defenderId === 'PLAYER_HERO'
        ) {
          action = { kind: 'END_TURN' };
        }
      }

      if (action.kind === 'PLAY_CARD') {
        const def = cardDb.mustGetCard(action.cardId);
        const dispName = getCardName(def, lang);
        hsAudio.playSfx('card_place', 0.85);
        setAiHighlightText(
          isKo
            ? `${snap.opponent.heroNameKo}: [${dispName}] 사용!`
            : `${snap.opponent.heroNameKo}: Played [${dispName}]!`,
        );
        if (isEp0Tutorial) {
          const info = describeEp0Action('OPPONENT', action.cardId);
          ep0OpponentPlaysRef.current.push(`[${dispName}] → ${info.reason}`);
          setEp0Dialogue({ speaker: 'SCARECROW', ...info });
        }
        setMatchState(
          sim.playCardFromHand('OPPONENT', action.handUid, {
            targetId: action.targetId,
            insertIndex: action.insertIndex,
            chooseOptionIndex: action.chooseOptionIndex,
          }),
        );
      } else if (action.kind === 'HERO_POWER') {
        hsAudio.playSfx('hero_power', 0.85);
        setAiHighlightText(
          isKo
            ? `${snap.opponent.heroNameKo}: 영웅 능력 [${snap.opponent.heroPowerNameKo}]!`
            : `${snap.opponent.heroNameKo}: Hero Power [${snap.opponent.heroPowerNameKo}]!`,
        );
        if (isEp0Tutorial) {
          const botHpReason = isKo
            ? '방어도 +2로 내구력을 테스트합니다.'
            : 'Testing durability with +2 Armor.';
          ep0OpponentPlaysRef.current.push(
            isKo ? `영웅 능력 → ${botHpReason}` : `Hero Power → ${botHpReason}`,
          );
          setEp0Dialogue({
            speaker: 'SCARECROW',
            badge: isKo ? `로봇 ${snap.turnNumber}턴 · 방어` : `Bot T${snap.turnNumber} · Defense`,
            headline: `[${snap.opponent.heroPowerNameKo}]`,
            reason: botHpReason,
          });
        }
        setMatchState(sim.useHeroPower('OPPONENT', action.targetId));
      } else if (action.kind === 'ATTACK') {
        if (isEp0Tutorial) {
          setEp0Dialogue({
            speaker: 'SCARECROW',
            badge: isKo ? `로봇 ${snap.turnNumber}턴 · 공격` : `Bot T${snap.turnNumber} · Attack`,
            headline: isKo ? '소환 다음 턴 반격!' : 'Ready Next Turn Counter!',
            reason: isKo
              ? '소환한 다음 턴부터 공격할 수 있습니다.'
              : 'Minions can attack starting the turn after they enter.',
          });
        }
        triggerPhysicalAttack('OPPONENT', action.attackerId, action.defenderId);
      } else {
        if (isEp0Tutorial) {
          const turnKey = `${snap.turnNumber}_OPPONENT`;
          if (ep0SummaryShownTurnRef.current !== turnKey) {
            ep0SummaryShownTurnRef.current = turnKey;
            const summaryText =
              ep0OpponentPlaysRef.current.length > 0
                ? ep0OpponentPlaysRef.current[ep0OpponentPlaysRef.current.length - 1]
                : isKo
                  ? '상대 턴 종료! 마나 +1을 받아 반격합니다.'
                  : 'Enemy turn ends! Gain +1 Max Mana to strike back.';
            setAiHighlightText(
              isKo ? `💬 카단 · ${snap.turnNumber}턴 해설` : `💬 Kadan · Turn ${snap.turnNumber} Note`,
            );
            setEp0Dialogue({
              speaker: 'KADAN',
              badge: isKo ? `카단 · ${snap.turnNumber}턴 해설` : `Kadan · T${snap.turnNumber} Insight`,
              headline: isKo ? '상대 수에 대비하는 이유' : 'Why We Counter That Play',
              reason: summaryText,
            });
            setEp0SummaryNonce((n) => n + 1);
            return;
          }
          ep0OpponentPlaysRef.current = [];
        }
        hsAudio.playSfx('end_turn', 0.85);
        setAiHighlightText(null);
        setMatchState(sim.endTurn());
      }
    }, stepDelayMs);

    return () => clearTimeout(timer);
  }, [
    storyPhase,
    playerActionStateKey,
    mode,
    attackAnim,
    triggerPhysicalAttack,
    isEp0Tutorial,
    ep0SummaryNonce,
    describeEp0Action,
  ]);

  // Pointer Move & Escape Cancel
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setPointerPos(clientToStagePoint(e.clientX, e.clientY));
      if (friendlyRowRef.current) {
        const children = Array.from(
          friendlyRowRef.current.querySelectorAll('[data-hs-entity]'),
        ) as HTMLElement[];
        let idx = children.length;
        for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          if (e.clientX < rect.left + rect.width / 2) {
            idx = i;
            break;
          }
        }
        setInsertPreviewIdx(idx);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        setEmoteMenuOpen(false);
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleConcede = useCallback(() => {
    if (matchState.phase === 'GAME_OVER') return;
    const eng = createEngine(matchState);
    setMatchState(eng.concede('PLAYER'));
  }, [matchState]);

  // Toggle Mulligan Card Selection
  const toggleMulliganCard = (uid: string) => {
    hsAudio.playSfx('card_flip', 0.7);
    setMatchState((prev) => {
      const exists = prev.mulliganSelectedUids.includes(uid);
      return {
        ...prev,
        mulliganSelectedUids: exists
          ? prev.mulliganSelectedUids.filter((x) => x !== uid)
          : [...prev.mulliganSelectedUids, uid],
      };
    });
  };

  const confirmMulliganNow = () => {
    hsAudio.playSfx('box_press');
    hsAudio.playBgm(Math.random() < 0.5 ? 'duel_1' : 'duel_2');
    if (matchState.firstPlayer === 'OPPONENT') {
      hsAudio.playInnkeeper('coin');
    }
    const eng = createEngine(matchState);
    setMatchState(eng.confirmMulligan(matchState.mulliganSelectedUids));
  };

  // Play an untargeted or targeted card
  const executePlayPlayerCard = (
    handUid: string,
    opts?: { targetId?: string; insertIndex?: number; chooseOptionIndex?: 0 | 1 },
  ) => {
    const hc = matchState.player.hand.find((h) => h.uid === handUid);
    if (!hc) return;
    const def = cardDb.mustGetCard(hc.cardId);
    hsAudio.playSfx('card_place', 0.9);
    const eng = createEngine(matchState);
    const next = eng.playCardFromHand('PLAYER', handUid, opts);
    // Quest tracking!
    if (next.chooseOnePrompt === null) {
      if (def.type === 'MINION') hsStorage.recordQuestProgress('MINION', 1);
      else if (def.type === 'SPELL') hsStorage.recordQuestProgress('SPELL', 1);
    }
    setSelection(null);
    setMatchState(next);
  };

  // Click a card in Player's Hand -> Select & Enlarge Card first (never play immediately!)
  const handleHandCardClick = (handUid: string) => {
    if (matchState.phase !== 'PLAYING' || attackAnim) return;
    const hc = matchState.player.hand.find((h) => h.uid === handUid);
    if (!hc) return;

    hsAudio.playSfx('card_hover', 0.7);
    setSelection(null);
    setZoomState({ kind: 'HAND_CARD', handUid });
  };

  // Resolve clicking a target entity (`PLAYER_HERO`, `OPPONENT_HERO`, or minion `uid`)
  const handleEntityClick = (entityId: string, isFriendlyMinionOrHero: boolean) => {
    if (matchState.phase !== 'PLAYING' || attackAnim) return;

    // 1. Complete active targeting selection!
    if (selection && matchState.activeSide === 'PLAYER') {
      if (selection.kind === 'HAND_CARD' && selection.needsTarget) {
        if (selection.validTargets.includes(entityId)) {
          executePlayPlayerCard(selection.handUid, {
            targetId: entityId,
            insertIndex: matchState.player.board.length,
          });
        } else {
          setMatchState((s) => ({
            ...s,
            errorBanner: isKo ? '올바른 대상이 아닙니다!' : 'Not a valid target!',
          }));
        }
        return;
      }

      if (selection.kind === 'CHOOSE_OPTION_TARGET') {
        if (selection.validTargets.includes(entityId)) {
          executePlayPlayerCard(selection.handUid, {
            chooseOptionIndex: selection.optionIndex,
            insertIndex: selection.insertIndex,
            targetId: entityId,
          });
        } else {
          setMatchState((s) => ({
            ...s,
            errorBanner: isKo ? '올바른 대상이 아닙니다!' : 'Not a valid target!',
          }));
        }
        return;
      }

      if (selection.kind === 'HERO_POWER') {
        if (selection.validTargets.includes(entityId)) {
          hsAudio.playSfx('hero_power', 0.9);
          const eng = createEngine(matchState);
          setSelection(null);
          setMatchState(eng.useHeroPower('PLAYER', entityId));
        } else {
          setMatchState((s) => ({
            ...s,
            errorBanner: isKo ? '올바른 대상이 아닙니다!' : 'Not a valid target!',
          }));
        }
        return;
      }

      if (selection.kind === 'ATTACKER') {
        if (selection.attackerId === entityId) {
          setSelection(null);
          return;
        }
        if (selection.validTargets.includes(entityId)) {
          if (selection.attackerId === 'PLAYER_HERO') {
            hsAudio.playHeroVo(matchState.player.heroClass, 'attack');
          }
          const atkId = selection.attackerId;
          setSelection(null);
          triggerPhysicalAttack('PLAYER', atkId, entityId);
        } else {
          const enemyHasTaunt = matchState.opponent.board.some(
            (m) => !m.stealth && (m.taunt || m.auraTaunt),
          );
          if (enemyHasTaunt) {
            hsAudio.playHeroVo(matchState.player.heroClass, 'error_taunt');
            setMatchState((s) => ({
              ...s,
              errorBanner: isKo
                ? '도발 능력이 있는 하수인이 가로막고 있습니다!'
                : 'A minion with Taunt is in the way!',
            }));
          } else {
            setMatchState((s) => ({
              ...s,
              errorBanner: isKo ? '공격할 수 없는 대상입니다!' : 'Cannot attack that target!',
            }));
          }
        }
        return;
      }

      // If holding an untargeted minion and clicking the friendly board area -> drop minion!
      if (selection.kind === 'HAND_CARD' && !selection.needsTarget && selection.isMinion) {
        executePlayPlayerCard(selection.handUid, { insertIndex: insertPreviewIdx });
        return;
      }
    }

    // 2. When no active targeting is pending:
    // Clicking an enemy minion enlarges it for crisp reading!
    if (!isFriendlyMinionOrHero) {
      if (entityId !== 'OPPONENT_HERO') {
        const oppMinion = matchState.opponent.board.find((m) => m.uid === entityId);
        if (oppMinion) {
          hsAudio.playSfx('card_hover', 0.65);
          setZoomState({ kind: 'BOARD_MINION', minion: oppMinion, isFriendly: false });
        }
      }
      return;
    }

    // Clicking a friendly minion or Hero:
    if (matchState.activeSide !== 'PLAYER') {
      if (entityId !== 'PLAYER_HERO') {
        const myMinion = matchState.player.board.find((m) => m.uid === entityId);
        if (myMinion) {
          hsAudio.playSfx('card_hover', 0.65);
          setZoomState({ kind: 'BOARD_MINION', minion: myMinion, isFriendly: true });
        }
      }
      return;
    }

    const swing = engine.canAttackerSwing('PLAYER', entityId);
    if (!swing.ok) {
      if (entityId !== 'PLAYER_HERO') {
        const myMinion = matchState.player.board.find((m) => m.uid === entityId);
        if (myMinion) {
          hsAudio.playSfx('card_hover', 0.65);
          setZoomState({ kind: 'BOARD_MINION', minion: myMinion, isFriendly: true });
          return;
        }
      } else if (getHeroAttack(matchState.player, true) > 0) {
        setMatchState((s) => ({
          ...s,
          errorBanner: swing.reason || (isKo ? '공격할 수 없습니다.' : 'Cannot attack right now.'),
        }));
        if (swing.errorCode === 'exhausted' || swing.errorCode === 'attacked') {
          hsAudio.playHeroVo(matchState.player.heroClass, 'error_attacked');
        }
      }
      return;
    }

    const validTargets = engine.getValidAttackTargets('PLAYER', entityId);
    if (validTargets.length > 0) {
      hsAudio.playSfx('ui_click', 0.7);
      setSelection({
        kind: 'ATTACKER',
        attackerId: entityId,
        validTargets,
      });
    }
  };

  // Click Player Hero Power
  const handlePlayerHeroPower = () => {
    if (matchState.phase !== 'PLAYING' || matchState.activeSide !== 'PLAYER') return;
    if (selection?.kind === 'HERO_POWER') {
      setSelection(null);
      return;
    }
    const hpCheck = engine.inspectHeroPower('PLAYER');
    if (!hpCheck.canUse) {
      setMatchState((s) => ({
        ...s,
        errorBanner: hpCheck.reason || (isKo ? '사용할 수 없습니다.' : 'Cannot use Hero Power.'),
      }));
      if (hpCheck.reason?.includes('마나') || hpCheck.reason?.includes('Mana')) {
        hsAudio.playHeroVo(matchState.player.heroClass, 'error_mana');
      }
      return;
    }
    if (hpCheck.needsTarget) {
      hsAudio.playSfx('ui_click', 0.8);
      setSelection({
        kind: 'HERO_POWER',
        validTargets: hpCheck.validTargets,
      });
    } else {
      hsAudio.playSfx('hero_power', 0.9);
      const eng = createEngine(matchState);
      setSelection(null);
      setMatchState(eng.useHeroPower('PLAYER'));
    }
  };

  // Emote Trigger + Polite Rival Reply
  const triggerPlayerEmote = (
    emoteKey: 'greetings' | 'well_played' | 'thanks' | 'wow' | 'oops' | 'threaten',
  ) => {
    setEmoteMenuOpen(false);
    const pEmotes =
      matchState.player.customHero?.emotesKo ||
      getLocalizedHeroInfo(matchState.player.heroClass, lang).emotes;
    setPlayerEmoteText(pEmotes[emoteKey]);
    hsAudio.playHeroVo(matchState.player.heroClass, emoteKey);
    window.setTimeout(() => setPlayerEmoteText(null), 2800);

    window.setTimeout(() => {
      const replyKey =
        emoteKey === 'greetings'
          ? 'greetings'
          : emoteKey === 'threaten'
            ? 'threaten'
            : emoteKey === 'well_played'
              ? 'thanks'
              : 'wow';
      const oEmotes =
        matchState.opponent.customHero?.emotesKo ||
        getLocalizedHeroInfo(matchState.opponent.heroClass, lang).emotes;
      setOpponentEmoteText(oEmotes[replyKey]);
      hsAudio.playHeroVo(matchState.opponent.heroClass, replyKey);
      window.setTimeout(() => setOpponentEmoteText(null), 2800);
    }, 1500);
  };

  // Compute live Targeting Arrow source coordinates
  const targetingArrow = useMemo(() => {
    if (!selection) return null;
    const needsArrow =
      (selection.kind === 'HAND_CARD' && selection.needsTarget) ||
      selection.kind === 'CHOOSE_OPTION_TARGET' ||
      selection.kind === 'HERO_POWER' ||
      selection.kind === 'ATTACKER';
    if (!needsArrow) return null;

    const { width: stageW, height: stageH } = getStageSize();
    let sx = stageW * 0.5;
    let sy = stageH * 0.82;
    if (selection.kind === 'ATTACKER') {
      const el = document.querySelector(`[data-hs-entity="${selection.attackerId}"]`);
      if (el) {
        const c = elementCenterInStage(el);
        sx = c.x;
        sy = c.y;
      }
    } else if (selection.kind === 'HERO_POWER') {
      sx = stageW * 0.58;
      sy = stageH * 0.77;
    } else if (selection.kind === 'HAND_CARD') {
      const el = document.querySelector(`[data-hand-uid="${selection.handUid}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const pt = clientToStagePoint(r.left + r.width / 2, r.top + 24);
        sx = pt.x;
        sy = pt.y;
      }
    }
    return { sx, sy, ex: pointerPos.x, ey: pointerPos.y };
  }, [selection, pointerPos]);

  const activeValidTargetSet = useMemo(() => {
    if (!selection) return new Set<string>();
    if ('validTargets' in selection) return new Set(selection.validTargets);
    return new Set<string>();
  }, [selection]);

  const isPlayerTurn = matchState.phase === 'PLAYING' && matchState.activeSide === 'PLAYER';
  const noMovesLeft = isPlayerTurn && !engine.hasAnyAvailableMove('PLAYER');
  const cornerToys = BOARD_CORNER_TOYS[matchState.boardTheme];

  const buildMinionStatusPills = (m: MinionInstance): string[] => {
    const pills: string[] = [];
    if (m.silenced) pills.push(isKo ? '침묵 상태' : 'Silenced');
    if (hasMinionTaunt(m)) pills.push(isKo ? '도발' : 'Taunt');
    if (m.divineShield) pills.push(isKo ? '빛의 보호막' : 'Divine Shield');
    if (m.stealth || m.concealedUntilNextTurn) pills.push(isKo ? '은신' : 'Stealth');
    if (m.windfury) pills.push(isKo ? '질풍' : 'Windfury');
    if (m.frozen) pills.push(isKo ? '빙결' : 'Frozen');
    if (m.charge || m.auraCharge) pills.push(isKo ? '돌진' : 'Charge');
    if (m.poisonous && !m.silenced) pills.push(isKo ? '독성' : 'Poisonous');
    if (m.elusive && !m.silenced) pills.push(isKo ? '주문·영웅 능력 대상 불가' : 'Elusive');
    if (m.cantAttack) pills.push(isKo ? '공격 불가' : "Can't Attack");
    if (m.spellDamage > 0 && !m.silenced) {
      pills.push(isKo ? `주문 공격력 +${m.spellDamage}` : `Spell Damage +${m.spellDamage}`);
    }
    if (m.exhausted && !m.charge && !m.auraCharge && !m.cantAttack) {
      pills.push(isKo ? '소환 후유증 (다음 턴 공격 가능)' : 'Summoning Sickness (Ready next turn)');
    } else if (m.attacksMadeThisTurn > 0 && (!m.windfury || m.attacksMadeThisTurn >= 2)) {
      pills.push(isKo ? '이번 턴 공격 완료' : 'Already Attacked');
    }
    return pills;
  };

  const renderActiveZoomModal = () => {
    if (!zoomState) return null;

    if (zoomState.kind === 'HAND_CARD') {
      const hc = matchState.player.hand.find((h) => h.uid === zoomState.handUid);
      if (!hc) return null;
      const def = cardDb.mustGetCard(hc.cardId);
      const check = engine.inspectPlayability('PLAYER', hc);
      const canPlayNow = isPlayerTurn && check.canPlay;

      const primaryAction: CardZoomAction = !isPlayerTurn
        ? {
            label: isKo ? '상대 턴에는 카드를 사용할 수 없습니다' : "Cannot play cards on opponent's turn",
            disabled: true,
            onClick: () => {},
          }
        : !check.canPlay
          ? {
              label: check.reason
                ? isKo
                  ? `사용 불가 · ${check.reason}`
                  : `Unavailable · ${check.reason}`
                : isKo
                  ? '마나가 부족합니다'
                  : 'Not enough Mana',
              disabled: true,
              onClick: () => {},
            }
          : {
              label: check.hasChooseOne
                ? isKo
                  ? `카드 사용 · 효과 선택 (마나 ${check.cost})`
                  : `Play · Choose One (${check.cost} Mana)`
                : check.needsTarget
                  ? isKo
                    ? `카드 사용 · 대상 지정 (마나 ${check.cost})`
                    : `Play · Select Target (${check.cost} Mana)`
                  : isKo
                    ? `카드 사용 (마나 ${check.cost})`
                    : `Play Card (${check.cost} Mana)`,
              variant: 'emerald',
              onClick: () => {
                setZoomState(null);
                if (check.hasChooseOne || !check.needsTarget) {
                  executePlayPlayerCard(hc.uid, {
                    insertIndex: matchState.player.board.length,
                  });
                } else {
                  setSelection({
                    kind: 'HAND_CARD',
                    handUid: hc.uid,
                    cardId: def.id,
                    needsTarget: true,
                    validTargets: check.validTargets,
                    isMinion: def.type === 'MINION',
                    hasChooseOne: false,
                  });
                }
              },
            };

      const secondaryActions: CardZoomAction[] =
        canPlayNow &&
        def.type === 'MINION' &&
        !check.needsTarget &&
        !check.hasChooseOne &&
        matchState.player.board.length > 0
          ? [
              {
                label: isKo ? '전장 위치 직접 지정하여 놓기' : 'Choose Exact Board Position',
                variant: 'brass',
                onClick: () => {
                  setZoomState(null);
                  setSelection({
                    kind: 'HAND_CARD',
                    handUid: hc.uid,
                    cardId: def.id,
                    needsTarget: false,
                    validTargets: [],
                    isMinion: true,
                    hasChooseOne: false,
                  });
                },
              },
            ]
          : [];

      const cardMult = getPlayerCardMult(def.id);
      return (
        <CardZoomModal
          card={def}
          effectiveCost={check.cost}
          spellPowerBonus={playerSpellPower}
          velenMultiplier={playerVelenMult}
          journeyMultiplier={cardMult}
          playableGlow={
            !canPlayNow ? 'NONE' : check.isComboReady ? 'COMBO' : 'GREEN'
          }
          subtitleBadge={
            isKo
              ? `내 손패 · 보유 마나 ${matchState.player.mana}/${matchState.player.maxMana}${cardMult > 1 ? ` · 스토리모드 ×${cardMult}배` : ''}`
              : `Your Hand · Mana ${matchState.player.mana}/${matchState.player.maxMana}${cardMult > 1 ? ` · Story ×${cardMult}` : ''}`
          }
          primaryAction={primaryAction}
          secondaryActions={secondaryActions}
          onCancel={() => setZoomState(null)}
        />
      );
    }

    if (zoomState.kind === 'MULLIGAN_CARD') {
      const hc = matchState.player.hand.find((h) => h.uid === zoomState.handUid);
      if (!hc) return null;
      const def = cardDb.mustGetCard(hc.cardId);
      const marked = matchState.mulliganSelectedUids.includes(hc.uid);
      const cardMult = getPlayerCardMult(def.id);
      return (
        <CardZoomModal
          card={def}
          journeyMultiplier={cardMult}
          subtitleBadge={
            marked
              ? isKo
                ? '시작 손패 교체 · 현재 [교체 예정 ✕]'
                : 'Starting Hand · Marked [Replace ✕]'
              : isKo
                ? '시작 손패 교체 · 현재 [손패 유지]'
                : 'Starting Hand · Marked [Keep]'
          }
          primaryAction={{
            label: marked
              ? isKo
                ? '교체 취소 (시작 손패에 유지)'
                : 'Cancel Replace (Keep Card)'
              : isKo
                ? '교체 표시하기 (덱으로 교체)'
                : 'Mark for Replace (Redraw)',
            variant: marked ? 'arcane' : 'crimson',
            onClick: () => {
              toggleMulliganCard(hc.uid);
              setZoomState(null);
            },
          }}
          onCancel={() => setZoomState(null)}
        />
      );
    }

    if (zoomState.kind === 'CHOOSE_ONE_CARD') {
      const prompt = matchState.chooseOnePrompt;
      if (!prompt) return null;
      const opt = prompt.options.find((o) => o.index === zoomState.optionIndex);
      if (!opt) return null;
      const optCard = cardDb.mustGetCard(opt.optionCardId);
      return (
        <CardZoomModal
          card={optCard}
          subtitleBadge={isKo ? `운명의 선택 · ${opt.title}` : `Choose One · ${opt.title}`}
          primaryAction={{
            label: opt.needsTarget
              ? isKo
                ? '이 효과 선택 · 대상 지정'
                : 'Choose Effect · Select Target'
              : isKo
                ? '이 효과 사용'
                : 'Use This Effect',
            variant: 'emerald',
            onClick: () => {
              setZoomState(null);
              if (opt.needsTarget && opt.validTargets.length > 0) {
                setMatchState((s) => ({ ...s, chooseOnePrompt: null }));
                setSelection({
                  kind: 'CHOOSE_OPTION_TARGET',
                  handUid: prompt.sourceHandUid,
                  cardId: prompt.cardId,
                  optionIndex: opt.index,
                  insertIndex: prompt.insertIndex,
                  validTargets: opt.validTargets,
                });
              } else {
                executePlayPlayerCard(prompt.sourceHandUid, {
                  chooseOptionIndex: opt.index,
                  insertIndex: prompt.insertIndex,
                });
              }
            },
          }}
          onCancel={() => setZoomState(null)}
        />
      );
    }

    if (zoomState.kind === 'TRACKING_CARD') {
      const prompt = matchState.trackingPrompt;
      if (!prompt) return null;
      const def = cardDb.mustGetCard(zoomState.cardId);
      return (
        <CardZoomModal
          card={def}
          subtitleBadge={
            isKo
              ? '정찰 추적 — 가져올 카드 1장 선택 (나머지 2장 버림)'
              : 'Tracking — Draw 1 Card (Discard the other 2)'
          }
          primaryAction={{
            label: isKo ? '이 카드 손으로 가져오기' : 'Draw This Card',
            variant: 'emerald',
            onClick: () => {
              setZoomState(null);
              hsAudio.playSfx('card_place');
              const eng = createEngine(matchState);
              setMatchState(eng.resolveTrackingChoice(zoomState.cardId));
            },
          }}
          onCancel={() => setZoomState(null)}
        />
      );
    }

    if (zoomState.kind === 'BOARD_MINION') {
      const liveMinion =
        (zoomState.isFriendly
          ? matchState.player.board.find((m) => m.uid === zoomState.minion.uid)
          : matchState.opponent.board.find((m) => m.uid === zoomState.minion.uid)) ||
        zoomState.minion;
      const def = cardDb.mustGetCard(liveMinion.cardId);
      const canSwing =
        zoomState.isFriendly &&
        isPlayerTurn &&
        engine.canAttackerSwing('PLAYER', liveMinion.uid).ok;
      const validTargets = canSwing
        ? engine.getValidAttackTargets('PLAYER', liveMinion.uid)
        : [];

      return (
        <CardZoomModal
          card={def}
          subtitleBadge={
            zoomState.isFriendly
              ? isKo
                ? '아군 전장 영웅·동료 정보'
                : 'Friendly Board Minion'
              : isKo
                ? '적 전장 영웅·동료 정보'
                : 'Enemy Board Minion'
          }
          liveStats={{
            attack: getMinionAttack(liveMinion),
            health: getMinionHealth(liveMinion),
            maxHealth: getMinionMaxHealth(liveMinion),
            statuses: buildMinionStatusPills(liveMinion),
          }}
          primaryAction={
            canSwing && validTargets.length > 0
              ? {
                  label: isKo ? '이 동료로 공격 대상 선택' : 'Select Target to Attack',
                  variant: 'emerald',
                  onClick: () => {
                    setZoomState(null);
                    setSelection({
                      kind: 'ATTACKER',
                      attackerId: liveMinion.uid,
                      validTargets,
                    });
                  },
                }
              : {
                  label: isKo ? '확인 (닫기)' : 'OK (Close)',
                  variant: 'brass',
                  onClick: () => setZoomState(null),
                }
          }
          onCancel={() => setZoomState(null)}
        />
      );
    }

    if (zoomState.kind === 'HISTORY_ITEM') {
      const item = zoomState.item;
      const def = cardDb.mustGetCard(item.cardId);
      return (
        <CardZoomModal
          card={def}
          subtitleBadge={
            isKo
              ? `${item.turn}턴 기록 · ${item.actorSide === 'PLAYER' ? '아군 행동' : '상대 행동'} — ${item.detail}`
              : `Turn ${item.turn} · ${item.actorSide === 'PLAYER' ? 'Ally Action' : 'Enemy Action'} — ${item.detail}`
          }
          primaryAction={{
            label: isKo ? '확인 (닫기)' : 'OK (Close)',
            variant: 'brass',
            onClick: () => setZoomState(null),
          }}
          onCancel={() => setZoomState(null)}
        />
      );
    }

    return null;
  };

  return (
    <div
      data-testid="battle-stage-root"
      data-shake-damage={shakeState.active ? shakeState.damage : 0}
      onContextMenu={(e) => {
        e.preventDefault();
        if (selection) setSelection(null);
      }}
      onClick={() => {
        if (emoteMenuOpen) setEmoteMenuOpen(false);
        if (selection) setSelection(null);
      }}
      style={
        {
          backgroundImage: `url(${BOARD_BG_URL[matchState.boardTheme]})`,
          '--hs-shake-x': `${shakeState.ampX}px`,
          '--hs-shake-y': `${shakeState.ampY}px`,
          '--hs-shake-dur': `${shakeState.durationMs}ms`,
          willChange: shakeState.active ? 'transform' : 'auto',
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        } as React.CSSProperties
      }
      className={`relative flex h-full w-full select-none flex-col justify-between overflow-hidden bg-cover bg-center ${
        shakeState.active
          ? shakeState.seq % 2 === 0
            ? 'hs-damage-shake-a'
            : 'hs-damage-shake-b'
          : ''
      }`}
    >
      {/* Subtle Board Vignette (Light Center so Original Arena Art Shines Clearly!) */}
      <div className="pointer-events-none absolute inset-0 bg-radial from-transparent via-black/18 to-black/68" />

      {/* 60fps Particle & Spell Projectile Canvas */}
      <BoardVfxCanvas events={matchState.vfxQueue} onDamageImpact={triggerDamageImpact} />

      {/* Active Targeting / Placement Helper Bar (Cancelable & Inspectable on Mobile!) */}
      {selection && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-11 z-[76] flex w-[94%] max-w-md -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border-2 border-amber-300 bg-stone-950/95 px-3 py-1.5 text-xs font-extrabold text-amber-100 shadow-2xl sm:top-14"
        >
          <span className="truncate">
            {selection.kind === 'ATTACKER'
              ? tr('⚔ 공격할 적 영웅 또는 하수인을 터치하세요', '⚔ Tap an enemy hero or minion to attack')
              : selection.kind === 'HERO_POWER'
                ? tr('✦ 영웅 능력 대상을 터치하세요', '✦ Tap a Hero Power target')
                : selection.kind === 'CHOOSE_OPTION_TARGET'
                  ? tr('✦ 선택한 효과의 대상을 터치하세요', '✦ Tap a target for the chosen effect')
                  : selection.needsTarget
                    ? isKo
                      ? `✦ [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}] 대상을 터치하세요`
                      : `✦ Tap target for [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}]`
                    : isKo
                      ? `✦ [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}] 놓을 전장 위치를 터치하세요`
                      : `✦ Tap board slot for [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}]`}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {selection.kind === 'ATTACKER' && selection.attackerId !== 'PLAYER_HERO' && (
              <button
                type="button"
                onClick={() => {
                  const m = matchState.player.board.find((x) => x.uid === selection.attackerId);
                  if (m) {
                    setSelection(null);
                    setZoomState({ kind: 'BOARD_MINION', minion: m, isFriendly: true });
                  }
                }}
                className="hs-brass-btn rounded-lg px-2 py-1 text-[10.5px] font-extrabold text-amber-100"
              >
                {tr('카드 확대', 'Zoom')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelection(null)}
              className="rounded-lg border border-red-300/75 bg-red-900 px-2 py-1 text-[10.5px] font-extrabold text-white"
            >
              {tr('취소 ✕', 'Cancel ✕')}
            </button>
          </div>
        </div>
      )}

      {/* Curved Red Targeting Bezier Arrow + Crosshair Reticle */}
      {targetingArrow && (
        <svg className="pointer-events-none absolute inset-0 z-[75] h-full w-full">
          <defs>
            <filter id="hsArrowGlow">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d={`M ${targetingArrow.sx} ${targetingArrow.sy} Q ${(targetingArrow.sx + targetingArrow.ex) / 2} ${Math.min(targetingArrow.sy, targetingArrow.ey) - 85} ${targetingArrow.ex} ${targetingArrow.ey}`}
            fill="none"
            stroke="#ef4444"
            strokeWidth={9}
            strokeDasharray="18 10"
            strokeLinecap="round"
            filter="url(#hsArrowGlow)"
          />
          <circle
            cx={targetingArrow.ex}
            cy={targetingArrow.ey}
            r={22}
            fill="rgba(239,68,68,0.22)"
            stroke="#fecaca"
            strokeWidth={3.5}
          />
          <line
            x1={targetingArrow.ex - 28}
            y1={targetingArrow.ey}
            x2={targetingArrow.ex + 28}
            y2={targetingArrow.ey}
            stroke="#ef4444"
            strokeWidth={3}
          />
          <line
            x1={targetingArrow.ex}
            y1={targetingArrow.ey - 28}
            x2={targetingArrow.ex}
            y2={targetingArrow.ey + 28}
            stroke="#ef4444"
            strokeWidth={3}
          />
        </svg>
      )}

      {/* ==================== ORIGINAL HEARTHSTONE PHYSICAL CARD LUNGE / SLAM COMBAT LAYER ==================== */}
      {attackAnim &&
        (() => {
          const dx = attackAnim.targetX - attackAnim.startX;
          const dy = attackAnim.targetY - attackAnim.startY;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const ux = dx / dist;
          const uy = dy / dist;
          const tiltDeg = Math.max(-18, Math.min(18, (dx / 300) * 15));
          const isCutout = attackAnim.artUrl.includes('/cutouts/');
          const isPlayerSide = attackAnim.side === 'PLAYER';

          let cx = attackAnim.startX;
          let cy = attackAnim.startY;
          let scale = 1;
          let rot = 0;
          let opacity = 1;
          let transitionCss = 'transform 110ms cubic-bezier(0.2, 0.9, 0.3, 1)';

          if (attackAnim.phase === 'WINDUP') {
            cx = attackAnim.startX - ux * 16;
            cy = attackAnim.startY - uy * 16;
            scale = 1.22;
            rot = -tiltDeg * 0.35;
            transitionCss = 'transform 110ms cubic-bezier(0.2, 0.9, 0.3, 1)';
          } else if (attackAnim.phase === 'LUNGE') {
            cx = attackAnim.targetX - ux * 14;
            cy = attackAnim.targetY - uy * 14;
            scale = 1.28;
            rot = tiltDeg;
            transitionCss = 'transform 155ms cubic-bezier(0.62, 0.04, 0.96, 0.36)';
          } else {
            // IMPACT_RETURN
            if (attackAnim.attackerWillDie) {
              cx = attackAnim.startX + dx * 0.48;
              cy = attackAnim.startY + dy * 0.48;
              scale = 0.78;
              rot = tiltDeg * 0.5;
              opacity = 0;
            } else {
              cx = attackAnim.startX;
              cy = attackAnim.startY;
              scale = 1.0;
              rot = 0;
              opacity = 1;
            }
            transitionCss =
              'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 215ms ease-out';
          }

          return (
            <div className="pointer-events-none absolute inset-0 z-[84] overflow-hidden">
              {/* Directional Attack Wake Line + Target Lock Ring */}
              <svg className="absolute inset-0 h-full w-full">
                {(attackAnim.phase === 'WINDUP' || attackAnim.phase === 'LUNGE') && (
                  <>
                    <line
                      x1={attackAnim.startX}
                      y1={attackAnim.startY}
                      x2={attackAnim.targetX}
                      y2={attackAnim.targetY}
                      stroke={isPlayerSide ? 'rgba(56,189,248,0.72)' : 'rgba(248,113,113,0.78)'}
                      strokeWidth={6}
                      strokeDasharray="14 10"
                      strokeLinecap="round"
                    />
                    <circle
                      cx={attackAnim.targetX}
                      cy={attackAnim.targetY}
                      r={38}
                      fill="rgba(239,68,68,0.16)"
                      stroke="#fca5a5"
                      strokeWidth={3.5}
                      strokeDasharray="10 6"
                    />
                  </>
                )}

                {attackAnim.phase === 'IMPACT_RETURN' && (
                  <g transform={`translate(${attackAnim.targetX}, ${attackAnim.targetY})`}>
                    <circle
                      r={58}
                      fill="rgba(251,191,36,0.22)"
                      stroke="#fde047"
                      strokeWidth={4}
                    />
                    <line
                      x1={-46}
                      y1={-36}
                      x2={46}
                      y2={36}
                      stroke="#fef08a"
                      strokeWidth={6}
                      strokeLinecap="round"
                    />
                    <line
                      x1={46}
                      y1={-36}
                      x2={-46}
                      y2={36}
                      stroke="#f87171"
                      strokeWidth={5}
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </svg>

              {/* Physical Flying Attacker Token (Minion Oval or Hero Arch Portrait) */}
              <div
                style={{
                  left: 0,
                  top: 0,
                  transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%) scale(${scale}) rotate(${rot}deg)`,
                  opacity,
                  transition: transitionCss,
                  willChange: 'transform, opacity',
                }}
                className="absolute"
              >
                <div
                  style={{
                    background: attackAnim.isHeroAttacker
                      ? attackAnim.frameGradient
                      : 'radial-gradient(circle at 50% 35%, #475569 0%, #0f172a 100%)',
                    boxShadow: isPlayerSide
                      ? '0 24px 36px rgba(0,0,0,0.92), 0 0 24px rgba(56,189,248,0.95)'
                      : '0 24px 36px rgba(0,0,0,0.92), 0 0 24px rgba(248,113,113,0.95)',
                  }}
                  className={`relative overflow-hidden border-[3.5px] ${
                    attackAnim.isHeroAttacker
                      ? 'h-[82px] w-[72px] rounded-t-[40px] rounded-b-xl border-[#f5d98e] sm:h-[116px] sm:w-[100px] sm:rounded-t-[52px]'
                      : `h-[74px] w-[58px] rounded-[50%] sm:h-[112px] sm:w-[88px] ${
                          isPlayerSide ? 'border-sky-300' : 'border-red-400'
                        }`
                  }`}
                >
                  <img
                    src={attackAnim.artUrl}
                    alt={attackAnim.nameKo}
                    draggable={false}
                    className={
                      isCutout
                        ? 'pointer-events-none absolute left-1/2 top-[3%] h-[156%] w-[124%] max-w-none -translate-x-1/2 object-cover object-top'
                        : 'pointer-events-none absolute inset-0 h-full w-full scale-[1.06] object-cover object-center'
                    }
                  />
                  {attackAnim.divineShield && (
                    <div className="pointer-events-none absolute inset-0 rounded-[50%] border-2 border-yellow-200 bg-yellow-300/25" />
                  )}
                </div>

                {/* Attacker Nameplate + Live Attack / Health Badges */}
                <div className="hs-outline-sm absolute left-1/2 top-[60%] z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-amber-300/70 bg-stone-950/90 px-1.5 py-0.2 text-[9.5px] font-extrabold text-amber-100 shadow sm:text-[10.5px]">
                  {attackAnim.nameKo}
                </div>
                <div className="hs-num absolute -bottom-1.5 -left-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border-2 border-amber-100 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-800 text-xs font-black text-white shadow-lg sm:h-8 sm:w-8 sm:text-sm">
                  ⚔{attackAnim.attackVal}
                </div>
                <div className="hs-num absolute -bottom-1.5 -right-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border-2 border-rose-100 bg-gradient-to-b from-red-400 via-red-600 to-red-950 text-xs font-black text-white shadow-lg sm:h-8 sm:w-8 sm:text-sm">
                  {attackAnim.healthVal}
                </div>
              </div>

              {/* Crisp Hearthstone Red Starburst Impact Damage Splats right at Collision Point! */}
              {attackAnim.phase === 'IMPACT_RETURN' && attackAnim.defenderDamage > 0 && (
                <div
                  style={{
                    left: attackAnim.targetX,
                    top: attackAnim.targetY,
                    transform: 'translate3d(-50%, -50%, 0)',
                    willChange: 'transform, opacity',
                  }}
                  className="absolute z-40 flex h-16 w-16 animate-[hsCardPop_0.22s_ease-out] items-center justify-center rounded-full border-[2.5px] border-yellow-200 bg-gradient-to-b from-red-500 via-red-700 to-rose-950 shadow-xl sm:h-20 sm:w-20"
                >
                  <span className="hs-num hs-outline text-2xl font-black text-white sm:text-3xl">
                    -{attackAnim.defenderDamage}
                  </span>
                </div>
              )}

              {attackAnim.phase === 'IMPACT_RETURN' && attackAnim.attackerCounterDamage > 0 && (
                <div
                  style={{
                    left: attackAnim.targetX - ux * 58,
                    top: attackAnim.targetY - uy * 58,
                    transform: 'translate3d(-50%, -50%, 0)',
                    willChange: 'transform, opacity',
                  }}
                  className="absolute z-40 flex h-13 w-13 animate-[hsCardPop_0.22s_ease-out] items-center justify-center rounded-full border-2 border-amber-200 bg-gradient-to-b from-orange-500 via-red-700 to-stone-950 shadow-lg sm:h-15 sm:w-15"
                >
                  <span className="hs-num hs-outline text-lg font-black text-white sm:text-2xl">
                    -{attackAnim.attackerCounterDamage}
                  </span>
                </div>
              )}
            </div>
          );
        })()}

      {/* 4 Interactive Battlefield Corner Toys! */}
      {cornerToys.map((toy) => {
        const posCls =
          toy.pos === 'TL'
            ? 'left-3 top-14'
            : toy.pos === 'TR'
              ? 'right-3 top-14'
              : toy.pos === 'BL'
                ? 'left-3 bottom-24'
                : 'right-3 bottom-24';
        return (
          <button
            key={toy.pos}
            type="button"
            title={
              isKo
                ? `전장 기물: ${toy.name} (클릭해 상호작용!)`
                : `Board Toy: ${toy.nameEn} (Click to interact!)`
            }
            onClick={(e) => {
              e.stopPropagation();
              hsAudio.playSfx('ui_click', 0.85);
              const reactionText = isKo ? toy.reaction : toy.reactionEn;
              setToyToast(reactionText);
              window.setTimeout(
                () => setToyToast((prev) => (prev === reactionText ? null : prev)),
                2200,
              );
            }}
            className={`absolute ${posCls} z-30 hidden h-12 w-12 items-center justify-center rounded-2xl border-2 border-amber-400/50 bg-stone-950/65 text-2xl shadow-xl transition hover:scale-115 hover:border-amber-200 active:scale-90 md:flex`}
          >
            {toy.icon}
          </button>
        );
      })}

      {/* Left Action History Bar (Desktop / Tablet >= sm) */}
      <aside className="absolute left-2.5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-1.5 rounded-2xl border-2 border-[#a88344] bg-stone-950/80 p-1.5 shadow-2xl sm:flex">
        <div className="text-center text-[9px] font-extrabold text-amber-300">
          {tr('기록', 'Log')}
        </div>
        {matchState.history.slice(0, 7).map((item) => (
          <div
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              hsAudio.playSfx('card_hover', 0.65);
              setZoomState({ kind: 'HISTORY_ITEM', item });
            }}
            onPointerEnter={(e) => {
              if (e.pointerType !== 'mouse') return;
              setHoveredHistoryItem(item);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'mouse') return;
              setHoveredHistoryItem((prev) => (prev?.id === item.id ? null : prev));
            }}
            className={`relative h-9 w-9 cursor-pointer overflow-hidden rounded-lg border-2 shadow transition hover:scale-110 ${
              item.actorSide === 'PLAYER' ? 'border-sky-400' : 'border-red-500'
            }`}
          >
            <img
              src={resolveHistoryIconUrl(item)}
              alt={item.title}
              className="h-full w-full object-cover object-top"
            />
          </div>
        ))}
        {matchState.history.length === 0 && (
          <div className="px-1 py-3 text-[9px] text-stone-500">{tr('대기', 'Idle')}</div>
        )}
      </aside>

      {/* History Hover Card Tooltip */}
      {liveHoveredHistoryItem && !zoomState && (
        <div className="pointer-events-none absolute left-16 top-1/2 z-[80] hidden -translate-y-1/2 items-center gap-3 rounded-2xl border-2 border-amber-300 bg-stone-950/95 p-3 text-amber-100 shadow-2xl sm:flex">
          <HearthstoneCard card={cardDb.mustGetCard(liveHoveredHistoryItem.cardId)} size="SM" />
          <div className="max-w-[200px]">
            <div className="text-xs font-extrabold text-yellow-300">
              {isKo
                ? `${liveHoveredHistoryItem.turn}턴 · ${liveHoveredHistoryItem.actorSide === 'PLAYER' ? '아군 행동' : '상대 행동'}`
                : `Turn ${liveHoveredHistoryItem.turn} · ${liveHoveredHistoryItem.actorSide === 'PLAYER' ? 'Ally Action' : 'Enemy Action'}`}
            </div>
            <div className="mt-1 text-sm font-extrabold text-white">
              {liveHoveredHistoryItem.title}
            </div>
            <p className="mt-1 text-xs text-amber-200/85">{liveHoveredHistoryItem.detail}</p>
          </div>
        </div>
      )}

      {/* Board Minion Hover Full-Card Inspector (Desktop XL) */}
      {liveHoveredBoardMinion &&
        !selection &&
        !attackAnim &&
        !zoomState &&
        matchState.phase === 'PLAYING' && (
          <div className="pointer-events-none absolute right-24 top-1/2 z-[80] hidden -translate-y-1/2 xl:block">
            <HearthstoneCard
              card={cardDb.mustGetCard(liveHoveredBoardMinion.cardId)}
              journeyMultiplier={
                matchState.player.board.some((m) => m.uid === liveHoveredBoardMinion.uid)
                  ? getPlayerCardMult(liveHoveredBoardMinion.cardId)
                  : 1
              }
              size="MD"
            />
          </div>
        )}

      {/* Right-Middle Controls: Deck Stacks, Spinning Auto-Play Button & 3-State End Turn Button (Desktop / Tablet >= sm) */}
      <aside className="absolute right-2.5 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-3 sm:flex">
        {/* Opponent Remaining Deck Stack */}
        <div
          title={
            matchState.opponent.deck.length > 0
              ? isKo
                ? `상대 남은 덱: ${matchState.opponent.deck.length}장`
                : `Enemy Deck: ${matchState.opponent.deck.length} cards`
              : isKo
                ? `상대 덱 소진! (다음 탈진 피해: ${matchState.opponent.fatigueCounter + 1})`
                : `Enemy Out of Cards! (Next Fatigue: ${matchState.opponent.fatigueCounter + 1})`
          }
          className="relative flex h-14 w-11 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-[#c8a158]/80 bg-stone-950/90 shadow-xl"
        >
          <div className="pointer-events-none absolute inset-0 opacity-45">
            <SnsCardBackArt variant={profile.selectedCardBack} />
          </div>
          <span className="hs-outline-sm relative z-10 text-[9px] font-extrabold text-red-200">
            {tr('상대 덱', 'Enemy')}
          </span>
          <span className="hs-num relative z-10 text-sm text-white">
            {matchState.opponent.deck.length}
          </span>
        </div>

        {/* Right-Middle Spinning Auto-Play Toggle Button */}
        <button
          type="button"
          data-testid="autoplay-toggle-desktop"
          data-autoplay-active={autoPlay ? 'true' : 'false'}
          onClick={(e) => {
            e.stopPropagation();
            hsAudio.playSfx('ui_click', 0.85);
            setAutoPlay((prev) => !prev);
          }}
          className={`group relative flex w-[118px] flex-col items-center justify-center gap-0.5 rounded-2xl border-[2.5px] px-2 py-2 shadow-xl transition hover:scale-105 ${
            autoPlay
              ? 'border-emerald-300 bg-gradient-to-b from-emerald-600 via-teal-800 to-emerald-950 text-white shadow-[0_0_22px_rgba(52,211,153,0.85)]'
              : 'border-[#c8a158]/80 bg-gradient-to-b from-stone-800 to-stone-950 text-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center gap-1">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className={`h-4 w-4 shrink-0 ${
                autoPlay ? 'animate-spin text-yellow-200' : 'text-amber-300/75'
              }`}
            >
              <path
                d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2.2" />
            </svg>
            <span className="hs-title hs-outline-sm text-[11px] font-extrabold">
              {autoPlay ? tr('자동플레이 ON', 'Auto-Play ON') : tr('자동플레이 OFF', 'Auto-Play OFF')}
            </span>
          </div>
          <span
            className={`text-[9.5px] font-extrabold ${
              autoPlay ? 'text-emerald-100' : 'text-amber-300/75'
            }`}
          >
            {autoPlay ? tr('작동 중 · 클릭 시 OFF', 'Active · Click OFF') : tr('비활성 · 클릭 시 작동', 'Off · Click ON')}
          </span>
        </button>

        {/* 3-State Stone & Brass End Turn Lever */}
        <button
          type="button"
          disabled={!isPlayerTurn || Boolean(attackAnim)}
          onClick={(e) => {
            e.stopPropagation();
            if (!isPlayerTurn || attackAnim) return;
            setSelection(null);
            setHoveredBoardMinion(null);
            setHoveredHistoryItem(null);
            hsAudio.playSfx('end_turn');
            const eng = createEngine(matchState);
            setMatchState(eng.endTurn());
          }}
          className={`group relative flex h-[54px] w-[114px] items-center justify-center transition ${
            !isPlayerTurn
              ? 'cursor-not-allowed opacity-90'
              : 'cursor-pointer hover:scale-105'
          }`}
        >
          <EndTurnLeverPlate isPlayerTurn={isPlayerTurn} noMovesLeft={noMovesLeft} isKo={isKo} />
        </button>

        {/* Player Remaining Deck Stack */}
        <div
          title={
            matchState.player.deck.length > 0
              ? isKo
                ? `내 남은 덱: ${matchState.player.deck.length}장`
                : `Your Deck: ${matchState.player.deck.length} cards`
              : isKo
                ? `내 덱 소진! (다음 탈진 피해: ${matchState.player.fatigueCounter + 1})`
                : `Out of Cards! (Next Fatigue: ${matchState.player.fatigueCounter + 1})`
          }
          className="relative flex h-14 w-11 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-[#c8a158]/80 bg-stone-950/90 shadow-xl"
        >
          <div className="pointer-events-none absolute inset-0 opacity-45">
            <SnsCardBackArt variant={profile.selectedCardBack} />
          </div>
          <span className="hs-outline-sm relative z-10 text-[9px] font-extrabold text-sky-200">
            {tr('내 덱', 'Deck')}
          </span>
          <span className="hs-num relative z-10 text-sm text-white">
            {matchState.player.deck.length}
          </span>
        </div>
      </aside>

      {/* ==================== TOP ZONE: OPPONENT HAND + CENTERED OPPONENT HERO ==================== */}
      <header className="relative z-20 flex w-full flex-col items-center pt-1">
        {/* Top Utility Strip: Opponent Mana (Left) + Opponent Hand (Dead-Center on sm+) + Options (Right) */}
        <div className="flex w-full items-center justify-between gap-1.5 px-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:px-3">
          <div className="flex min-w-0 items-center gap-1.5 rounded-xl border-2 border-[#b8924d]/75 bg-stone-950/90 px-2 py-1 text-[10.5px] text-amber-100 shadow-lg sm:justify-self-start sm:gap-2 sm:px-3 sm:text-xs">
            <img
              src={CLASS_CREST_URL[matchState.opponent.heroClass]}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover"
            />
            <span className="max-w-[82px] truncate font-extrabold text-red-200 sm:max-w-none">
              {matchState.opponent.name}
            </span>
            <span className="text-stone-500">·</span>
            <span className="shrink-0 font-extrabold text-sky-300">
              {tr('마나', 'Mana')} {matchState.opponent.mana}/{matchState.opponent.maxMana}
            </span>
            <span className="hidden text-stone-500 sm:inline">·</span>
            <span className="hidden font-bold text-amber-200/85 sm:inline">
              {isKo ? `손패 ${matchState.opponent.hand.length}장` : `Hand ${matchState.opponent.hand.length}`}
            </span>
          </div>

          {/* Opponent Face-Down Curved Hand (Visible on BOTH Mobile Portrait & Desktop!) */}
          <div
            title={isKo ? `상대 손패: ${matchState.opponent.hand.length}장` : `Enemy Hand: ${matchState.opponent.hand.length}`}
            className="flex shrink-0 items-center justify-center -space-x-3 sm:justify-self-center sm:-space-x-3"
          >
            {matchState.opponent.hand.map((hc, idx) => {
              const rot = (idx - (matchState.opponent.hand.length - 1) / 2) * 3;
              return (
                <div
                  key={hc.uid}
                  style={{ transform: `rotate(${rot}deg)` }}
                  className="h-7 w-5 overflow-hidden rounded-[4px] shadow sm:h-14 sm:w-10 sm:rounded-md"
                >
                  <SnsCardBackArt variant={profile.selectedCardBack} />
                </div>
              );
            })}
            {matchState.opponent.hand.length === 0 && (
              <span className="rounded border border-stone-700 bg-stone-950/80 px-1.5 py-0.5 text-[9.5px] font-bold text-stone-400">
                {tr('손패 0장', '0 Cards')}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:justify-self-end">
            <button
              type="button"
              data-testid="battle-rules-btn"
              onClick={(e) => {
                e.stopPropagation();
                hsAudio.playSfx('ui_click', 0.75);
                setQuickRulesOpen(true);
              }}
              className="rounded-xl border border-amber-300/65 bg-stone-950/90 px-2 py-1 text-[10px] font-extrabold text-amber-200 shadow hover:bg-stone-900 sm:px-2.5 sm:text-xs"
            >
              {tr('? 규칙', '? Rules')}
            </button>
            {mode === 'TUTORIAL' && matchState.journeyMeta && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hsAudio.playSfx('open_menu', 0.75);
                  setStoryPhase('REVIEW');
                }}
                className="rounded-xl border border-emerald-300/70 bg-emerald-950/90 px-2 py-1 text-[10px] font-extrabold text-emerald-200 shadow sm:px-2.5 sm:text-xs"
              >
                {isKo
                  ? `📖 제${matchState.journeyMeta.episode}화 줄거리`
                  : `📖 EP ${matchState.journeyMeta.episode} Story`}
              </button>
            )}

            {/* Mobile Corner Toy Interaction Button (< md) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const toy = cornerToys[Math.floor(Math.random() * cornerToys.length)];
                hsAudio.playSfx('ui_click', 0.85);
                setToyToast(`${toy.icon} ${isKo ? toy.reaction : toy.reactionEn}`);
                window.setTimeout(() => setToyToast(null), 2200);
              }}
              className="hs-brass-btn rounded-xl px-2 py-1 text-[10.5px] font-extrabold text-amber-100 md:hidden"
            >
              {tr('기물', 'Toys')}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hsAudio.playSfx('open_menu');
                onOpenOptions(handleConcede);
              }}
              className="hs-brass-btn rounded-xl px-2.5 py-1 text-[10.5px] font-extrabold text-amber-100 sm:px-3 sm:text-xs"
            >
              {tr('메뉴 · 항복', 'Menu · Concede')}
            </button>
          </div>
        </div>

        {/* Opponent Hero Arch (100% Horizontally Centered on Stage Axis) */}
        <div className="mt-0.5 flex w-full items-center justify-center sm:mt-1">
          <HeroPortraitZone
            player={matchState.opponent}
            isFriendly={false}
            isActiveTurn={matchState.activeSide === 'OPPONENT'}
            canHeroAttack={false}
            isHeroSelectedAttacker={false}
            isHeroValidTarget={activeValidTargetSet.has('OPPONENT_HERO')}
            isAttackingHidden={attackAnim?.attackerId === 'OPPONENT_HERO'}
            isIncomingAttackTarget={attackAnim?.defenderId === 'OPPONENT_HERO'}
            canUseHeroPower={false}
            isHeroPowerSelected={false}
            emoteBubbleText={opponentEmoteText}
            onClickHero={() => handleEntityClick('OPPONENT_HERO', false)}
            onClickHeroPower={() => {}}
          />
        </div>
      </header>

      {/* ==================== CENTER ZONE: 7v7 BATTLEFIELD ARENA ==================== */}
      <main className="relative z-20 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-1 px-1.5 sm:gap-2 sm:px-12">
        {/* Kadan's Journey Stage Status Strip */}
        {mode === 'TUTORIAL' && matchState.journeyMeta && (
          <div className="mx-auto flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-emerald-400/55 bg-stone-950/88 px-3 py-1 text-[10.5px] font-extrabold text-emerald-100 shadow-lg sm:px-4 sm:text-xs">
            <span className="text-yellow-300">
              {matchState.journeyMeta.reincarnation > 0
                ? tr(`환생 ${matchState.journeyMeta.reincarnation}회차 · `,
                    `Reincarnation ${matchState.journeyMeta.reincarnation} · `,
                  )
                : ''}
              {isKo
                ? `제${matchState.journeyMeta.episode}화 「${matchState.journeyMeta.episodeTitle}」`
                : `EP ${matchState.journeyMeta.episode}: ${matchState.journeyMeta.episodeTitle}`}
            </span>
            <span className="text-stone-500">|</span>
            <span>
              {tr(`적 스탯 ×${matchState.journeyMeta.enemyStatScale}배`,
                `Enemy Stats ×${matchState.journeyMeta.enemyStatScale}`,
              )}
            </span>
            {journeyDeckStats.boostedCount > 0 && (
              <>
                <span className="text-stone-500">|</span>
                <span className="text-emerald-300">
                  {isKo
                    ? `내 3장+ 배수 강화 ${journeyDeckStats.boostedCount}종 (최대 ×${journeyDeckStats.maxMultiplier}배)`
                    : `${journeyDeckStats.boostedCount} 3+ Card Boosts (Max ×${journeyDeckStats.maxMultiplier})`}
                </span>
              </>
            )}
          </div>
        )}

        {/* Live Beginner Coach Banner (Collapsible) */}
        {coachTip && !isEp0Tutorial && storyPhase === 'CLOSED' && !vsIntroActive && (
          <div
            data-testid="battle-coach-banner"
            className="mx-auto flex max-w-2xl items-center justify-between gap-2 rounded-xl border border-amber-400/45 bg-stone-950/90 px-2.5 py-1 text-[11px] text-amber-50 shadow-md sm:px-3.5 sm:text-xs"
          >
            {coachCollapsed ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCoachCollapsed(false);
                }}
                className="flex items-center gap-1.5 font-extrabold text-amber-200 hover:text-amber-100"
              >
                <span>💡</span>
                <span>{tr('코치 힌트 펼치기', 'Show Coach Tip')}</span>
              </button>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${
                      coachTip.tone === 'emerald'
                        ? 'bg-emerald-600 text-white'
                        : coachTip.tone === 'sky'
                          ? 'bg-sky-600 text-white'
                          : coachTip.tone === 'amber'
                            ? 'bg-amber-600 text-stone-950'
                            : 'bg-stone-700 text-stone-200'
                    }`}
                  >
                    {coachTip.badge}
                  </span>
                  <span className="truncate font-bold sm:whitespace-normal">{coachTip.text}</span>
                </div>
                <button
                  type="button"
                  title={tr('코치 배너 접기', 'Hide Coach Tip')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoachCollapsed(true);
                  }}
                  className="shrink-0 rounded border border-amber-400/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-stone-800"
                >
                  —
                </button>
              </>
            )}
          </div>
        )}

        {/* Episode 0 Mobile Full-Width Tutorial Speech Bubble (Never Squished) */}
        {isEp0Tutorial &&
          ep0Dialogue &&
          storyPhase === 'CLOSED' &&
          !vsIntroActive &&
          matchState.phase !== 'GAME_OVER' && (
            <div
              data-testid="ep0-mobile-bubble"
              className={`mx-auto w-full max-w-md rounded-2xl border-2 bg-stone-950/96 px-3.5 py-2 text-left shadow-2xl sm:hidden ${
                ep0Dialogue.speaker === 'KADAN'
                  ? 'border-sky-300/90'
                  : 'border-amber-300/90'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-black ${
                    ep0Dialogue.speaker === 'KADAN'
                      ? 'bg-sky-600 text-white'
                      : 'bg-amber-500 text-stone-950'
                  }`}
                >
                  {ep0Dialogue.speaker === 'KADAN'
                    ? tr('🛡 카단', '🛡 Kadan')
                    : tr('🤖 로봇', '🤖 Bot')}{' '}
                  · {ep0Dialogue.badge}
                </span>
                <span className="shrink-0 text-[11px] font-extrabold text-emerald-300">
                  {tr('⏱ 3초/카드', '⏱ 3s/card')}
                </span>
              </div>
              <div className="mt-1 text-sm font-black leading-tight text-yellow-200">
                {ep0Dialogue.headline}
              </div>
              <p className="mt-0.5 text-[13.5px] font-extrabold leading-snug text-amber-50">
                {ep0Dialogue.reason}
              </p>
            </div>
          )}

        {/* Opponent Minion Row (Max 7) */}
        <div className="flex min-h-[70px] items-center justify-center gap-1 sm:min-h-[122px] sm:gap-3">
          {matchState.opponent.board.map((m) => (
            <BoardMinionToken
              key={m.uid}
              minion={m}
              canAttack={false}
              isSelectedAttacker={false}
              isValidTarget={activeValidTargetSet.has(m.uid)}
              isAttackingHidden={attackAnim?.attackerId === m.uid}
              isIncomingAttackTarget={attackAnim?.defenderId === m.uid}
              onSelect={() => handleEntityClick(m.uid, false)}
              onHoverChange={(hov) =>
                setHoveredBoardMinion((prev) => (hov ? m : prev?.uid === m.uid ? null : prev))
              }
            />
          ))}
          {matchState.opponent.board.length === 0 && (
            <div className="text-[11px] font-bold text-amber-100/35 sm:text-xs">
              {tr('상대 전장', 'Enemy Board')}
            </div>
          )}
        </div>

        {/* Desktop Center Board Divider + Burning Rope Fuse (>= sm) */}
        <div className="relative mx-auto hidden h-2 w-[86%] rounded-full bg-amber-950/60 sm:block">
          {isPlayerTurn && matchState.turnSecondsLeft <= 15 && (
            <div className="absolute inset-0 flex items-center">
              <div
                style={{ width: `${(matchState.turnSecondsLeft / 15) * 100}%` }}
                className="h-2 rounded-full bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-200 transition-all duration-1000"
              />
              <span className="hs-num ml-2 whitespace-nowrap rounded-full bg-red-900 px-2 py-0.5 text-xs text-yellow-200 shadow">
                🔥 {matchState.turnSecondsLeft}{isKo ? '초!' : 's!'}
              </span>
            </div>
          )}
        </div>

        {/* Mobile Portrait Center Tactical Divider Bar (< sm: History + Decks + Spinning Auto-Play + End Turn!) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto flex w-full items-center justify-between gap-1 rounded-2xl border border-[#b8924d]/70 bg-stone-950/88 px-1.5 py-1 shadow-lg sm:hidden"
        >
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.75);
              setMobileHistoryOpen(true);
            }}
            className="hs-brass-btn rounded-xl px-2 py-1 text-[10px] font-extrabold text-amber-100"
          >
            {tr(`기록 (${matchState.history.length})`, `Log (${matchState.history.length})`)}
          </button>

          <div className="flex items-center gap-1 text-[10px] font-extrabold">
            <span className="rounded-lg border border-red-400/45 bg-stone-900/95 px-1.5 py-0.5 text-red-200">
              {tr(`적${matchState.opponent.deck.length}`, `E:${matchState.opponent.deck.length}`)}
            </span>
            <span className="rounded-lg border border-sky-400/45 bg-stone-900/95 px-1.5 py-0.5 text-sky-200">
              {tr(`덱${matchState.player.deck.length}`, `D:${matchState.player.deck.length}`)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Mobile Right-Middle Spinning Auto-Play Button */}
            <button
              type="button"
              data-testid="autoplay-toggle-mobile"
              data-autoplay-active={autoPlay ? 'true' : 'false'}
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.85);
                setAutoPlay((prev) => !prev);
              }}
              className={`flex h-[34px] items-center gap-1 rounded-xl border px-2 text-[10px] font-extrabold transition ${
                autoPlay
                  ? 'border-emerald-300 bg-gradient-to-b from-emerald-600 to-emerald-900 text-white shadow-[0_0_12px_rgba(52,211,153,0.85)]'
                  : 'border-amber-400/50 bg-stone-900 text-amber-200'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className={`h-3.5 w-3.5 shrink-0 ${
                  autoPlay ? 'animate-spin text-yellow-200' : 'text-amber-300/75'
                }`}
              >
                <path
                  d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2.2" />
              </svg>
              <span>{autoPlay ? tr('자동 ON', 'Auto ON') : tr('자동 OFF', 'Auto OFF')}</span>
            </button>

            <button
              type="button"
              disabled={!isPlayerTurn || Boolean(attackAnim)}
              onClick={() => {
                if (!isPlayerTurn || attackAnim) return;
                setSelection(null);
                hsAudio.playSfx('end_turn');
                const eng = createEngine(matchState);
                setMatchState(eng.endTurn());
              }}
              className={`relative flex h-[34px] w-[76px] shrink-0 items-center justify-center transition ${
                !isPlayerTurn ? 'cursor-not-allowed opacity-90' : 'active:scale-95'
              }`}
            >
              <EndTurnLeverPlate isPlayerTurn={isPlayerTurn} noMovesLeft={noMovesLeft} compact />
            </button>
          </div>
        </div>

        {/* Friendly Minion Row (Max 7 + Positional Drop Slot Preview!) */}
        <div
          ref={friendlyRowRef}
          onClick={(e) => {
            if (selection?.kind === 'HAND_CARD' && !selection.needsTarget) {
              e.stopPropagation();
              executePlayPlayerCard(selection.handUid, { insertIndex: insertPreviewIdx });
            }
          }}
          className={`flex min-h-[70px] items-center justify-center gap-1 rounded-3xl transition sm:min-h-[124px] sm:gap-3 ${
            selection?.kind === 'HAND_CARD' && !selection.needsTarget
              ? 'cursor-pointer bg-emerald-500/15 ring-2 ring-emerald-400/60'
              : ''
          }`}
        >
          {matchState.player.board.map((m, idx) => (
            <React.Fragment key={m.uid}>
              {selection?.kind === 'HAND_CARD' &&
                !selection.needsTarget &&
                selection.isMinion &&
                insertPreviewIdx === idx && (
                  <div className="flex h-[64px] w-11 items-center justify-center rounded-[50%] border-2 border-dashed border-emerald-300 bg-emerald-400/25 text-center text-[9px] font-extrabold text-emerald-100 sm:h-[102px] sm:w-14 sm:text-[10px]">
                    {tr('여기 배치', 'Place Here')}
                  </div>
                )}
              <BoardMinionToken
                minion={m}
                canAttack={isPlayerTurn && !attackAnim && engine.canAttackerSwing('PLAYER', m.uid).ok}
                isSelectedAttacker={
                  selection?.kind === 'ATTACKER' && selection.attackerId === m.uid
                }
                isValidTarget={activeValidTargetSet.has(m.uid)}
                isAttackingHidden={attackAnim?.attackerId === m.uid}
                isIncomingAttackTarget={attackAnim?.defenderId === m.uid}
                onSelect={() => handleEntityClick(m.uid, true)}
                onHoverChange={(hov) =>
                setHoveredBoardMinion((prev) => (hov ? m : prev?.uid === m.uid ? null : prev))
              }
              />
            </React.Fragment>
          ))}

          {selection?.kind === 'HAND_CARD' &&
            !selection.needsTarget &&
            selection.isMinion &&
            insertPreviewIdx >= matchState.player.board.length && (
              <div className="flex h-[64px] w-12 items-center justify-center rounded-[50%] border-2 border-dashed border-emerald-300 bg-emerald-400/25 text-center text-[9px] font-extrabold text-emerald-100 sm:h-[102px] sm:w-16 sm:text-[10px]">
                {tr('소환 위치', 'Summon Spot')}
              </div>
            )}

          {selection?.kind === 'HAND_CARD' &&
            !selection.needsTarget &&
            !selection.isMinion && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  executePlayPlayerCard(selection.handUid);
                }}
                className="rounded-2xl border-2 border-emerald-200 bg-emerald-600 px-4 py-1.5 text-xs font-extrabold text-white shadow-xl sm:px-5 sm:py-2 sm:text-sm"
              >
                {tr('✨ 클릭하여 시전!', '✨ Click to Cast!')}
              </button>
            )}

          {matchState.player.board.length === 0 && !selection && (
            <div className="text-[11px] font-bold text-amber-100/35 sm:text-xs">
              {tr('내 전장', 'Friendly Board')}
            </div>
          )}
        </div>
      </main>

      {/* ==================== BOTTOM ZONE: CENTERED PLAYER HERO + CURVED HAND + BOTTOM-RIGHT MANA ==================== */}
      <footer className="relative z-30 flex w-full flex-col items-center pb-1 sm:pb-1.5">
        {/* Centered Player Hero Arch + Out-of-Flow Emote Trigger (Zero Center Offset!) */}
        <div className="relative flex w-full items-center justify-center px-2">
          <div className="relative flex items-center justify-center">
            {/* Emote Menu Brass Trigger (Out-of-flow on the left so Hero Portrait stays 100% centered!) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEmoteMenuOpen((v) => !v);
              }}
              className="hs-brass-btn absolute right-[calc(100%+6px)] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-xl px-2 py-1 text-[10px] font-extrabold text-amber-100 sm:right-[calc(100%+12px)] sm:px-2.5 sm:text-[11px]"
            >
              {tr('감정표현', 'Emotes')}
            </button>

            <HeroPortraitZone
              player={matchState.player}
              isFriendly
              isActiveTurn={isPlayerTurn}
              canHeroAttack={
                isPlayerTurn && !attackAnim && engine.canAttackerSwing('PLAYER', 'PLAYER_HERO').ok
              }
              isHeroSelectedAttacker={
                selection?.kind === 'ATTACKER' && selection.attackerId === 'PLAYER_HERO'
              }
              isHeroValidTarget={activeValidTargetSet.has('PLAYER_HERO')}
              isAttackingHidden={attackAnim?.attackerId === 'PLAYER_HERO'}
              isIncomingAttackTarget={attackAnim?.defenderId === 'PLAYER_HERO'}
              canUseHeroPower={isPlayerTurn && !attackAnim && engine.inspectHeroPower('PLAYER').canUse}
              isHeroPowerSelected={selection?.kind === 'HERO_POWER'}
              emoteBubbleText={playerEmoteText}
              onClickHero={() => handleEntityClick('PLAYER_HERO', true)}
              onClickHeroPower={handlePlayerHeroPower}
            />

            {/* 6-Petal Korean Emote Radial Menu */}
            {emoteMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="hs-wood-panel absolute -top-28 left-1/2 z-50 grid w-64 -translate-x-1/2 grid-cols-3 gap-1.5 rounded-2xl p-2.5 shadow-2xl sm:-top-32"
              >
                {(
                  [
                    { key: 'greetings', label: tr('인사', 'Greetings') },
                    { key: 'well_played', label: tr('칭찬', 'Well Played') },
                    { key: 'thanks', label: tr('감사', 'Thanks') },
                    { key: 'wow', label: tr('감탄', 'Wow') },
                    { key: 'oops', label: tr('실수', 'Oops') },
                    { key: 'threaten', label: tr('위협', 'Threaten') },
                  ] as const
                ).map((em) => (
                  <button
                    key={em.key}
                    type="button"
                    onClick={() => triggerPlayerEmote(em.key)}
                    className="hs-ivory-plate rounded-xl py-1.5 text-xs font-extrabold text-[#2b180a]"
                  >
                    {em.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Player Curved Hand Fan (Centered & Dynamically Spaced so Rightmost Card Never Collides with Bottom-Right Mana!) */}
        <div className="hs-no-scrollbar mt-0.5 flex min-h-[142px] w-full items-end overflow-x-auto px-3 pb-0.5 pt-1.5 sm:min-h-[192px] sm:justify-center sm:overflow-x-visible sm:px-4 sm:pb-1 sm:pt-2">
          <div className="mx-auto flex w-max items-end">
            {matchState.player.hand.map((hc, idx) => {
              const def = cardDb.mustGetCard(hc.cardId);
              const check = engine.inspectPlayability('PLAYER', hc);
              const isSelectedCard =
                (selection?.kind === 'HAND_CARD' && selection.handUid === hc.uid) ||
                (zoomState?.kind === 'HAND_CARD' && zoomState.handUid === hc.uid);
              const handCount = matchState.player.hand.length;
              const mid = (handCount - 1) / 2;
              const angle = (idx - mid) * (isCompactMobile ? 1.5 : 2.4);
              const liftY = Math.min(isCompactMobile ? 4 : 8, Math.abs(idx - mid) * 1.2);
              const desktopOverlapPx =
                handCount <= 5
                  ? -22
                  : handCount === 6
                    ? -32
                    : handCount === 7
                      ? -46
                      : handCount === 8
                        ? -58
                        : handCount === 9
                          ? -68
                          : -76;

              return (
                <div
                  key={hc.uid}
                  data-hand-uid={hc.uid}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleHandCardClick(hc.uid);
                  }}
                  style={{
                    marginLeft: idx > 0 ? (isCompactMobile ? -24 : desktopOverlapPx) : 0,
                    transform: isSelectedCard
                      ? 'translateY(-18px) scale(1.08)'
                      : `translateY(${liftY}px) rotate(${angle}deg)`,
                  }}
                  className={`transition-all duration-150 ${
                    isSelectedCard
                      ? 'z-50'
                      : 'hover:z-50 sm:hover:-translate-y-7 sm:hover:rotate-0 sm:hover:scale-110'
                  }`}
                >
                  <HearthstoneCard
                    card={def}
                    effectiveCost={check.cost}
                    spellPowerBonus={playerSpellPower}
                    velenMultiplier={playerVelenMult}
                    journeyMultiplier={getPlayerCardMult(def.id)}
                    playableGlow={
                      !isPlayerTurn || !check.canPlay
                        ? 'NONE'
                        : check.isComboReady
                          ? 'COMBO'
                          : 'GREEN'
                    }
                    size={isCompactMobile ? 'XS' : 'SM'}
                    className="cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Original Hearthstone Bottom-Right Mana Trough (우측하단: 현재/최대 마나 + 10 사파이어 마나 수정) */}
        <div
          data-testid="player-mana-tray"
          className="mt-0.5 flex w-full justify-end px-2.5 sm:absolute sm:bottom-2.5 sm:right-3 sm:z-40 sm:mt-0 sm:w-auto sm:px-0"
        >
          <div className="flex items-center gap-1.5 rounded-2xl border-2 border-[#c8a158] bg-gradient-to-b from-[#1e1712]/96 via-[#120d0a]/96 to-[#080503]/98 px-2.5 py-1 shadow-[0_10px_24px_rgba(0,0,0,0.92),inset_0_1px_1px_rgba(255,248,220,0.22)] sm:gap-2 sm:px-3 sm:py-1.5">
            <HsManaGem
              value={matchState.player.mana}
              size={isCompactMobile ? 22 : 28}
              active={matchState.player.mana > 0}
            />
            <span
              data-testid="player-mana-fraction"
              className="hs-num hs-outline-sm min-w-[32px] text-center text-xs font-black tracking-tight text-white sm:min-w-[40px] sm:text-sm"
            >
              {matchState.player.mana}
              <span className="text-sky-300">/</span>
              {matchState.player.maxMana}
            </span>
            <div className="h-3.5 w-[1px] bg-amber-400/35 sm:h-4" />
            <div className="flex items-center gap-0.5 sm:gap-1">
              {Array.from({ length: 10 }).map((_, idx) => {
                const isUnlocked = idx < matchState.player.maxMana;
                const isFilled = idx < matchState.player.mana;
                const isOverloadedNow =
                  isUnlocked &&
                  idx >= matchState.player.maxMana - matchState.player.overloadedMana;
                return (
                  <div
                    key={idx}
                    title={
                      isOverloadedNow
                        ? tr('과부하로 잠긴 마나 수정', 'Overloaded Mana Crystal')
                        : isFilled
                          ? tr('사용 가능한 마나 수정', 'Available Mana Crystal')
                          : isUnlocked
                            ? tr('이번 턴 소모한 마나 수정', 'Spent Mana Crystal')
                            : tr('잠긴 마나 슬롯', 'Locked Mana Slot')
                    }
                    style={{
                      clipPath:
                        'polygon(50% 4%, 94% 26%, 94% 74%, 50% 96%, 6% 74%, 6% 26%)',
                    }}
                    className={`h-3.5 w-3 transition sm:h-[18px] sm:w-[14px] ${
                      isOverloadedNow
                        ? 'bg-gradient-to-b from-red-400 to-red-800 shadow-[0_0_8px_#ef4444]'
                        : isFilled
                          ? 'bg-gradient-to-b from-sky-200 via-blue-500 to-indigo-900 shadow-[0_0_8px_#38bdf8]'
                          : isUnlocked
                            ? 'bg-sky-950/88 opacity-75'
                            : 'bg-stone-800/45 opacity-45'
                    }`}
                  />
                );
              })}
            </div>
            {matchState.player.pendingOverload > 0 && (
              <span className="ml-0.5 rounded-md border border-red-400/50 bg-red-950 px-1.5 py-0.5 text-[9.5px] font-extrabold text-red-200 sm:text-[10px]">
                {tr(`과부하 ${matchState.player.pendingOverload}`, `Overload ${matchState.player.pendingOverload}`)}
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* ==================== MOBILE HISTORY OVERLAY (< sm) ==================== */}
      {mobileHistoryOpen && (
        <div
          onClick={() => setMobileHistoryOpen(false)}
          className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:hidden"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hs-wood-panel flex max-h-[78%] w-full max-w-sm flex-col rounded-3xl p-4 text-amber-100 shadow-2xl"
          >
            <div className="mb-2.5 flex items-center justify-between border-b border-amber-500/30 pb-2">
              <h3 className="hs-title text-base font-extrabold text-amber-200">
                {tr('전투 행동 기록 (카드를 터치해 확대)', 'Combat Log (Tap card to inspect)')}
              </h3>
              <button
                type="button"
                onClick={() => setMobileHistoryOpen(false)}
                className="hs-brass-btn rounded-xl px-2.5 py-1 text-xs font-extrabold text-amber-100"
              >
                {tr('닫기 ✕', 'Close ✕')}
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {matchState.history.length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-amber-200/65">
                  {tr('아직 기록된 행동이 없습니다.', 'No actions recorded yet.')}
                </div>
              ) : (
                matchState.history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      hsAudio.playSfx('card_hover', 0.65);
                      setZoomState({ kind: 'HISTORY_ITEM', item });
                    }}
                    className="flex w-full items-center gap-2.5 rounded-2xl border border-amber-400/35 bg-stone-950/85 p-2 text-left transition active:scale-[0.99]"
                  >
                    <img
                      src={resolveHistoryIconUrl(item)}
                      alt={item.title}
                      className={`h-10 w-10 shrink-0 rounded-lg border-2 object-cover object-top ${
                        item.actorSide === 'PLAYER' ? 'border-sky-400' : 'border-red-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-extrabold text-yellow-300">
                        {isKo
                          ? `${item.turn}턴 · ${item.actorSide === 'PLAYER' ? '아군' : '상대'} · ${item.title}`
                          : `T${item.turn} · ${item.actorSide === 'PLAYER' ? 'Ally' : 'Enemy'} · ${item.title}`}
                      </div>
                      <div className="truncate text-xs font-bold text-amber-100/90">
                        {item.detail}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10.5px] font-extrabold text-amber-300">
                      {tr('확대 ›', 'Zoom ›')}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== FLOATING BANNERS & MODALS ==================== */}

      {/* Turn Change Banner ("내 턴!" / "상대 턴") */}
      {matchState.bannerMessage && !vsIntroActive && (
        <div className="hs-wood-panel pointer-events-none absolute left-1/2 top-1/2 z-[82] -translate-x-1/2 -translate-y-1/2 animate-[hsCardPop_0.3s_ease-out] rounded-3xl px-8 py-3 sm:px-12 sm:py-4">
          <div className="hs-title hs-outline text-2xl font-extrabold tracking-widest text-amber-200 sm:text-3xl">
            {matchState.bannerMessage}
          </div>
        </div>
      )}

      {/* Episode 0 Tutorial: Side-Flanking Upper-Body Kadan (Left) & Scarecrow Robot (Right), zero center hero overlap */}
      {isEp0Tutorial &&
        ep0Dialogue &&
        storyPhase === 'CLOSED' &&
        !vsIntroActive &&
        matchState.phase !== 'GAME_OVER' && (
          <div
            data-testid="ep0-explanation-banner"
            className="pointer-events-none absolute inset-x-0 top-12 z-[79] flex items-start justify-between px-2 sm:top-16 sm:px-4"
          >
            {/* Left Side: Kadan Upper-Body + Desktop Bubble */}
            <div className="flex items-start gap-2 sm:max-w-[36%]">
              <div
                className={`flex shrink-0 flex-col items-center rounded-xl border-2 bg-stone-950/92 p-0.5 shadow-2xl transition-all duration-300 sm:rounded-2xl sm:p-1 ${
                  ep0Dialogue.speaker === 'KADAN'
                    ? 'scale-105 border-sky-300 ring-2 ring-sky-400/50'
                    : 'opacity-75 border-stone-600/60'
                }`}
              >
                <img
                  src="/hs-assets/bosses/kadan_upper.webp"
                  alt={tr('카단 상반신', 'Kadan Upper Body')}
                  data-testid="ep0-kadan-portrait"
                  className="h-11 w-11 rounded-lg object-cover object-top sm:h-24 sm:w-24 sm:rounded-xl"
                />
                <span className="mt-0.5 rounded bg-sky-900/90 px-1.5 py-0.5 text-[9px] font-black text-sky-100 sm:text-[10px]">
                  <span className="sm:hidden">{tr('카단', 'Kadan')}</span>
                  <span className="hidden sm:inline">{tr('카단 (아군)', 'Kadan (Ally)')}</span>
                </span>
              </div>

              {ep0Dialogue.speaker === 'KADAN' && (
                <div className="hidden min-w-0 flex-1 rounded-2xl border-2 border-sky-300/85 bg-stone-950/95 px-3.5 py-2.5 text-left shadow-2xl sm:block">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="rounded-md bg-sky-600 px-2 py-0.5 text-[11px] font-black text-white">
                      {ep0Dialogue.badge}
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-300">
                      {tr('⏱ 3초/카드', '⏱ 3s/card')}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-black text-yellow-200">
                    {ep0Dialogue.headline}
                  </div>
                  <p className="mt-0.5 text-[13.5px] font-bold leading-snug text-amber-50">
                    {ep0Dialogue.reason}
                  </p>
                </div>
              )}
            </div>

            {/* Right Side: Desktop Bubble + Scarecrow Robot Upper-Body */}
            <div className="flex items-start justify-end gap-2 sm:max-w-[36%]">
              {ep0Dialogue.speaker === 'SCARECROW' && (
                <div className="hidden min-w-0 flex-1 rounded-2xl border-2 border-amber-300/85 bg-stone-950/95 px-3.5 py-2.5 text-left shadow-2xl sm:block">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-black text-stone-950">
                      {ep0Dialogue.badge}
                    </span>
                    <span className="text-[11px] font-extrabold text-emerald-300">
                      {tr('⏱ 3초/카드', '⏱ 3s/card')}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm font-black text-yellow-200">
                    {ep0Dialogue.headline}
                  </div>
                  <p className="mt-0.5 text-[13.5px] font-bold leading-snug text-amber-50">
                    {ep0Dialogue.reason}
                  </p>
                </div>
              )}

              <div
                className={`flex shrink-0 flex-col items-center rounded-xl border-2 bg-stone-950/92 p-0.5 shadow-2xl transition-all duration-300 sm:rounded-2xl sm:p-1 ${
                  ep0Dialogue.speaker === 'SCARECROW'
                    ? 'scale-105 border-amber-300 ring-2 ring-amber-400/50'
                    : 'opacity-75 border-stone-600/60'
                }`}
              >
                <img
                  src="/hs-assets/bosses/scarecrow_robot.webp"
                  alt={tr('허수아비 로봇 상반신', 'Scarecrow Robot Upper Body')}
                  data-testid="ep0-scarecrow-portrait"
                  className="h-11 w-11 rounded-lg object-cover object-top sm:h-24 sm:w-24 sm:rounded-xl"
                />
                <span className="mt-0.5 rounded bg-amber-900/90 px-1.5 py-0.5 text-[9px] font-black text-amber-100 sm:text-[10px]">
                  <span className="sm:hidden">{tr('로봇', 'Bot')}</span>
                  <span className="hidden sm:inline">{tr('허수아비 로봇', 'Scarecrow Bot')}</span>
                </span>
              </div>
            </div>
          </div>
        )}

      {/* AI Action Callout Pill */}
      {aiHighlightText && !isEp0Tutorial && (
        <div className="pointer-events-none absolute left-1/2 top-24 z-[78] max-w-[90%] -translate-x-1/2 truncate rounded-full border-2 border-red-300 bg-stone-950/92 px-4 py-1.5 text-xs font-extrabold text-amber-100 shadow-xl sm:top-28 sm:px-5">
          {aiHighlightText}
        </div>
      )}

      {/* Play Error Banner */}
      {matchState.errorBanner && (
        <div className="pointer-events-none absolute bottom-44 left-1/2 z-[85] max-w-[92%] -translate-x-1/2 rounded-2xl border-2 border-red-300 bg-red-950/95 px-4 py-2 text-center text-xs font-extrabold text-red-100 shadow-2xl sm:bottom-48 sm:px-6 sm:text-sm">
          {matchState.errorBanner}
        </div>
      )}

      {/* Corner Toy Reaction Toast */}
      {toyToast && (
        <div className="pointer-events-none absolute left-1/2 top-14 z-[85] max-w-[92%] -translate-x-1/2 rounded-2xl border border-amber-300 bg-stone-950/92 px-4 py-1.5 text-center text-xs font-bold text-amber-200 shadow-xl sm:top-16 sm:px-5">
          {toyToast}
        </div>
      )}

      {/* 1. VS Clash Intro Overlay with Sculpted Hero Arch Portraits */}
      {vsIntroActive &&
        (() => {
          const pPortrait = resolveHeroPortraitUrl(matchState.player);
          const oPortrait = resolveHeroPortraitUrl(matchState.opponent);
          const pIsCutout = pPortrait.includes('/cutouts/');
          const oIsCutout = oPortrait.includes('/cutouts/');
          const pGrad =
            matchState.player.customHero?.frameGradient ||
            CLASSIC_HEROES[matchState.player.heroClass].frameGradient;
          const oGrad =
            matchState.opponent.customHero?.frameGradient ||
            CLASSIC_HEROES[matchState.opponent.heroClass].frameGradient;
          const pHeroInfo = getLocalizedHeroInfo(matchState.player.heroClass, lang);
          const oHeroInfo = getLocalizedHeroInfo(matchState.opponent.heroClass, lang);
          const pSubTitle =
            (isKo ? matchState.player.customHero?.titleKo : pHeroInfo.title) ||
            pHeroInfo.className;
          const oSubTitle =
            (isKo ? matchState.opponent.customHero?.titleKo : undefined) ||
            matchState.opponent.name;
          const pDispName =
            matchState.player.customHero
              ? (isKo ? matchState.player.customHero.nameKo : matchState.player.name)
              : pHeroInfo.name;
          const oDispName =
            matchState.opponent.customHero
              ? (isKo ? matchState.opponent.customHero.nameKo : matchState.opponent.name)
              : (matchState.opponent.heroNameKo || oHeroInfo.name);

          return (
            <div className="absolute inset-0 z-[92] flex flex-col items-center justify-center bg-black/84 px-3 backdrop-blur-sm">
              <div className="flex items-center gap-3 sm:gap-14">
                <div className="flex flex-col items-center text-center">
                  <div
                    style={{ background: pGrad }}
                    className="relative mb-2.5 h-32 w-24 overflow-hidden rounded-t-[48px] rounded-b-xl border-[3.5px] border-[#e7c57c] shadow-[0_14px_30px_rgba(0,0,0,0.95)] sm:mb-3 sm:h-44 sm:w-36 sm:rounded-t-[58px] sm:border-[4px]"
                  >
                    <img
                      src={pPortrait}
                      alt=""
                      className={
                        pIsCutout
                          ? 'absolute left-1/2 top-[3%] h-[155%] w-[124%] max-w-none -translate-x-1/2 object-cover object-top'
                          : 'absolute inset-0 h-full w-full scale-[1.04] object-cover object-center'
                      }
                    />
                    <img
                      src={CLASS_CREST_URL[matchState.player.heroClass]}
                      alt=""
                      className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full border border-amber-200 object-cover shadow sm:h-8 sm:w-8"
                    />
                  </div>
                  <div className="hs-title hs-outline text-lg font-extrabold text-sky-300 sm:text-3xl">
                    {pDispName}
                  </div>
                  <div className="mt-0.5 max-w-[160px] truncate text-xs font-bold text-amber-200 sm:max-w-[240px]">
                    {pSubTitle}
                  </div>
                </div>

                {/* Sculpted Gold & Sapphire VS Crest */}
                <div className="flex h-20 w-20 shrink-0 animate-[hsCardPop_0.5s_ease-out] items-center justify-center rounded-full border-4 border-amber-300 bg-radial from-amber-300 via-amber-700 to-stone-950 shadow-[0_0_32px_rgba(250,204,21,0.9)] sm:h-32 sm:w-32">
                  <span className="hs-title hs-outline text-2xl font-black tracking-tighter text-white sm:text-5xl">
                    VS
                  </span>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div
                    style={{ background: oGrad }}
                    className="relative mb-2.5 h-32 w-24 overflow-hidden rounded-t-[48px] rounded-b-xl border-[3.5px] border-[#e7c57c] shadow-[0_14px_30px_rgba(0,0,0,0.95)] sm:mb-3 sm:h-44 sm:w-36 sm:rounded-t-[58px] sm:border-[4px]"
                  >
                    <img
                      src={oPortrait}
                      alt=""
                      className={
                        oIsCutout
                          ? 'absolute left-1/2 top-[3%] h-[155%] w-[124%] max-w-none -translate-x-1/2 object-cover object-top'
                          : 'absolute inset-0 h-full w-full scale-[1.04] object-cover object-center'
                      }
                    />
                    <img
                      src={CLASS_CREST_URL[matchState.opponent.heroClass]}
                      alt=""
                      className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full border border-amber-200 object-cover shadow sm:h-8 sm:w-8"
                    />
                  </div>
                  <div className="hs-title hs-outline text-lg font-extrabold text-red-300 sm:text-3xl">
                    {oDispName}
                  </div>
                  <div className="mt-0.5 max-w-[160px] truncate text-xs font-bold text-amber-200 sm:max-w-[240px]">
                    {oSubTitle}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {/* 2. Mulligan (시작 손패 교체) Overlay — Tap Card to Enlarge & Toggle Replace! */}
      {storyPhase === 'CLOSED' && !vsIntroActive && matchState.phase === 'MULLIGAN' && (
        <div className="absolute inset-0 z-[88] flex flex-col items-center justify-center overflow-y-auto bg-black/82 p-3 text-center backdrop-blur-sm sm:p-4">
          <h2 className="hs-title hs-outline text-xl font-extrabold text-amber-200 sm:text-3xl">
            {tr('시작 카드 선택', 'Starting Hand')} (
            {matchState.firstPlayer === 'PLAYER'
              ? tr('선공 · 3장', 'Going First · 3 Cards')
              : tr('후공 · 4장 + 엘윈의 은화', 'Going Second · 4 Cards + The Coin')}
            )
          </h2>
          <p className="mt-1 max-w-md text-xs font-bold text-amber-200/90">
            {autoPlay
              ? tr('⚡ 자동 플레이가 시작 손패를 최적화하여 곧 전투를 개시합니다...',
                  '⚡ Auto-Play is optimizing your starting hand...',
                )
              : tr('카드를 터치해 크게 확대하고 하단 버튼으로 교체(✕) 여부를 선택한 뒤 [확인]을 누르세요.',
                  'Tap a card to inspect and toggle replace (✕), then press Confirm.',
                )}
          </p>

          <div
            className={`my-4 items-center justify-center gap-2.5 sm:my-6 sm:flex sm:flex-wrap sm:gap-4 ${
              isCompactMobile && matchState.player.hand.length >= 4
                ? 'grid grid-cols-2'
                : 'flex flex-wrap'
            }`}
          >
            {matchState.player.hand.map((hc) => {
              const def = cardDb.mustGetCard(hc.cardId);
              const marked = matchState.mulliganSelectedUids.includes(hc.uid);
              return (
                <div
                  key={hc.uid}
                  onClick={(e) => {
                    e.stopPropagation();
                    hsAudio.playSfx('card_hover', 0.7);
                    setZoomState({ kind: 'MULLIGAN_CARD', handUid: hc.uid });
                  }}
                  className="relative cursor-pointer transition hover:scale-105"
                >
                  <HearthstoneCard
                    card={def}
                    journeyMultiplier={getPlayerCardMult(def.id)}
                    size={isCompactMobile ? 'XS' : 'MD'}
                  />
                  {marked && (
                    <div className="absolute inset-x-2 inset-y-2.5 z-40 flex flex-col items-center justify-center rounded-2xl border-2 border-red-400/75 bg-red-950/75 backdrop-blur-[1px]">
                      <span className="hs-outline text-4xl font-black text-red-400 sm:text-6xl">✕</span>
                      <span className="mt-0.5 rounded-md border border-red-300/60 bg-red-900 px-2 py-0.5 text-[10px] font-extrabold text-white sm:text-xs">
                        {tr('교체 예정', 'Replacing')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={confirmMulliganNow}
              className="hs-arcane-btn hs-title hs-outline-sm rounded-2xl px-9 py-2.5 text-lg font-extrabold tracking-wider text-white sm:px-11 sm:py-3 sm:text-xl"
            >
              {tr('확인 (전투 개시)', 'Confirm (Start Duel)')}
            </button>
            <button
              type="button"
              data-testid="autoplay-toggle-mulligan"
              data-autoplay-active={autoPlay ? 'true' : 'false'}
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.85);
                setAutoPlay((prev) => !prev);
              }}
              className={`flex min-h-[46px] items-center gap-2 rounded-2xl border-2 px-5 py-2.5 text-sm font-extrabold shadow-xl transition hover:scale-105 sm:text-base ${
                autoPlay
                  ? 'border-emerald-300 bg-gradient-to-b from-emerald-600 via-teal-800 to-emerald-950 text-white shadow-[0_0_18px_rgba(52,211,153,0.75)]'
                  : 'border-[#c8a158]/80 bg-gradient-to-b from-stone-800 to-stone-950 text-amber-200 hover:border-amber-300'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className={`h-4 w-4 shrink-0 ${
                  autoPlay ? 'animate-spin text-yellow-200' : 'text-amber-300/75'
                }`}
              >
                <path
                  d="M12 2v3m0 14v3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M2 12h3m14 0h3M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2.2" />
              </svg>
              <span>
                {autoPlay
                  ? tr('자동플레이 ON (작동 중)', 'Auto-Play ON (Active)')
                  : tr('자동플레이 OFF (클릭 시 작동)', 'Auto-Play OFF (Click to enable)')}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Choose One (선택) Modal — Tap Option Card to Enlarge & Confirm! */}
      {matchState.chooseOnePrompt && (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-black/82 p-3 text-center backdrop-blur-sm sm:p-4">
          <h3 className="hs-title hs-outline mb-3 text-xl font-extrabold text-amber-200 sm:mb-4 sm:text-2xl">
            {tr('운명의 선택 — 카드를 터치해 확대 후 선택하세요', 'Choose One — Tap a card to inspect and choose')}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {matchState.chooseOnePrompt.options.map((opt) => {
              const optCard = cardDb.mustGetCard(opt.optionCardId);
              return (
                <button
                  key={opt.index}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hsAudio.playSfx('card_hover', 0.7);
                    setZoomState({ kind: 'CHOOSE_ONE_CARD', optionIndex: opt.index });
                  }}
                  className="hs-wood-panel flex max-w-[162px] flex-col items-center rounded-2xl p-2.5 transition hover:scale-105 hover:border-emerald-300 sm:max-w-none sm:p-4"
                >
                  <HearthstoneCard card={optCard} size={isCompactMobile ? 'XS' : 'MD'} />
                  <div className="hs-title mt-1.5 text-xs font-extrabold text-amber-200 sm:mt-2 sm:text-sm">
                    {opt.title}
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-amber-100/85 sm:text-xs">
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Tracking (정찰 추적) 3-Card Picker Modal — Tap Card to Enlarge & Pick! */}
      {matchState.trackingPrompt && (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-black/82 p-3 text-center backdrop-blur-sm sm:p-4">
          <h3 className="hs-title hs-outline mb-1.5 text-xl font-extrabold text-emerald-300 sm:mb-2 sm:text-2xl">
            {tr('정찰 추적 — 카드를 터치해 확대 후 1장을 가져오세요',
              'Tracking — Tap a card to inspect and draw 1',
            )}
          </h3>
          <p className="mb-4 text-xs font-bold text-amber-200/85 sm:mb-5">
            {tr('선택하지 않은 나머지 카드는 버려집니다.', 'The other cards will be discarded.')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-5">
            {matchState.trackingPrompt.cards.map((cid, idx) => (
              <div
                key={`${cid}_${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  hsAudio.playSfx('card_hover', 0.7);
                  setZoomState({ kind: 'TRACKING_CARD', cardId: cid });
                }}
                className="cursor-pointer transition hover:scale-108"
              >
                <HearthstoneCard card={cardDb.mustGetCard(cid)} size={isCompactMobile ? 'XS' : 'MD'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Victory / Defeat Heraldry Banner, 3s Auto-Advance & Defeat Pack Purchase -> 5-Card Open -> Auto-Retry Loop */}
      {matchState.phase === 'GAME_OVER' && (
        <div className="absolute inset-0 z-[94] flex items-center justify-center overflow-y-auto bg-black/84 p-3 backdrop-blur-md sm:p-4">
          {defeatPackResult ? (
            <div
              data-testid="defeat-pack-reinforcement-modal"
              className="hs-wood-panel relative flex max-h-[95%] w-full max-w-3xl flex-col items-center overflow-y-auto rounded-3xl p-4 text-center text-amber-100 shadow-2xl sm:p-6"
            >
              {autoPlay && !postGameAutoPaused && (
                <div className="absolute left-0 right-0 top-0 h-1.5 bg-stone-900">
                  <div
                    style={{
                      width: `${Math.min(100, ((3500 - drawRetryRemainingMs) / 3500) * 100)}%`,
                    }}
                    className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-300 transition-all duration-100"
                  />
                </div>
              )}

              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <span
                  data-testid="defeat-pack-source-badge"
                  className="rounded-full border border-emerald-300/70 bg-emerald-950 px-3 py-0.5 text-xs font-extrabold text-emerald-200"
                >
                  {defeatPackResult.boughtWithGold
                    ? tr(`🪙 골드로 카드팩 1개 구매 (-${defeatPackResult.goldSpent}G) & 즉시 개봉!`,
                        `🪙 Bought 1 Card Pack (-${defeatPackResult.goldSpent}G) & Opened!`,
                      )
                    : defeatPackResult.usedExistingPack
                      ? tr('🎁 보유 카드팩 1개 즉시 개봉!', '🎁 Opened 1 Owned Pack!')
                      : tr('🎁 엘윈 성소 구호 지원팩 1개 무상 개봉!',
                          '🎁 Free Elwin Sanctuary Aid Pack Opened!',
                        )}
                </span>
                {autoPlay && (
                  <button
                    type="button"
                    onClick={() => setPostGameAutoPaused((p) => !p)}
                    className={`rounded-lg border px-2.5 py-0.5 text-[11px] font-extrabold ${
                      !postGameAutoPaused
                        ? 'border-emerald-300/70 bg-emerald-950/90 text-emerald-200'
                        : 'border-amber-400/50 bg-stone-900 text-amber-200'
                    }`}
                  >
                    {!postGameAutoPaused
                      ? tr(`⏱ ${Math.max(1, Math.ceil(drawRetryRemainingMs / 1000))}초 후 강화된 덱으로 재도전 (정지)`,
                          `⏱ Retrying in ${Math.max(1, Math.ceil(drawRetryRemainingMs / 1000))}s (Pause)`,
                        )
                      : tr('▶ 자동 재도전 재개', '▶ Resume Auto-Retry')}
                  </button>
                )}
              </div>

              <h3 className="hs-title mt-1.5 text-lg font-extrabold text-yellow-300 sm:text-2xl">
                {tr('눈히어로 카드팩 5장 개봉 & 스토리모드 전력 강화 완료!',
                  '5-Card Pack Opened & Story Deck Powered Up!',
                )}
              </h3>
              <p className="mt-0.5 text-[11px] font-bold text-amber-200/85 sm:text-xs">
                {defeatPackResult.boughtWithGold
                  ? tr(`100 골드를 사용해 카드팩 1개를 구매하고 개봉했습니다 (남은 골드 ${defeatPackResult.remainingGold}G · 보유 팩 ${defeatPackResult.remainingPacks}팩)`,
                      `Spent 100G to buy and open 1 pack (Gold ${defeatPackResult.remainingGold}G · Packs ${defeatPackResult.remainingPacks})`,
                    )
                  : tr(`카드팩 1개(5장)를 개봉해 도감에 합산했습니다 (남은 골드 ${defeatPackResult.remainingGold}G · 보유 팩 ${defeatPackResult.remainingPacks}팩)`,
                      `Opened 1 pack (5 cards) added to collection (Gold ${defeatPackResult.remainingGold}G · Packs ${defeatPackResult.remainingPacks})`,
                    )}
              </p>

              {/* 5-Card Pack Reveal Showcase */}
              <div className="my-3 flex flex-wrap items-start justify-center gap-2 sm:my-4 sm:gap-3">
                {defeatPackResult.cards.map((item, idx) => (
                  <div
                    key={`${item.card.id}_${idx}`}
                    data-testid={`defeat-pack-card-${idx}`}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      style={{ perspective: '900px' }}
                      className="flex items-center justify-center"
                    >
                      <div
                        style={{
                          transformStyle: 'preserve-3d',
                          transform: defeatPackResult.flipped
                            ? 'rotateY(180deg) scale(1)'
                            : 'rotateY(0deg) scale(0.92)',
                          transition: `transform ${0.44 + idx * 0.06}s cubic-bezier(0.22, 1, 0.36, 1)`,
                        }}
                        className="relative"
                      >
                        <div
                          style={{ backfaceVisibility: 'hidden' }}
                          className={`overflow-hidden rounded-xl shadow-xl ${
                            isCompactMobile ? 'h-[126px] w-[90px]' : 'h-[168px] w-[120px]'
                          }`}
                        >
                          <SnsCardBackArt variant={profile.selectedCardBack} />
                        </div>
                        <div
                          style={{
                            backfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                          }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <HearthstoneCard
                            card={item.card}
                            isGolden={item.isGolden}
                            journeyMultiplier={item.newJourneyMultiplier}
                            size={isCompactMobile ? 'XS' : 'SM'}
                          />
                        </div>
                      </div>
                    </div>
                    <div
                      className={`rounded-lg border px-2 py-0.5 text-[10px] font-extrabold ${
                        item.newJourneyMultiplier > 1
                          ? 'border-emerald-300/80 bg-emerald-950/90 text-emerald-200'
                          : 'border-amber-500/40 bg-stone-950/85 text-amber-200'
                      }`}
                    >
                      <span>{tr(`보유 ${item.newOwnedCount}장`, `Owned ${item.newOwnedCount}`)}</span>
                      {item.newJourneyMultiplier > 1 ? (
                        <span className="ml-1 text-yellow-300">
                          · ⚡×{item.newJourneyMultiplier}{isKo ? '배 각성!' : ' Awakened!'}
                        </span>
                      ) : item.isNew ? (
                        <span className="ml-1 text-sky-300">· {tr('신규', 'NEW')}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div
                data-testid="defeat-pack-power-summary"
                className="mb-3 w-full rounded-2xl border border-emerald-400/50 bg-stone-950/85 px-3.5 py-2 text-xs font-extrabold"
              >
                <div className="text-emerald-300">
                  {isKo ? (
                    <>
                      ⚡ 이번 카드팩 개봉으로{' '}
                      <span className="text-yellow-300">{defeatPackResult.awakenedInPackCount}장</span>의
                      전투 카드가 ×3배 이상 각성/강화되었습니다!
                    </>
                  ) : (
                    <>
                      ⚡ This pack awakened{' '}
                      <span className="text-yellow-300">{defeatPackResult.awakenedInPackCount}</span> battle
                      card(s) to ×3+ stats!
                    </>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-amber-100/90">
                  {isKo ? (
                    <>
                      현재 스토리모드 3장+ 배수 강화 카드 총{' '}
                      <span className="text-yellow-300">{defeatPackResult.totalBoostedCount}종</span>{' '}
                      (최대 <span className="text-emerald-300">×{defeatPackResult.maxMultiplier}배</span>)
                      · 다음 판 덱에 최우선 편성됩니다!
                    </>
                  ) : (
                    <>
                      Total boosted cards in Story Mode:{' '}
                      <span className="text-yellow-300">{defeatPackResult.totalBoostedCount}</span> (Max{' '}
                      <span className="text-emerald-300">×{defeatPackResult.maxMultiplier}</span>) · Prioritized
                      in next deck!
                    </>
                  )}
                </div>
              </div>

              <div className="flex w-full flex-col gap-2">
                {onStartJourneyEpisode && (
                  <button
                    type="button"
                    data-testid="defeat-pack-retry-btn"
                    onClick={() => {
                      drawRetryFiredRef.current = true;
                      hsAudio.playSfx('box_press');
                      onStartJourneyEpisode(
                        matchState.journeyMeta?.episode ?? profile.journeyEpisode ?? 0,
                        true,
                      );
                    }}
                    className="hs-arcane-btn hs-title hs-outline-sm w-full rounded-2xl py-3 text-base font-extrabold text-white sm:text-lg"
                  >
                    {isKo
                      ? `⚔ 강화된 덱으로 제${matchState.journeyMeta?.episode ?? profile.journeyEpisode ?? 0}화 다시 도전하기`
                      : `⚔ Retry EP ${matchState.journeyMeta?.episode ?? profile.journeyEpisode ?? 0} with Boosted Deck`}
                    {autoPlay && !postGameAutoPaused
                      ? ` (${Math.max(1, Math.ceil(drawRetryRemainingMs / 1000))}${isKo ? '초' : 's'})`
                      : ' ▶'}
                  </button>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    data-testid="defeat-pack-open-another-btn"
                    onClick={() => {
                      triggerDefeatPackReinforcement();
                    }}
                    className="hs-gold-btn rounded-xl py-2 text-xs font-extrabold"
                  >
                    {profile.gold >= 100
                      ? tr(`🪙 골드로 1팩 더 구매·개봉 (-100G · 보유 ${profile.gold}G)`,
                          `🪙 Buy & Open Another Pack (-100G · ${profile.gold}G)`,
                        )
                      : profile.packs > 0
                        ? tr(`🎁 보유 카드팩 1개 더 개봉 (보유 ${profile.packs}팩)`,
                            `🎁 Open Another Owned Pack (${profile.packs} left)`,
                          )
                        : tr('🎁 성소 지원팩 1개 더 개봉하여 추가 강화',
                            '🎁 Open Another Free Sanctuary Aid Pack',
                          )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      drawRetryFiredRef.current = true;
                      hsAudio.playSfx('menu_select');
                      hsAudio.playBgm('tavern_hub');
                      onExitBattle();
                    }}
                    className="hs-brass-btn rounded-xl py-2 text-xs font-extrabold text-amber-100"
                  >
                    {tr('엘윈마을 로비로 돌아가기', 'Return to Elwin Village Hub')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <div className="hs-wood-panel relative flex max-h-[94%] w-full max-w-lg flex-col items-center overflow-y-auto rounded-3xl p-5 text-center text-amber-100 sm:p-6">
            {autoPlay && !postGameAutoPaused && (
              <div className="absolute left-0 right-0 top-0 h-1.5 bg-stone-900">
                <div
                  style={{
                    width: `${Math.min(100, ((3000 - postGameRemainingMs) / 3000) * 100)}%`,
                  }}
                  className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-300 transition-all duration-100"
                />
              </div>
            )}

            {autoPlay && (
              <div className="relative z-20 mb-1 flex w-full justify-end">
                <button
                  type="button"
                  onClick={() => setPostGameAutoPaused((p) => !p)}
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${
                    !postGameAutoPaused
                      ? 'border-emerald-300/70 bg-emerald-950/90 text-emerald-200'
                      : 'border-amber-400/50 bg-stone-900 text-amber-200'
                  }`}
                >
                  {!postGameAutoPaused
                    ? tr(`⏱ 자동이동 ${Math.max(1, Math.ceil(postGameRemainingMs / 1000))}초 (정지)`,
                        `⏱ Auto-next ${Math.max(1, Math.ceil(postGameRemainingMs / 1000))}s (Pause)`,
                      )
                    : tr('▶ 자동이동 재개', '▶ Resume Auto-next')}
                </button>
              </div>
            )}
            {matchState.winner === 'PLAYER' && (
              <div
                style={{
                  animation: 'hsSlowSpin 24s linear infinite',
                  background:
                    'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.38) 40deg, transparent 80deg, rgba(56,189,248,0.3) 170deg, transparent 210deg, rgba(251,191,36,0.38) 300deg, transparent 360deg)',
                }}
                className="pointer-events-none absolute -top-16 h-80 w-80 rounded-full blur-md"
              />
            )}

            <div className={`relative z-10 ${matchState.winner === 'PLAYER' ? '' : 'grayscale opacity-75'}`}>
              <SnsRankMedallion
                rank={matchState.winner === 'PLAYER' ? 0 : profile.rank}
                size={76}
                className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
              />
            </div>

            <h2
              className={`hs-title hs-outline relative z-10 mt-1.5 text-2xl font-extrabold sm:text-4xl ${
                matchState.winner === 'PLAYER' ? 'text-yellow-300' : 'text-slate-200'
              }`}
            >
              {matchState.winner === 'PLAYER'
                ? mode === 'TUTORIAL' && matchState.journeyMeta
                  ? matchState.journeyMeta.episode === 0
                    ? tr('에피소드 0 튜토리얼 완승!', 'Episode 0 Tutorial Complete!')
                    : tr(`제${matchState.journeyMeta.episode}화 돌파 승리!`,
                        `Episode ${matchState.journeyMeta.episode} Cleared!`,
                      )
                  : tr('승리!', 'Victory!')
                : mode === 'TUTORIAL' && matchState.journeyMeta
                  ? tr(`제${matchState.journeyMeta.episode}화 결투 패배`,
                      `Episode ${matchState.journeyMeta.episode} Defeat`,
                    )
                  : tr('패배', 'Defeat')}
            </h2>
            <p className="relative z-10 mt-1 text-xs font-bold text-amber-200/90">
              {matchState.winner === 'PLAYER'
                ? isEp0Tutorial
                  ? tr('모험가님, 엘윈마을 눈히어로에 오신 것을 환영합니다! 이제 3초 뒤 제1화 본편 자동플레이가 시작됩니다!',
                      'Welcome to Elwin Village, SNSHero! Episode 1 Auto-Play starts in 3 seconds!',
                    )
                  : tr(`${matchState.opponent.name}을(를) 제압하고 확정 보상을 수령했습니다!`,
                      `Defeated ${matchState.opponent.name} and claimed your rewards!`,
                    )
                : mode === 'TUTORIAL' && matchState.journeyMeta
                  ? tr(`회차·환생이 높아질수록 적 보스(체력 ${matchState.journeyMeta.enemyHeroHealth} · 스탯 ×${matchState.journeyMeta.enemyStatScale}배)가 강력해집니다!`,
                      `Bosses grow stronger with each stage (HP ${matchState.journeyMeta.enemyHeroHealth} · Stats ×${matchState.journeyMeta.enemyStatScale})!`,
                    )
                  : tr('아군 영웅이 쓰러졌습니다. 덱을 정비하고 다시 도전해 보세요!',
                      'Your hero has fallen. Tune your deck and try again!',
                    )}
            </p>

            {matchState.winner === 'PLAYER' && isEp0Tutorial && (
              <div
                data-testid="ep0-welcome-banner"
                className="relative z-10 mt-2.5 flex w-full items-center gap-3 rounded-2xl border-2 border-sky-300/70 bg-sky-950/80 p-3 text-left shadow-lg"
              >
                <img
                  src="/hs-assets/bosses/kadan_upper.webp"
                  alt={tr('카단 환영 인사', 'Kadan Welcome')}
                  className="h-14 w-14 shrink-0 rounded-xl border-2 border-sky-300 object-cover object-top"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black text-sky-300">
                    {tr('카단 · 튜토리얼 수료 환영 인사', 'Kadan · Tutorial Complete')}
                  </div>
                  <div className="mt-0.5 text-xs font-extrabold leading-snug text-white sm:text-sm">
                    {tr('“허수아비 로봇을 훌륭하게 쓰러뜨리셨어요! 눈히어로 세계에 오신 것을 진심으로 환영합니다. 이제 제1화에서 진짜 여정을 시작합시다!”',
                      '“Well done defeating the Scarecrow Bot! Welcome to the world of SNSHero. Let’s begin our true journey in Episode 1!”',
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Itemized Victory / Match Reward Receipt */}
            {outcomeSummary && (
              <div className="relative z-10 my-3.5 w-full space-y-1.5 rounded-2xl border-2 border-[#c8a158]/60 bg-black/50 p-3.5 text-left text-xs sm:p-4">
                <div className="mb-1 border-b border-amber-500/25 pb-1 text-center font-extrabold text-amber-200">
                  {outcomeSummary.didWin
                    ? tr('🏆 확정 승리 보상 지급 명세', '🏆 Victory Rewards Summary')
                    : tr('📋 대결 결과 안내', '📋 Match Summary')}
                </div>

                {outcomeSummary.didWin ? (
                  <>
                    <div className="flex items-center justify-between font-bold text-amber-100">
                      <span>{tr('• 기본 승리 골드', '• Base Win Gold')}</span>
                      <span className="font-extrabold text-yellow-300">
                        +{outcomeSummary.baseWinGold} {tr('골드', 'Gold')}
                      </span>
                    </div>

                    {outcomeSummary.bonusGold > 0 && outcomeSummary.bonusLabel && (
                      <div className="flex items-center justify-between font-bold text-emerald-200">
                        <span>• {outcomeSummary.bonusLabel}</span>
                        <span className="font-extrabold text-emerald-300">
                          +{outcomeSummary.bonusGold} {tr('골드', 'Gold')}
                        </span>
                      </div>
                    )}

                    {outcomeSummary.questGold > 0 && (
                      <div className="flex items-center justify-between font-bold text-sky-200">
                        <span>{tr('• 일일 의뢰 달성 보상', '• Daily Quest Reward')}</span>
                        <span className="font-extrabold text-sky-300">
                          +{outcomeSummary.questGold} {tr('골드', 'Gold')}
                        </span>
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-between border-t border-amber-500/30 pt-1.5 text-sm font-extrabold">
                      <span className="text-amber-100">
                        {tr(`총 획득 골드 (보유 ${profile.gold}G)`, `Total Gold (Owned ${profile.gold}G)`)}
                      </span>
                      <span className="flex items-center gap-1 text-yellow-300">
                        <HsGoldCoinIcon size={18} />
                        <span>+{outcomeSummary.goldEarned}G</span>
                      </span>
                    </div>

                    {outcomeSummary.packsEarned > 0 && (
                      <div className="mt-1.5 flex items-center justify-between rounded-xl border border-yellow-300/60 bg-amber-950/70 px-3 py-2 font-extrabold text-yellow-200">
                        <span className="truncate pr-2">
                          🎁 {outcomeSummary.packReason || tr('특전 눈히어로 팩 보상', 'Bonus Card Pack Reward')}
                        </span>
                        <span className="shrink-0 text-yellow-300">
                          +{outcomeSummary.packsEarned} {tr('팩!', 'Pack(s)!')}
                        </span>
                      </div>
                    )}

                    {outcomeSummary.reincarnatedNow && (
                      <div className="mt-1.5 rounded-xl border border-purple-300/70 bg-purple-950/80 px-3 py-2 text-center font-extrabold text-purple-200">
                        {tr(`✦ 40화 대단원 완주! [환생 ${outcomeSummary.nextReincarnation}회차]가 개방되었습니다!`,
                          `✦ Episode 40 Complete! Reincarnation ${outcomeSummary.nextReincarnation} Unlocked!`,
                        )}
                      </div>
                    )}

                    {(mode === 'RANKED' || mode === 'CASUAL') && (
                      <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-amber-200/85">
                        <span>{tr('3승 달성 추가 보너스 진행도', '3-Win Bonus Progress')}</span>
                        <span className="text-yellow-300">
                          {outcomeSummary.threeWinProgress} / 3{isKo ? '승' : ' Wins'}
                        </span>
                      </div>
                    )}

                    {mode === 'RANKED' && (
                      <div className="mt-1 flex items-center justify-between text-[11px] font-bold text-sky-200">
                        <span>{tr('현재 눈히어로 등급', 'Current SNSHero Rank')}</span>
                        <span>
                          {outcomeSummary.newRank === 0
                            ? tr('전설의 눈히어로!', 'Legend SNSHero!')
                            : isKo
                              ? `${outcomeSummary.newRank}등급 (${CLASSIC_RANK_NAMES[outcomeSummary.newRank]}) · ★${outcomeSummary.newStars}`
                              : `Rank ${outcomeSummary.newRank} (${getRankTitle(outcomeSummary.newRank, CLASSIC_RANK_NAMES, lang)}) · ★${outcomeSummary.newStars}`}
                          {outcomeSummary.streakBonus ? tr(' (연승 ×2!)', ' (Win Streak ×2!)') : ''}
                        </span>
                      </div>
                    )}
                  </>
                ) : mode === 'TUTORIAL' ? (
                  <div className="space-y-1.5 text-center leading-relaxed text-amber-100">
                    <div className="font-extrabold text-emerald-300">
                      {tr('⚡ 패배 시 자동 전력 보강: 카드팩 1개 구매 · 개봉 후 재도전!',
                        '⚡ Defeat Auto-Power-Up: Open 1 Card Pack & Retry!',
                      )}
                    </div>
                    <p className="text-[11.5px] font-semibold text-amber-100/90">
                      {isKo ? (
                        <>
                          바로 재대결하지 않고{' '}
                          <b className="text-yellow-300">
                            {profile.gold >= 100
                              ? `보유 골드(${profile.gold}G)로 카드팩 1개를 구매(-100G)`
                              : profile.packs > 0
                                ? `보유 카드팩(${profile.packs}팩) 1개를 사용`
                                : '엘윈 성소 구호 지원팩 1개를 보급'}
                          </b>
                          하여 <b className="text-emerald-300">5장을 개봉(동일 카드 3장 = 공격력·생명력 ×3배 각성)</b>한 뒤 강화된 덱으로 다시 도전합니다!
                        </>
                      ) : (
                        <>
                          Before retrying, you&apos;ll{' '}
                          <b className="text-yellow-300">
                            {profile.gold >= 100
                              ? `spend 100G (Gold ${profile.gold}G) for 1 card pack`
                              : profile.packs > 0
                                ? `open 1 owned card pack (${profile.packs} left)`
                                : 'claim 1 free Elwin Sanctuary Aid pack'}
                          </b>{' '}
                          and awaken <b className="text-emerald-300">3+ duplicate cards (×3 ATK/HP)</b>!
                        </>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-[11.5px] font-semibold text-amber-200/85">
                    {tr('승리 시 확정 골드와 일일 의뢰 보상이 지급됩니다. 덱 구성을 점검하고 다시 도전해 보세요!',
                      'Wins award Gold and Daily Quest progress. Adjust your deck and try again!',
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons: Journey Progression / Upgrade Loop vs Standard Return */}
            {mode === 'TUTORIAL' ? (
              matchState.winner === 'PLAYER' ? (
                <div className="relative z-10 flex w-full flex-col gap-2">
                  {onStartJourneyEpisode && outcomeSummary?.nextEpisode && (
                    <button
                      type="button"
                      onClick={() => {
                        postGameFiredRef.current = true;
                        hsAudio.playSfx('box_press');
                        onStartJourneyEpisode(outcomeSummary.nextEpisode!, false);
                      }}
                      className="hs-arcane-btn hs-title hs-outline-sm w-full rounded-2xl py-3 text-base font-extrabold text-white sm:text-lg"
                    >
                      {isEp0Tutorial
                        ? tr(`⚔ 제${outcomeSummary.nextEpisode}화 자동플레이 시작`,
                            `⚔ Start Episode ${outcomeSummary.nextEpisode} Auto-Play`,
                          )
                        : isKo
                          ? `⚔ 다음 여정 진행 (${
                              outcomeSummary.nextReincarnation && outcomeSummary.nextReincarnation > 0
                                ? `환생 ${outcomeSummary.nextReincarnation} · `
                                : ''
                            }제${outcomeSummary.nextEpisode}화)`
                          : `⚔ Next Episode (${
                              outcomeSummary.nextReincarnation && outcomeSummary.nextReincarnation > 0
                                ? `Reinc. ${outcomeSummary.nextReincarnation} · `
                                : ''
                            }EP ${outcomeSummary.nextEpisode})`}
                      {autoPlay && !postGameAutoPaused
                        ? ` · ${Math.max(1, Math.ceil(postGameRemainingMs / 1000))}${isKo ? '초' : 's'}`
                        : ' ▶'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      postGameFiredRef.current = true;
                      hsAudio.playSfx('menu_select');
                      hsAudio.playBgm('tavern_hub');
                      onExitBattle();
                    }}
                    className="hs-brass-btn w-full rounded-xl py-2.5 text-xs font-extrabold text-amber-100 sm:text-sm"
                  >
                    {tr('엘윈마을 로비로 돌아가기', 'Return to Elwin Village Hub')}
                  </button>
                </div>
              ) : (
                <div className="relative z-10 flex w-full flex-col gap-2">
                  <button
                    type="button"
                    data-testid="defeat-buy-open-pack-btn"
                    onClick={() => {
                      postGameFiredRef.current = true;
                      triggerDefeatPackReinforcement();
                    }}
                    className="hs-arcane-btn hs-title hs-outline-sm flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold text-white shadow-[0_4px_16px_rgba(16,185,129,0.45)] sm:text-base"
                  >
                    <span>
                      {profile.gold >= 100
                        ? tr('🪙 골드로 카드팩 1개 구매 · 개봉하여 전력 강화 (-100G)',
                            '🪙 Buy & Open 1 Card Pack to Power Up (-100G)',
                          )
                        : profile.packs > 0
                          ? tr(`🎁 보유 카드팩 1개 개봉하여 전력 강화 (보유 ${profile.packs}팩)`,
                              `🎁 Open 1 Owned Pack to Power Up (${profile.packs} left)`,
                            )
                          : tr('🎁 성소 구호 카드팩 1개 개봉하여 전력 강화',
                              '🎁 Open Free Sanctuary Aid Pack to Power Up',
                            )}
                      {autoPlay && !postGameAutoPaused
                        ? ` (${Math.max(1, Math.ceil(postGameRemainingMs / 1000))}${isKo ? '초' : 's'})`
                        : ' ▶'}
                    </span>
                  </button>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {onStartJourneyEpisode && (
                      <button
                        type="button"
                        onClick={() => {
                          postGameFiredRef.current = true;
                          hsAudio.playSfx('box_press');
                          onStartJourneyEpisode(
                            matchState.journeyMeta?.episode || profile.journeyEpisode,
                            true,
                          );
                        }}
                        className="hs-brass-btn rounded-xl py-2 text-xs font-extrabold text-amber-100"
                      >
                        {tr('⚔ 팩 개봉 없이 바로 재도전', '⚔ Retry Without Pack')}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        postGameFiredRef.current = true;
                        hsAudio.playSfx('menu_select');
                        hsAudio.playBgm('tavern_hub');
                        onExitBattle();
                      }}
                      className="hs-brass-btn rounded-xl py-2 text-xs font-extrabold text-amber-100"
                    >
                      {tr('엘윈마을 로비로 돌아가기', 'Return to Elwin Village Hub')}
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="relative z-10 flex w-full flex-col gap-2">
                <div
                  data-testid="gameover-autoplay-reset-note"
                  className="rounded-xl border border-stone-600/70 bg-black/50 px-3 py-1.5 text-[11px] font-extrabold text-amber-200/85"
                >
                  {tr('⚙ 전투 종료와 함께 자동플레이가 비활성화(OFF)되었습니다 · 다음 판에서 새로 활성화할 수 있습니다.',
                    '⚙ Auto-Play turned OFF at match end · You can re-enable it next match.',
                  )}
                </div>
                {onRematchSameMode && (
                  <button
                    type="button"
                    data-testid="gameover-rematch-btn"
                    onClick={() => {
                      postGameFiredRef.current = true;
                      hsAudio.playSfx('box_press');
                      onRematchSameMode();
                    }}
                    className="hs-arcane-btn hs-title hs-outline-sm w-full rounded-2xl py-3 text-base font-extrabold text-white sm:text-lg"
                  >
                    {tr('⚔ 같은 덱으로 다음 판 시작', '⚔ Play Again (Same Deck)')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    postGameFiredRef.current = true;
                    hsAudio.playSfx('menu_select');
                    hsAudio.playBgm('tavern_hub');
                    onExitBattle();
                  }}
                  className={`hs-title hs-outline-sm w-full rounded-2xl py-2.5 text-sm font-extrabold sm:text-base ${
                    onRematchSameMode
                      ? 'hs-brass-btn text-amber-100'
                      : 'hs-arcane-btn py-3 text-lg text-white'
                  }`}
                >
                  {tr('엘윈마을로 돌아가기', 'Return to Elwin Village')}
                </button>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* Episode Novel Storyboard Theater (Pre-Battle & Mid-Battle Review in 카단의 여정) */}
      {mode === 'TUTORIAL' && storyPhase !== 'CLOSED' && matchState.journeyMeta && (
        <KadanJourneyStoryModal
          episode={matchState.journeyMeta.episode}
          reincarnation={matchState.journeyMeta.reincarnation}
          maxClearedEpisode={
            matchState.journeyMeta.reincarnation > 0 ? 40 : profile.journeyMaxStageCleared
          }
          playerBoostedCount={journeyDeckStats.boostedCount}
          playerMaxMultiplier={journeyDeckStats.maxMultiplier}
          autoPlayEnabled={autoPlay}
          isMidBattleReview={storyPhase === 'REVIEW'}
          onStartBattle={handleCompletePreBattleStory}
          onCloseReview={() => setStoryPhase('CLOSED')}
        />
      )}

      {quickRulesOpen && (
        <QuickRulesModal
          isFirstTime={!hasSeenQuickRules()}
          inBattle={true}
          onClose={() => setQuickRulesOpen(false)}
        />
      )}

      {/* Universal Enlarged Card Inspection & Bottom Action Modal */}
      {renderActiveZoomModal()}
    </div>
  );
};
