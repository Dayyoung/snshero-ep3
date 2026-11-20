import React, { useCallback, useEffect, useRef, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { useModalDismiss } from '../useModalDismiss';
import {
  CLASS_CREST_URL,
  CRAFTING_COST,
  DISENCHANT_VALUE,
  GOLDEN_DISENCHANT_VALUE,
} from '../cardDb';
import {
  getCardClassLabel,
  getCardRaceLabel,
  getCardRarityLabel,
  getCardCharName,
  getCardFactionLabel,
  getCardFlavor,
  getCardName,
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

interface CardNovelLoreEntry {
  ep: number;
  epTitle: string;
  hook: string;
}

const CHARACTER_LORE_RULES: Array<{
  keywords: string[];
  ko: CardNovelLoreEntry;
  en: CardNovelLoreEntry;
}> = [
  {
    keywords: ['알렉산', 'alexand'],
    ko: {
      ep: 1,
      epTitle: '제1화 · 눈보라 아래 두 서약',
      hook: '아기 카단을 품에 안고 눈보라 속 추적자들과 맞선 1대 성기사단장의 최후의 서약!',
    },
    en: {
      ep: 1,
      epTitle: 'EP.1 · Two Oaths Beneath the Blizzard',
      hook: 'Holding infant Kadan, First Paladin Alexandar makes his final stand on the burning bridge.',
    },
  },
  {
    keywords: ['카단', 'kadan'],
    ko: {
      ep: 1,
      epTitle: '제1화 · 눈보라 아래 두 서약',
      hook: '부서진 성기사단의 방패와 은빛 단검 하나로 심연의 제국을 뒤집은 눈히어로의 출발점!',
    },
    en: {
      ep: 1,
      epTitle: 'EP.1 · Two Oaths Beneath the Blizzard',
      hook: 'How Kadan inherited the Silver Dagger and forged the Snow Hero legend of Elwin Village.',
    },
  },
  {
    keywords: ['헤르쿨', '아케', 'hercul', 'arche'],
    ko: {
      ep: 2,
      epTitle: '제2화 · 일곱 추적자의 맹세',
      hook: '피의 항구에서 일곱 추적자와 맺은 18년 재회 맹세와 순례 성기사의 사투!',
    },
    en: {
      ep: 2,
      epTitle: 'EP.2 · Oath of the Seven Trackers',
      hook: 'Arche-Hercul’s harbor clash and the blood pact to raise Kadan and Ignis.',
    },
  },
  {
    keywords: ['이그니스', 'ignis'],
    ko: {
      ep: 10,
      epTitle: '제10화 · 불꽃 궁정의 포로',
      hook: '불꽃 궁정의 포로가 된 카단과 태양의 후계자 이그니스가 처음 마주한 운명의 대결!',
    },
    en: {
      ep: 10,
      epTitle: 'EP.10 · Prisoner of the Flame Court',
      hook: 'Kadan faces Ignis, heir of the Crimson Glass Court, inside the blazing arena.',
    },
  },
  {
    keywords: ['말라카이', 'malach'],
    ko: {
      ep: 18,
      epTitle: '제18화 · 검은 성전의 비밀',
      hook: '바람 속삭임 섬 지하 검은 성전에 숨겨진 고대 유산과 금단의 진실!',
    },
    en: {
      ep: 18,
      epTitle: 'EP.18 · Secret of the Black Sanctuary',
      hook: 'Ancient forbidden truths unearthed beneath Windwhisper Isle’s Black Sanctuary.',
    },
  },
  {
    keywords: ['아르투스', 'artus'],
    ko: {
      ep: 25,
      epTitle: '제25화 · 거짓된 혼례',
      hook: '수도 라이트헤븐 백리석 대성당을 습격한 섀도우렐름 섭정 데스나이트의 음모!',
    },
    en: {
      ep: 25,
      epTitle: 'EP.25 · The False Wedding',
      hook: 'Death Knight Artus unveils Shadowrealm’s ambush inside Lighthaven Cathedral.',
    },
  },
  {
    keywords: ['에일라', 'aila'],
    ko: {
      ep: 2,
      epTitle: '제2화 · 일곱 추적자의 맹세',
      hook: '달빛 실반의 초승달 대마도사 에일라와 일곱 추적자의 항구 대격돌!',
    },
    en: {
      ep: 2,
      epTitle: 'EP.2 · Oath of the Seven Trackers',
      hook: 'Moonlight Archmage Aila tests Hercul with ancient elven runes.',
    },
  },
  {
    keywords: ['그림리', '아이언포지', 'grimli', 'ironforge'],
    ko: {
      ep: 12,
      epTitle: '제12화 · 두 무덤 사이의 봄',
      hook: '딥포지 공방의 황금 거신병과 봉인 석실을 수호하는 강철의 시험!',
    },
    en: {
      ep: 12,
      epTitle: 'EP.12 · Spring Between Two Graves',
      hook: 'The Deepforge Colossus guards the sealed vault beneath the twin graves.',
    },
  },
  {
    keywords: ['펜릴', 'fenrir'],
    ko: {
      ep: 4,
      epTitle: '제4화 · 황야에서 자란 아이',
      hook: '만년설 황야의 정복왕 펜릴과 북방에서 성장한 카단의 첫 전쟁 서막!',
    },
    en: {
      ep: 4,
      epTitle: 'EP.4 · Child Raised by the Tundra',
      hook: 'Frostwolf King Fenrir’s northern steppes forge the young Snow Hero.',
    },
  },
  {
    keywords: ['포세이돈', 'poseidon'],
    ko: {
      ep: 20,
      epTitle: '제20화 · 꽃배를 삼킨 파도',
      hook: '바람섬 앞바다를 덮친 심연 해구 바다신의 거대한 해일!',
    },
    en: {
      ep: 20,
      epTitle: 'EP.20 · Waves Swallowing the Blossom Boat',
      hook: 'Abyssal Sea God Poseidon unleashes a tidal trial across open waters.',
    },
  },
  {
    keywords: ['루시안', 'lucian'],
    ko: {
      ep: 38,
      epTitle: '제38화 · 세 개의 명주 봉인',
      hook: '파멸의 제단 최정상 흑요석 옥좌에서 펼쳐지는 재상 루시안과의 최종 결전!',
    },
    en: {
      ep: 38,
      epTitle: 'EP.38 · Three Crimson Thread Seals',
      hook: 'Final showdown against Chancellor Lucian atop the Obsidian Throne.',
    },
  },
  {
    keywords: ['엘윈', 'elwin'],
    ko: {
      ep: 1,
      epTitle: '제1화 · 눈보라 아래 두 서약',
      hook: '혹한의 북방 설원을 헤치며 아기 카단과 은빛 단검을 끝까지 지켜낸 강인한 어머니!',
    },
    en: {
      ep: 1,
      epTitle: 'EP.1 · Two Oaths Beneath the Blizzard',
      hook: 'Lady Elwin braves the northern blizzard to protect infant Kadan and the Silver Dagger.',
    },
  },
  {
    keywords: ['가웨인', '로비냐드', '벨페고르', 'gawain', 'robinyard', 'belphegor'],
    ko: {
      ep: 3,
      epTitle: '제3화 · 안개 절벽의 혈투',
      hook: '맹인 검성 가웨인과 명궁 로비냐드가 안개 절벽에서 결정술사 벨페고르와 맞선 처절한 사투!',
    },
    en: {
      ep: 3,
      epTitle: 'EP.3 · Blood Battle on Mist Cliff',
      hook: 'Blind swordmaster Gawain and archer Robinyard clash with Belphegor atop Mist Cliff.',
    },
  },
  {
    keywords: ['길가메시', '바르가스트', '우르삭', '그리폰', 'gilgamesh', 'barghest', 'ursoc', 'griffon'],
    ko: {
      ep: 4,
      epTitle: '제4화 · 황야에서 자란 아이',
      hook: '북방 설원 유목민 전우 길가메시와 야성 영수들이 소년 카단과 우정을 다진 대평원 서막!',
    },
    en: {
      ep: 4,
      epTitle: 'EP.4 · Child Raised by the Tundra',
      hook: 'Northern steppe companion Gilgamesh and primal beasts stand beside young Kadan.',
    },
  },
  {
    keywords: ['고르고', '메두사', '카제', 'gorgo', 'medusa', 'kaze'],
    ko: {
      ep: 5,
      epTitle: '제5화 · 독안개 속의 그림자',
      hook: '자욱한 폭우와 독안개 속에서 그림자 자객의 비기를 깨우쳐 메두사 고르고를 파훼한 결투!',
    },
    en: {
      ep: 5,
      epTitle: 'EP.5 · Shadow Inside the Venom Fog',
      hook: 'Kadan channels shadow-sense taught by Kaze to pierce Medusa Gorgo’s poison mist.',
    },
  },
  {
    keywords: ['말퓨온', '엘리아나', '티타니아', 'malfuon', 'eliana', 'titania'],
    ko: {
      ep: 6,
      epTitle: '제6화 · 여섯 스승과 성진호흡',
      hook: '별빛의 은자 말퓨온과 일곱 추적자 스승들의 비전이 하나의 성진호흡법으로 융합되는 순간!',
    },
    en: {
      ep: 6,
      epTitle: 'EP.6 · Six Masters & Star-Breathing',
      hook: 'Archsage Malfuon harmonizes the Seven Trackers’ teachings into Star-Breathing.',
    },
  },
  {
    keywords: ['페가수스', '적갈기', '론돌', '발보', 'pegasus', 'rondol', 'balbo'],
    ko: {
      ep: 8,
      epTitle: '제8화 · 적갈기의 기수',
      hook: '폭풍처럼 설원을 가르는 명마 적갈기 페가수스와 의리파 스승들의 뜨거운 출정!',
    },
    en: {
      ep: 8,
      epTitle: 'EP.8 · Rider of the Crimson Mane',
      hook: 'Taming the storm-swift Crimson Mane Pegasus across the northern plains.',
    },
  },
  {
    keywords: ['발리안', '이셀라', '콜로서스', 'balian', 'ysela', 'colossus'],
    ko: {
      ep: 10,
      epTitle: '제10화 · 불꽃 궁정의 포로',
      hook: '성창기사 발리안과 순백마도사 이셀라가 남긴 유산, 그리고 불꽃 궁정의 숨겨진 혈통 비밀!',
    },
    en: {
      ep: 10,
      epTitle: 'EP.10 · Prisoner of the Flame Court',
      hook: 'The sealed legacy of Paladin Balian and White Mage Ysela inside the Flame Court.',
    },
  },
  {
    keywords: ['레오나르', 'leonar'],
    ko: {
      ep: 13,
      epTitle: '제13화 · 녹옥 지팡이의 계승자',
      hook: '유랑민 연맹의 노장 레오나르가 대련 시험 끝에 카단에게 녹옥 지팡이를 맡긴 명장면!',
    },
    en: {
      ep: 13,
      epTitle: 'EP.13 · Heir of the Jade Staff',
      hook: 'Veteran Master Leonar entrusts the sacred Jade Staff after a trial by combat.',
    },
  },
  {
    keywords: ['아라크네', '워커', 'arachne', 'walker'],
    ko: {
      ep: 15,
      epTitle: '제15화 · 네 수문의 독거미',
      hook: '네 수문 장원을 덮친 맹독거미 아라크네와 언데드 암살단을 격파하고 해독제를 지켜낸 혈투!',
    },
    en: {
      ep: 15,
      epTitle: 'EP.15 · Venom Spider of Four Floodgates',
      hook: 'Defeating spider-assassin Arachne to claim the amethyst antidote vial.',
    },
  },
  {
    keywords: ['실리아', '실피드', '에올루스', '토람', 'celia', 'sylphid', 'aeolus', 'toram'],
    ko: {
      ep: 17,
      epTitle: '제17화 · 바람 속삭임 섬의 왕녀',
      hook: '녹옥 지팡이로 폭풍을 다스리는 왕녀 실리아와 바람섬 왕실의 운명적 만남!',
    },
    en: {
      ep: 17,
      epTitle: 'EP.17 · Princess of Windwhisper Isle',
      hook: 'Princess Celia wields her mother Sylphid’s Jade Staff amidst the sea-fog tempest.',
    },
  },
  {
    keywords: ['아쿠아로드', '레비아탄', '크라켄', 'aqualord', 'leviathan', 'kraken'],
    ko: {
      ep: 20,
      epTitle: '제20화 · 꽃배를 삼킨 파도',
      hook: '흑풍단 바다군주 아쿠아로드와 심연 마수 레비아탄이 격돌하는 대양 해상 결전!',
    },
    en: {
      ep: 20,
      epTitle: 'EP.20 · Waves Swallowing the Blossom Boat',
      hook: 'Sea-Lord Aqualord and Abyssal Leviathan clash across storm-tossed waters.',
    },
  },
  {
    keywords: ['간다르', 'gandar'],
    ko: {
      ep: 23,
      epTitle: '제23화 · 용의 석굴과 삼중 봉인',
      hook: '용의 석굴 깊은 곳 제단에서 펼쳐진 간다르와의 숙명적인 마력 대결!',
    },
    en: {
      ep: 23,
      epTitle: 'EP.23 · Dragon Grotto & Tripartite Seal',
      hook: 'Confronting Gandar before the sealed jade altar deep within Dragon Grotto.',
    },
  },
];

const CLASS_LORE_FALLBACK: Record<string, { ko: CardNovelLoreEntry; en: CardNovelLoreEntry }> = {
  PRIEST: {
    ko: {
      ep: 1,
      epTitle: '제1화 · 눈보라 아래 두 서약',
      hook: '인간종족 성기사 카단과 엘윈마을의 서막 — 무설치 원작 웹소설 제1화에서 시작됩니다.',
    },
    en: {
      ep: 1,
      epTitle: 'EP.1 · Two Oaths Beneath the Blizzard',
      hook: 'Human Paladin Kadan’s origin story begins in Episode 1 of the official web novel.',
    },
  },
  WARRIOR: {
    ko: {
      ep: 10,
      epTitle: '제10화 · 불꽃 궁정의 포로',
      hook: '불꽃 궁정 태양황제 이그니스와 타오르는 전설의 장면을 원작 소설로 확인하세요.',
    },
    en: {
      ep: 10,
      epTitle: 'EP.10 · Prisoner of the Flame Court',
      hook: 'Read Sun Emperor Ignis and the Flame Court saga in Episode 10.',
    },
  },
  MAGE: {
    ko: {
      ep: 20,
      epTitle: '제20화 · 꽃배를 삼킨 파도',
      hook: '심연 해역의 바다신 포세이돈과 물종족 비술이 폭발하는 해상 결전을 읽어보세요.',
    },
    en: {
      ep: 20,
      epTitle: 'EP.20 · Waves Swallowing the Blossom Boat',
      hook: 'Read Sea God Poseidon’s abyssal tide clash in Episode 20.',
    },
  },
  HUNTER: {
    ko: {
      ep: 18,
      epTitle: '제18화 · 검은 성전의 비밀',
      hook: '폭풍 바람섬 토람과 바람종족 비밀 유산을 다룬 제3막 핵심 에피소드입니다.',
    },
    en: {
      ep: 18,
      epTitle: 'EP.18 · Secret of the Black Sanctuary',
      hook: 'Explore Wind Isle’s Black Sanctuary lore in Episode 18.',
    },
  },
  PALADIN: {
    ko: {
      ep: 12,
      epTitle: '제12화 · 두 무덤 사이의 봄',
      hook: '대지 성채 수호자들과 굳건한 반석의 결의를 담은 원작 명장면을 열람하세요.',
    },
    en: {
      ep: 12,
      epTitle: 'EP.12 · Spring Between Two Graves',
      hook: 'Discover Earth Citadel’s guardians in Episode 12 of the novel.',
    },
  },
  ROGUE: {
    ko: {
      ep: 25,
      epTitle: '제25화 · 거짓된 혼례',
      hook: '섀도우렐름 섭정 아르투스와 언데드종족의 치밀한 암흑 계략이 펼쳐집니다.',
    },
    en: {
      ep: 25,
      epTitle: 'EP.25 · The False Wedding',
      hook: 'Read Death Knight Artus’s Shadowrealm intrigue in Episode 25.',
    },
  },
  SHAMAN: {
    ko: {
      ep: 2,
      epTitle: '제2화 · 일곱 추적자의 맹세',
      hook: '달빛 실반 대마도사 에일라와 정령 룬 마법의 기원을 원작 소설에서 확인하세요.',
    },
    en: {
      ep: 2,
      epTitle: 'EP.2 · Oath of the Seven Trackers',
      hook: 'Uncover Elf Archmage Aila’s spirit rune pact in Episode 2.',
    },
  },
  WARLOCK: {
    ko: {
      ep: 12,
      epTitle: '제12화 · 두 무덤 사이의 봄',
      hook: '딥포지 공방의 거신병 아이언포지와 드워프 비기를 담은 에피소드입니다.',
    },
    en: {
      ep: 12,
      epTitle: 'EP.12 · Spring Between Two Graves',
      hook: 'See Deepforge Colossus Ironforge’s trial in Episode 12.',
    },
  },
  DRUID: {
    ko: {
      ep: 4,
      epTitle: '제4화 · 황야에서 자란 아이',
      hook: '야성 설원의 빙결늑대왕 펜릴과 동물종족 군단의 맹위가 담긴 챕터입니다.',
    },
    en: {
      ep: 4,
      epTitle: 'EP.4 · Child Raised by the Tundra',
      hook: 'Follow Frostwolf King Fenrir in Episode 4 of the official novel.',
    },
  },
};

function getCardNovelLoreBridge(card: ClassicCardDef, isKo: boolean): CardNovelLoreEntry {
  const haystack = `${card.snsCharName || ''} ${card.snsCharNameEn || ''} ${card.name} ${card.nameEn || ''}`.toLowerCase();
  for (const rule of CHARACTER_LORE_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return isKo ? rule.ko : rule.en;
    }
  }
  const fb = CLASS_LORE_FALLBACK[card.cardClass];
  if (fb) {
    return isKo ? fb.ko : fb.en;
  }
  return isKo
    ? {
        ep: 1,
        epTitle: '제1화 · 눈보라 아래 두 서약',
        hook: '카단과 이그니스의 40부작 대서사시 — 지금 원작 웹소설과 스토리모드에서 만나보세요.',
      }
    : {
        ep: 1,
        epTitle: 'EP.1 · Two Oaths Beneath the Blizzard',
        hook: 'Begin the 40-chapter saga of Kadan & Ignis in the official web novel.',
      };
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
    if ((e.target as HTMLElement | null)?.closest('button, a')) return;
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

  const cardDisplayName = getCardName(card, lang);
  const cardDisplayFlavor = getCardFlavor(card, lang);
  const cardCharLabel = getCardCharName(card, lang);
  const cardFactionLabel = getCardFactionLabel(card, lang);

  const getClassLabel = (cardClass: CardClass): string => {
    if (isKo) {
      if (cardClass === 'NEUTRAL') return '중립';
      if (cardClass === 'DREAM') return '신록';
      return CLASSIC_HEROES[cardClass as HeroClass]?.classNameKo || cardClass;
    }
    return getCardClassLabel(cardClass, lang);
  };

  const getRarityLabel = (rarity: CardRarity): string =>
    isKo ? RARITY_LABEL_KO[rarity] : getCardRarityLabel(rarity, lang);

  const getRaceLabel = (race?: string): string => {
    if (!race) return '';
    return isKo ? RACE_KO[race] || race : getCardRaceLabel(race, lang);
  };

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
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/78 px-2 py-2 backdrop-blur-[3px] sm:px-8 sm:py-5"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishSwipe(e.pointerId)}
        onPointerCancel={(e) => finishSwipe(e.pointerId)}
        className="hs-wood-panel relative flex max-h-[94dvh] w-full max-w-[380px] touch-pan-y select-none flex-col items-center overflow-hidden rounded-3xl px-2.5 pb-3 pt-2.5 text-amber-100 shadow-[0_26px_70px_rgba(0,0,0,0.95)] sm:max-w-[464px] sm:px-5 sm:pb-4 sm:pt-3.5"
      >
        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('ui_click', 0.45);
            onCancel();
          }}
          aria-label={tr('카드 선택 취소', 'Close inspection')}
          className="hs-brass-btn absolute right-2 top-2 z-40 flex h-11 w-11 items-center justify-center rounded-full text-sm font-extrabold text-amber-100 sm:right-2.5 sm:top-2.5 sm:h-9 sm:w-9"
        >
          ✕
        </button>

        {/* Compact Top Header Badges (Pinned) */}
        <div className="mb-1 flex min-h-[34px] w-full shrink-0 flex-wrap items-center justify-center gap-1.5 pl-2 pr-11 sm:pr-10">
          {showFlavor && (
            <div
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-black tracking-wide shadow ${
                card.rarity === 'LEGENDARY'
                  ? 'border-yellow-200 bg-gradient-to-r from-amber-900 via-orange-700 to-amber-900 text-yellow-100 shadow-[0_0_14px_rgba(251,191,36,0.7)]'
                  : card.rarity === 'EPIC'
                    ? 'border-purple-300/85 bg-gradient-to-r from-purple-950 via-purple-800 to-purple-950 text-purple-100 shadow-[0_0_12px_rgba(192,132,252,0.55)]'
                    : card.rarity === 'RARE'
                      ? 'border-sky-300/80 bg-sky-950/95 text-sky-100 shadow-[0_0_10px_rgba(56,189,248,0.45)]'
                      : card.rarity === 'COMMON'
                        ? 'border-slate-300/70 bg-slate-900/95 text-slate-100'
                        : 'border-stone-500/70 bg-stone-900/95 text-stone-300'
              }`}
            >
              <span>
                {card.rarity === 'LEGENDARY'
                  ? '★'
                  : card.rarity === 'EPIC'
                    ? '◆'
                    : card.rarity === 'RARE'
                      ? '❖'
                      : card.rarity === 'COMMON'
                        ? '◇'
                        : '•'}
              </span>
              <span>
                {isGolden
                  ? tr(`황금 ${getRarityLabel(card.rarity)}`, `Golden ${getRarityLabel(card.rarity)}`)
                  : tr(`${getRarityLabel(card.rarity)} 카드`, `${getRarityLabel(card.rarity)} Card`)}
              </span>
            </div>
          )}
          {subtitleBadge && (
            <div className="max-w-full truncate rounded-full border border-amber-300/60 bg-stone-950/90 px-3 py-0.5 text-[11px] font-extrabold text-amber-200 shadow">
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

        {/* Scrollable Middle Body: Enlarged Card + Optional Live Battle Statuses / Collection Lore */}
        <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto overflow-x-hidden py-0.5">
          {/* Enlarged Card + Pedestal Rarity Halo + Left/Right Prev/Next Buttons */}
          <div className="relative flex w-full shrink-0 items-center justify-center">
            {(card.rarity === 'LEGENDARY' || card.rarity === 'EPIC' || card.rarity === 'RARE') && (
              <div
                style={{
                  background:
                    card.rarity === 'LEGENDARY'
                      ? 'radial-gradient(circle, rgba(251,191,36,0.38) 0%, rgba(234,88,12,0.16) 45%, transparent 72%)'
                      : card.rarity === 'EPIC'
                        ? 'radial-gradient(circle, rgba(192,132,252,0.32) 0%, rgba(126,34,206,0.14) 45%, transparent 72%)'
                        : 'radial-gradient(circle, rgba(56,189,248,0.24) 0%, transparent 70%)',
                }}
                className="pointer-events-none absolute h-[350px] w-[310px] rounded-full"
              />
            )}
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
              className={
                showFlavor
                  ? 'my-1 origin-center scale-[1.0] sm:my-4 sm:scale-[1.1]'
                  : 'my-4 origin-center scale-[1.08] sm:my-8 sm:scale-[1.18]'
              }
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

          {/* Live Board Minion Stats & Active Status Pills (only when inspecting a minion on the battlefield) */}
          {liveStats && (
            <div className="mt-1.5 flex w-full shrink-0 flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-[#a88246]/70 bg-stone-950/75 px-3 py-1.5">
              <span className="text-[11px] font-extrabold text-amber-200/90">
                {tr('현재 전장 수치', 'Live Stats')}
              </span>
              <div className="flex items-center gap-1">
                <HsAttackBadge
                  value={liveStats.attack}
                  buffed={liveStats.attack > (card.attack ?? 0)}
                  size={24}
                />
                <HsHealthBadge
                  value={liveStats.health}
                  state={
                    liveStats.health < liveStats.maxHealth
                      ? 'damaged'
                      : liveStats.maxHealth > (card.health ?? 1)
                        ? 'buffed'
                        : 'normal'
                  }
                  size={23}
                />
              </div>
              {liveStats.statuses && liveStats.statuses.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1">
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
            </div>
          )}

          {/* Collection / Pack Inspection Details (Dust, Flavor, Lore, 3x Share — hidden during battle play) */}
          {showFlavor && (
            <div className="mt-1.5 w-full shrink-0 rounded-2xl border-2 border-[#a88246] bg-gradient-to-b from-[#fdf6e4] to-[#ecdab5] px-3 py-2 text-[#221409] shadow-[inset_0_2px_8px_rgba(68,40,14,0.22)]">
              <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-[#5a3b1c]">
                <img
                  src={CLASS_CREST_URL[card.cardClass] || CLASS_CREST_URL.NEUTRAL}
                  alt=""
                  className="h-4 w-4 shrink-0 rounded-full border border-[#6e4c23] object-cover"
                />
                <span className="rounded bg-[#422813] px-1.5 py-0.5 text-[10.5px] font-extrabold text-amber-100">
                  {getClassLabel(card.cardClass)}
                </span>
                {cardCharLabel && cardCharLabel !== cardDisplayName && (
                  <span className="rounded border border-[#8c6432]/60 bg-[#f6e7c5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#4a2b0f]">
                    {cardCharLabel}
                    {cardFactionLabel && card.cardClass === 'NEUTRAL' ? ` · ${cardFactionLabel}` : ''}
                  </span>
                )}
                {(!cardCharLabel || cardCharLabel === cardDisplayName) &&
                  cardFactionLabel &&
                  card.cardClass === 'NEUTRAL' && (
                    <span className="rounded border border-[#8c6432]/60 bg-[#f6e7c5] px-1.5 py-0.5 text-[10px] font-extrabold text-[#4a2b0f]">
                      {cardFactionLabel}
                    </span>
                  )}
                <span>·</span>
                <span>{isKo ? TYPE_LABEL_KO[card.type] : TYPE_LABEL_EN[card.type]}</span>
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

              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 rounded-lg border border-[#a88246]/50 bg-[#f5e7c6] px-2.5 py-1 text-[10.5px] font-extrabold text-[#4a2b0f]">
                <span>
                  {card.rarity === 'FREE'
                    ? tr('기본 무료 지급 카드 (추출 불가)', 'Free Basic Card (Uncraftable)')
                    : tr(
                        `${getRarityLabel(card.rarity)}${isGolden ? ' (황금)' : ''} · ${card.rarity === 'LEGENDARY' ? '덱 1장 제한' : '덱 최대 2장'}`,
                        `${getRarityLabel(card.rarity)}${isGolden ? ' (Golden)' : ''} · ${card.rarity === 'LEGENDARY' ? 'Max 1 in deck' : 'Max 2 in deck'}`,
                      )}
                </span>
                {craftDust !== null && disenchantDust !== null && (
                  <span className="text-[#7c2d12]">
                    {tr(
                      `제작 ${craftDust.toLocaleString()} / 추출 +${disenchantDust.toLocaleString()}`,
                      `Craft ${craftDust.toLocaleString()} / Dust +${disenchantDust.toLocaleString()}`,
                    )}
                  </span>
                )}
              </div>

              {cardDisplayFlavor && (
                <p className="mt-1.5 text-center text-[11px] font-bold leading-snug text-[#5c3d1e]">
                  “{cardDisplayFlavor.replace(/<[^>]+>/g, '')}”
                </p>
              )}

              {/* MKT-052: Game-to-Novel Reverse Lore Bridge */}
              {(() => {
                const lore = getCardNovelLoreBridge(card, isKo);
                return (
                  <div
                    data-testid="card-novel-lore-bridge"
                    className="mt-2 rounded-xl border border-[#8c6432]/70 bg-[#2b1a0c] p-2.5 text-left text-amber-100 shadow-inner"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10.5px] font-extrabold text-amber-300">
                      <span>{tr('📖 영웅 원작 웹소설 비하인드 로어', '📖 Official Novel Lore')}</span>
                      <span className="rounded-full border border-amber-400/45 bg-amber-950/90 px-2 py-0.5 text-[10px] text-amber-200">
                        {lore.epTitle}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold leading-snug text-amber-100/90">
                      {lore.hook}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <a
                        href={`/book.html?ep=${lore.ep}&utm_source=card_lore`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="card-lore-book-link"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-amber-300/70 bg-gradient-to-b from-amber-500 to-amber-700 px-2.5 py-1.5 text-[11px] font-extrabold text-stone-950 shadow transition hover:brightness-110"
                      >
                        {tr(`📖 제${lore.ep}화 원작 읽기 →`, `📖 Read EP.${lore.ep} Novel →`)}
                      </a>
                      <a
                        href={`/game.html?mode=story&ep=${lore.ep}&utm_source=card_lore_story`}
                        data-testid="card-lore-story-link"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-sky-400/65 bg-sky-950/90 px-2.5 py-1.5 text-[11px] font-extrabold text-sky-100 shadow transition hover:border-sky-300 hover:bg-sky-900"
                      >
                        {tr(`⚔ 제${lore.ep}화 스토리 출격`, `⚔ Battle EP.${lore.ep}`)}
                      </a>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-2 flex w-full items-center justify-center">
                <button
                  type="button"
                  data-testid="card-zoom-share-3x-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    const shareUrl = `https://snshero.com/game?mode=collection&card=${encodeURIComponent(card.id)}&awakened=3x`;
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(shareUrl).catch(() => {});
                    }
                    hsAudio.playSfx('ui_click', 0.7);
                    const btn = e.currentTarget;
                    const prev = btn.textContent;
                    btn.textContent = tr('✅ 3배 각성 카드 링크 복사 완료!', '✅ 3x Card Share Link Copied!');
                    window.setTimeout(() => {
                      if (prev) btn.textContent = prev;
                    }, 1600);
                  }}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#8c6432]/70 bg-[#2b1a0c] px-3 py-1.5 text-xs font-extrabold text-amber-200 transition hover:border-amber-300 hover:bg-[#3b2512]"
                >
                  🔗 {tr('이 카드 3배 각성 링크 복사하기', 'Copy 3x Awakened Card Share Link')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Bottom Action Bar (Always visible on mobile without scrolling) */}
        <div className="mt-2 flex w-full shrink-0 flex-col gap-1.5 border-t border-amber-500/25 pt-2">
          {primaryAction && (
            <button
              type="button"
              data-testid="card-zoom-primary-action"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onClick}
              className={`flex min-h-[48px] w-full items-center justify-center rounded-2xl px-4 py-2.5 text-base font-extrabold tracking-wide transition ${renderBtnClass(
                primaryAction.variant,
                primaryAction.disabled,
              )}`}
            >
              {primaryAction.label}
            </button>
          )}

          {secondaryActions.length > 0 && (
            <div className="flex w-full flex-wrap gap-1.5">
              {secondaryActions.map((act, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={act.disabled}
                  onClick={act.onClick}
                  className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-extrabold transition ${renderBtnClass(
                    act.variant || 'brass',
                    act.disabled,
                  )}`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          )}

          <div className="text-center text-[10.5px] font-bold text-amber-200/75">
            {hasNav
              ? tr(
                  '좌우 스와이프 · ‹ › 버튼으로 옆 카드 이동 · 바깥 터치 시 닫기',
                  'Swipe or tap ‹ › to browse · Tap outside to close',
                )
              : tr('바깥 영역을 터치하면 닫힙니다', 'Tap outside to close')}
          </div>
        </div>
      </div>
    </div>
  );
};
