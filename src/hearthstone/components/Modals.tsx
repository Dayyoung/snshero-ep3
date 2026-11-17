import React, { useEffect, useMemo, useState } from 'react';
import LZString from 'lz-string';
import {
  BookOpen,
  ClipboardPaste,
  Copy,
  Database,
  Download,
  Flag,
  Globe,
  Home,
  Maximize2,
  QrCode,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Tv,
  Upload,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { renderQrCodeSvg } from '../services/qrCodeSvg';
import { AudioSettings, hsAudio } from '../audio';
import { getModeRewardGuide, getGoldPackBundleLabel } from '../storage';
import { getRankTitle } from '../i18nData';
import { useModalDismiss } from '../useModalDismiss';
import {
  CLASSIC_RANK_NAMES,
  getStarsNeededForRank,
} from '../cardDb';
import {
  CHECKOUT_COUNTRIES,
  CRYPTO_COINS_CATALOG,
  CRYPTO_QUICK_CHIPS,
  CheckoutPopupMethod,
  GAME_SHOP_PACKAGES,
  GamePaymentReturnResult,
  GameShopPackage,
  isHsGameAdRemoved,
  openGameCheckoutPopup,
  resolveCryptoDepositDetails,
} from '../paymentGateway';
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
import { PwaInstallGuideModal } from './PwaInstallGuideModal';
import {
  GOLD_PACK_BUNDLES,
  GOLD_PRESTIGE_ITEMS,
  PRESTIGE_CATEGORY_SHOWCASES,
  computeOverallStanding,
  getEquippedPrestigeSummary,
  getPrestigeItemScreenshotUrl,
  hsStorage,
} from '../storage';
import {
  DailyQuest,
  GameMode,
  PlayerProfile,
  PrestigeCategory,
  SnsCardBackId,
} from '../types';
import { HsGoldCoinIcon } from './CardVisual';
import {
  SNS_CARD_BACK_THEMES,
  getSnsCardBackLabel,
  SnsBoosterPackArt,
  SnsCardBackArt,
  SnsQuestScrollIcon,
  SnsRankMedallion,
} from './SnsHeroArtKit';

const QUEST_EN_MAP: Record<string, { title: string; description: string }> = {
  q_win_3: {
    title: 'Champion of Elwin Village',
    description: "Win 2 matches in Story Mode, Ranked Challenger Match, or Bogart's Hall.",
  },
  q_bogart_play: {
    title: "Bogart's Hall High-Roller",
    description: "Complete 1 Gold-wager match in Bogart's Gambling Hall.",
  },
  q_ranked_tactic_win: {
    title: 'Live Kadan Tactical Command',
    description: 'Win 1 Ranked Challenger Match with Kadan tactical command.',
  },
  q_awakened_win: {
    title: 'Proof of 3x Awakening',
    description: 'Win 1 duel while owning a 3x Awakened (x3+) card.',
  },
  q_play_minions: {
    title: 'Rally Hero Companions',
    description: 'Summon 15 Minions across any game mode.',
  },
  q_cast_spells: {
    title: 'Starlight Arcane Training',
    description: 'Cast 10 Spells across any game mode.',
  },
};

function getLocalizedQuestText(q: DailyQuest, isKo: boolean): { title: string; description: string } {
  if (isKo) return { title: q.title, description: q.description };
  return QUEST_EN_MAP[q.id] || { title: q.title, description: q.description };
}

const SHOP_PKG_EN: Record<
  GameShopPackage['id'],
  { name: string; badge: string; description: string; shortSpec: string }
> = {
  pack_1: {
    name: 'SNSHero 1 Card Pack',
    badge: '1 Pack Standard',
    description:
      "Summon 5 cards from SNSHero 'Kadan's Journey'. At least 1 Rare or better card is guaranteed.",
    shortSpec: '5 Cards · 1 Rare+ Guaranteed',
  },
  pack_5: {
    name: 'SNSHero 5 Card Packs',
    badge: '20% OFF · Popular',
    description:
      'Get 5 SNSHero packs (25 cards total) at 20% off to unlock Story Mode ×3 Awakening faster.',
    shortSpec: '25 Cards Total (5 Packs) · 20% Off',
  },
  ad_removal: {
    name: 'Permanent Ad Removal VIP',
    badge: 'VIP Permanent',
    description: 'Permanently removes banner ads across desktop, tablet, and mobile screens.',
    shortSpec: 'All Ads Removed Permanently · Instant',
  },
};

const COUNTRY_EN: Record<string, { name: string; subLabel: string }> = {
  ko: {
    name: 'South Korea',
    subLabel: 'KRW · Local Card / KakaoPay / NaverPay / PayPal',
  },
  en: {
    name: 'United States / North America',
    subLabel: 'USD · PayPal / International Card / Apple Pay / Crypto',
  },
  ja: {
    name: 'Japan',
    subLabel: 'Global USD · PayPal / Card / Crypto',
  },
  eu: {
    name: 'Europe / UK',
    subLabel: 'Global USD · PayPal / Card / Crypto',
  },
  global: {
    name: 'Global International',
    subLabel: 'Global USD · PayPal / Card / Crypto',
  },
};

const CARD_BACK_IDS: SnsCardBackId[] = ['gold', 'silver', 'bronze', 'ocarina_crest', 'bogart_vip'];
const ALL_MODES_ORDER: GameMode[] = [
  'TUTORIAL',
  'RANKED',
  'BOGART_GAMBLE',
  'CASUAL',
  'PRACTICE_NORMAL',
  'PRACTICE_EXPERT',
];

export const QuestLogModal: React.FC<{
  onClose: () => void;
  onProfileChanged: () => void;
}> = ({ onClose, onProfileChanged }) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  useModalDismiss(true, () => {
    hsAudio.playSfx('box_close');
    onClose();
  });

  const [openSection, setOpenSection] = useState<'NONE' | 'REWARDS' | 'QUESTS'>(() => {
    const curQuests = hsStorage.getQuests();
    return curQuests.some((q) => (q.completed || q.progress >= q.goal) && !q.bonusClaimed)
      ? 'QUESTS'
      : 'NONE';
  });
  const [showAllQuests, setShowAllQuests] = useState<boolean>(false);
  const [claimBanner, setClaimBanner] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    const sync = () => setTick((n) => n + 1);
    window.addEventListener('snshero:state-changed', sync);
    return () => window.removeEventListener('snshero:state-changed', sync);
  }, []);

  const profile = hsStorage.getProfile();
  const quests = hsStorage.getQuests();
  const standing = computeOverallStanding(profile);
  const rankTitle = getRankTitle(profile.rank, CLASSIC_RANK_NAMES, lang) || tr('엘윈 마을 수습생', 'Elwin Apprentice');
  const starsNeeded = getStarsNeededForRank(profile.rank);
  const completedQuestsCount = quests.filter((q) => q.completed || q.progress >= q.goal).length;
  const claimableBonusCount = quests.filter(
    (q) => (q.completed || q.progress >= q.goal) && !q.bonusClaimed,
  ).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-4 text-amber-100 sm:p-6"
      >
        {/* Clean Header */}
        <div className="mb-4 flex items-center justify-between border-b border-amber-600/35 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#d4af63] bg-stone-950/85 shadow">
              <SnsQuestScrollIcon size={30} />
            </div>
            <div>
              <h2 className="hs-title text-lg font-extrabold text-amber-100 sm:text-2xl">
                {tr('전적 · 순위 및 의뢰 보상표', 'Profile · Standings & Quests')}
              </h2>
              <p className="text-[11px] font-semibold text-amber-300/85 sm:text-xs">
                {tr('내 승/패 · 승률 · 전체순위 요약', 'Record · Win Rate · Leaderboard Summary')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            className="hs-brass-btn shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-amber-100 sm:text-sm"
          >
            {tr('닫기 ✕', 'Close ✕')}
          </button>
        </div>

        {/* Compact Rank & Story Progress Banner */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#c8a158]/55 bg-black/45 px-4 py-3">
          <div className="flex items-center gap-3">
            <SnsRankMedallion rank={profile.rank} size={54} className="shrink-0" />
            <div>
              <div className="hs-title text-base font-extrabold text-amber-100 sm:text-lg">
                {profile.rank === 0
                  ? rankTitle
                  : tr(`${profile.rank}등급 · ${rankTitle}`, `Rank ${profile.rank} · ${rankTitle}`)}
              </div>
              {profile.rank > 0 ? (
                <div className="mt-0.5 flex items-center gap-1 text-sm">
                  {Array.from({ length: starsNeeded }).map((_, idx) => (
                    <span
                      key={idx}
                      className={idx < profile.stars ? 'text-yellow-300' : 'text-stone-600'}
                    >
                      ★
                    </span>
                  ))}
                  <span className="ml-1.5 text-xs font-bold text-amber-300/85">
                    ({profile.stars}/{starsNeeded})
                  </span>
                </div>
              ) : (
                <div className="mt-0.5 text-xs font-bold text-yellow-300">
                  {tr('최고 명예 전설의 눈히어로 달성!', 'Highest Honor: SNSHero Legend Achieved!')}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="rounded-xl border border-yellow-300/55 bg-amber-950/65 px-3 py-1 text-xs font-extrabold text-yellow-200">
              {(() => {
                const eq = getEquippedPrestigeSummary(profile, isKo);
                return (
                  <span>
                    {eq.badgeIcon} 〈{eq.titleText}〉
                  </span>
                );
              })()}
            </div>
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/55 px-3 py-1 text-[11px] font-extrabold text-emerald-200">
              {isKo
                ? `스토리: ${profile.journeyReincarnation}환생 ${profile.journeyEpisode}화 · 도박장 순수익 ${profile.bogartStats?.netGoldProfit >= 0 ? '+' : ''}${profile.bogartStats?.netGoldProfit || 0}G`
                : `Story: NG+${profile.journeyReincarnation} EP ${profile.journeyEpisode} · Bogart Net ${profile.bogartStats?.netGoldProfit >= 0 ? '+' : ''}${profile.bogartStats?.netGoldProfit || 0}G`}
            </div>
          </div>
        </div>

        {/* DEV-028: Official Ranked Exclusive Notice */}
        <div
          data-testid="official-ranked-isolation-note"
          className="mb-2.5 rounded-xl border border-sky-400/45 bg-sky-950/60 px-3 py-1.5 text-center text-[11px] font-extrabold text-sky-200"
        >
          🏆 {tr('공식 전적 단독 집계: 아래 승/패·승률·연승은 오직 「온라인형 랭킹대전」 정규 대결 결과만 반영됩니다.', 'Official Ranked Exclusive: Wins, Win Rate & Streaks below count ONLY Official Ranked Arena matches.')}
        </div>

        {/* 3 Eye-Catching Spotlight Cards: 전체순위 / 승·패 / 승률 */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {/* 1. 전체순위 */}
          <div
            data-testid="quest-stat-overall-rank"
            className="flex flex-col justify-between rounded-2xl border-2 border-amber-400/65 bg-gradient-to-b from-amber-950/75 via-stone-950/90 to-black p-3.5 shadow-[0_8px_20px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-extrabold text-amber-200">
                🏆 {tr('전체순위', 'Overall Rank')}
              </span>
              <span className="rounded-full border border-yellow-300/60 bg-amber-900/80 px-2 py-0.5 text-[10.5px] font-black text-yellow-200">
                {tr(`상위 ${standing.topPercentLabel}`, `Top ${standing.topPercentLabel}`)}
              </span>
            </div>
            <div className="hs-num hs-outline-sm my-2 text-2xl font-black tracking-tight text-yellow-300 sm:text-3xl">
              #{standing.overallRank.toLocaleString()}
              {isKo && <span className="ml-0.5 text-base font-extrabold text-amber-200">위</span>}
            </div>
            <div className="text-[11px] font-semibold text-amber-200/75">
              {tr(
                `전체 ${standing.totalPlayers.toLocaleString()}명 기준`,
                `Out of ${standing.totalPlayers.toLocaleString()} players`,
              )}
            </div>
          </div>

          {/* 2. 승 / 패 */}
          <div
            data-testid="quest-stat-win-loss"
            className="flex flex-col justify-between rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-b from-emerald-950/70 via-stone-950/90 to-black p-3.5 shadow-[0_8px_20px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-extrabold text-emerald-200">
                ⚔ {tr('승 / 패', 'Wins / Losses')}
              </span>
              <span className="rounded-full border border-emerald-400/50 bg-emerald-950/90 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-200">
                {profile.winStreak >= 2
                  ? tr(`🔥 ${profile.winStreak}연승`, `🔥 ${profile.winStreak} Streak`)
                  : tr(`총 ${standing.totalGames}전`, `${standing.totalGames} Games`)}
              </span>
            </div>
            <div className="hs-num hs-outline-sm my-2 flex items-baseline gap-1.5 text-2xl font-black sm:text-3xl">
              <span className="text-emerald-300">
                {isKo ? `${standing.wins}승` : `${standing.wins}W`}
              </span>
              <span className="text-base text-stone-500">/</span>
              <span className="text-rose-300">
                {isKo ? `${standing.losses}패` : `${standing.losses}L`}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-amber-200/75">
              {tr(`통산 ${standing.totalGames}경기`, `Total ${standing.totalGames} matches`)}
              {profile.winStreak > 0
                ? tr(` · 현재 ${profile.winStreak}연승`, ` · ${profile.winStreak} win streak`)
                : ''}
            </div>
          </div>

          {/* 3. 승률 */}
          <div
            data-testid="quest-stat-win-rate"
            className="flex flex-col justify-between rounded-2xl border-2 border-sky-400/60 bg-gradient-to-b from-sky-950/75 via-stone-950/90 to-black p-3.5 shadow-[0_8px_20px_rgba(0,0,0,0.65)]"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-extrabold text-sky-200">
                📈 {tr('승률', 'Win Rate')}
              </span>
              <span className="rounded-full border border-sky-400/50 bg-sky-950/90 px-2 py-0.5 text-[10.5px] font-extrabold text-sky-200">
                {standing.totalGames === 0
                  ? tr('대결 전', 'No Games')
                  : standing.winRatePct >= 50
                    ? tr('승률 우세', 'Winning')
                    : tr('분발 중', 'Climbing')}
              </span>
            </div>
            <div className="hs-num hs-outline-sm my-2 text-2xl font-black tracking-tight text-sky-300 sm:text-3xl">
              {standing.winRateLabel}%
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full border border-sky-400/30 bg-stone-900">
              <div
                style={{ width: `${standing.winRatePct}%` }}
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
              />
            </div>
          </div>
        </div>

        {/* Progressive Disclosure: Only 2 Clean Buttons Shown by Default ("보상 안내" / "의뢰") */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="quest-toggle-rewards"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.85);
              setOpenSection((prev) => (prev === 'REWARDS' ? 'NONE' : 'REWARDS'));
            }}
            className={`flex min-h-[48px] items-center justify-between rounded-2xl border-2 px-4 py-2.5 text-sm font-extrabold shadow-lg transition sm:text-base ${
              openSection === 'REWARDS'
                ? 'border-yellow-300 bg-gradient-to-b from-amber-600 to-amber-900 text-white shadow-[0_0_18px_rgba(251,191,36,0.45)]'
                : 'hs-brass-btn border-[#c8a158] text-amber-100 hover:border-yellow-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>🏆</span>
              <span>{tr('보상 안내', 'Rewards')}</span>
            </span>
            <span className="text-xs font-bold opacity-90">
              {openSection === 'REWARDS' ? tr('닫기 ▲', 'Hide ▲') : tr('보기 ▼', 'View ▼')}
            </span>
          </button>

          <button
            type="button"
            data-testid="quest-toggle-quests"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.85);
              setOpenSection((prev) => (prev === 'QUESTS' ? 'NONE' : 'QUESTS'));
            }}
            className={`flex min-h-[48px] items-center justify-between rounded-2xl border-2 px-4 py-2.5 text-sm font-extrabold shadow-lg transition sm:text-base ${
              openSection === 'QUESTS'
                ? 'border-emerald-300 bg-gradient-to-b from-emerald-600 to-emerald-900 text-white shadow-[0_0_18px_rgba(52,211,153,0.45)]'
                : 'hs-brass-btn border-[#c8a158] text-amber-100 hover:border-emerald-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <span>📜</span>
              <span>{tr('의뢰', 'Quests')}</span>
              <span className="rounded-full border border-amber-300/50 bg-black/45 px-2 py-0.5 text-[11px] font-black text-yellow-200">
                {completedQuestsCount}/{quests.length}
              </span>
            </span>
            <span className="text-xs font-bold opacity-90">
              {openSection === 'QUESTS' ? tr('닫기 ▲', 'Hide ▲') : tr('보기 ▼', 'View ▼')}
            </span>
          </button>
        </div>

        {/* On-Demand Panel 1: 보상 안내 */}
        {openSection === 'REWARDS' && (
          <div
            data-testid="quest-panel-rewards"
            className="mt-3.5 space-y-2 rounded-2xl border-2 border-amber-400/55 bg-black/55 p-3.5"
          >
            <div className="mb-1 flex items-center justify-between px-1">
              <h3 className="hs-title text-sm font-extrabold text-yellow-300">
                {tr('모드별 확정 승리 보상 안내', 'Guaranteed Win Rewards by Mode')}
              </h3>
              <span className="text-[11px] font-semibold text-amber-200/75">
                {tr('승리 즉시 자동 지급', 'Granted instantly on win')}
              </span>
            </div>
            {ALL_MODES_ORDER.map((m) => {
              const g = getModeRewardGuide(m, isKo);
              return (
                <div
                  key={m}
                  className="flex flex-col justify-between gap-1 rounded-xl border border-amber-500/25 bg-stone-950/90 px-3 py-2.5 text-xs sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-extrabold text-amber-100">{g.modeNameKo}</span>
                      <span className="rounded border border-sky-400/35 bg-sky-950/80 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
                        {g.playStyleBadge}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-emerald-200/90">
                      {g.specialBonusText}
                    </div>
                  </div>
                  <div className="shrink-0 font-extrabold text-yellow-300 sm:text-right">
                    {g.baseWinRewardText}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* On-Demand Panel 2: 의뢰 */}
        {openSection === 'QUESTS' && (
          <div
            data-testid="quest-panel-quests"
            className="mt-3.5 rounded-2xl border-2 border-emerald-400/55 bg-black/55 p-3.5"
          >
            <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
              <div>
                <h3 className="hs-title text-sm font-extrabold text-emerald-200">
                  {tr('오늘의 엘윈마을 의뢰', 'Daily Elwin Village Quests')}
                </h3>
                <span className="text-[11px] font-semibold text-emerald-200/80">
                  {tr('달성 시 골드 즉시 지급 + 추가 완료 보너스 일괄 수령 가능', 'Auto Gold on clear + Claim All mastery bonus')}
                </span>
              </div>
              {claimableBonusCount > 0 && (
                <button
                  type="button"
                  data-testid="quest-claim-all-btn"
                  onClick={() => {
                    const res = hsStorage.claimAllCompletedQuests();
                    if (res.claimedCount > 0) {
                      hsAudio.playSfx('mario_coin', 0.9);
                      hsAudio.playSfx('purchase');
                      onProfileChanged();
                      setClaimBanner(
                        tr(
                          `🎁 완료 의뢰 ${res.claimedCount}건 추가 보너스 일괄 수령 완료 (+${res.goldGranted}G)!`,
                          `🎁 Claimed mastery bonus for ${res.claimedCount} quest(s) (+${res.goldGranted}G)!`,
                        ),
                      );
                    }
                  }}
                  className="hs-gold-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-black shadow-lg"
                >
                  {tr(
                    `🎁 완료 의뢰 일괄 수령 (+${claimableBonusCount * 20}G)`,
                    `🎁 Claim All (${claimableBonusCount} · +${claimableBonusCount * 20}G)`,
                  )}
                </button>
              )}
            </div>
            {claimBanner && (
              <div className="mb-2.5 rounded-xl border border-emerald-300/70 bg-emerald-950/90 px-3 py-2 text-xs font-extrabold text-emerald-100">
                {claimBanner}
              </div>
            )}
            {/* MKT-054: Odd-Balance Gold Next-Milestone Progress Bridge */}
            <div
              data-testid="quest-gold-progress-bridge"
              className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/50 bg-amber-950/55 px-3 py-2 text-[11px] font-extrabold text-amber-100"
            >
              <span>
                🪙{' '}
                {profile.gold < 450
                  ? tr(
                      `현재 보유 ${profile.gold}G · 5팩 할인 묶음(450G)까지 ${450 - profile.gold}G 남음 · 보가트 도박장 2배 베팅 즉시 가능!`,
                      `Owned ${profile.gold}G · ${450 - profile.gold}G away from 5-Pack Bundle (450G) · Bogart 2x Bet ready!`,
                    )
                  : profile.gold < 850
                    ? tr(
                        `현재 보유 ${profile.gold}G · 10팩 대묶음(850G)까지 ${850 - profile.gold}G 남음 · 명예 호칭 즉시 해금 가능!`,
                        `Owned ${profile.gold}G · ${850 - profile.gold}G away from 10-Pack Bundle (850G) · Prestige Titles ready!`,
                      )
                    : tr(
                        `현재 보유 ${profile.gold}G · 10팩 대묶음(850G) 및 한정 골드 치장품 즉시 해금 가능!`,
                        `Owned ${profile.gold}G · Ready to unlock 10-Pack Bundle (850G) or Gold Prestige items!`,
                      )}
              </span>
              <span className="rounded-full border border-yellow-300/60 bg-black/50 px-2.5 py-0.5 text-[10px] font-black text-yellow-300">
                {Math.min(100, Math.round((profile.gold / 850) * 100))}% / 850G
              </span>
            </div>
            {(() => {
              // DEV-042(2): Single-Focus Quest View — prioritize #1 claimable or closest-to-completion quest first!
              const sortedQuests = [...quests].sort((a, b) => {
                const aClaimable = (a.completed || a.progress >= a.goal) && !a.bonusClaimed ? 1 : 0;
                const bClaimable = (b.completed || b.progress >= b.goal) && !b.bonusClaimed ? 1 : 0;
                if (aClaimable !== bClaimable) return bClaimable - aClaimable;
                const aCleared = a.completed || a.progress >= a.goal ? 1 : 0;
                const bCleared = b.completed || b.progress >= b.goal ? 1 : 0;
                if (aCleared !== bCleared) return aCleared - bCleared;
                return b.progress / Math.max(1, b.goal) - a.progress / Math.max(1, a.goal);
              });
              const visibleQuests = showAllQuests ? sortedQuests : sortedQuests.slice(0, 1);
              return (
                <>
                  <div className={showAllQuests ? 'grid grid-cols-1 gap-3 md:grid-cols-3' : 'grid grid-cols-1 gap-3'}>
                    {visibleQuests.map((q) => {
                const isCleared = q.completed || q.progress >= q.goal;
                const isClaimable = isCleared && !q.bonusClaimed;
                const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
                const qText = getLocalizedQuestText(q, isKo);
                const handleQuestClick = () => {
                  if (isClaimable) {
                    const res = hsStorage.claimCompletedQuest(q.id);
                    if (res.claimed) {
                      hsAudio.playSfx('mario_coin', 0.9);
                      hsAudio.playSfx('purchase');
                      onProfileChanged();
                      setClaimBanner(
                        tr(
                          `🎁 [${qText.title}] 성공 보상 수령 완료 (+${res.goldGranted}G)!`,
                          `🎁 Claimed [${qText.title}] reward (+${res.goldGranted}G)!`,
                        ),
                      );
                    }
                  } else if (isCleared) {
                    hsAudio.playSfx('ui_click', 0.65);
                    setClaimBanner(
                      tr(
                        `✓ [${qText.title}]은(는) 기본 골드(+${q.rewardGold}G) 및 추가 보상(+20G) 수령을 이미 완료했습니다.`,
                        `✓ [${qText.title}] reward (+${q.rewardGold}G) & bonus (+20G) already claimed.`,
                      ),
                    );
                  }
                };
                if (isCleared) {
                  return (
                    <button
                      key={q.id}
                      type="button"
                      data-testid={`quest-card-${q.id}`}
                      data-quest-claimable={isClaimable ? 'true' : 'false'}
                      onClick={handleQuestClick}
                      className={`flex flex-col justify-between rounded-2xl border-2 p-3.5 text-left shadow transition ${
                        isClaimable
                          ? 'cursor-pointer border-yellow-300 bg-gradient-to-b from-emerald-900/95 to-emerald-950 text-emerald-50 shadow-[0_0_18px_rgba(52,211,153,0.4)] hover:scale-[1.02] hover:border-amber-200'
                          : 'cursor-pointer border-emerald-500/45 bg-emerald-950/55 text-emerald-100/90 hover:border-emerald-400/75'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="hs-title text-sm font-extrabold">{qText.title}</span>
                          <span className="flex items-center gap-1 rounded-full border border-amber-900/40 bg-amber-400/90 px-2 py-0.5 text-xs font-black text-stone-950">
                            <HsGoldCoinIcon size={14} />
                            <span>+{isClaimable ? 20 : q.rewardGold}G</span>
                          </span>
                        </div>
                        {showAllQuests && (
                          <p className="mt-1.5 text-xs font-semibold text-emerald-200">
                            {qText.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 w-full">
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-800/35">
                          <div
                            style={{ width: '100%' }}
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                          />
                        </div>
                        {isClaimable ? (
                          <div className="mt-2 flex min-h-[34px] items-center justify-center rounded-xl border border-yellow-300/80 bg-gradient-to-b from-amber-400 to-amber-600 px-2.5 py-1 text-center text-xs font-black text-stone-950 shadow">
                            {tr('🎁 클릭하여 보상 수령 (+20G)', '🎁 Click to Claim (+20G)')}
                          </div>
                        ) : (
                          <div className="mt-1.5 text-right text-[11px] font-extrabold text-emerald-300">
                            {tr('✓ 기본 + 보너스 수령 완료', 'Claimed ✓')}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                }
                return (
                  <div
                    key={q.id}
                    data-testid={`quest-card-${q.id}`}
                    data-quest-claimable="false"
                    className="rounded-2xl border-2 border-[#a88246] bg-[#f3e5c3] p-3.5 text-stone-900 shadow"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="hs-title text-sm font-extrabold">{qText.title}</span>
                      <span className="flex items-center gap-1 rounded-full border border-amber-900/40 bg-amber-400/90 px-2 py-0.5 text-xs font-black text-stone-950">
                        <HsGoldCoinIcon size={14} />
                        <span>+{q.rewardGold}G</span>
                      </span>
                    </div>
                    {showAllQuests && (
                      <p className="mt-1.5 text-xs font-semibold text-stone-700">
                        {qText.description}
                      </p>
                    )}
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-800/35">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500"
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] font-extrabold">
                      <span className="text-stone-700">
                        {!showAllQuests ? qText.description : ''}
                      </span>
                      <span>{`${q.progress} / ${q.goal}`}</span>
                    </div>
                  </div>
                );
                    })}
                  </div>
                  {quests.length > 1 && (
                    <button
                      type="button"
                      data-testid="quest-expand-others-btn"
                      onClick={() => {
                        hsAudio.playSfx('ui_click', 0.7);
                        setShowAllQuests((v) => !v);
                      }}
                      className="mt-2.5 flex min-h-[40px] w-full items-center justify-center rounded-xl border border-amber-400/45 bg-stone-950/80 px-3 py-1.5 text-xs font-extrabold text-amber-200 hover:border-yellow-300 hover:text-white"
                    >
                      {showAllQuests
                        ? tr('▲ 핵심 의뢰 1건만 간단히 보기', '▲ Show Top Priority Quest Only')
                        : tr(`+ 다른 의뢰 보기 (${quests.length - 1}건)`, `+ View Other Quests (${quests.length - 1})`)}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 3-Step Sequential Checkout Flow:
 * 1) `quantity` (① 구매수량 선택 + 골드 구매)
 * 2) `country`  (② 결제국가 선택)
 * 3) `method`   (③ 결제수단 선택 -> 새 팝업 창 결제)
 *    + optional `crypto_coin` / `crypto_chain` / `crypto_deposit` sub-steps when 암호화폐 is picked
 */
type ShopCheckoutStep =
  | 'quantity'
  | 'country'
  | 'method'
  | 'crypto_coin'
  | 'crypto_chain'
  | 'crypto_deposit';

export const TavernShopModal: React.FC<{
  onClose: () => void;
  onProfileChanged: () => void;
  onGoOpenPacks: () => void;
}> = ({ onClose, onProfileChanged, onGoOpenPacks }) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  useModalDismiss(true, () => {
    hsAudio.playSfx('box_close');
    onClose();
  });

  const [profile, setProfile] = useState<PlayerProfile>(() => hsStorage.getProfile());
  const [vipAdRemoved, setVipAdRemoved] = useState<boolean>(() => isHsGameAdRemoved());
  const [shopTab, setShopTab] = useState<'PACKS' | 'PRESTIGE'>(() => {
    try {
      return sessionStorage.getItem('snshero_shop_category') ? 'PRESTIGE' : 'PACKS';
    } catch {
      return 'PACKS';
    }
  });
  const [prestigeCat, setPrestigeCat] = useState<PrestigeCategory>(() => {
    try {
      const raw = sessionStorage.getItem('snshero_shop_category')?.toUpperCase();
      sessionStorage.removeItem('snshero_shop_category');
      if (raw === 'BADGE' || raw === 'FRAME' || raw === 'CARDBACK' || raw === 'TITLE') {
        return raw;
      }
      if (raw === 'CARD_BACK') return 'CARDBACK';
    } catch {
      // ignore
    }
    return 'BADGE';
  });
  const [zoomedPrestigeImg, setZoomedPrestigeImg] = useState<{ src: string; title: string; where: string } | null>(null);
  const [prestigeBackupPromptOpen, setPrestigeBackupPromptOpen] = useState<boolean>(false);
  const [step, setStep] = useState<ShopCheckoutStep>('quantity');
  const [selectedPkg, setSelectedPkg] = useState<GameShopPackage>(GAME_SHOP_PACKAGES[0]);
  const [countryCode, setCountryCode] = useState<string>(() => (isKo ? 'ko' : 'en'));
  const [popupWaitingMethod, setPopupWaitingMethod] = useState<CheckoutPopupMethod | null>(null);
  const [popupBlockedRetry, setPopupBlockedRetry] = useState<CheckoutPopupMethod | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [coinSearch, setCoinSearch] = useState<string>('');
  const [selectedCoinCcy, setSelectedCoinCcy] = useState<string>('USDT');
  const [selectedChain, setSelectedChain] = useState<string>('USDT-TRC20');
  const [cryptoSecondsLeft, setCryptoSecondsLeft] = useState<number>(600);
  const [copiedAddr, setCopiedAddr] = useState<boolean>(false);
  const [depositCheckMsg, setDepositCheckMsg] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setProfile(hsStorage.getProfile());
      setVipAdRemoved(isHsGameAdRemoved());
    };
    const onMsg = (ev: MessageEvent) => {
      if (ev.data?.type === 'SNSHERO_GAME_PAYMENT_COMPLETE') {
        setPopupWaitingMethod(null);
        setPopupBlockedRetry(null);
        sync();
        onProfileChanged();
        onClose();
      }
    };
    window.addEventListener('snshero:state-changed', sync);
    window.addEventListener('snshero_ad_removed_updated', sync);
    window.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('snshero:state-changed', sync);
      window.removeEventListener('snshero_ad_removed_updated', sync);
      window.removeEventListener('message', onMsg);
    };
  }, [onClose, onProfileChanged]);

  useEffect(() => {
    if (step !== 'crypto_deposit') return;
    setCryptoSecondsLeft(600);
    const iv = window.setInterval(() => {
      setCryptoSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [step, selectedCoinCcy, selectedChain, selectedPkg.id]);

  const refresh = () => {
    setProfile(hsStorage.getProfile());
    onProfileChanged();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 3200);
  };

  const handleBuyGoldBundle = (packs: number, costGold: number, label: string) => {
    const ok = hsStorage.buyPackBundleWithGold(packs, costGold);
    if (!ok) {
      hsAudio.playSfx('ui_click', 0.6);
      showToast(
        tr(
          `보유 골드가 부족합니다! (${label}: ${costGold}G 필요 / 현재 ${profile.gold}G)`,
          `Not enough Gold! (${label}: ${costGold}G required / ${profile.gold}G owned)`,
        ),
      );
      return;
    }
    hsAudio.playSfx('purchase');
    refresh();
    showToast(
      tr(
        `🎉 ${label} 구매 완료! (-${costGold}G → 미개봉 팩 +${packs}개 지급)`,
        `🎉 ${label} purchased! (-${costGold}G → +${packs} Pack${packs > 1 ? 's' : ''})`,
      ),
    );
  };

  const handleSelectPackageToStep2 = (pkg: GameShopPackage) => {
    hsAudio.playSfx('ui_click');
    setSelectedPkg(pkg);
    setPopupWaitingMethod(null);
    setPopupBlockedRetry(null);
    setDepositCheckMsg(null);
    setCopiedAddr(false);
    setStep('country');
  };

  const handleSelectCountryToStep3 = (code: string) => {
    hsAudio.playSfx('ui_click');
    setCountryCode(code);
    setPopupWaitingMethod(null);
    setPopupBlockedRetry(null);
    setStep('method');
  };

  const handleTriggerPopupCheckout = (method: CheckoutPopupMethod) => {
    hsAudio.playSfx('box_press');
    setPopupBlockedRetry(null);
    const popup = openGameCheckoutPopup(selectedPkg, method);
    if (!popup) {
      setPopupBlockedRetry(method);
      showToast(
        tr(
          '브라우저에서 팝업이 차단되었습니다. 아래 [결제 팝업 창 열기] 버튼을 다시 눌러주세요.',
          'Popup blocked by browser. Click [Open Checkout Popup] below to retry.',
        ),
      );
      return;
    }
    setPopupWaitingMethod(method);
    try {
      popup.focus();
    } catch {
      // ignore
    }
  };

  const handleSelectBack = (id: SnsCardBackId) => {
    const p = hsStorage.getProfile();
    p.selectedCardBack = id;
    hsStorage.saveProfile(p);
    hsAudio.playSfx('ui_click');
    const backName = getSnsCardBackLabel(id).name;
    showToast(
      tr(
        `카드 뒷면이 '${backName}'(으)로 변경되었습니다.`,
        `Card back changed to '${backName}'.`,
      ),
    );
    refresh();
  };

  const selectedCountry = useMemo(
    () => CHECKOUT_COUNTRIES.find((c) => c.code === countryCode) || CHECKOUT_COUNTRIES[0],
    [countryCode],
  );

  const filteredCoins = useMemo(() => {
    const q = coinSearch.trim().toLowerCase();
    if (!q) return CRYPTO_COINS_CATALOG;
    return CRYPTO_COINS_CATALOG.filter(
      (c) => c.ccy.toLowerCase().includes(q) || c.name.toLowerCase().includes(q),
    );
  }, [coinSearch]);

  const activeCoinObj = useMemo(
    () => CRYPTO_COINS_CATALOG.find((c) => c.ccy === selectedCoinCcy) || CRYPTO_COINS_CATALOG[0],
    [selectedCoinCcy],
  );

  const cryptoDeposit = useMemo(
    () => resolveCryptoDepositDetails(selectedCoinCcy, selectedChain, selectedPkg.priceUsd),
    [selectedCoinCcy, selectedChain, selectedPkg.priceUsd],
  );

  const handlePickCoin = (ccy: string) => {
    const coin = CRYPTO_COINS_CATALOG.find((c) => c.ccy === ccy) || CRYPTO_COINS_CATALOG[0];
    setSelectedCoinCcy(coin.ccy);
    setSelectedChain(coin.chains[0]);
    setDepositCheckMsg(null);
    if (coin.chains.length > 1) {
      setStep('crypto_chain');
    } else {
      setStep('crypto_deposit');
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddr(true);
      window.setTimeout(() => setCopiedAddr(false), 2000);
    } catch {
      window.prompt(tr('입금 지갑 주소를 복사해 주세요:', 'Copy deposit wallet address:'), address);
    }
  };

  const mm = String(Math.floor(cryptoSecondsLeft / 60)).padStart(2, '0');
  const ss = String(cryptoSecondsLeft % 60).padStart(2, '0');

  const activeWizardStepNum =
    step === 'quantity' ? 1 : step === 'country' ? 2 : 3;

  const pkgLoc = isKo
    ? selectedPkg
    : { ...selectedPkg, ...(SHOP_PKG_EN[selectedPkg.id] || {}) };
  const countryLoc = isKo
    ? selectedCountry
    : { ...selectedCountry, ...(COUNTRY_EN[selectedCountry.code] || {}) };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-4 text-amber-100 sm:p-6"
      >
        {/* Header */}
        <div className="mb-3 flex items-center justify-between border-b border-amber-600/35 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#dfc07b] bg-stone-950/80">
              <HsGoldCoinIcon size={28} />
            </div>
            <div>
              <h2 className="hs-title text-lg font-extrabold text-amber-100 sm:text-2xl">
                {tr('눈히어로 보급소', 'SNSHero Shop')}
              </h2>
              <p className="text-xs font-semibold text-amber-300/85">
                {tr('보유 골드', 'Gold')} <b className="text-yellow-300">{profile.gold}G</b> ·{' '}
                {tr('미개봉 팩', 'Packs')}{' '}
                <b className="text-amber-100">{isKo ? `${profile.packs}개` : profile.packs}</b> ·{' '}
                {tr('영웅 가루', 'Dust')} <b className="text-sky-300">{profile.arcaneDust}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            aria-label={tr('닫기', 'Close')}
            className="hs-brass-btn shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-extrabold text-amber-100"
          >
            {tr('닫기 ✕', 'Close ✕')}
          </button>
        </div>

        {/* Top-Level Shop Mode Tabs (DEV-027: Supply Bundles vs Gold Prestige Exchange) */}
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border-2 border-[#c8a158]/60 bg-stone-950/90 p-1.5 text-xs font-extrabold sm:text-sm">
          <button
            type="button"
            data-testid="shop-tab-packs"
            onClick={() => {
              hsAudio.playSfx('gem_c_select');
              setShopTab('PACKS');
            }}
            className={`hs-mario-spring min-h-[44px] rounded-xl px-3 py-2 transition ${
              shopTab === 'PACKS'
                ? 'bg-gradient-to-b from-sky-500 to-blue-800 text-white shadow'
                : 'text-amber-200/80 hover:text-white'
            }`}
          >
            🎁 {tr('카드팩 · 보급 패키지', 'Card Packs & Bundles')}
          </button>
          <button
            type="button"
            data-testid="shop-tab-gold-prestige"
            onClick={() => {
              hsAudio.playSfx('mario_coin', 0.85);
              setShopTab('PRESTIGE');
            }}
            className={`hs-mario-spring min-h-[44px] rounded-xl px-3 py-2 transition ${
              shopTab === 'PRESTIGE'
                ? 'bg-gradient-to-b from-yellow-400 to-amber-700 text-stone-950 shadow-[0_0_16px_rgba(250,204,21,0.45)]'
                : 'text-yellow-200/85 hover:text-yellow-100'
            }`}
          >
            🪙 {tr('황금 주화 교환소 (4대 명예 치장)', 'Gold Prestige Exchange')}
          </button>
        </div>

        {toast && (
          <div className="mb-3.5 rounded-xl border border-amber-300 bg-amber-950/90 px-4 py-2 text-center text-xs font-extrabold text-yellow-200 shadow-lg">
            {toast}
          </div>
        )}

        {/* ==================== GOLD PRESTIGE EXCHANGE (DEV-027 / ISS-004 Visual In-Game Screenshots) ==================== */}
        {shopTab === 'PRESTIGE' && (
          <div data-testid="gold-prestige-exchange-panel" className="space-y-3">
            <div className="hs-ocarina-dialog flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-base">🪙</span>
                <div>
                  <div className="font-extrabold text-yellow-300 sm:text-sm">
                    {tr('황금 주화 명예 보상품 교환소', 'Gold Prestige Cosmetic Exchange')}
                  </div>
                  <div className="text-[11px] font-semibold text-sky-200/90">
                    {tr(
                      '아래 실제 인게임 적용 스크린샷을 확인하고 골드로 즉시 장착하세요!',
                      'Preview real in-game applied screenshots below & equip with Gold!',
                    )}
                  </div>
                </div>
              </div>
              <span className="flex items-center gap-1.5 rounded-full border border-yellow-300 bg-black/65 px-3 py-1 text-sm font-black text-yellow-300">
                <HsGoldCoinIcon size={17} />
                <span>{profile.gold.toLocaleString()}G</span>
              </span>
            </div>

            {/* 4 Prestige Category Sub-Tabs */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {(
                [
                  { id: 'BADGE', icon: '🛡️', ko: '프로필 뱃지', en: 'Badges' },
                  { id: 'FRAME', icon: '🖼️', ko: '카드 프레임', en: 'Card Frames' },
                  { id: 'CARDBACK', icon: '🎴', ko: '카드 뒷면 스킨', en: 'Card Backs' },
                  { id: 'TITLE', icon: '👑', ko: '캐릭터 호칭', en: 'Titles' },
                ] as { id: PrestigeCategory; icon: string; ko: string; en: string }[]
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`prestige-cat-${cat.id.toLowerCase()}`}
                  onClick={() => {
                    hsAudio.playSfx('gem_c_select');
                    setPrestigeCat(cat.id);
                  }}
                  className={`hs-mario-spring min-h-[44px] rounded-xl border px-2.5 py-2 text-xs font-extrabold transition ${
                    prestigeCat === cat.id
                      ? 'border-yellow-200 bg-amber-600 text-stone-950 shadow'
                      : 'border-amber-500/35 bg-stone-950/85 text-amber-100 hover:border-amber-300'
                  }`}
                >
                  {cat.icon} {isKo ? cat.ko : cat.en}
                </button>
              ))}
            </div>

            {/* Category Live In-Game Applied Screenshot Showcase Banner */}
            {(() => {
              const catSpec = PRESTIGE_CATEGORY_SHOWCASES[prestigeCat];
              const catImgUrl = isKo ? catSpec.screenshotKo : catSpec.screenshotEn;
              const catTitle = isKo ? catSpec.titleKo : catSpec.titleEn;
              const catWhere = isKo ? catSpec.whereKo : catSpec.whereEn;
              return (
                <div
                  data-testid="prestige-live-screenshot-banner"
                  className="overflow-hidden rounded-2xl border-2 border-amber-300/75 bg-stone-950/95 shadow-xl"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/35 bg-amber-950/60 px-3.5 py-2">
                    <div className="min-w-0">
                      <div className="text-xs font-black text-yellow-200 sm:text-sm">
                        📸 {catTitle}
                      </div>
                      <div className="text-[11px] font-bold text-amber-100/90">
                        📍 {catWhere}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="prestige-banner-zoom-btn"
                      onClick={() => {
                        hsAudio.playSfx('ui_click', 0.75);
                        setZoomedPrestigeImg({ src: catImgUrl, title: catTitle, where: catWhere });
                      }}
                      className="min-h-[36px] shrink-0 rounded-lg border border-yellow-300/60 bg-black/65 px-2.5 py-1 text-[11px] font-extrabold text-yellow-200 hover:border-yellow-200"
                    >
                      🔍 {tr('크게 보기', 'Enlarge')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      hsAudio.playSfx('ui_click', 0.75);
                      setZoomedPrestigeImg({ src: catImgUrl, title: catTitle, where: catWhere });
                    }}
                    className="group relative block w-full bg-black"
                  >
                    <img
                      data-testid="prestige-category-screenshot-img"
                      src={catImgUrl}
                      alt={catTitle}
                      decoding="async"
                      className="h-36 w-full object-cover object-center transition group-hover:opacity-95 sm:h-48"
                    />
                    <span className="pointer-events-none absolute bottom-2 right-2 rounded-full border border-amber-300/70 bg-black/80 px-2.5 py-0.5 text-[10px] font-extrabold text-yellow-200">
                      {tr('실제 인게임 적용 화면 (탭하여 확대)', 'Real In-Game Applied View (Tap to Zoom)')}
                    </span>
                  </button>
                </div>
              );
            })()}

            {/* Prestige Items Grid — Visual In-Game Screenshot Cards Instead of Text-Only Clutter */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {GOLD_PRESTIGE_ITEMS.filter((i) => i.category === prestigeCat).map((item) => {
                const isOwned =
                  item.costGold === 0 ||
                  (item.category === 'BADGE' && profile.prestige?.ownedBadges?.includes(item.id)) ||
                  (item.category === 'FRAME' && profile.prestige?.ownedFrames?.includes(item.id)) ||
                  (item.category === 'CARDBACK' &&
                    item.cardBackId &&
                    profile.prestige?.ownedCardBacks?.includes(item.cardBackId)) ||
                  (item.category === 'TITLE' && profile.prestige?.ownedTitles?.includes(item.id));
                const isEquipped =
                  (item.category === 'BADGE' && profile.prestige?.equippedBadge === item.id) ||
                  (item.category === 'FRAME' && profile.prestige?.equippedFrame === item.id) ||
                  (item.category === 'CARDBACK' && item.cardBackId === profile.selectedCardBack) ||
                  (item.category === 'TITLE' && profile.prestige?.equippedTitle === item.id);
                const canAfford = profile.gold >= item.costGold;
                const itemImgUrl = getPrestigeItemScreenshotUrl(item, isKo);
                const itemTitle = isKo ? item.nameKo : item.nameEn;
                const itemDesc = isKo ? item.descKo : item.descEn;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col justify-between overflow-hidden rounded-2xl border-2 p-2.5 ${item.accentClass} ${
                      isEquipped ? 'ring-2 ring-yellow-300' : ''
                    }`}
                  >
                    <div>
                      {/* Visual Real In-Game Applied Crop Preview */}
                      <button
                        type="button"
                        onClick={() => {
                          hsAudio.playSfx('ui_click', 0.7);
                          setZoomedPrestigeImg({
                            src: itemImgUrl,
                            title: `${item.icon} ${itemTitle}`,
                            where: itemDesc,
                          });
                        }}
                        className="group relative mb-2 block h-28 w-full overflow-hidden rounded-xl border border-amber-300/45 bg-black sm:h-32"
                      >
                        <img
                          data-testid={`prestige-item-screenshot-${item.id}`}
                          src={itemImgUrl}
                          alt={itemTitle}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover object-center transition duration-200 group-hover:scale-[1.03]"
                        />
                        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-2.5 py-1.5">
                          <span className="rounded-md border border-white/20 bg-black/70 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200">
                            {item.costGold === 0
                              ? tr('기본 지급', 'Default')
                              : `🪙 ${item.costGold.toLocaleString()}G`}
                          </span>
                          {isEquipped && (
                            <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-stone-950 shadow">
                              ✓ {tr('장착 중', 'Equipped')}
                            </span>
                          )}
                        </div>
                        <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-100/90">
                          🔍 {tr('인게임 적용 보기', 'Preview')}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 px-0.5">
                        <span className="text-base">{item.icon}</span>
                        <span className="truncate text-sm font-black text-white">{itemTitle}</span>
                      </div>
                      <p className="mt-0.5 truncate px-0.5 text-[11px] font-semibold text-amber-100/85">
                        {itemDesc}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid={`prestige-item-btn-${item.id}`}
                      disabled={isEquipped}
                      onClick={() => {
                        const res = hsStorage.purchaseOrEquipPrestige(item.id);
                        if (!res.ok) {
                          hsAudio.playSfx('gem_b_back');
                          showToast(
                            tr(
                              `골드가 부족합니다! (${item.costGold.toLocaleString()}G 필요 / 현재 ${profile.gold.toLocaleString()}G)`,
                              `Not enough Gold! (${item.costGold.toLocaleString()}G required / ${profile.gold.toLocaleString()}G owned)`,
                            ),
                          );
                          return;
                        }
                        if (res.action === 'PURCHASED') {
                          hsAudio.playSfx('zelda_chest_open', 0.9);
                          hsAudio.playSfx('mario_coin', 0.9);
                          showToast(
                            tr(
                              `🎉 [${item.nameKo}] 해금 및 즉시 장착 완료! (-${item.costGold.toLocaleString()}G)`,
                              `🎉 Unlocked & Equipped [${item.nameEn}]! (-${item.costGold.toLocaleString()}G)`,
                            ),
                          );
                        } else {
                          hsAudio.playSfx('gem_a_confirm');
                          showToast(
                            tr(
                              `✓ [${item.nameKo}] 장착 완료!`,
                              `✓ Equipped [${item.nameEn}]!`,
                            ),
                          );
                        }
                        if (!hsStorage.isSafeguardBonusClaimed()) {
                          setPrestigeBackupPromptOpen(true);
                        }
                        refresh();
                      }}
                      className={`hs-mario-spring mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition ${
                        isEquipped
                          ? 'cursor-default border border-emerald-400/50 bg-emerald-950/70 text-emerald-200'
                          : isOwned
                            ? 'hs-zelda-a-btn'
                            : canAfford
                              ? 'hs-zelda-c-btn'
                              : 'border border-stone-700 bg-stone-950/80 text-stone-400'
                      }`}
                    >
                      {isEquipped ? (
                        <span>✓ {tr('현재 장착됨', 'Currently Equipped')}</span>
                      ) : isOwned ? (
                        <span>{tr('즉시 장착하기', 'Equip Now')}</span>
                      ) : (
                        <>
                          <HsGoldCoinIcon size={15} />
                          <span>
                            {isKo
                              ? `${item.costGold.toLocaleString()}G로 해금 · 장착`
                              : `Unlock & Equip (${item.costGold.toLocaleString()}G)`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* MKT-060: Prestige Collection Backup & PWA Lock-in Prompt (+100G) */}
            {prestigeBackupPromptOpen && (
              <div
                data-testid="prestige-backup-lockin-banner"
                className="hs-ocarina-dialog flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-xs font-extrabold text-amber-100 shadow-lg"
              >
                <span className="min-w-0 flex-1">
                  👑{' '}
                  {tr(
                    '신규 명예 컬렉션 장착 완료! 브라우저 캐시 삭제 시 치장품이 사라지지 않도록 지금 백업 코드를 1초 복사하고 도박장 시드머니 +100G를 받으세요!',
                    'Prestige item equipped! Copy your backup code in 1 tap to protect your cosmetics & claim +100G seed Gold!',
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="prestige-backup-copy-btn"
                    onClick={async () => {
                      hsAudio.playSfx('mario_coin', 0.9);
                      const { jsonString } = hsStorage.exportGameBackupData();
                      try {
                        await navigator.clipboard.writeText(jsonString);
                      } catch {
                        hsStorage.downloadGameBackupFile();
                      }
                      const bonus = hsStorage.claimSafeguardBackupBonus();
                      setPrestigeBackupPromptOpen(false);
                      refresh();
                      showToast(
                        bonus.granted
                          ? tr(
                              '👑 명예 컬렉션 백업 코드 복사 완료! 시드머니 +100G가 지급되었습니다.',
                              '👑 Prestige backup copied! +100G seed Gold granted.',
                            )
                          : tr(
                              '👑 명예 컬렉션 백업 코드가 복사되었습니다.',
                              '👑 Prestige backup code copied.',
                            ),
                      );
                    }}
                    className="hs-zelda-a-btn min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-extrabold text-white"
                  >
                    {tr('📲 백업 코드 복사 (+100G)', '📲 Copy Backup (+100G)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrestigeBackupPromptOpen(false)}
                    className="min-h-[40px] rounded-xl border border-amber-400/40 bg-black/50 px-2.5 text-xs text-amber-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Full-Resolution In-Game Applied Screenshot Zoom Lightbox */}
            {zoomedPrestigeImg && (
              <div
                data-testid="prestige-screenshot-zoom-modal"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoomedPrestigeImg(null);
                }}
                className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 p-3 sm:p-6"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-yellow-300 bg-stone-950 shadow-2xl"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-amber-400/35 bg-amber-950/75 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-yellow-200 sm:text-base">
                        {zoomedPrestigeImg.title}
                      </div>
                      <div className="truncate text-xs font-semibold text-amber-100/85">
                        📍 {zoomedPrestigeImg.where}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setZoomedPrestigeImg(null)}
                      className="hs-brass-btn min-h-[40px] shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-amber-100"
                    >
                      {tr('닫기 ✕', 'Close ✕')}
                    </button>
                  </div>
                  <div className="bg-black p-2">
                    <img
                      src={zoomedPrestigeImg.src}
                      alt={zoomedPrestigeImg.title}
                      className="max-h-[72dvh] w-full rounded-xl object-contain"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {shopTab === 'PACKS' && (
          <>
        {/* Sequential 3-Step Indicator Bar */}
        <div className="mb-4 grid grid-cols-3 gap-1.5 rounded-2xl border border-[#c8a158]/45 bg-stone-950/85 p-1.5 text-center text-[11px] font-extrabold sm:text-xs">
          <button
            type="button"
            onClick={() => setStep('quantity')}
            className={`rounded-xl py-1.5 transition ${
              activeWizardStepNum === 1
                ? 'bg-gradient-to-b from-amber-500 to-amber-800 text-white shadow'
                : 'text-amber-200/75 hover:text-white'
            }`}
          >
            {tr('① 구매수량 선택', '① Select Bundle')}
          </button>
          <button
            type="button"
            disabled={activeWizardStepNum < 2}
            onClick={() => {
              if (activeWizardStepNum >= 2) setStep('country');
            }}
            className={`rounded-xl py-1.5 transition ${
              activeWizardStepNum === 2
                ? 'bg-gradient-to-b from-amber-500 to-amber-800 text-white shadow'
                : activeWizardStepNum > 2
                  ? 'text-amber-200 hover:text-white'
                  : 'cursor-not-allowed text-stone-500'
            }`}
          >
            {tr('② 결제국가 선택', '② Region / Currency')}
          </button>
          <div
            className={`rounded-xl py-1.5 ${
              activeWizardStepNum === 3
                ? 'bg-gradient-to-b from-sky-500 to-blue-800 text-white shadow'
                : 'text-stone-500'
            }`}
          >
            {tr('③ 결제수단 선택', '③ Payment Method')}
          </div>
        </div>

        {/* ==================== STEP 1: 구매수량 선택 (골드 구매 + 현금 패키지 선택) ==================== */}
        {step === 'quantity' && (
          <div className="space-y-4">
            {/* A. Gold Pack Purchase Section */}
            <div className="rounded-2xl border-2 border-yellow-400/55 bg-gradient-to-b from-amber-950/45 to-black/55 p-3.5 sm:p-4">
              {/* MKT-060: Currency Decoupling Value Guide (Gold for Bogart & Prestige vs $4 Cash Pack Bundle) */}
              <div
                data-testid="shop-currency-decouple-banner"
                className="mb-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-400/45 bg-sky-950/65 px-3 py-2 text-[11px] font-extrabold text-sky-100"
              >
                <span className="min-w-0 flex-1">
                  🎲{' '}
                  {tr(
                    '추천 팁: 소중한 골드는 [보가트의 도박장] 판돈과 [명예 호칭 · 24K 스킨] 해금에 아껴두고, 카드팩은 5팩 특가(5,600원/$4)로 여실 수 있습니다!',
                    "Tip: Save your Gold for [Bogart's Hall] wagers & [Gold Prestige Titles/Skins], and open 5 Packs at the $4 (20% OFF) bundle!",
                  )}
                </span>
                <button
                  type="button"
                  data-testid="shop-decouple-select-pack5-btn"
                  onClick={() => {
                    const pack5 = GAME_SHOP_PACKAGES.find((p) => p.id === 'pack_5');
                    if (pack5) handleSelectPackageToStep2(pack5);
                  }}
                  className="hs-zelda-a-btn min-h-[36px] shrink-0 rounded-lg px-2.5 py-1 text-[10.5px] font-extrabold text-white"
                >
                  {tr('💎 5팩 특가 선택 →', '💎 5-Pack Deal →')}
                </button>
              </div>
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <HsGoldCoinIcon size={18} />
                  <h3 className="hs-title text-sm font-extrabold text-yellow-300 sm:text-base">
                    {tr('보유 골드로 눈히어로 카드팩 즉시 구매', 'Buy Card Packs with Gold')}
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-300">
                  {tr(`현재 보유: ${profile.gold} 골드`, `Owned: ${profile.gold} Gold`)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {GOLD_PACK_BUNDLES.map((gb) => {
                  const canAfford = profile.gold >= gb.costGold;
                  const gbLoc = getGoldPackBundleLabel(gb, isKo);
                  return (
                    <div
                      key={gb.id}
                      className="flex flex-col justify-between rounded-xl border border-[#c8a158]/55 bg-stone-950/85 p-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-extrabold text-amber-100">{gbLoc.label}</span>
                          {gbLoc.badge && (
                            <span className="rounded-full bg-emerald-800/90 px-2 py-0.5 text-[9.5px] font-extrabold text-emerald-200">
                              {gbLoc.badge}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-amber-200/75">
                          {isKo
                            ? `총 ${gb.packs * 5}장 획득 · 희귀 이상 각 팩 1장 확정`
                            : `${gb.packs * 5} Cards Total · 1 Rare+ Guaranteed/Pack`}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleBuyGoldBundle(gb.packs, gb.costGold, gbLoc.label)}
                        className={`mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl text-xs font-extrabold transition ${
                          canAfford
                            ? 'hs-brass-btn border-yellow-300/80 text-yellow-200'
                            : 'border border-stone-700 bg-stone-900/80 text-stone-400 hover:border-amber-500/50'
                        }`}
                      >
                        <HsGoldCoinIcon size={15} />
                        <span>{isKo ? `${gb.costGold} 골드로 구매` : `Buy for ${gb.costGold} Gold`}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* B. Cash Package Quantity Selection -> Advances to Step 2 (`country`) */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="hs-title text-sm font-extrabold text-sky-200 sm:text-base">
                  {tr(
                    '보급 패키지 수량 선택 (선택 시 결제국가 선택으로 이동)',
                    'Supply Bundles (Select to choose payment region)',
                  )}
                </h3>
                <span className="text-[11px] font-bold text-amber-200/75">
                  {tr('팝업 안전결제 지원', 'Secure Popup Checkout')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {GAME_SHOP_PACKAGES.map((pkg) => {
                  const isBest = pkg.id === 'pack_5';
                  const alreadyOwnedAd = Boolean(pkg.isAdRemoval && vipAdRemoved);
                  const pl = isKo ? pkg : { ...pkg, ...(SHOP_PKG_EN[pkg.id] || {}) };
                  return (
                    <div
                      key={pkg.id}
                      className={`flex flex-col items-center justify-between rounded-2xl border-2 p-3.5 ${
                        isBest
                          ? 'border-yellow-300/80 bg-amber-950/40 shadow-[0_0_22px_rgba(250,204,21,0.2)]'
                          : 'border-[#c8a158]/50 bg-black/40'
                      }`}
                    >
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full border border-amber-300/50 bg-amber-950/85 px-2 py-0.5 text-[10px] font-extrabold text-yellow-300">
                            {pl.badge}
                          </span>
                          {pkg.packs > 0 && (
                            <span className="text-[11px] font-bold text-amber-200/80">
                              {isKo ? `${pkg.packs * 5}장 수령` : `${pkg.packs * 5} Cards`}
                            </span>
                          )}
                        </div>

                        <div className="my-2.5 flex flex-col items-center">
                          {pkg.packs > 0 ? (
                            <div className="h-24 w-18">
                              <SnsBoosterPackArt glowing={isBest} />
                            </div>
                          ) : (
                            <div className="flex h-24 w-18 items-center justify-center rounded-2xl border-2 border-[#c8a158] bg-stone-950/90 text-center text-xs font-extrabold text-yellow-300">
                              NO AD
                              <br />
                              VIP
                            </div>
                          )}
                          <div className="hs-title mt-2 text-center text-sm font-extrabold text-amber-100">
                            {pl.name}
                          </div>
                          <div className="mt-0.5 flex items-baseline gap-1.5">
                            <span className="hs-num text-lg text-yellow-300">
                              ${pkg.priceUsd % 1 === 0 ? pkg.priceUsd.toFixed(0) : pkg.priceUsd.toFixed(2)}
                            </span>
                            {isKo && (
                              <span className="text-xs font-bold text-amber-200/80">
                                ({pkg.priceKrw.toLocaleString()}원)
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-center text-[11px] font-semibold leading-relaxed text-amber-200/80">
                          {pl.description}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={alreadyOwnedAd}
                        onClick={() => handleSelectPackageToStep2(pkg)}
                        className={`mt-3 min-h-[42px] w-full rounded-xl py-2 text-xs font-extrabold sm:text-sm ${
                          isBest
                            ? 'hs-arcane-btn text-white'
                            : 'hs-brass-btn text-amber-100'
                        }`}
                      >
                        {alreadyOwnedAd
                          ? tr('광고 제거 적용됨', 'Ad Removal Active')
                          : tr(`수량 선택 ($${pkg.priceUsd.toFixed(2)}) →`, `Select ($${pkg.priceUsd.toFixed(2)}) →`)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {profile.packs > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoOpenPacks();
                }}
                className="hs-arcane-btn min-h-[44px] w-full rounded-xl py-2.5 text-xs font-extrabold text-white sm:text-sm"
              >
                {isKo
                  ? `눈히어로 팩 즉시 개봉하러 가기 (${profile.packs}개 보유 중) →`
                  : `Open Unopened Packs Now (${profile.packs} Left) →`}
              </button>
            )}

            {/* Official 3 SNS HERO Card Back Selector */}
            <div className="rounded-2xl border-2 border-[#c8a158]/50 bg-black/40 p-3.5">
              <h3 className="hs-title mb-2 text-sm font-extrabold text-amber-100">
                {tr('눈히어로 공식 카드 뒷면 변경', 'Official Card Backs')}
              </h3>
              <div className="grid grid-cols-3 gap-2.5">
                {CARD_BACK_IDS.map((cbId) => {
                  const active = profile.selectedCardBack === cbId;
                  const metaName = getSnsCardBackLabel(cbId).name;
                  return (
                    <button
                      key={cbId}
                      type="button"
                      onClick={() => handleSelectBack(cbId)}
                      className={`flex flex-col items-center rounded-xl border-2 p-2 transition ${
                        active
                          ? 'border-yellow-300 bg-amber-900/60 shadow-[0_0_16px_rgba(250,204,21,0.72)]'
                          : 'border-stone-700 bg-stone-900/60 hover:border-amber-500'
                      }`}
                    >
                      <div className="h-20 w-[56px]">
                        <SnsCardBackArt variant={cbId} />
                      </div>
                      <span className="mt-1.5 text-center text-[11px] font-extrabold leading-tight text-amber-100">
                        {metaName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 2: 결제국가 선택 팝업 단계 ==================== */}
        {step === 'country' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('quantity')}
                className="hs-brass-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-amber-100"
              >
                {tr('← ① 구매수량 다시 선택', '← ① Back to Bundles')}
              </button>
              <span className="text-xs font-extrabold text-amber-300">
                {tr('2 / 3 단계 · 결제국가 선택', 'Step 2 / 3 · Region & Currency')}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-2xl border-2 border-[#c8a158]/55 bg-black/45 p-3.5">
              <div>
                <div className="text-[11px] font-bold text-amber-300/80">
                  {tr('선택한 상품 수량', 'Selected Package')}
                </div>
                <div className="hs-title text-base font-extrabold text-amber-100">
                  {pkgLoc.name}
                </div>
                <div className="text-xs font-semibold text-amber-200/75">{pkgLoc.shortSpec}</div>
              </div>
              <div className="text-right">
                <div className="hs-num text-lg text-yellow-300">
                  ${selectedPkg.priceUsd.toFixed(2)}
                </div>
                {isKo && (
                  <div className="text-xs font-bold text-amber-200/85">
                    ({selectedPkg.priceKrw.toLocaleString()}원)
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="hs-title mb-2.5 text-base font-extrabold text-amber-100">
                {tr('결제하실 국가 / 통화 권역을 선택해 주세요', 'Choose your payment region & currency')}
              </h3>
              <div className="space-y-2">
                {CHECKOUT_COUNTRIES.map((c) => {
                  const cl = isKo ? c : { ...c, ...(COUNTRY_EN[c.code] || {}) };
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => handleSelectCountryToStep3(c.code)}
                      className="flex min-h-[56px] w-full items-center justify-between rounded-2xl border-2 border-[#c8a158]/45 bg-stone-950/85 px-4 py-2.5 text-left transition hover:border-yellow-300 hover:bg-amber-950/40"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{c.flag}</span>
                        <div>
                          <div className="text-sm font-extrabold text-amber-100">{cl.name}</div>
                          <div className="text-[11px] font-semibold text-amber-200/75">
                            {cl.subLabel}
                          </div>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg border border-amber-300/50 bg-amber-900/60 px-2.5 py-1 text-xs font-extrabold text-yellow-200">
                        {tr('선택 →', 'Select →')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== STEP 3: 결제수단 선택 팝업 단계 (새 팝업 창 결제) ==================== */}
        {step === 'method' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('country')}
                className="hs-brass-btn min-h-[38px] rounded-xl px-3.5 py-1.5 text-xs font-extrabold text-amber-100"
              >
                {tr('← ② 결제국가 변경', '← ② Change Region')}
              </button>
              <span className="text-xs font-extrabold text-sky-300">
                {tr(
                  `3 / 3 단계 · 결제수단 선택 (${selectedCountry.flag} ${selectedCountry.currency})`,
                  `Step 3 / 3 · Payment (${selectedCountry.flag} ${selectedCountry.currency})`,
                )}
              </span>
            </div>

            {/* Summary Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#c8a158]/55 bg-black/45 p-3.5">
              <div>
                <div className="text-[11px] font-bold text-amber-300/80">
                  {selectedCountry.flag} {countryLoc.name}
                </div>
                <div className="hs-title text-base font-extrabold text-amber-100">
                  {pkgLoc.name}
                </div>
              </div>
              <div className="text-right">
                {selectedCountry.currency === 'KRW' ? (
                  <>
                    <div className="hs-num text-xl text-yellow-300">
                      {selectedPkg.priceKrw.toLocaleString()}원
                    </div>
                    <div className="text-[11px] font-bold text-amber-200/75">
                      ({tr('글로벌', 'Global')} ${selectedPkg.priceUsd.toFixed(2)} USD)
                    </div>
                  </>
                ) : (
                  <>
                    <div className="hs-num text-xl text-yellow-300">
                      ${selectedPkg.priceUsd.toFixed(2)} USD
                    </div>
                    <div className="text-[11px] font-bold text-amber-200/75">
                      ({selectedPkg.priceKrw.toLocaleString()} KRW)
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Active Popup Waiting Notice (Main Page Stays Right Here!) */}
            {popupWaitingMethod && (
              <div className="rounded-2xl border-2 border-emerald-400/75 bg-emerald-950/75 p-3.5 text-xs">
                <div className="font-extrabold text-emerald-200">
                  {tr(
                    '🪟 새 팝업 창에서 결제가 진행 중입니다 (현재 게임 화면은 그대로 유지됩니다!)',
                    '🪟 Checkout opened in a popup window (Your game stays open here!)',
                  )}
                </div>
                <p className="mt-1 font-semibold text-amber-100/90">
                  {isKo ? (
                    <>
                      팝업 창에서 결제를 완료하시면 자동으로 팝업이 닫히고 현재 화면으로 돌아와{' '}
                      <b className="text-yellow-300">{pkgLoc.name}</b> 보상이 즉시 지급됩니다.
                    </>
                  ) : (
                    <>
                      Once checkout finishes in the popup window, it will close automatically and grant{' '}
                      <b className="text-yellow-300">{pkgLoc.name}</b> immediately.
                    </>
                  )}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleTriggerPopupCheckout(popupWaitingMethod)}
                    className="hs-brass-btn rounded-lg px-3 py-1.5 text-[11px] font-extrabold text-amber-100"
                  >
                    {tr('결제 팝업 창 다시 띄우기', 'Reopen Popup Window')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPopupWaitingMethod(null)}
                    className="rounded-lg border border-stone-600 bg-stone-900 px-3 py-1.5 text-[11px] font-bold text-stone-300"
                  >
                    {tr('안내 닫기', 'Dismiss')}
                  </button>
                </div>
              </div>
            )}

            {popupBlockedRetry && (
              <button
                type="button"
                onClick={() => handleTriggerPopupCheckout(popupBlockedRetry)}
                className="hs-arcane-btn min-h-[46px] w-full rounded-xl px-4 text-xs font-extrabold text-white sm:text-sm"
              >
                {tr(`🪟 차단된 결제 팝업 창 열기 (${pkgLoc.name})`, `🪟 Open Blocked Popup (${pkgLoc.name})`)}
              </button>
            )}

            {/* Clean Payment Methods Tailored by Country */}
            <div className="space-y-2.5">
              {selectedCountry.code === 'ko' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleTriggerPopupCheckout('card')}
                    className="hs-arcane-btn flex min-h-[50px] w-full items-center justify-between rounded-xl px-4 text-xs font-extrabold text-white sm:text-sm"
                  >
                    <span>{tr('💳 국내 신용 · 체크카드 (팝업 안전결제)', '💳 Domestic Credit / Debit Card (Popup)')}</span>
                    <span className="text-yellow-200">
                      {selectedPkg.priceKrw.toLocaleString()}원 →
                    </span>
                  </button>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleTriggerPopupCheckout('kakaopay')}
                      className="hs-brass-btn flex min-h-[48px] items-center justify-between rounded-xl px-4 text-xs font-extrabold text-yellow-200"
                    >
                      <span>{tr('💛 카카오페이 간편결제 (팝업)', '💛 KakaoPay (Popup)')}</span>
                      <span>{selectedPkg.priceKrw.toLocaleString()}원 →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerPopupCheckout('naverpay')}
                      className="hs-brass-btn flex min-h-[48px] items-center justify-between rounded-xl px-4 text-xs font-extrabold text-emerald-200"
                    >
                      <span>{tr('💚 네이버페이 간편결제 (팝업)', '💚 NaverPay (Popup)')}</span>
                      <span>{selectedPkg.priceKrw.toLocaleString()}원 →</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleTriggerPopupCheckout('paypal')}
                    className="hs-brass-btn flex min-h-[48px] w-full items-center justify-between rounded-xl px-4 text-xs font-extrabold text-amber-100 sm:text-sm"
                  >
                    <span>{tr('🌐 PayPal 글로벌 결제 (팝업)', '🌐 PayPal Global Checkout (Popup)')}</span>
                    <span className="text-yellow-300">
                      ${selectedPkg.priceUsd.toFixed(2)} USD →
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleTriggerPopupCheckout('paypal')}
                    className="hs-arcane-btn flex min-h-[50px] w-full items-center justify-between rounded-xl px-4 text-xs font-extrabold text-white sm:text-sm"
                  >
                    <span>{tr('🌐 PayPal · 해외 신용카드 Visa / Master (팝업 결제)', '🌐 PayPal · Visa / Mastercard (Popup)')}</span>
                    <span className="text-yellow-200">
                      ${selectedPkg.priceUsd.toFixed(2)} USD →
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTriggerPopupCheckout('applepay')}
                    className="hs-brass-btn flex min-h-[48px] w-full items-center justify-between rounded-xl px-4 text-xs font-extrabold text-amber-100 sm:text-sm"
                  >
                    <span>{tr('🍎 Apple Pay · 글로벌 카드 결제 (팝업 결제)', '🍎 Apple Pay · Global Card (Popup)')}</span>
                    <span className="text-yellow-300">
                      ${selectedPkg.priceUsd.toFixed(2)} USD →
                    </span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setCoinSearch('');
                  setStep('crypto_coin');
                }}
                className="hs-brass-btn flex min-h-[48px] w-full items-center justify-between rounded-xl px-4 text-xs font-extrabold text-sky-200 sm:text-sm"
              >
                <span>{tr('🪙 암호화폐 결제 (USDT · BTC · ETH · SOL · XRP)', '🪙 Cryptocurrency (USDT · BTC · ETH · SOL · XRP)')}</span>
                <span>{tr(`$${selectedPkg.priceUsd.toFixed(2)} 상당 →`, `~$${selectedPkg.priceUsd.toFixed(2)} →`)}</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================== CRYPTO SUB-STEPS ==================== */}
        {step === 'crypto_coin' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('method')}
                className="hs-brass-btn rounded-xl px-3.5 py-2 text-xs font-extrabold text-amber-100"
              >
                {tr('← ③ 결제수단 목록으로', '← ③ Back to Payment Methods')}
              </button>
              <span className="hs-num text-sm text-yellow-300">
                ${selectedPkg.priceUsd.toFixed(2)} USD
              </span>
            </div>

            <input
              type="text"
              value={coinSearch}
              onChange={(e) => setCoinSearch(e.target.value)}
              placeholder={tr('암호화폐 검색 (예: USDT, BTC, SOL)', 'Search crypto (e.g. USDT, BTC, SOL)')}
              className="min-h-[42px] w-full rounded-xl border border-[#c8a158]/50 bg-stone-950/90 px-3.5 text-xs font-bold text-amber-100 placeholder:text-amber-200/45 focus:border-yellow-300 focus:outline-none"
            />

            <div className="flex flex-wrap gap-1.5">
              {CRYPTO_QUICK_CHIPS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => handlePickCoin(sym)}
                  className="hs-brass-btn rounded-lg px-3 py-1.5 text-xs font-extrabold text-yellow-200"
                >
                  {sym}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {filteredCoins.map((coin) => (
                <button
                  key={coin.ccy}
                  type="button"
                  onClick={() => handlePickCoin(coin.ccy)}
                  className="flex min-h-[48px] items-center justify-between rounded-xl border border-[#c8a158]/45 bg-black/45 px-3.5 text-left hover:border-yellow-300"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/40 bg-stone-900 text-xs">
                      {coin.icon}
                    </span>
                    <div>
                      <div className="text-xs font-extrabold text-amber-100">{coin.ccy}</div>
                      <div className="text-[11px] text-amber-200/70">{coin.name}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-amber-300">
                    {isKo ? `체인 ${coin.chains.length}개 →` : `${coin.chains.length} chains →`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'crypto_chain' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('crypto_coin')}
                className="hs-brass-btn rounded-xl px-3.5 py-2 text-xs font-extrabold text-amber-100"
              >
                {tr('← 다른 코인 선택', '← Choose Another Coin')}
              </button>
              <span className="text-xs font-extrabold text-yellow-300">
                {tr(`${activeCoinObj.ccy} 네트워크 선택`, `Select ${activeCoinObj.ccy} Network`)}
              </span>
            </div>

            <div className="space-y-2">
              {activeCoinObj.chains.map((chainName, idx) => (
                <button
                  key={chainName}
                  type="button"
                  onClick={() => {
                    setSelectedChain(chainName);
                    setStep('crypto_deposit');
                  }}
                  className="flex min-h-[50px] w-full items-center justify-between rounded-xl border border-[#c8a158]/45 bg-black/45 px-4 text-left hover:border-yellow-300"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-amber-100">{chainName}</span>
                      {idx === 0 && (
                        <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[10px] font-extrabold text-yellow-300">
                          {tr('추천', 'Recommended')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-amber-200/70">
                      {tr('블록체인 컨펌 후 자동 반영 (약 1~3분)', 'Auto-credited after network confirmation (~1–3 min)')}
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-yellow-300">
                    {tr('선택 →', 'Select →')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'crypto_deposit' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setStep(activeCoinObj.chains.length > 1 ? 'crypto_chain' : 'crypto_coin')
                }
                className="hs-brass-btn rounded-xl px-3.5 py-2 text-xs font-extrabold text-amber-100"
              >
                {tr('← 네트워크 / 코인 변경', '← Change Network / Coin')}
              </button>
              <span className="rounded-full border border-yellow-300/60 bg-amber-950/80 px-3 py-1 text-xs font-extrabold text-yellow-300">
                {tr(`유효 시간 ${mm}:${ss}`, `Expires in ${mm}:${ss}`)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 rounded-2xl border-2 border-[#c8a158]/50 bg-black/45 p-4 sm:grid-cols-12">
              <div className="flex flex-col items-center justify-center rounded-xl border border-[#c8a158]/35 bg-white p-3 sm:col-span-5">
                <div
                  className="flex h-44 w-44 items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: cryptoDeposit.qrSvg }}
                />
                <span className="mt-1.5 text-[11px] font-extrabold text-stone-800">
                  {cryptoDeposit.ccy} ({cryptoDeposit.chain})
                </span>
              </div>

              <div className="flex flex-col justify-between space-y-3 sm:col-span-7">
                <div>
                  <div className="text-[11px] font-bold text-amber-300/80">
                    {tr('정확한 입금 수량', 'Exact Deposit Amount')}
                  </div>
                  <div className="hs-num mt-0.5 text-xl text-yellow-300">
                    {cryptoDeposit.amount} {cryptoDeposit.ccy}
                  </div>
                  <div className="text-[11px] text-amber-200/75">
                    {tr('상품 금액:', 'Total:')} ${selectedPkg.priceUsd.toFixed(2)} USD · {pkgLoc.name}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[11px] font-bold text-amber-300/80">
                    {tr(`입금 지갑 주소 (${cryptoDeposit.chain})`, `Deposit Wallet Address (${cryptoDeposit.chain})`)}
                  </div>
                  <div className="break-all rounded-xl border border-[#c8a158]/40 bg-stone-950/90 p-2.5 text-xs font-extrabold text-amber-100">
                    {cryptoDeposit.address}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyAddress(cryptoDeposit.address)}
                      className="hs-brass-btn flex-1 rounded-xl py-2.5 text-xs font-extrabold text-amber-100"
                    >
                      {copiedAddr ? tr('주소 복사 완료 ✓', 'Address Copied ✓') : tr('지갑 주소 복사', 'Copy Address')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDepositCheckMsg(
                          tr(
                            `블록체인 네트워크(${cryptoDeposit.chain})에서 입금 내역을 조회 중입니다. 전송 컨펌 완료 즉시 ${pkgLoc.name} 상품이 자동 지급됩니다.`,
                            `Checking ${cryptoDeposit.chain} for incoming transaction. ${pkgLoc.name} will be delivered once confirmed.`,
                          ),
                        )
                      }
                      className="hs-arcane-btn flex-1 rounded-xl py-2.5 text-xs font-extrabold text-white"
                    >
                      {tr('입금 완료 확인 요청', 'Verify Deposit')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {depositCheckMsg && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-950/85 p-3 text-xs font-bold text-yellow-200">
                {depositCheckMsg}
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export const PaymentSuccessModal: React.FC<{
  info: GamePaymentReturnResult;
  onOpenPacks: () => void;
  onClose: () => void;
}> = ({ info, onOpenPacks, onClose }) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  useModalDismiss(true, onClose);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const displayLabel = isKo
    ? info.label
    : info.packsGranted === 5
      ? 'SNSHero 5 Card Packs ($4.00)'
      : info.packsGranted === 1
        ? 'SNSHero 1 Card Pack ($1.00)'
        : info.isAdRemoval
          ? 'Permanent Ad Removal VIP ($2.99)'
          : info.label;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative w-full max-w-md rounded-3xl p-6 text-center text-amber-100"
      >
        <button
          type="button"
          data-testid="payment-success-close-btn"
          onClick={() => {
            hsAudio.playSfx('box_close');
            onClose();
          }}
          aria-label={tr('닫기', 'Close')}
          className="hs-brass-btn absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-amber-100"
        >
          ✕
        </button>
        <h2 className="hs-title px-8 text-2xl font-extrabold text-yellow-300">
          {tr('결제가 완료되었습니다!', 'Payment Complete!')}
        </h2>
        <p className="mt-2 text-sm font-bold text-amber-100">
          {isKo
            ? `${displayLabel} 상품이 계정에 즉시 반영되었습니다.`
            : `${displayLabel} has been added to your account.`}
        </p>
        {info.packsGranted && info.packsGranted > 0 && (
          <div className="my-4 flex flex-col items-center">
            <div className="h-28 w-20">
              <SnsBoosterPackArt glowing />
            </div>
            <span className="hs-num mt-2 text-lg text-yellow-300">
              {isKo ? `+${info.packsGranted}팩 지급 완료` : `+${info.packsGranted} Pack(s) Granted`}
            </span>
          </div>
        )}

        {/* MKT-024: 1-Second Vault Backup Safeguard */}
        <div className="mt-3 rounded-2xl border border-emerald-400/50 bg-emerald-950/60 p-3 text-left">
          <div className="text-[11px] font-extrabold text-emerald-200">
            🛡️ {tr('구매 내역 & 덱 1초 안전 금고 백업', '1-Second Vault Backup Safeguard')}
          </div>
          <p className="mt-0.5 text-[10.5px] font-semibold text-amber-100/85">
            {tr(
              '캐시가 삭제되어도 100% 복원되도록 지금 백업하세요! (최초 백업 시 +100 골드)',
              'Back up your purchase & decks locally now! (+100 Gold on first backup)',
            )}
          </p>
          {backupNotice && (
            <div className="mt-1 text-[10.5px] font-extrabold text-yellow-300">{backupNotice}</div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                hsStorage.downloadGameBackupFile();
                const bonus = hsStorage.claimSafeguardBackupBonus();
                setBackupNotice(
                  bonus.granted
                    ? tr('✓ 백업 저장 완료! +100 골드 지급!', '✓ Backup saved! +100 Gold granted!')
                    : tr('✓ 백업 파일 저장 완료!', '✓ Backup file saved!'),
                );
              }}
              className="hs-gold-btn flex-1 rounded-lg py-1.5 text-[11px] font-extrabold"
            >
              💾 {tr('백업 파일 저장', 'Save Backup')}
            </button>
            <button
              type="button"
              onClick={async () => {
                const { jsonString } = hsStorage.exportGameBackupData();
                try {
                  await navigator.clipboard.writeText(jsonString);
                  const bonus = hsStorage.claimSafeguardBackupBonus();
                  setBackupNotice(
                    bonus.granted
                      ? tr('✓ 코드 복사 완료! +100 골드 지급!', '✓ Copied! +100 Gold granted!')
                      : tr('✓ 백업 코드 복사 완료!', '✓ Backup code copied!'),
                  );
                } catch {
                  hsStorage.downloadGameBackupFile();
                }
              }}
              className="hs-brass-btn flex-1 rounded-lg py-1.5 text-[11px] font-extrabold text-amber-100"
            >
              📋 {tr('코드 복사', 'Copy Code')}
            </button>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          {info.packsGranted && info.packsGranted > 0 && (
            <button
              type="button"
              onClick={onOpenPacks}
              className="hs-arcane-btn flex-1 rounded-xl py-2.5 text-sm font-extrabold text-white"
            >
              {tr('팩 개봉하러 가기 →', 'Open Packs →')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="hs-brass-btn flex-1 rounded-xl py-2.5 text-sm font-extrabold text-amber-100"
          >
            {tr('현재 화면으로 계속하기', 'Continue')}
          </button>
        </div>
      </div>
    </div>
  );
};

type OptionsTabKey = 'SYSTEM' | 'BACKUP' | 'COMMUNITY';

export const GameOptionsModal: React.FC<{
  inBattle?: boolean;
  onConcede?: () => void;
  onGoHome?: () => void;
  onClose: () => void;
}> = ({ inBattle = false, onConcede, onGoHome, onClose }) => {
  const { lang, setLang } = useHeroLanguage();
  const isKo = lang === 'ko';
  useModalDismiss(true, onClose);

  const [activeTab, setActiveTab] = useState<OptionsTabKey>('SYSTEM');
  const [settings, setSettings] = useState<AudioSettings>(() => hsAudio.getSettings());
  const [, setPwaTick] = useState(0);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [pasteModalOpen, setPasteModalOpen] = useState<boolean>(false);
  const [pasteCodeInput, setPasteCodeInput] = useState<string>('');
  const [mobileQrUrl, setMobileQrUrl] = useState<string | null>(null);
  const [mobileQrSvg, setMobileQrSvg] = useState<string | null>(null);
  const vibSupport = useMemo(() => hsAudio.getVibrationSupportInfo(), []);

  useEffect(() => {
    return subscribePwaFullscreen(() => setPwaTick((n) => n + 1));
  }, []);

  const standaloneApp = isStandalonePwa();
  const fullscreenOn = isBrowserFullscreen() || standaloneApp;
  const fullscreenSupported = isFullscreenSupported();
  const canInstallPwa = shouldShowInstallButton();

  const update = (patch: Partial<AudioSettings>) => {
    hsAudio.updateSettings(patch);
    setSettings(hsAudio.getSettings());
  };

  const handleCopyBackup = async () => {
    hsAudio.playSfx('ui_click', 0.8);
    const { jsonString, keyCount } = hsStorage.exportGameBackupData();
    try {
      await navigator.clipboard.writeText(jsonString);
      setDataNotice(
        tr(
          `눈히어로 카드배틀 백업 코드(${keyCount}개 항목)가 복사되었습니다.`,
          `SNSHero backup code (${keyCount} entries) copied to clipboard.`,
        ),
      );
    } catch {
      hsStorage.downloadGameBackupFile();
      setDataNotice(
        tr(
          '백업 JSON 파일이 다운로드되었습니다.',
          'Backup JSON file downloaded.',
        ),
      );
    }
  };

  const handlePasteRestore = () => {
    hsAudio.playSfx('ui_click', 0.8);
    setPasteCodeInput('');
    setPasteModalOpen((prev) => !prev);
  };

  const applyPastedBackup = () => {
    const raw = pasteCodeInput.trim();
    if (!raw) {
      setDataNotice(tr('백업 JSON 코드를 먼저 입력해 주세요.', 'Please paste your backup JSON code first.'));
      return;
    }
    const res = hsStorage.restoreGameBackupJson(raw);
    setDataNotice(res.message);
    if (res.success) {
      setPasteModalOpen(false);
      setPasteCodeInput('');
    }
  };

  return (
    <div
      data-testid="game-options-modal"
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/82 p-3 backdrop-blur-sm sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl text-amber-100 shadow-[0_24px_60px_rgba(0,0,0,0.92)]"
      >
        {/* Inner Forged Brass Bezel Outline */}
        <div className="pointer-events-none absolute inset-2 rounded-[20px] border border-[#e2be75]/35" />

        {/* Modal Header (Matches Tavern Wood & Double Brass Sanctuary Design Guide) */}
        <div className="relative z-10 flex items-center justify-between gap-2 border-b border-amber-500/35 bg-black/25 px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#d4af63] bg-stone-950/85 text-amber-300 shadow">
              <Settings className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="hs-title text-base font-extrabold tracking-wide text-amber-100 sm:text-xl">
                {tr('게임 메뉴 · 환경 설정', 'Game Menu · Settings')}
              </h2>
              <p className="text-[11px] font-semibold text-amber-200/80">
                {inBattle
                  ? tr('전투 중 빠른 제어 및 시스템 관리', 'Battle controls & system settings')
                  : tr('시스템 설정 · 세이브 백업 · 세계관 안내', 'System · Backup · Universe Links')}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="options-close-btn"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            aria-label={tr('닫기', 'Close')}
            className="hs-brass-btn flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-amber-100"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable Body (`p-4` = 16px Padding) */}
        <div className="relative z-10 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {/* Top-Most Priority Action During Battle: Concede Match */}
          {inBattle && onConcede && (
            <button
              type="button"
              data-testid="options-concede-btn"
              onClick={() => {
                hsAudio.playSfx('menu_press');
                onClose();
                onConcede();
              }}
              className="hs-mario-spring flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-rose-400/80 bg-gradient-to-b from-rose-700 to-rose-950 text-sm font-extrabold text-rose-50 shadow-[0_10px_24px_rgba(190,18,60,0.45)] transition hover:brightness-110"
            >
              <Flag className="h-4 w-4 text-rose-200" strokeWidth={1.75} />
              <span>{tr('대결 항복하기', 'Concede Match')}</span>
            </button>
          )}

          {/* Tier 1: Top 2x2 Quick Action Grid (Sanctuary Glass & Brass Style) */}
          <div
            data-testid="options-quick-grid"
            className="grid grid-cols-2 gap-2.5"
          >
            <button
              type="button"
              data-testid="options-quick-sound"
              onClick={() => update({ muted: !settings.muted })}
              className={`hs-mario-spring flex min-h-[54px] items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left shadow-lg transition ${
                settings.muted
                  ? 'border-rose-400/75 bg-rose-950/80 text-rose-100'
                  : 'border-emerald-400/75 bg-emerald-950/75 text-emerald-100 hover:brightness-110'
              }`}
            >
              {settings.muted ? (
                <VolumeX className="h-5 w-5 shrink-0 text-rose-300" strokeWidth={1.75} />
              ) : (
                <Volume2 className="h-5 w-5 shrink-0 text-emerald-300" strokeWidth={1.75} />
              )}
              <div className="min-w-0">
                <div className="truncate text-xs font-extrabold">
                  {settings.muted ? tr('음소거 중', 'Muted') : tr('사운드 켜짐', 'Sound ON')}
                </div>
                <div className="truncate text-[10px] text-amber-200/80">
                  {tr('전체 오디오 전환', 'Toggle master sound')}
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="options-quick-fullscreen"
              disabled={!fullscreenSupported && !standaloneApp}
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.75);
                if (!standaloneApp && fullscreenSupported) toggleBrowserFullscreen();
              }}
              className={`hs-mario-spring relative flex min-h-[54px] items-center gap-2.5 rounded-2xl border-2 px-3 py-2 text-left shadow-lg transition ${
                fullscreenOn
                  ? 'border-sky-300 bg-sky-950/85 text-sky-100 shadow-[0_0_16px_rgba(56,189,248,0.35)]'
                  : 'hs-ocarina-dialog text-amber-100 hover:brightness-110'
              } disabled:opacity-45`}
            >
              {!fullscreenOn && (
                <span
                  data-testid="options-fullscreen-boost-badge"
                  className="absolute -right-1 -top-2 rounded-full border border-yellow-200 bg-gradient-to-b from-emerald-400 to-emerald-700 px-2 py-0.5 text-[9.5px] font-black text-stone-950 shadow-md"
                >
                  ⚡ {tr('성능Up!', 'FPS Up!')}
                </span>
              )}
              <Maximize2 className="h-5 w-5 shrink-0 text-sky-300" strokeWidth={1.75} />
              <div className="min-w-0">
                <div className="truncate text-xs font-extrabold text-white">
                  {fullscreenOn ? tr('전체화면 켜짐 ✓', 'Fullscreen ON ✓') : tr('전체화면 전환', 'Fullscreen Mode')}
                </div>
                <div className="truncate text-[10px] font-bold text-emerald-300/95">
                  {fullscreenOn
                    ? tr('최적 성능 가동 중', 'Peak FPS active')
                    : tr('전체화면 시 성능Up!', 'Boost FPS & responsiveness')}
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="options-quick-backup"
              onClick={() => {
                setActiveTab('BACKUP');
                void handleCopyBackup();
              }}
              className="hs-brass-btn hs-mario-spring flex min-h-[54px] items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-amber-100"
            >
              <Database className="h-5 w-5 shrink-0 text-amber-300" strokeWidth={1.75} />
              <div className="min-w-0">
                <div className="truncate text-xs font-extrabold">
                  {tr('백업 코드 복사', 'Quick Backup')}
                </div>
                <div className="truncate text-[10px] text-amber-200/80">
                  {tr('데이터 복원·QR 이동', 'Backup / Restore')}
                </div>
              </div>
            </button>

            <button
              type="button"
              data-testid="options-quick-home"
              onClick={() => {
                hsAudio.playSfx('box_close');
                if (onGoHome) onGoHome();
                else onClose();
              }}
              className="hs-brass-btn hs-mario-spring flex min-h-[54px] items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-amber-100"
            >
              <Home className="h-5 w-5 shrink-0 text-sky-300" strokeWidth={1.75} />
              <div className="min-w-0">
                <div className="truncate text-xs font-extrabold">
                  {inBattle ? tr('엘윈 로비로 이동', 'Return to Hub') : tr('로비로 닫기', 'Return to Lobby')}
                </div>
                <div className="truncate text-[10px] text-amber-200/80">
                  {inBattle ? tr('대결 종료 후 로비 복귀', 'Exit match to Hub') : tr('성소 메인 화면', 'Sanctuary Hub')}
                </div>
              </div>
            </button>
          </div>

          {/* Tier 2: 3 Category Switcher Tabs (Brass & Sapphire Sanctuary Tabs) */}
          <div
            role="tablist"
            className="grid grid-cols-3 gap-1.5 rounded-2xl border-2 border-[#c8a158]/50 bg-black/50 p-1.5 shadow-inner"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'SYSTEM'}
              data-testid="options-tab-system"
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.65);
                setActiveTab('SYSTEM');
              }}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold transition ${
                activeTab === 'SYSTEM'
                  ? 'hs-zelda-c-btn text-stone-950 shadow'
                  : 'text-amber-200/80 hover:bg-amber-950/45 hover:text-white'
              }`}
            >
              <Settings className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{tr('전투·시스템', 'System')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'BACKUP'}
              data-testid="options-tab-backup"
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.65);
                setActiveTab('BACKUP');
              }}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold transition ${
                activeTab === 'BACKUP'
                  ? 'hs-zelda-a-btn text-white shadow'
                  : 'text-amber-200/80 hover:bg-sky-950/45 hover:text-white'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{tr('백업·계정', 'Backup')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'COMMUNITY'}
              data-testid="options-tab-community"
              onClick={() => {
                hsAudio.playSfx('ui_click', 0.65);
                setActiveTab('COMMUNITY');
              }}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold transition ${
                activeTab === 'COMMUNITY'
                  ? 'hs-zelda-b-btn text-white shadow'
                  : 'text-amber-200/80 hover:bg-emerald-950/45 hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{tr('세계관·링크', 'Universe')}</span>
            </button>
          </div>

          {dataNotice && (
            <div
              data-testid="hs-data-notice"
              className="rounded-xl border border-emerald-400/60 bg-emerald-950/80 px-3 py-2 text-xs font-extrabold text-emerald-100 shadow"
            >
              {dataNotice}
            </div>
          )}

          {/* Tab Panel 1: 전투·시스템 설정 */}
          {activeTab === 'SYSTEM' && (
            <div className="hs-ocarina-dialog space-y-4 rounded-2xl p-4">
              {/* Language Switcher */}
              <div className="flex items-center justify-between gap-2 border-b border-amber-400/25 pb-3">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-amber-100">
                    {tr('언어 설정 (Language)', 'Language')}
                  </div>
                  <div className="mt-0.5 text-[11px] font-medium text-sky-200/80">
                    {tr('한국어 또는 영어로 전환', 'Switch between Korean and English')}
                  </div>
                </div>
                <div
                  data-testid="options-language-selector"
                  className="flex shrink-0 overflow-hidden rounded-xl border border-[#c8a158]/60 bg-stone-950/80 p-0.5 text-xs font-extrabold"
                >
                  <button
                    type="button"
                    data-testid="options-lang-en"
                    onClick={() => {
                      hsAudio.playSfx('ui_click', 0.75);
                      setLang('en');
                    }}
                    className={`min-h-[38px] rounded-lg px-2.5 transition ${
                      lang === 'en'
                        ? 'bg-amber-400 text-stone-950 shadow'
                        : 'text-amber-200/80 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    data-testid="options-lang-ko"
                    onClick={() => {
                      hsAudio.playSfx('ui_click', 0.75);
                      setLang('ko');
                    }}
                    className={`min-h-[38px] rounded-lg px-2.5 transition ${
                      lang === 'ko'
                        ? 'bg-amber-400 text-stone-950 shadow'
                        : 'text-amber-200/80 hover:text-white'
                    }`}
                  >
                    한국어
                  </button>
                </div>
              </div>

              {/* Compact Feature Toggles */}
              <div className="grid grid-cols-2 gap-2 border-b border-amber-400/25 pb-3">
                <button
                  type="button"
                  data-testid="toggle-tts-reading"
                  onClick={() => {
                    const nextEnabled = !settings.ttsEnabled;
                    hsAudio.playSfx('ui_click', 0.75);
                    update({ ttsEnabled: nextEnabled });
                  }}
                  className={`flex min-h-[48px] flex-col justify-center rounded-xl border px-3 py-2 text-left transition ${
                    settings.ttsEnabled
                      ? 'border-emerald-400/70 bg-emerald-950/60 text-emerald-100 shadow'
                      : 'border-amber-400/30 bg-black/45 text-amber-100/80'
                  }`}
                >
                  <span className="text-xs font-extrabold">
                    {settings.ttsEnabled ? tr('스토리 TTS 켜짐', 'Story TTS ON') : tr('스토리 TTS 꺼짐', 'Story TTS OFF')}
                  </span>
                  <span className="text-[10px] text-amber-200/75">
                    {tr('영웅명 · 대사 낭독', 'Narration voiceover')}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="toggle-attack-vibration"
                  onClick={() => {
                    const nextEnabled = !settings.vibrateEnabled;
                    hsAudio.playSfx('ui_click', 0.75);
                    update({ vibrateEnabled: nextEnabled });
                    if (nextEnabled) hsAudio.previewVibration();
                  }}
                  className={`flex min-h-[48px] flex-col justify-center rounded-xl border px-3 py-2 text-left transition ${
                    settings.vibrateEnabled
                      ? 'border-sky-300/70 bg-sky-900/55 text-sky-100 shadow'
                      : 'border-amber-400/30 bg-black/45 text-amber-100/80'
                  }`}
                >
                  <span className="text-xs font-extrabold">
                    {settings.vibrateEnabled ? tr('타격 진동 켜짐', 'Haptics ON') : tr('타격 진동 꺼짐', 'Haptics OFF')}
                  </span>
                  <span className="text-[10px] text-amber-200/75">
                    {vibSupport.supportedOnDevice ? tr('안드로이드 진동 지원', 'Device haptics ready') : tr('모바일 타격 피드백', 'Damage-scaled haptic')}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="toggle-emote-bubbles"
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.75);
                    update({ emoteBubblesEnabled: !(settings.emoteBubblesEnabled ?? true) });
                  }}
                  className={`flex min-h-[48px] flex-col justify-center rounded-xl border px-3 py-2 text-left transition ${
                    settings.emoteBubblesEnabled !== false
                      ? 'border-amber-300/70 bg-amber-950/60 text-amber-100 shadow'
                      : 'border-amber-400/30 bg-black/45 text-amber-100/75'
                  }`}
                >
                  <span className="text-xs font-extrabold">
                    {settings.emoteBubblesEnabled !== false
                      ? tr('도발 말풍선 켜짐', 'Emote Bubbles ON')
                      : tr('도발 말풍선 꺼짐', 'Emote Bubbles OFF')}
                  </span>
                  <span className="text-[10px] text-amber-200/75">
                    {tr('랭킹 도전자 실시간 대사', 'Challenger live emotes')}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="toggle-clutch-break"
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.75);
                    update({ kadanClutchBreakEnabled: !(settings.kadanClutchBreakEnabled ?? true) });
                  }}
                  className={`flex min-h-[48px] flex-col justify-center rounded-xl border px-3 py-2 text-left transition ${
                    settings.kadanClutchBreakEnabled !== false
                      ? 'border-purple-300/70 bg-purple-950/60 text-purple-100 shadow'
                      : 'border-amber-400/30 bg-black/45 text-amber-100/75'
                  }`}
                >
                  <span className="text-xs font-extrabold">
                    {settings.kadanClutchBreakEnabled !== false
                      ? tr('카단 승부처 ON', 'Clutch Break ON')
                      : tr('카단 승부처 OFF', 'Clutch Break OFF')}
                  </span>
                  <span className="text-[10px] text-amber-200/75">
                    {tr('자동 중 위기·킬각 5초 선택', '5s choice on lethal/crisis')}
                  </span>
                </button>

                <button
                  type="button"
                  data-testid="toggle-clean-card-view"
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.75);
                    update({ compactCleanCardView: !settings.compactCleanCardView });
                  }}
                  className={`col-span-2 flex min-h-[46px] items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                    settings.compactCleanCardView
                      ? 'border-cyan-300/75 bg-cyan-950/65 text-cyan-100 shadow'
                      : 'border-amber-400/30 bg-black/45 text-amber-100/80'
                  }`}
                >
                  <div>
                    <div className="text-xs font-extrabold">
                      {settings.compactCleanCardView
                        ? tr('🎨 전장 클린 아트 뷰 켜짐', '🎨 Clean Art Card View ON')
                        : tr('🎨 전장 기본 텍스트 뷰', '🎨 Standard Card Text View')}
                    </div>
                    <div className="text-[10px] text-amber-200/75">
                      {tr('평상시 일러스트·공체만 깔끔히 표시 (터치 시 효과 확인)', 'Show clean art & stats; tap/hover for card text')}
                    </div>
                  </div>
                  <span className="rounded-lg border border-white/20 bg-black/45 px-2 py-0.5 text-[10px] font-black">
                    {settings.compactCleanCardView ? 'CLEAN' : 'FULL'}
                  </span>
                </button>

                {/* DEV-044: Ocarina BGM Rhythm Auto Toggle & Latency Offset Calibration */}
                <div className="col-span-2 rounded-xl border border-amber-300/45 bg-stone-950/75 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-extrabold text-amber-100">
                        🎵 {tr('오카리나 BGM 리듬 오토 (1.5x · 2.0x)', 'Ocarina BGM Rhythm Auto (1.5x · 2.0x)')}
                      </div>
                      <div className="text-[10px] text-amber-200/75">
                        {tr(
                          '정박 탭 시 화음 연주 (스토리 공명 / 랭킹·도박장 골드 피버)',
                          'Tap on beat for harmonic chords (Story resonance / Ranked Gold Fever)',
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="toggle-rhythm-auto"
                      onClick={() => {
                        hsAudio.playSfx('ui_click', 0.75);
                        update({ rhythmAutoEnabled: !(settings.rhythmAutoEnabled ?? true) });
                      }}
                      className={`min-h-[38px] shrink-0 rounded-lg border px-2.5 text-xs font-black transition ${
                        settings.rhythmAutoEnabled !== false
                          ? 'border-yellow-200 bg-amber-400 text-stone-950 shadow'
                          : 'border-white/20 bg-black/50 text-amber-100/75'
                      }`}
                    >
                      {settings.rhythmAutoEnabled !== false ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="shrink-0 text-[10.5px] font-bold text-sky-200">
                      {tr('비트 싱크 보정', 'Sync Offset')}: {(settings.rhythmOffsetMs || 0) >= 0 ? `+${settings.rhythmOffsetMs || 0}` : settings.rhythmOffsetMs}ms
                    </span>
                    <input
                      type="range"
                      data-testid="rhythm-offset-slider"
                      min={-100}
                      max={100}
                      step={5}
                      value={settings.rhythmOffsetMs || 0}
                      onChange={(e) => update({ rhythmOffsetMs: Number(e.target.value) || 0 })}
                      className="h-2 flex-1 cursor-pointer accent-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* DEV-032: Lobby Sanctuary Sky Time Selector */}
              <div className="border-b border-amber-400/25 pb-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-extrabold text-amber-100">
                  <span>{tr('엘윈 성소 하늘 시간대', 'Sanctuary Sky Lighting')}</span>
                  <span className="text-[10.5px] text-sky-300">
                    {settings.lobbySkyTime || 'AUTO'}
                  </span>
                </div>
                <div
                  data-testid="options-sky-time-selector"
                  className="grid grid-cols-5 gap-1"
                >
                  {(
                    [
                      { id: 'AUTO', labelKo: '실시간', labelEn: 'Auto' },
                      { id: 'DAWN', labelKo: '🌅 아침', labelEn: '🌅 Dawn' },
                      { id: 'DAY', labelKo: '☀️ 한낮', labelEn: '☀️ Day' },
                      { id: 'DUSK', labelKo: '🌇 황혼', labelEn: '🌇 Dusk' },
                      { id: 'NIGHT', labelKo: '🌙 밤', labelEn: '🌙 Night' },
                    ] as const
                  ).map((opt) => {
                    const active = (settings.lobbySkyTime || 'AUTO') === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={`sky-time-${opt.id}`}
                        onClick={() => {
                          hsAudio.playSfx('gem_c_select', 0.7);
                          update({ lobbySkyTime: opt.id });
                        }}
                        className={`min-h-[38px] rounded-lg border px-1 text-[10.5px] font-extrabold transition ${
                          active
                            ? 'border-yellow-200 bg-amber-400 text-stone-950 shadow'
                            : 'border-amber-400/30 bg-black/45 text-amber-100/80 hover:text-white'
                        }`}
                      >
                        {isKo ? opt.labelKo : opt.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {canInstallPwa && (
                <div className="flex items-center justify-between gap-2 border-b border-amber-400/25 pb-3">
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-yellow-200">
                      {tr('홈 화면에 앱 설치 (+100G · 성능Up!)', 'Install PWA App (+100G · FPS Up!)')}
                    </div>
                    <div className="text-[10.5px] text-sky-200/80">
                      {tr('전체화면 앱 아이콘으로 즉시 쾌적하게 실행', 'Fullscreen home shortcut')}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="options-install-pwa"
                    onClick={async () => {
                      hsAudio.playSfx('ui_click', 0.8);
                      if (canInstallGamePwa()) {
                        const accepted = await promptInstallGamePwa();
                        if (!accepted) setInstallGuideOpen(true);
                      } else {
                        setInstallGuideOpen(true);
                      }
                    }}
                    className="hs-zelda-a-btn flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold text-white"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span>{tr('앱 설치', 'Install')}</span>
                  </button>
                </div>
              )}

              {installGuideOpen && (
                <PwaInstallGuideModal onClose={() => setInstallGuideOpen(false)} />
              )}

              {/* Volume Sliders */}
              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-xs font-bold text-amber-100">
                    <span>{tr('배경음악 (BGM · 기본 15%)', 'Music Volume (BGM)')}</span>
                    <span className="text-yellow-300">{Math.round(settings.bgmVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.bgmVolume * 100)}
                    onChange={(e) => update({ bgmVolume: Number(e.target.value) / 100 })}
                    className="mt-1 w-full accent-amber-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-amber-100">
                    <span>{tr('타격 · 원소 효과음 (SFX)', 'Combat & Spell SFX')}</span>
                    <span className="text-yellow-300">{Math.round(settings.sfxVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.sfxVolume * 100)}
                    onChange={(e) => update({ sfxVolume: Number(e.target.value) / 100 })}
                    className="mt-1 w-full accent-amber-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-amber-100">
                    <span>{tr('영웅 성우 음성 (VO)', 'Hero Voiceovers (VO)')}</span>
                    <span className="text-yellow-300">{Math.round(settings.voVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(settings.voVolume * 100)}
                    onChange={(e) => update({ voVolume: Number(e.target.value) / 100 })}
                    className="mt-1 w-full accent-amber-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab Panel 2: 백업·계정 (hero_hs_*) */}
          {activeTab === 'BACKUP' && (
            <div className="hs-ocarina-dialog space-y-3 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-yellow-200">
                  {tr('데이터 백업 · 복원', 'Save Backup & Restore')}
                </span>
                <span className="rounded-md border border-[#c8a158]/50 bg-black/50 px-2 py-0.5 font-mono text-[10px] text-amber-200">
                  hero_hs_*
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="hs-backup-download-btn"
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.8);
                    hsStorage.downloadGameBackupFile();
                    setDataNotice(
                      tr(
                        '눈히어로 카드배틀 백업 JSON 파일이 저장되었습니다.',
                        'SNSHero backup JSON file downloaded.',
                      ),
                    );
                  }}
                  className="hs-brass-btn flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-amber-100"
                >
                  <Download className="h-4 w-4 text-yellow-300" strokeWidth={1.75} />
                  <span>{tr('파일 저장', 'Save File')}</span>
                </button>
                <button
                  type="button"
                  data-testid="hs-backup-copy-btn"
                  onClick={handleCopyBackup}
                  className="hs-brass-btn flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-amber-100"
                >
                  <Copy className="h-4 w-4 text-yellow-300" strokeWidth={1.75} />
                  <span>{tr('코드 복사', 'Copy Code')}</span>
                </button>
                <label
                  data-testid="hs-restore-file-label"
                  className="hs-brass-btn flex min-h-[48px] cursor-pointer items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-sky-100"
                >
                  <Upload className="h-4 w-4 text-sky-300" strokeWidth={1.75} />
                  <span>{tr('파일 복원', 'Load File')}</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const content = String(ev.target?.result || '');
                        const res = hsStorage.restoreGameBackupJson(content);
                        setDataNotice(res.message);
                      };
                      reader.readAsText(file);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  data-testid="hs-restore-paste-btn"
                  onClick={handlePasteRestore}
                  className="hs-brass-btn flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-extrabold text-sky-100"
                >
                  <ClipboardPaste className="h-4 w-4 text-sky-300" strokeWidth={1.75} />
                  <span>{tr('코드 입력', 'Paste Code')}</span>
                </button>
              </div>

              {pasteModalOpen && (
                <div
                  data-testid="hs-restore-paste-modal"
                  className="space-y-2 rounded-xl border border-amber-400/55 bg-black/65 p-3 text-left"
                >
                  <div className="text-[11px] font-bold text-amber-200">
                    {tr(
                      '복원할 눈히어로 카드배틀 백업 JSON 코드를 붙여넣어 주세요:',
                      'Paste SNSHero Card Battle backup JSON code:',
                    )}
                  </div>
                  <textarea
                    data-testid="hs-restore-paste-textarea"
                    value={pasteCodeInput}
                    onChange={(e) => setPasteCodeInput(e.target.value)}
                    rows={3}
                    placeholder='{"version":1,"keys":{...}}'
                    className="w-full rounded-lg border border-amber-400/35 bg-stone-950 p-2 font-mono text-[11px] text-amber-100 placeholder:text-stone-500 focus:border-amber-300 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid="hs-restore-paste-apply-btn"
                      onClick={applyPastedBackup}
                      className="hs-zelda-a-btn min-h-[44px] flex-1 rounded-xl text-xs font-extrabold text-white"
                    >
                      {tr('복원 적용', 'Apply Restore')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPasteModalOpen(false)}
                      className="hs-brass-btn min-h-[44px] rounded-xl px-4 text-xs font-extrabold text-amber-100"
                    >
                      {tr('취소', 'Cancel')}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.8);
                  if (mobileQrUrl) {
                    setMobileQrUrl(null);
                    setMobileQrSvg(null);
                    return;
                  }
                  const { jsonString } = hsStorage.exportGameBackupData();
                  const compressed = LZString.compressToEncodedURIComponent(jsonString);
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://snshero.com';
                  const restoreUrl = `${origin}/game?restore=${compressed}`;
                  setMobileQrUrl(restoreUrl);
                  setMobileQrSvg(renderQrCodeSvg(restoreUrl, 160));
                  const bonus = hsStorage.claimSafeguardBackupBonus();
                  if (bonus.granted) {
                    setDataNotice(
                      tr(
                        'QR 연동 생성 완료! 최초 보호 보상 +100 골드가 지급되었습니다.',
                        'QR Sync Ready! +100 Gold safeguard bonus granted.',
                      ),
                    );
                  }
                }}
                className="hs-zelda-a-btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-extrabold text-white"
              >
                <QrCode className="h-4 w-4 shrink-0 text-yellow-200" strokeWidth={1.75} />
                <span>{tr('모바일로 덱 3초 연동 (QR 스캔)', 'Move My Decks to Phone in 3s (QR)')}</span>
              </button>

              {mobileQrUrl && mobileQrSvg && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-amber-300/50 bg-black/65 p-3 text-center">
                  <div
                    className="rounded-lg bg-white p-1.5"
                    dangerouslySetInnerHTML={{ __html: mobileQrSvg }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(mobileQrUrl);
                        setDataNotice(tr('1클릭 복원 URL이 복사되었습니다.', '1-Click Restore URL copied.'));
                      } catch {
                        window.prompt('Restore URL:', mobileQrUrl);
                      }
                    }}
                    className="hs-zelda-c-btn min-h-[44px] w-full rounded-xl text-xs font-extrabold text-stone-950"
                  >
                    {tr('1클릭 복원 URL 복사하기', 'Copy 1-Click Restore URL')}
                  </button>
                </div>
              )}

              <div className="border-t border-amber-400/25 pt-3">
                {!confirmReset ? (
                  <button
                    type="button"
                    data-testid="hs-reset-data-btn"
                    onClick={() => {
                      hsAudio.playSfx('ui_click', 0.8);
                      setConfirmReset(true);
                    }}
                    className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-rose-400/60 bg-rose-950/60 text-xs font-extrabold text-rose-100 hover:bg-rose-900/75"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    <span>{tr('세이브 데이터 초기화 (/game 전용)', 'Reset Save Data (/game only)')}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl border-2 border-rose-400/75 bg-rose-950/90 p-2.5">
                    <span className="flex-1 text-[11px] font-extrabold text-rose-100">
                      {tr('카드배틀(hero_hs_*) 데이터만 초기화할까요?', 'Reset all Card Battle progress?')}
                    </span>
                    <button
                      type="button"
                      data-testid="hs-confirm-reset-btn"
                      onClick={() => {
                        hsAudio.playSfx('ui_click', 0.85);
                        hsStorage.resetGameDataOnly();
                        setConfirmReset(false);
                        window.location.reload();
                      }}
                      className="min-h-[40px] rounded-lg bg-rose-600 px-3 text-xs font-extrabold text-white"
                    >
                      {tr('초기화', 'Reset')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="hs-brass-btn min-h-[40px] rounded-lg px-3 text-xs font-extrabold text-amber-100"
                    >
                      {tr('취소', 'Cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Panel 3: 세계관·커뮤니티 바로가기 */}
          {activeTab === 'COMMUNITY' && (
            <div className="hs-ocarina-dialog space-y-2.5 rounded-2xl p-4">
              <a
                href="/book"
                target="_blank"
                rel="noopener noreferrer"
                className="hs-brass-btn flex min-h-[48px] items-center justify-between rounded-xl px-3.5 py-2 text-amber-100"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4 text-yellow-300" strokeWidth={1.75} />
                  <div>
                    <div className="text-xs font-extrabold text-amber-100">
                      {tr('공식 웹소설 《카단의 여정》 40화', 'Official Web Novel (40 EPs)')}
                    </div>
                    <div className="text-[10.5px] text-amber-200/75">snshero.com/book</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-yellow-300">→</span>
              </a>

              <a
                href="/webtoon"
                target="_blank"
                rel="noopener noreferrer"
                className="hs-brass-btn flex min-h-[48px] items-center justify-between rounded-xl px-3.5 py-2 text-amber-100"
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-4 w-4 text-emerald-300" strokeWidth={1.75} />
                  <div>
                    <div className="text-xs font-extrabold text-amber-100">
                      {tr('공식 웹툰 840컷 풀컬러 정주행', 'Official Webtoon (840+ Panels)')}
                    </div>
                    <div className="text-[10.5px] text-amber-200/75">snshero.com/webtoon</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-300">→</span>
              </a>

              <a
                href="https://comic.naver.com/challenge/list?titleId=857363"
                target="_blank"
                rel="noopener noreferrer"
                className="hs-brass-btn flex min-h-[48px] items-center justify-between rounded-xl px-3.5 py-2 text-amber-100"
              >
                <div className="flex items-center gap-2.5">
                  <Tv className="h-4 w-4 text-green-300" strokeWidth={1.75} />
                  <div>
                    <div className="text-xs font-extrabold text-amber-100">
                      {tr('네이버 도전만화 공식 연재관', 'Naver Webtoon Challenge')}
                    </div>
                    <div className="text-[10.5px] text-amber-200/75">titleId=857363</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-green-300">→</span>
              </a>

              <a
                href="/promotion"
                target="_blank"
                rel="noopener noreferrer"
                className="hs-brass-btn flex min-h-[48px] items-center justify-between rounded-xl px-3.5 py-2 text-amber-100"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4 text-sky-300" strokeWidth={1.75} />
                  <div>
                    <div className="text-xs font-extrabold text-amber-100">
                      {tr('공식 소개 & 382종 도감 허브', 'Promotion & 382-Card Codex')}
                    </div>
                    <div className="text-[10.5px] text-amber-200/75">snshero.com/promotion</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-sky-300">→</span>
              </a>
            </div>
          )}
        </div>

        {/* Bottom Return Action */}
        <div className="relative z-10 border-t border-amber-500/35 bg-black/35 p-4 sm:px-5">
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            className="hs-arcane-btn hs-title hs-outline-sm hs-mario-spring flex min-h-[48px] w-full items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-xl"
          >
            {tr('게임으로 돌아가기', 'Return to Game')}
          </button>
        </div>
      </div>
    </div>
  );
};
