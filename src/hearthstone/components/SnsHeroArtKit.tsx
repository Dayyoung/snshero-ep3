import React from 'react';
import { isKoreanLanguage, tr } from '../../i18n/heroLang';
import { HeroClass, SnsCardBackId } from '../types';

export const SNS_LOGO_URL = '/hs-assets/brand/logo-en.webp';
export const SNS_LOGO_KO_URL = '/hs-assets/brand/logo-ko.webp';
export const SNS_LOGO_EN_URL = '/hs-assets/brand/logo-en.webp';
export function getSnsLogoUrl(lang?: string): string {
  if (lang) return lang === 'ko' ? SNS_LOGO_KO_URL : SNS_LOGO_EN_URL;
  return isKoreanLanguage() ? SNS_LOGO_KO_URL : SNS_LOGO_EN_URL;
}
export const SNS_ICON_URL = '/icon.png';

export const SNS_LOCATIONS = {
  TAVERN_EXTERIOR: '/hs-assets/bg/elwin_intro_bg.webp',
  BOX_TABLE: '/hs-assets/bg/elwin_hub_bg.webp',
  PACK_ALTAR: '/hs-assets/bg/pack_altar_bg.webp',
  COLLECTION_ARCHIVE: '/hs-assets/bg/elwin_hub_bg.webp',
  BOARD_LIGHTHAVEN: '/hs-assets/bg/arena_elwin_snow.webp?v=2',
  BOARD_RED_PALACE: '/hs-assets/bg/arena_crimson_forge.webp?v=2',
  BOARD_WIND_ISLE: '/hs-assets/bg/arena_emerald_wind.webp?v=2',
} as const;

export const SNS_CARD_BACK_THEMES: Record<
  SnsCardBackId,
  {
    name: string;
    subtitle: string;
    imageUrl: string;
    glowColor: string;
  }
> = {
  bronze: {
    name: '클래식 브론즈',
    subtitle: '엘윈 모험가 기본 지급 카드 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-bronze.png',
    glowColor: 'rgba(217, 119, 6, 0.55)',
  },
  silver: {
    name: '프로스트 실버',
    subtitle: '백은 서리 엠블럼 프리미엄 카드 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-silver.png',
    glowColor: 'rgba(226, 232, 240, 0.65)',
  },
  gold: {
    name: '24K 로얄 골드',
    subtitle: '순금 황실 엠블럼 챔피언 카드 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-gold.png',
    glowColor: 'rgba(250, 204, 21, 0.75)',
  },
  ocarina_crest: {
    name: '엘윈 눈꽃 성소',
    subtitle: '쌍검과 눈꽃 성기사 방패 사파이어 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-sanctuary.webp',
    glowColor: 'rgba(56, 189, 248, 0.8)',
  },
  bogart_vip: {
    name: '황금 용옥새 VIP',
    subtitle: '24K 황금 용문양 · 루비 하이롤러 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-vip-dragon.webp',
    glowColor: 'rgba(250, 204, 21, 0.9)',
  },
};

export function getSnsCardBackLabel(id: SnsCardBackId): { name: string; subtitle: string } {
  if (isKoreanLanguage()) {
    return SNS_CARD_BACK_THEMES[id] || SNS_CARD_BACK_THEMES.bronze;
  }
  if (id === 'silver') {
    return { name: 'Frost Silver', subtitle: 'Platinum Frost Emblem Card Back' };
  }
  if (id === 'bronze') {
    return { name: 'Classic Bronze', subtitle: 'Default Starter Card Back' };
  }
  if (id === 'ocarina_crest') {
    return { name: 'Elwin Frost Sanctuary', subtitle: 'Twin Frostblades & Snowflake Shield Back' };
  }
  if (id === 'bogart_vip') {
    return { name: 'Royal Dragon VIP', subtitle: '24K Golden Dragon Seal & Ruby Card Back' };
  }
  return { name: '24K Royal Gold', subtitle: '24K Sovereign Gold Emblem Card Back' };
}

