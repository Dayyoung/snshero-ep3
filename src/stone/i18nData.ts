import type { HeroLanguage } from '../i18n/heroLang';
import { isKoreanLanguage } from '../i18n/heroLang';
import { CLASSIC_HEROES, type ClassicCardDef, type HeroClass, type HeroDef } from './types';
import { CLASSIC_RANK_NAMES } from './cardDb';

export function getCardName(
  card: Pick<ClassicCardDef, 'name' | 'nameEn'>,
  lang?: HeroLanguage,
): string {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  return isKo ? card.name : (card.nameEn || card.name);
}

export function getCardText(
  card: Pick<ClassicCardDef, 'text' | 'textEn'>,
  lang?: HeroLanguage,
): string {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  return isKo ? card.text : (card.textEn ?? card.text);
}

export function getCardFlavor(
  card: Pick<ClassicCardDef, 'flavor' | 'flavorEn'>,
  lang?: HeroLanguage,
): string | undefined {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  return isKo ? card.flavor : (card.flavorEn || card.flavor);
}

export interface LocalizedHeroInfo {
  name: string;
  title: string;
  className: string;
  heroPowerName: string;
  heroPowerText: string;
  emotes: HeroDef['emotesKo'];
}

export const CLASSIC_HEROES_EN: Record<HeroClass, LocalizedHeroInfo> = {
  MAGE: {
    name: 'Jaina Proudmoore',
    title: 'Archmage of Dalaran',
    className: 'Mage',
    heroPowerName: 'Fireblast',
    heroPowerText: 'Deal 1 damage.',
    emotes: {
      greetings: 'Hello!',
      well_played: 'Well played.',
      thanks: 'Thank you.',
      wow: 'Amazing!',
      oops: 'Whoops.',
      threaten: 'My magic will tear you apart!',
      start: 'You asked for it!',
      concede: 'You win this one.',
    },
  },
  WARRIOR: {
    name: 'Garrosh Hellscream',
    title: 'Warchief of the Horde',
    className: 'Warrior',
    heroPowerName: 'Armor Up!',
    heroPowerText: 'Gain 2 Armor.',
    emotes: {
      greetings: 'Heh, greetings.',
      well_played: 'Well played.',
      thanks: 'My thanks.',
      wow: 'Astonishing!',
      oops: 'That was an error.',
      threaten: 'I will crush you!',
      start: 'Victory or death!',
      concede: 'I choose death!',
    },
  },
  HUNTER: {
    name: 'Rexxar',
    title: 'Champion of the Horde',
    className: 'Hunter',
    heroPowerName: 'Steady Shot',
    heroPowerText: 'Deal 2 damage to the enemy hero.',
    emotes: {
      greetings: 'Greetings, traveler.',
      well_played: 'Well played.',
      thanks: 'Thanks.',
      wow: 'Astounding!',
      oops: 'That didn’t quite hit the mark.',
      threaten: 'I will hunt you down!',
      start: 'Let the hunt begin!',
      concede: 'Well fought. I concede.',
    },
  },
  PALADIN: {
    name: 'Uther Lightbringer',
    title: 'Grandmaster of the Silver Hand',
    className: 'Paladin',
    heroPowerName: 'Reinforce',
    heroPowerText: 'Summon a 1/1 Silver Hand Recruit.',
    emotes: {
      greetings: 'Well met!',
      well_played: 'Well played.',
      thanks: 'Thank you.',
      wow: 'By the Holy Light!',
      oops: 'That was a mistake.',
      threaten: 'Justice demands retribution!',
      start: 'I will fight with honor!',
      concede: 'The victory is yours.',
    },
  },
  PRIEST: {
    name: 'Anduin Wrynn',
    title: 'Prince of Stormwind',
    className: 'Priest',
    heroPowerName: 'Lesser Heal',
    heroPowerText: 'Restore 2 Health.',
    emotes: {
      greetings: 'Greetings.',
      well_played: 'Well played.',
      thanks: 'Thank you.',
      wow: 'Wow...',
      oops: 'Not quite what was planned.',
      threaten: 'The Light shall burn you!',
      start: 'The Light shall bring victory!',
      concede: 'You have bested me.',
    },
  },
  ROGUE: {
    name: 'Valeera Sanguinar',
    title: 'Master Assassin',
    className: 'Rogue',
    heroPowerName: 'Dagger Mastery',
    heroPowerText: 'Equip a 1/2 Dagger.',
    emotes: {
      greetings: 'The pleasure is mine.',
      well_played: 'Well played.',
      thanks: 'Thank you.',
      wow: 'Incredible!',
      oops: 'Mistakes were made.',
      threaten: 'I will be your death!',
      start: 'Watch your back!',
      concede: 'I give up.',
    },
  },
  SHAMAN: {
    name: 'Thrall',
    title: 'Farseer of the Earthen Ring',
    className: 'Shaman',
    heroPowerName: 'Totemic Call',
    heroPowerText: 'Summon a random Totem.',
    emotes: {
      greetings: 'Greetings, friend.',
      well_played: 'Well played.',
      thanks: 'I thank you.',
      wow: "That's incredible!",
      oops: 'That was a mistake.',
      threaten: 'The elements will destroy you!',
      start: 'For Doomhammer!',
      concede: 'You win, friend.',
    },
  },
  WARLOCK: {
    name: "Gul'dan",
    title: 'Destroyer of Dreams',
    className: 'Warlock',
    heroPowerName: 'Life Tap',
    heroPowerText: 'Draw a card and take 2 damage.',
    emotes: {
      greetings: 'I greet you.',
      well_played: 'Well played.',
      thanks: 'Thank you.',
      wow: 'Extraordinary!',
      oops: 'That was a mistake.',
      threaten: 'Your soul shall suffer!',
      start: 'Your soul shall be mine!',
      concede: 'You win... this time.',
    },
  },
  DRUID: {
    name: 'Malfurion Stormrage',
    title: 'Archdruid',
    className: 'Druid',
    heroPowerName: 'Shapeshift',
    heroPowerText: '+1 Attack this turn. +1 Armor.',
    emotes: {
      greetings: 'My greetings.',
      well_played: 'Well played.',
      thanks: 'My thanks to you.',
      wow: 'Spectacular!',
      oops: 'A natural mistake.',
      threaten: 'Nature will rise against you!',
      start: 'I must protect the wild!',
      concede: 'I concede to you.',
    },
  },
};

