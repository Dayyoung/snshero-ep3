import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { tr, useHeroLanguage } from '../../i18n/heroLang';
import { hsAudio } from '../audio';
import { computeDeckGrooveProfile } from '../services/rhythmCueEngine';
import {
  CARD_RACE_LABELS_EN,
  CARD_RARITY_LABELS_EN,
  getCardName,
  getDeckDisplayName,
  getLocalizedHeroInfo,
} from '../i18nData';
import {
  CLASS_CREST_URL,
  CRAFTING_COST,
  DISENCHANT_VALUE,
  GOLDEN_DISENCHANT_VALUE,
  cardDb,
  compareCardsStoneOrder,
  decodeDeckShareCode,
  encodeDeckShareCode,
  getCardTileUrl,
  getHeroArtUrl,
} from '../cardDb';
import {
  HearthstoneCard,
  HsArcaneDustVialIcon,
  HsManaGem,
  RACE_KO,
} from '../components/CardVisual';
import { CardZoomAction, CardZoomModal } from '../components/CardZoomModal';
import { SNS_LOCATIONS } from '../components/SnsHeroArtKit';
import { useModalDismiss } from '../useModalDismiss';
import {
  MassDisenchantPreview,
  getJourneyCardMultiplier,
  hasCombatStatsForJourney,
  hsStorage,
} from '../storage';
import {
  CLASSIC_HEROES,
  CardClass,
  CardRarity,
  ClassicCardDef,
  CustomDeck,
  HERO_CLASS_ORDER,
  HeroClass,
} from '../types';

const RARITY_KO: Record<CardRarity, string> = {
  FREE: '기본',
  COMMON: '일반',
  RARE: '희귀',
  EPIC: '특급',
  LEGENDARY: '전설',
};

const RARITY_FILTER_OPTIONS: {
  id: 'ALL' | CardRarity;
  labelKo: string;
  labelEn: string;
  dotColor: string;
}[] = [
  { id: 'ALL', labelKo: '전체 등급', labelEn: 'All', dotColor: '#e2e8f0' },
  { id: 'FREE', labelKo: '기본', labelEn: 'Basic', dotColor: '#94a3b8' },
  { id: 'COMMON', labelKo: '일반', labelEn: 'Common', dotColor: '#f8fafc' },
  { id: 'RARE', labelKo: '희귀', labelEn: 'Rare', dotColor: '#3b82f6' },
  { id: 'EPIC', labelKo: '특급', labelEn: 'Epic', dotColor: '#a855f7' },
  { id: 'LEGENDARY', labelKo: '전설', labelEn: 'Legendary', dotColor: '#f59e0b' },
];

const ALL_CLASS_TABS: CardClass[] = [...HERO_CLASS_ORDER, 'NEUTRAL'];

