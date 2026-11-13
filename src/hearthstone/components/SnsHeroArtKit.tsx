import React from 'react';
import { HeroClass, SnsCardBackId } from '../types';

export const SNS_LOGO_URL = '/hs-assets/brand/logo-ko.webp';
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
  gold: {
    name: '눈히어로 골드',
    subtitle: '공식 골드 엠블럼 카드 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-gold.png',
    glowColor: 'rgba(250, 204, 21, 0.55)',
  },
  silver: {
    name: '눈히어로 실버',
    subtitle: '공식 실버 플래티넘 카드 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-silver.png',
    glowColor: 'rgba(226, 232, 240, 0.55)',
  },
  bronze: {
    name: '눈히어로 브론즈',
    subtitle: '공식 브론즈 클래식 카드 뒷면',
    imageUrl: '/hs-assets/cardbacks/snshero-bronze.png',
    glowColor: 'rgba(217, 119, 6, 0.55)',
  },
};

export const SnsCardBackArt: React.FC<{
  variant?: SnsCardBackId | string;
  className?: string;
}> = ({ variant = 'gold', className = 'w-full h-full' }) => {
  const key: SnsCardBackId =
    variant === 'silver' || variant === 'frost'
      ? 'silver'
      : variant === 'bronze'
        ? 'bronze'
        : 'gold';
  const theme = SNS_CARD_BACK_THEMES[key];

  return (
    <div
      className={`relative select-none overflow-hidden rounded-[8%] ${className}`}
      style={{
        filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.75))',
      }}
    >
      <img
        src={theme.imageUrl}
        alt={theme.name}
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
  className?: string;
  glowing?: boolean;
}> = ({ className = 'w-full h-full', glowing = false }) => {
  const stackLayers = [
    { tx: '-9%', ty: '5%', rot: '-7deg', brightness: 0.72 },
    { tx: '-4.5%', ty: '2.5%', rot: '-3.5deg', brightness: 0.82 },
    { tx: '0%', ty: '0%', rot: '0deg', brightness: 0.9 },
    { tx: '4.5%', ty: '-2.5%', rot: '3.5deg', brightness: 0.95 },
    { tx: '9%', ty: '-5%', rot: '6.5deg', brightness: 1 },
  ];

  return (
    <div className={`relative flex select-none items-center justify-center ${className}`}>
      {glowing && (
        <div
          className="pointer-events-none absolute -inset-2 animate-pulse rounded-2xl"
          style={{
            background: 'radial-gradient(circle, rgba(56,189,248,0.52) 0%, transparent 72%)',
          }}
        />
      )}
      {stackLayers.map((layer, idx) => (
        <img
          key={idx}
          src="/hs-assets/cardbacks/snshero-gold.png"
          alt={idx === stackLayers.length - 1 ? '눈히어로 카드 팩 (5장)' : ''}
          draggable={false}
          className="absolute h-[88%] w-[84%] rounded-[8px] object-contain"
          style={{
            transform: `translate(${layer.tx}, ${layer.ty}) rotate(${layer.rot})`,
            filter: `brightness(${layer.brightness})`,
            boxShadow:
              idx === stackLayers.length - 1 && glowing
                ? '0 0 28px rgba(56,189,248,0.85), 0 12px 24px rgba(0,0,0,0.85)'
                : '0 8px 18px rgba(0,0,0,0.78)',
            zIndex: idx + 1,
          }}
        />
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
  className?: string;
}> = ({ isGolden = false, className = '' }) => {
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
      className={`pointer-events-none select-none overflow-visible ${className}`}
    >
      <defs>
        <filter id={`dragonRelief_${uid}`} x="-18%" y="-18%" width="142%" height="142%">
          <feDropShadow dx="0" dy="3.5" stdDeviation="2.8" floodColor="#050302" floodOpacity="0.9" />
        </filter>
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

      <g filter={`url(#dragonRelief_${uid})`}>
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

export const SnsLegendaryCrestSvg: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 260 120" className={`pointer-events-none select-none overflow-visible ${className}`}>
    <defs>
      <linearGradient id="snsLegWingGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fffbeb" />
        <stop offset="32%" stopColor="#fde047" />
        <stop offset="68%" stopColor="#d97706" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <linearGradient id="snsLegSilverBody" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="45%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <radialGradient id="snsLegGemAmber" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="40%" stopColor="#fde047" />
        <stop offset="80%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#7c2d12" />
      </radialGradient>
    </defs>
    {/* Asymmetric Coiled Hearthstone-Style Dragon Crest for Board Minion Tokens */}
    <path
      d="M 130 22
         C 100 6, 62 8, 30 30
         C 48 34, 58 42, 54 54
         C 38 56, 26 68, 22 86
         C 40 76, 56 80, 62 96
         C 60 72, 78 44, 126 34 Z"
      fill="url(#snsLegSilverBody)"
      stroke="#1a0d04"
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <path
      d="M 126 22
         C 148 -2, 186 -10, 222 0
         C 208 14, 206 24, 212 32
         C 228 24, 242 22, 248 28
         C 234 44, 228 58, 228 74
         C 236 74, 242 80, 238 92
         C 222 96, 212 104, 206 116
         C 198 84, 182 52, 142 36 Z"
      fill="url(#snsLegSilverBody)"
      stroke="#1a0d04"
      strokeWidth="3.2"
      strokeLinejoin="round"
    />
    <path
      d="M 134 22 C 156 4, 186 -4, 212 2 M 214 34 C 226 28, 236 28, 244 30 M 120 22 C 92 12, 62 14, 38 30"
      fill="none"
      stroke="url(#snsLegWingGold)"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    {/* Dragon Head & Horns */}
    <path
      d="M 178 24 L 214 -2 L 194 28 Z M 186 34 L 222 14 L 198 40 Z"
      fill="url(#snsLegWingGold)"
      stroke="#1a0d04"
      strokeWidth="2.4"
      strokeLinejoin="round"
    />
    <path
      d="M 146 38 L 158 26 L 176 24 L 192 20 L 202 36 L 188 48 L 166 44 Z"
      fill="url(#snsLegWingGold)"
      stroke="#1a0d04"
      strokeWidth="2.8"
      strokeLinejoin="round"
    />
    <circle cx="174" cy="34" r="3.4" fill="url(#snsLegGemAmber)" stroke="#1a0d04" strokeWidth="1.2" />
  </svg>
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
