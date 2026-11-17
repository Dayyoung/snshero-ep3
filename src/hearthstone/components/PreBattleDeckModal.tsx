import React, { useMemo, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { cardDb } from '../cardDb';
import { getCardName } from '../i18nData';
import { hsStorage } from '../storage';
import { getJourneyEpisodeDef } from '../kadanJourneyData';
import { getStoryEpisodeEncounter } from '../storyEncounterData';
import { ClassicCardDef, HeroClass, KadanTacticalStance } from '../types';
import { useModalDismiss } from '../useModalDismiss';

export type ArchetypePresetId = 'CUSTOM' | 'AGGRO' | 'CONTROL' | 'AWAKENING';

export interface ArchetypeDeckPreset {
  id: ArchetypePresetId;
  titleKo: string;
  titleEn: string;
  subtitleKo: string;
  subtitleEn: string;
  recommendedStance: KadanTacticalStance;
  stanceLabelKo: string;
  stanceLabelEn: string;
  accentCls: string;
  cards: string[];
  aceCardIds: string[];
  manaCurve: number[];
}

function build30CardDeck(
  heroClass: HeroClass,
  scoreFn: (c: ClassicCardDef, owned: number) => number,
): string[] {
  const ownedMap = hsStorage.getCollection();
  const pool = cardDb
    .getAllCollectible()
    .filter((c) => c.collectible && (c.cardClass === heroClass || c.cardClass === 'NEUTRAL'));

  const scored = pool
    .map((c) => {
      const owned = ownedMap[c.id] || 0;
      return { card: c, score: scoreFn(c, owned), owned };
    })
    .sort((a, b) => b.score - a.score);

  const deck: string[] = [];
  for (const item of scored) {
    if (deck.length >= 30) break;
    const maxCopy = item.card.rarity === 'LEGENDARY' ? 1 : 2;
    for (let i = 0; i < maxCopy && deck.length < 30; i++) {
      deck.push(item.card.id);
    }
  }
  return deck;
}

function computeManaCurve(cards: string[]): number[] {
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const id of cards) {
    const c = cardDb.getCard(id);
    if (!c) continue;
    buckets[Math.min(7, Math.max(0, c.cost))] += 1;
  }
  return buckets;
}

export function buildArchetypePresets(
  heroClass: HeroClass,
  customDeckCards: string[],
): ArchetypeDeckPreset[] {
  const ownedMap = hsStorage.getCollection();

  const aggroDeck = build30CardDeck(heroClass, (c, owned) => {
    let s = Math.max(0, 8 - c.cost) * 4;
    if (c.mechanics.includes('CHARGE')) s += 20;
    if (c.type === 'MINION' && (c.attack ?? 0) >= c.cost + 1) s += 8;
    if (c.type === 'SPELL' && c.cost <= 4) s += 6;
    if (owned >= 3) s += 5;
    return s;
  });

  const controlDeck = build30CardDeck(heroClass, (c, owned) => {
    let s = Math.min(8, c.cost) * 1.5;
    if (c.mechanics.includes('TAUNT')) s += 22;
    if (c.mechanics.includes('DIVINE_SHIELD')) s += 12;
    if (c.type === 'SPELL') s += 10;
    if ((c.health ?? 0) >= 4) s += 8;
    if (owned >= 3) s += 5;
    return s;
  });

  const awakeningDeck = build30CardDeck(heroClass, (c, owned) => {
    const isAwakened = c.rarity === 'LEGENDARY' ? owned >= 2 : owned >= 3;
    let s = isAwakened ? 45 + owned * 3 : owned * 4;
    if (c.rarity === 'LEGENDARY') s += 10;
    if (c.rarity === 'EPIC') s += 6;
    if (c.cost <= 5) s += 4;
    return s;
  });

  const customCurve = computeManaCurve(customDeckCards);
  const pickAces = (cards: string[]) => {
    const seen = new Set<string>();
    const list: string[] = [];
    const sorted = [...cards].sort((a, b) => {
      const ca = cardDb.getCard(a);
      const cb = cardDb.getCard(b);
      const ra = ca?.rarity === 'LEGENDARY' ? 4 : ca?.rarity === 'EPIC' ? 3 : 1;
      const rb = cb?.rarity === 'LEGENDARY' ? 4 : cb?.rarity === 'EPIC' ? 3 : 1;
      const oa = ownedMap[a] || 0;
      const ob = ownedMap[b] || 0;
      return rb * 5 + ob - (ra * 5 + oa);
    });
    for (const id of sorted) {
      if (!seen.has(id)) {
        seen.add(id);
        list.push(id);
      }
      if (list.length >= 3) break;
    }
    return list;
  };

  return [
    {
      id: 'CUSTOM',
      titleKo: '현재 내 전술 덱',
      titleEn: 'Current Active Deck',
      subtitleKo: '현재 편성된 30장 기본 덱으로 출격',
      subtitleEn: 'Deploy with your active 30-card loadout',
      recommendedStance: 'BALANCED',
      stanceLabelKo: '균형 지휘',
      stanceLabelEn: 'Balanced',
      accentCls: 'border-amber-400/60 bg-amber-950/35 text-amber-100',
      cards: [...customDeckCards],
      aceCardIds: pickAces(customDeckCards),
      manaCurve: customCurve,
    },
    {
      id: 'AGGRO',
      titleKo: '속공 돌파형 (Aggro)',
      titleEn: 'Aggro Rush Preset',
      subtitleKo: '저코스트·돌진 중심 빠른 명치 압박',
      subtitleEn: 'Low-cost & Charge face pressure',
      recommendedStance: 'AGGRO',
      stanceLabelKo: '⚔ 맹공',
      stanceLabelEn: '⚔ Aggro',
      accentCls: 'border-rose-400/70 bg-rose-950/40 text-rose-100',
      cards: aggroDeck,
      aceCardIds: pickAces(aggroDeck),
      manaCurve: computeManaCurve(aggroDeck),
    },
    {
      id: 'CONTROL',
      titleKo: '철벽 반격형 (Taunt/Control)',
      titleEn: 'Taunt & Control Preset',
      subtitleKo: '도발·천상의 보호막·제압기로 필드 장악',
      subtitleEn: 'Taunt walls, Divine Shields & removals',
      recommendedStance: 'CONTROL',
      stanceLabelKo: '🛡 수비·통제',
      stanceLabelEn: '🛡 Control',
      accentCls: 'border-sky-400/70 bg-sky-950/40 text-sky-100',
      cards: controlDeck,
      aceCardIds: pickAces(controlDeck),
      manaCurve: computeManaCurve(controlDeck),
    },
    {
      id: 'AWAKENING',
      titleKo: '3배 각성 일격형 (×3 Awakening)',
      titleEn: '3x Awakening Combo Preset',
      subtitleKo: '보유 3장 이상(전설 2장) 각성 카드 최우선 편성',
      subtitleEn: 'Prioritizes your ×3 Awakened powerhouse cards',
      recommendedStance: 'AWAKENING',
      stanceLabelKo: '✨ 각성연계',
      stanceLabelEn: '✨ Awakening',
      accentCls: 'border-emerald-400/70 bg-emerald-950/40 text-emerald-100',
      cards: awakeningDeck,
      aceCardIds: pickAces(awakeningDeck),
      manaCurve: computeManaCurve(awakeningDeck),
    },
  ];
}

