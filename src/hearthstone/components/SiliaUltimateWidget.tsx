import React, { useEffect, useState } from 'react';
import { tr } from '../../i18n/heroLang';
import { hsAudio } from '../audio';

export type SiliaSkillKind = 'DEFENSE' | 'ATTACK' | 'HEAL';

interface SiliaUltimateWidgetProps {
  visible: boolean;
  isPlayerTurn: boolean;
  usedThisTurn: boolean;
  friendlyBoardCount: number;
  enemyBoardCount: number;
  onCastSkill: (skillKind: SiliaSkillKind) => void;
}

const IDLE_FRAMES = [
  '/hs-assets/silia-bot/idle_01.webp',
  '/hs-assets/silia-bot/idle_02.webp',
  '/hs-assets/silia-bot/idle_03.webp',
  '/hs-assets/silia-bot/idle_04.webp',
];

const CUTSCENE_FRAMES: Record<SiliaSkillKind, string[]> = {
  DEFENSE: [
    '/hs-assets/silia-bot/cast_defense_01.webp',
    '/hs-assets/silia-bot/cast_defense_02.webp',
  ],
  ATTACK: [
    '/hs-assets/silia-bot/cast_attack_01.webp',
    '/hs-assets/silia-bot/cast_attack_02.webp',
  ],
  HEAL: [
    '/hs-assets/silia-bot/cast_heal_01.webp',
    '/hs-assets/silia-bot/cast_heal_02.webp',
  ],
};

/**
 * Story-Mode-only Bottom-Left Animated Silia Chatbot & Cutscene Ultimate Widget
 * (mirrors bottom-right KadanChatbotWidget: compact animated character button,
 * opens 3-skill popup on click, and plays per-skill animated casting cutscene).
 */
