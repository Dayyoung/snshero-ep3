import React, { useEffect, useMemo, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
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
  computeOverallStanding,
  hsStorage,
} from '../storage';
import {
  DailyQuest,
  GameMode,
  PlayerProfile,
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
    description: 'Win 2 matches in Story Mode, Ranked, or Practice AI.',
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

const CARD_BACK_IDS: SnsCardBackId[] = ['gold', 'silver', 'bronze'];
const ALL_MODES_ORDER: GameMode[] = [
  'TUTORIAL',
  'RANKED',
  'CASUAL',
  'PRACTICE_NORMAL',
  'PRACTICE_EXPERT',
];

export const QuestLogModal: React.FC<{
  onClose: () => void;
  onProfileChanged: () => void;
}> = ({ onClose }) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  useModalDismiss(true, () => {
    hsAudio.playSfx('box_close');
    onClose();
  });

  const [openSection, setOpenSection] = useState<'NONE' | 'REWARDS' | 'QUESTS'>('NONE');
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
  const completedQuestsCount = quests.filter((q) => q.completed).length;

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

          <div className="rounded-xl border border-emerald-400/40 bg-emerald-950/55 px-3 py-1.5 text-xs font-extrabold text-emerald-200">
            {isKo
              ? `스토리모드: 환생 ${profile.journeyReincarnation}회차 · 제${profile.journeyEpisode}화`
              : `Story Mode: Cycle ${profile.journeyReincarnation} · EP ${profile.journeyEpisode}`}
          </div>
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
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h3 className="hs-title text-sm font-extrabold text-emerald-200">
                {tr('오늘의 엘윈마을 의뢰', 'Daily Elwin Village Quests')}
              </h3>
              <span className="text-[11px] font-semibold text-emerald-200/80">
                {tr('달성 시 골드 즉시 지급', 'Gold granted automatically')}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {quests.map((q) => {
                const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
                const qText = getLocalizedQuestText(q, isKo);
                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border-2 p-3.5 shadow ${
                      q.completed
                        ? 'border-emerald-400/70 bg-emerald-950/60 text-emerald-100'
                        : 'border-[#a88246] bg-[#f3e5c3] text-stone-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="hs-title text-sm font-extrabold">{qText.title}</span>
                      <span className="flex items-center gap-1 rounded-full border border-amber-900/40 bg-amber-400/90 px-2 py-0.5 text-xs font-black text-stone-950">
                        <HsGoldCoinIcon size={14} />
                        <span>+{q.rewardGold}G</span>
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-xs font-semibold ${
                        q.completed ? 'text-emerald-200' : 'text-stone-700'
                      }`}
                    >
                      {qText.description}
                    </p>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-800/35">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500"
                      />
                    </div>
                    <div className="mt-1 text-right text-[11px] font-extrabold">
                      {q.completed ? tr('보상 지급 완료 ✓', 'Completed ✓') : `${q.progress} / ${q.goal}`}
                    </div>
                  </div>
                );
              })}
            </div>
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

        {toast && (
          <div className="mb-3.5 rounded-xl border border-amber-300 bg-amber-950/90 px-4 py-2 text-center text-xs font-extrabold text-yellow-200 shadow-lg">
            {toast}
          </div>
        )}

        {/* ==================== STEP 1: 구매수량 선택 (골드 구매 + 현금 패키지 선택) ==================== */}
        {step === 'quantity' && (
          <div className="space-y-4">
            {/* A. Gold Pack Purchase Section */}
            <div className="rounded-2xl border-2 border-yellow-400/55 bg-gradient-to-b from-amber-950/45 to-black/55 p-3.5 sm:p-4">
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

export const GameOptionsModal: React.FC<{
  inBattle?: boolean;
  onConcede?: () => void;
  onClose: () => void;
}> = ({ inBattle = false, onConcede, onClose }) => {
  const { lang, setLang } = useHeroLanguage();
  useModalDismiss(true, onClose);

  const [settings, setSettings] = useState<AudioSettings>(() => hsAudio.getSettings());
  const [, setPwaTick] = useState(0);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
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
          `✓ 눈히어로 카드배틀 백업 코드(${keyCount}개 항목)가 복사되었습니다.`,
          `✓ SNSHero backup code (${keyCount} entries) copied to clipboard.`,
        ),
      );
    } catch {
      hsStorage.downloadGameBackupFile();
      setDataNotice(
        tr(
          '✓ 백업 JSON 파일이 다운로드되었습니다.',
          '✓ Backup JSON file downloaded.',
        ),
      );
    }
  };

  const handlePasteRestore = () => {
    hsAudio.playSfx('ui_click', 0.8);
    const raw = window.prompt(
      tr(
        '복원할 눈히어로 카드배틀(/game.html) 백업 JSON 코드를 붙여넣어 주세요:',
        'Paste SNSHero Card Battle (/game.html) backup JSON code to restore:',
      ),
    );
    if (!raw || !raw.trim()) return;
    const res = hsStorage.restoreGameBackupJson(raw.trim());
    setDataNotice(res.message);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-5 text-amber-100 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-amber-500/30 pb-3">
          <h2 className="hs-title text-xl font-extrabold text-amber-100 sm:text-2xl">
            {tr('환경 설정', 'Settings')}
          </h2>
          <button
            type="button"
            data-testid="options-close-btn"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            aria-label={tr('닫기', 'Close')}
            className="hs-brass-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-amber-100"
          >
            ✕
          </button>
        </div>

        {inBattle && onConcede && (
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('menu_press');
              onClose();
              onConcede();
            }}
            className="mb-4 w-full rounded-2xl border-2 border-red-300 bg-gradient-to-b from-red-600 to-red-950 py-3 text-base font-extrabold text-white shadow-lg hover:brightness-110"
          >
            {tr('대결 항복하기', 'Concede Match')}
          </button>
        )}

        <div className="space-y-3 rounded-2xl border border-[#c8a158]/40 bg-black/40 p-4">
          {/* Language / 언어 설정 */}
          <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-amber-100">
                {tr('언어 설정 (Language)', 'Language')}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-amber-200/75">
                {tr('한국어 또는 영어로 전환', 'Switch between English and Korean')}
              </div>
            </div>
            <div
              data-testid="options-language-selector"
              className="flex shrink-0 overflow-hidden rounded-lg border border-amber-300/60 bg-stone-950/90 p-0.5 text-xs font-extrabold"
            >
              <button
                type="button"
                data-testid="options-lang-en"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.75);
                  setLang('en');
                }}
                className={`rounded-md px-2.5 py-1 transition ${
                  lang === 'en'
                    ? 'bg-amber-500 text-stone-950 shadow'
                    : 'text-amber-100/80 hover:text-white'
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
                className={`rounded-md px-2.5 py-1 transition ${
                  lang === 'ko'
                    ? 'bg-amber-500 text-stone-950 shadow'
                    : 'text-amber-100/80 hover:text-white'
                }`}
              >
                한국어
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-amber-100">
                {tr('전체화면 모드 (PWA)', 'Fullscreen Mode (PWA)')}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-amber-200/75">
                {standaloneApp
                  ? tr('독립형 전체화면 PWA 앱 모드로 실행 중', 'Running in standalone PWA mode')
                  : tr(
                      '브라우저 주소창을 숨기고 몰입형 전체화면으로 플레이',
                      'Hide browser bars for immersive fullscreen play',
                    )}
              </div>
            </div>
            {standaloneApp ? (
              <span className="shrink-0 rounded-lg border border-emerald-300/60 bg-emerald-900/80 px-3 py-1.5 text-xs font-extrabold text-emerald-100">
                {tr('PWA 전체화면 ✓', 'PWA Fullscreen ✓')}
              </span>
            ) : (
              <button
                type="button"
                data-testid="toggle-fullscreen-mode"
                disabled={!fullscreenSupported}
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.75);
                  toggleBrowserFullscreen();
                }}
                className={`min-h-[38px] shrink-0 rounded-lg border px-3.5 py-1.5 text-xs font-extrabold transition ${
                  fullscreenOn
                    ? 'border-emerald-300/60 bg-emerald-800 text-white'
                    : 'border-amber-300/60 bg-amber-900/80 text-amber-100 hover:brightness-110'
                } disabled:opacity-45`}
              >
                {fullscreenOn ? tr('전체화면 켜짐', 'Fullscreen ON') : tr('전체화면 전환', 'Toggle Fullscreen')}
              </button>
            )}
          </div>

          {canInstallPwa && (
            <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 pt-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-sky-200">
                  {tr('홈 화면에 앱 설치', 'Install App to Home Screen')}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-amber-200/75">
                  {tr('바탕화면 아이콘으로 언제든 즉시 전체화면 실행', 'Launch fullscreen anytime from your home icon')}
                </div>
              </div>
              <button
                type="button"
                data-testid="options-install-pwa"
                onClick={async () => {
                  hsAudio.playSfx('ui_click', 0.8);
                  if (canInstallGamePwa()) {
                    const accepted = await promptInstallGamePwa();
                    if (!accepted) {
                      setInstallGuideOpen(true);
                    }
                  } else {
                    setInstallGuideOpen(true);
                  }
                }}
                className="hs-arcane-btn min-h-[38px] shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-extrabold text-white"
              >
                📲 {tr('게임설치', 'Install Game')}
              </button>
            </div>
          )}

          {installGuideOpen && (
            <PwaInstallGuideModal onClose={() => setInstallGuideOpen(false)} />
          )}

          <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 pt-3">
            <span className="text-sm font-extrabold">{tr('사운드 출력', 'Master Sound')}</span>
            <button
              type="button"
              onClick={() => update({ muted: !settings.muted })}
              className={`min-h-[38px] rounded-lg border px-3.5 py-1.5 text-xs font-extrabold ${
                settings.muted
                  ? 'border-red-300/60 bg-red-800 text-white'
                  : 'border-emerald-300/60 bg-emerald-800 text-white'
              }`}
            >
              {settings.muted ? tr('음소거 켜짐', 'Muted') : tr('사운드 켜짐', 'Sound ON')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 pt-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-amber-100">
                {tr('스토리 낭독 & TTS 읽어주기', 'Story Narration & TTS')}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-amber-200/75">
                {tr(
                  '에피소드 5컷 요약 문구 및 영웅명 음성 낭독 (끄면 자막만 표시)',
                  'Read episode summaries & hero callouts aloud (subtitles only when off)',
                )}
              </div>
            </div>
            <button
              type="button"
              data-testid="toggle-tts-reading"
              onClick={() => {
                const nextEnabled = !settings.ttsEnabled;
                hsAudio.playSfx('ui_click', 0.75);
                update({ ttsEnabled: nextEnabled });
              }}
              className={`min-h-[38px] shrink-0 rounded-lg border px-3.5 py-1.5 text-xs font-extrabold transition ${
                settings.ttsEnabled
                  ? 'border-emerald-300/60 bg-emerald-800 text-white'
                  : 'border-stone-400/50 bg-stone-800 text-stone-200'
              }`}
            >
              {settings.ttsEnabled ? tr('TTS 켜짐', 'TTS ON') : tr('TTS 꺼짐', 'TTS OFF')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 pt-3">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-amber-100">
                {tr('공격 시 진동 (Android)', 'Impact Vibration (Android)')}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-amber-200/75">
                {vibSupport.supportedOnDevice
                  ? tr(
                      '주고받는 데미지에 비례해 타격 진동 강도 자동 조절',
                      'Haptic intensity scales automatically with combat damage',
                    )
                  : tr(
                      '안드로이드 웹 접속 시 데미지 비례 타격 진동 작동',
                      'Damage-scaled haptic feedback works on Android browsers',
                    )}
              </div>
            </div>
            <button
              type="button"
              data-testid="toggle-attack-vibration"
              onClick={() => {
                const nextEnabled = !settings.vibrateEnabled;
                hsAudio.playSfx('ui_click', 0.75);
                update({ vibrateEnabled: nextEnabled });
                if (nextEnabled) {
                  hsAudio.previewVibration();
                }
              }}
              className={`min-h-[38px] shrink-0 rounded-lg border px-3.5 py-1.5 text-xs font-extrabold transition ${
                settings.vibrateEnabled
                  ? 'border-emerald-300/60 bg-emerald-800 text-white'
                  : 'border-stone-400/50 bg-stone-800 text-stone-200'
              }`}
            >
              {settings.vibrateEnabled ? tr('진동 켜짐', 'Vibrate ON') : tr('진동 꺼짐', 'Vibrate OFF')}
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-amber-200">
              <span>{tr('잔잔한 배경음악 (BGM · 기본 15%)', 'Background Music (BGM · Default 15%)')}</span>
              <span>{Math.round(settings.bgmVolume * 100)}%</span>
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
            <div className="flex justify-between text-xs font-bold text-amber-200">
              <span>{tr('타격 · 원소 효과음 (SFX)', 'Combat & Spell SFX')}</span>
              <span>{Math.round(settings.sfxVolume * 100)}%</span>
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
            <div className="flex justify-between text-xs font-bold text-amber-200">
              <span>{tr('영웅 성우 음성 (VO)', 'Hero Voiceovers (VO)')}</span>
              <span>{Math.round(settings.voVolume * 100)}%</span>
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

          {/* /game.html 전용 (hero_hs_*) 독립 세이브 백업 · 복원 · 초기화 */}
          <div className="space-y-2 border-t border-amber-500/25 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-yellow-300">
                {tr('데이터 백업 · 복원 (카드배틀 전용)', 'Save Backup & Restore')}
              </span>
              <span className="rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-200/80">
                {tr('hero_hs_* 독립 저장소', 'hero_hs_* Storage')}
              </span>
            </div>

            {dataNotice && (
              <div
                data-testid="hs-data-notice"
                className="rounded-lg border border-emerald-400/50 bg-emerald-950/80 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200"
              >
                {dataNotice}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                data-testid="hs-backup-download-btn"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.8);
                  hsStorage.downloadGameBackupFile();
                  setDataNotice(
                    tr(
                      '✓ 눈히어로 카드배틀 백업 JSON 파일이 저장되었습니다.',
                      '✓ SNSHero backup JSON file downloaded.',
                    ),
                  );
                }}
                className="hs-brass-btn rounded-lg py-2 text-[11px] font-extrabold text-amber-100"
              >
                💾 {tr('백업 파일 저장', 'Download Backup')}
              </button>
              <button
                type="button"
                data-testid="hs-backup-copy-btn"
                onClick={handleCopyBackup}
                className="hs-brass-btn rounded-lg py-2 text-[11px] font-extrabold text-amber-100"
              >
                📋 {tr('백업 코드 복사', 'Copy Backup Code')}
              </button>
              <label
                data-testid="hs-restore-file-label"
                className="hs-brass-btn flex cursor-pointer items-center justify-center rounded-lg py-2 text-center text-[11px] font-extrabold text-amber-100"
              >
                <span>📂 {tr('파일로 복원', 'Restore File')}</span>
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
                className="hs-brass-btn rounded-lg py-2 text-[11px] font-extrabold text-amber-100"
              >
                📥 {tr('코드 붙여넣기', 'Paste Backup Code')}
              </button>
            </div>

            {!confirmReset ? (
              <button
                type="button"
                data-testid="hs-reset-data-btn"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.8);
                  setConfirmReset(true);
                }}
                className="mt-1 w-full rounded-lg border border-red-400/50 bg-red-950/60 py-1.5 text-[11px] font-extrabold text-red-200 hover:bg-red-900/70"
              >
                🗑 {tr('카드배틀 데이터 초기화 (/game.html 전용)', 'Reset Game Data (/game.html only)')}
              </button>
            ) : (
              <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-400/70 bg-red-950/90 p-2">
                <span className="flex-1 text-[11px] font-extrabold text-red-100">
                  {tr(
                    '카드배틀(hero_hs_*) 데이터만 초기화할까요?',
                    'Reset all Card Battle (hero_hs_*) progress?',
                  )}
                </span>
                <button
                  type="button"
                  data-testid="hs-confirm-reset-btn"
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.85);
                    hsStorage.resetGameDataOnly();
                    setConfirmReset(false);
                    setDataNotice(
                      tr(
                        '✓ 카드배틀(hero_hs_*) 데이터가 초기 상태로 리셋되었습니다. 화면을 새로고침합니다...',
                        '✓ Card Battle data reset to default. Reloading...',
                      ),
                    );
                    window.location.reload();
                  }}
                  className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-extrabold text-white"
                >
                  {tr('초기화', 'Reset')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded bg-stone-700 px-2.5 py-1 text-[11px] font-extrabold text-stone-200"
                >
                  {tr('취소', 'Cancel')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            className="hs-brass-btn w-full rounded-xl py-2.5 text-sm font-extrabold text-amber-100"
          >
            {tr('게임으로 돌아가기', 'Return to Game')}
          </button>
        </div>
      </div>
    </div>
  );
};
