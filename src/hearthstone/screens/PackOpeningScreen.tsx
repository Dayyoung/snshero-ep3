import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { HearthstoneCard, HsGoldCoinIcon } from '../components/CardVisual';
import { CardZoomModal } from '../components/CardZoomModal';
import { useModalDismiss } from '../useModalDismiss';
import {
  SNS_LOCATIONS,
  SnsBoosterPackArt,
  SnsCardBackArt,
} from '../components/SnsHeroArtKit';
import { OpenedPackCard, PACK_DROP_RATES_SPEC, hsStorage } from '../storage';
import { CardRarity } from '../types';

const HOVER_RARITY_GLOW: Record<CardRarity, string> = {
  FREE: '0 0 20px 4px rgba(248, 250, 252, 0.55)',
  COMMON: '0 0 24px 5px rgba(226, 232, 240, 0.72)',
  RARE: '0 0 32px 10px rgba(59, 130, 246, 0.95), 0 0 60px 18px rgba(37, 99, 235, 0.65)',
  EPIC: '0 0 36px 12px rgba(168, 85, 247, 0.98), 0 0 68px 22px rgba(147, 51, 234, 0.72)',
  LEGENDARY:
    '0 0 42px 15px rgba(251, 191, 36, 1), 0 0 82px 28px rgba(249, 115, 22, 0.88)',
};

const FLIP_RING_COLOR: Record<CardRarity, string> = {
  FREE: 'border-slate-200 bg-slate-200/25 shadow-[0_0_30px_rgba(255,255,255,0.8)]',
  COMMON: 'border-slate-100 bg-white/25 shadow-[0_0_34px_rgba(255,255,255,0.85)]',
  RARE: 'border-sky-300 bg-sky-400/30 shadow-[0_0_45px_rgba(56,189,248,0.98)]',
  EPIC: 'border-purple-300 bg-purple-500/35 shadow-[0_0_52px_rgba(192,132,252,1)]',
  LEGENDARY: 'border-yellow-200 bg-amber-400/45 shadow-[0_0_65px_rgba(251,191,36,1)]',
};

const RARITY_PRIORITY: Record<CardRarity, number> = {
  FREE: 0,
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
};

/**
 * 5-Card Radial Pentagon Spread
 * Coordinates relative to the center of the Sky Altar (desktop >= 768px).
 */
const PENTAGON_SLOTS: {
  dx: number;
  dy: number;
  tilt: string;
  floatDur: string;
  floatDelay: string;
}[] = [
  { dx: -248, dy: -94, tilt: '-4deg', floatDur: '3.35s', floatDelay: '-0.2s' },
  { dx: 0, dy: -124, tilt: '0deg', floatDur: '3.75s', floatDelay: '-1.15s' },
  { dx: 248, dy: -94, tilt: '4deg', floatDur: '3.45s', floatDelay: '-2.1s' },
  { dx: -146, dy: 124, tilt: '-2.4deg', floatDur: '3.85s', floatDelay: '-0.75s' },
  { dx: 146, dy: 124, tilt: '2.4deg', floatDur: '3.55s', floatDelay: '-2.65s' },
];

/**
 * Mobile Portrait (< 768px) 5-Card Floating Constellation (2-1-2 Vertical Diamond)
 * Fits 100% inside 360px~430px portrait screens with zero clipping!
 */
const MOBILE_PENTAGON_SLOTS: {
  dx: number;
  dy: number;
  tilt: string;
  floatDur: string;
  floatDelay: string;
}[] = [
  { dx: -82, dy: -142, tilt: '-3.2deg', floatDur: '3.35s', floatDelay: '-0.2s' },
  { dx: 82, dy: -142, tilt: '3.2deg', floatDur: '3.75s', floatDelay: '-1.15s' },
  { dx: 0, dy: -2, tilt: '0deg', floatDur: '3.45s', floatDelay: '-2.1s' },
  { dx: -82, dy: 138, tilt: '-2.2deg', floatDur: '3.85s', floatDelay: '-0.75s' },
  { dx: 82, dy: 138, tilt: '2.2deg', floatDur: '3.55s', floatDelay: '-2.65s' },
];

