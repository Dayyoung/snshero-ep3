import { isKoreanLanguage } from '../i18n/heroLang';
import {
  CardClass,
  CardRarity,
  CLASSIC_HEROES,
  ClassicCardDef,
  CustomDeck,
  HeroClass,
} from './types';

export interface LocalizedHeroInfo {
  name: string;
  title: string;
  className: string;
  factionRealm: string;
  heroPowerName: string;
  heroPowerText: string;
  emotes: {
    greetings: string;
    well_played: string;
    thanks: string;
    wow: string;
    oops: string;
    threaten: string;
    start: string;
    concede: string;
  };
}

export const CLASSIC_HEROES_EN: Record<HeroClass, LocalizedHeroInfo> = {
  PRIEST: {
    name: 'Kadan',
    title: 'Snowfield Hero of Elwin Village',
    className: 'Human',
    factionRealm: 'Lighthaven',
    heroPowerName: 'Snowfield Heal',
    heroPowerText: 'Restore 2 Health.',
    emotes: {
      greetings: 'Greetings in the name of Elwin Village!',
      well_played: 'Well played! What a sharp move!',
      thanks: 'Thank you, my friend.',
      wow: 'Remarkable — even the Silver Dagger resonates!',
      oops: 'Ah, a hasty decision on my part.',
      threaten: 'By my oath upon the Snow Shield, I will surpass you!',
      start: 'Starlight of Elwin Village, guide our path!',
      concede: 'Well fought. You have earned this victory.',
    },
  },
  MAGE: {
    name: 'Poseidon',
    title: 'Sea Sovereign of the Abyssal Waters',
    className: 'Water',
    factionRealm: 'Abyssal Sea',
    heroPowerName: 'Abyssal Hydro Blast',
    heroPowerText: 'Deal 1 damage.',
    emotes: {
      greetings: 'The primordial currents welcome you.',
      well_played: 'A strategy as deep as the abyss.',
      thanks: 'You have the gratitude of the seas.',
      wow: 'A strike fierce as a tidal wave!',
      oops: 'The tides shifted unexpectedly.',
      threaten: 'The abyssal pressure shall shatter you!',
      start: 'Spirits of the deep, answer my trident!',
      concede: 'The tide recedes... this match is yours.',
    },
  },
  WARRIOR: {
    name: 'Ignisius',
    title: 'Solar Emperor of the Flame Court',
    className: 'Fire',
    factionRealm: 'Flame Court',
    heroPowerName: 'Solar Armor!',
    heroPowerText: 'Gain 2 Armor.',
    emotes: {
      greetings: 'Can you endure the heat of the Flame Court?',
      well_played: 'A blazing fighting spirit indeed.',
      thanks: 'The Emperor commends you.',
      wow: 'Power like a supernova!',
      oops: 'My flames strayed for a moment.',
      threaten: 'My Sun Greatsword will leave not even ashes!',
      start: 'Primordial flame, set this battlefield ablaze!',
      concede: 'My fire dims today... I will remember this!',
    },
  },
  HUNTER: {
    name: 'Wind God Toram',
    title: 'Sky Deity of Storm Wind Isle',
    className: 'Wind',
    factionRealm: 'Storm Wind Isle',
    heroPowerName: 'Storm Snipe',
    heroPowerText: 'Deal 2 damage to the enemy hero.',
    emotes: {
      greetings: 'May tailwinds of Storm Isle favor you.',
      well_played: 'Swifter than the gale itself.',
      thanks: 'My thanks, friend of the winds.',
      wow: 'Like lightning cleaving the sky!',
      oops: 'Caught in an unexpected updraft.',
      threaten: 'Twin tempests shall pierce your defenses!',
      start: 'Winds of the heavens, begin the hunt!',
      concede: 'The gale stills. A clean victory.',
    },
  },
  PALADIN: {
    name: 'Colossus',
    title: 'Primordial Titan of Earth Citadel',
    className: 'Earth',
    factionRealm: 'Earth Citadel',
    heroPowerName: 'Summon Bastion Guard',
    heroPowerText: 'Summon a 1/1 Earth Citadel Recruit.',
    emotes: {
      greetings: 'Greetings in the name of Earth Citadel.',
      well_played: 'Tactics as unyielding as bedrock.',
      thanks: 'May the blessing of the earth be with you.',
      wow: 'A miracle to shake the mountains!',
      oops: 'The ground shifted beneath me.',
      threaten: 'Face the judgment of the Earth Core!',
      start: 'Raise the Citadel barrier — not one step back!',
      concede: 'Even a titan bows to superior strategy.',
    },
  },
  ROGUE: {
    name: 'Artus',
    title: 'Death Knight Regent of Shadow Realm',
    className: 'Undead',
    factionRealm: 'Shadow Realm',
    heroPowerName: 'Shadow Dagger',
    heroPowerText: 'Equip a 1/2 Dagger.',
    emotes: {
      greetings: 'Welcome to the night mist of the Red Glass Court.',
      well_played: 'Quite the razor-sharp thrust.',
      thanks: 'I accept your courtesy.',
      wow: 'Even a frostblade would tremble at that!',
      oops: 'The shadows wavered for a beat.',
      threaten: 'Your soul will freeze in eternal darkness!',
      start: 'The darkness of Shadow Realm devours all light.',
      concede: 'I retreat for now... do not think this is over.',
    },
  },
  SHAMAN: {
    name: 'Aila',
    title: 'Crescent Archmage of Moonlight Sylvan',
    className: 'Elf',
    factionRealm: 'Moonlight Sylvan',
    heroPowerName: 'Totemic Spirit Stone',
    heroPowerText: 'Summon a random Spirit Stone.',
    emotes: {
      greetings: 'May the grace of Moonlight Sylvan shine on you.',
      well_played: 'You have mastered the ancient runes.',
      thanks: 'Thank you, in the name of the Sylvan.',
      wow: 'Arcane radiance fit to make the stars dance!',
      oops: 'One stroke of the rune slipped.',
      threaten: 'The Crescent Blade and Spirit Stones shall judge you!',
      start: 'Ancient arcane runes, protect the Sylvan forest!',
      concede: 'A graceful strategy. The victory is yours.',
    },
  },
  WARLOCK: {
    name: 'Ironforge',
    title: 'Golden Automaton of Deepforge',
    className: 'Dwarf',
    factionRealm: 'Deepforge Works',
    heroPowerName: 'Forge Mana Tap',
    heroPowerText: 'Draw a card and take 2 damage.',
    emotes: {
      greetings: 'The fires of Deepforge Kingdom never die!',
      well_played: 'Accurate as a master smith’s hammer.',
      thanks: 'Much obliged, comrade of iron.',
      wow: 'A blow strong enough to pierce orichalcum!',
      oops: 'Furnace pressure spiked too high.',
      threaten: 'My Star-Rune Greatshield will crush you to dust!',
      start: 'Engage the Deepforge reactor to maximum output!',
      concede: 'Armor at critical limit... a fine duel!',
    },
  },
  DRUID: {
    name: 'Fenrir',
    title: 'Frost Wolf King of the Wilds',
    className: 'Beast',
    factionRealm: 'Wild Earth',
    heroPowerName: 'Beast Awakening',
    heroPowerText: '+1 Attack this turn. +1 Armor.',
    emotes: {
      greetings: 'Show me your resolve in the frozen wilds.',
      well_played: 'Claws worthy of the Beast King’s respect.',
      thanks: 'I will remember this, ally.',
      wow: 'A roar that splits the earth!',
      oops: 'I lost the scent of the prey.',
      threaten: 'My frost-rune fangs will tear through you!',
      start: 'Wild lands, awaken to the Wolf King’s call!',
      concede: 'The strong prevail — that is the law of the wild.',
    },
  },
};

