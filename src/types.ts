export type ElementType =
  | 'water'
  | 'fire'
  | 'air'
  | 'earth'
  | 'human'
  | 'undead'
  | 'elf'
  | 'dwarf'
  | 'monster'
  | 'robot'
  | 'dragon'
  | 'neutral';

export type CardRarity = 'bronze' | 'silver' | 'gold';

export interface CardAbility {
  type: string;
  value: number;
  description_en: string;
  description_ko: string;
}

export interface DatabaseCard {
  id: number;
  index: number;
  category: number;
  type: number;
  level: number;
  title: string;
  title_en: string;
  delete: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  updated: string;
  power: number;
  title_dis: string;
  rarity: CardRarity;
  element: ElementType;
  stats: [number, number, number, number];
  ability?: CardAbility;
  lore_ko?: string;
  lore_en?: string;
}
