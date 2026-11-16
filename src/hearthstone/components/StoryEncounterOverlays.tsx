import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { KADAN_JOURNEY_EPISODES, getJourneyEpisodeDef } from '../kadanJourneyData';
import {
  StoryEpisodeEncounterSpec,
  getObtainedStoryItems,
  recordStoryItemObtained,
} from '../storyEncounterData';
import { MatchRewardBreakdown } from '../types';

// Single-pass GPU-safe portrait filters (prevents iOS Safari WebKit Metal texture OOM crash from 5x chained drop-shadows!)
const STICKER_OUTLINE_FILTER = 'drop-shadow(0 8px 16px rgba(0,0,0,0.85))';

const DIMMED_OUTLINE_FILTER = 'brightness(0.45) saturate(0.55)';

const PARCHMENT_STAR_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M14 6 L15.6 12.4 L22 14 L15.6 15.6 L14 22 L12.4 15.6 L6 14 L12.4 12.4 Z' fill='%23b8ad96' fill-opacity='0.34'/%3E%3C/svg%3E")`;

/**
 * Animal Crossing (`동물의 숲`)-style per-character typewriter + sound + auto-advance hook
 * - Reveals 1 character at a time while playing character-pitched Animalese voice blips
 * - Click while typing -> reveals full line at once, pauses briefly (`750ms`), then advances
 * - Natural completion -> pauses (`1,150ms`) so player can read, then auto-advances
 */