export const PackOpeningScreen: React.FC<{
  onBack: () => void;
  onOpenShop: () => void;
  onProfileChanged: () => void;
  onReturnToJourney?: () => void;
}> = ({ onBack, onOpenShop, onProfileChanged, onReturnToJourney }) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const [profile, setProfile] = useState(() => hsStorage.getProfile());
  const [pityState, setPityState] = useState(() => hsStorage.getPackPityState());
  const [showOddsModal, setShowOddsModal] = useState(false);
  useModalDismiss(showOddsModal, () => setShowOddsModal(false));
  const [innkeeperCallout, setInnkeeperCallout] = useState<{
    text: string;
    borderCls: string;
  } | null>(null);
  const [packBursting, setPackBursting] = useState(false);
  const [burstFlash, setBurstFlash] = useState(false);
  const [openedCards, setOpenedCards] = useState<OpenedPackCard[] | null>(null);
  const [cardsDealt, setCardsDealt] = useState(false);
  const [cardsSweepingOut, setCardsSweepingOut] = useState(false);

  const [revealed, setRevealed] = useState<boolean[]>([false, false, false, false, false]);
  const [flippingActive, setFlippingActive] = useState<boolean[]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoverTilt, setHoverTilt] = useState<{ idx: number; rx: number; ry: number } | null>(null);
  const [draggingPack, setDraggingPack] = useState(false);
  const [altarShake, setAltarShake] = useState(false);
  const [zoomedPackCard, setZoomedPackCard] = useState<OpenedPackCard | null>(null);
  const [isDesktopStage, setIsDesktopStage] = useState(
    () =>
      typeof window === 'undefined' ||
      window.innerWidth >= 768 ||
      window.innerWidth > window.innerHeight,
  );

  useEffect(() => {
    const onResize = () =>
      setIsDesktopStage(
        window.innerWidth >= 768 || window.innerWidth > window.innerHeight,
      );
    const onState = () => {
      setProfile(hsStorage.getProfile());
      setPityState(hsStorage.getPackPityState());
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('snshero:state-changed', onState);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('snshero:state-changed', onState);
    };
  }, []);

  // Refs to prevent any stale-closure bugs during rapid/staggered `revealAll` flips!
  const openedCardsRef = useRef<OpenedPackCard[] | null>(null);
  const revealedRef = useRef<boolean[]>([false, false, false, false, false]);
  const timersRef = useRef<number[]>([]);

  const scheduleTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const motes = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: `${10 + ((i * 41) % 80)}%`,
        size: 3 + (i % 3) * 1.5,
        delay: `${(i * 0.37).toFixed(2)}s`,
        duration: `${(4.5 + (i % 4) * 0.9).toFixed(2)}s`,
        dx: `${(i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 8)}px`,
      })),
    [],
  );

  const sync = useCallback(() => {
    setProfile(hsStorage.getProfile());
    setPityState(hsStorage.getPackPityState());
    onProfileChanged();
  }, [onProfileChanged]);

  const triggerOpenPack = useCallback(() => {
    if (packBursting || openedCardsRef.current) return;
    const currentProfile = hsStorage.getProfile();
    if (currentProfile.packs <= 0) {
      onOpenShop();
      return;
    }

    clearAllTimers();
    hsAudio.playSfx('pack_open');
    setPackBursting(true);

    scheduleTimer(() => {
      const res = hsStorage.openOnePack();
      setPackBursting(false);
      if (res) {
        const initialRev = [false, false, false, false, false];
        openedCardsRef.current = res;
        revealedRef.current = initialRev;
        setOpenedCards(res);
        setRevealed(initialRev);
        setFlippingActive([false, false, false, false, false]);
        setCardsSweepingOut(false);
        setCardsDealt(false);
        setBurstFlash(true);
        sync();

        // Trigger radial fly-out from center of exploded pack on next animation frame!
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setCardsDealt(true);
          });
        });

        scheduleTimer(() => setBurstFlash(false), 520);
      }
    }, 520);
  }, [packBursting, clearAllTimers, scheduleTimer, sync, onOpenShop]);

  const revealCardAt = useCallback(
    (idx: number, opts?: { suppressVo?: boolean }) => {
      const cards = openedCardsRef.current;
      if (!cards || !cards[idx] || revealedRef.current[idx]) return;

      const item = cards[idx];
      // Synchronously update ref first so staggered timeouts NEVER overwrite each other!
      const nextRev = [...revealedRef.current];
      nextRev[idx] = true;
      revealedRef.current = nextRev;
      setRevealed(nextRev);

      setFlippingActive((prev) => prev.map((v, i) => (i === idx ? true : v)));
      scheduleTimer(() => {
        setFlippingActive((prev) => prev.map((v, i) => (i === idx ? false : v)));
      }, 680);

      hsAudio.playSfx('card_flip', 0.92);
      const showCallout = (text: string, borderCls: string) => {
        setInnkeeperCallout({ text, borderCls });
        scheduleTimer(() => {
          setInnkeeperCallout((prev) => (prev?.text === text ? null : prev));
        }, 2500);
      };

      if (item.card.rarity === 'LEGENDARY') {
        hsAudio.playSfx('pack_legendary');
        setAltarShake(true);
        scheduleTimer(() => setAltarShake(false), 450);
        if (!opts?.suppressVo) {
          hsAudio.playInnkeeper(item.isGolden ? 'golden_legendary' : 'legendary');
          showCallout(
            item.isGolden
              ? tr('“오~ 황금 전설 카드!”', '“Whoa! Golden Legendary!”')
              : tr('“오~ 전설 카드!”', '“Whoa! Legendary!”'),
            item.isGolden
              ? 'border-yellow-300 bg-gradient-to-r from-amber-950/95 via-orange-900/95 to-amber-950/95 text-yellow-200 shadow-[0_0_28px_rgba(251,191,36,0.95)]'
              : 'border-orange-400 bg-orange-950/95 text-amber-200 shadow-[0_0_24px_rgba(249,115,22,0.9)]',
          );
        }
      } else if (item.card.rarity === 'EPIC') {
        hsAudio.playSfx('pack_epic');
        setAltarShake(true);
        scheduleTimer(() => setAltarShake(false), 320);
        if (!opts?.suppressVo) {
          hsAudio.playInnkeeper(item.isGolden ? 'golden_epic' : 'epic');
          showCallout(
            item.isGolden
              ? tr('“황금 특급 카드!”', '“Golden Epic!”')
              : tr('“특급 카드!”', '“Epic!”'),
            item.isGolden
              ? 'border-yellow-300 bg-purple-950/95 text-purple-100 shadow-[0_0_24px_rgba(192,132,252,0.95)]'
              : 'border-purple-400 bg-purple-950/95 text-purple-200 shadow-[0_0_22px_rgba(168,85,247,0.88)]',
          );
        }
      } else if (item.card.rarity === 'RARE') {
        hsAudio.playSfx('pack_rare');
        if (!opts?.suppressVo) {
          hsAudio.playInnkeeper(item.isGolden ? 'golden_rare' : 'rare');
          showCallout(
            item.isGolden
              ? tr('“황금 희귀 카드!”', '“Golden Rare!”')
              : tr('“희귀 카드!”', '“Rare!”'),
            item.isGolden
              ? 'border-yellow-300 bg-sky-950/95 text-sky-100 shadow-[0_0_22px_rgba(56,189,248,0.92)]'
              : 'border-sky-400 bg-sky-950/95 text-sky-200 shadow-[0_0_20px_rgba(59,130,246,0.85)]',
          );
        }
      } else if (item.isGolden) {
        hsAudio.playSfx('pack_rare', 0.78);
        if (!opts?.suppressVo) {
          hsAudio.playInnkeeper('golden_common');
          showCallout(
            tr('“황금 일반 카드!”', '“Golden Common!”'),
            'border-yellow-300 bg-stone-900/95 text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,0.8)]',
          );
        }
      }
    },
    [scheduleTimer],
  );

  const revealAll = useCallback(() => {
    const cards = openedCardsRef.current;
    if (!cards) return;

    const unrevealedIndices: number[] = [];
    for (let i = 0; i < cards.length; i++) {
      if (!revealedRef.current[i]) {
        unrevealedIndices.push(i);
      }
    }
    if (unrevealedIndices.length === 0) return;

    // Pick the single highest-rarity (with Golden tie-breaker) unrevealed card to announce cleanly
    let bestVoIdx = -1;
    let bestScore = 2; // Normal COMMON = 2 (no callout), Golden COMMON = 3, RARE = 4, Golden RARE = 5, EPIC = 6, Golden EPIC = 7, LEGENDARY = 8, Golden LEGENDARY = 9
    for (const idx of unrevealedIndices) {
      const score =
        RARITY_PRIORITY[cards[idx].card.rarity] * 2 + (cards[idx].isGolden ? 1 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestVoIdx = idx;
      }
    }

    unrevealedIndices.forEach((cardIdx, stepOrder) => {
      scheduleTimer(() => {
        revealCardAt(cardIdx, { suppressVo: cardIdx !== bestVoIdx });
      }, stepOrder * 165);
    });
  }, [revealCardAt, scheduleTimer]);

  const finishPackSession = useCallback(() => {
    if (!openedCardsRef.current || cardsSweepingOut) return;
    setZoomedPackCard(null);
    hsAudio.playSfx('menu_select');
    setCardsSweepingOut(true);
    scheduleTimer(() => {
      openedCardsRef.current = null;
      revealedRef.current = [false, false, false, false, false];
      setOpenedCards(null);
      setCardsDealt(false);
      setCardsSweepingOut(false);
    }, 280);
  }, [cardsSweepingOut, scheduleTimer]);

  // Spacebar Shortcut:
  // 1) Unopened -> Open pack | 2) Cards out & unrevealed -> Flip all remaining | 3) All revealed -> Done!
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      if (zoomedPackCard) {
        setZoomedPackCard(null);
        return;
      }
      if (!openedCardsRef.current && profile.packs > 0) {
        triggerOpenPack();
      } else if (openedCardsRef.current && !revealedRef.current.every(Boolean)) {
        revealAll();
      } else if (openedCardsRef.current && revealedRef.current.every(Boolean)) {
        finishPackSession();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profile.packs, triggerOpenPack, revealAll, finishPackSession, zoomedPackCard]);

  const allRevealed = Boolean(openedCards && revealed.every(Boolean));

  return (
    <div
      style={{ backgroundImage: `url(${SNS_LOCATIONS.PACK_ALTAR})` }}
      className="relative flex h-full w-full select-none flex-col justify-between overflow-hidden bg-cover bg-center p-2.5 text-amber-100 sm:p-4"
    >
      <div className="pointer-events-none absolute inset-0 bg-radial from-sky-500/14 via-black/52 to-black/90" />

      {/* Top Brass Header */}
      <header className="relative z-30 mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('box_close');
            onBack();
          }}
          className="hs-brass-btn min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100 sm:px-4 sm:py-2 sm:text-sm"
        >
          ← {isKo ? <><span className="hidden sm:inline">엘윈마을 </span>로비로</> : <><span className="hidden sm:inline">Elwin </span>Hub</>}
        </button>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onReturnToJourney && (
            <button
              type="button"
              onClick={() => {
                hsAudio.playSfx('box_press');
                onReturnToJourney();
              }}
              className="hs-brass-btn min-h-[40px] rounded-xl border-emerald-300/75 bg-gradient-to-b from-emerald-600 to-emerald-900 px-2.5 py-1.5 text-[11px] font-extrabold text-white sm:px-3.5 sm:text-xs"
            >
              ⚔ {tr('스토리모드 출진', 'Enter Story Mode')}
            </button>
          )}
          <button
            type="button"
            data-testid="pack-odds-guide-btn"
            onClick={() => {
              hsAudio.playSfx('ui_click');
              setShowOddsModal(true);
            }}
            className="hs-brass-btn flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold text-amber-200 sm:px-3 sm:text-xs"
          >
            <span>{tr('확률 · 등급 안내', 'Drop Rates & Dust')}</span>
          </button>
          <div className="flex min-h-[40px] items-center gap-1.5 rounded-xl border-2 border-[#c8a158] bg-stone-950/90 px-2.5 py-1 text-xs font-extrabold shadow-lg sm:gap-2 sm:px-3.5 sm:py-1.5">
            <HsGoldCoinIcon size={18} />
            <span className="hidden sm:inline">{tr('보유 골드', 'Gold')}</span>
            <span className="hs-num text-xs text-yellow-300 sm:text-sm">{profile.gold}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('ui_click');
              onOpenShop();
            }}
            className="hs-arcane-btn flex min-h-[40px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold text-white sm:gap-1.5 sm:px-3.5 sm:text-xs"
          >
            <HsGoldCoinIcon size={15} />
            <span>{tr('보급소 · 팩 구매 (골드 / $1·$4)', 'Shop · Buy Packs (Gold / $1·$4)')}</span>
          </button>
        </div>
      </header>

      {/* Mobile Portrait Compact Unopened Pack Strip (`< md`) */}
      <div className="relative z-20 mx-auto mt-1.5 flex w-full max-w-6xl shrink-0 items-center justify-between rounded-2xl border-2 border-[#c8a158]/70 bg-stone-950/85 px-3 py-1.5 shadow-lg md:hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-6 shrink-0">
            <SnsBoosterPackArt />
          </div>
          <span className="text-xs font-extrabold text-amber-100">
            {tr('미개봉 눈히어로 팩', 'Unopened Packs')}
          </span>
          <span className="hs-num rounded-full border border-[#e0bc72] bg-black/70 px-2.5 py-0.5 text-xs text-yellow-300">
            {isKo ? `${profile.packs}개` : profile.packs}
          </span>
        </div>
        {!openedCards && profile.packs > 0 && (
          <button
            type="button"
            onClick={triggerOpenPack}
            className="hs-brass-btn rounded-lg px-2.5 py-1 text-[11px] font-extrabold text-sky-200"
          >
            {tr('즉시 개봉', 'Open Now')}
          </button>
        )}
        {openedCards && (
          <span className="text-[11px] font-bold text-sky-300">
            {tr('뒤집힌 카드 터치 시 확대', 'Tap revealed cards to zoom')}
          </span>
        )}
      </div>

      {/* Main Split: Left Pack Stack (Desktop) + Glowing Sky Altar */}
      <main className="relative z-20 mx-auto my-1.5 flex min-h-0 w-full max-w-6xl flex-1 items-stretch gap-5 md:my-auto md:grid md:flex-none md:grid-cols-12 md:items-center">
        {/* Left: Unopened Pack Stack Tray (Desktop >= md) */}
        <aside className="hs-wood-panel hidden flex-col items-center justify-center rounded-3xl p-4 sm:p-5 md:col-span-3 md:flex">
          <div className="hs-title mb-2 text-sm font-extrabold text-amber-100">
            {tr('미개봉 눈히어로 팩', 'Unopened Packs')}
          </div>
          <div className="hs-num mb-3 rounded-full border-2 border-[#e0bc72] bg-stone-950/85 px-4 py-1 text-xl text-yellow-300 shadow-inner">
            {isKo ? `${profile.packs}개` : profile.packs}
          </div>

          {profile.packs > 0 ? (
            <div
              draggable={!openedCards}
              onDragStart={() => setDraggingPack(true)}
              onDragEnd={() => setDraggingPack(false)}
              onClick={triggerOpenPack}
              className={`relative cursor-grab transition duration-200 hover:scale-106 active:cursor-grabbing ${
                openedCards ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              {/* Stacked Pack Depth Illusion */}
              {profile.packs > 2 && (
                <div className="pointer-events-none absolute -left-2 top-2 h-44 w-32 -rotate-3 opacity-65 brightness-75">
                  <SnsBoosterPackArt />
                </div>
              )}
              {profile.packs > 1 && (
                <div className="pointer-events-none absolute left-1.5 top-1 h-44 w-32 rotate-2 opacity-80 brightness-90">
                  <SnsBoosterPackArt />
                </div>
              )}
              <div className="relative z-10 h-44 w-32">
                <SnsBoosterPackArt glowing />
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-xs font-semibold text-amber-200/70">
              {tr('보유한 눈히어로 팩이 없습니다.', 'No unopened packs remaining.')}
              <br />
              {tr('상단 버튼으로 100골드에 구매하세요.', 'Buy packs for 100 Gold in the Shop.')}
            </div>
          )}

          <p className="mt-3 text-center text-[11px] font-semibold text-amber-200/80">
            {isKo ? (
              <>
                팩을 천공 제단으로 드래그하거나
                <br />
                <b className="text-amber-100">클릭 / 스페이스바</b>로 개봉
              </>
            ) : (
              <>
                Drag a pack onto the Sky Altar or
                <br />
                press <b className="text-amber-100">Click / Spacebar</b> to open
              </>
            )}
          </p>

          <div className="mt-3 w-full rounded-xl border border-amber-400/35 bg-black/55 px-2.5 py-2 text-center text-[10.5px] font-bold text-amber-200/90">
            <div>
              {!pityState.firstTenLegendaryClaimed
                ? tr(
                    `첫 전설 확정 천장: ${pityState.packsSinceLegendary} / 10팩`,
                    `First Legendary Pity: ${pityState.packsSinceLegendary} / 10`,
                  )
                : tr(
                    `전설 천장: ${pityState.packsSinceLegendary} / 40팩`,
                    `Legendary Pity: ${pityState.packsSinceLegendary} / 40`,
                  )}
            </div>
            <div className="mt-0.5 text-purple-300">
              {tr(
                `특급 천장: ${pityState.packsSinceEpic} / 10팩 · 중복 방지 ON`,
                `Epic Pity: ${pityState.packsSinceEpic} / 10 · Duplicate Protection ON`,
              )}
            </div>
          </div>
        </aside>

        {/* Right: Glowing Sky Altar + 5-Card Floating 3D Flip Stage */}
        <section
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingPack(false);
            triggerOpenPack();
          }}
          className={`relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[28px] border-[3px] border-[#cfa85d]/75 bg-radial from-sky-500/22 via-stone-950/72 to-stone-950/94 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.92)] transition-transform sm:rounded-[36px] sm:border-[4px] sm:p-4 md:col-span-9 md:min-h-[540px] ${
            altarShake ? 'animate-[hsShakeHeavy_0.36s_ease-in-out]' : ''
          }`}
        >
          {/* Floating Magical Starlight Motes Rising from Altar */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {motes.map((m) => (
              <span
                key={m.id}
                style={
                  {
                    left: m.left,
                    bottom: '-10px',
                    width: `${m.size}px`,
                    height: `${m.size}px`,
                    animation: `hsEmberRise ${m.duration} ease-in ${m.delay} infinite`,
                    '--ember-dx': m.dx,
                  } as React.CSSProperties
                }
                className="absolute rounded-full bg-sky-300/85 shadow-[0_0_10px_2px_rgba(56,189,248,0.85)]"
              />
            ))}
          </div>

          {/* Ambient Rotating Starlight Rune Rings on Sky Altar */}
          <div
            style={{ animation: 'hsSlowSpin 38s linear infinite' }}
            className="pointer-events-none absolute h-[280px] w-[280px] rounded-full border-2 border-dashed border-sky-300/35 sm:h-[420px] sm:w-[420px]"
          />
          <div
            style={{
              animation: 'hsSlowSpin 52s linear infinite reverse',
              background:
                'conic-gradient(from 0deg, transparent 0deg, rgba(56,189,248,0.16) 40deg, transparent 80deg, rgba(251,191,36,0.14) 160deg, transparent 210deg, rgba(56,189,248,0.16) 290deg, transparent 360deg)',
            }}
            className="pointer-events-none absolute h-[320px] w-[320px] rounded-full blur-md sm:h-[460px] sm:w-[460px]"
          />

          {/* Pack Explosion Shockwave Flash */}
          {burstFlash && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <div className="h-52 w-52 animate-[hsFlipBurstRing_0.52s_ease-out_forwards] rounded-full border-[8px] border-amber-200 bg-sky-300/45 shadow-[0_0_120px_50px_rgba(125,211,252,0.95)] sm:h-64 sm:w-64" />
            </div>
          )}

          {/* Innkeeper Authentic Korean Rarity Voice Callout Banner */}
          {innkeeperCallout && (
            <div
              data-testid="innkeeper-pack-callout"
              className={`pointer-events-none absolute left-1/2 top-14 z-[55] -translate-x-1/2 whitespace-nowrap rounded-full border-2 px-4 py-1 text-xs font-black tracking-wide sm:top-16 sm:px-5 sm:py-1.5 sm:text-sm ${innkeeperCallout.borderCls}`}
            >
              🎙 {innkeeperCallout.text}
            </div>
          )}

          {!openedCards ? (
            /* Idle / Cracking Pack on Sky Altar Socket */
            <div
              onClick={triggerOpenPack}
              className={`relative z-20 flex cursor-pointer flex-col items-center justify-center rounded-full border-[4px] p-7 transition-all sm:p-10 ${
                packBursting
                  ? 'border-yellow-200 bg-amber-300/45 shadow-[0_0_110px_42px_rgba(250,204,21,0.98)]'
                  : draggingPack
                    ? 'scale-110 border-sky-300 bg-sky-500/25 shadow-[0_0_65px_rgba(56,189,248,0.9)]'
                    : 'border-sky-400/50 bg-sky-950/40 shadow-[0_0_48px_rgba(56,189,248,0.48)] hover:scale-105'
              }`}
            >
              <div
                style={{
                  animation: packBursting
                    ? 'hsPackTremble 0.52s ease-in forwards'
                    : profile.packs > 0
                      ? 'hsAltarPackHover 3.4s ease-in-out infinite'
                      : undefined,
                }}
              >
                <div
                  className={`h-36 w-26 transition sm:h-44 sm:w-32 ${
                    profile.packs > 0 ? 'opacity-98' : 'opacity-25 grayscale'
                  } ${packBursting ? 'brightness-150 saturate-150' : ''}`}
                >
                  <SnsBoosterPackArt glowing={profile.packs > 0} />
                </div>
              </div>
              <span className="hs-title hs-outline-sm mt-3 text-center text-base font-extrabold text-sky-200 sm:text-lg">
                {packBursting
                  ? tr('눈히어로 봉인 개방 중!!', 'Unsealing SNSHero Pack!!')
                  : profile.packs > 0
                    ? tr('터치하여 눈히어로 팩 개봉', 'Tap to Open Card Pack')
                    : tr('개봉할 카드 팩이 없습니다', 'No Packs Available')}
              </span>
            </div>
          ) : (
            /* ==================== 5-CARD FLOATING PENTAGON + 3D FLIP STAGE ==================== */
            <div className="relative z-20 flex h-full w-full flex-col items-center justify-between">
              {/* Top Floating Action Control (`5장 한 번에 뒤집기` -> `확인 완료`) */}
              <div className="relative z-50 flex shrink-0 flex-wrap items-center justify-center gap-2 sm:gap-3">
                {!allRevealed ? (
                  <button
                    type="button"
                    onClick={revealAll}
                    className="hs-arcane-btn min-h-[42px] rounded-xl px-4 py-2 text-xs font-extrabold tracking-wide text-white shadow-[0_8px_24px_rgba(2,132,199,0.75)] sm:px-5 sm:text-sm"
                  >
                    {tr('5장 한 번에 뒤집기', 'Reveal All 5 Cards')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={finishPackSession}
                      className="hs-brass-btn min-h-[44px] rounded-2xl border-yellow-200 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-800 px-6 py-2 text-sm font-extrabold text-stone-950 shadow-[0_0_28px_rgba(250,204,21,0.9)] sm:px-8 sm:text-base"
                    >
                      {tr('확인 완료', 'Done')}{' '}
                      {profile.packs > 0
                        ? isKo
                          ? `(남은 팩 ${profile.packs}개)`
                          : `(${profile.packs} Left)`
                        : ''}
                    </button>
                    {onReturnToJourney && profile.packs === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          hsAudio.playSfx('box_press');
                          onReturnToJourney();
                        }}
                        className="hs-arcane-btn min-h-[44px] rounded-2xl px-5 py-2 text-sm font-extrabold text-white sm:text-base"
                      >
                        ⚔ {tr('업그레이드 완료 · 스토리모드 도전', 'Upgraded · Challenge Story Mode')}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* 5-Point Radial Floating Stage (Mobile Constellation < md, Pentagon >= md) */}
              <div className="relative my-auto flex min-h-[440px] w-full flex-1 items-center justify-center md:min-h-[470px]">
                <div className="relative h-[440px] w-full max-w-[360px] md:h-[470px] md:max-w-[760px]">
                  {openedCards.map((item, idx) => {
                    const isUp = revealed[idx];
                    const isFlippingNow = flippingActive[idx];
                    const isHovered = hoveredIdx === idx;
                    const slot = isDesktopStage
                      ? PENTAGON_SLOTS[idx] || PENTAGON_SLOTS[0]
                      : MOBILE_PENTAGON_SLOTS[idx] || MOBILE_PENTAGON_SLOTS[0];
                    const isHighTier =
                      item.card.rarity === 'LEGENDARY' || item.card.rarity === 'EPIC';
                    const activeTilt =
                      hoverTilt && hoverTilt.idx === idx
                        ? { rx: hoverTilt.rx, ry: hoverTilt.ry }
                        : { rx: 0, ry: 0 };

                    return (
                      <div
                        key={`${item.card.id}_${idx}`}
                        style={{
                          transition: `transform 0.62s cubic-bezier(0.18, 0.89, 0.32, 1.14) ${idx * 55}ms, opacity 0.28s ease`,
                          transform: cardsSweepingOut
                            ? 'translate3d(0px, -80px, 0) scale(0.25)'
                            : cardsDealt
                              ? `translate3d(${slot.dx}px, ${slot.dy}px, 0) scale(1)`
                              : 'translate3d(0px, 0px, 0) scale(0.16) rotate(-16deg)',
                          opacity: cardsSweepingOut ? 0 : 1,
                        }}
                        className={`absolute left-1/2 top-1/2 -ml-[54px] -mt-[82px] md:-ml-[82px] md:-mt-[124px] ${
                          isFlippingNow || isHovered ? 'z-40' : 'z-20'
                        }`}
                      >
                        {/* Layer A: Continuous Magical Mid-Air Levitation Wrapper ("둥둥 떠다니는 효과") */}
                        <div
                          onMouseEnter={() => {
                            setHoveredIdx(idx);
                            if (!isUp) hsAudio.playSfx('card_hover', 0.5);
                          }}
                          onMouseMove={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            const nx = (e.clientX - r.left) / r.width - 0.5;
                            const ny = (e.clientY - r.top) / r.height - 0.5;
                            setHoverTilt({ idx, rx: -ny * 15, ry: nx * 15 });
                          }}
                          onMouseLeave={() => {
                            setHoveredIdx(null);
                            setHoverTilt(null);
                          }}
                          onClick={() => {
                            if (!isUp) {
                              revealCardAt(idx);
                            } else {
                              hsAudio.playSfx('card_hover', 0.7);
                              setZoomedPackCard(item);
                            }
                          }}
                          style={
                            {
                              '--base-tilt': isHovered ? '0deg' : slot.tilt,
                              animation: `hsPackCardFloat ${slot.floatDur} ease-in-out ${slot.floatDelay} infinite`,
                            } as React.CSSProperties
                          }
                          className="relative h-[164px] w-[108px] cursor-pointer md:h-[248px] md:w-[164px]"
                        >
                          {/* Breathing Ground Levitation Shadow Under Card */}
                          <div
                            className={`pointer-events-none absolute -bottom-3 left-1/2 h-3.5 w-20 -translate-x-1/2 rounded-full bg-black/75 blur-md transition-all duration-300 md:-bottom-4 md:h-4 md:w-28 ${
                              isHovered ? 'scale-115 opacity-90' : 'opacity-65'
                            }`}
                          />

                          {/* Flip Moment Expanding Rarity Shockwave Ring */}
                          {isFlippingNow && (
                            <div
                              className={`pointer-events-none absolute left-1/2 top-1/2 z-50 h-28 w-28 -translate-x-1/2 -translate-y-1/2 animate-[hsFlipBurstRing_0.64s_ease-out_forwards] rounded-full border-[5px] md:h-40 md:w-40 ${
                                FLIP_RING_COLOR[item.card.rarity]
                              }`}
                            />
                          )}

                          {/* Persistent Rotating Radiant Aura Behind Revealed Epic / Legendary Cards */}
                          {isUp && isHighTier && (
                            <div
                              style={{
                                animation: 'hsSlowSpin 18s linear infinite',
                                background:
                                  item.card.rarity === 'LEGENDARY'
                                    ? 'conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.5) 35deg, transparent 70deg, rgba(251,191,36,0.5) 155deg, transparent 190deg, rgba(251,191,36,0.5) 275deg, transparent 360deg)'
                                    : 'conic-gradient(from 0deg, transparent 0deg, rgba(192,132,252,0.48) 35deg, transparent 70deg, rgba(192,132,252,0.48) 155deg, transparent 190deg, rgba(192,132,252,0.48) 275deg, transparent 360deg)',
                              }}
                              className="pointer-events-none absolute -inset-6 z-0 rounded-full blur-md md:-inset-8"
                            />
                          )}

                          {/* Layer B: 3D Lift Arc + Perspective Stage */}
                          <div
                            style={{
                              perspective: '1150px',
                              animation: isFlippingNow
                                ? 'hsCardFlipLift 0.62s cubic-bezier(0.22, 1, 0.36, 1)'
                                : undefined,
                            }}
                            className={`relative z-10 h-full w-full transition-transform duration-200 ${
                              !isUp && isHovered ? '-translate-y-2 scale-108' : ''
                            }`}
                          >
                            {/* Layer C: Pure 3D Two-Sided Rotor (`preserve-3d` — NO filter/overflow here!) */}
                            <div
                              style={{
                                transformStyle: 'preserve-3d',
                                WebkitTransformStyle: 'preserve-3d',
                                transition: 'transform 0.58s cubic-bezier(0.20, 0.92, 0.28, 1.06)',
                                transform: `rotateY(${isUp ? 180 : 0}deg) rotateX(${activeTilt.rx}deg) rotateZ(${activeTilt.ry * 0.15}deg)`,
                              }}
                              className="relative h-full w-full"
                            >
                              {/* 1. BACK FACE (Unflipped SNSHero Card Back + Rarity Anticipation Aura) */}
                              <div
                                style={{
                                  backfaceVisibility: 'hidden',
                                  WebkitBackfaceVisibility: 'hidden',
                                  transform: 'rotateY(0deg) translateZ(2px)',
                                  boxShadow: isHovered
                                    ? HOVER_RARITY_GLOW[item.card.rarity]
                                    : '0 14px 28px rgba(0,0,0,0.88)',
                                }}
                                className="absolute inset-0 overflow-hidden rounded-[12px] transition-shadow duration-200 md:rounded-[16px]"
                              >
                                <SnsCardBackArt variant={profile.selectedCardBack} />
                                {/* Subtle Magical Shimmer Across Floating Card Back */}
                                <div
                                  style={{
                                    background:
                                      'linear-gradient(125deg, transparent 32%, rgba(255,255,255,0.22) 50%, transparent 68%)',
                                    backgroundSize: '220% 100%',
                                    animation: 'hsGoldenFoil 4.2s linear infinite',
                                  }}
                                  className="pointer-events-none absolute inset-0 mix-blend-screen"
                                />
                              </div>

                              {/* 2. FRONT FACE (Revealed SNSHero Sculpted Card) */}
                              <div
                                style={{
                                  backfaceVisibility: 'hidden',
                                  WebkitBackfaceVisibility: 'hidden',
                                  transform: 'rotateY(180deg) translateZ(2px)',
                                }}
                                className="absolute inset-0 flex items-center justify-center"
                              >
                                <div className="origin-center scale-[0.61] md:scale-[0.91]">
                                  <HearthstoneCard
                                    card={item.card}
                                    isGolden={item.isGolden}
                                    rarityAura={item.card.rarity}
                                    size="MD"
                                  />
                                </div>

                                {item.isNew && (
                                  <span className="hs-outline-sm pointer-events-none absolute right-0 top-0.5 z-40 rounded border border-yellow-200 bg-gradient-to-b from-amber-400 to-amber-700 px-1.5 py-0.5 text-[8.5px] font-extrabold text-white shadow-lg md:top-1 md:rounded-md md:px-2 md:text-[10px]">
                                    {tr('신규!', 'NEW!')}
                                  </span>
                                )}
                                {item.newJourneyMultiplier > 1 && (
                                  <span className="hs-outline-sm pointer-events-none absolute -top-2.5 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-600 to-teal-800 px-2 py-0.5 text-[8px] font-extrabold text-white shadow-lg md:-top-3 md:px-2.5 md:text-[10px]">
                                    {isKo
                                      ? `⚡스토리 ×${item.newJourneyMultiplier}배 (${item.newOwnedCount}장)`
                                      : `⚡Story ×${item.newJourneyMultiplier} (${item.newOwnedCount})`}
                                  </span>
                                )}
                                {item.isGolden && (
                                  <span className="hs-outline-sm pointer-events-none absolute -bottom-1 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded border border-yellow-200 bg-gradient-to-b from-yellow-400 to-amber-700 px-1.5 py-0.5 text-[8px] font-extrabold text-white shadow md:rounded-md md:px-2 md:text-[9.5px]">
                                    {tr('황금 카드', 'Golden')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="relative z-30 shrink-0 text-center text-[10.5px] font-bold text-amber-200/80 sm:text-[11px]">
        {tr(
          '1팩 5장 (최소 희귀 이상 1장 확정) · 전 등급 중복 방지 및 천장(첫 10팩 / 이후 40팩 전설 확정) 적용 · 배수 강화는 스토리모드 전용',
          '5 Cards per Pack (1 Rare+ Guaranteed) · Duplicate Protection & Pity Timer (1st 10 Packs / 40 Packs) · ×3 Story Awakening',
        )}
      </footer>

      {/* Official Hearthstone Pack Probabilities, Rarity Value & Innkeeper VO Guide Modal */}
      {showOddsModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr('카드 팩 확률 및 등급 안내', 'Pack Drop Rates & Rarity Guide')}
          onClick={() => setShowOddsModal(false)}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/82 p-3 backdrop-blur-sm sm:p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hs-wood-panel relative max-h-[92%] w-full max-w-2xl overflow-y-auto rounded-3xl p-4 text-amber-100 shadow-2xl sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between border-b border-amber-400/35 pb-2.5">
              <h2 className="hs-title text-base font-extrabold text-amber-100 sm:text-xl">
                {tr(
                  '카드 팩 획득 확률 · 등급 가치 · 여관주인 대사 안내',
                  'Pack Drop Rates · Arcane Dust · Innkeeper Callouts',
                )}
              </h2>
              <button
                type="button"
                onClick={() => setShowOddsModal(false)}
                className="hs-brass-btn rounded-xl px-2.5 py-1 text-xs font-extrabold text-amber-100"
              >
                {tr('닫기 ✕', 'Close ✕')}
              </button>
            </div>

            <div className="space-y-3.5 text-xs leading-relaxed">
              {/* 1. Official Hearthstone Pack Drop Rates, Independent Pity Timers & Duplicate Protection */}
              <div className="rounded-2xl border border-sky-400/40 bg-stone-950/85 p-3.5">
                <div className="mb-1.5 text-sm font-extrabold text-sky-300">
                  {tr(
                    '1. 일반 팩 기준 공식 획득 확률 · 독립 천장 · 중복 방지 (382장 기준)',
                    '1. Standard Pack Drop Rates · Pity Timers · Duplicate Protection (382-Card Pool)',
                  )}
                </div>
                <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-yellow-400/35 bg-black/45 p-2.5">
                    <div className="mb-1 text-xs font-extrabold text-yellow-300">
                      {tr('✦ 황금 카드 (팩당 확률 · 독립 천장)', '✦ Golden Cards (Per Pack · Independent Pity)')}
                    </div>
                    <ul className="space-y-0.5 text-[11px] font-semibold text-amber-100/95">
                      <li>
                        • <b>{tr('황금 전설:', 'Golden Legendary:')}</b> {PACK_DROP_RATES_SPEC.packGoldenLegendaryPct}% (
                        {isKo
                          ? `${PACK_DROP_RATES_SPEC.goldenLegendaryPityPacks}번째 이내 확정`
                          : `Guaranteed within ${PACK_DROP_RATES_SPEC.goldenLegendaryPityPacks}`}
                        )
                      </li>
                      <li>
                        • <b>{tr('황금 특급:', 'Golden Epic:')}</b> {PACK_DROP_RATES_SPEC.packGoldenEpicPct}% (
                        {isKo
                          ? `${PACK_DROP_RATES_SPEC.goldenEpicPityPacks}번째 이내 확정`
                          : `Guaranteed within ${PACK_DROP_RATES_SPEC.goldenEpicPityPacks}`}
                        )
                      </li>
                      <li>
                        • <b>{tr('황금 희귀:', 'Golden Rare:')}</b> {PACK_DROP_RATES_SPEC.packGoldenRarePct}% (
                        {isKo
                          ? `${PACK_DROP_RATES_SPEC.goldenRarePityPacks}번째 이내 확정`
                          : `Guaranteed within ${PACK_DROP_RATES_SPEC.goldenRarePityPacks}`}
                        )
                      </li>
                      <li>
                        • <b>{tr('황금 일반:', 'Golden Common:')}</b> {PACK_DROP_RATES_SPEC.packGoldenCommonPct}% (
                        {isKo
                          ? `${PACK_DROP_RATES_SPEC.goldenCommonPityPacks}번째 이내 확정`
                          : `Guaranteed within ${PACK_DROP_RATES_SPEC.goldenCommonPityPacks}`}
                        )
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-xl border border-sky-400/35 bg-black/45 p-2.5">
                    <div className="mb-1 text-xs font-extrabold text-sky-300">
                      {tr('◆ 일반 카드 (팩당 확률 · 독립 천장)', '◆ Standard Cards (Per Pack · Independent Pity)')}
                    </div>
                    <ul className="space-y-0.5 text-[11px] font-semibold text-amber-100/95">
                      <li>
                        • <b>{tr('일반 전설:', 'Legendary:')}</b> {PACK_DROP_RATES_SPEC.packNormalLegendaryPct}% (
                        {isKo
                          ? `첫 ${PACK_DROP_RATES_SPEC.firstLegendaryGuaranteePacks}팩 / 이후 ${PACK_DROP_RATES_SPEC.legendaryPityPacks}번째 이내 확정`
                          : `1st ${PACK_DROP_RATES_SPEC.firstLegendaryGuaranteePacks} packs / then ${PACK_DROP_RATES_SPEC.legendaryPityPacks}`}
                        )
                      </li>
                      <li>
                        • <b>{tr('일반 특급:', 'Epic:')}</b> {PACK_DROP_RATES_SPEC.packNormalEpicPct}% (
                        {isKo
                          ? `${PACK_DROP_RATES_SPEC.epicPityPacks}번째 이내 확정`
                          : `Guaranteed within ${PACK_DROP_RATES_SPEC.epicPityPacks}`}
                        )
                      </li>
                      <li>
                        • <b>{tr('일반 희귀:', 'Rare:')}</b>{' '}
                        {tr(
                          '팩당 최소 희귀 이상 등급 카드 1장 100% 포함',
                          'At least 1 Rare or better card 100% guaranteed per pack',
                        )}
                      </li>
                      <li>
                        • <b>{tr('일반 등급:', 'Common:')}</b>{' '}
                        {tr(
                          '위 조건·확률 외 모든 슬롯 (기본 129장 제외 · 고급 253장 풀)',
                          'Remaining slots (253 collectible pack cards excluding 129 Free Basic)',
                        )}
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-amber-200/85">
                  {tr(
                    '※ 전 등급 중복 방지(미보유 전설·2장 미만 카드 우선 등장) 적용 · 간판 전설(0.6% / 361팩)은 간판 포함 확장팩 전용으로 초기 382장 클래식 풀에는 미포함됩니다.',
                    '※ Duplicate protection applies across all rarities (unowned Legendaries and missing playsets prioritized).',
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 rounded-xl border border-amber-400/30 bg-black/50 px-3 py-1.5 text-[11px] font-extrabold text-amber-200">
                  <span>
                    {isKo ? `누적 개봉: ${pityState.totalPacksOpened}팩` : `Packs Opened: ${pityState.totalPacksOpened}`}
                  </span>
                  <span>·</span>
                  <span>
                    {!pityState.firstTenLegendaryClaimed
                      ? tr(`첫 전설 천장: ${pityState.packsSinceLegendary}/10`, `1st Legendary Pity: ${pityState.packsSinceLegendary}/10`)
                      : tr(`일반 전설 천장: ${pityState.packsSinceLegendary}/40`, `Legendary Pity: ${pityState.packsSinceLegendary}/40`)}
                  </span>
                  <span>·</span>
                  <span>{tr(`일반 특급 천장: ${pityState.packsSinceEpic}/10`, `Epic Pity: ${pityState.packsSinceEpic}/10`)}</span>
                  <span>·</span>
                  <span className="text-yellow-300">
                    {isKo
                      ? `황금 천장(일 ${pityState.packsSinceGoldenCommon}/25 · 희 ${pityState.packsSinceGoldenRare}/29 · 특 ${pityState.packsSinceGoldenEpic}/142 · 전 ${pityState.packsSinceGoldenLegendary}/361)`
                      : `Golden Pity (C ${pityState.packsSinceGoldenCommon}/25 · R ${pityState.packsSinceGoldenRare}/29 · E ${pityState.packsSinceGoldenEpic}/142 · L ${pityState.packsSinceGoldenLegendary}/361)`}
                  </span>
                </div>
              </div>

              {/* 2. Arcane Dust Crafting & Disenchant Value Table */}
              <div className="rounded-2xl border border-amber-400/40 bg-stone-950/85 p-3.5">
                <div className="mb-1.5 text-sm font-extrabold text-amber-300">
                  {tr(
                    '2. 등급별 보석 색상 · 신비한 가루 제작 비용 & 마력 추출 획득량',
                    '2. Rarity Gem · Arcane Dust Crafting Cost & Disenchant Value',
                  )}
                </div>
                <p className="mb-2 text-[11.5px] font-semibold text-amber-100/90">
                  {tr(
                    '전설 카드는 덱에 단 1장만 편성 가능한 핵심 결전 능력을 지니며, 중복·미사용 고등급 카드를 마력 추출하면 훨씬 많은 가루를 얻어 원하는 카드를 직접 제작할 수 있습니다.',
                    'Legendary cards allow 1 copy per deck with game-changing effects. Disenchant extra cards into Arcane Dust to craft any card you need.',
                  )}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-center text-[11.5px] font-bold">
                    <thead>
                      <tr className="border-b border-amber-500/35 bg-amber-950/45 text-amber-200">
                        <th className="px-2 py-1.5">{tr('등급', 'Rarity')}</th>
                        <th className="px-2 py-1.5">{tr('보석 색깔', 'Gem')}</th>
                        <th className="px-2 py-1.5">{tr('직접 제작 비용', 'Craft Cost')}</th>
                        <th className="px-2 py-1.5">{tr('분해(마력 추출)', 'Disenchant')}</th>
                        <th className="px-2 py-1.5">{tr('황금 분해', 'Golden Disenchant')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-500/20">
                      <tr>
                        <td className="px-2 py-1.5 text-slate-100">{tr('일반', 'Common')}</td>
                        <td className="px-2 py-1.5 text-slate-200">{tr('흰색', 'White')}</td>
                        <td className="px-2 py-1.5">{tr('40 가루', '40 Dust')}</td>
                        <td className="px-2 py-1.5 text-emerald-300">{tr('5 가루', '5 Dust')}</td>
                        <td className="px-2 py-1.5 text-yellow-300">{tr('50 가루', '50 Dust')}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-sky-300">{tr('희귀', 'Rare')}</td>
                        <td className="px-2 py-1.5 text-sky-300">{tr('파란색', 'Blue')}</td>
                        <td className="px-2 py-1.5">{tr('100 가루', '100 Dust')}</td>
                        <td className="px-2 py-1.5 text-emerald-300">{tr('20 가루', '20 Dust')}</td>
                        <td className="px-2 py-1.5 text-yellow-300">{tr('100 가루', '100 Dust')}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-purple-300">{tr('특급', 'Epic')}</td>
                        <td className="px-2 py-1.5 text-purple-300">{tr('보라색', 'Purple')}</td>
                        <td className="px-2 py-1.5">{tr('400 가루', '400 Dust')}</td>
                        <td className="px-2 py-1.5 text-emerald-300">{tr('100 가루', '100 Dust')}</td>
                        <td className="px-2 py-1.5 text-yellow-300">{tr('400 가루', '400 Dust')}</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 text-orange-300">{tr('전설', 'Legendary')}</td>
                        <td className="px-2 py-1.5 text-orange-300">{tr('주황색', 'Orange')}</td>
                        <td className="px-2 py-1.5">{tr('1,600 가루', '1,600 Dust')}</td>
                        <td className="px-2 py-1.5 text-emerald-300">{tr('400 가루', '400 Dust')}</td>
                        <td className="px-2 py-1.5 text-yellow-300">{tr('1,600 가루', '1,600 Dust')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Innkeeper Voiceover Preview Buttons */}
              <div className="rounded-2xl border border-orange-400/40 bg-stone-950/85 p-3.5">
                <div className="mb-1.5 text-sm font-extrabold text-orange-300">
                  {tr(
                    '3. 개봉 시 여관주인 실제 대사 & 전설·황금 특수 연출 (터치 시 미리듣기)',
                    '3. Innkeeper Reveal Callouts & Golden FX (Tap to Preview)',
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: 'rare' as const, label: tr('“희귀 카드!” (파랑)', '“Rare!” (Blue)'), cls: 'border-sky-400 text-sky-200' },
                    { key: 'epic' as const, label: tr('“특급 카드!” (보라)', '“Epic!” (Purple)'), cls: 'border-purple-400 text-purple-200' },
                    { key: 'legendary' as const, label: tr('“오~ 전설 카드!” (주황)', '“Whoa! Legendary!” (Orange)'), cls: 'border-orange-400 text-orange-200' },
                    { key: 'golden_rare' as const, label: tr('“황금 희귀 카드!”', '“Golden Rare!”'), cls: 'border-yellow-300 text-yellow-200' },
                    { key: 'golden_epic' as const, label: tr('“황금 특급 카드!”', '“Golden Epic!”'), cls: 'border-yellow-300 text-yellow-200' },
                    { key: 'golden_legendary' as const, label: tr('“오~ 황금 전설 카드!”', '“Whoa! Golden Legendary!”'), cls: 'border-yellow-300 text-yellow-200' },
                  ].map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => hsAudio.playInnkeeper(b.key)}
                      className={`rounded-xl border bg-black/60 px-2.5 py-1.5 text-[11px] font-extrabold hover:brightness-125 ${b.cls}`}
                    >
                      🔊 {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card Zoom Modal for Inspecting Any Flipped Pack Card */}
      {zoomedPackCard && (
        <CardZoomModal
          card={zoomedPackCard.card}
          isGolden={zoomedPackCard.isGolden}
          rarityAura={zoomedPackCard.card.rarity}
          journeyMultiplier={zoomedPackCard.newJourneyMultiplier}
          subtitleBadge={
            zoomedPackCard.newJourneyMultiplier > 1
              ? tr(
                  `보유 ${zoomedPackCard.newOwnedCount}장 달성! · 카단의 여정 ×${zoomedPackCard.newJourneyMultiplier}배 각성`,
                  `${zoomedPackCard.newOwnedCount} Owned! · Story ×${zoomedPackCard.newJourneyMultiplier} Awakening`,
                )
              : zoomedPackCard.isNew
                ? tr('신규 영웅 카드 획득!', 'New Hero Card Unlocked!')
                : zoomedPackCard.isGolden
                  ? tr('황금 영웅 카드 획득!', 'Golden Card Unlocked!')
                  : tr(
                      `눈히어로 팩 개봉 획득 (보유 ${zoomedPackCard.newOwnedCount}장)`,
                      `Obtained from Pack (Owned: ${zoomedPackCard.newOwnedCount})`,
                    )
          }
          showFlavor
          primaryAction={{
            label: tr('확인 (닫기)', 'OK (Close)'),
            variant: 'arcane',
            onClick: () => {
              hsAudio.playSfx('ui_click', 0.65);
              setZoomedPackCard(null);
            },
          }}
          onCancel={() => setZoomedPackCard(null)}
        />
      )}
    </div>
  );
};
