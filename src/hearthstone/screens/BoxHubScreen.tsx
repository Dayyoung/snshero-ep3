import React, { useEffect, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { getRankTitle } from '../i18nData';
import { hsAudio } from '../audio';
import { CLASSIC_RANK_NAMES, CLASS_CREST_URL } from '../cardDb';
import { HsArcaneDustVialIcon, HsGoldCoinIcon } from '../components/CardVisual';
import { QuickRulesModal, hasSeenQuickRules } from '../components/OnboardingGuideModal';
import { PwaInstallGuideModal } from '../components/PwaInstallGuideModal';
import {
  SNS_LOCATIONS,
  getElwinTimeOfDayTheme,
  getSnsLogoUrl,
  SnsBoosterPackArt,
  SnsQuestScrollIcon,
  SnsSnowCompassSeal,
} from '../components/SnsHeroArtKit';
import { getJourneyEpisodeShortTitle } from '../journeyEpisodeTitles';
import {
  canInstallGamePwa,
  isBrowserFullscreen,
  isFullscreenSupported,
  isStandalonePwa,
  promptInstallGamePwa,
  shouldShowInstallButton,
  subscribePwaFullscreen,
  toggleBrowserFullscreen,
} from '../pwaFullscreen';
import { computeOverallStanding, getEquippedPrestigeSummary, hsStorage } from '../storage';
import { GameMode, PlayerProfile } from '../types';

export interface BoxHubScreenProps {
  profile: PlayerProfile;
  onSelectPlayMode: (mode: GameMode) => void;
  onOpenCollection: () => void;
  onOpenPacks: () => void;
  onOpenQuestLog: () => void;
  onOpenShop: () => void;
  onOpenOptions: () => void;
}

let hubBoxOpenedInSession = false;

export const BoxHubScreen: React.FC<BoxHubScreenProps> = ({
  profile,
  onSelectPlayMode,
  onOpenCollection,
  onOpenPacks,
  onOpenQuestLog,
  onOpenShop,
  onOpenOptions,
}) => {
  const { lang } = useHeroLanguage();
  const [doorsOpening, setDoorsOpening] = useState(() => !hubBoxOpenedInSession);
  const [trayReady, setTrayReady] = useState(() => hubBoxOpenedInSession);
  const [diskSpinning, setDiskSpinning] = useState(false);
  const [quickRulesOpen, setQuickRulesOpen] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [inAppDismissed, setInAppDismissed] = useState(false);
  const [saveBannerDismissed, setSaveBannerDismissed] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [, setPwaTick] = useState(0);
  const unlockInfo = hsStorage.getHubUnlockStage(profile);
  const isFirstVisitGuide = !profile.journeyGuideDone && !unlockInfo.veteranUnlockedAll;
  const isStage3Unlocked = unlockInfo.stage >= 3 || unlockInfo.veteranUnlockedAll;
  const isStage4Unlocked = unlockInfo.stage >= 4 || unlockInfo.veteranUnlockedAll;
  const qualifiesForSanctuarySave =
    !isFirstVisitGuide &&
    !saveBannerDismissed &&
    !hsStorage.isSafeguardBonusClaimed() &&
    (profile.gold >= 1000 ||
      profile.rankedWins >= 3 ||
      profile.totalWins >= 3 ||
      (profile.prestige?.ownedTitles?.length || 1) > 1 ||
      (profile.prestige?.ownedBadges?.length || 1) > 1 ||
      (profile.prestige?.ownedFrames?.length || 1) > 1);
  const quests = hsStorage.getQuests();
  const incompleteQuestsCount = quests.filter((q) => !q.completed).length;
  const remainingExpertAiCount = Math.max(0, 9 - (profile.practiceExpertCleared?.length || 0));
  const isInAppWebView =
    typeof navigator !== 'undefined' &&
    /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line|YouTube/i.test(navigator.userAgent || '');
  const isAndroidUa =
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

  useEffect(() => {
    try {
      localStorage.setItem('snshero_has_played', '1');
    } catch {
      // ignore storage quota errors
    }
    hsAudio.playBgm('tavern_hub');
    const unsub = subscribePwaFullscreen(() => setPwaTick((n) => n + 1));
    const onSettingsChanged = () => setPwaTick((n) => n + 1);
    window.addEventListener('snshero:settings-changed', onSettingsChanged);
    if (!hubBoxOpenedInSession) {
      hubBoxOpenedInSession = true;
      hsAudio.playSfx('box_open', 0.85);
      const tTray = window.setTimeout(() => setTrayReady(true), 260);
      const tDoors = window.setTimeout(() => setDoorsOpening(false), 880);
      return () => {
        unsub();
        window.removeEventListener('snshero:settings-changed', onSettingsChanged);
        window.clearTimeout(tTray);
        window.clearTimeout(tDoors);
      };
    }
    return () => {
      unsub();
      window.removeEventListener('snshero:settings-changed', onSettingsChanged);
    };
  }, []);

  const replayBoxUnlatch = () => {
    if (doorsOpening) return;
    hsAudio.playSfx('box_open', 0.85);
    setTrayReady(false);
    setDoorsOpening(true);
    window.setTimeout(() => setTrayReady(true), 240);
    window.setTimeout(() => setDoorsOpening(false), 880);
  };

  const fullscreenActive = isBrowserFullscreen() || isStandalonePwa();
  const showFullscreenBtn = isFullscreenSupported() && !isStandalonePwa();
  const showInstallBtn = shouldShowInstallButton();

  const triggerModeTransition = (mode: GameMode) => {
    if (diskSpinning) return;
    if (isFirstVisitGuide && mode !== 'TUTORIAL') return;
    if (mode === 'TUTORIAL' && isFirstVisitGuide) {
      hsStorage.markJourneyGuideDone();
    }
    if (mode === 'BOGART_GAMBLE') {
      hsAudio.playSfx('bogart_wager', 0.9);
    } else if (mode === 'RANKED') {
      hsAudio.playSfx('gem_a_confirm', 0.9);
    } else {
      hsAudio.playSfx('ocarina_chime', 0.85);
    }
    hsAudio.playSfx('box_disk_flip', 0.85);
    setDiskSpinning(true);
    window.setTimeout(() => {
      setDiskSpinning(false);
      onSelectPlayMode(mode);
    }, 340);
  };

  const rankTitle = getRankTitle(profile.rank, CLASSIC_RANK_NAMES, lang);
  const standing = computeOverallStanding(profile);
  const timeTheme = getElwinTimeOfDayTheme();
  const equippedPrestige = getEquippedPrestigeSummary(profile, lang === 'ko');
  const lockedBtnStyle = isFirstVisitGuide
    ? 'pointer-events-none cursor-not-allowed opacity-40 saturate-[0.35]'
    : '';
  const epTitle = getJourneyEpisodeShortTitle(profile.journeyEpisode ?? 0, lang === 'ko');

  return (
    <div
      style={{ backgroundImage: `url(${SNS_LOCATIONS.BOX_TABLE})` }}
      className="relative flex h-full w-full select-none flex-col items-center justify-between overflow-y-auto bg-cover bg-center px-2.5 py-2 sm:overflow-hidden sm:p-5"
    >
      {/* DEV-030: Ocarina of Time Dynamic Time-of-Day Sky Lighting Overlay */}
      <div
        style={{ background: timeTheme.skyOverlay }}
        className="pointer-events-none absolute inset-0"
      />
      {/* Warm Sanctuary Radiance Vignette */}
      <div
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(254,240,138,0.16) 0%, rgba(15,28,62,0.34) 60%, rgba(6,11,26,0.78) 100%)',
        }}
        className="pointer-events-none absolute inset-0"
      />

      {/* Top Brass HUD Bar */}
      <header className="relative z-20 flex w-full max-w-6xl flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <a
            href="/"
            onClick={() => hsAudio.playSfx('ui_click', 0.6)}
            title={tr('눈히어로 공식 소개 (/)', 'SNSHero Official Showcase (/)')}
            className="flex items-center rounded-xl px-1.5 py-1 transition hover:scale-105"
          >
            <img
              src={getSnsLogoUrl(lang)}
              alt={tr('눈히어로', 'SNSHero')}
              draggable={false}
              className="h-9 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)] sm:h-11"
            />
          </a>
          <button
            type="button"
            data-testid="hub-prestige-identity-pill"
            onClick={() => {
              if (isFirstVisitGuide) return;
              hsAudio.playSfx('gem_c_select');
              onOpenShop();
            }}
            className="hs-ocarina-dialog hs-mario-spring hidden min-h-[38px] items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold text-amber-100 md:inline-flex"
          >
            <span>{equippedPrestige.badgeIcon}</span>
            <span className="text-yellow-300">〈{equippedPrestige.titleText}〉</span>
            <span className="text-sky-300/80">· {timeTheme.icon} {lang === 'ko' ? timeTheme.labelKo : timeTheme.labelEn}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            disabled={isFirstVisitGuide}
            onClick={() => {
              if (isFirstVisitGuide) return;
              hsAudio.playSfx('ui_click');
              onOpenShop();
            }}
            onMouseEnter={() => !isFirstVisitGuide && hsAudio.playSfx('box_hover', 0.5)}
            className={`hs-brass-btn flex min-h-[42px] items-center gap-2 rounded-xl px-2.5 py-1.5 sm:gap-3 sm:px-3.5 sm:py-2 ${lockedBtnStyle}`}
          >
            <span className="flex items-center gap-1">
              <HsGoldCoinIcon size={18} />
              <span className="hs-num text-xs text-yellow-300 sm:text-base">{profile.gold}</span>
            </span>
            <span className="h-3.5 w-[1px] bg-amber-400/35 sm:h-4" />
            <span className="flex items-center gap-1">
              <HsArcaneDustVialIcon size={17} />
              <span className="hs-num text-xs text-sky-200 sm:text-sm">{profile.arcaneDust}</span>
            </span>
          </button>

          {showInstallBtn && (
            <button
              type="button"
              data-testid="hub-pwa-install-btn"
              onClick={async () => {
                hsAudio.playSfx('ui_click');
                if (canInstallGamePwa()) {
                  const accepted = await promptInstallGamePwa();
                  if (!accepted) {
                    setInstallGuideOpen(true);
                  }
                } else {
                  setInstallGuideOpen(true);
                }
              }}
              className="hs-arcane-btn flex min-h-[42px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-white sm:px-3 sm:py-2"
            >
              <span>📲</span>
              <span>{tr('게임설치', 'Install Game')}</span>
            </button>
          )}

          {showFullscreenBtn && (
            <button
              type="button"
              data-testid="hub-fullscreen-btn"
              onClick={() => {
                hsAudio.playSfx('ui_click');
                toggleBrowserFullscreen();
              }}
              onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
              title={
                fullscreenActive
                  ? tr('전체화면 해제', 'Exit Fullscreen')
                  : tr('전체화면 전환 (프레임·성능 향상)', 'Enter Fullscreen (Performance Boost!)')
              }
              className={`hs-brass-btn hs-mario-spring relative flex min-h-[44px] items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition sm:px-3 sm:py-2 ${
                fullscreenActive
                  ? 'text-sky-200 border-sky-400/70'
                  : 'border-emerald-300/85 text-amber-100 shadow-[0_0_16px_rgba(52,211,153,0.45)]'
              }`}
            >
              <span className={fullscreenActive ? 'text-sky-300' : 'text-emerald-300'}>
                {fullscreenActive ? '🗗' : '⛶'}
              </span>
              <span className="hidden sm:inline">
                {fullscreenActive ? tr('창모드', 'Windowed') : tr('전체화면', 'Fullscreen')}
              </span>
              {!fullscreenActive && (
                <span
                  data-testid="hub-fullscreen-boost-badge"
                  className="rounded-full border border-yellow-200/80 bg-gradient-to-b from-emerald-400 to-emerald-700 px-1.5 py-0.5 text-[9.5px] font-black leading-none text-stone-950 shadow"
                >
                  {tr('성능Up!', 'FPS Up!')}
                </span>
              )}
            </button>
          )}

          {!isStage4Unlocked && (
            <button
              type="button"
              data-testid="hub-unlock-all-btn"
              onClick={() => {
                hsAudio.playSfx('zelda_secret', 0.85);
                hsStorage.setVeteranUnlockAll(true);
                setSaveToast(
                  tr(
                    '🔓 숙련자 모드 활성화: 모든 플레이 모드와 메뉴가 즉시 개방되었습니다!',
                    '🔓 Veteran Mode Active: All play modes & menus unlocked!',
                  ),
                );
                window.setTimeout(() => setSaveToast(null), 3600);
              }}
              className="hs-zelda-c-btn hs-mario-spring flex min-h-[42px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-stone-950 shadow sm:px-3 sm:py-2"
              title={tr(
                `현재 진행 ${unlockInfo.stage}/4단계 · 클릭하여 전체 메뉴 즉시 열기`,
                `Stage ${unlockInfo.stage}/4 · Click to unlock all modes immediately`,
              )}
            >
              <span>🔓</span>
              <span>{tr('전체 메뉴 열기', 'Unlock All')}</span>
            </button>
          )}

          <button
            type="button"
            data-testid="hub-rules-btn"
            onClick={() => {
              hsAudio.playSfx('ui_click');
              setQuickRulesOpen(true);
            }}
            onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
            className="hs-brass-btn flex min-h-[42px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-amber-100 sm:px-3 sm:py-2"
          >
            <span className="text-amber-300">?</span>
            <span>{tr('게임 방법', 'How to Play')}</span>
          </button>

          <button
            type="button"
            data-testid="hub-options-btn"
            onClick={() => {
              hsAudio.playSfx('open_menu');
              onOpenOptions();
            }}
            onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
            className="hs-brass-btn flex min-h-[42px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-amber-100 sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-sm"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-amber-300">
              <path
                d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1.51 1 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth="1.9"
              />
            </svg>
            <span>{tr('메뉴', 'Options')}</span>
          </button>
        </div>
      </header>

      {/* Centerpiece: THE SNSHERO BOX */}
      <main className="relative z-20 my-auto flex w-full max-w-[820px] flex-col items-center pt-3 sm:pt-0">
        {/* MKT-030: In-App WebView Escape & Data Protection Banner */}
        {isInAppWebView && !inAppDismissed && (
          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-amber-300/80 bg-[#1c1008]/95 px-3.5 py-2 text-xs font-extrabold text-amber-100 shadow-xl">
            <span className="min-w-0 flex-1">
              📲{' '}
              {tr(
                '인앱 브라우저에서는 덱 데이터(hero_hs_*)가 초기화될 수 있습니다! 크롬/사파리로 열어 보호하세요 (+PWA 설치 시 100G)',
                'In-app browser may clear local data! Open in Chrome/Safari to protect your decks (+100G on PWA install)',
              )}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              {isAndroidUa ? (
                <a
                  href={`intent://${typeof window !== 'undefined' ? window.location.host + window.location.pathname + window.location.search : 'snshero.com/game'}#Intent;scheme=https;package=com.android.chrome;end`}
                  className="hs-gold-btn rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                >
                  {tr('크롬으로 열기', 'Open in Chrome')}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                    } catch {
                      // ignore clipboard error
                    }
                    setInstallGuideOpen(true);
                  }}
                  className="hs-gold-btn rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
                >
                  {tr('사파리 URL 복사', 'Copy Safari URL')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setInAppDismissed(true)}
                className="rounded-lg border border-amber-400/40 bg-black/50 px-2 py-1 text-[10px] text-amber-200"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* MKT-066(1): First Prestige Badge (300G) 83% Endowed Progress Coaching Strip */}
        {!isFirstVisitGuide &&
          profile.gold >= 200 &&
          profile.gold < 300 &&
          (profile.prestige?.ownedBadges?.length || 1) <= 1 && (
            <div
              data-testid="hub-first-badge-progress-strip"
              className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300/75 bg-amber-950/88 px-3.5 py-1.5 text-[11px] font-extrabold text-amber-100 shadow-lg"
            >
              <span>
                🛡️{' '}
                {tr(
                  `첫 명예 프로필 배지(300G) 해금 임박! (${profile.gold}G / 300G — ${Math.round((profile.gold / 300) * 100)}% 달성 · 단 ${300 - profile.gold}G 남음!)`,
                  `First Prestige Badge (300G) Almost Unlocked! (${profile.gold}G / 300G — ${Math.round((profile.gold / 300) * 100)}% · Only ${300 - profile.gold}G left!)`,
                )}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => triggerModeTransition('TUTORIAL')}
                  className="rounded-lg border border-yellow-300/80 bg-amber-500 px-2.5 py-0.5 text-[10.5px] font-black text-stone-950 hover:bg-amber-400"
                >
                  {tr('⚔ 스토리 출격', '⚔ Story Clear')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      sessionStorage.setItem('snshero_bogart_stake', String(Math.max(50, 300 - profile.gold)));
                    } catch {
                      // ignore
                    }
                    triggerModeTransition('BOGART_GAMBLE');
                  }}
                  className="rounded-lg border border-sky-300/70 bg-sky-900/90 px-2.5 py-0.5 text-[10.5px] font-extrabold text-sky-100 hover:bg-sky-800"
                >
                  {tr(`🎲 도박장 +${Math.max(50, 300 - profile.gold)}G 도전`, `🎲 Bogart +${Math.max(50, 300 - profile.gold)}G`)}
                </button>
              </div>
            </div>
          )}

        {/* MKT-018: Daily Quest & Expert AI 9-Faction (+2 Packs) Quick Briefing */}
        {!isFirstVisitGuide && (incompleteQuestsCount > 0 || remainingExpertAiCount > 0) && (
          <div className="mb-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-full border border-sky-400/45 bg-sky-950/75 px-3.5 py-1 text-[11px] font-extrabold text-sky-100 shadow-lg">
            <span>
              🌙{' '}
              {tr(
                `일일 의뢰 ${incompleteQuestsCount}건 진행 가능 · 숙련 AI ${9 - remainingExpertAiCount}/9종족 격파 (올클리어 시 무료 +2팩!)`,
                `${incompleteQuestsCount} Daily Quest(s) active · Expert AI ${9 - remainingExpertAiCount}/9 cleared (+2 Packs for sweep!)`,
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                hsAudio.playSfx('ui_click');
                onOpenQuestLog();
              }}
              className="rounded-full border border-sky-300/60 bg-sky-800/80 px-2.5 py-0.5 text-[10.5px] font-extrabold text-white hover:bg-sky-700"
            >
              {tr('의뢰 확인 →', 'View Quests →')}
            </button>
          </div>
        )}

        {saveToast && (
          <div
            data-testid="hub-toast-banner"
            className="mb-2 w-full rounded-2xl border border-emerald-300/80 bg-emerald-950/95 px-3.5 py-2 text-center text-xs font-extrabold text-emerald-100 shadow-lg"
          >
            {saveToast}
          </div>
        )}

        {/* DEV-034: Guest Sanctuary Save Engraving Banner (1,000G / 3 Ranked Wins / Prestige Unlock) */}
        {qualifiesForSanctuarySave && (
          <div
            data-testid="hub-sanctuary-save-banner"
            className="hs-ocarina-dialog mb-2 flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-xs font-extrabold text-amber-100 shadow-xl"
          >
            <span className="min-w-0 flex-1">
              📜{' '}
              {tr(
                '엘윈 성소 기록 각인: 보유 골드·치장품·전적을 백업 코드로 1초 복사하고 +100G 시드머니를 받으세요!',
                'Sanctuary Record Seal: Copy your encrypted save backup code in 1 tap & claim +100G bonus!',
              )}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                data-testid="hub-sanctuary-save-copy-btn"
                onClick={async () => {
                  hsAudio.playSfx('mario_coin', 0.9);
                  const { jsonString } = hsStorage.exportGameBackupData();
                  try {
                    await navigator.clipboard.writeText(jsonString);
                  } catch {
                    hsStorage.downloadGameBackupFile();
                  }
                  const bonus = hsStorage.claimSafeguardBackupBonus();
                  setSaveBannerDismissed(true);
                  setSaveToast(
                    bonus.granted
                      ? tr(
                          '📜 성소 백업 코드 복사 완료! 보호 보너스 +100G가 즉시 지급되었습니다.',
                          '📜 Sanctuary backup code copied! +100G safeguard bonus granted.',
                        )
                      : tr(
                          '📜 성소 백업 코드가 클립보드에 복사되었습니다.',
                          '📜 Sanctuary backup code copied to clipboard.',
                        ),
                  );
                  window.setTimeout(() => setSaveToast(null), 4000);
                }}
                className="hs-zelda-a-btn min-h-[38px] rounded-xl px-3 py-1 text-[11px] font-extrabold text-white"
              >
                {tr('📜 백업 복사 (+100G)', '📜 Copy Save (+100G)')}
              </button>
              <button
                type="button"
                onClick={() => setSaveBannerDismissed(true)}
                aria-label={tr('닫기', 'Dismiss')}
                className="min-h-[38px] min-w-[38px] rounded-xl border border-amber-400/40 bg-black/45 px-2 text-[11px] text-amber-200"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {isFirstVisitGuide && (
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 rounded-full border-2 border-emerald-300 bg-gradient-to-r from-emerald-950/95 via-teal-900/95 to-emerald-950/95 px-4 py-1.5 text-center text-xs font-extrabold text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.55)] sm:text-sm">
            <span>
              {tr('✨ Stage 1/4 첫 모험 가이드: 아래 ', '✨ Stage 1/4 First Quest: Tap ')}
              <b className="text-yellow-300">{tr('「스토리모드」', '“Story Mode”')}</b>
              {tr('로 시작하세요!', ' below to begin!')}
            </span>
          </div>
        )}

        <div
          style={{ perspective: '1600px' }}
          className="hs-wood-panel relative flex w-full flex-col items-center rounded-[28px] px-3.5 pb-4 pt-2 sm:rounded-[34px] sm:px-10 sm:pb-7 sm:pt-3"
        >
          {/* Carved Wooden Chest Relief Grain & Brass Corner Inlay */}
          <div
            style={{
              background:
                'radial-gradient(circle at 50% 44%, rgba(251,191,36,0.14) 0%, rgba(24,13,6,0.45) 58%, rgba(10,5,2,0.78) 100%)',
            }}
            className="pointer-events-none absolute inset-2 rounded-[22px] sm:rounded-[26px]"
          />

          <div className="pointer-events-none absolute inset-2.5 rounded-[20px] border-2 border-[#e2be75]/40 shadow-[inset_0_0_28px_rgba(0,0,0,0.8)] sm:inset-3 sm:rounded-[24px]" />

          {/* 4 Forged Brass Corner Rivets */}
          <div className="pointer-events-none absolute left-4 top-4 h-3 w-3 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:left-5 sm:top-5 sm:h-3.5 sm:w-3.5" />
          <div className="pointer-events-none absolute right-4 top-4 h-3 w-3 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:right-5 sm:top-5 sm:h-3.5 sm:w-3.5" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-3 w-3 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:bottom-5 sm:left-5 sm:h-3.5 sm:w-3.5" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-3 w-3 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:bottom-5 sm:right-5 sm:h-3.5 sm:w-3.5" />

          {/* Overhanging Official 눈히어로 Logo Crest (Click to Replay Chest Door Unlatch!) */}
          <button
            type="button"
            data-testid="hub-logo-replay-btn"
            onClick={replayBoxUnlatch}
            title={tr('클릭하여 성소 보관함 개폐 연출 다시 보기', 'Click to replay Sanctuary Box unlatch')}
            className="relative z-30 -mt-6 transition-transform hover:scale-[1.02] sm:-mt-11"
          >
            <img
              src={getSnsLogoUrl(lang)}
              alt={lang === 'ko' ? '눈히어로' : 'SNSHero'}
              draggable={false}
              className="w-[196px] drop-shadow-[0_14px_22px_rgba(0,0,0,0.94)] sm:w-[308px]"
            />
          </button>

          {/* Center 3D Rotating Brass & Ivory Medallion ("The Box" Turntable) */}
          <div
            style={{
              transform: diskSpinning
                ? 'perspective(950px) rotateY(90deg) scale(0.95)'
                : 'perspective(950px) rotateY(0deg) scale(1)',
              transition: 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="relative z-10 my-1 flex h-[284px] w-[284px] flex-col items-center justify-center rounded-full border-[5px] border-[#dfb96c] bg-radial from-[#f5e7c4] via-[#c7a467] to-[#5e4120] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.9),inset_0_0_30px_rgba(44,26,10,0.85)] sm:h-[360px] sm:w-[360px] sm:border-[6px] sm:p-6"
          >
            {/* Engraved Concentric Brass & Oak Turntable Rings */}
            <div
              style={{
                background:
                  'repeating-radial-gradient(circle at 50% 50%, rgba(74,44,17,0.12) 0px, rgba(74,44,17,0.12) 6px, rgba(255,243,214,0.08) 6px, rgba(255,243,214,0.08) 12px)',
              }}
              className="pointer-events-none absolute inset-1.5 rounded-full border border-[#6e481b]/45"
            />

            {/* Arcane Glow Ring around Turntable */}
            <svg
              viewBox="0 0 240 240"
              className="pointer-events-none absolute -inset-5 h-[calc(100%+40px)] w-[calc(100%+40px)] animate-[hsSlowSpin_32s_linear_infinite] rounded-full opacity-90 sm:-inset-6 sm:h-[calc(100%+48px)] sm:w-[calc(100%+48px)]"
            >
              <defs>
                <radialGradient id="hubTurntableGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="68%" stopColor="rgba(56,189,248,0)" />
                  <stop offset="86%" stopColor="rgba(56,189,248,0.45)" />
                  <stop offset="95%" stopColor="rgba(253,224,71,0.55)" />
                  <stop offset="100%" stopColor="rgba(56,189,248,0)" />
                </radialGradient>
              </defs>
              <circle cx="120" cy="120" r="116" fill="url(#hubTurntableGlow)" />
              <circle
                cx="120"
                cy="120"
                r="107"
                fill="none"
                stroke="rgba(186,230,253,0.55)"
                strokeWidth="1.8"
                strokeDasharray="12 9 3 9"
              />
            </svg>

            {/* 3 Identical-Height Beveled Ivory/Parchment Menu Plates */}
            <div className="relative z-10 flex w-full max-w-[218px] flex-col gap-2 sm:max-w-[248px] sm:gap-2.5">
              {/* 1. 실시간 랭킹대전 (1st Slot + Realtime! Badge) */}
              <button
                type="button"
                data-testid="hub-mode-ranked"
                disabled={isFirstVisitGuide}
                onMouseEnter={() => !isFirstVisitGuide && hsAudio.playSfx('box_hover', 0.55)}
                onClick={() => {
                  if (!isStage3Unlocked) {
                    hsStorage.setVeteranUnlockAll(true);
                  }
                  triggerModeTransition('RANKED');
                }}
                className={`hs-ivory-plate hs-mario-spring group relative flex h-[52px] w-full flex-col items-center justify-center rounded-2xl px-2.5 sm:h-[60px] sm:px-3.5 ${lockedBtnStyle} ${
                  !isFirstVisitGuide && !isStage3Unlocked ? 'opacity-85' : ''
                }`}
              >
                <span
                  data-testid="hub-ranked-realtime-badge"
                  className="pointer-events-none absolute -right-2 -top-2.5 z-20 flex items-center gap-1 rounded-full border border-emerald-200 bg-gradient-to-b from-emerald-400 via-emerald-500 to-teal-700 px-2 py-0.5 text-[9px] font-black tracking-wide text-stone-950 shadow-[0_3px_10px_rgba(16,185,129,0.65)] sm:text-[10px]"
                >
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-stone-950" />
                  Realtime!
                </span>
                <span className="hs-title whitespace-nowrap text-[14.5px] font-extrabold leading-tight tracking-normal text-[#0c4a6e] group-hover:text-[#1d4ed8] sm:text-[17px] sm:tracking-wide">
                  🏆 {tr('랭킹대전', 'Ranked Arena')}
                </span>
                <span className="mt-0.5 max-w-full truncate text-[9.5px] font-extrabold tracking-tight text-[#475569] sm:text-[10.5px]">
                  {tr('실시간 매칭 · 친선/골드 · 공식 전적', 'Live Matchmaking · Friendly/Gold · Ranked')}
                </span>
              </button>

              {/* 2. 보가트 도박장 + 9종족 수련 통합 (2nd Slot) */}
              <button
                type="button"
                data-testid="hub-mode-gamble"
                disabled={isFirstVisitGuide}
                onMouseEnter={() => !isFirstVisitGuide && hsAudio.playSfx('box_hover', 0.55)}
                onClick={() => {
                  if (!isStage4Unlocked) {
                    hsStorage.setVeteranUnlockAll(true);
                  }
                  triggerModeTransition('BOGART_GAMBLE');
                }}
                className={`hs-ivory-plate hs-mario-spring group relative flex h-[52px] w-full flex-col items-center justify-center rounded-2xl px-2.5 sm:h-[60px] sm:px-3.5 ${lockedBtnStyle} ${
                  !isFirstVisitGuide && !isStage4Unlocked ? 'opacity-85' : ''
                }`}
              >
                {!isFirstVisitGuide && !isStage4Unlocked && (
                  <span className="pointer-events-none absolute -right-2 -top-2 rounded-full border border-amber-200 bg-amber-900 px-1.5 py-0.5 text-[8.5px] font-black text-yellow-200 shadow">
                    {tr('일반 100G~ / 숙련 1,000G~', 'Normal 100G+ / Expert 1K+')}
                  </span>
                )}
                <span className="hs-title whitespace-nowrap text-[14.5px] font-extrabold leading-tight tracking-normal text-[#78350f] group-hover:text-[#b45309] sm:text-[17px] sm:tracking-wide">
                  🎲 {tr('보가트 도박장', "Bogart's Hall")}
                </span>
                <span className="mt-0.5 max-w-full truncate text-[9.5px] font-extrabold tracking-tight text-[#6b4826] sm:text-[10.5px]">
                  {tr('9종족 수련 · 주사위 자동배팅 100~12,000G', '9-Faction Trial · 2-Dice Auto-Bet 100–12K G')}
                </span>
              </button>

              {/* 3. Story Mode */}
              <div className="relative w-full">
                {isFirstVisitGuide && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-4 -top-5 z-30 flex animate-bounce items-center gap-1 rounded-full border-2 border-yellow-200 bg-gradient-to-b from-amber-400 to-amber-700 px-2.5 py-0.5 text-xs font-black text-stone-950 shadow-[0_6px_18px_rgba(0,0,0,0.9)] sm:-right-7 sm:-top-6 sm:px-3 sm:py-1 sm:text-sm"
                  >
                    <span className="text-base leading-none sm:text-lg">👈</span>
                    <span>{tr('클릭!', 'Click!')}</span>
                  </div>
                )}

                <button
                  type="button"
                  data-testid="hub-mode-story"
                  onMouseEnter={() => hsAudio.playSfx('box_hover', 0.55)}
                  onClick={() => triggerModeTransition('TUTORIAL')}
                  className={`hs-ivory-plate hs-mario-spring group relative flex h-[52px] w-full flex-col items-center justify-center rounded-2xl px-3 sm:h-[60px] sm:px-4 ${
                    isFirstVisitGuide
                      ? 'ring-4 ring-emerald-400 shadow-[0_0_26px_rgba(52,211,153,0.95)]'
                      : ''
                  }`}
                >
                  <span className="hs-title text-[15px] font-extrabold leading-tight tracking-wider text-[#14532d] group-hover:text-[#064e3b] sm:text-lg">
                    📖 {tr('스토리모드', 'Story Mode')}
                  </span>
                  <span className="mt-0.5 max-w-full truncate text-[9.5px] font-extrabold tracking-tight text-[#5c3d1e] sm:text-[10.5px]">
                    {profile.journeyReincarnation > 0
                      ? tr(`${profile.journeyReincarnation}환생 · `, `Reincarnation #${profile.journeyReincarnation} · `)
                      : ''}
                    {(profile.journeyEpisode ?? 0) === 0
                      ? tr(`에피소드 0 튜토리얼 · ${epTitle}`, `EP.0 Tutorial · ${epTitle}`)
                      : tr(`제${profile.journeyEpisode}화 ${epTitle} · 보스팩 보상`, `EP.${profile.journeyEpisode} ${epTitle} · Boss Pack`)}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Recessed Brass Drawer Tray */}
          <div
            style={{
              transform: trayReady ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)',
              opacity: trayReady ? 1 : 0.4,
              transition: 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
            }}
            className="relative z-10 mt-2.5 grid w-full max-w-2xl grid-cols-2 gap-2 rounded-2xl border-[2.5px] border-[#a88246] bg-gradient-to-b from-[#231409] to-[#120a04] p-2.5 shadow-[inset_0_4px_14px_rgba(0,0,0,0.9)] sm:mt-3 sm:grid-cols-4 sm:gap-2.5 sm:border-[3px] sm:p-3"
          >
            <button
              type="button"
              disabled={isFirstVisitGuide}
              onMouseEnter={() => !isFirstVisitGuide && hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                if (isFirstVisitGuide) return;
                hsAudio.playSfx('box_press');
                onOpenPacks();
              }}
              className={`hs-brass-btn relative flex min-h-[48px] items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-amber-100 sm:gap-2.5 sm:px-3 sm:py-2 ${lockedBtnStyle}`}
            >
              {profile.packs > 0 && (
                <span className="hs-num absolute -right-1.5 -top-1.5 z-20 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-red-200 bg-gradient-to-b from-red-500 to-red-800 px-1 text-[11px] text-white shadow-[0_3px_10px_rgba(220,38,38,0.85)] sm:-right-2 sm:-top-2 sm:h-6 sm:min-w-6 sm:px-1.5 sm:text-xs">
                  {profile.packs}
                </span>
              )}
              <div className="h-9 w-7 shrink-0 sm:h-10 sm:w-8">
                <SnsBoosterPackArt variant={profile.selectedCardBack} />
              </div>
              <div className="min-w-0">
                <div className="hs-title truncate text-xs font-extrabold text-amber-100 sm:text-sm">
                  {tr('눈히어로 팩 개봉', 'Open Packs')}
                </div>
                <div className="text-[10px] font-bold text-amber-300/85">
                  {tr(`보유 ${profile.packs}팩`, `${profile.packs} Packs Ready`)}
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={isFirstVisitGuide}
              onMouseEnter={() => !isFirstVisitGuide && hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                if (isFirstVisitGuide) return;
                hsAudio.playSfx('box_press');
                onOpenCollection();
              }}
              className={`hs-brass-btn flex min-h-[48px] items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-amber-100 sm:gap-2.5 sm:px-3 sm:py-2 ${lockedBtnStyle}`}
            >
              <img
                src={CLASS_CREST_URL.PRIEST}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-amber-300/60 object-cover shadow sm:h-9 sm:w-9"
              />
              <div className="min-w-0">
                <div className="hs-title truncate text-xs font-extrabold text-amber-100 sm:text-sm">
                  {tr('내 카드첩', 'My Collection')}
                </div>
                <div className="text-[10px] font-bold text-amber-300/85">
                  {tr('3장=3배 강화 · 382종', '3 Copies = 3x · 382 Cards')}
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={isFirstVisitGuide}
              onMouseEnter={() => !isFirstVisitGuide && hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                if (isFirstVisitGuide) return;
                hsAudio.playSfx('box_open');
                onOpenQuestLog();
              }}
              className={`hs-brass-btn relative flex min-h-[48px] items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-amber-100 sm:gap-2.5 sm:px-3 sm:py-2 ${lockedBtnStyle}`}
            >
              {(() => {
                const claimableQ = quests.filter(
                  (q) => (q.completed || q.progress >= q.goal) && !q.bonusClaimed,
                ).length;
                return claimableQ > 0 ? (
                  <span
                    data-testid="hub-quest-red-dot"
                    className="hs-num absolute -right-1.5 -top-1.5 z-20 flex h-5 min-w-5 animate-bounce items-center justify-center rounded-full border-2 border-yellow-200 bg-gradient-to-b from-emerald-500 to-emerald-800 px-1 text-[11px] text-white shadow-[0_3px_10px_rgba(16,185,129,0.85)] sm:-right-2 sm:-top-2 sm:h-6 sm:min-w-6 sm:px-1.5 sm:text-xs"
                  >
                    {claimableQ}
                  </span>
                ) : null;
              })()}
              <SnsQuestScrollIcon size={32} className="shrink-0 drop-shadow" />
              <div className="min-w-0">
                <div className="hs-title truncate text-xs font-extrabold text-amber-100 sm:text-sm">
                  {tr('의뢰 일지', 'Quest Log')}
                </div>
                <div className="text-[10px] font-bold text-amber-300/85">
                  {tr('모드별 보상 · 의뢰', 'Mode Rewards · Quests')}
                </div>
              </div>
            </button>

            <button
              type="button"
              disabled={isFirstVisitGuide}
              onMouseEnter={() => !isFirstVisitGuide && hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                if (isFirstVisitGuide) return;
                hsAudio.playSfx('box_press');
                onOpenShop();
              }}
              className={`hs-brass-btn relative flex min-h-[48px] items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-amber-100 sm:gap-2.5 sm:px-3 sm:py-2 ${lockedBtnStyle}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/50 bg-stone-950/60 sm:h-9 sm:w-9">
                <HsGoldCoinIcon size={22} />
              </div>
              <div className="min-w-0">
                <div className="hs-title truncate text-xs font-extrabold text-amber-100 sm:text-sm">
                  {tr('눈히어로 보급소', 'Card Shop')}
                </div>
                <div className="text-[10px] font-bold text-amber-300/85">
                  {tr('골드·현금 팩 구매', 'Buy Packs with Gold / $')}
                </div>
              </div>
            </button>
          </div>

          {/* 3D Hinged Sanctuary Oak & Brass Chest Double Doors (`hsBoxDoorLeftSwing` & `hsBoxDoorRightSwing`) */}
          {doorsOpening && (
            <div
              data-testid="hub-chest-doors"
              className="pointer-events-none absolute inset-0 z-40 flex overflow-visible rounded-[28px] sm:rounded-[34px]"
            >
              {/* Left Hinged Door */}
              <div
                style={{
                  transformOrigin: 'left center',
                  animation: 'hsBoxDoorLeftSwing 0.88s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  background:
                    'linear-gradient(135deg, #4b2d15 0%, #2d180a 48%, #1d0e05 100%)',
                }}
                className="relative flex h-full w-1/2 items-center justify-end overflow-hidden rounded-l-[28px] border-r-2 border-y-[3px] border-l-[3px] border-[#d6ab5b] shadow-[16px_0_40px_rgba(0,0,0,0.88)] sm:rounded-l-[34px]"
              >
                <div className="pointer-events-none absolute inset-3 rounded-l-[20px] border-2 border-[#e2be75]/45 shadow-[inset_0_0_24px_rgba(0,0,0,0.85)]" />
                <div className="pointer-events-none mr-[-28px] opacity-90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
                  <SnsSnowCompassSeal size={56} />
                </div>
              </div>

              {/* Right Hinged Door */}
              <div
                style={{
                  transformOrigin: 'right center',
                  animation: 'hsBoxDoorRightSwing 0.88s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                  background:
                    'linear-gradient(225deg, #4b2d15 0%, #2d180a 48%, #1d0e05 100%)',
                }}
                className="relative flex h-full w-1/2 items-center justify-start overflow-hidden rounded-r-[28px] border-l-2 border-y-[3px] border-r-[3px] border-[#d6ab5b] shadow-[-16px_0_40px_rgba(0,0,0,0.88)] sm:rounded-r-[34px]"
              >
                <div className="pointer-events-none absolute inset-3 rounded-r-[20px] border-2 border-[#e2be75]/45 shadow-[inset_0_0_24px_rgba(0,0,0,0.85)]" />
                <div className="pointer-events-none ml-[-28px] opacity-90 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
                  <SnsSnowCompassSeal size={56} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Subtle Footer Plaque */}
      <footer className="relative z-20 pt-1 text-center text-[10.5px] font-bold tracking-wide text-amber-200/80 sm:text-[11px]">
        {tr(
          '눈히어로 9대 종족 수호자 · 수집 카드 382종 완비 · 배경음 기본 15%',
          'SNSHero · 9 Guardian Heroes · 382 Collectible Cards · Free-to-Play',
        )}
      </footer>

      {quickRulesOpen && (
        <QuickRulesModal
          isFirstTime={!hasSeenQuickRules()}
          inBattle={false}
          onClose={() => setQuickRulesOpen(false)}
        />
      )}

      {installGuideOpen && (
        <PwaInstallGuideModal onClose={() => setInstallGuideOpen(false)} />
      )}
    </div>
  );
};
