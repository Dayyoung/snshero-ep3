import { isKoreanLanguage, tr } from '../i18n/heroLang';
import {
  CLASSIC_PRESET_DECKS,
  CRAFTING_COST,
  DISENCHANT_VALUE,
  GOLDEN_DISENCHANT_VALUE,
  cardDb,
  getStarsNeededForRank,
} from './cardDb';
import {
  BogartGambleStats,
  CardRarity,
  ClassicCardDef,
  CustomDeck,
  DailyQuest,
  GameMode,
  HERO_CLASS_ORDER,
  HeroClass,
  MatchRewardBreakdown,
  PlayerPrestigeState,
  PlayerProfile,
  PrestigeCategory,
  SnsCardBackId,
} from './types';

const KEYS = {
  PROFILE: 'hero_hs_profile',
  COLLECTION: 'hero_hs_collection',
  GOLDEN_COLLECTION: 'hero_hs_golden_collection',
  DECKS: 'hero_hs_decks',
  QUESTS: 'hero_hs_quests',
  PITY: 'hero_hs_pack_pity',
  LORE_VER: 'hero_hs_lore_version',
};

export interface PackPityState {
  totalPacksOpened: number;
  firstTenLegendaryClaimed: boolean;
  packsSinceLegendary: number;
  packsSinceEpic: number;
  packsSinceGoldenCommon: number;
  packsSinceGoldenRare: number;
  packsSinceGoldenEpic: number;
  packsSinceGoldenLegendary: number;
  everObtainedMaxCopies: Record<string, number>;
}

export const PACK_DROP_RATES_SPEC = {
  cardsPerPack: 5,
  guaranteedMinRarity: 'RARE' as const,
  firstLegendaryGuaranteePacks: 10,
  legendaryPityPacks: 40,
  epicPityPacks: 10,
  goldenCommonPityPacks: 25,
  goldenRarePityPacks: 29,
  goldenEpicPityPacks: 142,
  goldenLegendaryPityPacks: 361,
  packNormalLegendaryPct: 5.0,
  packNormalEpicPct: 21.0,
  packGoldenCommonPct: 8.1,
  packGoldenRarePct: 7.1,
  packGoldenEpicPct: 1.4,
  packGoldenLegendaryPct: 0.6,
};

const CURRENT_LORE_VERSION = 'snshero_v4';

export type CollectionMap = Record<string, number>;

export interface OpenedPackCard {
  card: ClassicCardDef;
  isGolden: boolean;
  isNew: boolean;
  newOwnedCount: number;
  newJourneyMultiplier: number;
}

export interface DefeatPackReinforcementResult {
  cards: OpenedPackCard[];
  boughtWithGold: boolean;
  goldSpent: number;
  usedExistingPack: boolean;
  freeSanctuarySupply: boolean;
  remainingGold: number;
  remainingPacks: number;
  awakenedInPackCount: number;
  totalBoostedCount: number;
  maxMultiplier: number;
}

export interface GoldPackBundleDef {
  id: string;
  packs: number;
  costGold: number;
  label: string;
  badge?: string;
}

export const GOLD_PACK_BUNDLES: GoldPackBundleDef[] = [
  {
    id: 'gold_pack_1',
    packs: 1,
    costGold: 100,
    label: '눈히어로 1팩',
  },
  {
    id: 'gold_pack_5',
    packs: 5,
    costGold: 450,
    label: '눈히어로 5팩 묶음',
    badge: '10% 할인 (-50G)',
  },
  {
    id: 'gold_pack_10',
    packs: 10,
    costGold: 850,
    label: '눈히어로 10팩 상자',
    badge: '15% 할인 (-150G)',
  },
];

export function getGoldPackBundleLabel(bundle: GoldPackBundleDef, isKo: boolean): { label: string; badge?: string } {
  if (isKo) return { label: bundle.label, badge: bundle.badge };
  if (bundle.packs === 1) return { label: '1 SNSHero Pack' };
  if (bundle.packs === 5) return { label: '5 SNSHero Packs', badge: '10% OFF (-50G)' };
  return { label: '10 SNSHero Packs', badge: '15% OFF (-150G)' };
}

export interface ModeRewardGuide {
  mode: GameMode;
  modeNameKo: string;
  playStyleBadge: string;
  baseWinRewardText: string;
  specialBonusText: string;
  summaryOneLine: string;
}

export const MODE_REWARD_GUIDES: Record<GameMode, ModeRewardGuide> = {
  TUTORIAL: {
    mode: 'TUTORIAL',
    modeNameKo: '스토리모드 (카단의 여정)',
    playStyleBadge: '우측하단 카단 자동플레이 지원(시작 시 OFF) · 3장=3배 각성',
    baseWinRewardText: '승리 시 45G~240G+ (회차·환생 비례 증가)',
    specialBonusText: '최초 돌파 +30G · 5화마다 보스 팩 +1개 · 40화 완주 시 +300G & 팩 +3개 + 환생 개방',
    summaryOneLine: '회차 돌파 골드 + 5화 단위 눈히어로 팩 + 40화 완주 시 3팩 & 환생 보너스',
  },
  RANKED: {
    mode: 'RANKED',
    modeNameKo: '온라인형 랭킹대전 (공식 전적)',
    playStyleBadge: '실시간 도전자 매칭 · 도발 심리전 · 정통 1배 룰 · 공식 전적 단독 반영',
    baseWinRewardText: '1승당 +25 골드 + 등급 별 ★+1 획득',
    specialBonusText: '3승 달성마다 +30G 추가 · 3연승 시 별 ★+2 상승 · 공식 전적 단독 집계',
    summaryOneLine: '승리 시 +25G · 3승마다 +30G · 공식 승률·연승·등급 반영',
  },
  BOGART_GAMBLE: {
    mode: 'BOGART_GAMBLE',
    modeNameKo: '보가트의 도박장 (미러덱 판돈전)',
    playStyleBadge: '100G~5,000G 골드 베팅 · 양측 100% 동일 30장 미러덱 공정 승부',
    baseWinRewardText: '승리 시 베팅 판돈 2배 즉시 지급 (최대 +10,000G 상금!)',
    specialBonusText: '공식 전적 무관 · 획득 골드로 황금 주화 교환소 4대 명예 치장 수집',
    summaryOneLine: '판돈 100G/500G/2,000G/5,000G · 승리 시 2배 상금 · 100% 동일 미러덱',
  },
  CASUAL: {
    mode: 'CASUAL',
    modeNameKo: '랭킹대전 · 일반전',
    playStyleBadge: '매판 자동플레이 지원(시작·종료 시 OFF) · 정통 1배 룰',
    baseWinRewardText: '1승당 +15 골드 (패배 시 등급 하락 없음)',
    specialBonusText: '3승 달성마다 +20G 추가 · 일일 의뢰 안전한 달성',
    summaryOneLine: '승리 시 +15G · 3승마다 +20G 보너스 · 등급 하락 없음',
  },
  PRACTICE_NORMAL: {
    mode: 'PRACTICE_NORMAL',
    modeNameKo: 'AI대전 · 일반 AI',
    playStyleBadge: '매판 자동플레이 지원(시작·종료 시 OFF) · 정통 1배 룰',
    baseWinRewardText: '1승당 +10 골드',
    specialBonusText: '9개 종족별 최초 제압 시 각 +25G 보너스 (총 +225G)',
    summaryOneLine: '승리 시 +10G · 종족 최초 제압 +25G 보너스',
  },
  PRACTICE_EXPERT: {
    mode: 'PRACTICE_EXPERT',
    modeNameKo: 'AI대전 · 숙련 AI',
    playStyleBadge: '매판 자동플레이 지원(시작·종료 시 OFF) · 정통 1배 룰',
    baseWinRewardText: '1승당 +20 골드',
    specialBonusText: '종족별 최초 제압 +50G · 9종족 숙련가 올클리어 시 눈히어로 팩 +2개 지급',
    summaryOneLine: '승리 시 +20G · 최초 제압 +50G · 9종족 올클리어 +2팩',
  },
};

export const MODE_REWARD_GUIDES_EN: Record<GameMode, ModeRewardGuide> = {
  TUTORIAL: {
    mode: 'TUTORIAL',
    modeNameKo: "Story Mode (Kadan's Journey)",
    playStyleBadge: 'Ask Kadan for Auto-Play (Starts OFF) · 3 Copies = 3x Power',
    baseWinRewardText: '45G–240G+ per win (scales with episode & Reincarnation)',
    specialBonusText: 'First Clear +30G · Boss Pack every 5 EP · EP.40 Clear +300G & 3 Packs + Reincarnation',
    summaryOneLine: 'Episode Gold + Boss Packs every 5 EP + 3 Packs on EP.40 Clear',
  },
  RANKED: {
    mode: 'RANKED',
    modeNameKo: 'Ranked Arena (Official Record)',
    playStyleBadge: 'Live Challenger Match · Taunt Emotes · Fair 1x Rules · Exclusive Official Stats',
    baseWinRewardText: '+25 Gold + 1 Rank Star per win',
    specialBonusText: '+30G every 3 wins · +2 Win-Streak Stars · Sole Official Record Mode',
    summaryOneLine: '+25G per win · +30G per 3 wins · Official Win Rate & Rank',
  },
  BOGART_GAMBLE: {
    mode: 'BOGART_GAMBLE',
    modeNameKo: "Bogart's Gambling Hall (Mirror Deck)",
    playStyleBadge: 'Wager 100G–5,000G · 100% Identical 30-Card Mirror Deck Fair Duel',
    baseWinRewardText: 'Win 2x Stake Payout instantly (up to 10,000G pot!)',
    specialBonusText: 'Separate from Official Ranked Record · Unlock 4 Gold Prestige Cosmetics',
    summaryOneLine: 'Stake 100G/500G/2,000G/5,000G · 2x Payout · 100% Mirror Deck',
  },
  CASUAL: {
    mode: 'CASUAL',
    modeNameKo: 'Casual Play',
    playStyleBadge: 'Auto-Play Available · Classic 1x Rules',
    baseWinRewardText: '+15 Gold per win (no rank loss)',
    specialBonusText: '+20G every 3 wins · Safe Daily Quest progression',
    summaryOneLine: '+15G per win · +20G per 3 wins · No rank penalty',
  },
  PRACTICE_NORMAL: {
    mode: 'PRACTICE_NORMAL',
    modeNameKo: 'Practice vs Normal AI',
    playStyleBadge: 'Auto-Play Available · Classic 1x Rules',
    baseWinRewardText: '+10 Gold per win',
    specialBonusText: '+25G first-clear bonus per faction champion (+225G total)',
    summaryOneLine: '+10G per win · +25G Faction First-Clear Bonus',
  },
  PRACTICE_EXPERT: {
    mode: 'PRACTICE_EXPERT',
    modeNameKo: 'Practice vs Expert AI',
    playStyleBadge: 'Auto-Play Available · Classic 1x Rules',
    baseWinRewardText: '+20 Gold per win',
    specialBonusText: '+50G first-clear per faction · +2 Bonus Packs for sweeping all 9',
    summaryOneLine: '+20G per win · +50G First-Clear · +2 Packs on All-9 Sweep',
  },
};

export function getModeRewardGuide(
  mode: GameMode,
  isKo: boolean = isKoreanLanguage(),
): ModeRewardGuide {
  return (isKo ? MODE_REWARD_GUIDES : MODE_REWARD_GUIDES_EN)[mode];
}

