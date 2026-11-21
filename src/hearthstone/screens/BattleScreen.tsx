import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isKoreanLanguage, setLanguage, tr, useHeroLanguage } from '../../i18n/heroLang';
import { portalGameplayStart, portalGameplayStop } from '../portalBridge';
import { extractShortHeroCalloutName, hsAudio } from '../audio';
import {
  CLASSIC_RANK_NAMES,
  CLASS_CREST_URL,
  buildBogartRandomDeck,
  cardDb,
  encodeDeckShareCode,
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
import { LiveBattleHelpSnapshot } from '../components/KadanChatbotWidget';
import { SiliaSkillKind } from '../components/SiliaUltimateWidget';
import { CARD_SCRIPTS } from '../engine/cardEffects';
import {
  PvpGuestAction,
  flipEntityId,
  mirrorMatchStateForGuest,
} from '../engine/pvpSync';
import { snsheroLiveNetwork } from '../services/snsheroLiveNetwork';
import {
  trackHeroBattleCompleted,
  trackHeroBattleStarted,
} from '../services/analyticsEvents';
import {
  gradeRhythmPerformance,
  playFactionChord,
  playRhythmCue,
} from '../services/rhythmCueEngine';
import { downloadVictoryCertificatePng } from '../utils/victoryCardShare';
import {
  StoryDuelDialogueOverlay,
  StoryEpisodeSelectorModal,
  StoryVictorySceneOverlay,
} from '../components/StoryEncounterOverlays';
import { QuickRulesModal, hasSeenQuickRules } from '../components/OnboardingGuideModal';
import { getStoryEpisodeEncounter } from '../storyEncounterData';
import { useModalDismiss } from '../useModalDismiss';
import {
  SNS_LOCATIONS,
  SnsBoosterPackArt,
  SnsCardBackArt,
  SnsRankMedallion,
} from '../components/SnsHeroArtKit';
import { AiAction, buildAiOpponentSetup, computeNextAiAction, didHistoryAdvance } from '../engine/aiController';
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
import {
  DefeatPackReinforcementResult,
  OpenedPackCard,
  getEquippedPrestigeSummary,
  hsStorage,
} from '../storage';
import { rollOnlineChallenger } from './HeroDeckSelectScreen';
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
  ChallengerMeta,
  ClassicCardDef,
  CustomDeck,
  GameMode,
  HeroClass,
  KadanTacticalStance,
  MatchRewardBreakdown,
  MinionInstance,
  PlayerBattleState,
  PlayerSide,
  VfxEvent,
  VfxKind,
} from '../types';
import {
  ArchetypePresetId,
  PreBattleDeckModal,
  buildArchetypePresets,
} from '../components/PreBattleDeckModal';
import { BoardVfxCanvas, recordEntityStagePosition } from '../vfx/BoardVfxCanvas';

/** DEV-024: Determine Kadan's stance-aware Mulligan Keep/Swap recommendation for a starting card. */
function getKadanMulliganAdvice(
  def: ReturnType<typeof cardDb.mustGetCard>,
  stance: KadanTacticalStance,
  awakeningMult: number,
): 'KEEP' | 'SWAP' {
  if (stance === 'AGGRO') {
    if (def.cost <= 2 || (def.cost === 3 && def.mechanics.includes('CHARGE'))) {
      return 'KEEP';
    }
    return def.cost <= 3 && def.type === 'MINION' ? 'KEEP' : 'SWAP';
  }
  if (stance === 'CONTROL') {
    if (
      def.cost <= 3 ||
      def.mechanics.includes('TAUNT') ||
      (def.type === 'SPELL' && def.cost <= 4)
    ) {
      return 'KEEP';
    }
    return 'SWAP';
  }
  if (stance === 'AWAKENING') {
    if (def.cost <= 3 || (awakeningMult >= 3 && def.cost <= 4)) {
      return 'KEEP';
    }
    return 'SWAP';
  }
  return def.cost <= 3 ? 'KEEP' : 'SWAP';
}

/** DEV-025: Analyze why the player lost from board/deck/turn state and recommend a counter Preset + Kadan Stance. */
function diagnoseDefeatAndCounter(
  ms: BattleMatchState,
  isKo: boolean,
): {
  reasonText: string;
  presetId: ArchetypePresetId;
  presetLabel: string;
  stance: KadanTacticalStance;
  stanceLabel: string;
} {
  const oppTaunts = ms.opponent.board.filter((m) => hasMinionTaunt(m)).length;
  const oppBoardSize = ms.opponent.board.length;
  const playerDeckEmpty = ms.player.deck.length === 0;
  if (playerDeckEmpty) {
    return {
      reasonText: tr('30장 덱이 모두 소진되어 탈진 피해를 입었어요! 템포가 빠른 속공 덱으로 초중반에 끝내보세요.', 'Your 30-card deck ran out into Fatigue! Close games faster with an Aggro Rush preset.'),
      presetId: 'AGGRO',
      presetLabel: tr('속공 돌파형', 'Aggro Rush'),
      stance: 'AGGRO',
      stanceLabel: tr('공격적(맹공)', 'Aggro'),
    };
  }
  if (oppTaunts >= 1) {
    return {
      reasonText: tr('적 도발(Taunt) 방패벽에 공격이 가로막혔어요! 고화력 3배 각성 일격 덱으로 도발을 단숨에 돌파하세요.', 'Enemy Taunt minions blocked your attacks! Smash through with 3x Awakening powerhouses.'),
      presetId: 'AWAKENING',
      presetLabel: tr('3배 각성 일격형', '3x Awakening'),
      stance: 'AWAKENING',
      stanceLabel: tr('각성연계', 'Awakening'),
    };
  }
  if (oppBoardSize >= 3 || ms.turnNumber <= 7) {
    return {
      reasonText: tr('적의 다수 하수인 공세에 명치가 먼저 뚫렸어요! 도발·제압기 중심 철벽 반격형으로 필드를 잠그세요.', 'Enemy board pressure overwhelmed your Hero! Stabilize with Taunts & removals.'),
      presetId: 'CONTROL',
      presetLabel: tr('철벽 반격형', 'Taunt & Control'),
      stance: 'CONTROL',
      stanceLabel: tr('방어적(수비)', 'Control'),
    };
  }
  return {
    reasonText: tr('후반 에이스 싸움에서 화력이 살짝 부족했어요! 보유 ×3 각성 카드를 최우선 편성해 재도전하세요.', 'Late-game firepower fell slightly short! Deploy your ×3 Awakened aces to overpower them.'),
    presetId: 'AWAKENING',
    presetLabel: tr('3배 각성 일격형', '3x Awakening'),
    stance: 'AWAKENING',
    stanceLabel: tr('각성연계', 'Awakening'),
  };
}

/** DEV-025: Pick the #1 Battle MVP card from match history & surviving board (highlighting 3x Awakened cards). */
function computeBattleMvpCard(
  ms: BattleMatchState,
  fallbackDeckCards: string[],
): { card: ClassicCardDef; mult: number;plays: number } | null {
  const multMap = ms.journeyMeta?.playerCardMultipliers || {};
  const scores = new Map<string, { score: number; plays: number }>();

  for (const h of ms.history) {
    if (h.actorSide !== 'PLAYER' || !h.cardId) continue;
    const def = cardDb.getCard(h.cardId);
    if (!def || !def.collectible) continue;
    const mult = multMap[def.id] || 1;
    const prev = scores.get(def.id) || { score: 0, plays: 0 };
    const impact =
      (def.cost || 1) * 3 +
      ((def.attack || 0) + (def.health || 0)) * mult +
      (def.rarity === 'LEGENDARY' ? 14 : def.rarity === 'EPIC' ? 8 : 0) +
      (mult >= 3 ? 25 : 0);
    scores.set(def.id, { score: prev.score + impact, plays: prev.plays + 1 });
  }

  for (const m of ms.player.board) {
    const def = cardDb.getCard(m.cardId);
    if (!def || !def.collectible) continue;
    const mult = multMap[def.id] || 1;
    const prev = scores.get(def.id) || { score: 0, plays: 1 };
    scores.set(def.id, {
      score: prev.score + getMinionAttack(m) * 3 + (mult >= 3 ? 20 : 6),
      plays: Math.max(1, prev.plays),
    });
  }

  let bestId: string | null = null;
  let bestScore = -1;
  let bestPlays = 1;
  for (const [cid, val] of scores.entries()) {
    if (val.score > bestScore) {
      bestScore = val.score;
      bestId = cid;
      bestPlays = val.plays;
    }
  }
  if (!bestId && fallbackDeckCards.length > 0) {
    bestId = fallbackDeckCards[0];
  }
  if (!bestId) return null;
  const card = cardDb.getCard(bestId);
  if (!card) return null;
  return { card, mult: multMap[card.id] || 1, plays: bestPlays };
}

type KadanSpiritPhase = 'CHARGING' | 'IGNITING' | 'READY';

interface CenterRhythmRingHudProps {
  rhythmEnabled: boolean;
  battleBpm: number;
  autoSpeed2x: boolean;
  onToggleSpeed2x: () => void;
  isBossParryReady: boolean;
  kadanMomentumCount: number;
  spiritPhase: KadanSpiritPhase;
  rhythmFlash: {
    mult: 1 | 1.5 | 2;
    grade: 'NORMAL' | 'GOOD' | 'PERFECT';
    stackGain: 1 | 10;
    parried?: boolean;
    seq: number;
  } | null;
  onTap: () => void;
}

const CenterRhythmRingHud: React.FC<CenterRhythmRingHudProps> = ({
  rhythmEnabled,
  battleBpm,
  autoSpeed2x,
  onToggleSpeed2x,
  isBossParryReady,
  kadanMomentumCount,
  spiritPhase,
  rhythmFlash,
  onTap,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const ringRef = useRef<HTMLSpanElement | null>(null);
  const pulseCoreRef = useRef<HTMLSpanElement | null>(null);
  const pulseWaveRef = useRef<HTMLSpanElement | null>(null);
  const cueTextRef = useRef<HTMLSpanElement | null>(null);

  const isBlazing = spiritPhase === 'IGNITING' || spiritPhase === 'READY';
  const isIgniting = spiritPhase === 'IGNITING';
  const isReady = spiritPhase === 'READY';

  useEffect(() => {
    if (!rhythmEnabled || isBlazing) return;
    let rafId = 0;
    let lastTapState: boolean | null = null;

    const applyFrame = () => {
      if (document.visibilityState === 'visible') {
        const info = hsAudio.getBeatPhaseInfo(battleBpm, autoSpeed2x);
        const ringEl = ringRef.current;
        const coreEl = pulseCoreRef.current;
        const waveEl = pulseWaveRef.current;
        const cueEl = cueTextRef.current;

        if (ringEl) {
          ringEl.style.transform = `scale(${info.ringScale.toFixed(3)})`;
          if (info.isTapWindow) {
            ringEl.style.borderColor = '#22c55e';
            ringEl.style.backgroundColor = 'rgba(34, 197, 94, 0.22)';
            ringEl.style.boxShadow =
              '0 0 22px rgba(34, 197, 94, 0.95), inset 0 0 12px rgba(74, 222, 128, 0.55)';
            ringEl.dataset.ringState = 'green';
          } else {
            ringEl.style.borderColor = '#ef4444';
            ringEl.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
            ringEl.style.boxShadow = '0 0 14px rgba(239, 68, 68, 0.8)';
            ringEl.dataset.ringState = 'red';
          }
        }

        if (coreEl) {
          coreEl.style.transform = `scale(${(1 + info.pulse01 * 0.15).toFixed(3)})`;
          coreEl.style.borderColor = info.isTapWindow
            ? 'rgba(74, 222, 128, 0.95)'
            : 'rgba(248, 113, 113, 0.85)';
        }

        if (waveEl) {
          const waveScale = 1 + (1 - info.pulse01) * 0.5;
          waveEl.style.transform = `scale(${waveScale.toFixed(3)})`;
          waveEl.style.opacity = (info.pulse01 * 0.55).toFixed(2);
          waveEl.style.borderColor = info.isTapWindow ? '#4ade80' : '#f87171';
        }

        if (cueEl && lastTapState !== info.isTapWindow) {
          lastTapState = info.isTapWindow;
          cueEl.textContent = info.isTapWindow ? 'TAP+10' : tr('연타+1', 'TAP+1');
          cueEl.style.color = info.isTapWindow ? '#86efac' : '#fca5a5';
        }
      }
      rafId = window.requestAnimationFrame(applyFrame);
    };

    rafId = window.requestAnimationFrame(applyFrame);
    return () => window.cancelAnimationFrame(rafId);
  }, [rhythmEnabled, isBlazing, battleBpm, autoSpeed2x, isKo]);

  return (
    <div
      data-testid="kadan-command-orb"
      data-spirit-phase={spiritPhase}
      className={`pointer-events-none fixed bottom-2.5 left-1/2 flex -translate-x-1/2 select-none flex-col items-center sm:bottom-3.5 ${
        isBlazing ? 'z-[93]' : 'z-[71]'
      }`}
    >
      {rhythmEnabled && (
        <div className="relative flex h-[68px] w-[62px] items-center justify-center sm:h-[80px] sm:w-[74px]">
          <button
            type="button"
            data-testid="ocarina-rhythm-ring-btn"
            data-spirit-phase={spiritPhase}
            disabled={isIgniting}
            onClick={(e) => {
              e.stopPropagation();
              if (isIgniting) return;
              onTap();
            }}
            title={
              isIgniting
                ? tr('🔥 카단의 기세 100 충전! 1초간 점화 중...', "🔥 Kadan's Spirit 100 Charged! Igniting for 1s...")
                : isReady
                  ? tr('🔥 필살기 준비 완료! 지금 탭하여 필살기 작렬!', '🔥 Ultimate Ready! Tap now to UNLEASH!')
                  : tr(
                      '카단의 기세 (스토리 전용) — 연타 +1 · 초록 정박 +10! (100 충전 후 탭하여 필살기 발동)',
                      "Kadan's Spirit (Story Mode) — Mash +1 · Green Beat +10! (Charge to 100, then tap to unleash)",
                    )
            }
            className={`pointer-events-auto relative flex h-14 w-14 touch-manipulation items-center justify-center rounded-full focus:outline-none sm:h-16 sm:w-16 ${
              isIgniting
                ? 'cursor-not-allowed scale-105'
                : isReady
                  ? 'cursor-pointer scale-110 active:scale-95'
                  : 'cursor-pointer active:scale-92'
            }`}
          >
            {/* X100 Blazing Fire Aura, Dancing SVG Flame Crown & Rising Embers */}
            {isBlazing && (
              <>
                <span
                  data-testid="kadan-spirit-flame-aura"
                  className="hs-spirit-flame-aura pointer-events-none absolute -inset-5 rounded-full"
                  style={{
                    background: isReady
                      ? 'radial-gradient(circle, rgba(254,249,195,0.98) 0%, rgba(251,146,60,0.92) 44%, rgba(220,38,38,0.72) 70%, rgba(127,29,29,0) 100%)'
                      : 'radial-gradient(circle, rgba(253,224,71,0.9) 0%, rgba(249,115,22,0.85) 46%, rgba(185,28,28,0.6) 72%, rgba(127,29,29,0) 100%)',
                    filter: 'blur(3px)',
                  }}
                />
                <svg
                  viewBox="-24 -44 128 148"
                  className="pointer-events-none absolute -inset-6 h-[calc(100%+48px)] w-[calc(100%+48px)] overflow-visible drop-shadow-[0_0_10px_rgba(249,115,22,0.95)]"
                >
                  <g className="hs-spirit-flame-a">
                    <path
                      d="M40,-42 C50,-22 58,-8 54,12 C66,-14 78,-6 74,18 C88,6 92,28 82,52 C72,76 54,88 40,88 C26,88 8,76 -2,52 C-12,28 -8,6 6,18 C2,-6 14,-14 26,12 C22,-8 30,-22 40,-42 Z"
                      fill="#dc2626"
                    />
                    <path
                      d="M40,-30 C48,-14 54,0 50,18 C62,-2 70,6 66,26 C76,18 78,34 70,52 C62,70 50,80 40,80 C30,80 18,70 10,52 C2,34 4,18 14,26 C10,6 18,-2 30,18 C26,0 32,-14 40,-30 Z"
                      fill="#f97316"
                    />
                  </g>
                  <g className="hs-spirit-flame-b">
                    <path
                      d="M20,-24 C28,-8 32,6 28,22 C35,-4 43,-24 52,-26 C57,-8 60,8 56,24 C66,12 72,28 64,48 C54,68 26,68 16,48 C8,28 14,12 24,24 C20,8 15,-8 20,-24 Z"
                      fill="#facc15"
                    />
                    <path
                      d="M40,-18 C48,-2 54,14 50,32 C45,52 35,52 30,32 C26,14 32,-2 40,-18 Z"
                      fill="#fef9c3"
                    />
                  </g>
                  {isIgniting && (
                    <circle
                      cx="40"
                      cy="40"
                      r="30"
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="4"
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                      className="hs-spirit-ignite-ring"
                    />
                  )}
                </svg>
                {[
                  { left: '10%', delay: '0s' },
                  { left: '28%', delay: '0.16s' },
                  { left: '50%', delay: '0.32s' },
                  { left: '72%', delay: '0.1s' },
                  { left: '88%', delay: '0.44s' },
                ].map((emb, idx) => (
                  <span
                    key={idx}
                    style={{ left: emb.left, animationDelay: emb.delay }}
                    className="hs-spirit-ember pointer-events-none absolute -top-1 h-2 w-2 rounded-full bg-yellow-100 shadow-[0_0_10px_#f97316]"
                  />
                ))}
              </>
            )}

            {/* Charging Phase: BGM Heartbeat Expanding Pulse + Shrinking Green/Red Ring */}
            {!isBlazing && (
              <>
                <span
                  ref={pulseWaveRef}
                  className="pointer-events-none absolute inset-0 rounded-full border-2 border-emerald-400 opacity-0"
                />
                <span
                  ref={ringRef}
                  data-testid="ocarina-shrinking-ring"
                  data-ring-state="red"
                  className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-rose-500"
                />
              </>
            )}

            {/* Inner Core Circle */}
            <span
              ref={pulseCoreRef}
              className={`pointer-events-none relative flex h-full w-full flex-col items-center justify-center rounded-full border-2 shadow-[0_6px_18px_rgba(0,0,0,0.9)] ${
                isReady
                  ? 'border-yellow-200 bg-gradient-to-b from-amber-500 via-orange-600 to-red-900 shadow-[0_0_24px_rgba(251,146,60,0.95)]'
                  : isIgniting
                    ? 'border-orange-300 bg-gradient-to-b from-orange-700 via-red-800 to-stone-950 shadow-[0_0_18px_rgba(239,68,68,0.9)]'
                    : 'border-rose-400/85 bg-[#090d16]/95'
              }`}
            >
              <span className="text-sm leading-none sm:text-base">
                {isBlazing ? '🔥' : isBossParryReady ? '🛡' : '⚔️'}
              </span>
              <span
                ref={isBlazing ? undefined : cueTextRef}
                className={`mt-0.5 text-[8.5px] font-black leading-none tracking-tight sm:text-[9.5px] ${
                  isReady
                    ? 'text-yellow-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]'
                    : isIgniting
                      ? 'text-amber-200'
                      : 'text-rose-300'
                }`}
              >
                {isIgniting
                  ? tr('1초대기', 'WAIT 1s')
                  : isReady
                    ? tr('필살기!', 'FIRE!')
                    : tr('연타+1', 'TAP+1')}
              </span>
            </span>

            {/* Top Floating Status / Hit Feedback Badge */}
            {isIgniting ? (
              <span
                data-testid="spirit-igniting-badge"
                className="pointer-events-none absolute -top-5 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-200 bg-gradient-to-r from-orange-600 to-red-700 px-2 py-0.5 text-[9.5px] font-black text-yellow-100 shadow-[0_0_12px_rgba(249,115,22,0.9)]"
              >
                {tr('🔥 100 점화 중 (1초)', '🔥 IGNITING (1s)')}
              </span>
            ) : isReady ? (
              <span
                data-testid="spirit-ready-badge"
                className="pointer-events-none absolute -top-5 left-1/2 z-30 -translate-x-1/2 animate-bounce whitespace-nowrap rounded-full border-2 border-yellow-100 bg-gradient-to-r from-yellow-300 via-amber-500 to-orange-600 px-2.5 py-0.5 text-[10px] font-black text-stone-950 shadow-[0_0_16px_rgba(250,204,21,0.95)]"
              >
                {tr('🔥 필살기 작렬! (탭!)', '🔥 TAP TO UNLEASH!')}
              </span>
            ) : (
              rhythmFlash && (
                <span
                  key={rhythmFlash.seq}
                  data-testid="rhythm-multiplier-badge"
                  className={`pointer-events-none absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black shadow-lg ${
                    rhythmFlash.parried
                      ? 'border-cyan-200 bg-cyan-500 text-stone-950'
                      : rhythmFlash.stackGain === 10
                        ? 'border-yellow-100 bg-emerald-400 text-stone-950 shadow-[0_0_12px_rgba(74,222,128,0.85)]'
                        : 'border-sky-300/90 bg-sky-900/95 text-sky-100'
                  }`}
                >
                  {rhythmFlash.parried
                    ? '🛡+10'
                    : rhythmFlash.stackGain === 10
                      ? '+10⚡'
                      : '+1'}
                </span>
              )
            )}
          </button>

          {/* Side Cumulative Gauge Badge (`0/100` .. `🔥100`) */}
          <div
            data-testid="kadan-momentum-side-box"
            className="pointer-events-none absolute right-[calc(100%-6px)] top-1/2 z-20 flex -translate-y-1/2 flex-col items-center justify-center sm:left-full sm:right-auto sm:ml-1.5"
          >
            <span
              data-testid="kadan-x-stack-badge"
              className={`whitespace-nowrap rounded-lg border px-1.5 py-0.5 font-black leading-none shadow-lg transition-transform duration-150 ${
                isBlazing
                  ? 'border-2 border-yellow-200 bg-gradient-to-b from-amber-500 via-orange-600 to-red-900 text-[10.5px] text-yellow-100 shadow-[0_0_16px_rgba(251,146,60,0.95)] sm:px-2 sm:text-xs'
                  : kadanMomentumCount > 0
                    ? 'border-emerald-300/80 bg-emerald-950/95 text-[10px] text-emerald-200 sm:text-[11px]'
                    : 'border-sky-400/40 bg-stone-950/90 text-[9.5px] text-sky-300/75 sm:text-[10.5px]'
              }`}
            >
              {isBlazing ? '🔥100' : `${kadanMomentumCount}/100`}
            </span>
          </div>
        </div>
      )}

      {/* Slim Boot Pill: `카단의 기세` */}
      <div
        className={`pointer-events-auto -mt-0.5 flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold shadow-[0_4px_10px_rgba(0,0,0,0.9)] sm:px-2.5 sm:text-[10.5px] ${
          isBlazing
            ? 'border-amber-300 bg-red-950/95 text-yellow-200 shadow-[0_0_14px_rgba(249,115,22,0.75)]'
            : 'border-sky-300/65 bg-stone-950/95 text-amber-100'
        }`}
      >
        <button
          type="button"
          data-testid="rhythm-speed-2x-btn"
          onClick={(e) => {
            e.stopPropagation();
            hsAudio.playSfx('ui_click', 0.65);
            onToggleSpeed2x();
          }}
          className={`rounded-full px-1 py-0.2 font-black ${
            autoSpeed2x ? 'bg-cyan-400 text-stone-950' : 'bg-white/10 text-emerald-300'
          }`}
          title={tr('2박 강박 / 4박 마디 전환', 'Toggle 2-Beat / 4-Beat Mode')}
        >
          {autoSpeed2x ? '4B' : '2B'}
        </button>

        <span className={isBlazing ? 'font-black text-yellow-200' : 'font-black text-sky-200'}>
          {isBlazing ? tr('🔥 기세 폭발!', '🔥 MAX SPIRIT!') : tr('카단의 기세', 'Kadan Spirit')}
        </span>
      </div>
    </div>
  );
};

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
  onStartJourneyEpisode?: (
    episode: number,
    skipStoryIntro?: boolean,
    keepAutoPlay?: boolean,
  ) => void;
  onRematchSameMode?: () => void;
  onRematchWithPreset?: (presetId: ArchetypePresetId, stance: KadanTacticalStance) => void;
  externalAutoPlay?: boolean;
  onAutoPlayChange?: (active: boolean) => void;
  tacticalStance?: KadanTacticalStance;
  onTacticalStanceChange?: (stance: KadanTacticalStance) => void;
  onBattleHelpSnapshot?: (snapshot: LiveBattleHelpSnapshot) => void;
  initialPresetId?: ArchetypePresetId;
  openPresetModalOnStart?: boolean;
  bogartStakeGold?: number;
  bogartDifficulty?: 'NORMAL' | 'EXPERT';
  challengerMeta?: ChallengerMeta;
  restoredMatchState?: BattleMatchState;
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
  stageX: number;
  stageY: number;
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
  {
    pos: 'TL' | 'TR' | 'BL' | 'BR';
    icon: string;
    vfxKind: VfxKind;
    name: string;
    nameEn: string;
    reaction: string;
    reactionEn: string;
  }[]
> = {
  STORMWIND: [
    { pos: 'TL', icon: '🔔', vfxKind: 'TOY_BELL', name: '엘윈마을 설원 종탑', nameEn: 'Elwin Snowfield Bell Tower', reaction: '땡~ 땡~! 엘윈마을 설원 종탑의 종소리가 맑게 울려 퍼집니다!', reactionEn: 'Clang~ clang! The Elwin Snowfield bell rings crystal clear!' },
    { pos: 'TR', icon: '🏮', vfxKind: 'TOY_SPARKS', name: '설원 온기 등불', nameEn: 'Warm Frost Lantern', reaction: '화르륵! 엘윈마을 청동 등불이 따스하게 타오릅니다!', reactionEn: 'Whoosh! Elwin Village’s bronze lantern glows warmly!' },
    { pos: 'BL', icon: '🛡', vfxKind: 'TOY_SPARKS', name: '눈꽃 방패 거치대', nameEn: 'Snowflake Shield Rack', reaction: '챙! 카단의 눈꽃 방패에서 푸른 서리빛이 반짝입니다!', reactionEn: 'Clang! Kadan’s Snowflake Shield shimmers with frostlight!' },
    { pos: 'BR', icon: '❄️', vfxKind: 'TOY_SPLASH', name: '엘윈 빙결 수정', nameEn: 'Elwin Frost Crystal', reaction: '반짝! 만년설 빙결 수정 속에서 오로라 빛이 춤춥니다!', reactionEn: 'Sparkle! Aurora light dances inside the permafrost crystal!' },
  ],
  ORGRIMMAR: [
    { pos: 'TL', icon: '☄', vfxKind: 'TOY_CATAPULT', name: '성채 공성 투석기', nameEn: 'Citadel Siege Catapult', reaction: '부우웅— 쾅!! 성채 투석기 화염석이 전장 너머로 발사됩니다!', reactionEn: 'Whoosh—BOOM! A siege boulder launches across the citadel!' },
    { pos: 'TR', icon: '⚒', vfxKind: 'TOY_SPARKS', name: '황금 제련 모루', nameEn: 'Gilded Forge Anvil', reaction: '깡! 깡! 달궈진 강철 모루에서 불꽃 파편이 튱니다!', reactionEn: 'Clink! Sparks fly off the glowing forge anvil!' },
    { pos: 'BL', icon: '🔥', vfxKind: 'TOY_SPARKS', name: '불꽃 성채 화로', nameEn: 'Flame Citadel Brazier', reaction: '활활! 불꽃 성채의 용암 화로에서 뜨거운 불길이 솟구칩니다!', reactionEn: 'Roar! Fierce flames surge from the Flame Citadel brazier!' },
    { pos: 'BR', icon: '🥁', vfxKind: 'TOY_DRUM', name: '결투장 전고', nameEn: 'Arena War Drum', reaction: '둥! 둥! 불꽃 성채 결투장의 우렁찬 북소리가 울립니다!', reactionEn: 'Boom! Boom! Thunderous war drums echo across the arena!' },
  ],
  PANDARIA: [
    { pos: 'TL', icon: '🎐', vfxKind: 'TOY_BELL', name: '바람 신전 비취 풍경', nameEn: 'Jade Wind Chime', reaction: '딸랑~! 바람의 신전 비취 풍경 소리가 은은하게 퍼집니다!', reactionEn: 'Ting-ling~ Gentle jade chimes drift across the Wind Shrine!' },
    { pos: 'TR', icon: '🌊', vfxKind: 'TOY_SPLASH', name: '천공 폭포 수차', nameEn: 'Sky Cascade Mill', reaction: '쏴아아~ 구름 너머 천공 폭포수가 시원하게 쏟아집니다!', reactionEn: 'Whoosh~ Skyfall waters tumble cleanly past the clouds!' },
    { pos: 'BL', icon: '🌱', vfxKind: 'TOY_RADISH', name: '신전 약초 텃밭', nameEn: 'Sanctuary Herb Patch', reaction: '쑥! 바람 신전 텃밭에서 탐스러운 영초 뿌리를 뽑았습니다!', reactionEn: 'Pop! Plucked a plump spirit root from the Sanctuary garden!' },
    { pos: 'BR', icon: '🍃', vfxKind: 'TOY_SPARKS', name: '신록의 에메랄드 석등', nameEn: 'Verdant Emerald Lantern', reaction: '반짝~ 에메랄드 룬 석등에서 청량한 바람 기운이 피어오릅니다!', reactionEn: 'Glow~ Cool emerald breeze rises from the rune lantern!' },
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
          ? tr('상대 턴', 'Enemy Turn')
          : noMovesLeft
            ? tr('할 일 없음', 'Job Done')
            : tr('턴 종료', 'End Turn')}
      </span>
    </div>
  );
};

