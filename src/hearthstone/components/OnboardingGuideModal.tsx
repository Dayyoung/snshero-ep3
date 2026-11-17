import React, { useCallback, useEffect, useRef, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { useModalDismiss } from '../useModalDismiss';

export const RULES_SEEN_KEY = 'hero_hs_rules_seen';

export function hasSeenQuickRules(): boolean {
  try {
    return localStorage.getItem(RULES_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markQuickRulesSeen(): void {
  try {
    localStorage.setItem(RULES_SEEN_KEY, '1');
  } catch {
    // ignore storage errors
  }
}

interface GuideStepSlide {
  step: number;
  shortLabelKo: string;
  shortLabelEn: string;
  badgeKo: string;
  badgeEn: string;
  titleKo: string;
  titleEn: string;
  descKo: string;
  descEn: string;
  tipKo: string;
  tipEn: string;
  imageUrlKo: string;
  imageUrlEn: string;
}

export const HOW_TO_PLAY_SLIDES: GuideStepSlide[] = [
  {
    step: 1,
    shortLabelKo: '로비·모드',
    shortLabelEn: 'Hub & Modes',
    badgeKo: 'STEP 1 · 여관 로비 & 3대 핵심 모드',
    badgeEn: 'STEP 1 · SANCTUARY HUB & 3 MODES',
    titleKo: '스토리 · 공식 랭킹 · 보가트 도박장 선택 & 의뢰 수령',
    titleEn: "Pick Story, Ranked Arena, or Bogart's Hall & Claim Quests",
    descKo:
      '스토리모드(카단의 여정 40화), 공식 전적이 기록되는 온라인형 랭킹대전, 100% 랜덤 30장 덱으로 맞붙는 보가트 도박장을 원클릭으로 시작하세요. 하단 [의뢰 일지]에서 완료 의뢰 골드도 바로 수령할 수 있습니다.',
    descEn:
      "Jump straight into 40-episode Story Mode, Official Ranked Arena, or Bogart's 100% Random-Deck Gambling Hall. Open [Quest Log] anytime to claim bonus Gold.",
    tipKo: '초보 추천: [스토리모드] 제0화 허수아비 기초 훈련을 먼저 깨면 무료 3팩 + 기본 감각을 30초 만에 익힐 수 있습니다.',
    tipEn: 'Beginner Tip: Beat Story EP.0 Training first to learn the ropes in 30 seconds and earn rewards.',
    imageUrlKo: '/hs-assets/guide/guide_01_hub.webp',
    imageUrlEn: '/hs-assets/guide/guide_en_01_hub.webp',
  },
  {
    step: 2,
    shortLabelKo: '시작 손패',
    shortLabelEn: 'Mulligan',
    badgeKo: 'STEP 2 · 시작 손패 선택(멀리건)',
    badgeEn: 'STEP 2 · STARTING HAND MULLIGAN',
    titleKo: '카단의 [유지 추천 / 교체 권장]으로 초반 손패 설계',
    titleEn: 'Optimize Your Opening Hand with Kadan Tips',
    descKo:
      '전투 시작 시 카단이 현재 전술(맹공·수비·각성)에 맞춰 카드마다 [유지 추천(Keep)]과 [교체 권장(Swap)] 배지를 띄워 줍니다. 고코스트 카드는 눌러서 바꾸거나 [카단 추천대로 교체] 버튼 한 번으로 손패를 완성하세요.',
    descEn:
      'Kadan labels each starting card as Keep or Swap based on your tactical stance. Click cards to replace them, or tap [Apply Kadan Swap] in one touch.',
    tipKo: '프리셋 지원: [출격 덱·전술 프리셋] 버튼으로 속공 돌파·철벽 반격·3배 각성 덱을 전투 직전에 즉시 바꿀 수 있습니다.',
    tipEn: 'Deck Presets: Switch instantly between Rush Aggro, Iron Control, and 3x Awakening via [Preset Deck & Tactic].',
    imageUrlKo: '/hs-assets/guide/guide_02_mulligan.webp',
    imageUrlEn: '/hs-assets/guide/guide_en_02_mulligan.webp',
  },
  {
    step: 3,
    shortLabelKo: '마나·소환',
    shortLabelEn: 'Play Cards',
    badgeKo: 'STEP 3 · 마나 수정 & 하수인·주문 시전',
    badgeEn: 'STEP 3 · MANA CRYSTALS & CASTING',
    titleKo: '초록 테두리 카드를 내고 적 영웅 체력 0 만들기',
    titleEn: 'Play Green-Glowing Cards & Drop Enemy HP to 0',
    descKo:
      '매 턴 최대 마나가 +1씩 늘어납니다(최대 10). 현재 마나 이하로 사용 가능한 손패에는 초록 테두리가 켜집니다! 카드를 클릭해 소환한 뒤 다음 턴 초록 테두리가 뜬 하수인으로 적 하수인·적 영웅(상단 빨간 체력)을 타격하세요.',
    descEn:
      'Gain +1 Max Mana each turn (up to 10). Cards playable within your current Mana glow green. Summoned minions attack next turn—reduce the Enemy Hero’s HP at the top to 0 to win!',
    tipKo: '승리 지름길: 방패 모양 [도발] 하수인이 있으면 먼저 처치해야 하며, 할 일이 끝나면 우측 [턴 종료] 버튼을 누르세요.',
    tipEn: 'Combat Tip: Taunt (shield) minions must be attacked first. Press [End Turn] on the right when you finish your plays.',
    imageUrlKo: '/hs-assets/guide/guide_03_battle_mana.webp',
    imageUrlEn: '/hs-assets/guide/guide_en_03_battle_mana.webp',
  },
  {
    step: 4,
    shortLabelKo: '전술·리듬오토',
    shortLabelEn: 'Tactic & Rhythm',
    badgeKo: 'STEP 4 · 카단 전술 & BGM 리듬 오토(1.5x·2.0x)',
    badgeEn: 'STEP 4 · KADAN COMMAND ORB & BGM RHYTHM AUTO',
    titleKo: '카단 리듬 지휘 오브(1.5x·2.0x) & 실리아 필살기',
    titleEn: 'Kadan Rhythm Command Orb (1.5x·2.0x) & Silia Ultimates',
    descKo:
      '자동플레이 시 우상단 [카단 리듬 지휘 오브]에서 공격·방어·각성 전술을 바꾸고, BGM 박자에 수축하는 황금 오카리나 링을 탭(또는 Space)하면 화음과 함께 1.5x·2.0x 공명(경쟁모드는 골드 피버)이 발동합니다!',
    descEn:
      'During Auto-Play, switch Attack/Defense/3x stances on the Kadan Command Orb and tap the shrinking Golden Ocarina Beat Ring (or Space) for 1.5x·2.0x harmonic resonance (or Gold Fever in Ranked/Bogart)!',
    tipKo: '편의 기능: 사운드 OFF 시에도 시각 메트로놈 파동으로 박자를 맞출 수 있으며, 위기 순간엔 [승부처 브레이크]가 발동합니다.',
    tipEn: 'Smart Assist: Works silently via Visual Metronome pulses when muted, plus Clutch Break on lethal/crisis turns.',
    imageUrlKo: '/hs-assets/guide/guide_04_combat_ult.webp',
    imageUrlEn: '/hs-assets/guide/guide_en_04_combat_ult.webp',
  },
  {
    step: 5,
    shortLabelKo: '무료 3팩',
    shortLabelEn: 'Card Packs',
    badgeKo: 'STEP 5 · 카드팩 개봉 & 전설 100% 천장',
    badgeEn: 'STEP 5 · FREE PACKS & PITY LEGENDARY',
    titleKo: '무료 3팩 즉시 개봉 · 10팩 내 24K 전설 확정',
    titleEn: 'Open 3 Free Packs & Guarantee Legendaries',
    descKo:
      '첫 방문 즉시 무료 눈히어로 카드팩 3개 + 250골드 + 160 신비한 가루가 지급됩니다. 10팩 이내 최소 1장의 전설 카드가 100% 보장되며, 골드를 모아 상점에서 추가 카드팩을 언제든 개봉할 수 있습니다.',
    descEn:
      'Claim 3 Free Packs + 250 Gold + 160 Dust on your first visit. At least 1 Legendary card is 100% guaranteed within every 10 packs!',
    tipKo: '덱 즉시 강화: 팩에서 3장 이상 모인 카드는 곧바로 [3배 각성] 배지가 붙어 스토리모드 덱에 바로 편성할 수 있습니다.',
    tipEn: 'Instant Power: Collecting 3+ copies unlocks the golden 3x Awakening badge for Story Mode!',
    imageUrlKo: '/hs-assets/guide/guide_05_packs.webp',
    imageUrlEn: '/hs-assets/guide/guide_en_05_packs.webp',
  },
  {
    step: 6,
    shortLabelKo: '3배 각성',
    shortLabelEn: '3x & Lore',
    badgeKo: 'STEP 6 · 내 카드첩(382종) · 3장=3배 각성',
    badgeEn: 'STEP 6 · COLLECTION, 3X POWER & LORE',
    titleKo: '3장=3배 각성 성장 & 카드별 원작 웹소설 감상',
    titleEn: 'Grow 3x Stronger & Read Hero Novel Chapters',
    descKo:
      '[내 카드첩]에서 9종족 382종 카드를 자유롭게 제작·덱 편성하세요. 스토리모드에서는 동일 카드 3장 보유 시 능력치가 3배 폭증하며, 카드를 눌러 확대하면 원작 40화 웹소설 해당 회차로 바로 이동할 수 있습니다!',
    descEn:
      'Craft & organize 382 cards across 9 factions. In Story Mode, 3+ copies multiply stats 3x, and zooming any card links straight to that hero’s chapter in the 40-episode novel!',
    tipKo: '공정 경쟁: 랭킹대전은 과금 격차 없이 모든 카드가 1배수 스탯으로 공정하게 실력을 겨룹니다.',
    tipEn: 'Fair Ranked Play: Competitive Ranked battles strictly use 1x base card stats for pure skill.',
    imageUrlKo: '/hs-assets/guide/guide_06_collection.webp',
    imageUrlEn: '/hs-assets/guide/guide_en_06_collection.webp',
  },
];

export const HowToPlayCarousel: React.FC<{
  variant?: 'modal' | 'promo';
  playSound?: boolean;
}> = ({ variant = 'modal', playSound = true }) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const [pageIdx, setPageIdx] = useState(0);
  const swipeRef = useRef<{ x: number | null }>({ x: null });

  const total = HOW_TO_PLAY_SLIDES.length;
  const slide = HOW_TO_PLAY_SLIDES[pageIdx];

  const goToPage = useCallback(
    (nextIdx: number) => {
      const clamped = ((nextIdx % total) + total) % total;
      if (playSound) {
        hsAudio.playSfx('card_flip', 0.65);
      }
      setPageIdx(clamped);
    },
    [total, playSound],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') {
        if (variant === 'modal') {
          e.preventDefault();
          goToPage(pageIdx - 1);
        }
      } else if (e.key === 'ArrowRight') {
        if (variant === 'modal') {
          e.preventDefault();
          goToPage(pageIdx + 1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToPage, pageIdx, variant]);

  return (
    <div
      data-testid="howto-carousel"
      data-howto-page={slide.step}
      className="w-full"
      onTouchStart={(e) => {
        swipeRef.current.x = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (swipeRef.current.x === null) return;
        const dx = (e.changedTouches[0]?.clientX ?? swipeRef.current.x) - swipeRef.current.x;
        swipeRef.current.x = null;
        if (dx <= -42) goToPage(pageIdx + 1);
        else if (dx >= 42) goToPage(pageIdx - 1);
      }}
    >
      {/* Step Number Tabs (1~6 Pagination Pills) */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
        {HOW_TO_PLAY_SLIDES.map((s, idx) => {
          const active = idx === pageIdx;
          return (
            <button
              key={s.step}
              type="button"
              data-testid={`howto-page-btn-${s.step}`}
              onClick={() => goToPage(idx)}
              className={`min-h-[34px] cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition sm:text-xs ${
                active
                  ? 'border-yellow-300 bg-gradient-to-b from-amber-500 to-amber-700 text-stone-950 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                  : 'border-amber-500/35 bg-black/45 text-amber-200/85 hover:border-amber-300 hover:text-white'
              }`}
            >
              {s.step}. {isKo ? s.shortLabelKo : s.shortLabelEn}
            </button>
          );
        })}
      </div>

      {/* Real Captured Screenshot Showcase Frame */}
      <div className="relative overflow-hidden rounded-2xl border-2 border-[#c8a158]/70 bg-stone-950 shadow-2xl">
        <div className="relative aspect-[16/9.5] w-full overflow-hidden bg-[#0e0905]">
          <img
            src={isKo ? slide.imageUrlKo : slide.imageUrlEn}
            alt={isKo ? slide.titleKo : slide.titleEn}
            className="h-full w-full object-cover object-center transition-opacity duration-200"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div className="absolute left-2.5 top-2.5 rounded-full border border-amber-300/75 bg-black/85 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-amber-300 shadow">
            {isKo ? slide.badgeKo : slide.badgeEn}
          </div>
          <div
            data-testid="howto-page-indicator"
            className="absolute right-2.5 top-2.5 rounded-full border border-white/25 bg-black/85 px-2.5 py-0.5 text-[11px] font-black text-white shadow"
          >
            {slide.step} / {total}
          </div>

          <button
            type="button"
            aria-label={tr('이전 단계', 'Previous step')}
            data-testid="howto-overlay-prev"
            onClick={() => goToPage(pageIdx - 1)}
            className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-amber-300/60 bg-black/75 text-base font-black text-amber-100 shadow-lg transition hover:scale-110 hover:border-yellow-200 hover:bg-amber-900/90"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={tr('다음 단계', 'Next step')}
            data-testid="howto-overlay-next"
            onClick={() => goToPage(pageIdx + 1)}
            className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-amber-300/60 bg-black/75 text-base font-black text-amber-100 shadow-lg transition hover:scale-110 hover:border-yellow-200 hover:bg-amber-900/90"
          >
            ›
          </button>
        </div>

        {/* Step Explanation & Pro-Tip Box */}
        <div className="border-t border-amber-500/35 bg-[#1a1008]/95 p-3.5 sm:p-4">
          <h3 className="hs-title text-base font-black text-amber-200 sm:text-lg">
            {slide.step}. {isKo ? slide.titleKo : slide.titleEn}
          </h3>
          <p className="mt-1.5 text-xs font-semibold leading-relaxed text-amber-100/90 sm:text-sm">
            {isKo ? slide.descKo : slide.descEn}
          </p>
          <div className="mt-2.5 rounded-xl border border-emerald-400/40 bg-emerald-950/60 px-3 py-2 text-[11px] font-bold text-emerald-100 sm:text-xs">
            💡 {isKo ? slide.tipKo : slide.tipEn}
          </div>
        </div>
      </div>

      {/* Bottom Prev / Dots / Next Controls */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          data-testid="howto-prev-btn"
          onClick={() => goToPage(pageIdx - 1)}
          className="hs-brass-btn flex min-h-[44px] cursor-pointer items-center gap-1 rounded-xl px-4 py-2 text-xs font-extrabold text-amber-100 sm:text-sm"
        >
          <span>◀</span>
          <span>{tr('이전', 'Prev')}</span>
        </button>

        <div className="flex items-center gap-1.5">
          {HOW_TO_PLAY_SLIDES.map((s, idx) => (
            <button
              key={s.step}
              type="button"
              aria-label={`Page ${s.step}`}
              onClick={() => goToPage(idx)}
              className={`h-2.5 cursor-pointer rounded-full transition-all ${
                idx === pageIdx ? 'w-7 bg-amber-400' : 'w-2.5 bg-amber-200/35 hover:bg-amber-300/70'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          data-testid="howto-next-btn"
          onClick={() => goToPage(pageIdx + 1)}
          className="hs-gold-btn flex min-h-[44px] cursor-pointer items-center gap-1 rounded-xl px-4 py-2 text-xs font-black text-stone-950 shadow sm:text-sm"
        >
          <span>{pageIdx === total - 1 ? tr('처음으로', 'Restart') : tr('다음', 'Next')}</span>
          <span>▶</span>
        </button>
      </div>
    </div>
  );
};

interface QuickRulesModalProps {
  isFirstTime?: boolean;
  inBattle?: boolean;
  onClose: () => void;
}

export const QuickRulesModal: React.FC<QuickRulesModalProps> = ({
  isFirstTime = false,
  inBattle = false,
  onClose,
}) => {
  useHeroLanguage();
  const [showKeywords, setShowKeywords] = useState(false);

  const keywords = [
    {
      name: tr('🛡 도발', '🛡 Taunt'),
      desc: tr(
        '방패 테두리 하수인이 있으면 다른 대상보다 도발 하수인을 먼저 공격해야 합니다.',
        'Shield-framed minions must be attacked before any other targets.',
      ),
    },
    {
      name: tr('⚡ 돌진', '⚡ Charge'),
      desc: tr(
        '소환한 턴에도 잠들지 않고 바로 공격할 수 있습니다.',
        'Can attack immediately on the same turn it is summoned.',
      ),
    },
    {
      name: tr('✨ 천상의 보호막', '✨ Divine Shield'),
      desc: tr(
        '처음 받는 피해를 1회 완전히 막아내는 황금 보호막입니다.',
        'Absorbs the first instance of damage completely.',
      ),
    },
    {
      name: tr('📣 전투의 함성', '📣 Battlecry'),
      desc: tr(
        '카드를 손에서 필드로 낼 때 즉시 발동하는 효과입니다.',
        'Triggers immediately when played from your hand.',
      ),
    },
    {
      name: tr('💀 죽음의 메아리', '💀 Deathrattle'),
      desc: tr(
        '이 하수인이 파괴될 때 발동하는 효과입니다.',
        'Triggers when this minion is destroyed.',
      ),
    },
    {
      name: tr('🌟 3장 = 3배 각성', '🌟 3 Copies = 3x Power'),
      desc: tr(
        '스토리모드에서는 같은 카드를 3장 이상 모으면 공격력·체력이 3배 이상 강해집니다!',
        'In Story Mode, owning 3+ copies boosts a minion’s Attack & Health by 3x or more!',
      ),
    },
  ];

  const handleClose = () => {
    markQuickRulesSeen();
    hsAudio.playSfx('box_close');
    onClose();
  };

  useModalDismiss(true, handleClose);

  return (
    <div
      onClick={handleClose}
      data-testid="quick-rules-modal"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/82 p-3 backdrop-blur-sm sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="hs-wood-panel relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl p-4 text-amber-100 shadow-2xl sm:p-6"
      >
        <div className="mb-3.5 flex items-start justify-between gap-3 border-b border-amber-500/35 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-950/70 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-200">
              <span>{tr('📖 실제 인게임 스크린샷 6단계 가이드', '📖 6-Step Real Screenshot Guide')}</span>
              {isFirstTime && (
                <span className="text-yellow-300">
                  {tr('· 첫 모험 환영!', '· Welcome, Challenger!')}
                </span>
              )}
            </div>
            <h2 className="hs-title mt-1.5 text-lg font-extrabold text-amber-100 sm:text-2xl">
              {tr('카드 배틀, 이렇게 하면 됩니다!', 'How to Play SNSHero!')}
            </h2>
          </div>
          <button
            type="button"
            data-testid="quick-rules-close"
            onClick={handleClose}
            className="hs-brass-btn min-h-[40px] shrink-0 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100"
          >
            {tr('닫기 ✕', 'Close ✕')}
          </button>
        </div>

        <HowToPlayCarousel variant="modal" playSound={true} />

        <div className="mt-3">
          <button
            type="button"
            data-testid="quick-rules-keywords-toggle"
            onClick={() => {
              hsAudio.playSfx('ui_click', 0.75);
              setShowKeywords((v) => !v);
            }}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#c8a158]/50 bg-black/45 px-3.5 py-2 text-xs font-extrabold text-amber-200 transition hover:border-amber-300 sm:text-sm"
          >
            <span>{tr('📖 자주 나오는 카드 능력(키워드) 6가지 보기', '📖 View 6 Core Card Keywords')}</span>
            <span>{showKeywords ? tr('접기 ▲', 'Hide ▲') : tr('펼치기 ▼', 'Show ▼')}</span>
          </button>

          {showKeywords && (
            <div className="mt-2 grid grid-cols-1 gap-2 rounded-2xl border border-[#c8a158]/35 bg-black/55 p-3 sm:grid-cols-2">
              {keywords.map((kw) => (
                <div
                  key={kw.name}
                  className="rounded-xl border border-amber-500/20 bg-stone-950/80 p-2.5"
                >
                  <div className="text-xs font-black text-yellow-300">{kw.name}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-amber-100/85">
                    {kw.desc}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3.5">
          <button
            type="button"
            data-testid="quick-rules-start-btn"
            onClick={() => {
              hsAudio.playSfx('box_press');
              markQuickRulesSeen();
              onClose();
            }}
            className="hs-arcane-btn hs-title hs-outline-sm min-h-[48px] w-full rounded-2xl py-3 text-base font-extrabold text-white shadow-xl"
          >
            {inBattle
              ? tr('이해했어요! 전투 시작하기 ⚔', 'Got It! Start Battle ⚔')
              : tr('이해했어요! 여관으로 돌아가기', 'Got It! Return to Sanctuary')}
          </button>
        </div>
      </div>
    </div>
  );
};
