import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hsAudio } from '../audio';
import { useRegisterNarrationOverlay } from '../services/narrationVisibility';
import { snsheroLiveNetwork } from '../services/snsheroLiveNetwork';
import { useModalDismiss } from '../useModalDismiss';
import {
  CLASSIC_RANK_NAMES,
  CLASS_CREST_URL,
  cardDb,
  getHeroArtUrl,
  getHeroPowerArtUrl,
} from '../cardDb';
import { HsGoldCoinIcon } from '../components/CardVisual';
import {
  SNS_LOCATIONS,
  SnsRankMedallion,
  SnsSnowCompassSeal,
} from '../components/SnsHeroArtKit';
import { useAnimaleseTypewriter } from '../components/StoryEncounterOverlays';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { getDeckDisplayName, getLocalizedHeroInfo, getRankTitle } from '../i18nData';
import {
  getModeRewardGuide,
  hsStorage,
} from '../storage';
import {
  BoardThemeId,
  CLASSIC_HEROES,
  ChallengerMeta,
  CustomDeck,
  GameMode,
  HERO_CLASS_ORDER,
  HeroClass,
} from '../types';

export interface HeroDeckSelectScreenProps {
  initialMode: GameMode;
  onBack: () => void;
  onEditDecks: () => void;
  onLaunchBattle: (params: {
    mode: GameMode;
    deck: CustomDeck;
    preferredOpponentClass?: HeroClass;
    boardTheme?: BoardThemeId;
    bogartStakeGold?: number;
    bogartDifficulty?: 'NORMAL' | 'EXPERT';
    challengerMeta?: ChallengerMeta;
  }) => void;
}

const RANKED_STAKE_OPTIONS = [0, 10, 50, 100, 300, 500] as const;

function splitDiceTotal1To12(total: number): [number, number] {
  const clamped = Math.max(1, Math.min(12, Math.floor(total)));
  if (clamped === 1) return [0, 1];
  const minD1 = Math.max(1, clamped - 6);
  const maxD1 = Math.min(6, clamped - 1);
  const d1 = minD1 + Math.floor(Math.random() * (maxD1 - minD1 + 1));
  return [d1, clamped - d1];
}

const DICE_PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [
    [26, 26],
    [74, 74],
  ],
  3: [
    [26, 26],
    [50, 50],
    [74, 74],
  ],
  4: [
    [26, 26],
    [74, 26],
    [26, 74],
    [74, 74],
  ],
  5: [
    [26, 26],
    [74, 26],
    [50, 50],
    [26, 74],
    [74, 74],
  ],
  6: [
    [26, 22],
    [74, 22],
    [26, 50],
    [74, 50],
    [26, 78],
    [74, 78],
  ],
};

const BogartDieFace: React.FC<{ value: number; rolling: boolean; locked: boolean }> = ({
  value,
  rolling,
  locked,
}) => {
  const safe = Math.max(0, Math.min(6, Math.floor(value)));
  const pips = DICE_PIP_POSITIONS[safe] || [];
  return (
    <div
      className={`relative flex h-20 w-20 items-center justify-center rounded-2xl border-[3px] border-amber-300 bg-gradient-to-br from-[#fffbeb] via-[#fef3c7] to-[#d97706] shadow-[0_12px_28px_rgba(0,0,0,0.85),inset_0_2px_6px_rgba(255,255,255,0.8)] sm:h-24 sm:w-24 ${
        rolling ? 'hs-dice-tumble' : locked ? 'hs-dice-lock-pop' : ''
      }`}
    >
      {safe === 0 ? (
        <span className="hs-title text-2xl font-black text-amber-800/80 sm:text-3xl">★</span>
      ) : (
        <svg viewBox="0 0 100 100" className="h-full w-full">
          {pips.map(([cx, cy], idx) => (
            <circle
              key={idx}
              cx={cx}
              cy={cy}
              r={safe === 1 ? 13 : 9.5}
              fill={safe === 1 ? '#dc2626' : '#1c1917'}
            />
          ))}
        </svg>
      )}
    </div>
  );
};

