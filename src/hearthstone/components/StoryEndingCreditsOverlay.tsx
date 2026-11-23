import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { HsGoldCoinIcon } from './CardVisual';
import { getSnsLogoUrl, SnsRankMedallion } from './SnsHeroArtKit';
import { useRegisterNarrationOverlay } from '../services/narrationVisibility';
import { MatchRewardBreakdown } from '../types';

const EP40_CUTSCENES = [
  '/webtoon-assets/episode_40/scene_00.webp',
  '/webtoon-assets/episode_40/scene_05.webp',
  '/webtoon-assets/episode_40/scene_12.webp',
  '/webtoon-assets/episode_40/scene_19.webp',
  '/webtoon-assets/episode_40/scene_26.webp',
  '/webtoon-assets/episode_40/scene_33.webp',
  '/webtoon-assets/episode_40/scene_40.webp',
  '/webtoon-assets/episode_40/scene_46.webp',
  '/webtoon-assets/episode_40/scene_50.webp',
  '/webtoon-assets/episode_40/scene_52.webp',
] as const;

export interface StoryEndingCreditsOverlayProps {
  outcomeSummary: MatchRewardBreakdown | null;
  onContinueStory: () => void;
}

export const StoryEndingCreditsOverlay: React.FC<StoryEndingCreditsOverlayProps> = ({
  outcomeSummary,
  onContinueStory,
}) => {
  useRegisterNarrationOverlay(true);
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';

  const [phase, setPhase] = useState<'CREDITS' | 'COMPLETE_POPUP'>('CREDITS');
  const [slideIdx, setSlideIdx] = useState(0);
  const [remainingMs, setRemainingMs] = useState(3000);
  const firedRef = useRef(false);
  const onContinueStoryRef = useRef(onContinueStory);
  onContinueStoryRef.current = onContinueStory;

  const slideDurationMs = useMemo(() => {
    if (typeof window === 'undefined') return 2400;
    const raw = new URLSearchParams(window.location.search).get('endingCreditSec');
    const sec = raw ? Number(raw) : NaN;
    if (!Number.isNaN(sec) && sec > 0 && sec <= 120) {
      return Math.max(120, Math.round((sec * 1000) / EP40_CUTSCENES.length));
    }
    return 2400;
  }, []);

  const creditSections = useMemo(
    () => [
      {
        labelKo: '제40화 대단원 완결',
        labelEn: 'EPISODE 40 FINALE COMPLETE',
        titleKo: '엘윈마을과 카단의 여정',
        titleEn: "Elwin Village & Kadan's Journey",
        subKo: '여명에서 별빛까지 이어진 40화의 서사시',
        subEn: 'A 40-Episode Saga from Dawn to Starlight',
      },
      {
        labelKo: '주요 등장인물',
        labelEn: 'STARRING HEROES',
        titleKo: '카단 · 실리아 · 엘윈마을 수호자',
        titleEn: 'Kadan · Silia · Guardians of Elwin',
        subKo: '아라크네 · 바람신 토람 · 이그니스와 9종족 용사들',
        subEn: 'Arachne · Wind God Toram · Ignis & Champions of 9 Factions',
      },
      {
        labelKo: '원작 스토리 · 연출 · 일러스트',
        labelEn: 'STORY · DIRECTION · ARTWORK',
        titleKo: 'SNSHero 제작진 & 스튜디오',
        titleEn: 'SNSHero Team & Studio',
        subKo: '제40화 웹툰 컷신 · 오카리나 리듬 배틀 시스템',
        subEn: 'Episode 40 Webtoon Cutscenes · Ocarina Rhythm Battle',
      },
      {
        labelKo: '모험가님께 감사드립니다',
        labelEn: 'THANK YOU FOR PLAYING',
        titleKo: '끝나지 않는 엘윈의 새로운 윤회',
        titleEn: 'A New Reincarnation Awaits in Elwin',
        subKo: '더 강해진 3장=3배 각성 덱과 함께 다음 환생으로!',
        subEn: 'Carry your 3x Awakening collection into the next Reincarnation!',
      },
    ],
    [],
  );

  // Start lyrical Ending Credits music & cycle Ep.40 webtoon cutscenes
  useEffect(() => {
    hsAudio.startEndingCreditsMusic();
    return () => {
      hsAudio.stopEndingCreditsMusic();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'CREDITS') return;
    const id = window.setInterval(() => {
      setSlideIdx((prev) => {
        if (prev + 1 >= EP40_CUTSCENES.length) {
          window.clearInterval(id);
          hsAudio.playSfx('zelda_chest_open', 0.85);
          setRemainingMs(3000);
          setPhase('COMPLETE_POPUP');
          return prev;
        }
        return prev + 1;
      });
    }, slideDurationMs);

    return () => window.clearInterval(id);
  }, [phase, slideDurationMs]);

  const handleSkipCredits = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (phase !== 'CREDITS') return;
      hsAudio.playSfx('ui_click', 0.8);
      hsAudio.playSfx('zelda_chest_open', 0.85);
      setRemainingMs(3000);
      setPhase('COMPLETE_POPUP');
    },
    [phase],
  );

  const handleProceedNextJourney = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    hsAudio.stopEndingCreditsMusic();
    hsAudio.playSfx('box_press', 0.9);
    onContinueStoryRef.current();
  }, []);

  // Phase 2: Auto-continue 3s countdown when COMPLETE_POPUP is active
  useEffect(() => {
    if (phase !== 'COMPLETE_POPUP') return;
    const startTs = Date.now();
    const id = window.setInterval(() => {
      const elapsed = Date.now() - startTs;
      const next = Math.max(0, 3000 - elapsed);
      setRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(id);
        handleProceedNextJourney();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, handleProceedNextJourney]);

  const reincNum = Math.max(1, outcomeSummary?.nextReincarnation || 1);
  const goldEarned = outcomeSummary?.goldEarned ?? 370;
  const packsEarned = outcomeSummary?.packsEarned ?? 3;
  const activeCredit =
    creditSections[
      Math.min(
        creditSections.length - 1,
        Math.floor((slideIdx / EP40_CUTSCENES.length) * creditSections.length),
      )
    ];

  const overlayNode = (
    <div
      data-testid={
        phase === 'CREDITS'
          ? 'story-ending-credits-overlay'
          : 'story-complete-reincarnation-popup'
      }
      className="fixed inset-0 z-[120] flex flex-col justify-between overflow-hidden bg-[#07060b] select-none"
    >
      {/* Animated Episode 40 Webtoon Cutscene Backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {EP40_CUTSCENES.map((src, idx) => {
          const isActive = idx === slideIdx;
          return (
            <img
              key={src}
              src={src}
              alt={tr(`제40화 엔딩 컷신 ${idx + 1}`, `Episode 40 Ending Cutscene ${idx + 1}`)}
              style={{
                opacity: isActive ? 0.88 : 0,
                transform: isActive ? 'scale(1.06)' : 'scale(1)',
                transition: 'opacity 750ms ease, transform 2800ms ease-out',
              }}
              className="absolute inset-0 h-full w-full object-contain sm:object-cover"
            />
          );
        })}
        <div
          style={{
            background:
              'linear-gradient(180deg, rgba(7,6,11,0.82) 0%, rgba(7,6,11,0.18) 28%, rgba(7,6,11,0.22) 60%, rgba(7,6,11,0.94) 100%)',
          }}
          className="absolute inset-0"
        />
      </div>

      {/* Top Header with Skip Button (Always Accessible on Top!) */}
      <header className="relative z-30 mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="flex min-w-0 items-center gap-2 rounded-full border border-amber-300/50 bg-stone-950/85 px-3 py-1.5 text-[11px] font-extrabold text-amber-100 shadow-lg sm:text-xs">
          <span className="animate-pulse text-yellow-300">🎵</span>
          <span className="truncate">
            {tr('EP.40 대단원 엔딩 크레딧', 'EP.40 FINALE · ENDING CREDITS')}
          </span>
          <span className="shrink-0 rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] text-yellow-200">
            {slideIdx + 1}/{EP40_CUTSCENES.length}
          </span>
        </div>

        {phase === 'CREDITS' && (
          <button
            type="button"
            data-testid="ending-credits-skip-btn"
            onClick={handleSkipCredits}
            className="hs-brass-btn min-h-[44px] shrink-0 rounded-xl border border-yellow-300/70 bg-stone-950/90 px-4 py-2 text-xs font-black text-yellow-200 shadow-xl transition hover:border-yellow-200 hover:text-white sm:text-sm"
          >
            {tr('엔딩크레딧 스킵 ▸▸', 'Skip Credits ▸▸')}
          </button>
        )}
      </header>

      {/* Phase 1: Simple Elegant Ending Credits Footer */}
      {phase === 'CREDITS' && (
        <main className="relative z-20 mx-auto mb-5 flex w-full max-w-2xl flex-col items-center px-4 text-center sm:mb-8">
          <img
            src={getSnsLogoUrl(lang)}
            alt={tr('눈히어로', 'SNSHero')}
            draggable={false}
            className="mb-2.5 h-10 w-auto object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.95)] sm:h-12"
          />

          <div className="w-full rounded-2xl border border-amber-300/45 bg-stone-950/82 px-5 py-4 shadow-[0_14px_40px_rgba(0,0,0,0.85)] backdrop-blur-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-yellow-300">
              {isKo ? activeCredit.labelKo : activeCredit.labelEn}
            </div>
            <h2 className="hs-title hs-outline-sm mt-1 text-xl font-extrabold text-white sm:text-2xl">
              {isKo ? activeCredit.titleKo : activeCredit.titleEn}
            </h2>
            <p className="mt-1 text-xs font-bold text-amber-100/90 sm:text-sm">
              {isKo ? activeCredit.subKo : activeCredit.subEn}
            </p>

            {/* Thin Cutscene Progress Bar */}
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
              <div
                style={{
                  width: `${Math.round(((slideIdx + 1) / EP40_CUTSCENES.length) * 100)}%`,
                }}
                className="h-full bg-gradient-to-r from-amber-400 via-yellow-200 to-sky-300 transition-all duration-500"
              />
            </div>
          </div>
        </main>
      )}

      {/* Phase 2: Story Mode Completion & Reincarnation Rewards Popup (Click or 3s -> Continue Story Mode) */}
      {phase === 'COMPLETE_POPUP' && (
        <div
          onClick={handleProceedNextJourney}
          className="fixed inset-0 z-40 flex cursor-pointer items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-5"
        >
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleProceedNextJourney();
            }}
            className="hs-wood-panel relative flex max-h-[92dvh] w-full max-w-md flex-col items-center overflow-y-auto rounded-3xl border-2 border-yellow-300/80 p-5 text-center text-amber-100 shadow-[0_24px_64px_rgba(0,0,0,0.95)] sm:p-6"
          >
            {/* 3-Second Auto-Continue Progress Bar */}
            <div className="absolute left-0 right-0 top-0 h-1.5 bg-stone-900">
              <div
                style={{
                  width: `${Math.min(100, ((3000 - remainingMs) / 3000) * 100)}%`,
                }}
                className="h-full bg-gradient-to-r from-emerald-400 via-yellow-300 to-amber-400 transition-all duration-100"
              />
            </div>

            <SnsRankMedallion
              rank={0}
              size={64}
              className="mt-1 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]"
            />

            <div className="mt-2 rounded-full border border-purple-300/70 bg-purple-950/90 px-3 py-0.5 text-[11px] font-black text-purple-200">
              ✦ {tr(`환생 ${reincNum}회차 개방!`, `Reincarnation #${reincNum} Unlocked!`)}
            </div>

            <h2 className="hs-title hs-outline mt-2 text-2xl font-extrabold text-yellow-300 sm:text-3xl">
              {tr('스토리모드 40화 완결!', 'Story Mode Complete!')}
            </h2>
            <p className="mt-1 text-xs font-bold text-amber-100/90">
              {tr(
                '엘윈마을과 카단의 여정 1화~40화를 모두 정복했습니다.',
                'All 40 episodes of Elwin Village & Kadan conquered!',
              )}
            </p>

            {/* Clear Gold + Card Pack Summary */}
            <div className="hs-ocarina-dialog mt-3 w-full space-y-1.5 rounded-2xl p-3 text-left text-xs">
              <div className="flex items-center justify-between font-extrabold">
                <span className="text-amber-100">{tr('40화 완주 골드 보상', 'Ep.40 Clear Gold')}</span>
                <span className="flex items-center gap-1 text-yellow-300">
                  <HsGoldCoinIcon size={16} />+{goldEarned.toLocaleString()}G
                </span>
              </div>
              {packsEarned > 0 && (
                <div className="flex items-center justify-between font-extrabold text-emerald-300">
                  <span>🎁 {tr('대단원 특전 카드팩', 'Finale Bonus Packs')}</span>
                  <span>
                    +{packsEarned} {tr('팩', 'Packs')}
                  </span>
                </div>
              )}
            </div>

            {/* Reincarnation Permanent Bonus Effects */}
            <div
              data-testid="reincarnation-effects-card"
              className="mt-2.5 w-full rounded-2xl border border-amber-300/55 bg-stone-950/90 p-3 text-left text-[11.5px]"
            >
              <div className="mb-1.5 font-black text-yellow-300">
                ✦ {tr(`환생 ${reincNum}회차 보상 효과`, `Reincarnation #${reincNum} Perks`)}
              </div>
              <ul className="space-y-1 font-bold text-amber-50/95">
                <li>
                  • {tr('승리 골드 영구 증가:', 'Permanent Win Gold Bonus:')}{' '}
                  <span className="text-yellow-300">+{reincNum * 35}G</span>
                </li>
                <li>
                  • {tr('3장=3배 각성 컬렉션:', '3x Awakening Collection:')}{' '}
                  <span className="text-emerald-300">{tr('100% 영구 계승', '100% Kept')}</span>
                </li>
                <li>
                  • {tr('신규 환생 여정:', 'New Cycle Unlocked:')}{' '}
                  <span className="text-sky-300">
                    {tr(`환생 ${reincNum}회차 제1화~40화 도전`, `Run #${reincNum} EP.1–40`)}
                  </span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              data-testid="story-complete-continue-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleProceedNextJourney();
              }}
              className="hs-zelda-a-btn mt-4 min-h-[48px] w-full rounded-2xl px-4 py-2.5 text-sm font-black text-white shadow-xl"
            >
              {tr(
                `▶ 클릭하거나 ${Math.max(1, Math.ceil(remainingMs / 1000))}초 후 제1화 진행`,
                `▶ Click or Continuing to EP.1 in ${Math.max(1, Math.ceil(remainingMs / 1000))}s`,
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(overlayNode, document.body);
  }
  return overlayNode;
};
