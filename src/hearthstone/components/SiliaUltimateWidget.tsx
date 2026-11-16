import React, { useEffect, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { useAnimaleseTypewriter } from './StoryEncounterOverlays';

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

const SILIA_UPPER_CUTOUT_URL = '/hs-assets/characters/cutouts/062_Celia.webp';

interface SkillCutsceneMeta {
  icon: string;
  titleKo: string;
  titleEn: string;
  effectKo: string;
  effectEn: string;
  lineKo: string;
  lineEn: string;
  accentBorder: string;
  accentBadge: string;
  auraBg: string;
}

const SKILL_CUTSCENE_META: Record<SiliaSkillKind, SkillCutsceneMeta> = {
  DEFENSE: {
    icon: '🛡',
    titleKo: '바람 결계',
    titleEn: 'Wind Barrier',
    effectKo: '아군 보드 전체 천상의 보호막 부여',
    effectEn: 'Divine Shield on all friendly minions',
    lineKo: '바람의 결계여, 우리 동료들을 굳건히 수호하라!',
    lineEn: 'Wind Barrier, rise and shield all our allies!',
    accentBorder: 'border-emerald-300/70',
    accentBadge: 'bg-emerald-700 text-emerald-50',
    auraBg: 'radial-gradient(circle, rgba(16,185,129,0.42) 0%, rgba(16,185,129,0.08) 55%, transparent 75%)',
  },
  ATTACK: {
    icon: '🌪',
    titleKo: '녹풍 참격',
    titleEn: 'Emerald Gale',
    effectKo: '적 하수인 전체 피해 -1',
    effectEn: 'Deal 1 damage to all enemy minions',
    lineKo: '녹풍의 칼날이여, 적진 전체를 단숨에 휩쓸어라!',
    lineEn: 'Emerald Gale, slice clean through every enemy!',
    accentBorder: 'border-teal-300/70',
    accentBadge: 'bg-teal-700 text-teal-50',
    auraBg: 'radial-gradient(circle, rgba(45,212,191,0.42) 0%, rgba(16,185,129,0.08) 55%, transparent 75%)',
  },
  HEAL: {
    icon: '💚',
    titleKo: '생명의 미풍',
    titleEn: 'Vital Breeze',
    effectKo: '아군 영웅 체력 +2 회복',
    effectEn: 'Restore +2 Hero Health',
    lineKo: '따스한 생명의 미풍이여, 카단의 상처를 치유하라!',
    lineEn: 'Gentle vital breeze, restore our hero back to strength!',
    accentBorder: 'border-lime-300/70',
    accentBadge: 'bg-lime-700 text-lime-50',
    auraBg: 'radial-gradient(circle, rgba(163,230,53,0.38) 0%, rgba(16,185,129,0.08) 55%, transparent 75%)',
  },
};

interface SiliaDialogueCutsceneOverlayProps {
  skillKind: SiliaSkillKind;
  chibiFrameUrl: string;
  isKo: boolean;
  onComplete: () => void;
}

/**
 * Story-dialogue-style Ultimate Cutscene Overlay (`대사화면` exact match):
 * - Large waist-up Silia cutout (`상반신`) with Animalese voice & `talkBob` bounce
 * - Floating 3-head-tall chibi action badge showing the active casting sprite
 * - Dark trapezoid nameplate + cream-white dialogue plate with click/auto-advance
 */
const SiliaDialogueCutsceneOverlay: React.FC<SiliaDialogueCutsceneOverlayProps> = ({
  skillKind,
  chibiFrameUrl,
  isKo,
  onComplete,
}) => {
  const meta = SKILL_CUTSCENE_META[skillKind];
  const speakerLabel = isKo ? '실리아' : 'Silia';
  const speechLine = isKo ? meta.lineKo : meta.lineEn;
  const skillTitle = isKo ? meta.titleKo : meta.titleEn;
  const effectSummary = isKo ? meta.effectKo : meta.effectEn;

  const { displayedText, isTyping, talkBob, handleInteract } = useAnimaleseTypewriter({
    fullText: speechLine,
    speakerLabel,
    speakerSide: 'LEFT',
    resetKey: `silia-ult:${skillKind}`,
    isKo,
    enabled: true,
    onAutoAdvance: onComplete,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        handleInteract();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        hsAudio.playSfx('ui_click', 0.65);
        onComplete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleInteract, onComplete]);

  return (
    <div
      data-testid="silia-ultimate-cutscene-overlay"
      data-silia-cutscene={skillKind}
      onClick={(e) => {
        e.stopPropagation();
        handleInteract();
      }}
      className="fixed inset-0 z-[92] cursor-pointer select-none overflow-hidden bg-black/62"
    >
      {/* Subtle Top & Bottom Cinematic Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/75" />

      {/* Top Skill Cutscene Strip + 1-Tap Skip Button */}
      <div className="relative z-30 flex items-center justify-between gap-2 px-3 pt-2.5 sm:px-6 sm:pt-4">
        <div
          className={`flex items-center gap-2 rounded-full border ${meta.accentBorder} bg-stone-950/88 px-3.5 py-1.5 shadow-lg`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />
          <span className="hs-title truncate text-xs font-extrabold tracking-wide text-emerald-100 sm:text-sm">
            {meta.icon} {tr('실리아 필살기', 'Silia Ultimate')} · {skillTitle}
          </span>
        </div>

        <button
          type="button"
          data-testid="silia-cutscene-skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            hsAudio.playSfx('ui_click', 0.7);
            onComplete();
          }}
          className="min-h-[44px] rounded-xl border border-white/25 bg-stone-950/85 px-3.5 py-1.5 text-xs font-extrabold text-stone-200 shadow-lg transition hover:border-emerald-300 hover:text-emerald-200"
        >
          {tr('건너뛰기 ▸▸', 'SKIP ▸▸')}
        </button>
      </div>

      {/* Elemental Wind Aura Behind Upper-Body Silia */}
      <div
        aria-hidden="true"
        style={{ background: meta.auraBg }}
        className="pointer-events-none absolute -bottom-10 left-[26%] z-10 h-[78vh] w-[78vh] -translate-x-1/2 rounded-full blur-2xl sm:left-[30%]"
      />

      {/* Right-Side Floating 3-Head-Tall Chibi Action Cut-in Card */}
      <div className="pointer-events-none absolute right-[8%] top-[18%] z-20 hidden flex-col items-center sm:flex">
        <div className="relative flex h-36 w-36 items-center justify-center rounded-full border border-emerald-300/45 bg-stone-950/65 p-2 shadow-[0_0_32px_rgba(16,185,129,0.45)] backdrop-blur-sm">
          <img
            src={chibiFrameUrl}
            alt={skillTitle}
            draggable={false}
            className="h-full w-full object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.85)]"
          />
        </div>
        <span
          className={`-mt-2 rounded-full border border-white/25 px-3 py-0.5 text-[11px] font-extrabold shadow ${meta.accentBadge}`}
        >
          {meta.icon} {skillTitle}
        </span>
      </div>

      {/* Left/Center Silia Upper-Body Cutout (`상반신` 68%~78% Viewport Height — exact dialogue screen style) */}
      <div
        data-testid="silia-cutscene-portrait"
        style={{
          transformOrigin: 'bottom center',
          transform: `translate3d(-50%, ${talkBob ? '-8px' : '0px'}, 0) scale(1.04)`,
          transition: 'transform 140ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="pointer-events-none absolute -bottom-2.5 left-[28%] z-20 flex h-[68%] items-start justify-center sm:left-[30%] sm:h-[78%]"
      >
        <img
          src={SILIA_UPPER_CUTOUT_URL}
          alt={speakerLabel}
          decoding="async"
          draggable={false}
          className="h-[168%] w-auto max-w-none select-none drop-shadow-[0_14px_28px_rgba(16,185,129,0.35)]"
        />
      </div>

      {/* Speech Bubble Box Aligned to Silia (`캐릭터 대사 장면` Exact Style!) */}
      <div className="inset-x-3 absolute bottom-5 z-30 sm:inset-x-auto sm:bottom-8 sm:left-[8%] sm:w-[460px]">
        {/* Top Dark Trapezoid Speaker Nameplate */}
        <div
          className="relative z-10 mx-auto -mb-3 flex w-fit min-w-[140px] max-w-[280px] items-center justify-center px-6 py-1.5 text-center shadow-md"
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
        <div className="relative min-h-[96px] rounded-[12px] border border-stone-300 bg-[#f2f2f0] px-5 pb-4 pt-5 text-left shadow-[0_18px_42px_rgba(0,0,0,0.88)] sm:min-h-[108px] sm:px-6 sm:pt-6">
          {/* Compact Skill Tag Bar */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-md px-2 py-0.5 text-[10.5px] font-black ${meta.accentBadge}`}>
              {meta.icon} {skillTitle}
            </span>
            <span className="text-[11px] font-extrabold text-emerald-800">{effectSummary}</span>
          </div>

          <p
            data-testid="silia-cutscene-dialogue-text"
            data-full-text={speechLine}
            aria-label={speechLine}
            className="relative text-[13.5px] font-bold leading-relaxed text-[#1b1d22] sm:text-[15px]"
          >
            <span aria-hidden="true" className="invisible block">
              {speechLine}
            </span>
            <span className="absolute inset-0 block">{displayedText}</span>
          </p>

          <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-stone-500">
            <span>
              {isTyping
                ? tr(
                    '클릭 시 대사 한번에 표시 · 자동 진행',
                    'Tap to reveal full line · Auto-advances',
                  )
                : tr('잠시 후 전장으로 복귀합니다...', 'Returning to battle shortly...')}
            </span>
          </div>

          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-2.5 right-3.5 text-xs font-black text-[#1b1d22] ${
              isTyping ? 'opacity-45' : 'animate-bounce opacity-100'
            }`}
          >
            ▼
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Story-Mode-only Bottom-Left Animated 3-Head-Tall Chibi Silia Widget
 * (matches bottom-right KadanChatbotWidget sprite style, opens 3-skill popup,
 * and triggers full Dialogue-style Upper-Body Ultimate Cutscene on cast).
 */
export const SiliaUltimateWidget: React.FC<SiliaUltimateWidgetProps> = ({
  visible,
  isPlayerTurn,
  usedThisTurn,
  friendlyBoardCount,
  enemyBoardCount,
  onCastSkill,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';

  const [menuOpen, setMenuOpen] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);
  const [castingSkill, setCastingSkill] = useState<SiliaSkillKind | null>(null);
  const [speechText, setSpeechText] = useState<string | null>(null);

  // Preload all 3-head-tall chibi sprites + upper-body cutout once for zero-flicker cutscenes
  useEffect(() => {
    const all = [
      ...IDLE_FRAMES,
      ...CUTSCENE_FRAMES.DEFENSE,
      ...CUTSCENE_FRAMES.ATTACK,
      ...CUTSCENE_FRAMES.HEAL,
      SILIA_UPPER_CUTOUT_URL,
    ];
    all.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Sprite frame ticker (gentle idle vs dynamic 2-frame skill cast)
  useEffect(() => {
    if (!visible) return;
    setFrameIdx(0);
    const intervalMs = castingSkill ? 160 : 650;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setFrameIdx((prev) => prev + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [visible, castingSkill]);

  useEffect(() => {
    if (!visible && castingSkill) {
      setCastingSkill(null);
      setMenuOpen(false);
      setSpeechText(null);
    }
  }, [visible, castingSkill]);

  useEffect(() => {
    if (!speechText || menuOpen || castingSkill) return;
    const t = window.setTimeout(() => setSpeechText(null), 5500);
    return () => window.clearTimeout(t);
  }, [speechText, menuOpen, castingSkill]);

  if (!visible) return null;

  const canCastAny = isPlayerTurn && !usedThisTurn;

  const activeFrames = castingSkill ? CUTSCENE_FRAMES[castingSkill] : IDLE_FRAMES;
  const activeIdx = frameIdx % activeFrames.length;
  const activeSpriteUrl = activeFrames[activeIdx];

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
    setSpeechText(null);
    setCastingSkill(skill);
    onCastSkill(skill);
  };

  return (
    <>
      {/* Full-Screen Dialogue-Style Upper-Body Ultimate Cutscene Overlay */}
      {castingSkill && (
        <SiliaDialogueCutsceneOverlay
          skillKind={castingSkill}
          chibiFrameUrl={activeSpriteUrl}
          isKo={isKo}
          onComplete={() => setCastingSkill(null)}
        />
      )}

      <div
        data-silia-widget="true"
        className="pointer-events-none fixed bottom-2.5 left-2.5 z-[72] flex max-w-[calc(100vw-20px)] flex-col items-start select-none sm:bottom-3.5 sm:left-3.5"
      >
        {/* Silia Skill Selection Menu (opens cleanly above 3-head-tall Silia, matching Kadan) */}
        {menuOpen && (
          <div
            data-silia-menu="true"
            className="pointer-events-auto mb-2 w-[248px] overflow-hidden rounded-2xl border-2 border-emerald-400/80 bg-[#061c15]/96 p-2.5 text-emerald-50 shadow-[0_16px_38px_rgba(0,0,0,0.85)] backdrop-blur-md sm:w-[276px]"
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

        {/* Bottom-Left 3-Head-Tall Chibi Silia Trigger (mirrors bottom-right KadanChatbotWidget!) */}
        <button
          type="button"
          data-silia-toggle="true"
          data-silia-status={canCastAny ? 'ready' : 'locked'}
          onClick={handleToggleChatbot}
          title={tr('실리아 클릭 — 3등신 필살기 선택 & 대사 컷신', 'Click Silia — Open Ultimate Skills & Cutscene')}
          className="pointer-events-auto group relative flex flex-col items-center focus:outline-none"
        >
          {/* Ambient wind aura when skill is ready or casting */}
          {(canCastAny || castingSkill) && (
            <div className="pointer-events-none absolute inset-x-1 bottom-4 top-2 rounded-full bg-emerald-400/20 blur-md animate-pulse" />
          )}

          {/* Stacked Transparent 3-Head-Tall Chibi Frames (zero box frame, zero decode flicker!) */}
          <div
            className={`relative flex h-[78px] w-[78px] items-center justify-center transition-transform duration-150 group-hover:scale-108 group-active:scale-95 sm:h-[98px] sm:w-[98px] ${
              castingSkill || canCastAny
                ? 'drop-shadow-[0_0_10px_rgba(52,211,153,0.75)]'
                : 'opacity-85 drop-shadow-[0_4px_8px_rgba(0,0,0,0.85)]'
            }`}
          >
            {activeFrames.map((src, idx) => (
              <img
                key={src}
                src={src}
                decoding="async"
                alt={idx === activeIdx ? tr('3등신 실리아', 'Chibi Silia') : ''}
                aria-hidden={idx !== activeIdx}
                draggable={false}
                className={`absolute inset-0 h-full w-full select-none object-contain ${
                  idx === activeIdx ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}

            {/* Floating Readiness Pin (mirrors Kadan's '?' / '⚡' pin) */}
            <span
              className={`pointer-events-none absolute -right-0.5 top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full border px-1 text-[9.5px] font-black shadow-md sm:h-6 sm:min-w-[24px] sm:text-[10.5px] ${
                canCastAny
                  ? 'border-emerald-200 bg-emerald-600 text-white animate-bounce'
                  : menuOpen
                    ? 'border-teal-200 bg-teal-600 text-white'
                    : 'border-stone-500 bg-stone-900/95 text-stone-300'
              }`}
            >
              {usedThisTurn ? '0/1' : isPlayerTurn ? '1/1✦' : '...'}
            </span>
          </div>

          {/* Sleek Nameplate Pill Below Silia's Boots */}
          <div
            className={`-mt-1.5 flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold shadow-[0_4px_10px_rgba(0,0,0,0.9)] transition sm:px-3 sm:text-[11px] ${
              castingSkill
                ? 'border-emerald-200 bg-gradient-to-r from-emerald-600 to-teal-800 text-white'
                : canCastAny
                  ? 'border-emerald-300 bg-gradient-to-r from-emerald-800 to-teal-950 text-emerald-50'
                  : 'border-stone-600 bg-stone-950/95 text-stone-300'
            }`}
          >
            <span>
              {castingSkill
                ? tr('✦ 영창 중...', '✦ Casting...')
                : canCastAny
                  ? tr('실리아 · 필살기', 'Silia · Ult ▾')
                  : usedThisTurn
                    ? tr('실리아 (완료)', 'Silia (Used)')
                    : tr('실리아 (대기)', 'Silia (Wait)')}
            </span>
          </div>
        </button>
      </div>
    </>
  );
};