function useAnimaleseTypewriter(opts: {
  fullText: string;
  speakerLabel: string;
  speakerSide: 'LEFT' | 'RIGHT';
  resetKey: string;
  isKo: boolean;
  enabled?: boolean;
  onAutoAdvance: () => void;
}) {
  const {
    fullText,
    speakerLabel,
    speakerSide,
    resetKey,
    isKo,
    enabled = true,
    onAutoAdvance,
  } = opts;

  const [displayedCount, setDisplayedCount] = useState(0);
  const [revealMode, setRevealMode] = useState<'TYPING' | 'CLICK_PAUSE' | 'NATURAL_PAUSE'>('TYPING');
  const [talkBob, setTalkBob] = useState(false);

  const onAutoAdvanceRef = useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;

  useEffect(() => {
    setDisplayedCount(0);
    setRevealMode('TYPING');
    setTalkBob(false);
  }, [resetKey, fullText]);

  useEffect(() => {
    if (!enabled) return;

    if (revealMode === 'TYPING') {
      if (displayedCount >= fullText.length) {
        setTalkBob(false);
        setRevealMode('NATURAL_PAUSE');
        return;
      }

      const prevChar = displayedCount > 0 ? fullText[displayedCount - 1] : '';
      let delayMs = isKo ? 44 : 28;
      if (/[.,!?…]/.test(prevChar)) {
        delayMs = 115;
      } else if (prevChar === ' ') {
        delayMs = 24;
      }

      const timer = window.setTimeout(() => {
        const ch = fullText[displayedCount] ?? '';
        const nextCount = displayedCount + 1;
        const isQuestionTail =
          fullText.trimEnd().endsWith('?') && nextCount >= Math.max(1, fullText.length - 3);
        hsAudio.playAnimaleseBlip(ch, speakerLabel, speakerSide, isQuestionTail);
        if (!/[\s.,…!?"'“”‘’—\-~:;()[\]{}]/.test(ch)) {
          setTalkBob((prev) => !prev);
        }
        setDisplayedCount(nextCount);
      }, delayMs);

      return () => window.clearTimeout(timer);
    }

    const pauseMs = revealMode === 'CLICK_PAUSE' ? 750 : 1150;
    const advanceTimer = window.setTimeout(() => {
      onAutoAdvanceRef.current();
    }, pauseMs);

    return () => window.clearTimeout(advanceTimer);
  }, [enabled, revealMode, displayedCount, fullText, isKo, speakerLabel, speakerSide]);

  const handleInteract = useCallback(() => {
    if (!enabled) return;
    if (displayedCount < fullText.length) {
      // 클릭하면 대사를 한번에 표시하고 잠시 후(750ms) 이동!
      hsAudio.playSfx('card_hover', 0.5);
      setTalkBob(false);
      setDisplayedCount(fullText.length);
      setRevealMode('CLICK_PAUSE');
    } else {
      // 이미 전체 표시된 상태에서 한번 더 클릭 시 즉시 이동
      onAutoAdvanceRef.current();
    }
  }, [enabled, displayedCount, fullText.length]);

  const isTyping = enabled && displayedCount < fullText.length;
  const displayedText = enabled ? fullText.slice(0, displayedCount) : fullText;

  return {
    displayedText,
    isTyping,
    revealMode,
    talkBob: isTyping && talkBob,
    handleInteract,
  };
}

/* ============================================================================
 * 1. Pre-Duel Alternating Upper-Body Character Dialogue Overlay
 *    (Matches `캐릭터 대사 장면.mp4`: 2 half-body cutouts over paused card board,
 *     Animal Crossing per-char typewriter + sound + click-to-reveal + auto-advance!)
 * ============================================================================ */

export interface StoryDuelDialogueOverlayProps {
  encounter: StoryEpisodeEncounterSpec;
  episodeTitle: string;
  autoPlayActive?: boolean;
  onComplete: () => void;
}

export const StoryDuelDialogueOverlay: React.FC<StoryDuelDialogueOverlayProps> = ({
  encounter,
  episodeTitle,
  autoPlayActive = false,
  onComplete,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const [lineIdx, setLineIdx] = useState(0);

  const totalLines = encounter.lines.length;
  const safeIdx = Math.min(lineIdx, Math.max(0, totalLines - 1));
  const currentTurn = encounter.lines[safeIdx];
  const isLeftSpeaking = currentTurn?.side === 'LEFT';

  useEffect(() => {
    setLineIdx(0);
  }, [encounter.episode]);

  const advanceLine = useCallback(() => {
    if (safeIdx + 1 < totalLines) {
      hsAudio.playSfx('card_hover', 0.65);
      setLineIdx((prev) => prev + 1);
    } else {
      hsAudio.playSfx('box_press', 0.85);
      onComplete();
    }
  }, [safeIdx, totalLines, onComplete]);

  const speakerLabel = currentTurn
    ? isKo
      ? currentTurn.speakerKo
      : currentTurn.speakerEn
    : '';
  const speechText = currentTurn ? (isKo ? currentTurn.textKo : currentTurn.textEn) : '';

  const { displayedText, isTyping, talkBob, handleInteract } = useAnimaleseTypewriter({
    fullText: speechText,
    speakerLabel,
    speakerSide: isLeftSpeaking ? 'LEFT' : 'RIGHT',
    resetKey: `duel:${encounter.episode}:${safeIdx}`,
    isKo,
    enabled: Boolean(currentTurn),
    onAutoAdvance: advanceLine,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        handleInteract();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hsAudio.playSfx('ui_click', 0.7);
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleInteract, onComplete]);

  if (!currentTurn) return null;

  const epHeaderLabel =
    encounter.episode === 0
      ? isKo
        ? `에피소드 0 - ${episodeTitle}`
        : `Episode 0 - ${episodeTitle}`
      : isKo
        ? `제${encounter.episode}화 - ${episodeTitle}`
        : `Episode ${encounter.episode} - ${episodeTitle}`;

  return (
    <div
      data-testid="story-duel-dialogue-overlay"
      data-dialogue-index={safeIdx + 1}
      data-dialogue-total={totalLines}
      data-dialogue-typing={isTyping ? 'true' : 'false'}
      onClick={(e) => {
        e.stopPropagation();
        handleInteract();
      }}
      className="absolute inset-0 z-[91] cursor-pointer select-none overflow-hidden bg-black/62"
    >
      {/* Subtle Top & Bottom Cinematic Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/72" />

      {/* Top Episode Strip + 1-Tap Skip Button */}
      <div className="relative z-30 flex items-center justify-between gap-2 px-3 pt-2.5 sm:px-6 sm:pt-4">
        <div className="flex items-center gap-2 rounded-full border border-amber-300/45 bg-stone-950/85 px-3.5 py-1.5 shadow-lg">
          <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />
          <span className="hs-title truncate text-xs font-extrabold tracking-wide text-amber-100 sm:text-sm">
            {epHeaderLabel}
          </span>
        </div>

        <button
          type="button"
          data-testid="story-dialogue-skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            hsAudio.playSfx('ui_click', 0.75);
            onComplete();
          }}
          className="min-h-[44px] rounded-xl border border-white/25 bg-stone-950/85 px-3.5 py-1.5 text-xs font-extrabold text-stone-200 shadow-lg transition hover:border-amber-300 hover:text-amber-200"
        >
          {tr('건너뛰기 ▸▸', 'SKIP ▸▸')}
        </button>
      </div>

      {/* Left Character Upper-Body Cutout (Protagonist / Ally — Large Waist-Up `상반신` 66%~78% Viewport Height!) */}
      <div
        data-testid="story-dialogue-left-portrait"
        style={{
          filter: isLeftSpeaking ? STICKER_OUTLINE_FILTER : DIMMED_OUTLINE_FILTER,
          transformOrigin: 'bottom center',
          transform: isLeftSpeaking
            ? `translate3d(-50%, ${talkBob ? '-8px' : '0px'}, 0) scale(1.03)`
            : 'translate3d(-50%, 6px, 0) scale(0.96)',
          transition: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease',
        }}
        className={`pointer-events-none absolute -bottom-2.5 left-[25%] flex h-[68%] justify-center sm:left-[27%] sm:h-[78%] ${
          encounter.leftSpriteUrl.includes('/characters/cutouts/') ? 'items-start' : 'items-end'
        } ${isLeftSpeaking ? 'z-20' : 'z-10'}`}
      >
        <img
          src={encounter.leftSpriteUrl}
          alt={isKo ? encounter.leftNameKo : encounter.leftNameEn}
          draggable={false}
          className={`w-auto max-w-none select-none ${
            encounter.leftSpriteUrl.includes('/characters/cutouts/')
              ? 'h-[168%]'
              : encounter.leftSpriteUrl.endsWith('kadan_upper.webp')
                ? 'h-[122%]'
                : 'h-full'
          }`}
        />
      </div>

      {/* Right Character Upper-Body Cutout (Opponent / Boss — Large Waist-Up `상반신` 66%~78% Viewport Height!) */}
      <div
        data-testid="story-dialogue-right-portrait"
        style={{
          filter: !isLeftSpeaking ? STICKER_OUTLINE_FILTER : DIMMED_OUTLINE_FILTER,
          transformOrigin: 'bottom center',
          transform: !isLeftSpeaking
            ? `translate3d(-50%, ${talkBob ? '-8px' : '0px'}, 0) scale(1.03)`
            : 'translate3d(-50%, 6px, 0) scale(0.96)',
          transition: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease',
        }}
        className={`pointer-events-none absolute -bottom-2.5 left-[75%] flex h-[68%] justify-center sm:left-[73%] sm:h-[78%] ${
          encounter.rightSpriteUrl.includes('/characters/cutouts/') ? 'items-start' : 'items-end'
        } ${!isLeftSpeaking ? 'z-20' : 'z-10'}`}
      >
        <img
          src={encounter.rightSpriteUrl}
          alt={isKo ? encounter.rightNameKo : encounter.rightNameEn}
          draggable={false}
          className={`w-auto max-w-none select-none ${
            encounter.rightSpriteUrl.includes('/characters/cutouts/')
              ? 'h-[168%]'
              : encounter.rightSpriteUrl.endsWith('kadan_upper.webp')
                ? 'h-[122%]'
                : 'h-full'
          }`}
        />
      </div>

      {/* Speech Bubble Box Aligned to Active Speaker (`캐릭터 대사 장면.mp4` Exact Style!) */}
      <div
        className={`absolute bottom-5 z-30 transition-all duration-200 sm:bottom-8 ${
          isLeftSpeaking
            ? 'inset-x-3 sm:inset-x-auto sm:left-[8%] sm:w-[440px]'
            : 'inset-x-3 sm:inset-x-auto sm:right-[8%] sm:w-[440px]'
        }`}
      >
        {/* Top Dark Trapezoid Speaker Nameplate */}
        <div
          className="relative z-10 mx-auto -mb-3 flex w-fit min-w-[132px] max-w-[260px] items-center justify-center px-6 py-1.5 text-center shadow-md"
          style={{
            backgroundColor: '#23262e',
            clipPath: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
          }}
        >
          <span className="truncate text-xs font-extrabold tracking-wide text-white sm:text-sm">
            {speakerLabel}
          </span>
        </div>

        {/* Cream-White Dialogue Plate */}
        <div className="relative min-h-[86px] rounded-[12px] border border-stone-300 bg-[#f2f2f0] px-5 pb-5 pt-5 text-left shadow-[0_18px_42px_rgba(0,0,0,0.85)] sm:min-h-[96px] sm:px-6 sm:pt-6">
          <p
            data-testid="story-dialogue-text"
            data-full-text={speechText}
            aria-label={speechText}
            className="relative text-[13.5px] font-bold leading-relaxed text-[#1b1d22] sm:text-[15px]"
          >
            <span aria-hidden="true" className="invisible block">
              {speechText}
            </span>
            <span className="absolute inset-0 block">{displayedText}</span>
          </p>

          {/* Bottom-Left Step Indicator & Click / Auto-Advance Hint */}
          <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-stone-500">
            <span>
              {safeIdx + 1} / {totalLines} ·{' '}
              {isTyping
                ? tr(
                    '클릭 시 대사 한번에 표시 · 자동 진행',
                    'Tap to reveal full line · Auto-advances',
                  )
                : safeIdx + 1 < totalLines
                  ? tr('잠시 후 다음 대사로 이동합니다...', 'Moving to next line shortly...')
                  : autoPlayActive
                    ? tr(
                        '잠시 후 계속 자동플레이가 진행됩니다...',
                        'Continuing Auto-Play shortly...',
                      )
                    : tr(
                        '잠시 후 게임 시작화면으로 이동합니다...',
                        'Opening Game Start screen shortly...',
                      )}
            </span>
          </div>

          {/* Bottom-Right Advance Triangle (`▼`) */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-2.5 right-3.5 text-xs font-black text-[#1b1d22] ${
              isTyping ? 'opacity-45' : 'animate-bounce opacity-100'
            }`}
          >
            ▼
          </span>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. Post-Victory Scene Overlay
 *    - If `encounter.rewardItem` exists: Character Lead-in Quote ->
 *      `아이템 획득 장면.mp4` Parchment Item Showcase Card (`✦ Item Name ✦` + CHECK)
 *    - If `encounter.rewardItem === null`: Character Upper-Body Victory Ment
 *      and clean episode completion!
 * ============================================================================ */

export interface StoryVictorySceneOverlayProps {
  encounter: StoryEpisodeEncounterSpec;
  outcomeSummary: MatchRewardBreakdown | null;
  autoPlayActive?: boolean;
  onFinishEpisode: (action: 'NEXT_EPISODE' | 'EXIT_HUB') => void;
}

export const StoryVictorySceneOverlay: React.FC<StoryVictorySceneOverlayProps> = ({
  encounter,
  outcomeSummary,
  autoPlayActive = false,
  onFinishEpisode,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const hasItem = Boolean(encounter.rewardItem);

  const [step, setStep] = useState<'CHARACTER_LINE' | 'ITEM_CARD'>('CHARACTER_LINE');

  useEffect(() => {
    setStep('CHARACTER_LINE');
    if (encounter.rewardItem) {
      recordStoryItemObtained(encounter.rewardItem.code, encounter.episode);
    }
  }, [encounter]);

  const speakerName = isKo ? encounter.leftNameKo : encounter.leftNameEn;
  const characterLine = useMemo(() => {
    if (encounter.rewardItem) {
      return isKo ? encounter.rewardItem.leadInKo : encounter.rewardItem.leadInEn;
    }
    return isKo ? encounter.victoryMentKo : encounter.victoryMentEn;
  }, [encounter, isKo]);

  const hasNextEpisode = Boolean(outcomeSummary?.nextEpisode);
  const nextEpNum = outcomeSummary?.nextEpisode ?? encounter.episode + 1;

  const handleAdvanceFromCharacterLine = useCallback(() => {
    if (hasItem) {
      hsAudio.playSfx('pack_rare', 0.85);
      setStep('ITEM_CARD');
    } else {
      hsAudio.playSfx('box_press', 0.85);
      onFinishEpisode(hasNextEpisode ? 'NEXT_EPISODE' : 'EXIT_HUB');
    }
  }, [hasItem, hasNextEpisode, onFinishEpisode]);

  const {
    displayedText: displayedVictoryLine,
    isTyping: isVictoryTyping,
    talkBob: victoryTalkBob,
    handleInteract: handleVictoryInteract,
  } = useAnimaleseTypewriter({
    fullText: characterLine,
    speakerLabel: speakerName,
    speakerSide: 'LEFT',
    resetKey: `victory:${encounter.episode}:${step}`,
    isKo,
    enabled: step === 'CHARACTER_LINE',
    onAutoAdvance: handleAdvanceFromCharacterLine,
  });

  // Auto-advance ITEM_CARD as well when Auto-Play is ON so Story Mode continues hands-free!
  useEffect(() => {
    if (step !== 'ITEM_CARD' || !autoPlayActive) return;
    const t = window.setTimeout(() => {
      hsAudio.playSfx('box_press', 0.85);
      onFinishEpisode(hasNextEpisode ? 'NEXT_EPISODE' : 'EXIT_HUB');
    }, 1900);
    return () => window.clearTimeout(t);
  }, [step, autoPlayActive, hasNextEpisode, onFinishEpisode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (step === 'CHARACTER_LINE') {
          handleVictoryInteract();
        } else {
          hsAudio.playSfx('box_press', 0.85);
          onFinishEpisode(hasNextEpisode ? 'NEXT_EPISODE' : 'EXIT_HUB');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, handleVictoryInteract, hasNextEpisode, onFinishEpisode]);

  return (
    <div
      data-testid="story-victory-scene-overlay"
      data-victory-step={step}
      data-has-item={hasItem ? 'true' : 'false'}
      onClick={(e) => {
        e.stopPropagation();
        if (step === 'CHARACTER_LINE') {
          handleVictoryInteract();
        }
      }}
      className={`absolute inset-0 z-[95] flex flex-col items-center justify-center overflow-hidden select-none transition-colors duration-300 ${
        step === 'ITEM_CARD'
          ? 'bg-black/88'
          : 'cursor-pointer bg-black/68'
      }`}
    >
      {/* Top Reward Receipt Pill (Gold / Pack Earned) */}
      {outcomeSummary && (
        <div className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border border-amber-300/60 bg-stone-950/90 px-4 py-1.5 text-xs font-extrabold text-amber-100 shadow-xl sm:top-5">
          <span className="text-yellow-300">
            🏆{' '}
            {encounter.episode === 0
              ? tr('튜토리얼 승리!', 'Tutorial Clear!')
              : isKo
                ? `제${encounter.episode}화 승리!`
                : `EP ${encounter.episode} Victory!`}
          </span>
          {outcomeSummary.goldEarned > 0 && (
            <span className="text-amber-200">+{outcomeSummary.goldEarned}G</span>
          )}
          {outcomeSummary.packsEarned > 0 && (
            <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-yellow-200">
              🎁 +{outcomeSummary.packsEarned} {tr('팩', 'Pack')}
            </span>
          )}
        </div>
      )}

      {/* Protagonist Upper-Body Cutout (Large Waist-Up `상반신` 70%~80% Viewport Height!) */}
      <div
        data-testid="story-victory-portrait"
        style={{
          filter:
            step === 'ITEM_CARD'
              ? 'brightness(0.28) blur(2px)'
              : STICKER_OUTLINE_FILTER,
          transformOrigin: 'bottom center',
          transform:
            step === 'CHARACTER_LINE'
              ? `translate3d(-50%, ${victoryTalkBob ? '-7px' : '0px'}, 0)`
              : 'translate3d(-50%, 0, 0)',
          transition: 'filter 320ms ease, opacity 320ms ease, transform 140ms ease',
        }}
        className={`pointer-events-none absolute -bottom-2.5 left-1/2 flex h-[70%] justify-center sm:h-[80%] ${
          encounter.leftSpriteUrl.includes('/characters/cutouts/') ? 'items-start' : 'items-end'
        } ${
          step === 'ITEM_CARD' ? 'z-10 scale-98 opacity-45' : 'z-20 scale-100 opacity-100'
        }`}
      >
        <img
          src={encounter.leftSpriteUrl}
          alt={speakerName}
          draggable={false}
          className={`w-auto max-w-none select-none ${
            encounter.leftSpriteUrl.includes('/characters/cutouts/')
              ? 'h-[168%]'
              : encounter.leftSpriteUrl.endsWith('kadan_upper.webp')
                ? 'h-[122%]'
                : 'h-full'
          }`}
        />
      </div>

      {/* STEP 1 (or No-Item Victory Ment): Centered Character Speech Box */}
      {step === 'CHARACTER_LINE' && (
        <div className="absolute inset-x-3 bottom-5 z-30 mx-auto max-w-[480px] sm:bottom-8">
          <div
            style={{
              backgroundColor: '#23262e',
              clipPath: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
            }}
            className="relative z-10 mx-auto -mb-3 flex w-fit min-w-[140px] max-w-[280px] items-center justify-center px-6 py-1.5 text-center shadow-md"
          >
            <span className="truncate text-xs font-extrabold tracking-wide text-white sm:text-sm">
              {speakerName}
            </span>
          </div>

          <div className="relative rounded-[12px] border border-stone-300 bg-[#f2f2f0] px-5 pb-4 pt-5 text-left shadow-[0_18px_42px_rgba(0,0,0,0.9)] sm:px-6 sm:pt-6">
            <p
              data-testid="story-victory-ment-text"
              data-full-text={characterLine}
              aria-label={characterLine}
              className="relative text-[13.5px] font-bold leading-relaxed text-[#1b1d22] sm:text-[15px]"
            >
              <span aria-hidden="true" className="invisible block">
                {characterLine}
              </span>
              <span className="absolute inset-0 block">{displayedVictoryLine}</span>
            </p>

            {hasItem ? (
              <div className="mt-2.5 flex items-center justify-between text-[11px] font-extrabold text-amber-800">
                <span>
                  ✦{' '}
                  {isVictoryTyping
                    ? tr(
                        '클릭 시 대사 한번에 표시 · 전리품 성물 자동 확인',
                        'Tap to reveal all · Auto-opens relic',
                      )
                    : tr(
                        '잠시 후 전리품 성물을 확인합니다...',
                        'Opening obtained relic shortly...',
                      )}
                </span>
                <span
                  className={`text-xs text-[#1b1d22] ${
                    isVictoryTyping ? 'opacity-45' : 'animate-bounce opacity-100'
                  }`}
                >
                  ▼
                </span>
              </div>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-stone-300/80 pt-3"
              >
                <span className="text-[11px] font-bold text-stone-500">
                  {isVictoryTyping
                    ? tr('클릭 시 전체 표시 · 자동 진행', 'Tap to reveal · Auto-advances')
                    : autoPlayActive
                      ? tr('잠시 후 다음 화 계속 자동플레이...', 'Continuing Auto-Play shortly...')
                      : tr('잠시 후 다음 화 시작화면으로 이동...', 'Moving to next episode start...')}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="story-victory-hub-btn"
                    onClick={() => {
                      hsAudio.playSfx('menu_select');
                      hsAudio.playBgm('tavern_hub');
                      onFinishEpisode('EXIT_HUB');
                    }}
                    className="min-h-[44px] rounded-lg border border-stone-400 bg-stone-200 px-3.5 py-2 text-xs font-extrabold text-stone-800 transition hover:bg-stone-300"
                  >
                    {tr('회차 종료 (로비)', 'End & Hub')}
                  </button>
                  {hasNextEpisode && (
                    <button
                      type="button"
                      data-testid="story-victory-next-btn"
                      onClick={() => {
                        hsAudio.playSfx('box_press');
                        onFinishEpisode('NEXT_EPISODE');
                      }}
                      className="min-h-[44px] rounded-lg bg-[#201d1d] px-4 py-2 text-xs font-extrabold text-amber-200 shadow transition hover:bg-stone-800"
                    >
                      {isKo ? `제${nextEpNum}화 계속하기 ▶` : `Next EP ${nextEpNum} ▶`}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: `아이템 획득 장면.mp4` Parchment Relic Acquisition Showcase! */}
      {step === 'ITEM_CARD' && encounter.rewardItem && (
        <div
          data-testid="story-item-acquisition-card"
          onClick={(e) => e.stopPropagation()}
          className="relative z-30 flex w-full max-w-lg animate-[hsCardPop_0.34s_cubic-bezier(0.22,1,0.36,1)] flex-col items-center px-4 text-center"
        >
          {/* Framed Parchment Card Stack + Corner Laurel Leaves */}
          <div className="relative mt-4 w-full max-w-[380px] sm:max-w-[430px]">
            {/* Decorative Top-Right & Bottom-Left Olive Laurel Leaves (`아이템 획득 장면.mp4` Exact Detail!) */}
            <svg
              viewBox="0 0 64 64"
              className="pointer-events-none absolute -right-5 -top-3 z-0 h-14 w-14 rotate-12 text-[#cbb97a] drop-shadow"
            >
              <path
                d="M12 50 C22 26, 42 14, 58 10 C48 26, 34 40, 12 50 Z"
                fill="currentColor"
              />
              <path
                d="M18 54 C34 42, 48 36, 62 36 C48 48, 34 54, 18 54 Z"
                fill="#b5a264"
              />
            </svg>
            <svg
              viewBox="0 0 64 64"
              className="pointer-events-none absolute -bottom-4 -left-6 z-0 h-16 w-16 rotate-180 text-[#cbb97a] drop-shadow"
            >
              <path
                d="M12 50 C22 26, 42 14, 58 10 C48 26, 34 40, 12 50 Z"
                fill="currentColor"
              />
              <path
                d="M18 54 C34 42, 48 36, 62 36 C48 48, 34 54, 18 54 Z"
                fill="#b5a264"
              />
            </svg>

            {/* Stacked Tilted Taupe Paper Backing Layers */}
            <div className="pointer-events-none absolute inset-0 -rotate-[2.5deg] rounded-[14px] bg-[#9c9484]/75 shadow-lg" />
            <div className="pointer-events-none absolute inset-0 translate-x-1 translate-y-1 rotate-[1.8deg] rounded-[14px] bg-[#bdb5a2]/85 shadow-lg" />

            {/* Top Stitched Ivory Title Pill (`✦ 아이템명 ✦`) */}
            <div className="relative z-20 mx-auto -mb-4 w-fit min-w-[190px] max-w-[92%] rounded-[10px] bg-[#eae2cf] p-1 shadow-[0_6px_16px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-center gap-2.5 rounded-[7px] border border-dashed border-[#afa38b] px-4 py-1">
                <span className="text-xs text-[#7d7059]">✦</span>
                <span
                  data-testid="story-item-name"
                  style={{ textShadow: 'none' }}
                  className="truncate text-sm font-black tracking-wide text-[#2b251e] sm:text-base"
                >
                  {isKo ? encounter.rewardItem.nameKo : encounter.rewardItem.nameEn}
                </span>
                <span className="text-xs text-[#7d7059]">✦</span>
              </div>
            </div>

            {/* Main Cream-Parchment Card with 4-Point Star Wallpaper & Item Illustration */}
            <div className="relative z-10 rounded-[14px] bg-[#ded7c5] p-2.5 shadow-[0_22px_50px_rgba(0,0,0,0.88)] sm:p-3">
              <div
                style={{ backgroundImage: PARCHMENT_STAR_PATTERN }}
                className="flex h-44 w-full items-center justify-center overflow-hidden rounded-[10px] border border-[#c5bba5] bg-[#d5cebc] p-3 sm:h-52"
              >
                <img
                  src={encounter.rewardItem.imageUrl}
                  alt={isKo ? encounter.rewardItem.nameKo : encounter.rewardItem.nameEn}
                  draggable={false}
                  className="h-full max-h-[168px] w-auto object-contain drop-shadow-[0_10px_16px_rgba(32,24,14,0.45)] sm:max-h-[192px]"
                />
              </div>
            </div>
          </div>

          {/* Ornamental Thin Star Divider (`✦ ─────────── ✦`) */}
          <div className="mt-5 flex w-full max-w-[300px] items-center justify-center gap-2 text-[#cfc5b0]/75">
            <span className="text-[10px]">✦</span>
            <div className="h-[1px] flex-1 bg-[#cfc5b0]/45" />
            <span className="text-[10px]">✦</span>
          </div>

          {/* 2~3 Line Item Lore & Effect Description */}
          <p
            data-testid="story-item-desc"
            className="mt-3 max-w-md text-xs font-semibold leading-relaxed text-[#f2eee4] sm:text-sm"
          >
            {isKo ? encounter.rewardItem.descKo : encounter.rewardItem.descEn}
          </p>

          {/* Bottom `CHECK` / Next Episode & Hub Action Buttons */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              data-testid="story-item-check-btn"
              onClick={() => {
                hsAudio.playSfx('box_press', 0.85);
                onFinishEpisode(hasNextEpisode ? 'NEXT_EPISODE' : 'EXIT_HUB');
              }}
              className="min-h-[44px] min-w-[148px] rounded-lg border border-[#c8bfa8]/55 bg-[#23211e]/90 px-6 py-2.5 text-xs font-extrabold tracking-widest text-[#ece6d8] shadow-xl transition hover:border-amber-300 hover:bg-[#322e29] sm:text-sm"
            >
              {hasNextEpisode
                ? isKo
                  ? `확인 · 제${nextEpNum}화로 ▶`
                  : `CHECK · EP ${nextEpNum} ▶`
                : tr('확인 (CHECK)', 'CHECK')}
            </button>

            <button
              type="button"
              data-testid="story-item-hub-btn"
              onClick={() => {
                hsAudio.playSfx('menu_select');
                hsAudio.playBgm('tavern_hub');
                onFinishEpisode('EXIT_HUB');
              }}
              className="min-h-[44px] rounded-lg border border-white/20 bg-black/55 px-4 py-2.5 text-xs font-bold text-stone-300 transition hover:border-amber-300/60 hover:text-amber-100"
            >
              {tr('로비로 종료', 'Return to Hub')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 3. Compact Episode Selector & Obtained Relics Drawer Modal
 *    (Replaces the heavy 5-cut webtoon modal when clicking header episode button)
 * ============================================================================ */

export interface StoryEpisodeSelectorModalProps {
  currentEpisode: number;
  maxClearedEpisode: number;
  reincarnation: number;
  onSelectEpisode: (ep: number) => void;
  onReplayDialogue: () => void;
  onClose: () => void;
}

export const StoryEpisodeSelectorModal: React.FC<StoryEpisodeSelectorModalProps> = ({
  currentEpisode,
  maxClearedEpisode,
  reincarnation,
  onSelectEpisode,
  onReplayDialogue,
  onClose,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const unlockedMax = reincarnation > 0 ? 40 : Math.max(currentEpisode, maxClearedEpisode + 1, 1);
  const obtainedMap = useMemo(() => getObtainedStoryItems(), []);
  const ep0Def = useMemo(() => getJourneyEpisodeDef(0, isKo), [isKo]);

  return (
    <div
      data-testid="story-episode-selector-modal"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-[#d8b267] p-4 text-amber-100 shadow-2xl sm:p-5"
      >
        <div className="flex items-center justify-between gap-2 border-b border-amber-500/30 pb-3">
          <div>
            <h3 className="hs-title text-base font-extrabold text-amber-200 sm:text-lg">
              {tr('카단의 여정 · 회차 이동 및 대사 다시보기', 'Kadan’s Journey · Episodes & Relics')}
            </h3>
            <p className="text-[11px] font-bold text-amber-200/75">
              {tr(
                `수집 성물: ${Object.keys(obtainedMap).length} / 20종 · 해금 회차: 0~${unlockedMax}화`,
                `Relics Collected: ${Object.keys(obtainedMap).length} / 20 · Unlocked: EP 0–${unlockedMax}`,
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                hsAudio.playSfx('ui_click');
                onClose();
                onReplayDialogue();
              }}
              className="hs-arcane-btn min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-extrabold text-white"
            >
              💬 {tr('이번 화 대사 보기', 'Replay Dialogue')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hs-brass-btn flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-amber-100"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="mt-3 grid flex-1 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
          {/* Episode 0 Tutorial */}
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_press');
              onSelectEpisode(0);
            }}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition ${
              currentEpisode === 0
                ? 'border-emerald-300 bg-emerald-950/80 text-emerald-100'
                : 'border-amber-500/35 bg-stone-950/75 text-amber-100 hover:border-amber-300'
            }`}
          >
            <span className="truncate">EP.0 · {ep0Def.titleKo}</span>
            <span className="ml-2 shrink-0 text-[10px] text-sky-300">{tr('튜토리얼', 'Tutorial')}</span>
          </button>

          {KADAN_JOURNEY_EPISODES.map((ep) => {
            const locked = ep.episode > unlockedMax;
            const epLoc = getJourneyEpisodeDef(ep.episode, isKo);
            return (
              <button
                key={ep.episode}
                type="button"
                disabled={locked}
                onClick={() => {
                  hsAudio.playSfx('box_press');
                  onSelectEpisode(ep.episode);
                }}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-extrabold transition ${
                  currentEpisode === ep.episode
                    ? 'border-emerald-300 bg-emerald-950/80 text-emerald-100'
                    : locked
                      ? 'cursor-not-allowed border-stone-800 bg-stone-950/40 text-stone-600 opacity-50'
                      : 'border-amber-500/35 bg-stone-950/75 text-amber-100 hover:border-amber-300'
                }`}
              >
                <span className="truncate">
                  {isKo ? `제${ep.episode}화 · ${epLoc.titleKo}` : `EP.${ep.episode} · ${epLoc.titleKo}`}
                </span>
                {locked && <span className="ml-1 shrink-0 text-[10px]">🔒</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