export interface ElwinTimeOfDayTheme {
  id: 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT';
  labelKo: string;
  labelEn: string;
  icon: string;
  skyOverlay: string;
}

const ELWIN_SKY_THEMES: Record<'DAWN' | 'DAY' | 'DUSK' | 'NIGHT', ElwinTimeOfDayTheme> = {
  DAWN: {
    id: 'DAWN',
    labelKo: '새벽빛 엘윈 대평원',
    labelEn: 'Dawn over Elwin Plain',
    icon: '🌅',
    skyOverlay:
      'linear-gradient(180deg, rgba(251,191,36,0.20) 0%, rgba(56,189,248,0.14) 45%, rgba(9,16,38,0.58) 100%)',
  },
  DAY: {
    id: 'DAY',
    labelKo: '창공의 엘윈 성소',
    labelEn: 'Sunlit Elwin Sanctuary',
    icon: '☀️',
    skyOverlay:
      'linear-gradient(180deg, rgba(56,189,248,0.24) 0%, rgba(16,185,129,0.12) 48%, rgba(12,20,44,0.52) 100%)',
  },
  DUSK: {
    id: 'DUSK',
    labelKo: '황혼의 성검 언덕',
    labelEn: 'Golden Dusk Sanctuary',
    icon: '🌇',
    skyOverlay:
      'linear-gradient(180deg, rgba(249,115,22,0.22) 0%, rgba(168,85,247,0.14) 48%, rgba(15,18,42,0.60) 100%)',
  },
  NIGHT: {
    id: 'NIGHT',
    labelKo: '별빛 시간의 성소',
    labelEn: 'Starlight Sanctuary Night',
    icon: '🌙',
    skyOverlay:
      'linear-gradient(180deg, rgba(30,64,175,0.28) 0%, rgba(14,165,233,0.12) 46%, rgba(8,13,32,0.66) 100%)',
  },
};

/** DEV-030 & DEV-032: Zelda (Ocarina of Time)-inspired dynamic or user-pinned Elwin sky lighting */
export function getElwinTimeOfDayTheme(
  override?: 'AUTO' | 'DAWN' | 'DAY' | 'DUSK' | 'NIGHT',
): ElwinTimeOfDayTheme {
  let pref = override;
  if (!pref && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('hero_hs_settings');
      if (raw) {
        const parsed = JSON.parse(raw) as { lobbySkyTime?: string };
        if (
          parsed?.lobbySkyTime === 'DAWN' ||
          parsed?.lobbySkyTime === 'DAY' ||
          parsed?.lobbySkyTime === 'DUSK' ||
          parsed?.lobbySkyTime === 'NIGHT'
        ) {
          pref = parsed.lobbySkyTime;
        }
      }
    } catch {
      // ignore storage error
    }
  }
  if (pref && pref !== 'AUTO' && ELWIN_SKY_THEMES[pref]) {
    return ELWIN_SKY_THEMES[pref];
  }
  const hr = typeof window !== 'undefined' ? new Date().getHours() : 12;
  if (hr >= 5 && hr < 9) return ELWIN_SKY_THEMES.DAWN;
  if (hr >= 9 && hr < 16) return ELWIN_SKY_THEMES.DAY;
  if (hr >= 16 && hr < 20) return ELWIN_SKY_THEMES.DUSK;
  return ELWIN_SKY_THEMES.NIGHT;
}