const ONLINE_CHALLENGER_POOL: {
  nickname: string;
  titleKo: string;
  titleEn: string;
  badgeIcon: string;
  tierLabelKo: string;
  tierLabelEn: string;
  heroClass: HeroClass;
  rating: number;
  equippedFrameId: string;
  equippedCardBack: 'gold' | 'silver' | 'bronze' | 'ocarina_crest' | 'bogart_vip';
  frameNameKo: string;
  frameNameEn: string;
  cardBackNameKo: string;
  cardBackNameEn: string;
}[] = [
  { nickname: '별빛성기사#4821', titleKo: '엘윈 성소의 수호자', titleEn: 'Guardian of Elwin', badgeIcon: '🎵', tierLabelKo: '골드 II', tierLabelEn: 'Gold II', heroClass: 'PALADIN', rating: 1640, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'ocarina_crest', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
  { nickname: 'FrostMage_KR', titleKo: '엘윈 대평원의 전설', titleEn: 'Legend of Elwin Plain', badgeIcon: '👑', tierLabelKo: '다이아 IV', tierLabelEn: 'Diamond IV', heroClass: 'MAGE', rating: 1890, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'gold', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: '붉은성채타짜#777', titleKo: '보가트 도박장 승부사', titleEn: 'Bogart Hall High-Roller', badgeIcon: '🎲', tierLabelKo: '플래티넘 I', tierLabelEn: 'Platinum I', heroClass: 'WARRIOR', rating: 1750, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'bogart_vip', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '보가트 VIP 황금주화', cardBackNameEn: 'Bogart VIP Gold' },
  { nickname: 'ShadowBlade99', titleKo: '심연 정복자', titleEn: 'Abyss Conqueror', badgeIcon: '🛡️', tierLabelKo: '골드 I', tierLabelEn: 'Gold I', heroClass: 'ROGUE', rating: 1685, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'silver', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '별빛 실버 엠블럼', cardBackNameEn: 'Starlight Silver' },
  { nickname: '바람섬명궁#305', titleKo: '엘윈의 모험가', titleEn: 'Adventurer of Elwin', badgeIcon: '❄️', tierLabelKo: '실버 I', tierLabelEn: 'Silver I', heroClass: 'HUNTER', rating: 1520, equippedFrameId: 'frame_classic', equippedCardBack: 'bronze', frameNameKo: '참나무 클래식 프레임', frameNameEn: 'Classic Oak Frame', cardBackNameKo: '성소 브론즈 인장', cardBackNameEn: 'Sanctuary Bronze' },
  { nickname: 'ElwinSage', titleKo: '3배 각성의 지배자', titleEn: 'Sovereign of 3x Awakening', badgeIcon: '🎵', tierLabelKo: '다이아 II', tierLabelEn: 'Diamond II', heroClass: 'PRIEST', rating: 1940, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'ocarina_crest', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
  { nickname: 'DeepforgeKing', titleKo: '성소의 연대기 학자', titleEn: 'Sanctuary Chronicler', badgeIcon: '🛡️', tierLabelKo: '플래티넘 III', tierLabelEn: 'Platinum III', heroClass: 'WARLOCK', rating: 1710, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'gold', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: '늑대왕의후예#812', titleKo: '엘윈 성소의 수호자', titleEn: 'Guardian of Elwin', badgeIcon: '👑', tierLabelKo: '골드 III', tierLabelEn: 'Gold III', heroClass: 'DRUID', rating: 1605, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'silver', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '별빛 실버 엠블럼', cardBackNameEn: 'Starlight Silver' },
  { nickname: 'StormTotem_EN', titleKo: '보가트 도박장 승부사', titleEn: 'Bogart Hall High-Roller', badgeIcon: '🎲', tierLabelKo: '플래티넘 II', tierLabelEn: 'Platinum II', heroClass: 'SHAMAN', rating: 1735, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'bogart_vip', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '보가트 VIP 황금주화', cardBackNameEn: 'Bogart VIP Gold' },
  { nickname: '은빛성검단#1024', titleKo: '운명의 오카리나 계승자', titleEn: 'Heir of the Ocarina', badgeIcon: '🎵', tierLabelKo: '다이아 III', tierLabelEn: 'Diamond III', heroClass: 'PRIEST', rating: 1910, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'ocarina_crest', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
  { nickname: 'IgnisFury_US', titleKo: '3배 각성의 지배자', titleEn: 'Sovereign of 3x Awakening', badgeIcon: '🔥', tierLabelKo: '다이아 I', tierLabelEn: 'Diamond I', heroClass: 'WARRIOR', rating: 1980, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'gold', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: '설원추적자#219', titleKo: '엘윈의 모험가', titleEn: 'Adventurer of Elwin', badgeIcon: '❄️', tierLabelKo: '실버 II', tierLabelEn: 'Silver II', heroClass: 'HUNTER', rating: 1495, equippedFrameId: 'frame_classic', equippedCardBack: 'silver', frameNameKo: '참나무 클래식 프레임', frameNameEn: 'Classic Oak Frame', cardBackNameKo: '별빛 실버 엠블럼', cardBackNameEn: 'Starlight Silver' },
  { nickname: 'RuneWeaver77', titleKo: '성소의 연대기 학자', titleEn: 'Sanctuary Chronicler', badgeIcon: '📜', tierLabelKo: '골드 II', tierLabelEn: 'Gold II', heroClass: 'MAGE', rating: 1650, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'ocarina_crest', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
  { nickname: '아케근위대장#550', titleKo: '엘윈 성소의 수호자', titleEn: 'Guardian of Elwin', badgeIcon: '🛡️', tierLabelKo: '플래티넘 IV', tierLabelEn: 'Platinum IV', heroClass: 'PALADIN', rating: 1705, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'gold', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: 'Nightfang_JP', titleKo: '보가트 도박장 승부사', titleEn: 'Bogart Hall High-Roller', badgeIcon: '🎲', tierLabelKo: '플래티넘 I', tierLabelEn: 'Platinum I', heroClass: 'ROGUE', rating: 1790, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'bogart_vip', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '보가트 VIP 황금주화', cardBackNameEn: 'Bogart VIP Gold' },
  { nickname: '녹옥숲지기#643', titleKo: '엘윈 성소의 수호자', titleEn: 'Guardian of Elwin', badgeIcon: '🌿', tierLabelKo: '골드 IV', tierLabelEn: 'Gold IV', heroClass: 'DRUID', rating: 1580, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'bronze', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '성소 브론즈 인장', cardBackNameEn: 'Sanctuary Bronze' },
  { nickname: 'IronAnvil_EU', titleKo: '3배 각성의 지배자', titleEn: 'Sovereign of 3x Awakening', badgeIcon: '⚒️', tierLabelKo: '플래티넘 II', tierLabelEn: 'Platinum II', heroClass: 'WARLOCK', rating: 1745, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'gold', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: '해심비전술사#901', titleKo: '운명의 오카리나 계승자', titleEn: 'Heir of the Ocarina', badgeIcon: '🌊', tierLabelKo: '다이아 IV', tierLabelEn: 'Diamond IV', heroClass: 'MAGE', rating: 1865, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'ocarina_crest', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
  { nickname: 'GaleArcher_TW', titleKo: '엘윈 대평원의 전설', titleEn: 'Legend of Elwin Plain', badgeIcon: '👑', tierLabelKo: '다이아 II', tierLabelEn: 'Diamond II', heroClass: 'HUNTER', rating: 1930, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'gold', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: '대지정령왕#338', titleKo: '보가트 도박장 승부사', titleEn: 'Bogart Hall High-Roller', badgeIcon: '🎲', tierLabelKo: '골드 I', tierLabelEn: 'Gold I', heroClass: 'SHAMAN', rating: 1675, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'bogart_vip', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '보가트 VIP 황금주화', cardBackNameEn: 'Bogart VIP Gold' },
  { nickname: 'OcarinaKnight', titleKo: '운명의 오카리나 계승자', titleEn: 'Heir of the Ocarina', badgeIcon: '🎵', tierLabelKo: '플래티넘 I', tierLabelEn: 'Platinum I', heroClass: 'PRIEST', rating: 1810, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'ocarina_crest', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
  { nickname: '검은재단암살자#411', titleKo: '성소의 연대기 학자', titleEn: 'Sanctuary Chronicler', badgeIcon: '🗡️', tierLabelKo: '골드 III', tierLabelEn: 'Gold III', heroClass: 'ROGUE', rating: 1615, equippedFrameId: 'frame_classic', equippedCardBack: 'silver', frameNameKo: '참나무 클래식 프레임', frameNameEn: 'Classic Oak Frame', cardBackNameKo: '별빛 실버 엠블럼', cardBackNameEn: 'Starlight Silver' },
  { nickname: 'SolarPaladin_BR', titleKo: '엘윈 성소의 수호자', titleEn: 'Guardian of Elwin', badgeIcon: '☀️', tierLabelKo: '플래티넘 III', tierLabelEn: 'Platinum III', heroClass: 'PALADIN', rating: 1720, equippedFrameId: 'frame_zelda_brass', equippedCardBack: 'gold', frameNameKo: '성소 이중 황동 프레임', frameNameEn: 'Sanctuary Brass Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: '황금고블린VIP#888', titleKo: '보가트 도박장 승부사', titleEn: 'Bogart Hall High-Roller', badgeIcon: '🪙', tierLabelKo: '다이아 III', tierLabelEn: 'Diamond III', heroClass: 'WARLOCK', rating: 1905, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'bogart_vip', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '보가트 VIP 황금주화', cardBackNameEn: 'Bogart VIP Gold' },
  { nickname: 'SilverLeaf_CA', titleKo: '성소의 연대기 학자', titleEn: 'Sanctuary Chronicler', badgeIcon: '🍃', tierLabelKo: '골드 II', tierLabelEn: 'Gold II', heroClass: 'HUNTER', rating: 1635, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'silver', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '별빛 실버 엠블럼', cardBackNameEn: 'Starlight Silver' },
  { nickname: '심연파괴자#709', titleKo: '3배 각성의 지배자', titleEn: 'Sovereign of 3x Awakening', badgeIcon: '⚡', tierLabelKo: '플래티넘 I', tierLabelEn: 'Platinum I', heroClass: 'WARRIOR', rating: 1785, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'gold', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: 'StarfallDruid', titleKo: '운명의 오카리나 계승자', titleEn: 'Heir of the Ocarina', badgeIcon: '🌙', tierLabelKo: '다이아 IV', tierLabelEn: 'Diamond IV', heroClass: 'DRUID', rating: 1855, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'ocarina_crest', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
  { nickname: '번개토템장인#156', titleKo: '엘윈의 모험가', titleEn: 'Adventurer of Elwin', badgeIcon: '⛈️', tierLabelKo: '실버 I', tierLabelEn: 'Silver I', heroClass: 'SHAMAN', rating: 1545, equippedFrameId: 'frame_classic', equippedCardBack: 'bronze', frameNameKo: '참나무 클래식 프레임', frameNameEn: 'Classic Oak Frame', cardBackNameKo: '성소 브론즈 인장', cardBackNameEn: 'Sanctuary Bronze' },
  { nickname: 'SanctuaryAce_DE', titleKo: '엘윈 대평원의 전설', titleEn: 'Legend of Elwin Plain', badgeIcon: '👑', tierLabelKo: '다이아 I', tierLabelEn: 'Diamond I', heroClass: 'PRIEST', rating: 1995, equippedFrameId: 'frame_royal_24k', equippedCardBack: 'gold', frameNameKo: '24K 로얄 골드 프레임', frameNameEn: '24K Royal Gold Frame', cardBackNameKo: '눈히어로 24K 골드', cardBackNameEn: 'SNSHero 24K Gold' },
  { nickname: '얼음왕관수호병#620', titleKo: '엘윈 성소의 수호자', titleEn: 'Guardian of Elwin', badgeIcon: '❄️', tierLabelKo: '플래티넘 III', tierLabelEn: 'Platinum III', heroClass: 'MAGE', rating: 1715, equippedFrameId: 'frame_sapphire_rune', equippedCardBack: 'ocarina_crest', frameNameKo: '사파이어 룬 프레임', frameNameEn: 'Sapphire Rune Frame', cardBackNameKo: '엘윈 성소의 문장', cardBackNameEn: 'Elwin Sanctuary Crest' },
];

export function rollOnlineChallenger(preferredClass?: HeroClass, isBogart = false): {
  opponentClass: HeroClass;
  meta: ChallengerMeta;
} {
  if (isBogart) {
    const cls = preferredClass || HERO_CLASS_ORDER[Math.floor(Math.random() * HERO_CLASS_ORDER.length)];
    return {
      opponentClass: cls,
      meta: {
        nickname: '도박왕 보가트#VIP',
        titleKo: '지하 도박장의 고블린 군주',
        titleEn: 'Goblin Casino King',
        badgeIcon: '🎲',
        tierLabelKo: '100% 랜덤 30장 덱',
        tierLabelEn: '100% Random Deck',
        rating: 2000,
        equippedFrameId: 'frame_royal_24k',
        equippedCardBack: 'bogart_vip',
        frameNameKo: '24K 로얄 골드 프레임',
        frameNameEn: '24K Royal Gold Frame',
        cardBackNameKo: '보가트 VIP 황금주화',
        cardBackNameEn: 'Bogart VIP Gold',
      },
    };
  }
  const picked = ONLINE_CHALLENGER_POOL[Math.floor(Math.random() * ONLINE_CHALLENGER_POOL.length)];
  return {
    opponentClass: preferredClass || picked.heroClass,
    meta: {
      nickname: picked.nickname,
      titleKo: picked.titleKo,
      titleEn: picked.titleEn,
      badgeIcon: picked.badgeIcon,
      tierLabelKo: picked.tierLabelKo,
      tierLabelEn: picked.tierLabelEn,
      rating: picked.rating,
      equippedFrameId: picked.equippedFrameId,
      equippedCardBack: picked.equippedCardBack,
      frameNameKo: picked.frameNameKo,
      frameNameEn: picked.frameNameEn,
      cardBackNameKo: picked.cardBackNameKo,
      cardBackNameEn: picked.cardBackNameEn,
    },
  };
}

const SNS_SPINNER_TITLES_KO = [
  '가치 있는 맞수',
  '일곱 추적자 전승자',
  '녹옥회 정보원',
  '불꽃 성채 근위기사',
  '바람섬 풍궁사',
  '딥포지 대장장이',
  '엘윈마을 단골 승부사',
  '별빛 호흡 수련생',
  '아케 성기사단 분대장',
  '해심 비전 학자',
  '설원 영수 조련사',
  '눈히어로 결투장의 지배자',
];

const SNS_SPINNER_TITLES_EN = [
  'Worthy Opponent',
  'Heir of Seven Pursuers',
  'Jade Council Scout',
  'Flame Court Sentinel',
  'Wind Isle Marksman',
  'Deepforge Smith',
  'Elwin Village Regular',
  'Starlight Initiate',
  'Ake Paladin Captain',
  'Abyssal Arcane Scholar',
  'Snowfield Beast Tamer',
  'Elwin Arena Champion',
];

const BOGART_NARRATION_LINES = [
  {
    ko: '키히힉! 어서 와라, 여긴 9종족 수련과 합쳐진 『보가트의 도박장』이다! 일반(100~1,200G)과 숙련(×10배 · 1,000~12,000G) 난이도 중 골라 승부하고, 패배 시 판돈을 잃는 위험을 명심해라!',
    en: "Heh-heh! Welcome to Bogart's Hall — now merged with the 9-Faction Trial! Choose Normal (100–1,200G) or Expert (×10 · 1,000–12,000G), and remember losing forfeits your wager!",
  },
  {
    ko: '판돈은 네가 고르는 게 아니다! [대전 시작]을 누르면 주사위 2개가 굴러 1~12 눈금으로 배팅액이 자동 결정되고, 랜덤 9종족 대표와 즉시 격돌한다! 이기면 판돈 2배 + 종족 최초 제압 보상까지 챙겨라!',
    en: 'No manual betting here! Hit [Start Duel] to roll 2 dice (1–12) that auto-set your wager and launch straight into a random 9-Faction champion duel! Win for 2x Gold + First-Clear bonuses!',
  },
] as const;

const BogartNarrationOverlay: React.FC<{
  isKo: boolean;
  ownedGold: number;
  onConfirmEnter: () => void;
}> = ({ isKo, ownedGold, onConfirmEnter }) => {
  useRegisterNarrationOverlay(true);
  const [lineIdx, setLineIdx] = useState(0);
  const totalLines = BOGART_NARRATION_LINES.length;
  const safeIdx = Math.min(lineIdx, totalLines - 1);
  const speechText = isKo ? BOGART_NARRATION_LINES[safeIdx].ko : BOGART_NARRATION_LINES[safeIdx].en;
  const speakerLabel = tr('고블린 도박왕 보가트', 'Goblin Gambling King Bogart');

  const handleAutoNext = useCallback(() => {
    if (safeIdx + 1 < totalLines) {
      hsAudio.playSfx('card_hover', 0.6);
      setLineIdx((prev) => prev + 1);
    }
    // Stay on final warning line until user explicitly confirms or taps again!
  }, [safeIdx, totalLines]);

  const { displayedText, isTyping, talkBob, handleInteract } = useAnimaleseTypewriter({
    fullText: speechText,
    speakerLabel,
    speakerSide: 'RIGHT',
    resetKey: `bogart-narration:${safeIdx}:${isKo ? 'ko' : 'en'}`,
    isKo,
    enabled: true,
    onAutoAdvance: handleAutoNext,
  });

  const handleSceneClick = () => {
    if (isTyping) {
      handleInteract();
      return;
    }
    if (safeIdx + 1 < totalLines) {
      hsAudio.playSfx('card_hover', 0.65);
      setLineIdx((prev) => prev + 1);
      return;
    }
    hsAudio.playSfx('gem_a_confirm', 0.85);
    onConfirmEnter();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hsAudio.playSfx('ui_click', 0.75);
        onConfirmEnter();
      } else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleSceneClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div
      data-testid="bogart-narration-scene"
      data-narration-line={safeIdx + 1}
      onClick={(e) => {
        e.stopPropagation();
        handleSceneClick();
      }}
      className="fixed inset-0 z-[96] flex cursor-pointer select-none flex-col justify-between overflow-hidden bg-black/78"
    >
      {/* Dramatic Underground Tavern Gold & Crimson Vignette */}
      <div
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(245,158,11,0.22) 0%, rgba(69,10,10,0.45) 48%, rgba(8,5,3,0.92) 100%)',
        }}
        className="pointer-events-none absolute inset-0"
      />

      {/* Top Risk Warning Banner + 1-Tap Skip Button */}
      <div className="relative z-30 mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-5">
        <div
          data-testid="bogart-loss-risk-badge"
          className="flex items-center gap-2 rounded-full border-2 border-rose-400/85 bg-rose-950/90 px-3.5 py-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.85)]"
        >
          <span className="text-sm sm:text-base">⚠️</span>
          <span className="hs-title truncate text-xs font-extrabold tracking-wide text-rose-100 sm:text-sm">
            {tr(
              '도박장 주의 · 패배 시 베팅 골드 손실 위험!',
              'Gambling Hall Warning · Risk of Losing Wagered Gold!',
            )}
          </span>
        </div>

        <button
          type="button"
          data-testid="bogart-narration-skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            hsAudio.playSfx('ui_click', 0.75);
            onConfirmEnter();
          }}
          className="min-h-[44px] shrink-0 rounded-xl border border-amber-300/50 bg-stone-950/90 px-3.5 py-1.5 text-xs font-extrabold text-amber-100 shadow-lg transition hover:border-yellow-300 hover:text-yellow-200"
        >
          {tr('건너뛰기 ▸▸', 'SKIP ▸▸')}
        </button>
      </div>

      {/* Center HD Bogart Upper-Body Portrait (`>= 54%` Viewport Height, Waist-Up Above Dialogue Plate) */}
      <div
        data-testid="bogart-narration-portrait"
        style={{
          transformOrigin: 'bottom center',
          transform: `translate3d(-50%, ${talkBob ? '-7px' : '0px'}, 0)`,
          transition: 'transform 130ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        className="pointer-events-none absolute bottom-[148px] left-1/2 z-20 flex h-[54%] items-end justify-center sm:bottom-[162px] sm:h-[60%]"
      >
        <img
          src="/hs-assets/upper-hd/bogart_dealer.webp"
          alt={speakerLabel}
          decoding="async"
          draggable={false}
          className="h-full w-auto max-w-none select-none object-contain"
        />
      </div>

      {/* Bottom Narration Dialogue Box + Confirm Risk & Enter CTA */}
      <div className="relative z-30 mx-auto mb-4 w-full max-w-2xl px-3 sm:mb-7 sm:px-6">
        {/* Top Dark Trapezoid Speaker Nameplate */}
        <div
          className="relative z-10 mx-auto -mb-3 flex w-fit min-w-[168px] items-center justify-center gap-1.5 px-6 py-1.5 text-center shadow-md"
          style={{
            backgroundColor: '#231612',
            border: '1px solid rgba(251,191,36,0.55)',
            clipPath: 'polygon(7% 0%, 93% 0%, 100% 100%, 0% 100%)',
          }}
        >
          <span>🎲</span>
          <span className="truncate text-xs font-extrabold tracking-wide text-yellow-200 sm:text-sm">
            {speakerLabel}
          </span>
        </div>

        {/* Cream-White Sanctuary Dialogue Plate */}
        <div className="relative rounded-[14px] border-2 border-amber-400/80 bg-[#f5f1e6] px-4 pb-4 pt-5 text-left shadow-[0_20px_48px_rgba(0,0,0,0.92)] sm:px-6 sm:pb-5 sm:pt-6">
          <p
            data-testid="bogart-narration-text"
            data-full-text={speechText}
            aria-label={speechText}
            className="relative min-h-[60px] text-[13.5px] font-extrabold leading-relaxed text-[#1e1510] sm:min-h-[56px] sm:text-[15px]"
          >
            {displayedText}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-300 pt-2.5">
            <div className="text-[11px] font-extrabold text-rose-800 sm:text-xs">
              {safeIdx + 1} / {totalLines} ·{' '}
              {tr(
                `현재 보유 ${ownedGold.toLocaleString()}G · 주사위 2개 자동배팅 (일반 100~1,200G / 숙련 1,000~12,000G)`,
                `Owned ${ownedGold.toLocaleString()}G · 2-Dice Auto-Bet (Normal 100–1,200G / Expert 1K–12K G)`,
              )}
            </div>

            <button
              type="button"
              data-testid="bogart-narration-confirm-btn"
              onClick={(e) => {
                e.stopPropagation();
                hsAudio.playSfx('gem_a_confirm', 0.9);
                onConfirmEnter();
              }}
              className="hs-mario-spring min-h-[44px] rounded-xl border-2 border-amber-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 px-4 py-2 text-xs font-black text-stone-950 shadow-lg sm:text-sm"
            >
              {tr('⚠️ 위험 확인 · 도박장 입장', '⚠️ Understand Risk · Enter Hall')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const HeroDeckSelectScreen: React.FC<HeroDeckSelectScreenProps> = ({
  initialMode,
  onBack,
  onEditDecks,
  onLaunchBattle,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const spinnerTitles = isKo ? SNS_SPINNER_TITLES_KO : SNS_SPINNER_TITLES_EN;
  const [decks, setDecks] = useState<CustomDeck[]>(() => hsStorage.getDecks());
  const [profile, setProfile] = useState(() => hsStorage.getProfile());

  useEffect(() => {
    const sync = () => {
      setDecks(hsStorage.getDecks());
      setProfile(hsStorage.getProfile());
    };
    window.addEventListener('snshero:state-changed', sync);
    return () => window.removeEventListener('snshero:state-changed', sync);
  }, []);

  const [mode] = useState<GameMode>(initialMode);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0]?.id || 'preset_priest');
  const [practiceOpponentClass, setPracticeOpponentClass] = useState<HeroClass>('WARRIOR');
  const [boardTheme, setBoardTheme] = useState<BoardThemeId | 'RANDOM'>('RANDOM');

  // Ranked Realtime Matchmaking state
  const [rankedStakeGold, setRankedStakeGold] = useState<number>(0);
  const [rankedSearchElapsed, setRankedSearchElapsed] = useState<number>(0);
  const [rankedTimeoutPopupOpen, setRankedTimeoutPopupOpen] = useState<boolean>(false);
  const [rankedToast, setRankedToast] = useState<string | null>(null);
  const activeRankedRoomIdRef = useRef<string | null>(null);
  const rankedMatchTimeoutSec = useMemo(() => {
    if (typeof window === 'undefined') return 60;
    const raw = new URLSearchParams(window.location.search).get('matchTimeoutSec');
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isNaN(parsed) && parsed >= 2 && parsed <= 120) return Math.floor(parsed);
    return 60;
  }, []);

  // Bogart + 9-Faction Trial merged state
  const [bogartTier, setBogartTier] = useState<'NORMAL' | 'EXPERT'>('NORMAL');
  const [bogartNarrationOpen, setBogartNarrationOpen] = useState<boolean>(
    () => initialMode === 'BOGART_GAMBLE',
  );
  const [bogartToast, setBogartToast] = useState<string | null>(null);
  const [bogartRollPhase, setBogartRollPhase] = useState<'IDLE' | 'ROLLING' | 'LOCKED' | 'VORTEX'>('IDLE');
  const [bogartDicePair, setBogartDicePair] = useState<[number, number]>([3, 4]);
  const [bogartRolledTotal, setBogartRolledTotal] = useState<number>(7);
  const [bogartRolledStake, setBogartRolledStake] = useState<number>(700);
  const [bogartRolledAllIn, setBogartRolledAllIn] = useState<boolean>(false);
  const [bogartRolledOpponent, setBogartRolledOpponent] = useState<HeroClass>('WARRIOR');
  const bogartTimersRef = useRef<number[]>([]);

  const [matchedChallenger, setMatchedChallenger] = useState<{
    opponentClass: HeroClass;
    meta: ChallengerMeta;
  } | null>(null);

  const [matching, setMatching] = useState(false);
  const [wheelIndex, setWheelIndex] = useState(0);
  const [wheelLocked, setWheelLocked] = useState(false);

  const selectedDeck = useMemo(
    () => decks.find((d) => d.id === selectedDeckId) || decks[0],
    [decks, selectedDeckId],
  );
  const hero = CLASSIC_HEROES[selectedDeck.heroClass];
  const heroLoc = getLocalizedHeroInfo(selectedDeck.heroClass, lang);
  const selectedDeckLabel = getDeckDisplayName(selectedDeck, lang);
  const rewardGuide = getModeRewardGuide(mode, isKo);
  const isPractice = mode === 'PRACTICE_NORMAL' || mode === 'PRACTICE_EXPERT';
  const isBogart = mode === 'BOGART_GAMBLE';
  const isRanked = mode === 'RANKED';
  const bogartUnitGold = bogartTier === 'EXPERT' ? 1000 : 100;
  const bogartMinRequiredGold = bogartUnitGold;
  const bogartMaxPossibleGold = bogartUnitGold * 12;

  const cancelActiveRankedRoom = useCallback(() => {
    const rid = activeRankedRoomIdRef.current;
    if (rid) {
      activeRankedRoomIdRef.current = null;
      snsheroLiveNetwork.cancelDuelRoom(rid);
      setProfile(hsStorage.getProfile());
    }
  }, []);

  const handleCancelMatchmaking = useCallback(() => {
    if (wheelLocked) return;
    if (isRanked) {
      cancelActiveRankedRoom();
    }
    hsAudio.playSfx('gem_b_back');
    setMatching(false);
    setRankedSearchElapsed(0);
  }, [wheelLocked, isRanked, cancelActiveRankedRoom]);

  useModalDismiss(matching && !wheelLocked, handleCancelMatchmaking);

  // Clean up hosted Ranked matchmaking room or Bogart dice timers on unmount
  useEffect(() => {
    return () => {
      if (activeRankedRoomIdRef.current) {
        snsheroLiveNetwork.cancelDuelRoom(activeRankedRoomIdRef.current);
        activeRankedRoomIdRef.current = null;
      }
      for (const t of bogartTimersRef.current) {
        window.clearTimeout(t);
        window.clearInterval(t);
      }
      bogartTimersRef.current = [];
    };
  }, []);

  const selectedDeckStats = useMemo(() => {
    const curve = [0, 0, 0, 0, 0, 0, 0, 0];
    let minions = 0;
    let spells = 0;
    let weapons = 0;
    for (const cid of selectedDeck.cards) {
      const def = cardDb.getCard(cid);
      if (!def) continue;
      curve[Math.min(7, def.cost)] += 1;
      if (def.type === 'MINION') minions += 1;
      else if (def.type === 'SPELL') spells += 1;
      else if (def.type === 'WEAPON') weapons += 1;
    }
    return { curve, minions, spells, weapons };
  }, [selectedDeck]);

  // Realtime Ranked Matchmaking Wheel + 60s Timeout + Simultaneous Room Tie-Breaker
  useEffect(() => {
    if (!matching || !isRanked) return;

    setRankedSearchElapsed(0);

    // Wheel spin ticker
    const wheelTimer = window.setInterval(() => {
      setWheelIndex((prev) => (prev + 1) % spinnerTitles.length);
    }, 150);

    // 1-second elapsed countdown to 60s timeout
    const startTs = Date.now();
    const timeoutInterval = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTs) / 1000);
      setRankedSearchElapsed(elapsedSec);
      if (elapsedSec >= rankedMatchTimeoutSec) {
        window.clearInterval(timeoutInterval);
        window.clearInterval(wheelTimer);
        cancelActiveRankedRoom();
        hsAudio.playSfx('gem_b_back', 0.85);
        setMatching(false);
        setRankedSearchElapsed(0);
        setRankedTimeoutPopupOpen(true);
      }
    }, 500);

    // Listen for live opponent Ranked room appearing while searching (auto-join tie-breaker)
    let joinedOther = false;
    const tryAutoJoin = () => {
      if (joinedOther) return;
      const candidate = snsheroLiveNetwork.findMatchingRankedRoom(rankedStakeGold);
      if (!candidate) return;
      const myPeerId = snsheroLiveNetwork.getSnapshot().peerId;
      // If both players created rooms simultaneously, lexicographically larger peerId cancels & joins the other
      if (!activeRankedRoomIdRef.current || myPeerId > candidate.hostPeerId) {
        joinedOther = true;
        cancelActiveRankedRoom();
        const joinRes = snsheroLiveNetwork.joinDuelRoom(candidate, selectedDeck);
        if (!joinRes.ok) {
          joinedOther = false;
        }
      }
    };

    tryAutoJoin();
    const unsubNet = snsheroLiveNetwork.subscribe(tryAutoJoin);

    // When match starts, clear ref so unmount cleanup does NOT cancel the active room!
    const unsubStart = snsheroLiveNetwork.onMatchStart(() => {
      activeRankedRoomIdRef.current = null;
      setMatching(false);
    });

    return () => {
      window.clearInterval(wheelTimer);
      window.clearInterval(timeoutInterval);
      unsubNet();
      unsubStart();
    };
  }, [
    matching,
    isRanked,
    rankedStakeGold,
    rankedMatchTimeoutSec,
    selectedDeck,
    spinnerTitles.length,
    cancelActiveRankedRoom,
  ]);

  // Legacy AI Matchmaking Wheel (for PRACTICE / TUTORIAL modes if ever opened directly)
  useEffect(() => {
    if (!matching || isRanked || isBogart) return;
    let tick = 0;
    const maxTicks = 15;
    let timer: number;

    const step = () => {
      tick += 1;
      if (tick < maxTicks) {
        setWheelIndex((prev) => (prev + 1) % spinnerTitles.length);
        hsAudio.playSfx('ui_hover', 0.45);
        timer = window.setTimeout(step, 58 + tick * 10);
      } else {
        setWheelIndex(0);
        setWheelLocked(true);
        hsAudio.playSfx('rank_radar_lock', 0.95);
        timer = window.setTimeout(() => {
          const challenger =
            matchedChallenger ||
            rollOnlineChallenger(isPractice ? practiceOpponentClass : undefined, false);
          onLaunchBattle({
            mode,
            deck: selectedDeck,
            preferredOpponentClass: isPractice
              ? practiceOpponentClass
              : challenger.opponentClass,
            boardTheme: boardTheme === 'RANDOM' ? undefined : boardTheme,
            challengerMeta: undefined,
          });
        }, 880);
      }
    };

    timer = window.setTimeout(step, 80);
    return () => clearTimeout(timer);
  }, [
    matching,
    isRanked,
    isBogart,
    mode,
    selectedDeck,
    isPractice,
    matchedChallenger,
    practiceOpponentClass,
    boardTheme,
    onLaunchBattle,
    spinnerTitles.length,
  ]);

  const startBogartDiceSequence = () => {
    if (bogartRollPhase !== 'IDLE') return;
    const currentProfile = hsStorage.getProfile();
    if (currentProfile.gold < bogartMinRequiredGold) {
      hsAudio.playSfx('gem_b_back', 0.85);
      setBogartToast(
        tr(
          `${bogartTier === 'EXPERT' ? '숙련' : '일반'} 입장 최소 골드(${bogartMinRequiredGold.toLocaleString()}G)가 부족합니다! (보유 ${currentProfile.gold.toLocaleString()}G)`,
          `Need at least ${bogartMinRequiredGold.toLocaleString()}G for ${bogartTier === 'EXPERT' ? 'Expert' : 'Normal'}! (Owned ${currentProfile.gold.toLocaleString()}G)`,
        ),
      );
      window.setTimeout(() => setBogartToast(null), 3200);
      return;
    }

    // Roll 2 dice total 1..12 + random 9-faction opponent
    const finalTotal = 1 + Math.floor(Math.random() * 12);
    const finalPair = splitDiceTotal1To12(finalTotal);
    const rawStake = finalTotal * bogartUnitGold;
    const actualStake = Math.min(rawStake, currentProfile.gold);
    const wasAllIn = actualStake < rawStake;
    const randomOpp = HERO_CLASS_ORDER[Math.floor(Math.random() * HERO_CLASS_ORDER.length)];

    hsAudio.playSfx('bogart_wager', 0.95);
    setBogartRollPhase('ROLLING');
    setBogartRolledAllIn(wasAllIn);

    // Rapid visual dice + faction shuffle during ROLLING
    const rollInterval = window.setInterval(() => {
      setBogartDicePair([
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6),
      ]);
      setBogartRolledOpponent(
        HERO_CLASS_ORDER[Math.floor(Math.random() * HERO_CLASS_ORDER.length)],
      );
      hsAudio.playSfx('ui_hover', 0.35);
    }, 95);
    bogartTimersRef.current.push(rollInterval);

    // Phase 2: LOCKED (show final 2 dice 1~12, auto-bet gold, random opponent)
    const lockTimer = window.setTimeout(() => {
      window.clearInterval(rollInterval);
      const wagerRes = hsStorage.placeBogartWager(actualStake);
      if (!wagerRes.ok) {
        setBogartRollPhase('IDLE');
        setBogartToast(tr('골드 예치에 실패했습니다.', 'Failed to escrow wager Gold.'));
        window.setTimeout(() => setBogartToast(null), 2800);
        return;
      }
      setProfile(hsStorage.getProfile());
      setBogartDicePair(finalPair);
      setBogartRolledTotal(finalTotal);
      setBogartRolledStake(actualStake);
      setBogartRolledOpponent(randomOpp);
      setBogartRollPhase('LOCKED');
      hsAudio.playSfx('rank_radar_lock', 0.95);
      hsAudio.playSfx('mario_coin', 0.8);

      // Phase 3: VORTEX (screen spins & sucks in!)
      const vortexTimer = window.setTimeout(() => {
        setBogartRollPhase('VORTEX');
        hsAudio.playSfx('box_disk_flip', 0.95);

        // Phase 4: Launch Battle against the random 9-faction champion
        const launchTimer = window.setTimeout(() => {
          const oppLoc = getLocalizedHeroInfo(randomOpp, lang);
          onLaunchBattle({
            mode: 'BOGART_GAMBLE',
            deck: selectedDeck,
            preferredOpponentClass: randomOpp,
            boardTheme: boardTheme === 'RANDOM' ? undefined : boardTheme,
            bogartStakeGold: actualStake,
            bogartDifficulty: bogartTier,
            challengerMeta: {
              nickname:
                bogartTier === 'EXPERT'
                  ? tr(`숙련 수련 · ${oppLoc.name}`, `Expert Trial · ${oppLoc.name}`)
                  : tr(`일반 수련 · ${oppLoc.name}`, `Normal Trial · ${oppLoc.name}`),
              titleKo: `${oppLoc.className} 9종족 수련 대표`,
              titleEn: `${oppLoc.className} 9-Faction Champion`,
              badgeIcon: bogartTier === 'EXPERT' ? '🔥' : '🎲',
              tierLabelKo: bogartTier === 'EXPERT' ? '숙련 ×10배' : '일반 수련',
              tierLabelEn: bogartTier === 'EXPERT' ? 'Expert ×10' : 'Normal Trial',
              rating: bogartTier === 'EXPERT' ? 2100 : 1650,
              equippedFrameId: bogartTier === 'EXPERT' ? 'frame_royal_24k' : 'frame_zelda_brass',
              equippedCardBack: 'bogart_vip',
              frameNameKo: '보가트 황금 프레임',
              frameNameEn: 'Bogart Gold Frame',
              cardBackNameKo: '보가트 VIP 황금주화',
              cardBackNameEn: 'Bogart VIP Gold',
            },
          });
        }, 850);
        bogartTimersRef.current.push(launchTimer);
      }, 1150);
      bogartTimersRef.current.push(vortexTimer);
    }, 1250);
    bogartTimersRef.current.push(lockTimer);
  };

  const handleStartClick = () => {
    if (!isBogart && selectedDeck.cards.length < 30) return;

    if (isBogart) {
      startBogartDiceSequence();
      return;
    }

    if (isRanked) {
      const currentProf = hsStorage.getProfile();
      if (rankedStakeGold > 0 && currentProf.gold < rankedStakeGold) {
        hsAudio.playSfx('gem_b_back', 0.85);
        setRankedToast(
          tr(
            `골드가 부족합니다! (선택 판돈 ${rankedStakeGold.toLocaleString()}G / 보유 ${currentProf.gold.toLocaleString()}G)`,
            `Not enough Gold! (Stake ${rankedStakeGold.toLocaleString()}G / Owned ${currentProf.gold.toLocaleString()}G)`,
          ),
        );
        window.setTimeout(() => setRankedToast(null), 2800);
        return;
      }

      snsheroLiveNetwork.init();
      hsAudio.playSfx('gem_a_confirm', 0.95);
      setRankedTimeoutPopupOpen(false);
      setWheelLocked(false);

      // Check if another player already opened a matching Ranked room with the exact same stake
      const existing = snsheroLiveNetwork.findMatchingRankedRoom(rankedStakeGold);
      if (existing) {
        const joinRes = snsheroLiveNetwork.joinDuelRoom(existing, selectedDeck);
        if (joinRes.ok) {
          activeRankedRoomIdRef.current = null;
          setMatching(true);
          return;
        }
      }

      // Otherwise create a live Ranked Duel Room & enter Wheel Loading screen
      const created = snsheroLiveNetwork.createDuelRoom({
        deck: selectedDeck,
        stakeGold: rankedStakeGold,
        scope: 'GLOBAL',
        isRankedMatchmaking: true,
      });
      if (!created.ok || !created.room) {
        hsAudio.playSfx('gem_b_back', 0.85);
        setRankedToast(
          created.error || tr('실시간 대전방 생성에 실패했습니다.', 'Failed to create live Duel Room.'),
        );
        window.setTimeout(() => setRankedToast(null), 2800);
        return;
      }

      activeRankedRoomIdRef.current = created.room.roomId;
      setProfile(hsStorage.getProfile());
      setMatching(true);
      return;
    }

    hsAudio.playSfx('gem_a_confirm', 0.95);
    setMatchedChallenger(
      rollOnlineChallenger(isPractice ? practiceOpponentClass : undefined, false),
    );
    setWheelLocked(false);
    setMatching(true);
  };

  return (
    <div
      style={{ backgroundImage: `url(${SNS_LOCATIONS.BOX_TABLE})` }}
      className="relative flex h-full w-full select-none flex-col justify-between overflow-hidden bg-cover bg-center p-2.5 sm:p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/65" />

      {/* Main Deck Select Wrapper (Spins & Sucks In during Bogart VORTEX transition) */}
      <div
        data-testid={bogartRollPhase === 'VORTEX' ? 'bogart-vortex-transition' : undefined}
        className={`relative z-20 flex min-h-0 flex-1 flex-col justify-between ${
          bogartRollPhase === 'VORTEX' ? 'hs-vortex-suck-in' : ''
        }`}
      >
      {/* Top Brass Bar (No 3-mode switcher tabs in Ranked / Bogart) */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            cancelActiveRankedRoom();
            hsAudio.playSfx('box_close');
            onBack();
          }}
          className="hs-brass-btn min-h-[40px] rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100 sm:px-4 sm:py-2 sm:text-sm"
        >
          ← {isKo ? <><span className="hidden sm:inline">엘윈마을 </span>로비로</> : <><span className="hidden sm:inline">Elwin </span>Hub</>}
        </button>

        {/* Focused Mode Title Pill (Mode Switcher Tabs Removed per Spec) */}
        <div
          data-testid="deck-select-mode-title"
          className="flex items-center gap-2 rounded-2xl border-2 border-[#c39c54] bg-stone-950/90 px-3.5 py-1.5 shadow-xl sm:px-4"
        >
          {isRanked ? (
            <>
              <SnsRankMedallion rank={profile.rank} size={18} />
              <span className="hs-title text-xs font-extrabold text-sky-200 sm:text-sm">
                🏆 {tr('실시간 랭킹대전', 'Live Ranked Arena')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-[4px] border border-white/80 bg-[#cc0000] px-2 py-0.5 text-[10px] font-black uppercase leading-none tracking-[0.14em] text-white shadow-[0_0_12px_rgba(220,38,38,0.9)]">
                <span className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-90" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                LIVE
              </span>
            </>
          ) : isBogart ? (
            <>
              <span className="text-sm">🎲</span>
              <span className="hs-title text-xs font-extrabold text-yellow-200 sm:text-sm">
                {tr('보가트 도박장 · 9종족 수련', "Bogart's Hall · 9-Faction Trial")}
              </span>
            </>
          ) : (
            <span className="text-xs font-extrabold text-emerald-300 sm:text-sm">
              {tr('스토리모드 · 카단의 여정', "Story Mode · Kadan's Journey")}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('ui_click');
            onEditDecks();
          }}
          className="hs-brass-btn flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        >
          <img
            src={CLASS_CREST_URL[selectedDeck.heroClass]}
            alt=""
            className="h-4 w-4 rounded-full object-cover sm:h-5 sm:w-5"
          />
          <span>{tr('덱 편집', 'Edit Decks')}</span>
        </button>
      </header>

      {/* Main Content: Scrollable on Mobile Portrait + Side-by-Side 12-Col on Desktop */}
      <main className="relative z-20 mx-auto my-2 grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 overflow-y-auto pr-0.5 lg:my-auto lg:flex-none lg:grid-cols-12 lg:gap-5 lg:overflow-visible">
        {/* Left 7 Cols: 9-Slot Faction Deck Selection Box (3x3 Visible on Mobile Portrait!) */}
        <section className="hs-wood-panel rounded-2xl p-3 sm:rounded-3xl sm:p-5 lg:col-span-7">
          <div className="mb-2 flex items-center justify-between border-b border-amber-500/25 pb-1.5 sm:mb-3 sm:pb-2">
            <h2 className="hs-title text-sm font-extrabold text-amber-100 sm:text-lg">
              {isBogart
                ? tr('출전 영웅 종족 선택 (매 판 30장 랜덤덱 자동 편성)', 'Choose Hero Faction (Fresh 30-Card Random Deck)')
                : tr('전투에 출전할 종족 덱 선택', 'Choose Your Faction Deck')}
            </h2>
            <span className="text-[11px] font-bold text-amber-300/85 sm:text-xs">
              {isBogart
                ? tr('🎲 양측 100% 랜덤 30장 덱', '🎲 100% Random 30-Card Decks')
                : isKo
                  ? `보유 덱 ${decks.length}개 · 30장 완료 덱 출전`
                  : `${decks.length} Decks · 30 Cards Required`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:max-h-[58vh] sm:gap-3 sm:overflow-y-auto sm:pr-1">
            {decks.map((d) => {
              const dh = CLASSIC_HEROES[d.heroClass];
              const dhLoc = getLocalizedHeroInfo(d.heroClass, lang);
              const isSelected = d.id === selectedDeck.id;
              const isComplete = d.cards.length === 30;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    hsAudio.playSfx('cm_select_hero', 0.7);
                    setSelectedDeckId(d.id);
                  }}
                  style={{ background: dh.frameGradient }}
                  className={`group relative flex flex-col items-center overflow-hidden rounded-xl border-[2.5px] p-2 text-left transition sm:rounded-2xl sm:border-[3px] sm:p-3 ${
                    isSelected
                      ? 'scale-[1.02] border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.85)]'
                      : 'border-[#b9934c]/70 opacity-90 hover:border-amber-300 hover:opacity-100'
                  }`}
                >
                  {/* Faction Crest Badge in Top-Right Corner */}
                  <img
                    src={CLASS_CREST_URL[d.heroClass]}
                    alt=""
                    className="absolute right-1.5 top-1.5 z-10 h-5 w-5 rounded-full border border-amber-200/80 object-cover shadow sm:right-2 sm:top-2 sm:h-6 sm:w-6"
                  />

                  <div
                    style={{ background: dh.frameGradient }}
                    className="relative h-14 w-14 overflow-hidden rounded-t-[28px] rounded-b-lg border-2 border-[#ebd08e] shadow-lg sm:h-20 sm:w-20 sm:rounded-t-[40px] sm:rounded-b-xl"
                  >
                    <img
                      src={getHeroArtUrl(dh.heroId)}
                      alt={dhLoc.name}
                      className="absolute left-1/2 top-[3%] h-[155%] w-[124%] max-w-none -translate-x-1/2 object-cover object-top transition group-hover:scale-108"
                    />
                  </div>

                  <div className="mt-1.5 w-full text-center sm:mt-2">
                    <div className="hs-outline-sm truncate text-[11px] font-extrabold text-white sm:text-xs">
                      {getDeckDisplayName(d, lang)}
                    </div>
                    <div className="mt-0.5 flex items-center justify-center gap-1 text-[9.5px] font-bold text-amber-200 sm:gap-1.5 sm:text-[10.5px]">
                      <span>{dhLoc.className}</span>
                      <span>·</span>
                      <span className={isComplete ? 'text-emerald-300' : 'text-red-300'}>
                        {d.cards.length}/30
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right 5 Cols: Champion Showcase, Rank/Opponent & Carved Swirl PLAY Button */}
        <section className="hs-wood-panel relative flex flex-col justify-between overflow-hidden rounded-2xl p-3.5 text-amber-100 sm:rounded-3xl sm:p-5 lg:col-span-5">
          {/* Subtle Faction Glow Backdrop */}
          <div
            style={{
              background: `radial-gradient(circle at 85% 15%, ${hero.accentColor}33 0%, transparent 62%)`,
            }}
            className="pointer-events-none absolute inset-0"
          />

          <div className="relative z-10 flex items-center gap-3 sm:gap-4">
            <div
              style={{ background: hero.frameGradient }}
              className="relative h-22 w-19 shrink-0 overflow-hidden rounded-t-[40px] rounded-b-xl border-[3px] border-[#e7c57c] shadow-[0_12px_26px_rgba(0,0,0,0.85)] sm:h-28 sm:w-24 sm:rounded-t-[50px] sm:border-[3.5px]"
            >
              <img
                src={getHeroArtUrl(hero.heroId)}
                alt={heroLoc.name}
                className="absolute left-1/2 top-[3%] h-[155%] w-[124%] max-w-none -translate-x-1/2 object-cover object-top"
              />
              <img
                src={CLASS_CREST_URL[selectedDeck.heroClass]}
                alt=""
                className="absolute bottom-1 right-1 h-5 w-5 rounded-full border border-amber-200 object-cover shadow sm:h-6 sm:w-6"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div
                style={{ color: hero.accentColor }}
                className="text-[11px] font-extrabold uppercase tracking-wider sm:text-xs"
              >
                {heroLoc.className} · {heroLoc.title}
              </div>
              <div className="hs-title hs-outline-sm truncate text-lg font-extrabold text-white sm:text-2xl">
                {heroLoc.name}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-bold text-amber-200 sm:text-xs">
                {tr(`출전 덱: ${selectedDeckLabel}`, `Active Deck: ${selectedDeckLabel}`)}
              </div>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#c8a158]/40 bg-black/45 px-2.5 py-1 text-[10.5px] leading-snug sm:mt-2 sm:py-1.5 sm:text-[11px]">
                <img
                  src={getHeroPowerArtUrl(hero.heroPowerId, hero.heroClass)}
                  alt={heroLoc.heroPowerName}
                  className="h-7 w-7 shrink-0 rounded-full border border-[#edd189]/80 object-cover shadow"
                />
                <div className="min-w-0">
                  <b className="text-sky-300">
                    {tr(`영웅 능력 [${heroLoc.heroPowerName}]:`, `Hero Power [${heroLoc.heroPowerName}]:`)}
                  </b>{' '}
                  {heroLoc.heroPowerText}
                </div>
              </div>
            </div>
          </div>

          {/* Selected Deck Mana Curve (0 ~ 7+) & Minion/Spell/Weapon Breakdown */}
          <div className="relative z-10 mt-2 rounded-2xl border border-[#c8a158]/40 bg-black/40 px-3 py-2">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-[10.5px] font-extrabold">
              <span className="text-amber-200">{tr('덱 마나 커브', 'Deck Mana Curve')}</span>
              <span className="text-sky-200">
                {tr('하수인', 'Minions')} {selectedDeckStats.minions} · {tr('주문', 'Spells')}{' '}
                {selectedDeckStats.spells}
                {selectedDeckStats.weapons > 0
                  ? ` · ${tr('무기', 'Weapons')} ${selectedDeckStats.weapons}`
                  : ''}
              </span>
            </div>
            <div className="flex h-11 items-end gap-1">
              {selectedDeckStats.curve.map((cnt, costBucket) => {
                const maxBar = Math.max(6, ...selectedDeckStats.curve);
                const hPct = Math.round((cnt / maxBar) * 100);
                return (
                  <div key={costBucket} className="flex flex-1 flex-col items-center">
                    <span className="mb-0.5 h-2.5 text-[8.5px] font-extrabold text-amber-200">
                      {cnt > 0 ? cnt : ''}
                    </span>
                    <div className="flex h-6 w-full items-end overflow-hidden rounded-t border border-amber-500/25 bg-stone-900/95">
                      <div
                        style={{ height: `${hPct}%` }}
                        className="w-full rounded-t bg-gradient-to-t from-blue-700 via-sky-500 to-sky-200 transition-all"
                      />
                    </div>
                    <span className="hs-num mt-0.5 text-[9px] text-sky-200">
                      {costBucket === 7 ? '7+' : costBucket}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Practice Opponent Picker OR Rank Medallion */}
          {isPractice ? (
            <div className="relative z-10 my-2 rounded-2xl border border-[#c8a158]/40 bg-black/40 p-2.5 sm:my-2.5 sm:p-3">
              <div className="mb-1.5 flex items-center justify-between gap-1 text-xs font-extrabold text-amber-200">
                <span>{tr('대전할 상대 종족 대표 선택', 'Choose Opponent Faction')}</span>
                <span className="text-[10.5px] font-bold text-emerald-300">
                  {tr('최초 제압:', 'First Clear:')}{' '}
                  {mode === 'PRACTICE_EXPERT'
                    ? profile.practiceExpertCleared.length
                    : profile.practiceNormalCleared.length}
                  {tr('/9종족', '/9 Factions')}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {HERO_CLASS_ORDER.map((hc) => {
                  const chLoc = getLocalizedHeroInfo(hc, lang);
                  const active = practiceOpponentClass === hc;
                  const alreadyCleared =
                    mode === 'PRACTICE_EXPERT'
                      ? profile.practiceExpertCleared.includes(hc)
                      : profile.practiceNormalCleared.includes(hc);
                  return (
                    <button
                      key={hc}
                      type="button"
                      onClick={() => {
                        hsAudio.playSfx('ui_click');
                        setPracticeOpponentClass(hc);
                      }}
                      className={`relative flex min-h-[36px] items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 text-[11px] font-extrabold transition sm:gap-1.5 sm:px-2 sm:text-xs ${
                        active
                          ? 'border-yellow-300 bg-gradient-to-b from-amber-600 to-amber-900 text-white shadow'
                          : 'border-stone-700 bg-stone-900/85 text-amber-100/80 hover:border-amber-500'
                      }`}
                    >
                      <img
                        src={CLASS_CREST_URL[hc]}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover"
                      />
                      <span className="truncate">{chLoc.className}</span>
                      {alreadyCleared && (
                        <span
                          title={tr('최초 제압 보상 수령 완료', 'First-clear reward claimed')}
                          className="ml-0.5 text-[10px] font-black text-emerald-300"
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : isBogart ? (
            <div
              data-testid="bogart-gambling-panel"
              className="hs-ocarina-dialog relative z-10 my-2 rounded-2xl p-3 text-amber-100 sm:my-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">🎲</span>
                  <span className="hs-title text-sm font-extrabold text-yellow-300 sm:text-base">
                    {tr('보가트 도박장 · 9종족 수련', "Bogart's Hall · 9-Faction Trial")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="bogart-replay-narration-btn"
                    onClick={() => {
                      hsAudio.playSfx('ui_click', 0.75);
                      setBogartNarrationOpen(true);
                    }}
                    className="rounded-full border border-rose-400/60 bg-rose-950/80 px-2 py-0.5 text-[10.5px] font-extrabold text-rose-200 hover:border-rose-300"
                  >
                    🎙 {tr('보가트 경고', 'Risk Warning')}
                  </button>
                  <span className="flex items-center gap-1 rounded-full border border-yellow-300/60 bg-black/55 px-2.5 py-0.5 text-xs font-extrabold text-yellow-200">
                    <HsGoldCoinIcon size={14} />
                    <span>{tr(`보유 ${profile.gold.toLocaleString()}G`, `Owned ${profile.gold.toLocaleString()}G`)}</span>
                  </span>
                </div>
              </div>

              {/* Normal (100~1,200G) vs Expert (x10: 1,000~12,000G) Difficulty Toggle */}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-testid="bogart-tier-normal"
                  onClick={() => {
                    hsAudio.playSfx('gem_c_select');
                    setBogartTier('NORMAL');
                  }}
                  className={`flex min-h-[54px] flex-col items-center justify-center rounded-xl border-2 px-2.5 py-1.5 text-center transition ${
                    bogartTier === 'NORMAL'
                      ? 'border-yellow-300 bg-gradient-to-b from-amber-500 to-amber-800 text-stone-950 shadow-[0_0_16px_rgba(250,204,21,0.55)]'
                      : 'border-amber-400/35 bg-stone-950/85 text-amber-100 hover:border-yellow-300/70'
                  }`}
                >
                  <span className="text-xs font-black sm:text-sm">
                    🎯 {tr('일반 수련', 'Normal Trial')}
                  </span>
                  <span
                    className={`mt-0.5 text-[10.5px] font-extrabold ${
                      bogartTier === 'NORMAL' ? 'text-stone-950/90' : 'text-amber-300'
                    }`}
                  >
                    {tr('주사위 ×100G (100~1,200G)', 'Dice ×100G (100–1,200G)')}
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="bogart-tier-expert"
                  onClick={() => {
                    hsAudio.playSfx('gem_c_select');
                    setBogartTier('EXPERT');
                  }}
                  className={`flex min-h-[54px] flex-col items-center justify-center rounded-xl border-2 px-2.5 py-1.5 text-center transition ${
                    bogartTier === 'EXPERT'
                      ? 'border-rose-300 bg-gradient-to-b from-rose-500 to-red-900 text-white shadow-[0_0_16px_rgba(244,63,94,0.55)]'
                      : 'border-rose-400/35 bg-stone-950/85 text-rose-100 hover:border-rose-300/70'
                  }`}
                >
                  <span className="text-xs font-black sm:text-sm">
                    🔥 {tr('숙련 수련 (×10배)', 'Expert Trial (×10)')}
                  </span>
                  <span
                    className={`mt-0.5 text-[10.5px] font-extrabold ${
                      bogartTier === 'EXPERT' ? 'text-yellow-200' : 'text-rose-300'
                    }`}
                  >
                    {tr('주사위 ×1,000G (1,000~12,000G)', 'Dice ×1,000G (1K–12K G)')}
                  </span>
                </button>
              </div>

              {/* Auto-Bet 2-Dice Info Strip (Manual betting removed!) */}
              <div
                data-testid="bogart-autobet-rule-strip"
                className="mt-2 rounded-xl border border-amber-400/45 bg-stone-950/90 px-3 py-2 text-[11px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-1 font-extrabold">
                  <span className="text-yellow-300">
                    🎲 {tr('주사위 2개(1~12) 자동 배팅 · 수동 베팅 불가', '2-Dice (1–12) Auto-Bet · No Manual Stake')}
                  </span>
                  <span className="text-emerald-300">
                    {tr(
                      `${bogartMinRequiredGold.toLocaleString()}~${bogartMaxPossibleGold.toLocaleString()}G`,
                      `${bogartMinRequiredGold.toLocaleString()}–${bogartMaxPossibleGold.toLocaleString()}G`,
                    )}
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] font-semibold text-amber-100/90">
                  {tr(
                    '[대전 시작]을 누르면 주사위 2개가 굴러 1~12 눈금으로 배팅액이 자동 설정되고, 랜덤 9종족 대표와 승부합니다! (승리 시 2배 + 최초 제압 보너스)',
                    'Press [Start Duel] to roll 2 dice (1–12) for an automatic stake and face a random 9-Faction champion! (Win 2x + First-Clear bonus)',
                  )}
                </p>
              </div>

              {/* 9-Faction Trial Progress Grid (Merged into Bogart's Hall) */}
              <div
                data-testid="bogart-9faction-progress"
                className="mt-2 rounded-xl border border-emerald-400/35 bg-black/45 px-2.5 py-2"
              >
                <div className="mb-1.5 flex items-center justify-between gap-1 text-[10.5px] font-extrabold">
                  <span className="text-emerald-200">
                    🛡️{' '}
                    {bogartTier === 'EXPERT'
                      ? tr('9종족 숙련 수련 격파 현황 (9/9 올클리어 시 +2팩!)', '9-Faction Expert Cleared (9/9 = +2 Packs!)')
                      : tr('9종족 일반 수련 격파 현황 (최초 제압 +25G)', '9-Faction Normal Cleared (+25G First Clear)')}
                  </span>
                  <span className="text-yellow-300">
                    {bogartTier === 'EXPERT'
                      ? profile.practiceExpertCleared.length
                      : profile.practiceNormalCleared.length}
                    /9
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {HERO_CLASS_ORDER.map((hc) => {
                    const chLoc = getLocalizedHeroInfo(hc, lang);
                    const cleared =
                      bogartTier === 'EXPERT'
                        ? profile.practiceExpertCleared.includes(hc)
                        : profile.practiceNormalCleared.includes(hc);
                    return (
                      <div
                        key={hc}
                        className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[10px] font-extrabold ${
                          cleared
                            ? 'border-emerald-400/70 bg-emerald-950/75 text-emerald-100'
                            : 'border-stone-700/80 bg-stone-900/75 text-amber-100/70'
                        }`}
                      >
                        <img
                          src={CLASS_CREST_URL[hc]}
                          alt=""
                          className="h-3.5 w-3.5 shrink-0 rounded-full object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate">{chLoc.className}</span>
                        {cleared && <span className="text-emerald-300">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Emergency Bailout when Gold < 100G */}
              {profile.gold < 100 && (
                <div
                  data-testid="bogart-bailout-strip"
                  className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/65 bg-emerald-950/85 px-3 py-2 text-xs font-extrabold text-emerald-100"
                >
                  <span>
                    🔥{' '}
                    {tr(
                      '입장 골드(100G)가 부족합니다! 일일 무료 구제 +100G 또는 요정 샘 +150G로 재도전하세요!',
                      'Need 100G to enter! Claim Daily Bailout (+100G) or Fairy Relief (+150G)!',
                    )}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {hsStorage.canClaimBogartDailyBailout() && (
                      <button
                        type="button"
                        data-testid="bogart-bailout-btn"
                        onClick={() => {
                          const res = hsStorage.claimBogartDailyBailout();
                          if (res.granted) {
                            hsAudio.playSfx('mario_coin', 0.95);
                            setProfile(hsStorage.getProfile());
                          }
                        }}
                        className="hs-zelda-b-btn min-h-[38px] rounded-xl px-3 py-1 text-xs font-black text-white shadow"
                      >
                        {tr('🪙 무료 구제 +100G', '🪙 Bailout +100G')}
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid="bogart-relief-chip-btn"
                      onClick={() => {
                        const res = hsStorage.claimBogartReliefChip();
                        if (res.granted) {
                          hsAudio.playSfx('ocarina_chime', 0.9);
                          hsAudio.playSfx('mario_coin', 0.95);
                          setProfile(hsStorage.getProfile());
                          setBogartToast(
                            tr(
                              `🧚 요정 샘 +150G 수령 완료! (오늘 잔여 ${res.remainingToday}회)`,
                              `🧚 +150G Fairy Relief claimed! (${res.remainingToday} left today)`,
                            ),
                          );
                          window.setTimeout(() => setBogartToast(null), 3200);
                        }
                      }}
                      className="min-h-[38px] rounded-xl border border-cyan-300/70 bg-cyan-950/90 px-3 py-1 text-xs font-black text-cyan-100"
                    >
                      🧚 {tr('요정 샘 +150G', 'Fairy +150G')}
                    </button>
                  </div>
                </div>
              )}

              {bogartToast && (
                <div className="mt-1.5 rounded-lg border border-yellow-300/70 bg-amber-950/90 px-2.5 py-1 text-center text-[11px] font-extrabold text-yellow-200">
                  {bogartToast}
                </div>
              )}
            </div>
          ) : (
            <div className="hs-ocarina-dialog relative z-10 my-2 rounded-2xl p-2.5 sm:my-2.5 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-sky-300 sm:text-[11px]">
                    <span>🏆 {tr('공식 실시간 랭킹대전 · 현재 등급', 'Official Live Ranked · Current Tier')}</span>
                    <span className="inline-flex items-center gap-1 rounded-[4px] border border-white/80 bg-[#cc0000] px-1.5 py-0.5 text-[9.5px] font-black uppercase leading-none tracking-[0.14em] text-white shadow-[0_0_10px_rgba(220,38,38,0.85)]">
                      <span className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-90" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      LIVE
                    </span>
                  </div>
                  <div className="hs-title text-base font-extrabold text-white sm:text-lg">
                    {profile.rank === 0
                      ? tr('전설의 눈히어로 (LEGEND)', 'SNSHero Legend')
                      : tr(
                          `${profile.rank}등급 · ${getRankTitle(profile.rank, CLASSIC_RANK_NAMES, lang)}`,
                          `Rank ${profile.rank} · ${getRankTitle(profile.rank, CLASSIC_RANK_NAMES, lang)}`,
                        )}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-amber-200/90 sm:text-[11px]">
                    {tr(
                      `공식 전적: ${profile.rankedWins || 0}승 ${Math.max(0, (profile.rankedGames || 0) - (profile.rankedWins || 0))}패 · 연승 ${profile.rankedWinStreak || 0} · 3승 보너스 ${profile.threeWinCounter}/3`,
                      `Official: ${profile.rankedWins || 0}W ${Math.max(0, (profile.rankedGames || 0) - (profile.rankedWins || 0))}L · Streak ${profile.rankedWinStreak || 0} · 3-Win ${profile.threeWinCounter}/3`,
                    )}
                  </div>
                </div>
                <SnsRankMedallion rank={profile.rank} size={48} className="shrink-0 drop-shadow" />
              </div>

              {/* Ranked Friendly (0G) / Gold Stake Selector */}
              <div
                data-testid="ranked-stake-selector"
                className="mt-2.5 rounded-xl border border-sky-400/40 bg-stone-950/90 p-2"
              >
                <div className="mb-1.5 flex items-center justify-between gap-1 text-[11px] font-extrabold">
                  <span className="text-sky-200">
                    ⚔ {tr('실시간 대전 방식 선택 (친선 / 골드)', 'Select Live Match Stake (Friendly / Gold)')}
                  </span>
                  <span className="flex items-center gap-1 text-yellow-300">
                    <HsGoldCoinIcon size={13} />
                    {profile.gold.toLocaleString()}G
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                  {RANKED_STAKE_OPTIONS.map((amt) => {
                    const active = rankedStakeGold === amt;
                    const cantAfford = amt > 0 && profile.gold < amt;
                    return (
                      <button
                        key={amt}
                        type="button"
                        data-testid={`ranked-stake-${amt}`}
                        disabled={cantAfford}
                        onClick={() => {
                          hsAudio.playSfx('gem_c_select');
                          setRankedStakeGold(amt);
                        }}
                        className={`min-h-[38px] rounded-lg border px-1.5 py-1 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-35 ${
                          active
                            ? amt === 0
                              ? 'border-emerald-200 bg-gradient-to-b from-emerald-400 to-teal-700 text-stone-950 shadow'
                              : 'border-yellow-200 bg-gradient-to-b from-yellow-300 to-amber-600 text-stone-950 shadow'
                            : 'border-amber-400/30 bg-stone-900 text-amber-100 hover:border-sky-300'
                        }`}
                      >
                        {amt === 0 ? tr('친선 0G', 'Friendly') : `${amt}G`}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10px] font-bold text-amber-200/85">
                  {rankedStakeGold === 0
                    ? tr(
                        '• 친선 실시간 랭킹전: 판돈 부담 없이 다른 유저와 실시간 1:1 매칭 (최대 1분 대기)',
                        '• Friendly Live Ranked: 0G wager real-time 1v1 matchmaking (up to 60s wait)',
                      )
                    : tr(
                        `• 골드 실시간 랭킹전 (${rankedStakeGold}G): 승리 시 상대 판돈 포함 +${rankedStakeGold * 2}G 획득!`,
                        `• Gold Live Ranked (${rankedStakeGold}G): Win +${rankedStakeGold * 2}G total pot!`,
                      )}
                </p>
              </div>

              {rankedToast && (
                <div className="mt-1.5 rounded-lg border border-rose-400/70 bg-rose-950/90 px-2.5 py-1 text-center text-[11px] font-extrabold text-rose-100">
                  {rankedToast}
                </div>
              )}
            </div>
          )}

          {/* Crystal-Clear Mode Victory Reward Guarantee Box */}
          <div className="relative z-10 mb-2 rounded-2xl border border-amber-400/50 bg-gradient-to-r from-[#231509]/95 via-[#1a1007]/95 to-[#120b05]/95 px-3 py-2 text-[11px] shadow-inner sm:mb-2.5">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 font-extrabold text-yellow-300">
                <HsGoldCoinIcon size={15} />
                <span>
                  {isKo
                    ? `[${rewardGuide.modeNameKo}] 확정 승리 보상`
                    : `[${rewardGuide.modeNameKo}] Guaranteed Win Reward`}
                </span>
              </div>
              <span className="rounded-md border border-sky-400/40 bg-sky-950/80 px-1.5 py-0.5 text-[10px] font-bold text-sky-200">
                {rewardGuide.playStyleBadge}
              </span>
            </div>
            <div className="mt-1 font-extrabold text-amber-100">
              • {tr('기본 보상:', 'Base Reward:')}{' '}
              <span className="text-yellow-200">{rewardGuide.baseWinRewardText}</span>
            </div>
            <div className="mt-0.5 text-[10.5px] font-semibold text-emerald-200/95">
              • {tr('추가 특전:', 'Extra Bonus:')} {rewardGuide.specialBonusText}
            </div>
          </div>

          {/* Battlefield Theme Selector */}
          <div className="relative z-10 mb-2.5 flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-[#c8a158]/35 bg-black/35 px-2.5 py-2 text-xs sm:mb-3 sm:px-3">
            <span className="font-bold text-amber-200">{tr('결투 전장', 'Battlefield')}</span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: 'RANDOM', label: tr('무작위', 'Random') },
                  { id: 'STORMWIND', label: tr('엘윈마을 설원', 'Elwin Snowfield') },
                  { id: 'ORGRIMMAR', label: tr('불꽃 성채', 'Flame Citadel') },
                  { id: 'PANDARIA', label: tr('바람의 신전', 'Wind Sanctuary') },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBoardTheme(b.id)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-bold transition ${
                    boardTheme === b.id
                      ? 'bg-gradient-to-b from-amber-500 to-amber-800 text-white shadow'
                      : 'bg-stone-900 text-amber-200/70 hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Carved-Stone Snow-Seal PLAY Medallion Button (Desktop Inside Right Panel) */}
          <div className="relative z-10 hidden flex-col items-center pt-1 lg:flex">
            <button
              type="button"
              data-testid="deck-select-play-btn"
              disabled={(!isBogart && selectedDeck.cards.length < 30) || bogartRollPhase !== 'IDLE'}
              onClick={handleStartClick}
              className={`${
                isBogart ? 'hs-zelda-c-btn' : 'hs-zelda-a-btn'
              } group relative flex w-full items-center justify-center gap-3 rounded-2xl py-3.5 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <SnsSnowCompassSeal
                size={42}
                className="drop-shadow-[0_0_12px_rgba(56,189,248,0.9)] transition group-hover:rotate-12 group-hover:scale-110"
              />
              <span className="hs-title hs-outline text-xl font-extrabold tracking-wider text-white sm:text-2xl">
                {isBogart
                  ? tr(
                      `🎲 대전 시작 (${bogartTier === 'EXPERT' ? '숙련 주사위 ×10' : '일반 주사위'})`,
                      `🎲 Start Duel (${bogartTier === 'EXPERT' ? 'Expert Dice ×10' : 'Normal Dice'})`,
                    )
                  : isRanked
                    ? rankedStakeGold === 0
                      ? tr('🏆 실시간 매칭 시작 (친선전)', '🏆 Start Live Match (Friendly)')
                      : tr(
                          `🏆 실시간 매칭 시작 (${rankedStakeGold}G)`,
                          `🏆 Start Live Match (${rankedStakeGold}G)`,
                        )
                    : tr('대전 시작', 'PLAY')}
              </span>
            </button>
          </div>
        </section>
      </main>

      {/* Always-Visible Docked Mobile/Tablet PLAY Button (`< lg`) */}
      <div className="relative z-30 mx-auto w-full max-w-6xl shrink-0 pt-1 lg:hidden">
        <button
          type="button"
          data-testid="deck-select-play-mobile-btn"
          disabled={(!isBogart && selectedDeck.cards.length < 30) || bogartRollPhase !== 'IDLE'}
          onClick={handleStartClick}
          className={`${
            isBogart ? 'hs-zelda-c-btn' : 'hs-zelda-a-btn'
          } group relative flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl py-2.5 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <SnsSnowCompassSeal
            size={34}
            className="drop-shadow-[0_0_12px_rgba(56,189,248,0.9)]"
          />
          <span className="hs-title hs-outline text-base font-extrabold tracking-wide text-white sm:text-lg">
            {isBogart
              ? tr(
                  `🎲 대전 시작 · 주사위 자동배팅 (${bogartTier === 'EXPERT' ? '숙련' : '일반'})`,
                  `🎲 Start Duel · Auto-Dice (${bogartTier === 'EXPERT' ? 'Expert' : 'Normal'})`,
                )
              : isRanked
                ? rankedStakeGold === 0
                  ? tr('🏆 실시간 매칭 (친선전)', '🏆 Live Match (Friendly)')
                  : tr(`🏆 실시간 매칭 (${rankedStakeGold}G)`, `🏆 Live Match (${rankedStakeGold}G)`)
                : tr('대전 시작', 'PLAY')}
          </span>
        </button>
      </div>
      </div>{/* End Main Deck Select Wrapper */}

      {/* Bogart Upper-Body Loss-Risk Narration Scene on Entry to Bogart's Gambling Hall */}
      {isBogart && bogartNarrationOpen && !matching && bogartRollPhase === 'IDLE' && (
        <BogartNarrationOverlay
          isKo={isKo}
          ownedGold={profile.gold}
          onConfirmEnter={() => setBogartNarrationOpen(false)}
        />
      )}

      {/* Bogart 2-Dice Auto-Bet & Vortex Suck-In Overlay */}
      {isBogart && bogartRollPhase !== 'IDLE' && (
        <div
          data-testid="bogart-dice-overlay"
          data-phase={bogartRollPhase}
          className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-black/82 p-4 backdrop-blur-sm"
        >
          {bogartRollPhase === 'VORTEX' && (
            <div className="hs-vortex-ring-spin pointer-events-none absolute h-[520px] w-[520px] rounded-full border-[10px] border-dashed border-amber-300/75 shadow-[0_0_90px_rgba(251,191,36,0.75)]" />
          )}

          <div
            className={`hs-ocarina-dialog relative flex w-full max-w-md flex-col items-center rounded-3xl border-2 border-amber-300/90 p-6 text-center shadow-[0_24px_60px_rgba(0,0,0,0.95)] sm:p-7 ${
              bogartRollPhase === 'VORTEX' ? 'hs-vortex-suck-in' : ''
            }`}
          >
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-950/85 px-3 py-0.5 text-[11px] font-black text-yellow-200">
              <span>{bogartTier === 'EXPERT' ? '🔥' : '🎲'}</span>
              <span>
                {bogartTier === 'EXPERT'
                  ? tr('숙련 수련 (×10배 · 1,000~12,000G)', 'Expert Trial (×10 · 1K–12K G)')
                  : tr('일반 수련 (100~1,200G)', 'Normal Trial (100–1,200G)')}
              </span>
            </div>

            <h3 className="hs-title hs-outline-sm text-lg font-extrabold text-yellow-200 sm:text-xl">
              {bogartRollPhase === 'ROLLING'
                ? tr('주사위 2개 굴리는 중...', 'Rolling 2 Dice...')
                : bogartRollPhase === 'LOCKED'
                  ? tr('배팅 금액 & 상대 종족 확정!', 'Wager & Opponent Locked!')
                  : tr('결투장으로 빨려들어갑니다!', 'Entering the Arena!')}
            </h3>

            {/* 2 Physical Dice Faces */}
            <div className="my-5 flex items-center justify-center gap-5">
              <BogartDieFace
                value={bogartDicePair[0]}
                rolling={bogartRollPhase === 'ROLLING'}
                locked={bogartRollPhase !== 'ROLLING'}
              />
              <span className="hs-title text-2xl font-black text-amber-300">+</span>
              <BogartDieFace
                value={bogartDicePair[1]}
                rolling={bogartRollPhase === 'ROLLING'}
                locked={bogartRollPhase !== 'ROLLING'}
              />
            </div>

            {/* Auto-Bet Amount Banner */}
            <div
              data-testid="bogart-rolled-stake-text"
              className="w-full rounded-2xl border-2 border-yellow-300/80 bg-stone-950/95 px-4 py-3 shadow-inner"
            >
              {bogartRollPhase === 'ROLLING' ? (
                <div className="text-sm font-extrabold text-amber-200">
                  {tr('1 ~ 12 눈금 자동 배팅 결정 중...', 'Determining 1–12 Auto-Bet...')}
                </div>
              ) : (
                <>
                  <div className="text-xs font-extrabold text-amber-300">
                    {tr(
                      `주사위 눈금 합계 ${bogartRolledTotal} × ${bogartUnitGold.toLocaleString()}G`,
                      `Dice Total ${bogartRolledTotal} × ${bogartUnitGold.toLocaleString()}G`,
                    )}
                    {bogartRolledAllIn && (
                      <span className="ml-1.5 rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">
                        {tr('올인 조정', 'ALL-IN CAP')}
                      </span>
                    )}
                  </div>
                  <div className="hs-num mt-1 flex items-center justify-center gap-1.5 text-2xl font-black text-yellow-300 sm:text-3xl">
                    <HsGoldCoinIcon size={24} />
                    <span>{bogartRolledStake.toLocaleString()}G</span>
                    <span className="text-sm font-extrabold text-emerald-300">
                      ({tr(`승리 +${(bogartRolledStake * 2).toLocaleString()}G`, `Win +${(bogartRolledStake * 2).toLocaleString()}G`)})
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Random 9-Faction Opponent Reveal */}
            {(() => {
              const oppHero = CLASSIC_HEROES[bogartRolledOpponent];
              const oppLoc = getLocalizedHeroInfo(bogartRolledOpponent, lang);
              return (
                <div
                  data-testid="bogart-rolled-opponent"
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-amber-400/45 bg-black/60 px-3.5 py-2.5 text-left"
                >
                  <img
                    src={getHeroArtUrl(oppHero.heroId)}
                    alt={oppLoc.name}
                    className="h-12 w-12 shrink-0 rounded-xl border-2 border-amber-300 object-cover object-top"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] font-bold text-amber-300">
                      {tr('랜덤 선택 9종족 상대', 'Random 9-Faction Opponent')}
                    </div>
                    <div className="truncate text-sm font-black text-white">
                      {oppLoc.className} · {oppLoc.name}
                    </div>
                  </div>
                  <img
                    src={CLASS_CREST_URL[bogartRolledOpponent]}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full border border-amber-200/80"
                  />
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Realtime Matchmaking Wheel Modal (Ranked Live Matchmaking + 60s Timer) */}
      {matching && (
        <div
          data-testid="matchmaking-wheel-modal"
          onClick={handleCancelMatchmaking}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hs-ocarina-dialog relative flex w-full max-w-md flex-col items-center rounded-3xl p-6 text-center sm:p-7"
          >
            {!wheelLocked && (
              <button
                type="button"
                data-testid="matchmaking-close-btn"
                onClick={handleCancelMatchmaking}
                aria-label={tr('탐색 취소 및 닫기', 'Cancel & Close')}
                className="hs-brass-btn absolute right-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-amber-100"
              >
                ✕
              </button>
            )}
            <SnsSnowCompassSeal
              size={52}
              spinning={!wheelLocked}
              className="mb-2 drop-shadow"
            />
            <div
              className={`hs-title hs-outline-sm mb-1.5 text-lg font-extrabold tracking-widest ${
                wheelLocked ? 'text-[#fef08a]' : 'text-[#fffbeb]'
              }`}
            >
              {isRanked
                ? tr('⚔ 실시간 랭킹 상대 탐색 중...', '⚔ Searching Live Ranked Opponent...')
                : wheelLocked
                  ? tr('⚔ 대결 상대를 찾았습니다!', '⚔ Opponent Locked In!')
                  : tr('대결 상대 탐색 중...', 'Searching for Opponent...')}
            </div>

            {isRanked && (
              <div className="mb-2 flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold">
                <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-white/85 bg-[#cc0000] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-[0_0_14px_rgba(220,38,38,0.9)]">
                  <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-90" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  LIVE · {rankedStakeGold === 0 ? tr('친선 0G', 'Friendly 0G') : `${rankedStakeGold}G`}
                </span>
                <span
                  data-testid="ranked-search-timer"
                  className="hs-num rounded-full border border-amber-300/60 bg-stone-950/90 px-2.5 py-0.5 text-yellow-200"
                >
                  {String(Math.floor(rankedSearchElapsed / 60)).padStart(2, '0')}:
                  {String(rankedSearchElapsed % 60).padStart(2, '0')} /{' '}
                  {String(Math.floor(rankedMatchTimeoutSec / 60)).padStart(2, '0')}:
                  {String(rankedMatchTimeoutSec % 60).padStart(2, '0')}
                </span>
              </div>
            )}

            {wheelLocked && matchedChallenger ? (
              <div
                data-testid="matched-challenger-card"
                className="my-2 flex w-full items-center gap-3.5 rounded-2xl border-2 border-yellow-300 bg-stone-950/95 p-3.5 text-left shadow-[0_0_24px_rgba(250,204,21,0.45)]"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-amber-300 bg-stone-900">
                  <img
                    src={getHeroArtUrl(CLASSIC_HEROES[matchedChallenger.opponentClass].heroId)}
                    alt=""
                    className="h-full w-full object-cover object-top"
                  />
                  <span className="absolute -bottom-1 -right-1 rounded-full border border-amber-200 bg-stone-950 px-1 text-xs">
                    {matchedChallenger.meta.badgeIcon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-sky-800/90 px-1.5 py-0.5 text-[10px] font-black text-sky-100">
                      {isKo ? matchedChallenger.meta.tierLabelKo : matchedChallenger.meta.tierLabelEn}
                    </span>
                    <span className="text-[10px] font-bold text-amber-300">
                      MMR {matchedChallenger.meta.rating}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-base font-black text-white">
                    {matchedChallenger.meta.nickname}
                  </div>
                  <div className="truncate text-xs font-extrabold text-yellow-300">
                    〈{isKo ? matchedChallenger.meta.titleKo : matchedChallenger.meta.titleEn}〉
                  </div>
                </div>
              </div>
            ) : (
              /* 5-Row Cylindrical Ivory & Oak Drum Slot Machine Window */
              <div
                data-testid="matchmaking-slot-drum"
                className="relative my-2 flex h-44 w-full flex-col items-center justify-between overflow-hidden rounded-2xl border-[4px] border-[#966d35] bg-gradient-to-b from-[#cbb082] via-[#fbf2dc] to-[#c7ac7d] px-5 py-2.5 shadow-[inset_0_12px_22px_rgba(32,18,6,0.62)]"
              >
                <div className="pointer-events-none absolute left-1.5 top-1/2 z-20 -translate-y-1/2 text-base font-black text-[#7c2d12]">
                  ▶
                </div>
                <div className="pointer-events-none absolute right-1.5 top-1/2 z-20 -translate-y-1/2 text-base font-black text-[#7c2d12]">
                  ◀
                </div>

                <div className="max-w-full truncate text-[11px] font-extrabold text-[#5c3b1c]/65">
                  {spinnerTitles[(wheelIndex + spinnerTitles.length - 2) % spinnerTitles.length]}
                </div>
                <div className="max-w-full truncate text-xs font-extrabold text-[#38210d]/90">
                  {spinnerTitles[(wheelIndex + spinnerTitles.length - 1) % spinnerTitles.length]}
                </div>
                <div className="hs-title relative z-10 my-0.5 w-full rounded-xl border-y-2 border-amber-600/80 bg-[#2a1508] px-4 py-2 text-xl font-black tracking-tight text-[#fff9e6] shadow-md">
                  {spinnerTitles[wheelIndex]}
                </div>
                <div className="max-w-full truncate text-xs font-extrabold text-[#38210d]/90">
                  {spinnerTitles[(wheelIndex + 1) % spinnerTitles.length]}
                </div>
                <div className="max-w-full truncate text-[11px] font-extrabold text-[#5c3b1c]/65">
                  {spinnerTitles[(wheelIndex + 2) % spinnerTitles.length]}
                </div>
              </div>
            )}

            <p className="hs-outline-sm mt-2 text-xs font-bold text-amber-50/95">
              {isRanked
                ? tr(
                    '실시간 랭킹 대전방이 생성되었습니다. 상대가 입장하면 즉시 전투가 시작됩니다! (1분 초과 시 자동 종료)',
                    'Live Ranked Duel Room created! Battle starts immediately when an opponent joins (auto-cancels after 60s).',
                  )
                : tr(
                    '엘윈마을 대결 광장에서 상대를 연결합니다...',
                    'Connecting opponent in Elwin Arena...',
                  )}
            </p>

            {!wheelLocked && (
              <button
                type="button"
                data-testid="matchmaking-cancel-btn"
                onClick={handleCancelMatchmaking}
                className="hs-brass-btn mt-4 min-h-[44px] rounded-xl px-6 py-2 text-xs font-extrabold text-white"
              >
                {tr('탐색 취소', 'Cancel')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Ranked 60s Timeout Popup */}
      {rankedTimeoutPopupOpen && (
        <div
          data-testid="ranked-timeout-popup"
          onClick={() => setRankedTimeoutPopupOpen(false)}
          className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hs-ocarina-dialog flex w-full max-w-sm flex-col items-center rounded-3xl border-2 border-amber-300/85 p-6 text-center shadow-2xl"
          >
            <div className="mb-2 text-3xl">⌛</div>
            <h3 className="hs-title text-base font-extrabold text-yellow-200 sm:text-lg">
              {tr('실시간 매칭 시간 초과', 'Live Matchmaking Timeout')}
            </h3>
            <p
              data-testid="ranked-timeout-message"
              className="mt-2.5 text-sm font-extrabold leading-relaxed text-white"
            >
              {tr(
                '실시간 대전상대를 찾을 수 없습니다. 대전방에서 대기 합니다.',
                'Could not find a live opponent. Waiting in the Duel Room.',
              )}
            </p>
            <p className="mt-1.5 text-[11px] font-bold text-amber-200/85">
              {tr(
                '생성되었던 임시 매칭방은 자동 삭제되었으며 예치된 골드는 전액 반환되었습니다.',
                'The temporary matchmaking room has been removed and any escrowed Gold refunded.',
              )}
            </p>
            <div className="mt-5 flex w-full gap-2">
              <button
                type="button"
                data-testid="ranked-timeout-open-duel-room-btn"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setRankedTimeoutPopupOpen(false);
                  snsheroLiveNetwork.setDrawerOpen(true);
                }}
                className="hs-brass-btn min-h-[44px] flex-1 rounded-xl px-3 py-2 text-xs font-extrabold text-amber-100"
              >
                ⚔ {tr('대전방 열기', 'Open Duel Room')}
              </button>
              <button
                type="button"
                data-testid="ranked-timeout-confirm-btn"
                onClick={() => {
                  hsAudio.playSfx('gem_a_confirm');
                  setRankedTimeoutPopupOpen(false);
                }}
                className="hs-zelda-a-btn min-h-[44px] flex-1 rounded-xl px-3 py-2 text-xs font-extrabold text-white"
              >
                {tr('확인', 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
