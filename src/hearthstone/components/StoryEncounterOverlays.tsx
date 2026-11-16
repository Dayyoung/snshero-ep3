import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { KADAN_JOURNEY_EPISODES, getJourneyEpisodeDef } from '../kadanJourneyData';
import {
  StoryEpisodeEncounterSpec,
  getObtainedStoryItems,
  recordStoryItemObtained,
} from '../storyEncounterData';
import { MatchRewardBreakdown } from '../types';

const STICKER_OUTLINE_FILTER =
  'drop-shadow(2px 0 0 rgba(248,250,252,0.95)) drop-shadow(-2px 0 0 rgba(248,250,252,0.95)) drop-shadow(0 2px 0 rgba(248,250,252,0.95)) drop-shadow(0 -2px 0 rgba(248,250,252,0.95)) drop-shadow(0 18px 32px rgba(0,0,0,0.88))';

const DIMMED_OUTLINE_FILTER =
  'brightness(0.44) saturate(0.52) drop-shadow(1.5px 0 0 rgba(148,163,184,0.65)) drop-shadow(-1.5px 0 0 rgba(148,163,184,0.65)) drop-shadow(0 1.5px 0 rgba(148,163,184,0.65)) drop-shadow(0 -1.5px 0 rgba(148,163,184,0.65)) drop-shadow(0 12px 24px rgba(0,0,0,0.85))';

const PARCHMENT_STAR_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M14 6 L15.6 12.4 L22 14 L15.6 15.6 L14 22 L12.4 15.6 L6 14 L12.4 12.4 Z' fill='%23b8ad96' fill-opacity='0.34'/%3E%3C/svg%3E")`;

/* ============================================================================
 * 1. Pre-Duel Alternating Upper-Body Character Dialogue Overlay
 *    (Matches `캐릭터 대사 장면.mp4`: 2 half-body cutouts over paused card board,
 *     <= 6 alternating lines, click anywhere -> next line -> immediate duel!)
 * ============================================================================ */

export interface StoryDuelDialogueOverlayProps {
  encounter: StoryEpisodeEncounterSpec;
  episodeTitle: string;
  onComplete: () => void;
}