export function getLocalizedHeroInfo(heroClass: HeroClass): LocalizedHeroInfo {
  if (isKoreanLanguage()) {
    const h = CLASSIC_HEROES[heroClass];
    return {
      name: h.nameKo,
      title: h.titleKo,
      className: h.classNameKo,
      factionRealm: h.factionRealmKo,
      heroPowerName: h.heroPowerNameKo,
      heroPowerText: h.heroPowerTextKo,
      emotes: h.emotesKo,
    };
  }
  return CLASSIC_HEROES_EN[heroClass];
}

export const CLASSIC_RANK_NAMES_EN: Record<number, string> = {
  25: 'Elwin Village Apprentice',
  24: 'Snowfield Border Scout',
  23: 'Lighthaven Squire',
  22: 'Coral Sea Sentinel',
  21: 'Blackwind Deckhand',
  20: 'Ironshield Footman',
  19: 'Deepforge Tinkerer',
  18: 'Abyssal Trench Initiate',
  17: 'Wind Isle Archer',
  16: 'Jade Council Wanderer',
  15: 'Sylvan Moon Warden',
  14: 'Northern Snow Lancer',
  13: 'Flame Court Vanguard',
  12: 'Ake Paladin Elite',
  11: 'Mist Cliff Tracker',
  10: 'Starlight Archive Mage',
  9: 'Seven Pursuers Heir',
  8: 'Jade Council Enforcer',
  7: 'Sky Altar Guardian',
  6: 'Ancient Magitech Commander',
  5: 'Abyssal Sea General',
  4: 'Earth Citadel Colossus',
  3: 'Dragon Spire Guardian',
  2: 'Heir of the Silver Dagger',
  1: 'Elwin Grand Tactician',
  0: 'Legendary SNSHero (LEGEND)',
};