export function getLocalizedHeroInfo(
  heroClass: HeroClass | undefined,
  lang?: HeroLanguage,
): LocalizedHeroInfo {
  const cls: HeroClass = heroClass && CLASSIC_HEROES[heroClass] ? heroClass : 'MAGE';
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  if (isKo) {
    const h = CLASSIC_HEROES[cls];
    return {
      name: h.nameKo,
      title: h.titleKo,
      className: h.classNameKo,
      heroPowerName: h.heroPowerNameKo,
      heroPowerText: h.heroPowerTextKo,
      emotes: h.emotesKo,
    };
  }
  return CLASSIC_HEROES_EN[cls];
}

export const CLASSIC_RANK_NAMES_EN: Record<number, string> = {
  25: 'Angry Chicken',
  24: 'Leper Gnome',
  23: 'Argent Squire',
  22: 'Murloc Raider',
  21: 'Southsea Deckhand',
  20: 'Shieldbearer',
  19: 'Novice Engineer',
  18: "Sorcerer's Apprentice",
  17: 'Tauren Warrior',
  16: 'Questing Adventurer',
  15: 'Silvermoon Guardian',
  14: 'Raid Leader',
  13: 'Dread Corsair',
  12: 'Warsong Commander',
  11: 'Big Game Hunter',
  10: 'Ogre Magi',
  9: 'Silver Hand Knight',
  8: 'Frostwolf Warlord',
  7: 'Sunwalker',
  6: 'Ancient Mage',
  5: 'Sea Giant',
  4: 'Mountain Giant',
  3: 'Molten Giant',
  2: 'The Black Knight',
  1: 'Innkeeper',
  0: 'Legend',
};

export function getRankTitle(rank: number, lang?: HeroLanguage): string {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  if (isKo) return CLASSIC_RANK_NAMES[rank] || '도전자';
  return CLASSIC_RANK_NAMES_EN[rank] || 'Challenger';
}

