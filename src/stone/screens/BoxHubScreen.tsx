import React, { useEffect, useState } from 'react';
import { useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { HsArcaneDustVialIcon, HsGoldCoinIcon } from '../components/CardVisual';
import { GameMode, PlayerProfile } from '../types';

export interface BoxHubScreenProps {
  profile: PlayerProfile;
  onSelectPlayMode: (mode: GameMode) => void;
  onOpenCollection: () => void;
  onOpenPacks: () => void;
  onOpenQuestLog: () => void;
  onOpenShop: () => void;
  onOpenOptions: () => void;
  onOpenReaModal: () => void;
}

let hasPlayedInitialChestUnlatch = false;

export const BoxHubScreen: React.FC<BoxHubScreenProps> = ({
  profile,
  onSelectPlayMode,
  onOpenCollection,
  onOpenPacks,
  onOpenQuestLog,
  onOpenShop,
  onOpenOptions,
  onOpenReaModal: _onOpenReaModal,
}) => {
  const { tr } = useHeroLanguage();
  const [diskSpinning, setDiskSpinning] = useState(false);
  const [doorsOpening, setDoorsOpening] = useState(() => !hasPlayedInitialChestUnlatch);
  const [trayReady, setTrayReady] = useState(() => hasPlayedInitialChestUnlatch);

  useEffect(() => {
    hsAudio.playBgm('tavern_hub');
    if (!hasPlayedInitialChestUnlatch) {
      hasPlayedInitialChestUnlatch = true;
      hsAudio.playSfx('box_open', 0.9);
      const t1 = window.setTimeout(() => {
        hsAudio.playSfx('box_tray_out', 0.72);
        setTrayReady(true);
      }, 360);
      const t2 = window.setTimeout(() => {
        setDoorsOpening(false);
      }, 920);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    return undefined;
  }, []);

  const replayBoxUnlatch = () => {
    hsAudio.playSfx('box_open', 0.9);
    setTrayReady(false);
    setDoorsOpening(true);
    window.setTimeout(() => {
      hsAudio.playSfx('box_tray_out', 0.72);
      setTrayReady(true);
    }, 340);
    window.setTimeout(() => {
      setDoorsOpening(false);
    }, 900);
  };

  const triggerModeTransition = (mode: GameMode) => {
    hsAudio.playSfx('box_press');
    hsAudio.playSfx('box_disk_flip', 0.88);
    setDiskSpinning(true);
    window.setTimeout(() => {
      setDiskSpinning(false);
      onSelectPlayMode(mode);
    }, 340);
  };

  return (
    <div
      style={{ backgroundImage: 'url(/stone-assets/ui/box_table_bg.webp)' }}
      className="relative flex h-[100dvh] w-full select-none flex-col items-center justify-between overflow-y-auto bg-cover bg-center px-2.5 py-2 sm:overflow-hidden sm:p-5"
    >
      {/* Warm Candlelight Tavern Table Vignette */}
      <div
        style={{
          background:
            'radial-gradient(ellipse at 50% 48%, rgba(255,198,105,0.10) 0%, rgba(12,7,4,0.42) 64%, rgba(5,3,2,0.88) 100%)',
        }}
        className="pointer-events-none absolute inset-0"
      />

      {/* Top Brass HUD Bar */}
      <header className="relative z-30 flex w-full max-w-6xl flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <a
          href="/"
          data-testid="stone-hub-home-logo"
          onClick={() => hsAudio.playSfx('ui_click')}
          onMouseEnter={() => hsAudio.playSfx('box_hover', 0.45)}
          title={tr('SNSHero 홈(/)으로 이동', 'Go to SNSHero Home (/)')}
          className="hs-brass-btn flex min-h-[44px] items-center gap-2 rounded-xl px-2.5 py-1 text-amber-100 transition hover:brightness-110 sm:gap-2.5 sm:px-3.5 sm:py-1.5"
        >
          <img
            src="/stone-assets/ui/hs_titlelogo.webp"
            alt={tr('하스스톤', 'Hearthstone')}
            draggable={false}
            className="h-8 w-auto max-w-[116px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] sm:h-9 sm:max-w-[138px]"
          />
          <div className="text-left leading-tight">
            <div className="hs-title text-xs font-extrabold tracking-wide text-amber-100 sm:text-sm">
              {tr('하스스톤', 'Hearthstone')}
            </div>
            <div className="text-[10px] font-bold tracking-wider text-amber-300/85">
              {tr('워크래프트의 영웅들', 'Heroes of Warcraft')}
            </div>
          </div>
        </a>

        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('ui_click');
              onOpenShop();
            }}
            onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
            className="hs-brass-btn flex min-h-[42px] items-center gap-2 rounded-xl px-2.5 py-1.5 sm:gap-3 sm:px-3.5 sm:py-2"
          >
            <span className="flex items-center gap-1">
              <HsGoldCoinIcon size={18} />
              <span className="hs-num text-xs text-yellow-300 sm:text-base">{profile.gold}</span>
            </span>
            <span className="h-3.5 w-[1px] bg-amber-400/35 sm:h-4" />
            <span className="flex items-center gap-1">
              <HsArcaneDustVialIcon size={17} />
              <span className="hs-num text-xs text-sky-200 sm:text-sm">{profile.arcaneDust}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('open_menu');
              onOpenOptions();
            }}
            onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
            className="hs-brass-btn flex min-h-[42px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold text-amber-100 sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-sm"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="text-amber-300">
              <path
                d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
                stroke="currentColor"
                strokeWidth="1.9"
              />
            </svg>
            <span>{tr('메뉴', 'Options')}</span>
          </button>
        </div>
      </header>

      {/* Centerpiece: THE HEARTHSTONE BOX (3D Hinged Wooden Chest + Turntable Medallion) */}
      <main className="relative z-20 my-auto flex w-full max-w-[820px] flex-col items-center pt-4 sm:pt-0">
        <div
          style={{ perspective: '1600px' }}
          className="hs-wood-panel relative flex w-full flex-col items-center rounded-[26px] px-3.5 pb-4 pt-2 sm:rounded-[32px] sm:px-10 sm:pb-6 sm:pt-3"
        >
          {/* Recessed Crimson-Mahogany Velvet Interior Cavity */}
          <div
            style={{
              background:
                'radial-gradient(ellipse at 50% 44%, #3c2110 0%, #221108 58%, #100703 100%)',
            }}
            className="pointer-events-none absolute inset-2.5 rounded-[20px] border-[3px] border-[#b98c44]/55 shadow-[inset_0_12px_42px_rgba(0,0,0,0.94)] sm:inset-3.5 sm:rounded-[24px]"
          />

          {/* Subtle Carved Chest Grain Relief */}
          <div
            style={{ backgroundImage: 'url(/stone-assets/ui/box_chest_full.webp)' }}
            className="pointer-events-none absolute inset-2.5 rounded-[20px] bg-cover bg-center opacity-16 mix-blend-luminosity sm:inset-3.5 sm:rounded-[24px]"
          />

          {/* 4 Forged Brass Corner Brackets */}
          <div className="pointer-events-none absolute left-4 top-4 h-3.5 w-3.5 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:left-5 sm:top-5 sm:h-4 sm:w-4" />
          <div className="pointer-events-none absolute right-4 top-4 h-3.5 w-3.5 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:right-5 sm:top-5 sm:h-4 sm:w-4" />
          <div className="pointer-events-none absolute bottom-4 left-4 h-3.5 w-3.5 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:bottom-5 sm:left-5 sm:h-4 sm:w-4" />
          <div className="pointer-events-none absolute bottom-4 right-4 h-3.5 w-3.5 rounded-full border border-amber-100 bg-gradient-to-b from-amber-300 to-amber-800 shadow-md sm:bottom-5 sm:right-5 sm:h-4 sm:w-4" />

          {/* Master Sculpted Stone & Gold HEARTHSTONE Title Crest */}
          <button
            type="button"
            onClick={replayBoxUnlatch}
            title={tr('클릭하여 여관 상자 개폐 연출 다시 보기', 'Click to replay the Hearthstone box unlatch animation')}
            className="relative z-30 -mt-7 transition-transform hover:scale-[1.02] sm:-mt-12"
          >
            <img
              src="/stone-assets/ui/hs_logo_master.webp"
              alt="Hearthstone"
              draggable={false}
              className="w-[224px] drop-shadow-[0_14px_22px_rgba(0,0,0,0.94)] sm:w-[348px]"
            />
          </button>

          {/* Center Rotating Brass Medallion ("The Box" Turntable) */}
          <div className="relative z-20 my-1 flex items-center justify-center sm:my-1.5">
            {/* Outer Sculpted Bronze Ring (`hs_thebox_ring.webp`) */}
            <img
              src="/stone-assets/ui/hs_thebox_ring.webp"
              alt=""
              draggable={false}
              className="pointer-events-none absolute -inset-3.5 h-[calc(100%+28px)] w-[calc(100%+28px)] rounded-full object-contain opacity-90 mix-blend-screen sm:-inset-5 sm:h-[calc(100%+40px)] sm:w-[calc(100%+40px)]"
            />

            {/* Rotating Arcane Blue Rune Halo (`hs_thebox_glowring.webp`) */}
            <img
              src="/stone-assets/ui/hs_thebox_glowring.webp"
              alt=""
              draggable={false}
              className="pointer-events-none absolute -inset-6 h-[calc(100%+48px)] w-[calc(100%+48px)] animate-[hsSlowSpin_34s_linear_infinite] rounded-full object-contain opacity-90 mix-blend-screen sm:-inset-8 sm:h-[calc(100%+64px)] sm:w-[calc(100%+64px)]"
            />

            <div
              style={{
                transform: diskSpinning
                  ? 'perspective(950px) rotateY(90deg) scale(0.95)'
                  : 'perspective(950px) rotateY(0deg) scale(1)',
                transition: 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              className="relative flex h-[258px] w-[258px] flex-col items-center justify-center rounded-full border-[5px] border-[#e2be74] bg-radial from-[#ead2a3] via-[#b88f4c] to-[#4f3417] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.95),inset_0_0_26px_rgba(32,18,6,0.9)] sm:h-[336px] sm:w-[336px] sm:border-[6px] sm:p-6"
            >
              {/* Authentic Extracted 3-Slot Brass Disk (`box_menu_disk.webp`) */}
              <img
                src="/stone-assets/ui/box_menu_disk.webp"
                alt=""
                draggable={false}
                className="pointer-events-none absolute inset-0 h-full w-full rounded-full object-cover opacity-85"
              />

              {/* Top Hearthstone Swirl Seal */}
              <img
                src="/stone-assets/ui/box_compass_medallion.webp"
                alt=""
                draggable={false}
                className="relative z-10 -mt-2 mb-1.5 h-9 w-9 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)] sm:-mt-3 sm:mb-2 sm:h-12 sm:w-12"
              />

              {/* 3 Authentic Carved Ivory Mode Plates Aligned with `box_menu_disk.webp` */}
              <div className="relative z-10 flex w-full max-w-[196px] flex-col gap-2 sm:max-w-[238px] sm:gap-2.5">
                <button
                  type="button"
                  onMouseEnter={() => hsAudio.playSfx('box_hover', 0.55)}
                  onClick={() => triggerModeTransition('RANKED')}
                  className="hs-ivory-plate group flex min-h-[42px] items-center justify-center rounded-xl px-4 py-1.5 sm:min-h-[48px] sm:py-2"
                >
                  <span className="hs-title text-lg font-extrabold tracking-widest text-[#2a1708] group-hover:text-[#0c4a6e] sm:text-2xl">
                    {tr('대전', 'Play')}
                  </span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => hsAudio.playSfx('box_hover', 0.55)}
                  onClick={() => triggerModeTransition('PRACTICE_NORMAL')}
                  className="hs-ivory-plate group flex min-h-[40px] items-center justify-center rounded-xl px-4 py-1.5 sm:min-h-[46px] sm:py-2"
                >
                  <span className="hs-title text-base font-extrabold tracking-widest text-[#2a1708] group-hover:text-[#7c2d12] sm:text-xl">
                    {tr('연습', 'Practice')}
                  </span>
                </button>

                <button
                  type="button"
                  onMouseEnter={() => hsAudio.playSfx('box_hover', 0.55)}
                  onClick={() => triggerModeTransition('TUTORIAL')}
                  className="hs-ivory-plate group flex min-h-[38px] items-center justify-center rounded-xl px-4 py-1 sm:min-h-[44px] sm:py-1.5"
                >
                  <span className="hs-title text-sm font-extrabold tracking-wider text-[#2a1708] group-hover:text-[#14532d] sm:text-lg">
                    {tr('튜토리얼', 'Tutorial')}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Recessed Drawer Tray (`팩 개봉` · `수집품` · `일지` · `상점`) */}
          <div
            style={{
              transform: trayReady ? 'translateY(0) scale(1)' : 'translateY(14px) scale(0.97)',
              opacity: trayReady ? 1 : 0.4,
              transition: 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
            }}
            className="relative z-20 mt-2.5 grid w-full max-w-2xl grid-cols-2 gap-2 rounded-2xl border-[2.5px] border-[#b68d4c] bg-gradient-to-b from-[#231409] to-[#110904] p-2.5 shadow-[inset_0_4px_16px_rgba(0,0,0,0.92)] sm:mt-3.5 sm:grid-cols-4 sm:gap-2.5 sm:border-[3px] sm:p-3"
          >
            <button
              type="button"
              onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                hsAudio.playSfx('box_press');
                onOpenPacks();
              }}
              className="hs-brass-btn relative flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-amber-100 sm:gap-2.5"
            >
              {profile.packs > 0 && (
                <span className="hs-num absolute -right-1.5 -top-1.5 z-20 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-red-200 bg-gradient-to-b from-red-500 to-red-800 px-1 text-[11px] text-white shadow-[0_3px_10px_rgba(220,38,38,0.9)] sm:-right-2 sm:-top-2 sm:h-6 sm:min-w-6 sm:px-1.5 sm:text-xs">
                  {profile.packs}
                </span>
              )}
              <img
                src="/stone-assets/ui/classic_pack.webp"
                alt=""
                draggable={false}
                className="h-9 w-7 shrink-0 object-contain drop-shadow sm:h-10 sm:w-8"
              />
              <span className="hs-title text-sm font-extrabold text-amber-100 sm:text-base">
                {tr('팩 개봉', 'Open Packs')}
              </span>
            </button>

            <button
              type="button"
              onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                hsAudio.playSfx('box_press');
                onOpenCollection();
              }}
              className="hs-brass-btn flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-amber-100 sm:gap-2.5"
            >
              <img
                src="/stone-assets/ui/box_compass_medallion.webp"
                alt=""
                draggable={false}
                className="h-8 w-8 shrink-0 object-contain drop-shadow sm:h-9 sm:w-9"
              />
              <span className="hs-title text-sm font-extrabold text-amber-100 sm:text-base">
                {tr('내 수집품', 'My Collection')}
              </span>
            </button>

            <button
              type="button"
              onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                hsAudio.playSfx('box_open');
                onOpenQuestLog();
              }}
              className="hs-brass-btn flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-amber-100 sm:gap-2.5"
            >
              <img
                src="/stone-assets/ui/hs_questlog.webp"
                alt=""
                draggable={false}
                className="h-8 w-8 shrink-0 rounded-lg border border-amber-300/50 object-cover shadow sm:h-9 sm:w-9"
              />
              <span className="hs-title text-sm font-extrabold text-amber-100 sm:text-base">
                {tr('퀘스트', 'Quests')}
              </span>
            </button>

            <button
              type="button"
              onMouseEnter={() => hsAudio.playSfx('box_hover', 0.5)}
              onClick={() => {
                hsAudio.playSfx('box_press');
                onOpenShop();
              }}
              className="hs-brass-btn flex min-h-[50px] items-center justify-center gap-2 rounded-xl px-3 py-2 text-amber-100 sm:gap-2.5"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/50 bg-stone-950/60 sm:h-9 sm:w-9">
                <HsGoldCoinIcon size={22} />
              </div>
              <span className="hs-title text-sm font-extrabold text-amber-100 sm:text-base">
                {tr('상점', 'Shop')}
              </span>
            </button>
          </div>

          {/* 3D Hinged Wooden Chest Doors (`box_chest_left.webp` & `box_chest_right.webp`) */}
          {doorsOpening && (
            <div className="pointer-events-none absolute inset-0 z-40 flex overflow-visible rounded-[26px] sm:rounded-[32px]">
              <img
                src="/stone-assets/ui/box_chest_left.webp"
                alt=""
                draggable={false}
                style={{
                  transformOrigin: 'left center',
                  animation: 'hsBoxDoorLeftSwing 0.88s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                }}
                className="h-full w-1/2 rounded-l-[26px] object-fill shadow-[16px_0_40px_rgba(0,0,0,0.85)] sm:rounded-l-[32px]"
              />
              <img
                src="/stone-assets/ui/box_chest_right.webp"
                alt=""
                draggable={false}
                style={{
                  transformOrigin: 'right center',
                  animation: 'hsBoxDoorRightSwing 0.88s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                }}
                className="h-full w-1/2 rounded-r-[26px] object-fill shadow-[-16px_0_40px_rgba(0,0,0,0.85)] sm:rounded-r-[32px]"
              />
            </div>
          )}
        </div>
      </main>

      {/* Subtle Footer Plaque */}
      <footer className="relative z-20 pt-1 text-center text-[10.5px] font-bold tracking-wide text-amber-200/75 sm:text-[11px]">
        {tr(
          '하스스톤: 워크래프트의 영웅들 — 클래식 9직업 · 382장 수집 가능 카드 완비',
          'Hearthstone: Heroes of Warcraft — 9 Classic Classes · 382 Collectible Cards',
        )}
      </footer>
    </div>
  );
};
