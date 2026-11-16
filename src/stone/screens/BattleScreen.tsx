import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import {
  CLASS_CREST_URL,
  cardDb,
  getCardArtUrl,
  getCardTileUrl,
  getHeroArtUrl,
} from '../cardDb';
import {
  BoardMinionToken,
  HearthstoneCard,
  HeroPortraitZone,
  HsAttackBadge,
  HsGoldCoinIcon,
  HsHealthBadge,
  HsManaGem,
} from '../components/CardVisual';
import { CardZoomAction, CardZoomModal } from '../components/CardZoomModal';
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
  getCardName,
  getLocalizedHeroInfo,
  getRankTitle,
} from '../i18nData';
import { hsStorage } from '../storage';
import {
  ActionHistoryItem,
  BattleMatchState,
  BoardThemeId,
  CLASSIC_HEROES,
  CardRarity,
  CustomDeck,
  GameMode,
  HeroClass,
  MinionInstance,
  VfxEvent,
  VfxKind,
} from '../types';
import { BoardVfxCanvas, recordEntityStagePosition } from '../vfx/BoardVfxCanvas';

interface PhysicalAttackAnimState {
  id: number;
  side: 'PLAYER' | 'OPPONENT';
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
  rarity?: CardRarity;
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

export interface BattleScreenProps {
  mode: GameMode;
  playerDeck: CustomDeck;
  preferredOpponentClass?: HeroClass;
  preferredBoardTheme?: BoardThemeId;
  onOpenOptions: (concedeHandler: () => void) => void;
  onExitBattle: () => void;
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
  | { kind: 'TRACKING_CARD'; cardId: string; index?: number }
  | { kind: 'BOARD_MINION'; minion: MinionInstance; isFriendly: boolean }
  | { kind: 'HISTORY_ITEM'; item: ActionHistoryItem };

interface HandDragState {
  handUid: string;
  cardId: string;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
  isDragging: boolean;
  needsTarget: boolean;
  isMinion: boolean;
  hasChooseOne: boolean;
}

interface AttackerDragState {
  sourceKind: 'ATTACKER' | 'HERO_POWER';
  sourceId: string;
  validTargets: string[];
  startX: number;
  startY: number;
  isDragging: boolean;
}

const BOARD_BG_URL: Record<BoardThemeId, string> = {
  STORMWIND: '/stone-assets/ui/board_stormwind.webp',
  ORGRIMMAR: '/stone-assets/ui/board_orgrimmar.webp',
  PANDARIA: '/stone-assets/ui/board_pandaria.webp',
};

/**
 * Pixel-exact socket geometry measured from `/stone-assets/ui/board_*.webp`
 * (`board_stormwind.webp`: 1110x700, `board_orgrimmar.webp`: 1600x925, `board_pandaria.webp`: 1600x931)
 * Guarantees the interactive 3-state End Turn lever 100% covers the painted English "END TURN" socket
 * and seats both Heroes, Minion Rows, History Rail, and Deck Stacks into their carved stone recesses.
 */
const BOARD_GEOMETRY: Record<
  BoardThemeId,
  {
    ratio: number;
    endTurnX: number;
    endTurnY: number;
    oppHeroY: number;
    playerHeroY: number;
    oppRowY: number;
    crackY: number;
    playerRowY: number;
    historyX: number;
    deckX: number;
    manaRight: number;
    manaBottom: number;
  }
> = {
  STORMWIND: {
    ratio: 1110 / 700,
    endTurnX: 83.7,
    endTurnY: 45.4,
    oppHeroY: 17.2,
    playerHeroY: 75.8,
    oppRowY: 33.2,
    crackY: 45.5,
    playerRowY: 57.6,
    historyX: 11.8,
    deckX: 88.3,
    manaRight: 14.2,
    manaBottom: 1.8,
  },
  ORGRIMMAR: {
    ratio: 1600 / 925,
    endTurnX: 81.4,
    endTurnY: 45.9,
    oppHeroY: 17.3,
    playerHeroY: 76.2,
    oppRowY: 33.4,
    crackY: 45.9,
    playerRowY: 57.8,
    historyX: 12.6,
    deckX: 86.4,
    manaRight: 14.5,
    manaBottom: 1.8,
  },
  PANDARIA: {
    ratio: 1600 / 931,
    endTurnX: 81.7,
    endTurnY: 45.7,
    oppHeroY: 17.3,
    playerHeroY: 76.2,
    oppRowY: 33.4,
    crackY: 45.7,
    playerRowY: 57.8,
    historyX: 12.5,
    deckX: 86.6,
    manaRight: 14.5,
    manaBottom: 1.8,
  },
};

const BOARD_CORNER_TOYS: Record<
  BoardThemeId,
  {
    pos: 'TL' | 'TR' | 'BL' | 'BR';
    name: string;
    badge: string;
    vfxKind: VfxKind;
    reaction: string;
  }[]
> = {
  STORMWIND: [
    { pos: 'TL', name: '스톰윈드 대성당 종탑', badge: '🔔', vfxKind: 'TOY_BELL', reaction: '땡~ 땡~! 스톰윈드 대성당 종이 맑게 울려 퍼집니다!' },
    { pos: 'TR', name: '그리폰 둥지', badge: '🦅', vfxKind: 'TOY_SPARKS', reaction: '끼룩! 그리폰이 마우스 커서를 날카롭게 쪼았습니다!' },
    { pos: 'BL', name: '드워프 대장간', badge: '⚒', vfxKind: 'TOY_SPARKS', reaction: '깡! 깡! 달궈진 대장간 모루에서 불꽃이 튱니다!' },
    { pos: 'BR', name: '마을 우물', badge: '🪣', vfxKind: 'TOY_SPLASH', reaction: '첨벙! 우물 속에서 시원한 물보라와 동전이 반짝입니다!' },
  ],
  ORGRIMMAR: [
    { pos: 'TL', name: '공성 투석기', badge: '☄', vfxKind: 'TOY_CATAPULT', reaction: '부우웅— 쾅!! 투석기 바위가 전장 너머로 발사됩니다!' },
    { pos: 'TR', name: '고블린 비행선', badge: '⚙', vfxKind: 'TOY_BELL', reaction: '뿌우우—! 고블린 제플린 비행선 경적이 울립니다!' },
    { pos: 'BL', name: '전쟁 용광로', badge: '🔥', vfxKind: 'TOY_SPARKS', reaction: '화르륵! 오그리마 전쟁 용광로 불길이 거세게 타오릅니다!' },
    { pos: 'BR', name: '전쟁 북', badge: '🥁', vfxKind: 'TOY_DRUM', reaction: '둥! 둥! 록타르 오가르 전쟁 북소리가 대지를 울립니다!' },
  ],
  PANDARIA: [
    { pos: 'TL', name: '옥룡사 징', badge: '🔔', vfxKind: 'TOY_BELL', reaction: '징~~~! 고요한 판다리아 계곡에 황금 징 울림이 퍼집니다!' },
    { pos: 'TR', name: '비취 물레방아', badge: '💧', vfxKind: 'TOY_SPLASH', reaction: '쏴아아~ 비취 물레방아에서 맑은 폭포수가 쏟아집니다!' },
    { pos: 'BL', name: '농장 순무 밭', badge: '🌱', vfxKind: 'TOY_RADISH', reaction: '쑥! 판다리아 텃밭에서 탐스러운 순무를 뽑았습니다!' },
    { pos: 'BR', name: '바람 연', badge: '🪁', vfxKind: 'TOY_SPARKS', reaction: '펄럭~ 오색 바람 연이 구름 위로 높이 솟아오릅니다!' },
  ],
};

const BOARD_CORNER_TOYS_EN: Record<
  BoardThemeId,
  {
    pos: 'TL' | 'TR' | 'BL' | 'BR';
    name: string;
    badge: string;
    vfxKind: VfxKind;
    reaction: string;
  }[]
> = {
  STORMWIND: [
    { pos: 'TL', name: 'Cathedral Bell', badge: '🔔', vfxKind: 'TOY_BELL', reaction: 'Ding~ Dong~! The Stormwind Cathedral bell rings clearly!' },
    { pos: 'TR', name: 'Gryphon Roost', badge: '🦅', vfxKind: 'TOY_SPARKS', reaction: 'Screech! The Stormwind Gryphon pecks curiously at your cursor!' },
    { pos: 'BL', name: 'Dwarven Forge', badge: '⚒', vfxKind: 'TOY_SPARKS', reaction: 'Clang! Sparks fly from the glowing Dwarven anvil!' },
    { pos: 'BR', name: 'Town Well', badge: '🪣', vfxKind: 'TOY_SPLASH', reaction: 'Splash! Cool water and golden coins shimmer inside the well!' },
  ],
  ORGRIMMAR: [
    { pos: 'TL', name: 'Siege Catapult', badge: '☄', vfxKind: 'TOY_CATAPULT', reaction: 'Whoosh— BOOM!! A boulder streaks across the Orgrimmar battlefield!' },
    { pos: 'TR', name: 'Goblin Zeppelin', badge: '⚙', vfxKind: 'TOY_BELL', reaction: 'Toot-toot! The Goblin Zeppelin blasts its brass horn!' },
    { pos: 'BL', name: 'War Forge', badge: '🔥', vfxKind: 'TOY_SPARKS', reaction: 'Roar! Flames surge inside the Orgrimmar War Forge!' },
    { pos: 'BR', name: 'War Drum', badge: '🥁', vfxKind: 'TOY_DRUM', reaction: "Boom! Boom! Lok'tar Ogar! The war drums shake the earth!" },
  ],
  PANDARIA: [
    { pos: 'TL', name: 'Temple Gong', badge: '🔔', vfxKind: 'TOY_BELL', reaction: 'Gooong~~~! A resonant chime echoes across the Pandaria valley!' },
    { pos: 'TR', name: 'Jade Waterwheel', badge: '💧', vfxKind: 'TOY_SPLASH', reaction: 'Swoosh~ Crystal waterfall splashes over the jade waterwheel!' },
    { pos: 'BL', name: 'Garden Turnips', badge: '🌱', vfxKind: 'TOY_RADISH', reaction: 'Pluck! You pulled a fresh turnip straight from the Pandaria garden!' },
    { pos: 'BR', name: 'Wind Kite', badge: '🪁', vfxKind: 'TOY_SPARKS', reaction: 'Flutter~ A colorful kite soars high above the Pandaria clouds!' },
  ],
};

const CARD_BACK_MAP: Record<string, string> = {
  classic: '/stone-assets/ui/cardback_classic.webp',
  legend: '/stone-assets/ui/cardback_legend.webp',
  frost: '/stone-assets/ui/cardback_frost.webp',
  gold: '/stone-assets/ui/cardback_gold.webp',
};

function computeViewportFlags() {
  if (typeof window === 'undefined') {
    return { isCompactMobile: false, isDesktopStage: true };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    isCompactMobile: w < 640,
    isDesktopStage: w >= 820 && h >= 520 && w / Math.max(1, h) >= 1.15,
  };
}

export const BattleScreen: React.FC<BattleScreenProps> = ({
  mode,
  playerDeck,
  preferredOpponentClass,
  preferredBoardTheme,
  onOpenOptions,
  onExitBattle,
}) => {
  const { lang, isKo, tr } = useHeroLanguage();
  const [matchState, setMatchState] = useState<BattleMatchState>(() => {
    const opp = buildAiOpponentSetup(mode, preferredOpponentClass);
    return createBattleMatch({
      mode,
      playerName: tr('여관 도전자', 'Challenger'),
      playerClass: playerDeck.heroClass,
      playerDeck: playerDeck.cards,
      opponentName: opp.opponentName,
      opponentClass: opp.opponentClass,
      opponentDeck: opp.opponentDeck,
      boardTheme: preferredBoardTheme,
    });
  });

  const [vsIntroActive, setVsIntroActive] = useState(true);
  const [selection, setSelection] = useState<PendingSelection | null>(null);
  const [zoomState, setZoomState] = useState<BattleZoomState | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [{ isCompactMobile, isDesktopStage }, setViewportFlags] = useState(computeViewportFlags);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [insertPreviewIdx, setInsertPreviewIdx] = useState<number>(0);

  const [handDrag, setHandDrag] = useState<HandDragState | null>(null);
  const [hoveredHandCost, setHoveredHandCost] = useState<number | null>(null);
  const [newlyDrawnUids, setNewlyDrawnUids] = useState<Set<string>>(() => new Set());
  const [mulliganSwapping, setMulliganSwapping] = useState(false);
  const [coinGiftShowcase, setCoinGiftShowcase] = useState(false);
  const [playedCardShowcase, setPlayedCardShowcase] = useState<{
    id: string;
    showcaseType: 'CARD' | 'SECRET_HIDDEN' | 'SECRET_TRIGGER' | 'FATIGUE' | 'MILL_BURN';
    cardId: string;
    actorSide: 'PLAYER' | 'OPPONENT';
    actorClass: HeroClass;
    actorName: string;
    detail: string;
    fatigueDamage?: number;
  } | null>(null);

  const [hoveredBoardMinion, setHoveredBoardMinion] = useState<MinionInstance | null>(null);
  const [hoveredHistoryItem, setHoveredHistoryItem] = useState<ActionHistoryItem | null>(null);
  const [emoteMenuOpen, setEmoteMenuOpen] = useState(false);
  const [opponentSquelched, setOpponentSquelched] = useState(false);
  const [squelchMenuOpen, setSquelchMenuOpen] = useState(false);
  const [playerEmoteText, setPlayerEmoteText] = useState<string | null>(null);
  const [opponentEmoteText, setOpponentEmoteText] = useState<string | null>(null);
  const [toyToast, setToyToast] = useState<string | null>(null);
  const [activeToyPos, setActiveToyPos] = useState<'TL' | 'TR' | 'BL' | 'BR' | null>(null);
  const [localVfxQueue, setLocalVfxQueue] = useState<VfxEvent[]>([]);
  const [deckTooltipSide, setDeckTooltipSide] = useState<'PLAYER' | 'OPPONENT' | null>(null);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);
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
    durationMs: 220,
  });
  const [attackAnim, setAttackAnim] = useState<PhysicalAttackAnimState | null>(null);
  const [aiHighlightText, setAiHighlightText] = useState<string | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState<{
    goldEarned: number;
    prevRank: number;
    newRank: number;
    newStars: number;
    streakBonus: boolean;
  } | null>(null);

  const friendlyRowRef = useRef<HTMLDivElement | null>(null);
  const recordedResultRef = useRef(false);
  const matchStateRef = useRef(matchState);
  matchStateRef.current = matchState;
  const handDragRef = useRef<HandDragState | null>(null);
  handDragRef.current = handDrag;
  const attackerDragRef = useRef<AttackerDragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const knownHandUidsRef = useRef<Set<string>>(
    new Set(matchState.player.hand.map((h) => h.uid)),
  );
  const lastShowcasedHistoryIdRef = useRef<string | null>(null);

  const shakeTimerRef = useRef<number | null>(null);
  const activeShakeRef = useRef<{ until: number; strength: number }>({ until: 0, strength: 0 });
  const attackLockRef = useRef(false);
  const attackSeqRef = useRef(0);
  const attackTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('hs-dragging-active');
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
      attackTimersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const liveHoveredBoardMinion = useMemo(() => {
    if (!hoveredBoardMinion || matchState.phase !== 'PLAYING') return null;
    return (
      matchState.player.board.find((m) => m.uid === hoveredBoardMinion.uid) ||
      matchState.opponent.board.find((m) => m.uid === hoveredBoardMinion.uid) ||
      null
    );
  }, [hoveredBoardMinion, matchState.phase, matchState.player.board, matchState.opponent.board]);

  useEffect(() => {
    if (hoveredBoardMinion && !liveHoveredBoardMinion) {
      setHoveredBoardMinion(null);
    }
  }, [hoveredBoardMinion, liveHoveredBoardMinion]);

  useEffect(() => {
    if (matchState.phase === 'GAME_OVER' && autoPlay) {
      setAutoPlay(false);
    }
  }, [matchState.phase, autoPlay]);

  // Track newly drawn cards in Player's hand for deck -> hand flight animation!
  useEffect(() => {
    const currentUids = matchState.player.hand.map((h) => h.uid);
    if (matchState.phase !== 'PLAYING') {
      knownHandUidsRef.current = new Set(currentUids);
      return;
    }
    const fresh: string[] = [];
    for (const uid of currentUids) {
      if (!knownHandUidsRef.current.has(uid)) {
        fresh.push(uid);
        knownHandUidsRef.current.add(uid);
      }
    }
    if (fresh.length > 0) {
      hsAudio.playSfx('card_flip', 0.68);
      setNewlyDrawnUids((prev) => {
        const next = new Set(prev);
        fresh.forEach((u) => next.add(u));
        return next;
      });
      const t = window.setTimeout(() => {
        setNewlyDrawnUids((prev) => {
          const next = new Set(prev);
          fresh.forEach((u) => next.delete(u));
          return next;
        });
      }, 620);
      return () => window.clearTimeout(t);
    }
  }, [matchState.phase, matchState.player.hand]);

  // Authentic Left-Side Big Card Showcase: Opponent Card Play, Hidden Secret, Secret Reveal, Fatigue, or Mill Burn!
  useEffect(() => {
    const latest = matchState.history[0];
    if (!latest || latest.id === lastShowcasedHistoryIdRef.current) return;
    lastShowcasedHistoryIdRef.current = latest.id;

    const actorName =
      latest.actorSide === 'OPPONENT'
        ? matchState.opponent.heroNameKo
        : matchState.player.heroNameKo;
    const actorClass =
      latest.actorSide === 'OPPONENT'
        ? matchState.opponent.heroClass
        : matchState.player.heroClass;

    let showcaseType:
      | 'CARD'
      | 'SECRET_HIDDEN'
      | 'SECRET_TRIGGER'
      | 'FATIGUE'
      | 'MILL_BURN'
      | null = null;

    if (latest.kind === 'FATIGUE') {
      showcaseType = 'FATIGUE';
    } else if (latest.kind === 'MILL_BURN' && cardDb.getCard(latest.cardId)) {
      showcaseType = 'MILL_BURN';
    } else if (latest.kind === 'SECRET_TRIGGER' && cardDb.getCard(latest.cardId)) {
      showcaseType = 'SECRET_TRIGGER';
    } else if (
      latest.actorSide === 'OPPONENT' &&
      (latest.kind === 'PLAY_MINION' ||
        latest.kind === 'CAST_SPELL' ||
        latest.kind === 'EQUIP_WEAPON')
    ) {
      if (latest.isHiddenSecret) {
        showcaseType = 'SECRET_HIDDEN';
      } else if (cardDb.getCard(latest.cardId)) {
        showcaseType = 'CARD';
      }
    }

    if (!showcaseType) return;

    const durationMs =
      showcaseType === 'FATIGUE' || showcaseType === 'MILL_BURN' ? 1650 : 1450;

    setPlayedCardShowcase({
      id: latest.id,
      showcaseType,
      cardId: latest.cardId,
      actorSide: latest.actorSide,
      actorClass,
      actorName,
      detail: latest.detail,
      fatigueDamage: latest.fatigueDamage,
    });
    const t = window.setTimeout(() => {
      setPlayedCardShowcase((prev) => (prev?.id === latest.id ? null : prev));
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [
    matchState.history,
    matchState.opponent.heroClass,
    matchState.opponent.heroNameKo,
    matchState.player.heroClass,
    matchState.player.heroNameKo,
  ]);

  const profile = useMemo(() => hsStorage.getProfile(), []);
  const backImg = CARD_BACK_MAP[profile.selectedCardBack] || CARD_BACK_MAP.classic;
  const geom = BOARD_GEOMETRY[matchState.boardTheme];

  const engine = useMemo(() => createEngine(matchState), [matchState]);
  const playerSpellPower = engine.getTotalSpellPower('PLAYER');
  const playerVelenMult = matchState.player.board.some(
    (m) => !m.silenced && m.cardId === 'EX1_350',
  )
    ? 2
    : 1;

  // Opening VS Clash + Korean Matchup Announcer
  useEffect(() => {
    hsAudio.playBgm('mulligan');
    hsAudio.playMatchupAnnouncement(matchState.player.heroClass, matchState.opponent.heroClass);
    const t1 = window.setTimeout(() => {
      setVsIntroActive(false);
      hsAudio.playHeroVo(matchState.opponent.heroClass, 'start');
    }, 2350);
    return () => clearTimeout(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear banner / error messages smoothly
  useEffect(() => {
    if (!matchState.bannerMessage) return;
    if (
      matchState.bannerMessage === '내 턴!' ||
      matchState.bannerMessage === '나의 턴' ||
      matchState.bannerMessage === 'YOUR TURN!'
    ) {
      hsAudio.playSfx('player_turn', 0.85);
      hsAudio.playProceduralVfxSound('MANA_GAIN');
    }
    const t = window.setTimeout(() => {
      setMatchState((s) => ({ ...s, bannerMessage: null }));
    }, 1400);
    return () => clearTimeout(t);
  }, [matchState.bannerMessage, matchState.turnNumber]);

  useEffect(() => {
    if (!matchState.errorBanner) return;
    const msg = matchState.errorBanner;
    if (msg.includes('마나') || msg.toLowerCase().includes('mana')) {
      hsAudio.playHeroVo(matchState.player.heroClass, 'error_mana');
    } else if (msg.includes('도발') || msg.toLowerCase().includes('taunt')) {
      hsAudio.playHeroVo(matchState.player.heroClass, 'error_taunt');
    } else if (msg.includes('공격') || msg.toLowerCase().includes('attack')) {
      hsAudio.playHeroVo(matchState.player.heroClass, 'error_attacked');
    }
    const t = window.setTimeout(() => {
      setMatchState((s) => ({ ...s, errorBanner: null }));
    }, 2100);
    return () => clearTimeout(t);
  }, [matchState.errorBanner, matchState.player.heroClass]);

  useEffect(() => {
    const onResize = () => setViewportFlags(computeViewportFlags());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Record match outcome & rewards once when GAME_OVER triggers
  useEffect(() => {
    if (matchState.phase === 'GAME_OVER' && !recordedResultRef.current) {
      recordedResultRef.current = true;
      setSelection(null);
      setZoomState(null);
      setHandDrag(null);
      document.body.classList.remove('hs-dragging-active');
      const didWin = matchState.winner === 'PLAYER';
      if (didWin) {
        hsAudio.playSfx('victory', 0.9);
        hsAudio.playHeroVo(matchState.opponent.heroClass, 'concede');
      } else {
        hsAudio.playHeroVo(matchState.player.heroClass, 'concede');
      }
      const summary = hsStorage.recordMatchOutcome(
        matchState.player.heroClass,
        didWin,
        mode === 'RANKED',
      );
      setOutcomeSummary(summary);
    }
  }, [
    matchState.phase,
    matchState.winner,
    matchState.player.heroClass,
    matchState.opponent.heroClass,
    mode,
  ]);

  // 75-second Turn Timer + 15-second Burning Rope Fuse!
  useEffect(() => {
    if (matchState.phase !== 'PLAYING' || matchState.activeSide !== 'PLAYER') return;
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
          setHandDrag(null);
          document.body.classList.remove('hs-dragging-active');
          const nextEng = createEngine(prev);
          hsAudio.playSfx('end_turn');
          return nextEng.endTurn();
        }
        return { ...prev, turnSecondsLeft: nextSec };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [matchState.phase, matchState.activeSide, matchState.turnNumber]);

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
      const rotDeg = 0;
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

  const triggerPhysicalAttack = useCallback(
    (side: 'PLAYER' | 'OPPONENT', attackerId: string, defenderId: string): boolean => {
      if (attackLockRef.current) return false;
      const current = matchStateRef.current;
      if (current.phase !== 'PLAYING') return false;

      const atkPlayer = side === 'PLAYER' ? current.player : current.opponent;
      const enemySide = side === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
      const defPlayer = enemySide === 'PLAYER' ? current.player : current.opponent;

      const isHeroAttacker = attackerId === 'PLAYER_HERO' || attackerId === 'OPPONENT_HERO';
      const isHeroDefender = defenderId === 'PLAYER_HERO' || defenderId === 'OPPONENT_HERO';

      const atkMinion = isHeroAttacker
        ? null
        : atkPlayer.board.find((m) => m.uid === attackerId) || null;
      if (!isHeroAttacker && !atkMinion) return false;

      const defMinion = isHeroDefender
        ? null
        : defPlayer.board.find((m) => m.uid === defenderId) || null;
      if (!isHeroDefender && !defMinion) return false;

      const w = window.innerWidth || 1280;
      const h = window.innerHeight || 720;
      const atkEl = document.querySelector(`[data-hs-entity="${attackerId}"]`);
      const defEl = document.querySelector(`[data-hs-entity="${defenderId}"]`);

      const startPos = atkEl
        ? (() => {
            const r = atkEl.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })()
        : {
            x: w * 0.5,
            y: side === 'PLAYER' ? h * 0.6 : h * 0.34,
          };
      const targetPos = defEl
        ? (() => {
            const r = defEl.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })()
        : {
            x: w * 0.5,
            y: enemySide === 'PLAYER' ? h * 0.78 : h * 0.18,
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
        !isHeroAttacker && !atkMinion!.divineShield && counterDmg >= healthVal;

      const minionDef = atkMinion ? cardDb.mustGetCard(atkMinion.cardId) : null;
      const artUrl = isHeroAttacker
        ? getHeroArtUrl(atkPlayer.isJaraxxus ? 'EX1_323h' : atkPlayer.heroId)
        : getCardArtUrl(minionDef!.artId);
      const nameKo = isHeroAttacker
        ? atkPlayer.isJaraxxus
          ? tr('군주 자락서스', 'LORD JARAXXUS')
          : getLocalizedHeroInfo(atkPlayer.heroClass, lang).name
        : getCardName(cardDb.mustGetCard(atkMinion!.cardId), lang);
      const defNameKo = isHeroDefender
        ? defPlayer.isJaraxxus
          ? tr('군주 자락서스', 'LORD JARAXXUS')
          : getLocalizedHeroInfo(defPlayer.heroClass, lang).name
        : getCardName(cardDb.mustGetCard(defMinion!.cardId), lang);
      const frameGradient = CLASSIC_HEROES[atkPlayer.heroClass].frameGradient;

      attackLockRef.current = true;
      attackSeqRef.current += 1;
      const animId = attackSeqRef.current;

      setAiHighlightText(
        tr(
          `${side === 'PLAYER' ? '⚔ 아군 공격' : '💥 상대 공격'}: [${nameKo}](${attackVal}) ➔ [${defNameKo}]!`,
          `${side === 'PLAYER' ? '⚔ Attack' : '💥 Enemy Attack'}: [${nameKo}](${attackVal}) ➔ [${defNameKo}]!`,
        ),
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
        try {
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
        } finally {
          setAttackAnim((prev) =>
            prev && prev.id === animId ? { ...prev, phase: 'IMPACT_RETURN' } : prev,
          );
        }
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
      return true;
    },
    [triggerDamageImpact],
  );

  // Play an untargeted or targeted card
  const executePlayPlayerCard = useCallback(
    (
      handUid: string,
      opts?: { targetId?: string; insertIndex?: number; chooseOptionIndex?: 0 | 1 },
    ) => {
      const current = matchStateRef.current;
      const hc = current.player.hand.find((h) => h.uid === handUid);
      if (!hc) return;
      const def = cardDb.mustGetCard(hc.cardId);
      hsAudio.playSfx('card_place', 0.9);
      const eng = createEngine(current);
      const next = eng.playCardFromHand('PLAYER', handUid, opts);
      if (next.chooseOnePrompt === null && !next.errorBanner) {
        if (def.type === 'MINION') hsStorage.recordQuestProgress('MINION', 1);
        else if (def.type === 'SPELL') hsStorage.recordQuestProgress('SPELL', 1);
      }
      setSelection(null);
      setHoveredHandCost(null);
      setMatchState(next);
    },
    [],
  );

  // Pure Gameplay Action Signature (Ignores 1s rope ticks, banner fades, and VFX array churn so AI/Auto-Play timers are NEVER cancelled mid-step!)
  const actionStateKey = useMemo(() => {
    const p = matchState.player;
    const o = matchState.opponent;
    const serializeSide = (s: typeof p) =>
      [
        s.mana,
        s.maxMana,
        s.health,
        s.armor,
        s.tempAttack,
        s.attacksMadeThisTurn,
        s.heroPowerUsedThisTurn ? 1 : 0,
        s.frozen ? 1 : 0,
        s.weapon ? `${s.weapon.cardId}:${s.weapon.attack}:${s.weapon.durability}` : '',
        s.secrets.length,
        s.hand.map((h) => `${h.uid}:${h.costMod}`).join(','),
        s.board
          .map(
            (m) =>
              `${m.uid}:${m.attacksMadeThisTurn}:${m.permAttack}:${m.tempAttack}:${m.health}:${m.divineShield ? 1 : 0}:${m.frozen ? 1 : 0}:${m.stealth ? 1 : 0}:${m.taunt ? 1 : 0}`,
          )
          .join(','),
      ].join(';');

    return [
      matchState.matchId,
      matchState.phase,
      matchState.activeSide,
      matchState.turnNumber,
      matchState.history.length,
      matchState.history[0]?.id || '',
      matchState.chooseOnePrompt ? 1 : 0,
      matchState.trackingPrompt ? 1 : 0,
      serializeSide(p),
      serializeSide(o),
    ].join('|');
  }, [matchState]);

  // Step-by-Step Opponent AI Turn Execution Loop (Immune to timer-tick cancellation & attackLock deadlocks!)
  useEffect(() => {
    const cur = matchStateRef.current;
    if (
      vsIntroActive ||
      mulliganSwapping ||
      cur.phase !== 'PLAYING' ||
      cur.activeSide !== 'OPPONENT'
    ) {
      if (cur.activeSide !== 'PLAYER' && !attackAnim) setAiHighlightText(null);
      return;
    }
    if (attackAnim || attackLockRef.current) return;

    const difficulty = mode === 'PRACTICE_NORMAL' || mode === 'TUTORIAL' ? 'NORMAL' : 'EXPERT';
    const timer = window.setTimeout(() => {
      if (attackLockRef.current) return;
      const snap = matchStateRef.current;
      if (snap.phase !== 'PLAYING' || snap.activeSide !== 'OPPONENT') return;

      const action: AiAction = computeNextAiAction(snap, difficulty, 'OPPONENT');
      const sim = createEngine(snap);

      if (action.kind === 'PLAY_CARD') {
        const def = cardDb.mustGetCard(action.cardId);
        const defName = getCardName(def, lang);
        const oppHeroName = snap.opponent.isJaraxxus
          ? tr('군주 자락서스', 'LORD JARAXXUS')
          : getLocalizedHeroInfo(snap.opponent.heroClass, lang).name;
        hsAudio.playSfx('card_place', 0.85);
        setAiHighlightText(
          def.mechanics.includes('SECRET')
            ? tr(`${oppHeroName}: [? 비밀] 시전!`, `${oppHeroName}: Played a Secret!`)
            : tr(`${oppHeroName}: [${defName}] 사용!`, `${oppHeroName}: Played [${defName}]!`),
        );
        const next = sim.playCardFromHand('OPPONENT', action.handUid, {
          targetId: action.targetId,
          insertIndex: action.insertIndex,
          chooseOptionIndex: action.chooseOptionIndex,
        });
        if (next.errorBanner || next.history.length <= snap.history.length) {
          setAiHighlightText(null);
          setMatchState(createEngine(snap).endTurn());
          return;
        }
        setMatchState(next);
      } else if (action.kind === 'HERO_POWER') {
        const oppHeroInfo = getLocalizedHeroInfo(snap.opponent.heroClass, lang);
        const oppHeroName = snap.opponent.isJaraxxus
          ? tr('군주 자락서스', 'LORD JARAXXUS')
          : oppHeroInfo.name;
        const oppHpName =
          snap.opponent.heroPowerId === 'EX1_tk33'
            ? tr('지옥불!', 'INFERNO!')
            : oppHeroInfo.heroPowerName;
        hsAudio.playSfx('hero_power', 0.85);
        setAiHighlightText(
          tr(`${oppHeroName}: 영웅 능력 [${oppHpName}]!`, `${oppHeroName}: Hero Power [${oppHpName}]!`),
        );
        const next = sim.useHeroPower('OPPONENT', action.targetId);
        if (next.errorBanner || next.history.length <= snap.history.length) {
          setAiHighlightText(null);
          setMatchState(createEngine(snap).endTurn());
          return;
        }
        setMatchState(next);
      } else if (action.kind === 'ATTACK') {
        const started = triggerPhysicalAttack('OPPONENT', action.attackerId, action.defenderId);
        if (!started) {
          setAiHighlightText(null);
          setMatchState(sim.endTurn());
        }
      } else {
        hsAudio.playSfx('end_turn', 0.85);
        setAiHighlightText(null);
        setMatchState(sim.endTurn());
      }
    }, 820);

    return () => window.clearTimeout(timer);
  }, [actionStateKey, mode, attackAnim, vsIntroActive, mulliganSwapping, triggerPhysicalAttack]);

  // Step-by-Step Player Auto-Play Loop (when autoPlay === true)
  useEffect(() => {
    const cur = matchStateRef.current;
    if (!autoPlay || vsIntroActive || mulliganSwapping) return;
    if (cur.phase === 'GAME_OVER') return;
    if (attackAnim || attackLockRef.current) return;

    // 1. Auto-Mulligan: swap cards costing >= 4 and begin duel!
    if (cur.phase === 'MULLIGAN') {
      const t = window.setTimeout(() => {
        const snap = matchStateRef.current;
        if (snap.phase !== 'MULLIGAN') return;
        const replaceUids = snap.player.hand
          .filter((hc) => cardDb.mustGetCard(hc.cardId).cost >= 4)
          .map((hc) => hc.uid);
        hsAudio.playSfx('box_press', 0.8);
        hsAudio.playBgm(Math.random() < 0.5 ? 'duel_1' : 'duel_2');
        if (snap.firstPlayer === 'OPPONENT') {
          hsAudio.playInnkeeper('coin');
          setCoinGiftShowcase(true);
          window.setTimeout(() => setCoinGiftShowcase(false), 1750);
        }
        const sim = createEngine(snap);
        setMatchState(sim.confirmMulligan(replaceUids));
      }, 520);
      return () => window.clearTimeout(t);
    }

    if (cur.phase !== 'PLAYING' || cur.activeSide !== 'PLAYER') return;
    if (zoomState) return;
    if (selection) setSelection(null);

    const timer = window.setTimeout(() => {
      if (attackLockRef.current) return;
      const snap = matchStateRef.current;
      if (snap.phase !== 'PLAYING' || snap.activeSide !== 'PLAYER') return;
      const sim = createEngine(snap);

      // Resolve pending Druid Choose-One prompt automatically
      if (snap.chooseOnePrompt) {
        const prompt = snap.chooseOnePrompt;
        const viableOpt =
          prompt.options.find((o) => !o.needsTarget || o.validTargets.length > 0) ||
          prompt.options[0];
        const targetId = viableOpt.needsTarget ? viableOpt.validTargets[0] : undefined;
        hsAudio.playSfx('card_place', 0.8);
        const next = sim.playCardFromHand('PLAYER', prompt.sourceHandUid, {
          chooseOptionIndex: viableOpt.index,
          insertIndex: prompt.insertIndex,
          targetId,
        });
        if (next.errorBanner) {
          setMatchState({ ...snap, chooseOnePrompt: null, errorBanner: null });
          return;
        }
        setMatchState(next);
        return;
      }

      // Resolve pending Hunter Tracking prompt automatically
      if (snap.trackingPrompt) {
        const pickId = snap.trackingPrompt.cards[0];
        hsAudio.playSfx('card_place', 0.8);
        setMatchState(sim.resolveTrackingChoice(pickId));
        return;
      }

      const action: AiAction = computeNextAiAction(snap, 'EXPERT', 'PLAYER');

      if (action.kind === 'PLAY_CARD') {
        const def = cardDb.mustGetCard(action.cardId);
        hsAudio.playSfx('card_place', 0.85);
        setAiHighlightText(
          tr(`⚡ 자동플레이: [${getCardName(def, lang)}] 사용!`, `⚡ Auto-Play: Played [${getCardName(def, lang)}]!`),
        );
        const next = sim.playCardFromHand('PLAYER', action.handUid, {
          targetId: action.targetId,
          insertIndex: action.insertIndex,
          chooseOptionIndex: action.chooseOptionIndex,
        });
        if (
          next.errorBanner ||
          (next.history.length <= snap.history.length &&
            !next.chooseOnePrompt &&
            !next.trackingPrompt)
        ) {
          setAiHighlightText(null);
          setMatchState(createEngine(snap).endTurn());
          return;
        }
        if (next.chooseOnePrompt === null) {
          if (def.type === 'MINION') hsStorage.recordQuestProgress('MINION', 1);
          else if (def.type === 'SPELL') hsStorage.recordQuestProgress('SPELL', 1);
        }
        setMatchState(next);
      } else if (action.kind === 'HERO_POWER') {
        hsAudio.playSfx('hero_power', 0.85);
        const pHpName =
          snap.player.heroPowerId === 'EX1_tk33'
            ? tr('지옥불!', 'INFERNO!')
            : getLocalizedHeroInfo(snap.player.heroClass, lang).heroPowerName;
        setAiHighlightText(
          tr(`⚡ 자동플레이: 영웅 능력 [${pHpName}]!`, `⚡ Auto-Play: Hero Power [${pHpName}]!`),
        );
        const next = sim.useHeroPower('PLAYER', action.targetId);
        if (next.errorBanner || next.history.length <= snap.history.length) {
          setAiHighlightText(null);
          setMatchState(createEngine(snap).endTurn());
          return;
        }
        setMatchState(next);
      } else if (action.kind === 'ATTACK') {
        const started = triggerPhysicalAttack('PLAYER', action.attackerId, action.defenderId);
        if (!started) {
          setAiHighlightText(null);
          setMatchState(sim.endTurn());
        }
      } else {
        hsAudio.playSfx('end_turn', 0.85);
        setAiHighlightText(null);
        setMatchState(sim.endTurn());
      }
    }, 580);

    return () => window.clearTimeout(timer);
  }, [
    autoPlay,
    vsIntroActive,
    mulliganSwapping,
    actionStateKey,
    selection,
    zoomState,
    attackAnim,
    triggerPhysicalAttack,
  ]);

  const updateFriendlyInsertIndex = useCallback((clientX: number) => {
    if (!friendlyRowRef.current) return 0;
    const children = Array.from(
      friendlyRowRef.current.querySelectorAll('[data-hs-entity]'),
    ) as HTMLElement[];
    let idx = children.length;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        idx = i;
        break;
      }
    }
    setInsertPreviewIdx(idx);
    return idx;
  }, []);

  // Unified Pointer Move, Drag-and-Drop Release & Escape Cancel
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });
      updateFriendlyInsertIndex(e.clientX);

      // 1. Hand Card Dragging
      const hd = handDragRef.current;
      if (hd) {
        const dist = Math.hypot(e.clientX - hd.startX, e.clientY - hd.startY);
        if (!hd.isDragging && dist > 14) {
          const cur = matchStateRef.current;
          const isTurn = cur.phase === 'PLAYING' && cur.activeSide === 'PLAYER';
          const hc = cur.player.hand.find((h) => h.uid === hd.handUid);
          if (!isTurn || !hc) {
            handDragRef.current = null;
            setHandDrag(null);
            return;
          }
          const eng = createEngine(cur);
          const check = eng.inspectPlayability('PLAYER', hc);
          if (!check.canPlay) {
            if (e.clientY < hd.startY - 18) {
              if (check.reason?.includes('마나') || check.reason?.toLowerCase().includes('mana')) {
                hsAudio.playHeroVo(cur.player.heroClass, 'error_mana');
              }
              setMatchState((s) => ({
                ...s,
                errorBanner: check.reason || tr('마나가 부족합니다!', 'Not enough Mana!'),
              }));
            }
            suppressNextClickRef.current = true;
            handDragRef.current = null;
            setHandDrag(null);
            return;
          }

          document.body.classList.add('hs-dragging-active');
          hsAudio.playSfx('card_hover', 0.72);
          const nextHd: HandDragState = {
            ...hd,
            curX: e.clientX,
            curY: e.clientY,
            isDragging: true,
          };
          handDragRef.current = nextHd;
          setHandDrag(nextHd);

          if (check.needsTarget && !check.hasChooseOne) {
            setSelection({
              kind: 'HAND_CARD',
              handUid: hc.uid,
              cardId: hc.cardId,
              needsTarget: true,
              validTargets: check.validTargets,
              isMinion: hd.isMinion,
              hasChooseOne: false,
            });
          } else {
            setSelection(null);
          }
        } else if (hd.isDragging) {
          const nextHd = { ...hd, curX: e.clientX, curY: e.clientY };
          handDragRef.current = nextHd;
          setHandDrag(nextHd);
        }
      }

      // 2. Friendly Minion / Hero / Hero Power Drag-Targeting
      const ad = attackerDragRef.current;
      if (ad && !ad.isDragging) {
        const dist = Math.hypot(e.clientX - ad.startX, e.clientY - ad.startY);
        if (dist > 12) {
          ad.isDragging = true;
          document.body.classList.add('hs-dragging-active');
          hsAudio.playSfx('ui_click', 0.72);
          if (ad.sourceKind === 'ATTACKER') {
            setSelection({
              kind: 'ATTACKER',
              attackerId: ad.sourceId,
              validTargets: ad.validTargets,
            });
          } else {
            setSelection({
              kind: 'HERO_POWER',
              validTargets: ad.validTargets,
            });
          }
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      // 1. Finish Hand Card Drag
      const hd = handDragRef.current;
      if (hd) {
        handDragRef.current = null;
        setHandDrag(null);
        document.body.classList.remove('hs-dragging-active');

        if (hd.isDragging) {
          suppressNextClickRef.current = true;
          window.setTimeout(() => {
            suppressNextClickRef.current = false;
          }, 80);

          const cur = matchStateRef.current;
          const hc = cur.player.hand.find((h) => h.uid === hd.handUid);
          if (!hc || cur.phase !== 'PLAYING' || cur.activeSide !== 'PLAYER') {
            setSelection(null);
            return;
          }
          const eng = createEngine(cur);
          const check = eng.inspectPlayability('PLAYER', hc);
          if (!check.canPlay) {
            setSelection(null);
            return;
          }

          const handDropFloorY = window.innerHeight * 0.77;
          if (check.needsTarget && !check.hasChooseOne) {
            const hitEl = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest('[data-hs-entity]') as HTMLElement | null;
            const targetId = hitEl?.getAttribute('data-hs-entity') || null;
            if (targetId && check.validTargets.includes(targetId)) {
              executePlayPlayerCard(hd.handUid, {
                targetId,
                insertIndex: cur.player.board.length,
              });
            } else if (e.clientY > handDropFloorY) {
              setSelection(null);
            }
            return;
          }

          // Untargeted Minion / Spell / Weapon / Secret / Choose One dropped on board!
          if (e.clientY <= handDropFloorY) {
            const dropIdx = updateFriendlyInsertIndex(e.clientX);
            executePlayPlayerCard(hd.handUid, {
              insertIndex: hd.isMinion ? dropIdx : cur.player.board.length,
            });
          } else {
            setSelection(null);
          }
          return;
        }
      }

      // 2. Finish Attacker / Hero Power Drag
      const ad = attackerDragRef.current;
      if (ad) {
        attackerDragRef.current = null;
        document.body.classList.remove('hs-dragging-active');
        if (ad.isDragging) {
          suppressNextClickRef.current = true;
          window.setTimeout(() => {
            suppressNextClickRef.current = false;
          }, 80);

          const hitEl = document
            .elementFromPoint(e.clientX, e.clientY)
            ?.closest('[data-hs-entity]') as HTMLElement | null;
          const targetId = hitEl?.getAttribute('data-hs-entity') || null;
          const cur = matchStateRef.current;

          if (targetId && targetId !== ad.sourceId && ad.validTargets.includes(targetId)) {
            setSelection(null);
            if (ad.sourceKind === 'ATTACKER') {
              if (ad.sourceId === 'PLAYER_HERO') {
                hsAudio.playHeroVo(cur.player.heroClass, 'attack');
              }
              triggerPhysicalAttack('PLAYER', ad.sourceId, targetId);
            } else {
              hsAudio.playSfx('hero_power', 0.9);
              const eng = createEngine(cur);
              setMatchState(eng.useHeroPower('PLAYER', targetId));
            }
          } else {
            if (
              ad.sourceKind === 'ATTACKER' &&
              targetId &&
              targetId !== ad.sourceId &&
              !ad.validTargets.includes(targetId)
            ) {
              const enemyHasTaunt = cur.opponent.board.some(
                (m) => !m.stealth && (m.taunt || m.auraTaunt),
              );
              if (enemyHasTaunt) {
                hsAudio.playHeroVo(cur.player.heroClass, 'error_taunt');
                setMatchState((s) => ({
                  ...s,
                  errorBanner: '도발 능력이 있는 하수인이 가로막고 있습니다!',
                }));
              }
            }
            setSelection(null);
          }
        }
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelection(null);
        setHandDrag(null);
        handDragRef.current = null;
        attackerDragRef.current = null;
        document.body.classList.remove('hs-dragging-active');
        setEmoteMenuOpen(false);
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [executePlayPlayerCard, triggerPhysicalAttack, updateFriendlyInsertIndex]);

  const handleConcede = useCallback(() => {
    if (matchState.phase === 'GAME_OVER') return;
    const eng = createEngine(matchState);
    setMatchState(eng.concede('PLAYER'));
  }, [matchState]);

  // Toggle Mulligan Card Selection (1-Click authentic Hearthstone stamp!)
  const toggleMulliganCard = (uid: string) => {
    hsAudio.playSfx('card_flip', 0.75);
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
    if (mulliganSwapping) return;
    hsAudio.playSfx('box_press');
    hsAudio.playBgm(Math.random() < 0.5 ? 'duel_1' : 'duel_2');

    const selectedToSwap = [...matchState.mulliganSelectedUids];
    const keptUids = matchState.player.hand
      .filter((h) => !selectedToSwap.includes(h.uid))
      .map((h) => h.uid);

    const finalizeMulligan = () => {
      const goingSecond = matchState.firstPlayer === 'OPPONENT';
      if (goingSecond) {
        hsAudio.playInnkeeper('coin');
        setCoinGiftShowcase(true);
        window.setTimeout(() => setCoinGiftShowcase(false), 1750);
      }
      // Keep only un-swapped cards in knownHandUidsRef so newly drawn replacement cards + Coin fly in!
      knownHandUidsRef.current = new Set(keptUids);
      const eng = createEngine(matchStateRef.current);
      const next = eng.confirmMulligan(selectedToSwap);
      setMulliganSwapping(false);
      setMatchState(next);
    };

    if (selectedToSwap.length > 0) {
      setMulliganSwapping(true);
      hsAudio.playSfx('card_flip', 0.85);
      window.setTimeout(finalizeMulligan, 420);
    } else {
      finalizeMulligan();
    }
  };

  // Click a card in Player's Hand -> Select & Enlarge Card (when not dragged)
  const handleHandCardClick = (handUid: string) => {
    if (suppressNextClickRef.current) return;
    if (matchState.phase !== 'PLAYING') return;
    const hc = matchState.player.hand.find((h) => h.uid === handUid);
    if (!hc) return;

    hsAudio.playSfx('card_hover', 0.7);
    setSelection(null);
    setZoomState({ kind: 'HAND_CARD', handUid });
  };

  const handleHandCardPointerDown = (e: React.PointerEvent, handUid: string, cardId: string) => {
    if (e.button !== 0 || matchState.phase !== 'PLAYING') return;
    const def = cardDb.mustGetCard(cardId);
    const hc = matchState.player.hand.find((h) => h.uid === handUid);
    const check = hc ? engine.inspectPlayability('PLAYER', hc) : null;
    setPointerPos({ x: e.clientX, y: e.clientY });
    const state: HandDragState = {
      handUid,
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      isDragging: false,
      needsTarget: Boolean(check?.needsTarget),
      isMinion: def.type === 'MINION',
      hasChooseOne: Boolean(check?.hasChooseOne),
    };
    handDragRef.current = state;
  };

  const handleFriendlyAttackerPointerDown = (e: React.PointerEvent, entityId: string) => {
    if (e.button !== 0 || matchState.phase !== 'PLAYING' || matchState.activeSide !== 'PLAYER') {
      return;
    }
    if (selection) return;
    const swing = engine.canAttackerSwing('PLAYER', entityId);
    if (!swing.ok) return;
    const validTargets = engine.getValidAttackTargets('PLAYER', entityId);
    if (validTargets.length === 0) return;
    setPointerPos({ x: e.clientX, y: e.clientY });
    attackerDragRef.current = {
      sourceKind: 'ATTACKER',
      sourceId: entityId,
      validTargets,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  };

  const handleHeroPowerPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || matchState.phase !== 'PLAYING' || matchState.activeSide !== 'PLAYER') {
      return;
    }
    const hpCheck = engine.inspectHeroPower('PLAYER');
    if (!hpCheck.canUse || !hpCheck.needsTarget || hpCheck.validTargets.length === 0) return;
    setPointerPos({ x: e.clientX, y: e.clientY });
    attackerDragRef.current = {
      sourceKind: 'HERO_POWER',
      sourceId: 'PLAYER_HERO_POWER',
      validTargets: hpCheck.validTargets,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  };

  // Resolve clicking a target entity (`PLAYER_HERO`, `OPPONENT_HERO`, or minion `uid`)
  const handleEntityClick = (entityId: string, isFriendlyMinionOrHero: boolean) => {
    if (suppressNextClickRef.current) return;
    if (matchState.phase !== 'PLAYING') return;

    // 1. Complete active targeting selection!
    if (selection && matchState.activeSide === 'PLAYER') {
      if (selection.kind === 'HAND_CARD' && selection.needsTarget) {
        if (selection.validTargets.includes(entityId)) {
          executePlayPlayerCard(selection.handUid, {
            targetId: entityId,
            insertIndex: matchState.player.board.length,
          });
        } else {
          setMatchState((s) => ({ ...s, errorBanner: tr('올바른 대상이 아닙니다!', 'Not a valid target!') }));
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
          setMatchState((s) => ({ ...s, errorBanner: tr('올바른 대상이 아닙니다!', 'Not a valid target!') }));
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
          setMatchState((s) => ({ ...s, errorBanner: tr('올바른 대상이 아닙니다!', 'Not a valid target!') }));
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
          const attackerId = selection.attackerId;
          setSelection(null);
          triggerPhysicalAttack('PLAYER', attackerId, entityId);
        } else {
          const enemyHasTaunt = matchState.opponent.board.some(
            (m) => !m.stealth && (m.taunt || m.auraTaunt),
          );
          if (enemyHasTaunt) {
            hsAudio.playHeroVo(matchState.player.heroClass, 'error_taunt');
            setMatchState((s) => ({
              ...s,
              errorBanner: tr('도발 능력이 있는 하수인이 가로막고 있습니다!', 'A minion with Taunt is in the way!'),
            }));
          } else {
            setMatchState((s) => ({ ...s, errorBanner: tr('공격할 수 없는 대상입니다!', 'Cannot attack that target!') }));
          }
        }
        return;
      }

      if (selection.kind === 'HAND_CARD' && !selection.needsTarget && selection.isMinion) {
        executePlayPlayerCard(selection.handUid, { insertIndex: insertPreviewIdx });
        return;
      }
    }

    // 2. When no active targeting is pending:
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
        setMatchState((s) => ({ ...s, errorBanner: swing.reason || tr('공격할 수 없습니다.', 'Cannot attack.') }));
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
    if (suppressNextClickRef.current) return;
    if (matchState.phase !== 'PLAYING' || matchState.activeSide !== 'PLAYER') return;
    if (selection?.kind === 'HERO_POWER') {
      setSelection(null);
      return;
    }
    const hpCheck = engine.inspectHeroPower('PLAYER');
    if (!hpCheck.canUse) {
      setMatchState((s) => ({ ...s, errorBanner: hpCheck.reason || tr('사용할 수 없습니다.', 'Cannot use Hero Power.') }));
      if (hpCheck.reason?.includes('마나') || hpCheck.reason?.toLowerCase().includes('mana')) {
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

  // Emote Trigger + Polite AI Reply (Respects Opponent Squelch!)
  const triggerPlayerEmote = (
    emoteKey: 'greetings' | 'well_played' | 'thanks' | 'wow' | 'oops' | 'threaten',
  ) => {
    setEmoteMenuOpen(false);
    const pHero = getLocalizedHeroInfo(matchState.player.heroClass, lang);
    setPlayerEmoteText(pHero.emotes[emoteKey]);
    hsAudio.playHeroVo(matchState.player.heroClass, emoteKey);
    window.setTimeout(() => setPlayerEmoteText(null), 2800);

    if (opponentSquelched) return;

    window.setTimeout(() => {
      if (opponentSquelched) return;
      const replyKey =
        emoteKey === 'greetings'
          ? 'greetings'
          : emoteKey === 'threaten'
            ? 'threaten'
            : emoteKey === 'well_played'
              ? 'thanks'
              : 'wow';
      const oHero = getLocalizedHeroInfo(matchState.opponent.heroClass, lang);
      setOpponentEmoteText(oHero.emotes[replyKey]);
      hsAudio.playHeroVo(matchState.opponent.heroClass, replyKey);
      window.setTimeout(() => setOpponentEmoteText(null), 2800);
    }, 1500);
  };

  // Interactive 4-Corner Board Diorama Toy Physics + Pandaria Golden Turnip Easter Egg
  const triggerCornerToy = useCallback(
    (toy: (typeof BOARD_CORNER_TOYS)[BoardThemeId][number]) => {
      setActiveToyPos(toy.pos);
      window.setTimeout(() => {
        setActiveToyPos((prev) => (prev === toy.pos ? null : prev));
      }, 420);

      let toastMsg = toy.reaction;
      let vfxLabel: string | undefined;
      let vfxValue: number | undefined;
      const sourceEntity = `TOY_${toy.pos}`;
      let targetEntity = sourceEntity;

      if (toy.vfxKind === 'TOY_CATAPULT') {
        targetEntity = 'TOY_BR';
      } else if (toy.vfxKind === 'TOY_BELL') {
        vfxLabel = tr('♪ 땡~!', '♪ Ding~!');
      } else if (toy.vfxKind === 'TOY_RADISH') {
        const roll = Math.random();
        if (roll < 0.18) {
          vfxValue = 777;
          vfxLabel = tr('★ 황금 순무!!', '★ GOLDEN TURNIP!!');
          toastMsg = tr(
            '✦ 대박!! 판다리아 텃밭에서 전설의 [황금 순무]가 뽑혔습니다!!',
            '✦ JACKPOT!! You harvested a legendary [Golden Turnip]!',
          );
        } else if (roll < 0.3) {
          vfxLabel = tr('🥾 낡은 장화?!', '🥾 Old Boot?!');
          toastMsg = tr(
            '엇?! 순무 대신 흙 묻은 낡은 가죽 장화가 뽑혔습니다!',
            'Oops! You pulled up a muddy leather boot instead!',
          );
        } else {
          vfxLabel = tr('🌱 순무 수확!', '🌱 Turnip!');
        }
      }

      const ev: VfxEvent = {
        id: `toy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        kind: toy.vfxKind,
        sourceId: sourceEntity,
        targetId: targetEntity,
        value: vfxValue,
        label: vfxLabel,
        createdAt: Date.now(),
      };
      setLocalVfxQueue((prev) => [...prev.slice(-14), ev]);
      setToyToast(toastMsg);
      window.setTimeout(() => {
        setToyToast((prev) => (prev === toastMsg ? null : prev));
      }, 2400);
    },
    [],
  );

  const combinedVfxEvents = useMemo(
    () => [...matchState.vfxQueue, ...localVfxQueue],
    [matchState.vfxQueue, localVfxQueue],
  );

  // Compute live Targeting Arrow source coordinates
  const targetingArrow = useMemo(() => {
    if (!selection) return null;
    const needsArrow =
      (selection.kind === 'HAND_CARD' && selection.needsTarget) ||
      selection.kind === 'CHOOSE_OPTION_TARGET' ||
      selection.kind === 'HERO_POWER' ||
      selection.kind === 'ATTACKER';
    if (!needsArrow) return null;

    let sx = window.innerWidth * 0.5;
    let sy = window.innerHeight * 0.82;
    if (selection.kind === 'ATTACKER') {
      const el = document.querySelector(`[data-hs-entity="${selection.attackerId}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        sx = r.left + r.width / 2;
        sy = r.top + r.height / 2;
      }
    } else if (selection.kind === 'HERO_POWER') {
      const hpEl = document.querySelector('[data-hs-entity="PLAYER_HERO_POWER"]');
      if (hpEl) {
        const r = hpEl.getBoundingClientRect();
        sx = r.left + r.width / 2;
        sy = r.top + r.height / 2;
      } else {
        sx = window.innerWidth * 0.58;
        sy = window.innerHeight * 0.77;
      }
    } else if (selection.kind === 'HAND_CARD') {
      const el = document.querySelector(`[data-hand-uid="${selection.handUid}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        sx = r.left + r.width / 2;
        sy = r.top + 24;
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
  const cornerToys = (isKo ? BOARD_CORNER_TOYS : BOARD_CORNER_TOYS_EN)[matchState.boardTheme];

  const isDraggingUntargetedMinionOverBoard =
    Boolean(
      handDrag?.isDragging &&
        handDrag.isMinion &&
        (!handDrag.needsTarget || handDrag.hasChooseOne) &&
        pointerPos.y <= (typeof window !== 'undefined' ? window.innerHeight * 0.77 : 9999),
    ) ||
    Boolean(selection?.kind === 'HAND_CARD' && !selection.needsTarget && selection.isMinion);

  const buildMinionStatusPills = (m: MinionInstance): string[] => {
    const pills: string[] = [];
    if (m.silenced) pills.push(tr('침묵 상태', 'Silenced'));
    if (hasMinionTaunt(m)) pills.push(tr('도발', 'Taunt'));
    if (m.divineShield) pills.push(tr('천상의 보호막', 'Divine Shield'));
    if (m.stealth || m.concealedUntilNextTurn) pills.push(tr('은신', 'Stealth'));
    if (m.windfury) pills.push(tr('질풍', 'Windfury'));
    if (m.frozen) pills.push(tr('빙결', 'Frozen'));
    if (m.charge || m.auraCharge) pills.push(tr('돌진', 'Charge'));
    if (m.poisonous && !m.silenced) pills.push(tr('독성', 'Poisonous'));
    if (m.elusive && !m.silenced) pills.push(tr('주문·영웅 능력 대상 불가', "Can't be targeted by Spells/Hero Powers"));
    if (m.cantAttack) pills.push(tr('공격 불가', "Can't Attack"));
    if (m.spellDamage > 0 && !m.silenced) pills.push(tr(`주문 공격력 +${m.spellDamage}`, `Spell Damage +${m.spellDamage}`));
    if (m.exhausted && !m.charge && !m.auraCharge && !m.cantAttack) {
      pills.push(tr('소환 후유증 (다음 턴 공격 가능)', 'Summoning Sickness (Ready next turn)'));
    } else if (m.attacksMadeThisTurn > 0 && (!m.windfury || m.attacksMadeThisTurn >= 2)) {
      pills.push(tr('이번 턴 공격 완료', 'Attacked this turn'));
    }
    return pills;
  };

  const renderDeckSlot = (side: 'PLAYER' | 'OPPONENT') => {
    const p = side === 'PLAYER' ? matchState.player : matchState.opponent;
    const count = p.deck.length;
    const layers = Math.min(4, Math.ceil(count / 7));
    const isFriendly = side === 'PLAYER';
    const isTooltipOpen = deckTooltipSide === side;
    return (
      <div
        data-hs-entity={isFriendly ? 'PLAYER_DECK' : 'OPPONENT_DECK'}
        onMouseEnter={() => setDeckTooltipSide(side)}
        onMouseLeave={() => setDeckTooltipSide((prev) => (prev === side ? null : prev))}
        onClick={(e) => {
          e.stopPropagation();
          setDeckTooltipSide((prev) => (prev === side ? null : side));
        }}
        title={
          count > 0
            ? tr(
                `${isFriendly ? '내' : '상대'} 남은 덱: ${count}장 · 손패: ${p.hand.length}/10장`,
                `${isFriendly ? 'Your' : 'Enemy'} Deck: ${count} · Hand: ${p.hand.length}/10`,
              )
            : tr(
                `카드가 없습니다! 다음 탈진 피해: ${p.fatigueCounter + 1}`,
                `Out of cards! Next Fatigue: ${p.fatigueCounter + 1}`,
              )
        }
        className="relative flex h-[64px] w-[46px] cursor-pointer items-center justify-center select-none"
      >
        {count > 0 ? (
          <>
            {Array.from({ length: layers }).map((_, i) => (
              <div
                key={i}
                style={{
                  transform: `translate(${(layers - 1 - i) * 2}px, ${(layers - 1 - i) * 2}px)`,
                }}
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[7px] border border-[#c8a158]/80 bg-stone-950 shadow-[0_6px_14px_rgba(0,0,0,0.9)]"
              >
                <img src={backImg} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
            <div className="relative z-10 flex flex-col items-center rounded-md bg-stone-950/78 px-1.5 py-0.5 backdrop-blur-[1px]">
              <span className="hs-num text-sm leading-none text-white">{count}</span>
            </div>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-[7px] border-2 border-dashed border-red-500/60 bg-stone-950/90 text-center shadow-inner">
            <span className="text-[9px] font-extrabold text-red-300">{tr('탈진', 'Fatigue')}</span>
            <span className="hs-num text-xs text-red-400">-{p.fatigueCounter + 1}</span>
          </div>
        )}

        {isTooltipOpen && (
          <div className="pointer-events-none absolute right-14 top-1/2 z-50 w-44 -translate-y-1/2 rounded-xl border-2 border-[#d4af63] bg-stone-950/95 px-3 py-2 text-left text-[11px] text-amber-100 shadow-2xl">
            <div className="font-extrabold text-amber-300">
              {isFriendly ? tr('내 덱 상태', 'Your Deck') : tr('상대 덱 상태', 'Enemy Deck')}
            </div>
            {count > 0 ? (
              <div className="mt-0.5 font-bold text-white">
                {tr(`덱에 카드 ${count}장 남음`, `${count} cards remaining`)}
              </div>
            ) : (
              <div className="mt-0.5 font-extrabold text-rose-400">
                {tr(
                  `카드가 없습니다! (다음 탈진 -${p.fatigueCounter + 1})`,
                  `Out of cards! (Next Fatigue -${p.fatigueCounter + 1})`,
                )}
              </div>
            )}
            <div className="mt-0.5 text-[10px] font-bold text-sky-300">
              {tr(`현재 손패: ${p.hand.length} / 10장`, `Hand: ${p.hand.length} / 10`)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEndTurnButton = (sizeMode: 'DESKTOP_STAGE' | 'MOBILE_BAR') => {
    const imgSrc = !isPlayerTurn
      ? '/stone-assets/ui/endturn_stone.webp'
      : noMovesLeft
        ? '/stone-assets/ui/endturn_green.webp'
        : '/stone-assets/ui/endturn_yellow.webp';
    const label = !isPlayerTurn
      ? tr('상대 턴', 'ENEMY TURN')
      : noMovesLeft
        ? tr('할 일 없음', "JOB'S DONE")
        : tr('턴 종료', 'END TURN');

    if (sizeMode === 'MOBILE_BAR') {
      return (
        <button
          type="button"
          disabled={!isPlayerTurn}
          onClick={(e) => {
            e.stopPropagation();
            if (!isPlayerTurn) return;
            setSelection(null);
            hsAudio.playSfx('end_turn');
            const eng = createEngine(matchState);
            setMatchState(eng.endTurn());
          }}
          className={`relative flex h-[36px] w-[88px] shrink-0 items-center justify-center transition ${
            !isPlayerTurn
              ? 'cursor-not-allowed opacity-90'
              : noMovesLeft
                ? 'drop-shadow-[0_0_12px_rgba(52,211,153,0.95)] active:scale-95'
                : 'active:scale-95'
          }`}
        >
          <img
            src={imgSrc}
            alt="턴 종료"
            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          />
          <span
            className={`hs-title hs-outline-sm relative z-10 text-[10.5px] font-extrabold ${
              !isPlayerTurn ? 'text-stone-300' : 'text-white'
            }`}
          >
            {label}
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={!isPlayerTurn}
        onClick={(e) => {
          e.stopPropagation();
          if (!isPlayerTurn) return;
          setSelection(null);
          hsAudio.playSfx('end_turn');
          const eng = createEngine(matchState);
          setMatchState(eng.endTurn());
        }}
        style={{
          left: `${geom.endTurnX}%`,
          top: `${geom.endTurnY}%`,
          width: '12.2%',
          height: '9.4%',
        }}
        className={`group absolute z-35 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-stone-950/90 transition ${
          !isPlayerTurn
            ? 'cursor-not-allowed'
            : noMovesLeft
              ? 'cursor-pointer shadow-[0_0_24px_rgba(52,211,153,0.9)] hover:scale-[1.04]'
              : 'cursor-pointer shadow-[0_8px_18px_rgba(0,0,0,0.88)] hover:scale-[1.04] hover:brightness-110'
        }`}
      >
        <img
          src={imgSrc}
          alt="턴 종료"
          className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-fill"
        />
        <span
          className={`hs-title hs-outline-sm relative z-10 text-xs font-extrabold tracking-wide lg:text-sm ${
            !isPlayerTurn ? 'text-stone-300' : 'text-white'
          }`}
        >
          {label}
        </span>
      </button>
    );
  };

  const renderManaTray = () => {
    const spendCount =
      isPlayerTurn && hoveredHandCost !== null && hoveredHandCost <= matchState.player.mana
        ? hoveredHandCost
        : 0;
    const spendStartIdx = Math.max(0, matchState.player.mana - spendCount);

    return (
      <div className="flex items-center gap-1.5 rounded-2xl border-2 border-[#c8a158] bg-stone-950/92 px-2.5 py-1 shadow-[0_10px_24px_rgba(0,0,0,0.9)] sm:gap-2 sm:px-3 sm:py-1.5">
        <HsManaGem
          value={`${matchState.player.mana}/${matchState.player.maxMana}`}
          size={isCompactMobile ? 24 : 28}
          active={matchState.player.mana > 0}
        />
        <div className="flex items-center gap-0.5 sm:gap-1">
          {Array.from({ length: 10 }).map((_, idx) => {
            const isUnlocked = idx < matchState.player.maxMana;
            const isFilled = idx < matchState.player.mana;
            const isSpendingPreview =
              spendCount > 0 && isFilled && idx >= spendStartIdx && idx < matchState.player.mana;
            const isOverloadedNow =
              isUnlocked &&
              idx >= matchState.player.maxMana - matchState.player.overloadedMana;
            return (
              <div
                key={idx}
                title={isOverloadedNow ? tr('과부하로 잠긴 마나 수정', 'Overloaded Mana Crystal') : undefined}
                style={{
                  clipPath:
                    'polygon(50% 4%, 94% 26%, 94% 74%, 50% 96%, 6% 74%, 6% 26%)',
                }}
                className={`h-3.5 w-3 transition sm:h-4.5 sm:w-3.5 ${
                  isOverloadedNow
                    ? 'bg-gradient-to-b from-red-400 to-red-800 shadow-[0_0_8px_#ef4444]'
                    : isSpendingPreview
                      ? 'animate-pulse bg-gradient-to-b from-white via-cyan-300 to-sky-400 shadow-[0_0_12px_#67e8f9] brightness-125'
                      : isFilled
                        ? 'bg-gradient-to-b from-sky-200 via-blue-500 to-indigo-900 shadow-[0_0_8px_#38bdf8]'
                        : isUnlocked
                          ? 'bg-sky-950/85 opacity-70'
                          : 'bg-stone-800/45 opacity-45'
                }`}
              />
            );
          })}
        </div>
        {matchState.player.pendingOverload > 0 && (
          <span className="ml-0.5 rounded-md border border-red-400/50 bg-red-950 px-1.5 py-0.5 text-[9.5px] font-extrabold text-red-200 sm:text-[10px]">
            {tr('과부하', 'Overload')} {matchState.player.pendingOverload}
          </span>
        )}
      </div>
    );
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
            label: tr('상대 턴에는 카드를 사용할 수 없습니다', 'Wait for your turn to play cards'),
            disabled: true,
            onClick: () => {},
          }
        : !check.canPlay
          ? {
              label: check.reason
                ? tr(`사용 불가 · ${check.reason}`, `Cannot Play · ${check.reason}`)
                : tr('마나가 부족합니다', 'Not enough Mana'),
              disabled: true,
              onClick: () => {},
            }
          : {
              label: check.hasChooseOne
                ? tr(`카드 사용 · 효과 선택 (마나 ${check.cost})`, `Play · Choose One (${check.cost} Mana)`)
                : check.needsTarget
                  ? tr(`카드 사용 · 대상 지정 (마나 ${check.cost})`, `Play · Choose Target (${check.cost} Mana)`)
                  : tr(`카드 사용 (마나 ${check.cost})`, `Play Card (${check.cost} Mana)`),
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
                label: tr('전장 위치 직접 지정하여 놓기', 'Choose Board Position'),
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

      const hand = matchState.player.hand;
      const handIdx = hand.findIndex((h) => h.uid === hc.uid);
      const handNav =
        handIdx >= 0 && hand.length > 1
          ? {
              currentIndex: handIdx,
              totalCount: hand.length,
              positionLabel: tr(`내 손패 ${handIdx + 1} / ${hand.length}`, `Hand ${handIdx + 1} / ${hand.length}`),
              onPrev: () =>
                setZoomState({
                  kind: 'HAND_CARD',
                  handUid: hand[(handIdx - 1 + hand.length) % hand.length].uid,
                }),
              onNext: () =>
                setZoomState({
                  kind: 'HAND_CARD',
                  handUid: hand[(handIdx + 1) % hand.length].uid,
                }),
            }
          : undefined;

      return (
        <CardZoomModal
          card={def}
          effectiveCost={check.cost}
          spellPowerBonus={playerSpellPower}
          velenMultiplier={playerVelenMult}
          playableGlow={!canPlayNow ? 'NONE' : check.isComboReady ? 'COMBO' : 'GREEN'}
          subtitleBadge={tr(
            `내 손패 · 보유 마나 ${matchState.player.mana}/${matchState.player.maxMana} (드래그로도 즉시 사용 가능)`,
            `Your Hand · Mana ${matchState.player.mana}/${matchState.player.maxMana} (Drag to play)`,
          )}
          navigation={handNav}
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
      const hand = matchState.player.hand;
      const handIdx = hand.findIndex((h) => h.uid === hc.uid);
      const mulliganNav =
        handIdx >= 0 && hand.length > 1
          ? {
              currentIndex: handIdx,
              totalCount: hand.length,
              positionLabel: tr(`시작 카드 ${handIdx + 1} / ${hand.length}`, `Starting Hand ${handIdx + 1} / ${hand.length}`),
              onPrev: () =>
                setZoomState({
                  kind: 'MULLIGAN_CARD',
                  handUid: hand[(handIdx - 1 + hand.length) % hand.length].uid,
                }),
              onNext: () =>
                setZoomState({
                  kind: 'MULLIGAN_CARD',
                  handUid: hand[(handIdx + 1) % hand.length].uid,
                }),
            }
          : undefined;
      return (
        <CardZoomModal
          card={def}
          subtitleBadge={
            marked
              ? tr('시작 카드 · 현재 [교체 ✕]', 'Starting Hand · Marked [Replace ✕]')
              : tr('시작 카드 · 현재 [유지]', 'Starting Hand · Marked [Keep]')
          }
          navigation={mulliganNav}
          primaryAction={{
            label: marked
              ? tr('교체 취소 (손패에 유지)', 'Keep Card (Cancel Replace)')
              : tr('교체 선택 (덱에서 새 카드 뽑기)', 'Replace Card'),
            variant: marked ? 'arcane' : 'crimson',
            onClick: () => {
              toggleMulliganCard(hc.uid);
            },
          }}
          secondaryActions={[
            {
              label: tr('확인 (닫기)', 'Done'),
              variant: 'brass',
              onClick: () => setZoomState(null),
            },
          ]}
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
      const opts = prompt.options;
      const optIdx = opts.findIndex((o) => o.index === opt.index);
      const chooseNav =
        optIdx >= 0 && opts.length > 1
          ? {
              currentIndex: optIdx,
              totalCount: opts.length,
              positionLabel: tr(`선택 효과 ${optIdx + 1} / ${opts.length}`, `Choice ${optIdx + 1} / ${opts.length}`),
              onPrev: () =>
                setZoomState({
                  kind: 'CHOOSE_ONE_CARD',
                  optionIndex: opts[(optIdx - 1 + opts.length) % opts.length].index,
                }),
              onNext: () =>
                setZoomState({
                  kind: 'CHOOSE_ONE_CARD',
                  optionIndex: opts[(optIdx + 1) % opts.length].index,
                }),
            }
          : undefined;
      return (
        <CardZoomModal
          card={optCard}
          subtitleBadge={tr(`선택 · ${getCardName(optCard, lang)}`, `Choose One · ${getCardName(optCard, lang)}`)}
          navigation={chooseNav}
          primaryAction={{
            label: opt.needsTarget
              ? tr('이 효과 선택 · 대상 지정', 'Choose · Select Target')
              : tr('이 효과 사용', 'Choose This Option'),
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
      const tCards = prompt.cards;
      const tIdx =
        zoomState.index !== undefined && tCards[zoomState.index] === zoomState.cardId
          ? zoomState.index
          : tCards.indexOf(zoomState.cardId);
      const trackingNav =
        tIdx >= 0 && tCards.length > 1
          ? {
              currentIndex: tIdx,
              totalCount: tCards.length,
              positionLabel: tr(`추적 카드 ${tIdx + 1} / ${tCards.length}`, `Tracking ${tIdx + 1} / ${tCards.length}`),
              onPrev: () => {
                const prevIdx = (tIdx - 1 + tCards.length) % tCards.length;
                setZoomState({
                  kind: 'TRACKING_CARD',
                  cardId: tCards[prevIdx],
                  index: prevIdx,
                });
              },
              onNext: () => {
                const nextIdx = (tIdx + 1) % tCards.length;
                setZoomState({
                  kind: 'TRACKING_CARD',
                  cardId: tCards[nextIdx],
                  index: nextIdx,
                });
              },
            }
          : undefined;
      return (
        <CardZoomModal
          card={def}
          subtitleBadge={tr(
            '추적 — 가져올 카드 1장 선택 (나머지 2장 버림)',
            'Tracking — Draw 1 card and discard the others',
          )}
          navigation={trackingNav}
          primaryAction={{
            label: tr('이 카드 손으로 가져오기', 'Draw This Card'),
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
      const allBoardMinions = [
        ...matchState.opponent.board.map((m) => ({ minion: m, isFriendly: false })),
        ...matchState.player.board.map((m) => ({ minion: m, isFriendly: true })),
      ];
      const mIdx = allBoardMinions.findIndex((x) => x.minion.uid === liveMinion.uid);
      const boardNav =
        mIdx >= 0 && allBoardMinions.length > 1
          ? {
              currentIndex: mIdx,
              totalCount: allBoardMinions.length,
              positionLabel: tr(`전장 하수인 ${mIdx + 1} / ${allBoardMinions.length}`, `Board ${mIdx + 1} / ${allBoardMinions.length}`),
              onPrev: () => {
                const prev =
                  allBoardMinions[
                    (mIdx - 1 + allBoardMinions.length) % allBoardMinions.length
                  ];
                setZoomState({
                  kind: 'BOARD_MINION',
                  minion: prev.minion,
                  isFriendly: prev.isFriendly,
                });
              },
              onNext: () => {
                const next = allBoardMinions[(mIdx + 1) % allBoardMinions.length];
                setZoomState({
                  kind: 'BOARD_MINION',
                  minion: next.minion,
                  isFriendly: next.isFriendly,
                });
              },
            }
          : undefined;

      return (
        <CardZoomModal
          card={def}
          subtitleBadge={
            zoomState.isFriendly
              ? tr('아군 전장 하수인 정보', 'Friendly Board Minion')
              : tr('상대 전장 하수인 정보', 'Enemy Board Minion')
          }
          liveStats={{
            attack: getMinionAttack(liveMinion),
            health: getMinionHealth(liveMinion),
            maxHealth: getMinionMaxHealth(liveMinion),
            statuses: buildMinionStatusPills(liveMinion),
          }}
          navigation={boardNav}
          primaryAction={
            canSwing && validTargets.length > 0
              ? {
                  label: tr('이 하수인으로 공격 대상 선택', 'Attack with This Minion'),
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
                  label: tr('확인 (닫기)', 'Done'),
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
      if (item.isHiddenSecret || !cardDb.getCard(item.cardId)) return null;
      const def = cardDb.mustGetCard(item.cardId);
      const cardHistory = matchState.history.filter(
        (h) => !h.isHiddenSecret && Boolean(cardDb.getCard(h.cardId)),
      );
      const hIdx = cardHistory.findIndex((h) => h.id === item.id);
      const historyNav =
        hIdx >= 0 && cardHistory.length > 1
          ? {
              currentIndex: hIdx,
              totalCount: cardHistory.length,
              positionLabel: tr(`전투 기록 ${hIdx + 1} / ${cardHistory.length}`, `History ${hIdx + 1} / ${cardHistory.length}`),
              onPrev: () =>
                setZoomState({
                  kind: 'HISTORY_ITEM',
                  item: cardHistory[(hIdx - 1 + cardHistory.length) % cardHistory.length],
                }),
              onNext: () =>
                setZoomState({
                  kind: 'HISTORY_ITEM',
                  item: cardHistory[(hIdx + 1) % cardHistory.length],
                }),
            }
          : undefined;
      return (
        <CardZoomModal
          card={def}
          subtitleBadge={tr(
            `${item.turn}턴 기록 · ${item.actorSide === 'PLAYER' ? '아군 행동' : '상대 행동'} — ${item.detail}`,
            `Turn ${item.turn} · ${item.actorSide === 'PLAYER' ? 'Your Action' : 'Enemy Action'} — ${item.detail}`,
          )}
          navigation={historyNav}
          primaryAction={{
            label: tr('확인 (닫기)', 'Done'),
            variant: 'brass',
            onClick: () => setZoomState(null)}
          }
          onCancel={() => setZoomState(null)}
        />
      );
    }

    return null;
  };

  // Shared Opponent Minion Row (Single DOM mount for accurate [data-hs-entity] VFX & targeting!)
  const opponentMinionRowEl = (
    <div
      style={
        isDesktopStage
          ? {
              left: '50%',
              top: `${geom.oppRowY}%`,
              width: '66%',
            }
          : undefined
      }
      className={
        isDesktopStage
          ? 'absolute z-25 flex min-h-[112px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2.5 lg:gap-3.5'
          : 'flex min-h-[70px] items-center justify-center gap-1 sm:min-h-[116px] sm:gap-3'
      }
    >
      {matchState.opponent.board.map((m) => (
        <div key={m.uid} className="animate-[hsMinionSummonDrop_0.34s_cubic-bezier(0.22,1,0.36,1)]">
          <BoardMinionToken
            minion={m}
            canAttack={false}
            isSelectedAttacker={false}
            isValidTarget={activeValidTargetSet.has(m.uid)}
            isHiddenDuringAttack={attackAnim?.attackerId === m.uid}
            onSelect={() => handleEntityClick(m.uid, false)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              hsAudio.playSfx('card_hover', 0.65);
              setZoomState({ kind: 'BOARD_MINION', minion: m, isFriendly: false });
            }}
            onHoverChange={(hov) => setHoveredBoardMinion(hov ? m : null)}
          />
        </div>
      ))}
    </div>
  );

  // Shared Friendly Minion Row with Positional Slot Parting!
  const friendlyMinionRowEl = (
    <div
      ref={friendlyRowRef}
      onClick={(e) => {
        if (selection?.kind === 'HAND_CARD' && !selection.needsTarget) {
          e.stopPropagation();
          executePlayPlayerCard(selection.handUid, { insertIndex: insertPreviewIdx });
        }
      }}
      style={
        isDesktopStage
          ? {
              left: '50%',
              top: `${geom.playerRowY}%`,
              width: '66%',
            }
          : undefined
      }
      className={`${
        isDesktopStage
          ? 'absolute z-25 flex min-h-[114px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2.5 rounded-3xl transition lg:gap-3.5'
          : 'flex min-h-[70px] items-center justify-center gap-1 rounded-3xl transition sm:min-h-[118px] sm:gap-3'
      } ${
        isDraggingUntargetedMinionOverBoard
          ? 'cursor-pointer bg-emerald-500/12 ring-2 ring-emerald-400/55'
          : ''
      }`}
    >
      {matchState.player.board.map((m, idx) => (
        <React.Fragment key={m.uid}>
          {isDraggingUntargetedMinionOverBoard && insertPreviewIdx === idx && (
            <div className="flex h-[64px] w-12 shrink-0 items-center justify-center rounded-[50%] border-2 border-dashed border-emerald-300 bg-emerald-400/25 text-center text-[9px] font-extrabold text-emerald-100 transition-all duration-150 sm:h-[104px] sm:w-16 sm:text-[10px]">
              {tr('소환', 'Summon')}
            </div>
          )}
          <div className="animate-[hsMinionSummonDrop_0.34s_cubic-bezier(0.22,1,0.36,1)]">
            <BoardMinionToken
              minion={m}
              canAttack={isPlayerTurn && engine.canAttackerSwing('PLAYER', m.uid).ok}
              isSelectedAttacker={
                selection?.kind === 'ATTACKER' && selection.attackerId === m.uid
              }
              isValidTarget={activeValidTargetSet.has(m.uid)}
              isHiddenDuringAttack={attackAnim?.attackerId === m.uid}
              onSelect={() => handleEntityClick(m.uid, true)}
              onPointerDown={(e) => handleFriendlyAttackerPointerDown(e, m.uid)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                hsAudio.playSfx('card_hover', 0.65);
                setZoomState({ kind: 'BOARD_MINION', minion: m, isFriendly: true });
              }}
              onHoverChange={(hov) => setHoveredBoardMinion(hov ? m : null)}
            />
          </div>
        </React.Fragment>
      ))}

      {isDraggingUntargetedMinionOverBoard &&
        insertPreviewIdx >= matchState.player.board.length && (
          <div className="flex h-[64px] w-12 shrink-0 items-center justify-center rounded-[50%] border-2 border-dashed border-emerald-300 bg-emerald-400/25 text-center text-[9px] font-extrabold text-emerald-100 transition-all duration-150 sm:h-[104px] sm:w-16 sm:text-[10px]">
            {tr('소환', 'Summon')}
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
    </div>
  );

  // Shared Opponent Hero Zone + Authentic Right-Click Squelch ("차단")
  const opponentHeroZoneEl = (
    <div className="relative flex items-center justify-center">
      <HeroPortraitZone
        player={matchState.opponent}
        isFriendly={false}
        isActiveTurn={matchState.activeSide === 'OPPONENT'}
        canHeroAttack={false}
        isHeroSelectedAttacker={false}
        isHeroValidTarget={activeValidTargetSet.has('OPPONENT_HERO')}
        canUseHeroPower={false}
        isHeroPowerSelected={false}
        isDefeated={matchState.phase === 'GAME_OVER' && matchState.winner === 'PLAYER'}
        isSquelched={opponentSquelched}
        emoteBubbleText={opponentSquelched ? null : opponentEmoteText}
        onClickHero={() => {
          if (selection) {
            handleEntityClick('OPPONENT_HERO', false);
          } else {
            hsAudio.playSfx('ui_click', 0.7);
            setSquelchMenuOpen((v) => !v);
          }
        }}
        onHeroContextMenu={() => {
          hsAudio.playSfx('ui_click', 0.7);
          setSquelchMenuOpen((v) => !v);
        }}
        onClickHeroPower={() => {}}
      />

      {squelchMenuOpen && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            hsAudio.playSfx('ui_click', 0.8);
            const next = !opponentSquelched;
            setOpponentSquelched(next);
            if (next) setOpponentEmoteText(null);
            setSquelchMenuOpen(false);
            setToyToast(
              next
                ? tr('상대 영웅의 감정표현을 차단했습니다.', 'Opponent Squelched.')
                : tr('상대 영웅의 감정표현 차단을 해제했습니다.', 'Opponent Unsquelched.'),
            );
            window.setTimeout(() => setToyToast(null), 1900);
          }}
          className="hs-ivory-plate absolute -right-24 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-2xl px-3.5 py-1.5 text-xs font-extrabold text-[#2b180a] shadow-2xl sm:-right-28"
        >
          {opponentSquelched ? tr('🔊 차단 해제', '🔊 Unsquelch') : tr('🔇 차단', '🔇 Squelch')}
        </button>
      )}
    </div>
  );

  // Shared Player Hero Zone + Authentic 6-Bubble Radial Hearthstone Emote Wheel!
  const playerHeroWithEmoteEl = (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          hsAudio.playSfx('ui_click', 0.75);
          setEmoteMenuOpen((v) => !v);
        }}
        className="hs-brass-btn absolute -left-14 top-1/2 z-30 -translate-y-1/2 rounded-xl px-2 py-1 text-[10px] font-extrabold text-amber-100 sm:-left-20 sm:px-2.5 sm:text-[11px]"
      >
        {tr('감정표현', 'Emotes')}
      </button>

      <HeroPortraitZone
        player={matchState.player}
        isFriendly
        isActiveTurn={isPlayerTurn}
        canHeroAttack={isPlayerTurn && engine.canAttackerSwing('PLAYER', 'PLAYER_HERO').ok}
        isHeroSelectedAttacker={
          selection?.kind === 'ATTACKER' && selection.attackerId === 'PLAYER_HERO'
        }
        isHeroValidTarget={activeValidTargetSet.has('PLAYER_HERO')}
        canUseHeroPower={isPlayerTurn && engine.inspectHeroPower('PLAYER').canUse}
        isHeroPowerSelected={selection?.kind === 'HERO_POWER'}
        isDefeated={matchState.phase === 'GAME_OVER' && matchState.winner === 'OPPONENT'}
        emoteBubbleText={playerEmoteText || matchState.errorBanner}
        onClickHero={() => handleEntityClick('PLAYER_HERO', true)}
        onClickHeroPower={handlePlayerHeroPower}
        onHeroPointerDown={(e) => handleFriendlyAttackerPointerDown(e, 'PLAYER_HERO')}
        onHeroPowerPointerDown={handleHeroPowerPointerDown}
        onHeroContextMenu={() => {
          hsAudio.playSfx('ui_click', 0.75);
          setEmoteMenuOpen((v) => !v);
        }}
      />

      {emoteMenuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
        >
          {/* Left 3 Speech Bubbles */}
          <div className="pointer-events-auto absolute -left-24 -top-16 flex flex-col gap-1.5 sm:-left-36 sm:-top-14">
            {(
              [
                { key: 'thanks', label: tr('감사', 'Thanks'), shift: 'translate-x-2' },
                { key: 'well_played', label: tr('칭찬', 'Well Played'), shift: 'translate-x-0' },
                { key: 'greetings', label: tr('인사', 'Greetings'), shift: 'translate-x-2' },
              ] as const
            ).map((em) => (
              <button
                key={em.key}
                type="button"
                onClick={() => triggerPlayerEmote(em.key)}
                className={`hs-ivory-plate w-20 rounded-2xl rounded-br-sm py-1.5 text-xs font-extrabold text-[#2b180a] shadow-xl sm:w-24 ${em.shift}`}
              >
                {em.label}
              </button>
            ))}
          </div>
          {/* Right 3 Speech Bubbles */}
          <div className="pointer-events-auto absolute -right-24 -top-16 flex flex-col gap-1.5 sm:-right-36 sm:-top-14">
            {(
              [
                { key: 'wow', label: tr('감탄', 'Wow'), shift: '-translate-x-2' },
                { key: 'oops', label: tr('실수', 'Oops'), shift: 'translate-x-0' },
                { key: 'threaten', label: tr('위협', 'Threaten'), shift: '-translate-x-2' },
              ] as const
            ).map((em) => (
              <button
                key={em.key}
                type="button"
                onClick={() => triggerPlayerEmote(em.key)}
                className={`hs-ivory-plate w-20 rounded-2xl rounded-bl-sm py-1.5 text-xs font-extrabold text-[#2b180a] shadow-xl sm:w-24 ${em.shift}`}
              >
                {em.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Shared Player Curved Hand Fan (Supports Drag-to-Play + Hover Lift + Tap-to-Zoom!)
  const renderPlayerHandFan = (desktopDocked: boolean) => (
    <div
      className={
        desktopDocked
          ? 'group/hand fixed bottom-[-54px] left-[42%] z-40 flex -translate-x-1/2 items-end pt-10 transition-transform duration-200 hover:translate-y-[-18px]'
          : 'hs-no-scrollbar mt-0.5 flex min-h-[144px] w-full items-end overflow-x-auto px-3 pb-0.5 pt-2 sm:justify-center'
      }
    >
      <div
        className={`mx-auto flex w-max items-end ${
          matchState.player.hand.length >= 8
            ? '-space-x-9 sm:-space-x-11'
            : '-space-x-6 sm:-space-x-7'
        }`}
      >
        {matchState.player.hand.map((hc, idx) => {
          const def = cardDb.mustGetCard(hc.cardId);
          const check = engine.inspectPlayability('PLAYER', hc);
          const isBeingDragged = handDrag?.isDragging && handDrag.handUid === hc.uid;
          const isSelectedCard =
            (selection?.kind === 'HAND_CARD' && selection.handUid === hc.uid) ||
            (zoomState?.kind === 'HAND_CARD' && zoomState.handUid === hc.uid);
          const isNewlyDrawn = newlyDrawnUids.has(hc.uid);
          const mid = (matchState.player.hand.length - 1) / 2;
          const angle = (idx - mid) * (isCompactMobile ? 1.5 : 2.6);
          const liftY = Math.min(isCompactMobile ? 4 : 10, Math.abs(idx - mid) * 1.6);

          return (
            <div
              key={hc.uid}
              data-hand-uid={hc.uid}
              onPointerDown={(e) => handleHandCardPointerDown(e, hc.uid, hc.cardId)}
              onClick={(e) => {
                e.stopPropagation();
                handleHandCardClick(hc.uid);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                hsAudio.playSfx('card_hover', 0.7);
                setZoomState({ kind: 'HAND_CARD', handUid: hc.uid });
              }}
              onMouseEnter={() => {
                if (isPlayerTurn && check.canPlay) {
                  setHoveredHandCost(check.cost);
                }
              }}
              onMouseLeave={() => setHoveredHandCost(null)}
              style={{
                transform: isSelectedCard
                  ? 'translateY(-44px) scale(1.14)'
                  : `translateY(${liftY}px) rotate(${angle}deg)`,
              }}
              className={`touch-none transition-all duration-150 ${
                isBeingDragged && (!handDrag?.needsTarget || handDrag?.hasChooseOne)
                  ? 'pointer-events-none opacity-20'
                  : ''
              } ${isNewlyDrawn ? 'animate-[hsCardDrawFly_0.55s_cubic-bezier(0.2,0.9,0.25,1)_both]' : ''} ${
                isSelectedCard
                  ? 'z-50'
                  : 'hover:z-50 sm:hover:-translate-y-12 sm:hover:rotate-0 sm:hover:scale-[1.22]'
              }`}
            >
              <HearthstoneCard
                card={def}
                effectiveCost={check.cost}
                spellPowerBonus={playerSpellPower}
                velenMultiplier={playerVelenMult}
                playableGlow={
                  !isPlayerTurn || !check.canPlay
                    ? 'NONE'
                    : check.isComboReady
                      ? 'COMBO'
                      : 'GREEN'
                }
                size={isCompactMobile ? 'XS' : 'SM'}
                className="cursor-grab active:cursor-grabbing"
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  // Top Utility Bar (Opponent Nameplate + Opponent Face-Down Curved Hand + AutoPlay + Options)
  const topUtilityHeaderEl = (
    <div className="fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-1.5 px-2 pt-1.5 pointer-events-none sm:px-3.5">
      <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-xl border-2 border-[#b8924d]/75 bg-stone-950/90 px-2.5 py-1 text-[10.5px] text-amber-100 shadow-lg sm:gap-2 sm:px-3 sm:text-xs">
        <img
          src={CLASS_CREST_URL[matchState.opponent.heroClass]}
          alt=""
          className="h-4 w-4 shrink-0 rounded-full object-cover"
        />
        <span className="max-w-[78px] truncate font-extrabold text-red-200 sm:max-w-none">
          {matchState.opponent.name}
        </span>
        <span className="text-stone-500">·</span>
        <span className="shrink-0 font-extrabold text-sky-300">
          {tr('마나', 'Mana')} {matchState.opponent.mana}/{matchState.opponent.maxMana}
        </span>
      </div>

      {/* Opponent Face-Down Curved Hand Fan Hanging from Top Edge */}
      <div
        title={tr(`상대 손패: ${matchState.opponent.hand.length}장`, `Enemy Hand: ${matchState.opponent.hand.length}`)}
        className="pointer-events-auto flex shrink-0 items-start justify-center -space-x-3.5 sm:-mt-3 sm:-space-x-4"
      >
        {matchState.opponent.hand.map((hc, idx) => {
          const rot = (idx - (matchState.opponent.hand.length - 1) / 2) * 3.5;
          return (
            <div
              key={hc.uid}
              style={{ transform: `rotate(${rot}deg)` }}
              className="h-7 w-5 overflow-hidden rounded-[4px] border border-amber-300/65 shadow-md sm:h-14 sm:w-10 sm:rounded-md"
            >
              <img src={backImg} alt="" className="h-full w-full object-cover" />
            </div>
          );
        })}
        {matchState.opponent.hand.length === 0 && (
          <span className="mt-1 rounded border border-stone-700 bg-stone-950/80 px-1.5 py-0.5 text-[9.5px] font-bold text-stone-400">
            {tr('손패 0장', '0 Cards')}
          </span>
        )}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          data-testid="toggle-autoplay"
          data-autoplay-active={autoPlay ? 'true' : 'false'}
          onClick={(e) => {
            e.stopPropagation();
            hsAudio.playSfx('ui_click', 0.8);
            setAutoPlay((prev) => {
              const next = !prev;
              if (next) {
                setSelection(null);
                setZoomState(null);
                setHandDrag(null);
                handDragRef.current = null;
                attackerDragRef.current = null;
                document.body.classList.remove('hs-dragging-active');
              }
              return next;
            });
          }}
          className={`rounded-xl border px-2 py-1 text-[10.5px] font-extrabold transition sm:px-2.5 sm:text-xs ${
            autoPlay
              ? 'border-emerald-300 bg-emerald-700 text-white shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : 'hs-brass-btn text-amber-100'
          }`}
        >
          {autoPlay ? tr('⚙ 자동 ON', '⚙ Auto ON') : tr('⚙ 자동 OFF', '⚙ Auto OFF')}
        </button>

        {!isDesktopStage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const toy = cornerToys[Math.floor(Math.random() * cornerToys.length)];
              triggerCornerToy(toy);
            }}
            className="hs-brass-btn rounded-xl px-2 py-1 text-[10.5px] font-extrabold text-amber-100"
          >
            {tr('기물', 'Toys')}
          </button>
        )}

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
  );

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        if (selection) setSelection(null);
      }}
      onClick={() => {
        if (emoteMenuOpen) setEmoteMenuOpen(false);
        if (squelchMenuOpen) setSquelchMenuOpen(false);
        if (deckTooltipSide) setDeckTooltipSide(null);
        if (selection && !suppressNextClickRef.current) setSelection(null);
      }}
      style={
        {
          backgroundImage: isDesktopStage
            ? "url('/stone-assets/ui/box_table_bg.webp')"
            : `url(${BOARD_BG_URL[matchState.boardTheme]})`,
          backgroundSize: isDesktopStage ? 'cover' : '152% 100%',
          backgroundPosition: isDesktopStage ? 'center' : '44% center',
          '--hs-sx': `${shakeState.ampX}px`,
          '--hs-sy': `${shakeState.ampY}px`,
          '--hs-sr': `${shakeState.rotDeg}deg`,
          '--hs-sd': `${shakeState.durationMs}ms`,
        } as React.CSSProperties
      }
      className={`relative flex h-[100dvh] w-full select-none items-center justify-center overflow-hidden ${
        shakeState.active
          ? shakeState.seq % 2 === 0
            ? 'hs-damage-shake-a'
            : 'hs-damage-shake-b'
          : ''
      }`}
    >
      {/* Top Utility Bar */}
      {topUtilityHeaderEl}

      {/* 60fps Particle & Spell Projectile Canvas */}
      <BoardVfxCanvas events={combinedVfxEvents} onDamageImpact={triggerDamageImpact} />

      {/* ==================== DESKTOP ASPECT-LOCKED HEARTHSTONE BOARD STAGE ==================== */}
      {isDesktopStage ? (
        <>
          <div
            style={{
              width: `min(100vw, calc(100dvh * ${geom.ratio}))`,
              height: `min(100dvh, calc(100vw / ${geom.ratio}))`,
              backgroundImage: `url(${BOARD_BG_URL[matchState.boardTheme]})`,
              backgroundSize: '100% 100%',
            }}
            className="relative overflow-visible shadow-[0_0_64px_rgba(0,0,0,0.95)]"
          >
            {/* Subtle Ambient Vignette + Top-Left Corner Mask */}
            <div className="pointer-events-none absolute inset-0 bg-radial from-transparent via-transparent to-black/50" />
            <div className="pointer-events-none absolute left-0 top-0 h-[11%] w-[15%] bg-gradient-to-br from-stone-950 via-stone-950/85 to-transparent" />

            {/* 4 Interactive Sculpted Board Corner Diorama Hotspots */}
            {cornerToys.map((toy) => {
              const posStyle =
                toy.pos === 'TL'
                  ? { left: '5.5%', top: '8.5%' }
                  : toy.pos === 'TR'
                    ? { right: '5.5%', top: '8.5%' }
                    : toy.pos === 'BL'
                      ? { left: '5.5%', bottom: '9.5%' }
                      : { right: '5.5%', bottom: '9.5%' };
              const isBouncing = activeToyPos === toy.pos;
              return (
                <button
                  key={toy.pos}
                  type="button"
                  data-hs-entity={`TOY_${toy.pos}`}
                  title={tr(`${toy.name} (클릭해 전장 기물 작동)`, `${toy.name} (Click to interact)`)}
                  style={posStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerCornerToy(toy);
                  }}
                  className={`group/toy absolute z-20 flex h-[13%] w-[11.5%] cursor-pointer flex-col items-center justify-end rounded-3xl pb-1.5 transition hover:bg-amber-300/12 hover:ring-1 hover:ring-amber-300/45 ${
                    isBouncing ? 'animate-[hsToyBounce_0.38s_ease-out]' : ''
                  }`}
                >
                  <span className="rounded-full border border-[#c8a158]/70 bg-stone-950/82 px-2 py-0.5 text-[10px] font-extrabold text-amber-200/90 opacity-75 shadow transition group-hover/toy:scale-105 group-hover/toy:border-amber-200 group-hover/toy:opacity-100">
                    {toy.badge} {toy.name.split(' ').slice(-1)[0]}
                  </span>
                </button>
              );
            })}

            {/* Left Carved Stone Action History Tile Strip */}
            <aside
              style={{ left: `${geom.historyX}%`, top: '46%' }}
              className="absolute z-35 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-1 rounded-xl border-2 border-[#a88344]/90 bg-stone-950/88 p-1 shadow-2xl"
            >
              {matchState.history.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    hsAudio.playSfx('card_hover', 0.65);
                    if (item.isHiddenSecret) {
                      setToyToast(
                        tr(
                          '상대편의 비밀입니다! 조건이 충족되어 발동될 때까지 정체가 숨겨집니다.',
                          'Opponent Secret! It stays hidden until triggered.',
                        ),
                      );
                      window.setTimeout(() => setToyToast(null), 2200);
                      return;
                    }
                    if (item.kind === 'FATIGUE' || !cardDb.getCard(item.cardId)) {
                      setToyToast(item.detail);
                      window.setTimeout(() => setToyToast(null), 2200);
                      return;
                    }
                    setZoomState({ kind: 'HISTORY_ITEM', item });
                  }}
                  onMouseEnter={() => setHoveredHistoryItem(item)}
                  onMouseLeave={() => setHoveredHistoryItem(null)}
                  className={`relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 shadow transition hover:scale-112 lg:h-9 lg:w-9 ${
                    item.kind === 'FATIGUE'
                      ? 'border-purple-400 bg-gradient-to-b from-purple-950 to-rose-950'
                      : item.kind === 'MILL_BURN'
                        ? 'border-orange-400 ring-1 ring-orange-500/80'
                        : item.isHiddenSecret
                          ? 'border-fuchsia-400 bg-gradient-to-b from-fuchsia-950 to-stone-950'
                          : item.actorSide === 'PLAYER'
                            ? 'border-sky-400'
                            : 'border-red-500'
                  }`}
                >
                  {item.isHiddenSecret ? (
                    <span className="hs-num text-base font-black text-fuchsia-200">?</span>
                  ) : item.kind === 'FATIGUE' ? (
                    <span className="text-sm font-black text-rose-300">☠</span>
                  ) : (
                    <>
                      <img
                        src={getCardTileUrl(item.cardId)}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      {item.kind === 'MILL_BURN' && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-orange-950/55 text-xs">
                          🔥
                        </span>
                      )}
                    </>
                  )}
                </div>
              ))}
              {matchState.history.length === 0 && (
                <div className="px-1 py-2 text-[9px] font-bold text-stone-400">{tr('기록', 'History')}</div>
              )}
            </aside>

            {/* Right 3D Layered Deck Stacks */}
            <div
              style={{ left: `${geom.deckX}%`, top: '31%' }}
              className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
            >
              {renderDeckSlot('OPPONENT')}
            </div>
            <div
              style={{ left: `${geom.deckX}%`, top: '61.5%' }}
              className="absolute z-30 -translate-x-1/2 -translate-y-1/2"
            >
              {renderDeckSlot('PLAYER')}
            </div>

            {/* Pixel-Exact 3-State Sculpted End Turn Button (100% Covers Painted "END TURN"!) */}
            {renderEndTurnButton('DESKTOP_STAGE')}

            {/* Top Hero Socket (Opponent) */}
            <div
              style={{ left: '50%', top: `${geom.oppHeroY}%` }}
              className="absolute z-25 -translate-x-1/2 -translate-y-1/2"
            >
              {opponentHeroZoneEl}
            </div>

            {/* Tutorial Step Coach Banner */}
            {mode === 'TUTORIAL' && isPlayerTurn && matchState.turnNumber <= 6 && (
              <div
                style={{ left: '50%', top: '25.8%' }}
                className="pointer-events-none absolute z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl border-2 border-emerald-300 bg-emerald-950/92 px-4 py-1 text-xs font-extrabold text-emerald-100 shadow-xl"
              >
                💡 {tr(
                  '초록색 테두리 카드를 전장으로 드래그하거나 클릭해 내고, 깨어난 하수인을 적에게 드래그해 공격하세요!',
                  'Drag or tap green-glowing cards to play, and drag ready minions to attack!',
                )}
              </div>
            )}

            {/* Opponent Minion Row */}
            {opponentMinionRowEl}

            {/* Center Crack Burning Rope Fuse (15s Countdown) */}
            {isPlayerTurn && matchState.turnSecondsLeft <= 15 && (
              <div
                style={{ left: '16%', top: `${geom.crackY}%`, width: '59%' }}
                className="pointer-events-none absolute z-35 flex -translate-y-1/2 items-center"
              >
                <div className="relative h-2.5 w-full rounded-full bg-stone-950/65">
                  <div
                    style={{ width: `${(matchState.turnSecondsLeft / 15) * 100}%` }}
                    className="relative h-full rounded-full bg-gradient-to-r from-amber-700 via-orange-500 to-yellow-200 transition-all duration-1000"
                  >
                    <div className="absolute -right-2 -top-1.5 h-5 w-5 rounded-full bg-yellow-200 shadow-[0_0_16px_#fde047,0_0_28px_#f97316] animate-[hsRopeSpark_0.22s_ease-in-out_infinite]" />
                  </div>
                </div>
                <span className="hs-num ml-2 whitespace-nowrap rounded-full border border-amber-300 bg-red-950/95 px-2 py-0.5 text-xs text-yellow-200 shadow">
                  {matchState.turnSecondsLeft}{tr('초', 's')}
                </span>
              </div>
            )}

            {/* Friendly Minion Row */}
            {friendlyMinionRowEl}

            {/* Bottom Hero Socket (Player) */}
            <div
              style={{ left: '50%', top: `${geom.playerHeroY}%` }}
              className="absolute z-28 -translate-x-1/2 -translate-y-1/2"
            >
              {playerHeroWithEmoteEl}
            </div>

            {/* Bottom-Right 10-Crystal Sapphire Mana Tray */}
            <div
              style={{ right: `${geom.manaRight}%`, bottom: `${geom.manaBottom}%` }}
              className="absolute z-35"
            >
              {renderManaTray()}
            </div>
          </div>

          {/* Docked Player Curved Hand Fan */}
          {renderPlayerHandFan(true)}
        </>
      ) : (
        /* ==================== MOBILE / PORTRAIT RESPONSIVE ARENA ==================== */
        <div className="relative z-20 flex h-full w-full flex-col justify-between pb-1 pt-9">
          <div className="pointer-events-none absolute inset-0 bg-radial from-transparent via-black/15 to-black/75" />

          {/* Opponent Hero */}
          <header className="relative z-20 flex flex-col items-center">
            {opponentHeroZoneEl}
          </header>

          {/* 7v7 Battlefield + Mobile Tactical Bar */}
          <main className="relative z-20 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-1 px-1.5">
            {mode === 'TUTORIAL' && isPlayerTurn && matchState.turnNumber <= 6 && (
              <div className="mx-auto rounded-2xl border-2 border-emerald-300 bg-emerald-950/90 px-3 py-1 text-center text-[11px] font-extrabold text-emerald-100 shadow-lg">
                💡 {tr(
                  '초록색 카드를 전장으로 드래그하거나 터치해 사용하고, 깨어난 하수인으로 적을 공격하세요!',
                  'Drag or tap green cards to play them, then attack enemies with ready minions!',
                )}
              </div>
            )}

            {opponentMinionRowEl}

            {/* Mobile Tactical Divider Bar */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-auto flex w-full items-center justify-between gap-1.5 rounded-2xl border border-[#b8924d]/70 bg-stone-950/90 px-2 py-1 shadow-lg"
            >
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.75);
                  setMobileHistoryOpen(true);
                }}
                className="hs-brass-btn rounded-xl px-2.5 py-1 text-[10.5px] font-extrabold text-amber-100"
              >
                {tr('기록', 'History')} ({matchState.history.length})
              </button>

              <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold">
                <span className="rounded-lg border border-red-400/45 bg-stone-900/95 px-2 py-0.5 text-red-200">
                  {tr('상대덱', 'Opp Deck')} {matchState.opponent.deck.length}
                </span>
                <span className="rounded-lg border border-sky-400/45 bg-stone-900/95 px-2 py-0.5 text-sky-200">
                  {tr('내덱', 'Deck')} {matchState.player.deck.length}
                </span>
                {isPlayerTurn && matchState.turnSecondsLeft <= 15 && (
                  <span className="rounded-lg bg-red-900 px-1.5 py-0.5 text-[10px] text-yellow-200">
                    🔥{matchState.turnSecondsLeft}{tr('초', 's')}
                  </span>
                )}
              </div>

              {renderEndTurnButton('MOBILE_BAR')}
            </div>

            {friendlyMinionRowEl}
          </main>

          {/* Bottom Zone: Player Hero + Mana Tray + Hand */}
          <footer className="relative z-30 flex flex-col items-center">
            <div className="flex w-full flex-col items-center justify-center gap-1 px-2">
              {playerHeroWithEmoteEl}
              {renderManaTray()}
            </div>
            {renderPlayerHandFan(false)}
          </footer>
        </div>
      )}

      {/* Floating Dragged Card Under Cursor (When dragging untargeted card from hand!) */}
      {handDrag?.isDragging && (!handDrag.needsTarget || handDrag.hasChooseOne) && (
        <div
          style={{
            left: handDrag.curX,
            top: handDrag.curY,
            transform: 'translate(-50%, -55%) scale(0.96) rotate(-3deg)',
          }}
          className="pointer-events-none fixed z-[84] drop-shadow-[0_24px_36px_rgba(0,0,0,0.92)]"
        >
          <HearthstoneCard
            card={cardDb.mustGetCard(handDrag.cardId)}
            playableGlow="GREEN"
            size="SM"
          />
        </div>
      )}

      {/* Authentic Left-Side Big Card Showcase: Opponent Play, Hidden Secret, Secret Trigger, Fatigue, or Mill Burn */}
      {playedCardShowcase && (
        <div className="pointer-events-none fixed left-2 top-[44%] z-[81] flex -translate-y-1/2 flex-col items-center animate-[hsCardPlayedShowcase_1.45s_ease-out_forwards] sm:left-6 sm:top-1/2 lg:left-16">
          <div
            className={`mb-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold shadow-lg sm:px-3 sm:text-xs ${
              playedCardShowcase.showcaseType === 'SECRET_TRIGGER' ||
              playedCardShowcase.showcaseType === 'SECRET_HIDDEN'
                ? 'border-fuchsia-300 bg-fuchsia-950/95 text-fuchsia-100'
                : playedCardShowcase.showcaseType === 'FATIGUE'
                  ? 'border-purple-300 bg-purple-950/95 text-rose-200'
                  : playedCardShowcase.showcaseType === 'MILL_BURN'
                    ? 'border-orange-300 bg-red-950/95 text-orange-100'
                    : 'border-red-300 bg-stone-950/95 text-amber-100'
            }`}
          >
            {playedCardShowcase.showcaseType === 'SECRET_TRIGGER'
              ? tr('✦ 비밀 발동!', '✦ Secret Revealed!')
              : playedCardShowcase.showcaseType === 'SECRET_HIDDEN'
                ? tr(`✦ ${playedCardShowcase.actorName} 비밀 시전!`, `✦ ${playedCardShowcase.actorName} Played a Secret!`)
                : playedCardShowcase.showcaseType === 'FATIGUE'
                  ? tr(`☠ ${playedCardShowcase.actorName} 탈진!`, `☠ ${playedCardShowcase.actorName} Fatigue!`)
                  : playedCardShowcase.showcaseType === 'MILL_BURN'
                    ? tr('🔥 손패 초과! 카드 소각', '🔥 Hand Full! Card Burned')
                    : tr(`${playedCardShowcase.actorName} 사용`, `${playedCardShowcase.actorName} Played`)}
          </div>

          {playedCardShowcase.showcaseType === 'SECRET_HIDDEN' ? (
            <div className="flex h-[156px] w-[112px] flex-col items-center justify-between rounded-2xl border-[3px] border-fuchsia-300 bg-gradient-to-b from-fuchsia-900 via-purple-950 to-stone-950 p-3 text-center shadow-[0_18px_36px_rgba(0,0,0,0.92),0_0_24px_rgba(217,70,239,0.75)] sm:h-[246px] sm:w-[178px] sm:p-4">
              <span className="rounded-full border border-fuchsia-300/60 bg-black/45 px-2.5 py-0.5 text-[10px] font-extrabold text-fuchsia-200 sm:text-xs">
                {tr(
                  `${getLocalizedHeroInfo(playedCardShowcase.actorClass, lang).className} 비밀`,
                  `${getLocalizedHeroInfo(playedCardShowcase.actorClass, lang).className} Secret`,
                )}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-200 bg-fuchsia-950 shadow-inner sm:h-24 sm:w-24">
                <span className="hs-num text-4xl font-black text-amber-200 sm:text-6xl">?</span>
              </div>
              <p className="text-[9.5px] font-bold leading-tight text-fuchsia-100 sm:text-xs">
                {tr(
                  '숨겨진 비밀입니다. 조건이 충족되면 발동합니다!',
                  'Hidden Secret. Reveals when its trigger occurs!',
                )}
              </p>
            </div>
          ) : playedCardShowcase.showcaseType === 'FATIGUE' ? (
            <div className="flex h-[156px] w-[112px] flex-col items-center justify-between rounded-2xl border-[3px] border-rose-400 bg-gradient-to-b from-[#3b0764] via-[#450a0a] to-stone-950 p-3 text-center shadow-[0_18px_36px_rgba(0,0,0,0.95),0_0_28px_rgba(244,63,94,0.85)] sm:h-[246px] sm:w-[178px] sm:p-4">
              <span className="hs-title hs-outline-sm text-sm font-extrabold text-rose-200 sm:text-lg">
                {tr('탈진', 'Fatigue')}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-rose-300 bg-black/60 shadow-inner sm:h-24 sm:w-24">
                <span className="text-3xl sm:text-5xl">☠</span>
              </div>
              <p className="rounded-lg border border-rose-400/40 bg-black/55 px-2 py-1 text-[9.5px] font-extrabold leading-tight text-amber-100 sm:text-xs">
                {isKo ? (
                  <>
                    카드가 없습니다!{' '}
                    <span className="text-rose-300">{playedCardShowcase.fatigueDamage || 1}</span>의
                    피해를 받습니다.
                  </>
                ) : (
                  <>
                    Out of cards! Take{' '}
                    <span className="text-rose-300">{playedCardShowcase.fatigueDamage || 1}</span>{' '}
                    damage.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div
              className={
                playedCardShowcase.showcaseType === 'MILL_BURN'
                  ? 'relative animate-[hsCardBurnPulse_0.5s_ease-in-out_infinite]'
                  : ''
              }
            >
              <HearthstoneCard
                card={cardDb.mustGetCard(playedCardShowcase.cardId)}
                size={isCompactMobile ? 'XS' : 'MD'}
              />
              {playedCardShowcase.showcaseType === 'MILL_BURN' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-t from-red-950/75 via-orange-600/25 to-transparent">
                  <span className="hs-title hs-outline rounded-xl border-2 border-orange-300 bg-red-950/90 px-3 py-1 text-xs font-extrabold text-orange-200 sm:text-base">
                    {tr('🔥 파괴됨!', '🔥 Burned!')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="mt-1 max-w-[155px] rounded-xl border border-amber-400/50 bg-stone-950/92 px-2 py-0.5 text-center text-[9.5px] font-bold text-amber-100 shadow-xl sm:max-w-[215px] sm:px-2.5 sm:py-1 sm:text-[11px]">
            {playedCardShowcase.detail}
          </div>
        </div>
      )}

      {/* Second-Player "동전 한 닢" (`GAME_005`) Mulligan Gift Showcase */}
      {coinGiftShowcase && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[86] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center animate-[hsCardPop_0.35s_ease-out]">
          <div className="hs-title hs-outline mb-1.5 text-lg font-extrabold text-yellow-200 sm:text-2xl">
            {tr('추가 카드 획득 — 동전 한 닢!', 'You Go Second — The Coin!')}
          </div>
          <HearthstoneCard card={cardDb.mustGetCard('GAME_005')} playableGlow="GREEN" size="MD" />
        </div>
      )}

      {/* Active Targeting / Placement Helper Bar */}
      {selection && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed left-1/2 top-11 z-[76] flex w-[94%] max-w-md -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border-2 border-amber-300 bg-stone-950/95 px-3 py-1.5 text-xs font-extrabold text-amber-100 shadow-2xl sm:top-14"
        >
          <span className="truncate">
            {selection.kind === 'ATTACKER'
              ? tr('⚔ 공격할 적 영웅 또는 하수인을 클릭하세요', '⚔ Choose an enemy hero or minion to attack')
              : selection.kind === 'HERO_POWER'
                ? tr('✦ 영웅 능력 대상을 선택하세요', '✦ Choose a Hero Power target')
                : selection.kind === 'CHOOSE_OPTION_TARGET'
                  ? tr('✦ 선택한 효과의 대상을 지정하세요', '✦ Choose a target for the selected option')
                  : selection.needsTarget
                    ? tr(
                        `✦ [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}] 대상을 지정하세요`,
                        `✦ Choose target for [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}]`,
                      )
                    : tr(
                        `✦ [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}] 소환할 전장 위치를 클릭하세요`,
                        `✦ Choose board slot for [${getCardName(cardDb.mustGetCard(selection.cardId), lang)}]`,
                      )}
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
                {tr('카드 확대', 'Inspect')}
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
        <svg className="pointer-events-none fixed inset-0 z-[75] h-full w-full">
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
            fill="rgba(239,68,68,0.24)"
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

      {/* History Hover Card Tooltip */}
      {hoveredHistoryItem && (
        <div className="pointer-events-none fixed left-24 top-1/2 z-[80] hidden -translate-y-1/2 items-center gap-3 rounded-2xl border-2 border-amber-300 bg-stone-950/95 p-3 text-amber-100 shadow-2xl sm:flex lg:left-36">
          {hoveredHistoryItem.isHiddenSecret ? (
            <div className="flex h-32 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-fuchsia-300 bg-gradient-to-b from-fuchsia-900 to-stone-950 text-center">
              <span className="hs-num text-3xl font-black text-amber-200">?</span>
              <span className="mt-1 text-[10px] font-extrabold text-fuchsia-200">{tr('비공개 비밀', 'Hidden Secret')}</span>
            </div>
          ) : hoveredHistoryItem.kind === 'FATIGUE' || !cardDb.getCard(hoveredHistoryItem.cardId) ? (
            <div className="flex h-32 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-rose-400 bg-gradient-to-b from-purple-950 to-rose-950 text-center">
              <span className="text-3xl">☠</span>
              <span className="mt-1 text-[11px] font-extrabold text-rose-200">{tr('탈진 피해', 'Fatigue')}</span>
            </div>
          ) : (
            <HearthstoneCard card={cardDb.mustGetCard(hoveredHistoryItem.cardId)} size="SM" />
          )}
          <div className="max-w-[200px]">
            <div className="text-xs font-extrabold text-yellow-300">
              {tr(
                `${hoveredHistoryItem.turn}턴 · ${hoveredHistoryItem.actorSide === 'PLAYER' ? '아군 행동' : '상대 행동'}`,
                `Turn ${hoveredHistoryItem.turn} · ${hoveredHistoryItem.actorSide === 'PLAYER' ? 'Your Action' : 'Enemy Action'}`,
              )}
            </div>
            <div className="mt-1 text-sm font-extrabold text-white">
              {hoveredHistoryItem.isHiddenSecret ? tr('비밀 시전 (정체 숨김)', 'Secret Played') : hoveredHistoryItem.title}
            </div>
            <p className="mt-1 text-xs text-amber-200/85">
              {hoveredHistoryItem.isHiddenSecret
                ? tr(
                    '발동 조건이 충족될 때까지 어떤 비밀인지 공개되지 않습니다.',
                    'Stays hidden until its condition triggers.',
                  )
                : hoveredHistoryItem.detail}
            </p>
          </div>
        </div>
      )}

      {/* Board Minion Hover Full-Card Inspector (Desktop XL) */}
      {liveHoveredBoardMinion && !selection && !handDrag?.isDragging && (
        <div className="pointer-events-none fixed right-6 top-1/2 z-[80] hidden -translate-y-1/2 xl:block">
          <HearthstoneCard
            card={cardDb.mustGetCard(liveHoveredBoardMinion.cardId)}
            size="MD"
          />
        </div>
      )}

      {/* ==================== MOBILE HISTORY OVERLAY ==================== */}
      {mobileHistoryOpen && (
        <div
          onClick={() => setMobileHistoryOpen(false)}
          className="fixed inset-0 z-[105] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hs-wood-panel flex max-h-[78dvh] w-full max-w-sm flex-col rounded-3xl p-4 text-amber-100 shadow-2xl"
          >
            <div className="mb-2.5 flex items-center justify-between border-b border-amber-500/30 pb-2">
              <h3 className="hs-title text-base font-extrabold text-amber-200">
                {tr('전투 행동 기록 (카드를 터치해 확대)', 'Action History (Tap to Inspect)')}
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
                matchState.history.map((item) => {
                  const canZoomItem = !item.isHiddenSecret && Boolean(cardDb.getCard(item.cardId));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (!canZoomItem) return;
                        hsAudio.playSfx('card_hover', 0.65);
                        setZoomState({ kind: 'HISTORY_ITEM', item });
                      }}
                      className="flex w-full items-center gap-2.5 rounded-2xl border border-amber-400/35 bg-stone-950/85 p-2 text-left transition active:scale-[0.99]"
                    >
                      {item.isHiddenSecret ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-fuchsia-400 bg-fuchsia-950 text-lg font-black text-amber-200">
                          ?
                        </div>
                      ) : item.kind === 'FATIGUE' || !cardDb.getCard(item.cardId) ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-rose-400 bg-rose-950 text-lg text-rose-200">
                          ☠
                        </div>
                      ) : (
                        <img
                          src={getCardTileUrl(item.cardId)}
                          alt={item.title}
                          className={`h-10 w-10 shrink-0 rounded-lg border-2 object-cover ${
                            item.actorSide === 'PLAYER' ? 'border-sky-400' : 'border-red-500'
                          }`}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-extrabold text-yellow-300">
                          {tr(
                            `${item.turn}턴 · ${item.actorSide === 'PLAYER' ? '아군' : '상대'} · ${item.isHiddenSecret ? '비밀 시전' : item.title}`,
                            `T${item.turn} · ${item.actorSide === 'PLAYER' ? 'You' : 'Enemy'} · ${item.isHiddenSecret ? 'Secret Played' : item.title}`,
                          )}
                        </div>
                        <div className="truncate text-xs font-bold text-amber-100/90">
                          {item.isHiddenSecret ? tr('발동될 때까지 비공개', 'Hidden until triggered') : item.detail}
                        </div>
                      </div>
                      {canZoomItem && (
                        <span className="shrink-0 text-[10.5px] font-extrabold text-amber-300">
                          {tr('확대 ›', 'View ›')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== FLOATING BANNERS & MODALS ==================== */}

      {/* Official Winged Heraldic Turn Change Splash ("나의 턴" / "YOUR TURN") */}
      {matchState.bannerMessage && !vsIntroActive && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-[82] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center animate-[hsVictoryBannerPop_0.32s_cubic-bezier(0.2,0.9,0.25,1)]">
          <div className="relative flex min-w-[250px] items-center justify-center px-12 py-5 sm:min-w-[360px] sm:px-16 sm:py-7">
            <img
              src="/stone-assets/ui/banner_royal_blue.webp"
              alt=""
              className={`pointer-events-none absolute inset-0 h-full w-full object-fill drop-shadow-[0_18px_36px_rgba(0,0,0,0.92)] ${
                matchState.bannerMessage.includes('상대') || matchState.bannerMessage.includes('ENEMY')
                  ? 'hue-rotate-[140deg] saturate-125'
                  : ''
              }`}
            />
            <div className="hs-title hs-outline relative z-10 text-2xl font-extrabold tracking-widest text-amber-100 sm:text-4xl">
              {matchState.bannerMessage === '내 턴!' || matchState.bannerMessage === 'YOUR TURN!'
                ? tr('나의 턴', 'YOUR TURN')
                : matchState.bannerMessage}
            </div>
          </div>
        </div>
      )}

      {/* AI Action Callout Pill */}
      {aiHighlightText && (
        <div className="pointer-events-none fixed left-1/2 top-12 z-[78] max-w-[90%] -translate-x-1/2 truncate rounded-full border-2 border-amber-300/80 bg-stone-950/92 px-4 py-1 text-xs font-extrabold text-amber-100 shadow-xl sm:top-14 sm:px-5">
          {aiHighlightText}
        </div>
      )}

      {/* Play Error Banner */}
      {matchState.errorBanner && (
        <div className="pointer-events-none fixed bottom-44 left-1/2 z-[85] max-w-[92%] -translate-x-1/2 rounded-2xl border-2 border-red-300 bg-red-950/95 px-4 py-2 text-center text-xs font-extrabold text-red-100 shadow-2xl sm:bottom-48 sm:px-6 sm:text-sm">
          {matchState.errorBanner}
        </div>
      )}

      {/* Corner Toy Reaction Toast */}
      {toyToast && (
        <div className="pointer-events-none fixed left-1/2 top-14 z-[85] max-w-[92%] -translate-x-1/2 rounded-2xl border border-amber-300 bg-stone-950/92 px-4 py-1.5 text-center text-xs font-bold text-amber-200 shadow-xl sm:top-16 sm:px-5">
          {toyToast}
        </div>
      )}

      {/* 1. VS Clash Intro Overlay with Sculpted Hero Arch Portraits */}
      {vsIntroActive && (
        <div className="fixed inset-0 z-[92] flex flex-col items-center justify-center bg-black/84 px-3 backdrop-blur-sm">
          <div className="flex items-center gap-4 sm:gap-14">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-2.5 h-32 w-24 overflow-hidden rounded-t-[48px] rounded-b-xl border-[3.5px] border-[#e7c57c] bg-stone-950 shadow-[0_14px_30px_rgba(0,0,0,0.95)] sm:mb-3 sm:h-44 sm:w-36 sm:rounded-t-[58px] sm:border-[4px]">
                <img
                  src={getHeroArtUrl(CLASSIC_HEROES[matchState.player.heroClass].heroId)}
                  alt=""
                  className="h-full w-full scale-110 object-cover object-top"
                />
                <img
                  src={CLASS_CREST_URL[matchState.player.heroClass]}
                  alt=""
                  className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full border border-amber-200 object-cover shadow sm:h-8 sm:w-8"
                />
              </div>
              <div className="hs-title hs-outline text-lg font-extrabold text-sky-300 sm:text-3xl">
                {getLocalizedHeroInfo(matchState.player.heroClass, lang).name}
              </div>
              <div className="mt-0.5 text-xs font-bold text-amber-200">
                {getLocalizedHeroInfo(matchState.player.heroClass, lang).className}
              </div>
            </div>

            <img
              src="/stone-assets/ui/vs_emblem.webp"
              alt="VS"
              className="h-20 w-20 shrink-0 animate-[hsCardPop_0.5s_ease-out] object-contain drop-shadow-[0_0_32px_rgba(250,204,21,0.9)] sm:h-36 sm:w-36"
            />

            <div className="flex flex-col items-center text-center">
              <div className="relative mb-2.5 h-32 w-24 overflow-hidden rounded-t-[48px] rounded-b-xl border-[3.5px] border-[#e7c57c] bg-stone-950 shadow-[0_14px_30px_rgba(0,0,0,0.95)] sm:mb-3 sm:h-44 sm:w-36 sm:rounded-t-[58px] sm:border-[4px]">
                <img
                  src={getHeroArtUrl(CLASSIC_HEROES[matchState.opponent.heroClass].heroId)}
                  alt=""
                  className="h-full w-full scale-110 object-cover object-top"
                />
                <img
                  src={CLASS_CREST_URL[matchState.opponent.heroClass]}
                  alt=""
                  className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full border border-amber-200 object-cover shadow sm:h-8 sm:w-8"
                />
              </div>
              <div className="hs-title hs-outline text-lg font-extrabold text-red-300 sm:text-3xl">
                {getLocalizedHeroInfo(matchState.opponent.heroClass, lang).name}
              </div>
              <div className="mt-0.5 text-xs font-bold text-amber-200">
                {matchState.opponent.name}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Authentic 1-Click Mulligan Overlay */}
      {!vsIntroActive && matchState.phase === 'MULLIGAN' && (
        <div className="fixed inset-0 z-[88] flex flex-col items-center justify-center overflow-y-auto bg-black/80 p-3 text-center backdrop-blur-sm sm:p-4">
          <div className="hs-wood-panel rounded-2xl px-6 py-2 shadow-2xl sm:px-10">
            <h2 className="hs-title hs-outline text-2xl font-extrabold text-amber-200 sm:text-4xl">
              {tr('시작 카드', 'Starting Hand')}
            </h2>
            <p className="mt-0.5 text-xs font-bold text-amber-100/90 sm:text-sm">
              {tr(
                `교환할 카드 선택 (${matchState.firstPlayer === 'PLAYER' ? '선공 · 3장' : '후공 · 4장 + 동전 한 닢'})`,
                `Choose cards to replace (${matchState.firstPlayer === 'PLAYER' ? 'Going First · 3 Cards' : 'Going Second · 4 Cards + The Coin'})`,
              )}
            </p>
          </div>

          <div
            className={`my-4 items-center justify-center gap-3 sm:my-6 sm:flex sm:flex-wrap sm:gap-5 ${
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
                  className={`flex flex-col items-center gap-1.5 ${
                    mulliganSwapping && marked
                      ? 'animate-[hsMulliganSwapOut_0.42s_ease-in_forwards]'
                      : ''
                  }`}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mulliganSwapping) return;
                      toggleMulliganCard(hc.uid);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (mulliganSwapping) return;
                      hsAudio.playSfx('card_hover', 0.7);
                      setZoomState({ kind: 'MULLIGAN_CARD', handUid: hc.uid });
                    }}
                    className="relative cursor-pointer transition hover:scale-105"
                  >
                    <HearthstoneCard card={def} size={isCompactMobile ? 'XS' : 'MD'} />
                    {marked && (
                      <div className="pointer-events-none absolute inset-x-2 inset-y-3 z-40 flex flex-col items-center justify-center rounded-2xl bg-black/45 animate-[hsMulliganCrossPop_0.22s_ease-out]">
                        <span className="hs-outline text-6xl font-black leading-none text-red-500 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] sm:text-8xl">
                          ✕
                        </span>
                        <span className="hs-title hs-outline-sm -mt-1 rounded-lg border-2 border-red-300 bg-gradient-to-b from-red-700 to-red-950 px-3 py-0.5 text-xs font-extrabold tracking-widest text-white shadow-xl sm:text-sm">
                          {tr('교체', 'Replace')}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={mulliganSwapping}
                    onClick={(e) => {
                      e.stopPropagation();
                      hsAudio.playSfx('card_hover', 0.7);
                      setZoomState({ kind: 'MULLIGAN_CARD', handUid: hc.uid });
                    }}
                    className="rounded-full border border-amber-400/50 bg-stone-950/85 px-2.5 py-0.5 text-[10px] font-bold text-amber-200/90 hover:border-amber-200 hover:text-white disabled:opacity-50"
                  >
                    {tr('카드 확대', 'Inspect')}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={mulliganSwapping}
              onClick={confirmMulliganNow}
              className="hs-arcane-btn hs-title hs-outline-sm rounded-2xl px-12 py-2.5 text-xl font-extrabold tracking-widest text-white shadow-[0_12px_28px_rgba(0,0,0,0.9)] disabled:opacity-75 sm:px-16 sm:py-3 sm:text-2xl"
            >
              {mulliganSwapping ? tr('교체 중...', 'Replacing...') : tr('확인', 'Confirm')}
            </button>
            <button
              type="button"
              data-testid="toggle-autoplay-mulligan"
              data-autoplay-active={autoPlay ? 'true' : 'false'}
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.8);
                setAutoPlay((prev) => {
                  const next = !prev;
                  if (next) setZoomState(null);
                  return next;
                });
              }}
              className={`flex min-h-[48px] items-center gap-2 rounded-2xl border-2 px-5 py-2.5 text-sm font-extrabold shadow-xl transition hover:scale-105 sm:text-base ${
                autoPlay
                  ? 'border-emerald-300 bg-gradient-to-b from-emerald-600 via-teal-800 to-emerald-950 text-white shadow-[0_0_18px_rgba(52,211,153,0.75)]'
                  : 'border-[#c8a158]/80 bg-gradient-to-b from-stone-800 to-stone-950 text-amber-200 hover:border-amber-300'
              }`}
            >
              <span>{autoPlay ? tr('⚙ 자동플레이 ON', '⚙ Auto-Play ON') : tr('⚙ 자동플레이 OFF', '⚙ Auto-Play OFF')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Druid Choose One (선택) Modal */}
      {matchState.chooseOnePrompt && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-black/82 p-3 text-center backdrop-blur-sm sm:p-4">
          <h3 className="hs-title hs-outline mb-3 text-xl font-extrabold text-amber-200 sm:mb-4 sm:text-2xl">
            {tr('선택 — 사용할 효과를 고르세요', 'Choose One')}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {matchState.chooseOnePrompt.options.map((opt) => {
              const optCard = cardDb.mustGetCard(opt.optionCardId);
              const prompt = matchState.chooseOnePrompt!;
              return (
                <button
                  key={opt.index}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hsAudio.playSfx('card_place', 0.85);
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
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
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

      {/* 4. Hunter Tracking (추적) 3-Card Picker Modal */}
      {matchState.trackingPrompt && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-black/82 p-3 text-center backdrop-blur-sm sm:p-4">
          <h3 className="hs-title hs-outline mb-1.5 text-xl font-extrabold text-emerald-300 sm:mb-2 sm:text-2xl">
            {tr('추적 — 손으로 가져올 카드 1장 선택', 'Tracking — Choose a card to draw')}
          </h3>
          <p className="mb-4 text-xs font-bold text-amber-200/85 sm:mb-5">
            {tr(
              '선택하지 않은 나머지 카드는 버려집니다 (우클릭으로 확대 확인 가능).',
              'The other two cards are discarded (right-click to inspect).',
            )}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-5">
            {matchState.trackingPrompt.cards.map((cid, idx) => (
              <div
                key={`${cid}_${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  hsAudio.playSfx('card_place', 0.85);
                  const eng = createEngine(matchState);
                  setMatchState(eng.resolveTrackingChoice(cid));
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setZoomState({ kind: 'TRACKING_CARD', cardId: cid, index: idx });
                }}
                className="cursor-pointer transition hover:scale-108"
              >
                <HearthstoneCard
                  card={cardDb.mustGetCard(cid)}
                  playableGlow="GREEN"
                  size={isCompactMobile ? 'XS' : 'MD'}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Victory / Defeat Heraldry Banner & Ranked Star / Gold Reward Overlay */}
      {matchState.phase === 'GAME_OVER' && (
        <div className="fixed inset-0 z-[94] flex items-center justify-center bg-black/82 p-4 backdrop-blur-md">
          <div className="hs-wood-panel relative flex w-full max-w-md flex-col items-center overflow-hidden rounded-3xl p-6 text-center text-amber-100 animate-[hsVictoryBannerPop_0.45s_cubic-bezier(0.2,0.9,0.25,1)] sm:p-7">
            {matchState.winner === 'PLAYER' && (
              <img
                src="/stone-assets/ui/hs_godrays1.webp"
                alt=""
                className="pointer-events-none absolute -top-16 h-80 w-80 animate-[hsSlowSpin_24s_linear_infinite] object-contain opacity-55 mix-blend-screen"
              />
            )}

            <div className="relative z-10 flex items-center justify-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-t-[48px] rounded-b-xl border-[3.5px] border-[#ebd08c] bg-stone-950 shadow-2xl sm:h-28 sm:w-28">
                <img
                  src={getHeroArtUrl(
                    matchState.winner === 'PLAYER'
                      ? matchState.player.heroId
                      : matchState.opponent.heroId,
                  )}
                  alt=""
                  className={`h-full w-full scale-110 object-cover object-top ${
                    matchState.winner === 'PLAYER' ? '' : 'grayscale-[0.6]'
                  }`}
                />
              </div>
              <img
                src={
                  matchState.winner === 'PLAYER'
                    ? '/stone-assets/ui/medal_legend.webp'
                    : '/stone-assets/ui/medal_bronze.webp'
                }
                alt=""
                className={`-ml-5 mt-12 h-14 w-14 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)] sm:h-16 sm:w-16 ${
                  matchState.winner === 'PLAYER' ? '' : 'grayscale opacity-80'
                }`}
              />
            </div>

            <h2
              className={`hs-title hs-outline relative z-10 mt-2 text-4xl font-extrabold tracking-wider sm:text-5xl ${
                matchState.winner === 'PLAYER' ? 'text-yellow-300' : 'text-slate-300'
              }`}
            >
              {matchState.winner === 'PLAYER' ? tr('승리!', 'Victory!') : tr('패배', 'Defeat')}
            </h2>
            <p className="relative z-10 mt-1 text-xs font-bold text-amber-200/90">
              {matchState.winner === 'PLAYER'
                ? tr(
                    `${matchState.opponent.name}의 초상화가 산산조각 나며 승리를 거두었습니다!`,
                    `${matchState.opponent.name} was defeated!`,
                  )
                : tr(
                    '아군 영웅이 쓰러졌습니다. 덱을 가다듬고 다시 도전해 보세요!',
                    'Your hero has fallen. Refine your deck and try again!',
                  )}
            </p>

            {outcomeSummary && (
              <div className="relative z-10 my-4 w-full space-y-2 rounded-2xl border-2 border-[#c8a158]/55 bg-black/45 p-3.5 text-sm sm:my-5 sm:p-4">
                {outcomeSummary.goldEarned > 0 && (
                  <div className="flex items-center justify-center gap-1.5 font-extrabold text-yellow-300">
                    <HsGoldCoinIcon size={20} />
                    <span>
                      {tr(
                        `승리 · 퀘스트 보상: +${outcomeSummary.goldEarned} 골드 획득!`,
                        `Victory · Quest Reward: +${outcomeSummary.goldEarned} Gold!`,
                      )}
                    </span>
                  </div>
                )}
                {mode === 'RANKED' && (
                  <div className="text-xs font-bold text-amber-100">
                    {tr('등급 현황:', 'Ranked Progress:')}{' '}
                    <span className="text-sky-300">
                      {outcomeSummary.newRank === 0
                        ? tr('전설 등급!', 'Legend Rank!')
                        : tr(
                            `${outcomeSummary.newRank}등급 (${getRankTitle(outcomeSummary.newRank, lang)}) · ★${outcomeSummary.newStars}`,
                            `Rank ${outcomeSummary.newRank} (${getRankTitle(outcomeSummary.newRank, lang)}) · ★${outcomeSummary.newStars}`,
                          )}
                    </span>
                    {outcomeSummary.streakBonus && (
                      <span className="ml-1.5 rounded bg-amber-600 px-1.5 py-0.5 text-[10px] text-white">
                        {tr('연승 별 ×2!', 'Win Streak ×2!')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                hsAudio.playSfx('menu_select');
                hsAudio.playBgm('tavern_hub');
                onExitBattle();
              }}
              className="hs-arcane-btn hs-title hs-outline-sm relative z-10 w-full rounded-2xl py-3 text-lg font-extrabold text-white"
            >
              {tr('계속', 'Continue')}
            </button>
          </div>
        </div>
      )}

      {/* Physical Minion / Hero Lunge -> Impact -> Recoil Clone Overlay */}
      {attackAnim && (() => {
        const isPlayerSide = attackAnim.side === 'PLAYER';
        const dx = attackAnim.targetX - attackAnim.startX;
        const dy = attackAnim.targetY - attackAnim.startY;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / dist;
        const uy = dy / dist;
        const lungeX = attackAnim.targetX - ux * 28;
        const lungeY = attackAnim.targetY - uy * 28;
        const windupX = attackAnim.startX - ux * 16;
        const windupY = attackAnim.startY - uy * 16;

        let cx = attackAnim.startX;
        let cy = attackAnim.startY;
        let scale = 1.18;
        let rot = isPlayerSide ? -4 : 4;
        let opacity = 1;
        let transitionCss = 'transform 115ms cubic-bezier(0.22, 1, 0.36, 1), opacity 140ms ease';

        if (attackAnim.phase === 'WINDUP') {
          cx = windupX;
          cy = windupY;
          scale = 1.24;
          rot = isPlayerSide ? -7 : 7;
        } else if (attackAnim.phase === 'LUNGE') {
          cx = lungeX;
          cy = lungeY;
          scale = 1.32;
          rot = isPlayerSide ? 6 : -6;
          transitionCss = 'transform 155ms cubic-bezier(0.15, 0.85, 0.25, 1)';
        } else if (attackAnim.phase === 'IMPACT_RETURN') {
          cx = attackAnim.startX;
          cy = attackAnim.startY;
          scale = attackAnim.attackerWillDie ? 0.55 : 1.0;
          rot = 0;
          opacity = attackAnim.attackerWillDie ? 0 : 1;
          transitionCss = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 210ms ease-out';
        }

        return (
          <div className="pointer-events-none fixed inset-0 z-[75] overflow-hidden">
            <svg className="absolute inset-0 h-full w-full">
              {attackAnim.phase === 'LUNGE' && (
                <>
                  <line
                    x1={attackAnim.startX}
                    y1={attackAnim.startY}
                    x2={lungeX}
                    y2={lungeY}
                    stroke={isPlayerSide ? 'rgba(56,189,248,0.65)' : 'rgba(248,113,113,0.65)'}
                    strokeWidth={8}
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
                    fill="rgba(251,191,36,0.24)"
                    stroke="#fde047"
                    strokeWidth={4}
                  />
                  <line x1={-46} y1={-36} x2={46} y2={36} stroke="#fef08a" strokeWidth={6} strokeLinecap="round" />
                  <line x1={46} y1={-36} x2={-46} y2={36} stroke="#f87171" strokeWidth={5} strokeLinecap="round" />
                </g>
              )}
            </svg>

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
              <div className="relative flex items-center justify-center">
                {!attackAnim.isHeroAttacker && attackAnim.taunt && (
                  <img
                    src="/stone-assets/ui/taunt_shield.webp"
                    alt=""
                    className="pointer-events-none absolute left-1/2 top-1/2 h-[82px] w-[70px] max-w-none -translate-x-1/2 -translate-y-1/2 object-fill sm:h-[138px] sm:w-[116px]"
                  />
                )}
                <div
                  style={{
                    background: attackAnim.isHeroAttacker
                      ? attackAnim.frameGradient
                      : 'radial-gradient(circle at 50% 35%, #475569 0%, #0f172a 100%)',
                    boxShadow: isPlayerSide
                      ? '0 24px 36px rgba(0,0,0,0.92), 0 0 24px rgba(74,222,128,0.85)'
                      : '0 24px 36px rgba(0,0,0,0.92), 0 0 24px rgba(248,113,113,0.92)',
                  }}
                  className={`relative z-10 overflow-hidden ${
                    attackAnim.isHeroAttacker
                      ? 'h-[82px] w-[72px] rounded-t-[40px] rounded-b-xl border-[3.5px] border-[#f5d98e] sm:h-[116px] sm:w-[100px] sm:rounded-t-[52px]'
                      : 'h-[57px] w-[45px] rounded-[50%] sm:h-[100px] sm:w-[80px]'
                  }`}
                >
                  <img
                    src={attackAnim.artUrl}
                    alt={attackAnim.nameKo}
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-cover object-center"
                  />
                </div>
                {!attackAnim.isHeroAttacker && (
                  <img
                    src="/stone-assets/ui/minion_oval_bezel.webp"
                    alt=""
                    className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[63px] w-[50px] max-w-none -translate-x-1/2 -translate-y-1/2 object-fill sm:h-[111px] sm:w-[90px]"
                  />
                )}
                {attackAnim.divineShield && (
                  <img
                    src="/stone-assets/ui/divine_shield.webp"
                    alt=""
                    className="pointer-events-none absolute left-1/2 top-1/2 z-25 h-[64px] w-[51px] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-[50%] object-cover opacity-88 mix-blend-screen sm:h-[115px] sm:w-[93px]"
                  />
                )}
                <div className="pointer-events-none absolute -bottom-2 -left-2.5 z-30 scale-75 sm:scale-100">
                  <HsAttackBadge value={attackAnim.attackVal} size={36} />
                </div>
                <div className="pointer-events-none absolute -bottom-2.5 -right-2.5 z-30 scale-75 sm:scale-100">
                  <HsHealthBadge value={attackAnim.healthVal} size={35} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Universal Enlarged Card Inspection & Bottom Action Modal */}
      {renderActiveZoomModal()}
    </div>
  );
};