export const PRESET_DECK_NAMES_EN: Record<string, string> = {
  preset_mage: 'Kirin Tor Classic Mage',
  preset_warrior: 'Horde Shield Control Warrior',
  preset_hunter: 'Beast Tamer Midrange Hunter',
  preset_paladin: 'Silver Hand Midrange Paladin',
  preset_priest: 'Stormwind Light Priest',
  preset_rogue: 'SI:7 Tempo Assassin Rogue',
  preset_shaman: 'Earthen Ring Totem Shaman',
  preset_warlock: 'Flame & Shadow Zoo Warlock',
  preset_druid: 'Force of Nature Ramp Druid',
};

export function getDeckDisplayName(
  deckId: string,
  name: string,
  heroClass?: HeroClass,
  lang?: HeroLanguage,
): string {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  if (isKo) return name;
  if (PRESET_DECK_NAMES_EN[deckId]) return PRESET_DECK_NAMES_EN[deckId];
  if (heroClass && name.endsWith(' 커스텀')) {
    return `Custom ${CLASSIC_HEROES_EN[heroClass].className}`;
  }
  return name.replace(/\s*커스텀$/, ' Custom');
}

export const CARD_BACK_NAMES_EN: Record<string, string> = {
  classic: 'Classic',
  legend: 'Legend',
  frost: 'Icecrown',
  gold: 'Fireside Gold',
};

export function getCardBackName(id: string, nameKo: string, lang?: HeroLanguage): string {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  return isKo ? nameKo : (CARD_BACK_NAMES_EN[id] || nameKo);
}

export const RACE_LABELS: Record<string, { ko: string; en: string }> = {
  BEAST: { ko: '야수', en: 'Beast' },
  DEMON: { ko: '악마', en: 'Demon' },
  DRAGON: { ko: '용족', en: 'Dragon' },
  MURLOC: { ko: '멀록', en: 'Murloc' },
  PIRATE: { ko: '해적', en: 'Pirate' },
  TOTEM: { ko: '토템', en: 'Totem' },
  MECHANICAL: { ko: '기계', en: 'Mech' },
  ELEMENTAL: { ko: '정령', en: 'Elemental' },
  UNDEAD: { ko: '언데드', en: 'Undead' },
  ALL: { ko: '모두', en: 'All' },
};

export function getRaceLabel(race: string | undefined, lang?: HeroLanguage): string {
  if (!race) return '';
  const entry = RACE_LABELS[race];
  if (!entry) return race;
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  return isKo ? entry.ko : entry.en;
}

export const RARITY_LABELS: Record<string, { ko: string; en: string }> = {
  FREE: { ko: '기본', en: 'Basic' },
  COMMON: { ko: '일반', en: 'Common' },
  RARE: { ko: '희귀', en: 'Rare' },
  EPIC: { ko: '영웅', en: 'Epic' },
  LEGENDARY: { ko: '전설', en: 'Legendary' },
};

export function getRarityLabel(rarity: string | undefined, lang?: HeroLanguage): string {
  const key = rarity || 'COMMON';
  const entry = RARITY_LABELS[key] || { ko: key, en: key };
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  return isKo ? entry.ko : entry.en;
}

export const TYPE_LABELS: Record<string, { ko: string; en: string }> = {
  MINION: { ko: '하수인', en: 'Minion' },
  SPELL: { ko: '주문', en: 'Spell' },
  WEAPON: { ko: '무기', en: 'Weapon' },
  HERO: { ko: '영웅', en: 'Hero' },
  HERO_POWER: { ko: '영웅 능력', en: 'Hero Power' },
};

export function getTypeLabel(type: string | undefined, lang?: HeroLanguage): string {
  const key = type || 'MINION';
  const entry = TYPE_LABELS[key] || { ko: key, en: key };
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  return isKo ? entry.ko : entry.en;
}

