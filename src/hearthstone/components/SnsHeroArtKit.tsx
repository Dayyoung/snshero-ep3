import React from 'react';
import { isKoreanLanguage, tr } from '../../i18n/heroLang';
import { HeroClass, SnsCardBackId } from '../types';

export const SNS_LOGO_URL = '/hs-assets/brand/logo-ko.webp';
export const SNS_LOGO_KO_URL = '/hs-assets/brand/logo-ko.webp';
export const SNS_LOGO_EN_URL = '/hs-assets/brand/logo-en.webp';
export function getSnsLogoUrl(lang?: string): string {
  if (lang) return lang === 'en' ? SNS_LOGO_EN_URL : SNS_LOGO_KO_URL;
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
  // Cast Pewter/Silver relief (Standard Legendary) with Radiant Gold Borders,
  // or Full Antique 24K Bronze-Gold relief (Golden Legendary)
  const rimHighlight = isGolden ? '#fffef0' : '#fef08a';
  const metalBright = isGolden ? '#f3cf72' : '#dce2eb';
  const metalMid = isGolden ? '#ba8528' : '#94a0b0';
  const metalDark = isGolden ? '#6b420b' : '#4a5565';
  const metalCrevice = isGolden ? '#422205' : '#4a2e08';
  const trimHighlight = isGolden ? '#fffef5' : '#fff9c4';
  const trimMid = isGolden ? '#facc15' : '#eab308';
  const trimDeep = isGolden ? '#854d0e' : '#a16207';

  return (
    <svg
      viewBox="0 -26 300 266"
      preserveAspectRatio={preserveAspectRatio}
      className={`pointer-events-none select-none overflow-visible ${className}`}
    >
      <defs>
        <linearGradient id={`metalBody_${uid}`} x1="0.1" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={isGolden ? '#fffbe6' : '#f8fafc'} />
          <stop offset="24%" stopColor={metalBright} />
          <stop offset="58%" stopColor={metalMid} />
          <stop offset="88%" stopColor={metalDark} />
          <stop offset="100%" stopColor={metalCrevice} />
        </linearGradient>
        <linearGradient id={`metalBevel_${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isGolden ? '#fffbe6' : '#f8fafc'} />
          <stop offset="40%" stopColor={metalBright} />
          <stop offset="84%" stopColor={metalDark} />
          <stop offset="100%" stopColor={metalCrevice} />
        </linearGradient>
        <linearGradient id={`wingBlade_${uid}`} x1="0.15" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={isGolden ? '#fffbe6' : '#f1f5f9'} />
          <stop offset="32%" stopColor={metalBright} />
          <stop offset="70%" stopColor={metalMid} />
          <stop offset="100%" stopColor={metalDark} />
        </linearGradient>
        <linearGradient id={`wingRecess_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={metalMid} />
          <stop offset="58%" stopColor={metalDark} />
          <stop offset="100%" stopColor={metalCrevice} />
        </linearGradient>
        <linearGradient id={`goldFiligree_${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={trimHighlight} />
          <stop offset="32%" stopColor="#fde047" />
          <stop offset="68%" stopColor={trimMid} />
          <stop offset="100%" stopColor={trimDeep} />
        </linearGradient>
        <radialGradient id={`eyeEmber_${uid}`} cx="38%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#fde047" />
          <stop offset="75%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </radialGradient>
      </defs>

      <g>
        {/* 1. Left Coiled Tail & Sleek Secondary Pinion Hugging Upper-Left Oval Bezel (Behind Mana Gem) */}
        <path
          d="M 142 20
             C 116 14, 92 22, 66 42
             C 76 46, 84 52, 84 62
             C 96 42, 118 29, 144 27
             Z"
          fill={`url(#wingRecess_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        <path
          d="M 146 21 C 118 16, 94 25, 70 42"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.92"
        />
        {/* Sleek Armored Tail Curl Wrapping Lower-Left Rim Beneath Mana Gem */}
        <path
          d="M 74 52
             C 62 66, 54 84, 53 105
             C 52 119, 55 130, 62 140
             C 59 124, 60 104, 67 84
             C 72 70, 80 58, 90 50
             Z"
          fill={`url(#metalBody_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* Sculpted Left Bezel Talon Pair (Gold-rimmed) */}
        <path
          d="M 55 96 L 44 103 L 53 108 L 46 116 L 56 115 Z"
          fill={`url(#goldFiligree_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* 2. Sweeping Sculpted Upper-Right Dragon Wing (Layered Forged Metal Pinions + Gold Border) */}
        <path
          d="M 176 24
             C 192 -2, 222 -16, 256 -14
             C 246 -2, 246 8, 252 14
             C 264 6, 276 4, 286 8
             C 276 22, 274 32, 278 40
             C 284 36, 289 36, 291 42
             C 281 56, 276 70, 276 86
             C 266 94, 260 104, 256 114
             C 244 82, 224 48, 188 32
             Z"
          fill={`url(#wingRecess_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Sculpted Overlapping Metallic Wing Pinion Blades */}
        <path
          d="M 176 22 C 198 -2, 226 -14, 255 -13 C 236 -1, 222 10, 212 24 Z"
          fill={`url(#wingBlade_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M 206 24 C 232 10, 260 4, 285 9 C 266 20, 248 28, 234 38 Z"
          fill={`url(#wingBlade_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path
          d="M 228 40 C 252 34, 272 34, 289 42 C 272 50, 256 58, 246 68 Z"
          fill={`url(#wingBlade_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        {/* Forged Wing Arm Spar + Wing Elbow Talon */}
        <path
          d="M 168 24 C 186 2, 206 -12, 228 -16 L 234 -22 L 236 -11 C 216 -4, 198 10, 184 28 Z"
          fill={`url(#goldFiligree_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        {/* Crisp Golden Specular Bevel Edges on Wing Spars */}
        <path
          d="M 178 18 C 198 -2, 222 -12, 248 -12
             M 218 22 C 242 12, 262 8, 280 10
             M 236 42 C 254 37, 270 37, 283 41"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.45"
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* 3. Continuous Armored Serpentine Neck & Body Wrapping Outside Right Oval Bezel */}
        <path
          d="M 212 36
             C 242 48, 268 78, 272 124
             C 275 156, 264 186, 242 206
             C 238 202, 232 198, 226 196
             C 241 174, 249 150, 248 124
             C 247 92, 234 64, 206 48
             Z"
          fill={`url(#metalBody_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {/* Overlapping Cast Armor Dorsal Segments & Gold Bevel Plates */}
        <path
          d="M 220 50 Q 246 54 256 68
             M 232 68 Q 256 72 266 88
             M 240 88 Q 262 94 270 112
             M 245 110 Q 264 116 271 134
             M 246 132 Q 262 140 266 158
             M 242 156 Q 256 164 256 180"
          fill="none"
          stroke={metalCrevice}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <path
          d="M 222 48 Q 246 52 256 66
             M 234 66 Q 256 70 266 86
             M 242 86 Q 262 92 270 110
             M 247 108 Q 264 114 271 132
             M 248 130 Q 262 138 266 156
             M 244 154 Q 256 162 256 178"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.88"
        />
        {/* Gilded Metallic Dorsal Ridge Spines Along Outer Spine */}
        <path
          d="M 256 62 L 274 56 L 263 76
             M 267 90 L 284 88 L 271 106
             M 272 120 L 286 122 L 271 136
             M 268 152 L 281 158 L 263 168"
          fill={`url(#goldFiligree_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Gilded Tapered Tail Barb & Right Bezel Gripping Talons */}
        <path
          d="M 244 146 L 230 154 L 241 159 L 228 168 L 239 171 L 231 182 L 244 176 Z"
          fill={`url(#goldFiligree_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M 239 186 L 226 212 L 244 198 Z"
          fill={`url(#goldFiligree_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* 4. Sculpted Fierce Dragon Skull (Perching Over Top-Center-Right Arch, Facing Left) */}
        {/* Swept-Back Main Cranial Horns (Gold-trimmed) */}
        <path
          d="M 200 18 L 236 -18 L 224 12 L 214 26 Z"
          fill={`url(#goldFiligree_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M 210 28 L 248 2 L 230 28 L 216 36 Z"
          fill={`url(#metalBody_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.1"
          strokeLinejoin="round"
        />
        <path
          d="M 204 16 L 232 -14 M 214 27 L 244 4"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity="0.92"
        />

        {/* Deep Shadowed Roaring Jaw Cavity & Razor Metallic Fangs */}
        <path
          d="M 142 36 L 164 46 L 194 42 L 198 30 L 160 28 Z"
          fill="#1a0d04"
          stroke={metalCrevice}
          strokeWidth="1.5"
        />
        <path
          d="M 149 35 L 152 43 L 156 36 M 162 36 L 165 43 L 169 36 M 157 45 L 160 39 L 163 45"
          fill="#fffef5"
          stroke={metalCrevice}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />

        {/* Armored Lower Mandible & Chin Spur (Gold-bordered) */}
        <path
          d="M 144 41 L 156 50 L 188 49 L 208 39 L 190 36 L 162 43 Z"
          fill={`url(#metalBody_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M 150 47 L 182 47"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.88"
        />

        {/* Chiseled Upper Skull, Snout Ridge, Brow Shield & Cheek Armor Plates */}
        <path
          d="M 136 33
             L 146 21
             L 164 20
             L 182 10
             L 204 14
             L 220 28
             L 216 42
             L 196 36
             L 174 37
             L 152 36
             L 140 37
             Z"
          fill={`url(#metalBody_${uid})`}
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        {/* Recessed Temporal Cheek Facet */}
        <path
          d="M 176 24 L 204 20 L 214 33 L 192 34 Z"
          fill={`url(#wingRecess_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        {/* Forged Golden Brow Plate & Nasal Horn */}
        <path
          d="M 138 30 L 145 18 L 152 24 L 166 20 L 186 12 L 202 16"
          fill="none"
          stroke={rimHighlight}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Filigree Crown Accent Crest */}
        <path
          d="M 168 23 Q 184 14 200 18"
          fill="none"
          stroke={`url(#goldFiligree_${uid})`}
          strokeWidth="2.1"
          strokeLinecap="round"
        />

        {/* Fierce Angled Glowing Dragon Eye Slit */}
        <path
          d="M 164 26 L 176 23 L 174 29 L 165 29 Z"
          fill={`url(#eyeEmber_${uid})`}
          stroke={metalCrevice}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
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