/** DEV-030: Forged Brass Shield + Sacred Sword + Ocarina Royal Crest Emblem */
export const SnsOcarinaCrestSeal: React.FC<{ size?: number; className?: string }> = ({
  size = 38,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    className={`select-none ${className}`}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="ocarinaBrass" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="ocarinaSapphire" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#38bdf8" />
        <stop offset="55%" stopColor="#1d4ed8" />
        <stop offset="100%" stopColor="#172554" />
      </linearGradient>
    </defs>
    {/* Sacred Sword Hilt & Blade Behind Shield */}
    <rect x="30" y="3" width="4" height="56" rx="1.5" fill="#e2e8f0" stroke="#475569" strokeWidth="1" />
    <path d="M20 13 H44 L41 17 H23 Z" fill="url(#ocarinaBrass)" stroke="#451a03" strokeWidth="1" />
    <circle cx="32" cy="5" r="3" fill="#38bdf8" stroke="#fef08a" strokeWidth="1.2" />
    {/* Hylian/Elwin Sanctuary Shield */}
    <path
      d="M14 17 H50 V34 C50 46 39 54 32 58 C25 54 14 46 14 34 Z"
      fill="url(#ocarinaSapphire)"
      stroke="url(#ocarinaBrass)"
      strokeWidth="3"
    />
    {/* Triforce-inspired Three Sanctuary Gems */}
    <polygon points="32,22 27,30 37,30" fill="#fde047" />
    <polygon points="26,31 21,39 31,39" fill="#fde047" />
    <polygon points="38,31 33,39 43,39" fill="#fde047" />
    {/* Blue Ocarina Motif at Shield Base */}
    <ellipse cx="32" cy="46" rx="9" ry="5" fill="#0ea5e9" stroke="#fef08a" strokeWidth="1.5" />
    <circle cx="28" cy="46" r="1.2" fill="#082f49" />
    <circle cx="32" cy="45" r="1.2" fill="#082f49" />
    <circle cx="36" cy="46.5" r="1.2" fill="#082f49" />
  </svg>
);

function resolveCardBackKey(variant?: SnsCardBackId | string): SnsCardBackId {
  return variant === 'silver' || variant === 'frost'
    ? 'silver'
    : variant === 'gold'
      ? 'gold'
      : variant === 'ocarina_crest'
        ? 'ocarina_crest'
        : variant === 'bogart_vip'
          ? 'bogart_vip'
          : 'bronze';
}

export const SnsCardBackArt: React.FC<{
  variant?: SnsCardBackId | string;
  className?: string;
}> = ({ variant = 'bronze', className = 'w-full h-full' }) => {
  const key = resolveCardBackKey(variant);
  const theme = SNS_CARD_BACK_THEMES[key];
  const label = getSnsCardBackLabel(key);

  return (
    <div
      data-cardback-variant={key}
      className={`relative select-none overflow-hidden rounded-[8%] ${className}`}
      style={{
        filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.75))',
      }}
    >
      <img
        src={theme.imageUrl}
        alt={label.name}
        draggable={false}
        className="h-full w-full object-fill select-none"
      />
      {/* Subtle glossy foil highlight */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[8%]"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, transparent 36%, transparent 72%, rgba(0,0,0,0.25) 100%)',
        }}
      />
    </div>
  );
};

export const SnsBoosterPackArt: React.FC<{
  variant?: SnsCardBackId | string;
  className?: string;
  glowing?: boolean;
}> = ({ variant = 'gold', className = 'w-full h-full', glowing = false }) => {
  const key = resolveCardBackKey(variant);
  const theme = SNS_CARD_BACK_THEMES[key];
  const stackLayers = [
    { tx: '-9%', ty: '5%', rot: '-7deg', brightness: 0.72 },
    { tx: '-4.5%', ty: '2.5%', rot: '-3.5deg', brightness: 0.82 },
    { tx: '0%', ty: '0%', rot: '0deg', brightness: 0.9 },
    { tx: '4.5%', ty: '-2.5%', rot: '3.5deg', brightness: 0.95 },
    { tx: '9%', ty: '-5%', rot: '6.5deg', brightness: 1 },
  ];

  return (
    <div
      data-pack-cardback={key}
      className={`relative flex select-none items-center justify-center ${className}`}
    >
      {glowing && (
        <div
          className="pointer-events-none absolute -inset-2 animate-pulse rounded-2xl"
          style={{
            background: `radial-gradient(circle, ${theme.glowColor} 0%, transparent 72%)`,
          }}
        />
      )}
      {stackLayers.map((layer, idx) => (
        <div
          key={idx}
          className="pointer-events-none absolute h-[88%] w-[84%] overflow-hidden rounded-[8px]"
          style={{
            transform: `translate(${layer.tx}, ${layer.ty}) rotate(${layer.rot})`,
            filter: `brightness(${layer.brightness})`,
            boxShadow:
              idx === stackLayers.length - 1 && glowing
                ? `0 0 28px ${theme.glowColor}, 0 12px 24px rgba(0,0,0,0.85)`
                : '0 8px 18px rgba(0,0,0,0.78)',
            zIndex: idx + 1,
          }}
        >
          <SnsCardBackArt variant={key} className="h-full w-full" />
        </div>
      ))}
    </div>
  );
};

