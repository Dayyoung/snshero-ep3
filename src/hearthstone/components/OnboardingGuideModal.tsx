import React, { useState } from 'react';
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

  const coreRules = [
    {
      step: '1',
      icon: '👑',
      title: tr('승리 조건: 적 영웅 체력 0 만들기', 'Win Condition: Reduce Enemy Hero to 0 HP'),
      desc: tr(
        '화면 위쪽 상대 영웅의 빨간 체력 방울(기본 30)을 0으로 만들면 즉시 승리합니다!',
        'Bring the enemy hero’s red Health gem at the top (30 HP) down to 0 to win!',
      ),
      accent: 'border-rose-400/55 bg-rose-950/35 text-rose-200',
    },
    {
      step: '2',
      icon: '💎',
      title: tr('마나(파란 보석)로 초록 카드 내기', 'Play Green-Glowing Cards with Mana'),
      desc: tr(
        '매 턴 최대 마나가 +1씩 늘어납니다(최대 10). 내 마나 이하의 초록색 테두리 카드를 눌러 소환하세요!',
        'Gain +1 Max Mana each turn (up to 10). Tap cards with a green glow within your Mana to cast them!',
      ),
      accent: 'border-sky-400/55 bg-sky-950/35 text-sky-200',
    },
    {
      step: '3',
      icon: '⚔️',
      title: tr('소환 다음 턴부터 공격 & 턴 종료', 'Attack Next Turn & End Turn'),
      desc: tr(
        '소환한 하수인은 첫 턴에 잠든(Zzz) 뒤, 다음 턴 초록 테두리가 켜지면 적 하수인·적 영웅을 눌러 공격합니다. 할 일이 끝나면 [턴 종료]를 누르세요.',
        'Summoned minions sleep (Zzz) on turn 1, then glow green next turn to attack enemies. Tap [End Turn] when done.',
      ),
      accent: 'border-emerald-400/55 bg-emerald-950/35 text-emerald-200',
    },
  ];

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
        className="hs-wood-panel relative max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl p-4 text-amber-100 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-amber-500/35 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-950/70 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-200">
              <span>{tr('🧭 10초 핵심 규칙 가이드', '🧭 10-Second Quick Rules')}</span>
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

        <div className="space-y-2.5">
          {coreRules.map((rule) => (
            <div
              key={rule.step}
              className={`flex items-start gap-3 rounded-2xl border p-3 sm:p-3.5 ${rule.accent}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/45 text-xl shadow-inner">
                {rule.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-white sm:text-base">
                  {rule.step}. {rule.title}
                </div>
                <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-100/90 sm:text-[13px]">
                  {rule.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-2xl border border-amber-400/45 bg-amber-950/45 px-3.5 py-2.5 text-xs font-semibold text-amber-100">
          <span className="font-black text-yellow-300">{tr('⚙ 자동플레이 팁:', '⚙ Auto-Play Tip:')}</span>{' '}
          {tr(
            '직접 플레이하다가 막히거나 편하게 관전하고 싶을 때는 우측 상단 ',
            'Want to relax or watch the AI take over? Toggle ',
          )}
          <span className="rounded bg-black/50 px-1.5 py-0.5 font-extrabold text-emerald-300">
            {tr('⚙ 자동 ON/OFF', '⚙ Auto ON/OFF')}
          </span>{' '}
          {tr('버튼으로 언제든 전환할 수 있습니다!', 'in the top-right corner anytime!')}
        </div>

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

        <div className="mt-4">
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