export const SiliaUltimateWidget: React.FC<SiliaUltimateWidgetProps> = ({
  visible,
  isPlayerTurn,
  usedThisTurn,
  friendlyBoardCount,
  enemyBoardCount,
  onCastSkill,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [castingSkill, setCastingSkill] = useState<SiliaSkillKind | null>(null);
  const [speechText, setSpeechText] = useState<string | null>(null);

  // Preload all idle + 3-cutscene animation frames for flicker-free sprite playback
  useEffect(() => {
    const all = [
      ...IDLE_FRAMES,
      ...CUTSCENE_FRAMES.DEFENSE,
      ...CUTSCENE_FRAMES.ATTACK,
      ...CUTSCENE_FRAMES.HEAL,
    ];
    all.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Sprite frame ticker (slow breathing breeze idle vs rapid 2-frame cutscene cast)
  useEffect(() => {
    if (!visible) return;
    setFrameIdx(0);
    const intervalMs = castingSkill ? 140 : 620;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setFrameIdx((prev) => prev + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [visible, castingSkill]);

  useEffect(() => {
    if (!castingSkill) return;
    const t = window.setTimeout(() => setCastingSkill(null), 1300);
    return () => window.clearTimeout(t);
  }, [castingSkill]);

  useEffect(() => {
    if (!speechText || menuOpen || castingSkill) return;
    const t = window.setTimeout(() => setSpeechText(null), 5500);
    return () => window.clearTimeout(t);
  }, [speechText, menuOpen, castingSkill]);

  if (!visible) return null;

  const canCastAny = isPlayerTurn && !usedThisTurn;

  const activeFrames = castingSkill ? CUTSCENE_FRAMES[castingSkill] : IDLE_FRAMES;
  const activeSpriteUrl = activeFrames[frameIdx % activeFrames.length];

  const handleToggleChatbot = (e: React.MouseEvent) => {
    e.stopPropagation();
    hsAudio.playSfx('ui_click', 0.8);
    setMenuOpen((prev) => {
      const next = !prev;
      if (next) {
        setSpeechText(
          canCastAny
            ? tr(
                '바람의 힘이 준비되었어요! 매 턴 1회, 원하는 필살기를 선택하세요!',
                'My wind magic is ready! Pick one Ultimate skill this turn!',
              )
            : usedThisTurn
              ? tr(
                  '이번 턴은 이미 필살기를 썼어요. 다음 아군 턴에 다시 준비돼요!',
                  'I already cast my skill this turn. Ready again next turn!',
                )
              : tr(
                  '상대 턴이 끝나면 바로 바람 필살기를 영창할 수 있어요!',
                  'Wait until your turn to cast a wind skill!',
                ),
        );
      } else {
        setSpeechText(null);
      }
      return next;
    });
  };

  const triggerSkill = (skill: SiliaSkillKind) => {
    if (!canCastAny) return;
    setMenuOpen(false);
    setCastingSkill(skill);
    setSpeechText(
      skill === 'DEFENSE'
        ? tr('바람의 결계여, 동료들을 수호하라!', 'Wind Barrier, shield our allies!')
        : skill === 'ATTACK'
          ? tr('녹풍의 칼날, 적진을 휩쓸어라!', 'Emerald Gale, slice all enemies!')
          : tr('생명의 미풍이여, 카단을 치유하라!', 'Vital breeze, heal our hero!'),
    );
    onCastSkill(skill);
  };

  const cutsceneTitle =
    castingSkill === 'DEFENSE'
      ? tr('🛡 실리아 방어 컷신 — 바람 결계!', '🛡 Silia Defense Cutscene — Wind Barrier!')
      : castingSkill === 'ATTACK'
        ? tr('🌪 실리아 공격 컷신 — 녹풍 참격!', '🌪 Silia Attack Cutscene — Emerald Gale!')
        : castingSkill === 'HEAL'
          ? tr('💚 실리아 회복 컷신 — 생명의 미풍!', '💚 Silia Heal Cutscene — Vital Breeze!')
          : null;

  return (
    <div
      data-silia-widget="true"
      className="pointer-events-none fixed bottom-2.5 left-2.5 z-[72] flex max-w-[calc(100vw-20px)] flex-col items-start select-none sm:bottom-3.5 sm:left-3.5"
    >
      {/* Dynamic Per-Skill Cutscene Banner + Animated Portrait Cut-in */}
      {castingSkill && (
        <div
          data-silia-cutscene={castingSkill}
          className="pointer-events-none mb-2 flex items-center gap-2.5 rounded-2xl border-2 border-emerald-300 bg-[#052418]/95 px-3 py-2 text-emerald-50 shadow-[0_12px_36px_rgba(16,185,129,0.55)] backdrop-blur-md"
        >
          <img
            src={activeSpriteUrl}
            alt={cutsceneTitle || 'Silia Cutscene'}
            className="h-16 w-16 shrink-0 rounded-xl border border-emerald-300/70 bg-emerald-950/80 object-contain sm:h-20 sm:w-20"
          />
          <div className="min-w-0 max-w-[230px]">
            <div className="text-[11px] font-extrabold text-emerald-300 sm:text-xs">
              {cutsceneTitle}
            </div>
            <div className="mt-0.5 text-[11px] font-bold leading-snug text-white">
              “{speechText}”
            </div>
          </div>
        </div>
      )}

      {/* Silia Chatbot Popup Skill Menu (opens on clicking Silia, just like Kadan!) */}
      {menuOpen && (
        <div
          data-silia-menu="true"
          className="pointer-events-auto mb-2 w-[238px] overflow-hidden rounded-2xl border-2 border-emerald-400/80 bg-[#061c15]/96 p-2.5 text-emerald-50 shadow-[0_16px_38px_rgba(0,0,0,0.85)] backdrop-blur-md sm:w-[272px]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-emerald-500/25 pb-1.5">
            <div>
              <div className="text-xs font-extrabold text-emerald-200 sm:text-[13px]">
                🌪 {tr('실리아 필살기 (스토리 전용)', 'Silia Ultimate (Story)')}
              </div>
              <div
                data-silia-status={canCastAny ? 'ready' : 'locked'}
                className={`text-[10px] font-bold ${
                  canCastAny ? 'text-emerald-300' : 'text-stone-400'
                }`}
              >
                {usedThisTurn
                  ? tr('이번 턴 사용 완료 (0/1)', 'Used this turn (0/1)')
                  : !isPlayerTurn
                    ? tr('상대 턴 대기 중', 'Enemy Turn')
                    : tr('이번 턴 1회 사용 가능 (1/1)', 'Ready (1/1 per turn)')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-950/90 text-xs font-bold text-emerald-200 hover:bg-emerald-900"
              aria-label={tr('닫기', 'Close')}
            >
              ✕
            </button>
          </div>

          <div className="mt-2 flex flex-col gap-1.5">
            <button
              type="button"
              data-silia-skill="DEFENSE"
              disabled={!canCastAny}
              onClick={() => triggerSkill('DEFENSE')}
              className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left transition ${
                canCastAny
                  ? 'cursor-pointer border-emerald-400/80 bg-emerald-950/90 text-emerald-50 hover:border-emerald-200 hover:bg-emerald-900'
                  : 'cursor-not-allowed border-stone-700/70 bg-stone-900/75 text-stone-400 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold text-emerald-200">
                  🛡 {tr('방어스킬 · 바람 결계', 'Defense · Wind Barrier')}
                </div>
                <div className="truncate text-[10px] text-emerald-100/85">
                  {tr(`내 보드 전체 방어막 (${friendlyBoardCount}체)`, `Shield all allies (${friendlyBoardCount})`)}
                </div>
              </div>
              <span className="shrink-0 rounded bg-emerald-800/85 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-100">
                {tr('방어막', 'Shield')}
              </span>
            </button>

            <button
              type="button"
              data-silia-skill="ATTACK"
              disabled={!canCastAny}
              onClick={() => triggerSkill('ATTACK')}
              className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left transition ${
                canCastAny
                  ? 'cursor-pointer border-teal-400/80 bg-teal-950/90 text-teal-50 hover:border-teal-200 hover:bg-teal-900'
                  : 'cursor-not-allowed border-stone-700/70 bg-stone-900/75 text-stone-400 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold text-teal-200">
                  🌪 {tr('공격스킬 · 녹풍 참격', 'Attack · Gale Slash')}
                </div>
                <div className="truncate text-[10px] text-teal-100/85">
                  {tr(`적 보드 전체 -1 체력 (${enemyBoardCount}체)`, `All enemies -1 HP (${enemyBoardCount})`)}
                </div>
              </div>
              <span className="shrink-0 rounded bg-rose-900/90 px-1.5 py-0.5 text-[9.5px] font-bold text-rose-100">
                -1 HP
              </span>
            </button>

            <button
              type="button"
              data-silia-skill="HEAL"
              disabled={!canCastAny}
              onClick={() => triggerSkill('HEAL')}
              className={`flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-left transition ${
                canCastAny
                  ? 'cursor-pointer border-lime-400/80 bg-lime-950/85 text-lime-50 hover:border-lime-200 hover:bg-lime-900/90'
                  : 'cursor-not-allowed border-stone-700/70 bg-stone-900/75 text-stone-400 opacity-60'
              }`}
            >
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold text-lime-200">
                  💚 {tr('회복스킬 · 생명의 미풍', 'Heal · Vital Breeze')}
                </div>
                <div className="truncate text-[10px] text-lime-100/85">
                  {tr('아군 영웅 +2 체력 회복', 'Restore +2 Hero HP')}
                </div>
              </div>
              <span className="shrink-0 rounded bg-lime-800/85 px-1.5 py-0.5 text-[9.5px] font-bold text-lime-100">
                +2 HP
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Transient Speech Bubble when menu is closed */}
      {!menuOpen && !castingSkill && speechText && (
        <div className="mb-1.5 max-w-[205px] rounded-xl border border-emerald-400/75 bg-[#061f16]/95 px-2.5 py-1.5 text-[10.5px] font-bold text-emerald-100 shadow-lg">
          {speechText}
        </div>
      )}

      {/* Animated Silia Chatbot Trigger Button (mirrors bottom-right Kadan character!) */}
      <button
        type="button"
        data-silia-toggle="true"
        data-silia-status={canCastAny ? 'ready' : 'locked'}
        onClick={handleToggleChatbot}
        title={tr('실리아 클릭 — 필살기 선택 & 컷신 애니메이션', 'Click Silia — Open Ultimate Skills')}
        className={`pointer-events-auto group relative flex flex-col items-center rounded-2xl border-2 p-1 transition duration-200 focus:outline-none ${
          castingSkill
            ? 'scale-105 border-emerald-200 bg-emerald-950/90 shadow-[0_0_24px_rgba(52,211,153,0.9)]'
            : menuOpen
              ? 'border-emerald-300 bg-emerald-950/90 shadow-[0_0_18px_rgba(52,211,153,0.65)]'
              : canCastAny
                ? 'border-emerald-400/85 bg-[#051a13]/88 shadow-[0_8px_22px_rgba(0,0,0,0.75)] hover:scale-105 hover:border-emerald-200'
                : 'border-stone-600/75 bg-stone-950/85 opacity-85 hover:opacity-100'
        }`}
      >
        <div className="relative h-[86px] w-[86px] overflow-hidden rounded-xl sm:h-[116px] sm:w-[116px]">
          <img
            src={activeSpriteUrl}
            alt={tr('실리아', 'Silia')}
            draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]"
          />
          <span
            className={`absolute right-1 top-1 rounded-md border px-1 py-0.5 text-[9px] font-extrabold shadow ${
              canCastAny
                ? 'border-emerald-200 bg-emerald-600 text-white'
                : 'border-stone-500 bg-stone-800 text-stone-300'
            }`}
          >
            {usedThisTurn ? '0/1' : isPlayerTurn ? '1/1 ✦' : '...'}
          </span>
        </div>
        <div className="mt-0.5 rounded-lg bg-emerald-950/90 px-2 py-0.5 text-[10px] font-extrabold text-emerald-200 shadow sm:text-[11px]">
          {castingSkill
            ? tr('✦ 영창 중...', '✦ Casting...')
            : canCastAny
              ? tr('실리아 · 필살기', 'Silia · Ult ▾')
              : usedThisTurn
                ? tr('실리아 (완료)', 'Silia (Used)')
                : tr('실리아 (대기)', 'Silia (Wait)')}
        </div>
      </button>
    </div>
  );
};