export const StoryDuelDialogueOverlay: React.FC<StoryDuelDialogueOverlayProps> = ({
  encounter,
  episodeTitle,
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        advanceLine();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hsAudio.playSfx('ui_click', 0.7);
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advanceLine, onComplete]);

  if (!currentTurn) return null;

  const speakerLabel = isKo ? currentTurn.speakerKo : currentTurn.speakerEn;
  const speechText = isKo ? currentTurn.textKo : currentTurn.textEn;
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
      onClick={(e) => {
        e.stopPropagation();
        advanceLine();
      }}
      className="absolute inset-0 z-[91] cursor-pointer select-none overflow-hidden bg-black/48 backdrop-blur-[2.5px]"
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

      {/* Left Character Upper-Body Cutout (Protagonist / Ally — True Waist-Up `상반신` Anchored at Bottom!) */}
      <div
        style={{
          filter: isLeftSpeaking ? STICKER_OUTLINE_FILTER : DIMMED_OUTLINE_FILTER,
          transform: isLeftSpeaking
            ? 'translate3d(-50%, -6px, 0) scale(1.03)'
            : 'translate3d(-50%, 6px, 0) scale(0.96)',
          transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease',
        }}
        className={`pointer-events-none absolute left-[27%] flex justify-center sm:left-[28%] ${
          encounter.leftSpriteUrl.includes('/characters/cutouts/')
            ? 'top-[28%] h-[108%] items-start sm:top-[14%] sm:h-[124%]'
            : 'bottom-0 h-[54%] items-end sm:h-[74%]'
        } ${isLeftSpeaking ? 'z-20' : 'z-10'}`}
      >
        <img
          src={encounter.leftSpriteUrl}
          alt={isKo ? encounter.leftNameKo : encounter.leftNameEn}
          draggable={false}
          className="h-full w-auto max-w-none select-none"
        />
      </div>

      {/* Right Character Upper-Body Cutout (Opponent / Boss — True Waist-Up `상반신` Anchored at Bottom!) */}
      <div
        style={{
          filter: !isLeftSpeaking ? STICKER_OUTLINE_FILTER : DIMMED_OUTLINE_FILTER,
          transform: !isLeftSpeaking
            ? 'translate3d(-50%, -6px, 0) scale(1.03)'
            : 'translate3d(-50%, 6px, 0) scale(0.96)',
          transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease',
        }}
        className={`pointer-events-none absolute left-[73%] flex justify-center sm:left-[72%] ${
          encounter.rightSpriteUrl.includes('/characters/cutouts/')
            ? 'top-[28%] h-[108%] items-start sm:top-[14%] sm:h-[124%]'
            : 'bottom-0 h-[54%] items-end sm:h-[74%]'
        } ${!isLeftSpeaking ? 'z-20' : 'z-10'}`}
      >
        <img
          src={encounter.rightSpriteUrl}
          alt={isKo ? encounter.rightNameKo : encounter.rightNameEn}
          draggable={false}
          className="h-full w-auto max-w-none select-none"
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
        <div className="relative z-10 mx-auto -mb-3 flex w-fit min-w-[132px] max-w-[260px] items-center justify-center px-6 py-1.5 text-center shadow-md"
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
            className="text-[13.5px] font-bold leading-relaxed text-[#1b1d22] sm:text-[15px]"
          >
            {speechText}
          </p>

          {/* Bottom-Left Step Indicator & Click Hint */}
          <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-stone-500">
            <span>
              {safeIdx + 1} / {totalLines} ·{' '}
              {safeIdx + 1 < totalLines
                ? tr('화면을 클릭해 다음 대사', 'Tap anywhere for next line')
                : tr('화면을 클릭해 대결 시작!', 'Tap anywhere to start duel!')}
            </span>
          </div>

          {/* Bottom-Right Bouncing Advance Triangle (`▼`) */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-2.5 right-3.5 animate-bounce text-xs font-black text-[#1b1d22]"
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
  onFinishEpisode: (action: 'NEXT_EPISODE' | 'EXIT_HUB') => void;
}

export const StoryVictorySceneOverlay: React.FC<StoryVictorySceneOverlayProps> = ({
  encounter,
  outcomeSummary,
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (step === 'CHARACTER_LINE') {
          handleAdvanceFromCharacterLine();
        } else {
          hsAudio.playSfx('box_press', 0.85);
          onFinishEpisode(hasNextEpisode ? 'NEXT_EPISODE' : 'EXIT_HUB');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, handleAdvanceFromCharacterLine, hasNextEpisode, onFinishEpisode]);

  return (
    <div
      data-testid="story-victory-scene-overlay"
      data-victory-step={step}
      data-has-item={hasItem ? 'true' : 'false'}
      onClick={(e) => {
        e.stopPropagation();
        if (step === 'CHARACTER_LINE') {
          handleAdvanceFromCharacterLine();
        }
      }}
      className={`absolute inset-0 z-[95] flex flex-col items-center justify-center overflow-hidden select-none transition-colors duration-300 ${
        step === 'ITEM_CARD'
          ? 'bg-black/80 backdrop-blur-md'
          : 'cursor-pointer bg-black/55 backdrop-blur-[3px]'
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

      {/* Protagonist Upper-Body Cutout (True Waist-Up `상반신` in CHARACTER_LINE, Softly Dimmed Backdrop in ITEM_CARD!) */}
      <div
        style={{
          filter:
            step === 'ITEM_CARD'
              ? 'brightness(0.28) blur(2px)'
              : STICKER_OUTLINE_FILTER,
          transition: 'filter 320ms ease, opacity 320ms ease, transform 320ms ease',
        }}
        className={`pointer-events-none absolute left-1/2 flex -translate-x-1/2 justify-center ${
          encounter.leftSpriteUrl.includes('/characters/cutouts/')
            ? 'top-[24%] h-[112%] items-start sm:top-[13%] sm:h-[126%]'
            : 'bottom-0 h-[58%] items-end sm:h-[76%]'
        } ${
          step === 'ITEM_CARD' ? 'z-10 scale-98 opacity-45' : 'z-20 scale-100 opacity-100'
        }`}
      >
        <img
          src={encounter.leftSpriteUrl}
          alt={speakerName}
          draggable={false}
          className="h-full w-auto max-w-none select-none"
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
              className="text-[13.5px] font-bold leading-relaxed text-[#1b1d22] sm:text-[15px]"
            >
              {characterLine}
            </p>

            {hasItem ? (
              <div className="mt-2.5 flex items-center justify-between text-[11px] font-extrabold text-amber-800">
                <span>
                  ✦ {tr('화면을 클릭해 전리품 성물 확인', 'Tap anywhere to inspect obtained relic')}
                </span>
                <span className="animate-bounce text-xs text-[#1b1d22]">▼</span>
              </div>
            ) : (
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-3.5 flex flex-wrap items-center justify-end gap-2 border-t border-stone-300/80 pt-3"
              >
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