export function getRankTitle(rank: number, koMap: Record<number, string>): string {
  if (isKoreanLanguage()) {
    return koMap[rank] || '엘윈 마을 수습생';
  }
  return CLASSIC_RANK_NAMES_EN[rank] || 'Elwin Village Apprentice';
}

export const PRESET_DECK_NAMES_EN: Record<string, string> = {
  preset_priest: 'Human — Kadan',
  preset_mage: 'Water — Poseidon',
  preset_warrior: 'Fire — Ignisius',
  preset_hunter: 'Wind — Toram',
  preset_paladin: 'Earth — Colossus',
  preset_rogue: 'Undead — Artus',
  preset_shaman: 'Elf — Aila',
  preset_warlock: 'Dwarf — Ironforge',
  preset_druid: 'Beast — Fenrir',
};

export function getDeckDisplayName(deck: Pick<CustomDeck, 'id' | 'name' | 'heroClass'>): string {
  if (isKoreanLanguage()) return deck.name;
  if (PRESET_DECK_NAMES_EN[deck.id]) return PRESET_DECK_NAMES_EN[deck.id];
  if (deck.name.includes('의 ')) {
    const info = CLASSIC_HEROES_EN[deck.heroClass];
    return `${info.className} — ${info.name}`;
  }
  return deck.name;
}

export const CARD_CLASS_LABELS_EN: Record<CardClass, string> = {
  PRIEST: 'Human',
  MAGE: 'Water',
  WARRIOR: 'Fire',
  HUNTER: 'Wind',
  PALADIN: 'Earth',
  ROGUE: 'Undead',
  SHAMAN: 'Elf',
  WARLOCK: 'Dwarf',
  DRUID: 'Beast',
  NEUTRAL: 'Neutral',
  DREAM: 'Verdant Arcane',
};

export const CARD_RARITY_LABELS_EN: Record<CardRarity, string> = {
  FREE: 'Basic',
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
};

export const CARD_RACE_LABELS_EN: Record<string, string> = {
  BEAST: 'Beast',
  DEMON: 'Abyssal',
  DRAGON: 'Dragon',
  MECHANICAL: 'Mecha',
  MURLOC: 'Deep Sea',
  PIRATE: 'Pirate',
  TOTEM: 'Spirit Stone',
  ELEMENTAL: 'Elemental',
};

export function getCardName(card: Pick<ClassicCardDef, 'name' | 'nameEn'>): string {
  return isKoreanLanguage() ? card.name : (card.nameEn || card.name);
}

export function getCardText(card: Pick<ClassicCardDef, 'text' | 'textEn'>): string {
  return isKoreanLanguage() ? card.text : (card.textEn !== undefined ? card.textEn : card.text);
}

export function getCardFlavor(card: Pick<ClassicCardDef, 'flavor' | 'flavorEn'>): string {
  return isKoreanLanguage() ? (card.flavor || '') : (card.flavorEn || card.flavor || '');
}

export function getCardCharName(card: Pick<ClassicCardDef, 'name' | 'nameEn' | 'snsCharName' | 'snsCharNameEn'>): string {
  if (isKoreanLanguage()) return card.snsCharName || card.name;
  return card.snsCharNameEn || card.nameEn || card.name;
}

export function getCardFactionLabel(card: Pick<ClassicCardDef, 'snsFactionKo' | 'snsFactionEn'>): string {
  if (isKoreanLanguage()) return card.snsFactionKo || '';
  return card.snsFactionEn || card.snsFactionKo || '';
}