export function getClassLabel(cardClass: string | undefined, lang?: HeroLanguage): string {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  if (!cardClass || cardClass === 'NEUTRAL') return isKo ? '중립' : 'Neutral';
  const hero = CLASSIC_HEROES[cardClass as HeroClass];
  if (!hero) return cardClass;
  return isKo ? hero.classNameKo : CLASSIC_HEROES_EN[cardClass as HeroClass].className;
}

export const SPINNER_TITLES_EN: string[] = [
  'Worthy Opponent',
  'The Innkeeper',
  'Grand Master',
  'Murloc Whisperer',
  'Roach Boy',
  'Fiscally Responsible',
  'Coffee Addict',
  'Really Slow Guy',
  'Brand New Player',
  'World Champion',
  'Diamond League',
  'Dastardly Villain',
  'A Little Lost',
  'Your Guild Leader',
  'Card Shark',
  'Lucky Topdecker',
  'Salty Pirate',
  'Kirin Tor Scholar',
  'Stormwind Guard',
  'Horde Bruiser',
];

const KO_TO_EN_ERROR_MAP: Array<[string, string]> = [
  ['마나가 부족합니다.', 'Not enough Mana!'],
  ['전장이 가득 찼습니다', 'Your board is full! (Max 7 minions)'],
  ['손패가 가득 찼습니다', 'Your hand is full!'],
  ['이번 턴에 소환된 하수인은 바로 공격할 수 없습니다', 'Give that minion a turn to get ready.'],
  ['이미 이번 턴에 공격했습니다.', 'That character has already attacked.'],
  ['이미 공격한 캐릭터입니다.', 'That character has already attacked.'],
  ['빙결 상태라 공격할 수 없습니다.', 'Frozen characters cannot attack.'],
  ['얼어붙은 캐릭터는 공격할 수 없습니다.', 'Frozen characters cannot attack.'],
  ['도발 하수인을 먼저 공격해야 합니다!', 'A minion with Taunt is in the way.'],
  ['도발 능력이 있는', 'A minion with Taunt is in the way.'],
  ['은신 상태의 대상은 지정할 수 없습니다.', 'Stealthed targets cannot be targeted.'],
  ['은신 상태의 적을 공격할 수 없습니다.', 'Cannot attack a Stealthed minion.'],
  ['주문의 대상으로 지정할 수 없습니다.', "Can't be targeted by Spells or Hero Powers."],
  ['주문/영웅 능력 대상으로 지정할 수 없습니다.', "Can't be targeted by Spells or Hero Powers."],
  ['공격력이 0인 캐릭터는 공격할 수 없습니다.', 'A character with 0 Attack cannot attack.'],
  ['유효한 공격 대상이 없습니다.', 'There is no valid attack target.'],
  ['영웅이 공격하려면 공격력이 있어야 합니다.', 'Your hero needs Attack to attack.'],
  ['적 하수인만 공격할 수 있습니다.', 'You can only attack enemy characters.'],
  ['적 캐릭터만 대상으로 삼을 수 있습니다.', 'You must target an enemy.'],
  ['아군 캐릭터만 대상으로 삼을 수 있습니다.', 'You must target a friendly character.'],
  ['이미 사용 중인 비밀과 같은 비밀은 낼 수 없습니다.', 'You already have that Secret in play.'],
  ['비밀 칸이 가득 찼습니다', 'Secret zone is full!'],
  ['내 턴이 아닙니다.', 'It is not your turn.'],
  ['대상이 필요합니다.', 'That card requires a target.'],
  ['무기가 장착되어 있지 않습니다.', 'You need a weapon equipped.'],
  ['이번 게임에서 사용할 영웅 능력을 이미 사용했습니다.', 'You already used your Hero Power this turn.'],
  ['영웅 능력을 이미 사용했습니다.', 'You already used your Hero Power this turn.'],
  ['그 카드는 낼 수 없습니다.', 'You cannot play that card right now.'],
  ['유효한 대상이 없습니다.', 'No valid target.'],
];

export function translatePlayError(message: string, lang?: HeroLanguage): string {
  const isKo = lang ? lang === 'ko' : isKoreanLanguage();
  if (isKo) return message;
  for (const [koSub, enText] of KO_TO_EN_ERROR_MAP) {
    if (message.includes(koSub)) return enText;
  }
  return message;
}
