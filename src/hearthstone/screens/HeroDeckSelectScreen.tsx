import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hsAudio } from '../audio';
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
  BOGART_MAX_STAKE,
  BOGART_MIN_STAKE,
  BOGART_STAKE_TIERS,
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
    challengerMeta?: ChallengerMeta;
  }) => void;
}

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
    ko: '키히힉! 어서 와라, 여긴 엘윈 지하 『보가트의 도박장』이다! 명심해라—이곳은 진짜 골드가 오가는 도박장이라 패배하면 베팅한 골드를 잃는 손실 위험이 있다!',
    en: "Heh-heh! Welcome to Bogart's Underground Gambling Hall! Fair warning—real Gold is on the line here, so losing carries the risk of forfeiting your wagered Gold!",
  },
  {
    ko: '대신 양측 모두 예측불허 『100% 랜덤 30장 덱』으로 붙고, 이기면 판돈의 2배를 즉시 챙긴다! 1~1,000G 슬라이드로 감당할 만큼만 걸고 옆의 [베팅 시작]을 눌러라!',
    en: 'Both sides clash with unpredictable 100% Random 30-Card Decks, and winning pays 2x your stake! Adjust the 1–1,000G slider within your limits and hit [Start Bet]!',
  },
] as const;

const BogartNarrationOverlay: React.FC<{
  isKo: boolean;
  ownedGold: number;
  onConfirmEnter: () => void;
}> = ({ isKo, ownedGold, onConfirmEnter }) => {
  const [lineIdx, setLineIdx] = useState(0);
  const totalLines = BOGART_NARRATION_LINES.length;
  const safeIdx = Math.min(lineIdx, totalLines - 1);
  const speechText = isKo ? BOGART_NARRATION_LINES[safeIdx].ko : BOGART_NARRATION_LINES[safeIdx].en;
  const speakerLabel = isKo ? '고블린 도박왕 보가트' : 'Goblin Gambling King Bogart';

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
                `현재 보유 ${ownedGold.toLocaleString()}G · 1~1,000G 슬라이드 · 100% 랜덤덱`,
                `Owned ${ownedGold.toLocaleString()}G · 1–1,000G Slider · 100% Random Deck`,
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

  const [mode, setMode] = useState<GameMode>(initialMode);
  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0]?.id || 'preset_priest');
  const [practiceOpponentClass, setPracticeOpponentClass] = useState<HeroClass>('WARRIOR');
  const [boardTheme, setBoardTheme] = useState<BoardThemeId | 'RANDOM'>('RANDOM');
  const [bogartStake, setBogartStake] = useState<number>(() => {
    const initialGold = hsStorage.getProfile().gold;
    let requestedStake: number | null = null;
    try {
      const fromSession = sessionStorage.getItem('snshero_bogart_stake');
      if (fromSession && !Number.isNaN(Number(fromSession))) {
        requestedStake = Math.floor(Number(fromSession));
        sessionStorage.removeItem('snshero_bogart_stake');
      } else if (typeof window !== 'undefined') {
        const qp = new URLSearchParams(window.location.search);
        const rawStake = qp.get('stake') || qp.get('bet');
        if (rawStake && !Number.isNaN(Number(rawStake))) {
          requestedStake = Math.floor(Number(rawStake));
        }
      }
    } catch {
      // ignore sessionStorage error
    }
    if (requestedStake !== null) {
      return Math.max(BOGART_MIN_STAKE, Math.min(BOGART_MAX_STAKE, requestedStake));
    }
    const defaultStake = initialGold >= 250 ? 250 : initialGold >= 100 ? 100 : Math.max(1, initialGold);
    return Math.max(BOGART_MIN_STAKE, Math.min(BOGART_MAX_STAKE, defaultStake));
  });
  const [bogartNarrationOpen, setBogartNarrationOpen] = useState<boolean>(
    () => initialMode === 'BOGART_GAMBLE',
  );
  const [bogartToast, setBogartToast] = useState<string | null>(null);
  const [matchedChallenger, setMatchedChallenger] = useState<{
    opponentClass: HeroClass;
    meta: ChallengerMeta;
  } | null>(null);

  const [matching, setMatching] = useState(false);
  const [wheelIndex, setWheelIndex] = useState(0);
  const [wheelLocked, setWheelLocked] = useState(false);

  useModalDismiss(matching && !wheelLocked, () => {
    hsAudio.playSfx('box_close');
    setMatching(false);
  });

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

  useEffect(() => {
    if (!matching) return;
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
            rollOnlineChallenger(isPractice ? practiceOpponentClass : undefined, isBogart);
          onLaunchBattle({
            mode,
            deck: selectedDeck,
            preferredOpponentClass: isPractice
              ? practiceOpponentClass
              : challenger.opponentClass,
            boardTheme: boardTheme === 'RANDOM' ? undefined : boardTheme,
            bogartStakeGold: isBogart ? bogartStake : undefined,
            challengerMeta: mode === 'RANKED' || isBogart ? challenger.meta : undefined,
          });
        }, 880);
      }
    };

    timer = window.setTimeout(step, 80);
    return () => clearTimeout(timer);
  }, [
    matching,
    mode,
    selectedDeck,
    isPractice,
    isBogart,
    bogartStake,
    matchedChallenger,
    practiceOpponentClass,
    boardTheme,
    onLaunchBattle,
    spinnerTitles.length,
  ]);

  const handleCancelMatchmaking = () => {
    if (wheelLocked) return;
    if (isBogart) {
      // Refund staked Gold if cancelled before lock-in!
      const p = hsStorage.getProfile();
      p.gold += bogartStake;
      hsStorage.saveProfile(p);
      setProfile(hsStorage.getProfile());
    }
    hsAudio.playSfx('gem_b_back');
    setMatching(false);
  };

  const handleStartClick = () => {
    if (!isBogart && selectedDeck.cards.length < 30) return;
    if (isBogart) {
      const clampedStake = Math.max(
        BOGART_MIN_STAKE,
        Math.min(BOGART_MAX_STAKE, Math.floor(bogartStake || BOGART_MIN_STAKE)),
      );
      const wagerRes = hsStorage.placeBogartWager(clampedStake);
      if (!wagerRes.ok) {
        hsAudio.playSfx('gem_b_back', 0.8);
        setBogartToast(
          tr(
            `골드가 부족합니다! (선택 판돈 ${clampedStake.toLocaleString()}G / 보유 ${profile.gold.toLocaleString()}G)`,
            `Not enough Gold! (Stake ${clampedStake.toLocaleString()}G / Owned ${profile.gold.toLocaleString()}G)`,
          ),
        );
        window.setTimeout(() => setBogartToast(null), 2800);
        return;
      }
      setBogartStake(clampedStake);
      setProfile(hsStorage.getProfile());
      hsAudio.playSfx('bogart_wager', 0.95);
    } else {
      hsAudio.playSfx('gem_a_confirm', 0.95);
    }
    setMatchedChallenger(
      rollOnlineChallenger(
        isPractice ? practiceOpponentClass : undefined,
        isBogart,
      ),
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

      {/* Top Brass Bar */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl shrink-0 flex-wrap items-center justify-between gap-1.5 sm:gap-2">
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

        {/* Mode Switcher Tabs (DEV-027 Bogart's Gambling Hall + DEV-028 Online Ranked Arena + 9-Faction Sweep) */}
        <div className="flex flex-wrap items-center gap-1 rounded-2xl border-2 border-[#c39c54] bg-stone-950/90 p-1 shadow-xl sm:gap-1.5">
          {mode !== 'TUTORIAL' ? (
            <>
              <button
                type="button"
                data-testid="mode-tab-gamble"
                onClick={() => {
                  hsAudio.playSfx('gem_c_select');
                  setMode('BOGART_GAMBLE');
                  setBogartNarrationOpen(true);
                }}
                className={`hs-mario-spring flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:gap-1.5 sm:px-3.5 sm:text-xs ${
                  mode === 'BOGART_GAMBLE'
                    ? 'bg-gradient-to-b from-yellow-400 to-amber-700 text-stone-950 shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                <span>🎲</span>
                <span>{tr('보가트 도박장', "Bogart's Hall")}</span>
              </button>
              <button
                type="button"
                data-testid="mode-tab-ranked"
                onClick={() => {
                  hsAudio.playSfx('gem_a_confirm');
                  setMode('RANKED');
                }}
                className={`hs-mario-spring flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:gap-1.5 sm:px-3.5 sm:text-xs ${
                  mode === 'RANKED'
                    ? 'bg-gradient-to-b from-sky-500 to-blue-800 text-white shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                <SnsRankMedallion rank={profile.rank} size={15} />
                <span>{tr('랭킹대전 (공식 전적)', 'Ranked Arena')}</span>
              </button>
              <button
                type="button"
                data-testid="mode-tab-practice"
                onClick={() => {
                  hsAudio.playSfx('gem_c_select');
                  setMode(mode === 'PRACTICE_EXPERT' ? 'PRACTICE_EXPERT' : 'PRACTICE_NORMAL');
                }}
                className={`hs-mario-spring flex min-h-[38px] items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold transition sm:px-3 sm:text-xs ${
                  isPractice
                    ? 'bg-gradient-to-b from-emerald-500 to-emerald-800 text-white shadow'
                    : 'text-amber-200/75 hover:text-white'
                }`}
              >
                <span>🎯</span>
                <span>{tr('9종족 수련 (+2팩)', '9-Faction Trial')}</span>
              </button>
              {isPractice && (
                <button
                  type="button"
                  onClick={() => {
                    hsAudio.playSfx('gem_c_select');
                    setMode(mode === 'PRACTICE_EXPERT' ? 'PRACTICE_NORMAL' : 'PRACTICE_EXPERT');
                  }}
                  className="rounded-lg border border-red-400/50 bg-red-950/80 px-2 py-1 text-[10.5px] font-extrabold text-red-200"
                >
                  {mode === 'PRACTICE_EXPERT' ? tr('숙련 ★', 'Expert ★') : tr('일반→숙련', 'Normal→Expert')}
                </button>
              )}
            </>
          ) : (
            <span className="px-3 py-1 text-xs font-extrabold text-emerald-300">
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
                    {tr('보가트 도박장 · 1~1,000G 슬라이드 베팅', "Bogart's Hall · 1–1,000G Slider Bet")}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <a
                    href={
                      isKo
                        ? 'https://www.youtube.com/shorts/uEXB-kGnfPk'
                        : 'https://www.youtube.com/shorts/4w-h1EEC2sc'
                    }
                    target="_blank"
                    rel="noreferrer"
                    data-testid="bogart-origin-shorts-link"
                    onClick={() => hsAudio.playSfx('ui_click', 0.7)}
                    className="rounded-full border border-amber-300/65 bg-amber-950/80 px-2 py-0.5 text-[10.5px] font-extrabold text-amber-200 hover:border-yellow-200 hover:text-white"
                  >
                    🎬 {tr('31화 원작 쇼츠 ↗', 'EP.31 Origin ↗')}
                  </a>
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

              {/* Live Stake & Risk Summary Strip */}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1 rounded-xl border border-amber-400/45 bg-stone-950/90 px-3 py-1.5 text-xs">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] font-bold text-amber-200">{tr('베팅액:', 'Stake:')}</span>
                  <span
                    data-testid="bogart-stake-value"
                    className="hs-num text-base font-black text-yellow-300 sm:text-lg"
                  >
                    {bogartStake.toLocaleString()}G
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-extrabold">
                  <span className="text-emerald-300">
                    {tr(`승리 +${(bogartStake * 2).toLocaleString()}G`, `Win +${(bogartStake * 2).toLocaleString()}G`)}
                  </span>
                  <span className="text-stone-600">|</span>
                  <span className="text-rose-300">
                    ⚠️ {tr(`패배 시 -${bogartStake.toLocaleString()}G`, `Lose -${bogartStake.toLocaleString()}G`)}
                  </span>
                </div>
              </div>

              {/* MKT-060: Bogart Daily Emergency Bailout (+100G Free Rescue when Gold < 100G) */}
              {profile.gold < 100 && (
                <div
                  data-testid="bogart-bailout-strip"
                  className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-400/65 bg-emerald-950/85 px-3 py-2 text-xs font-extrabold text-emerald-100"
                >
                  <span>
                    🔥{' '}
                    {tr(
                      '시드머니가 부족하십니까? 보가트의 일일 긴급 구제금 +100G로 즉시 재도전하세요!',
                      "Running low on Gold? Claim Bogart's Daily Emergency Bailout (+100G) to jump back in!",
                    )}
                  </span>
                  {hsStorage.canClaimBogartDailyBailout() ? (
                    <button
                      type="button"
                      data-testid="bogart-bailout-btn"
                      onClick={() => {
                        const res = hsStorage.claimBogartDailyBailout();
                        if (res.granted) {
                          hsAudio.playSfx('mario_coin', 0.95);
                          setProfile(hsStorage.getProfile());
                          setBogartStake(100);
                        }
                      }}
                      className="hs-zelda-b-btn min-h-[38px] rounded-xl px-3 py-1 text-xs font-black text-white shadow"
                    >
                      {tr('🪙 오늘의 무료 구제 +100G 받기', '🪙 Claim Daily +100G Bailout')}
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-300/85">
                      {tr('✓ 오늘 구제금 수령 완료 (내일 초기화)', '✓ Claimed today (resets tomorrow)')}
                    </span>
                  )}
                </div>
              )}

              {/* 1 ~ 1,000G Range Slider + Side-by-Side [베팅 시작] Button */}
              <div className="mt-2.5 flex items-center gap-2.5">
                <div className="min-w-0 flex-1 rounded-xl border border-amber-400/45 bg-black/55 px-3 py-2">
                  <input
                    type="range"
                    data-testid="bogart-bet-slider"
                    min={BOGART_MIN_STAKE}
                    max={BOGART_MAX_STAKE}
                    step={1}
                    value={bogartStake}
                    aria-label={tr('1~1,000 골드 베팅 슬라이더', '1 to 1,000 Gold Bet Slider')}
                    onChange={(e) => {
                      const nextVal = Math.max(
                        BOGART_MIN_STAKE,
                        Math.min(BOGART_MAX_STAKE, Number(e.target.value) || BOGART_MIN_STAKE),
                      );
                      setBogartStake(nextVal);
                    }}
                    className="h-2.5 w-full cursor-pointer accent-amber-400"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-extrabold text-amber-200/85">
                    <span>1G</span>
                    <span>250G</span>
                    <span>500G</span>
                    <span>750G</span>
                    <span>1,000G</span>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="bogart-slider-bet-btn"
                  onClick={handleStartClick}
                  className="hs-mario-spring flex min-h-[54px] shrink-0 flex-col items-center justify-center rounded-xl border-2 border-yellow-100 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 px-3.5 py-2 text-center shadow-[0_4px_18px_rgba(250,204,21,0.5)] sm:px-4"
                >
                  <span className="text-xs font-black tracking-tight text-stone-950 sm:text-sm">
                    🎲 {tr('베팅 시작', 'Start Bet')}
                  </span>
                  <span className="mt-0.5 text-[11px] font-black text-amber-950">
                    {bogartStake.toLocaleString()}G
                  </span>
                </button>
              </div>

              {/* Quick Fine-Tune Chips (1G / 100G / 500G / 1,000G / Max Affordable) */}
              <div className="mt-2 grid grid-cols-5 gap-1">
                {BOGART_STAKE_TIERS.map((tier) => {
                  const active = bogartStake === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      data-testid={`bogart-stake-${tier}`}
                      onClick={() => {
                        hsAudio.playSfx('gem_c_select');
                        setBogartStake(tier);
                      }}
                      className={`min-h-[34px] rounded-lg border px-1 text-[10.5px] font-extrabold transition ${
                        active
                          ? 'border-yellow-200 bg-amber-500 text-stone-950 shadow'
                          : 'border-amber-400/35 bg-stone-950/80 text-amber-100 hover:border-yellow-300'
                      }`}
                    >
                      {tier.toLocaleString()}G
                    </button>
                  );
                })}
                <button
                  type="button"
                  data-testid="bogart-stake-max-affordable"
                  onClick={() => {
                    hsAudio.playSfx('gem_c_select');
                    setBogartStake(
                      Math.max(BOGART_MIN_STAKE, Math.min(BOGART_MAX_STAKE, Math.floor(profile.gold || 1))),
                    );
                  }}
                  className="min-h-[34px] rounded-lg border border-emerald-400/50 bg-emerald-950/75 px-1 text-[10px] font-extrabold text-emerald-200 hover:border-emerald-300"
                >
                  {tr('보유최대', 'MAX')}
                </button>
              </div>

              {profile.gold < 100 && (
                <div
                  data-testid="fairy-fountain-relief-card"
                  className="mt-2 rounded-2xl border-2 border-cyan-300/80 bg-gradient-to-r from-sky-950/95 via-indigo-950/95 to-emerald-950/95 p-2.5 text-center shadow-[0_0_20px_rgba(56,189,248,0.4)]"
                >
                  <div className="text-[11px] font-extrabold text-cyan-200">
                    🧚 {tr('엘윈 성소 요정 샘 재기 지원금 (일 3회)', 'Elwin Fairy Fountain Relief (3x/Day)')}
                  </div>
                  <p className="mt-0.5 text-[10.5px] font-semibold text-emerald-200">
                    {tr(
                      '즉시 +150G 수혈 + 다음 공식 랭킹대전 1승 시 +200G 재기 보너스 부여!',
                      'Instant +150G + +200G Comeback Bonus on your next Ranked win!',
                    )}
                  </p>
                  <button
                    type="button"
                    data-testid="bogart-relief-chip-btn"
                    onClick={() => {
                      const res = hsStorage.claimBogartReliefChip();
                      if (res.granted) {
                        hsAudio.playSfx('ocarina_chime', 0.9);
                        hsAudio.playSfx('mario_coin', 0.95);
                        setProfile(hsStorage.getProfile());
                        setBogartStake(100);
                        setBogartToast(
                          tr(
                            `🧚 요정 샘 재기 지원금 +150G 수령 완료! (오늘 잔여 ${res.remainingToday}회 · 랭킹 1승 +200G 버프 활성)`,
                            `🧚 +150G Fairy Relief claimed! (${res.remainingToday} left today · +200G Ranked buff active)`,
                          ),
                        );
                        window.setTimeout(() => setBogartToast(null), 3200);
                      } else {
                        setBogartToast(
                          tr('오늘의 무료 재기 지원금(3회)을 모두 사용했습니다. 스토리/랭킹전으로 골드를 모아보세요!', 'Used all 3 daily Fairy Reliefs today. Earn Gold in Story or Ranked!'),
                        );
                        window.setTimeout(() => setBogartToast(null), 3200);
                      }
                    }}
                    className="hs-zelda-b-btn mt-1.5 min-h-[42px] w-full rounded-xl py-1.5 text-xs font-extrabold"
                  >
                    🧚 {tr('요정 샘 +150G 즉시 수혈 받기', 'Claim +150G Fairy Relief')}
                  </button>
                  <p className="mt-1.5 text-[10px] font-bold text-amber-200/90">
                    {tr(
                      '💡 구제받은 150G는 도박장·명예 칭호(300~3,500G)에 아껴두고, 정식 랭킹 아레나 주력 덱은 로비 보급소 [5팩 특가 5,600원($4) · 광고영구제거 4,000원($2.99)]로 빠르게 보강하세요!',
                      '💡 Save your +150G Relief for Bogart & Prestige Titles (300–3,500G), and power up your Official Ranked deck in the Shop [5 Packs $4 · Ad-Free VIP $2.99]!',
                    )}
                  </p>
                </div>
              )}

              {bogartToast && (
                <div className="mt-1.5 rounded-lg border border-yellow-300/70 bg-amber-950/90 px-2.5 py-1 text-center text-[11px] font-extrabold text-yellow-200">
                  {bogartToast}
                </div>
              )}

              <div className="mt-2 flex items-center justify-between rounded-xl border border-sky-300/35 bg-black/45 px-2.5 py-1.5 text-[10.5px] font-bold text-sky-200">
                <span>🎲 {tr('양측 예측불허 100% 랜덤 30장 덱 결투', '100% Random 30-Card Deck Showdown')}</span>
                <span className="text-yellow-300">
                  {tr(`누적 순수익 ${profile.bogartStats?.netGoldProfit >= 0 ? '+' : ''}${profile.bogartStats?.netGoldProfit || 0}G`, `Net ${profile.bogartStats?.netGoldProfit >= 0 ? '+' : ''}${profile.bogartStats?.netGoldProfit || 0}G`)}
                </span>
              </div>
            </div>
          ) : (
            <div className="hs-ocarina-dialog relative z-10 my-2 flex items-center justify-between rounded-2xl p-2.5 sm:my-2.5 sm:p-3">
              <div>
                <div className="text-[10.5px] font-bold text-sky-300 sm:text-[11px]">
                  🏆 {tr('공식 랭킹대전 단독 전적 · 현재 등급', 'Official Ranked Record · Current Tier')}
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
              <SnsRankMedallion rank={profile.rank} size={50} className="shrink-0 drop-shadow" />
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
              disabled={!isBogart && selectedDeck.cards.length < 30}
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
                  ? tr(`🎲 ${bogartStake.toLocaleString()}G 베팅 · 랜덤덱 승부`, `🎲 Bet ${bogartStake.toLocaleString()}G · Random Duel`)
                  : mode === 'RANKED'
                    ? tr('🏆 실시간 도전자 랭킹 매칭', '🏆 Find Ranked Challenger')
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
          disabled={!isBogart && selectedDeck.cards.length < 30}
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
              ? tr(`🎲 ${bogartStake.toLocaleString()}G 베팅 · 랜덤덱 시작`, `🎲 Bet ${bogartStake.toLocaleString()}G · Random Duel`)
              : isKo
                ? `🏆 도전자 매칭 (${selectedDeckLabel})`
                : `🏆 Match Challenger (${selectedDeckLabel})`}
          </span>
        </button>
      </div>

      {/* ISS-004: Bogart Upper-Body Loss-Risk Narration Scene on Entry to Bogart's Gambling Hall */}
      {isBogart && bogartNarrationOpen && !matching && (
        <BogartNarrationOverlay
          isKo={isKo}
          ownedGold={profile.gold}
          onConfirmEnter={() => setBogartNarrationOpen(false)}
        />
      )}

      {/* Matchmaking Wheel Modal + Challenger Portrait Reveal (DEV-028) */}
      {matching && (
        <div
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
              className={`hs-title hs-outline-sm mb-2 text-lg font-extrabold tracking-widest ${
                wheelLocked ? 'text-[#fef08a]' : 'text-[#fffbeb]'
              }`}
            >
              {wheelLocked
                ? isBogart
                  ? tr(`🎲 ${bogartStake.toLocaleString()}G 랜덤덱 테이블 성사!`, `🎲 ${bogartStake.toLocaleString()}G Random Table Ready!`)
                  : tr('⚔ 실시간 도전자를 찾았습니다!', '⚔ Ranked Challenger Locked In!')
                : isBogart
                  ? tr('양측 30장 랜덤덱 즉석 편성 & 상대 배정 중...', 'Drafting Fresh 30-Card Random Decks...')
                  : tr('온라인 도전자 실시간 탐색 중...', 'Searching for Live Challenger...')}
            </div>

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
              {isBogart
                ? tr(
                    '양 플레이어에게 매 판 완전히 새로운 30장 랜덤덱을 배분합니다...',
                    'Dealing independent, unpredictable 30-card Random Decks to both sides...',
                  )
                : tr(
                    '엘윈마을 대결 광장에서 비슷한 MMR의 실시간 도전자를 연결합니다...',
                    'Matching a live challenger of similar MMR in Elwin Arena...',
                  )}
            </p>

            {!wheelLocked && (
              <button
                type="button"
                onClick={handleCancelMatchmaking}
                className="hs-brass-btn mt-4 min-h-[44px] rounded-xl px-6 py-2 text-xs font-extrabold text-white"
              >
                {tr('탐색 취소', 'Cancel')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