export const SnsSnowCompassSeal: React.FC<{
  size?: number;
  spinning?: boolean;
  className?: string;
}> = ({ size = 48, spinning = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    className={`select-none ${spinning ? 'animate-spin' : ''} ${className}`}
    style={spinning ? { animationDuration: '16s' } : undefined}
  >
    <defs>
      <radialGradient id="snsSealCore" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#e0f2fe" />
        <stop offset="48%" stopColor="#0284c7" />
        <stop offset="100%" stopColor="#0f172a" />
      </radialGradient>
      <linearGradient id="snsSealGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fef9c3" />
        <stop offset="50%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
    </defs>
    <polygon
      points="40,3 66,14 77,40 66,66 40,77 14,66 3,40 14,14"
      fill="url(#snsSealCore)"
      stroke="url(#snsSealGold)"
      strokeWidth="3.8"
    />
    <circle
      cx="40"
      cy="40"
      r="27"
      fill="none"
      stroke="rgba(253,224,71,0.55)"
      strokeWidth="1.4"
    />
    <path
      d="M40 10 L46 32 L68 40 L46 48 L40 70 L34 48 L12 40 L34 32 Z"
      fill="url(#snsSealGold)"
      stroke="#451a03"
      strokeWidth="1.4"
    />
    <circle cx="40" cy="40" r="10" fill="#38bdf8" stroke="#fef9c3" strokeWidth="2" />
    <path
      d="M40 33 V47 M33 40 H47 M35 35 L45 45 M45 35 L35 45"
      stroke="#ffffff"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const SnsRankMedallion: React.FC<{
  rank: number;
  size?: number;
  className?: string;
}> = ({ rank, size = 44, className = '' }) => {
  const isLegend = rank === 0;
  const isHigh = rank > 0 && rank <= 10;
  const topCol = isLegend ? '#f59e0b' : isHigh ? '#38bdf8' : '#b45309';
  const botCol = isLegend ? '#581c87' : isHigh ? '#1e3a8a' : '#451a03';
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" className={`select-none ${className}`}>
      <defs>
        <linearGradient id={`rk_${rank}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={topCol} />
          <stop offset="100%" stopColor={botCol} />
        </linearGradient>
      </defs>
      <polygon
        points="36,4 62,16 58,48 36,68 14,48 10,16"
        fill={`url(#rk_${rank})`}
        stroke="#fde68a"
        strokeWidth="3"
      />
      <polygon
        points="36,11 55,20 52,45 36,60 20,45 17,20"
        fill="none"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.2"
      />
      <text
        x="36"
        y="43"
        textAnchor="middle"
        fill="#ffffff"
        stroke="#1c1008"
        strokeWidth="3"
        paintOrder="stroke"
        fontFamily="Nanum Gothic, sans-serif"
        fontWeight="900"
        fontSize={isLegend ? '18' : '22'}
      >
        {isLegend ? '★' : rank}
      </text>
    </svg>
  );
};

export const SnsQuestScrollIcon: React.FC<{
  size?: number;
  className?: string;
}> = ({ size = 28, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className={`select-none ${className}`}>
    <rect x="14" y="10" width="36" height="44" rx="5" fill="#f3dfb7" stroke="#78350f" strokeWidth="3" />
    <rect x="10" y="8" width="44" height="8" rx="4" fill="#d97706" stroke="#451a03" strokeWidth="2.2" />
    <rect x="10" y="48" width="44" height="8" rx="4" fill="#d97706" stroke="#451a03" strokeWidth="2.2" />
    <line x1="21" y1="24" x2="43" y2="24" stroke="#78350f" strokeWidth="2.6" strokeLinecap="round" />
    <line x1="21" y1="32" x2="43" y2="32" stroke="#78350f" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="39" cy="41" r="6" fill="#dc2626" stroke="#fef08a" strokeWidth="1.6" />
  </svg>
);

export const SnsLegendaryCardDragonSvg: React.FC<{
  isGolden?: boolean;
  preserveAspectRatio?: string;
  className?: string;
}> = ({ isGolden = false, preserveAspectRatio = 'xMidYMid meet', className = '' }) => {
  const uid = React.useId().replace(/:/g, '');
  // Sovereign Forged Royal Gold & Sunfire-Bronze 3D Relief (Standard Legendary)
  // and Blazing White-Hot 24K Diamond-Gold Relief (Golden Legendary)
  const rimHighlight = isGolden ? '#ffffff' : '#fffbeb';
  const metalPeak = isGolden ? '#fffef2' : '#fef9c3';
  const metalBright = isGolden ? '#fde047' : '#f7ce68';
  const metalMid = isGolden ? '#eab308' : '#d99026';
  const metalDark = isGolden ? '#92400e' : '#783f0c';
  const metalCrevice = isGolden ? '#3b1702' : '#261104';
  const recessTop = isGolden ? '#a16207' : '#572c0c';
  const recessBot = isGolden ? '#451a03' : '#1f0d03';
  const trimBright = isGolden ? '#ffffff' : '#fef08a';
  const trimMid = isGolden ? '#facc15' : '#f59e0b';
  const trimDeep = isGolden ? '#854d0e' : '#92400e';

  return (
    <svg
      viewBox="0 -28 300 270"
      preserveAspectRatio={preserveAspectRatio}
      className={`pointer-events-none select-none overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={`sovBody_${uid}`} x1="0.12" y1="0" x2="0.88" y2="1">
          <stop offset="0%" stopColor={metalPeak} />
          <stop offset="22%" stopColor={metalBright} />
          <stop offset="56%" stopColor={metalMid} />
          <stop offset="86%" stopColor={metalDark} />
          <stop offset="100%" stopColor={metalCrevice} />
        </linearGradient>
        <linearGradient id={`sovWingSpar_${uid}`} x1="0.1" y1="0" x2="0.92" y2="1">
          <stop offset="0%" stopColor={rimHighlight} />
          <stop offset="28%" stopColor={metalBright} />
          <stop offset="68%" stopColor={metalMid} />
          <stop offset="100%" stopColor={metalDark} />
        </linearGradient>
        <linearGradient id={`sovMembrane_${uid}`} x1="0.2" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={recessTop} />
          <stop offset="55%" stopColor={recessBot} />
          <stop offset="100%" stopColor="#120702" />
        </linearGradient>
        <linearGradient id={`sovTrim_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={trimBright} />
          <stop offset="35%" stopColor="#fde047" />
          <stop offset="72%" stopColor={trimMid} />
          <stop offset="100%" stopColor={trimDeep} />
        </linearGradient>
        <radialGradient id={`sovEye_${uid}`} cx="38%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="28%" stopColor="#fef08a" />
          <stop offset="68%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#9a3412" />
        </radialGradient>
        <radialGradient id={`sovCrownGem_${uid}`} cx="35%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="32%" stopColor="#fde047" />
          <stop offset="66%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
        <radialGradient id={`sovAura_${uid}`} cx="52%" cy="22%" r="54%">
          <stop offset="0%" stopColor="rgba(253, 224, 71, 0.38)" />
          <stop offset="58%" stopColor="rgba(249, 115, 22, 0.14)" />
          <stop offset="100%" stopColor="rgba(249, 115, 22, 0)" />
        </radialGradient>
      </defs>

      <g>
        {/* Subtle Sovereign Golden Crown Back-Glow */}
        <ellipse cx="176" cy="24" rx="108" ry="52" fill={`url(#sovAura_${uid})`} />

        {/* 1. Left Sweeping Crest-Wing & Armored Tail Hugging Upper-Left Bezel (Cleanly Clear of Mana Gem) */}
        <path
          d="M 142 18
             C 116 10, 88 18, 66 38
             C 75 41, 82 47, 84 56
             C 98 37, 118 26, 145 25
             Z"
          fill={`url(#sovBody_${uid})`}
          stroke={metalCrevice}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M 140 19 C 115 13, 92 21, 71 37"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.95"
        />
        {/* Sculpted Left Bezel Armored Curve & 3-Clawed Royal Talons (Below Mana Gem) */}
        <path
          d="M 66 68
             C 56 84, 51 104, 52 126
             C 53 142, 57 156, 64 168
             C 60 151, 59 131, 62 111
             C 64 94, 69 80, 76 70
             Z"
          fill={`url(#sovBody_${uid})`}
          stroke={`url(#sovTrim_${uid})`}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M 54 98 L 41 105 L 52 110 L 42 119 L 53 121 L 46 131 L 57 127 Z"
          fill={`url(#sovTrim_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* 2. Majestic 4-Pinion Sweeping Upper-Right Sovereign Dragon Wing */}
        <path
          d="M 174 22
             C 192 -6, 224 -22, 262 -20
             C 251 -7, 250 4, 256 10
             C 270 1, 283 -1, 294 5
             C 282 20, 279 31, 284 39
             C 291 35, 296 36, 298 43
             C 286 58, 280 74, 279 92
             C 268 100, 261 110, 257 120
             C 245 84, 224 48, 186 31
             Z"
          fill={`url(#sovMembrane_${uid})`}
          stroke={`url(#sovTrim_${uid})`}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Layered Sculpted 24K Gold Wing Pinion Blades */}
        <path
          d="M 174 21 C 198 -6, 229 -19, 260 -19 C 240 -5, 224 8, 212 23 Z"
          fill={`url(#sovWingSpar_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M 206 23 C 234 7, 265 1, 292 6 C 271 18, 251 27, 235 38 Z"
          fill={`url(#sovWingSpar_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M 228 39 C 254 32, 276 33, 296 42 C 277 51, 260 60, 248 70 Z"
          fill={`url(#sovWingSpar_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M 244 68 C 262 66, 274 72, 279 90 C 268 89, 259 94, 253 102 Z"
          fill={`url(#sovWingSpar_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Forged Wing Thumb-Claw & Specular Gold Ridges */}
        <path
          d="M 168 22 C 186 -2, 208 -16, 232 -21 L 239 -27 L 241 -15 C 219 -7, 200 8, 184 27 Z"
          fill={`url(#sovTrim_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M 178 16 C 200 -5, 226 -16, 253 -17
             M 218 20 C 244 9, 266 5, 286 7
             M 236 41 C 256 35, 273 36, 289 41"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* 3. Armored Serpentine Dragon Neck, Overlapping Scale Plates & Dorsal Spines (Right Arch) */}
        <path
          d="M 210 34
             C 244 47, 271 78, 275 125
             C 278 158, 266 188, 243 207
             C 238 202, 232 198, 226 196
             C 242 174, 250 150, 249 124
             C 248 91, 234 62, 204 46
             Z"
          fill={`url(#sovBody_${uid})`}
          stroke={`url(#sovTrim_${uid})`}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Sculpted Overlapping Dragon Armor Chevrons */}
        <path
          d="M 219 49 Q 246 53 257 68
             M 231 67 Q 257 72 267 89
             M 240 88 Q 264 94 272 113
             M 245 111 Q 266 117 273 136
             M 246 134 Q 264 142 268 160
             M 242 158 Q 257 166 257 182"
          fill="none"
          stroke={metalCrevice}
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        <path
          d="M 221 47 Q 246 51 257 66
             M 233 65 Q 257 70 267 87
             M 242 86 Q 264 92 272 111
             M 247 109 Q 266 115 273 134
             M 248 132 Q 264 140 268 158"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.45"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Gilded Outer Dorsal Spines */}
        <path
          d="M 257 60 L 277 53 L 265 75
             M 269 89 L 288 86 L 273 106
             M 274 120 L 290 122 L 273 138
             M 269 153 L 284 159 L 264 170"
          fill={`url(#sovTrim_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {/* Right Bezel-Gripping 3-Clawed Golden Talons & Tail Finial */}
        <path
          d="M 245 144 L 229 153 L 241 159 L 227 169 L 239 172 L 230 184 L 245 178 Z"
          fill={`url(#sovTrim_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M 240 186 L 226 211 L 246 198 Z"
          fill={`url(#sovTrim_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />

        {/* 4. Organic Sculpted Sovereign Dragon Head & Sunfire Crown (Top Arch Center-Right) */}
        {/* Twin Swept-Back Royal Cranial Horns */}
        <path
          d="M 196 16 C 210 -1, 226 -14, 242 -21 C 235 -4, 226 10, 214 25 Z"
          fill={`url(#sovTrim_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M 208 26 C 224 14, 239 5, 254 1 C 244 16, 232 27, 216 36 Z"
          fill={`url(#sovBody_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M 200 14 C 213 0, 226 -11, 238 -17 M 212 25 C 226 15, 238 7, 249 3"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Roaring Jaw Interior, Golden Breath Wisps & Ivory Fangs */}
        <path
          d="M 136 34 C 148 45, 174 47, 196 41 L 199 28 L 154 26 Z"
          fill="#1a0802"
          stroke={metalCrevice}
          strokeWidth="1.5"
        />
        {/* Subtle Dragon-Breath Flame Tongue */}
        <path
          d="M 122 36 C 130 32, 138 33, 146 36 C 137 40, 129 41, 122 36 Z"
          fill={`url(#sovEye_${uid})`}
          opacity="0.92"
        />
        <path
          d="M 143 33 L 146 42 L 150 34 M 156 34 L 159 42 L 163 34 M 150 44 L 153 38 L 156 44"
          fill="#fffef5"
          stroke={metalCrevice}
          strokeWidth="0.95"
          strokeLinejoin="round"
        />

        {/* Sculpted Lower Mandible & Chin Beard-Spur */}
        <path
          d="M 138 40 C 150 51, 178 52, 208 39 L 192 35 C 174 42, 154 43, 138 40 Z"
          fill={`url(#sovBody_${uid})`}
          stroke={`url(#sovTrim_${uid})`}
          strokeWidth="2.1"
          strokeLinejoin="round"
        />

        {/* Curved Organic Upper Dragon Skull, Armored Brow & Nasal Horn */}
        <path
          d="M 130 32
             C 134 23, 141 17, 147 15
             L 152 21
             C 162 17, 174 9, 186 8
             C 201 7, 214 14, 222 27
             L 216 41
             C 201 35, 184 35, 168 36
             C 153 37, 140 36, 130 32
             Z"
          fill={`url(#sovBody_${uid})`}
          stroke={`url(#sovTrim_${uid})`}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Recessed Cheek Armor Plate */}
        <path
          d="M 178 22 C 192 17, 205 19, 214 31 C 202 33, 190 32, 178 22 Z"
          fill={`url(#sovMembrane_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
        {/* Specular Brow & Snout Crest Highlight */}
        <path
          d="M 133 29 C 137 22, 142 18, 146 17 L 152 22 C 163 18, 175 11, 187 10 C 198 10, 208 14, 215 21"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Forehead Sovereign Sunfire Crown Medallion */}
        <g transform="translate(186, 16)">
          <polygon
            points="0,-8 6,0 0,8 -6,0"
            fill={`url(#sovCrownGem_${uid})`}
            stroke={trimBright}
            strokeWidth="1.3"
          />
          <circle cx="-1.5" cy="-2.2" r="1.5" fill="#ffffff" opacity="0.9" />
        </g>

        {/* Blazing Slanted Dragon Eye Slit */}
        <path
          d="M 159 25 C 164 21, 172 21, 176 24 C 173 28, 165 29, 159 25 Z"
          fill={`url(#sovEye_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <circle cx="166" cy="24.5" r="1.3" fill="#ffffff" />
      </g>
    </svg>
  );
};

export const SnsLegendaryCrestSvg: React.FC<{
  isGolden?: boolean;
  className?: string;
}> = ({ isGolden = false, className = '' }) => (
  <SnsLegendaryCardDragonSvg
    isGolden={isGolden}
    preserveAspectRatio="none"
    className={className}
  />
);

export const SnsTauntShieldSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 120 144" className={`pointer-events-none select-none ${className}`}>
    <defs>
      <linearGradient id="snsTauntSteel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="45%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
    </defs>
    <path
      d="M60 4 L112 22 V72 C112 106 86 128 60 140 C34 128 8 106 8 72 V22 Z"
      fill="none"
      stroke="url(#snsTauntSteel)"
      strokeWidth="10"
      strokeLinejoin="round"
    />
    <path
      d="M60 4 L112 22 V72 C112 106 86 128 60 140 C34 128 8 106 8 72 V22 Z"
      fill="none"
      stroke="#eab308"
      strokeWidth="2.6"
      strokeLinejoin="round"
    />
  </svg>
);

export const SnsDivineBarrierSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 120 144" className={`pointer-events-none select-none ${className}`}>
    <defs>
      <radialGradient id="snsDivineDome" cx="40%" cy="30%" r="68%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.65)" />
        <stop offset="55%" stopColor="rgba(253,224,71,0.38)" />
        <stop offset="100%" stopColor="rgba(245,158,11,0.62)" />
      </radialGradient>
    </defs>
    <ellipse
      cx="60"
      cy="72"
      rx="54"
      ry="66"
      fill="url(#snsDivineDome)"
      stroke="#fef08a"
      strokeWidth="3.5"
    />
  </svg>
);

export const SnsArmorCrestSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 64 72" className={`pointer-events-none select-none ${className}`}>
    <defs>
      <linearGradient id="snsArmorPlate" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="50%" stopColor="#94a3b8" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
    </defs>
    <path
      d="M32 4 L58 14 V36 C58 52 45 63 32 69 C19 63 6 52 6 36 V14 Z"
      fill="url(#snsArmorPlate)"
      stroke="#1e293b"
      strokeWidth="4"
    />
    <path
      d="M32 10 L52 18 V35 C52 48 42 57 32 62 C22 57 12 48 12 35 V18 Z"
      fill="none"
      stroke="#e2e8f0"
      strokeWidth="1.6"
    />
  </svg>
);

export const SnsSecretOrbSvg: React.FC<{
  heroClass: HeroClass;
  size?: number;
}> = ({ heroClass, size = 28 }) => {
  const color =
    heroClass === 'MAGE'
      ? '#38bdf8'
      : heroClass === 'HUNTER'
        ? '#2dd4bf'
        : heroClass === 'PALADIN'
          ? '#facc15'
          : '#c084fc';
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="select-none">
      <circle cx="24" cy="24" r="20" fill="#0f172a" stroke="#fde68a" strokeWidth="3" />
      <circle cx="24" cy="24" r="15" fill={color} fillOpacity="0.88" />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fill="#ffffff"
        stroke="#090d16"
        strokeWidth="3"
        paintOrder="stroke"
        fontFamily="Nanum Gothic, sans-serif"
        fontWeight="900"
        fontSize="22"
      >
        ?
      </text>
    </svg>
  );
};