export const CollectionScreen: React.FC<{
  onBack: () => void;
  onProfileChanged: () => void;
  onOpenShop?: () => void;
  onReturnToJourney?: () => void;
}> = ({ onBack, onProfileChanged, onOpenShop, onReturnToJourney }) => {
  const { lang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const [collection, setCollection] = useState(() => hsStorage.getCollection());
  const [goldenCollection, setGoldenCollection] = useState(() =>
    hsStorage.getGoldenCollection(),
  );
  const [decks, setDecks] = useState<CustomDeck[]>(() => hsStorage.getDecks());
  const [profile, setProfile] = useState(() => hsStorage.getProfile());

  // Default tab matches /stone.html ('MAGE') 1:1 so all 382 cards align page-for-page & slot-for-slot
  const [activeTab, setActiveTab] = useState<CardClass>('MAGE');
  const [manaFilter, setManaFilter] = useState<number | 'ALL'>('ALL');
  const [rarityFilter, setRarityFilter] = useState<'ALL' | CardRarity>('ALL');
  const [keywordChip, setKeywordChip] = useState<'ALL' | 'CHARGE' | 'TAUNT' | 'AWAKENED' | 'AOE'>('ALL');
  const [autoStance, setAutoStance] = useState<'AGGRO' | 'CONTROL' | 'AWAKENING'>('AWAKENING');
  const [searchQuery, setSearchQuery] = useState('');
  const [craftingMode, setCraftingMode] = useState(true);
  const [page, setPage] = useState(0);

  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'TOME' | 'DECKS'>('TOME');
  const [isCompactMobile, setIsCompactMobile] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth < 640 &&
      window.innerHeight >= window.innerWidth,
  );
  const [creatingClassPicker, setCreatingClassPicker] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCodeText, setImportCodeText] = useState('');
  const [hoveredTileCard, setHoveredTileCard] = useState<ClassicCardDef | null>(null);
  const [inspectCard, setInspectCard] = useState<ClassicCardDef | null>(null);
  const [disenchantModalPreview, setDisenchantModalPreview] =
    useState<MassDisenchantPreview | null>(null);
  const [singleDisenchantConfirm, setSingleDisenchantConfirm] = useState<{
    card: ClassicCardDef;
    golden: boolean;
    dust: number;
  } | null>(null);
  const [incompleteDeckPromptOpen, setIncompleteDeckPromptOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dustShortageCard, setDustShortageCard] = useState<ClassicCardDef | null>(null);
  const [starterSummaryOpen, setStarterSummaryOpen] = useState<boolean>(true);

  useModalDismiss(importModalOpen, () => setImportModalOpen(false));
  useModalDismiss(Boolean(disenchantModalPreview), () => setDisenchantModalPreview(null));
  useModalDismiss(Boolean(singleDisenchantConfirm), () => setSingleDisenchantConfirm(null));
  useModalDismiss(incompleteDeckPromptOpen, () => setIncompleteDeckPromptOpen(false));
  useModalDismiss(creatingClassPicker, () => setCreatingClassPicker(false));

  useEffect(() => {
    hsAudio.playBgm('collection');
    const onResize = () =>
      setIsCompactMobile(
        window.innerWidth < 640 && window.innerHeight >= window.innerWidth,
      );
    const onStateChanged = () => {
      setCollection(hsStorage.getCollection());
      setGoldenCollection(hsStorage.getGoldenCollection());
      setDecks(hsStorage.getDecks());
      setProfile(hsStorage.getProfile());
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('snshero:state-changed', onStateChanged);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('snshero:state-changed', onStateChanged);
    };
  }, []);

  const syncAll = () => {
    setCollection(hsStorage.getCollection());
    setGoldenCollection(hsStorage.getGoldenCollection());
    setDecks(hsStorage.getDecks());
    setProfile(hsStorage.getProfile());
    onProfileChanged();
  };

  const showNotice = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((prev) => (prev === msg ? null : prev)), 2700);
  };

  const editingDeck = useMemo(
    () => decks.find((d) => d.id === editingDeckId) || null,
    [decks, editingDeckId],
  );

  // Keep tab aligned when opening a deck to edit
  useEffect(() => {
    if (editingDeck && activeTab !== editingDeck.heroClass && activeTab !== 'NEUTRAL') {
      setActiveTab(editingDeck.heroClass);
      setPage(0);
    }
  }, [editingDeck, activeTab]);

  const matchesBaseFilters = useCallback(
    (c: ClassicCardDef) => {
      if (editingDeck) {
        if (c.cardClass !== editingDeck.heroClass && c.cardClass !== 'NEUTRAL') return false;
      }
      if (!craftingMode && (collection[c.id] || 0) <= 0) return false;
      if (manaFilter !== 'ALL') {
        if (manaFilter === 7 ? c.cost < 7 : c.cost !== manaFilter) return false;
      }
      if (rarityFilter !== 'ALL' && c.rarity !== rarityFilter) return false;
      if (keywordChip !== 'ALL') {
        const ownedCnt = collection[c.id] || 0;
        const txt = `${c.text || ''} ${c.textEn || ''}`.toLowerCase();
        if (keywordChip === 'CHARGE') {
          const isAggro =
            c.mechanics.includes('CHARGE') ||
            c.mechanics.includes('WINDFURY') ||
            c.type === 'WEAPON' ||
            /돌진|질풍|charge|windfury/.test(txt);
          if (!isAggro) return false;
        } else if (keywordChip === 'TAUNT') {
          const isGuard =
            c.mechanics.includes('TAUNT') ||
            c.mechanics.includes('DIVINE_SHIELD') ||
            /도발|보호막|생명력.*회복|방어도|taunt|divine shield|restore|armor/.test(txt);
          if (!isGuard) return false;
        } else if (keywordChip === 'AWAKENED') {
          const isAwake =
            (c.type === 'MINION' || c.type === 'WEAPON') &&
            (c.rarity === 'LEGENDARY' ? ownedCnt >= 2 : ownedCnt >= 3);
          if (!isAwake) return false;
        } else if (keywordChip === 'AOE') {
          const isAoeBurn =
            c.type === 'SPELL' ||
            /모든 적|적 전체|피해를|all enemies|all minions|deal \d+ damage/.test(txt);
          if (!isAoeBurn) return false;
        }
      }
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const raceKo = c.race ? RACE_KO[c.race] || '' : '';
        const raceEn = c.race ? CARD_RACE_LABELS_EN[c.race] || '' : '';
        const rarityKo = RARITY_KO[c.rarity] || '';
        const rarityEn = CARD_RARITY_LABELS_EN[c.rarity] || '';
        const typeKo =
          c.type === 'WEAPON'
            ? '무기 병기 장착 weapon'
            : c.type === 'SPELL'
              ? c.mechanics?.includes('SECRET')
                ? '비밀 주문 secret spell'
                : '주문 spell'
              : '하수인 minion';
        const goldenTag = (goldenCollection[c.id] || 0) > 0 ? '황금 golden' : '';
        const charAll = `${c.snsCharName || ''} ${c.snsFactionKo || ''} ${c.snsCharNameEn || ''} ${c.snsFactionEn || ''}`;
        const hay = `${c.name} ${c.nameEn || ''} ${c.text} ${c.textEn || ''} ${typeKo} ${raceKo} ${raceEn} ${rarityKo} ${rarityEn} ${c.rarity} ${goldenTag} ${charAll}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    [craftingMode, collection, goldenCollection, manaFilter, rarityFilter, keywordChip, searchQuery, editingDeck],
  );

  const filteredCards = useMemo(() => {
    const hasSearchOrChip = searchQuery.trim().length > 0 || keywordChip !== 'ALL';
    const all = cardDb.getAllCollectible();
    if (hasSearchOrChip) {
      const allowedTabs: CardClass[] = editingDeck
        ? [editingDeck.heroClass, 'NEUTRAL']
        : ALL_CLASS_TABS;
      return all
        .filter((c) => allowedTabs.includes(c.cardClass) && matchesBaseFilters(c))
        .sort(compareCardsStoneOrder);
    }
    return all
      .filter((c) => c.cardClass === activeTab && matchesBaseFilters(c))
      .sort(compareCardsStoneOrder);
  }, [activeTab, matchesBaseFilters, searchQuery, keywordChip, editingDeck]);

  // 전체 카드첩 순회 리스트: 9개 진영 + 중립 전수(기본 382장 전체, 덱 편집 시 해당 진영+중립 전체)를 탭·비용·이름 순으로 연결
  const allNavigableCards = useMemo(() => {
    const allCollectible = cardDb.getAllCollectible();
    const tabOrder: CardClass[] = editingDeck
      ? [editingDeck.heroClass, 'NEUTRAL']
      : ALL_CLASS_TABS;
    const ordered: ClassicCardDef[] = [];
    for (const tab of tabOrder) {
      const group = allCollectible
        .filter((c) => c.cardClass === tab && matchesBaseFilters(c))
        .sort(compareCardsStoneOrder);
      ordered.push(...group);
    }
    return ordered;
  }, [editingDeck, matchesBaseFilters]);

  const allFallbackCards = useMemo(() => {
    const allCollectible = cardDb.getAllCollectible();
    const ordered: ClassicCardDef[] = [];
    for (const tab of ALL_CLASS_TABS) {
      ordered.push(
        ...allCollectible.filter((c) => c.cardClass === tab).sort(compareCardsStoneOrder),
      );
    }
    return ordered;
  }, []);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageCards = filteredCards.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const navigateToInspectCard = useCallback(
    (targetCard: ClassicCardDef) => {
      setInspectCard(targetCard);
      const nextTab = targetCard.cardClass;
      if (nextTab !== activeTab) {
        setActiveTab(nextTab);
      }
      const tabCards = cardDb
        .getAllCollectible()
        .filter((c) => c.cardClass === nextTab && matchesBaseFilters(c))
        .sort(compareCardsStoneOrder);
      const idxInTab = tabCards.findIndex((c) => c.id === targetCard.id);
      if (idxInTab >= 0) {
        setPage(Math.floor(idxInTab / PAGE_SIZE));
      }
    },
    [activeTab, matchesBaseFilters],
  );

  const turnPrevPage = useCallback(() => {
    setPage((p) => {
      const curSafe = Math.min(p, totalPages - 1);
      if (curSafe > 0) {
        hsAudio.playSfx('card_flip', 0.8);
        return curSafe - 1;
      }
      return curSafe;
    });
  }, [totalPages]);

  const turnNextPage = useCallback(() => {
    setPage((p) => {
      const curSafe = Math.min(p, totalPages - 1);
      if (curSafe < totalPages - 1) {
        hsAudio.playSfx('card_flip', 0.8);
        return curSafe + 1;
      }
      return curSafe;
    });
  }, [totalPages]);

  // 키보드 방향키(좌/우, 상/하) 및 WASD 키로 페이지 넘기기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target &&
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      // 팝업/모달 활성 중에는 페이지 넘기기 비활성화
      if (inspectCard || importModalOpen || disenchantModalPreview || creatingClassPicker) {
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a' || k === 'arrowup' || k === 'w') {
        e.preventDefault();
        turnPrevPage();
      } else if (k === 'arrowright' || k === 'd' || k === 'arrowdown' || k === 's') {
        e.preventDefault();
        turnNextPage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectCard, importModalOpen, disenchantModalPreview, creatingClassPicker, turnPrevPage, turnNextPage]);

  const handleAddCardToDeck = (card: ClassicCardDef) => {
    if (!editingDeck) {
      setInspectCard(card);
      hsAudio.playSfx('card_hover', 0.65);
      return;
    }
    const owned = collection[card.id] || 0;
    if (owned <= 0) {
      setInspectCard(card);
      showNotice(
        tr(
          '미보유 카드입니다. 상세 창에서 영웅 가루로 즉시 제작할 수 있습니다.',
          'Unowned card. You can craft it with Arcane Dust in the detail modal.',
        ),
      );
      return;
    }
    if (editingDeck.cards.length >= 30) {
      showNotice(tr('덱이 이미 30장으로 가득 찼습니다.', 'Deck already has 30 cards.'));
      return;
    }
    const inDeckCount = editingDeck.cards.filter((cid) => cid === card.id).length;
    const maxCopy = card.rarity === 'LEGENDARY' ? 1 : 2;
    if (inDeckCount >= maxCopy) {
      showNotice(
        card.rarity === 'LEGENDARY'
          ? tr('전설 카드는 덱에 1장만 편성할 수 있습니다.', 'Only 1 copy of a Legendary card allowed per deck.')
          : tr('동일 카드는 덱에 최대 2장까지 편성할 수 있습니다.', 'At most 2 copies of a card allowed per deck.'),
      );
      return;
    }
    if (inDeckCount >= owned) {
      showNotice(tr(`현재 이 카드를 ${owned}장 보유 중입니다.`, `You only own ${owned} copy/copies of this card.`));
      return;
    }

    const updated = decks.map((d) =>
      d.id === editingDeck.id ? { ...d, cards: [...d.cards, card.id] } : d,
    );
    hsStorage.saveDecks(updated);
    setDecks(updated);
    hsAudio.playSfx('card_place', 0.75);
  };

  const handleRemoveCardFromDeck = (cardId: string) => {
    if (!editingDeck) return;
    const idx = editingDeck.cards.indexOf(cardId);
    if (idx < 0) return;
    const nextCards = [...editingDeck.cards];
    nextCards.splice(idx, 1);
    const updated = decks.map((d) =>
      d.id === editingDeck.id ? { ...d, cards: nextCards } : d,
    );
    hsStorage.saveDecks(updated);
    setDecks(updated);
    hsAudio.playSfx('cm_remove_card', 0.8);
  };

  const handleAutoCompleteDeck = (
    stanceOverride?: 'AGGRO' | 'CONTROL' | 'AWAKENING',
    replaceAll = false,
  ) => {
    if (!editingDeck) return;
    const stance = stanceOverride || autoStance;
    const current = replaceAll ? [] : [...editingDeck.cards];
    const scoreCard = (c: ClassicCardDef): number => {
      const owned = collection[c.id] || 0;
      const isClass = c.cardClass === editingDeck.heroClass ? 12 : 0;
      const txt = `${c.text || ''} ${c.textEn || ''}`.toLowerCase();
      if (stance === 'AGGRO') {
        let s = isClass + Math.max(0, 7 - c.cost) * 4;
        if (c.mechanics.includes('CHARGE')) s += 26;
        if (c.type === 'WEAPON') s += 16;
        if (c.type === 'MINION' && (c.attack ?? 0) >= c.cost + 1) s += 10;
        if (owned >= 3) s += 6;
        return s;
      }
      if (stance === 'CONTROL') {
        let s = isClass + Math.min(7, c.cost) * 2;
        if (c.mechanics.includes('TAUNT')) s += 28;
        if (c.mechanics.includes('DIVINE_SHIELD')) s += 16;
        if (/회복|방어도|모든 적|처치|restore|armor|all enemies|destroy/.test(txt)) s += 18;
        if ((c.health ?? 0) >= 5) s += 8;
        return s;
      }
      // AWAKENING: owned x3 (or x2 Legendary) prioritized first!
      const isAwake =
        (c.type === 'MINION' || c.type === 'WEAPON') &&
        (c.rarity === 'LEGENDARY' ? owned >= 2 : owned >= 3);
      let s = isClass + (isAwake ? 55 + owned * 4 : owned * 5);
      if (c.rarity === 'LEGENDARY') s += 12;
      if (c.rarity === 'EPIC') s += 7;
      s -= Math.abs(c.cost - 3.5) * 1.5;
      return s;
    };

    const candidates = cardDb
      .getAllCollectible()
      .filter(
        (c) =>
          (c.cardClass === editingDeck.heroClass || c.cardClass === 'NEUTRAL') &&
          (collection[c.id] || 0) > 0,
      )
      .sort((a, b) => scoreCard(b) - scoreCard(a));

    for (const c of candidates) {
      if (current.length >= 30) break;
      const owned = collection[c.id] || 0;
      const maxAllowed = Math.min(owned, c.rarity === 'LEGENDARY' ? 1 : 2);
      while (current.length < 30 && current.filter((x) => x === c.id).length < maxAllowed) {
        current.push(c.id);
      }
    }

    const updated = decks.map((d) =>
      d.id === editingDeck.id ? { ...d, cards: current } : d,
    );
    hsStorage.saveDecks(updated);
    setDecks(updated);
    hsAudio.playSfx('zelda_secret', 0.85);
    const stanceLabel =
      stance === 'AGGRO'
        ? tr('속공형', 'Aggro')
        : stance === 'CONTROL'
          ? tr('수비형', 'Control')
          : tr('3배 각성형', '3x Awakening');
    showNotice(
      tr(
        `⚡ 카단 [${stanceLabel}] 전술로 덱이 ${current.length}/30장 완성되었습니다!`,
        `⚡ Kadan [${stanceLabel}] auto-built ${current.length}/30 cards!`,
      ),
    );
  };

  const handleCopyDeckCode = async (deck: CustomDeck) => {
    const code = encodeDeckShareCode(deck);
    const classLabel = getLocalizedHeroInfo(deck.heroClass, lang).className;
    let totalDustCost = 0;
    let awakenedInDeck = 0;
    const seenAwakened = new Set<string>();
    for (const cid of deck.cards) {
      const def = cardDb.getCard(cid);
      if (!def) continue;
      if (def.rarity !== 'FREE') {
        totalDustCost += CRAFTING_COST[def.rarity] || 40;
      }
      if (!seenAwakened.has(cid) && hasCombatStatsForJourney(def)) {
        seenAwakened.add(cid);
        if (getJourneyCardMultiplier(def, collection[cid] || 0) >= 3) {
          awakenedInDeck += 1;
        }
      }
    }
    const shareUrl = `https://snshero.com/game?deck=${encodeURIComponent(code)}&utm_source=community_challenge`;
    const shareText = isKo
      ? `[눈히어로 덱 공유] ${deck.name} (${classLabel} · ${deck.cards.length}/30장 · 제작 가루 ${totalDustCost.toLocaleString()} · 3배 각성 ${awakenedInDeck}종)\n1클릭 도전/불러오기: ${shareUrl}\n덱 코드: ${code}`
      : `[SNSHero Deck] ${deck.name} (${classLabel} · ${deck.cards.length}/30 cards · ${totalDustCost.toLocaleString()} Dust · ${awakenedInDeck} Awakened)\n1-Click Play/Import: ${shareUrl}\nCode: ${code}`;
    try {
      await navigator.clipboard.writeText(shareText);
      hsAudio.playSfx('menu_select', 0.8);
      showNotice(
        tr(
          `클립보드에 덱 공유 링크 & 제작 가루(${totalDustCost.toLocaleString()})가 복사되었습니다!`,
          `Deck challenge URL & Dust cost (${totalDustCost.toLocaleString()}) copied!`,
        ),
      );
    } catch {
      window.prompt(tr('아래 눈히어로 덱 공유 링크를 복사하세요:', 'Copy this SNSHero deck share URL:'), shareUrl);
    }
  };

  const handleImportDeckCode = () => {
    const parsed = decodeDeckShareCode(importCodeText);
    if (!parsed) {
      showNotice(tr('유효하지 않은 덱 코드입니다. SNSHERO1:... 형식을 확인하세요.', 'Invalid deck code. Check the SNSHERO1:... format.'));
      return;
    }
    const validCards: string[] = [];
    for (const cid of parsed.cards) {
      const def = cardDb.getCard(cid);
      if (
        def &&
        (def.cardClass === parsed.heroClass || def.cardClass === 'NEUTRAL') &&
        validCards.length < 30
      ) {
        const owned = collection[def.id] || 0;
        const cap = Math.min(owned, def.rarity === 'LEGENDARY' ? 1 : 2);
        if (validCards.filter((x) => x === def.id).length < cap) {
          validCards.push(def.id);
        }
      }
    }
    const importedClassLabel = getLocalizedHeroInfo(parsed.heroClass, lang).className;
    const newDeck: CustomDeck = {
      id: `deck_${Date.now()}`,
      name:
        parsed.name ||
        tr(`불러온 ${importedClassLabel} 덱`, `Imported ${importedClassLabel} Deck`),
      heroClass: parsed.heroClass,
      cards: validCards,
    };
    const updated = [newDeck, ...decks];
    hsStorage.saveDecks(updated);
    setDecks(updated);
    setImportModalOpen(false);
    setImportCodeText('');
    setEditingDeckId(newDeck.id);
    setActiveTab(newDeck.heroClass);
    hsAudio.playSfx('cm_select_hero');
    showNotice(
      tr(
        `[${newDeck.name}] (${validCards.length}/30장) 덱을 불러왔습니다!`,
        `Imported [${newDeck.name}] (${validCards.length}/30 cards)!`,
      ),
    );
  };

  const handleCreateDeck = (heroClass: HeroClass) => {
    const heroLoc = getLocalizedHeroInfo(heroClass, lang);
    const customNum = decks.filter((d) => d.heroClass === heroClass).length + 1;
    const newDeck: CustomDeck = {
      id: `deck_${Date.now()}`,
      name: isKo ? `${heroLoc.className}의 ${heroLoc.name} #${customNum}` : `${heroLoc.className} ${heroLoc.name} #${customNum}`,
      heroClass,
      cards: [],
    };
    const updated = [newDeck, ...decks];
    hsStorage.saveDecks(updated);
    setDecks(updated);
    setCreatingClassPicker(false);
    setEditingDeckId(newDeck.id);
    setActiveTab(heroClass);
    hsAudio.playSfx('cm_select_hero');
  };

  const handleDeleteDeck = (deckId: string) => {
    if (decks.length <= 1) {
      showNotice(tr('최소 1개의 덱은 남겨두어야 합니다.', 'You must keep at least 1 deck.'));
      return;
    }
    const updated = decks.filter((d) => d.id !== deckId);
    hsStorage.saveDecks(updated);
    setDecks(updated);
    if (editingDeckId === deckId) setEditingDeckId(null);
    hsAudio.playSfx('cm_remove_card');
  };

  const deckGrouped = useMemo(() => {
    if (!editingDeck) {
      return {
        entries: [],
        curve: [0, 0, 0, 0, 0, 0, 0, 0],
        minions: 0,
        spells: 0,
        weapons: 0,
        groove: computeDeckGrooveProfile([]),
      };
    }
    const counts = new Map<string, number>();
    const curve = [0, 0, 0, 0, 0, 0, 0, 0];
    const costs: number[] = [];
    let minions = 0;
    let spells = 0;
    let weapons = 0;
    for (const cid of editingDeck.cards) {
      counts.set(cid, (counts.get(cid) || 0) + 1);
      const d = cardDb.mustGetCard(cid);
      costs.push(d.cost);
      curve[Math.min(7, d.cost)] += 1;
      if (d.type === 'MINION') minions += 1;
      else if (d.type === 'WEAPON') weapons += 1;
      else spells += 1;
    }
    const entries = Array.from(counts.entries())
      .map(([cid, count]) => ({ card: cardDb.mustGetCard(cid), count }))
      .sort((a, b) => compareCardsStoneOrder(a.card, b.card));
    return { entries, curve, minions, spells, weapons, groove: computeDeckGrooveProfile(costs) };
  }, [editingDeck]);

  const ownedUniqueCount = useMemo(
    () => cardDb.getAllCollectible().filter((c) => (collection[c.id] || 0) > 0).length,
    [collection],
  );

  return (
    <div
      style={{ backgroundImage: `url(${SNS_LOCATIONS.COLLECTION_ARCHIVE})` }}
      className="relative flex h-full w-full select-none flex-col overflow-hidden bg-cover bg-center text-amber-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/72" />

      {/* Top Brass & Leather Header Bar (Clean Commercial Header — No Test Unlock Button) */}
      <header className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-1.5 border-b-[3px] border-[#b7914d] bg-gradient-to-b from-[#432b17] via-[#2b1a0d] to-[#190f07] px-2.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)] sm:gap-2 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('box_close');
              hsAudio.playBgm('tavern_hub');
              onBack();
            }}
            className="hs-brass-btn min-h-[38px] rounded-xl px-2.5 py-1 text-xs font-extrabold text-amber-100 sm:px-3.5 sm:py-1.5 sm:text-sm"
          >
            ← {isKo ? <><span className="hidden sm:inline">엘윈마을 </span>로비로</> : <><span className="hidden sm:inline">Elwin </span>Hub</>}
          </button>

          <div className="flex items-center gap-2">
            <img
              src={CLASS_CREST_URL[activeTab]}
              alt=""
              className="h-7 w-7 rounded-full border border-amber-300/60 object-cover shadow sm:h-8 sm:w-8"
            />
            <div>
              <h1 className="hs-title text-sm font-extrabold tracking-wide text-amber-100 sm:text-xl">
                {tr('별빛 기록실 · 내 카드첩', 'Starlight Archive · My Collection')}
              </h1>
              <div className="text-[10px] font-bold text-amber-300/85 sm:text-[10.5px]">
                {isKo ? `수집 현황: ${ownedUniqueCount} / 382종` : `Collected: ${ownedUniqueCount} / 382`}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {onReturnToJourney && (
            <button
              type="button"
              onClick={() => {
                hsAudio.playSfx('box_press');
                onReturnToJourney();
              }}
              className="hs-arcane-btn min-h-[36px] rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-white sm:px-3.5 sm:py-1.5 sm:text-xs"
            >
              ⚔ {tr('스토리모드 출진', 'Enter Story Mode')}
            </button>
          )}

          <div className="flex items-center gap-1 rounded-xl border border-sky-400/50 bg-slate-950/85 px-2.5 py-1 text-[11px] font-extrabold text-sky-200 shadow-inner sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
            <HsArcaneDustVialIcon size={16} />
            <span className="hidden sm:inline">{tr('영웅 가루', 'Arcane Dust')}</span>
            <span className="hs-num ml-0.5 text-xs text-white sm:text-sm">{profile.arcaneDust}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              hsAudio.playSfx('open_menu', 0.8);
              setDisenchantModalPreview(hsStorage.previewMassDisenchant());
            }}
            className="hs-brass-btn min-h-[36px] rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-sky-200 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            {tr('여분 분해', 'Disenchant Extra')}
          </button>
        </div>
      </header>

      {/* Mobile Portrait Panel Switcher (`< lg`) so Tome & Deckbuilder Each Get 100% Height */}
      <div className="relative z-20 flex shrink-0 gap-1.5 border-b border-amber-500/30 bg-stone-950/90 px-2.5 py-1.5 lg:hidden">
        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('ui_click', 0.6);
            setMobilePanel('TOME');
          }}
          className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold transition ${
            mobilePanel === 'TOME'
              ? 'border-amber-200 bg-gradient-to-b from-amber-500 to-amber-800 text-white shadow'
              : 'border-amber-500/35 bg-stone-900 text-amber-200/80'
          }`}
        >
          <span>{tr(`카드첩 보기 (${ownedUniqueCount}/382)`, `Collection (${ownedUniqueCount}/382)`)}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            hsAudio.playSfx('ui_click', 0.6);
            setMobilePanel('DECKS');
          }}
          className={`flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-xl border text-xs font-extrabold transition ${
            mobilePanel === 'DECKS'
              ? 'border-sky-200 bg-gradient-to-b from-sky-500 to-blue-900 text-white shadow'
              : 'border-amber-500/35 bg-stone-900 text-amber-200/80'
          }`}
        >
          <span>
            {editingDeck
              ? tr(
                  `편집 중: ${getDeckDisplayName(editingDeck, lang)} (${editingDeck.cards.length}/30)`,
                  `Editing: ${getDeckDisplayName(editingDeck, lang)} (${editingDeck.cards.length}/30)`,
                )
              : tr(`보유 덱 목록 (${decks.length}개)`, `My Decks (${decks.length})`)}
          </span>
        </button>
      </div>

      {/* DEV-026: Mobile Sticky Mini Mana Curve Bar (`< lg`) */}
      {editingDeck && (
        <div
          data-testid="mobile-sticky-mana-curve"
          className="relative z-20 flex shrink-0 items-center justify-between gap-2 border-b border-amber-400/35 bg-[#120b05]/95 px-2.5 py-1.5 lg:hidden"
        >
          <div className="flex flex-1 items-end gap-1">
            {deckGrouped.curve.map((cnt, bucket) => {
              const maxBar = Math.max(5, ...deckGrouped.curve);
              const pct = Math.round((cnt / maxBar) * 100);
              return (
                <div key={bucket} className="flex flex-1 flex-col items-center">
                  <div className="flex h-4 w-full items-end overflow-hidden rounded-t border border-sky-400/30 bg-stone-900">
                    <div
                      style={{ height: `${pct}%` }}
                      className="w-full bg-gradient-to-t from-sky-600 to-cyan-300"
                    />
                  </div>
                  <span className="hs-num text-[8.5px] text-sky-200">{bucket === 7 ? '7+' : bucket}</span>
                </div>
              );
            })}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hs-num rounded-md bg-stone-900 px-1.5 py-0.5 text-[11px] font-black text-yellow-300">
              {editingDeck.cards.length}/30
            </span>
            {editingDeck.cards.length < 30 && (
              <button
                type="button"
                onClick={() => handleAutoCompleteDeck()}
                className="hs-zelda-a-btn rounded-lg px-2 py-1 text-[10px] font-extrabold"
              >
                ⚡ {tr('자동완성', 'Auto')}
              </button>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-[140] w-[90vw] max-w-md -translate-x-1/2 rounded-2xl border-2 border-amber-300 bg-stone-950/95 px-4 py-2 text-center text-xs font-extrabold text-amber-100 shadow-2xl">
          {toast}
        </div>
      )}

      {/* Floating Deck-Tile Hover Card Preview (Desktop >= lg) */}
      {hoveredTileCard && !inspectCard && (
        <div className="pointer-events-none absolute right-[26.5%] top-1/2 z-[90] hidden -translate-y-1/2 lg:block">
          <HearthstoneCard
            card={hoveredTileCard}
            isGolden={(goldenCollection[hoveredTileCard.id] || 0) > 0}
            size="MD"
          />
        </div>
      )}

      {/* DEV-040: Starter-First Recommendation Strip (3x Awakening Imminent x2 Cards + 1-Tap Kadan Auto-Upgrade) */}
      <div
        data-testid="collection-starter-summary"
        className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-500/35 bg-[#120b05]/95 px-2.5 py-1.5 text-xs text-amber-100 sm:px-4"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="font-extrabold text-yellow-300">
            ⚡ {tr('카단 핵심 요약:', 'Kadan Quick Deck:')}
          </span>
          <span className="rounded-lg border border-amber-400/35 bg-stone-900/90 px-2 py-0.5 text-[11px] font-bold">
            {editingDeck
              ? `${getDeckDisplayName(editingDeck, lang)} (${editingDeck.cards.length}/30)`
              : decks[0]
                ? `${getDeckDisplayName(decks[0], lang)} (${decks[0].cards.length}/30)`
                : tr('대표 덱 30장', 'Starter 30 Cards')}
          </span>
          {starterSummaryOpen &&
            (() => {
              const nearAwake = cardDb
                .getAllCollectible()
                .filter(
                  (c) =>
                    hasCombatStatsForJourney(c) &&
                    c.rarity !== 'FREE' &&
                    (c.rarity === 'LEGENDARY'
                      ? (collection[c.id] || 0) === 1
                      : (collection[c.id] || 0) === 2),
                )
                .slice(0, 3);
              return nearAwake.length > 0 ? (
                <div className="hidden flex-wrap items-center gap-1 md:flex">
                  <span className="text-[10.5px] font-bold text-emerald-300">
                    {tr('3배 각성 임박(1장 남음):', '1 Copy to 3x Awaken:')}
                  </span>
                  {nearAwake.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigateToInspectCard(c)}
                      className="rounded-md border border-emerald-400/50 bg-emerald-950/75 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-100 hover:bg-emerald-900"
                    >
                      {getCardName(c, lang)}
                    </button>
                  ))}
                </div>
              ) : null;
            })()}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-testid="collection-kadan-auto-upgrade-btn"
            onClick={() => {
              const targetDeck = editingDeck || decks[0];
              if (!targetDeck) return;
              if (!editingDeck) {
                setEditingDeckId(targetDeck.id);
                setActiveTab(targetDeck.heroClass);
                showNotice(
                  tr(
                    `[${getDeckDisplayName(targetDeck, lang)}] 편집 모드를 열었습니다. 다시 한 번 누르면 카단 3배 각성 덱으로 자동 보강됩니다!`,
                    `Opened [${getDeckDisplayName(targetDeck, lang)}]. Tap again to auto-upgrade with Kadan Awakening!`,
                  ),
                );
                return;
              }
              handleAutoCompleteDeck('AWAKENING', editingDeck.cards.length === 30);
            }}
            className="hs-zelda-a-btn min-h-[34px] rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-white"
          >
            ⚡ {tr('카단 1탭 자동 보강', '1-Tap Kadan Auto-Build')}
          </button>
          <button
            type="button"
            onClick={() => setStarterSummaryOpen((v) => !v)}
            className="min-h-[34px] rounded-lg border border-amber-400/35 bg-black/50 px-2 text-[10.5px] font-bold text-amber-200"
          >
            {starterSummaryOpen ? tr('요약 접기 ▲', 'Compact ▲') : tr('추천 펼치기 ▼', 'Expand ▼')}
          </button>
        </div>
      </div>

      {/* Main Split Layout: Leather Tome (Left 9 Cols) + Deckbuilder Tray (Right 3 Cols) */}
      <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
        {/* Left 9 Columns: Open Leather Collection Tome */}
        <section
          className={`${
            mobilePanel === 'TOME' ? 'flex' : 'hidden'
          } min-h-0 flex-col px-2 pb-2 pt-1.5 sm:px-3 sm:pb-3 sm:pt-2 lg:col-span-9 lg:flex`}
        >
          {/* Stitched Faction Bookmark Tabs (Scrollable on Mobile Portrait!) */}
          <div className="hs-no-scrollbar flex shrink-0 gap-1 overflow-x-auto pl-1 lg:flex-wrap lg:overflow-visible">
            {([...HERO_CLASS_ORDER, 'NEUTRAL'] as CardClass[]).map((cls) => {
              const disabled =
                Boolean(editingDeck) && cls !== editingDeck!.heroClass && cls !== 'NEUTRAL';
              const label =
                cls === 'NEUTRAL'
                  ? tr('다종족 연합', 'Neutral')
                  : getLocalizedHeroInfo(cls as HeroClass, lang).className;
              const active = activeTab === cls;
              return (
                <button
                  key={cls}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    hsAudio.playSfx('card_flip', 0.65);
                    setActiveTab(cls);
                    setPage(0);
                  }}
                  className={`flex shrink-0 items-center gap-1 rounded-t-xl border-x-2 border-t-2 px-2 py-1 text-[11px] font-extrabold transition sm:gap-1.5 sm:px-2.5 sm:text-xs ${
                    active
                      ? 'z-10 -mb-[2px] border-[#cfa85d] bg-[#ead9b7] pb-1.5 text-[#2b190b] shadow'
                      : disabled
                        ? 'cursor-not-allowed border-stone-800 bg-stone-950/50 text-stone-600 opacity-45'
                        : 'border-[#7c5b30] bg-gradient-to-b from-[#49301a] to-[#2b1a0d] text-amber-200 hover:brightness-115'
                  }`}
                >
                  <img
                    src={CLASS_CREST_URL[cls]}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover sm:h-5 sm:w-5"
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Open Parchment Tome Spread */}
          <div
            style={{
              backgroundImage:
                'linear-gradient(90deg, #dfd0b0 0%, #f5ebd4 47%, #c4a36e 50%, #f5ebd4 53%, #ddcea9 100%)',
            }}
            className="relative flex min-h-0 flex-1 flex-col justify-between rounded-b-2xl rounded-tr-2xl border-[3px] border-[#c49d56] px-2 pb-2 pt-1.5 text-stone-900 shadow-[0_20px_50px_rgba(0,0,0,0.85),inset_0_0_38px_rgba(82,50,18,0.42)] sm:rounded-b-3xl sm:rounded-tr-3xl sm:border-[4px] sm:px-4 sm:pb-2.5 sm:pt-2"
          >
            {/* Tactile Brass Page Turn Arrows */}
            {safePage > 0 && (
              <button
                type="button"
                onClick={turnPrevPage}
                title={tr('이전 페이지 (단축키: ← 또는 A)', 'Previous Page (← or A)')}
                className="hs-brass-btn absolute left-1 top-1/2 z-30 flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-full text-base font-extrabold text-amber-100 sm:left-1.5 sm:h-14 sm:w-9 sm:text-lg"
              >
                ◀
              </button>
            )}
            {safePage < totalPages - 1 && (
              <button
                type="button"
                onClick={turnNextPage}
                title={tr('다음 페이지 (단축키: → 또는 D)', 'Next Page (→ or D)')}
                className="hs-brass-btn absolute right-1 top-1/2 z-30 flex h-12 w-8 -translate-y-1/2 items-center justify-center rounded-full text-base font-extrabold text-amber-100 sm:right-1.5 sm:h-14 sm:w-9 sm:text-lg"
              >
                ▶
              </button>
            )}

            {/* DEV-026: Tactical Keyword Quick-Filter Chips */}
            <div
              data-testid="collection-keyword-chips"
              className="hs-no-scrollbar mb-1 flex shrink-0 items-center gap-1 overflow-x-auto pb-0.5"
            >
              {(
                [
                  { id: 'ALL', ko: '전체 카드', en: 'All Cards', icon: '📚' },
                  { id: 'CHARGE', ko: '돌진/속공', en: 'Charge/Aggro', icon: '⚡' },
                  { id: 'TAUNT', ko: '도발/방어', en: 'Taunt/Guard', icon: '🛡️' },
                  { id: 'AWAKENED', ko: '3배 각성', en: '3x Awakened', icon: '✨' },
                  { id: 'AOE', ko: '광역/번 주문', en: 'AoE/Spells', icon: '🔥' },
                ] as const
              ).map((chip) => {
                const active = keywordChip === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    data-testid={`keyword-chip-${chip.id.toLowerCase()}`}
                    onClick={() => {
                      hsAudio.playSfx('gem_c_select');
                      setKeywordChip(active && chip.id !== 'ALL' ? 'ALL' : chip.id);
                      setPage(0);
                    }}
                    className={`hs-mario-spring flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-extrabold transition sm:text-xs ${
                      active
                        ? 'border-sky-300 bg-gradient-to-b from-sky-600 to-blue-900 text-white shadow'
                        : 'border-[#8f6a38]/55 bg-[#efe1c0] text-[#3a2310] hover:bg-[#e5d0a3]'
                    }`}
                  >
                    <span>{chip.icon}</span>
                    <span>{isKo ? chip.ko : chip.en}</span>
                  </button>
                );
              })}
            </div>

            {/* 8-Card Spread Grid (Standard 1x Stats Only — Avoids Confusion with Story-Mode Multipliers!) */}
            <div className="grid min-h-0 flex-1 grid-cols-2 place-items-center gap-x-1.5 gap-y-1 overflow-y-auto px-7 py-0.5 sm:grid-cols-4 sm:gap-x-2 sm:gap-y-1.5">
              {pageCards.map((card) => {
                const owned = collection[card.id] || 0;
                const inDeck = editingDeck
                  ? editingDeck.cards.filter((cid) => cid === card.id).length
                  : 0;
                return (
                  <div
                    key={card.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setInspectCard(card);
                    }}
                    className="flex flex-col items-center"
                  >
                    <div
                      className={`relative transition ${
                        owned === 0
                          ? card.rarity === 'LEGENDARY'
                            ? 'opacity-75 saturate-[0.62]'
                            : 'opacity-55 saturate-[0.38]'
                          : ''
                      }`}
                    >
                      <HearthstoneCard
                        card={card}
                        isGolden={(goldenCollection[card.id] || 0) > 0}
                        size={isCompactMobile ? 'XS' : 'SM'}
                        enableTilt
                        onClick={() => {
                          if (editingDeck && owned > 0) {
                            const maxCopy = card.rarity === 'LEGENDARY' ? 1 : 2;
                            const canQuickAdd =
                              editingDeck.cards.length < 30 &&
                              inDeck < maxCopy &&
                              inDeck < owned &&
                              (card.cardClass === editingDeck.heroClass ||
                                card.cardClass === 'NEUTRAL');
                            handleAddCardToDeck(card);
                            if (canQuickAdd) {
                              showNotice(
                                tr(
                                  `[${getCardName(card, lang)}] 덱에 추가 (${editingDeck.cards.length + 1}/30)`,
                                  `Added [${getCardName(card, lang)}] (${editingDeck.cards.length + 1}/30)`,
                                ),
                              );
                            }
                            return;
                          }
                          hsAudio.playSfx('card_hover', 0.7);
                          setInspectCard(card);
                        }}
                        className="cursor-pointer"
                      />
                      {(goldenCollection[card.id] || 0) > 0 && (
                        <span className="hs-outline-sm pointer-events-none absolute left-1.5 bottom-1.5 z-30 rounded border border-yellow-200 bg-gradient-to-b from-yellow-400 to-amber-700 px-1 py-[1px] text-[8px] font-black text-white shadow">
                          {tr(`황금×${Math.min(owned, goldenCollection[card.id] || 0)}`, `Gold ×${Math.min(owned, goldenCollection[card.id] || 0)}`)}
                        </span>
                      )}
                      {owned >= 3 && (card.type === 'MINION' || card.type === 'WEAPON') && (
                        <span
                          data-testid={`card-awakened-3x-${card.id}`}
                          className="hs-outline-sm pointer-events-none absolute left-1.5 top-2 z-30 rounded-full border border-emerald-200 bg-gradient-to-b from-emerald-500 to-emerald-800 px-1.5 py-[1px] text-[8.5px] font-black text-white shadow sm:left-2 sm:top-3 sm:text-[9px]"
                        >
                          {tr('⚡3배 각성', '⚡3x Awake')}
                        </span>
                      )}
                      {editingDeck && inDeck > 0 && (
                        <span className="hs-num pointer-events-none absolute right-1.5 top-2 z-30 rounded-full border border-emerald-200 bg-emerald-700 px-1.5 py-0.5 text-[9.5px] text-white shadow sm:right-2 sm:top-3 sm:px-2 sm:text-[10px]">
                          {tr(`덱 ${inDeck}`, `Deck ${inDeck}`)}
                        </span>
                      )}
                    </div>

                    {/* Clean Parchment Ownership Ribbon (No Story Multiplier Clutter in Deck Builder) */}
                    <div className="-mt-1 flex flex-wrap items-center justify-center gap-1">
                      <span
                        className={`rounded-md border px-1.5 py-0.5 text-[9.5px] font-extrabold shadow-sm sm:px-2 sm:text-[10px] ${
                          owned > 0
                            ? card.rarity === 'LEGENDARY'
                              ? 'border-yellow-300/85 bg-gradient-to-b from-amber-800 to-amber-950 text-yellow-100'
                              : card.rarity === 'EPIC'
                                ? 'border-purple-300/75 bg-purple-950/90 text-purple-100'
                                : 'border-[#8a6432] bg-[#432913] text-amber-100'
                            : 'border-sky-800/60 bg-sky-950/85 text-sky-200'
                        }`}
                      >
                        {owned > 0
                          ? card.rarity === 'LEGENDARY'
                            ? tr(`★ 보유 ×${owned}`, `★ Owned ×${owned}`)
                            : tr(`보유 ×${owned}`, `Owned ×${owned}`)
                          : tr('미보유', 'Unowned')}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          hsAudio.playSfx('card_hover', 0.65);
                          setInspectCard(card);
                        }}
                        className="rounded-md border border-[#96703c] bg-[#fbf3df] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#3d2511] shadow-sm hover:bg-[#f2dfb7] sm:px-2 sm:text-[10px]"
                      >
                        {tr('확대', 'Inspect')}
                      </button>
                    </div>
                  </div>
                );
              })}

              {pageCards.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm font-extrabold text-[#5c3d1e]">
                  {tr(
                    '검색 및 마나/등급 필터와 일치하는 카드가 없습니다.',
                    'No cards match the current search, mana, or rarity filter.',
                  )}
                </div>
              )}
            </div>

            {/* Bottom Filter Bar: Sapphire Mana Gems + Rarity + Search (Mobile pr-16 clears KadanChatbotWidget!) */}
            <div className="mt-1 flex shrink-0 flex-col gap-1.5 border-t-2 border-[#8c6633]/35 pr-16 pt-1.5 sm:mt-1.5 sm:pr-0 sm:pt-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                {/* Sapphire Mana Crystal Filter Row */}
                <div className="hs-no-scrollbar flex items-center gap-1 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setManaFilter('ALL');
                      setPage(0);
                    }}
                    className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10.5px] font-extrabold transition sm:px-2.5 sm:py-1 sm:text-[11px] ${
                      manaFilter === 'ALL'
                        ? 'border-sky-300 bg-sky-800 text-white shadow'
                        : 'border-[#8f6a38]/50 bg-[#efe0be] text-[#3a2310] hover:bg-[#e5d0a3]'
                    }`}
                  >
                    {tr('전체', 'All')}
                  </button>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((m) => {
                    const active = manaFilter === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          hsAudio.playSfx('ui_click', 0.5);
                          setManaFilter(active ? 'ALL' : m);
                          setPage(0);
                        }}
                        className={`shrink-0 transition ${
                          active
                            ? 'scale-112 brightness-115'
                            : 'opacity-80 hover:scale-108 hover:opacity-100'
                        }`}
                      >
                        <HsManaGem value={m === 7 ? '7+' : m} size={25} active={active} />
                      </button>
                    );
                  })}
                </div>

                {/* Rarity Gem Filter */}
                <div className="hs-no-scrollbar flex items-center gap-1 overflow-x-auto rounded-xl border border-[#8f6a38]/45 bg-[#efe1c0] px-1.5 py-0.5">
                  {RARITY_FILTER_OPTIONS.map((rf) => (
                    <button
                      key={rf.id}
                      type="button"
                      onClick={() => {
                        setRarityFilter(rf.id);
                        setPage(0);
                      }}
                      className={`flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-extrabold transition sm:px-2 sm:text-[10.5px] ${
                        rarityFilter === rf.id
                          ? 'bg-[#3e2612] text-amber-100 shadow'
                          : 'text-[#4a2e16] hover:bg-[#e2cfa4]'
                      }`}
                    >
                      <span
                        style={{ backgroundColor: rf.dotColor }}
                        className="h-2 w-2 rounded-full border border-black/40"
                      />
                      <span>{isKo ? rf.labelKo : rf.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Search + Ownership Toggle + Page Counter */}
              <div className="flex items-center justify-between gap-1.5">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder={tr(
                    '영웅명 · 카드명 · 효과 · 종족 검색...',
                    'Search hero, card, effect, or race...',
                  )}
                  className="min-w-0 flex-1 rounded-xl border border-[#8a6534] bg-[#fdf8ed] px-2.5 py-1 text-xs font-bold text-stone-900 shadow-inner placeholder:text-stone-400 focus:border-sky-600 focus:outline-none sm:max-w-xs sm:px-3"
                />

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCraftingMode((v) => !v);
                      setPage(0);
                    }}
                    className={`rounded-xl border px-2 py-1 text-[10.5px] font-extrabold transition sm:px-2.5 sm:text-[11px] ${
                      craftingMode
                        ? 'border-sky-300 bg-sky-800 text-white shadow'
                        : 'border-[#8a6534] bg-[#efe1c0] text-[#3a2310]'
                    }`}
                  >
                    {craftingMode ? tr('전체 382종', 'All 382') : tr('보유만', 'Owned Only')}
                  </button>

                  <span className="hs-num rounded-lg bg-[#422813] px-2 py-1 text-[11px] text-amber-100 sm:px-2.5 sm:text-xs">
                    {safePage + 1} / {totalPages}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right 3 Columns: Oak & Iron Deckbuilder Tray */}
        <aside
          className={`hs-wood-panel ${
            mobilePanel === 'DECKS' ? 'flex' : 'hidden'
          } min-h-0 flex-col border-l-[3px] border-[#b7914d] p-3 lg:col-span-3 lg:flex`}
        >
          {!editingDeck ? (
            <>
              <div className="mb-2.5 flex items-center justify-between gap-1">
                <h2 className="hs-title text-base font-extrabold text-amber-100">
                  {tr(`보유 덱 (${decks.length})`, `My Decks (${decks.length})`)}
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setImportModalOpen((v) => !v)}
                    className="hs-brass-btn rounded-lg px-2 py-1 text-[11px] font-extrabold text-sky-200"
                  >
                    {tr('코드 입력', 'Import')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingClassPicker((v) => !v)}
                    className="hs-arcane-btn rounded-lg px-2.5 py-1 text-[11px] font-extrabold text-white"
                  >
                    {tr('+ 새 덱', '+ New Deck')}
                  </button>
                </div>
              </div>

              {importModalOpen && (
                <div className="mb-2.5 rounded-xl border border-sky-400/50 bg-slate-950/90 p-2.5">
                  <div className="mb-1 text-[11px] font-extrabold text-sky-200">
                    {tr('눈히어로 덱 공유 코드 불러오기', 'Import SNSHero Deck Code')}
                  </div>
                  <input
                    type="text"
                    value={importCodeText}
                    onChange={(e) => setImportCodeText(e.target.value)}
                    placeholder={tr('SNSHERO1:... 붙여넣기', 'Paste SNSHERO1:...')}
                    className="w-full rounded-lg border border-sky-500/40 bg-black/70 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <div className="mt-1.5 flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleImportDeckCode}
                      className="hs-arcane-btn flex-1 rounded-lg py-1 text-[11px] font-extrabold text-white"
                    >
                      {tr('덱 생성', 'Create Deck')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(false)}
                      className="hs-brass-btn rounded-lg px-2.5 py-1 text-[11px] font-bold text-amber-200"
                    >
                      {tr('닫기', 'Close')}
                    </button>
                  </div>
                </div>
              )}

              {creatingClassPicker && (
                <div className="mb-2.5 grid grid-cols-3 gap-1.5 rounded-xl border border-[#cfa85d]/50 bg-black/55 p-2">
                  {HERO_CLASS_ORDER.map((hc) => (
                    <button
                      key={hc}
                      type="button"
                      onClick={() => handleCreateDeck(hc)}
                      className="hs-brass-btn flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-extrabold text-amber-100"
                    >
                      <img
                        src={CLASS_CREST_URL[hc]}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover"
                      />
                      <span className="truncate">{getLocalizedHeroInfo(hc, lang).className}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {decks.map((d) => {
                  const dh = CLASSIC_HEROES[d.heroClass];
                  const dhLoc = getLocalizedHeroInfo(d.heroClass, lang);
                  const complete = d.cards.length === 30;
                  return (
                    <div
                      key={d.id}
                      className="group relative flex items-center justify-between overflow-hidden rounded-xl border-2 border-[#c8a158]/75 bg-stone-950 p-2 shadow-lg transition hover:border-amber-200"
                    >
                      <img
                        src={getHeroArtUrl(dh.heroId)}
                        alt=""
                        className="pointer-events-none absolute right-0 top-0 h-full w-28 object-cover object-top opacity-35 transition group-hover:opacity-50"
                      />
                      <div
                        style={{
                          background:
                            'linear-gradient(90deg, rgba(22,13,7,0.96) 0%, rgba(22,13,7,0.82) 58%, rgba(22,13,7,0.2) 100%)',
                        }}
                        className="pointer-events-none absolute inset-0"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          hsAudio.playSfx('box_tray_out', 0.7);
                          setEditingDeckId(d.id);
                        }}
                        className="relative z-10 flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <img
                          src={CLASS_CREST_URL[d.heroClass]}
                          alt={dhLoc.className}
                          className="h-9 w-9 shrink-0 rounded-full border border-amber-200/80 object-cover shadow"
                        />
                        <div className="min-w-0">
                          <div className="hs-outline-sm truncate text-xs font-extrabold text-white">
                            {getDeckDisplayName(d, lang)}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] font-bold">
                            <span style={{ color: dh.accentColor }}>{dhLoc.className}</span>
                            <span className="text-stone-500">·</span>
                            <span className={complete ? 'text-emerald-300' : 'text-amber-300'}>
                              {isKo ? `${d.cards.length}/30장` : `${d.cards.length}/30`} ({Math.round((d.cards.length / 30) * 100)}%)
                            </span>
                          </div>
                          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-stone-800/90">
                            <div
                              style={{
                                width: `${Math.min(100, Math.round((d.cards.length / 30) * 100))}%`,
                                backgroundColor: complete ? '#34d399' : '#fbbf24',
                              }}
                              className="h-full transition-all"
                            />
                          </div>
                        </div>
                      </button>

                      <div className="relative z-10 ml-1 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyDeckCode(d)}
                          title={tr('덱 코드 복사', 'Copy Deck Code')}
                          className="rounded-lg border border-sky-400/40 bg-slate-900/90 px-1.5 py-1 text-[10px] font-bold text-sky-200 hover:bg-sky-900"
                        >
                          {tr('복사', 'Copy')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDeck(d.id)}
                          title={tr('덱 삭제', 'Delete Deck')}
                          className="rounded-lg border border-red-400/40 bg-red-950/85 px-1.5 py-1 text-[10px] font-bold text-red-200 hover:bg-red-800"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Active 30-Card Deckbuilder View */
            <>
              {/* Hero Banner Header */}
              <div className="relative mb-2 overflow-hidden rounded-xl border-2 border-[#d8b36a] bg-stone-950 p-2.5 shadow-lg">
                <img
                  src={getHeroArtUrl(CLASSIC_HEROES[editingDeck.heroClass].heroId)}
                  alt=""
                  className="pointer-events-none absolute right-0 top-0 h-full w-32 object-cover object-top opacity-45"
                />
                <div
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(16,10,5,0.96) 0%, rgba(16,10,5,0.82) 60%, rgba(16,10,5,0.25) 100%)',
                  }}
                  className="pointer-events-none absolute inset-0"
                />

                <div className="relative z-10 flex items-center gap-2">
                  <img
                    src={CLASS_CREST_URL[editingDeck.heroClass]}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full border border-amber-200 object-cover shadow"
                  />
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={editingDeck.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updated = decks.map((d) =>
                          d.id === editingDeck.id ? { ...d, name: val } : d,
                        );
                        hsStorage.saveDecks(updated);
                        setDecks(updated);
                      }}
                      className="hs-outline-sm w-full bg-transparent text-sm font-extrabold text-amber-100 outline-none focus:border-b focus:border-amber-300"
                    />
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span style={{ color: CLASSIC_HEROES[editingDeck.heroClass].accentColor }}>
                        {isKo
                          ? `${CLASSIC_HEROES[editingDeck.heroClass].classNameKo} 덱`
                          : `${getLocalizedHeroInfo(editingDeck.heroClass, lang).className} Deck`}
                      </span>
                      <span
                        className={`hs-num text-xs ${
                          editingDeck.cards.length === 30 ? 'text-emerald-300' : 'text-yellow-300'
                        }`}
                      >
                        {editingDeck.cards.length} / 30
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mana Curve Histogram (0 ~ 7+) */}
                <div className="relative z-10 mt-2.5 flex h-14 items-end gap-1 border-t border-amber-600/30 pt-3">
                  {deckGrouped.curve.map((cnt, costBucket) => {
                    const maxBar = Math.max(6, ...deckGrouped.curve);
                    const hPct = Math.round((cnt / maxBar) * 100);
                    return (
                      <div key={costBucket} className="flex flex-1 flex-col items-center">
                        <span className="mb-0.5 h-3 text-[9px] font-extrabold text-amber-200">
                          {cnt > 0 ? cnt : ''}
                        </span>
                        <div className="flex h-7 w-full items-end overflow-hidden rounded-t border border-amber-500/25 bg-stone-900/95">
                          <div
                            style={{ height: `${hPct}%` }}
                            className="w-full rounded-t bg-gradient-to-t from-blue-700 via-sky-500 to-sky-200 transition-all"
                          />
                        </div>
                        <span className="hs-num mt-0.5 text-[9.5px] text-sky-200">
                          {costBucket === 7 ? '7+' : costBucket}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Card Type Breakdown (Minion / Spell / Weapon) */}
                <div className="relative z-10 mt-1.5 flex items-center justify-between border-t border-amber-600/20 pt-1.5 text-[10px] font-extrabold text-amber-200/90">
                  <span>{tr('하수인', 'Minions')} {deckGrouped.minions}</span>
                  <span>·</span>
                  <span>{tr('주문', 'Spells')} {deckGrouped.spells}</span>
                  <span>·</span>
                  <span>{tr('무기', 'Weapons')} {deckGrouped.weapons}</span>
                </div>
                {/* Deck Groove BPM Profile (DEV-060) */}
                <div
                  data-testid="deck-groove-badge"
                  className="relative z-10 mt-1.5 flex items-center justify-between rounded border border-emerald-400/30 bg-emerald-950/50 px-2 py-1 text-[10px] font-extrabold text-emerald-200"
                >
                  <span>🎵 {tr(deckGrouped.groove.labelKo, deckGrouped.groove.labelEn)}</span>
                  <span className="text-amber-200/90">
                    {tr('평균', 'Avg')} {deckGrouped.groove.avgMana}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobilePanel('TOME')}
                className="hs-arcane-btn mb-2 w-full rounded-xl py-1.5 text-xs font-extrabold text-white lg:hidden"
              >
                {tr('+ 카드첩에서 카드 선택·추가하기', '+ Add Cards from Collection')}
              </button>

              <div className="flex-1 space-y-1 overflow-y-auto pr-1">
                {deckGrouped.entries.map(({ card, count }) => (
                  <div
                    key={card.id}
                    onMouseEnter={() => setHoveredTileCard(card)}
                    onMouseLeave={() => setHoveredTileCard(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      hsAudio.playSfx('card_hover', 0.65);
                      setInspectCard(card);
                    }}
                    className="group relative flex h-8 w-full items-center justify-between overflow-hidden rounded-md border border-[#b58e4c]/70 bg-[#18110b] pl-1 pr-1 text-left shadow transition hover:border-amber-300"
                  >
                    {/* Right-Side Cropped Character Portrait Tile */}
                    <img
                      src={getCardTileUrl(card.id)}
                      alt=""
                      className="pointer-events-none absolute right-0 top-0 h-full w-32 object-cover object-top opacity-75 transition group-hover:scale-105"
                    />
                    <div
                      style={{
                        background:
                          'linear-gradient(90deg, #16100a 0%, #16100a 48%, rgba(22,16,10,0.45) 78%, rgba(22,16,10,0.12) 100%)',
                      }}
                      className="pointer-events-none absolute inset-0"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        const nextLen = Math.max(0, editingDeck.cards.length - 1);
                        handleRemoveCardFromDeck(card.id);
                        setHoveredTileCard(null);
                        showNotice(
                          tr(
                            `[${getCardName(card, lang)}] 덱에서 제외 (${nextLen}/30)`,
                            `Removed [${getCardName(card, lang)}] (${nextLen}/30)`,
                          ),
                        );
                      }}
                      title={tr(
                        '클릭하여 덱에서 1장 제외 (우클릭 또는 🔍 버튼으로 카드 확대)',
                        'Click to remove 1 copy (Right-click or tap 🔍 to inspect)',
                      )}
                      className="relative z-10 flex h-full min-w-0 flex-1 items-center justify-between pr-1 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-1.5">
                        <HsManaGem value={card.cost} size={23} />
                        <span className="hs-outline-sm truncate text-xs font-extrabold text-white">
                          {getCardName(card, lang)}
                        </span>
                      </div>

                      {(card.rarity === 'LEGENDARY' || count > 1) && (
                        <span className="hs-num ml-1 flex h-5 min-w-5 items-center justify-center rounded border border-amber-300/70 bg-[#2a1a0c]/95 px-1 text-[11px] text-amber-300 shadow">
                          {card.rarity === 'LEGENDARY' ? '★' : count}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hsAudio.playSfx('card_hover', 0.65);
                        setInspectCard(card);
                      }}
                      title={tr('카드 상세 보기', 'Inspect Card')}
                      className="relative z-10 ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-amber-300/50 bg-black/65 text-[10px] text-amber-200 hover:border-amber-200 hover:bg-amber-900/70"
                    >
                      🔍
                    </button>
                  </div>
                ))}

                {deckGrouped.entries.length === 0 && (
                  <div className="rounded-xl border border-amber-500/20 bg-black/35 px-3 py-8 text-center text-xs font-semibold text-amber-200/70">
                    {tr(
                      '카드첩에서 보유 카드를 클릭하면 1장씩 즉시 덱에 추가됩니다! (아래 [자동 완성]도 가능)',
                      'Click any owned card in the tome to add it in 1 click, or tap [Auto Complete] below!',
                    )}
                  </div>
                )}
              </div>

              {/* Deckbuilder Footer Controls + DEV-026 Kadan Tactical 30-Card Auto-Complete */}
              <div className="mt-2 space-y-1.5 border-t border-amber-500/25 pt-2">
                <div
                  data-testid="kadan-tactical-autocomplete"
                  className="rounded-xl border border-amber-400/35 bg-black/40 p-1.5"
                >
                  <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-extrabold text-amber-200">
                    <span>⚡ {tr('카단 전술형 30장 자동 편성', 'Kadan Tactical 30-Card Auto-Build')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(
                      [
                        { id: 'AGGRO', ko: '⚔ 속공형', en: '⚔ Aggro' },
                        { id: 'CONTROL', ko: '🛡 수비형', en: '🛡 Control' },
                        { id: 'AWAKENING', ko: '✨ 각성형', en: '✨ 3x Awake' },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        data-testid={`kadan-autobuild-${st.id.toLowerCase()}`}
                        onClick={() => {
                          setAutoStance(st.id);
                          handleAutoCompleteDeck(st.id, editingDeck.cards.length === 30);
                        }}
                        className={`hs-mario-spring min-h-[36px] rounded-lg border px-1.5 py-1 text-[10.5px] font-extrabold transition ${
                          autoStance === st.id
                            ? 'border-yellow-300 bg-amber-700/90 text-white shadow'
                            : 'border-amber-500/35 bg-stone-900 text-amber-200 hover:border-amber-300'
                        }`}
                      >
                        {isKo ? st.ko : st.en}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {editingDeck.cards.length < 30 && (
                    <button
                      type="button"
                      onClick={() => handleAutoCompleteDeck()}
                      className="hs-arcane-btn flex-1 rounded-xl py-1.5 text-xs font-extrabold text-white"
                    >
                      {tr('빈 슬롯 자동 채우기', 'Fill Remaining')}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopyDeckCode(editingDeck)}
                    className="hs-brass-btn flex-1 rounded-xl py-1.5 text-xs font-extrabold text-sky-200"
                  >
                    {tr('덱 코드 복사', 'Copy Deck Code')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (editingDeck.cards.length < 30) {
                      hsAudio.playSfx('ui_click');
                      setIncompleteDeckPromptOpen(true);
                      return;
                    }
                    setHoveredTileCard(null);
                    hsAudio.playSfx('box_tray_in', 0.75);
                    setEditingDeckId(null);
                  }}
                  className="hs-brass-btn w-full rounded-xl border-emerald-300/80 bg-gradient-to-b from-emerald-600 to-emerald-900 py-2 text-xs font-extrabold text-white"
                >
                  {tr('덱 편성 완료', 'Done Editing')}
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Unified Card Zoom + Deck Add/Remove + Crafting Modal (Outer Tap Cancels!) */}
      {inspectCard &&
        (() => {
          const owned = collection[inspectCard.id] || 0;
          const maxCopy = inspectCard.rarity === 'LEGENDARY' ? 1 : 2;
          const inDeck = editingDeck
            ? editingDeck.cards.filter((cid) => cid === inspectCard.id).length
            : 0;
          const canAddNow =
            Boolean(editingDeck) &&
            owned > 0 &&
            editingDeck!.cards.length < 30 &&
            inDeck < maxCopy &&
            inDeck < owned &&
            (inspectCard.cardClass === editingDeck!.heroClass ||
              inspectCard.cardClass === 'NEUTRAL');

          let primaryAction: CardZoomAction | undefined;
          const secondaryActions: CardZoomAction[] = [];

          const inspectCardName = getCardName(inspectCard, lang);

          if (editingDeck) {
            if (canAddNow) {
              primaryAction = {
                label: tr(
                  `덱에 카드 넣기 (${editingDeck.cards.length + 1}/30)`,
                  `Add to Deck (${editingDeck.cards.length + 1}/30)`,
                ),
                variant: 'emerald',
                onClick: () => {
                  const willFillDeck = editingDeck.cards.length + 1 >= 30;
                  handleAddCardToDeck(inspectCard);
                  showNotice(
                    tr(
                      `[${inspectCardName}] 카드를 덱에 넣었습니다 (${editingDeck.cards.length + 1}/30)`,
                      `Added [${inspectCardName}] to deck (${editingDeck.cards.length + 1}/30)`,
                    ),
                  );
                  if (willFillDeck) {
                    setInspectCard(null);
                  }
                },
              };
            } else if (owned === 0 && inspectCard.rarity !== 'FREE') {
              primaryAction = {
                label: tr(
                  `영웅 카드 제작 (-${CRAFTING_COST[inspectCard.rarity]} 가루)`,
                  `Craft Card (-${CRAFTING_COST[inspectCard.rarity]} Dust)`,
                ),
                variant: 'arcane',
                onClick: () => {
                  const res = hsStorage.craftCard(inspectCard.id);
                  if (res.ok) {
                    hsAudio.playSfx('purchase');
                    syncAll();
                    showNotice(tr(`[${inspectCardName}] 카드를 제작했습니다!`, `Crafted [${inspectCardName}]!`));
                  } else {
                    showNotice(res.reason || tr('영웅 가루가 부족합니다.', 'Not enough Arcane Dust.'));
                  }
                },
              };
            } else if (inDeck > 0) {
              primaryAction = {
                label: tr(
                  `덱에서 1장 빼기 (현재 ${inDeck}장 편성)`,
                  `Remove 1 from Deck (${inDeck} in Deck)`,
                ),
                variant: 'crimson',
                onClick: () => {
                  handleRemoveCardFromDeck(inspectCard.id);
                  showNotice(
                    tr(
                      `[${inspectCardName}] 카드를 덱에서 1장 뺐습니다.`,
                      `Removed [${inspectCardName}] from deck.`,
                    ),
                  );
                },
              };
            } else {
              primaryAction = {
                label:
                  editingDeck.cards.length >= 30
                    ? tr('덱이 30장으로 가득 찼습니다', 'Deck is Full (30/30)')
                    : inDeck >= maxCopy
                      ? tr(`편성 한도 도달 (${inDeck}/${maxCopy}장)`, `Copy Limit Reached (${inDeck}/${maxCopy})`)
                      : tr(`보유 수량 모두 편성됨 (${owned}장)`, `All Owned Copies in Deck (${owned})`),
                disabled: true,
                onClick: () => {},
              };
            }

            if (canAddNow && inDeck > 0) {
              secondaryActions.push({
                label: tr(`덱에서 1장 빼기 (${inDeck}/${maxCopy})`, `Remove 1 (${inDeck}/${maxCopy})`),
                variant: 'crimson',
                onClick: () => {
                  handleRemoveCardFromDeck(inspectCard.id);
                  showNotice(
                    tr(
                      `[${inspectCardName}] 카드를 덱에서 1장 뺐습니다.`,
                      `Removed [${inspectCardName}] from deck.`,
                    ),
                  );
                },
              });
            }
          } else if (inspectCard.rarity !== 'FREE') {
            primaryAction = {
              label: tr(
                `영웅 카드 제작 (-${CRAFTING_COST[inspectCard.rarity]} 가루)`,
                `Craft Card (-${CRAFTING_COST[inspectCard.rarity]} Dust)`,
              ),
              variant: 'arcane',
              onClick: () => {
                const res = hsStorage.craftCard(inspectCard.id);
                if (res.ok) {
                  hsAudio.playSfx('purchase');
                  syncAll();
                  showNotice(tr(`[${inspectCardName}] 카드를 제작했습니다!`, `Crafted [${inspectCardName}]!`));
                } else {
                  showNotice(res.reason || tr('제작할 수 없습니다.', 'Cannot craft card.'));
                  if (onOpenShop && profile.arcaneDust < (CRAFTING_COST[inspectCard.rarity] || 40)) {
                    setDustShortageCard(inspectCard);
                  }
                }
              },
            };
          } else {
            primaryAction = {
              label: tr('확인 (닫기)', 'OK (Close)'),
              variant: 'brass',
              onClick: () => setInspectCard(null),
            };
          }

          if (inspectCard.rarity !== 'FREE') {
            if (editingDeck && owned > 0) {
              secondaryActions.push({
                label: tr(
                  `추가 제작 (-${CRAFTING_COST[inspectCard.rarity]})`,
                  `Craft Copy (-${CRAFTING_COST[inspectCard.rarity]} Dust)`,
                ),
                variant: 'arcane',
                onClick: () => {
                  const res = hsStorage.craftCard(inspectCard.id);
                  if (res.ok) {
                    hsAudio.playSfx('purchase');
                    syncAll();
                    showNotice(tr(`[${inspectCardName}] 카드를 제작했습니다!`, `Crafted [${inspectCardName}]!`));
                  } else {
                    showNotice(res.reason || tr('제작 실패', 'Craft failed'));
                  }
                },
              });
            }
            if (owned > 0) {
              const goldenOwned = Math.min(owned, goldenCollection[inspectCard.id] || 0);
              const normalOwned = Math.max(0, owned - goldenOwned);
              const nextExtractDust =
                normalOwned > 0
                  ? DISENCHANT_VALUE[inspectCard.rarity]
                  : GOLDEN_DISENCHANT_VALUE[inspectCard.rarity];
              secondaryActions.push({
                label:
                  normalOwned > 0
                    ? tr(`마력 추출 (+${nextExtractDust} 가루)`, `Disenchant (+${nextExtractDust} Dust)`)
                    : tr(`황금 마력 추출 (+${nextExtractDust} 가루)`, `Disenchant Golden (+${nextExtractDust} Dust)`),
                variant: 'brass',
                onClick: () => {
                  const breaksAwakening =
                    owned === 3 &&
                    (inspectCard.type === 'MINION' || inspectCard.type === 'WEAPON');
                  if (breaksAwakening) {
                    hsAudio.playSfx('ui_click');
                    setSingleDisenchantConfirm({
                      card: inspectCard,
                      golden: normalOwned <= 0,
                      dust: nextExtractDust,
                    });
                    return;
                  }
                  const res = hsStorage.disenchantCard(inspectCard.id);
                  if (res.ok) {
                    hsAudio.playSfx('cm_remove_card');
                    syncAll();
                    showNotice(
                      tr(
                        `[${inspectCardName}] 마력 추출 완료! (+${res.dustGained ?? nextExtractDust} 가루)`,
                        `Disenchanted [${inspectCardName}]! (+${res.dustGained ?? nextExtractDust} Dust)`,
                      ),
                    );
                  } else {
                    showNotice(res.reason || tr('분해 실패', 'Disenchant failed'));
                  }
                },
              });
              if (normalOwned > 0 && goldenOwned > 0) {
                secondaryActions.push({
                  label: tr(
                    `황금 카드 추출 (+${GOLDEN_DISENCHANT_VALUE[inspectCard.rarity]} 가루)`,
                    `Disenchant Golden (+${GOLDEN_DISENCHANT_VALUE[inspectCard.rarity]} Dust)`,
                  ),
                  variant: 'brass',
                  onClick: () => {
                    const breaksAwakening =
                      owned === 3 &&
                      (inspectCard.type === 'MINION' || inspectCard.type === 'WEAPON');
                    if (breaksAwakening) {
                      hsAudio.playSfx('ui_click');
                      setSingleDisenchantConfirm({
                        card: inspectCard,
                        golden: true,
                        dust: GOLDEN_DISENCHANT_VALUE[inspectCard.rarity],
                      });
                      return;
                    }
                    const res = hsStorage.disenchantCard(inspectCard.id, true);
                    if (res.ok) {
                      hsAudio.playSfx('cm_remove_card');
                      syncAll();
                      showNotice(
                        tr(
                          `[${inspectCardName}] 황금 카드 마력 추출 완료! (+${res.dustGained} 가루)`,
                          `Disenchanted Golden [${inspectCardName}]! (+${res.dustGained} Dust)`,
                        ),
                      );
                    } else {
                      showNotice(res.reason || tr('분해 실패', 'Disenchant failed'));
                    }
                  },
                });
              }
            }
          }

          const inspectGoldenCount = Math.min(
            owned,
            goldenCollection[inspectCard.id] || 0,
          );

          const navList = allNavigableCards.some((c) => c.id === inspectCard.id)
            ? allNavigableCards
            : allFallbackCards;
          const navIdx = navList.findIndex((c) => c.id === inspectCard.id);
          const classLabel =
            inspectCard.cardClass === 'NEUTRAL'
              ? tr('중립', 'Neutral')
              : getLocalizedHeroInfo(inspectCard.cardClass, lang).className;
          const zoomNavigation =
            navIdx >= 0 && navList.length > 1
              ? {
                  currentIndex: navIdx,
                  totalCount: navList.length,
                  positionLabel: `${classLabel} · ${navIdx + 1} / ${navList.length}`,
                  onPrev: () =>
                    navigateToInspectCard(
                      navList[(navIdx - 1 + navList.length) % navList.length],
                    ),
                  onNext: () =>
                    navigateToInspectCard(navList[(navIdx + 1) % navList.length]),
                }
              : undefined;

          return (
            <CardZoomModal
              card={inspectCard}
              isGolden={inspectGoldenCount > 0}
              rarityAura={inspectCard.rarity}
              subtitleBadge={
                editingDeck
                  ? tr(
                      `보유 ×${owned}장${inspectGoldenCount > 0 ? ` (황금 ×${inspectGoldenCount})` : ''} · 덱 편성 ${inDeck}/${maxCopy}장`,
                      `Owned ×${owned}${inspectGoldenCount > 0 ? ` (Golden ×${inspectGoldenCount})` : ''} · In Deck ${inDeck}/${maxCopy}`,
                    )
                  : tr(
                      `보유 수량: ${owned}장${inspectGoldenCount > 0 ? ` (황금 ×${inspectGoldenCount})` : ''}`,
                      `Owned: ${owned}${inspectGoldenCount > 0 ? ` (Golden ×${inspectGoldenCount})` : ''}`,
                    )
              }
              showFlavor
              navigation={zoomNavigation}
              primaryAction={primaryAction}
              secondaryActions={secondaryActions}
              onCancel={() => setInspectCard(null)}
            />
          );
        })()}

      {/* ==================== 여분 분해 안내 모달 (중복 배수 강화 = 스토리모드 전용 안내) ==================== */}
      {disenchantModalPreview && (
        <div
          onClick={() => setDisenchantModalPreview(null)}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hs-wood-panel relative max-h-[92%] w-full max-w-lg overflow-y-auto rounded-3xl p-5 text-amber-100 shadow-2xl sm:p-6"
          >
            <div className="mb-3 flex items-center justify-between border-b border-amber-500/35 pb-2.5">
              <div className="flex items-center gap-2">
                <HsArcaneDustVialIcon size={24} />
                <h2 className="hs-title text-lg font-extrabold text-amber-100 sm:text-xl">
                  {tr(
                    '여분 카드 분해 확인 (※ 배수 강화는 스토리모드 전용)',
                    'Confirm Mass Disenchant (※ Story ×N Bonus Notice)',
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDisenchantModalPreview(null)}
                className="hs-brass-btn rounded-xl px-2.5 py-1 text-xs font-extrabold text-amber-100"
              >
                {tr('닫기 ✕', 'Close ✕')}
              </button>
            </div>

            {/* Mechanism Explanation Card */}
            <div className="space-y-2.5 rounded-2xl border-2 border-emerald-400/60 bg-gradient-to-b from-emerald-950/75 to-stone-950/90 p-3.5 text-xs leading-relaxed">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-emerald-300">
                <span>⚡</span>
                <span>
                  {tr(
                    '중복 카드 배수 강화는 오직 [스토리모드]에서만 적용됩니다',
                    'Duplicate Card Multiplier Applies Only in [Story Mode]',
                  )}
                </span>
              </div>
              {isKo ? (
                <>
                  <p className="font-semibold text-amber-100/95">
                    <b className="text-sky-300">랭킹대전</b> 및{' '}
                    <b className="text-sky-300">AI대전</b>에서는 정통 규칙대로 덱당 최대 2장(전설 1장)만 사용되며, 카드 수량에 따른 공격력·체력 배수 강화가 절대 적용되지 않습니다.
                  </p>
                  <p className="font-semibold text-emerald-100">
                    반면 <b className="text-yellow-300">스토리모드</b>에서는 하수인·무기 카드를{' '}
                    <b className="text-emerald-300 underline">3장 이상 보유 시 해당 모드의 전장에서만 공격력·체력이 보유 장수 배수(3장 = 3배, N장 = N배 · 전설 2장부터 2배)</b>
                    로 증폭됩니다.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-100/95">
                    In <b className="text-sky-300">Ranked</b> and <b className="text-sky-300">Practice AI</b> modes, standard 2-copy deck rules (1 per Legendary) apply with no stat multipliers.
                  </p>
                  <p className="font-semibold text-emerald-100">
                    In <b className="text-yellow-300">Story Mode (Kadan&apos;s Journey)</b>, owning{' '}
                    <b className="text-emerald-300 underline">3+ copies of a Minion or Weapon (2+ for Legendary) multiplies its Attack &amp; Health by N×</b> on the Story battlefield.
                  </p>
                </>
              )}
              <div className="rounded-xl border border-amber-400/40 bg-black/45 px-3 py-2 text-[11px] font-bold text-amber-200">
                {tr(
                  '💡 여분 카드를 분해하면 가루를 얻지만 스토리모드 배수 보너스는 해제됩니다.',
                  '💡 Disenchanting extra copies grants Arcane Dust but reduces their Story Mode multiplier.',
                )}
              </div>
            </div>

            {/* Disenchant Impact Summary */}
            <div className="my-3.5 rounded-2xl border border-[#c8a158]/50 bg-black/45 p-3.5 text-xs">
              {disenchantModalPreview.extraCardCount > 0 ? (
                <>
                  <div className="flex items-center justify-between font-extrabold">
                    <span className="text-amber-200">
                      {tr(
                        `분해 대상 여분 카드 (${disenchantModalPreview.affectedUniqueCards}종)`,
                        `Extra Cards to Disenchant (${disenchantModalPreview.affectedUniqueCards} unique)`,
                      )}
                    </span>
                    <span className="text-red-300">
                      {tr(
                        `총 ${disenchantModalPreview.extraCardCount}장 분해 (일반 2장 / 전설 1장만 유지)`,
                        `Disenchant ${disenchantModalPreview.extraCardCount} (Keep 2 / 1 Leg)`,
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between border-t border-amber-500/20 pt-1.5 font-extrabold">
                    <span className="text-sky-200">{tr('분해 시 획득 영웅 가루', 'Arcane Dust Gained')}</span>
                    <span className="hs-num text-base text-sky-300">
                      +{disenchantModalPreview.dustGained} {tr('가루', 'Dust')}
                    </span>
                  </div>
                  {disenchantModalPreview.sampleAffectedCards.length > 0 && (
                    <div className="mt-2 space-y-1 rounded-xl bg-stone-950/80 p-2.5 text-[11px]">
                      <div className="font-bold text-amber-300/85">
                        {tr('스토리모드 배수가 해제되는 주요 보유 카드:', 'Affected cards losing Story multiplier:')}
                      </div>
                      {disenchantModalPreview.sampleAffectedCards.map((sc) => {
                        const scDef = cardDb.getCard(sc.id);
                        const scName = scDef ? getCardName(scDef, lang) : sc.name;
                        return (
                          <div key={sc.id} className="flex items-center justify-between text-amber-100/90">
                            <span className="truncate font-bold">{scName}</span>
                            <span className="shrink-0 font-extrabold text-amber-300">
                              {isKo ? `${sc.owned}장 → ${sc.afterCount}장` : `${sc.owned} → ${sc.afterCount}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-2 text-center font-bold text-amber-200/90">
                  {tr(
                    '현재 분해할 여분 카드(일반 3장 이상 / 전설 2장 이상)가 없습니다.',
                    'You have no extra copies (3+ normal or 2+ Legendary) to disenchant.',
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setDisenchantModalPreview(null);
                }}
                className="hs-arcane-btn flex-1 rounded-xl py-2.5 text-xs font-extrabold text-white sm:text-sm"
              >
                {disenchantModalPreview.extraCardCount > 0
                  ? tr('취소 · 여분 카드 유지', 'Cancel · Keep Extra Copies')
                  : tr('확인 (닫기)', 'OK (Close)')}
              </button>

              {disenchantModalPreview.extraCardCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const res = hsStorage.massDisenchantExtras();
                    setDisenchantModalPreview(null);
                    if (res.count > 0) {
                      hsAudio.playSfx('purchase');
                      syncAll();
                      showNotice(
                        tr(
                          `여분 카드 ${res.count}장을 분해하여 +${res.dustGained} 영웅 가루를 획득했습니다.`,
                          `Disenchanted ${res.count} extra copies for +${res.dustGained} Arcane Dust.`,
                        ),
                      );
                    }
                  }}
                  className="hs-brass-btn rounded-xl px-4 py-2.5 text-xs font-extrabold text-amber-200 sm:text-sm"
                >
                  {tr(
                    `그래도 여분 분해 (+${disenchantModalPreview.dustGained} 가루)`,
                    `Disenchant All (+${disenchantModalPreview.dustGained} Dust)`,
                  )}
                </button>
              )}
            </div>

            {onOpenShop && disenchantModalPreview.extraCardCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setDisenchantModalPreview(null);
                  onOpenShop();
                }}
                className="hs-gold-btn mt-2.5 w-full rounded-xl py-2.5 text-xs font-extrabold"
              >
                🎁 {tr(
                  '갈지 않고 보급소에서 1팩($1)·5팩($4)으로 가루와 3배 각성 동시 확보하기 →',
                  'Keep 3x Copies & Get 1 Pack ($1) / 5 Packs ($4) in Shop →',
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* BLD-2703: Single Card Disenchant 3x Awakening Safeguard Modal */}
      {singleDisenchantConfirm && (
        <div
          onClick={() => setSingleDisenchantConfirm(null)}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
        >
          <div
            data-testid="single-disenchant-3x-modal"
            onClick={(e) => e.stopPropagation()}
            className="hs-wood-panel relative w-full max-w-md rounded-3xl p-5 text-center text-amber-100 shadow-2xl"
          >
            <h3 className="hs-title text-lg font-extrabold text-amber-200">
              {tr('⚠️ 3배 각성 보너스 해제 경고', '⚠️ 3x Awakening Loss Warning')}
            </h3>
            <p className="mt-2.5 text-xs font-bold leading-relaxed text-amber-100/90">
              {tr(
                `[${getCardName(singleDisenchantConfirm.card, lang)}] 카드를 마력 추출하면 보유 수량이 3장 → 2장으로 감소하여 스토리모드 '3장=3배 각성' 보너스가 해제됩니다. 정말 추출하시겠습니까?`,
                `Disenchanting [${getCardName(singleDisenchantConfirm.card, lang)}] reduces your copies from 3 to 2, removing its Story Mode '3 Copies = 3x Awakening' bonus. Continue?`,
              )}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  hsAudio.playSfx('ui_click');
                  setSingleDisenchantConfirm(null);
                }}
                className="hs-arcane-btn flex-1 rounded-xl py-2.5 text-xs font-extrabold text-white"
              >
                {tr('취소 · 3배 각성 유지', 'Cancel · Keep 3x Awakening')}
              </button>
              <button
                type="button"
                data-testid="confirm-single-disenchant-btn"
                onClick={() => {
                  const target = singleDisenchantConfirm;
                  setSingleDisenchantConfirm(null);
                  const res = hsStorage.disenchantCard(target.card.id, target.golden);
                  if (res.ok) {
                    hsAudio.playSfx('cm_remove_card');
                    syncAll();
                    showNotice(
                      tr(
                        `[${getCardName(target.card, lang)}] 마력 추출 완료! (+${res.dustGained ?? target.dust} 가루)`,
                        `Disenchanted [${getCardName(target.card, lang)}]! (+${res.dustGained ?? target.dust} Dust)`,
                      ),
                    );
                  } else {
                    showNotice(res.reason || tr('분해 실패', 'Disenchant failed'));
                  }
                }}
                className="hs-brass-btn flex-1 rounded-xl border-red-400/60 bg-gradient-to-b from-red-700 to-red-950 py-2.5 text-xs font-extrabold text-white"
              >
                {tr(`그래도 추출 (+${singleDisenchantConfirm.dust} 가루)`, `Disenchant (+${singleDisenchantConfirm.dust} Dust)`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BLD-2703: Incomplete (<30 Cards) Deck Save Prompt */}
      {incompleteDeckPromptOpen && editingDeck && (
        <div
          onClick={() => setIncompleteDeckPromptOpen(false)}
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
        >
          <div
            data-testid="incomplete-deck-prompt-modal"
            onClick={(e) => e.stopPropagation()}
            className="hs-wood-panel relative w-full max-w-md rounded-3xl p-5 text-center text-amber-100 shadow-2xl"
          >
            <h3 className="hs-title text-lg font-extrabold text-yellow-300">
              {tr(`덱이 아직 ${editingDeck.cards.length}/30장입니다`, `Deck Incomplete (${editingDeck.cards.length}/30)`)}
            </h3>
            <p className="mt-2 text-xs font-bold leading-relaxed text-amber-100/90">
              {tr(
                '30장을 모두 채워야 랭킹대전 및 AI대전에서 사용할 수 있습니다. 지금 자동으로 나머지 카드를 채워 완성할까요?',
                'A full 30-card deck is required for Ranked & AI battles. Would you like to auto-complete the remaining slots?',
              )}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                data-testid="incomplete-deck-autocomplete-btn"
                onClick={() => {
                  handleAutoCompleteDeck();
                  setIncompleteDeckPromptOpen(false);
                  setHoveredTileCard(null);
                  setEditingDeckId(null);
                }}
                className="hs-arcane-btn w-full rounded-xl py-2.5 text-xs font-extrabold text-white"
              >
                ✨ {tr('자동 완성으로 30장 채우고 완료', 'Auto-Complete to 30 & Finish')}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIncompleteDeckPromptOpen(false);
                    setHoveredTileCard(null);
                    hsAudio.playSfx('box_tray_in', 0.75);
                    setEditingDeckId(null);
                    showNotice(
                      tr(
                        `미완성 초안(${editingDeck.cards.length}/30장)으로 저장되었습니다. 대전 전 30장을 채워주세요.`,
                        `Saved as draft (${editingDeck.cards.length}/30). Fill to 30 cards before queuing.`,
                      ),
                    );
                  }}
                  className="hs-brass-btn flex-1 rounded-xl py-2 text-xs font-extrabold text-amber-100"
                >
                  {tr('초안으로 저장', 'Save Draft')}
                </button>
                <button
                  type="button"
                  onClick={() => setIncompleteDeckPromptOpen(false)}
                  className="hs-brass-btn flex-1 rounded-xl py-2 text-xs font-extrabold text-amber-100"
                >
                  {tr('계속 편집', 'Keep Editing')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MKT-024: Insufficient Dust Shop Bridge Modal */}
      {dustShortageCard && onOpenShop && (
        <div
          onClick={() => setDustShortageCard(null)}
          className="fixed inset-0 z-[135] flex items-center justify-center bg-black/82 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="hs-wood-panel relative w-full max-w-md rounded-3xl p-5 text-center text-amber-100 shadow-2xl"
          >
            <h3 className="hs-title text-lg font-extrabold text-yellow-300">
              {tr('✨ 영웅 가루가 조금 부족하신가요?', '✨ Need More Arcane Dust?')}
            </h3>
            <p className="mt-2 text-xs font-bold leading-relaxed text-amber-100/90">
              {tr(
                `[${getCardName(dustShortageCard, lang)}] 제작에는 ${CRAFTING_COST[dustShortageCard.rarity]} 가루가 필요합니다 (현재 ${profile.arcaneDust} 가루). 보급소 5팩 묶음(5,600원/$4 또는 450G) 개봉 시 전설 확정 카운트 +5 & 제작 가루를 동시에 모을 수 있습니다!`,
                `Crafting [${getCardName(dustShortageCard, lang)}] requires ${CRAFTING_COST[dustShortageCard.rarity]} Dust (Current: ${profile.arcaneDust}). Open 5 Packs ($4 or 450G) to advance Legendary pity +5 & earn Dust!`,
              )}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDustShortageCard(null);
                  onOpenShop();
                }}
                className="hs-gold-btn flex-1 rounded-xl py-2.5 text-xs font-extrabold"
              >
                🎁 {tr('보급소에서 5팩 묶음 보기', 'View 5-Pack Bundle')}
              </button>
              <button
                type="button"
                onClick={() => setDustShortageCard(null)}
                className="hs-brass-btn rounded-xl px-4 py-2.5 text-xs font-extrabold text-amber-100"
              >
                {tr('닫기', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