export interface PreBattleDeckModalProps {
  heroClass: HeroClass;
  currentDeck: string[];
  storyEpisode?: number;
  onConfirm: (payload: {
    presetId: ArchetypePresetId;
    deck: string[];
    initialStance: KadanTacticalStance;
  }) => void;
  onClose: () => void;
}

export const PreBattleDeckModal: React.FC<PreBattleDeckModalProps> = ({
  heroClass,
  currentDeck,
  storyEpisode,
  onConfirm,
  onClose,
}) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  useModalDismiss(true, onClose);

  const presets = useMemo(
    () => buildArchetypePresets(heroClass, currentDeck),
    [heroClass, currentDeck],
  );
  const [selectedId, setSelectedId] = useState<ArchetypePresetId>('AWAKENING');
  const [showManaCurve, setShowManaCurve] = useState<boolean>(false);

  const bossBrief = useMemo(() => {
    if (storyEpisode === undefined) return null;
    const epDef = getJourneyEpisodeDef(storyEpisode, isKo);
    const enc = getStoryEpisodeEncounter(storyEpisode);
    const recommendedPreset: ArchetypePresetId =
      storyEpisode >= 20 ? 'AWAKENING' : storyEpisode % 2 === 0 ? 'CONTROL' : 'AGGRO';
    return {
      title: epDef.titleKo,
      bossName: isKo ? enc.rightNameKo : enc.rightNameEn,
      pattern: isKo
        ? `${enc.rightNameKo}는 중후반 고코스트 압박과 보스 고유 영웅 능력을 사용합니다.`
        : `${enc.rightNameEn} brings mid-late pressure and boss Hero Power bursts.`,
      recommendedPreset,
    };
  }, [storyEpisode, isKo]);

  const activePreset = presets.find((p) => p.id === selectedId) || presets[0];
  const maxBucket = Math.max(1, ...activePreset.manaCurve);

  return (
    <div
      data-testid="pre-battle-deck-modal"
      onClick={onClose}
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/84 p-3 backdrop-blur-sm sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-400/45 bg-[#090d16] text-slate-100 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3.5">
          <div>
            <h2 className="hs-title text-base font-extrabold text-amber-100 sm:text-lg">
              ⚔ {tr('출격 전술 & 아키타입 프리셋 선택', 'Pre-Battle Strategy & Preset Deck')}
            </h2>
            <p className="text-[11px] text-slate-400">
              {tr(
                '상대에 맞춰 30장 완성형 덱 아키타입과 카단 초기 전술을 1탭으로 선택하세요',
                'Pick a 30-card archetype & Kadan initial stance in 1 tap',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-xs font-black text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {/* Boss Briefing Strip (Story Mode) */}
          {bossBrief && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-950/35 p-3">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-xs font-extrabold text-amber-200">
                  📜 {tr(`제${storyEpisode}화 보스 상성 브리핑`, `EP.${storyEpisode} Boss Briefing`)}: {bossBrief.bossName}
                </span>
                <span className="rounded-full bg-emerald-700/80 px-2 py-0.5 text-[10px] font-black text-emerald-100">
                  {tr('상성 유리 프리셋 추천됨', 'Counter Recommended')}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-amber-100/80">{bossBrief.pattern}</p>
            </div>
          )}

          {/* 4 Archetype Cards */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {presets.map((p) => {
              const isSelected = p.id === selectedId;
              const isRecommended = bossBrief?.recommendedPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`preset-deck-${p.id}`}
                  onClick={() => {
                    hsAudio.playSfx('ui_click', 0.75);
                    setSelectedId(p.id);
                  }}
                  className={`relative flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? `${p.accentCls} ring-2 ring-amber-300 shadow-lg`
                      : 'border-white/12 bg-white/[0.03] text-slate-200 hover:border-amber-300/45'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs font-extrabold sm:text-sm">
                        {isKo ? p.titleKo : p.titleEn}
                      </span>
                      <div className="flex items-center gap-1">
                        {isRecommended && (
                          <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[9.5px] font-black text-stone-950">
                            {tr('추천 ★', 'Best ★')}
                          </span>
                        )}
                        <span className="rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                          {isKo ? p.stanceLabelKo : p.stanceLabelEn}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-[10.5px] text-slate-300/85">
                      {isKo ? p.subtitleKo : p.subtitleEn}
                    </p>
                  </div>

                  {/* Key Ace Cards Preview */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.aceCardIds.map((cid) => {
                      const def = cardDb.getCard(cid);
                      if (!def) return null;
                      return (
                        <span
                          key={cid}
                          className="rounded border border-white/15 bg-black/45 px-1.5 py-0.5 text-[10px] font-bold text-amber-100"
                        >
                          [{def.cost}] {getCardName(def, lang)}
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* DEV-038: Progressive Disclosure Toggle for Mana Curve Histogram */}
          <div className="rounded-xl border border-white/10 bg-black/45 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
              <span className="text-amber-200">
                ⚡ {tr('초기 카단 전술:', 'Initial Kadan Tactic:')}{' '}
                <b>{isKo ? activePreset.stanceLabelKo : activePreset.stanceLabelEn}</b>
              </span>
              <button
                type="button"
                data-testid="pre-battle-mana-curve-toggle"
                onClick={() => setShowManaCurve((v) => !v)}
                className="min-h-[36px] rounded-lg border border-sky-400/40 bg-sky-950/60 px-2.5 py-1 text-[11px] font-extrabold text-sky-200 hover:bg-sky-900/80"
              >
                {showManaCurve
                  ? tr('📊 마나커브 접기 ▲', '📊 Hide Mana Curve ▲')
                  : tr('📊 상세 마나커브 보기 ▼', '📊 Show Mana Curve ▼')}
              </button>
            </div>
            {showManaCurve && (
              <div className="mt-2.5 flex h-16 items-end gap-1.5">
                {activePreset.manaCurve.map((cnt, cost) => (
                  <div key={cost} className="flex flex-1 flex-col items-center gap-0.5">
                    <span className="text-[9.5px] font-bold text-amber-200">{cnt}</span>
                    <div className="flex h-9 w-full items-end rounded bg-white/5">
                      <div
                        style={{ height: `${Math.max(8, Math.round((cnt / maxBucket) * 100))}%` }}
                        className="w-full rounded bg-gradient-to-t from-sky-600 to-cyan-300 transition-all"
                      />
                    </div>
                    <span className="text-[10px] font-extrabold text-slate-400">
                      {cost === 7 ? '7+' : cost}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Confirm */}
        <div className="flex gap-2 border-t border-white/10 bg-black/55 p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[46px] rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-extrabold text-slate-300"
          >
            {tr('취소', 'Cancel')}
          </button>
          <button
            type="button"
            data-testid="pre-battle-confirm-btn"
            onClick={() => {
              hsAudio.playSfx('box_press', 0.85);
              onConfirm({
                presetId: activePreset.id,
                deck: activePreset.cards,
                initialStance: activePreset.recommendedStance,
              });
            }}
            className="hs-gold-btn min-h-[46px] flex-1 rounded-xl text-sm font-black shadow-lg"
          >
            ⚔ {tr('이 전술 덱으로 출격하기!', 'Deploy with Selected Tactical Deck!')}
          </button>
        </div>
      </div>
    </div>
  );
};
