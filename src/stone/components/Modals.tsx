import React, { useMemo, useState } from 'react';
import { useHeroLanguage, type HeroLanguage } from '../../i18n/heroLang';
import { AudioSettings, hsAudio } from '../audio';
import {
  CLASS_CREST_URL,
  cardDb,
  getStarsNeededForRank,
} from '../cardDb';
import { HsArcaneDustVialIcon, HsGoldCoinIcon } from './CardVisual';
import { getCardBackName, getLocalizedHeroInfo, getRankTitle } from '../i18nData';
import { hsStorage } from '../storage';
import {
  CLASSIC_HEROES,
  HERO_CLASS_ORDER,
  PlayerProfile,
} from '../types';
import { useModalDismiss } from '../useModalDismiss';

const CARD_BACK_ITEMS: {
  id: PlayerProfile['selectedCardBack'];
  name: string;
  img: string;
}[] = [
  { id: 'classic', name: '오리지널 기본', img: '/stone-assets/ui/cardback_classic.webp' },
  { id: 'legend', name: '전설의 문장', img: '/stone-assets/ui/cardback_legend.webp' },
  { id: 'frost', name: '노스렌드 서리', img: '/stone-assets/ui/cardback_frost.webp' },
  { id: 'gold', name: '황금 여관', img: '/stone-assets/ui/cardback_gold.webp' },
];

