import React, { useCallback, useEffect, useRef, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { useModalDismiss } from '../useModalDismiss';
import {
  CLASS_CREST_URL,
  CRAFTING_COST,
  DISENCHANT_VALUE,
  GOLDEN_DISENCHANT_VALUE,
  formatCardHtmlText,
  getCardBaseDurability,
} from '../cardDb';
import {
  CARD_CLASS_LABELS_EN,
  CARD_RACE_LABELS_EN,
  CARD_RARITY_LABELS_EN,
  getCardCharName,
  getCardFactionLabel,
  getCardFlavor,
  getCardName,
  getCardText,
} from '../i18nData';
import {
  CLASSIC_HEROES,
  CardClass,
  CardRarity,
  ClassicCardDef,
  HeroClass,
} from '../types';
import {
  HearthstoneCard,
  HsAttackBadge,
  HsHealthBadge,
  HsManaGem,
  RACE_KO,
} from './CardVisual';

const RARITY_LABEL_KO: Record<CardRarity, string> = {
  FREE: '기본',
  COMMON: '일반',
  RARE: '희귀',
  EPIC: '특급',
  LEGENDARY: '전설',
};

const TYPE_LABEL_KO: Record<ClassicCardDef['type'], string> = {
  MINION: '하수인',
  SPELL: '주문',
  WEAPON: '무기',
  HERO_POWER: '영웅 능력',
  HERO: '영웅',
};

const TYPE_LABEL_EN: Record<ClassicCardDef['type'], string> = {
  MINION: 'Minion',
  SPELL: 'Spell',
  WEAPON: 'Weapon',
  HERO_POWER: 'Hero Power',
  HERO: 'Hero',
};

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
  journeyMultiplier?: number;
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
  journeyMultiplier = 1,
  subtitleBadge,
  liveStats,
  showFlavor = false,
  primaryAction,
  secondaryActions = [],
  navigation,
  onCancel,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';

  useModalDismiss(true, () => {
    hsAudio.playSfx('ui_click', 0.45);
    onCancel();
  });

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

  const multActive =
    !liveStats &&
    journeyMultiplier > 1 &&
    (card.type === 'MINION' || card.type === 'WEAPON');

  const shownAttack = liveStats
    ? liveStats.attack
    : multActive
      ? card.type === 'WEAPON'
        ? Math.max(1, (card.attack ?? 1) * journeyMultiplier)
        : (card.attack ?? 0) * journeyMultiplier
      : card.attack;

  const baseWeaponDur = getCardBaseDurability(card);
  const shownHealth =
    liveStats !== undefined
      ? liveStats.health
      : multActive
        ? card.type === 'WEAPON'
          ? Math.max(1, baseWeaponDur * journeyMultiplier)
          : Math.max(1, (card.health ?? 1) * journeyMultiplier)
        : card.type === 'WEAPON'
          ? baseWeaponDur
          : card.health;

  const cardDisplayName = getCardName(card, lang);
  const cardDisplayText = getCardText(card, lang);
  const cardDisplayFlavor = getCardFlavor(card, lang);
  const cardCharLabel = getCardCharName(card, lang);
  const cardFactionLabel = getCardFactionLabel(card, lang);

  const getClassLabel = (cardClass: CardClass): string => {
    if (isKo) {
      if (cardClass === 'NEUTRAL') return '중립';
      if (cardClass === 'DREAM') return '신록';
      return CLASSIC_HEROES[cardClass as HeroClass]?.classNameKo || cardClass;
    }
    return CARD_CLASS_LABELS_EN[cardClass] || cardClass;
  };

  const getRarityLabel = (rarity: CardRarity): string =>
    isKo ? RARITY_LABEL_KO[rarity] : CARD_RARITY_LABELS_EN[rarity];

  const getRaceLabel = (race?: string): string => {
    if (!race) return '';
    return isKo ? RACE_KO[race] || race : CARD_RACE_LABELS_EN[race] || race;
  };

  const cleanHtml = formatCardHtmlText(cardDisplayText || '', spellPowerBonus, velenMultiplier).trim();
  const craftDust = card.rarity !== 'FREE' ? CRAFTING_COST[card.rarity] : null;
  const disenchantDust =
    card.rarity !== 'FREE'
      ? isGolden
        ? GOLDEN_DISENCHANT_VALUE[card.rarity]
        : DISENCHANT_VALUE[card.rarity]
      : null;

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
      aria-label={tr(`${cardDisplayName} 카드 확대`, `Inspect ${cardDisplayName}`)}
      onClick={() => {
        if (swipedRecentlyRef.current) return;
        hsAudio.playSfx('ui_click', 0.45);
        onCancel();
      }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/78 px-3 py-3 backdrop-blur-[3px] sm:px-8 sm:py-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishSwipe(e.pointerId)}
        onPointerCancel={(e) => finishSwipe(e.pointerId)}
        className="hs-wood-panel relative flex max-h-[94%] w-full max-w-[356px] touch-pan-y select-none flex-col items-center overflow-y-auto rounded-3xl px-3.5 pb-3.5 pt-2.5 text-amber-100 shadow-[0_26px_70px_rgba(0,0,0,0.95)] sm:max-w-[424px] sm:px-5 sm:pb-4 sm:pt-3.5"
      >
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

        {/* Enlarged Card + Left/Right Prev/Next Buttons */}
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
            className="-my-4 origin-center scale-[0.82] sm:-my-1 sm:scale-[0.96]"
          >
            <HearthstoneCard
              card={card}
              effectiveCost={effectiveCost}
              spellPowerBonus={spellPowerBonus}
              velenMultiplier={velenMultiplier}
              isGolden={isGolden}
              playableGlow={playableGlow}
              rarityAura={rarityAura || card.rarity}
              journeyMultiplier={journeyMultiplier}
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

        <div className="mt-1 w-full rounded-2xl border-2 border-[#a88246] bg-gradient-to-b from-[#fdf6e4] to-[#ecdab5] px-3.5 py-2.5 text-[#221409] shadow-[inset_0_2px_8px_rgba(68,40,14,0.22)]">
          <div className="flex items-center justify-between gap-2 border-b border-[#9a743a]/35 pb-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <img
                src={CLASS_CREST_URL[card.cardClass] || CLASS_CREST_URL.NEUTRAL}
                alt=""
                className="h-5 w-5 shrink-0 rounded-full border border-[#6e4c23] object-cover"
              />
              <h3 className="truncate text-base font-extrabold tracking-tight text-[#1c1007] sm:text-lg">
                {cardDisplayName}
              </h3>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <HsManaGem value={shownCost} state={costState} size={25} active />
              {(card.type === 'MINION' || card.type === 'WEAPON') &&
                shownAttack !== undefined &&
                shownAttack !== null && (
                  <HsAttackBadge
                    value={shownAttack}
                    buffed={
                      liveStats
                        ? liveStats.attack > (card.attack ?? 0)
                        : multActive && (card.attack ?? 0) > 0
                    }
                    isWeapon={card.type === 'WEAPON'}
                    size={25}
                  />
                )}
              {(card.type === 'MINION' || card.type === 'WEAPON') &&
                shownHealth !== undefined &&
                shownHealth !== null && (
                  <HsHealthBadge
                    value={shownHealth}
                    isWeaponDurability={card.type === 'WEAPON'}
                    state={
                      liveStats
                        ? liveStats.health < liveStats.maxHealth
                          ? 'damaged'
                          : liveStats.maxHealth > (card.health ?? 1)
                            ? 'buffed'
                            : 'normal'
                        : multActive
                          ? 'buffed'
                          : 'normal'
                    }
                    size={24}
                  />
                )}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] font-bold text-[#5a3b1c]">
            <span className="rounded bg-[#422813] px-1.5 py-0.5 text-[10.5px] font-extrabold text-amber-100">
              {getClassLabel(card.cardClass)}
            </span>
            {cardCharLabel && (
              <span className="rounded border border-[#8c6432]/60 bg-[#f6e7c5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#4a2b0f]">
                {cardCharLabel}
                {cardFactionLabel && card.cardClass === 'NEUTRAL' ? ` · ${cardFactionLabel}` : ''}
              </span>
            )}
            <span>·</span>
            <span>{isKo ? TYPE_LABEL_KO[card.type] : TYPE_LABEL_EN[card.type]}</span>
            <span>·</span>
            <span>{tr(`${getRarityLabel(card.rarity)} 등급`, getRarityLabel(card.rarity))}</span>
            {card.race && getRaceLabel(card.race) && (
              <>
                <span>·</span>
                <span className="font-extrabold text-[#7c2d12]">{getRaceLabel(card.race)}</span>
              </>
            )}
            {isGolden && (
              <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-extrabold text-stone-950">
                {tr('황금', 'Golden')}
              </span>
            )}
          </div>

          <div
            className={`mt-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-extrabold ${
              card.type === 'WEAPON'
                ? 'border-slate-600 bg-slate-900 text-slate-100'
                : card.type === 'SPELL'
                  ? 'border-sky-700/60 bg-sky-950/90 text-sky-100'
                  : 'border-[#9a743a]/55 bg-[#f3e2bc] text-[#3a220d]'
            }`}
          >
            {card.type === 'WEAPON'
              ? tr(
                  `⚔ 영웅 장착 무기 · 내 영웅이 장착하여 직접 공격 (공격력 ${shownAttack ?? 0} / 내구도 ${shownHealth ?? baseWeaponDur}, 공격 시 내구도 -1)`,
                  `⚔ Hero Weapon · Equips on your hero to attack (Attack ${shownAttack ?? 0} / Durability ${shownHealth ?? baseWeaponDur})`,
                )
              : card.type === 'SPELL'
                ? card.mechanics?.includes('SECRET')
                  ? tr(
                      '✦ 비밀 주문 · 장착 후 상대 턴에 조건이 충족되면 자동 발동합니다.',
                      '✦ Secret Spell · Hidden until triggered during your opponent’s turn.',
                    )
                  : tr(
                      '✦ 주문 카드 · 사용 즉시 마법 효과가 발동하고 소모됩니다.',
                      '✦ Spell · Casts an immediate magical effect when played.',
                    )
                : card.rarity === 'LEGENDARY'
                  ? tr(
                      '★ 전설 하수인 · 덱에 단 1장만 편성 가능한 고유 결전 능력 보유',
                      '★ Legendary Minion · Limit 1 per deck with a unique iconic effect',
                    )
                  : tr(
                      '🛡 전장 하수인 · 전장에 소환되어 적 하수인·영웅과 교전합니다.',
                      '🛡 Battlefield Minion · Summoned to the board to battle enemies.',
                    )}
          </div>

          <div className="mt-1.5 rounded-xl border border-[#b9965b]/55 bg-[#fffbf0] px-3 py-2 text-center text-[14px] font-bold leading-relaxed text-[#1a0f06] sm:text-[15px]">
            {cleanHtml ? (
              <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
            ) : card.type === 'WEAPON' ? (
              <span className="text-xs font-extrabold text-slate-800">
                {tr(
                  `특수 부가 효과 없음 — 영웅에게 공격력 +${shownAttack ?? 0} (내구도 ${shownHealth ?? baseWeaponDur}회)을 부여하는 순수 전투 무기입니다.`,
                  `Pure combat weapon — grants +${shownAttack ?? 0} Attack (${shownHealth ?? baseWeaponDur} Durability) to your hero.`,
                )}
              </span>
            ) : (
              <span className="text-xs font-bold text-[#6e5032]">
                {tr('특수 능력 없음 (기본 공격력·생명력 전투 하수인)', 'No special text (pure combat minion)')}
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-center justify-between rounded-lg border border-[#a88246]/50 bg-[#f5e7c6] px-2.5 py-1 text-[10.5px] font-extrabold text-[#4a2b0f]">
            <span>
              {card.rarity === 'FREE'
                ? tr('기본 무료 지급 카드 (팩 미등장 · 추출 불가)', 'Free Basic Card (Uncraftable / Cannot Disenchant)')
                : tr(
                    `${getRarityLabel(card.rarity)}${isGolden ? ' (황금)' : ''} · ${card.rarity === 'LEGENDARY' ? '덱 1장 제한' : '덱 최대 2장'}`,
                    `${getRarityLabel(card.rarity)}${isGolden ? ' (Golden)' : ''} · ${card.rarity === 'LEGENDARY' ? 'Max 1 in deck' : 'Max 2 in deck'}`,
                  )}
            </span>
            {craftDust !== null && disenchantDust !== null && (
              <span className="text-[#7c2d12]">
                {tr(
                  `제작 ${craftDust.toLocaleString()} / 추출 +${disenchantDust.toLocaleString()} 가루`,
                  `Craft ${craftDust.toLocaleString()} / Dust +${disenchantDust.toLocaleString()}`,
                )}
              </span>
            )}
          </div>

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

          {showFlavor && cardDisplayFlavor && (
            <p className="mt-1.5 text-center text-[11px] font-bold leading-snug text-[#5c3d1e]">
              “{cardDisplayFlavor.replace(/<[^>]+>/g, '')}”
            </p>
          )}
        </div>

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
                'Swipe left/right, use ‹ › or arrow keys · Tap outside to close',
              )
            : tr('바깥 영역을 터치하면 카드 선택이 취소됩니다', 'Tap outside to close')}
        </div>
      </div>
    </div>
  );
};
