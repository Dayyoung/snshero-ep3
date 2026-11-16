import React, { useEffect, useState } from 'react';
import { tr } from '../../i18n/heroLang';

export type SiliaSkillKind = 'DEFENSE' | 'ATTACK' | 'HEAL';

interface SiliaUltimateWidgetProps {
  visible: boolean;
  isPlayerTurn: boolean;
  usedThisTurn: boolean;
  friendlyBoardCount: number;
  enemyBoardCount: number;
  onCastSkill: (skillKind: SiliaSkillKind) => void;
}

const SILIA_CUTOUT_URL = '/hs-assets/characters/cutouts/062_Celia.webp';

export const SiliaUltimateWidget: React.FC<SiliaUltimateWidgetProps> = ({
  visible,
  isPlayerTurn,
  usedThisTurn,
  friendlyBoardCount,
  enemyBoardCount,
  onCastSkill,
}) => {
  const [castingSkill, setCastingSkill] = useState<SiliaSkillKind | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!castingSkill) return;
    const t = window.setTimeout(() => setCastingSkill(null), 1150);
    return () => window.clearTimeout(t);
  }, [castingSkill]);

  if (!visible) return null;

  const canCastAny = isPlayerTurn && !usedThisTurn;

  const triggerSkill = (skill: SiliaSkillKind) => {
    if (!canCastAny) return;
    setCastingSkill(skill);
    onCastSkill(skill);
  };

  const castQuote =
    castingSkill === 'DEFENSE'
      ? tr('바람의 결계여, 동료들을 수호하라!', 'Wind Barrier, shield our allies!')
      : castingSkill === 'ATTACK'
        ? tr('녹풍의 칼날, 적진을 휩쓸어라!', 'Emerald Gale, slice the enemy!')
        : castingSkill === 'HEAL'
          ? tr('생명의 바람이여, 카단을 치유하라!', 'Vital breeze, mend Kadan!')
          : null;

  return (
    <div
      data-silia-widget="true"
      className="fixed bottom-2 left-2 z-[68] flex flex-col items-start select-none sm:bottom-3.5 sm:left-3.5"
    >
      {/* Floating spell cast chant bubble */}
      {castQuote && (
        <div className="mb-1.5 max-w-[210px] rounded-xl border border-emerald-400/80 bg-[#062219]/95 px-2.5 py-1.5 text-[10.5px] font-extrabold text-emerald-100 shadow-[0_6px_18px_rgba(16,185,129,0.45)] animate-pulse">
          <span className="text-emerald-300">✦ {tr('실리아 영창', 'Silia Cast')}: </span>
          {castQuote}
        </div>
      )}

      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          data-silia-expand="true"
          className="flex min-h-[44px] items-center gap-2 rounded-2xl border-2 border-emerald-400/75 bg-[#061e16]/95 px-2.5 py-1.5 text-left shadow-xl transition hover:border-emerald-300"
        >
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-emerald-300 bg-emerald-950">
            <img
              src={SILIA_CUTOUT_URL}
              alt={tr('실리아', 'Silia')}
              className="h-[145%] w-full object-cover object-top"
            />
          </div>
          <div>
            <div className="text-[11px] font-extrabold text-emerald-200">
              {tr('실리아 궁극기', 'Silia Ult')}
            </div>
            <div className="text-[9.5px] font-bold text-emerald-400">
              {canCastAny ? tr('1/1 가능', '1/1 Ready') : usedThisTurn ? tr('사용완료', 'Used') : tr('대기 중', 'Waiting')}
            </div>
          </div>
        </button>
      ) : (
        <div className="relative w-[178px] overflow-hidden rounded-2xl border-2 border-emerald-400/75 bg-[#061c15]/94 p-2 text-emerald-50 shadow-[0_12px_30px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:w-[208px] sm:p-2.5">
          {/* Casting emerald windstorm aura glow */}
          {castingSkill && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-emerald-300 bg-emerald-400/20 animate-ping" />
          )}

          {/* Header bar: Silia portrait + turn status + minimize toggle */}
          <div className="relative flex items-center gap-2">
            <div
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 transition-transform duration-300 sm:h-14 sm:w-14 ${
                castingSkill
                  ? 'scale-105 border-emerald-200 bg-emerald-800 shadow-[0_0_16px_#34d399]'
                  : 'border-emerald-400/80 bg-[#0b2e22]'
              }`}
            >
              <img
                src={SILIA_CUTOUT_URL}
                alt={tr('실리아', 'Silia')}
                className="h-[155%] w-full object-cover object-top"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-extrabold text-emerald-200 sm:text-[13px]">
                  {tr('실리아', 'Silia')}
                </span>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label={tr('실리아 창 접기', 'Minimize Silia')}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-950/80 text-[11px] font-bold text-emerald-200 hover:bg-emerald-900"
                >
                  —
                </button>
              </div>
              <div className="text-[9.5px] font-semibold text-emerald-300/85">
                {tr('소설 동행 궁극기', 'Story Companion Ult')}
              </div>
              <div
                data-silia-status={canCastAny ? 'ready' : 'locked'}
                className={`mt-1 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold ${
                  canCastAny
                    ? 'border-emerald-300 bg-emerald-700/85 text-white'
                    : 'border-stone-600 bg-stone-800/90 text-stone-300'
                }`}
              >
                {usedThisTurn
                  ? tr('이번 턴 사용 완료 (0/1)', 'Used this turn (0/1)')
                  : !isPlayerTurn
                    ? tr('상대 턴 대기 중', 'Enemy Turn')
                    : tr('이번 턴 1회 가능 (1/1)', 'Ready (1/1 per turn)')}
              </div>
            </div>
          </div>

          {/* 3 Novel Skills */}
          <div className="relative mt-2 flex flex-col gap-1.5">
            <button
              type="button"
              data-silia-skill="DEFENSE"
              disabled={!canCastAny}
              onClick={() => triggerSkill('DEFENSE')}
              className={`flex min-h-[40px] items-center justify-between gap-1.5 rounded-xl border px-2 py-1 text-left transition ${
                canCastAny
                  ? 'cursor-pointer border-emerald-400/75 bg-emerald-950/90 text-emerald-50 hover:border-emerald-200 hover:bg-emerald-900'
                  : 'cursor-not-allowed border-stone-700/70 bg-stone-900/75 text-stone-400 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-emerald-200">
                  🛡 {tr('방어스킬', 'Defense Skill')}
                </div>
                <div className="truncate text-[9.5px] text-emerald-100/80">
                  {tr(`아군 전체 방어막 (${friendlyBoardCount}체)`, `Ally Divine Shield (${friendlyBoardCount})`)}
                </div>
              </div>
              <span className="shrink-0 rounded bg-emerald-800/80 px-1.5 py-0.5 text-[9px] font-bold text-emerald-100">
                {tr('방어막', 'Shield')}
              </span>
            </button>

            <button
              type="button"
              data-silia-skill="ATTACK"
              disabled={!canCastAny}
              onClick={() => triggerSkill('ATTACK')}
              className={`flex min-h-[40px] items-center justify-between gap-1.5 rounded-xl border px-2 py-1 text-left transition ${
                canCastAny
                  ? 'cursor-pointer border-teal-400/75 bg-teal-950/90 text-teal-50 hover:border-teal-200 hover:bg-teal-900'
                  : 'cursor-not-allowed border-stone-700/70 bg-stone-900/75 text-stone-400 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-teal-200">
                  🌪 {tr('공격스킬', 'Attack Skill')}
                </div>
                <div className="truncate text-[9.5px] text-teal-100/80">
                  {tr(`적군 전체 -1 체력 (${enemyBoardCount}체)`, `All Enemies -1 HP (${enemyBoardCount})`)}
                </div>
              </div>
              <span className="shrink-0 rounded bg-rose-900/85 px-1.5 py-0.5 text-[9px] font-bold text-rose-100">
                -1 HP
              </span>
            </button>

            <button
              type="button"
              data-silia-skill="HEAL"
              disabled={!canCastAny}
              onClick={() => triggerSkill('HEAL')}
              className={`flex min-h-[40px] items-center justify-between gap-1.5 rounded-xl border px-2 py-1 text-left transition ${
                canCastAny
                  ? 'cursor-pointer border-lime-400/75 bg-lime-950/85 text-lime-50 hover:border-lime-200 hover:bg-lime-900/90'
                  : 'cursor-not-allowed border-stone-700/70 bg-stone-900/75 text-stone-400 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold text-lime-200">
                  💚 {tr('회복스킬', 'Heal Skill')}
                </div>
                <div className="truncate text-[9.5px] text-lime-100/80">
                  {tr('아군 영웅 +2 체력', 'Friendly Hero +2 HP')}
                </div>
              </div>
              <span className="shrink-0 rounded bg-lime-800/85 px-1.5 py-0.5 text-[9px] font-bold text-lime-100">
                +2 HP
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