const TargetingArrowOverlay = React.memo<{ selection: PendingSelection | null }>(({ selection }) => {
  const needsArrow = Boolean(
    selection &&
      ((selection.kind === 'HAND_CARD' && selection.needsTarget) ||
        selection.kind === 'CHOOSE_OPTION_TARGET' ||
        selection.kind === 'HERO_POWER' ||
        selection.kind === 'ATTACKER'),
  );

  const [arrowPts, setArrowPts] = useState<{
    sx: number;
    sy: number;
    ex: number;
    ey: number;
  } | null>(null);
  const startRef = useRef<{ sx: number; sy: number }>({ sx: 0, sy: 0 });
  const pendingPtRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!needsArrow || !selection) {
      setArrowPts(null);
      return;
    }

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
      const hpEl = document.querySelector('[data-hs-entity="PLAYER_HERO_POWER"]');
      if (hpEl) {
        const c = elementCenterInStage(hpEl);
        sx = c.x;
        sy = c.y;
      } else {
        sx = stageW * 0.58;
        sy = stageH * 0.77;
      }
    } else if (selection.kind === 'HAND_CARD') {
      const el = document.querySelector(`[data-hand-uid="${selection.handUid}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const pt = clientToStagePoint(r.left + r.width / 2, r.top + 24);
        sx = pt.x;
        sy = pt.y;
      }
    }
    startRef.current = { sx, sy };
    setArrowPts({ sx, sy, ex: sx, ey: sy - 40 });

    const onMove = (e: PointerEvent) => {
      pendingPtRef.current = clientToStagePoint(e.clientX, e.clientY);
      if (rafRef.current !== 0) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        const pt = pendingPtRef.current;
        if (!pt) return;
        setArrowPts({ sx: startRef.current.sx, sy: startRef.current.sy, ex: pt.x, ey: pt.y });
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafRef.current !== 0) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [needsArrow, selection]);

  if (!arrowPts) return null;

  const ctrlY = Math.min(arrowPts.sy, arrowPts.ey) - 85;
  const pathD = `M ${arrowPts.sx} ${arrowPts.sy} Q ${(arrowPts.sx + arrowPts.ex) / 2} ${ctrlY} ${arrowPts.ex} ${arrowPts.ey}`;

  return (
    <svg className="pointer-events-none absolute inset-0 z-[75] h-full w-full">
      <path
        d={pathD}
        fill="none"
        stroke="rgba(239,68,68,0.34)"
        strokeWidth={16}
        strokeDasharray="18 10"
        strokeLinecap="round"
      />
      <path
        d={pathD}
        fill="none"
        stroke="#ef4444"
        strokeWidth={8}
        strokeDasharray="18 10"
        strokeLinecap="round"
      />
      <circle
        cx={arrowPts.ex}
        cy={arrowPts.ey}
        r={22}
        fill="rgba(239,68,68,0.22)"
        stroke="#fecaca"
        strokeWidth={3.5}
      />
      <line
        x1={arrowPts.ex - 28}
        y1={arrowPts.ey}
        x2={arrowPts.ex + 28}
        y2={arrowPts.ey}
        stroke="#ef4444"
        strokeWidth={3}
      />
      <line
        x1={arrowPts.ex}
        y1={arrowPts.ey - 28}
        x2={arrowPts.ex}
        y2={arrowPts.ey + 28}
        stroke="#ef4444"
        strokeWidth={3}
      />
    </svg>
  );
});

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
  onRematchWithPreset,
  externalAutoPlay = false,
  onAutoPlayChange,
  tacticalStance: externalTacticalStance,
  onTacticalStanceChange,
  onBattleHelpSnapshot,
  initialPresetId,
  openPresetModalOnStart = false,
  bogartStakeGold,
  bogartDifficulty: bogartDifficultyProp = 'NORMAL',
  challengerMeta,
  restoredMatchState,
}) => {
  const bogartDifficulty: 'NORMAL' | 'EXPERT' =
    bogartDifficultyProp === 'EXPERT' ? 'EXPERT' : 'NORMAL';
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  useEffect(() => {
    portalGameplayStart();
    return () => {
      portalGameplayStop();
    };
  }, []);
  const [resolvedChallenger] = useState<ChallengerMeta | null>(() => {
    if (challengerMeta) return challengerMeta;
    if (mode === 'RANKED' || mode === 'BOGART_GAMBLE') {
      return rollOnlineChallenger(preferredOpponentClass, mode === 'BOGART_GAMBLE').meta;
    }
    return null;
  });
  const [challengeCopiedMsg, setChallengeCopiedMsg] = useState<string | null>(null);
  const lastAutoTauntAtRef = useRef<number>(0);
  const lastTauntHistoryLenRef = useRef<number>(0);
  const buildBattleMatchState = useCallback(
    (targetEpisode?: number, overridePlayerCards?: string[]): BattleMatchState => {
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
        let presetCards: string[] | undefined;
        if (!overridePlayerCards && !isEp0 && initialPresetId && initialPresetId !== 'CUSTOM') {
          presetCards = buildArchetypePresets('PRIEST', playerJourney.deckCards).find(
            (p) => p.id === initialPresetId,
          )?.cards;
        }
        const finalPlayerDeckCards =
          overridePlayerCards && overridePlayerCards.length >= 30
            ? overridePlayerCards.slice(0, 30)
            : presetCards && presetCards.length >= 30
              ? presetCards.slice(0, 30)
              : playerJourney.deckCards;
        const bossDeck = isEp0
          ? buildTutorialEp0ScarecrowDeck()
          : buildJourneyBossDeck(epDef.bossHeroClass, ep, reinc);

        const rawMatch = createBattleMatch({
          mode: 'TUTORIAL',
          playerName: epDef.playerHeroSpec.heroNameKo,
          playerClass: 'PRIEST',
          playerDeck: finalPlayerDeckCards,
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
        // 스토리모드도 초기 상태를 MULLIGAN(게임 시작화면 · 시작 카드 선택)으로 유지합니다.
        // 대사 종료 시 자동플레이가 켜져 있었다면 즉시 멀리건을 자동 완료하고 계속 자동플레이하며,
        // 아니라면 게임 시작화면(시작 카드 선택 + 게임 시작 버튼)을 표시합니다.
        return rawMatch;
      }

      const opp = buildAiOpponentSetup(mode, preferredOpponentClass);
      const nonStoryPresetCards =
        !overridePlayerCards && initialPresetId && initialPresetId !== 'CUSTOM'
          ? buildArchetypePresets(playerDeck.heroClass, playerDeck.cards).find(
              (p) => p.id === initialPresetId,
            )?.cards
          : undefined;
      const finalCards =
        overridePlayerCards && overridePlayerCards.length >= 30
          ? overridePlayerCards.slice(0, 30)
          : nonStoryPresetCards && nonStoryPresetCards.length >= 30
            ? nonStoryPresetCards.slice(0, 30)
            : playerDeck.cards;
      const eqPrest = getEquippedPrestigeSummary(hsStorage.getProfile(), curKo);
      const isBogartRandom = mode === 'BOGART_GAMBLE';
      const oppDisplayName = resolvedChallenger
        ? resolvedChallenger.nickname
        : opp.opponentName;
      if (isBogartRandom) {
        const playerRandom = buildBogartRandomDeck(playerDeck.heroClass);
        const oppRandom = buildBogartRandomDeck(preferredOpponentClass || opp.opponentClass);
        return createBattleMatch({
          mode,
          playerName: curKo
            ? `${eqPrest.badgeIcon} 모험가 · 〈${eqPrest.titleText}〉`
            : `${eqPrest.badgeIcon} Adventurer · <${eqPrest.titleText}>`,
          playerClass: playerRandom.heroClass,
          playerDeck: playerRandom.cards,
          opponentName: oppDisplayName,
          opponentClass: oppRandom.heroClass,
          // ISS-004: Independent unpredictable 30-Card Random Decks on BOTH sides in Bogart's Gambling Hall!
          opponentDeck: oppRandom.cards,
          boardTheme: preferredBoardTheme,
        });
      }
      return createBattleMatch({
        mode,
        playerName: curKo
          ? `${eqPrest.badgeIcon} 모험가 · 〈${eqPrest.titleText}〉`
          : `${eqPrest.badgeIcon} Adventurer · <${eqPrest.titleText}>`,
        playerClass: playerDeck.heroClass,
        playerDeck: finalCards,
        opponentName: oppDisplayName,
        opponentClass: opp.opponentClass,
        opponentDeck: opp.opponentDeck,
        boardTheme: preferredBoardTheme,
      });
    },
    [
      mode,
      playerDeck,
      preferredOpponentClass,
      preferredBoardTheme,
      journeyEpisodeOverride,
      initialPresetId,
      resolvedChallenger,
    ],
  );

  const [matchState, setMatchState] = useState<BattleMatchState>(() =>
    restoredMatchState || buildBattleMatchState(),
  );
  const [liveProfile, setLiveProfile] = useState(() => hsStorage.getProfile());

  // DEV-031: Bogart's Gambling Hall Escrow Match Snapshot (Prevents F5 abuse & accidental stake loss!)
  useEffect(() => {
    if (mode !== 'BOGART_GAMBLE' || typeof sessionStorage === 'undefined') return;
    try {
      if (matchState.phase === 'GAME_OVER') {
        sessionStorage.removeItem('snshero_gamble_active_match');
      } else {
        sessionStorage.setItem(
          'snshero_gamble_active_match',
          JSON.stringify({
            matchState,
            deck: playerDeck,
            bogartStakeGold: bogartStakeGold ?? 100,
            challengerMeta: resolvedChallenger,
            savedAt: Date.now(),
          }),
        );
      }
    } catch {
      // ignore storage quota errors
    }
  }, [mode, matchState, playerDeck, bogartStakeGold, resolvedChallenger]);

  // 모든 모드(스토리모드·랭킹대전·AI대전) 시작 시 자동플레이 기본 비활성화(OFF) 원칙!
  // 오직 카단 챗봇("자동플레이 해줘.") 또는 자동플레이 토글을 명시적으로 켰을 때만 활성화됩니다.
  const [storyPhase, setStoryPhase] = useState<'DIALOGUE' | 'CLOSED'>(() =>
    mode === 'TUTORIAL' && !skipStoryIntro ? 'DIALOGUE' : 'CLOSED',
  );
  const [episodeSelectorOpen, setEpisodeSelectorOpen] = useState(false);
  const [autoPlay, setAutoPlayInternal] = useState<boolean>(() => Boolean(externalAutoPlay));
  const [siliaAutoPaused] = useState(false);
  const [internalStance, setInternalStance] = useState<KadanTacticalStance>('BALANCED');
  const activeStance = externalTacticalStance ?? internalStance;
  const setActiveStance = useCallback(
    (s: KadanTacticalStance) => {
      setInternalStance(s);
      onTacticalStanceChange?.(s);
    },
    [onTacticalStanceChange],
  );
  const [focusTargetId, setFocusTargetId] = useState<string | null>(null);
  const [preBattleModalOpen, setPreBattleModalOpen] = useState<boolean>(() =>
    Boolean(openPresetModalOnStart),
  );
  // DEV-043 / 044 / 050 / 051 / 052 / 053 / 054: Ocarina BGM Rhythm Auto & Kadan Command Orb State
  const [rhythmEnabled, setRhythmEnabled] = useState<boolean>(
    () => hsAudio.getSettings().rhythmAutoEnabled !== false,
  );
  const [autoSpeed2x, setAutoSpeed2x] = useState<boolean>(false);
  const [rhythmFlash, setRhythmFlash] = useState<{
    mult: 1 | 1.5 | 2;
    grade: 'NORMAL' | 'GOOD' | 'PERFECT';
    stackGain: 1 | 10;
    parried?: boolean;
    seq: number;
  } | null>(null);
  const [rhythmSanctuaryAura, setRhythmSanctuaryAura] = useState<boolean>(false);
  const [rhythmFeverPct] = useState<number>(0);
  const [rhythmFeverBonusGold, setRhythmFeverBonusGold] = useState<number>(0);
  const [kadanMomentumCount, setKadanMomentumCount] = useState<number>(0);
  const [kadanSpiritPhase, setKadanSpiritPhase] = useState<KadanSpiritPhase>('CHARGING');
  const [kadanUltCutIn, setKadanUltCutIn] = useState<{
    stackTier: number;
    stackCount: number;
    siliaSkill?: SiliaSkillKind;
    seq: number;
  } | null>(null);
  const [siliaChainCutIn, setSiliaChainCutIn] = useState<{
    skillKind: SiliaSkillKind;
    stackTier: number;
    seq: number;
  } | null>(null);
  const [pvpWaitingOpponentMulligan, setPvpWaitingOpponentMulligan] = useState(false);
  const [pvpOpponentLeftNotice, setPvpOpponentLeftNotice] = useState<string | null>(null);
  const pvpHostMulliganRef = useRef<string[] | null>(null);
  const pvpGuestMulliganRef = useRef<string[] | null>(null);
  const lastAppliedGuestSeqRef = useRef<number>(0);
  const livePvpMeta = matchState.livePvpMeta;
  const isLivePvp = Boolean(livePvpMeta);
  const isPvpHost = livePvpMeta?.role === 'HOST';
  const isPvpGuest = livePvpMeta?.role === 'GUEST';
  const [battleLogExpanded, setBattleLogExpanded] = useState<boolean>(false);
  const rhythmResonanceUsedTurnRef = useRef<number>(-1);
  const rhythmComboRef = useRef<number>(0);
  const kadanMomentumRef = useRef<number>(0);
  const kadanSpiritPhaseRef = useRef<KadanSpiritPhase>('CHARGING');
  const kadanIgniteTimerRef = useRef<number | null>(null);
  const kadanUltCastCountRef = useRef<number>(0);
  const lastRhythmTapMsRef = useRef<number>(0);
  const lastGreenBeatCycleRef = useRef<number>(-999999);
  const triggerUltimateShakeRef = useRef<(tier?: number) => void>(() => {});
  const fireKadanUltimateRef = useRef<(stackTier: number) => void>(() => {});
  const fireSiliaChainRef = useRef<(stackTier: number, forcedSkill?: SiliaSkillKind) => void>(() => {});

  const battleBpm = 128;

  const isBossParryReady =
    mode === 'TUTORIAL' &&
    matchState.opponent.maxMana >= 6 &&
    rhythmResonanceUsedTurnRef.current !== matchState.turnNumber;

  useEffect(() => {
    const syncAudioOpts = () => {
      const s = hsAudio.getSettings();
      setRhythmEnabled(s.rhythmAutoEnabled !== false);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        hsAudio.resyncBeatClockToDownbeat();
      }
    };
    window.addEventListener('snshero:settings-changed', syncAudioOpts);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('snshero:settings-changed', syncAudioOpts);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const [challengerPrestigeOpen, setChallengerPrestigeOpen] = useState(false);
  const onAutoPlayChangeRef = useRef(onAutoPlayChange);
  onAutoPlayChangeRef.current = onAutoPlayChange;

  const setAutoPlay = useCallback((nextOrUpdater: boolean | ((prev: boolean) => boolean)) => {
    setAutoPlayInternal((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
      if (next !== prev) {
        window.setTimeout(() => onAutoPlayChangeRef.current?.(next), 0);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    setAutoPlayInternal(Boolean(externalAutoPlay));
  }, [externalAutoPlay]);
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
          badge: tr('튜토리얼 실전 시작', 'Tutorial Drill Start'),
          headline: tr('3초마다 카드 해설!', 'Card Tip Every 3s!'),
          reason: tr('매 턴 카드를 내는 이유를 쉽게 알려드릴게요!', "I'll explain why each card is played every turn!"),
        }
      : null,
  );
  const [ep0SummaryNonce, setEp0SummaryNonce] = useState(0);
  const ep0TurnPlaysRef = useRef<string[]>([]);
  const ep0OpponentPlaysRef = useRef<string[]>([]);
  const ep0SummaryShownTurnRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (kadanIgniteTimerRef.current !== null) {
        window.clearTimeout(kadanIgniteTimerRef.current);
      }
    };
  }, []);

  const prevMatchIdRef = useRef(matchState.matchId);
  useEffect(() => {
    if (prevMatchIdRef.current !== matchState.matchId) {
      prevMatchIdRef.current = matchState.matchId;
      if (kadanIgniteTimerRef.current !== null) {
        window.clearTimeout(kadanIgniteTimerRef.current);
        kadanIgniteTimerRef.current = null;
      }
      kadanMomentumRef.current = 0;
      kadanSpiritPhaseRef.current = 'CHARGING';
      kadanUltCastCountRef.current = 0;
      lastRhythmTapMsRef.current = 0;
      lastGreenBeatCycleRef.current = -999999;
      setKadanMomentumCount(0);
      setKadanSpiritPhase('CHARGING');
      setKadanUltCutIn(null);
      setSiliaChainCutIn(null);
      if (!externalAutoPlay) {
        setAutoPlay(false);
      }
    }
  }, [matchState.matchId, externalAutoPlay, setAutoPlay]);

  const [vsIntroActive, setVsIntroActive] = useState(() => !restoredMatchState);

  // Ensure looping battle duel BGM (`duel_1` 128 BPM / `duel_2` 132 BPM) is active once PLAYING starts
  useEffect(() => {
    if (matchState.phase === 'PLAYING' && storyPhase === 'CLOSED' && !vsIntroActive) {
      hsAudio.ensureBattleDuelBgm();
    }
  }, [matchState.phase, storyPhase, vsIntroActive]);

  // Handle Kadan & Silia Dual Spirit Beat Tap (Story Mode Exclusive · Charge 0->100 -> 1s Flame Lockout -> Tap to Unleash Kadan+Silia Dual Ultimate Together!)
  const handleRhythmOrbTap = useCallback(() => {
    if (mode !== 'TUTORIAL' || !rhythmEnabled || matchState.phase !== 'PLAYING') {
      return;
    }

    // 1) During the 1-second flame ignition lockout at 100 charge, ignore all clicks/Spacebar!
    if (kadanSpiritPhaseRef.current === 'IGNITING') {
      return;
    }

    // 2) After 1-second lockout (`READY`), tapping unleashes Kadan Blizzard + Silia Windstorm Dual Ultimate SIMULTANEOUSLY & resets to 0!
    if (kadanSpiritPhaseRef.current === 'READY') {
      kadanSpiritPhaseRef.current = 'CHARGING';
      kadanMomentumRef.current = 0;
      setKadanSpiritPhase('CHARGING');
      setKadanMomentumCount(0);
      setRhythmFlash(null);

      const stackTier = Math.min(8, kadanUltCastCountRef.current + 1);
      kadanUltCastCountRef.current = stackTier;

      hsAudio.playSfx('big_attack', 0.95);
      triggerUltimateShakeRef.current(stackTier + 1);
      fireKadanUltimateRef.current(stackTier);
      return;
    }

    // 3) Charging Phase (`0 .. 99`): Mash = +1, Timed Green Beat = +10 (caps at 100 -> triggers 1s IGNITING!)
    const nowPerfMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const isRapidMash =
      lastRhythmTapMsRef.current > 0 && nowPerfMs - lastRhythmTapMsRef.current < 280;
    lastRhythmTapMsRef.current = nowPerfMs;

    const preview = hsAudio.getBeatPhaseInfo(battleBpm, autoSpeed2x);
    const alreadyClaimedThisBeat = preview.beatCycleIndex === lastGreenBeatCycleRef.current;
    const forceMashGrade = isRapidMash || alreadyClaimedThisBeat;

    const nextPotentialCombo = rhythmComboRef.current + 1;
    const res = hsAudio.evaluateRhythmTap(
      battleBpm,
      autoSpeed2x,
      nextPotentialCombo,
      forceMashGrade,
    );
    const nextCombo = res.grade === 'PERFECT' ? nextPotentialCombo : 0;
    rhythmComboRef.current = nextCombo;

    if (nextCombo >= 3 && res.grade === 'PERFECT') {
      setRhythmSanctuaryAura(true);
      window.setTimeout(() => setRhythmSanctuaryAura(false), 1300);
    }

    const isTimedGreenHit = res.grade !== 'NORMAL';
    if (isTimedGreenHit) {
      lastGreenBeatCycleRef.current = res.beatCycleIndex;
    }
    const stackGain: 1 | 10 = isTimedGreenHit ? 10 : 1;
    const prevMomentum = kadanMomentumRef.current;
    const nextMomentum = Math.min(100, prevMomentum + stackGain);
    kadanMomentumRef.current = nextMomentum;
    setKadanMomentumCount(nextMomentum);

    // Upon reaching 100: button bursts into flames & pauses clicks for 1.0 second before becoming READY!
    if (prevMomentum < 100 && nextMomentum >= 100) {
      kadanSpiritPhaseRef.current = 'IGNITING';
      setKadanSpiritPhase('IGNITING');
      setRhythmFlash(null);
      hsAudio.playSfx('pack_legendary', 0.85);
      if (kadanIgniteTimerRef.current !== null) {
        window.clearTimeout(kadanIgniteTimerRef.current);
      }
      kadanIgniteTimerRef.current = window.setTimeout(() => {
        kadanIgniteTimerRef.current = null;
        if (kadanSpiritPhaseRef.current === 'IGNITING') {
          kadanSpiritPhaseRef.current = 'READY';
          setKadanSpiritPhase('READY');
          hsAudio.playSfx('hero_power', 0.8);
        }
      }, 1000);
    }

    let parriedBoss = false;
    // PvE Story Track: max 1 resonance burst per turn; Boss >= 6 Mana PERFECT triggers Sanctuary Parry!
    if (isTimedGreenHit && rhythmResonanceUsedTurnRef.current !== matchState.turnNumber) {
      rhythmResonanceUsedTurnRef.current = matchState.turnNumber;
      const bossParry = matchState.opponent.maxMana >= 6 && res.grade === 'PERFECT';
      parriedBoss = bossParry;
      const armorGain = bossParry ? 5 : res.grade === 'PERFECT' ? 4 : 2;
      setMatchState((prev) => {
        if (prev.phase !== 'PLAYING') return prev;
        const nextBoard = prev.player.board.map((m, idx) =>
          idx === 0 && res.grade === 'PERFECT'
            ? {
                ...m,
                permAttack: m.permAttack + 1,
                maxHealth: m.maxHealth + 1,
                health: m.health + 1,
              }
            : m,
        );
        return {
          ...prev,
          player: {
            ...prev.player,
            armor: prev.player.armor + armorGain,
            board: nextBoard,
          },
        };
      });
    }

    if (nextMomentum < 100) {
      const flashSeq = Date.now() + nextMomentum;
      setRhythmFlash({
        mult: res.multiplier,
        grade: res.grade,
        stackGain,
        parried: parriedBoss,
        seq: flashSeq,
      });
      window.setTimeout(() => {
        setRhythmFlash((cur) => (cur?.seq === flashSeq ? null : cur));
      }, 900);
    }
  }, [
    mode,
    autoPlay,
    rhythmEnabled,
    matchState.phase,
    matchState.turnNumber,
    matchState.opponent.maxMana,
    battleBpm,
    autoSpeed2x,
  ]);

  useEffect(() => {
    if (
      mode !== 'TUTORIAL' ||
      !autoPlay ||
      !rhythmEnabled ||
      matchState.phase !== 'PLAYING' ||
      storyPhase !== 'CLOSED' ||
      vsIntroActive
    ) {
      return;
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' && !ev.repeat) {
        const tag = (ev.target as HTMLElement | null)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        ev.preventDefault();
        handleRhythmOrbTap();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    mode,
    autoPlay,
    rhythmEnabled,
    matchState.phase,
    storyPhase,
    vsIntroActive,
    handleRhythmOrbTap,
  ]);
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
  const [insertPreviewIdx, setInsertPreviewIdx] = useState<number>(0);

  const [hoveredBoardMinion, setHoveredBoardMinion] = useState<MinionInstance | null>(null);
  const [hoveredHistoryItem, setHoveredHistoryItem] = useState<ActionHistoryItem | null>(null);
  const [playerEmoteText, setPlayerEmoteText] = useState<string | null>(null);
  const [opponentEmoteText, setOpponentEmoteText] = useState<string | null>(null);
  const [opponentSquelched, setOpponentSquelched] = useState(
    () => hsAudio.getSettings().emoteBubblesEnabled === false,
  );

  useEffect(() => {
    const syncPrefs = () => {
      const s = hsAudio.getSettings();
      if (s.emoteBubblesEnabled === false) {
        setOpponentSquelched(true);
        setOpponentEmoteText(null);
      }
    };
    window.addEventListener('snshero:settings-changed', syncPrefs);
    return () => window.removeEventListener('snshero:settings-changed', syncPrefs);
  }, []);
  const [squelchMenuOpen, setSquelchMenuOpen] = useState(false);
  const [playErrorBubble, setPlayErrorBubble] = useState<string | null>(null);
  const [toyToast, setToyToast] = useState<string | null>(null);
  const [activeToyPos, setActiveToyPos] = useState<'TL' | 'TR' | 'BL' | 'BR' | null>(null);
  const [localVfxQueue, setLocalVfxQueue] = useState<VfxEvent[]>([]);
  const [deckTooltipSide, setDeckTooltipSide] = useState<'PLAYER' | 'OPPONENT' | null>(null);
  const [handDrag, setHandDrag] = useState<HandDragState | null>(null);
  const [hoveredHandCost, setHoveredHandCost] = useState<number | null>(null);
  const [newlyDrawnUids, setNewlyDrawnUids] = useState<Set<string>>(() => new Set());
  const [drawnCardToast, setDrawnCardToast] = useState<string | null>(null);
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

  useModalDismiss(squelchMenuOpen, () => setSquelchMenuOpen(false));
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
  const [postGameStep, setPostGameStep] = useState<'SUMMARY' | 'NEXT_ACTIONS'>('SUMMARY');
  const [postGameAutoPaused, setPostGameAutoPaused] = useState<boolean>(false);
  const [postGameRemainingMs, setPostGameRemainingMs] = useState<number>(3000);
  const [defeatPackResult, setDefeatPackResult] = useState<
    (DefeatPackReinforcementResult & { flipped: boolean }) | null
  >(null);
  const [drawRetryRemainingMs, setDrawRetryRemainingMs] = useState<number>(3500);
  const [attackAnim, setAttackAnim] = useState<ActiveAttackAnim | null>(null);

  const friendlyRowRef = useRef<HTMLDivElement | null>(null);
  const trackedBattleStartRef = useRef(false);
  const recordedResultRef = useRef(false);
  const postGameFiredRef = useRef(false);
  const drawRetryFiredRef = useRef(false);
  const matchStateRef = useRef<BattleMatchState>(matchState);
  matchStateRef.current = matchState;
  const handDragRef = useRef<HandDragState | null>(null);
  handDragRef.current = handDrag;
  const attackerDragRef = useRef<AttackerDragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const knownHandUidsRef = useRef<Set<string>>(
    new Set(matchState.player.hand.map((h) => h.uid)),
  );
  const lastShowcasedHistoryIdRef = useRef<string | null>(null);
  const attackLockRef = useRef(false);
  const attackSeqRef = useRef(0);
  const attackTimersRef = useRef<number[]>([]);
  const shakeTimerRef = useRef<number | null>(null);
  const activeShakeRef = useRef<{ until: number; strength: number }>({ until: 0, strength: 0 });
  const profile = liveProfile;

  useEffect(() => {
    return () => {
      document.body.classList.remove('hs-dragging-active');
      for (const tid of attackTimersRef.current) window.clearTimeout(tid);
      attackTimersRef.current = [];
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
      attackLockRef.current = false;
    };
  }, []);

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
      // DEV-016: Show central 0.85s drawn card preview toast when drawing during own turn (e.g. Hero Power draw)
      if (matchState.activeSide === 'PLAYER' && matchState.history[0]?.kind === 'HERO_POWER') {
        const firstDrawn = matchState.player.hand.find((h) => h.uid === fresh[0]);
        if (firstDrawn) setDrawnCardToast(firstDrawn.cardId);
      }
      const t = window.setTimeout(() => {
        setDrawnCardToast(null);
        setNewlyDrawnUids((prev) => {
          const next = new Set(prev);
          fresh.forEach((u) => next.delete(u));
          return next;
        });
      }, 850);
      return () => window.clearTimeout(t);
    }
  }, [matchState.phase, matchState.player.hand]);

  // Left-Side Big Card Showcase: Opponent Play, Hidden Secret, Secret Reveal, Fatigue, or Mill Burn!
  useEffect(() => {
    const latest = matchState.history[0];
    if (!latest || latest.id === lastShowcasedHistoryIdRef.current) return;
    lastShowcasedHistoryIdRef.current = latest.id;

    const actorSideState =
      latest.actorSide === 'OPPONENT' ? matchState.opponent : matchState.player;
    const actorName = isKo
      ? actorSideState.heroNameKo || actorSideState.name
      : actorSideState.customHero?.heroNameEn ||
        actorSideState.name ||
        getLocalizedHeroInfo(actorSideState.heroClass, lang).name;
    const actorClass = actorSideState.heroClass;

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
  }, [matchState.history, matchState.opponent, matchState.player, isKo, lang]);

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
      const koNow = isKoreanLanguage();
      const rawPName = koNow
        ? activeMatch.player.heroNameKo || activeMatch.player.name
        : activeMatch.player.customHero?.heroNameEn ||
          (activeMatch.player.customHero
            ? activeMatch.player.name
            : getLocalizedHeroInfo(activeMatch.player.heroClass, 'en').name);
      const rawOName = koNow
        ? activeMatch.opponent.heroNameKo || activeMatch.opponent.name
        : activeMatch.opponent.customHero?.heroNameEn ||
          (activeMatch.opponent.customHero
            ? activeMatch.opponent.name
            : getLocalizedHeroInfo(activeMatch.opponent.heroClass, 'en').name);
      const announcePromise = hsAudio.playMatchupAnnouncement(
        activeMatch.player.heroClass,
        activeMatch.opponent.heroClass,
        rawPName,
        rawOName,
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

  // Opening VS Clash + Episode Title Banner (runs immediately on battle mount for ALL modes including Story Mode!)
  useEffect(() => {
    hsAudio.playBgm('mulligan');
    runVsIntroAndTransition(matchState, mode === 'TUTORIAL' ? 1500 : skipStoryIntro ? 1200 : 1400);
    return () => {
      vsIntroRunIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storyEncounter = useMemo(() => {
    if (mode !== 'TUTORIAL' || !matchState.journeyMeta) return null;
    return getStoryEpisodeEncounter(matchState.journeyMeta.episode);
  }, [mode, matchState.journeyMeta]);

  const handleFinishStoryDialogue = useCallback(() => {
    setStoryPhase('CLOSED');
    const snap = matchStateRef.current;

    // 대사를 마치면: 자동플레이가 켜져 있었다면 -> 멀리건을 자동 완료하고 계속 자동플레이!
    if (autoPlay) {
      hsAudio.playBgm(Math.random() < 0.5 ? 'duel_1' : 'duel_2');
      if (snap.phase === 'MULLIGAN') {
        const autoSwapUids = snap.player.hand
          .filter((hc) => cardDb.mustGetCard(hc.cardId).cost >= 4)
          .map((hc) => hc.uid);
        const confirmed = createEngine(snap).confirmMulligan(autoSwapUids);
        if (confirmed.firstPlayer === 'OPPONENT' && confirmed.turnNumber <= 1) {
          hsAudio.playInnkeeper('coin');
          setCoinGiftShowcase(true);
          window.setTimeout(() => setCoinGiftShowcase(false), 1650);
        }
        setMatchState({
          ...confirmed,
          bannerMessage:
            confirmed.activeSide === 'PLAYER'
              ? tr('내 턴!', 'YOUR TURN!')
              : tr('상대 턴', 'ENEMY TURN'),
        });
      }
      return;
    }

    // 자동플레이가 꺼져 있었다면 -> 게임 시작화면(MULLIGAN · 시작 카드 선택 및 [게임 시작] 화면)을 표시!
    hsAudio.playBgm('mulligan');
  }, [autoPlay, isKo]);

  const handleSelectStoryEpisode = useCallback(
    (selectedEpisode: number) => {
      setEpisodeSelectorOpen(false);
      if (onStartJourneyEpisode) {
        onStartJourneyEpisode(selectedEpisode, false, autoPlay);
        return;
      }
      const curP = hsStorage.getProfile();
      hsStorage.setJourneyProgress(selectedEpisode, curP.journeyReincarnation);
      const nextMatch = buildBattleMatchState(selectedEpisode);
      setMatchState(nextMatch);
      setStoryPhase('DIALOGUE');
      runVsIntroAndTransition(nextMatch, 1400);
    },
    [onStartJourneyEpisode, autoPlay, buildBattleMatchState, runVsIntroAndTransition],
  );

  // 실시간 초보자 코치 배너 1줄 메시지 계산
  const coachTip = useMemo(() => {
    if (matchState.phase === 'MULLIGAN') {
      return {
        tone: 'amber' as const,
        badge: tr('멀리건', 'Mulligan'),
        text: tr('1~3코스트 카드는 남기고, 큰 카드를 눌러 1회 교체한 뒤 [확인]을 누르세요.', 'Keep 1–3 Cost cards, tap high-Cost cards to replace once, then press [Confirm].'),
      };
    }
    if (matchState.phase === 'GAME_OVER') {
      return null;
    }
    if (matchState.phase !== 'PLAYING' || matchState.activeSide !== 'PLAYER') {
      return {
        tone: 'slate' as const,
        badge: tr('상대 턴', 'Enemy Turn'),
        text: tr('상대가 카드를 내고 공격하는 중입니다. 내 턴이 올 때까지 잠시 기다리세요.', 'Opponent is playing cards and attacking. Please wait for your turn.'),
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
          badge: tr('자동플레이', 'Auto-Play'),
          text: isKo
            ? `AI가 남은 마나(${matchState.player.mana})로 낼 수 있는 카드를 선택 중입니다. (상단 버튼으로 수동 전환 가능)`
            : `AI is picking playable cards with ${matchState.player.mana} Mana remaining. (Tap Auto to take control)`,
        };
      }
      if (totalAttackers > 0) {
        return {
          tone: 'sky' as const,
          badge: tr('자동플레이', 'Auto-Play'),
          text: isKo
            ? `AI가 공격 가능한 유닛(${totalAttackers}기)으로 적을 공격하고 있습니다.`
            : `AI is attacking with ${totalAttackers} ready unit(s).`,
        };
      }
      return {
        tone: 'sky' as const,
        badge: tr('자동플레이', 'Auto-Play'),
        text: tr('AI가 이번 턴 행동을 마치고 턴을 넘깁니다. 직접 조종하려면 [자동 OFF]를 누르세요.', 'AI is ending the turn. Tap [Auto OFF] anytime to play manually.'),
      };
    }

    if (selection?.kind === 'ATTACKER') {
      const hasEnemyTaunt = matchState.opponent.board.some(
        (m) => !m.stealth && (m.taunt || m.auraTaunt),
      );
      return {
        tone: 'emerald' as const,
        badge: tr('공격 조준', 'Targeting'),
        text: hasEnemyTaunt
          ? tr('🛡️ 도발 하수인이 앞을 막고 있습니다! 도발 방패 하수인을 먼저 공격하세요.', '🛡️ A Taunt minion blocks the way! Attack the shielded Taunt minion first.')
          : tr('상대 하수인이나 위쪽 상대 영웅 초상화를 눌러 공격하세요! (취소: 빈 곳 클릭)', 'Tap an enemy minion or top enemy hero portrait to attack! (Tap empty space to cancel)'),
      };
    }
    if (selection?.kind === 'HAND_CARD') {
      return {
        tone: 'emerald' as const,
        badge: tr('대상 선택', 'Select Target'),
        text: tr('초록·노란빛으로 강조된 대상(아군 또는 적)을 눌러 카드 효과를 발동하세요!', 'Tap any highlighted target (ally or enemy) to trigger the card effect!'),
      };
    }
    if (playableCount > 0) {
      return {
        tone: 'emerald' as const,
        badge: isKo ? `마나 ${matchState.player.mana}/${matchState.player.maxMana}` : `Mana ${matchState.player.mana}/${matchState.player.maxMana}`,
        text: tr('아래 손패에서 초록빛 테두리 카드를 눌러 전장에 소환하세요!', 'Tap a green-glowing card in your hand below to play it onto the board!'),
      };
    }
    if (totalAttackers > 0) {
      return {
        tone: 'emerald' as const,
        badge: tr('공격 가능', 'Ready to Attack'),
        text: isKo
          ? `전장의 초록빛 내 하수인${heroCanAttack ? ' 또는 영웅' : ''}을 누른 뒤 적을 공격하세요!`
          : `Tap a green-glowing minion${heroCanAttack ? ' or hero' : ''}, then tap an enemy target!`,
      };
    }
    return {
      tone: 'amber' as const,
      badge: tr('턴 마무리', 'Wrap Up'),
      text: tr('할 수 있는 행동을 마쳤습니다! 오른쪽 [턴 종료] 버튼을 눌러 턴을 넘기세요.', 'All moves done! Press [End Turn] on the right to pass the turn.'),
    };
  }, [matchState, autoPlay, selection, engine, isKo]);

  // 실시간 전장 스냅샷을 우측 하단 2등신 카단 챗봇에 동기화
  // (매초 감소하는 turnSecondsLeft 타이머에는 반응하지 않도록 실제 전황 키로 게이팅하여 불필요한 전체 앱 리렌더 원천 차단!)
  const onBattleHelpSnapshotRef = useRef(onBattleHelpSnapshot);
  onBattleHelpSnapshotRef.current = onBattleHelpSnapshot;
  const lastHelpSnapshotKeyRef = useRef('');
  useEffect(() => {
    if (!onBattleHelpSnapshotRef.current) return;
    const isPTurn = matchState.phase === 'PLAYING' && matchState.activeSide === 'PLAYER';
    const snapKey = [
      mode,
      lang,
      matchState.matchId,
      matchState.phase,
      matchState.activeSide,
      matchState.turnNumber,
      matchState.player.mana,
      matchState.player.maxMana,
      matchState.player.health,
      matchState.player.armor,
      matchState.player.heroPowerUsedThisTurn ? 1 : 0,
      matchState.opponent.health,
      matchState.opponent.armor,
      matchState.player.hand.map((h) => `${h.uid}:${h.costMod || 0}`).join(','),
      matchState.player.board.map((m) => `${m.uid}:${m.attacksMadeThisTurn}:${m.health}`).join(','),
      matchState.opponent.board.map((m) => `${m.uid}:${m.taunt ? 1 : 0}:${m.auraTaunt ? 1 : 0}`).join(','),
    ].join('|');
    if (lastHelpSnapshotKeyRef.current === snapKey) return;
    lastHelpSnapshotKeyRef.current = snapKey;

    const handCards = matchState.player.hand.map((hc) => {
      const def = cardDb.mustGetCard(hc.cardId);
      const effCost = Math.max(0, def.cost + (hc.costMod || 0));
      const playInfo = isPTurn ? engine.inspectPlayability('PLAYER', hc) : { canPlay: false };
      return {
        name: getCardName(def, lang),
        cost: effCost,
        type: def.type,
        playable: Boolean(playInfo.canPlay),
        text: isKo ? def.text : def.textEn || def.text,
      };
    });
    const minAtk = isPTurn
      ? matchState.player.board.filter((m) => engine.canAttackerSwing('PLAYER', m.uid).ok).length
      : 0;
    const heroAtkOk = isPTurn && engine.canAttackerSwing('PLAYER', 'PLAYER_HERO').ok ? 1 : 0;
    const enemyTaunts = matchState.opponent.board
      .filter((m) => !m.stealth && (m.taunt || m.auraTaunt))
      .map((m) => getCardName(cardDb.mustGetCard(m.cardId), lang));
    const canHp =
      isPTurn &&
      !matchState.player.heroPowerUsedThisTurn &&
      matchState.player.mana >= 2;

    onBattleHelpSnapshotRef.current({
      mode,
      turnNumber: matchState.turnNumber,
      isPlayerTurn: isPTurn,
      phase: matchState.phase,
      playerMana: matchState.player.mana,
      playerMaxMana: matchState.player.maxMana,
      playerHealth: matchState.player.health + matchState.player.armor,
      opponentHealth: matchState.opponent.health + matchState.opponent.armor,
      opponentName: matchState.opponent.name,
      handCards,
      readyAttackersCount: minAtk + heroAtkOk,
      enemyTauntNames: enemyTaunts,
      canUseHeroPower: canHp,
      journeyEpisode: matchState.journeyMeta?.episode,
    });
  }, [matchState, engine, mode, lang, isKo]);

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
    const msg = matchState.errorBanner;
    setPlayErrorBubble(msg);
    if (msg.includes('마나') || msg.toLowerCase().includes('mana')) {
      hsAudio.playHeroVo(matchState.player.heroClass, 'error_mana');
    } else if (msg.includes('도발') || msg.toLowerCase().includes('taunt')) {
      hsAudio.playHeroVo(matchState.player.heroClass, 'error_taunt');
    } else if (msg.includes('공격') || msg.toLowerCase().includes('attack')) {
      hsAudio.playHeroVo(matchState.player.heroClass, 'error_attacked');
    }
    const t = window.setTimeout(() => {
      setMatchState((s) => ({ ...s, errorBanner: null }));
      setPlayErrorBubble(null);
    }, 2100);
    return () => clearTimeout(t);
  }, [matchState.errorBanner, matchState.player.heroClass]);

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
  // (랭킹/AI 대전 종료 시 자동플레이를 즉시 비활성화하되, 스토리모드에서 자동플레이가 켜져 있었다면 승리/패배 대사 후에도 계속 자동플레이로 이어질 수 있도록 유지!)
  useEffect(() => {
    if (matchState.phase === 'GAME_OVER' && autoPlay && mode !== 'TUTORIAL') {
      setAutoPlay(false);
    }
  }, [matchState.phase, autoPlay, mode, setAutoPlay]);

  useEffect(() => {
    if (matchState.phase === 'MULLIGAN') {
      trackedBattleStartRef.current = false;
    } else if (matchState.phase === 'PLAYING' && !trackedBattleStartRef.current) {
      trackedBattleStartRef.current = true;
      const muted = hsAudio.getSettings().muted;
      playRhythmCue('mulligan_start', { muted });
      playFactionChord(matchState.player.heroClass, muted);
      trackHeroBattleStarted({
        mode,
        episode: matchState.journeyMeta?.episode,
      });
    }
  }, [matchState.phase, mode, matchState.journeyMeta?.episode, matchState.player.heroClass]);

  const handFullWarnedRef = useRef(false);
  useEffect(() => {
    if (matchState.phase === 'PLAYING' && matchState.player.hand.length >= 9) {
      if (!handFullWarnedRef.current) {
        handFullWarnedRef.current = true;
        playRhythmCue('hand_full_heartbeat', { muted: hsAudio.getSettings().muted });
      }
    } else {
      handFullWarnedRef.current = false;
    }
  }, [matchState.phase, matchState.player.hand.length]);

  useEffect(() => {
    if (matchState.phase === 'GAME_OVER' && !recordedResultRef.current) {
      recordedResultRef.current = true;
      if (mode !== 'TUTORIAL') {
        setAutoPlay(false);
      }
      setSelection(null);
      setZoomState(null);
      setHandDrag(null);
      document.body.classList.remove('hs-dragging-active');
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
      const summary =
        isLivePvp && livePvpMeta
          ? hsStorage.settlePvpMatchOutcome(
              livePvpMeta.roomId,
              didWin,
              livePvpMeta.stakeGold,
              matchState.player.heroClass,
              isPvpHost ? livePvpMeta.guestName : livePvpMeta.hostName,
              Boolean(livePvpMeta.isRanked),
            )
          : hsStorage.recordMatchOutcome(
              matchState.player.heroClass,
              didWin,
              mode,
              matchState.opponent.heroClass,
              bogartStakeGold || 0,
              bogartDifficulty,
            );
      if (isLivePvp && livePvpMeta) {
        const hostWon = isPvpHost ? didWin : !didWin;
        const winnerSide: 'HOST' | 'GUEST' | 'DRAW' =
          matchState.winner === 'DRAW' ? 'DRAW' : hostWon ? 'HOST' : 'GUEST';
        const hostHp = Math.max(
          0,
          isPvpHost ? matchState.player.health : matchState.opponent.health,
        );
        const guestHp = Math.max(
          0,
          isPvpHost ? matchState.opponent.health : matchState.player.health,
        );
        const hostHeroClass = isPvpHost
          ? matchState.player.heroClass
          : matchState.opponent.heroClass;
        const guestHeroClass = isPvpHost
          ? matchState.opponent.heroClass
          : matchState.player.heroClass;
        const reason: 'NORMAL' | 'CONCEDE' | 'LEAVE' | 'DISCONNECT' =
          pvpOpponentLeftNotice
            ? 'LEAVE'
            : matchState.history.some((h) => /항복|concede/i.test(h.detail || ''))
              ? 'CONCEDE'
              : 'NORMAL';
        if (isPvpHost || Boolean(pvpOpponentLeftNotice)) {
          snsheroLiveNetwork.reportMatchResult({
            roomId: livePvpMeta.roomId,
            title: livePvpMeta.isRanked
              ? tr('실시간 랭킹대전', 'Live Ranked Arena')
              : `${livePvpMeta.hostName} vs ${livePvpMeta.guestName}`,
            hostPeerId: livePvpMeta.hostPeerId,
            hostName: livePvpMeta.hostName,
            hostHeroClass,
            guestPeerId: livePvpMeta.guestPeerId,
            guestName: livePvpMeta.guestName,
            guestHeroClass,
            winnerSide,
            winnerName:
              winnerSide === 'HOST'
                ? livePvpMeta.hostName
                : winnerSide === 'GUEST'
                  ? livePvpMeta.guestName
                  : tr('무승부', 'Draw'),
            loserName:
              winnerSide === 'HOST'
                ? livePvpMeta.guestName
                : winnerSide === 'GUEST'
                  ? livePvpMeta.hostName
                  : '',
            hostHp,
            guestHp,
            turnCount: matchState.turnNumber,
            stakeGold: livePvpMeta.stakeGold,
            reason,
            finishedAt: Date.now(),
          });
        }
      }
      // DEV-043: Competitive Fairness 2-Track — Ranked & Bogart have 0% stat change; Ocarina Rhythm Fever awards bonus Gold!
      if ((mode === 'RANKED' || mode === 'BOGART_GAMBLE') && rhythmFeverPct >= 25) {
        const feverGold = Math.min(30, Math.max(5, Math.round((rhythmFeverPct / 100) * 30)));
        const prof = hsStorage.getProfile();
        prof.gold += feverGold;
        hsStorage.saveProfile(prof);
        setRhythmFeverBonusGold(feverGold);
      } else {
        setRhythmFeverBonusGold(0);
      }
      if (didWin && mode === 'BOGART_GAMBLE') {
        hsAudio.playSfx('zelda_chest_open', 0.9);
        hsAudio.playSfx('mario_coin', 0.95);
        playRhythmCue('lethal_finale', { muted: hsAudio.getSettings().muted });
      } else if (didWin) {
        hsAudio.playSfx('mario_coin', 0.75);
        playRhythmCue('lethal_finale', { muted: hsAudio.getSettings().muted });
      }
      setOutcomeSummary(summary);
      setPostGameStep('SUMMARY');
      trackHeroBattleCompleted({
        mode,
        didWin,
        episode: matchState.journeyMeta?.episode,
        turnCount: matchState.turnNumber,
      });
      setLiveProfile(hsStorage.getProfile());
      setPostGameRemainingMs(matchState.winner === 'PLAYER' ? 3000 : 6000);
      postGameFiredRef.current = false;
    }
  }, [
    matchState.phase,
    matchState.winner,
    matchState.player.heroClass,
    matchState.opponent.heroClass,
    mode,
    bogartStakeGold,
  ]);

  // DEV-028: Live Challenger Contextual Taunt Emotes (18s cooldown, respects Squelch/Mute)
  useEffect(() => {
    if (
      (mode !== 'RANKED' && mode !== 'BOGART_GAMBLE') ||
      opponentSquelched ||
      matchState.phase !== 'PLAYING'
    ) {
      return;
    }
    const now = Date.now();
    if (now - lastAutoTauntAtRef.current < 18000) return;

    const hLen = matchState.history.length;
    let tauntMsg: string | null = null;

    if (hLen > lastTauntHistoryLenRef.current) {
      const latest = matchState.history[hLen - 1];
      lastTauntHistoryLenRef.current = hLen;
      if (latest?.actorSide === 'OPPONENT' && latest.cardId) {
        const playedDef = cardDb.getCard(latest.cardId);
        if (playedDef?.rarity === 'LEGENDARY') {
          tauntMsg = tr('전설 에이스 등판! 이건 쉽게 못 막을걸? 😎', 'Behold my Legendary ace! Try stopping this! 😎');
        } else if (playedDef?.type === 'SPELL') {
          tauntMsg = tr('깔끔하게 정리 완료~ 계산대로야! ✨', 'Clean answer~ Everything according to plan! ✨');
        }
      }
    } else if (matchState.player.health <= 10 && matchState.activeSide === 'OPPONENT') {
      tauntMsg = tr('킬각이 보이는데? 체크메이트! ⚡', 'I see lethal on board! Checkmate! ⚡');
    } else if (matchState.activeSide === 'PLAYER' && matchState.turnSecondsLeft === 20) {
      tauntMsg = tr('음… 장고 중이군? 신중하게 내보라고!', 'Thinking hard over there? Make your best move!');
    }

    if (tauntMsg) {
      lastAutoTauntAtRef.current = now;
      setOpponentEmoteText(tauntMsg);
      hsAudio.playSfx('taunt_bubble_pop', 0.8);
      window.setTimeout(() => {
        setOpponentEmoteText((prev) => (prev === tauntMsg ? null : prev));
      }, 3200);
    }
  }, [
    mode,
    isKo,
    opponentSquelched,
    matchState.phase,
    matchState.history,
    matchState.player.health,
    matchState.activeSide,
    matchState.turnSecondsLeft,
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
      defeatPackResult !== null ||
      (mode === 'TUTORIAL' && matchState.winner === 'PLAYER')
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
                onStartJourneyEpisode(outcomeSummary.nextEpisode, false, autoPlay);
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
            onStartJourneyEpisode(retryEp, true, autoPlay);
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
          setHandDrag(null);
          document.body.classList.remove('hs-dragging-active');
          hsAudio.playSfx('end_turn');
          if (prev.livePvpMeta?.role === 'GUEST') {
            snsheroLiveNetwork.sendPvpGuestAction(
              prev.livePvpMeta.roomId,
              prev.livePvpMeta.hostPeerId,
              { kind: 'END_TURN' },
            );
            return prev;
          }
          const nextEng = createEngine(prev);
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
    (rawDamage: number, opts?: { isFinisher?: boolean; customDurationMs?: number }) => {
      const dmg = Math.max(1, Math.round(rawDamage || 1));
      const isFinisher = Boolean(opts?.isFinisher);
      const strength = isFinisher ? 150 : dmg;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now < activeShakeRef.current.until && strength < activeShakeRef.current.strength) {
        return;
      }

      let ampX: number;
      const rotDeg = 0; // GPU 래스터화 쟁크 및 텍스트 블러 방지를 위해 60fps 순수 translate3d 이동
      let durationMs: number;

      if (isFinisher) {
        ampX = 12.5;
        durationMs = opts?.customDurationMs ?? 380;
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
    (side: PlayerSide, attackerId: string, defenderId: string): boolean => {
      if (attackLockRef.current) return false;
      const cur = matchStateRef.current;
      if (cur.phase !== 'PLAYING') return false;

      const enemySide: PlayerSide = side === 'PLAYER' ? 'OPPONENT' : 'PLAYER';
      const atkPlayer = side === 'PLAYER' ? cur.player : cur.opponent;
      const defPlayer = enemySide === 'PLAYER' ? cur.player : cur.opponent;
      const isHeroAttacker = attackerId === `${side}_HERO`;
      const isHeroDefender = defenderId === 'PLAYER_HERO' || defenderId === 'OPPONENT_HERO';

      const atkMinion = isHeroAttacker
        ? null
        : atkPlayer.board.find((m) => m.uid === attackerId) || null;
      if (!isHeroAttacker && !atkMinion) return false;

      const defMinion = isHeroDefender
        ? null
        : defPlayer.board.find((m) => m.uid === defenderId) || null;
      if (!isHeroDefender && !defMinion) return false;

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

      const curPvp = matchStateRef.current.livePvpMeta;
      if (curPvp?.role === 'GUEST' && side === 'PLAYER') {
        snsheroLiveNetwork.sendPvpGuestAction(curPvp.roomId, curPvp.hostPeerId, {
          kind: 'PERFORM_ATTACK',
          attackerId: flipEntityId(attackerId)!,
          defenderId: flipEntityId(defenderId)!,
        });
      }

      const tLunge = window.setTimeout(() => {
        setAttackAnim((prev) =>
          prev && prev.id === animId ? { ...prev, phase: 'LUNGE' } : prev,
        );
      }, 115);

      const tImpact = window.setTimeout(() => {
        try {
          // 주고받는 총 데미지 (공격 피해 + 반격으로 받은 피해) 비례 화면 흔들림 & 안드로이드 진동 강도 차등 적용
          const exchangedDamage = Math.max(1, attackVal + counterDmg);
          hsAudio.vibrateByDamage(exchangedDamage);
          const latest = matchStateRef.current;
          if (latest.phase === 'PLAYING' && latest.livePvpMeta?.role !== 'GUEST') {
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
        // Story Mode Exclusive: If Kadan's Hero directly attacked, Silia immediately chains a random Windstorm Ultimate!
        if (mode === 'TUTORIAL' && side === 'PLAYER' && isHeroAttacker) {
          const heroChainTier = Math.max(1, kadanUltCastCountRef.current || 1);
          fireSiliaChainRef.current(heroChainTier);
        }
      }, 500);

      attackTimersRef.current = [
        ...attackTimersRef.current.slice(-12),
        tLunge,
        tImpact,
        tDone,
      ];
      return true;
    },
    [mode, resolveHeroPortraitUrl, triggerDamageImpact, isKo, lang],
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

  triggerUltimateShakeRef.current = (tier = 1) => {
    triggerDamageImpact(18 + tier * 3, { isFinisher: true, customDurationMs: 520 });
  };

  fireKadanUltimateRef.current = (stackTier: number) => {
    const runBlast = () => {
      if (attackLockRef.current) {
        window.setTimeout(runBlast, 60);
        return;
      }
      const cur = latestMatchRef.current;
      if (cur.phase !== 'PLAYING') return;

      // Smartly pick Silia's follow-up Windstorm skill to fire AFTER Kadan's Blizzard!
      const pickedSiliaSkill: SiliaSkillKind =
        cur.player.health <= 18
          ? 'HEAL'
          : cur.player.board.some((m) => !m.divineShield)
            ? 'DEFENSE'
            : 'ATTACK';

      document.querySelectorAll('[data-hs-entity]').forEach((el) => {
        const id = el.getAttribute('data-hs-entity');
        if (id) recordEntityStagePosition(id, elementCenterInStage(el));
      });
      const kadanEl = document.querySelector('[data-testid="kadan-chatbot-avatar-btn"]');
      if (kadanEl) {
        const pt = elementCenterInStage(kadanEl);
        recordEntityStagePosition('KADAN_WIDGET', pt);
        recordEntityStagePosition('SILIA_WIDGET', { x: pt.x + 36, y: pt.y });
      }

      // 1) Kadan casts first!
      const seqId = Date.now() + stackTier;
      setKadanUltCutIn({
        stackTier,
        stackCount: 100,
        seq: seqId,
      });
      window.setTimeout(() => {
        setKadanUltCutIn((prev) => (prev?.seq === seqId ? null : prev));
      }, 1000);

      const afterKadan = createEngine(cur).useKadanMomentumUltimate(stackTier);
      setMatchState(afterKadan);

      // 2) Silia casts next after Kadan's strike finishes!
      if (afterKadan.phase === 'PLAYING') {
        window.setTimeout(() => {
          fireSiliaChainRef.current(stackTier, pickedSiliaSkill);
        }, 1050);
      }
    };
    runBlast();
  };

  fireSiliaChainRef.current = (stackTier: number, forcedSkill?: SiliaSkillKind) => {
    const runSiliaBlast = () => {
      if (attackLockRef.current) {
        window.setTimeout(runSiliaBlast, 60);
        return;
      }
      const cur = latestMatchRef.current;
      if (cur.phase !== 'PLAYING') return;
      const pool: SiliaSkillKind[] = ['ATTACK', 'DEFENSE', 'HEAL'];
      const picked = forcedSkill ?? pool[Math.floor(Math.random() * pool.length)];

      document.querySelectorAll('[data-hs-entity]').forEach((el) => {
        const id = el.getAttribute('data-hs-entity');
        if (id) recordEntityStagePosition(id, elementCenterInStage(el));
      });
      const kadanEl = document.querySelector('[data-testid="kadan-chatbot-avatar-btn"]');
      if (kadanEl) {
        const pt = elementCenterInStage(kadanEl);
        recordEntityStagePosition('SILIA_WIDGET', { x: pt.x + 36, y: pt.y });
      }

      window.dispatchEvent(
        new CustomEvent('snshero:dual-ultimate-cast', {
          detail: { skillKind: picked },
        }),
      );

      const seqId = Date.now();
      setSiliaChainCutIn({ skillKind: picked, stackTier, seq: seqId });
      window.setTimeout(() => {
        setSiliaChainCutIn((prev) => (prev?.seq === seqId ? null : prev));
      }, 1400);

      triggerUltimateShakeRef.current(stackTier);
      const next = createEngine(cur).useSiliaChainUltimate(picked, stackTier);
      setMatchState(next);
    };
    runSiliaBlast();
  };

  const playerActionStateKey = useMemo(() => {
    const p = matchState.player;
    const o = matchState.opponent;
    const serializeSide = (s: PlayerBattleState) =>
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

  useEffect(() => {
    if (autoPlay) {
      setSelection(null);
      setZoomState(null);
      setHandDrag(null);
      handDragRef.current = null;
      attackerDragRef.current = null;
      document.body.classList.remove('hs-dragging-active');
    }
  }, [autoPlay]);

  // Clear Focus Pin cleanly if pinned minion died/left board
  useEffect(() => {
    if (!focusTargetId || focusTargetId === 'OPPONENT_HERO') return;
    if (!matchState.opponent.board.some((m) => m.uid === focusTargetId)) {
      setFocusTargetId(null);
    }
  }, [focusTargetId, matchState.opponent.board]);

  // ==================== PLAYER AUTO-PLAY ENGINE (카단의 여정 기본 ON, 수동 전환 즉시 해제) ====================
  useEffect(() => {
    const cur = latestMatchRef.current;
    if (!autoPlay || storyPhase !== 'CLOSED' || vsIntroActive || mulliganSwapping) return;
    if (cur.phase === 'GAME_OVER') return;
    if (attackAnim || attackLockRef.current) return;

    // 1. Auto-Mulligan: swap cards costing >= 4 and start duel!
    if (cur.phase === 'MULLIGAN') {
      if (cur.livePvpMeta) return;
      const t = window.setTimeout(() => {
        const snap = latestMatchRef.current;
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
        const eng = createEngine(snap);
        if (isEp0Tutorial) {
          ep0TurnPlaysRef.current = [];
          ep0OpponentPlaysRef.current = [];
          ep0SummaryShownTurnRef.current = null;
          setEp0Dialogue({
            speaker: 'KADAN',
            badge: tr('1턴 개시 · 멀리건 완료', 'Turn 1 Start · Mulligan Done'),
            headline: tr('저비용 카드 확보 완료!', 'Low-Cost Hand Ready!'),
            reason: tr('초반에 바로 낼 수 있는 저비용 카드를 남겼어요!', 'Kept low-Mana cards to play right away early on!'),
          });
        }
        setMatchState(eng.confirmMulligan(replaceUids));
      }, Math.round((isEp0Tutorial ? 1100 : 750) * 1.5));
      return () => window.clearTimeout(t);
    }

    if (cur.phase !== 'PLAYING' || cur.activeSide !== 'PLAYER') {
      return;
    }

    // Pause auto-play tick while inspecting a card or casting Silia
    if (zoomState || siliaAutoPaused) return;
    if (selection) setSelection(null);

    const plannedAction: AiAction | null =
      !cur.chooseOnePrompt && !cur.trackingPrompt
        ? computeNextAiAction(cur, 'EXPERT', 'PLAYER', { stance: activeStance, focusTargetId })
        : null;
    const isEp0TurnSummaryPending =
      isEp0Tutorial &&
      plannedAction?.kind === 'END_TURN' &&
      ep0SummaryShownTurnRef.current !== `${cur.turnNumber}_PLAYER`;
    const baseStepDelayMs = isEp0Tutorial
      ? plannedAction?.kind === 'PLAY_CARD'
        ? 3000
        : plannedAction?.kind === 'END_TURN' && !isEp0TurnSummaryPending
          ? 2400
          : 950
      : 560;
    // Give player comfortable breathing room to cast Silia Ultimates & quantize to BeatSyncScheduler!
    let stepDelayMs = Math.round(baseStepDelayMs * (autoSpeed2x ? 0.72 : 1.5));
    if (rhythmEnabled) {
      const beatInfo = hsAudio.getBeatPhaseInfo(battleBpm);
      const cycleMs = autoSpeed2x ? beatInfo.beatSec * 4000 : beatInfo.beatSec * 1000;
      const curPhase = autoSpeed2x ? beatInfo.barPhase01 : beatInfo.phase01;
      const msToDownbeat = Math.max(40, Math.round((1 - curPhase) * cycleMs));
      // Snap card drop onto the upcoming BGM beat / bar downbeat
      stepDelayMs = Math.max(autoSpeed2x ? 260 : 420, stepDelayMs - (stepDelayMs % Math.max(200, Math.round(cycleMs / 2))) + Math.min(220, msToDownbeat));
    }
    if (isEp0Tutorial && cur.turnNumber >= 2 && plannedAction?.kind === 'PLAY_CARD') {
      setEp0Dialogue({
        speaker: 'KADAN',
        badge: tr('오카리나 리듬 오토 체험', 'Ocarina Rhythm Auto'),
        headline: tr('수축하는 황금 링에 맞춰 탭/Space!', 'Tap / Space on the Golden Beat Ring!'),
        reason: tr('정박에 맞추면 BGM 화음이 울리며 1.5x · 2.0x 성소 공명이 발동합니다!', 'Hit on beat to play BGM chords & trigger 1.5x · 2.0x Sanctuary Resonance!'),
      });
    }
    const timer = window.setTimeout(() => {
      if (attackLockRef.current) return;
      const snap = latestMatchRef.current;
      if (snap.phase !== 'PLAYING' || snap.activeSide !== 'PLAYER') return;
      const sim = createEngine(snap);

      // Handle Choose-One prompt automatically
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

      // Handle Tracking prompt automatically
      if (snap.trackingPrompt) {
        const pickId = snap.trackingPrompt.cards[0];
        hsAudio.playSfx('card_place', 0.8);
        setMatchState(sim.resolveTrackingChoice(pickId));
        return;
      }

      const action: AiAction = computeNextAiAction(snap, 'EXPERT', 'PLAYER', {
        stance: activeStance,
        focusTargetId,
      });
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
        // Safety fallback: prevent deadlock if action failed to advance state
        if (
          next.errorBanner ||
          (!didHistoryAdvance(snap, next) &&
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
        setAiHighlightText(
          isKo
            ? `⚡ 자동 전투: 영웅 능력 [${snap.player.heroPowerNameKo}]!`
            : `⚡ Auto-Play: Hero Power [${snap.player.heroPowerNameKo}]!`,
        );
        if (isEp0Tutorial) {
          const hpReason = tr('남은 2마나로 영웅 능력을 사용합니다.', 'Spending 2 leftover Mana on Hero Power.');
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
        const next = sim.useHeroPower('PLAYER', action.targetId);
        if (next.errorBanner || !didHistoryAdvance(snap, next)) {
          setAiHighlightText(null);
          setMatchState(createEngine(snap).endTurn());
          return;
        }
        setMatchState(next);
      } else if (action.kind === 'ATTACK') {
        if (isEp0Tutorial) {
          const isFace = action.defenderId === 'OPPONENT_HERO';
          setEp0Dialogue({
            speaker: 'KADAN',
            badge: isKo ? `카단 ${snap.turnNumber}턴 · 공격` : `Kadan T${snap.turnNumber} · Attack`,
            headline: isFace
              ? tr('상대 본체 직접 타격!', 'Direct Hero Strike!')
              : tr('적 하수인 먼저 정리!', 'Clear Enemy Minion First!'),
            reason: isFace
              ? tr('도발이 없어 본체를 직접 공격합니다.', 'No Taunt blocks the lane — hit the Hero directly!')
              : tr('적 하수인을 먼저 잡아 필드를 지킵니다.', 'Trade with enemy minions first to hold the board!'),
          });
        }
        const started = triggerPhysicalAttack('PLAYER', action.attackerId, action.defenderId);
        if (!started) {
          setAiHighlightText(null);
          setMatchState(sim.endTurn());
        }
      } else {
        if (isEp0Tutorial) {
          const turnKey = `${snap.turnNumber}_PLAYER`;
          if (ep0SummaryShownTurnRef.current !== turnKey) {
            ep0SummaryShownTurnRef.current = turnKey;
            const summaryText =
              ep0TurnPlaysRef.current.length > 0
                ? ep0TurnPlaysRef.current[ep0TurnPlaysRef.current.length - 1]
                : tr('마나가 부족해 다음 턴(+1)을 준비합니다.', 'Low on Mana — preparing +1 Max Mana next turn!');
            setAiHighlightText(
              isKo ? `💬 카단 ${snap.turnNumber}턴 요약` : `💬 Kadan Turn ${snap.turnNumber} Recap`,
            );
            setEp0Dialogue({
              speaker: 'KADAN',
              badge: isKo ? `카단 ${snap.turnNumber}턴 종료` : `Kadan End of T${snap.turnNumber}`,
              headline: tr('이번 턴 핵심 이유', 'Key Move This Turn'),
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
    mulliganSwapping,
    playerActionStateKey,
    selection,
    zoomState,
    siliaAutoPaused,
    activeStance,
    focusTargetId,
    attackAnim,
    triggerPhysicalAttack,
    isEp0Tutorial,
    ep0SummaryNonce,
    describeEp0Action,
  ]);

  // Step-by-Step Opponent AI Turn Execution Loop (Disabled during Live 1v1 PvP Duel!)
  useEffect(() => {
    const cur = latestMatchRef.current;
    if (
      Boolean(cur.livePvpMeta) ||
      storyPhase !== 'CLOSED' ||
      vsIntroActive ||
      mulliganSwapping ||
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
        : mode === 'BOGART_GAMBLE'
          ? bogartDifficulty
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
        cur.player.health <= 10 &&
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
    const baseOppStepDelayMs = isEp0Tutorial
      ? plannedOpp.kind === 'PLAY_CARD'
        ? 3000
        : plannedOpp.kind === 'END_TURN' && !isEp0OppSummaryPending
          ? 2400
          : 950
      : 620;
    // Match 1.5x slower Auto-Play pace during Opponent turns when Auto-Play is active
    const stepDelayMs = autoPlay ? Math.round(baseOppStepDelayMs * 1.5) : baseOppStepDelayMs;
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
          snap.player.health <= 10 &&
          action.kind === 'ATTACK' &&
          action.defenderId === 'PLAYER_HERO'
        ) {
          action = { kind: 'END_TURN' };
        }
      }

      if (action.kind === 'PLAY_CARD') {
        const def = cardDb.mustGetCard(action.cardId);
        const isSecret = def.mechanics.includes('SECRET');
        const dispName = isSecret
          ? tr('? 비밀', '? Secret')
          : getCardName(def, lang);
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
        const next = sim.playCardFromHand('OPPONENT', action.handUid, {
          targetId: action.targetId,
          insertIndex: action.insertIndex,
          chooseOptionIndex: action.chooseOptionIndex,
        });
        if (next.errorBanner || !didHistoryAdvance(snap, next)) {
          setAiHighlightText(null);
          setMatchState(createEngine(snap).endTurn());
          return;
        }
        setMatchState(next);
      } else if (action.kind === 'HERO_POWER') {
        hsAudio.playSfx('hero_power', 0.85);
        setAiHighlightText(
          isKo
            ? `${snap.opponent.heroNameKo}: 영웅 능력 [${snap.opponent.heroPowerNameKo}]!`
            : `${snap.opponent.heroNameKo}: Hero Power [${snap.opponent.heroPowerNameKo}]!`,
        );
        if (isEp0Tutorial) {
          const botHpReason = tr('방어도 +2로 내구력을 테스트합니다.', 'Testing durability with +2 Armor.');
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
        const next = sim.useHeroPower('OPPONENT', action.targetId);
        if (next.errorBanner || !didHistoryAdvance(snap, next)) {
          setAiHighlightText(null);
          setMatchState(createEngine(snap).endTurn());
          return;
        }
        setMatchState(next);
      } else if (action.kind === 'ATTACK') {
        if (isEp0Tutorial) {
          setEp0Dialogue({
            speaker: 'SCARECROW',
            badge: isKo ? `로봇 ${snap.turnNumber}턴 · 공격` : `Bot T${snap.turnNumber} · Attack`,
            headline: tr('소환 다음 턴 반격!', 'Ready Next Turn Counter!'),
            reason: tr('소환한 다음 턴부터 공격할 수 있습니다.', 'Minions can attack starting the turn after they enter.'),
          });
        }
        const started = triggerPhysicalAttack('OPPONENT', action.attackerId, action.defenderId);
        if (!started) {
          setAiHighlightText(null);
          setMatchState(sim.endTurn());
        }
      } else {
        if (isEp0Tutorial) {
          const turnKey = `${snap.turnNumber}_OPPONENT`;
          if (ep0SummaryShownTurnRef.current !== turnKey) {
            ep0SummaryShownTurnRef.current = turnKey;
            const summaryText =
              ep0OpponentPlaysRef.current.length > 0
                ? ep0OpponentPlaysRef.current[ep0OpponentPlaysRef.current.length - 1]
                : tr('상대 턴 종료! 마나 +1을 받아 반격합니다.', 'Enemy turn ends! Gain +1 Max Mana to strike back.');
            setAiHighlightText(
              isKo ? `💬 카단 · ${snap.turnNumber}턴 해설` : `💬 Kadan · Turn ${snap.turnNumber} Note`,
            );
            setEp0Dialogue({
              speaker: 'KADAN',
              badge: isKo ? `카단 · ${snap.turnNumber}턴 해설` : `Kadan · T${snap.turnNumber} Insight`,
              headline: tr('상대 수에 대비하는 이유', 'Why We Counter That Play'),
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
    autoPlay,
    storyPhase,
    vsIntroActive,
    mulliganSwapping,
    playerActionStateKey,
    mode,
    attackAnim,
    triggerPhysicalAttack,
    isEp0Tutorial,
    ep0SummaryNonce,
    describeEp0Action,
  ]);

  const commitPlayerEndTurn = useCallback(() => {
    const cur = matchStateRef.current;
    if (cur.phase !== 'PLAYING' || cur.activeSide !== 'PLAYER') return;
    if (cur.livePvpMeta?.role === 'GUEST') {
      snsheroLiveNetwork.sendPvpGuestAction(
        cur.livePvpMeta.roomId,
        cur.livePvpMeta.hostPeerId,
        { kind: 'END_TURN' },
      );
      return;
    }
    setMatchState(createEngine(cur).endTurn());
  }, []);

  const commitPlayerHeroPower = useCallback((targetId?: string) => {
    const cur = matchStateRef.current;
    if (cur.phase !== 'PLAYING' || cur.activeSide !== 'PLAYER') return;
    if (cur.livePvpMeta?.role === 'GUEST') {
      snsheroLiveNetwork.sendPvpGuestAction(
        cur.livePvpMeta.roomId,
        cur.livePvpMeta.hostPeerId,
        { kind: 'USE_HERO_POWER', targetId: flipEntityId(targetId) },
      );
      return;
    }
    setMatchState(createEngine(cur).useHeroPower('PLAYER', targetId));
  }, []);

  const commitResolveTracking = useCallback((cardId: string) => {
    const cur = matchStateRef.current;
    if (!cur.trackingPrompt) return;
    if (cur.livePvpMeta?.role === 'GUEST') {
      setMatchState((prev) => ({ ...prev, trackingPrompt: null }));
      snsheroLiveNetwork.sendPvpGuestAction(
        cur.livePvpMeta.roomId,
        cur.livePvpMeta.hostPeerId,
        { kind: 'RESOLVE_TRACKING', cardId },
      );
      return;
    }
    setMatchState(createEngine(cur).resolveTrackingChoice(cardId, 'PLAYER'));
  }, []);

  const handleConcede = useCallback(() => {
    if (matchState.phase === 'GAME_OVER') return;
    if (matchState.livePvpMeta) {
      const oppPeerId =
        matchState.livePvpMeta.role === 'HOST'
          ? matchState.livePvpMeta.guestPeerId
          : matchState.livePvpMeta.hostPeerId;
      snsheroLiveNetwork.sendPvpForfeit(
        matchState.livePvpMeta.roomId,
        oppPeerId,
        'CONCEDE',
      );
      if (matchState.livePvpMeta.role === 'GUEST') {
        snsheroLiveNetwork.sendPvpGuestAction(
          matchState.livePvpMeta.roomId,
          matchState.livePvpMeta.hostPeerId,
          { kind: 'CONCEDE' },
        );
      }
      snsheroLiveNetwork.setActiveBattleRoom(null, null);
    }
    const eng = createEngine(matchState);
    setMatchState(eng.concede('PLAYER'));
  }, [matchState]);

  // ==================== LIVE 1v1 PVP STATE & ACTION SYNC ====================
  const pvpSyncDigest = useMemo(() => {
    if (!isPvpHost) return '';
    return [
      playerActionStateKey,
      matchState.phase,
      matchState.activeSide,
      matchState.turnNumber,
      matchState.winner || '',
      matchState.history[0]?.id || '',
      matchState.vfxQueue.length,
      matchState.chooseOnePrompt ? 1 : 0,
      matchState.trackingPrompt ? 1 : 0,
    ].join('|');
  }, [
    isPvpHost,
    playerActionStateKey,
    matchState.phase,
    matchState.activeSide,
    matchState.turnNumber,
    matchState.winner,
    matchState.history,
    matchState.vfxQueue.length,
    matchState.chooseOnePrompt,
    matchState.trackingPrompt,
  ]);

  // Host -> Guest authoritative state broadcast whenever meaningful battle state advances
  useEffect(() => {
    if (!isPvpHost || !livePvpMeta) return;
    if (matchState.phase === 'MULLIGAN') return;
    snsheroLiveNetwork.sendPvpStateSync(
      livePvpMeta.roomId,
      livePvpMeta.guestPeerId,
      mirrorMatchStateForGuest(matchState),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPvpHost, livePvpMeta?.roomId, livePvpMeta?.guestPeerId, pvpSyncDigest]);

  // Host -> Spectators instant state snapshot reply when a spectator joins mid-battle
  useEffect(() => {
    if (!isPvpHost || !livePvpMeta) return;
    return snsheroLiveNetwork.onSpectateRequest((roomId) => {
      if (roomId !== livePvpMeta.roomId) return;
      const cur = matchStateRef.current;
      snsheroLiveNetwork.sendPvpStateSync(
        livePvpMeta.roomId,
        livePvpMeta.guestPeerId,
        mirrorMatchStateForGuest(cur),
      );
    });
  }, [isPvpHost, livePvpMeta?.roomId, livePvpMeta?.guestPeerId]);

  // Guest <- Host state sync listener
  useEffect(() => {
    if (!isPvpGuest || !livePvpMeta) return;
    return snsheroLiveNetwork.onPvpStateSync((roomId, guestState, seq) => {
      if (roomId !== livePvpMeta.roomId) return;
      if (seq <= lastAppliedGuestSeqRef.current) return;
      lastAppliedGuestSeqRef.current = seq;
      if (guestState.phase === 'PLAYING') {
        setPvpWaitingOpponentMulligan(false);
        setMulliganSwapping(false);
      }
      setMatchState(guestState);
    });
  }, [isPvpGuest, livePvpMeta]);

  // Host <- Guest action execution listener
  useEffect(() => {
    if (!isPvpHost || !livePvpMeta) return;
    return snsheroLiveNetwork.onPvpGuestAction((roomId, action: PvpGuestAction) => {
      if (roomId !== livePvpMeta.roomId) return;
      const cur = matchStateRef.current;

      if (action.kind === 'MULLIGAN_CONFIRM') {
        pvpGuestMulliganRef.current = action.replaceUids;
        if (cur.phase === 'MULLIGAN' && pvpHostMulliganRef.current !== null) {
          const eng = createEngine(cur);
          const started = eng.confirmPvpDualMulligan(
            pvpHostMulliganRef.current,
            pvpGuestMulliganRef.current,
          );
          setPvpWaitingOpponentMulligan(false);
          setMulliganSwapping(false);
          setMatchState(started);
        }
        return;
      }

      if (action.kind === 'CONCEDE') {
        if (cur.phase !== 'GAME_OVER') {
          setMatchState(createEngine(cur).concede('OPPONENT'));
        }
        return;
      }

      if (cur.phase !== 'PLAYING' || cur.activeSide !== 'OPPONENT') return;

      if (action.kind === 'PLAY_CARD') {
        hsAudio.playSfx('card_place', 0.85);
        const next = createEngine(cur).playCardFromHand('OPPONENT', action.handUid, action.opts);
        setMatchState(next);
      } else if (action.kind === 'USE_HERO_POWER') {
        hsAudio.playSfx('hero_power', 0.85);
        const next = createEngine(cur).useHeroPower('OPPONENT', action.targetId);
        setMatchState(next);
      } else if (action.kind === 'PERFORM_ATTACK') {
        const started = triggerPhysicalAttack('OPPONENT', action.attackerId, action.defenderId);
        if (!started) {
          const next = createEngine(cur).performAttack(
            'OPPONENT',
            action.attackerId,
            action.defenderId,
          );
          setMatchState(next);
        }
      } else if (action.kind === 'RESOLVE_TRACKING') {
        const next = createEngine(cur).resolveTrackingChoice(action.cardId, 'OPPONENT');
        setMatchState(next);
      } else if (action.kind === 'END_TURN') {
        hsAudio.playSfx('end_turn', 0.85);
        setMatchState(createEngine(cur).endTurn());
      }
    });
  }, [isPvpHost, livePvpMeta, triggerPhysicalAttack]);

  // Live PvP Emote listener
  useEffect(() => {
    if (!isLivePvp || !livePvpMeta) return;
    return snsheroLiveNetwork.onPvpEmote((roomId, emoteKey) => {
      if (roomId !== livePvpMeta.roomId || opponentSquelched) return;
      const cur = matchStateRef.current;
      const oEmotes =
        cur.opponent.customHero?.emotesKo ||
        getLocalizedHeroInfo(cur.opponent.heroClass, lang).emotes;
      setOpponentEmoteText(oEmotes[emoteKey]);
      hsAudio.playHeroVo(cur.opponent.heroClass, emoteKey);
      window.setTimeout(() => setOpponentEmoteText(null), 2800);
    });
  }, [isLivePvp, livePvpMeta, opponentSquelched, lang]);

  // Live PvP Opponent Leave / Disconnect -> Instant Opponent Defeat (Player Instant Victory)
  useEffect(() => {
    if (!isLivePvp || !livePvpMeta) return;
    const roomId = livePvpMeta.roomId;
    const opponentPeerId =
      livePvpMeta.role === 'HOST' ? livePvpMeta.guestPeerId : livePvpMeta.hostPeerId;

    snsheroLiveNetwork.setActiveBattleRoom(roomId, opponentPeerId);
    let lastOpponentActivityAt = Date.now();

    const triggerOpponentForfeitVictory = (reason: 'LEAVE' | 'CONCEDE' | 'DISCONNECT') => {
      const cur = matchStateRef.current;
      if (cur.phase === 'GAME_OVER') return;
      setPvpWaitingOpponentMulligan(false);
      setMulliganSwapping(false);
      setSelection(null);
      setPvpOpponentLeftNotice(
        reason === 'DISCONNECT'
          ? tr(
              '📡 상대방과의 연결이 끊어져 상대가 즉시 패배했습니다!',
              '📡 Opponent disconnected — Instant Victory!',
            )
          : reason === 'CONCEDE'
            ? tr(
                '🏳️ 상대방이 항복하여 즉시 승리했습니다!',
                '🏳️ Opponent conceded — Instant Victory!',
              )
            : tr(
                '🚪 상대방이 대결에서 나가 즉시 승리했습니다!',
                '🚪 Opponent left the match — Instant Victory!',
              ),
      );
      snsheroLiveNetwork.setActiveBattleRoom(null, null);
      setMatchState(createEngine(cur).concede('OPPONENT'));
    };

    const unsubLeft = snsheroLiveNetwork.onPvpOpponentLeft((evtRoomId, peerId, reason) => {
      if (evtRoomId !== roomId && peerId !== opponentPeerId) return;
      triggerOpponentForfeitVictory(reason);
    });

    const unsubPing = snsheroLiveNetwork.onPvpPing((evtRoomId, peerId) => {
      if (evtRoomId !== roomId && peerId !== opponentPeerId) return;
      lastOpponentActivityAt = Date.now();
    });

    // Send an immediate ping and then every 3s; if opponent silent for 12s, declare disconnect victory
    snsheroLiveNetwork.sendPvpPing(roomId, opponentPeerId);
    const heartbeatIv = window.setInterval(() => {
      if (matchStateRef.current.phase === 'GAME_OVER') {
        snsheroLiveNetwork.setActiveBattleRoom(null, null);
        return;
      }
      snsheroLiveNetwork.sendPvpPing(roomId, opponentPeerId);
      if (Date.now() - lastOpponentActivityAt > 12_000) {
        triggerOpponentForfeitVictory('DISCONNECT');
      }
    }, 3_000);

    return () => {
      window.clearInterval(heartbeatIv);
      unsubLeft();
      unsubPing();
      if (matchStateRef.current.phase !== 'GAME_OVER') {
        snsheroLiveNetwork.sendPvpForfeit(roomId, opponentPeerId, 'LEAVE');
      }
      snsheroLiveNetwork.setActiveBattleRoom(null, null);
    };
  }, [
    isLivePvp,
    livePvpMeta?.roomId,
    livePvpMeta?.hostPeerId,
    livePvpMeta?.guestPeerId,
    livePvpMeta?.role,
  ]);

  // Clear active battle room marker as soon as match reaches GAME_OVER
  useEffect(() => {
    if (isLivePvp && matchState.phase === 'GAME_OVER') {
      snsheroLiveNetwork.setActiveBattleRoom(null, null);
    }
  }, [isLivePvp, matchState.phase]);

  // Toggle Mulligan Card Selection (1-Click authentic Hearthstone stamp!)
  const toggleMulliganCard = (uid: string) => {
    if (mulliganSwapping || pvpWaitingOpponentMulligan) return;
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
    if (mulliganSwapping || pvpWaitingOpponentMulligan) return;
    hsAudio.playSfx('box_press');
    hsAudio.playBgm(Math.random() < 0.5 ? 'duel_1' : 'duel_2');

    const selectedToSwap = [...matchState.mulliganSelectedUids];
    const keptUids = matchState.player.hand
      .filter((h) => !selectedToSwap.includes(h.uid))
      .map((h) => h.uid);

    // Live 1v1 PvP Mulligan Handshake
    if (isLivePvp && livePvpMeta) {
      knownHandUidsRef.current = new Set(keptUids);
      const goingSecond = matchState.firstPlayer === 'OPPONENT';
      if (goingSecond) {
        hsAudio.playInnkeeper('coin');
        setCoinGiftShowcase(true);
        window.setTimeout(() => setCoinGiftShowcase(false), 1750);
      }
      if (isPvpHost) {
        pvpHostMulliganRef.current = selectedToSwap;
        if (pvpGuestMulliganRef.current !== null) {
          const eng = createEngine(matchStateRef.current);
          const started = eng.confirmPvpDualMulligan(
            selectedToSwap,
            pvpGuestMulliganRef.current,
          );
          setPvpWaitingOpponentMulligan(false);
          setMatchState(started);
        } else {
          setPvpWaitingOpponentMulligan(true);
        }
      } else {
        setPvpWaitingOpponentMulligan(true);
        snsheroLiveNetwork.sendPvpGuestAction(livePvpMeta.roomId, livePvpMeta.hostPeerId, {
          kind: 'MULLIGAN_CONFIRM',
          replaceUids: selectedToSwap,
        });
      }
      return;
    }

    const finalizeMulligan = () => {
      const goingSecond = matchState.firstPlayer === 'OPPONENT';
      if (goingSecond) {
        hsAudio.playInnkeeper('coin');
        setCoinGiftShowcase(true);
        window.setTimeout(() => setCoinGiftShowcase(false), 1750);
      }
      knownHandUidsRef.current = new Set(keptUids);
      const eng = createEngine(matchStateRef.current);
      const next = eng.confirmMulligan(selectedToSwap);
      setMulliganSwapping(false);
      setMatchState(next);
    };

    if (selectedToSwap.length > 0) {
      setMulliganSwapping(true);
      hsAudio.playSfx('whoosh', 0.85);
      window.setTimeout(finalizeMulligan, 420);
    } else {
      finalizeMulligan();
    }
  };

  // Play an untargeted or targeted card
  const executePlayPlayerCard = (
    handUid: string,
    opts?: { targetId?: string; insertIndex?: number; chooseOptionIndex?: 0 | 1 },
  ) => {
    const cur = matchStateRef.current;
    const hc = cur.player.hand.find((h) => h.uid === handUid);
    if (!hc) return;
    const def = cardDb.mustGetCard(hc.cardId);
    hsAudio.playSfx('card_place', 0.9);

    if (cur.livePvpMeta?.role === 'GUEST') {
      const spec = CARD_SCRIPTS[def.id];
      if (spec?.chooseOne && opts?.chooseOptionIndex === undefined) {
        const preview = createEngine(cur).playCardFromHand('PLAYER', handUid, opts);
        setSelection(null);
        setHoveredHandCost(null);
        setMatchState(preview);
        return;
      }
      if (def.type === 'MINION') hsStorage.recordQuestProgress('MINION', 1);
      else if (def.type === 'SPELL') hsStorage.recordQuestProgress('SPELL', 1);
      setSelection(null);
      setHoveredHandCost(null);
      setMatchState((prev) => ({ ...prev, chooseOnePrompt: null }));
      snsheroLiveNetwork.sendPvpGuestAction(
        cur.livePvpMeta.roomId,
        cur.livePvpMeta.hostPeerId,
        {
          kind: 'PLAY_CARD',
          handUid,
          opts: opts
            ? {
                ...opts,
                targetId: flipEntityId(opts.targetId),
              }
            : undefined,
        },
      );
      return;
    }

    const eng = createEngine(cur);
    const next = eng.playCardFromHand('PLAYER', handUid, opts);
    // Quest tracking!
    if (next.chooseOnePrompt === null) {
      if (def.type === 'MINION') hsStorage.recordQuestProgress('MINION', 1);
      else if (def.type === 'SPELL') hsStorage.recordQuestProgress('SPELL', 1);
    }
    setSelection(null);
    setHoveredHandCost(null);
    setMatchState(next);
  };

  const executePlayPlayerCardRef = useRef(executePlayPlayerCard);
  executePlayPlayerCardRef.current = executePlayPlayerCard;

  const updateFriendlyInsertIndex = useCallback((clientX: number): number => {
    if (!friendlyRowRef.current) return 0;
    const children = friendlyRowRef.current.querySelectorAll('[data-hs-entity]');
    let idx = children.length;
    for (let i = 0; i < children.length; i++) {
      const rect = (children[i] as HTMLElement).getBoundingClientRect();
      if (clientX < rect.left + rect.width / 2) {
        idx = i;
        break;
      }
    }
    setInsertPreviewIdx((prev) => (prev === idx ? prev : idx));
    return idx;
  }, []);

  // Unified Pointer Move, Drag-and-Drop Release & Escape Cancel
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // 1. Hand Card Dragging
      const hd = handDragRef.current;
      if (hd) {
        const dist = Math.hypot(e.clientX - hd.startX, e.clientY - hd.startY);
        const stagePt = clientToStagePoint(e.clientX, e.clientY);
        if (!hd.isDragging && dist > 14) {
          const cur = matchStateRef.current;
          const isTurn = cur.phase === 'PLAYING' && cur.activeSide === 'PLAYER';
          const hc = cur.player.hand.find((h) => h.uid === hd.handUid);
          if (!isTurn || !hc || attackLockRef.current) {
            handDragRef.current = null;
            setHandDrag(null);
            return;
          }
          const eng = createEngine(cur);
          const check = eng.inspectPlayability('PLAYER', hc);
          if (!check.canPlay) {
            if (e.clientY < hd.startY - 18) {
              setMatchState((s) => ({
                ...s,
                errorBanner:
                  check.reason ||
                  (tr('마나가 부족합니다!', 'Not enough Mana!')),
              }));
            }
            suppressNextClickRef.current = true;
            window.setTimeout(() => {
              suppressNextClickRef.current = false;
            }, 80);
            handDragRef.current = null;
            setHandDrag(null);
            return;
          }

          document.body.classList.add('hs-dragging-active');
          hsAudio.playSfx('card_hover', 0.72);
          updateFriendlyInsertIndex(e.clientX);
          const nextHd: HandDragState = {
            ...hd,
            stageX: stagePt.x,
            stageY: stagePt.y,
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
          if (hd.isMinion) updateFriendlyInsertIndex(e.clientX);
          const nextHd = { ...hd, stageX: stagePt.x, stageY: stagePt.y };
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

          const stagePt = clientToStagePoint(e.clientX, e.clientY);
          const { height: stageH } = getStageSize();
          const handDropFloorY = stageH * 0.78;

          if (check.needsTarget && !check.hasChooseOne) {
            const hitEl = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest('[data-hs-entity]') as HTMLElement | null;
            const targetId = hitEl?.getAttribute('data-hs-entity') || null;
            if (targetId && check.validTargets.includes(targetId)) {
              executePlayPlayerCardRef.current(hd.handUid, {
                targetId,
                insertIndex: cur.player.board.length,
              });
            } else if (stagePt.y > handDropFloorY) {
              setSelection(null);
            }
            return;
          }

          if (stagePt.y <= handDropFloorY) {
            const dropIdx = updateFriendlyInsertIndex(e.clientX);
            executePlayPlayerCardRef.current(hd.handUid, {
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
              commitPlayerHeroPower(targetId);
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
                setMatchState((s) => ({
                  ...s,
                  errorBanner: tr('도발 능력이 있는 하수인이 가로막고 있습니다!', 'A minion with Taunt is in the way!'),
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
        setSquelchMenuOpen(false);
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
  }, [triggerPhysicalAttack, updateFriendlyInsertIndex]);

  const isPlacingMinion =
    selection?.kind === 'HAND_CARD' && !selection.needsTarget && selection.isMinion;

  useEffect(() => {
    if (!isPlacingMinion) return;
    const onMove = (e: PointerEvent) => updateFriendlyInsertIndex(e.clientX);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [isPlacingMinion, updateFriendlyInsertIndex]);

  const handleHandCardPointerDown = (e: React.PointerEvent, handUid: string, cardId: string) => {
    if (e.button !== 0 || matchState.phase !== 'PLAYING' || attackAnim) return;
    const def = cardDb.mustGetCard(cardId);
    const hc = matchState.player.hand.find((h) => h.uid === handUid);
    const check = hc ? engine.inspectPlayability('PLAYER', hc) : null;
    const stagePt = clientToStagePoint(e.clientX, e.clientY);
    const state: HandDragState = {
      handUid,
      cardId,
      startX: e.clientX,
      startY: e.clientY,
      stageX: stagePt.x,
      stageY: stagePt.y,
      isDragging: false,
      needsTarget: Boolean(check?.needsTarget),
      isMinion: def.type === 'MINION',
      hasChooseOne: Boolean(check?.hasChooseOne),
    };
    handDragRef.current = state;
  };

  const handleFriendlyAttackerPointerDown = (e: React.PointerEvent, entityId: string) => {
    if (
      e.button !== 0 ||
      matchState.phase !== 'PLAYING' ||
      matchState.activeSide !== 'PLAYER' ||
      attackAnim
    ) {
      return;
    }
    if (selection) return;
    const swing = engine.canAttackerSwing('PLAYER', entityId);
    if (!swing.ok) return;
    const validTargets = engine.getValidAttackTargets('PLAYER', entityId);
    if (validTargets.length === 0) return;
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
    if (
      e.button !== 0 ||
      matchState.phase !== 'PLAYING' ||
      matchState.activeSide !== 'PLAYER' ||
      attackAnim
    ) {
      return;
    }
    const hpCheck = engine.inspectHeroPower('PLAYER');
    if (!hpCheck.canUse || !hpCheck.needsTarget || hpCheck.validTargets.length === 0) return;
    attackerDragRef.current = {
      sourceKind: 'HERO_POWER',
      sourceId: 'PLAYER_HERO_POWER',
      validTargets: hpCheck.validTargets,
      startX: e.clientX,
      startY: e.clientY,
      isDragging: false,
    };
  };

  // Click a card in Player's Hand -> Playable cards lift/select on 1st tap & quick-play on 2nd tap (double-tap) or board tap; non-playable cards zoom!
  const handleHandCardClick = (handUid: string) => {
    if (suppressNextClickRef.current) return;
    if (matchState.phase !== 'PLAYING' || attackAnim) return;
    const hc = matchState.player.hand.find((h) => h.uid === handUid);
    if (!hc) return;

    const isMyTurn = matchState.activeSide === 'PLAYER';
    const check = isMyTurn ? engine.inspectPlayability('PLAYER', hc) : null;
    if (!isMyTurn || !check?.canPlay) {
      hsAudio.playSfx('card_hover', 0.7);
      setSelection(null);
      setZoomState({ kind: 'HAND_CARD', handUid });
      return;
    }

    if (selection?.kind === 'HAND_CARD' && selection.handUid === handUid) {
      if (!check.needsTarget && !check.hasChooseOne) {
        executePlayPlayerCard(handUid, {
          insertIndex: matchState.player.board.length,
        });
      } else {
        setSelection(null);
      }
      return;
    }

    if (check.hasChooseOne) {
      executePlayPlayerCard(handUid, {
        insertIndex: matchState.player.board.length,
      });
      return;
    }

    const def = cardDb.mustGetCard(hc.cardId);
    hsAudio.playSfx('card_hover', 0.8);
    setSelection({
      kind: 'HAND_CARD',
      handUid,
      cardId: hc.cardId,
      needsTarget: check.needsTarget,
      validTargets: check.validTargets,
      isMinion: def.type === 'MINION',
    });
  };

  // Resolve clicking a target entity (`PLAYER_HERO`, `OPPONENT_HERO`, or minion `uid`)
  const handleEntityClick = (entityId: string, isFriendlyMinionOrHero: boolean) => {
    if (suppressNextClickRef.current) return;
    if (matchState.phase !== 'PLAYING' || attackAnim) return;

    // DEV-023: Hybrid Semi-Auto Focus Pin when Auto-Play is active (tap enemy minion or hero to prioritize!)
    if (!selection && autoPlay && !isFriendlyMinionOrHero) {
      const isValidEnemy =
        entityId === 'OPPONENT_HERO' ||
        matchState.opponent.board.some((m) => m.uid === entityId);
      if (isValidEnemy) {
        hsAudio.playSfx('ui_click', 0.8);
        setFocusTargetId((prev) => (prev === entityId ? null : entityId));
        return;
      }
    }

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
            errorBanner: tr('올바른 대상이 아닙니다!', 'Not a valid target!'),
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
            errorBanner: tr('올바른 대상이 아닙니다!', 'Not a valid target!'),
          }));
        }
        return;
      }

      if (selection.kind === 'HERO_POWER') {
        if (selection.validTargets.includes(entityId)) {
          hsAudio.playSfx('hero_power', 0.9);
          setSelection(null);
          commitPlayerHeroPower(entityId);
        } else if (entityId === 'PLAYER_HERO') {
          // BLD-2702: Damage Hero Powers (e.g. Poseidon Hydro Blast) disallow self-hit — clicking own hero cleanly cancels targeting
          hsAudio.playSfx('ui_click', 0.45);
          setSelection(null);
        } else {
          setMatchState((s) => ({
            ...s,
            errorBanner: tr('올바른 대상이 아닙니다!', 'Not a valid target!'),
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
            setMatchState((s) => ({
              ...s,
              errorBanner: tr('도발 능력이 있는 하수인이 가로막고 있습니다!', 'A minion with Taunt is in the way!'),
            }));
          } else {
            setMatchState((s) => ({
              ...s,
              errorBanner: tr('공격할 수 없는 대상입니다!', 'Cannot attack that target!'),
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
    if (!isFriendlyMinionOrHero) {
      if (entityId === 'OPPONENT_HERO') {
        hsAudio.playSfx('ui_click', 0.65);
        setSquelchMenuOpen((v) => !v);
      } else {
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
          errorBanner: swing.reason || (tr('공격할 수 없습니다.', 'Cannot attack right now.')),
        }));
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
      setMatchState((s) => ({
        ...s,
        errorBanner: hpCheck.reason || (tr('사용할 수 없습니다.', 'Cannot use Hero Power.')),
      }));
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
      setSelection(null);
      commitPlayerHeroPower();
    }
  };

  // Emote Trigger + Live PvP Relay / Polite Rival Reply (Respects Opponent Squelch!)
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

    if (isLivePvp && livePvpMeta) {
      const targetPeer = isPvpHost ? livePvpMeta.guestPeerId : livePvpMeta.hostPeerId;
      snsheroLiveNetwork.sendPvpEmote(livePvpMeta.roomId, targetPeer, emoteKey);
      return;
    }

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
      const oEmotes =
        matchState.opponent.customHero?.emotesKo ||
        getLocalizedHeroInfo(matchState.opponent.heroClass, lang).emotes;
      setOpponentEmoteText(oEmotes[replyKey]);
      hsAudio.playHeroVo(matchState.opponent.heroClass, replyKey);
      window.setTimeout(() => setOpponentEmoteText(null), 2800);
    }, 1500);
  };

  // Interactive 4-Corner Board Diorama Toy Physics + Sanctuary Golden Spirit Root Easter Egg!
  const triggerCornerToy = useCallback(
    (toy: (typeof BOARD_CORNER_TOYS)[BoardThemeId][number]) => {
      setActiveToyPos(toy.pos);
      window.setTimeout(() => {
        setActiveToyPos((prev) => (prev === toy.pos ? null : prev));
      }, 420);

      let toastMsg = isKo ? toy.reaction : toy.reactionEn;
      let vfxLabel: string | undefined;
      let vfxValue: number | undefined;
      const sourceEntity = `TOY_${toy.pos}`;
      let targetEntity = sourceEntity;

      if (toy.vfxKind === 'TOY_CATAPULT') {
        targetEntity = 'TOY_BR';
      } else if (toy.vfxKind === 'TOY_BELL') {
        vfxLabel = tr('♪ 땡~!', '♪ Clang!');
      } else if (toy.vfxKind === 'TOY_RADISH') {
        const roll = Math.random();
        if (roll < 0.18) {
          vfxValue = 777;
          vfxLabel = tr('★ 황금 영초!!', '★ Golden Root!!');
          toastMsg = tr('✦ 대박!! 바람 신전 텃밭에서 전설의 [황금 영초]가 뽑혔습니다!!', '✦ Jackpot!! Plucked a legendary [Golden Spirit Root]!');
        } else if (roll < 0.3) {
          vfxLabel = tr('🥾 낡은 장화?!', '🥾 Old Boot?!');
          toastMsg = tr('엇?! 영초 대신 흙 묻은 낡은 가죽 장화가 뽑혔습니다!', 'Huh?! Pulled up a muddy old leather boot instead!');
        } else {
          vfxLabel = tr('🌱 영초 수확!', '🌱 Herb Plucked!');
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
    [isKo],
  );

  const combinedVfxEvents = useMemo(
    () => [...matchState.vfxQueue, ...localVfxQueue],
    [matchState.vfxQueue, localVfxQueue],
  );

  const handleEntityClickRef = useRef(handleEntityClick);
  handleEntityClickRef.current = handleEntityClick;
  const handlePlayerHeroPowerRef = useRef(handlePlayerHeroPower);
  handlePlayerHeroPowerRef.current = handlePlayerHeroPower;

  const handleMinionSelectCb = useCallback((uid: string, isFriendly: boolean) => {
    handleEntityClickRef.current(uid, isFriendly);
  }, []);
  const handleMinionHoverCb = useCallback((minion: MinionInstance, hov: boolean) => {
    setHoveredBoardMinion((prev) => (hov ? minion : prev?.uid === minion.uid ? null : prev));
  }, []);
  const handleOpponentHeroClickCb = useCallback(() => {
    handleEntityClickRef.current('OPPONENT_HERO', false);
  }, []);
  const handlePlayerHeroClickCb = useCallback(() => {
    handleEntityClickRef.current('PLAYER_HERO', true);
  }, []);
  const handlePlayerHeroPowerCb = useCallback(() => {
    handlePlayerHeroPowerRef.current();
  }, []);
  const noopHeroPowerCb = useCallback(() => {}, []);

  const activeValidTargetSet = useMemo(() => {
    if (!selection) return new Set<string>();
    if ('validTargets' in selection) return new Set(selection.validTargets);
    return new Set<string>();
  }, [selection]);

  const isPlayerTurn = matchState.phase === 'PLAYING' && matchState.activeSide === 'PLAYER';
  const noMovesLeft = isPlayerTurn && !engine.hasAnyAvailableMove('PLAYER');
  const cornerToys = BOARD_CORNER_TOYS[matchState.boardTheme] ?? BOARD_CORNER_TOYS.STORMWIND;
  const isDraggingUntargetedMinionOverBoard =
    Boolean(
      handDrag?.isDragging &&
        handDrag.isMinion &&
        (!handDrag.needsTarget || handDrag.hasChooseOne) &&
        handDrag.stageY <= getStageSize().height * 0.78,
    ) || Boolean(selection?.kind === 'HAND_CARD' && !selection.needsTarget && selection.isMinion);

  const buildMinionStatusPills = (m: MinionInstance): string[] => {
    const pills: string[] = [];
    if (m.silenced) pills.push(tr('침묵 상태', 'Silenced'));
    if (hasMinionTaunt(m)) pills.push(tr('도발', 'Taunt'));
    if (m.divineShield) pills.push(tr('빛의 보호막', 'Divine Shield'));
    if (m.stealth || m.concealedUntilNextTurn) pills.push(tr('은신', 'Stealth'));
    if (m.windfury) pills.push(tr('질풍', 'Windfury'));
    if (m.frozen) pills.push(tr('빙결', 'Frozen'));
    if (m.charge || m.auraCharge) pills.push(tr('돌진', 'Charge'));
    if (m.poisonous && !m.silenced) pills.push(tr('독성', 'Poisonous'));
    if (m.elusive && !m.silenced) pills.push(tr('주문·영웅 능력 대상 불가', 'Elusive'));
    if (m.cantAttack) pills.push(tr('공격 불가', "Can't Attack"));
    if (m.spellDamage > 0 && !m.silenced) {
      pills.push(isKo ? `주문 공격력 +${m.spellDamage}` : `Spell Damage +${m.spellDamage}`);
    }
    if (m.exhausted && !m.charge && !m.auraCharge && !m.cantAttack) {
      pills.push(tr('소환 후유증 (다음 턴 공격 가능)', 'Summoning Sickness (Ready next turn)'));
    } else if (m.attacksMadeThisTurn > 0 && (!m.windfury || m.attacksMadeThisTurn >= 2)) {
      pills.push(tr('이번 턴 공격 완료', 'Already Attacked'));
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
            label: tr('상대 턴에는 카드를 사용할 수 없습니다', "Cannot play cards on opponent's turn"),
            disabled: true,
            onClick: () => {},
          }
        : !check.canPlay
          ? {
              label: check.reason
                ? isKo
                  ? `사용 불가 · ${check.reason}`
                  : `Unavailable · ${check.reason}`
                : tr('마나가 부족합니다', 'Not enough Mana'),
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
                label: tr('전장 위치 직접 지정하여 놓기', 'Choose Exact Board Position'),
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
      const hand = matchState.player.hand;
      const handIdx = hand.findIndex((h) => h.uid === hc.uid);
      const handNav =
        handIdx >= 0 && hand.length > 1
          ? {
              currentIndex: handIdx,
              totalCount: hand.length,
              positionLabel: isKo
                ? `내 손패 ${handIdx + 1} / ${hand.length}`
                : `Hand ${handIdx + 1} / ${hand.length}`,
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
          journeyMultiplier={cardMult}
          playableGlow={
            !canPlayNow ? 'NONE' : check.isComboReady ? 'COMBO' : 'GREEN'
          }
          subtitleBadge={
            isKo
              ? `내 손패 · 보유 마나 ${matchState.player.mana}/${matchState.player.maxMana}${cardMult > 1 ? ` · 스토리모드 ×${cardMult}배` : ''}`
              : `Your Hand · Mana ${matchState.player.mana}/${matchState.player.maxMana}${cardMult > 1 ? ` · Story ×${cardMult}` : ''}`
          }
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
      const cardMult = getPlayerCardMult(def.id);
      const hand = matchState.player.hand;
      const handIdx = hand.findIndex((h) => h.uid === hc.uid);
      const mulliganNav =
        handIdx >= 0 && hand.length > 1
          ? {
              currentIndex: handIdx,
              totalCount: hand.length,
              positionLabel: isKo
                ? `시작 손패 ${handIdx + 1} / ${hand.length}`
                : `Starting Hand ${handIdx + 1} / ${hand.length}`,
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
          journeyMultiplier={cardMult}
          subtitleBadge={
            marked
              ? tr('시작 손패 교체 · 현재 [교체 예정 ✕]', 'Starting Hand · Marked [Replace ✕]')
              : tr('시작 손패 교체 · 현재 [손패 유지]', 'Starting Hand · Marked [Keep]')
          }
          navigation={mulliganNav}
          primaryAction={{
            label: marked
              ? tr('교체 취소 (시작 손패에 유지)', 'Cancel Replace (Keep Card)')
              : tr('교체 표시하기 (덱으로 교체)', 'Mark for Replace (Redraw)'),
            variant: marked ? 'arcane' : 'crimson',
            onClick: () => {
              toggleMulliganCard(hc.uid);
            },
          }}
          secondaryActions={[
            {
              label: tr('확인 (닫기)', 'OK (Close)'),
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
              positionLabel: isKo
                ? `운명의 선택 ${optIdx + 1} / ${opts.length}`
                : `Choose One ${optIdx + 1} / ${opts.length}`,
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
          subtitleBadge={isKo ? `운명의 선택 · ${opt.title}` : `Choose One · ${opt.title}`}
          navigation={chooseNav}
          primaryAction={{
            label: opt.needsTarget
              ? tr('이 효과 선택 · 대상 지정', 'Choose Effect · Select Target')
              : tr('이 효과 사용', 'Use This Effect'),
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
              positionLabel: isKo
                ? `정찰 추적 ${tIdx + 1} / ${tCards.length}`
                : `Tracking ${tIdx + 1} / ${tCards.length}`,
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
          subtitleBadge={
            tr('정찰 추적 — 가져올 카드 1장 선택 (나머지 2장 버림)', 'Tracking — Draw 1 Card (Discard the other 2)')
          }
          navigation={trackingNav}
          primaryAction={{
            label: tr('이 카드 손으로 가져오기', 'Draw This Card'),
            variant: 'emerald',
            onClick: () => {
              setZoomState(null);
              hsAudio.playSfx('card_place');
              commitResolveTracking(zoomState.cardId);
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
              positionLabel: isKo
                ? `전장 동료 ${mIdx + 1} / ${allBoardMinions.length}`
                : `Board Minion ${mIdx + 1} / ${allBoardMinions.length}`,
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
              ? tr('아군 전장 영웅·동료 정보', 'Friendly Board Minion')
              : tr('적 전장 영웅·동료 정보', 'Enemy Board Minion')
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
                  label: tr('이 동료로 공격 대상 선택', 'Select Target to Attack'),
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
                  label: tr('확인 (닫기)', 'OK (Close)'),
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
      if (item.isHiddenSecret) return null;
      const def = cardDb.getCard(item.cardId);
      if (!def) return null;
      const cardHistory = matchState.history.filter(
        (h) => !h.isHiddenSecret && Boolean(cardDb.getCard(h.cardId)),
      );
      const hIdx = cardHistory.findIndex((h) => h.id === item.id);
      const historyNav =
        hIdx >= 0 && cardHistory.length > 1
          ? {
              currentIndex: hIdx,
              totalCount: cardHistory.length,
              positionLabel: isKo
                ? `전투 기록 ${hIdx + 1} / ${cardHistory.length}`
                : `Battle Log ${hIdx + 1} / ${cardHistory.length}`,
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
          subtitleBadge={
            isKo
              ? `${item.turn}턴 기록 · ${item.actorSide === 'PLAYER' ? '아군 행동' : '상대 행동'} — ${item.detail}`
              : `Turn ${item.turn} · ${item.actorSide === 'PLAYER' ? 'Ally Action' : 'Enemy Action'} — ${item.detail}`
          }
          navigation={historyNav}
          primaryAction={{
            label: tr('확인 (닫기)', 'OK (Close)'),
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
        if (squelchMenuOpen) setSquelchMenuOpen(false);
        if (deckTooltipSide) setDeckTooltipSide(null);
        if (selection && !suppressNextClickRef.current) setSelection(null);
      }}
      style={
        {
          backgroundImage: `url(${BOARD_BG_URL[matchState.boardTheme] ?? BOARD_BG_URL.STORMWIND})`,
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
      <BoardVfxCanvas events={combinedVfxEvents} onDamageImpact={triggerDamageImpact} />

      {/* Floating Dragged Card Under Cursor (Stage-Relative inside #hs-stage-canvas!) */}
      {handDrag?.isDragging && (!handDrag.needsTarget || handDrag.hasChooseOne) && (
        <div
          style={{
            left: handDrag.stageX,
            top: handDrag.stageY,
            transform: 'translate(-50%, -55%) scale(0.96) rotate(-3deg)',
          }}
          className="pointer-events-none absolute z-[84] drop-shadow-[0_24px_36px_rgba(0,0,0,0.92)]"
        >
          <HearthstoneCard
            card={cardDb.mustGetCard(handDrag.cardId)}
            journeyMultiplier={getPlayerCardMult(handDrag.cardId)}
            playableGlow="GREEN"
            size="SM"
          />
        </div>
      )}

      {/* Authentic Left-Side Big Card Showcase: Opponent Play, Hidden Secret, Secret Trigger, Fatigue, or Mill Burn */}
      {playedCardShowcase && (
        <div className="pointer-events-none absolute left-2 top-[44%] z-[81] flex -translate-y-1/2 flex-col items-center animate-[hsCardPlayedShowcase_1.45s_ease-out_forwards] sm:left-14 sm:top-1/2">
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
              ? tr('✦ 비밀 발동!', '✦ Secret Triggered!')
              : playedCardShowcase.showcaseType === 'SECRET_HIDDEN'
                ? isKo
                  ? `✦ ${playedCardShowcase.actorName} 비밀 시전!`
                  : `✦ ${playedCardShowcase.actorName} Secret!`
                : playedCardShowcase.showcaseType === 'FATIGUE'
                  ? isKo
                    ? `☠ ${playedCardShowcase.actorName} 탈진!`
                    : `☠ ${playedCardShowcase.actorName} Fatigue!`
                  : playedCardShowcase.showcaseType === 'MILL_BURN'
                    ? tr('🔥 손패 초과! 카드 소각', '🔥 Hand Full! Card Burned')
                    : isKo
                      ? `${playedCardShowcase.actorName} 사용`
                      : `${playedCardShowcase.actorName} Played`}
          </div>

          {playedCardShowcase.showcaseType === 'SECRET_HIDDEN' ? (
            <div className="flex h-[156px] w-[112px] flex-col items-center justify-between rounded-2xl border-[3px] border-fuchsia-300 bg-gradient-to-b from-fuchsia-900 via-purple-950 to-stone-950 p-3 text-center shadow-[0_18px_36px_rgba(0,0,0,0.92),0_0_24px_rgba(217,70,239,0.75)] sm:h-[246px] sm:w-[178px] sm:p-4">
              <span className="rounded-full border border-fuchsia-300/60 bg-black/45 px-2.5 py-0.5 text-[10px] font-extrabold text-fuchsia-200 sm:text-xs">
                {isKo
                  ? `${CLASSIC_HEROES[playedCardShowcase.actorClass].classNameKo} 비밀`
                  : `${getLocalizedHeroInfo(playedCardShowcase.actorClass, lang).className} Secret`}
              </span>
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-200 bg-fuchsia-950 shadow-inner sm:h-24 sm:w-24">
                <span className="hs-num text-4xl font-black text-amber-200 sm:text-6xl">?</span>
              </div>
              <p className="text-[9.5px] font-bold leading-tight text-fuchsia-100 sm:text-xs">
                {tr(
                  '숨겨진 비밀입니다. 조건이 충족되면 발동합니다!',
                  'Hidden Secret! Triggers when its condition is met.',
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
                journeyMultiplier={
                  playedCardShowcase.actorSide === 'PLAYER'
                    ? getPlayerCardMult(playedCardShowcase.cardId)
                    : 1
                }
                size={isCompactMobile ? 'XS' : 'MD'}
              />
              {playedCardShowcase.showcaseType === 'MILL_BURN' && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-gradient-to-t from-red-950/75 via-orange-600/25 to-transparent">
                  <span className="hs-title hs-outline rounded-xl border-2 border-orange-300 bg-red-950/90 px-3 py-1 text-xs font-extrabold text-orange-200 sm:text-base">
                    {tr('🔥 소각됨!', '🔥 Burned!')}
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

      {/* Central 0.85s Hero Power / Effect Drawn Card Preview Toast (DEV-016) */}
      {drawnCardToast && cardDb.getCard(drawnCardToast) && (
        <div
          data-testid="hero-power-draw-toast"
          className="pointer-events-none absolute left-1/2 top-1/2 z-[87] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center animate-[hsCardPop_0.28s_ease-out]"
        >
          <div className="hs-title hs-outline mb-1.5 rounded-full border border-sky-300/60 bg-stone-950/90 px-3 py-0.5 text-sm font-extrabold text-sky-200 sm:text-base">
            {tr('🃏 드로우!', '🃏 Card Drawn!')}
          </div>
          <HearthstoneCard card={cardDb.mustGetCard(drawnCardToast)} playableGlow="GREEN" size="SM" />
        </div>
      )}

      {/* Second-Player "엘윈의 은화" (`GAME_005`) Mulligan Gift Showcase */}
      {coinGiftShowcase && cardDb.getCard('GAME_005') && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[86] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center animate-[hsCardPop_0.35s_ease-out]">
          <div className="hs-title hs-outline mb-1.5 text-lg font-extrabold text-yellow-200 sm:text-2xl">
            {tr('추가 카드 획득 — 엘윈의 은화!', 'Bonus Card — The Coin!')}
          </div>
          <HearthstoneCard card={cardDb.mustGetCard('GAME_005')} playableGlow="GREEN" size="MD" />
        </div>
      )}

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

      {/* Curved Red Targeting Bezier Arrow + Crosshair Reticle (Isolated RAF-throttled Overlay) */}
      <TargetingArrowOverlay selection={selection} />

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

      {/* 4 Interactive Battlefield Corner Toys with Real Canvas Physics! */}
      {cornerToys.map((toy) => {
        const posCls =
          toy.pos === 'TL'
            ? 'left-3 top-14'
            : toy.pos === 'TR'
              ? 'right-3 top-14'
              : toy.pos === 'BL'
                ? 'left-3 bottom-24'
                : 'right-3 bottom-24';
        const isBouncing = activeToyPos === toy.pos;
        return (
          <button
            key={toy.pos}
            type="button"
            data-hs-entity={`TOY_${toy.pos}`}
            title={
              isKo
                ? `전장 기물: ${toy.name} (클릭해 상호작용!)`
                : `Board Toy: ${toy.nameEn} (Click to interact!)`
            }
            onClick={(e) => {
              e.stopPropagation();
              triggerCornerToy(toy);
            }}
            className={`absolute ${posCls} z-30 hidden h-12 w-12 items-center justify-center rounded-2xl border-2 border-amber-400/50 bg-stone-950/65 text-2xl shadow-xl transition hover:scale-115 hover:border-amber-200 active:scale-90 md:flex ${
              isBouncing ? 'animate-[hsToyBounce_0.38s_ease-out]' : ''
            }`}
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
              if (item.isHiddenSecret) {
                setToyToast(
                  tr(
                    '상대편의 비밀입니다! 조건이 충족되어 발동될 때까지 정체가 숨겨집니다.',
                    "Opponent's Secret! Identity stays hidden until triggered.",
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
            onPointerEnter={(e) => {
              if (e.pointerType !== 'mouse') return;
              setHoveredHistoryItem(item);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType !== 'mouse') return;
              setHoveredHistoryItem((prev) => (prev?.id === item.id ? null : prev));
            }}
            className={`relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 shadow transition hover:scale-110 ${
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
            ) : item.kind === 'FATIGUE' || !cardDb.getCard(item.cardId) ? (
              <span className="text-sm font-black text-rose-300">☠</span>
            ) : (
              <>
                <img
                  src={resolveHistoryIconUrl(item)}
                  alt={item.title}
                  className="h-full w-full object-cover object-top"
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
          <div className="px-1 py-3 text-[9px] text-stone-500">{tr('대기', 'Idle')}</div>
        )}
      </aside>

      {/* History Hover Card Tooltip */}
      {liveHoveredHistoryItem && !zoomState && (
        <div className="pointer-events-none absolute left-16 top-1/2 z-[80] hidden -translate-y-1/2 items-center gap-3 rounded-2xl border-2 border-amber-300 bg-stone-950/95 p-3 text-amber-100 shadow-2xl sm:flex">
          {liveHoveredHistoryItem.isHiddenSecret ? (
            <div className="flex h-32 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-fuchsia-300 bg-gradient-to-b from-fuchsia-900 to-stone-950 text-center">
              <span className="hs-num text-3xl font-black text-amber-200">?</span>
              <span className="mt-1 text-[10px] font-extrabold text-fuchsia-200">
                {tr('비공개 비밀', 'Hidden Secret')}
              </span>
            </div>
          ) : liveHoveredHistoryItem.kind === 'FATIGUE' ||
            !cardDb.getCard(liveHoveredHistoryItem.cardId) ? (
            <div className="flex h-32 w-24 shrink-0 flex-col items-center justify-center rounded-xl border-2 border-rose-400 bg-gradient-to-b from-purple-950 to-rose-950 text-center">
              <span className="text-3xl">☠</span>
              <span className="mt-1 text-[11px] font-extrabold text-rose-200">
                {tr('탈진 피해', 'Fatigue')}
              </span>
            </div>
          ) : (
            <HearthstoneCard card={cardDb.mustGetCard(liveHoveredHistoryItem.cardId)} size="SM" />
          )}
          <div className="max-w-[200px]">
            <div className="text-xs font-extrabold text-yellow-300">
              {isKo
                ? `${liveHoveredHistoryItem.turn}턴 · ${liveHoveredHistoryItem.actorSide === 'PLAYER' ? '아군 행동' : '상대 행동'}`
                : `Turn ${liveHoveredHistoryItem.turn} · ${liveHoveredHistoryItem.actorSide === 'PLAYER' ? 'Ally Action' : 'Enemy Action'}`}
            </div>
            <div className="mt-1 text-sm font-extrabold text-white">
              {liveHoveredHistoryItem.isHiddenSecret
                ? tr('비밀 시전 (정체 숨김)', 'Secret Cast (Hidden)')
                : liveHoveredHistoryItem.title}
            </div>
            <p className="mt-1 text-xs text-amber-200/85">
              {liveHoveredHistoryItem.isHiddenSecret
                ? tr(
                    '발동 조건이 충족될 때까지 어떤 비밀인지 공개되지 않습니다.',
                    'Identity remains hidden until its trigger condition is met.',
                  )
                : liveHoveredHistoryItem.detail}
            </p>
          </div>
        </div>
      )}

      {/* Board Minion Hover Full-Card Inspector (Desktop XL) */}
      {liveHoveredBoardMinion &&
        !selection &&
        !handDrag?.isDragging &&
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
        {/* Opponent Remaining Deck Stack + Hover/Click Status Popover */}
        <div
          data-hs-entity="OPPONENT_DECK"
          onMouseEnter={() => setDeckTooltipSide('OPPONENT')}
          onMouseLeave={() => setDeckTooltipSide((prev) => (prev === 'OPPONENT' ? null : prev))}
          onClick={(e) => {
            e.stopPropagation();
            setDeckTooltipSide((prev) => (prev === 'OPPONENT' ? null : 'OPPONENT'));
          }}
          className="relative flex h-14 w-11 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-[#c8a158]/80 bg-stone-950/90 shadow-xl transition hover:border-amber-300"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[6px] opacity-45">
            <SnsCardBackArt variant={profile.selectedCardBack} />
          </div>
          <span className="hs-outline-sm relative z-10 text-[9px] font-extrabold text-red-200">
            {tr('상대 덱', 'Enemy')}
          </span>
          <span className="hs-num relative z-10 text-sm text-white">
            {matchState.opponent.deck.length}
          </span>
          {deckTooltipSide === 'OPPONENT' && (
            <div className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 z-50 w-48 -translate-y-1/2 rounded-xl border-2 border-[#c8a158] bg-stone-950/95 px-3 py-2 text-left text-[11px] text-amber-100 shadow-2xl">
              <div className="font-extrabold text-red-300">
                {tr('상대편 덱 상태', 'Enemy Deck Status')}
              </div>
              <div className="mt-0.5 font-bold">
                {matchState.opponent.deck.length > 0
                  ? tr(
                      `남은 카드: ${matchState.opponent.deck.length}장`,
                      `Cards left: ${matchState.opponent.deck.length}`,
                    )
                  : tr(
                      `카드 없음! 다음 탈진 피해: ${matchState.opponent.fatigueCounter + 1}`,
                      `Empty! Next Fatigue: ${matchState.opponent.fatigueCounter + 1}`,
                    )}
              </div>
              <div className="mt-0.5 text-[10px] text-amber-200/80">
                {tr(
                  `현재 손패: ${matchState.opponent.hand.length} / 10장`,
                  `Hand size: ${matchState.opponent.hand.length} / 10`,
                )}
              </div>
            </div>
          )}
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
          data-testid="battle-end-turn-btn"
          disabled={!isPlayerTurn || Boolean(attackAnim)}
          onClick={(e) => {
            e.stopPropagation();
            if (!isPlayerTurn || attackAnim) return;
            setSelection(null);
            setHoveredBoardMinion(null);
            setHoveredHistoryItem(null);
            hsAudio.playSfx('end_turn');
            commitPlayerEndTurn();
          }}
          className={`group relative flex h-[54px] w-[114px] items-center justify-center transition ${
            !isPlayerTurn
              ? 'cursor-not-allowed opacity-90'
              : 'cursor-pointer hover:scale-105'
          }`}
        >
          <EndTurnLeverPlate isPlayerTurn={isPlayerTurn} noMovesLeft={noMovesLeft} isKo={isKo} />
        </button>

        {/* Player Remaining Deck Stack + Hover/Click Status Popover */}
        <div
          data-hs-entity="PLAYER_DECK"
          onMouseEnter={() => setDeckTooltipSide('PLAYER')}
          onMouseLeave={() => setDeckTooltipSide((prev) => (prev === 'PLAYER' ? null : prev))}
          onClick={(e) => {
            e.stopPropagation();
            setDeckTooltipSide((prev) => (prev === 'PLAYER' ? null : 'PLAYER'));
          }}
          className="relative flex h-14 w-11 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-[#c8a158]/80 bg-stone-950/90 shadow-xl transition hover:border-amber-300"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[6px] opacity-45">
            <SnsCardBackArt variant={profile.selectedCardBack} />
          </div>
          <span className="hs-outline-sm relative z-10 text-[9px] font-extrabold text-sky-200">
            {tr('내 덱', 'Deck')}
          </span>
          <span className="hs-num relative z-10 text-sm text-white">
            {matchState.player.deck.length}
          </span>
          {deckTooltipSide === 'PLAYER' && (
            <div className="pointer-events-none absolute right-[calc(100%+10px)] top-1/2 z-50 w-48 -translate-y-1/2 rounded-xl border-2 border-[#c8a158] bg-stone-950/95 px-3 py-2 text-left text-[11px] text-amber-100 shadow-2xl">
              <div className="font-extrabold text-sky-300">
                {tr('내 덱 상태', 'Your Deck Status')}
              </div>
              <div className="mt-0.5 font-bold">
                {matchState.player.deck.length > 0
                  ? tr(
                      `남은 카드: ${matchState.player.deck.length}장`,
                      `Cards left: ${matchState.player.deck.length}`,
                    )
                  : tr(
                      `카드 없음! 다음 탈진 피해: ${matchState.player.fatigueCounter + 1}`,
                      `Empty! Next Fatigue: ${matchState.player.fatigueCounter + 1}`,
                    )}
              </div>
              <div className="mt-0.5 text-[10px] text-amber-200/80">
                {tr(
                  `현재 손패: ${matchState.player.hand.length} / 10장`,
                  `Hand size: ${matchState.player.hand.length} / 10`,
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ==================== TOP ZONE: OPPONENT HAND + CENTERED OPPONENT HERO ==================== */}
      <header className="relative z-20 flex w-full flex-col items-center pt-1">
        {/* Top Utility Strip: Opponent Mana (Left) + Opponent Hand (Dead-Center on sm+) + Options (Right) */}
        <div className="flex w-full min-w-0 items-center justify-between gap-1 px-1.5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-1.5 sm:px-3">
          <div className="flex min-w-0 shrink items-center gap-1 rounded-xl border-2 border-[#b8924d]/75 bg-stone-950/90 px-1.5 py-1 text-[10.5px] text-amber-100 shadow-lg sm:justify-self-start sm:gap-2 sm:px-3 sm:text-xs">
            <img
              src={CLASS_CREST_URL[matchState.opponent.heroClass]}
              alt=""
              className="h-4 w-4 shrink-0 rounded-full object-cover"
            />
            <span className="max-w-[54px] truncate font-extrabold text-red-200 sm:max-w-none">
              {matchState.opponent.name}
            </span>
            <span className="text-stone-500">·</span>
            <span className="shrink-0 font-extrabold text-sky-300">
              <span className="hidden sm:inline">{tr('마나', 'Mana')} </span>
              <span className="sm:hidden">💎</span>
              {matchState.opponent.mana}/{matchState.opponent.maxMana}
            </span>
            <span className="hidden text-stone-500 sm:inline">·</span>
            <span className="hidden font-bold text-amber-200/85 sm:inline">
              {isKo ? `손패 ${matchState.opponent.hand.length}장` : `Hand ${matchState.opponent.hand.length}`}
            </span>
          </div>

          {/* Opponent Face-Down Curved Hand (Visible on BOTH Mobile Portrait & Desktop!) */}
          <div
            title={isKo ? `상대 손패: ${matchState.opponent.hand.length}장` : `Enemy Hand: ${matchState.opponent.hand.length}`}
            className="flex min-w-0 shrink items-center justify-center -space-x-3.5 sm:shrink-0 sm:justify-self-center sm:-space-x-3"
          >
            {matchState.opponent.hand.map((hc, idx) => {
              const rot = (idx - (matchState.opponent.hand.length - 1) / 2) * 3;
              return (
                <div
                  key={hc.uid}
                  style={{ transform: `rotate(${rot}deg)` }}
                  className="h-7 w-4 overflow-hidden rounded-[4px] shadow sm:h-14 sm:w-10 sm:rounded-md"
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
              data-testid="battle-top-lang-btn"
              onClick={(e) => {
                e.stopPropagation();
                hsAudio.playSfx('ui_click', 0.7);
                setLanguage(isKo ? 'en' : 'ko');
              }}
              aria-label={isKo ? 'Switch to English' : '한국어로 전환'}
              title={isKo ? 'Switch to English' : '한국어로 전환'}
              className="min-h-[36px] rounded-xl border border-sky-300/55 bg-stone-950/90 px-2 py-1 text-[10px] font-extrabold text-sky-200 shadow hover:border-sky-200 hover:text-white sm:min-h-[38px] sm:px-2.5 sm:text-xs"
            >
              {isKo ? 'EN' : '한'}
            </button>
            <button
              type="button"
              data-testid="battle-rules-btn"
              onClick={(e) => {
                e.stopPropagation();
                hsAudio.playSfx('ui_click', 0.75);
                setQuickRulesOpen(true);
              }}
              aria-label={tr('게임 규칙', 'Game Rules')}
              className="min-h-[36px] rounded-xl border border-amber-300/65 bg-stone-950/90 px-2 py-1 text-[10.5px] font-extrabold text-amber-200 shadow hover:bg-stone-900 sm:min-h-[38px] sm:px-2.5 sm:text-xs"
            >
              <span className="sm:hidden">?</span>
              <span className="hidden sm:inline">{tr('? 규칙', '? Rules')}</span>
            </button>
            {mode === 'TUTORIAL' && matchState.journeyMeta && (
              <button
                type="button"
                data-testid="story-episode-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  hsAudio.playSfx('open_menu', 0.75);
                  setEpisodeSelectorOpen(true);
                }}
                className="min-h-[36px] rounded-xl border border-emerald-300/70 bg-emerald-950/90 px-2 py-1 text-[10.5px] font-extrabold text-emerald-200 shadow sm:min-h-[38px] sm:px-2.5 sm:text-xs"
              >
                <span className="sm:hidden">
                  {isKo ? `📖 ${matchState.journeyMeta.episode}화` : `📖 EP.${matchState.journeyMeta.episode}`}
                </span>
                <span className="hidden sm:inline">
                  {isKo
                    ? `📖 제${matchState.journeyMeta.episode}화 · 회차/대사`
                    : `📖 EP ${matchState.journeyMeta.episode} · Stages`}
                </span>
              </button>
            )}

            <button
              type="button"
              data-testid="battle-top-gear-btn"
              onClick={(e) => {
                e.stopPropagation();
                hsAudio.playSfx('open_menu');
                onOpenOptions(handleConcede);
              }}
              className="hs-brass-btn min-h-[36px] rounded-xl px-2 py-1 text-[10.5px] font-extrabold text-amber-100 sm:min-h-[38px] sm:px-3 sm:text-xs"
            >
              <span className="sm:hidden">⚙ {tr('메뉴', 'Menu')}</span>
              <span className="hidden sm:inline">⚙ {tr('메뉴 · 항복', 'Menu · Concede')}</span>
            </button>
          </div>
        </div>

        {/* Opponent Hero Arch (100% Horizontally Centered on Stage Axis + Right-Click/Tap Squelch) */}
        <div className="mt-0.5 flex w-full items-center justify-center sm:mt-1">
          <div className="relative flex items-center justify-center">
            {focusTargetId === 'OPPONENT_HERO' && (
              <span
                data-testid="focus-pin-OPPONENT_HERO"
                className="pointer-events-none absolute -top-2 z-40 animate-pulse rounded-full border border-rose-200 bg-rose-700/95 px-2.5 py-0.5 text-[10px] font-black text-white shadow-[0_0_16px_rgba(244,63,94,0.9)]"
              >
                ◎ {tr('집중 타격 (FOCUS)', 'FOCUS TARGET')}
              </span>
            )}
            <HeroPortraitZone
              player={matchState.opponent}
              isFriendly={false}
              isActiveTurn={matchState.activeSide === 'OPPONENT'}
              canHeroAttack={false}
              isHeroSelectedAttacker={false}
              isHeroValidTarget={activeValidTargetSet.has('OPPONENT_HERO')}
              isAttackingHidden={attackAnim?.attackerId === 'OPPONENT_HERO'}
              isIncomingAttackTarget={attackAnim?.defenderId === 'OPPONENT_HERO'}
              isDefeated={matchState.phase === 'GAME_OVER' && matchState.winner === 'PLAYER'}
              isSquelched={opponentSquelched}
              canUseHeroPower={false}
              isHeroPowerSelected={false}
              emoteBubbleText={opponentSquelched ? null : opponentEmoteText}
              onClickHero={handleOpponentHeroClickCb}
              onHeroContextMenu={() => {
                hsAudio.playSfx('ui_click', 0.7);
                setSquelchMenuOpen((v) => !v);
              }}
              onClickHeroPower={noopHeroPowerCb}
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
                      ? tr(
                          '상대 영웅의 감정표현을 차단했습니다.',
                          'Opponent emotes squelched.',
                        )
                      : tr(
                          '상대 영웅의 감정표현 차단을 해제했습니다.',
                          'Opponent emotes unsquelched.',
                        ),
                  );
                  window.setTimeout(() => setToyToast(null), 1900);
                }}
                className="hs-ivory-plate absolute -right-24 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-2xl px-3.5 py-1.5 text-xs font-extrabold text-[#2b180a] shadow-2xl sm:-right-28"
              >
                {opponentSquelched
                  ? tr('🔊 차단 해제', '🔊 Unsquelch')
                  : tr('🔇 차단', '🔇 Squelch')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==================== CENTER ZONE: 7v7 BATTLEFIELD ARENA ==================== */}
      <main className="relative z-20 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-1 px-1.5 sm:gap-2 sm:px-12">
        {/* Compact Single-Line Mode / Opponent Pill Under Opponent Portrait */}
        {isLivePvp && livePvpMeta ? (
          <div
            data-testid="live-pvp-battle-banner"
            className="mx-auto flex max-w-[92vw] items-center justify-center gap-1.5 rounded-full border border-emerald-400/70 bg-[#061812]/90 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-100 shadow sm:px-3 sm:text-[11px]"
          >
            <span className="inline-block h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            <span className="truncate">
              ⚔️{' '}
              {livePvpMeta.isRanked
                ? tr('실시간 랭킹', 'Live Ranked')
                : tr('실시간 1:1', 'Live 1v1')}{' '}
              · {isPvpHost ? livePvpMeta.guestName : livePvpMeta.hostName}
            </span>
            <span className="shrink-0 rounded bg-amber-500/25 px-1.5 py-0.5 text-[9.5px] text-yellow-200">
              {livePvpMeta.stakeGold > 0
                ? `${livePvpMeta.stakeGold.toLocaleString()}G`
                : tr('친선', 'Friendly')}
            </span>
          </div>
        ) : mode === 'BOGART_GAMBLE' ? (
          <div
            data-testid="battle-challenger-badge"
            className="mx-auto flex max-w-[92vw] items-center justify-center gap-1.5 rounded-full border border-amber-400/55 bg-stone-950/88 px-2.5 py-0.5 text-[10px] font-extrabold text-yellow-200 shadow sm:px-3 sm:text-[11px]"
          >
            <span className="truncate">
              🎲{' '}
              {tr(
                `보가트 ${bogartDifficulty === 'EXPERT' ? '숙련' : '일반'} · ${(bogartStakeGold ?? 100).toLocaleString()}G (승리 +${((bogartStakeGold ?? 100) * 2).toLocaleString()}G)`,
                `Bogart ${bogartDifficulty === 'EXPERT' ? 'Expert' : 'Normal'} · ${(bogartStakeGold ?? 100).toLocaleString()}G (Win +${((bogartStakeGold ?? 100) * 2).toLocaleString()}G)`,
              )}
            </span>
          </div>
        ) : mode === 'RANKED' && resolvedChallenger ? (
          <div
            data-testid="battle-challenger-badge"
            className="mx-auto flex max-w-[92vw] items-center justify-center gap-1.5 rounded-full border border-sky-400/50 bg-stone-950/88 px-2.5 py-0.5 text-[10px] font-extrabold text-sky-200 shadow sm:px-3 sm:text-[11px]"
          >
            <span className="truncate">
              🏆 {resolvedChallenger.badgeIcon} <b className="text-white">{resolvedChallenger.nickname}</b>
            </span>
          </div>
        ) : mode === 'TUTORIAL' && matchState.journeyMeta ? (
          <div className="mx-auto flex max-w-[92vw] items-center justify-center gap-1.5 rounded-full border border-emerald-400/50 bg-stone-950/88 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-100 shadow sm:px-3 sm:text-[11px]">
            <span className="truncate text-yellow-300">
              {matchState.journeyMeta.reincarnation > 0
                ? tr(`환생 ${matchState.journeyMeta.reincarnation} · `, `R${matchState.journeyMeta.reincarnation} · `)
                : ''}
              {isKo
                ? `제${matchState.journeyMeta.episode}화 「${matchState.journeyMeta.episodeTitle}」`
                : `EP ${matchState.journeyMeta.episode}: ${matchState.journeyMeta.episodeTitle}`}
            </span>
            <span className="shrink-0 text-emerald-300">
              ×{matchState.journeyMeta.enemyStatScale}
            </span>
          </div>
        ) : null}

        {/* Episode 0 Mobile Full-Width Tutorial Speech Bubble (Never Squished) */}
        {isEp0Tutorial &&
          ep0Dialogue &&
          storyPhase === 'CLOSED' &&
          !vsIntroActive &&
          matchState.phase === 'PLAYING' && (
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
            <div
              key={m.uid}
              className={`relative animate-[hsMinionSummonDrop_0.34s_cubic-bezier(0.22,1,0.36,1)] ${
                focusTargetId === m.uid
                  ? 'rounded-full ring-4 ring-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.9)]'
                  : ''
              }`}
            >
              {focusTargetId === m.uid && (
                <span
                  data-testid={`focus-pin-${m.uid}`}
                  className="pointer-events-none absolute -top-3 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-rose-200 bg-rose-700 px-2 py-0.5 text-[9.5px] font-black text-white shadow"
                >
                  ◎ {tr('집중 점사', 'FOCUS')}
                </span>
              )}
              <BoardMinionToken
                minion={m}
                isFriendly={false}
                canAttack={false}
                isSelectedAttacker={false}
                isValidTarget={activeValidTargetSet.has(m.uid)}
                isAttackingHidden={attackAnim?.attackerId === m.uid}
                isIncomingAttackTarget={attackAnim?.defenderId === m.uid}
                onSelectEntity={handleMinionSelectCb}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  hsAudio.playSfx('card_hover', 0.65);
                  setZoomState({ kind: 'BOARD_MINION', minion: m, isFriendly: false });
                }}
                onHoverMinion={handleMinionHoverCb}
              />
            </div>
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
              <div className="relative h-2 w-full rounded-full bg-stone-950/60">
                <div
                  style={{ width: `${(matchState.turnSecondsLeft / 15) * 100}%` }}
                  className="relative h-2 rounded-full bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-200 transition-all duration-1000"
                >
                  <div className="absolute -right-2 -top-1.5 h-5 w-5 rounded-full bg-yellow-200 shadow-[0_0_16px_#fde047,0_0_28px_#f97316] animate-[hsRopeSpark_0.22s_ease-in-out_infinite]" />
                </div>
              </div>
              <span className="hs-num ml-2 whitespace-nowrap rounded-full bg-red-900 px-2 py-0.5 text-xs text-yellow-200 shadow">
                🔥 {matchState.turnSecondsLeft}{tr('초!', 's!')}
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
              data-testid="battle-end-turn-mobile-btn"
              disabled={!isPlayerTurn || Boolean(attackAnim)}
              onClick={() => {
                if (!isPlayerTurn || attackAnim) return;
                setSelection(null);
                hsAudio.playSfx('end_turn');
                commitPlayerEndTurn();
              }}
              className={`relative flex h-[34px] w-[76px] shrink-0 items-center justify-center transition ${
                !isPlayerTurn ? 'cursor-not-allowed opacity-90' : 'active:scale-95'
              }`}
            >
              <EndTurnLeverPlate
                isPlayerTurn={isPlayerTurn}
                noMovesLeft={noMovesLeft}
                isKo={isKo}
                compact
              />
            </button>
          </div>
        </div>

        {/* Friendly Minion Row (Max 7 + Positional Drop Slot Preview for Drag or Click!) */}
        <div
          ref={friendlyRowRef}
          onClick={(e) => {
            if (selection?.kind === 'HAND_CARD' && !selection.needsTarget) {
              e.stopPropagation();
              executePlayPlayerCard(selection.handUid, { insertIndex: insertPreviewIdx });
            }
          }}
          className={`flex min-h-[70px] items-center justify-center gap-1 rounded-3xl transition sm:min-h-[124px] sm:gap-3 ${
            isDraggingUntargetedMinionOverBoard ||
            (selection?.kind === 'HAND_CARD' && !selection.needsTarget)
              ? 'cursor-pointer bg-emerald-500/15 ring-2 ring-emerald-400/60'
              : ''
          }`}
        >
          {matchState.player.board.map((m, idx) => (
            <React.Fragment key={m.uid}>
              {isDraggingUntargetedMinionOverBoard && insertPreviewIdx === idx && (
                <div className="flex h-[64px] w-11 shrink-0 items-center justify-center rounded-[50%] border-2 border-dashed border-emerald-300 bg-emerald-400/25 text-center text-[9px] font-extrabold text-emerald-100 transition-all duration-150 sm:h-[102px] sm:w-14 sm:text-[10px]">
                  {tr('여기 배치', 'Place Here')}
                </div>
              )}
              <div className="animate-[hsMinionSummonDrop_0.34s_cubic-bezier(0.22,1,0.36,1)]">
                <BoardMinionToken
                  minion={m}
                  isFriendly
                  canAttack={isPlayerTurn && !attackAnim && engine.canAttackerSwing('PLAYER', m.uid).ok}
                  isSelectedAttacker={
                    selection?.kind === 'ATTACKER' && selection.attackerId === m.uid
                  }
                  isValidTarget={activeValidTargetSet.has(m.uid)}
                  isAttackingHidden={attackAnim?.attackerId === m.uid}
                  isIncomingAttackTarget={attackAnim?.defenderId === m.uid}
                  onSelectEntity={handleMinionSelectCb}
                  onPointerDown={(e) => handleFriendlyAttackerPointerDown(e, m.uid)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hsAudio.playSfx('card_hover', 0.65);
                    setZoomState({ kind: 'BOARD_MINION', minion: m, isFriendly: true });
                  }}
                  onHoverMinion={handleMinionHoverCb}
                />
              </div>
            </React.Fragment>
          ))}

          {isDraggingUntargetedMinionOverBoard &&
            insertPreviewIdx >= matchState.player.board.length && (
              <div className="flex h-[64px] w-12 shrink-0 items-center justify-center rounded-[50%] border-2 border-dashed border-emerald-300 bg-emerald-400/25 text-center text-[9px] font-extrabold text-emerald-100 transition-all duration-150 sm:h-[102px] sm:w-16 sm:text-[10px]">
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

          {matchState.player.board.length === 0 &&
            !selection &&
            !isDraggingUntargetedMinionOverBoard && (
              <div className="text-[11px] font-bold text-amber-100/35 sm:text-xs">
                {tr('내 전장', 'Friendly Board')}
              </div>
            )}
        </div>
      </main>

      {/* ==================== BOTTOM ZONE: CENTERED PLAYER HERO + CURVED HAND + BOTTOM-RIGHT MANA ==================== */}
      <footer className="relative z-30 flex w-full flex-col items-center pb-1 sm:pb-1.5">
        {/* Live Situation / Coach Status Pill Above Player Portrait (Balanced with Top 1-Line Mode Pill) */}
        {coachTip && !isEp0Tutorial && storyPhase === 'CLOSED' && !vsIntroActive && (
          <div
            data-testid="battle-coach-banner"
            className="mb-1 flex max-w-[92vw] items-center justify-between gap-1.5 rounded-full border border-amber-400/45 bg-stone-950/90 px-2.5 py-0.5 text-[10px] text-amber-50 shadow sm:max-w-xl sm:px-3 sm:text-[11px]"
          >
            {coachCollapsed ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCoachCollapsed(false);
                }}
                className="flex items-center gap-1 font-extrabold text-amber-200 hover:text-amber-100"
              >
                <span>💡</span>
                <span>{tr('상황 안내 펼치기', 'Show Status')}</span>
              </button>
            ) : (
              <>
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-black ${
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
                  <span className="truncate font-bold">{coachTip.text}</span>
                </div>
                <button
                  type="button"
                  title={tr('상황 안내 접기', 'Hide Status')}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoachCollapsed(true);
                  }}
                  className="shrink-0 rounded-full border border-amber-400/30 px-1.5 text-[9.5px] font-bold text-amber-200 hover:bg-stone-800"
                >
                  —
                </button>
              </>
            )}
          </div>
        )}

        {/* Centered Player Hero Arch + Out-of-Flow Emote Trigger (Zero Center Offset!) */}
        <div className="relative flex w-full items-center justify-center px-2">
          <div className="relative flex items-center justify-center">
            {/* Emote Menu Brass Trigger (Out-of-flow on the left so Hero Portrait stays 100% centered!) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                hsAudio.playSfx('ui_click', 0.75);
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
              isDefeated={matchState.phase === 'GAME_OVER' && matchState.winner === 'OPPONENT'}
              canUseHeroPower={isPlayerTurn && !attackAnim && engine.inspectHeroPower('PLAYER').canUse}
              isHeroPowerSelected={selection?.kind === 'HERO_POWER'}
              emoteBubbleText={playerEmoteText || playErrorBubble}
              onClickHero={handlePlayerHeroClickCb}
              onClickHeroPower={handlePlayerHeroPowerCb}
              onHeroPointerDown={(e) => handleFriendlyAttackerPointerDown(e, 'PLAYER_HERO')}
              onHeroPowerPointerDown={handleHeroPowerPointerDown}
              onHeroContextMenu={() => {
                hsAudio.playSfx('ui_click', 0.75);
                setEmoteMenuOpen((v) => !v);
              }}
            />

            {/* Authentic 6-Bubble Radial Speech-Bubble Emote Wheel Around Hero */}
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
        </div>

        {/* Player Curved Hand Fan (Supports Drag-to-Play, Hover Mana Preview, Draw Flight & Tap-to-Zoom!) */}
        <div className="hs-no-scrollbar mt-0.5 flex min-h-[142px] w-full items-end overflow-x-auto px-3 pb-0.5 pt-1.5 sm:min-h-[192px] sm:justify-center sm:overflow-x-visible sm:px-4 sm:pb-1 sm:pt-2">
          <div className="mx-auto flex w-max items-end">
            {matchState.player.hand.map((hc, idx) => {
              const def = cardDb.mustGetCard(hc.cardId);
              const check = engine.inspectPlayability('PLAYER', hc);
              const isBeingDragged = handDrag?.isDragging && handDrag.handUid === hc.uid;
              const isNewlyDrawn = newlyDrawnUids.has(hc.uid);
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
                    marginLeft: idx > 0 ? (isCompactMobile ? -24 : desktopOverlapPx) : 0,
                    transform: isSelectedCard
                      ? 'translateY(-18px) scale(1.08)'
                      : `translateY(${liftY}px) rotate(${angle}deg)`,
                  }}
                  className={`relative touch-none transition-all duration-150 ${
                    isBeingDragged && (!handDrag?.needsTarget || handDrag?.hasChooseOne)
                      ? 'pointer-events-none opacity-20'
                      : ''
                  } ${
                    isNewlyDrawn
                      ? 'animate-[hsCardDrawFly_0.55s_cubic-bezier(0.2,0.9,0.25,1)_both]'
                      : ''
                  } ${
                    isSelectedCard
                      ? 'z-50'
                      : 'hover:z-50 sm:hover:-translate-y-7 sm:hover:rotate-0 sm:hover:scale-110'
                  }`}
                >
                  {selection?.kind === 'HAND_CARD' && selection.handUid === hc.uid && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hsAudio.playSfx('card_hover', 0.7);
                        setSelection(null);
                        setZoomState({ kind: 'HAND_CARD', handUid: hc.uid });
                      }}
                      title={tr('카드 상세 보기', 'Inspect Card')}
                      className="hs-brass-btn absolute -top-3 right-0 z-50 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-amber-100 shadow-lg"
                    >
                      🔍
                    </button>
                  )}
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
                    className="cursor-grab active:cursor-grabbing"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Original Hearthstone Bottom-Right Mana Trough (우측하단: 현재/최대 마나 + 10 사파이어 마나 수정 + 소모 미리보기) */}
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
              {(() => {
                const spendCount =
                  isPlayerTurn &&
                  hoveredHandCost !== null &&
                  hoveredHandCost <= matchState.player.mana
                    ? hoveredHandCost
                    : 0;
                const spendStartIdx = Math.max(0, matchState.player.mana - spendCount);

                return Array.from({ length: 10 }).map((_, idx) => {
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
                      title={
                        isOverloadedNow
                          ? tr('과부하로 잠긴 마나 수정', 'Overloaded Mana Crystal')
                          : isSpendingPreview
                            ? tr('사용 시 소모될 마나 수정', 'Mana to Spend')
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
                          : isSpendingPreview
                            ? 'animate-pulse bg-gradient-to-b from-white via-cyan-300 to-sky-400 shadow-[0_0_12px_#67e8f9] brightness-125'
                            : isFilled
                              ? 'bg-gradient-to-b from-sky-200 via-blue-500 to-indigo-900 shadow-[0_0_8px_#38bdf8]'
                              : isUnlocked
                                ? 'bg-sky-950/88 opacity-75'
                                : 'bg-stone-800/45 opacity-45'
                      }`}
                    />
                  );
                });
              })()}
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
          className="fixed inset-0 z-[105] flex items-center justify-center bg-black/88 p-4 sm:hidden"
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
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          <img
                            src={resolveHistoryIconUrl(item)}
                            alt={item.title}
                            className={`h-full w-full rounded-lg border-2 object-cover object-top ${
                              item.actorSide === 'PLAYER' ? 'border-sky-400' : 'border-red-500'
                            }`}
                          />
                          {item.kind === 'MILL_BURN' && (
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-orange-950/55 text-xs">
                              🔥
                            </span>
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-extrabold text-yellow-300">
                          {isKo
                            ? `${item.turn}턴 · ${item.actorSide === 'PLAYER' ? '아군' : '상대'} · ${item.isHiddenSecret ? '비밀 시전' : item.title}`
                            : `T${item.turn} · ${item.actorSide === 'PLAYER' ? 'Ally' : 'Enemy'} · ${item.isHiddenSecret ? 'Secret Cast' : item.title}`}
                        </div>
                        <div className="truncate text-xs font-bold text-amber-100/90">
                          {item.isHiddenSecret
                            ? tr('발동될 때까지 비공개', 'Hidden until triggered')
                            : item.detail}
                        </div>
                      </div>
                      {canZoomItem && (
                        <span className="shrink-0 text-[10.5px] font-extrabold text-amber-300">
                          {tr('확대 ›', 'Zoom ›')}
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

      {/* Sculpted Winged Heraldic Turn Change Banner ("나의 턴" / "상대 턴") */}
      {matchState.bannerMessage && !vsIntroActive && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[82] flex -translate-x-1/2 -translate-y-1/2 items-center animate-[hsCardPop_0.3s_ease-out]">
          {(() => {
            const isEnemyBanner =
              matchState.bannerMessage.includes('상대') ||
              matchState.bannerMessage.toUpperCase().includes('ENEMY') ||
              matchState.bannerMessage.toUpperCase().includes('OPPONENT');
            const bannerText =
              matchState.bannerMessage === '내 턴!'
                ? tr('나의 턴', 'YOUR TURN')
                : matchState.bannerMessage;
            return (
              <div
                className={`relative flex min-w-[230px] items-center justify-center rounded-2xl border-[3px] border-[#e8c675] px-9 py-3 shadow-[0_18px_36px_rgba(0,0,0,0.92),0_0_24px_rgba(250,204,21,0.45)] sm:min-w-[330px] sm:px-14 sm:py-4 ${
                  isEnemyBanner
                    ? 'bg-gradient-to-b from-red-900 via-rose-950 to-stone-950'
                    : 'bg-gradient-to-b from-blue-800 via-indigo-950 to-stone-950'
                }`}
              >
                <span className="pointer-events-none absolute -left-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 rotate-45 items-center justify-center border-2 border-[#f3d98b] bg-gradient-to-br from-amber-300 to-amber-800 shadow-lg" />
                <span className="pointer-events-none absolute -right-3.5 top-1/2 flex h-7 w-7 -translate-y-1/2 rotate-45 items-center justify-center border-2 border-[#f3d98b] bg-gradient-to-br from-amber-300 to-amber-800 shadow-lg" />
                <div className="hs-title hs-outline relative z-10 text-2xl font-extrabold tracking-widest text-amber-100 sm:text-4xl">
                  {bannerText}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Episode 0 Tutorial: Side-Flanking Upper-Body Kadan (Left) & Scarecrow Robot (Right), zero center hero overlap */}
      {isEp0Tutorial &&
        ep0Dialogue &&
        storyPhase === 'CLOSED' &&
        !vsIntroActive &&
        matchState.phase === 'PLAYING' && (
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
                  src="/hs-assets/bosses/kadan_upper.webp?v=hd20"
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
                  src="/hs-assets/bosses/scarecrow_robot.webp?v=hd20"
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
          const rawPDispName =
            matchState.player.customHero
              ? isKo
                ? matchState.player.customHero.heroNameKo || matchState.player.customHero.nameKo
                : matchState.player.customHero.heroNameEn || matchState.player.name
              : pHeroInfo.name;
          const rawODispName =
            matchState.opponent.customHero
              ? isKo
                ? matchState.opponent.customHero.heroNameKo || matchState.opponent.customHero.nameKo
                : matchState.opponent.customHero.heroNameEn || matchState.opponent.name
              : isKo
                ? matchState.opponent.heroNameKo || oHeroInfo.name
                : oHeroInfo.name;
          const pDispName = extractShortHeroCalloutName(
            rawPDispName,
            matchState.player.heroClass,
            isKo,
          );
          const oDispName = extractShortHeroCalloutName(
            rawODispName,
            matchState.opponent.heroClass,
            isKo,
          );

          return (
            <div
              data-testid="vs-intro-overlay"
              className="absolute inset-0 z-[92] flex flex-col items-center justify-center bg-black/88 px-3"
            >
              {/* Story Mode: Episode - Title Header Directly Above VS Matchup! */}
              {mode === 'TUTORIAL' && matchState.journeyMeta && (
                <div
                  data-testid="vs-episode-title-banner"
                  className="mb-4 flex flex-col items-center text-center sm:mb-7"
                >
                  <span className="rounded-full border border-amber-400/50 bg-amber-950/70 px-3.5 py-0.5 text-[10.5px] font-extrabold tracking-wider text-amber-200 sm:text-xs">
                    {matchState.journeyMeta.reincarnation > 0
                      ? isKo
                        ? `환생 ${matchState.journeyMeta.reincarnation}회차 · ${matchState.journeyMeta.actTitle}`
                        : `Reincarnation #${matchState.journeyMeta.reincarnation} · ${matchState.journeyMeta.actTitle}`
                      : matchState.journeyMeta.actTitle}
                  </span>
                  <h2 className="hs-title hs-outline mt-1.5 text-xl font-black tracking-wide text-amber-100 sm:text-4xl">
                    {matchState.journeyMeta.episode === 0
                      ? isKo
                        ? `에피소드 0 - ${getJourneyEpisodeDef(0, true).titleKo}`
                        : `Episode 0 - ${getJourneyEpisodeDef(0, false).titleKo}`
                      : isKo
                        ? `제${matchState.journeyMeta.episode}화 - ${getJourneyEpisodeDef(matchState.journeyMeta.episode, true).titleKo}`
                        : `Episode ${matchState.journeyMeta.episode} - ${getJourneyEpisodeDef(matchState.journeyMeta.episode, false).titleKo}`}
                  </h2>
                </div>
              )}

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

      {/* 1B. Story Mode Pre-Duel Alternating Upper-Body Character Dialogue (`캐릭터 대사 장면.mp4` Style, <= 6 Lines!) */}
      {mode === 'TUTORIAL' &&
        !vsIntroActive &&
        storyPhase === 'DIALOGUE' &&
        storyEncounter &&
        matchState.journeyMeta && (
          <StoryDuelDialogueOverlay
            encounter={storyEncounter}
            episodeTitle={
              getJourneyEpisodeDef(matchState.journeyMeta.episode, isKo).titleKo
            }
            autoPlayActive={autoPlay}
            onComplete={handleFinishStoryDialogue}
          />
        )}

      {/* 2. Mulligan (게임 시작화면 · 시작 손패 교체) Overlay — 1-Click Replace Stamp (✕) + Optional Card Zoom! */}
      {storyPhase === 'CLOSED' && !vsIntroActive && matchState.phase === 'MULLIGAN' && (
        <div
          data-testid="battle-game-start-screen"
          className="absolute inset-0 z-[88] flex flex-col items-center justify-center overflow-y-auto bg-black/88 p-3 text-center sm:p-4"
        >
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-stone-950/90 px-3.5 py-1 text-[11px] font-extrabold tracking-wider text-amber-300 shadow">
            <span>⚔ {tr('게임 시작화면', 'GAME START')}</span>
            {mode === 'TUTORIAL' && matchState.journeyMeta && (
              <span className="text-amber-100/85">
                ·{' '}
                {matchState.journeyMeta.episode === 0
                  ? tr('튜토리얼', 'Tutorial')
                  : isKo
                    ? `제${matchState.journeyMeta.episode}화`
                    : `EP ${matchState.journeyMeta.episode}`}
              </span>
            )}
          </div>
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
              : tr('교환할 카드를 클릭해 ✕ 표시한 뒤 [확인]을 누르세요 (하단 버튼/우클릭으로 확대 확인 가능).',
                  'Click cards to mark for replacement (✕), then press Confirm (use Zoom button or right-click to inspect).',
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
              const advice = getKadanMulliganAdvice(
                def,
                activeStance,
                getPlayerCardMult(def.id),
              );
              const isKeepAdvice = advice === 'KEEP';
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
                    data-testid={`mulligan-advice-${hc.uid}`}
                    data-mulligan-advice={advice}
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide shadow ${
                      isKeepAdvice
                        ? 'border-emerald-400/80 bg-emerald-950/90 text-emerald-200'
                        : 'border-amber-400/85 bg-amber-950/90 text-amber-200'
                    }`}
                  >
                    {isKeepAdvice
                      ? tr('유지 추천 (Keep)', 'Keep')
                      : tr('교체 권장 (Swap)', 'Swap')}
                  </div>
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
                    <HearthstoneCard
                      card={def}
                      journeyMultiplier={getPlayerCardMult(def.id)}
                      size={isCompactMobile ? 'XS' : 'MD'}
                    />
                    {marked && (
                      <div className="pointer-events-none absolute inset-x-2 inset-y-2.5 z-40 flex flex-col items-center justify-center rounded-2xl border-2 border-red-400/75 bg-red-950/84 animate-[hsMulliganCrossPop_0.22s_ease-out]">
                        <span className="hs-outline text-4xl font-black text-red-400 sm:text-6xl">
                          ✕
                        </span>
                        <span className="mt-0.5 rounded-md border border-red-300/60 bg-red-900 px-2 py-0.5 text-[10px] font-extrabold text-white sm:text-xs">
                          {tr('교체 예정', 'Replacing')}
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
                    {tr('카드 확대', 'Zoom')}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              data-testid="mulligan-confirm-btn"
              disabled={mulliganSwapping || pvpWaitingOpponentMulligan}
              onClick={confirmMulliganNow}
              className="hs-arcane-btn hs-title hs-outline-sm rounded-2xl px-9 py-2.5 text-lg font-extrabold tracking-wider text-white disabled:opacity-75 sm:px-11 sm:py-3 sm:text-xl"
            >
              {pvpWaitingOpponentMulligan
                ? tr('상대 모험가 카드 교체 대기 중...', 'Waiting for Opponent Mulligan...')
                : mulliganSwapping
                  ? tr('교체 중...', 'Replacing...')
                  : tr('게임 시작 (전투 개시)', 'Start Game (Confirm)')}
            </button>
            <button
              type="button"
              data-testid="mulligan-apply-kadan-btn"
              disabled={mulliganSwapping}
              onClick={() => {
                if (mulliganSwapping) return;
                hsAudio.playSfx('ui_click', 0.85);
                const recommendedSwaps = matchState.player.hand
                  .filter((hc) => {
                    const def = cardDb.mustGetCard(hc.cardId);
                    return (
                      getKadanMulliganAdvice(def, activeStance, getPlayerCardMult(def.id)) ===
                      'SWAP'
                    );
                  })
                  .map((hc) => hc.uid);
                setMatchState((prev) => ({
                  ...prev,
                  mulliganSelectedUids: recommendedSwaps,
                }));
              }}
              className="flex min-h-[46px] items-center gap-1.5 rounded-2xl border-2 border-emerald-400/80 bg-emerald-950/90 px-4 py-2.5 text-xs font-extrabold text-emerald-100 shadow-xl transition hover:border-emerald-200 hover:bg-emerald-900 disabled:opacity-50 sm:text-sm"
            >
              <span>🪄</span>
              <span>{tr('카단 추천대로 교체', 'Apply Kadan Swap')}</span>
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
            <button
              type="button"
              data-testid="open-pre-battle-deck-btn"
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.8);
                setPreBattleModalOpen(true);
              }}
              className="flex min-h-[46px] items-center gap-1.5 rounded-2xl border-2 border-amber-300/75 bg-stone-900/90 px-4 py-2.5 text-xs font-extrabold text-amber-100 shadow-xl transition hover:border-amber-200 hover:bg-stone-800 sm:text-sm"
            >
              <span>⚔</span>
              <span>{tr('출격 덱·전술 프리셋', 'Preset Deck & Tactic')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. Choose One (선택) Modal — 1-Click Direct Selection + Inspect Pill! */}
      {matchState.chooseOnePrompt && (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-black/88 p-3 text-center sm:p-4">
          <h3 className="hs-title hs-outline mb-1 text-xl font-extrabold text-amber-200 sm:text-2xl">
            {tr('운명의 선택 — 사용할 효과를 클릭하세요', 'Choose One — Tap an effect to play immediately')}
          </h3>
          <p className="mb-3 text-[11px] font-bold text-amber-200/80 sm:mb-4 sm:text-xs">
            {tr('카드 클릭 시 즉시 발동 · 우클릭 또는 [카드 확대] 버튼으로 상세 보기', 'Click a card to cast immediately · Right-click or tap [Zoom] to inspect')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            {matchState.chooseOnePrompt.options.map((opt) => {
              const prompt = matchState.chooseOnePrompt!;
              const optCard = cardDb.mustGetCard(opt.optionCardId);
              return (
                <div
                  key={opt.index}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hsAudio.playSfx('card_hover', 0.7);
                    setZoomState({ kind: 'CHOOSE_ONE_CARD', optionIndex: opt.index });
                  }}
                  className="hs-wood-panel flex max-w-[166px] flex-col items-center rounded-2xl p-2.5 transition hover:border-emerald-300 sm:max-w-none sm:p-4"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setZoomState(null);
                      if (opt.needsTarget && opt.validTargets.length > 0) {
                        hsAudio.playSfx('ui_click', 0.8);
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
                    className="flex flex-col items-center transition hover:scale-105"
                  >
                    <HearthstoneCard
                      card={optCard}
                      playableGlow="GREEN"
                      size={isCompactMobile ? 'XS' : 'MD'}
                    />
                    <div className="hs-title mt-1.5 text-xs font-extrabold text-amber-200 sm:mt-2 sm:text-sm">
                      {opt.title}
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold text-amber-100/85 sm:text-xs">
                      {opt.description}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hsAudio.playSfx('card_hover', 0.7);
                      setZoomState({ kind: 'CHOOSE_ONE_CARD', optionIndex: opt.index });
                    }}
                    className="hs-brass-btn mt-2 rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold text-amber-100 sm:text-[11px]"
                  >
                    🔍 {tr('카드 확대', 'Zoom')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Tracking (정찰 추적) 3-Card Picker Modal — 1-Click Direct Draw + Inspect Pill! */}
      {matchState.trackingPrompt && (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center overflow-y-auto bg-black/88 p-3 text-center sm:p-4">
          <h3 className="hs-title hs-outline mb-1 text-xl font-extrabold text-emerald-300 sm:text-2xl">
            {tr('정찰 추적 — 손으로 가져올 카드 1장을 클릭하세요', 'Tracking — Tap 1 card to draw immediately')}
          </h3>
          <p className="mb-4 text-xs font-bold text-amber-200/85 sm:mb-5">
            {tr('선택하지 않은 나머지 2장은 버려집니다. (우클릭 또는 [카드 확대]로 상세 확인)', 'The other 2 cards will be discarded. (Right-click or tap [Zoom] to inspect)')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-5">
            {matchState.trackingPrompt.cards.map((cid, idx) => (
              <div
                key={`${cid}_${idx}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  hsAudio.playSfx('card_hover', 0.7);
                  setZoomState({ kind: 'TRACKING_CARD', cardId: cid, index: idx });
                }}
                className="flex flex-col items-center gap-1.5"
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomState(null);
                    hsAudio.playSfx('card_place', 0.9);
                    commitResolveTracking(cid);
                  }}
                  className="cursor-pointer transition hover:scale-108"
                >
                  <HearthstoneCard
                    card={cardDb.mustGetCard(cid)}
                    playableGlow="GREEN"
                    size={isCompactMobile ? 'XS' : 'MD'}
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hsAudio.playSfx('card_hover', 0.7);
                    setZoomState({ kind: 'TRACKING_CARD', cardId: cid, index: idx });
                  }}
                  className="hs-brass-btn rounded-lg px-2.5 py-0.5 text-[10px] font-extrabold text-amber-100 sm:text-[11px]"
                >
                  🔍 {tr('카드 확대', 'Zoom')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5A. Story Mode Victory Scene: Item Acquisition Showcase (`아이템 획득 장면.mp4`) or Character Victory Ment! */}
      {mode === 'TUTORIAL' &&
        matchState.phase === 'GAME_OVER' &&
        matchState.winner === 'PLAYER' &&
        storyEncounter && (
          <StoryVictorySceneOverlay
            encounter={storyEncounter}
            outcomeSummary={outcomeSummary}
            autoPlayActive={autoPlay}
            onFinishEpisode={(act) => {
              postGameFiredRef.current = true;
              if (
                act === 'NEXT_EPISODE' &&
                onStartJourneyEpisode &&
                outcomeSummary?.nextEpisode
              ) {
                onStartJourneyEpisode(outcomeSummary.nextEpisode, false, autoPlay);
              } else {
                onExitBattle();
              }
            }}
          />
        )}

      {/* 5B. Victory / Defeat Heraldry Banner, 3s Auto-Advance & Defeat Pack Purchase -> 5-Card Open -> Auto-Retry Loop */}
      {matchState.phase === 'GAME_OVER' &&
        !(mode === 'TUTORIAL' && matchState.winner === 'PLAYER' && storyEncounter) && (
        <div className="absolute inset-0 z-[94] flex items-center justify-center overflow-y-auto bg-black/88 p-3 sm:p-4">
          {defeatPackResult ? (
            <div
              data-testid="defeat-pack-reinforcement-modal"
              className="hs-wood-panel relative flex max-h-[95%] w-full max-w-3xl flex-col items-center overflow-y-auto rounded-3xl p-4 text-center text-amber-100 shadow-2xl sm:p-6"
            >
              <button
                type="button"
                data-testid="defeat-pack-close-btn"
                onClick={() => {
                  drawRetryFiredRef.current = true;
                  hsAudio.playSfx('menu_select');
                  hsAudio.playBgm('tavern_hub');
                  onExitBattle();
                }}
                aria-label={tr('닫기 (로비로 이동)', 'Close (Return to Hub)')}
                className="hs-brass-btn absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-xl text-amber-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
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
                          · ⚡×{item.newJourneyMultiplier}{tr('배 각성!', ' Awakened!')}
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
                      ? ` (${Math.max(1, Math.ceil(drawRetryRemainingMs / 1000))}${tr('초', 's')})`
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
                {onOpenShopFromBattle && (
                  <button
                    type="button"
                    onClick={() => {
                      drawRetryFiredRef.current = true;
                      hsAudio.playSfx('ui_click');
                      onOpenShopFromBattle();
                    }}
                    className="hs-gold-btn w-full rounded-xl py-2 text-xs font-extrabold"
                  >
                    🎁 {tr('보급소 1팩($1)·5팩($4)으로 3배 각성 즉시 보강', 'Shop 1-Pack ($1) / 5-Pack ($4) Power Up')}
                  </button>
                )}
              </div>
            </div>
          ) : (() => {
            const didWin = matchState.winner === 'PLAYER';
            const mvp = didWin ? computeBattleMvpCard(matchState, playerDeck.cards) : null;
            const diag = !didWin ? diagnoseDefeatAndCounter(matchState, isKo) : null;

            return (
          <div
            data-testid="gameover-modal"
            className="hs-wood-panel relative flex max-h-[94%] w-full max-w-lg flex-col items-center overflow-y-auto rounded-3xl p-5 text-center text-amber-100 sm:p-6"
          >
            <button
              type="button"
              data-testid="gameover-close-btn"
              onClick={() => {
                postGameFiredRef.current = true;
                hsAudio.playSfx('menu_select');
                hsAudio.playBgm('tavern_hub');
                onExitBattle();
              }}
              aria-label={tr('닫기 (로비로 이동)', 'Close (Return to Hub)')}
              className="hs-brass-btn absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-xl text-amber-100"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

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
              <div className="relative z-20 mb-1 flex w-full justify-start">
                <button
                  type="button"
                  onClick={() => setPostGameAutoPaused((p) => !p)}
                  className={`min-h-[36px] rounded-lg border px-2.5 py-1 text-[11px] font-extrabold ${
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

            {postGameStep === 'SUMMARY' ? (
              <>
                {didWin && (
                  <div
                    style={{
                      animation: 'hsSlowSpin 24s linear infinite',
                      background:
                        'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.38) 40deg, transparent 80deg, rgba(56,189,248,0.3) 170deg, transparent 210deg, rgba(251,191,36,0.38) 300deg, transparent 360deg)',
                    }}
                    className="pointer-events-none absolute -top-16 h-80 w-80 rounded-full blur-md"
                  />
                )}

                <div className={`relative z-10 ${didWin ? '' : 'grayscale opacity-75'}`}>
                  <SnsRankMedallion
                    rank={didWin ? 0 : profile.rank}
                    size={72}
                    className="drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
                  />
                </div>

                <h2
                  className={`hs-title hs-outline relative z-10 mt-1.5 text-2xl font-extrabold sm:text-4xl ${
                    didWin ? 'text-yellow-300' : 'text-slate-200'
                  }`}
                >
                  {didWin
                    ? mode === 'TUTORIAL' && matchState.journeyMeta
                      ? matchState.journeyMeta.episode === 0
                        ? tr('에피소드 0 완승!', 'Episode 0 Cleared!')
                        : tr(`제${matchState.journeyMeta.episode}화 승리!`, `Episode ${matchState.journeyMeta.episode} Victory!`)
                      : tr('승리!', 'Victory!')
                    : mode === 'TUTORIAL' && matchState.journeyMeta
                      ? tr(`제${matchState.journeyMeta.episode}화 패배`, `Episode ${matchState.journeyMeta.episode} Defeat`)
                      : tr('패배', 'Defeat')}
                </h2>
                {pvpOpponentLeftNotice && didWin && (
                  <div
                    data-testid="pvp-opponent-left-victory-badge"
                    className="relative z-10 mt-1.5 rounded-full border border-emerald-300/80 bg-emerald-950/90 px-3.5 py-1 text-xs font-extrabold text-emerald-100 shadow-lg"
                  >
                    {pvpOpponentLeftNotice}
                  </div>
                )}
                {(() => {
                  const resGrade = gradeRhythmPerformance(
                    Math.round(rhythmFeverPct / 12),
                    Math.max(1, matchState.turnNumber),
                  );
                  return (
                    <div
                      data-testid="battle-rhythm-grade-bar"
                      className="relative z-10 mt-1.5 flex flex-wrap items-center justify-center gap-2"
                    >
                      <span className="rounded-full border border-sky-400/50 bg-sky-950/75 px-3 py-0.5 text-[11px] font-extrabold text-sky-200">
                        🎵 {isKo ? resGrade.summaryKo : resGrade.summaryEn}
                      </span>
                      {mode === 'TUTORIAL' &&
                        matchState.journeyMeta &&
                        matchState.journeyMeta.episode >= 1 && (
                          <a
                            href={`/book.html?ep=${matchState.journeyMeta.episode}&lang=${lang}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid="battle-result-novel-link"
                            className="rounded-full border border-amber-400/55 bg-amber-950/75 px-3 py-0.5 text-[11px] font-extrabold text-amber-200 hover:bg-amber-900/80"
                          >
                            {tr(
                              `📜 제${matchState.journeyMeta.episode}화 원작 웹소설 읽기`,
                              `📜 Read EP.${matchState.journeyMeta.episode} Original Novel`,
                            )}
                          </a>
                        )}
                    </div>
                  );
                })()}

                <p className="relative z-10 mt-1 text-xs font-bold text-amber-200/90">
                  {didWin
                    ? isEp0Tutorial
                      ? tr('튜토리얼 수료 완료! 제1화 여정이 시작됩니다.', 'Tutorial complete! Episode 1 is ready.')
                      : tr(`${matchState.opponent.name} 제압 완료`, `Defeated ${matchState.opponent.name}`)
                    : tr('전열을 가다듬고 다시 도전해 보세요.', 'Regroup and challenge again.')}
                </p>

                {/* Minimal Key Summary Box */}
                <div className="hs-ocarina-dialog relative z-10 my-4 w-full space-y-2 rounded-2xl p-3.5 text-left text-xs sm:p-4">
                  {didWin && outcomeSummary ? (
                    <>
                      <div className="flex items-center justify-between text-sm font-extrabold">
                        <span className="text-amber-100">{tr('총 획득 골드', 'Gold Earned')}</span>
                        <span className="flex items-center gap-1 text-yellow-300">
                          <HsGoldCoinIcon size={18} />
                          <span>+{outcomeSummary.goldEarned}G</span>
                        </span>
                      </div>
                      {outcomeSummary.packsEarned > 0 && (
                        <div className="flex items-center justify-between font-extrabold text-emerald-200">
                          <span>🎁 {tr('특전 카드팩', 'Bonus Card Pack')}</span>
                          <span>+{outcomeSummary.packsEarned} {tr('팩', 'Pack(s)')}</span>
                        </div>
                      )}
                      {outcomeSummary.reincarnatedNow && (
                        <div className="rounded-lg border border-purple-300/60 bg-purple-950/75 px-2.5 py-1.5 text-center font-extrabold text-purple-200">
                          {tr(`✦ [환생 ${outcomeSummary.nextReincarnation}회차] 개방!`, `✦ Reincarnation ${outcomeSummary.nextReincarnation} Unlocked!`)}
                        </div>
                      )}
                      {mode === 'RANKED' && (
                        <div className="flex items-center justify-between text-[11px] font-bold text-sky-200">
                          <span>{tr('현재 등급', 'Current Rank')}</span>
                          <span>
                            {outcomeSummary.newRank === 0
                              ? tr('전설의 눈히어로', 'Legend SNSHero')
                              : isKo
                                ? `${outcomeSummary.newRank}등급 · ★${outcomeSummary.newStars}`
                                : `Rank ${outcomeSummary.newRank} · ★${outcomeSummary.newStars}`}
                          </span>
                        </div>
                      )}
                      {rhythmFeverBonusGold > 0 && (
                        <div className="flex items-center justify-between text-[11px] font-extrabold text-amber-200">
                          <span>🎵 {tr('오카리나 리듬 피버 보너스', 'Ocarina Rhythm Fever Bonus')}</span>
                          <span className="text-yellow-300">+{rhythmFeverBonusGold}G</span>
                        </div>
                      )}
                      {(mode === 'RANKED' || mode === 'BOGART_GAMBLE') && (
                        <div
                          data-testid="gameover-prestige-unlock-gauge"
                          className="mt-1.5 rounded-xl border border-yellow-300/45 bg-black/50 px-2.5 py-2"
                        >
                          {(() => {
                            const nextTarget =
                              liveProfile.gold < 300
                                ? { cost: 300, ko: '신비한 가루 보석함(300G)', en: 'Arcane Dust Chest (300G)' }
                                : liveProfile.gold < 450
                                  ? { cost: 450, ko: '3배 각성 5팩 상자(450G)', en: '5-Pack Awakening Chest (450G)' }
                                  : liveProfile.gold < 1000
                                    ? { cost: 1000, ko: '24K 전설 영웅 확정 상자(1,000G)', en: '24K Legendary Chest (1,000G)' }
                                    : { cost: 2200, ko: '왕실 황금 대금고(2,200G)', en: 'Royal Grand Vault (2,200G)' };
                            const pct = Math.min(100, Math.round((liveProfile.gold / nextTarget.cost) * 100));
                            return (
                              <>
                                <div className="flex items-center justify-between text-[10.5px] font-extrabold text-yellow-200">
                                  <span>
                                    🪙 {tr(`다음 치장 해금: ${nextTarget.ko}`, `Next Prestige: ${nextTarget.en}`)}
                                  </span>
                                  <span>{pct}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-900">
                                  <div
                                    style={{ width: `${pct}%` }}
                                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
                                  />
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  ) : diag ? (
                    <div className="flex items-center gap-2.5">
                      <img
                        src="/hs-assets/bosses/kadan_upper.webp?v=hd20"
                        alt="Kadan"
                        className="h-10 w-10 shrink-0 rounded-xl border border-sky-300 object-cover object-top"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[10.5px] font-black text-sky-300">
                          🧭 {tr('카단의 핵심 패인', "Kadan's Key Tip")}
                        </div>
                        <p className="mt-0.5 text-xs font-bold leading-snug text-amber-50">
                          {diag.reasonText}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* MKT-067(3): Bogart's Hall 1-Click Jackpot / Bailout Receipt Copy */}
                {mode === 'BOGART_GAMBLE' && (
                  <button
                    type="button"
                    data-testid="bogart-share-receipt-btn"
                    onClick={async () => {
                      const stake = bogartStakeGold || 100;
                      const receiptText = isKo
                        ? `🎲 [눈히어로 보가트의 도박장 영수증] 100% 랜덤 30장 덱 ${stake}G 베팅 → ${didWin ? `+${stake * 2}G 잭팟 승리!` : `-${stake}G 파산...`} | 무설치 3초 도전: https://snshero.com/game?mode=bogart&stake=${stake}`
                        : `🎲 [SNSHero Bogart's Hall Receipt] 100% Random 30-Card Deck ${stake}G Bet → ${didWin ? `+${stake * 2}G Jackpot!` : `-${stake}G Bust...`} | Play Free: https://snshero.com/game?mode=bogart&stake=${stake}`;
                      try {
                        await navigator.clipboard.writeText(receiptText);
                      } catch {
                        // ignore clipboard fallback
                      }
                      hsAudio.playSfx('mario_coin', 0.85);
                      setChallengeCopiedMsg(
                        tr('✓ 보가트 도박장 영수증이 클립보드에 복사되었습니다!', '✓ Bogart Hall receipt copied to clipboard!'),
                      );
                      window.setTimeout(() => setChallengeCopiedMsg(null), 2800);
                    }}
                    className="hs-zelda-c-btn relative z-10 mb-2.5 flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black text-stone-950 shadow"
                  >
                    <span>🎲</span>
                    <span>
                      {didWin
                        ? tr('잭팟 영수증 1클릭 복사 · 공유', 'Copy 1-Click Jackpot Receipt')
                        : tr('도박장 결과 영수증 1클릭 복사', 'Copy Bogart Match Receipt')}
                    </span>
                  </button>
                )}

                {/* MKT-072(2,3): Ranked Arena Opponent MVP Card & Prestige Skin Acquire + 1st Win Backup */}
                {mode === 'RANKED' && (
                  <div
                    data-testid="ranked-mvp-acquire-strip"
                    className="relative z-10 mb-2.5 w-full space-y-1.5 rounded-2xl border border-amber-400/50 bg-stone-950/90 p-3 text-left text-[11px]"
                  >
                    {(() => {
                      const oppPlayedIds = matchState.history
                        .filter((h) => h.actorSide === 'OPPONENT' && h.cardId)
                        .map((h) => h.cardId!);
                      const oppMvpDef =
                        oppPlayedIds
                          .map((cid) => cardDb.getCard(cid))
                          .filter((c): c is NonNullable<typeof c> => Boolean(c))
                          .sort((a, b) => b.cost - a.cost)[0] || cardDb.getCard('EX1_350');
                      const skinName = isKo
                        ? resolvedChallenger?.cardBackNameKo || '엘윈 성소의 문장(800G)'
                        : resolvedChallenger?.cardBackNameEn || 'Elwin Sanctuary Crest (800G)';
                      return (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-amber-200">
                              ⚔ {tr('상대 핵심 카드', 'Opponent MVP')}:{' '}
                              <span className="text-yellow-300">
                                {oppMvpDef ? getCardName(oppMvpDef, lang) : 'Arch-Templar'}
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold text-sky-200/85">
                              🎨 {tr('상대 장착 스킨', 'Equipped Skin')}: {skinName}
                            </div>
                          </div>
                          {onOpenShopFromBattle && (
                            <button
                              type="button"
                              onClick={() => {
                                postGameFiredRef.current = true;
                                hsAudio.playSfx('ui_click');
                                onOpenShopFromBattle();
                              }}
                              className="hs-gold-btn shrink-0 rounded-xl px-2.5 py-1.5 text-[10.5px] font-black"
                            >
                              🎁 {tr('팩($1·$4)·스킨 입수', 'Get Pack / Skin')}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {challengeCopiedMsg && (
                  <div className="relative z-10 mb-2 w-full rounded-xl border border-yellow-300 bg-amber-950/95 px-3 py-1.5 text-center text-xs font-extrabold text-yellow-200">
                    {challengeCopiedMsg}
                  </div>
                )}

                {/* Minimal First-Screen Actions (Max 2 Buttons) */}
                <div className="relative z-10 flex w-full flex-col gap-2.5">
                  {mode === 'TUTORIAL' ? (
                    didWin && onStartJourneyEpisode && outcomeSummary?.nextEpisode ? (
                      <button
                        type="button"
                        data-testid="gameover-primary-btn"
                        onClick={() => {
                          postGameFiredRef.current = true;
                          hsAudio.playSfx('box_press');
                          onStartJourneyEpisode(outcomeSummary.nextEpisode!, false);
                        }}
                        className="hs-arcane-btn hs-title hs-outline-sm hs-mario-spring min-h-[50px] w-full rounded-2xl px-4 py-3 text-base font-extrabold text-white sm:text-lg"
                      >
                        {isEp0Tutorial
                          ? tr(`⚔ 제${outcomeSummary.nextEpisode}화 시작`, `⚔ Start Episode ${outcomeSummary.nextEpisode}`)
                          : tr(`⚔ 다음 여정 (제${outcomeSummary.nextEpisode}화)`, `⚔ Next Episode (EP ${outcomeSummary.nextEpisode})`)}
                        {autoPlay && !postGameAutoPaused
                          ? ` · ${Math.max(1, Math.ceil(postGameRemainingMs / 1000))}${tr('초', 's')}`
                          : ' ▶'}
                      </button>
                    ) : !didWin ? (
                      <button
                        type="button"
                        data-testid="gameover-primary-btn"
                        onClick={() => {
                          postGameFiredRef.current = true;
                          triggerDefeatPackReinforcement();
                        }}
                        className="hs-arcane-btn hs-title hs-outline-sm hs-mario-spring flex min-h-[50px] w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold text-white sm:text-base"
                      >
                        {tr('🎁 카드팩 1개 개봉해 전력 강화', '🎁 Open 1 Pack to Power Up')}
                        {autoPlay && !postGameAutoPaused
                          ? ` (${Math.max(1, Math.ceil(postGameRemainingMs / 1000))}${tr('초', 's')})`
                          : ' ▶'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-testid="gameover-primary-btn"
                        onClick={() => {
                          postGameFiredRef.current = true;
                          hsAudio.playSfx('menu_select');
                          hsAudio.playBgm('tavern_hub');
                          onExitBattle();
                        }}
                        className="hs-arcane-btn hs-title hs-outline-sm hs-mario-spring min-h-[50px] w-full rounded-2xl px-4 py-3 text-base font-extrabold text-white"
                      >
                        {tr('엘윈마을 로비로 돌아가기', 'Return to Elwin Village')}
                      </button>
                    )
                  ) : onRematchSameMode ? (
                    <button
                      type="button"
                      data-testid="gameover-rematch-btn"
                      onClick={() => {
                        postGameFiredRef.current = true;
                        hsAudio.playSfx('box_press');
                        onRematchSameMode();
                      }}
                      className="hs-arcane-btn hs-title hs-outline-sm hs-mario-spring min-h-[50px] w-full rounded-2xl px-4 py-3 text-base font-extrabold text-white sm:text-lg"
                    >
                      {tr('⚔ 같은 덱으로 다시 도전', '⚔ Play Again (Same Deck)')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-testid="gameover-primary-btn"
                      onClick={() => {
                        postGameFiredRef.current = true;
                        hsAudio.playSfx('menu_select');
                        hsAudio.playBgm('tavern_hub');
                        onExitBattle();
                      }}
                      className="hs-arcane-btn hs-title hs-outline-sm hs-mario-spring min-h-[50px] w-full rounded-2xl px-4 py-3 text-base font-extrabold text-white"
                    >
                      {tr('엘윈마을로 돌아가기', 'Return to Elwin Village')}
                    </button>
                  )}

                  {onOpenShopFromBattle && (
                    <div
                      data-testid="gameover-blueprint-prestige-strip"
                      className="rounded-xl border border-amber-400/40 bg-black/45 px-3 py-2 text-left text-[11px] font-bold text-amber-100"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-amber-300">
                          ⚡ {tr('3배 각성 설계도 & 4대 골드 외형', '3x Awakening Blueprint & Gold Prestige')}
                        </span>
                        <span className="text-[10px] text-sky-200">
                          {tr(
                            `보유 ${profile.dust}가루 · ${profile.gold.toLocaleString()}G`,
                            `Owned ${profile.dust} Dust · ${profile.gold.toLocaleString()}G`,
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-1.5 text-[10.5px] text-stone-200/90">
                        <span>
                          {tr(
                            '2/3장 핵심 카드 제작·5팩 천장 · 배지(300G)/칭호(400G)/테두리(500G)/뒷면(800G)',
                            'Craft 2/3-copy upgrades · 5-Pack Pity · Badge(300G)/Title(400G)/Frame(500G)/Back(800G)',
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            hsAudio.playSfx('gem_a_confirm');
                            setPostGameAutoPaused(true);
                            onOpenShopFromBattle();
                          }}
                          className="hs-zelda-c-btn min-h-[32px] shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black text-stone-950"
                        >
                          🎁 {tr('보급소 · 외형 상점', 'Packs & Prestige')}
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    data-testid="gameover-next-step-btn"
                    onClick={() => {
                      hsAudio.playSfx('ui_click');
                      setPostGameAutoPaused(true);
                      setPostGameStep('NEXT_ACTIONS');
                    }}
                    className="hs-brass-btn hs-mario-spring flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-extrabold text-amber-100 sm:text-sm"
                  >
                    <span>
                      {didWin
                        ? tr('다음 메뉴 · 공유 / 인증 / 로비 →', 'More Options · Share / Card / Hub →')
                        : tr('다음 메뉴 · 역상성 추천 / 상점 / 로비 →', 'More Options · Counter / Shop / Hub →')}
                    </span>
                  </button>
                </div>
              </>
            ) : (
              /* Step 2: Secondary Branch Options Popup */
              <div data-testid="gameover-next-popup" className="relative z-10 w-full space-y-3 text-left">
                <div className="flex items-center justify-between gap-2 pr-10">
                  <button
                    type="button"
                    data-testid="gameover-back-summary-btn"
                    onClick={() => {
                      hsAudio.playSfx('ui_click', 0.7);
                      setPostGameStep('SUMMARY');
                    }}
                    className="hs-brass-btn flex min-h-[40px] items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100"
                  >
                    <span>←</span>
                    <span>{tr('결과 요약', 'Summary')}</span>
                  </button>
                  <h3 className="hs-title text-base font-extrabold text-amber-200 sm:text-lg">
                    {tr('다음 행동 선택', 'Next Options')}
                  </h3>
                </div>

                {didWin ? (
                  <div className="space-y-2.5">
                    {mvp && (
                      <div
                        data-testid="victory-mvp-card"
                        className="hs-ocarina-dialog flex items-center justify-between gap-2.5 rounded-2xl p-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <img
                            src={getCardArtUrl(mvp.card)}
                            alt={getCardName(mvp.card, lang)}
                            className="h-12 w-12 shrink-0 rounded-xl border-2 border-yellow-300 object-cover object-top shadow"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-yellow-400 px-1.5 py-0.5 text-[9.5px] font-black text-stone-950">
                                🏆 BATTLE MVP
                              </span>
                              {mvp.mult >= 3 && (
                                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9.5px] font-black text-white">
                                  ⚡ ×{mvp.mult} {tr('각성', 'Awake')}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-xs font-black text-white sm:text-sm">
                              {getCardName(mvp.card, lang)}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid="victory-share-challenge-btn"
                          onClick={async () => {
                            const code = encodeDeckShareCode(playerDeck);
                            const url = `${window.location.origin}/game?challenge=${encodeURIComponent(code)}&tactic=${activeStance.toLowerCase()}`;
                            try {
                              await navigator.clipboard.writeText(url);
                            } catch {
                              // ignore clipboard fallback
                            }
                            hsAudio.playSfx('mario_coin');
                            setChallengeCopiedMsg(
                              tr('✓ 덱·전술 챌린지 URL이 복사되었습니다!', '✓ Deck & Tactic Challenge URL copied!'),
                            );
                            window.setTimeout(() => setChallengeCopiedMsg(null), 2800);
                          }}
                          className="hs-zelda-c-btn min-h-[44px] shrink-0 rounded-xl px-3 py-2 text-xs font-extrabold"
                        >
                          🔗 {tr('챌린지 공유', 'Share Deck')}
                        </button>
                      </div>
                    )}

                    {challengeCopiedMsg && (
                      <div className="rounded-xl border border-yellow-300 bg-amber-950/95 px-3 py-1.5 text-center text-xs font-extrabold text-yellow-200">
                        {challengeCopiedMsg}
                      </div>
                    )}

                    <button
                      type="button"
                      data-testid="victory-certificate-btn"
                      onClick={() => {
                        hsAudio.playSfx('ui_click');
                        downloadVictoryCertificatePng({
                          isKo,
                          playerName: matchState.player.heroNameKo,
                          heroClass: matchState.player.heroClass,
                          opponentName: matchState.opponent.heroNameKo,
                          turnCount: matchState.turnNumber,
                          episode: matchState.journeyMeta?.episode,
                          goldEarned: outcomeSummary?.goldDelta || 0,
                        });
                      }}
                      className="hs-zelda-c-btn flex min-h-[46px] w-full items-center justify-center rounded-xl px-4 text-xs font-extrabold sm:text-sm"
                    >
                      📸 {tr('1초 전적 인증 카드 이미지 저장 & 공유', 'Save & Share 1-Click Victory Card')}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {diag && onRematchWithPreset && (
                      <button
                        type="button"
                        data-testid="defeat-counter-rematch-btn"
                        onClick={() => {
                          postGameFiredRef.current = true;
                          hsAudio.playSfx('mario_spring');
                          onRematchWithPreset(diag.presetId, diag.stance);
                        }}
                        className="hs-zelda-b-btn flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-2xl px-4 py-2.5 text-xs font-extrabold sm:text-sm"
                      >
                        <span>⚡</span>
                        <span>
                          {isKo
                            ? `카단 추천 [${diag.presetLabel} + ${diag.stanceLabel}] 재도전`
                            : `Counter Retry [${diag.presetLabel} + ${diag.stanceLabel}]`}
                        </span>
                      </button>
                    )}

                    {mode === 'TUTORIAL' && (
                      <button
                        type="button"
                        data-testid="defeat-buy-open-pack-btn"
                        onClick={() => {
                          postGameFiredRef.current = true;
                          triggerDefeatPackReinforcement();
                        }}
                        className="hs-zelda-a-btn flex min-h-[46px] w-full items-center justify-center rounded-xl px-4 text-xs font-extrabold sm:text-sm"
                      >
                        {profile.gold >= 100
                          ? tr('🪙 골드(-100G)로 팩 1개 개봉 후 재도전', '🪙 Open 1 Pack (-100G) & Retry')
                          : profile.packs > 0
                            ? tr(`🎁 보유 팩(${profile.packs}) 1개 개봉 후 재도전`, `🎁 Open 1 Owned Pack (${profile.packs}) & Retry`)
                            : tr('🎁 성소 지원팩 1개 개봉 후 재도전', '🎁 Open Free Aid Pack & Retry')}
                      </button>
                    )}

                    {onOpenShopFromBattle && (
                      <button
                        type="button"
                        onClick={() => {
                          postGameFiredRef.current = true;
                          hsAudio.playSfx('ui_click');
                          onOpenShopFromBattle();
                        }}
                        className="hs-zelda-c-btn flex min-h-[46px] w-full items-center justify-center rounded-xl px-4 text-xs font-extrabold sm:text-sm"
                      >
                        🎁 {tr('보급소 상점 이동 (1팩/5팩 각성 보강)', 'Open Shop (1-Pack / 5-Pack Upgrade)')}
                      </button>
                    )}

                    {mode === 'TUTORIAL' && onStartJourneyEpisode && (
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
                        className="hs-brass-btn flex min-h-[46px] w-full items-center justify-center rounded-xl px-4 text-xs font-extrabold text-amber-100 sm:text-sm"
                      >
                        {tr('⚔ 팩 개봉 없이 바로 재도전', '⚔ Retry Without Pack')}
                      </button>
                    )}
                  </div>
                )}

                {/* DEV-042(2): On-Demand Battle Log Disclosure (Hidden by default in Single-Focus summary) */}
                {matchState.history.length > 0 && (
                  <div className="rounded-xl border border-amber-400/35 bg-stone-950/85 p-2.5">
                    <button
                      type="button"
                      data-testid="gameover-battle-log-toggle"
                      onClick={() => {
                        hsAudio.playSfx('ui_click', 0.65);
                        setBattleLogExpanded((v) => !v);
                      }}
                      className="flex w-full items-center justify-between text-xs font-extrabold text-amber-200"
                    >
                      <span>📜 {tr('상세 전투 기록 보기', 'View Detailed Combat Log')}</span>
                      <span>{battleLogExpanded ? '▲' : `▼ (${matchState.history.length})`}</span>
                    </button>
                    {battleLogExpanded && (
                      <div className="mt-2 max-h-32 space-y-1 overflow-y-auto border-t border-white/10 pt-2 text-[10.5px] text-amber-100/85">
                        {matchState.history.slice(-8).map((entry, idx) => (
                          <div key={`${entry.id}_${idx}`} className="truncate">
                            • [T{entry.turn}] {entry.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  data-testid="gameover-hub-btn"
                  onClick={() => {
                    postGameFiredRef.current = true;
                    hsAudio.playSfx('menu_select');
                    hsAudio.playBgm('tavern_hub');
                    onExitBattle();
                  }}
                  className="hs-arcane-btn hs-title hs-outline-sm flex min-h-[48px] w-full items-center justify-center rounded-2xl text-sm font-extrabold text-white sm:text-base"
                >
                  {tr('엘윈마을 로비로 돌아가기', 'Return to Elwin Village Hub')}
                </button>
              </div>
            )}
          </div>
            );
          })()}
        </div>
      )}

      {/* Story Mode Compact Episode Selector & Dialogue Replay Modal */}
      {mode === 'TUTORIAL' && episodeSelectorOpen && matchState.journeyMeta && (
        <StoryEpisodeSelectorModal
          currentEpisode={matchState.journeyMeta.episode}
          maxClearedEpisode={
            matchState.journeyMeta.reincarnation > 0 ? 40 : profile.journeyMaxStageCleared
          }
          reincarnation={matchState.journeyMeta.reincarnation}
          onSelectEpisode={handleSelectStoryEpisode}
          onReplayDialogue={() => setStoryPhase('DIALOGUE')}
          onClose={() => setEpisodeSelectorOpen(false)}
        />
      )}

      {quickRulesOpen && (
        <QuickRulesModal
          isFirstTime={!hasSeenQuickRules()}
          inBattle={true}
          onClose={() => setQuickRulesOpen(false)}
        />
      )}

      {/* DEV-022: Pre-Battle Archetype Preset Deck Selector & Story Boss Briefing */}
      {preBattleModalOpen && (
        <PreBattleDeckModal
          heroClass={matchState.player.heroClass}
          currentDeck={playerDeck.cards}
          storyEpisode={mode === 'TUTORIAL' ? matchState.journeyMeta?.episode : undefined}
          onConfirm={({ deck, initialStance }) => {
            setPreBattleModalOpen(false);
            setActiveStance(initialStance);
            const rebuilt = buildBattleMatchState(
              mode === 'TUTORIAL' ? matchState.journeyMeta?.episode : undefined,
              deck,
            );
            setMatchState(rebuilt);
          }}
          onClose={() => setPreBattleModalOpen(false)}
        />
      )}

      {/* DEV-053(3): Wordless 3-Combo PERFECT Golden Sanctuary Aura Pulse */}
      {rhythmSanctuaryAura && (
        <div
          data-testid="rhythm-sanctuary-aura-finale"
          className="pointer-events-none fixed inset-0 z-[70] animate-pulse border-4 border-yellow-300/75 bg-radial from-amber-300/20 via-sky-300/10 to-transparent"
        />
      )}

      {/* DEV-055(3): Equipped Gold Frame & Card Back Rhythm Resonance Glow on 1.5x/2.0x Beat Hit */}
      {rhythmFlash && rhythmFlash.mult >= 1.5 && (
        <div
          data-testid="prestige-rhythm-resonance-glow"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[69] h-40 bg-gradient-to-t from-amber-400/25 via-yellow-300/10 to-transparent transition-opacity duration-300"
        />
      )}

      {/* Kadan Solo Ultimate Cut-In (Step 1: Kadan casts first, then Silia follows!) */}
      {kadanUltCutIn && (() => {
        const tier = Math.max(1, Math.min(8, kadanUltCutIn.stackTier));
        const stackNum = kadanUltCutIn.stackCount || 100;
        const aoeDmg = 5 * tier;
        const armorGain = 6 * tier;
        const buffStat = 2 * tier;
        const kadanSkillName =
          tier === 1
            ? tr('혹한 눈보라 폭풍', 'Glacial Blizzard Storm')
            : tier === 2
              ? tr('절대영도 빙하참', 'Absolute Zero Cleave')
              : tr('창성 대눈보라 심판', 'Genesis Blizzard');
        const kadanSpeech =
          tier === 1
            ? tr(
                '카단의 기세 해방! 혹한의 눈보라로 전장을 얼려버려라!!',
                'Kadan’s Momentum Unleashed! Freeze the battlefield with Glacial Blizzard!!',
              )
            : tier === 2
              ? tr(
                  '빙하를 가르는 일격! 절대영도의 폭풍이 몰아친다!!',
                  'Absolute Zero Cleave! Let the freezing tempest sweep all foes!!',
                )
              : tr(
                  '창성의 눈보라여, 모든 적을 심판하라! 실리아, 뒤를 부탁한다!!',
                  'Genesis Blizzard, judge them all! Silia, follow my strike!!',
                );
        const effectTag = tr(
          `❄️ 적 전체 -${aoeDmg} · 방어 +${armorGain} · 아군 +${buffStat}/+${buffStat}`,
          `❄️ Enemy AoE -${aoeDmg} · +${armorGain} Armor · Allies +${buffStat}/+${buffStat}`,
        );
        return (
          <div
            key={kadanUltCutIn.seq}
            data-testid="kadan-ultimate-cutin-overlay"
            data-kadan-ult-tier={kadanUltCutIn.stackTier}
            className="pointer-events-none fixed inset-0 z-[96] select-none overflow-hidden"
          >
            <div
              style={
                {
                  '--hs-shake-x': '10px',
                  '--hs-shake-y': '7px',
                  '--hs-shake-dur': '400ms',
                } as React.CSSProperties
              }
              className="hs-damage-shake-a absolute inset-x-2.5 top-[48px] mx-auto flex max-w-lg items-center gap-2.5 rounded-2xl border-2 border-cyan-200 bg-gradient-to-r from-[#041528]/95 via-[#07213a]/95 to-[#041528]/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.94),0_0_26px_rgba(56,189,248,0.65)] backdrop-blur-sm sm:top-[54px] sm:p-2.5"
            >
              <img
                data-testid="kadan-cutin-portrait"
                src="/hs-assets/bosses/kadan_upper.webp?v=hd20"
                alt={tr('카단', 'Kadan')}
                decoding="async"
                draggable={false}
                className="h-14 w-14 shrink-0 rounded-xl border-2 border-cyan-200 bg-sky-950/80 object-cover object-top shadow-lg sm:h-18 sm:w-18"
              />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-cyan-100 bg-gradient-to-r from-sky-600 to-cyan-700 px-2 py-0.5 text-[10px] font-black text-white shadow sm:text-[10.5px]">
                    ❄️ {tr(`카단 필살기 X${stackNum}`, `Kadan Ultimate X${stackNum}`)} · {kadanSkillName}
                  </span>
                  <span className="text-[10px] font-extrabold text-cyan-200 sm:text-[10.5px]">{effectTag}</span>
                </div>
                <p
                  data-testid="kadan-cutin-dialogue-text"
                  className="mt-1 text-xs font-extrabold leading-snug text-white sm:text-sm"
                >
                  “{kadanSpeech}”
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Silia Follow-Up Ultimate Cut-In (1 of 3 Distinct Roles: ATTACK Red / DEFENSE Blue-Gold / HEAL Emerald) */}
      {siliaChainCutIn && (() => {
        const tier = Math.max(1, Math.min(8, siliaChainCutIn.stackTier));
        const sk = siliaChainCutIn.skillKind;
        const atkDmg = Math.min(6, 1 + tier);
        const armorAmt = Math.min(6, 2 + tier);
        const buffAmt = Math.min(2, tier);
        const healAmt = Math.min(10, 2 + tier * 2);
        const minionHeal = Math.min(4, 1 + tier);
        const skillName =
          sk === 'ATTACK'
            ? tr('녹풍 대참격', 'Emerald Tempest')
            : sk === 'DEFENSE'
              ? tr('폭풍 결계진', 'Storm Barrier')
              : tr('회오리 생명풍', 'Vital Cyclone');
        const roleBadge =
          sk === 'ATTACK'
            ? tr('⚔️ [공격] 실리아', '⚔️ [ATTACK] Silia')
            : sk === 'DEFENSE'
              ? tr('🛡️ [방어] 실리아', '🛡️ [DEFENSE] Silia')
              : tr('💚 [치유] 실리아', '💚 [HEAL] Silia');
        const siliaSpeech =
          sk === 'ATTACK'
            ? tr(
                '카단에 이어 제가 베어버릴게요! 붉은 폭풍, 녹풍 대참격!!',
                "Following Kadan's lead! Strike them down, Emerald Tempest!!",
              )
            : sk === 'DEFENSE'
              ? tr(
                  '모두를 폭풍의 방패로 지켜낼게요! 황금 폭풍 결계진 전개!!',
                  'Shielding all allies with the gale! Deploy Storm Barrier!!',
                )
              : tr(
                  '생명의 바람이여, 상처를 치유해 주세요! 회오리 생명풍!!',
                  'Winds of life, mend our wounds! Vital Cyclone!!',
                );
        const effectTag =
          sk === 'ATTACK'
            ? tr(`⚔️ 적 전체·영웅 -${atkDmg} 피해`, `⚔️ All Enemies -${atkDmg} DMG`)
            : sk === 'DEFENSE'
              ? tr(`🛡️ 방어 +${armorAmt} · 아군 보호막 +${buffAmt}/+${buffAmt}`, `🛡️ +${armorAmt} Armor · Ally Shield +${buffAmt}/+${buffAmt}`)
              : tr(`💚 영웅 +${healAmt} · 부상 아군 +${minionHeal} 치유`, `💚 +${healAmt} Hero HP · +${minionHeal} Ally Heal`);
        const frameTheme =
          sk === 'ATTACK'
            ? 'border-red-400 bg-gradient-to-r from-[#2b090b]/95 via-[#3b1109]/95 to-[#24090c]/95 shadow-[0_14px_36px_rgba(0,0,0,0.92),0_0_24px_rgba(239,68,68,0.75)]'
            : sk === 'DEFENSE'
              ? 'border-sky-300 bg-gradient-to-r from-[#071a33]/95 via-[#0c294d]/95 to-[#1c1a08]/95 shadow-[0_14px_36px_rgba(0,0,0,0.92),0_0_24px_rgba(56,189,248,0.75)]'
              : 'border-emerald-300 bg-gradient-to-r from-[#031c13]/95 via-[#062e1f]/95 to-[#052117]/95 shadow-[0_14px_36px_rgba(0,0,0,0.92),0_0_24px_rgba(16,185,129,0.75)]';
        const portraitBorder =
          sk === 'ATTACK'
            ? 'border-red-300 bg-red-950/80'
            : sk === 'DEFENSE'
              ? 'border-sky-300 bg-sky-950/80'
              : 'border-emerald-300 bg-emerald-950/80';
        const badgeTheme =
          sk === 'ATTACK'
            ? 'border-red-200 bg-gradient-to-r from-red-600 to-orange-600'
            : sk === 'DEFENSE'
              ? 'border-sky-200 bg-gradient-to-r from-sky-600 to-amber-600'
              : 'border-emerald-200 bg-gradient-to-r from-emerald-600 to-teal-600';
        const tagTextTheme =
          sk === 'ATTACK'
            ? 'text-orange-200'
            : sk === 'DEFENSE'
              ? 'text-sky-200'
              : 'text-emerald-200';
        return (
          <div
            key={siliaChainCutIn.seq}
            data-testid="silia-chain-cutin-overlay"
            data-silia-chain-skill={sk}
            className="pointer-events-none fixed inset-0 z-[96] select-none overflow-hidden"
          >
            <div
              style={
                {
                  '--hs-shake-x': '9px',
                  '--hs-shake-y': '6px',
                  '--hs-shake-dur': '380ms',
                } as React.CSSProperties
              }
              className={`hs-damage-shake-b absolute inset-x-2.5 top-[48px] mx-auto flex max-w-md items-center gap-2.5 rounded-2xl border-2 p-2 backdrop-blur-sm sm:top-[54px] sm:p-2.5 ${frameTheme}`}
            >
              <img
                data-testid="silia-chain-portrait"
                src="/hs-assets/upper-hd/062_Celia.webp?v=hd20"
                alt={tr('실리아', 'Silia')}
                decoding="async"
                draggable={false}
                className={`h-16 w-16 shrink-0 rounded-xl border-2 object-cover object-top sm:h-20 sm:w-20 ${portraitBorder}`}
              />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-md border px-2 py-0.5 text-[10.5px] font-black text-white shadow ${badgeTheme}`}>
                    {roleBadge} · {skillName}
                  </span>
                  <span className={`text-[10.5px] font-extrabold ${tagTextTheme}`}>{effectTag}</span>
                </div>
                <p
                  data-testid="silia-chain-dialogue-text"
                  className="mt-1.5 text-xs font-extrabold leading-snug text-white sm:text-sm"
                >
                  “{siliaSpeech}”
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Story Mode Exclusive: BGM Pulse Ring Tap (`카단·실리아 합동 필살기 기세`) — Centered in Auto-Play, Compact Left-Side Orb beside Kadan in Manual Play! */}
      {mode === 'TUTORIAL' &&
        matchState.phase === 'PLAYING' &&
        storyPhase === 'CLOSED' &&
        !vsIntroActive &&
        (autoPlay ? (
          <CenterRhythmRingHud
            rhythmEnabled={rhythmEnabled}
            battleBpm={battleBpm}
            autoSpeed2x={autoSpeed2x}
            onToggleSpeed2x={() => setAutoSpeed2x((v) => !v)}
            isBossParryReady={isBossParryReady}
            kadanMomentumCount={kadanMomentumCount}
            spiritPhase={kadanSpiritPhase}
            rhythmFlash={rhythmFlash}
            onTap={handleRhythmOrbTap}
          />
        ) : (
          rhythmEnabled && (
            <div
              data-testid="manual-dual-ult-orb"
              className="pointer-events-none fixed bottom-0.5 left-[58px] z-[74] flex select-none flex-col items-center sm:bottom-1 sm:left-[72px]"
            >
              <button
                type="button"
                data-testid="manual-dual-ult-btn"
                disabled={kadanSpiritPhase === 'IGNITING'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRhythmOrbTap();
                }}
                title={tr(
                  '카단·실리아 합동 필살기 충전 (100 달성 후 탭 시 동시 발동!)',
                  'Charge Kadan & Silia Dual Ultimate (Tap at 100 to unleash both!)',
                )}
                className={`pointer-events-auto flex min-h-[46px] min-w-[54px] flex-col items-center justify-center rounded-2xl border-2 px-2 py-1 shadow-xl transition active:scale-95 ${
                  kadanSpiritPhase === 'READY'
                    ? 'animate-bounce border-yellow-200 bg-gradient-to-b from-amber-500 via-orange-600 to-red-800 text-white shadow-[0_0_20px_rgba(251,146,60,0.95)]'
                    : kadanSpiritPhase === 'IGNITING'
                      ? 'border-orange-300 bg-orange-900/95 text-amber-100'
                      : 'border-cyan-300/75 bg-[#071824]/95 text-cyan-100 hover:border-emerald-300'
                }`}
              >
                <span className="text-xs leading-none">
                  {kadanSpiritPhase === 'READY' ? '🔥❄️🌪' : '❄️🌪'}
                </span>
                <span className="mt-0.5 text-[10px] font-black leading-none">
                  {kadanSpiritPhase === 'READY'
                    ? tr('합동필살!', 'DUAL ULT!')
                    : `${kadanMomentumCount}/100`}
                </span>
              </button>
            </div>
          )
        ))}

      {/* Universal Enlarged Card Inspection & Bottom Action Modal */}
      {renderActiveZoomModal()}
    </div>
  );
};
