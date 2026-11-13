import React from 'react';
import { HearthstoneCard, RACE_KO } from '../hearthstone/components/CardVisual';
import { CardRarity, ClassicCardDef } from '../hearthstone/types';

export const PROMO_RACE_KO = RACE_KO;

export const PROMO_RARITY_KO: Record<CardRarity, { label: string; gemColor: string; textColor: string }> = {
  FREE: { label: '기본', gemColor: '#cbd5e1', textColor: '#475569' },
  COMMON: { label: '일반', gemColor: '#f8fafc', textColor: '#64748b' },
  RARE: { label: '희귀', gemColor: '#38bdf8', textColor: '#0284c7' },
  EPIC: { label: '특급', gemColor: '#c084fc', textColor: '#9333ea' },
  LEGENDARY: { label: '전설', gemColor: '#fb923c', textColor: '#ea580c' },
};

export const PromoCard: React.FC<{
  card: ClassicCardDef;
  isGolden?: boolean;
  onClick?: (card: ClassicCardDef) => void;
  size?: 'sm' | 'md' | 'lg';
}> = ({ card, isGolden = false, onClick, size = 'md' }) => {
  const hsSize = size === 'lg' ? 'LG' : size === 'sm' ? 'SM' : 'MD';
  const rarityAura =
    card.rarity === 'LEGENDARY' || card.rarity === 'EPIC' || card.rarity === 'RARE'
      ? card.rarity
      : undefined;

  return (
    <div
      className={`inline-flex items-center justify-center transition-transform duration-200 ${
        onClick ? 'cursor-pointer hover:-translate-y-2 hover:scale-[1.03]' : ''
      }`}
    >
      <HearthstoneCard
        card={card}
        size={hsSize}
        isGolden={isGolden}
        enableTilt={Boolean(onClick)}
        rarityAura={rarityAura}
        onClick={onClick ? () => onClick(card) : undefined}
      />
    </div>
  );
};
