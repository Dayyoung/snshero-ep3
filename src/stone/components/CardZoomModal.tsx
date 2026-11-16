import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { CLASS_CREST_URL, formatCardHtmlText } from '../cardDb';
import {
  getCardFlavor,
  getCardName,
  getCardText,
  getClassLabel,
  getRaceLabel,
  getRarityLabel,
  getTypeLabel,
} from '../i18nData';
import { useModalDismiss } from '../useModalDismiss';
import {
  CardClass,
  CardRarity,
  ClassicCardDef,
} from '../types';
import {
  HearthstoneCard,
  HsAttackBadge,
  HsHealthBadge,
  HsManaGem,
} from './CardVisual';

const RARITY_COLOR: Record<CardRarity, string> = {
  FREE: 'text-stone-200',
  COMMON: 'text-white',
  RARE: 'text-sky-300',
  EPIC: 'text-purple-300',
  LEGENDARY: 'text-amber-300',
};

function getClassLabelLocalized(cardClass: CardClass, lang: 'en' | 'ko'): string {
  if (cardClass === 'DREAM') return lang === 'ko' ? '꿈' : 'Dream';
  return getClassLabel(cardClass, lang);
}

export interface CardZoomAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'arcane' | 'emerald' | 'crimson' | 'brass';
}

export interface CardZoomNavigation {
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  positionLabel?: string;
}

export interface CardZoomModalProps {
  card: ClassicCardDef;
  effectiveCost?: number;
  spellPowerBonus?: number;
  velenMultiplier?: number;
  isGolden?: boolean;
  playableGlow?: 'NONE' | 'GREEN' | 'COMBO';
  rarityAura?: CardRarity;
  subtitleBadge?: string;
  liveStats?: {
    attack: number;
    health: number;
    maxHealth: number;
    statuses?: string[];
  };
  showFlavor?: boolean;
  primaryAction?: CardZoomAction;
  secondaryActions?: CardZoomAction[];
  navigation?: CardZoomNavigation;
  onCancel: () => void;
}