export interface OverallStandingSummary {
  wins: number;
  losses: number;
  totalGames: number;
  winRatePct: number;
  winRateLabel: string;
  overallRank: number;
  totalPlayers: number;
  topPercent: number;
  topPercentLabel: string;
}

export const BOGART_STAKE_TIERS = [100, 500, 2000, 5000] as const;
export type BogartStakeTier = (typeof BOGART_STAKE_TIERS)[number];

export interface GoldPrestigeItemDef {
  id: string;
  category: PrestigeCategory;
  costGold: number;
  icon: string;
  nameKo: string;
  nameEn: string;
  descKo: string;
  descEn: string;
  accentClass: string;
  cardBackId?: SnsCardBackId;
}

export const GOLD_PRESTIGE_ITEMS: GoldPrestigeItemDef[] = [
  // 1. Profile Badges (프로필 뱃지)
  {
    id: 'badge_compass',
    category: 'BADGE',
    costGold: 0,
    icon: '❄️',
    nameKo: '엘윈 눈나침반',
    nameEn: 'Elwin Snow Compass',
    descKo: '엘윈마을 모험가의 기본 수호 문장',
    descEn: 'Default guardian crest of Elwin Village',
    accentClass: 'border-sky-400/60 bg-sky-950/60 text-sky-200',
  },
  {
    id: 'badge_ocarina',
    category: 'BADGE',
    costGold: 300,
    icon: '🎵',
    nameKo: '시간의 오카리나 문장',
    nameEn: 'Ocarina of Sanctuary Crest',
    descKo: '성소의 비밀 선율을 연주하는 사파이어 오카리나 뱃지',
    descEn: 'Sapphire Ocarina badge echoing sanctuary melodies',
    accentClass: 'border-blue-300/80 bg-blue-950/75 text-blue-100',
  },
  {
    id: 'badge_bogart_dice',
    category: 'BADGE',
    costGold: 800,
    icon: '🎲',
    nameKo: '보가트 황금 주사위',
    nameEn: 'Bogart Golden Dice',
    descKo: '보가트의 도박장에서 담력을 증명한 승부사의 증표',
    descEn: 'High-roller emblem from Bogart’s Gambling Hall',
    accentClass: 'border-amber-300/80 bg-amber-950/75 text-yellow-200',
  },
  {
    id: 'badge_sacred_shield',
    category: 'BADGE',
    costGold: 1500,
    icon: '🛡️',
    nameKo: '성검과 성소 방패',
    nameEn: 'Sacred Sword & Shield',
    descKo: '대평원을 수호하는 영웅의 황동 방패 문장',
    descEn: 'Forged brass shield & sacred blade emblem',
    accentClass: 'border-emerald-300/80 bg-emerald-950/75 text-emerald-100',
  },
  {
    id: 'badge_abyss_crown',
    category: 'BADGE',
    costGold: 2500,
    icon: '👑',
    nameKo: '전설의 대평원 왕관',
    nameEn: 'Crown of the Great Plain',
    descKo: '최고 명예를 달성한 챔피언 전용 24K 왕관 뱃지',
    descEn: '24K Sovereign Crown for supreme champions',
    accentClass: 'border-yellow-200 bg-gradient-to-b from-amber-700/80 to-amber-950 text-yellow-100',
  },
  // 2. Card Frame Designs (카드 프레임 디자인)
  {
    id: 'frame_classic',
    category: 'FRAME',
    costGold: 0,
    icon: '🪵',
    nameKo: '기본 참나무 테두리',
    nameEn: 'Classic Oak Trim',
    descKo: '정통 여관 참나무와 단조 철제 기본 프레임',
    descEn: 'Classic tavern oak and forged iron card trim',
    accentClass: 'border-amber-600/60 bg-stone-900 text-amber-100',
  },
  {
    id: 'frame_zelda_brass',
    category: 'FRAME',
    costGold: 500,
    icon: '✨',
    nameKo: '성소 이중 황동 림',
    nameEn: 'Sanctuary Double-Brass Rim',
    descKo: '시간의 성소 석조 부조를 본뜬 이중 황동 프레임',
    descEn: 'Double forged-brass sanctuary relief frame',
    accentClass: 'border-yellow-300/80 bg-amber-950/70 text-yellow-100',
  },
  {
    id: 'frame_sapphire_rune',
    category: 'FRAME',
    costGold: 1200,
    icon: '💎',
    nameKo: '현자의 사파이어 룬 프레임',
    nameEn: 'Sage Sapphire Rune Frame',
    descKo: '감청색 마력 광채가 흐르는 현자의 성소 프레임',
    descEn: 'Deep sapphire frame pulsing with ancient runes',
    accentClass: 'border-cyan-300/85 bg-sky-950/80 text-cyan-100',
  },
  {
    id: 'frame_royal_24k',
    category: 'FRAME',
    costGold: 3000,
    icon: '🌟',
    nameKo: '24K 로얄 골드 프레임',
    nameEn: '24K Royal Gold Frame',
    descKo: '순금 포일 광택이 감도는 최고급 프레스티지 프레임',
    descEn: 'Supreme 24K golden foil prestige frame',
    accentClass: 'border-yellow-200 bg-gradient-to-r from-yellow-800/80 to-amber-900/80 text-yellow-100',
  },
  // 3. Card Back Skins (카드 뒷면 스킨)
  {
    id: 'back_gold',
    category: 'CARDBACK',
    costGold: 0,
    icon: '🟨',
    nameKo: '눈히어로 골드 뒷면',
    nameEn: 'SNSHero Gold Back',
    descKo: '공식 골드 엠블럼 기본 카드 뒷면',
    descEn: 'Official Gold Emblem default card back',
    accentClass: 'border-amber-400/60 bg-stone-900 text-amber-100',
    cardBackId: 'gold',
  },
  {
    id: 'back_silver',
    category: 'CARDBACK',
    costGold: 0,
    icon: '⬜',
    nameKo: '눈히어로 실버 뒷면',
    nameEn: 'SNSHero Silver Back',
    descKo: '공식 실버 플래티넘 기본 카드 뒷면',
    descEn: 'Official Silver Platinum default card back',
    accentClass: 'border-slate-300/60 bg-stone-900 text-slate-100',
    cardBackId: 'silver',
  },
  {
    id: 'back_bronze',
    category: 'CARDBACK',
    costGold: 0,
    icon: '🟫',
    nameKo: '눈히어로 브론즈 뒷면',
    nameEn: 'SNSHero Bronze Back',
    descKo: '공식 브론즈 클래식 기본 카드 뒷면',
    descEn: 'Official Bronze Classic default card back',
    accentClass: 'border-orange-400/60 bg-stone-900 text-orange-100',
    cardBackId: 'bronze',
  },
  {
    id: 'back_ocarina_crest',
    category: 'CARDBACK',
    costGold: 800,
    icon: '🛡️',
    nameKo: '시간의 오카리나 성소 뒷면',
    nameEn: 'Ocarina Sanctuary Back',
    descKo: '성검·방패·오카리나 문장이 각인된 사파이어 카드 스킨',
    descEn: 'Sapphire card skin emblazoned with the Ocarina Crest',
    accentClass: 'border-sky-300/85 bg-blue-950/80 text-sky-100',
    cardBackId: 'ocarina_crest',
  },
  {
    id: 'back_bogart_vip',
    category: 'CARDBACK',
    costGold: 1800,
    icon: '🎲',
    nameKo: '보가트 VIP 하이롤러 뒷면',
    nameEn: 'Bogart VIP High-Roller Back',
    descKo: '보가트의 도박장 VIP 전용 루비·골드 카드 스킨',
    descEn: 'Ruby & 24K Gold VIP card skin from Bogart’s Hall',
    accentClass: 'border-yellow-300/90 bg-red-950/80 text-yellow-100',
    cardBackId: 'bogart_vip',
  },
  // 4. Character Titles (캐릭터 호칭)
  {
    id: 'title_adventurer',
    category: 'TITLE',
    costGold: 0,
    icon: '⚔️',
    nameKo: '엘윈의 모험가',
    nameEn: 'Adventurer of Elwin',
    descKo: '엘윈마을에서 여정을 시작한 용감한 모험가',
    descEn: 'Brave adventurer setting forth from Elwin Village',
    accentClass: 'border-stone-500/60 bg-stone-900 text-amber-100',
  },
  {
    id: 'title_ocarina_hero',
    category: 'TITLE',
    costGold: 400,
    icon: '🎼',
    nameKo: '시간을 깨우는 연주자',
    nameEn: 'Conductor of Time',
    descKo: '성소의 선율로 전장의 흐름을 바꾸는 지휘관 호칭',
    descEn: 'Commander title attuned to sanctuary melodies',
    accentClass: 'border-sky-300/80 bg-sky-950/75 text-sky-100',
  },
  {
    id: 'title_gambler',
    category: 'TITLE',
    costGold: 900,
    icon: '🪙',
    nameKo: '보가트 도박장의 승부사',
    nameEn: 'Bogart Hall High-Roller',
    descKo: '100% 동일 미러덱 심리전을 제패한 대담한 승부사',
    descEn: 'Master of fair 100% Mirror-Deck high-stakes duels',
    accentClass: 'border-amber-300/85 bg-amber-950/75 text-yellow-200',
  },
  {
    id: 'title_awakener',
    category: 'TITLE',
    costGold: 1800,
    icon: '⚡',
    nameKo: '3배 각성의 지배자',
    nameEn: 'Sovereign of 3x Awakening',
    descKo: '여정의 각성 법칙을 극한으로 끌어올린 전략가',
    descEn: 'Tactician who mastered the 3x Awakening law',
    accentClass: 'border-emerald-300/85 bg-emerald-950/75 text-emerald-100',
  },
  {
    id: 'title_legend_king',
    category: 'TITLE',
    costGold: 3500,
    icon: '👑',
    nameKo: '엘윈 대평원의 전설',
    nameEn: 'Legend of Elwin Plain',
    descKo: '랭킹대전과 도박장 모두에 이름을 새긴 최고 명예 호칭',
    descEn: 'Supreme honor title celebrated across all Elwin',
    accentClass: 'border-yellow-200 bg-gradient-to-r from-amber-800/85 to-yellow-900/85 text-yellow-100',
  },
];

export function getEquippedPrestigeSummary(
  profile: PlayerProfile,
  isKo: boolean,
): { badgeIcon: string; badgeName: string; titleText: string; frameId: string } {
  const badgeDef =
    GOLD_PRESTIGE_ITEMS.find(
      (i) => i.category === 'BADGE' && i.id === profile.prestige?.equippedBadge,
    ) || GOLD_PRESTIGE_ITEMS[0];
  const titleDef =
    GOLD_PRESTIGE_ITEMS.find(
      (i) => i.category === 'TITLE' && i.id === profile.prestige?.equippedTitle,
    ) || GOLD_PRESTIGE_ITEMS.find((i) => i.id === 'title_adventurer')!;
  return {
    badgeIcon: badgeDef.icon,
    badgeName: isKo ? badgeDef.nameKo : badgeDef.nameEn,
    titleText: isKo ? titleDef.nameKo : titleDef.nameEn,
    frameId: profile.prestige?.equippedFrame || 'frame_classic',
  };
}

/**
 * 로컬스토리지 공식 랭킹대전 단독 전적(DEV-028: 오직 RANKED 승패만 반영) 기반
 * 전체 모험가(50,000명) 대비 현재 전체순위 및 상위 백분율 산출
 */