export const QuestLogModal: React.FC<{
  onClose: () => void;
  onProfileChanged: () => void;
}> = ({ onClose }) => {
  const { lang, tr } = useHeroLanguage();
  useModalDismiss(true, () => {
    hsAudio.playSfx('box_close');
    onClose();
  });

  const [openSection, setOpenSection] = useState<'NONE' | 'REWARDS' | 'QUESTS'>('NONE');
  const profile = hsStorage.getProfile();
  const quests = hsStorage.getQuests();
  const rankTitle = getRankTitle(profile.rank, lang);
  const starsNeeded = getStarsNeededForRank(profile.rank);
  const rankMedalImg =
    profile.rank === 0 ? '/stone-assets/ui/medal_legend.webp' : '/stone-assets/ui/medal_bronze.webp';

  const wins = Math.max(0, profile.totalWins);
  const totalGames = Math.max(wins, profile.totalGames);
  const losses = Math.max(0, totalGames - wins);
  const winRatePct = totalGames > 0 ? Math.round((wins / totalGames) * 1000) / 10 : 0;
  const winRateLabel = totalGames > 0 ? winRatePct.toFixed(1) : '0.0';
  const completedQuestsCount = quests.filter((q) => q.completed).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6 text-amber-100"
      >
        <div className="mb-4 flex items-center justify-between border-b border-amber-600/35 pb-3">
          <div className="flex items-center gap-3">
            <img
              src="/stone-assets/ui/hs_questlog.webp"
              alt={tr('퀘스트 일지', 'Quest Log')}
              className="h-12 w-12 rounded-xl border-2 border-[#d4af63] object-cover shadow"
            />
            <div>
              <h2 className="hs-title text-2xl font-extrabold text-amber-100">
                {tr('모험가의 퀘스트 일지', "Adventurer's Quest Log")}
              </h2>
              <p className="text-xs font-semibold text-amber-300/85">
                {tr(
                  '오리지널 등급전 전적 · 일일 퀘스트 · 9대 직업 승리 기록',
                  'Classic Ranked Record · Daily Quests · 9 Class Wins',
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            className="hs-brass-btn rounded-xl px-3.5 py-1.5 text-sm font-extrabold text-amber-100"
          >
            {tr('닫기 ✕', 'Close ✕')}
          </button>
        </div>

        {/* Top Row: Rank Medallion + Sculpted Currencies */}
        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex items-center gap-4 rounded-2xl border-2 border-[#c8a158]/50 bg-black/40 p-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <img
                src={rankMedalImg}
                alt={tr('등급 메달', 'Rank Medal')}
                className="h-full w-full object-contain drop-shadow-[0_6px_14px_rgba(0,0,0,0.9)]"
              />
              {profile.rank > 0 && (
                <span className="hs-num absolute bottom-0 right-0 rounded-full border border-amber-200 bg-stone-950/95 px-2 py-0.5 text-xs text-amber-200">
                  {profile.rank}
                </span>
              )}
            </div>
            <div>
              <div className="hs-title text-lg font-extrabold text-amber-100">
                {profile.rank === 0
                  ? tr('전설 (LEGEND)', 'LEGEND')
                  : tr(`${profile.rank}등급 · ${rankTitle}`, `Rank ${profile.rank} · ${rankTitle}`)}
              </div>
              {profile.rank > 0 ? (
                <div className="mt-1 flex items-center gap-1 text-base">
                  {Array.from({ length: starsNeeded }).map((_, idx) => (
                    <span
                      key={idx}
                      className={idx < profile.stars ? 'text-yellow-300' : 'text-stone-600'}
                    >
                      ★
                    </span>
                  ))}
                  <span className="ml-2 text-xs font-bold text-amber-300/80">
                    ({profile.stars} / {starsNeeded})
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-xs font-bold text-yellow-300">
                  {tr('최고 등급 전설 달성!', 'Highest Rank Achieved!')}
                </div>
              )}
              <div className="mt-1.5 text-xs font-semibold text-amber-200/75">
                {tr(
                  `통산 ${profile.totalWins}승 / ${profile.totalGames}전 · 현재 ${profile.winStreak}연승`,
                  `Career ${profile.totalWins}W / ${profile.totalGames}G · ${profile.winStreak} Streak`,
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-[#c8a158]/50 bg-black/40 p-4 text-center">
            <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/25 bg-stone-950/75 p-2">
              <HsGoldCoinIcon size={26} />
              <span className="hs-num mt-1 text-lg text-yellow-300">{profile.gold}</span>
              <span className="text-[11px] font-bold text-amber-200/80">{tr('보유 골드', 'Gold')}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-sky-400/25 bg-stone-950/75 p-2">
              <HsArcaneDustVialIcon size={26} />
              <span className="hs-num mt-1 text-lg text-sky-300">{profile.arcaneDust}</span>
              <span className="text-[11px] font-bold text-sky-200/80">{tr('신비한 가루', 'Arcane Dust')}</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-amber-400/25 bg-stone-950/75 p-2">
              <img
                src="/stone-assets/ui/classic_pack.webp"
                alt=""
                className="h-7 w-6 object-contain"
              />
              <span className="hs-num mt-1 text-lg text-amber-200">{profile.packs}</span>
              <span className="text-[11px] font-bold text-amber-200/80">{tr('미개봉 팩', 'Packs')}</span>
            </div>
          </div>
        </div>

        {/* W / L / WinRate Spotlight Cards */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col justify-between rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-b from-emerald-950/70 via-stone-950/90 to-black p-3.5 shadow">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-extrabold text-emerald-200">{tr('⚔ 승 / 패', '⚔ Wins / Losses')}</span>
              <span className="rounded-full border border-emerald-400/50 bg-emerald-950/90 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-200">
                {profile.winStreak >= 2
                  ? tr(`🔥 ${profile.winStreak}연승`, `🔥 ${profile.winStreak} Streak`)
                  : tr(`총 ${totalGames}전`, `${totalGames} Games`)}
              </span>
            </div>
            <div className="hs-num my-1.5 flex items-baseline gap-1.5 text-2xl font-black">
              <span className="text-emerald-300">{tr(`${wins}승`, `${wins}W`)}</span>
              <span className="text-base text-stone-500">/</span>
              <span className="text-rose-300">{tr(`${losses}패`, `${losses}L`)}</span>
            </div>
            <div className="text-[11px] font-semibold text-amber-200/75">
              {tr(
                `통산 ${totalGames}경기${profile.winStreak > 0 ? ` · ${profile.winStreak}연승` : ''}`,
                `${totalGames} total matches${profile.winStreak > 0 ? ` · ${profile.winStreak} streak` : ''}`,
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border-2 border-sky-400/60 bg-gradient-to-b from-sky-950/75 via-stone-950/90 to-black p-3.5 shadow">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-extrabold text-sky-200">{tr('📈 승률', '📈 Win Rate')}</span>
              <span className="rounded-full border border-sky-400/50 bg-sky-950/90 px-2 py-0.5 text-[10.5px] font-extrabold text-sky-200">
                {totalGames === 0
                  ? tr('대결 전', 'No Games')
                  : winRatePct >= 50
                    ? tr('승률 우세', 'Positive')
                    : tr('분발 중', 'Climbing')}
              </span>
            </div>
            <div className="hs-num my-1.5 text-2xl font-black text-sky-300">{winRateLabel}%</div>
            <div className="h-2.5 w-full overflow-hidden rounded-full border border-sky-400/30 bg-stone-900">
              <div
                style={{ width: `${winRatePct}%` }}
                className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-300"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border-2 border-amber-400/60 bg-gradient-to-b from-amber-950/75 via-stone-950/90 to-black p-3.5 shadow">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-extrabold text-amber-200">{tr('🏅 등급전 순위', '🏅 Ranked Tier')}</span>
              <span className="rounded-full border border-yellow-300/50 bg-amber-900/80 px-2 py-0.5 text-[10.5px] font-black text-yellow-200">
                {profile.rank === 0 ? 'LEGEND' : tr(`${profile.rank}등급`, `Rank ${profile.rank}`)}
              </span>
            </div>
            <div className="hs-title my-1.5 text-xl font-black text-yellow-300">{rankTitle}</div>
            <div className="text-[11px] font-semibold text-amber-200/75">
              {profile.rank === 0
                ? tr('최고 등급 달성', 'Legend Achieved')
                : tr(`별 ${profile.stars}/${starsNeeded}개`, `${profile.stars}/${starsNeeded} Stars`)}
            </div>
          </div>
        </div>

        {/* Progressive Disclosure Buttons: 보상 안내 / 의뢰 */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="quest-toggle-rewards"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.85);
              setOpenSection((prev) => (prev === 'REWARDS' ? 'NONE' : 'REWARDS'));
            }}
            className={`flex min-h-[44px] items-center justify-between rounded-2xl border-2 px-4 py-2 text-sm font-extrabold shadow transition ${
              openSection === 'REWARDS'
                ? 'border-yellow-300 bg-gradient-to-b from-amber-600 to-amber-900 text-white'
                : 'hs-brass-btn border-[#c8a158] text-amber-100 hover:border-yellow-300'
            }`}
          >
            <span>{tr('🏆 보상 안내', '🏆 Rewards')}</span>
            <span className="text-xs opacity-90">
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
            className={`flex min-h-[44px] items-center justify-between rounded-2xl border-2 px-4 py-2 text-sm font-extrabold shadow transition ${
              openSection === 'QUESTS'
                ? 'border-emerald-300 bg-gradient-to-b from-emerald-600 to-emerald-900 text-white'
                : 'hs-brass-btn border-[#c8a158] text-amber-100 hover:border-emerald-300'
            }`}
          >
            <span>
              {tr(
                `📜 의뢰 (${completedQuestsCount}/${quests.length})`,
                `📜 Quests (${completedQuestsCount}/${quests.length})`,
              )}
            </span>
            <span className="text-xs opacity-90">
              {openSection === 'QUESTS' ? tr('닫기 ▲', 'Hide ▲') : tr('보기 ▼', 'View ▼')}
            </span>
          </button>
        </div>

        {openSection === 'REWARDS' && (
          <div className="mb-4 space-y-2 rounded-2xl border border-amber-500/40 bg-black/50 p-4 text-xs">
            <div className="hs-title text-sm font-extrabold text-yellow-300">
              {tr('여관 승리 · 등급전 · 카드 팩 보상 안내', 'Tavern Victories · Ranked · Pack Rewards')}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-amber-500/25 bg-stone-950/80 p-2.5">
                <div className="font-extrabold text-amber-200">{tr('⚔ 매 승리 기본 보상', '⚔ Victory Reward')}</div>
                <div className="mt-1 text-amber-100/80">
                  {tr('1승마다 +15 골드 (3승마다 +10 골드 보너스)', '+15 Gold per win (+10 bonus every 3 wins)')}
                </div>
              </div>
              <div className="rounded-xl border border-emerald-500/25 bg-stone-950/80 p-2.5">
                <div className="font-extrabold text-emerald-200">{tr('📜 일일 퀘스트', '📜 Daily Quests')}</div>
                <div className="mt-1 text-amber-100/80">
                  {tr('퀘스트 완료 시 40~60 골드 즉시 지급', 'Earn 40–60 Gold instantly on completion')}
                </div>
              </div>
              <div className="rounded-xl border border-sky-500/25 bg-stone-950/80 p-2.5">
                <div className="font-extrabold text-sky-200">{tr('✨ 공식 카드 팩', '✨ Classic Packs')}</div>
                <div className="mt-1 text-amber-100/80">
                  {tr('희귀 이상 1장 확정 · 첫 10팩 전설 확정', '1+ Rare guaranteed · Legendary within first 10')}
                </div>
              </div>
            </div>
          </div>
        )}

        {openSection === 'QUESTS' && (
          <>
            {/* Daily Quests on Parchment Cards */}
            <h3 className="hs-title mb-2 text-sm font-extrabold tracking-wide text-amber-200">
              {tr('오늘의 여관 퀘스트', "Today's Tavern Quests")}
            </h3>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {quests.map((q) => {
                const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
                return (
                  <div
                    key={q.id}
                    className={`rounded-2xl border-2 p-3.5 shadow ${
                      q.completed
                        ? 'border-emerald-400/70 bg-emerald-950/55 text-emerald-100'
                        : 'border-[#a88246] bg-[#f3e5c3] text-stone-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="hs-title text-sm font-extrabold">{q.title}</span>
                      <span className="flex items-center gap-1 rounded-full border border-amber-900/40 bg-amber-400/90 px-2 py-0.5 text-xs font-black text-stone-950">
                        <HsGoldCoinIcon size={14} />
                        <span>{q.rewardGold}</span>
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 text-xs font-semibold ${
                        q.completed ? 'text-emerald-200' : 'text-stone-700'
                      }`}
                    >
                      {q.description}
                    </p>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-stone-800/35">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-500"
                      />
                    </div>
                    <div className="mt-1 text-right text-[11px] font-extrabold">
                      {q.completed ? tr('완료됨', 'Completed') : `${q.progress} / ${q.goal}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 9 Classic Heroes Win Counts with Official Class Crests */}
        <h3 className="hs-title mb-2 text-sm font-extrabold tracking-wide text-amber-200">
          {tr('9대 오리지널 직업 승리 기록', '9 Classic Class Victory Records')}
        </h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-9">
          {HERO_CLASS_ORDER.map((hc) => {
            const h = CLASSIC_HEROES[hc];
            const localized = getLocalizedHeroInfo(hc, lang);
            return (
              <div
                key={hc}
                className="flex flex-col items-center rounded-xl border border-[#c8a158]/35 bg-black/40 px-1.5 py-2.5"
              >
                <img
                  src={CLASS_CREST_URL[hc]}
                  alt={localized.className}
                  className="mb-1 h-8 w-8 rounded-full border border-amber-200/70 object-cover shadow"
                />
                <span
                  style={{ color: h.accentColor }}
                  className="text-[10.5px] font-extrabold"
                >
                  {localized.className}
                </span>
                <span className="hs-num mt-0.5 text-sm text-white">
                  {tr(`${profile.classWins[hc] || 0}승`, `${profile.classWins[hc] || 0}W`)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const TavernShopModal: React.FC<{
  onClose: () => void;
  onProfileChanged: () => void;
  onGoOpenPacks: () => void;
}> = ({ onClose, onProfileChanged, onGoOpenPacks }) => {
  const { lang, tr } = useHeroLanguage();
  useModalDismiss(true, () => {
    hsAudio.playSfx('box_close');
    onClose();
  });
  const [profile, setProfile] = useState<PlayerProfile>(() => hsStorage.getProfile());
  const [toast, setToast] = useState<string | null>(null);

  const refresh = () => {
    setProfile(hsStorage.getProfile());
    onProfileChanged();
  };

  const handleBuy = (count: number) => {
    if (hsStorage.buyPacksWithGold(count)) {
      hsAudio.playSfx('purchase');
      setToast(
        tr(
          `오리지널 카드 팩 ${count}개를 구매했습니다!`,
          `Purchased ${count} Classic Card Pack${count > 1 ? 's' : ''}!`,
        ),
      );
      refresh();
    } else {
      hsAudio.playInnkeeper('collection');
      setToast(
        tr(
          `골드가 부족합니다. (필요: ${count * 100} 골드)`,
          `Not enough Gold. (${count * 100} Gold required)`,
        ),
      );
    }
  };

  const handleSelectBack = (id: PlayerProfile['selectedCardBack']) => {
    const p = hsStorage.getProfile();
    p.selectedCardBack = id;
    hsStorage.saveProfile(p);
    hsAudio.playSfx('ui_click');
    setToast(tr('카드 뒷면이 변경되었습니다.', 'Card Back equipped!'));
    refresh();
  };

  const handleUnlockMaster = () => {
    hsStorage.unlockMasterCollection();
    hsAudio.playSfx('pack_legendary');
    hsAudio.playInnkeeper('legendary');
    setToast(
      tr(
        '전설을 포함한 오리지널 수집 카드 382종 전체와 보너스 재화가 해금되었습니다!',
        'All 382 Classic cards (including Legendaries) and bonus currency unlocked!',
      ),
    );
    refresh();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6 text-amber-100"
      >
        <div className="mb-4 flex items-center justify-between border-b border-amber-600/35 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#dfc07b] bg-stone-950/80">
              <HsGoldCoinIcon size={28} />
            </div>
            <div>
              <h2 className="hs-title text-2xl font-extrabold text-amber-100">
                {tr('스톤브루 여관 상점', "Stonebrew's Tavern Shop")}
              </h2>
              <p className="text-xs font-semibold text-amber-300/85">
                {tr('보유 골드', 'Gold')} <b className="text-yellow-300">{profile.gold}</b> ·{' '}
                {tr('미개봉 팩', 'Packs')}{' '}
                <b className="text-amber-100">
                  {profile.packs}
                  {tr('개', '')}
                </b>{' '}
                · {tr('신비한 가루', 'Dust')}{' '}
                <b className="text-sky-300">{profile.arcaneDust}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            className="hs-brass-btn rounded-xl px-3.5 py-1.5 text-sm font-extrabold text-amber-100"
          >
            {tr('닫기 ✕', 'Close ✕')}
          </button>
        </div>

        {toast && (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-950/90 px-4 py-2 text-center text-xs font-extrabold text-yellow-200">
            {toast}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Pack Purchase Box */}
          <div className="flex flex-col items-center justify-between rounded-2xl border-2 border-[#c8a158]/50 bg-black/40 p-4">
            <img
              src="/stone-assets/ui/classic_pack.webp"
              alt={tr('오리지널 팩', 'Classic Pack')}
              className="h-36 w-28 object-contain drop-shadow-[0_12px_22px_rgba(0,0,0,0.9)]"
            />
            <div className="mt-2 text-center">
              <div className="hs-title text-base font-extrabold text-amber-100">
                {tr('오리지널 클래식 카드 팩', 'Classic Card Pack')}
              </div>
              <div className="mt-0.5 text-xs font-semibold text-amber-200/75">
                {tr(
                  '공식 한국어 카드 5장 포함 · 최소 1장 희귀(Rare) 등급 이상 확정',
                  '5 Classic Cards · Guarantees at least 1 Rare or better',
                )}
              </div>
            </div>
            <div className="mt-4 flex w-full gap-2">
              <button
                type="button"
                onClick={() => handleBuy(1)}
                className="hs-brass-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold text-amber-100 sm:text-sm"
              >
                <HsGoldCoinIcon size={17} />
                <span>{tr('1팩 구매 (100)', 'Buy 1 Pack (100)')}</span>
              </button>
              <button
                type="button"
                onClick={() => handleBuy(5)}
                className="hs-arcane-btn flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-extrabold text-white sm:text-sm"
              >
                <HsGoldCoinIcon size={17} />
                <span>{tr('5팩 구매 (500)', 'Buy 5 Packs (500)')}</span>
              </button>
            </div>
            {profile.packs > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoOpenPacks();
                }}
                className="hs-brass-btn mt-2 w-full rounded-xl py-2 text-xs font-extrabold text-sky-200"
              >
                {tr(
                  `지금 팩 개봉 제단으로 이동 (${profile.packs}개 보유) →`,
                  `Open Packs Now (${profile.packs} owned) →`,
                )}
              </button>
            )}
          </div>

          {/* Card Back Selector + Master Sandbox Unlock */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-[#c8a158]/50 bg-black/40 p-4">
            <div>
              <h3 className="hs-title mb-2 text-sm font-extrabold text-amber-100">
                {tr('공식 카드 뒷면 선택', 'Select Card Back')}
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {CARD_BACK_ITEMS.map((cb) => {
                  const active = profile.selectedCardBack === cb.id;
                  const backLabel = getCardBackName(cb.id, cb.name, lang);
                  return (
                    <button
                      key={cb.id}
                      type="button"
                      onClick={() => handleSelectBack(cb.id)}
                      className={`flex flex-col items-center rounded-xl border-2 p-1.5 transition ${
                        active
                          ? 'border-yellow-300 bg-amber-900/60 shadow-[0_0_14px_rgba(250,204,21,0.65)]'
                          : 'border-stone-700 bg-stone-900/60 hover:border-amber-500'
                      }`}
                    >
                      <img
                        src={cb.img}
                        alt={backLabel}
                        className="h-20 w-14 rounded object-cover"
                      />
                      <span className="mt-1 text-[10px] font-bold text-amber-100">
                        {backLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-xl border-2 border-[#e2bf76]/75 bg-gradient-to-r from-[#2e1c0e] via-[#1f182e] to-[#2e1c0e] p-3.5">
              <div className="hs-title text-xs font-extrabold text-yellow-300">
                {tr('여관 마스터 샌드박스 모드', 'Tavern Master Sandbox Mode')}
              </div>
              <p className="mt-1 text-[11px] font-semibold text-amber-100/85">
                {tr(
                  '오리지널 수집 가능 카드 382종(전설 1장 · 일반~특급 각 2장) 전체와 1,000골드, 1,600가루, 10팩을 즉시 해금합니다.',
                  'Instantly unlock all 382 collectible Classic cards plus 1,000 Gold, 1,600 Arcane Dust, and 10 Packs.',
                )}
              </p>
              <button
                type="button"
                onClick={handleUnlockMaster}
                className="hs-arcane-btn mt-2.5 w-full rounded-xl py-2 text-xs font-extrabold text-white"
              >
                {tr('여관 마스터 전체 카드 1클릭 해금', 'Unlock Full 382-Card Collection (Free)')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const GameOptionsModal: React.FC<{
  inBattle?: boolean;
  onConcede?: () => void;
  onOpenReaModal?: () => void;
  onProfileChanged?: () => void;
  onClose: () => void;
}> = ({ inBattle = false, onConcede, onOpenReaModal, onProfileChanged, onClose }) => {
  const { lang, setLang, tr } = useHeroLanguage();
  useModalDismiss(true, onClose);

  const [settings, setSettings] = useState<AudioSettings>(() => hsAudio.getSettings());
  const [unlockedMsg, setUnlockedMsg] = useState(false);
  const [dataNotice, setDataNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const vibSupport = useMemo(() => hsAudio.getVibrationSupportInfo(), []);

  const update = (patch: Partial<AudioSettings>) => {
    hsAudio.updateSettings(patch);
    setSettings(hsAudio.getSettings());
  };

  const handleLanguageChange = (nextLang: HeroLanguage) => {
    if (nextLang === lang) return;
    hsAudio.playSfx('ui_click', 0.85);
    setLang(nextLang);
    setDataNotice(
      nextLang === 'ko'
        ? '✓ 언어가 한국어로 변경되었습니다.'
        : '✓ Language switched to English.',
    );
  };

  const handleCopyBackup = async () => {
    hsAudio.playSfx('ui_click', 0.8);
    const { jsonString, keyCount } = hsStorage.exportStoneBackupData();
    try {
      await navigator.clipboard.writeText(jsonString);
      setDataNotice(
        tr(
          `✓ 하스스톤 백업 코드(${keyCount}개 항목)가 복사되었습니다.`,
          `✓ Backup code copied (${keyCount} items).`,
        ),
      );
    } catch {
      hsStorage.downloadStoneBackupFile();
      setDataNotice(
        tr('✓ 백업 JSON 파일이 다운로드되었습니다.', '✓ Backup JSON file downloaded.'),
      );
    }
  };

  const handlePasteRestore = () => {
    hsAudio.playSfx('ui_click', 0.8);
    const raw = window.prompt(
      tr(
        '복원할 하스스톤(/stone.html) 백업 JSON 코드를 붙여넣어 주세요:',
        'Paste your Hearthstone (/stone.html) backup JSON code to restore:',
      ),
    );
    if (!raw || !raw.trim()) return;
    const res = hsStorage.restoreStoneBackupJson(raw.trim());
    setDataNotice(res.message);
    if (res.success) onProfileChanged?.();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/78 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-6 text-amber-100"
      >
        <h2 className="hs-title mb-4 text-center text-2xl font-extrabold text-amber-100">
          {tr('게임 메뉴', 'Game Menu')}
        </h2>

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
            {tr('항복하기', 'Concede')}
          </button>
        )}

        <div className="space-y-3 rounded-2xl border border-[#c8a158]/40 bg-black/40 p-4">
          {/* Language Selector (Default: English / Korean browser: Korean) */}
          <div
            data-testid="stone-options-language-selector"
            className="flex flex-col gap-2 border-b border-amber-500/20 pb-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-amber-100">
                  {tr('언어 설정 / Language', 'Language / 언어 설정')}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold text-amber-200/75">
                  {tr(
                    '브라우저 언어 자동 감지 (한국어 외 기본 영어)',
                    'Auto-detected by browser locale (English default)',
                  )}
                </div>
              </div>
              <div className="inline-flex shrink-0 overflow-hidden rounded-xl border border-[#c8a158]/60 bg-black/60 p-0.5">
                <button
                  type="button"
                  data-testid="stone-options-lang-en"
                  onClick={() => handleLanguageChange('en')}
                  className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                    lang === 'en'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-amber-200/75 hover:text-amber-100'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  data-testid="stone-options-lang-ko"
                  onClick={() => handleLanguageChange('ko')}
                  className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                    lang === 'ko'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-amber-200/75 hover:text-amber-100'
                  }`}
                >
                  한국어
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold">{tr('사운드 출력', 'Master Sound')}</span>
            <button
              type="button"
              onClick={() => update({ muted: !settings.muted })}
              className={`rounded-lg border px-3 py-1 text-xs font-extrabold ${
                settings.muted
                  ? 'border-red-300/60 bg-red-800 text-white'
                  : 'border-emerald-300/60 bg-emerald-800 text-white'
              }`}
            >
              {settings.muted ? tr('음소거 켜짐', 'Muted') : tr('사운드 켜짐', 'Sound On')}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-amber-500/20 pt-2.5">
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-amber-100">
                {tr('공격 타격 진동 (안드로이드)', 'Attack Haptic Vibration (Mobile)')}
              </div>
              <div className="mt-0.5 text-[11px] font-semibold text-amber-200/75">
                {vibSupport.supported
                  ? tr('입힌 피해량에 비례해 강력한 진동 울림', 'Vibration scales with attack damage')
                  : tr(
                      '현재 기기/브라우저는 진동 API를 지원하지 않습니다',
                      'Vibration API is not supported on this device/browser',
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
                if (nextEnabled) hsAudio.previewVibration();
              }}
              className={`min-h-[36px] shrink-0 rounded-lg border px-3 py-1 text-xs font-extrabold transition ${
                settings.vibrateEnabled
                  ? 'border-emerald-300/60 bg-emerald-800 text-white'
                  : 'border-stone-400/50 bg-stone-800 text-stone-200'
              }`}
            >
              {settings.vibrateEnabled ? tr('진동 켜짐', 'On') : tr('진동 꺼짐', 'Off')}
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-amber-200">
              <span>{tr('여관 · 전장 배경음악 (BGM)', 'Tavern & Board Music (BGM)')}</span>
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
              <span>{tr('타격 · 주문 효과음 (SFX)', 'Combat & Spell Effects (SFX)')}</span>
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
              <span>{tr('한국어 성우 음성 (VO)', 'Hero & Innkeeper Voice (VO)')}</span>
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

          {/* /stone.html 전용 (stone_hs_*) 독립 세이브 백업 · 복원 · 초기화 */}
          <div className="space-y-2 border-t border-amber-500/25 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-yellow-300">
                {tr('데이터 백업 · 복원 (하스스톤 전용)', 'Save Data Backup & Restore')}
              </span>
              <span className="rounded bg-amber-950/80 px-2 py-0.5 text-[10px] font-bold text-amber-200/80">
                {tr('stone_hs_* 독립 저장소', 'stone_hs_* LocalStorage')}
              </span>
            </div>

            {dataNotice && (
              <div
                data-testid="stone-data-notice"
                className="rounded-lg border border-emerald-400/50 bg-emerald-950/80 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200"
              >
                {dataNotice}
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.8);
                  hsStorage.downloadStoneBackupFile();
                  setDataNotice(
                    tr(
                      '✓ 하스스톤 백업 JSON 파일이 저장되었습니다.',
                      '✓ Backup JSON file saved.',
                    ),
                  );
                }}
                className="hs-brass-btn rounded-lg py-2 text-[11px] font-extrabold text-amber-100"
              >
                {tr('💾 백업 파일 저장', '💾 Export JSON')}
              </button>
              <button
                type="button"
                onClick={handleCopyBackup}
                className="hs-brass-btn rounded-lg py-2 text-[11px] font-extrabold text-amber-100"
              >
                {tr('📋 백업 코드 복사', '📋 Copy Backup')}
              </button>
              <label className="hs-brass-btn flex cursor-pointer items-center justify-center rounded-lg py-2 text-center text-[11px] font-extrabold text-amber-100">
                <span>{tr('📂 파일로 복원', '📂 Import JSON')}</span>
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
                      const res = hsStorage.restoreStoneBackupJson(content);
                      setDataNotice(res.message);
                      if (res.success) onProfileChanged?.();
                    };
                    reader.readAsText(file);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                onClick={handlePasteRestore}
                className="hs-brass-btn rounded-lg py-2 text-[11px] font-extrabold text-amber-100"
              >
                {tr('📥 코드 붙여넣기', '📥 Paste Code')}
              </button>
            </div>

            {!confirmReset ? (
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click', 0.8);
                  setConfirmReset(true);
                }}
                className="mt-1 w-full rounded-lg border border-red-400/50 bg-red-950/60 py-1.5 text-[11px] font-extrabold text-red-200 hover:bg-red-900/70"
              >
                {tr('🗑 하스스톤 데이터 초기화 (/stone.html 전용)', '🗑 Reset Hearthstone Data (/stone.html)')}
              </button>
            ) : (
              <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-red-400/70 bg-red-950/90 p-2">
                <span className="flex-1 text-[11px] font-extrabold text-red-100">
                  {tr('하스스톤(stone_hs_*) 데이터만 초기화할까요?', 'Reset Hearthstone (stone_hs_*) save data?')}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.85);
                    hsStorage.resetStoneDataOnly();
                    setConfirmReset(false);
                    setDataNotice(
                      tr(
                        '✓ 하스스톤(stone_hs_*) 데이터가 초기 상태로 리셋되었습니다.',
                        '✓ Hearthstone save data has been reset.',
                      ),
                    );
                    onProfileChanged?.();
                    window.location.reload();
                  }}
                  className="rounded bg-red-600 px-2.5 py-1 text-[11px] font-extrabold text-white"
                >
                  {tr('초기화', 'Reset')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded bg-stone-700 px-2 py-1 text-[11px] font-bold text-stone-200"
                >
                  {tr('취소', 'Cancel')}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              hsStorage.unlockMasterCollection();
              hsAudio.playSfx('pack_legendary');
              setUnlockedMsg(true);
              onProfileChanged?.();
            }}
            className="hs-arcane-btn w-full rounded-xl py-2.5 text-xs font-extrabold text-white"
          >
            {tr('여관 마스터 전체 해금 (382종 카드 + 재화)', 'Unlock Full 382-Card Collection + Currency')}
          </button>
          {unlockedMsg && (
            <div className="text-center text-xs font-bold text-emerald-300">
              {tr('382종 모든 오리지널 카드가 내 카드첩에 지급되었습니다!', 'All 382 Classic cards have been added to your Collection!')}
            </div>
          )}

          {onOpenReaModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenReaModal();
              }}
              className="hs-brass-btn w-full rounded-xl py-2 text-xs font-extrabold text-sky-200"
            >
              {tr('REA 역설계 증거 및 원본 바이너리 검증 보기', 'View REA Client Evidence & Build Report')}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              onClose();
            }}
            className="hs-brass-btn w-full rounded-xl py-2.5 text-sm font-extrabold text-amber-100"
          >
            {tr('게임으로 돌아가기', 'Back to Game')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ReaEvidenceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { tr } = useHeroLanguage();
  useModalDismiss(true, () => {
    hsAudio.playSfx('box_close');
    onClose();
  });
  const manifest = cardDb.getManifest();
  const totalCollectible = cardDb.getAllCollectible().length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6 text-amber-100"
      >
        <div className="mb-4 flex items-center justify-between border-b border-amber-600/35 pb-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/stone-assets/ui/box_compass_medallion.webp"
              alt=""
              className="h-9 w-9 object-contain"
            />
            <div>
              <h2 className="hs-title text-xl font-extrabold text-amber-100">
                {tr('REA (`morluto/rea@6.7.0`) 역설계 증명 리포트', 'REA (`morluto/rea@6.7.0`) Reverse-Engineering Report')}
              </h2>
              <p className="text-xs font-semibold text-amber-300/80">
                {tr(
                  `로컬 설치본 ${manifest?.sourceInstallation || '/Applications/Hearthstone'} 직접 추출 아티팩트 및 src/stone/design.md 검증`,
                  `Verified against ${manifest?.sourceInstallation || '/Applications/Hearthstone'} artifacts & src/stone/design.md`,
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hs-brass-btn rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100"
          >
            {tr('닫기 ✕', 'Close ✕')}
          </button>
        </div>

        {manifest && (
          <div className="space-y-3 text-xs">
            <div className="rounded-xl border border-[#c8a158]/40 bg-black/45 p-3.5">
              <div className="font-extrabold text-yellow-300">
                1. Assembly-CSharp.dll (Unity 6000.3.11f1 Mono CIL Assembly)
              </div>
              <div className="mt-1 break-all text-[11px] font-bold text-amber-100/90">
                <div>Evidence ID: {manifest.evidence.assemblyCSharp.evidenceId}</div>
                <div>SHA-256: {manifest.evidence.assemblyCSharp.sha256}</div>
                <div>
                  Byte Length: {manifest.evidence.assemblyCSharp.byteLength.toLocaleString()} bytes · TypeDefs:{' '}
                  {manifest.evidence.assemblyCSharp.tableRowCounts.TypeDef?.toLocaleString()} · MethodDefs:{' '}
                  {manifest.evidence.assemblyCSharp.tableRowCounts.MethodDef?.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#c8a158]/40 bg-black/45 p-3.5">
              <div className="font-extrabold text-sky-300">
                2. Blizzard.T5.Game.dll & {tr('상용 프로 디자인 시스템', 'Commercial Pro Design System')} (`src/stone/design.md`)
              </div>
              <div className="mt-1 break-all text-[11px] font-bold text-amber-100/90">
                <div>Blizzard.T5.Game Evidence: {manifest.evidence.blizzardT5Game.evidenceId}</div>
                <div>Rymedy Baseline Evidence: {manifest.evidence.rymedyBaseline.evidenceId}</div>
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                <div className="rounded-lg border border-red-400/25 bg-stone-900/80 p-2.5">
                  <b className="text-red-300">{tr('기존 웹 복제본 한계:', 'Previous Web Clone Limits:')}</b>
                  <ul className="mt-1 list-disc pl-4 text-stone-300">
                    <li>{tr('단순 사각형 CSS 카드 · 이모지 의존 · 원작 재질 부재', 'Plain CSS rectangles, emoji placeholders, missing tavern materials')}</li>
                    <li>{tr('영웅 2종 고정, 덱 빌더 · 덱 코드 · 팩 개봉 부재', 'Fixed 2 heroes, missing Deck Builder, Deck Codes, Pack Opening')}</li>
                    <li>{tr('주문/비밀/선택/과부하 미구현', 'Missing Spells, Secrets, Choose One, and Overload mechanics')}</li>
                  </ul>
                </div>
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-950/55 p-2.5">
                  <b className="text-emerald-300">{tr('현재 /stone.html 상용 프로 에디션:', 'Current /stone.html Edition:')}</b>
                  <ul className="mt-1 list-disc pl-4 text-emerald-100">
                    <li>{tr(`공식 1:1 알파 실루엣 카드 렌더 (${totalCollectible}종 + 토큰 123종)`, `Official 1:1 alpha card renders (${totalCollectible} cards + 123 tokens)`)}</li>
                    <li>{tr('원본 번들 추출 여관 스윙 도어 · 더 박스 · 양피지 카드첩 · 석조 턴종료 레버', 'Extracted Tavern doors, The Box, Parchment Collection, Stone End Turn lever')}</li>
                    <li>{tr('공식 덱 빌더 마나 커브 · 타일 바 · 덱 코드 공유 완비', 'Complete Deck Builder mana curve, tile bar & deck share codes')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