export const CardZoomModal: React.FC<CardZoomModalProps> = ({
  card,
  effectiveCost,
  spellPowerBonus = 0,
  velenMultiplier = 1,
  isGolden = false,
  playableGlow = 'NONE',
  rarityAura,
  subtitleBadge,
  liveStats,
  showFlavor = false,
  primaryAction,
  secondaryActions = [],
  navigation,
  onCancel,
}) => {
  const { lang, tr } = useHeroLanguage();
  useModalDismiss(true, onCancel);

  const hasNav = Boolean(navigation && navigation.totalCount > 1);
  const canPrev = hasNav && (navigation!.canPrev ?? true);
  const canNext = hasNav && (navigation!.canNext ?? true);

  const [swipeOffsetX, setSwipeOffsetX] = useState(0);
  const [slideEnterX, setSlideEnterX] = useState(0);
  const swipeStateRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    dx: number;
    locked: 'H' | 'V' | null;
  }>({ pointerId: null, startX: 0, startY: 0, dx: 0, locked: null });
  const swipedRecentlyRef = useRef(false);

  const triggerPrev = useCallback(() => {
    if (!navigation || navigation.totalCount <= 1 || !(navigation.canPrev ?? true)) return;
    hsAudio.playSfx('card_flip', 0.65);
    setSwipeOffsetX(0);
    setSlideEnterX(-26);
    navigation.onPrev();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSlideEnterX(0));
    });
  }, [navigation]);

  const triggerNext = useCallback(() => {
    if (!navigation || navigation.totalCount <= 1 || !(navigation.canNext ?? true)) return;
    hsAudio.playSfx('card_flip', 0.65);
    setSwipeOffsetX(0);
    setSlideEnterX(26);
    navigation.onNext();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSlideEnterX(0));
    });
  }, [navigation]);

  useEffect(() => {
    if (!hasNav) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        e.stopPropagation();
        triggerPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        e.stopPropagation();
        triggerNext();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [hasNav, triggerPrev, triggerNext]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasNav) return;
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    swipeStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      locked: null,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const st = swipeStateRef.current;
    if (!hasNav || st.pointerId !== e.pointerId) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.locked) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        st.locked = 'H';
      } else if (Math.abs(dy) > 14) {
        st.locked = 'V';
      }
    }
    if (st.locked === 'H') {
      st.dx = dx;
      setSwipeOffsetX(Math.max(-88, Math.min(88, dx * 0.55)));
    }
  };

  const finishSwipe = (pointerId: number) => {
    const st = swipeStateRef.current;
    if (st.pointerId !== pointerId) return;
    const finalDx = st.dx;
    const wasHorizontal = st.locked === 'H';
    swipeStateRef.current = { pointerId: null, startX: 0, startY: 0, dx: 0, locked: null };
    setSwipeOffsetX(0);

    if (wasHorizontal && Math.abs(finalDx) >= 14) {
      swipedRecentlyRef.current = true;
      window.setTimeout(() => {
        swipedRecentlyRef.current = false;
      }, 150);
    }

    if (wasHorizontal && finalDx <= -38) {
      triggerNext();
    } else if (wasHorizontal && finalDx >= 38) {
      triggerPrev();
    }
  };

  const shownCost = effectiveCost !== undefined ? effectiveCost : card.cost;
  const costState: 'normal' | 'buffed' | 'nerfed' =
    shownCost < card.cost ? 'buffed' : shownCost > card.cost ? 'nerfed' : 'normal';

  const shownAttack = liveStats ? liveStats.attack : card.attack;
  const shownHealth =
    liveStats !== undefined
      ? liveStats.health
      : card.type === 'WEAPON'
        ? card.durability
        : card.health;

  const cardName = getCardName(card, lang);
  const cardText = getCardText(card, lang);
  const cardFlavor = getCardFlavor(card, lang);
  const cleanHtml = formatCardHtmlText(cardText || '', spellPowerBonus, velenMultiplier).trim();

  const renderBtnClass = (variant: CardZoomAction['variant'] = 'arcane', disabled?: boolean) => {
    if (disabled) {
      return 'cursor-not-allowed border-2 border-stone-600 bg-stone-900/95 text-stone-400 opacity-85';
    }
    if (variant === 'emerald') {
      return 'border-2 border-emerald-200 bg-gradient-to-b from-emerald-500 via-emerald-700 to-emerald-950 text-white shadow-[0_8px_22px_rgba(16,185,129,0.55)] hover:brightness-110 active:scale-[0.98]';
    }
    if (variant === 'crimson') {
      return 'border-2 border-red-300 bg-gradient-to-b from-red-600 via-red-800 to-red-950 text-white shadow-[0_8px_20px_rgba(220,38,38,0.5)] hover:brightness-110 active:scale-[0.98]';
    }
    if (variant === 'brass') {
      return 'hs-brass-btn text-amber-100';
    }
    return 'hs-arcane-btn text-white';
  };

  const activeShiftX = swipeOffsetX !== 0 ? swipeOffsetX : slideEnterX;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tr(`${cardName} 카드 확대`, `Inspect ${cardName}`)}
      onClick={() => {
        if (swipedRecentlyRef.current) return;
        hsAudio.playSfx('ui_click', 0.45);
        onCancel();
      }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/78 px-3 py-3 backdrop-blur-[3px] sm:px-8 sm:py-6"
    >
      {/* Inner Card Inspection & Action Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishSwipe(e.pointerId)}
        onPointerCancel={(e) => finishSwipe(e.pointerId)}
        className="hs-wood-panel relative flex max-h-[94dvh] w-full max-w-[356px] touch-pan-y select-none flex-col items-center overflow-y-auto rounded-3xl px-3.5 pb-3.5 pt-2.5 text-amber-100 shadow-[0_26px_70px_rgba(0,0,0,0.95)] sm:max-w-[424px] sm:px-5 sm:pb-4 sm:pt-3.5"
      >
        {/* Top Close Pill */}
        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('ui_click', 0.45);
            onCancel();
          }}
          aria-label={tr('카드 선택 취소', 'Close inspection')}
          className="hs-brass-btn absolute right-2.5 top-2.5 z-40 flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold text-amber-100"
        >
          ✕
        </button>

        {/* Subtitle + Navigation Counter Row */}
        <div className="mb-1 flex max-w-[84%] flex-wrap items-center justify-center gap-1.5">
          {subtitleBadge && (
            <div className="truncate rounded-full border border-amber-300/60 bg-stone-950/90 px-3 py-0.5 text-[11px] font-extrabold text-amber-200 shadow">
              {subtitleBadge}
            </div>
          )}
          {hasNav && navigation && (
            <div
              data-testid="card-zoom-counter"
              className="rounded-full border border-sky-300/65 bg-sky-950/90 px-2.5 py-0.5 text-[10.5px] font-extrabold text-sky-200 shadow"
            >
              {navigation.positionLabel ||
                `${navigation.currentIndex + 1} / ${navigation.totalCount}`}
            </div>
          )}
        </div>

        {/* Enlarged 512x Official Localized Sculpted Card + Left/Right Prev/Next Buttons */}
        <div className="relative flex w-full items-center justify-center">
          {hasNav && (
            <button
              type="button"
              data-testid="card-zoom-prev"
              disabled={!canPrev}
              aria-label={tr('이전 카드 보기', 'Previous card')}
              onClick={(e) => {
                e.stopPropagation();
                triggerPrev();
              }}
              className={`hs-brass-btn absolute left-0 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl font-black text-amber-100 shadow-[0_6px_18px_rgba(0,0,0,0.88)] transition sm:h-12 sm:w-12 sm:text-3xl ${
                canPrev
                  ? 'hover:scale-108 hover:brightness-115 active:scale-95'
                  : 'cursor-not-allowed opacity-35'
              }`}
            >
              ‹
            </button>
          )}

          <div
            style={{
              transform: `translate3d(${activeShiftX}px, 0, 0) rotate(${swipeOffsetX * 0.035}deg)`,
              transition:
                swipeOffsetX !== 0 ? 'none' : 'transform 170ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
            className="-my-6 origin-center scale-[0.78] sm:-my-2 sm:scale-[0.94]"
          >
            <HearthstoneCard
              card={card}
              effectiveCost={effectiveCost}
              spellPowerBonus={spellPowerBonus}
              velenMultiplier={velenMultiplier}
              isGolden={isGolden}
              playableGlow={playableGlow}
              rarityAura={rarityAura || card.rarity}
              size="LG"
              enableTilt={swipeOffsetX === 0}
            />
          </div>

          {hasNav && (
            <button
              type="button"
              data-testid="card-zoom-next"
              disabled={!canNext}
              aria-label={tr('다음 카드 보기', 'Next card')}
              onClick={(e) => {
                e.stopPropagation();
                triggerNext();
              }}
              className={`hs-brass-btn absolute right-0 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-2xl font-black text-amber-100 shadow-[0_6px_18px_rgba(0,0,0,0.88)] transition sm:h-12 sm:w-12 sm:text-3xl ${
                canNext
                  ? 'hover:scale-108 hover:brightness-115 active:scale-95'
                  : 'cursor-not-allowed opacity-35'
              }`}
            >
              ›
            </button>
          )}
        </div>

        {/* Crisp High-Contrast Card Text Readout Plaque */}
        <div className="mt-1 w-full rounded-2xl border-2 border-[#a88246] bg-gradient-to-b from-[#fdf6e4] to-[#ecdab5] px-3.5 py-2.5 text-[#221409] shadow-[inset_0_2px_8px_rgba(68,40,14,0.22)]">
          <div className="flex items-center justify-between gap-2 border-b border-[#9a743a]/35 pb-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <img
                src={CLASS_CREST_URL[card.cardClass] || CLASS_CREST_URL.NEUTRAL}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full border border-[#6e4c23] object-cover"
              />
              <h3 className="truncate text-base font-extrabold tracking-tight text-[#1c1007] sm:text-lg">
                {cardName}
              </h3>
            </div>

            {/* Crisp Stat Summary Badges */}
            <div className="flex shrink-0 items-center gap-1">
              <HsManaGem value={shownCost} state={costState} size={25} active />
              {(card.type === 'MINION' || card.type === 'WEAPON') && shownAttack !== undefined && (
                <HsAttackBadge
                  value={shownAttack}
                  buffed={liveStats ? liveStats.attack > (card.attack ?? 0) : false}
                  isWeapon={card.type === 'WEAPON'}
                  size={25}
                />
              )}
              {(card.type === 'MINION' || card.type === 'WEAPON') && shownHealth !== undefined && (
                <HsHealthBadge
                  value={shownHealth}
                  state={
                    liveStats
                      ? liveStats.health < liveStats.maxHealth
                        ? 'damaged'
                        : liveStats.maxHealth > (card.health ?? 1)
                          ? 'buffed'
                          : 'normal'
                      : 'normal'
                  }
                  size={24}
                />
              )}
            </div>
          </div>

          {/* Card Classification Tags */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-bold text-[#5a3b1c]">
            <span className="rounded bg-[#422813] px-1.5 py-0.5 text-[10.5px] font-extrabold text-amber-100">
              {getClassLabelLocalized(card.cardClass, lang)}
            </span>
            <span>·</span>
            <span>{getTypeLabel(card.type, lang)}</span>
            <span>·</span>
            <span>
              {tr(`${getRarityLabel(card.rarity, lang)} 등급`, `${getRarityLabel(card.rarity, lang)}`)}
            </span>
            {card.race && getRaceLabel(card.race, lang) && (
              <>
                <span>·</span>
                <span className="font-extrabold text-[#7c2d12]">{getRaceLabel(card.race, lang)}</span>
              </>
            )}
            {isGolden && (
              <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-stone-950">
                {tr('황금', 'Golden')}
              </span>
            )}
          </div>

          {/* Large Readable Card Ability Text */}
          <div className="mt-2 rounded-xl border border-[#b9965b]/55 bg-[#fffbf0] px-3 py-2 text-center text-[14px] font-bold leading-relaxed text-[#1a0f06] sm:text-[15px]">
            {cleanHtml ? (
              <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
            ) : (
              <span className="text-xs font-bold text-[#6e5032]">
                {tr(
                  '특수 능력 없음 (기본 공격력·생명력 전투 하수인)',
                  'No special card text (vanilla stats minion)',
                )}
              </span>
            )}
          </div>

          {/* Live Battlefield Status Pills (if inspecting a board minion) */}
          {liveStats?.statuses && liveStats.statuses.length > 0 && (
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              {liveStats.statuses.map((st, idx) => (
                <span
                  key={idx}
                  className="rounded-full border border-[#8b6532] bg-[#36200f] px-2 py-0.5 text-[10.5px] font-extrabold text-amber-200"
                >
                  {st}
                </span>
              ))}
            </div>
          )}

          {/* Optional Collection Flavor Text */}
          {showFlavor && cardFlavor && (
            <p className="mt-1.5 text-center text-[11px] font-bold leading-snug text-[#5c3d1e]">
              “{cardFlavor.replace(/<[^>]+>/g, '')}”
            </p>
          )}
        </div>

        {/* Bottom Primary Use / Confirm Action Button */}
        {primaryAction && (
          <button
            type="button"
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
            className={`mt-2.5 flex min-h-[48px] w-full items-center justify-center rounded-2xl px-4 py-2.5 text-base font-extrabold tracking-wide transition ${renderBtnClass(
              primaryAction.variant,
              primaryAction.disabled,
            )}`}
          >
            {primaryAction.label}
          </button>
        )}

        {/* Secondary Action Row (Crafting, Deck Remove, Positional Drop, etc.) */}
        {secondaryActions.length > 0 && (
          <div className="mt-2 flex w-full flex-wrap gap-1.5">
            {secondaryActions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                disabled={act.disabled}
                onClick={act.onClick}
                className={`flex min-h-[42px] flex-1 items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition ${renderBtnClass(
                  act.variant || 'brass',
                  act.disabled,
                )}`}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 text-center text-[11px] font-bold text-amber-200/80">
          {hasNav
            ? tr(
                '좌우 스와이프 · ‹ › 버튼 · 방향키로 옆 카드 이동 · 바깥 터치 시 닫기',
                'Swipe · ‹ › buttons · Arrow keys to browse · Tap outside to close',
              )
            : tr(
                '바깥 영역을 터치하면 카드 선택이 취소됩니다',
                'Tap outside to cancel selection',
              )}
        </div>
      </div>
    </div>
  );
};