export function computeOverallStanding(profile: PlayerProfile): OverallStandingSummary {
  const TOTAL_PLAYERS = 50000;
  const totalGames = Math.max(0, profile.rankedGames ?? 0);
  const wins = Math.max(0, Math.min(totalGames, profile.rankedWins ?? 0));
  const losses = Math.max(0, totalGames - wins);
  const winRatePct = totalGames > 0 ? Math.min(100, (wins / totalGames) * 100) : 0;
  const winRateLabel = winRatePct.toFixed(1);

  let overallRank: number;
  if (profile.rank <= 0) {
    const legendScore =
      wins * 2 + (profile.rankedWinStreak || 0) * 3 + (profile.journeyMaxStageCleared || 0);
    overallRank = Math.max(1, 150 - Math.floor(legendScore / 2));
  } else {
    let cumStars = 0;
    for (let r = 25; r > profile.rank; r -= 1) {
      cumStars += getStarsNeededForRank(r);
    }
    cumStars += Math.max(0, profile.stars || 0);

    const winRate01 = totalGames > 0 ? wins / totalGames : 0;
    const effectiveProgress =
      cumStars +
      Math.min(32, wins * 0.45 + (profile.journeyMaxStageCleared || 0) * 0.35) +
      (totalGames >= 3 ? winRate01 * 6 : wins * 1.2) -
      Math.min(4, losses * 0.08);
    const norm = Math.max(0, Math.min(1, effectiveProgress / 110));
    const curved = 1 - Math.pow(1 - norm, 2.35);
    overallRank = Math.max(151, Math.round(44820 - curved * (44820 - 151)));
  }

  const topPercent = Math.max(0.01, Math.min(99.9, (overallRank / TOTAL_PLAYERS) * 100));
  const topPercentLabel =
    topPercent < 1 ? `${topPercent.toFixed(2)}%` : `${topPercent.toFixed(1)}%`;

  return {
    wins,
    losses,
    totalGames,
    winRatePct,
    winRateLabel,
    overallRank,
    totalPlayers: TOTAL_PLAYERS,
    topPercent,
    topPercentLabel,
  };
}

export function hasCombatStatsForJourney(card: ClassicCardDef): boolean {
  return card.type === 'MINION' || card.type === 'WEAPON';
}

/**
 * 카단의 여정 전용 중복 카드 배수 법칙:
 * - 공격력/체력(또는 내구도)이 있는 하수인·무기 카드가 3장 이상 보유된 경우 보유 장수만큼 배수 증가 (3장=3배, 4장=4배, N장=N배)
 * - 전설(LEGENDARY) 카드는 기본 제한이 1장이므로 2장 보유 시 2배, 3장 이상 보유 시 N배 적용
 */
export function getJourneyCardMultiplier(card: ClassicCardDef, ownedCount: number): number {
  if (!hasCombatStatsForJourney(card)) return 1;
  if (ownedCount >= 3) return ownedCount;
  if (card.rarity === 'LEGENDARY' && ownedCount >= 2) return ownedCount;
  return 1;
}

function emitStateChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('snshero:state-changed'));
  }
}

function normalizeCardBack(raw: unknown): PlayerProfile['selectedCardBack'] {
  if (raw === 'silver' || raw === 'frost') return 'silver';
  if (raw === 'bronze') return 'bronze';
  if (raw === 'ocarina_crest') return 'ocarina_crest';
  if (raw === 'bogart_vip') return 'bogart_vip';
  return 'gold';
}

function defaultPrestigeState(): PlayerPrestigeState {
  return {
    ownedBadges: ['badge_compass'],
    equippedBadge: 'badge_compass',
    ownedFrames: ['frame_classic'],
    equippedFrame: 'frame_classic',
    ownedCardBacks: ['gold', 'silver', 'bronze'],
    ownedTitles: ['title_adventurer'],
    equippedTitle: 'title_adventurer',
  };
}

function defaultBogartStats(): BogartGambleStats {
  return {
    totalMatches: 0,
    wins: 0,
    netGoldProfit: 0,
    biggestPotWon: 0,
  };
}

function defaultProfile(): PlayerProfile {
  const classWins = {} as Record<HeroClass, number>;
  for (const c of HERO_CLASS_ORDER) classWins[c] = 0;
  return {
    gold: 250,
    arcaneDust: 160,
    packs: 3,
    rank: 25,
    stars: 0,
    winStreak: 0,
    totalWins: 0,
    totalGames: 0,
    rankedWins: 0,
    rankedGames: 0,
    rankedWinStreak: 0,
    rankedBestStreak: 0,
    classWins,
    selectedCardBack: 'gold',
    prestige: defaultPrestigeState(),
    bogartStats: defaultBogartStats(),
    masterUnlocked: false,
    threeWinCounter: 0,
    journeyGuideDone: false,
    journeyEpisode: 0,
    journeyReincarnation: 0,
    journeyMaxStageCleared: 0,
    practiceNormalCleared: [],
    practiceExpertCleared: [],
  };
}

function defaultQuests(): DailyQuest[] {
  return [
    {
      id: 'q_win_3',
      title: '엘윈마을의 승부사',
      description: '스토리모드·랭킹대전·AI대전 중 아무 모드에서 2승 달성',
      progress: 0,
      goal: 2,
      rewardGold: 60,
      completed: false,
    },
    {
      id: 'q_play_minions',
      title: '눈히어로 동료 소집',
      description: '영웅 동료(하수인) 15명 소환하기',
      progress: 0,
      goal: 15,
      rewardGold: 40,
      completed: false,
    },
    {
      id: 'q_cast_spells',
      title: '별빛의 호흡 비전 수련',
      description: '비전 주문 10회 시전하기',
      progress: 0,
      goal: 10,
      rewardGold: 50,
      completed: false,
    },
  ];
}

export interface MassDisenchantPreview {
  extraCardCount: number;
  affectedUniqueCards: number;
  dustGained: number;
  sampleAffectedCards: { id: string; name: string; owned: number; afterCount: number }[];
}

class HearthstoneStorage {
  ensureInitialized() {
    if (!localStorage.getItem(KEYS.PROFILE)) {
      this.saveProfile(defaultProfile());
    }
    if (!localStorage.getItem(KEYS.COLLECTION)) {
      const col: CollectionMap = {};
      for (const c of cardDb.getAllCollectible()) {
        if (c.rarity === 'FREE') {
          col[c.id] = 2;
        }
      }
      for (const deck of CLASSIC_PRESET_DECKS) {
        const counts: Record<string, number> = {};
        for (const cid of deck.cards) {
          counts[cid] = (counts[cid] || 0) + 1;
        }
        for (const [cid, cnt] of Object.entries(counts)) {
          col[cid] = Math.max(col[cid] || 0, cnt);
        }
      }
      this.saveCollection(col);
    }
    if (!localStorage.getItem(KEYS.DECKS)) {
      this.saveDecks(CLASSIC_PRESET_DECKS.map((d) => ({ ...d, cards: [...d.cards] })));
    }
    if (!localStorage.getItem(KEYS.QUESTS)) {
      this.saveQuests(defaultQuests());
    }

    if (localStorage.getItem(KEYS.LORE_VER) !== CURRENT_LORE_VERSION) {
      const p = this.getProfile();
      // If untouched legacy starter profile had 15 packs and 0 games, normalize to 3 starter packs
      if (p.totalGames === 0 && p.packs === 15) {
        p.packs = 3;
        p.gold = 250;
        p.journeyGuideDone = false;
      }
      if (
        p.totalGames === 0 &&
        (p.journeyReincarnation || 0) === 0 &&
        (p.journeyMaxStageCleared || 0) === 0 &&
        p.journeyEpisode === 1
      ) {
        p.journeyEpisode = 0;
      }
      this.saveProfile(p);

      const presetById = new Map(CLASSIC_PRESET_DECKS.map((d) => [d.id, d]));
      const existingDecks = this.getDecks();
      const customOnly = existingDecks.filter((d) => !d.isPreset && !presetById.has(d.id));
      const migratedPresets = CLASSIC_PRESET_DECKS.map((preset) => {
        const prev = existingDecks.find((d) => d.id === preset.id);
        return {
          ...preset,
          cards: prev && prev.cards.length === 30 ? [...prev.cards] : [...preset.cards],
        };
      });
      this.saveDecks([...migratedPresets, ...customOnly]);

      const freshQuests = defaultQuests();
      const prevQuests = this.getQuests();
      const migratedQuests = freshQuests.map((fq) => {
        const old = prevQuests.find((pq) => pq.id === fq.id);
        return old
          ? {
              ...fq,
              progress: Math.min(fq.goal, old.progress || 0),
              completed: Boolean(old.completed),
              bonusClaimed: Boolean(old.bonusClaimed),
            }
          : fq;
      });
      this.saveQuests(migratedQuests);
      localStorage.setItem(KEYS.LORE_VER, CURRENT_LORE_VERSION);
    }
  }

  getProfile(): PlayerProfile {
    try {
      const raw = localStorage.getItem(KEYS.PROFILE);
      if (raw) {
        const parsed = JSON.parse(raw);
        const parsedReinc = Math.max(0, Number(parsed?.journeyReincarnation) || 0);
        const minEp = parsedReinc > 0 ? 1 : 0;
        const rawEp = parsed?.journeyEpisode;
        const parsedEp =
          rawEp === undefined || rawEp === null || Number.isNaN(Number(rawEp))
            ? minEp
            : Math.max(minEp, Math.min(40, Math.floor(Number(rawEp))));
        const defPrest = defaultPrestigeState();
        const rawPrest = parsed?.prestige || {};
        const mergedPrestige: PlayerPrestigeState = {
          ownedBadges: Array.isArray(rawPrest.ownedBadges) && rawPrest.ownedBadges.length > 0
            ? Array.from(new Set(['badge_compass', ...rawPrest.ownedBadges]))
            : defPrest.ownedBadges,
          equippedBadge: rawPrest.equippedBadge || defPrest.equippedBadge,
          ownedFrames: Array.isArray(rawPrest.ownedFrames) && rawPrest.ownedFrames.length > 0
            ? Array.from(new Set(['frame_classic', ...rawPrest.ownedFrames]))
            : defPrest.ownedFrames,
          equippedFrame: rawPrest.equippedFrame || defPrest.equippedFrame,
          ownedCardBacks: Array.isArray(rawPrest.ownedCardBacks) && rawPrest.ownedCardBacks.length > 0
            ? (Array.from(new Set(['gold', 'silver', 'bronze', ...rawPrest.ownedCardBacks])) as SnsCardBackId[])
            : defPrest.ownedCardBacks,
          ownedTitles: Array.isArray(rawPrest.ownedTitles) && rawPrest.ownedTitles.length > 0
            ? Array.from(new Set(['title_adventurer', ...rawPrest.ownedTitles]))
            : defPrest.ownedTitles,
          equippedTitle: rawPrest.equippedTitle || defPrest.equippedTitle,
        };
        const rawBogart = parsed?.bogartStats || {};
        return {
          ...defaultProfile(),
          ...parsed,
          rankedWins: Math.max(0, Number(parsed?.rankedWins) || 0),
          rankedGames: Math.max(0, Number(parsed?.rankedGames) || 0),
          rankedWinStreak: Math.max(0, Number(parsed?.rankedWinStreak) || 0),
          rankedBestStreak: Math.max(0, Number(parsed?.rankedBestStreak) || 0),
          selectedCardBack: normalizeCardBack(parsed?.selectedCardBack),
          prestige: mergedPrestige,
          bogartStats: {
            totalMatches: Math.max(0, Number(rawBogart.totalMatches) || 0),
            wins: Math.max(0, Number(rawBogart.wins) || 0),
            netGoldProfit: Number(rawBogart.netGoldProfit) || 0,
            biggestPotWon: Math.max(0, Number(rawBogart.biggestPotWon) || 0),
          },
          journeyEpisode: parsedEp,
          journeyReincarnation: parsedReinc,
          journeyMaxStageCleared: Math.max(0, Number(parsed?.journeyMaxStageCleared) || 0),
          practiceNormalCleared: Array.isArray(parsed?.practiceNormalCleared)
            ? parsed.practiceNormalCleared
            : [],
          practiceExpertCleared: Array.isArray(parsed?.practiceExpertCleared)
            ? parsed.practiceExpertCleared
            : [],
        };
      }
    } catch {
      // ignore
    }
    return defaultProfile();
  }

  saveProfile(p: PlayerProfile) {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(p));
    emitStateChanged();
  }

  markJourneyGuideDone() {
    const p = this.getProfile();
    if (!p.journeyGuideDone) {
      p.journeyGuideDone = true;
      this.saveProfile(p);
    }
  }

  getCollection(): CollectionMap {
    try {
      const raw = localStorage.getItem(KEYS.COLLECTION);
      if (raw) return JSON.parse(raw) as CollectionMap;
    } catch {
      // ignore
    }
    return {};
  }

  saveCollection(col: CollectionMap) {
    localStorage.setItem(KEYS.COLLECTION, JSON.stringify(col));
    emitStateChanged();
  }

  getGoldenCollection(): CollectionMap {
    try {
      const raw = localStorage.getItem(KEYS.GOLDEN_COLLECTION);
      if (raw) return JSON.parse(raw) as CollectionMap;
    } catch {
      // ignore
    }
    return {};
  }

  saveGoldenCollection(gcol: CollectionMap) {
    localStorage.setItem(KEYS.GOLDEN_COLLECTION, JSON.stringify(gcol));
    emitStateChanged();
  }

  getPackPityState(): PackPityState {
    const col = this.getCollection();
    const fallbackEver: Record<string, number> = {};
    for (const [cid, cnt] of Object.entries(col)) {
      if (cnt > 0) fallbackEver[cid] = cnt;
    }
    const defaults: PackPityState = {
      totalPacksOpened: 0,
      firstTenLegendaryClaimed: false,
      packsSinceLegendary: 0,
      packsSinceEpic: 0,
      packsSinceGoldenCommon: 0,
      packsSinceGoldenRare: 0,
      packsSinceGoldenEpic: 0,
      packsSinceGoldenLegendary: 0,
      everObtainedMaxCopies: fallbackEver,
    };
    try {
      const raw = localStorage.getItem(KEYS.PITY);
      if (!raw) return defaults;
      const trimmed = raw.trim();
      // Migrate legacy numeric string pity counter seamlessly
      if (/^\d+$/.test(trimmed)) {
        const legacyNum = Math.max(0, Number(trimmed) || 0);
        return {
          ...defaults,
          packsSinceLegendary: Math.min(39, legacyNum),
        };
      }
      const parsed = JSON.parse(trimmed) as Partial<PackPityState>;
      const mergedEver: Record<string, number> = {
        ...fallbackEver,
        ...(parsed.everObtainedMaxCopies || {}),
      };
      for (const [cid, cnt] of Object.entries(fallbackEver)) {
        mergedEver[cid] = Math.max(mergedEver[cid] || 0, cnt);
      }
      return {
        totalPacksOpened: Math.max(0, Number(parsed.totalPacksOpened) || 0),
        firstTenLegendaryClaimed: Boolean(parsed.firstTenLegendaryClaimed),
        packsSinceLegendary: Math.max(0, Number(parsed.packsSinceLegendary) || 0),
        packsSinceEpic: Math.max(0, Number(parsed.packsSinceEpic) || 0),
        packsSinceGoldenCommon: Math.max(0, Number(parsed.packsSinceGoldenCommon) || 0),
        packsSinceGoldenRare: Math.max(0, Number(parsed.packsSinceGoldenRare) || 0),
        packsSinceGoldenEpic: Math.max(0, Number(parsed.packsSinceGoldenEpic) || 0),
        packsSinceGoldenLegendary: Math.max(0, Number(parsed.packsSinceGoldenLegendary) || 0),
        everObtainedMaxCopies: mergedEver,
      };
    } catch {
      return defaults;
    }
  }

  private savePackPityState(state: PackPityState) {
    localStorage.setItem(KEYS.PITY, JSON.stringify(state));
  }

  getDecks(): CustomDeck[] {
    try {
      const raw = localStorage.getItem(KEYS.DECKS);
      if (raw) {
        const parsed = JSON.parse(raw) as CustomDeck[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return CLASSIC_PRESET_DECKS;
  }

  saveDecks(decks: CustomDeck[]) {
    localStorage.setItem(KEYS.DECKS, JSON.stringify(decks));
    emitStateChanged();
  }

  getQuests(): DailyQuest[] {
    try {
      const raw = localStorage.getItem(KEYS.QUESTS);
      if (raw) return JSON.parse(raw) as DailyQuest[];
    } catch {
      // ignore
    }
    return defaultQuests();
  }

  saveQuests(quests: DailyQuest[]) {
    localStorage.setItem(KEYS.QUESTS, JSON.stringify(quests));
    emitStateChanged();
  }

  buyPacksWithGold(count: number): boolean {
    return this.buyPackBundleWithGold(count, count * 100);
  }

  buyPackBundleWithGold(packs: number, costGold: number): boolean {
    const p = this.getProfile();
    if (packs <= 0 || costGold <= 0 || p.gold < costGold) return false;
    p.gold -= costGold;
    p.packs += packs;
    this.saveProfile(p);
    return true;
  }

  /**
   * 공식 하스스톤 카드 팩 시스템 (나무위키 `하스스톤/카드 팩` & 블리자드 공시 확률 100% 준수):
   * 1) 1팩 = 5장, 기본(FREE 129장) 제외 253장 클래식 전문가 세트에서만 등장, 최소 희귀(RARE) 이상 1장 100% 확정
   * 2) 천장(Pity Timer):
   *    - 최초 10팩 이내 첫 전설 1장 100% 확정 (`firstTenLegendaryClaimed`)
   *    - 일반 전설 천장 최대 40팩 (팩당 평균 약 5.0%, 30팩 이후 소프트 확률 상승)
   *    - 특급(영웅) 천장 최대 10팩 (팩당 평균 약 21.0%, 7팩 이후 소프트 확률 상승)
   *    - 황금 천장: 황금 일반 25팩 / 황금 희귀 29팩 / 황금 특급 142팩 / 황금 전설 361팩
   * 3) 전 등급 중복 방지(Duplicate Protection):
   *    - 전설(36종): 마력 추출/직접 제작 이력(`everObtainedMaxCopies`) 포함 미수집 전설 100% 우선 등장
   *    - 일반(98종)·희귀(81종)·특급(38종): 해당 등급 전 종을 2장씩 수집할 때까지 2장 미만 카드 우선 등장
   *    - 단일 팩(5장) 내 동일 카드 3장 이상(전설 2장 이상) 동시 등장 원천 차단
   */
  openOnePack(opts?: { journeyReinforcement?: boolean }): OpenedPackCard[] | null {
    const p = this.getProfile();
    if (p.packs <= 0) return null;
    p.packs -= 1;
    this.saveProfile(p);

    const col = this.getCollection();
    const gcol = this.getGoldenCollection();
    const pity = this.getPackPityState();

    const expertPool = cardDb.getAllCollectible().filter((c) => c.rarity !== 'FREE');
    const byRarity: Record<Exclude<CardRarity, 'FREE'>, ClassicCardDef[]> = {
      COMMON: expertPool.filter((c) => c.rarity === 'COMMON'),
      RARE: expertPool.filter((c) => c.rarity === 'RARE'),
      EPIC: expertPool.filter((c) => c.rarity === 'EPIC'),
      LEGENDARY: expertPool.filter((c) => c.rarity === 'LEGENDARY'),
    };

    type PackSlotTier =
      | 'GOLDEN_LEGENDARY'
      | 'GOLDEN_EPIC'
      | 'GOLDEN_RARE'
      | 'GOLDEN_COMMON'
      | 'NORMAL_LEGENDARY'
      | 'NORMAL_EPIC'
      | 'NORMAL_RARE'
      | 'NORMAL_COMMON';

    const nextNormalLeg = pity.packsSinceLegendary + 1;
    const nextNormalEpic = pity.packsSinceEpic + 1;
    const nextGoldLeg = pity.packsSinceGoldenLegendary + 1;
    const nextGoldEpic = pity.packsSinceGoldenEpic + 1;
    const nextGoldRare = pity.packsSinceGoldenRare + 1;
    const nextGoldCommon = pity.packsSinceGoldenCommon + 1;

    const normalLegCap = pity.firstTenLegendaryClaimed
      ? PACK_DROP_RATES_SPEC.legendaryPityPacks
      : PACK_DROP_RATES_SPEC.firstLegendaryGuaranteePacks;

    // Exact per-slot probabilities calibrated WITH their independent pity ceilings (361 / 142 / 29 / 25 / 40 / 10)
    // so empirical pack rates match Blizzard's official disclosure:
    // - 황금 전설: 0.6% (361팩 천장) / 황금 특급: 1.4% (142팩 천장) / 황금 희귀: 7.1% (29팩 천장) / 황금 일반: 8.1% (25팩 천장)
    // - 일반 전설: 5.0% (첫 10팩 / 이후 40팩 천장) / 일반 특급: 21.0% (10팩 천장) / 최소 일반 희귀 이상 1장 확정
    const pGoldLeg = 0.00102;
    const pGoldEpic = 0.00224;
    const pGoldRare = 0.01208;
    const pGoldCommon = 0.01358;
    const pNormalLeg = !pity.firstTenLegendaryClaimed ? 0.022 : 0.00818;
    const pNormalEpic = 0.0391;
    const pNormalRare = 0.214;

    const slotTiers: PackSlotTier[] = Array.from({ length: 5 }, () => {
      const r = Math.random();
      let acc = 0;
      if (r < (acc += pGoldLeg)) return 'GOLDEN_LEGENDARY';
      if (r < (acc += pGoldEpic)) return 'GOLDEN_EPIC';
      if (r < (acc += pGoldRare)) return 'GOLDEN_RARE';
      if (r < (acc += pGoldCommon)) return 'GOLDEN_COMMON';
      if (r < (acc += pNormalLeg)) return 'NORMAL_LEGENDARY';
      if (r < (acc += pNormalEpic)) return 'NORMAL_EPIC';
      if (r < (acc += pNormalRare)) return 'NORMAL_RARE';
      return 'NORMAL_COMMON';
    });

    const injectPityTier = (target: PackSlotTier, protectedTiers: Set<PackSlotTier>) => {
      const commonIdxs = slotTiers
        .map((t, i) => (t === 'NORMAL_COMMON' ? i : -1))
        .filter((i) => i >= 0);
      if (commonIdxs.length > 0) {
        slotTiers[commonIdxs[Math.floor(Math.random() * commonIdxs.length)]] = target;
        return;
      }
      const availIdxs = slotTiers
        .map((t, i) => (!protectedTiers.has(t) ? i : -1))
        .filter((i) => i >= 0);
      if (availIdxs.length > 0) {
        slotTiers[availIdxs[0]] = target;
      }
    };

    // Enforce All 6 Independent Official Hearthstone Pity Timers
    if (
      nextGoldLeg >= PACK_DROP_RATES_SPEC.goldenLegendaryPityPacks &&
      !slotTiers.includes('GOLDEN_LEGENDARY')
    ) {
      injectPityTier('GOLDEN_LEGENDARY', new Set(['GOLDEN_LEGENDARY']));
    }
    if (
      nextGoldEpic >= PACK_DROP_RATES_SPEC.goldenEpicPityPacks &&
      !slotTiers.includes('GOLDEN_EPIC')
    ) {
      injectPityTier('GOLDEN_EPIC', new Set(['GOLDEN_LEGENDARY', 'GOLDEN_EPIC']));
    }
    if (nextNormalLeg >= normalLegCap && !slotTiers.includes('NORMAL_LEGENDARY')) {
      injectPityTier(
        'NORMAL_LEGENDARY',
        new Set(['GOLDEN_LEGENDARY', 'GOLDEN_EPIC', 'NORMAL_LEGENDARY']),
      );
    }
    if (
      nextNormalEpic >= PACK_DROP_RATES_SPEC.epicPityPacks &&
      !slotTiers.includes('NORMAL_EPIC')
    ) {
      injectPityTier(
        'NORMAL_EPIC',
        new Set(['GOLDEN_LEGENDARY', 'GOLDEN_EPIC', 'NORMAL_LEGENDARY', 'NORMAL_EPIC']),
      );
    }
    if (
      nextGoldRare >= PACK_DROP_RATES_SPEC.goldenRarePityPacks &&
      !slotTiers.includes('GOLDEN_RARE')
    ) {
      injectPityTier(
        'GOLDEN_RARE',
        new Set([
          'GOLDEN_LEGENDARY',
          'GOLDEN_EPIC',
          'NORMAL_LEGENDARY',
          'NORMAL_EPIC',
          'GOLDEN_RARE',
        ]),
      );
    }
    if (
      nextGoldCommon >= PACK_DROP_RATES_SPEC.goldenCommonPityPacks &&
      !slotTiers.includes('GOLDEN_COMMON')
    ) {
      injectPityTier(
        'GOLDEN_COMMON',
        new Set([
          'GOLDEN_LEGENDARY',
          'GOLDEN_EPIC',
          'NORMAL_LEGENDARY',
          'NORMAL_EPIC',
          'GOLDEN_RARE',
          'GOLDEN_COMMON',
        ]),
      );
    }

    // Enforce Guaranteed At Least 1 Rare or Better per Pack (Upgrades a Common slot to Normal Rare)
    const hasRareOrBetter = slotTiers.some(
      (t) => t !== 'NORMAL_COMMON' && t !== 'GOLDEN_COMMON',
    );
    if (!hasRareOrBetter) {
      const ncIdx = slotTiers.indexOf('NORMAL_COMMON');
      slotTiers[ncIdx >= 0 ? ncIdx : 0] = 'NORMAL_RARE';
    }

    // Update All 6 Independent Pack-Level Pity Counters
    pity.totalPacksOpened += 1;
    if (slotTiers.includes('NORMAL_LEGENDARY') || slotTiers.includes('GOLDEN_LEGENDARY')) {
      pity.firstTenLegendaryClaimed = true;
    }
    pity.packsSinceLegendary = slotTiers.includes('NORMAL_LEGENDARY') ? 0 : nextNormalLeg;
    pity.packsSinceEpic = slotTiers.includes('NORMAL_EPIC') ? 0 : nextNormalEpic;
    pity.packsSinceGoldenLegendary = slotTiers.includes('GOLDEN_LEGENDARY') ? 0 : nextGoldLeg;
    pity.packsSinceGoldenEpic = slotTiers.includes('GOLDEN_EPIC') ? 0 : nextGoldEpic;
    pity.packsSinceGoldenRare = slotTiers.includes('GOLDEN_RARE') ? 0 : nextGoldRare;
    pity.packsSinceGoldenCommon = slotTiers.includes('GOLDEN_COMMON') ? 0 : nextGoldCommon;

    const rarities: Exclude<CardRarity, 'FREE'>[] = slotTiers.map((t) => {
      if (t === 'GOLDEN_LEGENDARY' || t === 'NORMAL_LEGENDARY') return 'LEGENDARY';
      if (t === 'GOLDEN_EPIC' || t === 'NORMAL_EPIC') return 'EPIC';
      if (t === 'GOLDEN_RARE' || t === 'NORMAL_RARE') return 'RARE';
      return 'COMMON';
    });
    const goldenFlags: boolean[] = slotTiers.map((t) => t.startsWith('GOLDEN_'));

    // Select Specific Cards with Full Duplicate Protection & Story Mode Awakening Support
    const inPackCounts: Record<string, number> = {};
    const results: OpenedPackCard[] = rarities.map((rar, slotIdx) => {
      const pool = byRarity[rar].length > 0 ? byRarity[rar] : byRarity.COMMON;
      const deckCopyCap = rar === 'LEGENDARY' ? 1 : 2;

      // Filter out cards that already hit deckCopyCap inside THIS same 5-card pack
      const packLegalPool = pool.filter((c) => (inPackCounts[c.id] || 0) < deckCopyCap);
      const baseCandidates = packLegalPool.length > 0 ? packLegalPool : pool;

      // Duplicate Protection: prioritize cards whose lifetime max copies (`everObtainedMaxCopies`) < deckCopyCap
      const uncollectedPool = baseCandidates.filter((c) => {
        const lifetimeCopies = Math.max(pity.everObtainedMaxCopies[c.id] || 0, col[c.id] || 0);
        return lifetimeCopies < deckCopyCap;
      });

      let activePool = uncollectedPool.length > 0 ? uncollectedPool : baseCandidates;

      // Story Mode Power Reinforcement:
      // Allow combat cards currently at 2 copies (or >=3 copies) to reach 3+ copies (`3장 = ×3배 각성`)
      // on reinforcement packs (or 1 common slot in normal packs) so opening packs tangibly boosts Story Mode power!
      if (rar !== 'LEGENDARY') {
        const wantAwakeningSlot = opts?.journeyReinforcement
          ? slotIdx < 4
          : rar === 'COMMON' && slotIdx === 0 && Math.random() < 0.45;
        if (wantAwakeningSlot) {
          const twoCopyCombatSameRarity = baseCandidates.filter(
            (c) => hasCombatStatsForJourney(c) && (col[c.id] || 0) === 2,
          );
          const upgradedCombatSameRarity = baseCandidates.filter(
            (c) =>
              hasCombatStatsForJourney(c) &&
              (col[c.id] || 0) >= 3 &&
              (col[c.id] || 0) < 10,
          );
          const twoCopyCombatAnyExpert = expertPool.filter(
            (c) =>
              c.rarity !== 'LEGENDARY' &&
              hasCombatStatsForJourney(c) &&
              (inPackCounts[c.id] || 0) < 2 &&
              (col[c.id] || 0) === 2,
          );
          const oneCopyCombatSameRarity = baseCandidates.filter(
            (c) => hasCombatStatsForJourney(c) && (col[c.id] || 0) === 1,
          );

          if (
            twoCopyCombatSameRarity.length > 0 &&
            (upgradedCombatSameRarity.length === 0 || Math.random() < 0.72)
          ) {
            activePool = twoCopyCombatSameRarity;
          } else if (upgradedCombatSameRarity.length > 0 && Math.random() < 0.65) {
            activePool = upgradedCombatSameRarity;
          } else if (opts?.journeyReinforcement && twoCopyCombatAnyExpert.length > 0) {
            activePool = twoCopyCombatAnyExpert;
          } else if (opts?.journeyReinforcement && oneCopyCombatSameRarity.length > 0) {
            activePool = oneCopyCombatSameRarity;
          }
        }
      }

      const picked = activePool[Math.floor(Math.random() * activePool.length)];
      const isGolden = goldenFlags[slotIdx];

      inPackCounts[picked.id] = (inPackCounts[picked.id] || 0) + 1;
      const prevCount = col[picked.id] || 0;
      const nextCount = prevCount + 1;
      col[picked.id] = nextCount;
      if (isGolden) {
        gcol[picked.id] = (gcol[picked.id] || 0) + 1;
      }
      pity.everObtainedMaxCopies[picked.id] = Math.max(
        pity.everObtainedMaxCopies[picked.id] || 0,
        nextCount,
      );

      return {
        card: picked,
        isGolden,
        isNew: prevCount === 0,
        newOwnedCount: nextCount,
        newJourneyMultiplier: getJourneyCardMultiplier(picked, nextCount),
      };
    });

    this.saveCollection(col);
    this.saveGoldenCollection(gcol);
    this.savePackPityState(pity);
    return results;
  }

  /**
   * 『스토리모드(카단의 여정)』 패배 시 즉시 재대결하지 않고,
   * 1) 보유 골드가 100G 이상이면 카드팩 1개를 구매(-100G, +1팩)하고
   * 2) (골드가 부족할 경우 보유 팩 1개 또는 성소 구호 지원팩 1개를 사용하여)
   * 3) 즉시 카드팩 1개(5장)를 개봉해 도감 및 3장=3배 각성 전력을 강화한 뒤 재도전하도록 지원합니다.
   */
  purchaseAndOpenReinforcementPack(): DefeatPackReinforcementResult {
    const p = this.getProfile();
    let boughtWithGold = false;
    let goldSpent = 0;
    let usedExistingPack = false;
    let freeSanctuarySupply = false;

    if (p.gold >= 100) {
      this.buyPacksWithGold(1);
      boughtWithGold = true;
      goldSpent = 100;
    } else if (p.packs > 0) {
      usedExistingPack = true;
    } else {
      this.grantPacks(1);
      freeSanctuarySupply = true;
    }

    const cards = this.openOnePack({ journeyReinforcement: true }) || [];
    const updatedProfile = this.getProfile();
    const col = this.getCollection();

    let totalBoostedCount = 0;
    let maxMultiplier = 1;
    for (const c of cardDb.getAllCollectible()) {
      const cnt = col[c.id] || 0;
      if (cnt > 0) {
        const mult = getJourneyCardMultiplier(c, cnt);
        if (mult > 1) {
          totalBoostedCount += 1;
          if (mult > maxMultiplier) maxMultiplier = mult;
        }
      }
    }

    const awakenedInPackCount = cards.filter((item) => item.newJourneyMultiplier > 1).length;

    return {
      cards,
      boughtWithGold,
      goldSpent,
      usedExistingPack,
      freeSanctuarySupply,
      remainingGold: updatedProfile.gold,
      remainingPacks: updatedProfile.packs,
      awakenedInPackCount,
      totalBoostedCount,
      maxMultiplier,
    };
  }

  /**
   * 『카단의 여정』 패배 시 단일 카드 1장 즉시 뽑기 (보유 골드 20G 이상이면 20G 사용, 부족 시 성소 무상 구호 보급)
   * 뽑은 카드는 즉시 로컬스토리지 도감에 영구 합산되며 3장 이상 달성 시 ×3배(N장=N배) 각성이 즉시 반영됩니다.
   */
  drawSingleReinforcementCard(): {
    drawn: OpenedPackCard;
    goldSpent: number;
  } {
    const p = this.getProfile();
    const SINGLE_DRAW_COST = 20;
    let goldSpent = 0;
    if (p.gold >= SINGLE_DRAW_COST) {
      p.gold -= SINGLE_DRAW_COST;
      goldSpent = SINGLE_DRAW_COST;
      this.saveProfile(p);
    }

    const col = this.getCollection();
    const allCollectible = cardDb.getAllCollectible();
    // Exclude FREE basic cards (already owned 2x for free) from single reinforcement draws too!
    const reinforcementPool = allCollectible.filter((c) => c.rarity !== 'FREE');
    const byRarity: Record<CardRarity, ClassicCardDef[]> = {
      FREE: [],
      COMMON: reinforcementPool.filter((c) => c.rarity === 'COMMON'),
      RARE: reinforcementPool.filter((c) => c.rarity === 'RARE'),
      EPIC: reinforcementPool.filter((c) => c.rarity === 'EPIC'),
      LEGENDARY: reinforcementPool.filter((c) => c.rarity === 'LEGENDARY'),
    };

    const r = Math.random();
    let rar: CardRarity = 'COMMON';
    if (r < 0.04) rar = 'LEGENDARY';
    else if (r < 0.15) rar = 'EPIC';
    else if (r < 0.4) rar = 'RARE';

    const pool = byRarity[rar].length > 0 ? byRarity[rar] : byRarity.COMMON;
    let picked = pool[Math.floor(Math.random() * pool.length)];

    // Help players reach exciting 3-copy (×3배) awakenings smoothly on Journey retries
    if (Math.random() < 0.78) {
      const twoCopyCandidates = allCollectible.filter(
        (c) => hasCombatStatsForJourney(c) && (col[c.id] || 0) === 2,
      );
      const furtherUpgradeCandidates = allCollectible.filter(
        (c) => hasCombatStatsForJourney(c) && (col[c.id] || 0) >= 3 && (col[c.id] || 0) < 8,
      );
      if (twoCopyCandidates.length > 0) {
        picked = twoCopyCandidates[Math.floor(Math.random() * twoCopyCandidates.length)];
      } else if (furtherUpgradeCandidates.length > 0) {
        picked =
          furtherUpgradeCandidates[Math.floor(Math.random() * furtherUpgradeCandidates.length)];
      }
    }

    const isGolden = Math.random() < 0.034;
    const prevCount = col[picked.id] || 0;
    const nextCount = prevCount + 1;
    col[picked.id] = nextCount;
    this.saveCollection(col);
    if (isGolden) {
      const gcol = this.getGoldenCollection();
      gcol[picked.id] = (gcol[picked.id] || 0) + 1;
      this.saveGoldenCollection(gcol);
    }
    const pity = this.getPackPityState();
    pity.everObtainedMaxCopies[picked.id] = Math.max(
      pity.everObtainedMaxCopies[picked.id] || 0,
      nextCount,
    );
    this.savePackPityState(pity);

    return {
      drawn: {
        card: picked,
        isGolden,
        isNew: prevCount === 0,
        newOwnedCount: nextCount,
        newJourneyMultiplier: getJourneyCardMultiplier(picked, nextCount),
      },
      goldSpent,
    };
  }

  craftCard(cardId: string): { ok: boolean; reason?: string } {
    const def = cardDb.getCard(cardId);
    if (!def) {
      return { ok: false, reason: tr('존재하지 않는 카드입니다.', 'Card not found.') };
    }
    if (def.rarity === 'FREE') {
      return { ok: false, reason: tr('기본 무료 지급 카드는 제작할 수 없습니다.', 'Free Basic cards cannot be crafted.') };
    }
    const cost = CRAFTING_COST[def.rarity] || 40;
    const p = this.getProfile();
    if (p.arcaneDust < cost) {
      return {
        ok: false,
        reason: tr(`신비한 가루가 부족합니다. (필요: ${cost})`, `Not enough Arcane Dust (need ${cost}).`),
      };
    }
    const col = this.getCollection();
    if ((col[cardId] || 0) >= 99) {
      return { ok: false, reason: tr('최대 보유 한도(99장)에 도달했습니다.', 'Maximum copy limit (99) reached.') };
    }
    p.arcaneDust -= cost;
    const nextCount = (col[cardId] || 0) + 1;
    col[cardId] = nextCount;

    // Record in lifetime obtained history so crafted Legendaries/Rares/Epics never duplicate prematurely in packs!
    const pity = this.getPackPityState();
    pity.everObtainedMaxCopies[cardId] = Math.max(
      pity.everObtainedMaxCopies[cardId] || 0,
      nextCount,
    );
    this.savePackPityState(pity);

    this.saveProfile(p);
    this.saveCollection(col);
    return { ok: true };
  }

  disenchantCard(cardId: string, preferGolden = false): { ok: boolean; reason?: string; dustGained?: number } {
    const def = cardDb.getCard(cardId);
    if (!def) {
      return { ok: false, reason: tr('존재하지 않는 카드입니다.', 'Card not found.') };
    }
    if (def.rarity === 'FREE') {
      return { ok: false, reason: tr('기본 무료 지급 카드는 마력을 추출할 수 없습니다.', 'Free Basic cards cannot be disenchanted.') };
    }
    const col = this.getCollection();
    const totalOwned = col[cardId] || 0;
    if (totalOwned <= 0) {
      return { ok: false, reason: tr('보유한 카드가 없습니다.', 'No copies owned.') };
    }
    const gcol = this.getGoldenCollection();
    const goldenOwned = Math.min(totalOwned, gcol[cardId] || 0);
    const normalOwned = Math.max(0, totalOwned - goldenOwned);

    const extractGolden = (preferGolden && goldenOwned > 0) || normalOwned <= 0;
    const val = extractGolden
      ? GOLDEN_DISENCHANT_VALUE[def.rarity] || 50
      : DISENCHANT_VALUE[def.rarity] || 5;

    col[cardId] = totalOwned - 1;
    if (col[cardId] <= 0) delete col[cardId];
    if (extractGolden && goldenOwned > 0) {
      gcol[cardId] = goldenOwned - 1;
      if (gcol[cardId] <= 0) delete gcol[cardId];
      this.saveGoldenCollection(gcol);
    }

    const p = this.getProfile();
    p.arcaneDust += val;
    this.saveProfile(p);
    this.saveCollection(col);
    return { ok: true, dustGained: val };
  }

  previewMassDisenchant(): MassDisenchantPreview {
    const col = this.getCollection();
    const gcol = this.getGoldenCollection();
    let extraCardCount = 0;
    let affectedUniqueCards = 0;
    let dustGained = 0;
    const sampleAffectedCards: MassDisenchantPreview['sampleAffectedCards'] = [];

    for (const c of cardDb.getAllCollectible()) {
      if (c.rarity === 'FREE') continue;
      const limit = c.rarity === 'LEGENDARY' ? 1 : 2;
      const owned = col[c.id] || 0;
      if (owned > limit) {
        const extra = owned - limit;
        const goldenOwned = Math.min(owned, gcol[c.id] || 0);
        const normalOwned = Math.max(0, owned - goldenOwned);
        const normalDisenchanted = Math.min(extra, normalOwned);
        const goldenDisenchanted = Math.max(0, extra - normalDisenchanted);
        const normalUnit = DISENCHANT_VALUE[c.rarity] || 5;
        const goldenUnit = GOLDEN_DISENCHANT_VALUE[c.rarity] || 50;

        extraCardCount += extra;
        affectedUniqueCards += 1;
        dustGained += normalDisenchanted * normalUnit + goldenDisenchanted * goldenUnit;
        if (sampleAffectedCards.length < 6) {
          sampleAffectedCards.push({
            id: c.id,
            name: c.name,
            owned,
            afterCount: limit,
          });
        }
      }
    }

    return {
      extraCardCount,
      affectedUniqueCards,
      dustGained,
      sampleAffectedCards,
    };
  }

  massDisenchantExtras(): { count: number; dustGained: number } {
    const col = this.getCollection();
    const gcol = this.getGoldenCollection();
    let count = 0;
    let dustGained = 0;
    for (const c of cardDb.getAllCollectible()) {
      if (c.rarity === 'FREE') continue;
      const limit = c.rarity === 'LEGENDARY' ? 1 : 2;
      const owned = col[c.id] || 0;
      if (owned > limit) {
        const extra = owned - limit;
        const goldenOwned = Math.min(owned, gcol[c.id] || 0);
        const normalOwned = Math.max(0, owned - goldenOwned);
        const normalDisenchanted = Math.min(extra, normalOwned);
        const goldenDisenchanted = Math.max(0, extra - normalDisenchanted);
        const normalUnit = DISENCHANT_VALUE[c.rarity] || 5;
        const goldenUnit = GOLDEN_DISENCHANT_VALUE[c.rarity] || 50;

        count += extra;
        dustGained += normalDisenchanted * normalUnit + goldenDisenchanted * goldenUnit;
        col[c.id] = limit;
        if (goldenDisenchanted > 0) {
          const nextGold = Math.max(0, goldenOwned - goldenDisenchanted);
          if (nextGold > 0) gcol[c.id] = nextGold;
          else delete gcol[c.id];
        }
      }
    }
    if (count > 0) {
      const p = this.getProfile();
      p.arcaneDust += dustGained;
      this.saveProfile(p);
      this.saveCollection(col);
      this.saveGoldenCollection(gcol);
    }
    return { count, dustGained };
  }

  grantPacks(count: number): void {
    const safeCount = Math.max(0, Math.floor(count));
    if (safeCount <= 0) return;
    const p = this.getProfile();
    p.packs += safeCount;
    this.saveProfile(p);
  }

  setJourneyProgress(episode: number, reincarnation = 0): void {
    const p = this.getProfile();
    const safeReinc = Math.max(0, Math.floor(reincarnation));
    const minEp = safeReinc > 0 ? 1 : 0;
    p.journeyReincarnation = safeReinc;
    p.journeyEpisode = Math.max(minEp, Math.min(40, Math.floor(episode)));
    p.journeyGuideDone = true;
    this.saveProfile(p);
  }

  addCardCopies(cardId: string, copies = 1): void {
    const def = cardDb.getCard(cardId);
    if (!def || copies <= 0) return;
    const col = this.getCollection();
    col[cardId] = Math.max(0, (col[cardId] || 0) + Math.floor(copies));
    this.saveCollection(col);
  }

  unlockMasterCollection(): void {
    const col = this.getCollection();
    for (const c of cardDb.getAllCollectible()) {
      const target = 3;
      col[c.id] = Math.max(col[c.id] || 0, target);
    }
    const p = this.getProfile();
    p.masterUnlocked = true;
    p.journeyGuideDone = true;
    p.gold += 1000;
    p.arcaneDust += 1600;
    p.packs += 10;
    this.saveCollection(col);
    this.saveProfile(p);
  }

  resetAllData(): void {
    localStorage.removeItem(KEYS.PROFILE);
    localStorage.removeItem(KEYS.COLLECTION);
    localStorage.removeItem(KEYS.GOLDEN_COLLECTION);
    localStorage.removeItem(KEYS.DECKS);
    localStorage.removeItem(KEYS.QUESTS);
    localStorage.removeItem(KEYS.PITY);
    localStorage.setItem(KEYS.LORE_VER, CURRENT_LORE_VERSION);
    this.ensureInitialized();
    emitStateChanged();
  }

  recordQuestProgress(kind: 'WIN' | 'MINION' | 'SPELL', amount = 1): number {
    const quests = this.getQuests();
    let goldEarned = 0;
    const mapId = kind === 'WIN' ? 'q_win_3' : kind === 'MINION' ? 'q_play_minions' : 'q_cast_spells';
    for (const q of quests) {
      if (q.id === mapId && !q.completed) {
        q.progress = Math.min(q.goal, q.progress + amount);
        if (q.progress >= q.goal) {
          q.completed = true;
          q.bonusClaimed = false;
          goldEarned += q.rewardGold;
        }
      }
    }
    this.saveQuests(quests);
    if (goldEarned > 0) {
      const p = this.getProfile();
      p.gold += goldEarned;
      this.saveProfile(p);
    }
    return goldEarned;
  }

  /**
   * Claim the completion bonus (+20G mastery reward, plus base rewardGold if not yet marked completed)
   * for a single completed Daily Quest when the player clicks the quest card.
   */
  claimCompletedQuest(questId: string): { claimed: boolean; goldGranted: number } {
    const quests = this.getQuests();
    const target = quests.find((q) => q.id === questId);
    if (!target || (!target.completed && target.progress < target.goal) || target.bonusClaimed) {
      return { claimed: false, goldGranted: 0 };
    }
    const baseUnpaid = !target.completed ? target.rewardGold : 0;
    target.completed = true;
    target.bonusClaimed = true;
    const goldGranted = baseUnpaid + 20;
    this.saveQuests(quests);
    const p = this.getProfile();
    p.gold += goldGranted;
    this.saveProfile(p);
    return { claimed: true, goldGranted };
  }

  /**
   * 1-Click "Claim All" bonus for completed Daily Quests (+20G mastery chest per quest).
   */
  claimAllCompletedQuests(): { claimedCount: number; goldGranted: number } {
    const quests = this.getQuests();
    let claimedCount = 0;
    let goldGranted = 0;
    for (const q of quests) {
      if ((q.completed || q.progress >= q.goal) && !q.bonusClaimed) {
        const baseUnpaid = !q.completed ? q.rewardGold : 0;
        q.completed = true;
        q.bonusClaimed = true;
        claimedCount += 1;
        goldGranted += baseUnpaid + 20;
      }
    }
    if (claimedCount <= 0) {
      return { claimedCount: 0, goldGranted: 0 };
    }
    this.saveQuests(quests);
    const p = this.getProfile();
    p.gold += goldGranted;
    this.saveProfile(p);
    return { claimedCount, goldGranted };
  }

  /**
   * DEV-027: Place Gold wager on entry to Bogart's Gambling Hall.
   */
  placeBogartWager(stakeGold: number): { ok: boolean; remainingGold: number } {
    const safeStake = Math.max(100, Math.floor(stakeGold || 100));
    const p = this.getProfile();
    if (p.gold < safeStake) {
      return { ok: false, remainingGold: p.gold };
    }
    p.gold -= safeStake;
    this.saveProfile(p);
    return { ok: true, remainingGold: p.gold };
  }

  /**
   * DEV-027 / DEV-031: Ocarina Fairy Fountain Bankruptcy Relief (<100G: up to 3x/day +150G instant + +200G Ranked 1-win comeback buff).
   */
  getFairyReliefStatus(p = this.getProfile()): { remainingToday: number; comebackActive: boolean } {
    const today = new Date().toISOString().slice(0, 10);
    const used = p.fairyReliefDate === today ? Math.max(0, p.fairyReliefUsedToday || 0) : 0;
    return {
      remainingToday: Math.max(0, 3 - used),
      comebackActive: Boolean(p.fairyComebackBonusActive),
    };
  }

  claimBogartReliefChip(): {
    granted: boolean;
    newGold: number;
    remainingToday: number;
  } {
    const p = this.getProfile();
    const today = new Date().toISOString().slice(0, 10);
    const used = p.fairyReliefDate === today ? Math.max(0, p.fairyReliefUsedToday || 0) : 0;
    if (p.gold >= 100 || used >= 3) {
      return { granted: false, newGold: p.gold, remainingToday: Math.max(0, 3 - used) };
    }
    p.gold += 150;
    p.fairyReliefDate = today;
    p.fairyReliefUsedToday = used + 1;
    p.fairyComebackBonusActive = true;
    this.saveProfile(p);
    return {
      granted: true,
      newGold: p.gold,
      remainingToday: Math.max(0, 3 - p.fairyReliefUsedToday),
    };
  }

  /**
   * DEV-027: Purchase with Gold (if unowned) and immediately equip any of the 4 Prestige Cosmetic categories.
   */
  purchaseOrEquipPrestige(itemId: string): {
    ok: boolean;
    action: 'PURCHASED' | 'EQUIPPED' | 'INSUFFICIENT_GOLD' | 'NOT_FOUND';
    remainingGold: number;
  } {
    const item = GOLD_PRESTIGE_ITEMS.find((i) => i.id === itemId);
    const p = this.getProfile();
    if (!item) return { ok: false, action: 'NOT_FOUND', remainingGold: p.gold };

    const isOwned =
      item.costGold === 0 ||
      (item.category === 'BADGE' && p.prestige.ownedBadges.includes(item.id)) ||
      (item.category === 'FRAME' && p.prestige.ownedFrames.includes(item.id)) ||
      (item.category === 'CARDBACK' &&
        item.cardBackId &&
        p.prestige.ownedCardBacks.includes(item.cardBackId)) ||
      (item.category === 'TITLE' && p.prestige.ownedTitles.includes(item.id));

    if (!isOwned) {
      if (p.gold < item.costGold) {
        return { ok: false, action: 'INSUFFICIENT_GOLD', remainingGold: p.gold };
      }
      p.gold -= item.costGold;
      if (item.category === 'BADGE') {
        p.prestige.ownedBadges = Array.from(new Set([...p.prestige.ownedBadges, item.id]));
      } else if (item.category === 'FRAME') {
        p.prestige.ownedFrames = Array.from(new Set([...p.prestige.ownedFrames, item.id]));
      } else if (item.category === 'CARDBACK' && item.cardBackId) {
        p.prestige.ownedCardBacks = Array.from(
          new Set([...p.prestige.ownedCardBacks, item.cardBackId]),
        );
      } else if (item.category === 'TITLE') {
        p.prestige.ownedTitles = Array.from(new Set([...p.prestige.ownedTitles, item.id]));
      }
    }

    if (item.category === 'BADGE') {
      p.prestige.equippedBadge = item.id;
    } else if (item.category === 'FRAME') {
      p.prestige.equippedFrame = item.id;
    } else if (item.category === 'CARDBACK' && item.cardBackId) {
      p.selectedCardBack = item.cardBackId;
    } else if (item.category === 'TITLE') {
      p.prestige.equippedTitle = item.id;
    }

    this.saveProfile(p);
    return {
      ok: true,
      action: isOwned ? 'EQUIPPED' : 'PURCHASED',
      remainingGold: p.gold,
    };
  }

  recordMatchOutcome(
    heroClass: HeroClass,
    didWin: boolean,
    mode: GameMode,
    opponentClass?: HeroClass,
    bogartStakeGold = 0,
  ): MatchRewardBreakdown {
    const p = this.getProfile();
    const prevRank = p.rank;
    p.totalGames += 1;

    // DEV-028: Official Ranked Record exclusively tracks RANKED matches!
    if (mode === 'RANKED') {
      p.rankedGames = (p.rankedGames || 0) + 1;
    }

    let baseWinGold = 0;
    let bonusGold = 0;
    let bonusLabel: string | null = null;
    let packsEarned = 0;
    let packReason: string | null = null;
    let streakBonus = false;
    let bogartPayoutGold: number | undefined;
    let clearedEpisode: number | undefined;
    let nextEpisode: number | undefined;
    let nextReincarnation: number | undefined;
    let reincarnatedNow = false;

    if (didWin) {
      p.totalWins += 1;
      p.classWins[heroClass] = (p.classWins[heroClass] || 0) + 1;
      if (mode === 'RANKED') {
        p.rankedWins = (p.rankedWins || 0) + 1;
        p.rankedWinStreak = (p.rankedWinStreak || 0) + 1;
        p.rankedBestStreak = Math.max(p.rankedBestStreak || 0, p.rankedWinStreak);
        p.winStreak = p.rankedWinStreak;
      }

      if (mode === 'BOGART_GAMBLE') {
        const stake = Math.max(100, Math.floor(bogartStakeGold || 100));
        bogartPayoutGold = stake * 2;
        baseWinGold = stake;
        bonusGold = stake;
        bonusLabel = tr(
          `🎲 보가트의 도박장 승리 상금 (판돈 ${stake}G × 2배!)`,
          `🎲 Bogart's Gambling Hall Jackpot (${stake}G × 2x Payout!)`,
        );
        p.bogartStats.totalMatches += 1;
        p.bogartStats.wins += 1;
        p.bogartStats.netGoldProfit += stake;
        p.bogartStats.biggestPotWon = Math.max(p.bogartStats.biggestPotWon || 0, bogartPayoutGold);
      } else if (mode === 'TUTORIAL') {
        const curReinc = p.journeyReincarnation || 0;
        const rawEp = Number.isFinite(p.journeyEpisode) ? p.journeyEpisode : curReinc > 0 ? 1 : 0;
        const curEp = Math.max(curReinc > 0 ? 1 : 0, Math.min(40, Math.floor(rawEp)));
        clearedEpisode = curEp;

        if (curEp === 0 && curReinc === 0) {
          baseWinGold = 50;
          if (!p.journeyGuideDone) {
            p.journeyGuideDone = true;
            bonusGold += 50;
            bonusLabel = tr('에피소드 0 튜토리얼 수료 보너스', 'Episode 0 Tutorial Completion Bonus');
          }
          p.journeyEpisode = 1;
          nextEpisode = 1;
          nextReincarnation = 0;
        } else {
          const stageIndex = curReinc * 40 + curEp;
          const isFirstClearOfStage = stageIndex > (p.journeyMaxStageCleared || 0);

          baseWinGold = 40 + curEp * 5 + curReinc * 35;

          if (isFirstClearOfStage) {
            p.journeyMaxStageCleared = stageIndex;
            bonusGold += 30;
            bonusLabel = tr('최초 회차 돌파 보너스', 'First Clear Bonus');
            if (curEp === 40) {
              bonusGold += 300;
              bonusLabel = tr('40화 대단원 완주 & 환생 개방 특전', 'Episode 40 Finale & Reincarnation Bonus');
              packsEarned += 3;
              packReason = tr(
                `제${curReinc + 1}차 여정 완주 보상 (눈히어로 팩 +3)`,
                `Journey Run #${curReinc + 1} Clear Reward (+3 Packs)`,
              );
            } else if (curEp % 5 === 0) {
              packsEarned += 1;
              packReason = tr(
                `제${curEp}화 챕터 보스 최초 토벌 보상 (눈히어로 팩 +1)`,
                `Episode ${curEp} Boss Clear Reward (+1 Pack)`,
              );
            }
          }

          if (curEp >= 40) {
            p.journeyReincarnation = curReinc + 1;
            p.journeyEpisode = 1;
            reincarnatedNow = true;
          } else {
            p.journeyEpisode = curEp + 1;
          }
          nextEpisode = p.journeyEpisode;
          nextReincarnation = p.journeyReincarnation;
        }
      } else if (mode === 'RANKED') {
        baseWinGold = 25;
        p.threeWinCounter += 1;
        if (p.threeWinCounter >= 3) {
          p.threeWinCounter = 0;
          bonusGold = 30;
          bonusLabel = tr('등급전 3승 달성 보너스', 'Ranked 3-Win Milestone Bonus');
        }
        if (p.fairyComebackBonusActive) {
          p.fairyComebackBonusActive = false;
          bonusGold += 200;
          bonusLabel = tr(
            '🧚 엘윈 성소 요정 샘 재기 달성 보너스 (+200G!)',
            '🧚 Fairy Fountain Comeback Victory Bonus (+200G!)',
          );
        }
        if (p.rank > 0) {
          const starGain = p.rankedWinStreak >= 3 && p.rank > 5 ? 2 : 1;
          streakBonus = starGain === 2;
          p.stars += starGain;
          while (p.rank > 0 && p.stars >= getStarsNeededForRank(p.rank)) {
            p.stars -= getStarsNeededForRank(p.rank);
            p.rank -= 1;
            if (p.rank === 0) {
              p.stars = 1;
              break;
            }
          }
        }
      } else if (mode === 'CASUAL') {
        baseWinGold = 15;
        p.threeWinCounter += 1;
        if (p.threeWinCounter >= 3) {
          p.threeWinCounter = 0;
          bonusGold = 20;
          bonusLabel = tr('일반전 3승 달성 보너스', 'Casual 3-Win Milestone Bonus');
        }
      } else if (mode === 'PRACTICE_NORMAL') {
        baseWinGold = 10;
        if (opponentClass && !p.practiceNormalCleared.includes(opponentClass)) {
          p.practiceNormalCleared = [...p.practiceNormalCleared, opponentClass];
          bonusGold = 25;
          bonusLabel = tr('수련(일반) 종족 최초 제압 보너스', 'Normal AI Faction First-Clear Bonus');
        }
      } else if (mode === 'PRACTICE_EXPERT') {
        baseWinGold = 20;
        if (opponentClass && !p.practiceExpertCleared.includes(opponentClass)) {
          p.practiceExpertCleared = [...p.practiceExpertCleared, opponentClass];
          bonusGold = 50;
          bonusLabel = tr('수련(숙련가) 종족 최초 제압 보너스', 'Expert AI Faction First-Clear Bonus');
          if (p.practiceExpertCleared.length === HERO_CLASS_ORDER.length) {
            packsEarned += 2;
            packReason = tr(
              '엘윈마을 9종족 숙련가 전원 제압 마스터 보상 (눈히어로 팩 +2)',
              'All 9 Expert AI Champions Defeated (+2 Packs)',
            );
          }
        }
      }

      p.gold += baseWinGold + bonusGold;
      p.packs += packsEarned;
    } else {
      if (mode === 'RANKED') {
        p.rankedWinStreak = 0;
        p.winStreak = 0;
        if (p.rank > 0 && p.rank <= 20) {
          if (p.stars > 0) {
            p.stars -= 1;
          } else if (p.rank < 20) {
            p.rank += 1;
            p.stars = getStarsNeededForRank(p.rank) - 1;
          }
        }
      } else if (mode === 'BOGART_GAMBLE') {
        const stake = Math.max(100, Math.floor(bogartStakeGold || 100));
        bogartPayoutGold = 0;
        p.bogartStats.totalMatches += 1;
        p.bogartStats.netGoldProfit -= stake;
      }
      if (mode === 'TUTORIAL') {
        nextEpisode = p.journeyEpisode;
        nextReincarnation = p.journeyReincarnation;
      }
    }

    this.saveProfile(p);
    const questGold = didWin ? this.recordQuestProgress('WIN', 1) : 0;
    const totalEarned = baseWinGold + bonusGold + questGold;

    return {
      mode,
      didWin,
      goldEarned: totalEarned,
      goldDelta: totalEarned,
      baseWinGold,
      bonusGold,
      bonusLabel,
      questGold,
      packsEarned,
      packReason,
      prevRank,
      newRank: p.rank,
      newStars: p.stars,
      streakBonus,
      threeWinProgress: p.threeWinCounter,
      bogartStakeGold: mode === 'BOGART_GAMBLE' ? Math.max(100, Math.floor(bogartStakeGold || 100)) : undefined,
      bogartPayoutGold,
      isOfficialRanked: mode === 'RANKED',
      clearedEpisode,
      nextEpisode,
      nextReincarnation,
      reincarnatedNow,
    };
  }

  /**
   * /game.html 전용 (hero_hs_* 네임스페이스) 세이브 데이터 백업 JSON 생성
   * - /#setting 메인 게임(hero_*) 및 /stone.html(stone_hs_*) 데이터와 100% 독립
   */
  exportGameBackupData(): { keyCount: number; jsonString: string } {
    const payload: Record<string, string> = {};
    let count = 0;
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('hero_hs_')) continue;
        const val = localStorage.getItem(key);
        if (val !== null && val !== '') {
          payload[key] = val;
          count += 1;
        }
      }
    } catch {
      // ignore storage read error
    }

    const exportObj = {
      app: 'SNSHero Elwin Card Battle (/game.html)',
      namespace: 'hero_hs_*',
      version: CURRENT_LORE_VERSION,
      exportTimestamp: Date.now(),
      exportIsoDate: new Date().toISOString(),
      keyCount: count,
      data: payload,
    };

    return {
      keyCount: count,
      jsonString: JSON.stringify(exportObj, null, 2),
    };
  }

  downloadGameBackupFile(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const { jsonString } = this.exportGameBackupData();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const fileName = `snshero_game_hs_backup_${dateStr}.json`;

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * /game.html 전용 (hero_hs_*) 백업 JSON 복원
   * - 오직 hero_hs_* 접두사 키만 복원하여 다른 게임 데이터와 간섭하지 않음
   */
  restoreGameBackupJson(jsonText: string): {
    success: boolean;
    restoredCount: number;
    message: string;
  } {
    try {
      const parsed = JSON.parse(jsonText);
      const dataObj = parsed?.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      if (!dataObj || typeof dataObj !== 'object') {
        return {
          success: false,
          restoredCount: 0,
          message: '유효한 백업 JSON 형식이 아닙니다.',
        };
      }

      let count = 0;
      for (const [key, val] of Object.entries(dataObj)) {
        if (typeof key === 'string' && key.startsWith('hero_hs_') && typeof val === 'string') {
          localStorage.setItem(key, val);
          count += 1;
        }
      }

      if (count === 0) {
        return {
          success: false,
          restoredCount: 0,
          message: '복원 가능한 눈히어로 카드배틀(hero_hs_*) 데이터가 없습니다.',
        };
      }

      emitStateChanged();
      return {
        success: true,
        restoredCount: count,
        message: `눈히어로 카드배틀 데이터 ${count}개 항목을 성공적으로 복원했습니다.`,
      };
    } catch {
      return {
        success: false,
        restoredCount: 0,
        message: '백업 코드 또는 JSON 파일 형식이 올바르지 않습니다.',
      };
    }
  }

  /**
   * /game.html 전용 데이터만 초기화 (hero_hs_* 키만 제거 후 기본값 재생성)
   * - /#setting(hero_*) 및 /stone.html(stone_hs_*) 데이터는 100% 보존
   */
  resetGameDataOnly(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.startsWith('hero_hs_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore storage error
    }
    this.ensureInitialized();
    emitStateChanged();
  }

  isSafeguardBonusClaimed(): boolean {
    try {
      return localStorage.getItem('hero_hs_safeguard_bonus_claimed') === '1';
    } catch {
      return false;
    }
  }

  claimSafeguardBackupBonus(): { granted: boolean; goldAdded: number } {
    try {
      if (localStorage.getItem('hero_hs_safeguard_bonus_claimed') === '1') {
        return { granted: false, goldAdded: 0 };
      }
      localStorage.setItem('hero_hs_safeguard_bonus_claimed', '1');
      const p = this.getProfile();
      p.gold += 100;
      this.saveProfile(p);
      return { granted: true, goldAdded: 100 };
    } catch {
      return { granted: false, goldAdded: 0 };
    }
  }

  claimPromoPrePack(): { claimed: boolean; cards: OpenedPackCard[] } {
    try {
      const raw = localStorage.getItem('hero_hs_promo_pack');
      if (!raw) return { claimed: false, cards: [] };
      const parsed = JSON.parse(raw) as { id: string; isGolden?: boolean }[];
      localStorage.removeItem('hero_hs_promo_pack');
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return { claimed: false, cards: [] };
      }
      this.ensureInitialized();
      const col = this.getCollection();
      const gcol = this.getGoldenCollection();
      const pity = this.getPackPityState();
      const claimedCards: OpenedPackCard[] = [];
      let pulledLeg = false;
      let pulledEpic = false;

      for (const item of parsed) {
        const def = cardDb.getCard(item.id);
        if (!def) continue;
        const prevCount = col[def.id] || 0;
        const nextCount = prevCount + 1;
        col[def.id] = nextCount;
        const isGolden = Boolean(item.isGolden);
        if (isGolden) {
          gcol[def.id] = (gcol[def.id] || 0) + 1;
        }
        pity.everObtainedMaxCopies[def.id] = Math.max(
          pity.everObtainedMaxCopies[def.id] || 0,
          nextCount,
        );
        if (def.rarity === 'LEGENDARY') pulledLeg = true;
        if (def.rarity === 'EPIC') pulledEpic = true;
        claimedCards.push({
          card: def,
          isGolden,
          isNew: prevCount === 0,
          newOwnedCount: nextCount,
          newJourneyMultiplier: getJourneyCardMultiplier(def, nextCount),
        });
      }

      if (claimedCards.length === 0) {
        return { claimed: false, cards: [] };
      }

      const p = this.getProfile();
      if (p.packs > 0) {
        p.packs -= 1;
      }
      pity.totalPacksOpened += 1;
      if (pulledLeg) {
        pity.firstTenLegendaryClaimed = true;
        pity.packsSinceLegendary = 0;
      } else {
        pity.packsSinceLegendary += 1;
      }
      if (pulledEpic) {
        pity.packsSinceEpic = 0;
      } else {
        pity.packsSinceEpic += 1;
      }

      this.saveProfile(p);
      this.saveCollection(col);
      this.saveGoldenCollection(gcol);
      this.savePackPityState(pity);
      return { claimed: true, cards: claimedCards };
    } catch {
      return { claimed: false, cards: [] };
    }
  }

  countTwoCopyAwakenableCards(isKo: boolean = isKoreanLanguage()): {
    count: number;
    sampleNames: string[];
  } {
    const col = this.getCollection();
    let count = 0;
    const sampleNames: string[] = [];
    for (const c of cardDb.getAllCollectible()) {
      if (!hasCombatStatsForJourney(c) || c.rarity === 'FREE') continue;
      const owned = col[c.id] || 0;
      const neededOneMore = c.rarity === 'LEGENDARY' ? owned === 1 : owned === 2;
      if (neededOneMore) {
        count += 1;
        if (sampleNames.length < 3) {
          sampleNames.push(isKo ? c.name : c.nameEn || c.name);
        }
      }
    }
    return { count, sampleNames };
  }
}

export const hsStorage = new HearthstoneStorage();
